import type { Page, Worker as OcrWorker } from 'tesseract.js';
import { checkConversionAbort, type ConversionOptions } from './conversionTypes';

export type OcrBox = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; bbox: OcrBox; confidence: number };
export type OcrLine = OcrWord & { words: OcrWord[] };
export type OcrPage = { text: string; width: number; height: number; confidence: number; lines: OcrLine[]; words: OcrWord[] };

const MAX_OCR_PIXELS = 25_000_000;
const IDLE_TIMEOUT = 30_000;
let activeWorker: OcrWorker | null = null;
let startingWorker: Promise<OcrWorker> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
let progress: ConversionOptions['onProgress'];
let idleTimer: ReturnType<typeof setTimeout> | undefined;

const abortError = () => new DOMException('Đã hủy nhận dạng văn bản.', 'AbortError');

export function normalizeOcrPage(data: Pick<Page, 'text' | 'confidence' | 'blocks'>, width: number, height: number): OcrPage {
  const lines = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
    .filter((line) => line.text.trim())
    .map((line) => ({
      text: line.text.trim(), bbox: { ...line.bbox }, confidence: line.confidence,
      words: line.words.filter((word) => word.text.trim()).map((word) => ({ text: word.text, bbox: { ...word.bbox }, confidence: word.confidence })),
    }));
  return { text: data.text.trim(), width, height, confidence: data.confidence, lines, words: lines.flatMap((line) => line.words) };
}

export async function releaseConversionOcr(): Promise<void> {
  generation += 1;
  clearTimeout(idleTimer);
  idleTimer = undefined;
  progress = undefined;
  const worker = activeWorker;
  activeWorker = null;
  if (worker) await worker.terminate();
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal, onAbort?: () => void): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) { onAbort?.(); void promise.catch(() => {}); return Promise.reject(signal.reason ?? abortError()); }
  return new Promise<T>((resolve, reject) => {
    const cancel = () => { onAbort?.(); reject(signal.reason ?? abortError()); };
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}

async function getWorker(): Promise<OcrWorker> {
  clearTimeout(idleTimer);
  if (activeWorker) return activeWorker;
  if (!startingWorker) {
    const startGeneration = generation;
    startingWorker = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const base = new URL('/ocr/', window.location.href).href;
      const worker = await createWorker(['vie', 'eng'], OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`, corePath: base, langPath: base.replace(/\/$/, ''),
        gzip: false, workerBlobURL: false, cacheMethod: 'none',
        logger: (message) => {
          const label = message.status === 'recognizing text' ? 'Đang nhận dạng chữ Việt và Anh' : 'Đang chuẩn bị OCR';
          progress?.(`${label} (${Math.round(message.progress * 100)}%)`);
        },
        errorHandler: () => {},
      });
      if (generation !== startGeneration) { await worker.terminate(); throw abortError(); }
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
        if (generation !== startGeneration) throw abortError();
        activeWorker = worker;
        return worker;
      } catch (error) {
        await worker.terminate();
        throw error;
      }
    })().finally(() => { startingWorker = null; });
  }
  return startingWorker;
}

async function prepareImage(source: string | Blob, options: ConversionOptions): Promise<HTMLCanvasElement> {
  if (typeof source === 'string' && !/^(data:image\/|blob:)/i.test(source)) throw new Error('OCR chỉ nhận ảnh đã mở trên thiết bị.');
  if (source instanceof Blob && source.size > 50 * 1024 * 1024) throw new Error('Ảnh OCR vượt 50 MB. Hãy giảm kích thước ảnh trước.');
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const image = new Image();
  image.src = url;
  try {
    await abortable(image.decode(), options.signal, () => { image.src = ''; });
    checkConversionAbort(options);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > MAX_OCR_PIXELS || Math.max(width, height) > 12_000) {
      throw new Error('Ảnh OCR quá lớn hoặc không hợp lệ. Giới hạn 25 triệu điểm ảnh và 12.000 px mỗi cạnh.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không khởi tạo được ảnh để nhận dạng chữ.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    image.src = '';
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

export function recognizeImage(source: string | Blob, options: ConversionOptions = {}): Promise<OcrPage> {
  if (options.signal?.aborted) return Promise.reject(options.signal.reason ?? abortError());
  const task = queue.catch(() => {}).then(async () => {
    checkConversionAbort(options);
    clearTimeout(idleTimer);
    progress = options.onProgress;
    let canvas: HTMLCanvasElement | undefined;
    try {
      canvas = await prepareImage(source, options);
      const worker = await abortable(getWorker(), options.signal, () => { void releaseConversionOcr(); });
      checkConversionAbort(options);
      const result = await abortable(worker.recognize(canvas, {}, { text: true, blocks: true }), options.signal, () => { void releaseConversionOcr(); });
      checkConversionAbort(options);
      return normalizeOcrPage(result.data, canvas.width, canvas.height);
    } catch (error) {
      await releaseConversionOcr();
      if (options.signal?.aborted) throw options.signal.reason ?? abortError();
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new Error(`Không nhận dạng được chữ: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      progress = undefined;
      idleTimer = setTimeout(() => { void releaseConversionOcr(); }, IDLE_TIMEOUT);
    }
  });
  queue = task;
  return abortable(task, options.signal);
}
