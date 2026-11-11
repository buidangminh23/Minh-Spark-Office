import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { buildMediaLayoutResult, buildMediaTextResult, convertMediaFile, mediaConversionTargets, mediaTextRows, mediaTextTable, type MediaPage } from '../src/lib/mediaConversion';

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

test('editable PPTX puts recognised text on a slide per page instead of page images', async () => {
  const result = await buildMediaTextResult([sample, { ...sample, lines: [line('Trang hai', 20, 20)] }], 'pptx', 'Slides');
  const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  const first = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(first, /Họ tên/);
  assert.match(first, /Nguyễn Văn A/);
  assert.doesNotMatch(first, /<p:pic>/);
  assert.match(await zip.file('ppt/slides/slide2.xml')!.async('string'), /Trang hai/);
});
