import type { DocStyleDef, PageSettings } from '../../lib/storage';
import { DEFAULT_PAGE_KEY } from '../../lib/storage';
import { BASE_STYLES, STYLE_SETS, resolveStyles } from './docStyles';
import { ensureFont } from './fonts';

export type Palette = { id: string; label: string; title: string; subtitle: string; h1: string; h2: string; h3: string; h4: string; quote: string };
export type FontPair = { id: string; label: string; heading: string; body: string };
export type ThemeDef = { id: string; label: string; colors: string; fonts: string };
export type StyleSet = (typeof STYLE_SETS)[number];
export type SpacingPreset = { id: string; label: string; detail: string; after: number; line: number };

const palette = (id: string, label: string, title: string, subtitle: string, h1: string, h2: string, h3: string, h4: string, quote: string): Palette => ({ id, label, title, subtitle, h1, h2, h3, h4, quote });

export const PALETTES: Palette[] = [
  palette('office', 'Office', '#1f3864', '#5a6478', '#1f3864', '#2b579a', '#1f3864', '#2b579a', '#555f73'),
  palette('grayscale', 'Thang xám', '#111827', '#6b7280', '#1f2937', '#374151', '#4b5563', '#6b7280', '#6b7280'),
  palette('black', 'Đen trắng', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'),
  palette('blue', 'Xanh dương', '#1e3a8a', '#3b82f6', '#1d4ed8', '#2563eb', '#1e40af', '#3b82f6', '#1e40af'),
  palette('blue-green', 'Xanh lam ngọc', '#134e4a', '#0d9488', '#0f766e', '#0d9488', '#115e59', '#14b8a6', '#0f766e'),
  palette('green', 'Xanh lá', '#14532d', '#16a34a', '#166534', '#15803d', '#14532d', '#16a34a', '#166534'),
  palette('yellow-orange', 'Vàng cam', '#92400e', '#d97706', '#b45309', '#d97706', '#92400e', '#f59e0b', '#b45309'),
  palette('orange', 'Cam', '#7c2d12', '#ea580c', '#c2410c', '#ea580c', '#9a3412', '#f97316', '#c2410c'),
  palette('red', 'Đỏ', '#7f1d1d', '#dc2626', '#b91c1c', '#dc2626', '#991b1b', '#ef4444', '#b91c1c'),
  palette('red-violet', 'Đỏ tím', '#831843', '#db2777', '#be185d', '#db2777', '#9d174d', '#ec4899', '#be185d'),
  palette('violet', 'Tím', '#4c1d95', '#7c3aed', '#6d28d9', '#7c3aed', '#5b21b6', '#8b5cf6', '#6d28d9'),
  palette('slate', 'Xanh đá', '#0f172a', '#475569', '#1e293b', '#334155', '#475569', '#64748b', '#475569'),
];

export const FONT_PAIRS: FontPair[] = [
  { id: 'office', label: 'Office', heading: 'Arial', body: 'Arial' },
  { id: 'office-2013', label: 'Calibri', heading: 'Calibri Light', body: 'Calibri' },
  { id: 'formal', label: 'Hành chính', heading: 'Times New Roman', body: 'Times New Roman' },
  { id: 'segoe', label: 'Segoe', heading: 'Segoe UI Semibold', body: 'Segoe UI' },
  { id: 'cambria', label: 'Cambria và Calibri', heading: 'Cambria', body: 'Calibri' },
  { id: 'georgia', label: 'Georgia và Verdana', heading: 'Georgia', body: 'Verdana' },
  { id: 'garamond', label: 'Garamond', heading: 'Garamond', body: 'Garamond' },
  { id: 'gothic', label: 'Century Gothic', heading: 'Century Gothic', body: 'Century Gothic' },
  { id: 'roboto', label: 'Roboto', heading: 'Roboto', body: 'Roboto' },
  { id: 'montserrat', label: 'Montserrat và Open Sans', heading: 'Montserrat', body: 'Open Sans' },
  { id: 'vietnam', label: 'Be Vietnam Pro', heading: 'Be Vietnam Pro', body: 'Be Vietnam Pro' },
  { id: 'noto', label: 'Noto Serif và Noto Sans', heading: 'Noto Serif', body: 'Noto Sans' },
];

export const THEMES: ThemeDef[] = [
  { id: 'office', label: 'Office', colors: 'office', fonts: 'office' },
  { id: 'formal', label: 'Hành chính', colors: 'black', fonts: 'formal' },
  { id: 'facet', label: 'Khía cạnh', colors: 'green', fonts: 'gothic' },
  { id: 'ion', label: 'Ion', colors: 'blue-green', fonts: 'segoe' },
  { id: 'integral', label: 'Tích hợp', colors: 'blue', fonts: 'office-2013' },
  { id: 'organic', label: 'Hữu cơ', colors: 'yellow-orange', fonts: 'garamond' },
  { id: 'retrospect', label: 'Hoài cổ', colors: 'orange', fonts: 'cambria' },
  { id: 'slice', label: 'Lát cắt', colors: 'red-violet', fonts: 'montserrat' },
  { id: 'wisp', label: 'Làn khói', colors: 'violet', fonts: 'georgia' },
  { id: 'gallery', label: 'Phòng tranh', colors: 'red', fonts: 'noto' },
  { id: 'slate', label: 'Đá phiến', colors: 'slate', fonts: 'vietnam' },
];

export const SPACING_PRESETS: SpacingPreset[] = [
  { id: 'none', label: 'Không giãn đoạn', detail: 'Sau đoạn 0 pt, dòng 1,0', after: 0, line: 1 },
  { id: 'compact', label: 'Gọn', detail: 'Sau đoạn 4 pt, dòng 1,0', after: 4, line: 1 },
  { id: 'tight', label: 'Khít', detail: 'Sau đoạn 6 pt, dòng 1,15', after: 6, line: 1.15 },
  { id: 'open', label: 'Thoáng', detail: 'Sau đoạn 10 pt, dòng 1,15', after: 10, line: 1.15 },
  { id: 'relaxed', label: 'Rộng rãi', detail: 'Sau đoạn 6 pt, dòng 1,5', after: 6, line: 1.5 },
  { id: 'double', label: 'Dòng đôi', detail: 'Sau đoạn 8 pt, dòng 2,0', after: 8, line: 2 },
];

export const EFFECTS: { id: string; label: string; detail: string }[] = [
  { id: 'none', label: 'Không hiệu ứng', detail: 'Ảnh và hộp chữ giữ nguyên' },
  { id: 'subtle', label: 'Nhẹ nhàng', detail: 'Bóng mờ rất nhẹ, bo góc nhỏ' },
  { id: 'shadow', label: 'Đổ bóng', detail: 'Bóng đậm dưới ảnh và hộp chữ' },
  { id: 'glow', label: 'Phát sáng', detail: 'Viền sáng màu xanh quanh đối tượng' },
  { id: 'bevel', label: 'Vát nổi', detail: 'Cạnh sáng tối tạo khối nổi' },
  { id: 'reflection', label: 'Phản chiếu', detail: 'Bóng soi phía dưới ảnh' },
  { id: 'soft', label: 'Viền mềm', detail: 'Cạnh ảnh mờ dần' },
];

const CUSTOM_PALETTES_KEY = 'minh-docs-custom-palettes';
const CUSTOM_FONTS_KEY = 'minh-docs-custom-fonts';
const CUSTOM_SETS_KEY = 'minh-docs-custom-style-sets';

const readList = <T,>(key: string): T[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
};

const writeList = (key: string, list: unknown[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
};

export const customPalettes = () => readList<Palette>(CUSTOM_PALETTES_KEY);
export const customFontPairs = () => readList<FontPair>(CUSTOM_FONTS_KEY);
export const customStyleSets = () => readList<StyleSet>(CUSTOM_SETS_KEY);
export const allPalettes = () => [...PALETTES, ...customPalettes()];
export const allFontPairs = () => [...FONT_PAIRS, ...customFontPairs()];
export const allStyleSets = () => [...STYLE_SETS, ...customStyleSets()];
export const saveCustomPalette = (item: Palette) => writeList(CUSTOM_PALETTES_KEY, [...customPalettes().filter((p) => p.id !== item.id), item]);
export const saveCustomFontPair = (item: FontPair) => writeList(CUSTOM_FONTS_KEY, [...customFontPairs().filter((p) => p.id !== item.id), item]);
export const saveCustomStyleSet = (item: StyleSet) => writeList(CUSTOM_SETS_KEY, [...customStyleSets().filter((p) => p.id !== item.id), item]);

const paletteColors = (item: Palette): Record<string, string> => ({ title: item.title, subtitle: item.subtitle, h1: item.h1, h2: item.h2, h3: item.h3, h4: item.h4, h5: item.h4, h6: item.h3, quote: item.quote });

const withPalette = (styles: Record<string, DocStyleDef>, item: Palette) => {
  const colors = paletteColors(item);
  return Object.fromEntries(Object.entries(styles).map(([id, def]) => [id, colors[id] ? { ...def, color: colors[id] } : def]));
};

const HEADING_IDS = new Set(['title', 'subtitle', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const withFonts = (styles: Record<string, DocStyleDef>, pair: FontPair) => Object.fromEntries(Object.entries(styles).map(([id, def]) => [id, HEADING_IDS.has(id) ? { ...def, font: pair.heading } : def]));

export const palettePatch = (page: PageSettings, item: Palette): Partial<PageSettings> => ({ styles: withPalette(resolveStyles(page), item), colorsId: item.id, themeId: undefined });

export const fontPatch = (page: PageSettings, pair: FontPair): Partial<PageSettings> => {
  ensureFont(pair.heading);
  ensureFont(pair.body);
  return { styles: withFonts(resolveStyles(page), pair), fontFamily: pair.body, fontsId: pair.id, themeId: undefined };
};

export const themePatch = (page: PageSettings, theme: ThemeDef): Partial<PageSettings> => {
  const colors = allPalettes().find((p) => p.id === theme.colors) ?? PALETTES[0];
  const pair = allFontPairs().find((p) => p.id === theme.fonts) ?? FONT_PAIRS[0];
  ensureFont(pair.heading);
  ensureFont(pair.body);
  return { styles: withFonts(withPalette(resolveStyles(page), colors), pair), fontFamily: pair.body, themeId: theme.id, colorsId: colors.id, fontsId: pair.id };
};

export const spacingPatch = (page: PageSettings, id: string, after: number, line: number): Partial<PageSettings> => {
  const styles = resolveStyles(page);
  return { styles: { ...styles, normal: { ...styles.normal, after, line } }, spacingId: id };
};

export const styleSetPatch = (set: StyleSet): Partial<PageSettings> => {
  ensureFont(set.font);
  return { styles: set.styles, styleSet: set.id, fontFamily: set.font, fontSize: set.size, themeId: undefined, colorsId: undefined, fontsId: undefined, spacingId: undefined };
};

export const resetDesignPatch = (): Partial<PageSettings> => ({ styles: BASE_STYLES, styleSet: 'office', fontFamily: 'Arial', fontSize: 12, themeId: undefined, colorsId: undefined, fontsId: undefined, spacingId: undefined, effect: undefined });

const DEFAULT_FIELDS: (keyof PageSettings)[] = ['size', 'orientation', 'margins', 'gutter', 'mirrorMargins', 'fontFamily', 'fontSize', 'styles', 'styleSet', 'themeId', 'colorsId', 'fontsId', 'spacingId', 'effect', 'pageColor', 'pageBorder', 'pageBorderColor', 'pageBorderWidth'];

export const saveAsDefaultPage = (page: PageSettings) => {
  const picked = Object.fromEntries(DEFAULT_FIELDS.filter((key) => page[key] !== undefined).map((key) => [key, page[key]]));
  try {
    localStorage.setItem(DEFAULT_PAGE_KEY, JSON.stringify(picked));
    return true;
  } catch {
    return false;
  }
};

export const clearDefaultPage = () => {
  try {
    localStorage.removeItem(DEFAULT_PAGE_KEY);
  } catch {
    return;
  }
};

export const paletteSwatches = (item: Palette) => [item.title, item.h1, item.h2, item.h3, item.h4, item.subtitle];
