import JSZip from 'jszip';
import { openOfficeZip } from './openOfficeZip';

const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const presentation = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
const contentTypes = 'http://schemas.openxmlformats.org/package/2006/content-types';
const main = 'ppt/presentation.xml';
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);

function xml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Cấu trúc XML trong tệp PowerPoint không hợp lệ.');
  return doc;
}

function elements(parent: Element | Document, namespace: string, name: string) {
  return Array.from(parent.getElementsByTagNameNS(namespace, name));
}

function relsPath(part: string) {
  const slash = part.lastIndexOf('/') + 1;
  return part.slice(0, slash) + '_rels/' + part.slice(slash) + '.rels';
}

function resolveTarget(part: string, target: string) {
  const path = new URL(target, 'https://package.invalid/' + part);
  if (path.origin !== 'https://package.invalid' || path.search || path.hash) throw new Error('Liên kết nội bộ PowerPoint không hợp lệ.');
  return path.pathname.slice(1);
}

async function readXml(zip: JSZip, path: string) {
  const entry = zip.file(path);
  if (!entry) throw new Error('Thiếu thành phần PowerPoint: ' + path);
  return xml(await entry.async('string'));
}

async function readRelationships(zip: JSZip, part: string) {
  const path = relsPath(part);
  if (!zip.file(path)) return [];
  return elements(await readXml(zip, path), relationships, 'Relationship');
}

async function readDeck(file: File) {
  const zip = await openOfficeZip(await file.arrayBuffer());
  const doc = await readXml(zip, main);
  if (doc.documentElement.namespaceURI !== presentation) throw new Error('Loại bản trình chiếu PowerPoint này chưa được hỗ trợ.');
  const types = await readXml(zip, '[Content_Types].xml');
  const overrides = new Map(elements(types, contentTypes, 'Override').map(el => [el.getAttribute('PartName')?.slice(1), el.getAttribute('ContentType')]));
  const defaults = new Map(elements(types, contentTypes, 'Default').map(el => [el.getAttribute('Extension')?.toLowerCase(), el.getAttribute('ContentType')]));
  const rels = await readRelationships(zip, main);
  const children = Array.from(doc.documentElement.childNodes).filter((n): n is Element => n.nodeType === 1);
  const list = children.find(el => el.localName === 'sldIdLst');
  const slides = list ? elements(list, presentation, 'sldId').map(el => {
    const rid = el.getAttributeNS(office, 'id');
    const link = rels.find(rel => rel.getAttribute('Id') === rid && rel.getAttribute('Type') === office + '/slide');
    if (!link) throw new Error('Không tìm thấy liên kết đến trang chiếu.');
    return resolveTarget(main, link.getAttribute('Target')!);
  }) : [];
  if (!slides.length) throw new Error('Bản trình chiếu không có trang nào.');
  return { zip, doc, children, slides, rels, overrides, defaults };
}

type Deck = Awaited<ReturnType<typeof readDeck>>;

export async function slidePartLabels(file: File): Promise<string[]> {
  const deck = await readDeck(file);
  return deck.slides.map((_, i) => 'Slide ' + (i + 1));
}

function append(doc: Document, parent: Element, ns: string, name: string, attrs: Record<string, string>) {
  const el = doc.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'r:id') el.setAttributeNS(office, key, value);
    else el.setAttribute(key, value);
  }
  parent.appendChild(el);
  return el;
}

function dimension(deck: Deck) {
  const size = deck.children.find(el => el.localName === 'sldSz');
  return [size?.getAttribute('cx') || '9144000', size?.getAttribute('cy') || '6858000'].join('x');
}

const settingsError = 'Các tệp PowerPoint có thiết lập, kiểu mặc định hoặc mẫu ghi chú không tương thích.';
const unsupportedError = 'Bản trình chiếu có thành phần chưa hỗ trợ bảo toàn khi gộp hoặc tách.';
const presentationLists = new Set(['sldIdLst', 'sldMasterIdLst', 'notesMasterIdLst', 'handoutMasterIdLst']);
const settings = new Set(['sldSz', 'notesSz', 'defaultTextStyle', 'kinsoku', 'photoAlbum', 'extLst']);
const globalParts = ['theme', 'presProps', 'viewProps', 'printerSettings', 'notesMaster', 'handoutMaster'];
const commonLinks = new Set([...globalParts, 'tableStyles', 'slide', 'slideMaster'].map(kind => office + '/' + kind));
const kindOf = (rel: Element) => rel.getAttribute('Type')!.split('/').pop()!;
const partOf = (rel: Element, owner = main) => resolveTarget(owner, rel.getAttribute('Target')!);

