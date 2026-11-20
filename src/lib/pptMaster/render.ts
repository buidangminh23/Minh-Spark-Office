import type { SlideBackground, SlideData, SlideElement, SlideLayout } from '../slideTypes';
import { findStyle, type PptMasterPalette, type PptMasterStyle } from './catalog';
import type { DeckItem, DeckPage, DeckSpec } from './deck';

type Ctx = { style: PptMasterStyle; palette: PptMasterPalette; deck: DeckSpec; index: number; total: number; seq: () => string };
type Box = { x: number; y: number; width: number; height: number };

const MARGIN_X = 6;
const CONTENT_TOP = 30;
const CONTENT_BOTTOM = 88;
const TITLE_SIZE = 32;
const BODY_SIZE = 17;
const SERIES_SHADES = [1, 0.7, 0.45, 0.25];

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
};

export function mix(a: string, b: string, amount: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const channel = (x: number, y: number) => Math.round(x + (y - x) * amount).toString(16).padStart(2, '0');
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`.toUpperCase();
}

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const readableOn = (background: string, preferred: string) => (contrast(background, preferred) >= 4.5 ? preferred : contrast(background, '#FFFFFF') >= contrast(background, '#111111') ? '#FFFFFF' : '#111111');

export function resolvePalette(style: PptMasterStyle, override?: Partial<PptMasterPalette>): PptMasterPalette {
  const palette = { ...style.tokens.palette, ...override };
  return { ...palette, text: readableOn(palette.background, palette.text), muted: contrast(palette.background, palette.muted) >= 3 ? palette.muted : readableOn(palette.background, palette.text) };
}

const caseOf = (ctx: Ctx, value: string) => (ctx.style.tokens.titleCase === 'upper' ? value.toLocaleUpperCase('vi-VN') : value);

function text(ctx: Ctx, box: Box, value: string, extra: Partial<SlideElement> = {}): SlideElement {
  return { id: ctx.seq(), type: 'text', ...box, text: value, fontFamily: ctx.style.tokens.bodyFont, fontSize: BODY_SIZE, color: ctx.palette.text, textAlign: 'left', verticalAlign: 'top', lineHeight: 1.35, ...extra };
}

function shape(ctx: Ctx, box: Box, fill: string, extra: Partial<SlideElement> = {}): SlideElement {
  const tokens = ctx.style.tokens;
  return {
    id: ctx.seq(), type: 'shape', ...box,
    shapeType: tokens.radius > 0 ? 'rounded-rectangle' : 'rectangle',
    borderRadius: tokens.radius,
    fill, fillType: 'solid',
    stroke: tokens.outline ? ctx.palette.text : 'transparent', strokeWidth: tokens.outline,
    shapeShadow: tokens.shadow || undefined,
    glow: tokens.glow || undefined, glowColor: tokens.glow ? ctx.palette.primary : undefined,
    decorative: true,
    ...extra,
  };
}

function title(ctx: Ctx, value: string, box: Box = { x: MARGIN_X, y: 9, width: 100 - MARGIN_X * 2, height: 14 }, size = TITLE_SIZE): SlideElement {
  return text(ctx, box, caseOf(ctx, value), { isTitle: true, fontFamily: ctx.style.tokens.titleFont, fontSize: size, fontWeight: ctx.style.tokens.titleWeight, color: ctx.palette.text, verticalAlign: 'bottom', lineHeight: 1.15, name: 'Title' });
}

function kicker(ctx: Ctx, value: string, y = 5): SlideElement {
  return text(ctx, { x: MARGIN_X, y, width: 60, height: 5 }, value.toLocaleUpperCase('vi-VN'), { fontFamily: ctx.style.tokens.labelFont, fontSize: 11, fontWeight: 'bold', color: ctx.palette.accent, letterSpacing: 2 });
}

function rule(ctx: Ctx, y: number): SlideElement[] {
  const kind = ctx.style.tokens.rule;
  if (kind === 'none') return [];
  const height = kind === 'heavy' ? 0.9 : 0.25;
  const line = shape(ctx, { x: MARGIN_X, y, width: 100 - MARGIN_X * 2, height }, ctx.palette.text, { shapeType: 'rectangle', borderRadius: 0, stroke: 'transparent', strokeWidth: 0, shapeShadow: undefined, glow: undefined });
  return kind === 'double' ? [line, { ...line, id: ctx.seq(), y: y + 0.8 }] : [line];
}

function motif(ctx: Ctx, emphasis: boolean): SlideElement[] {
  const { motif: kind } = ctx.style.tokens;
  const { primary, accent, background } = ctx.palette;
  const soft = mix(background, primary, 0.12);
  const deco = (box: Box, fill: string, extra: Partial<SlideElement> = {}) => shape(ctx, box, fill, { stroke: 'transparent', strokeWidth: 0, shapeShadow: undefined, glow: undefined, zIndex: 1, name: 'Decoration', ...extra });
  switch (kind) {
    case 'band': return [deco({ x: 0, y: 0, width: emphasis ? 38 : 1.6, height: 100 }, primary, { shapeType: 'rectangle', borderRadius: 0 })];
    case 'disc': return [deco({ x: 70, y: emphasis ? -18 : 62, width: 42, height: 74.7 }, soft, { shapeType: 'circle' })];
    case 'grid': return Array.from({ length: 9 }, (_, i) => deco({ x: 0, y: (i + 1) * 10, width: 100, height: 0.12 }, mix(background, primary, 0.18), { shapeType: 'rectangle', borderRadius: 0 }));
    case 'dots': return Array.from({ length: 6 }, (_, i) => deco({ x: 86 + (i % 3) * 3, y: 6 + Math.floor(i / 3) * 5.3, width: 1.4, height: 2.5 }, accent, { shapeType: 'circle' }));
    case 'confetti': return [deco({ x: 84, y: 8, width: 6, height: 10.7 }, accent, { shapeType: 'circle' }), deco({ x: 90, y: 72, width: 6, height: 10.7 }, primary, { shapeType: 'triangle', rotation: 18 }), deco({ x: 3, y: 84, width: 8, height: 3 }, accent, { shapeType: 'rectangle', rotation: -12 })];
    case 'brackets': return [deco({ x: 3, y: 4, width: 0.5, height: 92 }, mix(background, ctx.palette.text, 0.35), { shapeType: 'rectangle' })];
    case 'stamp': return [deco({ x: 90, y: 84, width: 4, height: 7.1 }, accent, { shapeType: 'rectangle', borderRadius: 2 })];
    case 'halftone': return Array.from({ length: 12 }, (_, i) => deco({ x: 80 + (i % 4) * 4, y: 74 + Math.floor(i / 4) * 7, width: 2.2 - Math.floor(i / 4) * 0.5, height: 3.9 - Math.floor(i / 4) * 0.9 }, accent, { shapeType: 'circle' }));
    case 'pixels': return Array.from({ length: 5 }, (_, i) => deco({ x: 90 + (i % 2) * 2.5, y: 80 + i * 3.4, width: 2.5, height: 4.4 }, i % 2 ? accent : primary, { shapeType: 'rectangle', borderRadius: 0 }));
    case 'layers': return [deco({ x: -8, y: 78, width: 60, height: 40 }, soft, { shapeType: 'circle' }), deco({ x: -4, y: 86, width: 40, height: 30 }, mix(background, accent, 0.25), { shapeType: 'circle' })];
    default: return [];
  }
}

function footer(ctx: Ctx, source?: string): SlideElement[] {
  const label = { fontFamily: ctx.style.tokens.labelFont, fontSize: 10, color: ctx.palette.muted };
  const elements = [text(ctx, { x: 80, y: 92, width: 14, height: 4 }, `${ctx.index + 1} / ${ctx.total}`, { ...label, textAlign: 'right' })];
  if (source) elements.push(text(ctx, { x: MARGIN_X, y: 92, width: 70, height: 4 }, `Nguồn: ${source}`, label));
  return elements;
}

function bulletBlock(ctx: Ctx, box: Box, bullets: string[], size = BODY_SIZE): SlideElement {
  return text(ctx, box, bullets.join('\n'), { isBullet: true, bulletStyle: 'disc', fontSize: size, lineHeight: 1.5 });
}

function header(ctx: Ctx, page: DeckPage): SlideElement[] {
  const elements = [...motif(ctx, false)];
  if (page.kicker) elements.push(kicker(ctx, page.kicker));
  elements.push(title(ctx, page.title));
  elements.push(...rule(ctx, 24));
  if (page.takeaway) elements.push(text(ctx, { x: MARGIN_X, y: 24.5, width: 100 - MARGIN_X * 2, height: 5 }, page.takeaway, { fontSize: 15, color: ctx.palette.muted, fontStyle: ctx.style.tokens.titleFont === 'Georgia' ? 'italic' : 'normal' }));
  return elements;
}

const contentTop = (page: DeckPage) => (page.takeaway ? CONTENT_TOP + 2 : CONTENT_TOP);

function card(ctx: Ctx, box: Box, item: DeckItem, index: number, numbered: boolean): SlideElement[] {
  const surface = ctx.style.tokens.dark ? mix(ctx.palette.background, ctx.palette.surface, 0.9) : ctx.palette.surface;
  const ink = readableOn(surface, ctx.palette.text);
  const elements = [shape(ctx, box, surface, { opacity: ctx.style.id === 'glassmorphism' ? 0.18 : undefined, stroke: ctx.style.tokens.outline ? ctx.palette.text : mix(surface, ctx.palette.primary, 0.25), strokeWidth: ctx.style.tokens.outline || 1 })];
  const pad = 2.2;
  const inner = { x: box.x + pad, width: box.width - pad * 2 };
  let y = box.y + pad * 1.6;
  if (numbered || item.value) {
    const marker = item.value ?? String(index + 1).padStart(2, '0');
    elements.push(text(ctx, { ...inner, y, height: 9 }, marker, { fontFamily: ctx.style.tokens.titleFont, fontSize: item.value ? 30 : 20, fontWeight: 'bold', color: ctx.palette.accent }));
    y += item.value ? 11 : 8;
  }
  elements.push(text(ctx, { ...inner, y, height: 7 }, item.label, { fontSize: 16, fontWeight: 'bold', color: ink }));
  if (item.detail) elements.push(text(ctx, { ...inner, y: y + 7, height: box.y + box.height - y - 8 }, item.detail, { fontSize: 13.5, color: readableOn(surface, ctx.palette.muted) }));
  return elements;
}

function cardRow(ctx: Ctx, items: DeckItem[], top: number, numbered: boolean) {
  const gap = 2.4;
  const width = (100 - MARGIN_X * 2 - gap * (items.length - 1)) / items.length;
  return items.flatMap((item, i) => card(ctx, { x: MARGIN_X + i * (width + gap), y: top, width, height: CONTENT_BOTTOM - top }, item, i, numbered));
}

const chartColors = (ctx: Ctx, count: number) => Array.from({ length: count }, (_, i) => (i === 0 ? ctx.palette.primary : i === 1 ? ctx.palette.accent : mix(ctx.palette.background, ctx.palette.primary, SERIES_SHADES[i] ?? 0.3)));

function chartElement(ctx: Ctx, page: DeckPage, box: Box): SlideElement {
  const chart = page.chart!;
  const colors = chartColors(ctx, Math.max(chart.series.length, chart.categories.length));
  return {
    id: ctx.seq(), type: 'chart', ...box,
    chartType: chart.type,
    chartTitle: chart.unit ? `Đơn vị: ${chart.unit}` : undefined,
    chartCategories: chart.categories,
    chartSeries: chart.series.map((series, i) => ({ name: series.name, values: series.values, color: colors[i] })),
    chartLegend: chart.series.length > 1 || chart.type === 'pie' || chart.type === 'doughnut',
    color: ctx.palette.text,
    fontFamily: ctx.style.tokens.bodyFont,
  };
}

function tableElement(ctx: Ctx, page: DeckPage, box: Box): SlideElement {
  const table = page.table!;
  const data = [table.header, ...table.rows];
  const body = ctx.style.tokens.dark ? mix(ctx.palette.background, ctx.palette.surface, 0.9) : ctx.palette.surface;
  const stripe = mix(body, ctx.palette.primary, 0.06);
  const ink = readableOn(body, ctx.palette.text);
  return {
    id: ctx.seq(), type: 'table', ...box,
    tableRows: data.length, tableCols: table.header.length, tableData: data,
    tableHeaderRow: true, tableHeaderColor: ctx.palette.primary, tableHeaderTextColor: readableOn(ctx.palette.primary, '#FFFFFF'),
    tableBorderColor: mix(body, ctx.palette.text, 0.2),
    tableCellStyles: data.map((row, r) => row.map((_, c) => (r === 0 ? { fontFace: ctx.style.tokens.labelFont, fontSize: 13 } : { fill: r % 2 ? body : stripe, color: ink, fontFace: ctx.style.tokens.bodyFont, fontSize: data.length > 8 ? 11 : 13, align: c === 0 ? 'left' : 'center' }))),
  };
}

const PAGE_BUILDERS: Record<DeckPage['role'], (ctx: Ctx, page: DeckPage) => SlideElement[]> = {
  cover: (ctx, page) => {
    const tokens = ctx.style.tokens;
    const elements = [...motif(ctx, true)];
    const left = tokens.motif === 'band' ? 42 : MARGIN_X;
    if (page.kicker) elements.push({ ...kicker(ctx, page.kicker, 30), x: left });
    elements.push(title(ctx, page.title || ctx.deck.title, { x: left, y: 34, width: 96 - left, height: 26 }, 44));
    const subtitle = page.takeaway ?? ctx.deck.subtitle;
    if (subtitle) elements.push(text(ctx, { x: left, y: 62, width: 90 - left, height: 12 }, subtitle, { fontSize: 18, color: ctx.palette.muted }));
    return elements;
  },
  agenda: (ctx, page) => {
    const items = page.items ?? (page.bullets ?? []).map((label) => ({ label }));
    const top = contentTop(page);
    const row = Math.min(10, (CONTENT_BOTTOM - top) / Math.max(1, items.length));
    return [...header(ctx, page), ...items.flatMap((item, i) => [
      text(ctx, { x: MARGIN_X, y: top + i * row, width: 8, height: row }, String(i + 1).padStart(2, '0'), { fontFamily: ctx.style.tokens.titleFont, fontSize: 24, fontWeight: 'bold', color: ctx.palette.accent, verticalAlign: 'middle' }),
      text(ctx, { x: MARGIN_X + 9, y: top + i * row, width: 80, height: row }, item.label, { fontSize: 20, verticalAlign: 'middle' }),
    ])];
  },
  section: (ctx, page) => [
    ...motif(ctx, true),
    text(ctx, { x: MARGIN_X, y: 26, width: 30, height: 20 }, page.kicker ?? String(ctx.index).padStart(2, '0'), { fontFamily: ctx.style.tokens.titleFont, fontSize: 72, fontWeight: 'bold', color: ctx.palette.accent }),
    title(ctx, page.title, { x: MARGIN_X, y: 48, width: 80, height: 18 }, 38),
    ...(page.takeaway ? [text(ctx, { x: MARGIN_X, y: 68, width: 70, height: 10 }, page.takeaway, { fontSize: 17, color: ctx.palette.muted })] : []),
  ],
  bullets: (ctx, page) => [...header(ctx, page), bulletBlock(ctx, { x: MARGIN_X, y: contentTop(page), width: 100 - MARGIN_X * 2, height: CONTENT_BOTTOM - contentTop(page) }, page.bullets ?? (page.items ?? []).map((item) => (item.detail ? `${item.label}: ${item.detail}` : item.label)), 19), ...footer(ctx, page.source)],
  cards: (ctx, page) => [...header(ctx, page), ...cardRow(ctx, (page.items ?? (page.bullets ?? []).map((label) => ({ label }))).slice(0, 4), contentTop(page), false), ...footer(ctx, page.source)],
  kpi: (ctx, page) => [...header(ctx, page), ...cardRow(ctx, (page.items ?? []).slice(0, 4), contentTop(page) + 4, false), ...footer(ctx, page.source)],
  chart: (ctx, page) => {
    const top = contentTop(page);
    const side = page.bullets?.length ? 32 : 0;
    const box = { x: MARGIN_X, y: top, width: 100 - MARGIN_X * 2 - side, height: CONTENT_BOTTOM - top };
    const elements = [...header(ctx, page), page.chart ? chartElement(ctx, page, box) : bulletBlock(ctx, box, page.bullets ?? [])];
    if (side && page.chart) elements.push(bulletBlock(ctx, { x: 100 - MARGIN_X - side + 2, y: top + 4, width: side - 2, height: box.height - 4 }, page.bullets!, 15));
    return [...elements, ...footer(ctx, page.source)];
  },
  table: (ctx, page) => {
    const top = contentTop(page);
    const box = { x: MARGIN_X, y: top, width: 100 - MARGIN_X * 2, height: Math.min(CONTENT_BOTTOM - top, 7 * ((page.table?.rows.length ?? 0) + 1)) };
    return [...header(ctx, page), page.table ? tableElement(ctx, page, box) : bulletBlock(ctx, box, page.bullets ?? []), ...footer(ctx, page.source)];
  },
  comparison: (ctx, page) => {
    const top = contentTop(page);
    const width = (100 - MARGIN_X * 2 - 4) / 2;
    const column = (data: DeckPage['left'], x: number, accent: string) => data ? [
      shape(ctx, { x, y: top, width, height: 1 }, accent, { shapeType: 'rectangle', borderRadius: 0, stroke: 'transparent', strokeWidth: 0, shapeShadow: undefined }),
      text(ctx, { x, y: top + 2, width, height: 8 }, data.heading, { fontSize: 20, fontWeight: 'bold', color: accent === ctx.palette.accent ? readableOn(ctx.palette.background, accent) : ctx.palette.text }),
      bulletBlock(ctx, { x, y: top + 11, width, height: CONTENT_BOTTOM - top - 11 }, data.bullets),
    ] : [];
    return [...header(ctx, page), ...column(page.left, MARGIN_X, ctx.palette.primary), ...column(page.right, MARGIN_X + width + 4, ctx.palette.accent), ...footer(ctx, page.source)];
  },
  timeline: (ctx, page) => {
    const items: DeckItem[] = (page.items ?? (page.bullets ?? []).map((label) => ({ label }))).slice(0, 6);
    const top = contentTop(page) + 6;
    const step = (100 - MARGIN_X * 2) / Math.max(1, items.length);
    const lineY = top + 8;
    return [
      ...header(ctx, page),
      shape(ctx, { x: MARGIN_X, y: lineY, width: 100 - MARGIN_X * 2, height: 0.6 }, mix(ctx.palette.background, ctx.palette.text, 0.35), { shapeType: 'rectangle', borderRadius: 0, stroke: 'transparent', strokeWidth: 0, shapeShadow: undefined, glow: undefined }),
      ...items.flatMap((item, i) => {
        const x = MARGIN_X + i * step;
        return [
          shape(ctx, { x: x + step / 2 - 1.4, y: lineY - 2.2, width: 2.8, height: 5 }, i === items.length - 1 ? ctx.palette.accent : ctx.palette.primary, { shapeType: 'circle', stroke: ctx.palette.background, strokeWidth: 2 }),
          text(ctx, { x: x + 1, y: top - 6, width: step - 2, height: 6 }, item.value ?? String(i + 1), { fontFamily: ctx.style.tokens.labelFont, fontSize: 13, fontWeight: 'bold', color: ctx.palette.accent, textAlign: 'center' }),
          text(ctx, { x: x + 1, y: lineY + 5, width: step - 2, height: 7 }, item.label, { fontSize: 15, fontWeight: 'bold', textAlign: 'center' }),
          ...(item.detail ? [text(ctx, { x: x + 1, y: lineY + 12, width: step - 2, height: CONTENT_BOTTOM - lineY - 12 }, item.detail, { fontSize: 12.5, color: ctx.palette.muted, textAlign: 'center' })] : []),
        ];
      }),
      ...footer(ctx, page.source),
    ];
  },
  quote: (ctx, page) => [
    ...motif(ctx, false),
    text(ctx, { x: MARGIN_X + 4, y: 14, width: 10, height: 18 }, '“', { fontFamily: 'Georgia', fontSize: 96, color: ctx.palette.accent, lineHeight: 1 }),
    text(ctx, { x: MARGIN_X + 8, y: 30, width: 76, height: 34 }, page.quote?.text ?? page.title, { fontFamily: ctx.style.tokens.titleFont, fontSize: 28, fontStyle: 'italic', lineHeight: 1.3 }),
    ...(page.quote?.author ? [text(ctx, { x: MARGIN_X + 8, y: 68, width: 60, height: 6 }, `— ${page.quote.author}`, { fontSize: 16, color: ctx.palette.muted })] : []),
  ],
  closing: (ctx, page) => [
    ...motif(ctx, true),
    title(ctx, page.title, { x: MARGIN_X, y: 32, width: 88, height: 22 }, 42),
    ...(page.takeaway ? [text(ctx, { x: MARGIN_X, y: 58, width: 80, height: 12 }, page.takeaway, { fontSize: 19, color: ctx.palette.muted })] : []),
    ...(page.bullets?.length ? [bulletBlock(ctx, { x: MARGIN_X, y: 70, width: 80, height: 18 }, page.bullets, 15)] : []),
  ],
};

const LAYOUT_OF: Record<DeckPage['role'], SlideLayout> = {
  cover: 'title', agenda: 'title-content', section: 'section', bullets: 'title-content', cards: 'title-content', kpi: 'title-content',
  chart: 'title-content', table: 'title-content', comparison: 'comparison', timeline: 'title-content', quote: 'title-only', closing: 'title',
};

function backgroundOf(ctx: Ctx, role: DeckPage['role']): SlideBackground {
  const { background, primary } = ctx.palette;
  if (ctx.style.id === 'glassmorphism') return { type: 'gradient', value: `linear-gradient(135deg, ${background} 0%, ${mix(background, primary, 0.45)} 100%)` };
  if ((role === 'cover' || role === 'section' || role === 'closing') && ctx.style.tokens.motif !== 'band' && !ctx.style.tokens.dark) return { type: 'solid', value: mix(background, primary, 0.06) };
  return { type: 'solid', value: background };
}

export function renderDeck(deck: DeckSpec, styleId: string): SlideData[] {
  const style = findStyle(styleId);
  const palette = resolvePalette(style, deck.palette);
  const stamp = Date.now().toString(36);
  let counter = 0;
  const seq = () => `pm-${stamp}-${(counter += 1)}`;
  return deck.pages.map((page, index) => {
    const ctx: Ctx = { style, palette, deck, index, total: deck.pages.length, seq };
    const elements = PAGE_BUILDERS[page.role](ctx, page).map((element, z) => ({ ...element, zIndex: element.zIndex ?? 10 + z }));
    return {
      id: `slide-${stamp}-${index}`,
      layout: LAYOUT_OF[page.role],
      background: backgroundOf(ctx, page.role),
      elements,
      notes: page.notes ?? '',
      transition: { type: index === 0 ? 'none' : 'fade', duration: 0.5 },
    } as SlideData;
  });
}
