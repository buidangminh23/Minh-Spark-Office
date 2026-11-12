export type SheetShortcutAction =
  | 'goTo'
  | 'insertFunction'
  | 'recalculate'
  | 'saveAs'
  | 'newSheet'
  | 'editNote'
  | 'insertChart'
  | 'nameManager'
  | 'printPreview'
  | 'rowStart'
  | 'extendRowStart'
  | 'pageDown'
  | 'pageUp'
  | 'pageRight'
  | 'pageLeft'
  | 'gotoStart'
  | 'gotoEnd'
  | 'extendToStart'
  | 'extendToEnd'
  | 'nextSheet'
  | 'prevSheet'
  | 'selectRow'
  | 'selectColumn'
  | 'selectAll'
  | 'currentRegion'
  | 'showActiveCell'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'hideColumns'
  | 'unhideColumns'
  | 'unhideRows'
  | 'formatGeneral'
  | 'formatNumber'
  | 'formatTime'
  | 'formatDate'
  | 'formatCurrency'
  | 'formatPercent'
  | 'formatScientific'
  | 'borderOutline'
  | 'borderNone'
  | 'insertCells'
  | 'deleteCells'
  | 'insertTime'
  | 'copyFormulaAbove'
  | 'copyValueAbove'
  | 'pasteValues'
  | 'pasteSpecial'
  | 'toggleFormulaBar'
  | 'formatCells'
  | 'tracePrecedents'
  | 'traceDependents'
  | 'createTable'
  | 'redo'
  | 'groupSelection'
  | 'ungroupSelection'
  | 'zoomIn'
  | 'zoomOut';

export interface ShortcutKeyEvent {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

type Modifiers = '' | 'S' | 'A' | 'AS' | 'C' | 'CS' | 'CA' | 'CAS';

const BINDINGS: Record<string, SheetShortcutAction> = {
  ':F5': 'goTo',
  'S:F3': 'insertFunction',
  ':F3': 'nameManager',
  'C:F3': 'nameManager',
  ':F9': 'recalculate',
  'S:F9': 'recalculate',
  'CA:F9': 'recalculate',
  ':F12': 'saveAs',
  'S:F11': 'newSheet',
  'AS:F1': 'newSheet',
  'S:F2': 'editNote',
  ':F11': 'insertChart',
  'A:F1': 'insertChart',
  'C:F2': 'printPreview',
  ':Home': 'rowStart',
  'S:Home': 'extendRowStart',
  ':PageDown': 'pageDown',
  ':PageUp': 'pageUp',
  'A:PageDown': 'pageRight',
  'A:PageUp': 'pageLeft',
  'C:Home': 'gotoStart',
  'C:End': 'gotoEnd',
  'CS:Home': 'extendToStart',
  'CS:End': 'extendToEnd',
  'C:PageDown': 'nextSheet',
  'C:PageUp': 'prevSheet',
  'S:Space': 'selectRow',
  'C:Space': 'selectColumn',
  'CS:Space': 'selectAll',
  'CS:Digit8': 'currentRegion',
  'C:NumpadMultiply': 'currentRegion',
  'C:Backspace': 'showActiveCell',
  'C:Digit2': 'bold',
  'C:Digit3': 'italic',
  'C:Digit4': 'underline',
  'C:Digit5': 'strikethrough',
  'C:Digit0': 'hideColumns',
  'CS:Digit0': 'unhideColumns',
  'CS:Digit9': 'unhideRows',
  'CS:Backquote': 'formatGeneral',
  'CS:Digit1': 'formatNumber',
  'CS:Digit2': 'formatTime',
  'CS:Digit3': 'formatDate',
  'CS:Digit4': 'formatCurrency',
  'CS:Digit5': 'formatPercent',
  'CS:Digit6': 'formatScientific',
  'CS:Digit7': 'borderOutline',
  'CS:Minus': 'borderNone',
  'CS:Equal': 'insertCells',
  'C:NumpadAdd': 'insertCells',
  'C:Minus': 'deleteCells',
  'C:NumpadSubtract': 'deleteCells',
  'CS:Semicolon': 'insertTime',
  'C:Quote': 'copyFormulaAbove',
  'CS:Quote': 'copyValueAbove',
  'CS:KeyV': 'pasteValues',
  'CA:KeyV': 'pasteSpecial',
  'CS:KeyU': 'toggleFormulaBar',
  'CS:KeyF': 'formatCells',
  'C:BracketLeft': 'tracePrecedents',
  'C:BracketRight': 'traceDependents',
  'C:KeyT': 'createTable',
  'C:KeyL': 'createTable',
  'CS:KeyZ': 'redo',
  'AS:ArrowRight': 'groupSelection',
  'AS:ArrowLeft': 'ungroupSelection',
  'CA:Equal': 'zoomIn',
  'CA:Minus': 'zoomOut',
};

function modifiersOf(event: ShortcutKeyEvent): Modifiers {
  const ctrl = event.ctrlKey || event.metaKey ? 'C' : '';
  const alt = event.altKey ? 'A' : '';
  const shift = event.shiftKey ? 'S' : '';
  return `${ctrl}${alt}${shift}` as Modifiers;
}

export function resolveSheetShortcut(event: ShortcutKeyEvent): SheetShortcutAction | null {
  return BINDINGS[`${modifiersOf(event)}:${event.code}`] ?? null;
}

export const EXCEL_NUMBER_FORMATS = {
  formatGeneral: 'General',
  formatNumber: '#,##0.00',
  formatTime: 'h:mm AM/PM',
  formatDate: 'dd-mmm-yy',
  formatCurrency: '#,##0 ₫',
  formatPercent: '0%',
  formatScientific: '0.00E+00',
} as const;

export type NumberFormatAction = keyof typeof EXCEL_NUMBER_FORMATS;

export function isNumberFormatAction(action: SheetShortcutAction): action is NumberFormatAction {
  return action in EXCEL_NUMBER_FORMATS;
}

export const PAGE_ROW_STEP = 20;
export const PAGE_COLUMN_STEP = 10;
export const ZOOM_STEP_PCT = 10;

export function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(max - 1, index));
}

