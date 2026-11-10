import type { CellValue, SheetData, WorkbookData } from './sheetTypes';
import type { ChartSeries } from './slideTypes';

export type SheetCellResult = string | number | boolean | null;

export interface SheetRange {
  sheetName?: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface ChartFromRange {
  categories: string[];
  series: ChartSeries[];
}

export class SheetLinkError extends Error {}

const MAX_RANGE_CELLS = 10000;
const FALLBACK_SERIES_COLORS = ['#0284C7', '#7C3AED', '#059669', '#D97706', '#DC2626', '#DB2777', '#0891B2', '#65A30D'];
const CELL_REF = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/;

export function columnLabelToIndex(label: string): number {
  let index = 0;
  for (const char of label.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function columnIndexToLabel(index: number): string {
  let label = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function parseCellRef(ref: string) {
  const match = CELL_REF.exec(ref.trim());
  if (!match) throw new SheetLinkError(`Ô "${ref}" không đúng định dạng (ví dụ: B2).`);
  return { row: Number(match[2]) - 1, column: columnLabelToIndex(match[1]) };
}

function unquoteSheetName(name: string) {
  const trimmed = name.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

export function parseSheetRange(input: string): SheetRange {
  const text = input.trim();
  if (!text) throw new SheetLinkError('Chưa nhập vùng dữ liệu.');
  const bang = text.lastIndexOf('!');
  const sheetName = bang >= 0 ? unquoteSheetName(text.slice(0, bang)) : undefined;
  const cells = bang >= 0 ? text.slice(bang + 1) : text;
  const [startRef, endRef = startRef, extra] = cells.split(':');
  if (extra !== undefined) throw new SheetLinkError(`Vùng "${cells}" không hợp lệ.`);
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  const range: SheetRange = {
    sheetName: sheetName || undefined,
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column),
  };
  const size = (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1);
  if (size > MAX_RANGE_CELLS) throw new SheetLinkError(`Vùng dữ liệu quá lớn (${size} ô, tối đa ${MAX_RANGE_CELLS}).`);
  return range;
}

export function formatSheetRange(range: SheetRange): string {
  const start = `${columnIndexToLabel(range.startColumn)}${range.startRow + 1}`;
  const end = `${columnIndexToLabel(range.endColumn)}${range.endRow + 1}`;
  const cells = start === end ? start : `${start}:${end}`;
  if (!range.sheetName) return cells;
  const needsQuotes = /[^A-Za-z0-9_]/.test(range.sheetName);
  const name = needsQuotes ? `'${range.sheetName.replace(/'/g, "''")}'` : range.sheetName;
  return `${name}!${cells}`;
}

export function listWorkbookSheets(workbook: WorkbookData): SheetData[] {
  return workbook.sheetOrder.map((id) => workbook.sheets[id]).filter((sheet): sheet is SheetData => Boolean(sheet));
}

export function findWorkbookSheet(workbook: WorkbookData, nameOrId: string | undefined): SheetData {
  const sheets = listWorkbookSheets(workbook);
  if (sheets.length === 0) throw new SheetLinkError('Sổ tính không có trang tính nào.');
  if (!nameOrId) return sheets[0];
  const found = sheets.find((sheet) => sheet.id === nameOrId) ?? sheets.find((sheet) => sheet.name === nameOrId);
  if (!found) throw new SheetLinkError(`Không tìm thấy trang tính "${nameOrId}" trong sổ tính.`);
  return found;
}

export function readCellValue(cell: CellValue | undefined): SheetCellResult {
  if (!cell) return null;
  const rich = cell.p?.body?.dataStream;
  if (rich) return rich.replace(/\r\n$/, '').replace(/\r/g, '\n');
  if (cell.v === undefined || cell.v === null || cell.v === '') {
    if (cell.f) throw new SheetLinkError(`Ô có công thức "${cell.f}" chưa có kết quả đã tính. Hãy mở và lưu lại sổ tính trong Minh Sheets.`);
    return null;
  }
  if (cell.t === 3) return Boolean(cell.v) && cell.v !== 0;
  if (typeof cell.v === 'number') return cell.v;
  if (cell.t === 2 && typeof cell.v === 'string' && cell.v.trim() !== '' && Number.isFinite(Number(cell.v))) return Number(cell.v);
  return cell.v;
}

export function readSheetRange(sheet: SheetData, range: SheetRange): SheetCellResult[][] {
  const grid: SheetCellResult[][] = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    const cells: SheetCellResult[] = [];
    for (let column = range.startColumn; column <= range.endColumn; column++) {
      try {
        cells.push(readCellValue(sheet.cellData[row]?.[column]));
      } catch (error) {
        const ref = `${columnIndexToLabel(column)}${row + 1}`;
        throw new SheetLinkError(`${ref}: ${(error as Error).message}`);
      }
    }
    grid.push(cells);
  }
  return grid;
}

export function cellToText(value: SheetCellResult): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function cellToNumber(value: SheetCellResult, ref: string): number {
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[\s,]/g, '');
    const parsed = Number(normalized);
    if (normalized !== '' && Number.isFinite(parsed)) return parsed;
  }
  throw new SheetLinkError(`Ô ${ref} chứa "${cellToText(value)}" không phải là số, không thể vẽ biểu đồ.`);
}

export function buildChartFromGrid(
  grid: SheetCellResult[][],
  range: SheetRange,
  previousSeries: ChartSeries[] = []
): ChartFromRange {
  if (grid.length < 2 || (grid[0]?.length ?? 0) < 2) {
    throw new SheetLinkError('Vùng dữ liệu biểu đồ cần ít nhất 2 hàng và 2 cột: hàng đầu là tên chuỗi, cột đầu là nhãn.');
  }
  const header = grid[0];
  const categories = grid.slice(1).map((row) => cellToText(row[0]));
  const series = header.slice(1).map((nameCell, offset) => {
    const columnIndex = offset + 1;
    const values = grid.slice(1).map((row, rowOffset) => {
      const ref = `${columnIndexToLabel(range.startColumn + columnIndex)}${range.startRow + rowOffset + 2}`;
      return cellToNumber(row[columnIndex] ?? null, ref);
    });
    const name = cellToText(nameCell) || `Chuỗi ${columnIndex}`;
    const color = previousSeries[offset]?.color ?? FALLBACK_SERIES_COLORS[offset % FALLBACK_SERIES_COLORS.length];
    return { name, values, color };
  });
  return { categories, series };
}

export function buildTableFromGrid(grid: SheetCellResult[][]): string[][] {
  if (grid.length === 0 || (grid[0]?.length ?? 0) === 0) throw new SheetLinkError('Vùng dữ liệu bảng đang trống.');
  return grid.map((row) => row.map(cellToText));
}
