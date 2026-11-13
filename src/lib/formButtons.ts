import type JSZip from 'jszip';

export type FormButtonAnchor = { row: number; column: number; rowOffset: number; columnOffset: number };

export type FormButton = {
  id: string;
  label: string;
  macro: string;
  from: FormButtonAnchor;
  to: FormButtonAnchor;
  bold?: boolean;
  fontSize?: number;
};

export type FormButtonMap = Record<string, FormButton[]>;

const VML_REL_TYPE = '/vmlDrawing';
const VML_FONT_UNITS_PER_POINT = 20;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
  });

const plainText = (markup: string) => decodeEntities(markup.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function parseAnchor(raw: string): { from: FormButtonAnchor; to: FormButtonAnchor } | null {
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 8 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  const [column, columnOffset, row, rowOffset, endColumn, endColumnOffset, endRow, endRowOffset] = parts;
  return {
    from: { row, column, rowOffset, columnOffset },
    to: { row: endRow, column: endColumn, rowOffset: endRowOffset, columnOffset: endColumnOffset },
  };
}

export function parseVmlButtons(vml: string): FormButton[] {
  const buttons: FormButton[] = [];
  for (const match of vml.matchAll(/<v:shape\b([^>]*)>([\s\S]*?)<\/v:shape>/g)) {
    const [, attributes, body] = match;
    if (!/<x:ClientData\b[^>]*ObjectType="Button"/.test(body)) continue;
    if (/visibility\s*:\s*hidden/i.test(attributes)) continue;
    const macro = decodeEntities(/<x:FmlaMacro>([^<]*)<\/x:FmlaMacro>/.exec(body)?.[1] ?? '').trim();
    const anchor = parseAnchor(/<x:Anchor>([^<]*)<\/x:Anchor>/.exec(body)?.[1] ?? '');
    if (!macro || !anchor) continue;
    const textbox = /<v:textbox\b[^>]*>([\s\S]*?)<\/v:textbox>/.exec(body)?.[1] ?? '';
    const fontUnits = Number(/<font\b[^>]*\bsize="(\d+)"/.exec(textbox)?.[1]);
    const id = /\bo:spid="([^"]+)"/.exec(attributes)?.[1] ?? /\bid="([^"]+)"/.exec(attributes)?.[1] ?? `button${buttons.length + 1}`;
    const button: FormButton = { id, label: plainText(textbox), macro, ...anchor };
    if (/<b\b/i.test(textbox)) button.bold = true;
    if (fontUnits > 0) button.fontSize = fontUnits / VML_FONT_UNITS_PER_POINT;
    buttons.push(button);
  }
  return buttons;
}

function resolveTarget(basePath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = basePath.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment && segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

async function vmlPathsOf(zip: JSZip, sheetPath: string): Promise<string[]> {
  const slash = sheetPath.lastIndexOf('/');
  const relsPath = `${sheetPath.slice(0, slash)}/_rels/${sheetPath.slice(slash + 1)}.rels`;
  const rels = await zip.file(relsPath)?.async('string');
  if (!rels) return [];
  const paths: string[] = [];
  for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const type = /\bType="([^"]*)"/.exec(tag)?.[1] ?? '';
    const target = /\bTarget="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (type.endsWith(VML_REL_TYPE) && target) paths.push(resolveTarget(sheetPath, decodeEntities(target)));
  }
  return paths;
}

export async function readFormButtons(zip: JSZip, sheetPaths: string[]): Promise<FormButton[][]> {
  const result: FormButton[][] = [];
  for (const sheetPath of sheetPaths) {
    const buttons: FormButton[] = [];
    for (const vmlPath of await vmlPathsOf(zip, sheetPath)) {
      const vml = await zip.file(vmlPath)?.async('string');
      if (vml) buttons.push(...parseVmlButtons(vml));
    }
    result.push(buttons);
  }
  return result;
}

export function resolveButtonMacro(macro: string, macroIds: string[]): string | null {
  const bang = macro.lastIndexOf('!');
  const name = (bang >= 0 ? macro.slice(bang + 1) : macro).trim().toLowerCase();
  if (!name) return null;
  if (name.includes('.')) return macroIds.find((id) => id.toLowerCase() === name) ?? null;
  return macroIds.find((id) => id.slice(id.lastIndexOf('.') + 1).toLowerCase() === name) ?? null;
}

export function sanitizeFormButtons(value: unknown): FormButtonMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const isAnchor = (anchor: unknown): anchor is FormButtonAnchor =>
    typeof anchor === 'object' && anchor !== null && ['row', 'column', 'rowOffset', 'columnOffset'].every((key) => Number.isFinite((anchor as Record<string, unknown>)[key]));
  const map: FormButtonMap = {};
  for (const [sheetId, list] of Object.entries(value)) {
    if (!Array.isArray(list)) continue;
    const buttons = list.filter((item): item is FormButton =>
      typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.macro === 'string' && typeof item.label === 'string' && isAnchor(item.from) && isAnchor(item.to));
    if (buttons.length) map[sheetId] = buttons;
  }
  return map;
}
