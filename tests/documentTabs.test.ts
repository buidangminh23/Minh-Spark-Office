import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleTarget, gotoTarget, parseTabSession, tabShortcut, withoutTab, withTab, type DocumentTab } from '../src/lib/documentTabs.ts';

const WEB = { mac: false, desktop: false };
const MAC_WEB = { mac: true, desktop: false };
const DESKTOP = { mac: false, desktop: true };
const key = (code: string, options: { key?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}) => ({
  code,
  key: options.key ?? code,
  ctrlKey: options.ctrl ?? false,
  altKey: options.alt ?? false,
  shiftKey: options.shift ?? false,
  metaKey: options.meta ?? false,
});
const tab = (id: string): DocumentTab => ({ id, kind: 'doc', name: `${id}.docx` });

test('web shortcuts use Alt on Windows and Control on macOS', () => {
  assert.deepEqual(tabShortcut(key('BracketRight', { alt: true }), WEB), { type: 'cycle', step: 1 });
  assert.deepEqual(tabShortcut(key('BracketLeft', { alt: true }), WEB), { type: 'cycle', step: -1 });
  assert.deepEqual(tabShortcut(key('Digit1', { alt: true }), WEB), { type: 'goto', index: 0 });
  assert.deepEqual(tabShortcut(key('Digit8', { alt: true }), WEB), { type: 'goto', index: 7 });
  assert.deepEqual(tabShortcut(key('Digit9', { alt: true }), WEB), { type: 'goto', index: 'last' });
  assert.deepEqual(tabShortcut(key('KeyW', { alt: true }), WEB), { type: 'close' });
  assert.deepEqual(tabShortcut(key('KeyT', { alt: true }), WEB), { type: 'home' });
  assert.deepEqual(tabShortcut(key('KeyT', { alt: true, shift: true }), WEB), { type: 'reopen' });
  assert.deepEqual(tabShortcut(key('BracketRight', { ctrl: true }), MAC_WEB), { type: 'cycle', step: 1 });
  assert.deepEqual(tabShortcut(key('KeyW', { ctrl: true }), MAC_WEB), { type: 'close' });
  assert.equal(tabShortcut(key('Digit1', { alt: true }), MAC_WEB), null, 'Option+digit types a character on macOS');
});

test('tab shortcuts leave the editors their own combinations', () => {
  const taken = [
    key('PageDown', { alt: true }),
    key('PageUp', { alt: true }),
    key('PageDown', { ctrl: true }),
    key('KeyQ', { alt: true, key: 'q' }),
    key('KeyM', { alt: true, key: 'm' }),
    key('KeyD', { alt: true, shift: true, key: 'D' }),
    key('KeyT', { ctrl: true, shift: true, key: 'T' }),
    key('KeyW', { ctrl: true, shift: true, key: 'W' }),
    key('Digit1', { ctrl: true, key: '1' }),
    key('BracketLeft', { ctrl: true, key: '[' }),
    key('KeyH', { ctrl: true, alt: true, key: 'h' }),
    key('Digit1', { alt: true, ctrl: true, key: '1' }),
    key('KeyW', { meta: true, key: 'w' }),
  ];
  for (const event of taken) {
    assert.equal(tabShortcut(event, WEB), null, `web ${JSON.stringify(event)}`);
    assert.equal(tabShortcut(event, DESKTOP), null, `desktop ${JSON.stringify(event)}`);
  }
});

test('Ctrl+Tab cycles everywhere and Ctrl+W closes a tab only in the desktop app', () => {
  assert.deepEqual(tabShortcut(key('Tab', { ctrl: true, key: 'Tab' }), WEB), { type: 'cycle', step: 1 });
  assert.deepEqual(tabShortcut(key('Tab', { ctrl: true, shift: true, key: 'Tab' }), DESKTOP), { type: 'cycle', step: -1 });
  assert.deepEqual(tabShortcut(key('KeyW', { ctrl: true, key: 'w' }), DESKTOP), { type: 'close' });
  assert.equal(tabShortcut(key('KeyW', { ctrl: true, key: 'w' }), WEB), null);
});

test('cycling wraps through Home and every document tab', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(cycleTarget(ids, null, 1), 'a');
  assert.equal(cycleTarget(ids, 'c', 1), null);
  assert.equal(cycleTarget(ids, null, -1), 'c');
  assert.equal(cycleTarget(ids, 'missing', 1), 'a');
});

test('numbered shortcuts count Home as the first tab and 9 as the last', () => {
  const ids = ['a', 'b'];
  assert.equal(gotoTarget(ids, 0), null);
  assert.equal(gotoTarget(ids, 2), 'b');
  assert.equal(gotoTarget(ids, 5), undefined);
  assert.equal(gotoTarget(ids, 'last'), 'b');
  assert.equal(gotoTarget([], 'last'), null);
});

test('closing the active tab selects its right neighbour, then the left one, then Home', () => {
  const tabs = [tab('a'), tab('b'), tab('c')];
  assert.deepEqual(withoutTab(tabs, 'b', 'b').active, 'c');
  assert.deepEqual(withoutTab(tabs, 'c', 'c').active, 'b');
  assert.deepEqual(withoutTab([tab('a')], 'a', 'a'), { tabs: [], active: null });
  assert.deepEqual(withoutTab(tabs, 'a', 'c').active, 'c');
  assert.equal(withTab(tabs, { ...tab('b'), name: 'renamed' }).find((item) => item.id === 'b')?.name, 'renamed');
});

test('a saved tab session survives damage and adopts the old single-document key', () => {
  assert.deepEqual(parseTabSession(JSON.stringify({ ids: ['a', 'a', 'b', 7], active: 'b' })), { ids: ['a', 'b'], active: 'b' });
  assert.deepEqual(parseTabSession(JSON.stringify({ ids: ['a'], active: 'gone' })), { ids: ['a'], active: null });
  assert.deepEqual(parseTabSession('{broken', 'legacy'), { ids: ['legacy'], active: 'legacy' });
  assert.deepEqual(parseTabSession(null, 'legacy'), { ids: ['legacy'], active: 'legacy' });
  assert.deepEqual(parseTabSession(JSON.stringify({ ids: ['a'], active: 'a' }), 'legacy'), { ids: ['a', 'legacy'], active: 'a' });
});
