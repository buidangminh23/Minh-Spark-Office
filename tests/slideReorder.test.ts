import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edgeScrollStep, finalSlideIndex, insertionIndex } from '../src/editors/slide/slideReorder';

const MIDPOINTS = [50, 150, 250, 350];

test('insertionIndex counts the slides whose middle is above the pointer', () => {
  assert.equal(insertionIndex(MIDPOINTS, 10), 0);
  assert.equal(insertionIndex(MIDPOINTS, 120), 1);
  assert.equal(insertionIndex(MIDPOINTS, 260), 3);
  assert.equal(insertionIndex(MIDPOINTS, 999), 4);
});

test('finalSlideIndex removes the dragged slide before inserting it', () => {
  assert.equal(finalSlideIndex(0, 0), 0);
  assert.equal(finalSlideIndex(0, 1), 0);
  assert.equal(finalSlideIndex(0, 2), 1);
  assert.equal(finalSlideIndex(0, 4), 3);
  assert.equal(finalSlideIndex(3, 0), 0);
  assert.equal(finalSlideIndex(3, 3), 3);
  assert.equal(finalSlideIndex(3, 4), 3);
});

test('edgeScrollStep scrolls only near the list edges and grows toward them', () => {
  assert.equal(edgeScrollStep(300, 0, 600, 40, 14), 0);
  assert.ok(edgeScrollStep(5, 0, 600, 40, 14) < 0);
  assert.ok(edgeScrollStep(595, 0, 600, 40, 14) > 0);
  assert.ok(edgeScrollStep(0, 0, 600, 40, 14) <= edgeScrollStep(30, 0, 600, 40, 14));
  assert.equal(edgeScrollStep(-50, 0, 600, 40, 14), -14);
});
