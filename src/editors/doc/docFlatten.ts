import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { citationLabel, crossRefLabel, docListLines, docListTitle, type DocListKind } from './extensionsExtra';

const LIST_KINDS: DocListKind[] = ['tableOfContents', 'figureList', 'bibliography', 'docIndex', 'endnoteList'];

const textParagraph = (text: string, attrs: Record<string, unknown> = {}, bold = false): JSONContent => ({
  type: 'paragraph',
  attrs,
  content: text ? [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] : [],
});

function expandList(editor: Editor, node: JSONContent): JSONContent[] {
  const kind = node.type as DocListKind;
  const lines = docListLines(editor, kind, node.attrs ?? {});
  return [
    textParagraph(docListTitle(kind), {}, true),
    ...lines.map((line) => textParagraph(line.page === null ? line.text : `${line.text} ........ ${line.page}`, { indent: Math.max(0, line.level - 1) * 0.5 }, line.level === 1 && kind === 'tableOfContents')),
  ];
}

export function flattenForExport(editor: Editor, options: { equationAsText?: boolean } = {}): JSONContent {
  const walk = (node: JSONContent): JSONContent[] => {
    if (LIST_KINDS.includes(node.type as DocListKind)) return expandList(editor, node);
    switch (node.type) {
      case 'citation': return [{ type: 'text', text: citationLabel(editor, String(node.attrs?.sourceId)), marks: node.marks }];
      case 'crossRef': return [{ type: 'text', text: crossRefLabel(editor, String(node.attrs?.target), String(node.attrs?.show)), marks: node.marks }];
      case 'smartChip': return node.attrs?.value ? [{ type: 'text', text: String(node.attrs.value), marks: node.marks }] : [];
      case 'indexEntry': return [];
      case 'equation': return options.equationAsText && node.attrs?.latex ? [{ type: 'text', text: `$${String(node.attrs.latex)}$` }] : options.equationAsText ? [] : [node];
      default: break;
    }
    if (!node.content) return [node];
    return [{ ...node, content: node.content.flatMap(walk) }];
  };
  return walk(editor.getJSON())[0];
}
