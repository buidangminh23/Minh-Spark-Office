import type { FrameTiming } from './mediaConversionImage';
import { checkConversionAbort, type ConversionOptions } from './conversionTypes';

export async function hasJfifHeader(blob: Blob) {
  const header = new Uint8Array(await blob.slice(0, 20).arrayBuffer());
  return header.length === 20 && header[0] === 255 && header[1] === 216 && header[2] === 255 && header[3] === 224
    && ((header[4] << 8) | header[5]) >= 16 && String.fromCharCode(...header.slice(6, 11)) === 'JFIF\0';
}

export async function jpegAsJfif(jpeg: Blob) {
  if (await hasJfifHeader(jpeg)) return jpeg;
  const header = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 2, 0, 0, 1, 0, 1, 0, 0]);
  return new Blob([header, jpeg.slice(2)], { type: 'image/jpeg' });
}

export async function encodeImageInWorker(canvas: HTMLCanvasElement, target: string, options: ConversionOptions, frame?: FrameTiming): Promise<Blob> {
  checkConversionAbort(options);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const worker = new Worker(new URL('./mediaConversionEncodeWorker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const stop = () => { worker.terminate(); clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); };
    const fail = (error: Error) => { stop(); reject(error); };
    const cancel = () => fail(new DOMException('Đã hủy chuyển đổi.', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Ảnh quá phức tạp hoặc mất quá nhiều thời gian để mã hóa.')), 120_000);
    worker.onerror = (event) => fail(new Error(event.message || 'Không khởi chạy được bộ mã hóa ảnh.'));
    worker.onmessage = ({ data }) => {
      if (!(data.blob instanceof Blob) || !data.blob.size) fail(new Error(data.error || 'Không mã hóa được ảnh.'));
      else { stop(); resolve(data.blob); }
    };
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    else {
      try { worker.postMessage({ image, target, frame }, [image.data.buffer]); }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    }
  });
}

export async function compressedSvg(svg: Blob) {
  const compressed = await new Response(svg.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return new Blob([compressed], { type: 'application/gzip' });
}

export async function svgWithImage(png: Blob, width: number, height: number) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(png);
  });
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" xlink:href="${source}"/></svg>`], { type: 'image/svg+xml' });
}

export async function encodeIcon(canvas: HTMLCanvasElement) {
  const scale = Math.min(1, 256 / Math.max(canvas.width, canvas.height));
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const icon = document.createElement('canvas');
  icon.width = width;
  icon.height = height;
  try {
    const context = icon.getContext('2d');
    if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) => icon.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không mã hóa được ảnh.')), 'image/png'));
    const header = new DataView(new ArrayBuffer(22));
    header.setUint16(2, 1, true);
    header.setUint16(4, 1, true);
    header.setUint8(6, width % 256);
    header.setUint8(7, height % 256);
    header.setUint16(10, 1, true);
    header.setUint16(12, 32, true);
    header.setUint32(14, png.size, true);
    header.setUint32(18, 22, true);
    return new Blob([header.buffer, png], { type: 'image/x-icon' });
  } finally { icon.width = icon.height = 0; }
}
