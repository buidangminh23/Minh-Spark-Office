import JSZip from 'jszip';
import type { JSONContent } from '@tiptap/react';
import { PAGE_SIZES, type PageSettings } from './storage';
import { currentAuthorName } from './currentAuthor';

type Mark = { type: string; attrs?: Record<string, unknown> };

const nodeText = (node?: JSONContent): string => (node?.text ?? '') + (node?.content ?? []).map(nodeText).join('');
const CANVAS_SCALE = 2;
const DEFAULT_SHAPE_SIZE = 300;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh.'));
  reader.readAsDataURL(blob);
});

const svgToPng = (src: string, width: number, height: number) => new Promise<string>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const w = width || image.naturalWidth || DEFAULT_SHAPE_SIZE;
    const h = height || image.naturalHeight || Math.round((w * (image.naturalHeight || 1)) / (image.naturalWidth || 1));
    const canvas = document.createElement('canvas');
    canvas.width = w * CANVAS_SCALE;
    canvas.height = h * CANVAS_SCALE;
    const context = canvas.getContext('2d');
    if (!context) return reject(new Error('Không tạo được vùng vẽ.'));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/png'));
  };
  image.onerror = () => reject(new Error('Không đọc được hình vector.'));
  image.src = src;
});

export async function resolveImages(json: JSONContent): Promise<JSONContent> {
  if (json.type === 'image') {
    const src = String(json.attrs?.src ?? '');
    const width = typeof json.attrs?.width === 'number' ? json.attrs.width : 0;
    const height = typeof json.attrs?.height === 'number' ? json.attrs.height : 0;
    try {
      if (src.startsWith('data:image/svg')) return { ...json, attrs: { ...json.attrs, src: await svgToPng(src, width, height) } };
      if (/^https?:/i.test(src)) {
        const response = await fetch(src);
        if (response.ok) return { ...json, attrs: { ...json.attrs, src: await blobToDataUrl(await response.blob()) } };
      }
    } catch {
      return json;
    }
    return json;
  }
  if (!json.content) return json;
  return { ...json, content: await Promise.all(json.content.map(resolveImages)) };
}

const collect = (node: JSONContent | undefined, type: string, into: JSONContent[] = []) => {
  if (!node) return into;
  if (node.type === type) into.push(node);
  (node.content ?? []).forEach((child) => collect(child, type, into));
  return into;
};

export function jsonToText(json: JSONContent): string {
  const notes: string[] = [];
  const inline = (nodes: JSONContent[] = []): string => nodes.map((node) => {
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') return node.attrs?.alt ? `[Ảnh: ${node.attrs.alt}]` : '[Ảnh]';
    if (node.type === 'footnote') {
      notes.push(String(node.attrs?.text ?? ''));
      return `[${notes.length}]`;
    }
    return node.text ?? inline(node.content);
  }).join('');
  const block = (node: JSONContent, indent = ''): string[] => {
    switch (node.type) {
      case 'bulletList': return (node.content ?? []).flatMap((item) => listItem(item, `${indent}• `, `${indent}  `));
      case 'orderedList': return (node.content ?? []).flatMap((item, i) => listItem(item, `${indent}${i + 1}. `, `${indent}   `));
      case 'taskList': return (node.content ?? []).flatMap((item) => listItem(item, `${indent}${item.attrs?.checked ? '[x]' : '[ ]'} `, `${indent}    `));
      case 'table': return (node.content ?? []).map((row) => (row.content ?? []).map((cell) => nodeText(cell).trim()).join('\t'));
      case 'codeBlock': return [nodeText(node)];
      case 'horizontalRule': return ['----------'];
      case 'pageBreak': return ['\f'];
      case 'paragraph':
      case 'heading': return [`${indent}${inline(node.content)}`];
      default: return (node.content ?? []).flatMap((child) => block(child, indent));
    }
  };
  const listItem = (item: JSONContent, first: string, rest: string) => (item.content ?? []).flatMap((child, i) => {
    const lines = block(child, rest);
    return i === 0 && lines.length ? [`${first}${lines[0].slice(rest.length)}`, ...lines.slice(1)] : lines;
  });
  const body = (json.content ?? []).flatMap((node) => block(node)).join('\n');
  return notes.length ? `${body}\n\n----------\n${notes.map((text, i) => `[${i + 1}] ${text}`).join('\n')}\n` : `${body}\n`;
}

