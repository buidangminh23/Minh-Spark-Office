import type * as CFBModule from 'cfb';
import { CFB as SHEETJS_CFB } from 'xlsx';

const CFB = SHEETJS_CFB as typeof CFBModule;

export type VbaModuleKind = 'standard' | 'document' | 'class' | 'form';

export interface VbaModuleData {
  name: string;
  kind: VbaModuleKind;
  code: string;
  attributes: string[];
  procAttributes?: Record<string, string[]>;
}

export interface VbaProjectData {
  modules: VbaModuleData[];
  codePage: number;
  raw?: string;
  originalCodes?: Record<string, string>;
  workbookCodeName?: string;
  sheetCodeNames?: Record<string, string>;
}

const DIR_PROJECTCODEPAGE = 0x0003;
const DIR_PROJECTMODULES = 0x000f;
const DIR_MODULENAME = 0x0019;
const DIR_MODULESTREAMNAME = 0x001a;
const DIR_MODULEOFFSET = 0x0031;
const DIR_MODULETYPE_PROCEDURAL = 0x0021;
const DIR_MODULETYPE_DOCUMENT = 0x0022;
const DIR_MODULE_TERMINATOR = 0x002b;
const DIR_TERMINATOR = 0x0010;
const DIR_PROJECTVERSION = 0x0009;
const CHUNK_SIZE = 4096;

export function decompressContainer(data: Uint8Array, start = 0): Uint8Array {
  if (data[start] !== 1) throw new Error('Dữ liệu VBA nén không hợp lệ (thiếu chữ ký 0x01)');
  const out: number[] = [];
  let position = start + 1;
  while (position + 1 < data.length) {
    const header = data[position] | (data[position + 1] << 8);
    position += 2;
    const chunkSize = (header & 0x0fff) + 3;
    const compressed = (header & 0x8000) !== 0;
    const chunkEnd = Math.min(data.length, position - 2 + chunkSize);
    const chunkStart = out.length;
    if (!compressed) {
      for (let i = 0; i < CHUNK_SIZE && position < data.length; i++) out.push(data[position++]);
      continue;
    }
    while (position < chunkEnd) {
      const flags = data[position++];
      for (let bit = 0; bit < 8 && position < chunkEnd; bit++) {
        if ((flags & (1 << bit)) === 0) {
          out.push(data[position++]);
          continue;
        }
        const token = data[position] | (data[position + 1] << 8);
        position += 2;
        const difference = out.length - chunkStart;
        let bitCount = 4;
        while (1 << bitCount < difference) bitCount += 1;
        bitCount = Math.min(bitCount, 12);
        const lengthMask = 0xffff >> bitCount;
        const length = (token & lengthMask) + 3;
        const offset = (token >> (16 - bitCount)) + 1;
        const copyFrom = out.length - offset;
        for (let i = 0; i < length; i++) out.push(out[copyFrom + i]);
      }
    }
  }
  return Uint8Array.from(out);
}

function compressChunk(source: Uint8Array, start: number, end: number): number[] {
  const out: number[] = [];
  let current = start;
  while (current < end) {
    const flagIndex = out.length;
    out.push(0);
    let flags = 0;
    for (let bit = 0; bit < 8 && current < end; bit++) {
      const difference = current - start;
      let bitCount = 4;
      while (1 << bitCount < difference) bitCount += 1;
      bitCount = Math.min(bitCount, 12);
      const maxLength = (0xffff >> bitCount) + 3;
      let bestLength = 0;
      let bestOffset = 0;
      for (let candidate = current - 1; candidate >= start; candidate--) {
        let length = 0;
        while (length < maxLength && current + length < end && source[candidate + length] === source[current + length]) length += 1;
        if (length > bestLength) {
          bestLength = length;
          bestOffset = current - candidate;
          if (length === maxLength) break;
        }
      }
      if (bestLength >= 3) {
        const token = ((bestOffset - 1) << (16 - bitCount)) | (bestLength - 3);
        out.push(token & 0xff, token >> 8);
        flags |= 1 << bit;
        current += bestLength;
      } else {
        out.push(source[current]);
        current += 1;
      }
    }
    out[flagIndex] = flags;
  }
  return out;
}

