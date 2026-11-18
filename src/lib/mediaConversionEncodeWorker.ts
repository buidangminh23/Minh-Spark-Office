import type { FrameTiming } from './mediaConversionImage';
import heicWasm from '@pbk20191/icodec/heic-enc.wasm?url';

async function encode(image: ImageData, target: string, frame?: FrameTiming): Promise<Blob> {
  if (target === 'avif') {
    const { default: encodeAvif } = await import('@jsquash/avif/encode');
    return new Blob([await encodeAvif(image, { quality: 85, qualityAlpha: 100, speed: 8, subsample: 3 })], { type: 'image/avif' });
  }
  if (target === 'gif') {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const palette = quantize(image.data, 256, { format: 'rgba4444', oneBitAlpha: true, clearAlpha: true });
    const transparentIndex = palette.findIndex(color => color[3] === 0);
    const indexed = applyPalette(image.data, palette, 'rgba4444');
    const writer = GIFEncoder({ auto: false });
    const first = !frame || frame.index === 0;
    if (first) writer.writeHeader();
    writer.writeFrame(indexed, image.width, image.height, {
      first, palette, transparent: transparentIndex >= 0, transparentIndex,
      delay: frame?.delay ?? 0, repeat: frame?.repeat ?? -1, dispose: 2,
    });
    if (!frame || frame.index === frame.count - 1) writer.finish();
    return new Blob([writer.bytes()], { type: 'image/gif' });
  }
  const heic = await import('../../node_modules/@pbk20191/icodec/lib/heic.js');
  await heic.loadEncoder(heicWasm);
  const bytes = heic.encode({ data: image.data, width: image.width, height: image.height, depth: 8 }, { quality: 92, preset: 'ultrafast', chroma: '444' });
  return new Blob([new Uint8Array(bytes)], { type: target === 'heif' ? 'image/heif' : 'image/heic' });
}

self.onmessage = async ({ data }: MessageEvent<{ image: ImageData; target: string; frame?: FrameTiming }>) => {
  try {
    self.postMessage({ blob: await encode(data.image, data.target, data.frame) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
