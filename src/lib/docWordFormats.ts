import JSZip from 'jszip';

const DOCUMENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const TEMPLATE_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';
const RELS_TYPE = 'application/vnd.openxmlformats-package.relationships+xml';
const BASE64_LINE = 76;

export async function docxToTemplate(docx: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(docx);
  const types = zip.file('[Content_Types].xml');
  if (!types) throw new Error('Tệp Word thiếu danh mục nội dung.');
  zip.file('[Content_Types].xml', (await types.async('string')).replace(DOCUMENT_TYPE, TEMPLATE_TYPE));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template', compression: 'DEFLATE' });
}

const parseContentTypes = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  doc.querySelectorAll('Default').forEach((node) => defaults.set((node.getAttribute('Extension') ?? '').toLowerCase(), node.getAttribute('ContentType') ?? ''));
  doc.querySelectorAll('Override').forEach((node) => overrides.set(node.getAttribute('PartName') ?? '', node.getAttribute('ContentType') ?? ''));
  return (path: string) => overrides.get(`/${path}`) ?? defaults.get(path.split('.').pop()?.toLowerCase() ?? '') ?? 'application/octet-stream';
};

const isXmlPart = (path: string, type: string) => /\.(xml|rels)$/i.test(path) || type.endsWith('+xml');
const stripDeclaration = (xml: string) => xml.replace(/^﻿?\s*<\?xml[^>]*\?>\s*/, '');
const wrapBase64 = (value: string) => value.replace(new RegExp(`.{1,${BASE64_LINE}}`, 'g'), '$&\n');

export async function docxToFlatOpc(docx: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(docx);
  const types = zip.file('[Content_Types].xml');
  if (!types) throw new Error('Tệp Word thiếu danh mục nội dung.');
  const typeOf = parseContentTypes(await types.async('string'));
  const parts: string[] = [];
  for (const path of Object.keys(zip.files).sort()) {
    const file = zip.files[path];
    if (file.dir || path === '[Content_Types].xml') continue;
    const type = path.endsWith('.rels') ? RELS_TYPE : typeOf(path);
    if (isXmlPart(path, type)) {
      parts.push(`<pkg:part pkg:name="/${path}" pkg:contentType="${type}"><pkg:xmlData>${stripDeclaration(await file.async('string'))}</pkg:xmlData></pkg:part>`);
    } else {
      parts.push(`<pkg:part pkg:name="/${path}" pkg:contentType="${type}" pkg:compression="store"><pkg:binaryData>${wrapBase64(await file.async('base64'))}</pkg:binaryData></pkg:part>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<?mso-application progid="Word.Document"?>\n<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">${parts.join('')}</pkg:package>`;
  return new Blob([xml], { type: 'application/xml;charset=utf-8' });
}

export type MhtImage = { location: string; mime: string; base64: string };

const utf8Base64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
};

export function buildMht(html: string, images: MhtImage[], location: string, mime: string): Blob {
  const boundary = `----=_MinhDocs_${crypto.randomUUID()}`;
  const lines = ['MIME-Version: 1.0', `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`, '', `--${boundary}`, 'Content-Type: text/html; charset="utf-8"', 'Content-Transfer-Encoding: base64', `Content-Location: ${location}`, '', wrapBase64(utf8Base64(html))];
  for (const image of images) lines.push(`--${boundary}`, `Content-Type: ${image.mime}`, 'Content-Transfer-Encoding: base64', `Content-Location: ${image.location}`, '', wrapBase64(image.base64));
  lines.push(`--${boundary}--`, '');
  return new Blob([lines.join('\r\n')], { type: mime });
}
