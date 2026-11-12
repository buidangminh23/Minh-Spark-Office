export type Dictionary = Record<string, string>;

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;
const PLACEHOLDER = /\{(\d+)\}/g;
const MAX_TEXT = 2000;

interface CompiledPattern {
  regex: RegExp;
  order: number[];
  english: string;
  literal: number;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilePattern(vietnamese: string, english: string): CompiledPattern | null {
  const order: number[] = [];
  let source = '';
  let last = 0;
  for (const match of vietnamese.matchAll(PLACEHOLDER)) {
    source += escapeRegex(vietnamese.slice(last, match.index));
    source += '([\\s\\S]*?)';
    order.push(Number(match[1]));
    last = (match.index ?? 0) + match[0].length;
  }
  source += escapeRegex(vietnamese.slice(last));
  const literal = vietnamese.replace(PLACEHOLDER, '').trim().length;
  if (!order.length || literal < 2) return null;
  return { regex: new RegExp(`^${source}$`), order, english, literal };
}

export const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

export function createTranslator(dictionary: Dictionary) {
  const exact = new Map<string, string>();
  const plain = new Map<string, string>();
  const patterns: CompiledPattern[] = [];
  for (const [vietnamese, english] of Object.entries(dictionary)) {
    if (!english || english === vietnamese) continue;
    if (PLACEHOLDER.test(vietnamese)) {
      PLACEHOLDER.lastIndex = 0;
      const compiled = compilePattern(vietnamese, english);
      if (compiled) patterns.push(compiled);
    } else {
      exact.set(vietnamese, english);
      if (!VIETNAMESE.test(vietnamese)) plain.set(vietnamese, english);
    }
    PLACEHOLDER.lastIndex = 0;
  }
  patterns.sort((a, b) => b.literal - a.literal);
  const cache = new Map<string, string | null>();

  const translateCore = (text: string): string | null => {
    const direct = exact.get(text);
    if (direct !== undefined) return direct;
    for (const pattern of patterns) {
      const match = pattern.regex.exec(text);
      if (!match) continue;
      return pattern.english.replace(PLACEHOLDER, (_, index: string) => {
        const position = pattern.order.indexOf(Number(index));
        const value = position >= 0 ? (match[position + 1] ?? '') : '';
        return translateCore(value) ?? value;
      });
    }
    return null;
  };

  return (raw: string): string | null => {
    if (!raw || raw.length > MAX_TEXT) return null;
    const hasVietnamese = VIETNAMESE.test(raw);
    if (!hasVietnamese && !plain.size) return null;
    const text = normalizeText(raw);
    if (!text) return null;
    let result: string | null | undefined;
    if (!hasVietnamese) {
      result = plain.get(text) ?? null;
    } else {
      result = cache.get(text);
      if (result === undefined) {
        result = translateCore(text);
        cache.set(text, result);
      }
    }
    if (result === null || result === text) return null;
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const trailing = raw.match(/\s*$/)?.[0] ?? '';
    return `${leading}${result}${trailing}`;
  };
}

export type Translate = ReturnType<typeof createTranslator>;

export const translateMultiline = (translate: Translate, text: string) =>
  translate(text) ?? text.split('\n').map((line) => translate(line) ?? line).join('\n');
