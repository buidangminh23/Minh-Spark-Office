import JSZip from 'jszip';
import { PartCopier, mergeContentTypes, mergeNamespaces, readRelationships, relationshipsXml, relsPathOf, splitRoot, type Relationship } from './xlsxPreserve';
import { contentSignature } from './sourceFiles';

const DOCUMENT = 'word/document.xml';
const STYLES = 'word/styles.xml';
const NUMBERING = 'word/numbering.xml';
const RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NUMBERING_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml';
const UNSUPPORTED = /<w:(footnoteReference|endnoteReference|commentReference|commentRangeStart)\b/;
const WEAK_JUMP = 3;
const MAX_SKIPPED = 6;

export type DocNode = { type?: string; text?: string; content?: DocNode[]; attrs?: Record<string, unknown> };
export type DocGroup = { from: number; count: number; nodes: number };
export type DocBlocks = { nodes: string[]; groups: DocGroup[] };
type Child = { name: string; xml: string };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (value: string) => value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (whole, name: string) => {
  if (name[0] !== '#') return ENTITIES[name] ?? whole;
  return String.fromCodePoint(name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
});
const normalize = (value: string) => value.normalize('NFC').replace(/[\s​­﻿]/g, '');

const FLOATING_TEXT = /<w:txbxContent\b[\s\S]*?<\/w:txbxContent>|<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g;

export const xmlText = (xml: string) =>
  normalize([...xml.replace(FLOATING_TEXT, '').matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => decode(match[1])).join(''));

export function nodeText(node: DocNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(nodeText).join('');
}

const hasPicture = (node: DocNode): boolean => /image|figure|drawing|chart|shape/i.test(node.type ?? '') || (node.content ?? []).some(hasPicture);
const hasDrawing = (xml: string) => /<w:(drawing|pict|object)\b/.test(xml);

function takeEmpty(children: Child[], texts: string[], start: number, wantsDrawing: boolean) {
  for (let index = start; index < children.length && !texts[index]; index += 1) {
    if (hasDrawing(children[index].xml) === wantsDrawing) return index - start + 1;
  }
  return 0;
}

function takeText(texts: string[], start: number, target: string) {
  let gathered = '';
  for (let index = start; index < texts.length; index += 1) {
    gathered += texts[index];
    if (gathered === target) return { count: index - start + 1, nodes: 1 };
    if (!target.startsWith(gathered)) return gathered.startsWith(target) && index === start + leadingEmpty(texts, start) ? { count: index - start + 1, nodes: 0 } : null;
  }
  return null;
}

const leadingEmpty = (texts: string[], start: number) => {
  let count = 0;
  while (start + count < texts.length && !texts[start + count]) count += 1;
  return count;
};

function spanNodes(nodeTexts: string[], start: number, target: string) {
  let gathered = '';
  for (let index = start; index < nodeTexts.length; index += 1) {
    gathered += nodeTexts[index];
    if (gathered === target) return index - start + 1;
    if (!target.startsWith(gathered)) return 0;
  }
  return 0;
}

export function alignBlocks(nodes: DocNode[], children: Child[]): DocGroup[] | null {
  const texts = children.map((child) => xmlText(child.xml));
  const nodeTexts = nodes.map((node) => normalize(nodeText(node)));
  const groups: DocGroup[] = [];
  let position = 0;
  for (let index = 0; index < nodes.length;) {
    if (!nodeTexts[index]) {
      const count = takeEmpty(children, texts, position, hasPicture(nodes[index]));
      groups.push({ from: position, count, nodes: 1 });
      position += count;
      index += 1;
      continue;
    }
    let skipped = 0;
    let taken = takeText(texts, position, nodeTexts[index]);
    while (!taken && skipped < MAX_SKIPPED && position + skipped + 1 < texts.length) {
      skipped += 1;
      taken = takeText(texts, position + skipped, nodeTexts[index]);
    }
    if (!taken) return null;
    const span = taken.nodes || spanNodes(nodeTexts, index, texts.slice(position + skipped, position + skipped + taken.count).join(''));
    if (!span) return null;
    groups.push({ from: position, count: taken.count + skipped, nodes: span });
    position += taken.count + skipped;
    index += span;
  }
  if (groups.length && position < children.length) groups[groups.length - 1].count += children.length - position;
  return groups;
}

const text = (zip: JSZip, path: string) => zip.file(path)?.async('string');

function bodyOf(documentXml: string) {
  const body = splitRoot(documentXml, 'w:body');
  if (!body) throw new Error('Document body could not be read');
  const last = body.children[body.children.length - 1];
  const section = last?.name === 'w:sectPr' ? last.xml : '';
  return { body, children: section ? body.children.slice(0, -1) : body.children, section };
}

