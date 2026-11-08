import { Extension, InputRule, Node, mergeAttributes, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { equationClassName, equationInlineStyle, normalizePresentation, type EquationPresentation } from './equationStyle';
import { katexStrict } from './mathCatalog';
import { EquationInlineEditor } from './equationInline';
import type { CitationSource, CitationStyle } from '../../lib/storage';
import { getPagination, pageAtPos } from './pagination';
import { attachWidthHandles, isObjectHandleEvent } from './resizeObjects';
import { SUPERSCRIPT_TRIGGER, SYMBOL_TRIGGER, isInsideOpenMath, looksLikeDisplayMath, looksLikeInlineMath, superscriptFor, symbolForCommand } from './mathInput';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textBox: { insertTextBox: (attrs?: Record<string, unknown>) => ReturnType };
    columnSection: { wrapInColumns: (count: number) => ReturnType; unwrapColumns: () => ReturnType };
    equation: { insertEquation: (latex: string, display: boolean, presentation?: Partial<EquationPresentation>) => ReturnType };
    smartChip: { insertSmartChip: (attrs: { kind: string; value: string; options?: string }) => ReturnType };
    citation: { insertCitation: (sourceId: string) => ReturnType };
    bookmark: { insertBookmark: (name: string) => ReturnType };
    crossRef: { insertCrossRef: (target: string, show: string) => ReturnType };
    indexEntry: { insertIndexEntry: (term: string) => ReturnType };
    docList: { insertDocList: (kind: DocListKind, attrs?: Record<string, unknown>) => ReturnType };
  }
}

export type DocListKind = 'tableOfContents' | 'figureList' | 'bibliography' | 'docIndex' | 'endnoteList' | 'authorityList';
export type NoteFormat = 'decimal' | 'lower-alpha' | 'lower-roman' | 'symbol';
export type NoteSettings = { foot: NoteFormat; start: number; restart: 'continuous' | 'page'; end: NoteFormat };
type DocRefsStorage = { sources: CitationSource[]; style: CitationStyle; listeners: Set<() => void>; notes: NoteSettings };
export type DocListLine = { text: string; level: number; page: number | null; pos: number | null; pageText?: string };

export const getRefs = (editor: Editor) => (editor.storage as unknown as { docRefs: DocRefsStorage }).docRefs;

export const DocRefs = Extension.create<Record<string, never>, DocRefsStorage>({
  name: 'docRefs',
  addStorage() {
    return { sources: [], style: 'apa', listeners: new Set(), notes: { foot: 'decimal', start: 1, restart: 'continuous', end: 'lower-roman' } };
  },
  onUpdate() {
    this.storage.listeners.forEach((listener) => listener());
  },
});

const notifyRefs = (editor: Editor) => getRefs(editor).listeners.forEach((listener) => listener());

export const setRefs = (editor: Editor, sources: CitationSource[], style: CitationStyle) => {
  const refs = getRefs(editor);
  refs.sources = sources;
  refs.style = style;
  notifyRefs(editor);
};

const VIETNAMESE_FAMILY = /^(nguyen|tran|le|pham|hoang|huynh|phan|vu|vo|dang|bui|do|ho|ngo|duong|ly)$/i;
const authorName = (author: string) => {
  const name = author.trim();
  if (name.includes(',')) return name.split(',')[0].trim();
  const words = name.split(/\s+/);
  const isVietnamese = /[^\p{ASCII}]/u.test(name) || VIETNAMESE_FAMILY.test(words[0] ?? '');
  return isVietnamese ? name : words.pop() ?? name;
};
const authorsLabel = (authors: string, joiner: string) => {
  const names = authors.split(/[;&]/).map(authorName).filter(Boolean);
  if (names.length > 2) return `${names[0]} et al.`;
  return names.join(joiner);
};

const citedOrder = (editor: Editor) => {
  const order: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'citation' && !order.includes(String(node.attrs.sourceId))) order.push(String(node.attrs.sourceId));
  });
  return order;
};

