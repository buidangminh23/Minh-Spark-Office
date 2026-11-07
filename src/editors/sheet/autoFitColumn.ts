export const DEFAULT_CELL_FONT_SIZE_PT = 11;
export const DEFAULT_CELL_FONT_FAMILY = 'Arial';
export const CELL_TEXT_PADDING_PX = 10;
const PT_TO_PX = 96 / 72;

export interface CellFontSpec {
  sizePt: number;
  family: string;
  bold: boolean;
  italic: boolean;
}

export type TextMeasurer = (text: string, cssFont: string) => number;

export const cellFontCss = (font: CellFontSpec): string => {
  const style = font.italic ? 'italic ' : '';
  const weight = font.bold ? 'bold ' : '';
  return `${style}${weight}${font.sizePt * PT_TO_PX}px ${font.family}`;
};

export const requiredColumnWidthPx = (text: string, font: CellFontSpec, measure: TextMeasurer): number => {
  const css = cellFontCss(font);
  const widest = text.split(/\r?\n/).reduce((max, line) => Math.max(max, measure(line, css)), 0);
  return Math.ceil(widest + CELL_TEXT_PADDING_PX);
};

export const shouldWidenColumn = (text: string, requiredPx: number, currentPx: number): boolean =>
  text.trim() !== '' && requiredPx > currentPx;

export const keepWidestColumn = (beforePx: number, afterPx: number): number => Math.max(beforePx, afterPx);

let measureCanvas: HTMLCanvasElement | null = null;

export const measureTextWithCanvas: TextMeasurer = (text, cssFont) => {
  if (typeof document === 'undefined') return text.length * 7;
  measureCanvas ??= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return text.length * 7;
  ctx.font = cssFont;
  return ctx.measureText(text).width;
};
