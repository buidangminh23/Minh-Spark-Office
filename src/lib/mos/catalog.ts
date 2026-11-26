import bundled from './catalog-v1.json';
import { EXCEL_SEEDS } from './excelExamBank';
import { PPT_SEEDS } from './pptExamBank';
import { WORD_SCENARIO_SEEDS } from './wordExamBank';
import type { MosTrackId, MosVersion } from './types';

type SuiteTitle = { vi: string; en: string; subVi: string; subEn: string };
type TextOverride = Partial<Record<'title' | 'titleEn' | 'scenario' | 'scenarioEn' | 'instruction' | 'instructionEn' | 'hint' | 'ribbonPath', string>>;
export type MosCatalog = {
  schema: number;
  exams: number[];
  titles: Record<MosTrackId, Record<MosVersion, Record<number, SuiteTitle>>>;
  seeds: { word: typeof WORD_SCENARIO_SEEDS; excel: typeof EXCEL_SEEDS; powerpoint: typeof PPT_SEEDS };
  assignments: Record<string, string>;
  overrides: Record<string, TextOverride>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validValue(value: unknown, example: unknown): boolean {
  if (typeof example === 'string') return typeof value === 'string' && value.trim().length > 0 && value.length <= 16000;
  if (typeof example === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (!Array.isArray(example) || !Array.isArray(value)) return false;
  if (Array.isArray(example[0])) {
    return value.length > 0 && value.length <= 128 && value.every(row => validValue(row, example[0]));
  }
  return value.length === example.length && example.every((item, index) => validValue(value[index], item));
}

function validSeed(value: unknown, sample: Record<string, unknown>): boolean {
  if (!record(value) || !Object.entries(sample).every(([key, example]) => validValue(value[key], example))) return false;
  if (typeof value.fileName !== 'string' || /[\\/]/.test(value.fileName)) return false;
  if (Array.isArray(value.rows) && value.rows.length !== 6) return false;
  for (const key of ['portalUrl', 'linkUrl']) {
    if (key in sample && !(typeof value[key] === 'string' && /^https:\/\//i.test(value[key]))) return false;
  }
  return true;
}

export function parseMosCatalog(raw: unknown): MosCatalog {
  const invalid = () => new Error('Invalid MOS v1 catalog');
  if (!record(raw) || raw.schema !== 1 || !record(raw.seeds) || !record(raw.titles) || !record(raw.overrides) || !record(raw.assignments)) throw invalid();
  const exams = raw.exams;
  if (!Array.isArray(exams) || exams.length === 0 || exams.length > 100 || exams[0] !== 1 ||
      !exams.every((n, i) => Number.isSafeInteger(n) && n > 0 && n <= 999 && (i === 0 || n > exams[i - 1]))) throw invalid();
  for (const track of ['word', 'excel', 'powerpoint'] as const) {
    const seeds = raw.seeds[track];
    const titles = raw.titles[track];
    if (!Array.isArray(seeds) || seeds.length < 7 || seeds.length > 512 || !record(titles)) throw invalid();
    if (!seeds.every(seed => validSeed(seed, bundled.seeds[track][0])) ||
        new Set(seeds.map(seed => seed.slug)).size !== seeds.length) throw invalid();
    const slugs = new Set(seeds.map(seed => seed.slug));
    const prefix = track === 'powerpoint' ? 'ppt' : track;
    for (const [id, slug] of Object.entries(raw.assignments)) {
      if (id.startsWith(prefix + '-') && !slugs.has(slug)) throw invalid();
    }
    for (const version of ['2016', '2019', '365'] as const) {
      const versionTitles = titles[version];
      if (!record(versionTitles) || !exams.every(n => {
        const title = versionTitles[n];
        return record(title) && ['vi', 'en', 'subVi', 'subEn'].every(k => validValue(title[k], ''));
      })) throw invalid();
    }
  }
  const allowed = ['title', 'titleEn', 'scenario', 'scenarioEn', 'instruction', 'instructionEn', 'hint', 'ribbonPath'];
  for (const [id, fields] of Object.entries(raw.overrides)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !record(fields) ||
        !Object.entries(fields).every(([k,v]) => allowed.includes(k) && validValue(v, ''))) throw invalid();
  }
  return raw as MosCatalog;
}
