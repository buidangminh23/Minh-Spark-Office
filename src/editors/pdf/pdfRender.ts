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
  const numbers = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return Promise.all(numbers.map(async (n) => {
    const viewport = (await doc.getPage(n)).getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }));
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
  viewRotation = 0,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  if (isCancelled()) return;
  const rotation = (page.rotate + viewRotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio, rotation });
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.floor(viewport.width));
  offscreen.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas: offscreen, viewport }).promise;
  if (isCancelled()) return;
  canvas.width = offscreen.width;
  canvas.height = offscreen.height;
  canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
}

export async function renderPageThumbnail(doc: PDFDocumentProxy, pageNumber: number, width: number, viewRotation = 0): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(doc, pageNumber, canvas, width, 2, () => false, viewRotation);
  return canvas.toDataURL('image/jpeg', 0.8);
}
