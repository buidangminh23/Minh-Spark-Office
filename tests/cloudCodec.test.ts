import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import { CHUNK_CHARACTERS, LEGACY_MAX_CHUNKS, LEGACY_MAX_COMPRESSED_BYTES, LEGACY_MAX_UNCOMPRESSED_BYTES, MAX_COMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES, ORPHAN_JOURNAL_LIMIT, ORPHAN_MAX_ATTEMPTS, ORPHAN_SAFE_AGE_MS, chunkCountFor, cloudSchemaFor, encodeCloudPayload, decodeCloudPayload, forgetOrphan, manifestOutcome, orphanCandidates, orphanFailed, parseOrphanJournal, recordOrphanSuspect, type OrphanJournal } from '../src/lib/cloudCodec.ts';
import type { FileContent, FileMeta, FileVersion } from '../src/lib/storage.ts';

const metadata = (kind: FileMeta['kind'] = 'doc'): FileMeta => ({ id: 'roundtrip', kind, name: 'Tiếng Việt', createdAt: 1, updatedAt: 2, openedAt: 3, starred: false, deletedAt: null, size: 1, preview: '' });
const document = (text: string): FileContent => ({ kind: 'doc', json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, page: { size: 'A4', orientation: 'portrait', margins: { top: 1, bottom: 1, left: 1, right: 1 }, header: '', footer: '', pageNumbers: true } });

test('syncs imported DOCX HTML before editor save and preserves imported version history', async () => {
  const message = 'Office 23 desktop verification. Local document save and export.';
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph(message)] }] }));
  const { value: html } = await mammoth.convertToHtml({ buffer });
  assert.equal(html, `<p>${message}</p>`);
  const imported = { ...document(''), json: html } as unknown as FileContent;
  const versions: FileVersion[] = [{ id: 'imported-version', fileId: 'roundtrip', label: 'Imported document', timestamp: 1, content: imported }];
  const encoded = await encodeCloudPayload(imported, [], metadata());
  assert.deepEqual(await decodeCloudPayload(encoded, metadata()), { content: imported, versions: [] });
  const edited = document(`${message} Edited.`);
  const saved = await encodeCloudPayload(edited, versions, metadata());
  assert.deepEqual(await decodeCloudPayload(saved, metadata()), { content: edited, versions });
});

test('document string compatibility retains representation, page and size validation', async () => {
  for (const json of [null, true, 42, [], {}, { type: 'paragraph' }, { type: 'doc', content: 'invalid' }]) {
    await assert.rejects(encodeCloudPayload({ ...document(''), json } as unknown as FileContent, [], metadata()), /Invalid document/);
  }
  const invalidPage = { ...document(''), json: '<p>Imported</p>', page: { size: 'A4', orientation: 'portrait', margins: { top: -1, right: 1, bottom: 1, left: 1 } } };
  await assert.rejects(encodeCloudPayload(invalidPage as unknown as FileContent, [], metadata()), /Invalid page margins/);
  await assert.rejects(encodeCloudPayload({ ...document(''), json: 'x'.repeat(5000) } as unknown as FileContent, [], metadata(), { uncompressed: 4000, compressed: MAX_COMPRESSED_BYTES }), /payload-too-large/);
});

test('round trips document, workbook and PDF payloads with version history and Vietnamese text', async () => {
  const contents: FileContent[] = [document('Tài liệu có dấu và ký hiệu 📄'), { kind: 'sheet', workbook: { id: 'wb', name: 'Bảng tính', appVersion: '1', locale: 'vi', styles: {}, sheets: {}, sheetOrder: [] } }, { kind: 'pdf', pdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=', pageCount: 1 }, { kind: 'image', imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=', mimeType: 'image/png' }];
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
  await assert.rejects(encodeCloudPayload(document('x'.repeat(5000)), [], metadata(), { uncompressed: 4000, compressed: MAX_COMPRESSED_BYTES }), /payload-too-large/);
  await assert.rejects(encodeCloudPayload(document(randomBytes(200000).toString('base64')), [], metadata(), { uncompressed: MAX_UNCOMPRESSED_BYTES, compressed: 100000 }), /payload-too-large/);
});

test('syncs content far beyond the former 6 MiB compressed ceiling', async () => {
  const content = document(randomBytes(LEGACY_MAX_COMPRESSED_BYTES + 2 * 1024 * 1024).toString('base64'));
  const encoded = await encodeCloudPayload(content, [], metadata());
  assert.ok(encoded.compressedBytes > LEGACY_MAX_COMPRESSED_BYTES);
  assert.ok(encoded.chunks.length > LEGACY_MAX_CHUNKS);
  assert.equal(encoded.chunks.length, chunkCountFor(encoded.compressedBytes));
  assert.ok(encoded.chunks.slice(0, -1).every((chunk) => chunk.length === CHUNK_CHARACTERS));
  assert.deepEqual((await decodeCloudPayload(encoded, metadata())).content, content);
});

