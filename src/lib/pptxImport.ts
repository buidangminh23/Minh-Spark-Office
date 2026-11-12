import JSZip from 'jszip';
import type {
  ChartSeries,
  ChartType,
  PresentationData,
  SlideBackground,
  SlideData,
  SlideElement,
  SlideTransition,
  TransitionDirection,
  TransitionType,
} from './slideTypes';
import { createSlideFromLayout } from './slideTemplates';
import { child, childrenOf, descendants, localName, parseXml, path, type XmlNode } from './miniXml';
import { shapeFromPrst } from './slideShapes';

export interface PptxImportReport {
  slides: number;
  elements: number;
  skipped: string[];
}

interface Rel {
  target: string;
  type: string;
}

interface Theme {
  colors: Record<string, string>;
  majorFont: string;
  minorFont: string;
  lineWidths: number[];
}

interface ColorContext {
  theme: Theme;
  clrMap: Record<string, string>;
}

interface Xfrm {
  x: number;
  y: number;
  cx: number;
  cy: number;
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

interface Transform {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

interface TextStyle {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  font?: string;
  align?: string;
  bullet?: 'none' | 'char' | 'number';
  lineHeight?: number;
}

interface PlaceholderDef {
  type: string;
  idx?: string;
  xfrm?: Xfrm;
  lstStyle?: XmlNode;
  bodyPr?: XmlNode;
}

interface LayerInfo {
  root: XmlNode;
  partPath: string;
  rels: Map<string, Rel>;
  placeholders: PlaceholderDef[];
}

interface SlideEnv {
  zip: JSZip;
  color: ColorContext;
  slideCx: number;
  slideCy: number;
  canvasW: number;
  canvasH: number;
  rels: Map<string, Rel>;
  partPath: string;
  layout?: LayerInfo;
  master?: LayerInfo;
  txStyles?: XmlNode;
  slideNumber: number;
  report: PptxImportReport;
  nextId: () => string;
  mediaCache: Map<string, Promise<string | null>>;
  mediaLimit?: number;
  diagramDrawings: string[];
}

const EMU_PER_PT = 12700;
const IDENTITY: Transform = { sx: 1, sy: 1, tx: 0, ty: 0 };
const MASTER_MEDIA_LIMIT = 300 * 1024;
const DOWNSCALE_ABOVE = 1.5 * 1024 * 1024;
const CHART_PALETTE = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'];
const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};
const PRESET_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  gray: '808080',
  grey: '808080',
  orange: 'FFA500',
  purple: '800080',
  cyan: '00FFFF',
  magenta: 'FF00FF',
  silver: 'C0C0C0',
  navy: '000080',
  teal: '008080',
  maroon: '800000',
  lime: '00FF00',
  olive: '808000',
};
const DEFAULT_THEME: Theme = {
  colors: {
    dk1: '000000',
    lt1: 'FFFFFF',
    dk2: '44546A',
    lt2: 'E7E6E6',
    accent1: '4472C4',
    accent2: 'ED7D31',
    accent3: 'A5A5A5',
    accent4: 'FFC000',
    accent5: '5B9BD5',
    accent6: '70AD47',
    hlink: '0563C1',
    folHlink: '954F72',
  },
  majorFont: 'Calibri Light',
  minorFont: 'Calibri',
  lineWidths: [0.5, 1, 1.5],
};
const DEFAULT_CLR_MAP: Record<string, string> = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
};
const TRANSITION_NAMES: Record<string, TransitionType> = {
  fade: 'fade',
  push: 'push',
  wipe: 'wipe',
  split: 'split',
  cut: 'cut',
  cover: 'cover',
  pull: 'uncover',
  randomBar: 'random-bars',
  dissolve: 'dissolve',
  checker: 'checkerboard',
  blinds: 'blinds',
  wheel: 'clock',
  wheelReverse: 'clock',
  zoom: 'zoom',
  circle: 'shape',
  diamond: 'shape',
  plus: 'shape',
  wedge: 'shape',
  newsflash: 'zoom',
  strips: 'wipe',
  comb: 'comb',
  random: 'random',
  vortex: 'vortex',
  switch: 'switch',
  flip: 'flip',
  ripple: 'ripple',
  honeycomb: 'honeycomb',
  prism: 'cube',
  doors: 'doors',
  window: 'window',
  ferris: 'ferris',
  gallery: 'gallery',
  conveyor: 'conveyor',
  pan: 'pan',
  glitter: 'glitter',
  warp: 'zoom',
  flythrough: 'fly-through',
  flash: 'flash',
  shred: 'shred',
  reveal: 'reveal',
  morph: 'morph',
  fallOver: 'fall-over',
  drape: 'drape',
  curtains: 'curtains',
  wind: 'wind',
  prestige: 'prestige',
  fracture: 'fracture',
  crush: 'crush',
  peelOff: 'peel-off',
  pageCurlDouble: 'page-curl',
  pageCurlSingle: 'page-curl',
  airplane: 'airplane',
  origami: 'origami',
};
const TRANSITION_DIRECTIONS: Record<string, TransitionDirection> = {
  l: 'from-right',
  r: 'from-left',
  u: 'from-bottom',
  d: 'from-top',
  horz: 'horizontal',
  vert: 'vertical',
  in: 'in',
  out: 'out',
};

function resolvePath(basePart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const segments = basePart.split('/');
  segments.pop();
  for (const piece of target.split('/')) {
    if (piece === '..') segments.pop();
    else if (piece !== '.' && piece !== '') segments.push(piece);
  }
  return segments.join('/');
}

async function readXml(zip: JSZip, partPath: string): Promise<XmlNode | undefined> {
  const file = zip.file(partPath);
  if (!file) return undefined;
  return parseXml(await file.async('string'));
}

async function readRels(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
  const index = partPath.lastIndexOf('/');
  const relsPath = `${partPath.slice(0, index)}/_rels/${partPath.slice(index + 1)}.rels`;
  const rels = new Map<string, Rel>();
  const doc = await readXml(zip, relsPath);
  for (const node of descendants(doc, 'Relationship')) {
    if (node.attrs.TargetMode === 'External') continue;
    rels.set(node.attrs.Id, { target: resolvePath(partPath, node.attrs.Target ?? ''), type: node.attrs.Type ?? '' });
  }
  return rels;
}

