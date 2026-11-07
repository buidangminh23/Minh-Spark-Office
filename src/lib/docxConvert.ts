import {
  AlignmentType,
  BorderStyle,
  DeletedTextRun,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  InsertedTextRun,
  LevelFormat,
  Math as DocxMath,
  NumberFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  TextWrappingSide,
  TextWrappingType,
  UnderlineType,
  VerticalAlignTable,
  VerticalPositionRelativeFrom,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import type { JSONContent } from '@tiptap/react';
import { PAGE_SIZES, type DocStyleDef, type PageSettings } from './storage';
import { resolveStyles } from '../editors/doc/docStyles';
import { latexToMath } from './docxMath';

const TWIP = 15;
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

type Mark = { type: string; attrs?: Record<string, unknown> };
type Context = { listDepth: number; ordered: boolean; listInstance: number; listReference?: string; inTable: boolean; quote: boolean; contentWidth: number };

let footnoteStore: Record<string, { children: Paragraph[] }> = {};

let orderedInstanceCounter = 0;
let endnoteCounter = 0;
let revisionCounter = 0;
let listFormats = new Map<string, string>();

const LOWER_ROMAN: [number, string][] = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
const toLowerRoman = (value: number) => {
  let rest = value;
  let out = '';
  for (const [n, s] of LOWER_ROMAN) while (rest >= n) { out += s; rest -= n; }
  return out;
};

const UNDERLINES: Record<string, (typeof UnderlineType)[keyof typeof UnderlineType]> = { solid: UnderlineType.SINGLE, double: UnderlineType.DOUBLE, dotted: UnderlineType.DOTTED, dashed: UnderlineType.DASH, wavy: UnderlineType.WAVE };
const BORDER_STYLES: Record<string, (typeof BorderStyle)[keyof typeof BorderStyle]> = { solid: BorderStyle.SINGLE, double: BorderStyle.DOUBLE, dashed: BorderStyle.DASHED, dotted: BorderStyle.DOTTED };
const STYLE_IDS: Record<string, string> = { normal: 'Normal', title: 'Title', subtitle: 'Subtitle', h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading4', h5: 'Heading5', h6: 'Heading6', quote: 'Quote' };
const NUMBER_FORMATS: Record<string, { format: (typeof LevelFormat)[keyof typeof LevelFormat]; text: (n: number) => string }> = {
  decimal: { format: LevelFormat.DECIMAL, text: (n) => `%${n}.` },
  'decimal-leading-zero': { format: LevelFormat.DECIMAL_ZERO, text: (n) => `%${n}.` },
  'lower-alpha': { format: LevelFormat.LOWER_LETTER, text: (n) => `%${n}.` },
  'upper-alpha': { format: LevelFormat.UPPER_LETTER, text: (n) => `%${n}.` },
  'lower-roman': { format: LevelFormat.LOWER_ROMAN, text: (n) => `%${n}.` },
  'upper-roman': { format: LevelFormat.UPPER_ROMAN, text: (n) => `%${n}.` },
};
const BULLET_TEXT: Record<string, string> = { disc: '●', circle: '○', square: '■' };

const hex = (color?: unknown) => {
  if (typeof color !== 'string' || !color) return undefined;
  const value = color.trim();
  if (value.startsWith('#')) {
    const raw = value.slice(1);
    return raw.length === 3 ? raw.split('').map((char) => char + char).join('').toUpperCase() : raw.slice(0, 6).toUpperCase();
  }
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (match) return match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
};

const halfPoints = (size?: unknown) => {
  if (typeof size !== 'string') return undefined;
  const number = parseFloat(size);
  if (!Number.isFinite(number)) return undefined;
  return Math.round((size.endsWith('px') ? number * 0.75 : number) * 2);
};

const firstFont = (family?: unknown) => (typeof family === 'string' ? family.split(',')[0].replaceAll(/["']/g, '').trim() : undefined);

function runOptions(marks: Mark[] = [], base: Record<string, unknown> = {}) {
  const options: Record<string, unknown> = { ...base };
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': options.bold = true; break;
      case 'italic': options.italics = true; break;
      case 'underline': options.underline = options.underline ?? {}; break;
      case 'strike': options.strike = true; break;
      case 'subscript': options.subScript = true; break;
      case 'superscript': options.superScript = true; break;
      case 'code': options.font = 'Consolas'; options.shading = { type: ShadingType.CLEAR, fill: 'F1F3F5', color: 'auto' }; break;
      case 'highlight': options.shading = { type: ShadingType.CLEAR, fill: hex(mark.attrs?.color) ?? 'FFF59D', color: 'auto' }; break;
      case 'textStyle': {
        const color = hex(mark.attrs?.color);
        if (color) options.color = color;
        const size = halfPoints(mark.attrs?.fontSize);
        if (size) options.size = size;
        const font = firstFont(mark.attrs?.fontFamily);
        if (font) options.font = font;
        const background = hex(mark.attrs?.backgroundColor);
        if (background) options.shading = { type: ShadingType.CLEAR, fill: background, color: 'auto' };
        const spacing = parseFloat(String(mark.attrs?.letterSpacing ?? ''));
        if (spacing) options.characterSpacing = Math.round(spacing * TWIP);
        if (mark.attrs?.textTransform === 'uppercase') options.allCaps = true;
        if (mark.attrs?.fontVariant === 'small-caps') options.smallCaps = true;
        const underline = UNDERLINES[String(mark.attrs?.underlineStyle ?? '')];
        if (underline) options.underline = { type: underline, color: hex(mark.attrs?.underlineColor) };
        break;
      }
      default: break;
    }
  }
  return options;
}

async function imageRun(node: JSONContent, maxWidth: number): Promise<ImageRun | null> {
  const src = String(node.attrs?.src ?? '');
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mime = blob.type || (src.match(/^data:([^;]+)/)?.[1] ?? 'image/png');
    let type: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) type = 'jpg';
    else if (mime.includes('gif')) type = 'gif';
    else if (mime.includes('bmp')) type = 'bmp';
    else if (!mime.includes('png')) {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) return null;
      return imageRun({ ...node, attrs: { ...node.attrs, src: URL.createObjectURL(png) } }, maxWidth);
    }
    const percent = typeof node.attrs?.width === 'string' && node.attrs.width.endsWith('%') ? parseFloat(node.attrs.width) / 100 : 0;
    let width = percent ? 0 : parseFloat(String(node.attrs?.width ?? '')) || 0;
    let height = Number(node.attrs?.height) || 0;
    if (!width || !height) {
      const bitmap = await createImageBitmap(blob);
      const ratio = bitmap.height / bitmap.width;
      width = width || bitmap.width;
      height = height || Math.round(width * ratio);
    }
    if (percent) {
      height = Math.round(height * ((maxWidth * percent) / width));
      width = Math.round(maxWidth * percent);
    }
    if (width > maxWidth) {
      height = Math.round(height * (maxWidth / width));
      width = maxWidth;
    }
    const align = String(node.attrs?.align ?? '');
    const floating = align === 'left' || align === 'right' ? {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: align === 'left' ? HorizontalPositionAlign.LEFT : HorizontalPositionAlign.RIGHT },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
      wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.BOTH_SIDES },
      margins: { top: 0, bottom: 91440, left: 91440, right: 91440 },
    } : undefined;
    const alt = String(node.attrs?.alt ?? '');
    return new ImageRun({ type, data: bytes, transformation: { width, height, ...(node.attrs?.rotate ? { rotation: Number(node.attrs.rotate) } : {}), ...(node.attrs?.flipH || node.attrs?.flipV ? { flip: { horizontal: Boolean(node.attrs.flipH), vertical: Boolean(node.attrs.flipV) } } : {}) }, ...(floating ? { floating } : {}), ...(alt ? { altText: { title: alt, description: alt, name: alt } } : {}) });
  } catch {
    return null;
  }
}

