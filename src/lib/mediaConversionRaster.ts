import type { ConversionOptions } from './conversionTypes';
import { checkConversionAbort } from './conversionTypes';

export const MAX_IMAGE_PAGES = 200;
export function checkImageSize(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16_000_000 || Math.max(width, height) > 8192) {
    throw new Error('Ảnh vượt giới hạn 16 triệu điểm ảnh hoặc cạnh 8.192 px, hoặc có kích thước không hợp lệ.');
  }
}

export function encodeBmp({ width, height, data }: ImageData): Blob {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = new Uint8Array(54 + height * stride);
  const header = new DataView(bytes.buffer);
  bytes.set([66, 77]);
  for (const [offset, value] of [[2, bytes.length], [10, 54], [14, 40], [18, width], [22, height], [34, height * stride]]) header.setUint32(offset, value, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 24, true);
  for (let y = 0; y < height; y++) {
    let dest = 54 + (height - y - 1) * stride;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const alpha = data[src + 3] / 255;
      for (let channel = 2; channel >= 0; channel--) bytes[dest++] = Math.round(255 + (data[src + channel] - 255) * alpha);
    }
  }
  return new Blob([bytes], { type: 'image/bmp' });
}

export function dibAsBitmap(buffer: ArrayBuffer): Blob {
  const view = new DataView(buffer);
  if (view.byteLength >= 14 && view.getUint16(0) === 0x424d) return new Blob([buffer], { type: 'image/bmp' });
  const headerSize = view.getUint32(0, true);
  if (![12, 40, 52, 56, 108, 124].includes(headerSize) || headerSize > buffer.byteLength) throw new Error('Đầu tệp DIB không hợp lệ.');
  const core = headerSize === 12;
  const bits = view.getUint16(core ? 10 : 14, true);
  const colors = (!core && view.getUint32(32, true)) || (bits <= 8 ? 2 ** bits : 0);
  const compression = core ? 0 : view.getUint32(16, true);
  const masks = headerSize === 40 && (compression === 3 || compression === 6) ? (compression === 3 ? 12 : 16) : 0;
  const offset = headerSize + masks + colors * (core ? 3 : 4);
  if (offset >= buffer.byteLength) throw new Error('Tệp DIB thiếu dữ liệu ảnh.');
  const prefix = new DataView(new ArrayBuffer(14));
  prefix.setUint16(0, 0x424d);
  prefix.setUint32(2, 14 + buffer.byteLength, true);
  prefix.setUint32(10, 14 + offset, true);
  return new Blob([prefix.buffer, buffer], { type: 'image/bmp' });
}

type TiffStrip = { width: number; height: number; pixels: Blob };
const TAG_COUNT = 11;
const DIRECTORY_SIZE = 2 + TAG_COUNT * 12 + 4 + 8;

function tiffFromStrips(frames: TiffStrip[]): Blob {
  const header = new DataView(new ArrayBuffer(8));
  header.setUint16(0, 0x4949);
  header.setUint16(2, 42, true);
  header.setUint32(4, 8, true);
  const parts: BlobPart[] = [header.buffer];
  let offset = 8;
  for (const [index, { width, height, pixels }] of frames.entries()) {
    const directory = new DataView(new ArrayBuffer(DIRECTORY_SIZE));
    directory.setUint16(0, TAG_COUNT, true);
    const bitsOffset = offset + DIRECTORY_SIZE - 8;
    const stripOffset = offset + DIRECTORY_SIZE;
    const tags = [[256, 4, 1, width], [257, 4, 1, height], [258, 3, 4, bitsOffset], [259, 3, 1, 8], [262, 3, 1, 2], [273, 4, 1, stripOffset], [277, 3, 1, 4], [278, 4, 1, height], [279, 4, 1, pixels.size], [284, 3, 1, 1], [338, 3, 1, 2]];
    for (const [i, [tag, type, count, value]] of tags.entries()) {
      const pos = 2 + i * 12;
      directory.setUint16(pos, tag, true);
      directory.setUint16(pos + 2, type, true);
      directory.setUint32(pos + 4, count, true);
      if (type === 3 && count === 1) directory.setUint16(pos + 8, value, true);
      else directory.setUint32(pos + 8, value, true);
    }
    for (let i = 0; i < 4; i++) directory.setUint16(DIRECTORY_SIZE - 8 + 2 * i, 8, true);
    offset = stripOffset + pixels.size + (pixels.size % 2);
    directory.setUint32(2 + TAG_COUNT * 12, index + 1 === frames.length ? 0 : offset, true);
    parts.push(directory.buffer, pixels);
    if (pixels.size % 2) parts.push(new Uint8Array(1));
  }
  return new Blob(parts, { type: 'image/tiff' });
}

export async function encodeTiff({ data, width, height }: ImageData) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return tiffFromStrips([{ width, height, pixels: await new Response(stream).blob() }]);
}

export async function joinEncodedTiffPages(pages: Blob[], options: ConversionOptions = {}) {
  if (pages.length === 1) return pages[0];
  const frames: TiffStrip[] = [];
  for (const page of pages) {
    checkConversionAbort(options);
    const prefix = new DataView(await page.slice(0, 8 + DIRECTORY_SIZE).arrayBuffer());
    const count = prefix.getUint32(18 + 8 * 12, true);
    frames.push({ width: prefix.getUint32(18, true), height: prefix.getUint32(30, true), pixels: page.slice(8 + DIRECTORY_SIZE, 8 + DIRECTORY_SIZE + count) });
  }
  return tiffFromStrips(frames);
}
