import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { CellStyle, CellValue, ImportTruncation, SheetData, WorkbookData } from './sheetTypes';
import { columnLetter, emptySheet, emptyWorkbook, uid } from './workbookBasics';

export { columnLetter, emptySheet, emptyWorkbook, uid };

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MAX_IMPORT_ROWS = 20000;
const MAX_IMPORT_COLS = 500;

const THEME_COLORS = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];
const INDEXED_COLORS: Record<number, string> = {
  8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00', 12: '0000FF', 13: 'FFFF00', 14: 'FF00FF', 15: '00FFFF',
  16: '800000', 17: '008000', 18: '000080', 19: '808000', 20: '800080', 21: '008080', 22: 'C0C0C0', 23: '808080',
  64: '000000',
};

const BORDER_TO_UNIVER: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8,
  mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};
const BORDER_FROM_UNIVER = Object.fromEntries(Object.entries(BORDER_TO_UNIVER).map(([key, value]) => [value, key])) as Record<number, ExcelJS.BorderStyle>;

const H_ALIGN_TO_UNIVER: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, fill: 1, centerContinuous: 2, distributed: 6 };
const H_ALIGN_FROM_UNIVER: Record<number, ExcelJS.Alignment['horizontal']> = { 1: 'left', 2: 'center', 3: 'right', 4: 'justify', 5: 'justify', 6: 'distributed' };
const V_ALIGN_TO_UNIVER: Record<string, number> = { top: 1, middle: 2, bottom: 3, justify: 2, distributed: 2 };
const V_ALIGN_FROM_UNIVER: Record<number, ExcelJS.Alignment['vertical']> = { 1: 'top', 2: 'middle', 3: 'bottom' };

const applyTint = (hex: string, tint = 0) => {
  if (!tint) return hex;
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const tinted = channels.map((channel) => Math.round(tint < 0 ? channel * (1 + tint) : channel + (255 - channel) * tint));
  return tinted.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('').toUpperCase();
};

export const normalizeHexColor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{8}$/i.test(hex)) return `#${hex.slice(2).toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${hex.split('').map((char) => char + char).join('').toUpperCase()}`;
  return undefined;
};

const RGB_CHANNEL = String.raw`\s*\d{1,3}(?:\.\d+)?%?\s*`;
const RGB_FUNCTION = new RegExp(String.raw`^rgba?\(${RGB_CHANNEL},${RGB_CHANNEL},${RGB_CHANNEL}(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$`, 'i');

export const safeCssColor = (value: unknown): string | undefined => {
  const hex = normalizeHexColor(value);
  if (hex) return hex;
  if (typeof value === 'string' && RGB_FUNCTION.test(value.trim())) return value.trim();
  return undefined;
};

const readColor = (color?: Partial<ExcelJS.Color> & { indexed?: number; tint?: number }) => {
  if (!color) return undefined;
  if (color.argb) return normalizeHexColor(color.argb);
  if (color.theme !== undefined) return `#${applyTint(THEME_COLORS[color.theme] ?? '000000', color.tint)}`;
  if (color.indexed !== undefined && INDEXED_COLORS[color.indexed]) return `#${INDEXED_COLORS[color.indexed]}`;
  return undefined;
};

const toArgb = (rgb?: string) => {
  if (!rgb) return undefined;
  const value = rgb.replace('#', '').trim();
  if (/^[0-9a-f]{6}$/i.test(value)) return `FF${value.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(value)) return `FF${value.split('').map((char) => char + char).join('').toUpperCase()}`;
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(rgb);
  if (match) return `FF${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  return undefined;
};

const dateToSerial = (date: Date) => (date.getTime() - EXCEL_EPOCH) / 86400000;

export const DEFAULT_SHEET_FONT_FAMILY = 'Arial';

export const importedFontFamily = (name: string): string =>
  /^segoe ui(?:\s|$)/i.test(name.trim()) ? DEFAULT_SHEET_FONT_FAMILY : name;

export const toNfc = (text: string): string => text.normalize('NFC');

function styleFromExcel(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};
  const font = cell.font;
  if (font) {
    if (font.name) style.ff = importedFontFamily(font.name);
    if (font.size) style.fs = font.size;
    if (font.bold) style.bl = 1;
    if (font.italic) style.it = 1;
    if (font.underline) style.ul = { s: 1 };
    if (font.strike) style.st = { s: 1 };
    if (font.vertAlign === 'superscript') style.va = 3;
    if (font.vertAlign === 'subscript') style.va = 2;
    const color = readColor(font.color);
    if (color && color.toUpperCase() !== '#000000') style.cl = { rgb: color };
  }
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (fill && fill.type === 'pattern' && fill.pattern !== 'none') {
    const color = readColor(fill.fgColor) ?? readColor(fill.bgColor);
    if (color) style.bg = { rgb: color };
  }
  const alignment = cell.alignment;
  if (alignment) {
    if (alignment.horizontal && H_ALIGN_TO_UNIVER[alignment.horizontal]) style.ht = H_ALIGN_TO_UNIVER[alignment.horizontal];
    if (alignment.vertical && V_ALIGN_TO_UNIVER[alignment.vertical]) style.vt = V_ALIGN_TO_UNIVER[alignment.vertical];
    if (alignment.wrapText) style.tb = 3;
    if (typeof alignment.textRotation === 'number' && alignment.textRotation) style.tr = { a: alignment.textRotation };
  }
  const border = cell.border;
  if (border) {
    const bd: NonNullable<CellStyle['bd']> = {};
    for (const [side, key] of [['top', 't'], ['bottom', 'b'], ['left', 'l'], ['right', 'r']] as const) {
      const item = border[side];
      if (item?.style) bd[key] = { s: BORDER_TO_UNIVER[item.style] ?? 1, cl: { rgb: readColor(item.color) ?? '#000000' } };
    }
    if (Object.keys(bd).length) style.bd = bd;
  }
  if (cell.numFmt && cell.numFmt !== 'General') style.n = { pattern: cell.numFmt };
  return Object.keys(style).length ? style : undefined;
}

