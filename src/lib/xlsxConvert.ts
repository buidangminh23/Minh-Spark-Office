import type { CellValue, ImportTruncation, SheetData, WorkbookData } from './sheetTypes';
import { columnLetter, emptySheet, emptyWorkbook, uid } from './workbookBasics';
import { DEFAULT_SHEET_FONT_FAMILY, EXCEL_EPOCH, MAX_IMPORT_COLS, MAX_IMPORT_ROWS, resolveCellStyle, safeCssColor } from './xlsxShared';
import { readSpreadsheetOffThread, writeWorkbookXlsxOffThread } from './xlsxCodecClient';

export { columnLetter, emptySheet, emptyWorkbook, uid };
export { DEFAULT_SHEET_FONT_FAMILY, importedFontFamily, inferDelimitedValue, normalizeHexColor, resolveCellStyle, safeCssColor, toNfc } from './xlsxShared';

const MAX_EXPORT_CELLS = 5_000_000;

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

export const importSpreadsheet = (buffer: ArrayBuffer, fileName: string): Promise<WorkbookData> =>
  readSpreadsheetOffThread(buffer, fileName);

const resolveStyle = resolveCellStyle;

export async function exportWorkbookToXlsx(data: WorkbookData): Promise<Blob> {
  const buffer = await writeWorkbookXlsxOffThread(data);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportWorkbookToXlsm(data: WorkbookData): Promise<Blob> {
  const buffer = await writeWorkbookXlsxOffThread(data, true);
  return new Blob([buffer], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
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

const decodeCellAddress = (address: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) throw new Error('Invalid cell address');
  let column = 0;
  for (const char of match[1]) column = column * 26 + (char.charCodeAt(0) - 64);
  return { r: Number(match[2]) - 1, c: column - 1 };
};

const parsePrintArea = (area?: string) => {
  if (!area) return null;
  const cleaned = area.includes('!') ? area.split('!').pop() ?? area : area;
  const normalized = cleaned.replaceAll('$', '').trim().toUpperCase();
  if (!/^[A-Z]+\d+(?::[A-Z]+\d+)?$/.test(normalized)) return null;
  try {
    const [first, second = first] = normalized.split(':');
    const start = decodeCellAddress(first);
    const end = decodeCellAddress(second);
    return { startRow: start.r, endRow: end.r, startCol: start.c, endCol: end.c };
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
  pageBreakRows?: number[];
  showHeadings?: boolean;
};

const HEADING_CELL_CSS = 'padding:2px 6px;background:#f1f5f9;color:#475569;font:600 9pt Arial,sans-serif;text-align:center;border:1px solid #cbd5e1';

const columnLetters = (index: number) => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
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
  if (options.showHeadings) colGroup.push('<col style="width:40px" />');
  for (let c = startCol; c <= endCol; c++) {
    if (sheet.columnData?.[c]?.hd) continue;
    const w = finiteNumber(sheet.columnData?.[c]?.w ?? sheet.defaultColumnWidth, 100);
    colGroup.push(`<col style="width:${Math.max(40, w)}px" />`);
  }

  const rowsHtml: string[] = [];
  if (options.showHeadings) {
    const letters: string[] = [`<td style="${HEADING_CELL_CSS}"></td>`];
    for (let c = startCol; c <= endCol; c++) if (!sheet.columnData?.[c]?.hd) letters.push(`<td style="${HEADING_CELL_CSS}">${columnLetters(c)}</td>`);
    rowsHtml.push(`<tr style="height:20px">${letters.join('')}</tr>`);
  }
  const pageBreakRows = new Set(options.pageBreakRows ?? []);
  let pendingPageBreak = false;
  for (let r = startRow; r <= endRow; r++) {
    if (pageBreakRows.has(r)) pendingPageBreak = true;
    if (sheet.rowData?.[r]?.hd) continue;
    const h = finiteNumber(sheet.rowData?.[r]?.h ?? sheet.defaultRowHeight, 26);
    const cellsHtml: string[] = options.showHeadings ? [`<td style="${HEADING_CELL_CSS}">${r + 1}</td>`] : [];
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
    const startsPage = pendingPageBreak && rowsHtml.length > (options.showHeadings ? 1 : 0);
    pendingPageBreak = false;
    const breakStyle = startsPage && options.standalone !== false ? ';break-before:page' : '';
    const breakAttr = startsPage ? ' data-page-break="1"' : '';
    rowsHtml.push(`<tr${breakAttr} style="height:${Math.max(22, h)}px${breakStyle}">${cellsHtml.join('')}</tr>`);
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
