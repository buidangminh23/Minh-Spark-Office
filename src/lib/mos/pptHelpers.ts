import type { SlideData, SlideElement } from '../slideTypes';

export function foldSlide(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function slideText(slide: SlideData): string {
  return slide.elements.map((el) => el.text ?? '').join(' ');
}

export function countAnimations(elements: SlideElement[]): number {
  return elements.reduce((sum, el) => {
    const multi = (el.animations ?? []).filter((a) => a.type !== 'none').length;
    if (multi > 0) return sum + multi;
    return sum + (el.animation && el.animation.type !== 'none' ? 1 : 0);
  }, 0);
}

export function hasAnyLink(slides: SlideData[]): boolean {
  return slides.some((s) => s.elements.some((el) => Boolean(el.link) || Boolean(el.textLinks && el.textLinks.length > 0)));
}

export function baseSlide(id: string, layout: SlideData['layout'], title: string, body?: string): SlideData {
  const elements: SlideElement[] = [
    {
      id: `${id}-title`,
      type: 'text',
      x: 8,
      y: layout === 'title' ? 30 : 8,
      width: 84,
      height: layout === 'title' ? 22 : 14,
      text: title,
      fontSize: layout === 'title' ? 42 : 30,
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      fontWeight: 'bold',
      color: '#1E293B',
      textAlign: layout === 'title' ? 'center' : 'left',
      isTitle: true,
    },
  ];
  if (body) {
    elements.push({
      id: `${id}-body`,
      type: 'text',
      x: 8,
      y: layout === 'title' ? 56 : 26,
      width: 84,
      height: layout === 'title' ? 18 : 60,
      text: body,
      fontSize: 20,
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      color: '#475569',
      textAlign: layout === 'title' ? 'center' : 'left',
      lineHeight: 1.55,
    });
  }
  return {
    id,
    layout,
    background: { type: 'solid', value: '#FFFFFF' },
    elements,
    notes: '',
    transition: { type: 'none', duration: 0.5 },
    hidden: false,
    comments: [],
  };
}
