const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const splitRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

export function renderMarkdown(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) body.push(lines[index++]);
      index += 1;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (isTableRow(line) && index + 1 < lines.length && isSeparator(lines[index + 1])) {
      const head = splitRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index])) rows.push(splitRow(lines[index++]));
      out.push(`<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^#{1,4}\s/.test(lines[index]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index]) && !(isTableRow(lines[index]) && isSeparator(lines[index + 1] ?? ''))) paragraph.push(lines[index++]);
    out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

const stripCell = (cell: string) => cell.replace(/^\*\*(.*)\*\*$/, '$1').replace(/^`(.*)`$/, '$1').trim();

export function extractTable(text: string): string[][] | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (!isTableRow(lines[index]) || !isSeparator(lines[index + 1])) continue;
    const rows = [splitRow(lines[index]).map(stripCell)];
    let cursor = index + 2;
    while (cursor < lines.length && isTableRow(lines[cursor])) rows.push(splitRow(lines[cursor++]).map(stripCell));
    return rows;
  }
  const fence = /```[a-z]*\n([\s\S]*?)```/i.exec(text);
  if (fence) {
    const body = fence[1].trim().split('\n').filter(Boolean);
    const separator = body.every((row) => row.includes('\t')) ? '\t' : body.every((row) => row.includes(',')) ? ',' : null;
    if (separator && body.length > 0) return body.map((row) => row.split(separator).map((cell) => cell.trim()));
  }
  return null;
}

export function extractFormula(text: string): string | null {
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^`+|`+$/g, '').trim();
    if (/^=[A-Za-z0-9_(]/.test(line)) return line;
  }
  return null;
}

export function toCellValue(cell: string): string | number {
  const trimmed = cell.trim();
  if (trimmed.startsWith('=')) return trimmed;
  const normalized = trimmed.replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(normalized) || /^-?\d{1,3}\.\d{3},\d+$/.test(normalized)) return Number(normalized.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d+(,\d+)$/.test(normalized)) return Number(normalized.replace(',', '.'));
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) return Number(normalized.replace(/,/g, ''));
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  return trimmed;
}

export function plainText(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
