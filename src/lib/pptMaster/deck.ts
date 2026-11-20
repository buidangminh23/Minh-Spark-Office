import { findMode, findStyle, type PptMasterPalette } from './catalog';

export const PAGE_ROLES = ['cover', 'agenda', 'section', 'bullets', 'cards', 'kpi', 'chart', 'table', 'comparison', 'timeline', 'quote', 'closing'] as const;
export type PageRole = (typeof PAGE_ROLES)[number];
export const CHART_KINDS = ['column', 'bar', 'line', 'pie', 'doughnut'] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export type DeckItem = { label: string; detail?: string; value?: string };
export type DeckChart = { type: ChartKind; categories: string[]; series: { name: string; values: number[] }[]; unit?: string };
export type DeckTable = { header: string[]; rows: string[][] };

export type DeckPage = {
  role: PageRole;
  title: string;
  kicker?: string;
  takeaway?: string;
  bullets?: string[];
  items?: DeckItem[];
  left?: { heading: string; bullets: string[] };
  right?: { heading: string; bullets: string[] };
  chart?: DeckChart;
  table?: DeckTable;
  quote?: { text: string; author?: string };
  source?: string;
  notes?: string;
};

export type DeckSpec = { title: string; subtitle?: string; palette?: Partial<PptMasterPalette>; pages: DeckPage[] };

export type DeckRequest = {
  styleId: string;
  modeId: string;
  pages: number;
  language: 'vi' | 'en';
  brief: string;
  audience?: string;
  hasSource: boolean;
  aiPalette: boolean;
};

export const MIN_PAGES = 3;
export const MAX_PAGES = 20;
const MAX_TEXT = 600;
const MAX_LIST = 8;
const MAX_TABLE_ROWS = 12;
const MAX_TABLE_COLS = 6;
const MAX_CATEGORIES = 12;
const MAX_SERIES = 4;
const HEX = /^#[0-9a-f]{6}$/i;

const SCHEMA = `{
  "title": string,
  "subtitle": string,
  "palette": { "background": "#RRGGBB", "surface": "#RRGGBB", "primary": "#RRGGBB", "accent": "#RRGGBB", "text": "#RRGGBB", "muted": "#RRGGBB" },
  "pages": [
    {
      "role": "cover" | "agenda" | "section" | "bullets" | "cards" | "kpi" | "chart" | "table" | "comparison" | "timeline" | "quote" | "closing",
      "title": string,
      "kicker": string,
      "takeaway": string,
      "bullets": string[],
      "items": [{ "label": string, "detail": string, "value": string }],
      "left": { "heading": string, "bullets": string[] },
      "right": { "heading": string, "bullets": string[] },
      "chart": { "type": "column" | "bar" | "line" | "pie" | "doughnut", "categories": string[], "series": [{ "name": string, "values": number[] }], "unit": string },
      "table": { "header": string[], "rows": string[][] },
      "quote": { "text": string, "author": string },
      "source": string,
      "notes": string
    }
  ]
}`;

const ROLE_GUIDE = [
  'cover: title + subtitle in takeaway. First page only.',
  'agenda: 3-6 items (label only).',
  'section: chapter divider, kicker = chapter number.',
  'bullets: 3-6 concise bullets, optional takeaway.',
  'cards: 2-4 parallel items with label + detail.',
  'kpi: 1-4 hero numbers, items with value + label + detail.',
  'chart: only with real figures from the brief or source; include source.',
  'table: header + up to 12 rows; include source when data comes from a document.',
  'comparison: left vs right, each with heading + 2-5 bullets.',
  'timeline: 3-6 ordered steps as items (label = step or date, detail = what happens).',
  'quote: a memorable line with author.',
  'closing: last page, takeaway = call to action or thanks.',
];

export function buildDeckPrompt(request: DeckRequest) {
  const style = findStyle(request.styleId);
  const mode = findMode(request.modeId);
  const language = request.language === 'en' ? 'English' : 'Vietnamese';
  return [
    'You are PPT Master, a presentation strategist and executor. Plan and write a complete slide deck, then return it as JSON only.',
    '',
    `## Deck brief\n${request.brief.trim() || '(see source document)'}`,
    request.audience?.trim() ? `Audience: ${request.audience.trim()}` : '',
    request.hasSource ? 'A source document is attached in <context>. Build the deck from its facts; keep its numbers exactly; do not invent facts it does not contain.' : 'No source document. Use only well-established facts; when unsure, phrase qualitatively instead of inventing numbers.',
    '',
    `## Mode: ${mode.id}`,
    ...mode.skeleton.map((line) => `- ${line}`),
    `- ${mode.titleVoice}`,
    `- Speaker notes: ${mode.notesRegister}`,
    '',
    `## Visual style: ${style.id} (${style.character})`,
    ...style.rules.map((line) => `- ${line}`),
    request.aiPalette ? '- Choose a palette (6 HEX colors) that fits the subject and this style; ensure text contrast of at least 4.5:1 against background and surface.' : '- Omit "palette"; the style palette is fixed.',
    '',
    '## Page roles',
    ...ROLE_GUIDE.map((line) => `- ${line}`),
    '',
    '## Rules',
    `- Exactly ${request.pages} pages. Start with cover, end with closing. Vary roles; never use the same role three times in a row.`,
    `- Write all slide text and notes in ${language}.`,
    '- Titles at most 12 words; bullets at most 18 words; card details at most 25 words.',
    '- Every page except cover and closing gets speaker notes of 2-4 sentences.',
    '- Never fabricate statistics, sources, quotes or people. Prefer cards, timeline or comparison over invented charts.',
    '- Include only the fields a role needs.',
    '',
    '## Output',
    'Reply with one JSON object and nothing else, no Markdown fences, matching:',
    SCHEMA,
  ].filter((line) => line !== '').join('\n');
}

