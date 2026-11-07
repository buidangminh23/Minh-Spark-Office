import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { newId, type DocCtx } from './DocContext';
import { formatNote, type DocListKind, type NoteFormat } from './extensionsExtra';
import { getPagination } from './pagination';

export const AUTHORITY_CATEGORIES = ['Hiến pháp', 'Bộ luật, Luật', 'Nghị định', 'Thông tư', 'Quyết định', 'Án lệ', 'Điều ước quốc tế', 'Khác'];
export const CAPTION_LABELS = ['Hình', 'Bảng', 'Biểu đồ', 'Công thức', 'Sơ đồ'];
export const CAPTION_FORMATS = [{ value: 'decimal', label: '1, 2, 3' }, { value: 'lower-alpha', label: 'a, b, c' }, { value: 'upper-alpha', label: 'A, B, C' }, { value: 'lower-roman', label: 'i, ii, iii' }, { value: 'upper-roman', label: 'I, II, III' }];

export const captionNumber = (value: number, format: string) => {
  if (format === 'lower-alpha' || format === 'lower-roman') return formatNote(value, format as NoteFormat);
  if (format === 'upper-alpha') return formatNote(value, 'lower-alpha').toUpperCase();
  if (format === 'upper-roman') return formatNote(value, 'lower-roman').toUpperCase();
  return String(value);
};

export const scrollToPos = (editor: Editor, pos: number) => {
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export const findNodes = (editor: Editor, names: string[]) => {
  const found: { node: PMNode; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (names.includes(node.type.name)) found.push({ node, pos });
    return true;
  });
  return found;
};

const updateLists = (ctx: DocCtx, kinds: DocListKind[]) => {
  const { editor } = ctx;
  const lists = findNodes(editor, kinds);
  getPagination(editor).runNow();
  if (lists.length) {
    const tr = editor.state.tr;
    lists.forEach(({ node, pos }) => tr.setNodeMarkup(pos, undefined, { ...node.attrs }));
    editor.view.dispatch(tr.setMeta('addToHistory', false));
  }
  return lists.length;
};

export async function updateTocPrompt(ctx: DocCtx) {
  const count = findNodes(ctx.editor, ['tableOfContents']).length;
  if (!count) {
    ctx.ui.toast('Tài liệu chưa có mục lục tự động', true);
    return;
  }
  const res = await ctx.ui.ask({
    title: 'Cập nhật mục lục',
    fields: [{ name: 'mode', label: 'Cập nhật', type: 'select', value: 'all', options: [{ value: 'pages', label: 'Chỉ số trang' }, { value: 'all', label: 'Toàn bộ mục lục' }] }],
    confirmText: 'Cập nhật',
  });
  if (!res) return;
  updateLists(ctx, ['tableOfContents']);
  ctx.ui.toast(res.mode === 'pages' ? 'Đã cập nhật số trang trong mục lục' : 'Đã cập nhật toàn bộ mục lục');
}

export function removeToc(ctx: DocCtx) {
  const { editor } = ctx;
  const lists = findNodes(editor, ['tableOfContents']);
  if (!lists.length) {
    ctx.ui.toast('Tài liệu chưa có mục lục tự động', true);
    return;
  }
  const tr = editor.state.tr;
  [...lists].reverse().forEach(({ node, pos }) => tr.delete(pos, pos + node.nodeSize));
  editor.view.dispatch(tr);
  ctx.ui.toast('Đã xoá mục lục');
}

export function insertManualToc(ctx: DocCtx) {
  const { editor } = ctx;
  const headings = findNodes(editor, ['heading']).filter(({ node }) => node.textContent.trim());
  const rows = headings.length ? headings.map(({ node, pos }) => ({ text: node.textContent, level: Number(node.attrs.level), page: 1 + getPagination(editor).result.breaks.filter((b) => b.pos <= pos).length })) : [{ text: 'Nhập tiêu đề chương', level: 1, page: 1 }, { text: 'Nhập tiêu đề mục', level: 2, page: 2 }, { text: 'Nhập tiêu đề mục con', level: 3, page: 3 }];
  editor.chain().focus().insertContent([
    { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'MỤC LỤC', marks: [{ type: 'bold' }] }] },
    ...rows.map((row) => ({ type: 'paragraph', attrs: { indent: Math.max(0, row.level - 1) * 0.5 }, content: [{ type: 'text', text: `${row.text} ........ ${row.page}` }] })),
  ]).run();
}

