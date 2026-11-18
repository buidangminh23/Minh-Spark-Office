import { checkConversionAbort, type ConversionOptions } from './conversionTypes';
import type { ImageFrame } from './mediaConversionFrames';
import { MAX_IMAGE_PAGES, checkImageSize, dibAsBitmap } from './mediaConversionRaster';
import { getImageMimeType } from './imageFormats';

function canvasFor(width: number, height: number) {
  checkImageSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
  return { canvas, context };
}

function frameCanvas({ width, height, data, orientation }: ImageFrame, flatten: boolean) {
  const { canvas, context } = canvasFor(width, height);
  context.putImageData(new ImageData(data, width, height), 0, 0);
  if (orientation === 1 && !flatten) return canvas;
  const swap = orientation >= 5 && orientation <= 8;
  const output = canvasFor(swap ? height : width, swap ? width : height);
  if (flatten) {
    output.context.fillStyle = '#fff';
    output.context.fillRect(0, 0, output.canvas.width, output.canvas.height);
  }
  const transforms: Record<number, [number,number,number,number,number,number]> = {
    2: [-1,0,0,1,width,0], 3: [-1,0,0,-1,width,height], 4: [1,0,0,-1,0,height],
    5: [0,1,1,0,0,0], 6: [0,1,-1,0,height,0], 7: [0,-1,-1,0,height,width], 8: [0,-1,1,0,0,width],
  };
  if (transforms[orientation]) output.context.setTransform(...transforms[orientation]);
  output.context.drawImage(canvas, 0, 0);
  canvas.width = canvas.height = 0;
  return output.canvas;
}

type WorkerReply = { done?: boolean; error?: string; frame?: ImageFrame };
async function* decodedCanvases(file: File, format: string, options: ConversionOptions, flatten: boolean) {
  const buffer = await file.arrayBuffer();
  checkConversionAbort(options);
  const worker = new Worker(new URL('./mediaConversionFrameWorker.ts', import.meta.url), { type: 'module' });
  try {
    let first = true;
    while (true) {
      checkConversionAbort(options);
      const reply = await new Promise<WorkerReply>((resolve, reject) => {
        const abort = () => fail(new DOMException('Đã hủy chuyển đổi.', 'AbortError'));
        const timer = setTimeout(() => fail(new Error('Ảnh quá phức tạp hoặc mất quá nhiều thời gian để giải mã.')), 90_000);
        const clear = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); };
        const fail = (error: Error) => { clear(); reject(error); };
        worker.onerror = (event) => fail(new Error(event.message || 'Không khởi chạy được bộ giải mã ảnh.'));
        worker.onmessage = (event: MessageEvent<WorkerReply>) => { clear(); resolve(event.data); };
        options.signal?.addEventListener('abort', abort, { once: true });
        if (first) worker.postMessage({ buffer, format }, [buffer]);
        else worker.postMessage({ format });
      });
      if (reply.done) return;
      if (!reply.frame) throw new Error(reply.error || 'Không giải mã được trang ảnh.');
      first = false;
      yield frameCanvas(reply.frame, flatten);
    }
  } finally { worker.terminate(); }
}

export async function svgzImage(file: File, options: ConversionOptions) {
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: BlobPart[] = [];
  let size = 0;
  try {
    while (true) {
      checkConversionAbort(options);
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100 * 1024 * 1024) throw new Error('Ảnh SVG sau giải nén vượt 100 MB.');
      chunks.push(value as BlobPart);
    }
  } finally { await reader.cancel(); }
  return new Blob(chunks, { type: 'image/svg+xml' });
}