export function citationLabel(editor: Editor, sourceId: string) {
  const { sources, style } = getRefs(editor);
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return '[?]';
  const number = citedOrder(editor).indexOf(sourceId) + 1;
  switch (style) {
    case 'ieee': return `[${number}]`;
    case 'vancouver': return `(${number})`;
    case 'mla': return `(${authorsLabel(source.authors, ' and ')})`;
    case 'chicago': return `(${authorsLabel(source.authors, ' and ')} ${source.year})`;
    default: return `(${authorsLabel(source.authors, ' & ')}, ${source.year})`;
  }
}

export function bibliographyEntry(source: CitationSource, style: CitationStyle, number: number) {
  const where = [source.publisher, source.pages ? `tr. ${source.pages}` : '', source.url].filter(Boolean).join('. ');
  const tail = where ? ` ${where}.` : '';
  switch (style) {
    case 'ieee': return `[${number}] ${source.authors}, "${source.title}," ${source.year}.${tail}`;
    case 'vancouver': return `${number}. ${source.authors}. ${source.title}. ${source.year}.${tail}`;
    case 'mla': return `${source.authors}. "${source.title}." ${source.year}.${tail}`;
    case 'chicago': return `${source.authors}. ${source.year}. "${source.title}."${tail}`;
    default: return `${source.authors} (${source.year}). ${source.title}.${tail}`;
  }
}

export function docListLines(editor: Editor, kind: DocListKind, attrs: Record<string, unknown>) {
  const lines: DocListLine[] = [];
  const doc = editor.state.doc;
  const paged = Boolean(getPagination(editor).config);
  if (kind === 'tableOfContents') {
    const levels = Number(attrs.levels) || 3;
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.attrs.level <= levels && !node.attrs.tocHide && node.textContent.trim()) lines.push({ text: node.textContent, level: node.attrs.level, page: paged && attrs.showPages !== false ? pageAtPos(editor, pos) : null, pos });
    });
  } else if (kind === 'figureList') {
    doc.descendants((node, pos) => {
      if (node.attrs?.captionKind && (!attrs.captionKind || node.attrs.captionKind === attrs.captionKind)) lines.push({ text: node.textContent, level: 1, page: paged && attrs.showPages !== false ? pageAtPos(editor, pos) : null, pos });
    });
  } else if (kind === 'bibliography') {
    const { sources, style } = getRefs(editor);
    const order = citedOrder(editor);
    const used = attrs.all ? sources : order.map((id) => sources.find((s) => s.id === id)).filter((s): s is CitationSource => Boolean(s));
    used.forEach((source, i) => lines.push({ text: bibliographyEntry(source, style, i + 1), level: 1, page: null, pos: null }));
  } else if (kind === 'docIndex') {
    const map = new Map<string, Set<number>>();
    doc.descendants((node, pos) => {
      if (node.type.name === 'indexEntry') {
        const term = String(node.attrs.term);
        if (!map.has(term)) map.set(term, new Set());
        map.get(term)!.add(pageAtPos(editor, pos));
      }
    });
    let lastMain = '';
    [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).forEach(([term, pages]) => {
      const list = [...pages].sort((x, y) => x - y).join(', ');
      const split = term.indexOf(': ');
      const main = split > 0 ? term.slice(0, split) : term;
      const sub = split > 0 ? term.slice(split + 2) : '';
      if (sub && main !== lastMain) lines.push({ text: main, level: 1, page: null, pos: null });
      lastMain = main;
      const label = sub || term;
      if (attrs.rightPages) lines.push({ text: label, level: sub ? 2 : 1, page: null, pos: null, pageText: list });
      else lines.push({ text: `${label}  ${list}`, level: sub ? 2 : 1, page: null, pos: null });
    });
  } else if (kind === 'authorityList') {
    const groups = new Map<string, Map<string, Set<number>>>();
    doc.descendants((node, pos) => {
      if (node.type.name !== 'authorityEntry') return true;
      const category = String(node.attrs.category || 'Khác');
      if (attrs.category && attrs.category !== 'all' && attrs.category !== category) return false;
      if (!groups.has(category)) groups.set(category, new Map());
      const entries = groups.get(category)!;
      const text = String(node.attrs.text);
      if (!entries.has(text)) entries.set(text, new Set());
      entries.get(text)!.add(pageAtPos(editor, pos));
      return false;
    });
    [...groups.keys()].sort((a, b) => a.localeCompare(b, 'vi')).forEach((category) => {
      if (attrs.category === 'all' || !attrs.category) lines.push({ text: category, level: 1, page: null, pos: null });
      [...groups.get(category)!.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).forEach(([text, pages]) => {
        const sorted = [...pages].sort((x, y) => x - y);
        lines.push({ text, level: 2, page: null, pos: null, pageText: attrs.passim && sorted.length >= 5 ? 'passim' : sorted.join(', ') });
      });
    });
  } else {
    let n = 0;
    doc.descendants((node, pos) => {
      if (node.type.name === 'footnote' && node.attrs.kind === 'end') {
        n += 1;
        lines.push({ text: `${formatNote(n, getRefs(editor).notes.end)}. ${node.attrs.text}`, level: 1, page: null, pos });
      }
    });
  }
  return lines;
}

