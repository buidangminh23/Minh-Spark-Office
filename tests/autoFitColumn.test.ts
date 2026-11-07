import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CELL_TEXT_PADDING_PX,
  cellFontCss,
  keepWidestColumn,
  requiredColumnWidthPx,
  shouldWidenColumn,
} from '../src/editors/sheet/autoFitColumn';

const sevenPxPerChar = (text: string) => text.length * 7;
const baseFont = { sizePt: 11, family: 'Arial', bold: false, italic: false };

test('cellFontCss converts points to pixels and keeps bold and italic', () => {
  assert.equal(cellFontCss(baseFont), `${11 * (96 / 72)}px Arial`);
  assert.equal(cellFontCss({ ...baseFont, bold: true, italic: true }), `italic bold ${11 * (96 / 72)}px Arial`);
});

test('requiredColumnWidthPx uses the widest line plus padding', () => {
  assert.equal(requiredColumnWidthPx('LOẠI TÀI KHOẢN', baseFont, sevenPxPerChar), 14 * 7 + CELL_TEXT_PADDING_PX);
  assert.equal(requiredColumnWidthPx('GÓI\nTHỜI HẠN SỬ DỤNG', baseFont, sevenPxPerChar), 16 * 7 + CELL_TEXT_PADDING_PX);
});

test('shouldWidenColumn only widens for text that overflows', () => {
  assert.equal(shouldWidenColumn('THỜI HẠN SỬ DỤNG', 140, 88), true);
  assert.equal(shouldWidenColumn('GÓI', 40, 88), false);
  assert.equal(shouldWidenColumn('   ', 200, 88), false);
});

test('keepWidestColumn never shrinks a column the user made wider', () => {
  assert.equal(keepWidestColumn(220, 140), 220);
  assert.equal(keepWidestColumn(88, 140), 140);
});