export async function stampDocBlocks(original: Uint8Array, nodes: DocNode[]): Promise<DocBlocks | undefined> {
  const documentXml = await text(await JSZip.loadAsync(original), DOCUMENT);
  if (!documentXml) return undefined;
  const groups = alignBlocks(nodes, bodyOf(documentXml).children);
  return groups ? { nodes: nodes.map((node) => contentSignature(node)), groups } : undefined;
}

export function matchNodes(stamped: string[], current: string[], weak: boolean[]): number[] {
  const positions = new Map<string, number[]>();
  stamped.forEach((signature, index) => positions.set(signature, [...(positions.get(signature) ?? []), index]));
  let pointer = 0;
  return current.map((signature, index) => {
    const found = (positions.get(signature) ?? []).find((candidate) => candidate >= pointer);
    if (found === undefined || (weak[index] && found - pointer > WEAK_JUMP)) return -1;
    pointer = found + 1;
    return found;
  });
}

type Piece = { group: DocGroup } | { node: number };

function planBlocks(blocks: DocBlocks, matches: number[]): Piece[] {
  const owner: number[] = [];
  blocks.groups.forEach((group, index) => {
    for (let step = 0; step < group.nodes; step += 1) owner.push(index);
  });
  const starts = blocks.groups.reduce<number[]>((list, _group, index) => [...list, index ? list[index - 1] + blocks.groups[index - 1].nodes : 0], []);
  const pieces: Piece[] = [];
  for (let index = 0; index < matches.length;) {
    const group = matches[index] < 0 ? -1 : owner[matches[index]];
    const size = group < 0 ? 0 : blocks.groups[group].nodes;
    const whole = group >= 0 && matches[index] === starts[group] && Array.from({ length: size }, (_, step) => matches[index + step] === starts[group] + step).every(Boolean);
    if (!whole) {
      pieces.push({ node: index });
      index += 1;
      continue;
    }
    pieces.push({ group: blocks.groups[group] });
    index += size;
  }
  return pieces;
}

class Transplant {
  private readonly relIds = new Map<string, string>();
  private readonly numIds = new Map<string, string>();
  private readonly source: JSZip;
  private readonly fresh: JSZip;
  readonly copier: PartCopier;
  private adopted = false;
  private relationships: Relationship[] = [];
  private freshRelationships = new Map<string, Relationship>();
  private styles = '';
  private freshStyles = '';
  private numbering: string | undefined;
  private freshNumbering = '';

  constructor(source: JSZip, fresh: JSZip, copier: PartCopier) {
    this.source = source;
    this.fresh = fresh;
    this.copier = copier;
  }

  async load() {
    this.relationships = readRelationships(await text(this.source, relsPathOf(DOCUMENT)));
    this.freshRelationships = new Map(readRelationships(await text(this.fresh, relsPathOf(DOCUMENT))).map((item) => [item.id, item]));
    this.styles = (await text(this.source, STYLES)) ?? '';
    this.freshStyles = (await text(this.fresh, STYLES)) ?? '';
    this.numbering = await text(this.source, NUMBERING);
    this.freshNumbering = (await text(this.fresh, NUMBERING)) ?? '';
  }

  private nextRelId() {
    const used = new Set(this.relationships.map((item) => item.id));
    let number = this.relationships.length + 1;
    while (used.has(`rId${number}`)) number += 1;
    return `rId${number}`;
  }

  private async relationship(id: string) {
    const known = this.relIds.get(id);
    if (known) return known;
    const item = this.freshRelationships.get(id);
    if (!item) return id;
    const [moved] = await this.copier.retarget(DOCUMENT, [item]);
    if (!moved) return id;
    const renamed = this.nextRelId();
    this.relationships.push({ ...moved, id: renamed });
    this.relIds.set(id, renamed);
    return renamed;
  }

