import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as ort from 'onnxruntime-web';
import { flattenBackground, mapBoxToSource, rotateGray, uprightAngle, type GrayImage } from '../src/lib/ocr/pagePrep.ts';
import { boxesFromProbability, sortReadingOrder } from '../src/lib/ocr/textBoxes.ts';
import { loadOcrAssets, VIETOCR_ASSETS, type AssetCache } from '../src/lib/ocr/vietOcrAssets.ts';
import { decodeTokens, lineInputWidth, recognizePage, splitLongBox, type OcrRuntime } from '../src/lib/ocr/vietOcrEngine.ts';

const publicFile = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/ocr-scan-vi.json', import.meta.url), 'utf8')) as { width: number; height: number; text: string };
const scan = (): GrayImage => ({ width: fixture.width, height: fixture.height, data: new Uint8ClampedArray(gunzipSync(readFileSync(new URL('./fixtures/ocr-scan-vi.gray.gz', import.meta.url)))) });
const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();

function characterErrorRate(actual: string, expected: string): number {
  let previous = Array.from({ length: expected.length + 1 }, (_, index) => index);
  for (let i = 1; i <= actual.length; i++) {
    const current = [i];
    for (let j = 1; j <= expected.length; j++) current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (actual[i - 1] === expected[j - 1] ? 0 : 1)));
    previous = current;
  }
  return previous[expected.length] / expected.length;
}

let runtime: Promise<OcrRuntime> | undefined;
function nodeRuntime(): Promise<OcrRuntime> {
  runtime ??= (async () => {
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
    const sessions = {
      detector: await ort.InferenceSession.create(publicFile('ocr/vietocr/ppocrv6-det-small.onnx'), options),
      encoder: await ort.InferenceSession.create(publicFile('ocr/vietocr/vietocr-encoder.onnx'), options),
      decoder: await ort.InferenceSession.create(publicFile('ocr/vietocr/vietocr-decoder.onnx'), options),
    };
    return {
      tensor: (type, data, dims) => new ort.Tensor(type, data, dims),
      run: (name, feeds) => sessions[name].run(feeds as Record<string, ort.Tensor>) as never,
    };
  })();
  return runtime;
}

test('every Vietnamese OCR asset matches its pinned size and hash', () => {
  for (const asset of VIETOCR_ASSETS) {
    const bytes = publicFile(asset.path);
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.path);
  }
});

test('bundled ONNX runtime files are the exact onnxruntime-web release files', () => {
  const dist = dirname(createRequire(import.meta.url).resolve('onnxruntime-web'));
  assert.deepEqual(publicFile('ocr/vietocr/ort-wasm-simd-threaded.wasm'), readFileSync(join(dist, 'ort-wasm-simd-threaded.wasm')));
  assert.deepEqual(publicFile('ocr/runtime/ort-wasm-simd-threaded.mjs'), readFileSync(join(dist, 'ort-wasm-simd-threaded.mjs')));
});