function relByType(rels: Map<string, Rel>, suffix: string): string | undefined {
  for (const rel of rels.values()) {
    if (rel.type.endsWith(suffix)) return rel.target;
  }
  return undefined;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function rgbToHex(rgb: number[]): string {
  return rgb
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  if (max === min) return [0, 0, light];
  const delta = max - min;
  const sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return [hue / 6, sat, light];
}

function hslToRgb([h, s, l]: number[]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

interface Rgba {
  hex: string;
  alpha: number;
}

function readColorNode(node: XmlNode | undefined, ctx: ColorContext, phColor?: Rgba): Rgba | undefined {
  if (!node) return undefined;
  let hex: string | undefined;
  let alpha = 1;
  const kind = localName(node.name);
  if (kind === 'srgbClr') hex = node.attrs.val;
  else if (kind === 'sysClr') hex = node.attrs.lastClr ?? (node.attrs.val === 'window' ? 'FFFFFF' : '000000');
  else if (kind === 'prstClr') hex = PRESET_COLORS[node.attrs.val ?? ''] ?? '000000';
  else if (kind === 'scrgbClr') {
    const part = (name: string) => (parseInt(node.attrs[name] ?? '0', 10) / 100000) * 255;
    hex = rgbToHex([part('r'), part('g'), part('b')]);
  } else if (kind === 'schemeClr') {
    const key = node.attrs.val ?? '';
    if (key === 'phClr') {
      if (!phColor) return undefined;
      hex = phColor.hex;
      alpha = phColor.alpha;
    } else {
      hex = ctx.theme.colors[ctx.clrMap[key] ?? key];
    }
  }
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  let rgb = hexToRgb(hex);
  for (const modifier of node.children) {
    const amount = parseInt(modifier.attrs.val ?? '100000', 10) / 100000;
    switch (localName(modifier.name)) {
      case 'alpha':
        alpha *= amount;
        break;
      case 'lumMod': {
        const hsl = rgbToHsl(rgb);
        rgb = hslToRgb([hsl[0], hsl[1], Math.min(1, hsl[2] * amount)]);
        break;
      }
      case 'lumOff': {
        const hsl = rgbToHsl(rgb);
        rgb = hslToRgb([hsl[0], hsl[1], Math.max(0, Math.min(1, hsl[2] + amount))]);
        break;
      }
      case 'tint':
        rgb = [rgb[0] * amount + 255 * (1 - amount), rgb[1] * amount + 255 * (1 - amount), rgb[2] * amount + 255 * (1 - amount)];
        break;
      case 'shade':
        rgb = [rgb[0] * amount, rgb[1] * amount, rgb[2] * amount];
        break;
      default:
        break;
    }
  }
  return { hex: rgbToHex(rgb), alpha };
}

function readColor(parent: XmlNode | undefined, ctx: ColorContext, phColor?: Rgba): Rgba | undefined {
  if (!parent) return undefined;
  for (const node of parent.children) {
    if (/Clr$/.test(node.name)) return readColorNode(node, ctx, phColor);
  }
  return undefined;
}

function css(color: Rgba): string {
  if (color.alpha >= 0.995) return `#${color.hex}`;
  const [r, g, b] = hexToRgb(color.hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(color.alpha * 100) / 100})`;
}

type Fill =
  | { kind: 'solid'; color: Rgba }
  | { kind: 'gradient'; css: string }
  | { kind: 'image'; relId: string }
  | { kind: 'none' };

function readFill(container: XmlNode | undefined, ctx: ColorContext, phColor?: Rgba): Fill | undefined {
  if (!container) return undefined;
  for (const node of container.children) {
    const kind = localName(node.name);
    if (kind === 'noFill') return { kind: 'none' };
    if (kind === 'solidFill') {
      const color = readColor(node, ctx, phColor);
      return color ? { kind: 'solid', color } : undefined;
    }
    if (kind === 'gradFill') {
      const stops = childrenOf(child(node, 'a:gsLst'), 'a:gs')
        .map((stop) => ({ pos: parseInt(stop.attrs.pos ?? '0', 10) / 1000, color: readColor(stop, ctx, phColor) }))
        .filter((stop): stop is { pos: number; color: Rgba } => stop.color !== undefined)
        .sort((a, b) => a.pos - b.pos);
      if (stops.length === 0) return undefined;
      if (stops.length === 1) return { kind: 'solid', color: stops[0].color };
      const list = stops.map((stop) => `${css(stop.color)} ${Math.round(stop.pos)}%`).join(', ');
      if (child(node, 'a:path')) return { kind: 'gradient', css: `radial-gradient(circle, ${list})` };
      const angle = parseInt(child(node, 'a:lin')?.attrs.ang ?? '5400000', 10) / 60000;
      return { kind: 'gradient', css: `linear-gradient(${Math.round(angle + 90) % 360}deg, ${list})` };
    }
    if (kind === 'blipFill') {
      const relId = child(node, 'a:blip')?.attrs['r:embed'];
      return relId ? { kind: 'image', relId } : undefined;
    }
    if (kind === 'pattFill') {
      const color = readColor(child(node, 'a:fgClr'), ctx, phColor);
      return color ? { kind: 'solid', color } : undefined;
    }
  }
  return undefined;
}

interface Line {
  color?: Rgba;
  width: number;
  dash?: 'dashed' | 'dotted';
  head: boolean;
  tail: boolean;
  none: boolean;
}

function readLine(ln: XmlNode | undefined, ctx: ColorContext, phColor?: Rgba): Line | undefined {
  if (!ln) return undefined;
  const fill = readFill(ln, ctx, phColor);
  const dashName = child(ln, 'a:prstDash')?.attrs.val ?? '';
  const end = (name: string) => {
    const type = child(ln, name)?.attrs.type;
    return type !== undefined && type !== 'none';
  };
  return {
    color: fill?.kind === 'solid' ? fill.color : undefined,
    width: ln.attrs.w ? parseInt(ln.attrs.w, 10) / EMU_PER_PT : Number.NaN,
    dash: /dot/i.test(dashName) ? 'dotted' : /dash/i.test(dashName) ? 'dashed' : undefined,
    head: end('a:headEnd'),
    tail: end('a:tailEnd'),
    none: fill?.kind === 'none',
  };
}

function readXfrm(node: XmlNode | undefined): Xfrm | undefined {
  const off = child(node, 'a:off');
  const ext = child(node, 'a:ext');
  if (!node || !off || !ext) return undefined;
  return {
    x: parseInt(off.attrs.x ?? '0', 10),
    y: parseInt(off.attrs.y ?? '0', 10),
    cx: parseInt(ext.attrs.cx ?? '0', 10),
    cy: parseInt(ext.attrs.cy ?? '0', 10),
    rot: parseInt(node.attrs.rot ?? '0', 10) / 60000,
    flipH: node.attrs.flipH === '1' || node.attrs.flipH === 'true',
    flipV: node.attrs.flipV === '1' || node.attrs.flipV === 'true',
  };
}

function applyTransform(xfrm: Xfrm, transform: Transform): Xfrm {
  return {
    ...xfrm,
    x: xfrm.x * transform.sx + transform.tx,
    y: xfrm.y * transform.sy + transform.ty,
    cx: xfrm.cx * transform.sx,
    cy: xfrm.cy * transform.sy,
  };
}

function readRunStyle(rPr: XmlNode | undefined, ctx: ColorContext): TextStyle {
  if (!rPr) return {};
  const style: TextStyle = {};
  if (rPr.attrs.sz) style.size = parseInt(rPr.attrs.sz, 10) / 100;
  if (rPr.attrs.b !== undefined) style.bold = rPr.attrs.b === '1' || rPr.attrs.b === 'true';
  if (rPr.attrs.i !== undefined) style.italic = rPr.attrs.i === '1' || rPr.attrs.i === 'true';
  if (rPr.attrs.u !== undefined) style.underline = rPr.attrs.u !== 'none';
  if (rPr.attrs.strike !== undefined) style.strike = rPr.attrs.strike !== 'noStrike';
  const color = readColor(child(rPr, 'a:solidFill'), ctx);
  if (color) style.color = css(color);
  const face = child(rPr, 'a:latin')?.attrs.typeface;
  if (face) style.font = face.startsWith('+mj') ? ctx.theme.majorFont : face.startsWith('+mn') ? ctx.theme.minorFont : face;
  return style;
}

function readParagraphStyle(pPr: XmlNode | undefined, ctx: ColorContext): TextStyle {
  if (!pPr) return {};
  const style = readRunStyle(child(pPr, 'a:defRPr'), ctx);
  if (pPr.attrs.algn) style.align = pPr.attrs.algn;
  if (child(pPr, 'a:buNone')) style.bullet = 'none';
  else if (child(pPr, 'a:buAutoNum')) style.bullet = 'number';
  else if (child(pPr, 'a:buChar') || child(pPr, 'a:buBlip')) style.bullet = 'char';
  const spacing = path(pPr, 'a:lnSpc', 'a:spcPct')?.attrs.val;
  if (spacing) style.lineHeight = parseInt(spacing, 10) / 100000;
  return style;
}

function mergeStyles(...styles: TextStyle[]): TextStyle {
  const merged: TextStyle = {};
  for (const style of styles) {
    for (const key of Object.keys(style) as (keyof TextStyle)[]) {
      if (merged[key] === undefined && style[key] !== undefined) {
        (merged as Record<string, unknown>)[key] = style[key];
      }
    }
  }
  return merged;
}

function levelStyle(container: XmlNode | undefined, level: number, ctx: ColorContext): TextStyle {
  return readParagraphStyle(child(container, `a:lvl${level + 1}pPr`), ctx);
}

function collectPlaceholders(tree: XmlNode | undefined): PlaceholderDef[] {
  const list: PlaceholderDef[] = [];
  for (const sp of descendants(tree, 'p:sp')) {
    const ph = path(sp, 'p:nvSpPr', 'p:nvPr', 'p:ph');
    if (!ph) continue;
    list.push({
      type: ph.attrs.type ?? 'body',
      idx: ph.attrs.idx,
      xfrm: readXfrm(path(sp, 'p:spPr', 'a:xfrm')),
      lstStyle: path(sp, 'p:txBody', 'a:lstStyle'),
      bodyPr: path(sp, 'p:txBody', 'a:bodyPr'),
    });
  }
  return list;
}

const TITLE_TYPES = new Set(['title', 'ctrTitle']);

function masterType(type: string): string {
  if (TITLE_TYPES.has(type)) return 'title';
  if (type === 'subTitle' || type === 'obj' || type === 'body') return 'body';
  return type;
}

function findPlaceholder(list: PlaceholderDef[] | undefined, type: string, idx: string | undefined, loose: boolean) {
  if (!list) return undefined;
  if (idx !== undefined) {
    const byIdx = list.find((item) => item.idx === idx);
    if (byIdx) return byIdx;
  }
  const exact = list.find((item) => item.type === type);
  if (exact || !loose) return exact;
  return list.find((item) => masterType(item.type) === masterType(type));
}

function mediaType(partPath: string): string | undefined {
  return IMAGE_TYPES[partPath.slice(partPath.lastIndexOf('.') + 1).toLowerCase()];
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function downscale(bytes: Uint8Array, type: string): Promise<string | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
    const scale = Math.min(1, 1920 / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL('image/webp', 0.86);
    return url.startsWith('data:image/webp') ? url : null;
  } catch {
    return null;
  }
}

function loadMedia(env: SlideEnv, partPath: string): Promise<string | null> {
  const cached = env.mediaCache.get(partPath);
  if (cached) return cached;
  const task = (async () => {
    const type = mediaType(partPath);
    const file = env.zip.file(partPath);
    if (!type || !file) return null;
    const bytes = await file.async('uint8array');
    if (bytes.length > DOWNSCALE_ABOVE && type !== 'image/svg+xml' && type !== 'image/gif') {
      const smaller = await downscale(bytes, type);
      if (smaller) return smaller;
    }
    return `data:${type};base64,${toBase64(bytes)}`;
  })();
  env.mediaCache.set(partPath, task);
  return task;
}

async function mediaFromRel(env: SlideEnv, rels: Map<string, Rel>, relId: string | undefined): Promise<string | null> {
  const rel = relId ? rels.get(relId) : undefined;
  if (!rel) return null;
  if (env.mediaLimit !== undefined) {
    const size = (env.zip.file(rel.target) as unknown as { _data?: { uncompressedSize?: number } } | null)?._data
      ?.uncompressedSize;
    if (size !== undefined && size > env.mediaLimit) return null;
  }
  const data = await loadMedia(env, rel.target);
  if (!data) env.report.skipped.push(`Ảnh ${rel.target.split('/').pop()} có định dạng trình duyệt không hiển thị được`);
  return data;
}

function percentBox(env: SlideEnv, xfrm: Xfrm) {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    x: round((xfrm.x / env.slideCx) * 100),
    y: round((xfrm.y / env.slideCy) * 100),
    width: round((xfrm.cx / env.slideCx) * 100),
    height: round((xfrm.cy / env.slideCy) * 100),
  };
}

function pxScale(env: SlideEnv): number {
  return env.canvasH / (env.slideCy / EMU_PER_PT);
}

interface TextResult {
  text: string;
  style: TextStyle;
  anchor: 'top' | 'middle' | 'bottom';
  fontScale: number;
}

function readTextBody(
  txBody: XmlNode | undefined,
  env: SlideEnv,
  placeholder: { type: string; idx?: string } | undefined,
  fallbackColor: string | undefined,
  shapeStyleColor?: string
): TextResult | undefined {
  if (!txBody) return undefined;
  const ctx = env.color;
  const layoutPh = placeholder ? findPlaceholder(env.layout?.placeholders, placeholder.type, placeholder.idx, false) : undefined;
  const masterPh = placeholder ? findPlaceholder(env.master?.placeholders, placeholder.type, undefined, true) : undefined;
  const kind = placeholder ? masterType(placeholder.type) : 'other';
  const masterStyle = child(env.txStyles, kind === 'title' ? 'p:titleStyle' : kind === 'body' ? 'p:bodyStyle' : 'p:otherStyle');
  const ownList = child(txBody, 'a:lstStyle');
  const bodyPr = child(txBody, 'a:bodyPr');

  const lines: string[] = [];
  let dominant: TextStyle | undefined;
  let counter = 0;
  for (const paragraph of childrenOf(txBody, 'a:p')) {
    const pPr = child(paragraph, 'a:pPr');
    const level = parseInt(pPr?.attrs.lvl ?? '0', 10) || 0;
    const base = mergeStyles(
      readParagraphStyle(pPr, ctx),
      levelStyle(ownList, level, ctx),
      levelStyle(layoutPh?.lstStyle, level, ctx),
      levelStyle(masterPh?.lstStyle, level, ctx),
      shapeStyleColor ? { color: shapeStyleColor } : {},
      levelStyle(masterStyle, level, ctx)
    );
    let line = '';
    let runStyle: TextStyle | undefined;
    for (const part of paragraph.children) {
      if (part.name === 'a:br') {
        line += '\n';
      } else if (part.name === 'a:r' || part.name === 'a:fld') {
        let value = child(part, 'a:t')?.text ?? '';
        if (part.name === 'a:fld' && /slidenum/i.test(part.attrs.type ?? '')) value = String(env.slideNumber);
        if (value && !runStyle) runStyle = mergeStyles(readRunStyle(child(part, 'a:rPr'), ctx), base);
        line += value;
      }
    }
    if (line.trim() && base.bullet && base.bullet !== 'none') {
      counter = base.bullet === 'number' ? counter + 1 : 0;
      line = `${'  '.repeat(level)}${base.bullet === 'number' ? `${counter}.` : '•'} ${line}`;
    } else if (line.trim()) {
      counter = 0;
    }
    lines.push(line);
    if (!dominant && runStyle) dominant = runStyle;
  }
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  if (lines.length === 0) return undefined;

  const anchorName = bodyPr?.attrs.anchor ?? layoutPh?.bodyPr?.attrs.anchor ?? masterPh?.bodyPr?.attrs.anchor ?? 't';
  const autofit = child(bodyPr, 'a:normAutofit')?.attrs.fontScale;
  const style = dominant ?? {};
  if (!style.color && fallbackColor) style.color = fallbackColor;
  if (!style.font) style.font = kind === 'title' ? ctx.theme.majorFont : ctx.theme.minorFont;
  return {
    text: lines.join('\n'),
    style,
    anchor: anchorName === 'ctr' ? 'middle' : anchorName === 'b' ? 'bottom' : 'top',
    fontScale: autofit ? parseInt(autofit, 10) / 100000 : 1,
  };
}

function textProps(result: TextResult, env: SlideEnv, defaultSize: number): Partial<SlideElement> {
  const style = result.style;
  const size = (style.size ?? defaultSize) * result.fontScale * pxScale(env);
  const align = style.align === 'ctr' ? 'center' : style.align === 'r' ? 'right' : style.align === 'just' ? 'justify' : 'left';
  return {
    text: result.text,
    fontFamily: `'${style.font ?? env.color.theme.minorFont}', 'Segoe UI', sans-serif`,
    fontSize: Math.round(size * 10) / 10,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : 'none',
    color: style.color ?? '#000000',
    textAlign: align,
    verticalAlign: result.anchor,
    lineHeight: Math.round((style.lineHeight ?? 1) * 1.2 * 100) / 100,
  };
}

function arcToCubics(cx: number, cy: number, rx: number, ry: number, start: number, sweep: number): number[][] {
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const step = sweep / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const curves: number[][] = [];
  for (let index = 0; index < pieces; index++) {
    const a0 = start + step * index;
    const a1 = a0 + step;
    curves.push([
      cx + rx * (Math.cos(a0) - k * Math.sin(a0)),
      cy + ry * (Math.sin(a0) + k * Math.cos(a0)),
      cx + rx * (Math.cos(a1) + k * Math.sin(a1)),
      cy + ry * (Math.sin(a1) - k * Math.cos(a1)),
      cx + rx * Math.cos(a1),
      cy + ry * Math.sin(a1),
    ]);
  }
  return curves;
}

export function customGeometryPath(custGeom: XmlNode | undefined): string | undefined {
  const parts: string[] = [];
  for (const shapePath of childrenOf(child(custGeom, 'a:pathLst'), 'a:path')) {
    const width = parseInt(shapePath.attrs.w ?? '0', 10) || 1;
    const height = parseInt(shapePath.attrs.h ?? '0', 10) || 1;
    const fx = (value: number) => Math.round((value / width) * 10000) / 100;
    const fy = (value: number) => Math.round((value / height) * 10000) / 100;
    const points = (node: XmlNode) =>
      childrenOf(node, 'a:pt').map((pt) => [parseInt(pt.attrs.x ?? '0', 10), parseInt(pt.attrs.y ?? '0', 10)]);
    let cursor = [0, 0];
    for (const command of shapePath.children) {
      const pts = points(command);
      switch (localName(command.name)) {
        case 'moveTo':
          if (pts[0]) {
            parts.push(`M${fx(pts[0][0])} ${fy(pts[0][1])}`);
            cursor = pts[0];
          }
          break;
        case 'lnTo':
          if (pts[0]) {
            parts.push(`L${fx(pts[0][0])} ${fy(pts[0][1])}`);
            cursor = pts[0];
          }
          break;
        case 'cubicBezTo':
          if (pts.length === 3) {
            parts.push(`C${pts.map((pt) => `${fx(pt[0])} ${fy(pt[1])}`).join(' ')}`);
            cursor = pts[2];
          }
          break;
        case 'quadBezTo':
          if (pts.length === 2) {
            parts.push(`Q${pts.map((pt) => `${fx(pt[0])} ${fy(pt[1])}`).join(' ')}`);
            cursor = pts[1];
          }
          break;
        case 'arcTo': {
          const rx = parseInt(command.attrs.wR ?? '0', 10);
          const ry = parseInt(command.attrs.hR ?? '0', 10);
          const start = (parseInt(command.attrs.stAng ?? '0', 10) / 60000) * (Math.PI / 180);
          const sweep = (parseInt(command.attrs.swAng ?? '0', 10) / 60000) * (Math.PI / 180);
          if (!Number.isFinite(rx + ry + start + sweep) || rx <= 0 || ry <= 0) break;
          const centerX = cursor[0] - rx * Math.cos(start);
          const centerY = cursor[1] - ry * Math.sin(start);
          for (const curve of arcToCubics(centerX, centerY, rx, ry, start, sweep)) {
            parts.push(`C${fx(curve[0])} ${fy(curve[1])} ${fx(curve[2])} ${fy(curve[3])} ${fx(curve[4])} ${fy(curve[5])}`);
            cursor = [curve[4], curve[5]];
          }
          break;
        }
        case 'close':
          parts.push('Z');
          break;
        default:
          break;
      }
    }
  }
  return parts.length > 0 ? parts.join('') : undefined;
}

const LINE_PRESETS = /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/;

function lineElement(env: SlideEnv, xfrm: Xfrm, line: Line | undefined, groupId: string | undefined): SlideElement {
  const toPxX = env.canvasW / env.slideCx;
  const toPxY = env.canvasH / env.slideCy;
  const x1 = (xfrm.flipH ? xfrm.x + xfrm.cx : xfrm.x) * toPxX;
  const y1 = (xfrm.flipV ? xfrm.y + xfrm.cy : xfrm.y) * toPxY;
  const x2 = (xfrm.flipH ? xfrm.x : xfrm.x + xfrm.cx) * toPxX;
  const y2 = (xfrm.flipV ? xfrm.y : xfrm.y + xfrm.cy) * toPxY;
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const width = Math.max(0.5, (line?.width ?? 1) * pxScale(env));
  const thickness = Math.max(12, width * 4);
  let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + xfrm.rot;
  let shapeType = 'line';
  if (line?.head && line.tail) shapeType = 'double-arrow-line';
  else if (line?.tail) shapeType = 'arrow-line';
  else if (line?.head) {
    shapeType = 'arrow-line';
    angle += 180;
  }
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    id: env.nextId(),
    type: 'shape',
    shapeType,
    x: round(((midX - length / 2) / env.canvasW) * 100),
    y: round(((midY - thickness / 2) / env.canvasH) * 100),
    width: round((length / env.canvasW) * 100),
    height: round((thickness / env.canvasH) * 100),
    rotation: Math.round((((angle % 360) + 360) % 360) * 10) / 10,
    stroke: line?.color ? css(line.color) : '#000000',
    strokeWidth: Math.round(width * 10) / 10,
    borderStyle: line?.dash ?? 'solid',
    groupId,
  };
}

async function shapeElement(
  sp: XmlNode,
  env: SlideEnv,
  transform: Transform,
  groupId: string | undefined,
  skipPlaceholders: boolean
): Promise<SlideElement | undefined> {
  const connector = sp.name === 'p:cxnSp';
  const spPr = child(sp, 'p:spPr');
  const ph = path(sp, connector ? 'p:nvCxnSpPr' : 'p:nvSpPr', 'p:nvPr', 'p:ph');
  const placeholder = ph ? { type: ph.attrs.type ?? 'body', idx: ph.attrs.idx } : undefined;
  if (placeholder && skipPlaceholders) return undefined;
  const ownXfrm = readXfrm(child(spPr, 'a:xfrm'));
  const inherited = placeholder
    ? findPlaceholder(env.layout?.placeholders, placeholder.type, placeholder.idx, false)?.xfrm ??
      findPlaceholder(env.master?.placeholders, placeholder.type, undefined, true)?.xfrm
    : undefined;
  const rawXfrm = ownXfrm ?? inherited;
  if (!rawXfrm) return undefined;
  const xfrm = applyTransform(rawXfrm, transform);

  const ctx = env.color;
  const style = child(sp, 'p:style');
  const styleFill = readColor(child(style, 'a:fillRef'), ctx);
  const styleLine = readColor(child(style, 'a:lnRef'), ctx);
  const styleFont = readColor(child(style, 'a:fontRef'), ctx);
  const fillRefIdx = parseInt(child(style, 'a:fillRef')?.attrs.idx ?? '0', 10);
  const lineRefIdx = parseInt(child(style, 'a:lnRef')?.attrs.idx ?? '0', 10);

  const prst = child(spPr, 'a:prstGeom')?.attrs.prst;
  const customPath = customGeometryPath(child(spPr, 'a:custGeom'));
  const explicitFill = readFill(spPr, ctx, styleFill);
  const fill: Fill | undefined = explicitFill ?? (styleFill && fillRefIdx > 0 ? { kind: 'solid', color: styleFill } : undefined);
  const explicitLine = readLine(child(spPr, 'a:ln'), ctx, styleLine);
  const themeWidth = ctx.theme.lineWidths[Math.max(0, lineRefIdx - 1)] ?? 1;
  if (explicitLine && Number.isNaN(explicitLine.width)) explicitLine.width = themeWidth;
  const line: Line | undefined =
    explicitLine && (explicitLine.color || explicitLine.none)
      ? explicitLine
      : styleLine && lineRefIdx > 0
        ? { color: styleLine, width: explicitLine?.width ?? themeWidth, dash: explicitLine?.dash, head: Boolean(explicitLine?.head), tail: Boolean(explicitLine?.tail), none: false }
        : explicitLine;

  if (connector || (prst && LINE_PRESETS.test(prst))) {
    if (line?.none) return undefined;
    return lineElement(env, xfrm, line, groupId);
  }

  const isTextBox = path(sp, 'p:nvSpPr', 'p:cNvSpPr')?.attrs.txBox === '1';
  const themeText = `#${ctx.theme.colors[ctx.clrMap.tx1 ?? 'dk1'] ?? '000000'}`;
  const text = readTextBody(
    child(sp, 'p:txBody'),
    env,
    placeholder,
    themeText,
    styleFont && !isTextBox && !placeholder ? css(styleFont) : undefined
  );

  const base: SlideElement = {
    id: env.nextId(),
    type: 'shape',
    ...percentBox(env, xfrm),
    rotation: xfrm.rot ? Math.round((((xfrm.rot % 360) + 360) % 360) * 10) / 10 : undefined,
    groupId,
  };

  if (fill?.kind === 'image') {
    const src = await mediaFromRel(env, env.rels, fill.relId);
    if (src) return { ...base, type: 'image', src, objectFit: 'fill', borderRadius: 0, shapeShadow: false };
  }

  const visibleFill = fill !== undefined && fill.kind !== 'none' && fill.kind !== 'image';
  const visibleLine = line !== undefined && !line.none && line.color !== undefined;
  const plainBox = !customPath && (!prst || prst === 'rect');
  const defaultSize = placeholder && TITLE_TYPES.has(placeholder.type) ? 44 : 18;

  if (!visibleFill && !visibleLine && plainBox) {
    if (!text) return undefined;
    return {
      ...base,
      type: 'text',
      ...textProps(text, env, defaultSize),
      isTitle: placeholder ? TITLE_TYPES.has(placeholder.type) : undefined,
    };
  }

  const element: SlideElement = {
    ...base,
    shapeType: customPath ? 'custom' : shapeFromPrst(prst),
    customPath,
    flipH: xfrm.flipH || undefined,
    flipV: xfrm.flipV || undefined,
    fillType: !visibleFill ? 'none' : fill.kind === 'gradient' ? 'gradient' : 'solid',
    fill: visibleFill && fill.kind === 'solid' ? css(fill.color) : undefined,
    gradient: visibleFill && fill.kind === 'gradient' ? fill.css : undefined,
    stroke: visibleLine ? css(line.color!) : 'transparent',
    strokeWidth: visibleLine ? Math.max(0.5, Math.round(line.width * pxScale(env) * 10) / 10) : 0,
    borderStyle: line?.dash ?? 'solid',
  };
  if (text) Object.assign(element, textProps(text, env, defaultSize));
  if (text && !text.style.align) element.textAlign = isTextBox || placeholder ? 'left' : 'center';
  if (text && !isTextBox && !placeholder && !child(sp, 'p:txBody')?.children.some((node) => node.name === 'a:bodyPr' && node.attrs.anchor)) {
    element.verticalAlign = 'middle';
  }
  return element;
}

async function pictureElement(
  pic: XmlNode,
  env: SlideEnv,
  transform: Transform,
  groupId: string | undefined
): Promise<SlideElement | undefined> {
  const spPr = child(pic, 'p:spPr');
  const rawXfrm = readXfrm(child(spPr, 'a:xfrm'));
  if (!rawXfrm) return undefined;
  const xfrm = applyTransform(rawXfrm, transform);
  const src = await mediaFromRel(env, env.rels, path(pic, 'p:blipFill', 'a:blip')?.attrs['r:embed']);
  if (!src) return undefined;
  const prst = child(spPr, 'a:prstGeom')?.attrs.prst;
  return {
    id: env.nextId(),
    type: 'image',
    ...percentBox(env, xfrm),
    rotation: xfrm.rot ? Math.round((((xfrm.rot % 360) + 360) % 360) * 10) / 10 : undefined,
    src,
    alt: path(pic, 'p:nvPicPr', 'p:cNvPr')?.attrs.descr,
    objectFit: 'fill',
    borderRadius: 0,
    shapeShadow: false,
    flipH: xfrm.flipH || undefined,
    flipV: xfrm.flipV || undefined,
    imageMask: prst === 'ellipse' ? 'circle' : prst === 'roundRect' ? 'rounded' : undefined,
    groupId,
  };
}

function cellText(cell: XmlNode): string {
  return childrenOf(child(cell, 'a:txBody'), 'a:p')
    .map((paragraph) => descendants(paragraph, 'a:t').map((node) => node.text).join(''))
    .join('\n')
    .trim();
}

function tableElement(tbl: XmlNode, env: SlideEnv, xfrm: Xfrm, groupId: string | undefined): SlideElement {
  const rows = childrenOf(tbl, 'a:tr').map((row) => childrenOf(row, 'a:tc').map(cellText));
  const firstCell = path(tbl, 'a:tr', 'a:tc');
  const headerFill = readFill(child(firstCell, 'a:tcPr'), env.color);
  const headerText = readColor(descendants(firstCell, 'a:solidFill').find((node) => node !== child(child(firstCell, 'a:tcPr'), 'a:solidFill')), env.color);
  return {
    id: env.nextId(),
    type: 'table',
    ...percentBox(env, xfrm),
    tableRows: rows.length,
    tableCols: Math.max(0, ...rows.map((row) => row.length)),
    tableData: rows,
    tableHeaderRow: child(tbl, 'a:tblPr')?.attrs.firstRow === '1',
    tableHeaderColor: headerFill?.kind === 'solid' ? css(headerFill.color) : `#${env.color.theme.colors.accent1 ?? '4472C4'}`,
    tableHeaderTextColor: headerText ? css(headerText) : '#FFFFFF',
    groupId,
  };
}

function cachedValues(node: XmlNode | undefined): string[] {
  const points = descendants(node, 'c:pt').sort((a, b) => parseInt(a.attrs.idx ?? '0', 10) - parseInt(b.attrs.idx ?? '0', 10));
  return points.map((point) => child(point, 'c:v')?.text ?? '');
}

async function chartElement(
  partPath: string,
  env: SlideEnv,
  xfrm: Xfrm,
  groupId: string | undefined
): Promise<SlideElement | undefined> {
  const doc = await readXml(env.zip, partPath);
  const plotArea = descendants(doc, 'c:plotArea')[0];
  const plot = plotArea?.children.find((node) => /Chart$/.test(node.name));
  if (!plot) return undefined;
  const kind = localName(plot.name);
  let chartType: ChartType = 'column';
  if (/^bar/.test(kind)) chartType = child(plot, 'c:barDir')?.attrs.val === 'bar' ? 'bar' : 'column';
  else if (/^(line|area|scatter|radar)/.test(kind)) chartType = 'line';
  else if (/^doughnut/.test(kind)) chartType = 'doughnut';
  else if (/^(pie|ofPie)/.test(kind)) chartType = 'pie';
  const series = childrenOf(plot, 'c:ser');
  if (series.length === 0) return undefined;
  const categories = cachedValues(child(series[0], 'c:cat') ?? child(series[0], 'c:xVal'));
  const chartSeries: ChartSeries[] = series.map((ser, index) => {
    const color = readColor(path(ser, 'c:spPr', 'a:solidFill'), env.color);
    return {
      name: cachedValues(child(ser, 'c:tx'))[0] || `Chuỗi ${index + 1}`,
      values: cachedValues(child(ser, 'c:val') ?? child(ser, 'c:yVal')).map((value) => Number(value) || 0),
      color: color ? css(color) : CHART_PALETTE[index % CHART_PALETTE.length],
    };
  });
  const title = descendants(child(descendants(doc, 'c:chart')[0], 'c:title'), 'a:t').map((node) => node.text).join('');
  return {
    id: env.nextId(),
    type: 'chart',
    ...percentBox(env, xfrm),
    chartType,
    chartTitle: title || undefined,
    chartCategories: categories.length > 0 ? categories : chartSeries[0].values.map((_, index) => String(index + 1)),
    chartSeries,
    groupId,
  };
}

async function frameElements(
  frame: XmlNode,
  env: SlideEnv,
  transform: Transform,
  groupId: string | undefined
): Promise<SlideElement[]> {
  const rawXfrm = readXfrm(child(frame, 'p:xfrm'));
  if (!rawXfrm) return [];
  const xfrm = applyTransform(rawXfrm, transform);
  const data = path(frame, 'a:graphic', 'a:graphicData');
  const table = child(data, 'a:tbl');
  if (table) return [tableElement(table, env, xfrm, groupId)];
  const chartRel = child(data, 'c:chart')?.attrs['r:id'];
  if (chartRel) {
    const target = env.rels.get(chartRel)?.target;
    const chart = target ? await chartElement(target, env, xfrm, groupId) : undefined;
    if (chart) return [chart];
    env.report.skipped.push('Một biểu đồ có kiểu chưa đọc được');
    return [];
  }
  const fallbackPicture = descendants(data, 'p:pic')[0];
  if (fallbackPicture) {
    const picture = await pictureElement(fallbackPicture, env, transform, groupId);
    if (picture) return [{ ...picture, ...percentBox(env, xfrm) }];
  }
  if (child(data, 'dgm:relIds')) {
    const drawingPath = env.diagramDrawings.shift();
    const file = drawingPath ? env.zip.file(drawingPath) : null;
    if (drawingPath && file) {
      const xml = (await file.async('string')).replace(/<(\/?)dsp:/g, '<$1p:');
      const drawing = parseXml(xml);
      const tree = descendants(drawing, 'p:spTree')[0];
      const inner: Transform = {
        sx: transform.sx,
        sy: transform.sy,
        tx: rawXfrm.x * transform.sx + transform.tx,
        ty: rawXfrm.y * transform.sy + transform.ty,
      };
      const group = groupId ?? env.nextId().replace('el-', 'grp-');
      const savedRels = env.rels;
      env.rels = await readRels(env.zip, drawingPath);
      const elements = await treeElements(tree, env, inner, group, false);
      env.rels = savedRels;
      if (elements.length > 0) return elements;
    }
    env.report.skipped.push('Một sơ đồ SmartArt không có bản vẽ kèm theo');
    return [];
  }
  env.report.skipped.push('Một đối tượng nhúng (OLE) không có ảnh xem trước');
  return [];
}

async function treeElements(
  tree: XmlNode | undefined,
  env: SlideEnv,
  transform: Transform,
  groupId: string | undefined,
  skipPlaceholders: boolean
): Promise<SlideElement[]> {
  const elements: SlideElement[] = [];
  if (!tree) return elements;
  for (const raw of tree.children) {
    const nodes =
      raw.name === 'mc:AlternateContent'
        ? (child(raw, 'mc:Fallback') ?? child(raw, 'mc:Choice'))?.children ?? []
        : [raw];
    for (const node of nodes) {
      if (node.name === 'p:sp' || node.name === 'p:cxnSp') {
        const element = await shapeElement(node, env, transform, groupId, skipPlaceholders);
        if (element) elements.push(element);
      } else if (node.name === 'p:pic') {
        const element = await pictureElement(node, env, transform, groupId);
        if (element) elements.push(element);
      } else if (node.name === 'p:graphicFrame') {
        elements.push(...(await frameElements(node, env, transform, groupId)));
      } else if (node.name === 'p:grpSp') {
        const xfrmNode = path(node, 'p:grpSpPr', 'a:xfrm');
        const outer = readXfrm(xfrmNode);
        const chOff = child(xfrmNode, 'a:chOff');
        const chExt = child(xfrmNode, 'a:chExt');
        let inner = transform;
        if (outer && chOff && chExt) {
          const childCx = parseInt(chExt.attrs.cx ?? '0', 10) || outer.cx || 1;
          const childCy = parseInt(chExt.attrs.cy ?? '0', 10) || outer.cy || 1;
          const scaleX = outer.cx / childCx;
          const scaleY = outer.cy / childCy;
          inner = {
            sx: transform.sx * scaleX,
            sy: transform.sy * scaleY,
            tx: transform.sx * (outer.x - parseInt(chOff.attrs.x ?? '0', 10) * scaleX) + transform.tx,
            ty: transform.sy * (outer.y - parseInt(chOff.attrs.y ?? '0', 10) * scaleY) + transform.ty,
          };
        }
        const group = groupId ?? env.nextId().replace('el-', 'grp-');
        elements.push(...(await treeElements(node, env, inner, group, skipPlaceholders)));
      }
    }
  }
  return elements;
}

async function readBackground(
  root: XmlNode | undefined,
  env: SlideEnv,
  rels: Map<string, Rel>
): Promise<SlideBackground | undefined> {
  const bg = path(root?.children[0], 'p:cSld', 'p:bg');
  if (!bg) return undefined;
  const fill = readFill(child(bg, 'p:bgPr'), env.color);
  if (fill?.kind === 'solid') return { type: 'solid', value: css(fill.color) };
  if (fill?.kind === 'gradient') return { type: 'gradient', value: fill.css };
  if (fill?.kind === 'image') {
    const src = await mediaFromRel(env, rels, fill.relId);
    if (src) return { type: 'image', value: `url("${src}") center / cover no-repeat` };
  }
  const reference = readColor(child(bg, 'p:bgRef'), env.color);
  return reference ? { type: 'solid', value: css(reference) } : undefined;
}

function readTransition(root: XmlNode | undefined): SlideTransition {
  const node = descendants(root, 'p:transition')[0];
  const transition: SlideTransition = { type: 'none', duration: 0.7 };
  if (!node) return transition;
  const effect = node.children.find((item) => !/extLst$/.test(item.name));
  const name = effect ? localName(effect.name) : '';
  const preset = effect?.attrs.prst;
  transition.type = TRANSITION_NAMES[preset ?? ''] ?? TRANSITION_NAMES[name] ?? 'fade';
  const duration = node.attrs['p14:dur'] ?? node.attrs.dur;
  if (duration) transition.duration = Math.max(0.1, parseInt(duration, 10) / 1000);
  else transition.duration = node.attrs.spd === 'slow' ? 1.2 : node.attrs.spd === 'med' ? 0.75 : 0.5;
  const direction = TRANSITION_DIRECTIONS[effect?.attrs.dir ?? effect?.attrs.orient ?? ''];
  if (direction) transition.direction = direction;
  if (node.attrs.advTm) transition.advanceAfterSeconds = parseInt(node.attrs.advTm, 10) / 1000;
  if (node.attrs.advClick === '0') transition.advanceOnClick = false;
  return transition;
}

async function readTheme(zip: JSZip, themePath: string | undefined): Promise<Theme> {
  const doc = themePath ? await readXml(zip, themePath) : undefined;
  const scheme = descendants(doc, 'a:clrScheme')[0];
  if (!scheme) return DEFAULT_THEME;
  const colors: Record<string, string> = { ...DEFAULT_THEME.colors };
  for (const entry of scheme.children) {
    const value = entry.children[0];
    const hex = value?.attrs.val && /^[0-9a-f]{6}$/i.test(value.attrs.val) ? value.attrs.val : value?.attrs.lastClr;
    if (hex) colors[localName(entry.name)] = hex.toUpperCase();
  }
  const fonts = descendants(doc, 'a:fontScheme')[0];
  const lineWidths = childrenOf(descendants(doc, 'a:lnStyleLst')[0], 'a:ln').map(
    (node) => parseInt(node.attrs.w ?? '12700', 10) / EMU_PER_PT
  );
  return {
    colors,
    majorFont: path(fonts, 'a:majorFont', 'a:latin')?.attrs.typeface || DEFAULT_THEME.majorFont,
    minorFont: path(fonts, 'a:minorFont', 'a:latin')?.attrs.typeface || DEFAULT_THEME.minorFont,
    lineWidths: lineWidths.length > 0 ? lineWidths : DEFAULT_THEME.lineWidths,
  };
}

async function readLayer(zip: JSZip, partPath: string | undefined): Promise<LayerInfo | undefined> {
  if (!partPath) return undefined;
  const root = await readXml(zip, partPath);
  if (!root) return undefined;
  return {
    root,
    partPath,
    rels: await readRels(zip, partPath),
    placeholders: collectPlaceholders(path(root.children[0], 'p:cSld', 'p:spTree')),
  };
}

async function readNotes(zip: JSZip, notesPath: string | undefined): Promise<string> {
  const doc = notesPath ? await readXml(zip, notesPath) : undefined;
  for (const sp of descendants(doc, 'p:sp')) {
    if (path(sp, 'p:nvSpPr', 'p:nvPr', 'p:ph')?.attrs.type !== 'body') continue;
    return childrenOf(child(sp, 'p:txBody'), 'a:p')
      .map((paragraph) => descendants(paragraph, 'a:t').map((node) => node.text).join(''))
      .join('\n')
      .trim();
  }
  return '';
}

function fallbackPresentation(fileName: string): PresentationData {
  return {
    aspectRatio: '16:9',
    themeId: 'office-classic',
    title: fileName,
    slides: [createSlideFromLayout('title', 0, 'office-classic', fileName.replace(/\.[^/.]+$/, ''))],
  };
}

export async function importPptxDetailed(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ presentation: PresentationData; report: PptxImportReport }> {
  const zip = await JSZip.loadAsync(buffer);
  const report: PptxImportReport = { slides: 0, elements: 0, skipped: [] };
  const presentationPath = 'ppt/presentation.xml';
  const presentationDoc = await readXml(zip, presentationPath);
  const presentationRels = await readRels(zip, presentationPath);

  let slidePaths = descendants(presentationDoc, 'p:sldId')
    .map((node) => presentationRels.get(node.attrs['r:id'] ?? '')?.target)
    .filter((target): target is string => Boolean(target && zip.file(target)));
  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10));
  }
  if (slidePaths.length === 0) return { presentation: fallbackPresentation(fileName), report };

  const size = descendants(presentationDoc, 'p:sldSz')[0];
  const slideCx = parseInt(size?.attrs.cx ?? '12192000', 10) || 12192000;
  const slideCy = parseInt(size?.attrs.cy ?? '6858000', 10) || 6858000;
  const aspectRatio: PresentationData['aspectRatio'] = slideCx / slideCy < 1.5 ? '4:3' : '16:9';
  const canvasH = 540;
  const canvasW = aspectRatio === '4:3' ? 720 : 960;

  const layerCache = new Map<string, Promise<LayerInfo | undefined>>();
  const themeCache = new Map<string, Promise<Theme>>();
  const mediaCache = new Map<string, Promise<string | null>>();
  const getLayer = (partPath: string | undefined) => {
    if (!partPath) return Promise.resolve(undefined);
    if (!layerCache.has(partPath)) layerCache.set(partPath, readLayer(zip, partPath));
    return layerCache.get(partPath)!;
  };
  const getTheme = (themePath: string | undefined) => {
    const key = themePath ?? '';
    if (!themeCache.has(key)) themeCache.set(key, readTheme(zip, themePath));
    return themeCache.get(key)!;
  };

  const stamp = Date.now();
  let counter = 0;
  const slides: SlideData[] = [];

  for (let index = 0; index < slidePaths.length; index++) {
    const partPath = slidePaths[index];
    const root = await readXml(zip, partPath);
    if (!root) continue;
    const rels = await readRels(zip, partPath);
    const layout = await getLayer(relByType(rels, '/slideLayout'));
    const master = await getLayer(layout ? relByType(layout.rels, '/slideMaster') : undefined);
    const theme = await getTheme(master ? relByType(master.rels, '/theme') : relByType(presentationRels, '/theme'));
    const clrMapNode = child(master?.root.children[0], 'p:clrMap');
    const env: SlideEnv = {
      zip,
      color: { theme, clrMap: { ...DEFAULT_CLR_MAP, ...(clrMapNode?.attrs ?? {}) } },
      slideCx,
      slideCy,
      canvasW,
      canvasH,
      rels,
      partPath,
      layout,
      master,
      txStyles: child(master?.root.children[0], 'p:txStyles'),
      slideNumber: index + 1,
      report,
      nextId: () => `el-${stamp}-${counter++}`,
      mediaCache,
      diagramDrawings: [...rels.values()].filter((rel) => rel.type.endsWith('/diagramDrawing')).map((rel) => rel.target),
    };

    const slideNode = root.children[0];
    const elements: SlideElement[] = [];
    const showMaster = slideNode?.attrs.showMasterSp !== '0' && layout?.root.children[0]?.attrs.showMasterSp !== '0';
    for (const layer of [showMaster ? master : undefined, layout]) {
      if (!layer) continue;
      env.rels = layer.rels;
      env.mediaLimit = MASTER_MEDIA_LIMIT;
      env.diagramDrawings = [];
      elements.push(...(await treeElements(path(layer.root.children[0], 'p:cSld', 'p:spTree'), env, IDENTITY, undefined, true)));
    }
    env.rels = rels;
    env.mediaLimit = undefined;
    env.diagramDrawings = [...rels.values()].filter((rel) => rel.type.endsWith('/diagramDrawing')).map((rel) => rel.target);
    elements.push(...(await treeElements(path(slideNode, 'p:cSld', 'p:spTree'), env, IDENTITY, undefined, false)));

    const background =
      (await readBackground(root, env, rels)) ??
      (layout ? await readBackground(layout.root, env, layout.rels) : undefined) ??
      (master ? await readBackground(master.root, env, master.rels) : undefined) ?? { type: 'solid' as const, value: '#FFFFFF' };

    elements.forEach((element, order) => {
      element.zIndex = 10 + order;
    });
    report.elements += elements.length;
    slides.push({
      id: `imported-slide-${index + 1}-${stamp}`,
      layout: index === 0 ? 'title' : 'title-content',
      background,
      transition: readTransition(root),
      notes: await readNotes(zip, relByType(rels, '/notesSlide')),
      hidden: slideNode?.attrs.show === '0' ? true : undefined,
      elements,
    });
  }

  if (descendants(presentationDoc, 'p:sldId').length > 0 && slides.length === 0) {
    return { presentation: fallbackPresentation(fileName), report };
  }
  report.slides = slides.length;
  report.skipped = [...new Set(report.skipped)];
  return {
    presentation: { aspectRatio, themeId: 'office-classic', title: fileName, slides },
    report,
  };
}

export async function importFromPptx(buffer: ArrayBuffer, fileName: string): Promise<PresentationData> {
  return (await importPptxDetailed(buffer, fileName)).presentation;
}
