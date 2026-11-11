import type { CellStyle, CellValue, SheetData } from '../../lib/sheetTypes';
import { emptySheet } from '../../lib/xlsxConvert';

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie';
export type PivotAggFn = 'SUM' | 'COUNT' | 'AVERAGE' | 'MAX' | 'MIN';

export interface ParsedA1Range {
  sheetName?: string;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface FormulaCatalogItem {
  group: string;
  name: string;
  syntax: string;
  desc: string;
  example: string;
  template: string;
}

export interface CellStylePreset {
  id: string;
  label: string;
  sample: string;
  bg: string | null;
  fg: string;
  bold?: boolean;
  italic?: boolean;
  borderColor?: string;
  numFmt?: string;
}

export interface TableThemePreset {
  id: string;
  name: string;
  headerBg: string;
  headerFg: string;
  stripeBg: string;
  evenBg: string;
  totalBg: string;
  borderColor: string;
}

export interface WorkbookThemePreset {
  id: string;
  name: string;
  primary: string;
  accentBg: string;
  headerFg: string;
  border: string;
  fontFamily: string;
}

export interface ChartSeries {
  name: string;
  values: number[];
  color: string;
}

export interface ChartDataset {
  labels: string[];
  series: ChartSeries[];
  sourceRange: string;
}

export interface SheetColumnSummary {
  colIndex: number;
  colLetter: string;
  header: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  topLabel: string;
  topValue: number;
}

export interface SheetAnalysisResult {
  sheetName: string;
  nonEmptyCells: number;
  numericCells: number;
  textCells: number;
  formulaCells: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  errorCells: Array<{ a1: string; row: number; col: number; error: string; formula?: string }>;
  trailingSpaceCells: Array<{ a1: string; row: number; col: number; value: string }>;
  numericTextCells: Array<{ a1: string; row: number; col: number; value: string; parsed: number }>;
  duplicateRowCount: number;
  columnSummaries: SheetColumnSummary[];
}

export const stripSpreadsheetExt = (name: string): string => {
  const cleaned = name.trim().replace(/\.(xlsx|xlsm|xls|csv|tsv|pdf|png|html|json)$/i, '').trim();
  return cleaned || 'Bang-tinh';
};

export const colIndexToLetter = (index: number): string => {
  let n = Math.max(0, Math.floor(index)) + 1;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
};

export const colLetterToIndex = (letters: string): number => {
  const clean = letters.trim().toUpperCase();
  let result = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    result = result * 26 + (code - 64);
  }
  return result - 1;
};

export const formatA1Cell = (row: number, col: number): string =>
  `${colIndexToLetter(col)}${Math.max(0, Math.floor(row)) + 1}`;

export const formatA1Range = (sr: number, sc: number, er: number, ec: number): string => {
  const r1 = Math.min(sr, er);
  const r2 = Math.max(sr, er);
  const c1 = Math.min(sc, ec);
  const c2 = Math.max(sc, ec);
  if (r1 === r2 && c1 === c2) return formatA1Cell(r1, c1);
  return `${formatA1Cell(r1, c1)}:${formatA1Cell(r2, c2)}`;
};

export const parseA1Range = (input: string): ParsedA1Range | null => {
  const raw = input.trim();
  if (!raw) return null;
  let sheetName: string | undefined;
  let refPart = raw;
  const bangIdx = raw.lastIndexOf('!');
  if (bangIdx > 0) {
    sheetName = raw.slice(0, bangIdx).replace(/^'+|'+$/g, '').trim();
    refPart = raw.slice(bangIdx + 1).trim();
  }
  const normalized = refPart.replaceAll('$', '').toUpperCase();
  const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(normalized);
  if (!match) return null;
  const sc = colLetterToIndex(match[1]);
  const sr = Number(match[2]) - 1;
  const ec = match[3] ? colLetterToIndex(match[3]) : sc;
  const er = match[4] ? Number(match[4]) - 1 : sr;
  if (sc < 0 || ec < 0 || sr < 0 || er < 0) return null;
  return {
    sheetName,
    startRow: Math.min(sr, er),
    startColumn: Math.min(sc, ec),
    endRow: Math.max(sr, er),
    endColumn: Math.max(sc, ec),
  };
};

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

const readThreeDigitsVi = (num: number, showZeroHundred: boolean): string => {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;
  const parts: string[] = [];

  if (hundreds > 0 || showZeroHundred) {
    parts.push(`${VI_DIGITS[hundreds]} trăm`);
  }

  if (tens === 0) {
    if (ones > 0) {
      if (parts.length > 0) parts.push('lẻ');
      parts.push(VI_DIGITS[ones]);
    }
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(VI_DIGITS[ones]);
  } else {
    parts.push(`${VI_DIGITS[tens]} mươi`);
    if (ones === 1) parts.push('mốt');
    else if (ones === 4) parts.push('tư');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(VI_DIGITS[ones]);
  }

  return parts.join(' ');
};

export const readVietnameseMoneyWords = (amount: number): string => {
  if (!Number.isFinite(amount)) return 'Không hợp lệ';
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Không đồng chẵn';
  const isNegative = rounded < 0;
  let remaining = Math.abs(rounded);
  const groups: number[] = [];
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const chunks: string[] = [];
  for (let idx = groups.length - 1; idx >= 0; idx--) {
    const val = groups[idx];
    if (val === 0) continue;
    const hasHigherNonZero = idx < groups.length - 1;
    const text = readThreeDigitsVi(val, hasHigherNonZero);
    const scale = VI_SCALES[idx] ?? '';
    chunks.push(scale ? `${text} ${scale}` : text);
  }
  const joined = `${isNegative ? 'Âm ' : ''}${chunks.join(' ')} đồng chẵn`.replace(/\s+/g, ' ').trim();
  return joined.charAt(0).toUpperCase() + joined.slice(1);
};

export const THEME_COLOR_SWATCHES = [
  '#000000', '#1e293b', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc', '#ffffff', '#dc2626',
  '#ea580c', '#d97706', '#ca8a04', '#16a34a', '#107c41', '#0d9488', '#0284c7', '#2563eb', '#4f46e5', '#7c3aed',
  '#db2777', '#fee2e2', '#ffedd5', '#fef3c7', '#fef9c3', '#dcfce7', '#d1fae5', '#ccfbf1', '#e0f2fe', '#dbeafe',
  '#e0e7ff', '#ede9fe', '#fce7f3', '#991b1b', '#9a3412', '#166534', '#065f46', '#1e40af', '#3730a3', '#5b21b6',
];

export const CELL_STYLE_PRESETS: CellStylePreset[] = [
  { id: 'normal', label: 'Normal', sample: 'AaBb', bg: '#ffffff', fg: '#0f172a' },
  { id: 'good', label: 'Đạt (Good)', sample: 'Tốt', bg: '#dcfce7', fg: '#166534', bold: true },
  { id: 'bad', label: 'Cảnh báo', sample: 'Lỗi', bg: '#fee2e2', fg: '#991b1b', bold: true },
  { id: 'neutral', label: 'Trung tính', sample: 'Chờ', bg: '#fef9c3', fg: '#854d0e' },
  { id: 'calc', label: 'Công thức', sample: '=fx', bg: '#f1f5f9', fg: '#c2410c', bold: true, borderColor: '#94a3b8' },
  { id: 'total', label: 'Tổng cộng', sample: '∑ Tổng', bg: '#ecfdf5', fg: '#065f46', bold: true, borderColor: '#107c41', numFmt: '#,##0' },
  { id: 'accent-emerald', label: 'Tiêu đề Xanh', sample: 'Header', bg: '#107c41', fg: '#ffffff', bold: true },
  { id: 'accent-ocean', label: 'Tiêu đề Dương', sample: 'Header', bg: '#1d4ed8', fg: '#ffffff', bold: true },
  { id: 'accent-indigo', label: 'Tiêu đề Tím', sample: 'Header', bg: '#4338ca', fg: '#ffffff', bold: true },
  { id: 'accent-amber', label: 'Điểm nhấn', sample: 'Note', bg: '#fffbeb', fg: '#92400e', italic: true, borderColor: '#f59e0b' },
];

export const TABLE_THEMES: TableThemePreset[] = [
  { id: 'emerald', name: 'Excel Emerald', headerBg: '#107c41', headerFg: '#ffffff', stripeBg: '#f0fdf4', evenBg: '#ffffff', totalBg: '#dcfce7', borderColor: '#86efac' },
  { id: 'ocean', name: 'Ocean Corporate', headerBg: '#1d4ed8', headerFg: '#ffffff', stripeBg: '#eff6ff', evenBg: '#ffffff', totalBg: '#dbeafe', borderColor: '#93c5fd' },
  { id: 'indigo', name: 'Executive Indigo', headerBg: '#3730a3', headerFg: '#ffffff', stripeBg: '#eef2ff', evenBg: '#ffffff', totalBg: '#e0e7ff', borderColor: '#a5b4fc' },
  { id: 'teal', name: 'Accounting Teal', headerBg: '#0f766e', headerFg: '#ffffff', stripeBg: '#f0fdfa', evenBg: '#ffffff', totalBg: '#ccfbf1', borderColor: '#5eead4' },
  { id: 'amber', name: 'Inventory Amber', headerBg: '#b45309', headerFg: '#ffffff', stripeBg: '#fffbeb', evenBg: '#ffffff', totalBg: '#fef3c7', borderColor: '#fcd34d' },
  { id: 'slate', name: 'Minimal Slate', headerBg: '#1e293b', headerFg: '#ffffff', stripeBg: '#f8fafc', evenBg: '#ffffff', totalBg: '#e2e8f0', borderColor: '#cbd5e1' },
];

