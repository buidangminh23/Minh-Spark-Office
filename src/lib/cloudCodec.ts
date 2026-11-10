import type { FileContent, FileMeta, FileVersion } from './storage';

export const MAX_COMPRESSED_BYTES = 256 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
export const CHUNK_CHARACTERS = 600000;
export const MAX_CHUNKS = 600;
export const LEGACY_MAX_CHUNKS = 14;
export const LEGACY_MAX_COMPRESSED_BYTES = 6 * 1024 * 1024;
export const LEGACY_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const CLOUD_ENCODING = 'gzip-base64';

export type PayloadLimits = { compressed: number; uncompressed: number };
const DEFAULT_LIMITS: PayloadLimits = { compressed: MAX_COMPRESSED_BYTES, uncompressed: MAX_UNCOMPRESSED_BYTES };

export const chunkCountFor = (compressedBytes: number) => Math.ceil(Math.ceil(compressedBytes / 3) * 4 / CHUNK_CHARACTERS);

export function cloudSchemaFor(encoded: Pick<EncodedCloudPayload, 'compressedBytes' | 'uncompressedBytes'> & { chunks: unknown[] }): 1 | 2 {
  const fitsLegacy = encoded.chunks.length <= LEGACY_MAX_CHUNKS && encoded.compressedBytes <= LEGACY_MAX_COMPRESSED_BYTES && encoded.uncompressedBytes <= LEGACY_MAX_UNCOMPRESSED_BYTES;
  return fitsLegacy ? 1 : 2;
}

export type ManifestOutcome = 'commit' | 'committed' | 'conflict';

export function manifestOutcome(currentRevision: string | null, expectedRevision: string | null, ownRevision: string): ManifestOutcome {
  if (currentRevision !== null && currentRevision === ownRevision) return 'committed';
  return currentRevision === expectedRevision ? 'commit' : 'conflict';
}

export const ORPHAN_SAFE_AGE_MS = 60 * 60 * 1000;
export const ORPHAN_JOURNAL_LIMIT = 200;
export const ORPHAN_MAX_ATTEMPTS = 20;
export type OrphanEntry = { fileId: string; chunkCount: number; since: number; attempts: number };
export type OrphanJournal = Record<string, OrphanEntry>;

const validOrphan = (value: unknown): value is OrphanEntry => object(value) && typeof value.fileId === 'string' && Number.isInteger(value.chunkCount) && (value.chunkCount as number) >= 0 && (value.chunkCount as number) <= MAX_CHUNKS
  && finite(value.since) && Number.isInteger(value.attempts) && (value.attempts as number) >= 0;

export function parseOrphanJournal(value: unknown): OrphanJournal {
  if (!object(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([revision, entry]) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(revision) && validOrphan(entry))) as OrphanJournal;
}

export function recordOrphanSuspect(journal: OrphanJournal, revision: string, fileId: string, chunkCount: number, now: number): OrphanJournal {
  const next: OrphanJournal = { ...journal, [revision]: { fileId, chunkCount: Math.min(Math.max(chunkCount, journal[revision]?.chunkCount ?? 0), MAX_CHUNKS), since: journal[revision]?.since ?? now, attempts: journal[revision]?.attempts ?? 0 } };
  const entries = Object.entries(next);
  if (entries.length <= ORPHAN_JOURNAL_LIMIT) return next;
  entries.sort(([, a], [, b]) => b.since - a.since);
  return Object.fromEntries(entries.slice(0, ORPHAN_JOURNAL_LIMIT));
}

export function forgetOrphan(journal: OrphanJournal, revision: string): OrphanJournal {
  if (!(revision in journal)) return journal;
  const next = { ...journal };
  delete next[revision];
  return next;
}

export function orphanFailed(journal: OrphanJournal, revision: string): OrphanJournal {
  const entry = journal[revision];
  if (!entry) return journal;
  if (entry.attempts + 1 >= ORPHAN_MAX_ATTEMPTS) return forgetOrphan(journal, revision);
  return { ...journal, [revision]: { ...entry, attempts: entry.attempts + 1 } };
}

