import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  describeImportTruncation,
  emptySheet,
  exportSheetToCsv,
  exportSheetToStyledHtml,
  exportWorkbookToXlsx,
  formatCellDisplay,
  importSpreadsheet,
  inferDelimitedValue,
  normalizeHexColor,
  safeCssColor,
} from '../src/lib/xlsxConvert';
import type { WorkbookData } from '../src/lib/sheetTypes';
import { shiftFormulaReferences } from '../src/editors/sheet/formulaShift';
import { findDuplicateRowIndexes, groupDescendingRuns, subtractRect } from '../src/editors/sheet/sheetUtils';
import { regionLineFromRuns } from '../src/lib/docxImport';

const workbookWith = (styles: WorkbookData['styles'], cellData: Record<number, Record<number, object>>): WorkbookData => {
  const sheet = emptySheet('S1');
  sheet.cellData = cellData as WorkbookData['sheets'][string]['cellData'];
  return { id: 'wb', name: 'wb', appVersion: '0', locale: 'viVN', styles, sheetOrder: [sheet.id], sheets: { [sheet.id]: sheet } };
};

test('normalizeHexColor accepts only hex colours', () => {
  assert.equal(normalizeHexColor('FFFF0000'), '#FF0000');
  assert.equal(normalizeHexColor('00ff00'), '#00FF00');
  assert.equal(normalizeHexColor('#abc'), '#AABBCC');
  assert.equal(normalizeHexColor('FF0000"><img src=x onerror=alert(1)>'), undefined);
  assert.equal(normalizeHexColor('red;background:url(x)'), undefined);
  assert.equal(normalizeHexColor(42), undefined);
});

test('safeCssColor keeps rgb() but rejects injected values', () => {
  assert.equal(safeCssColor('rgb(10, 20, 30)'), 'rgb(10, 20, 30)');
  assert.equal(safeCssColor('rgba(10,20,30,0.5)'), 'rgba(10,20,30,0.5)');
  assert.equal(safeCssColor('rgb(1,2,3);x:url(a)'), undefined);
  assert.equal(safeCssColor('expression(alert(1))'), undefined);
});

test('exportSheetToStyledHtml never emits raw attacker-controlled style strings', () => {
  const payload = '#000"><img src=x onerror=alert(1)>';
  const wb = workbookWith(
    { s1: { cl: { rgb: payload }, bg: { rgb: payload }, ff: `Arial'"><svg onload=alert(1)>`, fs: '9pt;x' as unknown as number, bd: { t: { s: 1, cl: { rgb: payload } } } } },
    { 0: { 0: { v: 'hi', s: 's1' } } }
  );
  const sheet = wb.sheets[wb.sheetOrder[0]];
  const html = exportSheetToStyledHtml(wb, sheet);
  assert.ok(!html.includes('<img'), html);
  assert.ok(!html.includes('<svg'), html);
  assert.ok(!html.includes('onerror=alert'), html);
  assert.ok(!html.includes('9pt;x'), html);
  const styleAttrs = html.match(/style="[^"]*"/g) ?? [];
  assert.ok(styleAttrs.every((attr) => !attr.slice(7, -1).includes('<')));
});

test('exportSheetToStyledHtml keeps valid colours', () => {
  const wb = workbookWith({ s1: { cl: { rgb: '#FF0000' }, bg: { rgb: 'rgb(0,0,255)' } } }, { 0: { 0: { v: 'x', s: 's1' } } });
  const html = exportSheetToStyledHtml(wb, wb.sheets[wb.sheetOrder[0]]);
  assert.ok(html.includes('color:#FF0000'));
  assert.ok(html.includes('background:rgb(0,0,255)'));
});

test('inferDelimitedValue types numbers and booleans but keeps codes as text', () => {
  assert.deepEqual(inferDelimitedValue('100'), { v: 100, t: 2 });
  assert.deepEqual(inferDelimitedValue('-12.5'), { v: -12.5, t: 2 });
  assert.deepEqual(inferDelimitedValue('0'), { v: 0, t: 2 });
  assert.deepEqual(inferDelimitedValue('0.125'), { v: 0.125, t: 2 });
  assert.deepEqual(inferDelimitedValue('1e3'), { v: 1000, t: 2 });
  assert.deepEqual(inferDelimitedValue('TRUE'), { v: 1, t: 3 });
  assert.deepEqual(inferDelimitedValue('false'), { v: 0, t: 3 });
  assert.deepEqual(inferDelimitedValue('0123'), { v: '0123', t: 1 });
  assert.deepEqual(inferDelimitedValue('0912345678'), { v: '0912345678', t: 1 });
  assert.deepEqual(inferDelimitedValue('1234567890123456789'), { v: '1234567890123456789', t: 1 });
  assert.deepEqual(inferDelimitedValue('1.500'), { v: '1.500', t: 1 });
  assert.deepEqual(inferDelimitedValue('12/03/2026'), { v: '12/03/2026', t: 1 });
  assert.deepEqual(inferDelimitedValue('abc'), { v: 'abc', t: 1 });
});

