import type { Node as PMNode } from '@tiptap/pm/model';
import { CellSelection, TableMap, selectedRect } from '@tiptap/pm/tables';
import type { DocCtx } from './DocContext';
import { tableContext } from './actionsExtra';

export type Autofit = 'contents' | 'window' | 'fixed';
export type TextDirection = 'vertical-rl' | 'vertical-lr' | null;
export type CellAlign = { h: 'left' | 'center' | 'right'; v: 'top' | 'middle' | 'bottom' };

const MIN_ROW = 12;
const MIN_COL = 24;

const inTable = (ctx: DocCtx) => {
  const context = tableContext(ctx);
  if (!context) ctx.ui.toast('Đặt con trỏ trong bảng trước', true);
  return context;
};

const tableDom = (ctx: DocCtx, pos: number): HTMLTableElement | null => {
  const dom = ctx.editor.view.nodeDOM(pos) as HTMLElement | null;
  if (!dom) return null;
  return dom instanceof HTMLTableElement ? dom : dom.querySelector('table');
};

const rect = (ctx: DocCtx) => {
  try {
    return selectedRect(ctx.editor.state);
  } catch {
    return null;
  }
};

export function splitTable(ctx: DocCtx) {
  const context = inTable(ctx);
  if (!context) return;
  if (context.rowIndex === 0) {
    ctx.ui.toast('Đặt con trỏ ở hàng thứ hai trở đi để tách bảng', true);
    return;
  }
  const rows: PMNode[] = [];
  context.table.forEach((row) => rows.push(row));
  const { schema, tr } = ctx.editor.state;
  const top = context.table.type.create(context.table.attrs, rows.slice(0, context.rowIndex));
  const bottom = context.table.type.create(context.table.attrs, rows.slice(context.rowIndex));
  tr.replaceWith(context.pos, context.pos + context.table.nodeSize, [top, schema.nodes.paragraph.create(), bottom]);
  ctx.editor.view.dispatch(tr.scrollIntoView());
}

export function setAutofit(ctx: DocCtx, mode: Autofit) {
  const context = inTable(ctx);
  if (!context) return;
  const { tr } = ctx.editor.state;
  const map = TableMap.get(context.table);
  const start = context.pos + 1;
  const widths = mode === 'fixed' ? measureColumns(ctx, context.pos, map.width) : null;
  const seen = new Set<number>();
  for (let index = 0; index < map.map.length; index++) {
    const offset = map.map[index];
    if (seen.has(offset)) continue;
    seen.add(offset);
    const cell = context.table.nodeAt(offset);
    if (!cell) continue;
    const column = index % map.width;
    const span = Number(cell.attrs.colspan) || 1;
    const colwidth = widths ? widths.slice(column, column + span) : null;
    tr.setNodeMarkup(start + offset, null, { ...cell.attrs, colwidth });
  }
  tr.setNodeMarkup(context.pos, null, { ...context.table.attrs, autofit: mode });
  ctx.editor.view.dispatch(tr);
}

function measureColumns(ctx: DocCtx, pos: number, count: number): number[] {
  const table = tableDom(ctx, pos);
  const fallback = Array.from({ length: count }, () => 120);
  if (!table) return fallback;
  const cols = table.querySelectorAll('colgroup col');
  const firstRow = table.rows[0];
  const widths: number[] = [];
  if (cols.length === count) cols.forEach((col) => widths.push((col as HTMLElement).offsetWidth));
  if (widths.every((w) => w > 0) && widths.length === count) return widths.map((w) => Math.max(MIN_COL, Math.round(w)));
  if (!firstRow) return fallback;
  for (const cell of Array.from(firstRow.cells)) {
    const span = cell.colSpan || 1;
    for (let i = 0; i < span; i++) widths.push(Math.max(MIN_COL, Math.round(cell.offsetWidth / span)));
  }
  return widths.length === count ? widths : fallback;
}

const rowPositions = (ctx: DocCtx) => {
  const context = tableContext(ctx);
  if (!context) return null;
  const selected = rect(ctx);
  const from = selected ? selected.top : context.rowIndex;
  const to = selected ? selected.bottom : context.rowIndex + 1;
  const positions: { pos: number; node: PMNode; index: number }[] = [];
  let pos = context.pos + 1;
  context.table.forEach((row, _offset, index) => {
    if (index >= from && index < to) positions.push({ pos, node: row, index });
    pos += row.nodeSize;
  });
  return { context, positions };
};

