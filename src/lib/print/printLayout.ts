import { PAPER_CATALOG, PAPER_KEYS, paperLabel, type PaperKey } from '../paperSizes';

export const MM_PER_PX = 25.4 / 96;
export const pxToMm = (px: number) => px * MM_PER_PX;
export const mmToPx = (mm: number) => mm / MM_PER_PX;

export type { PaperKey } from '../paperSizes';
export type Orientation = 'portrait' | 'landscape';
export type OrientationChoice = Orientation | 'auto';
export type Margins = { top: number; right: number; bottom: number; left: number };
export type MarginPreset = 'auto' | MarginPresetId | 'custom';
export type ScaleMode = 'auto' | 'actual' | 'fit-width' | 'fit-page' | 'custom';
export type ContentKind = 'document' | 'sheet' | 'slide' | 'pdf' | 'image';
export type Size = { w: number; h: number };

export const PAPERS: Record<PaperKey, Size & { label: string }> = Object.fromEntries(
  PAPER_KEYS.map((key) => [key, { w: PAPER_CATALOG[key].w, h: PAPER_CATALOG[key].h, label: paperLabel(key) }]),
) as Record<PaperKey, Size & { label: string }>;

export const HARDWARE_MIN_MM = 5;
export const READABLE_MIN_SCALE = 0.55;

export type MarginFamily = 'word' | 'excel' | 'vn' | 'none';

export type MarginPresetDef = Margins & {
  name: string;
  family: MarginFamily;
  mirror?: boolean;
  header?: number;
  footer?: number;
};