test('importSpreadsheet types CSV numbers so formulas can sum them', async () => {
  const csv = 'name,amount,code\nA,100,0123\nB,200,0456\nC,300,TRUE\n';
  const buffer = new TextEncoder().encode(csv).buffer as ArrayBuffer;
  const wb = await importSpreadsheet(buffer, 'data.csv');
  const sheet = wb.sheets[wb.sheetOrder[0]];
  assert.deepEqual([sheet.cellData[1][1], sheet.cellData[2][1], sheet.cellData[3][1]].map((c) => c.v), [100, 200, 300]);
  assert.equal(sheet.cellData[1][1].t, 2);
  assert.deepEqual(sheet.cellData[1][2], { v: '0123', t: 1 });
  assert.deepEqual(sheet.cellData[3][2], { v: 1, t: 3 });
  assert.equal(sheet.cellData[0][0].v, 'name');
  assert.equal(wb.importTruncation, undefined);
});

test('xlsx uses the Normal font and its localized theme for column geometry', async () => {
  const source = new ExcelJS.Workbook();
  const original = source.addWorksheet('Geometry');
  original.getCell('A1').value = 'Wrapped text';
  original.getCell('A1').font = { name: 'Calibri', scheme: 'minor', size: 11 };
  original.getCell('B1').value = 4000000;
  original.getCell('B1').font = { name: 'Times New Roman', size: 11 };
  original.getColumn(1).width = 40;
  original.getColumn(2).width = 10;
  const buffer = await source.xlsx.writeBuffer();
  const data = await importSpreadsheet(buffer as ArrayBuffer, 'geometry.xlsx');
  const sheet = data.sheets[data.sheetOrder[0]];
  assert.deepEqual(data.defaultStyle, { ff: 'Arial', fs: 11 });
  assert.deepEqual(sheet.defaultStyle, data.defaultStyle);
  assert.equal(sheet.defaultColumnWidth, 72);
  assert.deepEqual([sheet.columnData[0].w, sheet.columnData[1].w], [320, 80]);
  assert.equal(data.styles[sheet.cellData[0][0].s as string].ff, 'Arial');
  assert.equal(data.styles[sheet.cellData[0][1].s as string].ff, 'Times New Roman');
  assert.equal(sheet.cellData[0][1].v, 4000000);
});

test('xlsx import distinguishes cached and fixed wrapped row heights and preserves them on export', async () => {
  const source = new ExcelJS.Workbook();
  const original = source.addWorksheet('Stock', { properties: { defaultRowHeight: 15 } });
  original.getColumn(3).width = 274 / 7;
  for (const index of [1, 2, 3]) {
    const cell = original.getCell(index, 3);
    cell.value = 'Wrapped product description '.repeat(4);
    cell.alignment = { wrapText: true };
  }
  original.getRow(1).height = 15;
  original.getRow(2).height = 28.25;
  original.getRow(2).hidden = true;
  const path = 'xl/worksheets/sheet1.xml';
  const zip = await JSZip.loadAsync(await source.xlsx.writeBuffer());
  const stylesPath = 'xl/styles.xml';
  const stylesXml = await zip.file(stylesPath)!.async('string');
  zip.file(stylesPath, stylesXml.replace(/<font>[\s\S]*?<\/font>/, '<font><sz val="11"/><name val="Times New Roman"/></font>'));
  const xml = await zip.file(path)!.async('string');
  zip.file(path, xml.replace(/<row r="1"[^>]*>/, (tag) => tag.replace(' customHeight="1"', '')));
  const data = await importSpreadsheet(await zip.generateAsync({ type: 'arraybuffer' }), 'stock.xlsx');
  const sheet = data.sheets[data.sheetOrder[0]];
  assert.equal(sheet.defaultRowHeight, 20);
  assert.equal(sheet.columnData[2].w, 274);
  assert.deepEqual(sheet.rowData[0], { h: 20, ia: 1 });
  assert.deepEqual(sheet.rowData[1], { h: 28.25 * 4 / 3, hd: 1, ia: 0 });
  assert.equal(sheet.rowData[2]?.h, undefined);
  sheet.rowData[0].ah = 60;
  const exported = await exportWorkbookToXlsx(data);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await exported.arrayBuffer());
  const result = reopened.worksheets[0];
  assert.equal(result.getRow(1).height, undefined);
  assert.equal(result.getRow(2).height, 28.25);
  assert.equal(result.getRow(2).hidden, true);
  assert.equal(result.getColumn(3).width, 274 / 7);
  assert.equal(result.properties.defaultRowHeight, 15);
  assert.equal(result.getCell('C1').alignment.wrapText, true);
});

