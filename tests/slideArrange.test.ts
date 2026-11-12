import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alignElements,
  applyPatch,
  canGroup,
  canUngroup,
  distributeElements,
  elementsInRect,
  expandSelection,
  groupElements,
  moveBoxes,
  ungroupElements,
} from '../src/lib/slideArrange.ts';
import { SHAPE_DEFS, getShapeDef, isLineShape, parseSimplePath, shapeFromPrst, shapesByCategory } from '../src/lib/slideShapes.ts';
import type { SlideElement } from '../src/lib/slideTypes.ts';

const box = (id: string, x: number, y: number, width = 10, height = 10, extra: Partial<SlideElement> = {}): SlideElement => ({
  id,
  type: 'shape',
  x,
  y,
  width,
  height,
  ...extra,
});

test('aligning several elements uses the selection bounds, a single element uses the slide', () => {
  const elements = [box('a', 10, 10), box('b', 40, 30, 20, 10), box('c', 70, 60)];
  const left = applyPatch(elements, alignElements(elements, ['a', 'b', 'c'], 'left'));
  assert.deepEqual(left.map((el) => el.x), [10, 10, 10]);
  const bottom = applyPatch(elements, alignElements(elements, ['a', 'b', 'c'], 'bottom'));
  assert.deepEqual(bottom.map((el) => el.y + el.height), [70, 70, 70]);
  const center = applyPatch(elements, alignElements(elements, ['a', 'c'], 'center'));
  assert.equal(center[0].x + 5, center[2].x + 5);
  assert.equal(center[1].x, 40);
  const single = applyPatch(elements, alignElements(elements, ['b'], 'center'));
  assert.equal(single[1].x, 40);
  const singleRight = applyPatch(elements, alignElements(elements, ['a'], 'right'));
  assert.equal(singleRight[0].x, 85);
});

test('distribute spaces three or more elements evenly and keeps the outer ones in place', () => {
  const elements = [box('a', 0, 0), box('b', 12, 0), box('c', 90, 0), box('d', 50, 0)];
  const spread = applyPatch(elements, distributeElements(elements, ['a', 'b', 'c', 'd'], 'horizontal'));
  const xs = spread.map((el) => el.x).sort((p, q) => p - q);
  assert.deepEqual(xs, [0, 30, 60, 90]);
  const two = [box('a', 5, 20, 20, 10), box('b', 60, 0, 20, 10)];
  const overSlide = applyPatch(two, distributeElements(two, ['a', 'b'], 'horizontal'));
  assert.deepEqual(overSlide.map((el) => el.x), [20, 60]);
  const vertical = applyPatch(elements, distributeElements([box('a', 0, 0), box('b', 0, 5), box('c', 0, 80)], ['a', 'b', 'c'], 'vertical'));
  assert.equal(vertical.length, 4);
});

test('grouped elements select, move and align as one unit', () => {
  const elements = [box('a', 10, 10), box('b', 30, 10), box('c', 70, 70)];
  assert.equal(canGroup(elements, ['a']), false);
  assert.equal(canGroup(elements, ['a', 'b']), true);
  const grouped = applyPatch(elements, groupElements(elements, ['a', 'b'], 'g1'));
  assert.equal(grouped[0].groupId, 'g1');
  assert.equal(grouped[1].groupId, 'g1');
  assert.equal(grouped[2].groupId, undefined);
  assert.deepEqual(expandSelection(grouped, ['a']), ['a', 'b']);
  assert.equal(canGroup(grouped, ['a', 'b']), false);
  assert.equal(canGroup(grouped, ['a', 'b', 'c']), true);
  assert.equal(canUngroup(grouped, ['b']), true);
  const aligned = applyPatch(grouped, alignElements(grouped, ['a', 'c'], 'right'));
  assert.equal(aligned[1].x + aligned[1].width, 80);
  assert.equal(aligned[1].x - aligned[0].x, 20);
  const ungrouped = applyPatch(grouped, ungroupElements(grouped, ['a']));
  assert.equal(ungrouped[0].groupId, undefined);
  assert.equal(ungrouped[1].groupId, undefined);
});

test('locked elements stay put, moves are clamped to the slide and the marquee picks what it touches', () => {
  const elements = [box('a', 10, 10), box('b', 60, 60, 10, 10, { locked: true })];
  const patch = alignElements(elements, ['a', 'b'], 'left');
  assert.equal(patch.b, undefined);
  const moved = moveBoxes({ a: elements[0], b: elements[1] }, 80, -50);
  assert.equal(moved.b.x, 90);
  assert.equal(moved.a.x, 40);
  assert.equal(moved.a.y, 0);
  assert.equal(moved.b.y, 50);
  assert.deepEqual(elementsInRect(elements, { x: 0, y: 0, width: 15, height: 15 }), ['a']);
  assert.deepEqual(elementsInRect(elements, { x: 0, y: 0, width: 65, height: 65 }), ['a', 'b']);
  assert.deepEqual(elementsInRect(elements, { x: 30, y: 30, width: 5, height: 5 }), []);
});

test('the shape catalogue has unique ids, valid paths and a preset name for every shape', () => {
  assert.ok(SHAPE_DEFS.length >= 100);
  assert.equal(new Set(SHAPE_DEFS.map((shape) => shape.id)).size, SHAPE_DEFS.length);
  for (const shape of SHAPE_DEFS) {
    assert.ok(shape.label.length > 0, shape.id);
    assert.ok(shape.prst.length > 0, shape.id);
    assert.match(shape.d, /^M[-\d. ]/, shape.id);
    assert.ok(!/NaN|undefined|Infinity/.test(shape.d), shape.id);
    const numbers = (shape.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    assert.ok(numbers.every((value) => value >= -0.01 && value <= 100.01), `${shape.id} stays inside the 0..100 box`);
  }
  assert.equal(shapesByCategory().reduce((sum, group) => sum + group.shapes.length, 0), SHAPE_DEFS.length);
  for (const legacy of ['rectangle', 'rounded-rectangle', 'circle', 'triangle', 'right-arrow', 'left-arrow', 'up-arrow', 'down-arrow', 'star', 'callout', 'heart', 'diamond', 'hexagon', 'line']) {
    assert.equal(getShapeDef(legacy).id, legacy);
  }
  assert.equal(getShapeDef('missing-shape').id, 'rectangle');
  assert.equal(isLineShape('arrow-line'), true);
  assert.equal(isLineShape('up-arrow'), false);
  assert.equal(shapeFromPrst('ellipse'), 'circle');
  assert.equal(shapeFromPrst('flowChartDecision'), 'flow-decision');
  assert.equal(shapeFromPrst('straightConnector1'), 'line');
  assert.equal(shapeFromPrst('somethingNew'), 'rectangle');
  assert.deepEqual(parseSimplePath('M0 0L10 5C1 2 3 4 5 6Z'), [
    { type: 'M', points: [0, 0] },
    { type: 'L', points: [10, 5] },
    { type: 'C', points: [1, 2, 3, 4, 5, 6] },
    { type: 'Z', points: [] },
  ]);
});