export function compressContainer(source: Uint8Array): Uint8Array {
  const out: number[] = [1];
  for (let start = 0; start < source.length; start += CHUNK_SIZE) {
    const end = Math.min(source.length, start + CHUNK_SIZE);
    const data = compressChunk(source, start, end);
    if (data.length > CHUNK_SIZE - 2 && end - start === CHUNK_SIZE) {
      out.push(0xff, 0x3f);
      for (let i = start; i < end; i++) out.push(source[i]);
      continue;
    }
    const header = 0xb000 | (data.length + 2 - 3);
    out.push(header & 0xff, header >> 8, ...data);
  }
  return Uint8Array.from(out);
}

const decoderCache = new Map<number, TextDecoder>();

function decoderFor(codePage: number): TextDecoder {
  let decoder = decoderCache.get(codePage);
  if (!decoder) {
    const label = codePage === 65001 ? 'utf-8' : codePage === 1200 ? 'utf-16le' : codePage === 10000 ? 'macintosh' : codePage === 932 ? 'shift_jis' : codePage === 936 ? 'gbk' : codePage === 949 ? 'euc-kr' : codePage === 950 ? 'big5' : `windows-${codePage}`;
    try {
      decoder = new TextDecoder(label);
    } catch {
      decoder = new TextDecoder('windows-1252');
    }
    decoderCache.set(codePage, decoder);
  }
  return decoder;
}

export function decodeText(bytes: Uint8Array, codePage: number): string {
  return decoderFor(codePage).decode(bytes);
}

const encoderCache = new Map<number, Map<string, number>>();

function singleByteMap(codePage: number): Map<string, number> {
  let map = encoderCache.get(codePage);
  if (map) return map;
  map = new Map();
  const decoder = decoderFor(codePage);
  for (let byte = 0; byte < 256; byte++) {
    const char = decoder.decode(Uint8Array.of(byte));
    if (char !== '\ufffd' && !map.has(char)) map.set(char, byte);
  }
  encoderCache.set(codePage, map);
  return map;
}

export function encodeText(text: string, codePage: number): Uint8Array {
  if (codePage === 65001) return new TextEncoder().encode(text);
  if (codePage === 1200) {
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i++) {
      out[i * 2] = text.charCodeAt(i) & 0xff;
      out[i * 2 + 1] = text.charCodeAt(i) >> 8;
    }
    return out;
  }
  const map = singleByteMap(codePage);
  const out: number[] = [];
  for (const char of text.normalize('NFC')) {
    const direct = map.get(char);
    if (direct !== undefined) {
      out.push(direct);
      continue;
    }
    const decomposed = [...char.normalize('NFD')];
    let index = 0;
    let encoded = false;
    for (let length = decomposed.length; length > 0 && !encoded; length--) {
      const head = decomposed.slice(0, length).join('').normalize('NFC');
      const byte = map.get(head);
      if (byte !== undefined) {
        out.push(byte);
        index = length;
        encoded = true;
      }
    }
    if (!encoded) {
      out.push(0x3f);
      continue;
    }
    for (const mark of decomposed.slice(index)) out.push(map.get(mark) ?? 0x3f);
  }
  return Uint8Array.from(out);
}

export function canEncode(text: string, codePage: number): boolean {
  if (codePage === 65001 || codePage === 1200) return true;
  const encoded = encodeText(text, codePage);
  return decodeText(encoded, codePage).normalize('NFC') === text.normalize('NFC');
}

interface DirRecord {
  id: number;
  data: Uint8Array;
}

function readDirRecords(dir: Uint8Array): DirRecord[] {
  const records: DirRecord[] = [];
  const view = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  let position = 0;
  while (position + 6 <= dir.length) {
    const id = view.getUint16(position, true);
    let size = view.getUint32(position + 2, true);
    if (id === DIR_PROJECTVERSION) size = 6;
    const data = dir.slice(position + 6, position + 6 + size);
    records.push({ id, data });
    position += 6 + size;
    if (id === DIR_TERMINATOR) break;
  }
  return records;
}

