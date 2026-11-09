import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { looksLikePdf, pdfDataUrlToBytes } from '../src/editors/pdf/pdfBytes';

test('pdfDataUrlToBytes returns the exact bytes of the stored PDF', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  const bytes = await doc.save();
  const dataUrl = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
  const decoded = pdfDataUrlToBytes(dataUrl);
  assert.deepEqual(Buffer.from(decoded), Buffer.from(bytes));
  assert.equal((await PDFDocument.load(decoded)).getPageCount(), 1);
});

test('looksLikePdf accepts a PDF header and rejects images', () => {
  assert.equal(looksLikePdf(new TextEncoder().encode('%PDF-1.7\n')), true);
  assert.equal(looksLikePdf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), false);
});
