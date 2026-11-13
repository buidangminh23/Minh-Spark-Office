import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDraftText } from '../src/editors/slide/slideDraftText';
import type { SlideData } from '../src/lib/slideTypes';

const slide = {
  id: 's1',
  layout: 'title',
  background: { type: 'solid', value: '#FFFFFF' },
  elements: [
    { id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Cũ' },
    { id: 'b', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Giữ' },
  ],
} as unknown as SlideData;

test('withDraftText returns the same slide when there is no draft', () => {
  assert.equal(withDraftText(slide, null), slide);
});

test('withDraftText ignores drafts for elements on other slides', () => {
  assert.equal(withDraftText(slide, { elementId: 'zzz', text: 'x' }), slide);
});

test('withDraftText replaces only the edited element text', () => {
  const next = withDraftText(slide, { elementId: 'a', text: 'Đang gõ' });
  assert.notEqual(next, slide);
  assert.equal(next.elements[0].text, 'Đang gõ');
  assert.equal(next.elements[1], slide.elements[1]);
  assert.equal(slide.elements[0].text, 'Cũ');
});

test('withDraftText keeps identity when draft equals committed text', () => {
  assert.equal(withDraftText(slide, { elementId: 'a', text: 'Cũ' }), slide);
});
