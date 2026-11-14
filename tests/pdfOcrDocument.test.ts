import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream, degrees } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildEditablePdf, readEditablePdfPages, updateEditablePdfText, type PdfOcrFontLoader } from '../src/lib/pdfOcrDocument';
import type { EditablePdfPageInput } from '../src/lib/pdfOcrTypes';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const fontLoader: PdfOcrFontLoader = (family, bold) => readFile(new URL(`../node_modules/dejavu-fonts-ttf/ttf/DejaVu${family === 'serif' ? 'Serif' : 'Sans'}${bold ? '-Bold' : ''}.ttf`, import.meta.url));
const input = (): EditablePdfPageInput => ({
  pageIndex: 0, width: 595, height: 842, background: png,
  lines: [
    { id: 'heading', text: 'BIÊN BẢN NGHIỆM THU', x: 72, y: 50, width: 300, height: 24, fontSize: 18, fontFamily: 'serif', bold: true, color: [0.1, 0.2, 0.3] },
    { id: 'amount', text: 'Khối lượng: 45,75 m3', x: 72, y: 100, width: 240, height: 18, fontSize: 14, fontFamily: 'sans', bold: false, color: [0, 0, 0] },
  ],
});

async function extract(bytes: Uint8Array): Promise<string[]> {
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const doc = await loading.promise;
  try {
    const texts: string[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      texts.push((await page.getTextContent()).items.map((item) => 'str' in item ? item.str : '').join(' '));
    }
    return texts;
  } finally { await loading.destroy(); }
}

async function streamText(bytes: Uint8Array, index = 0): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(index).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];
  return streams.map((stream) => stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString() : '').join('\n');
}

test('OCR PDF embeds real visible Vietnamese text and editable metadata', async () => {
  const bytes = await buildEditablePdf(undefined, [input()], fontLoader);
  const text = (await extract(bytes))[0];
  assert.match(text, /BIÊN BẢN NGHIỆM THU/);
  assert.match(text, /Khối lượng: 45,75 m3/);
  const stream = await streamText(bytes);
  assert.match(stream, /0 Tr/);
  assert.doesNotMatch(stream, /3 Tr/);
  assert.match(stream, /OfficeOcrBackground/);
  assert.deepEqual(await readEditablePdfPages(bytes), [{ pageIndex: 0, width: 595, height: 842, lines: input().lines }]);
});

test('editing after reopening replaces old text and preserves neighboring blocks', async () => {
  const original = await buildEditablePdf(undefined, [input()], fontLoader);
  const updated = await updateEditablePdfText(original, 0, 'amount', 'Khối lượng: 99,25 m3', fontLoader);
  const text = (await extract(updated))[0];
  assert.match(text, /Khối lượng: 99,25 m3/);
  assert.doesNotMatch(text, /45,75/);
  assert.match(text, /BIÊN BẢN NGHIỆM THU/);
  const pages = await readEditablePdfPages(updated);
  assert.deepEqual(pages[0].lines[0], input().lines[0]);
  assert.deepEqual({ ...pages[0].lines[1], text: input().lines[1].text }, input().lines[1]);
  const cleared = await updateEditablePdfText(updated, 0, 'amount', '', fontLoader);
  assert.doesNotMatch((await extract(cleared))[0], /99,25/);
});

test('reconstruction keeps unprocessed pages and normalizes processed crop and rotation', async () => {
  const source = await PDFDocument.create();
  source.setTitle('Original source');
  const first = source.addPage([842, 595]);
  first.setRotation(degrees(90));
  first.setCropBox(10, 20, 800, 500);
  first.drawText('Old scan layer');
  source.addPage([300, 400]).drawText('Native page 12345');
  const sourceBytes = await source.save();
  const bytes = await buildEditablePdf(sourceBytes.buffer as ArrayBuffer, [input()], fontLoader);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), 'Original source');
  assert.deepEqual(doc.getPage(0).getCropBox(), { x: 0, y: 0, width: 595, height: 842 });
  assert.equal(doc.getPage(0).getRotation().angle, 0);
  const text = await extract(bytes);
  assert.doesNotMatch(text[0], /Old scan layer/);
  assert.equal(text[1], 'Native page 12345');
  assert.equal(await streamText(bytes, 1), await streamText(sourceBytes, 1));
});

