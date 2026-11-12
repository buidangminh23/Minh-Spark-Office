import { SLIDE_THEMES } from './slideThemes';
import type { PresentationData, SlideBackground, SlideData, SlideElement, SlideTheme, ThemeOverrides } from './slideTypes';

export const FALLBACK_THEME_ID = 'office-classic';

type ThemeColors = NonNullable<ThemeOverrides['colors']>;
type ColorRole = keyof ThemeColors;

const COLOR_ROLES: ColorRole[] = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'cardBackground', 'titleColor', 'textColor'];

export function baseTheme(themeId: string | undefined): SlideTheme {
  return SLIDE_THEMES[themeId ?? ''] ?? SLIDE_THEMES[FALLBACK_THEME_ID];
}

const isDark = (hex: string) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const value = parseInt(match[1], 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance < 0.5;
};

export function themeVariant(theme: SlideTheme, variant: number): Partial<SlideTheme> {
  switch (variant) {
    case 1:
      return { primaryColor: theme.secondaryColor, secondaryColor: theme.primaryColor };
    case 2:
      return isDark(theme.backgroundColor)
        ? { backgroundColor: '#FFFFFF', cardBackground: '#F1F5F9', titleColor: '#0F172A', textColor: '#475569' }
        : { backgroundColor: '#0F172A', cardBackground: '#1E293B', titleColor: '#F8FAFC', textColor: '#CBD5E1' };
    case 3:
      return { primaryColor: theme.accentColor, accentColor: theme.primaryColor, cardBackground: isDark(theme.backgroundColor) ? '#1E293B' : '#FFF7ED' };
    default:
      return {};
  }
}

export const THEME_VARIANT_LABELS = ['Gốc', 'Đảo màu nhấn', 'Đảo nền sáng/tối', 'Nhấn phụ'];

export function resolveTheme(presentation: Pick<PresentationData, 'themeId' | 'themeOverrides'>): SlideTheme {
  const base = baseTheme(presentation.themeId);
  const overrides = presentation.themeOverrides;
  if (!overrides) return base;
  return {
    ...base,
    ...themeVariant(base, overrides.variant ?? 0),
    ...(overrides.colors ?? {}),
    ...(overrides.fonts ? { titleFont: overrides.fonts.titleFont, bodyFont: overrides.fonts.bodyFont } : {}),
  };
}

export interface ColorScheme {
  id: string;
  name: string;
  colors: ThemeColors;
}

const scheme = (id: string, name: string, primaryColor: string, secondaryColor: string, accentColor: string, titleColor: string, textColor: string): ColorScheme => ({
  id,
  name,
  colors: { primaryColor, secondaryColor, accentColor, titleColor, textColor },
});

export const COLOR_SCHEMES: ColorScheme[] = [
  scheme('office', 'Office', '#D83B01', '#107C41', '#0078D4', '#1E293B', '#475569'),
  scheme('office-2013', 'Office 2013 - 2022', '#4472C4', '#ED7D31', '#A5A5A5', '#1F2937', '#44546A'),
  scheme('grayscale', 'Thang xám', '#404040', '#7F7F7F', '#A6A6A6', '#000000', '#404040'),
  scheme('blue-warm', 'Xanh ấm', '#4A66AC', '#629DD1', '#297FD5', '#242852', '#3B4A6B'),
  scheme('blue', 'Xanh dương', '#0F6FC6', '#009DD9', '#0BD0D9', '#17406D', '#334155'),
  scheme('blue-green', 'Xanh lam lục', '#3494BA', '#58B6C0', '#75BDA7', '#373545', '#475569'),
  scheme('green', 'Xanh lá', '#549E39', '#8AB833', '#C0CF3A', '#455F51', '#3F4E45'),
  scheme('green-yellow', 'Lục vàng', '#99CB38', '#63A537', '#37A76F', '#455F51', '#475569'),
  scheme('yellow', 'Vàng', '#FFCA08', '#F8931D', '#CE8D3E', '#39302A', '#4B3F35'),
  scheme('yellow-orange', 'Vàng cam', '#F0A22E', '#A5644E', '#B58B80', '#4E3B30', '#5B4A3E'),
  scheme('orange', 'Cam', '#E48312', '#BD582C', '#865640', '#637052', '#4B5563'),
  scheme('orange-red', 'Cam đỏ', '#D34817', '#9B2D1F', '#A28E6A', '#696464', '#4B5563'),
  scheme('red-orange', 'Đỏ cam', '#E84C22', '#FFBD47', '#B64926', '#505046', '#4B5563'),
  scheme('red', 'Đỏ', '#A5300F', '#D55816', '#E19825', '#323232', '#4B4B4B'),
  scheme('red-violet', 'Đỏ tím', '#E32D91', '#C830CC', '#4EA6DC', '#454551', '#4B5563'),
  scheme('violet', 'Tím', '#AD84C6', '#8784C7', '#5D739A', '#373545', '#4B5563'),
  scheme('violet-2', 'Tím II', '#92278F', '#9B57D3', '#755DD9', '#632E62', '#4B5563'),
  scheme('median', 'Trung vị', '#94B6D2', '#DD8047', '#A5AB81', '#775F55', '#5B4A3E'),
  scheme('paper', 'Giấy', '#A5B592', '#F3A447', '#E7BC29', '#444D26', '#4B5563'),
  scheme('marquee', 'Bảng hiệu', '#418AB3', '#A6B727', '#F69200', '#5E5E5E', '#4B5563'),
  scheme('slipstream', 'Dòng chảy', '#4E67C8', '#5ECCF3', '#A7EA52', '#212745', '#334155'),
  scheme('aspect', 'Diện mạo', '#F07F09', '#9F2936', '#1B587C', '#323232', '#4B5563'),
];

