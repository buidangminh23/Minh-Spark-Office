export interface OutlineGroup {
  start: number;
  end: number;
  collapsed: boolean;
}

export interface SheetOutline {
  rows: OutlineGroup[];
  cols: OutlineGroup[];
}

export type OutlineAxis = keyof SheetOutline;

export const MAX_OUTLINE_LEVEL = 8;
export const EMPTY_OUTLINE: SheetOutline = { rows: [], cols: [] };

const contains = (outer: OutlineGroup, start: number, end: number) => outer.start <= start && outer.end >= end;
const overlaps = (group: OutlineGroup, start: number, end: number) => group.start <= end && group.end >= start;
const span = (group: OutlineGroup) => group.end - group.start;

export function sortGroups(groups: OutlineGroup[]): OutlineGroup[] {
  return [...groups].sort((a, b) => a.start - b.start || span(b) - span(a));
}

export function levelAt(groups: OutlineGroup[], index: number): number {
  return groups.filter((group) => group.start <= index && group.end >= index).length;
}

export function maxLevel(groups: OutlineGroup[]): number {
  let deepest = 0;
  for (const group of groups) deepest = Math.max(deepest, levelAt(groups, group.start), levelAt(groups, group.end));
  return deepest;
}

export function depthOf(groups: OutlineGroup[], target: OutlineGroup): number {
  return groups.filter((group) => contains(group, target.start, target.end)).length;
}

export function addGroup(groups: OutlineGroup[], start: number, end: number): OutlineGroup[] | null {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  if (groups.some((group) => group.start === low && group.end === high)) return null;
  const crossing = groups.some((group) => overlaps(group, low, high) && !contains(group, low, high) && !contains({ start: low, end: high, collapsed: false }, group.start, group.end));
  if (crossing) return null;
  const next = sortGroups([...groups, { start: low, end: high, collapsed: false }]);
  return maxLevel(next) > MAX_OUTLINE_LEVEL ? null : next;
}

export function innermostGroup(groups: OutlineGroup[], start: number, end: number): OutlineGroup | null {
  const holders = groups.filter((group) => contains(group, start, end));
  if (holders.length) return holders.reduce((best, group) => (span(group) < span(best) ? group : best));
  const touching = groups.filter((group) => overlaps(group, start, end));
  return touching.length ? touching.reduce((best, group) => (span(group) < span(best) ? group : best)) : null;
}

export function removeGroup(groups: OutlineGroup[], start: number, end: number): OutlineGroup[] | null {
  const target = innermostGroup(groups, Math.min(start, end), Math.max(start, end));
  return target ? groups.filter((group) => group !== target) : null;
}

export function setCollapsed(groups: OutlineGroup[], target: OutlineGroup, collapsed: boolean): OutlineGroup[] {
  return groups.map((group) => (group === target ? { ...group, collapsed } : group));
}

export function collapseToLevel(groups: OutlineGroup[], level: number): OutlineGroup[] {
  return groups.map((group) => ({ ...group, collapsed: depthOf(groups, group) >= level }));
}

export function hiddenIndexes(groups: OutlineGroup[]): Set<number> {
  const hidden = new Set<number>();
  for (const group of groups) {
    if (!group.collapsed) continue;
    for (let index = group.start; index <= group.end; index++) hidden.add(index);
  }
  return hidden;
}

export interface IndexRun {
  start: number;
  count: number;
}

export function toRuns(indexes: Iterable<number>): IndexRun[] {
  const sorted = [...indexes].sort((a, b) => a - b);
  const runs: IndexRun[] = [];
  for (const index of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.start + last.count === index) last.count += 1;
    else runs.push({ start: index, count: 1 });
  }
  return runs;
}

export function visibilityChanges(before: OutlineGroup[], after: OutlineGroup[]): { hide: IndexRun[]; show: IndexRun[] } {
  const was = hiddenIndexes(before);
  const now = hiddenIndexes(after);
  return {
    hide: toRuns([...now].filter((index) => !was.has(index))),
    show: toRuns([...was].filter((index) => !now.has(index))),
  };
}

export function shiftGroups(groups: OutlineGroup[], at: number, delta: number): OutlineGroup[] {
  if (delta === 0) return groups;
  if (delta > 0) {
    return groups.map((group) => ({
      ...group,
      start: group.start >= at ? group.start + delta : group.start,
      end: group.end >= at ? group.end + delta : group.end,
    }));
  }
  const removed = -delta;
  const lastRemoved = at + removed - 1;
  const moved: OutlineGroup[] = [];
  for (const group of groups) {
    const start = group.start > lastRemoved ? group.start - removed : Math.min(group.start, at);
    const end = group.end > lastRemoved ? group.end - removed : Math.min(group.end, at - 1);
    if (end >= start) moved.push({ ...group, start, end });
  }
  return sortGroups(moved.filter((group, index) => moved.findIndex((other) => other.start === group.start && other.end === group.end) === index));
}

export function shiftBreaks(breaks: number[], at: number, delta: number): number[] {
  if (delta === 0) return breaks;
  const moved = breaks
    .filter((index) => delta > 0 || index < at || index >= at - delta)
    .map((index) => (index >= at ? index + delta : index))
    .filter((index) => index > 0);
  return [...new Set(moved)].sort((a, b) => a - b);
}

export function toggleBreak(breaks: number[], index: number): number[] {
  if (index <= 0) return breaks;
  const next = breaks.includes(index) ? breaks.filter((item) => item !== index) : [...breaks, index];
  return next.sort((a, b) => a - b);
}

export function describeGroup(axis: OutlineAxis, group: OutlineGroup): string {
  if (axis === 'rows') return `hàng ${group.start + 1}–${group.end + 1}`;
  return `cột ${columnLabel(group.start)}–${columnLabel(group.end)}`;
}

export function columnLabel(index: number): string {
  let label = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}
