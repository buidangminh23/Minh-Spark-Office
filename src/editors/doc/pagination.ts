import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export const PAGE_GAP = 24;
const FOOTNOTE_RULE_HEIGHT = 17;
const KEEP_NEXT_MIN = 40;
const MAX_PASSES = 4;
const SCHEDULE_MS = 60;

export type VerticalAlign = 'top' | 'center' | 'justify' | 'bottom';
export type PaginationConfig = { pageHeight: number; marginTop: number; marginBottom: number; zoom: number; contentWidth: number; verticalAlign?: VerticalAlign };
export type PageBreakInfo = { pos: number; height: number; kind: 'block' | 'inline' | 'row'; colspan: number };
export type PageNote = { text: string; number: number };
export type PageExtra = { pos: number; height: number; inline?: boolean };
export type PaginationResult = { pages: number; breaks: PageBreakInfo[]; notes: PageNote[][]; extras: PageExtra[] };

type Unit = { pos: number; size: number; breakPos: number; kind: 'text' | 'block' | 'row'; node: PMNode; colspan: number; notes: string[]; keepNext: boolean; force: boolean; parity: number | null };
type LayoutMeta = { breaks: PageBreakInfo[]; extras: PageExtra[] };
type PluginStateValue = LayoutMeta & { set: DecorationSet };

export type PaginationStorage = {
  config: PaginationConfig | null;
  result: PaginationResult;
  listeners: Set<(result: PaginationResult) => void>;
  refresh: () => void;
  runNow: () => void;
};

const EMPTY: PaginationResult = { pages: 1, breaks: [], notes: [[]], extras: [] };
const NON_PAGE_KINDS = new Set(['continuous', 'wrap']);
const JUSTIFY_MAX_RATIO = 0.5;
const key = new PluginKey<PluginStateValue>('docPagination');

export const getPagination = (editor: Editor) => (editor.storage as unknown as { pagination: PaginationStorage }).pagination;

export const pageAtPos = (editor: Editor, pos: number) => 1 + getPagination(editor).result.breaks.filter((b) => b.pos <= pos).length;

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

function footnotesOf(node: PMNode) {
  const notes: string[] = [];
  node.descendants((child) => {
    if (child.type.name === 'footnote' && child.attrs.kind !== 'end') notes.push(String(child.attrs.text));
    return true;
  });
  return notes;
}

function collectUnits(doc: PMNode) {
  const units: Unit[] = [];
  let forceNext = false;
  let parityNext: number | null = null;
  const push = (node: PMNode, pos: number, breakPos: number, kind: Unit['kind'], colspan = 1) => {
    const force = forceNext || Boolean(node.attrs?.pageBreakBefore);
    const parity = parityNext;
    const breakKind = node.type.name === 'pageBreak' ? String(node.attrs?.kind ?? 'page') : null;
    forceNext = breakKind !== null && !NON_PAGE_KINDS.has(breakKind);
    parityNext = breakKind === 'even' ? 0 : breakKind === 'odd' ? 1 : null;
    units.push({ pos, size: node.nodeSize, breakPos, kind, node, colspan, notes: footnotesOf(node), keepNext: node.type.name === 'heading' || Boolean(node.attrs?.keepNext), force, parity });
  };
  const visit = (node: PMNode, pos: number, breakPos: number) => {
    const name = node.type.name;
    if (name === 'table') {
      const colspan = node.firstChild?.childCount ?? 1;
      node.forEach((row, offset, index) => {
        const rowPos = pos + 1 + offset;
        push(row, rowPos, index === 0 ? breakPos : rowPos, index === 0 ? 'block' : 'row', colspan);
      });
      return;
    }
    if (LIST_TYPES.has(name)) {
      node.forEach((item, offset, index) => {
        const itemPos = pos + 1 + offset;
        item.forEach((child, childOffset, childIndex) => {
          const childPos = itemPos + 1 + childOffset;
          const outer = index === 0 ? breakPos : itemPos;
          visit(child, childPos, childIndex === 0 ? outer : childPos);
        });
      });
      return;
    }
    if (name === 'blockquote') {
      node.forEach((child, offset, index) => {
        const childPos = pos + 1 + offset;
        visit(child, childPos, index === 0 ? breakPos : childPos);
      });
      return;
    }
    push(node, pos, breakPos, node.isTextblock ? 'text' : 'block');
  };
  doc.forEach((child, offset) => visit(child, offset, offset));
  return units;
}

