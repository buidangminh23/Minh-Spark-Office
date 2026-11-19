import JSZip from 'jszip';
import { worksheetPaths } from './xlsmPackage';
import type { SourcePackage, WorkbookData } from './sheetTypes';

const MAX_ARCHIVE_CHARS = 32_000_000;
const SKIPPED_PARTS = /^(xl\/vbaProject\.bin|xl\/sharedStrings\.xml|xl\/styles\.xml|xl\/calcChain\.xml|xl\/theme\/|docProps\/|customXml\/|_rels\/|xl\/_rels\/)/;
const WORKSHEET_ORDER = [
  'sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'sheetCalcPr', 'sheetProtection', 'protectedRanges',
  'scenarios', 'autoFilter', 'sortState', 'dataConsolidate', 'customSheetViews', 'mergeCells', 'phoneticPr', 'conditionalFormatting',
  'dataValidations', 'hyperlinks', 'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks',
  'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture',
  'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst',
];
const KEPT_WHEN_MISSING = new Set([
  'sheetProtection', 'protectedRanges', 'autoFilter', 'conditionalFormatting', 'dataValidations', 'hyperlinks', 'drawing',
  'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'tableParts', 'extLst',
]);
const ALWAYS_FROM_SOURCE = new Set(['printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks']);

type Child = { name: string; xml: string };
type Parsed = { head: string; children: Child[]; tail: string };
export type Relationship = { id: string; type: string; target: string; external: boolean };

export const attribute = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';

function startTagEnd(xml: string, from: number) {
  let quote = '';
  for (let index = from; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }
  return -1;
}

function elementEnd(xml: string, from: number, name: string) {
  const first = startTagEnd(xml, from);
  if (first < 0) return -1;
  if (xml[first - 1] === '/') return first + 1;
  const tags = new RegExp(`<(/?)${name.replace(/[.:]/g, '\\$&')}(?=[\\s>/])`, 'g');
  tags.lastIndex = first + 1;
  let depth = 1;
  for (let match = tags.exec(xml); match; match = tags.exec(xml)) {
    const end = startTagEnd(xml, match.index);
    if (end < 0) return -1;
    if (match[1]) depth -= 1;
    else if (xml[end - 1] !== '/') depth += 1;
    if (!depth) return end + 1;
    tags.lastIndex = end + 1;
  }
  return -1;
}

const wrappedName = (xml: string) => /<mc:Choice\b[^>]*>\s*<([A-Za-z0-9:]+)/.exec(xml)?.[1] ?? 'mc:AlternateContent';

export function splitRoot(xml: string, root: string): Parsed | null {
  const start = xml.search(new RegExp(`<${root}(?=[\\s>])`));
  const close = xml.lastIndexOf(`</${root}>`);
  if (start < 0 || close < 0) return null;
  const headEnd = startTagEnd(xml, start) + 1;
  const children: Child[] = [];
  let position = headEnd;
  while (position < close) {
    const next = xml.indexOf('<', position);
    if (next < 0 || next >= close) break;
    const tag = /^<([A-Za-z0-9:._-]+)/.exec(xml.slice(next, next + 80))?.[1];
    const end = tag ? elementEnd(xml, next, tag) : -1;
    if (!tag || end < 0) return null;
    const body = xml.slice(next, end);
    children.push({ name: tag === 'mc:AlternateContent' ? wrappedName(body) : tag, xml: body });
    position = end;
  }
  return { head: xml.slice(0, headEnd), children, tail: xml.slice(close) };
}

const joinRoot = (parsed: Parsed) => parsed.head + parsed.children.map((child) => child.xml).join('') + parsed.tail;

const orderOf = (name: string) => {
  const index = WORKSHEET_ORDER.indexOf(name);
  return index < 0 ? WORKSHEET_ORDER.length : index;
};

export const relsPathOf = (part: string) => part.replace(/([^/]+)$/, '_rels/$1.rels');

export function resolveTarget(part: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const segments = part.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') segments.pop();
    else if (piece !== '.') segments.push(piece);
  }
  return segments.join('/');
}

export const readRelationships = (xml: string | undefined): Relationship[] =>
  [...(xml ?? '').matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => ({
    id: attribute(tag, 'Id'),
    type: attribute(tag, 'Type'),
    target: attribute(tag, 'Target'),
    external: attribute(tag, 'TargetMode') === 'External',
  }));

const relationshipXml = (item: Relationship) =>
  `<Relationship Id="${item.id}" Type="${item.type}" Target="${item.target}"${item.external ? ' TargetMode="External"' : ''}/>`;

