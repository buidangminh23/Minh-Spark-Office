import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { DocCtx } from './DocContext';
import { pageGap } from './pagination';
import { pageDimensions } from './ui/Paper';

export type WrapKind = 'inline' | 'square' | 'tight' | 'through' | 'topBottom' | 'behind' | 'front';
export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type BreakKind = 'page' | 'column' | 'wrap' | 'next' | 'continuous' | 'even' | 'odd';
export type ZOrder = 'forward' | 'front' | 'backward' | 'back' | 'frontText' | 'behindText';

export const WRAP_LABELS: Record<WrapKind, string> = {
  inline: 'Cùng dòng với chữ',
  square: 'Bao quanh hình vuông',
  tight: 'Bao sát',
  through: 'Bao xuyên',
  topBottom: 'Trên và dưới',
  behind: 'Sau chữ',
  front: 'Trước chữ',
};

export const selectedImage = (editor: Editor) => {
  const { selection } = editor.state;
  return selection instanceof NodeSelection && selection.node.type.name === 'image' ? { pos: selection.from, node: selection.node } : null;
};

export const wrapOf = (attrs: Record<string, unknown>): WrapKind => {
  if (attrs.wrap) return attrs.wrap as WrapKind;
  if (attrs.align === 'left' || attrs.align === 'right') return 'square';
  return attrs.align === 'center' ? 'topBottom' : 'inline';
};

export function patchObject(editor: Editor, pos: number, patch: Record<string, unknown>, history = true) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const wasSelected = editor.state.selection instanceof NodeSelection && editor.state.selection.from === pos;
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
  if (wasSelected) tr.setSelection(NodeSelection.create(tr.doc, pos));
  if (!history) tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

const outerDom = (editor: Editor, pos: number) => {
  const dom = editor.view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom : null;
};

const zoomOf = (dom: HTMLElement) => parseFloat(dom.closest<HTMLElement>('.paper-zoom')?.style.zoom ?? '') || 1;

const paperPoint = (dom: HTMLElement) => {
  const paper = dom.closest<HTMLElement>('.doc-paper');
  if (!paper) return null;
  const zoom = zoomOf(dom);
  const rect = dom.getBoundingClientRect();
  const origin = paper.getBoundingClientRect();
  return { paper, x: (rect.left - origin.left) / zoom, y: (rect.top - origin.top) / zoom, width: rect.width / zoom, height: rect.height / zoom };
};

const nudge = (editor: Editor, pos: number, dx: number, dy: number) => {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  patchObject(editor, pos, { offsetX: Math.round((Number(node.attrs.offsetX) || 0) + dx), offsetY: Math.round((Number(node.attrs.offsetY) || 0) + dy) }, false);
};

const afterPaint = (task: () => void) => requestAnimationFrame(() => requestAnimationFrame(task));

export function setWrap(ctx: DocCtx, kind: WrapKind) {
  const { editor } = ctx;
  const selected = selectedImage(editor);
  if (!selected) return;
  const { pos, node } = selected;
  const align = node.attrs.align;
  if (kind === 'inline') return patchObject(editor, pos, { wrap: null, position: null, align: 'inline', offsetX: 0, offsetY: 0, zIndex: 0 });
  if (kind === 'topBottom') return patchObject(editor, pos, { wrap: kind, position: null, align: align === 'left' || align === 'right' ? align : 'center', offsetX: 0, offsetY: 0 });
  if (kind === 'square' || kind === 'tight' || kind === 'through') return patchObject(editor, pos, { wrap: kind, align: align === 'right' ? 'right' : 'left', offsetX: 0, offsetY: 0 });
  const before = outerDom(editor, pos);
  const start = before ? paperPoint(before) : null;
  patchObject(editor, pos, { wrap: kind, align: 'inline' });
  afterPaint(() => {
    const dom = outerDom(editor, pos);
    const now = dom ? paperPoint(dom) : null;
    if (start && now) nudge(editor, pos, start.x - now.x, start.y - now.y);
  });
}

const targetWrap = (current: WrapKind, h?: HAlign): WrapKind => {
  if (current === 'behind' || current === 'front') return current;
  if (h === 'center') return 'front';
  return current === 'inline' || current === 'topBottom' ? 'square' : current;
};