export async function validatedImageCopy(file: File, target: string, options: ConversionOptions) {
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start: number, count: number) => String.fromCharCode(...bytes.subarray(start, start + count));
  let valid = false;
  switch (target) {
    case 'png': valid = starts(137, 80, 78, 71, 13, 10, 26, 10); break;
    case 'jpg': valid = starts(255, 216, 255); break;
    case 'webp': valid = ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'; break;
    case 'bmp': valid = starts(66, 77) && file.size >= 26; break;
    case 'tiff': valid = starts(73, 73, 42, 0) || starts(77, 77, 0, 42) || starts(73, 73, 43, 0) || starts(77, 77, 0, 43); break;
    case 'gif': valid = ['GIF87a', 'GIF89a'].includes(ascii(0, 6)); break;
    case 'ico': valid = starts(0, 0, 1, 0) && bytes.length >= 6 && view.getUint16(4, true) > 0 && file.size >= 6 + 16 * view.getUint16(4, true); break;
    case 'dib': valid = bytes.length >= 12 && [12, 40, 52, 56, 108, 124].includes(view.getUint32(0, true)) && file.size > view.getUint32(0, true); break;
    case 'avif': case 'heif': case 'heic': {
      if (bytes.length < 16 || ascii(4, 4) !== 'ftyp') break;
      const end = Math.min(bytes.length, view.getUint32(0));
      const brands = [ascii(8, 4)];
      for (let pos = 16; pos + 4 <= end; pos += 4) brands.push(ascii(pos, 4));
      const isAvif = brands.some(brand => /^(avif|avis)$/.test(brand));
      const isHeic = brands.some(brand => /^(heic|heix|heim|heis|hevc|hevx|hevm|hevs)$/.test(brand));
      valid = target === 'avif' ? isAvif : target === 'heic' ? isHeic : isHeic || brands.some(brand => brand === 'mif1' || brand === 'msf1');
      break;
    }
    case 'svg': case 'svgz': {
      const svg = target === 'svgz' ? await svgzImage(file, options) : file;
      const xml = new DOMParser().parseFromString(await svg.text(), 'image/svg+xml');
      valid = xml.documentElement.localName === 'svg' && xml.documentElement.namespaceURI === 'http://www.w3.org/2000/svg';
      break;
    }
  }
  if (!valid) throw new Error(`Dữ liệu tệp không khớp định dạng ${target.toUpperCase()}.`);
  const mime = target === 'heif' ? 'image/heif' : target === 'svgz' ? 'application/gzip' : getImageMimeType(file.name);
  return file.slice(0, file.size, mime);
}

