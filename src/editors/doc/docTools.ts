import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/react';

export type ProofIssue = { id: string; from: number; to: number; text: string; message: string; suggestion: string | null; kind: 'spelling' | 'grammar' | 'style' };

const COMMON_MISSPELLINGS: Record<string, string> = {
  'sử lý': 'xử lý',
  'chuẩn đoán': 'chẩn đoán',
  'sát nhập': 'sáp nhập',
  'dành giật': 'giành giật',
  'giành dụm': 'dành dụm',
  'suất sắc': 'xuất sắc',
  'nghành': 'ngành',
  'thăm quan': 'tham quan',
  'bổ xung': 'bổ sung',
  'suất xứ': 'xuất xứ',
  'dấu diếm': 'giấu giếm',
  'sơ xuất': 'sơ suất',
  'chính sát': 'chính xác',
  'ngoằn nghèo': 'ngoằn ngoèo',
  'dục dã': 'giục giã',
  'lãng mạng': 'lãng mạn',
  'bàn hoàn': 'bàng hoàng',
  'xắp xếp': 'sắp xếp',
  'sáng xuất': 'sáng suốt',
  'kỉ niệm': 'kỷ niệm',
  'trân thành': 'chân thành',
  'giảm thiểu tối đa': 'giảm tối đa',
  'teh': 'the',
  'recieve': 'receive',
  'seperate': 'separate',
  'occured': 'occurred',
  'definately': 'definitely',
};

type TextSegment = { text: string; offsets: number[] };

const segments = (doc: PMNode): TextSegment[] => {
  const list: TextSegment[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const offsets: number[] = [];
    node.forEach((child, offset) => {
      const chunk = child.isText ? child.text ?? '' : ' ';
      for (let i = 0; i < chunk.length; i++) offsets.push(pos + 1 + offset + i);
      text += chunk;
    });
    offsets.push(pos + 1 + node.content.size);
    if (text.trim()) list.push({ text, offsets });
    return false;
  });
  return list;
};

const RULES: Array<{ pattern: RegExp; message: string; fix: (match: RegExpMatchArray) => string | null; kind: ProofIssue['kind'] }> = [
  { pattern: / {2,}/g, message: 'Thừa khoảng trắng', fix: () => ' ', kind: 'style' },
  { pattern: /(?<![\p{L}\p{N}])([\p{L}]+)\s+\1(?![\p{L}\p{N}])/giu, message: 'Từ bị lặp liên tiếp', fix: (m) => m[1], kind: 'grammar' },
  { pattern: /\s+([,.;:!?])/g, message: 'Không đặt khoảng trắng trước dấu câu', fix: (m) => m[1], kind: 'style' },
  { pattern: /([,;:])(?=[\p{L}])/gu, message: 'Thiếu khoảng trắng sau dấu câu', fix: (m) => `${m[1]} `, kind: 'style' },
  { pattern: /([.!?])\s+(\p{Ll})/gu, message: 'Đầu câu nên viết hoa', fix: (m) => `${m[1]} ${m[2].toUpperCase()}`, kind: 'grammar' },
  { pattern: /\(\s+|\s+\)/g, message: 'Khoảng trắng thừa trong ngoặc', fix: (m) => m[0].trim(), kind: 'style' },
];

export function proofread(doc: PMNode): ProofIssue[] {
  const issues: ProofIssue[] = [];
  const add = (seg: TextSegment, start: number, length: number, message: string, suggestion: string | null, kind: ProofIssue['kind']) => {
    const from = seg.offsets[start];
    const to = seg.offsets[start + length - 1] + 1;
    issues.push({ id: `${from}-${to}-${message}`, from, to, text: seg.text.slice(start, start + length), message, suggestion, kind });
  };
  for (const seg of segments(doc)) {
    const lower = seg.text.toLowerCase();
    for (const [wrong, right] of Object.entries(COMMON_MISSPELLINGS)) {
      const re = new RegExp(`(?<![\\p{L}])${wrong}(?![\\p{L}])`, 'gu');
      for (const match of lower.matchAll(re)) {
        const original = seg.text.slice(match.index, match.index + wrong.length);
        const suggestion = original[0] === original[0].toUpperCase() ? right[0].toUpperCase() + right.slice(1) : right;
        add(seg, match.index ?? 0, wrong.length, `Có thể sai chính tả: nên dùng “${right}”`, suggestion, 'spelling');
      }
    }
    for (const rule of RULES) {
      for (const match of seg.text.matchAll(rule.pattern)) add(seg, match.index ?? 0, match[0].length, rule.message, rule.fix(match), rule.kind);
    }
    const first = seg.text.trimStart()[0];
    if (first && /\p{Ll}/u.test(first)) add(seg, seg.text.indexOf(first), 1, 'Đoạn văn nên bắt đầu bằng chữ hoa', first.toUpperCase(), 'grammar');
    const opens = (seg.text.match(/\(/g) ?? []).length;
    const closes = (seg.text.match(/\)/g) ?? []).length;
    if (opens !== closes) add(seg, 0, Math.min(seg.text.length, 30), 'Dấu ngoặc đơn chưa đóng/mở đủ', null, 'grammar');
    seg.text.split(/(?<=[.!?])\s+/).forEach((sentence) => {
      const words = sentence.trim().split(/\s+/).length;
      if (words > 60) add(seg, seg.text.indexOf(sentence), sentence.length, `Câu quá dài (${words} từ) — nên tách nhỏ cho dễ đọc`, null, 'style');
    });
  }
  return issues.sort((a, b) => a.from - b.from);
}