async function inlineChildren(nodes: JSONContent[] = [], context: Context, base: Record<string, unknown> = {}): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      const marks = (node.marks ?? []) as Mark[];
      const link = marks.find((mark) => mark.type === 'link');
      const options = runOptions(marks, base);
      const revision = marks.find((mark) => mark.type === 'insertion' || mark.type === 'deletion');
      if (revision) {
        const stamp = Number(revision.attrs?.date);
        const change = { id: ++revisionCounter, author: String(revision.attrs?.author || 'Minh Office'), date: new Date(Number.isFinite(stamp) && stamp > 0 ? stamp : Date.now()).toISOString() };
        const text = node.text ?? '';
        children.push(revision.type === 'insertion' ? new InsertedTextRun({ ...options, text, ...change }) : new DeletedTextRun({ ...options, text, ...change }));
      } else if (link) {
        children.push(new ExternalHyperlink({ link: String(link.attrs?.href ?? ''), children: [new TextRun({ ...options, text: node.text ?? '', style: 'Hyperlink' })] }));
      } else {
        children.push(new TextRun({ ...options, text: node.text ?? '' }));
      }
    } else if (node.type === 'footnote' && node.attrs?.kind === 'end') {
      children.push(new TextRun({ ...base, text: toLowerRoman(++endnoteCounter), superScript: true }));
    } else if (node.type === 'equation') {
      children.push(new DocxMath({ children: latexToMath(String(node.attrs?.latex ?? '')) }));
    } else if (node.type === 'footnote') {
      const id = String(Object.keys(footnoteStore).length + 1);
      footnoteStore[id] = { children: [new Paragraph({ children: [new TextRun({ text: String(node.attrs?.text ?? '') })] })] };
      children.push(new FootnoteReferenceRun(Number(id)));
    } else if (node.type === 'mergeField') {
      children.push(new TextRun({ ...runOptions(node.marks as Mark[], base), text: `«${String(node.attrs?.name ?? '')}»` }));
    } else if (node.type === 'hardBreak') {
      children.push(new TextRun({ text: '', break: 1 }));
    } else if (node.type === 'image') {
      const run = await imageRun(node, context.contentWidth);
      if (run) children.push(run);
    }
  }
  return children;
}