export interface FontPair {
  id: string;
  name: string;
  titleFont: string;
  bodyFont: string;
}

const fontStack = (family: string) => `'${family}', 'Segoe UI', sans-serif`;

export const FONT_PAIRS: FontPair[] = [
  { id: 'office', name: 'Office', titleFont: fontStack('Segoe UI'), bodyFont: fontStack('Segoe UI') },
  { id: 'calibri', name: 'Calibri Light - Calibri', titleFont: fontStack('Calibri Light'), bodyFont: fontStack('Calibri') },
  { id: 'cambria', name: 'Cambria - Calibri', titleFont: fontStack('Cambria'), bodyFont: fontStack('Calibri') },
  { id: 'arial', name: 'Arial', titleFont: fontStack('Arial'), bodyFont: fontStack('Arial') },
  { id: 'times', name: 'Times New Roman', titleFont: fontStack('Times New Roman'), bodyFont: fontStack('Times New Roman') },
  { id: 'montserrat', name: 'Montserrat - Segoe UI', titleFont: fontStack('Montserrat'), bodyFont: fontStack('Segoe UI') },
  { id: 'playfair', name: 'Playfair Display - Be Vietnam Pro', titleFont: fontStack('Playfair Display'), bodyFont: fontStack('Be Vietnam Pro') },
  { id: 'vietnam', name: 'Be Vietnam Pro', titleFont: fontStack('Be Vietnam Pro'), bodyFont: fontStack('Be Vietnam Pro') },
  { id: 'roboto', name: 'Roboto', titleFont: fontStack('Roboto'), bodyFont: fontStack('Roboto') },
  { id: 'georgia', name: 'Georgia - Verdana', titleFont: fontStack('Georgia'), bodyFont: fontStack('Verdana') },
  { id: 'trebuchet', name: 'Trebuchet MS', titleFont: fontStack('Trebuchet MS'), bodyFont: fontStack('Trebuchet MS') },
  { id: 'impact', name: 'Arial Black - Arial', titleFont: fontStack('Arial Black'), bodyFont: fontStack('Arial') },
];

export const THEME_EFFECTS: ReadonlyArray<readonly [NonNullable<ThemeOverrides['effects']>, string]> = [
  ['none', 'Không hiệu ứng'],
  ['subtle', 'Tinh tế'],
  ['moderate', 'Vừa phải'],
  ['intense', 'Mạnh'],
];

const EFFECT_PATCH: Record<NonNullable<ThemeOverrides['effects']>, Partial<SlideElement>> = {
  none: { shapeShadow: false, glow: false },
  subtle: { shapeShadow: true, shadowBlur: 6, shadowOffsetY: 2, shadowColor: 'rgba(15,23,42,0.18)', glow: false },
  moderate: { shapeShadow: true, shadowBlur: 14, shadowOffsetY: 6, shadowColor: 'rgba(15,23,42,0.28)', glow: false },
  intense: { shapeShadow: true, shadowBlur: 26, shadowOffsetY: 12, shadowColor: 'rgba(15,23,42,0.42)', glow: true },
};

