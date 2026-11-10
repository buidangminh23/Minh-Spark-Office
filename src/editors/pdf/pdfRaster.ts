import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { loadRenderer } from './usePdfDocument';
import type { PdfPageSize } from './pdfRender';
import type { RasterPage } from './pdfTools';

const POINTS_PER_INCH = 72;
const MAX_RASTER_PIXELS = 24_000_000;

function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas encoding failed'));
      void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, mime, quality);
  });
}

export async function rasterizePages(
  doc: PDFDocumentProxy,
  sizes: PdfPageSize[],
  dpi: number,
  format: RasterPage['format'],
  onProgress?: (done: number, total: number) => void,
): Promise<RasterPage[]> {
  const renderer = await loadRenderer();
  const pages: RasterPage[] = [];
  for (const [index, size] of sizes.entries()) {
    const requested = dpi / POINTS_PER_INCH;
    const cap = Math.sqrt(MAX_RASTER_PIXELS / Math.max(1, size.width * size.height));
    const canvas = document.createElement('canvas');
    await renderer.renderPageToCanvas(doc, index + 1, canvas, size.width, Math.min(requested, cap), () => false);
    if (format === 'jpeg') {
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      pages.push({ bytes: await canvasToBytes(flat, 'image/jpeg', 0.88), format, width: size.width, height: size.height });
    } else {
      pages.push({ bytes: await canvasToBytes(canvas, 'image/png'), format, width: size.width, height: size.height });
    }
    onProgress?.(index + 1, sizes.length);
  }
  return pages;
}

export async function extractAllText(doc: PDFDocumentProxy): Promise<{ text: string; hasText: boolean }> {
  const renderer = await loadRenderer();
  const parts: string[] = [];
  let hasText = false;
  for (let page = 1; page <= doc.numPages; page++) {
    const value = await renderer.readPageText(doc, page);
    if (value) hasText = true;
    parts.push(`--- Trang ${page} ---\n${value}`);
  }
  return { text: parts.join('\n\n'), hasText };
}

export async function trimmedCanvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const pad = 4;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad + 1) - sx;
  const sh = Math.min(height, maxY + pad + 1) - sy;
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvasToBytes(out, 'image/png');
}
