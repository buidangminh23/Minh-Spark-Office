import { coerceNumeric, colIndexToLetter, formatA1Cell } from './sheetUtils';

export type GridValue = string | number | boolean | null;

export interface NumberFormatCategory {
  id: string;
  label: string;
  patterns: { label: string; pattern: string }[];
}

export const NUMBER_FORMAT_CATEGORIES: NumberFormatCategory[] = [
  { id: 'general', label: 'Chung (General)', patterns: [{ label: 'Chung', pattern: 'General' }] },
  {
    id: 'number',
    label: 'Số (Number)',
    patterns: [
      { label: '1234', pattern: '0' },
      { label: '1234,10', pattern: '0.00' },
      { label: '1.234', pattern: '#,##0' },
      { label: '1.234,10', pattern: '#,##0.00' },
      { label: '(1.234) cho số âm', pattern: '#,##0;(#,##0)' },
    ],
  },
  {
    id: 'currency',
    label: 'Tiền tệ (Currency)',
    patterns: [
      { label: '1.234 ₫', pattern: '#,##0 "₫"' },
      { label: '1.234 VNĐ', pattern: '#,##0 "VNĐ"' },
      { label: '$1,234.10', pattern: '"$"#,##0.00' },
      { label: '€1.234,10', pattern: '"€"#,##0.00' },
    ],
  },
  {
    id: 'accounting',
    label: 'Kế toán (Accounting)',
    patterns: [
      { label: '1.234 ₫ (căn kế toán)', pattern: '_-* #,##0 "₫"_-;-* #,##0 "₫"_-;_-* "-" "₫"_-' },
      { label: '1.234 (gạch cho số 0)', pattern: '_-* #,##0_-;-* #,##0_-;_-* "-"_-' },
    ],
  },
  {
    id: 'date',
    label: 'Ngày (Date)',
    patterns: [
      { label: '07/11/2026', pattern: 'dd/mm/yyyy' },
      { label: '07-11-2026', pattern: 'dd-mm-yyyy' },
      { label: '2026-11-07', pattern: 'yyyy-mm-dd' },
      { label: '07/11', pattern: 'dd/mm' },
      { label: 'Tháng 11/2026', pattern: '"Tháng "mm/yyyy' },
    ],
  },
  {
    id: 'time',
    label: 'Giờ (Time)',
    patterns: [
      { label: '13:30', pattern: 'hh:mm' },
      { label: '13:30:55', pattern: 'hh:mm:ss' },
      { label: '07/11/2026 13:30', pattern: 'dd/mm/yyyy hh:mm' },
    ],
  },
  {
    id: 'percent',
    label: 'Phần trăm (%)',
    patterns: [
      { label: '12%', pattern: '0%' },
      { label: '12,3%', pattern: '0.0%' },
      { label: '12,34%', pattern: '0.00%' },
    ],
  },
  {
    id: 'fraction',
    label: 'Phân số (Fraction)',
    patterns: [
      { label: '1/4', pattern: '# ?/?' },
      { label: '21/25', pattern: '# ??/??' },
    ],
  },
  {
    id: 'scientific',
    label: 'Khoa học (Scientific)',
    patterns: [
      { label: '1,23E+03', pattern: '0.00E+00' },
      { label: '1,2E+03', pattern: '0.0E+00' },
    ],
  },
  { id: 'text', label: 'Văn bản (Text)', patterns: [{ label: 'Giữ nguyên chuỗi', pattern: '@' }] },
  {
    id: 'special',
    label: 'Đặc biệt (Special)',
    patterns: [
      { label: 'Mã số thuế 10 số', pattern: '0000000000' },
      { label: 'Số điện thoại 0xxx xxx xxx', pattern: '0000 000 000' },
      { label: 'STT 001', pattern: '000' },
    ],
  },
];

const groupThousands = (intPart: string, sep: string): string => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

