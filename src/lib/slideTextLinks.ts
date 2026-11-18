import type { SlideTextLink } from './slideTypes';

export function safeSlideLinkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^(https?:\/\/|mailto:|tel:)/i.test(value)) return;
  try {
    const url = new URL(value);
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return value;
  } catch {
    return;
  }
}

export function slideTextSegments(text: string, start: number, end: number, links?: SlideTextLink[]) {
  const segments: { text: string; link?: SlideTextLink }[] = [];
  let cursor = start;
  for (const link of links ?? []) {
    if (!link?.text || !Number.isInteger(link.start) || link.start < 0 || !text.startsWith(link.text, link.start)) continue;
    if (!safeSlideLinkUrl(link.url) && !link.slideId) continue;
    const from = Math.max(link.start, start);
    const to = Math.min(link.start + link.text.length, end);
    if (to <= from || from < cursor) continue;
    if (cursor < from) segments.push({ text: text.slice(cursor, from) });
    segments.push({ text: text.slice(from, to), link });
    cursor = to;
  }
  if (cursor < end || !segments.length) segments.push({ text: text.slice(cursor, end) });
  return segments;
}

export function updateTextLinks(before: string, after: string, links: SlideTextLink[]) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(before.length, after.length) - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const delta = after.length - before.length;
  return links.flatMap((link) => {
    const end = link.start + link.text.length;
    if (end <= prefix) return [link];
    if (link.start >= before.length - suffix) return [{ ...link, start: link.start + delta }];
    if (prefix >= link.start && before.length - suffix <= end && end + delta > link.start) {
      return [{ ...link, text: after.slice(link.start, end + delta) }];
    }
    return [];
  });
}
