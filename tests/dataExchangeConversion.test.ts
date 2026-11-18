import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as XLSX from 'xlsx';
import { readDataExchangeWorkbook, writeDataExchangeWorkbook } from '../src/lib/dataExchangeConversion.ts';
import { DATA_EXCHANGE_EXTENSIONS } from '../src/lib/dataExchangeFormats.ts';

Object.assign(globalThis, { DOMParser, XMLSerializer });

function workbook() {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Code', 'Họ và tên', 'Giá', 'Đạt'], ['00123', 'Nguyễn "Văn" A; B\nC', 25, true], ['00124', 'Đã giao', 50, false]]);
  sheet.C3.f = 'C2*2';
  sheet.A5 = { t: 's', v: 'Ghi chú' };
  sheet['!ref'] = 'A1:D5';
  sheet['!merges'] = [XLSX.utils.decode_range('A5:B5')];
  XLSX.utils.book_append_sheet(book, sheet, 'Vật tư');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Khác']]), 'Trang 2');
  return book;
}

for (const format of DATA_EXCHANGE_EXTENSIONS) {
  test(`${format} roundtrips Vietnamese names, line breaks, typed data and all worksheets`, async () => {
    const result = await writeDataExchangeWorkbook(workbook(), format, 'Kiểm tra', {}, XLSX);
    const files = result.files.filter(file => file.name.endsWith('.' + format));
    const multi = format === 'numbers' || format === 'xml';
    assert.equal(files.length, multi ? 1 : 2);
    const imported = await readDataExchangeWorkbook(await files[0].blob.arrayBuffer(), format, XLSX);
    const sheet = imported.Sheets[imported.SheetNames[0]];
    assert.equal(sheet.A2.v, '00123');
    assert.equal(sheet.B2.v, 'Nguyễn "Văn" A; B\nC');
    assert.equal(sheet.C2.v, 25);
    assert.equal(sheet.D2.v, true);
    if (format === 'xml' || format === 'slk') assert.equal(sheet.C3.f, 'C2*2');
    if (format === 'xml') assert.deepEqual(sheet['!merges'], [XLSX.utils.decode_range('A5:B5')]);
    if (multi) assert.deepEqual(imported.SheetNames, ['Vật tư', 'Trang 2']);
    else {
      const other = await readDataExchangeWorkbook(await files[1].blob.arrayBuffer(), format, XLSX);
      const otherTitle = other.Sheets[other.SheetNames[0]].A1.v;
      assert.equal(otherTitle, format === 'dbf' ? 'Khac' : 'Khác');
    }
    if (format === 'dbf') {
      assert.equal(await result.files.find(file => file.name.endsWith('.cpg'))!.blob.text(), 'UTF-8');
      assert.match(await result.files.find(file => file.name.endsWith('.fields.csv'))!.blob.text(), /Họ và tên/);
    }
  });
}

test('exchange input rejects unrelated files, truncated records and oversized coordinates', async () => {
  const buf = (s: string) => new TextEncoder().encode(s).buffer;
  await assert.rejects(readDataExchangeWorkbook(buf('<Workbook/>'), 'xml', XLSX), /SpreadsheetML/);
  await assert.rejects(readDataExchangeWorkbook(buf('not a table'), 'dif', XLSX), /DIF/);
  await assert.rejects(readDataExchangeWorkbook(buf('ID;P\nC;X1000000000;Y1;K2\nE'), 'slk', XLSX), /giới hạn/);
  await assert.rejects(readDataExchangeWorkbook(buf('invalid'), 'dbf', XLSX), /DBF/);
  const files = (await writeDataExchangeWorkbook(workbook(), 'dbf', 'data', {}, XLSX)).files;
  const data = await files[0].blob.arrayBuffer();
  await assert.rejects(readDataExchangeWorkbook(data.slice(0, data.byteLength - 10), 'dbf', XLSX), /DBF/);
});

test('SpreadsheetML retains a live formula without fabricating a cached result', async () => {
  const book = workbook();
  book.Sheets['Vật tư'].C3 = { t: 'n', f: 'C2*2' };
  const { files } = await writeDataExchangeWorkbook(book, 'xml', 'Formulas', {}, XLSX);
  const xml = await files[0].blob.text();
  assert.match(xml, /ss:Formula="=R\[-1\]C\*2"/);
  assert.doesNotMatch(xml, /<Data ss:Type="Error"><\/Data>/);
  const result = await readDataExchangeWorkbook(await files[0].blob.arrayBuffer(), 'xml', XLSX);
  assert.equal(result.Sheets['Vật tư'].C3.f, 'C2*2');
  assert.equal(result.Sheets['Vật tư'].C3.v, undefined);
});

test('DBF preserves blank numeric records and rejects strings over its field width limit', async () => {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Id', 'Cost'], ['0001', 12], ['0002', null]]);
  XLSX.utils.book_append_sheet(book, sheet, 'S');
  const { files } = await writeDataExchangeWorkbook(book, 'dbf', 'data', {}, XLSX);
  const input = await readDataExchangeWorkbook(await files[0].blob.arrayBuffer(), 'dbf', XLSX);
  assert.equal(input.Sheets.Sheet1.B3?.v, undefined);
  sheet.A2.v = 'ữ'.repeat(100);
  await assert.rejects(writeDataExchangeWorkbook(book, 'dbf', 'data', {}, XLSX), /254 byte/);
});
