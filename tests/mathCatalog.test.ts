import assert from 'node:assert/strict';
import { test } from 'node:test';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { STRUCTURE_GROUPS, SYMBOL_GROUPS, TEMPLATE_SUBJECTS, fieldToLatex, katexStrict, latexForPreview, latexForSource, usesChemistry } from '../src/editors/doc/mathCatalog';

const render = (latex: string) => katex.renderToString(latex, { throwOnError: true, strict: (code: string) => (katexStrict(code) === 'ignore' ? 'ignore' : 'error'), displayMode: true });

for (const [name, groups] of [['structures', STRUCTURE_GROUPS], ['symbols', SYMBOL_GROUPS], ['templates', TEMPLATE_SUBJECTS]] as const) {
  test(`every ${name} entry renders without KaTeX errors`, () => {
    for (const group of groups) {
      assert.ok(group.items.length > 0, `${group.name} is empty`);
      for (const item of group.items) {
        assert.doesNotThrow(() => render(latexForPreview(item.latex)), `${group.name} / ${item.label}: ${item.latex}`);
      }
    }
  });
}

test('the catalog covers every Word equation structure group and several subjects', () => {
  assert.ok(STRUCTURE_GROUPS.length >= 12);
  assert.ok(TEMPLATE_SUBJECTS.reduce((sum, group) => sum + group.items.length, 0) >= 80);
  assert.ok(TEMPLATE_SUBJECTS.some((group) => group.id === 'chemistry'));
});

test('placeholders become boxes for previews and disappear in LaTeX source mode', () => {
  assert.equal(latexForPreview('\\frac{#@}{#?}'), '\\frac{\\square}{\\square}');
  assert.equal(latexForSource('\\frac{#@}{#?}'), '\\frac{}{}');
});

test('usesChemistry spots mhchem formulas', () => {
  assert.equal(usesChemistry('\\ce{2H2 + O2 -> 2H2O}'), true);
  assert.equal(usesChemistry('x^2'), false);
});

test('fieldToLatex drops empty MathLive placeholders and keeps filled ones', () => {
  const empty = String.raw`\int\placeholder{}\,d\placeholder{}`;
  const filled = String.raw`\frac{\placeholder[n]{x}}{2}`;
  assert.equal(fieldToLatex(empty), String.raw`\int{}\,d{}`);
  assert.equal(fieldToLatex(filled), String.raw`\frac{x}{2}`);
  assert.doesNotThrow(() => katex.renderToString(fieldToLatex(empty), { throwOnError: true }));
});
