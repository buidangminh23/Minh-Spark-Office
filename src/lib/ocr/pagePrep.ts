export type GrayImage = { width: number; height: number; data: Uint8ClampedArray };
export type OcrBox = { x0: number; y0: number; x1: number; y1: number };
export type PageGeometry = { angle: number; sourceWidth: number; sourceHeight: number; width: number; height: number };

const SKEW_RANGE = 10;
const SKEW_SAMPLE_WIDTH = 900;
const MAX_INK_POINTS = 160_000;

export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let index = 0, offset = 0; index < data.length; index++, offset += 4) {
    const alpha = rgba[offset + 3] / 255;
    const luma = 0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
    data[index] = luma * alpha + 255 * (1 - alpha);
  }
  return { width, height, data };
}

function percentile(histogram: Uint32Array, total: number, fraction: number): number {
  const target = total * fraction;
  let sum = 0;
  for (let value = 0; value < 256; value++) {
    sum += histogram[value];
    if (sum >= target) return value;
  }
  return 255;
}

function blockBackground(image: GrayImage, block: number): { values: Float32Array; columns: number; rows: number } {
  const columns = Math.ceil(image.width / block);
  const rows = Math.ceil(image.height / block);
  const values = new Float32Array(columns * rows);
  const histogram = new Uint32Array(256);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      histogram.fill(0);
      const x1 = Math.min(image.width, (column + 1) * block);
      const y1 = Math.min(image.height, (row + 1) * block);
      for (let y = row * block; y < y1; y++) for (let x = column * block; x < x1; x++) histogram[image.data[y * image.width + x]]++;
      values[row * columns + column] = percentile(histogram, (x1 - column * block) * (y1 - row * block), 0.9);
    }
  }
  const smooth = new Float32Array(values.length);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let best = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const y = row + dy;
        const x = column + dx;
        if (x >= 0 && y >= 0 && x < columns && y < rows) best = Math.max(best, values[y * columns + x]);
      }
      smooth[row * columns + column] = Math.max(best, 32);
    }
  }
  return { values: smooth, columns, rows };
}