function writeDirRecords(records: DirRecord[]): Uint8Array {
  const total = records.reduce((sum, record) => sum + 6 + record.data.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let position = 0;
  for (const record of records) {
    view.setUint16(position, record.id, true);
    view.setUint32(position + 2, record.id === DIR_PROJECTVERSION ? 4 : record.data.length, true);
    out.set(record.data, position + 6);
    position += 6 + record.data.length;
  }
  return out;
}

const u16 = (value: number) => Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
const u32 = (value: number) => Uint8Array.of(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff);
const utf16 = (text: string) => encodeText(text, 1200);

interface DirModule {
  name: string;
  streamName: string;
  offset: number;
  kind: 'procedural' | 'document';
  recordStart: number;
  recordEnd: number;
}

function parseDir(records: DirRecord[]) {
  let codePage = 1252;
  const modules: DirModule[] = [];
  let current: Partial<DirModule> & { recordStart?: number } | null = null;
  records.forEach((record, index) => {
    const read32 = () => new DataView(record.data.buffer, record.data.byteOffset, record.data.byteLength).getUint32(0, true);
    switch (record.id) {
      case DIR_PROJECTCODEPAGE:
        codePage = record.data[0] | (record.data[1] << 8);
        break;
      case DIR_MODULENAME:
        current = { name: decodeText(record.data, codePage), recordStart: index, kind: 'procedural' };
        break;
      case DIR_MODULESTREAMNAME:
        if (current) current.streamName = decodeText(record.data, codePage);
        break;
      case DIR_MODULEOFFSET:
        if (current) current.offset = read32();
        break;
      case DIR_MODULETYPE_DOCUMENT:
        if (current) current.kind = 'document';
        break;
      case DIR_MODULETYPE_PROCEDURAL:
        if (current) current.kind = 'procedural';
        break;
      case DIR_MODULE_TERMINATOR:
        if (current?.name) {
          modules.push({ name: current.name, streamName: current.streamName ?? current.name, offset: current.offset ?? 0, kind: current.kind ?? 'procedural', recordStart: current.recordStart ?? index, recordEnd: index });
        }
        current = null;
        break;
      default:
        break;
    }
  });
  return { codePage, modules };
}

const ATTRIBUTE_LINE = /^Attribute\s+VB_/i;

function splitSource(source: string) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const attributes: string[] = [];
  let index = 0;
  while (index < lines.length && (ATTRIBUTE_LINE.test(lines[index]) || /^VERSION\s+\d/i.test(lines[index]) || /^(BEGIN|END)\s*$/i.test(lines[index]) || /^\s+MultiUse\s*=/i.test(lines[index]))) {
    attributes.push(lines[index]);
    index += 1;
  }
  return { attributes, code: lines.slice(index).join('\r\n').replace(/(\r\n)+$/, '') };
}

function projectStreamText(cfb: CFBModule.CFB$Container, codePage: number): string {
  const entry = CFB.find(cfb, '/PROJECT');
  return entry?.content ? decodeText(toBytes(entry.content), codePage) : '';
}

const toBytes = (content: CFBModule.CFB$Blob | ArrayLike<number> | undefined): Uint8Array => {
  if (!content) return new Uint8Array();
  if (content instanceof Uint8Array) return content;
  return Uint8Array.from(content as ArrayLike<number>);
};

