import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import type { Mark as PMMark, MarkType, Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from '@tiptap/pm/transform';
import { ANONYMOUS_AUTHOR } from '../../lib/currentAuthor';

export type TrackedChange = { id: string; kind: 'insertion' | 'deletion' | 'format'; from: number; to: number; text: string; author: string; date: number; label?: string };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      setTrackChanges: (enabled: boolean) => ReturnType;
      acceptChange: (range: { from: number; to: number }) => ReturnType;
      rejectChange: (range: { from: number; to: number }) => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
    };
  }
}

const trackKey = new PluginKey('trackChanges');
export const SKIP_META = 'trackChangesSkip';
const UNTRACKED_MARKS = new Set(['insertion', 'deletion', 'formatChange', 'comment']);
type FormatOp = { op: 'add' | 'remove'; mark: Record<string, unknown> };
const FORMAT_LABELS: Record<string, string> = { bold: 'Đậm', italic: 'Nghiêng', underline: 'Gạch chân', strike: 'Gạch ngang', subscript: 'Chỉ số dưới', superscript: 'Chỉ số trên', textStyle: 'Phông, cỡ hoặc màu chữ', highlight: 'Tô sáng', code: 'Mã', link: 'Liên kết' };

const parseOps = (raw: unknown): FormatOp[] => {
  try {
    return JSON.parse(String(raw || '[]')) as FormatOp[];
  } catch {
    return [];
  }
};

export const formatChangeLabel = (raw: unknown) => {
  const names = [...new Set(parseOps(raw).map((op) => FORMAT_LABELS[String(op.mark.type)] ?? String(op.mark.type)))];
  return names.length ? `Định dạng: ${names.join(', ')}` : 'Định dạng';
};

const changeMark = (name: 'insertion' | 'deletion', tag: 'ins' | 'del') => Mark.create({
  name,
  inclusive: false,
  excludes: 'insertion deletion',
  addAttributes() {
    return {
      author: { default: '', parseHTML: (el) => el.getAttribute('data-author') ?? '', renderHTML: (a) => ({ 'data-author': a.author }) },
      date: { default: 0, parseHTML: (el) => Number(el.getAttribute('data-date')) || 0, renderHTML: (a) => ({ 'data-date': a.date }) },
    };
  },
  parseHTML() {
    return [{ tag: tag }];
  },
  renderHTML({ HTMLAttributes }) {
    return [tag, mergeAttributes(HTMLAttributes, { class: `track-${name}` }), 0];
  },
});

export const InsertionMark = changeMark('insertion', 'ins');
export const DeletionMark = changeMark('deletion', 'del');

export const FormatChangeMark = Mark.create({
  name: 'formatChange',
  inclusive: false,
  addAttributes() {
    return {
      author: { default: '', parseHTML: (el) => el.getAttribute('data-author') ?? '', renderHTML: (a) => ({ 'data-author': a.author }) },
      date: { default: 0, parseHTML: (el) => Number(el.getAttribute('data-date')) || 0, renderHTML: (a) => ({ 'data-date': a.date }) },
      ops: { default: '[]', parseHTML: (el) => el.getAttribute('data-ops') ?? '[]', renderHTML: (a) => ({ 'data-ops': a.ops, title: formatChangeLabel(a.ops) }) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-format-change]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-format-change': 'true', class: 'track-format' }), 0];
  },
});

const isInlineSlice = (doc: PMNode, from: number, to: number) => doc.resolve(from).sameParent(doc.resolve(to));

const stripMarkFromSlice = (doc: PMNode, from: number, to: number, insertion: MarkType) => {
  const nodes: PMNode[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return true;
    if (node.marks.some((mark) => mark.type === insertion)) return false;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    nodes.push(node.isText ? node.cut(start - pos, end - pos) : node);
    return false;
  });
  return nodes;
};

