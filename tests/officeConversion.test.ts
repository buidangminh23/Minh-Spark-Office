import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { convertOfficeFile, exportConversionDocument } from '../src/lib/officeConversion.ts';
import { conversionTableGrid } from '../src/lib/officeConversionTables.ts';
import type { JSONContent } from '@tiptap/react';
import { officeConversionTargets, officeFileKind } from '../src/lib/officeConversionFormats.ts';
import { conversionDocumentHtml, textConversionDocument } from '../src/lib/officeConversionDocument.ts';
import { wrapConversionText } from '../src/lib/officeConversionRender.ts';

const textFile = (name = 'Tiếng Việt.txt') => new File(['Tiếng Việt: Nguyễn Văn A\nDòng thứ hai & <script>'], name, { type: 'text/plain' });

function workbookFile() {
  const book = XLSX.utils.book_new();
  const first = XLSX.utils.aoa_to_sheet([['Mã', 'Giá trị'], ['00123', 10], ['Tổng', 20]]);
  first.B3 = { t: 'n', v: 20, f: 'B2*2' };
  first['!merges'] = [XLSX.utils.decode_range('A5:B5')];
  XLSX.utils.book_append_sheet(book, first, 'Dữ liệu');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Phụ'], ['Nội dung']]), 'Phụ');
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'Data.xlsx');
}

test('Office matrix does not advertise fabricated legacy document or presentation output', () => {
  assert.equal(officeFileKind('TEST.XLSM'), 'sheet');
  assert.equal(officeFileKind('legacy.doc'), null);
  assert.deepEqual(officeConversionTargets('unknown.exe'), []);
  for (const source of ['document.docx', 'data.xlsx', 'slides.pptx']) {
    assert.ok(officeConversionTargets(source).some((target) => target.id === 'pdf'));
    assert.ok(!officeConversionTargets(source).some((target) => target.id === 'doc' || target.id === 'ppt'));
  }
});

test('text conversion creates real DOCX preserving Vietnamese and escaped text', async () => {
  const result = await convertOfficeFile(textFile(), 'docx');
  const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /Nguyễn Văn A/);
  assert.match(xml, /&lt;script&gt;/);
  assert.equal(result.files[0].blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const original = new File([result.files[0].blob], 'Original.docx');
  const copy = await convertOfficeFile(original, 'docx');
  assert.deepEqual(new Uint8Array(await copy.files[0].blob.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  assert.deepEqual(copy.warnings, []);
});

test('text conversion writes valid OpenDocument, EPUB and PowerPoint packages', async () => {
  for (const [target, path, expected] of [
    ['odt', 'content.xml', /Nguyễn Văn A/],
    ['epub', 'mimetype', /^application\/epub\+zip$/],
    ['pptx', 'ppt/presentation.xml', /p:sldIdLst/],
  ] as const) {
    const result = await convertOfficeFile(textFile(), target);
    const zip = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
    assert.match(await zip.file(path)!.async('string'), expected);
  }
});

test('RTF output encodes Vietnamese and HTML escapes literal source markup', async () => {
  const rtf = await convertOfficeFile(textFile(), 'rtf');
  assert.match(await rtf.files[0].blob.text(), /^\{\\rtf1/);
  assert.match(await rtf.files[0].blob.text(), /\\u/);
  const html = conversionDocumentHtml(textConversionDocument('<script>alert(1)</script>'), 'A < B');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<title>A &lt; B<\/title>/);
});

test('workbook identity preserves every byte and cross format keeps sheets formulas and merges', async () => {
  const original = workbookFile();
  const copy = await convertOfficeFile(original, 'xlsx');
  assert.deepEqual(new Uint8Array(await copy.files[0].blob.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  const result = await convertOfficeFile(original, 'ods');
  const book = XLSX.read(await result.files[0].blob.arrayBuffer(), { type: 'array', cellFormula: true });
  assert.deepEqual(book.SheetNames, ['Dữ liệu', 'Phụ']);
  assert.equal(book.Sheets['Dữ liệu'].A2.v, '00123');
  assert.equal(book.Sheets['Dữ liệu'].B3.f, 'B2*2');
  assert.deepEqual(book.Sheets['Dữ liệu']['!merges'], [XLSX.utils.decode_range('A5:B5')]);
  assert.ok(result.warnings.length > 0);
});

test('CSV and JSON conversion includes every worksheet and preserves stored values', async () => {
  const csv = await convertOfficeFile(workbookFile(), 'csv');
  assert.equal(csv.files.length, 2);
  assert.match(await csv.files[0].blob.text(), /00123,10/);
  assert.match(await csv.files[1].blob.text(), /Nội dung/);
  const json = await convertOfficeFile(workbookFile(), 'json');
  assert.deepEqual(JSON.parse(await json.files[1].blob.text()), [['Phụ'], ['Nội dung']]);
  const imported = await convertOfficeFile(new File(['Mã,Số\r\n00123,12345678901234567890'], 'Input.csv'), 'xlsx');
  const book = XLSX.read(await imported.files[0].blob.arrayBuffer(), { type: 'array' });
  assert.equal(book.Sheets[book.SheetNames[0]].A2.v, '00123');
  assert.equal(book.Sheets[book.SheetNames[0]].B2.v, '12345678901234567890');
});

test('slide outline follows presentation relationship order without inventing placeholder content', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>');
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Cuối &amp; kết</a:t></a:r></a:p></p:sld>');
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>Đầu tiên</a:t></a:r></a:p></p:sld>');
  const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'Ordered.pptx');
  const result = await convertOfficeFile(file, 'txt');
  const text = await result.files[0].blob.text();
  assert.ok(text.indexOf('Đầu tiên') < text.indexOf('Cuối & kết'));
  assert.ok(!text.includes('Nội dung trang chiếu'));
  const copy = await convertOfficeFile(file, 'pptx');
  assert.deepEqual(new Uint8Array(await copy.files[0].blob.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
});

test('conversion rejects no-table extraction, malformed files, oversized data and cancellation', async () => {
  await assert.rejects(convertOfficeFile(textFile(), 'xlsx'), /không có bảng/);
  await assert.rejects(convertOfficeFile(new File([], 'Empty.txt'), 'docx'), /trống/);
  await assert.rejects(convertOfficeFile(new File(['bad'], 'Broken.docx'), 'docx'));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(convertOfficeFile(textFile(), 'docx', { signal: controller.signal }), { name: 'AbortError' });
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['data']]);
  sheet['!ref'] = 'A1:A50001';
  XLSX.utils.book_append_sheet(book, sheet, 'Too big');
  const file = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'Oversized.xlsx');
  await assert.rejects(convertOfficeFile(file, 'csv'), /quá lớn/);
});

test('page wrapping retains Unicode and splits long words without dropping characters', () => {
  assert.deepEqual(wrapConversionText('Nguyễn Văn A\nDòng hai', 12, (value) => value.length), ['Nguyễn Văn A', 'Dòng hai']);
  assert.equal(wrapConversionText('abcdefghijklmnop', 5, (value) => value.length).join(''), 'abcdefghijklmnop');
  assert.equal(wrapConversionText('😀😀😀😀', 4, (value) => value.length).join(''), '😀😀😀😀');
});

test('document table extraction preserves vertical merges, leading zero IDs and long numbers', async () => {
  const cell = (text: string, attrs = {}): JSONContent => ({ type: 'tableCell', attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  const table: JSONContent = { type: 'table', content: [
    { type: 'tableRow', content: [cell('00123', { rowspan: 2 }), cell('12345678901234567890'), cell('Tiếng Việt')] },
    { type: 'tableRow', content: [cell('=SUM(A1:A2)'), cell('Cuối')] },
  ] };
  assert.deepEqual(conversionTableGrid(table).rows, [['00123', '12345678901234567890', 'Tiếng Việt'], ['', '=SUM(A1:A2)', 'Cuối']]);
  const result = await exportConversionDocument({ type: 'doc', content: [table] }, 'Data', 'xlsx', [], {});
  const book = XLSX.read(await result.files[0].blob.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.A1.v, '00123');
  assert.equal(sheet.B1.v, '12345678901234567890');
  assert.equal(sheet.B2.v, '=SUM(A1:A2)');
  assert.equal(sheet.B2.t, 's');
  assert.equal(sheet.B2.f, undefined);
  assert.deepEqual(sheet['!merges'], [XLSX.utils.decode_range('A1:A2')]);
  const multiline: JSONContent = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [cell('Dòng một').content![0], cell('Dòng hai').content![0]] }] }] };
  assert.deepEqual(conversionTableGrid(multiline).rows, [['Dòng một\nDòng hai']]);
});

