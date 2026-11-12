import type { ChartKind } from '../doc/insertCharts';
import { proofreadText } from '../doc/docTools';
export { expandHeaderFooter, type HeaderFooterContext } from '../../lib/print/headerFooter';

export const CALC_RESULT_MUTATION = 'formula.mutation.set-formula-calculation-result';
export type CalcMode = 'automatic' | 'manual';

const PLACEHOLDER_CATEGORY = 'Mục';
const MIN_ZOOM = 10;
const MAX_ZOOM = 400;

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).replace(/[\t\r\n]+/g, ' ').trim();
};

const isNumeric = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || !value.trim()) return false;
  return Number.isFinite(Number(value.replace(/[\s,%]/g, '')));
};

const trimEmptyEdges = (values: unknown[][]): unknown[][] => {
  const rows = values.filter((row) => row.some((cell) => cellText(cell) !== ''));
  if (!rows.length) return [];
  const width = Math.max(...rows.map((row) => row.length));
  let last = width - 1;
  while (last > 0 && rows.every((row) => cellText(row[last]) === '')) last--;
  return rows.map((row) => Array.from({ length: last + 1 }, (_, i) => row[i] ?? null));
};

export function valuesToChartRaw(values: unknown[][]): string {
  const rows = trimEmptyEdges(values);
  return rows
    .map((row, index) => {
      const cells = row.map(cellText);
      if (!cells[0]) cells[0] = index === 0 ? PLACEHOLDER_CATEGORY : `${PLACEHOLDER_CATEGORY} ${index}`;
      return cells.join('\t');
    })
    .join('\n');
}

export function recommendChartKinds(values: unknown[][]): ChartKind[] {
  const rows = trimEmptyEdges(values);
  if (!rows.length) return ['column', 'line', 'pie'];
  const header = rows[0].slice(1).every((cell) => !isNumeric(cell)) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;
  const seriesCount = Math.max(1, (rows[0]?.length ?? 1) - 1);
  const categoriesNumeric = body.length > 0 && body.every((row) => isNumeric(row[0]));
  const categoriesDates = body.length > 0 && body.every((row) => /^\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?$|^(19|20)\d{2}$|^(T|Tháng|Q|Quý)\s?\d+/i.test(cellText(row[0])));
  const allPositive = body.every((row) => row.slice(1).every((cell) => !isNumeric(cell) || Number(cellText(cell).replace(/,/g, '')) >= 0));
  const picks: ChartKind[] = [];
  if (categoriesNumeric) picks.push('scatter', 'scatter-line');
  if (categoriesDates) picks.push('line', 'area');
  if (seriesCount === 1 && allPositive && body.length <= 8) picks.push('pie', 'doughnut');
  if (seriesCount >= 2) picks.push('column', 'column-stacked', 'combo');
  if (seriesCount === 4 && /mở|open/i.test(cellText(header?.[1]))) picks.unshift('stock');
  picks.push('column', 'bar', 'line');
  if (seriesCount === 1 && !allPositive) picks.push('waterfall');
  return [...new Set(picks)].slice(0, 6);
}

export type PivotAgg = 'sum' | 'count' | 'average' | 'max' | 'min';

const aggregate = (items: number[], agg: PivotAgg): number => {
  if (agg === 'count') return items.length;
  if (!items.length) return 0;
  if (agg === 'max') return Math.max(...items);
  if (agg === 'min') return Math.min(...items);
  const sum = items.reduce((total, value) => total + value, 0);
  return agg === 'average' ? sum / items.length : sum;
};

export function pivotChartRaw(values: unknown[][], categoryColumn: number, valueColumns: number[], agg: PivotAgg): string {
  const rows = trimEmptyEdges(values);
  if (rows.length < 2) return '';
  const [header, ...body] = rows;
  const groups = new Map<string, number[][]>();
  for (const row of body) {
    const key = cellText(row[categoryColumn]) || '(Trống)';
    const bucket = groups.get(key) ?? valueColumns.map(() => []);
    valueColumns.forEach((column, i) => {
      if (isNumeric(row[column])) bucket[i].push(Number(cellText(row[column]).replace(/,/g, '')));
    });
    groups.set(key, bucket);
  }
  const headLine = [cellText(header[categoryColumn]) || PLACEHOLDER_CATEGORY, ...valueColumns.map((column) => cellText(header[column]) || `Cột ${column + 1}`)];
  const lines = [...groups.entries()].map(([key, buckets]) => [key, ...buckets.map((bucket) => String(Math.round(aggregate(bucket, agg) * 1e6) / 1e6))]);
  return [headLine, ...lines].map((line) => line.join('\t')).join('\n');
}

