import * as ort from 'onnxruntime-web/wasm';
import { del, get, set } from 'idb-keyval';
import { loadOcrAssets, type AssetCache } from './vietOcrAssets';
import { recognizePage, type OcrRuntime } from './vietOcrEngine';
import type { VietOcrRequest, VietOcrResponse } from './vietOcrProtocol';

type Sessions = Record<'detector' | 'encoder' | 'decoder', ort.InferenceSession>;

const scope = self as unknown as { postMessage(message: VietOcrResponse): void; onmessage: ((event: MessageEvent<VietOcrRequest>) => void) | null };
const cancelled = new Set<number>();
const cache: AssetCache = {
  get: (key) => get<ArrayBuffer>(key),
  set: (key, value) => set(key, value),
  delete: (key) => del(key),
};
let sessions: Promise<Sessions> | null = null;

function loadSessions(base: string, id: number): Promise<Sessions> {
  sessions ??= (async () => {
    const assets = await loadOcrAssets(base, cache, (loaded, total) => scope.postMessage({ type: 'download', id, loaded, total }));
    ort.env.wasm.wasmBinary = assets.runtime;
    ort.env.wasm.wasmPaths = { mjs: new URL('/ocr/runtime/ort-wasm-simd-threaded.mjs', self.location.href).href };
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ort.env.wasm.proxy = false;
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    return {
      detector: await ort.InferenceSession.create(new Uint8Array(assets.detector), options),
      encoder: await ort.InferenceSession.create(new Uint8Array(assets.encoder), options),
      decoder: await ort.InferenceSession.create(new Uint8Array(assets.decoder), options),
    };
  })().catch((error: unknown) => { sessions = null; throw error; });
  return sessions;
}

scope.onmessage = async (event) => {
  const request = event.data;
  if (request.type === 'cancel') { cancelled.add(request.id); return; }
  const { id } = request;
  try {
    const loaded = await loadSessions(request.base, id);
    const runtime: OcrRuntime = {
      tensor: (type, data, dims) => new ort.Tensor(type, data, dims),
      run: (name, feeds) => loaded[name].run(feeds as Record<string, ort.Tensor>) as never,
    };
    const page = await recognizePage(runtime, request.image, {
      isCancelled: () => cancelled.has(id),
      onProgress: (done, total) => scope.postMessage({ type: 'lines', id, done, total }),
    });
    scope.postMessage({ type: 'result', id, page });
  } catch (error) {
    const aborted = cancelled.has(id) || (error instanceof DOMException && error.name === 'AbortError');
    scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error), aborted });
  } finally {
    cancelled.delete(id);
  }
};