test('editable page metadata follows the page through copying and reordering', async () => {
  const source = await PDFDocument.load(await buildEditablePdf(undefined, [input()], fontLoader));
  const copied = await PDFDocument.create();
  copied.addPage();
  copied.addPage((await copied.copyPages(source, [0]))[0]);
  const bytes = await copied.save();
  const pages = await readEditablePdfPages(bytes);
  assert.equal(pages[0].pageIndex, 1);
  const updated = await updateEditablePdfText(bytes, 1, 'amount', 'Đã sửa sau khi ghép', fontLoader);
  assert.match((await extract(updated))[1], /Đã sửa sau khi ghép/);
});

test('longer replacements fit their existing block and shorter edits keep their scale', async () => {
  const bytes = await buildEditablePdf(undefined, [input()], fontLoader);
  const originalScales = (await streamText(bytes)).match(/[\d.]+ Tz/g)!;
  const shorter = await updateEditablePdfText(bytes, 0, 'amount', '10 m3', fontLoader);
  assert.deepEqual((await streamText(shorter)).match(/[\d.]+ Tz/g), originalScales);
  const longText = 'Khối lượng bổ sung đã được kiểm tra và nghiệm thu đầy đủ: 100,25 m3';
  const longer = await updateEditablePdfText(bytes, 0, 'amount', longText, fontLoader);
  assert.ok(Number((await streamText(longer)).match(/[\d.]+ Tz/g)![1].split(' ')[0]) < Number(originalScales[1].split(' ')[0]));
  assert.match((await extract(longer))[0], /100,25 m3/);
  const restored = await updateEditablePdfText(longer, 0, 'amount', input().lines[1].text, fontLoader);
  assert.deepEqual((await streamText(restored)).match(/[\d.]+ Tz/g), originalScales);
});

test('malformed metadata cannot activate editable blocks or overwrite arbitrary pages', async () => {
  const bytes = await buildEditablePdf(undefined, [input()], fontLoader);
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const key = PDFName.of('OfficeOcrV1');
  const meta = JSON.parse((page.node.get(key) as PDFHexString).decodeText());
  meta.lines[0].width = 1e20;
  page.node.set(key, PDFHexString.fromText(JSON.stringify(meta)));
  const invalid = await doc.save();
  assert.deepEqual(await readEditablePdfPages(invalid), []);
  await assert.rejects(updateEditablePdfText(invalid, 0, 'heading', 'Changed', fontLoader), /không hợp lệ/);
  await assert.rejects(updateEditablePdfText(bytes, 99, 'heading', 'Changed', fontLoader), /không hợp lệ/);
  await assert.rejects(updateEditablePdfText(bytes, 0, 'missing', 'Changed', fontLoader), /Không tìm thấy/);
  await assert.rejects(updateEditablePdfText(bytes, 0, 'heading', 'a'.repeat(10_001), fontLoader), /không hợp lệ/);
  await assert.rejects(updateEditablePdfText(bytes, 0, 'heading', 'line\nbreak', fontLoader), /không hợp lệ/);
});

test('creation rejects duplicate block IDs, invalid geometry and duplicate page indices', async () => {
  const duplicate = input();
  duplicate.lines[1].id = duplicate.lines[0].id;
  await assert.rejects(buildEditablePdf(undefined, [duplicate], fontLoader), /không hợp lệ/);
  const invalid = input();
  invalid.lines[0].x = -1;
  await assert.rejects(buildEditablePdf(undefined, [invalid], fontLoader), /không hợp lệ/);
  await assert.rejects(buildEditablePdf(undefined, [input(), input()], fontLoader), /không hợp lệ/);
});

test('page changes after OCR cannot be silently overwritten by a later text edit', async () => {
  const bytes = await buildEditablePdf(undefined, [input()], fontLoader);
  for (const change of ['crop', 'rotate', 'content']) {
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    if (change === 'crop') page.setCropBox(10, 10, 500, 700);
    else if (change === 'rotate') page.setRotation(degrees(90));
    else page.drawText('Added signature');
    const modified = await doc.save();
    assert.deepEqual(await readEditablePdfPages(modified), [], change);
    await assert.rejects(updateEditablePdfText(modified, 0, 'amount', 'Replaced', fontLoader), /nhận dạng lại/i);
  }
});
