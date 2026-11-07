export type FontGroup = 'system' | 'sans' | 'serif' | 'display' | 'handwriting' | 'mono' | 'local';

export type FontEntry = { name: string; group: FontGroup; google?: boolean };

const SYSTEM_FONTS = [
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math', 'Candara', 'Century Gothic', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Garamond', 'Georgia', 'Impact', 'Lucida Console',
  'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold',
  'Sitka Text', 'Sylfaen', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Aptos', 'Bahnschrift', 'Book Antiqua', 'Bookman Old Style',
  'Helvetica', 'Helvetica Neue', 'Avenir', 'Avenir Next', 'Baskerville', 'Didot', 'Futura', 'Gill Sans', 'Optima', 'Menlo', 'Monaco', 'SF Pro Text',
];

const GOOGLE_FONTS: [string, FontGroup][] = [
  ['Roboto', 'sans'], ['Open Sans', 'sans'], ['Noto Sans', 'sans'], ['Inter', 'sans'], ['Be Vietnam Pro', 'sans'], ['Montserrat', 'sans'], ['Nunito', 'sans'],
  ['Nunito Sans', 'sans'], ['Source Sans 3', 'sans'], ['Mulish', 'sans'], ['Quicksand', 'sans'], ['Lexend', 'sans'], ['Manrope', 'sans'], ['Work Sans', 'sans'],
  ['Raleway', 'sans'], ['Rubik', 'sans'], ['Barlow', 'sans'], ['Barlow Condensed', 'sans'], ['Roboto Condensed', 'sans'], ['Fira Sans', 'sans'], ['IBM Plex Sans', 'sans'],
  ['Josefin Sans', 'sans'], ['Kanit', 'sans'], ['Sarabun', 'sans'], ['Encode Sans', 'sans'], ['Archivo', 'sans'], ['Plus Jakarta Sans', 'sans'], ['Signika', 'sans'],
  ['Maven Pro', 'sans'], ['Cabin', 'sans'], ['Exo 2', 'sans'], ['Space Grotesk', 'sans'], ['Lato', 'sans'], ['Poppins', 'sans'],
  ['Noto Serif', 'serif'], ['Merriweather', 'serif'], ['Lora', 'serif'], ['Playfair Display', 'serif'], ['Roboto Slab', 'serif'], ['Roboto Serif', 'serif'],
  ['Source Serif 4', 'serif'], ['EB Garamond', 'serif'], ['Cormorant Garamond', 'serif'], ['Crimson Pro', 'serif'], ['Alegreya', 'serif'], ['Literata', 'serif'],
  ['Spectral', 'serif'], ['Bitter', 'serif'], ['Noticia Text', 'serif'], ['Taviraj', 'serif'], ['Arsenal', 'serif'], ['Tinos', 'serif'], ['Petrona', 'serif'],
  ['Bebas Neue', 'display'], ['Oswald', 'display'], ['Anton', 'display'], ['Lobster', 'display'], ['Pacifico', 'display'], ['Bungee', 'display'], ['Alfa Slab One', 'display'],
  ['Comfortaa', 'display'], ['Baloo 2', 'display'], ['Paytone One', 'display'], ['Chakra Petch', 'display'], ['Saira', 'display'], ['Patrick Hand', 'handwriting'],
  ['Dancing Script', 'handwriting'], ['Great Vibes', 'handwriting'], ['Sriracha', 'handwriting'], ['Charm', 'handwriting'], ['Itim', 'handwriting'], ['Pangolin', 'handwriting'],
  ['Mali', 'handwriting'], ['Caveat', 'handwriting'], ['Allura', 'handwriting'],
  ['Roboto Mono', 'mono'], ['Source Code Pro', 'mono'], ['JetBrains Mono', 'mono'], ['Fira Code', 'mono'], ['IBM Plex Mono', 'mono'], ['Noto Sans Mono', 'mono'], ['Space Mono', 'mono'],
];

export const GROUP_LABELS: Record<FontGroup, string> = {
  system: 'Phông hệ thống',
  sans: 'Không chân (Google Fonts)',
  serif: 'Có chân (Google Fonts)',
  display: 'Tiêu đề & trang trí',
  handwriting: 'Viết tay',
  mono: 'Đơn cách (mã)',
  local: 'Đã cài trên máy',
};

export const FONT_CATALOG: FontEntry[] = [
  ...SYSTEM_FONTS.map((name) => ({ name, group: 'system' as const })),
  ...GOOGLE_FONTS.map(([name, group]) => ({ name, group, google: true })),
];

const GOOGLE_SET = new Set(GOOGLE_FONTS.map(([name]) => name));
const loaded = new Set<string>();
const RECENT_KEY = 'minh-docs-recent-fonts';
const RECENT_LIMIT = 8;

export function ensureFont(name: string) {
  if (!name || loaded.has(name) || !GOOGLE_SET.has(name)) return;
  loaded.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap&subset=vietnamese`;
  link.dataset.font = name;
  document.head.appendChild(link);
}

export function ensureFontsInJson(node: unknown) {
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.fontFamily === 'string') ensureFont(record.fontFamily.split(',')[0].replaceAll(/["']/g, '').trim());
    Object.values(record).forEach(visit);
  };
  visit(node);
}

export function recentFonts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function rememberFont(name: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([name, ...recentFonts().filter((f) => f !== name)].slice(0, RECENT_LIMIT)));
  } catch {
    return;
  }
}

type LocalFontData = { family: string };

export async function loadLocalFonts(): Promise<string[]> {
  const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> }).queryLocalFonts;
  if (!query) throw new Error('Trình duyệt chưa hỗ trợ đọc phông trên máy (cần Chrome hoặc Edge mới).');
  const fonts = await query();
  return [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b, 'vi'));
}

const SAMPLE = 'mmmmmmmmmmlliWWQ@#ẫỹộ0123';
let measureContext: CanvasRenderingContext2D | null = null;
const availability = new Map<string, boolean>();

export function isFontAvailable(name: string) {
  if (GOOGLE_SET.has(name)) return true;
  const cached = availability.get(name);
  if (cached !== undefined) return cached;
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return true;
  const width = (font: string) => {
    measureContext!.font = `40px ${font}`;
    return measureContext!.measureText(SAMPLE).width;
  };
  const result = ['monospace', 'serif', 'sans-serif'].some((base) => width(`"${name}", ${base}`) !== width(base));
  availability.set(name, result);
  return result;
}
