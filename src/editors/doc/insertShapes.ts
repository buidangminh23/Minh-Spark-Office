export type ShapeDef = { id: string; label: string; group: string; svg: (fill: string, stroke: string) => string };

const style = (f: string, s: string) => `fill="${f}" stroke="${s}" stroke-width="3" stroke-linejoin="round"`;
const lineStyle = (s: string) => `fill="none" stroke="${s}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const poly = (points: string) => (f: string, s: string) => `<polygon points="${points}" ${style(f, s)}/>`;
const path = (d: string) => (f: string, s: string) => `<path d="${d}" ${style(f, s)}/>`;

const regular = (sides: number, rOuter: number, rInner = rOuter, rotation = -Math.PI / 2) => {
  const points: string[] = [];
  const count = rInner === rOuter ? sides : sides * 2;
  for (let i = 0; i < count; i++) {
    const r = i % 2 && rInner !== rOuter ? rInner : rOuter;
    const a = rotation + (i * Math.PI * 2) / count;
    points.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(50 + r * 0.9 * Math.sin(a)).toFixed(1)}`);
  }
  return points.join(' ');
};

const LINES = 'Đường kẻ';
const RECTS = 'Hình chữ nhật';
const BASIC = 'Hình cơ bản';
const ARROWS = 'Mũi tên';
const MATH = 'Phép tính';
const FLOW = 'Lưu đồ';
const STARS = 'Sao và băng rôn';
const CALLOUTS = 'Chú thích';

const arrowHead = (x: number, y: number, dir: 1 | -1) => `<polygon points="${x},${y} ${x - dir * 14},${y - 8} ${x - dir * 14},${y + 8}"`;

