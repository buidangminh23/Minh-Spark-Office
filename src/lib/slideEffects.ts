import type {
  AnimationCategory,
  ElementAnimation,
  SlideElement,
  SlideTransition,
  TransitionCategory,
} from './slideTypes';

export type FxFrame = Record<string, string | number | undefined>;

export interface FxContext {
  slideW: number;
  slideH: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FxPlan {
  frames: FxFrame[];
  easing?: string;
  persist?: boolean;
}

export interface AnimationDef {
  type: string;
  label: string;
  category: AnimationCategory;
  group: string;
  family: string;
  duration: number;
  direction?: string;
}

export interface TransitionDef {
  type: string;
  label: string;
  category: TransitionCategory;
  family: string;
  duration: number;
  direction?: string;
}

export const FX_PROGRESS = '--ppt-p';
export const FX_ANGLE = '--ppt-a';

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const EASE_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const STEP_END = 'steps(1, end)';
const FULL_INSET = 'inset(0% 0% 0% 0%)';

const DIRECTION_VECTORS: Record<string, [number, number]> = {
  bottom: [0, 1],
  top: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  'bottom-left': [-1, 1],
  'bottom-right': [1, 1],
  'top-left': [-1, -1],
  'top-right': [1, -1],
  'from-bottom': [0, 1],
  'from-top': [0, -1],
  'from-left': [-1, 0],
  'from-right': [1, 0],
};

const round = (value: number) => Math.round(value * 100) / 100;
const px = (x: number, y: number) => `${round(x)}px ${round(y)}px`;
const pct = (x: number, y: number) => `${round(x)}% ${round(y)}%`;

function vectorOf(direction: string | undefined, fallback: string): [number, number] {
  return DIRECTION_VECTORS[direction ?? ''] ?? DIRECTION_VECTORS[fallback];
}

function offSlide(direction: string | undefined, fallback: string, c: FxContext): [number, number] {
  const [vx, vy] = vectorOf(direction, fallback);
  const dx = vx < 0 ? -(c.x + c.w) : vx > 0 ? c.slideW - c.x : 0;
  const dy = vy < 0 ? -(c.y + c.h) : vy > 0 ? c.slideH - c.y : 0;
  return [dx, dy];
}

function insetFrom(direction: string | undefined, fallback: string): string {
  const [vx, vy] = vectorOf(direction, fallback);
  if (vy > 0) return 'inset(100% 0% 0% 0%)';
  if (vy < 0) return 'inset(0% 0% 100% 0%)';
  if (vx < 0) return 'inset(0% 100% 0% 0%)';
  return 'inset(0% 0% 0% 100%)';
}

function isVertical(direction: string | undefined, fallbackVertical: boolean): boolean {
  if (direction === 'vertical' || direction === 'top' || direction === 'bottom') return true;
  if (direction === 'horizontal' || direction === 'left' || direction === 'right') return false;
  if (direction === 'from-top' || direction === 'from-bottom') return true;
  if (direction === 'from-left' || direction === 'from-right') return false;
  return fallbackVertical;
}

function maskProps(image: string, extra: FxFrame = {}): FxFrame {
  return { maskImage: image, WebkitMaskImage: image, ...extra };
}

function maskPlan(image: string, from: string, to: string, variable = FX_PROGRESS, extra: FxFrame = {}): FxFrame[] {
  const base = maskProps(image, extra);
  return [
    { ...base, [variable]: from },
    { ...base, [variable]: to },
  ];
}

const P = `var(${FX_PROGRESS})`;
const A = `var(${FX_ANGLE})`;

function blindsMask(vertical: boolean): string {
  const side = vertical ? 'to right' : 'to bottom';
  return `repeating-linear-gradient(${side}, #000 0, #000 calc(${P} * 0.125), transparent calc(${P} * 0.125), transparent 12.5%)`;
}

function randomBarsMask(vertical: boolean): string {
  const side = vertical ? 'to right' : 'to bottom';
  const bar = (period: number) =>
    `repeating-linear-gradient(${side}, #000 0, #000 calc(${P} * ${period / 100}), transparent calc(${P} * ${period / 100}), transparent ${period}%)`;
  return [bar(7), bar(11), bar(17)].join(', ');
}

function dotsMask(): string {
  const dot = `radial-gradient(circle at center, #000 ${P}, transparent ${P})`;
  return `${dot}, ${dot}`;
}

function dotsExtra(size: number): FxFrame {
  const half = size / 2;
  const value = {
    size: `${size}px ${size}px`,
    position: `0px 0px, ${half}px ${half}px`,
  };
  return {
    maskSize: value.size,
    WebkitMaskSize: value.size,
    maskPosition: value.position,
    WebkitMaskPosition: value.position,
  };
}

function checkerMask(): { image: string; extra: FxFrame } {
  const tile = `linear-gradient(to right, #000 ${P}, transparent ${P})`;
  const rows = ['0%', '33.3333%', '66.6667%', '100%'];
  const position = rows.map((row, index) => `${index % 2 === 0 ? '0%' : '7.142857%'} ${row}`).join(', ');
  const size = '12.5% 25%';
  return {
    image: rows.map(() => tile).join(', '),
    extra: {
      maskSize: size,
      WebkitMaskSize: size,
      maskPosition: position,
      WebkitMaskPosition: position,
      maskRepeat: 'repeat-x',
      WebkitMaskRepeat: 'repeat-x',
    },
  };
}

function wheelMask(spokes: number): string {
  if (spokes <= 1) return `conic-gradient(#000 ${A}, transparent ${A})`;
  const slice = 360 / spokes;
  return `repeating-conic-gradient(#000 0deg, #000 ${A}, transparent ${A}, transparent ${slice}deg)`;
}

const WEDGE_MASK = `conic-gradient(from calc(0deg - ${A}), #000 calc(${A} * 2), transparent calc(${A} * 2))`;

function plusPolygon(half: number): string {
  const a = 50 - half;
  const b = 50 + half;
  const points = [
    [a, 0], [b, 0], [b, a], [100, a], [100, b], [b, b],
    [b, 100], [a, 100], [a, b], [0, b], [0, a], [a, a],
  ];
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

function stripsPolygon(direction: string | undefined, open: boolean): string {
  const [vx, vy] = vectorOf(direction, 'bottom-left');
  const cx = vx > 0 ? 100 : 0;
  const cy = vy > 0 ? 100 : 0;
  if (!open) return `polygon(${cx}% ${cy}%, ${cx}% ${cy}%, ${cx}% ${cy}%)`;
  const farX = cx === 0 ? 200 : -100;
  const farY = cy === 0 ? 200 : -100;
  return `polygon(${cx}% ${cy}%, ${farX}% ${cy}%, ${cx}% ${farY}%)`;
}

type EntranceBuilder = (direction: string | undefined, c: FxContext) => FxPlan;

const ENTRANCE: Record<string, EntranceBuilder> = {
  appear: () => ({ frames: [{ opacity: 0 }, { opacity: 1 }], easing: STEP_END }),
  fade: () => ({ frames: [{ opacity: 0 }, { opacity: 1 }], easing: 'ease-in-out' }),
  fly: (d, c) => {
    const [dx, dy] = offSlide(d, 'bottom', c);
    return { frames: [{ translate: px(dx, dy) }, { translate: px(0, 0) }], easing: EASE_OUT };
  },
  peek: (d, c) => {
    const [vx, vy] = vectorOf(d, 'bottom');
    return {
      frames: [
        { translate: px(vx * c.w, vy * c.h), clipPath: insetFrom(vy > 0 ? 'top' : vy < 0 ? 'bottom' : vx > 0 ? 'left' : 'right', 'top') },
        { translate: px(0, 0), clipPath: FULL_INSET },
      ],
      easing: 'ease-out',
    };
  },
  wipe: (d) => ({ frames: [{ clipPath: insetFrom(d, 'bottom') }, { clipPath: FULL_INSET }], easing: 'linear' }),
  split: (d) => ({
    frames: [
      { clipPath: isVertical(d, true) ? 'inset(0% 50% 0% 50%)' : 'inset(50% 0% 50% 0%)' },
      { clipPath: FULL_INSET },
    ],
    easing: 'ease-in-out',
  }),
  box: () => ({ frames: [{ clipPath: 'inset(50% 50% 50% 50%)' }, { clipPath: FULL_INSET }], easing: 'ease-in-out' }),
  circle: () => ({
    frames: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }],
    easing: 'ease-in-out',
  }),
  diamond: () => ({
    frames: [
      { clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' },
      { clipPath: 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)' },
    ],
    easing: 'ease-in-out',
  }),
  plus: () => ({ frames: [{ clipPath: plusPolygon(0) }, { clipPath: plusPolygon(50) }], easing: 'ease-in-out' }),
  strips: (d) => ({
    frames: [{ clipPath: stripsPolygon(d, false) }, { clipPath: stripsPolygon(d, true) }],
    easing: 'linear',
  }),
  wedge: () => ({ frames: maskPlan(WEDGE_MASK, '0deg', '180deg', FX_ANGLE), easing: 'linear' }),
  wheel: () => ({ frames: maskPlan(wheelMask(1), '0deg', '360deg', FX_ANGLE), easing: 'linear' }),
  blinds: (d) => ({ frames: maskPlan(blindsMask(isVertical(d, false)), '0%', '100%'), easing: 'linear' }),
  'random-bars': (d) => ({ frames: maskPlan(randomBarsMask(isVertical(d, false)), '0%', '100%'), easing: 'linear' }),
  checkerboard: () => {
    const { image, extra } = checkerMask();
    return { frames: maskPlan(image, '0%', '100%', FX_PROGRESS, extra), easing: 'linear' };
  },
  dissolve: () => ({ frames: maskPlan(dotsMask(), '0%', '100%', FX_PROGRESS, dotsExtra(12)), easing: 'linear' }),
  expand: () => ({ frames: [{ opacity: 0, scale: '0.7 1' }, { opacity: 1, scale: '1 1' }], easing: EASE_OUT }),
  swivel: () => ({
    frames: [{ opacity: 0, rotate: 'y -360deg' }, { opacity: 1, rotate: 'y 0deg' }],
    easing: 'ease-out',
  }),
  zoom: () => ({ frames: [{ opacity: 0, scale: '0 0' }, { opacity: 1, scale: '1 1' }], easing: EASE_OUT }),
  'basic-zoom': (d) => ({
    frames: [{ scale: d === 'out' ? '3 3' : '0 0', opacity: d === 'out' ? 0 : 1 }, { scale: '1 1', opacity: 1 }],
    easing: 'ease-out',
  }),
  'center-revolve': () => ({
    frames: [
      { opacity: 0, rotate: '-360deg', transformOrigin: '50% 160%' },
      { opacity: 1, rotate: '0deg', transformOrigin: '50% 160%' },
    ],
    easing: EASE_IN_OUT,
  }),
  compress: () => ({ frames: [{ opacity: 0, scale: '1.6 1' }, { opacity: 1, scale: '1 1' }], easing: EASE_OUT }),
  float: (d, c) => {
    const [, vy] = vectorOf(d, 'bottom');
    const distance = Math.max(40, c.slideH * 0.12) * (vy < 0 ? -1 : 1);
    return { frames: [{ opacity: 0, translate: px(0, distance) }, { opacity: 1, translate: px(0, 0) }], easing: EASE_OUT };
  },
  'grow-turn': () => ({
    frames: [{ opacity: 0, scale: '0 0', rotate: '-90deg' }, { opacity: 1, scale: '1 1', rotate: '0deg' }],
    easing: EASE_OUT,
  }),
  'rise-up': (_d, c) => ({
    frames: [
      { opacity: 0, translate: px(0, c.slideH - c.y) },
      { opacity: 1, translate: px(0, -14), offset: 0.75 },
      { opacity: 1, translate: px(0, 0) },
    ],
    easing: 'ease-out',
  }),
  spinner: () => ({
    frames: [{ opacity: 0, scale: '0 0', rotate: '-360deg' }, { opacity: 1, scale: '1 1', rotate: '0deg' }],
    easing: EASE_OUT,
  }),
  stretch: (d) => {
    const vertical = isVertical(d, false);
    const origin = d === 'left' ? '0% 50%' : d === 'right' ? '100% 50%' : d === 'top' ? '50% 0%' : d === 'bottom' ? '50% 100%' : '50% 50%';
    return {
      frames: [
        { scale: vertical ? '1 0' : '0 1', transformOrigin: origin },
        { scale: '1 1', transformOrigin: origin },
      ],
      easing: EASE_OUT,
    };
  },
  'basic-swivel': (d) => {
    const axis = isVertical(d, false) ? 'x' : 'y';
    return { frames: [{ rotate: `${axis} 90deg` }, { rotate: `${axis} 0deg` }], easing: 'ease-out' };
  },
  boomerang: (_d, c) => ({
    frames: [
      { opacity: 0, translate: px(c.w, -c.h), rotate: '-180deg', scale: '0.4 0.4' },
      { opacity: 1, translate: px(-c.w * 0.2, 0), rotate: '20deg', scale: '1 1', offset: 0.7 },
      { opacity: 1, translate: px(0, 0), rotate: '0deg', scale: '1 1' },
    ],
    easing: 'ease-in-out',
  }),
  bounce: (_d, c) => {
    const top = -(c.y + c.h);
    return {
      frames: [
        { translate: px(0, top), easing: 'ease-in' },
        { translate: px(0, 0), offset: 0.4, easing: 'ease-out' },
        { translate: px(0, top * 0.22), offset: 0.55, easing: 'ease-in' },
        { translate: px(0, 0), offset: 0.7, easing: 'ease-out' },
        { translate: px(0, top * 0.08), offset: 0.82, easing: 'ease-in' },
        { translate: px(0, 0), offset: 0.92, easing: 'ease-out' },
        { translate: px(0, top * 0.02), offset: 0.96 },
        { translate: px(0, 0) },
      ],
    };
  },
  credits: (_d, c) => ({
    frames: [{ translate: px(0, c.slideH - c.y) }, { translate: px(0, 0) }],
    easing: 'linear',
  }),
  'curve-up': (_d, c) => ({
    frames: [
      { opacity: 0, translate: px(c.w * 0.9, c.h * 1.8), scale: '0.4 0.4' },
      { opacity: 1, translate: px(c.w * 0.5, -c.h * 0.2), scale: '0.8 0.8', offset: 0.6 },
      { opacity: 1, translate: px(0, 0), scale: '1 1' },
    ],
    easing: 'ease-out',
  }),
  drop: (_d, c) => ({
    frames: [
      { translate: px(0, -(c.y + c.h)), scale: '1 1', easing: 'ease-in' },
      { translate: px(0, 0), scale: '1.12 0.82', offset: 0.7, transformOrigin: '50% 100%' },
      { translate: px(0, -10), scale: '0.96 1.06', offset: 0.85, transformOrigin: '50% 100%' },
      { translate: px(0, 0), scale: '1 1', transformOrigin: '50% 100%' },
    ],
  }),
  flip: () => ({
    frames: [
      { opacity: 0, rotate: 'x -180deg', scale: '0.5 0.5' },
      { opacity: 1, rotate: 'x 0deg', scale: '1 1' },
    ],
    easing: EASE_OUT,
  }),
  'float-spin': (_d, c) => ({
    frames: [
      { opacity: 0, translate: px(-c.w * 0.5, -c.h), rotate: '-25deg', scale: '0.7 0.7' },
      { opacity: 1, translate: px(0, 0), rotate: '0deg', scale: '1 1' },
    ],
    easing: EASE_OUT,
  }),
  pinwheel: () => ({
    frames: [{ opacity: 0, scale: '0 0', rotate: '-720deg' }, { opacity: 1, scale: '1 1', rotate: '0deg' }],
    easing: 'ease-out',
  }),
  spiral: (_d, c) => {
    const radius = Math.min(c.slideW, c.slideH) * 0.45;
    const frames: FxFrame[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = radius * (1 - t);
      const angle = t * Math.PI * 4;
      frames.push({
        translate: px(Math.cos(angle) * r, Math.sin(angle) * r),
        scale: `${round(0.1 + 0.9 * t)} ${round(0.1 + 0.9 * t)}`,
        opacity: Math.min(1, t * 4),
      });
    }
    return { frames, easing: 'linear' };
  },
  whip: (_d, c) => ({
    frames: [
      { opacity: 0, translate: px(-c.w, 0), rotate: '-35deg', scale: '0.6 1' },
      { opacity: 1, translate: px(c.w * 0.05, 0), rotate: '8deg', scale: '1.05 1', offset: 0.7 },
      { opacity: 1, translate: px(0, 0), rotate: '0deg', scale: '1 1' },
    ],
    easing: 'ease-out',
  }),
};

type EmphasisBuilder = (direction: string | undefined, c: FxContext) => FxPlan;

const pulseFrames = (peak: FxFrame, rest: FxFrame = {}): FxFrame[] => [rest, { ...peak, offset: 0.5 }, rest];
const NO_FILTER = 'hue-rotate(0deg) saturate(1) brightness(1) grayscale(0)';
const filterTo = (value: string): FxPlan => ({
  frames: [{ filter: NO_FILTER }, { filter: value }],
  easing: 'ease-in-out',
  persist: true,
});

const boldShadow = (spread: number) => `${spread}px 0px 0px currentColor, ${-spread}px 0px 0px currentColor`;

const EMPHASIS: Record<string, EmphasisBuilder> = {
  'fill-color': () => filterTo('hue-rotate(140deg) saturate(1.2) brightness(1) grayscale(0)'),
  'font-color': () => filterTo('hue-rotate(200deg) saturate(1.5) brightness(1) grayscale(0)'),
  'line-color': () => ({
    frames: [
      { outlineColor: 'rgba(220, 38, 38, 0)', outlineWidth: '0px', outlineStyle: 'solid' },
      { outlineColor: 'rgba(220, 38, 38, 1)', outlineWidth: '3px', outlineStyle: 'solid' },
    ],
    persist: true,
  }),
  'brush-color': () => filterTo('hue-rotate(90deg) saturate(1.3) brightness(1) grayscale(0)'),
  'object-color': () => filterTo('hue-rotate(260deg) saturate(1.2) brightness(1) grayscale(0)'),
  'complementary-color': () => filterTo('hue-rotate(180deg) saturate(1) brightness(1) grayscale(0)'),
  'complementary-color-2': () => filterTo('hue-rotate(120deg) saturate(1) brightness(1) grayscale(0)'),
  'contrasting-color': () => filterTo('hue-rotate(60deg) saturate(1.8) brightness(1.05) grayscale(0)'),
  darken: () => filterTo('hue-rotate(0deg) saturate(1) brightness(0.6) grayscale(0)'),
  lighten: () => filterTo('hue-rotate(0deg) saturate(1) brightness(1.45) grayscale(0)'),
  desaturate: () => filterTo('hue-rotate(0deg) saturate(1) brightness(1) grayscale(1)'),
  transparency: () => ({ frames: [{ opacity: 1 }, { opacity: 0.45 }], easing: 'ease-in-out', persist: true }),
  'grow-shrink': () => ({ frames: [{ scale: '1 1' }, { scale: '1.5 1.5' }], easing: EASE_IN_OUT, persist: true }),
  spin: (d) => ({
    frames: [{ rotate: '0deg' }, { rotate: d === 'left' ? '-360deg' : '360deg' }],
    easing: EASE_IN_OUT,
  }),
  pulse: () => ({ frames: pulseFrames({ scale: '1.1 1.1', opacity: 0.75 }, { scale: '1 1', opacity: 1 }), easing: 'ease-in-out' }),
  'color-pulse': () => ({
    frames: pulseFrames(
      { filter: 'hue-rotate(160deg) saturate(1.4) brightness(1.15) grayscale(0)' },
      { filter: NO_FILTER }
    ),
    easing: 'ease-in-out',
  }),
  'grow-with-color': () => ({
    frames: pulseFrames(
      { scale: '1.35 1.35', filter: 'hue-rotate(140deg) saturate(1.3) brightness(1) grayscale(0)' },
      { scale: '1 1', filter: NO_FILTER }
    ),
    easing: 'ease-in-out',
  }),
  shimmer: () => ({
    frames: [
      { scale: '1 1', filter: NO_FILTER },
      { scale: '1.12 0.94', filter: 'hue-rotate(0deg) saturate(1) brightness(1.35) grayscale(0)', offset: 0.25 },
      { scale: '0.94 1.08', filter: NO_FILTER, offset: 0.5 },
      { scale: '1.08 0.97', filter: 'hue-rotate(0deg) saturate(1) brightness(1.25) grayscale(0)', offset: 0.75 },
      { scale: '1 1', filter: NO_FILTER },
    ],
    easing: 'ease-in-out',
  }),
  teeter: () => ({
    frames: [
      { rotate: '0deg' },
      { rotate: '-6deg', offset: 0.2 },
      { rotate: '6deg', offset: 0.4 },
      { rotate: '-4deg', offset: 0.6 },
      { rotate: '4deg', offset: 0.8 },
      { rotate: '0deg' },
    ],
    easing: 'ease-in-out',
  }),
  blink: () => ({
    frames: [
      { opacity: 1, easing: STEP_END },
      { opacity: 0, offset: 0.25, easing: STEP_END },
      { opacity: 1, offset: 0.5, easing: STEP_END },
      { opacity: 0, offset: 0.75, easing: STEP_END },
      { opacity: 1 },
    ],
  }),
  'bold-flash': () => ({
    frames: pulseFrames({ textShadow: boldShadow(0.9), scale: '1.04 1.04' }, { textShadow: boldShadow(0), scale: '1 1' }),
    easing: 'ease-in-out',
  }),
  'bold-reveal': () => ({
    frames: [{ textShadow: boldShadow(0) }, { textShadow: boldShadow(0.7) }],
    easing: 'ease-in-out',
    persist: true,
  }),
  underline: () => ({
    frames: [
      { textDecorationLine: 'underline', textDecorationColor: 'transparent', textDecorationThickness: '2px' },
      { textDecorationLine: 'underline', textDecorationColor: 'currentColor', textDecorationThickness: '2px' },
    ],
    persist: true,
  }),
  wave: (_d, c) => {
    const lift = Math.max(8, c.h * 0.18);
    return {
      frames: [
        { translate: px(0, 0), rotate: '0deg' },
        { translate: px(0, -lift), rotate: '-4deg', offset: 0.25 },
        { translate: px(0, lift * 0.6), rotate: '4deg', offset: 0.5 },
        { translate: px(0, -lift * 0.4), rotate: '-2deg', offset: 0.75 },
        { translate: px(0, 0), rotate: '0deg' },
      ],
      easing: 'ease-in-out',
    };
  },
};

type Point = [number, number];
type PathFn = (t: number) => Point;

function polyline(points: Point[]): PathFn {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(length);
    total += length;
  }
  return (t) => {
    if (total === 0) return points[0];
    let remaining = Math.min(1, Math.max(0, t)) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const ratio = lengths[i] === 0 ? 0 : Math.min(1, remaining / lengths[i]);
        return [
          points[i][0] + (points[i + 1][0] - points[i][0]) * ratio,
          points[i][1] + (points[i + 1][1] - points[i][1]) * ratio,
        ];
      }
      remaining -= lengths[i];
    }
    return points[points.length - 1];
  };
}

