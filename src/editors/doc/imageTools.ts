import type { DocCtx } from './DocContext';
import { applyArtEffect, dataUrlBytes, hasTransparency, removeBackground, setOpacity, targetSize, type ArtEffect, type Pixels } from './imageEffects';

const COMPRESS_TARGETS = [
  { value: 'email', label: 'Email, gọn nhất (cạnh dài 1024 px)', side: 1024 },
  { value: 'web', label: 'Web và màn hình (cạnh dài 1600 px)', side: 1600 },
  { value: 'print', label: 'In ấn (cạnh dài 2400 px)', side: 2400 },
];

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('load'));
  image.src = src;
});

const currentImage = (ctx: DocCtx) => {
  const attrs = ctx.editor.getAttributes('image');
  const src = String(attrs.src ?? '');
  if (!src) ctx.ui.toast('Chọn một ảnh trước', true);
  return src ? { src, original: attrs.originalSrc ? String(attrs.originalSrc) : null } : null;
};

const keepsAlpha = (src: string) => !src.startsWith('data:image/jpeg');

async function transform(ctx: DocCtx, edit: (pixels: Pixels) => void | 'skip', options: { maxSide?: number; forcePng?: boolean } = {}) {
  const current = currentImage(ctx);
  if (!current) return null;
  let image: HTMLImageElement;
  try {
    image = await loadImage(current.src);
  } catch {
    ctx.ui.toast('Không đọc được ảnh này', true);
    return null;
  }
  const size = targetSize(image.naturalWidth, image.naturalHeight, options.maxSide ?? Infinity);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, size.width, size.height);
  let pixels: ImageData;
  try {
    pixels = g.getImageData(0, 0, size.width, size.height);
  } catch {
    ctx.ui.toast('Ảnh từ trang web khác không cho phép sửa. Hãy tải ảnh lên từ máy.', true);
    return null;
  }
  if (edit(pixels) === 'skip') return null;
  g.putImageData(pixels, 0, 0);
  const png = options.forcePng || hasTransparency(pixels) || (keepsAlpha(current.src) && !options.maxSide);
  const url = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
  return { url, before: current.src, original: current.original };
}

const commit = (ctx: DocCtx, url: string, before: string, original: string | null) => {
  ctx.editor.chain().focus().setImageLayout({ src: url, originalSrc: original ?? before }).run();
};

export async function removeImageBackground(ctx: DocCtx) {
  const res = await ctx.ui.ask({
    title: 'Xoá nền ảnh',
    fields: [{ name: 'tolerance', label: 'Độ nhạy màu nền (1–60). Tăng nếu còn sót nền, giảm nếu ăn vào vật thể', type: 'number', value: 18, min: 1, max: 60 }],
    confirmText: 'Xoá nền',
  });
  if (!res) return;
  let cleared = 0;
  const result = await transform(ctx, (pixels) => {
    cleared = removeBackground(pixels, Number(res.tolerance) || 18);
    return cleared ? undefined : 'skip';
  }, { forcePng: true });
  if (!result) {
    if (!cleared) ctx.ui.toast('Không tìm thấy vùng nền liền mạch quanh mép ảnh', true);
    return;
  }
  commit(ctx, result.url, result.before, result.original);
  ctx.ui.toast('Đã xoá nền. Bấm Đặt lại ảnh nếu muốn lấy lại ảnh gốc');
}

export async function setImageTransparency(ctx: DocCtx) {
  const res = await ctx.ui.ask({
    title: 'Độ trong suốt',
    fields: [{ name: 'percent', label: 'Độ trong suốt (%)', type: 'number', value: 30, min: 0, max: 95 }],
    confirmText: 'Áp dụng',
  });
  if (!res) return;
  const percent = Math.max(0, Math.min(95, Number(res.percent) || 0));
  const result = await transform(ctx, (pixels) => setOpacity(pixels, 1 - percent / 100), { forcePng: true });
  if (result) commit(ctx, result.url, result.before, result.original);
}

export async function applyImageArtEffect(ctx: DocCtx, effect: ArtEffect) {
  const result = await transform(ctx, (pixels) => applyArtEffect(pixels, effect), { forcePng: effect === 'softEdges' });
  if (result) commit(ctx, result.url, result.before, result.original);
}

export async function compressImage(ctx: DocCtx) {
  const res = await ctx.ui.ask({
    title: 'Nén ảnh',
    fields: [{ name: 'target', label: 'Dùng cho', type: 'select', value: 'web', options: COMPRESS_TARGETS.map(({ value, label }) => ({ value, label })) }],
    confirmText: 'Nén',
  });
  if (!res) return;
  const side = COMPRESS_TARGETS.find((item) => item.value === res.target)?.side ?? 1600;
  const result = await transform(ctx, () => undefined, { maxSide: side });
  if (!result) return;
  const before = dataUrlBytes(result.before);
  const after = dataUrlBytes(result.url);
  if (after >= before) {
    ctx.ui.toast('Ảnh đã gọn sẵn, nén thêm không nhỏ hơn');
    return;
  }
  ctx.editor.chain().focus().setImageLayout({ src: result.url, originalSrc: null }).run();
  ctx.ui.toast(`Đã nén ảnh: ${formatBytes(before)} còn ${formatBytes(after)}`);
}

export function resetImage(ctx: DocCtx) {
  const current = currentImage(ctx);
  if (!current) return;
  ctx.editor.chain().focus().setImageLayout({ ...(current.original ? { src: current.original } : {}), originalSrc: null, frame: null }).run();
  ctx.ui.toast(current.original ? 'Đã đặt lại ảnh gốc' : 'Đã bỏ kiểu ảnh. Ảnh chưa qua chỉnh sửa nào khác');
}

const formatBytes = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
