import type { EditablePdfLine } from '../pdfOcrTypes';

type Raster = { width: number; height: number; data: Uint8ClampedArray };
type Box = { x0: number; y0: number; x1: number; y1: number };
type InputLine = { text: string; bbox: Box; confidence: number };
type Color = [number, number, number];

const luminance = (color: Color) => color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
const pixelColor = (data: Uint8ClampedArray, index: number): Color => [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]];

function sampleBackground(source: Raster, x: number, from: number, to: number, fallbackY: number): Color {
  const colors: Color[] = [];
  for (let y = Math.max(0, from); y < Math.min(source.height, to); y++) {
    for (let sx = Math.max(0, x - 3); sx <= Math.min(source.width - 1, x + 3); sx++) colors.push(pixelColor(source.data, y * source.width + sx));
  }
  if (!colors.length) {
    for (let sx = Math.max(0, x - 3); sx <= Math.min(source.width - 1, x + 3); sx++) colors.push(pixelColor(source.data, fallbackY * source.width + sx));
  }
  colors.sort((left, right) => luminance(left) - luminance(right));
  return colors[Math.min(colors.length - 1, Math.floor(colors.length * 0.75))];
}

function interpolate(top: Color, bottom: Color, ratio: number): Color {
  return [top[0] + (bottom[0] - top[0]) * ratio, top[1] + (bottom[1] - top[1]) * ratio, top[2] + (bottom[2] - top[2]) * ratio];
}

function protectRules(source: Raster, box: Box, background: number): Uint8Array {
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  const protectedPixels = new Uint8Array(width * height);
  const margin = Math.max(8, Math.ceil(height));
  const x0 = Math.max(0, box.x0 - margin);
  const x1 = Math.min(source.width, box.x1 + margin);
  const y0 = Math.max(0, box.y0 - margin);
  const y1 = Math.min(source.height, box.y1 + margin);
  const dark = (x: number, y: number) => luminance(pixelColor(source.data, y * source.width + x)) < background - 32;
  const protect = (x: number, y: number) => {
    for (let py = Math.max(box.y0, y - 1); py < Math.min(box.y1, y + 2); py++) {
      for (let px = Math.max(box.x0, x - 1); px < Math.min(box.x1, x + 2); px++) protectedPixels[(py - box.y0) * width + px - box.x0] = 1;
    }
  };
  const horizontalMinimum = Math.max(24, Math.ceil(height * 2.5));
  for (let y = box.y0; y < box.y1; y++) {
    let start = x0;
    for (let x = x0; x <= x1; x++) {
      if (x < x1 && dark(x, y)) continue;
      if (x - start >= horizontalMinimum) for (let px = Math.max(start, box.x0); px < Math.min(x, box.x1); px++) protect(px, y);
      start = x + 1;
    }
  }
  const verticalMinimum = Math.max(20, Math.ceil(height * 1.3));
  for (let x = box.x0; x < box.x1; x++) {
    let start = y0;
    for (let y = y0; y <= y1; y++) {
      if (y < y1 && dark(x, y)) continue;
      if (y - start >= verticalMinimum && (start < box.y0 || y > box.y1)) {
        for (let py = Math.max(start, box.y0); py < Math.min(y, box.y1); py++) protect(x, py);
      }
      start = y + 1;
    }
  }
  return protectedPixels;
}

function matchingInk(color: Color, reference: Color): boolean {
  const spread = Math.max(...color) - Math.min(...color);
  const referenceSpread = Math.max(...reference) - Math.min(...reference);
  if (referenceSpread < 35) return spread < 50;
  if (spread < 25) return luminance(color) < 55;
  const chroma = color.map((value) => (value - Math.min(...color)) / spread);
  const referenceChroma = reference.map((value) => (value - Math.min(...reference)) / referenceSpread);
  return chroma.reduce((sum, value, index) => sum + Math.abs(value - referenceChroma[index]), 0) < 0.8;
}

function dominantInk(colors: Color[]): Color {
  const bins = new Map<string, Color[]>();
  for (const color of colors) {
    const key = color.map((value) => Math.floor(value / 32)).join(':');
    const list = bins.get(key) ?? [];
    list.push(color);
    bins.set(key, list);
  }
  const selected = [...bins.values()].sort((a, b) => b.length - a.length)[0];
  return [0, 1, 2].map((channel) => selected.reduce((sum, color) => sum + color[channel], 0) / selected.length) as Color;
}

