export type DelimitedTable = { rows: string[][]; delimiter: string; encoding: string; columns: number };

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;
const SAMPLE_LINES = 50;

export const DELIMITER_NAME: Record<string, string> = { ',': 'dấu phẩy', ';': 'dấu chấm phẩy', '\t': 'tab', '|': 'dấu gạch đứng' };

export function decodeDelimitedBytes(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1258').decode(bytes), encoding: 'Windows-1258' };
  }
}

export function parseDelimited(text: string, delimiter: string, maxRows = Number.POSITIVE_INFINITY): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;
  const pushRow = () => { row.push(field); rows.push(row); row = []; field = ''; };
  while (index < text.length && rows.length < maxRows) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 2; continue; }
      if (char === '"') { quoted = false; index += 1; continue; }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"' && field === '') { quoted = true; index += 1; continue; }
    if (char === delimiter) { row.push(field); field = ''; index += 1; continue; }
    if (char === '\r' || char === '\n') {
      pushRow();
      index += char === '\r' && text[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (rows.length < maxRows && (field !== '' || row.length)) pushRow();
  return rows;
}

function delimiterScore(text: string, delimiter: string) {
  const counts = parseDelimited(text, delimiter, SAMPLE_LINES).filter((row) => row.some((cell) => cell.trim())).map((row) => row.length);
  if (!counts.length) return 0;
  const frequency = new Map<number, number>();
  for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1);
  const [mode, hits] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return mode > 1 ? (hits / counts.length) * 1000 + mode : 0;
}

export function detectDelimiter(text: string, extension: string) {
  if (extension === 'tsv') return '\t';
  const scored = CANDIDATE_DELIMITERS.map((delimiter) => ({ delimiter, score: delimiterScore(text, delimiter) }));
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best.score > 0 ? best.delimiter : extension === 'csv' ? ',' : '\t';
}

export function readDelimitedTable(buffer: ArrayBuffer, extension: string): DelimitedTable {
  const decoded = decodeDelimitedBytes(buffer);
  let text = decoded.text.normalize('NFC');
  let delimiter = '';
  const directive = /^sep=(.)\r?\n/i.exec(text);
  if (directive) { delimiter = directive[1]; text = text.slice(directive[0].length); }
  delimiter ||= detectDelimiter(text, extension);
  const rows = parseDelimited(text, delimiter);
  while (rows.length && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return { rows, delimiter, encoding: decoded.encoding, columns };
}

export type DelimitedCell =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number; format?: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; value: Date; format: string };

const MAX_SAFE_DIGITS = 15;
const PLAIN_NUMBER = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;
const COMMA_THOUSANDS = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.(\d+))?$/;
const DOT_THOUSANDS = /^[-+]?\d{1,3}(?:\.\d{3})+(?:,(\d+))?$/;
const COMMA_DECIMAL = /^[-+]?\d+,(\d+)$/;
const PERCENT = /^([-+]?\d+(?:[.,](\d+))?)\s?%$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const SLASH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

const significantDigits = (text: string) => text.replace(/[eE].*$/, '').replace(/\D/g, '').replace(/^0+/, '').length;
const decimalsFormat = (base: string, decimals?: string) => (decimals ? `${base}.${'0'.repeat(Math.min(decimals.length, 10))}` : base);

function validDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function inferDate(text: string): DelimitedCell | null {
  const iso = ISO_DATE.exec(text);
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso;
    const date = validDate(+y, +m, +d, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0));
    return date ? { kind: 'date', value: date, format: hh ? `yyyy-mm-dd hh:mm${ss ? ':ss' : ''}` : 'yyyy-mm-dd' } : null;
  }
  const slash = SLASH_DATE.exec(text);
  if (!slash) return null;
  const [, a, b, y, hh, mm, ss] = slash;
  const separator = text[a.length];
  const monthFirst = +a <= 12 && +b > 12;
  const date = monthFirst ? validDate(+y, +a, +b, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0)) : validDate(+y, +b, +a, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0));
  if (!date) return null;
  const day = a.length === 2 || b.length === 2 ? 'dd' : 'd';
  const month = day === 'dd' ? 'mm' : 'm';
  const pattern = monthFirst ? `${month}${separator}${day}${separator}yyyy` : `${day}${separator}${month}${separator}yyyy`;
  return { kind: 'date', value: date, format: hh ? `${pattern} hh:mm${ss ? ':ss' : ''}` : pattern };
}

export function inferDelimitedCell(raw: string, delimiter: string): DelimitedCell {
  const text = raw.trim();
  if (!text) return { kind: 'text', value: raw };
  const upper = text.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return { kind: 'boolean', value: upper === 'TRUE' };
  if (text.startsWith('+') || /^-?0\d+$/.test(text) || significantDigits(text) > MAX_SAFE_DIGITS) return { kind: 'text', value: raw };
  if (PLAIN_NUMBER.test(text)) return { kind: 'number', value: Number(text) };
  const percent = PERCENT.exec(text);
  if (percent) return { kind: 'number', value: Number(percent[1].replace(',', '.')) / 100, format: decimalsFormat('0', percent[2]) + '%' };
  const comma = delimiter === ';' ? null : COMMA_THOUSANDS.exec(text);
  if (comma) return { kind: 'number', value: Number(text.replace(/,/g, '')), format: decimalsFormat('#,##0', comma[1]) };
  if (delimiter === ';') {
    const dots = DOT_THOUSANDS.exec(text);
    if (dots) return { kind: 'number', value: Number(text.replace(/\./g, '').replace(',', '.')), format: decimalsFormat('#,##0', dots[1]) };
    const decimal = COMMA_DECIMAL.exec(text);
    if (decimal) return { kind: 'number', value: Number(text.replace(',', '.')), format: decimalsFormat('0', decimal[1]) };
  }
  return inferDate(text) ?? { kind: 'text', value: raw };
}
