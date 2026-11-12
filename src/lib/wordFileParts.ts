import JSZip from 'jszip';
import { openOfficeZip } from './openOfficeZip';
import { buildWordPageMap } from './wordPageMap';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN = 'word/document.xml';
const TYPES = '[Content_Types].xml';

const serialize = (node: Node) => new XMLSerializer().serializeToString(node);
const children = (node: Element) => Array.from(node.childNodes).filter((n): n is Element => n.nodeType === 1);
const elements = (node: Element | Document, ns: string, name: string) => Array.from(node.getElementsByTagNameNS(ns, name));
const wAttr = (el: Element, name: string) => el.getAttributeNS(W, name) || '';
const setW = (el: Element, name: string, value: string) => el.setAttributeNS(W, 'w:' + name, value);
const word = (el: Element, name: string) => el.namespaceURI === W && el.localName === name;
const isRelAttr = (attr: Attr) => attr.namespaceURI === R || (attr.namespaceURI === 'urn:schemas-microsoft-com:office:office' && attr.localName === 'relid');
const relPath = (path: string) => path ? path.replace(/([^/]+)$/, '_rels/$1.rels') : '_rels/.rels';
const pack = (zip: JSZip) => zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

function parse(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.documentElement.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('Không đọc được cấu trúc XML của tệp Word.');
  }
  return doc;
}

async function readXml(zip: JSZip, path: string) {
  const entry = zip.file(path);
  if (!entry) throw new Error('Tệp Word thiếu thành phần ' + path);
  return parse(await entry.async('string'));
}

async function readWord(file: File) {
  const zip = await openOfficeZip(await file.arrayBuffer());
  if (Object.keys(zip.files).some(path => path.startsWith('_xmlsignatures/'))) {
    throw new Error('Không thể thay đổi DOCX mà vẫn giữ chữ ký số của tài liệu.');
  }
  const doc = await readXml(zip, MAIN);
  const body = elements(doc, W, 'body')[0];
  if (!body) throw new Error('Chỉ hỗ trợ tài liệu Word DOCX tiêu chuẩn.');
  const parts = children(body).filter(el => !(el.namespaceURI === W && el.localName === 'sectPr'));
  return { zip, doc, body, parts };
}

export async function wordPartLabels(file: File): Promise<string[]> {
  const { parts } = await readWord(file);
  return parts.map((el) => {
    const label = elements(el, W, 't').map(t => t.textContent).join('').replace(/\s+/g, ' ').trim();
    if (el.localName === 'tbl') return label ? 'Bảng · ' + label.slice(0, 64) : 'Bảng';
    return label.slice(0, 70) || (elements(el, W, 'drawing').length ? 'Hình ảnh' : 'Đoạn văn');
  });
}

function appendSection(body: Element, section: Element) {
  const doc = body.ownerDocument;
  const last = children(body).filter(el => el !== section).at(-1);
  if (last?.namespaceURI === W && last.localName === 'p') {
    let props = children(last).find(el => el.namespaceURI === W && el.localName === 'pPr');
    if (!props) {
      props = doc.createElementNS(W, 'w:pPr');
      last.insertBefore(props, last.firstChild);
    }
    if (!children(props).some(el => el.namespaceURI === W && el.localName === 'sectPr')) {
      props.appendChild(section);
      return;
    }
  }
  const paragraph = doc.createElementNS(W, 'w:p');
  const properties = doc.createElementNS(W, 'w:pPr');
  properties.appendChild(section);
  paragraph.appendChild(properties);
  body.appendChild(paragraph);
}

function sectionReferences(section: Element) {
  return children(section).filter(el => word(el, 'headerReference') || word(el, 'footerReference'));
}

function refKey(el: Element) {
  return el.localName + ':' + wAttr(el, 'type');
}

function inheritSectionReferences(sections: (Element | undefined)[]) {
  const inherited = new Map<string, Element>();
  for (const section of new Set(sections)) {
    if (!section) continue;
    const refs = sectionReferences(section);
    const specified = new Set(refs.map(refKey));
    for (const [key, ref] of inherited) {
      if (!specified.has(key)) section.insertBefore(ref.cloneNode(true), section.firstChild);
    }
    for (const ref of refs) inherited.set(refKey(ref), ref);
  }
}

function resetIncomingSections(base: WordPackage, source: WordPackage, types: Document, rels: Document, ids: Set<string>, folder: string) {
  let first = elements(source.body, W, 'sectPr')[0];
  if (!first) {
    first = source.doc.createElementNS(W, 'w:sectPr');
    source.body.appendChild(first);
  }
  const specified = new Set(sectionReferences(first).map(refKey));
  const previous = new Map(elements(base.body, W, 'sectPr').flatMap(sectionReferences).map(ref => [refKey(ref), ref]));
  const blanks = new Map<string, string>();
  for (const [key, prior] of previous) {
    if (specified.has(key)) continue;
    const header = word(prior, 'headerReference');
    const kind = header ? 'header' : 'footer';
    let id = blanks.get(kind);
    if (!id) {
      id = freshId(ids, 'ms_blank_' + kind);
      const tag = header ? 'hdr' : 'ftr';
      const path = folder + 'empty-' + kind + '.xml';
      base.zip.file(path, '<w:' + tag + ' xmlns:w="' + W + '"><w:p/></w:' + tag + '>');
      const override = types.createElementNS(CT, 'Override');
      override.setAttribute('PartName', '/' + path);
      override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.' + kind + '+xml');
      types.documentElement.appendChild(override);
      const rel = rels.createElementNS(REL, 'Relationship');
      rel.setAttribute('Id', id);
      rel.setAttribute('Type', R + '/' + kind);
      rel.setAttribute('Target', '/' + path);
      rels.documentElement.appendChild(rel);
      blanks.set(kind, id);
    }
    const ref = source.doc.importNode(prior, false);
    ref.setAttributeNS(R, 'r:id', id);
    first.insertBefore(ref, first.firstChild);
  }
}

const EXPLICIT_RELATIONSHIPS = new Set([
  'image', 'hyperlink', 'chart', 'diagramData', 'diagramLayout', 'diagramQuickStyle',
  'diagramColors', 'header', 'footer', 'aFChunk', 'oleObject', 'package', 'audio', 'video',
]);