const tableRows = (table: JSONContent) => (table.content ?? []).map((row) => (row.content ?? []).flatMap((cell) => [nodeText(cell).trim(), ...Array.from({ length: Math.max(0, Number(cell.attrs?.colspan ?? 1) - 1) }, () => '')]));

export const tablesOf = (json: JSONContent) => collect(json, 'table').map(tableRows);

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
export const tableToCsv = (rows: string[][]) => new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });

const numericCell = (value: string): string | number => {
  const normalized = value.replace(/\s/g, '');
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : value;
};

export async function tablesToXlsx(tables: string[][][]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  tables.forEach((rows, i) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(numericCell)));
    const count = Math.max(1, ...rows.map((row) => row.length));
    sheet['!cols'] = Array.from({ length: count }, (_, c) => ({ wch: Math.min(48, Math.max(8, ...rows.map((row) => String(row[c] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(book, sheet, `Bảng ${i + 1}`);
  });
  const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const TEX_SPECIAL: Record<string, string> = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', _: '\\_', '%': '\\%', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };
const texEscape = (text: string) => text.replace(/[\\{}$&#_%~^]/g, (c) => TEX_SPECIAL[c] ?? c);
const SECTIONS = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'];
const PX_PER_CM = 96 / 2.54;

export async function exportLatex(json: JSONContent, page: PageSettings, title: string): Promise<{ blob: Blob; extension: 'tex' | 'zip' }> {
  const images: { path: string; base64: string }[] = [];
  const wrap = (mark: Mark, text: string) => {
    switch (mark.type) {
      case 'bold': return `\\textbf{${text}}`;
      case 'italic': return `\\textit{${text}}`;
      case 'underline': return `\\uline{${text}}`;
      case 'strike': return `\\sout{${text}}`;
      case 'superscript': return `\\textsuperscript{${text}}`;
      case 'subscript': return `\\textsubscript{${text}}`;
      case 'code': return `\\texttt{${text}}`;
      case 'link': return `\\href{${texEscape(String(mark.attrs?.href ?? ''))}}{${text}}`;
      default: return text;
    }
  };
  const inline = (nodes: JSONContent[] = []): string => nodes.map((node) => {
    if (node.type === 'hardBreak') return '\\\\\n';
    if (node.type === 'footnote') return `\\footnote{${texEscape(String(node.attrs?.text ?? ''))}}`;
    if (node.type === 'equation') return node.attrs?.display ? `\\[${node.attrs?.latex ?? ''}\\]` : `$${node.attrs?.latex ?? ''}$`;
    if (node.type === 'image') {
      const match = /^data:image\/(png|jpe?g);base64,(.*)$/s.exec(String(node.attrs?.src ?? ''));
      if (!match) return `% ${texEscape(String(node.attrs?.alt ?? 'Ảnh'))}\n`;
      const path = `images/anh-${images.length + 1}.${match[1].replace('jpeg', 'jpg')}`;
      images.push({ path, base64: match[2] });
      const width = typeof node.attrs?.width === 'number' ? `width=${(node.attrs.width / PX_PER_CM).toFixed(2)}cm` : 'width=\\linewidth';
      return `\\includegraphics[${width}]{${path}}`;
    }
    if (node.type !== 'text') return inline(node.content);
    return ((node.marks ?? []) as Mark[]).reduce((text, mark) => wrap(mark, text), texEscape(node.text ?? ''));
  }).join('');
  const environment = (name: string, items: string) => `\\begin{${name}}\n${items}\\end{${name}}\n\n`;
  const block = (node: JSONContent): string => {
    switch (node.type) {
      case 'heading': return `\\${SECTIONS[Math.min(5, (Number(node.attrs?.level) || 1) - 1)]}{${inline(node.content)}}\n\n`;
      case 'paragraph': {
        const text = inline(node.content);
        const align = String(node.attrs?.textAlign ?? '');
        if (!text) return '\n';
        if (align === 'center') return environment('center', `${text}\n`);
        if (align === 'right') return environment('flushright', `${text}\n`);
        return `${text}\n\n`;
      }
      case 'bulletList': return environment('itemize', (node.content ?? []).map((item) => `\\item ${(item.content ?? []).map(block).join('').trim()}\n`).join(''));
      case 'orderedList': return environment('enumerate', (node.content ?? []).map((item) => `\\item ${(item.content ?? []).map(block).join('').trim()}\n`).join(''));
      case 'taskList': return environment('itemize', (node.content ?? []).map((item) => `\\item[${item.attrs?.checked ? '$\\boxtimes$' : '$\\square$'}] ${(item.content ?? []).map(block).join('').trim()}\n`).join(''));
      case 'blockquote': return environment('quote', (node.content ?? []).map(block).join(''));
      case 'codeBlock': return environment('verbatim', `${nodeText(node)}\n`);
      case 'horizontalRule': return '\\noindent\\rule{\\linewidth}{0.4pt}\n\n';
      case 'pageBreak': return '\\newpage\n\n';
      case 'table': {
        const rows = node.content ?? [];
        const count = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
        const body = rows.map((row) => `${(row.content ?? []).map((cell) => (cell.content ?? []).map(block).join('').trim()).join(' & ')} \\\\ \\hline\n`).join('');
        return `\\begin{center}\n\\begin{tabularx}{\\linewidth}{|${'X|'.repeat(count)}}\n\\hline\n${body}\\end{tabularx}\n\\end{center}\n\n`;
      }
      default: return (node.content ?? []).map(block).join('');
    }
  };
  const body = (json.content ?? []).map(block).join('');
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const cm = (px: number) => `${(px / PX_PER_CM).toFixed(2)}cm`;
  const tex = `\\documentclass[${Math.min(12, Math.max(10, Math.round(page.fontSize ?? 12)))}pt]{article}
\\usepackage[T5]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[vietnamese]{babel}
\\usepackage{amsmath,amssymb,graphicx,tabularx,hyperref}
\\usepackage[normalem]{ulem}
\\usepackage[paperwidth=${cm(landscape ? size.height : size.width)},paperheight=${cm(landscape ? size.width : size.height)},top=${cm(page.margins.top)},bottom=${cm(page.margins.bottom)},left=${cm(page.margins.left)},right=${cm(page.margins.right)}]{geometry}
\\title{${texEscape(title)}}
\\author{${texEscape(page.properties?.author ?? '')}}
\\date{}
\\begin{document}

${body}\\end{document}
`;
  if (!images.length) return { blob: new Blob([tex], { type: 'application/x-tex;charset=utf-8' }), extension: 'tex' };
  const zip = new JSZip();
  zip.file('tai-lieu.tex', tex);
  images.forEach((image) => zip.file(image.path, image.base64, { base64: true }));
  return { blob: await zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' }), extension: 'zip' };
}

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
const SLIDE_MARGIN = 0.6;
const TITLE_HEIGHT = 1;
const BODY_TOP = 1.5;
const LINES_PER_SLIDE = 8;
const CHARS_PER_SLIDE = 620;
const BRAND = '2B579A';
const INK = '1E2430';
const PX_PER_INCH = 96;

type SlideLine = { text: string; level: number; bullet: boolean; bold: boolean };
type SlideBlock = { kind: 'text'; lines: SlideLine[] } | { kind: 'table'; rows: string[][] } | { kind: 'image'; src: string; width: number; height: number };
type SlideSection = { title: string; blocks: SlideBlock[] };

const addLines = (section: SlideSection, lines: SlideLine[]) => {
  const last = section.blocks.at(-1);
  if (last?.kind === 'text') last.lines.push(...lines);
  else section.blocks.push({ kind: 'text', lines });
};

const imageBlocks = (node: JSONContent): SlideBlock[] => collect(node, 'image').flatMap((img) => {
  const src = String(img.attrs?.src ?? '');
  if (!src.startsWith('data:image/')) return [];
  return [{ kind: 'image' as const, src, width: Number(img.attrs?.width) || 0, height: Number(img.attrs?.height) || 0 }];
});

const listLines = (node: JSONContent, level: number): SlideLine[] => (node.content ?? []).flatMap((item) => (item.content ?? []).flatMap((child) => {
  if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') return listLines(child, level + 1);
  const text = nodeText(child).trim();
  return text ? [{ text, level, bullet: true, bold: false }] : [];
}));

const toSections = (json: JSONContent, title: string): SlideSection[] => {
  const sections: SlideSection[] = [];
  const current = () => {
    if (!sections.length) sections.push({ title, blocks: [] });
    return sections[sections.length - 1];
  };
  for (const node of json.content ?? []) {
    const text = nodeText(node).trim();
    const level = Number(node.attrs?.level) || 0;
    if (node.type === 'heading' && level <= 2) {
      if (text) sections.push({ title: text, blocks: [] });
    } else if (node.type === 'heading') {
      if (text) addLines(current(), [{ text, level: 0, bullet: false, bold: true }]);
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      addLines(current(), listLines(node, 0));
    } else if (node.type === 'table') {
      current().blocks.push({ kind: 'table', rows: tableRows(node) });
    } else {
      if (text) addLines(current(), [{ text, level: 0, bullet: true, bold: false }]);
      current().blocks.push(...imageBlocks(node));
    }
  }
  return sections;
};

const chunkLines = (lines: SlideLine[]) => {
  const chunks: SlideLine[][] = [[]];
  let chars = 0;
  for (const line of lines) {
    const full = chunks[chunks.length - 1].length >= LINES_PER_SLIDE || chars + line.text.length > CHARS_PER_SLIDE;
    if (full && chunks[chunks.length - 1].length) {
      chunks.push([]);
      chars = 0;
    }
    chunks[chunks.length - 1].push(line);
    chars += line.text.length;
  }
  return chunks;
};

const fitImage = (width: number, height: number) => {
  const maxWidth = SLIDE_WIDTH - SLIDE_MARGIN * 2;
  const maxHeight = SLIDE_HEIGHT - BODY_TOP - SLIDE_MARGIN;
  const w = (width || 640) / PX_PER_INCH;
  const h = (height || 400) / PX_PER_INCH;
  const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
  return { w: w * ratio, h: h * ratio, x: (SLIDE_WIDTH - w * ratio) / 2, y: BODY_TOP };
};

export async function exportPptx(json: JSONContent, page: PageSettings, title: string): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const deck = new PptxGenJS();
  const font = page.fontFamily ?? 'Arial';
  deck.layout = 'LAYOUT_WIDE';
  deck.title = title;
  deck.author = page.properties?.author || currentAuthorName();
  deck.company = page.properties?.company || '';
  deck.subject = page.properties?.subject || '';
  deck.defineSlideMaster({ title: 'MINH', background: { color: 'FFFFFF' }, slideNumber: { x: SLIDE_WIDTH - 1.2, y: SLIDE_HEIGHT - 0.5, w: 0.8, h: 0.3, fontFace: font, fontSize: 11, color: '798394', align: 'right' } });
  const cover = deck.addSlide({ masterName: 'MINH' });
  cover.addText(title, { x: SLIDE_MARGIN, y: 2.6, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: 1.4, fontFace: font, fontSize: 40, bold: true, color: BRAND, align: 'center' });
  if (page.properties?.author) cover.addText(page.properties.author, { x: SLIDE_MARGIN, y: 4.1, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: 0.6, fontFace: font, fontSize: 18, color: '586071', align: 'center' });
  const newSlide = (heading: string) => {
    const slide = deck.addSlide({ masterName: 'MINH' });
    slide.addText(heading, { x: SLIDE_MARGIN, y: 0.4, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: TITLE_HEIGHT, fontFace: font, fontSize: 30, bold: true, color: BRAND, fit: 'shrink' });
    return slide;
  };
  for (const section of toSections(json, title)) {
    if (!section.blocks.length) newSlide(section.title);
    let continued = false;
    for (const block of section.blocks) {
      if (block.kind === 'text') {
        for (const lines of chunkLines(block.lines)) {
          const slide = newSlide(continued ? `${section.title} (tiếp)` : section.title);
          continued = true;
          slide.addText(lines.map((line) => ({ text: line.text, options: { bullet: line.bullet ? { indent: 18 } : false, indentLevel: line.level, bold: line.bold, breakLine: true } })), { x: SLIDE_MARGIN, y: BODY_TOP, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: SLIDE_HEIGHT - BODY_TOP - SLIDE_MARGIN, fontFace: font, fontSize: 20, color: INK, valign: 'top', paraSpaceAfter: 8 });
        }
      } else if (block.kind === 'table') {
        const slide = newSlide(continued ? `${section.title} (tiếp)` : section.title);
        continued = true;
        slide.addTable(block.rows.map((row, r) => row.map((cell) => ({ text: cell, options: { bold: r === 0, fill: { color: r === 0 ? 'E8EEF9' : 'FFFFFF' } } }))), { x: SLIDE_MARGIN, y: BODY_TOP, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, fontFace: font, fontSize: 14, color: INK, border: { type: 'solid', pt: 1, color: 'C8CED8' }, autoPage: true, autoPageRepeatHeader: true });
      } else {
        const slide = newSlide(continued ? `${section.title} (tiếp)` : section.title);
        continued = true;
        slide.addImage({ data: block.src, ...fitImage(block.width, block.height) });
      }
    }
  }
  return (await deck.write({ outputType: 'blob' })) as Blob;
}
