import type { Node as PMNode } from '@tiptap/pm/model';
import { getPagination } from './pagination';
import { AUTHOR, newId, type DocCtx } from './DocContext';
import { saveFile, type FileMeta } from '../../lib/storage';

type TableContext = { table: PMNode; pos: number; rowIndex: number; colIndex: number };

export function tableContext(ctx: DocCtx): TableContext | null {
  const { $from } = ctx.editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'table') {
      return { table: $from.node(depth), pos: $from.before(depth), rowIndex: $from.index(depth), colIndex: $from.index(depth + 1) };
    }
  }
  return null;
}

const parseNumber = (text: string) => {
  const value = text.trim().replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(value)) return null;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : /^-?\d{1,3}(\.\d{3})+$/.test(value) ? value.replace(/\./g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

export async function sortTable(ctx: DocCtx) {
  const context = tableContext(ctx);
  if (!context) return;
  const res = await ctx.ui.ask({
    title: 'Sắp xếp bảng',
    message: 'Sắp xếp các hàng theo cột đang đặt con trỏ. Hàng tiêu đề giữ nguyên.',
    fields: [{ name: 'order', label: 'Thứ tự', type: 'select', value: 'asc', options: [{ value: 'asc', label: 'Tăng dần (A→Z, 0→9)' }, { value: 'desc', label: 'Giảm dần (Z→A, 9→0)' }] }],
    confirmText: 'Sắp xếp',
  });
  if (!res) return;
  const rows: PMNode[] = [];
  context.table.forEach((row) => rows.push(row));
  const hasHeader = rows[0]?.firstChild?.type.name === 'tableHeader';
  const head = hasHeader ? rows.slice(0, 1) : [];
  const body = hasHeader ? rows.slice(1) : rows;
  const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  const cellText = (row: PMNode) => row.maybeChild(context.colIndex)?.textContent ?? '';
  const direction = res.order === 'desc' ? -1 : 1;
  const sorted = [...body].sort((a, b) => {
    const x = parseNumber(cellText(a));
    const y = parseNumber(cellText(b));
    return (x !== null && y !== null ? x - y : collator.compare(cellText(a), cellText(b))) * direction;
  });
  const next = context.table.type.create(context.table.attrs, [...head, ...sorted]);
  ctx.editor.view.dispatch(ctx.editor.state.tr.replaceWith(context.pos, context.pos + context.table.nodeSize, next));
}

export async function insertTableFormula(ctx: DocCtx) {
  const context = tableContext(ctx);
  if (!context) return;
  const res = await ctx.ui.ask({
    title: 'Công thức trong bảng',
    message: 'Tính từ các ô số phía trên hoặc bên trái ô đang chọn. Kết quả được chèn vào ô, không tự cập nhật khi số thay đổi.',
    fields: [
      { name: 'fn', label: 'Hàm', type: 'select', value: 'sum', options: [{ value: 'sum', label: 'Tổng (SUM)' }, { value: 'avg', label: 'Trung bình (AVERAGE)' }, { value: 'count', label: 'Đếm (COUNT)' }, { value: 'max', label: 'Lớn nhất (MAX)' }, { value: 'min', label: 'Nhỏ nhất (MIN)' }] },
      { name: 'dir', label: 'Vùng tính', type: 'select', value: 'above', options: [{ value: 'above', label: 'Các ô phía trên' }, { value: 'left', label: 'Các ô bên trái' }] },
    ],
    confirmText: 'Chèn kết quả',
  });
  if (!res) return;
  const values: number[] = [];
  if (res.dir === 'above') {
    context.table.forEach((row, _offset, index) => {
      if (index >= context.rowIndex) return;
      const value = parseNumber(row.maybeChild(context.colIndex)?.textContent ?? '');
      if (value !== null) values.push(value);
    });
  } else {
    context.table.child(context.rowIndex).forEach((cell, _offset, index) => {
      if (index >= context.colIndex) return;
      const value = parseNumber(cell.textContent);
      if (value !== null) values.push(value);
    });
  }
  if (!values.length) {
    ctx.ui.toast('Không có ô số nào trong vùng đã chọn', true);
    return;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  const result = { sum, avg: sum / values.length, count: values.length, max: Math.max(...values), min: Math.min(...values) }[String(res.fn) as 'sum'];
  ctx.editor.chain().focus().insertContent(result.toLocaleString('vi-VN', { maximumFractionDigits: 2 })).run();
}

export function distributeColumns(ctx: DocCtx) {
  const context = tableContext(ctx);
  if (!context) return;
  const { tr, schema } = ctx.editor.state;
  const inner = context.pos + 1;
  context.table.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset) => {
      tr.setNodeMarkup(inner + rowOffset + 1 + cellOffset, schema.nodes[cell.type.name], { ...cell.attrs, colwidth: null });
    });
  });
  ctx.editor.view.dispatch(tr);
}

