import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import type { FormButton, FormButtonAnchor, FormImageMap } from '../../lib/formButtons';

type CellBox = { x: number; y: number };

export type FormButtonSheet = {
  getZoom(): number;
  getScrollState(): { sheetViewStartRow: number; sheetViewStartColumn: number; offsetX: number; offsetY: number };
  getRange(row: number, column: number, rows: number, columns: number): { getCellRect(): CellBox };
  getFreeze?(): { xSplit: number; ySplit: number; startRow: number; startColumn: number } | null | undefined;
};

type View = { origin: CellBox; scroll: CellBox; frozen: CellBox; zoom: number };

type Props = {
  buttons: FormButton[];
  images: FormImageMap;
  container: RefObject<HTMLDivElement | null>;
  getSheet: () => FormButtonSheet | null;
  onRun: (button: FormButton) => void;
};

const DEFAULT_FONT_POINTS = 10;
const POINTS_TO_PIXELS = 4 / 3;
const MIN_GRID_CANVAS_WIDTH = 200;
const MIN_BUTTON_SIDE = 2;
const LINE_THICKNESS = 1;
const FLEX_ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end', top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

export const findGridCanvas = (host: HTMLElement) =>
  [...host.querySelectorAll('canvas')].reduce<HTMLCanvasElement | null>((best, canvas) => {
    const width = canvas.getBoundingClientRect().width;
    if (width < MIN_GRID_CANVAS_WIDTH) return best;
    return !best || width > best.getBoundingClientRect().width ? canvas : best;
  }, null);

const anchorPoint = (sheet: FormButtonSheet, anchor: FormButtonAnchor, origin: CellBox): CellBox => {
  const cell = sheet.getRange(anchor.row, anchor.column, 1, 1).getCellRect();
  return { x: cell.x - origin.x + anchor.columnOffset, y: cell.y - origin.y + anchor.rowOffset };
};

function boxOf(sheet: FormButtonSheet, button: FormButton, origin: CellBox) {
  const start = button.at ?? anchorPoint(sheet, button.from, origin);
  if (button.size) return { ...start, width: button.size.width, height: button.size.height };
  const end = anchorPoint(sheet, button.to, origin);
  return { ...start, width: end.x - start.x, height: end.y - start.y };
}

const isLine = (button: FormButton) => button.kind === 'text' && !button.label && !button.fill;

function place(element: HTMLElement, sheet: FormButtonSheet, button: FormButton, view: View) {
  const { origin, scroll, frozen, zoom } = view;
  const box = boxOf(sheet, button, origin);
  const minimum = isLine(button) ? LINE_THICKNESS : MIN_BUTTON_SIDE;
  const width = Math.max(box.width * zoom, isLine(button) ? LINE_THICKNESS : 0);
  const height = Math.max(box.height * zoom, isLine(button) ? LINE_THICKNESS : 0);
  const left = (box.x < frozen.x ? box.x : box.x - scroll.x) * zoom;
  const top = (box.y < frozen.y ? box.y : box.y - scroll.y) * zoom;
  const hiddenLeft = box.x < frozen.x ? 0 : Math.max(0, frozen.x * zoom - left);
  const hiddenTop = box.y < frozen.y ? 0 : Math.max(0, frozen.y * zoom - top);
  element.style.display = button.hidden || width < minimum || height < minimum || hiddenLeft >= width || hiddenTop >= height ? 'none' : '';
  element.style.transform = `translate(${left}px, ${top}px)`;
  element.style.clipPath = hiddenLeft || hiddenTop ? `inset(${hiddenTop}px 0 0 ${hiddenLeft}px)` : '';
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.fontSize = `${(button.fontSize ?? DEFAULT_FONT_POINTS) * POINTS_TO_PIXELS * zoom}px`;
}

export function viewOf(sheet: FormButtonSheet): View {
  const state = sheet.getScrollState();
  const freeze = sheet.getFreeze?.();
  const frozenRows = freeze && freeze.ySplit > 0 ? freeze.startRow : 0;
  const frozenColumns = freeze && freeze.xSplit > 0 ? freeze.startColumn : 0;
  const origin = sheet.getRange(0, 0, 1, 1).getCellRect();
  const base = sheet.getRange(Math.max(0, frozenRows), Math.max(0, frozenColumns), 1, 1).getCellRect();
  const first = sheet.getRange(Math.max(state.sheetViewStartRow, frozenRows, 0), Math.max(state.sheetViewStartColumn, frozenColumns, 0), 1, 1).getCellRect();
  return {
    origin,
    zoom: sheet.getZoom() || 1,
    frozen: { x: base.x - origin.x, y: base.y - origin.y },
    scroll: { x: first.x - base.x + state.offsetX, y: first.y - base.y + state.offsetY },
  };
}

function layout(sheet: FormButtonSheet, host: HTMLElement, layer: HTMLElement, buttons: FormButton[]) {
  const canvas = findGridCanvas(host);
  const frame = layer.offsetParent?.getBoundingClientRect();
  if (!canvas || !frame) return false;
  const area = canvas.getBoundingClientRect();
  const view = viewOf(sheet);
  const headerWidth = view.origin.x * view.zoom;
  const headerHeight = view.origin.y * view.zoom;
  layer.style.transform = `translate(${area.left - frame.left + headerWidth}px, ${area.top - frame.top + headerHeight}px)`;
  layer.style.width = `${Math.max(0, area.width - headerWidth)}px`;
  layer.style.height = `${Math.max(0, area.height - headerHeight)}px`;
  buttons.forEach((button, index) => {
    const element = layer.children[index] as HTMLElement | undefined;
    if (element) place(element, sheet, button, view);
  });
  return true;
}

const textStyle = (item: FormButton): CSSProperties => ({
  fontWeight: item.bold ? 700 : 400,
  fontStyle: item.italic ? 'italic' : undefined,
  fontFamily: item.fontFamily ? `'${item.fontFamily}', serif` : undefined,
  color: item.color,
  background: item.fill,
  border: item.border ? `1px solid ${item.border}` : undefined,
  justifyContent: FLEX_ALIGN[item.align ?? 'left'],
  alignItems: FLEX_ALIGN[item.valign ?? 'top'],
  textAlign: item.align ?? 'left',
});

function LayerItem({ item, images, onRun }: { item: FormButton; images: FormImageMap; onRun: (button: FormButton) => void }) {
  if (item.kind === 'picture') return <img className="sheet-form-picture" src={images[item.image ?? '']} alt={item.name ?? ''} draggable={false} />;
  if (isLine(item)) return <div className="sheet-form-text" style={{ padding: 0, borderTop: `${LINE_THICKNESS}px solid ${item.border ?? '#000'}` }} />;
  if (item.kind === 'text') return <div className="sheet-form-text" style={textStyle(item)}>{item.label}</div>;
  return (
    <button
      type="button"
      className="sheet-form-button"
      style={{ fontWeight: item.bold ? 700 : 400, color: item.color, background: item.fill }}
      title={`Chạy macro ${item.macro}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onRun(item)}
    >
      {item.label}
    </button>
  );
}

export function FormButtonLayer({ buttons, images, container, getSheet, onRun }: Props) {
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
        placed = layout(sheet, host, layer, buttons);
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
      {buttons.map((button) => <LayerItem key={button.id} item={button} images={images} onRun={onRun} />)}
    </div>
  );
}