const NOTE_SYMBOLS = ['*', '†', '‡', '§', '¶'];

const toLowerRoman = (value: number) => {
  const table: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let rest = Math.max(1, value);
  let out = '';
  for (const [n, s] of table) while (rest >= n) { out += s; rest -= n; }
  return out;
};

const toLowerAlpha = (value: number) => {
  let rest = Math.max(1, value);
  let out = '';
  while (rest > 0) {
    rest -= 1;
    out = String.fromCharCode(97 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
};

export const formatNote = (value: number, format: NoteFormat) => {
  switch (format) {
    case 'lower-alpha': return toLowerAlpha(value);
    case 'lower-roman': return toLowerRoman(value);
    case 'symbol': return NOTE_SYMBOLS[(value - 1) % NOTE_SYMBOLS.length].repeat(Math.floor((value - 1) / NOTE_SYMBOLS.length) + 1);
    default: return String(value);
  }
};

const DOC_LIST_TITLES: Record<DocListKind, string> = {
  tableOfContents: 'MỤC LỤC',
  figureList: 'DANH MỤC HÌNH, BẢNG',
  bibliography: 'TÀI LIỆU THAM KHẢO',
  docIndex: 'CHỈ MỤC',
  endnoteList: 'CHÚ THÍCH CUỐI',
  authorityList: 'DANH MỤC VĂN BẢN VIỆN DẪN',
};

const DOC_LIST_EMPTY: Record<DocListKind, string> = {
  tableOfContents: 'Chưa có tiêu đề nào. Dùng kiểu Heading để mục lục tự cập nhật.',
  figureList: 'Chưa có nhãn hình hay bảng. Dùng Tham chiếu → Chèn nhãn.',
  bibliography: 'Chưa có trích dẫn nào. Dùng Tham chiếu → Chèn trích dẫn.',
  docIndex: 'Chưa có mục nào. Bôi chọn từ rồi dùng Tham chiếu → Đánh dấu mục.',
  endnoteList: 'Chưa có chú thích cuối.',
  authorityList: 'Chưa có văn bản nào. Bôi chọn tên văn bản rồi dùng Tham chiếu → Đánh dấu viện dẫn.',
};

export const docListTitle = (kind: DocListKind) => DOC_LIST_TITLES[kind];

const COMMON_LIST_ATTRS = { showTitle: true, titleText: null, leader: 'dots', rightAlign: true, columns: 1 };

const docListNode = (name: DocListKind, tag: string, ownAttrs: Record<string, unknown>) => { const extraAttrs: Record<string, unknown> = { ...COMMON_LIST_ATTRS, ...ownAttrs }; return Node.create({
  name,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return Object.fromEntries(Object.entries(extraAttrs).map(([key, value]) => [key, {
      default: value,
      parseHTML: (element: HTMLElement) => {
        const raw = element.getAttribute(`data-${key.toLowerCase()}`);
        if (raw === null) return value;
        if (raw === 'true' || raw === 'false') return raw === 'true';
        return Number.isNaN(Number(raw)) ? raw : Number(raw);
      },
      renderHTML: (attributes: Record<string, unknown>) => (attributes[key] === null ? {} : { [`data-${key.toLowerCase()}`]: attributes[key] }),
    }]));
  },
  parseHTML() {
    return [{ tag: `div[${tag}]` }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { [tag]: 'true', class: 'doc-toc' })];
  },
  addNodeView() {
    return ({ editor, node }) => {
      const dom = document.createElement('div');
      dom.className = `doc-toc doc-list-${name}`;
      dom.setAttribute(tag, 'true');
      dom.contentEditable = 'false';
      let attrs = node.attrs;
      const jump = (pos: number) => {
        const target = editor.view.nodeDOM(pos);
        if (target instanceof HTMLElement) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        editor.chain().focus().setTextSelection(pos + 1).run();
      };
      const render = () => {
        const lines = docListLines(editor, name, attrs);
        const signature = JSON.stringify([lines.map((l) => [l.text, l.level, l.page, l.pageText]), attrs]);
        if (dom.dataset.signature === signature) return;
        dom.dataset.signature = signature;
        dom.replaceChildren();
        dom.dataset.leader = String(attrs.leader ?? 'dots');
        dom.dataset.right = String(attrs.rightAlign !== false);
        dom.dataset.columns = String(attrs.columns ?? 1);
        dom.style.columnCount = Number(attrs.columns) > 1 ? String(attrs.columns) : '';
        if (attrs.showTitle !== false) {
          const title = document.createElement('div');
          title.className = 'toc-title';
          title.textContent = String(attrs.titleText ?? DOC_LIST_TITLES[name]);
          dom.appendChild(title);
        }
        if (!lines.length) {
          const empty = document.createElement('div');
          empty.className = 'toc-empty';
          empty.textContent = DOC_LIST_EMPTY[name];
          dom.appendChild(empty);
          return;
        }
        for (const line of lines) {
          const row = document.createElement(line.pos === null ? 'div' : 'button');
          if (row instanceof HTMLButtonElement) row.type = 'button';
          row.className = `toc-entry toc-l${Math.min(line.level, 3)}`;
          const label = document.createElement('span');
          label.className = 'toc-text';
          label.textContent = line.text;
          row.appendChild(label);
          if (line.page !== null || line.pageText) {
            const dots = document.createElement('span');
            dots.className = 'toc-dots';
            const number = document.createElement('span');
            number.className = 'toc-page';
            number.textContent = line.pageText ?? String(line.page);
            row.append(dots, number);
          }
          const pos = line.pos;
          if (pos !== null) row.addEventListener('mousedown', (event) => { event.preventDefault(); jump(pos); });
          dom.appendChild(row);
        }
      };
      render();
      const pagination = getPagination(editor);
      const refs = getRefs(editor);
      pagination.listeners.add(render);
      refs.listeners.add(render);
      return {
        dom,
        ignoreMutation: () => true,
        update: (updated) => {
          if (updated.type.name !== name) return false;
          attrs = updated.attrs;
          render();
          return true;
        },
        destroy: () => {
          pagination.listeners.delete(render);
          refs.listeners.delete(render);
        },
      };
    };
  },
}); };

