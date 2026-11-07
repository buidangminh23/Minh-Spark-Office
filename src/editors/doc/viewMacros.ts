import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';

export type MacroStep =
  | { t: 'text'; text: string }
  | { t: 'delete'; count: number }
  | { t: 'split' }
  | { t: 'mark'; name: string; attrs: Record<string, unknown> | null; add: boolean }
  | { t: 'block'; name: string; attrs: Record<string, unknown> };

export type Macro = { id: string; name: string; steps: MacroStep[]; createdAt: number };

const MACRO_KEY = 'minh-docs-macros';

export const loadMacros = (): Macro[] => {
  try {
    const list = JSON.parse(localStorage.getItem(MACRO_KEY) ?? '[]') as Macro[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveMacros = (list: Macro[]) => {
  try {
    localStorage.setItem(MACRO_KEY, JSON.stringify(list));
  } catch {
    return;
  }
};

const merge = (steps: MacroStep[], next: MacroStep) => {
  const last = steps[steps.length - 1];
  if (last?.t === 'text' && next.t === 'text') last.text += next.text;
  else if (last?.t === 'delete' && next.t === 'delete') last.count += next.count;
  else steps.push(next);
};

export const stepsFromTransaction = (tr: Transaction) => {
  const steps: MacroStep[] = [];
  tr.steps.forEach((step, index) => {
    const json = step.toJSON() as { stepType: string; from: number; to: number; slice?: { content?: { type: string; text?: string }[]; openStart?: number }; mark?: { type: string; attrs?: Record<string, unknown> }; gapFrom?: number };
    const doc = tr.docs[index];
    if (json.stepType === 'replace') {
      const nodes = json.slice?.content ?? [];
      const removed = json.to - json.from;
      if (removed > 0) merge(steps, { t: 'delete', count: removed });
      if (nodes.length && nodes.every((node) => node.type === 'text')) merge(steps, { t: 'text', text: nodes.map((node) => node.text ?? '').join('') });
      else if (nodes.length === 2 && Number(json.slice?.openStart) > 0) merge(steps, { t: 'split' });
    } else if (json.stepType === 'addMark' || json.stepType === 'removeMark') {
      if (json.mark) merge(steps, { t: 'mark', name: json.mark.type, attrs: json.mark.attrs ?? null, add: json.stepType === 'addMark' });
    } else if (json.stepType === 'replaceAround') {
      const target = tr.docs[index + 1]?.nodeAt(json.from) ?? tr.doc.nodeAt(json.from);
      if (target?.isBlock) merge(steps, { t: 'block', name: target.type.name, attrs: { ...target.attrs } });
    } else if (json.stepType === 'attr') {
      const target = (tr.docs[index + 1] ?? tr.doc).nodeAt((json as unknown as { pos: number }).pos);
      if (target?.isBlock) merge(steps, { t: 'block', name: target.type.name, attrs: { ...target.attrs } });
    }
    void doc;
  });
  return steps;
};

export const appendSteps = (target: MacroStep[], added: MacroStep[]) => added.forEach((step) => merge(target, step));

export const describeStep = (step: MacroStep) => {
  switch (step.t) {
    case 'text': return `Gõ “${step.text.slice(0, 40)}”`;
    case 'delete': return `Xoá ${step.count} ký tự`;
    case 'split': return 'Xuống đoạn';
    case 'mark': return `${step.add ? 'Áp dụng' : 'Bỏ'} định dạng ${step.name}`;
    default: return `Đổi đoạn thành ${step.name}`;
  }
};

export const runSteps = (editor: Editor, steps: MacroStep[]) => {
  for (const step of steps) {
    const chain = editor.chain().focus();
    if (step.t === 'text') chain.insertContent(step.text).run();
    else if (step.t === 'split') chain.splitBlock().run();
    else if (step.t === 'delete') {
      const { from, to, empty } = editor.state.selection;
      if (empty) chain.deleteRange({ from: Math.max(1, from - step.count), to: from }).run();
      else chain.deleteRange({ from, to }).run();
    } else if (step.t === 'mark') {
      if (step.add) chain.setMark(step.name, step.attrs ?? {}).run();
      else chain.unsetMark(step.name).run();
    } else if (editor.schema.nodes[step.name]) {
      chain.setNode(step.name, step.attrs).run();
    }
  }
};
