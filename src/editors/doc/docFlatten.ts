import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { FLATTEN_EXTRA } from './docFlattenExtra';
import { citationLabel, crossRefLabel, docListLines, docListTitle, type DocListKind } from './extensionsExtra';

const LIST_KINDS: DocListKind[] = ['tableOfContents', 'figureList', 'bibliography', 'docIndex', 'endnoteList', 'authorityList'];
const LEADERS: Record<string, string> = { dots: '........', dashes: '--------', underline: '________', none: '   ' };

const textParagraph = (text: string, attrs: Record<string, unknown> = {}, bold = false): JSONContent => ({
  type: 'paragraph',
  attrs,
  content: text ? [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] : [],
});

function expandList(editor: Editor, node: JSONContent): JSONContent[] {
  const kind = node.type as DocListKind;
  const lines = docListLines(editor, kind, node.attrs ?? {});
  const leader = LEADERS[String(node.attrs?.leader ?? 'dots')] ?? LEADERS.dots;
  return [
    ...(node.attrs?.showTitle === false ? [] : [textParagraph(String(node.attrs?.titleText ?? docListTitle(kind)), {}, true)]),
    ...lines.map((line) => {
      const right = line.pageText ?? (line.page === null ? null : String(line.page));
      return textParagraph(right === null ? line.text : `${line.text} ${leader} ${right}`, { indent: Math.max(0, line.level - 1) * 0.5 }, line.level === 1 && (kind === 'tableOfContents' || kind === 'authorityList'));
    }),
  ];
}

export function flattenForExport(editor: Editor, options: { equationAsText?: boolean } = {}): JSONContent {
  const walk = (node: JSONContent): JSONContent[] => {
    if (LIST_KINDS.includes(node.type as DocListKind)) return expandList(editor, node);
    if (node.attrs?.hidden) return [];
    const extra = node.type ? FLATTEN_EXTRA[node.type] : undefined;
    if (extra) return extra(node, editor);
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
