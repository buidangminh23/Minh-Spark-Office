import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEditableBackground } from '../src/lib/ocr/editableBackground';

type Color = [number, number, number];
function raster(width = 120, height = 80, color: Color = [240, 230, 210]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) data.set([...color, 255], index * 4);
  return { width, height, data };
}
function fill(image: ReturnType<typeof raster>, x0: number, y0: number, x1: number, y1: number, color: Color) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) image.data.set([...color, 255], (y * image.width + x) * 4);
}
const line = { text: 'Tiếng Việt 45,75', bbox: { x0: 20, y0: 25, x1: 100, y1: 46 }, confidence: 95 };
const colorAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];

test('editable OCR removes glyph ink on colored paper and leaves all outside pixels unchanged', () => {
  const image = raster();
  fill(image, 24, 28, 29, 42, [15, 15, 15]);
  fill(image, 40, 28, 45, 42, [15, 15, 15]);
  fill(image, 78, 28, 84, 42, [15, 15, 15]);
  const original = image.data.slice();
  const result = prepareEditableBackground(image, [line], 600, 400);
  assert.deepEqual(image.data, original);
  assert.deepEqual(colorAt(result.pixels, 120, 25, 30), [240, 230, 210, 255]);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) {
    if (x < 20 || x >= 100 || y < 25 || y >= 46) assert.deepEqual(colorAt(result.pixels, 120, x, y), colorAt(original, 120, x, y));
  }
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].text, line.text);
  assert.equal(result.lines[0].x, 120);
  assert.ok(result.lines[0].fontSize > 0);
});

test('editable OCR preserves crossing table rules while clearing text ink', () => {
  const image = raster();
  fill(image, 0, 25, 120, 27, [0, 0, 0]);
  fill(image, 60, 0, 62, 80, [0, 0, 0]);
  fill(image, 25, 30, 30, 43, [20, 20, 20]);
  fill(image, 75, 30, 80, 43, [20, 20, 20]);
  const result = prepareEditableBackground(image, [line], 120, 80);
  for (let x = 0; x < 120; x++) assert.deepEqual(colorAt(result.pixels, 120, x, 25), [0, 0, 0, 255]);
  for (let y = 0; y < 80; y++) assert.deepEqual(colorAt(result.pixels, 120, 60, y), [0, 0, 0, 255]);
  assert.deepEqual(colorAt(result.pixels, 120, 26, 34), [240, 230, 210, 255]);
  assert.deepEqual(colorAt(result.pixels, 120, 77, 34), [240, 230, 210, 255]);
});

test('editable OCR retains a differently colored stamp inside an OCR box', () => {
  const image = raster();
  fill(image, 25, 28, 30, 43, [10, 10, 10]);
  fill(image, 40, 28, 45, 43, [10, 10, 10]);
  fill(image, 55, 28, 60, 43, [10, 10, 10]);
  fill(image, 80, 31, 85, 38, [190, 15, 15]);
  const result = prepareEditableBackground(image, [line], 120, 80);
  assert.deepEqual(colorAt(result.pixels, 120, 82, 33), [190, 15, 15, 255]);
  assert.deepEqual(colorAt(result.pixels, 120, 26, 33), [240, 230, 210, 255]);
  assert.ok(result.warnings.some((warning) => warning.includes('vùng màu')));
});

test('editable OCR clips boxes and rejects invalid raster dimensions', () => {
  const image = raster();
  fill(image, 0, 1, 3, 8, [20, 20, 20]);
  const result = prepareEditableBackground(image, [{ ...line, bbox: { x0: -15, y0: -8, x1: 10, y1: 15 } }, { ...line, bbox: { x0: 150, y0: 0, x1: 170, y1: 20 } }], 120, 80);
  assert.equal(result.lines.length, 1);
  assert.ok(result.lines[0].x >= 0 && result.lines[0].y >= 0);
  assert.equal(result.pixels.length, image.data.length);
  assert.throws(() => prepareEditableBackground({ ...image, width: 0 }, [line], 120, 80), /không hợp lệ/);
});

test('editable OCR interpolates shaded paper instead of whitening its text region', () => {
  const image = raster();
  for (let y = 0; y < image.height; y++) fill(image, 0, y, image.width, y + 1, [180 + y / 2, 170 + y / 2, 160 + y / 2]);
  const original = image.data.slice();
  fill(image, 25, 29, 30, 43, [10, 10, 10]);
  const result = prepareEditableBackground(image, [line], 120, 80);
  const expected = colorAt(original, 120, 26, 34);
  const actual = colorAt(result.pixels, 120, 26, 34);
  assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) <= 3));
});

test('editable OCR does not create duplicate text where ink cannot be separated', () => {
  const image = raster();
  const result = prepareEditableBackground(image, [line], 120, 80);
  assert.equal(result.lines.length, 0);
  assert.deepEqual(result.pixels, image.data);
  assert.equal(result.warnings.length, 1);
});
