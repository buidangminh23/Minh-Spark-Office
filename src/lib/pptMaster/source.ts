import { MAX_CONTEXT_CHARS, MAX_SERVER_PDF_BASE64, trimContext, type AddinPdf } from '../../../api/_shared/addin';

export type DeckSource = { name: string; text: string; pdf?: AddinPdf };

export const SOURCE_ACCEPT = '.txt,.md,.markdown,.csv,.docx,.pdf,.html,.htm';

const htmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, tr').forEach((node) => node.append('\n'));
  doc.querySelectorAll('td, th').forEach((node) => node.append('\t'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export async function readDeckSource(file: File, pdfLimit = MAX_SERVER_PDF_BASE64): Promise<DeckSource> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const base64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    if (base64.length > pdfLimit) throw new Error('Tệp PDF lớn hơn khoảng 2 MB. Nhập API key riêng trong Cài đặt add-in để gửi tệp lớn, hoặc dán nội dung chính vào ô mô tả.');
    return { name: file.name, text: '', pdf: { name: file.name, base64 } };
  }
  if (lower.endsWith('.docx')) {
    const { importDocxFull } = await import('../docxImport');
    const { html } = await importDocxFull(await file.arrayBuffer());
    return { name: file.name, text: trimContext(htmlToText(html), MAX_CONTEXT_CHARS) };
  }
  const raw = await file.text();
  const text = /\.html?$/.test(lower) ? htmlToText(raw) : raw;
  return { name: file.name, text: trimContext(text.trim(), MAX_CONTEXT_CHARS) };
}
