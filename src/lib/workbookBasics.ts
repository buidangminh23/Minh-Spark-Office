import type { SheetData, WorkbookData } from './sheetTypes';

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export const columnLetter = (index: number) => {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
};

export function emptySheet(name: string, rows = 1000, columns = 26): SheetData {
  return {
    id: uid('sheet'),
    name,
    rowCount: rows,
    columnCount: columns,
    defaultColumnWidth: 96,
    defaultRowHeight: 24,
    cellData: {},
    rowData: {},
    columnData: {},
    mergeData: [],
    showGridlines: 1,
  };
}

export function emptyWorkbook(name: string): WorkbookData {
  const sheet = emptySheet('Trang tính 1');
  return {
    id: uid('wb'),
    name,
    appVersion: '0.1.0',
    locale: 'viVN',
    styles: {},
    sheetOrder: [sheet.id],
    sheets: { [sheet.id]: sheet },
  };
}
