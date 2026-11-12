import { Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { blockLabel, previewTexts, type BlockKind, type MergeSource } from './mailMerge';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeBlock: {
      insertMergeBlock: (kind: BlockKind, options?: object) => ReturnType;
      setMergePreview: (source: MergeSource | null, index: number | null, answers?: Record<string, string>) => ReturnType;
    };
  }
}

type PreviewState = { source: MergeSource | null; index: number | null; answers: Record<string, string>; decorations: DecorationSet };

export const mergePreviewKey = new PluginKey<PreviewState>('mergePreview');

const buildDecorations = (doc: PMNode, source: MergeSource | null, index: number | null, answers: Record<string, string>) => {
  if (!source || index === null) return DecorationSet.empty;
  const values = previewTexts(doc.toJSON(), source, index, answers);
  const decorations: Decoration[] = [];
  let cursor = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === 'mergeField' || node.type.name === 'mergeBlock') {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-preview': values[cursor++] ?? '' }));
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
};

export const MergeBlock = Node.create({
  name: 'mergeBlock',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: {
        default: 'next',
        parseHTML: (element) => element.getAttribute('data-merge-block') ?? 'next',
        renderHTML: (attributes) => ({ 'data-merge-block': attributes.kind }),
      },
      options: {
        default: '{}',
        parseHTML: (element) => element.getAttribute('data-merge-options') ?? '{}',
        renderHTML: (attributes) => ({ 'data-merge-options': attributes.options }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-merge-block]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: `merge-field merge-block merge-block-${node.attrs.kind}` }), `«${blockLabel(node.attrs.kind as BlockKind, String(node.attrs.options))}»`];
  },
  renderText({ node }) {
    return `«${blockLabel(node.attrs.kind as BlockKind, String(node.attrs.options))}»`;
  },
  addCommands() {
    return {
      insertMergeBlock: (kind, options = {}) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { kind, options: JSON.stringify(options) } }),
      setMergePreview: (source, index, answers = {}) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(mergePreviewKey, { source, index, answers }).setMeta('addToHistory', false));
        return true;
      },
    };
  },
});

export const MergePreview = Extension.create({
  name: 'mergePreview',
  addProseMirrorPlugins() {
    return [new Plugin<PreviewState>({
      key: mergePreviewKey,
      state: {
        init: () => ({ source: null, index: null, answers: {}, decorations: DecorationSet.empty }),
        apply(tr, previous, _old, state) {
          const meta = tr.getMeta(mergePreviewKey) as Partial<PreviewState> | undefined;
          if (!meta && !tr.docChanged) return previous;
          const next = { ...previous, ...meta };
          return { ...next, decorations: buildDecorations(state.doc, next.source, next.index, next.answers) };
        },
      },
      props: {
        decorations: (state) => mergePreviewKey.getState(state)?.decorations ?? null,
      },
    })];
  },
});

export const MAILING_EXTENSIONS = [MergeBlock, MergePreview];