export const TableOfContents = docListNode('tableOfContents', 'data-toc', { levels: 3, showPages: true }).extend({
  addCommands() {
    return {
      insertDocList: (kind, attrs) => ({ commands }) => commands.insertContent([{ type: kind, attrs: attrs ?? {} }, { type: 'paragraph' }]),
    };
  },
});
export const FigureList = docListNode('figureList', 'data-figure-list', { captionKind: null, showPages: true });
export const Bibliography = docListNode('bibliography', 'data-bibliography', { all: false });
export const DocIndex = docListNode('docIndex', 'data-doc-index', { rightPages: false });
export const EndnoteList = docListNode('endnoteList', 'data-endnote-list', {});
export const AuthorityList = docListNode('authorityList', 'data-authority-list', { category: 'all', passim: true });

export const TextStyleExtras = Extension.create({
  name: 'textStyleExtras',
  addGlobalAttributes() {
    const attr = (name: string, css: string) => ({
      default: null,
      parseHTML: (element: HTMLElement) => element.style.getPropertyValue(css) || null,
      renderHTML: (attributes: Record<string, unknown>) => (attributes[name] ? { style: `${css}: ${attributes[name]}` } : {}),
    });
    return [{
      types: ['textStyle'],
      attributes: {
        letterSpacing: attr('letterSpacing', 'letter-spacing'),
        textTransform: attr('textTransform', 'text-transform'),
        fontVariant: attr('fontVariant', 'font-variant'),
        textShadow: attr('textShadow', 'text-shadow'),
        underlineStyle: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-underline'),
          renderHTML: (attributes: Record<string, unknown>) => (attributes.underlineStyle ? { 'data-underline': attributes.underlineStyle, style: `text-decoration: underline ${attributes.underlineStyle} ${attributes.underlineColor ?? 'currentColor'}` } : {}),
        },
        underlineColor: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-underline-color'),
          renderHTML: (attributes: Record<string, unknown>) => (attributes.underlineColor ? { 'data-underline-color': attributes.underlineColor } : {}),
        },
      },
    }];
  },
});

