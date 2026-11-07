export type WordArtTransform = 'none' | 'arc-up' | 'arc-down' | 'wave' | 'slant';
export type WordArtSpec = { text: string; preset: string; font: string; size: number; transform: WordArtTransform };
type Preset = { id: string; label: string; fill: string | string[]; stroke?: string; strokeWidth?: number; shadow?: string; glow?: string; extrude?: string; reflect?: boolean; bold?: boolean };

export const WORDART_PRESETS: Preset[] = [
  { id: 'plain', label: 'Đen đơn', fill: '#1f2430', bold: true },
  { id: 'blue-grad', label: 'Xanh chuyển màu', fill: ['#5b8def', '#1e3a8a'], bold: true },
  { id: 'fire', label: 'Lửa', fill: ['#fbbf24', '#dc2626'], bold: true },
  { id: 'outline-blue', label: 'Viền xanh rỗng', fill: '#ffffff', stroke: '#2b579a', strokeWidth: 2, bold: true },
  { id: 'outline-shadow', label: 'Viền đen đổ bóng', fill: '#ffffff', stroke: '#111827', strokeWidth: 2, shadow: '#94a3b8', bold: true },
  { id: 'gold', label: 'Vàng kim', fill: ['#fde68a', '#b45309', '#fde68a'], stroke: '#78350f', strokeWidth: 1, bold: true },
  { id: 'shadow-blue', label: 'Bóng đổ xanh', fill: '#2b579a', shadow: '#a5b4fc', bold: true },
  { id: 'glow', label: 'Phát sáng', fill: '#7c3aed', glow: '#c4b5fd', bold: true },
  { id: 'reflect', label: 'Phản chiếu', fill: ['#0ea5e9', '#0369a1'], reflect: true, bold: true },
  { id: 'extrude', label: 'Nổi khối', fill: '#ef4444', extrude: '#7f1d1d', bold: true },
  { id: 'rainbow', label: 'Cầu vồng', fill: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'], bold: true },
  { id: 'ice', label: 'Băng giá', fill: ['#ffffff', '#7dd3fc'], stroke: '#0369a1', strokeWidth: 1, bold: true },
];

export const WORDART_FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Tahoma', 'Verdana', 'Segoe UI', 'Impact', 'Courier New'];
export const WORDART_TRANSFORMS: { id: WordArtTransform; label: string }[] = [
  { id: 'none', label: 'Thẳng' }, { id: 'arc-up', label: 'Vòm lên' }, { id: 'arc-down', label: 'Vòm xuống' }, { id: 'wave', label: 'Gợn sóng' }, { id: 'slant', label: 'Nghiêng' },
];

const escapeXml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const measure = (text: string, font: string, size: number, bold: boolean) => {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return text.length * size * 0.6;
  context.font = `${bold ? 700 : 400} ${size}px "${font}", Arial, sans-serif`;
  return context.measureText(text).width;
};

export function wordArtDataUrl(spec: WordArtSpec) {
  const preset = WORDART_PRESETS.find((item) => item.id === spec.preset) ?? WORDART_PRESETS[0];
  const text = spec.text.trim() || 'Chữ nghệ thuật';
  const size = spec.size;
  const textWidth = measure(text, spec.font, size, Boolean(preset.bold));
  const pad = size * 0.5;
  const curved = spec.transform === 'arc-up' || spec.transform === 'arc-down' || spec.transform === 'wave';
  const pathWidth = curved ? textWidth * 1.15 : textWidth;
  const rise = spec.transform === 'wave' ? size * 0.5 : curved ? pathWidth * 0.22 : 0;
  const width = Math.ceil(pathWidth + pad * 2 + (spec.transform === 'slant' ? size * 0.5 : 0));
  const baseHeight = Math.ceil(size * 1.5 + rise + (spec.transform === 'wave' ? rise : 0));
  const height = baseHeight + (preset.reflect ? Math.ceil(size * 0.9) : 0);
  const baseline = spec.transform === 'arc-up' ? size * 1.2 + rise : spec.transform === 'arc-down' ? size * 1.2 : spec.transform === 'wave' ? size * 1.1 + rise : size * 1.15;
  const left = pad;
  const right = pad + pathWidth;
  const mid = (left + right) / 2;
  let pathDef = '';
  if (spec.transform === 'arc-up') pathDef = `M${left} ${baseline} Q${mid} ${baseline - rise * 2} ${right} ${baseline}`;
  if (spec.transform === 'arc-down') pathDef = `M${left} ${baseline} Q${mid} ${baseline + rise * 2} ${right} ${baseline}`;
  if (spec.transform === 'wave') pathDef = `M${left} ${baseline} C${left + pathWidth * 0.25} ${baseline - rise * 1.6} ${left + pathWidth * 0.25} ${baseline - rise * 1.6} ${mid} ${baseline} S${right - pathWidth * 0.25} ${baseline + rise * 1.6} ${right} ${baseline}`;

  const fill = Array.isArray(preset.fill) ? 'url(#wa-fill)' : preset.fill;
  const gradient = Array.isArray(preset.fill) ? `<linearGradient id="wa-fill" x1="0" y1="0" x2="${preset.id === 'rainbow' ? 1 : 0}" y2="${preset.id === 'rainbow' ? 0 : 1}">${preset.fill.map((color, i, all) => `<stop offset="${(i / (all.length - 1)) * 100}%" stop-color="${color}"/>`).join('')}</linearGradient>` : '';
  const filters = `${preset.glow ? `<filter id="wa-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${Math.max(2, size / 14)}" result="b"/><feFlood flood-color="${preset.glow}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}${preset.reflect ? `<linearGradient id="wa-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.45"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="wa-mask"><rect x="0" y="${baseline}" width="${width}" height="${size}" fill="url(#wa-fade)"/></mask>` : ''}`;
  const pathDefs = pathDef ? `<path id="wa-path" d="${pathDef}" fill="none"/>` : '';
  const common = `font-family="${escapeXml(spec.font)}, Arial, sans-serif" font-size="${size}" font-weight="${preset.bold ? 700 : 400}"`;
  const content = pathDef ? `<textPath href="#wa-path" startOffset="50%" text-anchor="middle">${escapeXml(text)}</textPath>` : escapeXml(text);
  const anchor = pathDef ? '' : `x="${mid}" y="${baseline}" text-anchor="middle"`;
  const textEl = (extra: string) => `<text ${anchor} ${common} ${extra}>${content}</text>`;
  const strokeAttrs = preset.stroke ? `stroke="${preset.stroke}" stroke-width="${preset.strokeWidth ?? 1}" paint-order="stroke"` : '';
  const layers: string[] = [];
  if (preset.shadow) layers.push(`<g transform="translate(${size * 0.05} ${size * 0.05})">${textEl(`fill="${preset.shadow}"`)}</g>`);
  if (preset.extrude) for (let i = Math.ceil(size * 0.07); i > 0; i--) layers.push(`<g transform="translate(${i} ${i})">${textEl(`fill="${preset.extrude}"`)}</g>`);
  layers.push(textEl(`fill="${fill}" ${strokeAttrs} ${preset.glow ? 'filter="url(#wa-glow)"' : ''}`));
  if (preset.reflect && !pathDef) layers.push(`<g mask="url(#wa-mask)"><g transform="translate(0 ${baseline * 2 + size * 0.1}) scale(1 -1)">${textEl(`fill="${fill}"`)}</g></g>`);
  const body = `<g ${spec.transform === 'slant' ? `transform="skewX(-12) translate(${size * 0.35} 0)"` : ''}>${layers.join('')}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${gradient}${filters}${pathDefs}</defs>${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
