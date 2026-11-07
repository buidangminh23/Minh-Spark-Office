import { useEffect, useRef, type RefObject } from 'react';
import type { DocCtx } from './DocContext';
import { changeCase, insertDateTime } from './actions';
import { insertEndnote, markIndexEntry } from './actionsExtra';
import { applyDocStyle } from './docStyles';
import { getPagination } from './pagination';
import { appendSteps, runSteps, stepsFromTransaction, type MacroStep } from './viewMacros';
import type { CaseMode } from './docTools';

const CASE_CYCLE: CaseMode[] = ['upper', 'lower', 'title'];

export const moveBlock = (ctx: DocCtx, direction: 1 | -1) => {
  const { editor } = ctx;
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.depth < 1) return;
  const index = $from.index(0);
  const target = index + direction;
  if (target < 0 || target >= state.doc.childCount) return;
  const offset = $from.pos - $from.before(1);
  const first = direction > 0 ? index : target;
  let from = 0;
  for (let i = 0; i < first; i++) from += state.doc.child(i).nodeSize;
  const a = state.doc.child(first);
  const b = state.doc.child(first + 1);
  const tr = state.tr.replaceWith(from, from + a.nodeSize + b.nodeSize, [b, a]);
  const blockStart = direction > 0 ? from + b.nodeSize : from;
  editor.view.dispatch(tr);
  editor.commands.setTextSelection(Math.min(blockStart + offset, editor.state.doc.content.size - 1));
  editor.commands.focus();
};

export const shiftHeading = (ctx: DocCtx, direction: 1 | -1) => {
  const { editor } = ctx;
  const level = [1, 2, 3, 4, 5, 6].find((value) => editor.isActive('heading', { level: value }));
  const chain = editor.chain().focus();
  if (!level) {
    if (direction < 0) chain.setHeading({ level: 6 }).run();
    return;
  }
  const next = level + direction;
  if (next > 6) chain.setParagraph().run();
  else chain.setHeading({ level: Math.max(1, next) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
};

const toggleTextStyle = (ctx: DocCtx, attr: string, value: string) => {
  const current = ctx.editor.getAttributes('textStyle')[attr];
  ctx.editor.chain().focus().setMark('textStyle', { [attr]: current === value ? null : value }).run();
};

const hanging = (ctx: DocCtx, direction: 1 | -1) => {
  const { editor } = ctx;
  const attrs = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph');
  const left = (Number(attrs.indent) || 0) * 48 + (direction > 0 ? 48 : -48);
  editor.chain().focus().setParagraphIndent({ left: Math.max(0, left), firstLine: left > 0 ? -48 : 0 }).run();
};

export function useWordShortcuts(ctxRef: RefObject<DocCtx | null>) {
  const repeat = useRef<MacroStep[]>([]);
  const lastEdit = useRef<number[]>([]);
  const caseIndex = useRef(0);
  const editor = ctxRef.current?.editor;
  useEffect(() => {
    if (!editor) return;
    const record = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      if (!transaction.docChanged || transaction.getMeta('history$')) return;
      const steps = stepsFromTransaction(transaction);
      if (!steps.length) return;
      const onlyTyping = steps.every((step) => step.t === 'text') && repeat.current.every((step) => step.t === 'text');
      if (onlyTyping) appendSteps(repeat.current, steps);
      else repeat.current = steps;
      lastEdit.current = [editor.state.selection.head, ...lastEdit.current.filter((pos) => Math.abs(pos - editor.state.selection.head) > 40)].slice(0, 4);
    };
    editor.on('transaction', record);
    return () => { editor.off('transaction', record); };
  }, [editor]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const c = ctxRef.current;
      if (!c) return;
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const chain = () => c.editor.chain().focus();
      const run = (): boolean => {
        if (e.key === 'F4' && !e.shiftKey) return runSteps(c.editor, repeat.current), true;
        if (e.key === 'F9') return getPagination(c.editor).runNow(), c.ui.toast('Đã cập nhật các trường, mục lục và số trang'), true;
        if (e.key === 'F3' && e.shiftKey) {
          changeCase(c, CASE_CYCLE[caseIndex.current % CASE_CYCLE.length]);
          caseIndex.current += 1;
          return true;
        }
        if (e.key === 'F5' && e.shiftKey) {
          const target = lastEdit.current[1] ?? lastEdit.current[0];
          if (target) c.editor.chain().focus().setTextSelection(Math.min(target, c.editor.state.doc.content.size - 1)).scrollIntoView().run();
          return true;
        }
        if (e.key === 'F7' && e.shiftKey) return c.setView({ sidePanel: 'thesaurus' }), true;
        if (e.altKey && !ctrl && key === 'q') return c.openDialog('commandpalette'), true;
        if (e.altKey && e.shiftKey && !ctrl) {
          if (e.key === 'ArrowLeft') return shiftHeading(c, -1), true;
          if (e.key === 'ArrowRight') return shiftHeading(c, 1), true;
          if (e.key === 'ArrowUp') return moveBlock(c, -1), true;
          if (e.key === 'ArrowDown') return moveBlock(c, 1), true;
          if (key === 'd') return insertDateTime(c, 'date'), true;
          if (key === 't') return insertDateTime(c, 'time'), true;
          if (key === 'x') return void markIndexEntry(c), true;
          if (key === 'i') return c.openDialog('markcitation'), true;
          return false;
        }
        if (!ctrl) return false;
        if (e.altKey) {
          if (key === 'd') return void insertEndnote(c), true;
          if (key === 'o') return c.setView({ viewMode: 'outline' }), true;
          if (key === 'n') return c.setView({ viewMode: 'draft' }), true;
          if (key === 'p') return c.setView({ viewMode: 'print' }), true;
          if (key === 's') return c.setView({ splitView: !c.view.splitView }), true;
          if (key === 'h') return chain().toggleHighlight({ color: '#fff59d' }).run(), true;
          return false;
        }
        if (e.shiftKey) {
          if (key === 'n') return applyDocStyle(c.editor, 'normal'), true;
          if (key === 'f' || key === 'p') return c.openDialog('font'), true;
          if (key === 'm') return chain().decreaseIndent().run(), true;
          if (key === 't') return hanging(c, -1), true;
          if (key === 'd') return toggleTextStyle(c, 'underlineStyle', 'double'), true;
          if (key === 'a') return toggleTextStyle(c, 'textTransform', 'uppercase'), true;
          if (key === 'k') return toggleTextStyle(c, 'fontVariant', 'small-caps'), true;
          if (key === 's') return c.openDialog('style'), true;
          return false;
        }
        if (key === '1') return chain().setLineHeight(1).run(), true;
        if (key === '2') return chain().setLineHeight(2).run(), true;
        if (key === '5') return chain().setLineHeight(1.5).run(), true;
        if (key === '0') {
          const before = c.editor.getAttributes(c.editor.isActive('heading') ? 'heading' : 'paragraph').spaceBefore;
          return chain().setParagraphAttrs({ spaceBefore: before ? 0 : 12 }).run(), true;
        }
        if (key === 'm') return chain().increaseIndent().run(), true;
        if (key === 't') return hanging(c, 1), true;
        if (key === 'q') return chain().setParagraphAttrs({ lineHeight: null, indent: 0, indentRight: 0, firstLine: 0, spaceBefore: null, spaceAfter: null, keepNext: false, pageBreakBefore: false, shading: null, borderSides: null, textAlign: null }).run(), true;
        if (e.key === ' ') return chain().unsetAllMarks().run(), true;
        if (e.key === 'F2') return c.print(), true;
        return false;
      };
      if (run()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [ctxRef]);
}
