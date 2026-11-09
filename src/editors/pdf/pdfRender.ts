import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { pdfDataUrlToBytes } from './pdfBytes';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfPageSize = { width: number; height: number };

export type OpenedPdf = { doc: PDFDocumentProxy; close: () => Promise<void> };

export function openPdfDocument(dataUrl: string): { opened: Promise<OpenedPdf>; close: () => Promise<void> } {
  const task = getDocument({ data: pdfDataUrlToBytes(dataUrl) });
  const close = () => task.destroy();
  return { opened: task.promise.then((doc) => ({ doc, close })), close };
}

export async function readPageSizes(doc: PDFDocumentProxy): Promise<PdfPageSize[]> {
  const sizes: PdfPageSize[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}

export async function readPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
    .join('')
    .trim();
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  pixelRatio: number,
  isCancelled: () => boolean,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  if (isCancelled()) return;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio });
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.floor(viewport.width));
  offscreen.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas: offscreen, viewport }).promise;
  if (isCancelled()) return;
  canvas.width = offscreen.width;
  canvas.height = offscreen.height;
  canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
}

export async function renderPageThumbnail(doc: PDFDocumentProxy, pageNumber: number, width: number): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(doc, pageNumber, canvas, width, 2, () => false);
  return canvas.toDataURL('image/jpeg', 0.8);
}
