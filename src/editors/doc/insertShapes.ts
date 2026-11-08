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
const evenPath = (d: string) => (f: string, s: string) => `<path fill-rule="evenodd" d="${d}" ${style(f, s)}/>`;
const strokePath = (d: string) => (_f: string, s: string) => `<path d="${d}" ${lineStyle(s)}/>`;
const thin = (s: string) => `stroke="${s}" stroke-width="3" stroke-linecap="round"`;
const docPath = (x: number, y: number, w: number, h: number) => `M${x} ${y} H${x + w} V${y + h - 8} C${x + w * 0.75} ${y + h - 20} ${x + w * 0.55} ${y + h + 8} ${x + w * 0.35} ${y + h} C${x + w * 0.2} ${y + h - 6} ${x + w * 0.1} ${y + h - 6} ${x} ${y + h - 2} Z`;
const ARROW_R = '4,34 72,34 72,14 116,50 72,86 72,66 4,66';

const ACTIONS = 'Nút hành động';
const button = (id: string, label: string, glyph: (s: string) => string): ShapeDef => ({
  id: `action-${id}`, label, group: ACTIONS,
  svg: (f, s) => `<rect x="10" y="6" width="100" height="88" rx="6" ${style(f, s)}/><rect x="18" y="14" width="84" height="72" rx="3" fill="none" stroke="${s}" stroke-width="1.5" stroke-opacity="0.5"/>${glyph(s)}`,
});
const ACTION_BUTTONS: ShapeDef[] = [
  button('back', 'Quay lại', (s) => `<polygon points="40,50 74,30 74,70" fill="${s}"/>`),
  button('next', 'Tiếp theo', (s) => `<polygon points="80,50 46,30 46,70" fill="${s}"/>`),
  button('first', 'Về đầu', (s) => `<rect x="36" y="30" width="6" height="40" fill="${s}"/><polygon points="44,50 78,30 78,70" fill="${s}"/>`),
  button('last', 'Về cuối', (s) => `<rect x="78" y="30" width="6" height="40" fill="${s}"/><polygon points="76,50 42,30 42,70" fill="${s}"/>`),
  button('home', 'Trang chủ', (s) => `<polygon points="60,26 84,48 78,48 78,72 42,72 42,48 36,48" fill="${s}"/>`),
  button('info', 'Thông tin', (s) => `<circle cx="60" cy="50" r="22" fill="none" stroke="${s}" stroke-width="4"/><rect x="57" y="46" width="6" height="16" fill="${s}"/><circle cx="60" cy="39" r="3.5" fill="${s}"/>`),
  button('help', 'Trợ giúp', (s) => `<path d="M48 40 A12 12 0 1 1 64 51 C60 53 60 56 60 60" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="70" r="3.5" fill="${s}"/>`),
  button('return', 'Quay về', (s) => `<path d="M78 34 V54 A10 10 0 0 1 68 64 H46" fill="none" stroke="${s}" stroke-width="5"/><polygon points="36,64 50,54 50,74" fill="${s}"/>`),
  button('document', 'Tài liệu', (s) => `<path d="M46 28 H66 L76 38 V72 H46 Z" fill="none" stroke="${s}" stroke-width="4" stroke-linejoin="round"/><path d="M52 48 H70 M52 56 H70 M52 64 H64" stroke="${s}" stroke-width="2.5"/>`),
  button('sound', 'Âm thanh', (s) => `<polygon points="40,42 50,42 64,30 64,70 50,58 40,58" fill="${s}"/><path d="M70 40 Q78 50 70 60 M76 34 Q88 50 76 66" fill="none" stroke="${s}" stroke-width="3"/>`),
  button('movie', 'Phim', (s) => `<rect x="38" y="36" width="34" height="28" rx="3" fill="${s}"/><polygon points="72,50 84,40 84,60" fill="${s}"/>`),
  button('blank', 'Nút trống', () => ''),
];