export interface CellBox {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export type StructureScope = 'rows' | 'columns' | 'cells';

export function structureScope(box: CellBox, maxRows: number, maxColumns: number): StructureScope {
  const fullRow = box.startColumn === 0 && box.endColumn >= maxColumns - 1;
  const fullColumn = box.startRow === 0 && box.endRow >= maxRows - 1;
  if (fullRow && !fullColumn) return 'rows';
  if (fullColumn && !fullRow) return 'columns';
  return 'cells';
}

export function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const SHEET_SHORTCUT_HELP: Array<[keys: string, description: string]> = [
  ['Ctrl + S / F12', 'Lưu bảng tính / Lưu thành tệp .xlsx về máy'],
  ['Ctrl + Z / Ctrl + Y / Ctrl + Shift + Z', 'Hoàn tác / Làm lại'],
  ['Ctrl + C / X / V', 'Sao chép / Cắt / Dán'],
  ['Ctrl + Shift + V / Ctrl + Alt + V', 'Dán chỉ giá trị / Dán đặc biệt'],
  ['Ctrl + B / I / U (hoặc Ctrl + 2 / 3 / 4)', 'In đậm / In nghiêng / Gạch chân'],
  ['Ctrl + 5', 'Gạch ngang chữ'],
  ['Ctrl + 1 / Ctrl + Shift + F', 'Mở hộp thoại Định dạng ô (Format Cells)'],
  ['Ctrl + Shift + ~', 'Định dạng số General'],
  ['Ctrl + Shift + 1 / 2 / 3', 'Định dạng Số có 2 chữ số thập phân / Giờ / Ngày'],
  ['Ctrl + Shift + 4 / 5 / 6', 'Định dạng Tiền tệ / Phần trăm / Khoa học'],
  ['Ctrl + Shift + 7 / Ctrl + Shift + -', 'Kẻ viền ngoài / Xoá viền'],
  ['Ctrl + Home / Ctrl + End', 'Về ô A1 / Tới ô cuối vùng dữ liệu'],
  ['Home / Shift + Home', 'Về đầu hàng / Chọn tới đầu hàng'],
  ['Ctrl + Shift + Home / End', 'Mở rộng vùng chọn tới A1 / tới ô cuối dữ liệu'],
  ['Ctrl + mũi tên / Ctrl + Shift + mũi tên', 'Nhảy / Chọn tới mép vùng dữ liệu'],
  ['Page Down / Page Up', 'Xuống / Lên một trang màn hình'],
  ['Alt + Page Down / Alt + Page Up', 'Sang phải / Sang trái một trang màn hình'],
  ['Ctrl + Page Down / Ctrl + Page Up', 'Sang trang tính kế tiếp / trước đó'],
  ['Shift + Space / Ctrl + Space', 'Chọn cả hàng / Chọn cả cột'],
  ['Ctrl + A / Ctrl + Shift + Space', 'Chọn toàn bộ trang tính'],
  ['Ctrl + Shift + 8', 'Chọn vùng dữ liệu hiện tại quanh ô đang chọn'],
  ['Ctrl + Backspace', 'Cuộn tới ô đang chọn'],
  ['Ctrl + Shift + = / Ctrl + -', 'Chèn / Xoá ô, hàng hoặc cột đang chọn'],
  ['Ctrl + 9 / Ctrl + Shift + 9', 'Ẩn hàng / Hiện lại hàng'],
  ['Ctrl + 0 / Ctrl + Shift + 0', 'Ẩn cột / Hiện lại cột'],
  ['Alt + Shift + → / Alt + Shift + ←', 'Nhóm / Bỏ nhóm hàng hoặc cột đang chọn (Group / Ungroup)'],
  ['Ctrl + D / Ctrl + R', 'Điền xuống dưới / Điền sang phải'],
  ['Ctrl + E', 'Flash Fill: tự điền theo mẫu'],
  ["Ctrl + ' / Ctrl + Shift + '", 'Chép công thức / Chép giá trị của ô phía trên'],
  ['Ctrl + ; / Ctrl + Shift + ;', 'Chèn ngày hôm nay / Chèn giờ hiện tại'],
  ['Alt + = / Shift + F3', 'AutoSum / Mở danh sách hàm (Insert Function)'],
  ['F2 / F4', 'Sửa ô đang chọn / Đổi kiểu tham chiếu $ hoặc lặp lại thao tác'],
  ['F9', 'Tính lại toàn bộ công thức'],
  ['Ctrl + `', 'Bật/tắt hiển thị công thức'],
  ['Ctrl + [ / Ctrl + ]', 'Dò ô tiền đề / Dò ô phụ thuộc'],
  ['F3 / Ctrl + F3', 'Mở Trình quản lý tên (Name Manager)'],
  ['Ctrl + F / Ctrl + H', 'Tìm kiếm / Thay thế'],
  ['Ctrl + G / F5', 'Đi tới ô hoặc vùng đã đặt tên (Go To)'],
  ['Ctrl + K', 'Chèn liên kết'],
  ['Ctrl + T / Ctrl + L', 'Định dạng vùng chọn thành Bảng (Table)'],
  ['Ctrl + Shift + L', 'Bật/tắt bộ lọc'],
  ['Shift + F2', 'Thêm hoặc sửa ghi chú của ô'],
  ['F11 / Alt + F1', 'Chèn biểu đồ'],
  ['Shift + F11 / Alt + Shift + F1', 'Thêm trang tính mới'],
  ['Ctrl + P / Ctrl + F2', 'In / Xem trước trang in'],
  ['Ctrl + Shift + U', 'Ẩn/hiện thanh công thức'],
  ['Ctrl + Shift + W', 'Bật/tắt Watch Window'],
  ['Ctrl + Alt + = / Ctrl + Alt + -', 'Phóng to / Thu nhỏ'],
  ['Enter / Shift + Enter / Tab / Shift + Tab', 'Xác nhận và di chuyển xuống / lên / phải / trái'],
  ['Alt + Enter', 'Xuống dòng trong cùng một ô'],
  ['Delete / Backspace', 'Xoá nội dung ô đang chọn'],
  ['Esc', 'Huỷ thao tác đang nhập'],
];
