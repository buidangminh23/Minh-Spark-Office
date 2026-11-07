import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { fieldToLatex, usesChemistry } from './mathCatalog';
import { createMathfield, type MathfieldLike } from './mathliveLoader';

export const EQUATION_OPEN_DIALOG = 'doc-equation-open';

export const canEditInline = (latex: string) => !usesChemistry(latex);

interface InlineEditorOptions {
  editor: Editor;
  dom: HTMLElement;
  getPos: () => number | undefined;
  node: () => PMNode;
  repaint: () => void;
}

export class EquationInlineEditor {
  field: MathfieldLike | null = null;
  private opening = false;
  private finished = false;
  private readonly options: InlineEditorOptions;
  private readonly onEditorFocus = () => {
    if (this.field && !this.field.matches(':focus-within')) this.commit(null);
  };

  constructor(options: InlineEditorOptions) {
    this.options = options;
  }

  get active() {
    return this.field !== null || this.opening;
  }

  async open() {
    const { editor, dom } = this.options;
    if (this.active || !editor.isEditable) return;
    const latex = String(this.options.node().attrs.latex ?? '');
    if (!canEditInline(latex)) {
      this.requestDialog();
      return;
    }
    this.opening = true;
    this.finished = false;
    let field: MathfieldLike;
    try {
      field = await createMathfield(latex);
    } catch {
      this.opening = false;
      this.requestDialog();
      return;
    }
    this.opening = false;
    field.mathVirtualKeyboardPolicy = 'auto';
    field.className = 'doc-equation-field';
    field.addEventListener('keydown', (event) => this.onKey(event), { capture: true });
    field.addEventListener('focusout', () => window.setTimeout(() => this.onFocusOut(), 0));
    field.addEventListener('move-out', (event) => {
      event.preventDefault();
      const direction = (event as CustomEvent<{ direction: string }>).detail?.direction;
      this.commit(direction === 'backward' || direction === 'upward' ? 'before' : 'after');
    });
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'doc-equation-more';
    more.textContent = '⋯';
    more.title = 'Mở trình soạn công thức đầy đủ (mẫu, ký hiệu, trình bày)';
    more.addEventListener('mousedown', (event) => event.preventDefault());
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      this.commit(null);
      this.requestDialog();
    });
    this.field = field;
    editor.on('focus', this.onEditorFocus);
    dom.classList.add('editing');
    dom.replaceChildren(field, more);
    requestAnimationFrame(() => {
      field.focus();
      field.executeCommand('moveToMathfieldEnd');
    });
  }

  private onKey(event: KeyboardEvent) {
    if (!this.field) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    this.commit('after');
  }

  private onFocusOut() {
    if (!this.field || this.finished) return;
    if (this.field.matches(':focus-within') || this.options.dom.contains(document.activeElement)) return;
    if (document.activeElement?.closest('.ML__keyboard, .ui-menu-container')) return;
    this.commit(null);
  }

  private teardown() {
    this.finished = true;
    this.field = null;
    this.options.editor.off('focus', this.onEditorFocus);
    this.options.dom.classList.remove('editing');
    this.options.repaint();
  }

  dispose() {
    this.finished = true;
    this.field = null;
    this.options.editor.off('focus', this.onEditorFocus);
  }

  cancel() {
    if (!this.field) return;
    this.teardown();
    const pos = this.options.getPos();
    const { view } = this.options.editor;
    if (typeof pos === 'number') view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    view.focus();
  }

  commit(caret: 'before' | 'after' | null) {
    const field = this.field;
    if (!field) return;
    const latex = fieldToLatex(field.value).trim();
    const node = this.options.node();
    const pos = this.options.getPos();
    this.teardown();
    const { view } = this.options.editor;
    if (typeof pos !== 'number') return;
    let tr = view.state.tr;
    if (!latex) {
      tr = tr.delete(pos, pos + node.nodeSize);
      tr = tr.setSelection(TextSelection.create(tr.doc, Math.min(pos, tr.doc.content.size)));
    } else {
      if (latex !== node.attrs.latex) tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
      if (caret) {
        const target = caret === 'before' ? pos : pos + node.nodeSize;
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(target), caret === 'before' ? -1 : 1));
      }
    }
    if (tr.docChanged || caret || !latex) view.dispatch(tr);
    if (caret || !latex) view.focus();
  }

  private requestDialog() {
    const pos = this.options.getPos();
    if (typeof pos !== 'number') return;
    this.options.dom.dispatchEvent(new CustomEvent(EQUATION_OPEN_DIALOG, { bubbles: true, detail: { pos } }));
  }
}
