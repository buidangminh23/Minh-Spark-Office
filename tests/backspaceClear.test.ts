import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionCoversMultipleCells } from '../src/editors/sheet/backspaceClear';

const span = (startRow: number, endRow: number, startColumn: number, endColumn: number) => ({
  startRow,
  endRow,
  startColumn,
  endColumn,
});

test('selectionCoversMultipleCells is false for no selection', () => {
  assert.equal(selectionCoversMultipleCells(undefined), false);
  assert.equal(selectionCoversMultipleCells([]), false);
});

test('selectionCoversMultipleCells is false for a single cell', () => {
  assert.equal(selectionCoversMultipleCells([{ range: span(0, 0, 0, 0), primary: { ...span(0, 0, 0, 0) } }]), false);
});

test('selectionCoversMultipleCells is true for a dragged block like A1:D6', () => {
  assert.equal(selectionCoversMultipleCells([{ range: span(0, 5, 0, 3), primary: { ...span(0, 0, 0, 0) } }]), true);
});

test('selectionCoversMultipleCells is true for a single row or column strip', () => {
  assert.equal(selectionCoversMultipleCells([{ range: span(2, 2, 0, 4) }]), true);
  assert.equal(selectionCoversMultipleCells([{ range: span(0, 9, 1, 1) }]), true);
});

test('selectionCoversMultipleCells is false when only one merged cell is selected', () => {
  const merged = span(0, 1, 0, 1);
  assert.equal(selectionCoversMultipleCells([{ range: merged, primary: { ...merged, isMerged: true } }]), false);
});

test('selectionCoversMultipleCells is true for a block larger than the merged primary cell', () => {
  assert.equal(
    selectionCoversMultipleCells([{ range: span(0, 4, 0, 3), primary: { ...span(0, 1, 0, 1), isMerged: true } }]),
    true,
  );
});

test('selectionCoversMultipleCells is true for several separate single cells', () => {
  assert.equal(selectionCoversMultipleCells([{ range: span(0, 0, 0, 0) }, { range: span(3, 3, 2, 2) }]), true);
});