test('xlsx exports its Normal font and preserves fractional character widths independent of locale', async () => {
  const data = workbookWith({ normal: { ff: 'Arial', fs: 11 } }, { 0: { 0: { v: 'A' }, 1: { v: 'B' } } });
  data.defaultStyle = 'normal';
  const sheet = data.sheets[data.sheetOrder[0]];
  sheet.defaultColumnWidth = 97;
  sheet.columnData = { 0: { w: 52 }, 1: { w: 72 } };
  const bytes = await (await exportWorkbookToXlsx(data)).arrayBuffer();
  const source = new ExcelJS.Workbook();
  await source.xlsx.load(bytes);
  const written = source.worksheets[0];
  assert.equal(written.properties.defaultColWidth, 12.125);
  assert.equal(written.getColumn(1).width, 6.5);
  assert.equal(written.getColumn(2).width, 9);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('xl/styles.xml')!.async('string');
  const firstFont = xml.match(/<font>[\s\S]*?<\/font>/)?.[0] ?? '';
  assert.match(firstFont, /<name val="Arial"/);
  assert.doesNotMatch(firstFont, /<scheme/);
  const reopened = await importSpreadsheet(bytes, 'normal.xlsx');
  assert.deepEqual(reopened.defaultStyle, { ff: 'Arial', fs: 11 });
  const again = reopened.sheets[reopened.sheetOrder[0]];
  assert.equal(again.defaultColumnWidth, 97);
  assert.deepEqual(again.columnData, sheet.columnData);
});

test('importSpreadsheet reports rows dropped beyond the import limit', async () => {
  const lines = Array.from({ length: 20005 }, (_, i) => String(i + 1));
  const buffer = new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer;
  const wb = await importSpreadsheet(buffer, 'big.csv');
  assert.equal(wb.importTruncation?.length, 1);
  assert.equal(wb.importTruncation?.[0].rows, 20005);
  assert.equal(wb.importTruncation?.[0].keptRows, 20000);
  const message = describeImportTruncation(wb.importTruncation);
  assert.ok(message?.includes('20.000/20.005 dòng'), message ?? '');
});

test('importSpreadsheet reports xlsx truncation through the SheetJS path', async () => {
  const aoa = Array.from({ length: 3 }, () => Array.from({ length: 505 }, (_, c) => c));
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Wide');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'ods' }) as ArrayBuffer;
  const wb = await importSpreadsheet(bytes, 'wide.ods');
  assert.equal(wb.importTruncation?.[0].columns, 505);
  assert.equal(wb.importTruncation?.[0].keptColumns, 500);
});

test('exportSheetToCsv no longer stops at row 20,000', async () => {
  const sheet = emptySheet('S1');
  sheet.cellData = { 0: { 0: { v: 'first' } }, 25000: { 0: { v: 'last' } } };
  const text = await exportSheetToCsv(sheet).text();
  assert.ok(text.trimEnd().endsWith('last'));
  assert.equal(text.split('\r\n').length, 25001);
});

test('formatCellDisplay renders time and date-time formats', () => {
  const show = (v: number, pattern: string) => formatCellDisplay(undefined, { v, s: { n: { pattern } } });
  assert.equal(show(0.5, 'h:mm'), '12:00');
  assert.equal(show(0.5, 'hh:mm:ss'), '12:00:00');
  assert.equal(show(0.75, 'h:mm AM/PM'), '6:00 PM');
  assert.equal(show(46000.75, 'dd/mm/yyyy hh:mm'), '09/12/2025 18:00');
  assert.equal(show(46000, 'dd/mm/yyyy'), '09/12/2025');
  assert.equal(show(46000, 'yyyy-mm-dd'), '2025-12-09');
  assert.equal(show(46000, 'd/m/yy'), '9/12/25');
  assert.equal(show(46000, 'mmm yyyy'), 'Dec 2025');
  assert.equal(show(1.25, '[h]:mm'), '30:00');
  assert.equal(show(0.000694444, 'mm:ss'), '01:00');
  assert.equal(show(1234.5, '#,##0.00'), '1,234.50');
  assert.equal(show(0.25, '0%'), '25%');
});