function closed(points: Point[]): PathFn {
  const origin = points[0];
  const shifted = points.map(([x, y]) => [x - origin[0], y - origin[1]] as Point);
  return polyline([...shifted, shifted[0]]);
}

function regularPolygon(sides: number, radius = 0.5): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as Point;
  });
}

function starPolygon(points: number, inner = 0.22, outer = 0.5): Point[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    return [Math.cos(angle) * r, Math.sin(angle) * r] as Point;
  });
}

function fromStart(fn: PathFn): PathFn {
  const [sx, sy] = fn(0);
  return (t) => {
    const [x, y] = fn(t);
    return [x - sx, y - sy];
  };
}

const TAU = Math.PI * 2;
const ellipse = (rx: number, ry: number, turns = 1): PathFn =>
  fromStart((t) => [Math.sin(t * TAU * turns) * rx, -Math.cos(t * TAU * turns) * ry]);

const MOTION_PATHS: Record<string, PathFn> = {
  'path-line-down': polyline([[0, 0], [0, 1]]),
  'path-line-up': polyline([[0, 0], [0, -1]]),
  'path-line-left': polyline([[0, 0], [-1, 0]]),
  'path-line-right': polyline([[0, 0], [1, 0]]),
  'path-diagonal-down-right': polyline([[0, 0], [1, 1]]),
  'path-diagonal-up-right': polyline([[0, 0], [1, -1]]),
  'path-arc': (t) => [t * 1.2, -Math.sin(t * Math.PI) * 0.6],
  'path-arc-down': (t) => [t * 1.2, Math.sin(t * Math.PI) * 0.6],
  'path-arc-left': (t) => [-Math.sin(t * Math.PI) * 0.6, t * 1.2],
  'path-arc-right': (t) => [Math.sin(t * Math.PI) * 0.6, t * 1.2],
  'path-turn': (t) => [Math.sin((t * Math.PI) / 2) * 0.9, (1 - Math.cos((t * Math.PI) / 2)) * 0.9],
  'path-turn-down': (t) => [(1 - Math.cos((t * Math.PI) / 2)) * 0.9, Math.sin((t * Math.PI) / 2) * 0.9],
  'path-turn-up': (t) => [(1 - Math.cos((t * Math.PI) / 2)) * 0.9, -Math.sin((t * Math.PI) / 2) * 0.9],
  'path-turn-up-right': (t) => [Math.sin((t * Math.PI) / 2) * 0.9, -(1 - Math.cos((t * Math.PI) / 2)) * 0.9],
  'path-bounce-left': (t) => [-t * 1.6, -Math.abs(Math.sin(t * Math.PI * 3)) * 0.7 * (1 - t)],
  'path-bounce-right': (t) => [t * 1.6, -Math.abs(Math.sin(t * Math.PI * 3)) * 0.7 * (1 - t)],
  'path-curvy-left': (t) => [-t * 1.6, Math.sin(t * TAU * 1.5) * 0.3],
  'path-curvy-right': (t) => [t * 1.6, Math.sin(t * TAU * 1.5) * 0.3],
  'path-decaying-wave': (t) => [t * 1.8, Math.sin(t * TAU * 3) * 0.5 * (1 - t)],
  'path-sine-wave': (t) => [t * 1.8, -Math.sin(t * TAU * 2) * 0.35],
  'path-wave': (t) => [t * 1.8, -Math.sin(t * TAU) * 0.4],
  'path-s-curve-1': (t) => [Math.sin(t * TAU) * 0.4, t * 1.2],
  'path-s-curve-2': (t) => [t * 1.4, Math.sin(t * TAU) * 0.4],
  'path-zigzag': polyline([[0, 0], [0.3, -0.4], [0.6, 0], [0.9, -0.4], [1.2, 0], [1.5, -0.4], [1.8, 0]]),
  'path-stairs-down': polyline([[0, 0], [0.3, 0], [0.3, 0.3], [0.6, 0.3], [0.6, 0.6], [0.9, 0.6], [0.9, 0.9], [1.2, 0.9]]),
  'path-heartbeat': polyline([[0, 0], [0.4, 0], [0.5, -0.5], [0.65, 0.5], [0.8, -0.25], [0.9, 0], [1.6, 0]]),
  'path-funnel': (t) => [Math.sin(t * TAU * 3) * 0.7 * (1 - t), t * 1.2],
  'path-spring': (t) => [Math.sin(t * TAU * 4) * 0.3, t * 1.2 - (1 - Math.cos(t * TAU * 4)) * 0.08],
  'path-spiral-left': fromStart((t) => [-Math.sin(t * TAU * 2.5) * 0.7 * (1 - t), -Math.cos(t * TAU * 2.5) * 0.7 * (1 - t)]),
  'path-spiral-right': fromStart((t) => [Math.sin(t * TAU * 2.5) * 0.7 * (1 - t), -Math.cos(t * TAU * 2.5) * 0.7 * (1 - t)]),
  'path-circle': ellipse(0.5, 0.5),
  'path-oval': ellipse(0.8, 0.4),
  'path-square': closed([[0, 0], [1, 0], [1, 1], [0, 1]]),
  'path-diamond': closed([[0, -0.5], [0.6, 0], [0, 0.5], [-0.6, 0]]),
  'path-triangle': closed(regularPolygon(3, 0.6)),
  'path-right-triangle': closed([[0, 0], [0, 1], [1, 1]]),
  'path-pentagon': closed(regularPolygon(5)),
  'path-hexagon': closed(regularPolygon(6)),
  'path-octagon': closed(regularPolygon(8)),
  'path-parallelogram': closed([[0.3, 0], [1.3, 0], [1, 0.7], [0, 0.7]]),
  'path-trapezoid': closed([[0.3, 0], [0.9, 0], [1.2, 0.7], [0, 0.7]]),
  'path-star-4': closed(starPolygon(4)),
  'path-star-5': closed(starPolygon(5)),
  'path-star-6': closed(starPolygon(6, 0.28)),
  'path-star-8': closed(starPolygon(8, 0.32)),
  'path-pointy-star': closed(starPolygon(4, 0.1, 0.6)),
  'path-heart': fromStart((t) => {
    const a = t * TAU;
    return [
      (16 * Math.sin(a) ** 3) / 30,
      -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 30,
    ];
  }),
  'path-crescent-moon': fromStart((t) => {
    const outer = t < 0.5;
    const progress = outer ? t / 0.5 : (t - 0.5) / 0.5;
    const angle = outer ? -Math.PI / 2 + progress * Math.PI : Math.PI / 2 - progress * Math.PI;
    return [Math.cos(angle) * (outer ? 0.5 : 0.22), Math.sin(angle) * 0.5];
  }),
  'path-teardrop': fromStart((t) => {
    const a = t * TAU;
    return [Math.sin(a) * 0.4 * Math.sin(a / 2), -Math.cos(a) * 0.6];
  }),
  'path-football': fromStart((t) => {
    const a = t * TAU;
    return [Math.sin(a) * 0.8, -Math.sin(a) * Math.cos(a) * 0.5 - Math.cos(a) * 0.2];
  }),
  'path-loop': fromStart((t) => [Math.sin(t * TAU) * 0.8, Math.sin(t * TAU * 2) * 0.4]),
  'path-vertical-figure-8': fromStart((t) => [Math.sin(t * TAU * 2) * 0.4, Math.sin(t * TAU) * 0.8]),
  'path-figure-8-four': fromStart((t) => [Math.sin(t * TAU * 2) * 0.7, Math.sin(t * TAU * 4) * 0.35]),
  'path-loop-de-loop': (t) => [t * 1.8 - Math.sin(t * TAU * 2) * 0.3, -(1 - Math.cos(t * TAU * 2)) * 0.3],
  'path-bean': fromStart((t) => {
    const a = t * TAU;
    const r = 0.5 + 0.18 * Math.cos(a * 2) + 0.1 * Math.sin(a);
    return [Math.sin(a) * r * 1.2, -Math.cos(a) * r * 0.8];
  }),
  'path-peanut': fromStart((t) => {
    const a = t * TAU;
    const r = 0.45 + 0.2 * Math.cos(a * 2);
    return [Math.sin(a) * r * 0.9, -Math.cos(a) * r * 1.3];
  }),
  'path-curved-square': fromStart((t) => {
    const a = t * TAU;
    const r = 0.5 / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) ** 0.5;
    return [Math.sin(a) * r, -Math.cos(a) * r];
  }),
  'path-curved-x': fromStart((t) => {
    const a = t * TAU;
    const r = 0.25 + 0.4 * Math.abs(Math.sin(a * 2));
    return [Math.sin(a + Math.PI / 4) * r, -Math.cos(a + Math.PI / 4) * r];
  }),
  'path-plus': closed([
    [-0.15, -0.5], [0.15, -0.5], [0.15, -0.15], [0.5, -0.15], [0.5, 0.15], [0.15, 0.15],
    [0.15, 0.5], [-0.15, 0.5], [-0.15, 0.15], [-0.5, 0.15], [-0.5, -0.15], [-0.15, -0.15],
  ]),
  'path-neutron': fromStart((t) => {
    const a = t * TAU;
    return [Math.sin(a * 3) * 0.6 * Math.cos(a), -Math.sin(a * 3) * 0.6 * Math.sin(a)];
  }),
  'path-buzz-saw': fromStart((t) => {
    const a = t * TAU;
    const r = 0.45 + 0.08 * (((a * 8) / TAU) % 1);
    return [Math.sin(a) * r, -Math.cos(a) * r];
  }),
  'path-swoosh': (t) => [t * 1.8, -Math.sin(t * Math.PI) * 0.5 + Math.sin(t * TAU) * 0.2],
  'path-inverted-square': closed([[0, 0], [1, 0], [0.75, 0.5], [1, 1], [0, 1], [0.25, 0.5]]),
  'path-inverted-triangle': closed([[0, 0], [1.2, 0], [0.6, 1]]),
};

