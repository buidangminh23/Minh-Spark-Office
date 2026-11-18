import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildMediaLayoutResult, buildMediaTextResult, convertMediaFile, mediaConversionTargets, mediaTextRows, mediaTextTable, readPdfLines, type MediaPage } from '../src/lib/mediaConversion';
import { includeWidgetValues } from '../src/lib/mediaPageLayout';

test('text runs painted with separate fallback fonts fill spacing adjustments in reading order', async () => {
  const { StandardFonts, beginText, endText, setTextMatrix, setFontAndSize, PDFOperator, PDFOperatorNames } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([250, 200]);
  const primary = await pdf.embedFont(StandardFonts.Helvetica);
  const fallback = await pdf.embedFont(StandardFonts.TimesRoman);
  const key = page.node.newFontDictionary(primary.name, primary.ref);
  const size = 12;
  const gap = fallback.widthOfTextAtSize('é', 1000);
  const parts = ['Donn', 'es caf', ' noir'];
  const adjustment = pdf.context.obj([primary.encodeText(parts[0]), -gap, primary.encodeText(parts[1]), -gap, primary.encodeText(parts[2])]);
  page.pushOperators(beginText(), setTextMatrix(1, 0, 0, 1, 20, 100), setFontAndSize(key, size), PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [adjustment]), endText());
  const x = 20 + primary.widthOfTextAtSize(parts[0], size);
  page.drawText('é', { font: fallback, x, y: 100, size });
  page.drawText('é', { font: fallback, x: x + gap * size / 1000 + primary.widthOfTextAtSize(parts[1], size), y: 100, size });
  const task = getDocument({ data: await pdf.save() });
  try {
    const result = await readPdfLines(await task.promise, 1);
    assert.deepEqual(mediaTextTable(result.lines), [['Données café noir']]);
  } finally { await task.destroy(); }
});

const line = (text: string, x: number, y: number, width = 40) => ({ text, x, y, width, height: 12 });
const sample: MediaPage = { width: 595, height: 842, lines: [line('Họ tên', 20, 20), line('Số tiền', 200, 20), line('Nguyễn Văn A', 20, 40, 90), line('1.234.567', 200, 40, 80)] };
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });

test('local codecs retain two distinct pages of HEIF and LZW TIFF', async () => {
  const { decodeImageFrames } = await import('../src/lib/mediaConversionFrames');
  const cases = {
    heif: 'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAdNtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAADRpbG9jAAAAAERAAAIAAQAAAAAB9wABAAAAAAAAADcAAgAAAAACLgABAAAAAAAAADcAAAA4aWluZgAAAAAAAgAAABVpbmZlAgAAAAABAABodmMxAAAAABVpbmZlAgAAAAACAABodmMxAAAAAA5waXRtAAAAAAABAAABLGlwcnAAAAEEaXBjbwAAAHVodmNDAQNwAAAAkAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAKAAAAAEAAAAYAAAAAf///+gAAAAC////2AAAAAIAAAAQcGl4aQAAAAADCAgIAAAAKGNsYXAAAAAcAAAAAQAAACYAAAAB////3AAAAAL////mAAAAAgAAACBpcG1hAAAAAAAAAAIAAQWBAgMFhAACBYECAwWGAAAAdm1kYXQAAAAzKAGvBrIWhzSSAnP+uM///+AYfof3rWgFrA2X2/pmxOSy2oEc+mHzGDqWJxojcK3AnLvAAAAAMygBrwayFoc0kgJz/1aX/3v9FFf//RxQBawNl9v6ZsTkstqBHPph8xg6licaI3CtwJy7wA==',
    tiff: 'SUkqAJ4AAACAP8AACBQSBwWEQeFQaGQmGwuHRGIROHxWJRaKReNRmORiPRuPx2QSORSWQyeSSiTSmWSuXSqYS2Yy+ZTWaTeZzmbTqcTufT2gTyhT+h0GiUejUmi0ukUylU2oU+pU6qVGq1OrVmsVur12tV6uV+xWGyWCzWOz2W0Wu1W202+2XC3XG6XO7XK8XW83e9X2+X+94G9QEAAKAAABAwABAAAAKAAAAAEBAwABAAAAGAAAAAIBAwADAAAAHAEAAAMBAwABAAAABQAAAAYBAwABAAAAAgAAABEBBAABAAAACAAAABUBAwABAAAAAwAAABYBAwABAAAAGAAAABcBBAABAAAAlQAAABwBAwABAAAAAQAAANYBAAAIAAgACAAAAAAAAAAAAAAAAAAAAElJKgCmAAAAgAAAD/gUEgcFhEHhUGhkJhsLh0RiETh8ViUWikXjUZjkYj0bj8dkEjkUlkMnkkok0plkrl0qmEtmMvmU1mk3mc5m06nE7n09oE8oU/odBolHo1JotLpFMpVNqFPqVOqlRqtTq1ZrFbq9drVerlfsVhslgs1js9ltFrtVttNvtlwt1xulzu1yvF1vN3vV9vl/veBv2CwGDw2FxF4gIAAKAAABAwABAAAAHAAAAAEBAwABAAAAJgAAAAIBAwADAAAAVAIAAAMBAwABAAAABQAAAAYBAwABAAAAAgAAABEBBAABAAAAOAEAABUBAwABAAAAAwAAABYBAwABAAAAJgAAABcBBAABAAAAnQAAABwBAwABAAAAAQAAAAAAAAAIAAgACAAAAAAAAAA=',
  };
  for (const format of ['heif', 'tiff'] as const) {
    const bytes = Uint8Array.from(Buffer.from(cases[format], 'base64'));
    const frames = await Array.fromAsync(decodeImageFrames(bytes.buffer, format));
    assert.deepEqual(frames.map(({ width, height }) => [width, height]), [[40, 24], [28, 38]]);
    assert.ok(frames[0].data[0] > 230 && frames[0].data[2] < 25);
    assert.ok(frames[1].data[0] < 25 && frames[1].data[2] > 230);
  }
});