const trackTransaction = (tr: Transaction, oldState: EditorState, newState: EditorState, author: string, key: string | null = null) => {
  const schema = newState.schema;
  const insertion = schema.marks.insertion;
  const deletion = schema.marks.deletion;
  const out = newState.tr;
  const stamp = { author, date: Date.now() };
  let changed = false;
  let caret: number | null = null;
  tr.steps.forEach((step, index) => {
    const later = tr.mapping.slice(index + 1);
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      const formatType = schema.marks.formatChange;
      if (!formatType || UNTRACKED_MARKS.has(step.mark.type.name)) return;
      const from = out.mapping.map(later.map(step.from, 1), 1);
      const to = out.mapping.map(later.map(step.to, -1), -1);
      if (to <= from) return;
      const op: FormatOp = { op: step instanceof AddMarkStep ? 'add' : 'remove', mark: step.mark.toJSON() as Record<string, unknown> };
      const targets: { start: number; end: number; ops: FormatOp[] }[] = [];
      out.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isInline) return true;
        if (node.marks.some((mark) => mark.type === insertion)) return false;
        const existing = node.marks.find((mark) => mark.type === formatType);
        targets.push({ start: Math.max(from, pos), end: Math.min(to, pos + node.nodeSize), ops: [...parseOps(existing?.attrs.ops), op] });
        return false;
      });
      targets.forEach((target) => out.addMark(target.start, target.end, formatType.create({ ...stamp, ops: JSON.stringify(target.ops) })));
      if (targets.length) changed = true;
      return;
    }
    if (!(step instanceof ReplaceStep)) return;
    const before = tr.docs[index];
    step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
      const insFrom = out.mapping.map(later.map(newStart, -1), -1);
      const insTo = out.mapping.map(later.map(newEnd, 1), 1);
      if (insTo > insFrom) {
        out.removeMark(insFrom, insTo, deletion);
        const own = (node: PMNode | null | undefined) => node?.marks.find((mark) => mark.type === insertion && mark.attrs.author === author);
        const adjacent = own(out.doc.resolve(insFrom).nodeBefore) ?? own(out.doc.resolve(insTo).nodeAfter);
        out.addMark(insFrom, insTo, adjacent ?? insertion.create(stamp));
        changed = true;
      }
      if (oldEnd > oldStart && isInlineSlice(before, oldStart, oldEnd)) {
        const at = insFrom;
        const ownDeletion = (node: PMNode | null | undefined) => node?.marks.find((mark) => mark.type === deletion && mark.attrs.author === author);
        const $at = out.doc.resolve(at);
        const deletionMark = ownDeletion($at.nodeAfter) ?? ownDeletion($at.nodeBefore) ?? deletion.create(stamp);
        const nodes = stripMarkFromSlice(before, oldStart, oldEnd, insertion).map((node) => node.mark(deletionMark.addToSet(node.marks.filter((m: PMMark) => m.type !== insertion && m.type !== deletion))));
        if (!nodes.length) return;
        const size = nodes.reduce((sum, node) => sum + node.nodeSize, 0);
        out.insert(at, nodes);
        changed = true;
        const backward = key === 'Backspace' || (key !== 'Delete' && oldState.selection.head >= oldEnd);
        caret = backward && insTo === insFrom ? at : at + size + (insTo - insFrom);
      }
    });
  });
  if (!changed) return null;
  if (caret !== null) out.setSelection(TextSelection.create(out.doc, Math.min(caret, out.doc.content.size)));
  return out.setMeta(SKIP_META, true).setMeta('addToHistory', true);
};

const shouldSkip = (tr: Transaction) => tr.getMeta(SKIP_META) || tr.getMeta('history$') || tr.getMeta('preventTracking') || tr.getMeta('paste') === undefined && tr.steps.some((step) => step instanceof ReplaceStep && (step as ReplaceStep).from === 0 && (step as ReplaceStep).to === tr.docs[0].content.size);

const resolveRange = (state: EditorState, range: { from: number; to: number }, markName: string) => {
  const type = state.schema.marks[markName];
  const ranges: { from: number; to: number }[] = [];
  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (node.isInline && node.marks.some((mark) => mark.type === type)) ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  return ranges;
};