const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();

function remapColor(value: string | undefined, from: SlideTheme, to: SlideTheme): string | undefined {
  if (!value) return value;
  const key = normalize(value);
  const role = COLOR_ROLES.find((r) => normalize(from[r]) === key);
  return role ? to[role] : value;
}

function remapBackground(background: SlideBackground, from: SlideTheme, to: SlideTheme): SlideBackground {
  if (background.type !== 'solid') return background;
  return { ...background, value: remapColor(background.value, from, to) ?? background.value };
}

export function remapElementTheme(el: SlideElement, from: SlideTheme, to: SlideTheme): SlideElement {
  const next: SlideElement = {
    ...el,
    color: remapColor(el.color, from, to),
    fill: remapColor(el.fill, from, to),
    stroke: remapColor(el.stroke, from, to),
    tableHeaderColor: remapColor(el.tableHeaderColor, from, to),
  };
  if (el.type === 'text' || el.text) {
    const fromFont = el.isTitle ? from.titleFont : from.bodyFont;
    if (!el.fontFamily || normalize(el.fontFamily) === normalize(fromFont) || normalize(el.fontFamily) === normalize(from.bodyFont) || normalize(el.fontFamily) === normalize(from.titleFont)) {
      next.fontFamily = el.isTitle ? to.titleFont : to.bodyFont;
    }
  }
  return next;
}

export function remapSlideTheme(slide: SlideData, from: SlideTheme, to: SlideTheme): SlideData {
  return {
    ...slide,
    background: remapBackground(slide.background, from, to),
    elements: slide.elements.map((el) => remapElementTheme(el, from, to)),
  };
}

export function applyThemeOverrides(presentation: PresentationData, overrides: ThemeOverrides | undefined): PresentationData {
  const from = resolveTheme(presentation);
  const nextPresentation: PresentationData = { ...presentation, themeOverrides: overrides };
  const to = resolveTheme(nextPresentation);
  const effectChanged = overrides?.effects !== presentation.themeOverrides?.effects && overrides?.effects;
  return {
    ...nextPresentation,
    slides: presentation.slides.map((slide) => {
      const remapped = remapSlideTheme(slide, from, to);
      if (!effectChanged) return remapped;
      const patch = EFFECT_PATCH[overrides.effects!];
      return {
        ...remapped,
        elements: remapped.elements.map((el) => (el.type === 'shape' || el.type === 'image' || el.type === 'smartart' ? { ...el, ...patch } : el)),
      };
    }),
  };
}

export function backgroundStyles(theme: SlideTheme): SlideBackground[] {
  return [
    { type: 'solid', value: theme.backgroundColor },
    { type: 'solid', value: isDark(theme.backgroundColor) ? '#1E293B' : '#F1F5F9' },
    { type: 'solid', value: isDark(theme.backgroundColor) ? '#F8FAFC' : '#0F172A' },
    { type: 'solid', value: theme.primaryColor },
    { type: 'gradient', value: `linear-gradient(180deg, ${theme.backgroundColor} 0%, ${isDark(theme.backgroundColor) ? '#1E293B' : '#E2E8F0'} 100%)` },
    { type: 'gradient', value: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)` },
    { type: 'gradient', value: `radial-gradient(circle at 30% 20%, ${theme.backgroundColor} 0%, ${isDark(theme.backgroundColor) ? '#020617' : '#CBD5E1'} 100%)` },
    { type: 'gradient', value: `linear-gradient(135deg, ${theme.accentColor} 0%, ${theme.primaryColor} 100%)` },
    { type: 'gradient', value: `linear-gradient(90deg, ${theme.titleColor} 0%, ${theme.primaryColor} 100%)` },
    { type: 'gradient', value: `linear-gradient(180deg, #FFFFFF 0%, ${theme.secondaryColor}33 100%)` },
    { type: 'gradient', value: `linear-gradient(160deg, #0F172A 0%, ${theme.primaryColor} 140%)` },
    { type: 'gradient', value: `repeating-linear-gradient(45deg, ${theme.backgroundColor} 0 14px, ${isDark(theme.backgroundColor) ? '#111827' : '#F1F5F9'} 14px 28px)` },
  ];
}

export function backgroundCss(background: SlideBackground): string {
  if (background.type === 'image') return `url("${background.value}") center / cover no-repeat`;
  return background.value;
}
