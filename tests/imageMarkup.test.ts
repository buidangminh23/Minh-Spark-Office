import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenEncoding, isMarkupBlank, screenOffsetToImagePoint, type ImageView } from '../src/editors/image/markupMath';

function cssTransform(x: number, y: number, view: ImageView) {
  const localX = (x - view.width / 2) * (view.flipX ? -1 : 1);
  const localY = (y - view.height / 2) * (view.flipY ? -1 : 1);
  const radians = (view.rotation * Math.PI) / 180;
  return {
    x: (localX * Math.cos(radians) - localY * Math.sin(radians)) * view.scale,
    y: (localX * Math.sin(radians) + localY * Math.cos(radians)) * view.scale,
  };
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('screenOffsetToImagePoint inverts the stage transform for every rotation and flip', () => {
  for (const rotation of [0, 90, 180, 270]) {
    for (const flipX of [false, true]) {
      for (const flipY of [false, true]) {
        const view = { scale: 1.5, rotation, flipX, flipY, width: 400, height: 200 };
        for (const [x, y] of [[0, 0], [400, 0], [123, 45], [400, 200]]) {
          const screen = cssTransform(x, y, view);
          const back = screenOffsetToImagePoint(screen.x, screen.y, view);
          assert.ok(close(back.x, x) && close(back.y, y), `${rotation}/${flipX}/${flipY} at ${x},${y}`);
        }
      }
    }
  }
});

test('a click on the screen top-right corner of an image rotated 90 degrees lands on the image top-left', () => {
  const view = { scale: 1, rotation: 90, flipX: false, flipY: false, width: 100, height: 50 };
  const point = screenOffsetToImagePoint(25, -50, view);
  assert.ok(close(point.x, 0) && close(point.y, 0));
});

test('a horizontal flip mirrors clicks back onto the drawn side', () => {
  const view = { scale: 2, rotation: 0, flipX: true, flipY: false, width: 100, height: 100 };
  const point = screenOffsetToImagePoint(-80, 0, view);
  assert.ok(close(point.x, 90) && close(point.y, 50));
});

test('isMarkupBlank detects any visible pixel', () => {
  const pixels = new Uint8ClampedArray(4 * 16);
  assert.equal(isMarkupBlank(pixels), true);
  pixels[4 * 7 + 3] = 1;
  assert.equal(isMarkupBlank(pixels), false);
});

test('flattenEncoding keeps lossy photos lossy and everything else lossless', () => {
  assert.deepEqual(flattenEncoding('image/jpeg'), { mime: 'image/jpeg', quality: 0.95 });
  assert.deepEqual(flattenEncoding('image/webp'), { mime: 'image/webp', quality: 0.95 });
  assert.deepEqual(flattenEncoding('image/gif'), { mime: 'image/png' });
  assert.deepEqual(flattenEncoding(undefined), { mime: 'image/png' });
});
