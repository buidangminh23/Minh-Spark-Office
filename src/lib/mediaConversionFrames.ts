import type { IFD } from 'utif';
import pako from 'pako';
import createHeifModule from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import decodeAvif from '@jsquash/avif/decode';
import { MAX_IMAGE_PAGES, checkImageSize } from './mediaConversionRaster';

export type ImageFrame = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer>; orientation: number };

function checkDirectories(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const invalid = () => new Error('Cấu trúc thư mục trang TIFF không hợp lệ.');
  if (view.byteLength < 8) throw invalid();
  const little = view.getUint16(0) === 0x4949;
  if ((!little && view.getUint16(0) !== 0x4d4d) || view.getUint16(2, little) !== 42) throw invalid();
  const seen = new Set<number>();
  let offset = view.getUint32(4, little);
  while (offset) {
    if (seen.has(offset) || offset < 8 || offset + 2 > view.byteLength) throw invalid();
    seen.add(offset);
    if (seen.size > MAX_IMAGE_PAGES) throw new Error('Tệp TIFF vượt giới hạn 200 trang.');
    const end = offset + 2 + 12 * view.getUint16(offset, little);
    if (end + 4 > view.byteLength) throw invalid();
    for (let entry = offset + 2; entry < end; entry += 12) {
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      const count = view.getUint32(entry + 4, little);
      const size = ([0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] || 0) * count;
      if (size > 4 && view.getUint32(entry + 8, little) + size > view.byteLength) throw invalid();
      if (count > 1_000_000 && type !== 1 && type !== 7) throw invalid();
      if ([330, 34665, 37500, 50740].includes(tag)) {
        view.setUint16(entry, 65535, little);
        view.setUint16(entry + 2, 3, little);
        view.setUint32(entry + 4, 1, little);
      }
    }
    offset = view.getUint32(end, little);
  }
  if (!seen.size) throw invalid();
}

function value(ifd: IFD, tag: number, fallback = 0): number {
  return Number((ifd['t' + tag] as ArrayLike<number> | undefined)?.[0] ?? fallback);
}

function grayscaleOrPalette(page: IFD, photo: number, bits: number, channels: number) {
  const palette = page.t320 as number[] | undefined;
  const levels = 2 ** bits;
  if (channels > 2 || (photo === 3 && (!palette || palette.length < levels * 3 || channels !== 1))) {
    throw new Error('Bảng màu TIFF không hợp lệ.');
  }
  const stride = Math.ceil(page.width * bits * channels / 8);
  const rgba = new Uint8Array(page.width * page.height * 4);
  const sample = (row: number, index: number) => {
    if (bits === 16) return page.data[row + index * 2] + 256 * page.data[row + index * 2 + 1];
    const bit = index * bits;
    return (page.data[row + (bit >> 3)] >> (8 - bits - bit % 8)) & (levels - 1);
  };
  for (let y = 0; y < page.height; y++) for (let x = 0; x < page.width; x++) {
    const offset = (page.width * y + x) * 4;
    const index = sample(y * stride, channels * x);
    if (photo === 3) {
      for (let component = 0; component < 3; component++) rgba[offset + component] = Math.round(palette![levels * component + index] / 257);
    } else {
      const gray = Math.round((photo === 0 ? levels - 1 - index : index) * 255 / (levels - 1));
      rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = gray;
    }
    rgba[offset + 3] = channels === 2 && value(page, 338) ? Math.round(sample(y * stride, channels * x + 1) * 255 / (levels - 1)) : 255;
  }
  return rgba;
}