function settingSignature(deck: Deck) {
  const attrs = Array.from(deck.doc.documentElement.attributes).filter(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/');
  return JSON.stringify([attrs.map(a => [a.namespaceURI, a.localName, a.value]).sort(), deck.children.filter(el => settings.has(el.localName)).map(serialize)]);
}

async function samePart(left: Deck, leftPart: string, right: Deck, rightPart: string, visited = new Set<string>()): Promise<boolean> {
  const pair = JSON.stringify([leftPart, rightPart]);
  if (visited.has(pair)) return true;
  visited.add(pair);
  const a = await left.zip.file(leftPart)?.async('uint8array');
  const b = await right.zip.file(rightPart)?.async('uint8array');
  if (!a || !b || a.length !== b.length || !a.every((v, i) => v === b[i])) return false;
  const leftRels = await readRelationships(left.zip, leftPart);
  const rightRels = await readRelationships(right.zip, rightPart);
  if (leftRels.length !== rightRels.length) return false;
  for (const rel of leftRels) {
    const other = rightRels.find(r => r.getAttribute('Id') === rel.getAttribute('Id'));
    if (!other || rel.getAttribute('Type') !== other.getAttribute('Type') || rel.getAttribute('TargetMode') !== other.getAttribute('TargetMode')) return false;
    if (rel.getAttribute('TargetMode') === 'External') {
      if (rel.getAttribute('Target') !== other.getAttribute('Target')) return false;
    } else if (!await samePart(left, partOf(rel, leftPart), right, partOf(other, rightPart), visited)) return false;
  }
  return true;
}

async function validateGlobals(deck: Deck, base: Deck) {
  if (deck.children.some(el => el.localName === 'embeddedFontLst' || el.localName === 'custShowLst')
    || deck.rels.some(rel => /\/(commentAuthors|authors|person)$/i.test(rel.getAttribute('Type') || ''))) {
    throw new Error('Chưa hỗ trợ bản trình chiếu có phông chữ nhúng, nhận xét hoặc trình chiếu tùy chỉnh.');
  }
  if (deck.children.some(el => el.namespaceURI !== presentation || !settings.has(el.localName) && !presentationLists.has(el.localName))
    || deck.rels.some(rel => !commonLinks.has(rel.getAttribute('Type')!) || rel.getAttribute('TargetMode') === 'External')) throw new Error(unsupportedError);
  const extList = deck.children.find(el => el.localName === 'extLst');
  if (extList) {
    const guides = 'http://schemas.microsoft.com/office/powerpoint/2012/main';
    for (const ext of Array.from(extList.childNodes).filter((n): n is Element => n.nodeType === 1)) {
      const bodies = Array.from(ext.childNodes).filter((n): n is Element => n.nodeType === 1);
      if (ext.namespaceURI !== presentation || ext.localName !== 'ext' || bodies.length !== 1 || bodies[0].namespaceURI !== guides || bodies[0].localName !== 'sldGuideLst') throw new Error(unsupportedError);
    }
  }
  for (const list of deck.children.filter(el => presentationLists.has(el.localName))) {
    for (const node of Array.from(list.childNodes).filter((n): n is Element => n.nodeType === 1)) {
      if (node.namespaceURI !== presentation || node.localName !== list.localName.slice(0, -3)
        || Array.from(node.childNodes).some(n => n.nodeType === 1)) throw new Error(unsupportedError);
    }
  }
  const allowed = new Set(['officeDocument', 'core-properties', 'extended-properties', 'custom-properties', 'thumbnail']);
  for (const rel of await readRelationships(deck.zip, '')) {
    if (!allowed.has(kindOf(rel))) throw new Error(unsupportedError);
  }
  const table = deck.rels.find(rel => kindOf(rel) === 'tableStyles');
  if (table && (await readRelationships(deck.zip, partOf(table))).length) throw new Error(unsupportedError);
  const props = deck.rels.find(rel => kindOf(rel) === 'presProps');
  if (props) {
    const show = await readXml(deck.zip, partOf(props));
    if (elements(show, presentation, 'sldRg').length || elements(show, presentation, 'custShow').length) throw new Error(unsupportedError);
  }
  if (deck === base) return;
  if (dimension(deck) !== dimension(base)) throw new Error('Các tệp PowerPoint cần có cùng kích thước trang chiếu để gộp.');
  if (Boolean(table) !== base.rels.some(rel => kindOf(rel) === 'tableStyles') || settingSignature(deck) !== settingSignature(base)) throw new Error(settingsError);
  for (const kind of [...globalParts, 'custom-properties']) {
    const root = kind === 'custom-properties';
    const owner = root ? '' : main;
    const first = (root ? await readRelationships(base.zip, '') : base.rels).find(r => kindOf(r) === kind);
    const next = (root ? await readRelationships(deck.zip, '') : deck.rels).find(r => kindOf(r) === kind);
    if (Boolean(first) !== Boolean(next) || first && next && !await samePart(base, partOf(first, owner), deck, partOf(next, owner))) throw new Error(settingsError);
  }
}

async function assemble(selections: { deck: Deck; indices: number[] }[]) {
  const base = selections[0].deck;
  const out = new JSZip();
  const doc = base.doc.cloneNode(true) as Document;
  while (doc.documentElement.firstChild) doc.documentElement.removeChild(doc.documentElement.firstChild);
  const manifest = xml('<Types xmlns="' + contentTypes + '"/>');
  const links = xml('<Relationships xmlns="' + relationships + '"/>');
  const masterList = append(doc, doc.documentElement, presentation, 'p:sldMasterIdLst', {});
  const notesList = append(doc, doc.documentElement, presentation, 'p:notesMasterIdLst', {});
  const handoutList = append(doc, doc.documentElement, presentation, 'p:handoutMasterIdLst', {});
  const slideList = append(doc, doc.documentElement, presentation, 'p:sldIdLst', {});
  const types = new Map<string, string>([[main, 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml']]);
  let nextMaster = 2147483648;
  let nextSlide = 256;
  let nextRel = 1;
  let sharedNotesMaster: string | undefined;
  let tableStyles: Document | undefined;
  let rootRels: Document | undefined;
  const registerRel = (kind: string, target: string) => {
    const id = 'rId' + nextRel++;
    append(links, links.documentElement, relationships, 'Relationship', { Id: id, Type: office + '/' + kind, Target: '/' + target });
    return id;
  };
  for (const { deck, indices } of selections) {
    if (!indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= deck.slides.length) || new Set(indices).size !== indices.length) {
      throw new Error('Danh sách trang chiếu không hợp lệ.');
    }
    await validateGlobals(deck, base);
    const selected = new Set(indices.map(i => deck.slides[i]));
    const mapped = new Map<string, string>();
    const copyPart = async (part: string, kind: string): Promise<string> => {
      const previous = mapped.get(part);
      if (previous) return previous;
      if (kind === 'slide' && !selected.has(part)) throw new Error('Có liên kết đến trang chiếu ngoài phần đã chọn. Hãy chọn các trang liên quan cùng nhau.');
      if (part === main) throw new Error(unsupportedError);
      if (kind === 'notesMaster' && !deck.rels.some(rel => kindOf(rel) === 'notesMaster' && partOf(rel) === part)) throw new Error(unsupportedError);
      if (kind === 'notesMaster' && sharedNotesMaster) {
        mapped.set(part, sharedNotesMaster);
        return sharedNotesMaster;
      }
      const entry = deck.zip.file(part);
      const extension = part.split('.').pop()!.toLowerCase();
      const type = deck.overrides.get(part) || deck.defaults.get(extension);
      if (!entry || !type) throw new Error('Không đọc được thành phần PowerPoint: ' + part);
      let dest = part;
      for (let n = 2; types.has(dest); n++) dest = part.replace(/(\.[^./]+)?$/, '_' + n + '$1');
      types.set(dest, type);
      mapped.set(part, dest);
      if (kind === 'slideMaster') {
        const masterDoc = await readXml(deck.zip, part);
        const id = String(nextMaster++);
        for (const layout of elements(masterDoc, presentation, 'sldLayoutId')) layout.setAttribute('id', String(nextMaster++));
        append(doc, masterList, presentation, 'p:sldMasterId', { id, 'r:id': registerRel(kind, dest) });
        out.file(dest, serialize(masterDoc));
      } else {
        if (kind === 'notesMaster') {
          sharedNotesMaster = dest;
          append(doc, notesList, presentation, 'p:notesMasterId', { 'r:id': registerRel(kind, dest) });
        }
        if (kind === 'extended-properties') {
          const properties = await readXml(deck.zip, part);
          const calculated = new Set(['Slides', 'Notes', 'HiddenSlides', 'MMClips', 'HeadingPairs', 'TitlesOfParts', 'Words', 'Paragraphs', 'Lines', 'Characters', 'TotalTime']);
          for (const field of Array.from(properties.documentElement.childNodes)) {
            if (field.nodeType === 1 && calculated.has((field as Element).localName)) properties.documentElement.removeChild(field);
          }
          out.file(dest, serialize(properties));
        } else out.file(dest, entry.async('uint8array'));
      }
      const rels = await readRelationships(deck.zip, part);
      if (rels.length) {
        const relDoc = rels[0].ownerDocument;
        for (const rel of rels) {
          if (rel.getAttribute('TargetMode') === 'External') continue;
          const target = resolveTarget(part, rel.getAttribute('Target')!);
          const relKind = rel.getAttribute('Type')!.split('/').pop()!;
          const copied = await copyPart(target, relKind);
          rel.setAttribute('Target', '/' + copied);
        }
        out.file(relsPath(dest), serialize(relDoc));
      }
      return dest;
    };
    for (const index of indices) {
      const path = await copyPart(deck.slides[index], 'slide');
      append(doc, slideList, presentation, 'p:sldId', { id: String(nextSlide++), 'r:id': registerRel('slide', path) });
    }
    for (const rel of deck.rels) {
      const kind = kindOf(rel);
      if (kind === 'slideMaster') await copyPart(partOf(rel), kind);
      if (deck !== base || !globalParts.includes(kind)) continue;
      const copied = await copyPart(partOf(rel), kind);
      if (kind === 'notesMaster') continue;
      const id = registerRel(kind, copied);
      if (kind === 'handoutMaster') append(doc, handoutList, presentation, 'p:handoutMasterId', { 'r:id': id });
    }
    if (deck === base) {
      const rootLinks = await readRelationships(deck.zip, '');
      if (!rootLinks.length) throw new Error(unsupportedError);
      rootRels = rootLinks[0].ownerDocument;
      for (const rel of rootLinks) {
        const kind = kindOf(rel);
        if (kind === 'officeDocument') rel.setAttribute('Target', main);
        else if (kind === 'thumbnail') rootRels.documentElement.removeChild(rel);
        else rel.setAttribute('Target', '/' + await copyPart(partOf(rel, ''), kind));
      }
    }
    const tableLink = deck.rels.find(rel => rel.getAttribute('Type') === office + '/tableStyles');
    if (tableLink) {
      const table = await readXml(deck.zip, resolveTarget(main, tableLink.getAttribute('Target')!));
      if (Array.from(table.documentElement.childNodes).some(el => el.nodeType === 1 && ((el as Element).namespaceURI !== drawing || (el as Element).localName !== 'tblStyle'))) throw new Error(unsupportedError);
      if (!tableStyles) tableStyles = table;
      else {
        if (tableStyles.documentElement.getAttribute('def') !== table.documentElement.getAttribute('def')) throw new Error(settingsError);
        const existing = new Map(elements(tableStyles, drawing, 'tblStyle').map(el => [el.getAttribute('styleId'), el]));
        for (const style of elements(table, drawing, 'tblStyle')) {
          const previous = existing.get(style.getAttribute('styleId'));
          if (!previous) tableStyles.documentElement.appendChild(tableStyles.importNode(style, true));
          else if (serialize(previous) !== serialize(style)) throw new Error('Các tệp PowerPoint dùng kiểu bảng trùng mã nhưng khác định dạng.');
        }
      }
    }
  }
  if (!masterList.firstChild) doc.documentElement.removeChild(masterList);
  if (!notesList.firstChild) doc.documentElement.removeChild(notesList);
  if (!handoutList.firstChild) doc.documentElement.removeChild(handoutList);
  for (const child of base.children.filter(el => settings.has(el.localName))) doc.documentElement.appendChild(doc.importNode(child, true));
  if (tableStyles) {
    const path = 'ppt/tableStyles.xml';
    types.set(path, 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml');
    out.file(path, serialize(tableStyles));
    registerRel('tableStyles', path);
  }
  append(manifest, manifest.documentElement, contentTypes, 'Default', { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' });
  for (const [path, type] of types) append(manifest, manifest.documentElement, contentTypes, 'Override', { PartName: '/' + path, ContentType: type });
  out.file('[Content_Types].xml', serialize(manifest));
  out.file('_rels/.rels', serialize(rootRels!));
  out.file(main, serialize(doc));
  out.file(relsPath(main), serialize(links));
  return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function mergeSlideFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('Chọn ít nhất hai tệp PowerPoint để gộp.');
  const selections = [];
  for (const file of files) {
    const deck = await readDeck(file);
    selections.push({ deck, indices: deck.slides.map((_, i) => i) });
  }
  return assemble(selections);
}

export async function splitSlideFile(file: File, groups: number[][]): Promise<Uint8Array[]> {
  const deck = await readDeck(file);
  if (!groups.length) throw new Error('Chọn trang chiếu cần tách.');
  const files = [];
  for (const indices of groups) files.push(await assemble([{ deck, indices }]));
  return files;
}
