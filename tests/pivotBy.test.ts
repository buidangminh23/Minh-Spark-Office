import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, compareCells, isPivotAggregator, isWebServiceUrl, pivotBy } from '../src/editors/sheet/pivotBy';

const regions = [['Bắc'], ['Nam'], ['Bắc'], ['Nam'], ['Bắc']];
const years = [[2024], [2024], [2025], [2025], [2025]];
const sales = [10, 20, 30, 40, 50];

test('pivotBy builds a cross table with totals like Excel', () => {
  const table = pivotBy({ rowFields: regions, colFields: years, values: sales, aggregator: 'SUM' });
  assert.deepEqual(table, [
    ['', 2024, 2025, 'Total'],
    ['Bắc', 10, 80, 90],
    ['Nam', 20, 40, 60],
    ['Total', 30, 120, 150],
  ]);
});

test('pivotBy honours totals, sort order and filter', () => {
  const table = pivotBy({
    rowFields: regions,
    colFields: years,
    values: sales,
    aggregator: 'MAX',
    rowTotal: 0,
    colTotal: 0,
    rowSort: -1,
    filter: [true, true, true, false, true],
  });
  assert.deepEqual(table, [
    ['', 2024, 2025],
    ['Nam', 20, ''],
    ['Bắc', 10, 50],
  ]);
});

test('pivotBy reads and shows headers, and can put the total row first', () => {
  const table = pivotBy({
    rowFields: [['Vùng'], ...regions],
    colFields: [['Năm'], ...years],
    values: ['Doanh số', ...sales],
    aggregator: 'COUNT',
    hasHeaders: true,
    showHeaders: true,
    rowTotal: -1,
  });
  assert.deepEqual(table, [
    ['Vùng', 2024, 2025, 'Total'],
    ['Total', 2, 3, 5],
    ['Bắc', 1, 2, 3],
    ['Nam', 1, 1, 2],
  ]);
});

test('pivotBy rejects ranges of different heights', () => {
  assert.equal(pivotBy({ rowFields: regions, colFields: years.slice(1), values: sales, aggregator: 'SUM' }), null);
  assert.equal(pivotBy({ rowFields: [], colFields: [], values: [], aggregator: 'SUM' }), null);
});

test('aggregate covers every supported function', () => {
  const cells = [4, 'x', 1, null, 7];
  assert.equal(aggregate('SUM', cells), 12);
  assert.equal(aggregate('AVERAGE', cells), 4);
  assert.equal(aggregate('COUNT', cells), 3);
  assert.equal(aggregate('COUNTA', cells), 4);
  assert.equal(aggregate('MIN', cells), 1);
  assert.equal(aggregate('MAX', cells), 7);
  assert.equal(aggregate('MEDIAN', cells), 4);
  assert.equal(aggregate('PRODUCT', cells), 28);
  assert.equal(aggregate('AVERAGE', ['a']), null);
  assert.equal(isPivotAggregator('SUM'), true);
  assert.equal(isPivotAggregator('VLOOKUP'), false);
});

test('compareCells sorts numbers before text and text by Vietnamese order', () => {
  assert.ok(compareCells(5, 'a') < 0);
  assert.ok(compareCells('an', 'bình') < 0);
  assert.ok(compareCells(2, 10) < 0);
});

test('isWebServiceUrl accepts only http and https addresses within the Excel limit', () => {
  assert.equal(isWebServiceUrl('https://api.example.com/data?x=1'), true);
  assert.equal(isWebServiceUrl('http://example.com'), true);
  assert.equal(isWebServiceUrl('file:///C:/secret.txt'), false);
  assert.equal(isWebServiceUrl('javascript:alert(1)'), false);
  assert.equal(isWebServiceUrl('not a url'), false);
  assert.equal(isWebServiceUrl(`https://example.com/${'a'.repeat(2100)}`), false);
});