const MOTION_SAMPLES = 48;

function motionPlan(type: string, anim: Pick<ElementAnimation, 'motionPathCoords'>, c: FxContext): FxPlan | null {
  if (type === 'path-custom') {
    const dx = ((anim.motionPathCoords?.dx ?? 20) / 100) * c.slideW;
    const dy = ((anim.motionPathCoords?.dy ?? 0) / 100) * c.slideH;
    return { frames: [{ translate: px(0, 0) }, { translate: px(dx, dy) }], easing: EASE_IN_OUT, persist: true };
  }
  const path = MOTION_PATHS[type];
  if (!path) return null;
  const unit = c.slideH * 0.3;
  const frames: FxFrame[] = [];
  for (let i = 0; i <= MOTION_SAMPLES; i++) {
    const [x, y] = path(i / MOTION_SAMPLES);
    frames.push({ translate: px(x * unit, y * unit) });
  }
  return { frames, easing: 'linear', persist: true };
}

interface AnimationSeed {
  base: string;
  entrance: string;
  exit: string;
  group: string;
  family: string;
  duration?: number;
  direction?: string;
  entranceType?: string;
  exitType?: string;
}

const ENTRANCE_SEEDS: AnimationSeed[] = [
  { base: 'appear', entrance: 'Xuất hiện', exit: 'Biến mất', group: 'basic', family: 'appear', duration: 0.1, entranceType: 'appear', exitType: 'disappear' },
  { base: 'blinds', entrance: 'Mành che', exit: 'Mành che', group: 'basic', family: 'blinds', direction: 'horizontal' },
  { base: 'box', entrance: 'Hộp', exit: 'Hộp', group: 'basic', family: 'box' },
  { base: 'checkerboard', entrance: 'Bàn cờ', exit: 'Bàn cờ', group: 'basic', family: 'checker' },
  { base: 'circle', entrance: 'Hình tròn', exit: 'Hình tròn', group: 'basic', family: 'circle' },
  { base: 'diamond', entrance: 'Hình thoi', exit: 'Hình thoi', group: 'basic', family: 'diamond' },
  { base: 'dissolve', entrance: 'Tan dần vào', exit: 'Tan dần ra', group: 'basic', family: 'dissolve' },
  { base: 'fly', entrance: 'Bay vào', exit: 'Bay ra', group: 'basic', family: 'fly', direction: 'bottom' },
  { base: 'peek', entrance: 'Ló vào', exit: 'Ló ra', group: 'basic', family: 'peek', direction: 'bottom' },
  { base: 'plus', entrance: 'Dấu cộng', exit: 'Dấu cộng', group: 'basic', family: 'plus' },
  { base: 'random-bars', entrance: 'Thanh ngẫu nhiên', exit: 'Thanh ngẫu nhiên', group: 'basic', family: 'bars', direction: 'horizontal' },
  { base: 'split', entrance: 'Tách', exit: 'Tách', group: 'basic', family: 'split', direction: 'vertical' },
  { base: 'strips', entrance: 'Dải chéo', exit: 'Dải chéo', group: 'basic', family: 'strips', direction: 'bottom-left' },
  { base: 'wedge', entrance: 'Hình nêm', exit: 'Hình nêm', group: 'basic', family: 'wedge' },
  { base: 'wheel', entrance: 'Bánh xe', exit: 'Bánh xe', group: 'basic', family: 'wheel', duration: 1 },
  { base: 'wipe', entrance: 'Lau', exit: 'Lau', group: 'basic', family: 'wipe', direction: 'bottom' },
  { base: 'expand', entrance: 'Mở rộng', exit: 'Co lại', group: 'subtle', family: 'expand' },
  { base: 'fade', entrance: 'Mờ dần', exit: 'Mờ dần', group: 'subtle', family: 'fade' },
  { base: 'swivel', entrance: 'Xoay đảo', exit: 'Xoay đảo', group: 'subtle', family: 'swivel', duration: 1 },
  { base: 'zoom', entrance: 'Thu phóng', exit: 'Thu phóng', group: 'subtle', family: 'zoom' },
  { base: 'basic-zoom', entrance: 'Thu phóng cơ bản', exit: 'Thu phóng cơ bản', group: 'moderate', family: 'zoom' },
  { base: 'center-revolve', entrance: 'Quay quanh tâm', exit: 'Quay quanh tâm', group: 'moderate', family: 'revolve', duration: 1 },
  { base: 'compress', entrance: 'Nén', exit: 'Thu gọn', group: 'moderate', family: 'compress' },
  { base: 'float', entrance: 'Nổi lên', exit: 'Nổi ra', group: 'moderate', family: 'float', duration: 0.8, direction: 'bottom' },
  { base: 'grow-turn', entrance: 'Lớn và xoay', exit: 'Thu nhỏ và xoay', group: 'moderate', family: 'grow', duration: 0.8, entranceType: 'grow-turn', exitType: 'shrink-turn' },
  { base: 'rise-up', entrance: 'Trồi lên', exit: 'Chìm xuống', group: 'moderate', family: 'rise', duration: 0.8 },
  { base: 'spinner', entrance: 'Con quay', exit: 'Con quay', group: 'moderate', family: 'spin', duration: 0.8 },
  { base: 'stretch', entrance: 'Kéo giãn', exit: 'Co giãn', group: 'moderate', family: 'stretch', direction: 'horizontal' },
  { base: 'basic-swivel', entrance: 'Xoay cơ bản', exit: 'Xoay cơ bản', group: 'exciting', family: 'swivel', direction: 'horizontal' },
  { base: 'boomerang', entrance: 'Boomerang', exit: 'Boomerang', group: 'exciting', family: 'boomerang', duration: 1 },
  { base: 'bounce', entrance: 'Nảy bật', exit: 'Nảy ra', group: 'exciting', family: 'bounce', duration: 1.4 },
  { base: 'credits', entrance: 'Chạy chữ cuối phim', exit: 'Chạy chữ cuối phim', group: 'exciting', family: 'credits', duration: 3 },
  { base: 'curve-up', entrance: 'Cong lên', exit: 'Cong xuống', group: 'exciting', family: 'curve', duration: 1 },
  { base: 'drop', entrance: 'Rơi xuống', exit: 'Rơi ra', group: 'exciting', family: 'drop', duration: 1 },
  { base: 'flip', entrance: 'Lật', exit: 'Lật', group: 'exciting', family: 'flip', duration: 0.8 },
  { base: 'float-spin', entrance: 'Trôi vào', exit: 'Trôi ra', group: 'exciting', family: 'float', duration: 1 },
  { base: 'pinwheel', entrance: 'Chong chóng', exit: 'Chong chóng', group: 'exciting', family: 'pinwheel', duration: 1.2 },
  { base: 'spiral', entrance: 'Xoắn ốc vào', exit: 'Xoắn ốc ra', group: 'exciting', family: 'spiral', duration: 1.2 },
  { base: 'whip', entrance: 'Quất roi', exit: 'Quất roi', group: 'exciting', family: 'whip', duration: 0.8 },
];

