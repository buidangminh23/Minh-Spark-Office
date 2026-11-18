import { decodeImageFrames, type ImageFrame } from './mediaConversionFrames';

let frames: AsyncGenerator<ImageFrame> | undefined;
self.onmessage = async ({ data }: MessageEvent<{ buffer?: ArrayBuffer; format: 'tiff' | 'heif' | 'avif' }>) => {
  try {
    if (data.buffer) frames = decodeImageFrames(data.buffer, data.format);
    const result = await frames!.next();
    if (result.done) self.postMessage({ done: true });
    else self.postMessage({ frame: result.value }, { transfer: [result.value.data.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Không giải mã được ảnh.' });
  }
};