export const WORKBOOK_THEMES: WorkbookThemePreset[] = [
  { id: 'emerald', name: 'Minh Sheets Green', primary: '#107c41', accentBg: '#ecfdf5', headerFg: '#ffffff', border: '#a7f3d0', fontFamily: 'Arial' },
  { id: 'office-blue', name: 'Office Classic Blue', primary: '#185abd', accentBg: '#eff6ff', headerFg: '#ffffff', border: '#bfdbfe', fontFamily: 'Calibri' },
  { id: 'indigo-pro', name: 'Indigo Finance', primary: '#3730a3', accentBg: '#eef2ff', headerFg: '#ffffff', border: '#c7d2fe', fontFamily: 'Arial' },
  { id: 'teal-ledger', name: 'Teal Ledger', primary: '#0f766e', accentBg: '#f0fdfa', headerFg: '#ffffff', border: '#99f6e4', fontFamily: 'Tahoma' },
  { id: 'crimson-exec', name: 'Executive Crimson', primary: '#b91c1c', accentBg: '#fef2f2', headerFg: '#ffffff', border: '#fecaca', fontFamily: 'Times New Roman' },
];

export const CHART_PALETTES: Record<string, string[]> = {
  emerald: ['#107c41', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'],
  ocean: ['#2563eb', '#06b6d4', '#6366f1', '#10b981', '#f97316', '#ec4899'],
  vibrant: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'],
  corporate: ['#1e293b', '#0f766e', '#2563eb', '#b45309', '#64748b', '#991b1b'],
};

export const FORMULA_CATALOG: FormulaCatalogItem[] = [
  { group: 'Toán & Thống kê', name: 'SUM', syntax: '=SUM(vùng)', desc: 'Tính tổng các giá trị số trong vùng chọn', example: '=SUM(B3:D3)', template: '=SUM({range})' },
  { group: 'Toán & Thống kê', name: 'AVERAGE', syntax: '=AVERAGE(vùng)', desc: 'Tính trung bình cộng của các ô số', example: '=AVERAGE(B3:B7)', template: '=AVERAGE({range})' },
  { group: 'Toán & Thống kê', name: 'COUNT', syntax: '=COUNT(vùng)', desc: 'Đếm số ô chứa dữ liệu kiểu số', example: '=COUNT(B3:B20)', template: '=COUNT({range})' },
  { group: 'Toán & Thống kê', name: 'COUNTA', syntax: '=COUNTA(vùng)', desc: 'Đếm số ô không trống trong vùng chọn', example: '=COUNTA(A3:A20)', template: '=COUNTA({range})' },
  { group: 'Toán & Thống kê', name: 'COUNTBLANK', syntax: '=COUNTBLANK(vùng)', desc: 'Đếm số ô đang để trống', example: '=COUNTBLANK(B3:B20)', template: '=COUNTBLANK({range})' },
  { group: 'Toán & Thống kê', name: 'MAX', syntax: '=MAX(vùng)', desc: 'Lấy giá trị lớn nhất trong vùng dữ liệu', example: '=MAX(E3:E7)', template: '=MAX({range})' },
  { group: 'Toán & Thống kê', name: 'MIN', syntax: '=MIN(vùng)', desc: 'Lấy giá trị nhỏ nhất trong vùng dữ liệu', example: '=MIN(E3:E7)', template: '=MIN({range})' },
  { group: 'Toán & Thống kê', name: 'MEDIAN', syntax: '=MEDIAN(vùng)', desc: 'Tính số trung vị của tập dữ liệu số', example: '=MEDIAN(B3:B15)', template: '=MEDIAN({range})' },
  { group: 'Toán & Thống kê', name: 'ROUND', syntax: '=ROUND(số, chữ_số)', desc: 'Làm tròn số tới số chữ số thập phân chỉ định', example: '=ROUND(E3/1000, 0)', template: '=ROUND({cell}, 0)' },
  { group: 'Toán & Thống kê', name: 'ROUNDUP', syntax: '=ROUNDUP(số, chữ_số)', desc: 'Làm tròn số tiến lên xa điểm 0', example: '=ROUNDUP(A2*1.08, 0)', template: '=ROUNDUP({cell}, 0)' },
  { group: 'Toán & Thống kê', name: 'ROUNDDOWN', syntax: '=ROUNDDOWN(số, chữ_số)', desc: 'Làm tròn số lùi xuống gần điểm 0', example: '=ROUNDDOWN(A2, 0)', template: '=ROUNDDOWN({cell}, 0)' },
  { group: 'Toán & Thống kê', name: 'ABS', syntax: '=ABS(số)', desc: 'Trả về giá trị tuyệt đối không âm', example: '=ABS(F3-G3)', template: '=ABS({cell})' },
  { group: 'Toán & Thống kê', name: 'MOD', syntax: '=MOD(số_bị_chia, số_chia)', desc: 'Lấy phần dư của phép chia', example: '=MOD(A2, 2)', template: '=MOD({cell}, 2)' },
  { group: 'Toán & Thống kê', name: 'PRODUCT', syntax: '=PRODUCT(vùng)', desc: 'Nhân tất cả các số trong phạm vi', example: '=PRODUCT(D3:E3)', template: '=PRODUCT({range})' },
  { group: 'Toán & Thống kê', name: 'SUMPRODUCT', syntax: '=SUMPRODUCT(mảng_1, mảng_2)', desc: 'Tính tổng tích từng phần tử tương ứng giữa các mảng', example: '=SUMPRODUCT(D3:D7, E3:E7)', template: '=SUMPRODUCT(B3:B7, C3:C7)' },
  { group: 'Toán & Thống kê', name: 'SUMIF', syntax: '=SUMIF(vùng_đk, điều_kiện, [vùng_tổng])', desc: 'Tính tổng các ô thoả mãn 1 điều kiện', example: '=SUMIF(E4:E9, "Doanh thu", F4:F9)', template: '=SUMIF({range}, ">0")' },
  { group: 'Toán & Thống kê', name: 'SUMIFS', syntax: '=SUMIFS(vùng_tổng, vùng_đk1, đk1, ...)', desc: 'Tính tổng thoả mãn đồng thời nhiều điều kiện', example: '=SUMIFS(F4:F9, E4:E9, "Doanh thu", F4:F9, ">100000000")', template: '=SUMIFS(C2:C20, A2:A20, "Đạt")' },
  { group: 'Toán & Thống kê', name: 'COUNTIF', syntax: '=COUNTIF(vùng, điều_kiện)', desc: 'Đếm số ô thoả mãn điều kiện', example: '=COUNTIF(J3:J7, "Hoàn thành")', template: '=COUNTIF({range}, ">0")' },
  { group: 'Toán & Thống kê', name: 'COUNTIFS', syntax: '=COUNTIFS(vùng_1, đk_1, ...)', desc: 'Đếm số dòng thoả mãn nhiều điều kiện', example: '=COUNTIFS(B2:B20, "Kỹ thuật", E2:E20, ">=22")', template: '=COUNTIFS({range}, "<>0")' },
  { group: 'Toán & Thống kê', name: 'AVERAGEIF', syntax: '=AVERAGEIF(vùng_đk, đk, [vùng_tb])', desc: 'Tính trung bình các ô thoả điều kiện', example: '=AVERAGEIF(C3:C7, ">0")', template: '=AVERAGEIF({range}, ">0")' },
  { group: 'Toán & Thống kê', name: 'LARGE', syntax: '=LARGE(vùng, k)', desc: 'Trả về giá trị lớn thứ k trong tập dữ liệu', example: '=LARGE(E3:E7, 2)', template: '=LARGE({range}, 1)' },
  { group: 'Toán & Thống kê', name: 'SMALL', syntax: '=SMALL(vùng, k)', desc: 'Trả về giá trị nhỏ thứ k trong tập dữ liệu', example: '=SMALL(E3:E7, 2)', template: '=SMALL({range}, 1)' },
  { group: 'Toán & Thống kê', name: 'RANK', syntax: '=RANK(số, vùng, [thứ_tự])', desc: 'Xếp hạng một giá trị trong danh sách số', example: '=RANK(E3, $E$3:$E$7)', template: '=RANK({cell}, {range})' },
  { group: 'Toán & Thống kê', name: 'SQRT', syntax: '=SQRT(số)', desc: 'Tính căn bậc hai của một số không âm', example: '=SQRT(16)', template: '=SQRT({cell})' },
  { group: 'Toán & Thống kê', name: 'POWER', syntax: '=POWER(cơ_số, số_mũ)', desc: 'Tính lũy thừa cơ số mũ n (tương đương ^)', example: '=POWER(A2, 3)', template: '=POWER({cell}, 2)' },
  { group: 'Toán & Thống kê', name: 'EXP', syntax: '=EXP(số_mũ)', desc: 'Tính lũy thừa cơ số e mũ x', example: '=EXP(1)', template: '=EXP({cell})' },
  { group: 'Toán & Thống kê', name: 'LN', syntax: '=LN(số)', desc: 'Tính logarit tự nhiên (cơ số e) của một số', example: '=LN(10)', template: '=LN({cell})' },
  { group: 'Toán & Thống kê', name: 'LOG', syntax: '=LOG(số, [cơ_số])', desc: 'Tính logarit theo cơ số chỉ định (mặc định cơ số 10)', example: '=LOG(100, 10)', template: '=LOG({cell}, 10)' },
  { group: 'Toán & Thống kê', name: 'LOG10', syntax: '=LOG10(số)', desc: 'Tính logarit cơ số 10 của một số', example: '=LOG10(1000)', template: '=LOG10({cell})' },
  { group: 'Toán & Thống kê', name: 'PI', syntax: '=PI()', desc: 'Trả về giá trị hằng số Pi xấp xỉ 3.14159265', example: '=PI()', template: '=PI()' },
  { group: 'Toán & Thống kê', name: 'SIN', syntax: '=SIN(góc_radian)', desc: 'Tính sin của góc đo bằng radian', example: '=SIN(PI()/2)', template: '=SIN({cell})' },
  { group: 'Toán & Thống kê', name: 'COS', syntax: '=COS(góc_radian)', desc: 'Tính cos của góc đo bằng radian', example: '=COS(0)', template: '=COS({cell})' },
  { group: 'Toán & Thống kê', name: 'TAN', syntax: '=TAN(góc_radian)', desc: 'Tính tang của góc đo bằng radian', example: '=TAN(PI()/4)', template: '=TAN({cell})' },
  { group: 'Toán & Thống kê', name: 'COT', syntax: '=COT(góc_radian)', desc: 'Tính cotang của góc đo bằng radian', example: '=COT(PI()/4)', template: '=COT({cell})' },
  { group: 'Toán & Thống kê', name: 'ASIN', syntax: '=ASIN(giá_trị)', desc: 'Tính arcsin (góc radian) trong khoảng [-1, 1]', example: '=ASIN(1)', template: '=ASIN({cell})' },
  { group: 'Toán & Thống kê', name: 'ACOS', syntax: '=ACOS(giá_trị)', desc: 'Tính arccos (góc radian) trong khoảng [-1, 1]', example: '=ACOS(0)', template: '=ACOS({cell})' },
  { group: 'Toán & Thống kê', name: 'ATAN', syntax: '=ATAN(giá_trị)', desc: 'Tính arctang (góc radian)', example: '=ATAN(1)', template: '=ATAN({cell})' },
  { group: 'Toán & Thống kê', name: 'DEGREES', syntax: '=DEGREES(góc_radian)', desc: 'Chuyển đổi góc từ đơn vị radian sang độ', example: '=DEGREES(PI())', template: '=DEGREES({cell})' },
  { group: 'Toán & Thống kê', name: 'RADIANS', syntax: '=RADIANS(góc_độ)', desc: 'Chuyển đổi góc từ đơn vị độ sang radian', example: '=RADIANS(180)', template: '=RADIANS({cell})' },
  { group: 'Toán & Thống kê', name: 'INT', syntax: '=INT(số)', desc: 'Làm tròn số xuống số nguyên gần nhất', example: '=INT(8.9)', template: '=INT({cell})' },
  { group: 'Toán & Thống kê', name: 'TRUNC', syntax: '=TRUNC(số, [chữ_số])', desc: 'Cắt bỏ phần thập phân theo số chữ số chỉ định', example: '=TRUNC(8.75, 1)', template: '=TRUNC({cell}, 0)' },
  { group: 'Toán & Thống kê', name: 'CEILING', syntax: '=CEILING(số, bội_số)', desc: 'Làm tròn số lên bội số gần nhất chỉ định', example: '=CEILING(4.2, 0.5)', template: '=CEILING({cell}, 1)' },
  { group: 'Toán & Thống kê', name: 'FLOOR', syntax: '=FLOOR(số, bội_số)', desc: 'Làm tròn số xuống bội số gần nhất chỉ định', example: '=FLOOR(4.8, 0.5)', template: '=FLOOR({cell}, 1)' },
  { group: 'Toán & Thống kê', name: 'FACT', syntax: '=FACT(số)', desc: 'Tính giai thừa của một số nguyên không âm (n!)', example: '=FACT(5)', template: '=FACT({cell})' },
  { group: 'Toán & Thống kê', name: 'COMBIN', syntax: '=COMBIN(tổng_n, chọn_k)', desc: 'Tính số tổ hợp chập k của n phần tử', example: '=COMBIN(10, 2)', template: '=COMBIN({cell}, 2)' },
  { group: 'Toán & Thống kê', name: 'PERMUT', syntax: '=PERMUT(tổng_n, chọn_k)', desc: 'Tính số chỉnh hợp chập k của n phần tử', example: '=PERMUT(10, 2)', template: '=PERMUT({cell}, 2)' },
  { group: 'Toán & Thống kê', name: 'GCD', syntax: '=GCD(số_1, số_2, ...)', desc: 'Tìm ước số chung lớn nhất (UCLN) của các số', example: '=GCD(24, 36)', template: '=GCD({cell}, 12)' },
  { group: 'Toán & Thống kê', name: 'LCM', syntax: '=LCM(số_1, số_2, ...)', desc: 'Tìm bội số chung nhỏ nhất (BCNN) của các số', example: '=LCM(12, 18)', template: '=LCM({cell}, 20)' },
  { group: 'Toán & Thống kê', name: 'RAND', syntax: '=RAND()', desc: 'Sinh số thực ngẫu nhiên đồng đều trong khoảng [0, 1)', example: '=RAND()', template: '=RAND()' },
  { group: 'Toán & Thống kê', name: 'RANDBETWEEN', syntax: '=RANDBETWEEN(dưới, trên)', desc: 'Sinh số nguyên ngẫu nhiên giữa cận dưới và cận trên', example: '=RANDBETWEEN(1, 100)', template: '=RANDBETWEEN(1, 100)' },
  { group: 'Toán & Thống kê', name: 'STDEV.S', syntax: '=STDEV.S(vùng)', desc: 'Tính độ lệch chuẩn của một tập mẫu dữ liệu', example: '=STDEV.S(B3:B20)', template: '=STDEV.S({range})' },
  { group: 'Toán & Thống kê', name: 'STDEV.P', syntax: '=STDEV.P(vùng)', desc: 'Tính độ lệch chuẩn của toàn bộ tổng thể dữ liệu', example: '=STDEV.P(B3:B20)', template: '=STDEV.P({range})' },
  { group: 'Toán & Thống kê', name: 'VAR.S', syntax: '=VAR.S(vùng)', desc: 'Tính phương sai của một tập mẫu dữ liệu', example: '=VAR.S(B3:B20)', template: '=VAR.S({range})' },
  { group: 'Toán & Thống kê', name: 'VAR.P', syntax: '=VAR.P(vùng)', desc: 'Tính phương sai của toàn bộ tổng thể dữ liệu', example: '=VAR.P(B3:B20)', template: '=VAR.P({range})' },
  { group: 'Toán & Thống kê', name: 'MODE.SNGL', syntax: '=MODE.SNGL(vùng)', desc: 'Tìm giá trị xuất hiện nhiều lần nhất trong tập dữ liệu', example: '=MODE.SNGL(B3:B20)', template: '=MODE.SNGL({range})' },

  { group: 'Logic & Điều kiện', name: 'IF', syntax: '=IF(điều_kiện, đúng, sai)', desc: 'Kiểm tra điều kiện và trả về giá trị tương ứng', example: '=IF(E3>=100000000, "Cao", "Bình thường")', template: '=IF({cell}>0, "Đạt", "Chưa đạt")' },
  { group: 'Logic & Điều kiện', name: 'IFS', syntax: '=IFS(đk1, kq1, đk2, kq2, ...)', desc: 'Kiểm tra tuần tự nhiều điều kiện không cần lồng IF', example: '=IFS(I3>=1, "Hoàn thành", I3>=0.5, "Đang chạy", TRUE, "Mới")', template: '=IFS({cell}>=80, "Tốt", {cell}>=50, "Khá", TRUE, "Cần cải thiện")' },
  { group: 'Logic & Điều kiện', name: 'IFERROR', syntax: '=IFERROR(biểu_thức, giá_trị_khi_lỗi)', desc: 'Bẫy mọi lỗi công thức (#DIV/0!, #N/A...) và trả về giá trị an toàn', example: '=IFERROR(E3/D3, 0)', template: '=IFERROR({cell}, 0)' },
  { group: 'Logic & Điều kiện', name: 'IFNA', syntax: '=IFNA(biểu_thức, giá_trị_khi_NA)', desc: 'Bẫy riêng lỗi không tìm thấy #N/A khi tra cứu', example: '=IFNA(VLOOKUP(A2, D2:F20, 2, 0), "Chưa có")', template: '=IFNA({cell}, "Không tìm thấy")' },
  { group: 'Logic & Điều kiện', name: 'AND', syntax: '=AND(đk1, đk2, ...)', desc: 'Trả về TRUE khi tất cả điều kiện đều đúng', example: '=AND(B3>0, C3>0)', template: '=AND({cell}>0, {cell}<1000000000)' },
  { group: 'Logic & Điều kiện', name: 'OR', syntax: '=OR(đk1, đk2, ...)', desc: 'Trả về TRUE khi có ít nhất 1 điều kiện đúng', example: '=OR(E3="Thu", E3="Doanh thu")', template: '=OR({cell}>0, {cell}="Đạt")' },
  { group: 'Logic & Điều kiện', name: 'NOT', syntax: '=NOT(biểu_thức)', desc: 'Đảo ngược giá trị logic TRUE/FALSE', example: '=NOT(ISBLANK(A2))', template: '=NOT({cell}=0)' },

  { group: 'Tra cứu & Tham chiếu', name: 'VLOOKUP', syntax: '=VLOOKUP(khóa, bảng, cột_lấy, 0)', desc: 'Tra cứu dọc theo cột đầu tiên của bảng tham chiếu', example: '=VLOOKUP(A3, $A$3:$F$7, 5, 0)', template: '=VLOOKUP({cell}, A2:E20, 2, 0)' },
  { group: 'Tra cứu & Tham chiếu', name: 'HLOOKUP', syntax: '=HLOOKUP(khóa, bảng, hàng_lấy, 0)', desc: 'Tra cứu ngang theo hàng đầu tiên của bảng', example: '=HLOOKUP("Tháng 11", B2:D8, 2, 0)', template: '=HLOOKUP({cell}, A1:F10, 2, 0)' },
  { group: 'Tra cứu & Tham chiếu', name: 'XLOOKUP', syntax: '=XLOOKUP(khóa, cột_tìm, cột_trả_về, [nếu_vắng])', desc: 'Tra cứu hai chiều hiện đại không phụ thuộc vị trí cột', example: '=XLOOKUP(A3, A3:A7, E3:E7, 0)', template: '=XLOOKUP({cell}, A2:A20, B2:B20, "Không có")' },
  { group: 'Tra cứu & Tham chiếu', name: 'XMATCH', syntax: '=XMATCH(khóa, vùng, [chế_độ_khớp])', desc: 'Tìm vị trí phần tử hiện đại theo thứ tự xuôi/ngược', example: '=XMATCH(A3, A2:A20, 0)', template: '=XMATCH({cell}, A2:A20, 0)' },
  { group: 'Tra cứu & Tham chiếu', name: 'INDEX', syntax: '=INDEX(vùng, hàng, [cột])', desc: 'Trả về giá trị tại giao điểm hàng và cột trong vùng', example: '=INDEX(B3:E7, 1, 4)', template: '=INDEX({range}, 1, 1)' },
  { group: 'Tra cứu & Tham chiếu', name: 'MATCH', syntax: '=MATCH(khóa, vùng_1_chiều, 0)', desc: 'Tìm vị trí tương đối của phần tử trong hàng hoặc cột', example: '=MATCH("Marketing", A3:A7, 0)', template: '=MATCH({cell}, A2:A20, 0)' },
  { group: 'Tra cứu & Tham chiếu', name: 'FILTER', syntax: '=FILTER(vùng, điều_kiện, [nếu_trống])', desc: 'Lọc mảng dữ liệu động theo điều kiện logic', example: '=FILTER(A3:E20, E3:E20>50000000, "Trống")', template: '=FILTER({range}, B2:B20>0, "Không có dữ liệu")' },
  { group: 'Tra cứu & Tham chiếu', name: 'SORT', syntax: '=SORT(vùng, [cột], [thứ_tự])', desc: 'Sắp xếp vùng dữ liệu động trả về mảng kết quả', example: '=SORT(A3:E20, 5, -1)', template: '=SORT({range}, 1, 1)' },
  { group: 'Tra cứu & Tham chiếu', name: 'UNIQUE', syntax: '=UNIQUE(vùng)', desc: 'Trích xuất danh sách các giá trị duy nhất không trùng lặp', example: '=UNIQUE(A3:A20)', template: '=UNIQUE({range})' },
  { group: 'Tra cứu & Tham chiếu', name: 'SEQUENCE', syntax: '=SEQUENCE(số_hàng, [số_cột], [bắt_đầu], [bước])', desc: 'Sinh mảng chuỗi số liên tiếp theo quy luật cấp số cộng', example: '=SEQUENCE(10, 1, 1, 1)', template: '=SEQUENCE(10, 1, 1, 1)' },
  { group: 'Tra cứu & Tham chiếu', name: 'CHOOSECOLS', syntax: '=CHOOSECOLS(mảng, cột_1, cột_2, ...)', desc: 'Trích chọn chính xác các cột cần lấy từ bảng dữ liệu', example: '=CHOOSECOLS(A3:E20, 1, 3, 5)', template: '=CHOOSECOLS({range}, 1, 2)' },
  { group: 'Tra cứu & Tham chiếu', name: 'CHOOSEROWS', syntax: '=CHOOSEROWS(mảng, hàng_1, hàng_2, ...)', desc: 'Trích chọn các dòng theo chỉ số từ bảng dữ liệu', example: '=CHOOSEROWS(A3:E20, 1, 2, 5)', template: '=CHOOSEROWS({range}, 1, 2)' },
  { group: 'Tra cứu & Tham chiếu', name: 'TOCOL', syntax: '=TOCOL(mảng, [bỏ_qua])', desc: 'Chuyển đổi toàn bộ mảng dữ liệu ma trận thành một cột duy nhất', example: '=TOCOL(B3:D8, 1)', template: '=TOCOL({range}, 1)' },
  { group: 'Tra cứu & Tham chiếu', name: 'TOROW', syntax: '=TOROW(mảng, [bỏ_qua])', desc: 'Chuyển đổi toàn bộ mảng ma trận thành một dòng ngang duy nhất', example: '=TOROW(B3:D8, 1)', template: '=TOROW({range}, 1)' },
  { group: 'Tra cứu & Tham chiếu', name: 'LET', syntax: '=LET(tên_1, giá_trị_1, phép_tính)', desc: 'Khai báo biến cục bộ giúp công thức ngắn gọn, chạy nhanh', example: '=LET(tong, SUM(B3:D3), tong * 1.1)', template: '=LET(x, {cell}, x * 1.08)' },
  { group: 'Tra cứu & Tham chiếu', name: 'LAMBDA', syntax: '=LAMBDA(tham_số, biểu_thức)', desc: 'Định nghĩa hàm tùy biến linh hoạt trong công thức', example: '=LAMBDA(x, y, x*y + 10)', template: '=LAMBDA(x, x * 2)' },
  { group: 'Tra cứu & Tham chiếu', name: 'ROW', syntax: '=ROW([ô])', desc: 'Trả về số thứ tự dòng của ô tham chiếu', example: '=ROW()-2', template: '=ROW()' },
  { group: 'Tra cứu & Tham chiếu', name: 'COLUMN', syntax: '=COLUMN([ô])', desc: 'Trả về số thứ tự cột của ô tham chiếu', example: '=COLUMN()', template: '=COLUMN()' },

  { group: 'Văn bản', name: 'CONCAT', syntax: '=CONCAT(chuỗi_1, chuỗi_2, ...)', desc: 'Nối nhiều ô hoặc chuỗi văn bản liền nhau', example: '=CONCAT(A3, " - ", B3)', template: '=CONCAT({cell}, " - ")' },
  { group: 'Văn bản', name: 'TEXTJOIN', syntax: '=TEXTJOIN(phân_cách, bỏ_rỗng, vùng)', desc: 'Nối dải ô văn bản với ký tự phân cách tự chọn', example: '=TEXTJOIN(", ", TRUE, A3:A7)', template: '=TEXTJOIN(", ", TRUE, {range})' },
  { group: 'Văn bản', name: 'TEXTBEFORE', syntax: '=TEXTBEFORE(chuỗi, ký_tự_phân_tách)', desc: 'Trích xuất phần văn bản đứng trước ký tự phân tách', example: '=TEXTBEFORE(A3, "@")', template: '=TEXTBEFORE({cell}, " ")' },
  { group: 'Văn bản', name: 'TEXTAFTER', syntax: '=TEXTAFTER(chuỗi, ký_tự_phân_tách)', desc: 'Trích xuất phần văn bản đứng sau ký tự phân tách', example: '=TEXTAFTER(A3, "@")', template: '=TEXTAFTER({cell}, " ")' },
  { group: 'Văn bản', name: 'TEXTSPLIT', syntax: '=TEXTSPLIT(chuỗi, dấu_phân_cách)', desc: 'Tách chuỗi thành mảng các ô theo ký tự phân tách', example: '=TEXTSPLIT(A3, "-")', template: '=TEXTSPLIT({cell}, ",")' },
  { group: 'Văn bản', name: 'TRIM', syntax: '=TRIM(văn_bản)', desc: 'Loại bỏ khoảng trắng thừa ở đầu, cuối và giữa các từ', example: '=TRIM(A3)', template: '=TRIM({cell})' },
  { group: 'Văn bản', name: 'UPPER', syntax: '=UPPER(văn_bản)', desc: 'Chuyển toàn bộ chuỗi sang CHỮ IN HOA', example: '=UPPER(A3)', template: '=UPPER({cell})' },
  { group: 'Văn bản', name: 'LOWER', syntax: '=LOWER(văn_bản)', desc: 'Chuyển toàn bộ chuỗi sang chữ thường', example: '=LOWER(A3)', template: '=LOWER({cell})' },
  { group: 'Văn bản', name: 'PROPER', syntax: '=PROPER(văn_bản)', desc: 'Viết hoa chữ cái đầu mỗi từ (chuẩn Họ Tên)', example: '=PROPER(B3)', template: '=PROPER({cell})' },
  { group: 'Văn bản', name: 'LEFT', syntax: '=LEFT(chuỗi, số_ký_tự)', desc: 'Cắt ký tự từ bên trái chuỗi', example: '=LEFT(A3, 2)', template: '=LEFT({cell}, 3)' },
  { group: 'Văn bản', name: 'RIGHT', syntax: '=RIGHT(chuỗi, số_ký_tự)', desc: 'Cắt ký tự từ bên phải chuỗi', example: '=RIGHT(A3, 3)', template: '=RIGHT({cell}, 3)' },
  { group: 'Văn bản', name: 'MID', syntax: '=MID(chuỗi, vị_trí, độ_dài)', desc: 'Trích xuất chuỗi con ở vị trí bất kỳ', example: '=MID(A3, 3, 4)', template: '=MID({cell}, 1, 4)' },
  { group: 'Văn bản', name: 'LEN', syntax: '=LEN(chuỗi)', desc: 'Đếm tổng độ dài ký tự của ô', example: '=LEN(A3)', template: '=LEN({cell})' },
  { group: 'Văn bản', name: 'SUBSTITUTE', syntax: '=SUBSTITUTE(chuỗi, cũ, mới)', desc: 'Thay thế cụm ký tự trong văn bản', example: '=SUBSTITUTE(A3, "-", "/")', template: '=SUBSTITUTE({cell}, " ", "_")' },
  { group: 'Văn bản', name: 'VALUE', syntax: '=VALUE(chuỗi_số)', desc: 'Chuyển chuỗi văn bản dạng số thành giá trị số học', example: '=VALUE(B3)', template: '=VALUE({cell})' },

  { group: 'Ngày & Giờ', name: 'TODAY', syntax: '=TODAY()', desc: 'Trả về ngày hiện tại tự động cập nhật', example: '=TODAY()', template: '=TODAY()' },
  { group: 'Ngày & Giờ', name: 'NOW', syntax: '=NOW()', desc: 'Trả về ngày và giờ hệ thống hiện tại', example: '=NOW()', template: '=NOW()' },
  { group: 'Ngày & Giờ', name: 'DATE', syntax: '=DATE(năm, tháng, ngày)', desc: 'Tạo giá trị ngày chuẩn từ Năm, Tháng, Ngày', example: '=DATE(2026, 11, 15)', template: '=DATE(2026, 11, 1)' },
  { group: 'Ngày & Giờ', name: 'YEAR', syntax: '=YEAR(ngày)', desc: 'Tách lấy năm từ ô ngày tháng', example: '=YEAR(TODAY())', template: '=YEAR({cell})' },
  { group: 'Ngày & Giờ', name: 'MONTH', syntax: '=MONTH(ngày)', desc: 'Tách lấy tháng (1-12) từ ô ngày tháng', example: '=MONTH(TODAY())', template: '=MONTH({cell})' },
  { group: 'Ngày & Giờ', name: 'DAY', syntax: '=DAY(ngày)', desc: 'Tách lấy ngày trong tháng (1-31)', example: '=DAY(TODAY())', template: '=DAY({cell})' },
  { group: 'Ngày & Giờ', name: 'EOMONTH', syntax: '=EOMONTH(ngày_đầu, số_tháng)', desc: 'Tìm ngày cuối cùng của tháng cách ngày gốc n tháng', example: '=EOMONTH(TODAY(), 0)', template: '=EOMONTH(TODAY(), 0)' },
  { group: 'Ngày & Giờ', name: 'NETWORKDAYS', syntax: '=NETWORKDAYS(ngày_bđ, ngày_kt)', desc: 'Tính số ngày làm việc thực tế (trừ Thứ 7, Chủ Nhật)', example: '=NETWORKDAYS(DATE(2026,11,1), DATE(2026,11,30))', template: '=NETWORKDAYS(DATE(2026,11,1), DATE(2026,11,30))' },

  { group: 'Tài chính', name: 'PMT', syntax: '=PMT(lãi_suất, số_kỳ, khoản_vay)', desc: 'Tính số tiền trả góp định kỳ (gốc + lãi) cho khoản vay', example: '=PMT(0.09/12, 36, -500000000)', template: '=PMT(0.08/12, 12, -100000000)' },
  { group: 'Tài chính', name: 'FV', syntax: '=FV(lãi_suất, số_kỳ, góp_kỳ, [vốn_đầu])', desc: 'Tính giá trị tương lai của khoản tiết kiệm/đầu tư', example: '=FV(0.07/12, 24, -10000000, -50000000)', template: '=FV(0.06/12, 12, -5000000, 0)' },
  { group: 'Tài chính', name: 'PV', syntax: '=PV(lãi_suất, số_kỳ, dòng_tiền)', desc: 'Tính giá trị hiện tại quy đổi của dòng tiền đều', example: '=PV(0.08/12, 24, -10000000)', template: '=PV(0.08/12, 12, -10000000)' },
  { group: 'Tài chính', name: 'NPV', syntax: '=NPV(lãi_chiết_khấu, vùng_dòng_tiền)', desc: 'Tính hiện giá thuần (Net Present Value) của dự án', example: '=NPV(0.1, B3:D3)', template: '=NPV(0.1, {range})' },
];

export interface CellRect {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export const subtractRect = (source: CellRect, cut: CellRect): CellRect[] => {
  const overlaps =
    cut.startRow <= source.endRow && cut.endRow >= source.startRow && cut.startColumn <= source.endColumn && cut.endColumn >= source.startColumn;
  if (!overlaps) return [source];
  const pieces: CellRect[] = [];
  const top = Math.max(source.startRow, cut.startRow);
  const bottom = Math.min(source.endRow, cut.endRow);
  if (source.startRow < top) pieces.push({ ...source, endRow: top - 1 });
  if (bottom < source.endRow) pieces.push({ ...source, startRow: bottom + 1 });
  if (source.startColumn < cut.startColumn) pieces.push({ startRow: top, endRow: bottom, startColumn: source.startColumn, endColumn: cut.startColumn - 1 });
  if (cut.endColumn < source.endColumn) pieces.push({ startRow: top, endRow: bottom, startColumn: cut.endColumn + 1, endColumn: source.endColumn });
  return pieces;
};

export const findDuplicateRowIndexes = (rows: unknown[][], skipHeader = true): number[] => {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  rows.forEach((row, index) => {
    if (skipHeader && index === 0) return;
    const key = JSON.stringify(row.map((value) => (value === null || value === undefined ? '' : String(value).trim())));
    if (seen.has(key)) duplicates.push(index);
    else seen.add(key);
  });
  return duplicates;
};

export const groupDescendingRuns = (indexes: number[]): { start: number; count: number }[] => {
  const sorted = [...new Set(indexes)].sort((a, b) => b - a);
  const runs: { start: number; count: number }[] = [];
  for (const index of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.start - 1 === index) {
      last.start = index;
      last.count += 1;
    } else runs.push({ start: index, count: 1 });
  }
  return runs;
};

export const coerceNumeric = (val: unknown): number | null => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const pct = /^(-?\d+(?:[.,]\d+)?)%$/.exec(trimmed);
    if (pct) {
      const n = Number(pct[1].replace(',', '.'));
      return Number.isFinite(n) ? n / 100 : null;
    }
    const noCurrency = trimmed.replace(/[₫$€£¥\s]/g, '');
    if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(noCurrency)) {
      const n = Number(noCurrency.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(noCurrency)) {
      const n = Number(noCurrency.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    if (/^-?\d+,\d+$/.test(noCurrency)) {
      const n = Number(noCurrency.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    const cleaned = noCurrency.replace(/,/g, '');
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
};

const isSummaryRowLabel = (label: string): boolean => {
  const norm = label.trim().toLowerCase();
  return (
    norm.startsWith('tổng') ||
    norm.startsWith('tong ') ||
    norm === 'total' ||
    norm.startsWith('total ') ||
    norm.startsWith('grand total') ||
    norm.startsWith('bình quân')
  );
};

const isSummaryRow = (row: unknown[]): boolean =>
  row.slice(0, 5).some((cell) => isSummaryRowLabel(String(cell ?? '')));

export const extractChartDataset = (
  rawGrid: unknown[][],
  sourceRange: string,
  paletteId = 'emerald',
  includeSummaryRows = false
): ChartDataset => {
  const palette = CHART_PALETTES[paletteId] ?? CHART_PALETTES.emerald;
  const nonEmptyRows = rawGrid.filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''));

  if (nonEmptyRows.length === 0) {
    return {
      labels: ['Mục 1', 'Mục 2', 'Mục 3'],
      series: [{ name: 'Giá trị', values: [0, 0, 0], color: palette[0] }],
      sourceRange,
    };
  }

  const colCount = Math.max(...nonEmptyRows.map((r) => r.length));
  if (colCount === 1) {
    const firstNum = coerceNumeric(nonEmptyRows[0][0]);
    const hasHeader = firstNum === null && nonEmptyRows.length > 1;
    const seriesName = hasHeader ? String(nonEmptyRows[0][0]) : 'Giá trị';
    const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
    return {
      labels: dataRows.map((_, i) => `Dòng ${i + 1}`),
      series: [
        {
          name: seriesName,
          values: dataRows.map((r) => coerceNumeric(r[0]) ?? 0),
          color: palette[0],
        },
      ],
      sourceRange,
    };
  }

  const firstRow = nonEmptyRows[0];
  let firstRowTextCount = 0;
  let secondRowNumCount = 0;
  for (let c = 1; c < colCount; c++) {
    if (coerceNumeric(firstRow[c]) === null && firstRow[c] !== null && firstRow[c] !== undefined && String(firstRow[c]).trim() !== '') {
      firstRowTextCount += 1;
    }
    if (nonEmptyRows[1] && coerceNumeric(nonEmptyRows[1][c]) !== null) {
      secondRowNumCount += 1;
    }
  }
  const hasHeaderRow = nonEmptyRows.length > 1 && firstRowTextCount > 0 && secondRowNumCount > 0;
  const headerRow = hasHeaderRow ? firstRow : null;
  let bodyRows = hasHeaderRow ? nonEmptyRows.slice(1) : nonEmptyRows;

  if (!includeSummaryRows && bodyRows.length >= 3) {
    bodyRows = bodyRows.filter((r) => !isSummaryRow(r));
  }

  let labelCol = 0;
  for (let c = 0; c < colCount; c++) {
    const textCount = bodyRows.filter((r) => coerceNumeric(r[c]) === null && String(r[c] ?? '').trim() !== '').length;
    if (textCount >= Math.ceil(bodyRows.length / 2)) {
      labelCol = c;
      break;
    }
  }

  const numericCols: number[] = [];
  for (let c = 0; c < colCount; c++) {
    if (c === labelCol) continue;
    const hasNumbers = bodyRows.some((r) => coerceNumeric(r[c]) !== null);
    if (hasNumbers) {
      const hdr = String(headerRow?.[c] ?? '').toLowerCase();
      if (numericCols.length >= 2 && (hdr.includes('tỷ trọng') || hdr.includes('%'))) continue;
      numericCols.push(c);
    }
  }

  if (numericCols.length === 0) {
    for (let c = 0; c < colCount; c++) {
      if (bodyRows.some((r) => coerceNumeric(r[c]) !== null)) numericCols.push(c);
    }
  }

  const labels = bodyRows.map((r, idx) => {
    const raw = String(r[labelCol] ?? '').trim();
    return raw || `Mục ${idx + 1}`;
  });

  const series: ChartSeries[] = (numericCols.length ? numericCols : [Math.min(1, colCount - 1)]).slice(0, 6).map((c, sIdx) => ({
    name: headerRow?.[c] ? String(headerRow[c]).trim() : `Chuỗi ${sIdx + 1}`,
    values: bodyRows.map((r) => coerceNumeric(r[c]) ?? 0),
    color: palette[sIdx % palette.length],
  }));

  return { labels, series, sourceRange };
};

const escapeXml = (str: string): string =>
  str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const formatCompactNumber = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(abs % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  if (abs > 0 && abs < 1) return `${(val * 100).toFixed(1)}%`;
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
};

export const renderChartSvg = (
  dataset: ChartDataset,
  chartType: ChartType,
  title: string,
  width = 680,
  height = 380
): string => {
  const labels = dataset.labels.slice(0, 14);
  const series = dataset.series.map((s) => ({ ...s, values: s.values.slice(0, labels.length) }));
  const allVals = series.flatMap((s) => s.values);
  const maxRaw = Math.max(0, ...allVals);
  const minRaw = Math.min(0, ...allVals);
  const span = maxRaw - minRaw || 1;
  const yMax = maxRaw + span * 0.12;
  const yMin = minRaw < 0 ? minRaw - span * 0.08 : 0;
  const yRange = yMax - yMin || 1;

  const headerH = 52;
  const legendH = 30;
  const padLeft = chartType === 'bar' ? 128 : 68;
  const padRight = 28;
  const padBottom = 46;
  const plotLeft = padLeft;
  const plotTop = headerH;
  const plotW = width - padLeft - padRight;
  const plotH = height - headerH - padBottom - legendH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family:Arial,sans-serif;background:#ffffff">`
  );
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#ffffff" stroke="#e2e8f0"/>`);
  parts.push(`<text x="${ width / 2 }" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="#0f172a">${escapeXml(title || 'Biểu đồ phân tích dữ liệu')}</text>`);
  parts.push(`<text x="${ width / 2 }" y="42" text-anchor="middle" font-size="10.5" fill="#64748b">Nguồn dữ liệu: ${escapeXml(dataset.sourceRange)}</text>`);

  if (chartType === 'pie') {
    const primary = series[0] ?? { name: 'Giá trị', values: [], color: '#107c41' };
    const palette = CHART_PALETTES.emerald.concat(CHART_PALETTES.ocean);
    const positive = labels.map((lbl, idx) => ({
      label: lbl,
      value: Math.max(0, primary.values[idx] ?? 0),
      color: palette[idx % palette.length],
    }));
    const total = positive.reduce((acc, item) => acc + item.value, 0) || 1;
    const cx = width * 0.36;
    const cy = headerH + (height - headerH - 20) / 2;
    const radius = Math.min(width * 0.24, (height - headerH - 44) / 2);
    const innerR = radius * 0.46;
    let angle = -Math.PI / 2;

    positive.forEach((slice) => {
      const sweep = (slice.value / total) * Math.PI * 2;
      if (sweep <= 0.0005) return;
      if (sweep >= Math.PI * 1.999) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${slice.color}"/>`);
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff"/>`);
      } else {
        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle + sweep);
        const y2 = cy + radius * Math.sin(angle + sweep);
        const ix1 = cx + innerR * Math.cos(angle + sweep);
        const iy1 = cy + innerR * Math.sin(angle + sweep);
        const ix2 = cx + innerR * Math.cos(angle);
        const iy2 = cy + innerR * Math.sin(angle);
        const largeArc = sweep > Math.PI ? 1 : 0;
        const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z`;
        parts.push(`<path d="${d}" fill="${slice.color}" stroke="#ffffff" stroke-width="2"/>`);
      }
      angle += sweep;
    });

    parts.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="10" fill="#64748b">TỔNG</text>`);
    parts.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(formatCompactNumber(total))}</text>`);

    const legX = width * 0.64;
    let legY = headerH + 26;
    positive.slice(0, 9).forEach((slice) => {
      const pct = ((slice.value / total) * 100).toFixed(1);
      parts.push(`<rect x="${legX}" y="${legY - 9}" width="11" height="11" rx="3" fill="${slice.color}"/>`);
      const shortLbl = slice.label.length > 20 ? `${slice.label.slice(0, 19)}…` : slice.label;
      parts.push(`<text x="${legX + 17}" y="${legY}" font-size="11.5" fill="#1e293b" font-weight="600">${escapeXml(shortLbl)}</text>`);
      parts.push(`<text x="${width - 24}" y="${legY}" text-anchor="end" font-size="11" fill="#475569">${pct}% (${escapeXml(formatCompactNumber(slice.value))})</text>`);
      legY += 26;
    });

    parts.push('</svg>');
    return parts.join('');
  }

  if (chartType === 'bar') {
    const ticks = 5;
    for (let t = 0; t <= ticks; t++) {
      const ratio = t / ticks;
      const x = plotLeft + ratio * plotW;
      const val = yMin + ratio * yRange;
      parts.push(`<line x1="${x.toFixed(1)}" y1="${plotTop}" x2="${x.toFixed(1)}" y2="${plotTop + plotH}" stroke="#e2e8f0" stroke-dasharray="${t === 0 ? 'none' : '3,3'}"/>`);
      parts.push(`<text x="${x.toFixed(1)}" y="${plotTop + plotH + 18}" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(formatCompactNumber(val))}</text>`);
    }
    const zeroX = plotLeft + ((0 - yMin) / yRange) * plotW;
    const rowBand = plotH / Math.max(labels.length, 1);
    const barH = Math.min(20, Math.max(6, (rowBand * 0.72) / Math.max(series.length, 1)));

    labels.forEach((lbl, idx) => {
      const bandTop = plotTop + idx * rowBand;
      const shortLbl = lbl.length > 17 ? `${lbl.slice(0, 16)}…` : lbl;
      parts.push(`<text x="${plotLeft - 8}" y="${(bandTop + rowBand / 2 + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#334155">${escapeXml(shortLbl)}</text>`);
      const groupH = barH * series.length + (series.length - 1) * 2;
      const startY = bandTop + (rowBand - groupH) / 2;
      series.forEach((s, sIdx) => {
        const val = s.values[idx] ?? 0;
        const targetX = plotLeft + ((val - yMin) / yRange) * plotW;
        const bx = Math.min(zeroX, targetX);
        const bw = Math.max(2, Math.abs(targetX - zeroX));
        const by = startY + sIdx * (barH + 2);
        parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${s.color}"/>`);
        if (series.length === 1) {
          parts.push(`<text x="${(bx + bw + 5).toFixed(1)}" y="${(by + barH / 2 + 3.5).toFixed(1)}" font-size="10" font-weight="600" fill="#334155">${escapeXml(formatCompactNumber(val))}</text>`);
        }
      });
    });
  } else {
    const ticks = 5;
    for (let t = 0; t <= ticks; t++) {
      const ratio = t / ticks;
      const y = plotTop + plotH - ratio * plotH;
      const val = yMin + ratio * yRange;
      parts.push(`<line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${plotLeft + plotW}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="${t === 0 ? 'none' : '3,3'}"/>`);
      parts.push(`<text x="${plotLeft - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${escapeXml(formatCompactNumber(val))}</text>`);
    }

    const zeroY = plotTop + plotH - ((0 - yMin) / yRange) * plotH;
    const colBand = plotW / Math.max(labels.length, 1);

    labels.forEach((lbl, idx) => {
      const cx = plotLeft + idx * colBand + colBand / 2;
      const shortLbl = lbl.length > 13 ? `${lbl.slice(0, 12)}…` : lbl;
      parts.push(`<text x="${cx.toFixed(1)}" y="${plotTop + plotH + 18}" text-anchor="middle" font-size="10.5" fill="#334155">${escapeXml(shortLbl)}</text>`);
    });

    if (chartType === 'column') {
      const barW = Math.min(34, Math.max(8, (colBand * 0.68) / Math.max(series.length, 1)));
      labels.forEach((_, idx) => {
        const groupW = barW * series.length + (series.length - 1) * 3;
        const startX = plotLeft + idx * colBand + (colBand - groupW) / 2;
        series.forEach((s, sIdx) => {
          const val = s.values[idx] ?? 0;
          const targetY = plotTop + plotH - ((val - yMin) / yRange) * plotH;
          const by = Math.min(zeroY, targetY);
          const bh = Math.max(2, Math.abs(zeroY - targetY));
          const bx = startX + sIdx * (barW + 3);
          parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${s.color}"/>`);
          if (series.length <= 2 && labels.length <= 8) {
            parts.push(`<text x="${(bx + barW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#334155">${escapeXml(formatCompactNumber(val))}</text>`);
          }
        });
      });
    } else {
      series.forEach((s) => {
        const pts = labels.map((_, idx) => {
          const x = plotLeft + idx * colBand + colBand / 2;
          const val = s.values[idx] ?? 0;
          const y = plotTop + plotH - ((val - yMin) / yRange) * plotH;
          return { x, y, val };
        });
        if (pts.length === 0) return;
        if (chartType === 'area') {
          const areaPath = [
            `M ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)}`,
            ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
            `L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} Z`,
          ].join(' ');
          parts.push(`<path d="${areaPath}" fill="${s.color}" fill-opacity="0.16"/>`);
        }
        const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        parts.push(`<path d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`);
        pts.forEach((p) => {
          parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="${s.color}" stroke-width="2.4"/>`);
          if (series.length === 1 && labels.length <= 10) {
            parts.push(`<text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#334155">${escapeXml(formatCompactNumber(p.val))}</text>`);
          }
        });
      });
    }
  }

  const legTotalW = series.reduce((sum, s) => sum + s.name.length * 7 + 34, 0);
  let lx = Math.max(24, (width - legTotalW) / 2);
  const ly = height - 12;
  series.forEach((s) => {
    parts.push(`<rect x="${lx.toFixed(1)}" y="${ly - 9}" width="10" height="10" rx="2.5" fill="${s.color}"/>`);
    parts.push(`<text x="${(lx + 15).toFixed(1)}" y="${ly}" font-size="11" font-weight="600" fill="#334155">${escapeXml(s.name)}</text>`);
    lx += s.name.length * 7 + 34;
  });

  parts.push('</svg>');
  return parts.join('');
};