export const ListStyles = Extension.create({
  name: 'listStyles',
  addGlobalAttributes() {
    return [{
      types: ['bulletList', 'orderedList'],
      attributes: {
        listStyle: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-list-style'),
          renderHTML: (attributes: Record<string, unknown>) => {
            const value = attributes.listStyle as string | null;
            if (!value) return {};
            const css = /^[a-z-]+$/.test(value) ? value : `"${value} "`;
            return { 'data-list-style': value, style: `list-style-type: ${css}` };
          },
        },
      },
    }];
  },
});

const tableStyleKey = new PluginKey('tableStyleDecorations');

export const TableExtras = Extension.create({
  name: 'tableExtras',
  addGlobalAttributes() {
    return [
      {
        types: ['table'],
        attributes: {
          tableStyle: {
            default: 'grid',
            parseHTML: (element: HTMLElement) => element.getAttribute('data-table-style') ?? 'grid',
            renderHTML: (attributes: Record<string, unknown>) => ({ 'data-table-style': attributes.tableStyle }),
          },
        },
      },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          vAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.verticalAlign || null,
            renderHTML: (attributes: Record<string, unknown>) => (attributes.vAlign ? { style: `vertical-align: ${attributes.vAlign}` } : {}),
          },
          cellBorders: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-cell-borders'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.cellBorders ? { 'data-cell-borders': attributes.cellBorders } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: tableStyleKey,
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'table') {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-table-style': String(node.attrs.tableStyle ?? 'grid') }));
              return false;
            }
            return true;
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});

export const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    const attr = (name: string, fallback: unknown) => ({
      default: fallback,
      parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
      renderHTML: (attributes: Record<string, unknown>) => (attributes[name] ? { [`data-${name}`]: attributes[name] } : {}),
    });
    return { align: attr('align', 'full'), fill: attr('fill', '#ffffff'), stroke: attr('stroke', '#94a3b8'), boxWidth: attr('boxWidth', '50') };
  },
  parseHTML() {
    return [{ tag: 'div[data-text-box]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const align = String(node.attrs.align);
    const width = align === 'full' ? '100%' : `${node.attrs.boxWidth}%`;
    return ['div', mergeAttributes(HTMLAttributes, { 'data-text-box': 'true', class: `doc-textbox align-${align}`, style: `background-color: ${node.attrs.fill}; border-color: ${node.attrs.stroke}; width: ${width}` }), 0];
  },
  addNodeView() {
    return ({ node: initial, editor, getPos }) => {
      let node = initial;
      const dom = document.createElement('div');
      dom.dataset.textBox = 'true';
      const body = document.createElement('div');
      body.className = 'doc-textbox-body';
      dom.append(body);
      const render = (current: typeof initial) => {
        const align = String(current.attrs.align);
        dom.className = `doc-textbox align-${align}`;
        dom.dataset.align = align;
        dom.dataset.fill = String(current.attrs.fill);
        dom.dataset.stroke = String(current.attrs.stroke);
        dom.dataset.boxWidth = String(current.attrs.boxWidth);
        dom.style.backgroundColor = String(current.attrs.fill);
        dom.style.borderColor = String(current.attrs.stroke);
        dom.style.width = align === 'full' ? '100%' : `${current.attrs.boxWidth}%`;
      };
      render(node);
      const cleanup = attachWidthHandles({
        editor, dom, getPos,
        directions: ['left', 'right'],
        minPercent: 15,
        isCentered: () => ['full', 'center'].includes(String(node.attrs.align)),
        commit: (current, percent) => ({ boxWidth: String(percent), align: current.attrs.align === 'full' ? (percent >= 100 ? 'full' : 'center') : current.attrs.align }),
      });
      return {
        dom,
        contentDOM: body,
        update: (next) => {
          if (next.type !== node.type) return false;
          node = next;
          render(next);
          return true;
        },
        stopEvent: isObjectHandleEvent,
        ignoreMutation: (mutation) => mutation.type !== 'selection' && !body.contains(mutation.target),
        destroy: cleanup,
      };
    };
  },
  addCommands() {
    return {
      insertTextBox: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs: attrs ?? {}, content: [{ type: 'paragraph' }] }),
    };
  },
});

