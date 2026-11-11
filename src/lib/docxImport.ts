import JSZip from 'jszip';
import { ommlToLatex } from './ommlLatex';
import { basePage, PAGE_SIZES, type PageSettings } from './storage';

const TWIP_PER_PX = 15;
const EMU_PER_PX = 9525;
const FOOTNOTE_SKIP = new Set(['-1', '0']);

type StyleInfo = { name: string; basedOn: string | null; pPr: Element | null; rPr: Element | null };
type Numbering = Map<string, Map<number, { format: string; text: string; start: number }>>;
type Context = { styles: Map<string, StyleInfo>; numbering: Numbering; rels: Map<string, string>; media: Map<string, string>; footnotes: Map<string, string> };

const NS_LOCAL = (el: Element | Document, name: string) => Array.from(el.getElementsByTagNameNS('*', name));
const childrenOf = (el: Element) => Array.from(el.children);
const child = (el: Element | null | undefined, name: string) => (el ? childrenOf(el).find((c) => c.localName === name) ?? null : null);
const attr = (el: Element | null | undefined, name: string) => (el ? el.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', name) ?? el.getAttribute(`w:${name}`) : null);
const on = (el: Element | null) => {
  if (!el) return null;
  const value = attr(el, 'val');
  return value !== '0' && value !== 'false' && value !== 'off' && value !== 'none';
};
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const HIGHLIGHT: Record<string, string> = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#00008b', darkCyan: '#008b8b', darkGreen: '#006400', darkMagenta: '#8b008b', darkRed: '#8b0000', darkYellow: '#808000', darkGray: '#a9a9a9', lightGray: '#d3d3d3', black: '#000000' };

const parseXml = (text: string) => new DOMParser().parseFromString(text, 'application/xml');

function styleChain(ctx: Context, id: string | null) {
  const chain: StyleInfo[] = [];
  let current = id;
  let guard = 0;
  while (current && guard++ < 12) {
    const style = ctx.styles.get(current);
    if (!style) break;
    chain.unshift(style);
    current = style.basedOn;
  }
  return chain;
}

function runStyles(rPrList: (Element | null)[]) {
  const css: string[] = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let strike = false;
  let vert = '';
  const props: Record<string, string> = {};
  for (const rPr of rPrList) {
    if (!rPr) continue;
    const b = on(child(rPr, 'b'));
    if (b !== null) bold = b;
    const i = on(child(rPr, 'i'));
    if (i !== null) italic = i;
    const s = on(child(rPr, 'strike'));
    if (s !== null) strike = s;
    const u = child(rPr, 'u');
    if (u) {
      const value = attr(u, 'val');
      underline = value !== 'none';
      if (value && value !== 'single' && value !== 'none') {
        const map: Record<string, string> = { double: 'double', dotted: 'dotted', dash: 'dashed', dashed: 'dashed', wave: 'wavy', wavy: 'wavy' };
        if (map[value]) { props.underlineStyle = map[value]; underline = false; }
      }
    }
    const color = attr(child(rPr, 'color'), 'val');
    if (color && color !== 'auto') props.color = `#${color.toLowerCase()}`;
    const size = attr(child(rPr, 'sz'), 'val');
    if (size) props.size = `${Number(size) / 2}pt`;
    const fonts = child(rPr, 'rFonts');
    const font = attr(fonts, 'ascii') ?? attr(fonts, 'hAnsi') ?? attr(fonts, 'cs');
    if (font) props.font = font;
    const highlight = attr(child(rPr, 'highlight'), 'val');
    if (highlight && HIGHLIGHT[highlight]) props.highlight = HIGHLIGHT[highlight];
    const shd = attr(child(rPr, 'shd'), 'fill');
    if (shd && shd !== 'auto') props.background = `#${shd.toLowerCase()}`;
    const vertAlign = attr(child(rPr, 'vertAlign'), 'val');
    if (vertAlign) vert = vertAlign;
    const spacing = attr(child(rPr, 'spacing'), 'val');
    if (spacing) props.spacing = `${Number(spacing) / TWIP_PER_PX}px`;
    if (on(child(rPr, 'caps'))) props.caps = 'uppercase';
    if (on(child(rPr, 'smallCaps'))) props.smallCaps = 'small-caps';
  }
  if (props.color) css.push(`color: ${props.color}`);
  if (props.size) css.push(`font-size: ${props.size}`);
  if (props.font) css.push(`font-family: "${props.font}"`);
  if (props.background) css.push(`background-color: ${props.background}`);
  if (props.spacing) css.push(`letter-spacing: ${props.spacing}`);
  if (props.caps) css.push(`text-transform: ${props.caps}`);
  if (props.smallCaps) css.push(`font-variant: ${props.smallCaps}`);
  return { css: css.join('; '), bold, italic, underline, strike, vert, highlight: props.highlight, underlineStyle: props.underlineStyle };
}

function wrapRun(html: string, style: ReturnType<typeof runStyles>) {
  let out = html;
  if (style.css || style.underlineStyle) out = `<span${style.underlineStyle ? ` data-underline="${style.underlineStyle}"` : ''}${style.css ? ` style="${escapeHtml(style.css)}"` : ''}>${out}</span>`;
  if (style.highlight) out = `<mark data-color="${style.highlight}" style="background-color: ${style.highlight}">${out}</mark>`;
  if (style.bold) out = `<strong>${out}</strong>`;
  if (style.italic) out = `<em>${out}</em>`;
  if (style.underline) out = `<u>${out}</u>`;
  if (style.strike) out = `<s>${out}</s>`;
  if (style.vert === 'superscript') out = `<sup>${out}</sup>`;
  if (style.vert === 'subscript') out = `<sub>${out}</sub>`;
  return out;
}

function imageHtml(drawing: Element, ctx: Context) {
  const blip = NS_LOCAL(drawing, 'blip')[0];
  const embed = blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ?? blip?.getAttribute('r:embed');
  const target = embed ? ctx.rels.get(embed) : null;
  const src = target ? ctx.media.get(target) : null;
  if (!src) return '';
  const extent = NS_LOCAL(drawing, 'extent')[0];
  const width = extent ? Math.round(Number(extent.getAttribute('cx')) / EMU_PER_PX) : 0;
  const doc = NS_LOCAL(drawing, 'docPr')[0];
  const alt = doc?.getAttribute('descr') ?? doc?.getAttribute('title') ?? '';
  return `<img src="${src}" alt="${escapeHtml(alt)}"${width ? ` style="width: ${width}px"` : ''}>`;
}

function runHtml(run: Element, paragraphRuns: (Element | null)[], ctx: Context): { html: string; pageBreak: boolean } {
  const rPr = child(run, 'rPr');
  const charStyle = attr(child(rPr, 'rStyle'), 'val');
  const charChain = styleChain(ctx, charStyle).map((s) => s.rPr);
  const style = runStyles([...paragraphRuns, ...charChain, rPr]);
  let html = '';
  let pageBreak = false;
  for (const node of childrenOf(run)) {
    switch (node.localName) {
      case 't': html += escapeHtml(node.textContent ?? ''); break;
      case 'tab': html += '    '; break;
      case 'noBreakHyphen': html += '-'; break;
      case 'br':
        if (attr(node, 'type') === 'page') pageBreak = true;
        else html += '<br>';
        break;
      case 'drawing':
      case 'pict': html += imageHtml(node, ctx); break;
      case 'footnoteReference': {
        const text = ctx.footnotes.get(attr(node, 'id') ?? '') ?? '';
        html += `<sup data-footnote="${escapeHtml(text)}" data-kind="foot"></sup>`;
        break;
      }
      default: break;
    }
  }
  return { html: html ? wrapRun(html, style) : '', pageBreak };
}

const equationHtml = (math: Element, display: boolean) => `<span data-latex="${escapeHtml(ommlToLatex(math))}" data-display="${display}"></span>`;

function inlineContent(paragraph: Element, baseRuns: (Element | null)[], ctx: Context) {
  let html = '';
  const breaks: number[] = [];
  const visit = (nodes: Element[]) => {
    for (const node of nodes) {
      if (node.localName === 'r') {
        const out = runHtml(node, baseRuns, ctx);
        html += out.html;
        if (out.pageBreak) breaks.push(html.length);
      } else if (node.localName === 'hyperlink') {
        const id = node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? node.getAttribute('r:id');
        const href = id ? ctx.rels.get(id) : null;
        const anchor = attr(node, 'anchor');
        const inner: string[] = [];
        for (const run of childrenOf(node)) if (run.localName === 'r') inner.push(runHtml(run, baseRuns, ctx).html);
        html += href || anchor ? `<a href="${escapeHtml(href ?? `#${anchor}`)}">${inner.join('')}</a>` : inner.join('');
      } else if (node.localName === 'oMath') {
        html += equationHtml(node, false);
      } else if (node.localName === 'oMathPara') {
        childrenOf(node).filter((math) => math.localName === 'oMath').forEach((math) => { html += equationHtml(math, true); });
      } else if (['ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple'].includes(node.localName)) {
        visit(childrenOf(node));
      }
    }
  };
  visit(childrenOf(paragraph));
  return { html, breaks };
}

function paragraphAttrs(pPrList: (Element | null)[]) {
  const css: string[] = [];
  const data: string[] = [];
  let align = '';
  let before: number | null = null;
  let after: number | null = null;
  let line: number | null = null;
  let left: number | null = null;
  let right: number | null = null;
  let first: number | null = null;
  let keepNext = false;
  let breakBefore = false;
  let shading = '';
  let border: { sides: string[]; style: string; color: string; width: number } | null = null;
  for (const pPr of pPrList) {
    if (!pPr) continue;
    const jc = attr(child(pPr, 'jc'), 'val');
    if (jc) align = ({ both: 'justify', distribute: 'justify', start: 'left', end: 'right' } as Record<string, string>)[jc] ?? jc;
    const spacing = child(pPr, 'spacing');
    if (spacing) {
      const b = attr(spacing, 'before');
      const a = attr(spacing, 'after');
      const l = attr(spacing, 'line');
      if (b !== null) before = Number(b) / 20;
      if (a !== null) after = Number(a) / 20;
      if (l !== null && (attr(spacing, 'lineRule') ?? 'auto') === 'auto') line = Number(l) / 240;
    }
    const ind = child(pPr, 'ind');
    if (ind) {
      const l = attr(ind, 'left') ?? attr(ind, 'start');
      const r = attr(ind, 'right') ?? attr(ind, 'end');
      const f = attr(ind, 'firstLine');
      const h = attr(ind, 'hanging');
      if (l !== null) left = Number(l) / TWIP_PER_PX;
      if (r !== null) right = Number(r) / TWIP_PER_PX;
      if (f !== null) first = Number(f) / TWIP_PER_PX;
      if (h !== null) first = -Number(h) / TWIP_PER_PX;
    }
    if (on(child(pPr, 'keepNext'))) keepNext = true;
    if (on(child(pPr, 'pageBreakBefore'))) breakBefore = true;
    const fill = attr(child(pPr, 'shd'), 'fill');
    if (fill && fill !== 'auto') shading = `#${fill.toLowerCase()}`;
    const pBdr = child(pPr, 'pBdr');
    if (pBdr) {
      const sides = childrenOf(pBdr).filter((c) => attr(c, 'val') !== 'none' && attr(c, 'val') !== 'nil');
      if (sides.length) {
        const sample = sides[0];
        const color = attr(sample, 'color');
        border = {
          sides: sides.map((s) => s.localName),
          style: attr(sample, 'val') === 'double' ? 'double' : attr(sample, 'val') === 'dashed' ? 'dashed' : attr(sample, 'val') === 'dotted' ? 'dotted' : 'solid',
          color: color && color !== 'auto' ? `#${color.toLowerCase()}` : '#334155',
          width: Math.max(1, Math.round(Number(attr(sample, 'sz') ?? 8) / 6)),
        };
      }
    }
  }
  if (align) css.push(`text-align: ${align}`);
  if (before !== null) css.push(`margin-top: ${before / 0.75}px`);
  if (after !== null) css.push(`margin-bottom: ${after / 0.75}px`);
  if (line !== null) css.push(`line-height: ${line}`);
  if (left) { data.push(`data-indent="${left / 48}"`); css.push(`margin-left: ${left}px`); }
  if (right) css.push(`margin-right: ${right}px`);
  if (first) css.push(`text-indent: ${first}px`);
  if (keepNext) data.push('data-keep-next="true"');
  if (breakBefore) data.push('data-break-before="true"');
  if (shading) data.push(`data-shading="${shading}"`);
  if (border) {
    const b = border as { sides: string[]; style: string; color: string; width: number };
    const sides = b.sides.length === 4 ? 'box' : b.sides.join(',');
    data.push(`data-border-sides="${sides}" data-border-style="${b.style}" data-border-color="${b.color}" data-border-width="${b.width}"`);
  }
  return { attrs: `${data.length ? ` ${data.join(' ')}` : ''}${css.length ? ` style="${css.join('; ')}"` : ''}` };
}

type Block = { kind: 'html'; html: string } | { kind: 'item'; numId: string; level: number; html: string };

function paragraphBlock(paragraph: Element, ctx: Context): Block[] {
  const pPr = child(paragraph, 'pPr');
  const styleId = attr(child(pPr, 'pStyle'), 'val');
  const chain = styleChain(ctx, styleId);
  const name = chain[chain.length - 1]?.name.toLowerCase() ?? '';
  const { html, breaks } = inlineContent(paragraph, chain.map((s) => s.rPr), ctx);
  const { attrs } = paragraphAttrs([...chain.map((s) => s.pPr), pPr]);
  const headingMatch = /^heading (\d)/.exec(name);
  const outline = attr(child(pPr, 'outlineLvl'), 'val');
  const heading = headingMatch ? Number(headingMatch[1]) : outline !== null && Number(outline) < 6 ? Number(outline) + 1 : 0;
  const numPr = child(pPr, 'numPr') ?? chain.map((s) => child(s.pPr, 'numPr')).reverse().find(Boolean) ?? null;
  const numId = attr(child(numPr, 'numId'), 'val');
  const blocks: Block[] = [];
  const pageBreakHtml = '<div data-page-break="true"></div>';
  if (breaks.length && !html.replace(/<[^>]+>/g, '').trim()) return [{ kind: 'html', html: pageBreakHtml }];
  if (numId && numId !== '0' && !heading) {
    blocks.push({ kind: 'item', numId, level: Number(attr(child(numPr, 'ilvl'), 'val') ?? 0), html: `<p${attrs}>${html}</p>` });
  } else if (heading) {
    blocks.push({ kind: 'html', html: `<h${Math.min(heading, 6)}${attrs}>${html}</h${Math.min(heading, 6)}>` });
  } else if (name === 'title') {
    blocks.push({ kind: 'html', html: `<p data-style="title"${attrs}>${html}</p>` });
  } else if (name === 'subtitle') {
    blocks.push({ kind: 'html', html: `<p data-style="subtitle"${attrs}>${html}</p>` });
  } else if (name === 'quote' || name === 'intense quote') {
    blocks.push({ kind: 'html', html: `<blockquote><p${attrs}>${html}</p></blockquote>` });
  } else {
    blocks.push({ kind: 'html', html: `<p${attrs}>${html}</p>` });
  }
  if (breaks.length) blocks.push({ kind: 'html', html: pageBreakHtml });
  return blocks;
}

function renderList(items: { numId: string; level: number; html: string }[], ctx: Context) {
  const tagFor = (item: { numId: string; level: number }) => {
    const def = ctx.numbering.get(item.numId)?.get(item.level);
    if (!def || def.format === 'bullet') return { tag: 'ul', attrs: def?.text && !/[o·•]/.test(def.text) ? ` data-list-style="${escapeHtml(def.text)}"` : '' };
    const style = ({ lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', decimalZero: 'decimal-leading-zero' } as Record<string, string>)[def.format];
    return { tag: 'ol', attrs: `${style ? ` data-list-style="${style}"` : ''}${def.start !== 1 ? ` start="${def.start}"` : ''}` };
  };
  let html = '';
  const open: string[] = [];
  let current = -1;
  for (const item of items) {
    if (item.level > current) {
      for (let l = current + 1; l <= item.level; l++) {
        const { tag, attrs } = tagFor({ numId: item.numId, level: l });
        html += `<${tag}${attrs}><li>`;
        open.push(tag);
      }
    } else {
      for (let l = current; l > item.level; l--) html += `</li></${open.pop()}>`;
      html += '</li><li>';
    }
    current = item.level;
    html += item.html;
  }
  while (open.length) html += `</li></${open.pop()}>`;
  return html;
}

function tableHtml(table: Element, ctx: Context) {
  const grid = childrenOf(child(table, 'tblGrid') ?? table).filter((c) => c.localName === 'gridCol').map((c) => Math.round(Number(attr(c, 'w') ?? 0) / TWIP_PER_PX));
  const rows = childrenOf(table).filter((c) => c.localName === 'tr');
  const vMerge = new Map<number, { row: number; cell: number }>();
  const matrix: { html: string; colspan: number; rowspan: number; header: boolean; style: string; widths: number[] }[][] = [];
  rows.forEach((row, rowIndex) => {
    const cells: (typeof matrix)[number] = [];
    const header = on(child(child(row, 'trPr'), 'tblHeader')) === true;
    let column = 0;
    for (const cell of childrenOf(row).filter((c) => c.localName === 'tc')) {
      const tcPr = child(cell, 'tcPr');
      const span = Number(attr(child(tcPr, 'gridSpan'), 'val') ?? 1);
      const merge = child(tcPr, 'vMerge');
      const mergeValue = merge ? attr(merge, 'val') ?? 'continue' : null;
      if (mergeValue === 'continue') {
        const origin = vMerge.get(column);
        if (origin) matrix[origin.row][origin.cell].rowspan += 1;
        column += span;
        continue;
      }
      const fill = attr(child(tcPr, 'shd'), 'fill');
      const vAlign = attr(child(tcPr, 'vAlign'), 'val');
      const css = [fill && fill !== 'auto' ? `background-color: #${fill.toLowerCase()}` : '', vAlign ? `vertical-align: ${vAlign === 'center' ? 'middle' : vAlign}` : ''].filter(Boolean).join('; ');
      if (mergeValue === 'restart') vMerge.set(column, { row: rowIndex, cell: cells.length });
      else vMerge.delete(column);
      cells.push({ html: bodyHtml(childrenOf(cell).filter((c) => c.localName !== 'tcPr'), ctx) || '<p></p>', colspan: span, rowspan: 1, header, style: css, widths: grid.slice(column, column + span) });
      column += span;
    }
    matrix.push(cells);
  });
  const body = matrix.map((cells) => `<tr>${cells.map((cell) => {
    const tag = cell.header ? 'th' : 'td';
    const widths = cell.widths.length && cell.widths.every(Boolean) ? ` data-colwidth="${cell.widths.join(',')}"` : '';
    return `<${tag}${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ''}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ''}${widths}${cell.style ? ` style="${cell.style}"` : ''}>${cell.html}</${tag}>`;
  }).join('')}</tr>`).join('');
  return `<table>${body}</table>`;
}

function bodyHtml(nodes: Element[], ctx: Context): string {
  const blocks: Block[] = [];
  const pushBlocks = (node: Element) => {
    if (node.localName === 'p') blocks.push(...paragraphBlock(node, ctx));
    else if (node.localName === 'tbl') blocks.push({ kind: 'html', html: tableHtml(node, ctx) });
    else if (node.localName === 'sdt') childrenOf(child(node, 'sdtContent') ?? node).forEach(pushBlocks);
  };
  nodes.forEach(pushBlocks);
  let html = '';
  let items: { numId: string; level: number; html: string }[] = [];
  const flush = () => {
    if (items.length) html += renderList(items, ctx);
    items = [];
  };
  for (const block of blocks) {
    if (block.kind === 'item') {
      if (items.length && items[0].numId !== block.numId && block.level === 0) flush();
      items.push(block);
    } else {
      flush();
      html += block.html;
    }
  }
  flush();
  return html;
}

async function readText(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

export type RegionRunToken = { fldChar?: 'begin' | 'separate' | 'end'; instr?: string; text?: string; tab?: boolean; inPageField?: boolean };

const PAGE_FIELD = /^\s*(PAGE|NUMPAGES|SECTIONPAGES)\b/i;

export function regionLineFromRuns(runs: RegionRunToken[]): string {
  let line = '';
  const stack: { instr: string; result: boolean }[] = [];
  const hiddenByField = () => stack.some((field) => field.result && PAGE_FIELD.test(field.instr));
  for (const run of runs) {
    if (run.fldChar === 'begin') stack.push({ instr: '', result: false });
    else if (run.fldChar === 'separate') {
      const top = stack[stack.length - 1];
      if (top) top.result = true;
    } else if (run.fldChar === 'end') stack.pop();
    if (run.instr !== undefined) {
      const top = stack[stack.length - 1];
      if (top && !top.result) top.instr += run.instr;
    }
    const inInstruction = stack.length > 0 && !stack[stack.length - 1].result;
    if (run.text !== undefined && !inInstruction && !hiddenByField() && !run.inPageField) line += run.text;
    if (run.tab && !inInstruction) line += '\t';
  }
  return line;
}

const isPageSimpleField = (run: Element) => {
  let node = run.parentElement;
  while (node && node.localName !== 'p') {
    if (node.localName === 'fldSimple' && PAGE_FIELD.test(attr(node, 'instr') ?? '')) return true;
    node = node.parentElement;
  }
  return false;
};

const runToken = (run: Element): RegionRunToken => {
  const token: RegionRunToken = {};
  const fldChar = child(run, 'fldChar');
  const type = attr(fldChar, 'fldCharType');
  if (type === 'begin' || type === 'separate' || type === 'end') token.fldChar = type;
  const instr = child(run, 'instrText');
  if (instr) token.instr = instr.textContent ?? '';
  const text = child(run, 't');
  if (text) token.text = text.textContent ?? '';
  if (child(run, 'tab')) token.tab = true;
  if (isPageSimpleField(run)) token.inPageField = true;
  return token;
};

function regionText(xml: string | null) {
  if (!xml) return { text: '', hasPage: false };
  const doc = parseXml(xml);
  const lines = NS_LOCAL(doc, 'p').map((p) => regionLineFromRuns(NS_LOCAL(p, 'r').map(runToken)).trim()).filter(Boolean);
  const hasPage = NS_LOCAL(doc, 'instrText').some((el) => /PAGE/.test(el.textContent ?? '')) || NS_LOCAL(doc, 'fldSimple').some((el) => /PAGE/.test(attr(el, 'instr') ?? ''));
  return { text: lines.join(' '), hasPage };
}

function closestSize(width: number, height: number) {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  let best: PageSettings['size'] = 'A4';
  let bestDelta = Infinity;
  (Object.keys(PAGE_SIZES) as PageSettings['size'][]).forEach((size) => {
    const delta = Math.abs(PAGE_SIZES[size].height - long) + Math.abs(PAGE_SIZES[size].width - short);
    if (delta < bestDelta) { best = size; bestDelta = delta; }
  });
  return best;
}

export async function importDocxFull(buffer: ArrayBuffer): Promise<{ html: string; page: PageSettings }> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await readText(zip, 'word/document.xml');
  if (!documentXml) throw new Error('Tệp không phải tài liệu Word hợp lệ.');
  const doc = parseXml(documentXml);
  const ctx: Context = { styles: new Map(), numbering: new Map(), rels: new Map(), media: new Map(), footnotes: new Map() };
  const page = basePage();

  const stylesXml = await readText(zip, 'word/styles.xml');
  if (stylesXml) {
    const styles = parseXml(stylesXml);
    NS_LOCAL(styles, 'style').forEach((el) => {
      const id = attr(el, 'styleId');
      if (id) ctx.styles.set(id, { name: attr(child(el, 'name'), 'val') ?? id, basedOn: attr(child(el, 'basedOn'), 'val'), pPr: child(el, 'pPr'), rPr: child(el, 'rPr') });
    });
    const defaults = NS_LOCAL(styles, 'rPrDefault')[0];
    const rPr = child(defaults, 'rPr');
    const fonts = child(rPr, 'rFonts');
    const font = attr(fonts, 'ascii') ?? attr(fonts, 'hAnsi');
    if (font) page.fontFamily = font;
    const size = attr(child(rPr, 'sz'), 'val');
    if (size) page.fontSize = Number(size) / 2;
    const normal = [...ctx.styles.values()].find((s) => s.name.toLowerCase() === 'normal');
    const normalFont = child(normal?.rPr, 'rFonts');
    const normalName = attr(normalFont, 'ascii') ?? attr(normalFont, 'hAnsi');
    if (normalName) page.fontFamily = normalName;
    const normalSize = attr(child(normal?.rPr, 'sz'), 'val');
    if (normalSize) page.fontSize = Number(normalSize) / 2;
  }

  const numberingXml = await readText(zip, 'word/numbering.xml');
  if (numberingXml) {
    const numbering = parseXml(numberingXml);
    const abstracts = new Map<string, Map<number, { format: string; text: string; start: number }>>();
    NS_LOCAL(numbering, 'abstractNum').forEach((el) => {
      const levels = new Map<number, { format: string; text: string; start: number }>();
      childrenOf(el).filter((c) => c.localName === 'lvl').forEach((lvl) => levels.set(Number(attr(lvl, 'ilvl')), { format: attr(child(lvl, 'numFmt'), 'val') ?? 'decimal', text: attr(child(lvl, 'lvlText'), 'val') ?? '', start: Number(attr(child(lvl, 'start'), 'val') ?? 1) }));
      abstracts.set(attr(el, 'abstractNumId') ?? '', levels);
    });
    NS_LOCAL(numbering, 'num').forEach((el) => {
      const levels = abstracts.get(attr(child(el, 'abstractNumId'), 'val') ?? '');
      if (levels) ctx.numbering.set(attr(el, 'numId') ?? '', levels);
    });
  }

  const relsXml = await readText(zip, 'word/_rels/document.xml.rels');
  const relTypes = new Map<string, string>();
  if (relsXml) {
    Array.from(parseXml(relsXml).getElementsByTagName('Relationship')).forEach((rel) => {
      const id = rel.getAttribute('Id') ?? '';
      ctx.rels.set(id, rel.getAttribute('Target') ?? '');
      relTypes.set(id, rel.getAttribute('Type') ?? '');
    });
  }
  for (const target of ctx.rels.values()) {
    if (!/^media\//.test(target) && !/\/media\//.test(target)) continue;
    const path = target.startsWith('/') ? target.slice(1) : `word/${target}`;
    const file = zip.file(path);
    if (!file) continue;
    const base64 = await file.async('base64');
    const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/png';
    ctx.media.set(target, `data:${mime};base64,${base64}`);
  }

  const footnotesXml = await readText(zip, 'word/footnotes.xml');
  if (footnotesXml) {
    NS_LOCAL(parseXml(footnotesXml), 'footnote').forEach((el) => {
      const id = attr(el, 'id') ?? '';
      if (!FOOTNOTE_SKIP.has(id)) ctx.footnotes.set(id, (el.textContent ?? '').trim());
    });
  }

  const body = NS_LOCAL(doc, 'body')[0];
  const sect = childrenOf(body).find((c) => c.localName === 'sectPr') ?? NS_LOCAL(doc, 'sectPr').pop() ?? null;
  if (sect) {
    const size = child(sect, 'pgSz');
    if (size) {
      const width = Number(attr(size, 'w')) / TWIP_PER_PX;
      const height = Number(attr(size, 'h')) / TWIP_PER_PX;
      page.size = closestSize(width, height);
      page.orientation = attr(size, 'orient') === 'landscape' || width > height ? 'landscape' : 'portrait';
    }
    const margin = child(sect, 'pgMar');
    if (margin) {
      const px = (name: string, fallback: number) => {
        const value = attr(margin, name);
        return value === null ? fallback : Math.round(Math.abs(Number(value)) / TWIP_PER_PX);
      };
      page.margins = { top: px('top', 96), right: px('right', 96), bottom: px('bottom', 96), left: px('left', 96) };
    }
    page.pageNumbers = false;
    for (const ref of childrenOf(sect)) {
      if (ref.localName !== 'headerReference' && ref.localName !== 'footerReference') continue;
      if ((attr(ref, 'type') ?? 'default') !== 'default') continue;
      const id = ref.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ref.getAttribute('r:id') ?? '';
      const target = ctx.rels.get(id);
      if (!target) continue;
      const region = regionText(await readText(zip, `word/${target}`));
      if (ref.localName === 'headerReference') page.header = region.text;
      else page.footer = region.text;
      if (region.hasPage) page.pageNumbers = true;
    }
  }
  const html = bodyHtml(childrenOf(body).filter((c) => c.localName !== 'sectPr'), ctx);
  return { html: html || '<p></p>', page };
}

const inlineMd = (text: string) => escapeHtml(text)
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_]+)__/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

export function markdownToHtml(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)/.exec(line);
    if (heading) { out.push(`<h${heading[1].length}>${inlineMd(heading[2])}</h${heading[1].length}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inlineMd(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => inlineMd(c.trim()));
      const head = `<tr>${cells(line).map((c) => `<th><p>${c}</p></th>`).join('')}</tr>`;
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(`<tr>${cells(lines[i++]).map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`);
      out.push(`<table>${head}${rows.join('')}</table>`);
      continue;
    }
    const task = /^\s*[-*]\s+\[( |x)\]\s+/i;
    const bullet = /^\s*[-*+]\s+/;
    const ordered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || ordered.test(line)) {
      const isTask = task.test(line);
      const isOrdered = ordered.test(line);
      const items: string[] = [];
      while (i < lines.length && (isOrdered ? ordered : bullet).test(lines[i])) {
        const checked = /\[x\]/i.test(lines[i]);
        const text = lines[i].replace(isTask ? task : isOrdered ? ordered : bullet, '');
        items.push(isTask ? `<li data-type="taskItem" data-checked="${checked}"><p>${inlineMd(text)}</p></li>` : `<li><p>${inlineMd(text)}</p></li>`);
        i++;
      }
      out.push(isTask ? `<ul data-type="taskList">${items.join('')}</ul>` : `<${isOrdered ? 'ol' : 'ul'}>${items.join('')}</${isOrdered ? 'ol' : 'ul'}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    out.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return out.join('') || '<p></p>';
}

export const textToHtml = (source: string) => source.replace(/\r\n/g, '\n').split(/\n{2,}/).map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('') || '<p></p>';

export const extractHtmlBody = (source: string) => source.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
