import { Extension, Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setLineHeight: (value: number | null) => ReturnType;
      setParagraphSpacing: (before: number | null, after: number | null) => ReturnType;
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

const TYPES = ['paragraph', 'heading'];

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [{
      types: TYPES,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element) => {
            const value = element.style.lineHeight;
            const number = parseFloat(value);
            return Number.isFinite(number) && !value.endsWith('px') ? number : null;
          },
          renderHTML: (attributes) => (attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {}),
        },
        indent: {
          default: 0,
          parseHTML: (element) => Number(element.getAttribute('data-indent')) || 0,
          renderHTML: (attributes) => (attributes.indent ? { 'data-indent': attributes.indent, style: `margin-left: ${attributes.indent * 48}px` } : {}),
        },
        spaceBefore: {
          default: null,
          parseHTML: (element) => (element.style.marginTop ? parseFloat(element.style.marginTop) * 0.75 : null),
          renderHTML: (attributes) => (attributes.spaceBefore !== null && attributes.spaceBefore !== undefined ? { style: `margin-top: ${attributes.spaceBefore / 0.75}px` } : {}),
        },
        spaceAfter: {
          default: null,
          parseHTML: (element) => (element.style.marginBottom ? parseFloat(element.style.marginBottom) * 0.75 : null),
          renderHTML: (attributes) => (attributes.spaceAfter !== null && attributes.spaceAfter !== undefined ? { style: `margin-bottom: ${attributes.spaceAfter / 0.75}px` } : {}),
        },
      },
    }];
  },
  addCommands() {
    const updateEach = (callback: (attrs: Record<string, unknown>) => Record<string, unknown>) => ({ tr, state, dispatch }: { tr: import('@tiptap/pm/state').Transaction; state: import('@tiptap/pm/state').EditorState; dispatch?: unknown }) => {
      const { from, to } = state.selection;
      state.doc.nodesBetween(from, to, (node, position) => {
        if (TYPES.includes(node.type.name)) tr.setNodeMarkup(position, undefined, { ...node.attrs, ...callback(node.attrs) });
      });
      return Boolean(dispatch) || true;
    };
    return {
      setLineHeight: (value) => updateEach(() => ({ lineHeight: value })),
      setParagraphSpacing: (before, after) => updateEach(() => ({ spaceBefore: before, spaceAfter: after })),
      increaseIndent: () => ({ editor, commands, ...props }) => {
        if (editor.isActive('listItem') && commands.sinkListItem('listItem')) return true;
        if (editor.isActive('taskItem') && commands.sinkListItem('taskItem')) return true;
        return updateEach((attrs) => ({ indent: Math.min(8, (Number(attrs.indent) || 0) + 1) }))(props as never);
      },
      decreaseIndent: () => ({ editor, commands, ...props }) => {
        if (editor.isActive('listItem') && commands.liftListItem('listItem')) return true;
        if (editor.isActive('taskItem') && commands.liftListItem('taskItem')) return true;
        return updateEach((attrs) => ({ indent: Math.max(0, (Number(attrs.indent) || 0) - 1) }))(props as never);
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('table')) return false;
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) return this.editor.commands.increaseIndent();
        return this.editor.commands.insertContent('\u00a0\u00a0\u00a0\u00a0');
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table')) return false;
        return this.editor.commands.decreaseIndent();
      },
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }, { tag: 'hr[data-page-break]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'page-break' })];
  },
  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) => chain().insertContent({ type: this.name }).createParagraphNear().run(),
    };
  },
});