test('regionLineFromRuns keeps text after PAGE and NUMPAGES fields', () => {
  const line = regionLineFromRuns([
    { text: 'Trang ' },
    { fldChar: 'begin' },
    { instr: ' PAGE ' },
    { fldChar: 'separate' },
    { text: '1' },
    { fldChar: 'end' },
    { text: ' / ' },
    { fldChar: 'begin' },
    { instr: ' NUMPAGES ' },
    { fldChar: 'separate' },
    { text: '3' },
    { fldChar: 'end' },
    { text: ' · Công ty ABC' },
  ]);
  assert.equal(line, 'Trang  /  · Công ty ABC');
});

test('regionLineFromRuns keeps results of non-page fields and drops simple page fields', () => {
  const line = regionLineFromRuns([
    { fldChar: 'begin' },
    { instr: ' DATE \\@ "dd/MM/yyyy" ' },
    { fldChar: 'separate' },
    { text: '10/11/2026' },
    { fldChar: 'end' },
    { text: ' - ' },
    { text: '7', inPageField: true },
    { tab: true },
    { text: 'Mật' },
  ]);
  assert.equal(line, '10/11/2026 - \tMật');
});

test('shiftFormulaReferences offsets relative references only', () => {
  assert.equal(shiftFormulaReferences('=A2*B2', 1, 0), '=A3*B3');
  assert.equal(shiftFormulaReferences('=$A$2*B$2+$C2', 3, 2), '=$A$2*D$2+$C5');
  assert.equal(shiftFormulaReferences('=SUM(A1:B10)', 2, 1), '=SUM(B3:C12)');
  assert.equal(shiftFormulaReferences('=SUM(A:A)+SUM(2:3)', 1, 1), '=SUM(B:B)+SUM(3:4)');
  assert.equal(shiftFormulaReferences("='My Sheet'!A1+Sheet2!B2", 1, 0), "='My Sheet'!A2+Sheet2!B3");
  assert.equal(shiftFormulaReferences('=IF(A1>0,"B1 ok",C1)', 1, 0), '=IF(A2>0,"B1 ok",C2)');
  assert.equal(shiftFormulaReferences('=LOG10(A1)*1.5E2', 1, 0), '=LOG10(A2)*1.5E2');
  assert.equal(shiftFormulaReferences('=A1-1', -1, 0), '=#REF!-1');
  assert.equal(shiftFormulaReferences('=Table1[[#This Row],[A1]]+A1', 1, 0), '=Table1[[#This Row],[A1]]+A2');
  assert.equal(shiftFormulaReferences('=_xlfn.XLOOKUP(A1,B:B,C:C)', 0, 1), '=_xlfn.XLOOKUP(B1,C:C,D:D)');
  assert.equal(shiftFormulaReferences('=XFD1+1', 0, 1), '=#REF!+1');
  assert.equal(shiftFormulaReferences('plain text A1', 1, 0), 'plain text A1');
  assert.equal(shiftFormulaReferences('=A1', 0, 0), '=A1');
});

test('subtractRect clears only the part of a cut source outside the paste area', () => {
  const source = { startRow: 0, endRow: 4, startColumn: 0, endColumn: 0 };
  assert.deepEqual(subtractRect(source, { startRow: 2, endRow: 6, startColumn: 0, endColumn: 0 }), [{ startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 }]);
  assert.deepEqual(subtractRect(source, source), []);
  assert.deepEqual(subtractRect(source, { startRow: 0, endRow: 4, startColumn: 3, endColumn: 3 }), [source]);
  const grid = { startRow: 0, endRow: 2, startColumn: 0, endColumn: 2 };
  const pieces = subtractRect(grid, { startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 });
  const cells = pieces.reduce((sum, p) => sum + (p.endRow - p.startRow + 1) * (p.endColumn - p.startColumn + 1), 0);
  assert.equal(cells, 8);
});

test('findDuplicateRowIndexes and groupDescendingRuns plan deletions bottom-up', () => {
  const rows = [['h', 'x'], ['a', 1], ['b', 2], ['a', 1], ['a', 1], ['c', 3], [' b ', 2]];
  const duplicates = findDuplicateRowIndexes(rows);
  assert.deepEqual(duplicates, [3, 4, 6]);
  assert.deepEqual(groupDescendingRuns(duplicates), [{ start: 6, count: 1 }, { start: 3, count: 2 }]);
});

