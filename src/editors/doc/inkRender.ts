import type { InkKind, InkStroke } from '../../lib/storage';
import { boundsOf, fountainOutline } from './inkGeometry';

const FALLBACK_COLOR = '#111827';
const GALAXY_STOPS = ['#7c3aed', '#2563eb', '#06b6d4', '#ec4899', '#f59e0b'];
const PNG_SCALE = 2;
const EXPORT_PAD = 14;

const safeColor = (value: string) => (/^#[0-9a-f]{3,8}$/i.test(value) ? value : FALLBACK_COLOR);
const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '');
const number = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)) : 0);

export const inkPath = (flat: number[]) => {
  if (flat.length < 2) return '';
  if (flat.length === 2) return `M${flat[0]} ${flat[1]} L${flat[0]} ${flat[1]}`;
  let d = `M${flat[0]} ${flat[1]}`;
  for (let i = 2; i + 1 < flat.length; i += 2) d += ` L${flat[i]} ${flat[i + 1]}`;
  return d;
};

const seedFrom = (id: string) => [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7);

const filterBox = (flat: number[], pad: number) => {
  const { minX, minY, maxX, maxY } = boundsOf(flat);
  return `x="${number(minX - pad)}" y="${number(minY - pad)}" width="${number(maxX - minX + pad * 2)}" height="${number(maxY - minY + pad * 2)}"`;
};

const strokeBase = (stroke: InkStroke, paint: string, extra = '') => `<path d="${inkPath(stroke.points)}" fill="none" stroke="${paint}" stroke-width="${number(stroke.width)}" stroke-opacity="${number(stroke.opacity)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

const RENDERERS: Record<InkKind, (stroke: InkStroke, color: string, id: string) => string> = {
  pen: (stroke, color) => strokeBase(stroke, color),
  highlighter: (stroke, color) => strokeBase(stroke, color, ' style="mix-blend-mode:multiply"'),
  pencil: (stroke, color, id) => {
    const filterId = `ink-pencil-${id}`;
    return `<defs><filter id="${filterId}" filterUnits="userSpaceOnUse" ${filterBox(stroke.points, stroke.width + 8)}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seedFrom(id)}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" result="moved"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.8 1.45" result="grain"/><feComposite in="moved" in2="grain" operator="in"/></filter></defs>${strokeBase(stroke, color, ` filter="url(#${filterId})"`)}`;
  },
  fountain: (stroke, color) => {
    const outline = fountainOutline(stroke.points, stroke.width * 1.6);
    if (!outline) return strokeBase(stroke, color);
    return `<path d="${outline}" style="fill:${color};stroke:none" fill-opacity="${number(stroke.opacity)}"/>`;
  },
  galaxy: (stroke, color, id) => {
    const gradientId = `ink-galaxy-${id}`;
    const { minX, minY, maxX, maxY } = boundsOf(stroke.points);
    const stops = [color, ...GALAXY_STOPS].map((stop, index, all) => `<stop offset="${number(index / (all.length - 1))}" stop-color="${stop}"/>`).join('');
    return `<defs><linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${number(minX)}" y1="${number(minY)}" x2="${number(Math.max(maxX, minX + 1))}" y2="${number(Math.max(maxY, minY + 1))}">${stops}</linearGradient></defs>${strokeBase(stroke, `url(#${gradientId})`)}`;
  },
  action: (stroke, color, id) => {
    const filterId = `ink-glow-${id}`;
    const blur = Math.max(2, stroke.width * 0.9);
    return `<defs><filter id="${filterId}" filterUnits="userSpaceOnUse" ${filterBox(stroke.points, stroke.width + blur * 4)}><feGaussianBlur stdDeviation="${number(blur)}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${strokeBase(stroke, color, ` filter="url(#${filterId})"`)}<path d="${inkPath(stroke.points)}" fill="none" stroke="#ffffff" stroke-width="${number(Math.max(0.6, stroke.width * 0.3))}" stroke-opacity="0.85" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
};

export const strokeMarkup = (stroke: InkStroke) => (RENDERERS[stroke.kind ?? 'pen'] ?? RENDERERS.pen)(stroke, safeColor(stroke.color), safeId(stroke.id));

export const strokesToSvg = (strokes: InkStroke[]) => {
  const all = strokes.flatMap((s) => s.points);
  const { minX, minY, maxX, maxY } = boundsOf(all);
  const pad = EXPORT_PAD + Math.max(...strokes.map((s) => s.width)) * 2;
  const left = minX - pad;
  const top = minY - pad;
  const width = Math.max(1, maxX - minX + pad * 2);
  const height = Math.max(1, maxY - minY + pad * 2);
  const body = strokes.map(strokeMarkup).join('');
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="${number(left)} ${number(top)} ${number(width)} ${number(height)}">${body}</svg>`, width, height };
};

export const strokesSize = (strokes: InkStroke[]) => {
  const { width, height } = strokesToSvg(strokes);
  return { width, height };
};

export const strokesToPng = (strokes: InkStroke[]) => new Promise<string>((resolve, reject) => {
  const { svg, width, height } = strokesToSvg(strokes);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * PNG_SCALE);
    canvas.height = Math.ceil(height * PNG_SCALE);
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Trình duyệt không tạo được ảnh từ nét vẽ'));
      return;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/png'));
  };
  image.onerror = () => reject(new Error('Không dựng được ảnh từ nét vẽ'));
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});
