import { Eye, FilePlus2, Grid3x3, Keyboard, MousePointer2, PanelTop, Pencil, Presentation, Type, Undo2 } from 'lucide-react';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { SLIDE_FONT_SIZES, SLIDE_FONTS, SLIDE_QAT_LABELS, SLIDE_RIBBON_TABS } from '../../lib/settings/slideOptions';
import { CommandListEditor, TabsPicker } from './panels';
import type { SettingCategory } from './types';

const ICON = 22;

const FONT_CHOICES: ReadonlyArray<readonly [string, string]> = [['', 'Theo phông chữ của chủ đề'], ...SLIDE_FONTS.map((font) => [font, font] as const)];
const SIZE_CHOICES: ReadonlyArray<readonly [number, string]> = SLIDE_FONT_SIZES.map((size) => [size, `${size} pt`] as const);
const THEME_CHOICES: ReadonlyArray<readonly [string, string]> = Object.values(SLIDE_THEMES).map((theme) => [theme.id, theme.name] as const);

export const SLIDE_CATEGORIES: SettingCategory[] = [
  {
    id: 'slide-view',
    group: 'slide',
    title: 'Hiển thị',
    description: 'Thước, lưới, đường dẫn và khung nhìn của Minh Slides.',
    icon: <Eye size={20} />,
    sections: [
      {
        id: 'grid',
        title: 'Thước, lưới và đường dẫn',
        description: 'Hiện các công cụ căn chỉnh trên trang chiếu đang soạn.',
        icon: <Grid3x3 size={ICON} />,
        options: [
          { kind: 'toggle', key: 'slideRuler', label: 'Hiện thước kẻ', hint: 'Thước ngang và dọc quanh trang chiếu ở chế độ Thường.' },
          { kind: 'toggle', key: 'slideGridlines', label: 'Hiện đường lưới' },
          { kind: 'toggle', key: 'slideGuides', label: 'Hiện đường dẫn giữa trang', hint: 'Hai đường chữ thập đánh dấu tâm trang chiếu.' },
          { kind: 'select', key: 'slideGridSize', label: 'Khoảng cách lưới', options: [[10, 'Nhỏ (10 px)'], [20, 'Vừa (20 px)'], [40, 'Lớn (40 px)']] },
          { kind: 'toggle', key: 'slideSnapToGrid', label: 'Bắt dính đối tượng vào lưới', hint: 'Khi kéo hoặc đổi cỡ, cạnh đối tượng tự khớp vào lưới. Giữ Alt để tạm bỏ bắt dính.' },
          { kind: 'toggle', key: 'slideSmartGuides', label: 'Hiện đường dẫn thông minh khi căn đối tượng', hint: 'Đường xanh và bắt dính khi đối tượng nằm giữa trang chiếu.' },
        ],
      },
      {
        id: 'open-view',
        title: 'Khung nhìn',
        description: 'Cách bản trình bày hiện ra khi mở.',
        icon: <PanelTop size={ICON} />,
        options: [
          { kind: 'segmented', key: 'slideOpenView', label: 'Mở bản trình bày ở chế độ', hint: 'Áp dụng khi mở bản trình bày tiếp theo.', options: [['normal', 'Thường'], ['sorter', 'Sắp xếp trang chiếu']] },
          { kind: 'select', key: 'slideZoom', label: 'Thu phóng mặc định', options: [[0, 'Vừa cửa sổ'], [50, '50%'], [75, '75%'], [100, '100%'], [125, '125%'], [150, '150%']] },
          { kind: 'toggle', key: 'slideNotes', label: 'Hiện ngăn ghi chú dưới trang chiếu' },
        ],
      },
    ],
  },
  {
    id: 'slide-editing',
    group: 'slide',
    title: 'Soạn thảo',
    description: 'Văn bản mới, soát chính tả và hoàn tác trong Minh Slides.',
    icon: <Pencil size={20} />,
    sections: [
      {
        id: 'text',
        title: 'Hộp văn bản mới',
        description: 'Phông và cỡ chữ của hộp văn bản chèn từ ribbon.',
        icon: <Type size={ICON} />,
        options: [
          { kind: 'select', key: 'slideTextFont', label: 'Phông chữ mặc định', options: FONT_CHOICES },
          { kind: 'select', key: 'slideTextSize', label: 'Cỡ chữ mặc định', options: SIZE_CHOICES },
          { kind: 'toggle', key: 'slideSpellcheck', label: 'Kiểm tra chính tả khi gõ', hint: 'Gạch chân từ sai khi sửa chữ trên trang chiếu. Áp dụng từ lần sửa chữ tiếp theo.' },
        ],
      },
      {
        id: 'undo',
        title: 'Hoàn tác',
        description: 'Số bước có thể quay lại bằng Ctrl+Z.',
        icon: <Undo2 size={ICON} />,
        options: [{ kind: 'number', key: 'slideMaxUndo', label: 'Số bước hoàn tác tối đa', min: 3, max: 150, suffix: 'bước' }],
      },
    ],
  },
  {
    id: 'slide-new',
    group: 'slide',
    title: 'Bản trình bày mới',
    description: 'Khổ trang và chủ đề của bản trình bày trống.',
    icon: <FilePlus2 size={20} />,
    sections: [
      {
        id: 'blank',
        title: 'Bản trình bày trống',
        description: 'Áp dụng khi tạo bản trình bày trống mới.',
        icon: <FilePlus2 size={ICON} />,
        options: [
          { kind: 'segmented', key: 'slideNewAspect', label: 'Kích thước trang chiếu', options: [['16:9', 'Màn hình rộng (16:9)'], ['4:3', 'Chuẩn (4:3)']] },
          { kind: 'select', key: 'slideNewTheme', label: 'Chủ đề', options: THEME_CHOICES },
        ],
      },
    ],
  },
  {
    id: 'slide-show',
    group: 'slide',
    title: 'Trình chiếu',
    description: 'Cách trình chiếu chạy và các công cụ trỏ.',
    icon: <Presentation size={20} />,
    sections: [
      {
        id: 'show',
        title: 'Khi trình chiếu',
        description: 'Áp dụng ngay, kể cả khi đang trình chiếu.',
        icon: <Presentation size={ICON} />,
        options: [
          { kind: 'toggle', key: 'slideShowToolbar', label: 'Hiện thanh công cụ trình chiếu', hint: 'Thanh nút ở cạnh dưới màn hình trình chiếu. Phím tắt vẫn dùng được khi ẩn.' },
          { kind: 'toggle', key: 'slideRightClickMenu', label: 'Hiện menu khi bấm chuột phải' },
          { kind: 'toggle', key: 'slideEndWithBlack', label: 'Kết thúc bằng trang chiếu đen', hint: 'Sau trang cuối hiện màn hình đen; bấm thêm một lần để thoát.' },
          { kind: 'toggle', key: 'slideLoop', label: 'Lặp lại liên tục cho tới khi nhấn Esc', hint: 'Sau trang cuối quay về trang đầu.' },
          { kind: 'toggle', key: 'slidePresenterView', label: 'Dùng chế độ Diễn giả', hint: 'Mỗi lần bắt đầu trình chiếu sẽ mở thẳng chế độ Diễn giả.' },
        ],
      },
      {
        id: 'pointer',
        title: 'Công cụ trỏ',
        description: 'Màu bút trỏ laser (L) và bút vẽ (P) khi trình chiếu.',
        icon: <MousePointer2 size={ICON} />,
        options: [
          { kind: 'select', key: 'slideLaserColor', label: 'Màu bút trỏ laser', options: [['red', 'Đỏ'], ['green', 'Xanh lá'], ['blue', 'Xanh dương']] },
          { kind: 'select', key: 'slidePenColor', label: 'Màu bút vẽ', options: [['red', 'Đỏ'], ['blue', 'Xanh dương'], ['green', 'Xanh lá'], ['black', 'Đen'], ['yellow', 'Vàng']] },
        ],
      },
    ],
  },
  {
    id: 'slide-ribbon',
    group: 'slide',
    title: 'Tuỳ chỉnh Ribbon',
    description: 'Chọn các tab hiện trên ribbon của Minh Slides.',
    icon: <PanelTop size={20} />,
    sections: [
      {
        id: 'tabs',
        title: 'Các tab chính',
        description: 'Bỏ chọn để ẩn tab khỏi ribbon. Tab Tệp và tab ngữ cảnh luôn hiện.',
        icon: <PanelTop size={ICON} />,
        options: [{ kind: 'custom', id: 'slide-tabs', label: 'Tab trên ribbon', keywords: 'trang đầu chèn vẽ thiết kế chuyển tiếp hoạt hình trình chiếu xem lại xem', render: () => <TabsPicker settingKey="slideTabs" tabs={SLIDE_RIBBON_TABS} locked="home" /> }],
      },
    ],
  },
  {
    id: 'slide-qat',
    group: 'slide',
    title: 'Thanh truy cập nhanh',
    description: 'Các lệnh dùng nhiều của Minh Slides.',
    icon: <Keyboard size={20} />,
    sections: [
      {
        id: 'qat',
        title: 'Thanh truy cập nhanh',
        description: 'Chọn lệnh, thứ tự và vị trí của thanh.',
        icon: <Keyboard size={ICON} />,
        options: [
          { kind: 'toggle', key: 'slideQatShow', label: 'Hiện thanh truy cập nhanh' },
          { kind: 'segmented', key: 'slideQatPosition', label: 'Vị trí', options: [['above', 'Trên ribbon'], ['below', 'Dưới ribbon']], disabledWhen: (s) => !s.slideQatShow },
          { kind: 'custom', id: 'slide-qat-commands', label: 'Lệnh trên thanh', keywords: 'lưu hoàn tác làm lại trình chiếu trang mới văn bản tìm in pptx ghi chú', render: () => <CommandListEditor settingKey="slideQatCommands" labels={SLIDE_QAT_LABELS} resetKeys={['slideQatCommands', 'slideQatPosition', 'slideQatShow']} /> },
        ],
      },
    ],
  },
];
