import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type MarkFlags = { spaces: boolean; tabs: boolean; breaks: boolean };

const key = new PluginKey<DecorationSet>('formattingMarks');
const REFRESH = 'formattingMarksRefresh';
const SPACE = /[  \t]/g;

function breakWidget() {
  const mark = document.createElement('span');
  mark.className = 'fm-break';
  mark.textContent = '↵';
  mark.setAttribute('aria-hidden', 'true');
  mark.contentEditable = 'false';
  return mark;
}

export function buildMarks(doc: PMNode, flags: MarkFlags) {
  if (!flags.spaces && !flags.tabs && !flags.breaks) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'hardBreak' && flags.breaks) {
      decorations.push(Decoration.widget(pos, breakWidget, { side: -1, key: 'fm-break' }));
      return false;
    }
    if (!node.isText || !node.text) return true;
    for (const match of node.text.matchAll(SPACE)) {
      const isTab = match[0] === '\t';
      if (isTab ? !flags.tabs : !flags.spaces) continue;
      const from = pos + (match.index ?? 0);
      decorations.push(Decoration.inline(from, from + 1, { class: isTab ? 'fm-tab' : 'fm-space' }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

export const FormattingMarks = Extension.create<Record<string, never>, { flags: MarkFlags }>({
  name: 'formattingMarks',
  addStorage() {
    return { flags: { spaces: false, tabs: false, breaks: false } };
  },
  addCommands() {
    return {
      setFormattingMarks: (flags: MarkFlags) => ({ tr, dispatch }) => {
        this.storage.flags = flags;
        if (dispatch) dispatch(tr.setMeta(REFRESH, true).setMeta('addToHistory', false));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => buildMarks(state.doc, storage.flags),
        apply: (tr, value, _old, state) => (tr.docChanged || tr.getMeta(REFRESH) ? buildMarks(state.doc, storage.flags) : value),
      },
      props: {
        decorations: (state) => key.getState(state),
      },
    })];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formattingMarks: {
      setFormattingMarks: (flags: MarkFlags) => ReturnType;
    };
  }
}