const animationMime: Record<string, string> = { gif: 'image/gif', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

function gifHasMultipleFrames(bytes: Uint8Array) {
  let pos = 13 + (bytes[10] & 128 ? 3 * (2 << (bytes[10] & 7)) : 0);
  let frames = 0;
  while (pos < bytes.length) {
    const marker = bytes[pos++];
    if (marker === 0x21) pos++;
    else if (marker === 0x2c) {
      if (++frames > 1) return true;
      const flags = bytes[pos + 8];
      pos += 10 + (flags & 128 ? 3 * (2 << (flags & 7)) : 0);
    } else break;
    while (pos < bytes.length && bytes[pos]) pos += bytes[pos] + 1;
    pos++;
  }
  return false;
}

async function animationData(file: File, ext: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = (pos: number, length: number) => String.fromCharCode(...bytes.subarray(pos, pos + length));
  const view = new DataView(bytes.buffer);
  if (ext === 'gif') return gifHasMultipleFrames(bytes) ? bytes : null;
  if (ext === 'webp') return text(12, 4) === 'VP8X' && (bytes[20] & 2) ? bytes : null;
  if (ext === 'avif') {
    if (bytes.length < 16 || text(4, 4) !== 'ftyp') return null;
    for (let pos = 8; pos + 4 <= Math.min(bytes.length, view.getUint32(0)); pos += 4) if (text(pos, 4) === 'avis') return bytes;
    return null;
  }
  for (let pos = 8; pos + 12 <= bytes.length; pos += 12 + view.getUint32(pos)) {
    if (text(pos + 4, 4) === 'acTL') return bytes;
    if (text(pos + 4, 4) === 'IDAT') break;
  }
  return null;
}

export type FrameTiming = { index: number; count: number; delay: number; repeat: number };
export async function* imageCanvases(file: File, options: ConversionOptions, flatten: boolean, warnings: string[], keepTiming?: (frame: FrameTiming) => void): AsyncGenerator<HTMLCanvasElement> {
  const ext = file.name.split('.').pop()!.toLowerCase();
  if (['heic', 'heif', 'tif', 'tiff'].includes(ext)) {
    yield* decodedCanvases(file, ext.startsWith('tif') ? 'tiff' : 'heif', options, flatten);
    return;
  }
  if (animationMime[ext]) {
    const data = await animationData(file, ext);
    if (data) {
      const { ImageDecoder } = globalThis;
      if (ImageDecoder && await ImageDecoder.isTypeSupported(animationMime[ext])) {
        const decoder = new ImageDecoder({ data, type: animationMime[ext], preferAnimation: true });
        const cancel = () => decoder.close();
        options.signal?.addEventListener('abort', cancel, { once: true });
        try {
          checkConversionAbort(options);
          await Promise.all([decoder.tracks.ready, decoder.completed]);
          const count = decoder.tracks.selectedTrack?.frameCount;
          if (!count || count > MAX_IMAGE_PAGES) throw new Error('Ảnh động phải có từ 1 đến 200 khung hình.');
          for (let index = 0; index < count; index++) {
            checkConversionAbort(options);
            const { image } = await decoder.decode({ frameIndex: index });
            const { canvas, context } = canvasFor(image.displayWidth, image.displayHeight);
            try {
              if (flatten) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
              context.drawImage(image, 0, 0);
              const repeats = decoder.tracks.selectedTrack!.repetitionCount;
              keepTiming?.({ index, count, delay: (image.duration ?? 100_000) / 1000, repeat: Number.isFinite(repeats) ? repeats || -1 : 0 });
            } finally { image.close(); }
            yield canvas;
          }
          if (!keepTiming) warnings.push('Mỗi khung hình động được xuất thành một trang hoặc ảnh tĩnh theo đúng thứ tự. Thời lượng phát không được lưu.');
          return;
        } finally { options.signal?.removeEventListener('abort', cancel); decoder.close(); }
      }
      warnings.push('Trình duyệt này chỉ đọc được khung hình đầu tiên của ảnh động. Chọn định dạng gốc để giữ toàn bộ chuyển động.');
    }
  }
  const blob = ext === 'svgz' ? await svgzImage(file, options) : ext === 'dib' ? dibAsBitmap(await file.arrayBuffer()) : file.slice(0, file.size, getImageMimeType(file.name));
  const source = URL.createObjectURL(blob);
  const image = new Image();
  try {
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => finish(new DOMException('Đã hủy chuyển đổi.', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('Ảnh không đọc được hoặc quá lớn.')), 30_000);
        const finish = (error?: Error) => {
          clearTimeout(timer);
          image.onload = image.onerror = null;
          options.signal?.removeEventListener('abort', abort);
          if (error) reject(error); else resolve();
        };
        image.onload = () => finish();
        image.onerror = () => finish(new Error('Không đọc được ảnh. Hãy kiểm tra định dạng và dữ liệu tệp.'));
        options.signal?.addEventListener('abort', abort, { once: true });
        image.src = source;
        if (options.signal?.aborted) abort();
      });
    } catch (error) {
      checkConversionAbort(options);
      if (ext !== 'avif') throw error;
      yield* decodedCanvases(file, 'avif', options, flatten);
      return;
    }
    const { canvas, context } = canvasFor(image.naturalWidth, image.naturalHeight);
    if (flatten) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(image, 0, 0);
    yield canvas;
  } finally { image.src = ''; URL.revokeObjectURL(source); }
}
