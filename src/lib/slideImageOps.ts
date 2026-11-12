import type { ImageAdjustments, ImageCrop, SlideElement } from './slideTypes';

export const CORRECTION_PRESETS: ReadonlyArray<{ label: string; brightness: number; contrast: number }> = [-40, -20, 0, 20, 40].flatMap((brightness) =>
  [-40, -20, 0, 20, 40].map((contrast) => ({ label: `Độ sáng ${brightness > 0 ? '+' : ''}${brightness}%  Tương phản ${contrast > 0 ? '+' : ''}${contrast}%`, brightness, contrast }))
);

export const SHARPNESS_PRESETS = [-50, -25, 0, 25, 50] as const;
export const SATURATION_PRESETS = [0, 33, 66, 100, 133, 166, 200, 300, 400] as const;
export const TEMPERATURE_PRESETS = [4700, 5300, 5900, 6500, 7200, 7800, 8800, 10000, 11200] as const;

export const RECOLOR_PRESETS: ReadonlyArray<{ id: string; label: string; adjust: ImageAdjustments }> = [
  { id: 'none', label: 'Không đổi màu', adjust: {} },
  { id: 'grayscale', label: 'Thang xám', adjust: { grayscale: 100 } },
  { id: 'sepia', label: 'Nâu đỏ (Sepia)', adjust: { sepia: 100 } },
  { id: 'washout', label: 'Bạc màu', adjust: { brightness: 45, contrast: -55 } },
  { id: 'black-white', label: 'Đen trắng 50%', adjust: { grayscale: 100, contrast: 200 } },
  { id: 'blue', label: 'Tông xanh dương', adjust: { sepia: 60, hue: 180, saturation: 160 } },
  { id: 'green', label: 'Tông xanh lá', adjust: { sepia: 60, hue: 70, saturation: 150 } },
  { id: 'orange', label: 'Tông cam', adjust: { sepia: 70, hue: -10, saturation: 180 } },
  { id: 'purple', label: 'Tông tím', adjust: { sepia: 60, hue: 230, saturation: 150 } },
  { id: 'invert', label: 'Đảo màu', adjust: { invert: 100 } },
];

export const ARTISTIC_EFFECTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'none', label: 'Không có' },
  { id: 'blur', label: 'Làm mờ' },
  { id: 'pencil', label: 'Phác thảo bút chì' },
  { id: 'line-drawing', label: 'Vẽ nét' },
  { id: 'watercolor', label: 'Màu nước' },
  { id: 'posterize', label: 'Áp phích' },
  { id: 'glow-diffused', label: 'Phát sáng khuếch tán' },
  { id: 'film-grain', label: 'Hạt phim' },
  { id: 'cement', label: 'Xi măng' },
  { id: 'pastel', label: 'Phấn màu' },
  { id: 'emboss', label: 'Chạm nổi' },
  { id: 'cutout', label: 'Cắt giấy' },
];

const ARTISTIC_FILTERS: Record<string, string> = {
  blur: 'blur(3px)',
  pencil: 'grayscale(1) contrast(2.2) brightness(1.25)',
  'line-drawing': 'grayscale(1) contrast(3) brightness(1.6)',
  watercolor: 'saturate(1.6) blur(1.2px) contrast(0.95)',
  posterize: 'contrast(2) saturate(1.8)',
  'glow-diffused': 'brightness(1.25) blur(1px) saturate(1.2)',
  'film-grain': 'contrast(1.2) sepia(0.25)',
  cement: 'grayscale(0.6) contrast(1.4) brightness(0.9)',
  pastel: 'saturate(0.6) brightness(1.2) contrast(0.85)',
  emboss: 'grayscale(1) contrast(1.8)',
  cutout: 'contrast(2.4) saturate(2.2) brightness(1.05)',
};