export const renderChartPngDataUrl = (
  dataset: ChartDataset,
  chartType: ChartType,
  title: string,
  width = 680,
  height = 380
): Promise<string> =>
  new Promise((resolve, reject) => {
    const svg = renderChartSvg(dataset, chartType, title, width, height);
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new window.Image();
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize chart SVG'));
    };
    img.src = url;
  });

export const extractTableRecords = (rawGrid: unknown[][]): { headers: string[]; rows: unknown[][] } => {
  const nonEmpty = rawGrid.filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  let headerIdx = 0;
  for (let i = 0; i < Math.min(3, nonEmpty.length); i++) {
    const filled = nonEmpty[i].filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (filled >= 2) {
      headerIdx = i;
      break;
    }
  }
  const colCount = Math.max(...nonEmpty.slice(headerIdx).map((r) => r.length));
  const headers: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const raw = String(nonEmpty[headerIdx]?.[c] ?? '').trim();
    headers.push(raw || `Cột ${colIndexToLetter(c)}`);
  }
  const rows = nonEmpty
    .slice(headerIdx + 1)
    .filter((r) => !isSummaryRow(r));
  return { headers, rows };
};

const computeAgg = (nums: number[], countAll: number, aggFn: PivotAggFn): number => {
  if (aggFn === 'COUNT') return countAll;
  if (nums.length === 0) return 0;
  if (aggFn === 'SUM') return nums.reduce((a, b) => a + b, 0);
  if (aggFn === 'AVERAGE') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (aggFn === 'MAX') return Math.max(...nums);
  return Math.min(...nums);
};

