export type ShapeCategory =
  | 'lines'
  | 'rectangles'
  | 'basic'
  | 'arrows'
  | 'equation'
  | 'flowchart'
  | 'stars'
  | 'callouts';

export type LineHeads = 'none' | 'end' | 'both';

export interface ShapeDef {
  id: string;
  label: string;
  category: ShapeCategory;
  prst: string;
  d: string;
  detail?: string;
  evenOdd?: boolean;
  line?: LineHeads;
}

export const SHAPE_CATEGORY_LABELS: Record<ShapeCategory, string> = {
  lines: 'Đường kẻ',
  rectangles: 'Hình chữ nhật',
  basic: 'Hình cơ bản',
  arrows: 'Mũi tên khối',
  equation: 'Hình phương trình',
  flowchart: 'Lưu đồ',
  stars: 'Sao và biểu ngữ',
  callouts: 'Chú thích',
};

export const SHAPE_CATEGORY_ORDER: ShapeCategory[] = [
  'lines',
  'rectangles',
  'basic',
  'arrows',
  'equation',
  'flowchart',
  'stars',
  'callouts',
];

type Point = [number, number];

const round = (value: number) => Math.round(value * 100) / 100;

function poly(points: Point[]): string {
  return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`;
}

function fitToBox(points: Point[]): Point[] {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return points.map(([x, y]) => [((x - minX) / spanX) * 100, ((y - minY) / spanY) * 100]);
}

function regular(sides: number, startDeg = -90): string {
  const points: Point[] = [];
  for (let index = 0; index < sides; index++) {
    const angle = ((startDeg + (360 / sides) * index) * Math.PI) / 180;
    points.push([Math.cos(angle), Math.sin(angle)]);
  }
  return poly(fitToBox(points));
}

function star(tips: number, innerRatio: number): string {
  const points: Point[] = [];
  for (let index = 0; index < tips * 2; index++) {
    const radius = index % 2 === 0 ? 1 : innerRatio;
    const angle = ((-90 + (180 / tips) * index) * Math.PI) / 180;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return poly(fitToBox(points));
}

function fromEmu(points: Point[]): string {
  return poly(points.map(([x, y]) => [x / 216, y / 216]));
}

function sun(): string {
  const parts = ['M50 25A25 25 0 1 1 50 75A25 25 0 1 1 50 25Z'];
  for (let index = 0; index < 8; index++) {
    const angle = (index * 45 * Math.PI) / 180;
    const spread = (11 * Math.PI) / 180;
    const tip: Point = [50 + Math.cos(angle) * 50, 50 + Math.sin(angle) * 50];
    const left: Point = [50 + Math.cos(angle - spread) * 32, 50 + Math.sin(angle - spread) * 32];
    const right: Point = [50 + Math.cos(angle + spread) * 32, 50 + Math.sin(angle + spread) * 32];
    parts.push(poly([left, tip, right]));
  }
  return parts.join('');
}

const RECT = 'M0 0H100V100H0Z';
const ELLIPSE = 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z';
const DIAMOND = poly([[50, 0], [100, 50], [50, 100], [0, 50]]);
const CAN = 'M0 12.5A50 12.5 0 0 1 100 12.5V87.5A50 12.5 0 0 1 0 87.5Z';
const CAN_DETAIL = 'M0 12.5A50 12.5 0 0 0 100 12.5';
const ROUND_RECT = 'M14 0H86A14 14 0 0 1 100 14V86A14 14 0 0 1 86 100H14A14 14 0 0 1 0 86V14A14 14 0 0 1 14 0Z';

const def = (
  id: string,
  label: string,
  category: ShapeCategory,
  prst: string,
  d: string,
  extra: Partial<ShapeDef> = {}
): ShapeDef => ({ id, label, category, prst, d, ...extra });

export const SHAPE_DEFS: ShapeDef[] = [
  def('line', 'Đường thẳng', 'lines', 'line', 'M0 50H100', { line: 'none' }),
  def('arrow-line', 'Mũi tên', 'lines', 'line', 'M0 50H100', { line: 'end' }),
  def('double-arrow-line', 'Mũi tên hai đầu', 'lines', 'line', 'M0 50H100', { line: 'both' }),

  def('rectangle', 'Hình chữ nhật', 'rectangles', 'rect', RECT),
  def('rounded-rectangle', 'Chữ nhật bo góc', 'rectangles', 'roundRect', ROUND_RECT),
  def('snip-single', 'Cắt một góc', 'rectangles', 'snip1Rect', 'M0 0H83L100 17V100H0Z'),
  def('snip-same', 'Cắt hai góc trên', 'rectangles', 'snip2SameRect', 'M17 0H83L100 17V100H0V17Z'),
  def('snip-diagonal', 'Cắt hai góc chéo', 'rectangles', 'snip2DiagRect', 'M0 0H83L100 17V100H17L0 83Z'),
  def('round-single', 'Bo một góc', 'rectangles', 'round1Rect', 'M0 0H83A17 17 0 0 1 100 17V100H0Z'),
  def('round-same', 'Bo hai góc trên', 'rectangles', 'round2SameRect', 'M17 0H83A17 17 0 0 1 100 17V100H0V17A17 17 0 0 1 17 0Z'),
  def('round-diagonal', 'Bo hai góc chéo', 'rectangles', 'round2DiagRect', 'M17 0H100V83A17 17 0 0 1 83 100H0V17A17 17 0 0 1 17 0Z'),

  def('circle', 'Hình elip', 'basic', 'ellipse', ELLIPSE),
  def('triangle', 'Tam giác cân', 'basic', 'triangle', poly([[50, 0], [100, 100], [0, 100]])),
  def('right-triangle', 'Tam giác vuông', 'basic', 'rtTriangle', poly([[0, 0], [100, 100], [0, 100]])),
  def('parallelogram', 'Hình bình hành', 'basic', 'parallelogram', poly([[25, 0], [100, 0], [75, 100], [0, 100]])),
  def('trapezoid', 'Hình thang', 'basic', 'trapezoid', poly([[25, 0], [75, 0], [100, 100], [0, 100]])),
  def('diamond', 'Hình thoi', 'basic', 'diamond', DIAMOND),
  def('pentagon', 'Ngũ giác', 'basic', 'pentagon', regular(5)),
  def('hexagon', 'Lục giác', 'basic', 'hexagon', poly([[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]])),
  def('heptagon', 'Thất giác', 'basic', 'heptagon', regular(7)),
  def('octagon', 'Bát giác', 'basic', 'octagon', poly([[29, 0], [71, 0], [100, 29], [100, 71], [71, 100], [29, 100], [0, 71], [0, 29]])),
  def('decagon', 'Thập giác', 'basic', 'decagon', regular(10, -72)),
  def('dodecagon', 'Thập nhị giác', 'basic', 'dodecagon', regular(12, -75)),
  def('pie', 'Hình quạt', 'basic', 'pie', 'M50 50L100 50A50 50 0 1 1 50 0Z'),
  def('chord', 'Hình viên phân', 'basic', 'chord', 'M85.36 85.36A50 50 0 1 1 50 0Z'),
  def('teardrop', 'Giọt nước', 'basic', 'teardrop', 'M50 0H100V50A50 50 0 1 1 50 0Z'),
  def('frame', 'Khung', 'basic', 'frame', 'M0 0H100V100H0ZM12 12V88H88V12Z', { evenOdd: true }),
  def('half-frame', 'Nửa khung', 'basic', 'halfFrame', poly([[0, 0], [100, 0], [67, 33], [33, 33], [33, 67], [0, 100]])),
  def('l-shape', 'Hình chữ L', 'basic', 'corner', poly([[0, 0], [50, 0], [50, 50], [100, 50], [100, 100], [0, 100]])),
  def('diagonal-stripe', 'Sọc chéo', 'basic', 'diagStripe', poly([[0, 50], [50, 0], [100, 0], [0, 100]])),
  def('cross', 'Chữ thập', 'basic', 'plus', poly([[25, 0], [75, 0], [75, 25], [100, 25], [100, 75], [75, 75], [75, 100], [25, 100], [25, 75], [0, 75], [0, 25], [25, 25]])),
  def('plaque', 'Tấm biển', 'basic', 'plaque', 'M17 0H83A17 17 0 0 0 100 17V83A17 17 0 0 0 83 100H17A17 17 0 0 0 0 83V17A17 17 0 0 0 17 0Z'),
  def('can', 'Hình trụ', 'basic', 'can', CAN, { detail: CAN_DETAIL }),
  def('cube', 'Khối hộp', 'basic', 'cube', 'M0 25L25 0H100V75L75 100H0Z', { detail: 'M0 25H75V100M75 25L100 0' }),
  def('bevel', 'Khối vát', 'basic', 'bevel', RECT, { detail: 'M12.5 12.5H87.5V87.5H12.5ZM0 0L12.5 12.5M100 0L87.5 12.5M100 100L87.5 87.5M0 100L12.5 87.5' }),
  def('donut', 'Hình vành khăn', 'basic', 'donut', `${ELLIPSE}M50 25A25 25 0 1 0 50 75A25 25 0 1 0 50 25Z`, { evenOdd: true }),
  def('no-symbol', 'Biển cấm', 'basic', 'noSmoking', `${ELLIPSE}M27.7 19.2A38 38 0 0 1 80.8 72.3ZM72.3 80.8A38 38 0 0 1 19.2 27.7Z`, { evenOdd: true }),
  def('block-arc', 'Cung khối', 'basic', 'blockArc', 'M0 50A50 50 0 0 1 100 50H75A25 25 0 0 0 25 50Z'),
  def('folded-corner', 'Gấp góc', 'basic', 'foldedCorner', 'M0 0H100V83L83 100H0Z', { detail: 'M83 100L86 86L100 83' }),
  def('smiley', 'Mặt cười', 'basic', 'smileyFace', ELLIPSE, { detail: 'M30 36A5 5 0 1 1 40 36A5 5 0 1 1 30 36ZM60 36A5 5 0 1 1 70 36A5 5 0 1 1 60 36ZM28 62Q50 84 72 62' }),
  def('heart', 'Trái tim', 'basic', 'heart', 'M50 100C10 68 0 42 0 25C0 10 10 0 25 0C37 0 46 10 50 20C54 10 63 0 75 0C90 0 100 10 100 25C100 42 90 68 50 100Z'),
  def('lightning', 'Tia chớp', 'basic', 'lightningBolt', fromEmu([[8472, 0], [12860, 6080], [11050, 6797], [16577, 12007], [14767, 12877], [21600, 21600], [10012, 14915], [12222, 13987], [5022, 9705], [7602, 8382], [0, 3890]])),
  def('sun', 'Mặt trời', 'basic', 'sun', sun()),
  def('moon', 'Mặt trăng', 'basic', 'moon', 'M100 0A100 50 0 0 0 100 100A50 50 0 0 1 100 0Z'),
  def('cloud', 'Đám mây', 'basic', 'cloud', 'M25 100A25 25 0 0 1 9 56A22 22 0 0 1 27 22A27 27 0 0 1 74 16A24 24 0 0 1 94 56A24 24 0 0 1 76 100Z'),

  def('right-arrow', 'Mũi tên phải', 'arrows', 'rightArrow', poly([[0, 25], [60, 25], [60, 0], [100, 50], [60, 100], [60, 75], [0, 75]])),
  def('left-arrow', 'Mũi tên trái', 'arrows', 'leftArrow', poly([[100, 25], [40, 25], [40, 0], [0, 50], [40, 100], [40, 75], [100, 75]])),
  def('up-arrow', 'Mũi tên lên', 'arrows', 'upArrow', poly([[50, 0], [100, 40], [75, 40], [75, 100], [25, 100], [25, 40], [0, 40]])),
  def('down-arrow', 'Mũi tên xuống', 'arrows', 'downArrow', poly([[25, 0], [75, 0], [75, 60], [100, 60], [50, 100], [0, 60], [25, 60]])),
  def('left-right-arrow', 'Mũi tên trái phải', 'arrows', 'leftRightArrow', poly([[0, 50], [25, 0], [25, 25], [75, 25], [75, 0], [100, 50], [75, 100], [75, 75], [25, 75], [25, 100]])),
  def('up-down-arrow', 'Mũi tên lên xuống', 'arrows', 'upDownArrow', poly([[50, 0], [100, 25], [75, 25], [75, 75], [100, 75], [50, 100], [0, 75], [25, 75], [25, 25], [0, 25]])),
  def('quad-arrow', 'Mũi tên bốn hướng', 'arrows', 'quadArrow', poly([[50, 0], [68, 18], [57, 18], [57, 43], [82, 43], [82, 32], [100, 50], [82, 68], [82, 57], [57, 57], [57, 82], [68, 82], [50, 100], [32, 82], [43, 82], [43, 57], [18, 57], [18, 68], [0, 50], [18, 32], [18, 43], [43, 43], [43, 18], [32, 18]])),
  def('bent-arrow', 'Mũi tên gấp khúc', 'arrows', 'bentArrow', 'M0 100V44A28 28 0 0 1 28 16H70V0L100 28L70 56V40H28A4 4 0 0 0 24 44V100Z'),
  def('u-turn-arrow', 'Mũi tên quay đầu', 'arrows', 'uturnArrow', 'M0 100V40A40 40 0 0 1 80 40V55H100L70 85L40 55H58V40A18 18 0 0 0 22 40V100Z'),
  def('chevron', 'Chữ V', 'arrows', 'chevron', poly([[0, 0], [70, 0], [100, 50], [70, 100], [0, 100], [30, 50]])),
  def('pentagon-arrow', 'Mũi tên ngũ giác', 'arrows', 'homePlate', poly([[0, 0], [70, 0], [100, 50], [70, 100], [0, 100]])),
  def('notched-arrow', 'Mũi tên có khía', 'arrows', 'notchedRightArrow', poly([[0, 25], [60, 25], [60, 0], [100, 50], [60, 100], [60, 75], [0, 75], [12, 50]])),
  def('striped-arrow', 'Mũi tên có sọc', 'arrows', 'stripedRightArrow', 'M0 25H4V75H0ZM8 25H16V75H8ZM20 25H60V0L100 50L60 100V75H20Z'),
  def('right-arrow-callout', 'Chú thích mũi tên phải', 'arrows', 'rightArrowCallout', 'M0 0H60V30H72V15L100 50L72 85V70H60V100H0Z'),
  def('down-arrow-callout', 'Chú thích mũi tên xuống', 'arrows', 'downArrowCallout', 'M0 0H100V60H70V72H85L50 100L15 72H30V60H0Z'),

  def('math-plus', 'Dấu cộng', 'equation', 'mathPlus', poly([[38, 0], [62, 0], [62, 38], [100, 38], [100, 62], [62, 62], [62, 100], [38, 100], [38, 62], [0, 62], [0, 38], [38, 38]])),
  def('math-minus', 'Dấu trừ', 'equation', 'mathMinus', 'M0 38H100V62H0Z'),
  def('math-multiply', 'Dấu nhân', 'equation', 'mathMultiply', poly([[15, 0], [50, 35], [85, 0], [100, 15], [65, 50], [100, 85], [85, 100], [50, 65], [15, 100], [0, 85], [35, 50], [0, 15]])),
  def('math-divide', 'Dấu chia', 'equation', 'mathDivide', 'M0 40H100V60H0ZM50 8A10 10 0 1 1 50 28A10 10 0 1 1 50 8ZM50 72A10 10 0 1 1 50 92A10 10 0 1 1 50 72Z'),
  def('math-equal', 'Dấu bằng', 'equation', 'mathEqual', 'M0 20H100V42H0ZM0 58H100V80H0Z'),
  def('math-not-equal', 'Dấu khác', 'equation', 'mathNotEqual', 'M0 20H100V42H0ZM0 58H100V80H0ZM60 0H76L40 100H24Z'),

  def('flow-process', 'Xử lý', 'flowchart', 'flowChartProcess', RECT),
  def('flow-alternate', 'Xử lý thay thế', 'flowchart', 'flowChartAlternateProcess', ROUND_RECT),
  def('flow-decision', 'Quyết định', 'flowchart', 'flowChartDecision', DIAMOND),
  def('flow-data', 'Dữ liệu', 'flowchart', 'flowChartInputOutput', poly([[20, 0], [100, 0], [80, 100], [0, 100]])),
  def('flow-predefined', 'Xử lý định sẵn', 'flowchart', 'flowChartPredefinedProcess', RECT, { detail: 'M12.5 0V100M87.5 0V100' }),
  def('flow-internal-storage', 'Lưu trữ nội bộ', 'flowchart', 'flowChartInternalStorage', RECT, { detail: 'M12.5 0V100M0 12.5H100' }),
  def('flow-document', 'Tài liệu', 'flowchart', 'flowChartDocument', 'M0 0H100V82Q75 64 50 82T0 82Z'),
  def('flow-terminator', 'Bắt đầu, kết thúc', 'flowchart', 'flowChartTerminator', 'M16 0H84A16 50 0 0 1 84 100H16A16 50 0 0 1 16 0Z'),
  def('flow-preparation', 'Chuẩn bị', 'flowchart', 'flowChartPreparation', poly([[20, 0], [80, 0], [100, 50], [80, 100], [20, 100], [0, 50]])),
  def('flow-manual-input', 'Nhập thủ công', 'flowchart', 'flowChartManualInput', poly([[0, 20], [100, 0], [100, 100], [0, 100]])),
  def('flow-manual-operation', 'Thao tác thủ công', 'flowchart', 'flowChartManualOperation', poly([[0, 0], [100, 0], [80, 100], [20, 100]])),
  def('flow-connector', 'Điểm nối', 'flowchart', 'flowChartConnector', ELLIPSE),
  def('flow-offpage', 'Nối sang trang', 'flowchart', 'flowChartOffpageConnector', poly([[0, 0], [100, 0], [100, 80], [50, 100], [0, 80]])),
  def('flow-card', 'Thẻ', 'flowchart', 'flowChartPunchedCard', poly([[20, 0], [100, 0], [100, 100], [0, 100], [0, 20]])),
  def('flow-delay', 'Trễ', 'flowchart', 'flowChartDelay', 'M0 0H50A50 50 0 0 1 50 100H0Z'),
  def('flow-stored-data', 'Dữ liệu lưu trữ', 'flowchart', 'flowChartOnlineStorage', 'M17 0H100A17 50 0 0 0 100 100H17A17 50 0 0 1 17 0Z'),
  def('flow-database', 'Cơ sở dữ liệu', 'flowchart', 'flowChartMagneticDisk', CAN, { detail: CAN_DETAIL }),
  def('flow-display', 'Hiển thị', 'flowchart', 'flowChartDisplay', 'M0 50L17 0H83A17 50 0 0 1 83 100H17Z'),
  def('flow-merge', 'Gộp', 'flowchart', 'flowChartMerge', poly([[0, 0], [100, 0], [50, 100]])),
  def('flow-extract', 'Tách', 'flowchart', 'flowChartExtract', poly([[50, 0], [100, 100], [0, 100]])),
  def('flow-or', 'Hoặc', 'flowchart', 'flowChartOr', ELLIPSE, { detail: 'M50 0V100M0 50H100' }),
  def('flow-summing', 'Điểm cộng', 'flowchart', 'flowChartSummingJunction', ELLIPSE, { detail: 'M14.6 14.6L85.4 85.4M85.4 14.6L14.6 85.4' }),
  def('flow-collate', 'Đối chiếu', 'flowchart', 'flowChartCollate', 'M0 0H100L50 50ZM50 50L100 100H0Z'),
  def('flow-sort', 'Sắp xếp', 'flowchart', 'flowChartSort', DIAMOND, { detail: 'M0 50H100' }),

  def('star-4', 'Sao 4 cánh', 'stars', 'star4', star(4, 0.38)),
  def('star', 'Sao 5 cánh', 'stars', 'star5', star(5, 0.382)),
  def('star-6', 'Sao 6 cánh', 'stars', 'star6', star(6, 0.58)),
  def('star-8', 'Sao 8 cánh', 'stars', 'star8', star(8, 0.75)),
  def('star-12', 'Sao 12 cánh', 'stars', 'star12', star(12, 0.75)),
  def('star-16', 'Sao 16 cánh', 'stars', 'star16', star(16, 0.75)),
  def('star-24', 'Sao 24 cánh', 'stars', 'star24', star(24, 0.75)),
  def('star-32', 'Sao 32 cánh', 'stars', 'star32', star(32, 0.75)),
  def('explosion', 'Vụ nổ', 'stars', 'irregularSeal1', fromEmu([[10800, 5800], [14522, 0], [14155, 5325], [18380, 4457], [16702, 7315], [21097, 8137], [17607, 10475], [21600, 13290], [16837, 12942], [18145, 18095], [14020, 14457], [13247, 19737], [10532, 14935], [8485, 21600], [7715, 15627], [4762, 17617], [5667, 13937], [135, 14587], [3722, 11775], [0, 8615], [4627, 7617], [370, 2295], [7312, 6320], [8352, 2295]])),
  def('ribbon', 'Dải băng', 'stars', 'ribbon2', poly([[0, 20], [20, 20], [20, 0], [80, 0], [80, 20], [100, 20], [88, 45], [100, 70], [75, 70], [75, 80], [25, 80], [25, 70], [0, 70], [12, 45]])),
  def('wave', 'Sóng', 'stars', 'wave', 'M0 20Q25 0 50 20T100 20V80Q75 100 50 80T0 80Z'),

  def('callout', 'Chú thích chữ nhật', 'callouts', 'wedgeRectCallout', 'M0 0H100V75H42L20 100L25 75H0Z'),
  def('rounded-callout', 'Chú thích bo góc', 'callouts', 'wedgeRoundRectCallout', 'M12 0H88A12 12 0 0 1 100 12V63A12 12 0 0 1 88 75H42L20 100L25 75H12A12 12 0 0 1 0 63V12A12 12 0 0 1 12 0Z'),
  def('oval-callout', 'Chú thích hình elip', 'callouts', 'wedgeEllipseCallout', 'M50 0A50 40 0 0 1 100 40A50 40 0 0 1 45 79.8L20 100L28 75.9A50 40 0 0 1 0 40A50 40 0 0 1 50 0Z'),
];

const SHAPE_BY_ID = new Map(SHAPE_DEFS.map((shape) => [shape.id, shape]));

const PRST_ALIASES: Record<string, string> = {
  straightConnector1: 'line',
  bentConnector3: 'line',
  curvedConnector3: 'line',
  flowChartMagneticDrum: 'flow-database',
  flowChartPunchedTape: 'wave',
  flowChartMultidocument: 'flow-document',
  star7: 'star-8',
  star10: 'star-12',
  irregularSeal2: 'explosion',
  ribbon: 'ribbon',
  cloudCallout: 'oval-callout',
  doubleWave: 'wave',
  leftArrowCallout: 'right-arrow-callout',
  upArrowCallout: 'down-arrow-callout',
  actionButtonBlank: 'rectangle',
  snipRoundRect: 'snip-single',
  round2DiagRect: 'round-diagonal',
  curvedRightArrow: 'right-arrow',
  curvedLeftArrow: 'left-arrow',
  curvedUpArrow: 'up-arrow',
  curvedDownArrow: 'down-arrow',
  leftUpArrow: 'bent-arrow',
  bentUpArrow: 'bent-arrow',
  leftRightUpArrow: 'quad-arrow',
  circularArrow: 'block-arc',
};

const SHAPE_BY_PRST = new Map<string, string>();
for (const shape of SHAPE_DEFS) {
  if (!SHAPE_BY_PRST.has(shape.prst)) SHAPE_BY_PRST.set(shape.prst, shape.id);
}

export function getShapeDef(id: string | undefined): ShapeDef {
  return SHAPE_BY_ID.get(id ?? '') ?? SHAPE_BY_ID.get('rectangle')!;
}

export function isKnownShape(id: string | undefined): boolean {
  return SHAPE_BY_ID.has(id ?? '');
}

export function isLineShape(id: string | undefined): boolean {
  return getShapeDef(id).line !== undefined;
}

export function shapeLabel(id: string | undefined): string {
  return id === 'custom' ? 'Hình tự do' : getShapeDef(id).label;
}

export function shapeFromPrst(prst: string | undefined): string {
  if (!prst) return 'rectangle';
  return SHAPE_BY_PRST.get(prst) ?? PRST_ALIASES[prst] ?? 'rectangle';
}

export function shapesByCategory(): { category: ShapeCategory; label: string; shapes: ShapeDef[] }[] {
  return SHAPE_CATEGORY_ORDER.map((category) => ({
    category,
    label: SHAPE_CATEGORY_LABELS[category],
    shapes: SHAPE_DEFS.filter((shape) => shape.category === category),
  }));
}

export interface PathCommand {
  type: 'M' | 'L' | 'C' | 'Q' | 'Z';
  points: number[];
}

export function parseSimplePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const pattern = /([MLCQZ])([^MLCQZ]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(d)) !== null) {
    const type = match[1] as PathCommand['type'];
    const points = (match[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    commands.push({ type, points });
  }
  return commands;
}
