import type { CellStyle, CellValue, WorkbookData } from './sheetTypes';

export const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
export const MAX_IMPORT_ROWS = 20000;
export const MAX_IMPORT_COLS = 500;
const MAX_SAFE_DIGITS = 15;

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

export const DEFAULT_SHEET_FONT_FAMILY = 'Arial';

export const importedFontFamily = (name: string): string =>
  /^segoe ui(?:\s|$)/i.test(name.trim()) ? DEFAULT_SHEET_FONT_FAMILY : name;

export const toNfc = (text: string): string => text.normalize('NFC');

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

export const resolveCellStyle = (workbook: WorkbookData, style: CellValue['s']): CellStyle | undefined => {
  if (!style) return undefined;
  if (typeof style === 'string') return workbook.styles[style] ?? undefined;
  return style;
};