function paragraphBase(node: JSONContent, context: Context): IParagraphOptions {
  const attrs = node.attrs ?? {};
  const options: Record<string, unknown> = {};
  const alignment = ALIGN[String(attrs.textAlign ?? '')];
  if (alignment) options.alignment = alignment;
  const lineHeight = Number(attrs.lineHeight);
  const spacing: Record<string, number> = {};
  if (lineHeight) spacing.line = Math.round(lineHeight * 240);
  if (attrs.spaceBefore !== undefined && attrs.spaceBefore !== null) spacing.before = Number(attrs.spaceBefore) * 20;
  if (attrs.spaceAfter !== undefined && attrs.spaceAfter !== null) spacing.after = Number(attrs.spaceAfter) * 20;
  if (Object.keys(spacing).length) options.spacing = spacing;
  const indent = Number(attrs.indent) || 0;
  const right = Number(attrs.indentRight) || 0;
  const firstLine = Number(attrs.firstLine) || 0;
  if (indent || right || firstLine || context.quote) {
    options.indent = {
      left: Math.round(indent * 720) + (context.quote ? 567 : 0),
      ...(right ? { right: Math.round(right * TWIP) } : {}),
      ...(firstLine > 0 ? { firstLine: Math.round(firstLine * TWIP) } : {}),
      ...(firstLine < 0 ? { hanging: Math.round(-firstLine * TWIP) } : {}),
    };
  }
  if (context.quote) options.border = { left: { style: BorderStyle.SINGLE, size: 18, color: 'BCC6DC', space: 12 } };
  const shading = hex(attrs.shading);
  if (shading) options.shading = { type: ShadingType.CLEAR, fill: shading, color: 'auto' };
  if (attrs.borderSides) {
    const sides = String(attrs.borderSides) === 'box' ? ['top', 'bottom', 'left', 'right'] : String(attrs.borderSides).split(',');
    const edge = { style: BORDER_STYLES[String(attrs.borderStyle ?? 'solid')] ?? BorderStyle.SINGLE, size: Math.max(2, Math.round((Number(attrs.borderWidth) || 1) * 6)), color: hex(attrs.borderColor) ?? '334155', space: 4 };
    options.border = Object.fromEntries(sides.map((side) => [side, edge]));
  }
  if (attrs.keepNext) options.keepNext = true;
  if (attrs.pageBreakBefore) options.pageBreakBefore = true;
  if (attrs.styleId) options.style = STYLE_IDS[String(attrs.styleId)] ?? String(attrs.styleId);
  return options as IParagraphOptions;
}

