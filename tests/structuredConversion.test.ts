import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { convertOfficeFile, exportConversionDocument } from '../src/lib/officeConversion.ts';

test('JSON records retain boolean and number types, large IDs, nested values and missing columns', async () => {
  const source = new File(['[{"ID":12345678901234567890,"Active":true,"Value":2.5},{"Value":4,"Other":{"label":"001","list":[1,2]}}]'], 'Items.json');
  const converted = await convertOfficeFile(source, 'xlsx');
  const book = XLSX.read(await converted.files[0].blob.arrayBuffer());
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: null });
  assert.deepEqual(rows, [['ID', 'Active', 'Value', 'Other'], ['12345678901234567890', true, 2.5, null], [null, null, 4, '{"label":"001","list":[1,2]}']]);
  assert.equal(await (await convertOfficeFile(source, 'json')).files[0].blob.text(), await source.text());
});

test('JSON with multiple sheets keeps ordering, quotes, embedded newlines and empty cells', async () => {
  const source = new File([JSON.stringify({ sheets: [
    { name: 'Tiếng Việt', rows: [['Mã', 'Tên', null], ['0001', 'Một, "hai"\nba', null]] },
    { name: 'Số', rows: [[true, false, 0]] },
  ] })], 'Book.json');
  const { files } = await convertOfficeFile(source, 'csv');
  assert.equal(files.length, 2);
  assert.match(files[0].name, /Tiếng Việt/);
  assert.match(await files[0].blob.text(), /0001,"Một, ""hai""\nba",/);
  assert.match(await files[1].blob.text(), /TRUE,FALSE,0/);
});

test('JSON rejects malformed, mixed, oversized or conflicting sheet data', async () => {
  const run = (source: string) => convertOfficeFile(new File([source], 'Table.json'), 'xlsx');
  await assert.rejects(run('[{"K":2},]'), /JSON/);
  await assert.rejects(run('[{"K":2},[3]]'), /JSON/);
  await assert.rejects(run(JSON.stringify([Array(513).fill(0)])), /giới hạn/);
  await assert.rejects(run(JSON.stringify({ sheets: [{ name: 'One', rows: [[1]] }, { name: 'ONE', rows: [[2]] }] })), /Tên trang tính/);
});

test('JSON exports uncached formulas and error cells alongside cached numbers', async () => {
  const ws = XLSX.utils.aoa_to_sheet([[5, 10, null, null]]);
  ws.B1.f = 'A1*2';
  ws.C1 = { t: 'n', f: 'A1*3' };
  ws.D1 = { t: 'e', v: 7 };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, ws, 'Data');
  const source = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'Formula.xlsx');
  const converted = await convertOfficeFile(source, 'json');
  assert.deepEqual(JSON.parse(await converted.files[0].blob.text()), [[5, 10, '=A1*3', '#DIV/0!']]);
});

test('PowerPoint extracts merged table cells in reading order and writes editable sheets and JSON rows', async () => {
  const zip = new JSZip();
  const paragraph = (s: string) => `<a:p><a:r><a:t>${s}</a:t></a:r></a:p>`;
  const cell = (s: string, attr = '') => `<a:tc ${attr}><a:txBody>${paragraph(s)}</a:txBody></a:tc>`;
  zip.file('ppt/presentation.xml', '<p:presentation><p:sldIdLst><p:sldId r:id="a"/><p:sldId r:id="b"/></p:sldIdLst></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="a" Target="slides/s2.xml"/><Relationship Id="b" Target="slides/s1.xml"/></Relationships>');
  zip.file('ppt/slides/s2.xml', `<p:sld>${paragraph('Trước bảng')}<a:tbl><a:tr>${cell('Mã hàng', 'gridSpan="2"')}${cell('', 'hMerge="1"')}</a:tr><a:tr>${cell('001')}${cell('Đơn giá')}</a:tr></a:tbl>${paragraph('Sau bảng')}</p:sld>`);
  zip.file('ppt/slides/s1.xml', `<p:sld>${paragraph('Kết thúc')}</p:sld>`);
  const source = new File([await zip.generateAsync({ type: 'uint8array' })], 'Order.pptx');
  const json = await convertOfficeFile(source, 'json');
  assert.deepEqual(JSON.parse(await json.files[0].blob.text()), [['Trang chiếu 1'], ['Trước bảng'], ['Mã hàng', ''], ['001', 'Đơn giá'], ['Sau bảng']]);
  assert.deepEqual(JSON.parse(await json.files[1].blob.text()), [['Trang chiếu 2'], ['Kết thúc']]);
  const excel = await convertOfficeFile(source, 'xlsx');
  const book = XLSX.read(await excel.files[0].blob.arrayBuffer());
  assert.equal(book.SheetNames.length, 2);
  assert.deepEqual(book.Sheets[book.SheetNames[0]]['!merges'], [XLSX.utils.decode_range('A3:B3')]);
  assert.equal(book.Sheets[book.SheetNames[0]].A4.v, '001');
});

