import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { CHUNK_CHARACTERS, MAX_COMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES, encodeCloudPayload, decodeCloudPayload } from '../src/lib/cloudCodec.ts';
import type { FileContent, FileMeta, FileVersion } from '../src/lib/storage.ts';

const metadata = (kind: FileMeta['kind'] = 'doc'): FileMeta => ({ id: 'roundtrip', kind, name: 'Tiếng Việt', createdAt: 1, updatedAt: 2, openedAt: 3, starred: false, deletedAt: null, size: 1, preview: '' });
const document = (text: string): FileContent => ({ kind: 'doc', json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, page: { size: 'A4', orientation: 'portrait', margins: { top: 1, bottom: 1, left: 1, right: 1 }, header: '', footer: '', pageNumbers: true } });

test('round trips document, workbook and PDF payloads with version history and Vietnamese text', async () => {
  const contents: FileContent[] = [document('Tài liệu có dấu và ký hiệu 📄'), { kind: 'sheet', workbook: { id: 'wb', name: 'Bảng tính', appVersion: '1', locale: 'vi', styles: {}, sheets: {}, sheetOrder: [] } }, { kind: 'pdf', pdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=', pageCount: 1 }];
  for (const content of contents) {
    const meta = metadata(content.kind);
    const versions: FileVersion[] = [{ id: 'v1', fileId: meta.id, label: 'Bản trước', timestamp: 1, content }];
    const encoded = await encodeCloudPayload(content, versions, meta);
    assert.deepEqual(await decodeCloudPayload(encoded, meta), { content, versions });
  }
});

test('chunks incompressible content and verifies complete reassembly', async () => {
  const content = document(randomBytes(1000000).toString('base64'));
  const encoded = await encodeCloudPayload(content, [], metadata());
  assert.ok(encoded.chunks.length >= 3);
  assert.ok(encoded.chunks.every((chunk) => chunk.length <= CHUNK_CHARACTERS));
  assert.deepEqual((await decodeCloudPayload(encoded, metadata())).content, content);
});

test('rejects corrupt, missing, reordered and inconsistent chunks before accepting document data', async () => {
  const encoded = await encodeCloudPayload(document(randomBytes(800000).toString('base64')), [], metadata());
  await assert.rejects(decodeCloudPayload({ ...encoded, sha256: '0'.repeat(64) }, metadata()), /checksum/);
  await assert.rejects(decodeCloudPayload({ ...encoded, chunks: encoded.chunks.slice(1) }, metadata()), /chunk/);
  await assert.rejects(decodeCloudPayload({ ...encoded, chunks: [encoded.chunks[0].slice(4), ...encoded.chunks.slice(1)] }, metadata()), /chunk/);
  await assert.rejects(decodeCloudPayload({ ...encoded, compressedBytes: encoded.compressedBytes - 1 }, metadata()), /chunk|checksum/);
  await assert.rejects(decodeCloudPayload({ ...encoded, uncompressedBytes: encoded.uncompressedBytes + 1 }, metadata()), /length/);
});

test('rejects mismatched kinds, foreign version IDs and malformed metadata', async () => {
  const content = document('test');
  await assert.rejects(encodeCloudPayload(content, [], metadata('pdf')), /kind/);
  await assert.rejects(encodeCloudPayload(content, [{ id: 'v', fileId: 'another-file', label: '', timestamp: 1, content }], metadata()), /version/);
  await assert.rejects(encodeCloudPayload(content, [], { ...metadata(), updatedAt: Infinity }), /metadata/);
  await assert.rejects(encodeCloudPayload(content, [], { ...metadata(), id: '../other' }), /identifier/);
  await assert.rejects(encodeCloudPayload(content, [], { ...metadata(), unexpected: true } as FileMeta), /fields/);
  const version = { id: 'v', fileId: 'roundtrip', label: '', timestamp: 1, content };
  await assert.rejects(encodeCloudPayload(content, [version, version], metadata()), /Duplicate/);
});

test('enforces uncompressed and compressed limits without silently truncating', async () => {
  await assert.rejects(encodeCloudPayload(document('x'.repeat(MAX_UNCOMPRESSED_BYTES)), [], metadata()), /payload-too-large/);
  await assert.rejects(encodeCloudPayload(document(randomBytes(MAX_COMPRESSED_BYTES + 100000).toString('base64')), [], metadata()), /payload-too-large/);
});

test('bounds decompression by declared size even when the compressed checksum is valid', async () => {
  const compressed = gzipSync('x'.repeat(100000));
  await assert.rejects(decodeCloudPayload({ chunks: [compressed.toString('base64')], compressedBytes: compressed.length, uncompressedBytes: 100, sha256: createHash('sha256').update(compressed).digest('hex') }, metadata()), /payload-too-large/);
});
