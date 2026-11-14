import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFDict, PDFDocument, PDFName, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import {
  addPageNumbers,
  compressPdf,
  deletePages,
  insertBlankPage,
  insertImagePage,
  pageNumberLabel,
  readProperties,
  rotatePages,
  writeProperties,
  cropPdf,
  imagesToPdf,
  isPdfToolError,
  mergePdfs,
  parsePageRanges,
  placeSignature,
  splitPdf,
  stampSignature,
  visualRectToDraw,
  visualSize,
  zipFiles,
} from '../src/editors/pdf/pdfTools';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function makePdf(sizes: [number, number][], rotation = 0, objectStreams = true) {
  const doc = await PDFDocument.create();
  for (const size of sizes) doc.addPage(size).setRotation(degrees(rotation));
  return doc.save({ useObjectStreams: objectStreams });
}

async function pageSizes(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => [page.getWidth(), page.getHeight()]);
}

test('parsePageRanges reads single pages and ranges', () => {
  assert.deepEqual(parsePageRanges('1-2, 3', 3), [
    { label: '1-2', pages: [0, 1] },
    { label: '3', pages: [2] },
  ]);
  assert.deepEqual(parsePageRanges(' 2 – 3 ;', 3), [{ label: '2-3', pages: [1, 2] }]);
});

test('parsePageRanges rejects empty, reversed and out-of-range input', () => {
  for (const input of ['', ' , ', '0', '3-2', '1-4', 'a']) {
    assert.throws(() => parsePageRanges(input, 3), (error) => isPdfToolError(error));
  }
});

test('splitPdf produces one document per range with the original pages', async () => {
  const source = await makePdf([[100, 100], [200, 200], [300, 300]]);
  const parts = await splitPdf(source, parsePageRanges('1-2, 3', 3));
  assert.equal(parts.length, 2);
  assert.deepEqual(await pageSizes(parts[0]), [[100, 100], [200, 200]]);
  assert.deepEqual(await pageSizes(parts[1]), [[300, 300]]);
});

test('mergePdfs appends pages in the given order', async () => {
  const first = await makePdf([[100, 100], [200, 200]]);
  const second = await makePdf([[300, 300]]);
  const merged = await mergePdfs([first, second]);
  assert.equal(merged.pageCount, 3);
  assert.deepEqual(await pageSizes(merged.bytes), [[100, 100], [200, 200], [300, 300]]);
});

test('mergePdfs reports which file is not a PDF', async () => {
  const first = await makePdf([[100, 100]]);
  await assert.rejects(mergePdfs([first, new TextEncoder().encode('not a pdf')]), (error) => isPdfToolError(error) && /Tệp thứ 2/.test(error.message));
});

test('PDF links keep their actual destination after page indices change', async () => {
  const doc = await PDFDocument.create();
  const first = doc.addPage();
  const second = doc.addPage();
  first.drawText('Formatted page', { size: 26 });
  first.setCropBox(12, 20, 400, 500);
  const link = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [10, 10, 80, 30], P: first.ref, Dest: [second.ref, 'Fit'] });
  first.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(link)]));
  const bytes = await doc.save();
  const leading = await makePdf([[200, 300]]);
  const { bytes: merged } = await mergePdfs([leading, bytes], { keepAttributes: true });
  const output = await PDFDocument.load(merged);
  const page = output.getPage(1);
  assert.deepEqual(page.getCropBox(), first.getCropBox());
  const annotation = page.node.Annots()!.lookup(0, PDFDict);
  assert.equal(annotation.get(PDFName.of('P')), page.ref);
  assert.equal(annotation.lookup(PDFName.of('Dest'), PDFArray).get(0), output.getPage(2).ref);
  await assert.rejects(splitPdf(bytes, [{ label: '1', pages: [0] }]), /liên kết/);
});

test('PDF assembly rejects document structures it cannot transfer', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  doc.getForm().createTextField('Customer');
  const bytes = await doc.save();
  await assert.rejects(mergePdfs([bytes, bytes]), /AcroForm/);
  await assert.rejects(splitPdf(bytes, [{ label: '1', pages: [0] }]), /AcroForm/);
  const [whole] = await splitPdf(bytes, [{ label: '1-2', pages: [0, 1] }]);
  assert.deepEqual(whole, bytes);
});

