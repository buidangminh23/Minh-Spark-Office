import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import type { DocCtx } from './DocContext';

export const UNDERLINE_STYLES = [
  { id: 'solid', label: 'Nét đơn' },
  { id: 'double', label: 'Nét đôi' },
  { id: 'dotted', label: 'Chấm' },
  { id: 'dashed', label: 'Gạch' },
  { id: 'wavy', label: 'Lượn sóng' },
];

export const TEXT_EFFECTS = [
  { id: '', label: 'Không hiệu ứng', shadow: null },
  { id: 'shadow', label: 'Bóng đổ', shadow: '1px 1px 2px rgba(0,0,0,0.35)' },
  { id: 'glow', label: 'Phát sáng xanh', shadow: '0 0 4px #60a5fa, 0 0 8px #93c5fd' },
  { id: 'glow-gold', label: 'Phát sáng vàng', shadow: '0 0 4px #f59e0b, 0 0 8px #fcd34d' },
  { id: 'outline', label: 'Viền chữ', shadow: '-1px -1px 0 #1f2430, 1px -1px 0 #1f2430, -1px 1px 0 #1f2430, 1px 1px 0 #1f2430' },
  { id: 'emboss', label: 'Chạm nổi', shadow: '-1px -1px 0 rgba(255,255,255,0.9), 1px 1px 1px rgba(0,0,0,0.35)' },
];

export const PARAGRAPH_BORDERS = [
  { id: 'bottom', label: 'Viền dưới' },
  { id: 'top', label: 'Viền trên' },
  { id: 'left', label: 'Viền trái' },
  { id: 'right', label: 'Viền phải' },
  { id: 'top,bottom', label: 'Viền trên và dưới' },
  { id: 'box', label: 'Viền hộp' },
  { id: '', label: 'Không viền' },
];

export const MULTILEVEL_LISTS = [
  { id: 'multi-outline', label: '1.  a.  i.  (đề cương)' },
  { id: 'multi-legal', label: '1.  1.1.  1.1.1.  (văn bản pháp lý)' },
];

export function setUnderline(ctx: DocCtx, style: string) {
  const chain = ctx.editor.chain().focus();
  if (style === 'solid') chain.setUnderline().setMark('textStyle', { underlineStyle: null, underlineColor: null }).run();
  else chain.unsetUnderline().setMark('textStyle', { underlineStyle: style }).run();
}

export function setTextEffect(ctx: DocCtx, shadow: string | null) {
  ctx.editor.chain().focus().setMark('textStyle', { textShadow: shadow }).run();
}

export function setParagraphBorder(ctx: DocCtx, sides: string) {
  const attrs = ctx.editor.getAttributes('paragraph');
  ctx.editor.chain().focus().setParagraphAttrs({
    borderSides: sides || null,
    borderStyle: sides ? String(attrs.borderStyle ?? 'solid') : null,
    borderColor: sides ? String(attrs.borderColor ?? '#334155') : null,
    borderWidth: sides ? Number(attrs.borderWidth ?? 1) : null,
  }).run();
}

export function setMultilevel(ctx: DocCtx, style: string) {
  const chain = ctx.editor.chain().focus();
  if (!ctx.editor.isActive('orderedList')) chain.toggleOrderedList();
  chain.updateAttributes('orderedList', { listStyle: style }).run();
}

export function changeListLevel(ctx: DocCtx, deeper: boolean) {
  const type = ctx.editor.isActive('taskItem') ? 'taskItem' : 'listItem';
  const done = deeper ? ctx.editor.chain().focus().sinkListItem(type).run() : ctx.editor.chain().focus().liftListItem(type).run();
  if (!done) ctx.ui.toast(deeper ? 'Mục đầu danh sách không xuống cấp được' : 'Đang ở cấp cao nhất', true);
}

const OBJECT_TYPES: Record<string, string> = { image: 'Ảnh', table: 'Bảng', textBox: 'Hộp văn bản', equation: 'Công thức', shape: 'Hình vẽ', chart: 'Biểu đồ', drawing: 'Nét vẽ' };

export type DocObject = { pos: number; type: string; label: string };

export function listObjects(doc: PMNode): DocObject[] {
  const counts: Record<string, number> = {};
  const out: DocObject[] = [];
  doc.descendants((node, pos) => {
    const name = OBJECT_TYPES[node.type.name];
    if (!name) return true;
    counts[node.type.name] = (counts[node.type.name] ?? 0) + 1;
    const hint = node.type.name === 'image' ? String(node.attrs.alt ?? '').trim() : node.textContent.trim().slice(0, 28);
    out.push({ pos, type: node.type.name, label: `${name} ${counts[node.type.name]}${hint ? ` · ${hint}` : ''}` });
    return node.type.name !== 'table';
  });
  return out;
}

export function selectObject(ctx: DocCtx, object: DocObject) {
  const { state } = ctx.editor;
  const node = state.doc.nodeAt(object.pos);
  if (!node) return;
  let selection;
  if (node.type.name === 'table') {
    const map = TableMap.get(node);
    selection = CellSelection.create(state.doc, object.pos + 1 + map.map[0], object.pos + 1 + map.map[map.map.length - 1]);
  } else if (NodeSelection.isSelectable(node)) {
    selection = NodeSelection.create(state.doc, object.pos);
  } else {
    selection = TextSelection.create(state.doc, object.pos + 1, object.pos + node.nodeSize - 1);
  }
  ctx.editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
  ctx.editor.view.focus();
}

export function selectNextObject(ctx: DocCtx) {
  const objects = listObjects(ctx.editor.state.doc);
  if (!objects.length) {
    ctx.ui.toast('Tài liệu chưa có ảnh, bảng, hộp văn bản hay công thức nào', true);
    return;
  }
  const from = ctx.editor.state.selection.from;
  selectObject(ctx, objects.find((item) => item.pos > from) ?? objects[0]);
}

export async function selectionPane(ctx: DocCtx) {
  const objects = listObjects(ctx.editor.state.doc);
  if (!objects.length) {
    ctx.ui.toast('Tài liệu chưa có ảnh, bảng, hộp văn bản hay công thức nào', true);
    return;
  }
  const res = await ctx.ui.ask({
    title: `Ngăn chọn · ${objects.length} đối tượng`,
    fields: [{ name: 'pick', label: 'Chọn đối tượng để đi tới và chọn', type: 'select', value: String(objects[0].pos), options: objects.map((item) => ({ value: String(item.pos), label: item.label })) }],
    confirmText: 'Chọn',
  });
  if (!res) return;
  const picked = objects.find((item) => String(item.pos) === String(res.pick));
  if (picked) selectObject(ctx, picked);
}