function valueFromExcel(cell: ExcelJS.Cell): CellValue | null {
  const raw = cell.value;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return { v: raw, t: 2 };
  if (typeof raw === 'string') return { v: toNfc(raw), t: 1 };
  if (typeof raw === 'boolean') return { v: raw ? 1 : 0, t: 3 };
  if (raw instanceof Date) return { v: dateToSerial(raw), t: 2 };
  if (typeof raw === 'object') {
    if ('formula' in raw || 'sharedFormula' in raw) {
      const formula = cell.formula;
      const result = (raw as ExcelJS.CellFormulaValue).result;
      const value: CellValue = formula ? { f: `=${formula}` } : {};
      if (result instanceof Date) value.v = dateToSerial(result);
      else if (typeof result === 'number') { value.v = result; value.t = 2; }
      else if (typeof result === 'string') { value.v = toNfc(result); value.t = 1; }
      else if (typeof result === 'boolean') { value.v = result ? 1 : 0; value.t = 3; }
      else if (result && typeof result === 'object' && 'error' in result) value.v = String(result.error);
      return value;
    }
    if ('richText' in raw) return { v: toNfc(raw.richText.map((part) => part.text).join('')), t: 1 };
    if ('hyperlink' in raw) return { v: toNfc(String((raw as ExcelJS.CellHyperlinkValue).text ?? raw.hyperlink)), t: 1 };
    if ('error' in raw) return { v: String(raw.error), t: 1 };
  }
  return { v: toNfc(String(raw)), t: 1 };
}

const MAX_EXPORT_CELLS = 5_000_000;
const MAX_SAFE_DIGITS = 15;

export const inferDelimitedValue = (text: string): CellValue => {
  const trimmed = text.trim();
  if (!trimmed) return { v: text, t: 1 };
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return { v: upper === 'TRUE' ? 1 : 0, t: 3 };
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) return { v: text, t: 1 };
  if (/^[-+]?0\d/.test(trimmed) || /^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(trimmed)) return { v: text, t: 1 };
  if (trimmed.replace(/[eE].*$/, '').replace(/\D/g, '').replace(/^0+/, '').length > MAX_SAFE_DIGITS) return { v: text, t: 1 };
  const value = Number(trimmed);
  return Number.isFinite(value) ? { v: value, t: 2 } : { v: text, t: 1 };
};

const recordTruncation = (data: WorkbookData, entry: ImportTruncation) => {
  if (entry.rows <= entry.keptRows && entry.columns <= entry.keptColumns) return;
  (data.importTruncation ??= []).push(entry);
};

export const describeImportTruncation = (entries?: ImportTruncation[]): string | null => {
  if (!entries?.length) return null;
  const parts = entries.map((entry) => {
    const dims: string[] = [];
    if (entry.rows > entry.keptRows) dims.push(`${entry.keptRows.toLocaleString('vi-VN')}/${entry.rows.toLocaleString('vi-VN')} dòng`);
    if (entry.columns > entry.keptColumns) dims.push(`${entry.keptColumns.toLocaleString('vi-VN')}/${entry.columns.toLocaleString('vi-VN')} cột`);
    return `"${entry.sheet}" (${dims.join(', ')})`;
  });
  return `Tệp vượt giới hạn nạp, phần dữ liệu thừa KHÔNG được nạp: ${parts.join('; ')}. Lưu lại sẽ mất phần này.`;
};

const sheetJsContentExtent =(worksheet: XLSX.WorkSheet) => {
  let rows = 0;
  let columns = 0;
  for (const key of Object.keys(worksheet)) {
    if (key.startsWith('!')) continue;
    const cell = worksheet[key] as XLSX.CellObject | undefined;
    if (!cell || (cell.v === undefined && !cell.f)) continue;
    const address = XLSX.utils.decode_cell(key);
    rows = Math.max(rows, address.r + 1);
    columns = Math.max(columns, address.c + 1);
  }
  return { rows, columns };
};

async function excelJsToWorkbook(buffer: ArrayBuffer, name: string): Promise<WorkbookData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const data: WorkbookData = { id: uid('wb'), name, appVersion: '0.1.0', locale: 'viVN', styles: {}, sheetOrder: [], sheets: {} };
  const styleIds = new Map<string, string>();
  const styleRef = (style?: CellStyle) => {
    if (!style) return undefined;
    const key = JSON.stringify(style);
    let id = styleIds.get(key);
    if (!id) {
      id = `s${styleIds.size + 1}`;
      styleIds.set(key, id);
      data.styles[id] = style;
    }
    return id;
  };
  workbook.eachSheet((worksheet) => {
    const rowLimit = Math.min(Math.max(worksheet.rowCount, 1), MAX_IMPORT_ROWS);
    const colLimit = Math.min(Math.max(worksheet.columnCount, 1), MAX_IMPORT_COLS);
    const sheet = emptySheet(worksheet.name, Math.max(rowLimit + 50, 1000), Math.max(colLimit + 5, 26));
    if (worksheet.state && worksheet.state !== 'visible') sheet.hidden = 1;
    const tab = readColor(worksheet.properties?.tabColor as ExcelJS.Color | undefined);
    if (tab) sheet.tabColor = tab;
    let contentRows = 0;
    let contentColumns = 0;
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (row.hasValues) {
        contentRows = Math.max(contentRows, rowNumber);
        if (row.cellCount > colLimit) {
          row.eachCell((cell, colNumber) => {
            if (cell.value !== null && cell.value !== undefined) contentColumns = Math.max(contentColumns, colNumber);
          });
        }
      }
      if (rowNumber > rowLimit) return;
      const r = rowNumber - 1;
      if (row.height) sheet.rowData[r] = { ...(sheet.rowData[r] ?? {}), h: Math.round(row.height * 4 / 3) };
      if (row.hidden) sheet.rowData[r] = { ...(sheet.rowData[r] ?? {}), hd: 1 };
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > colLimit) return;
        if (cell.isMerged && cell.master.address !== cell.address) {
          const style = styleRef(styleFromExcel(cell));
          if (style) (sheet.cellData[r] ??= {})[colNumber - 1] = { s: style };
          return;
        }
        const value = valueFromExcel(cell);
        const style = styleRef(styleFromExcel(cell));
        if (!value && !style) return;
        const entry: CellValue = { ...(value ?? {}) };
        if (style) entry.s = style;
        (sheet.cellData[r] ??= {})[colNumber - 1] = entry;
      });
    });
    worksheet.columns?.forEach((column, index) => {
      if (index >= colLimit) return;
      if (column.width) sheet.columnData[index] = { w: Math.round(column.width * 7 + 5) };
      if (column.hidden) sheet.columnData[index] = { ...(sheet.columnData[index] ?? {}), hd: 1 };
    });
    const merges = (worksheet.model as { merges?: string[] }).merges ?? [];
    for (const range of merges) {
      const decoded = XLSX.utils.decode_range(range);
      sheet.mergeData.push({ startRow: decoded.s.r, endRow: decoded.e.r, startColumn: decoded.s.c, endColumn: decoded.e.c });
    }
    const view = worksheet.views?.[0] as (ExcelJS.WorksheetView & { xSplit?: number; ySplit?: number; showGridLines?: boolean; zoomScale?: number }) | undefined;
    if (view) {
      if (view.state === 'frozen' && (view.xSplit || view.ySplit)) {
        sheet.freeze = { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0, startRow: view.ySplit ?? 0, startColumn: view.xSplit ?? 0 };
      }
      if (view.showGridLines === false) sheet.showGridlines = 0;
      if (view.zoomScale) sheet.zoomRatio = view.zoomScale / 100;
    }
    recordTruncation(data, { sheet: worksheet.name, rows: contentRows, columns: contentColumns, keptRows: rowLimit, keptColumns: colLimit });
    data.sheetOrder.push(sheet.id);
    data.sheets[sheet.id] = sheet;
  });
  if (!data.sheetOrder.length) return emptyWorkbook(name);
  return data;
}

