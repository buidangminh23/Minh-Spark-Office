import { createStore, del, get, set, type UseStore } from 'idb-keyval';

export type SourceBlocks = { nodes: string[]; groups: Array<{ from: number; count: number; nodes: number }>; page: string };
export type SourceFile = { name: string; bytes: Uint8Array; signature?: string; parts?: string[]; blocks?: SourceBlocks };

let store: UseStore | null = null;
const sourceStore = () => (store ??= createStore('minh-office-sources', 'files'));

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function contentSignature(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let low = FNV_OFFSET;
  let high = FNV_OFFSET ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    low = Math.imul(low ^ code, FNV_PRIME);
    high = Math.imul(high ^ ((code << 5) | (index & 31)), FNV_PRIME);
  }
  return `${(low >>> 0).toString(16)}${(high >>> 0).toString(16)}:${text.length}`;
}

export async function saveSourceFile(id: string, source: SourceFile): Promise<void> {
  try {
    await set(id, source, sourceStore());
  } catch (error) {
    console.warn('Original file could not be kept:', error);
  }
}

export async function loadSourceFile(id: string): Promise<SourceFile | undefined> {
  try {
    return await get<SourceFile>(id, sourceStore());
  } catch {
    return undefined;
  }
}

type Stamp = Pick<SourceFile, 'signature' | 'parts' | 'blocks'>;

export async function stampSourceFile(id: string, stamp: (source: SourceFile) => Stamp | Promise<Stamp>): Promise<void> {
  const source = await loadSourceFile(id);
  if (!source || source.signature) return;
  await saveSourceFile(id, { ...source, ...(await stamp(source)) });
}

export async function removeSourceFile(id: string): Promise<void> {
  try {
    await del(id, sourceStore());
  } catch {
    return;
  }
}