test('asset loader reuses verified cache entries and rejects corrupted downloads', async () => {
  const store = new Map<string, ArrayBuffer>();
  const cache: AssetCache = { get: async (key) => store.get(key), set: async (key, value) => { store.set(key, value); }, delete: async (key) => { store.delete(key); } };
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async (input: string | URL) => {
    requests++;
    const path = new URL(String(input)).pathname.slice(1);
    return new Response(publicFile(path));
  }) as typeof fetch;
  try {
    const first = await loadOcrAssets('https://office.example/', cache);
    assert.equal(first.encoder.byteLength, VIETOCR_ASSETS.find((asset) => asset.name === 'encoder')!.bytes);
    assert.equal(requests, VIETOCR_ASSETS.length);
    await loadOcrAssets('https://office.example/', cache);
    assert.equal(requests, VIETOCR_ASSETS.length);
    store.clear();
    globalThis.fetch = (async () => new Response(new Uint8Array(VIETOCR_ASSETS[0].bytes))) as typeof fetch;
    await assert.rejects(loadOcrAssets('https://office.example/', cache), /không khớp mã kiểm tra/);
    assert.equal(store.size, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('rotation maps recognized boxes back onto the source page', () => {
  const image: GrayImage = { width: 400, height: 200, data: new Uint8ClampedArray(400 * 200).fill(255) };
  for (const angle of [0, 90, 180, 270, 3.5]) {
    const { geometry } = rotateGray(image, angle);
    const box = mapBoxToSource({ x0: geometry.width / 2 - 10, y0: geometry.height / 2 - 5, x1: geometry.width / 2 + 10, y1: geometry.height / 2 + 5 }, geometry);
    assert.ok(Math.abs((box.x0 + box.x1) / 2 - 200) < 1, `centre x for ${angle}`);
    assert.ok(Math.abs((box.y0 + box.y1) / 2 - 100) < 1, `centre y for ${angle}`);
  }
  const quarter = rotateGray(image, 90).geometry;
  assert.deepEqual([quarter.width, quarter.height], [200, 400]);
});

test('page preparation finds the upright angle of tilted and sideways scans', () => {
  const cleaned = flattenBackground(scan());
  const base = uprightAngle(cleaned);
  for (const turn of [0, 90, 180, 270, 4]) {
    const turned = rotateGray(cleaned, turn).image;
    const found = ((uprightAngle(turned) + turn - base) % 180 + 180) % 180;
    assert.ok(Math.min(found, 180 - found) < 0.6, `turn ${turn} recovered ${found}`);
  }
});

test('text detector post-processing keeps confident regions in reading order', () => {
  const width = 64;
  const height = 32;
  const map = new Float32Array(width * height);
  const fill = (x0: number, y0: number, x1: number, y1: number, value: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) map[y * width + x] = value; };
  fill(40, 4, 60, 10, 0.9);
  fill(4, 5, 30, 11, 0.9);
  fill(4, 20, 50, 26, 0.9);
  fill(52, 22, 60, 24, 0.35);
  const boxes = boxesFromProbability(map, width, height, width * 2, height * 2);
  assert.equal(boxes.length, 3);
  assert.ok(boxes[0].x0 < boxes[1].x0 && boxes[1].y1 < boxes[2].y1);
  assert.ok(boxes.every((box) => box.score > 0.5));
  assert.deepEqual(sortReadingOrder([{ x0: 50, y0: 2, x1: 60, y1: 8 }, { x0: 0, y0: 30, x1: 9, y1: 40 }, { x0: 0, y0: 6, x1: 9, y1: 12 }]).map((box) => box.x0 + box.y0), [6, 52, 30]);
});

test('recognizer helpers decode the VietOCR vocabulary and bound line widths', () => {
  assert.equal(decodeTokens([4, 7, 2]), 'aÀ');
  assert.equal(decodeTokens([0, 1, 3]), '');
  assert.equal(lineInputWidth(10, 40), 32);
  assert.equal(lineInputWidth(400, 40), 320);
  assert.equal(lineInputWidth(4000, 40), 512);
  const page: GrayImage = { width: 1000, height: 20, data: new Uint8ClampedArray(1000 * 20).fill(255) };
  const parts = splitLongBox(page, { x0: 0, y0: 0, x1: 1000, y1: 20 });
  assert.ok(parts.length > 1 && parts.every((part) => (part.x1 - part.x0) / 20 <= 22));
  assert.equal(parts[0].x0, 0);
  assert.equal(parts.at(-1)!.x1, 1000);
});

test('VietOCR reads a shaded Vietnamese scan with tones and numbers', { timeout: 180_000 }, async () => {
  const page = await recognizePage(await nodeRuntime(), scan());
  const text = normalize(page.lines.map((line) => line.text).join('\n'));
  assert.ok(characterErrorRate(text, normalize(fixture.text)) < 0.03, text);
  assert.match(text, /Ông Nguyễn Văn Hùng - Giám sát thi công/);
  assert.match(text, /45,75 m3/);
  assert.ok(page.confidence > 80);
  assert.ok(page.lines.every((line) => line.bbox.x1 > line.bbox.x0 && line.bbox.x1 <= fixture.width && line.bbox.y1 <= fixture.height));
});

test('VietOCR turns an upside-down scan back before reading it', { timeout: 180_000 }, async () => {
  const flipped = rotateGray(scan(), 180).image;
  const page = await recognizePage(await nodeRuntime(), flipped);
  const text = normalize(page.lines.map((line) => line.text).join('\n'));
  assert.ok(Math.abs(((page.angle % 360) + 360) % 360 - 180) < 5, String(page.angle));
  assert.ok(characterErrorRate(text, normalize(fixture.text)) < 0.03, text);
});
