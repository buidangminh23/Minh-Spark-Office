import type JSZip from 'jszip';
import type { WorkbookData } from './sheetTypes';

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
    const rules = xml ? readDataValidations(xml, sheet.rowCount, sheet.columnCount, `xl-dv-${index + 1}`) : [];
    if (rules.length) validations[sheetId] = rules;
  }
  if (Object.keys(validations).length) resources.push({ name: DATA_VALIDATION_RESOURCE, data: JSON.stringify(validations) });
  if (!resources.length) return;
  const replaced = new Set(resources.map((resource) => resource.name));
  const kept = ((data.resources ?? []) as Resource[]).filter((resource) => !replaced.has(resource.name));
  data.resources = [...kept, ...resources];
}
