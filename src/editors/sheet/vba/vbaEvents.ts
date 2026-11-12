import type { Box4 } from './vbaExcel';

export type VbaSheetEvent =
  | { kind: 'change'; sheetId: string; box: Box4 }
  | { kind: 'selection'; sheetId: string; box: Box4 }
  | { kind: 'activate'; previous: string | null; sheetId: string };

const VALUE_KEYS = ['v', 'p', 'f', 'si'];

const touchesValue = (cell: unknown) => cell === null || (typeof cell === 'object' && cell !== null && VALUE_KEYS.some((key) => key in cell));

export function changedValueBox(cellValue: Record<string, Record<string, unknown>> | undefined | null): Box4 | null {
  if (!cellValue) return null;
  let box: Box4 | null = null;
  for (const [rowKey, row] of Object.entries(cellValue)) {
    if (!row) continue;
    const r = Number(rowKey);
    for (const [columnKey, cell] of Object.entries(row)) {
      if (!touchesValue(cell)) continue;
      const c = Number(columnKey);
      if (!box) box = { r0: r, c0: c, r1: r, c1: c };
      else {
        box.r0 = Math.min(box.r0, r);
        box.c0 = Math.min(box.c0, c);
        box.r1 = Math.max(box.r1, r);
        box.c1 = Math.max(box.c1, c);
      }
    }
  }
  return box;
}