const countDecimals = (section: string): number => {
  const m = section.match(/\.([0#]+)/);
  return m ? m[1].length : 0;
};

const quotedLiterals = (section: string): { prefix: string; suffix: string } => {
  const firstNum = section.search(/[0#?]/);
  const lastNum = Math.max(section.lastIndexOf('0'), section.lastIndexOf('#'), section.lastIndexOf('?'));
  const clean = (part: string) => part.replace(/"([^"]*)"/g, '$1').replace(/[%,.]/g, '');
  if (firstNum < 0) return { prefix: clean(section), suffix: '' };
  return { prefix: clean(section.slice(0, firstNum)), suffix: clean(section.slice(lastNum + 1)) };
};

const excelSerialToDate = (serial: number): Date => new Date(Math.round((serial - 25569) * 86400 * 1000));

const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatNumberPreview = (value: unknown, pattern: string): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = coerceNumeric(value);
  if (!pattern || pattern === 'General') return num === null ? String(value) : String(num).replace('.', ',');
  if (pattern === '@' || num === null) return String(value);

  if (/[dy]/i.test(pattern) || /hh|ss/i.test(pattern)) {
    const d = excelSerialToDate(num);
    if (Number.isNaN(d.getTime())) return String(value);
    let out = pattern.replace(/"([^"]*)"/g, '$1');
    out = out
      .replace(/yyyy/gi, String(d.getUTCFullYear()))
      .replace(/dd/gi, pad2(d.getUTCDate()))
      .replace(/hh/gi, pad2(d.getUTCHours()))
      .replace(/ss/gi, pad2(d.getUTCSeconds()));
    out = out.replace(/mm/gi, (_match: string, offset: number, whole: string) => {
      const before = whole.slice(0, offset);
      return /hh?[:\s]*$|\d{2}:$/.test(before) ? pad2(d.getUTCMinutes()) : pad2(d.getUTCMonth() + 1);
    });
    return out;
  }

  const sections = pattern.split(';');
  let section = sections[0];
  let value2 = num;
  if (num < 0 && sections[1]) {
    section = sections[1];
    value2 = Math.abs(num);
  } else if (num === 0 && sections[2]) {
    section = sections[2];
  }
  section = section.replace(/_./g, '').replace(/\*./g, '');
  const { prefix, suffix } = quotedLiterals(section);
  const core = section.replace(/"[^"]*"/g, '');

  if (/E\+/i.test(core)) {
    const decimals = countDecimals(core);
    const [mantissa, exponent] = value2.toExponential(decimals).split('e');
    const sign = exponent.startsWith('-') ? '-' : '+';
    const expDigits = exponent.replace(/^[+-]/, '').padStart(2, '0');
    return `${prefix}${mantissa.replace('.', ',')}E${sign}${expDigits}${suffix}`;
  }
  if (/\?\/\?/.test(core)) {
    const whole = Math.trunc(value2);
    const frac = Math.abs(value2 - whole);
    const maxDen = (core.match(/\/(\?+)/)?.[1].length ?? 1) === 1 ? 9 : 99;
    let best = { n: 0, d: 1, err: frac };
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(frac * d);
      const err = Math.abs(frac - n / d);
      if (err < best.err - 1e-12) best = { n, d, err };
    }
    if (best.n === 0) return `${prefix}${whole}${suffix}`;
    return `${prefix}${whole ? `${whole} ` : ''}${best.n}/${best.d}${suffix}`;
  }

  const isPercent = core.includes('%');
  const scaled = isPercent ? value2 * 100 : value2;
  const decimals = countDecimals(core);
  const negative = scaled < 0 && sections.length < 2;
  const abs = Math.abs(scaled);
  const fixed = abs.toFixed(decimals);
  const [intRaw, decRaw] = fixed.split('.');
  const minIntDigits = (core.split('.')[0].match(/0/g) ?? []).length;
  const intPadded = intRaw.padStart(minIntDigits, '0');
  const useGroup = core.includes(',') && !/^0+[ ]?0+/.test(core.replace(/,/g, ''));
  let intText = useGroup ? groupThousands(intPadded, '.') : intPadded;
  if (/^0+( 0+)+$/.test(core.trim())) {
    const digits = intPadded;
    const groups = core.trim().split(' ').map((g) => g.length);
    const parts: string[] = [];
    let cursor = digits.length - groups.reduce((a, b) => a + b, 0);
    const head = cursor > 0 ? digits.slice(0, cursor) : '';
    cursor = Math.max(0, cursor);
    for (const len of groups) {
      parts.push(digits.slice(cursor, cursor + len));
      cursor += len;
    }
    intText = head + parts.join(' ');
  }
  const body = decimals > 0 ? `${intText},${decRaw}` : intText;
  return `${negative ? '-' : ''}${prefix}${body}${isPercent ? '%' : ''}${suffix}`;
};

export type SubtotalFn = 'SUM' | 'COUNT' | 'AVERAGE' | 'MAX' | 'MIN';

export const SUBTOTAL_FN_CODES: Record<SubtotalFn, number> = { AVERAGE: 1, COUNT: 2, MAX: 4, MIN: 5, SUM: 9 };

export const SUBTOTAL_FN_LABELS: Record<SubtotalFn, string> = {
  SUM: 'Tổng (Sum)',
  COUNT: 'Đếm (Count)',
  AVERAGE: 'Trung bình (Average)',
  MAX: 'Lớn nhất (Max)',
  MIN: 'Nhỏ nhất (Min)',
};

export interface SubtotalResult {
  grid: GridValue[][];
  subtotalRows: number[];
  grandTotalRow: number;
  groupCount: number;
}

export const buildSubtotalGrid = (
  headers: string[],
  rows: GridValue[][],
  groupCol: number,
  fn: SubtotalFn,
  valueCols: number[],
  sortByGroup = true
): SubtotalResult => {
  const code = SUBTOTAL_FN_CODES[fn];
  const label = fn === 'SUM' ? 'Tổng' : fn === 'COUNT' ? 'Số lượng' : fn === 'AVERAGE' ? 'Trung bình' : fn === 'MAX' ? 'Lớn nhất' : 'Nhỏ nhất';
  const width = headers.length;
  const ordered = sortByGroup
    ? [...rows].map((r, i) => ({ r, i })).sort((a, b) => {
        const ka = String(a.r[groupCol] ?? '');
        const kb = String(b.r[groupCol] ?? '');
        const cmp = ka.localeCompare(kb, 'vi', { numeric: true });
        return cmp !== 0 ? cmp : a.i - b.i;
      }).map((x) => x.r)
    : rows;

  const grid: GridValue[][] = [headers.map((h) => h)];
  const subtotalRows: number[] = [];
  let groupStart = 1;
  let groupCount = 0;

  const flush = (key: string) => {
    const endRow = grid.length;
    const totalRow: GridValue[] = Array.from({ length: width }, () => null);
    totalRow[groupCol] = `${label} ${key}`.trim();
    for (const c of valueCols) {
      const col = colIndexToLetter(c);
      totalRow[c] = `=SUBTOTAL(${code},${col}${groupStart + 1}:${col}${endRow})`;
    }
    subtotalRows.push(grid.length);
    grid.push(totalRow);
    groupStart = grid.length;
    groupCount += 1;
  };

  let currentKey: string | null = null;
  for (const row of ordered) {
    const key = String(row[groupCol] ?? '');
    if (currentKey !== null && key !== currentKey) flush(currentKey);
    currentKey = key;
    grid.push(Array.from({ length: width }, (_, c) => row[c] ?? null));
  }
  if (currentKey !== null) flush(currentKey);

  const grand: GridValue[] = Array.from({ length: width }, () => null);
  grand[groupCol] = `${label} chung`;
  for (const c of valueCols) {
    const col = colIndexToLetter(c);
    grand[c] = `=SUBTOTAL(${code},${col}2:${col}${grid.length})`;
  }
  const grandTotalRow = grid.length;
  grid.push(grand);
  return { grid, subtotalRows, grandTotalRow, groupCount };
};

export interface ColumnStatistics {
  header: string;
  count: number;
  sum: number;
  mean: number;
  median: number;
  mode: number | null;
  stdev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
  stdError: number;
}

const quantile = (sorted: number[], p: number): number => {
  if (!sorted.length) return Number.NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export const describeColumns = (headers: string[], rows: unknown[][]): ColumnStatistics[] => {
  const out: ColumnStatistics[] = [];
  headers.forEach((header, c) => {
    const nums = rows.map((r) => coerceNumeric(r[c])).filter((v): v is number => v !== null);
    if (nums.length === 0) return;
    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...nums].sort((a, b) => a - b);
    const variance = n > 1 ? nums.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1) : 0;
    const stdev = Math.sqrt(variance);
    const freq = new Map<number, number>();
    for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1);
    let mode: number | null = null;
    let best = 1;
    for (const [v, f] of freq) {
      if (f > best) {
        best = f;
        mode = v;
      }
    }
    const m2 = nums.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const m3 = nums.reduce((a, v) => a + (v - mean) ** 3, 0) / n;
    const m4 = nums.reduce((a, v) => a + (v - mean) ** 4, 0) / n;
    const skewness = n <= 2 ? Number.NaN : m2 > 0 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / m2 ** 1.5) : 0;
    const kurtosis =
      n <= 3 ? Number.NaN : m2 > 0 ? ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * (m4 / m2 ** 2) - 3 * (n - 1)) : 0;
    out.push({
      header: header || colIndexToLetter(c),
      count: n,
      sum,
      mean,
      median: quantile(sorted, 0.5),
      mode,
      stdev,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      q1: quantile(sorted, 0.25),
      q3: quantile(sorted, 0.75),
      skewness,
      kurtosis,
      stdError: n > 0 ? stdev / Math.sqrt(n) : 0,
    });
  });
  return out;
};

