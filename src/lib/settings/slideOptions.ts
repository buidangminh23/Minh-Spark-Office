import type { SlideAspectRatio, SlideLaserColor, SlidePenColor, SlideQatCommand, SlideRibbonTabId } from './slideDefaults';

export type Box = { x: number; y: number; width: number; height: number };
export type ShowStep = { type: 'goto'; index: number } | { type: 'end' } | { type: 'exit' } | { type: 'stay' };

export const SLIDE_BASE_HEIGHT = 540;
export const MIN_ELEMENT_SIZE = 5;
export const MIN_UNDO_LIMIT = 3;
export const MAX_UNDO_LIMIT = 150;
export const DEFAULT_THEME_ID = 'office-classic';

export const SLIDE_FONTS = ['Segoe UI', 'Calibri', 'Arial', 'Roboto', 'Be Vietnam Pro', 'Montserrat', 'Playfair Display', 'Times New Roman'];
export const SLIDE_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96];

export const SLIDE_RIBBON_TABS: ReadonlyArray<readonly [SlideRibbonTabId, string]> = [
  ['home', 'Trang đầu'], ['insert', 'Chèn'], ['draw', 'Vẽ'], ['design', 'Thiết kế'], ['transitions', 'Chuyển tiếp'],
  ['animations', 'Hoạt hình'], ['slideshow', 'Trình chiếu'], ['review', 'Xem lại'], ['view', 'Xem'],
];

export const SLIDE_QAT_LABELS: Record<SlideQatCommand, string> = {
  save: 'Lưu',
  undo: 'Hoàn tác',
  redo: 'Làm lại',
  present: 'Trình chiếu từ đầu',
  presentCurrent: 'Trình chiếu từ trang hiện tại',
  newSlide: 'Trang chiếu mới',
  textBox: 'Hộp văn bản',
  find: 'Tìm và thay thế',
  print: 'In',
  pptx: 'Tải xuống .pptx',
  notes: 'Ghi chú',
};

export const LASER_COLORS: Record<SlideLaserColor, string> = { red: '#FF0033', green: '#16C60C', blue: '#0078D4' };
export const PEN_COLORS: Record<SlidePenColor, string> = { red: '#EF4444', blue: '#2563EB', green: '#16A34A', black: '#0F172A', yellow: '#FACC15' };

export function slideBaseWidth(aspectRatio: SlideAspectRatio) {
  return aspectRatio === '4:3' ? 720 : 960;
}

export function gridStepPercent(gridSize: number, aspectRatio: SlideAspectRatio) {
  return { x: (gridSize / slideBaseWidth(aspectRatio)) * 100, y: (gridSize / SLIDE_BASE_HEIGHT) * 100 };
}

export function snapTo(value: number, step: number) {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}

export function snapPosition(x: number, y: number, size: { width: number; height: number }, step: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(100 - size.width, snapTo(x, step.x))),
    y: Math.max(0, Math.min(100 - size.height, snapTo(y, step.y))),
  };
}

function snapEdge(start: number, length: number, step: number, moveStart: boolean) {
  if (moveStart) {
    const end = start + length;
    const snapped = snapTo(start, step);
    return end - snapped >= MIN_ELEMENT_SIZE ? { start: snapped, length: end - snapped } : { start, length };
  }
  const end = snapTo(start + length, step);
  return end - start >= MIN_ELEMENT_SIZE ? { start, length: end - start } : { start, length };
}

export function snapResize(box: Box, handle: string, step: { x: number; y: number }): Box {
  let { x, y, width, height } = box;
  if (handle.includes('w') || handle.includes('e')) ({ start: x, length: width } = snapEdge(x, width, step.x, handle.includes('w')));
  if (handle.includes('n') || handle.includes('s')) ({ start: y, length: height } = snapEdge(y, height, step.y, handle.includes('n')));
  return { x, y, width, height };
}

export function clampUndoLimit(limit: number) {
  if (!Number.isFinite(limit)) return MIN_UNDO_LIMIT;
  return Math.max(MIN_UNDO_LIMIT, Math.min(MAX_UNDO_LIMIT, Math.round(limit)));
}

export function trimHistory<T>(stack: T[], limit: number): T[] {
  const max = clampUndoLimit(limit);
  return stack.length > max ? stack.slice(stack.length - max) : stack;
}

export function zoomFromSetting(zoom: number): number | null {
  return zoom > 0 ? zoom : null;
}

export function isRibbonTabVisible(tabs: Partial<Record<SlideRibbonTabId, boolean>>, id: SlideRibbonTabId) {
  return id === 'home' || tabs[id] !== false;
}

export function visibleRibbonTabs(tabs: Partial<Record<SlideRibbonTabId, boolean>>) {
  return SLIDE_RIBBON_TABS.filter(([id]) => isRibbonTabVisible(tabs, id));
}

export function resolveThemeId(themeId: string, known: Record<string, unknown>) {
  return themeId in known ? themeId : DEFAULT_THEME_ID;
}

export function nextShowIndex(slides: ReadonlyArray<{ hidden?: boolean }>, current: number, loop: boolean): number | null {
  for (let index = current + 1; index < slides.length; index += 1) if (!slides[index].hidden) return index;
  if (!loop) return null;
  for (let index = 0; index <= current && index < slides.length; index += 1) if (!slides[index].hidden) return index;
  return null;
}

export function resolveAdvance(options: { slides: ReadonlyArray<{ hidden?: boolean }>; current: number; loop: boolean; endWithBlack: boolean; atEnd: boolean }): ShowStep {
  if (options.atEnd) return { type: 'exit' };
  const next = nextShowIndex(options.slides, options.current, options.loop);
  if (next !== null && (next !== options.current || options.loop)) return { type: 'goto', index: next };
  return options.endWithBlack ? { type: 'end' } : { type: 'stay' };
}
