import JSZip from 'jszip';
import { openOfficeZip } from './openOfficeZip';

const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN = 'xl/workbook.xml';
const TYPES = '[Content_Types].xml';
const incompatible = () => new Error('Các tệp Excel có thiết lập hoặc tài nguyên không tương thích để giữ nguyên định dạng.');
const unsupported = () => new Error('Tệp Excel có thành phần chưa hỗ trợ bảo toàn khi gộp hoặc tách.');
const dependency = () => new Error('Công thức hoặc liên kết phụ thuộc trang tính ngoài nhóm. Hãy giữ các trang liên quan cùng nhau.');
const children = (el: Element) => Array.from(el.childNodes).filter((node): node is Element => node.nodeType === 1);
const elements = (doc: Document | Element, name: string) => Array.from(doc.getElementsByTagNameNS('*', name));
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);
const attr = (el: Element, key: string) => el.getAttribute(key) ?? '';
const relPath = (part: string) => part ? part.replace(/([^/]+)$/, '_rels/$1.rels') : '_rels/.rels';

function parse(text: string) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagName('parsererror').length || doc.doctype) throw unsupported();
  return doc;
}

async function readXml(zip: JSZip, path: string) {
  const entry = zip.file(path);
  if (!entry) throw unsupported();
  return parse(await entry.async('string'));
}