export const STAT_ROW_LABELS: { key: keyof ColumnStatistics; label: string }[] = [
  { key: 'count', label: 'Số quan sát (Count)' },
  { key: 'sum', label: 'Tổng (Sum)' },
  { key: 'mean', label: 'Trung bình (Mean)' },
  { key: 'stdError', label: 'Sai số chuẩn (Standard Error)' },
  { key: 'median', label: 'Trung vị (Median)' },
  { key: 'mode', label: 'Yếu vị (Mode)' },
  { key: 'stdev', label: 'Độ lệch chuẩn (Std Dev)' },
  { key: 'variance', label: 'Phương sai mẫu (Variance)' },
  { key: 'kurtosis', label: 'Độ nhọn (Kurtosis)' },
  { key: 'skewness', label: 'Độ lệch (Skewness)' },
  { key: 'range', label: 'Khoảng biến thiên (Range)' },
  { key: 'min', label: 'Nhỏ nhất (Min)' },
  { key: 'q1', label: 'Tứ phân vị 1 (Q1)' },
  { key: 'q3', label: 'Tứ phân vị 3 (Q3)' },
  { key: 'max', label: 'Lớn nhất (Max)' },
];

export const buildStatisticsGrid = (stats: ColumnStatistics[]): GridValue[][] => {
  const grid: GridValue[][] = [['Chỉ số thống kê', ...stats.map((s) => s.header)]];
  for (const { key, label } of STAT_ROW_LABELS) {
    grid.push([
      label,
      ...stats.map((s) => {
        const v = s[key];
        if (v === null) return 'Không có';
        if (typeof v === 'number' && Number.isNaN(v)) return 'Không đủ dữ liệu';
        return typeof v === 'number' ? Math.round(v * 10000) / 10000 : String(v);
      }),
    ]);
  }
  return grid;
};

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'blank' | 'notBlank';

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'bằng',
  neq: 'khác',
  gt: 'lớn hơn',
  gte: 'lớn hơn hoặc bằng',
  lt: 'nhỏ hơn',
  lte: 'nhỏ hơn hoặc bằng',
  contains: 'có chứa',
  notContains: 'không chứa',
  startsWith: 'bắt đầu bằng',
  endsWith: 'kết thúc bằng',
  blank: 'đang trống',
  notBlank: 'không trống',
};