export function orphanCandidates(journal: OrphanJournal, now: number, active: ReadonlySet<string>, limit: number): Array<[string, OrphanEntry]> {
  return Object.entries(journal)
    .filter(([revision, entry]) => !active.has(revision) && entry.since <= now - ORPHAN_SAFE_AGE_MS)
    .sort(([, a], [, b]) => a.since - b.since)
    .slice(0, Math.max(0, limit));
}

export type CloudPayload = { content: FileContent; versions: FileVersion[] };
export type EncodedCloudPayload = {
  chunks: string[];
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
};

function fail(message: string): never { throw new Error(`cloud/invalid-data: ${message}`); }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit;

export function validateCloudId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) fail('Invalid file identifier');
}

export function validateCloudMeta(value: unknown, id: string): asserts value is FileMeta {
  validateCloudId(id);
  if (!object(value)) fail('Missing file metadata');
  const keys = ['id', 'name', 'kind', 'createdAt', 'updatedAt', 'openedAt', 'starred', 'deletedAt', 'size', 'preview'];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) fail('Unexpected metadata fields');
  if (value.id !== id || !text(value.name, 1024) || !text(value.preview, 8000)) fail('Invalid file metadata');
  if (!['doc', 'sheet', 'pdf', 'slide', 'image'].includes(String(value.kind))) fail('Invalid file kind');
  if (![value.createdAt, value.updatedAt, value.openedAt, value.size].every(finite) || typeof value.starred !== 'boolean') fail('Invalid metadata values');
  if (value.deletedAt !== null && !finite(value.deletedAt)) fail('Invalid deletion timestamp');
}

function validateContent(value: unknown, kind: FileMeta['kind']): asserts value is FileContent {
  if (!object(value) || value.kind !== kind) fail('Content kind does not match metadata');
  if (kind === 'doc') {
    if (typeof value.json !== 'string') {
      if (!object(value.json) || value.json.type !== 'doc') fail('Invalid document content');
      if (value.json.content !== undefined && !Array.isArray(value.json.content)) fail('Invalid document nodes');
    }
    if (!object(value.page)) fail('Invalid document content');
    const page = value.page;
    if (!['portrait', 'landscape'].includes(String(page.orientation)) || typeof page.size !== 'string' || !object(page.margins)) fail('Invalid page settings');
    if (!['top', 'right', 'bottom', 'left'].every((key) => finite((page.margins as Record<string, unknown>)[key]))) fail('Invalid page margins');
  } else if (kind === 'sheet') {
    if (!object(value.workbook) || !object(value.workbook.sheets) || !Array.isArray(value.workbook.sheetOrder)) fail('Invalid workbook');
    const sheets = value.workbook.sheets;
    if (value.workbook.sheetOrder.some((id) => typeof id !== 'string' || !object(sheets[id]))) fail('Invalid worksheet references');
  } else if (kind === 'pdf') {
    if (value.pdfDataUrl !== undefined && (typeof value.pdfDataUrl !== 'string' || !value.pdfDataUrl.startsWith('data:application/pdf;base64,'))) fail('Invalid PDF data');
    if (value.pageCount !== undefined && (!Number.isInteger(value.pageCount) || !finite(value.pageCount))) fail('Invalid PDF page count');
  } else if (kind === 'slide') {
    if (!object(value.presentation) || !Array.isArray(value.presentation.slides)) fail('Invalid presentation content');
  } else if (kind === 'image') {
    if (typeof value.imageDataUrl !== 'string' || (!value.imageDataUrl.startsWith('data:image/') && !value.imageDataUrl.startsWith('blob:'))) fail('Invalid image data');
  }
}

export function validateCloudPayload(value: unknown, meta: FileMeta): asserts value is CloudPayload {
  if (!object(value) || Object.keys(value).length !== 2 || !('content' in value) || !Array.isArray(value.versions) || value.versions.length > 30) fail('Invalid payload');
  validateContent(value.content, meta.kind);
  const ids = new Set<string>();
  for (const version of value.versions) {
    if (!object(version) || !text(version.id, 160) || !version.id || version.fileId !== meta.id || !finite(version.timestamp) || !text(version.label, 1024)) fail('Invalid file version');
    if (ids.has(version.id)) fail('Duplicate version identifier');
    ids.add(version.id);
    validateContent(version.content, meta.kind);
  }
}

