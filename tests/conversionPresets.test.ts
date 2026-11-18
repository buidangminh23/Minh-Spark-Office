import test from 'node:test';
import assert from 'node:assert/strict';
import { CONVERSION_PRESETS, filterConversionPresets, presetAccept, presetAcceptsFile, presetSampleName } from '../src/lib/conversionPresets.ts';
import { conversionGuide } from '../src/lib/conversionGuide.ts';
import { conversionTargets } from '../src/lib/fileConversion.ts';

test('every conversion preset maps to a real conversion route', () => {
  assert.equal(new Set(CONVERSION_PRESETS.map((preset) => preset.id)).size, CONVERSION_PRESETS.length);
  for (const preset of CONVERSION_PRESETS) {
    for (const extension of presetAccept(preset).split(',')) {
      assert.ok(conversionTargets(`sample${extension}`).some((target) => target.id === preset.target), `${preset.id} ${extension}`);
    }
    assert.ok(presetAcceptsFile(preset, presetSampleName(preset).toUpperCase()), preset.id);
  }
});

test('conversion presets only accept their own source kind', () => {
  const wordToPdf = CONVERSION_PRESETS.find((preset) => preset.id === 'doc-pdf')!;
  assert.ok(presetAcceptsFile(wordToPdf, 'Hop dong.docx'));
  assert.ok(!presetAcceptsFile(wordToPdf, 'Bang tinh.xlsx'));
  assert.ok(!presetAcceptsFile(wordToPdf, 'docx'));
  const pdfToWord = CONVERSION_PRESETS.find((preset) => preset.id === 'pdf-docx')!;
  assert.ok(presetAcceptsFile(pdfToWord, 'scan.PDF'));
  assert.ok(!presetAcceptsFile(pdfToWord, 'scan.png'));
});

test('conversion search respects direction and matches unaccented queries and extensions', () => {
  const find = (query: string) => filterConversionPresets(query).flatMap((group) => group.presets.map((preset) => preset.id));
  assert.deepEqual(find('PDF to Word'), ['pdf-docx']);
  assert.ok(find('anh sang word').includes('image-docx'));
  assert.ok(find('.DOCX → .PDF').includes('doc-pdf'));
  assert.deepEqual(find('unavailable format'), []);
});

test('conversion controls follow the queued file, target and current fidelity', () => {
  assert.equal(conversionGuide('form.PDF', 'docx', 'layout', true).usesOcr, false);
  assert.equal(conversionGuide('form.PDF', 'docx', 'editable', false).usesOcr, true);
  assert.equal(conversionGuide('form.pdf', 'xlsx', 'layout', false).usesOcr, true);
  assert.equal(conversionGuide('form.pdf', 'jpg', 'layout', true).mode, false);
  assert.equal(conversionGuide('image.png', 'pdf', 'layout', true).mode, false);
  assert.equal(conversionGuide('report.docx', 'pdf', 'layout', true).officeLayout, true);
  assert.equal(conversionGuide('report.md', 'pdf', 'layout', true).officeLayout, false);
  assert.equal(conversionGuide('report.csv', 'xlsx', 'layout', true).mode, false);
});