const EMPHASIS_SEEDS: [string, string, string, string, number?][] = [
  ['fill-color', 'Màu tô', 'basic', 'color'],
  ['font-color', 'Màu chữ', 'basic', 'color'],
  ['grow-shrink', 'Phóng to/Thu nhỏ', 'basic', 'grow', 0.8],
  ['line-color', 'Màu đường viền', 'basic', 'color'],
  ['spin', 'Xoay tròn', 'basic', 'spin', 1],
  ['transparency', 'Trong suốt', 'basic', 'fade'],
  ['bold-flash', 'Chớp đậm', 'subtle', 'bold'],
  ['brush-color', 'Màu cọ vẽ', 'subtle', 'color'],
  ['complementary-color', 'Màu bổ túc', 'subtle', 'color'],
  ['complementary-color-2', 'Màu bổ túc 2', 'subtle', 'color'],
  ['contrasting-color', 'Màu tương phản', 'subtle', 'color'],
  ['darken', 'Làm tối', 'subtle', 'darken'],
  ['desaturate', 'Giảm bão hoà', 'subtle', 'darken'],
  ['lighten', 'Làm sáng', 'subtle', 'lighten'],
  ['object-color', 'Màu đối tượng', 'subtle', 'color'],
  ['pulse', 'Nhịp đập', 'subtle', 'pulse'],
  ['underline', 'Gạch chân', 'subtle', 'underline'],
  ['color-pulse', 'Nhịp màu', 'moderate', 'pulse'],
  ['grow-with-color', 'Lớn kèm đổi màu', 'moderate', 'grow', 0.8],
  ['shimmer', 'Lấp lánh', 'moderate', 'shimmer', 0.8],
  ['teeter', 'Bập bênh', 'moderate', 'teeter', 0.8],
  ['blink', 'Nháy', 'exciting', 'blink', 0.8],
  ['bold-reveal', 'Hiện đậm', 'exciting', 'bold'],
  ['wave', 'Lượn sóng', 'exciting', 'wave', 0.8],
];

