import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICE_THEMES, THEME_GROUPS, chromeFamily, chromeStyleSheet, customColorOf, customThemeVars, hexToHsl, hslToHex, previewVars, themeVars,
} from '../src/lib/chromeThemes';
import { DEFAULT_SETTINGS } from '../src/lib/appSettings';

const REQUIRED_VARS = [
  'title-bg', 'title-fg', 'tabs-bg', 'tab-fg', 'tab-active-bg', 'tab-active-fg', 'file-bg', 'ribbon-bg', 'ribbon-fg',
  'group-sep', 'group-label', 'hover-bg', 'pressed-bg', 'canvas-bg', 'status-bg', 'status-fg', 'primary-bg', 'primary-fg',
];

test('every office theme defines every chrome variable', () => {
  for (const [id, def] of Object.entries(OFFICE_THEMES)) {
    for (const key of REQUIRED_VARS) assert.ok(def.vars[key], `${id} is missing ${key}`);
  }
});

test('theme groups list each theme once and keep modern themes first', () => {
  const ids = THEME_GROUPS.flatMap((group) => group.themes.map((card) => card.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(0, 4), ['light', 'dark', 'system', 'custom']);
  assert.equal(ids.length, 4 + Object.keys(OFFICE_THEMES).length);
});

test('modern themes leave the editor chrome untouched', () => {
  assert.equal(themeVars('light', DEFAULT_SETTINGS), null);
  assert.equal(themeVars('system', DEFAULT_SETTINGS), null);
  assert.equal(chromeFamily('dark'), 'modern');
  assert.equal(chromeFamily('o07-blue'), '2007');
  assert.equal(chromeFamily('custom'), '2016');
});

test('hex and hsl conversions round-trip', () => {
  assert.equal(hslToHex(0, 100, 50), '#ff0000');
  assert.deepEqual(hexToHsl('#ff0000'), { hue: 0, sat: 100, light: 50 });
  assert.deepEqual(hexToHsl('29ae59'), hexToHsl('#29AE59'));
  assert.equal(hexToHsl('#12'), null);
  const parsed = hexToHsl('#29ae59');
  assert.ok(parsed);
  assert.equal(hslToHex(parsed.hue, parsed.sat, parsed.light), '#29ae59');
});

test('custom colour is clamped and picks readable text', () => {
  assert.deepEqual(customColorOf({ customHue: 400, customSat: -5, customLight: 99, customTint: 50 }), { hue: 359, sat: 0, light: 92, tint: 30 });
  assert.equal(customThemeVars({ hue: 215, sat: 62, light: 42, tint: 8 })['title-fg'], '#ffffff');
  assert.equal(customThemeVars({ hue: 52, sat: 75, light: 78, tint: 8 })['title-fg'], '#1b1b1b');
});

test('stylesheet and previews resolve the app colour token', () => {
  const css = chromeStyleSheet(OFFICE_THEMES['o16-colorful'].vars);
  assert.match(css, /--oc-title-bg: var\(--oc-app\);/);
  assert.doesNotMatch(css, /APP/);
  const preview = previewVars('o16-colorful', DEFAULT_SETTINGS, '#123456');
  assert.equal(preview['--oc-title-bg'], '#123456');
  const custom = previewVars('custom', { customHue: 10, customSat: 50, customLight: 40, customTint: 8 });
  assert.equal(custom['--oc-app'], 'hsl(10 50% 40%)');
  assert.ok(!('--oc-app-' in custom));
});