export const buildPivotSheetData = (
  sheetName: string,
  headers: string[],
  rows: unknown[][],
  config: { rowField: number; colField: number; valueField: number; aggFn: PivotAggFn }
): { sheet: SheetData; styles: Record<string, CellStyle>; rowGroupCount: number } => {
  const { rowField, colField, valueField, aggFn } = config;
  const rowKeys: string[] = [];
  const rowSet = new Set<string>();
  const colKeys: string[] = [];
  const colSet = new Set<string>();

  type Bucket = { nums: number[]; count: number };
  const buckets = new Map<string, Bucket>();

  rows.forEach((r) => {
    const rk = String(r[rowField] ?? '').trim() || '(Trống)';
    const ck = colField >= 0 ? String(r[colField] ?? '').trim() || '(Trống)' : '__ALL__';
    if (!rowSet.has(rk)) {
      rowSet.add(rk);
      rowKeys.push(rk);
    }
    if (colField >= 0 && !colSet.has(ck)) {
      colSet.add(ck);
      colKeys.push(ck);
    }
    const key = `${rk}|||${ck}`;
    let b = buckets.get(key);
    if (!b) {
      b = { nums: [], count: 0 };
      buckets.set(key, b);
    }
    const vRaw = r[valueField];
    if (vRaw !== null && vRaw !== undefined && String(vRaw).trim() !== '') {
      b.count += 1;
      const num = coerceNumeric(vRaw);
      if (num !== null) b.nums.push(num);
    }
  });

  const activeCols = colField >= 0 ? colKeys : ['__ALL__'];
  const sheet = emptySheet(sheetName, Math.max(100, rowKeys.length + 20), Math.max(20, activeCols.length + 6));
  const styles: Record<string, CellStyle> = {
    pvTitle: { bl: 1, fs: 14, cl: { rgb: '#065f46' } },
    pvSub: { fs: 10, it: 1, cl: { rgb: '#64748b' } },
    pvHead: { bl: 1, bg: { rgb: '#107c41' }, cl: { rgb: '#ffffff' }, ht: 2, vt: 2 },
    pvRowLbl: { bl: 1, cl: { rgb: '#0f172a' } },
    pvNum: { n: { pattern: aggFn === 'COUNT' ? '#,##0' : '#,##0.##' }, ht: 3 },
    pvStripeNum: { bg: { rgb: '#f8fafc' }, n: { pattern: aggFn === 'COUNT' ? '#,##0' : '#,##0.##' }, ht: 3 },
    pvStripeLbl: { bg: { rgb: '#f8fafc' }, bl: 1, cl: { rgb: '#0f172a' } },
    pvTotalLbl: { bl: 1, bg: { rgb: '#dcfce7' }, cl: { rgb: '#065f46' } },
    pvTotalNum: { bl: 1, bg: { rgb: '#dcfce7' }, cl: { rgb: '#065f46' }, n: { pattern: aggFn === 'COUNT' ? '#,##0' : '#,##0.##' }, ht: 3 },
  };

  const rowHeaderName = headers[rowField] || 'Nhóm';
  const valHeaderName = headers[valueField] || 'Giá trị';
  const totalCols = colField >= 0 ? activeCols.length + 2 : 2;

  sheet.cellData[0] = {
    0: { v: `BÁO CÁO PIVOT: ${aggFn}(${valHeaderName}) THEO ${rowHeaderName.toUpperCase()}`, t: 1, s: 'pvTitle' },
  };
  sheet.cellData[1] = {
    0: { v: `Tổng hợp từ ${rows.length} dòng dữ liệu · Tạo tự động bởi Minh Sheets`, t: 1, s: 'pvSub' },
  };
  sheet.mergeData.push({ startRow: 0, endRow: 0, startColumn: 0, endColumn: Math.max(1, totalCols - 1) });
  sheet.mergeData.push({ startRow: 1, endRow: 1, startColumn: 0, endColumn: Math.max(1, totalCols - 1) });

  const headerRow: Record<number, CellValue> = {
    0: { v: rowHeaderName, t: 1, s: 'pvHead' },
  };
  if (colField >= 0) {
    activeCols.forEach((ck, idx) => {
      headerRow[idx + 1] = { v: ck, t: 1, s: 'pvHead' };
    });
    headerRow[activeCols.length + 1] = { v: `Tổng (${aggFn})`, t: 1, s: 'pvHead' };
  } else {
    headerRow[1] = { v: `${aggFn} - ${valHeaderName}`, t: 1, s: 'pvHead' };
  }
  sheet.cellData[3] = headerRow;
  sheet.rowData[0] = { h: 32 };
  sheet.rowData[3] = { h: 30 };

  const allNumsByCol: Bucket[] = activeCols.map(() => ({ nums: [], count: 0 }));
  const grandBucket: Bucket = { nums: [], count: 0 };

  rowKeys.forEach((rk, rIdx) => {
    const gridRow = rIdx + 4;
    const isStripe = rIdx % 2 === 1;
    const rowBucket: Bucket = { nums: [], count: 0 };
    const rowCells: Record<number, CellValue> = {
      0: { v: rk, t: 1, s: isStripe ? 'pvStripeLbl' : 'pvRowLbl' },
    };

    activeCols.forEach((ck, cIdx) => {
      const b = buckets.get(`${rk}|||${ck}`) ?? { nums: [], count: 0 };
      const val = computeAgg(b.nums, b.count, aggFn);
      rowCells[cIdx + 1] = { v: Math.round(val * 100) / 100, t: 2, s: isStripe ? 'pvStripeNum' : 'pvNum' };
      rowBucket.nums.push(...b.nums);
      rowBucket.count += b.count;
      allNumsByCol[cIdx].nums.push(...b.nums);
      allNumsByCol[cIdx].count += b.count;
      grandBucket.nums.push(...b.nums);
      grandBucket.count += b.count;
    });

    if (colField >= 0) {
      const rowTotal = computeAgg(rowBucket.nums, rowBucket.count, aggFn);
      rowCells[activeCols.length + 1] = {
        v: Math.round(rowTotal * 100) / 100,
        t: 2,
        s: isStripe ? 'pvStripeNum' : 'pvNum',
      };
    }

    sheet.cellData[gridRow] = rowCells;
  });

  const totalGridRow = rowKeys.length + 4;
  const totalCells: Record<number, CellValue> = {
    0: { v: 'Tổng cộng (Grand Total)', t: 1, s: 'pvTotalLbl' },
  };
  activeCols.forEach((_, cIdx) => {
    const colVal = computeAgg(allNumsByCol[cIdx].nums, allNumsByCol[cIdx].count, aggFn);
    totalCells[cIdx + 1] = { v: Math.round(colVal * 100) / 100, t: 2, s: 'pvTotalNum' };
  });
  if (colField >= 0) {
    const grandVal = computeAgg(grandBucket.nums, grandBucket.count, aggFn);
    totalCells[activeCols.length + 1] = { v: Math.round(grandVal * 100) / 100, t: 2, s: 'pvTotalNum' };
  }
  sheet.cellData[totalGridRow] = totalCells;

  sheet.columnData[0] = { w: 210 };
  for (let c = 1; c < totalCols; c++) {
    sheet.columnData[c] = { w: 145 };
  }
  sheet.freeze = { xSplit: 0, ySplit: 4, startRow: 4, startColumn: 0 };

  return { sheet, styles, rowGroupCount: rowKeys.length };
};