test('TIFF packing preserves the dimensions, order and alpha bytes of every frame', async () => {
  const { encodeTiff, joinEncodedTiffPages } = await import('../src/lib/mediaConversionRaster');
  const { decodeImageFrames } = await import('../src/lib/mediaConversionFrames');
  const page = (width: number, rgba: number[]) => ({ width, height: 1, data: Uint8ClampedArray.from(rgba) }) as ImageData;
  const first = page(1, [200, 40, 20, 130]);
  const last = page(2, [10, 80, 20, 255, 20, 70, 10, 0]);
  const image = await joinEncodedTiffPages(await Promise.all([first, last].map(encodeTiff)));
  const frames = await Array.fromAsync(decodeImageFrames(await image.arrayBuffer(), 'tiff'));
  assert.deepEqual(frames.map((f) => [...f.data]), [[...first.data], [...last.data]]);
});

test('UTIF browser loader can inflate a TIFF created by the converter without CommonJS', async () => {
  const { createRequire } = await import('node:module');
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { encodeTiff } = await import('../src/lib/mediaConversionRaster');
  const { decodeImageFrames } = await import('../src/lib/mediaConversionFrames');
  const image = { width: 32, height: 16, data: new Uint8ClampedArray(2048).fill(120) } as ImageData;
  const buffer = await (await encodeTiff(image)).arrayBuffer();
  await Array.fromAsync(decodeImageFrames(buffer, 'tiff'));
  const self = { pako: Reflect.get(globalThis, 'pako') } as { pako: unknown; UTIF: typeof import('utif') };
  const browserSource = await readFile(createRequire(import.meta.url).resolve('utif'), 'utf8');
  runInNewContext(browserSource, { self, console });
  const [page] = self.UTIF.decode(buffer);
  self.UTIF.decodeImage(buffer, page);
  assert.deepEqual(Array.from(self.UTIF.toRGBA8(page)), Array.from(image.data));
});

test('tabular page exports retain delimiters, blank pages and leading zeros', async () => {
  const pages = [{ ...sample, lines: [line('01,02', 20, 20), line('Nhóm "A"', 200, 20)] }, { ...sample, lines: [] }];
  const result = await buildMediaTextResult(pages, 'csv', 'Sổ');
  assert.deepEqual(result.files.map((file) => file.name), ['Sổ - trang 001.csv', 'Sổ - trang 002.csv']);
  assert.equal(await result.files[0].blob.text(), '"01,02","Nhóm ""A"""\r\n');
  const json = await buildMediaTextResult(pages, 'json', 'Sổ');
  assert.deepEqual(JSON.parse(await json.files[0].blob.text()), [['01,02', 'Nhóm "A"']]);
  assert.deepEqual(JSON.parse(await json.files[1].blob.text()), []);
});

test('media target matrix includes OCR editable outputs and rejects unsupported sources', () => {
  for (const name of ['scan.PDF', 'image.png', 'image.heic', 'image.tif', 'image.svgz', 'image.dib']) {
    assert.deepEqual(mediaConversionTargets(name).map((format) => format.id), ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'html', 'csv', 'tsv', 'json', 'png', 'jpg', 'jfif', 'webp', 'bmp', 'tiff', 'gif', 'ico', 'avif', 'svg', 'svgz', 'dib', 'heic', 'heif']);
  }
  assert.deepEqual(mediaConversionTargets('file.exe'), []);
});