const text = (value: unknown, limit = MAX_TEXT) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '');
const list = (value: unknown, limit = MAX_LIST) => (Array.isArray(value) ? value.map((entry) => text(entry, 240)).filter(Boolean).slice(0, limit) : []);
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const optional = (value: string) => value || undefined;

function parseItems(value: unknown): DeckItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(record).filter(Boolean).map((item) => ({ label: text(item!.label, 120), detail: optional(text(item!.detail, 300)), value: optional(text(item!.value, 24)) })).filter((item) => item.label || item.value).slice(0, MAX_LIST);
  return items.length ? items : undefined;
}

function parseColumn(value: unknown) {
  const column = record(value);
  if (!column) return undefined;
  const parsed = { heading: text(column.heading, 120), bullets: list(column.bullets, 6) };
  return parsed.heading || parsed.bullets.length ? parsed : undefined;
}

function parseChart(value: unknown): DeckChart | undefined {
  const chart = record(value);
  if (!chart) return undefined;
  const type = CHART_KINDS.includes(chart.type as ChartKind) ? (chart.type as ChartKind) : 'column';
  const categories = list(chart.categories, MAX_CATEGORIES);
  const series = (Array.isArray(chart.series) ? chart.series : []).map(record).filter(Boolean).slice(0, MAX_SERIES).map((entry) => ({
    name: text(entry!.name, 60) || 'Dữ liệu',
    values: (Array.isArray(entry!.values) ? entry!.values : []).slice(0, categories.length).map((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, '')))).map((v) => (Number.isFinite(v) ? v : 0)),
  })).filter((entry) => entry.values.length === categories.length && entry.values.length > 0);
  if (!categories.length || !series.length) return undefined;
  return { type, categories, series, unit: optional(text(chart.unit, 20)) };
}

function parseTable(value: unknown): DeckTable | undefined {
  const table = record(value);
  if (!table) return undefined;
  const header = list(table.header, MAX_TABLE_COLS);
  if (!header.length) return undefined;
  const rows = (Array.isArray(table.rows) ? table.rows : []).filter(Array.isArray).slice(0, MAX_TABLE_ROWS).map((row) => header.map((_, index) => text((row as unknown[])[index], 120)));
  return rows.length ? { header, rows } : undefined;
}

function parsePage(value: unknown): DeckPage | null {
  const page = record(value);
  if (!page) return null;
  const role = PAGE_ROLES.includes(page.role as PageRole) ? (page.role as PageRole) : 'bullets';
  const quote = record(page.quote);
  const parsed: DeckPage = {
    role,
    title: text(page.title, 160),
    kicker: optional(text(page.kicker, 60)),
    takeaway: optional(text(page.takeaway, 300)),
    bullets: list(page.bullets),
    items: parseItems(page.items),
    left: parseColumn(page.left),
    right: parseColumn(page.right),
    chart: parseChart(page.chart),
    table: parseTable(page.table),
    quote: quote && text(quote.text) ? { text: text(quote.text, 400), author: optional(text(quote.author, 80)) } : undefined,
    source: optional(text(page.source, 200)),
    notes: optional(text(page.notes, 2000)),
  };
  if (!parsed.bullets?.length) delete parsed.bullets;
  return parsed.title || parsed.bullets || parsed.items || parsed.chart || parsed.table || parsed.quote ? parsed : null;
}

function parsePalette(value: unknown): Partial<PptMasterPalette> | undefined {
  const palette = record(value);
  if (!palette) return undefined;
  const keys: (keyof PptMasterPalette)[] = ['background', 'surface', 'primary', 'accent', 'text', 'muted'];
  const result: Partial<PptMasterPalette> = {};
  for (const key of keys) if (typeof palette[key] === 'string' && HEX.test(palette[key] as string)) result[key] = (palette[key] as string).toUpperCase();
  return Object.keys(result).length ? result : undefined;
}

export function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI chưa trả về bản kế hoạch slide hợp lệ.');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error('Bản kế hoạch slide AI trả về bị cắt hoặc sai định dạng. Thử lại với ít trang hơn.');
  }
}

export function parseDeck(raw: string): DeckSpec {
  const data = record(extractJson(raw));
  if (!data) throw new Error('AI chưa trả về bản kế hoạch slide hợp lệ.');
  const pages = (Array.isArray(data.pages) ? data.pages : []).map(parsePage).filter((page): page is DeckPage => page !== null).slice(0, MAX_PAGES);
  if (!pages.length) throw new Error('AI chưa tạo được trang nào.');
  return { title: text(data.title, 160) || pages[0].title, subtitle: optional(text(data.subtitle, 240)), palette: parsePalette(data.palette), pages };
}
