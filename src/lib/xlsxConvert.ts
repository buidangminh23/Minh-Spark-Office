import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { CellStyle, CellValue, SheetData, WorkbookData } from './sheetTypes';

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

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export const columnLetter = (index: number) => {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
};

const applyTint = (hex: string, tint = 0) => {
  if (!tint) return hex;
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const tinted = channels.map((channel) => Math.round(tint < 0 ? channel * (1 + tint) : channel + (255 - channel) * tint));
  return tinted.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('').toUpperCase();
};

const readColor = (color?: Partial<ExcelJS.Color> & { indexed?: number; tint?: number }) => {
  if (!color) return undefined;
  if (color.argb) return `#${color.argb.length === 8 ? color.argb.slice(2) : color.argb}`;
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

function styleFromExcel(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};
  const font = cell.font;
  if (font) {
    if (font.name) style.ff = font.name;
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
  if (typeof raw === 'string') return { v: raw, t: 1 };
  if (typeof raw === 'boolean') return { v: raw ? 1 : 0, t: 3 };
  if (raw instanceof Date) return { v: dateToSerial(raw), t: 2 };
  if (typeof raw === 'object') {
    if ('formula' in raw || 'sharedFormula' in raw) {
      const formula = cell.formula;
      const result = (raw as ExcelJS.CellFormulaValue).result;
      const value: CellValue = formula ? { f: `=${formula}` } : {};
      if (result instanceof Date) value.v = dateToSerial(result);
      else if (typeof result === 'number') { value.v = result; value.t = 2; }
      else if (typeof result === 'string') { value.v = result; value.t = 1; }
      else if (typeof result === 'boolean') { value.v = result ? 1 : 0; value.t = 3; }
      else if (result && typeof result === 'object' && 'error' in result) value.v = String(result.error);
      return value;
    }
    if ('richText' in raw) return { v: raw.richText.map((part) => part.text).join(''), t: 1 };
    if ('hyperlink' in raw) return { v: String((raw as ExcelJS.CellHyperlinkValue).text ?? raw.hyperlink), t: 1 };
    if ('error' in raw) return { v: String(raw.error), t: 1 };
  }
  return { v: String(raw), t: 1 };
}

export function emptySheet(name: string, rows = 1000, columns = 26): SheetData {
  return {
    id: uid('sheet'),
    name,
    rowCount: rows,
    columnCount: columns,
    defaultColumnWidth: 96,
    defaultRowHeight: 24,
    cellData: {},
    rowData: {},
    columnData: {},
    mergeData: [],
    showGridlines: 1,
  };
}

export function emptyWorkbook(name: string): WorkbookData {
  const sheet = emptySheet('Trang tính 1');
  return {
    id: uid('wb'),
    name,
    appVersion: '0.1.0',
    locale: 'viVN',
    styles: {},
    sheetOrder: [sheet.id],
    sheets: { [sheet.id]: sheet },
  };
}

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
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
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
    data.sheetOrder.push(sheet.id);
    data.sheets[sheet.id] = sheet;
  });
  if (!data.sheetOrder.length) return emptyWorkbook(name);
  return data;
}

function sheetJsToWorkbook(buffer: ArrayBuffer, name: string, csv = false): WorkbookData {
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true, cellDates: false, cellStyles: true, raw: false, codepage: 65001, ...(csv ? { raw: true } : {}) });
  const data: WorkbookData = { id: uid('wb'), name, appVersion: '0.1.0', locale: 'viVN', styles: {}, sheetOrder: [], sheets: {} };
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    const rowLimit = Math.min(range.e.r + 1, MAX_IMPORT_ROWS);
    const colLimit = Math.min(range.e.c + 1, MAX_IMPORT_COLS);
    const sheet = emptySheet(sheetName, Math.max(rowLimit + 50, 1000), Math.max(colLimit + 5, 26));
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
        else if (cell.v !== undefined) { entry.v = String(cell.v); entry.t = 1; }
        if (cell.z && cell.z !== 'General') {
          const id = `n${Object.keys(data.styles).length + 1}`;
          data.styles[id] = { n: { pattern: String(cell.z) } };
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

const resolveStyle = (workbook: WorkbookData, style: CellValue['s']): CellStyle | undefined => {
  if (!style) return undefined;
  if (typeof style === 'string') return workbook.styles[style] ?? undefined;
  return style;
};

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

const displayValue = (cell?: CellValue) => {
  if (!cell) return '';
  if (cell.p?.body?.dataStream) return cell.p.body.dataStream.replace(/\r\n$/, '');
  if (cell.v === undefined || cell.v === null) return '';
  return String(cell.v);
};

export function exportSheetToCsv(sheet: SheetData): Blob {
  const rows = Object.keys(sheet.cellData ?? {}).map(Number);
  const maxRow = rows.length ? Math.max(...rows) : -1;
  let maxCol = -1;
  for (const columns of Object.values(sheet.cellData ?? {})) {
    for (const key of Object.keys(columns ?? {})) maxCol = Math.max(maxCol, Number(key));
  }
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const values: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const text = displayValue(sheet.cellData[r]?.[c]);
      values.push(/[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
    }
    lines.push(values.join(','));
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

export function sheetToHtmlTable(sheet: SheetData) {
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rows = Object.keys(sheet.cellData ?? {}).map(Number);
  const maxRow = rows.length ? Math.min(Math.max(...rows), 300) : -1;
  let maxCol = -1;
  for (const columns of Object.values(sheet.cellData ?? {})) for (const key of Object.keys(columns ?? {})) maxCol = Math.max(maxCol, Number(key));
  maxCol = Math.min(maxCol, 30);
  const body: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) cells.push(`<td>${escape(displayValue(sheet.cellData[r]?.[c]))}</td>`);
    body.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<table>${body.join('')}</table>`;
}
