export type Rgb = [number, number, number];
export type PixelBox = { x: number; y: number; width: number; height: number };
export type PixelImage = { data: Uint8ClampedArray; width: number; height: number };
export type TextSegment = { text: string; box: PixelBox; words?: { text: string; box: PixelBox }[] };
export type PaintedRun = { text: string; bold: boolean };
export type PaintedLine = { ink: PixelBox; color: Rgb; background: Rgb; fontPx: number; capOffset: number; runs: PaintedRun[] };
export type SourceWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence?: number };
export type SourceLine = SourceWord & { words?: SourceWord[] };
export type SourceItem = { text: string; x: number; y: number; width: number; height: number };

const INK_THRESHOLD = 60;
const BOLD_STROKE_RATIO = 0.13;

const toBox = ({ x0, y0, x1, y1 }: SourceWord['bbox']): PixelBox => ({ x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) });

function unionBox(boxes: PixelBox[]): PixelBox {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

const SYMBOL_ONLY = /^[^\p{L}\p{N}]{1,3}$/u;
const OUTLIER_HEIGHT = 1.8;
const MIN_CONFIDENCE = 40;
const BULLET_LOOKALIKE = /^[eoº°·•◦]$/;
const MIN_EDITABLE_CHARACTERS = 4;
const WIDTH_TOLERANCE = 1.02;

export type MeasureText = (text: string, fontPx: number, bold: boolean) => number;

const trusted = (word: SourceWord) => word.confidence === undefined || word.confidence >= MIN_CONFIDENCE;

function trustedWords(line: SourceLine) {
  const words = (line.words ?? []).filter((word) => word.text.trim() && trusted(word)).map((word) => ({ text: word.text.trim(), box: toBox(word.bbox) }));
  if (!words.length) return words;
  const typical = median(words.map((word) => word.box.height));
  return words.filter((word) => word.box.height <= typical * OUTLIER_HEIGHT);
}

function trimSymbols<T extends { text: string }>(group: T[]): T[] {
  let start = 0;
  let end = group.length;
  while (start < end && SYMBOL_ONLY.test(group[start].text)) start++;
  while (end > start && SYMBOL_ONLY.test(group[end - 1].text)) end--;
  return group.slice(start, end);
}

export function segmentsFromOcr(lines: SourceLine[]): TextSegment[] {
  const segments: TextSegment[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || SYMBOL_ONLY.test(text) || !trusted(line)) continue;
    if (!line.words?.length) {
      segments.push({ text, box: toBox(line.bbox) });
      continue;
    }
    const words = trustedWords(line);
    if (!words.length) continue;
    if (words.length === 1) {
      if (!SYMBOL_ONLY.test(words[0].text)) segments.push({ text: words[0].text, box: words[0].box, words });
      continue;
    }
    const height = median(words.map((word) => word.box.height));
    let group = [words[0]];
    for (let index = 1; index <= words.length; index++) {
      const word = words[index];
      const previous = group[group.length - 1];
      if (word && word.box.x - (previous.box.x + previous.box.width) <= Math.max(8, height * 1.5)) {
        group.push(word);
        continue;
      }
      const kept = trimSymbols(group);
      if (kept.length) segments.push({ text: kept.map((entry) => entry.text).join(' '), box: unionBox(kept.map((entry) => entry.box)), words: kept });
      if (word) group = [word];
    }
  }
  return segments;
}

