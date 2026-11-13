import type { GrayImage, OcrBox } from './pagePrep';

export type DetectedBox = OcrBox & { score: number };
export type DetectorInput = { data: Float32Array; width: number; height: number; scale: number };

const DETECTOR_SIDE = 736;
const DETECTOR_MAX_SIDE = 2400;
const BINARY_THRESHOLD = 0.3;
const BOX_THRESHOLD = 0.5;
const UNCLIP_RATIO = 1.6;
const MIN_SIDE = 3;
const MAX_CANDIDATES = 1500;
const LINE_GROUP_PIXELS = 10;

export function detectorInput(image: GrayImage): DetectorInput {
  const shortSide = Math.min(image.width, image.height);
  let scale = shortSide < DETECTOR_SIDE ? DETECTOR_SIDE / shortSide : 1;
  scale = Math.min(scale, DETECTOR_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(32, Math.round((image.width * scale) / 32) * 32);
  const height = Math.max(32, Math.round((image.height * scale) / 32) * 32);
  const plane = width * height;
  const data = new Float32Array(plane * 3);
  const ratioX = image.width / width;
  const ratioY = image.height / height;
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(image.height - 1, Math.max(0, (y + 0.5) * ratioY - 0.5));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const wy = sourceY - y0;
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(image.width - 1, Math.max(0, (x + 0.5) * ratioX - 0.5));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const wx = sourceX - x0;
      const top = image.data[y0 * image.width + x0] * (1 - wx) + image.data[y0 * image.width + x1] * wx;
      const bottom = image.data[y1 * image.width + x0] * (1 - wx) + image.data[y1 * image.width + x1] * wx;
      const value = ((top * (1 - wy) + bottom * wy) / 255 - 0.5) / 0.5;
      const index = y * width + x;
      data[index] = value;
      data[plane + index] = value;
      data[plane * 2 + index] = value;
    }
  }
  return { data, width, height, scale: width / image.width };
}

export function boxesFromProbability(probability: Float32Array, width: number, height: number, targetWidth: number, targetHeight: number): DetectedBox[] {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (probability[index] > BINARY_THRESHOLD || (x + 1 < width && probability[index + 1] > BINARY_THRESHOLD)
        || (y + 1 < height && probability[index + width] > BINARY_THRESHOLD)
        || (x + 1 < width && y + 1 < height && probability[index + width + 1] > BINARY_THRESHOLD)) mask[index] = 1;
    }
  }
  const labels = new Int32Array(width * height);
  const stack: number[] = [];
  const boxes: DetectedBox[] = [];
  let label = 0;
  for (let start = 0; start < mask.length && label < MAX_CANDIDATES; start++) {
    if (!mask[start] || labels[start]) continue;
    label++;
    labels[start] = label;
    stack.push(start);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (stack.length) {
      const index = stack.pop()!;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const next = ny * width + nx;
          if (mask[next] && !labels[next]) { labels[next] = label; stack.push(next); }
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (Math.min(boxWidth, boxHeight) < MIN_SIDE) continue;
    let total = 0;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) total += probability[y * width + x];
    const score = total / (boxWidth * boxHeight);
    if (score < BOX_THRESHOLD) continue;
    const distance = (boxWidth * boxHeight * UNCLIP_RATIO) / (2 * (boxWidth + boxHeight));
    const x0 = minX - distance;
    const y0 = minY - distance;
    const x1 = maxX + 1 + distance;
    const y1 = maxY + 1 + distance;
    if (Math.min(x1 - x0, y1 - y0) < MIN_SIDE + 2) continue;
    boxes.push({
      x0: Math.max(0, Math.round((x0 / width) * targetWidth)), y0: Math.max(0, Math.round((y0 / height) * targetHeight)),
      x1: Math.min(targetWidth, Math.round((x1 / width) * targetWidth)), y1: Math.min(targetHeight, Math.round((y1 / height) * targetHeight)), score,
    });
  }
  return sortReadingOrder(boxes);
}

export function sortReadingOrder<T extends OcrBox>(boxes: T[]): T[] {
  const byTop = [...boxes].sort((a, b) => a.y0 - b.y0);
  let line = 0;
  const lines = byTop.map((box, index) => {
    if (index && box.y0 - byTop[index - 1].y0 >= LINE_GROUP_PIXELS) line++;
    return { box, line };
  });
  return lines.sort((a, b) => a.line - b.line || a.box.x0 - b.box.x0).map(({ box }) => box);
}
