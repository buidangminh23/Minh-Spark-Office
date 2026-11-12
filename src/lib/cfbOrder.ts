const ENTRY_SIZE = 128;
const NO_STREAM = 0xffffffff;
const END_OF_CHAIN = 0xfffffffa;
const TYPE_STORAGE = 1;
const TYPE_ROOT = 5;
const BLACK = 1;

interface DirEntry {
  index: number;
  offset: number;
  name: string;
  type: number;
}

export function compareCfbNames(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length;
  const a = left.toUpperCase();
  const b = right.toUpperCase();
  for (let i = 0; i < a.length; i++) {
    const diff = a.charCodeAt(i) - b.charCodeAt(i);
    if (diff) return diff;
  }
  return 0;
}

function parseDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const perSector = sectorSize / 4;
  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sector = u32(0x4c + i * 4);
    if (sector < END_OF_CHAIN) fatSectors.push(sector);
  }
  let difat = u32(0x44);
  for (let guard = 0; difat < END_OF_CHAIN && guard < 1 << 16; guard++) {
    const base = sectorOffset(difat);
    for (let i = 0; i < perSector - 1; i++) {
      const sector = u32(base + i * 4);
      if (sector < END_OF_CHAIN) fatSectors.push(sector);
    }
    difat = u32(base + (perSector - 1) * 4);
  }
  const next = (sector: number) => u32(sectorOffset(fatSectors[Math.floor(sector / perSector)]) + (sector % perSector) * 4);
  const entries: DirEntry[] = [];
  let sector = u32(0x30);
  for (let guard = 0; sector < END_OF_CHAIN && guard < 1 << 20; guard++) {
    const base = sectorOffset(sector);
    for (let i = 0; i < sectorSize / ENTRY_SIZE; i++) {
      const offset = base + i * ENTRY_SIZE;
      const nameBytes = view.getUint16(offset + 0x40, true);
      let name = '';
      for (let c = 0; c + 2 < nameBytes; c += 2) name += String.fromCharCode(view.getUint16(offset + c, true));
      entries.push({ index: entries.length, offset, name, type: bytes[offset + 0x42] });
    }
    sector = next(sector);
  }
  return { view, entries };
}

export function fixCfbSiblingOrder(input: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(input);
  const { view, entries } = parseDirectory(bytes);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const left = (entry: DirEntry) => u32(entry.offset + 0x44);
  const right = (entry: DirEntry) => u32(entry.offset + 0x48);
  const child = (entry: DirEntry) => u32(entry.offset + 0x4c);
  const collect = (start: number, out: DirEntry[], seen: Set<number>) => {
    const stack = [start];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === NO_STREAM || id >= entries.length || seen.has(id)) continue;
      seen.add(id);
      const entry = entries[id];
      out.push(entry);
      stack.push(left(entry), right(entry));
    }
  };
  const build = (sorted: DirEntry[], lo: number, hi: number): number => {
    if (lo > hi) return NO_STREAM;
    const mid = (lo + hi) >> 1;
    const node = sorted[mid];
    view.setUint32(node.offset + 0x44, build(sorted, lo, mid - 1), true);
    view.setUint32(node.offset + 0x48, build(sorted, mid + 1, hi), true);
    bytes[node.offset + 0x43] = BLACK;
    return node.index;
  };
  for (const storage of entries) {
    if (storage.type !== TYPE_STORAGE && storage.type !== TYPE_ROOT) continue;
    const children: DirEntry[] = [];
    collect(child(storage), children, new Set());
    if (!children.length) continue;
    children.sort((a, b) => compareCfbNames(a.name, b.name));
    view.setUint32(storage.offset + 0x4c, build(children, 0, children.length - 1), true);
  }
  if (entries[0]) bytes[entries[0].offset + 0x43] = BLACK;
  return bytes;
}

export function cfbChildOrder(bytes: Uint8Array): Record<string, string[]> {
  const { view, entries } = parseDirectory(bytes);
  const read = (entry: DirEntry, field: number) => view.getUint32(entry.offset + field, true);
  const out: Record<string, string[]> = {};
  const walk = (id: number, into: string[]) => {
    if (id === NO_STREAM || id >= entries.length) return;
    walk(read(entries[id], 0x44), into);
    into.push(entries[id].name);
    walk(read(entries[id], 0x48), into);
  };
  for (const entry of entries) {
    if (entry.type !== TYPE_STORAGE && entry.type !== TYPE_ROOT) continue;
    const names: string[] = [];
    walk(read(entry, 0x4c), names);
    out[entry.name] = names;
  }
  return out;
}
