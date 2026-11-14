import test from 'node:test';
import assert from 'node:assert/strict';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPageText } from '../src/lib/mediaConversion';
import { extractAllText } from '../src/editors/pdf/pdfRaster';

function documentWithText(pages: string[]): PDFDocumentProxy {
  return {
    numPages: pages.length,
    getPage: async (number: number) => ({
      getViewport: () => ({ width: 595, height: 842, transform: [1, 0, 0, -1, 0, 842], convertToViewportPoint: (x: number, y: number) => [x, 842 - y] }),
      getTextContent: async () => ({ items: pages[number - 1] ? [{ str: pages[number - 1], transform: [1, 0, 0, 12, 72, 700], width: 200, height: 12 }] : [] }),
      cleanup: () => {},
      render: () => { throw new Error('Native text must not be rasterized'); },
    }),
  } as unknown as PDFDocumentProxy;
}

test('PDF text extraction preserves native Vietnamese without loading OCR', async () => {
  const result = await extractPdfPageText(documentWithText(['Tiếng Việt: 45,75 m3']), 1);
  assert.equal(result.text, 'Tiếng Việt: 45,75 m3');
  assert.equal(result.usedOcr, false);
  assert.deepEqual(result.warnings, []);
});

test('PDF TXT export preserves page order and reports pages with no recognized text', async () => {
  const progress: string[] = [];
  const result = await extractAllText(documentWithText(['Trang đầu', '', 'Trang cuối']), { ocr: false, onProgress: (message) => progress.push(message) });
  assert.equal(result.hasText, true);
  assert.equal(result.text, '--- Trang 1 ---\nTrang đầu\n\n--- Trang 2 ---\n\n\n--- Trang 3 ---\nTrang cuối');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Trang 2/);
  assert.equal(progress.length, 3);
});

test('PDF OCR abort prevents reading or rendering a document', async () => {
  const controller = new AbortController();
  controller.abort();
  const doc = { numPages: 1, getPage: () => { throw new Error('Must not read a cancelled document'); } } as unknown as PDFDocumentProxy;
  await assert.rejects(extractPdfPageText(doc, 1, { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(extractAllText(doc, { signal: controller.signal }), { name: 'AbortError' });
});

test('cancelling while a PDF scan page loads prevents starting its render', async () => {
  const controller = new AbortController();
  let resume: () => void = () => {};
  const pending = new Promise<void>((resolve) => { resume = resolve; });
  let entered: () => void = () => {};
  const rendering = new Promise<void>((resolve) => { entered = resolve; });
  const doc = documentWithText(['']);
  const getPage = doc.getPage.bind(doc);
  let reads = 0;
  doc.getPage = async (number) => {
    if (++reads === 2) { entered(); await pending; }
    return getPage(number);
  };
  const result = extractPdfPageText(doc, 1, { signal: controller.signal });
  await rendering;
  controller.abort();
  resume();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(reads, 2);
});