export type SpellingIssue = { a1: string; row: number; column: number; text: string; message: string; suggestion: string | null; fixed: string | null };

export function spellingIssuesForCells(cells: { a1: string; row: number; column: number; text: string }[]): SpellingIssue[] {
  const issues: SpellingIssue[] = [];
  for (const cell of cells) {
    if (!/\p{L}/u.test(cell.text) || cell.text.startsWith('=')) continue;
    for (const issue of proofreadText(cell.text)) {
      const fixed = issue.suggestion === null ? null : cell.text.slice(0, issue.start) + issue.suggestion + cell.text.slice(issue.start + issue.length);
      issues.push({ a1: cell.a1, row: cell.row, column: cell.column, text: issue.text, message: issue.message, suggestion: issue.suggestion, fixed });
    }
  }
  return issues;
}

export const ERROR_VALUES = ['#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!', '#REF!', '#VALUE!', '#SPILL!', '#CALC!', '#GETTING_DATA'] as const;

export type ErrorCheckKind = 'error-value' | 'number-as-text' | 'inconsistent-formula' | 'empty-reference' | 'unlocked-formula';
export type ErrorCheckIssue = { a1: string; row: number; column: number; kind: ErrorCheckKind; message: string; formula: string | null };
export type ErrorCheckCell = { row: number; column: number; a1: string; value: unknown; formula: string | null };

const ERROR_HELP: Record<string, string> = {
  '#DIV/0!': 'Chia cho 0 hoặc ô trống',
  '#N/A': 'Giá trị không tìm thấy (thường do VLOOKUP/MATCH/XLOOKUP)',
  '#NAME?': 'Tên hàm hoặc tên vùng không tồn tại',
  '#NULL!': 'Hai vùng không giao nhau',
  '#NUM!': 'Số không hợp lệ hoặc vượt giới hạn',
  '#REF!': 'Tham chiếu tới ô đã bị xoá',
  '#VALUE!': 'Sai kiểu dữ liệu trong phép tính',
  '#SPILL!': 'Vùng tràn kết quả bị chặn',
  '#CALC!': 'Công thức mảng không tính được',
  '#GETTING_DATA': 'Đang chờ dữ liệu',
};

const normalizeFormulaShape = (formula: string, row: number, column: number): string =>
  formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_m, colAbs: string, letters: string, rowAbs: string, digits: string) => {
    const col = letters.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const colPart = colAbs ? `$${letters}` : `C[${col - column}]`;
    const rowPart = rowAbs ? `$${digits}` : `R[${Number(digits) - 1 - row}]`;
    return `${colPart}${rowPart}`;
  });

export function checkErrors(cells: ErrorCheckCell[]): ErrorCheckIssue[] {
  const issues: ErrorCheckIssue[] = [];
  const byKey = new Map(cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
  for (const cell of cells) {
    const text = typeof cell.value === 'string' ? cell.value.trim() : '';
    const errorValue = ERROR_VALUES.find((code) => text.toUpperCase() === code);
    if (errorValue) {
      issues.push({ a1: cell.a1, row: cell.row, column: cell.column, kind: 'error-value', message: `${errorValue}: ${ERROR_HELP[errorValue]}`, formula: cell.formula });
      continue;
    }
    if (!cell.formula && text && /^-?\d[\d.,]*$/.test(text) && Number.isFinite(Number(text.replace(/,/g, '')))) {
      issues.push({ a1: cell.a1, row: cell.row, column: cell.column, kind: 'number-as-text', message: 'Số được lưu dưới dạng văn bản', formula: null });
      continue;
    }
    if (!cell.formula) continue;
    const shape = normalizeFormulaShape(cell.formula, cell.row, cell.column);
    const neighbours = [byKey.get(`${cell.row - 1}:${cell.column}`), byKey.get(`${cell.row + 1}:${cell.column}`)].filter((n): n is ErrorCheckCell => !!n?.formula);
    if (neighbours.length === 2) {
      const [above, below] = neighbours.map((n) => normalizeFormulaShape(n.formula as string, n.row, n.column));
      if (above === below && above !== shape) {
        issues.push({ a1: cell.a1, row: cell.row, column: cell.column, kind: 'inconsistent-formula', message: 'Công thức khác với các ô liền kề trong cột', formula: cell.formula });
      }
    }
  }
  return issues;
}

export type FormulaStep = { label: string; expression: string };

const REF_PATTERN = /(?:'[^']+'|[A-Za-z_][\w.]*)?!?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?/g;

const formatStepValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const flat = value.flat();
    const shown = flat.slice(0, 6).map((v) => formatStepValue(v)).join(';');
    return `{${shown}${flat.length > 6 ? ';…' : ''}}`;
  }
  if (value === null || value === undefined || value === '') return '0';
  if (typeof value === 'string') return /^#/.test(value) ? value : `"${value}"`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
};

