import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import type { PresentationData, SlideBackground, SlideElement, SlideTransition } from './slideTypes';
import { downloadBlob } from './download';
import { getShapeDef, parseSimplePath } from './slideShapes';
import { slideAspectInfo } from './settings/slideOptions';

const DEFAULT_SHAPE_FILL = '0284C7';
const WHITE = 'FFFFFF';
const NO_FILL_KEYWORDS = new Set(['', 'none', 'transparent']);
const CSS_COLOR_PATTERN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
const NAMED_COLORS: Record<string, string> = {
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
};

const toHexByte = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase();

function parseHexColor(value: string): string | null {
  const hex = value.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    if (hex.length === 4 && hex[3] === '0') return null;
    return hex.slice(0, 3).split('').map((c) => c + c).join('').toUpperCase();
  }
  if (hex.length === 6) return hex.toUpperCase();
  if (hex.length === 8) return hex.slice(6, 8) === '00' ? null : hex.slice(0, 6).toUpperCase();
  return null;
}

function parseRgbColor(value: string): string | null {
  const parts = value.match(/-?\d*\.?\d+%?/g);
  if (!parts || parts.length < 3) return null;
  const channel = (part: string) => (part.endsWith('%') ? (parseFloat(part) / 100) * 255 : parseFloat(part));
  if (parts.length >= 4) {
    const alpha = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (alpha <= 0) return null;
  }
  return parts.slice(0, 3).map((part) => toHexByte(channel(part))).join('');
}

export function parseCssColor(color: string | undefined | null): string | null {
  const value = (color ?? '').trim().toLowerCase();
  if (NO_FILL_KEYWORDS.has(value)) return null;
  if (value.startsWith('#')) return parseHexColor(value);
  if (value.startsWith('rgb')) return parseRgbColor(value);
  return NAMED_COLORS[value] ?? null;
}