const applyResolution = (state: EditorState, tr: Transaction, range: { from: number; to: number }, accept: boolean) => {
  const keepMark = accept ? 'insertion' : 'deletion';
  const dropMark = accept ? 'deletion' : 'insertion';
  const drops = resolveRange(state, range, dropMark);
  const keeps = resolveRange(state, range, keepMark);
  keeps.forEach((r) => tr.removeMark(r.from, r.to, state.schema.marks[keepMark]));
  const formatType = state.schema.marks.formatChange;
  if (formatType) {
    resolveRange(state, range, 'formatChange').forEach((r) => {
      const mark = state.doc.nodeAt(r.from)?.marks.find((m) => m.type === formatType);
      if (!accept) {
        [...parseOps(mark?.attrs.ops)].reverse().forEach((op) => {
          const target = state.schema.markFromJSON(op.mark);
          if (op.op === 'add') tr.removeMark(r.from, r.to, target);
          else tr.addMark(r.from, r.to, target);
        });
      }
      tr.removeMark(r.from, r.to, formatType);
    });
  }
  [...drops].sort((a, b) => b.from - a.from).forEach((r) => tr.delete(tr.mapping.map(r.from), tr.mapping.map(r.to)));
  return tr.setMeta(SKIP_META, true);
};

export function collectChanges(doc: PMNode): TrackedChange[] {
  const changes: TrackedChange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    for (const kind of ['insertion', 'deletion', 'format'] as const) {
      const mark = node.marks.find((m) => m.type.name === (kind === 'format' ? 'formatChange' : kind));
      if (!mark) continue;
      const last = changes[changes.length - 1];
      if (last && last.kind === kind && last.to === pos && last.author === mark.attrs.author) {
        last.to = pos + node.nodeSize;
        last.text += node.textContent;
      } else {
        changes.push({ id: `${kind}-${pos}`, kind, from: pos, to: pos + node.nodeSize, text: node.textContent, author: String(mark.attrs.author), date: Number(mark.attrs.date), label: kind === 'format' ? formatChangeLabel(mark.attrs.ops) : undefined });
      }
    }
    return false;
  });
  return changes;
}

export const TrackChanges = Extension.create<{ author: string }, { enabled: boolean }>({
  name: 'trackChanges',
  addOptions() {
    return { author: ANONYMOUS_AUTHOR };
  },
  addStorage() {
    return { enabled: false };
  },
  addCommands() {
    return {
      setTrackChanges: (enabled) => () => {
        this.storage.enabled = enabled;
        return true;
      },
      acceptChange: (range) => ({ state, tr, dispatch }) => {
        if (dispatch) dispatch(applyResolution(state, tr, range, true));
        return true;
      },
      rejectChange: (range) => ({ state, tr, dispatch }) => {
        if (dispatch) dispatch(applyResolution(state, tr, range, false));
        return true;
      },
      acceptAllChanges: () => ({ state, tr, dispatch }) => {
        if (dispatch) dispatch(applyResolution(state, tr, { from: 0, to: state.doc.content.size }, true));
        return true;
      },
      rejectAllChanges: () => ({ state, tr, dispatch }) => {
        if (dispatch) dispatch(applyResolution(state, tr, { from: 0, to: state.doc.content.size }, false));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    const extension = this;
    let lastKey: { key: string; at: number } | null = null;
    return [new Plugin({
      key: trackKey,
      props: {
        handleDOMEvents: {
          keydown(_view, event) {
            lastKey = { key: event.key, at: Date.now() };
            return false;
          },
        },
      },
      appendTransaction(transactions, oldState, newState) {
        if (!extension.storage.enabled || transactions.length !== 1) return null;
        const [tr] = transactions;
        if (!tr.docChanged || shouldSkip(tr)) return null;
        const key = lastKey && Date.now() - lastKey.at < 1000 ? lastKey.key : null;
        lastKey = null;
        return trackTransaction(tr, oldState, newState, extension.options.author, key);
      },
    })];
  },
});