export interface FilterCriterion {
  column: number;
  operator: FilterOperator;
  value: string;
}

const normalizeText = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase('vi');

export const matchesCriterion = (cell: unknown, criterion: FilterCriterion): boolean => {
  const text = normalizeText(cell);
  const target = normalizeText(criterion.value);
  const numCell = coerceNumeric(cell);
  const numTarget = coerceNumeric(criterion.value);
  const bothNumeric = numCell !== null && numTarget !== null;
  switch (criterion.operator) {
    case 'blank':
      return text === '';
    case 'notBlank':
      return text !== '';
    case 'eq':
      return bothNumeric ? numCell === numTarget : text === target;
    case 'neq':
      return bothNumeric ? numCell !== numTarget : text !== target;
    case 'gt':
      return bothNumeric ? numCell > numTarget : text.localeCompare(target, 'vi') > 0;
    case 'gte':
      return bothNumeric ? numCell >= numTarget : text.localeCompare(target, 'vi') >= 0;
    case 'lt':
      return bothNumeric ? numCell < numTarget : text.localeCompare(target, 'vi') < 0;
    case 'lte':
      return bothNumeric ? numCell <= numTarget : text.localeCompare(target, 'vi') <= 0;
    case 'contains':
      return text.includes(target);
    case 'notContains':
      return !text.includes(target);
    case 'startsWith':
      return text.startsWith(target);
    case 'endsWith':
      return text.endsWith(target);
    default:
      return true;
  }
};