test('importSpreadsheet reports xlsx truncation through the ExcelJS path', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Wide');
  sheet.addRow(Array.from({ length: 505 }, (_, c) => c));
  sheet.getCell(5, 1).font = { bold: true };
  const bytes = (await book.xlsx.writeBuffer()) as ArrayBuffer;
  const wb = await importSpreadsheet(bytes, 'wide.xlsx');
  assert.equal(wb.importTruncation?.length, 1);
  assert.equal(wb.importTruncation?.[0].columns, 505);
  assert.equal(wb.importTruncation?.[0].keptColumns, 500);
  assert.equal(wb.importTruncation?.[0].rows, 1);
});

test('importSpreadsheet maps Segoe UI to Arial and normalizes Vietnamese text to NFC', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Working');
  const decomposed = 'tới cửa đông'.normalize('NFD');
  sheet.getCell(1, 1).value = decomposed;
  sheet.getCell(1, 1).font = { name: 'Segoe UI', size: 11 };
  sheet.getCell(1, 2).value = 'Times';
  sheet.getCell(1, 2).font = { name: 'Times New Roman' };
  sheet.getCell(2, 1).value = { richText: [{ text: 'cửa'.normalize('NFD') }, { text: ' hàng' }] };
  const bytes = (await book.xlsx.writeBuffer()) as ArrayBuffer;
  const wb = await importSpreadsheet(bytes, 'test.xlsx');
  const data = wb.sheets[wb.sheetOrder[0]];
  const a1 = data.cellData[0][0] as { v: string; s: string };
  assert.equal(a1.v, 'tới cửa đông'.normalize('NFC'));
  assert.notEqual(a1.v, decomposed);
  assert.equal(wb.styles[a1.s]?.ff, 'Arial');
  const b1 = data.cellData[0][1] as { s: string };
  assert.equal(wb.styles[b1.s]?.ff, 'Times New Roman');
  assert.equal((data.cellData[1][0] as { v: string }).v, 'cửa hàng'.normalize('NFC'));
});

test('importSpreadsheet normalizes decomposed Vietnamese text in CSV', async () => {
  const csv = `Q6,Q9A
${'đông'.normalize('NFD')},${'cửa hàng'.normalize('NFD')}`;
  const wb = await importSpreadsheet(new TextEncoder().encode(csv).buffer as ArrayBuffer, 'data.csv');
  const data = wb.sheets[wb.sheetOrder[0]];
  assert.equal((data.cellData[1][0] as { v: string }).v, 'đông'.normalize('NFC'));
  assert.equal((data.cellData[1][1] as { v: string }).v, 'cửa hàng'.normalize('NFC'));
});

test('exportSheetToStyledHtml prints only the cells inside the print area', () => {
  const wb = workbookWith({}, { 0: { 0: { v: 'outside-a1' }, 26: { v: 'inside-aa1' }, 27: { v: 'inside-ab1' }, 28: { v: 'outside-ac1' } }, 1: { 26: { v: 'inside-aa2' } }, 2: { 26: { v: 'outside-aa3' } } });
  const html = exportSheetToStyledHtml(wb, wb.sheets[wb.sheetOrder[0]], { printArea: 'S1!$AA$1:$AB$2' });
  for (const kept of ['inside-aa1', 'inside-ab1', 'inside-aa2']) assert.ok(html.includes(kept), kept);
  for (const dropped of ['outside-a1', 'outside-ac1', 'outside-aa3']) assert.ok(!html.includes(dropped), dropped);
});

test('exportWorkbookToXlsx output is read back with values, formulas, styles and merges', async () => {
  const wb = workbookWith({ s1: { bl: 1, bg: { rgb: '#1F7A5C' } } }, { 0: { 0: { v: 'Tổng quý', t: 1, s: 's1' } }, 1: { 0: { v: 120, t: 2 }, 1: { v: 80, t: 2 }, 2: { f: '=A2+B2', v: 200, t: 2 } } });
  wb.sheets[wb.sheetOrder[0]].mergeData.push({ startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 });
  const blob = await exportWorkbookToXlsx(wb);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const restored = await importSpreadsheet(await blob.arrayBuffer(), 'round-trip.xlsx');
  const data = restored.sheets[restored.sheetOrder[0]];
  const title = data.cellData[0][0] as { v: string; s: string };
  assert.equal(title.v, 'Tổng quý');
  assert.equal(restored.styles[title.s]?.bl, 1);
  assert.equal(restored.styles[title.s]?.bg?.rgb, '#1F7A5C');
  assert.equal((data.cellData[1][2] as { f: string }).f, '=A2+B2');
  assert.equal((data.cellData[1][2] as { v: number }).v, 200);
  assert.deepEqual(data.mergeData, [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 }]);
});
