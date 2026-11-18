import type JSZip from 'jszip';
import type { JSONContent } from '@tiptap/react';
import { checkConversionAbort, type ConversionOptions } from './conversionTypes';
import { parseXml, localName, type XmlNode } from './miniXml';

const children = (node: XmlNode | undefined, tag: string) => node?.children.filter(child => localName(child.name) === tag) ?? [];
const first = (node: XmlNode | undefined, tag: string) => children(node, tag)[0];
const enabled = (value?: string) => value === '1' || value === 'true';

function resolvePart(path: string, target: string) {
  if (!target || target.includes('\\') || /^([a-z][\w+.-]*:|\/\/)/i.test(target)) return;
  const parts = target.startsWith('/') ? [] : path.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') { if (!parts.length) return; parts.pop(); }
    else if (segment && segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

async function readPart(zip: JSZip, path: string) {
  const source = await zip.file(path)?.async('string');
  if (!source || source.length > 8_000_000) throw new Error('Thành phần PowerPoint bị thiếu hoặc quá lớn.');
  return parseXml(source).children[0];
}

async function relationships(zip: JSZip, path: string) {
  const resolved = new Map<string, string>();
  const relsPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
  if (!zip.file(relsPath)) return resolved;
  for (const { attrs } of children(await readPart(zip, relsPath), 'Relationship')) {
    if (attrs.TargetMode?.toLowerCase() === 'external') continue;
    const part = resolvePart(path, attrs.Target);
    if (part) resolved.set(attrs.Id, part);
  }
  return resolved;
}

function paragraph(node: XmlNode): JSONContent {
  const content: JSONContent[] = [];
  for (const item of node.children) {
    const tag = localName(item.name);
    if (tag === 'br') { content.push({ type: 'hardBreak' }); continue; }
    if (tag !== 'r' && tag !== 'fld') continue;
    const props = first(item, 'rPr')?.attrs ?? {};
    const marks: NonNullable<JSONContent['marks']> = [];
    if (enabled(props.b)) marks.push({ type: 'bold' });
    if (enabled(props.i)) marks.push({ type: 'italic' });
    if (props.u && props.u !== 'none') marks.push({ type: 'underline' });
    if (props.strike && props.strike !== 'noStrike') marks.push({ type: 'strike' });
    for (const { text } of children(item, 't')) if (text) content.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
  }
  return { type: 'paragraph', content };
}

function table(node: XmlNode): JSONContent {
  const widths = children(first(node, 'tblGrid'), 'gridCol').map(col => Math.round(Number(col.attrs.w) / 9525));
  const rows = children(node, 'tr').map(row => {
    const content: JSONContent[] = [];
    for (const [index, cell] of children(row, 'tc').entries()) {
      if (enabled(cell.attrs.hMerge) || enabled(cell.attrs.vMerge)) continue;
      const colspan = Number(cell.attrs.gridSpan ?? 1);
      const rowspan = Number(cell.attrs.rowSpan ?? 1);
      if (!Number.isInteger(colspan) || colspan < 1 || colspan > 100 || !Number.isInteger(rowspan) || rowspan < 1 || rowspan > 1000) throw new Error('Vùng ô gộp PowerPoint quá lớn hoặc không hợp lệ.');
      const colwidth = widths.slice(index, index + colspan);
      const paragraphs = children(first(cell, 'txBody'), 'p').map(paragraph);
      content.push({ type: 'tableCell', attrs: { colspan, rowspan, ...(colwidth.length && colwidth.every(width => width > 0) ? { colwidth } : {}) }, content: paragraphs });
    }
    return { type: 'tableRow', content };
  });
  return { type: 'table', content: rows };
}

function indexedValues(cache: XmlNode | undefined): string[] {
  const values: string[] = [];
  for (const point of children(cache, 'pt')) {
    const index = Number(point.attrs.idx);
    if (!Number.isInteger(index) || index < 0 || index >= 50_000) throw new Error('Dữ liệu biểu đồ PowerPoint vượt giới hạn hàng.');
    values[index] = first(point, 'v')?.text ?? '';
  }
  return values;
}

function cachedValues(source: XmlNode | undefined): string[] {
  const hierarchy = first(first(source, 'multiLvlStrRef'), 'multiLvlStrCache');
  if (hierarchy) {
    const levels = children(hierarchy, 'lvl').map(indexedValues);
    const declared = Number(first(hierarchy, 'ptCount')?.attrs.val ?? 0);
    const length = levels.reduce((max, level) => Math.max(max, level.length), declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > 50_000 || length * levels.length > 250_000) {
      throw new Error('Dữ liệu biểu đồ PowerPoint vượt giới hạn ô.');
    }
    const labels = levels.map(() => '');
    return Array.from({ length }, (_, index) => {
      for (let depth = 0; depth < levels.length; depth++) {
        labels[depth] = levels[depth][index] ?? (depth === 0 ? '' : labels[depth]);
      }
      return labels.filter(Boolean).reverse().join(' / ');
    });
  }
  const ref = first(source, 'strRef') ?? first(source, 'numRef');
  return indexedValues(first(ref, 'strCache') ?? first(ref, 'numCache') ?? first(source, 'strLit') ?? first(source, 'numLit'));
}

function chartOutline(root: XmlNode): JSONContent[] {
  const chart = first(root, 'chart');
  const plot = first(chart, 'plotArea');
  const content: JSONContent[] = [];
  let cells = 0;
  for (const group of plot?.children ?? []) {
    for (const series of children(group, 'ser')) {
      const tx = first(series, 'tx');
      const label = first(tx, 'v')?.text || cachedValues(tx)[0] || '';
      const scatter = first(series, 'xVal');
      const keys = cachedValues(scatter ?? first(series, 'cat'));
      const values = cachedValues(first(series, 'yVal') ?? first(series, 'val'));
      const sizes = cachedValues(first(series, 'bubbleSize'));
      const length = Math.max(keys.length, values.length, sizes.length);
      if (!length) continue;
      const header = [scatter ? 'X' : 'Danh mục', label || (scatter ? 'Y' : 'Giá trị')];
      if (sizes.length) header.push('Kích thước');
      cells += (length + 1) * header.length;
      if (cells > 250_000) throw new Error('Dữ liệu biểu đồ PowerPoint vượt giới hạn ô.');
      const row = (values: string[], type = 'tableCell'): JSONContent => ({ type: 'tableRow', content: values.map(text => ({ type, content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] })) });
      const rows = [row(header, 'tableHeader')];
      for (let i = 0; i < length; i++) {
        const points = [keys[i] ?? '', values[i] ?? ''];
        if (sizes.length) points.push(sizes[i] ?? '');
        rows.push(row(points));
      }
      content.push({ type: 'table', content: rows });
    }
  }
  return content;
}

export async function readSlideOutline(zip: JSZip, options: ConversionOptions): Promise<JSONContent> {
  const presentation = 'ppt/presentation.xml';
  const ids = children(first(await readPart(zip, presentation), 'sldIdLst'), 'sldId');
  const parts = await relationships(zip, presentation);
  if (!ids.length || ids.length > 500) throw new Error('Bài trình chiếu phải có từ 1 đến 500 trang chiếu hợp lệ.');
  const content: JSONContent[] = [];
  const imageCache = new Map<string, string>();
  let imageBytes = 0;
  for (const [index, slide] of ids.entries()) {
    checkConversionAbort(options);
    options.onProgress?.(`Đang đọc trang chiếu ${index + 1}/${ids.length}…`);
    const path = parts.get(slide.attrs['r:id']);
    if (!path) throw new Error(`Thiếu dữ liệu trang chiếu ${index + 1}.`);
    if (index) content.push({ type: 'pageBreak' });
    content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: `Trang chiếu ${index + 1}` }] });
    const rels = await relationships(zip, path);
    const pending = [await readPart(zip, path)];
    while (pending.length) {
      const node = pending.pop()!;
      const tag = localName(node.name);
      if (tag === 'p') {
        const block = paragraph(node);
        if (block.content?.length) content.push(block);
      } else if (tag === 'tbl') {
        content.push(table(node));
      } else if (tag === 'chart' && node.attrs['r:id']) {
        const part = rels.get(node.attrs['r:id']);
        if (part && zip.file(part)) for (const block of chartOutline(await readPart(zip, part))) content.push(block);
      } else if (tag === 'blip') {
        const part = rels.get(node.attrs['r:embed']);
        const extension = part?.split('.').pop()?.toLowerCase();
        if (!part || !extension || !['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(extension) || !zip.file(part)) continue;
        let src = imageCache.get(part);
        if (!src) { src = `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${await zip.file(part)!.async('base64')}`; imageCache.set(part, src); }
        imageBytes += src.length;
        if (imageBytes > 80_000_000) throw new Error('Ảnh trong bài trình chiếu quá lớn để chuyển đổi trên thiết bị.');
        content.push({ type: 'image', attrs: { src, alt: `Ảnh trang chiếu ${index + 1}` } });
      } else if (tag === 'AlternateContent') {
        const selected = first(node, 'Fallback') ?? first(node, 'Choice');
        if (selected) pending.push(selected);
      } else {
        for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]);
      }
    }
  }
  return { type: 'doc', content };
}