export const filterRecords = (rows: unknown[][], criteria: FilterCriterion[], mode: 'and' | 'or', unique = false): unknown[][] => {
  const active = criteria.filter((c) => c.column >= 0);
  const kept = active.length
    ? rows.filter((row) =>
        mode === 'and' ? active.every((c) => matchesCriterion(row[c.column], c)) : active.some((c) => matchesCriterion(row[c.column], c))
      )
    : [...rows];
  if (!unique) return kept;
  const seen = new Set<string>();
  return kept.filter((row) => {
    const key = JSON.stringify(row.map((v) => normalizeText(v)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export type SpecialCellKind = 'blanks' | 'constants' | 'numbers' | 'text' | 'formulas' | 'errors';

export const SPECIAL_CELL_LABELS: Record<SpecialCellKind, string> = {
  blanks: 'Ô trống (Blanks)',
  constants: 'Hằng số — mọi giá trị nhập tay (Constants)',
  numbers: 'Hằng số dạng số (Numbers)',
  text: 'Hằng số dạng chữ (Text)',
  formulas: 'Ô có công thức (Formulas)',
  errors: 'Ô đang báo lỗi #… (Errors)',
};

const ERROR_RE = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|SPILL!|CALC!)/i;

export const findSpecialCells = (
  values: unknown[][],
  formulas: (string | null | undefined)[][],
  kind: SpecialCellKind
): { row: number; col: number }[] => {
  const hits: { row: number; col: number }[] = [];
  values.forEach((rowVals, r) => {
    rowVals.forEach((v, c) => {
      const f = formulas[r]?.[c];
      const isFormula = Boolean(f && String(f).startsWith('='));
      const empty = v === null || v === undefined || v === '';
      let hit = false;
      if (kind === 'blanks') hit = empty && !isFormula;
      else if (kind === 'formulas') hit = isFormula;
      else if (kind === 'errors') hit = typeof v === 'string' && ERROR_RE.test(v);
      else if (!isFormula && !empty) {
        if (kind === 'constants') hit = true;
        else if (kind === 'numbers') hit = typeof v === 'number' || (typeof v === 'string' && coerceNumeric(v) !== null && /^-?[\d.,\s]+$/.test(v.trim()));
        else if (kind === 'text') hit = typeof v === 'string' && !(coerceNumeric(v) !== null && /^-?[\d.,\s]+$/.test(v.trim()));
      }
      if (hit) hits.push({ row: r, col: c });
    });
  });
  return hits;
};

export interface CellRect {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export const cellsToRects = (cells: { row: number; col: number }[]): CellRect[] => {
  const byRow = new Map<number, number[]>();
  for (const { row, col } of cells) {
    const list = byRow.get(row) ?? [];
    list.push(col);
    byRow.set(row, list);
  }
  const runs: CellRect[] = [];
  for (const [row, cols] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    cols.sort((a, b) => a - b);
    let start = cols[0];
    let prev = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      const cur = cols[i];
      if (cur === prev + 1) {
        prev = cur;
        continue;
      }
      runs.push({ startRow: row, endRow: row, startColumn: start, endColumn: prev });
      start = cur;
      prev = cur;
    }
  }
  const merged: CellRect[] = [];
  for (const run of runs) {
    const target = merged.find(
      (m) => m.endRow === run.startRow - 1 && m.startColumn === run.startColumn && m.endColumn === run.endColumn
    );
    if (target) target.endRow = run.endRow;
    else merged.push({ ...run });
  }
  return merged;
};

export const rectToA1 = (rect: CellRect): string => {
  const a = formatA1Cell(rect.startRow, rect.startColumn);
  if (rect.startRow === rect.endRow && rect.startColumn === rect.endColumn) return a;
  return `${a}:${formatA1Cell(rect.endRow, rect.endColumn)}`;
};

export const SYMBOL_GROUPS: { id: string; label: string; symbols: string[] }[] = [
  { id: 'currency', label: 'Tiền tệ', symbols: ['₫', '$', '€', '£', '¥', '₩', '₹', '฿', '¢', '₽', '₿', '¤'] },
  { id: 'math', label: 'Toán học', symbols: ['±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∑', '∏', '∫', '∆', '∂', 'π', '‰', '°', '²', '³', '½', '¼', '¾', '⅓', '⅔'] },
  { id: 'arrows', label: 'Mũi tên', symbols: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇔', '➜', '▲', '▼', '►', '◄', '↗', '↘'] },
  { id: 'marks', label: 'Dấu kiểm & Trạng thái', symbols: ['✓', '✔', '✗', '✘', '☐', '☑', '☒', '●', '○', '◆', '◇', '■', '□', '★', '☆', '⚠', '•', '…'] },
  { id: 'legal', label: 'Văn phòng & Pháp lý', symbols: ['©', '®', '™', '§', '¶', '№', '†', '‡', '«', '»', '“', '”', '‘', '’', '–', '—'] },
  { id: 'greek', label: 'Chữ Hy Lạp', symbols: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'σ', 'φ', 'ω', 'Ω', 'Σ', 'Φ', 'Ψ', 'Λ'] },
  { id: 'units', label: 'Đơn vị đo', symbols: ['m²', 'm³', 'km²', 'cm²', 'mm²', 'kg/m³', '°C', '°F', 'µm', 'kWh', 'kVA', 'Ω'] },
];

export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'arrow' | 'callout' | 'star' | 'banner' | 'textbox';

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Hình chữ nhật',
  rounded: 'Chữ nhật bo góc',
  ellipse: 'Hình elip',
  arrow: 'Mũi tên phải',
  callout: 'Khung chú thích',
  star: 'Ngôi sao',
  banner: 'Băng rôn tiêu đề',
  textbox: 'Hộp văn bản',
};

export interface ShapeSpec {
  kind: ShapeKind;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wrapLines = (text: string, maxChars: number): string[] => {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > maxChars && line) {
        out.push(line);
        line = w;
      } else {
        line = (line + ' ' + w).trim();
      }
    }
    out.push(line);
  }
  return out;
};

export const buildShapeSvg = (spec: ShapeSpec): string => {
  const { width: w, height: h, strokeWidth: sw } = spec;
  const fill = spec.kind === 'textbox' ? spec.fill || '#ffffff' : spec.fill;
  const stroke = spec.stroke;
  const pad = sw / 2 + 1;
  let shape = '';
  let textBox = { x: pad + 8, y: pad + 6, w: w - 2 * pad - 16, h: h - 2 * pad - 12 };
  const attrs = `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${sw}" stroke-linejoin="round"`;
  if (spec.kind === 'rect' || spec.kind === 'textbox') {
    shape = `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" ${attrs}/>`;
  } else if (spec.kind === 'rounded') {
    const rr = Math.min(w, h) * 0.18;
    shape = `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="${rr}" ry="${rr}" ${attrs}/>`;
  } else if (spec.kind === 'ellipse') {
    shape = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - pad}" ry="${h / 2 - pad}" ${attrs}/>`;
    textBox = { x: w * 0.15, y: h * 0.15, w: w * 0.7, h: h * 0.7 };
  } else if (spec.kind === 'arrow') {
    const head = Math.min(w * 0.35, h * 0.9);
    const bodyTop = h * 0.25;
    const bodyBot = h * 0.75;
    const pts = [
      [pad, bodyTop],
      [w - head, bodyTop],
      [w - head, pad],
      [w - pad, h / 2],
      [w - head, h - pad],
      [w - head, bodyBot],
      [pad, bodyBot],
    ];
    shape = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" ${attrs}/>`;
    textBox = { x: pad + 6, y: bodyTop, w: w - head - pad - 6, h: bodyBot - bodyTop };
  } else if (spec.kind === 'callout') {
    const bh = h * 0.75;
    const pts = [
      [pad, pad],
      [w - pad, pad],
      [w - pad, bh],
      [w * 0.38, bh],
      [w * 0.2, h - pad],
      [w * 0.24, bh],
      [pad, bh],
    ];
    shape = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" ${attrs}/>`;
    textBox = { x: pad + 8, y: pad + 6, w: w - 2 * pad - 16, h: bh - pad - 12 };
  } else if (spec.kind === 'star') {
    const cx = w / 2;
    const cy = h / 2;
    const ro = Math.min(w, h) / 2 - pad;
    const ri = ro * 0.45;
    const pts: number[][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? ro : ri;
      pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    shape = `<polygon points="${pts.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ')}" ${attrs}/>`;
    textBox = { x: cx - ri, y: cy - ri * 0.7, w: ri * 2, h: ri * 1.4 };
  } else if (spec.kind === 'banner') {
    const notch = Math.min(w * 0.08, h * 0.5);
    const pts = [
      [pad, pad],
      [w - pad, pad],
      [w - pad - notch, h / 2],
      [w - pad, h - pad],
      [pad, h - pad],
      [pad + notch, h / 2],
    ];
    shape = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" ${attrs}/>`;
    textBox = { x: pad + notch + 4, y: pad + 4, w: w - 2 * (pad + notch + 4), h: h - 2 * pad - 8 };
  }

  const charW = spec.fontSize * 0.55;
  const lines = spec.text.trim() ? wrapLines(spec.text, Math.max(4, Math.floor(textBox.w / charW))) : [];
  const lineH = spec.fontSize * 1.25;
  const anchorX = spec.kind === 'textbox' ? textBox.x : textBox.x + textBox.w / 2;
  const startY = textBox.y + textBox.h / 2 - ((lines.length - 1) * lineH) / 2 + spec.fontSize * 0.35;
  const textSvg = lines
    .map(
      (line, i) =>
        `<text x="${anchorX}" y="${(spec.kind === 'textbox' ? textBox.y + spec.fontSize + i * lineH : startY + i * lineH).toFixed(1)}" text-anchor="${spec.kind === 'textbox' ? 'start' : 'middle'}" font-family="Arial, sans-serif" font-size="${spec.fontSize}" font-weight="${spec.bold ? 700 : 400}" fill="${escapeXml(spec.textColor)}">${escapeXml(line)}</text>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${shape}${textSvg}</svg>`;
};

export const rasterizeSvg = (svg: string, width: number, height: number, scale = 2): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG'));
    };
    img.src = url;
  });

