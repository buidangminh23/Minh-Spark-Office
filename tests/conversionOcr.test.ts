import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { normalizeOcrPage, recognizeImage } from '../src/lib/conversionOcr.ts';

const asset = (name: string) => new URL(`../public/ocr/${name}`, import.meta.url);

test('bundled English and Vietnamese OCR models match their pinned source hashes', () => {
  const models = {
    'eng.traineddata': '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
    'vie.traineddata': '79df64caf7bcfb2a27df5042ecb6121e196eada34da774956995747636d5bfa1',
  };
  for (const [name, hash] of Object.entries(models)) assert.equal(createHash('sha256').update(readFileSync(asset(name))).digest('hex'), hash);
});

test('all three browser WASM capabilities have a bundled LSTM runtime', () => {
  for (const variant of ['', '-simd', '-relaxedsimd']) {
    const name = `tesseract-core${variant}-lstm.wasm.js`;
    const local = readFileSync(asset(name));
    assert.deepEqual(local, readFileSync(new URL(`../node_modules/tesseract.js-core/${name}`, import.meta.url)));
  }
  assert.deepEqual(readFileSync(asset('worker.min.js')), readFileSync(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url)));
});

test('real offline OCR recognizes bilingual text, numbers, and positioned words', { timeout: 30_000 }, async () => {
  const worker = await createWorker(['vie', 'eng'], OEM.LSTM_ONLY, {
    langPath: fileURLToPath(new URL('../public/ocr/', import.meta.url)), gzip: false, cacheMethod: 'none',
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const { data } = await worker.recognize(readFileSync(new URL('./fixtures/ocr-bilingual.png', import.meta.url)), {}, { text: true, blocks: true });
    const page = normalizeOcrPage(data, 1200, 280);
    assert.match(page.text, /MINH SPARK OFFICE 12345/);
    assert.match(page.text, /Tiếng Việt/);
    assert.match(page.text, /Chuyển đổi tài liệu/);
    assert.ok(page.confidence > 70);
    assert.equal(page.lines.length, 2);
    assert.ok(page.lines[0].words.length >= 4);
    assert.ok(page.lines[0].bbox.y0 < page.lines[1].bbox.y0);
    assert.ok(page.lines.every((line) => line.bbox.x1 > line.bbox.x0 && line.bbox.y1 > line.bbox.y0));
  } finally {
    await worker.terminate();
  }
});

test('pre-aborted OCR never loads an image or starts a worker', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(recognizeImage(new Blob(), { signal: controller.signal }), { name: 'AbortError' });
});