export function prepareEditableBackground(source: Raster, inputLines: InputLine[], pageWidth: number, pageHeight: number): { pixels: Uint8ClampedArray; lines: EditablePdfLine[]; warnings: string[] } {
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 || source.width * source.height > 25_000_000 || source.data.length !== source.width * source.height * 4) throw new Error('Ảnh OCR không hợp lệ.');
  if (![pageWidth, pageHeight].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Kích thước trang OCR không hợp lệ.');
  const pixels = source.data.slice();
  const lines: EditablePdfLine[] = [];
  const warnings = new Set<string>();
  for (const [index, input] of inputLines.entries()) {
    if (!input.text.trim() || !Object.values(input.bbox).every(Number.isFinite)) continue;
    const box = { x0: Math.max(0, Math.floor(input.bbox.x0)), y0: Math.max(0, Math.floor(input.bbox.y0)), x1: Math.min(source.width, Math.ceil(input.bbox.x1)), y1: Math.min(source.height, Math.ceil(input.bbox.y1)) };
    const width = box.x1 - box.x0;
    const height = box.y1 - box.y0;
    if (width <= 0 || height <= 0) continue;
    const radius = Math.max(2, Math.min(10, Math.ceil(height * 0.25)));
    const top: Color[] = [], bottom: Color[] = [];
    for (let x = box.x0; x < box.x1; x++) {
      top.push(sampleBackground(source, x, box.y0 - radius, box.y0, box.y0));
      bottom.push(sampleBackground(source, x, box.y1, box.y1 + radius, box.y1 - 1));
    }
    const background = [...top, ...bottom].reduce((sum, color) => sum + luminance(color), 0) / (width * 2);
    const protectedPixels = protectRules(source, box, background);
    const candidates: Color[] = [];
    const sampleStride = Math.max(1, Math.ceil(width * height / 50_000));
    let candidateCount = 0;
    const inkMask = new Uint8Array(width * height);
    for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
      const offset = (y - box.y0) * width + x - box.x0;
      if (protectedPixels[offset]) continue;
      const color = pixelColor(source.data, y * source.width + x);
      const paper = interpolate(top[x - box.x0], bottom[x - box.x0], (y - box.y0 + radius / 2) / (height + radius));
      if (luminance(paper) - luminance(color) >= 30) {
        inkMask[offset] = 1;
        if (candidateCount++ % sampleStride === 0) candidates.push(color);
      }
    }
    const ink = candidates.length ? dominantInk(candidates) : [0, 0, 0] as Color;
    let left = box.x1, right = box.x0, upper = box.y1, lower = box.y0;
    let retainedColored = 0;
    for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
      const offset = (y - box.y0) * width + x - box.x0;
      if (protectedPixels[offset]) continue;
      const color = pixelColor(source.data, y * source.width + x);
      if (!matchingInk(color, ink)) { if (inkMask[offset]) retainedColored++; continue; }
      const paper = interpolate(top[x - box.x0], bottom[x - box.x0], (y - box.y0 + radius / 2) / (height + radius));
      if (luminance(paper) - luminance(color) < 5) continue;
      let nearInk = false;
      for (let dy = -1; dy <= 1 && !nearInk; dy++) for (let dx = -1; dx <= 1; dx++) {
        const sx = x - box.x0 + dx, sy = y - box.y0 + dy;
        if (sx >= 0 && sx < width && sy >= 0 && sy < height && inkMask[sy * width + sx]) { nearInk = true; break; }
      }
      if (!nearInk) continue;
      const target = (y * source.width + x) * 4;
      pixels[target] = paper[0]; pixels[target + 1] = paper[1]; pixels[target + 2] = paper[2];
      left = Math.min(left, x); right = Math.max(right, x + 1); upper = Math.min(upper, y); lower = Math.max(lower, y + 1);
    }
    if (right <= left || lower <= upper) {
      warnings.add('Có vùng chữ chưa tách được khỏi nền. Hãy kiểm tra hình ảnh và chữ sau OCR.');
      continue;
    }
    if (retainedColored > Math.max(20, candidateCount * 0.1)) warnings.add('Đã giữ vùng màu chồng lên chữ. Hãy kiểm tra các dòng gần dấu hoặc hình vẽ.');
    const scaleX = pageWidth / source.width, scaleY = pageHeight / source.height;
    const lineHeight = (lower - upper) * scaleY;
    lines.push({ id: `line-${index + 1}`, text: input.text.trim(), x: left * scaleX, y: upper * scaleY, width: (right - left) * scaleX, height: lineHeight, fontSize: Math.max(1, lineHeight / 0.88), fontFamily: 'sans', bold: false, color: ink.map((value) => value / 255) as Color });
  }
  return { pixels, lines, warnings: [...warnings] };
}