export interface AccessibilityIssue {
  severity: 'error' | 'warning' | 'tip';
  sheet: string;
  where: string;
  message: string;
  fix: string;
}

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

export const contrastRatio = (fg: string, bg: string): number | null => {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

export interface AccessibilitySheetInput {
  name: string;
  hidden: boolean;
  mergeCount: number;
  cells: { row: number; col: number; value: unknown; fontColor?: string; background?: string }[];
}

export const auditAccessibility = (sheets: AccessibilitySheetInput[]): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = [];
  for (const sh of sheets) {
    if (/^(sheet|trang tính)\s*\d+$/i.test(sh.name.trim())) {
      issues.push({ severity: 'tip', sheet: sh.name, where: 'Tên Sheet', message: 'Tên Sheet mặc định không mô tả nội dung.', fix: 'Đổi tên Sheet theo nội dung (Home → Cỡ ô → Đổi tên Sheet).' });
    }
    if (sh.hidden) {
      issues.push({ severity: 'warning', sheet: sh.name, where: 'Sheet ẩn', message: 'Sheet đang ẩn, người dùng trình đọc màn hình có thể bỏ sót.', fix: 'Hiện lại Sheet nếu chứa dữ liệu cần đọc.' });
    }
    if (sh.mergeCount > 0) {
      issues.push({ severity: 'warning', sheet: sh.name, where: `${sh.mergeCount} vùng gộp`, message: 'Ô gộp làm trình đọc màn hình và sắp xếp/lọc đọc sai thứ tự.', fix: 'Tách ô (Home → mũi tên ▾ cạnh Gộp ô → Tách toàn bộ ô gộp), rồi dùng Căn giữa ngang.' });
    }
    let lowContrast = 0;
    let firstLow = '';
    for (const cell of sh.cells) {
      if (cell.value === null || cell.value === undefined || cell.value === '') continue;
      const ratio = contrastRatio(cell.fontColor || '#000000', cell.background || '#ffffff');
      if (ratio !== null && ratio < 4.5) {
        lowContrast += 1;
        if (!firstLow) firstLow = formatA1Cell(cell.row, cell.col);
      }
    }
    if (lowContrast > 0) {
      issues.push({ severity: 'error', sheet: sh.name, where: `${firstLow}${lowContrast > 1 ? ` và ${lowContrast - 1} ô khác` : ''}`, message: 'Độ tương phản chữ/nền dưới 4,5:1 (WCAG AA), khó đọc khi in hoặc với người mắt kém.', fix: 'Đổi màu chữ đậm hơn hoặc nền nhạt hơn.' });
    }
    const hasHeaderLike = sh.cells.some((c) => c.row <= 2 && typeof c.value === 'string' && String(c.value).trim().length > 0);
    if (sh.cells.length > 0 && !hasHeaderLike) {
      issues.push({ severity: 'tip', sheet: sh.name, where: 'Dòng tiêu đề', message: 'Không thấy dòng tiêu đề chữ ở 3 dòng đầu.', fix: 'Thêm tiêu đề cột để mô tả dữ liệu.' });
    }
  }
  return issues;
};