const MOTION_SEEDS: [string, string, string, string][] = [
  ['path-line-down', 'Thẳng xuống', 'lines', 'line-down'],
  ['path-line-up', 'Thẳng lên', 'lines', 'line-up'],
  ['path-line-left', 'Sang trái', 'lines', 'line-left'],
  ['path-line-right', 'Sang phải', 'lines', 'line-right'],
  ['path-diagonal-down-right', 'Chéo xuống phải', 'lines', 'diagonal-down'],
  ['path-diagonal-up-right', 'Chéo lên phải', 'lines', 'diagonal-up'],
  ['path-arc', 'Cung lên', 'lines', 'arc'],
  ['path-arc-down', 'Cung xuống', 'lines', 'arc'],
  ['path-arc-left', 'Cung trái', 'lines', 'arc'],
  ['path-arc-right', 'Cung phải', 'lines', 'arc'],
  ['path-turn', 'Rẽ xuống phải', 'lines', 'turn'],
  ['path-turn-down', 'Rẽ xuống', 'lines', 'turn'],
  ['path-turn-up', 'Rẽ lên', 'lines', 'turn'],
  ['path-turn-up-right', 'Rẽ lên phải', 'lines', 'turn'],
  ['path-bounce-left', 'Nảy sang trái', 'lines', 'bounce'],
  ['path-bounce-right', 'Nảy sang phải', 'lines', 'bounce'],
  ['path-curvy-left', 'Uốn lượn trái', 'lines', 'wave'],
  ['path-curvy-right', 'Uốn lượn phải', 'lines', 'wave'],
  ['path-decaying-wave', 'Sóng tắt dần', 'lines', 'wave'],
  ['path-sine-wave', 'Sóng hình sin', 'lines', 'wave'],
  ['path-wave', 'Sóng', 'lines', 'wave'],
  ['path-s-curve-1', 'Chữ S 1', 'lines', 'spline'],
  ['path-s-curve-2', 'Chữ S 2', 'lines', 'spline'],
  ['path-zigzag', 'Dích dắc', 'lines', 'zigzag'],
  ['path-stairs-down', 'Bậc thang xuống', 'lines', 'stairs'],
  ['path-heartbeat', 'Nhịp tim', 'lines', 'heartbeat'],
  ['path-funnel', 'Hình phễu', 'lines', 'funnel'],
  ['path-spring', 'Lò xo', 'lines', 'spring'],
  ['path-spiral-left', 'Xoắn ốc trái', 'lines', 'spiral'],
  ['path-spiral-right', 'Xoắn ốc phải', 'lines', 'spiral'],
  ['path-circle', 'Vòng tròn', 'shapes', 'circle'],
  ['path-oval', 'Hình bầu dục', 'shapes', 'circle'],
  ['path-square', 'Hình vuông', 'shapes', 'square'],
  ['path-diamond', 'Hình thoi', 'shapes', 'diamond'],
  ['path-triangle', 'Tam giác đều', 'shapes', 'triangle'],
  ['path-right-triangle', 'Tam giác vuông', 'shapes', 'triangle'],
  ['path-pentagon', 'Ngũ giác', 'shapes', 'pentagon'],
  ['path-hexagon', 'Lục giác', 'shapes', 'hexagon'],
  ['path-octagon', 'Bát giác', 'shapes', 'octagon'],
  ['path-parallelogram', 'Hình bình hành', 'shapes', 'square'],
  ['path-trapezoid', 'Hình thang', 'shapes', 'square'],
  ['path-star-4', 'Sao 4 cánh', 'shapes', 'star'],
  ['path-star-5', 'Sao 5 cánh', 'shapes', 'star'],
  ['path-star-6', 'Sao 6 cánh', 'shapes', 'star'],
  ['path-star-8', 'Sao 8 cánh', 'shapes', 'star'],
  ['path-heart', 'Trái tim', 'shapes', 'heart'],
  ['path-crescent-moon', 'Trăng khuyết', 'shapes', 'moon'],
  ['path-teardrop', 'Giọt nước', 'shapes', 'drop'],
  ['path-football', 'Quả bóng bầu dục', 'shapes', 'circle'],
  ['path-loop', 'Số 8 ngang', 'special', 'loop'],
  ['path-vertical-figure-8', 'Số 8 dọc', 'special', 'loop'],
  ['path-figure-8-four', 'Bốn vòng số 8', 'special', 'loop'],
  ['path-loop-de-loop', 'Vòng lộn nhào', 'special', 'loop'],
  ['path-bean', 'Hạt đậu', 'special', 'bean'],
  ['path-peanut', 'Hạt lạc', 'special', 'bean'],
  ['path-curved-square', 'Vuông bo cong', 'special', 'square'],
  ['path-curved-x', 'Chữ X cong', 'special', 'cross'],
  ['path-plus', 'Dấu cộng', 'special', 'plus'],
  ['path-pointy-star', 'Sao nhọn', 'special', 'star'],
  ['path-neutron', 'Quỹ đạo nơtron', 'special', 'atom'],
  ['path-buzz-saw', 'Lưỡi cưa', 'special', 'saw'],
  ['path-swoosh', 'Vệt lướt', 'special', 'spline'],
  ['path-inverted-square', 'Vuông lõm', 'special', 'square'],
  ['path-inverted-triangle', 'Tam giác ngược', 'special', 'triangle'],
  ['path-custom', 'Tùy chỉnh', 'special', 'custom'],
];

const DEFAULT_ANIMATION_DURATION = 0.5;
const DEFAULT_MOTION_DURATION = 2;

const entranceTypeOf = (seed: AnimationSeed) => seed.entranceType ?? `${seed.base}-in`;
const exitTypeOf = (seed: AnimationSeed) => seed.exitType ?? `${seed.base}-out`;

export const ANIMATION_DEFS: AnimationDef[] = [
  ...ENTRANCE_SEEDS.map((seed) => ({
    type: entranceTypeOf(seed),
    label: seed.entrance,
    category: 'entrance' as const,
    group: seed.group,
    family: seed.family,
    duration: seed.duration ?? DEFAULT_ANIMATION_DURATION,
    direction: seed.direction,
  })),
  ...EMPHASIS_SEEDS.map(([type, label, group, family, duration]) => ({
    type,
    label,
    category: 'emphasis' as const,
    group,
    family,
    duration: duration ?? DEFAULT_ANIMATION_DURATION,
  })),
  ...ENTRANCE_SEEDS.map((seed) => ({
    type: exitTypeOf(seed),
    label: seed.exit,
    category: 'exit' as const,
    group: seed.group,
    family: seed.family,
    duration: seed.duration ?? DEFAULT_ANIMATION_DURATION,
    direction: seed.direction,
  })),
  ...MOTION_SEEDS.map(([type, label, group, family]) => ({
    type,
    label,
    category: 'motion-path' as const,
    group,
    family,
    duration: DEFAULT_MOTION_DURATION,
  })),
];

const ANIMATION_DEF_BY_TYPE = new Map(ANIMATION_DEFS.map((def) => [def.type, def]));

const ENTRANCE_BASE_BY_TYPE = new Map<string, string>();
const EXIT_BASE_BY_TYPE = new Map<string, string>();
for (const seed of ENTRANCE_SEEDS) {
  ENTRANCE_BASE_BY_TYPE.set(entranceTypeOf(seed), seed.base);
  EXIT_BASE_BY_TYPE.set(exitTypeOf(seed), seed.base);
}

const LEGACY_TYPE_ALIASES: Record<string, string> = {
  'fly-in-up': 'fly-in',
  'fly-in-left': 'fly-in',
  bounce: 'bounce-in',
};

const LEGACY_DIRECTIONS: Record<string, string> = { 'fly-in-left': 'left', 'fly-in-up': 'bottom' };

export function normalizeAnimationType(type: string): string {
  return LEGACY_TYPE_ALIASES[type] ?? type;
}

export function getAnimationDef(type: string): AnimationDef | undefined {
  return ANIMATION_DEF_BY_TYPE.get(normalizeAnimationType(type));
}

export function animationLabel(type: string): string {
  return getAnimationDef(type)?.label ?? type;
}

export function animationCategoryOf(type: string): AnimationCategory {
  return getAnimationDef(type)?.category ?? 'entrance';
}

export function buildAnimationPlan(
  anim: Pick<ElementAnimation, 'type' | 'direction' | 'motionPathCoords'>,
  context: FxContext
): FxPlan | null {
  const type = normalizeAnimationType(anim.type);
  const direction = anim.direction ?? LEGACY_DIRECTIONS[anim.type] ?? getAnimationDef(type)?.direction;
  const entranceBase = ENTRANCE_BASE_BY_TYPE.get(type);
  if (entranceBase) return ENTRANCE[entranceBase](direction, context);
  const exitBase = EXIT_BASE_BY_TYPE.get(type);
  if (exitBase) {
    const plan = ENTRANCE[exitBase](direction, context);
    return { ...plan, frames: reverseFrames(plan.frames) };
  }
  const emphasis = EMPHASIS[type];
  if (emphasis) return emphasis(direction, context);
  return motionPlan(type, anim, context);
}

function reverseFrames(frames: FxFrame[]): FxFrame[] {
  return [...frames].reverse().map((frame) => {
    const { easing: _easing, ...rest } = frame;
    return typeof rest.offset === 'number' ? { ...rest, offset: round(1 - rest.offset) } : rest;
  });
}

