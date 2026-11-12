import type { SlideElement } from './slideTypes';

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeMode = 'horizontal' | 'vertical';
export type ElementPatch = Record<string, Partial<SlideElement>>;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SLIDE_MARGIN = 5;
const round1 = (value: number) => Math.round(value * 10) / 10;

export function boundsOf(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function expandSelection(elements: SlideElement[], ids: string[]): string[] {
  const wanted = new Set(ids);
  const groups = new Set<string>();
  for (const element of elements) {
    if (wanted.has(element.id) && element.groupId) groups.add(element.groupId);
  }
  return elements
    .filter((element) => wanted.has(element.id) || (element.groupId !== undefined && groups.has(element.groupId)))
    .map((element) => element.id);
}

interface Unit {
  members: SlideElement[];
  box: Box;
}

function unitsOf(elements: SlideElement[], ids: string[]): Unit[] {
  const wanted = new Set(expandSelection(elements, ids));
  const byGroup = new Map<string, SlideElement[]>();
  const units: Unit[] = [];
  for (const element of elements) {
    if (!wanted.has(element.id)) continue;
    if (!element.groupId) {
      units.push({ members: [element], box: boundsOf([element]) });
      continue;
    }
    const members = byGroup.get(element.groupId);
    if (members) members.push(element);
    else byGroup.set(element.groupId, [element]);
  }
  for (const members of byGroup.values()) units.push({ members, box: boundsOf(members) });
  return units;
}

function shiftUnit(patch: ElementPatch, unit: Unit, dx: number, dy: number) {
  for (const member of unit.members) {
    if (member.locked) continue;
    patch[member.id] = { x: round1(member.x + dx), y: round1(member.y + dy) };
  }
}

export function alignElements(elements: SlideElement[], ids: string[], mode: AlignMode): ElementPatch {
  const units = unitsOf(elements, ids);
  const patch: ElementPatch = {};
  if (units.length === 0) return patch;
  const frame: Box =
    units.length === 1
      ? { x: SLIDE_MARGIN, y: SLIDE_MARGIN, width: 100 - SLIDE_MARGIN * 2, height: 100 - SLIDE_MARGIN * 2 }
      : boundsOf(units.map((unit) => unit.box));
  for (const unit of units) {
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = frame.x - unit.box.x;
    if (mode === 'center') dx = frame.x + frame.width / 2 - (unit.box.x + unit.box.width / 2);
    if (mode === 'right') dx = frame.x + frame.width - (unit.box.x + unit.box.width);
    if (mode === 'top') dy = frame.y - unit.box.y;
    if (mode === 'middle') dy = frame.y + frame.height / 2 - (unit.box.y + unit.box.height / 2);
    if (mode === 'bottom') dy = frame.y + frame.height - (unit.box.y + unit.box.height);
    shiftUnit(patch, unit, dx, dy);
  }
  return patch;
}

export function distributeElements(elements: SlideElement[], ids: string[], mode: DistributeMode): ElementPatch {
  const units = unitsOf(elements, ids);
  const patch: ElementPatch = {};
  if (units.length === 0) return patch;
  const horizontal = mode === 'horizontal';
  const start = (box: Box) => (horizontal ? box.x : box.y);
  const size = (box: Box) => (horizontal ? box.width : box.height);
  const sorted = [...units].sort((a, b) => start(a.box) - start(b.box));
  const overSlide = sorted.length < 3;
  const from = overSlide ? 0 : start(sorted[0].box);
  const to = overSlide ? 100 : Math.max(...sorted.map((unit) => start(unit.box) + size(unit.box)));
  const total = sorted.reduce((sum, unit) => sum + size(unit.box), 0);
  const slots = overSlide ? sorted.length + 1 : sorted.length - 1;
  const gap = (to - from - total) / slots;
  let cursor = overSlide ? from + gap : from;
  for (const unit of sorted) {
    const delta = cursor - start(unit.box);
    shiftUnit(patch, unit, horizontal ? delta : 0, horizontal ? 0 : delta);
    cursor += size(unit.box) + gap;
  }
  return patch;
}

export function canGroup(elements: SlideElement[], ids: string[]): boolean {
  const selected = elements.filter((element) => ids.includes(element.id));
  if (selected.length < 2) return false;
  const first = selected[0].groupId;
  return !first || selected.some((element) => element.groupId !== first);
}

export function canUngroup(elements: SlideElement[], ids: string[]): boolean {
  return elements.some((element) => ids.includes(element.id) && element.groupId !== undefined);
}

export function groupElements(elements: SlideElement[], ids: string[], groupId: string): ElementPatch {
  const patch: ElementPatch = {};
  for (const id of expandSelection(elements, ids)) patch[id] = { groupId };
  return patch;
}

export function ungroupElements(elements: SlideElement[], ids: string[]): ElementPatch {
  const patch: ElementPatch = {};
  for (const id of expandSelection(elements, ids)) patch[id] = { groupId: undefined };
  return patch;
}

export function moveBoxes(origins: Record<string, Box>, dx: number, dy: number): ElementPatch {
  const ids = Object.keys(origins);
  const patch: ElementPatch = {};
  if (ids.length === 0) return patch;
  const frame = boundsOf(ids.map((id) => origins[id]));
  const clampedX = Math.max(-frame.x, Math.min(100 - frame.width - frame.x, dx));
  const clampedY = Math.max(-frame.y, Math.min(100 - frame.height - frame.y, dy));
  for (const id of ids) {
    patch[id] = { x: round1(origins[id].x + clampedX), y: round1(origins[id].y + clampedY) };
  }
  return patch;
}

export function elementsInRect(elements: SlideElement[], rect: Box): string[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return elements
    .filter(
      (element) =>
        element.x < right &&
        element.x + element.width > rect.x &&
        element.y < bottom &&
        element.y + element.height > rect.y
    )
    .map((element) => element.id);
}

export function applyPatch(elements: SlideElement[], patch: ElementPatch): SlideElement[] {
  return elements.map((element) => (patch[element.id] ? { ...element, ...patch[element.id] } : element));
}
