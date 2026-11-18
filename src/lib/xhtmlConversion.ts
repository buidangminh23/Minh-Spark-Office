const namespace = 'http://www.w3.org/1999/xhtml';

export async function convertXhtml(file: File, target: string) {
  const sourceIsXml = /\.xhtml$/i.test(file.name);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
  const source = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (/<!ENTITY\s/i.test(source)) throw new Error('XHTML chứa khai báo thực thể chưa được hỗ trợ.');
  const doc = new DOMParser().parseFromString(source, sourceIsXml ? 'application/xhtml+xml' : 'text/html');
  const root = doc.documentElement;
  if (root.localName !== 'html' || root.namespaceURI !== namespace || doc.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('Nội dung XHTML không hợp lệ.');
  if (sourceIsXml && target === 'xhtml') return file;
  if (target === 'xhtml') {
    return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', new XMLSerializer().serializeToString(root)], { type: 'application/xhtml+xml;charset=utf-8' });
  }
  const html = document.implementation.createHTMLDocument();
  html.replaceChild(html.importNode(root, true), html.documentElement);
  return new Blob(['<!doctype html>\n', html.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
}
