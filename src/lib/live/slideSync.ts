import type { SlideContent } from '../storage';
import type { PresentationData, SlideData, SlideElement } from '../slideTypes';
import { parseJson, type FlatState } from './flatSync';

export const SLIDE_MAP = 'slideState';

type SlideBase = Omit<SlideData, 'elements'> & { elementOrder: string[] };

export function flattenPresentation(content: SlideContent): FlatState {
  const state: FlatState = new Map();
  const { slides, ...deck } = content.presentation;
  state.set('deck', JSON.stringify(deck));
  state.set('order', JSON.stringify(slides.map((slide) => slide.id)));
  state.set('comments', JSON.stringify(content.comments ?? []));
  for (const slide of slides) {
    const { elements, ...rest } = slide;
    const base: SlideBase = { ...rest, elementOrder: elements.map((element) => element.id) };
    state.set(`s:${slide.id}`, JSON.stringify(base));
    for (const element of elements) state.set(`e:${slide.id}:${element.id}`, JSON.stringify(element));
  }
  return state;
}

export function unflattenPresentation(state: FlatState): SlideContent | null {
  const deck = parseJson<Omit<PresentationData, 'slides'>>(state.get('deck'));
  const order = parseJson<string[]>(state.get('order'));
  if (!deck || !order) return null;
  const bases = new Map<string, SlideBase>();
  const elements = new Map<string, Map<string, SlideElement>>();
  state.forEach((value, key) => {
    if (key.startsWith('s:')) {
      const base = parseJson<SlideBase>(value);
      if (base) bases.set(key.slice(2), base);
    } else if (key.startsWith('e:')) {
      const split = key.indexOf(':', 2);
      const element = parseJson<SlideElement>(value);
      if (split < 0 || !element) return;
      const slideId = key.slice(2, split);
      if (!elements.has(slideId)) elements.set(slideId, new Map());
      elements.get(slideId)!.set(key.slice(split + 1), element);
    }
  });
  const slideIds = order.filter((id) => bases.has(id));
  for (const id of bases.keys()) if (!slideIds.includes(id)) slideIds.push(id);
  const slides = slideIds.map((id) => {
    const { elementOrder, ...base } = bases.get(id)!;
    const pool = elements.get(id) ?? new Map<string, SlideElement>();
    const ordered = (elementOrder ?? []).filter((elementId) => pool.has(elementId));
    for (const elementId of pool.keys()) if (!ordered.includes(elementId)) ordered.push(elementId);
    return { ...base, elements: ordered.map((elementId) => pool.get(elementId)!) } as SlideData;
  });
  if (!slides.length) return null;
  return { kind: 'slide', presentation: { ...deck, slides }, comments: parseJson(state.get('comments')) ?? [] };
}
