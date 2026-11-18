import type JSZip from 'jszip';
import type { WorkbookData } from './sheetTypes';
import { localName, parseXml, type XmlNode } from './miniXml';

type WorkbookFont = { name?: string; size?: number; bold?: boolean; italic?: boolean; scheme?: string };
type ThemeFamilies = { major?: string; minor?: string };
export type WorkbookFonts = { families: ThemeFamilies; normal: Required<Pick<WorkbookFont, 'name' | 'size' | 'bold' | 'italic'>> };

function xmlChildren(node: XmlNode | undefined, name: string) {
  return node?.children.filter((entry) => localName(entry.name) === name) ?? [];
}

function xmlSection(xml: string, name: string) {
  const prefix = '(?:[\\w.-]+:)?';
  const section = new RegExp(`<${prefix}${name}\\b[^>]*>[\\s\\S]*?</${prefix}${name}>`).exec(xml)?.[0];
  return section ? parseXml(section).children[0] : undefined;
}

export function excelFontName(font: WorkbookFont, families: ThemeFamilies) {
  if (font.scheme === 'minor' || font.scheme === 'major') return families[font.scheme] || font.name;
  return font.name;
}

export async function readWorkbookFonts(zip: JSZip, locale: string): Promise<WorkbookFonts> {
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string') ?? '';
  const parts = xmlChildren(parseXml(rels).children[0], 'Relationship');
  const readPart = (type: string, fallback: string) => {
    const relationship = parts.find(({ attrs }) => attrs.Type?.endsWith('/' + type) && attrs.TargetMode !== 'External');
    const target = relationship?.attrs.Target ?? fallback;
    const name = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    return zip.file(name)?.async('string');
  };
  const [styles = '', theme = ''] = await Promise.all([readPart('styles', 'styles.xml'), readPart('theme', 'theme/theme1.xml')]);
  const families: ThemeFamilies = {};
  const scheme = xmlSection(theme, 'fontScheme');
  for (const kind of ['major', 'minor'] as const) {
    const group = xmlChildren(scheme, `${kind}Font`)[0];
    const local = /^vi/i.test(locale) && xmlChildren(group, 'font').find((entry) => entry.attrs.script === 'Viet');
    families[kind] = (local && local.attrs.typeface) || xmlChildren(group, 'latin')[0]?.attrs.typeface;
  }
  const named = xmlChildren(xmlSection(styles, 'cellStyles'), 'cellStyle');
  const normal = named.find(({ attrs }) => attrs.builtinId === '0') ?? named.find(({ attrs }) => attrs.name === 'Normal');
  const xf = xmlChildren(xmlSection(styles, 'cellStyleXfs'), 'xf')[Number(normal?.attrs.xfId ?? 0)];
  const font = xmlChildren(xmlSection(styles, 'fonts'), 'font')[Number(xf?.attrs.fontId ?? 0)];
  const property = (name: string) => xmlChildren(font, name)[0]?.attrs;
  const enabled = (name: string) => !!property(name) && !['0', 'false'].includes(property(name)?.val ?? '1');
  const name = excelFontName({ name: property('name')?.val, scheme: property('scheme')?.val }, families);
  return { families, normal: { name: name || 'Calibri', size: Number(property('sz')?.val) || 11, bold: enabled('b'), italic: enabled('i') } };
}

export function excelDigitWidth(font: WorkbookFont) {
  const size = font.size && font.size > 0 ? font.size : 11;
  const name = font.name || 'Calibri';
  const context = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d')
    : typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (context) {
    context.font = `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}pt "${name.replace(/["\\]/g, '')}"`;
    const width = Math.max(...Array.from('0123456789', (digit) => context.measureText(digit).width));
    if (width > 0) return Math.max(1, Math.round(width));
  }
  const digitEm = /^(arial|arial unicode ms|helvetica)$/i.test(name) ? 0.556 : /^(courier new|consolas)$/i.test(name) ? 0.6 : 0.5;
  return Math.max(1, Math.round(size * 4 / 3 * digitEm));
}

export const excelColumnPixels = (width: number, digitWidth: number) =>
  Math.floor((width + Math.floor(128 / digitWidth) / 256) * digitWidth);

type Resource = { name: string; data: string };
type GridRange = { startRow: number; endRow: number; startColumn: number; endColumn: number };
type DefinedName = { id: string; name: string; formulaOrRefString: string; localSheetId?: string; hidden?: boolean };
type ValidationRule = {
  uid: string;
  type: string;
  ranges: GridRange[];
  formula1?: string;
  formula2?: string;
  operator?: string;
  allowBlank?: boolean;
  showErrorMessage?: boolean;
  error?: string;
  errorTitle?: string;
  showInputMessage?: boolean;
  prompt?: string;
  promptTitle?: string;
};

const DEFINED_NAME_RESOURCE = 'SHEET_DEFINED_NAME_PLUGIN';
const DATA_VALIDATION_RESOURCE = 'SHEET_DATA_VALIDATION_PLUGIN';
const BUILT_IN_NAME_PREFIX = '_xlnm.';
const VALIDATION_TYPES = new Set(['list', 'whole', 'decimal', 'date', 'time', 'textLength', 'custom']);
const REFERENCE_PATTERN = /^(?:(?:'[^']+'|[^'!\s]+)!)?\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?$/i;
const ALPHABET_SIZE = 26;
const CHAR_CODE_BEFORE_A = 64;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (text: string) => text.replace(/&(amp|lt|gt|quot|apos);/g, (_, code: string) => ENTITIES[code]);
const attribute = (tag: string, name: string) => {
  const value = new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
  return value === undefined ? undefined : decodeXml(value);
};

