import type JSZip from 'jszip';

export type FormButtonAnchor = { row: number; column: number; rowOffset: number; columnOffset: number };
export type FormButtonKind = 'button' | 'text' | 'picture';

export type FormButton = {
  id: string;
  label: string;
  macro: string;
  from: FormButtonAnchor;
  to: FormButtonAnchor;
  bold?: boolean;
  fontSize?: number;
  kind?: FormButtonKind;
  name?: string;
  hidden?: boolean;
  image?: string;
  at?: { x: number; y: number };
  size?: { width: number; height: number };
  italic?: boolean;
  color?: string;
  fill?: string;
  border?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  fontFamily?: string;
};

export type FormButtonMap = Record<string, FormButton[]>;
export type FormImageMap = Record<string, string>;
export type SheetObjects = { objects: FormButton[][]; images: FormImageMap };

const VML_REL_TYPE = '/vmlDrawing';
const DRAWING_REL_TYPE = '/drawing';
const IMAGE_REL_TYPE = '/image';
const VML_FONT_UNITS_PER_POINT = 20;
const DRAWING_FONT_UNITS_PER_POINT = 100;
const EMU_PER_PIXEL = 9525;
const BASE64_CHUNK = 0x8000;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
};

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
    const name = /\bid="([^"]+)"/.exec(attributes)?.[1];
    const id = /\bo:spid="([^"]+)"/.exec(attributes)?.[1] ?? name ?? `button${buttons.length + 1}`;
    const button: FormButton = { id, label: plainText(textbox), macro, ...anchor };
    if (name) button.name = name;
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

type Relationship = { id: string; type: string; path: string };

async function relationshipsOf(zip: JSZip, partPath: string): Promise<Relationship[]> {
  const slash = partPath.lastIndexOf('/');
  const rels = await zip.file(`${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`)?.async('string');
  if (!rels) return [];
  const list: Relationship[] = [];
  for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const target = /\bTarget="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (!target || /\bTargetMode="External"/.test(tag)) continue;
    list.push({ id: /\bId="([^"]*)"/.exec(tag)?.[1] ?? '', type: /\bType="([^"]*)"/.exec(tag)?.[1] ?? '', path: resolveTarget(partPath, decodeEntities(target)) });
  }
  return list;
}

const pixels = (emu: string | undefined) => Math.round((Number(emu) || 0) / EMU_PER_PIXEL);
const tagText = (xml: string, tag: string) => new RegExp(`<xdr:${tag}>([^<]*)</xdr:${tag}>`).exec(xml)?.[1];
const ORIGIN: FormButtonAnchor = { row: 0, column: 0, rowOffset: 0, columnOffset: 0 };

function drawingAnchor(xml: string): FormButtonAnchor | null {
  const row = Number(tagText(xml, 'row'));
  const column = Number(tagText(xml, 'col'));
  if (!xml || !Number.isFinite(row) || !Number.isFinite(column)) return null;
  return { row, column, rowOffset: pixels(tagText(xml, 'rowOff')), columnOffset: pixels(tagText(xml, 'colOff')) };
}

function drawingPlacement(kind: string, block: string): Pick<FormButton, 'from' | 'to' | 'at' | 'size'> | null {
  const ext = /<xdr:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(block);
  const size = ext ? { width: pixels(ext[1]), height: pixels(ext[2]) } : undefined;
  if (kind === 'absoluteAnchor') {
    const pos = /<xdr:pos\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/.exec(block);
    return pos && size ? { from: ORIGIN, to: ORIGIN, at: { x: pixels(pos[1]), y: pixels(pos[2]) }, size } : null;
  }
  const from = drawingAnchor(/<xdr:from>([\s\S]*?)<\/xdr:from>/.exec(block)?.[1] ?? '');
  if (!from) return null;
  if (kind === 'oneCellAnchor') return size ? { from, to: from, size } : null;
  const to = drawingAnchor(/<xdr:to>([\s\S]*?)<\/xdr:to>/.exec(block)?.[1] ?? '');
  return to ? { from, to } : null;
}

const solidColor = (xml: string | undefined) => {
  const hex = /<a:solidFill>\s*<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/.exec(xml ?? '')?.[1];
  return hex ? `#${hex.toUpperCase()}` : undefined;
};

const ALIGNMENTS: Record<string, FormButton['align']> = { l: 'left', ctr: 'center', r: 'right' };
const VERTICAL_ALIGNMENTS: Record<string, FormButton['valign']> = { t: 'top', ctr: 'middle', b: 'bottom' };

function textBoxStyle(shape: string): Partial<FormButton> {
  const style: Partial<FormButton> = {};
  const run = /<a:rPr\b[^>]*>/.exec(shape)?.[0] ?? '';
  const size = Number(/\bsz="(\d+)"/.exec(run)?.[1]);
  if (size > 0) style.fontSize = size / DRAWING_FONT_UNITS_PER_POINT;
  if (/\bb="1"/.test(run)) style.bold = true;
  if (/\bi="1"/.test(run)) style.italic = true;
  const color = solidColor(/<a:rPr\b[^>]*>([\s\S]*?)<\/a:rPr>/.exec(shape)?.[1]);
  if (color) style.color = color;
  const family = /<a:latin\b[^>]*\btypeface="([^"]+)"/.exec(shape)?.[1];
  if (family && !family.startsWith('+')) style.fontFamily = decodeEntities(family);
  const align = ALIGNMENTS[/<a:pPr\b[^>]*\balgn="(\w+)"/.exec(shape)?.[1] ?? ''];
  if (align) style.align = align;
  const valign = VERTICAL_ALIGNMENTS[/<a:bodyPr\b[^>]*\banchor="(\w+)"/.exec(shape)?.[1] ?? ''];
  if (valign) style.valign = valign;
  const properties = /<xdr:spPr\b[^>]*>([\s\S]*?)<\/xdr:spPr>/.exec(shape)?.[1] ?? '';
  const fill = solidColor(properties.replace(/<a:ln\b[\s\S]*?<\/a:ln>/, '').replace(/<a:extLst>[\s\S]*?<\/a:extLst>/, ''));
  if (fill) style.fill = fill;
  const border = solidColor(/<a:ln\b[^>]*>([\s\S]*?)<\/a:ln>/.exec(properties)?.[1]);
  if (border) style.border = border;
  return style;
}

