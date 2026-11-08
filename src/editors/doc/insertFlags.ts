export type FlagEntry = { code: string; name: string; search: string; src: string };

export const FLAG_SET_NAME = 'Cờ các nước';

const EXTRA_NAMES: Record<string, string> = {
  GB_ENG: 'Anh (England)', GB_SCT: 'Scotland', GB_WLS: 'Xứ Wales', GB_NIR: 'Bắc Ireland', ES_CT: 'Catalonia',
  BQ_BO: 'Bonaire', BQ_SA: 'Saba', BQ_SE: 'Sint Eustatius', XC: 'Bắc Síp', XO: 'Nam Ossetia',
};

const PINNED = ['VN', 'US', 'GB', 'CN', 'JP', 'KR', 'EU'];

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

const regionName = (code: string, names: Intl.DisplayNames | null) => {
  if (EXTRA_NAMES[code]) return EXTRA_NAMES[code];
  try {
    const name = names?.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
};

const englishName = (code: string, names: Intl.DisplayNames | null) => {
  try {
    return /^[A-Z]{2}$/.test(code) ? names?.of(code) ?? '' : '';
  } catch {
    return '';
  }
};

export function buildFlags(svgs: Record<string, string>): FlagEntry[] {
  const vi = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['vi'], { type: 'region' }) : null;
  const en = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
  const entries = Object.entries(svgs).flatMap(([code, svg]) => {
    const name = regionName(code, vi);
    if (!name || typeof svg !== 'string' || !svg.startsWith('<svg')) return [];
    const label = code.replace('_', '-');
    return [{ code: label, name, search: `${fold(name)} ${fold(englishName(code, en))} ${label.toLowerCase()}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }];
  });
  const rank = (code: string) => (PINNED.includes(code) ? PINNED.indexOf(code) : PINNED.length);
  return entries.sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, 'vi'));
}

let cache: Promise<FlagEntry[]> | null = null;

export const loadFlags = () => {
  cache ??= import('country-flag-icons/string/3x2').then((mod) => buildFlags(mod as unknown as Record<string, string>)).catch((error: unknown) => {
    cache = null;
    throw error;
  });
  return cache;
};

export const searchFlags = (flags: FlagEntry[], query: string) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.length ? flags.filter((flag) => words.every((word) => flag.search.includes(word))) : flags;
};
