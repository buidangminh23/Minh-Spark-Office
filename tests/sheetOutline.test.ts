import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_OUTLINE_LEVEL,
  addGroup,
  collapseToLevel,
  columnLabel,
  describeGroup,
  hiddenIndexes,
  innermostGroup,
  levelAt,
  maxLevel,
  removeGroup,
  setCollapsed,
  shiftBreaks,
  shiftGroups,
  toRuns,
  toggleBreak,
  visibilityChanges,
  type OutlineGroup,
} from '../src/editors/sheet/sheetOutline';

const group = (start: number, end: number, collapsed = false): OutlineGroup => ({ start, end, collapsed });

test('addGroup nests groups and refuses duplicates and crossing ranges', () => {
  const outer = addGroup([], 2, 9)!;
  const nested = addGroup(outer, 4, 6)!;
  assert.deepEqual(nested, [group(2, 9), group(4, 6)]);
  assert.equal(addGroup(nested, 4, 6), null);
  assert.equal(addGroup(nested, 5, 12), null);
  assert.equal(levelAt(nested, 5), 2);
  assert.equal(levelAt(nested, 8), 1);
  assert.equal(levelAt(nested, 20), 0);
  assert.equal(maxLevel(nested), 2);
});

test('addGroup stops at eight levels like Excel', () => {
  let groups: OutlineGroup[] = [];
  for (let level = 0; level < MAX_OUTLINE_LEVEL; level++) groups = addGroup(groups, level, 40 - level)!;
  assert.equal(maxLevel(groups), MAX_OUTLINE_LEVEL);
  assert.equal(addGroup(groups, 10, 20), null);
});

test('removeGroup takes the innermost group around the selection', () => {
  const groups = [group(2, 9), group(4, 6)];
  assert.deepEqual(removeGroup(groups, 5, 5), [group(2, 9)]);
  assert.deepEqual(removeGroup(groups, 8, 8), [group(4, 6)]);
  assert.equal(removeGroup(groups, 30, 31), null);
  assert.equal(innermostGroup(groups, 5, 5)?.start, 4);
});

test('collapsing hides rows and reports only what changed', () => {
  const groups = [group(2, 9), group(4, 6)];
  const inner = setCollapsed(groups, groups[1], true);
  assert.deepEqual([...hiddenIndexes(inner)], [4, 5, 6]);
  assert.deepEqual(visibilityChanges(groups, inner), { hide: [{ start: 4, count: 3 }], show: [] });
  const both = setCollapsed(inner, inner[0], true);
  assert.deepEqual(visibilityChanges(inner, both).hide, [{ start: 2, count: 2 }, { start: 7, count: 3 }]);
  const outerOpen = setCollapsed(both, both[0], false);
  assert.deepEqual(visibilityChanges(both, outerOpen).show, [{ start: 2, count: 2 }, { start: 7, count: 3 }]);
});

test('collapseToLevel shows only the chosen number of levels', () => {
  const groups = [group(2, 9), group(4, 6)];
  assert.deepEqual(collapseToLevel(groups, 1).map((item) => item.collapsed), [true, true]);
  assert.deepEqual(collapseToLevel(groups, 2).map((item) => item.collapsed), [false, true]);
  assert.deepEqual(collapseToLevel(groups, 3).map((item) => item.collapsed), [false, false]);
});

test('groups and breaks follow inserted and deleted rows', () => {
  const groups = [group(2, 9), group(4, 6)];
  assert.deepEqual(shiftGroups(groups, 3, 2), [group(2, 11), group(6, 8)]);
  assert.deepEqual(shiftGroups(groups, 0, -1), [group(1, 8), group(3, 5)]);
  assert.deepEqual(shiftGroups(groups, 4, -3), [group(2, 6)]);
  assert.deepEqual(shiftGroups(groups, 2, -8), []);
  assert.deepEqual(shiftBreaks([5, 10], 6, 2), [5, 12]);
  assert.deepEqual(shiftBreaks([5, 10], 4, -3), [7]);
  assert.deepEqual(shiftBreaks([5, 10], 0, -1), [4, 9]);
});

test('page breaks toggle and ignore the first row', () => {
  assert.deepEqual(toggleBreak([10], 5), [5, 10]);
  assert.deepEqual(toggleBreak([5, 10], 5), [10]);
  assert.deepEqual(toggleBreak([5], 0), [5]);
});

test('labels', () => {
  assert.deepEqual(toRuns([7, 1, 2, 3, 9, 8]), [{ start: 1, count: 3 }, { start: 7, count: 3 }]);
  assert.equal(columnLabel(0), 'A');
  assert.equal(columnLabel(27), 'AB');
  assert.equal(describeGroup('rows', group(2, 9)), 'hàng 3–10');
  assert.equal(describeGroup('cols', group(1, 3)), 'cột B–D');
});
