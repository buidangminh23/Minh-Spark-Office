import type { AppSettings, OfficeThemeId, ThemeMode } from './appSettings';

export type ChromeFamily = 'modern' | '2016' | '2013' | '2010' | '2007';
export type ChromeVars = Record<string, string>;

export const APP_TOKEN = 'APP';
export const PREVIEW_APP_COLOR = '#2b579a';

const GRADIENT = (top: string, bottom: string) => `linear-gradient(${top}, ${bottom})`;

const BASE: ChromeVars = {
  'title-border': 'transparent',
  'tabs-border': '#d4d4d4',
  'tab-hover-bg': 'rgba(0, 0, 0, 0.06)',
  'tab-active-border': 'transparent',
  'tab-radius': '0',
  'file-bg': APP_TOKEN,
  'file-fg': '#ffffff',
  'file-radius': '0',
  'ribbon-fg': '#262626',
  'ribbon-border': '#d4d4d4',
  'group-bg': 'transparent',
  'group-label-bg': 'transparent',
  'hover-bg': '#e1e1e1',
  'hover-border': 'transparent',
  'pressed-bg': '#c8c8c8',
  'pressed-border': 'transparent',
  'button-radius': '2px',
  'input-bg': '#ffffff',
  'input-fg': '#262626',
  'input-border': '#c6c6c6',
  'status-border': 'transparent',
  'ctl-bg': '#ffffff',
  'ctl-fg': '#444444',
  'ctl-border': '#d4d4d4',
  'ctl-hover': '#f0f0f0',
  'primary-bg': APP_TOKEN,
  'primary-fg': '#ffffff',
};

const DARK_TITLE: ChromeVars = {
  'ctl-bg': 'rgba(255, 255, 255, 0.12)',
  'ctl-fg': '#ffffff',
  'ctl-border': 'rgba(255, 255, 255, 0.22)',
  'ctl-hover': 'rgba(255, 255, 255, 0.22)',
  'tab-hover-bg': 'rgba(255, 255, 255, 0.14)',
};

const CLASSIC: ChromeVars = {
  'tab-radius': '3px 3px 0 0',
  'file-radius': '3px 3px 0 0',
  'button-radius': '3px',
  'hover-bg': GRADIENT('#fef0c7', '#fdd98a'),
  'hover-border': '#e6c16b',
  'hover-fg': '#1a1a1a',
  'pressed-bg': GRADIENT('#fbd17a', '#f7b54b'),
  'pressed-border': '#c2964a',
  'pressed-fg': '#1a1a1a',
};

const ORB: ChromeVars = {
  'file-bg': `radial-gradient(circle at 50% 28%, color-mix(in srgb, ${APP_TOKEN} 45%, white), ${APP_TOKEN} 72%)`,
  'file-radius': '14px',
};

export type ThemeCard = { id: ThemeMode; label: string; group: string; family: ChromeFamily };

type OfficeThemeDef = { label: string; group: string; family: Exclude<ChromeFamily, 'modern'>; vars: ChromeVars };

const define = (label: string, group: string, family: OfficeThemeDef['family'], ...layers: ChromeVars[]): OfficeThemeDef => {
  const vars = Object.assign({}, BASE, ...layers);
  vars['hover-fg'] ??= vars['ribbon-fg'];
  vars['pressed-fg'] ??= vars['ribbon-fg'];
  vars['tab-hover-fg'] ??= vars['tab-fg'];
  return { label, group, family, vars };
};

const G16 = 'Office 2016 – 2019';
const G13 = 'Office 2013';
const G10 = 'Office 2010';
const G07 = 'Office 2007';

