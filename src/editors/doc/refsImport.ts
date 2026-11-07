import type { CitationSource } from '../../lib/storage';

type ParsedSource = Omit<CitationSource, 'id'>;

const cleanBibValue = (value: string) => value.replace(/[{}]/g, '').replace(/\\&/g, '&').replace(/\s+/g, ' ').trim();

const readBibValue = (text: string, start: number) => {
  let i = start;
  while (i < text.length && /\s/.test(text[i])) i++;
  const open = text[i];
  if (open === '{') {
    let depth = 0;
    let j = i;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return { value: text.slice(i + 1, j), end: j + 1 };
  }
  if (open === '"') {
    let j = i + 1;
    let depth = 0;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      else if (text[j] === '"' && depth === 0) break;
    }
    return { value: text.slice(i + 1, j), end: j + 1 };
  }
  let j = i;
  while (j < text.length && !/[,}\n]/.test(text[j])) j++;
  return { value: text.slice(i, j).trim(), end: j };
};

const bibType = (kind: string): CitationSource['type'] => {
  if (/book|inbook|incollection/.test(kind)) return 'book';
  if (/article|inproceedings|conference/.test(kind)) return 'article';
  if (/online|misc|electronic|www/.test(kind)) return 'web';
  if (/report|techreport|thesis/.test(kind)) return 'report';
  return 'other';
};

export function parseBibtex(text: string): ParsedSource[] {
  const list: ParsedSource[] = [];
  const entry = /@(\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = entry.exec(text))) {
    const kind = match[1].toLowerCase();
    if (kind === 'comment' || kind === 'string' || kind === 'preamble') continue;
    let i = match.index + match[0].length;
    const comma = text.indexOf(',', i);
    if (comma < 0) break;
    i = comma + 1;
    const fields: Record<string, string> = {};
    while (i < text.length) {
      while (i < text.length && /[\s,]/.test(text[i])) i++;
      if (text[i] === '}' || i >= text.length) break;
      const equal = text.indexOf('=', i);
      if (equal < 0) break;
      const name = text.slice(i, equal).trim().toLowerCase();
      const read = readBibValue(text, equal + 1);
      fields[name] = cleanBibValue(read.value);
      i = read.end;
    }
    entry.lastIndex = i;
    if (!fields.title) continue;
    list.push({
      type: bibType(kind),
      authors: (fields.author ?? fields.editor ?? '').split(/\s+and\s+/i).filter(Boolean).join('; '),
      title: fields.title,
      year: fields.year ?? (fields.date ?? '').slice(0, 4),
      publisher: fields.publisher ?? fields.journal ?? fields.booktitle ?? fields.institution ?? '',
      url: fields.url ?? (fields.doi ? `https://doi.org/${fields.doi}` : ''),
      pages: fields.pages?.replace(/--/g, '-') ?? '',
    });
  }
  return list;
}

const risType = (kind: string): CitationSource['type'] => {
  if (['BOOK', 'CHAP', 'EBOOK', 'ECHAP'].includes(kind)) return 'book';
  if (['JOUR', 'JFULL', 'CONF', 'CPAPER', 'MGZN', 'NEWS'].includes(kind)) return 'article';
  if (['ELEC', 'WEB', 'BLOG'].includes(kind)) return 'web';
  if (['RPRT', 'THES', 'STAND'].includes(kind)) return 'report';
  return 'other';
};

export function parseRis(text: string): ParsedSource[] {
  const list: ParsedSource[] = [];
  let current: Record<string, string[]> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/.exec(raw.trimEnd());
    if (!match) continue;
    const [, tag, value] = match;
    if (tag === 'TY') {
      current = { TY: [value.trim()] };
      continue;
    }
    if (!current) continue;
    if (tag === 'ER') {
      const first = (...tags: string[]) => tags.map((t) => current?.[t]?.[0]).find(Boolean) ?? '';
      const title = first('TI', 'T1', 'CT', 'BT');
      if (title) {
        const startPage = first('SP');
        const endPage = first('EP');
        list.push({
          type: risType(first('TY')),
          authors: [...(current.AU ?? []), ...(current.A1 ?? [])].join('; '),
          title,
          year: first('PY', 'Y1', 'DA').slice(0, 4),
          publisher: first('PB', 'JO', 'JF', 'T2'),
          url: first('UR') || (first('DO') ? `https://doi.org/${first('DO')}` : ''),
          pages: startPage && endPage ? `${startPage}-${endPage}` : startPage,
        });
      }
      current = null;
      continue;
    }
    (current[tag] ??= []).push(value.trim());
  }
  return list;
}

const BIB_KIND: Record<CitationSource['type'], string> = { book: 'book', article: 'article', web: 'online', report: 'techreport', other: 'misc' };

export function exportBibtex(sources: CitationSource[]) {
  return sources.map((source, index) => {
    const fields = [
      ['title', source.title],
      ['author', source.authors.split(';').map((a) => a.trim()).filter(Boolean).join(' and ')],
      ['year', source.year],
      ['publisher', source.publisher],
      ['pages', source.pages],
      ['url', source.url],
    ].filter(([, value]) => value);
    return `@${BIB_KIND[source.type]}{ref${index + 1},\n${fields.map(([name, value]) => `  ${name} = {${value}}`).join(',\n')}\n}`;
  }).join('\n\n');
}

export function parseSourcesFile(name: string, text: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ris')) return parseRis(text);
  if (lower.endsWith('.bib') || lower.endsWith('.bibtex')) return parseBibtex(text);
  return /^TY\s+-/m.test(text) ? parseRis(text) : parseBibtex(text);
}
