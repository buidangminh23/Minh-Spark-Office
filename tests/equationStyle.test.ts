import assert from 'node:assert/strict';
import { test } from 'node:test';
import { equationClassName, equationInlineStyle, normalizePresentation } from '../src/editors/doc/equationStyle';

test('normalizePresentation keeps old equations unchanged', () => {
  assert.deepEqual(normalizePresentation({ latex: 'x', display: true }), { display: true, numbered: false, align: 'center', size: 100, color: '', boxed: false });
});

test('numbering only applies to equations on their own line', () => {
  assert.equal(normalizePresentation({ display: false, numbered: true }).numbered, false);
  assert.equal(normalizePresentation({ display: true, numbered: true }).numbered, true);
});

test('normalizePresentation rejects unsafe or out-of-range values', () => {
  const p = normalizePresentation({ display: true, align: 'justify', size: 9999, color: 'red;background:url(x)' });
  assert.equal(p.align, 'center');
  assert.equal(p.size, 100);
  assert.equal(p.color, '');
});

test('class names and inline style reflect the chosen presentation', () => {
  const p = normalizePresentation({ display: true, numbered: true, align: 'left', size: 150, color: '#C00000', boxed: true });
  assert.equal(equationClassName(p), 'doc-equation display numbered align-left boxed');
  assert.equal(equationInlineStyle(p), 'font-size:150%;color:#c00000');
  assert.equal(equationInlineStyle(normalizePresentation({})), '');
});