export const ColumnSection = Node.create({
  name: 'columnSection',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-columns')) || 2,
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-columns': attributes.count }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-column-section]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column-section': 'true', class: 'doc-columns', style: `column-count: ${node.attrs.count}` }), 0];
  },
  addCommands() {
    return {
      wrapInColumns: (count) => ({ commands, editor }) => (editor.isActive(this.name) ? commands.updateAttributes(this.name, { count }) : commands.wrapIn(this.name, { count })),
      unwrapColumns: () => ({ commands }) => commands.lift(this.name),
    };
  },
});

export function cleanMathInput(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\\frac\(([^()]+)\)\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/\\sqrt\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/\\sqrt\[([^\[\]]+)\]\(([^()]+)\)/g, '\\sqrt[$1]{$2}');
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}');
  s = s.replace(/_\(([^()]+)\)/g, '_{$1}');
  s = s.replace(/\\vec\(([^()]+)\)/g, '\\vec{$1}');
  s = s.replace(/\\bar\(([^()]+)\)/g, '\\bar{$1}');
  s = s.replace(/\\hat\(([^()]+)\)/g, '\\hat{$1}');
  s = s.replace(/\\sum_\(([^()]+)\)\^\(([^()]+)\)/g, '\\sum_{$1}^{$2}');
  s = s.replace(/\\int_\(([^()]+)\)\^\(([^()]+)\)/g, '\\int_{$1}^{$2}');
  s = s.replace(/\\lim_\(([^()]+)\)/g, '\\lim_{$1}');
  return s;
}

export const Equation = Node.create({
  name: 'equation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-latex') ?? '', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-latex': attributes.latex }) },
      display: { default: false, parseHTML: (element: HTMLElement) => element.getAttribute('data-display') === 'true', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-display': String(Boolean(attributes.display)) }) },
      numbered: { default: false, parseHTML: (element: HTMLElement) => element.getAttribute('data-numbered') === 'true', renderHTML: (attributes: Record<string, unknown>) => (attributes.numbered ? { 'data-numbered': 'true' } : {}) },
      align: { default: 'center', parseHTML: (element: HTMLElement) => element.getAttribute('data-align') ?? 'center', renderHTML: (attributes: Record<string, unknown>) => (attributes.align && attributes.align !== 'center' ? { 'data-align': attributes.align } : {}) },
      size: { default: 100, parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-size') ?? 100), renderHTML: (attributes: Record<string, unknown>) => (Number(attributes.size) && Number(attributes.size) !== 100 ? { 'data-size': String(attributes.size) } : {}) },
      color: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-color') ?? '', renderHTML: (attributes: Record<string, unknown>) => (attributes.color ? { 'data-color': attributes.color } : {}) },
      boxed: { default: false, parseHTML: (element: HTMLElement) => element.getAttribute('data-boxed') === 'true', renderHTML: (attributes: Record<string, unknown>) => (attributes.boxed ? { 'data-boxed': 'true' } : {}) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-latex]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-equation' }), String(node.attrs.latex)];
  },
  renderText({ node }) {
    return String(node.attrs.latex);
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      let current = node;
      const paint = (attrs: Record<string, unknown>) => {
        const presentation = normalizePresentation(attrs);
        dom.className = equationClassName(presentation);
        dom.setAttribute('style', equationInlineStyle(presentation));
        katex.render(String(attrs.latex ?? '') || '\\square', dom, { throwOnError: false, displayMode: presentation.display, output: 'htmlAndMathml', strict: katexStrict });
      };
      paint(node.attrs);
      const inline = new EquationInlineEditor({ editor, dom, getPos, node: () => current, repaint: () => paint(current.attrs) });
      dom.addEventListener('click', (event) => {
        if (inline.active || event.detail > 1) return;
        void inline.open();
      });
      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: (event) => inline.active && event.target instanceof globalThis.Node && dom.contains(event.target),
        update: (updated) => {
          if (updated.type.name !== 'equation') return false;
          current = updated;
          if (!inline.active) paint(updated.attrs);
          return true;
        },
        destroy: () => inline.dispose(),
      };
    };
  },
  addCommands() {
    return {
      insertEquation: (latex, display, presentation = {}) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { ...presentation, latex, display } }),
    };
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\$\$([^\$]+)\$\$$/,
        handler: ({ state, range, match }) => {
          if (!looksLikeDisplayMath(match[1])) return null;
          const latex = cleanMathInput(match[1]);
          if (!latex) return null;
          const start = range.to - match[0].length;
          state.tr.replaceWith(start, range.to, this.type.create({ latex, display: true }));
          return undefined;
        },
      }),
      new InputRule({
        find: /(?:^|[^\$])\$([^\$]+)\$$/,
        handler: ({ state, range, match }) => {
          if (!looksLikeInlineMath(match[1])) return null;
          const latex = cleanMathInput(match[1]);
          if (!latex) return null;
          const hasLeading = match[0].length > 0 && match[0][0] !== '$';
          const start = hasLeading ? range.to - match[0].length + 1 : range.to - match[0].length;
          state.tr.replaceWith(start, range.to, this.type.create({ latex, display: false }));
          return undefined;
        },
      }),
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex: '\\square', display: true }));
          return undefined;
        },
      }),
    ];
  },
});