function streamPath(cfb: CFBModule.CFB$Container, name: string): string | null {
  const direct = CFB.find(cfb, `/VBA/${name}`);
  if (direct) return `/VBA/${name}`;
  const lower = name.toLowerCase();
  const index = cfb.FullPaths.findIndex((path) => path.toLowerCase().endsWith(`/vba/${lower}`));
  return index >= 0 ? cfb.FullPaths[index].replace(/^Root Entry\//i, '/') : null;
}

export function readVbaProject(bytes: Uint8Array): VbaProjectData {
  const cfb = CFB.read(bytes, { type: 'array' });
  const dirEntry = CFB.find(cfb, '/VBA/dir');
  if (!dirEntry?.content) throw new Error('Tệp không có thư mục VBA/dir');
  const records = readDirRecords(decompressContainer(toBytes(dirEntry.content)));
  const { codePage, modules } = parseDir(records);
  const projectText = projectStreamText(cfb, codePage);
  const classNames = new Set([...projectText.matchAll(/^Class=(.+)$/gim)].map((match) => match[1].trim().toLowerCase()));
  const formNames = new Set([...projectText.matchAll(/^BaseClass=(.+)$/gim)].map((match) => match[1].trim().toLowerCase()));
  const result: VbaProjectData = { modules: [], codePage, originalCodes: {} };
  for (const module of modules) {
    const path = streamPath(cfb, module.streamName);
    const stream = path ? CFB.find(cfb, path) : null;
    let source = '';
    if (stream?.content) {
      try {
        source = decodeText(decompressContainer(toBytes(stream.content), module.offset), codePage);
      } catch {
        source = '';
      }
    }
    const { attributes, code: rawCode } = splitSource(source);
    const extracted = extractProcAttributes(fromAsciiSafeVba(rawCode));
    const code = extracted.code;
    const lower = module.name.toLowerCase();
    const kind: VbaModuleKind = module.kind === 'document' ? (formNames.has(lower) ? 'form' : 'document') : classNames.has(lower) ? 'class' : formNames.has(lower) ? 'form' : 'standard';
    result.modules.push({ name: module.name, kind, code, attributes, procAttributes: extracted.attributes });
    result.originalCodes![module.name] = code;
  }
  result.raw = toBase64(bytes);
  return result;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const DOC_BASE_WORKBOOK = '0{00020819-0000-0000-C000-000000000046}';
const DOC_BASE_SHEET = '0{00020820-0000-0000-C000-000000000046}';

export function defaultAttributes(module: Pick<VbaModuleData, 'name' | 'kind'>, isWorkbook = false): string[] {
  if (module.kind === 'standard') return [`Attribute VB_Name = "${module.name}"`];
  if (module.kind === 'class') {
    return [
      'VERSION 1.0 CLASS',
      'BEGIN',
      '  MultiUse = -1  \'True',
      'END',
      `Attribute VB_Name = "${module.name}"`,
      'Attribute VB_GlobalNameSpace = False',
      'Attribute VB_Creatable = False',
      'Attribute VB_PredeclaredId = False',
      'Attribute VB_Exposed = False',
    ];
  }
  return [
    `Attribute VB_Name = "${module.name}"`,
    `Attribute VB_Base = "${isWorkbook ? DOC_BASE_WORKBOOK : DOC_BASE_SHEET}"`,
    'Attribute VB_GlobalNameSpace = False',
    'Attribute VB_Creatable = False',
    'Attribute VB_PredeclaredId = True',
    'Attribute VB_Exposed = True',
    'Attribute VB_TemplateDerived = False',
    'Attribute VB_Customizable = True',
  ];
}

function moduleSource(module: VbaModuleData, isWorkbook: boolean): string {
  const attributes = module.attributes.length ? module.attributes : defaultAttributes(module, isWorkbook);
  const code = toAsciiSafeVba(injectProcAttributes(module.code, module.procAttributes)).replace(/\r\n?/g, '\n').split('\n').join('\r\n');
  return `${attributes.join('\r\n')}\r\n${code}${code.endsWith('\r\n') ? '' : '\r\n'}`;
}

const VBA_PROJECT_STREAM = Uint8Array.of(0xcc, 0x61, 0xff, 0xff, 0x00, 0x00, 0x00);

function moduleRecords(name: string, kind: VbaModuleKind, codePage: number): DirRecord[] {
  const nameBytes = encodeText(name, codePage);
  return [
    { id: DIR_MODULENAME, data: nameBytes },
    { id: 0x0047, data: utf16(name) },
    { id: DIR_MODULESTREAMNAME, data: nameBytes },
    { id: 0x0032, data: utf16(name) },
    { id: 0x001c, data: new Uint8Array() },
    { id: 0x0048, data: new Uint8Array() },
    { id: DIR_MODULEOFFSET, data: u32(0) },
    { id: 0x001e, data: u32(0) },
    { id: 0x002c, data: u16(0xffff) },
    { id: kind === 'standard' ? DIR_MODULETYPE_PROCEDURAL : DIR_MODULETYPE_DOCUMENT, data: new Uint8Array() },
    { id: DIR_MODULE_TERMINATOR, data: new Uint8Array() },
  ];
}

function encryptProjectValue(data: Uint8Array, projectId: string): string {
  const seed = Math.floor(Math.random() * 256);
  const version = 2;
  let projectKey = 0;
  for (const char of projectId) projectKey = (projectKey + char.charCodeAt(0)) & 0xff;
  const out: number[] = [seed, seed ^ version, seed ^ projectKey];
  let unencryptedByte1 = projectKey;
  let encryptedByte1 = seed ^ projectKey;
  let encryptedByte2 = seed ^ version;
  const push = (byte: number) => {
    const encrypted = ((encryptedByte2 + unencryptedByte1) & 0xff) ^ byte;
    out.push(encrypted);
    encryptedByte2 = encryptedByte1;
    encryptedByte1 = encrypted;
    unencryptedByte1 = byte;
  };
  const ignoredLength = (seed & 6) / 2;
  for (let i = 0; i < ignoredLength; i++) push(0);
  for (const byte of u32(data.length)) push(byte);
  for (const byte of data) push(byte);
  return out.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join('');
}

function newGuid(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

function projectStream(modules: VbaModuleData[], codePage: number): Uint8Array {
  const id = newGuid();
  const lines = [`ID="${id}"`];
  for (const module of modules) {
    if (module.kind === 'document') lines.push(`Document=${module.name}/&H00000000`);
    else if (module.kind === 'class') lines.push(`Class=${module.name}`);
    else if (module.kind === 'standard') lines.push(`Module=${module.name}`);
  }
  lines.push(
    'Name="VBAProject"',
    'HelpContextID="0"',
    'VersionCompatible32="393222000"',
    `CMG="${encryptProjectValue(u32(0), id)}"`,
    `DPB="${encryptProjectValue(Uint8Array.of(0), id)}"`,
    `GC="${encryptProjectValue(Uint8Array.of(0xff), id)}"`,
    '',
    '[Host Extender Info]',
    '&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000',
    '',
    '[Workspace]',
    ...modules.map((module) => `${module.name}=0, 0, 0, 0, C`),
    ''
  );
  return encodeText(lines.join('\r\n'), codePage);
}

function projectWmStream(modules: VbaModuleData[], codePage: number): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const module of modules) {
    parts.push(encodeText(module.name, codePage), Uint8Array.of(0), utf16(module.name), Uint8Array.of(0, 0));
  }
  parts.push(Uint8Array.of(0, 0));
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function freshDirRecords(modules: VbaModuleData[], codePage: number): DirRecord[] {
  const stdoleLibid = encodeText('*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation', codePage);
  const officeLibid = encodeText('*\\G{2DF8D04C-5BFA-101B-BDE5-00AA0044DE52}#2.0#0#C:\\Program Files\\Common Files\\Microsoft Shared\\OFFICE16\\MSO.DLL#Microsoft Office 16.0 Object Library', codePage);
  const registered = (libid: Uint8Array) => concat([u32(libid.length), libid, u32(0), u16(0)]);
  return [
    { id: 0x0001, data: u32(1) },
    { id: 0x004a, data: u32(3) },
    { id: 0x0002, data: u32(0x0409) },
    { id: 0x0014, data: u32(0x0409) },
    { id: DIR_PROJECTCODEPAGE, data: u16(codePage) },
    { id: 0x0004, data: encodeText('VBAProject', codePage) },
    { id: 0x0005, data: new Uint8Array() },
    { id: 0x0040, data: new Uint8Array() },
    { id: 0x0006, data: new Uint8Array() },
    { id: 0x003d, data: new Uint8Array() },
    { id: 0x0007, data: u32(0) },
    { id: 0x0008, data: u32(0) },
    { id: DIR_PROJECTVERSION, data: concat([u32(0x5cba0ff0), u16(0x0006)]) },
    { id: 0x000c, data: new Uint8Array() },
    { id: 0x003c, data: new Uint8Array() },
    { id: 0x0016, data: encodeText('stdole', codePage) },
    { id: 0x003e, data: utf16('stdole') },
    { id: 0x000d, data: registered(stdoleLibid) },
    { id: 0x0016, data: encodeText('Office', codePage) },
    { id: 0x003e, data: utf16('Office') },
    { id: 0x000d, data: registered(officeLibid) },
    { id: DIR_PROJECTMODULES, data: u16(modules.length) },
    { id: 0x0013, data: u16(0xffff) },
    ...modules.flatMap((module) => moduleRecords(module.name, module.kind, codePage)),
    { id: DIR_TERMINATOR, data: new Uint8Array() },
  ];
}

export function chooseCodePage(modules: VbaModuleData[], preferred: number): number {
  const text = modules.map((module) => `${module.name}\n${module.code}`).join('\n');
  if (canEncode(text, preferred)) return preferred;
  for (const candidate of [1252, 1258]) if (canEncode(text, candidate)) return candidate;
  return preferred;
}

export interface BuildVbaOptions {
  workbookCodeName: string;
  sheetCodeNames: string[];
}

export function ensureDocumentModules(project: VbaProjectData, options: BuildVbaOptions): VbaModuleData[] {
  const modules = [...project.modules];
  const has = (name: string) => modules.some((module) => module.name.toLowerCase() === name.toLowerCase());
  if (!has(options.workbookCodeName)) modules.unshift({ name: options.workbookCodeName, kind: 'document', code: '', attributes: defaultAttributes({ name: options.workbookCodeName, kind: 'document' }, true) });
  for (const name of options.sheetCodeNames) {
    if (!has(name)) modules.push({ name, kind: 'document', code: '', attributes: defaultAttributes({ name, kind: 'document' }) });
  }
  return modules;
}

export function buildVbaProject(project: VbaProjectData, options: BuildVbaOptions): Uint8Array {
  const modules = ensureDocumentModules(project, options).filter((module) => module.kind !== 'form');
  const codePage = chooseCodePage(modules, project.codePage || 1252);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/PROJECT', projectStream(modules, codePage));
  CFB.utils.cfb_add(cfb, '/PROJECTwm', projectWmStream(modules, codePage));
  CFB.utils.cfb_add(cfb, '/VBA/_VBA_PROJECT', VBA_PROJECT_STREAM);
  CFB.utils.cfb_add(cfb, '/VBA/dir', compressContainer(writeDirRecords(freshDirRecords(modules, codePage))));
  for (const module of modules) {
    const isWorkbook = module.name.toLowerCase() === options.workbookCodeName.toLowerCase();
    CFB.utils.cfb_add(cfb, `/VBA/${module.name}`, compressContainer(encodeText(moduleSource(module, isWorkbook), codePage)));
  }
  CFB.utils.cfb_del(cfb, '\u0001Sh33tJ5');
  CFB.utils.cfb_gc(cfb);
  return toBytes(CFB.write(cfb, { type: 'array', fileType: 'cfb' }) as Uint8Array);
}

export function updateVbaProject(raw: Uint8Array, project: VbaProjectData, options: BuildVbaOptions): Uint8Array {
  const cfb = CFB.read(raw, { type: 'array' });
  const dirEntry = CFB.find(cfb, '/VBA/dir');
  if (!dirEntry?.content) return buildVbaProject(project, options);
  const records = readDirRecords(decompressContainer(toBytes(dirEntry.content)));
  const parsed = parseDir(records);
  const codePage = parsed.codePage;
  const wanted = ensureDocumentModules(project, options);
  const wantedByName = new Map(wanted.map((module) => [module.name.toLowerCase(), module]));
  const existingNames = new Set(parsed.modules.map((module) => module.name.toLowerCase()));
  const removed = parsed.modules.filter((module) => !wantedByName.has(module.name.toLowerCase()) && module.kind === 'procedural');
  const removedIndexes = new Set<number>();
  for (const module of removed) for (let i = module.recordStart; i <= module.recordEnd; i++) removedIndexes.add(i);
  const added = wanted.filter((module) => !existingNames.has(module.name.toLowerCase()) && module.kind !== 'form');
  let nextRecords = records.filter((_, index) => !removedIndexes.has(index)).map((record) => (record.id === DIR_MODULEOFFSET ? { id: record.id, data: u32(0) } : record));
  const terminatorIndex = nextRecords.findIndex((record) => record.id === DIR_TERMINATOR);
  const addedRecords = added.flatMap((module) => moduleRecords(module.name, module.kind, codePage));
  nextRecords = [...nextRecords.slice(0, terminatorIndex), ...addedRecords, ...nextRecords.slice(terminatorIndex)];
  const count = parsed.modules.length - removed.length + added.length;
  nextRecords = nextRecords.map((record) => (record.id === DIR_PROJECTMODULES ? { id: record.id, data: u16(count) } : record));
  CFB.utils.cfb_add(cfb, '/VBA/dir', compressContainer(writeDirRecords(nextRecords)));
  CFB.utils.cfb_add(cfb, '/VBA/_VBA_PROJECT', VBA_PROJECT_STREAM);
  for (const module of parsed.modules) {
    if (removed.includes(module)) {
      const path = streamPath(cfb, module.streamName);
      if (path) CFB.utils.cfb_del(cfb, path);
      continue;
    }
    const source = wantedByName.get(module.name.toLowerCase());
    if (!source || source.kind === 'form') {
      const path = streamPath(cfb, module.streamName);
      const entry = path ? CFB.find(cfb, path) : null;
      if (entry?.content && module.offset > 0) {
        const text = decodeText(decompressContainer(toBytes(entry.content), module.offset), codePage);
        CFB.utils.cfb_add(cfb, path!, compressContainer(encodeText(text, codePage)));
      }
      continue;
    }
    const isWorkbook = module.name.toLowerCase() === options.workbookCodeName.toLowerCase();
    const path = streamPath(cfb, module.streamName) ?? `/VBA/${module.streamName}`;
    CFB.utils.cfb_add(cfb, path, compressContainer(encodeText(moduleSource(source, isWorkbook), codePage)));
  }
  for (const module of added) CFB.utils.cfb_add(cfb, `/VBA/${module.name}`, compressContainer(encodeText(moduleSource(module, false), codePage)));
  for (const path of [...cfb.FullPaths]) {
    if (/\/VBA\/__SRP_\d+$/i.test(path)) CFB.utils.cfb_del(cfb, path.replace(/^Root Entry\//i, '/'));
  }
  const projectEntry = CFB.find(cfb, '/PROJECT');
  if (projectEntry?.content) {
    let text = decodeText(toBytes(projectEntry.content), codePage);
    for (const module of removed) text = text.replace(new RegExp(`^Module=${escapeRegExp(module.name)}\\r?\\n`, 'im'), '').replace(new RegExp(`^${escapeRegExp(module.name)}=.*\\r?\\n`, 'im'), '');
    const newLines = added.map((module) => (module.kind === 'class' ? `Class=${module.name}` : module.kind === 'document' ? `Document=${module.name}/&H00000000` : `Module=${module.name}`));
    if (newLines.length) text = text.replace(/^(Name=)/m, `${newLines.join('\r\n')}\r\n$1`);
    const workspaceLines = added.map((module) => `${module.name}=0, 0, 0, 0, C`);
    if (workspaceLines.length) text = /\[Workspace\]\r?\n/.test(text) ? text.replace(/\[Workspace\]\r?\n/, `[Workspace]\r\n${workspaceLines.join('\r\n')}\r\n`) : `${text}\r\n[Workspace]\r\n${workspaceLines.join('\r\n')}\r\n`;
    CFB.utils.cfb_add(cfb, '/PROJECT', encodeText(text, codePage));
  }
  const wmEntry = CFB.find(cfb, '/PROJECTwm');
  if (wmEntry?.content) {
    const allModules = [...parsed.modules.filter((module) => !removed.includes(module)).map((module) => wantedByName.get(module.name.toLowerCase()) ?? { name: module.name, kind: 'standard' as VbaModuleKind, code: '', attributes: [] }), ...added];
    CFB.utils.cfb_add(cfb, '/PROJECTwm', projectWmStream(allModules, codePage));
  }
  CFB.utils.cfb_gc(cfb);
  return toBytes(CFB.write(cfb, { type: 'array', fileType: 'cfb' }) as Uint8Array);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isModuleCodeChanged(project: VbaProjectData): boolean {
  const original = project.originalCodes ?? {};
  const names = new Set(project.modules.map((module) => module.name));
  if (Object.keys(original).some((name) => !names.has(name))) return true;
  return project.modules.some((module) => original[module.name] === undefined || original[module.name] !== module.code);
}

const STRING_LITERAL = /"(?:[^"\r\n]|"")*"/y;

function commentStart(line: string): number {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inString = !inString;
    else if (char === "'" && !inString) return i;
  }
  return line.length;
}

function literalToExpression(literal: string): string {
  const text = literal.slice(1, -1).replace(/""/g, '"');
  const parts: string[] = [];
  let ascii = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      ascii += char;
      continue;
    }
    if (ascii) parts.push(`"${ascii.replace(/"/g, '""')}"`);
    ascii = '';
    if (code > 0xffff) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      parts.push(`ChrW(${high})`, `ChrW(${low})`);
    } else parts.push(`ChrW(${code})`);
  }
  if (ascii) parts.push(`"${ascii.replace(/"/g, '""')}"`);
  return parts.join(' & ') || '""';
}