  private style(id: string) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!id || new RegExp(`w:styleId="${escaped}"`).test(this.styles)) return;
    const definition = new RegExp(`<w:style\\b[^>]*w:styleId="${escaped}"[\\s\\S]*?</w:style>`).exec(this.freshStyles)?.[0];
    if (!definition) return;
    this.styles = this.styles.replace('</w:styles>', `${definition}</w:styles>`);
    for (const [, linked] of definition.matchAll(/<w:(?:basedOn|link|next) w:val="([^"]+)"/g)) this.style(linked);
  }

  private number(id: string) {
    const known = this.numIds.get(id);
    if (known) return known;
    const instance = new RegExp(`<w:num\\b[^>]*w:numId="${id}"[\\s\\S]*?</w:num>`).exec(this.freshNumbering)?.[0];
    const abstractId = instance ? /<w:abstractNumId w:val="(\d+)"/.exec(instance)?.[1] : undefined;
    const abstract = abstractId ? new RegExp(`<w:abstractNum\\b[^>]*w:abstractNumId="${abstractId}"[\\s\\S]*?</w:abstractNum>`).exec(this.freshNumbering)?.[0] : undefined;
    if (!instance || !abstract || this.numbering === undefined) return id;
    const top = (pattern: RegExp) => [...this.numbering!.matchAll(pattern)].reduce((highest, match) => Math.max(highest, Number(match[1])), 0) + 1;
    const [nextNum, nextAbstract] = [top(/w:numId="(\d+)"/g), top(/w:abstractNumId="(\d+)"/g)];
    const movedAbstract = abstract.replace(/w:abstractNumId="\d+"/, `w:abstractNumId="${nextAbstract}"`).replace(/<w:(nsid|tmpl)\b[^>]*\/>/g, '');
    const movedInstance = instance.replace(/w:numId="\d+"/, `w:numId="${nextNum}"`).replace(/<w:abstractNumId w:val="\d+"/, `<w:abstractNumId w:val="${nextAbstract}"`);
    const firstNum = this.numbering.search(/<w:num\b/);
    this.numbering = firstNum < 0
      ? this.numbering.replace('</w:numbering>', `${movedAbstract}${movedInstance}</w:numbering>`)
      : `${this.numbering.slice(0, firstNum)}${movedAbstract}${this.numbering.slice(firstNum)}`.replace('</w:numbering>', `${movedInstance}</w:numbering>`);
    this.numIds.set(id, String(nextNum));
    return String(nextNum);
  }

  private async adoptNumbering() {
    if (this.adopted || this.numbering !== undefined || !this.freshNumbering) return;
    this.adopted = true;
    this.source.file(NUMBERING, this.freshNumbering);
    this.copier.contentTypes.set(NUMBERING, NUMBERING_TYPE);
    this.relationships.push({ id: this.nextRelId(), type: `${RELATIONSHIP}/numbering`, target: 'numbering.xml', external: false });
  }

  async adapt(xml: string) {
    if (UNSUPPORTED.test(xml)) throw new Error('Edited block uses notes or comments');
    let result = xml;
    for (const id of new Set([...xml.matchAll(/\br:(?:id|embed|link|pict)="([^"]+)"/g)].map((match) => match[1]))) {
      const renamed = await this.relationship(id);
      result = result.replace(new RegExp(`(\\br:(?:id|embed|link|pict)=")${id}(")`, 'g'), `$1\u0000${renamed}$2`);
    }
    result = result.replace(/\u0000/g, '');
    for (const [, id] of xml.matchAll(/<w:(?:pStyle|rStyle|tblStyle) w:val="([^"]+)"/g)) this.style(id);
    if (/<w:numId\b/.test(xml)) await this.adoptNumbering();
    return result.replace(/(<w:numId w:val=")(\d+)(")/g, (_, before: string, id: string, after: string) => `${before}${this.number(id)}${after}`);
  }

  save() {
    this.source.file(relsPathOf(DOCUMENT), relationshipsXml(this.relationships));
    if (this.styles) this.source.file(STYLES, this.styles);
    if (this.numbering !== undefined) this.source.file(NUMBERING, this.numbering);
  }
}

export async function mergeDocument(original: Uint8Array, generated: Uint8Array, blocks: DocBlocks, current: DocNode[]): Promise<Uint8Array> {
  const [source, fresh] = await Promise.all([JSZip.loadAsync(original), JSZip.loadAsync(generated)]);
  const [sourceXml, freshXml] = [await text(source, DOCUMENT), await text(fresh, DOCUMENT)];
  if (!sourceXml || !freshXml) throw new Error('Document part is missing');
  const kept = bodyOf(sourceXml);
  const built = bodyOf(freshXml);
  const freshGroups = alignBlocks(current, built.children);
  if (!freshGroups || freshGroups.some((group) => group.nodes !== 1)) throw new Error('Generated blocks could not be aligned');
  const weak = current.map((node) => !normalize(nodeText(node)));
  const plan = planBlocks(blocks, matchNodes(blocks.nodes, current.map((node) => contentSignature(node)), weak));
  const transplant = new Transplant(source, fresh, new PartCopier(fresh, source, (await text(fresh, '[Content_Types].xml')) ?? ''));
  await transplant.load();
  const parts: string[] = [];
  for (const piece of plan) {
    if ('group' in piece) {
      parts.push(...kept.children.slice(piece.group.from, piece.group.from + piece.group.count).map((child) => child.xml));
      continue;
    }
    const group = freshGroups[piece.node];
    for (const child of built.children.slice(group.from, group.from + group.count)) parts.push(await transplant.adapt(child.xml));
  }
  transplant.save();
  const rootEnd = sourceXml.indexOf('>', sourceXml.search(/<w:document\b/)) + 1;
  const freshRoot = /<w:document\b[^>]*>/.exec(freshXml)?.[0] ?? '';
  const head = mergeNamespaces(sourceXml.slice(0, rootEnd), freshRoot) + kept.body.head.slice(rootEnd);
  source.file(DOCUMENT, head + parts.join('') + kept.section + kept.body.tail);
  const types = await text(source, '[Content_Types].xml');
  if (types) source.file('[Content_Types].xml', mergeContentTypes(types, transplant.copier));
  return source.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

