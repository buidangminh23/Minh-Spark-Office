import { columnLetter } from './sheetDiff';
import type { CellValue, SheetData, WorkbookData } from './sheetTypes';

export type SheetHealth = {
  sheetId: string;
  name: string;
  dataRows: number;
  dataColumns: number;
  ghostCells: number;
  emptyMerges: number;
  errorCells: string[];
};

export type WorkbookHealth = {
  sheets: SheetHealth[];
  unusedStyles: number;
  totalGhostCells: number;
  totalEmptyMerges: number;
  totalErrorCells: number;
  bytesBefore: number;
  bytesAfter: number;
};

const ERROR_VALUES = new Set(['#REF!', '#DIV/0!', '#NAME?', '#VALUE!', '#N/A', '#NUM!', '#NULL!', '#SPILL!', '#CALC!']);

const hasContent = (cell: CellValue | undefined) =>
  !!cell && ((cell.v !== undefined && cell.v !== null && cell.v !== '') || !!cell.f || !!cell.p?.body?.dataStream?.replace(/[\r\n]/g, ''));

function dataBounds(sheet: SheetData) {
  let lastRow = -1;
  let lastCol = -1;
  for (const [rk, cols] of Object.entries(sheet.cellData ?? {})) {
    for (const [ck, cell] of Object.entries(cols ?? {})) {
      if (!hasContent(cell)) continue;
      lastRow = Math.max(lastRow, Number(rk));
      lastCol = Math.max(lastCol, Number(ck));
    }
  }
  return { lastRow, lastCol };
}

function cleanSheet(sheet: SheetData): { cleaned: SheetData; health: Omit<SheetHealth, 'sheetId'> } {
  const { lastRow, lastCol } = dataBounds(sheet);
  const cellData: SheetData['cellData'] = {};
  let ghostCells = 0;
  const errorCells: string[] = [];
  for (const [rk, cols] of Object.entries(sheet.cellData ?? {})) {
    const r = Number(rk);
    for (const [ck, cell] of Object.entries(cols ?? {})) {
      const c = Number(ck);
      if (typeof cell?.v === 'string' && ERROR_VALUES.has(cell.v)) errorCells.push(`${columnLetter(c)}${r + 1}`);
      const outside = r > lastRow || c > lastCol;
      if (outside && !hasContent(cell)) {
        ghostCells++;
        continue;
      }
      (cellData[r] ??= {})[c] = cell;
    }
  }
  const mergeData = (sheet.mergeData ?? []).filter((m) => {
    if (m.startRow <= lastRow && m.startColumn <= lastCol) return true;
    for (let r = m.startRow; r <= m.endRow; r++) {
      for (let c = m.startColumn; c <= m.endColumn; c++) if (hasContent(sheet.cellData?.[r]?.[c])) return true;
    }
    return false;
  });
  return {
    cleaned: { ...sheet, cellData, mergeData },
    health: {
      name: sheet.name,
      dataRows: lastRow + 1,
      dataColumns: lastCol + 1,
      ghostCells,
      emptyMerges: (sheet.mergeData ?? []).length - mergeData.length,
      errorCells,
    },
  };
}

function dropUnusedStyles(workbook: WorkbookData): { styles: WorkbookData['styles']; removed: number } {
  const referenced = new Set<string>();
  const scan = JSON.stringify({ sheets: workbook.sheets, resources: workbook.resources ?? [] });
  for (const id of Object.keys(workbook.styles ?? {})) {
    if (scan.includes(`"${id}"`)) referenced.add(id);
  }
  const styles: WorkbookData['styles'] = {};
  for (const [id, style] of Object.entries(workbook.styles ?? {})) if (referenced.has(id)) styles[id] = style;
  return { styles, removed: Object.keys(workbook.styles ?? {}).length - referenced.size };
}

export function diagnoseWorkbook(workbook: WorkbookData): { health: WorkbookHealth; cleaned: WorkbookData } {
  const sheets: Record<string, SheetData> = {};
  const report: SheetHealth[] = [];
  const order = workbook.sheetOrder?.length ? workbook.sheetOrder : Object.keys(workbook.sheets ?? {});
  for (const id of Object.keys(workbook.sheets ?? {})) {
    const { cleaned, health } = cleanSheet(workbook.sheets[id]);
    sheets[id] = cleaned;
    report.push({ sheetId: id, ...health });
  }
  report.sort((a, b) => order.indexOf(a.sheetId) - order.indexOf(b.sheetId));
  const withSheets: WorkbookData = { ...workbook, sheets };
  const { styles, removed } = dropUnusedStyles(withSheets);
  const cleaned: WorkbookData = { ...withSheets, styles };
  return {
    cleaned,
    health: {
      sheets: report,
      unusedStyles: removed,
      totalGhostCells: report.reduce((n, s) => n + s.ghostCells, 0),
      totalEmptyMerges: report.reduce((n, s) => n + s.emptyMerges, 0),
      totalErrorCells: report.reduce((n, s) => n + s.errorCells.length, 0),
      bytesBefore: JSON.stringify(workbook).length,
      bytesAfter: JSON.stringify(cleaned).length,
    },
  };
}