test('compressPdf never reports a saving it did not make', async () => {
  const source = await makePdf(Array.from({ length: 20 }, () => [595, 842] as [number, number]), 0, false);
  const result = await compressPdf(source);
  assert.equal(result.before, source.byteLength);
  assert.equal(result.after, result.bytes.byteLength);
  assert.ok(result.after <= result.before);
  if (result.reduced) assert.ok(result.after < result.before);
  else assert.equal(result.bytes, source);
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 20);
});

test('cropPdf sets the crop box from visual margins', async () => {
  const source = await makePdf([[200, 100]]);
  const { bytes } = await cropPdf(source, { top: 10, right: 0, bottom: 0, left: 20 }, null);
  const box = (await PDFDocument.load(bytes)).getPage(0).getCropBox();
  assert.deepEqual(box, { x: 20, y: 0, width: 180, height: 90 });
});

test('cropPdf maps visual margins onto rotated pages', async () => {
  const source = await makePdf([[200, 100]], 90);
  const { bytes } = await cropPdf(source, { top: 10, right: 0, bottom: 0, left: 0 }, null);
  const box = (await PDFDocument.load(bytes)).getPage(0).getCropBox();
  assert.deepEqual(box, { x: 10, y: 0, width: 190, height: 100 });
});

test('cropPdf only touches the requested pages and rejects bad margins', async () => {
  const source = await makePdf([[200, 200], [200, 200]]);
  const { bytes, pageCount } = await cropPdf(source, { top: 0, right: 50, bottom: 0, left: 0 }, [1]);
  const doc = await PDFDocument.load(bytes);
  assert.equal(pageCount, 1);
  assert.deepEqual(doc.getPage(0).getCropBox(), { x: 0, y: 0, width: 200, height: 200 });
  assert.deepEqual(doc.getPage(1).getCropBox(), { x: 0, y: 0, width: 150, height: 200 });
  await assert.rejects(cropPdf(source, { top: 0, right: 0, bottom: 0, left: 0 }, null), (error) => isPdfToolError(error));
  await assert.rejects(cropPdf(source, { top: 190, right: 0, bottom: 0, left: 0 }, null), (error) => isPdfToolError(error));
});

function toVisual(x: number, y: number, box: { width: number; height: number }, rotation: number) {
  switch (rotation) {
    case 90: return { u: y, v: box.width - x };
    case 180: return { u: box.width - x, v: box.height - y };
    case 270: return { u: box.height - y, v: x };
    default: return { u: x, v: y };
  }
}

test('visualRectToDraw keeps the signature upright inside the visual rectangle', () => {
  const box = { x: 0, y: 0, width: 200, height: 100 };
  for (const rotation of [0, 90, 180, 270]) {
    const visual = visualSize(box, rotation);
    const rect = placeSignature(visual.width, visual.height, 3, 1, 'bottom-right', 0.3);
    const draw = visualRectToDraw(rect, box, rotation);
    const angle = (draw.rotate * Math.PI) / 180;
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    const up = { x: -Math.sin(angle), y: Math.cos(angle) };
    const origin = toVisual(draw.x, draw.y, box, rotation);
    const right = toVisual(draw.x + along.x * draw.width, draw.y + along.y * draw.width, box, rotation);
    const top = toVisual(draw.x + up.x * draw.height, draw.y + up.y * draw.height, box, rotation);
    const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    assert.ok(close(origin.u, rect.u) && close(origin.v, rect.v), `origin at ${rotation}`);
    assert.ok(close(right.u, rect.u + rect.width) && close(right.v, rect.v), `width axis at ${rotation}`);
    assert.ok(close(top.u, rect.u) && close(top.v, rect.v + rect.height), `height axis at ${rotation}`);
    assert.ok(rect.u + rect.width <= visual.width && rect.v >= 0, `inside page at ${rotation}`);
  }
});

test('stampSignature embeds the image on the chosen page', async () => {
  const source = await makePdf([[300, 300], [300, 300]]);
  const signed = await stampSignature(source, PNG_1X1, { pageIndex: 1, anchor: 'bottom-right', widthFraction: 0.3 });
  const doc = await PDFDocument.load(signed);
  assert.equal(doc.getPageCount(), 2);
  assert.ok(Buffer.from(signed).includes('/Subtype /Image'));
  assert.notDeepEqual(Buffer.from(signed), Buffer.from(source));
  await assert.rejects(stampSignature(source, PNG_1X1, { pageIndex: 5, anchor: 'center', widthFraction: 0.3 }), (error) => isPdfToolError(error));
  await assert.rejects(stampSignature(source, new Uint8Array([1, 2, 3]), { pageIndex: 0, anchor: 'center', widthFraction: 0.3 }), (error) => isPdfToolError(error));
});