const NOTE_PARTS: Record<string, [string, string]> = {
  footnotes: ['footnote', 'footnoteReference'],
  endnotes: ['endnote', 'endnoteReference'],
  comments: ['comment', 'commentReference'],
};

type PageFieldContext = { total: number; count: number; sections: Map<string, Set<number>> };

function preservePageTotals(doc: Document, pageFields: PageFieldContext, sections: Set<number> | undefined, headerOrFooter = false) {
  const rewrite = (instruction: string) => {
    if (headerOrFooter && /^\s*(?:STYLEREF|REF|PAGEREF|NOTEREF|SEQ|FILENAME|SECTION|NUMWORDS|NUMCHARS)\b/i.test(instruction)) {
      throw new Error('Đầu trang hoặc chân trang chứa trường Word phụ thuộc vào nội dung ngoài khoảng trang.');
    }
    return instruction.replace(/^(\s*)(NUMPAGES|SECTIONPAGES)\b/i, (_, pad: string, field: string) => {
      if (field.toUpperCase() === 'NUMPAGES') return pad + '= ' + pageFields.total;
      if (sections?.size !== 1) throw new Error('Trường SECTIONPAGES dùng chung cho nhiều section có số trang khác nhau.');
      return pad + '= ' + [...sections][0];
    });
  };
  for (const el of elements(doc, W, 'fldSimple')) setW(el, 'instr', rewrite(wAttr(el, 'instr')));
  const fields: Element[][] = [];
  for (const el of elements(doc, W, '*')) {
    if (word(el, 'fldChar') && wAttr(el, 'fldCharType') === 'begin') fields.push([]);
    if (word(el, 'instrText')) fields.at(-1)?.push(el);
    if (word(el, 'fldChar') && ['separate', 'end'].includes(wAttr(el, 'fldCharType')) && fields.length) {
      const runs = fields.at(-1)!;
      const before = runs.map(run => run.textContent ?? '').join('');
      const after = rewrite(before);
      if (after !== before) {
        runs[0].textContent = after;
        for (const continuation of runs.slice(1)) continuation.textContent = '';
      }
      runs.length = 0;
      if (wAttr(el, 'fldCharType') === 'end') fields.pop();
    }
  }
}

async function writeSelection(original: JSZip, document: Document, pageFields?: PageFieldContext) {
  const zip = new JSZip();
  Object.assign(zip.files, original.files);
  zip.file(MAIN, serialize(document));
  const kept = new Set([TYPES]);
  async function keep(owner: string, xml?: Document) {
    if (kept.has(owner)) return;
    kept.add(owner);
    const path = owner ? relPath(owner) : '_rels/.rels';
    if (!zip.file(path)) return;
    kept.add(path);
    const rels = await readXml(zip, path);
    const ids = new Set<string>();
    if (xml) {
      for (const el of elements(xml, '*', '*')) {
        for (const attr of Array.from(el.attributes)) if (isRelAttr(attr)) ids.add(attr.value);
      }
    }
    for (const rel of relationships(rels)) {
      const kind = rel.getAttribute('Type')!.split('/').pop()!;
      if (kind === 'thumbnail' || (xml && EXPLICIT_RELATIONSHIPS.has(kind) && !ids.has(rel.getAttribute('Id')!))) {
        rel.parentNode!.removeChild(rel);
        continue;
      }
      if (rel.getAttribute('TargetMode') === 'External') continue;
      const target = targetPath(owner, rel.getAttribute('Target')!);
      let child: Document | undefined;
      if (target === MAIN) child = document;
      else if (pageFields && owner === MAIN && (kind === 'header' || kind === 'footer')) {
        child = await readXml(zip, target);
        preservePageTotals(child, pageFields, pageFields.sections.get(rel.getAttribute('Id')!), true);
        zip.file(target, serialize(child));
      }
      else if (pageFields && kind === 'extended-properties') {
        child = await readXml(zip, target);
        let pages = elements(child, '*', 'Pages')[0];
        if (!pages) {
          pages = child.createElementNS(child.documentElement.namespaceURI, 'Pages');
          child.documentElement.appendChild(pages);
        }
        pages.textContent = String(pageFields.count);
        zip.file(target, serialize(child));
      }
      else if (owner === MAIN && NOTE_PARTS[kind]) {
        const [tag, ref] = NOTE_PARTS[kind];
        const referenced = new Set(elements(document, W, ref).map(el => wAttr(el, 'id')));
        child = await readXml(zip, target);
        for (const note of elements(child, W, tag)) {
          if (!wAttr(note, 'type') && !referenced.has(wAttr(note, 'id'))) note.parentNode!.removeChild(note);
        }
        zip.file(target, serialize(child));
      }
      await keep(target, child);
    }
    zip.file(path, serialize(rels));
  }
  await keep('');
  const types = await readXml(zip, TYPES);
  for (const declaration of elements(types, CT, 'Override')) {
    if (!kept.has(decodeURI(declaration.getAttribute('PartName')!.slice(1)))) declaration.parentNode!.removeChild(declaration);
  }
  for (const [path, entry] of Object.entries(zip.files)) if (!entry.dir && !kept.has(path)) zip.remove(path);
  zip.file(TYPES, serialize(types));
  return pack(zip);
}

