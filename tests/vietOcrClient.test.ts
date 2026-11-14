import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { recognizeImage, releaseConversionOcr } from '../src/lib/conversionOcr.ts';
import { recognizeWithVietOcr, releaseVietOcr, vietOcrAssetBase } from '../src/lib/ocr/vietOcrClient.ts';
import type { VietOcrRequest, VietOcrResponse } from '../src/lib/ocr/vietOcrProtocol.ts';

class FakeWorker {
  static instances: FakeWorker[] = [];
  messages: VietOcrRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<VietOcrResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor() { FakeWorker.instances.push(this); }
  postMessage(message: VietOcrRequest) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  respond(message: VietOcrResponse) { this.onmessage?.({ data: message } as MessageEvent<VietOcrResponse>); }
}

const pixels = () => ({ width: 2, height: 2, data: new Uint8ClampedArray(4).fill(255) });
const recognized = { width: 2, height: 2, confidence: 95, angle: 0, lines: [{ text: 'Tiếng Việt', confidence: 95, bbox: { x0: 0, y0: 0, x1: 2, y1: 2 } }] };

function installBrowser(t: TestContext) {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    Worker: FakeWorker,
    window: { location: { href: 'https://office.example.test/' } },
    Image: class {
      src = '';
      naturalWidth = 2;
      naturalHeight = 2;
      async decode() {}
    },
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(16).fill(255) }) }),
      }),
    },
  };
  FakeWorker.instances = [];
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  t.after(async () => {
    await releaseConversionOcr();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
}

async function waitForWorker(index: number) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const worker = FakeWorker.instances[index];
    if (worker?.messages.length) return worker;
    await setImmediate();
  }
  throw new Error('OCR worker did not receive a request');
}

test('web OCR uses VietOCR and resolves assets from the web origin', async (t) => {
  installBrowser(t);
  assert.equal(vietOcrAssetBase(), 'https://office.example.test/');
  const task = recognizeImage('data:image/png;base64,AA==');
  const worker = await waitForWorker(0);
  const request = worker.messages[0];
  assert.equal(request.type, 'recognize');
  if (request.type !== 'recognize') throw new Error('Expected recognition request');
  assert.equal(request.base, 'https://office.example.test/');
  worker.respond({ type: 'result', id: request.id, page: recognized });
  const result = await task;
  assert.equal(result.engine, 'vietocr');
  assert.equal(result.text, 'Tiếng Việt');
});

test('aborting a stalled download or inference terminates it and allows the next queued image', async (t) => {
  installBrowser(t);
  const abort = new AbortController();
  const first = recognizeImage('data:image/png;base64,AA==', { signal: abort.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const oldWorker = await waitForWorker(0);
  const second = recognizeImage('data:image/png;base64,AQ==');
  abort.abort();
  await rejected;
  assert.equal(oldWorker.terminated, true);
  const nextWorker = await waitForWorker(1);
  oldWorker.onerror?.({ preventDefault() {} } as ErrorEvent);
  assert.equal(nextWorker.terminated, false);
  nextWorker.respond({ type: 'result', id: nextWorker.messages[0].id, page: recognized });
  assert.equal((await second).text, 'Tiếng Việt');
});

test('explicit release stops VietOCR and rejects its pending request without waiting for a worker response', async (t) => {
  installBrowser(t);
  const task = recognizeWithVietOcr(pixels());
  const rejected = assert.rejects(task, { name: 'AbortError' });
  const worker = await waitForWorker(0);
  await releaseConversionOcr();
  await rejected;
  assert.equal(worker.terminated, true);
});

test('pre-aborted VietOCR does not create a worker', async (t) => {
  installBrowser(t);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(recognizeWithVietOcr(pixels(), { signal: abort.signal }), { name: 'AbortError' });
  assert.equal(FakeWorker.instances.length, 0);
  releaseVietOcr();
});
