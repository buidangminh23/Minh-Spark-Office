import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import type { Mark as PMMark, MarkType, Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

export type TrackedChange = { id: string; kind: 'insertion' | 'deletion'; from: number; to: number; text: string; author: string; date: number };

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
const SKIP_META = 'trackChangesSkip';

const changeMark = (name: 'insertion' | 'deletion', tag: 'ins' | 'del') => Mark.create({
  name,
  inclusive: false,
  excludes: name === 'insertion' ? 'deletion' : 'insertion',
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

const trackTransaction = (tr: Transaction, oldState: EditorState, newState: EditorState, author: string) => {
  const schema = newState.schema;
  const insertion = schema.marks.insertion;
  const deletion = schema.marks.deletion;
  const out = newState.tr;
  const stamp = { author, date: Date.now() };
  let changed = false;
  let caret: number | null = null;
  tr.steps.forEach((step, index) => {
    if (!(step instanceof ReplaceStep)) return;
    const before = tr.docs[index];
    const later = tr.mapping.slice(index + 1);
    step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
      const insFrom = out.mapping.map(later.map(newStart, -1), -1);
      const insTo = out.mapping.map(later.map(newEnd, 1), 1);
      if (insTo > insFrom) {
        out.removeMark(insFrom, insTo, deletion);
        out.addMark(insFrom, insTo, insertion.create(stamp));
        changed = true;
      }
      if (oldEnd > oldStart && isInlineSlice(before, oldStart, oldEnd)) {
        const nodes = stripMarkFromSlice(before, oldStart, oldEnd, insertion).map((node) => node.mark(deletion.create(stamp).addToSet(node.marks.filter((m: PMMark) => m.type !== insertion))));
        if (!nodes.length) return;
        const at = insFrom;
        const size = nodes.reduce((sum, node) => sum + node.nodeSize, 0);
        out.insert(at, nodes);
        changed = true;
        const head = oldState.selection.head;
        caret = head >= oldEnd && insTo === insFrom ? at : at + size + (insTo - insFrom);
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
  [...drops].sort((a, b) => b.from - a.from).forEach((r) => tr.delete(tr.mapping.map(r.from), tr.mapping.map(r.to)));
  return tr.setMeta(SKIP_META, true);
};

export function collectChanges(doc: PMNode): TrackedChange[] {
  const changes: TrackedChange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    for (const kind of ['insertion', 'deletion'] as const) {
      const mark = node.marks.find((m) => m.type.name === kind);
      if (!mark) continue;
      const last = changes[changes.length - 1];
      if (last && last.kind === kind && last.to === pos && last.author === mark.attrs.author) {
        last.to = pos + node.nodeSize;
        last.text += node.textContent;
      } else {
        changes.push({ id: `${kind}-${pos}`, kind, from: pos, to: pos + node.nodeSize, text: node.textContent, author: String(mark.attrs.author), date: Number(mark.attrs.date) });
      }
    }
    return false;
  });
  return changes;
}

export const TrackChanges = Extension.create<{ author: string }, { enabled: boolean }>({
  name: 'trackChanges',
  addOptions() {
    return { author: 'Minh Spark' };
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
    return [new Plugin({
      key: trackKey,
      appendTransaction(transactions, oldState, newState) {
        if (!extension.storage.enabled || transactions.length !== 1) return null;
        const [tr] = transactions;
        if (!tr.docChanged || shouldSkip(tr)) return null;
        return trackTransaction(tr, oldState, newState, extension.options.author);
      },
    })];
  },
});
