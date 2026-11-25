import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRealUnsavedChanges, sameContent } from '../src/lib/unsavedChanges';
import type { FileContent, FileMeta } from '../src/lib/storage';

const meta = { id: 'pdf-1', kind: 'pdf', name: 'a.pdf', updatedAt: 1_000 } as unknown as FileMeta;
const saved = { kind: 'pdf', pdfDataUrl: 'data:application/pdf;base64,AAAA' } as unknown as FileContent;

test('an unsaved copy identical to the saved file is not a real change', () => {
  const copy = { meta, content: structuredClone(saved), at: 2_000 };
  assert.equal(hasRealUnsavedChanges(copy, meta, saved), false);
});

test('a newer copy with different content is a real change', () => {
  const copy = { meta, content: { ...saved, pdfDataUrl: 'data:application/pdf;base64,BBBB' } as unknown as FileContent, at: 2_000 };
  assert.equal(hasRealUnsavedChanges(copy, meta, saved), true);
});

test('an older copy is never offered, even when it differs', () => {
  const copy = { meta, content: { ...saved, pdfDataUrl: 'x' } as unknown as FileContent, at: 500 };
  assert.equal(hasRealUnsavedChanges(copy, meta, saved), false);
});

test('sameContent compares nested data and binary bytes, and treats unknown objects as different', () => {
  assert.equal(sameContent({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] }), true);
  assert.equal(sameContent({ a: [1, 2] }, { a: [1, 3] }), false);
  assert.equal(sameContent({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(sameContent(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(sameContent(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(sameContent(new Uint8Array([1, 2]).buffer, new Uint8Array([1, 2]).buffer), true);
  assert.equal(sameContent(new Map([[1, 2]]), new Map([[1, 3]])), false);
  assert.equal(sameContent(new Date(0), new Date(0)), false);
});
