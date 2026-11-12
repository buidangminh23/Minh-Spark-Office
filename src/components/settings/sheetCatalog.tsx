import { CornerDownLeft, Eye, FilePlus2, FunctionSquare, Keyboard, PanelTop, PenLine, Sigma, Table2 } from 'lucide-react';
import type { SettingCategory } from './types';
import { CommandListEditor, TabsPicker } from './panels';
import { SHEET_QAT_LABELS, SHEET_TAB_LABELS } from '../../lib/settings/sheetMeta';

const ICON = 22;
const REOPEN_HINT = 'Áp dụng khi mở lại bảng tính.';

export const SHEET_CATEGORIES: SettingCategory[] = [
  {
    id: 'sheet-formulas',
    group: 'sheet',
    title: 'Công thức',
    description: 'Cách Minh Sheets hỗ trợ khi gõ công thức.',
    icon: <Sigma size={20} />,
    sections: [
      {
        id: 'sheet-formula-work',
        title: 'Làm việc với công thức',
        description: 'Gợi ý hàm và chú thích tham số trong ô và thanh công thức.',
        icon: <FunctionSquare size={ICON} />,
        options: [
          {
            kind: 'toggle',
            key: 'sheetFormulaAutoComplete',
            label: 'Gợi ý hàm khi gõ công thức (Formula AutoComplete)',
            hint: 'Gõ dấu = rồi vài chữ cái để hiện danh sách hàm khớp và chú thích tham số của hàm đang gõ.',
          },
        ],
      },
    ],
  },
  {
    id: 'sheet-editing',
    group: 'sheet',
    title: 'Soạn thảo',
    description: 'Hành vi khi nhập dữ liệu vào ô.',
    icon: <PenLine size={20} />,
    sections: [
      {
        id: 'sheet-enter',
        title: 'Phím Enter',
        description: 'Vùng chọn đi đâu sau khi nhấn Enter.',
        icon: <CornerDownLeft size={ICON} />,
        options: [
          { kind: 'toggle', key: 'sheetEnterMove', label: 'Sau khi nhấn Enter, di chuyển vùng chọn' },
          {
            kind: 'select',
            key: 'sheetEnterDirection',
            label: 'Hướng',
            hint: 'Shift+Enter đi theo hướng ngược lại.',
            options: [['down', 'Xuống'], ['right', 'Sang phải'], ['up', 'Lên'], ['left', 'Sang trái']],
            disabledWhen: (s) => !s.sheetEnterMove,
          },
        ],
      },
      {
        id: 'sheet-autofill',
        title: 'Tự động khi nhập',
        description: 'Những việc Minh Sheets tự làm sau khi gõ xong một ô.',
        icon: <PenLine size={ICON} />,
        options: [
          {
            kind: 'toggle',
            key: 'sheetValueAutoComplete',
            label: 'Bật Tự động hoàn tất giá trị ô (AutoComplete)',
            hint: 'Gõ vài chữ đầu của một giá trị đã có trong cột, nhấn Enter để điền đủ.',
          },
          {
            kind: 'toggle',
            key: 'sheetHeaderAutoFormat',
            label: 'Tự in đậm và cố định dòng tiêu đề',
            hint: 'Khi gõ dòng dữ liệu đầu tiên dưới một hàng tiêu đề, hàng đó được in đậm và cố định.',
          },
        ],
      },
    ],
  },
  {
    id: 'sheet-display',
    group: 'sheet',
    title: 'Hiển thị',
    description: 'Các thành phần hiện trong cửa sổ Minh Sheets.',
    icon: <Eye size={20} />,
    sections: [
      {
        id: 'sheet-window',
        title: 'Hiển thị cửa sổ',
        description: 'Cũng bật/tắt được ở tab View.',
        icon: <PanelTop size={ICON} />,
        options: [
          { kind: 'toggle', key: 'sheetShowFormulaBar', label: 'Hiện thanh công thức' },
          { kind: 'toggle', key: 'sheetShowStatusBar', label: 'Hiện thanh trạng thái' },
        ],
      },
      {
        id: 'sheet-workbook-display',
        title: 'Hiển thị cho bảng tính',
        description: REOPEN_HINT,
        icon: <Table2 size={ICON} />,
        options: [
          { kind: 'toggle', key: 'sheetShowSheetTabs', label: 'Hiện tab trang tính', hint: REOPEN_HINT },
          { kind: 'toggle', key: 'sheetShowHScroll', label: 'Hiện thanh cuộn ngang', hint: REOPEN_HINT },
          { kind: 'toggle', key: 'sheetShowVScroll', label: 'Hiện thanh cuộn dọc', hint: REOPEN_HINT },
        ],
      },
    ],
  },
  {
    id: 'sheet-new',
    group: 'sheet',
    title: 'Bảng tính mới',
    description: 'Mặc định khi tạo bảng tính trắng.',
    icon: <FilePlus2 size={20} />,
    sections: [
      {
        id: 'sheet-new-workbook',
        title: 'Khi tạo bảng tính mới',
        description: 'Áp dụng cho bảng tính trắng vừa tạo và nút Tạo trắng ở tab File.',
        icon: <FilePlus2 size={ICON} />,
        options: [
          { kind: 'number', key: 'sheetNewSheetCount', label: 'Số trang tính', min: 1, max: 255, suffix: 'trang tính' },
        ],
      },
    ],
  },
  {
    id: 'sheet-ribbon',
    group: 'sheet',
    title: 'Tuỳ chỉnh Ribbon',
    description: 'Chọn các tab hiện trên ribbon của Minh Sheets.',
    icon: <PanelTop size={20} />,
    sections: [
      {
        id: 'sheet-tabs',
        title: 'Các tab chính',
        description: 'Bỏ chọn để ẩn tab khỏi ribbon. Tab File luôn hiện.',
        icon: <PanelTop size={ICON} />,
        options: [
          {
            kind: 'custom',
            id: 'sheet-tabs',
            label: 'Tab trên ribbon',
            keywords: 'home insert draw page layout formulas data review view automate help chèn vẽ công thức dữ liệu',
            render: () => <TabsPicker settingKey="sheetTabs" tabs={SHEET_TAB_LABELS} locked="home" />,
          },
        ],
      },
    ],
  },
  {
    id: 'sheet-qat',
    group: 'sheet',
    title: 'Thanh truy cập nhanh',
    description: 'Các lệnh dùng nhiều, luôn nằm cạnh ribbon của Minh Sheets.',
    icon: <Keyboard size={20} />,
    sections: [
      {
        id: 'sheet-qat',
        title: 'Thanh truy cập nhanh',
        description: 'Chọn lệnh, thứ tự và vị trí của thanh.',
        icon: <Keyboard size={ICON} />,
        options: [
          { kind: 'toggle', key: 'sheetQatShow', label: 'Hiện thanh truy cập nhanh' },
          { kind: 'segmented', key: 'sheetQatPosition', label: 'Vị trí', options: [['above', 'Trên ribbon'], ['below', 'Dưới ribbon']], disabledWhen: (s) => !s.sheetQatShow },
          {
            kind: 'custom',
            id: 'sheet-qat-commands',
            label: 'Lệnh trên thanh',
            keywords: 'hoàn tác làm lại in lưu sắp xếp lọc tìm',
            render: () => <CommandListEditor settingKey="sheetQatCommands" labels={SHEET_QAT_LABELS} resetKeys={['sheetQatCommands', 'sheetQatPosition', 'sheetQatShow']} />,
          },
        ],
      },
    ],
  },
];
