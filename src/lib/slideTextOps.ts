import type { SlideElement, SmartArtItem, TextFieldType } from './slideTypes';

export type TextCase = 'sentence' | 'lower' | 'upper' | 'capitalize' | 'toggle';

export const TEXT_CASE_OPTIONS: ReadonlyArray<readonly [TextCase, string]> = [
  ['sentence', 'Kiểu câu.'],
  ['lower', 'chữ thường'],
  ['upper', 'CHỮ HOA'],
  ['capitalize', 'Viết Hoa Mỗi Từ'],
  ['toggle', 'đẢO cHỮ hOA'],
];

export function changeCase(text: string, mode: TextCase): string {
  switch (mode) {
    case 'lower':
      return text.toLocaleLowerCase('vi');
    case 'upper':
      return text.toLocaleUpperCase('vi');
    case 'capitalize':
      return text.toLocaleLowerCase('vi').replace(/(^|[\s\-(/"'“])(\p{L})/gu, (_m, lead: string, ch: string) => lead + ch.toLocaleUpperCase('vi'));
    case 'toggle':
      return Array.from(text)
        .map((ch) => (ch === ch.toLocaleUpperCase('vi') ? ch.toLocaleLowerCase('vi') : ch.toLocaleUpperCase('vi')))
        .join('');
    default:
      return text
        .toLocaleLowerCase('vi')
        .replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (_m, lead: string, ch: string) => lead + ch.toLocaleUpperCase('vi'));
  }
}

export const FORMAT_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'strikethrough',
  'color',
  'highlight',
  'textAlign',
  'verticalAlign',
  'textShadow',
  'lineHeight',
  'letterSpacing',
  'isBullet',
  'bulletStyle',
  'indentLevel',
  'textDirection',
  'textColumns',
  'wordArt',
  'textOutline',
  'textGradient',
  'textGlow',
  'fill',
  'fillType',
  'gradient',
  'stroke',
  'strokeWidth',
  'borderStyle',
  'borderRadius',
  'shapeShadow',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'glow',
  'glowColor',
  'opacity',
  'imageAdjust',
] as const satisfies ReadonlyArray<keyof SlideElement>;

export type ElementFormat = Partial<Pick<SlideElement, (typeof FORMAT_KEYS)[number]>>;

const TEXT_KEYS = new Set<string>([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'strikethrough',
  'color',
  'highlight',
  'textAlign',
  'verticalAlign',
  'textShadow',
  'lineHeight',
  'letterSpacing',
  'isBullet',
  'bulletStyle',
  'indentLevel',
  'textDirection',
  'textColumns',
  'wordArt',
  'textOutline',
  'textGradient',
  'textGlow',
]);

export function extractFormat(el: SlideElement): ElementFormat {
  const format: Record<string, unknown> = {};
  for (const key of FORMAT_KEYS) {
    if (el[key] !== undefined) format[key] = el[key];
  }
  return format as ElementFormat;
}

export function formatPatchFor(target: SlideElement, format: ElementFormat): Partial<SlideElement> {
  const patch: Record<string, unknown> = {};
  const textOnly = target.type === 'text';
  const visualOnly = target.type === 'image';
  for (const key of FORMAT_KEYS) {
    if (textOnly && !TEXT_KEYS.has(key) && key !== 'opacity') continue;
    if (visualOnly && TEXT_KEYS.has(key)) continue;
    patch[key] = format[key];
  }
  return patch as Partial<SlideElement>;
}

export function clearTextFormatting(): Partial<SlideElement> {
  return {
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    strikethrough: false,
    highlight: undefined,
    textShadow: false,
    letterSpacing: undefined,
    wordArt: undefined,
    textOutline: undefined,
    textGradient: undefined,
    textGlow: undefined,
  };
}

export const LETTER_SPACING_OPTIONS: ReadonlyArray<readonly [number, string]> = [
  [-3, 'Rất sát'],
  [-1.5, 'Sát'],
  [0, 'Bình thường'],
  [3, 'Thưa'],
  [6, 'Rất thưa'],
];

export const LINE_SPACING_OPTIONS = [1, 1.15, 1.5, 2, 2.5, 3] as const;

export const HIGHLIGHT_COLORS = ['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#0000FF', '#FF0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#C0C0C0', '#000000'];

export const MAX_INDENT_LEVEL = 8;
export const INDENT_STEP_PX = 28;

export function clampIndent(level: number) {
  return Math.max(0, Math.min(MAX_INDENT_LEVEL, level));
}

export const BULLET_STYLES: ReadonlyArray<readonly [NonNullable<SlideElement['bulletStyle']>, string, string]> = [
  ['disc', '●', 'Chấm tròn đặc'],
  ['circle', '○', 'Chấm tròn rỗng'],
  ['square', '■', 'Ô vuông'],
  ['check', '✔', 'Dấu tích'],
  ['arrow', '➤', 'Mũi tên'],
];

export const NUMBER_FORMATS: ReadonlyArray<readonly [string, string]> = [
  ['1.', '1. 2. 3.'],
  ['1)', '1) 2) 3)'],
  ['I.', 'I. II. III.'],
  ['A.', 'A. B. C.'],
  ['a)', 'a) b) c)'],
  ['i.', 'i. ii. iii.'],
];

function toRoman(value: number): string {
  const table: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = value;
  let out = '';
  for (const [n, s] of table) {
    while (rest >= n) {
      out += s;
      rest -= n;
    }
  }
  return out;
}

export function listMarker(el: SlideElement, index: number): string {
  if (!el.isBullet) return '';
  if (el.bulletStyle !== 'number') return BULLET_STYLES.find(([id]) => id === (el.bulletStyle ?? 'disc'))?.[1] ?? '●';
  const n = index + 1;
  switch (el.fieldFormat) {
    case '1)':
      return `${n})`;
    case 'I.':
      return `${toRoman(n)}.`;
    case 'A.':
      return `${String.fromCharCode(64 + ((n - 1) % 26) + 1)}.`;
    case 'a)':
      return `${String.fromCharCode(96 + ((n - 1) % 26) + 1)})`;
    case 'i.':
      return `${toRoman(n).toLowerCase()}.`;
    default:
      return `${n}.`;
  }
}

export const DATE_FORMATS: ReadonlyArray<string> = [
  'dd/MM/yyyy',
  'd/M/yy',
  'EEEE, dd MMMM yyyy',
  'dd MMMM yyyy',
  'MMMM yyyy',
  'yyyy-MM-dd',
  'HH:mm',
  'dd/MM/yyyy HH:mm',
  'HH:mm:ss',
];

const VI_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDate(date: Date, pattern: string): string {
  const tokens: Record<string, string> = {
    EEEE: VI_WEEKDAYS[date.getDay()],
    MMMM: `tháng ${date.getMonth() + 1}`,
    yyyy: String(date.getFullYear()),
    yy: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    M: String(date.getMonth() + 1),
    d: String(date.getDate()),
  };
  return pattern.replace(/EEEE|MMMM|yyyy|yy|MM|dd|HH|mm|ss|M|d/g, (token) => tokens[token] ?? token);
}

export function fieldText(field: TextFieldType, slideIndex: number, format?: string, now = new Date()): string {
  if (field === 'slide-number') return String(slideIndex + 1);
  return formatDate(now, format || DATE_FORMATS[0]);
}

export function displayText(el: SlideElement, slideIndex: number): string {
  if (!el.field) return el.text ?? '';
  return fieldText(el.field, slideIndex, el.field === 'date' ? el.fieldFormat : undefined);
}

export function linesToSmartArt(text: string, palette: string[]): SmartArtItem[] {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[\s•●○■✔➤\-*\d.)]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return lines.map((line, index) => {
    const [title, ...rest] = line.split(/[:–-]\s+/);
    return { title: title.trim(), desc: rest.join(' - ').trim(), color: palette[index % palette.length] };
  });
}

export const SYMBOL_GROUPS: ReadonlyArray<{ name: string; chars: string }> = [
  { name: 'Dấu câu & ký hiệu chung', chars: '©®™§¶†‡•…‰′″‹›«»“”‘’–—¡¿¦¨ªº' },
  { name: 'Tiền tệ', chars: '₫$€£¥₩₹₽¢₺₴₦₱' },
  { name: 'Toán học', chars: '±×÷≠≈≡≤≥∞√∛∑∏∫∂∆∇∈∉∩∪⊂⊃⊆⊇∧∨¬∀∃∅°′∝∠⊥∥' },
  { name: 'Phân số & chỉ số', chars: '½⅓⅔¼¾⅕⅛⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉' },
  { name: 'Hy Lạp', chars: 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΘΛΞΠΣΦΨΩ' },
  { name: 'Mũi tên', chars: '←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔➔➜➤⟵⟶↩↪↺↻' },
  { name: 'Hình & dấu', chars: '■□▪▫▲△▼▽◆◇○●◎★☆✓✔✗✘✕☐☑☒♠♣♥♦♪♫☀☁☂☎✉✂✏⌛⌚' },
  { name: 'Đơn vị & kỹ thuật', chars: 'ΩµΦ℃℉㎡㎥㎏㎞㎝㎜№℡⌀∅' },
];

export const WORDART_PRESETS: ReadonlyArray<{ id: string; label: string; patch: Partial<SlideElement> }> = [
  { id: 'fill-dark', label: 'Tô đậm, bóng nhẹ', patch: { color: '#1F2937', textShadow: true, textOutline: undefined, textGradient: undefined, textGlow: undefined, fontWeight: 'bold' } },
  { id: 'fill-orange', label: 'Tô cam, viền trắng', patch: { color: '#D83B01', textOutline: '#FFFFFF', textShadow: true, textGradient: undefined, textGlow: undefined, fontWeight: 'bold' } },
  { id: 'outline-blue', label: 'Viền xanh, nền trắng', patch: { color: '#FFFFFF', textOutline: '#2563EB', textShadow: false, textGradient: undefined, textGlow: undefined, fontWeight: 'bold' } },
  { id: 'gradient-sunset', label: 'Chuyển sắc hoàng hôn', patch: { textGradient: 'linear-gradient(90deg,#F97316,#DB2777,#7C3AED)', textOutline: undefined, textGlow: undefined, fontWeight: 'bold' } },
  { id: 'gradient-ocean', label: 'Chuyển sắc đại dương', patch: { textGradient: 'linear-gradient(90deg,#0EA5E9,#2563EB,#1E3A8A)', textOutline: undefined, textGlow: undefined, fontWeight: 'bold' } },
  { id: 'gold', label: 'Kim loại vàng', patch: { textGradient: 'linear-gradient(180deg,#FDE68A,#D97706 55%,#92400E)', textOutline: '#78350F', textGlow: undefined, fontWeight: 'bold' } },
  { id: 'glow-cyan', label: 'Phát sáng xanh', patch: { color: '#0F172A', textGlow: '#22D3EE', textOutline: undefined, textGradient: undefined, fontWeight: 'bold' } },
  { id: 'neon-pink', label: 'Neon hồng', patch: { color: '#FFFFFF', textGlow: '#EC4899', textOutline: '#EC4899', textGradient: undefined, fontWeight: 'bold' } },
  { id: 'silver', label: 'Bạc phản chiếu', patch: { textGradient: 'linear-gradient(180deg,#F8FAFC,#94A3B8 50%,#334155)', textShadow: true, textOutline: undefined, textGlow: undefined, fontWeight: 'bold' } },
];

export function textDirectionStyle(direction: SlideElement['textDirection']): { writingMode?: 'vertical-rl'; transform?: string; textOrientation?: 'upright' } {
  if (direction === 'rotate-90') return { writingMode: 'vertical-rl' };
  if (direction === 'rotate-270') return { writingMode: 'vertical-rl', transform: 'rotate(180deg)' };
  if (direction === 'stacked') return { writingMode: 'vertical-rl', textOrientation: 'upright' };
  return {};
}