export function toAsciiSafeVba(code: string): string {
  return code
    .split(/\r\n|\r|\n/)
    .map((line) => {
      if (!/[^\x00-\x7f]/.test(line) || /^\s*((Public|Private|Global)\s+)?Const\b/i.test(line) || /^\s*(Attribute|Declare|Private\s+Declare|Public\s+Declare)\b/i.test(line)) return line;
      const end = commentStart(line);
      let result = '';
      let index = 0;
      while (index < end) {
        if (line[index] === '"') {
          STRING_LITERAL.lastIndex = index;
          const match = STRING_LITERAL.exec(line);
          if (match) {
            result += /[^\x00-\x7f]/.test(match[0]) ? literalToExpression(match[0]) : match[0];
            index += match[0].length;
            continue;
          }
        }
        result += line[index];
        index += 1;
      }
      return result + line.slice(end);
    })
    .join('\r\n');
}

const CHAIN = /(?:"(?:[^"\r\n]|"")*"|ChrW\$?\(\s*\d+\s*\))(?:\s*&\s*(?:"(?:[^"\r\n]|"")*"|ChrW\$?\(\s*\d+\s*\)))+/gi;

export function fromAsciiSafeVba(code: string): string {
  return code
    .split(/\r\n|\r|\n/)
    .map((line) => {
      if (!/ChrW/i.test(line)) return line;
      const end = commentStart(line);
      const head = line.slice(0, end).replace(CHAIN, (chain) => {
        const pieces = chain.split(/\s*&\s*(?=(?:"|ChrW))/i);
        let text = '';
        let hasWide = false;
        let hasLiteral = false;
        for (const piece of pieces) {
          const chr = /^ChrW\$?\(\s*(\d+)\s*\)$/i.exec(piece.trim());
          if (chr) {
            const value = Number(chr[1]);
            if (value < 0x80) return chain;
            hasWide = true;
            text += String.fromCharCode(value);
          } else {
            hasLiteral = true;
            text += piece.trim().slice(1, -1).replace(/""/g, '"');
          }
        }
        if (!hasWide || (!hasLiteral && pieces.length < 2)) return chain;
        return `"${text.normalize('NFC').replace(/"/g, '""')}"`;
      });
      return head + line.slice(end);
    })
    .join('\r\n');
}

const PROC_HEADER = /^\s*(?:(?:Public|Private|Friend|Static)\s+)*(?:Sub|Function|Property\s+(?:Get|Let|Set))\s+([\p{L}\w]+)/iu;
const PROC_ATTRIBUTE = /^\s*Attribute\s+([\p{L}\w]+)\.(VB_\w+(?:\.VB_\w+)?)\s*=\s*(.*)$/iu;

export function extractProcAttributes(code: string): { code: string; attributes: Record<string, string[]> } {
  const attributes: Record<string, string[]> = {};
  const kept: string[] = [];
  for (const line of code.split(/\r\n|\r|\n/)) {
    const match = PROC_ATTRIBUTE.exec(line);
    if (match) {
      (attributes[match[1].toLowerCase()] ??= []).push(line.trim());
      continue;
    }
    kept.push(line);
  }
  return { code: kept.join('\r\n'), attributes };
}

export function injectProcAttributes(code: string, attributes: Record<string, string[]> | undefined): string {
  if (!attributes || !Object.keys(attributes).length) return code;
  const lines = code.split(/\r\n|\r|\n/);
  const out: string[] = [];
  let pending: string[] | null = null;
  for (const line of lines) {
    out.push(line);
    const header = PROC_HEADER.exec(line);
    if (header && attributes[header[1].toLowerCase()]) pending = attributes[header[1].toLowerCase()];
    if (pending && !/\s_\s*$/.test(line)) {
      out.push(...pending);
      pending = null;
    }
  }
  return out.join('\r\n');
}

const INVOKE_FUNC = /VB_ProcData\.VB_Invoke_Func\s*=\s*"(.)\\n\d+"/i;

export function procShortcut(lines: string[] | undefined): string {
  for (const line of lines ?? []) {
    const match = INVOKE_FUNC.exec(line);
    if (match && /[A-Za-z]/.test(match[1])) return match[1];
  }
  return '';
}

export function withProcShortcut(lines: string[] | undefined, procName: string, letter: string): string[] {
  const rest = (lines ?? []).filter((line) => !INVOKE_FUNC.test(line));
  if (!letter) return rest;
  return [...rest, `Attribute ${procName}.VB_ProcData.VB_Invoke_Func = "${letter}\\n14"`];
}

export function procDescription(lines: string[] | undefined): string {
  for (const line of lines ?? []) {
    const match = /VB_Description\s*=\s*"((?:[^"]|"")*)"/i.exec(line);
    if (match) return match[1].replace(/""/g, '"');
  }
  return '';
}
