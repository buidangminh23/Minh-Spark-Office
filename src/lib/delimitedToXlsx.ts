import { DELIMITER_NAME, inferDelimitedCell, type DelimitedCell, type DelimitedTable } from './delimitedTable';

const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 60;
const WIDTH_PADDING = 5;
const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 20;
const LINE = { style: 'thin' as const, color: { argb: 'FFB4C0D3' } };
const HEADER_LINE = { style: 'thin' as const, color: { argb: 'FF8EA9CC' } };
const BODY_BORDER = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const HEADER_BORDER = { top: HEADER_LINE, bottom: HEADER_LINE, left: HEADER_LINE, right: HEADER_LINE };
const HEADER_FILL = 'FF1F4E79';
const TABLE_STYLE = 'TableStyleMedium2';

type TypedTable = { header: string[]; body: DelimitedCell[][]; generatedHeader: boolean };

const cellText = (cell: DelimitedCell) => {
  if (cell.kind === 'text') return cell.value;
  if (cell.kind === 'boolean') return cell.value ? 'TRUE' : 'FALSE';
  if (cell.kind === 'date') return cell.format;
  return cell.format ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(cell.value) + (cell.format.endsWith('%') ? '%' : '') : String(cell.value);
};

const longestLine = (text: string) => text.split(/\r\n|\r|\n/).reduce((max, line) => Math.max(max, [...line].length), 0);

function uniqueHeaders(row: string[], columns: number) {
  const used = new Map<string, number>();
  return Array.from({ length: columns }, (_, index) => {
    const base = (row[index] ?? '').replace(/\s+/g, ' ').trim() || `Cột ${index + 1}`;
    const key = base.toLowerCase();
    const count = (used.get(key) ?? 0) + 1;
    used.set(key, count);
    return count > 1 ? `${base} (${count})` : base;
  });
}

function looksLikeHeader(first: string[], typedFirst: DelimitedCell[]) {
  const filled = first.filter((cell) => cell.trim());
  return filled.length > 0 && typedFirst.every((cell) => cell.kind === 'text');
}

function typeTable(table: DelimitedTable): TypedTable {
  const typed = table.rows.map((row) => Array.from({ length: table.columns }, (_, index) => inferDelimitedCell(row[index] ?? '', table.delimiter)));
  if (typed.length > 1 && looksLikeHeader(table.rows[0], typed[0])) return { header: uniqueHeaders(table.rows[0], table.columns), body: typed.slice(1), generatedHeader: false };
  return { header: uniqueHeaders([], table.columns), body: typed, generatedHeader: true };
}

function columnWidths(table: TypedTable) {
  return table.header.map((title, column) => {
    let widest = longestLine(title) + 2;
    for (const row of table.body) widest = Math.max(widest, longestLine(cellText(row[column])));
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, widest + WIDTH_PADDING));
  });
}

const excelValue = (cell: DelimitedCell) => (cell.kind === 'text' ? (cell.value === '' ? null : cell.value) : cell.value);

const sheetName = (base: string) => base.replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Dữ liệu';

export async function delimitedToXlsx(source: DelimitedTable, base: string): Promise<{ blob: Blob; warnings: string[] }> {
  const { default: ExcelJS } = await import('exceljs');
  const table = typeTable(source);
  const widths = columnWidths(table);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Office 23';
  const worksheet = workbook.addWorksheet(sheetName(base), { views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }] });
  worksheet.addTable({
    name: 'BangDuLieu',
    ref: 'A1',
    headerRow: true,
    style: { theme: TABLE_STYLE, showRowStripes: true },
    columns: table.header.map((name) => ({ name, filterButton: true })),
    rows: table.body.length ? table.body.map((row) => row.map(excelValue)) : [table.header.map(() => null)],
  });
  widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  const header = worksheet.getRow(1);
  header.height = HEADER_HEIGHT;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  table.header.forEach((_, column) => {
    const cell = header.getCell(column + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = HEADER_BORDER;
  });
  const bodyRows = Math.max(table.body.length, 1);
  for (let rowIndex = 0; rowIndex < bodyRows; rowIndex++) {
    const row = worksheet.getRow(rowIndex + 2);
    const cells = table.header.map((_, column) => table.body[rowIndex]?.[column] ?? ({ kind: 'text', value: '' } as DelimitedCell));
    const wraps = cells.map((cell, column) => cell.kind === 'text' && (longestLine(cell.value) + WIDTH_PADDING > widths[column] || /[\r\n]/.test(cell.value)));
    if (!wraps.some(Boolean)) row.height = ROW_HEIGHT;
    cells.forEach((cell, column) => {
      const target = row.getCell(column + 1);
      target.border = BODY_BORDER;
      if ((cell.kind === 'number' || cell.kind === 'date') && cell.format) target.numFmt = cell.format;
      target.alignment = { horizontal: cell.kind === 'text' ? 'left' : cell.kind === 'boolean' ? 'center' : 'right', vertical: wraps[column] ? 'top' : 'middle', indent: cell.kind === 'boolean' ? 0 : 1, wrapText: wraps[column] };
    });
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const warnings = [`Đã tách ${table.body.length.toLocaleString('vi-VN')} dòng × ${table.header.length} cột theo ${DELIMITER_NAME[source.delimiter] ?? `“${source.delimiter}”`}, bảng mã ${source.encoding}. Dòng tiêu đề được cố định, mỗi cột có nút lọc và độ rộng tự căn theo nội dung.`];
  if (table.generatedHeader) warnings.push('Tệp không có dòng tiêu đề nên các cột được đặt tên Cột 1, Cột 2…');
  if (table.body.some((row) => row.some((cell) => cell.kind === 'text' && /^[-+]?0\d|^\d{16,}$/.test(cell.value.trim())))) warnings.push('Mã có số 0 ở đầu hoặc dãy số dài hơn 15 chữ số được giữ nguyên dạng chữ để không mất số.');
  return { blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), warnings };
}