function sheetJsToWorkbook(buffer: ArrayBuffer, name: string, csv = false): WorkbookData {
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true, cellDates: false, cellStyles: true, raw: false, codepage: 65001, ...(csv ? { raw: true } : {}) });
  const data: WorkbookData = { id: uid('wb'), name, appVersion: '0.1.0', locale: 'viVN', styles: {}, sheetOrder: [], sheets: {} };
  const formatStyleIds = new Map<string, string>();
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    const rowLimit = Math.min(range.e.r + 1, MAX_IMPORT_ROWS);
    const colLimit = Math.min(range.e.c + 1, MAX_IMPORT_COLS);
    const sheet = emptySheet(sheetName, Math.max(rowLimit + 50, 1000), Math.max(colLimit + 5, 26));
    if (range.e.r + 1 > rowLimit || range.e.c + 1 > colLimit) {
      const extent = sheetJsContentExtent(worksheet);
      recordTruncation(data, { sheet: sheetName, rows: extent.rows, columns: extent.columns, keptRows: rowLimit, keptColumns: colLimit });
    }
    for (let r = range.s.r; r < rowLimit; r++) {
      for (let c = range.s.c; c < colLimit; c++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (!cell) continue;
        const entry: CellValue = {};
        if (cell.f) entry.f = `=${cell.f}`;
        if (cell.t === 'n') { entry.v = cell.v as number; entry.t = 2; }
        else if (cell.t === 'b') { entry.v = cell.v ? 1 : 0; entry.t = 3; }
        else if (cell.t === 'd') { entry.v = dateToSerial(cell.v as Date); entry.t = 2; }
        else if (cell.t === 'e') entry.v = cell.w ?? '#ERROR!';
        else if (csv && cell.t === 's' && !cell.f && typeof cell.v === 'string') Object.assign(entry, inferDelimitedValue(toNfc(cell.v)));
        else if (cell.v !== undefined) { entry.v = toNfc(String(cell.v)); entry.t = 1; }
        if (cell.z && cell.z !== 'General') {
          const pattern = String(cell.z);
          let id = formatStyleIds.get(pattern);
          if (!id) {
            id = `n${formatStyleIds.size + 1}`;
            formatStyleIds.set(pattern, id);
            data.styles[id] = { n: { pattern } };
          }
          entry.s = id;
        }
        (sheet.cellData[r] ??= {})[c] = entry;
      }
    }
    (worksheet['!cols'] ?? []).forEach((column, index) => {
      if (!column) return;
      const width = column.wpx ?? (column.wch ? column.wch * 7 + 5 : column.width ? column.width * 7 + 5 : undefined);
      if (width) sheet.columnData[index] = { w: Math.round(width) };
      if (column.hidden) sheet.columnData[index] = { ...(sheet.columnData[index] ?? {}), hd: 1 };
    });
    (worksheet['!rows'] ?? []).forEach((row, index) => {
      if (!row) return;
      const height = row.hpx ?? (row.hpt ? row.hpt * 4 / 3 : undefined);
      if (height) sheet.rowData[index] = { h: Math.round(height) };
      if (row.hidden) sheet.rowData[index] = { ...(sheet.rowData[index] ?? {}), hd: 1 };
    });
    for (const merge of worksheet['!merges'] ?? []) {
      sheet.mergeData.push({ startRow: merge.s.r, endRow: merge.e.r, startColumn: merge.s.c, endColumn: merge.e.c });
    }
    data.sheetOrder.push(sheet.id);
    data.sheets[sheet.id] = sheet;
  }
  if (!data.sheetOrder.length) return emptyWorkbook(name);
  return data;
}

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

export async function importSpreadsheet(buffer: ArrayBuffer, fileName: string): Promise<WorkbookData> {
  const name = fileName.replace(/\.[^.]+$/, '') || 'Bảng tính';
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const bytes = new Uint8Array(buffer);
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') return sheetJsToWorkbook(buffer, name, true);
  if (isZip(bytes) && (extension === 'xlsx' || extension === 'xlsm' || extension === '')) {
    try {
      return await excelJsToWorkbook(buffer, name);
    } catch {
      return sheetJsToWorkbook(buffer, name);
    }
  }
  return sheetJsToWorkbook(buffer, name);
}

export const resolveCellStyle = (workbook: WorkbookData, style: CellValue['s']): CellStyle | undefined => {
  if (!style) return undefined;
  if (typeof style === 'string') return workbook.styles[style] ?? undefined;
  return style;
};

const resolveStyle = resolveCellStyle;

