import assert from 'node:assert/strict';
import { test } from 'node:test';
import katex from 'katex';
import { cleanMathInput } from '../src/editors/doc/extensionsExtra';
import { BUILTIN_EQUATIONS } from '../src/editors/doc/insertGalleries';
import { latexToMath } from '../src/lib/docxMath';
import { FORMULA_CATALOG } from '../src/editors/sheet/sheetUtils';

test('cleanMathInput automatically converts linear math syntax to clean LaTeX', () => {
  assert.equal(cleanMathInput('\\sqrt(x^2 + 1)'), '\\sqrt{x^2 + 1}');
  assert.equal(cleanMathInput('(a + b)/(c + d)'), '\\frac{a + b}{c + d}');
  assert.equal(cleanMathInput('x^(2n) + y_(i+1)'), 'x^{2n} + y_{i+1}');
  assert.equal(cleanMathInput('\\frac(1)(2)'), '\\frac{1}{2}');
  assert.equal(cleanMathInput('\\vec(v) + \\bar(x) + \\hat(y)'), '\\vec{v} + \\bar{x} + \\hat{y}');
  assert.equal(cleanMathInput('\\sqrt[3](x)'), '\\sqrt[3]{x}');
});

test('BUILTIN_EQUATIONS are all valid LaTeX rendered cleanly by KaTeX', () => {
  assert.ok(BUILTIN_EQUATIONS.length >= 25, `Expected at least 25 built-in equations, got ${BUILTIN_EQUATIONS.length}`);
  for (const item of BUILTIN_EQUATIONS) {
    assert.ok(item.label.length > 0, `Missing label for equation: ${item.id}`);
    const html = katex.renderToString(item.latex, { throwOnError: true });
    assert.ok(html.includes('katex'), `Render output must contain katex class for ${item.id}`);
  }
});

test('docxMath latexToMath parses radicals with degrees, products, double integrals and matrices', () => {
  const cubeRoot = latexToMath('\\sqrt[3]{x}');
  assert.ok(cubeRoot.length > 0);

  const product = latexToMath('\\prod_{i=1}^{n} x_i');
  assert.ok(product.length > 0);

  const doubleIntegral = latexToMath('\\iint_{D} f(x,y) dx dy');
  assert.ok(doubleIntegral.length > 0);

  const binomial = latexToMath('\\binom{n}{k}');
  assert.ok(binomial.length > 0);

  const pmatrix = latexToMath('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
  assert.ok(pmatrix.length > 0);
});

test('FORMULA_CATALOG includes newly added trigonometry, calculus, powers and combinatorics', () => {
  const names = new Set(FORMULA_CATALOG.map((f) => f.name.toUpperCase()));
  const requiredMath = [
    'SQRT', 'POWER', 'EXP', 'LN', 'LOG', 'LOG10',
    'PI', 'SIN', 'COS', 'TAN', 'COT', 'ASIN', 'ACOS', 'ATAN', 'DEGREES', 'RADIANS',
    'INT', 'TRUNC', 'CEILING', 'FLOOR',
    'FACT', 'COMBIN', 'PERMUT', 'GCD', 'LCM',
    'RAND', 'RANDBETWEEN',
    'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'MODE.SNGL'
  ];

  for (const name of requiredMath) {
    assert.ok(names.has(name), `Missing math formula in catalog: ${name}`);
  }
});