async function blockNodes(nodes: JSONContent[] = [], context: Context): Promise<(Paragraph | Table)[]> {
  const output: (Paragraph | Table)[] = [];
  for (const node of nodes) output.push(...(await blockNode(node, context)));
  return output;
}

async function blockNode(node: JSONContent, context: Context): Promise<(Paragraph | Table)[]> {
  switch (node.type) {
    case 'paragraph': {
      const only = node.content?.length === 1 && node.content[0].type === 'image' ? node.content[0] : null;
      const centered = only?.attrs?.align === 'center' ? { alignment: AlignmentType.CENTER } : {};
      return [new Paragraph({ ...paragraphBase(node, context), ...centered, children: await inlineChildren(node.content, context) })];
    }
    case 'equation':
      return [new Paragraph({ alignment: node.attrs?.display === false ? undefined : AlignmentType.CENTER, children: await inlineChildren([node], context) })];
    case 'textBox':
      return [await textBoxNode(node, context)];
    case 'columnSection':
      return blockNodes(node.content, context);
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return [new Paragraph({ ...paragraphBase(node, context), heading: HEADINGS[level - 1], children: await inlineChildren(node.content, context) })];
    }
    case 'blockquote':
      return blockNodes(node.content, { ...context, quote: true });
    case 'codeBlock': {
      const lines = (node.content ?? []).map((child) => child.text ?? '').join('').split('\n');
      return lines.map((line) => new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F4F5F7', color: 'auto' },
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
      }));
    }
    case 'horizontalRule':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8CED8', space: 1 } }, children: [] })];
    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })];
    case 'image': {
      const run = await imageRun(node, context.contentWidth);
      return run ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run] })] : [];
    }
    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      const instance = ordered ? ++orderedInstanceCounter : context.listInstance;
      const style = node.attrs?.listStyle ? String(node.attrs.listStyle) : '';
      const reference = style ? `minh-${ordered ? 'ol' : 'ul'}-${listFormats.size}` : '';
      const known = style ? [...listFormats.entries()].find(([, value]) => value === `${ordered ? 'ol' : 'ul'}:${style}`)?.[0] : '';
      if (style && !known) listFormats.set(reference, `${ordered ? 'ol' : 'ul'}:${style}`);
      const out: (Paragraph | Table)[] = [];
      for (const item of node.content ?? []) {
        out.push(...(await listItem(item, { ...context, listDepth: context.listDepth + 1, ordered, listInstance: instance, listReference: known || reference })));
      }
      return out;
    }
    case 'taskList': {
      const out: (Paragraph | Table)[] = [];
      for (const item of node.content ?? []) {
        const checked = Boolean(item.attrs?.checked);
        const [first, ...rest] = item.content ?? [];
        const children = await inlineChildren(first?.content, context);
        out.push(new Paragraph({ ...paragraphBase(first ?? {}, context), indent: { left: 360 * (context.listDepth + 1) }, children: [new TextRun({ text: checked ? '☑ ' : '☐ ' }), ...children] }));
        out.push(...(await blockNodes(rest, { ...context, listDepth: context.listDepth + 1 })));
      }
      return out;
    }
    case 'table':
      return [await tableNode(node, context)];
    default:
      if (node.content) return blockNodes(node.content, context);
      return [];
  }
}

async function listItem(item: JSONContent, context: Context): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = [];
  let first = true;
  for (const child of item.content ?? []) {
    if (first && (child.type === 'paragraph' || child.type === 'heading')) {
      const level = Math.min(8, context.listDepth - 1);
      const numbering = context.listReference
        ? { numbering: { reference: context.listReference, level, instance: context.ordered ? context.listInstance : 0 } }
        : context.ordered
          ? { numbering: { reference: 'minh-ordered', level, instance: context.listInstance } }
          : { bullet: { level } };
      out.push(new Paragraph({ ...paragraphBase(child, { ...context, quote: false }), ...numbering, children: await inlineChildren(child.content, context) }));
      first = false;
    } else {
      out.push(...(await blockNode(child, context)));
    }
  }
  return out;
}

