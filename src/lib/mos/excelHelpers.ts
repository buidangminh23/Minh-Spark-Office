import type { CellStyle, CellValue, SheetData, WorkbookData } from '../sheetTypes';

export function foldCell(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function findSheet(workbook: WorkbookData, targetName: string): SheetData | undefined {
  const needle = foldCell(targetName);
  return Object.values(workbook.sheets).find((sheet) => foldCell(sheet.name) === needle);
}

export function primarySheet(workbook: WorkbookData): SheetData | undefined {
  const firstId = workbook.sheetOrder[0];
  return (firstId ? workbook.sheets[firstId] : undefined) ?? Object.values(workbook.sheets)[0];
}

export function cellAt(sheet: SheetData | undefined, row: number, col: number): CellValue | undefined {
  return sheet?.cellData?.[row]?.[col];
}

export function formulaOf(cell: CellValue | undefined): string {
  return (cell?.f ?? '').replace(/\s+/g, '').toUpperCase();
}

export function numericOf(cell: CellValue | undefined): number | null {
  if (typeof cell?.v === 'number' && Number.isFinite(cell.v)) return cell.v;
  if (typeof cell?.v === 'string' && cell.v.trim() !== '' && Number.isFinite(Number(cell.v))) return Number(cell.v);
  return null;
}

export function resolveStyle(workbook: WorkbookData, cell: CellValue | undefined): CellStyle | undefined {
  if (!cell?.s) return undefined;
  if (typeof cell.s === 'string') return workbook.styles?.[cell.s];
  return cell.s;
}

export function isNear(value: number | null, expected: number, tolerance = 0.05): boolean {
  return value !== null && Math.abs(value - expected) <= tolerance;
}
