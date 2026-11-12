import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/lib/appSettings';
import { SHEET_DEFAULTS, type SheetTab } from '../src/lib/settings/sheetDefaults';
import { SHEET_QAT_LABELS, SHEET_TAB_LABELS } from '../src/lib/settings/sheetMeta';
import {
  MAX_NEW_SHEET_COUNT,
  clampSheetCount,
  enterMoveDirection,
  isBlankWorkbook,
  isFreshBlankWorkbook,
  isSheetTabVisible,
  withSheetCount,
} from '../src/editors/sheet/sheetSettings';
import { emptyWorkbook } from '../src/lib/workbookBasics';

test('sheet defaults are part of app settings and keep today behaviour', () => {
  for (const [key, value] of Object.entries(SHEET_DEFAULTS)) {
    assert.ok(key.startsWith('sheet'), key);
    assert.deepEqual(DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS], value);
  }
  assert.equal(SHEET_DEFAULTS.sheetEnterMove, true);
  assert.equal(SHEET_DEFAULTS.sheetEnterDirection, 'down');
  assert.equal(SHEET_DEFAULTS.sheetNewSheetCount, 1);
  assert.equal(SHEET_DEFAULTS.sheetQatShow, false);
  assert.ok(Object.values(SHEET_DEFAULTS.sheetTabs).every(Boolean));
});

test('every ribbon tab and quick access command has a label', () => {
  assert.deepEqual(SHEET_TAB_LABELS.map(([id]) => id).sort(), (Object.keys(SHEET_DEFAULTS.sheetTabs) as SheetTab[]).sort());
  for (const command of SHEET_DEFAULTS.sheetQatCommands) assert.ok(SHEET_QAT_LABELS[command]);
});

test('Enter moves in the chosen direction and Shift+Enter reverses it', () => {
  assert.equal(enterMoveDirection(true, 'down', false), 'down');
  assert.equal(enterMoveDirection(true, 'down', true), 'up');
  assert.equal(enterMoveDirection(true, 'right', false), 'right');
  assert.equal(enterMoveDirection(true, 'right', true), 'left');
  assert.equal(enterMoveDirection(true, 'left', true), 'right');
  assert.equal(enterMoveDirection(false, 'down', false), null);
  assert.equal(enterMoveDirection(false, 'right', true), null);
});

test('File and Home tabs can never be hidden', () => {
  const hidden = { home: false, data: false };
  assert.equal(isSheetTabVisible('file', hidden), true);
  assert.equal(isSheetTabVisible('home', hidden), true);
  assert.equal(isSheetTabVisible('data', hidden), false);
  assert.equal(isSheetTabVisible('view', hidden), true);
});

test('sheet count is clamped to Excel limits', () => {
  assert.equal(clampSheetCount(0), 1);
  assert.equal(clampSheetCount(3.4), 3);
  assert.equal(clampSheetCount(10_000), MAX_NEW_SHEET_COUNT);
  assert.equal(clampSheetCount(Number.NaN), 1);
});

test('only a freshly created, untouched workbook counts as new', () => {
  const blank = emptyWorkbook('Sheet1');
  assert.equal(isBlankWorkbook(blank), true);
  assert.equal(isFreshBlankWorkbook({ createdAt: 1000, updatedAt: 1001 }, blank), true);
  assert.equal(isFreshBlankWorkbook({ createdAt: 1000, updatedAt: 60_000 }, blank), false);
  const sheetId = blank.sheetOrder[0];
  const edited = { ...blank, sheets: { [sheetId]: { ...blank.sheets[sheetId], cellData: { 0: { 0: { v: 'x' } } } } } };
  assert.equal(isFreshBlankWorkbook({ createdAt: 1000, updatedAt: 1000 }, edited), false);
  const styled = { ...blank, styles: { a: { bl: 1 } } };
  assert.equal(isBlankWorkbook(styled), false);
});

test('new workbook gets the requested number of empty sheets with unique names', () => {
  const blank = emptyWorkbook('Sheet1');
  assert.equal(withSheetCount(blank, 1), blank);
  const three = withSheetCount(blank, 3);
  assert.equal(three.sheetOrder.length, 3);
  assert.equal(three.sheetOrder[0], blank.sheetOrder[0]);
  const names = three.sheetOrder.map((id) => three.sheets[id].name);
  assert.deepEqual(names, ['Trang tính 1', 'Trang tính 2', 'Trang tính 3']);
  assert.equal(new Set(three.sheetOrder).size, 3);
  assert.equal(blank.sheetOrder.length, 1);
  const renamed = { ...blank, sheets: { [blank.sheetOrder[0]]: { ...blank.sheets[blank.sheetOrder[0]], name: 'Trang tính 2' } } };
  const two = withSheetCount(renamed, 2);
  assert.deepEqual(two.sheetOrder.map((id) => two.sheets[id].name), ['Trang tính 2', 'Trang tính 3']);
});
