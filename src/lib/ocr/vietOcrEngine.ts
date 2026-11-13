import { flattenBackground, mapBoxToSource, rotateGray, uprightAngle, type GrayImage, type OcrBox, type PageGeometry } from './pagePrep';
import { boxesFromProbability, detectorInput, type DetectedBox } from './textBoxes';

export type TensorLike = { data: ArrayLike<number> | ArrayLike<bigint>; dims: readonly number[] };
export type OcrRuntime = {
  tensor(type: 'float32' | 'int64', data: Float32Array | BigInt64Array, dims: number[]): unknown;
  run(model: 'detector' | 'encoder' | 'decoder', feeds: Record<string, unknown>): Promise<Record<string, TensorLike>>;
};
export type RecognizedLine = { text: string; bbox: OcrBox; confidence: number };
export type RecognizedPage = { width: number; height: number; confidence: number; angle: number; lines: RecognizedLine[] };

const VOCAB = 'aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬbBcCdDđĐeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆfFgGhHiIìÌỉỈĩĨíÍịỊjJkKlLmMnNoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢpPqQrRsStTuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰvVwWxXyYỳỲỷỶỹỸýÝỵỴzZ0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ ';
const VOCAB_CHARS = [...VOCAB];
const GO = 1;
const EOS = 2;
const CHAR_OFFSET = 4;
const LINE_HEIGHT = 32;
const MIN_LINE_WIDTH = 32;
const MAX_LINE_WIDTH = 512;
const MAX_ASPECT = 22;
const MAX_TOKENS = 128;
const PAD_Y = 4;
const PAD_X = 6;
const ORIENTATION_SAMPLES = 3;

export function decodeTokens(ids: number[]): string {
  return ids.filter((id) => id >= CHAR_OFFSET).map((id) => VOCAB_CHARS[id - CHAR_OFFSET] ?? '').join('');
}

export function lineInputWidth(width: number, height: number): number {
  const scaled = Math.ceil((LINE_HEIGHT * width) / height / 10) * 10;
  return Math.min(MAX_LINE_WIDTH, Math.max(MIN_LINE_WIDTH, scaled));
}

export function cropLine(image: GrayImage, box: OcrBox): GrayImage {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(image.width, Math.ceil(box.x1));
  const y1 = Math.min(image.height, Math.ceil(box.y1));
  const width = Math.max(1, x1 - x0) + PAD_X * 2;
  const height = Math.max(1, y1 - y0) + PAD_Y * 2;
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(y1 - 1, Math.max(y0, y0 + y - PAD_Y));
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(x1 - 1, Math.max(x0, x0 + x - PAD_X));
      data[y * width + x] = image.data[sourceY * image.width + sourceX];
    }
  }
  return { width, height, data };
}

export function lineTensorData(line: GrayImage): { data: Float32Array; width: number } {
  const width = lineInputWidth(line.width, line.height);
  const plane = width * LINE_HEIGHT;
  const data = new Float32Array(plane * 3);
  const ratioX = line.width / width;
  const ratioY = line.height / LINE_HEIGHT;
  for (let y = 0; y < LINE_HEIGHT; y++) {
    const top = y * ratioY;
    const bottom = Math.min(line.height, (y + 1) * ratioY);
    for (let x = 0; x < width; x++) {
      const left = x * ratioX;
      const right = Math.min(line.width, (x + 1) * ratioX);
      let sum = 0;
      let area = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        const coverY = Math.min(bottom, sy + 1) - Math.max(top, sy);
        if (coverY <= 0) continue;
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const coverX = Math.min(right, sx + 1) - Math.max(left, sx);
          if (coverX <= 0) continue;
          sum += line.data[sy * line.width + sx] * coverX * coverY;
          area += coverX * coverY;
        }
      }
      const value = (area ? sum / area : 255) / 255;
      const index = y * width + x;
      data[index] = value;
      data[plane + index] = value;
      data[plane * 2 + index] = value;
    }
  }
  return { data, width };
}

