import test from 'node:test';
import assert from 'node:assert/strict';
import { CONVERSION_PRESETS, presetAccept, presetAcceptsFile, presetSampleName } from '../src/lib/conversionPresets.ts';
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
