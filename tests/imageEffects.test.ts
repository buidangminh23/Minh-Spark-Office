import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyArtEffect, dataUrlBytes, hasTransparency, removeBackground, setOpacity, targetSize, type Pixels } from '../src/editors/doc/imageEffects';

const image = (width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = paint(x, y);
    data.set([r, g, b, 255], (y * width + x) * 4);
  }
  return { data, width, height };
};
const alphaAt = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];

test('removeBackground clears the border-connected background and keeps the subject', () => {
  const p = image(10, 10, (x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 ? [200, 30, 30] : [250, 250, 250]));
  const cleared = removeBackground(p, 18);
  assert.equal(cleared, 100 - 16);
  assert.equal(alphaAt(p, 0, 0), 0);
  assert.equal(alphaAt(p, 4, 4), 255);
});

test('removeBackground keeps an enclosed hole the same color as the background', () => {
  const p = image(9, 9, (x, y) => {
    const ring = x >= 2 && x <= 6 && y >= 2 && y <= 6;
    const hole = x === 4 && y === 4;
    return ring && !hole ? [0, 0, 0] : [255, 255, 255];
  });
  removeBackground(p, 10);
  assert.equal(alphaAt(p, 4, 4), 255);
  assert.equal(alphaAt(p, 0, 8), 0);
});

test('setOpacity scales alpha and hasTransparency detects it', () => {
  const p = image(2, 2, () => [10, 20, 30]);
  assert.equal(hasTransparency(p), false);
  setOpacity(p, 0.5);
  assert.equal(alphaAt(p, 1, 1), 128);
  assert.equal(hasTransparency(p), true);
});

test('negative and poster effects change colors predictably', () => {
  const p = image(1, 1, () => [10, 128, 250]);
  applyArtEffect(p, 'negative');
  assert.deepEqual([...p.data.slice(0, 3)], [245, 127, 5]);
  const q = image(1, 1, () => [10, 100, 240]);
  applyArtEffect(q, 'poster');
  assert.deepEqual([...q.data.slice(0, 3)], [0, 128, 255]);
});

test('pencil sketch turns a flat image white and softEdges fades the border', () => {
  const p = image(6, 6, () => [90, 90, 90]);
  applyArtEffect(p, 'pencil');
  assert.equal(p.data[(2 * 6 + 2) * 4], 255);
  const q = image(40, 40, () => [90, 90, 90]);
  applyArtEffect(q, 'softEdges');
  assert.equal(alphaAt(q, 0, 20), 0);
  assert.equal(alphaAt(q, 20, 20), 255);
});

test('targetSize keeps aspect ratio and never upscales', () => {
  assert.deepEqual(targetSize(4000, 2000, 1600), { width: 1600, height: 800 });
  assert.deepEqual(targetSize(800, 600, 1600), { width: 800, height: 600 });
});

test('dataUrlBytes measures decoded base64 size', () => {
  assert.equal(dataUrlBytes('data:image/png;base64,QUJD'), 3);
  assert.equal(dataUrlBytes('data:image/png;base64,QUI='), 2);
});