export const OFFICE_THEMES: Record<OfficeThemeId, OfficeThemeDef> = {
  'o16-colorful': define('Nhiều màu', G16, '2016', DARK_TITLE, {
    'title-bg': APP_TOKEN, 'title-fg': '#ffffff', 'tabs-bg': APP_TOKEN, 'tabs-border': '#d6d6d6', 'tab-fg': '#ffffff',
    'tab-active-bg': '#f3f3f3', 'tab-active-fg': APP_TOKEN, 'file-bg': `color-mix(in srgb, ${APP_TOKEN} 78%, black)`,
    'ribbon-bg': '#f3f3f3', 'group-sep': '#d6d6d6', 'group-label': '#666666', 'canvas-bg': '#e6e6e6',
    'status-bg': APP_TOKEN, 'status-fg': '#ffffff', 'primary-bg': '#ffffff', 'primary-fg': APP_TOKEN,
  }),
  'o16-white': define('Trắng', G16, '2016', {
    'title-bg': '#ffffff', 'title-fg': '#444444', 'title-border': '#e1e1e1', 'tabs-bg': '#ffffff', 'tab-fg': '#444444',
    'tab-active-bg': '#ffffff', 'tab-active-fg': APP_TOKEN, 'tab-active-border': '#d4d4d4',
    'ribbon-bg': '#ffffff', 'group-sep': '#e1e1e1', 'group-label': '#666666', 'canvas-bg': '#f0f0f0',
    'status-bg': '#f3f3f3', 'status-fg': '#444444', 'status-border': '#e1e1e1',
  }),
  'o16-darkgray': define('Xám đậm', G16, '2016', DARK_TITLE, {
    'title-bg': '#444444', 'title-fg': '#ffffff', 'tabs-bg': '#444444', 'tabs-border': '#b2b2b2', 'tab-fg': '#f0f0f0',
    'tab-active-bg': '#d4d4d4', 'tab-active-fg': '#262626', 'file-bg': '#2f2f2f',
    'ribbon-bg': '#d4d4d4', 'ribbon-border': '#b2b2b2', 'group-sep': '#b2b2b2', 'group-label': '#444444',
    'hover-bg': '#c0c0c0', 'pressed-bg': '#ababab', 'canvas-bg': '#6a6a6a', 'status-bg': '#444444', 'status-fg': '#f0f0f0',
  }),
  'o16-black': define('Đen', G16, '2016', DARK_TITLE, {
    'title-bg': '#262626', 'title-fg': '#ffffff', 'tabs-bg': '#262626', 'tabs-border': '#444444', 'tab-fg': '#e0e0e0',
    'tab-active-bg': '#444444', 'tab-active-fg': '#ffffff', 'file-bg': '#111111',
    'ribbon-bg': '#444444', 'ribbon-fg': '#f0f0f0', 'ribbon-border': '#262626', 'group-sep': '#5c5c5c', 'group-label': '#c8c8c8',
    'hover-bg': '#5a5a5a', 'pressed-bg': '#6e6e6e', 'input-bg': '#5c5c5c', 'input-fg': '#ffffff', 'input-border': '#6e6e6e',
    'canvas-bg': '#1f1f1f', 'status-bg': '#262626', 'status-fg': '#e0e0e0',
  }),
  'o13-white': define('Trắng', G13, '2013', {
    'title-bg': '#ffffff', 'title-fg': '#444444', 'tabs-bg': '#ffffff', 'tab-fg': '#444444',
    'tab-active-bg': '#ffffff', 'tab-active-fg': APP_TOKEN, 'tab-active-border': '#d4d4d4',
    'ribbon-bg': '#ffffff', 'group-sep': '#e1e1e1', 'group-label': '#666666', 'canvas-bg': '#e3e3e3',
    'hover-bg': '#dcdcdc', 'status-bg': APP_TOKEN, 'status-fg': '#ffffff',
  }),
  'o13-lightgray': define('Xám nhạt', G13, '2013', {
    'title-bg': '#f3f3f3', 'title-fg': '#444444', 'tabs-bg': '#f3f3f3', 'tab-fg': '#444444',
    'tab-active-bg': '#fafafa', 'tab-active-fg': APP_TOKEN, 'tab-active-border': '#d4d4d4',
    'ribbon-bg': '#fafafa', 'group-sep': '#e1e1e1', 'group-label': '#666666', 'canvas-bg': '#dcdcdc',
    'hover-bg': '#dcdcdc', 'status-bg': APP_TOKEN, 'status-fg': '#ffffff',
  }),
  'o13-darkgray': define('Xám đậm', G13, '2013', {
    'title-bg': '#dedede', 'title-fg': '#333333', 'tabs-bg': '#dedede', 'tabs-border': '#ababab', 'tab-fg': '#333333',
    'tab-active-bg': '#f3f3f3', 'tab-active-fg': APP_TOKEN, 'tab-active-border': '#ababab',
    'ribbon-bg': '#f3f3f3', 'ribbon-border': '#ababab', 'group-sep': '#d4d4d4', 'group-label': '#555555', 'canvas-bg': '#c6c6c6',
    'hover-bg': '#d4d4d4', 'status-bg': APP_TOKEN, 'status-fg': '#ffffff',
  }),
  'o10-blue': define('Xanh lam', G10, '2010', CLASSIC, {
    'title-bg': GRADIENT('#e3ecf7', '#d3e1f1'), 'title-fg': '#1e395b', 'tabs-bg': '#d3e1f1', 'tabs-border': '#a5bfdd', 'tab-fg': '#1e395b',
    'tab-hover-bg': 'rgba(255, 255, 255, 0.55)', 'tab-active-bg': GRADIENT('#ffffff', '#eaf1fa'), 'tab-active-fg': '#1e395b', 'tab-active-border': '#a5bfdd',
    'ribbon-bg': GRADIENT('#fdfeff', '#dbe5f3'), 'ribbon-fg': '#1e395b', 'ribbon-border': '#8db2e3', 'group-sep': '#b7cbe4', 'group-label': '#3e6aaa',
    'canvas-bg': '#cfdcec', 'status-bg': GRADIENT('#e3ecf7', '#c7d8ed'), 'status-fg': '#1e395b', 'ctl-fg': '#1e395b', 'ctl-border': '#a5bfdd',
  }),
  'o10-silver': define('Bạc', G10, '2010', CLASSIC, {
    'title-bg': GRADIENT('#f0f2f5', '#dfe3e8'), 'title-fg': '#3b3b3b', 'tabs-bg': '#dfe3e8', 'tabs-border': '#b6bac0', 'tab-fg': '#3b3b3b',
    'tab-hover-bg': 'rgba(255, 255, 255, 0.6)', 'tab-active-bg': GRADIENT('#ffffff', '#f0f2f5'), 'tab-active-fg': '#3b3b3b', 'tab-active-border': '#b6bac0',
    'ribbon-bg': GRADIENT('#ffffff', '#e3e7ec'), 'ribbon-fg': '#2b2b2b', 'ribbon-border': '#b6bac0', 'group-sep': '#c5c9cf', 'group-label': '#4c535c',
    'canvas-bg': '#e0e3e8', 'status-bg': GRADIENT('#f0f2f5', '#dadee4'), 'status-fg': '#3b3b3b', 'ctl-border': '#b6bac0',
  }),
  'o10-black': define('Đen', G10, '2010', CLASSIC, DARK_TITLE, {
    'title-bg': GRADIENT('#474747', '#2b2b2b'), 'title-fg': '#ffffff', 'tabs-bg': '#2b2b2b', 'tabs-border': '#7a7a7a', 'tab-fg': '#ffffff',
    'tab-active-bg': GRADIENT('#f4f4f4', '#dcdcdc'), 'tab-active-fg': '#111111', 'tab-active-border': '#7a7a7a',
    'ribbon-bg': GRADIENT('#f2f2f2', '#d4d4d4'), 'ribbon-fg': '#1a1a1a', 'ribbon-border': '#7a7a7a', 'group-sep': '#b4b4b4', 'group-label': '#444444',
    'canvas-bg': '#5e5e5e', 'status-bg': GRADIENT('#3d3d3d', '#262626'), 'status-fg': '#ffffff',
  }),
  'o07-blue': define('Xanh lam', G07, '2007', CLASSIC, ORB, {
    'title-bg': GRADIENT('#dbe8f9', '#c3d9f3'), 'title-fg': '#15428b', 'tabs-bg': '#bfdbff', 'tabs-border': '#8db2e3', 'tab-fg': '#15428b',
    'tab-hover-bg': 'rgba(255, 255, 255, 0.55)', 'tab-active-bg': GRADIENT('#ffffff', '#d7e6f8'), 'tab-active-fg': '#15428b', 'tab-active-border': '#8db2e3',
    'ribbon-bg': GRADIENT('#dbe7f7', '#c4d9f2'), 'ribbon-fg': '#15428b', 'ribbon-border': '#8db2e3', 'group-sep': '#8db2e3', 'group-label': '#15428b',
    'group-bg': GRADIENT('#e8f1fc', '#cadff5'), 'group-label-bg': '#c2d9f1',
    'canvas-bg': '#9ebbdf', 'status-bg': GRADIENT('#d6e6f9', '#bed6f3'), 'status-fg': '#15428b', 'ctl-fg': '#15428b', 'ctl-border': '#8db2e3',
  }),
  'o07-silver': define('Bạc', G07, '2007', CLASSIC, ORB, {
    'title-bg': GRADIENT('#eef0f3', '#d9dde3'), 'title-fg': '#3b3b3b', 'tabs-bg': '#e2e5e9', 'tabs-border': '#a5acb5', 'tab-fg': '#3b3b3b',
    'tab-hover-bg': 'rgba(255, 255, 255, 0.6)', 'tab-active-bg': GRADIENT('#ffffff', '#e9ecef'), 'tab-active-fg': '#3b3b3b', 'tab-active-border': '#a5acb5',
    'ribbon-bg': GRADIENT('#eef0f3', '#d6dbe1'), 'ribbon-fg': '#2b2b2b', 'ribbon-border': '#a5acb5', 'group-sep': '#a5acb5', 'group-label': '#4c535c',
    'group-bg': GRADIENT('#f7f8fa', '#dde1e6'), 'group-label-bg': '#c8ced6',
    'canvas-bg': '#d6dbe2', 'status-bg': GRADIENT('#eef0f3', '#d3d8de'), 'status-fg': '#3b3b3b', 'ctl-border': '#a5acb5',
  }),
  'o07-black': define('Đen', G07, '2007', CLASSIC, ORB, DARK_TITLE, {
    'title-bg': GRADIENT('#5a5a5a', '#2a2a2a'), 'title-fg': '#ffffff', 'tabs-bg': '#1f1f1f', 'tabs-border': '#888888', 'tab-fg': '#ffffff',
    'tab-active-bg': GRADIENT('#e6e6e6', '#c8c8c8'), 'tab-active-fg': '#111111', 'tab-active-border': '#888888',
    'ribbon-bg': GRADIENT('#d9d9d9', '#bcbcbc'), 'ribbon-fg': '#1a1a1a', 'ribbon-border': '#555555', 'group-sep': '#969696', 'group-label': '#ffffff',
    'group-bg': GRADIENT('#e3e3e3', '#c4c4c4'), 'group-label-bg': '#6f6f6f',
    'canvas-bg': '#535353', 'status-bg': GRADIENT('#4a4a4a', '#232323'), 'status-fg': '#ffffff',
  }),
};

