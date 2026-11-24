import type { JSONContent } from '@tiptap/react';
import type { DocContent } from '../storage';

export function collectNodes(node: JSONContent | null | undefined, out: JSONContent[] = []): JSONContent[] {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectNodes(child, out);
  }
  return out;
}

export function nodeText(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodeText).join('');
}

export function fullDocText(content: DocContent): string {
  const raw: unknown = content.json;
  if (typeof raw === 'string') return raw.replace(/<[^>]+>/g, ' ');
  return collectNodes(content.json)
    .filter((item) => item.type === 'paragraph' || item.type === 'heading' || item.type === 'tableCell' || item.type === 'tableHeader')
    .map(nodeText)
    .join('\n');
}

export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function para(text: string, attrs?: Record<string, unknown>, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): JSONContent {
  const content = text ? [{ type: 'text', text, ...(marks ? { marks } : {}) }] : [];
  return { type: 'paragraph', ...(attrs ? { attrs } : {}), ...(content.length ? { content } : {}) };
}

export function heading(level: 1 | 2 | 3, text: string, attrs?: Record<string, unknown>): JSONContent {
  return {
    type: 'heading',
    attrs: { level, ...(attrs ?? {}) },
    content: [{ type: 'text', text }],
  };
}

export function hasMarkOnText(content: DocContent, markType: string, needle: string): boolean {
  const target = foldText(needle);
  return collectNodes(content.json).some(
    (n) => n.type === 'text' && Array.isArray(n.marks) && n.marks.some((m) => m.type === markType) && foldText(n.text ?? '').includes(target),
  );
}