export const SmartChip = Node.create({
  name: 'smartChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    const attr = (name: string, fallback: string) => ({
      default: fallback,
      parseHTML: (element: HTMLElement) => element.getAttribute(`data-chip-${name}`) ?? fallback,
      renderHTML: (attributes: Record<string, unknown>) => ({ [`data-chip-${name}`]: attributes[name] }),
    });
    return { kind: attr('kind', 'status'), value: attr('value', ''), options: attr('options', '') };
  },
  parseHTML() {
    return [{ tag: 'span[data-chip-kind]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: `smart-chip chip-${node.attrs.kind}` }), String(node.attrs.value)];
  },
  renderText({ node }) {
    return String(node.attrs.value);
  },
  addCommands() {
    return {
      insertSmartChip: (attrs) => ({ commands }) => commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }]),
    };
  },
});

const liveInline = (name: string, className: string, compute: (editor: Editor, attrs: Record<string, unknown>) => string) => ({
  addNodeView() {
    return ({ editor, node }: { editor: Editor; node: { attrs: Record<string, unknown> } }) => {
      const dom = document.createElement('span');
      dom.className = className;
      let attrs = node.attrs;
      const render = () => {
        const text = compute(editor, attrs);
        if (dom.textContent !== text) dom.textContent = text;
      };
      render();
      const refs = getRefs(editor);
      const pagination = getPagination(editor);
      refs.listeners.add(render);
      pagination.listeners.add(render);
      return {
        dom,
        ignoreMutation: () => true,
        update: (updated: { type: { name: string }; attrs: Record<string, unknown> }) => {
          if (updated.type.name !== name) return false;
          attrs = updated.attrs;
          render();
          return true;
        },
        destroy: () => {
          refs.listeners.delete(render);
          pagination.listeners.delete(render);
        },
      };
    };
  },
});

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { sourceId: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-citation') ?? '', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-citation': attributes.sourceId }) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-citation' })];
  },
  ...liveInline('citation', 'doc-citation', (editor, attrs) => citationLabel(editor, String(attrs.sourceId))),
  addCommands() {
    return { insertCitation: (sourceId) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { sourceId } }) };
  },
});

export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { name: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-bookmark') ?? '', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-bookmark': attributes.name, title: attributes.name, id: `bm-${attributes.name}` }) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-bookmark]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-bookmark' })];
  },
  renderText() {
    return '';
  },
  addCommands() {
    return { insertBookmark: (name) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { name } }) };
  },
});

