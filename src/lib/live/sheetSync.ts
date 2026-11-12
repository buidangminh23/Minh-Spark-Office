import type { SheetContent } from '../storage';
import type { CellStyle, CellValue, SheetData, WorkbookData } from '../sheetTypes';
import { parseJson, type FlatState } from './flatSync';

export const SHEET_MAP = 'sheetState';

const VIEW_ONLY_SHEET_KEYS = new Set(['cellData', 'zoomRatio', 'scrollTop', 'scrollLeft', 'selections']);
const WORKBOOK_SKIP_KEYS = new Set(['rev', 'sheets', 'styles', 'sheetOrder', 'importTruncation', 'vba', 'vbaError', 'automation']);

const cellKey = (sheetId: string, row: number, column: number) => `c:${sheetId}:${row}:${column}`;

export type CellChange = { sheetId: string; row: number; column: number };

export function parseCellKey(key: string): CellChange | null {
  if (!key.startsWith('c:')) return null;
  const last = key.lastIndexOf(':');
  const middle = key.lastIndexOf(':', last - 1);
  if (middle <= 1) return null;
  const row = Number(key.slice(middle + 1, last));
  const column = Number(key.slice(last + 1));
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  return { sheetId: key.slice(2, middle), row, column };
}

function omit<T extends object>(value: T, skip: Set<string>) {
  return Object.fromEntries(Object.entries(value).filter(([key, field]) => !skip.has(key) && field !== undefined));
}

export function flattenWorkbook(workbook: WorkbookData, extras: Omit<SheetContent, 'kind' | 'workbook'> = {}): FlatState {
  const state: FlatState = new Map();
  state.set('wb', JSON.stringify(omit(workbook, WORKBOOK_SKIP_KEYS)));
  state.set('order', JSON.stringify(workbook.sheetOrder ?? Object.keys(workbook.sheets ?? {})));
  state.set('x', JSON.stringify(extras));
  for (const [id, style] of Object.entries(workbook.styles ?? {})) if (style) state.set(`st:${id}`, JSON.stringify(style));
  for (const [sheetId, sheet] of Object.entries(workbook.sheets ?? {})) {
    if (!sheet) continue;
    state.set(`sh:${sheetId}`, JSON.stringify(omit(sheet, VIEW_ONLY_SHEET_KEYS)));
    for (const [row, columns] of Object.entries(sheet.cellData ?? {})) {
      for (const [column, cell] of Object.entries(columns ?? {})) {
        if (cell && Object.keys(cell).length) state.set(cellKey(sheetId, Number(row), Number(column)), JSON.stringify(cell));
      }
    }
  }
  return state;
}

export function unflattenWorkbook(state: FlatState): SheetContent | null {
  const base = parseJson<Partial<WorkbookData>>(state.get('wb'));
  const order = parseJson<string[]>(state.get('order'));
  if (!base || !order) return null;
  const styles: Record<string, CellStyle> = {};
  const sheets: Record<string, SheetData> = {};
  state.forEach((value, key) => {
    if (key.startsWith('st:')) {
      const style = parseJson<CellStyle>(value);
      if (style) styles[key.slice(3)] = style;
    } else if (key.startsWith('sh:')) {
      const sheet = parseJson<Partial<SheetData>>(value);
      if (sheet) sheets[key.slice(3)] = { ...sheet, rowData: sheet.rowData ?? {}, columnData: sheet.columnData ?? {}, mergeData: sheet.mergeData ?? [], cellData: {} } as SheetData;
    }
  });
  state.forEach((value, key) => {
    const at = parseCellKey(key);
    const sheet = at && sheets[at.sheetId];
    const cell = sheet && parseJson<CellValue>(value);
    if (!at || !sheet || !cell) return;
    (sheet.cellData[at.row] ??= {})[at.column] = cell;
  });
  const sheetOrder = order.filter((id) => sheets[id]);
  for (const id of Object.keys(sheets)) if (!sheetOrder.includes(id)) sheetOrder.push(id);
  if (!sheetOrder.length) return null;
  const extras = parseJson<Omit<SheetContent, 'kind' | 'workbook'>>(state.get('x')) ?? {};
  return { ...extras, kind: 'sheet', workbook: { ...(base as WorkbookData), styles, sheetOrder, sheets } };
}

export function onlyCellChanges(keys: Iterable<string>) {
  const cells: CellChange[] = [];
  for (const key of keys) {
    const cell = parseCellKey(key);
    if (cell) cells.push(cell);
    else if (!key.startsWith('st:') && key !== 'x') return null;
  }
  return cells;
}
