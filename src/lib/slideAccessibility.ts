import type { PresentationData, SlideElement } from './slideTypes';

export type AccessibilitySeverity = 'error' | 'warning' | 'tip';

export interface AccessibilityIssue {
  id: string;
  severity: AccessibilitySeverity;
  rule: 'alt-text' | 'slide-title' | 'duplicate-title' | 'contrast' | 'small-text' | 'table-header' | 'link-text' | 'reading-order' | 'media-caption';
  message: string;
  fix: string;
  slideIndex: number;
  elementId?: string;
}

export const ACCESSIBILITY_RULE_LABELS: Record<AccessibilityIssue['rule'], string> = {
  'alt-text': 'Thiếu văn bản thay thế',
  'slide-title': 'Trang chiếu thiếu tiêu đề',
  'duplicate-title': 'Tiêu đề trang trùng nhau',
  contrast: 'Màu chữ khó đọc',
  'small-text': 'Chữ quá nhỏ',
  'table-header': 'Bảng thiếu hàng tiêu đề',
  'link-text': 'Liên kết chưa có mô tả',
  'reading-order': 'Thứ tự đọc chưa hợp lý',
  'media-caption': 'Âm thanh/video chưa có phụ đề',
};

const MIN_READABLE_FONT_SIZE = 12;
const MIN_CONTRAST_RATIO = 4.5;
const VISUAL_TYPES = new Set<SlideElement['type']>(['image', 'chart', 'smartart', '3d', 'qr', 'icon', 'video', 'cameo']);

function parseColor(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    const n = parseInt(raw, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value.trim());
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

function luminance([r, g, b]: [number, number, number]) {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string | undefined, background: string | undefined): number | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return null;
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function slideTitle(elements: SlideElement[]) {
  return elements.find((el) => el.isTitle && el.text?.trim())?.text?.trim() ?? '';
}

export function checkAccessibility(presentation: PresentationData): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const titles = new Map<string, number>();
  presentation.slides.forEach((slide, slideIndex) => {
    const push = (issue: Omit<AccessibilityIssue, 'id' | 'slideIndex'>) =>
      issues.push({ ...issue, slideIndex, id: `${slide.id}-${issue.rule}-${issue.elementId ?? 'slide'}` });
    const title = slideTitle(slide.elements);
    if (!title) push({ severity: 'error', rule: 'slide-title', message: `Trang chiếu ${slideIndex + 1} chưa có tiêu đề.`, fix: 'Thêm hộp tiêu đề hoặc đặt một hộp văn bản làm tiêu đề trang.' });
    else if (titles.has(title.toLowerCase())) push({ severity: 'warning', rule: 'duplicate-title', message: `Tiêu đề "${title}" trùng với trang ${titles.get(title.toLowerCase())! + 1}.`, fix: 'Đổi tiêu đề để người dùng trình đọc màn hình phân biệt được các trang.' });
    else titles.set(title.toLowerCase(), slideIndex);
    const background = slide.background.type === 'solid' ? slide.background.value : undefined;
    const ordered = [...slide.elements].sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10));
    const titleElement = slide.elements.find((el) => el.isTitle);
    if (titleElement && ordered[0] && ordered[0].id !== titleElement.id && ordered.indexOf(titleElement) > 1) {
      push({ severity: 'tip', rule: 'reading-order', elementId: titleElement.id, message: `Tiêu đề trang ${slideIndex + 1} không được đọc đầu tiên.`, fix: 'Mở Ngăn chọn và đưa tiêu đề xuống dưới cùng danh sách (đọc trước).' });
    }
    for (const el of slide.elements) {
      const name = el.name || el.text?.slice(0, 30) || el.type;
      if (VISUAL_TYPES.has(el.type) && !el.decorative && !(el.altText || el.alt)?.trim()) {
        push({ severity: 'error', rule: 'alt-text', elementId: el.id, message: `"${name}" trên trang ${slideIndex + 1} thiếu văn bản thay thế.`, fix: 'Chọn đối tượng, mở Văn bản thay thế và mô tả nội dung, hoặc đánh dấu là trang trí.' });
      }
      if ((el.type === 'text' || el.text) && el.text?.trim()) {
        const surface = el.type === 'shape' && el.fillType !== 'none' ? el.fill : background;
        const ratio = contrastRatio(el.color, surface);
        if (ratio !== null && ratio < MIN_CONTRAST_RATIO) push({ severity: 'warning', rule: 'contrast', elementId: el.id, message: `Chữ "${name}" có độ tương phản ${ratio.toFixed(1)}:1 (cần ≥ 4,5:1).`, fix: 'Đổi màu chữ hoặc màu nền để tăng độ tương phản.' });
        if ((el.fontSize ?? 18) < MIN_READABLE_FONT_SIZE) push({ severity: 'tip', rule: 'small-text', elementId: el.id, message: `Chữ "${name}" cỡ ${el.fontSize}pt, khó đọc khi trình chiếu.`, fix: 'Tăng cỡ chữ lên ít nhất 12pt.' });
      }
      if (el.type === 'table' && el.tableHeaderRow === false) push({ severity: 'warning', rule: 'table-header', elementId: el.id, message: `Bảng trên trang ${slideIndex + 1} chưa bật hàng tiêu đề.`, fix: 'Bật "Hàng tiêu đề" trong tab Thiết kế Bảng.' });
      if (el.link?.kind === 'url' && !el.link.tooltip?.trim() && !el.text?.trim()) push({ severity: 'tip', rule: 'link-text', elementId: el.id, message: `Liên kết trên "${name}" chưa có mô tả.`, fix: 'Nhập Mẹo màn hình (ScreenTip) cho liên kết.' });
      if ((el.type === 'video' || el.type === 'audio') && !el.altText?.trim()) push({ severity: 'tip', rule: 'media-caption', elementId: el.id, message: `${el.type === 'video' ? 'Video' : 'Âm thanh'} trên trang ${slideIndex + 1} chưa có mô tả hoặc phụ đề.`, fix: 'Thêm văn bản thay thế mô tả nội dung đa phương tiện.' });
    }
  });
  return issues;
}
