import type { JSONContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { PageNumberFormat, PageNumberPosition, PageSettings } from '../../lib/storage';

type CoverInfo = { title: string; author: string; date: string };
type LineOptions = { size?: number; color?: string; bold?: boolean; italic?: boolean; align?: string; before?: number; after?: number; shading?: string };

const line = (text: string, options: LineOptions = {}): JSONContent => {
  const marks: NonNullable<JSONContent['marks']> = [];
  if (options.size || options.color) marks.push({ type: 'textStyle', attrs: { ...(options.size ? { fontSize: `${options.size}pt` } : {}), ...(options.color ? { color: options.color } : {}) } });
  if (options.bold) marks.push({ type: 'bold' });
  if (options.italic) marks.push({ type: 'italic' });
  return {
    type: 'paragraph',
    attrs: { cover: true, textAlign: options.align ?? 'left', spaceBefore: options.before ?? null, spaceAfter: options.after ?? null, shading: options.shading ?? null },
    content: text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : [],
  };
};

export const COVER_STYLES: { id: string; label: string; accent: string; dark: boolean; build: (info: CoverInfo) => JSONContent[] }[] = [
  {
    id: 'formal', label: 'Trang trọng', accent: '#1f3864', dark: false,
    build: ({ title, author, date }) => [
      line('TÊN ĐƠN VỊ', { size: 12, color: '#586071', align: 'center', before: 96 }),
      line(title, { size: 32, bold: true, color: '#1f3864', align: 'center', before: 96, after: 12 }),
      line('Phụ đề hoặc mô tả ngắn của tài liệu', { size: 14, color: '#586071', align: 'center', after: 180 }),
      line(`Người lập: ${author}`, { size: 12, align: 'center' }),
      line(date, { size: 12, italic: true, align: 'center' }),
    ],
  },
  {
    id: 'admin', label: 'Hành chính Việt Nam', accent: '#111827', dark: false,
    build: ({ title, date }) => [
      line('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', { size: 13, bold: true, align: 'center' }),
      line('Độc lập - Tự do - Hạnh phúc', { size: 13, bold: true, align: 'center', after: 150 }),
      line(title.toUpperCase(), { size: 22, bold: true, align: 'center', after: 200 }),
      line(`Hà Nội, ${date}`, { size: 13, italic: true, align: 'center' }),
    ],
  },
  {
    id: 'banner', label: 'Khối màu', accent: '#2b579a', dark: true,
    build: ({ title, author, date }) => [
      line('', { shading: '#2b579a', before: 60 }),
      line(title, { size: 34, bold: true, color: '#ffffff', shading: '#2b579a' }),
      line('Phụ đề của tài liệu', { size: 15, color: '#dbe6fb', shading: '#2b579a' }),
      line('', { shading: '#2b579a', after: 220 }),
      line(author, { size: 13, bold: true, color: '#2b579a' }),
      line(date, { size: 12, color: '#586071' }),
    ],
  },
  {
    id: 'modern', label: 'Hiện đại', accent: '#0f766e', dark: false,
    build: ({ title, author, date }) => [
      line(date, { size: 12, color: '#0f766e', bold: true, before: 150, after: 12 }),
      line(title, { size: 40, color: '#0f172a', after: 12 }),
      line('Mô tả ngắn về nội dung và phạm vi tài liệu', { size: 14, color: '#64748b', after: 240 }),
      line(author, { size: 13, color: '#0f766e' }),
    ],
  },
  {
    id: 'report', label: 'Báo cáo', accent: '#b45309', dark: false,
    build: ({ title, author, date }) => [
      line('BÁO CÁO', { size: 13, bold: true, color: '#b45309', align: 'right', before: 60, after: 96 }),
      line(title, { size: 30, bold: true, color: '#78350f', align: 'right', after: 12 }),
      line('Kỳ báo cáo, phạm vi, đơn vị thực hiện', { size: 13, color: '#78716c', align: 'right', after: 240 }),
      line(`${author} · ${date}`, { size: 12, align: 'right' }),
    ],
  },
  {
    id: 'minimal', label: 'Tối giản', accent: '#6b7280', dark: false,
    build: ({ title, author, date }) => [
      line(title, { size: 28, color: '#111827', before: 240, after: 6 }),
      line(`${author} · ${date}`, { size: 11, color: '#6b7280' }),
    ],
  },
];

export const hasCover = (editor: Editor) => Boolean(editor.state.doc.firstChild?.attrs.cover);

export function removeCover(editor: Editor) {
  const { doc } = editor.state;
  let end = 0;
  let index = 0;
  while (index < doc.childCount && doc.child(index).attrs.cover) {
    end += doc.child(index).nodeSize;
    index++;
  }
  if (!end) return false;
  if (index < doc.childCount && doc.child(index).type.name === 'pageBreak') end += doc.child(index).nodeSize;
  if (end >= doc.content.size) editor.chain().focus().setContent({ type: 'doc', content: [{ type: 'paragraph' }] }).run();
  else editor.view.dispatch(editor.state.tr.delete(0, end));
  return true;
}

export function insertCover(editor: Editor, styleId: string, info: CoverInfo) {
  const style = COVER_STYLES.find((item) => item.id === styleId) ?? COVER_STYLES[0];
  removeCover(editor);
  editor.chain().focus().insertContentAt(0, [...style.build(info), { type: 'pageBreak' }]).run();
}

export const HEADER_GALLERY: { id: string; label: string; detail: string; value: string }[] = [
  { id: 'plain', label: 'Tiêu đề bên trái', detail: 'Tên tài liệu căn trái', value: '{title}' },
  { id: 'center', label: 'Tiêu đề căn giữa', detail: 'Tên tài liệu ở giữa', value: '\t{title}\t' },
  { id: 'three', label: 'Ba cột', detail: 'Đơn vị, tên tài liệu, ngày', value: 'Tên đơn vị\t{title}\t{date}' },
  { id: 'date', label: 'Tiêu đề và ngày', detail: 'Tên bên trái, ngày bên phải', value: '{title}\t\t{date}' },
  { id: 'admin', label: 'Hành chính', detail: 'Tên đơn vị và quốc hiệu rút gọn', value: 'Tên đơn vị\t\tĐộc lập - Tự do - Hạnh phúc' },
  { id: 'draft', label: 'Bản nháp', detail: 'Nhắc đây là bản nháp', value: '\t\tBẢN NHÁP' },
];

export const FOOTER_GALLERY: { id: string; label: string; detail: string; value: string }[] = [
  { id: 'title', label: 'Tên tài liệu', detail: 'Bên trái', value: '{title}' },
  { id: 'pages', label: 'Trang x / y giữa', detail: 'Số trang ở giữa', value: '\tTrang {page} / {pages}\t' },
  { id: 'three', label: 'Ba cột', detail: 'Tên, ngày, số trang', value: '{title}\t{date}\tTrang {page}' },
  { id: 'internal', label: 'Lưu hành nội bộ', detail: 'Cảnh báo bảo mật', value: 'Tài liệu lưu hành nội bộ\t\tTrang {page}' },
  { id: 'contact', label: 'Liên hệ', detail: 'Địa chỉ, điện thoại', value: 'Địa chỉ đơn vị\t\tĐiện thoại: ' },
];

export const clearHeaderFooter = (kind: 'header' | 'footer'): Partial<PageSettings> => (kind === 'header' ? { header: '', headerFirst: '', headerEven: '' } : { footer: '', footerFirst: '', footerEven: '' });

export const NUMBER_POSITIONS: { id: PageNumberPosition; label: string }[] = [
  { id: 'top-left', label: 'Đầu trang, bên trái' }, { id: 'top-center', label: 'Đầu trang, ở giữa' }, { id: 'top-right', label: 'Đầu trang, bên phải' },
  { id: 'bottom-left', label: 'Chân trang, bên trái' }, { id: 'bottom-center', label: 'Chân trang, ở giữa' }, { id: 'bottom-right', label: 'Chân trang, bên phải' },
];

export const NUMBER_FORMATS: PageNumberFormat[] = ['plain', 'page', 'page-of', 'dash', 'roman'];

export const TEXT_BOXES: { id: string; label: string; detail: string; attrs: Record<string, unknown>; italic?: boolean; size?: number; color?: string; text: string }[] = [
  { id: 'simple', label: 'Hộp chữ đơn giản', detail: 'Rộng hết dòng, viền mảnh', attrs: { align: 'full', fill: '#ffffff', stroke: '#94a3b8' }, text: 'Nhập nội dung hộp chữ.' },
  { id: 'half', label: 'Hộp nửa trang giữa', detail: 'Căn giữa, rộng 60%', attrs: { align: 'center', fill: '#ffffff', stroke: '#94a3b8', boxWidth: '60' }, text: 'Nhập nội dung hộp chữ.' },
  { id: 'quote', label: 'Trích dẫn nổi', detail: 'Chữ nghiêng, nền nhạt, căn giữa', attrs: { align: 'center', fill: '#f1f5f9', stroke: '#cbd5e1', boxWidth: '80' }, italic: true, size: 15, color: '#2b579a', text: '“Nhập câu trích dẫn cần làm nổi bật.”' },
  { id: 'side-left', label: 'Thanh bên trái', detail: 'Chữ bao quanh bên phải', attrs: { align: 'left', fill: '#eef2fb', stroke: '#5b8def', boxWidth: '35' }, text: 'Nội dung thanh bên.' },
  { id: 'side-right', label: 'Thanh bên phải', detail: 'Chữ bao quanh bên trái', attrs: { align: 'right', fill: '#eef2fb', stroke: '#5b8def', boxWidth: '35' }, text: 'Nội dung thanh bên.' },
  { id: 'note', label: 'Ghi chú vàng', detail: 'Nền vàng nhạt', attrs: { align: 'full', fill: '#fef9c3', stroke: '#eab308' }, text: 'Ghi chú quan trọng.' },
  { id: 'dark', label: 'Khối tối', detail: 'Nền xanh đậm, chữ trắng', attrs: { align: 'full', fill: '#1f3864', stroke: '#1f3864' }, color: '#ffffff', text: 'Nội dung nổi bật.' },
];

export const textBoxContent = (box: (typeof TEXT_BOXES)[number]): JSONContent => {
  const marks: NonNullable<JSONContent['marks']> = [];
  if (box.size || box.color) marks.push({ type: 'textStyle', attrs: { ...(box.size ? { fontSize: `${box.size}pt` } : {}), ...(box.color ? { color: box.color } : {}) } });
  if (box.italic) marks.push({ type: 'italic' });
  return { type: 'textBox', attrs: box.attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text: box.text, ...(marks.length ? { marks } : {}) }] }] };
};

