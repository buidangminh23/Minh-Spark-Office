import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFontSize } from '../src/lib/fontSizeStep';

const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 72];

test('grow moves to the next larger listed size', () => {
  assert.equal(nextFontSize(SIZES, 12, 1), 14);
  assert.equal(nextFontSize(SIZES, 13, 1), 14);
  assert.equal(nextFontSize(SIZES, 72, 1), 82);
});

test('shrink moves to the next smaller listed size and never below the floor', () => {
  assert.equal(nextFontSize(SIZES, 12, -1), 11);
  assert.equal(nextFontSize(SIZES, 13, -1), 12);
  assert.equal(nextFontSize(SIZES, 8, -1), 7);
  assert.equal(nextFontSize(SIZES, 8, -1, 8), 8);
});
