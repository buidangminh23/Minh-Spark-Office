import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableCell, TableHeader } from '@tiptap/extension-table';
import { NodeSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setLineHeight: (value: number | null) => ReturnType;
      setParagraphSpacing: (before: number | null, after: number | null) => ReturnType;
      setIndentLevel: (value: number) => ReturnType;
      setParagraphIndent: (value: { left?: number; right?: number; firstLine?: number }) => ReturnType;
      setParagraphAttrs: (patch: Record<string, unknown>) => ReturnType;
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
    fontSizeStep: {
      stepFontSize: (direction: 1 | -1) => ReturnType;
    };
    commentMark: {
      setComment: (commentId: string) => ReturnType;
      unsetCommentById: (commentId: string) => ReturnType;
    };
    footnote: {
      insertFootnote: (text: string, kind?: 'foot' | 'end') => ReturnType;
    };
    mergeField: {
      insertMergeField: (name: string) => ReturnType;
    };
    imageLayout: {
      setImageLayout: (attrs: { align?: string; width?: string | null; alt?: string; src?: string; frame?: string | null }) => ReturnType;
    };
  }
}

const TYPES = ['paragraph', 'heading'];
export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
export const DEFAULT_FONT_SIZE = 12;

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  priority: 1000,
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
        indentRight: {
          default: 0,
          parseHTML: (element) => parseFloat(element.style.marginRight) || 0,
          renderHTML: (attributes) => (attributes.indentRight ? { style: `margin-right: ${attributes.indentRight}px` } : {}),
        },
        firstLine: {
          default: 0,
          parseHTML: (element) => parseFloat(element.style.textIndent) || 0,
          renderHTML: (attributes) => (attributes.firstLine ? { style: `text-indent: ${attributes.firstLine}px` } : {}),
        },
        styleId: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-style'),
          renderHTML: (attributes) => (attributes.styleId ? { 'data-style': attributes.styleId } : {}),
        },
        keepNext: {
          default: false,
          parseHTML: (element) => element.hasAttribute('data-keep-next'),
          renderHTML: (attributes) => (attributes.keepNext ? { 'data-keep-next': 'true' } : {}),
        },
        pageBreakBefore: {
          default: false,
          parseHTML: (element) => element.hasAttribute('data-break-before'),
          renderHTML: (attributes) => (attributes.pageBreakBefore ? { 'data-break-before': 'true' } : {}),
        },
        dropCap: {
          default: false,
          parseHTML: (element) => element.hasAttribute('data-dropcap'),
          renderHTML: (attributes) => (attributes.dropCap ? { 'data-dropcap': 'true' } : {}),
        },
        captionKind: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-caption'),
          renderHTML: (attributes) => (attributes.captionKind ? { 'data-caption': attributes.captionKind } : {}),
        },
        shading: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-shading'),
          renderHTML: (attributes) => (attributes.shading ? { 'data-shading': attributes.shading, style: `background-color: ${attributes.shading}; padding: 2px 4px` } : {}),
        },
        borderSides: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-border-sides'),
          renderHTML: (attributes) => {
            if (!attributes.borderSides) return {};
            const line = `${attributes.borderWidth ?? 1}px ${attributes.borderStyle ?? 'solid'} ${attributes.borderColor ?? '#334155'}`;
            const sides = String(attributes.borderSides) === 'box' ? ['top', 'right', 'bottom', 'left'] : String(attributes.borderSides).split(',');
            return { 'data-border-sides': attributes.borderSides, style: `${sides.map((side) => `border-${side}: ${line}`).join('; ')}; padding: 4px 8px` };
          },
        },
        borderStyle: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-border-style'),
          renderHTML: (attributes) => (attributes.borderStyle ? { 'data-border-style': attributes.borderStyle } : {}),
        },
        borderColor: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-border-color'),
          renderHTML: (attributes) => (attributes.borderColor ? { 'data-border-color': attributes.borderColor } : {}),
        },
        borderWidth: {
          default: null,
          parseHTML: (element) => Number(element.getAttribute('data-border-width')) || null,
          renderHTML: (attributes) => (attributes.borderWidth ? { 'data-border-width': attributes.borderWidth } : {}),
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
      setIndentLevel: (value) => updateEach(() => ({ indent: Math.max(0, Math.min(16, value)) })),
      setParagraphIndent: ({ left, right, firstLine }) => updateEach((attrs) => ({
        indent: left === undefined ? attrs.indent : Math.max(0, left / 48),
        indentRight: right === undefined ? attrs.indentRight : Math.max(0, right),
        firstLine: firstLine === undefined ? attrs.firstLine : firstLine,
      })),
      setParagraphAttrs: (patch) => updateEach(() => patch),
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
        return this.editor.commands.insertContent('    ');
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table')) return false;
        return this.editor.commands.decreaseIndent();
      },
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
      'Mod-]': () => this.editor.commands.stepFontSize(1),
      'Mod-[': () => this.editor.commands.stepFontSize(-1),
      'Mod-Shift-.': () => this.editor.commands.stepFontSize(1),
      'Mod-Shift-,': () => this.editor.commands.stepFontSize(-1),
      'Mod-e': () => this.editor.commands.setTextAlign('center'),
      'Mod-l': () => this.editor.commands.setTextAlign('left'),
      'Mod-r': () => this.editor.commands.setTextAlign('right'),
      'Mod-j': () => this.editor.commands.setTextAlign('justify'),
      'Mod-Shift-e': () => true,
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
    };
  },
});