const shapeText = (shape: string) =>
  [...shape.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\/>/g)]
    .map(([, paragraph]) => [...(paragraph ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, text]) => decodeEntities(text)).join(''))
    .join('\n')
    .replace(/\n+$/, '');

export function parseDrawingObjects(xml: string, imageKeys: Record<string, string>): FormButton[] {
  const objects: FormButton[] = [];
  for (const [block, kind] of xml.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
    if (block.includes('compatExt') || block.includes('<xdr:grpSp')) continue;
    const placement = drawingPlacement(kind, block);
    if (!placement) continue;
    const properties = /<xdr:cNvPr\b[^>]*>/.exec(block)?.[0] ?? '';
    const name = decodeEntities(/\bname="([^"]*)"/.exec(properties)?.[1] ?? '');
    const base: FormButton = { id: `drawing-${/\bid="(\d+)"/.exec(properties)?.[1] ?? 'x'}-${objects.length}`, label: '', macro: '', ...placement };
    if (name) base.name = name;
    if (/\bhidden="1"/.test(properties)) base.hidden = true;
    if (block.includes('<xdr:pic>')) {
      const image = imageKeys[/<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(block)?.[1] ?? ''];
      if (image) objects.push({ ...base, kind: 'picture', image });
      continue;
    }
    if (!block.includes('<xdr:sp ')) continue;
    const label = shapeText(block);
    const style = textBoxStyle(block);
    if (!label && !style.fill && !style.border) continue;
    const macro = decodeEntities(/<xdr:sp\b[^>]*\bmacro="([^"]*)"/.exec(block)?.[1] ?? '');
    objects.push({ ...base, ...style, label, macro, kind: macro ? 'button' : 'text' });
  }
  return objects;
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK));
  return btoa(binary);
};

const contentKey = (bytes: Uint8Array) => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < bytes.length; index += 1) hash = Math.imul(hash ^ bytes[index], FNV_PRIME);
  return `${(hash >>> 0).toString(16)}-${bytes.length}`;
};

async function drawingObjectsOf(zip: JSZip, drawingPath: string, images: FormImageMap): Promise<FormButton[]> {
  const xml = await zip.file(drawingPath)?.async('string');
  if (!xml) return [];
  const imageKeys: Record<string, string> = {};
  for (const relation of await relationshipsOf(zip, drawingPath)) {
    const mime = IMAGE_MIME[relation.path.slice(relation.path.lastIndexOf('.') + 1).toLowerCase()];
    const file = relation.type.endsWith(IMAGE_REL_TYPE) && mime ? zip.file(relation.path) : null;
    if (!file) continue;
    const bytes = await file.async('uint8array');
    const key = contentKey(bytes);
    images[key] ??= `data:${mime};base64,${toBase64(bytes)}`;
    imageKeys[relation.id] = key;
  }
  return parseDrawingObjects(xml, imageKeys);
}

export async function readSheetObjects(zip: JSZip, sheetPaths: string[]): Promise<SheetObjects> {
  const result: SheetObjects = { objects: [], images: {} };
  for (const sheetPath of sheetPaths) {
    const list: FormButton[] = [];
    for (const relation of await relationshipsOf(zip, sheetPath)) {
      if (relation.type.endsWith(DRAWING_REL_TYPE)) list.push(...(await drawingObjectsOf(zip, relation.path, result.images)));
      if (!relation.type.endsWith(VML_REL_TYPE)) continue;
      const vml = await zip.file(relation.path)?.async('string');
      if (vml) list.push(...parseVmlButtons(vml));
    }
    result.objects.push(list);
  }
  return result;
}

export async function readFormButtons(zip: JSZip, sheetPaths: string[]): Promise<FormButton[][]> {
  return (await readSheetObjects(zip, sheetPaths)).objects.map((list) => list.filter((item) => (item.kind ?? 'button') === 'button'));
}

export function resolveButtonMacro(macro: string, macroIds: string[]): string | null {
  const bang = macro.lastIndexOf('!');
  const name = (bang >= 0 ? macro.slice(bang + 1) : macro).trim().toLowerCase();
  if (!name) return null;
  if (name.includes('.')) return macroIds.find((id) => id.toLowerCase() === name) ?? null;
  return macroIds.find((id) => id.slice(id.lastIndexOf('.') + 1).toLowerCase() === name) ?? null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isAnchor = (anchor: unknown): anchor is FormButtonAnchor =>
  isRecord(anchor) && ['row', 'column', 'rowOffset', 'columnOffset'].every((key) => Number.isFinite(anchor[key]));

export function sanitizeFormButtons(value: unknown): FormButtonMap {
  if (!isRecord(value)) return {};
  const map: FormButtonMap = {};
  for (const [sheetId, list] of Object.entries(value)) {
    if (!Array.isArray(list)) continue;
    const buttons = list.filter((item): item is FormButton =>
      isRecord(item) && typeof item.id === 'string' && typeof item.macro === 'string' && typeof item.label === 'string' && isAnchor(item.from) && isAnchor(item.to));
    if (buttons.length) map[sheetId] = buttons;
  }
  return map;
}

export function sanitizeFormImages(value: unknown): FormImageMap {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].startsWith('data:image/')));
}
