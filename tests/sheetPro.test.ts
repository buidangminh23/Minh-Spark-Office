import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditAccessibility,
  buildShapeSvg,
  buildStatisticsGrid,
  buildSubtotalGrid,
  cellsToRects,
  contrastRatio,
  describeColumns,
  filterRecords,
  findSpecialCells,
  formatNumberPreview,
  parseNumberList,
  rectToA1,
} from '../src/editors/sheet/sheetPro';

test('formatNumberPreview renders Vietnamese number, currency, percent and date patterns', () => {
  assert.equal(formatNumberPreview(1234567.891, '#,##0'), '1.234.568');
  assert.equal(formatNumberPreview(1234.5, '#,##0.00'), '1.234,50');
  assert.equal(formatNumberPreview(1500000, '#,##0 "₫"'), '1.500.000 ₫');
  assert.equal(formatNumberPreview(0.1234, '0.0%'), '12,3%');
  assert.equal(formatNumberPreview(-1234, '#,##0;(#,##0)'), '(1.234)');
  assert.equal(formatNumberPreview(46333, 'dd/mm/yyyy'), '07/11/2026');
  assert.equal(formatNumberPreview(46333.5625, 'hh:mm'), '13:30');
  assert.equal(formatNumberPreview(1234, '0.00E+00'), '1,23E+03');
  assert.equal(formatNumberPreview(0.25, '# ?/?'), '1/4');
  assert.equal(formatNumberPreview(7, '000'), '007');
  assert.equal(formatNumberPreview('abc', '#,##0'), 'abc');
  assert.equal(formatNumberPreview(912345678, '0000 000 000'), '0912 345 678');
});

test('buildSubtotalGrid groups rows and writes SUBTOTAL formulas with correct ranges', () => {
  const res = buildSubtotalGrid(
    ['Phòng', 'Tên', 'Lương'],
    [
      ['Kế toán', 'An', 10],
      ['Kỹ thuật', 'Bình', 20],
      ['Kế toán', 'Chi', 30],
    ],
    0,
    'SUM',
    [2]
  );
  assert.equal(res.groupCount, 2);
  assert.deepEqual(res.grid[1], ['Kế toán', 'An', 10]);
  assert.deepEqual(res.grid[2], ['Kế toán', 'Chi', 30]);
  assert.equal(res.grid[3][0], 'Tổng Kế toán');
  assert.equal(res.grid[3][2], '=SUBTOTAL(9,C2:C3)');
  assert.equal(res.grid[5][2], '=SUBTOTAL(9,C5:C5)');
  assert.equal(res.grid[res.grandTotalRow][2], '=SUBTOTAL(9,C2:C6)');
  assert.deepEqual(res.subtotalRows, [3, 5]);
});

test('describeColumns computes descriptive statistics like the Analysis ToolPak', () => {
  const stats = describeColumns(['Giá trị'], [[2], [4], [4], [4], [5], [5], [7], [9]]);
  assert.equal(stats.length, 1);
  const s = stats[0];
  assert.equal(s.count, 8);
  assert.equal(s.mean, 5);
  assert.equal(s.median, 4.5);
  assert.equal(s.mode, 4);
  assert.ok(Math.abs(s.stdev - 2.138089935) < 1e-6);
  assert.equal(s.range, 7);
  const grid = buildStatisticsGrid(stats);
  assert.equal(grid[0][1], 'Giá trị');
  assert.equal(grid.length, 16);
  const small = buildStatisticsGrid(describeColumns(['X'], [[1], [2], [4]]));
  assert.equal(small.find((r) => String(r[0]).startsWith('Độ nhọn'))?.[1], 'Không đủ dữ liệu');
  assert.notEqual(small.find((r) => String(r[0]).startsWith('Độ lệch ('))?.[1], 'Không đủ dữ liệu');
});

test('filterRecords supports numeric, text and blank operators with AND/OR', () => {
  const rows = [
    ['An', 'Hà Nội', 15],
    ['Bình', 'Đà Nẵng', 8],
    ['Chi', 'Hà Nội', 3],
    ['Dũng', '', 20],
  ];
  assert.equal(filterRecords(rows, [{ column: 2, operator: 'gte', value: '10' }], 'and').length, 2);
  assert.equal(
    filterRecords(rows, [
      { column: 1, operator: 'contains', value: 'hà' },
      { column: 2, operator: 'gt', value: '5' },
    ], 'and').length,
    1
  );
  assert.equal(
    filterRecords(rows, [
      { column: 1, operator: 'blank', value: '' },
      { column: 0, operator: 'eq', value: 'bình' },
    ], 'or').length,
    2
  );
  assert.equal(filterRecords([...rows, ['An', 'Hà Nội', 15]], [], 'and', true).length, 4);
});

test('findSpecialCells and cellsToRects locate blanks, formulas and errors', () => {
  const values = [
    ['A', 1, null],
    ['B', '#DIV/0!', 3],
    [null, null, 5],
  ];
  const formulas = [
    [null, null, null],
    [null, '=1/0', '=1+2'],
    [null, null, null],
  ];
  const blanks = findSpecialCells(values, formulas, 'blanks');
  assert.deepEqual(blanks, [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 1 }]);
  assert.equal(findSpecialCells(values, formulas, 'formulas').length, 2);
  assert.deepEqual(findSpecialCells(values, formulas, 'errors'), [{ row: 1, col: 1 }]);
  assert.equal(findSpecialCells(values, formulas, 'text').length, 2);
  assert.deepEqual(findSpecialCells(values, formulas, 'numbers'), [{ row: 0, col: 1 }, { row: 2, col: 2 }]);
  const rects = cellsToRects([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 3, col: 4 }]);
  assert.deepEqual(rects.map(rectToA1), ['A1:B2', 'E4']);
});

test('buildShapeSvg produces escaped valid SVG for every shape', () => {
  for (const kind of ['rect', 'rounded', 'ellipse', 'arrow', 'callout', 'star', 'banner', 'textbox'] as const) {
    const svg = buildShapeSvg({
      kind,
      width: 240,
      height: 120,
      fill: '#dcfce7',
      stroke: '#15803d',
      strokeWidth: 2,
      text: 'Lưu ý <quan trọng> & cần duyệt',
      textColor: '#14532d',
      fontSize: 14,
      bold: true,
    });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('&lt;quan'));
    assert.ok(svg.includes('&amp;'));
    assert.ok(!svg.includes('<quan'));
  }
});

test('contrastRatio and auditAccessibility flag low contrast, merges and default names', () => {
  assert.ok(Math.abs((contrastRatio('#000000', '#ffffff') ?? 0) - 21) < 1e-9);
  const issues = auditAccessibility([
    {
      name: 'Sheet1',
      hidden: false,
      mergeCount: 2,
      cells: [
        { row: 0, col: 0, value: 'Tiêu đề' },
        { row: 1, col: 0, value: 'mờ', fontColor: '#d1d5db', background: '#ffffff' },
      ],
    },
  ]);
  const kinds = issues.map((i) => i.where);
  assert.ok(kinds.includes('Tên Sheet'));
  assert.ok(kinds.some((w) => w.includes('vùng gộp')));
  assert.ok(issues.some((i) => i.severity === 'error' && i.where.startsWith('A2')));
});

test('parseNumberList reads lists and stepped ranges', () => {
  assert.deepEqual(parseNumberList('1; 2; 3,5'), [1, 2, 3.5]);
  assert.deepEqual(parseNumberList('0.05 đến 0.1 bước 0.025'), [0.05, 0.075, 0.1]);
  assert.deepEqual(parseNumberList('10..30:10'), [10, 20, 30]);
});