export function placeImage(ctx: DocCtx, target: { h?: HAlign; v?: VAlign }, position?: string) {
  const { editor, page } = ctx;
  const selected = selectedImage(editor);
  if (!selected) return;
  const { pos, node } = selected;
  const wrap = targetWrap(wrapOf(node.attrs), target.h);
  const align = wrap === 'behind' || wrap === 'front' ? 'inline' : target.h === 'right' ? 'right' : target.h === 'left' ? 'left' : node.attrs.align === 'right' ? 'right' : 'left';
  patchObject(editor, pos, { wrap, align, position: position ?? null, ...(target.h ? { offsetX: 0 } : {}), ...(target.v ? { offsetY: 0 } : {}) });
  afterPaint(() => {
    const dom = outerDom(editor, pos);
    const now = dom ? paperPoint(dom) : null;
    if (!now) return;
    const dims = pageDimensions(page.size, page.orientation);
    const span = now.paper.classList.contains('paged') ? dims.height + pageGap() : dims.height;
    const index = Math.max(0, Math.floor(now.y / span));
    const margins = page.margins;
    const contentWidth = dims.width - margins.left - margins.right;
    const contentHeight = dims.height - margins.top - margins.bottom;
    const x = target.h === 'left' ? margins.left : target.h === 'center' ? margins.left + (contentWidth - now.width) / 2 : target.h === 'right' ? dims.width - margins.right - now.width : now.x;
    const top = index * span + margins.top;
    const y = target.v === 'top' ? top : target.v === 'middle' ? top + (contentHeight - now.height) / 2 : target.v === 'bottom' ? top + contentHeight - now.height : now.y;
    nudge(editor, pos, x - now.x, y - now.y);
  });
}

const zRange = (doc: PMNode) => {
  let low = 0;
  let high = 0;
  doc.descendants((node) => {
    if (node.type.name === 'image') {
      low = Math.min(low, Number(node.attrs.zIndex) || 0);
      high = Math.max(high, Number(node.attrs.zIndex) || 0);
    }
    return true;
  });
  return { low, high };
};

export function zOrder(ctx: DocCtx, action: ZOrder) {
  const { editor } = ctx;
  const selected = selectedImage(editor);
  if (!selected) return;
  const { pos, node } = selected;
  if (action === 'frontText' || action === 'behindText') return setWrap(ctx, action === 'frontText' ? 'front' : 'behind');
  const { low, high } = zRange(editor.state.doc);
  const current = Number(node.attrs.zIndex) || 0;
  const zIndex = action === 'forward' ? current + 1 : action === 'backward' ? current - 1 : action === 'front' ? high + 1 : low - 1;
  const wrap = wrapOf(node.attrs);
  if (wrap === 'inline' || wrap === 'topBottom') setWrap(ctx, 'front');
  const fresh = editor.state.doc.nodeAt(pos);
  if (fresh) patchObject(editor, pos, { zIndex });
}

export function rotateImage(ctx: DocCtx, degrees: number) {
  const selected = selectedImage(ctx.editor);
  if (!selected) return;
  const next = (((Number(selected.node.attrs.rotate) || 0) + degrees) % 360 + 360) % 360;
  patchObject(ctx.editor, selected.pos, { rotate: next });
}

export function flipImage(ctx: DocCtx, axis: 'flipH' | 'flipV') {
  const selected = selectedImage(ctx.editor);
  if (selected) patchObject(ctx.editor, selected.pos, { [axis]: !selected.node.attrs[axis] });
}

export async function rotateCustom(ctx: DocCtx) {
  const selected = selectedImage(ctx.editor);
  if (!selected) return;
  const res = await ctx.ui.ask({ title: 'Xoay ảnh', fields: [{ name: 'deg', label: 'Góc xoay (độ)', type: 'number', value: Number(selected.node.attrs.rotate) || 0, min: -360, max: 360 }], confirmText: 'Áp dụng' });
  if (res) patchObject(ctx.editor, selected.pos, { rotate: ((Number(res.deg) || 0) % 360 + 360) % 360 });
}

export const imagesInSelection = (editor: Editor) => {
  const { from, to } = editor.state.selection;
  const items: { pos: number; node: PMNode }[] = [];
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'image') items.push({ pos, node });
    return true;
  });
  return items;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('load'));
  image.src = src;
});

const GROUP_SCALE = 2;

