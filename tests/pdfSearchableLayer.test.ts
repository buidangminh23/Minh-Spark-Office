import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PDFDocument, degrees } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { addSearchableLayer } from '../src/lib/pdfSearchableLayer';
import { cleanPdfText } from '../src/lib/conversionTypes';
import { fontMetrics } from '../src/lib/slideTextPaint';
import { isReliableOcrLine } from '../src/lib/pdfEditableOcr';

const font = () => readFile(new URL('../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf', import.meta.url)).then((bytes) => new Uint8Array(bytes));

async function textItems(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.flatMap((item) => 'str' in item && item.str.trim() ? [{ text: item.str, at: viewport.convertToViewportPoint(item.transform[4], item.transform[5]) }] : []);
  const operators = await page.getOperatorList();
  await task.destroy();
  return { items, viewport: viewport.transform as number[], operators: operators.fnArray.length };
}

test('scanned pages keep their content and gain a hidden text layer at the recognised position', async () => {
  const source = await PDFDocument.create();
  source.addPage([400, 300]).drawRectangle({ x: 20, y: 20, width: 100, height: 50 });
  const original = await source.save();
  const before = await textItems(original);
  const bytes = await addSearchableLayer(original, [{ pageIndex: 0, transform: before.viewport, lines: [{ text: 'Biên bản\u0000 khối lượng', x: 50, y: 100, width: 160, height: 20 }] }], font);
  const after = await textItems(bytes);
  assert.equal(after.items.length, 1);
  assert.equal(after.items[0].text, 'Biên bản khối lượng');
  assert.ok(Math.abs(after.items[0].at[0] - 50) < 0.5);
  assert.ok(Math.abs(after.items[0].at[1] - 116) < 0.5);
  assert.equal(after.operators > before.operators, true);
  assert.doesNotMatch(Buffer.from(bytes).toString('latin1'), /OfficeOcrBackground/);
});

test('the hidden layer follows rotated pages', async () => {
  const source = await PDFDocument.create();
  source.addPage([400, 300]).setRotation(degrees(90));
  const original = await source.save();
  const before = await textItems(original);
  const bytes = await addSearchableLayer(original, [{ pageIndex: 0, transform: before.viewport, lines: [{ text: 'Trang xoay', x: 40, y: 60, width: 90, height: 18 }] }], font);
  const after = await textItems(bytes);
  assert.ok(Math.abs(after.items[0].at[0] - 40) < 0.5);
  assert.ok(Math.abs(after.items[0].at[1] - (60 + 18 * 0.8)) < 0.5);
});

test('control characters never reach converted documents', () => {
  assert.equal(cleanPdfText('BMPW13KF\u00000009\u001F\tA\nB'), 'BMPW13KF0009\tA\nB');
});

test('font size follows the real glyph extents of accented capitals', () => {
  const plain = fontMetrics('CONG HOA', 72);
  const accented = fontMetrics('CỘNG HOÀ', 122);
  assert.ok(Math.abs(plain.fontPx - accented.fontPx) < 6);
  const measured = fontMetrics('CỘNG HOÀ', 120, { ascent: 1, descent: 0.2 });
  assert.equal(measured.fontPx, 100);
  assert.ok(Math.abs(measured.capOffset + 9.5) < 1e-9);
});

test('uncertain OCR words are not redrawn', () => {
  assert.equal(isReliableOcrLine({ text: 'Hợp đồng' }), true);
  assert.equal(isReliableOcrLine({ text: 'ses', confidence: 31 }), false);
  assert.equal(isReliableOcrLine({ text: '1', confidence: 70 }), false);
  assert.equal(isReliableOcrLine({ text: '14:15', confidence: 92 }), true);
  assert.equal(isReliableOcrLine({ text: '—', confidence: 99 }), false);
});