test('EPUB export includes standalone pictures and merged table geometry', async () => {
  const { files } = await exportConversionDocument({ type: 'doc', content: [
    { type: 'image', attrs: { src: 'data:image/png;base64,aGVsbG8=', alt: 'Logo' } },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tiêu đề' }] }] }] }] },
  ] }, 'Form', 'epub', [], {});
  const zip = await JSZip.loadAsync(await files[0].blob.arrayBuffer());
  const chapter = await zip.file('OEBPS/c1.xhtml')!.async('string');
  assert.match(chapter, /<img src="images\/i1.png" alt="Logo"/);
  assert.match(chapter, /<td colspan="2"><p>Tiêu đề/);
  assert.ok(zip.file('OEBPS/images/i1.png'));
});

test('PowerPoint exports cached chart series without collapsing missing categories', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation><p:sldIdLst><p:sldId r:id="a"/></p:sldIdLst></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="a" Target="slides/s.xml"/></Relationships>');
  zip.file('ppt/slides/s.xml', '<p:sld><c:chart r:id="plot"/></p:sld>');
  zip.file('ppt/slides/_rels/s.xml.rels', '<Relationships><Relationship Id="plot" Target="../charts/chart.xml"/></Relationships>');
  zip.file('ppt/charts/chart.xml', '<c:chartSpace><c:chart><c:plotArea><c:barChart><c:ser><c:tx><c:v>Tổng</c:v></c:tx><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Đợt 1</c:v></c:pt><c:pt idx="2"><c:v>Đợt 3</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numLit><c:pt idx="0"><c:v>30</c:v></c:pt><c:pt idx="2"><c:v>50</c:v></c:pt></c:numLit></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>');
  const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'Chart.pptx');
  const converted = await convertOfficeFile(file, 'json');
  assert.deepEqual(JSON.parse(await converted.files[0].blob.text()), [['Trang chiếu 1'], ['Danh mục', 'Tổng'], ['Đợt 1', '30'], ['', ''], ['Đợt 3', '50']]);
});

test('binary Excel exports every sheet with merged cells, types, existing notes and original formula expressions', async () => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Mẫu', null], ['0001', 42], [null, null]]);
  sheet.B2.f = '21*2';
  sheet.B2.c = [{ a: 'Reviewer', t: 'Đã duyệt' }];
  sheet.B3 = { t: 'n', f: 'B2+1' };
  sheet['!merges'] = [XLSX.utils.decode_range('A1:B1')];
  XLSX.utils.book_append_sheet(book, sheet, 'Phiếu');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[true]]), 'Phụ');
  const source = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'Form.xlsx');
  const { files, warnings } = await convertOfficeFile(source, 'xlsb');
  assert.match(warnings.join(' '), /ghi chú/);
  assert.equal(files[0].name, 'Form.xlsb');
  const bytes = await files[0].blob.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file('xl/workbook.bin') && zip.file('xl/worksheets/sheet1.bin'));
  const result = XLSX.read(bytes);
  assert.deepEqual(result.SheetNames, ['Phiếu', 'Phụ', 'Công thức và ghi chú']);
  const form = result.Sheets['Phiếu'];
  assert.deepEqual(form['!merges'], sheet['!merges']);
  assert.equal(form.A2.v, '0001');
  assert.equal(form.B2.v, 42);
  assert.deepEqual(XLSX.utils.sheet_to_json(result.Sheets['Công thức và ghi chú'], { header: 1 }).slice(1), [
    ['Phiếu', 'B2', '=21*2', 'Reviewer', 'Đã duyệt'], ['Phiếu', 'B3', '=B2+1', '', ''],
  ]);
  assert.equal(form.B3.v, '=B2+1');
  assert.equal(result.Sheets['Phụ'].A1.v, true);
});
