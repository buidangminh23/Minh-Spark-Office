import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import type { MediaTextLine } from './mediaConversion';

export type PdfTextSpan = { item: TextItem; line: MediaTextLine };
type Glyph = { text: string; start: number; end: number };
type Run = { glyphs: Glyph[]; text: string; offsets: Map<number, number> };
type FontState = { name: string; size: number; charSpacing: number; wordSpacing: number };

function overlappingSpans(spans: PdfTextSpan[]) {
  const rows = new Map<number, PdfTextSpan[]>();
  const overlaps = new Map<PdfTextSpan, MediaTextLine[]>();
  for (const span of spans) {
    if (span.line.rotated || span.item.dir !== 'ltr') continue;
    const baseline = Math.round((span.line.y + span.line.height) * 2);
    const row = rows.get(baseline);
    if (row) row.push(span);
    else rows.set(baseline, [span]);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.line.x - b.line.x);
    for (let i = 0; i < row.length; i++) {
      const span = row[i];
      if (span.item.str.trim().length < 2) continue;
      const end = span.line.x + span.line.width;
      for (let j = i + 1; j < row.length && row[j].line.x < end - 0.5; j++) {
        const other = row[j];
        if (other.item.fontName === span.item.fontName || other.line.x <= span.line.x + 0.5 || other.line.x + other.line.width > end + 0.5) continue;
        const entries = overlaps.get(span);
        if (entries) entries.push(other.line);
        else overlaps.set(span, [other.line]);
      }
    }
  }
  return overlaps;
}

function glyphRun(data: unknown[], state: FontState): Run {
  const glyphs: Glyph[] = [];
  const offsets = new Map<number, number>();
  let text = '';
  let x = 0;
  for (const entry of data) {
    if (typeof entry === 'number') { x -= entry / 1000; continue; }
    if (!entry || typeof entry !== 'object' || !('unicode' in entry) || !('width' in entry) || typeof entry.unicode !== 'string' || typeof entry.width !== 'number') continue;
    const start = x;
    x += entry.width / 1000 + (state.charSpacing + ('isSpace' in entry && entry.isSpace ? state.wordSpacing : 0)) / state.size;
    const visible = entry.unicode.replace(/\s+/gu, '');
    if (visible) offsets.set(text.length, glyphs.length);
    text += visible;
    glyphs.push({ text: entry.unicode, start, end: x });
  }
  return { glyphs, text, offsets };
}

async function pageGlyphRuns(page: PDFPageProxy, needed: Set<string>) {
  const [operations, { OPS }] = await Promise.all([page.getOperatorList(), import('pdfjs-dist/legacy/build/pdf.mjs')]);
  const fonts = new Map<string, Run[]>();
  let state: FontState = { name: '', size: 0, charSpacing: 0, wordSpacing: 0 };
  const stack: FontState[] = [];
  for (let i = 0; i < operations.fnArray.length; i++) {
    const args = operations.argsArray[i];
    switch (operations.fnArray[i]) {
      case OPS.save: case OPS.paintFormXObjectBegin: stack.push({ ...state }); break;
      case OPS.restore: case OPS.paintFormXObjectEnd: state = stack.pop() ?? state; break;
      case OPS.setCharSpacing: state.charSpacing = args[0]; break;
      case OPS.setWordSpacing: state.wordSpacing = args[0]; break;
      case OPS.setFont: state.name = args[0]; state.size = args[1]; break;
      case OPS.showText: {
        if (!needed.has(state.name) || !state.size || !args[0].some((v: unknown) => typeof v === 'number' && v < -80)) break;
        const run = glyphRun(args[0], state);
        const runs = fonts.get(state.name);
        if (runs) runs.push(run);
        else fonts.set(state.name, [run]);
        break;
      }
    }
  }
  return fonts;
}

function splitAtFilledGaps(span: PdfTextSpan, overlaps: MediaTextLine[], runs: Run[]) {
  const needle = span.item.str.replace(/\s+/gu, '');
  const scale = Math.hypot(span.item.transform[0], span.item.transform[1]);
  for (const run of runs) {
    for (let offset = run.text.indexOf(needle); offset >= 0; offset = run.text.indexOf(needle, offset + 1)) {
      const first = run.offsets.get(offset);
      if (first === undefined) continue;
      let last = first;
      let count = 0;
      while (last < run.glyphs.length) {
        count += run.glyphs[last].text.replace(/\s+/gu, '').length;
        if (count >= needle.length) break;
        last++;
      }
      if (count !== needle.length) continue;
      const origin = run.glyphs[first].start;
      const position = (x: number) => span.line.x + (x - origin) * scale;
      const extent = (run.glyphs[last].end - origin) * scale;
      if (Math.abs(extent - span.item.width) > Math.max(0.25, scale * 0.035)) continue;
      const parts: MediaTextLine[] = [];
      let start = first;
      let text = run.glyphs[first].text;
      for (let i = first + 1; i <= last; i++) {
        const left = position(run.glyphs[i - 1].end);
        const right = position(run.glyphs[i].start);
        const filled = right > left + scale * 0.08 && overlaps.some((other) => other.x >= left - 0.5 && other.x + other.width <= right + 0.5);
        if (filled) {
          const x = position(run.glyphs[start].start);
          parts.push({ ...span.line, x, text, width: left - x });
          text = '';
          start = i;
        } else if (right - left > scale * 0.2 && !text.endsWith(' ') && !run.glyphs[i].text.startsWith(' ')) text += ' ';
        text += run.glyphs[i].text;
      }
      if (parts.length) {
        const x = position(run.glyphs[start].start);
        parts.push({ ...span.line, x, text, width: position(run.glyphs[last].end) - x });
        return parts;
      }
    }
  }
  return [span.line];
}

export async function pdfReadingSpans(page: PDFPageProxy, spans: PdfTextSpan[]): Promise<MediaTextLine[]> {
  const overlaps = overlappingSpans(spans);
  if (!overlaps.size) return spans.map(span => span.line);
  const runs = await pageGlyphRuns(page, new Set([...overlaps.keys()].map(span => span.item.fontName)));
  return spans.flatMap(span => {
    const others = overlaps.get(span);
    return others ? splitAtFilledGaps(span, others, runs.get(span.item.fontName) ?? []) : [span.line];
  });
}