const EXTRA_SHAPES: ShapeDef[] = [
  { id: 'line-dash', label: 'Đường nét đứt', group: LINES, svg: (_f, s) => `<line x1="6" y1="50" x2="114" y2="50" ${lineStyle(s)} stroke-dasharray="12 8"/>` },
  { id: 'line-dot', label: 'Đường chấm', group: LINES, svg: (_f, s) => `<line x1="8" y1="50" x2="114" y2="50" ${lineStyle(s)} stroke-dasharray="0.1 10"/>` },
  { id: 'elbow-arrow', label: 'Gấp khúc có mũi tên', group: LINES, svg: (_f, s) => `<path d="M8 20 H60 V80 H100" ${lineStyle(s)}/>${arrowHead(114, 80, 1)} fill="${s}"/>` },
  { id: 'curve-arrow', label: 'Đường cong có mũi tên', group: LINES, svg: (_f, s) => `<path d="M6 84 C40 84 50 24 100 24" ${lineStyle(s)}/>${arrowHead(114, 24, 1)} fill="${s}"/>` },
  { id: 'freeform', label: 'Đường tự do', group: LINES, svg: strokePath('M6 70 C20 20 36 20 44 52 S66 86 76 50 S100 14 114 40') },
  { id: 'zigzag', label: 'Đường răng cưa', group: LINES, svg: strokePath('M6 50 L20 26 L34 74 L48 26 L62 74 L76 26 L90 74 L104 26 L114 44') },
  { id: 'round-top', label: 'Bo hai góc trên', group: RECTS, svg: path('M4 86 V34 A20 20 0 0 1 24 14 H96 A20 20 0 0 1 116 34 V86 Z') },
  { id: 'round-diag', label: 'Bo góc chéo', group: RECTS, svg: path('M24 14 H116 V66 A20 20 0 0 1 96 86 H4 V34 A20 20 0 0 1 24 14 Z') },
  { id: 'round-one', label: 'Bo một góc', group: RECTS, svg: path('M4 14 H96 A20 20 0 0 1 116 34 V86 H4 Z') },
  { id: 'snip-round', label: 'Cắt và bo góc', group: RECTS, svg: path('M24 14 H96 L116 34 V86 H4 V34 A20 20 0 0 1 24 14 Z') },
  { id: 'snip-diag', label: 'Cắt góc chéo', group: RECTS, svg: poly('4,14 96,14 116,34 116,86 24,86 4,66') },
  { id: 'heptagon', label: 'Thất giác', group: BASIC, svg: poly(regular(7, 48)) },
  { id: 'decagon', label: 'Thập giác', group: BASIC, svg: poly(regular(10, 48)) },
  { id: 'dodecagon', label: 'Thập nhị giác', group: BASIC, svg: poly(regular(12, 48)) },
  { id: 'teardrop', label: 'Giọt nước', group: BASIC, svg: path('M60 10 L100 10 L100 50 A40 40 0 1 1 60 10 Z') },
  { id: 'pie', label: 'Hình quạt', group: BASIC, svg: path('M60 50 L60 8 A42 42 0 1 1 18 50 Z') },
  { id: 'chord', label: 'Dây cung', group: BASIC, svg: path('M20.5 35.6 A42 42 0 1 0 99.5 35.6 Z') },
  { id: 'arc', label: 'Cung tròn', group: BASIC, svg: strokePath('M18 70 A42 42 0 0 1 102 70') },
  { id: 'block-arc', label: 'Cung khối', group: BASIC, svg: path('M16 70 A44 44 0 0 1 104 70 L88 70 A28 28 0 0 0 32 70 Z') },
  { id: 'frame', label: 'Khung', group: BASIC, svg: evenPath('M4 10 H116 V90 H4 Z M18 24 V76 H102 V24 Z') },
  { id: 'half-frame', label: 'Nửa khung', group: BASIC, svg: poly('4,10 116,10 100,24 18,24 18,74 4,90') },
  { id: 'l-shape', label: 'Hình chữ L', group: BASIC, svg: poly('4,10 40,10 40,56 116,56 116,90 4,90') },
  { id: 'diagonal-stripe', label: 'Sọc chéo', group: BASIC, svg: poly('4,60 64,10 116,10 4,90') },
  { id: 'plaque', label: 'Biển hiệu', group: BASIC, svg: path('M20 12 H100 A16 16 0 0 0 116 28 V72 A16 16 0 0 0 100 88 H20 A16 16 0 0 0 4 72 V28 A16 16 0 0 0 20 12 Z') },
  { id: 'no-symbol', label: 'Biển cấm', group: BASIC, svg: (f, s) => `<path fill-rule="evenodd" d="M60 6 A44 44 0 1 1 59.9 6 Z M60 20 A30 30 0 1 0 60.1 20 Z" ${style(f, s)}/><rect x="28" y="44" width="64" height="12" transform="rotate(45 60 50)" ${style(f, s)}/>` },
  { id: 'folded-corner', label: 'Gấp góc', group: BASIC, svg: (f, s) => `<path d="M4 10 H116 V70 L96 90 H4 Z" ${style(f, s)}/><polygon points="96,90 100,74 116,70" ${style(f, s)}/>` },
  { id: 'bevel', label: 'Khối vát cạnh', group: BASIC, svg: (f, s) => `<rect x="4" y="10" width="112" height="80" ${style(f, s)}/><rect x="18" y="24" width="84" height="52" ${style(f, s)}/><path d="M4 10 L18 24 M116 10 L102 24 M116 90 L102 76 M4 90 L18 76" ${thin(s)}/>` },
  { id: 'cone', label: 'Hình nón', group: BASIC, svg: (f, s) => `<path d="M60 6 L104 78 A44 14 0 0 1 16 78 Z" ${style(f, s)}/>` },
  { id: 'wave', label: 'Sóng', group: BASIC, svg: path('M4 26 C34 6 54 46 84 26 C96 18 108 18 116 22 V74 C86 94 66 54 36 74 C24 82 12 82 4 78 Z') },
  { id: 'double-wave', label: 'Sóng đôi', group: BASIC, svg: path('M4 24 C18 10 32 38 46 24 S74 10 88 24 S110 34 116 24 V76 C102 90 88 62 74 76 S46 90 32 76 S10 66 4 76 Z') },
  { id: 'brackets', label: 'Cặp ngoặc tròn', group: BASIC, svg: strokePath('M30 10 Q12 10 12 50 Q12 90 30 90 M90 10 Q108 10 108 50 Q108 90 90 90') },
  { id: 'square-brackets', label: 'Cặp ngoặc vuông', group: BASIC, svg: strokePath('M36 10 H18 V90 H36 M84 10 H102 V90 H84') },
  { id: 'braces', label: 'Cặp ngoặc nhọn', group: BASIC, svg: strokePath('M36 10 Q24 10 24 22 V40 Q24 50 12 50 Q24 50 24 60 V78 Q24 90 36 90 M84 10 Q96 10 96 22 V40 Q96 50 108 50 Q96 50 96 60 V78 Q96 90 84 90') },
  { id: 'arrow-ud', label: 'Mũi tên lên xuống', group: ARROWS, svg: poly('60,4 92,32 74,32 74,68 92,68 60,96 28,68 46,68 46,32 28,32') },
  { id: 'arrow-quad', label: 'Mũi tên bốn chiều', group: ARROWS, svg: poly('60,4 76,20 66,20 66,44 90,44 90,34 116,50 90,66 90,56 66,56 66,80 76,80 60,96 44,80 54,80 54,56 30,56 30,66 4,50 30,34 30,44 54,44 54,20 44,20') },
  { id: 'arrow-tri', label: 'Mũi tên ba chiều', group: ARROWS, svg: poly('60,4 80,24 68,24 68,54 92,54 92,42 116,62 92,82 92,70 28,70 28,82 4,62 28,42 28,54 52,54 52,24 40,24') },
  { id: 'arrow-notched', label: 'Mũi tên khía', group: ARROWS, svg: poly('4,34 72,34 72,14 116,50 72,86 72,66 4,66 22,50') },
  { id: 'arrow-striped', label: 'Mũi tên sọc', group: ARROWS, svg: (f, s) => `<rect x="4" y="34" width="6" height="32" ${style(f, s)}/><rect x="16" y="34" width="8" height="32" ${style(f, s)}/><polygon points="30,34 72,34 72,14 116,50 72,86 72,66 30,66" ${style(f, s)}/>` },
  { id: 'arrow-bent', label: 'Mũi tên gấp', group: ARROWS, svg: poly('8,96 8,36 80,36 80,16 116,46 80,76 80,56 30,56 30,96') },
  { id: 'arrow-uturn', label: 'Mũi tên quay đầu', group: ARROWS, svg: path('M10 96 V44 A36 36 0 0 1 82 44 V54 H100 L72 88 L44 54 H62 V44 A16 16 0 0 0 30 44 V96 Z') },
  { id: 'arrow-circular', label: 'Mũi tên vòng', group: ARROWS, svg: path('M16 64 A44 44 0 0 1 104 64 H116 L95 94 L74 64 H86 A26 26 0 0 0 34 64 Z') },
  { id: 'arrow-diag', label: 'Mũi tên chéo', group: ARROWS, svg: (f, s) => `<polygon points="${ARROW_R}" transform="rotate(-35 60 50) scale(0.9) translate(6 5)" ${style(f, s)}/>` },
  { id: 'chevron-l', label: 'Chữ V ngược', group: ARROWS, svg: poly('114,14 40,14 6,50 40,86 114,86 80,50') },
  { id: 'arrow-callout-r', label: 'Chú thích mũi tên phải', group: ARROWS, svg: poly('4,14 70,14 70,36 90,36 90,24 116,50 90,76 90,64 70,64 70,86 4,86') },
  { id: 'arrow-callout-d', label: 'Chú thích mũi tên xuống', group: ARROWS, svg: poly('14,4 106,4 106,56 82,56 82,70 96,70 60,96 24,70 38,70 38,56 14,56') },
  { id: 'arrow-callout-lr', label: 'Chú thích mũi tên hai chiều', group: ARROWS, svg: poly('30,20 90,20 90,40 100,40 100,30 116,50 100,70 100,60 90,60 90,80 30,80 30,60 20,60 20,70 4,50 20,30 20,40 30,40') },
  { id: 'arrow-curve-r', label: 'Mũi tên cong phải', group: ARROWS, svg: path('M8 92 C8 40 40 22 78 22 V8 L112 36 L78 64 V48 C50 48 30 62 30 92 Z') },
  { id: 'arrow-curve-l', label: 'Mũi tên cong trái', group: ARROWS, svg: path('M112 92 C112 40 80 22 42 22 V8 L8 36 L42 64 V48 C70 48 90 62 90 92 Z') },
  { id: 'arrow-curve-u', label: 'Mũi tên cong lên', group: ARROWS, svg: path('M6 84 C40 84 66 66 66 34 H52 L80 4 L108 34 H92 C92 72 58 96 6 96 Z') },
  { id: 'arrow-curve-d', label: 'Mũi tên cong xuống', group: ARROWS, svg: path('M6 16 C40 16 66 34 66 66 H52 L80 96 L108 66 H92 C92 28 58 4 6 4 Z') },
  { id: 'arrow-lrud-callout', label: 'Chú thích mũi tên bốn chiều', group: ARROWS, svg: poly('60,4 74,18 66,18 66,32 84,32 84,24 92,24 92,42 100,42 100,36 116,50 100,64 100,58 92,58 92,76 84,76 84,68 66,68 66,82 74,82 60,96 46,82 54,82 54,68 36,68 36,76 28,76 28,58 20,58 20,64 4,50 20,36 20,42 28,42 28,24 36,24 36,32 54,32 54,18 46,18') },
  ...ACTION_BUTTONS,
  { id: 'divide', label: 'Dấu chia', group: MATH, svg: (f, s) => `<rect x="16" y="42" width="88" height="16" ${style(f, s)}/><circle cx="60" cy="22" r="10" ${style(f, s)}/><circle cx="60" cy="78" r="10" ${style(f, s)}/>` },
  { id: 'not-equal', label: 'Dấu khác', group: MATH, svg: (f, s) => `<rect x="54" y="8" width="12" height="84" transform="rotate(30 60 50)" ${style(f, s)}/><rect x="16" y="26" width="88" height="16" ${style(f, s)}/><rect x="16" y="58" width="88" height="16" ${style(f, s)}/>` },
  { id: 'flow-alt', label: 'Quy trình thay thế', group: FLOW, svg: (f, s) => `<rect x="6" y="22" width="108" height="56" rx="14" ${style(f, s)}/>` },
  { id: 'flow-predefined', label: 'Quy trình định sẵn', group: FLOW, svg: (f, s) => `<rect x="6" y="22" width="108" height="56" ${style(f, s)}/><path d="M20 22 V78 M100 22 V78" ${thin(s)}/>` },
  { id: 'flow-internal', label: 'Lưu trữ trong', group: FLOW, svg: (f, s) => `<rect x="6" y="22" width="108" height="56" ${style(f, s)}/><path d="M22 22 V78 M6 36 H114" ${thin(s)}/>` },
  { id: 'flow-multidoc', label: 'Nhiều tài liệu', group: FLOW, svg: (f, s) => [docPath(22, 8, 92, 60), docPath(14, 16, 92, 60), docPath(6, 24, 92, 60)].map((d) => `<path d="${d}" ${style(f, s)}/>`).join('') },
  { id: 'flow-prep', label: 'Chuẩn bị', group: FLOW, svg: poly('26,22 94,22 114,50 94,78 26,78 6,50') },
  { id: 'flow-manual-input', label: 'Nhập thủ công', group: FLOW, svg: poly('6,40 114,22 114,78 6,78') },
  { id: 'flow-manual-op', label: 'Thao tác thủ công', group: FLOW, svg: poly('6,22 114,22 94,78 26,78') },
  { id: 'flow-offpage', label: 'Nối sang trang khác', group: FLOW, svg: poly('20,8 100,8 100,64 60,92 20,64') },
  { id: 'flow-card', label: 'Thẻ', group: FLOW, svg: poly('26,22 114,22 114,78 6,78 6,42') },
  { id: 'flow-tape', label: 'Băng đục lỗ', group: FLOW, svg: path('M6 26 C26 10 46 10 60 26 C74 42 94 42 114 26 V74 C94 90 74 90 60 74 C46 58 26 58 6 74 Z') },
  { id: 'flow-summing', label: 'Điểm cộng gộp', group: FLOW, svg: (f, s) => `<circle cx="60" cy="50" r="34" ${style(f, s)}/><path d="M36 26 L84 74 M84 26 L36 74" ${thin(s)}/>` },
  { id: 'flow-or', label: 'Hoặc', group: FLOW, svg: (f, s) => `<circle cx="60" cy="50" r="34" ${style(f, s)}/><path d="M60 16 V84 M26 50 H94" ${thin(s)}/>` },
  { id: 'flow-collate', label: 'Đối chiếu', group: FLOW, svg: poly('24,8 96,8 24,92 96,92') },
  { id: 'flow-sort', label: 'Sắp xếp', group: FLOW, svg: (f, s) => `<polygon points="60,10 106,50 60,90 14,50" ${style(f, s)}/><path d="M14 50 H106" ${thin(s)}/>` },
  { id: 'flow-extract', label: 'Trích xuất', group: FLOW, svg: poly('60,12 106,88 14,88') },
  { id: 'flow-merge', label: 'Gộp', group: FLOW, svg: poly('14,12 106,12 60,88') },
  { id: 'flow-stored', label: 'Dữ liệu lưu trữ', group: FLOW, svg: path('M26 18 H114 A16 32 0 0 0 114 82 H26 A16 32 0 0 1 26 18 Z') },
  { id: 'flow-delay', label: 'Trì hoãn', group: FLOW, svg: path('M6 20 H70 A30 30 0 0 1 70 80 H6 Z') },
  { id: 'flow-sequential', label: 'Truy cập tuần tự', group: FLOW, svg: (f, s) => `<circle cx="60" cy="50" r="36" ${style(f, s)}/><path d="M60 86 H112" ${thin(s)}/>` },
  { id: 'flow-disk', label: 'Đĩa từ', group: FLOW, svg: (f, s) => `<path d="M16 22 V78 A44 14 0 0 0 104 78 V22" ${style(f, s)}/><ellipse cx="60" cy="22" rx="44" ry="14" ${style(f, s)}/>` },
  { id: 'flow-direct', label: 'Truy cập trực tiếp', group: FLOW, svg: (f, s) => `<path d="M24 22 H96 A14 28 0 0 1 96 78 H24 A14 28 0 0 1 24 22 Z" ${style(f, s)}/><ellipse cx="96" cy="50" rx="14" ry="28" ${style(f, s)}/>` },
  { id: 'flow-display', label: 'Hiển thị', group: FLOW, svg: path('M6 50 L28 20 H94 A20 30 0 0 1 94 80 H28 Z') },
  { id: 'star6', label: 'Sao 6 cánh', group: STARS, svg: poly(regular(6, 54, 28)) },
  { id: 'star7', label: 'Sao 7 cánh', group: STARS, svg: poly(regular(7, 54, 26)) },
  { id: 'star10', label: 'Sao 10 cánh', group: STARS, svg: poly(regular(10, 54, 32)) },
  { id: 'star12', label: 'Sao 12 cánh', group: STARS, svg: poly(regular(12, 54, 36)) },
  { id: 'star16', label: 'Sao 16 cánh', group: STARS, svg: poly(regular(16, 54, 40)) },
  { id: 'star24', label: 'Sao 24 cánh', group: STARS, svg: poly(regular(24, 54, 44)) },
  { id: 'star32', label: 'Sao 32 cánh', group: STARS, svg: poly(regular(32, 54, 46)) },
  { id: 'seal', label: 'Nhãn răng cưa', group: STARS, svg: poly(regular(20, 50, 44)) },
  { id: 'burst2', label: 'Vụ nổ', group: STARS, svg: poly('8,40 30,34 26,12 48,26 58,4 70,24 92,8 88,32 114,30 96,48 116,66 90,66 96,92 72,76 60,96 50,74 26,90 32,66 6,62 22,50') },
  { id: 'ribbon-up', label: 'Băng rôn cong', group: STARS, svg: (f, s) => `<polygon points="4,52 26,52 26,88 4,88 14,70" ${style(f, s)}/><polygon points="116,52 94,52 94,88 116,88 106,70" ${style(f, s)}/><path d="M22 34 Q60 14 98 34 V74 Q60 54 22 74 Z" ${style(f, s)}/>` },
  { id: 'scroll-h', label: 'Cuộn giấy ngang', group: STARS, svg: (f, s) => `<rect x="14" y="20" width="94" height="62" ${style(f, s)}/><circle cx="108" cy="20" r="9" ${style(f, s)}/><circle cx="14" cy="82" r="9" ${style(f, s)}/>` },
  { id: 'scroll-v', label: 'Cuộn giấy dọc', group: STARS, svg: (f, s) => `<rect x="28" y="12" width="64" height="76" ${style(f, s)}/><circle cx="28" cy="12" r="9" ${style(f, s)}/><circle cx="92" cy="88" r="9" ${style(f, s)}/>` },
  { id: 'callout-line', label: 'Chú thích đường kẻ', group: CALLOUTS, svg: (f, s) => `<rect x="34" y="10" width="82" height="56" ${style(f, s)}/><path d="M34 66 L8 92" ${lineStyle(s)}/>` },
  { id: 'callout-bent', label: 'Chú thích đường gấp', group: CALLOUTS, svg: (f, s) => `<rect x="34" y="10" width="82" height="56" ${style(f, s)}/><path d="M34 40 H18 L6 90" ${lineStyle(s)}/>` },
  { id: 'callout-accent', label: 'Chú thích có thanh nhấn', group: CALLOUTS, svg: (f, s) => `<rect x="40" y="10" width="76" height="56" ${style(f, s)}/><path d="M30 10 V66 M30 66 L8 92" ${lineStyle(s)}/>` },
  { id: 'callout-down', label: 'Bong bóng chỉ xuống', group: CALLOUTS, svg: poly('4,8 116,8 116,64 74,64 60,92 46,64 4,64') },
  { id: 'callout-left', label: 'Bong bóng chỉ trái', group: CALLOUTS, svg: poly('28,10 116,10 116,80 28,80 28,54 4,45 28,40') },
  { id: 'callout-oval-r', label: 'Bong bóng tròn chỉ phải', group: CALLOUTS, svg: path('M60 8 C28 8 4 22 4 42 C4 62 28 76 60 76 C66 76 72 76 76 74 L96 94 L92 68 C108 62 116 52 116 42 C116 22 92 8 60 8 Z') },
];

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
  ...EXTRA_SHAPES,
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
