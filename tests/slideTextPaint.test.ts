import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { backgroundColor, fontMetrics, paintAndErase, rgbHex, segmentsFromOcr, segmentsFromTextItems, type PixelImage, type Rgb } from '../src/lib/slideTextPaint';
import { fillEditableDeck } from '../src/lib/editableSlidesDeck';

const BACKGROUND: Rgb = [248, 250, 252];
const INK: Rgb = [21, 133, 191];

function blankImage(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set([...BACKGROUND, 255], offset);
  return { data, width, height };
}

function fill(image: PixelImage, x: number, y: number, width: number, height: number, color: Rgb) {
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) image.data.set([...color, 255], (row * image.width + column) * 4);
}

function glyphs(image: PixelImage, x: number, y: number, count: number, stroke: number, height: number) {
  for (let index = 0; index < count; index++) {
    fill(image, x + index * 30, y, stroke, height, INK);
    fill(image, x + index * 30 + 14, y, stroke, height, INK);
  }
}

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

test('background colour is read from the ring around a text box', () => {
  const image = blankImage(200, 100);
  fill(image, 40, 40, 60, 20, INK);
  assert.deepEqual(backgroundColor(image, { x: 40, y: 40, width: 60, height: 20 }, 4), BACKGROUND);
});

test('font size follows ink height and descenders', () => {
  assert.equal(Math.round(fontMetrics('ABC', 72).fontPx), 100);
  assert.equal(Math.round(fontMetrics('Apply', 93).fontPx), 100);
});

test('painting a line keeps its colour, marks bold strokes and erases it from the background', () => {
  const image = blankImage(400, 200);
  glyphs(image, 20, 20, 3, 8, 36);
  glyphs(image, 20, 120, 3, 3, 36);
  const lines = paintAndErase(image, [
    { text: 'Bold', box: { x: 18, y: 18, width: 100, height: 40 } },
    { text: 'Thin', box: { x: 18, y: 118, width: 100, height: 40 } },
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].color, INK);
  assert.equal(lines[0].runs[0].bold, true);
  assert.equal(lines[1].runs[0].bold, false);
  assert.equal(rgbHex(lines[0].color), '1585BF');
  for (let offset = 0; offset < image.data.length; offset += 4) assert.deepEqual([...image.data.subarray(offset, offset + 3)], BACKGROUND);
});

test('OCR lines split at column gaps and drop icon symbols and doubtful words', () => {
  const segments = segmentsFromOcr([{
    text: 'built = Environment: Local',
    bbox: box(0, 0, 900, 40),
    words: [
      { text: 'built', bbox: box(0, 0, 80, 36), confidence: 95 },
      { text: '=', bbox: box(500, 4, 530, 34), confidence: 50 },
      { text: 'Environment:', bbox: box(545, 0, 760, 36), confidence: 93 },
      { text: 'Local', bbox: box(775, 0, 860, 36), confidence: 96 },
      { text: 'seen,', bbox: box(870, 0, 900, 90), confidence: 91 },
    ],
  }, { text: 'EN,', bbox: box(0, 100, 30, 112), words: [{ text: 'EN,', bbox: box(0, 100, 30, 112), confidence: 21 }] }]);
  assert.deepEqual(segments.map((segment) => segment.text), ['built', 'Environment: Local']);
});

test('PDF text items merge into lines but keep separate columns apart', () => {
  const segments = segmentsFromTextItems([
    { text: 'Project', x: 10, y: 10, width: 50, height: 12 },
    { text: 'Scope', x: 64, y: 10, width: 40, height: 12 },
    { text: 'Core', x: 300, y: 10, width: 30, height: 12 },
  ], 2);
  assert.deepEqual(segments.map((segment) => [segment.text, segment.box.x]), [['Project Scope', 20], ['Core', 600]]);
});

test('editable deck puts the page as background and the text as positioned boxes', async () => {
  const image = blankImage(400, 225);
  glyphs(image, 40, 40, 3, 8, 36);
  const lines = paintAndErase(image, [{ text: 'Title', box: { x: 38, y: 38, width: 100, height: 40 } }]);
  const background = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const deck = fillEditableDeck(new PptxGenJS(), [{ width: 400, height: 225, scale: 1, background, lines }], 'Deck');
  const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }) as Buffer);
  const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(slide, /<p:bg>/);
  assert.match(slide, />Title</);
  assert.match(slide, /b="1"/);
  assert.match(slide, /1585BF/);
  assert.match(await zip.file('ppt/presentation.xml')!.async('string'), /cx="12192000" cy="6858000"/);
});

test('short standalone marks stay in the page image instead of becoming text', () => {
  const image = blankImage(200, 100);
  glyphs(image, 20, 20, 2, 8, 36);
  assert.deepEqual(paintAndErase(image, [{ text: 'ao', box: { x: 18, y: 18, width: 60, height: 40 } }]), []);
  assert.equal(image.data[(30 * 200 + 22) * 4], INK[0]);
});

test('text wider than the original ink shrinks to fit', () => {
  const image = blankImage(400, 100);
  glyphs(image, 20, 20, 3, 4, 36);
  const [line] = paintAndErase(image, [{ text: 'Wide title', box: { x: 18, y: 18, width: 100, height: 40 } }], (text, fontPx) => text.length * fontPx);
  assert.ok(Math.abs(line.runs.reduce((sum, run) => sum + run.text.length, 0) * line.fontPx - line.ink.width) < 0.01);
});