export function tableToText(ctx: DocCtx) {
  const context = tableContext(ctx);
  if (!context) return;
  const paragraphs: PMNode[] = [];
  const { schema } = ctx.editor.state;
  context.table.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cell.textContent));
    const text = cells.join('\t');
    paragraphs.push(schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined));
  });
  ctx.editor.view.dispatch(ctx.editor.state.tr.replaceWith(context.pos, context.pos + context.table.nodeSize, paragraphs));
}

export function textToTable(ctx: DocCtx) {
  const { editor } = ctx;
  const { from, to, $from, $to } = editor.state.selection;
  if (from === to) {
    ctx.ui.toast('Bôi chọn các dòng có dấu Tab hoặc dấu phẩy để chuyển thành bảng', true);
    return;
  }
  const lines: string[] = [];
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock) lines.push(node.textContent);
    return true;
  });
  const separator = lines.some((line) => line.includes('\t')) ? '\t' : lines.some((line) => line.includes(';')) ? ';' : ',';
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim()));
  const cols = Math.max(...rows.map((row) => row.length));
  const content = rows.map((row, rowIndex) => ({
    type: 'tableRow',
    content: Array.from({ length: cols }, (_, col) => ({
      type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
      content: [{ type: 'paragraph', content: row[col] ? [{ type: 'text', text: row[col] }] : [] }],
    })),
  }));
  editor.chain().focus().insertContentAt({ from: $from.before(1), to: $to.after(1) }, { type: 'table', content }).run();
}

export async function insertEndnote(ctx: DocCtx) {
  const res = await ctx.ui.ask({ title: 'Chèn chú thích cuối tài liệu', fields: [{ name: 'text', label: 'Nội dung', type: 'textarea' }], confirmText: 'Chèn' });
  const text = String(res?.text ?? '').trim();
  if (!text) return;
  const { editor } = ctx;
  editor.chain().focus().insertFootnote(text, 'end').run();
  let hasList = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'endnoteList') hasList = true;
    return !hasList;
  });
  if (!hasList) editor.chain().insertContentAt(editor.state.doc.content.size, [{ type: 'endnoteList' }]).run();
}

export async function markIndexEntry(ctx: DocCtx) {
  const { editor } = ctx;
  const { from, to } = editor.state.selection;
  const res = await ctx.ui.ask({ title: 'Đánh dấu mục chỉ mục', fields: [{ name: 'term', label: 'Mục', value: editor.state.doc.textBetween(from, to, ' ').trim() }], confirmText: 'Đánh dấu' });
  const term = String(res?.term ?? '').trim();
  if (term) editor.chain().focus().setTextSelection(to).insertIndexEntry(term).run();
}

export async function insertBookmarkPrompt(ctx: DocCtx) {
  const res = await ctx.ui.ask({ title: 'Dấu trang', message: 'Đặt tên dấu trang để nhảy tới hoặc tạo tham chiếu chéo.', fields: [{ name: 'name', label: 'Tên (không dấu cách)', placeholder: 'muc-tieu' }], confirmText: 'Thêm' });
  const name = String(res?.name ?? '').trim().replace(/\s+/g, '-');
  if (name) ctx.editor.chain().focus().insertBookmark(name).run();
}