export function segmentsFromTextItems(items: SourceItem[], scale: number): TextSegment[] {
  const rows: { y: number; height: number; parts: SourceItem[] }[] = [];
  for (const item of items.filter((entry) => entry.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.findLast((entry) => Math.abs(entry.y - item.y) <= Math.max(2, Math.min(entry.height, item.height) * 0.45));
    if (row) row.parts.push(item);
    else rows.push({ y: item.y, height: item.height, parts: [item] });
  }
  const segments: TextSegment[] = [];
  for (const row of rows) {
    let current: { text: string; parts: SourceItem[] } | null = null;
    let right = -Infinity;
    for (const part of row.parts.sort((a, b) => a.x - b.x)) {
      const gap = part.x - right;
      if (current && gap <= Math.max(12, part.height * 1.5)) {
        current.text += `${gap > part.height * 0.15 && !current.text.endsWith(' ') && !part.text.startsWith(' ') ? ' ' : ''}${part.text}`;
        current.parts.push(part);
      } else {
        if (current) segments.push(itemSegment(current, scale));
        current = { text: part.text, parts: [part] };
      }
      right = Math.max(right, part.x + part.width);
    }
    if (current) segments.push(itemSegment(current, scale));
  }
  return segments.filter((segment) => segment.text.trim());
}

function itemSegment(group: { text: string; parts: SourceItem[] }, scale: number): TextSegment {
  const box = unionBox(group.parts.map((part) => ({ x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale })));
  return { text: group.text.trim().replace(/\s+/g, ' '), box };
}

function clampBox(box: PixelBox, image: PixelImage): PixelBox {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(image.width, Math.ceil(box.x + box.width));
  const bottom = Math.min(image.height, Math.ceil(box.y + box.height));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

const median = (values: number[]) => {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function backgroundColor(image: PixelImage, box: PixelBox, pad: number): Rgb {
  const ring = clampBox({ x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 }, image);
  const channels: number[][] = [[], [], []];
  const add = (x: number, y: number) => {
    const offset = (y * image.width + x) * 4;
    for (let channel = 0; channel < 3; channel++) channels[channel].push(image.data[offset + channel]);
  };
  const right = ring.x + ring.width - 1;
  const bottom = ring.y + ring.height - 1;
  if (ring.width <= 0 || ring.height <= 0) return [255, 255, 255];
  for (let x = ring.x; x <= right; x++) { add(x, ring.y); add(x, bottom); }
  for (let y = ring.y + 1; y < bottom; y++) { add(ring.x, y); add(right, y); }
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

const distance = (data: Uint8ClampedArray, offset: number, color: Rgb) =>
  Math.max(Math.abs(data[offset] - color[0]), Math.abs(data[offset + 1] - color[1]), Math.abs(data[offset + 2] - color[2]));

export function fontMetrics(text: string, inkHeight: number) {
  const tall = /[A-Z0-9bdfhkltĐÀ-ỹ&@#%(){}[\]/\\|!?'"]/.test(text);
  const deep = /[gjpqy,;(){}[\]|]/.test(text);
  const above = tall ? 0.72 : 0.53;
  const below = deep ? 0.21 : 0;
  const fontPx = Math.max(1, inkHeight / (above + below));
  return { fontPx, capOffset: (0.905 - above) * fontPx };
}

function strokeWidth(image: PixelImage, box: PixelBox, background: Rgb): number {
  const runs: number[] = [];
  for (let y = box.y; y < box.y + box.height; y++) {
    let run = 0;
    for (let x = box.x; x < box.x + box.width; x++) {
      if (distance(image.data, (y * image.width + x) * 4, background) > INK_THRESHOLD) run++;
      else if (run) { runs.push(run); run = 0; }
    }
    if (run) runs.push(run);
  }
  return runs.length ? median(runs) : 0;
}

function columnSpans(image: PixelImage, box: PixelBox, background: Rgb, minGap: number): PixelBox[] {
  const spans: PixelBox[] = [];
  let start = -1;
  let gap = 0;
  for (let x = box.x; x <= box.x + box.width; x++) {
    let ink = false;
    if (x < box.x + box.width) {
      for (let y = box.y; y < box.y + box.height && !ink; y++) ink = distance(image.data, (y * image.width + x) * 4, background) > INK_THRESHOLD;
    }
    if (ink) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap >= minGap || x === box.x + box.width) {
        spans.push({ x: start, y: box.y, width: x - gap + 1 - start, height: box.height });
        start = -1;
        gap = 0;
      }
    }
  }
  return spans;
}

export function paintLine(image: PixelImage, segment: TextSegment): PaintedLine | null {
  const area = clampBox(segment.box, image);
  if (!area.width || !area.height) return null;
  const pad = Math.max(2, Math.round(area.height * 0.15));
  const background = backgroundColor(image, area, pad);
  let maxDistance = 0;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      const value = distance(image.data, (y * image.width + x) * 4, background);
      if (value <= INK_THRESHOLD) continue;
      maxDistance = Math.max(maxDistance, value);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (!Number.isFinite(left)) return null;
  const ink = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = ink.y; y < ink.y + ink.height; y++) {
    for (let x = ink.x; x < ink.x + ink.width; x++) {
      const offset = (y * image.width + x) * 4;
      if (distance(image.data, offset, background) < maxDistance * 0.7) continue;
      for (let channel = 0; channel < 3; channel++) sum[channel] += image.data[offset + channel];
      count++;
    }
  }
  const color: Rgb = [Math.round(sum[0] / count), Math.round(sum[1] / count), Math.round(sum[2] / count)];
  const { fontPx, capOffset } = fontMetrics(segment.text, ink.height);
  const words = segment.text.split(/\s+/).filter(Boolean);
  const wordBoxes = segment.words?.length === words.length
    ? segment.words.map((word) => clampBox(word.box, image))
    : (() => {
      const spans = columnSpans(image, ink, background, Math.max(2, Math.round(fontPx * 0.22)));
      return spans.length === words.length ? spans : null;
    })();
  const boldAt = (box: PixelBox) => strokeWidth(image, box, background) / fontPx >= BOLD_STROKE_RATIO;
  const runs: PaintedRun[] = [];
  if (wordBoxes) {
    words.forEach((source, index) => {
      const word = BULLET_LOOKALIKE.test(source) && tightHeight(image, wordBoxes[index], background) < fontPx * 0.45 ? '•' : source;
      const previous = runs[runs.length - 1];
      const bold = previous && SYMBOL_ONLY.test(word) ? previous.bold : boldAt(wordBoxes[index]);
      const last = runs[runs.length - 1];
      if (last && last.bold === bold) last.text += ` ${word}`;
      else runs.push({ text: runs.length ? ` ${word}` : word, bold });
    });
  } else runs.push({ text: words.join(' '), bold: boldAt(ink) });
  return { ink, color, background, fontPx, capOffset, runs };
}

function tightHeight(image: PixelImage, box: PixelBox, background: Rgb): number {
  let top = Infinity;
  let bottom = -Infinity;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      if (distance(image.data, (y * image.width + x) * 4, background) <= INK_THRESHOLD) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      break;
    }
  }
  return Number.isFinite(top) ? bottom - top + 1 : 0;
}

