import {
  MM_PER_PX,
  computePageLayout,
  fitInto,
  gridCells,
  parsePageRange,
  sliceOffsets,
  type GridCell,
  type Margins,
  type Orientation,
  type PageLayout,
  type Size,
} from '../../lib/print/printLayout';
import type { PrintSettings, PrintSource } from './printTypes';

export type SheetCell = { item: number; box: GridCell; scale: number; offsetPx: number; heightPx: number; part: number };
export type PrintSheet = { key: string; paper: Size; orientation: Orientation; margins: Margins; cells: SheetCell[]; items: number[] };
export type SheetPlan = { sheets: PrintSheet[]; notes: string[]; layout: PageLayout | null };

const toMm = (size: Size): Size => ({ w: size.w * MM_PER_PX, h: size.h * MM_PER_PX });

function requestFor(source: PrintSource, settings: PrintSettings, content: Size) {
  return {
    kind: source.kind,
    content,
    paper: settings.paper,
    orientation: settings.orientation,
    marginPreset: settings.marginPreset,
    customMargins: settings.customMargins,
    scaleMode: settings.scaleMode,
    customScale: settings.customScale,
    centerH: settings.centerH,
    centerV: settings.centerV,
    flowsVertically: source.flowsVertically,
    paperSize: settings.customPaper ?? undefined,
    gutter: settings.gutterMm > 0 ? { size: settings.gutterMm, position: settings.gutterPos } : undefined,
  };
}

function fixedSheets(source: PrintSource): SheetPlan {
  const fixed = source.fixedPaper!;
  const orientation: Orientation = fixed.landscape ? 'landscape' : 'portrait';
  const margins = { top: 0, right: 0, bottom: 0, left: 0 };
  const sheets = source.items.map((item, index) => {
    const mm = toMm(item.size);
    const scale = fixed.size.w / mm.w;
    return { key: item.key, paper: fixed.size, orientation, margins, items: [index], cells: [{ item: index, box: { x: 0, y: 0, w: fixed.size.w, h: Math.min(fixed.size.h, mm.h * scale) }, scale, offsetPx: 0, heightPx: item.size.h, part: 0 }] };
  });
  return { sheets, notes: [], layout: null };
}

function gridSheets(source: PrintSource, settings: PrintSettings): SheetPlan {
  const { gapMm } = source.perPage!;
  const sample = toMm(source.items[0]?.size ?? { w: 960, h: 540 });
  const options: { orientation: Orientation; cols: number; rows: number }[] = [
    { orientation: 'portrait', cols: source.perPage!.cols, rows: source.perPage!.rows },
    { orientation: 'landscape', cols: source.perPage!.rows, rows: source.perPage!.cols },
  ].filter((o) => settings.orientation === 'auto' || settings.orientation === o.orientation) as { orientation: Orientation; cols: number; rows: number }[];
  const candidates = options.map((o) => {
    const layout = computePageLayout({ ...requestFor(source, settings, { w: sample.w * o.cols + gapMm * (o.cols - 1), h: sample.h * o.rows + gapMm * (o.rows - 1) }), orientation: o.orientation, scaleMode: 'fit-page' });
    const area = { x: layout.margins.left, y: layout.margins.top, w: layout.printable.w, h: layout.printable.h };
    const cells = gridCells(area, o.cols, o.rows, gapMm);
    return { layout, cells, cols: o.cols, rows: o.rows, size: fitInto(sample, cells[0]).w };
  });
  const { layout, cells, cols, rows } = candidates.reduce((best, next) => (next.size > best.size + 0.5 ? next : best));
  const perSheet = cols * rows;
  const sheets: PrintSheet[] = [];
  for (let start = 0; start < source.items.length; start += perSheet) {
    const chunk = source.items.slice(start, start + perSheet);
    sheets.push({
      key: `grid-${start}`,
      paper: layout.paper,
      orientation: layout.orientation,
      margins: layout.margins,
      items: chunk.map((_, i) => start + i),
      cells: chunk.map((item, i) => {
        const box = fitInto(toMm(item.size), cells[i]);
        return { item: start + i, box, scale: box.w / toMm(item.size).w, offsetPx: 0, heightPx: item.size.h, part: 0 };
      }),
    });
  }
  return { sheets, notes: layout.notes.filter((n) => !n.startsWith('Thu nhỏ') && !n.startsWith('Phóng to')), layout };
}

