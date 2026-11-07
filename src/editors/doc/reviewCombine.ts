import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { diffWords, normalizeLines } from './docTools';
import { SKIP_META } from './trackChanges';

const LEAF = '￼';

type BaseBlock = { pos: number; node: PMNode; text: string; key: string };
type Step = { kind: 'same'; base: BaseBlock } | { kind: 'edit'; base: BaseBlock; other: string } | { kind: 'remove'; base: BaseBlock } | { kind: 'add'; other: string };

const keyOf = (text: string) => text.replace(LEAF, '').replace(/\s+/g, ' ').trim();

const baseBlocks = (doc: PMNode) => {
  const list: BaseBlock[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, LEAF);
    if (keyOf(text)) list.push({ pos, node, text, key: keyOf(text) });
    return false;
  });
  return list;
};

const alignBlocks = (base: BaseBlock[], other: string[]): Step[] => {
  const n = base.length;
  const m = other.length;
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = base[i].key === other[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const steps: Step[] = [];
  let i = 0;
  let j = 0;
  const flushGap = (endBase: number, endOther: number) => {
    while (i < endBase && j < endOther) steps.push({ kind: 'edit', base: base[i++], other: other[j++] });
    while (i < endBase) steps.push({ kind: 'remove', base: base[i++] });
    while (j < endOther) steps.push({ kind: 'add', other: other[j++] });
  };
  let gapBase = 0;
  let gapOther = 0;
  while (gapBase < n && gapOther < m) {
    if (base[gapBase].key === other[gapOther]) {
      flushGap(gapBase, gapOther);
      steps.push({ kind: 'same', base: base[gapBase] });
      gapBase += 1;
      gapOther += 1;
      i = gapBase;
      j = gapOther;
    } else if (table[gapBase + 1][gapOther] >= table[gapBase][gapOther + 1]) {
      gapBase += 1;
    } else {
      gapOther += 1;
    }
  }
  flushGap(n, m);
  return steps;
};

export function combineAsTrackedChanges(editor: Editor, otherText: string, author: string) {
  const schema = editor.schema;
  const insertion = schema.marks.insertion.create({ author, date: Date.now() });
  const deletion = schema.marks.deletion.create({ author, date: Date.now() });
  const other = normalizeLines(otherText).split('\n').filter(Boolean);
  const steps = alignBlocks(baseBlocks(editor.state.doc), other);
  const tr = editor.state.tr;
  const counts = { insertions: 0, deletions: 0 };
  const inserts: { at: number; texts: string[] }[] = [];
  let anchor = editor.state.doc.content.size;
  for (let index = steps.length - 1; index >= 0; index--) {
    const step = steps[index];
    if (step.kind === 'add') {
      const open = inserts[inserts.length - 1];
      if (open && open.at === anchor) open.texts.unshift(step.other);
      else inserts.push({ at: anchor, texts: [step.other] });
      continue;
    }
    const $pos = editor.state.doc.resolve(step.base.pos);
    anchor = $pos.depth === 0 ? step.base.pos : $pos.before(1);
  }
  const edits: { from: number; to: number; mark?: boolean; text?: string }[] = [];
  for (const step of steps) {
    if (step.kind === 'remove') {
      edits.push({ from: step.base.pos + 1, to: step.base.pos + 1 + step.base.node.content.size, mark: true });
      counts.deletions += 1;
    }
    if (step.kind === 'edit') {
      let offset = step.base.pos + 1;
      for (const part of diffWords(step.base.text, step.other)) {
        if (part.type === 'same') {
          offset += part.text.length;
        } else if (part.type === 'removed') {
          edits.push({ from: offset, to: offset + part.text.length, mark: true });
          offset += part.text.length;
          if (part.text.trim()) counts.deletions += 1;
        } else {
          edits.push({ from: offset, to: offset, text: part.text });
          if (part.text.trim()) counts.insertions += 1;
        }
      }
    }
  }
  edits.sort((a, b) => b.from - a.from || (a.text ? 1 : -1));
  for (const edit of edits) {
    if (edit.mark) tr.addMark(edit.from, edit.to, deletion);
    else if (edit.text) tr.insert(edit.from, schema.text(edit.text, [insertion]));
  }
  [...inserts].sort((a, b) => b.at - a.at).forEach((group) => {
    tr.insert(tr.mapping.map(group.at), group.texts.map((text) => schema.nodes.paragraph.create(null, schema.text(text, [insertion]))));
    counts.insertions += group.texts.length;
  });
  if (tr.docChanged) editor.view.dispatch(tr.setMeta(SKIP_META, true));
  return counts;
}
