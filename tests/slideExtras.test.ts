import test from 'node:test';
import assert from 'node:assert/strict';
import type { PresentationData, SlideData, SlideElement } from '../src/lib/slideTypes';
import { changeCase, extractFormat, formatPatchFor, listMarker } from '../src/lib/slideTextOps';
import { checkAccessibility, contrastRatio } from '../src/lib/slideAccessibility';
import { cornerRect, timelineToSlideSeconds } from '../src/lib/slideRecorder';
import { masterForSlide } from '../src/lib/slideHeaderFooter';
import { resolveTheme } from '../src/lib/slideThemeOps';
import { slideBaseWidth } from '../src/lib/settings/slideOptions';

const text = (overrides: Partial<SlideElement>): SlideElement => ({ id: 'e1', type: 'text', x: 0, y: 0, width: 50, height: 20, text: 'a', ...overrides });

const slide = (elements: SlideElement[], overrides: Partial<SlideData> = {}): SlideData =>
  ({ id: 's1', layout: 'title-content', elements, background: { type: 'color', value: '#FFFFFF' }, transition: { type: 'none', duration: 0.5 }, ...overrides }) as SlideData;

const deck = (slides: SlideData[], overrides: Partial<PresentationData> = {}): PresentationData =>
  ({ slides, themeId: 'office-classic', aspectRatio: '16:9', ...overrides }) as PresentationData;

test('change case keeps Vietnamese diacritics', () => {
  assert.equal(changeCase('đường đi', 'upper'), 'ĐƯỜNG ĐI');
  assert.equal(changeCase('ĐƯỜNG ĐI. MỚI', 'sentence'), 'Đường đi. Mới');
  assert.equal(changeCase('ba con mèo', 'capitalize'), 'Ba Con Mèo');
});

test('format painter copies text styling but not geometry', () => {
  const source = text({ fontSize: 30, color: '#FF0000', x: 40 });
  const patch = formatPatchFor(text({ id: 'e2', x: 5 }), extractFormat(source));
  assert.equal(patch.fontSize, 30);
  assert.equal(patch.color, '#FF0000');
  assert.equal(patch.x, undefined);
});

test('numbered lists use the chosen format', () => {
  assert.equal(listMarker(text({ isBullet: true, bulletStyle: 'number', fieldFormat: 'I.' }), 3), 'IV.');
  assert.equal(listMarker(text({ isBullet: true, bulletStyle: 'number', fieldFormat: 'a)' }), 1), 'b)');
  assert.equal(listMarker(text({ isBullet: false }), 0), '');
});

test('contrast ratio matches WCAG reference values', () => {
  const ratio = contrastRatio('#000000', '#FFFFFF');
  assert.ok(ratio !== null && Math.abs(ratio - 21) < 0.01);
});

test('accessibility check reports missing alt text and title', () => {
  const picture: SlideElement = { id: 'p', type: 'image', x: 0, y: 0, width: 20, height: 20, src: 'data:image/png;base64,' };
  const rules = checkAccessibility(deck([slide([picture])])).map((issue) => issue.rule);
  assert.ok(rules.includes('alt-text'));
  assert.ok(rules.includes('slide-title'));
  const decorative = checkAccessibility(deck([slide([{ ...picture, decorative: true }])])).map((issue) => issue.rule);
  assert.ok(!decorative.includes('alt-text'));
});

test('recording timeline converts to seconds per slide', () => {
  const seconds = timelineToSlideSeconds([{ slideIndex: 0, atMs: 0 }, { slideIndex: 1, atMs: 4000 }, { slideIndex: 0, atMs: 6000 }], 9000);
  assert.equal(seconds.get(0), 7);
  assert.equal(seconds.get(1), 2);
});

test('collapsed camera sits inside the chosen corner', () => {
  assert.deepEqual(cornerRect('bottom-right', 100, { width: 1000, height: 600 }), { x: 876, y: 476, width: 100, height: 100 });
  assert.deepEqual(cornerRect('top-left', 100, { width: 1000, height: 600 }), { x: 24, y: 24, width: 100, height: 100 });
});

test('header and footer respect hide-on-title and per-slide hiding', () => {
  const settings = { headerFooter: { showFooter: true, footerText: 'Mật', showSlideNumber: true, hideOnTitle: true } } as Partial<PresentationData>;
  assert.equal(masterForSlide(deck([], settings), slide([], { layout: 'title' })), undefined);
  assert.equal(masterForSlide(deck([], settings), slide([], { hideBackgroundGraphics: true })), undefined);
  assert.equal(masterForSlide(deck([], settings), slide([]))?.footerText, 'Mật');
});

test('theme overrides change fonts without touching the base theme', () => {
  const base = resolveTheme({ themeId: 'office-classic' });
  const custom = resolveTheme({ themeId: 'office-classic', themeOverrides: { fonts: { titleFont: 'Georgia', bodyFont: 'Arial' } } });
  assert.equal(custom.titleFont, 'Georgia');
  assert.notEqual(base.titleFont, 'Georgia');
});

test('every slide size has a base width', () => {
  for (const aspect of ['16:9', '4:3', '16:10', 'A4', '1:1'] as const) assert.ok(slideBaseWidth(aspect) > 0);
});