function flowSheets(source: PrintSource, settings: PrintSettings): SheetPlan {
  const sheets: PrintSheet[] = [];
  let firstLayout: PageLayout | null = null;
  const notes = new Set<string>();
  source.items.forEach((item, index) => {
    const layout = computePageLayout(requestFor(source, settings, toMm(item.size)));
    firstLayout ??= layout;
    layout.notes.forEach((n) => notes.add(n));
    const sliceMm = source.flowsVertically ? layout.printable.h : layout.placement.h;
    const slicePx = sliceMm / layout.scale / MM_PER_PX;
    const offsets = source.flowsVertically ? flowOffsets(item.size.h, slicePx, item.breaks, item.repeatPx ?? 0) : [0];
    offsets.forEach((offset, part) => {
      const next = offsets[part + 1] ?? item.size.h;
      const heightPx = next - offset + (part > 0 ? item.repeatPx ?? 0 : 0);
      const heightMm = Math.min(source.flowsVertically ? layout.printable.h : layout.placement.h, heightPx * MM_PER_PX * layout.scale);
      sheets.push({
        key: `${item.key}-${part}`,
        paper: layout.paper,
        orientation: layout.orientation,
        margins: layout.margins,
        items: [index],
        cells: [{ item: index, box: { x: layout.placement.x, y: layout.placement.y, w: layout.placement.w, h: heightMm }, scale: layout.scale, offsetPx: offset, heightPx: next - offset, part }],
      });
    });
  });
  return { sheets, notes: [...notes], layout: firstLayout };
}

function flowOffsets(total: number, slicePx: number, breaks: number[] | undefined, repeatPx: number): number[] {
  if (repeatPx <= 0 || repeatPx >= slicePx * 0.6) return sliceOffsets(total, slicePx, breaks);
  const first = sliceOffsets(total, slicePx, breaks).slice(0, 2);
  if (first.length < 2) return first;
  const rest = sliceOffsets(total - first[1], slicePx - repeatPx, breaks?.map((b) => b - first[1]));
  return [0, ...rest.map((o) => o + first[1])];
}

function mirrorSheet(sheet: PrintSheet): PrintSheet {
  const { paper, margins } = sheet;
  return {
    ...sheet,
    margins: { ...margins, left: margins.right, right: margins.left },
    cells: sheet.cells.map((cell) => ({ ...cell, box: { ...cell.box, x: paper.w - cell.box.x - cell.box.w } })),
  };
}

function basePlan(source: PrintSource, settings: PrintSettings): SheetPlan {
  if (!source.items.length) return { sheets: [], notes: [], layout: null };
  if (source.fixedPaper) return fixedSheets(source);
  if (source.perPage && source.perPage.cols * source.perPage.rows > 1) return gridSheets(source, settings);
  return flowSheets(source, settings);
}

export function planSheets(source: PrintSource, settings: PrintSettings): SheetPlan {
  const plan = basePlan(source, settings);
  if (!settings.mirror || source.fixedPaper) return plan;
  return { ...plan, sheets: plan.sheets.map((sheet, i) => (i % 2 === 1 ? mirrorSheet(sheet) : sheet)) };
}

export function selectSheets(plan: SheetPlan, settings: PrintSettings, currentItem: number | undefined): number[] {
  const all = plan.sheets.map((_, i) => i);
  if (settings.range === 'current') {
    const target = currentItem ?? 0;
    const hit = all.filter((i) => plan.sheets[i].items.includes(target));
    return hit.length ? hit : all.slice(0, 1);
  }
  if (settings.range === 'custom') return parsePageRange(settings.pageRange, plan.sheets.length).map((p) => p - 1);
  return all;
}