export const MODERN_PREVIEW: Record<'light' | 'dark', ChromeVars> = {
  light: {
    ...BASE, 'title-bg': '#ffffff', 'title-fg': '#1e2430', 'title-border': '#e3e7ee', 'tabs-bg': '#f1f3f7', 'tabs-border': '#dce1e8', 'tab-fg': '#374151',
    'tab-active-bg': '#ffffff', 'tab-active-fg': APP_TOKEN, 'ribbon-bg': '#fbfcfd', 'ribbon-fg': '#1f2937', 'group-sep': '#e2e8f0', 'group-label': '#64748b',
    'canvas-bg': '#eef1f5', 'status-bg': '#ffffff', 'status-fg': '#798394', 'pressed-bg': '#e0e7ff', 'pressed-fg': '#1e40af',
  },
  dark: {
    ...BASE, 'title-bg': '#161c28', 'title-fg': '#e5e9f0', 'tabs-bg': '#1b2231', 'tabs-border': '#2a3447', 'tab-fg': '#c3cad6',
    'tab-active-bg': '#232c3d', 'tab-active-fg': '#7aa7ff', 'ribbon-bg': '#232c3d', 'ribbon-fg': '#e5e9f0', 'group-sep': '#323d53', 'group-label': '#8b95a7',
    'canvas-bg': '#0f1420', 'status-bg': '#161c28', 'status-fg': '#8b95a7', 'pressed-bg': '#2c3d63', 'pressed-fg': '#c7d8ff',
  },
};

