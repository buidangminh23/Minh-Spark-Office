import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableCell, TableHeader } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setLineHeight: (value: number | null) => ReturnType;
      setParagraphSpacing: (before: number | null, after: number | null) => ReturnType;
      setIndentLevel: (value: number) => ReturnType;
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
      insertFootnote: (text: string) => ReturnType;
    };
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
    };
    mergeField: {
      insertMergeField: (name: string) => ReturnType;
    };
    imageLayout: {
      setImageLayout: (attrs: { align?: string; width?: string | null; alt?: string }) => ReturnType;
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
      setIndentLevel: (value) => updateEach(() => ({ indent: Math.max(0, Math.min(8, value)) })),
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
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'footnote-ref' })];
  },
  renderText() {
    return '';
  },
  addCommands() {
    return {
      insertFootnote: (text) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { text } }),
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

const TOC_LEVELS = [1, 2, 3];

const renderToc = (container: HTMLElement, doc: import('@tiptap/pm/model').Node, onJump: (pos: number) => void) => {
  container.replaceChildren();
  const title = document.createElement('div');
  title.className = 'toc-title';
  title.textContent = 'MỤC LỤC';
  container.appendChild(title);
  let count = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading' || !TOC_LEVELS.includes(node.attrs.level) || !node.textContent.trim()) return;
    count++;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `toc-entry toc-l${node.attrs.level}`;
    row.textContent = node.textContent;
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      onJump(pos);
    });
    container.appendChild(row);
  });
  if (!count) {
    const empty = document.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = 'Chưa có tiêu đề nào. Dùng kiểu Heading 1–3 để mục lục tự cập nhật.';
    container.appendChild(empty);
  }
};

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': 'true', class: 'doc-toc' })];
  },
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc';
      dom.setAttribute('data-toc', 'true');
      dom.contentEditable = 'false';
      const jump = (pos: number) => {
        const target = editor.view.nodeDOM(pos);
        if (target instanceof HTMLElement) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        editor.chain().focus().setTextSelection(pos + 1).run();
      };
      const refresh = () => renderToc(dom, editor.state.doc, jump);
      refresh();
      editor.on('update', refresh);
      return { dom, ignoreMutation: () => true, destroy: () => editor.off('update', refresh) };
    };
  },
  addCommands() {
    return {
      insertTableOfContents: () => ({ commands }) => commands.insertContent([{ type: this.name }, { type: 'paragraph' }]),
    };
  },
});

export const LayoutImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
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
      setImageLayout: (attrs) => ({ commands }) => commands.updateAttributes('image', attrs),
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
