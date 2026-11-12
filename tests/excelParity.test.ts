import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChartData } from '../src/editors/doc/insertCharts';
import {
  checkErrors,
  parseCsv,
  coerceImportedCell,
  evaluateFormulaSteps,
  expandHeaderFooter,
  parseHtmlTables,
  pivotChartRaw,
  rangesFromIndexes,
  recommendChartKinds,
  scenarioSummary,
  spellingIssuesForCells,
  valuesToChartRaw,
  zoomToFit,
} from '../src/editors/sheet/excelParity';

test('valuesToChartRaw keeps columns aligned when the top-left cell is empty', () => {
  const raw = valuesToChartRaw([
    [null, 'Q1', 'Q2'],
    ['Hà Nội', 120, 150],
    ['HCM', 200, 180],
  ]);
  const data = parseChartData(raw);
  assert.deepEqual(data.categories, ['Hà Nội', 'HCM']);
  assert.deepEqual(data.series.map((s) => s.name), ['Q1', 'Q2']);
  assert.deepEqual(data.series[1].values, [150, 180]);
});

test('recommendChartKinds suggests pie for one positive series and scatter for numeric x', () => {
  assert.ok(recommendChartKinds([['Loại', 'Số'], ['A', 3], ['B', 5]]).includes('pie'));
  assert.equal(recommendChartKinds([['X', 'Y'], [1, 2], [2, 4], [3, 7]])[0], 'scatter');
  assert.ok(recommendChartKinds([['Tháng', 'A', 'B'], ['T1', 1, 2], ['T2', 3, 4]]).includes('column-stacked'));
});

test('pivotChartRaw groups by category and aggregates', () => {
  const raw = pivotChartRaw(
    [
      ['Vùng', 'Doanh thu'],
      ['Bắc', 10],
      ['Nam', 5],
      ['Bắc', 15],
    ],
    0,
    [1],
    'sum'
  );
  assert.equal(raw, 'Vùng\tDoanh thu\nBắc\t25\nNam\t5');
  assert.equal(pivotChartRaw([['V', 'D'], ['A', 1], ['A', 3]], 0, [1], 'average'), 'V\tD\nA\t2');
});

test('spellingIssuesForCells returns the corrected cell text', () => {
  const issues = spellingIssuesForCells([{ a1: 'B2', row: 1, column: 1, text: 'Bổ xung vật tư' }]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fixed, 'Bổ sung vật tư');
  assert.equal(spellingIssuesForCells([{ a1: 'A1', row: 0, column: 0, text: '=SUM(A1:A3)' }]).length, 0);
});

test('checkErrors finds error values, numbers stored as text and inconsistent formulas', () => {
  const issues = checkErrors([
    { row: 0, column: 2, a1: 'C1', value: 3, formula: '=A1+B1' },
    { row: 1, column: 2, a1: 'C2', value: 9, formula: '=A2*B2' },
    { row: 2, column: 2, a1: 'C3', value: 5, formula: '=A3+B3' },
    { row: 3, column: 0, a1: 'A4', value: '#DIV/0!', formula: '=1/0' },
    { row: 4, column: 0, a1: 'A5', value: '1200', formula: null },
  ]);
  assert.deepEqual(issues.map((i) => [i.a1, i.kind]), [
    ['C2', 'inconsistent-formula'],
    ['A4', 'error-value'],
    ['A5', 'number-as-text'],
  ]);
});

test('evaluateFormulaSteps replaces references one by one', () => {
  const values: Record<string, unknown> = { A1: 2, B1: 'x', 'C1:C2': [[1], [2]] };
  const steps = evaluateFormulaSteps('=A1*2&B1&SUM(C1:C2)', (ref) => values[ref], '4x3');
  assert.equal(steps[0].expression, '=A1*2&B1&SUM(C1:C2)');
  assert.equal(steps.at(-2)?.expression, '=2*2&"x"&SUM({1;2})');
  assert.equal(steps.at(-1)?.expression, '"4x3"');
});

test('expandHeaderFooter fills page, sheet and date tokens', () => {
  const text = expandHeaderFooter('Trang &[Page]/&[Pages] - &[Sheet] - &[Date]', { page: 2, pages: 5, sheet: 'Kho', file: 'a.xlsx', now: new Date(2026, 10, 12, 9, 5) });
  assert.equal(text, 'Trang 2/5 - Kho - 12/11/2026');
});

test('zoomToFit clamps between 10 and 400 percent', () => {
  assert.equal(zoomToFit({ width: 500, height: 200 }, { width: 1000, height: 1000 }), 200);
  assert.equal(zoomToFit({ width: 100000, height: 100 }, { width: 1000, height: 1000 }), 10);
  assert.equal(zoomToFit({ width: 10, height: 10 }, { width: 1000, height: 1000 }), 400);
});

test('scenarioSummary lays out changing and result cells per scenario', () => {
  const grid = scenarioSummary(
    [
      { id: '1', name: 'Tốt', comment: '', cells: [{ a1: 'B1', value: '10' }] },
      { id: '2', name: 'Xấu', comment: '', cells: [{ a1: 'B1', value: '2' }] },
    ],
    ['B3'],
    (s) => ({ B3: Number(s.cells[0].value) * 3 })
  );
  assert.deepEqual(grid[0], ['Tóm tắt kịch bản', 'Tốt', 'Xấu']);
  assert.deepEqual(grid[2], ['B1', '10', '2']);
  assert.deepEqual(grid.at(-1), ['B3', 30, 6]);
});

test('parseHtmlTables reads every table and decodes entities', () => {
  const tables = parseHtmlTables('<table><tr><th>Tên</th><th>Giá</th></tr><tr><td>A&amp;B</td><td>1.200</td></tr></table><p></p><table><tr><td>x</td></tr></table>');
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0], [['Tên', 'Giá'], ['A&B', '1.200']]);
  assert.equal(coerceImportedCell('1.200'), 1200);
  assert.equal(coerceImportedCell('1,234.5'), 1234.5);
  assert.equal(coerceImportedCell('abc'), 'abc');
});

test('rangesFromIndexes groups consecutive indexes', () => {
  assert.deepEqual(rangesFromIndexes([5, 1, 2, 3, 7, 6]), [{ start: 1, count: 3 }, { start: 5, count: 3 }]);
});

test('parseCsv handles quotes, semicolons and CRLF line endings', () => {
  assert.deepEqual(parseCsv('Tên;Số\r\n"Nguyễn, A";1.200\r\n"Có ""nháy""";5\r\n'), [
    ['Tên', 'Số'],
    ['Nguyễn, A', '1.200'],
    ['Có "nháy"', '5'],
  ]);
  assert.deepEqual(parseCsv('a,b\n1,2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});
