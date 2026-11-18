import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranslator, translateMultiline } from '../src/lib/i18n/uiTranslator';
import dictionary from '../src/lib/i18n/en.json';
import { CONVERSION_PRESET_GROUPS, CONVERSION_SOURCE_GROUPS } from '../src/lib/conversionPresets';
import { conversionTargets } from '../src/lib/conversionRegistry';

const translate = createTranslator({
  'Chèn': 'Insert',
  'Bảng tính': 'Spreadsheet',
  'Đã lưu macro "{0}" ({1} thao tác)': 'Saved macro "{0}" ({1} actions)',
  'Đã tải xuống "{0}.xlsx"': 'Downloaded "{0}.xlsx"',
  'Mở {0}': 'Open {0}',
  'một': 'một',
  'Ghi macro': 'Record macro',
});

test('exact labels translate and keep surrounding whitespace', () => {
  assert.equal(translate('  Chèn '), '  Insert ');
  assert.equal(translate('Chèn\n  '), 'Insert\n  ');
});

test('patterns fill placeholders and translate known values inside them', () => {
  assert.equal(translate('Đã lưu macro "Tô đậm" (3 thao tác)'), 'Saved macro "Tô đậm" (3 actions)');
  assert.equal(translate('Mở Bảng tính'), 'Open Spreadsheet');
  assert.equal(translate('Đã tải xuống "Báo cáo quý.xlsx"'), 'Downloaded "Báo cáo quý.xlsx"');
});

test('unaccented Vietnamese labels translate only on an exact match', () => {
  assert.equal(translate('Ghi macro'), 'Record macro');
  assert.equal(translate('Ghi macro nhanh'), null);
});

test('unknown, English and kept-Vietnamese text is left alone', () => {
  assert.equal(translate('Nội dung của sếp'), null);
  assert.equal(translate('Insert'), null);
  assert.equal(translate('một'), null);
  assert.equal(translate(''), null);
});

test('dialog messages translate line by line', () => {
  assert.equal(translateMultiline(translate, 'Chèn\nMở Bảng tính\nKhác'), 'Insert\nOpen Spreadsheet\nKhác');
});

test('the shipped dictionary keeps every placeholder', () => {
  for (const [vietnamese, english] of Object.entries(dictionary as Record<string, string>)) {
    const wanted = [...vietnamese.matchAll(/\{(\d+)\}/g)].map((match) => match[1]).sort().join(',');
    const found = [...english.matchAll(/\{(\d+)\}/g)].map((match) => match[1]).sort().join(',');
    assert.equal(found, wanted, `placeholders differ for "${vietnamese}"`);
  }
});

test('conversion presets, format descriptions and source groups have English labels', () => {
  const translateLabel = createTranslator(dictionary);
  const translated = (label: string) => translateLabel(label) ?? label;
  const hasVietnamese = /[đĐ\u00c0-\u01b0\u1ea0-\u1ef9]|\bsang\b/u;
  for (const group of CONVERSION_PRESET_GROUPS) {
    assert.ok(translateLabel(group.title), group.title);
    for (const preset of group.presets) {
      assert.ok(translateLabel(preset.title), preset.title);
      assert.doesNotMatch(translated(preset.title), hasVietnamese);
      assert.doesNotMatch(translated(preset.note), hasVietnamese);
    }
  }
  for (const group of CONVERSION_SOURCE_GROUPS) {
    assert.doesNotMatch(translated(group.label), hasVietnamese);
    for (const extension of group.extensions) {
      for (const target of conversionTargets(`sample.${extension}`)) {
        assert.doesNotMatch(translated(target.label), hasVietnamese);
        assert.doesNotMatch(translated(target.description), hasVietnamese);
      }
    }
  }
});
