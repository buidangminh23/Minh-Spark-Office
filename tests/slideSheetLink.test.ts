import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SheetLinkError,
  buildChartFromGrid,
  buildTableFromGrid,
  columnIndexToLabel,
  columnLabelToIndex,
  findWorkbookSheet,
  formatSheetRange,
  parseSheetRange,
  readSheetRange,
} from '../src/lib/slideSheetLink.ts';
import { isEditableKeyTarget } from '../src/editors/slide/slideKeyTarget.ts';
import type { SheetData, WorkbookData } from '../src/lib/sheetTypes.ts';

const sheet = (cellData: SheetData['cellData'], name = 'Doanh thu'): SheetData => ({
  id: `sheet-${name}`,
  name,
  rowCount: 100,
  columnCount: 26,
  cellData,
  rowData: {},
  columnData: {},
  mergeData: [],
});

const revenueSheet = () =>
  sheet({
    1: { 1: { v: 'Quý' }, 2: { v: 'Miền Bắc' }, 3: { v: 'Miền Nam' } },
    2: { 1: { v: 'Q1' }, 2: { v: 1200, t: 2 }, 3: { v: '1350', t: 2 } },
    3: { 1: { v: 'Q2' }, 2: { f: '=C3*2', v: 2400 }, 3: { v: 1500 } },
  });

test('column labels round-trip', () => {
  assert.equal(columnLabelToIndex('A'), 0);
  assert.equal(columnLabelToIndex('Z'), 25);
  assert.equal(columnLabelToIndex('AA'), 26);
  assert.equal(columnIndexToLabel(27), 'AB');
  assert.equal(columnIndexToLabel(columnLabelToIndex('XFD')), 'XFD');
});

test('parseSheetRange accepts sheet-qualified, quoted, absolute and reversed ranges', () => {
  assert.deepEqual(parseSheetRange('Sheet1!B2:E7'), { sheetName: 'Sheet1', startRow: 1, endRow: 6, startColumn: 1, endColumn: 4 });
  assert.deepEqual(parseSheetRange("'Doanh thu ''24'!$E$7:$B$2"), { sheetName: "Doanh thu '24", startRow: 1, endRow: 6, startColumn: 1, endColumn: 4 });
  assert.deepEqual(parseSheetRange('c3'), { sheetName: undefined, startRow: 2, endRow: 2, startColumn: 2, endColumn: 2 });
  assert.equal(formatSheetRange(parseSheetRange("'Doanh thu'!B2:D4")), "'Doanh thu'!B2:D4");
  assert.throws(() => parseSheetRange('B2:'), SheetLinkError);
  assert.throws(() => parseSheetRange('A1:A2:A3'), SheetLinkError);
  assert.throws(() => parseSheetRange(''), SheetLinkError);
  assert.throws(() => parseSheetRange('A1:ZZ9999'), SheetLinkError);
});

test('chart is built from the real workbook range, not from random data', () => {
  const range = parseSheetRange('B2:D4');
  const grid = readSheetRange(revenueSheet(), range);
  const chart = buildChartFromGrid(grid, range, [{ name: 'old', values: [], color: '#123456' }]);
  assert.deepEqual(chart.categories, ['Q1', 'Q2']);
  assert.deepEqual(chart.series, [
    { name: 'Miền Bắc', values: [1200, 2400], color: '#123456' },
    { name: 'Miền Nam', values: [1350, 1500], color: '#7C3AED' },
  ]);
  const again = buildChartFromGrid(readSheetRange(revenueSheet(), range), range);
  assert.deepEqual(again.series.map((s) => s.values), chart.series.map((s) => s.values));
});

test('chart sync reports non-numeric cells and uncomputed formulas instead of inventing values', () => {
  const broken = sheet({
    0: { 0: { v: 'Nhãn' }, 1: { v: 'Giá trị' } },
    1: { 0: { v: 'A' }, 1: { v: 'chưa có' } },
  });
  const range = parseSheetRange('A1:B2');
  assert.throws(() => buildChartFromGrid(readSheetRange(broken, range), range), /B2/);
  const pending = sheet({ 0: { 0: { f: '=SUM(B1:B3)' } } });
  assert.throws(() => readSheetRange(pending, parseSheetRange('A1')), /A1.*công thức/);
  assert.throws(() => buildChartFromGrid([[1]], parseSheetRange('A1')), SheetLinkError);
});

test('table data mirrors the range as text', () => {
  const range = parseSheetRange('B2:D3');
  assert.deepEqual(buildTableFromGrid(readSheetRange(revenueSheet(), range)), [
    ['Quý', 'Miền Bắc', 'Miền Nam'],
    ['Q1', '1200', '1350'],
  ]);
});

test('findWorkbookSheet resolves by id or name and errors when missing', () => {
  const first = revenueSheet();
  const second = sheet({}, 'Chi phí');
  const workbook: WorkbookData = {
    id: 'wb',
    name: 'wb',
    appVersion: '1',
    locale: 'viVN',
    styles: {},
    sheetOrder: [first.id, second.id],
    sheets: { [first.id]: first, [second.id]: second },
  };
  assert.equal(findWorkbookSheet(workbook, undefined).id, first.id);
  assert.equal(findWorkbookSheet(workbook, 'Chi phí').id, second.id);
  assert.equal(findWorkbookSheet(workbook, second.id).id, second.id);
  assert.throws(() => findWorkbookSheet(workbook, 'Không có'), SheetLinkError);
});

test('isEditableKeyTarget recognises form fields and contenteditable hosts', () => {
  assert.equal(isEditableKeyTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
  assert.equal(isEditableKeyTarget({ tagName: 'textarea' } as unknown as EventTarget), true);
  assert.equal(isEditableKeyTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
  assert.equal(isEditableKeyTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget), true);
  assert.equal(
    isEditableKeyTarget({ tagName: 'SPAN', isContentEditable: false, closest: () => ({}) } as unknown as EventTarget),
    true
  );
  assert.equal(
    isEditableKeyTarget({ tagName: 'DIV', isContentEditable: false, closest: () => null } as unknown as EventTarget),
    false
  );
  assert.equal(isEditableKeyTarget(null), false);
  assert.equal(isEditableKeyTarget({} as EventTarget), false);
});