function noteMeasurer(paper: HTMLElement, width: number) {
  const cache = new Map<string, number>();
  let probe: HTMLDivElement | null = null;
  const measure = (text: string) => {
    const known = cache.get(text);
    if (known !== undefined) return known;
    if (!probe) {
      probe = document.createElement('div');
      probe.className = 'footnote-item';
      probe.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:${width}px;font-size:0.82em`;
      paper.appendChild(probe);
    }
    probe.textContent = `1 ${text}`;
    const height = probe.offsetHeight;
    cache.set(text, height);
    return height;
  };
  return { measure, dispose: () => probe?.remove() };
}

function findSplit(view: EditorView, unit: Unit, limit: number, y: (rectY: number, pos: number) => number) {
  const start = unit.pos + 1;
  const end = unit.pos + unit.node.nodeSize - 1;
  if (end <= start) return null;
  const lineOf = (pos: number) => {
    try {
      const c = view.coordsAtPos(pos, 1);
      return { top: y(c.top, pos), bottom: y(c.bottom, pos) };
    } catch {
      return null;
    }
  };
  const first = lineOf(start);
  if (!first || first.bottom > limit) return null;
  const search = (edge: number) => {
    let low = start;
    let high = end;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const line = lineOf(mid);
      if (line && line.bottom > edge) high = mid;
      else low = mid + 1;
    }
    return low;
  };
  let pos = search(limit);
  const lastLine = lineOf(end);
  let line = lineOf(pos);
  if (!line || !lastLine || line.bottom <= limit) return null;
  const lineHeight = line.bottom - line.top || 16;
  if (lastLine.bottom - line.top < lineHeight * 1.5) {
    pos = search(limit - lineHeight);
    line = lineOf(pos);
    if (!line) return null;
  }
  if (line.top - first.top < lineHeight * 1.5) return null;
  return { pos, lineTop: line.top };
}

function computeLayout(view: EditorView, config: PaginationConfig, current: PageBreakInfo[], currentExtras: PageExtra[]): PaginationResult {
  const paper = view.dom.closest('.doc-paper') as HTMLElement | null;
  if (!paper) return EMPTY;
  const paperTop = paper.getBoundingClientRect().top;
  const z = config.zoom || 1;
  const pageSpan = config.pageHeight + PAGE_GAP;
  const contentTop = (page: number) => page * pageSpan + config.marginTop;
  const contentBottom = (page: number) => page * pageSpan + config.pageHeight - config.marginBottom;
  const removedAt = (pos: number) => current.reduce((sum, b) => (b.pos <= pos ? sum + b.height : sum), 0) + currentExtras.reduce((sum, b) => (b.pos <= pos ? sum + b.height : sum), 0);
  const units = collectUnits(view.state.doc);
  const breaks: PageBreakInfo[] = [];
  const reserve: number[] = [];
  const notes: PageNote[][] = [[]];
  const pageBottom: number[] = [];
  const pageUnits: number[][] = [[]];
  const breakOfPage: number[] = [];
  const measurer = noteMeasurer(paper, config.contentWidth);
  let shift = 0;
  let page = 0;
  let noteNumber = 0;

  const yOf = (rectY: number, pos: number) => (rectY - paperTop) / z - removedAt(pos) + shift;
  const addBreak = (pos: number, height: number, kind: PageBreakInfo['kind'], colspan = 1) => {
    breaks.push({ pos, height, kind, colspan });
    shift += height;
    page += 1;
    breakOfPage[page] = breaks.length - 1;
    notes[page] = notes[page] ?? [];
    pageUnits[page] = pageUnits[page] ?? [];
  };

  for (let index = 0; index < units.length; index++) {
    const unit = units[index];
    const el = view.nodeDOM(unit.pos);
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    const end = unit.pos + unit.size;
    const noteHeight = unit.notes.reduce((sum, text) => sum + measurer.measure(text), 0);
    const top = () => yOf(rect.top, unit.breakPos);
    const bottom = () => yOf(rect.bottom, end - 1);
    const limit = () => contentBottom(page) - (reserve[page] ?? 0) - (noteHeight ? noteHeight + (reserve[page] ? 0 : FOOTNOTE_RULE_HEIGHT) : 0);
    const blockKind: PageBreakInfo['kind'] = unit.kind === 'row' ? 'row' : 'block';

    if (unit.force && top() > contentTop(page) + 2) addBreak(unit.breakPos, contentTop(page + 1) - top(), blockKind, unit.colspan);
    if (unit.parity !== null && (page + 1) % 2 !== unit.parity) addBreak(unit.breakPos, pageSpan, blockKind, unit.colspan);

    const next = units[index + 1];
    const nextEl = next ? view.nodeDOM(next.pos) : null;
    const nextMin = unit.keepNext && nextEl instanceof HTMLElement ? Math.min(nextEl.getBoundingClientRect().height / z, KEEP_NEXT_MIN) : 0;

    if (bottom() + nextMin > limit() && top() > contentTop(page) + 2) {
      const split = unit.kind === 'text' && !unit.keepNext ? findSplit(view, unit, limit(), yOf) : null;
      if (split) addBreak(split.pos, contentTop(page + 1) - split.lineTop, 'inline');
      else addBreak(unit.breakPos, contentTop(page + 1) - top(), blockKind, unit.colspan);
    }

    let guard = 0;
    while (unit.kind === 'text' && bottom() > limit() && guard++ < 64) {
      const split = findSplit(view, unit, limit(), yOf);
      if (!split) break;
      addBreak(split.pos, contentTop(page + 1) - split.lineTop, 'inline');
    }

    const overflow = Math.floor(bottom() / pageSpan);
    if (overflow > page) {
      page = overflow;
      notes[page] = notes[page] ?? [];
      pageUnits[page] = pageUnits[page] ?? [];
    }
    pageBottom[page] = Math.max(pageBottom[page] ?? 0, bottom());
    if (unit.pos === unit.breakPos && unit.kind !== 'row') pageUnits[page].push(unit.breakPos);

    if (unit.notes.length) {
      reserve[page] = (reserve[page] ?? 0) + noteHeight + (reserve[page] ? 0 : FOOTNOTE_RULE_HEIGHT);
      for (const text of unit.notes) notes[page].push({ text, number: ++noteNumber });
    }
  }
  measurer.dispose();
  const pages = page + 1;
  for (let i = 0; i < pages; i++) notes[i] = notes[i] ?? [];
  const extras: PageExtra[] = [];
  const align = config.verticalAlign ?? 'top';
  if (align !== 'top') {
    for (let i = 0; i < pages; i++) {
      const bottomEdge = pageBottom[i];
      if (bottomEdge === undefined) continue;
      const leftover = contentBottom(i) - (reserve[i] ?? 0) - bottomEdge;
      if (leftover <= 1) continue;
      if (align === 'justify') {
        const starts = pageUnits[i] ?? [];
        if (i === pages - 1 || starts.length < 2 || leftover > config.pageHeight * JUSTIFY_MAX_RATIO) continue;
        const gap = leftover / (starts.length - 1);
        for (const pos of starts.slice(1)) extras.push({ pos, height: gap });
        continue;
      }
      const lead = align === 'center' ? leftover / 2 : leftover;
      if (i === 0) {
        const first = pageUnits[0]?.[0];
        if (first !== undefined) extras.push({ pos: first, height: lead });
      } else if (breakOfPage[i] !== undefined) {
        const entry = breaks[breakOfPage[i]];
        extras.push({ pos: entry.pos, height: lead, inline: entry.kind === 'inline' });
      }
    }
  }
  extras.sort((a, b) => a.pos - b.pos);
  return { pages, breaks, notes, extras };
}

const sameBreaks = (a: PageBreakInfo[], b: PageBreakInfo[]) => a.length === b.length && a.every((item, i) => item.pos === b[i].pos && item.kind === b[i].kind && Math.abs(item.height - b[i].height) < 1);
const sameExtras = (a: PageExtra[], b: PageExtra[]) => a.length === b.length && a.every((item, i) => item.pos === b[i].pos && Math.abs(item.height - b[i].height) < 1);

function spacerNode(info: PageBreakInfo) {
  const height = `calc(${(info.height - PAGE_GAP).toFixed(2)}px + var(--page-gap))`;
  if (info.kind === 'row') {
    const row = document.createElement('tr');
    row.className = 'page-spacer-row';
    const cell = document.createElement('td');
    cell.colSpan = info.colspan;
    cell.style.height = height;
    row.appendChild(cell);
    return row;
  }
  const el = document.createElement(info.kind === 'inline' ? 'span' : 'div');
  el.className = info.kind === 'inline' ? 'page-spacer page-spacer-inline' : 'page-spacer';
  el.style.height = height;
  return el;
}

const extraNode = (info: PageExtra) => {
  const el = document.createElement(info.inline ? 'span' : 'div');
  el.className = 'page-extra-gap';
  el.style.height = `${info.height.toFixed(2)}px`;
  return el;
};

const buildSet = (doc: PMNode, breaks: PageBreakInfo[], extras: PageExtra[]) => DecorationSet.create(doc, [
  ...breaks.map((info) => Decoration.widget(info.pos, () => spacerNode(info), {
    side: -1,
    ignoreSelection: true,
    key: `page-${info.kind}-${info.height.toFixed(1)}`,
    ...(info.kind === 'inline' ? { marks: [] } : {}),
  })),
  ...extras.map((info) => Decoration.widget(info.pos, () => extraNode(info), { side: 0, ignoreSelection: true, key: `extra-${info.height.toFixed(1)}`, ...(info.inline ? { marks: [] } : {}) })),
]);

export const Pagination = Extension.create<Record<string, never>, PaginationStorage>({
  name: 'pagination',
  addStorage() {
    return { config: null, result: EMPTY, listeners: new Set(), refresh: () => undefined, runNow: () => undefined };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin<PluginStateValue>({
      key,
      state: {
        init: () => ({ breaks: [], extras: [], set: DecorationSet.empty }),
        apply(tr, value) {
          const next = tr.getMeta(key) as LayoutMeta | undefined;
          if (next) return { ...next, set: buildSet(tr.doc, next.breaks, next.extras) };
          if (!tr.docChanged) return value;
          return {
            breaks: value.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos) })),
            extras: value.extras.map((b) => ({ ...b, pos: tr.mapping.map(b.pos) })),
            set: value.set.map(tr.mapping, tr.doc),
          };
        },
      },
      props: {
        decorations(state) {
          return key.getState(state)?.set ?? null;
        },
      },
      view(editorView) {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const publish = (result: PaginationResult) => {
          const before = storage.result;
          storage.result = result;
          if (before.pages !== result.pages || !sameBreaks(before.breaks, result.breaks) || JSON.stringify(before.notes) !== JSON.stringify(result.notes)) {
            storage.listeners.forEach((listener) => listener(result));
          }
        };
        const schedule = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(run, SCHEDULE_MS);
        };
        const run = () => {
          timer = null;
          if (editorView.isDestroyed) return;
          if (editorView.composing) {
            schedule();
            return;
          }
          const config = storage.config;
          const applied = key.getState(editorView.state);
          if (!config) {
            if (applied?.breaks.length || applied?.extras.length) editorView.dispatch(editorView.state.tr.setMeta(key, { breaks: [], extras: [] }).setMeta('addToHistory', false));
            publish(EMPTY);
            return;
          }
          let result = EMPTY;
          for (let pass = 0; pass < MAX_PASSES; pass++) {
            const state = key.getState(editorView.state);
            const current = state?.breaks ?? [];
            const currentExtras = state?.extras ?? [];
            result = computeLayout(editorView, config, current, currentExtras);
            if (sameBreaks(result.breaks, current) && sameExtras(result.extras, currentExtras)) break;
            editorView.dispatch(editorView.state.tr.setMeta(key, { breaks: result.breaks, extras: result.extras }).setMeta('addToHistory', false));
          }
          publish(result);
        };
        storage.refresh = schedule;
        storage.runNow = run;
        const observer = new ResizeObserver(schedule);
        observer.observe(editorView.dom);
        editorView.dom.addEventListener('load', schedule, true);
        document.fonts?.addEventListener?.('loadingdone', schedule);
        schedule();
        return {
          update(view, prev) {
            if (!prev.doc.eq(view.state.doc)) schedule();
          },
          destroy() {
            if (timer) clearTimeout(timer);
            observer.disconnect();
            editorView.dom.removeEventListener('load', schedule, true);
            document.fonts?.removeEventListener?.('loadingdone', schedule);
          },
        };
      },
    })];
  },
});
