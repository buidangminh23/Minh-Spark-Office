export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type ArtEffect = 'pencil' | 'charcoal' | 'poster' | 'mosaic' | 'emboss' | 'negative' | 'glow' | 'softEdges';

export const ART_EFFECTS: { id: ArtEffect; label: string }[] = [
  { id: 'pencil', label: 'Phác thảo bút chì' },
  { id: 'charcoal', label: 'Than chì' },
  { id: 'poster', label: 'Áp phích' },
  { id: 'mosaic', label: 'Ghép mảnh' },
  { id: 'emboss', label: 'Chạm nổi' },
  { id: 'negative', label: 'Âm bản' },
  { id: 'glow', label: 'Phát sáng' },
  { id: 'softEdges', label: 'Viền mềm' },
];

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export function removeBackground(pixels: Pixels, tolerance: number): number {
  const { data, width, height } = pixels;
  const seeds = borderColors(pixels);
  const limit = (Math.max(1, tolerance) / 100) * 441;
  const near = (index: number) => seeds.some(([r, g, b]) => Math.hypot(data[index] - r, data[index + 1] - g, data[index + 2] - b) <= limit);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  let cleared = 0;
  while (stack.length) {
    const point = stack.pop()!;
    if (visited[point]) continue;
    visited[point] = 1;
    const index = point * 4;
    if (data[index + 3] === 0 || !near(index)) continue;
    data[index + 3] = 0;
    cleared++;
    const x = point % width;
    const y = (point - x) / width;
    if (x > 0) stack.push(point - 1);
    if (x < width - 1) stack.push(point + 1);
    if (y > 0) stack.push(point - width);
    if (y < height - 1) stack.push(point + width);
  }
  return cleared;
}

function borderColors({ data, width, height }: Pixels): [number, number, number][] {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1, Math.floor(width / 2), (height - 1) * width + Math.floor(width / 2)];
  const colors: [number, number, number][] = [];
  for (const point of corners) {
    const i = point * 4;
    const color: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    if (!colors.some((c) => Math.hypot(c[0] - color[0], c[1] - color[1], c[2] - color[2]) < 12)) colors.push(color);
  }
  return colors;
}

export function setOpacity(pixels: Pixels, opacity: number) {
  const factor = Math.max(0, Math.min(1, opacity));
  const { data } = pixels;
  for (let i = 3; i < data.length; i += 4) data[i] = clamp(data[i] * factor);
}

const grayCopy = ({ data, width, height }: Pixels) => {
  const gray = new Float32Array(width * height);
  for (let p = 0; p < gray.length; p++) gray[p] = luma(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  return gray;
};

const edges = (gray: Float32Array, width: number, height: number) => {
  const out = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const gx = gray[p - width + 1] + 2 * gray[p + 1] + gray[p + width + 1] - gray[p - width - 1] - 2 * gray[p - 1] - gray[p + width - 1];
      const gy = gray[p + width - 1] + 2 * gray[p + width] + gray[p + width + 1] - gray[p - width - 1] - 2 * gray[p - width] - gray[p - width + 1];
      out[p] = Math.min(255, Math.hypot(gx, gy));
    }
  }
  return out;
};

export function applyArtEffect(pixels: Pixels, effect: ArtEffect) {
  const { data, width, height } = pixels;
  if (effect === 'negative') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    return;
  }
  if (effect === 'poster') {
    const step = 255 / 4;
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = clamp(Math.round(data[i + c] / step) * step);
    return;
  }
  if (effect === 'mosaic') {
    const size = Math.max(4, Math.round(Math.min(width, height) / 40));
    for (let by = 0; by < height; by += size) {
      for (let bx = 0; bx < width; bx += size) {
        const sum = [0, 0, 0];
        let count = 0;
        for (let y = by; y < Math.min(height, by + size); y++) for (let x = bx; x < Math.min(width, bx + size); x++) {
          const i = (y * width + x) * 4;
          sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; count++;
        }
        for (let y = by; y < Math.min(height, by + size); y++) for (let x = bx; x < Math.min(width, bx + size); x++) {
          const i = (y * width + x) * 4;
          data[i] = sum[0] / count; data[i + 1] = sum[1] / count; data[i + 2] = sum[2] / count;
        }
      }
    }
    return;
  }
  if (effect === 'softEdges') {
    const fade = Math.max(4, Math.round(Math.min(width, height) * 0.12));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (distance < fade) {
        const i = (y * width + x) * 4 + 3;
        data[i] = clamp((data[i] * distance) / fade);
      }
    }
    return;
  }
  const gray = grayCopy(pixels);
  if (effect === 'glow') {
    for (let p = 0; p < gray.length; p++) {
      const i = p * 4;
      const lift = gray[p] / 255;
      for (let c = 0; c < 3; c++) data[i + c] = clamp(data[i + c] + (255 - data[i + c]) * lift * 0.45);
    }
    return;
  }
  if (effect === 'emboss') {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const previous = x > 0 && y > 0 ? gray[p - width - 1] : gray[p];
      const value = clamp(128 + (gray[p] - previous) * 2);
      data[p * 4] = value; data[p * 4 + 1] = value; data[p * 4 + 2] = value;
    }
    return;
  }
  const edge = edges(gray, width, height);
  for (let p = 0; p < gray.length; p++) {
    const value = effect === 'pencil' ? 255 - edge[p] * 1.6 : clamp(gray[p] * 0.55 - edge[p] * 0.9 + 60);
    data[p * 4] = clamp(value); data[p * 4 + 1] = clamp(value); data[p * 4 + 2] = clamp(value);
  }
}

export function hasTransparency({ data }: Pixels): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

export function targetSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const dataUrlBytes = (url: string) => {
  const comma = url.indexOf(',');
  const body = comma >= 0 ? url.slice(comma + 1) : url;
  return url.slice(0, comma).includes(';base64') ? Math.floor((body.length * 3) / 4) - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0) : body.length;
};