export const relationshipsXml = (items: Relationship[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(relationshipXml).join('')}</Relationships>`;

const text = (zip: JSZip, path: string) => zip.file(path)?.async('string');

export async function captureSourcePackage(zip: JSZip, data: WorkbookData): Promise<SourcePackage | undefined> {
  const paths = await worksheetPaths(zip);
  const sheets: Record<string, string> = {};
  data.sheetOrder.forEach((id, index) => {
    if (paths[index]) sheets[id] = paths[index];
  });
  const kept = new JSZip();
  const sheetPaths = new Set(paths);
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || SKIPPED_PARTS.test(path)) continue;
    if (!sheetPaths.has(path)) {
      kept.file(path, await file.async('uint8array'));
      continue;
    }
    const xml = await file.async('string');
    kept.file(path, xml.replace(/<sheetData\b[^>]*>[\s\S]*<\/sheetData>/, '<sheetData/>'));
  }
  const archive = await kept.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  return archive.length > MAX_ARCHIVE_CHARS ? undefined : { archive, sheets, order: paths };
}

export class PartCopier {
  private readonly copied = new Map<string, string>();
  readonly contentTypes = new Map<string, string>();
  readonly extensions = new Map<string, string>();

  private readonly source: JSZip;
  private readonly output: JSZip;
  private readonly sourceTypes: string;

  constructor(source: JSZip, output: JSZip, sourceTypes: string) {
    this.source = source;
    this.output = output;
    this.sourceTypes = sourceTypes;
  }

  private register(sourcePath: string, outputPath: string) {
    const override = new RegExp(`<Override\\b[^>]*PartName="/${sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`).exec(this.sourceTypes)?.[0];
    if (override) this.contentTypes.set(outputPath, attribute(override, 'ContentType'));
    const extension = /\.([A-Za-z0-9]+)$/.exec(sourcePath)?.[1]?.toLowerCase();
    if (!extension) return;
    const fallback = new RegExp(`<Default\\b[^>]*Extension="${extension}"[^>]*>`, 'i').exec(this.sourceTypes)?.[0];
    if (fallback) this.extensions.set(extension, attribute(fallback, 'ContentType'));
  }

  alias(sourcePath: string, outputPath: string) {
    this.copied.set(sourcePath, outputPath);
  }

  async copy(sourcePath: string): Promise<string | null> {
    const known = this.copied.get(sourcePath);
    if (known) return known;
    const file = this.source.file(sourcePath);
    if (!file) return null;
    let outputPath = sourcePath;
    for (let attempt = 1; this.output.file(outputPath); attempt += 1) outputPath = sourcePath.replace(/([^/]+)$/, `kept${attempt}_$1`);
    this.copied.set(sourcePath, outputPath);
    this.output.file(outputPath, await file.async('uint8array'));
    this.register(sourcePath, outputPath);
    const relationships = readRelationships(await text(this.source, relsPathOf(sourcePath)));
    if (relationships.length) this.output.file(relsPathOf(outputPath), relationshipsXml(await this.retarget(sourcePath, relationships)));
    return outputPath;
  }

  async retarget(sourcePath: string, relationships: Relationship[]) {
    const result: Relationship[] = [];
    for (const item of relationships) {
      if (item.external) {
        result.push(item);
        continue;
      }
      const copiedPath = await this.copy(resolveTarget(sourcePath, item.target));
      if (copiedPath) result.push({ ...item, target: `/${copiedPath}` });
    }
    return result;
  }
}

function mergeNamespaces(outputHead: string, sourceHead: string) {
  let head = outputHead;
  for (const [declaration, prefix] of sourceHead.matchAll(/\sxmlns:([A-Za-z0-9]+)="[^"]*"/g)) {
    if (!new RegExp(`\\sxmlns:${prefix}=`).test(head)) head = head.replace(/>$/, `${declaration}>`);
  }
  const ignorable = new Set(`${attribute(outputHead, 'mc:Ignorable')} ${attribute(sourceHead, 'mc:Ignorable')}`.split(/\s+/).filter(Boolean));
  const declared = [...ignorable].filter((prefix) => new RegExp(`\\sxmlns:${prefix}=`).test(head));
  if (!declared.length || !/\sxmlns:mc=/.test(head)) return head;
  const value = ` mc:Ignorable="${declared.join(' ')}"`;
  return /\smc:Ignorable="[^"]*"/.test(head) ? head.replace(/\smc:Ignorable="[^"]*"/, value) : head.replace(/>$/, `${value}>`);
}

function withPageFit(children: Child[], source: Parsed) {
  const fit = /<pageSetUpPr\b[^>]*\/>/.exec(source.children.find((child) => child.name === 'sheetPr')?.xml ?? '')?.[0];
  if (!fit) return children;
  const index = children.findIndex((child) => child.name === 'sheetPr');
  if (index < 0) return [{ name: 'sheetPr', xml: `<sheetPr>${fit}</sheetPr>` }, ...children];
  const current = children[index].xml;
  if (/<pageSetUpPr\b/.test(current)) return children;
  const xml = current.endsWith('/>') ? `${current.slice(0, -2)}>${fit}</sheetPr>` : current.replace('</sheetPr>', `${fit}</sheetPr>`);
  return children.map((child, position) => (position === index ? { ...child, xml } : child));
}