export async function* decodeImageFrames(buffer: ArrayBuffer, format: 'heif' | 'tiff' | 'avif'): AsyncGenerator<ImageFrame> {
  if (format === 'avif') {
    const image = await decodeAvif(buffer);
    if (!image) throw new Error('Không giải mã được ảnh AVIF.');
    checkImageSize(image.width, image.height);
    yield { width: image.width, height: image.height, data: image.data as Uint8ClampedArray<ArrayBuffer>, orientation: 1 };
    return;
  }
  if (format === 'tiff') {
    checkDirectories(buffer);
    globalThis.pako ??= pako;
    const { default: utif } = await import('utif');
    const pages = utif.decode(buffer).filter((ifd) => !(value(ifd, 254) & 5) && value(ifd, 255) !== 2);
    if (!pages.length) throw new Error('Tệp TIFF thiếu trang ảnh.');
    for (const page of pages) {
      const width = value(page, 256);
      const height = value(page, 257);
      checkImageSize(width, height);
      if (page.t322) checkImageSize(value(page, 322), value(page, 323));
      const compression = value(page, 259, 1);
      const channels = value(page, 277, 1);
      const bits = value(page, 258, 1);
      if (compression === 32946) page.t259 = [8];
      if (![1, 3, 4, 5, 6, 7, 8, 32773, 32809, 32946].includes(compression) || value(page, 284, 1) > 1 ||
        channels < 1 || channels > 5 || (page.t258 && (page.t258 as number[]).length !== channels) ||
        ![1, 2, 4, 8, 16].includes(bits)) throw new Error('Kiểu nén hoặc kiểu kênh màu TIFF này chưa được hỗ trợ.');
      const offsets = (page.t273 ?? page.t324) as number[] | undefined;
      const lengths = (page.t279 ?? page.t325) as number[] | undefined;
      if (!offsets?.length || (lengths && lengths.length !== offsets.length) ||
        offsets.some((offset, index) => offset < 8 || offset >= buffer.byteLength || offset + (lengths?.[index] ?? 0) > buffer.byteLength)) {
        throw new Error('Tệp TIFF thiếu dữ liệu điểm ảnh.');
      }
      utif.decodeImage(buffer, page);
      const photo = value(page, 262, 2);
      const indexed = [0, 1, 3].includes(photo);
      const supported = indexed || (photo === 2 && [8, 16].includes(bits) && [3, 4].includes(channels)) ||
        (photo === 5 && bits === 8 && [4, 5].includes(channels));
      if (!supported) throw new Error('Kiểu màu TIFF này chưa được hỗ trợ.');
      const rgba = indexed ? grayscaleOrPalette(page, photo, bits, channels) : utif.toRGBA8(page);
      const alpha = value(page, 338);
      if (!alpha && !indexed && channels >= 4) for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
      if (alpha === 1) for (let i = 0; i < rgba.length; i += 4) {
        const a = rgba[i + 3];
        if (a && a < 255) for (let c = 0; c < 3; c++) rgba[i + c] = Math.min(255, Math.round(rgba[i + c] * 255 / a));
      }
      page.data = new Uint8Array();
      yield { width, height, orientation: value(page, 274, 1), data: new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength) };
    }
    return;
  }
  const libheif = await createHeifModule();
  const decoder = new libheif.HeifDecoder();
  let images: ReturnType<typeof decoder.decode> = [];
  try {
    images = decoder.decode(new Uint8Array(buffer));
    if (!images.length) throw new Error('Không đọc được ảnh trong tệp HEIC/HEIF.');
    if (libheif.heif_js_context_get_list_of_top_level_image_IDs(decoder.decoder)?.length !== images.length) throw new Error('Có ảnh trong tệp HEIC/HEIF không đọc được.');
    if (images.length > MAX_IMAGE_PAGES) throw new Error('Tệp HEIC/HEIF vượt giới hạn 200 ảnh.');
    for (const image of images) {
      const width = image.get_width();
      const height = image.get_height();
      checkImageSize(width, height);
      const frame = { width, height, orientation: 1, data: new Uint8ClampedArray(width * height * 4) };
      const decoded = await new Promise<ImageFrame | null>((resolve) => image.display(frame, resolve));
      if (!decoded) throw new Error('Không giải mã được ảnh HEIC/HEIF.');
      yield decoded;
    }
  } finally {
    for (const image of images) image.free();
    if (decoder.decoder) libheif.heif_context_free(decoder.decoder);
  }
}