export const findBookmark = (editor: Editor, name: string) => {
  let found: { pos: number; parentText: string } | null = null;
  editor.state.doc.descendants((node, pos, parent) => {
    if (!found && node.type.name === 'bookmark' && node.attrs.name === name) found = { pos, parentText: parent?.textContent ?? '' };
    return !found;
  });
  return found as { pos: number; parentText: string } | null;
};

export const CrossRef = Node.create({
  name: 'crossRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      target: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-xref') ?? '', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-xref': attributes.target }) },
      show: { default: 'text', parseHTML: (element: HTMLElement) => element.getAttribute('data-xref-show') ?? 'text', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-xref-show': attributes.show }) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-xref]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-xref' })];
  },
  ...liveInline('crossRef', 'doc-xref', (editor, attrs) => crossRefLabel(editor, String(attrs.target), String(attrs.show))),
  addCommands() {
    return { insertCrossRef: (target, show) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { target, show } }) };
  },
});

export const crossRefLabel = (editor: Editor, target: string, show: string) => {
  const found = findBookmark(editor, target);
  if (!found) return '[không tìm thấy]';
  return show === 'page' ? `trang ${pageAtPos(editor, found.pos)}` : found.parentText || target;
};

export const IndexEntry = Node.create({
  name: 'indexEntry',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { term: { default: '', parseHTML: (element: HTMLElement) => element.getAttribute('data-index-term') ?? '', renderHTML: (attributes: Record<string, unknown>) => ({ 'data-index-term': attributes.term, title: `Chỉ mục: ${attributes.term}` }) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-index-term]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-index-mark' })];
  },
  renderText() {
    return '';
  },
  addCommands() {
    return { insertIndexEntry: (term) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { term } }) };
  },
});

const REPLACEMENTS: [RegExp, string][] = [
  [/--$/, '—'], [/\.\.\.$/, '…'], [/\(c\)$/i, '©'], [/\(r\)$/i, '®'], [/\(tm\)$/i, '™'], [/->$/, '→'], [/<-$/, '←'], [/=>$/, '⇒'], [/1\/2$/, '½'], [/1\/4$/, '¼'], [/3\/4$/, '¾'], [/!=$/, '≠'], [/<=$/, '≤'], [/>=$/, '≥'],
];

export const AutoCorrect = Extension.create<Record<string, never>, { enabled: boolean }>({
  name: 'autoCorrect',
  addStorage() {
    return { enabled: true };
  },
  addInputRules() {
    const storage = this.storage;
    const outsideMath = (state: EditorState, from: number) => !isInsideOpenMath(state.doc.textBetween(state.doc.resolve(from).start(), from, undefined, '\ufffc'));
    const rules = REPLACEMENTS.map(([find, text]) => new InputRule({
      find,
      handler: ({ state, range }) => {
        if (!storage.enabled || !outsideMath(state, range.from)) return null;
        state.tr.insertText(text, range.from, range.to);
        return undefined;
      },
    }));
    rules.push(new InputRule({
      find: SYMBOL_TRIGGER,
      handler: ({ state, range, match }) => {
        const symbol = symbolForCommand(match[1]);
        if (!storage.enabled || !symbol || !outsideMath(state, range.from)) return null;
        state.tr.insertText(`${symbol} `, range.from, range.to);
        return undefined;
      },
    }));
    rules.push(new InputRule({
      find: SUPERSCRIPT_TRIGGER,
      handler: ({ state, range, match }) => {
        const superscript = superscriptFor(match[2]);
        if (!storage.enabled || !superscript || !outsideMath(state, range.from)) return null;
        state.tr.insertText(`${match[1]}${superscript} `, range.from, range.to);
        return undefined;
      },
    }));
    rules.push(new InputRule({
      find: /(?:^|[.!?]\s)(\p{Ll})$/u,
      handler: ({ state, range, match }) => {
        if (!storage.enabled || !outsideMath(state, range.from)) return null;
        state.tr.insertText(match[0].slice(0, -1) + match[1].toLocaleUpperCase('vi'), range.from, range.to);
        return undefined;
      },
    }));
    return rules;
  },
});
