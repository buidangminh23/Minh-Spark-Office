import { getHTMLFromFragment } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import JSZip from 'jszip';
import katex from 'katex';
import { buildMht, type MhtImage } from '../../lib/docWordFormats';
import { PAGE_SIZES, type PageSettings } from '../../lib/storage';
import { styleSheetCss } from './docStyles';

const PT_PER_PX = 0.75;
const WORD_IMAGE_ROOT = 'file:///C:/MinhDocs/';

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const BASE_CSS = `table{border-collapse:collapse;width:100%}th,td{border:1px solid #c8ced8;padding:6px 10px;vertical-align:top}th{background:#f3f5f9}img{max-width:100%;height:auto}blockquote{border-left:3px solid #2b579a;margin:0 0 12px;padding-left:14px;color:#555}pre{background:#f5f6f8;padding:12px;white-space:pre-wrap}.doc-textbox{border:1px solid #94a3b8;padding:12px;margin:12px 0;box-sizing:border-box}.doc-textbox.align-left{float:left;margin-right:16px}.doc-textbox.align-right{float:right;margin-left:16px}.doc-textbox.align-center{margin-inline:auto}[data-column-section]{column-gap:32px;margin:12px 0}.doc-equation.display{display:block;text-align:center;margin:12px 0}.doc-bookmark{display:none}.page-break{break-after:page;height:0;border:0}p[data-dropcap]::first-letter{float:left;font-size:3.2em;line-height:.9;padding-right:6px;font-weight:700}.note-ref a{text-decoration:none}.doc-notes{margin-top:32px;font-size:.9em}.doc-notes hr{border:0;border-top:1px solid #c8ced8;margin:0 0 8px}.doc-notes ol{margin:0;padding-left:20px}`;

const relevantStyles = (page: PageSettings) => styleSheetCss(page).replaceAll('.doc-editor .doc-paper .tiptap ', '');

function bodyDocument(editor: Editor, json: JSONContent, math: 'mathml' | 'text') {
  const html = getHTMLFromFragment(editor.schema.nodeFromJSON(json).content, editor.schema);
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html');
  doc.querySelectorAll('span[data-latex]').forEach((node) => {
    const latex = node.getAttribute('data-latex') ?? '';
    const display = node.getAttribute('data-display') === 'true';
    if (math === 'text') {
      node.textContent = latex;
      return;
    }
    node.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: display, output: 'mathml' });
    node.classList.toggle('display', display);
  });
  const notes: string[] = [];
  doc.querySelectorAll('sup[data-footnote]').forEach((node) => {
    const text = node.getAttribute('data-footnote') ?? '';
    const kind = node.getAttribute('data-kind');
    if (kind === 'end') {
      node.replaceWith(Object.assign(doc.createElement('sup'), { textContent: '*', className: 'note-ref' }));
      return;
    }
    notes.push(text);
    const n = notes.length;
    const sup = doc.createElement('sup');
    sup.className = 'note-ref';
    sup.innerHTML = `<a id="ref-${n}" href="#note-${n}">${n}</a>`;
    node.replaceWith(sup);
  });
  if (notes.length) {
    const section = doc.createElement('section');
    section.className = 'doc-notes';
    section.innerHTML = `<hr><ol>${notes.map((text, i) => `<li id="note-${i + 1}">${escapeHtml(text)} <a href="#ref-${i + 1}">↩</a></li>`).join('')}</ol>`;
    doc.body.append(section);
  }
  return doc;
}

const metaTags = (page: PageSettings) => {
  const properties = page.properties;
  const entries: [string, string | undefined][] = [['author', properties?.author], ['description', properties?.subject], ['keywords', properties?.keywords], ['generator', 'Minh Docs']];
  return entries.filter((entry): entry is [string, string] => Boolean(entry[1])).map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}">`).join('');
};