export function approximateGradientColor(gradient: string | undefined | null): string | null {
  const stops = (gradient ?? '').match(CSS_COLOR_PATTERN) ?? [];
  const colors = stops.map((stop) => parseCssColor(stop)).filter((hex): hex is string => hex !== null);
  if (colors.length === 0) return null;
  const sum = [0, 0, 0];
  for (const hex of colors) {
    for (let i = 0; i < 3; i++) sum[i] += parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return sum.map((total) => toHexByte(total / colors.length)).join('');
}

function colorOr(color: string | undefined, fallback: string) {
  return parseCssColor(color) ?? fallback;
}

function extractImageSource(value: string): string {
  const match = /^url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(value.trim());
  return match ? match[2] : value.trim();
}

export function mapSlideBackground(background: SlideBackground | undefined): PptxGenJS.BackgroundProps {
  if (!background?.value) return { color: WHITE };
  if (background.type === 'image') {
    const source = extractImageSource(background.value);
    if (source.startsWith('data:image')) return { data: source };
    if (/^https?:\/\//i.test(source)) return { path: source };
    return { color: WHITE };
  }
  if (background.type === 'gradient') {
    return { color: approximateGradientColor(background.value) ?? parseCssColor(background.value) ?? WHITE };
  }
  return { color: parseCssColor(background.value) ?? approximateGradientColor(background.value) ?? WHITE };
}

export function mapShapeFill(el: SlideElement): PptxGenJS.ShapeFillProps | undefined {
  if (el.fillType === 'none') return undefined;
  if (el.fillType === 'gradient' && el.gradient) {
    const approx = approximateGradientColor(el.gradient);
    return approx ? { color: approx } : undefined;
  }
  if (el.fill === undefined) return { color: DEFAULT_SHAPE_FILL };
  const color = parseCssColor(el.fill) ?? approximateGradientColor(el.fill);
  return color ? { color } : undefined;
}

export function mapShapeLine(el: SlideElement): PptxGenJS.ShapeLineProps | undefined {
  const color = parseCssColor(el.stroke);
  if (!color || el.strokeWidth === 0) return undefined;
  const dashType = el.borderStyle === 'dashed' ? 'dash' : el.borderStyle === 'dotted' ? 'sysDot' : undefined;
  return { color, width: el.strokeWidth || 1, ...(dashType ? { dashType } : {}) };
}

const SLIDE_HEIGHT_IN = 7.5;

function slideWidthIn(presentation: PresentationData): number {
  return slideAspectInfo(presentation.aspectRatio).widthIn;
}

function fontFace(el: SlideElement, fallback = 'Segoe UI'): string {
  return el.fontFamily?.replace(/['"]/g, '').split(',')[0].trim() || fallback;
}

function isBold(el: SlideElement): boolean {
  return el.fontWeight === 'bold' || Number(el.fontWeight) >= 600;
}

export function textRuns(text: string): PptxGenJS.TextProps[] {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const bullet = /^(\s*)•\s?(.*)$/.exec(line);
    const options: PptxGenJS.TextPropsOptions = { breakLine: index < lines.length - 1 };
    if (bullet) {
      options.bullet = { indent: 18 };
      options.indentLevel = Math.floor(bullet[1].length / 2);
    }
    return { text: bullet ? bullet[2] : line, options };
  });
}

function textOptions(el: SlideElement, defaults: { color: string; size: number; align: string; valign: string }) {
  return {
    fontSize: el.fontSize || defaults.size,
    fontFace: fontFace(el),
    color: colorOr(el.color, defaults.color),
    bold: isBold(el),
    italic: el.fontStyle === 'italic',
    underline: el.textDecoration === 'underline' ? ({ style: 'sng' } as const) : undefined,
    strike: el.textDecoration === 'line-through' ? ('sngStrike' as const) : undefined,
    align: (el.textAlign || defaults.align) as PptxGenJS.HAlign,
    valign: (el.verticalAlign || defaults.valign) as PptxGenJS.VAlign,
    lineSpacingMultiple: el.lineHeight ? Math.max(0.6, Math.round((el.lineHeight / 1.2) * 100) / 100) : undefined,
    charSpacing: el.letterSpacing || undefined,
  };
}

function shadowOf(el: SlideElement): PptxGenJS.ShadowProps | undefined {
  if (!el.shapeShadow) return undefined;
  return {
    type: 'outer',
    color: parseCssColor(el.shadowColor) ?? '000000',
    opacity: 0.3,
    blur: el.shadowBlur ?? 12,
    offset: Math.max(1, el.shadowOffsetY ?? 6),
    angle: 90,
  };
}

type GeometryPoints = NonNullable<PptxGenJS.ShapeProps['points']>;

function customGeometryPoints(d: string, widthIn: number, heightIn: number): GeometryPoints {
  const points: GeometryPoints = [];
  const px = (value: number) => Math.round((value / 100) * widthIn * 10000) / 10000;
  const py = (value: number) => Math.round((value / 100) * heightIn * 10000) / 10000;
  for (const command of parseSimplePath(d)) {
    const v = command.points;
    if (command.type === 'M' && v.length >= 2) points.push({ x: px(v[0]), y: py(v[1]), moveTo: true });
    else if (command.type === 'L' && v.length >= 2) points.push({ x: px(v[0]), y: py(v[1]) });
    else if (command.type === 'C' && v.length >= 6) {
      points.push({ x: px(v[4]), y: py(v[5]), curve: { type: 'cubic', x1: px(v[0]), y1: py(v[1]), x2: px(v[2]), y2: py(v[3]) } });
    } else if (command.type === 'Q' && v.length >= 4) {
      points.push({ x: px(v[2]), y: py(v[3]), curve: { type: 'quadratic', x1: px(v[0]), y1: py(v[1]) } });
    } else if (command.type === 'Z') points.push({ close: true });
  }
  return points;
}

const BASIC_TRANSITIONS: Record<string, (direction: string | undefined) => string> = {
  fade: () => '<p:fade/>',
  cut: () => '<p:cut/>',
  push: (dir) => `<p:push dir="${dir ?? 'u'}"/>`,
  wipe: (dir) => `<p:wipe dir="${dir ?? 'l'}"/>`,
  cover: (dir) => `<p:cover dir="${dir ?? 'l'}"/>`,
  uncover: (dir) => `<p:pull dir="${dir ?? 'l'}"/>`,
  split: () => '<p:split orient="horz" dir="out"/>',
  'random-bars': () => '<p:randomBar dir="horz"/>',
  dissolve: () => '<p:dissolve/>',
  checkerboard: () => '<p:checker dir="horz"/>',
  blinds: () => '<p:blinds dir="horz"/>',
  clock: () => '<p:wheel spokes="1"/>',
  zoom: () => '<p:zoom dir="in"/>',
  shape: () => '<p:circle/>',
  comb: () => '<p:comb dir="horz"/>',
  random: () => '<p:random/>',
};

const EXTENDED_TRANSITIONS: Record<string, string> = {
  vortex: '<p14:vortex dir="r"/>',
  switch: '<p14:switch dir="r"/>',
  flip: '<p14:flip dir="r"/>',
  ripple: '<p14:ripple/>',
  honeycomb: '<p14:honeycomb/>',
  cube: '<p14:prism isInverted="1"/>',
  box: '<p14:prism isInverted="1" isContent="1"/>',
  rotate: '<p14:prism isContent="1"/>',
  orbit: '<p14:prism isContent="1" isInverted="1"/>',
  doors: '<p14:doors dir="vert"/>',
  window: '<p14:window dir="horz"/>',
  ferris: '<p14:ferris dir="l"/>',
  gallery: '<p14:gallery dir="l"/>',
  conveyor: '<p14:conveyor dir="l"/>',
  pan: '<p14:pan dir="u"/>',
  glitter: '<p14:glitter pattern="hexagon" dir="l"/>',
  'fly-through': '<p14:flythrough/>',
  flash: '<p14:flash/>',
  shred: '<p14:shred pattern="strip" dir="in"/>',
  reveal: '<p14:reveal/>',
};

const DIRECTION_CODES: Record<string, string> = {
  'from-right': 'l',
  'from-left': 'r',
  'from-bottom': 'u',
  'from-top': 'd',
};

export function transitionXml(transition: SlideTransition | undefined): string {
  if (!transition || transition.type === 'none') return '';
  const attrs = [
    `spd="${transition.duration >= 1 ? 'slow' : transition.duration >= 0.7 ? 'med' : 'fast'}"`,
    transition.advanceOnClick === false ? 'advClick="0"' : '',
    transition.advanceAfterSeconds ? `advTm="${Math.round(transition.advanceAfterSeconds * 1000)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const direction = DIRECTION_CODES[transition.direction ?? ''];
  const extended = EXTENDED_TRANSITIONS[transition.type];
  if (extended) {
    const ms = Math.round(transition.duration * 1000);
    return (
      '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
      `<mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14"><p:transition ${attrs} p14:dur="${ms}">${extended}</p:transition></mc:Choice>` +
      `<mc:Fallback><p:transition ${attrs}><p:fade/></p:transition></mc:Fallback>` +
      '</mc:AlternateContent>'
    );
  }
  const basic = BASIC_TRANSITIONS[transition.type] ?? BASIC_TRANSITIONS.fade;
  return `<p:transition ${attrs}>${basic(direction)}</p:transition>`;
}

export async function addSlideTransitions(
  file: ArrayBuffer | Uint8Array,
  presentation: PresentationData
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(file);
  for (let index = 0; index < presentation.slides.length; index++) {
    const xml = transitionXml(presentation.slides[index].transition);
    const part = zip.file(`ppt/slides/slide${index + 1}.xml`);
    if (!xml || !part) continue;
    const source = await part.async('string');
    if (source.includes('<p:transition') || !source.includes('</p:sld>')) continue;
    zip.file(`ppt/slides/slide${index + 1}.xml`, source.replace('</p:sld>', `${xml}</p:sld>`));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function createPptxDocument(presentation: PresentationData): PptxGenJS {
  const pres = new PptxGenJS();
  const widthIn = slideWidthIn(presentation);

  if (presentation.aspectRatio === '4:3') pres.layout = 'LAYOUT_4x3';
  else if (presentation.aspectRatio === '16:9' || !presentation.aspectRatio) pres.layout = 'LAYOUT_WIDE';
  else {
    pres.defineLayout({ name: 'MINH_CUSTOM', width: widthIn, height: SLIDE_HEIGHT_IN });
    pres.layout = 'MINH_CUSTOM';
  }
  pres.title = presentation.title || 'Office 23 Presentation';
  pres.author = presentation.author || 'Office 23';

  presentation.slides.forEach((slideData) => {
    const slide = pres.addSlide();
    if (slideData.hidden) slide.hidden = true;
    slide.background = mapSlideBackground(slideData.background);

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    const ordered = slideData.elements
      .map((el, order) => ({ el, order }))
      .sort((a, b) => (a.el.zIndex ?? 10) - (b.el.zIndex ?? 10) || a.order - b.order)
      .map((item) => item.el);

    for (const el of ordered) {
      const x = (el.x / 100) * widthIn;
      const y = (el.y / 100) * SLIDE_HEIGHT_IN;
      const w = (el.width / 100) * widthIn;
      const h = (el.height / 100) * SLIDE_HEIGHT_IN;
      const box = { x, y, w, h };
      const rotate = el.rotation ? Math.round(el.rotation) : undefined;
      const flips = { flipH: el.flipH || undefined, flipV: el.flipV || undefined };
      const transparency = el.opacity !== undefined && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : undefined;

      if (el.type === 'text' && el.text) {
        slide.addText(textRuns(el.text), {
          ...box,
          rotate,
          ...textOptions(el, { color: '000000', size: 18, align: 'left', valign: 'top' }),
          margin: Math.round((el.padding ?? 8) * 0.75),
        });
      } else if (el.type === 'shape') {
        const def = getShapeDef(el.shapeType);
        if (el.shapeType !== 'custom' && def.line) {
          const color = parseCssColor(el.stroke) ?? parseCssColor(el.fill) ?? DEFAULT_SHAPE_FILL;
          slide.addShape('line', {
            x,
            y: y + h / 2,
            w,
            h: 0,
            rotate,
            line: {
              color,
              width: el.strokeWidth || 2,
              dashType: el.borderStyle === 'dashed' ? 'dash' : el.borderStyle === 'dotted' ? 'sysDot' : undefined,
              beginArrowType: def.line === 'both' ? 'triangle' : undefined,
              endArrowType: def.line !== 'none' ? 'triangle' : undefined,
            },
          });
          continue;
        }
        const baseFill = mapShapeFill(el);
        const fill = baseFill && transparency !== undefined ? { ...baseFill, transparency } : baseFill;
        const line = mapShapeLine(el);
        const shadow = shadowOf(el);
        const custom = el.shapeType === 'custom' && el.customPath ? customGeometryPoints(el.customPath, w, h) : undefined;
        const shapeName = (custom ? 'custGeom' : def.prst) as PptxGenJS.SHAPE_NAME;
        if (el.text && !custom) {
          slide.addText(textRuns(el.text), {
            ...box,
            rotate,
            ...flips,
            shape: shapeName,
            fill,
            line,
            shadow,
            ...textOptions(el, { color: 'FFFFFF', size: 16, align: 'center', valign: 'middle' }),
            bold: el.fontWeight === undefined ? true : isBold(el),
          });
        } else {
          slide.addShape(shapeName, { ...box, rotate, ...flips, fill, line, shadow, points: custom });
          if (el.text) {
            slide.addText(textRuns(el.text), {
              ...box,
              rotate,
              ...textOptions(el, { color: 'FFFFFF', size: 16, align: 'center', valign: 'middle' }),
            });
          }
        }
      } else if (el.type === 'image' && el.src) {
        const image = { ...box, rotate, ...flips, rounding: el.imageMask === 'circle' || undefined, transparency };
        if (el.src.startsWith('data:image')) slide.addImage({ data: el.src, ...image });
        else if (el.src.startsWith('http')) slide.addImage({ path: el.src, ...image });
      } else if (el.type === 'table' && el.tableData) {
        const tableRows = el.tableData.map((row, rIdx) => {
          const isHeader = rIdx === 0 && el.tableHeaderRow;
          return row.map((cell) => ({
            text: cell,
            options: {
              fill: isHeader ? { color: colorOr(el.tableHeaderColor, 'D83B01') } : { color: rIdx % 2 === 0 ? 'F8FAFC' : 'FFFFFF' },
              color: isHeader ? colorOr(el.tableHeaderTextColor, 'FFFFFF') : '1E293B',
              bold: isHeader,
              align: 'center',
              valign: 'middle',
            },
          }));
        });

        slide.addTable(tableRows as PptxGenJS.TableRow[], {
          ...box,
          border: { type: 'solid', pt: 1, color: 'CBD5E1' },
        });
      } else if (el.type === 'chart' && el.chartSeries && el.chartCategories) {
        let presChartType = pres.ChartType.bar;
        if (el.chartType === 'line') presChartType = pres.ChartType.line;
        else if (el.chartType === 'pie') presChartType = pres.ChartType.pie;
        else if (el.chartType === 'doughnut') presChartType = pres.ChartType.doughnut;

        const chartData = el.chartSeries.map((s) => ({
          name: s.name,
          labels: el.chartCategories!,
          values: s.values,
        }));
        const colors = el.chartSeries.map((s) => parseCssColor(s.color)).filter((hex): hex is string => hex !== null);
        const perSeriesColors =
          colors.length === el.chartSeries.length &&
          presChartType !== pres.ChartType.pie &&
          presChartType !== pres.ChartType.doughnut;

        slide.addChart(presChartType, chartData, {
          ...box,
          barDir: el.chartType === 'bar' ? 'bar' : 'col',
          chartColors: perSeriesColors ? colors : undefined,
          showLegend: el.chartSeries.length > 1,
          legendPos: 'b',
          showTitle: Boolean(el.chartTitle),
          title: el.chartTitle || '',
        });
      } else if (el.type === 'ink' && el.inkPoints && el.inkPoints.length >= 4) {
        const points: GeometryPoints = [];
        for (let i = 0; i + 1 < el.inkPoints.length; i += 2) {
          const point = { x: (el.inkPoints[i] / 100) * w, y: (el.inkPoints[i + 1] / 100) * h };
          points.push(i === 0 ? { ...point, moveTo: true } : point);
        }
        slide.addShape('custGeom' as PptxGenJS.SHAPE_NAME, {
          ...box,
          points,
          line: { color: parseCssColor(el.inkColor) ?? '000000', width: el.inkWidth || 3 },
        });
      } else if (el.type === 'smartart' && el.smartArtItems && el.smartArtItems.length > 0) {
        const gap = 0.12;
        const pad = 0.1;
        const count = el.smartArtItems.length;
        const cardW = (w - pad * 2 - gap * (count - 1)) / count;
        el.smartArtItems.forEach((item, i) => {
          slide.addText(
            [
              { text: item.title, options: { bold: true, fontSize: 16, breakLine: true } },
              { text: item.desc, options: { fontSize: 13 } },
            ],
            {
              x: x + pad + i * (cardW + gap),
              y: y + pad,
              w: cardW,
              h: h - pad * 2,
              shape: 'roundRect' as PptxGenJS.SHAPE_NAME,
              rectRadius: 0.08,
              fill: { color: colorOr(item.color, DEFAULT_SHAPE_FILL) },
              color: WHITE,
              fontFace: 'Segoe UI',
              align: 'left',
              valign: 'top',
              margin: 10,
            }
          );
        });
      } else if (el.type === 'code') {
        slide.addText(el.codeContent || el.text || '', {
          ...box,
          rotate,
          shape: 'roundRect' as PptxGenJS.SHAPE_NAME,
          rectRadius: 0.06,
          fill: { color: '0F172A' },
          color: 'E2E8F0',
          fontFace: 'Consolas',
          fontSize: 12,
          align: 'left',
          valign: 'top',
          margin: 10,
        });
      } else if (el.type === 'math') {
        slide.addText(el.mathFormula || el.text || '', {
          ...box,
          rotate,
          fontFace: 'Cambria Math',
          fontSize: el.fontSize || 22,
          italic: true,
          color: colorOr(el.color, '1E293B'),
          align: 'center',
          valign: 'middle',
        });
      } else if (el.type === 'zoom') {
        const target = presentation.slides.findIndex((item) => item.id === el.zoomSlideId);
        slide.addText(el.zoomSlideTitle || 'Slide Zoom', {
          ...box,
          shape: 'roundRect' as PptxGenJS.SHAPE_NAME,
          rectRadius: 0.06,
          fill: { color: 'F1F5F9' },
          line: { color: '94A3B8', width: 1 },
          color: '1E293B',
          fontSize: 14,
          bold: true,
          align: 'center',
          valign: 'middle',
          hyperlink: target >= 0 ? { slide: target + 1 } : undefined,
        });
      } else if (el.type === 'video') {
        const url = el.videoData?.url ?? '';
        slide.addText('▶ Video', {
          ...box,
          shape: 'rect' as PptxGenJS.SHAPE_NAME,
          fill: { color: '000000' },
          color: WHITE,
          fontSize: 20,
          bold: true,
          align: 'center',
          valign: 'middle',
          hyperlink: /^https?:\/\//i.test(url) ? { url } : undefined,
        });
      } else if (el.type === 'countdown') {
        const remaining = el.countdownData?.remaining ?? el.countdownData?.duration ?? 300;
        const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
        slide.addText(
          [
            { text: el.countdownData?.title || 'Đồng hồ đếm ngược', options: { fontSize: 13, color: '94A3B8', breakLine: true } },
            { text: clock, options: { fontSize: 38, bold: true, color: '38BDF8', fontFace: 'Consolas' } },
          ],
          {
            ...box,
            shape: 'roundRect' as PptxGenJS.SHAPE_NAME,
            rectRadius: 0.08,
            fill: { color: '0F172A' },
            line: { color: '38BDF8', width: 2 },
            align: 'center',
            valign: 'middle',
          }
        );
      } else if (el.type === 'poll' && el.pollData) {
        const poll = el.pollData;
        const total = poll.options.reduce((sum, option) => sum + option.votes, 0) || 1;
        slide.addText(
          [
            { text: poll.question, options: { bold: true, fontSize: 15, color: '0F172A', breakLine: true } },
            ...poll.options.map((option, i) => ({
              text: `${option.text}: ${Math.round((option.votes / total) * 100)}% (${option.votes})`,
              options: { fontSize: 13, color: '1E293B', bullet: true, breakLine: i < poll.options.length - 1 },
            })),
          ],
          {
            ...box,
            shape: 'roundRect' as PptxGenJS.SHAPE_NAME,
            rectRadius: 0.05,
            fill: { color: WHITE },
            line: { color: 'E2E8F0', width: 1 },
            align: 'left',
            valign: 'top',
            margin: 12,
          }
        );
      } else if (el.type === '3d') {
        slide.addShape('cube' as PptxGenJS.SHAPE_NAME, {
          ...box,
          fill: { color: colorOr(el.model3d?.color, DEFAULT_SHAPE_FILL) },
          line: { color: WHITE, width: 1 },
        });
      }
    }
  });

  return pres;
}

export async function buildPptxFile(presentation: PresentationData): Promise<Uint8Array> {
  const pres = createPptxDocument(presentation);
  const raw = (await pres.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return addSlideTransitions(raw, presentation);
}

export async function exportToPptx(
  presentation: PresentationData,
  fileName = 'Bai-thuyet-trinh.pptx'
): Promise<void> {
  const bytes = await buildPptxFile(presentation);
  const outName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  downloadBlob(blob, outName);
}