const ERROR_TOKENS = new Set(['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#N/A', '#NUM!', '#NULL!', '#ERROR!', '#CYCLE!']);

export const analyzeSheetData = (
  sheetName: string,
  rawGrid: unknown[][],
  formulasGrid: (string | null | undefined)[][],
  startRow = 0,
  startCol = 0
): SheetAnalysisResult => {
  let nonEmptyCells = 0;
  let numericCells = 0;
  let textCells = 0;
  let formulaCells = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const errorCells: SheetAnalysisResult['errorCells'] = [];
  const trailingSpaceCells: SheetAnalysisResult['trailingSpaceCells'] = [];
  const numericTextCells: SheetAnalysisResult['numericTextCells'] = [];
  const rowSignatures = new Set<string>();
  let duplicateRowCount = 0;

  const rowCount = rawGrid.length;
  const colCount = Math.max(0, ...rawGrid.map((r) => r.length));

  for (let r = 0; r < rowCount; r++) {
    const rowVals = rawGrid[r] ?? [];
    const nonBlankInRow: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const val = rowVals[c];
      const formula = formulasGrid[r]?.[c] ?? undefined;
      const absR = startRow + r;
      const absC = startCol + c;
      const a1 = formatA1Cell(absR, absC);

      if (formula) formulaCells += 1;
      if (val === null || val === undefined || val === '') continue;

      nonEmptyCells += 1;
      nonBlankInRow.push(String(val).trim());

      if (typeof val === 'string') {
        if (ERROR_TOKENS.has(val.trim().toUpperCase())) {
          errorCells.push({ a1, row: absR, col: absC, error: val.trim(), formula });
          continue;
        }
        if (val !== val.trim() || /\s{2,}/.test(val)) {
          trailingSpaceCells.push({ a1, row: absR, col: absC, value: val });
        }
        const parsed = coerceNumeric(val);
        if (parsed !== null && !formula && /^-?\d+([.,]\d+)?$/.test(val.trim())) {
          numericTextCells.push({ a1, row: absR, col: absC, value: val, parsed });
        }
        textCells += 1;
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        numericCells += 1;
        sum += val;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    if (nonBlankInRow.length >= 2) {
      const sig = JSON.stringify(rowVals.map((v) => (v === null || v === undefined ? '' : String(v).trim())));
      if (rowSignatures.has(sig)) duplicateRowCount += 1;
      else rowSignatures.add(sig);
    }
  }

  const { headers, rows: cleanRows } = extractTableRecords(rawGrid);
  const columnSummaries: SheetColumnSummary[] = [];
  for (let c = 0; c < headers.length; c++) {
    const nums: Array<{ label: string; value: number }> = [];
    cleanRows.forEach((r, idx) => {
      const n = coerceNumeric(r[c]);
      if (n !== null) {
        const textCandidate = r
          .slice(0, 4)
          .map((cell) => String(cell ?? '').trim())
          .find((s) => s && s !== '-' && coerceNumeric(s) === null);
        const lbl = textCandidate || String(r[0] ?? `Dòng ${idx + 1}`).trim() || `Dòng ${idx + 1}`;
        nums.push({ label: lbl, value: n });
      }
    });
    if (nums.length >= 2) {
      const colSum = nums.reduce((acc, item) => acc + item.value, 0);
      const colMin = Math.min(...nums.map((i) => i.value));
      const colMax = Math.max(...nums.map((i) => i.value));
      const topItem = nums.reduce((best, cur) => (cur.value > best.value ? cur : best), nums[0]);
      columnSummaries.push({
        colIndex: startCol + c,
        colLetter: colIndexToLetter(startCol + c),
        header: headers[c],
        count: nums.length,
        sum: colSum,
        avg: colSum / nums.length,
        min: colMin,
        max: colMax,
        topLabel: topItem.label,
        topValue: topItem.value,
      });
    }
  }

  return {
    sheetName,
    nonEmptyCells,
    numericCells,
    textCells,
    formulaCells,
    sum,
    avg: numericCells > 0 ? sum / numericCells : 0,
    min: numericCells > 0 ? min : 0,
    max: numericCells > 0 ? max : 0,
    errorCells,
    trailingSpaceCells,
    numericTextCells,
    duplicateRowCount,
    columnSummaries,
  };
};

export const answerSpreadsheetPrompt = (
  prompt: string,
  analysis: SheetAnalysisResult,
  activeRangeA1: string
): string => {
  const q = prompt.toLowerCase();
  const lines: string[] = [];

  if (q.includes('xlookup') || q.includes('vlookup') || q.includes('tra cứu')) {
    lines.push(`GỢI Ý CÔNG THỨC TRA CỨU CHO "${analysis.sheetName}":`);
    lines.push(`• XLOOKUP hai chiều (khuyên dùng): =XLOOKUP(A3, A3:A20, E3:E20, "Không tìm thấy", 0)`);
    lines.push(`• INDEX + MATCH linh hoạt: =IFERROR(INDEX(E3:E20, MATCH(A3, A3:A20, 0)), 0)`);
    lines.push(`• Vùng đang chọn hiện tại: ${activeRangeA1}`);
    return lines.join('\n');
  }

  if (q.includes('sumif') || q.includes('điều kiện') || q.includes('lọc tổng')) {
    const colA = analysis.columnSummaries[0]?.colLetter ?? 'B';
    lines.push(`CÔNG THỨC TÍNH TỔNG / ĐẾM THEO ĐIỀU KIỆN:`);
    lines.push(`• Tổng 1 điều kiện: =SUMIF(A3:A20, "Nhân sự", ${colA}3:${colA}20)`);
    lines.push(`• Tổng đa điều kiện: =SUMIFS(${colA}3:${colA}20, A3:A20, "<>Tổng cộng", ${colA}3:${colA}20, ">0")`);
    lines.push(`• Đếm theo trạng thái: =COUNTIF(J3:J20, "Hoàn thành")`);
    return lines.join('\n');
  }

  if (q.includes('lỗi') || q.includes('error') || q.includes('kiểm toán') || q.includes('chất lượng')) {
    lines.push(`BÁO CÁO KIỂM TOÁN DỮ LIỆU "${analysis.sheetName}":`);
    lines.push(`• Ô lỗi công thức: ${analysis.errorCells.length} ô${analysis.errorCells.length ? ` (${analysis.errorCells.slice(0, 5).map((e) => `${e.a1}: ${e.error}`).join(', ')})` : ' (An toàn)'}`);
    lines.push(`• Ô dư khoảng trắng: ${analysis.trailingSpaceCells.length} ô`);
    lines.push(`• Ô số lưu dạng chuỗi (Text Number): ${analysis.numericTextCells.length} ô`);
    lines.push(`• Dòng trùng lặp: ${analysis.duplicateRowCount} dòng`);
    lines.push(`• Khuyến nghị: Dùng nút "Sửa lỗi tự động" trong tab Review hoặc bọc =IFERROR(công_thức, 0).`);
    return lines.join('\n');
  }

  lines.push(`PHÂN TÍCH DỮ LIỆU THỰC TẾ — SHEET "${analysis.sheetName}":`);
  lines.push(`• Quy mô: ${analysis.nonEmptyCells} ô có dữ liệu (${analysis.numericCells} ô số, ${analysis.formulaCells} công thức).`);
  if (analysis.columnSummaries.length > 0) {
    analysis.columnSummaries.slice(0, 4).forEach((col) => {
      lines.push(
        `• Cột "${col.header}" (${col.colLetter}): Tổng = ${col.sum.toLocaleString('en-US')} | TB = ${Math.round(col.avg).toLocaleString('en-US')} | Cao nhất: ${col.topLabel} (${col.topValue.toLocaleString('en-US')})`
      );
    });
  } else {
    lines.push(`• Tổng cộng các ô số: ${analysis.sum.toLocaleString('en-US')} | Trung bình: ${Math.round(analysis.avg).toLocaleString('en-US')}`);
  }
  if (analysis.errorCells.length > 0) {
    lines.push(`• Cảnh báo: Phát hiện ${analysis.errorCells.length} ô lỗi công thức tại ${analysis.errorCells.map((e) => e.a1).join(', ')}.`);
  } else {
    lines.push(`• Độ toàn vẹn công thức: 100% không có lỗi (#REF!, #DIV/0!, #VALUE!).`);
  }
  return lines.join('\n');
};