test('imagesToPdf builds one page per raster at the given size', async () => {
  const bytes = await imagesToPdf([
    { bytes: PNG_1X1, format: 'png', width: 595, height: 842 },
    { bytes: PNG_1X1, format: 'png', width: 842, height: 595 },
  ], null);
  assert.deepEqual(await pageSizes(bytes), [[595, 842], [842, 595]]);
});

test('zipFiles stores every file', async () => {
  const zipped = await zipFiles([{ name: 'a.txt', bytes: 'xin chào' }, { name: 'b.bin', bytes: new Uint8Array([1, 2]) }]);
  const zip = await JSZip.loadAsync(zipped);
  assert.equal(await zip.file('a.txt')?.async('string'), 'xin chào');
  assert.deepEqual([...(await zip.file('b.bin')!.async('uint8array'))], [1, 2]);
});

test('rotatePages turns only the chosen pages and keeps the angle in range', async () => {
  const source = await makePdf([[100, 200], [100, 200]], 270);
  const result = await rotatePages(source, 90, [1]);
  const doc = await PDFDocument.load(result.bytes);
  assert.deepEqual(doc.getPages().map((page) => page.getRotation().angle), [270, 0]);
  await assert.rejects(rotatePages(source, 90, [5]), (error) => isPdfToolError(error));
});

test('deletePages removes the chosen pages and refuses to empty the document', async () => {
  const source = await makePdf([[100, 100], [200, 200], [300, 300]]);
  const result = await deletePages(source, [0, 2]);
  assert.equal(result.removed, 2);
  assert.deepEqual(await pageSizes(result.bytes), [[200, 200]]);
  await assert.rejects(deletePages(source, [0, 1, 2]), (error) => isPdfToolError(error));
});

test('insertBlankPage adds a page after the reference page with its visual size', async () => {
  const source = await makePdf([[100, 200], [300, 400]], 90);
  const result = await insertBlankPage(source, 0);
  assert.equal(result.pageNumber, 2);
  assert.equal(result.pageCount, 3);
  const doc = await PDFDocument.load(result.bytes);
  assert.deepEqual([doc.getPage(1).getWidth(), doc.getPage(1).getHeight()], [200, 100]);
});

test('insertImagePage adds an image page and rejects unreadable images', async () => {
  const source = await makePdf([[300, 300]]);
  const result = await insertImagePage(source, { bytes: PNG_1X1, format: 'png' }, 0);
  assert.equal(result.pageCount, 2);
  assert.equal(result.pageNumber, 2);
  await assert.rejects(insertImagePage(source, { bytes: new Uint8Array([1, 2, 3]), format: 'png' }, 0), (error) => isPdfToolError(error));
});

test('addPageNumbers writes a label on every page', async () => {
  assert.equal(pageNumberLabel(2, 5, 'number'), '2');
  assert.equal(pageNumberLabel(2, 5, 'of-total'), '2 / 5');
  const source = await makePdf([[300, 300], [300, 300]], 90);
  const result = await addPageNumbers(source, 'bottom-center', 'of-total');
  assert.equal(result.pageCount, 2);
  const doc = await PDFDocument.load(result.bytes);
  for (const page of doc.getPages()) assert.ok(page.node.Contents());
});

test('writeProperties stores Vietnamese document properties', async () => {
  const source = await makePdf([[100, 100]]);
  const bytes = await writeProperties(source, { title: 'Biên bản nghiệm thu', author: 'Bùi Đăng Minh', subject: 'Hồ sơ', keywords: 'pdf, biên bản' });
  const properties = await readProperties(bytes);
  assert.equal(properties.title, 'Biên bản nghiệm thu');
  assert.equal(properties.author, 'Bùi Đăng Minh');
  assert.equal(properties.subject, 'Hồ sơ');
  assert.equal(properties.keywords, 'pdf biên bản');
});
