import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickFreeColor } from '../src/lib/live/caretColors';

const PALETTE = ['#111111', '#222222', '#333333'];

describe('caret colors', () => {
  it('keeps the preferred color when nobody else uses it', () => {
    assert.equal(pickFreeColor('#222222', new Set(['#111111']), PALETTE), '#222222');
  });

  it('moves to the next free color after a clash', () => {
    assert.equal(pickFreeColor('#222222', new Set(['#222222']), PALETTE), '#333333');
    assert.equal(pickFreeColor('#333333', new Set(['#333333', '#111111']), PALETTE), '#222222');
  });

  it('jumps three places on a ten-color palette so neighbours do not look alike', () => {
    const palette = Array.from({ length: 10 }, (_, index) => String(index));
    assert.equal(pickFreeColor('7', new Set(['7']), palette), '0');
    assert.equal(pickFreeColor('7', new Set(['7', '0']), palette), '3');
  });

  it('falls back to the preferred color when the palette is exhausted', () => {
    assert.equal(pickFreeColor('#111111', new Set(PALETTE), PALETTE), '#111111');
  });
});