export function setTocLevel(ctx: DocCtx, level: number | null) {
  const { editor } = ctx;
  if (level === null) {
    if (editor.isActive('heading')) editor.chain().focus().updateAttributes('heading', { tocHide: true }).run();
    else ctx.ui.toast('Đoạn đang chọn không phải tiêu đề nên vốn không có trong mục lục');
  } else {
    editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).updateAttributes('heading', { tocHide: false }).run();
  }
  getPagination(editor).refresh();
}

const NOTE_AREA_MESSAGE = 'Chuyển sang Bố cục in để xem vùng chú thích cuối trang';

const notesOfKind = (editor: Editor, kind: 'foot' | 'end') => findNodes(editor, ['footnote']).filter(({ node }) => (node.attrs.kind === 'end' ? 'end' : 'foot') === kind);

export function jumpNote(ctx: DocCtx, kind: 'foot' | 'end', dir: 1 | -1) {
  const { editor } = ctx;
  const notes = notesOfKind(editor, kind);
  if (!notes.length) {
    ctx.ui.toast(kind === 'foot' ? 'Chưa có chú thích cuối trang' : 'Chưa có chú thích cuối tài liệu', true);
    return;
  }
  const head = editor.state.selection.from;
  const target = dir > 0 ? notes.find((n) => n.pos > head) ?? notes[0] : [...notes].reverse().find((n) => n.pos < head) ?? notes[notes.length - 1];
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target.pos)).scrollIntoView());
  editor.commands.focus();
}

const scrollToFootnoteArea = (ctx: DocCtx) => {
  const lists = [...document.querySelectorAll<HTMLElement>('.doc-paper .footnote-list')];
  if (!lists.length) {
    ctx.ui.toast(NOTE_AREA_MESSAGE, true);
    return;
  }
  const head = ctx.editor.view.coordsAtPos(ctx.editor.state.selection.head).top;
  const target = lists.find((el) => el.getBoundingClientRect().bottom >= head) ?? lists[lists.length - 1];
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('note-flash');
  window.setTimeout(() => target.classList.remove('note-flash'), 1200);
};

const scrollToEndnoteArea = (ctx: DocCtx) => {
  const list = findNodes(ctx.editor, ['endnoteList'])[0];
  if (list) scrollToPos(ctx.editor, list.pos);
};

export async function showNotes(ctx: DocCtx) {
  const hasFoot = notesOfKind(ctx.editor, 'foot').length > 0;
  const hasEnd = notesOfKind(ctx.editor, 'end').length > 0;
  if (!hasFoot && !hasEnd) {
    ctx.ui.toast('Tài liệu chưa có chú thích nào', true);
    return;
  }
  if (hasFoot && !hasEnd) return scrollToFootnoteArea(ctx);
  if (hasEnd && !hasFoot) return scrollToEndnoteArea(ctx);
  const res = await ctx.ui.ask({ title: 'Hiện chú thích', fields: [{ name: 'area', label: 'Tài liệu có cả hai loại chú thích. Xem vùng nào?', type: 'select', value: 'foot', options: [{ value: 'foot', label: 'Chú thích cuối trang' }, { value: 'end', label: 'Chú thích cuối tài liệu' }] }], confirmText: 'Xem' });
  if (res) (res.area === 'end' ? scrollToEndnoteArea : scrollToFootnoteArea)(ctx);
}

