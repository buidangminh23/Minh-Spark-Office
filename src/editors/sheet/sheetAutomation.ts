export const AUTOCOMPLETE_MIN_CHARS = 2;
export const AUTOCOMPLETE_SCAN_ROWS = 5000;
export const THOUSANDS_MIN_ABS = 1000;

const GENERAL_FORMATS = new Set(['', 'general', 'General', 'G/通用格式']);
const EN_US_MONEY = /^\s*\$\s?(\d{1,3}(?:,\d{3})+)(\.\d+)?\s*$/;

const normalizeForMatch = (text: string): string => text.trim().toLocaleLowerCase('vi').normalize('NFC');

const isNumericLike = (text: string): boolean => /^[-+]?[\d.,\s%$₫]+$/.test(text.trim());

export const findAutoComplete = (typed: string, columnValues: readonly unknown[]): string | null => {
  const prefix = normalizeForMatch(typed);
  if (prefix.length < AUTOCOMPLETE_MIN_CHARS || prefix.startsWith('=') || isNumericLike(typed)) return null;
  const candidates = new Map<string, string>();
  for (const value of columnValues) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const key = normalizeForMatch(value);
    if (key === prefix) return null;
    if (key.startsWith(prefix) && !candidates.has(key)) candidates.set(key, value.trim());
  }
  return candidates.size === 1 ? [...candidates.values()][0] : null;
};

export const parseEnUsMoney = (raw: string): number | null => {
  const match = EN_US_MONEY.exec(raw);
  if (!match) return null;
  return Number(`${match[1].replace(/,/g, '')}${match[2] ?? ''}`);
};

export const thousandsFormatFor = (value: unknown, currentFormat: string | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) < THOUSANDS_MIN_ABS) return null;
  if (!GENERAL_FORMATS.has(currentFormat ?? '')) return null;
  return Number.isInteger(value) ? '#,##0' : '#,##0.00';
};

const isBlank = (value: unknown): boolean => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

export const looksLikeHeaderRow = (headerValues: readonly unknown[]): boolean => {
  const filled = headerValues.filter((value) => !isBlank(value));
  if (filled.length < 2) return false;
  return filled.every((value) => typeof value === 'string' && !isNumericLike(value));
};

export const isRowEmptyExcept = (values: readonly unknown[], exceptIndex: number): boolean =>
  values.every((value, index) => index === exceptIndex || isBlank(value));