export function elementAnimations(element: SlideElement): ElementAnimation[] {
  if (element.animations && element.animations.length > 0) {
    return element.animations.filter((anim) => anim.type !== 'none');
  }
  const legacy = element.animation;
  if (!legacy || legacy.type === 'none') return [];
  return [
    {
      id: `anim-${element.id}`,
      type: legacy.type,
      category: animationCategoryOf(legacy.type),
      duration: legacy.duration || DEFAULT_ANIMATION_DURATION,
      delay: legacy.delay || 0,
      trigger: legacy.trigger || 'on-click',
      direction: legacy.direction,
      order: 1,
    },
  ];
}

export interface SlideAnimationEntry {
  element: SlideElement;
  anim: ElementAnimation;
}

export function collectSlideAnimations(elements: SlideElement[]): SlideAnimationEntry[] {
  const entries = elements.flatMap((element, elementIndex) =>
    elementAnimations(element).map((anim, animIndex) => ({ element, anim, elementIndex, animIndex }))
  );
  entries.sort(
    (a, b) =>
      (a.anim.order ?? 0) - (b.anim.order ?? 0) || a.elementIndex - b.elementIndex || a.animIndex - b.animIndex
  );
  return entries.map(({ element, anim }) => ({ element, anim }));
}

export interface TimelineItem {
  elementId: string;
  anim: ElementAnimation;
  start: number;
  end: number;
}

export interface TimelineStep {
  auto: boolean;
  items: TimelineItem[];
  duration: number;
}

export function animationIterations(anim: ElementAnimation): number {
  const base = typeof anim.repeat === 'number' && anim.repeat > 0 ? anim.repeat : 1;
  return anim.autoReverse ? base * 2 : base;
}

function animationSpan(anim: ElementAnimation): number {
  const duration = Math.max(0.01, anim.duration || DEFAULT_ANIMATION_DURATION);
  return duration * animationIterations(anim);
}

export function buildAnimationTimeline(elements: SlideElement[]): TimelineStep[] {
  const steps: TimelineStep[] = [{ auto: true, items: [], duration: 0 }];
  for (const { element, anim } of collectSlideAnimations(elements)) {
    let step = steps[steps.length - 1];
    const previous = step.items[step.items.length - 1];
    if (anim.trigger === 'on-click' || !anim.trigger) {
      step = { auto: false, items: [], duration: 0 };
      steps.push(step);
    }
    const anchor = !previous || step.items.length === 0
      ? 0
      : anim.trigger === 'after-previous'
      ? previous.end
      : previous.start - (previous.anim.delay || 0);
    const start = anchor + (anim.delay || 0);
    const end = start + animationSpan(anim);
    step.items.push({ elementId: element.id, anim, start, end });
    step.duration = Math.max(step.duration, end);
  }
  return steps;
}

export function countClickSteps(steps: TimelineStep[]): number {
  return steps.filter((step) => !step.auto).length;
}

export function playedItems(steps: TimelineStep[], completedClicks: number, autoPlayed: boolean): TimelineItem[] {
  const played: TimelineItem[] = [];
  let clicks = 0;
  for (const step of steps) {
    if (step.auto) {
      if (autoPlayed) played.push(...step.items);
      continue;
    }
    if (clicks >= completedClicks) break;
    clicks++;
    played.push(...step.items);
  }
  return played;
}

const isVisibilityAnimation = (anim: ElementAnimation) => anim.category === 'entrance' || anim.category === 'exit';

export function hiddenElementIds(steps: TimelineStep[], completedClicks: number, autoPlayed: boolean): string[] {
  const playedIds = new Set(playedItems(steps, completedClicks, autoPlayed).map((item) => item.anim.id));
  const state = new Map<string, boolean>();
  const seen = new Set<string>();
  for (const step of steps) {
    for (const item of step.items) {
      const { anim, elementId } = item;
      const played = playedIds.has(anim.id);
      if (isVisibilityAnimation(anim)) {
        if (!seen.has(elementId)) {
          seen.add(elementId);
          state.set(elementId, anim.category === 'entrance');
        }
        if (played) state.set(elementId, anim.category === 'exit');
      }
      if (played && anim.afterAnimation === 'hide') state.set(elementId, true);
    }
  }
  return [...state.entries()].filter(([, hidden]) => hidden).map(([id]) => id);
}

export function animationEasing(anim: ElementAnimation, fallback: string | undefined): string {
  if (anim.bounceEnd) return EASE_BACK;
  if (anim.smoothStart && anim.smoothEnd) return EASE_IN_OUT;
  if (anim.smoothStart) return 'ease-in';
  if (anim.smoothEnd) return 'ease-out';
  return fallback ?? 'ease';
}

const TRANSITION_SEEDS: [string, string, TransitionCategory, string, number, string?][] = [
  ['none', 'Không có', 'subtle', 'none', 0],
  ['morph', 'Biến đổi', 'subtle', 'morph', 1],
  ['fade', 'Mờ dần', 'subtle', 'fade', 0.7],
  ['push', 'Đẩy', 'subtle', 'push', 0.7, 'from-bottom'],
  ['wipe', 'Lau', 'subtle', 'wipe', 0.7, 'from-right'],
  ['split', 'Tách', 'subtle', 'split', 0.8, 'vertical'],
  ['reveal', 'Tiết lộ', 'subtle', 'reveal', 1.2, 'from-right'],
  ['cut', 'Cắt nhanh', 'subtle', 'cut', 0.05],
  ['random-bars', 'Thanh ngẫu nhiên', 'subtle', 'bars', 0.8, 'vertical'],
  ['shape', 'Hình dạng', 'subtle', 'shape', 0.8],
  ['uncover', 'Mở ra', 'subtle', 'uncover', 0.8, 'from-right'],
  ['cover', 'Che phủ', 'subtle', 'cover', 0.8, 'from-right'],
  ['flash', 'Chớp sáng', 'subtle', 'flash', 0.7],
  ['fall-over', 'Đổ xuống', 'exciting', 'fall', 1.2],
  ['drape', 'Rèm rủ', 'exciting', 'drape', 1.2],
  ['curtains', 'Màn sân khấu', 'exciting', 'curtains', 1.4],
  ['wind', 'Gió thổi', 'exciting', 'wind', 1.2],
  ['prestige', 'Uy tín', 'exciting', 'prestige', 1.2],
  ['fracture', 'Vỡ vụn', 'exciting', 'fracture', 1.2],
  ['crush', 'Vò nát', 'exciting', 'crush', 1.2],
  ['peel-off', 'Bóc ra', 'exciting', 'peel', 1],
  ['page-curl', 'Lật trang giấy', 'exciting', 'page', 1.2],
  ['airplane', 'Máy bay giấy', 'exciting', 'airplane', 1.4],
  ['origami', 'Origami', 'exciting', 'origami', 1.2],
  ['dissolve', 'Tan biến', 'exciting', 'dissolve', 1],
  ['checkerboard', 'Bàn cờ', 'exciting', 'checker', 1],
  ['blinds', 'Mành che', 'exciting', 'blinds', 1, 'vertical'],
  ['clock', 'Đồng hồ', 'exciting', 'clock', 1],
  ['ripple', 'Gợn sóng', 'exciting', 'ripple', 1.2],
  ['honeycomb', 'Tổ ong', 'exciting', 'honeycomb', 1.4],
  ['glitter', 'Kim tuyến', 'exciting', 'glitter', 1.4],
  ['vortex', 'Xoáy nước', 'exciting', 'vortex', 1.4],
  ['shred', 'Xé vụn', 'exciting', 'shred', 1.2],
  ['switch', 'Hoán đổi', 'exciting', 'switch', 1.2],
  ['flip', 'Lật trang', 'exciting', 'flip', 1],
  ['gallery', 'Triển lãm', 'exciting', 'gallery', 1.2],
  ['cube', 'Khối hộp', 'exciting', 'cube', 1, 'from-right'],
  ['doors', 'Cánh cửa', 'exciting', 'doors', 1.2],
  ['box', 'Hộp vuông', 'exciting', 'box', 1, 'from-right'],
  ['comb', 'Răng lược', 'exciting', 'comb', 1],
  ['zoom', 'Thu phóng', 'exciting', 'zoom', 0.8, 'in'],
  ['random', 'Ngẫu nhiên', 'exciting', 'random', 1],
  ['pan', 'Lia máy', 'dynamic', 'pan', 1, 'from-bottom'],
  ['ferris', 'Đu quay', 'dynamic', 'ferris', 1.2, 'from-right'],
  ['conveyor', 'Băng chuyền', 'dynamic', 'conveyor', 1.4, 'from-right'],
  ['rotate', 'Xoay tròn', 'dynamic', 'rotate', 1.2, 'from-right'],
  ['window', 'Cửa sổ', 'dynamic', 'window', 1.2],
  ['orbit', 'Quỹ đạo', 'dynamic', 'orbit', 1.2, 'from-right'],
  ['fly-through', 'Bay xuyên qua', 'dynamic', 'fly-through', 0.9, 'in'],
  ['carousel', 'Băng xoay', 'dynamic', 'carousel', 1.2, 'from-right'],
];

export const TRANSITION_DEFS: TransitionDef[] = TRANSITION_SEEDS.map(
  ([type, label, category, family, duration, direction]) => ({ type, label, category, family, duration, direction })
);

const TRANSITION_DEF_BY_TYPE = new Map(TRANSITION_DEFS.map((def) => [def.type, def]));

export function getTransitionDef(type: string): TransitionDef | undefined {
  return TRANSITION_DEF_BY_TYPE.get(type);
}

export interface TransitionPlan {
  outgoing: FxFrame[];
  incoming: FxFrame[];
  outgoingOnTop: boolean;
  easing: string;
}

