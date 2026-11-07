export type Point = { x: number; y: number };
export type RulerState = { x: number; y: number; angle: number };
export type StrokeLike = { id: string; width: number; points: number[] };
export type ShapeKind = 'line' | 'rectangle' | 'ellipse' | 'triangle' | 'arrow';

export const RULER_LENGTH = 720;
export const RULER_THICKNESS = 72;
const RULER_SNAP_DISTANCE = 16;
const ELLIPSE_POINTS = 48;
const STRAIGHT_RATIO = 1.08;
const ELLIPSE_DEVIATION = 0.11;
const RECT_FILL_RATIO = 0.86;
const MIN_SHAPE_SIZE = 12;

export const toPoints = (flat: number[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

export const toFlat = (points: Point[]) => points.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const distanceToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (!length) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

export const strokeDistance = (flat: number[], x: number, y: number) => {
  const points = toPoints(flat);
  if (!points.length) return Infinity;
  if (points.length === 1) return dist({ x, y }, points[0]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, distanceToSegment({ x, y }, points[i - 1], points[i]));
  return best;
};

export const strokeHit = (stroke: StrokeLike, x: number, y: number, tolerance: number) => strokeDistance(stroke.points, x, y) <= tolerance + stroke.width / 2;

export const boundsOf = (flat: number[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    minX = Math.min(minX, flat[i]);
    maxX = Math.max(maxX, flat[i]);
    minY = Math.min(minY, flat[i + 1]);
    maxY = Math.max(maxY, flat[i + 1]);
  }
  return { minX, minY, maxX, maxY };
};

export const boundsOfStrokes = (strokes: StrokeLike[]) => {
  if (!strokes.length) return null;
  const all = strokes.map((s) => {
    const b = boundsOf(s.points);
    return { minX: b.minX - s.width / 2, minY: b.minY - s.width / 2, maxX: b.maxX + s.width / 2, maxY: b.maxY + s.width / 2 };
  });
  return {
    minX: Math.min(...all.map((b) => b.minX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
};

export const translateFlat = (flat: number[], dx: number, dy: number) => flat.map((value, index) => value + (index % 2 === 0 ? dx : dy));

export const pointInPolygon = (p: Point, polygon: Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

export const strokeInsidePolygon = (flat: number[], polygon: Point[], share = 0.75) => {
  const points = toPoints(flat);
  if (!points.length || polygon.length < 3) return false;
  return points.filter((p) => pointInPolygon(p, polygon)).length / points.length >= share;
};

export const strokeTouchesRect = (flat: number[], a: Point, b: Point) => {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return toPoints(flat).some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
};

const densify = (points: Point[], step: number) => {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const pieces = Math.ceil(dist(a, b) / step);
    for (let n = 1; n <= pieces; n++) out.push({ x: a.x + ((b.x - a.x) * n) / pieces, y: a.y + ((b.y - a.y) * n) / pieces });
  }
  return out;
};

export const eraseFromFlat = (flat: number[], x: number, y: number, radius: number): number[][] | null => {
  const points = densify(toPoints(flat), Math.max(2, radius / 2));
  const center = { x, y };
  if (!points.some((p) => dist(p, center) <= radius)) return null;
  const pieces: number[][] = [];
  let current: Point[] = [];
  for (const point of points) {
    if (dist(point, center) <= radius) {
      if (current.length >= 2) pieces.push(toFlat(current));
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length >= 2) pieces.push(toFlat(current));
  return pieces;
};

export const simplify = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let index = 0;
  let farthest = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], first, last);
    if (d > farthest) {
      farthest = d;
      index = i;
    }
  }
  if (farthest <= tolerance) return [first, last];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
};

const pathLength = (points: Point[]) => points.reduce((sum, p, i) => (i ? sum + dist(points[i - 1], p) : 0), 0);

const polygonArea = (points: Point[]) => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
};

const closedCorners = (points: Point[], tolerance: number) => {
  const raw = simplify(points, tolerance);
  const corners = raw.slice(0, -1);
  const merged: Point[] = [];
  for (const corner of corners) {
    if (!merged.length || dist(merged[merged.length - 1], corner) > tolerance * 1.5) merged.push(corner);
  }
  if (merged.length > 2 && dist(merged[0], merged[merged.length - 1]) <= tolerance * 1.5) merged.pop();
  const straightened = merged.filter((corner, i) => {
    const before = merged[(i + merged.length - 1) % merged.length];
    const after = merged[(i + 1) % merged.length];
    return distanceToSegment(corner, before, after) > tolerance;
  });
  return straightened.length >= 3 ? straightened : merged;
};

const ellipseFlat = (cx: number, cy: number, rx: number, ry: number) => {
  const out: Point[] = [];
  for (let i = 0; i <= ELLIPSE_POINTS; i++) {
    const angle = (i / ELLIPSE_POINTS) * Math.PI * 2;
    out.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return toFlat(out);
};

const closeLoop = (corners: Point[]) => toFlat([...corners, corners[0]]);

const arrowFrom = (shaftStart: Point, tip: Point, headSize: number) => {
  const angle = Math.atan2(tip.y - shaftStart.y, tip.x - shaftStart.x);
  const barb = (offset: number) => ({ x: tip.x - headSize * Math.cos(angle + offset), y: tip.y - headSize * Math.sin(angle + offset) });
  return toFlat([shaftStart, tip, barb(0.5), tip, barb(-0.5)]);
};

const detectArrow = (simplified: Point[]) => {
  if (simplified.length < 4) return null;
  let longest = -1;
  let size = 0;
  for (let i = 1; i < simplified.length; i++) {
    const length = dist(simplified[i - 1], simplified[i]);
    if (length > size) {
      size = length;
      longest = i;
    }
  }
  const start = simplified[longest - 1];
  const end = simplified[longest];
  const tail = simplified.slice(longest + 1);
  const lead = simplified.slice(0, longest - 1);
  const nearTip = (group: Point[], tip: Point) => group.length >= 2 && group.every((p) => dist(p, tip) <= size * 0.5);
  if (!lead.length && nearTip(tail, end)) {
    const head = Math.max(...tail.map((p) => dist(p, end)));
    return arrowFrom(start, end, head);
  }
  if (!tail.length && nearTip(lead, start)) {
    const head = Math.max(...lead.map((p) => dist(p, start)));
    return arrowFrom(end, start, head);
  }
  return null;
};

export function recognizeShape(flat: number[]): { type: ShapeKind; points: number[] } | null {
  const points = toPoints(flat);
  if (points.length < 2) return null;
  const { minX, minY, maxX, maxY } = boundsOf(flat);
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  if (diagonal < MIN_SHAPE_SIZE) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const travelled = pathLength(points);
  const chord = dist(first, last);
  if (chord && travelled / chord <= STRAIGHT_RATIO) return { type: 'line', points: toFlat([first, last]) };

  const tolerance = Math.max(3, diagonal * 0.05);
  const isClosed = chord <= Math.max(18, diagonal * 0.22) && travelled > diagonal * 2;
  if (!isClosed) {
    const arrow = detectArrow(simplify(points, tolerance));
    return arrow ? { type: 'arrow', points: arrow } : null;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(1, width / 2);
  const ry = Math.max(1, height / 2);
  const deviation = points.reduce((sum, p) => sum + Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1), 0) / points.length;
  const corners = closedCorners(points, tolerance);
  const fill = polygonArea(points) / Math.max(1, width * height);
  if (deviation <= ELLIPSE_DEVIATION && corners.length !== 3) return { type: 'ellipse', points: ellipseFlat(cx, cy, rx, ry) };
  if (corners.length === 3) return { type: 'triangle', points: closeLoop(corners) };
  if (corners.length === 4) {
    if (fill >= RECT_FILL_RATIO) return { type: 'rectangle', points: closeLoop([{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }]) };
    return { type: 'rectangle', points: closeLoop(corners) };
  }
  if (fill >= RECT_FILL_RATIO) return { type: 'rectangle', points: closeLoop([{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }]) };
  return null;
}

export const rulerToLocal = (ruler: RulerState, x: number, y: number): Point => {
  const angle = (-ruler.angle * Math.PI) / 180;
  const dx = x - ruler.x;
  const dy = y - ruler.y;
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
};

export const rulerToWorld = (ruler: RulerState, local: Point): Point => {
  const angle = (ruler.angle * Math.PI) / 180;
  return { x: ruler.x + local.x * Math.cos(angle) - local.y * Math.sin(angle), y: ruler.y + local.x * Math.sin(angle) + local.y * Math.cos(angle) };
};

export const rulerEdgeAt = (ruler: RulerState, x: number, y: number): number | null => {
  const local = rulerToLocal(ruler, x, y);
  if (Math.abs(local.x) > RULER_LENGTH / 2 + RULER_SNAP_DISTANCE) return null;
  const half = RULER_THICKNESS / 2;
  if (Math.abs(local.y - half) <= RULER_SNAP_DISTANCE) return half;
  if (Math.abs(local.y + half) <= RULER_SNAP_DISTANCE) return -half;
  return null;
};

export const snapToRuler = (ruler: RulerState, edge: number, x: number, y: number) => {
  const local = rulerToLocal(ruler, x, y);
  return rulerToWorld(ruler, { x: local.x, y: edge });
};

export const insideRulerBody = (ruler: RulerState, x: number, y: number) => {
  const local = rulerToLocal(ruler, x, y);
  return Math.abs(local.x) <= RULER_LENGTH / 2 && Math.abs(local.y) <= RULER_THICKNESS / 2;
};

export const fountainOutline = (flat: number[], width: number) => {
  const points = toPoints(flat);
  if (points.length < 3) return null;
  const widths = points.map((_point, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const theta = Math.atan2(after.y - before.y, after.x - before.x);
    return width * (0.3 + 0.7 * Math.abs(Math.sin(theta - Math.PI / 4)));
  });
  const smooth = widths.map((_, i) => {
    const from = Math.max(0, i - 3);
    const to = Math.min(widths.length, i + 4);
    return widths.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from);
  });
  const taper = (i: number) => Math.min(1, (Math.min(i, points.length - 1 - i) + 1) / 5);
  const left: Point[] = [];
  const right: Point[] = [];
  points.forEach((p, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const theta = Math.atan2(after.y - before.y, after.x - before.x);
    const half = (smooth[i] * taper(i)) / 2;
    left.push({ x: p.x + Math.cos(theta + Math.PI / 2) * half, y: p.y + Math.sin(theta + Math.PI / 2) * half });
    right.push({ x: p.x - Math.cos(theta + Math.PI / 2) * half, y: p.y - Math.sin(theta + Math.PI / 2) * half });
  });
  const outline = [...left, ...right.reverse()];
  return `M${outline.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} Z`;
};
