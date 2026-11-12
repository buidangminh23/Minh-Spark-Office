import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampUndoLimit, gridStepPercent, nextShowIndex, resolveAdvance, resolveThemeId, snapPosition, snapResize, snapTo, trimHistory,
  visibleRibbonTabs, zoomFromSetting,
} from '../src/lib/settings/slideOptions';
import { SLIDE_DEFAULTS } from '../src/lib/settings/slideDefaults';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('grid step follows the slide base size', () => {
  const wide = gridStepPercent(20, '16:9');
  close(wide.x, (20 / 960) * 100);
  close(wide.y, (20 / 540) * 100);
  close(gridStepPercent(20, '4:3').x, (20 / 720) * 100);
});

test('snapTo rounds to the nearest step and ignores invalid steps', () => {
  assert.equal(snapTo(7, 5), 5);
  assert.equal(snapTo(8, 5), 10);
  assert.equal(snapTo(7.3, 0), 7.3);
});

test('snapPosition keeps the element inside the slide', () => {
  const step = { x: 10, y: 10 };
  assert.deepEqual(snapPosition(14, 26, { width: 20, height: 20 }, step), { x: 10, y: 30 });
  assert.deepEqual(snapPosition(76, -3, { width: 20, height: 20 }, step), { x: 80, y: 0 });
  assert.deepEqual(snapPosition(86, 96, { width: 20, height: 20 }, step), { x: 80, y: 80 });
});

test('snapResize moves only the dragged edges', () => {
  const step = { x: 10, y: 10 };
  assert.deepEqual(snapResize({ x: 10, y: 10, width: 23, height: 17 }, 'se', step), { x: 10, y: 10, width: 20, height: 20 });
  assert.deepEqual(snapResize({ x: 13, y: 10, width: 27, height: 20 }, 'w', step), { x: 10, y: 10, width: 30, height: 20 });
  assert.deepEqual(snapResize({ x: 18, y: 10, width: 5, height: 20 }, 'e', step), { x: 18, y: 10, width: 5, height: 20 });
});

test('undo history default keeps the previous 26 snapshots', () => {
  const stack = Array.from({ length: 30 }, (_, index) => index);
  const trimmed = trimHistory(stack, SLIDE_DEFAULTS.slideMaxUndo);
  assert.equal(trimmed.length, 26);
  assert.equal(trimmed[25], 29);
  assert.equal(trimHistory([1, 2], 26).length, 2);
  assert.equal(clampUndoLimit(1), 3);
  assert.equal(clampUndoLimit(999), 150);
  assert.equal(clampUndoLimit(Number.NaN), 3);
});

test('zoom setting 0 means fit to window', () => {
  assert.equal(zoomFromSetting(0), null);
  assert.equal(zoomFromSetting(125), 125);
});

test('home tab can never be hidden', () => {
  const ids = visibleRibbonTabs({ home: false, insert: false, view: true }).map(([id]) => id);
  assert.equal(ids[0], 'home');
  assert.ok(!ids.includes('insert'));
  assert.ok(ids.includes('view'));
  assert.equal(visibleRibbonTabs(SLIDE_DEFAULTS.slideTabs).length, 10);
});

test('unknown theme falls back to Office Classic', () => {
  assert.equal(resolveThemeId('midnight-dark', { 'midnight-dark': {} }), 'midnight-dark');
  assert.equal(resolveThemeId('gone', { 'office-classic': {} }), 'office-classic');
});

const slides = [{}, { hidden: true }, {}, { hidden: true }];

test('nextShowIndex skips hidden slides and loops on request', () => {
  assert.equal(nextShowIndex(slides, 0, false), 2);
  assert.equal(nextShowIndex(slides, 2, false), null);
  assert.equal(nextShowIndex(slides, 2, true), 0);
});

test('resolveAdvance matches the old behaviour at defaults', () => {
  const base = { slides, loop: SLIDE_DEFAULTS.slideLoop, endWithBlack: SLIDE_DEFAULTS.slideEndWithBlack, atEnd: false };
  assert.deepEqual(resolveAdvance({ ...base, current: 0 }), { type: 'goto', index: 2 });
  assert.deepEqual(resolveAdvance({ ...base, current: 2 }), { type: 'stay' });
});

test('resolveAdvance ends with a black slide, then exits', () => {
  const base = { slides, current: 2, loop: false, endWithBlack: true };
  assert.deepEqual(resolveAdvance({ ...base, atEnd: false }), { type: 'end' });
  assert.deepEqual(resolveAdvance({ ...base, atEnd: true }), { type: 'exit' });
});

test('looping wins over the black end slide', () => {
  assert.deepEqual(resolveAdvance({ slides, current: 2, loop: true, endWithBlack: true, atEnd: false }), { type: 'goto', index: 0 });
});