const toExcelValue = (cell: CellValue): ExcelJS.CellValue => {
  if (cell.f) {
    const formula = cell.f.replace(/^=/, '');
    const result = cell.v === undefined || cell.v === null ? undefined : cell.v;
    return { formula, result: result as ExcelJS.CellFormulaValue['result'] } as ExcelJS.CellFormulaValue;
  }
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream.replace(/\r\n$/, '').replace(/\r/g, '\n');
  if (cell.v === undefined || cell.v === null) return null;
  if (cell.t === 3) return Boolean(cell.v);
  if (cell.t === 2 || (typeof cell.v === 'number' && cell.t !== 1 && cell.t !== 4)) return Number(cell.v);
  return String(cell.v);
};

export async function exportWorkbookToXlsx(data: WorkbookData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Minh Office';
  workbook.created = new Date();
  for (const sheetId of data.sheetOrder) {
    const sheet = data.sheets[sheetId];
    if (!sheet) continue;
    const freeze = sheet.freeze && (sheet.freeze.xSplit > 0 || sheet.freeze.ySplit > 0)
      ? [{ state: 'frozen' as const, xSplit: sheet.freeze.xSplit, ySplit: sheet.freeze.ySplit, showGridLines: sheet.showGridlines !== 0 }]
      : [{ showGridLines: sheet.showGridlines !== 0 }];
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || 'Sheet', {
      views: freeze,
      properties: sheet.tabColor ? { tabColor: { argb: toArgb(sheet.tabColor) } } as Partial<ExcelJS.WorksheetProperties> : undefined,
      state: sheet.hidden ? 'hidden' : 'visible',
    });
    for (const [colKey, column] of Object.entries(sheet.columnData ?? {})) {
      const col = worksheet.getColumn(Number(colKey) + 1);
      if (column?.w) col.width = Math.max(1, (column.w - 5) / 7);
      if (column?.hd) col.hidden = true;
    }
    for (const [rowKey, row] of Object.entries(sheet.rowData ?? {})) {
      const excelRow = worksheet.getRow(Number(rowKey) + 1);
      if (row?.h) excelRow.height = row.h * 0.75;
      if (row?.hd) excelRow.hidden = true;
    }
    for (const [rowKey, columns] of Object.entries(sheet.cellData ?? {})) {
      for (const [colKey, cell] of Object.entries(columns ?? {})) {
        if (!cell) continue;
        const target = worksheet.getCell(Number(rowKey) + 1, Number(colKey) + 1);
        const value = toExcelValue(cell);
        if (value !== null) target.value = value;
        const style = resolveStyle(data, cell.s);
        if (!style) continue;
        const font: Partial<ExcelJS.Font> = {};
        if (style.ff) font.name = style.ff;
        if (style.fs) font.size = style.fs;
        if (style.bl) font.bold = true;
        if (style.it) font.italic = true;
        if (style.ul?.s) font.underline = true;
        if (style.st?.s) font.strike = true;
        if (style.va === 3) font.vertAlign = 'superscript';
        if (style.va === 2) font.vertAlign = 'subscript';
        const color = toArgb(style.cl?.rgb);
        if (color) font.color = { argb: color };
        if (Object.keys(font).length) target.font = font;
        const background = toArgb(style.bg?.rgb);
        if (background) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: background } };
        const alignment: Partial<ExcelJS.Alignment> = {};
        if (style.ht && H_ALIGN_FROM_UNIVER[style.ht]) alignment.horizontal = H_ALIGN_FROM_UNIVER[style.ht];
        if (style.vt && V_ALIGN_FROM_UNIVER[style.vt]) alignment.vertical = V_ALIGN_FROM_UNIVER[style.vt];
        if (style.tb === 3) alignment.wrapText = true;
        if (style.tr?.a) alignment.textRotation = style.tr.a;
        if (Object.keys(alignment).length) target.alignment = alignment;
        if (style.bd) {
          const border: Partial<ExcelJS.Borders> = {};
          for (const [key, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']] as const) {
            const item = style.bd[key];
            if (item && item.s) border[side] = { style: BORDER_FROM_UNIVER[item.s] ?? 'thin', color: { argb: toArgb(item.cl?.rgb) ?? 'FF000000' } };
          }
          if (Object.keys(border).length) target.border = border;
        }
        if (style.n?.pattern) target.numFmt = style.n.pattern;
      }
    }
    for (const merge of sheet.mergeData ?? []) {
      try {
        worksheet.mergeCells(merge.startRow + 1, merge.startColumn + 1, merge.endRow + 1, merge.endColumn + 1);
      } catch {
        continue;
      }
    }
  }
  if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DateToken = { kind: 'literal'; text: string } | { kind: 'part'; text: string };

const DATE_PART = /^(\[h+\]|\[m+\]|\[s+\]|y+|m+|d+|h+|s+|AM\/PM|A\/P|\.0+)/i;

const firstSection = (pattern: string) => {
  let quoted = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\') i++;
    else if (char === '"') quoted = !quoted;
    else if (char === ';' && !quoted) return pattern.slice(0, i);
  }
  return pattern;
};

const tokenizeDatePattern = (pattern: string): DateToken[] => {
  const tokens: DateToken[] = [];
  const source = firstSection(pattern);
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '"') {
      const close = source.indexOf('"', i + 1);
      const stop = close === -1 ? source.length : close;
      tokens.push({ kind: 'literal', text: source.slice(i + 1, stop) });
      i = stop + 1;
      continue;
    }
    if (char === '\\') {
      tokens.push({ kind: 'literal', text: source[i + 1] ?? '' });
      i += 2;
      continue;
    }
    if (char === '_' || char === '*') {
      i += 2;
      continue;
    }
    const part = DATE_PART.exec(source.slice(i));
    if (part) {
      tokens.push({ kind: 'part', text: part[0] });
      i += part[0].length;
      continue;
    }
    if (char === '[') {
      const close = source.indexOf(']', i);
      i = close === -1 ? source.length : close + 1;
      continue;
    }
    tokens.push({ kind: 'literal', text: char });
    i++;
  }
  return tokens;
};

