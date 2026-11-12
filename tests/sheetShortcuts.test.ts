import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXCEL_NUMBER_FORMATS,
  SHEET_SHORTCUT_HELP,
  clampIndex,
  formatClockTime,
  isNumberFormatAction,
  resolveSheetShortcut,
  structureScope,
} from '../src/editors/sheet/sheetShortcuts';

const press = (code: string, mods = '') => ({
  code,
  key: code,
  ctrlKey: mods.includes('C'),
  metaKey: mods.includes('M'),
  altKey: mods.includes('A'),
  shiftKey: mods.includes('S'),
});

test('navigation keys follow Excel', () => {
  assert.equal(resolveSheetShortcut(press('Home', 'C')), 'gotoStart');
  assert.equal(resolveSheetShortcut(press('End', 'C')), 'gotoEnd');
  assert.equal(resolveSheetShortcut(press('Home')), 'rowStart');
  assert.equal(resolveSheetShortcut(press('PageDown', 'C')), 'nextSheet');
  assert.equal(resolveSheetShortcut(press('PageUp', 'C')), 'prevSheet');
  assert.equal(resolveSheetShortcut(press('PageDown', 'A')), 'pageRight');
  assert.equal(resolveSheetShortcut(press('Space', 'S')), 'selectRow');
  assert.equal(resolveSheetShortcut(press('Space', 'C')), 'selectColumn');
  assert.equal(resolveSheetShortcut(press('End', 'CS')), 'extendToEnd');
});

test('number format keys map to Excel patterns', () => {
  assert.equal(resolveSheetShortcut(press('Backquote', 'CS')), 'formatGeneral');
  assert.equal(resolveSheetShortcut(press('Digit1', 'CS')), 'formatNumber');
  assert.equal(resolveSheetShortcut(press('Digit5', 'CS')), 'formatPercent');
  assert.equal(EXCEL_NUMBER_FORMATS.formatNumber, '#,##0.00');
  assert.equal(isNumberFormatAction('formatDate'), true);
  assert.equal(isNumberFormatAction('bold'), false);
});

test('structure and editing keys', () => {
  assert.equal(resolveSheetShortcut(press('Equal', 'CS')), 'insertCells');
  assert.equal(resolveSheetShortcut(press('Minus', 'C')), 'deleteCells');
  assert.equal(resolveSheetShortcut(press('Minus', 'CS')), 'borderNone');
  assert.equal(resolveSheetShortcut(press('Digit0', 'C')), 'hideColumns');
  assert.equal(resolveSheetShortcut(press('Digit0', 'CS')), 'unhideColumns');
  assert.equal(resolveSheetShortcut(press('Digit9', 'CS')), 'unhideRows');
  assert.equal(resolveSheetShortcut(press('KeyV', 'CS')), 'pasteValues');
  assert.equal(resolveSheetShortcut(press('KeyV', 'CA')), 'pasteSpecial');
  assert.equal(resolveSheetShortcut(press('Quote', 'C')), 'copyFormulaAbove');
  assert.equal(resolveSheetShortcut(press('Quote', 'CS')), 'copyValueAbove');
  assert.equal(resolveSheetShortcut(press('KeyZ', 'MS')), 'redo');
});

test('function keys', () => {
  assert.equal(resolveSheetShortcut(press('F5')), 'goTo');
  assert.equal(resolveSheetShortcut(press('F3', 'S')), 'insertFunction');
  assert.equal(resolveSheetShortcut(press('F9')), 'recalculate');
  assert.equal(resolveSheetShortcut(press('F12')), 'saveAs');
  assert.equal(resolveSheetShortcut(press('F11', 'S')), 'newSheet');
  assert.equal(resolveSheetShortcut(press('F11')), 'insertChart');
  assert.equal(resolveSheetShortcut(press('F2', 'S')), 'editNote');
});

test('keys owned by the grid or the browser stay untouched', () => {
  for (const [code, mods] of [['KeyC', 'C'], ['KeyV', 'C'], ['KeyZ', 'C'], ['KeyA', 'C'], ['F2', ''], ['F4', ''], ['Digit9', 'C'], ['Digit1', 'C'], ['KeyS', 'C'], ['Enter', ''], ['KeyA', '']] as const) {
    assert.equal(resolveSheetShortcut(press(code, mods)), null, `${mods}+${code}`);
  }
});

test('structureScope tells whole rows, whole columns and cell blocks apart', () => {
  assert.equal(structureScope({ startRow: 3, endRow: 4, startColumn: 0, endColumn: 25 }, 1000, 26), 'rows');
  assert.equal(structureScope({ startRow: 0, endRow: 999, startColumn: 2, endColumn: 2 }, 1000, 26), 'columns');
  assert.equal(structureScope({ startRow: 3, endRow: 4, startColumn: 1, endColumn: 2 }, 1000, 26), 'cells');
  assert.equal(structureScope({ startRow: 0, endRow: 999, startColumn: 0, endColumn: 25 }, 1000, 26), 'cells');
});

test('helpers', () => {
  assert.equal(clampIndex(-5, 100), 0);
  assert.equal(clampIndex(250, 100), 99);
  assert.equal(formatClockTime(new Date(2026, 10, 12, 7, 5)), '07:05');
  assert.ok(SHEET_SHORTCUT_HELP.length >= 45);
  assert.equal(new Set(SHEET_SHORTCUT_HELP.map(([keys]) => keys)).size, SHEET_SHORTCUT_HELP.length);
});