export const SHAPES: ShapeDef[] = [
  { id: 'line', label: 'Đường thẳng', group: LINES, svg: (_f, s) => `<line x1="6" y1="50" x2="114" y2="50" ${lineStyle(s)}/>` },
  { id: 'line-arrow', label: 'Đường mũi tên', group: LINES, svg: (_f, s) => `<line x1="6" y1="50" x2="100" y2="50" ${lineStyle(s)}/>${arrowHead(114, 50, 1)} fill="${s}"/>` },
  { id: 'line-double', label: 'Mũi tên hai đầu', group: LINES, svg: (_f, s) => `<line x1="20" y1="50" x2="100" y2="50" ${lineStyle(s)}/>${arrowHead(114, 50, 1)} fill="${s}"/>${arrowHead(6, 50, -1)} fill="${s}"/>` },
  { id: 'elbow', label: 'Đường gấp khúc', group: LINES, svg: (_f, s) => `<path d="M8 20 H60 V80 H112" ${lineStyle(s)}/>` },
  { id: 'curve', label: 'Đường cong', group: LINES, svg: (_f, s) => `<path d="M6 80 C40 0 80 100 114 20" ${lineStyle(s)}/>` },
  { id: 'rect', label: 'Chữ nhật', group: RECTS, svg: (f, s) => `<rect x="4" y="14" width="112" height="72" ${style(f, s)}/>` },
  { id: 'round', label: 'Bo góc', group: RECTS, svg: (f, s) => `<rect x="4" y="14" width="112" height="72" rx="16" ${style(f, s)}/>` },
  { id: 'snip', label: 'Cắt góc', group: RECTS, svg: poly('4,14 96,14 116,34 116,86 4,86') },
  { id: 'snip2', label: 'Cắt hai góc', group: RECTS, svg: poly('24,14 96,14 116,34 116,86 4,86 4,34') },
  { id: 'ellipse', label: 'Elip', group: BASIC, svg: (f, s) => `<ellipse cx="60" cy="50" rx="56" ry="38" ${style(f, s)}/>` },
  { id: 'circle', label: 'Tròn', group: BASIC, svg: (f, s) => `<circle cx="60" cy="50" r="44" ${style(f, s)}/>` },
  { id: 'triangle', label: 'Tam giác', group: BASIC, svg: poly('60,8 114,92 6,92') },
  { id: 'right-triangle', label: 'Tam giác vuông', group: BASIC, svg: poly('8,8 112,92 8,92') },
  { id: 'diamond', label: 'Thoi', group: BASIC, svg: poly('60,6 114,50 60,94 6,50') },
  { id: 'parallelogram', label: 'Hình bình hành', group: BASIC, svg: poly('30,14 116,14 90,86 4,86') },
  { id: 'trapezoid', label: 'Hình thang', group: BASIC, svg: poly('30,14 90,14 116,86 4,86') },
  { id: 'pentagon', label: 'Ngũ giác', group: BASIC, svg: poly('60,6 114,44 94,94 26,94 6,44') },
  { id: 'hexagon', label: 'Lục giác', group: BASIC, svg: poly('30,8 90,8 116,50 90,92 30,92 4,50') },
  { id: 'octagon', label: 'Bát giác', group: BASIC, svg: poly('34,6 86,6 116,30 116,70 86,94 34,94 4,70 4,30') },
  { id: 'cross', label: 'Chữ thập', group: BASIC, svg: poly('42,6 78,6 78,32 114,32 114,68 78,68 78,94 42,94 42,68 6,68 6,32 42,32') },
  { id: 'ring', label: 'Vành khuyên', group: BASIC, svg: (f, s) => `<path fill-rule="evenodd" d="M60 6 A44 44 0 1 1 59.9 6 Z M60 28 A22 22 0 1 0 60.1 28 Z" ${style(f, s)}/>` },
  { id: 'can', label: 'Hình trụ', group: BASIC, svg: (f, s) => `<path d="M16 22 V78 A44 14 0 0 0 104 78 V22" ${style(f, s)}/><ellipse cx="60" cy="22" rx="44" ry="14" ${style(f, s)}/>` },
  { id: 'cube', label: 'Khối hộp', group: BASIC, svg: (f, s) => `<polygon points="8,30 84,30 84,92 8,92" ${style(f, s)}/><polygon points="8,30 34,8 110,8 84,30" ${style(f, s)}/><polygon points="84,30 110,8 110,70 84,92" ${style(f, s)}/>` },
  { id: 'heart', label: 'Tim', group: BASIC, svg: path('M60 92 C10 56 6 30 22 16 C36 6 52 12 60 28 C68 12 84 6 98 16 C114 30 110 56 60 92 Z') },
  { id: 'cloud', label: 'Mây', group: BASIC, svg: path('M34 84 A22 22 0 0 1 28 42 A28 28 0 0 1 80 34 A20 20 0 0 1 104 56 A16 16 0 0 1 96 84 Z') },
  { id: 'lightning', label: 'Tia sét', group: BASIC, svg: poly('70,4 22,56 54,56 42,96 100,38 66,38') },
  { id: 'moon', label: 'Trăng khuyết', group: BASIC, svg: path('M78 8 A44 44 0 1 0 78 92 A34 34 0 1 1 78 8 Z') },
  { id: 'sun', label: 'Mặt trời', group: BASIC, svg: (f, s) => `<circle cx="60" cy="50" r="22" ${style(f, s)}/>${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<line x1="${(60 + 30 * Math.cos(a)).toFixed(1)}" y1="${(50 + 30 * Math.sin(a)).toFixed(1)}" x2="${(60 + 44 * Math.cos(a)).toFixed(1)}" y2="${(50 + 44 * Math.sin(a)).toFixed(1)}" ${lineStyle(s)}/>`; }).join('')}` },
  { id: 'smiley', label: 'Mặt cười', group: BASIC, svg: (f, s) => `<circle cx="60" cy="50" r="44" ${style(f, s)}/><circle cx="44" cy="40" r="5" fill="${s}"/><circle cx="76" cy="40" r="5" fill="${s}"/><path d="M38 62 Q60 84 82 62" ${lineStyle(s)}/>` },
  { id: 'arrow-r', label: 'Mũi tên phải', group: ARROWS, svg: poly('4,34 72,34 72,14 116,50 72,86 72,66 4,66') },
  { id: 'arrow-l', label: 'Mũi tên trái', group: ARROWS, svg: poly('116,34 48,34 48,14 4,50 48,86 48,66 116,66') },
  { id: 'arrow-u', label: 'Mũi tên lên', group: ARROWS, svg: poly('44,96 44,44 24,44 60,4 96,44 76,44 76,96') },
  { id: 'arrow-d', label: 'Mũi tên xuống', group: ARROWS, svg: poly('44,4 44,56 24,56 60,96 96,56 76,56 76,4') },
  { id: 'arrow-lr', label: 'Mũi tên hai chiều', group: ARROWS, svg: poly('4,50 34,20 34,36 86,36 86,20 116,50 86,80 86,64 34,64 34,80') },
  { id: 'chevron', label: 'Chữ V', group: ARROWS, svg: poly('6,14 80,14 114,50 80,86 6,86 40,50') },
  { id: 'homeplate', label: 'Khối mũi tên', group: ARROWS, svg: poly('6,14 84,14 114,50 84,86 6,86') },
  { id: 'plus', label: 'Dấu cộng', group: MATH, svg: poly('48,14 72,14 72,38 104,38 104,62 72,62 72,86 48,86 48,62 16,62 16,38 48,38') },
  { id: 'minus', label: 'Dấu trừ', group: MATH, svg: (f, s) => `<rect x="16" y="38" width="88" height="24" ${style(f, s)}/>` },
  { id: 'multiply', label: 'Dấu nhân', group: MATH, svg: poly('30,14 60,38 90,14 106,30 76,50 106,70 90,86 60,62 30,86 14,70 44,50 14,30') },
  { id: 'equal', label: 'Dấu bằng', group: MATH, svg: (f, s) => `<rect x="16" y="24" width="88" height="20" ${style(f, s)}/><rect x="16" y="56" width="88" height="20" ${style(f, s)}/>` },
  { id: 'flow-process', label: 'Quy trình', group: FLOW, svg: (f, s) => `<rect x="6" y="22" width="108" height="56" ${style(f, s)}/>` },
  { id: 'flow-decision', label: 'Quyết định', group: FLOW, svg: poly('60,10 114,50 60,90 6,50') },
  { id: 'flow-terminator', label: 'Bắt đầu / kết thúc', group: FLOW, svg: (f, s) => `<rect x="6" y="26" width="108" height="48" rx="24" ${style(f, s)}/>` },
  { id: 'flow-data', label: 'Dữ liệu', group: FLOW, svg: poly('28,22 114,22 92,78 6,78') },
  { id: 'flow-document', label: 'Tài liệu', group: FLOW, svg: path('M6 16 H114 V76 C90 62 70 92 46 80 C30 72 18 74 6 80 Z') },
  { id: 'flow-connector', label: 'Điểm nối', group: FLOW, svg: (f, s) => `<circle cx="60" cy="50" r="26" ${style(f, s)}/>` },
  { id: 'star4', label: 'Sao 4 cánh', group: STARS, svg: poly(regular(4, 54, 16)) },
  { id: 'star', label: 'Sao 5 cánh', group: STARS, svg: poly('60,6 73,38 108,40 81,62 90,96 60,77 30,96 39,62 12,40 47,38') },
  { id: 'star8', label: 'Sao 8 cánh', group: STARS, svg: poly(regular(8, 54, 30)) },
  { id: 'burst', label: 'Ngôi sao nổ', group: STARS, svg: poly(regular(12, 56, 38)) },
  { id: 'ribbon', label: 'Băng rôn', group: STARS, svg: (f, s) => `<polygon points="4,40 26,40 26,76 4,76 14,58" ${style(f, s)}/><polygon points="116,40 94,40 94,76 116,76 106,58" ${style(f, s)}/><rect x="22" y="26" width="76" height="40" ${style(f, s)}/>` },
  { id: 'callout', label: 'Bong bóng bo góc', group: CALLOUTS, svg: path('M14 10 H106 A10 10 0 0 1 116 20 V62 A10 10 0 0 1 106 72 H50 L30 94 L34 72 H14 A10 10 0 0 1 4 62 V20 A10 10 0 0 1 14 10 Z') },
  { id: 'callout-rect', label: 'Bong bóng vuông', group: CALLOUTS, svg: poly('4,10 116,10 116,72 54,72 30,94 34,72 4,72') },
  { id: 'callout-oval', label: 'Bong bóng tròn', group: CALLOUTS, svg: path('M60 8 C92 8 116 22 116 42 C116 62 92 76 60 76 C54 76 48 76 44 74 L24 94 L28 68 C12 62 4 52 4 42 C4 22 28 8 60 8 Z') },
  { id: 'callout-cloud', label: 'Bong bóng suy nghĩ', group: CALLOUTS, svg: (f, s) => `<path d="M34 66 A20 20 0 0 1 28 28 A26 26 0 0 1 78 22 A20 20 0 0 1 102 42 A16 16 0 0 1 94 66 Z" ${style(f, s)}/><circle cx="28" cy="78" r="6" ${style(f, s)}/><circle cx="16" cy="90" r="4" ${style(f, s)}/>` },
];

export const SHAPE_GROUPS = [...new Set(SHAPES.map((shape) => shape.group))];

const escapeXml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export type ShapeSpec = { id: string; fill: string; stroke: string; text?: string; textColor?: string };

export const shapeDataUrl = ({ id, fill, stroke, text, textColor }: ShapeSpec) => {
  const shape = SHAPES.find((item) => item.id === id) ?? SHAPES[0];
  const lines = (text ?? '').split('\n').filter((line) => line.trim());
  const start = 50 - ((lines.length - 1) * 16) / 2;
  const label = lines.length ? `<text x="60" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="13" fill="${textColor ?? '#1f2430'}">${lines.map((line, i) => `<tspan x="60" y="${start + i * 16}">${escapeXml(line)}</tspan>`).join('')}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 120 100">${shape.svg(fill, stroke)}${label}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
