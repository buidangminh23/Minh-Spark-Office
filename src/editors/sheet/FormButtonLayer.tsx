import { useEffect, useRef, type RefObject } from 'react';
import type { FormButton, FormButtonAnchor } from '../../lib/formButtons';

type CellBox = { x: number; y: number };

export type FormButtonSheet = {
  getZoom(): number;
  getScrollState(): { sheetViewStartRow: number; sheetViewStartColumn: number; offsetX: number; offsetY: number };
  getRange(row: number, column: number, rows: number, columns: number): { getCellRect(): CellBox };
};

type Props = {
  buttons: FormButton[];
  container: RefObject<HTMLDivElement | null>;
  getSheet: () => FormButtonSheet | null;
  onRun: (button: FormButton) => void;
};

const DEFAULT_FONT_POINTS = 10;
const POINTS_TO_PIXELS = 4 / 3;
const MIN_GRID_CANVAS_WIDTH = 200;

const findGridCanvas = (host: HTMLElement) =>
  [...host.querySelectorAll('canvas')].reduce<HTMLCanvasElement | null>((best, canvas) => {
    const width = canvas.getBoundingClientRect().width;
    if (width < MIN_GRID_CANVAS_WIDTH) return best;
    return !best || width > best.getBoundingClientRect().width ? canvas : best;
  }, null);

const anchorPoint = (sheet: FormButtonSheet, anchor: FormButtonAnchor): CellBox => {
  const cell = sheet.getRange(anchor.row, anchor.column, 1, 1).getCellRect();
  return { x: cell.x + anchor.columnOffset, y: cell.y + anchor.rowOffset };
};

function layout(sheet: FormButtonSheet, host: HTMLElement, layer: HTMLElement, clip: HTMLElement, buttons: FormButton[]) {
  const canvas = findGridCanvas(host);
  const frame = layer.offsetParent?.getBoundingClientRect();
  if (!canvas || !frame) return false;
  const area = canvas.getBoundingClientRect();
  const zoom = sheet.getZoom() || 1;
  const scroll = sheet.getScrollState();
  const origin = sheet.getRange(0, 0, 1, 1).getCellRect();
  const first = sheet.getRange(scroll.sheetViewStartRow, scroll.sheetViewStartColumn, 1, 1).getCellRect();
  const scrollX = first.x - origin.x + scroll.offsetX;
  const scrollY = first.y - origin.y + scroll.offsetY;
  const headerWidth = origin.x * zoom;
  const headerHeight = origin.y * zoom;
  layer.style.transform = `translate(${area.left - frame.left + headerWidth}px, ${area.top - frame.top + headerHeight}px)`;
  layer.style.width = `${Math.max(0, area.width - headerWidth)}px`;
  layer.style.height = `${Math.max(0, area.height - headerHeight)}px`;
  buttons.forEach((button, index) => {
    const element = clip.children[index] as HTMLElement | undefined;
    if (!element) return;
    const from = anchorPoint(sheet, button.from);
    const to = anchorPoint(sheet, button.to);
    const width = (to.x - from.x) * zoom;
    const height = (to.y - from.y) * zoom;
    element.style.display = width < 2 || height < 2 ? 'none' : '';
    element.style.transform = `translate(${(from.x - origin.x - scrollX) * zoom}px, ${(from.y - origin.y - scrollY) * zoom}px)`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.fontSize = `${(button.fontSize ?? DEFAULT_FONT_POINTS) * POINTS_TO_PIXELS * zoom}px`;
  });
  return true;
}

export function FormButtonLayer({ buttons, container, getSheet, onRun }: Props) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const getSheetRef = useRef(getSheet);
  useEffect(() => {
    getSheetRef.current = getSheet;
  });

  useEffect(() => {
    if (!buttons.length) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const layer = layerRef.current;
      const host = container.current;
      const sheet = getSheetRef.current();
      if (!layer || !host || !sheet) return;
      let placed = false;
      try {
        placed = layout(sheet, host, layer, layer, buttons);
      } catch {
        placed = false;
      }
      layer.style.visibility = placed ? 'visible' : 'hidden';
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [buttons, container]);

  if (!buttons.length) return null;
  return (
    <div ref={layerRef} className="sheet-form-button-layer" style={{ visibility: 'hidden' }}>
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          className="sheet-form-button"
          style={{ fontWeight: button.bold ? 700 : 400 }}
          title={`Chạy macro ${button.macro}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onRun(button)}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