export function splitLongBox(image: GrayImage, box: OcrBox): OcrBox[] {
  const width = box.x1 - box.x0;
  const height = Math.max(1, box.y1 - box.y0);
  if (width / height <= MAX_ASPECT) return [box];
  const x0 = Math.max(0, Math.floor(box.x0));
  const x1 = Math.min(image.width, Math.ceil(box.x1));
  const y0 = Math.max(0, Math.floor(box.y0));
  const y1 = Math.min(image.height, Math.ceil(box.y1));
  const ink = new Float32Array(x1 - x0);
  for (let x = x0; x < x1; x++) {
    let dark = 0;
    for (let y = y0; y < y1; y++) dark += 255 - image.data[y * image.width + x];
    ink[x - x0] = dark;
  }
  const middle = (x0 + x1) / 2;
  const window = (x1 - x0) * 0.3;
  let best = -1;
  let bestScore = Infinity;
  for (let x = Math.floor(middle - window); x <= Math.ceil(middle + window); x++) {
    const index = x - x0;
    if (index < 2 || index >= ink.length - 2) continue;
    const local = ink[index - 2] + ink[index - 1] + ink[index] + ink[index + 1] + ink[index + 2];
    const score = local + Math.abs(x - middle) * 0.01;
    if (score < bestScore) { bestScore = score; best = x; }
  }
  if (best < 0) best = Math.round(middle);
  return [...splitLongBox(image, { ...box, x1: best }), ...splitLongBox(image, { ...box, x0: best })];
}

async function recognizeCrop(runtime: OcrRuntime, crop: GrayImage): Promise<{ text: string; confidence: number }> {
  const { data, width } = lineTensorData(crop);
  const encoded = await runtime.run('encoder', { image: runtime.tensor('float32', data, [1, 3, LINE_HEIGHT, width]) });
  const memoryTensor = encoded.memory;
  const memory = runtime.tensor('float32', Float32Array.from(memoryTensor.data as ArrayLike<number>), [...memoryTensor.dims]);
  const ids = [GO];
  const probabilities: number[] = [];
  while (ids.length <= MAX_TOKENS) {
    const output = await runtime.run('decoder', { tgt: runtime.tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [ids.length]), memory });
    const probs = output.probs.data as ArrayLike<number>;
    let best = 0;
    for (let index = 1; index < probs.length; index++) if (probs[index] > probs[best]) best = index;
    ids.push(best);
    if (best === EOS) break;
    probabilities.push(probs[best]);
  }
  const confidence = probabilities.length ? probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length : 0;
  return { text: decodeTokens(ids.slice(1)), confidence };
}

async function detect(runtime: OcrRuntime, image: GrayImage): Promise<DetectedBox[]> {
  const input = detectorInput(image);
  const output = await runtime.run('detector', { x: runtime.tensor('float32', input.data, [1, 3, input.height, input.width]) });
  const map = Object.values(output)[0];
  return boxesFromProbability(Float32Array.from(map.data as ArrayLike<number>), input.width, input.height, image.width, image.height);
}

async function orientationScore(runtime: OcrRuntime, image: GrayImage, boxes: DetectedBox[]): Promise<number> {
  const samples = [...boxes].sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0)).slice(0, ORIENTATION_SAMPLES);
  let total = 0;
  for (const box of samples) {
    const [part] = splitLongBox(image, box);
    total += (await recognizeCrop(runtime, cropLine(image, part))).confidence;
  }
  return samples.length ? total / samples.length : 0;
}

export type RecognizeOptions = { onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean };

export async function recognizePage(runtime: OcrRuntime, source: GrayImage, options: RecognizeOptions = {}): Promise<RecognizedPage> {
  const cleaned = flattenBackground(source);
  const angle = uprightAngle(cleaned);
  let geometry: PageGeometry;
  let page: GrayImage;
  ({ image: page, geometry } = rotateGray(cleaned, angle));
  let boxes = await detect(runtime, page);
  if (boxes.length) {
    const flipped = rotateGray(cleaned, angle + 180);
    const flippedBoxes = await detect(runtime, flipped.image);
    if (flippedBoxes.length && await orientationScore(runtime, flipped.image, flippedBoxes) > await orientationScore(runtime, page, boxes) + 0.05) {
      page = flipped.image;
      geometry = flipped.geometry;
      boxes = flippedBoxes;
    }
  }
  const lines: RecognizedLine[] = [];
  let index = 0;
  for (const box of boxes) {
    if (options.isCancelled?.()) throw new DOMException('Đã hủy nhận dạng văn bản.', 'AbortError');
    const parts = splitLongBox(page, box);
    const texts: string[] = [];
    let confidence = 0;
    for (const part of parts) {
      const result = await recognizeCrop(runtime, cropLine(page, part));
      texts.push(result.text);
      confidence += result.confidence;
    }
    const text = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (text) lines.push({ text, bbox: mapBoxToSource(box, geometry), confidence: (confidence / parts.length) * 100 });
    options.onProgress?.(++index, boxes.length);
  }
  const weight = lines.reduce((sum, line) => sum + line.text.length, 0);
  const confidence = weight ? lines.reduce((sum, line) => sum + line.confidence * line.text.length, 0) / weight : 0;
  return { width: source.width, height: source.height, confidence, angle: geometry.angle, lines };
}
