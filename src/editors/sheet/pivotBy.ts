export type PivotCell = string | number | boolean | null;

export const PIVOT_AGGREGATORS = ['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'MEDIAN', 'PRODUCT'] as const;
export type PivotAggregator = (typeof PIVOT_AGGREGATORS)[number];

export interface PivotByOptions {
  rowFields: PivotCell[][];
  colFields: PivotCell[][];
  values: PivotCell[];
  aggregator: PivotAggregator;
  hasHeaders?: boolean;
  showHeaders?: boolean;
  rowTotal?: number;
  colTotal?: number;
  rowSort?: number;
  colSort?: number;
  filter?: PivotCell[] | null;
}

export const PIVOT_TOTAL_LABEL = 'Total';
const KEY_SEPARATOR = '\u0001';

export function isPivotAggregator(name: string): name is PivotAggregator {
  return (PIVOT_AGGREGATORS as readonly string[]).includes(name);
}

const numbersOf = (cells: PivotCell[]) => cells.filter((cell): cell is number => typeof cell === 'number');

export function aggregate(aggregator: PivotAggregator, cells: PivotCell[]): PivotCell {
  const numbers = numbersOf(cells);
  switch (aggregator) {
    case 'SUM':
      return numbers.reduce((total, value) => total + value, 0);
    case 'COUNT':
      return numbers.length;
    case 'COUNTA':
      return cells.filter((cell) => cell !== null && cell !== '').length;
    case 'PRODUCT':
      return numbers.reduce((total, value) => total * value, 1);
    case 'AVERAGE':
      return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : null;
    case 'MIN':
      return numbers.length ? Math.min(...numbers) : 0;
    case 'MAX':
      return numbers.length ? Math.max(...numbers) : 0;
    case 'MEDIAN': {
      if (!numbers.length) return null;
      const sorted = [...numbers].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }
  }
}

const typeRank = (cell: PivotCell) => (typeof cell === 'number' ? 0 : typeof cell === 'string' ? 1 : typeof cell === 'boolean' ? 2 : 3);

export function compareCells(a: PivotCell, b: PivotCell): number {
  const rank = typeRank(a) - typeRank(b);
  if (rank !== 0) return rank;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true });
  return Number(a) - Number(b);
}

interface KeyGroup {
  key: PivotCell[];
  rows: number[];
}

function groupKeys(fields: PivotCell[][], rowIndexes: number[], sortOrder: number): KeyGroup[] {
  const groups = new Map<string, KeyGroup>();
  for (const index of rowIndexes) {
    const key = fields[index] ?? [];
    const id = key.map((cell) => `${typeof cell}:${String(cell)}`).join(KEY_SEPARATOR);
    const group = groups.get(id);
    if (group) group.rows.push(index);
    else groups.set(id, { key, rows: [index] });
  }
  const direction = sortOrder < 0 ? -1 : 1;
  return [...groups.values()].sort((left, right) => {
    for (let column = 0; column < left.key.length; column++) {
      const result = compareCells(left.key[column], right.key[column]);
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}

const isTruthy = (cell: PivotCell) => cell === true || (typeof cell === 'number' && cell !== 0);

export function pivotBy(options: PivotByOptions): PivotCell[][] | null {
  const { aggregator, hasHeaders = false, showHeaders = false, rowTotal = 1, colTotal = 1, rowSort = 1, colSort = 1, filter = null } = options;
  const total = options.values.length;
  if (options.rowFields.length !== total || options.colFields.length !== total) return null;
  if (filter && filter.length !== total) return null;
  const firstData = hasHeaders ? 1 : 0;
  const rowWidth = options.rowFields[0]?.length ?? 0;
  const colDepth = options.colFields[0]?.length ?? 0;
  if (total <= firstData || rowWidth === 0 || colDepth === 0) return null;

  const indexes: number[] = [];
  for (let index = firstData; index < total; index++) {
    if (!filter || isTruthy(filter[index])) indexes.push(index);
  }
  const rowGroups = groupKeys(options.rowFields, indexes, rowSort);
  const colGroups = groupKeys(options.colFields, indexes, colSort);
  const valuesAt = (rows: number[]) => rows.map((row) => options.values[row]);
  const blank = (cell: PivotCell) => (cell === null ? '' : cell);
  const withRowTotal = rowTotal !== 0;
  const withColTotal = colTotal !== 0;

  const output: PivotCell[][] = [];
  for (let level = 0; level < colDepth; level++) {
    const isLastLevel = level === colDepth - 1;
    const corner = Array.from({ length: rowWidth }, (_, column) =>
      showHeaders && hasHeaders && isLastLevel ? blank(options.rowFields[0][column]) : ''
    );
    const header: PivotCell[] = [...corner, ...colGroups.map((group) => blank(group.key[level]))];
    if (withColTotal) header.push(level === 0 ? PIVOT_TOTAL_LABEL : '');
    output.push(header);
  }

  const body: PivotCell[][] = rowGroups.map((rowGroup) => {
    const members = new Set(rowGroup.rows);
    const line: PivotCell[] = rowGroup.key.map(blank);
    for (const colGroup of colGroups) {
      const shared = colGroup.rows.filter((row) => members.has(row));
      line.push(shared.length ? blank(aggregate(aggregator, valuesAt(shared))) : '');
    }
    if (withColTotal) line.push(blank(aggregate(aggregator, valuesAt(rowGroup.rows))));
    return line;
  });

  const totalLine: PivotCell[] = Array.from({ length: rowWidth }, (_, column) => (column === 0 ? PIVOT_TOTAL_LABEL : ''));
  for (const colGroup of colGroups) totalLine.push(blank(aggregate(aggregator, valuesAt(colGroup.rows))));
  if (withColTotal) totalLine.push(blank(aggregate(aggregator, valuesAt(indexes))));

  if (withRowTotal && rowTotal < 0) output.push(totalLine);
  output.push(...body);
  if (withRowTotal && rowTotal > 0) output.push(totalLine);
  return output;
}

export const WEBSERVICE_MAX_URL_LENGTH = 2048;
export const WEBSERVICE_MAX_RESPONSE_LENGTH = 32767;

export function isWebServiceUrl(url: string): boolean {
  if (url.length === 0 || url.length > WEBSERVICE_MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