function signature(el?: Element): string {
  const tree = (node: Element): unknown[] => {
    const nested = children(node);
    return [node.namespaceURI, node.localName,
      Array.from(node.attributes).filter(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/' && a.name !== 'xmlns').map(a => [a.namespaceURI ?? '', a.localName, a.value]).sort(),
      nested.map(tree), nested.length ? '' : node.textContent ?? ''];
  };
  return el ? JSON.stringify(tree(el)) : '';
}

function resolve(part: string, target: string) {
  const url = new URL(target, 'https://office.invalid/' + part);
  if (url.origin !== 'https://office.invalid' || url.search || url.hash) throw unsupported();
  return decodeURI(url.pathname.slice(1));
}

function relative(part: string, target: string) {
  const base = part.split('/').slice(0, -1);
  const path = target.split('/');
  while (base.length && base[0] === path[0]) { base.shift(); path.shift(); }
  return '../'.repeat(base.length) + path.map(encodeURIComponent).join('/');
}

async function links(zip: JSZip, part: string) {
  if (!zip.file(relPath(part))) return [];
  const doc = await readXml(zip, relPath(part));
  return elements(doc, 'Relationship').map(el => ({
    el, id: attr(el, 'Id'), kind: attr(el, 'Type'), path: attr(el, 'TargetMode') === 'External' ? null : resolve(part, attr(el, 'Target')),
  }));
}

async function openBook(file: File) {
  const zip = await openOfficeZip(await file.arrayBuffer());
  const doc = await readXml(zip, MAIN);
  if (doc.documentElement.namespaceURI !== S) throw unsupported();
  const sheetList = elements(doc, 'sheets')[0];
  const rels = await links(zip, MAIN);
  const sheets = children(sheetList).map(el => {
    const rel = rels.find(item => item.id === el.getAttributeNS(R, 'id'));
    if (!rel?.path || rel.kind !== R + '/worksheet') throw unsupported();
    return { el, name: attr(el, 'name'), path: rel.path };
  });
  if (!sheets.length) throw unsupported();
  const types = await readXml(zip, TYPES);
  const overrides = new Map(elements(types, 'Override').map(el => [decodeURI(attr(el, 'PartName').slice(1)), attr(el, 'ContentType')]));
  const defaults = new Map(elements(types, 'Default').map(el => [attr(el, 'Extension').toLowerCase(), attr(el, 'ContentType')]));
  const part = (kind: string) => rels.find(r => r.kind === R + '/' + kind)?.path;
  const strings = part('sharedStrings');
  const styles = part('styles');
  const theme = part('theme');
  const rootRels = await links(zip, '');
  const allowedRoot = new Set([R + '/officeDocument', R + '/extended-properties', R + '/custom-properties', P + '/metadata/core-properties']);
  if (rootRels.some(r => !allowedRoot.has(r.kind)) || rels.some(r => !['worksheet','styles','theme','sharedStrings','calcChain'].some(kind => r.kind === R + '/' + kind))) throw unsupported();
  const allowed = new Set(['fileVersion','workbookPr','workbookProtection','bookViews','sheets','definedNames','calcPr']);
  for (const el of children(doc.documentElement)) {
    if (allowed.has(el.localName) && el.namespaceURI === S) continue;
    if (el.localName === 'revisionPtr' && el.namespaceURI === 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision') continue;
    if (el.localName === 'AlternateContent' && elements(el,'*').every(e => ['Choice','absPath'].includes(e.localName))) continue;
    if (el.localName === 'extLst' && elements(el,'*').every(e => ['ext','calcFeatures','feature'].includes(e.localName))) continue;
    throw unsupported();
  }
  const protection = elements(doc,'workbookProtection')[0];
  if (protection && Array.from(protection.attributes).some(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/')) throw unsupported();
  return { file, zip, doc, sheets, rels, rootRels, overrides, defaults, styles: styles ? await readXml(zip, styles) : undefined,
    theme: theme ? await readXml(zip, theme) : undefined, strings: strings ? children((await readXml(zip, strings)).documentElement) : [], part };
}

type Book = Awaited<ReturnType<typeof openBook>>;


export async function excelPartLabels(file: File) {
  return (await openBook(file)).sheets.map(sheet => sheet.name);
}

function availableName(name: string, used: Set<string>) {
  let candidate = name;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ' (' + i + ')';
    candidate = name.slice(0, 31 - suffix.length).replace(/[\uD800-\uDBFF]$/, '') + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

type StyleMap = { xfs: number[]; dxfs: number[] };

function combineStyles(base: Document | undefined, source: Document | undefined, initial: boolean): StyleMap {
  if (!base && !source) return { xfs: [0], dxfs: [] };
  if (!base || !source) throw incompatible();
  const dst = base.documentElement;
  const src = source.documentElement;
  const section = (node: Element, name: string) => children(node).find(el => el.localName === name);
  const items = (node: Element, name: string) => { const el = section(node, name); return el ? children(el) : []; };
  if (initial || signature(dst) === signature(src)) return {
    xfs: items(src, 'cellXfs').map((_, i) => i), dxfs: items(src, 'dxfs').map((_, i) => i),
  };
  const order = ['numFmts','fonts','fills','borders','cellStyleXfs','cellXfs','cellStyles','dxfs','tableStyles','colors','extLst'];
  if (children(src).some(el => !order.includes(el.localName)) || ['tableStyles','colors','extLst'].some(name => signature(section(dst, name)) !== signature(section(src, name)))) throw incompatible();
  if (items(src,'tableStyles').length) throw incompatible();
  const ensure = (name: string) => {
    let el = section(dst, name);
    if (!el) {
      el = base.createElementNS(S, name);
      dst.insertBefore(el, children(dst).find(e => order.indexOf(e.localName) > order.indexOf(name)) ?? null);
    }
    return el;
  };
  const numberFormats = new Map<number, number>();
  for (const fmt of items(src, 'numFmts')) {
    const num = Number(attr(fmt, 'numFmtId'));
    const list = ensure('numFmts');
    const existing = children(list);
    const same = existing.find(el => attr(el,'formatCode') === attr(fmt,'formatCode'));
    let id = num;
    if (same) id = Number(attr(same, 'numFmtId'));
    else {
      if (id < 164) throw incompatible();
      const used = new Set(existing.map(el => Number(attr(el,'numFmtId'))));
      while (used.has(id)) id++;
      const clone = base.importNode(fmt, true);
      clone.setAttribute('numFmtId', String(id));
      list.appendChild(clone);
      list.setAttribute('count', String(existing.length + 1));
    }
    numberFormats.set(num, id);
  }
  const maps = new Map<string, number[]>();
  for (const name of ['fonts','fills','borders','cellStyleXfs','cellXfs','cellStyles','dxfs']) {
    const incoming = items(src, name);
    const mapping: number[] = [];
    maps.set(name, mapping);
    if (!incoming.length) continue;
    const list = ensure(name);
    const originals = children(list);
    const signatures = new Map<string,number>();
    originals.forEach((el,i) => {
      const key = signature(el);
      if (!signatures.has(key)) signatures.set(key,i);
    });
    for (const [index, item] of incoming.entries()) {
      const clone = base.importNode(item, true);
      for (const [attribute, kind] of [['fontId','fonts'],['fillId','fills'],['borderId','borders'],['xfId','cellStyleXfs']]) {
        if (!clone.hasAttribute(attribute)) continue;
        const value = maps.get(kind)?.[Number(attr(clone,attribute))];
        if (value === undefined) throw incompatible();
        clone.setAttribute(attribute, String(value));
      }
      for (const el of [clone, ...elements(clone,'numFmt')]) {
        const key = Number(attr(el,'numFmtId'));
        if (el.hasAttribute('numFmtId') && numberFormats.has(key)) el.setAttribute('numFmtId', String(numberFormats.get(key)));
      }
      const sig = signature(clone);
      let id = signatures.get(sig);
      if (id === undefined) {
        if (name === 'cellStyles' && originals.some(el => attr(el,'name').toLowerCase() === attr(clone,'name').toLowerCase())) throw incompatible();
        id = children(list).length;
        list.appendChild(clone);
        signatures.set(sig, id);
        list.setAttribute('count', String(id + 1));
      }
      if (index === 0 && ['fonts','fills','borders','cellXfs','cellStyleXfs'].includes(name) && id !== 0) throw incompatible();
      mapping.push(id);
    }
  }
  return { xfs: maps.get('cellXfs')!, dxfs: maps.get('dxfs')! };
}

function rewriteFormula(value: string, names: Map<string,string>, omitted: Set<string>, changed: boolean) {
  if (!changed) return value;
  if (/\b(?:INDIRECT|SHEETS?|HYPERLINK)\s*\(/i.test(value)) throw dependency();
  return value.replace(/"(?:[^"]|"")*"|('(?:[^']|'')+'|[\p{L}\p{M}\p{N}_.]+)(?::('(?:[^']|'')+'|[\p{L}\p{M}\p{N}_.]+))?!/gu, (token, raw, end) => {
    if (!raw) return token;
    const name = raw.startsWith("'") ? raw.slice(1, -1).replaceAll("''", "'") : raw;
    if (end || name.includes(':') || omitted.has(name.toLowerCase())) throw dependency();
    const destination = names.get(name.toLowerCase());
    if (!destination) throw dependency();
    return destination === name ? token : "'" + destination.replaceAll("'", "''") + "'!";
  });
}

const allowedChildren = new Set(['worksheet','drawing','chart','image','table','comments','vmlDrawing','printerSettings','hyperlink','themeOverride','chartUserShapes','chartStyle','chartColorStyle']);

function freshPath(path: string, used: Set<string>) {
  if (!used.has(path)) return path;
  const match = /^(.*?)(\d+)?(\.[^./]+)$/.exec(path);
  if (!match) throw unsupported();
  let index = Number(match[2] || 0) + 1;
  let next = match[1] + index + match[3];
  while (used.has(next)) next = match[1] + ++index + match[3];
  return next;
}

function appendElement(doc: Document, parent: Element, ns: string, name: string, attrs: Record<string,string>) {
  const el = doc.createElementNS(ns, name);
  for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
  parent.appendChild(el);
  return el;
}

async function assemble(input: { book: Book; indices: number[] }[]) {
  const base = input[0].book;
  const out = new JSZip();
  const workbook = base.doc.cloneNode(true) as Document;
  const sheetList = elements(workbook,'sheets')[0];
  while (sheetList.firstChild) sheetList.removeChild(sheetList.firstChild);
  const oldNames = elements(workbook, 'definedNames')[0];
  if (oldNames) oldNames.parentNode!.removeChild(oldNames);
  const definitions = workbook.createElementNS(S,'definedNames');
  const bookRels = parse('<Relationships xmlns="' + P + '"/>');
  const types = parse('<Types xmlns="' + CT + '"/>');
  appendElement(types,types.documentElement,CT,'Default',{ Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' });
  const usedPaths = new Set<string>([MAIN]);
  const addType = (book: Book, source: string, dest: string) => {
    const type = book.overrides.get(source) || book.defaults.get(source.split('.').at(-1)!.toLowerCase());
    if (!type) throw unsupported();
    appendElement(types,types.documentElement,CT,'Override',{ PartName: '/' + dest, ContentType: type });
  };
  const addBookRel = (kind: string, path: string) => {
    const id = 'rId' + (children(bookRels.documentElement).length + 1);
    appendElement(bookRels,bookRels.documentElement,P,'Relationship',{ Id: id, Type: R + '/' + kind, Target: relative(MAIN,path) });
    return id;
  };
  out.file('_rels/.rels', await base.zip.file('_rels/.rels')!.async('uint8array'));
  addType(base,MAIN,MAIN);
  for (const rel of base.rootRels) {
    if (!rel.path || rel.path === MAIN) continue;
    if (!base.zip.file(rel.path) || base.zip.file(relPath(rel.path))) throw unsupported();
    usedPaths.add(rel.path);
    addType(base,rel.path,rel.path);
    out.file(rel.path, await base.zip.file(rel.path)!.async('uint8array'));
  }
  const styles = base.styles?.cloneNode(true) as Document | undefined;
  for (const kind of ['styles','theme']) {
    const part = base.part(kind);
    if (!part) continue;
    if (base.zip.file(relPath(part))) throw unsupported();
    usedPaths.add(part);
    addType(base,part,part);
    addBookRel(kind,part);
    out.file(part,await base.zip.file(part)!.async('uint8array'));
  }
  const sst = parse('<sst xmlns="' + S + '"/>');
  const usedNames = new Set<string>();
  const definedNames = new Set<string>();
  const tableNames = new Set<string>();
  const objectIds = new Set<string>();
  let uniqueStrings = 0;
  let stringCount = 0;
  let tableId = 0;
  let sheetId = 0;
  let visible = false;
  for (const [sourceIndex,{book,indices}] of input.entries()) {
    if (!indices.length || indices.some(i => !Number.isInteger(i) || !book.sheets[i]) || new Set(indices).size !== indices.length) throw new Error('Nhóm trang tính trống, bị lặp hoặc nằm ngoài phạm vi của tệp.');
    if (sourceIndex > 0) {
      if (signature(book.theme?.documentElement) !== signature(base.theme?.documentElement)) throw incompatible();
      for (const name of ['workbookPr','calcPr','extLst']) {
        if (signature(elements(book.doc,name)[0]) !== signature(elements(base.doc,name)[0])) throw incompatible();
      }
      if (elements(book.doc,'workbookView').length > 1 || elements(base.doc,'workbookView').length > 1) throw incompatible();
      if (book.rootRels.some(rel => rel.kind === R + '/custom-properties')) throw incompatible();
    }
    const stylesMap = combineStyles(styles,book.styles,sourceIndex === 0);
    const selected = indices.map(i => book.sheets[i]);
    const names = new Map(selected.map(sheet => [sheet.name.toLowerCase(),availableName(sheet.name,usedNames)]));
    const omitted = new Set(book.sheets.filter(sheet => !names.has(sheet.name.toLowerCase())).map(sheet => sheet.name.toLowerCase()));
    const changed = omitted.size > 0 || selected.some((sheet,index) => names.get(sheet.name.toLowerCase()) !== sheet.name || indices[index] !== index);
    const outsideTables = new Set<string>();
    for (const sheet of book.sheets.filter(sheet => omitted.has(sheet.name.toLowerCase()))) {
      for (const rel of await links(book.zip,sheet.path)) {
        if (rel.kind === R + '/table' && rel.path) outsideTables.add(attr((await readXml(book.zip,rel.path)).documentElement,'displayName').toLowerCase());
      }
    }
    const formula = (value: string) => {
      if (outsideTables.size && [...value.matchAll(/"(?:[^"]|"")*"|[\p{L}\p{M}\p{N}_.\\]+/gu)].some(([token]) => outsideTables.has(token.toLowerCase()))) throw dependency();
      return rewriteFormula(value,names,omitted,changed);
    };
    const offset = sheetId;
    for (const def of elements(book.doc,'definedName')) {
      const local = def.hasAttribute('localSheetId') ? indices.indexOf(Number(attr(def,'localSheetId'))) : undefined;
      if (local === -1) continue;
      const clone = workbook.importNode(def,true);
      if (local !== undefined) clone.setAttribute('localSheetId',String(local + offset));
      const key = attr(clone,'localSheetId') + ':' + attr(clone,'name').toLowerCase();
      if (definedNames.has(key)) throw incompatible();
      definedNames.add(key);
      clone.textContent = formula(clone.textContent ?? '');
      definitions.appendChild(clone);
    }
    const paths = new Map<string,string>();
    const stringMap = new Map<number,number>();
    const copy = async (source: string, kind: string): Promise<string> => {
      const existing = paths.get(source);
      if (existing) return existing;
      if (!allowedChildren.has(kind) || !book.zip.file(source)) throw unsupported();
      const dest = freshPath(source,usedPaths);
      paths.set(source,dest);
      usedPaths.add(dest);
      addType(book,source,dest);
      const raw = await book.zip.file(source)!.async('uint8array');
      const isXml = /\.(xml|vml)$/i.test(source);
      let updated = false;
      if (isXml) {
        const doc = parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
        const set = (el: Element, name: string, value: string) => {
          if (attr(el,name) !== value) { el.setAttribute(name,value); updated = true; }
        };
        for (const el of elements(doc,'*')) {
          const name = el.localName;
          const idExtensions = name === 'extLst' && children(el).every(ext => children(ext).every(e => ['creationId','useLocalDpi','uniqueId'].includes(e.localName)));
          if ((name === 'extLst' && !idExtensions) || name === 'AlternateContent' || name === 'controls' || name === 'oleObjects' || name === 'sheetPr' && el.hasAttribute('codeName')) throw unsupported();
          if (name === 'c' && el.namespaceURI === S && attr(el,'t') === 's') {
            const v = children(el).find(child => child.localName === 'v');
            const index = Number(v?.textContent);
            if (!v || !Number.isInteger(index) || !book.strings[index] || book.strings[index].localName !== 'si') throw unsupported();
            if (!stringMap.has(index)) {
              stringMap.set(index,uniqueStrings++);
              sst.documentElement.appendChild(sst.importNode(book.strings[index],true));
            }
            stringCount++;
            const next = String(stringMap.get(index));
            if (v.textContent !== next) { v.textContent = next; updated = true; }
          }
          if (name === 'c' || name === 'row' || name === 'col') {
            const key = name === 'col' ? 'style' : 's';
            if (el.namespaceURI === S && el.hasAttribute(key)) {
              const index = stylesMap.xfs[Number(attr(el,key))];
              if (index === undefined) throw incompatible();
              set(el,key,String(index));
            }
          }
          for (const a of Array.from(el.attributes)) {
            if ((a.localName === 'uid' && a.namespaceURI?.includes('/revision')) || (['creationId','uniqueId'].includes(name) && ['id','val'].includes(a.localName))) {
              if (objectIds.has(a.value)) {
                el.setAttributeNS(a.namespaceURI,a.name,'{' + crypto.randomUUID().toUpperCase() + '}');
                updated = true;
              }
              objectIds.add(el.getAttributeNS(a.namespaceURI,a.localName)!);
            }
            if (/dxfid$/i.test(a.localName)) {
              const id = stylesMap.dxfs[Number(a.value)];
              if (id === undefined) throw incompatible();
              set(el,a.name,String(id));
            }
          }
          if (name === 'table' && kind === 'table') {
            const name = attr(el,'displayName').toLowerCase();
            if (tableNames.has(name)) throw new Error('Có bảng Excel trùng tên. Hãy đổi tên bảng trong Excel trước khi gộp.');
            tableNames.add(name);
            set(el,'id',String(++tableId));
          }
          if (name === 'hyperlink' && el.hasAttribute('location')) set(el,'location',formula(attr(el,'location')));
          if (sourceIndex > 0 && name === 'sheetView' && el.hasAttribute('tabSelected')) set(el,'tabSelected','0');
          if (/^(?:f|formula|formula1|formula2|calculatedColumnFormula|totalsRowFormula|FmlaLink|FmlaRange)$/i.test(name) && !children(el).length) {
            const value = formula(el.textContent ?? '');
            if (value !== el.textContent) { el.textContent = value; updated = true; }
          }
          if (name === 'cfvo' && attr(el,'type') === 'formula') set(el,'val',formula(attr(el,'val')));
        }
        if (updated) out.file(dest,serialize(doc));
      }
      if (!updated) out.file(dest,raw);
      const rels = await links(book.zip,source);
      for (const rel of rels) {
        if (!rel.path) {
          if (rel.kind !== R + '/hyperlink') throw unsupported();
          if (attr(rel.el,'Target').startsWith('#')) rel.el.setAttribute('Target','#' + formula(attr(rel.el,'Target').slice(1)));
          continue;
        }
        const child = await copy(rel.path,rel.kind.split('/').at(-1)!);
        rel.el.setAttribute('Target',relative(dest,child));
      }
      if (rels.length) out.file(relPath(dest),serialize(rels[0].el.ownerDocument));
      return dest;
    };
    for (const sheet of selected) {
      const path = await copy(sheet.path,'worksheet');
      const clone = workbook.importNode(sheet.el,true);
      clone.setAttribute('name',names.get(sheet.name.toLowerCase())!);
      clone.setAttribute('sheetId',String(++sheetId));
      clone.setAttributeNS(R,'r:id',addBookRel('worksheet',path));
      sheetList.appendChild(clone);
      if (!attr(clone,'state') || attr(clone,'state') === 'visible') visible = true;
    }
  }
  if (!visible) throw new Error('Mỗi tệp Excel cần có ít nhất một trang tính đang hiển thị.');
  const appPath = base.rootRels.find(rel => rel.kind === R + '/extended-properties')?.path;
  if (appPath) {
    const app = await readXml(base.zip,appPath);
    const headings = elements(app,'HeadingPairs')[0];
    const titles = elements(app,'TitlesOfParts')[0];
    if (headings && titles) {
      const count = elements(headings,'i4');
      const vector = elements(titles,'vector')[0];
      if (count.length !== 1 || !vector) throw unsupported();
      count[0].textContent = String(sheetId);
      while (vector.firstChild) vector.removeChild(vector.firstChild);
      vector.setAttribute('size',String(sheetId));
      for (const el of children(sheetList)) {
        const label = app.createElementNS(vector.namespaceURI,'vt:lpstr');
        label.textContent = attr(el,'name');
        vector.appendChild(label);
      }
      out.file(appPath,serialize(app));
    }
  }
  if (definitions.firstChild) workbook.documentElement.insertBefore(definitions,elements(workbook,'calcPr')[0] ?? null);
  const firstVisible = children(sheetList).findIndex(el => !attr(el,'state') || attr(el,'state') === 'visible');
  for (const el of elements(workbook,'workbookView')) {
    for (const key of ['activeTab','firstSheet']) {
      if (!el.hasAttribute(key)) continue;
      const before = Number(attr(el,key));
      const mapped = input[0].indices.indexOf(before);
      el.setAttribute(key,String(mapped < 0 ? firstVisible : mapped));
    }
  }
  if (styles) out.file(base.part('styles')!,serialize(styles));
  if (stringCount) {
    sst.documentElement.setAttribute('count',String(stringCount));
    sst.documentElement.setAttribute('uniqueCount',String(uniqueStrings));
    const path = 'xl/sharedStrings.xml';
    out.file(path,serialize(sst));
    addBookRel('sharedStrings',path);
    appendElement(types,types.documentElement,CT,'Override',{ PartName:'/' + path, ContentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml' });
  }
  out.file(MAIN,serialize(workbook));
  out.file(relPath(MAIN),serialize(bookRels));
  out.file(TYPES,serialize(types));
  return out.generateAsync({ type:'uint8array',compression:'DEFLATE' });
}

export async function mergeExcelFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('Chọn ít nhất hai tệp XLSX để gộp.');
  const input = [];
  for (const file of files) {
    const book = await openBook(file);
    input.push({ book, indices:book.sheets.map((_,i) => i) });
  }
  return assemble(input);
}

export async function splitExcelFile(file: File, groups: number[][]): Promise<Uint8Array[]> {
  if (!groups.length) throw new Error('Chọn ít nhất một nhóm trang tính.');
  const book = await openBook(file);
  const outputs = [];
  for (const indices of groups) outputs.push(await assemble([{ book,indices }]));
  return outputs;
}
