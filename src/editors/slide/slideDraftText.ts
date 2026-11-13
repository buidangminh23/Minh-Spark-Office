import { useSyncExternalStore } from 'react';
import type { SlideData } from '../../lib/slideTypes';

export type SlideDraftText = { elementId: string; text: string };

let draft: SlideDraftText | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setSlideDraftText(elementId: string, text: string) {
  if (draft?.elementId === elementId && draft.text === text) return;
  draft = { elementId, text };
  emit();
}

export function clearSlideDraftText(elementId?: string) {
  if (!draft || (elementId && draft.elementId !== elementId)) return;
  draft = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => draft;

export function useSlideDraftText() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function withDraftText(slide: SlideData, current: SlideDraftText | null): SlideData {
  if (!current) return slide;
  const target = slide.elements.find((el) => el.id === current.elementId);
  if (!target || target.text === current.text) return slide;
  return { ...slide, elements: slide.elements.map((el) => (el === target ? { ...el, text: current.text } : el)) };
}
