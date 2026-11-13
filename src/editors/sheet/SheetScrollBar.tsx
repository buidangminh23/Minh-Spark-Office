import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { findGridCanvas, viewOf, type FormButtonSheet } from './FormButtonLayer';

export type ScrollBarSheet = FormButtonSheet & { getMaxColumns(): number };

type Props = {
  container: RefObject<HTMLDivElement | null>;
  getSheet: () => ScrollBarSheet | null;
  scrollBy: (sheetPixels: number) => void;
};

type Geometry = { range: number; travel: number; page: number; full: number };

const BAR_SIZE = 16;
const CONTROL_SIZE = 16;
const MIN_THUMB = 28;
const MIN_BAR = CONTROL_SIZE * 3 + MIN_THUMB;
const ARROW_STEP = 72;
const HOLD_DELAY_MS = 320;
const HOLD_INTERVAL_MS = 60;
const WIDTH_KEY = 'minh-office-sheet-hscroll-width';
const FULL_RATIO = 1;

function readRatio(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    return stored > 0 && stored <= FULL_RATIO ? stored : FULL_RATIO;
  } catch {
    return FULL_RATIO;
  }
}

function saveRatio(ratio: number) {
  try {
    localStorage.setItem(WIDTH_KEY, String(ratio));
  } catch {
    return;
  }
}

function measure(sheet: ScrollBarSheet, host: HTMLElement, strip: HTMLElement, ratio: number) {
  const canvas = findGridCanvas(host);
  const frame = strip.offsetParent?.getBoundingClientRect();
  if (!canvas || !frame) return null;
  const area = canvas.getBoundingClientRect();
  const view = viewOf(sheet);
  const last = sheet.getRange(0, Math.max(0, sheet.getMaxColumns() - 1), 1, 1).getCellRect() as { x: number; width?: number };
  const content = last.x + (last.width ?? 0) - view.origin.x - view.frozen.x;
  const full = Math.max(0, area.width - BAR_SIZE);
  const viewport = Math.max(1, full / view.zoom - view.origin.x - view.frozen.x);
  const range = Math.max(0, content - viewport);
  const barWidth = Math.min(full, Math.max(MIN_BAR, full * ratio));
  const track = Math.max(0, barWidth - CONTROL_SIZE * 3);
  const thumb = range > 0 ? Math.min(track, Math.max(MIN_THUMB, (track * viewport) / content)) : track;
  const travel = Math.max(0, track - thumb);
  const offset = range > 0 ? travel * Math.min(1, Math.max(0, view.scroll.x / range)) : 0;
  return { left: area.left - frame.left, top: area.bottom - frame.top - BAR_SIZE, full, barWidth, thumb, offset, geometry: { range, travel, page: viewport, full } };
}

export function SheetScrollBar({ container, getSheet, scrollBy }: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const ratioRef = useRef(FULL_RATIO);
  const geometryRef = useRef<Geometry>({ range: 0, travel: 0, page: 0, full: 0 });
  const getSheetRef = useRef(getSheet);
  const scrollByRef = useRef(scrollBy);
  useEffect(() => {
    getSheetRef.current = getSheet;
    scrollByRef.current = scrollBy;
  });

  useEffect(() => {
    ratioRef.current = readRatio();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const strip = stripRef.current;
      const bar = barRef.current;
      const thumb = thumbRef.current;
      const host = container.current;
      const sheet = getSheetRef.current();
      if (!strip || !bar || !thumb || !host) return;
      let layout: ReturnType<typeof measure> = null;
      try {
        layout = sheet ? measure(sheet, host, strip, ratioRef.current) : null;
      } catch {
        layout = null;
      }
      strip.style.visibility = layout && layout.full > MIN_BAR ? 'visible' : 'hidden';
      if (!layout) return;
      geometryRef.current = layout.geometry;
      strip.style.transform = `translate(${layout.left}px, ${layout.top}px)`;
      strip.style.width = `${layout.full}px`;
      bar.style.width = `${layout.barWidth}px`;
      thumb.style.width = `${layout.thumb}px`;
      thumb.style.transform = `translateX(${layout.offset}px)`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [container]);

  const drag = (event: ReactPointerEvent<HTMLElement>, onMove: (deltaX: number) => void, onEnd?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    let lastX = event.clientX;
    const move = (next: PointerEvent) => {
      onMove(next.clientX - lastX);
      lastX = next.clientX;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const dragThumb = (event: ReactPointerEvent<HTMLElement>) =>
    drag(event, (deltaX) => {
      const { range, travel } = geometryRef.current;
      if (travel > 0) scrollByRef.current((deltaX * range) / travel);
    });

  const dragGrip = (event: ReactPointerEvent<HTMLElement>) =>
    drag(
      event,
      (deltaX) => {
        const { full } = geometryRef.current;
        if (full <= 0) return;
        const width = Math.min(full, Math.max(MIN_BAR, full * ratioRef.current - deltaX));
        ratioRef.current = width / full;
      },
      () => saveRatio(ratioRef.current),
    );

  const toggleWidth = () => {
    const { full } = geometryRef.current;
    ratioRef.current = full > 0 && ratioRef.current * full > MIN_BAR + 1 ? MIN_BAR / full : FULL_RATIO;
    saveRatio(ratioRef.current);
  };

  const hold = (event: ReactPointerEvent<HTMLElement>, step: number) => {
    event.preventDefault();
    event.stopPropagation();
    scrollByRef.current(step);
    let repeat = 0;
    const delay = window.setTimeout(() => {
      repeat = window.setInterval(() => scrollByRef.current(step), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
    const stop = () => {
      window.clearTimeout(delay);
      window.clearInterval(repeat);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointerup', stop);
  };

  const pageTrack = (event: ReactPointerEvent<HTMLElement>) => {
    const thumb = thumbRef.current?.getBoundingClientRect();
    if (!thumb) return;
    hold(event, event.clientX < thumb.left ? -geometryRef.current.page : geometryRef.current.page);
  };

  return (
    <div ref={stripRef} className="sheet-hscroll" style={{ visibility: 'hidden' }}>
      <div ref={barRef} className="sheet-hscroll-bar">
        <button type="button" className="sheet-hscroll-grip" title="Kéo để thu gọn hoặc nới thanh cuộn, bấm đúp để thu gọn hẳn" aria-label="Thu gọn thanh cuộn ngang" onPointerDown={dragGrip} onDoubleClick={toggleWidth} />
        <button type="button" className="sheet-hscroll-arrow sheet-hscroll-left" aria-label="Cuộn sang trái" tabIndex={-1} onPointerDown={(event) => hold(event, -ARROW_STEP)} />
        <div className="sheet-hscroll-track" onPointerDown={pageTrack}>
          <div ref={thumbRef} className="sheet-hscroll-thumb" onPointerDown={dragThumb} />
        </div>
        <button type="button" className="sheet-hscroll-arrow sheet-hscroll-right" aria-label="Cuộn sang phải" tabIndex={-1} onPointerDown={(event) => hold(event, ARROW_STEP)} />
      </div>
    </div>
  );
}