function curtainPolygon(left: number, right: number, vertical: boolean): string {
  const points: Point[] = vertical
    ? [[0, 0], [100, 0], [100, left], [0, left], [0, 0], [0, 100], [100, 100], [100, right], [0, right], [0, 0]]
    : [[0, 0], [left, 0], [left, 100], [0, 100], [0, 0], [100, 0], [100, 100], [right, 100], [right, 0], [100, 0]];
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

const curtainFrames = (vertical: boolean): FxFrame[] => [
  { clipPath: curtainPolygon(50, 50, vertical) },
  { clipPath: curtainPolygon(0, 100, vertical) },
];

const HOLD: FxFrame[] = [];

type TransitionBuilder = (direction: string | undefined) => Omit<TransitionPlan, 'easing'> & { easing?: string };

const incomingOnly = (incoming: FxFrame[], easing?: string) => ({ outgoing: HOLD, incoming, outgoingOnTop: false, easing });
const outgoingOnly = (outgoing: FxFrame[], easing?: string, incoming: FxFrame[] = HOLD) => ({
  outgoing,
  incoming,
  outgoingOnTop: true,
  easing,
});

function cubePlan(direction: string | undefined, inward: boolean, midScale?: string) {
  const [vx, vy] = vectorOf(direction, 'from-right');
  const axis = vx !== 0 ? 'y' : 'x';
  const sign = (vx !== 0 ? vx : -vy) * (inward ? -1 : 1);
  const outOrigin = vx > 0 ? '100% 50%' : vx < 0 ? '0% 50%' : vy > 0 ? '50% 100%' : '50% 0%';
  const inOrigin = vx > 0 ? '0% 50%' : vx < 0 ? '100% 50%' : vy > 0 ? '50% 0%' : '50% 100%';
  const mid = midScale ? [{ scale: midScale, offset: 0.5 }] : [];
  return {
    outgoing: [
      { translate: pct(0, 0), rotate: `${axis} 0deg`, transformOrigin: outOrigin, scale: '1 1' },
      ...mid,
      { translate: pct(-vx * 100, -vy * 100), rotate: `${axis} ${-90 * sign}deg`, transformOrigin: outOrigin, scale: '1 1' },
    ],
    incoming: [
      { translate: pct(vx * 100, vy * 100), rotate: `${axis} ${90 * sign}deg`, transformOrigin: inOrigin, scale: '1 1' },
      ...mid,
      { translate: pct(0, 0), rotate: `${axis} 0deg`, transformOrigin: inOrigin, scale: '1 1' },
    ],
    outgoingOnTop: false,
    easing: EASE_IN_OUT,
  };
}

const TRANSITIONS: Record<string, TransitionBuilder> = {
  fade: () => incomingOnly([{ opacity: 0 }, { opacity: 1 }], 'ease-in-out'),
  cut: () => incomingOnly([{ opacity: 0 }, { opacity: 1 }], STEP_END),
  push: (d) => {
    const [vx, vy] = vectorOf(d, 'from-bottom');
    return {
      outgoing: [{ translate: pct(0, 0) }, { translate: pct(-vx * 100, -vy * 100) }],
      incoming: [{ translate: pct(vx * 100, vy * 100) }, { translate: pct(0, 0) }],
      outgoingOnTop: false,
      easing: EASE_IN_OUT,
    };
  },
  wipe: (d) => incomingOnly([{ clipPath: insetFrom(d, 'from-right') }, { clipPath: FULL_INSET }], 'ease-in-out'),
  split: (d) =>
    d === 'in'
      ? outgoingOnly([{ clipPath: FULL_INSET }, { clipPath: 'inset(0% 50% 0% 50%)' }], 'ease-in-out')
      : incomingOnly(
          [{ clipPath: isVertical(d, true) ? 'inset(0% 50% 0% 50%)' : 'inset(50% 0% 50% 0%)' }, { clipPath: FULL_INSET }],
          'ease-in-out'
        ),
  reveal: (d) => {
    const [vx, vy] = vectorOf(d, 'from-right');
    return outgoingOnly(
      [{ opacity: 1, translate: pct(0, 0) }, { opacity: 0, translate: pct(-vx * 30, -vy * 30) }],
      'ease-in-out',
      [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }]
    );
  },
  'random-bars': (d) => incomingOnly(maskPlan(randomBarsMask(isVertical(d, true)), '0%', '100%'), 'linear'),
  shape: (d) =>
    d === 'in'
      ? outgoingOnly([{ clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }], 'ease-in-out')
      : incomingOnly([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], 'ease-in-out'),
  uncover: (d) => {
    const [vx, vy] = vectorOf(d, 'from-right');
    return outgoingOnly([{ translate: pct(0, 0) }, { translate: pct(-vx * 100, -vy * 100) }], EASE_IN_OUT);
  },
  cover: (d) => {
    const [vx, vy] = vectorOf(d, 'from-right');
    return incomingOnly([{ translate: pct(vx * 100, vy * 100) }, { translate: pct(0, 0) }], EASE_IN_OUT);
  },
  flash: () =>
    incomingOnly(
      [
        { opacity: 0, filter: 'brightness(5)' },
        { opacity: 1, filter: 'brightness(5)', offset: 0.3 },
        { opacity: 1, filter: 'brightness(1)' },
      ],
      'ease-out'
    ),
  'fall-over': () =>
    outgoingOnly(
      [
        { rotate: '0deg', translate: pct(0, 0), transformOrigin: '0% 100%', opacity: 1 },
        { rotate: '-14deg', translate: pct(-12, 6), transformOrigin: '0% 100%', opacity: 1, offset: 0.45 },
        { rotate: '-80deg', translate: pct(-60, 60), transformOrigin: '0% 100%', opacity: 0 },
      ],
      'ease-in',
      [{ scale: '0.92 0.92' }, { scale: '1 1' }]
    ),
  drape: () =>
    outgoingOnly(
      [
        { clipPath: FULL_INSET, translate: pct(0, 0), scale: '1 1' },
        { clipPath: 'inset(0% 0% 100% 0%)', translate: pct(0, -6), scale: '1.04 1' },
      ],
      EASE_IN_OUT
    ),
  curtains: () => outgoingOnly(curtainFrames(false), EASE_IN_OUT, [{ scale: '0.9 0.9' }, { scale: '1 1' }]),
  wind: () =>
    outgoingOnly(
      maskPlan(`linear-gradient(to right, transparent ${P}, #000 calc(${P} + 30%))`, '-30%', '100%').map((frame, index) => ({
        ...frame,
        translate: pct(index === 0 ? 0 : -10, 0),
      })),
      'ease-in'
    ),
  prestige: () =>
    outgoingOnly(
      [{ translate: pct(0, 0) }, { translate: pct(0, 4), offset: 0.2 }, { translate: pct(0, -100) }],
      EASE_IN_OUT,
      [{ scale: '1.08 1.08' }, { scale: '1 1' }]
    ),
  fracture: () =>
    outgoingOnly(
      [
        { scale: '1 1', opacity: 1, filter: 'blur(0px)', rotate: '0deg' },
        { scale: '1.06 1.06', opacity: 1, filter: 'blur(0px)', rotate: '0.6deg', offset: 0.25 },
        { scale: '1.5 1.5', opacity: 0, filter: 'blur(8px)', rotate: '-3deg' },
      ],
      'ease-in'
    ),
  crush: () =>
    outgoingOnly(
      [
        { scale: '1 1', rotate: '0deg', opacity: 1, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' },
        { scale: '0.6 0.6', rotate: '8deg', opacity: 1, clipPath: 'polygon(8% 4%, 94% 10%, 88% 92%, 4% 86%)', offset: 0.55 },
        { scale: '0.08 0.08', rotate: '40deg', opacity: 0, clipPath: 'polygon(20% 12%, 80% 22%, 70% 80%, 14% 70%)' },
      ],
      'ease-in'
    ),
  'peel-off': () =>
    outgoingOnly(
      [{ clipPath: 'polygon(0% 0%, 200% 0%, 0% 200%)' }, { clipPath: 'polygon(0% 0%, 0% 0%, 0% 0%)' }],
      EASE_IN_OUT
    ),
  'page-curl': () =>
    outgoingOnly(
      [
        { rotate: 'y 0deg', transformOrigin: '0% 50%', filter: 'brightness(1)' },
        { rotate: 'y -100deg', transformOrigin: '0% 50%', filter: 'brightness(0.7)' },
      ],
      EASE_IN_OUT
    ),
  airplane: () =>
    outgoingOnly(
      [
        { scale: '1 1', rotate: '0deg', translate: pct(0, 0), opacity: 1, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' },
        { scale: '0.45 0.45', rotate: '-8deg', translate: pct(0, 0), opacity: 1, clipPath: 'polygon(0% 50%, 100% 20%, 100% 80%, 0% 50%)', offset: 0.45 },
        { scale: '0.2 0.2', rotate: '-18deg', translate: pct(130, -70), opacity: 0, clipPath: 'polygon(0% 50%, 100% 20%, 100% 80%, 0% 50%)' },
      ],
      'ease-in'
    ),
  origami: () =>
    outgoingOnly(
      [
        { scale: '1 1', rotate: '0deg', transformOrigin: '0% 50%', opacity: 1 },
        { scale: '0.5 1', rotate: '0deg', transformOrigin: '0% 50%', opacity: 1, offset: 0.4 },
        { scale: '0.25 0.5', rotate: '20deg', transformOrigin: '0% 50%', opacity: 1, offset: 0.7 },
        { scale: '0.05 0.1', rotate: '60deg', translate: pct(120, -80), transformOrigin: '0% 50%', opacity: 0 },
      ],
      'ease-in-out'
    ),
  dissolve: () => incomingOnly(maskPlan(dotsMask(), '0%', '100%', FX_PROGRESS, dotsExtra(18)), 'linear'),
  checkerboard: () => {
    const { image, extra } = checkerMask();
    return incomingOnly(maskPlan(image, '0%', '100%', FX_PROGRESS, extra), 'linear');
  },
  blinds: (d) => incomingOnly(maskPlan(blindsMask(isVertical(d, true)), '0%', '100%'), 'linear'),
  clock: (d) =>
    d === 'in'
      ? incomingOnly(maskPlan(WEDGE_MASK, '0deg', '180deg', FX_ANGLE), 'linear')
      : incomingOnly(maskPlan(wheelMask(1), '0deg', '360deg', FX_ANGLE), 'linear'),
  ripple: () =>
    incomingOnly(
      [
        { clipPath: 'circle(0% at 50% 50%)', scale: '1.12 1.12' },
        { clipPath: 'circle(45% at 50% 50%)', scale: '0.98 0.98', offset: 0.6 },
        { clipPath: 'circle(75% at 50% 50%)', scale: '1 1' },
      ],
      'ease-out'
    ),
  honeycomb: () =>
    incomingOnly(
      maskPlan(dotsMask(), '0%', '100%', FX_PROGRESS, dotsExtra(90)).map((frame, index) => ({
        ...frame,
        scale: index === 0 ? '1.15 1.15' : '1 1',
      })),
      'ease-in-out'
    ),
  glitter: () =>
    incomingOnly(
      maskPlan(dotsMask(), '0%', '100%', FX_PROGRESS, dotsExtra(28)).map((frame, index) => ({
        ...frame,
        filter: index === 0 ? 'brightness(2.2)' : 'brightness(1)',
      })),
      'ease-in'
    ),
  vortex: () =>
    outgoingOnly(
      [{ rotate: '0deg', scale: '1 1', opacity: 1 }, { rotate: '540deg', scale: '0 0', opacity: 0 }],
      'ease-in',
      [{ opacity: 0 }, { opacity: 1 }]
    ),
  shred: () =>
    outgoingOnly(
      maskPlan(blindsMask(true), '100%', '0%').map((frame, index) => ({
        ...frame,
        scale: index === 0 ? '1 1' : '1 1.5',
        opacity: index === 0 ? 1 : 0.4,
      })),
      'ease-in'
    ),
  switch: () => ({
    outgoing: [
      { translate: pct(0, 0), scale: '1 1', opacity: 1 },
      { translate: pct(-55, 0), scale: '0.8 0.8', opacity: 1, offset: 0.5 },
      { translate: pct(0, 0), scale: '0.7 0.7', opacity: 0 },
    ],
    incoming: [
      { translate: pct(0, 0), scale: '0.7 0.7', opacity: 0 },
      { translate: pct(55, 0), scale: '0.8 0.8', opacity: 1, offset: 0.5 },
      { translate: pct(0, 0), scale: '1 1', opacity: 1 },
    ],
    outgoingOnTop: false,
    easing: EASE_IN_OUT,
  }),
  flip: () => ({
    outgoing: [
      { rotate: 'y 0deg', opacity: 1 },
      { rotate: 'y -90deg', opacity: 1, offset: 0.5 },
      { rotate: 'y -90deg', opacity: 0, offset: 0.51 },
      { rotate: 'y -90deg', opacity: 0 },
    ],
    incoming: [
      { rotate: 'y 90deg', opacity: 0 },
      { rotate: 'y 90deg', opacity: 0, offset: 0.5 },
      { rotate: 'y 90deg', opacity: 1, offset: 0.51 },
      { rotate: 'y 0deg', opacity: 1 },
    ],
    outgoingOnTop: false,
    easing: 'linear',
  }),
  gallery: () => ({
    outgoing: [
      { translate: pct(0, 0), scale: '1 1' },
      { translate: pct(-20, 0), scale: '0.86 0.86', offset: 0.3 },
      { translate: pct(-115, 0), scale: '0.86 0.86' },
    ],
    incoming: [
      { translate: pct(115, 0), scale: '0.86 0.86' },
      { translate: pct(20, 0), scale: '0.86 0.86', offset: 0.7 },
      { translate: pct(0, 0), scale: '1 1' },
    ],
    outgoingOnTop: false,
    easing: 'ease-in-out',
  }),
  cube: (d) => cubePlan(d, false),
  box: (d) => cubePlan(d, true),
  rotate: (d) => cubePlan(d, false, '0.8 0.8'),
  doors: () => outgoingOnly(curtainFrames(false), EASE_IN_OUT, [{ scale: '0.7 0.7', opacity: 0.6 }, { scale: '1 1', opacity: 1 }]),
  window: (d) => outgoingOnly(curtainFrames(isVertical(d, false)), EASE_IN_OUT),
  comb: () =>
    incomingOnly(
      maskPlan(blindsMask(false), '0%', '100%').map((frame, index) => ({
        ...frame,
        translate: pct(index === 0 ? 12 : 0, 0),
      })),
      'ease-out'
    ),
  zoom: (d) =>
    d === 'out'
      ? outgoingOnly([{ scale: '1 1', opacity: 1 }, { scale: '0.2 0.2', opacity: 0 }], 'ease-in')
      : incomingOnly([{ scale: '0.2 0.2', opacity: 0 }, { scale: '1 1', opacity: 1 }], EASE_OUT),
  pan: (d) => {
    const [vx, vy] = vectorOf(d, 'from-bottom');
    return {
      outgoing: [{ translate: pct(0, 0), opacity: 1 }, { translate: pct(-vx * 100, -vy * 100), opacity: 0.3 }],
      incoming: [{ translate: pct(vx * 100, vy * 100), opacity: 0.3 }, { translate: pct(0, 0), opacity: 1 }],
      outgoingOnTop: false,
      easing: 'ease-in-out',
    };
  },
  ferris: (d) => {
    const [vx] = vectorOf(d, 'from-right');
    const sign = vx < 0 ? -1 : 1;
    return {
      outgoing: [
        { rotate: '0deg', transformOrigin: '50% 260%' },
        { rotate: `${-38 * sign}deg`, transformOrigin: '50% 260%' },
      ],
      incoming: [
        { rotate: `${38 * sign}deg`, transformOrigin: '50% 260%' },
        { rotate: '0deg', transformOrigin: '50% 260%' },
      ],
      outgoingOnTop: false,
      easing: EASE_IN_OUT,
    };
  },
  conveyor: (d) => {
    const [vx] = vectorOf(d, 'from-right');
    const sign = vx < 0 ? -1 : 1;
    return {
      outgoing: [
        { translate: pct(0, 0), scale: '1 1' },
        { translate: pct(0, 0), scale: '0.8 0.8', offset: 0.25 },
        { translate: pct(-110 * sign, 0), scale: '0.8 0.8', offset: 0.75 },
        { translate: pct(-110 * sign, 0), scale: '0.8 0.8' },
      ],
      incoming: [
        { translate: pct(110 * sign, 0), scale: '0.8 0.8' },
        { translate: pct(110 * sign, 0), scale: '0.8 0.8', offset: 0.25 },
        { translate: pct(0, 0), scale: '0.8 0.8', offset: 0.75 },
        { translate: pct(0, 0), scale: '1 1' },
      ],
      outgoingOnTop: false,
      easing: 'ease-in-out',
    };
  },
  orbit: (d) => {
    const [vx] = vectorOf(d, 'from-right');
    const sign = vx < 0 ? -1 : 1;
    return {
      outgoing: [
        { translate: pct(0, 0), scale: '1 1', rotate: 'y 0deg', opacity: 1 },
        { translate: pct(-100 * sign, 0), scale: '0.6 0.6', rotate: `y ${-50 * sign}deg`, opacity: 0 },
      ],
      incoming: [
        { translate: pct(100 * sign, 0), scale: '0.6 0.6', rotate: `y ${50 * sign}deg`, opacity: 0 },
        { translate: pct(0, 0), scale: '1 1', rotate: 'y 0deg', opacity: 1 },
      ],
      outgoingOnTop: false,
      easing: EASE_IN_OUT,
    };
  },
  carousel: (d) => {
    const [vx] = vectorOf(d, 'from-right');
    const sign = vx < 0 ? -1 : 1;
    return {
      outgoing: [
        { translate: pct(0, 0), scale: '1 1', rotate: 'y 0deg', opacity: 1 },
        { translate: pct(-70 * sign, 0), scale: '0.75 0.75', rotate: `y ${-35 * sign}deg`, opacity: 0 },
      ],
      incoming: [
        { translate: pct(70 * sign, 0), scale: '0.75 0.75', rotate: `y ${35 * sign}deg`, opacity: 0 },
        { translate: pct(0, 0), scale: '1 1', rotate: 'y 0deg', opacity: 1 },
      ],
      outgoingOnTop: false,
      easing: EASE_IN_OUT,
    };
  },
  'fly-through': (d) =>
    d === 'out'
      ? {
          outgoing: [{ scale: '1 1', opacity: 1 }, { scale: '0.3 0.3', opacity: 0 }],
          incoming: [{ scale: '2.6 2.6', opacity: 0 }, { scale: '1 1', opacity: 1 }],
          outgoingOnTop: false,
          easing: EASE_IN_OUT,
        }
      : {
          outgoing: [{ scale: '1 1', opacity: 1 }, { scale: '2.6 2.6', opacity: 0 }],
          incoming: [{ scale: '0.3 0.3', opacity: 0 }, { scale: '1 1', opacity: 1 }],
          outgoingOnTop: true,
          easing: EASE_IN_OUT,
        },
};

const RANDOM_POOL = Object.keys(TRANSITIONS).filter((type) => type !== 'cut');

export function resolveTransitionType(type: string, random: () => number = Math.random): string {
  if (type !== 'random') return type;
  return RANDOM_POOL[Math.floor(random() * RANDOM_POOL.length) % RANDOM_POOL.length];
}

export function buildTransitionPlan(
  transition: Pick<SlideTransition, 'type' | 'direction'> | undefined,
  random: () => number = Math.random
): TransitionPlan | null {
  if (!transition || transition.type === 'none') return null;
  const type = resolveTransitionType(transition.type === 'morph' ? 'fade' : transition.type, random);
  const builder = TRANSITIONS[type];
  if (!builder) return null;
  const direction = transition.direction ?? getTransitionDef(type)?.direction;
  const plan = builder(direction);
  return { ...plan, easing: plan.easing ?? 'ease-in-out' };
}

export function transitionDurationOf(transition: Pick<SlideTransition, 'type' | 'duration'> | undefined): number {
  if (!transition || transition.type === 'none') return 0;
  if (transition.type === 'cut') return 0.05;
  return Math.max(0.1, transition.duration || getTransitionDef(transition.type)?.duration || 0.7);
}

export interface MorphGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

function morphKey(element: SlideElement): string {
  return [element.type, element.shapeType ?? '', element.text ?? '', element.src ?? '', element.chartTitle ?? ''].join('|');
}

export function matchMorphElements(from: SlideElement[], to: SlideElement[]): Record<string, MorphGeometry> {
  const pool = [...from];
  const take = (predicate: (candidate: SlideElement) => boolean) => {
    const index = pool.findIndex(predicate);
    return index === -1 ? undefined : pool.splice(index, 1)[0];
  };
  const result: Record<string, MorphGeometry> = {};
  for (const target of to) {
    const source =
      take((candidate) => candidate.id === target.id) ??
      take((candidate) => morphKey(candidate) === morphKey(target)) ??
      undefined;
    if (!source) continue;
    result[target.id] = {
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
      rotation: source.rotation ?? 0,
      opacity: source.opacity ?? 1,
    };
  }
  return result;
}