export function imageFilterCss(adjust: ImageAdjustments | undefined): string | undefined {
  if (!adjust) return undefined;
  const parts: string[] = [];
  if (adjust.brightness) parts.push(`brightness(${1 + adjust.brightness / 100})`);
  if (adjust.contrast) parts.push(`contrast(${Math.max(0, 1 + adjust.contrast / 100)})`);
  if (adjust.saturation !== undefined && adjust.saturation !== 100) parts.push(`saturate(${adjust.saturation / 100})`);
  if (adjust.grayscale) parts.push(`grayscale(${adjust.grayscale / 100})`);
  if (adjust.sepia) parts.push(`sepia(${adjust.sepia / 100})`);
  if (adjust.hue) parts.push(`hue-rotate(${adjust.hue}deg)`);
  if (adjust.invert) parts.push(`invert(${adjust.invert / 100})`);
  if (adjust.temperature && adjust.temperature !== 6500) {
    const warm = adjust.temperature < 6500;
    const amount = Math.min(0.6, Math.abs(adjust.temperature - 6500) / 8000);
    parts.push(warm ? `sepia(${amount}) saturate(${1 + amount / 2})` : `hue-rotate(${Math.round(amount * 40)}deg) saturate(${1 + amount / 3})`);
  }
  if (adjust.sharpness && adjust.sharpness > 0) parts.push(`contrast(${1 + adjust.sharpness / 250})`);
  if (adjust.sharpness && adjust.sharpness < 0) parts.push(`blur(${(-adjust.sharpness / 50).toFixed(2)}px)`);
  if (adjust.blur) parts.push(`blur(${adjust.blur}px)`);
  if (adjust.artistic && ARTISTIC_FILTERS[adjust.artistic]) parts.push(ARTISTIC_FILTERS[adjust.artistic]);
  return parts.length ? parts.join(' ') : undefined;
}

export function cropClipPath(crop: ImageCrop | undefined): string | undefined {
  if (!crop) return undefined;
  if (!crop.top && !crop.right && !crop.bottom && !crop.left) return undefined;
  return `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`;
}

export const ASPECT_CROPS: ReadonlyArray<readonly [string, number]> = [
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
];

export function cropToAspect(el: SlideElement, ratio: number, slideAspect: number): ImageCrop {
  const boxRatio = (el.width * slideAspect) / el.height;
  if (boxRatio > ratio) {
    const keep = ratio / boxRatio;
    const side = ((1 - keep) / 2) * 100;
    return { top: 0, bottom: 0, left: side, right: side };
  }
  const keep = boxRatio / ratio;
  const side = ((1 - keep) / 2) * 100;
  return { top: side, bottom: side, left: 0, right: 0 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh'));
    img.src = src;
  });
}

const COLOR_TOLERANCE = 48;

function colorDistance(data: Uint8ClampedArray, offset: number, ref: [number, number, number]) {
  return Math.abs(data[offset] - ref[0]) + Math.abs(data[offset + 1] - ref[1]) + Math.abs(data[offset + 2] - ref[2]);
}

export async function removeBackground(src: string, tolerance = COLOR_TOLERANCE): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  for (const start of corners) {
    const o = start * 4;
    const ref: [number, number, number] = [data[o], data[o + 1], data[o + 2]];
    stack.push(start);
    while (stack.length) {
      const index = stack.pop()!;
      if (visited[index]) continue;
      const offset = index * 4;
      if (colorDistance(data, offset, ref) > tolerance * 3) continue;
      visited[index] = 1;
      data[offset + 3] = 0;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) stack.push(index - 1);
      if (x < width - 1) stack.push(index + 1);
      if (y > 0) stack.push(index - width);
      if (y < height - 1) stack.push(index + width);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function compressImage(src: string, maxDimension = 1600, quality = 0.82): Promise<{ src: string; before: number; after: number }> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const hasAlpha = src.startsWith('data:image/png') || src.startsWith('data:image/webp');
  const out = canvas.toDataURL(hasAlpha ? 'image/webp' : 'image/jpeg', quality);
  return { src: out.length < src.length ? out : src, before: src.length, after: Math.min(out.length, src.length) };
}

export async function captureScreenFrame(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Ứng dụng này chưa cho phép chụp màn hình.');
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export function imageAspect(src: string): Promise<number> {
  return loadImage(src).then((img) => img.naturalWidth / Math.max(1, img.naturalHeight));
}