export const MARGIN_PRESETS = {
  normal: { name: 'Thường', family: 'word', top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
  narrow: { name: 'Hẹp', family: 'word', top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  moderate: { name: 'Vừa', family: 'word', top: 25.4, bottom: 25.4, left: 19.05, right: 19.05 },
  wide: { name: 'Rộng', family: 'word', top: 25.4, bottom: 25.4, left: 50.8, right: 50.8 },
  mirrored: { name: 'Đối xứng', family: 'word', top: 25.4, bottom: 25.4, left: 31.75, right: 25.4, mirror: true },
  office2003: { name: 'Mặc định Office 2003', family: 'word', top: 25.4, bottom: 25.4, left: 31.75, right: 31.75 },
  decree30: { name: 'Văn bản hành chính (NĐ 30)', family: 'vn', top: 20, bottom: 20, left: 30, right: 15 },
  excelNormal: { name: 'Thường (Excel)', family: 'excel', top: 19.05, bottom: 19.05, left: 17.78, right: 17.78, header: 7.62, footer: 7.62 },
  excelWide: { name: 'Rộng (Excel)', family: 'excel', top: 25.4, bottom: 25.4, left: 25.4, right: 25.4, header: 12.7, footer: 12.7 },
  excelNarrow: { name: 'Hẹp (Excel)', family: 'excel', top: 19.05, bottom: 19.05, left: 6.35, right: 6.35, header: 7.62, footer: 7.62 },
  none: { name: 'Không lề (tràn viền)', family: 'none', top: 0, bottom: 0, left: 0, right: 0 },
} satisfies Record<string, MarginPresetDef>;

export type MarginPresetId = keyof typeof MARGIN_PRESETS;

export const MARGIN_PRESET_IDS = Object.keys(MARGIN_PRESETS) as MarginPresetId[];

export const formatCm = (mm: number) => String(Math.round(mm * 10) / 100).replace('.', ',');

export function describeMargins(m: Margins, mirror = false): string {
  const c = formatCm;
  const side = mirror ? ['Trong', 'Ngoài'] : ['Trái', 'Phải'];
  return `Trên ${c(m.top)} · Dưới ${c(m.bottom)} · ${side[0]} ${c(m.left)} · ${side[1]} ${c(m.right)} cm`;
}

export const presetMargins = (id: MarginPresetId): Margins => {
  const p: MarginPresetDef = MARGIN_PRESETS[id];
  return { top: p.top, right: p.right, bottom: p.bottom, left: p.left };
};

export const sameMargins = (a: Margins, b: Margins, tolerance = 0.3) =>
  (['top', 'right', 'bottom', 'left'] as const).every((k) => Math.abs(a[k] - b[k]) <= tolerance);

const PREFERRED: Record<ContentKind, Margins> = {
  document: presetMargins('normal'),
  sheet: { top: 19, right: 17.8, bottom: 19, left: 17.8 },
  slide: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  pdf: { top: 6, right: 6, bottom: 6, left: 6 },
  image: { top: 10, right: 10, bottom: 10, left: 10 },
};

const MAX_UPSCALE: Record<ContentKind, number> = { document: 1, sheet: 1, slide: 4, pdf: 1, image: 4 };

export type LayoutRequest = {
  kind: ContentKind;
  content: Size;
  paper: PaperKey;
  orientation: OrientationChoice;
  marginPreset: MarginPreset;
  customMargins?: Margins;
  scaleMode: ScaleMode;
  customScale?: number;
  centerH: boolean;
  centerV: boolean;
  flowsVertically?: boolean;
  paperSize?: Size;
  gutter?: { size: number; position: 'left' | 'top' };
};

export type PageLayout = {
  orientation: Orientation;
  paper: Size;
  margins: Margins;
  printable: Size;
  scale: number;
  placement: { x: number; y: number; w: number; h: number };
  effectiveMargins: Margins;
  pagesPerItem: number;
  notes: string[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampMargin = (m: number) => Math.max(0, m);
const sizeFor = (paper: PaperKey, orientation: Orientation, custom?: Size): Size => {
  const p = custom && isUsableSize(custom) ? custom : PAPERS[paper];
  return orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
};

export const isUsableSize = (s: Size) => Number.isFinite(s.w) && Number.isFinite(s.h) && s.w > 0 && s.h > 0;

function baseMargins(req: LayoutRequest): Margins {
  if (req.marginPreset === 'custom' && req.customMargins) {
    const m = req.customMargins;
    return { top: clampMargin(m.top), right: clampMargin(m.right), bottom: clampMargin(m.bottom), left: clampMargin(m.left) };
  }
  if (req.marginPreset === 'auto' || req.marginPreset === 'custom') return { ...PREFERRED[req.kind] };
  return presetMargins(req.marginPreset);
}

function marginsFor(req: LayoutRequest): Margins {
  const m = baseMargins(req);
  const gutter = Math.max(0, req.gutter?.size ?? 0);
  if (!gutter) return m;
  return req.gutter?.position === 'top' ? { ...m, top: m.top + gutter } : { ...m, left: m.left + gutter };
}

function fitScale(req: LayoutRequest, printable: Size): number {
  const { content } = req;
  const widthFit = printable.w / content.w;
  const pageFit = Math.min(widthFit, printable.h / content.h);
  switch (req.scaleMode) {
    case 'actual':
      return 1;
    case 'custom':
      return Math.max(0.1, Math.min(4, (req.customScale ?? 100) / 100));
    case 'fit-width':
      return widthFit;
    case 'fit-page':
      return req.flowsVertically ? widthFit : pageFit;
    case 'auto':
    default: {
      const fit = req.flowsVertically ? widthFit : pageFit;
      return Math.min(MAX_UPSCALE[req.kind], fit);
    }
  }
}

function shrinkMarginsToFit(req: LayoutRequest, paper: Size, base: Margins, notes: string[]): Margins {
  const m = { ...base };
  const floor = HARDWARE_MIN_MM;
  const sideRoom = paper.w - req.content.w;
  if (sideRoom < m.left + m.right) {
    const side = Math.max(floor, sideRoom / 2);
    if (side < Math.min(m.left, m.right)) {
      m.left = side;
      m.right = side;
      notes.push(`Thu lề trái/phải còn ${round1(side)} mm để nội dung vừa bề ngang`);
    }
  }
  if (!req.flowsVertically) {
    const vRoom = paper.h - req.content.h;
    if (vRoom < m.top + m.bottom) {
      const edge = Math.max(floor, vRoom / 2);
      if (edge < Math.min(m.top, m.bottom)) {
        m.top = edge;
        m.bottom = edge;
        notes.push(`Thu lề trên/dưới còn ${round1(edge)} mm để nội dung vừa chiều cao`);
      }
    }
  }
  return m;
}

function layoutFor(req: LayoutRequest, orientation: Orientation): PageLayout {
  const notes: string[] = [];
  const paper = sizeFor(req.paper, orientation, req.paperSize);
  let margins = marginsFor(req);
  if (req.marginPreset === 'auto' && (req.scaleMode === 'auto' || req.scaleMode === 'actual')) {
    margins = shrinkMarginsToFit(req, paper, margins, notes);
  }
  if (req.marginPreset !== 'none') {
    const under = (Object.keys(margins) as (keyof Margins)[]).filter((k) => margins[k] > 0 && margins[k] < HARDWARE_MIN_MM);
    if (under.length) notes.push(`Lề dưới ${HARDWARE_MIN_MM} mm có thể bị máy in cắt mất`);
  }
  const printable = { w: Math.max(1, paper.w - margins.left - margins.right), h: Math.max(1, paper.h - margins.top - margins.bottom) };
  const scale = fitScale(req, printable);
  const w = req.content.w * scale;
  const h = req.content.h * scale;
  const freeX = Math.max(0, printable.w - w);
  const freeY = req.flowsVertically ? 0 : Math.max(0, printable.h - h);
  const x = margins.left + (req.centerH ? freeX / 2 : 0);
  const y = margins.top + (req.centerV ? freeY / 2 : 0);
  const pagesPerItem = req.flowsVertically ? Math.max(1, Math.ceil(h / printable.h - 1e-6)) : 1;
  if (req.scaleMode !== 'actual' && scale < 0.999 && scale > 0) notes.push(`Thu nhỏ còn ${Math.round(scale * 100)}% để vừa trang`);
  if (scale > 1.001) notes.push(`Phóng to ${Math.round(scale * 100)}% cho kín vùng in`);
  if (scale < READABLE_MIN_SCALE) notes.push('Chữ sẽ rất nhỏ — nên chọn khổ lớn hơn hoặc khổ ngang');
  if (!req.flowsVertically && (w > printable.w + 0.5 || h > printable.h + 0.5)) notes.push('Nội dung tràn khỏi vùng in, một phần sẽ bị cắt');
  return {
    orientation,
    paper,
    margins,
    printable,
    scale,
    placement: { x, y, w, h },
    effectiveMargins: {
      top: y,
      left: x,
      right: Math.max(0, paper.w - x - w),
      bottom: req.flowsVertically ? margins.bottom : Math.max(0, paper.h - y - h),
    },
    pagesPerItem,
    notes,
  };
}

const usefulScore = (layout: PageLayout, req: LayoutRequest) => {
  const used = (layout.placement.w * Math.min(layout.placement.h, layout.printable.h)) / (layout.printable.w * layout.printable.h);
  const scalePenalty = req.flowsVertically ? Math.min(1, layout.scale) * 2 : Math.min(1, layout.scale);
  return scalePenalty * 10 + used - layout.pagesPerItem * 0.01;
};

export function computePageLayout(req: LayoutRequest): PageLayout {
  const content = isUsableSize(req.content) ? req.content : { w: 1, h: 1 };
  const safe = { ...req, content };
  if (req.orientation !== 'auto') return layoutFor(safe, req.orientation);
  const portrait = layoutFor(safe, 'portrait');
  const landscape = layoutFor(safe, 'landscape');
  const sp = usefulScore(portrait, safe);
  const sl = usefulScore(landscape, safe);
  const preferLandscape = content.w > content.h * 1.05;
  const pick = Math.abs(sp - sl) < 0.02 ? (preferLandscape ? landscape : portrait) : sl > sp ? landscape : portrait;
  return { ...pick, notes: [`Tự chọn khổ ${pick.orientation === 'landscape' ? 'ngang' : 'dọc'}`, ...pick.notes] };
}

export function sliceOffsets(totalHeight: number, sliceHeight: number, breaks: number[] = [], forced: number[] = []): number[] {
  if (!(totalHeight > 0) || !(sliceHeight > 0)) return [0];
  const sorted = [...new Set(breaks.filter((b) => b > 0 && b < totalHeight))].sort((a, b) => a - b);
  const hard = [...new Set(forced.filter((b) => b > 0.5 && b < totalHeight - 0.5))].sort((a, b) => a - b);
  const nextHard = (from: number) => hard.find((b) => b > from + 0.5);
  const starts = [0];
  let start = 0;
  let guard = 0;
  while ((start + sliceHeight < totalHeight - 0.5 || nextHard(start) !== undefined) && guard < 2000) {
    guard += 1;
    const limit = start + sliceHeight;
    const hardCut = nextHard(start);
    if (hardCut !== undefined && hardCut <= limit) {
      start = hardCut;
      starts.push(start);
      continue;
    }
    let cut = limit;
    for (const b of sorted) {
      if (b <= start + sliceHeight * 0.25) continue;
      if (b > limit) break;
      cut = b;
    }
    start = cut;
    starts.push(start);
  }
  return starts;
}

export function parsePageRange(input: string, total: number): number[] {
  const all = Array.from({ length: Math.max(0, total) }, (_, i) => i + 1);
  const text = input.trim();
  if (!text) return all;
  const pages = new Set<number>();
  for (const part of text.split(/[,;]+/)) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)?\s*[-–]\s*(\d+)?$/);
    if (range) {
      const from = range[1] ? Number(range[1]) : 1;
      const to = range[2] ? Number(range[2]) : total;
      const [a, b] = from <= to ? [from, to] : [to, from];
      for (let p = Math.max(1, a); p <= Math.min(total, b); p += 1) pages.add(p);
      continue;
    }
    const single = Number(token);
    if (Number.isInteger(single) && single >= 1 && single <= total) pages.add(single);
  }
  return [...pages].sort((a, b) => a - b);
}

export type GridCell = { x: number; y: number; w: number; h: number };

export function gridCells(area: GridCell, cols: number, rows: number, gap: number): GridCell[] {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const w = (area.w - gap * (c - 1)) / c;
  const h = (area.h - gap * (r - 1)) / r;
  const cells: GridCell[] = [];
  for (let row = 0; row < r; row += 1) {
    for (let col = 0; col < c; col += 1) cells.push({ x: area.x + col * (w + gap), y: area.y + row * (h + gap), w, h });
  }
  return cells;
}

export function fitInto(content: Size, box: GridCell): GridCell {
  if (!isUsableSize(content)) return box;
  const s = Math.min(box.w / content.w, box.h / content.h);
  const w = content.w * s;
  const h = content.h * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export type DocMarginInput = {
  paper: Size;
  margins: Margins;
  widestObjectMm: number;
  administrative: boolean;
  binding: boolean;
};

export type DocMarginAdvice = { margins: Margins; landscape: boolean; notes: string[] };

const DOC_SIDE_FLOOR = 12.7;
const DOC_EDGE_FLOOR = 12.7;

export function recommendDocumentMargins(input: DocMarginInput): DocMarginAdvice {
  const notes: string[] = [];
  let m: Margins = { ...input.margins };
  if (input.administrative) {
    m = { top: 20, right: 15, bottom: 20, left: 30 };
    notes.push('Văn bản hành chính: áp lề Nghị định 30 (trên 2, dưới 2, trái 3, phải 1,5 cm)');
  } else {
    if (m.top < DOC_EDGE_FLOOR || m.bottom < DOC_EDGE_FLOOR) {
      m.top = Math.max(m.top, DOC_EDGE_FLOOR);
      m.bottom = Math.max(m.bottom, DOC_EDGE_FLOOR);
      notes.push(`Nâng lề trên/dưới lên ít nhất ${DOC_EDGE_FLOOR} mm để máy in không cắt chữ`);
    }
    const sides = (m.left + m.right) / 2;
    const balanced = Math.max(DOC_SIDE_FLOOR, round1(sides));
    if (Math.abs(m.left - m.right) > 0.5 || m.left < DOC_SIDE_FLOOR || m.right < DOC_SIDE_FLOOR) {
      m.left = balanced;
      m.right = balanced;
      notes.push(`Cân lề trái/phải bằng nhau ${balanced} mm`);
    }
  }
  if (input.binding) {
    m.left += 10;
    notes.push('Cộng 10 mm lề gáy để đóng quyển');
  }
  let landscape = false;
  const width = () => input.paper.w - m.left - m.right;
  if (input.widestObjectMm > width() + 0.5) {
    const leftFloor = input.administrative ? 30 : DOC_SIDE_FLOOR + (input.binding ? 10 : 0);
    const rightFloor = input.administrative ? 15 : DOC_SIDE_FLOOR;
    const need = input.widestObjectMm - width();
    const spareLeft = Math.max(0, m.left - leftFloor);
    const spareRight = Math.max(0, m.right - rightFloor);
    const canGive = spareLeft + spareRight;
    if (canGive >= need) {
      const giveLeft = need * (spareLeft / canGive);
      m.left = round1(m.left - giveLeft);
      m.right = round1(m.right - (need - giveLeft));
      notes.push(`Thu lề hai bên để bảng/ảnh rộng nhất (${round1(input.widestObjectMm)} mm) nằm trọn trong trang`);
    } else {
      m.left = leftFloor;
      m.right = rightFloor;
      landscape = input.widestObjectMm > input.paper.w - leftFloor - rightFloor && input.paper.h > input.paper.w;
      notes.push(landscape
        ? 'Bảng/ảnh rộng hơn khổ dọc — nên chuyển sang khổ ngang'
        : 'Thu lề tối thiểu, bảng/ảnh vẫn hơi rộng');
    }
  }
  if (!notes.length) notes.push('Lề hiện tại đã cân đối, không cần đổi');
  return { margins: { top: round1(m.top), right: round1(m.right), bottom: round1(m.bottom), left: round1(m.left) }, landscape, notes };
}

export const ADMIN_MARKERS = [/c[ộo]ng\s+h[òo]a\s+x[ãa]\s+h[ộo]i\s+ch[ủu]\s+ngh[ĩi]a\s+vi[ệe]t\s+nam/i, /đ[ộo]c\s+l[ậa]p\s*[-–]\s*t[ựu]\s+do\s*[-–]\s*h[ạa]nh\s+ph[úu]c/i];

export const looksAdministrative = (text: string) => ADMIN_MARKERS.some((re) => re.test(text.slice(0, 4000)));