export const BUILTIN_EQUATIONS: { id: string; label: string; latex: string }[] = [
  { id: 'circle', label: 'Diện tích hình tròn', latex: 'A = \\pi r^{2}' },
  { id: 'binomial', label: 'Định lý nhị thức', latex: '(x + a)^{n} = \\sum_{k=0}^{n} \\binom{n}{k} x^{k} a^{n-k}' },
  { id: 'sum', label: 'Khai triển lũy thừa', latex: '(1 + x)^{n} = 1 + \\frac{nx}{1!} + \\frac{n(n-1)x^{2}}{2!} + \\cdots' },
  { id: 'fourier', label: 'Chuỗi Fourier', latex: 'f(x) = a_{0} + \\sum_{n=1}^{\\infty} \\left( a_{n} \\cos \\frac{n\\pi x}{L} + b_{n} \\sin \\frac{n\\pi x}{L} \\right)' },
  { id: 'pythagoras', label: 'Định lý Pythagoras', latex: 'a^{2} + b^{2} = c^{2}' },
  { id: 'quadratic', label: 'Công thức nghiệm bậc hai', latex: 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}' },
  { id: 'taylor', label: 'Khai triển Taylor', latex: 'e^{x} = 1 + \\frac{x}{1!} + \\frac{x^{2}}{2!} + \\frac{x^{3}}{3!} + \\cdots' },
  { id: 'trig1', label: 'Đẳng thức lượng giác 1', latex: '\\sin \\alpha \\pm \\sin \\beta = 2 \\sin \\frac{1}{2}(\\alpha \\pm \\beta) \\cos \\frac{1}{2}(\\alpha \\mp \\beta)' },
  { id: 'trig2', label: 'Đẳng thức lượng giác 2', latex: '\\cos \\alpha + \\cos \\beta = 2 \\cos \\frac{1}{2}(\\alpha + \\beta) \\cos \\frac{1}{2}(\\alpha - \\beta)' },
];
