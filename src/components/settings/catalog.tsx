import {
  Accessibility, AlignJustify, CheckCheck, CircleHelp, Cloud, Code2, Eye, Info, Keyboard, Languages, LayoutPanelTop, Monitor,
  PanelTop, RefreshCw, Save, Settings2, ShieldCheck, SlidersHorizontal, SpellCheck2, Type, UserRound, Wrench,
} from 'lucide-react';
import type { SettingCategory, SettingOption } from './types';
import { SHEET_CATEGORIES } from './sheetCatalog';
import { SLIDE_CATEGORIES } from './slideCatalog';
import {
  AboutPanel, AccountPanel, AppsPicker, AutoCorrectList, BackupPanel, DefaultAppsPanel,
  DocTabsPicker, FontPicker, HelpPanel, LanguagePanel, QatEditor, ResetPanel, UpdatePanel,
} from './panels';
import { ThemePicker } from './AppearancePicker';

const ICON = 22;

const BASE_CATEGORIES: SettingCategory[] = [
  {
    id: 'general',
    group: 'general',
    title: 'Chung',
    description: 'Tuỳ chọn chung khi làm việc với Office 23.',
    icon: <Settings2 size={20} />,
    sections: [
      {
        id: 'appearance',
        title: 'Giao diện',
        description: 'Kiểu giao diện, màu riêng và mật độ hiển thị.',
        icon: <Monitor size={ICON} />,
        options: [
          { kind: 'custom', id: 'theme', label: 'Kiểu giao diện', keywords: 'chủ đề sáng tối hệ thống dark light office 2007 2010 2013 2016 2019 màu nhấn màu riêng bánh xe màu theme', render: () => <ThemePicker /> },
          { kind: 'segmented', key: 'density', label: 'Mật độ giao diện', options: [['comfortable', 'Thoải mái'], ['normal', 'Bình thường'], ['compact', 'Gọn']] },
        ],
      },
      {
        id: 'ui',
        title: 'Tuỳ chọn giao diện người dùng',
        description: 'Thanh công cụ, ribbon và chú giải khi rê chuột.',
        icon: <PanelTop size={ICON} />,
        options: [
          { kind: 'toggle', key: 'miniToolbar', label: 'Hiện thanh công cụ mini khi chọn văn bản', hint: 'Thanh định dạng nhỏ hiện ngay trên đoạn chữ đang bôi đen (23 Docs).' },
          { kind: 'toggle', key: 'collapseRibbon', label: 'Tự thu gọn ribbon khi mở tài liệu', hint: 'Chỉ hiện tên các tab; bấm vào tab để mở nhóm lệnh.' },
          { kind: 'select', key: 'tooltips', label: 'Kiểu chú giải nút', options: [['full', 'Hiện mô tả tính năng'], ['short', 'Chỉ hiện tên nút'], ['none', 'Không hiện chú giải']] },
          { kind: 'toggle', key: 'tooltipShortcuts', label: 'Hiện phím tắt trong chú giải', disabledWhen: (s) => s.tooltips === 'none' },
        ],
      },
      {
        id: 'personal',
        title: 'Cá nhân hoá bản Office của bạn',
        description: 'Tên dùng cho nhận xét, theo dõi thay đổi và thuộc tính tài liệu.',
        icon: <UserRound size={ICON} />,
        options: [
          { kind: 'text', key: 'userName', label: 'Tên người dùng', placeholder: 'Lấy từ tài khoản Google', maxLength: 60 },
          { kind: 'text', key: 'initials', label: 'Viết tắt', placeholder: 'VD: MS', maxLength: 6 },
          { kind: 'toggle', key: 'alwaysUseName', label: 'Luôn dùng tên này kể cả khi đã đăng nhập' },
        ],
      },
      {
        id: 'startup',
        title: 'Khởi động & màn hình chính',
        description: 'Những gì hiện ra khi mở ứng dụng.',
        icon: <LayoutPanelTop size={ICON} />,
        options: [
          { kind: 'select', key: 'startup', label: 'Khi mở ứng dụng', options: [['home', 'Hiện màn hình chính'], ['lastDocument', 'Mở lại tài liệu gần nhất'], ['newDoc', 'Mở một văn bản trống']] },
          { kind: 'number', key: 'recentCount', label: 'Số tài liệu gần đây trên màn hình chính', min: 1, max: 30, suffix: 'tài liệu' },
          { kind: 'custom', id: 'apps', label: 'Ứng dụng hiện trên màn hình chính', keywords: 'docs sheets slides pdf photos', render: () => <AppsPicker /> },
        ],
      },
    ],
  },
  {
    id: 'display',
    group: 'doc',
    title: 'Hiển thị',
    description: 'Cách nội dung tài liệu hiện trên màn hình và khi in.',
    icon: <Eye size={20} />,
    sections: [
      {
        id: 'page',
        title: 'Tuỳ chọn hiển thị trang',
        description: 'Áp dụng cho 23 Docs ở chế độ Bố cục in.',
        icon: <Monitor size={ICON} />,
        options: [
          { kind: 'toggle', key: 'docPageGap', label: 'Hiện khoảng trắng giữa các trang' },
          { kind: 'toggle', key: 'docHighlight', label: 'Hiện màu tô sáng văn bản', hint: 'Tắt để ẩn màu tô trên màn hình; màu vẫn giữ trong tài liệu.' },
          { kind: 'toggle', key: 'docRuler', label: 'Hiện thước khi mở tài liệu' },
          { kind: 'toggle', key: 'docNavPane', label: 'Hiện ngăn điều hướng khi mở tài liệu' },
          { kind: 'select', key: 'docZoom', label: 'Thu phóng mặc định', options: [[75, '75%'], [90, '90%'], [100, '100%'], [110, '110%'], [125, '125%'], [150, '150%']] },
        ],
      },
      {
        id: 'marks',
        title: 'Luôn hiện các ký hiệu định dạng',
        description: 'Ký hiệu chỉ hiện trên màn hình, không in ra.',
        icon: <AlignJustify size={ICON} />,
        options: [
          { kind: 'toggle', key: 'markTabs', label: 'Ký tự tab', mark: '→', disabledWhen: (s) => s.markAll },
          { kind: 'toggle', key: 'markSpaces', label: 'Dấu cách', mark: '···', disabledWhen: (s) => s.markAll },
          { kind: 'toggle', key: 'markParagraphs', label: 'Dấu đoạn văn', mark: '¶', disabledWhen: (s) => s.markAll },
          { kind: 'toggle', key: 'markBreaks', label: 'Ngắt dòng', mark: '↵', disabledWhen: (s) => s.markAll },
          { kind: 'toggle', key: 'markAll', label: 'Hiện tất cả ký hiệu định dạng' },
        ],
      },
      {
        id: 'printing',
        title: 'Tuỳ chọn in',
        description: 'Áp dụng khi in từ 23 Docs (Tệp → In).',
        icon: <CheckCheck size={ICON} />,
        options: [
          { kind: 'toggle', key: 'printDrawings', label: 'In nét vẽ tay tạo trong 23 Docs' },
          { kind: 'toggle', key: 'printBackground', label: 'In màu nền và hình nền trang' },
          { kind: 'toggle', key: 'printProperties', label: 'In thuộc tính tài liệu', hint: 'Thêm một trang cuối ghi tên, tác giả, ngày tạo, số trang và số từ.' },
          { kind: 'toggle', key: 'printComments', label: 'In kèm nhận xét', hint: 'Thêm danh sách nhận xét ở cuối bản in.' },
        ],
      },
    ],
  },
  {
    id: 'proofing',
    group: 'doc',
    title: 'Soát lỗi',
    description: 'Cách 23 Docs sửa và đánh dấu văn bản khi gõ.',
    icon: <SpellCheck2 size={20} />,
    sections: [
      {
        id: 'autocorrect',
        title: 'Tự sửa khi gõ',
        description: 'Thay chữ tự động trong lúc soạn thảo.',
        icon: <Wrench size={ICON} />,
        options: [
          { kind: 'toggle', key: 'acEnabled', label: 'Bật tự sửa khi gõ' },
          { kind: 'toggle', key: 'acCapitalize', label: 'Viết hoa chữ cái đầu câu', disabledWhen: (s) => !s.acEnabled },
          { kind: 'toggle', key: 'acSymbols', label: 'Thay ký hiệu: -- thành —, ... thành …, (c) thành ©, -> thành →', disabledWhen: (s) => !s.acEnabled },
          { kind: 'toggle', key: 'acSmartQuotes', label: 'Thay dấu nháy thẳng " \' bằng nháy cong “ ” ‘ ’', disabledWhen: (s) => !s.acEnabled },
          { kind: 'toggle', key: 'acSuperscript', label: 'Đổi số mũ x^2 thành x²', disabledWhen: (s) => !s.acEnabled },
          { kind: 'toggle', key: 'acMath', label: 'Đổi lệnh ký hiệu \\alpha thành α', disabledWhen: (s) => !s.acEnabled },
          { kind: 'toggle', key: 'acCustomList', label: 'Dùng danh sách thay thế riêng', disabledWhen: (s) => !s.acEnabled },
          { kind: 'custom', id: 'ac-list', label: 'Danh sách thay thế', keywords: 'tự sửa autocorrect', render: () => <AutoCorrectList /> },
        ],
      },
      {
        id: 'spelling',
        title: 'Chính tả',
        description: 'Gạch chân lỗi chính tả bằng bộ kiểm tra của hệ thống.',
        icon: <SpellCheck2 size={ICON} />,
        options: [
          { kind: 'toggle', key: 'spellcheck', label: 'Gạch lỗi chính tả khi gõ' },
          { kind: 'select', key: 'proofLanguage', label: 'Ngôn ngữ soát chính tả', options: [['vi', 'Tiếng Việt'], ['en-US', 'Tiếng Anh (Mỹ)']] },
        ],
      },
    ],
  },
  {
    id: 'save',
    group: 'general',
    title: 'Lưu & Sao lưu',
    description: 'Cách tài liệu được lưu, sao lưu và khôi phục.',
    icon: <Save size={20} />,
    sections: [
      {
        id: 'backup',
        title: 'Lưu & sao lưu',
        description: 'Tài liệu tự lưu vào máy ngay khi gõ, kể cả lúc mất mạng.',
        icon: <Save size={ICON} />,
        options: [{ kind: 'custom', id: 'backup', label: 'Sao lưu toàn bộ và khôi phục', keywords: 'backup khôi phục tải về', render: () => <BackupPanel /> }],
      },
    ],
  },
  {
    id: 'language',
    group: 'general',
    title: 'Ngôn ngữ',
    description: 'Ngôn ngữ giao diện và ngôn ngữ soát lỗi.',
    icon: <Languages size={20} />,
    sections: [
      {
        id: 'ui-language',
        title: 'Ngôn ngữ giao diện',
        description: 'Chọn ngôn ngữ cho toàn bộ ứng dụng. Nội dung tài liệu giữ nguyên.',
        icon: <Languages size={ICON} />,
        options: [
          { kind: 'custom', id: 'ui-language', label: 'Ngôn ngữ hiển thị', keywords: 'english tiếng việt', render: () => <LanguagePanel /> },
          { kind: 'select', key: 'proofLanguage', label: 'Ngôn ngữ soát chính tả', options: [['vi', 'Tiếng Việt'], ['en-US', 'Tiếng Anh (Mỹ)']] },
        ],
      },
    ],
  },
  {
    id: 'accessibility',
    group: 'general',
    title: 'Trợ năng',
    description: 'Giúp ứng dụng dễ dùng hơn cho mọi người.',
    icon: <Accessibility size={20} />,
    sections: [
      {
        id: 'a11y',
        title: 'Tuỳ chọn trợ năng',
        description: 'Áp dụng cho toàn bộ ứng dụng.',
        icon: <Accessibility size={ICON} />,
        options: [
          { kind: 'toggle', key: 'reduceMotion', label: 'Giảm hiệu ứng chuyển động', hint: 'Tắt hoạt ảnh và chuyển cảnh trong giao diện.' },
          { kind: 'toggle', key: 'underlineLinks', label: 'Luôn gạch chân liên kết' },
          { kind: 'toggle', key: 'strongFocus', label: 'Viền tiêu điểm dày khi dùng bàn phím' },
        ],
      },
    ],
  },
  {
    id: 'advanced',
    group: 'general',
    title: 'Nâng cao',
    description: 'Ứng dụng mặc định và đặt lại cài đặt.',
    icon: <SlidersHorizontal size={20} />,
    sections: [
      {
        id: 'desktop',
        title: 'Ứng dụng máy tính',
        description: 'Mở tài liệu và ảnh bằng Office 23.',
        icon: <Monitor size={ICON} />,
        options: [{ kind: 'custom', id: 'default-apps', label: 'Ứng dụng mặc định', keywords: 'mở tệp mặc định tải ứng dụng', render: () => <DefaultAppsPanel /> }],
      },
      {
        id: 'reset',
        title: 'Đặt lại',
        description: 'Đưa mọi cài đặt trong cửa sổ này về giá trị ban đầu.',
        icon: <Wrench size={ICON} />,
        options: [{ kind: 'custom', id: 'reset', label: 'Đặt lại cài đặt về mặc định', keywords: 'reset', render: () => <ResetPanel /> }],
      },
    ],
  },
  {
    id: 'doc-editing',
    group: 'doc',
    title: 'Soạn thảo',
    description: 'Phông chữ mặc định và cách dán trong 23 Docs.',
    icon: <Type size={20} />,
    sections: [
      {
        id: 'editing',
        title: 'Phông chữ mặc định',
        description: 'Áp dụng cho văn bản mới tạo trong 23 Docs.',
        icon: <Type size={ICON} />,
        options: [
          { kind: 'custom', id: 'font', label: 'Phông chữ và cỡ chữ mặc định', keywords: 'font phông cỡ', render: () => <FontPicker /> },
        ],
      },
      {
        id: 'paste',
        title: 'Cắt, sao chép và dán',
        description: 'Cách 23 Docs giữ định dạng khi dán.',
        icon: <Code2 size={ICON} />,
        options: [
          { kind: 'select', key: 'pasteSame', label: 'Dán trong cùng tài liệu', options: [['keep', 'Giữ định dạng gốc'], ['merge', 'Gộp định dạng'], ['text', 'Chỉ giữ văn bản']] },
          { kind: 'select', key: 'pasteOther', label: 'Dán từ chương trình khác', options: [['keep', 'Giữ định dạng gốc'], ['merge', 'Gộp định dạng'], ['text', 'Chỉ giữ văn bản']] },
        ],
      },
    ],
  },
  {
    id: 'ribbon',
    group: 'doc',
    title: 'Tuỳ chỉnh Ribbon',
    description: 'Chọn các tab hiện trên ribbon của 23 Docs.',
    icon: <PanelTop size={20} />,
    sections: [
      {
        id: 'tabs',
        title: 'Các tab chính',
        description: 'Bỏ chọn để ẩn tab khỏi ribbon. Tab Tệp luôn hiện.',
        icon: <PanelTop size={ICON} />,
        options: [{ kind: 'custom', id: 'tabs', label: 'Tab trên ribbon', keywords: 'trang chủ chèn vẽ thiết kế bố cục tham chiếu gửi thư xem lại xem trợ giúp', render: () => <DocTabsPicker /> }],
      },
    ],
  },
  {
    id: 'qat',
    group: 'doc',
    title: 'Thanh truy cập nhanh',
    description: 'Các lệnh dùng nhiều, luôn nằm trên ribbon của 23 Docs.',
    icon: <Keyboard size={20} />,
    sections: [
      {
        id: 'qat',
        title: 'Thanh truy cập nhanh',
        description: 'Chọn lệnh, thứ tự và vị trí của thanh.',
        icon: <Keyboard size={ICON} />,
        options: [
          { kind: 'toggle', key: 'qatShow', label: 'Hiện thanh truy cập nhanh' },
          { kind: 'segmented', key: 'qatPosition', label: 'Vị trí', options: [['above', 'Trên ribbon'], ['below', 'Dưới ribbon']], disabledWhen: (s) => !s.qatShow },
          { kind: 'custom', id: 'qat-commands', label: 'Lệnh trên thanh', keywords: 'hoàn tác làm lại in lưu', render: () => <QatEditor /> },
        ],
      },
    ],
  },
  {
    id: 'trust',
    group: 'general',
    title: 'Bảo mật & Quyền riêng tư',
    description: 'Macro, liên kết ngoài và dữ liệu thống kê.',
    icon: <ShieldCheck size={20} />,
    sections: [
      {
        id: 'macros',
        title: 'Macro',
        description: 'Áp dụng cho macro VBA trong 23 Sheets và macro ghi trong 23 Docs.',
        icon: <Code2 size={ICON} />,
        options: [
          { kind: 'select', key: 'macroPolicy', label: 'Khi tài liệu chứa macro', options: [['disable', 'Tắt mọi macro'], ['ask', 'Hỏi trước khi chạy'], ['enable', 'Cho chạy mọi macro']], hint: 'Macro có thể sửa hoặc xoá dữ liệu. Chỉ cho chạy macro từ nguồn tin cậy.' },
        ],
      },
      {
        id: 'links',
        title: 'Liên kết & quyền riêng tư',
        description: 'Liên kết trong tài liệu và dữ liệu gửi về máy chủ.',
        icon: <ShieldCheck size={ICON} />,
        options: [
          { kind: 'toggle', key: 'confirmLinks', label: 'Hỏi trước khi mở liên kết ra ngoài' },
          { kind: 'toggle', key: 'usageStats', label: 'Gửi một lượt đếm ẩn danh khi cài mới', hint: 'Chỉ đếm số máy dùng ứng dụng, không gửi nội dung tài liệu.' },
        ],
      },
    ],
  },
  {
    id: 'account',
    group: 'general',
    title: 'Tài khoản & Đồng bộ',
    description: 'Đăng nhập và đồng bộ tài liệu giữa các thiết bị.',
    icon: <Cloud size={20} />,
    sections: [
      {
        id: 'account',
        title: 'Tài khoản & Đồng bộ',
        description: 'Đăng nhập, đồng bộ dữ liệu và quản lý thiết bị.',
        icon: <UserRound size={ICON} />,
        options: [{ kind: 'custom', id: 'account', label: 'Tài khoản', keywords: 'đăng nhập đăng xuất google đồng bộ', render: () => <AccountPanel /> }],
      },
    ],
  },
  {
    id: 'about',
    group: 'general',
    title: 'Trợ giúp & Cập nhật',
    description: 'Hướng dẫn sử dụng, cập nhật ứng dụng và thông tin phiên bản.',
    icon: <CircleHelp size={20} />,
    sections: [
      {
        id: 'help',
        title: 'Trợ giúp',
        description: 'Hướng dẫn dùng Docs, Sheets, Slides, PDF và Photos.',
        icon: <CircleHelp size={ICON} />,
        options: [{ kind: 'custom', id: 'help', label: 'Hướng dẫn sử dụng', keywords: 'trợ giúp help hướng dẫn', render: () => <HelpPanel /> }],
      },
      {
        id: 'update',
        title: 'Cập nhật ứng dụng',
        description: 'Kiểm tra và cài phiên bản mới.',
        icon: <RefreshCw size={ICON} />,
        options: [{ kind: 'custom', id: 'update', label: 'Phiên bản mới', keywords: 'cập nhật update tải bản mới', render: () => <UpdatePanel /> }],
      },
      {
        id: 'about',
        title: 'Giới thiệu',
        description: 'Phiên bản đang dùng.',
        icon: <Info size={ICON} />,
        options: [{ kind: 'custom', id: 'about', label: 'Phiên bản', keywords: 'version giới thiệu', render: () => <AboutPanel /> }],
      },
    ],
  },
];

const GROUP_ORDER = ['general', 'doc', 'sheet', 'slide'] as const;

export const CATEGORIES: SettingCategory[] = [...BASE_CATEGORIES, ...SHEET_CATEGORIES, ...SLIDE_CATEGORIES]
  .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));

export function optionText(option: SettingOption) {
  return [option.label, option.hint, option.kind === 'custom' ? option.keywords : ''].filter(Boolean).join(' ').toLocaleLowerCase('vi');
}