async function textBoxNode(node: JSONContent, context: Context): Promise<Table> {
  const attrs = node.attrs ?? {};
  const percent = attrs.align === 'full' ? 100 : Number(attrs.boxWidth) || 50;
  const stroke = { style: BorderStyle.SINGLE, size: 8, color: hex(attrs.stroke) ?? '94A3B8' };
  const children = await blockNodes(node.content, { ...context, inTable: true });
  const fill = hex(attrs.fill);
  return new Table({
    width: { size: percent, type: WidthType.PERCENTAGE },
    alignment: attrs.align === 'right' ? AlignmentType.RIGHT : attrs.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    rows: [new TableRow({ children: [new TableCell({ children: children.length ? children : [new Paragraph({ children: [] })], shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined, margins: { top: 120, bottom: 120, left: 160, right: 160 }, borders: { top: stroke, bottom: stroke, left: stroke, right: stroke } })] })],
  });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN = (color = 'C8CED8') => ({ style: BorderStyle.SINGLE, size: 4, color });
const TABLE_BORDERS: Record<string, Record<string, unknown>> = {
  plain: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
  lines: { top: THIN(), bottom: THIN(), left: NO_BORDER, right: NO_BORDER, insideHorizontal: THIN(), insideVertical: NO_BORDER },
  report: { top: { style: BorderStyle.SINGLE, size: 12, color: '1F3864' }, bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F3864' }, left: NO_BORDER, right: NO_BORDER, insideHorizontal: THIN('E2E8F0'), insideVertical: NO_BORDER },
};
const HEADER_FILLS: Record<string, { fill: string; text?: string }> = { blue: { fill: '2B579A', text: 'FFFFFF' }, dark: { fill: '1F2430', text: 'FFFFFF' }, green: { fill: '107C41', text: 'FFFFFF' }, striped: { fill: 'E8EDF5' }, grid: { fill: 'F1F4F8' }, lines: { fill: 'F8FAFC' } };
const CELL_EDGES: Record<string, string[]> = { all: ['top', 'bottom', 'left', 'right'], bottom: ['bottom'], top: ['top'], sides: ['left', 'right'], none: [] };

const cellBorders = (value: unknown) => {
  if (!value) return undefined;
  const on = CELL_EDGES[String(value)] ?? [];
  return Object.fromEntries(['top', 'bottom', 'left', 'right'].map((edge) => [edge, on.includes(edge) ? THIN('334155') : NO_BORDER]));
};

const V_ALIGN: Record<string, (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable]> = { top: VerticalAlignTable.TOP, middle: VerticalAlignTable.CENTER, bottom: VerticalAlignTable.BOTTOM };

async function tableNode(node: JSONContent, context: Context): Promise<Table> {
  const preset = String(node.attrs?.tableStyle ?? 'grid');
  const headFill = HEADER_FILLS[preset];
  const rows: TableRow[] = [];
  let rowIndex = 0;
  const firstRow = node.content?.[0]?.content ?? [];
  const columnWidths = firstRow.flatMap((cell) => {
    const widths = cell.attrs?.colwidth as number[] | null | undefined;
    return widths?.length ? widths.map((value) => Math.round(value * TWIP)) : Array.from({ length: Number(cell.attrs?.colspan) || 1 }, () => 0);
  });
  const hasWidths = columnWidths.some(Boolean);
  const fallback = columnWidths.length ? Math.round((context.contentWidth * TWIP) / columnWidths.length) : 0;
  for (const row of node.content ?? []) {
    const cells: TableCell[] = [];
    let header = false;
    for (const cell of row.content ?? []) {
      header = header || cell.type === 'tableHeader';
      const headerText = cell.type === 'tableHeader' && headFill?.text ? { color: headFill.text } : {};
      const children = await blockNodes(cell.content, { ...context, inTable: true, listDepth: 0 });
      const stripe = preset === 'striped' && rowIndex % 2 === 0 && cell.type !== 'tableHeader' ? 'F5F7FB' : undefined;
      const background = hex(cell.attrs?.backgroundColor) ?? (cell.type === 'tableHeader' ? headFill?.fill : stripe);
      const content = children.length ? children : [new Paragraph({ children: [] })];
      const boldContent = cell.type === 'tableHeader'
        ? await blockNodes((cell.content ?? []).map((paragraph) => ({ ...paragraph, content: (paragraph.content ?? []).map((text) => ({ ...text, marks: [...(text.marks ?? []), { type: 'bold' }, ...(headerText.color ? [{ type: 'textStyle', attrs: { color: `#${headerText.color}` } }] : [])] })) })), { ...context, inTable: true })
        : content;
      cells.push(new TableCell({
        children: boldContent.length ? boldContent : content,
        columnSpan: Number(cell.attrs?.colspan) > 1 ? Number(cell.attrs?.colspan) : undefined,
        rowSpan: Number(cell.attrs?.rowspan) > 1 ? Number(cell.attrs?.rowspan) : undefined,
        shading: background ? { type: ShadingType.CLEAR, fill: background, color: 'auto' } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: V_ALIGN[String(cell.attrs?.vAlign ?? '')],
        borders: cellBorders(cell.attrs?.cellBorders),
      }));
    }
    rows.push(new TableRow({ children: cells, tableHeader: header && rowIndex === 0 }));
    rowIndex++;
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS[preset] as never,
    ...(hasWidths ? { columnWidths: columnWidths.map((value) => value || fallback), layout: TableLayoutType.FIXED } : {}),
  });
}

const REGION_RUN = { color: '6B7280', size: 18 };

const tokenRuns = (text: string, title: string): TextRun[] => {
  const parts = text.split(/(\{page\}|\{pages\}|\{title\}|\{date\})/);
  return parts.filter(Boolean).map((part) => {
    if (part === '{page}') return new TextRun({ ...REGION_RUN, children: [PageNumber.CURRENT] });
    if (part === '{pages}') return new TextRun({ ...REGION_RUN, children: [PageNumber.TOTAL_PAGES] });
    if (part === '{title}') return new TextRun({ ...REGION_RUN, text: title });
    if (part === '{date}') return new TextRun({ ...REGION_RUN, text: new Date().toLocaleDateString('vi-VN') });
    return new TextRun({ ...REGION_RUN, text: part });
  });
};

const pageNumberRuns = (format: PageSettings['pageNumberFormat']): TextRun[] => {
  const field = new TextRun({ ...REGION_RUN, children: [PageNumber.CURRENT] });
  if (format === 'plain' || format === 'roman') return [field];
  if (format === 'page') return [new TextRun({ ...REGION_RUN, text: 'Trang ' }), field];
  if (format === 'dash') return [new TextRun({ ...REGION_RUN, text: '– ' }), field, new TextRun({ ...REGION_RUN, text: ' –' })];
  return [new TextRun({ ...REGION_RUN, text: 'Trang ' }), field, new TextRun({ ...REGION_RUN, text: ' / ' }), new TextRun({ ...REGION_RUN, children: [PageNumber.TOTAL_PAGES] })];
};

function regionParagraph(page: PageSettings, text: string, zone: 'header' | 'footer', contentWidth: number, title: string, withNumber: boolean) {
  const parts = text.split('\t');
  const zones = parts.length === 1 ? [parts[0], '', ''] : [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  const slots: TextRun[][] = zones.map((value) => tokenRuns(value, title));
  const position = page.pageNumberPosition ?? 'bottom-right';
  if (withNumber && page.pageNumbers && position.startsWith(zone === 'header' ? 'top' : 'bottom')) {
    const slot = position.endsWith('left') ? 0 : position.endsWith('center') ? 1 : 2;
    slots[slot] = [...slots[slot], ...(slots[slot].length ? [new TextRun({ ...REGION_RUN, text: '  ' })] : []), ...pageNumberRuns(page.pageNumberFormat)];
  }
  const twips = Math.round(contentWidth * TWIP);
  return new Paragraph({
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(twips / 2) }, { type: TabStopType.RIGHT, position: twips }],
    children: [...slots[0], new TextRun({ text: '\t' }), ...slots[1], new TextRun({ text: '\t' }), ...slots[2]],
  });
}

