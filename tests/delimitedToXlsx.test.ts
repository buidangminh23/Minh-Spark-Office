import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { decodeDelimitedBytes, detectDelimiter, inferDelimitedCell, parseDelimited, readDelimitedTable } from '../src/lib/delimitedTable.ts';
import { convertOfficeFile } from '../src/lib/officeConversion.ts';

const bytesOf = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

async function workbookOf(file: File) {
  const result = await convertOfficeFile(file, 'xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await result.files[0].blob.arrayBuffer());
  return { worksheet: workbook.worksheets[0], warnings: result.warnings };
}

test('parser keeps quoted delimiters, doubled quotes and line breaks inside one field', () => {
  assert.deepEqual(parseDelimited('a,"b, c","say ""hi""","x\ny"\r\n1,2,3,4', ','), [['a', 'b, c', 'say "hi"', 'x\ny'], ['1', '2', '3', '4']]);
});

test('delimiter detection prefers the separator that splits every line evenly', () => {
  assert.equal(detectDelimiter('Họ tên;Số tiền;Ghi chú\nAn;1.200,5;có, không\nBình;300;\n', 'csv'), ';');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3\n', 'csv'), '\t');
  assert.equal(detectDelimiter('a,b,c\n1,2,3\n', 'csv'), ',');
  assert.equal(readDelimitedTable(bytesOf('sep=|\na|b\n1|2\n'), 'csv').delimiter, '|');
});

test('decoder reads UTF-8 with BOM and falls back to Windows-1258 for legacy Vietnamese files', () => {
  assert.deepEqual(decodeDelimitedBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]).buffer), { text: 'A', encoding: 'UTF-8' });
  const legacy = decodeDelimitedBytes(new Uint8Array([0xd0, 0xe0, 0x20, 0x4e, 0xe3, 0xde, 0x6e, 0x67]).buffer);
  assert.equal(legacy.encoding, 'Windows-1258');
  assert.equal(legacy.text.normalize('NFC'), 'Đà Nẵng');
});

test('cell inference keeps codes as text and recognises numbers, percentages and dates', () => {
  assert.deepEqual(inferDelimitedCell('00123', ','), { kind: 'text', value: '00123' });
  assert.deepEqual(inferDelimitedCell('12345678901234567890', ','), { kind: 'text', value: '12345678901234567890' });
  assert.deepEqual(inferDelimitedCell('+84912345678', ','), { kind: 'text', value: '+84912345678' });
  assert.deepEqual(inferDelimitedCell('1500.25', ','), { kind: 'number', value: 1500.25 });
  assert.deepEqual(inferDelimitedCell('1,234,567', ','), { kind: 'number', value: 1234567, format: '#,##0' });
  assert.deepEqual(inferDelimitedCell('1.234.567,5', ';'), { kind: 'number', value: 1234567.5, format: '#,##0.0' });
  assert.deepEqual(inferDelimitedCell('12,5', ';'), { kind: 'number', value: 12.5, format: '0.0' });
  assert.deepEqual(inferDelimitedCell('12,5%', ';'), { kind: 'number', value: 0.125, format: '0.0%' });
  const date = inferDelimitedCell('25/12/2026', ',');
  assert.equal(date.kind, 'date');
  assert.equal(date.kind === 'date' && date.format, 'dd/mm/yyyy');
  assert.equal(date.kind === 'date' && date.value.toISOString(), '2026-12-25T00:00:00.000Z');
  assert.deepEqual(inferDelimitedCell('31/02/2026', ','), { kind: 'text', value: '31/02/2026' });
  assert.deepEqual(inferDelimitedCell('=HYPERLINK("x")', ','), { kind: 'text', value: '=HYPERLINK("x")' });
});

test('CSV to Excel puts every field in its own column inside a formatted table', async () => {
  const csv = '﻿Mã KH;Họ và tên;Địa chỉ;Số tiền;Ngày\r\n00123;Nguyễn Văn A;"12 Láng Hạ; Đống Đa, Hà Nội";1.250.000;05/11/2026\r\n00456;Trần Thị B;Cầu Giấy;300,5;06/11/2026\r\n';
  const { worksheet, warnings } = await workbookOf(new File([csv], 'Khach hang.csv'));
  assert.equal(worksheet.actualColumnCount, 5);
  assert.equal(worksheet.rowCount, 3);
  assert.deepEqual((worksheet.getRow(1).values as unknown[]).slice(1), ['Mã KH', 'Họ và tên', 'Địa chỉ', 'Số tiền', 'Ngày']);
  assert.equal(worksheet.getCell('A2').value, '00123');
  assert.equal(worksheet.getCell('C2').value, '12 Láng Hạ; Đống Đa, Hà Nội');
  assert.equal(worksheet.getCell('D2').value, 1250000);
  assert.equal(worksheet.getCell('D2').numFmt, '#,##0');
  assert.equal(worksheet.getCell('D3').value, 300.5);
  assert.equal((worksheet.getCell('E2').value as Date).toISOString(), '2026-11-05T00:00:00.000Z');
  assert.equal(worksheet.getCell('E2').numFmt, 'dd/mm/yyyy');
  assert.equal(worksheet.getCell('A1').font?.bold, true);
  assert.equal(worksheet.views[0].state, 'frozen');
  const tables = Object.values((worksheet as unknown as { tables: Record<string, { table: { ref: string; columns: unknown[] } }> }).tables);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].table.columns.length, 5);
  assert.ok((worksheet.getColumn(3).width ?? 0) >= 'Địa chỉ'.length);
  assert.ok((worksheet.getColumn(3).width ?? 0) >= '12 Láng Hạ; Đống Đa, Hà Nội'.length);
  assert.match(warnings[0], /2 dòng × 5 cột theo dấu chấm phẩy/);
});

test('CSV without a header row gets named columns and keeps the first data row', async () => {
  const { worksheet, warnings } = await workbookOf(new File(['1,2,3\n4,5,6\n'], 'so.csv'));
  assert.deepEqual((worksheet.getRow(1).values as unknown[]).slice(1), ['Cột 1', 'Cột 2', 'Cột 3']);
  assert.equal(worksheet.getCell('A2').value, 1);
  assert.equal(worksheet.getCell('C3').value, 6);
  assert.ok(warnings.some((warning) => warning.includes('Cột 1')));
});

test('duplicate and empty headers become unique table column names', async () => {
  const { worksheet } = await workbookOf(new File(['Tên,Tên,,Ghi chú\na,b,c,d\n'], 'dup.csv'));
  assert.deepEqual((worksheet.getRow(1).values as unknown[]).slice(1), ['Tên', 'Tên (2)', 'Cột 3', 'Ghi chú']);
});

test('CSV to other targets also splits by the detected delimiter', async () => {
  const result = await convertOfficeFile(new File(['a;b\n1;2\n'], 'x.csv'), 'json');
  assert.deepEqual(JSON.parse(await result.files[0].blob.text()), [['a', 'b'], ['1', '2']]);
});