export function setRowHeight(ctx: DocCtx, height: number | null) {
  const rows = rowPositions(ctx);
  if (!rows) return;
  const { tr } = ctx.editor.state;
  const value = height === null ? null : Math.max(MIN_ROW, Math.round(height));
  rows.positions.forEach(({ pos, node }) => tr.setNodeMarkup(pos, null, { ...node.attrs, rowHeight: value }));
  ctx.editor.view.dispatch(tr);
}

export function currentRowHeight(ctx: DocCtx): number | null {
  const rows = rowPositions(ctx);
  const first = rows?.positions[0];
  if (!rows || !first) return null;
  if (first.node.attrs.rowHeight) return Number(first.node.attrs.rowHeight);
  return tableDom(ctx, rows.context.pos)?.rows[first.index]?.offsetHeight ?? null;
}

export function distributeRows(ctx: DocCtx) {
  const context = inTable(ctx);
  if (!context) return;
  const table = tableDom(ctx, context.pos);
  const selected = rect(ctx);
  const from = selected && selected.bottom - selected.top > 1 ? selected.top : 0;
  const to = selected && selected.bottom - selected.top > 1 ? selected.bottom : context.table.childCount;
  const heights = table ? Array.from(table.rows).slice(from, to).map((row) => row.offsetHeight) : [];
  const height = heights.length ? Math.max(...heights) : 28;
  const { tr } = ctx.editor.state;
  let pos = context.pos + 1;
  context.table.forEach((row, _offset, index) => {
    if (index >= from && index < to) tr.setNodeMarkup(pos, null, { ...row.attrs, rowHeight: Math.max(MIN_ROW, Math.round(height)) });
    pos += row.nodeSize;
  });
  ctx.editor.view.dispatch(tr);
}

export function setColumnWidth(ctx: DocCtx, width: number) {
  const context = inTable(ctx);
  if (!context) return;
  const selected = rect(ctx);
  const left = selected ? selected.left : context.colIndex;
  const right = selected ? selected.right : context.colIndex + 1;
  const map = TableMap.get(context.table);
  const current = measureColumns(ctx, context.pos, map.width);
  const target = Math.max(MIN_COL, Math.round(width));
  const widths = current.map((w, i) => (i >= left && i < right ? target : w));
  const { tr } = ctx.editor.state;
  const start = context.pos + 1;
  const seen = new Set<number>();
  for (let index = 0; index < map.map.length; index++) {
    const offset = map.map[index];
    if (seen.has(offset)) continue;
    seen.add(offset);
    const cell = context.table.nodeAt(offset);
    if (!cell) continue;
    const column = index % map.width;
    const span = Number(cell.attrs.colspan) || 1;
    tr.setNodeMarkup(start + offset, null, { ...cell.attrs, colwidth: widths.slice(column, column + span) });
  }
  tr.setNodeMarkup(context.pos, null, { ...context.table.attrs, autofit: 'fixed' });
  ctx.editor.view.dispatch(tr);
}

export function currentColumnWidth(ctx: DocCtx): number | null {
  const context = tableContext(ctx);
  if (!context) return null;
  const map = TableMap.get(context.table);
  return measureColumns(ctx, context.pos, map.width)[context.colIndex] ?? null;
}

export function setTextDirection(ctx: DocCtx, direction: TextDirection) {
  ctx.editor.chain().focus().setCellAttribute('textDirection', direction).run();
}

export function alignCells(ctx: DocCtx, align: CellAlign) {
  ctx.editor.chain().focus().setCellAttribute('vAlign', align.v).setTextAlign(align.h).run();
}

export function toggleRepeatHeader(ctx: DocCtx) {
  const rows = rowPositions(ctx);
  if (!rows) return;
  const lastSelected = Math.max(...rows.positions.map((row) => row.index));
  const enable = !rows.positions.every(({ node }) => node.attrs.repeatHeader);
  const { tr } = ctx.editor.state;
  let pos = rows.context.pos + 1;
  rows.context.table.forEach((row, _offset, index) => {
    if (index <= lastSelected) tr.setNodeMarkup(pos, null, { ...row.attrs, repeatHeader: enable && index <= lastSelected ? true : null });
    pos += row.nodeSize;
  });
  ctx.editor.view.dispatch(tr);
  ctx.ui.toast(enable ? `Lặp ${lastSelected + 1} hàng đầu ở đầu mỗi trang khi bảng sang trang` : 'Đã bỏ lặp hàng tiêu đề');
}

