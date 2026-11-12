import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { TIPS, type TipsApp } from '../src/components/tips/tipsContent';
import { filterSections } from '../src/components/tips/tipsSearch';

const APPS: TipsApp[] = ['doc', 'sheet', 'slide'];
const dictionary = JSON.parse(fs.readFileSync(new URL('../src/lib/i18n/en.json', import.meta.url), 'utf8')) as Record<string, string>;
const translated = (text: string) => /^[ -~]*$/.test(text) || text in dictionary;

test('every app has its own non-empty tip set', () => {
  for (const app of APPS) {
    assert.ok(TIPS[app].length > 0, app);
    for (const section of TIPS[app]) assert.ok(section.tips.length > 0, `${app}/${section.id}`);
  }
  assert.notEqual(TIPS.doc, TIPS.sheet);
  assert.notEqual(TIPS.sheet, TIPS.slide);
});

test('section ids and tip titles are unique within an app', () => {
  for (const app of APPS) {
    const ids = TIPS[app].map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, app);
    for (const section of TIPS[app]) {
      const titles = section.tips.map((tip) => tip.title);
      assert.equal(new Set(titles).size, titles.length, `${app}/${section.id}`);
    }
  }
});

test('key combos are never empty', () => {
  for (const app of APPS) {
    for (const tip of TIPS[app].flatMap((section) => section.tips)) {
      for (const combo of tip.keys ?? []) assert.ok(combo.length > 0 && combo.every(Boolean), tip.title);
    }
  }
});

test('every tip string has an English translation', () => {
  for (const app of APPS) {
    for (const section of TIPS[app]) {
      assert.ok(translated(section.title), section.title);
      for (const tip of section.tips) {
        assert.ok(translated(tip.title), tip.title);
        assert.ok(translated(tip.body), tip.body);
      }
    }
  }
});

test('search ignores Vietnamese accents and matches shortcuts', () => {
  const docMacro = filterSections(TIPS.sheet, 'macro');
  assert.ok(docMacro.some((section) => section.tips.some((tip) => tip.title === 'Ghi macro')));
  const accentless = filterSections(TIPS.doc, 'chu thich');
  assert.ok(accentless.some((section) => section.tips.some((tip) => tip.title === 'Chú thích')));
  const byKey = filterSections(TIPS.slide, 'F5');
  assert.ok(byKey.some((section) => section.tips.some((tip) => tip.title === 'Bắt đầu trình chiếu')));
  assert.deepEqual(filterSections(TIPS.doc, 'zzzz-khong-co'), []);
  assert.equal(filterSections(TIPS.doc, '   '), TIPS.doc);
});
