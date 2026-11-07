import { Extension, type AnyExtension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    outlineView: {
      setOutlineView: (active: boolean, level: number) => ReturnType;
      toggleOutlineHeading: (pos: number) => ReturnType;
      setOutlineCollapsed: (collapsed: boolean) => ReturnType;
    };
  }
}

type OutlineState = { active: boolean; level: number; collapsed: Set<number> };
type OutlineMeta = { active?: boolean; level?: number; toggle?: number; all?: boolean };

const outlineKey = new PluginKey<OutlineState>('docOutlineView');

const outlineDecorations = (doc: import('@tiptap/pm/model').Node, state: OutlineState, onToggle: (pos: number) => void) => {
  if (!state.active) return DecorationSet.empty;
  const items: Decoration[] = [];
  let hideBelow = 0;
  doc.forEach((node, pos) => {
    const heading = node.type.name === 'heading';
    const level = heading ? Number(node.attrs.level) : 0;
    if (hideBelow && heading && level <= hideBelow) hideBelow = 0;
    const filtered = heading ? level > state.level : state.level < 9;
    if (hideBelow || filtered) {
      items.push(Decoration.node(pos, pos + node.nodeSize, { class: 'outline-hidden' }));
      return;
    }
    const collapsed = heading && state.collapsed.has(pos);
    items.push(Decoration.node(pos, pos + node.nodeSize, { class: `outline-row ${heading ? `outline-heading outline-l${level}` : 'outline-body'} ${collapsed ? 'outline-collapsed' : ''}` }));
    if (heading) {
      items.push(Decoration.widget(pos + 1, () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'outline-toggle';
        button.contentEditable = 'false';
        button.title = collapsed ? 'Mở rộng mục này' : 'Thu gọn mục này';
        button.setAttribute('aria-label', button.title);
        button.textContent = collapsed ? '+' : '−';
        button.addEventListener('mousedown', (event) => { event.preventDefault(); onToggle(pos); });
        return button;
      }, { side: -1, ignoreSelection: true, key: `toggle-${collapsed ? 'c' : 'o'}` }));
    }
    if (collapsed) hideBelow = level;
  });
  return DecorationSet.create(doc, items);
};

export const OutlineView = Extension.create({
  name: 'outlineView',
  addCommands() {
    return {
      setOutlineView: (active, level) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(outlineKey, { active, level } satisfies OutlineMeta).setMeta('addToHistory', false));
        return true;
      },
      toggleOutlineHeading: (pos) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(outlineKey, { toggle: pos } satisfies OutlineMeta).setMeta('addToHistory', false));
        return true;
      },
      setOutlineCollapsed: (collapsed) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(outlineKey, { all: collapsed } satisfies OutlineMeta).setMeta('addToHistory', false));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin<OutlineState>({
      key: outlineKey,
      state: {
        init: () => ({ active: false, level: 9, collapsed: new Set() }),
        apply(tr, value, _old, next) {
          const meta = tr.getMeta(outlineKey) as OutlineMeta | undefined;
          let collapsed = value.collapsed;
          if (tr.docChanged) collapsed = new Set([...collapsed].map((pos) => tr.mapping.map(pos)));
          if (!meta) return collapsed === value.collapsed ? value : { ...value, collapsed };
          if (meta.toggle !== undefined) {
            collapsed = new Set(collapsed);
            if (collapsed.has(meta.toggle)) collapsed.delete(meta.toggle);
            else collapsed.add(meta.toggle);
          }
          if (meta.all !== undefined) {
            collapsed = new Set();
            if (meta.all) next.doc.forEach((node, pos) => { if (node.type.name === 'heading') collapsed.add(pos); });
          }
          return { active: meta.active ?? value.active, level: meta.level ?? value.level, collapsed };
        },
      },
      props: {
        decorations(state) {
          const value = outlineKey.getState(state);
          return value ? outlineDecorations(state.doc, value, (pos) => editor.commands.toggleOutlineHeading(pos)) : null;
        },
      },
    })];
  },
});

export const AUTOCORRECT_KEY = 'minh-docs-autocorrect';
export type AutoCorrectEntry = { from: string; to: string };

export const loadAutoCorrect = (): AutoCorrectEntry[] => {
  try {
    const list = JSON.parse(localStorage.getItem(AUTOCORRECT_KEY) ?? '[]') as AutoCorrectEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const UserAutoCorrect = Extension.create<Record<string, never>, { entries: AutoCorrectEntry[] }>({
  name: 'userAutoCorrect',
  addStorage() {
    return { entries: loadAutoCorrect() };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    const editor = this.editor;
    return [new Plugin({
      key: new PluginKey('userAutoCorrect'),
      props: {
        handleTextInput(view, from, to, text) {
          const enabled = (editor.storage as unknown as { autoCorrect?: { enabled: boolean } }).autoCorrect?.enabled !== false;
          if (!enabled || !storage.entries.length || !/^[\s.,;:!?)]$/.test(text) || from !== to) return false;
          const $from = view.state.doc.resolve(from);
          if (!$from.parent.isTextblock) return false;
          const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
          const entry = storage.entries.find((item) => item.from && before.endsWith(item.from) && (before.length === item.from.length || /[\s(“"]/.test(before[before.length - item.from.length - 1])));
          if (!entry) return false;
          view.dispatch(view.state.tr.insertText(entry.to + text, from - entry.from.length, to));
          return true;
        },
      },
    })];
  },
});

export const VIEW_EXTENSIONS: AnyExtension[] = [OutlineView, UserAutoCorrect];
