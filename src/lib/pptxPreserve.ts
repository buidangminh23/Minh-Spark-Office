import JSZip from 'jszip';
import { PartCopier, attribute, mergeContentTypes, readRelationships, relationshipsXml, relsPathOf, resolveTarget, type Relationship } from './xlsxPreserve';

const PRESENTATION = 'ppt/presentation.xml';
const RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FIRST_SLIDE_ID = 256;
const FIRST_LAYOUT_ID = 2147483648;
const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';
const MASTER_PART =/^ppt\/slideMasters\/[^/]+\.xml$/;

export type SlidePlan = { from: 'source' | 'generated'; index: number };

export function planSlides(sourceSignatures: string[], currentSignatures: string[]): SlidePlan[] {
  const free = new Map<string, number[]>();
  sourceSignatures.forEach((signature, index) => free.set(signature, [...(free.get(signature) ?? []), index]));
  const take = (signature: string, preferred: number) => {
    const candidates = free.get(signature);
    if (!candidates?.length) return -1;
    const at = candidates.includes(preferred) ? candidates.indexOf(preferred) : 0;
    return candidates.splice(at, 1)[0];
  };
  return currentSignatures.map((signature, index) => {
    const source = take(signature, index);
    return source < 0 ? { from: 'generated', index } : { from: 'source', index: source };
  });
}

const text = (zip: JSZip, path: string) => zip.file(path)?.async('string');
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function slideEntries(zip: JSZip) {
  const xml = (await text(zip, PRESENTATION)) ?? '';
  const relationships = readRelationships(await text(zip, relsPathOf(PRESENTATION)));
  const byId = new Map(relationships.map((item) => [item.id, item]));
  const entries = [...(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/.exec(xml)?.[1] ?? '').matchAll(/<p:sldId\b[^>]*\/>/g)].map(([tag]) => {
    const relationship = byId.get(attribute(tag, 'r:id'));
    return { tag, id: Number(attribute(tag, 'id')), relId: attribute(tag, 'r:id'), path: relationship ? resolveTarget(PRESENTATION, relationship.target) : '' };
  });
  return { xml, relationships, entries };
}

const maxNumber = (xml: string, pattern: RegExp, floor: number) =>
  [...xml.matchAll(pattern)].reduce((highest, match) => Math.max(highest, Number(match[1]) || 0), floor);

async function highestLayoutId(zip: JSZip, presentationXml: string) {
  let highest = maxNumber(presentationXml, /<p:sldMasterId\b[^>]*\bid="(\d+)"/g, FIRST_LAYOUT_ID);
  for (const path of Object.keys(zip.files)) {
    if (!MASTER_PART.test(path)) continue;
    highest = maxNumber((await text(zip, path)) ?? '', /<p:sldLayoutId\b[^>]*\bid="(\d+)"/g, highest);
  }
  return highest;
}

const nextRelId = (relationships: Relationship[]) => {
  const used = new Set(relationships.map((item) => item.id));
  let number = relationships.length + 1;
  while (used.has(`rId${number}`)) number += 1;
  return `rId${number}`;
};

type PresentationState = { xml: string; relationships: Relationship[] };

async function registerMasters(output: JSZip, masters: string[], state: PresentationState) {
  let nextId = (await highestLayoutId(output, state.xml)) + 1;
  const added: string[] = [];
  for (const path of masters) {
    const xml = (await text(output, path)) ?? '';
    output.file(path, xml.replace(/(<p:sldLayoutId\b[^>]*\bid=")\d+(")/g, (_, before: string, after: string) => `${before}${nextId++}${after}`));
    const relId = nextRelId(state.relationships);
    state.relationships.push({ id: relId, type: `${RELATIONSHIP}/slideMaster`, target: `/${path}`, external: false });
    added.push(`<p:sldMasterId id="${nextId++}" r:id="${relId}"/>`);
  }
  if (!added.length) return;
  state.xml = /<p:sldMasterIdLst>/.test(state.xml)
    ? state.xml.replace('</p:sldMasterIdLst>', `${added.join('')}</p:sldMasterIdLst>`)
    : state.xml.replace(/(<p:presentation\b[^>]*>)/, `$1<p:sldMasterIdLst>${added.join('')}</p:sldMasterIdLst>`);
}

function syncSections(xml: string, removedIds: number[], addedIds: number[]) {
  let result = xml;
  for (const id of removedIds) result = result.replace(new RegExp(`<p14:sldId\\b[^>]*\\bid="${id}"[^>]*/>`, 'g'), '');
  if (!addedIds.length || !/<p14:sectionLst\b/.test(result)) return result;
  const extra = addedIds.map((id) => `<p14:sldId id="${id}"/>`).join('');
  const last = result.lastIndexOf('</p14:sldIdLst>');
  return last < 0 ? result : result.slice(0, last) + extra + result.slice(last);
}

async function notesMasterPath(zip: JSZip) {
  const relationship = readRelationships(await text(zip, relsPathOf(PRESENTATION))).find((item) => item.type.endsWith('/notesMaster'));
  return relationship ? resolveTarget(PRESENTATION, relationship.target) : null;
}

