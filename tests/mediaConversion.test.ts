import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildMediaLayoutResult, buildMediaTextResult, convertMediaFile, mediaConversionTargets, mediaTextRows, mediaTextTable, readPdfLines, type MediaPage } from '../src/lib/mediaConversion';
import { includeWidgetValues } from '../src/lib/mediaPageLayout';

const line = (text: string, x: number, y: number, width = 40) => ({ text, x, y, width, height: 12 });
const sample: MediaPage = { width: 595, height: 842, lines: [line('Họ tên', 20, 20), line('Số tiền', 200, 20), line('Nguyễn Văn A', 20, 40, 90), line('1.234.567', 200, 40, 80)] };
const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });

test('media target matrix includes OCR editable outputs and rejects unsupported sources', () => {
  for (const name of ['scan.PDF', 'image.png', 'image.heic']) {
    assert.deepEqual(mediaConversionTargets(name).map((format) => format.id), ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'html', 'png', 'jpg', 'webp']);
  }
  assert.deepEqual(mediaConversionTargets('file.exe'), []);
  assert.deepEqual(mediaConversionTargets('image.svgz'), []);
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
    assert.ok(zip.file(`xl/drawings/drawing${index}.xml`));
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
