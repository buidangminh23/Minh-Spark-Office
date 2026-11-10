export type ColorStyle = { rgb?: string };
export type BorderSide = { s: number; cl?: ColorStyle };

export type CellStyle = {
  ff?: string;
  fs?: number;
  it?: number;
  bl?: number;
  ul?: { s?: number };
  st?: { s?: number };
  va?: number;
  cl?: ColorStyle;
  bg?: ColorStyle;
  ht?: number;
  vt?: number;
  tb?: number;
  tr?: { a?: number };
  bd?: { t?: BorderSide | null; b?: BorderSide | null; l?: BorderSide | null; r?: BorderSide | null };
  n?: { pattern: string } | null;
};

export type CellValue = {
  v?: string | number | boolean | null;
  f?: string;
  t?: number;
  s?: string | CellStyle | null;
  p?: { body?: { dataStream?: string } };
};

export type SheetData = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  tabColor?: string;
  hidden?: number;
  cellData: Record<number, Record<number, CellValue>>;
  rowData: Record<number, { h?: number; hd?: number }>;
  columnData: Record<number, { w?: number; hd?: number }>;
  mergeData: { startRow: number; endRow: number; startColumn: number; endColumn: number }[];
  freeze?: { xSplit: number; ySplit: number; startRow: number; startColumn: number };
  showGridlines?: number;
  zoomRatio?: number;
};

export type ImportTruncation = { sheet: string; rows: number; columns: number; keptRows: number; keptColumns: number };

export type WorkbookData = {
  id: string;
  name: string;
  appVersion: string;
  locale: string;
  styles: Record<string, CellStyle>;
  sheetOrder: string[];
  sheets: Record<string, SheetData>;
  resources?: unknown[];
  importTruncation?: ImportTruncation[];
};
