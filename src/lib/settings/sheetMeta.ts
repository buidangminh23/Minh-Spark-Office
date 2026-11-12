import type { SheetQatCommand, SheetTab } from './sheetDefaults';

export const SHEET_TAB_LABELS: ReadonlyArray<readonly [SheetTab, string]> = [
  ['home', 'Home (Trang đầu)'],
  ['insert', 'Insert (Chèn)'],
  ['draw', 'Draw (Vẽ)'],
  ['page_layout', 'Page Layout (Bố cục trang)'],
  ['formulas', 'Formulas (Công thức)'],
  ['data', 'Data (Dữ liệu)'],
  ['review', 'Review (Xem lại)'],
  ['view', 'View (Xem)'],
  ['automate', 'Automate (Tự động hoá)'],
  ['help', 'Help (Trợ giúp)'],
];

export const SHEET_QAT_LABELS: Record<SheetQatCommand, string> = {
  save: 'Lưu',
  undo: 'Hoàn tác',
  redo: 'Làm lại',
  print: 'In & PDF',
  find: 'Tìm & thay thế',
  sortAsc: 'Sắp xếp A → Z',
  sortDesc: 'Sắp xếp Z → A',
  filter: 'Bật/tắt Lọc',
  freeze: 'Cố định khung',
  formatPainter: 'Sao chép định dạng',
  exportXlsx: 'Xuất .xlsx',
  history: 'Lịch sử phiên bản',
};