test('positioned text joins words and keeps blank table cells aligned', () => {
  const lines = [line('A', 20, 20, 10), line('B', 35, 20, 10), line('Amount', 200, 20), line('123', 200, 40)];
  assert.deepEqual(mediaTextRows(lines), [['A B', 'Amount'], ['123']]);
  assert.deepEqual(mediaTextTable(lines), [['A B', 'Amount'], ['', '123']]);
});

test('text conversion keeps Vietnamese and escapes active HTML', async () => {
  const pages = [sample, { ...sample, lines: [line('<script>alert(1)</script>', 20, 20)] }];
  const text = await buildMediaTextResult(pages, 'txt', 'Sample');
  assert.match(await text.files[0].blob.text(), /Nguyễn Văn A\t1\.234\.567/);
  const html = await buildMediaTextResult(pages, 'html', '<img onerror=alert(1)>');
  const source = await html.files[0].blob.text();
  assert.doesNotMatch(source, /<script>|<img/);
  assert.match(source, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('PDF text to XLSX creates real sheets and preserves values as strings', async () => {
  const result = await buildMediaTextResult([sample, { ...sample, lines: [line('=HYPERLINK("bad")', 20, 20)] }], 'xlsx', 'Data');
  const workbook = XLSX.read(await result.files[0].blob.arrayBuffer(), { type: 'array' });
  assert.equal(workbook.SheetNames.length, 2);
  assert.equal(workbook.Sheets['Trang 1'].A2.v, 'Nguyễn Văn A');
  assert.equal(workbook.Sheets['Trang 1'].B2.v, '1.234.567');
  assert.equal(workbook.Sheets['Trang 2'].A1.t, 's');
  assert.equal(workbook.Sheets['Trang 2'].A1.f, undefined);
});

test('editable DOCX contains Vietnamese text across page sections', async () => {
  const result = await buildMediaTextResult([sample, sample], 'docx', 'Document');
  const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /Nguyễn Văn A/);
  assert.match(xml, /1\.234\.567/);
  assert.equal((xml.match(/<w:sectPr/g) ?? []).length, 2);
  assert.equal((xml.match(/<w:tbl>/g) ?? []).length, 2);
  assert.equal((xml.match(/<w:tc>/g) ?? []).length, 8);
});

test('layout DOCX embeds pages with original page dimensions', async () => {
  const result = await buildMediaLayoutResult([{ ...sample, image: png }, { width: 842, height: 595, lines: [], image: png }], 'docx', 'Layout');
  const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /w:w="11900" w:h="16840"/);
  assert.match(xml, /w:w="16840" w:h="11900"/);
  assert.equal((xml.match(/<w:drawing>/g) ?? []).length, 2);
  assert.ok(Object.keys(zip.files).some((name) => name.startsWith('word/media/') && name.endsWith('.png')));
  assert.match(result.warnings.join(' '), /không chỉnh sửa riêng/);
});

test('layout PPTX contains a slide and embedded image for every page', async () => {
  const result = await buildMediaLayoutResult([{ ...sample, image: png }, { ...sample, image: png }], 'pptx', 'Slides');
  const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  assert.ok(zip.file('ppt/slides/slide1.xml'));
  assert.ok(zip.file('ppt/slides/slide2.xml'));
  assert.match(await zip.file('ppt/slides/slide1.xml')!.async('string'), /<p:pic>/);
  assert.ok(Object.keys(zip.files).some((name) => name.startsWith('ppt/media/') && name.endsWith('.png')));
});

test('text conversion rejects empty scanned pages and respects cancellation before parsing', async () => {
  await assert.rejects(buildMediaTextResult([{ ...sample, lines: [] }], 'docx', 'Scan'), /Bật OCR/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(convertMediaFile(new File(['x'], 'sample.pdf'), 'txt', { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(convertMediaFile(new File([], 'sample.pdf'), 'txt'), /không lớn hơn 100 MB/);
});

test('text-only builders no longer produce PowerPoint', async () => {
  await assert.rejects(buildMediaTextResult([sample], 'pptx', 'Slides'), /chưa được hỗ trợ/);
});

test('filled PDF form widgets expose displayed values and checkbox states in reading order', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 300]);
  const form = pdf.getForm();
  const code = form.createTextField('Job');
  code.addToPage(page, { x: 30, y: 240, width: 180, height: 16 });
  code.setText('001-XY');
  const choice = form.createDropdown('Status');
  choice.addOptions(['Open', 'Closed']);
  choice.select('Open');
  choice.addToPage(page, { x: 30, y: 180, width: 100, height: 16 });
  const approved = form.createCheckBox('Approved');
  approved.addToPage(page, { x: 30, y: 130, width: 12, height: 12 });
  approved.check();
  const password = form.createTextField('Password');
  password.enablePassword();
  password.setText('private');
  password.addToPage(page, { x: 30, y: 80, width: 50, height: 15 });
  const task = getDocument({ data: await pdf.save(), useSystemFonts: false });
  try {
    const loaded = await readPdfLines(await task.promise, 1, true);
    assert.ok(loaded.hasAnnotations);
    assert.deepEqual(mediaTextRows(includeWidgetValues(loaded.lines, loaded.fields!.map((field) => field.line))), [['001-XY'], ['Open'], ['☑']]);
    const result = await buildMediaLayoutResult([{ ...loaded, image: png }], 'html', 'Form');
    const html = await result.files[0].blob.text();
    assert.match(html, /type="text" value="001-XY"/);
    assert.match(html, /<option value="Open" selected>Open<\/option>/);
    assert.match(html, /type="checkbox" value="Yes" checked/);
    assert.doesNotMatch(html, /private|Password/);
  } finally { await task.destroy(); }
});

test('layout Excel keeps blank and filled page images together with editable data', async () => {
  const pages = [{ ...sample, image: png }, { width: 842, height: 595, image: png, lines: [] }];
  const result = await buildMediaLayoutResult(pages, 'xlsx', 'Pages');
  const bytes = await result.files[0].blob.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: 'array' });
  assert.deepEqual(workbook.SheetNames, ['Mẫu 1', 'Dữ liệu 1', 'Mẫu 2']);
  assert.equal(workbook.Sheets['Dữ liệu 1'].A2.v, 'Nguyễn Văn A');
  const zip = await JSZip.loadAsync(bytes);
  for (const index of [1, 2]) {
    const drawing = await zip.file(`xl/drawings/drawing${index}.xml`)!.async('string');
    assert.match(drawing, /<xdr:oneCellAnchor>/);
    assert.match(drawing, /<xdr:ext cx="[1-9]\d*" cy="[1-9]\d*"/);
    assert.ok(zip.file(`xl/media/image${index}.png`));
  }
});

