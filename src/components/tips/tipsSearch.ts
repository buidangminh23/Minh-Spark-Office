import type { Tip, TipSection } from './tipsContent';

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const tipText = (tip: Tip) => fold(`${tip.title} ${tip.body} ${(tip.keys ?? []).map((combo) => combo.join(' ')).join(' ')}`);

export function filterSections(sections: TipSection[], query: string): TipSection[] {
  const needle = fold(query.trim());
  if (!needle) return sections;
  return sections
    .map((section) => ({ ...section, tips: section.tips.filter((tip) => tipText(tip).includes(needle) || fold(section.title).includes(needle)) }))
    .filter((section) => section.tips.length > 0);
}
