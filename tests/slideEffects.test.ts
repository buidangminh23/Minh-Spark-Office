import assert from 'node:assert/strict';
import test from 'node:test';
import type { ElementAnimation, SlideElement } from '../src/lib/slideTypes';
import {
  ANIMATION_DEFS,
  TRANSITION_DEFS,
  buildAnimationPlan,
  buildAnimationTimeline,
  buildTransitionPlan,
  collectSlideAnimations,
  countClickSteps,
  elementAnimations,
  getAnimationDef,
  hiddenElementIds,
  matchMorphElements,
  playedItems,
  transitionDurationOf,
} from '../src/lib/slideEffects';

const CONTEXT = { slideW: 960, slideH: 540, x: 240, y: 135, w: 480, h: 270 };

const LEGACY_ANIMATION_TYPES = [
  'appear', 'fade-in', 'fly-in', 'float-in', 'split-in', 'wipe-in', 'zoom-in', 'bounce-in', 'swivel-in', 'wheel-in',
  'grow-turn', 'pulse', 'spin', 'teeter', 'grow-shrink', 'color-pulse', 'wave', 'darken', 'lighten', 'disappear',
  'fade-out', 'fly-out', 'float-out', 'split-out', 'wipe-out', 'zoom-out', 'bounce-out', 'swivel-out',
  'path-line-down', 'path-line-up', 'path-line-left', 'path-line-right', 'path-arc', 'path-turn', 'path-circle',
  'path-loop', 'path-custom',
];

const LEGACY_TRANSITION_TYPES = [
  'morph', 'fade', 'push', 'wipe', 'split', 'reveal', 'cut', 'random-bars', 'uncover', 'cover', 'flip', 'cube',
  'doors', 'box', 'zoom', 'conveyor', 'rotate', 'vortex', 'ripple', 'honeycomb', 'fracture', 'pan', 'ferris',
  'carousel', 'gallery',
];

function animation(id: string, overrides: Partial<ElementAnimation> = {}): ElementAnimation {
  return {
    id,
    type: 'fade-in',
    category: 'entrance',
    duration: 1,
    delay: 0,
    trigger: 'on-click',
    order: 1,
    ...overrides,
  };
}

function element(id: string, animations: ElementAnimation[], overrides: Partial<SlideElement> = {}): SlideElement {
  return { id, type: 'text', x: 10, y: 10, width: 30, height: 20, text: id, animations, ...overrides };
}

test('every animation in the catalogue produces playable keyframes', () => {
  const types = ANIMATION_DEFS.map((def) => def.type);
  assert.equal(new Set(types).size, types.length);
  for (const def of ANIMATION_DEFS) {
    const plan = buildAnimationPlan({ type: def.type, direction: undefined }, CONTEXT);
    assert.ok(plan, `no plan for ${def.type}`);
    assert.ok(plan.frames.length >= 2, `${def.type} needs at least two keyframes`);
    for (const frame of plan.frames) {
      for (const [key, value] of Object.entries(frame)) {
        assert.ok(!String(value).includes('NaN'), `${def.type} has NaN in ${key}`);
      }
    }
  }
});

test('the catalogue covers the four PowerPoint groups', () => {
  const count = (category: string) => ANIMATION_DEFS.filter((def) => def.category === category).length;
  assert.equal(count('entrance'), 39);
  assert.equal(count('exit'), 39);
  assert.equal(count('emphasis'), 24);
  assert.ok(count('motion-path') >= 60);
});

test('animations saved by older versions still resolve', () => {
  for (const type of LEGACY_ANIMATION_TYPES) {
    assert.ok(getAnimationDef(type), `missing ${type}`);
    assert.ok(buildAnimationPlan({ type }, CONTEXT), `no plan for ${type}`);
  }
  assert.ok(buildAnimationPlan({ type: 'fly-in-left' }, CONTEXT));
  assert.ok(buildAnimationPlan({ type: 'bounce' }, CONTEXT));
});

test('an exit plays its entrance backwards', () => {
  const entrance = buildAnimationPlan({ type: 'wipe-in', direction: 'left' }, CONTEXT);
  const exit = buildAnimationPlan({ type: 'wipe-out', direction: 'left' }, CONTEXT);
  assert.deepEqual(exit?.frames, [...(entrance?.frames ?? [])].reverse());
});

test('direction changes where a fly-in starts', () => {
  const fromLeft = buildAnimationPlan({ type: 'fly-in', direction: 'left' }, CONTEXT);
  const fromBottom = buildAnimationPlan({ type: 'fly-in', direction: 'bottom' }, CONTEXT);
  assert.equal(fromLeft?.frames[0].translate, '-720px 0px');
  assert.equal(fromBottom?.frames[0].translate, '0px 405px');
});