const paragraphStyle = (def: DocStyleDef) => ({
  run: {
    ...(def.font ? { font: def.font } : {}),
    ...(def.size ? { size: Math.round(def.size * 2) } : {}),
    ...(def.color ? { color: hex(def.color) } : {}),
    ...(def.bold !== undefined ? { bold: def.bold } : {}),
    ...(def.italic !== undefined ? { italics: def.italic } : {}),
    ...(def.underline ? { underline: {} } : {}),
    ...(def.caps ? { allCaps: true } : {}),
  },
  paragraph: {
    ...(def.align && ALIGN[def.align] ? { alignment: ALIGN[def.align] } : {}),
    spacing: {
      ...(def.before !== undefined ? { before: Math.round(def.before * 20) } : {}),
      ...(def.after !== undefined ? { after: Math.round(def.after * 20) } : {}),
      ...(def.line ? { line: Math.round(def.line * 240) } : {}),
    },
  },
});

const docStyles = (page: PageSettings) => {
  const styles = resolveStyles(page);
  const builtIn = { h1: 'heading1', h2: 'heading2', h3: 'heading3', h4: 'heading4', h5: 'heading5', h6: 'heading6', title: 'title' } as const;
  const defaults: Record<string, unknown> = { document: { run: { font: page.fontFamily ?? 'Arial', size: Math.round((page.fontSize ?? 12) * 2) }, paragraph: paragraphStyle(styles.normal).paragraph } };
  for (const [id, key] of Object.entries(builtIn)) defaults[key] = paragraphStyle(styles[id]);
  const paragraphStyles = Object.entries(styles).filter(([id]) => !(id in builtIn) && id !== 'normal').map(([id, def]) => ({
    id: STYLE_IDS[id] ?? id,
    name: def.name,
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    ...paragraphStyle(def),
  }));
  return { default: defaults, paragraphStyles };
};