function graftChildren(output: Parsed, source: Parsed, renameIds: (xml: string) => string) {
  const present = new Set(output.children.map((child) => child.name));
  const replaced = new Set(source.children.map((child) => child.name).filter((name) => ALWAYS_FROM_SOURCE.has(name)));
  const children = output.children.filter((child) => !replaced.has(child.name));
  for (const child of source.children) {
    const wanted = ALWAYS_FROM_SOURCE.has(child.name) || (KEPT_WHEN_MISSING.has(child.name) && !present.has(child.name));
    if (!wanted) continue;
    const rank = orderOf(child.name);
    const at = children.findIndex((existing) => orderOf(existing.name) > rank);
    children.splice(at < 0 ? children.length : at, 0, { name: child.name, xml: renameIds(child.xml) });
  }
  return { head: mergeNamespaces(output.head, source.head), children: withPageFit(children, source), tail: output.tail };
}

async function restoreSheet(copier: PartCopier, source: JSZip, output: JSZip, sourcePath: string, outputPath: string) {
  const sourceXml = await text(source, sourcePath);
  const outputXml = await text(output, outputPath);
  const sourceParsed = sourceXml ? splitRoot(sourceXml, 'worksheet') : null;
  const outputParsed = outputXml ? splitRoot(outputXml, 'worksheet') : null;
  if (!sourceParsed || !outputParsed) return;
  const existing = readRelationships(await text(output, relsPathOf(outputPath)));
  const incoming = await copier.retarget(sourcePath, readRelationships(await text(source, relsPathOf(sourcePath))));
  const renamed = new Map(incoming.map((item, index) => [item.id, `rIdKept${index + 1}`]));
  const renameIds = (xml: string) => xml.replace(/\br:(id|embed|link|pict)="([^"]*)"/g, (whole, name: string, id: string) => (renamed.has(id) ? `r:${name}="${renamed.get(id)}"` : whole));
  output.file(outputPath, joinRoot(graftChildren(outputParsed, sourceParsed, renameIds)));
  const relationships = [...existing, ...incoming.map((item) => ({ ...item, id: renamed.get(item.id)! }))];
  if (relationships.length) output.file(relsPathOf(outputPath), relationshipsXml(relationships));
}

function mergeDefinedNames(outputWorkbook: string, sourceWorkbook: string, sheetIndex: Map<number, number>) {
  const existing = new Set([...outputWorkbook.matchAll(/<definedName\b[^>]*>/g)].map(([tag]) => `${attribute(tag, 'name')}|${attribute(tag, 'localSheetId')}`));
  const added: string[] = [];
  for (const [whole, tag] of sourceWorkbook.matchAll(/(<definedName\b[^>]*>)[^<]*<\/definedName>/g)) {
    const local = attribute(tag, 'localSheetId');
    const mapped = local === '' ? '' : sheetIndex.get(Number(local));
    if (mapped === undefined) continue;
    if (existing.has(`${attribute(tag, 'name')}|${mapped}`)) continue;
    added.push(local === '' ? whole : whole.replace(/\blocalSheetId="\d+"/, `localSheetId="${mapped}"`));
  }
  if (!added.length) return outputWorkbook;
  if (/<definedNames>/.test(outputWorkbook)) return outputWorkbook.replace('</definedNames>', `${added.join('')}</definedNames>`);
  return outputWorkbook.replace('</sheets>', `</sheets><definedNames>${added.join('')}</definedNames>`);
}

export function mergeContentTypes(xml: string, copier: PartCopier) {
  let result = xml;
  for (const [extension, type] of copier.extensions) {
    if (!new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'i').test(result)) result = result.replace('</Types>', `<Default Extension="${extension}" ContentType="${type}"/></Types>`);
  }
  for (const [part, type] of copier.contentTypes) {
    if (!result.includes(`PartName="/${part}"`)) result = result.replace('</Types>', `<Override PartName="/${part}" ContentType="${type}"/></Types>`);
  }
  return result;
}

export async function restoreSourcePackage(output: JSZip, data: WorkbookData): Promise<void> {
  const kept = data.sourcePackage;
  if (!kept?.archive) return;
  const source = await JSZip.loadAsync(kept.archive, { base64: true });
  const sourceTypes = (await text(source, '[Content_Types].xml')) ?? '';
  const sourceWorkbook = (await text(source, 'xl/workbook.xml')) ?? '';
  const sourceOrder = [...sourceWorkbook.matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => attribute(tag, 'name'));
  const outputPaths = await worksheetPaths(output);
  const sheetIds = data.sheetOrder.filter((id) => data.sheets[id]);
  const copier = new PartCopier(source, output, sourceTypes);
  const sheetIndex = new Map<number, number>();
  const sourcePaths = kept.order ?? Object.values(kept.sheets);
  for (const [index, id] of sheetIds.entries()) {
    const sourcePath = kept.sheets[id];
    if (!sourcePath || !outputPaths[index]) continue;
    await restoreSheet(copier, source, output, sourcePath, outputPaths[index]);
    const original = sourcePaths.indexOf(sourcePath);
    if (original >= 0 && original < sourceOrder.length) sheetIndex.set(original, index);
  }
  const workbook = await text(output, 'xl/workbook.xml');
  if (workbook) output.file('xl/workbook.xml', mergeDefinedNames(workbook, sourceWorkbook, sheetIndex));
  const types = await text(output, '[Content_Types].xml');
  if (types) output.file('[Content_Types].xml', mergeContentTypes(types, copier));
}
