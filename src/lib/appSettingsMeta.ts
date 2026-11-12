import type { AccentId, QatCommand } from './appSettings';

export const ACCENTS: Record<AccentId, { label: string; base: string; hover: string; soft: string; darkSoft: string }> = {
  blue: { label: 'Xanh dương', base: '#2563eb', hover: '#1d4ed8', soft: '#eaf1ff', darkSoft: '#1c2c4f' },
  violet: { label: 'Tím', base: '#7c3aed', hover: '#6d28d9', soft: '#f1eafe', darkSoft: '#2d2150' },
  pink: { label: 'Hồng', base: '#db2777', hover: '#be185d', soft: '#fce8f2', darkSoft: '#46182f' },
  red: { label: 'Đỏ', base: '#dc2626', hover: '#b91c1c', soft: '#fdecec', darkSoft: '#481c1c' },
  orange: { label: 'Cam', base: '#ea580c', hover: '#c2410c', soft: '#fdf0e7', darkSoft: '#47261a' },
  green: { label: 'Xanh lá', base: '#16a34a', hover: '#15803d', soft: '#e8f6ed', darkSoft: '#173823' },
  teal: { label: 'Xanh ngọc', base: '#0d9488', hover: '#0f766e', soft: '#e5f6f4', darkSoft: '#123a37' },
};

export const QAT_LABELS: Record<QatCommand, string> = {
  save: 'Lưu',
  undo: 'Hoàn tác',
  redo: 'Làm lại',
  print: 'In',
  pdf: 'Xuất PDF',
  find: 'Tìm',
  newDoc: 'Văn bản mới',
  spelling: 'Bật/tắt gạch lỗi chính tả',
  readAloud: 'Đọc to',
  comment: 'Nhận xét mới',
  table: 'Chèn bảng',
  picture: 'Chèn ảnh',
};