export const isDateTimePattern = (pattern: string) => {
  const tokens = tokenizeDatePattern(pattern);
  const parts = tokens.filter((token) => token.kind === 'part' && !token.text.startsWith('.'));
  if (!parts.length) return false;
  return !tokens.some((token) => token.kind === 'literal' && /[#0?]/.test(token.text));
};

const isMinuteToken = (tokens: DateToken[], index: number) => {
  const parts = tokens.map((token, i) => ({ token, i })).filter(({ token }) => token.kind === 'part' && !/^(AM\/PM|A\/P|\.0+)$/i.test(token.text));
  const position = parts.findIndex(({ i }) => i === index);
  const previous = parts[position - 1]?.token.text.toLowerCase() ?? '';
  const next = parts[position + 1]?.token.text.toLowerCase() ?? '';
  return previous.replace(/[[\]]/g, '').startsWith('h') || next.replace(/[[\]]/g, '').startsWith('s');
};

export const formatSerialDateTime = (serial: number, pattern: string): string => {
  const tokens = tokenizeDatePattern(pattern);
  const fractionDigits = tokens.find((token) => token.kind === 'part' && token.text.startsWith('.'))?.text.length ?? 1;
  const precision = 10 ** Math.max(0, fractionDigits - 1);
  const totalUnits = Math.round(serial * 86400 * precision);
  const totalSeconds = Math.floor(totalUnits / precision);
  const fraction = totalUnits - totalSeconds * precision;
  const days = Math.floor(totalSeconds / 86400);
  const secondsOfDay = totalSeconds - days * 86400;
  const date = new Date(EXCEL_EPOCH + days * 86400000);
  if (Number.isNaN(date.getTime())) return String(serial);
  const hour = Math.floor(secondsOfDay / 3600);
  const minute = Math.floor((secondsOfDay % 3600) / 60);
  const second = secondsOfDay % 60;
  const twelveHour = tokens.some((token) => token.kind === 'part' && /^(AM\/PM|A\/P)$/i.test(token.text));
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return tokens
    .map((token, index) => {
      if (token.kind === 'literal') return token.text;
      const text = token.text;
      const lower = text.toLowerCase();
      if (/^\[h+\]$/.test(lower)) return pad(Math.floor(totalSeconds / 3600), lower.length - 2);
      if (/^\[m+\]$/.test(lower)) return pad(Math.floor(totalSeconds / 60), lower.length - 2);
      if (/^\[s+\]$/.test(lower)) return pad(totalSeconds, lower.length - 2);
      if (lower === 'am/pm') return hour < 12 ? (text === text.toLowerCase() ? 'am' : 'AM') : text === text.toLowerCase() ? 'pm' : 'PM';
      if (lower === 'a/p') return hour < 12 ? text[0] : text[2];
      if (lower.startsWith('.')) return fractionDigits > 1 ? `.${pad(fraction, fractionDigits - 1)}` : '';
      if (lower.startsWith('y')) return lower.length <= 2 ? pad(date.getUTCFullYear() % 100, 2) : String(date.getUTCFullYear());
      if (lower.startsWith('d')) {
        if (lower.length === 1) return String(date.getUTCDate());
        if (lower.length === 2) return pad(date.getUTCDate(), 2);
        return lower.length === 3 ? DAY_SHORT[date.getUTCDay()] : DAY_LONG[date.getUTCDay()];
      }
      if (lower.startsWith('h')) {
        const shown = twelveHour ? hour % 12 || 12 : hour;
        return lower.length === 1 ? String(shown) : pad(shown, 2);
      }
      if (lower.startsWith('s')) return lower.length === 1 ? String(second) : pad(second, 2);
      if (lower.startsWith('m')) {
        if (lower.length <= 2 && isMinuteToken(tokens, index)) return lower.length === 1 ? String(minute) : pad(minute, 2);
        const month = date.getUTCMonth();
        if (lower.length === 1) return String(month + 1);
        if (lower.length === 2) return pad(month + 1, 2);
        if (lower.length === 3) return MONTH_SHORT[month];
        if (lower.length === 5) return MONTH_LONG[month][0];
        return MONTH_LONG[month];
      }
      return text;
    })
    .join('');
};

export const formatCellDisplay = (workbook: WorkbookData | undefined, cell?: CellValue): string => {
  if (!cell) return '';
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream.replace(/\r\n$/, '');
  if (cell.v === undefined || cell.v === null) return '';
  const style = workbook ? resolveStyle(workbook, cell.s) : typeof cell.s === 'object' && cell.s ? cell.s : undefined;
  const pattern = style?.n?.pattern ?? '';
  if (typeof cell.v === 'number' && Number.isFinite(cell.v) && pattern && pattern !== '@') {
    if (pattern.includes('%')) {
      const decMatch = /0\.(0+)%/.exec(pattern);
      const decimals = decMatch ? decMatch[1].length : 0;
      return `${(cell.v * 100).toFixed(decimals)}%`;
    }
    if (isDateTimePattern(pattern)) return formatSerialDateTime(cell.v, pattern);
    const decMatch = /0\.(0+)/.exec(pattern);
    const decimals = decMatch ? decMatch[1].length : 0;
    const useGrouping = pattern.includes(',');
    const formatted = cell.v.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
    if (pattern.includes('₫')) return `${formatted} ₫`;
    if (pattern.includes('$')) return `$${formatted}`;
    if (pattern.includes('€')) return `€${formatted}`;
    return formatted;
  }
  if (cell.t === 3) return cell.v ? 'TRUE' : 'FALSE';
  return String(cell.v);
};

export class ExportTooLargeError extends Error {
  constructor(rows: number, columns: number) {
    super(`Trang tính quá lớn để xuất (${rows.toLocaleString('vi-VN')} dòng × ${columns.toLocaleString('vi-VN')} cột). Hãy chọn vùng nhỏ hơn hoặc xuất .xlsx.`);
    this.name = 'ExportTooLargeError';
  }
}

const getExportBounds = (sheet: SheetData) => {
  const bounds = getSheetBounds(sheet, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const rows = bounds.maxRow + 1;
  const columns = bounds.maxCol + 1;
  if (rows * columns > MAX_EXPORT_CELLS) throw new ExportTooLargeError(rows, columns);
  return bounds;
};

const getSheetBounds = (sheet: SheetData, maxRowCap = 2000, maxColCap = 200) => {
  let maxRow = -1;
  let maxCol = -1;
  for (const [rKey, columns] of Object.entries(sheet.cellData ?? {})) {
    const r = Number(rKey);
    if (!Number.isFinite(r) || r > maxRowCap) continue;
    for (const [cKey, cell] of Object.entries(columns ?? {})) {
      const c = Number(cKey);
      if (!Number.isFinite(c) || c > maxColCap) continue;
      if (cell && (cell.v !== undefined && cell.v !== null && cell.v !== '' || cell.f || cell.p?.body?.dataStream)) {
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      }
    }
  }
  for (const merge of sheet.mergeData ?? []) {
    if (merge.startRow <= maxRow + 2 && merge.startColumn <= maxCol + 2) {
      maxRow = Math.max(maxRow, Math.min(merge.endRow, maxRowCap));
      maxCol = Math.max(maxCol, Math.min(merge.endColumn, maxColCap));
    }
  }
  return { maxRow, maxCol };
};

export function exportSheetToCsv(sheet: SheetData, workbook?: WorkbookData): Blob {
  const { maxRow, maxCol } = getExportBounds(sheet);
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const values: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const text = formatCellDisplay(workbook, sheet.cellData[r]?.[c]);
      values.push(/[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
    }
    lines.push(values.join(','));
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

export function exportSheetToTsv(sheet: SheetData, workbook?: WorkbookData): Blob {
  const { maxRow, maxCol } = getExportBounds(sheet);
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const values: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const text = formatCellDisplay(workbook, sheet.cellData[r]?.[c]).replace(/[\t\r\n]+/g, ' ');
      values.push(text);
    }
    lines.push(values.join('\t'));
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/tab-separated-values;charset=utf-8' });
}

export function exportSheetToJson(sheet: SheetData, workbook?: WorkbookData): Blob {
  const { maxRow, maxCol } = getExportBounds(sheet);
  if (maxRow < 0 || maxCol < 0) {
    return new Blob([JSON.stringify([], null, 2)], { type: 'application/json;charset=utf-8' });
  }
  let headerRow = 0;
  for (let r = 0; r <= Math.min(maxRow, 5); r++) {
    let nonEmpty = 0;
    for (let c = 0; c <= maxCol; c++) {
      if (formatCellDisplay(workbook, sheet.cellData[r]?.[c]).trim()) nonEmpty++;
    }
    if (nonEmpty >= Math.min(2, maxCol + 1)) {
      headerRow = r;
      break;
    }
  }
  const headers: string[] = [];
  for (let c = 0; c <= maxCol; c++) {
    const rawHeader = formatCellDisplay(workbook, sheet.cellData[headerRow]?.[c]).trim();
    headers.push(rawHeader || columnLetter(c));
  }
  const records: Record<string, string | number | boolean | null>[] = [];
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const rowObj: Record<string, string | number | boolean | null> = {};
    let hasContent = false;
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cellData[r]?.[c];
      const val = cell?.v !== undefined && cell?.v !== null ? (cell.t === 3 ? Boolean(cell.v) : cell.v) : (formatCellDisplay(workbook, cell) || null);
      if (val !== null && val !== '') hasContent = true;
      rowObj[headers[c]] = val;
    }
    if (hasContent) records.push(rowObj);
  }
  return new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8' });
}

export async function exportSingleSheetToXlsx(workbook: WorkbookData, sheetId: string): Promise<Blob> {
  const target = workbook.sheets[sheetId];
  if (!target) return exportWorkbookToXlsx(workbook);
  const single: WorkbookData = {
    ...workbook,
    id: uid('wb'),
    name: target.name,
    sheetOrder: [sheetId],
    sheets: { [sheetId]: target },
  };
  return exportWorkbookToXlsx(single);
}

const parsePrintArea = (area?: string) => {
  if (!area) return null;
  const cleaned = area.includes('!') ? area.split('!').pop() ?? area : area;
  const normalized = cleaned.replaceAll('$', '').trim().toUpperCase();
  if (!/^[A-Z]+\d+(?::[A-Z]+\d+)?$/.test(normalized)) return null;
  try {
    const decoded = XLSX.utils.decode_range(normalized);
    return { startRow: decoded.s.r, endRow: decoded.e.r, startCol: decoded.s.c, endCol: decoded.e.c };
  } catch {
    return null;
  }
};

export type StyledHtmlOptions = {
  title?: string;
  showGridlines?: boolean;
  printArea?: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'A3' | 'Letter';
  fitToPage?: boolean;
  signedBy?: string;
  signedRole?: string;
  signedAt?: number;
  standalone?: boolean;
};

const escapeHtmlText = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const safeFontFamily = (value: unknown) =>
  typeof value === 'string' ? value.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80) : '';

const finiteNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function exportSheetToStyledHtml(workbook: WorkbookData, sheet: SheetData, options: StyledHtmlOptions = {}): string {
  const escape = escapeHtmlText;
  const area = parsePrintArea(options.printArea);
  const detected = getSheetBounds(sheet, MAX_IMPORT_ROWS, MAX_IMPORT_COLS);
  const startRow = area ? area.startRow : 0;
  const endRow = area ? area.endRow : Math.max(detected.maxRow, 0);
  const startCol = area ? area.startCol : 0;
  const endCol = area ? area.endCol : Math.max(detected.maxCol, 0);
  const showGrid = options.showGridlines ?? sheet.showGridlines !== 0;

  const mergeMaster = new Map<string, { rowSpan: number; colSpan: number }>();
  const mergeCovered = new Set<string>();
  for (const m of sheet.mergeData ?? []) {
    if (m.endRow < startRow || m.startRow > endRow || m.endColumn < startCol || m.startColumn > endCol) continue;
    const sr = Math.max(m.startRow, startRow);
    const er = Math.min(m.endRow, endRow);
    const sc = Math.max(m.startColumn, startCol);
    const ec = Math.min(m.endColumn, endCol);
    mergeMaster.set(`${sr}:${sc}`, { rowSpan: er - sr + 1, colSpan: ec - sc + 1 });
    for (let r = sr; r <= er; r++) {
      for (let c = sc; c <= ec; c++) {
        if (r !== sr || c !== sc) mergeCovered.add(`${r}:${c}`);
      }
    }
  }

  const colGroup: string[] = [];
  for (let c = startCol; c <= endCol; c++) {
    if (sheet.columnData?.[c]?.hd) continue;
    const w = finiteNumber(sheet.columnData?.[c]?.w ?? sheet.defaultColumnWidth, 100);
    colGroup.push(`<col style="width:${Math.max(40, w)}px" />`);
  }

  const rowsHtml: string[] = [];
  for (let r = startRow; r <= endRow; r++) {
    if (sheet.rowData?.[r]?.hd) continue;
    const h = finiteNumber(sheet.rowData?.[r]?.h ?? sheet.defaultRowHeight, 26);
    const cellsHtml: string[] = [];
    for (let c = startCol; c <= endCol; c++) {
      if (sheet.columnData?.[c]?.hd) continue;
      const key = `${r}:${c}`;
      if (mergeCovered.has(key)) continue;
      const span = mergeMaster.get(key);
      const cell = sheet.cellData?.[r]?.[c];
      const style = resolveStyle(workbook, cell?.s);
      const css: string[] = [];
      css.push(`padding:6px 10px`);
      const family = safeFontFamily(style?.ff);
      css.push(`font-family:${family ? `'${family}',sans-serif` : `Arial,sans-serif`}`);
      css.push(`font-size:${Math.max(1, Math.min(409, finiteNumber(style?.fs, 11)))}pt`);
      if (style?.bl) css.push('font-weight:700');
      if (style?.it) css.push('font-style:italic');
      const decorations: string[] = [];
      if (style?.ul?.s) decorations.push('underline');
      if (style?.st?.s) decorations.push('line-through');
      if (decorations.length) css.push(`text-decoration:${decorations.join(' ')}`);
      const textColor = safeCssColor(style?.cl?.rgb);
      const fillColor = safeCssColor(style?.bg?.rgb);
      if (textColor) css.push(`color:${textColor}`);
      if (fillColor) css.push(`background:${fillColor}`);
      const isNum = typeof cell?.v === 'number';
      const hAlign = style?.ht === 2 ? 'center' : style?.ht === 3 ? 'right' : style?.ht === 1 ? 'left' : isNum ? 'right' : 'left';
      const vAlign = style?.vt === 1 ? 'top' : style?.vt === 3 ? 'bottom' : 'middle';
      css.push(`text-align:${hAlign}`);
      css.push(`vertical-align:${vAlign}`);
      css.push(style?.tb === 3 ? 'white-space:pre-wrap;word-break:break-word' : 'white-space:nowrap');
      const borderDefault = showGrid ? '1px solid #cbd5e1' : 'none';
      const sideBorder = (side?: { s: number; cl?: { rgb?: string } } | null) => {
        if (!side || !side.s) return borderDefault;
        const width = side.s === 13 ? '2.5px' : side.s === 8 ? '1.75px' : side.s === 7 ? '3px' : '1px';
        const line = side.s === 7 ? 'double' : side.s === 3 ? 'dotted' : side.s === 4 ? 'dashed' : 'solid';
        return `${width} ${line} ${safeCssColor(side.cl?.rgb) ?? '#0f172a'}`;
      };
      css.push(`border-top:${sideBorder(style?.bd?.t)}`);
      css.push(`border-bottom:${sideBorder(style?.bd?.b)}`);
      css.push(`border-left:${sideBorder(style?.bd?.l)}`);
      css.push(`border-right:${sideBorder(style?.bd?.r)}`);
      const attrs: string[] = [];
      if (span && span.rowSpan > 1) attrs.push(`rowspan="${span.rowSpan}"`);
      if (span && span.colSpan > 1) attrs.push(`colspan="${span.colSpan}"`);
      attrs.push(`style="${escape(css.join(';'))}"`);
      const text = escape(formatCellDisplay(workbook, cell));
      cellsHtml.push(`<td ${attrs.join(' ')}>${text || '&nbsp;'}</td>`);
    }
    rowsHtml.push(`<tr style="height:${Math.max(22, h)}px">${cellsHtml.join('')}</tr>`);
  }

  const stampHtml = options.signedBy
    ? `<div style="margin-top:24px;display:flex;justify-content:flex-end">
        <div style="border:2px solid #dc2626;border-radius:8px;padding:12px 20px;color:#b91c1c;background:#fff5f5;text-align:center;min-width:240px">
          <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase">XÁC THỰC CHỮ KÝ SỐ MINH SPARK</div>
          <div style="font-size:14px;font-weight:800;margin:6px 0">${escape(options.signedBy)}</div>
          ${options.signedRole ? `<div style="font-size:11px;font-weight:600">${escape(options.signedRole)}</div>` : ''}
          <div style="font-size:10px;color:#7f1d1d;margin-top:4px">Ký ngày: ${new Date(options.signedAt ?? Date.now()).toLocaleString('vi-VN')}</div>
        </div>
      </div>`
    : '';

  const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #107c41">
    <div>
      <div style="font-size:16px;font-weight:700;color:#0f172a">${escape(options.title || workbook.name || sheet.name)}</div>
      <div style="font-size:11px;color:#64748b">Trang tính: ${escape(sheet.name)} · Xuất từ Minh Spark Sheets</div>
    </div>
    <div style="font-size:11px;color:#64748b">${new Date().toLocaleDateString('vi-VN')}</div>
  </div>`;

  const tableBlock = `${headerHtml}<table style="border-collapse:collapse;width:${options.fitToPage ? '100%' : 'auto'};color:#0f172a"><colgroup>${colGroup.join('')}</colgroup><tbody>${rowsHtml.join('')}</tbody></table>${stampHtml}`;
  if (!options.standalone) return tableBlock;

  const pageSize = `${options.paperSize ?? 'A4'} ${options.orientation ?? 'landscape'}`;
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>${escape(options.title || sheet.name)}</title><style>@page{size:${pageSize};margin:12mm}body{font-family:Arial,sans-serif;margin:20px;color:#0f172a;background:#fff}@media print{body{margin:0}}</style></head><body>${tableBlock}</body></html>`;
}

export async function renderSheetToPngBlob(
  workbook: WorkbookData,
  sheet: SheetData,
  options: { scale?: number; showGridlines?: boolean; title?: string; signedBy?: string } = {}
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const { maxRow: rawMaxRow, maxCol: rawMaxCol } = getSheetBounds(sheet, 120, 30);
  const endRow = Math.max(rawMaxRow, 4);
  const endCol = Math.max(rawMaxCol, 4);
  const colWidths: number[] = [];
  for (let c = 0; c <= endCol; c++) {
    colWidths.push(sheet.columnData?.[c]?.hd ? 0 : Math.max(56, sheet.columnData?.[c]?.w ?? sheet.defaultColumnWidth ?? 110));
  }
  const rowHeights: number[] = [];
  for (let r = 0; r <= endRow; r++) {
    rowHeights.push(sheet.rowData?.[r]?.hd ? 0 : Math.max(24, sheet.rowData?.[r]?.h ?? sheet.defaultRowHeight ?? 28));
  }
  const pad = 24;
  const headerBarHeight = 48;
  const stampHeight = options.signedBy ? 88 : 0;
  const gridWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const gridHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const totalWidth = Math.max(480, gridWidth + pad * 2);
  const totalHeight = headerBarHeight + gridHeight + stampHeight + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(totalWidth * scale);
  canvas.height = Math.round(totalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.fillStyle = '#107c41';
  ctx.fillRect(pad, pad, totalWidth - pad * 2, 3);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(options.title || workbook.name || sheet.name, pad, pad + 10);
  ctx.fillStyle = '#64748b';
  ctx.font = '400 11px Arial, sans-serif';
  ctx.fillText(`Sheet: ${sheet.name} · Minh Spark Office`, pad, pad + 30);

  const colOffsets: number[] = [pad];
  for (let c = 0; c <= endCol; c++) colOffsets.push(colOffsets[c] + colWidths[c]);
  const rowOffsets: number[] = [pad + headerBarHeight];
  for (let r = 0; r <= endRow; r++) rowOffsets.push(rowOffsets[r] + rowHeights[r]);

  const mergeMaster = new Map<string, { er: number; ec: number }>();
  const mergeCovered = new Set<string>();
  for (const m of sheet.mergeData ?? []) {
    if (m.startRow > endRow || m.startColumn > endCol) continue;
    const er = Math.min(m.endRow, endRow);
    const ec = Math.min(m.endColumn, endCol);
    mergeMaster.set(`${m.startRow}:${m.startColumn}`, { er, ec });
    for (let r = m.startRow; r <= er; r++) {
      for (let c = m.startColumn; c <= ec; c++) {
        if (r !== m.startRow || c !== m.startColumn) mergeCovered.add(`${r}:${c}`);
      }
    }
  }

  const showGrid = options.showGridlines ?? sheet.showGridlines !== 0;

  for (let r = 0; r <= endRow; r++) {
    if (rowHeights[r] === 0) continue;
    for (let c = 0; c <= endCol; c++) {
      if (colWidths[c] === 0) continue;
      const key = `${r}:${c}`;
      if (mergeCovered.has(key)) continue;
      const span = mergeMaster.get(key);
      const x = colOffsets[c];
      const y = rowOffsets[r];
      const w = colOffsets[(span ? span.ec : c) + 1] - x;
      const h = rowOffsets[(span ? span.er : r) + 1] - y;
      if (w <= 0 || h <= 0) continue;
      const cell = sheet.cellData?.[r]?.[c];
      const style = resolveStyle(workbook, cell?.s);

      if (style?.bg?.rgb) {
        ctx.fillStyle = style.bg.rgb;
        ctx.fillRect(x, y, w, h);
      }
      if (showGrid) {
        ctx.strokeStyle = '#dbe2ea';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
      if (style?.bd) {
        const drawSide = (side: { s: number; cl?: { rgb?: string } } | null | undefined, x1: number, y1: number, x2: number, y2: number) => {
          if (!side || !side.s) return;
          ctx.strokeStyle = side.cl?.rgb ?? '#0f172a';
          ctx.lineWidth = side.s === 13 ? 2.5 : side.s === 8 ? 1.75 : 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        };
        drawSide(style.bd.t, x, y, x + w, y);
        drawSide(style.bd.b, x, y + h, x + w, y + h);
        drawSide(style.bd.l, x, y, x, y + h);
        drawSide(style.bd.r, x + w, y, x + w, y + h);
      }

      const text = formatCellDisplay(workbook, cell);
      if (text) {
        const fontSize = Math.round((style?.fs ?? 11) * 1.2);
        const weight = style?.bl ? '700' : '400';
        const italic = style?.it ? 'italic ' : '';
        const family = style?.ff || DEFAULT_SHEET_FONT_FAMILY;
        ctx.font = `${italic}${weight} ${fontSize}px "${family}", Arial, sans-serif`;
        ctx.fillStyle = style?.cl?.rgb || '#0f172a';
        const isNum = typeof cell?.v === 'number';
        const align = style?.ht === 2 ? 'center' : style?.ht === 3 ? 'right' : style?.ht === 1 ? 'left' : isNum ? 'right' : 'left';
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 4, y + 2, Math.max(0, w - 8), Math.max(0, h - 4));
        ctx.clip();
        ctx.textBaseline = 'middle';
        if (align === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(text, x + w / 2, y + h / 2);
        } else if (align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(text, x + w - 8, y + h / 2);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(text, x + 8, y + h / 2);
        }
        ctx.restore();
      }
    }
  }

  if (options.signedBy) {
    const sx = totalWidth - pad - 240;
    const sy = rowOffsets[endRow + 1] + 14;
    ctx.strokeStyle = '#dc2626';
    ctx.fillStyle = '#fff5f5';
    ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, 240, 64);
    ctx.strokeRect(sx, sy, 240, 64);
    ctx.fillStyle = '#b91c1c';
    ctx.textAlign = 'center';
    ctx.font = '700 10px Arial, sans-serif';
    ctx.fillText('ĐÃ KÝ SỐ XÁC THỰC · MINH SPARK', sx + 120, sy + 16);
    ctx.font = '700 13px Arial, sans-serif';
    ctx.fillText(options.signedBy, sx + 120, sy + 36);
    ctx.font = '400 10px Arial, sans-serif';
    ctx.fillText(new Date().toLocaleDateString('vi-VN'), sx + 120, sy + 52);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

export function sheetToHtmlTable(sheet: SheetData, workbook?: WorkbookData) {
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const { maxRow, maxCol } = getSheetBounds(sheet, 300, 30);
  const body: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) cells.push(`<td>${escape(formatCellDisplay(workbook, sheet.cellData[r]?.[c]))}</td>`);
    body.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<table>${body.join('')}</table>`;
}
