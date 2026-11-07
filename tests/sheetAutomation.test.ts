import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findAutoComplete,
  isRowEmptyExcept,
  looksLikeHeaderRow,
  parseEnUsMoney,
  thousandsFormatFor,
} from '../src/editors/sheet/sheetAutomation';

const column = ['GÓI', 'Claude Pro 1 tháng chính hãng', 'ChatGPT Plus', 'Claude Pro 1 tháng chính hãng', '', null, 120];

test('findAutoComplete completes a unique case-insensitive prefix', () => {
  assert.equal(findAutoComplete('cla', column), 'Claude Pro 1 tháng chính hãng');
  assert.equal(findAutoComplete('Chat', column), 'ChatGPT Plus');
});

test('findAutoComplete stays silent when ambiguous, too short, exact, numeric or a formula', () => {
  assert.equal(findAutoComplete('C', column), null);
  assert.equal(findAutoComplete('Ch', ['Chuyển khoản', 'Chờ duyệt']), null);
  assert.equal(findAutoComplete('gói', column), null);
  assert.equal(findAutoComplete('12', ['1200', '12345']), null);
  assert.equal(findAutoComplete('=SU', ['=SUM(A1)']), null);
});

test('findAutoComplete matches Vietnamese text regardless of case', () => {
  assert.equal(findAutoComplete('tài', ['Tài khoản dùng chung', 'Gói năm']), 'Tài khoản dùng chung');
});

test('parseEnUsMoney reads US-style dollar amounts that the vi locale misreads', () => {
  assert.equal(parseEnUsMoney('$1,200.50'), 1200.5);
  assert.equal(parseEnUsMoney('$ 12,345,678'), 12345678);
  assert.equal(parseEnUsMoney('$12.5'), null);
  assert.equal(parseEnUsMoney('1.500.000 ₫'), null);
});

test('thousandsFormatFor only formats large numbers that have no format yet', () => {
  assert.equal(thousandsFormatFor(1500000, ''), '#,##0');
  assert.equal(thousandsFormatFor(1234.5, 'General'), '#,##0.00');
  assert.equal(thousandsFormatFor(999, ''), null);
  assert.equal(thousandsFormatFor(1500000, '0%'), null);
  assert.equal(thousandsFormatFor('1500000', ''), null);
});

test('looksLikeHeaderRow needs at least two text labels and no numbers', () => {
  assert.equal(looksLikeHeaderRow(['TÊN SẢN PHẨM', 'GÓI', null]), true);
  assert.equal(looksLikeHeaderRow(['Tên', 2026]), false);
  assert.equal(looksLikeHeaderRow(['Tên', '']), false);
  assert.equal(looksLikeHeaderRow(['Tên', '15%']), false);
});

test('isRowEmptyExcept ignores the cell being edited', () => {
  assert.equal(isRowEmptyExcept(['', null, 'x'], 2), true);
  assert.equal(isRowEmptyExcept(['a', null, 'x'], 2), false);
});
