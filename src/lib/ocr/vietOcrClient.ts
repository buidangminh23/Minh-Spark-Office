import type { GrayImage } from './pagePrep';
import type { RecognizedPage } from './vietOcrEngine';
import type { VietOcrRequest, VietOcrResponse } from './vietOcrProtocol';
import { DESKTOP_ASSET_ORIGIN } from './vietOcrAssets';

const WORKER_IDLE_MS = 60_000;
const MEGABYTE = 1024 * 1024;

type Job = { resolve: (page: RecognizedPage) => void; reject: (error: Error) => void; onProgress?: (message: string) => void };

let worker: Worker | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const jobs = new Map<number, Job>();

const abortError = () => new DOMException('Đã hủy nhận dạng văn bản.', 'AbortError');

export function releaseVietOcr(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  worker?.terminate();
  worker = null;
  const waiting = [...jobs.values()];
  jobs.clear();
  waiting.forEach((job) => job.reject(abortError()));
}

function scheduleIdleStop() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = jobs.size ? null : setTimeout(releaseVietOcr, WORKER_IDLE_MS);
}

function handleMessage(event: MessageEvent<VietOcrResponse>) {
  const message = event.data;
  const job = jobs.get(message.id);
  if (!job) return;
  if (message.type === 'download') {
    job.onProgress?.(`Đang tải bộ đọc chữ tiếng Việt lần đầu (${Math.round(message.loaded / MEGABYTE)}/${Math.round(message.total / MEGABYTE)} MB)`);
    return;
  }
  if (message.type === 'lines') {
    job.onProgress?.(`Đang đọc chữ tiếng Việt (dòng ${message.done}/${message.total})`);
    return;
  }
  jobs.delete(message.id);
  scheduleIdleStop();
  if (message.type === 'result') job.resolve(message.page);
  else job.reject(message.aborted ? abortError() : new Error(message.message));
}

function startWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL('./vietOcrWorker.ts', import.meta.url), { type: 'module', name: 'vietnamese-ocr' });
  created.onmessage = (event) => { if (worker === created) handleMessage(event); };
  created.onerror = (event) => {
    event.preventDefault();
    if (worker !== created) return;
    const waiting = [...jobs.values()];
    jobs.clear();
    worker?.terminate();
    worker = null;
    waiting.forEach((job) => job.reject(new Error('Bộ đọc chữ tiếng Việt dừng bất thường.')));
  };
  worker = created;
  return created;
}

export function vietOcrAssetBase(): string {
  const desktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return desktop ? DESKTOP_ASSET_ORIGIN : new URL('/', window.location.href).href;
}

export function recognizeWithVietOcr(image: GrayImage, options: { signal?: AbortSignal; onProgress?: (message: string) => void } = {}): Promise<RecognizedPage> {
  if (options.signal?.aborted) return Promise.reject(options.signal.reason ?? abortError());
  const id = nextId++;
  const active = startWorker();
  if (idleTimer) clearTimeout(idleTimer);
  return new Promise<RecognizedPage>((resolve, reject) => {
    const cancel = () => { if (jobs.has(id)) releaseVietOcr(); };
    options.signal?.addEventListener('abort', cancel, { once: true });
    const done = () => options.signal?.removeEventListener('abort', cancel);
    jobs.set(id, {
      onProgress: options.onProgress,
      resolve: (page) => { done(); resolve(page); },
      reject: (error) => { done(); reject(error); },
    });
    try {
      active.postMessage({ type: 'recognize', id, base: vietOcrAssetBase(), image } satisfies VietOcrRequest, [image.data.buffer]);
    } catch (error) {
      jobs.delete(id);
      done();
      scheduleIdleStop();
      reject(error);
    }
  });
}