const webHead = (title: string, page: PageSettings) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>${metaTags(page)}<style>body{font-family:"${page.fontFamily ?? 'Arial'}",Arial,sans-serif;font-size:${page.fontSize ?? 12}pt;max-width:820px;margin:40px auto;padding:0 24px;line-height:1.6;color:#1e2430}${BASE_CSS}${relevantStyles(page)}</style>`;

export function standaloneHtmlFrom(editor: Editor, json: JSONContent, title: string, page: PageSettings) {
  const doc = bodyDocument(editor, json, 'mathml');
  return `<!DOCTYPE html><html lang="${page.language ?? 'vi'}"><head>${webHead(title, page)}</head><body>${doc.body.innerHTML}</body></html>`;
}

const dataUrlParts = (src: string) => {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(src);
  if (!match) return null;
  const extension = match[1].split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'png';
  const base64 = match[2] ? match[3] : btoa(unescape(encodeURIComponent(decodeURIComponent(match[3]))));
  return { mime: match[1], extension, base64 };
};

const extractImages = (doc: Document, locate: (index: number, extension: string) => string) => {
  const images: MhtImage[] = [];
  doc.querySelectorAll('img').forEach((img) => {
    const parts = dataUrlParts(img.getAttribute('src') ?? '');
    if (!parts) return;
    const location = locate(images.length + 1, parts.extension);
    images.push({ location, mime: parts.mime, base64: parts.base64 });
    img.setAttribute('src', location);
  });
  return images;
};

export async function buildWebZip(editor: Editor, json: JSONContent, title: string, page: PageSettings): Promise<Blob> {
  const doc = bodyDocument(editor, json, 'mathml');
  const zip = new JSZip();
  extractImages(doc, (i, extension) => `images/anh-${i}.${extension}`).forEach((image) => zip.file(image.location, image.base64, { base64: true }));
  zip.file('index.html', `<!DOCTYPE html><html lang="${page.language ?? 'vi'}"><head>${webHead(title, page)}</head><body>${doc.body.innerHTML}</body></html>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' });
}

export function buildWebMht(editor: Editor, json: JSONContent, title: string, page: PageSettings): Blob {
  const doc = bodyDocument(editor, json, 'mathml');
  const images = extractImages(doc, (i, extension) => `${WORD_IMAGE_ROOT}anh-${i}.${extension}`);
  const html = `<!DOCTYPE html><html lang="${page.language ?? 'vi'}"><head>${webHead(title, page)}</head><body>${doc.body.innerHTML}</body></html>`;
  return buildMht(html, images, `${WORD_IMAGE_ROOT}index.html`, 'multipart/related');
}

const toPt = (px: number) => `${(px * PT_PER_PX).toFixed(1)}pt`;

export function buildWordDoc(editor: Editor, json: JSONContent, title: string, page: PageSettings): Blob {
  const doc = bodyDocument(editor, json, 'text');
  const images = extractImages(doc, (i, extension) => `${WORD_IMAGE_ROOT}anh-${i}.${extension}`);
  doc.querySelectorAll('img').forEach((img) => {
    const width = parseFloat(img.getAttribute('width') ?? img.style.width ?? '');
    if (width) img.setAttribute('width', String(Math.round(width)));
  });
  const size = PAGE_SIZES[page.size];
  const landscape = page.orientation === 'landscape';
  const width = landscape ? size.height : size.width;
  const height = landscape ? size.width : size.height;
  const margins = page.margins;
  const pageCss = `@page WordSection1{size:${toPt(width)} ${toPt(height)};${landscape ? 'mso-page-orientation:landscape;' : ''}margin:${toPt(margins.top)} ${toPt(margins.right)} ${toPt(margins.bottom)} ${toPt(margins.left)};}div.WordSection1{page:WordSection1;}`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="ProgId" content="Word.Document"><meta name="Generator" content="Minh Docs"><title>${escapeHtml(title)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${pageCss}body{font-family:"${page.fontFamily ?? 'Arial'}",Arial,sans-serif;font-size:${page.fontSize ?? 12}pt}${BASE_CSS}${relevantStyles(page)}</style></head><body><div class="WordSection1">${doc.body.innerHTML}</div></body></html>`;
  return buildMht(html, images, `${WORD_IMAGE_ROOT}tai-lieu.htm`, 'application/msword');
}
