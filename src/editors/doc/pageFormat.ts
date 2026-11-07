import type { PageNumberFormat, PageNumberPosition, PageSettings } from '../../lib/storage';

const toRoman = (value: number) => {
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = Math.max(1, Math.floor(value));
  let out = '';
  for (const [n, s] of table) while (rest >= n) { out += s; rest -= n; }
  return out;
};

export const pageNumberText = (format: PageNumberFormat | undefined, page: number, total: number) => {
  switch (format ?? 'page-of') {
    case 'plain': return String(page);
    case 'page': return `Trang ${page}`;
    case 'dash': return `– ${page} –`;
    case 'roman': return toRoman(page);
    default: return `Trang ${page} / ${total}`;
  }
};

const fillTokens = (text: string, vars: { page: number; pages: number; title: string }) => text
  .replaceAll('{page}', String(vars.page))
  .replaceAll('{pages}', String(vars.pages))
  .replaceAll('{title}', vars.title)
  .replaceAll('{date}', new Date().toLocaleDateString('vi-VN'));

const pick = (page: PageSettings, zone: 'header' | 'footer', index: number) => {
  if (page.differentFirstPage && index === 0) return (zone === 'header' ? page.headerFirst : page.footerFirst) ?? '';
  if (page.differentOddEven && index % 2 === 1) return (zone === 'header' ? page.headerEven : page.footerEven) ?? '';
  return zone === 'header' ? page.header : page.footer;
};

export type RegionZones = [string, string, string];

const PAGE_NUMBER_FIELDS: Record<PageNumberFormat, string> = { plain: '{page}', page: 'Trang {page}', dash: '– {page} –', roman: '{page}', 'page-of': 'Trang {page} / {pages}' };

export function fieldZones(page: PageSettings, zone: 'header' | 'footer', title: string): RegionZones {
  const raw = (zone === 'header' ? page.header : page.footer) ?? '';
  const parts = raw.replaceAll('{title}', title).replaceAll('{date}', new Date().toLocaleDateString('vi-VN')).split('\t');
  const zones: RegionZones = parts.length === 1 ? [parts[0], '', ''] : [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  const position: PageNumberPosition = page.pageNumberPosition ?? 'bottom-right';
  if (page.pageNumbers && position.startsWith(zone === 'header' ? 'top' : 'bottom')) {
    const slot = position.endsWith('left') ? 0 : position.endsWith('center') ? 1 : 2;
    const label = PAGE_NUMBER_FIELDS[page.pageNumberFormat ?? 'page-of'];
    zones[slot] = zones[slot] ? `${zones[slot]}  ${label}` : label;
  }
  return zones;
}

export function regionZones(page: PageSettings, zone: 'header' | 'footer', index: number, total: number, title: string): RegionZones {
  const number = (page.pageNumberStart ?? 1) + index;
  const parts = fillTokens(pick(page, zone, index) ?? '', { page: number, pages: total, title }).split('\t');
  const zones: RegionZones = parts.length === 1 ? [parts[0], '', ''] : [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  const position: PageNumberPosition = page.pageNumberPosition ?? 'bottom-right';
  const hideOnFirst = page.differentFirstPage && index === 0;
  if (page.pageNumbers && !hideOnFirst && position.startsWith(zone === 'header' ? 'top' : 'bottom')) {
    const slot = position.endsWith('left') ? 0 : position.endsWith('center') ? 1 : 2;
    const label = pageNumberText(page.pageNumberFormat, number, total);
    zones[slot] = zones[slot] ? `${zones[slot]}  ${label}` : label;
  }
  return zones;
}
