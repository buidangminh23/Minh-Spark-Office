import { Extension, Node, mergeAttributes, type AnyExtension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { AddMarkStep, RemoveMarkStep } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { AuthorityList, formatNote, getRefs } from './extensionsExtra';
import { getPagination, pageAtPos } from './pagination';
import { FormatChangeMark } from './trackChanges';
import { FLATTEN_EXTRA } from './docFlattenExtra';
import { NODE_EDITORS } from './nodeEditors';
import { AUTHORITY_CATEGORIES } from './refsActions';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    authorityEntry: { insertAuthorityEntry: (attrs: { text: string; short: string; category: string }) => ReturnType };
  }
}

const BLOCK_TYPES = ['paragraph', 'heading'];
export const LOCK_META = 'paragraphLockEdit';
const noteKey = new PluginKey<DecorationSet>('noteNumbering');
const lockKey = new PluginKey('paragraphLock');

const ReviewAttributes = Extension.create({
  name: 'reviewAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          tocHide: {
            default: false,
            parseHTML: (element: HTMLElement) => element.hasAttribute('data-toc-hide'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.tocHide ? { 'data-toc-hide': 'true' } : {}),
          },
        },
      },
      {
        types: BLOCK_TYPES,
        attributes: {
          captionFormat: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-caption-format'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.captionFormat ? { 'data-caption-format': attributes.captionFormat } : {}),
          },
          proofLang: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-proof-lang'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.proofLang ? { 'data-proof-lang': attributes.proofLang, lang: attributes.proofLang } : {}),
          },
          noProof: {
            default: false,
            parseHTML: (element: HTMLElement) => element.hasAttribute('data-no-proof'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.noProof ? { 'data-no-proof': 'true', spellcheck: 'false' } : {}),
          },
          locked: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-locked'),
            renderHTML: (attributes: Record<string, unknown>) => (attributes.locked ? { 'data-locked': attributes.locked, title: `Đoạn đã khoá bởi ${attributes.locked}` } : {}),
          },
        },
      },
    ];
  },
});

const AuthorityEntry = Node.create({
  name: 'authorityEntry',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    const attr = (name: string, fallback: string) => ({
      default: fallback,
      parseHTML: (element: HTMLElement) => element.getAttribute(`data-toa-${name}`) ?? fallback,
      renderHTML: (attributes: Record<string, unknown>) => ({ [`data-toa-${name}`]: attributes[name] }),
    });
    return { text: attr('text', ''), short: attr('short', ''), category: attr('category', 'Khác') };
  },
  parseHTML() {
    return [{ tag: 'span[data-toa-text]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-toa-mark', title: `Viện dẫn: ${node.attrs.text}` })];
  },
  renderText() {
    return '';
  },
  addCommands() {
    return { insertAuthorityEntry: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }) };
  },
});

function noteDecorations(editor: Editor, doc: PMNode) {
  const refs = (editor.storage as unknown as { docRefs?: ReturnType<typeof getRefs> }).docRefs;
  const settings = refs?.notes ?? { foot: 'decimal' as const, start: 1, restart: 'continuous' as const, end: 'lower-roman' as const };
  const decorations: Decoration[] = [];
  const perPage = new Map<number, number>();
  let foot = 0;
  let end = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'footnote') return true;
    if (node.attrs.kind === 'end') {
      end += 1;
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-note-label': formatNote(end, settings.end) }));
      return false;
    }
    foot += 1;
    let number = foot + settings.start - 1;
    if (settings.restart === 'page' && refs) {
      const page = pageAtPos(editor, pos);
      const next = (perPage.get(page) ?? 0) + 1;
      perPage.set(page, next);
      number = next;
    }
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-note-label': formatNote(number, settings.foot) }));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

const NoteNumbering = Extension.create({
  name: 'noteNumbering',
  addProseMirrorPlugins() {
    const { editor } = this;
    return [new Plugin<DecorationSet>({
      key: noteKey,
      state: {
        init: (_config, state) => noteDecorations(editor, state.doc),
        apply: (tr, value) => (tr.docChanged || tr.getMeta(noteKey) ? noteDecorations(editor, tr.doc) : value),
      },
      props: {
        decorations: (state) => noteKey.getState(state) ?? null,
      },
      view(view) {
        const refresh = () => {
          const refs = (editor.storage as unknown as { docRefs?: ReturnType<typeof getRefs> }).docRefs;
          if (refs?.notes.restart === 'page' && !view.isDestroyed) view.dispatch(view.state.tr.setMeta(noteKey, true).setMeta('addToHistory', false));
        };
        const pagination = getPagination(editor);
        pagination.listeners.add(refresh);
        return { destroy: () => { pagination.listeners.delete(refresh); } };
      },
    })];
  },
});

export const refreshNoteNumbers = (editor: Editor) => {
  editor.view.dispatch(editor.state.tr.setMeta(noteKey, true).setMeta('addToHistory', false));
};

const touchesLocked = (doc: PMNode, from: number, to: number) => {
  const size = doc.content.size;
  const start = Math.max(0, Math.min(from, size));
  const end = Math.max(start, Math.min(to, size));
  const $start = doc.resolve(start);
  for (let depth = $start.depth; depth > 0; depth--) {
    if ($start.node(depth).attrs.locked) return true;
  }
  let hit = false;
  if (end > start) {
    doc.nodesBetween(start, end, (node, pos) => {
      if (node.attrs?.locked && end > pos && start < pos + node.nodeSize) hit = true;
      return !hit;
    });
  }
  return hit;
};

const blockedByLock = (tr: Transaction) => {
  if (!tr.docChanged || tr.getMeta(LOCK_META)) return false;
  return tr.steps.some((step, index) => {
    const doc = tr.docs[index];
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
      return !['comment', 'insertion', 'deletion', 'formatChange'].includes(step.mark.type.name) && touchesLocked(doc, step.from, step.to);
    }
    let blocked = false;
    step.getMap().forEach((oldStart, oldEnd) => {
      if (oldStart === 0 && oldEnd === doc.content.size) return;
      if (touchesLocked(doc, oldStart, oldEnd)) blocked = true;
    });
    return blocked;
  });
};

const ParagraphLock = Extension.create({
  name: 'paragraphLock',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: lockKey,
      filterTransaction: (tr) => !blockedByLock(tr),
    })];
  },
});

FLATTEN_EXTRA.authorityEntry = () => [];

NODE_EDITORS.authorityEntry = (ctx, node, pos) => {
  void ctx.ui.ask({
    title: 'Sửa viện dẫn',
    fields: [
      { name: 'text', label: 'Tên đầy đủ', type: 'textarea', value: String(node.attrs.text) },
      { name: 'short', label: 'Tên rút gọn', value: String(node.attrs.short) },
      { name: 'category', label: 'Loại', type: 'select', value: String(node.attrs.category), options: AUTHORITY_CATEGORIES.map((value) => ({ value, label: value })) },
    ],
    confirmText: 'Lưu',
  }).then((res) => {
    if (res) ctx.editor.view.dispatch(ctx.editor.state.tr.setNodeMarkup(pos, undefined, { text: String(res.text), short: String(res.short), category: String(res.category) }));
  });
  return true;
};

export const REVIEW_EXTENSIONS: AnyExtension[] = [FormatChangeMark, ReviewAttributes, AuthorityEntry, AuthorityList, NoteNumbering, ParagraphLock];
