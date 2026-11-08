import { NODE_EDITORS } from './nodeEditors';
import { shapeDataUrl, type ShapeSpec } from './insertShapes';

const parseMeta = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as { kind?: string } & Record<string, unknown>;
  } catch {
    return null;
  }
};

NODE_EDITORS.image = (ctx, node, pos) => {
  const meta = parseMeta(node.attrs.meta);
  if (!meta?.kind) return false;
  if (meta.kind === 'smartart' || meta.kind === 'wordart' || meta.kind === 'model3d' || meta.kind === 'chart') {
    ctx.setEditing({ pos, attrs: { meta } });
    ctx.openDialog(meta.kind);
    return true;
  }
  if (meta.kind === 'shape') {
    const spec = meta as unknown as ShapeSpec;
    void ctx.ui.ask({
      title: 'Sửa hình',
      fields: [
        { name: 'text', label: 'Chữ trong hình (mỗi dòng một hàng)', type: 'textarea', value: spec.text ?? '' },
        { name: 'fill', label: 'Màu tô, ví dụ #dbe6fb', value: spec.fill },
        { name: 'stroke', label: 'Màu viền, ví dụ #2b579a', value: spec.stroke },
        { name: 'textColor', label: 'Màu chữ, ví dụ #1f2430', value: spec.textColor ?? '#1f2430' },
      ],
      confirmText: 'Áp dụng',
    }).then((res) => {
      if (!res) return;
      const next: ShapeSpec = { id: spec.id, text: String(res.text), fill: String(res.fill) || spec.fill, stroke: String(res.stroke) || spec.stroke, textColor: String(res.textColor) || '#1f2430' };
      const current = ctx.editor.state.doc.nodeAt(pos);
      if (current?.type.name === 'image') ctx.editor.view.dispatch(ctx.editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, src: shapeDataUrl(next), meta: JSON.stringify({ kind: 'shape', ...next }) }));
    });
    return true;
  }
  return false;
};