async function transform(input: Uint8Array, decompress: boolean, maximum: number) {
  const stream = new Blob([input.slice().buffer]).stream().pipeThrough(decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new Error('cloud/payload-too-large');
      }
      parts.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

async function digest(data: Uint8Array) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data.slice().buffer));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function encodeCloudPayload(content: FileContent | undefined, versions: FileVersion[], meta: FileMeta, limits: PayloadLimits = DEFAULT_LIMITS): Promise<EncodedCloudPayload> {
  validateCloudMeta(meta, meta.id);
  const payload = { content, versions };
  validateCloudPayload(payload, meta);
  const json = JSON.stringify(payload);
  if (json.length > limits.uncompressed) throw new Error('cloud/payload-too-large');
  const input = new TextEncoder().encode(json);
  if (input.byteLength > limits.uncompressed) throw new Error('cloud/payload-too-large');
  const compressed = await transform(input, false, limits.compressed);
  const chunks: string[] = [];
  const bytesPerChunk = CHUNK_CHARACTERS / 4 * 3;
  for (let start = 0; start < compressed.length; start += bytesPerChunk) {
    const slice = compressed.subarray(start, Math.min(compressed.length, start + bytesPerChunk));
    let binary = '';
    for (let offset = 0; offset < slice.length; offset += 8192) binary += String.fromCharCode(...slice.subarray(offset, offset + 8192));
    chunks.push(btoa(binary));
  }
  if (chunks.length > MAX_CHUNKS) throw new Error('cloud/payload-too-large');
  return { chunks, compressedBytes: compressed.length, uncompressedBytes: input.length, sha256: await digest(compressed) };
}

export async function decodeCloudPayload(encoded: EncodedCloudPayload, meta: FileMeta): Promise<CloudPayload> {
  validateCloudMeta(meta, meta.id);
  if (!Number.isInteger(encoded.compressedBytes) || encoded.compressedBytes < 1 || encoded.compressedBytes > MAX_COMPRESSED_BYTES || !Number.isInteger(encoded.uncompressedBytes) || encoded.uncompressedBytes < 1 || encoded.uncompressedBytes > MAX_UNCOMPRESSED_BYTES) fail('Invalid payload size');
  if (!/^[a-f0-9]{64}$/.test(encoded.sha256) || !Array.isArray(encoded.chunks) || encoded.chunks.length < 1 || encoded.chunks.length > MAX_CHUNKS) fail('Invalid payload descriptor');
  const expectedLength = Math.ceil(encoded.compressedBytes / 3) * 4;
  if (encoded.chunks.length !== Math.ceil(expectedLength / CHUNK_CHARACTERS)) fail('Invalid chunk count');
  for (const [index, chunk] of encoded.chunks.entries()) {
    const expected = Math.min(CHUNK_CHARACTERS, expectedLength - index * CHUNK_CHARACTERS);
    if (typeof chunk !== 'string' || chunk.length !== expected || !/^[A-Za-z0-9+/]*={0,2}$/.test(chunk)) fail('Invalid payload chunk');
    if (index < encoded.chunks.length - 1 && chunk.includes('=')) fail('Unexpected base64 padding');
  }
  const compressed = new Uint8Array(encoded.compressedBytes);
  let filled = 0;
  for (const chunk of encoded.chunks) {
    const binary = atob(chunk);
    if (filled + binary.length > compressed.length) fail('Payload chunk overflow');
    for (let index = 0; index < binary.length; index++) compressed[filled + index] = binary.charCodeAt(index);
    filled += binary.length;
  }
  if (filled !== encoded.compressedBytes || await digest(compressed) !== encoded.sha256) fail('Payload checksum mismatch');
  const input = await transform(compressed, true, Math.min(encoded.uncompressedBytes, MAX_UNCOMPRESSED_BYTES));
  if (input.byteLength !== encoded.uncompressedBytes) fail('Payload length mismatch');
  const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input));
  validateCloudPayload(payload, meta);
  return payload;
}