export function convertNotes(ctx: DocCtx, mode: 'to-end' | 'to-foot' | 'swap') {
  const { editor } = ctx;
  const notes = findNodes(editor, ['footnote']);
  if (!notes.length) return 0;
  const tr = editor.state.tr;
  let changed = 0;
  notes.forEach(({ node, pos }) => {
    const current = node.attrs.kind === 'end' ? 'end' : 'foot';
    const next = mode === 'swap' ? (current === 'end' ? 'foot' : 'end') : mode === 'to-end' ? 'end' : 'foot';
    if (next !== current) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind: next });
      changed += 1;
    }
  });
  if (changed) editor.view.dispatch(tr);
  const hasEnd = notesOfKind(editor, 'end').length > 0;
  if (hasEnd && !findNodes(editor, ['endnoteList']).length) editor.chain().insertContentAt(editor.state.doc.content.size, [{ type: 'endnoteList' }]).run();
  return changed;
}

export async function addPlaceholderSource(ctx: DocCtx) {
  const res = await ctx.ui.ask({ title: 'Thêm nguồn tạm', message: 'Chèn trích dẫn trước, điền thông tin nguồn sau trong Quản lý nguồn.', fields: [{ name: 'name', label: 'Tên tạm', value: `Nguon${(ctx.page.sources?.length ?? 0) + 1}` }], confirmText: 'Chèn' });
  const name = String(res?.name ?? '').trim();
  if (!name) return;
  const source = { id: newId('src'), type: 'other' as const, authors: name, title: 'Chưa có thông tin nguồn', year: 'k.n.', publisher: '', url: '', pages: '' };
  ctx.setPage({ sources: [...(ctx.page.sources ?? []), source] });
  window.setTimeout(() => ctx.editor.chain().focus().insertCitation(source.id).run(), 0);
}

const blockAround = (editor: Editor) => {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection && selection.$from.depth === 0) return { before: selection.from, after: selection.to };
  const { $from, $to } = selection;
  if ($from.depth === 0) return { before: $from.pos, after: $to.pos };
  return { before: $from.before(1), after: $to.after(1) };
};

export async function insertCaptionPrompt(ctx: DocCtx) {
  const { editor } = ctx;
  const existing = findNodes(editor, ['paragraph']).map(({ node }) => node.attrs.captionKind).filter(Boolean).map(String);
  const labels = [...new Set([...CAPTION_LABELS, ...existing])];
  const res = await ctx.ui.ask({
    title: 'Chèn nhãn',
    fields: [
      { name: 'kind', label: 'Nhãn', type: 'select', value: 'Hình', options: labels.map((value) => ({ value, label: value })) },
      { name: 'custom', label: 'Hoặc nhãn mới', placeholder: 'Ví dụ: Phụ lục' },
      { name: 'text', label: 'Nội dung', placeholder: 'Sơ đồ tổ chức công ty' },
      { name: 'format', label: 'Kiểu số', type: 'select', value: 'decimal', options: CAPTION_FORMATS },
      { name: 'position', label: 'Vị trí', type: 'select', value: 'after', options: [{ value: 'after', label: 'Dưới đối tượng đang chọn' }, { value: 'before', label: 'Trên đối tượng đang chọn' }] },
      { name: 'noLabel', label: 'Bỏ chữ nhãn, chỉ giữ số', type: 'checkbox', value: false },
    ],
    confirmText: 'Chèn',
  });
  if (!res) return;
  const kind = String(res.custom ?? '').trim() || String(res.kind);
  const format = String(res.format);
  const text = String(res.text ?? '').trim();
  const range = blockAround(editor);
  const at = res.position === 'before' ? range.before : range.after;
  let number = 1;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs?.captionKind === kind && pos < at) number += 1;
    return true;
  });
  const head = res.noLabel ? `${captionNumber(number, format)}: ` : `${kind} ${captionNumber(number, format)}: `;
  editor.chain().focus().insertContentAt(at, {
    type: 'paragraph',
    attrs: { textAlign: 'center', captionKind: kind, captionFormat: format },
    content: [{ type: 'text', text: head, marks: [{ type: 'bold' }, { type: 'italic' }] }, ...(text ? [{ type: 'text', text, marks: [{ type: 'italic' }] }] : [])],
  }).run();
  renumberCaptions(editor);
}

