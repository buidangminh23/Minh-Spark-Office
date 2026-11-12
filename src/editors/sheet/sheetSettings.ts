import type { SheetEnterDirection } from '../../lib/settings/sheetDefaults';
import type { SheetData, WorkbookData } from '../../lib/sheetTypes';
import { emptySheet } from '../../lib/workbookBasics';

export const MAX_NEW_SHEET_COUNT = 255;
export const NEW_WORKBOOK_WINDOW_MS = 2000;
const NEW_SHEET_PREFIX = 'Trang tính';

const OPPOSITE: Record<SheetEnterDirection, SheetEnterDirection> = { down: 'up', up: 'down', right: 'left', left: 'right' };

export function enterMoveDirection(move: boolean, direction: SheetEnterDirection, reverse: boolean): SheetEnterDirection | null {
  if (!move) return null;
  return reverse ? OPPOSITE[direction] : direction;
}

const ALWAYS_VISIBLE_TABS = new Set(['file', 'home']);

export function isSheetTabVisible(tab: string, enabled: Partial<Record<string, boolean>>): boolean {
  return ALWAYS_VISIBLE_TABS.has(tab) || enabled[tab] !== false;
}

export function clampSheetCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(MAX_NEW_SHEET_COUNT, Math.max(1, Math.round(count)));
}

const isEmptySheet = (sheet: SheetData) =>
  Object.keys(sheet.cellData ?? {}).length === 0 &&
  Object.keys(sheet.rowData ?? {}).length === 0 &&
  Object.keys(sheet.columnData ?? {}).length === 0 &&
  (sheet.mergeData ?? []).length === 0;

export function isBlankWorkbook(workbook: WorkbookData): boolean {
  if (workbook.sheetOrder.length !== 1 || Object.keys(workbook.styles ?? {}).length > 0) return false;
  if (workbook.vba || workbook.automation || (workbook.resources?.length ?? 0) > 0) return false;
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  return !!sheet && isEmptySheet(sheet);
}

export function isFreshBlankWorkbook(meta: { createdAt: number; updatedAt: number }, workbook: WorkbookData): boolean {
  return Math.abs(meta.updatedAt - meta.createdAt) <= NEW_WORKBOOK_WINDOW_MS && isBlankWorkbook(workbook);
}

const nextSheetName = (taken: Set<string>, start: number) => {
  let index = start;
  while (taken.has(`${NEW_SHEET_PREFIX} ${index}`)) index++;
  return { name: `${NEW_SHEET_PREFIX} ${index}`, index };
};

export function withSheetCount(workbook: WorkbookData, count: number): WorkbookData {
  const target = clampSheetCount(count);
  if (workbook.sheetOrder.length >= target) return workbook;
  const sheets = { ...workbook.sheets };
  const sheetOrder = [...workbook.sheetOrder];
  const taken = new Set(sheetOrder.map((id) => sheets[id]?.name));
  let index = sheetOrder.length + 1;
  while (sheetOrder.length < target) {
    const next = nextSheetName(taken, index);
    const sheet = emptySheet(next.name);
    sheets[sheet.id] = sheet;
    sheetOrder.push(sheet.id);
    taken.add(next.name);
    index = next.index + 1;
  }
  return { ...workbook, sheets, sheetOrder };
}
