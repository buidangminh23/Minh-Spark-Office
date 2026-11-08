import type { FileContent, FileMeta, FileVersion } from './storage';

export const MAX_COMPRESSED_BYTES = 6 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const CHUNK_CHARACTERS = 600000;
export const MAX_CHUNKS = 14;
export const CLOUD_ENCODING = 'gzip-base64';

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

export async function encodeCloudPayload(content: FileContent | undefined, versions: FileVersion[], meta: FileMeta): Promise<EncodedCloudPayload> {
  validateCloudMeta(meta, meta.id);
  const payload = { content, versions };
  validateCloudPayload(payload, meta);
  const json = JSON.stringify(payload);
  if (json.length > MAX_UNCOMPRESSED_BYTES) throw new Error('cloud/payload-too-large');
  const input = new TextEncoder().encode(json);
  if (input.byteLength > MAX_UNCOMPRESSED_BYTES) throw new Error('cloud/payload-too-large');
  const compressed = await transform(input, false, MAX_COMPRESSED_BYTES);
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 8192) binary += String.fromCharCode(...compressed.subarray(offset, offset + 8192));
  const base64 = btoa(binary);
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += CHUNK_CHARACTERS) chunks.push(base64.slice(offset, offset + CHUNK_CHARACTERS));
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
  const binary = atob(encoded.chunks.join(''));
  const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (compressed.byteLength !== encoded.compressedBytes || await digest(compressed) !== encoded.sha256) fail('Payload checksum mismatch');
  const input = await transform(compressed, true, Math.min(encoded.uncompressedBytes, MAX_UNCOMPRESSED_BYTES));
  if (input.byteLength !== encoded.uncompressedBytes) fail('Payload length mismatch');
  const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input));
  validateCloudPayload(payload, meta);
  return payload;
}