export function evaluateFormulaSteps(formula: string, resolve: (ref: string) => unknown, result: unknown): FormulaStep[] {
  const body = formula.startsWith('=') ? formula : `=${formula}`;
  const steps: FormulaStep[] = [{ label: 'Công thức gốc', expression: body }];
  const refs = [...new Set(body.replace(/"[^"]*"/g, (m) => ' '.repeat(m.length)).match(REF_PATTERN) ?? [])];
  let current = body;
  for (const ref of refs) {
    const replaced = current.split(ref).join(formatStepValue(resolve(ref)));
    if (replaced === current) continue;
    current = replaced;
    steps.push({ label: `Thay ${ref} bằng giá trị`, expression: current });
  }
  steps.push({ label: 'Kết quả', expression: formatStepValue(result) });
  return steps;
}

export function zoomToFit(content: { width: number; height: number }, viewport: { width: number; height: number }): number {
  if (content.width <= 0 || content.height <= 0) return 100;
  const ratio = Math.min(viewport.width / content.width, viewport.height / content.height);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(ratio * 100)));
}

export type Scenario = { id: string; name: string; comment: string; cells: { a1: string; value: string }[] };

export function scenarioSummary(scenarios: Scenario[], resultCells: string[], evaluate: (scenario: Scenario) => Record<string, unknown>): unknown[][] {
  const changing = [...new Set(scenarios.flatMap((scenario) => scenario.cells.map((cell) => cell.a1)))];
  const header = ['Tóm tắt kịch bản', ...scenarios.map((scenario) => scenario.name)];
  const changingRows = changing.map((a1) => [a1, ...scenarios.map((scenario) => scenario.cells.find((cell) => cell.a1 === a1)?.value ?? '')]);
  const results = scenarios.map(evaluate);
  const resultRows = resultCells.map((a1) => [a1, ...results.map((values) => values[a1] ?? '')]);
  return [header, ['Ô thay đổi:', ...scenarios.map(() => '')], ...changingRows, ['Ô kết quả:', ...scenarios.map(() => '')], ...resultRows];
}

export function parseHtmlTables(html: string): string[][][] {
  const decode = (text: string) =>
    text
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, ' ')
      .trim();
  const tables: string[][][] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((row) => (row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(decode));
    const filled = rows.filter((row) => row.some(Boolean));
    if (filled.length) tables.push(filled);
  }
  return tables;
}

export const coerceImportedCell = (text: string): string | number => {
  const trimmed = text.trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) return Number(trimmed.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) return Number(trimmed.replace(/,/g, ''));
  if (/^-?\d+([.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(',', '.'));
  return text;
};

export type CustomView = { id: string; name: string; sheetId: string; zoom: number; frozenRows: number; frozenColumns: number; hiddenRows: number[]; hiddenColumns: number[]; selection: string; showGridlines: boolean };

export function rangesFromIndexes(indexes: number[]): { start: number; count: number }[] {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const runs: { start: number; count: number }[] = [];
  for (const index of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.start + last.count === index) last.count++;
    else runs.push({ start: index, count: 1 });
  }
  return runs;
}

export const parseCsv = (text: string): string[][] => {
  const firstLine = text.split('\n')[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
};