export function repeatsHeader(ctx: DocCtx): boolean {
  const rows = rowPositions(ctx);
  return Boolean(rows?.positions.length && rows.positions.every(({ node }) => node.attrs.repeatHeader));
}

export type SelectTarget = 'cell' | 'row' | 'column' | 'table';

export function selectInTable(ctx: DocCtx, target: SelectTarget) {
  const context = inTable(ctx);
  if (!context) return;
  const { state } = ctx.editor;
  const map = TableMap.get(context.table);
  const start = context.pos + 1;
  const cellPos = (row: number, col: number) => start + map.map[row * map.width + col];
  const row = Math.min(context.rowIndex, map.height - 1);
  const col = Math.min(context.colIndex, map.width - 1);
  const pick = {
    cell: [cellPos(row, col), cellPos(row, col)],
    row: [cellPos(row, 0), cellPos(row, map.width - 1)],
    column: [cellPos(0, col), cellPos(map.height - 1, col)],
    table: [cellPos(0, 0), cellPos(map.height - 1, map.width - 1)],
  }[target];
  const selection = CellSelection.create(state.doc, pick[0], pick[1]);
  ctx.editor.view.dispatch(state.tr.setSelection(selection));
  ctx.editor.view.focus();
}

export async function tableProperties(ctx: DocCtx) {
  const context = inTable(ctx);
  if (!context) return;
  const attrs = context.table.attrs;
  const res = await ctx.ui.ask({
    title: 'Thuộc tính bảng',
    fields: [
      { name: 'width', label: 'Chiều rộng bảng (% khổ trang, để trống = tự động)', type: 'number', value: attrs.tableWidth ?? '', min: 10, max: 100 },
      { name: 'align', label: 'Căn bảng trên trang', type: 'select', value: String(attrs.tableAlign ?? 'left'), options: [{ value: 'left', label: 'Trái' }, { value: 'center', label: 'Giữa' }, { value: 'right', label: 'Phải' }] },
      { name: 'autofit', label: 'Tự khớp', type: 'select', value: String(attrs.autofit ?? 'window'), options: [{ value: 'window', label: 'Theo khổ trang' }, { value: 'contents', label: 'Theo nội dung' }, { value: 'fixed', label: 'Độ rộng cột cố định' }] },
      { name: 'padding', label: 'Lề trong ô (px, để trống = mặc định)', type: 'number', value: attrs.cellPadding ?? '', min: 0, max: 48 },
    ],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  const width = Number(res.width);
  const padding = String(res.padding ?? '').trim() === '' ? null : Math.max(0, Math.min(48, Number(res.padding) || 0));
  const autofit = String(res.autofit) as Autofit;
  if (autofit !== (attrs.autofit ?? 'window')) setAutofit(ctx, autofit);
  const fresh = tableContext(ctx) ?? context;
  ctx.editor.view.dispatch(ctx.editor.state.tr.setNodeMarkup(fresh.pos, null, {
    ...fresh.table.attrs,
    tableWidth: Number.isFinite(width) && width >= 10 ? Math.min(100, Math.round(width)) : null,
    tableAlign: String(res.align) === 'left' ? null : String(res.align),
    cellPadding: padding,
  }));
}

export async function cellMargins(ctx: DocCtx) {
  const context = inTable(ctx);
  if (!context) return;
  const res = await ctx.ui.ask({
    title: 'Lề ô',
    fields: [{ name: 'padding', label: 'Khoảng cách chữ tới viền ô (px)', type: 'number', value: context.table.attrs.cellPadding ?? 8, min: 0, max: 48 }],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  ctx.editor.view.dispatch(ctx.editor.state.tr.setNodeMarkup(context.pos, null, { ...context.table.attrs, cellPadding: Math.max(0, Math.min(48, Number(res.padding) || 0)) }));
}