async function ownNotesTheme(output: JSZip, copier: PartCopier, notesMaster: string) {
  const relsPath = relsPathOf(notesMaster);
  const relationships = readRelationships(await text(output, relsPath));
  const theme = relationships.find((item) => item.type.endsWith('/theme'));
  const themePath = theme ? resolveTarget(notesMaster, theme.target) : '';
  const bytes = await output.file(themePath)?.async('uint8array');
  if (!theme || !bytes) return;
  let ownPath = themePath.replace(/([^/]+)$/, 'notes_$1');
  for (let attempt = 1; output.file(ownPath); attempt += 1) ownPath = themePath.replace(/([^/]+)$/, `notes${attempt}_$1`);
  output.file(ownPath, bytes);
  copier.contentTypes.set(ownPath, THEME_TYPE);
  output.file(relsPath, relationshipsXml(relationships.map((item) => (item === theme ? { ...item, target: `/${ownPath}` } : item))));
}

async function registerNotesMaster(output: JSZip, copier: PartCopier, freshNotes: string, state: PresentationState) {
  const copied = await copier.copy(freshNotes);
  if (!copied || /<p:notesMasterIdLst>/.test(state.xml)) return;
  await ownNotesTheme(output, copier, copied);
  const relId = nextRelId(state.relationships);
  state.relationships.push({ id: relId, type: `${RELATIONSHIP}/notesMaster`, target: `/${copied}`, external: false });
  state.xml = state.xml.replace('</p:sldMasterIdLst>', `</p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="${relId}"/></p:notesMasterIdLst>`);
}

export async function mergePresentation(original: Uint8Array, generated: Uint8Array, plan: SlidePlan[]): Promise<Uint8Array> {
  const output = await JSZip.loadAsync(original);
  const fresh = await JSZip.loadAsync(generated);
  const base = await slideEntries(output);
  const built = await slideEntries(fresh);
  const copier = new PartCopier(fresh, output, (await text(fresh, '[Content_Types].xml')) ?? '');
  const [baseNotes, freshNotes] = [await notesMasterPath(output), await notesMasterPath(fresh)];
  if (baseNotes && freshNotes) copier.alias(freshNotes, baseNotes);
  const mastersBefore = new Set(Object.keys(output.files).filter((path) => MASTER_PART.test(path)));
  const slideRelationships = base.relationships.filter((item) => item.type.endsWith('/slide'));
  const state: PresentationState = { xml: base.xml, relationships: base.relationships.filter((item) => !item.type.endsWith('/slide')) };
  let nextSlideId = base.entries.reduce((highest, entry) => Math.max(highest, entry.id), FIRST_SLIDE_ID - 1) + 1;
  const kept = new Set<number>();
  const tags: string[] = [];
  const addedIds: number[] = [];
  for (const step of plan) {
    if (step.from === 'source') {
      const entry = base.entries[step.index];
      const relationship = slideRelationships.find((item) => item.id === entry?.relId);
      if (!entry?.path || !relationship || kept.has(step.index)) throw new Error('Original slide is missing');
      kept.add(step.index);
      state.relationships.push(relationship);
      tags.push(entry.tag);
      continue;
    }
    const sourcePath = built.entries[step.index]?.path;
    const copied = sourcePath ? await copier.copy(sourcePath) : null;
    if (!copied) throw new Error('Generated slide is missing');
    const relId = nextRelId([...state.relationships, ...slideRelationships]);
    state.relationships.push({ id: relId, type: `${RELATIONSHIP}/slide`, target: `/${copied}`, external: false });
    addedIds.push(nextSlideId);
    tags.push(`<p:sldId id="${nextSlideId++}" r:id="${relId}"/>`);
  }
  const removed = base.entries.filter((_, index) => !kept.has(index));
  const removedParts: string[] = [];
  for (const entry of removed) {
    const notes = readRelationships(await text(output, relsPathOf(entry.path))).filter((item) => item.type.endsWith('/notesSlide'));
    removedParts.push(entry.path, ...notes.map((item) => resolveTarget(entry.path, item.target)));
  }
  for (const path of removedParts) {
    output.remove(path);
    output.remove(relsPathOf(path));
  }
  await registerMasters(output, Object.keys(output.files).filter((path) => MASTER_PART.test(path) && !mastersBefore.has(path)), state);
  if (!baseNotes && freshNotes && addedIds.length) await registerNotesMaster(output, copier, freshNotes, state);
  const list = `<p:sldIdLst>${tags.join('')}</p:sldIdLst>`;
  state.xml = /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/.test(state.xml) ? state.xml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, list) : state.xml.replace(/<p:sldIdLst\/>/, list);
  output.file(PRESENTATION, syncSections(state.xml, removed.map((entry) => entry.id), addedIds));
  output.file(relsPathOf(PRESENTATION), relationshipsXml(state.relationships));
  let types = mergeContentTypes((await text(output, '[Content_Types].xml')) ?? '', copier);
  for (const path of removedParts) types = types.replace(new RegExp(`<Override\\b[^>]*PartName="/${escapePattern(path)}"[^>]*/>`), '');
  output.file('[Content_Types].xml', types);
  return output.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
