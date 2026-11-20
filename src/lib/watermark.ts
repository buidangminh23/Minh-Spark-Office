export type WatermarkLayout = 'diagonal' | 'horizontal';

export type WatermarkSpec = {
  kind: 'text' | 'image';
  text?: string;
  image?: string;
  color?: string;
  size?: number;
  font?: string;
  layout?: WatermarkLayout;
  opacity?: number;
};

export const WATERMARK_PRESETS = ['BẢN NHÁP', 'MẬT', 'TUYỆT MẬT', 'LƯU HÀNH NỘI BỘ', 'KHẨN', 'MẪU', 'CONFIDENTIAL', 'DRAFT'];
export const WATERMARK_SIZES = [24, 32, 40, 48, 64, 80, 96, 120, 160, 200];
export const WATERMARK_FONTS = ['Arial', 'Times New Roman', 'Calibri', 'Tahoma', 'Verdana', 'Segoe UI', 'Georgia', 'Courier New'];
export const DEFAULT_WATERMARK: WatermarkSpec = { kind: 'text', text: 'BẢN NHÁP', color: '#475569', size: 64, font: 'Arial', layout: 'diagonal', opacity: 0.2 };
export const WATERMARK_ANGLE = 35;

const HEX = /^#?([0-9a-f]{6})$/i;

export const watermarkColorHex = (color?: string) => {
  const match = HEX.exec((color ?? '').trim());
  return (match ? match[1] : 'C0C0C0').toUpperCase();
};

export const clampOpacity = (value: number | undefined, fallback = 0.2) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0.02, number));
};

export const hasWatermarkContent = (spec: WatermarkSpec | null | undefined): spec is WatermarkSpec =>
  Boolean(spec && (spec.kind === 'image' ? spec.image : spec.text?.trim()));

export const normalizeWatermark = (spec: Partial<WatermarkSpec> | null | undefined): WatermarkSpec | null => {
  if (!spec) return null;
  const kind = spec.kind === 'image' ? 'image' : 'text';
  const result: WatermarkSpec = {
    kind,
    layout: spec.layout === 'horizontal' ? 'horizontal' : 'diagonal',
    opacity: clampOpacity(spec.opacity),
  };
  if (kind === 'image') result.image = spec.image;
  else {
    result.text = (spec.text ?? '').trim();
    result.color = `#${watermarkColorHex(spec.color ?? DEFAULT_WATERMARK.color)}`;
    result.size = Math.min(400, Math.max(8, Math.round(spec.size ?? DEFAULT_WATERMARK.size!)));
    result.font = spec.font?.trim() || DEFAULT_WATERMARK.font;
  }
  return hasWatermarkContent(result) ? result : null;
};

export const watermarkRotation = (spec: WatermarkSpec) => (spec.layout === 'horizontal' ? 0 : -WATERMARK_ANGLE);

export const xmlEscape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);

export type DataUrlImage = { bytes: Uint8Array; mime: string; ext: 'png' | 'jpeg' | 'gif' };

export function decodeDataUrl(url: string | undefined): DataUrlImage | null {
  const match = /^data:(image\/(png|jpe?g|gif));base64,(.+)$/i.exec(url ?? '');
  if (!match) return null;
  const binary = typeof atob === 'function' ? atob(match[3]) : Buffer.from(match[3], 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const sub = match[2].toLowerCase();
  return { bytes, mime: match[1].toLowerCase().replace('jpg', 'jpeg'), ext: sub === 'gif' ? 'gif' : sub.startsWith('jp') ? 'jpeg' : 'png' };
}

export function encodeDataUrl(bytes: Uint8Array, mime: string) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return `data:${mime};base64,${base64}`;
}

export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export function fitBox(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (!width || !height) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

export function estimateTextWidth(text: string, size: number) {
  let units = 0;
  for (const char of text) units += /[A-ZĐÂĂÊÔƠƯÀ-Ỹ0-9]/.test(char) ? 0.68 : /\s/.test(char) ? 0.3 : 0.55;
  return units * size;
}

export function watermarkCss(spec: WatermarkSpec, scale = 1): Record<string, string | number> {
  const rotate = spec.layout === 'horizontal' ? '' : ` rotate(${-WATERMARK_ANGLE}deg)`;
  const base = { position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%)${rotate}`, pointerEvents: 'none', userSelect: 'none', opacity: clampOpacity(spec.opacity) };
  if (spec.kind === 'image') return { ...base, maxWidth: '70%', maxHeight: '70%' };
  return {
    ...base,
    whiteSpace: 'nowrap',
    fontWeight: 800,
    letterSpacing: 2 * scale,
    fontSize: Math.max(4, (spec.size ?? 64) * scale),
    fontFamily: `"${spec.font ?? 'Arial'}", Arial, sans-serif`,
    color: `#${watermarkColorHex(spec.color)}`,
  };
}

export type SlideWatermark = {
  text: string;
  enabled: boolean;
  opacity?: number;
  kind?: 'text' | 'image';
  image?: string;
  color?: string;
  size?: number;
  font?: string;
  layout?: WatermarkLayout;
};

const SLIDE_LEGACY = { color: '#64748B', size: 48, font: 'Segoe UI', opacity: 0.15 };

export function slideWatermarkSpec(mark: SlideWatermark | null | undefined): WatermarkSpec | null {
  if (!mark?.enabled) return null;
  return normalizeWatermark({
    kind: mark.kind ?? 'text',
    text: mark.text,
    image: mark.image,
    color: mark.color ?? SLIDE_LEGACY.color,
    size: mark.size ?? SLIDE_LEGACY.size,
    font: mark.font ?? SLIDE_LEGACY.font,
    layout: mark.layout ?? 'diagonal',
    opacity: mark.opacity ?? SLIDE_LEGACY.opacity,
  });
}

export function toSlideWatermark(spec: WatermarkSpec | null, previous?: SlideWatermark): SlideWatermark {
  if (!spec) return { ...(previous ?? { text: '' }), enabled: false };
  return {
    enabled: true,
    kind: spec.kind,
    text: spec.text ?? '',
    image: spec.image,
    color: spec.color,
    size: spec.size,
    font: spec.font,
    layout: spec.layout,
    opacity: spec.opacity,
  };
}
