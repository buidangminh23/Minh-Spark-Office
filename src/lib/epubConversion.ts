import type JSZip from 'jszip';
import type { JSONContent } from '@tiptap/react';
import { checkConversionAbort, type ConversionOptions } from './conversionTypes';
import { conversionHtmlFragment } from './officeConversionDocument';

type Item = { path: string; mime: string; fallback: string };
type Publication = { chapters: Item[]; assets: Map<string, Item>; encrypted: Set<string> };

function localPath(base: string, link: string): string | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(link.trim().split(/[?#]/, 1)[0]); } catch { return; }
  if (!decoded || /^([a-z][a-z\d+.-]*:|\/)/i.test(decoded) || decoded.includes('\\') || decoded.includes('\0')) return;
  const parts = base.split('/').slice(0, -1);
  for (const segment of decoded.split('/')) {
    if (segment === '..') { if (!parts.length) return; parts.pop(); }
    else if (segment && segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

async function readXml(zip: JSZip, path: string) {
  const source = await zip.file(path)?.async('string');
  if (!source || source.length > 8_000_000 || /<!ENTITY\s/i.test(source)) throw new Error('Thành phần EPUB bị thiếu, quá lớn hoặc có khai báo XML không được hỗ trợ.');
  const xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('Cấu trúc XML trong sách EPUB không hợp lệ.');
  return xml;
}

const elements = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));

export async function readEpubPublication(zip: JSZip): Promise<Publication> {
  if ((await zip.file('mimetype')?.async('string'))?.trim() !== 'application/epub+zip') throw new Error('Tệp không phải sách EPUB hợp lệ.');
  const container = await readXml(zip, 'META-INF/container.xml');
  const root = elements(container, 'rootfile').find(el => el.getAttribute('media-type') === 'application/oebps-package+xml');
  const opf = localPath('', root?.getAttribute('full-path') ?? '');
  if (!opf) throw new Error('Sách EPUB thiếu thông tin xuất bản.');
  const xml = await readXml(zip, opf);
  const entries = new Map<string, Item>();
  const assets = new Map<string, Item>();
  const manifest = elements(xml, 'manifest')[0];
  const spine = elements(xml, 'spine')[0];
  if (!manifest || !spine) throw new Error('Sách EPUB thiếu mục lục nội dung.');
  for (const item of elements(manifest, 'item')) {
    const id = item.getAttribute('id');
    if (!id) continue;
    if (entries.has(id)) throw new Error('Mã nội dung EPUB bị trùng.');
    const path = localPath(opf, item.getAttribute('href') ?? '') ?? '';
    const entry = { path, mime: item.getAttribute('media-type') ?? '', fallback: item.getAttribute('fallback') ?? '' };
    entries.set(id, entry);
    if (path) assets.set(path, entry);
  }
  const refs = elements(spine, 'itemref');
  if (!refs.length || refs.length > 500) throw new Error('Sách EPUB phải có từ 1 đến 500 phần nội dung.');
  const chapters = refs.map(ref => {
    let id = ref.getAttribute('idref') ?? '';
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const item = entries.get(id);
      if (!item) break;
      if (item.path && ['application/xhtml+xml', 'image/svg+xml'].includes(item.mime) && zip.file(item.path)) return item;
      id = item.fallback;
    }
    throw new Error('Một chương EPUB bị thiếu hoặc dùng định dạng chưa hỗ trợ.');
  });
  const encrypted = new Set<string>();
  if (zip.file('META-INF/encryption.xml')) {
    for (const el of elements(await readXml(zip, 'META-INF/encryption.xml'), 'CipherReference')) {
      const path = localPath('', el.getAttribute('URI') ?? '');
      if (path) encrypted.add(path);
    }
  }
  return { chapters, assets, encrypted };
}

export async function readEpubDocument(zip: JSZip, publication: Publication, options: ConversionOptions) {
  const content: JSONContent[] = [];
  const warnings = new Set<string>(['Đã đọc theo thứ tự chương EPUB. Kiểu chữ, CSS và bố cục cố định có thể thay đổi.']);
  const cache = new Map<string, string>();
  let expanded = 0;
  for (const chapter of publication.chapters) {
    checkConversionAbort(options);
    if (publication.encrypted.has(chapter.path)) throw new Error('Chương EPUB được mã hóa. Hãy chọn bản sách có thể đọc trực tiếp.');
    const xml = await readXml(zip, chapter.path);
    const template = document.createElement('template');
    const source = chapter.mime === 'image/svg+xml' ? xml.documentElement.outerHTML : elements(xml, 'body')[0]?.innerHTML;
    if (source === undefined) throw new Error('Chương EPUB thiếu nội dung trang.');
    expanded += source.length;
    if (expanded > 80_000_000) throw new Error('Nội dung EPUB quá lớn để chuyển đổi trên thiết bị.');
    template.innerHTML = source;
    for (const svg of template.content.querySelectorAll('svg')) {
      const replacement = document.createDocumentFragment();
      for (const child of svg.querySelectorAll('image,text')) {
        if (child.localName === 'text') { replacement.append(document.createTextNode(child.textContent ?? '')); continue; }
        const img = document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
        img.setAttribute('data-epub-src', child.getAttribute('href') ?? child.getAttribute('xlink:href') ?? '');
        img.setAttribute('alt', svg.querySelector('title')?.textContent ?? '');
        replacement.append(img);
      }
      if (!replacement.childNodes.length) replacement.append(document.createTextNode(svg.querySelector('title,desc')?.textContent || '[SVG]'));
      warnings.add('Đồ họa SVG trong EPUB được trích chữ và ảnh nhúng. Hình vẽ vector có thể thay đổi.');
      svg.replaceWith(replacement);
    }
    for (const img of template.content.querySelectorAll('img')) {
      checkConversionAbort(options);
      const src = img.getAttribute('data-epub-src') ?? img.getAttribute('src') ?? '';
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) { img.setAttribute('src', src); continue; }
      const path = localPath(chapter.path, src);
      const asset = path && publication.assets.get(path);
      if (!asset || !/^image\/(png|jpeg|gif|webp)$/.test(asset.mime) || !zip.file(asset.path)) { img.removeAttribute('src'); continue; }
      if (publication.encrypted.has(asset.path)) throw new Error('Ảnh trong sách EPUB được mã hóa.');
      let data = cache.get(asset.path);
      if (!data) { data = `data:${asset.mime};base64,${await zip.file(asset.path)!.async('base64')}`; cache.set(asset.path, data); }
      expanded += data.length;
      if (expanded > 80_000_000) throw new Error('Nội dung EPUB quá lớn để chuyển đổi trên thiết bị.');
      img.setAttribute('src', data);
    }
    const parsed = conversionHtmlFragment(template.content);
    for (const message of parsed.warnings) warnings.add(message);
    if (!parsed.json.content?.length) continue;
    if (content.length) content.push({ type: 'pageBreak' });
    for (const node of parsed.json.content) content.push(node);
  }
  return { json: { type: 'doc', content }, warnings: [...warnings] };
}
