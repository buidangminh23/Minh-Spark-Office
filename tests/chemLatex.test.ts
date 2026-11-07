import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { latexToMath } from 'docx/math';
import { ceToLatex, expandChemistry } from '../src/lib/chemLatex';
import { exportDocx } from '../src/lib/docxConvert';
import { STRUCTURE_GROUPS, SYMBOL_GROUPS, TEMPLATE_SUBJECTS, latexForPreview } from '../src/editors/doc/mathCatalog';

test('ceToLatex writes subscripts, charges, coefficients and arrows', () => {
  assert.equal(ceToLatex('2H2 + O2 -> 2H2O'), '2\\mathrm{H}_{2} + \\mathrm{O}_{2} \\rightarrow 2\\mathrm{H}_{2}\\mathrm{O}');
  assert.equal(ceToLatex('Ba^2+ + SO4^2- -> BaSO4 v'), '\\mathrm{Ba}^{2+} + \\mathrm{SO}_{4}^{2-} \\rightarrow \\mathrm{BaSO}_{4} \\downarrow');
  assert.equal(ceToLatex('3OH-'), '3\\mathrm{OH}^{-}');
  assert.equal(ceToLatex('NH4+'), '\\mathrm{NH}_{4}^{+}');
  assert.equal(ceToLatex('Fe(OH)3'), '\\mathrm{Fe}(\\mathrm{OH})_{3}');
  assert.equal(ceToLatex('CaCO3 ->[t^\\circ] CaO + CO2 ^'), '\\mathrm{CaCO}_{3} \\overset{t^\\circ}{\\rightarrow} \\mathrm{CaO} + \\mathrm{CO}_{2} \\uparrow');
});

test('expandChemistry only rewrites \\ce groups', () => {
  assert.equal(expandChemistry('\\mathrm{pH}=-\\log[\\ce{H+}]'), '\\mathrm{pH}=-\\log[{\\mathrm{H}^{+}}]');
  assert.equal(expandChemistry('x^2'), 'x^2');
});

test('every catalog formula converts to a native Word equation', () => {
  const all = [...STRUCTURE_GROUPS, ...SYMBOL_GROUPS, ...TEMPLATE_SUBJECTS].flatMap((group) => group.items.map((item) => latexForPreview(item.latex)));
  const failed = all.filter((latex) => {
    try {
      latexToMath(expandChemistry(latex));
      return false;
    } catch {
      return true;
    }
  });
  assert.deepEqual(failed, []);
});

test('numbered display equations export with a right-aligned number', async () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'equation', attrs: { latex: 'E=mc^2', display: true, numbered: true } },
      { type: 'equation', attrs: { latex: '\\ce{2H2 + O2 -> 2H2O}', display: true, numbered: true, align: 'left' } },
      { type: 'equation', attrs: { latex: 'a+b', display: true } },
    ],
  };
  const page = { size: 'A4', orientation: 'portrait', margins: { top: 96, right: 96, bottom: 96, left: 96 } };
  const blob = await exportDocx(doc as never, page as never, 'Test');
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
  assert.equal((xml.match(/<m:oMath>/g) ?? []).length, 3);
  assert.ok(xml.includes('(1)') && xml.includes('(2)') && !xml.includes('(3)'));
  assert.ok(xml.includes('w:val="right"'));
  assert.ok(!xml.includes('\\ce'));
});