const listLevels = () => {
  const config: { reference: string; levels: unknown[] }[] = [];
  for (const [reference, value] of listFormats) {
    const [kind, style] = value.split(':');
    const levels = Array.from({ length: 9 }, (_, level) => {
      const number = NUMBER_FORMATS[style];
      return {
        level,
        format: kind === 'ol' ? (number?.format ?? LevelFormat.DECIMAL) : LevelFormat.BULLET,
        text: kind === 'ol' ? (number?.text(level + 1) ?? `%${level + 1}.`) : (BULLET_TEXT[style] ?? style),
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
      };
    });
    config.push({ reference, levels });
  }
  return config;
};

export async function exportDocx(json: JSONContent, page: PageSettings, title: string): Promise<Blob> {
  orderedInstanceCounter = 0;
  endnoteCounter = 0;
  revisionCounter = 0;
  listFormats = new Map();
  footnoteStore = {};
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const width = landscape ? size.height : size.width;
  const contentWidth = Math.max(200, width - page.margins.left - page.margins.right);
  const context: Context = { listDepth: 0, ordered: false, listInstance: 0, inTable: false, quote: false, contentWidth };
  const groups: { columns: number; nodes: JSONContent[] }[] = [];
  const baseColumns = page.columns ?? 1;
  for (const node of json.content ?? []) {
    const columns = node.type === 'columnSection' ? Number(node.attrs?.count) || 2 : baseColumns;
    const last = groups[groups.length - 1];
    if (last && last.columns === columns && node.type !== 'columnSection') last.nodes.push(node);
    else groups.push({ columns, nodes: [node] });
  }
  if (!groups.length) groups.push({ columns: baseColumns, nodes: [] });
  const sectionBodies: { columns: number; children: (Paragraph | Table)[] }[] = [];
  for (const group of groups) sectionBodies.push({ columns: group.columns, children: await blockNodes(group.nodes, context) });
  const levels = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  const region = (text: string | undefined, zone: 'header' | 'footer', withNumber = true) => regionParagraph(page, text ?? '', zone, contentWidth, title, withNumber);
  const headers = {
    default: new Header({ children: [region(page.header, 'header')] }),
    ...(page.differentFirstPage ? { first: new Header({ children: [region(page.headerFirst, 'header', false)] }) } : {}),
    ...(page.differentOddEven ? { even: new Header({ children: [region(page.headerEven, 'header')] }) } : {}),
  };
  const footers = {
    default: new Footer({ children: [region(page.footer, 'footer')] }),
    ...(page.differentFirstPage ? { first: new Footer({ children: [region(page.footerFirst, 'footer', false)] }) } : {}),
    ...(page.differentOddEven ? { even: new Footer({ children: [region(page.footerEven, 'footer')] }) } : {}),
  };
  const roman = page.pageNumberFormat === 'roman';
  const document = new Document({
    creator: page.properties?.author || 'Minh Office',
    title,
    subject: page.properties?.subject,
    keywords: page.properties?.keywords,
    styles: docStyles(page) as never,
    footnotes: footnoteStore,
    evenAndOddHeaderAndFooters: Boolean(page.differentOddEven),
    numbering: { config: [{ reference: 'minh-ordered', levels }, ...listLevels()] as never },
    sections: sectionBodies.map((body, index) => ({
      properties: {
        ...(index ? { type: SectionType.CONTINUOUS } : {}),
        ...(index === 0 && page.differentFirstPage ? { titlePage: true } : {}),
        column: { count: body.columns, space: page.columnGap ? Math.round(page.columnGap * 15) : 480, equalWidth: true, ...(page.columnLine ? { separate: true } : {}) },
        page: {
          size: { width: size.width * TWIP, height: size.height * TWIP, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: page.margins.top * TWIP, right: page.margins.right * TWIP, bottom: page.margins.bottom * TWIP, left: page.margins.left * TWIP, header: 480, footer: 480 },
          ...(index === 0 ? { pageNumbers: { start: page.pageNumberStart ?? 1, formatType: roman ? NumberFormat.UPPER_ROMAN : NumberFormat.DECIMAL } } : {}),
        },
      },
      ...(index === 0 ? { headers, footers } : {}),
      children: body.children.length ? body.children : [new Paragraph({ children: [] })],
    })),
  });
  return Packer.toBlob(document);
}

