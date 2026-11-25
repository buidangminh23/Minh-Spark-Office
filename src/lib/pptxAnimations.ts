import { child, descendants, type XmlNode } from './miniXml';
import type { AnimationDirection, AnimationTrigger, ElementAnimation, SlideElement } from './slideTypes';

type Preset = { type: string; direction?: AnimationDirection };

const ENTRANCE_PRESETS: Record<number, Preset> = {
  1: { type: 'appear' },
  2: { type: 'fly-in' },
  3: { type: 'blinds-in' },
  4: { type: 'box-in' },
  5: { type: 'checkerboard-in' },
  6: { type: 'circle-in' },
  8: { type: 'diamond-in' },
  9: { type: 'dissolve-in' },
  10: { type: 'fade-in' },
  12: { type: 'peek-in' },
  13: { type: 'plus-in' },
  14: { type: 'random-bars-in' },
  16: { type: 'split-in' },
  17: { type: 'stretch-in' },
  18: { type: 'strips-in' },
  20: { type: 'wedge-in' },
  21: { type: 'wheel-in' },
  22: { type: 'wipe-in' },
  23: { type: 'zoom-in' },
  26: { type: 'bounce-in' },
  31: { type: 'grow-turn' },
  37: { type: 'rise-up-in' },
  42: { type: 'float-in', direction: 'bottom' },
  47: { type: 'float-in', direction: 'top' },
  53: { type: 'basic-zoom-in' },
};

const EMPHASIS_PRESETS: Record<number, Preset> = {
  6: { type: 'pulse' },
  8: { type: 'spin' },
  9: { type: 'transparency' },
  26: { type: 'pulse' },
};

const SUBTYPE_DIRECTIONS: Record<number, AnimationDirection> = {
  1: 'top',
  2: 'right',
  4: 'bottom',
  8: 'left',
  21: 'vertical',
  26: 'horizontal',
  16: 'in',
  32: 'out',
};

const TRIGGERS: Record<string, AnimationTrigger> = {
  clickEffect: 'on-click',
  withEffect: 'with-previous',
  afterEffect: 'after-previous',
};

const DIRECTIONAL = new Set(['fly-in', 'wipe-in', 'peek-in', 'split-in', 'float-in', 'stretch-in']);

function delayOf(cTn: XmlNode): number {
  const value = child(child(cTn, 'p:stCondLst'), 'p:cond')?.attrs.delay;
  const ms = value && /^\d+$/.test(value) ? parseInt(value, 10) : 0;
  return ms / 1000;
}

function durationOf(cTn: XmlNode): number {
  const spans = descendants(cTn, 'p:cTn')
    .map((node) => node.attrs.dur)
    .filter((dur): dur is string => !!dur && /^\d+$/.test(dur))
    .map((dur) => parseInt(dur, 10));
  const longest = spans.length > 0 ? Math.max(...spans) : 500;
  return Math.max(0.1, longest / 1000);
}

function presetFor(cTn: XmlNode): Preset | undefined {
  const id = parseInt(cTn.attrs.presetID ?? '', 10);
  const table = cTn.attrs.presetClass === 'entr' ? ENTRANCE_PRESETS : cTn.attrs.presetClass === 'emph' ? EMPHASIS_PRESETS : undefined;
  if (!table) return undefined;
  const preset = table[id] ?? (cTn.attrs.presetClass === 'entr' ? { type: 'fade-in' } : undefined);
  if (!preset) return undefined;
  const subtype = SUBTYPE_DIRECTIONS[parseInt(cTn.attrs.presetSubtype ?? '0', 10)];
  return !preset.direction && subtype && DIRECTIONAL.has(preset.type) ? { ...preset, direction: subtype } : preset;
}

export function readSlideAnimations(root: XmlNode | undefined, shapes: Map<string, SlideElement>): number {
  const timing = descendants(root, 'p:timing')[0];
  if (!timing) return 0;
  const effects = descendants(timing, 'p:cTn').filter((cTn) => cTn.attrs.presetClass === 'entr' || cTn.attrs.presetClass === 'emph');
  const byElement = new Map<string, ElementAnimation[]>();
  let order = 0;
  for (const cTn of effects) {
    const target = descendants(cTn, 'p:spTgt')[0];
    const element = target?.attrs.spid ? shapes.get(target.attrs.spid) : undefined;
    const preset = presetFor(cTn);
    if (!element || !preset) continue;
    const list = byElement.get(element.id) ?? [];
    const isParagraph = !!child(target, 'p:txEl');
    const category = cTn.attrs.presetClass === 'emph' ? 'emphasis' : 'entrance';
    const existing = list.find((anim) => anim.category === category && anim.type === preset.type);
    if (existing && isParagraph) {
      existing.animateText = 'paragraph';
      continue;
    }
    const repeat = cTn.attrs.repeatCount === 'indefinite' ? 'until-end-of-slide' : cTn.attrs.repeatCount ? Math.max(1, Math.round(parseInt(cTn.attrs.repeatCount, 10) / 1000)) : undefined;
    order += 1;
    list.push({
      id: `anim-${element.id}-${list.length + 1}`,
      type: preset.type,
      category,
      duration: durationOf(cTn),
      delay: delayOf(cTn),
      trigger: TRIGGERS[cTn.attrs.nodeType ?? ''] ?? 'on-click',
      order,
      ...(preset.direction ? { direction: preset.direction } : {}),
      ...(repeat ? { repeat } : {}),
      ...(cTn.attrs.autoRev === '1' ? { autoReverse: true } : {}),
      ...(isParagraph ? { animateText: 'paragraph' as const } : {}),
    });
    byElement.set(element.id, list);
  }
  for (const [id, list] of byElement) {
    const element = [...shapes.values()].find((item) => item.id === id);
    if (element) element.animations = list;
  }
  return order;
}

export function shapeIdOf(node: XmlNode): { id?: string; name?: string } {
  for (const holder of ['p:nvSpPr', 'p:nvPicPr', 'p:nvGraphicFramePr', 'p:nvCxnSpPr']) {
    const props = child(child(node, holder), 'p:cNvPr');
    if (props) return { id: props.attrs.id, name: props.attrs.name };
  }
  return {};
}

export function morphModeOf(option: string | undefined): 'objects' | 'words' | 'characters' {
  return option === 'byWord' ? 'words' : option === 'byChar' ? 'characters' : 'objects';
}
