import { useEditorState, type Editor } from '@tiptap/react';
import { activeStyleId } from './docStyles';

const sizeInPt = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw) return '';
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return '';
  return String(raw.endsWith('px') ? Math.round(value * 0.75 * 2) / 2 : value);
};

export function useFormatState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const textStyle = e.getAttributes('textStyle');
      const heading = [1, 2, 3, 4, 5, 6].find((level) => e.isActive('heading', { level })) ?? 0;
      const { from, to, empty } = e.state.selection;
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        subscript: e.isActive('subscript'),
        superscript: e.isActive('superscript'),
        code: e.isActive('code'),
        link: e.isActive('link'),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        blockquote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        heading,
        align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
        fontFamily: String(textStyle.fontFamily ?? '').split(',')[0].replaceAll(/["']/g, '').trim(),
        fontSize: sizeInPt(textStyle.fontSize),
        color: String(textStyle.color ?? ''),
        highlight: String(e.getAttributes('highlight').color ?? ''),
        lineHeight: Number(e.getAttributes(heading ? 'heading' : 'paragraph').lineHeight) || 0,
        styleId: activeStyleId(e),
        dropCap: Boolean(e.getAttributes('paragraph').dropCap),
        keepNext: Boolean(e.getAttributes(heading ? 'heading' : 'paragraph').keepNext),
        pageBreakBefore: Boolean(e.getAttributes(heading ? 'heading' : 'paragraph').pageBreakBefore),
        inColumns: e.isActive('columnSection'),
        tableStyle: String(e.getAttributes('table').tableStyle ?? 'grid'),
        inTable: e.isActive('table'),
        imageSelected: e.isActive('image'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        empty,
        selectionText: empty ? '' : e.state.doc.textBetween(from, to, ' '),
        canMerge: e.can().mergeCells(),
        canSplit: e.can().splitCell(),
      };
    },
  });
}

export type FormatState = ReturnType<typeof useFormatState>;