export function readDefinedNames(workbookXml: string, sheetIds: string[]): Record<string, DefinedName> {
  const names: Record<string, DefinedName> = {};
  let index = 0;
  for (const [, attributes, body] of workbookXml.matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    const name = attribute(attributes, 'name') ?? '';
    const value = decodeXml(body).trim();
    if (!name || name.startsWith(BUILT_IN_NAME_PREFIX) || !value || value.includes('#REF!')) continue;
    index += 1;
    const entry: DefinedName = { id: `xl-name-${index}`, name, formulaOrRefString: REFERENCE_PATTERN.test(value) ? value : `=${value.replace(/^=/, '')}` };
    const local = sheetIds[Number(attribute(attributes, 'localSheetId') ?? NaN)];
    if (local) entry.localSheetId = local;
    if (attribute(attributes, 'hidden') === '1') entry.hidden = true;
    names[entry.id] = entry;
  }
  return names;
}

const columnIndex = (letters: string) => [...letters.toUpperCase()].reduce((total, letter) => total * ALPHABET_SIZE + letter.charCodeAt(0) - CHAR_CODE_BEFORE_A, 0) - 1;

function parseCell(reference: string): { row: number; column: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(reference);
  return match ? { row: Number(match[2]) - 1, column: columnIndex(match[1]) } : null;
}

export function parseSqref(sqref: string, rowCount: number, columnCount: number): GridRange[] {
  const ranges: GridRange[] = [];
  for (const part of sqref.split(/\s+/).filter(Boolean)) {
    const [first, last = first] = part.split(':');
    const start = parseCell(first);
    const end = parseCell(last);
    if (!start || !end || start.row >= rowCount || start.column >= columnCount) continue;
    ranges.push({ startRow: start.row, endRow: Math.min(end.row, rowCount - 1), startColumn: start.column, endColumn: Math.min(end.column, columnCount - 1) });
  }
  return ranges;
}

const isNumeric = (text: string) => text !== '' && Number.isFinite(Number(text));

function validationFormula(type: string, raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const text = decodeXml(raw).trim();
  if (type === 'list' && /^".*"$/.test(text)) return text.slice(1, -1).replace(/""/g, '"');
  return isNumeric(text) ? text : `=${text.replace(/^=/, '')}`;
}

export function readDataValidations(sheetXml: string, rowCount: number, columnCount: number, prefix: string): ValidationRule[] {
  const rules: ValidationRule[] = [];
  for (const [, attributes, body] of sheetXml.matchAll(/<dataValidation\b([^>]*?)(?:\/>|>([\s\S]*?)<\/dataValidation>)/g)) {
    const type = attribute(attributes, 'type') ?? '';
    const ranges = parseSqref(attribute(attributes, 'sqref') ?? '', rowCount, columnCount);
    if (!VALIDATION_TYPES.has(type) || !ranges.length) continue;
    const rule: ValidationRule = { uid: `${prefix}-${rules.length + 1}`, type, ranges, allowBlank: attribute(attributes, 'allowBlank') === '1' };
    const formula1 = validationFormula(type, /<formula1>([\s\S]*?)<\/formula1>/.exec(body ?? '')?.[1]);
    const formula2 = validationFormula(type, /<formula2>([\s\S]*?)<\/formula2>/.exec(body ?? '')?.[1]);
    if (formula1 !== undefined) rule.formula1 = formula1;
    if (formula2 !== undefined) rule.formula2 = formula2;
    if (type !== 'list' && type !== 'custom') rule.operator = attribute(attributes, 'operator') ?? 'between';
    if (attribute(attributes, 'showErrorMessage') === '1') rule.showErrorMessage = true;
    if (attribute(attributes, 'showInputMessage') === '1') rule.showInputMessage = true;
    for (const key of ['error', 'errorTitle', 'prompt', 'promptTitle'] as const) {
      const text = attribute(attributes, key);
      if (text) rule[key] = text;
    }
    rules.push(rule);
  }
  return rules;
}

export async function attachWorkbookExtras(data: WorkbookData, zip: JSZip, sheetPaths: string[]): Promise<void> {
  const resources: Resource[] = [];
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const names = workbookXml ? readDefinedNames(workbookXml, data.sheetOrder) : {};
  if (Object.keys(names).length) resources.push({ name: DEFINED_NAME_RESOURCE, data: JSON.stringify(names) });
  const validations: Record<string, ValidationRule[]> = {};
  for (const [index, sheetId] of data.sheetOrder.entries()) {
    const sheet = data.sheets[sheetId];
    const xml = sheet && sheetPaths[index] ? await zip.file(sheetPaths[index])?.async('string') : undefined;
    if (xml) {
      for (const [tag] of xml.matchAll(/<row\b[^>]*>/g)) {
        const row = sheet.rowData[Number(attribute(tag, 'r')) - 1];
        if (row?.h !== undefined) row.ia = /^(1|true)$/.test(attribute(tag, 'customHeight') ?? '') ? 0 : 1;
      }
    }
    const rules = xml ? readDataValidations(xml, sheet.rowCount, sheet.columnCount, `xl-dv-${index + 1}`) : [];
    if (rules.length) validations[sheetId] = rules;
  }
  if (Object.keys(validations).length) resources.push({ name: DATA_VALIDATION_RESOURCE, data: JSON.stringify(validations) });
  if (!resources.length) return;
  const replaced = new Set(resources.map((resource) => resource.name));
  const kept = ((data.resources ?? []) as Resource[]).filter((resource) => !replaced.has(resource.name));
  data.resources = [...kept, ...resources];
}