export function eraseLine(image: PixelImage, line: PaintedLine) {
  const pad = Math.max(2, Math.round(line.fontPx * 0.12));
  const area = clampBox({ x: line.ink.x - pad, y: line.ink.y - pad, width: line.ink.width + pad * 2, height: line.ink.height + pad * 2 }, image);
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = line.background[0];
      image.data[offset + 1] = line.background[1];
      image.data[offset + 2] = line.background[2];
      image.data[offset + 3] = 255;
    }
  }
}

const editableLength = (line: PaintedLine) => line.runs.map((run) => run.text).join('').replace(/[^\p{L}\p{N}]/gu, '').length;

export function fitToInk(line: PaintedLine, measure: MeasureText): PaintedLine {
  const width = line.runs.reduce((sum, run) => sum + measure(run.text, line.fontPx, run.bold), 0);
  if (width <= line.ink.width * WIDTH_TOLERANCE) return line;
  const ratio = line.ink.width / width;
  return { ...line, fontPx: line.fontPx * ratio, capOffset: line.capOffset * ratio };
}

export function paintAndErase(image: PixelImage, segments: TextSegment[], measure?: MeasureText): PaintedLine[] {
  const painted = segments.map((segment) => paintLine(image, segment)).filter((line): line is PaintedLine => line !== null && editableLength(line) >= MIN_EDITABLE_CHARACTERS);
  for (const line of painted) eraseLine(image, line);
  return measure ? painted.map((line) => fitToInk(line, measure)) : painted;
}

export const rgbHex = (color: Rgb) => color.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
