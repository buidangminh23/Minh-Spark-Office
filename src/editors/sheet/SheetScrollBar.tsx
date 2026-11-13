import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { findGridCanvas, viewOf, type FormButtonSheet } from './FormButtonLayer';

export type ScrollBarSheet = FormButtonSheet & { getMaxColumns(): number };

type Props = {
  container: RefObject<HTMLDivElement | null>;
  getSheet: () => ScrollBarSheet | null;
  scrollBy: (sheetPixels: number) => void;
};

export type ScrollBarExtent = { left: number; top: number; full: number; content: number; viewport: number; position: number };

type BarProps = {
  storageKey: string;
  readExtent: (strip: HTMLElement) => ScrollBarExtent | null;
  scrollBy: (contentPixels: number) => void;
};

type Geometry = { range: number; travel: number; page: number; full: number };

const BAR_SIZE = 16;
const CONTROL_SIZE = 16;
const MIN_THUMB = 28;
const MIN_BAR = CONTROL_SIZE * 3 + MIN_THUMB;
const ARROW_STEP = 72;
const HOLD_DELAY_MS = 320;
const HOLD_INTERVAL_MS = 60;
const SHEET_WIDTH_KEY = 'minh-office-sheet-hscroll-width';
const FULL_RATIO = 1;

function readRatio(key: string): number {
  try {
    const stored = Number(localStorage.getItem(key));
    return stored > 0 && stored <= FULL_RATIO ? stored : FULL_RATIO;
  } catch {
    return FULL_RATIO;
  }
}

function saveRatio(key: string, ratio: number) {
  try {
    localStorage.setItem(key, String(ratio));
  } catch {
    return;
  }
}

function sheetExtent(sheet: ScrollBarSheet, host: HTMLElement, strip: HTMLElement): ScrollBarExtent | null {
  const canvas = findGridCanvas(host);
  const frame = strip.offsetParent?.getBoundingClientRect();
  if (!canvas || !frame) return null;
  const area = canvas.getBoundingClientRect();
  const view = viewOf(sheet);
  const last = sheet.getRange(0, Math.max(0, sheet.getMaxColumns() - 1), 1, 1).getCellRect() as { x: number; width?: number };
  const full = Math.max(0, area.width - BAR_SIZE);
  return {
    left: area.left - frame.left,
    top: area.bottom - frame.top - BAR_SIZE,
    full,
    content: last.x + (last.width ?? 0) - view.origin.x - view.frozen.x,
    viewport: Math.max(1, full / view.zoom - view.origin.x - view.frozen.x),
    position: view.scroll.x,
  };
}

function layoutOf(extent: ScrollBarExtent, ratio: number) {
  const { full, content, viewport, position } = extent;
  const range = Math.max(0, content - viewport);
  const barWidth = Math.min(full, Math.max(MIN_BAR, full * ratio));
  const track = Math.max(0, barWidth - CONTROL_SIZE * 3);
  const thumb = range > 0 ? Math.min(track, Math.max(MIN_THUMB, (track * viewport) / content)) : track;
  const travel = Math.max(0, track - thumb);
  const offset = range > 0 ? travel * Math.min(1, Math.max(0, position / range)) : 0;
  return { barWidth, thumb, offset, geometry: { range, travel, page: viewport, full } };
}

export function SheetScrollBar({ container, getSheet, scrollBy }: Props) {
  const getSheetRef = useRef(getSheet);
  useEffect(() => {
    getSheetRef.current = getSheet;
  });
  const readExtent = useCallback(
    (strip: HTMLElement) => {
      const host = container.current;
      const sheet = getSheetRef.current();
      return host && sheet ? sheetExtent(sheet, host, strip) : null;
    },
    [container],
  );
  return <HorizontalScrollBar storageKey={SHEET_WIDTH_KEY} readExtent={readExtent} scrollBy={scrollBy} />;
}

export function DomScrollBar({ target, storageKey }: { target: HTMLElement | null; storageKey: string }) {
  const readExtent = useCallback(
    (strip: HTMLElement) => {
      const frame = strip.offsetParent?.getBoundingClientRect();
      if (!target || !frame) return null;
      const area = target.getBoundingClientRect();
      return {
        left: area.left - frame.left,
        top: area.top - frame.top + target.clientHeight - BAR_SIZE,
        full: target.clientWidth,
        content: target.scrollWidth,
        viewport: target.clientWidth,
        position: target.scrollLeft,
      };
    },
    [target],
  );
  const scrollBy = useCallback(
    (contentPixels: number) => {
      if (target) target.scrollLeft += contentPixels;
    },
    [target],
  );
  if (!target) return null;
  return <HorizontalScrollBar storageKey={storageKey} readExtent={readExtent} scrollBy={scrollBy} />;
}

function HorizontalScrollBar({ storageKey, readExtent, scrollBy }: BarProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const ratioRef = useRef(FULL_RATIO);
  const geometryRef = useRef<Geometry>({ range: 0, travel: 0, page: 0, full: 0 });
  const readExtentRef = useRef(readExtent);
  const scrollByRef = useRef(scrollBy);
  useEffect(() => {
    readExtentRef.current = readExtent;
    scrollByRef.current = scrollBy;
  });

  useEffect(() => {
    ratioRef.current = readRatio(storageKey);
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const strip = stripRef.current;
      const bar = barRef.current;
      const thumb = thumbRef.current;
      if (!strip || !bar || !thumb) return;
      let extent: ScrollBarExtent | null = null;
      try {
        extent = readExtentRef.current(strip);
      } catch {
        extent = null;
      }
      strip.style.visibility = extent && extent.full > MIN_BAR ? 'visible' : 'hidden';
      if (!extent) return;
      const layout = layoutOf(extent, ratioRef.current);
      geometryRef.current = layout.geometry;
      strip.style.transform = `translate(${extent.left}px, ${extent.top}px)`;
      strip.style.width = `${extent.full}px`;
      bar.style.width = `${layout.barWidth}px`;
      thumb.style.width = `${layout.thumb}px`;
      thumb.style.transform = `translateX(${layout.offset}px)`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

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
      () => saveRatio(storageKey, ratioRef.current),
    );

  const toggleWidth = () => {
    const { full } = geometryRef.current;
    ratioRef.current = full > 0 && ratioRef.current * full > MIN_BAR + 1 ? MIN_BAR / full : FULL_RATIO;
    saveRatio(storageKey, ratioRef.current);
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