test('spreadsheet conversion retains merges and column widths in DOCX and HTML', async () => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Mã', 'Giá trị'], ['00123', 'Dòng hai'], ['', 'Dòng ba']]);
  sheet['!merges'] = [XLSX.utils.decode_range('A2:A3')];
  sheet['!cols'] = [{ wpx: 160 }, { wpx: 240 }];
  XLSX.utils.book_append_sheet(book, sheet, 'Bảng');
  const file = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'Merged.xlsx');
  const html = await convertOfficeFile(file, 'html');
  assert.match(await html.files[0].blob.text(), /rowspan="2"/);
  assert.match(await html.files[0].blob.text(), /style="width:160px"/);
  const docx = await convertOfficeFile(file, 'docx');
  const zip = await JSZip.loadAsync(await docx.files[0].blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /<w:vMerge w:val="restart"/);
  assert.match(xml, /<w:vMerge w:val="continue"/);
  assert.match(xml, /<w:gridCol w:w="2400"/);
  assert.match(xml, /Dòng ba/);
});

test('Office template and slideshow conversion preserves every package part', async () => {
  for (const [source, target, part, before, after] of [
    ['dotx', 'docx', 'word/document.xml', 'wordprocessingml.template', 'wordprocessingml.document'],
    ['ppsx', 'pptx', 'ppt/presentation.xml', 'presentationml.slideshow', 'presentationml.presentation'],
    ['potx', 'pptx', 'ppt/presentation.xml', 'presentationml.template', 'presentationml.presentation'],
  ] as const) {
    const input = new JSZip();
    input.file('[Content_Types].xml', `<Types><Override ContentType="application/vnd.openxmlformats-officedocument.${before}.main+xml"/></Types>`);
    input.file(part, '<original-layout>Nguyễn Văn A</original-layout>');
    input.file('preserved-part.bin', new Uint8Array([0, 1, 2, 3, 255]));
    const result = await convertOfficeFile(new File([await input.generateAsync({ type: 'uint8array' })], `Original.${source}`), target);
    const output = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
    assert.match(await output.file('[Content_Types].xml')!.async('string'), new RegExp(after));
    assert.equal(await output.file(part)!.async('string'), '<original-layout>Nguyễn Văn A</original-layout>');
    assert.deepEqual(await output.file('preserved-part.bin')!.async('uint8array'), new Uint8Array([0, 1, 2, 3, 255]));
    assert.deepEqual(result.warnings, []);
  }
});