export function textStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?…]+\s/).filter((s) => s.trim()).length || (words ? 1 : 0);
  const paragraphs = text.split(/\n+/).filter((p) => p.trim()).length;
  const charsNoSpaces = text.replace(/\s+/g, '').length;
  const avgSentence = sentences ? words / sentences : 0;
  const readability = Math.max(0, Math.min(100, Math.round(120 - avgSentence * 2.2)));
  return { words, sentences, paragraphs, chars: text.length, charsNoSpaces, avgSentence, readability, readMinutes: Math.max(1, Math.ceil(words / 200)), speakMinutes: Math.max(1, Math.ceil(words / 130)) };
}

const STOP_WORDS = new Set('và của là các có được cho với trong này những một không để đã từ theo về khi thì như cũng đến người ra tại sẽ đó nên còn rất hay hoặc vào trên dưới bởi vì nhưng mà the a an of to in and or is are be for on with as by at this that it from'.split(' '));

export function summarize(text: string, maxSentences = 5) {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => s.split(' ').length >= 4);
  if (sentences.length <= maxSentences) return sentences;
  const freq = new Map<string, number>();
  const tokens = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  sentences.forEach((s) => tokens(s).forEach((t) => !STOP_WORDS.has(t) && freq.set(t, (freq.get(t) ?? 0) + 1)));
  const scored = sentences.map((s, index) => {
    const words = tokens(s).filter((t) => !STOP_WORDS.has(t));
    const score = words.reduce((sum, t) => sum + (freq.get(t) ?? 0), 0) / Math.max(4, words.length) + (index === 0 ? 1 : 0);
    return { s, index, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.index - b.index).map((x) => x.s);
}

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'toggle';

export function transformCase(text: string, mode: CaseMode) {
  switch (mode) {
    case 'upper': return text.toLocaleUpperCase('vi');
    case 'lower': return text.toLocaleLowerCase('vi');
    case 'title': return text.toLocaleLowerCase('vi').replace(/(^|[^\p{L}])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('vi'));
    case 'sentence': return text.toLocaleLowerCase('vi').replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('vi'));
    case 'toggle': return [...text].map((ch) => (ch === ch.toLocaleUpperCase('vi') ? ch.toLocaleLowerCase('vi') : ch.toLocaleUpperCase('vi'))).join('');
  }
}

export type DiffPart = { type: 'same' | 'added' | 'removed'; text: string };

const DIFF_TOKEN_LIMIT = 4000;

export const normalizeLines = (text: string) => text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

export function diffWords(before: string, after: string): DiffPart[] {
  const allBefore = before.split(/(\s+)/);
  const allAfter = after.split(/(\s+)/);
  let head = 0;
  while (head < allBefore.length && head < allAfter.length && allBefore[head] === allAfter[head]) head++;
  let tail = 0;
  while (tail < allBefore.length - head && tail < allAfter.length - head && allBefore[allBefore.length - 1 - tail] === allAfter[allAfter.length - 1 - tail]) tail++;
  const a = allBefore.slice(head, allBefore.length - tail);
  const b = allAfter.slice(head, allAfter.length - tail);
  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };
  push('same', allBefore.slice(0, head).join(''));
  if (a.length > DIFF_TOKEN_LIMIT || b.length > DIFF_TOKEN_LIMIT) {
    push('removed', a.join(''));
    push('added', b.join(''));
  } else {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) push('removed', a[i++]);
      else push('added', b[j++]);
    }
    while (i < a.length) push('removed', a[i++]);
    while (j < b.length) push('added', b[j++]);
  }
  push('same', allBefore.slice(allBefore.length - tail).join(''));
  return parts;
}

export function jsonText(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  const inner = (node.content ?? []).map(jsonText).join('');
  return node.type && ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'tableRow', 'codeBlock'].includes(node.type) ? `${inner}\n` : inner;
}

export function fillMergeFields(node: JSONContent, record: Record<string, string>): JSONContent {
  if (node.type === 'mergeField') return { type: 'text', text: record[String(node.attrs?.name ?? '')] ?? '' };
  if (!node.content) return node;
  const content = node.content.map((child) => fillMergeFields(child, record)).filter((child) => child.type !== 'text' || child.text);
  return { ...node, content };
}

export function splitByHeading(doc: JSONContent, level = 1) {
  const sections: { title: string; content: JSONContent[] }[] = [];
  let current: { title: string; content: JSONContent[] } | null = null;
  for (const block of doc.content ?? []) {
    if (block.type === 'heading' && Number(block.attrs?.level) <= level) {
      current = { title: jsonText(block).trim() || `Phần ${sections.length + 1}`, content: [block] };
      sections.push(current);
    } else if (current) {
      current.content.push(block);
    } else {
      current = { title: 'Phần mở đầu', content: [block] };
      sections.push(current);
    }
  }
  return sections.filter((section) => section.content.some((block) => jsonText(block).trim() || block.type === 'image' || block.type === 'table'));
}

export function parseDelimited(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const delimiter = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : text.includes('\t') ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) lines.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) lines.push(row);
  const [head = [], ...body] = lines;
  const headers = head.map((h, i) => h.trim() || `Cột ${i + 1}`);
  return { headers, rows: body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]))) };
}

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
