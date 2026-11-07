import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SUPERSCRIPT_TRIGGER,
  SYMBOL_TRIGGER,
  isInsideOpenMath,
  looksLikeDisplayMath,
  looksLikeInlineMath,
  superscriptFor,
  symbolForCommand,
} from '../src/editors/doc/mathInput';

test('prices written with dollar signs never become inline equations', () => {
  assert.equal(looksLikeInlineMath('20/tháng, gói Pro '), false);
  assert.equal(looksLikeInlineMath('20-'), false);
  assert.equal(looksLikeInlineMath('1,200.50'), false);
  assert.equal(looksLikeInlineMath(' x+1'), false);
});

test('real inline formulas still convert', () => {
  assert.equal(looksLikeInlineMath('E=mc^2'), true);
  assert.equal(looksLikeInlineMath('x'), true);
  assert.equal(looksLikeInlineMath('\\alpha+\\beta'), true);
  assert.equal(looksLikeInlineMath('a_1'), true);
});

test('display formulas need some maths, not a bare amount', () => {
  assert.equal(looksLikeDisplayMath(' \\det A '), true);
  assert.equal(looksLikeDisplayMath('200'), false);
});

test('symbol commands only fire after a space, so longer commands can be typed', () => {
  assert.equal(SYMBOL_TRIGGER.exec('\\in'), null);
  assert.equal(SYMBOL_TRIGGER.exec('\\int ')?.[1], 'int');
  assert.equal(symbolForCommand('int'), '∫');
  assert.equal(symbolForCommand('infty'), '∞');
  assert.equal(symbolForCommand('subseteq'), '⊆');
  assert.equal(symbolForCommand('notacommand'), null);
});

test('underscores in names and codes are left alone, superscripts need a base and a space', () => {
  assert.equal(SUPERSCRIPT_TRIGGER.exec('file_name'), null);
  assert.equal(SUPERSCRIPT_TRIGGER.exec('SP_1 '), null);
  const match = SUPERSCRIPT_TRIGGER.exec('x^2 ');
  assert.equal(match?.[2], '2');
  assert.equal(superscriptFor('2'), '²');
  assert.equal(SUPERSCRIPT_TRIGGER.exec('^2 '), null);
});

test('isInsideOpenMath detects an unclosed dollar sign', () => {
  assert.equal(isInsideOpenMath('Công thức $E=mc'), true);
  assert.equal(isInsideOpenMath('Giá $20 và $30 '), false);
  assert.equal(isInsideOpenMath('Escaped \\$ sign'), false);
});
