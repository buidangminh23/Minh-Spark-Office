import type { CellValue, SheetData, WorkbookData } from './sheetTypes';

export type DiffValue = string | number | boolean | null;
export type DiffGrid = DiffValue[][];
export type CellChangeKind = 'modified' | 'added' | 'deleted';
export type CellChange = { row: number; col: number; before: DiffValue; after: DiffValue; beforeFormula: string | null; afterFormula: string | null; kind: CellChangeKind };
export type SheetSnapshot = { name: string; grid: DiffGrid; formulas: (string | null)[][] };

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellText(cell: CellValue | undefined): DiffValue {
  if (!cell) return null;
  if (cell.v !== undefined && cell.v !== null && cell.v !== '') return cell.v;
  const stream = cell.p?.body?.dataStream;
  if (stream) {
    const text = stream.replace(/[\r\n]+$/g, '');
    return text || null;
  }
  return null;
}

export function snapshotSheet(sheet: SheetData): SheetSnapshot {
  const grid: DiffGrid = [];
  const formulas: (string | null)[][] = [];
  for (const [rk, cols] of Object.entries(sheet.cellData ?? {})) {
    const r = Number(rk);
    for (const [ck, cell] of Object.entries(cols ?? {})) {
      const c = Number(ck);
      const value = cellText(cell);
      const formula = cell?.f ? String(cell.f) : null;
      if (value === null && !formula) continue;
      (grid[r] ??= [])[c] = value;
      (formulas[r] ??= [])[c] = formula;
    }
  }
  return { name: sheet.name, grid, formulas };
}

export function snapshotWorkbook(workbook: WorkbookData): SheetSnapshot[] {
  const order = workbook.sheetOrder?.length ? workbook.sheetOrder : Object.keys(workbook.sheets ?? {});
  return order.map((id) => workbook.sheets[id]).filter(Boolean).map(snapshotSheet);
}

const isEmpty = (v: DiffValue | undefined) => v === null || v === undefined || v === '';

function sameValue(a: DiffValue | undefined, b: DiffValue | undefined): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return a === b;
}

export function diffSheets(before: SheetSnapshot, after: SheetSnapshot): CellChange[] {
  const changes: CellChange[] = [];
  const rows = Math.max(before.grid.length, after.grid.length, before.formulas.length, after.formulas.length);
  for (let r = 0; r < rows; r++) {
    const cols = Math.max(before.grid[r]?.length ?? 0, after.grid[r]?.length ?? 0, before.formulas[r]?.length ?? 0, after.formulas[r]?.length ?? 0);
    for (let c = 0; c < cols; c++) {
      const a = before.grid[r]?.[c] ?? null;
      const b = after.grid[r]?.[c] ?? null;
      const fa = before.formulas[r]?.[c] ?? null;
      const fb = after.formulas[r]?.[c] ?? null;
      const valueChanged = !sameValue(a, b);
      if (!valueChanged && fa === fb) continue;
      const kind: CellChangeKind = isEmpty(a) && !fa ? 'added' : isEmpty(b) && !fb ? 'deleted' : 'modified';
      const asFormula = (f: string | null) => (f ? `=${f.replace(/^=/, '')}` : null);
      changes.push({ row: r, col: c, before: a, after: b, beforeFormula: asFormula(fa), afterFormula: asFormula(fb), kind });
    }
  }
  return changes;
}