export async function importDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Quote'] => blockquote > p:fresh",
      "p[style-name='Intense Quote'] => blockquote > p:fresh",
      'u => u',
      'strike => s',
    ],
  });
  return result.value;
}

export function jsonToMarkdown(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') {
    let text = node.text || '';
    if (node.marks) {
      for (const m of node.marks) {
        if (m.type === 'bold') text = `**${text}**`;
        if (m.type === 'italic') text = `*${text}*`;
        if (m.type === 'strike') text = `~~${text}~~`;
        if (m.type === 'code') text = `\`${text}\``;
        if (m.type === 'link' && m.attrs?.href) text = `[${text}](${m.attrs.href})`;
        if (m.type === 'underline') text = `<u>${text}</u>`;
      }
    }
    return text;
  }

  const inner = (node.content || []).map(jsonToMarkdown).join('');

  switch (node.type) {
    case 'doc':
      return (node.content || []).map(jsonToMarkdown).join('\n\n');
    case 'heading': {
      const hashes = '#'.repeat(Number(node.attrs?.level) || 1);
      return `${hashes} ${inner}`;
    }
    case 'paragraph':
      return inner;
    case 'blockquote':
      return inner.split('\n').map((line) => `> ${line}`).join('\n');
    case 'codeBlock':
      return `\`\`\`${node.attrs?.language || ''}\n${inner}\n\`\`\``;
    case 'bulletList':
      return (node.content || []).map((item) => `- ${jsonToMarkdown(item)}`).join('\n');
    case 'orderedList':
      return (node.content || []).map((item, idx) => `${idx + 1}. ${jsonToMarkdown(item)}`).join('\n');
    case 'listItem':
      return inner;
    case 'taskList':
      return (node.content || []).map(jsonToMarkdown).join('\n');
    case 'taskItem':
      return `- [${node.attrs?.checked ? 'x' : ' '}] ${inner}`;
    case 'horizontalRule':
    case 'pageBreak':
      return '\n---\n';
    case 'image':
      return `![${node.attrs?.alt || 'image'}](${node.attrs?.src || ''})`;
    case 'table': {
      const rows = (node.content || []).map((row) =>
        '| ' + (row.content || []).map((cell) => jsonToMarkdown(cell).replace(/\n/g, ' ')).join(' | ') + ' |'
      );
      if (rows.length > 0 && node.content?.[0]?.content?.length) {
        const colCount = node.content[0].content.length;
        const divider = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
        rows.splice(1, 0, divider);
      }
      return rows.join('\n');
    }
    case 'tableRow':
      return inner;
    case 'tableCell':
    case 'tableHeader':
      return inner;
    default:
      return inner;
  }
}