test('layout HTML embeds every page, escapes extracted text and positions selectable lines', async () => {
  const result = await buildMediaLayoutResult([{ ...sample, image: png }, { ...sample, image: png, lines: [line('<script>', 20, 20)] }], 'html', 'A&B');
  const html = await result.files[0].blob.text();
  assert.equal((html.match(/src="data:image\/png;base64,/g) ?? []).length, 2);
  assert.match(html, /<title>A&amp;B<\/title>/);
  assert.match(html, /<span style="left:[^"]+">Nguyễn Văn A<\/span>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('same image format retains original bytes and MIME type', async () => {
  const source = new File([png], 'logo.PNG');
  const result = await convertMediaFile(source, 'png');
  assert.deepEqual(await result.files[0].blob.arrayBuffer(), await source.arrayBuffer());
  assert.equal(result.files[0].blob.type, 'image/png');
});

test('the original image format keeps animation and rejects misleading extensions', async () => {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const source = new File([gif], 'moving.gif');
  const copy = await convertMediaFile(source, 'gif');
  assert.deepEqual(await copy.files[0].blob.arrayBuffer(), await source.arrayBuffer());
  assert.equal(copy.files[0].blob.type, 'image/gif');
  await assert.rejects(convertMediaFile(new File([gif], 'logo.heic'), 'heic'), /không khớp/);
});

test('JFIF output contains a valid APP0 segment and retains an existing JFIF without rewriting', async () => {
  const { jpegAsJfif, hasJfifHeader } = await import('../src/lib/mediaConversionOutput');
  const jpeg = new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
  const withHeader = await jpegAsJfif(jpeg);
  assert.equal(await hasJfifHeader(withHeader), true);
  assert.equal(await jpegAsJfif(withHeader), withHeader);
  const source = new File([withHeader], 'original.jpg');
  const result = await convertMediaFile(source, 'jfif');
  assert.deepEqual(await result.files[0].blob.arrayBuffer(), await source.arrayBuffer());
});

test('SVGZ wraps original SVG bytes and reopens without rasterizing the XML', async () => {
  const { compressedSvg } = await import('../src/lib/mediaConversionOutput');
  const { svgzImage } = await import('../src/lib/mediaConversionImage');
  const source = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 1 2 L 30 40"/><text>Kiểm tra</text></svg>';
  const zipped = await compressedSvg(new Blob([source], { type: 'image/svg+xml' }));
  assert.deepEqual(new Uint8Array(await zipped.slice(0, 2).arrayBuffer()), new Uint8Array([31, 139]));
  assert.equal(await (await svgzImage(new File([zipped], 'diagram.svgz'), {})).text(), source);
});

test('invalid circular TIFF directories fail before decoding', async () => {
  const { decodeImageFrames } = await import('../src/lib/mediaConversionFrames');
  const bytes = new Uint8Array([73,73,42,0,8,0,0,0,0,0,8,0,0,0]);
  await assert.rejects(Array.fromAsync(decodeImageFrames(bytes.buffer, 'tiff')), /TIFF/);
});