test('closed motion paths return to their start and open ones stay put', () => {
  const closed = buildAnimationPlan({ type: 'path-circle' }, CONTEXT);
  const open = buildAnimationPlan({ type: 'path-line-right' }, CONTEXT);
  assert.equal(closed?.frames[0].translate, '0px 0px');
  assert.equal(closed?.frames.at(-1)?.translate, '0px 0px');
  assert.equal(open?.frames.at(-1)?.translate, '162px 0px');
  assert.equal(open?.persist, true);
});

test('every transition in the catalogue produces keyframes for at least one layer', () => {
  const types = TRANSITION_DEFS.map((def) => def.type);
  assert.equal(new Set(types).size, types.length);
  for (const type of LEGACY_TRANSITION_TYPES) assert.ok(types.includes(type), `missing ${type}`);
  for (const def of TRANSITION_DEFS) {
    if (def.type === 'none') {
      assert.equal(buildTransitionPlan({ type: 'none' }), null);
      continue;
    }
    const plan = buildTransitionPlan({ type: def.type as never }, () => 0.5);
    assert.ok(plan, `no plan for ${def.type}`);
    assert.ok(plan.incoming.length + plan.outgoing.length >= 2, `${def.type} animates nothing`);
    assert.ok(transitionDurationOf({ type: def.type as never, duration: 0 }) > 0);
  }
});

test('the timeline groups animations into click steps', () => {
  const elements = [
    element('a', [animation('a1', { order: 1, trigger: 'with-previous' })]),
    element('b', [animation('b1', { order: 2 }), animation('b2', { order: 3, trigger: 'after-previous', delay: 0.5 })]),
    element('c', [animation('c1', { order: 4, trigger: 'with-previous', delay: 0.25 })]),
    element('d', [animation('d1', { order: 5, category: 'exit', type: 'fade-out' })]),
  ];
  const steps = buildAnimationTimeline(elements);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].auto, true);
  assert.deepEqual(steps[0].items.map((item) => item.anim.id), ['a1']);
  assert.deepEqual(
    steps[1].items.map((item) => [item.anim.id, item.start, item.end]),
    [['b1', 0, 1], ['b2', 1.5, 2.5], ['c1', 1.25, 2.25]]
  );
  assert.equal(steps[1].duration, 2.5);
  assert.equal(countClickSteps(steps), 2);
});

test('repeat and auto-reverse lengthen an animation', () => {
  const steps = buildAnimationTimeline([element('a', [animation('a1', { repeat: 3, autoReverse: true })])]);
  assert.equal(steps[1].items[0].end, 6);
});

test('elements stay hidden until they enter and hide again after they exit', () => {
  const elements = [
    element('a', [animation('in', { order: 1 }), animation('out', { order: 3, category: 'exit', type: 'fade-out' })]),
    element('b', [animation('b-out', { order: 2, category: 'exit', type: 'fly-out' })]),
    element('c', [animation('c-pulse', { order: 4, category: 'emphasis', type: 'pulse' })]),
  ];
  const steps = buildAnimationTimeline(elements);
  assert.deepEqual(hiddenElementIds(steps, 0, true), ['a']);
  assert.deepEqual(hiddenElementIds(steps, 1, true), []);
  assert.deepEqual(hiddenElementIds(steps, 2, true), ['b']);
  assert.deepEqual(hiddenElementIds(steps, 3, true).sort(), ['a', 'b']);
  assert.equal(playedItems(steps, 2, true).length, 2);
});

test('an auto-start entrance stays hidden until the slide transition ends', () => {
  const steps = buildAnimationTimeline([element('a', [animation('a1', { trigger: 'after-previous' })])]);
  assert.deepEqual(hiddenElementIds(steps, 0, false), ['a']);
  assert.deepEqual(hiddenElementIds(steps, 0, true), []);
});

test('a single legacy animation is read like a list of one', () => {
  const legacy: SlideElement = {
    id: 'legacy',
    type: 'text',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    animation: { type: 'fly-out', duration: 0.7, delay: 0 },
  };
  const [anim] = elementAnimations(legacy);
  assert.equal(anim.category, 'exit');
  assert.equal(anim.duration, 0.7);
  assert.equal(collectSlideAnimations([legacy]).length, 1);
});

test('morph pairs elements by id first and by content second', () => {
  const from = [
    element('same', [], { x: 5 }),
    element('old-id', [], { text: 'Tiêu đề', x: 40, rotation: 30 }),
  ];
  const to = [
    element('same', [], { x: 60 }),
    element('new-id', [], { text: 'Tiêu đề', x: 70 }),
    element('fresh', [], { text: 'Chỉ có ở trang sau' }),
  ];
  const matches = matchMorphElements(from, to);
  assert.equal(matches.same.x, 5);
  assert.equal(matches['new-id'].x, 40);
  assert.equal(matches['new-id'].rotation, 30);
  assert.equal(matches.fresh, undefined);
});