export type CustomColor = { hue: number; sat: number; light: number; tint: number };

export const customColorOf = (settings: Pick<AppSettings, 'customHue' | 'customSat' | 'customLight' | 'customTint'>): CustomColor => ({
  hue: clamp(Math.round(settings.customHue), 0, 359),
  sat: clamp(Math.round(settings.customSat), 0, 100),
  light: clamp(Math.round(settings.customLight), 10, 92),
  tint: clamp(Math.round(settings.customTint), 0, 30),
});

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

export const hslString = (hue: number, sat: number, light: number) => `hsl(${hue} ${sat}% ${light}%)`;

export function hslToRgb(hue: number, sat: number, light: number): [number, number, number] {
  const s = sat / 100;
  const l = light / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [channel(0), channel(8), channel(4)];
}

export function hslToHex(hue: number, sat: number, light: number) {
  return `#${hslToRgb(hue, sat, light).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToHsl(hex: string): { hue: number; sat: number; light: number } | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let sat = 0;
  if (delta) {
    sat = delta / (1 - Math.abs(2 * light - 1));
    hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { hue, sat: Math.round(sat * 100), light: Math.round(light * 100) };
}

export function relativeLuminance(hue: number, sat: number, light: number) {
  const [r, g, b] = hslToRgb(hue, sat, light).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function customThemeVars(color: CustomColor): ChromeVars {
  const base = hslString(color.hue, color.sat, color.light);
  const isLight = relativeLuminance(color.hue, color.sat, color.light) > 0.42;
  const onBase = isLight ? '#1b1b1b' : '#ffffff';
  const mix = (percent: number, other: string) => `color-mix(in srgb, ${base} ${percent}%, ${other})`;
  const ribbon = mix(color.tint, 'white');
  const strong = hslString(color.hue, color.sat, Math.max(color.light - 35, 15));
  const vars: ChromeVars = {
    ...BASE,
    ...(isLight ? {} : DARK_TITLE),
    'title-bg': base, 'title-fg': onBase, 'tabs-bg': base, 'tabs-border': mix(color.tint + 14, 'white'), 'tab-fg': onBase,
    'tab-active-bg': ribbon, 'tab-active-fg': isLight ? strong : base, 'file-bg': mix(78, 'black'),
    'ribbon-bg': ribbon, 'ribbon-border': mix(color.tint + 14, 'white'), 'group-sep': mix(color.tint + 14, 'white'),
    'group-label': hslString(color.hue, Math.min(color.sat, 40), 35),
    'hover-bg': mix(14, 'white'), 'hover-border': mix(30, 'white'),
    'pressed-bg': mix(24, 'white'), 'pressed-border': mix(45, 'white'), 'pressed-fg': hslString(color.hue, color.sat, Math.min(color.light, 32)),
    'canvas-bg': mix(color.tint + 6, '#e6e6e6'), 'status-bg': base, 'status-fg': onBase,
    'primary-bg': isLight ? strong : '#ffffff', 'primary-fg': isLight ? '#ffffff' : base,
    app: base,
  };
  if (isLight) {
    vars['ctl-bg'] = 'rgba(255, 255, 255, 0.55)';
    vars['ctl-fg'] = '#1b1b1b';
    vars['ctl-border'] = 'rgba(0, 0, 0, 0.18)';
    vars['ctl-hover'] = 'rgba(255, 255, 255, 0.8)';
    vars['tab-hover-bg'] = 'rgba(0, 0, 0, 0.08)';
  }
  vars['hover-fg'] = vars['ribbon-fg'];
  vars['tab-hover-fg'] = onBase;
  return vars;
}

export const isOfficeTheme = (theme: ThemeMode): theme is OfficeThemeId => theme in OFFICE_THEMES;

export function chromeFamily(theme: ThemeMode): ChromeFamily {
  if (isOfficeTheme(theme)) return OFFICE_THEMES[theme].family;
  return theme === 'custom' ? '2016' : 'modern';
}

export function themeVars(theme: ThemeMode, settings: Pick<AppSettings, 'customHue' | 'customSat' | 'customLight' | 'customTint'>): ChromeVars | null {
  if (isOfficeTheme(theme)) return OFFICE_THEMES[theme].vars;
  if (theme === 'custom') return customThemeVars(customColorOf(settings));
  return null;
}

export function previewVars(theme: ThemeMode, settings: Pick<AppSettings, 'customHue' | 'customSat' | 'customLight' | 'customTint'>, appColor = PREVIEW_APP_COLOR) {
  const vars = themeVars(theme, settings) ?? MODERN_PREVIEW[theme === 'dark' ? 'dark' : 'light'];
  const app = vars.app ?? appColor;
  const style: Record<string, string> = { '--oc-app': app };
  for (const [key, value] of Object.entries(vars)) {
    if (key === 'app') continue;
    style[`--oc-${key}`] = value.split(APP_TOKEN).join(app);
  }
  return style;
}

export function chromeStyleSheet(vars: ChromeVars) {
  const declarations = Object.entries(vars).map(([key, value]) => {
    if (key === 'app') return `--oc-app: ${value};`;
    return `--oc-${key}: ${value.split(APP_TOKEN).join('var(--oc-app)')};`;
  });
  return `:root[data-office] :is(.editor-shell, .ppt-editor) { ${declarations.join(' ')} }`;
}

export const THEME_GROUPS: Array<{ title: string; themes: ThemeCard[] }> = [
  {
    title: 'Hiện đại',
    themes: [
      { id: 'light', label: 'Sáng', group: 'Hiện đại', family: 'modern' },
      { id: 'dark', label: 'Tối', group: 'Hiện đại', family: 'modern' },
      { id: 'system', label: 'Theo hệ thống', group: 'Hiện đại', family: 'modern' },
    ],
  },
  { title: 'Màu riêng', themes: [{ id: 'custom', label: 'Màu của bạn', group: 'Màu riêng', family: '2016' }] },
  ...[G16, G13, G10, G07].map((title) => ({
    title,
    themes: (Object.entries(OFFICE_THEMES) as Array<[OfficeThemeId, OfficeThemeDef]>)
      .filter(([, def]) => def.group === title)
      .map(([id, def]) => ({ id, label: def.label, group: def.group, family: def.family })),
  })),
];