export async function groupImages(ctx: DocCtx) {
  const { editor } = ctx;
  const items = imagesInSelection(editor);
  if (items.length < 2) return ctx.ui.toast('Hãy bôi chọn ít nhất 2 ảnh để nhóm', true);
  const boxes = items.map((item) => {
    const dom = outerDom(editor, item.pos);
    return dom ? paperPoint(dom) : null;
  });
  if (boxes.some((box) => !box)) return ctx.ui.toast('Không đo được vị trí ảnh', true);
  const placed = boxes as NonNullable<(typeof boxes)[number]>[];
  const left = Math.min(...placed.map((b) => b.x));
  const top = Math.min(...placed.map((b) => b.y));
  const width = Math.max(...placed.map((b) => b.x + b.width)) - left;
  const height = Math.max(...placed.map((b) => b.y + b.height)) - top;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * GROUP_SCALE);
  canvas.height = Math.ceil(height * GROUP_SCALE);
  const paint = canvas.getContext('2d');
  if (!paint) return;
  try {
    for (const [index, item] of items.entries()) {
      const box = placed[index];
      const image = await loadImage(String(item.node.attrs.src));
      paint.save();
      paint.scale(GROUP_SCALE, GROUP_SCALE);
      paint.translate(box.x - left + box.width / 2, box.y - top + box.height / 2);
      paint.rotate(((Number(item.node.attrs.rotate) || 0) * Math.PI) / 180);
      paint.scale(item.node.attrs.flipH ? -1 : 1, item.node.attrs.flipV ? -1 : 1);
      paint.drawImage(image, -box.width / 2, -box.height / 2, box.width, box.height);
      paint.restore();
    }
    const src = canvas.toDataURL('image/png');
    const first = items[0];
    const tr = editor.state.tr;
    for (const item of [...items].reverse()) tr.delete(item.pos, item.pos + item.node.nodeSize);
    const grouped = editor.schema.nodes.image.create({ src, alt: `Nhóm ${items.length} ảnh`, width: `${Math.round(width)}px`, wrap: first.node.attrs.wrap, align: first.node.attrs.align, offsetX: first.node.attrs.offsetX, offsetY: first.node.attrs.offsetY, zIndex: first.node.attrs.zIndex, groupItems: items.map((item) => item.node.attrs) });
    const at = tr.mapping.map(first.pos);
    tr.insert(at, grouped);
    tr.setSelection(NodeSelection.create(tr.doc, at));
    editor.view.dispatch(tr);
    ctx.ui.toast(`Đã nhóm ${items.length} ảnh`);
  } catch {
    ctx.ui.toast('Có ảnh lấy từ web không cho phép ghép. Hãy tải ảnh đó về máy rồi chèn lại.', true);
  }
}

export function ungroupImage(ctx: DocCtx) {
  const { editor } = ctx;
  const selected = selectedImage(editor);
  const list = selected?.node.attrs.groupItems as Record<string, unknown>[] | null | undefined;
  if (!selected || !list?.length) return ctx.ui.toast('Ảnh đang chọn không phải một nhóm', true);
  const nodes = list.map((attrs) => editor.schema.nodes.image.create(attrs));
  editor.view.dispatch(editor.state.tr.replaceWith(selected.pos, selected.pos + selected.node.nodeSize, nodes));
  ctx.ui.toast(`Đã tách thành ${list.length} ảnh`);
}

export type ObjectRow = { pos: number; kind: 'image' | 'textBox'; name: string; hidden: boolean; wrap: string; z: number };

export function listObjects(doc: PMNode) {
  const rows: ObjectRow[] = [];
  let images = 0;
  let boxes = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === 'image') {
      images += 1;
      rows.push({ pos, kind: 'image', name: String(node.attrs.name ?? '') || `Ảnh ${images}`, hidden: Boolean(node.attrs.hidden), wrap: wrapOf(node.attrs), z: Number(node.attrs.zIndex) || 0 });
    } else if (node.type.name === 'textBox') {
      boxes += 1;
      rows.push({ pos, kind: 'textBox', name: String(node.attrs.name ?? '') || `Hộp chữ ${boxes}`, hidden: Boolean(node.attrs.hidden), wrap: 'textBox', z: 0 });
    }
    return true;
  });
  return rows;
}

export const insertBreak = (editor: Editor, kind: BreakKind) => editor.chain().focus().insertContent({ type: 'pageBreak', attrs: { kind } }).createParagraphNear().run();

const SIDE_NARROW_RATIO = 1 / 3;

export function insertSideColumns(ctx: DocCtx, side: 'left' | 'right') {
  const { editor, page } = ctx;
  if (editor.isActive('table')) return ctx.ui.toast('Hãy đặt con trỏ ngoài bảng', true);
  const { $from, $to, empty } = editor.state.selection;
  const dims = pageDimensions(page.size, page.orientation);
  const total = dims.width - page.margins.left - page.margins.right;
  const narrow = Math.round(total * SIDE_NARROW_RATIO);
  const wide = total - narrow;
  const range = !empty && $from.depth >= 1 ? { from: $from.before(1), to: $to.after(1) } : null;
  const blocks: JSONContent[] = range ? editor.state.doc.slice(range.from, range.to).content.toJSON() ?? [] : [];
  const cell = (width: number, content: JSONContent[]): JSONContent => ({ type: 'tableCell', attrs: { colwidth: [width] }, content: content.length ? content : [{ type: 'paragraph' }] });
  const cells = side === 'left' ? [cell(narrow, []), cell(wide, blocks)] : [cell(wide, blocks), cell(narrow, [])];
  const table: JSONContent = { type: 'table', attrs: { tableStyle: 'plain' }, content: [{ type: 'tableRow', content: cells }] };
  if (range) editor.chain().focus().insertContentAt(range, table).run();
  else editor.chain().focus().insertContent(table).run();
}
