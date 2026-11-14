import type PptxGenJS from 'pptxgenjs';
import { rgbHex, type PaintedLine } from './slideTextPaint';

export type EditableSlide = { width: number; height: number; scale: number; background: string; lines: PaintedLine[] };

export const EDITABLE_SLIDE_WIDTH = 40 / 3;
const MAX_SLIDE_HEIGHT = 56;
const POINTS_PER_INCH = 72;
const FONT_FACE = 'Arial';
const WIDTH_ALLOWANCE = 1.15;

export function slideFrame(slide: EditableSlide, deckWidth: number, deckHeight: number) {
  const inchesPerUnit = Math.min(deckWidth / slide.width, deckHeight / slide.height);
  return { inchesPerUnit, offsetX: (deckWidth - slide.width * inchesPerUnit) / 2, offsetY: (deckHeight - slide.height * inchesPerUnit) / 2 };
}

export function textBoxFor(line: PaintedLine, pixelsPerUnit: number, frame: ReturnType<typeof slideFrame>) {
  const toInches = (pixels: number) => (pixels / pixelsPerUnit) * frame.inchesPerUnit;
  const fontSize = Math.max(4, Math.round(toInches(line.fontPx) * POINTS_PER_INCH * 2) / 2);
  return {
    x: frame.offsetX + toInches(line.ink.x),
    y: frame.offsetY + toInches(line.ink.y - line.capOffset),
    w: toInches(line.ink.width * WIDTH_ALLOWANCE + line.fontPx * 0.5),
    h: toInches(line.fontPx * 1.25),
    fontSize,
  };
}

export function fillEditableDeck(deck: PptxGenJS, slides: EditableSlide[], title: string) {
  const first = slides[0];
  const deckWidth = EDITABLE_SLIDE_WIDTH;
  const deckHeight = Math.min(MAX_SLIDE_HEIGHT, (deckWidth * first.height) / first.width);
  deck.defineLayout({ name: 'EDITABLE', width: deckWidth, height: deckHeight });
  deck.layout = 'EDITABLE';
  deck.title = title;
  for (const page of slides) {
    const slide = deck.addSlide();
    const frame = slideFrame(page, deckWidth, deckHeight);
    const fullBleed = Math.abs(frame.offsetX) < 0.001 && Math.abs(frame.offsetY) < 0.001;
    if (fullBleed) slide.background = { data: page.background };
    else slide.addImage({ data: page.background, x: frame.offsetX, y: frame.offsetY, w: page.width * frame.inchesPerUnit, h: page.height * frame.inchesPerUnit });
    for (const line of page.lines) {
      const box = textBoxFor(line, page.scale, frame);
      slide.addText(
        line.runs.map((run) => ({ text: run.text, options: { bold: run.bold } })),
        { ...box, fontFace: FONT_FACE, color: rgbHex(line.color), margin: 0, valign: 'top', wrap: false, fit: 'none', paraSpaceBefore: 0, paraSpaceAfter: 0, lineSpacingMultiple: 1 },
      );
    }
  }
  return deck;
}