export function flattenBackground(image: GrayImage): GrayImage {
  const block = Math.max(16, Math.round(Math.max(image.width, image.height) / 48));
  const background = blockBackground(image, block);
  const data = new Uint8ClampedArray(image.data.length);
  const histogram = new Uint32Array(256);
  for (let y = 0; y < image.height; y++) {
    const fy = Math.min(background.rows - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(background.rows - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < image.width; x++) {
      const fx = Math.min(background.columns - 1, Math.max(0, (x + 0.5) / block - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(background.columns - 1, x0 + 1);
      const wx = fx - x0;
      const top = background.values[y0 * background.columns + x0] * (1 - wx) + background.values[y0 * background.columns + x1] * wx;
      const bottom = background.values[y1 * background.columns + x0] * (1 - wx) + background.values[y1 * background.columns + x1] * wx;
      const value = Math.min(255, (image.data[y * image.width + x] * 255) / (top * (1 - wy) + bottom * wy));
      data[y * image.width + x] = value;
      histogram[data[y * image.width + x]]++;
    }
  }
  const ink = percentile(histogram, data.length, 0.005);
  if (ink < 200) {
    const scale = 255 / (255 - ink);
    for (let index = 0; index < data.length; index++) data[index] = (data[index] - ink) * scale;
  }
  return { width: image.width, height: image.height, data };
}

export function otsuThreshold(image: GrayImage): number {
  const histogram = new Uint32Array(256);
  for (const value of image.data) histogram[value]++;
  const total = image.data.length;
  let sum = 0;
  for (let value = 0; value < 256; value++) sum += value * histogram[value];
  let background = 0;
  let backgroundSum = 0;
  let best = 0;
  let threshold = 128;
  for (let value = 0; value < 256; value++) {
    background += histogram[value];
    if (!background) continue;
    const foreground = total - background;
    if (!foreground) break;
    backgroundSum += value * histogram[value];
    const meanBackground = backgroundSum / background;
    const meanForeground = (sum - backgroundSum) / foreground;
    const variance = background * foreground * (meanBackground - meanForeground) ** 2;
    if (variance > best) { best = variance; threshold = value; }
  }
  return threshold;
}

function inkPoints(image: GrayImage): { xs: Float32Array; ys: Float32Array; length: number } {
  const step = Math.max(1, Math.ceil(image.width / SKEW_SAMPLE_WIDTH));
  const threshold = otsuThreshold(image);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) if (image.data[y * image.width + x] < threshold) { xs.push(x / step); ys.push(y / step); }
  }
  const stride = Math.max(1, Math.ceil(xs.length / MAX_INK_POINTS));
  const length = Math.ceil(xs.length / stride);
  const sampledX = new Float32Array(length);
  const sampledY = new Float32Array(length);
  for (let index = 0; index < length; index++) { sampledX[index] = xs[index * stride]; sampledY[index] = ys[index * stride]; }
  return { xs: sampledX, ys: sampledY, length };
}

function profileSharpness(xs: Float32Array, ys: Float32Array, length: number, degrees: number): number {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  let min = Infinity;
  let max = -Infinity;
  const projected = new Int32Array(length);
  for (let index = 0; index < length; index++) {
    const value = Math.round(ys[index] * cos - xs[index] * sin);
    projected[index] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!length) return 0;
  const bins = new Uint32Array(max - min + 1);
  for (const value of projected) bins[value - min]++;
  let score = 0;
  for (let index = 1; index < bins.length; index++) score += (bins[index] - bins[index - 1]) ** 2;
  return score;
}

function bestAngle(xs: Float32Array, ys: Float32Array, length: number): { angle: number; score: number } {
  let angle = 0;
  let score = profileSharpness(xs, ys, length, 0);
  for (let degrees = -SKEW_RANGE; degrees <= SKEW_RANGE; degrees += 0.5) {
    const candidate = profileSharpness(xs, ys, length, degrees);
    if (candidate > score) { score = candidate; angle = degrees; }
  }
  const coarse = angle;
  for (let degrees = coarse - 0.5; degrees <= coarse + 0.5; degrees += 0.05) {
    const candidate = profileSharpness(xs, ys, length, degrees);
    if (candidate > score) { score = candidate; angle = degrees; }
  }
  return { angle: Math.round(angle * 100) / 100, score };
}

export function estimateOrientation(image: GrayImage): { quarterTurn: boolean; skew: number } {
  const points = inkPoints(image);
  if (points.length < 50) return { quarterTurn: false, skew: 0 };
  const upright = bestAngle(points.xs, points.ys, points.length);
  const sideways = bestAngle(points.ys, points.xs, points.length);
  return { quarterTurn: sideways.score > upright.score * 1.6, skew: upright.angle };
}

export function uprightAngle(image: GrayImage): number {
  const first = estimateOrientation(image);
  if (!first.quarterTurn) return -first.skew;
  const turned = rotateGray(image, 90).image;
  return 90 - estimateOrientation(turned).skew;
}

export function rotateGray(image: GrayImage, degrees: number): { image: GrayImage; geometry: PageGeometry } {
  const normalized = ((degrees % 360) + 360) % 360;
  const radians = (normalized * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const exactQuarter = Math.abs(normalized - Math.round(normalized / 90) * 90) < 1e-6;
  const round = (value: number) => (exactQuarter ? Math.round(value) : Math.ceil(value - 1e-6));
  const width = round(Math.abs(image.width * cos) + Math.abs(image.height * sin));
  const height = round(Math.abs(image.width * sin) + Math.abs(image.height * cos));
  const geometry: PageGeometry = { angle: normalized, sourceWidth: image.width, sourceHeight: image.height, width, height };
  if (!normalized) return { image, geometry };
  const data = new Uint8ClampedArray(width * height).fill(255);
  const sourceCenterX = image.width / 2;
  const sourceCenterY = image.height / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  for (let y = 0; y < height; y++) {
    const dy = y + 0.5 - centerY;
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - centerX;
      const sourceX = cos * dx + sin * dy + sourceCenterX - 0.5;
      const sourceY = -sin * dx + cos * dy + sourceCenterY - 0.5;
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      if (x0 < -1 || y0 < -1 || x0 >= image.width || y0 >= image.height) continue;
      const wx = sourceX - x0;
      const wy = sourceY - y0;
      const sample = (sx: number, sy: number) => (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height ? 255 : image.data[sy * image.width + sx]);
      const top = sample(x0, y0) * (1 - wx) + sample(x0 + 1, y0) * wx;
      const bottom = sample(x0, y0 + 1) * (1 - wx) + sample(x0 + 1, y0 + 1) * wx;
      data[y * width + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return { image: { width, height, data }, geometry };
}

export function mapBoxToSource(box: OcrBox, geometry: PageGeometry): OcrBox {
  if (!geometry.angle) return box;
  const radians = (geometry.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]].map(([x, y]) => {
    const dx = x - geometry.width / 2;
    const dy = y - geometry.height / 2;
    return [cos * dx + sin * dy + geometry.sourceWidth / 2, -sin * dx + cos * dy + geometry.sourceHeight / 2];
  });
  const clampX = (value: number) => Math.min(geometry.sourceWidth, Math.max(0, value));
  const clampY = (value: number) => Math.min(geometry.sourceHeight, Math.max(0, value));
  return {
    x0: clampX(Math.min(...corners.map(([x]) => x))), y0: clampY(Math.min(...corners.map(([, y]) => y))),
    x1: clampX(Math.max(...corners.map(([x]) => x))), y1: clampY(Math.max(...corners.map(([, y]) => y))),
  };
}