test('bounds decompression by declared size even when the compressed checksum is valid', async () => {
  const compressed = gzipSync('x'.repeat(100000));
  await assert.rejects(decodeCloudPayload({ chunks: [compressed.toString('base64')], compressedBytes: compressed.length, uncompressedBytes: 100, sha256: createHash('sha256').update(compressed).digest('hex') }, metadata()), /payload-too-large/);
});

test('writes the legacy schema whenever the payload fits older app limits', async () => {
  const small = await encodeCloudPayload(document('small'), [], metadata());
  assert.equal(cloudSchemaFor(small), 1);
  assert.equal(cloudSchemaFor({ chunks: [], compressedBytes: 0, uncompressedBytes: 0 }), 1);
  assert.equal(cloudSchemaFor({ chunks: new Array(LEGACY_MAX_CHUNKS).fill(''), compressedBytes: LEGACY_MAX_COMPRESSED_BYTES, uncompressedBytes: LEGACY_MAX_UNCOMPRESSED_BYTES }), 1);
  assert.equal(cloudSchemaFor({ chunks: new Array(LEGACY_MAX_CHUNKS + 1).fill(''), compressedBytes: LEGACY_MAX_COMPRESSED_BYTES, uncompressedBytes: 1 }), 2);
  assert.equal(cloudSchemaFor({ chunks: [''], compressedBytes: LEGACY_MAX_COMPRESSED_BYTES + 1, uncompressedBytes: 1 }), 2);
  assert.equal(cloudSchemaFor({ chunks: [''], compressedBytes: 1, uncompressedBytes: LEGACY_MAX_UNCOMPRESSED_BYTES + 1 }), 2);
  const large = await encodeCloudPayload(document(randomBytes(LEGACY_MAX_COMPRESSED_BYTES + 1024 * 1024).toString('base64')), [], metadata());
  assert.equal(cloudSchemaFor(large), 2);
});

test('a retried manifest transaction that finds its own revision is a success, not a conflict', () => {
  const own = randomUUID();
  const base = randomUUID();
  assert.equal(manifestOutcome(own, base, own), 'committed');
  assert.equal(manifestOutcome(own, null, own), 'committed');
  assert.equal(manifestOutcome(base, base, own), 'commit');
  assert.equal(manifestOutcome(null, null, own), 'commit');
  assert.equal(manifestOutcome(randomUUID(), base, own), 'conflict');
  assert.equal(manifestOutcome(null, base, own), 'conflict');
  assert.equal(manifestOutcome(base, null, own), 'conflict');
});

test('the orphan journal only releases old, idle revisions and stays bounded', () => {
  const [first, second, third] = [randomUUID(), randomUUID(), randomUUID()];
  let journal = recordOrphanSuspect({}, first, 'file-a', 3, 1000);
  journal = recordOrphanSuspect(journal, second, 'file-b', 600, 2000);
  journal = recordOrphanSuspect(journal, first, 'file-a', 2, 5000);
  assert.deepEqual(journal[first], { fileId: 'file-a', chunkCount: 3, since: 1000, attempts: 0 });
  assert.deepEqual(orphanCandidates(journal, 1000 + ORPHAN_SAFE_AGE_MS - 1, new Set(), 10), []);
  assert.deepEqual(orphanCandidates(journal, 2000 + ORPHAN_SAFE_AGE_MS, new Set(), 10).map(([revision]) => revision), [first, second]);
  assert.deepEqual(orphanCandidates(journal, 2000 + ORPHAN_SAFE_AGE_MS, new Set([first]), 10).map(([revision]) => revision), [second]);
  assert.deepEqual(orphanCandidates(journal, 2000 + ORPHAN_SAFE_AGE_MS, new Set(), 1).map(([revision]) => revision), [first]);
  journal = recordOrphanSuspect(journal, third, 'file-c', 1, 3000);
  journal = forgetOrphan(journal, second);
  assert.deepEqual(Object.keys(journal).sort(), [first, third].sort());
  for (let attempt = 1; attempt < ORPHAN_MAX_ATTEMPTS; attempt++) journal = orphanFailed(journal, third);
  assert.equal(journal[third].attempts, ORPHAN_MAX_ATTEMPTS - 1);
  journal = orphanFailed(journal, third);
  assert.equal(third in journal, false);
  let full: OrphanJournal = {};
  for (let index = 0; index < ORPHAN_JOURNAL_LIMIT + 5; index++) full = recordOrphanSuspect(full, randomUUID(), 'bulk', 1, index);
  assert.equal(Object.keys(full).length, ORPHAN_JOURNAL_LIMIT);
  assert.equal(Math.min(...Object.values(full).map((entry) => entry.since)), 5);
  assert.deepEqual(parseOrphanJournal({ [first]: { fileId: 'x', chunkCount: 1, since: 1, attempts: 0 }, 'not-a-uuid': { fileId: 'y', chunkCount: 1, since: 1, attempts: 0 }, [second]: { fileId: 'z', chunkCount: 'many', since: 1, attempts: 0 } }), { [first]: { fileId: 'x', chunkCount: 1, since: 1, attempts: 0 } });
  assert.deepEqual(parseOrphanJournal('garbage'), {});
});
