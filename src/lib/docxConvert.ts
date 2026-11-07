import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import type { JSONContent } from '@tiptap/react';
import { PAGE_SIZES, type PageSettings } from './storage';

const TWIP = 15;
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

type Mark = { type: string; attrs?: Record<string, unknown> };
type Context = { listDepth: number; ordered: boolean; listInstance: number; inTable: boolean; quote: boolean; contentWidth: number; headings: string[] };

let footnoteStore: Record<string, { children: Paragraph[] }> = {};

let orderedInstanceCounter = 0;

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
      case 'underline': options.underline = {}; break;
      case 'strike': options.strike = true; break;
      case 'insertion': options.underline = {}; options.color = '1E7B34'; break;
      case 'deletion': options.strike = true; options.color = 'B3261E'; break;
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
    let width = percent ? 0 : Number(node.attrs?.width) || 0;
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
    return new ImageRun({ type, data: bytes, transformation: { width, height } });
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
      if (link) {
        children.push(new ExternalHyperlink({ link: String(link.attrs?.href ?? ''), children: [new TextRun({ ...options, text: node.text ?? '', style: 'Hyperlink' })] }));
      } else {
        children.push(new TextRun({ ...options, text: node.text ?? '' }));
      }
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
  if (indent || context.quote) options.indent = { left: indent * 720 + (context.quote ? 567 : 0) };
  if (context.quote) options.border = { left: { style: BorderStyle.SINGLE, size: 18, color: 'BCC6DC', space: 12 } };
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
      return [new Paragraph({ ...paragraphBase(node, context), children: await inlineChildren(node.content, context) })];
    }
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
    case 'tableOfContents':
      return [
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'MỤC LỤC' })] }),
        ...context.headings.map((line) => {
          const [level, text] = [Number(line[0]), line.slice(1)];
          return new Paragraph({ indent: { left: (level - 1) * 360 }, children: [new TextRun({ text, bold: level === 1 })] });
        }),
      ];
    case 'image': {
      const run = await imageRun(node, context.contentWidth);
      return run ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run] })] : [];
    }
    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      const instance = ordered ? ++orderedInstanceCounter : context.listInstance;
      const out: (Paragraph | Table)[] = [];
      for (const item of node.content ?? []) {
        out.push(...(await listItem(item, { ...context, listDepth: context.listDepth + 1, ordered, listInstance: instance })));
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
      const numbering = context.ordered
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

async function tableNode(node: JSONContent, context: Context): Promise<Table> {
  const rows: TableRow[] = [];
  let rowIndex = 0;
  for (const row of node.content ?? []) {
    const cells: TableCell[] = [];
    let header = false;
    for (const cell of row.content ?? []) {
      header = header || cell.type === 'tableHeader';
      const children = await blockNodes(cell.content, { ...context, inTable: true, listDepth: 0 });
      const background = hex(cell.attrs?.backgroundColor) ?? (cell.type === 'tableHeader' ? 'F1F4F8' : undefined);
      const content = children.length ? children : [new Paragraph({ children: [] })];
      const boldContent = cell.type === 'tableHeader'
        ? await blockNodes((cell.content ?? []).map((paragraph) => ({ ...paragraph, content: (paragraph.content ?? []).map((text) => ({ ...text, marks: [...(text.marks ?? []), { type: 'bold' }] })) })), { ...context, inTable: true })
        : content;
      cells.push(new TableCell({
        children: boldContent.length ? boldContent : content,
        columnSpan: Number(cell.attrs?.colspan) > 1 ? Number(cell.attrs?.colspan) : undefined,
        rowSpan: Number(cell.attrs?.rowspan) > 1 ? Number(cell.attrs?.rowspan) : undefined,
        shading: background ? { type: ShadingType.CLEAR, fill: background, color: 'auto' } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }));
    }
    rows.push(new TableRow({ children: cells, tableHeader: header && rowIndex === 0 }));
    rowIndex++;
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const textParagraphs = (text: string, pageNumbers: boolean, align: 'left' | 'center' | 'right' = 'center') => {
  const lines = text ? text.split('\n') : [];
  const paragraphs = lines.map((line) => new Paragraph({ alignment: ALIGN[align], children: [new TextRun({ text: line, color: '6B7280', size: 18 })] }));
  if (pageNumbers) {
    paragraphs.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Trang ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], color: '6B7280', size: 18 })] }));
  }
  return paragraphs;
};

export async function exportDocx(json: JSONContent, page: PageSettings, title: string): Promise<Blob> {
  orderedInstanceCounter = 0;
  footnoteStore = {};
  const headings: string[] = [];
  const collect = (node: JSONContent) => {
    if (node.type === 'heading' && Number(node.attrs?.level) <= 3) {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('').trim();
      if (text) headings.push(`${Number(node.attrs?.level)}${text}`);
    }
    (node.content ?? []).forEach(collect);
  };
  collect(json);
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const width = landscape ? size.height : size.width;
  const contentWidth = Math.max(200, width - page.margins.left - page.margins.right);
  const children = await blockNodes(json.content, { listDepth: 0, ordered: false, listInstance: 0, inTable: false, quote: false, contentWidth, headings });
  const levels = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  const document = new Document({
    creator: 'Minh Office',
    title,
    styles: { default: { document: { run: { font: page.fontFamily ?? 'Arial', size: Math.round((page.fontSize ?? 12) * 2) } } } },
    footnotes: footnoteStore,
    numbering: { config: [{ reference: 'minh-ordered', levels }] },
    sections: [{
      properties: {
        page: {
          size: { width: size.width * TWIP, height: size.height * TWIP, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: page.margins.top * TWIP, right: page.margins.right * TWIP, bottom: page.margins.bottom * TWIP, left: page.margins.left * TWIP },
        },
      },
      headers: page.header ? { default: new Header({ children: textParagraphs(page.header, false) }) } : undefined,
      footers: page.footer || page.pageNumbers ? { default: new Footer({ children: textParagraphs(page.footer, page.pageNumbers) }) } : undefined,
      children: children.length ? children : [new Paragraph({ children: [] })],
    }],
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
