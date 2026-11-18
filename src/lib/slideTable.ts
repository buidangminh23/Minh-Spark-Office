import type { SlideElement, SlideTableCellStyle } from './slideTypes';

export function tableFractions(sizes: number[] | undefined, count: number): number[] | undefined {
  if (!sizes?.length || !count) return undefined;
  const weights = Array.from({ length: count }, (_, index) => sizes[index] ?? sizes[sizes.length - 1]);
  if (!weights.every((value) => Number.isFinite(value) && value > 0)) return undefined;
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

export function tableCellStyle(table: SlideElement, row: number, column: number): SlideTableCellStyle {
  const header = row === 0 && table.tableHeaderRow;
  return {
    fill: header ? table.tableHeaderColor || '#D83B01' : row % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
    color: header ? table.tableHeaderTextColor || '#FFFFFF' : '#1E293B',
    bold: Boolean(header),
    align: 'center',
    verticalAlign: 'middle',
    ...table.tableCellStyles?.[row]?.[column],
  };
}

export function updateTableHeader(table: SlideElement, changes: Pick<SlideElement, 'tableHeaderRow' | 'tableHeaderColor' | 'tableHeaderTextColor'>): Partial<SlideElement> {
  const styles = table.tableCellStyles;
  if (!styles?.[0]) return changes;
  const headerStyles = styles[0].map((cell) => {
    const next = { ...cell };
    if (changes.tableHeaderRow !== undefined || changes.tableHeaderColor) delete next.fill;
    if (changes.tableHeaderRow !== undefined || changes.tableHeaderTextColor) delete next.color;
    if (changes.tableHeaderRow !== undefined) delete next.bold;
    return next;
  });
  return { ...changes, tableCellStyles: [headerStyles, ...styles.slice(1)] };
}

export function resizeTable(table: SlideElement, data: string[][]): Partial<SlideElement> {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const styles = table.tableCellStyles;
  const size = (values: number[] | undefined, count: number) => values?.length ? Array.from({ length: count }, (_, index) => values[Math.min(index, values.length - 1)]) : undefined;
  return {
    tableData: data, tableRows: rows, tableCols: cols,
    ...(styles?.length ? { tableCellStyles: data.map((row, index) => {
      const bodyStart = table.tableHeaderRow ? 1 : 0;
      const template = styles[index] ?? (styles.length > bodyStart + 1 ? styles[styles.length - 2 + (index - styles.length) % 2] : styles[bodyStart]);
      return row.map((_, column) => ({ ...(template?.[column] ?? template?.at(-1)) }));
    }) } : {}),
    ...(table.tableRowHeights ? { tableRowHeights: size(table.tableRowHeights, rows) } : {}),
    ...(table.tableColumnWidths ? { tableColumnWidths: size(table.tableColumnWidths, cols) } : {}),
  };
}
