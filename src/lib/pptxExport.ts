import PptxGenJS from 'pptxgenjs';
import type { PresentationData, ShapeType, SlideBackground, SlideElement } from './slideTypes';
import { downloadBlob } from './download';

function mapShapeType(pres: PptxGenJS, shapeType?: ShapeType): string {
  const shapes = pres.ShapeType;
  switch (shapeType) {
    case 'rectangle': return shapes.rect || 'rect';
    case 'rounded-rectangle': return shapes.roundRect || 'roundRect';
    case 'circle': return shapes.ellipse || 'ellipse';
    case 'triangle': return shapes.triangle || 'triangle';
    case 'right-arrow': return shapes.rightArrow || 'rightArrow';
    case 'left-arrow': return shapes.leftArrow || 'leftArrow';
    case 'up-arrow': return shapes.upArrow || 'upArrow';
    case 'down-arrow': return shapes.downArrow || 'downArrow';
    case 'star': return shapes.star5 || 'star5';
    case 'callout': return shapes.wedgeRectCallout || 'wedgeRectCallout';
    case 'heart': return shapes.heart || 'heart';
    case 'diamond': return shapes.diamond || 'diamond';
    case 'hexagon': return shapes.hexagon || 'hexagon';
    case 'line': return shapes.line || 'line';
    default: return shapes.rect || 'rect';
  }
}

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

export function createPptxDocument(presentation: PresentationData): PptxGenJS {
  const pres = new PptxGenJS();

  pres.layout = presentation.aspectRatio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';
  pres.title = presentation.title || 'Minh Spark Office Presentation';
  pres.author = presentation.author || 'Minh Spark Office';

  for (const slideData of presentation.slides) {
    const slide = pres.addSlide();
    if (slideData.hidden) slide.hidden = true;
    slide.background = mapSlideBackground(slideData.background);

    // Speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    // Add elements
    for (const el of slideData.elements) {
      const x = `${el.x}%` as any;
      const y = `${el.y}%` as any;
      const w = `${el.width}%` as any;
      const h = `${el.height}%` as any;

      if (el.type === 'text' && el.text) {
        slide.addText(el.text, {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize || 18,
          fontFace: el.fontFamily?.replace(/['"]/g, '').split(',')[0] || 'Segoe UI',
          color: colorOr(el.color, '000000'),
          bold: el.fontWeight === 'bold',
          italic: el.fontStyle === 'italic',
          underline: el.textDecoration === 'underline' ? { style: 'sng' } : undefined,
          align: (el.textAlign || 'left') as any,
          valign: (el.verticalAlign || 'top') as any,
          bullet: el.isBullet ? true : false,
        });
      } else if (el.type === 'shape') {
        const shapeName = mapShapeType(pres, el.shapeType);
        slide.addShape(shapeName as any, {
          x,
          y,
          w,
          h,
          fill: mapShapeFill(el),
          line: mapShapeLine(el),
        });

        if (el.text) {
          slide.addText(el.text, {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 18,
            color: colorOr(el.color, 'FFFFFF'),
            align: 'center',
            valign: 'middle',
            bold: true,
          });
        }
      } else if (el.type === 'image' && el.src) {
        if (el.src.startsWith('data:image')) {
          slide.addImage({
            data: el.src,
            x,
            y,
            w,
            h,
          });
        } else if (el.src.startsWith('http')) {
          slide.addImage({
            path: el.src,
            x,
            y,
            w,
            h,
          });
        }
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

        slide.addTable(tableRows as any, {
          x,
          y,
          w,
          h,
          border: { type: 'solid', pt: 1, color: 'CBD5E1' },
        });
      } else if (el.type === 'chart' && el.chartSeries && el.chartCategories) {
        let presChartType = pres.ChartType.bar;
        if (el.chartType === 'column') presChartType = pres.ChartType.bar;
        else if (el.chartType === 'line') presChartType = pres.ChartType.line;
        else if (el.chartType === 'pie') presChartType = pres.ChartType.pie;
        else if (el.chartType === 'doughnut') presChartType = pres.ChartType.doughnut;

        const chartData = el.chartSeries.map((s) => ({
          name: s.name,
          labels: el.chartCategories!,
          values: s.values,
        }));

        slide.addChart(presChartType, chartData, {
          x,
          y,
          w,
          h,
          showTitle: Boolean(el.chartTitle),
          title: el.chartTitle || '',
        });
      }
    }
  }

  return pres;
}

export async function exportToPptx(
  presentation: PresentationData,
  fileName = 'Bai-thuyet-trinh.pptx'
): Promise<void> {
  const pres = createPptxDocument(presentation);
  const outName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  downloadBlob(blob, outName);
}