export const FontSizeStep = Extension.create({
  name: 'fontSizeStep',
  addCommands() {
    return {
      stepFontSize: (direction) => ({ editor, chain }) => {
        const raw = String(editor.getAttributes('textStyle').fontSize ?? '');
        const current = parseFloat(raw) * (raw.endsWith('px') ? 0.75 : 1) || DEFAULT_FONT_SIZE;
        const next = direction > 0
          ? FONT_SIZES.find((size) => size > current) ?? current + 4
          : [...FONT_SIZES].reverse().find((size) => size < current) ?? Math.max(1, current - 1);
        return chain().setFontSize(`${next}pt`).run();
      },
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

export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => ({ 'data-comment-id': attributes.commentId }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-anchor' }), 0];
  },
  addCommands() {
    return {
      setComment: (commentId) => ({ commands }) => commands.setMark(this.name, { commentId }),
      unsetCommentById: (commentId) => ({ tr, state, dispatch }) => {
        const type = state.schema.marks[this.name];
        state.doc.descendants((node, pos) => {
          node.marks.forEach((mark) => {
            if (mark.type === type && mark.attrs.commentId === commentId) tr.removeMark(pos, pos + node.nodeSize, mark);
          });
        });
        if (dispatch) dispatch(tr);
        return true;
      },
    };
  },
});

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-footnote') ?? '',
        renderHTML: (attributes) => ({ 'data-footnote': attributes.text, title: attributes.text }),
      },
      kind: {
        default: 'foot',
        parseHTML: (element) => element.getAttribute('data-kind') ?? 'foot',
        renderHTML: (attributes) => ({ 'data-kind': attributes.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'footnote-ref' })];
  },
  renderText() {
    return '';
  },
  addCommands() {
    return {
      insertFootnote: (text, kind = 'foot') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { text, kind } }),
    };
  },
});

export const MergeField = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-merge-field') ?? '',
        renderHTML: (attributes) => ({ 'data-merge-field': attributes.name }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-merge-field]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'merge-field' }), `«${node.attrs.name}»`];
  },
  renderText({ node }) {
    return `«${node.attrs.name}»`;
  },
  addCommands() {
    return {
      insertMergeField: (name) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { name } }),
    };
  },
});

export const LayoutImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      frame: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-frame'),
        renderHTML: (attributes) => (attributes.frame ? { 'data-frame': attributes.frame } : {}),
      },
      align: {
        default: 'inline',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'inline',
        renderHTML: (attributes) => ({ 'data-align': attributes.align }),
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width') ?? element.style.width ?? null,
        renderHTML: (attributes) => (attributes.width ? { style: `width: ${attributes.width}` } : {}),
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setImageLayout: (attrs) => ({ commands, tr, dispatch }) => {
        const { selection } = tr;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return commands.updateAttributes('image', attrs);
        if (dispatch) {
          const { from, node } = selection;
          tr.setNodeMarkup(from, undefined, { ...node.attrs, ...attrs });
          tr.setSelection(NodeSelection.create(tr.doc, from));
        }
        return true;
      },
    };
  },
});

const cellBackground = {
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) => element.style.backgroundColor || element.getAttribute('data-background') || null,
    renderHTML: (attributes: Record<string, unknown>) => (attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {}),
  },
};

export const ShadedTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});

export const ShadedTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});
