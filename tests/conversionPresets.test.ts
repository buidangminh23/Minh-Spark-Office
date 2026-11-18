import test from 'node:test';
import assert from 'node:assert/strict';
import { CONVERSION_PRESETS, CONVERSION_SOURCE_GROUPS, filterConversionPresets, presetAccept, presetAcceptsFile, presetInitialFidelity, presetSampleName } from '../src/lib/conversionPresets.ts';
import { conversionGuide } from '../src/lib/conversionGuide.ts';
import { OPEN_FORMAT_GROUP, conversionOutputGroups } from '../src/lib/conversionPresets.ts';
import { CONVERSION_ACCEPT, conversionTargets } from '../src/lib/fileConversion.ts';

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
  assert.deepEqual(find('PDF to Word'), ['format-pdf-docx']);
  assert.ok(find('anh sang word').includes('format-png-docx'));
  assert.deepEqual(find('.DOCX → .PDF'), ['format-docx-pdf']);
  assert.deepEqual(find('unavailable format'), []);
});

test('the source selector and exact search expose every and only routable format pair', () => {
  const extensions = CONVERSION_SOURCE_GROUPS.flatMap((group) => group.extensions);
  assert.deepEqual(extensions.toSorted(), CONVERSION_ACCEPT.split(',').map((ext) => ext.slice(1)).toSorted());
  for (const extension of extensions) {
    const name = `tệp.${extension}`;
    const options = filterConversionPresets('', extension).flatMap((group) => group.presets);
    assert.ok(options.length > 0, extension);
    assert.deepEqual(options.map((preset) => preset.target).sort(), conversionTargets(name).map((target) => target.id).sort());
    for (const preset of options) {
      assert.equal(presetAccept(preset), `.${extension}`);
      const exact = filterConversionPresets(`.${extension} → .${preset.target}`).flatMap((group) => group.presets);
      assert.deepEqual(exact.map((choice) => choice.id), [preset.id]);
    }
  }
  assert.deepEqual(filterConversionPresets('xlsx', 'invalid'), []);
  assert.deepEqual(filterConversionPresets('pdf', 'pdf').flatMap((group) => group.presets.map((item) => item.target)), ['pdf']);
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
  for (const source of ['numbers', 'xml', 'sylk']) {
    assert.equal(conversionGuide('report.' + source, 'html', 'layout', true).mode, true);
    assert.equal(conversionGuide('report.' + source, 'tsv', 'editable', false).mode, false);
  }
});

test('OCR and table extraction shortcuts start with editable content in both menu and search', () => {
  for (const id of ['image-docx', 'doc-xlsx']) assert.equal(presetInitialFidelity(CONVERSION_PRESETS.find(item => item.id === id)), 'editable');
  for (const query of ['PNG to DOCX', 'DOCX to XLSX']) assert.equal(presetInitialFidelity(filterConversionPresets(query)[0].presets[0]), 'editable');
  assert.equal(presetInitialFidelity(CONVERSION_PRESETS.find(item => item.id === 'pdf-docx')), 'layout');
  assert.equal(presetInitialFidelity(), 'layout');
});

test('open, web and data shortcuts expose matching formats for all three Office apps', () => {
  const group = filterConversionPresets('').find(item => item.title === OPEN_FORMAT_GROUP)!;
  const forKind = (kind: string) => group.presets.filter(item => item.from === kind).map(item => item.target).sort();
  assert.deepEqual(forKind('doc'), forKind('sheet'));
  assert.deepEqual(forKind('doc'), forKind('slide'));
  for (const target of ['odt', 'ods', 'odp', 'epub', 'rtf', 'md', 'html', 'xhtml', 'txt', 'csv', 'tsv', 'json', 'xml']) assert.ok(forKind('doc').includes(target));
  assert.equal(presetInitialFidelity(group.presets.find(item => item.from === 'slide' && item.target === 'odt')), 'editable');
  assert.deepEqual(conversionOutputGroups().flatMap(item => item.extensions).sort(), CONVERSION_ACCEPT.split(',').map(ext => ext.slice(1)).sort());
  assert.deepEqual(filterConversionPresets('', 'xlsx', 'ods').flatMap(item => item.presets.map(preset => preset.id)), ['format-xlsx-ods']);
});