async function selectionValidator(pkg: WordPackage) {
  const styles = await definitions(pkg, await readRelationships(pkg.zip, MAIN), 'styles');
  const styleList = styles ? elements(styles.doc, W, 'style') : [];
  const styleIds = new Map(styleList.map(style => [wAttr(style, 'styleId'), style]));
  const listOf = (p: Element) => {
    let current: Element | undefined = p;
    const seen = new Set<Element>();
    while (current && !seen.has(current)) {
      seen.add(current);
      const props: Element | undefined = children(current).find(el => word(el, 'pPr'));
      const num = props && elements(props, W, 'numId')[0];
      if (num) return wAttr(num, 'val');
      const next: Element | undefined = word(current, 'p') ? props && elements(props, W, 'pStyle')[0] : children(current).find(el => word(el, 'basedOn'));
      current = next ? styleIds.get(wAttr(next, 'val')) : undefined;
    }
    return '';
  };
  const listIds = pkg.parts.map(part => new Set(
    (word(part, 'p') ? [part] : elements(part, W, 'p')).map(listOf).filter(id => id && id !== '0'),
  ));
  const priorListItem = new Map<string, number>();
  const required = listIds.map((ids, index) => {
    const predecessors: number[] = [];
    for (const id of ids) {
      const prior = priorListItem.get(id);
      if (prior !== undefined) predecessors.push(prior);
      priorListItem.set(id, index);
    }
    return predecessors;
  });
  const ranges: [number, number][] = [];
  const starts = new Map<string, number>();
  const fields: number[] = [];
  const bookmarks = new Map<string, number>();
  const comments = new Map<string, number[]>();
  for (const [i, part] of pkg.parts.entries()) {
    for (const el of elements(part, W, '*')) {
      if (word(el, 'bookmarkStart')) bookmarks.set(wAttr(el, 'name'), i);
      if (['commentRangeStart', 'commentRangeEnd', 'commentReference'].includes(el.localName)) {
        const id = wAttr(el, 'id');
        const marks = comments.get(id) || [];
        marks.push(i);
        comments.set(id, marks);
      }
      if (word(el, 'fldChar')) {
        if (wAttr(el, 'fldCharType') === 'begin') fields.push(i);
        if (wAttr(el, 'fldCharType') === 'end' && fields.length) ranges.push([fields.pop()!, i]);
      }
      const match = /^(bookmark|commentRange|moveFromRange|moveToRange|perm|customXml\w+Range)(Start|End)$/.exec(el.localName);
      if (!match) continue;
      const key = match[1] + ':' + wAttr(el, 'id');
      if (match[2] === 'Start') starts.set(key, i);
      else if (starts.has(key)) ranges.push([starts.get(key)!, i]);
    }
  }
  return (groups: number[][]) => {
    for (const group of groups) {
      if (!group.length || group.some(i => !Number.isInteger(i) || i < 0 || i >= pkg.parts.length)) throw new Error('Phạm vi tách Word không hợp lệ.');
      const positions = new Map(group.map((i, j) => [i, j]));
      for (const marks of comments.values()) {
        if (marks.some(i => positions.has(i)) && marks.some(i => !positions.has(i))) {
          throw new Error('Dải chọn cắt ngang dấu trang, bình luận hoặc trường Word. Hãy chọn trọn phần liên quan.');
        }
      }
      for (const [start, end] of ranges) {
        if (!group.some(i => i >= start && i <= end)) continue;
        const first = positions.get(start);
        if (first === undefined || group.slice(first, first + end - start + 1).length !== end - start + 1 ||
            group.slice(first, first + end - start + 1).some((i, offset) => i !== start + offset)) {
          throw new Error('Dải chọn cắt ngang dấu trang, bình luận hoặc trường Word. Hãy chọn trọn phần liên quan.');
        }
      }
      const seen = new Set<number>();
      for (const i of group) {
        if (required[i].some(prior => !seen.has(prior))) throw new Error('Dải chọn làm thay đổi số thứ tự danh sách Word. Hãy chọn từ đầu danh sách.');
        seen.add(i);
        for (const link of elements(pkg.parts[i], W, 'hyperlink')) {
          const target = bookmarks.get(wAttr(link, 'anchor'));
          if (target !== undefined && !positions.has(target)) throw new Error('Dải chọn bỏ mất dấu trang đích của liên kết Word.');
        }
        const codes = elements(pkg.parts[i], W, 'instrText').map(el => el.textContent || '').join(' ') + ' ' +
          elements(pkg.parts[i], W, 'fldSimple').map(el => wAttr(el, 'instr')).join(' ');
        for (const match of codes.matchAll(/\b(?:REF|PAGEREF|NOTEREF)\s+"?([\w.-]+)/gi)) {
          const target = bookmarks.get(match[1]);
          if (target !== undefined && !positions.has(target)) throw new Error('Dải chọn bỏ mất dấu trang đích của liên kết Word.');
        }
      }
    }
  };
}

export async function splitWordFile(file: File, groups: number[][]): Promise<Uint8Array[]> {
  const pkg = await readWord(file);
  const validate = await selectionValidator(pkg);
  validate(groups);
  const { zip, doc, body, parts } = pkg;
  const finalSection = children(body).find(el => el.namespaceURI === W && el.localName === 'sectPr');
  let section = finalSection;
  const sections = parts.map(() => finalSection);
  for (let i = parts.length - 1; i >= 0; i--) {
    const properties = children(parts[i]).find(el => el.namespaceURI === W && el.localName === 'pPr');
    const end = properties && children(properties).find(el => el.namespaceURI === W && el.localName === 'sectPr');
    if (end) {
      section = end;
      properties.removeChild(end);
    }
    sections[i] = section;
  }
  inheritSectionReferences(sections);
  const results: Uint8Array[] = [];
  for (const group of groups) {
    while (body.firstChild) body.removeChild(body.firstChild);
    for (const [position, i] of group.entries()) {
      body.appendChild(parts[i].cloneNode(true));
      const current = sections[i];
      if (!current) continue;
      if (position === group.length - 1) body.appendChild(current.cloneNode(true));
      else if (current !== sections[group[position + 1]]) appendSection(body, current.cloneNode(true) as Element);
    }
    results.push(await writeSelection(zip, doc));
  }
  return results;
}

export type WordPageLayoutInput = Parameters<typeof buildWordPageMap>[3];

async function readPageMap(file: File, layout?: WordPageLayoutInput) {
  const pkg = await readWord(file);
  const rels = await readRelationships(pkg.zip, MAIN);
  const [styles, settings] = await Promise.all([definitions(pkg, rels, 'styles'), definitions(pkg, rels, 'settings')]);
  const app = relationships(await readRelationships(pkg.zip, '')).find(rel => rel.getAttribute('Type')?.endsWith('/extended-properties'));
  const appXml = app && await readXml(pkg.zip, targetPath('', app.getAttribute('Target')!));
  const count = appXml && Number(elements(appXml, '*', 'Pages')[0]?.textContent);
  const map = buildWordPageMap(pkg.body, styles?.doc, count && count > 0 ? count : undefined, layout, settings?.doc);
  return { pkg, map, styles: styles?.doc };
}

export async function wordPageLabels(file: File, layout?: WordPageLayoutInput): Promise<string[]> {
  const { map } = await readPageMap(file, layout);
  return Array.from({ length: map.pageCount }, (_, index) => `Trang ${index + 1}`);
}

function pageNumberStart(section: Element, number: number) {
  let numbering = children(section).find(el => word(el, 'pgNumType'));
  if (!numbering) {
    numbering = section.ownerDocument.createElementNS(W, 'w:pgNumType');
    const following = new Set(['cols', 'formProt', 'vAlign', 'noEndnote', 'titlePg', 'textDirection', 'bidi', 'rtlGutter', 'docGrid', 'printerSettings', 'sectPrChange']);
    section.insertBefore(numbering, children(section).find(el => following.has(el.localName)) ?? null);
  }
  setW(numbering, 'start', String(number));
}

function extractSectionLayout(pkg: WordPackage, map: ReturnType<typeof buildWordPageMap>) {
  const layout: { node: Element; start: number; end: number; startPage: number; display: number; pages: number }[] = [];
  let start = 0;
  for (let i = 0; i < pkg.parts.length; i++) {
    const el = pkg.parts[i];
    const properties = word(el, 'p') && children(el).find(child => word(child, 'pPr'));
    const section = properties && children(properties).find(child => word(child, 'sectPr'));
    if (!section && i < pkg.parts.length - 1) continue;
    const source = section || children(pkg.body).find(child => word(child, 'sectPr'));
    const node = source?.cloneNode(true) as Element | undefined ?? pkg.doc.createElementNS(W, 'w:sectPr');
    const startPage = map.pageOfBlock(start);
    const previous = layout.at(-1);
    const num = children(node).find(child => word(child, 'pgNumType'));
    const display: number = num?.hasAttributeNS(W, 'start') ? Number(wAttr(num, 'start'))
      : previous ? previous.display + startPage - previous.startPage : 1;
    layout.push({ node, start, end: i, startPage, display, pages: 0 });
    start = i + 1;
  }
  inheritSectionReferences(layout.map(section => section.node));
  layout.forEach((section, i) => { section.pages = (layout[i + 1]?.startPage ?? map.pageCount) - section.startPage; });
  return layout;
}

function sectionForPageOutput(node: Element, midSection: boolean) {
  if (!midSection) return;
  const title = children(node).find(child => word(child, 'titlePg'));
  if (title) node.removeChild(title);
  for (const ref of sectionReferences(node)) if (wAttr(ref, 'type') === 'first') node.removeChild(ref);
  const border = children(node).find(child => word(child, 'pgBorders'));
  if (border && wAttr(border, 'display') === 'firstPage') node.removeChild(border);
  else if (border && wAttr(border, 'display') === 'notFirstPage') setW(border, 'display', 'allPages');
}

const FLOW_DEPENDENT_PARAGRAPH = 'Dải trang cắt ngang đoạn văn có định dạng phụ thuộc vào vị trí dòng. Hãy chọn trọn đoạn văn.';

function preservePartialParagraph(source: Element, block: Element, styles: Document | undefined, cutStart: boolean, cutEnd: boolean) {
  if (!word(source, 'p')) throw new Error(FLOW_DEPENDENT_PARAGRAPH);
  const text = (p: Element) => elements(p, W, 't').map(el => el.textContent).join('');
  const original = text(source);
  const selected = text(block);
  const markers = /^(?:fldChar|fldSimple|instrText|hyperlink|bookmarkStart|bookmarkEnd|footnoteReference|endnoteReference|commentReference|commentRangeStart|commentRangeEnd|permStart|permEnd|drawing|pict|object|moveFrom|moveTo|ins|del|sdt)$/;
  if (elements(source, W, '*').some(el => markers.test(el.localName))) throw new Error(FLOW_DEPENDENT_PARAGRAPH);
  if (original === selected) return;
  const props = children(source).find(el => word(el, 'pPr'));
  const sources: Element[] = props ? [props] : [];
  const all = styles ? elements(styles, W, 'style') : [];
  const byId = new Map(all.map(el => [wAttr(el, 'styleId'), el]));
  const styleId = props && children(props).find(el => word(el, 'pStyle'));
  let style = styleId ? byId.get(wAttr(styleId, 'val')) : all.find(el => wAttr(el, 'type') === 'paragraph' && ['1', 'true', 'on'].includes(wAttr(el, 'default')));
  const seen = new Set<Element>();
  while (style && !seen.has(style)) {
    seen.add(style);
    const definition = children(style).find(el => word(el, 'pPr'));
    if (definition) sources.push(definition);
    const base = children(style).find(el => word(el, 'basedOn'));
    style = base ? byId.get(wAttr(base, 'val')) : undefined;
  }
  const defaults = styles && elements(styles, W, 'pPrDefault')[0];
  if (defaults) sources.push(...children(defaults).filter(el => word(el, 'pPr')));
  const property = (name: string) => sources.map(p => children(p).find(el => word(el, name))).find(el => el !== undefined);
  const alignment = property('jc');
  if (property('numPr') || property('framePr') || property('pBdr') || (cutEnd && alignment && !['left', 'right', 'center', 'start', 'end'].includes(wAttr(alignment, 'val')))) {
    throw new Error(FLOW_DEPENDENT_PARAGRAPH);
  }
  const doc = block.ownerDocument;
  let target = children(block).find(el => word(el, 'pPr'));
  if (!target) {
    target = doc.createElementNS(W, 'w:pPr');
    block.insertBefore(target, block.firstChild);
  }
  function setProperty(name: string, following: string[]) {
    const item = children(target!).find(el => word(el, name));
    if (item) return item;
    const result = doc.createElementNS(W, 'w:' + name);
    target!.insertBefore(result, children(target!).find(el => following.includes(el.localName)) ?? null);
    return result;
  }
  const following = ['contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
  if (cutStart || cutEnd) {
    const spacing = setProperty('spacing', ['ind', ...following]);
    for (const side of [...(cutStart ? ['before'] : []), ...(cutEnd ? ['after'] : [])]) {
      for (const suffix of ['', 'Lines', 'Autospacing']) setW(spacing, side + suffix, '0');
    }
  }
  if (cutStart) {
    const indent = setProperty('ind', following);
    for (const key of ['firstLine', 'firstLineChars', 'hanging', 'hangingChars']) setW(indent, key, '0');
  }
}

export async function splitWordPages(file: File, groups: number[][], layout?: WordPageLayoutInput): Promise<Uint8Array[]> {
  const { pkg, map, styles } = await readPageMap(file, layout);
  const sections = extractSectionLayout(pkg, map);
  const validate = await selectionValidator(pkg);
  const doc = pkg.doc.cloneNode(true) as Document;
  const body = elements(doc, W, 'body')[0];
  const results: Uint8Array[] = [];
  for (const group of groups) {
    const first = group[0];
    const last = group.at(-1)!;
    if (!group.length || group.some((p, i) => !Number.isInteger(p) || p < 0 || p >= map.pageCount || p !== first + i)) {
      throw new Error('Mỗi tệp Word cần một khoảng trang liên tiếp trong phạm vi tài liệu.');
    }
    if (first === 0 && group.length === map.pageCount) {
      results.push(new Uint8Array(await file.arrayBuffer()));
      continue;
    }
    if (sections.some((section, i) => {
      const kind = children(section.node).find(el => word(el, 'type'));
      const numbers = children(section.node).find(el => word(el, 'lnNumType'));
      return section.pages <= 0 || (i > 0 && kind && wAttr(kind, 'val') !== 'nextPage')
        || (numbers && wAttr(numbers, 'restart') !== 'newPage');
    })) throw new Error('Tài liệu có ngắt section hoặc đánh số dòng cần giữ toàn bộ bố cục gốc.');
    const pieces = map.slice(first, last);
    if (!pieces.length) throw new Error('Trang Word đã chọn không có nội dung xác định được.');
    validate([pieces.map(part => part.index)]);
    while (body.firstChild) body.removeChild(body.firstChild);
    const fields: PageFieldContext = { total: map.pageCount, count: group.length, sections: new Map() };
    const lengths = new Set<number>();
    let sectionIndex = 0;
    for (const [i, piece] of pieces.entries()) {
      while (sectionIndex < sections.length && piece.index > sections[sectionIndex].end) sectionIndex++;
      const section = sections[sectionIndex];
      if (!section) throw new Error('Không xác định được section của trang Word đã chọn.');
      const block = doc.importNode(piece.node, true);
      if (piece.partial) preservePartialParagraph(pkg.parts[piece.index], block, styles, piece.cutStart, piece.cutEnd);
      const properties = word(block, 'p') && children(block).find(el => word(el, 'pPr'));
      const end = properties && children(properties).find(el => word(el, 'sectPr'));
      if (end) properties.removeChild(end);
      body.appendChild(block);
      const next = pieces[i + 1];
      if (next && next.index <= section.end) continue;
      const output = doc.importNode(section.node, true);
      const offset = Math.max(0, first - section.startPage);
      sectionForPageOutput(output, offset > 0);
      const firstSection = pieces[0].index >= section.start && pieces[0].index <= section.end;
      if (firstSection) {
        pageNumberStart(output, layout?.pageNumbers?.[first] ?? section.display + offset);
      }
      lengths.add(section.pages);
      for (const ref of sectionReferences(output)) {
        const key = ref.getAttributeNS(R, 'id')!;
        const used = fields.sections.get(key) ?? new Set<number>();
        used.add(section.pages);
        fields.sections.set(key, used);
      }
      if (next) appendSection(body, output);
      else body.appendChild(output);
    }
    preservePageTotals(doc, fields, lengths);
    results.push(await writeSelection(pkg.zip, doc, fields));
  }
  return results;
}

function targetPath(owner: string, target: string) {
  const url = new URL(target, 'https://package.local/' + owner);
  if (url.origin !== 'https://package.local' || url.search || url.hash) throw new Error('Liên kết nội bộ DOCX không hợp lệ.');
  return decodeURI(url.pathname.slice(1));
}

function relationships(doc: Document) {
  return elements(doc, REL, 'Relationship');
}

async function readRelationships(zip: JSZip, owner: string) {
  const path = relPath(owner);
  return zip.file(path) ? readXml(zip, path) : parse('<Relationships xmlns="' + REL + '"/>');
}

type Definition = { doc: Document; path: string };
type WordPackage = Awaited<ReturnType<typeof readWord>>;

async function definitions(pkg: WordPackage, rels: Document, kind: string): Promise<Definition | undefined> {
  const rel = relationships(rels).find(el => el.getAttribute('Type')?.split('/').pop() === kind);
  if (!rel) return undefined;
  const path = targetPath(MAIN, rel.getAttribute('Target')!);
  return { doc: await readXml(pkg.zip, path), path };
}

function signature(el: Element): string {
  const attrs = Array.from(el.attributes)
    .filter(attr => attr.namespaceURI !== 'http://www.w3.org/2000/xmlns/')
    .map(attr => [attr.namespaceURI || '', attr.localName, attr.value].join('\u0001')).sort();
  const content = Array.from(el.childNodes).map(node => {
    if (node.nodeType === 1) return signature(node as Element);
    return node.nodeValue?.trim() ? node.nodeValue : '';
  }).join('');
  return JSON.stringify([el.namespaceURI, el.localName, attrs]) + '(' + content + ')';
}

function settingsSignature(el: Element) {
  const clone = el.cloneNode(true) as Element;
  for (const name of ['rsids', 'docId', 'view', 'zoom', 'proofState']) {
    for (const item of elements(clone, '*', name)) item.parentNode!.removeChild(item);
  }
  return signature(clone);
}

const GLOBAL_MISMATCH = 'Hai tệp Word dùng thiết lập toàn tài liệu khác nhau. Không thể gộp mà giữ nguyên định dạng của cả hai.';
const STYLE_MISMATCH = 'Hai tệp Word dùng kiểu mặc định khác nhau. Không thể gộp mà giữ nguyên định dạng của cả hai.';

function implicitStyle(el: Element) {
  return ['true', '1', 'on'].includes(wAttr(el, 'default')) ||
    ['Normal', 'DefaultParagraphFont', 'TableNormal'].includes(wAttr(el, 'styleId'));
}

function copyRootNamespaces(base: Element, source: Element) {
  const mc = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
  for (const attr of Array.from(source.attributes)) {
    if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') {
      const current = base.getAttributeNS(attr.namespaceURI, attr.localName);
      if (current && current !== attr.value) throw new Error(GLOBAL_MISMATCH);
      if (!current) base.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    } else if (attr.namespaceURI === mc && attr.localName === 'Ignorable') {
      const prefixes = new Set((base.getAttributeNS(mc, 'Ignorable') || '').split(/\s+/).filter(Boolean));
      attr.value.split(/\s+/).forEach(value => prefixes.add(value));
      base.setAttributeNS(mc, attr.name, Array.from(prefixes).join(' '));
    } else if (attr.value !== base.getAttributeNS(attr.namespaceURI, attr.localName)) throw new Error(GLOBAL_MISMATCH);
  }
}

async function checkGlobalParts(base: WordPackage, baseRels: Document, source: WordPackage, sourceRels: Document) {
  const customData = async (pkg: WordPackage, rels: Document) => {
    const entries: string[] = [];
    for (const rel of relationships(rels).filter(item => item.getAttribute('Type') === R + '/customXml')) {
      const path = targetPath(MAIN, rel.getAttribute('Target')!);
      const xml = await readXml(pkg.zip, path);
      const root = xml.documentElement;
      if (root.localName === 'Sources' && root.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/bibliography' && !children(root).length && !root.textContent?.trim()) continue;
      const props: string[] = [];
      for (const link of relationships(await readRelationships(pkg.zip, path))) {
        if (link.getAttribute('Type') !== R + '/customXmlProps') throw new Error('Không thể gộp DOCX có dữ liệu XML tùy chỉnh khác nhau.');
        const linked = targetPath(path, link.getAttribute('Target')!);
        if (relationships(await readRelationships(pkg.zip, linked)).length) throw new Error('Không thể gộp DOCX có dữ liệu XML tùy chỉnh khác nhau.');
        props.push(signature((await readXml(pkg.zip, linked)).documentElement));
      }
      entries.push(JSON.stringify([signature(root), props.sort()]));
    }
    return new Set(entries);
  };
  const [existingData, incomingData] = await Promise.all([customData(base, baseRels), customData(source, sourceRels)]);
  if (Array.from(incomingData).some(data => !existingData.has(data))) throw new Error('Không thể gộp DOCX có dữ liệu XML tùy chỉnh khác nhau.');
  for (const kind of ['theme', 'settings', 'webSettings', 'stylesWithEffects', 'fontTable']) {
    const [a, b] = await Promise.all([definitions(base, baseRels, kind), definitions(source, sourceRels, kind)]);
    if (Boolean(a) !== Boolean(b)) throw new Error(GLOBAL_MISMATCH);
    if (!a || !b) continue;
    for (const [pkg, part] of [[base, a], [source, b]] as const) {
      if (relationships(await readRelationships(pkg.zip, part.path)).length) {
        throw new Error('Không thể gộp DOCX có phông chữ nhúng, mẫu liên kết hoặc chủ đề chứa tài nguyên phụ thuộc.');
      }
    }
    if (kind === 'fontTable') {
      const fonts = new Map(elements(a.doc, W, 'font').map(font => [wAttr(font, 'name'), font]));
      for (const font of elements(b.doc, W, 'font')) {
        const existing = fonts.get(wAttr(font, 'name'));
        if (existing && signature(existing) !== signature(font)) throw new Error(GLOBAL_MISMATCH);
        if (!existing) a.doc.documentElement.appendChild(a.doc.importNode(font, true));
      }
      base.zip.file(a.path, serialize(a.doc));
      continue;
    }
    const compare = kind === 'settings' ? settingsSignature : signature;
    if (compare(a.doc.documentElement) !== compare(b.doc.documentElement)) throw new Error(GLOBAL_MISMATCH);
  }
  const backgrounds = (pkg: WordPackage) => children(pkg.doc.documentElement).filter(el => word(el, 'background')).map(signature).join();
  if (backgrounds(base) !== backgrounds(source)) throw new Error(GLOBAL_MISMATCH);
  if (children(source.doc.documentElement).some(el => word(el, 'background') && children(el).length)) throw new Error(GLOBAL_MISMATCH);
}

function checkDefaultStyles(current: Definition | undefined, incoming: Definition | undefined) {
  const relevant = (part: Definition | undefined) => part ? children(part.doc.documentElement)
    .filter(el => !word(el, 'style') || implicitStyle(el))
    .map(signature).sort().join('') : '';
  if (relevant(current) !== relevant(incoming)) throw new Error(STYLE_MISMATCH);
  for (const part of [current, incoming]) {
    if (!part) continue;
    const styles = new Map(elements(part.doc, W, 'style').map(el => [wAttr(el, 'styleId'), el]));
    for (const style of styles.values()) {
      if (!implicitStyle(style)) continue;
      if (elements(style, W, 'basedOn').length || elements(style, W, 'numPr').length) throw new Error(STYLE_MISMATCH);
    }
  }
}

function freshId(existing: Set<string>, prefix: string) {
  let id = prefix;
  let i = 1;
  while (existing.has(id)) id = prefix + '_' + i++;
  existing.add(id);
  return id;
}

function setSectionEnd(body: Element) {
  const section = children(body).find(el => el.namespaceURI === W && el.localName === 'sectPr');
  if (section) {
    appendSection(body, section);
    return;
  }
  appendSection(body, body.ownerDocument.createElementNS(W, 'w:sectPr'));
}

function uniqueNumbers(target: Document, source: Document, tag: string, key: string) {
  const map = new Map<string, string>();
  let next = elements(target, W, tag).reduce((n, el) => Math.max(n, Number(wAttr(el, key)) || 0), 0) + 1;
  for (const el of elements(source, W, tag)) {
    const id = String(next++);
    map.set(wAttr(el, key), id);
    setW(el, key, id);
  }
  return map;
}

function remapValues(root: Element, tags: string[], map: Map<string, string>) {
  for (const tag of tags) {
    for (const el of elements(root, W, tag)) {
      const mapped = map.get(wAttr(el, 'val'));
      if (mapped) setW(el, 'val', mapped);
    }
  }
}

export async function mergeWordFiles(files: File[]): Promise<Uint8Array> {
  if (!files.length) throw new Error('Chọn tệp Word để gộp.');
  const base = await readWord(files[0]);
  const types = await readXml(base.zip, TYPES);
  const rels = await readRelationships(base.zip, MAIN);
  const ids = new Set(relationships(rels).map(rel => rel.getAttribute('Id')!));
  const def = new Map<string, Definition | undefined>();
  for (const kind of ['styles', 'numbering']) def.set(kind, await definitions(base, rels, kind));
  let drawingId = elements(base.doc, '*', 'docPr').reduce((max, el) => Math.max(max, Number(el.getAttribute('id')) || 0), 0);
  const bookmarkNames = new Set(elements(base.doc, W, 'bookmarkStart').map(el => wAttr(el, 'name')));
  let bookmarkId = elements(base.doc, W, 'bookmarkStart').reduce((max, el) => Math.max(max, Number(wAttr(el, 'id')) || 0), 0);
  for (const [index, file] of files.slice(1).entries()) {
    const source = await readWord(file);
    const sourceRels = await readRelationships(source.zip, MAIN);
    copyRootNamespaces(base.doc.documentElement, source.doc.documentElement);
    await checkGlobalParts(base, rels, source, sourceRels);
    await checkDefaultStyles(def.get('styles'), await definitions(source, sourceRels, 'styles'));
    const sourceTypes = await readXml(source.zip, TYPES);
    let folder = 'merged' + (index + 2) + '/';
    while (Object.keys(base.zip.files).some(path => path.startsWith(folder))) folder = '_' + folder;
    const copied = new Set<string>();
    const styleMap = new Map<string, string>();
    const styleNumbers = new Map<string, string>();
    let numMap = new Map<string, string>();
    function rewrite(root: Element) {
      if (styleNumbers.size) for (const p of elements(root, W, 'p')) {
        const props = children(p).find(el => word(el, 'pPr'));
        const named = props && children(props).find(el => word(el, 'pStyle'));
        const num = named && styleNumbers.get(wAttr(named, 'val'));
        if (!num || !props) continue;
        let numbering = children(props).find(el => word(el, 'numPr'));
        if (!numbering) {
          numbering = p.ownerDocument.createElementNS(W, 'w:numPr');
          const before = children(props).find(el => !['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl'].includes(el.localName));
          props.insertBefore(numbering, before || null);
        }
        if (!children(numbering).some(el => word(el, 'numId'))) {
          const id = p.ownerDocument.createElementNS(W, 'w:numId');
          setW(id, 'val', num);
          numbering.insertBefore(id, children(numbering).find(el => !word(el, 'ilvl')) || null);
        }
      }
      remapValues(root, ['pStyle', 'rStyle', 'tblStyle', 'basedOn', 'next', 'link', 'numStyleLink', 'styleLink'], styleMap);
      remapValues(root, ['numId'], numMap);
      for (const drawing of elements(root, '*', 'docPr')) drawing.setAttribute('id', String(++drawingId));
    }
    async function copyPart(path: string): Promise<string> {
      const dest = folder + path;
      if (copied.has(path)) return dest;
      copied.add(path);
      const entry = source.zip.file(path);
      if (!entry) throw new Error('Tệp Word thiếu thành phần ' + path);
      const extension = path.split('.').at(-1)?.toLowerCase();
      const override = elements(sourceTypes, CT, 'Override').find(el => el.getAttribute('PartName') === '/' + path);
      const fallback = elements(sourceTypes, CT, 'Default').find(el => el.getAttribute('Extension')?.toLowerCase() === extension);
      const mime = (override || fallback)?.getAttribute('ContentType');
      if (!mime) throw new Error('Không xác định được kiểu dữ liệu của ' + path);
      const declaration = types.createElementNS(CT, 'Override');
      declaration.setAttribute('PartName', '/' + dest);
      declaration.setAttribute('ContentType', mime);
      types.documentElement.appendChild(declaration);
      if (mime.endsWith('+xml') || mime === 'application/xml') {
        const xml = await readXml(source.zip, path);
        rewrite(xml.documentElement);
        base.zip.file(dest, serialize(xml));
      } else base.zip.file(dest, await entry.async('uint8array'));
      if (source.zip.file(relPath(path))) {
        const dependencies = await readRelationships(source.zip, path);
        for (const rel of relationships(dependencies)) {
          if (rel.getAttribute('TargetMode') === 'External') continue;
          const linked = targetPath(path, rel.getAttribute('Target')!);
          rel.setAttribute('Target', '/' + await copyPart(linked));
        }
        base.zip.file(relPath(dest), serialize(dependencies));
      }
      return dest;
    }
    const incoming = new Map<string, Definition>();
    for (const kind of ['styles', 'numbering']) {
      const part = await definitions(source, sourceRels, kind);
      if (!part) continue;
      if (source.zip.file(relPath(part.path))) {
        throw new Error('Không thể gộp DOCX có kiểu định dạng hoặc danh sách tham chiếu tài nguyên ngoài phần định nghĩa.');
      }
      incoming.set(kind, part);
      if (!def.get(kind)) {
        const empty = parse(serialize(part.doc.documentElement.cloneNode(false)));
        const dest = folder + part.path;
        def.set(kind, { path: dest, doc: empty });
        const rel = rels.createElementNS(REL, 'Relationship');
        rel.setAttribute('Id', freshId(ids, 'ms_' + kind));
        rel.setAttribute('Type', R + '/' + kind);
        rel.setAttribute('Target', '/' + dest);
        rels.documentElement.appendChild(rel);
        const declaration = types.createElementNS(CT, 'Override');
        declaration.setAttribute('PartName', '/' + dest);
        declaration.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.' + kind + '+xml');
        types.documentElement.appendChild(declaration);
      }
    }
    const styles = incoming.get('styles');
    const numbers = incoming.get('numbering');
    const hasFields = (root: Element) => elements(root, W, 'instrText').length > 0 || elements(root, W, 'fldSimple').length > 0;
    const shareStyles = styles && signature(styles.doc.documentElement) === signature(def.get('styles')!.doc.documentElement);
    if (shareStyles) {
      incoming.delete('styles');
      const byId = new Map(elements(styles.doc, W, 'style').map(el => [wAttr(el, 'styleId'), el]));
      for (const [id, style] of byId) {
        let current: Element | undefined = style;
        const seen = new Set<Element>();
        while (current && !seen.has(current)) {
          seen.add(current);
          const number = elements(current, W, 'numId')[0];
          if (number) {
            styleNumbers.set(id, wAttr(number, 'val'));
            break;
          }
          const parent: Element | undefined = children(current).find(el => word(el, 'basedOn'));
          current = parent ? byId.get(wAttr(parent, 'val')) : undefined;
        }
      }
      if (styleNumbers.size && numbers && elements(numbers.doc, W, 'numStyleLink').length) throw new Error(STYLE_MISMATCH);
    }
    if (styles && !shareStyles) {
      if (await definitions(source, sourceRels, 'stylesWithEffects')) throw new Error(STYLE_MISMATCH);
      const existing = new Set(elements(def.get('styles')!.doc, W, 'style').map(el => wAttr(el, 'styleId')));
      for (const el of elements(styles.doc, W, 'style')) {
        const old = wAttr(el, 'styleId');
        if (implicitStyle(el)) {
          el.parentNode!.removeChild(el);
          continue;
        }
        const id = freshId(existing, 'M' + (index + 2) + '_' + old);
        styleMap.set(old, id);
        setW(el, 'styleId', id);
        const name = children(el).find(node => word(node, 'name'));
        if (name) setW(name, 'val', 'M' + (index + 2) + ' ' + wAttr(name, 'val'));
      }
    }
    if (numbers) {
      const target = def.get('numbering')!.doc;
      const abstract = uniqueNumbers(target, numbers.doc, 'abstractNum', 'abstractNumId');
      numMap = uniqueNumbers(target, numbers.doc, 'num', 'numId');
      remapValues(numbers.doc.documentElement, ['abstractNumId'], abstract);
      if (elements(numbers.doc, W, 'numPicBullet').length) throw new Error('Chưa thể gộp tệp Word có danh sách dùng ảnh làm dấu đầu dòng.');
    }
    for (const [kind, part] of incoming) {
      rewrite(part.doc.documentElement);
      const dest = def.get(kind)!.doc;
      copyRootNamespaces(dest.documentElement, part.doc.documentElement);
      for (const el of children(part.doc.documentElement)) {
        if (kind === 'styles' && el.localName !== 'style') continue;
        if (kind === 'numbering' && !['abstractNum', 'num'].includes(el.localName)) continue;
        const before = el.localName === 'abstractNum' ? elements(dest, W, 'num')[0] : null;
        dest.documentElement.insertBefore(dest.importNode(el, true), before || null);
      }
    }
    rewrite(source.body);
    const bookmarkIds = new Map<string, string>();
    const renamedBookmarks = new Map<string, string>();
    for (const start of elements(source.body, W, 'bookmarkStart')) {
      const original = wAttr(start, 'name');
      if (original) {
        const name = freshId(bookmarkNames, original);
        if (name !== original) renamedBookmarks.set(original, name);
        setW(start, 'name', name);
      }
      const id = String(++bookmarkId);
      bookmarkIds.set(wAttr(start, 'id'), id);
      setW(start, 'id', id);
    }
    for (const end of elements(source.body, W, 'bookmarkEnd')) {
      const id = bookmarkIds.get(wAttr(end, 'id'));
      if (id) setW(end, 'id', id);
    }
    for (const link of elements(source.body, W, 'hyperlink')) {
      const name = renamedBookmarks.get(wAttr(link, 'anchor'));
      if (name) setW(link, 'anchor', name);
    }
    if (renamedBookmarks.size && hasFields(source.body)) throw new Error('Tệp Word có trường tham chiếu và tên dấu trang trùng với tệp trước.');
    if (['ins', 'del', 'moveFrom', 'moveTo', 'customXml', 'placeholder'].some(name => elements(source.body, W, name).length)) {
      throw new Error('Chưa thể gộp tệp Word bổ sung có theo dõi thay đổi hoặc điều khiển nội dung phụ thuộc vào tài liệu.');
    }
    const fields = elements(source.body, W, 'instrText').map(el => el.textContent).join('') + ' ' +
      elements(source.body, W, 'fldSimple').map(el => wAttr(el, 'instr')).join(' ');
    if (/\b(?:DOCPROPERTY|DOCVARIABLE|STYLEREF|INCLUDETEXT|TOC|SEQ|AUTONUM\w*|NUMPAGES|FILENAME)\b/i.test(fields)) {
      throw new Error('Tệp Word có trường tự động phụ thuộc vào tên, thuộc tính hoặc nội dung toàn tài liệu.');
    }
    if (['footnoteReference', 'endnoteReference', 'commentReference', 'commentRangeStart', 'dataBinding'].some(name => elements(source.body, W, name).length)) {
      throw new Error('Chưa thể gộp DOCX có chú thích, bình luận hoặc liên kết dữ liệu ở tệp bổ sung.');
    }
    const dependencies = new Map(relationships(sourceRels).map(rel => [rel.getAttribute('Id'), rel]));
    const used = new Map<string, string>();
    for (const el of elements(source.body, '*', '*')) {
      for (const attr of Array.from(el.attributes)) {
        if (!isRelAttr(attr)) continue;
        const oldId = attr.value;
        let id = used.get(oldId);
        if (!id) {
          const dependency = dependencies.get(oldId);
          if (!dependency) throw new Error('Liên kết DOCX bị thiếu trong ' + file.name);
          const rel = rels.importNode(dependency, true);
          id = freshId(ids, 'ms_' + (index + 2) + '_' + oldId);
          rel.setAttribute('Id', id);
          if (rel.getAttribute('TargetMode') !== 'External') {
            rel.setAttribute('Target', '/' + await copyPart(targetPath(MAIN, rel.getAttribute('Target')!)));
          }
          rels.documentElement.appendChild(rel);
          used.set(oldId, id);
        }
        el.setAttributeNS(attr.namespaceURI, attr.name, id);
      }
    }
    resetIncomingSections(base, source, types, rels, ids, folder);
    setSectionEnd(base.body);
    for (const el of children(source.body)) base.body.appendChild(base.doc.importNode(el, true));
  }
  for (const item of def.values()) if (item) base.zip.file(item.path, serialize(item.doc));
  base.zip.file(MAIN, serialize(base.doc));
  base.zip.file(relPath(MAIN), serialize(rels));
  base.zip.file(TYPES, serialize(types));
  return pack(base.zip);
}
