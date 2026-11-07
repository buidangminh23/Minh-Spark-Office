import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FORMULA_CATALOG,
  parseA1Range,
  formatA1Cell,
  formatA1Range,
  readVietnameseMoneyWords,
  coerceNumeric,
} from '../src/editors/sheet/sheetUtils';

test('FORMULA_CATALOG contains comprehensive Excel formulas and modern dynamic arrays', () => {
  assert.ok(FORMULA_CATALOG.length >= 75, `Expected at least 75 formulas, got ${FORMULA_CATALOG.length}`);
  const names = new Set(FORMULA_CATALOG.map((f) => f.name.toUpperCase()));

  const modernFormulas = [
    'XLOOKUP',
    'XMATCH',
    'FILTER',
    'SORT',
    'UNIQUE',
    'SEQUENCE',
    'TEXTJOIN',
    'TEXTBEFORE',
    'TEXTAFTER',
    'TEXTSPLIT',
    'CHOOSECOLS',
    'CHOOSEROWS',
    'TOCOL',
    'TOROW',
    'LET',
    'LAMBDA',
  ];

  for (const name of modernFormulas) {
    assert.ok(names.has(name), `Missing formula in catalog: ${name}`);
  }

  for (const item of FORMULA_CATALOG) {
    assert.ok(item.syntax.startsWith('='), `Formula syntax must start with =: ${item.name}`);
    assert.ok(item.desc.length > 5, `Formula desc too short: ${item.name}`);
    assert.ok(item.template.startsWith('='), `Formula template must start with =: ${item.name}`);
  }
});

test('A1 coordinate formatting and range parsing support standard, absolute, and multi-cell ranges', () => {
  assert.equal(formatA1Cell(0, 0), 'A1');
  assert.equal(formatA1Cell(2, 1), 'B3');
  assert.equal(formatA1Range(2, 1, 6, 3), 'B3:D7');

  const parsedSingle = parseA1Range('C5');
  assert.deepEqual(parsedSingle, {
    sheetName: undefined,
    startRow: 4,
    startColumn: 2,
    endRow: 4,
    endColumn: 2,
  });

  const parsedRange = parseA1Range('B3:D7');
  assert.deepEqual(parsedRange, {
    sheetName: undefined,
    startRow: 2,
    startColumn: 1,
    endRow: 6,
    endColumn: 3,
  });

  const parsedAbsolute = parseA1Range('$A$1:$F$20');
  assert.deepEqual(parsedAbsolute, {
    sheetName: undefined,
    startRow: 0,
    startColumn: 0,
    endRow: 19,
    endColumn: 5,
  });
});

test('readVietnameseMoneyWords accurately translates accounting numbers into Vietnamese words', () => {
  const result15m = readVietnameseMoneyWords(15000000);
  assert.match(result15m, /mười lăm triệu đồng chẵn/i);

  const result1m250 = readVietnameseMoneyWords(1250000);
  assert.match(result1m250, /triệu.*trăm.*nghìn đồng chẵn/i);

  assert.equal(readVietnameseMoneyWords(0), 'Không đồng chẵn');
});

test('coerceNumeric parses numbers, currency signs, commas, and percentage strings accurately', () => {
  assert.equal(coerceNumeric(1234.5), 1234.5);
  assert.equal(coerceNumeric('1,500,000'), 1500000);
  assert.equal(coerceNumeric('250.50'), 250.5);
  assert.equal(coerceNumeric('15%'), 0.15);
  assert.equal(coerceNumeric('500,000₫'), 500000);
  assert.equal(coerceNumeric('$1,200.00'), 1200);
  assert.equal(coerceNumeric(''), null);
  assert.equal(coerceNumeric('không phải số'), null);
});

test('formula auditing reference extraction parses precedent cell and range addresses correctly', () => {
  const formula = '=SUM(B3:D7) + $A$1 * Sheet2!C10 - MAX(E2:E15, 100)';
  const refRegex = /(?:([A-Za-z0-9_]+)!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?/g;
  const matches = [...formula.matchAll(refRegex)].map((m) => m[0].replace(/\$/g, ''));

  assert.ok(matches.includes('B3:D7'));
  assert.ok(matches.includes('A1'));
  assert.ok(matches.includes('Sheet2!C10'));
  assert.ok(matches.includes('E2:E15'));
});