export const buildDataTableGrid = (inputLabel: string, outputLabel: string, results: { input: number; output: number | string }[]): GridValue[][] => [
  [inputLabel, outputLabel],
  ...results.map((r) => [r.input, typeof r.output === 'number' ? Math.round(r.output * 10000) / 10000 : r.output]),
];

export const parseNumberList = (text: string): number[] => {
  const trimmed = text.trim();
  const range = trimmed.match(/^(-?[\d.]+)\s*(?:\.\.|→|->|đến)\s*(-?[\d.]+)\s*(?:bước|step|:)\s*(-?[\d.]+)$/i);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const step = Math.abs(Number(range[3])) || 1;
    const out: number[] = [];
    const dir = end >= start ? 1 : -1;
    for (let v = start, i = 0; dir > 0 ? v <= end + 1e-9 : v >= end - 1e-9; v += step * dir, i++) {
      if (i > 500) break;
      out.push(Math.round(v * 1e9) / 1e9);
    }
    return out;
  }
  return trimmed
    .split(/[;\n\s]+/)
    .map((s) => (/^-?\d+,\d{1,2}$/.test(s) ? Number(s.replace(',', '.')) : coerceNumeric(s)))
    .filter((v): v is number => v !== null)
    .slice(0, 500);
};

export const numberFormatForValues = (values: unknown[]): string | null => {
  const nums = values.map((v) => (typeof v === 'number' ? v : null)).filter((v): v is number => v !== null);
  if (!nums.length) return null;
  if (nums.every((n) => Math.abs(n) <= 1) && nums.some((n) => n !== 0 && Math.abs(n) < 1)) return '0.00%';
  return nums.every((n) => Number.isInteger(n)) ? '#,##0' : '#,##0.00';
};

export const estimateColumnWidths = (grid: GridValue[][], minPx = 64, maxPx = 320): number[] => {
  const width = Math.max(0, ...grid.map((r) => r.length));
  return Array.from({ length: width }, (_, c) => {
    let longest = 0;
    for (const row of grid) {
      const v = row[c];
      if (v === null || v === undefined) continue;
      const text = typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : String(v).startsWith('=') ? '000.000.000' : String(v);
      longest = Math.max(longest, text.length);
    }
    return Math.max(minPx, Math.min(maxPx, Math.round(longest * 8 + 24)));
  });
};