export function renumberCaptions(editor: Editor) {
  const counters = new Map<string, number>();
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    const kind = node.attrs?.captionKind;
    if (!kind) return true;
    const next = (counters.get(String(kind)) ?? 0) + 1;
    counters.set(String(kind), next);
    const first = node.firstChild;
    if (first?.isText && first.text) {
      const match = /^(.*?)([\p{L}\p{N}]+)(:\s*)/u.exec(first.text);
      if (match) {
        const label = captionNumber(next, String(node.attrs.captionFormat ?? 'decimal'));
        if (match[2] !== label) {
          const from = tr.mapping.map(pos + 1 + match[1].length);
          tr.insertText(label, from, from + match[2].length);
          changed = true;
        }
      }
    }
    return false;
  });
  if (changed) editor.view.dispatch(tr);
  return changed;
}

export function updateFigures(ctx: DocCtx) {
  renumberCaptions(ctx.editor);
  const count = updateLists(ctx, ['figureList']);
  ctx.ui.toast(count ? 'Đã đánh lại số nhãn và cập nhật danh mục' : 'Đã đánh lại số nhãn. Tài liệu chưa có danh mục hình.');
}

export function updateIndex(ctx: DocCtx) {
  const count = updateLists(ctx, ['docIndex']);
  ctx.ui.toast(count ? 'Đã cập nhật chỉ mục' : 'Tài liệu chưa có chỉ mục', !count);
}

export function updateAuthorities(ctx: DocCtx) {
  const count = updateLists(ctx, ['authorityList']);
  ctx.ui.toast(count ? 'Đã cập nhật danh mục viện dẫn' : 'Tài liệu chưa có danh mục viện dẫn', !count);
}

const occurrences = (editor: Editor, term: string) => {
  const positions: number[] = [];
  const needle = term.toLocaleLowerCase('vi');
  if (!needle) return positions;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const haystack = node.text.toLocaleLowerCase('vi');
    let index = haystack.indexOf(needle);
    while (index >= 0) {
      positions.push(pos + index + needle.length);
      index = haystack.indexOf(needle, index + needle.length);
    }
    return false;
  });
  return positions;
};

export async function markEntryPrompt(ctx: DocCtx) {
  const { editor } = ctx;
  const { from, to } = editor.state.selection;
  const selected = editor.state.doc.textBetween(from, to, ' ').trim();
  const res = await ctx.ui.ask({
    title: 'Đánh dấu mục chỉ mục',
    fields: [
      { name: 'term', label: 'Mục chính', value: selected },
      { name: 'sub', label: 'Mục phụ (không bắt buộc)' },
      { name: 'all', label: 'Đánh dấu mọi lần xuất hiện của từ này', type: 'checkbox', value: false },
    ],
    confirmText: 'Đánh dấu',
    validate: (values) => (String(values.term).trim() ? null : 'Hãy nhập mục chính'),
  });
  if (!res) return;
  const main = String(res.term).trim();
  const sub = String(res.sub ?? '').trim();
  const term = sub ? `${main}: ${sub}` : main;
  if (!res.all) {
    editor.chain().focus().setTextSelection(to).insertIndexEntry(term).run();
    return;
  }
  const positions = occurrences(editor, selected || main);
  const type = editor.schema.nodes.indexEntry;
  const tr = editor.state.tr;
  [...positions].reverse().forEach((pos) => tr.insert(pos, type.create({ term })));
  if (positions.length) editor.view.dispatch(tr);
  ctx.ui.toast(`Đã đánh dấu ${positions.length} vị trí`);
}

export function insertAuthority(ctx: DocCtx, attrs: { text: string; short: string; category: string }, all: boolean) {
  const { editor } = ctx;
  if (!all) {
    editor.chain().focus().setTextSelection(editor.state.selection.to).insertAuthorityEntry(attrs).run();
    return 1;
  }
  const positions = [...new Set([...occurrences(editor, attrs.text), ...(attrs.short ? occurrences(editor, attrs.short) : [])])].sort((a, b) => a - b);
  const type = editor.schema.nodes.authorityEntry;
  const tr = editor.state.tr;
  [...positions].reverse().forEach((pos) => tr.insert(pos, type.create(attrs)));
  if (positions.length) editor.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(editor.state.selection.from))));
  return positions.length;
}