export async function insertChip(ctx: DocCtx, kind: 'date' | 'person' | 'status' | 'place' | 'file') {
  if (kind === 'status') {
    const res = await ctx.ui.ask({ title: 'Danh sách thả xuống', fields: [{ name: 'options', label: 'Các lựa chọn, cách nhau bằng dấu phẩy', value: 'Chưa bắt đầu, Đang làm, Chờ duyệt, Hoàn thành' }], confirmText: 'Chèn' });
    const options = String(res?.options ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    if (options.length) ctx.editor.chain().focus().insertSmartChip({ kind, value: options[0], options: options.join('|') }).run();
    return;
  }
  const label = { date: 'Ngày', person: 'Người', place: 'Địa điểm', file: 'Tên tệp' }[kind];
  const res = await ctx.ui.ask({ title: `Chip ${label.toLowerCase()}`, fields: [{ name: 'value', label, value: kind === 'date' ? new Date().toLocaleDateString('vi-VN') : kind === 'person' ? AUTHOR : '' }], confirmText: 'Chèn' });
  const value = String(res?.value ?? '').trim();
  if (value) ctx.editor.chain().focus().insertSmartChip({ kind, value }).run();
}

export async function editNodeAt(ctx: DocCtx, node: PMNode, pos: number) {
  const { editor } = ctx;
  const setAttrs = (attrs: Record<string, unknown>) => editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
  switch (node.type.name) {
    case 'equation':
      ctx.setEditing({ pos, attrs: node.attrs });
      ctx.openDialog('equation');
      return true;
    case 'footnote': {
      const res = await ctx.ui.ask({ title: node.attrs.kind === 'end' ? 'Sửa chú thích cuối' : 'Sửa chú thích cuối trang', fields: [{ name: 'text', label: 'Nội dung', type: 'textarea', value: String(node.attrs.text) }], confirmText: 'Lưu' });
      if (res) setAttrs({ text: String(res.text) });
      return true;
    }
    case 'smartChip': {
      const options = String(node.attrs.options ?? '').split('|').filter(Boolean);
      const res = await ctx.ui.ask(options.length
        ? { title: 'Chọn giá trị', fields: [{ name: 'value', label: 'Giá trị', type: 'select', value: String(node.attrs.value), options: options.map((item) => ({ value: item, label: item })) }], confirmText: 'Chọn' }
        : { title: 'Sửa chip', fields: [{ name: 'value', label: 'Giá trị', value: String(node.attrs.value) }], confirmText: 'Lưu' });
      if (res) setAttrs({ value: String(res.value) });
      return true;
    }
    case 'bookmark': {
      const res = await ctx.ui.ask({ title: 'Sửa dấu trang', fields: [{ name: 'name', label: 'Tên', value: String(node.attrs.name) }], confirmText: 'Lưu' });
      if (res) setAttrs({ name: String(res.name).trim().replace(/\s+/g, '-') });
      return true;
    }
    case 'indexEntry': {
      const res = await ctx.ui.ask({ title: 'Sửa mục chỉ mục', fields: [{ name: 'term', label: 'Mục', value: String(node.attrs.term) }], confirmText: 'Lưu' });
      if (res) setAttrs({ term: String(res.term).trim() });
      return true;
    }
    default:
      return false;
  }
}

export const jumpToPage = (ctx: DocCtx, target: number) => {
  const paper = document.querySelector('.doc-paper');
  const sheet = paper?.querySelectorAll('.page-sheet')[target - 1] as HTMLElement | undefined;
  sheet?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const breaks = getPagination(ctx.editor).result.breaks;
  const pos = target <= 1 ? 1 : breaks[target - 2]?.pos ?? 1;
  ctx.editor.commands.focus();
  ctx.editor.commands.setTextSelection(Math.min(pos + 1, ctx.editor.state.doc.content.size));
};

export async function makeCopy(ctx: DocCtx) {
  const name = `Bản sao của ${ctx.title}`;
  const meta: FileMeta = { ...ctx.meta, id: newId('doc'), name, createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false };
  await saveFile(meta, { kind: 'doc', json: ctx.editor.getJSON(), page: ctx.page, comments: ctx.comments });
  ctx.ui.toast(`Đã tạo "${name}" trong danh sách tệp`);
}

export async function bakeInkToImage(ctx: DocCtx) {
  const strokes = ctx.page.ink ?? [];
  if (!strokes.length) {
    ctx.ui.toast('Chưa có nét vẽ nào trên trang', true);
    return;
  }
  const all = strokes.flatMap((s) => s.points);
  const xs = all.filter((_, i) => i % 2 === 0);
  const ys = all.filter((_, i) => i % 2 === 1);
  const pad = 8;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) + pad - minX;
  const height = Math.max(...ys) + pad - minY;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const c = canvas.getContext('2d');
  if (!c) return;
  c.scale(2, 2);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const stroke of strokes) {
    c.beginPath();
    c.strokeStyle = stroke.color;
    c.lineWidth = stroke.width;
    c.globalAlpha = stroke.opacity;
    for (let i = 0; i < stroke.points.length; i += 2) {
      const x = stroke.points[i] - minX;
      const y = stroke.points[i + 1] - minY;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  ctx.editor.chain().focus().setImage({ src: canvas.toDataURL('image/png'), alt: 'Nét vẽ tay' }).run();
  ctx.setPage({ ink: [] });
  ctx.setView({ inkTool: null });
  ctx.ui.toast('Đã chuyển nét vẽ thành ảnh tại vị trí con trỏ');
}
