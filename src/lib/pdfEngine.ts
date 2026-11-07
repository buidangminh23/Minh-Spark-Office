import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { JSONContent } from '@tiptap/react';
import type { PdfAnnotationItem } from './storage';
import type { CellValue, SheetData, WorkbookData } from './sheetTypes';
import { emptySheet, uid } from './xlsxConvert';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const activeRenderTasks = new WeakMap<HTMLCanvasElement, RenderTask>();
const proxyLoadingTasks = new WeakMap<PDFDocumentProxy, ReturnType<typeof getDocument>>();

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;
const A4_PX_W = 794;
const A4_PX_H = 1123;
const SUBJECT_MAGIC = 'MINH_PDF_PAYLOAD:';

export type PdfDocBlock = {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'hr' | 'pageBreak' | 'table' | 'image';
  text?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  rows?: string[][];
  imageSrc?: string;
};

export type GeneratedPdfResult = {
  bytes: Uint8Array;
  dataUrl: string;
  pageCount: number;
  extractedPages: string[];
};

export type ExtractedPdfBundle = {
  pagesText: string[];
  tables: string[][][];
  metadata: {
    title: string;
    author: string;
    creator: string;
    producer: string;
    pageCount: number;
    fileSize: number;
  };
};

export function bytesToDataUrl(bytes: Uint8Array, mime = 'application/pdf'): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export async function loadPdfDocumentProxy(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const task = getDocument({ data: bytes.slice(0) });
  const proxy = await task.promise;
  proxyLoadingTasks.set(proxy, task);
  return proxy;
}

export async function disposePdfDocumentProxy(proxy: PDFDocumentProxy | null | undefined): Promise<void> {
  if (!proxy) return;
  try {
    await proxy.cleanup();
  } catch {
    void 0;
  }
  const task = proxyLoadingTasks.get(proxy);
  if (task) {
    proxyLoadingTasks.delete(proxy);
    try {
      await task.destroy();
    } catch {
      void 0;
    }
  }
}

export async function renderPdfPageToCanvas(
  pdfProxy: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.25,
  extraRotation = 0
): Promise<{ width: number; height: number }> {
  const prevTask = activeRenderTasks.get(canvas);
  if (prevTask) {
    try {
      prevTask.cancel();
    } catch {
      void 0;
    }
    activeRenderTasks.delete(canvas);
  }
  const clampedPage = Math.max(1, Math.min(pdfProxy.numPages, pageNumber));
  const page = await pdfProxy.getPage(clampedPage);
  const baseRotation = (page.rotate + extraRotation + 360) % 360;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssViewport = page.getViewport({ scale, rotation: baseRotation });
  const renderViewport = page.getViewport({ scale: scale * dpr, rotation: baseRotation });
  canvas.width = Math.max(1, Math.round(renderViewport.width));
  canvas.height = Math.max(1, Math.round(renderViewport.height));
  canvas.style.width = `${Math.round(cssViewport.width)}px`;
  canvas.style.height = `${Math.round(cssViewport.height)}px`;
  const renderTask = page.render({ canvas, viewport: renderViewport });
  activeRenderTasks.set(canvas, renderTask);
  try {
    await renderTask.promise;
  } catch (err) {
    if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
      throw err;
    }
  } finally {
    if (activeRenderTasks.get(canvas) === renderTask) {
      activeRenderTasks.delete(canvas);
    }
  }
  return { width: Math.round(cssViewport.width), height: Math.round(cssViewport.height) };
}

export async function renderPdfPageToPngBlob(
  pdfProxy: PDFDocumentProxy,
  pageNumber: number,
  scale = 2
): Promise<Blob> {
  const clamped = Math.max(1, Math.min(pdfProxy.numPages, pageNumber));
  const page = await pdfProxy.getPage(clamped);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvas, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Không thể xuất ảnh PNG cho trang PDF.');
  return blob;
}

export function renderRedCorporateStampPng(
  companyName = 'CÔNG TY MINH SPARK',
  roleLabel = 'ĐÃ KÝ DUYỆT CHỮ KÝ SỐ',
  signerName = 'BÙI ĐĂNG MINH'
): string {
  const w = 360;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(2, 2);

  ctx.fillStyle = 'rgba(255, 250, 250, 0.92)';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, 10);
  ctx.fill();
  ctx.stroke();

  const cx = 74;
  const cy = h / 2;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#dc2626';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(companyName.slice(0, 24).toUpperCase(), cx, cy - 22);
  ctx.font = '900 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText('★', cx, cy);
  ctx.font = '700 8px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CHỨNG THỰC SỐ', cx, cy + 21);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#b91c1c';
  ctx.font = '800 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(roleLabel.toUpperCase(), 142, 34);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'italic 700 16px Georgia, "Times New Roman", serif';
  ctx.fillText(signerName, 142, 68);

  ctx.fillStyle = '#7f1d1d';
  ctx.font = '600 10.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Đơn vị: ${companyName}`, 142, 98);
  ctx.font = '500 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Ngày ký: ${new Date().toLocaleDateString('vi-VN')}`, 142, 120);

  return canvas.toDataURL('image/png');
}

function inlineTextFromNode(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineTextFromNode).join('');
}

export function tiptapJsonToPdfBlocks(doc?: JSONContent): PdfDocBlock[] {
  if (!doc?.content) return [];
  const blocks: PdfDocBlock[] = [];

  const pushNode = (node: JSONContent, listPrefix?: string) => {
    const align = (node.attrs?.textAlign as PdfDocBlock['align']) || 'left';
    if (node.type === 'heading') {
      const lvl = Number(node.attrs?.level) || 1;
      const type = lvl === 1 ? 'h1' : lvl === 2 ? 'h2' : 'h3';
      const text = inlineTextFromNode(node).trim();
      if (text) blocks.push({ type, text, align });
      for (const child of node.content ?? []) {
        if (child.type === 'image' && child.attrs?.src) {
          blocks.push({ type: 'image', imageSrc: String(child.attrs.src), align });
        }
      }
      return;
    }
    if (node.type === 'paragraph') {
      const text = inlineTextFromNode(node);
      if (text.trim()) {
        blocks.push({
          type: listPrefix ? 'li' : 'p',
          text: listPrefix ? `${listPrefix}${text.trim()}` : text,
          align,
        });
      }
      for (const child of node.content ?? []) {
        if (child.type === 'image' && child.attrs?.src) {
          blocks.push({ type: 'image', imageSrc: String(child.attrs.src), align });
        }
      }
      return;
    }
    if (node.type === 'blockquote') {
      const text = inlineTextFromNode(node).trim();
      if (text) blocks.push({ type: 'quote', text });
      return;
    }
    if (node.type === 'bulletList') {
      for (const item of node.content ?? []) {
        for (const sub of item.content ?? []) pushNode(sub, '• ');
      }
      return;
    }
    if (node.type === 'orderedList') {
      (node.content ?? []).forEach((item, idx) => {
        for (const sub of item.content ?? []) pushNode(sub, `${idx + 1}. `);
      });
      return;
    }
    if (node.type === 'taskList') {
      for (const item of node.content ?? []) {
        const mark = item.attrs?.checked ? '[x] ' : '[ ] ';
        for (const sub of item.content ?? []) pushNode(sub, mark);
      }
      return;
    }
    if (node.type === 'horizontalRule') {
      blocks.push({ type: 'hr' });
      return;
    }
    if (node.type === 'pageBreak') {
      blocks.push({ type: 'pageBreak' });
      return;
    }
    if (node.type === 'image' && node.attrs?.src) {
      blocks.push({ type: 'image', imageSrc: String(node.attrs.src), align: 'center' });
      return;
    }
    if (node.type === 'table') {
      const rows: string[][] = [];
      for (const row of node.content ?? []) {
        const cells = (row.content ?? []).map((cell) => inlineTextFromNode(cell).replace(/\s+/g, ' ').trim());
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      return;
    }
    if (node.content) {
      for (const child of node.content) pushNode(child);
    }
  };

  for (const top of doc.content) pushNode(top);
  return blocks;
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

async function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function encodePayloadSubject(pages: string[], tables: string[][][]): string {
  const raw = JSON.stringify({ pages, tables });
  if (raw.length > 180000) {
    return SUBJECT_MAGIC + JSON.stringify({ pages: pages.map((p) => p.slice(0, 6000)), tables: tables.slice(0, 10) });
  }
  return SUBJECT_MAGIC + raw;
}

function decodePayloadSubject(subject?: string): { pages?: string[]; tables?: string[][][] } | null {
  if (!subject || !subject.startsWith(SUBJECT_MAGIC)) return null;
  try {
    return JSON.parse(subject.slice(SUBJECT_MAGIC.length)) as { pages?: string[]; tables?: string[][][] };
  } catch {
    return null;
  }
}

export async function createPdfFromBlocks(
  title: string,
  blocks: PdfDocBlock[],
  options: {
    orientation?: 'portrait' | 'landscape';
    watermark?: string;
    header?: string;
    footer?: string;
    pageNumbers?: boolean;
    quality?: number;
    scale?: number;
    author?: string;
    useJpeg?: boolean;
  } = {}
): Promise<GeneratedPdfResult> {
  const isLandscape = options.orientation === 'landscape';
  const pageW = isLandscape ? A4_PX_H : A4_PX_W;
  const pageH = isLandscape ? A4_PX_W : A4_PX_H;
  const ptW = isLandscape ? A4_PT_H : A4_PT_W;
  const ptH = isLandscape ? A4_PT_W : A4_PT_H;
  const scale = options.scale ?? 2;
  const marginX = 64;
  const marginTop = 64;
  const marginBottom = 64;
  const contentW = pageW - marginX * 2;

  const canvases: HTMLCanvasElement[] = [];
  const extractedPages: string[] = [];
  const tablesFound: string[][][] = [];
  let currentPageLines: string[] = [];

  const startNewPage = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(pageW * scale);
    c.height = Math.round(pageH * scale);
    const cctx = c.getContext('2d')!;
    cctx.scale(scale, scale);
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, pageW, pageH);

    if (options.watermark) {
      cctx.save();
      cctx.translate(pageW / 2, pageH / 2);
      cctx.rotate(-Math.PI / 4);
      cctx.font = '800 56px "Segoe UI", Arial, sans-serif';
      cctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      cctx.fillText(options.watermark, 0, 0);
      cctx.restore();
    }

    if (options.header) {
      cctx.save();
      cctx.font = '400 10.5px "Segoe UI", Arial, sans-serif';
      cctx.fillStyle = '#64748b';
      cctx.textBaseline = 'top';
      cctx.fillText(options.header, marginX, 26);
      cctx.strokeStyle = '#e2e8f0';
      cctx.lineWidth = 0.8;
      cctx.beginPath();
      cctx.moveTo(marginX, 44);
      cctx.lineTo(pageW - marginX, 44);
      cctx.stroke();
      cctx.restore();
    }

    canvases.push(c);
    if (canvases.length > 1) {
      extractedPages.push(currentPageLines.join('\n').trim());
      currentPageLines = [];
    }
    return cctx;
  };

  let ctx = startNewPage();
  let y = marginTop;

  const ensureHeight = (needed: number) => {
    if (y + needed > pageH - marginBottom) {
      ctx = startNewPage();
      y = marginTop;
    }
  };

  const effectiveBlocks: PdfDocBlock[] =
    blocks.length > 0 ? blocks : [{ type: 'h1', text: title }, { type: 'p', text: 'Tài liệu trống.' }];

  for (const block of effectiveBlocks) {
    if (block.type === 'pageBreak') {
      ctx = startNewPage();
      y = marginTop;
      continue;
    }
    if (block.type === 'hr') {
      ensureHeight(20);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX, y + 8);
      ctx.lineTo(pageW - marginX, y + 8);
      ctx.stroke();
      y += 20;
      continue;
    }
    if (block.type === 'image' && block.imageSrc) {
      const img = await loadHtmlImage(block.imageSrc);
      if (img && img.width > 0 && img.height > 0) {
        const maxImgW = Math.min(contentW, 380);
        const ratio = Math.min(1, maxImgW / img.width, 260 / img.height);
        const drawW = Math.round(img.width * ratio);
        const drawH = Math.round(img.height * ratio);
        ensureHeight(drawH + 16);
        const drawX =
          block.align === 'center'
            ? marginX + (contentW - drawW) / 2
            : block.align === 'right'
            ? pageW - marginX - drawW
            : marginX;
        ctx.drawImage(img, drawX, y + 4, drawW, drawH);
        y += drawH + 16;
      }
      continue;
    }
    if (block.type === 'table' && block.rows && block.rows.length > 0) {
      tablesFound.push(block.rows);
      const colCount = Math.max(...block.rows.map((r) => r.length), 1);
      const colW = contentW / colCount;
      y += 6;
      for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
        const row = block.rows[rIdx];
        ctx.font = rIdx === 0 ? '700 11.5px "Segoe UI", Arial, sans-serif' : '400 11.5px "Segoe UI", Arial, sans-serif';
        const wrappedCells = Array.from({ length: colCount }, (_, cIdx) =>
          wrapCanvasLines(ctx, row[cIdx] ?? '', colW - 16)
        );
        const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
        const rowH = maxLines * 17 + 12;
        ensureHeight(rowH);

        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const cellX = marginX + cIdx * colW;
          ctx.fillStyle = rIdx === 0 ? '#f1f5f9' : rIdx % 2 === 1 ? '#ffffff' : '#fafbfd';
          ctx.fillRect(cellX, y, colW, rowH);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, y, colW, rowH);

          ctx.fillStyle = '#0f172a';
          ctx.font = rIdx === 0 ? '700 11.5px "Segoe UI", Arial, sans-serif' : '400 11.5px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          wrappedCells[cIdx].forEach((ln, lIdx) => {
            ctx.fillText(ln, cellX + 8, y + 6 + lIdx * 17);
          });
        }
        currentPageLines.push(row.join('\t'));
        y += rowH;
      }
      y += 12;
      continue;
    }

    const rawText = block.text ?? '';
    if (!rawText.trim()) continue;

    let font = '400 13px "Times New Roman", "Segoe UI", serif';
    let lineH = 21;
    let spaceBefore = 0;
    let spaceAfter = 10;
    let color = '#1e293b';
    let indentX = 0;

    if (block.type === 'h1') {
      font = '700 21px "Segoe UI", Arial, sans-serif';
      lineH = 29;
      spaceBefore = y > marginTop ? 14 : 0;
      spaceAfter = 10;
      color = '#0f172a';
    } else if (block.type === 'h2') {
      font = '700 16px "Segoe UI", Arial, sans-serif';
      lineH = 24;
      spaceBefore = y > marginTop ? 12 : 0;
      spaceAfter = 8;
      color = '#1e3a8a';
    } else if (block.type === 'h3') {
      font = '700 14px "Segoe UI", Arial, sans-serif';
      lineH = 21;
      spaceBefore = y > marginTop ? 8 : 0;
      spaceAfter = 6;
      color = '#1e293b';
    } else if (block.type === 'li') {
      font = '400 13px "Times New Roman", "Segoe UI", serif';
      lineH = 20;
      spaceAfter = 5;
      indentX = 16;
    } else if (block.type === 'quote') {
      font = 'italic 400 13px "Times New Roman", "Segoe UI", serif';
      lineH = 20;
      spaceBefore = 4;
      spaceAfter = 10;
      color = '#334155';
      indentX = 18;
    }

    y += spaceBefore;
    ctx.font = font;
    const lines = wrapCanvasLines(ctx, rawText, contentW - indentX);
    if (block.type === 'quote') {
      const quoteH = lines.length * lineH + 10;
      ensureHeight(quoteH);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(marginX, y - 2, contentW, quoteH);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(marginX, y - 2, 3.5, quoteH);
    }

    for (const line of lines) {
      ensureHeight(lineH);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      if (block.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(line, pageW / 2, y);
      } else if (block.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(line, pageW - marginX, y);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(line, marginX + indentX, y);
      }
      currentPageLines.push(line);
      y += lineH;
    }
    y += spaceAfter;
  }

  extractedPages.push(currentPageLines.join('\n').trim());

  const total = canvases.length;
  if (options.footer || options.pageNumbers !== false) {
    canvases.forEach((c, idx) => {
      const cctx = c.getContext('2d')!;
      cctx.save();
      cctx.strokeStyle = '#e2e8f0';
      cctx.lineWidth = 0.8;
      cctx.beginPath();
      cctx.moveTo(marginX, pageH - 42);
      cctx.lineTo(pageW - marginX, pageH - 42);
      cctx.stroke();
      cctx.font = '400 10.5px "Segoe UI", Arial, sans-serif';
      cctx.fillStyle = '#64748b';
      cctx.textBaseline = 'top';
      if (options.footer) {
        cctx.textAlign = 'left';
        cctx.fillText(options.footer, marginX, pageH - 34);
      }
      if (options.pageNumbers !== false) {
        cctx.textAlign = 'right';
        cctx.fillText(`Trang ${idx + 1} / ${total}`, pageW - marginX, pageH - 34);
      }
      cctx.restore();
    });
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(options.author || 'Minh Spark Office');
  pdfDoc.setCreator('Minh Spark Office PDF Engine');
  pdfDoc.setProducer('Minh Spark Office (pdf-lib)');
  pdfDoc.setSubject(encodePayloadSubject(extractedPages, tablesFound));

  const useJpeg = options.useJpeg ?? (options.quality !== undefined && options.quality < 0.95);
  const jpegQuality = Math.max(0.25, Math.min(0.95, options.quality ?? 0.88));

  for (const c of canvases) {
    const page = pdfDoc.addPage([ptW, ptH]);
    if (useJpeg) {
      const jpgDataUrl = c.toDataURL('image/jpeg', jpegQuality);
      const img = await pdfDoc.embedJpg(dataUrlToBytes(jpgDataUrl));
      page.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
    } else {
      const pngDataUrl = c.toDataURL('image/png');
      const img = await pdfDoc.embedPng(dataUrlToBytes(pngDataUrl));
      page.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
    }
  }

  const bytes = await pdfDoc.save();
  return {
    bytes,
    dataUrl: bytesToDataUrl(bytes),
    pageCount: canvases.length,
    extractedPages,
  };
}

export async function createCorporateSamplePdf(title = 'Quy chuẩn văn phòng số.pdf'): Promise<GeneratedPdfResult> {
  const stampDataUrl = renderRedCorporateStampPng(
    'CÔNG TY MINH SPARK',
    'ĐÃ DUYỆT BAN HÀNH',
    'Bùi Đăng Minh'
  );
  const cleanTitle = title.replace(/\.pdf$/i, '');
  const blocks: PdfDocBlock[] = [
    { type: 'p', text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc', align: 'center' },
    { type: 'hr' },
    { type: 'h1', text: cleanTitle.toUpperCase(), align: 'center' },
    { type: 'p', text: 'Số: 28/2026/QĐ-MS · Hà Nội, ban hành áp dụng trên toàn hệ thống Minh Spark Office', align: 'center' },
    { type: 'h2', text: '1. Mục tiêu chuẩn hoá vận hành văn phòng số' },
    {
      type: 'p',
      text: 'Quyết định này quy định tiêu chuẩn soạn thảo văn bản hành chính (Minh Docs), lập bảng tính tài chính - kế toán (Minh Sheets) và ký số lưu trữ hồ sơ điện tử (Minh PDF) thống nhất trong toàn doanh nghiệp.',
    },
    { type: 'li', text: '• Đảm bảo 100% hồ sơ phê duyệt nội bộ và hợp đồng kinh tế có chữ ký số và dấu xác thực hợp lệ.' },
    { type: 'li', text: '• Chuẩn hoá định dạng trang A4, phông chữ Unicode tiếng Việt và hệ thống đánh số trang tự động.' },
    { type: 'li', text: '• Liên thông chuyển đổi hai chiều giữa PDF, Word (.docx) và Excel (.xlsx) không thất thoát bảng biểu.' },
    { type: 'h2', text: '2. Bảng tổng hợp chỉ tiêu hiệu suất chuyển đổi số' },
    {
      type: 'table',
      rows: [
        ['Hạng mục nghiệp vụ', 'Đơn vị phụ trách', 'Chỉ tiêu SLA', 'Tỷ lệ hoàn thành'],
        ['Phê duyệt tờ trình & quyết định PDF', 'Văn phòng Giám đốc', 'Trong 4 giờ', '99.4%'],
        ['Đối soát ngân sách & sổ quỹ Minh Sheets', 'Phòng Tài chính - Kế toán', 'Trước ngày 05 hàng tháng', '100%'],
        ['Số hoá & lưu trữ hợp đồng khách hàng', 'Khối Kinh doanh & Pháp chế', '100% hồ sơ ký số', '98.8%'],
        ['Kiểm định bảo mật dữ liệu cục bộ', 'Khối Công nghệ Minh Spark', 'Định kỳ hàng tuần', '100%'],
      ],
    },
    { type: 'image', imageSrc: stampDataUrl, align: 'right' },
    { type: 'pageBreak' },
    { type: 'h1', text: 'PHỤ LỤC ĐỊNH MỨC NGÂN SÁCH VẬN HÀNH QUÝ IV/2026' },
    {
      type: 'p',
      text: 'Bảng số liệu dưới đây được trích xuất chuẩn hoá phục vụ kiểm toán nội bộ và có thể chuyển đổi trực tiếp sang Minh Sheets (.xlsx) bằng công cụ PDF to Excel:',
    },
    {
      type: 'table',
      rows: [
        ['Mã khoản mục', 'Nội dung chi phí', 'Dự toán Q4 (VNĐ)', 'Thực chi (VNĐ)', 'Chênh lệch (VNĐ)'],
        ['MS-101', 'Hạ tầng máy chủ & lưu trữ số hoá', '185000000', '172000000', '-13000000'],
        ['MS-102', 'Bản quyền chữ ký số & bảo mật HSM', '64000000', '64000000', '0'],
        ['MS-103', 'Đào tạo quy chuẩn văn phòng số nhân sự', '42000000', '39500000', '-2500000'],
        ['MS-104', 'Tối ưu hoá quy trình tự động AI nội bộ', '128000000', '124000000', '-4000000'],
        ['TỔNG CỘNG', 'Toàn bộ ngân sách chuyển đổi số Q4', '419000000', '399500000', '-19500000'],
      ],
    },
    {
      type: 'quote',
      text: 'Ghi chú kiểm soát: Tổng chi phí thực tế tiết kiệm 19.500.000 VNĐ (tương đương 4,65%) so với hạn mức ngân sách được phê duyệt đầu quý.',
    },
    { type: 'pageBreak' },
    { type: 'h1', text: 'QUY ĐỊNH BẢO MẬT, REDACTION & LƯU TRỮ HỒ SƠ' },
    { type: 'h2', text: '3.1. Quy tắc che mật thông tin nhạy cảm (Wipe Off / Redaction)' },
    {
      type: 'p',
      text: 'Trước khi phát hành tài liệu ra bên ngoài doanh nghiệp, chuyên viên phụ trách bắt buộc sử dụng công cụ Wipe Off để che vĩnh viễn số tài khoản, mã số định danh cá nhân hoặc điều khoản chiết khấu thương mại.',
    },
    { type: 'h2', text: '3.2. Quy trình tách, gộp và nén hồ sơ PDF' },
    { type: 'li', text: '1. Sử dụng PDF Merge để hợp nhất tờ trình, báo giá và phụ lục kỹ thuật thành một hồ sơ duy nhất.' },
    { type: 'li', text: '2. Sử dụng PDF Split khi cần trích riêng trang ký kết hoặc phụ lục tài chính gửi từng bộ phận.' },
    { type: 'li', text: '3. Sử dụng PDF Compressor để tối ưu dung lượng tệp đính kèm dưới ngưỡng tiêu chuẩn gửi thư điện tử.' },
    { type: 'hr' },
    {
      type: 'p',
      text: 'Xác nhận lưu chiểu điện tử · Hệ thống Quản trị Tài liệu Minh Spark Office.',
      align: 'center',
    },
  ];

  return createPdfFromBlocks(cleanTitle, blocks, {
    header: 'MINH SPARK OFFICE · HỒ SƠ QUY CHUẨN NỘI BỘ',
    footer: 'Tài liệu được chứng thực chữ ký số trên nền tảng Minh PDF',
    pageNumbers: true,
    scale: 1.8,
    useJpeg: true,
    quality: 0.9,
  });
}

export async function createBlankPdfDocument(
  title: string,
  pageCount = 1,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor('Minh Spark Office');
  pdfDoc.setCreator('Minh Spark Office');
  const w = orientation === 'landscape' ? A4_PT_H : A4_PT_W;
  const h = orientation === 'landscape' ? A4_PT_W : A4_PT_H;
  const count = Math.max(1, Math.min(50, pageCount));
  for (let i = 0; i < count; i++) {
    pdfDoc.addPage([w, h]);
  }
  const bytes = await pdfDoc.save();
  const extractedPages = Array.from({ length: count }, () => '');
  return {
    bytes,
    dataUrl: bytesToDataUrl(bytes),
    pageCount: count,
    extractedPages,
  };
}

export async function createPdfFromImageBlob(
  title: string,
  pngBlob: Blob,
  options: {
    orientation?: 'portrait' | 'landscape';
    extractedText?: string;
    tableRows?: string[][];
  } = {}
): Promise<GeneratedPdfResult> {
  const imgBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor('Minh Spark Office');
  pdfDoc.setCreator('Minh Spark Sheets -> Minh PDF');
  const pages = [options.extractedText ?? title];
  const tables = options.tableRows && options.tableRows.length > 0 ? [options.tableRows] : [];
  pdfDoc.setSubject(encodePayloadSubject(pages, tables));

  const embedded = await pdfDoc.embedPng(imgBytes);
  const isLandscape = options.orientation ? options.orientation === 'landscape' : embedded.width > embedded.height;
  const pageW = isLandscape ? A4_PT_H : A4_PT_W;
  const pageH = isLandscape ? A4_PT_W : A4_PT_H;
  const margin = 28;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / embedded.width, availH / embedded.height, 1);
  const drawW = embedded.width * scale;
  const drawH = embedded.height * scale;

  const page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(embedded, {
    x: (pageW - drawW) / 2,
    y: pageH - margin - drawH,
    width: drawW,
    height: drawH,
  });

  const bytes = await pdfDoc.save();
  return {
    bytes,
    dataUrl: bytesToDataUrl(bytes),
    pageCount: 1,
    extractedPages: pages,
  };
}

export async function extractPdfTextAndTables(
  bytes: Uint8Array,
  fallbackPages?: string[]
): Promise<ExtractedPdfBundle> {
  let title = '';
  let author = '';
  let creator = '';
  let producer = '';
  let subjectPayload: { pages?: string[]; tables?: string[][][] } | null = null;

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    title = doc.getTitle() ?? '';
    author = doc.getAuthor() ?? '';
    creator = doc.getCreator() ?? '';
    producer = doc.getProducer() ?? '';
    subjectPayload = decodePayloadSubject(doc.getSubject());
  } catch {
    void 0;
  }

  const proxy = await loadPdfDocumentProxy(bytes);
  const numPages = proxy.numPages;
  const pagesText: string[] = [];
  const detectedTables: string[][][] = subjectPayload?.tables ? [...subjectPayload.tables] : [];

  for (let p = 1; p <= numPages; p++) {
    const page = await proxy.getPage(p);
    const tc = await page.getTextContent();
    type PositionedItem = { str: string; x: number; y: number; w: number };
    const positioned: PositionedItem[] = [];
    for (const raw of tc.items) {
      if ('str' in raw && typeof raw.str === 'string' && raw.str.trim()) {
        const tr = raw.transform as number[];
        positioned.push({
          str: raw.str,
          x: Number(tr?.[4] ?? 0),
          y: Number(tr?.[5] ?? 0),
          w: Number(raw.width ?? 0),
        });
      }
    }

    positioned.sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));

    const lines: PositionedItem[][] = [];
    for (const item of positioned) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine || Math.abs(lastLine[0].y - item.y) > 4.5) {
        lines.push([item]);
      } else {
        lastLine.push(item);
      }
    }

    const lineStrings: string[] = [];
    const candidateTableRows: string[][] = [];

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const cols: string[] = [];
      let currentCell = line[0].str;
      let prevRight = line[0].x + Math.max(line[0].w, line[0].str.length * 4.5);

      for (let i = 1; i < line.length; i++) {
        const gap = line[i].x - prevRight;
        if (gap > 16) {
          cols.push(currentCell.trim());
          currentCell = line[i].str;
        } else {
          currentCell += (gap > 2 ? ' ' : '') + line[i].str;
        }
        prevRight = line[i].x + Math.max(line[i].w, line[i].str.length * 4.5);
      }
      cols.push(currentCell.trim());
      lineStrings.push(cols.join('    '));
      if (cols.length >= 2) candidateTableRows.push(cols);
    }

    if (!subjectPayload?.tables && candidateTableRows.length >= 2) {
      detectedTables.push(candidateTableRows);
    }

    const nativePageText = lineStrings.join('\n').trim();
    const fallbackText = subjectPayload?.pages?.[p - 1] ?? fallbackPages?.[p - 1] ?? '';
    pagesText.push(nativePageText || fallbackText);
  }

  await disposePdfDocumentProxy(proxy);

  if (detectedTables.length === 0) {
    for (const pageStr of pagesText) {
      const tabRows = pageStr
        .split('\n')
        .filter((ln) => ln.includes('\t'))
        .map((ln) => ln.split('\t').map((c) => c.trim()));
      if (tabRows.length >= 2) detectedTables.push(tabRows);
    }
  }

  return {
    pagesText,
    tables: detectedTables,
    metadata: {
      title,
      author,
      creator,
      producer,
      pageCount: numPages,
      fileSize: bytes.byteLength,
    },
  };
}

export async function bakeAnnotationsIntoPdf(
  bytes: Uint8Array,
  annotations: PdfAnnotationItem[],
  watermark?: string
): Promise<Uint8Array> {
  if (annotations.length === 0 && !watermark) return bytes;
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (let idx = 0; idx < pages.length; idx++) {
    const pageNum = idx + 1;
    const pageAnns = annotations.filter((a) => a.page === pageNum);
    if (pageAnns.length === 0 && !watermark) continue;

    const pdfPage = pages[idx];
    const { width, height } = pdfPage.getSize();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    if (watermark) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.font = '800 46px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(220, 38, 38, 0.14)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(watermark, 0, 0);
      ctx.restore();
    }

    for (const ann of pageAnns) {
      const ax = ann.x * width;
      const ay = ann.y * height;
      const aw = Math.max(4, ann.w * width);
      const ah = Math.max(4, ann.h * height);

      if (ann.kind === 'highlight') {
        ctx.save();
        ctx.fillStyle = ann.color || 'rgba(250, 204, 21, 0.42)';
        ctx.globalAlpha = 0.42;
        ctx.fillRect(ax, ay, aw, ah);
        ctx.restore();
      } else if (ann.kind === 'redact') {
        ctx.save();
        ctx.fillStyle = ann.color || '#0f172a';
        ctx.fillRect(ax, ay, aw, ah);
        ctx.restore();
      } else if (ann.kind === 'rect') {
        ctx.save();
        ctx.strokeStyle = ann.color || '#dc2626';
        ctx.lineWidth = ann.strokeWidth ?? 2.2;
        ctx.strokeRect(ax, ay, aw, ah);
        ctx.restore();
      } else if (ann.kind === 'ellipse') {
        ctx.save();
        ctx.strokeStyle = ann.color || '#2563eb';
        ctx.lineWidth = ann.strokeWidth ?? 2.2;
        ctx.beginPath();
        ctx.ellipse(ax + aw / 2, ay + ah / 2, Math.abs(aw / 2), Math.abs(ah / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (ann.kind === 'line') {
        ctx.save();
        ctx.strokeStyle = ann.color || '#dc2626';
        ctx.lineWidth = ann.strokeWidth ?? 2.4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + aw, ay + ah);
        ctx.stroke();
        ctx.restore();
      } else if (ann.kind === 'freehand' && ann.points && ann.points.length > 1) {
        ctx.save();
        ctx.strokeStyle = ann.color || '#1d4ed8';
        ctx.lineWidth = ann.strokeWidth ?? 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x * width, ann.points[0].y * height);
        for (let p = 1; p < ann.points.length; p++) {
          ctx.lineTo(ann.points[p].x * width, ann.points[p].y * height);
        }
        ctx.stroke();
        ctx.restore();
      } else if (ann.kind === 'text' && ann.text) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = ann.color || '#2563eb';
        ctx.lineWidth = 1.2;
        const lines = wrapCanvasLines(ctx, ann.text, Math.max(120, aw - 12));
        const boxH = Math.max(ah, lines.length * 16 + 10);
        ctx.fillRect(ax, ay, Math.max(90, aw), boxH);
        ctx.strokeRect(ax, ay, Math.max(90, aw), boxH);
        ctx.fillStyle = ann.color || '#0f172a';
        ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = 'top';
        lines.forEach((ln, lIdx) => {
          ctx.fillText(ln, ax + 6, ay + 5 + lIdx * 16);
        });
        ctx.restore();
      } else if ((ann.kind === 'signature' || ann.kind === 'stamp') && ann.imageDataUrl) {
        const img = await loadHtmlImage(ann.imageDataUrl);
        if (img) {
          ctx.drawImage(img, ax, ay, aw, ah);
        }
      }
    }

    const overlayDataUrl = canvas.toDataURL('image/png');
    const embedded = await pdfDoc.embedPng(dataUrlToBytes(overlayDataUrl));
    pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
  }

  return pdfDoc.save();
}

export function parsePageRangeSpec(spec: string, maxPages: number): Array<{ start: number; end: number; label: string }> {
  const cleaned = spec.trim().toLowerCase();
  if (!cleaned || cleaned === 'all' || cleaned === 'each') {
    return Array.from({ length: maxPages }, (_, idx) => ({
      start: idx + 1,
      end: idx + 1,
      label: `Trang-${idx + 1}`,
    }));
  }
  const parts = cleaned.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const ranges: Array<{ start: number; end: number; label: string }> = [];
  for (const part of parts) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      const a = Math.max(1, Math.min(maxPages, Number(m[1])));
      const b = Math.max(1, Math.min(maxPages, Number(m[2])));
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      ranges.push({ start, end, label: start === end ? `Trang-${start}` : `Trang-${start}-${end}` });
    } else if (/^\d+$/.test(part)) {
      const p = Math.max(1, Math.min(maxPages, Number(part)));
      ranges.push({ start: p, end: p, label: `Trang-${p}` });
    }
  }
  return ranges;
}

export async function splitPdfByRanges(
  bytes: Uint8Array,
  rangeSpec: string
): Promise<Array<{ label: string; startPage: number; endPage: number; bytes: Uint8Array; pageCount: number }>> {
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const maxPages = srcDoc.getPageCount();
  const ranges = parsePageRangeSpec(rangeSpec, maxPages);
  if (ranges.length === 0) {
    throw new Error('Khoảng trang không hợp lệ. Ví dụ hợp lệ: 1, 2-3 hoặc each.');
  }
  const srcSubject = decodePayloadSubject(srcDoc.getSubject());
  const out: Array<{ label: string; startPage: number; endPage: number; bytes: Uint8Array; pageCount: number }> = [];

  for (const rg of ranges) {
    const subDoc = await PDFDocument.create();
    subDoc.setTitle(`${srcDoc.getTitle() || 'Tài liệu'} (${rg.label})`);
    subDoc.setCreator('Minh Spark Office PDF Split');
    const indices: number[] = [];
    for (let p = rg.start; p <= rg.end; p++) indices.push(p - 1);
    const copied = await subDoc.copyPages(srcDoc, indices);
    for (const cp of copied) subDoc.addPage(cp);
    if (srcSubject?.pages) {
      const slicedPages = indices.map((i) => srcSubject.pages?.[i] ?? '');
      subDoc.setSubject(encodePayloadSubject(slicedPages, srcSubject.tables ?? []));
    }
    const subBytes = await subDoc.save();
    out.push({
      label: rg.label,
      startPage: rg.start,
      endPage: rg.end,
      bytes: subBytes,
      pageCount: indices.length,
    });
  }
  return out;
}

export async function mergePdfBuffers(
  buffers: Uint8Array[],
  mergedTitle = 'Tài liệu gộp Minh PDF'
): Promise<{ bytes: Uint8Array; pageCount: number; extractedPages: string[] }> {
  const outDoc = await PDFDocument.create();
  outDoc.setTitle(mergedTitle);
  outDoc.setCreator('Minh Spark Office PDF Merge');
  const mergedPagesText: string[] = [];
  const mergedTables: string[][][] = [];

  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const count = src.getPageCount();
    const indices = Array.from({ length: count }, (_, i) => i);
    const copied = await outDoc.copyPages(src, indices);
    for (const cp of copied) outDoc.addPage(cp);
    const sub = decodePayloadSubject(src.getSubject());
    if (sub?.pages) {
      mergedPagesText.push(...sub.pages);
    } else {
      for (let i = 0; i < count; i++) mergedPagesText.push('');
    }
    if (sub?.tables) mergedTables.push(...sub.tables);
  }

  outDoc.setSubject(encodePayloadSubject(mergedPagesText, mergedTables));
  const bytes = await outDoc.save();
  return {
    bytes,
    pageCount: outDoc.getPageCount(),
    extractedPages: mergedPagesText,
  };
}

export async function rotatePdfPages(
  bytes: Uint8Array,
  pageNumbers1Based: number[],
  deltaDeg: 90 | 180 | 270 | -90
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  for (const pNum of pageNumbers1Based) {
    const page = pages[pNum - 1];
    if (!page) continue;
    const current = page.getRotation().angle;
    const next = ((current + deltaDeg) % 360 + 360) % 360;
    page.setRotation(degrees(next));
  }
  return doc.save();
}

export async function deletePdfPage(bytes: Uint8Array, pageNumber1Based: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  if (doc.getPageCount() <= 1) {
    throw new Error('Tài liệu PDF phải có ít nhất 1 trang.');
  }
  const idx = Math.max(0, Math.min(doc.getPageCount() - 1, pageNumber1Based - 1));
  doc.removePage(idx);
  const sub = decodePayloadSubject(doc.getSubject());
  if (sub?.pages) {
    sub.pages.splice(idx, 1);
    doc.setSubject(encodePayloadSubject(sub.pages, sub.tables ?? []));
  }
  return doc.save();
}

export async function insertBlankPdfPage(bytes: Uint8Array, afterPage1Based: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const refPage = doc.getPages()[Math.max(0, Math.min(doc.getPageCount() - 1, afterPage1Based - 1))];
  const { width, height } = refPage ? refPage.getSize() : { width: A4_PT_W, height: A4_PT_H };
  const insertIdx = Math.max(0, Math.min(doc.getPageCount(), afterPage1Based));
  doc.insertPage(insertIdx, [width, height]);
  const sub = decodePayloadSubject(doc.getSubject());
  if (sub?.pages) {
    sub.pages.splice(insertIdx, 0, '');
    doc.setSubject(encodePayloadSubject(sub.pages, sub.tables ?? []));
  }
  return doc.save();
}

export async function duplicatePdfPage(bytes: Uint8Array, pageNumber1Based: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const idx = Math.max(0, Math.min(doc.getPageCount() - 1, pageNumber1Based - 1));
  const [copied] = await doc.copyPages(doc, [idx]);
  doc.insertPage(idx + 1, copied);
  const sub = decodePayloadSubject(doc.getSubject());
  if (sub?.pages) {
    sub.pages.splice(idx + 1, 0, sub.pages[idx] ?? '');
    doc.setSubject(encodePayloadSubject(sub.pages, sub.tables ?? []));
  }
  return doc.save();
}

export async function cropPdfPages(
  bytes: Uint8Array,
  marginsPt: { top: number; right: number; bottom: number; left: number },
  targetPages1Based?: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const indices =
    targetPages1Based && targetPages1Based.length > 0
      ? targetPages1Based.map((p) => p - 1)
      : pages.map((_, idx) => idx);

  for (const idx of indices) {
    const page = pages[idx];
    if (!page) continue;
    const { width, height } = page.getSize();
    const x = Math.max(0, Math.min(width * 0.4, marginsPt.left));
    const y = Math.max(0, Math.min(height * 0.4, marginsPt.bottom));
    const newW = Math.max(120, width - x - Math.max(0, marginsPt.right));
    const newH = Math.max(120, height - y - Math.max(0, marginsPt.top));
    page.setCropBox(x, y, newW, newH);
    page.setMediaBox(x, y, newW, newH);
  }
  return doc.save();
}

export async function compressOrRasterizePdf(
  bytes: Uint8Array,
  quality = 0.65,
  scale = 1.35
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const title = srcDoc.getTitle() ?? 'Compressed PDF';
  const author = srcDoc.getAuthor() ?? 'Minh Spark Office';
  const subject = srcDoc.getSubject();

  const proxy = await loadPdfDocumentProxy(bytes);
  const outDoc = await PDFDocument.create();
  outDoc.setTitle(title);
  outDoc.setAuthor(author);
  outDoc.setCreator('Minh Spark Office PDF Compressor');
  if (subject) outDoc.setSubject(subject);

  for (let p = 1; p <= proxy.numPages; p++) {
    const page = await proxy.getPage(p);
    const ptViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(renderViewport.width));
    canvas.height = Math.max(1, Math.round(renderViewport.height));
    await page.render({ canvas, viewport: renderViewport }).promise;
    const jpgUrl = canvas.toDataURL('image/jpeg', Math.max(0.2, Math.min(0.95, quality)));
    const embedded = await outDoc.embedJpg(dataUrlToBytes(jpgUrl));
    const outPage = outDoc.addPage([ptViewport.width, ptViewport.height]);
    outPage.drawImage(embedded, { x: 0, y: 0, width: ptViewport.width, height: ptViewport.height });
  }

  await disposePdfDocumentProxy(proxy);

  return outDoc.save();
}

export async function stampPageNumbersOnPdf(
  bytes: Uint8Array,
  position: 'bottom-center' | 'bottom-right' | 'top-right' = 'bottom-right'
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const label = `Page ${idx + 1} / ${total}`;
    const textW = font.widthOfTextAtSize(label, 9.5);
    const x =
      position === 'bottom-center'
        ? (width - textW) / 2
        : width - textW - 36;
    const y = position === 'top-right' ? height - 26 : 20;
    page.drawText(label, {
      x,
      y,
      size: 9.5,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
  });

  return doc.save();
}

export function convertPdfToDocxJson(
  title: string,
  pagesText: string[],
  tables: string[][][]
): JSONContent {
  const content: JSONContent[] = [];

  pagesText.forEach((pageStr, pageIdx) => {
    if (pageIdx > 0) {
      content.push({ type: 'pageBreak' });
    }
    const lines = pageStr.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `[Trang ${pageIdx + 1}]` }],
      });
      return;
    }

    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (ln.includes('\t')) {
        const tableLines: string[][] = [];
        while (i < lines.length && lines[i].includes('\t')) {
          tableLines.push(lines[i].split('\t').map((c) => c.trim()));
          i++;
        }
        const colCount = Math.max(...tableLines.map((r) => r.length), 1);
        content.push({
          type: 'table',
          content: tableLines.map((row, rIdx) => ({
            type: 'tableRow',
            content: Array.from({ length: colCount }, (_, cIdx) => ({
              type: rIdx === 0 ? 'tableHeader' : 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: row[cIdx] ? [{ type: 'text', text: row[cIdx] }] : [],
                },
              ],
            })),
          })),
        });
        continue;
      }

      const isUpperHeading =
        ln.length <= 90 &&
        ln === ln.toUpperCase() &&
        /[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(ln);
      const isSectionHeading = /^(\d+(\.\d+)*\.?\s+|[IVX]+\.\s+)/.test(ln) && ln.length <= 100;

      if (isUpperHeading) {
        content.push({
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: ln }],
        });
      } else if (isSectionHeading) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: ln }],
        });
      } else {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: ln }],
        });
      }
      i++;
    }
  });

  if (content.length === 0 && tables.length > 0) {
    for (const tbl of tables) {
      const colCount = Math.max(...tbl.map((r) => r.length), 1);
      content.push({
        type: 'table',
        content: tbl.map((row, rIdx) => ({
          type: 'tableRow',
          content: Array.from({ length: colCount }, (_, cIdx) => ({
            type: rIdx === 0 ? 'tableHeader' : 'tableCell',
            content: [{ type: 'paragraph', content: row[cIdx] ? [{ type: 'text', text: row[cIdx] }] : [] }],
          })),
        })),
      });
    }
  }

  if (content.length === 0) {
    content.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: title.replace(/\.pdf$/i, '') }],
    });
  }

  return { type: 'doc', content };
}

export function buildWorkbookFromTables(
  title: string,
  tables: string[][][],
  fallbackLines: string[] = []
): WorkbookData {
  const cleanName = title.replace(/\.[^.]+$/, '') || 'Trích xuất PDF';
  const wb: WorkbookData = {
    id: uid('wb'),
    name: cleanName,
    appVersion: '0.1.0',
    locale: 'viVN',
    styles: {
      hdr: {
        bl: 1,
        fs: 11,
        bg: { rgb: '#107c41' },
        cl: { rgb: '#ffffff' },
        ht: 2,
        vt: 2,
        bd: {
          t: { s: 1, cl: { rgb: '#0b5c30' } },
          b: { s: 1, cl: { rgb: '#0b5c30' } },
          l: { s: 1, cl: { rgb: '#0b5c30' } },
          r: { s: 1, cl: { rgb: '#0b5c30' } },
        },
      },
      cell: {
        fs: 11,
        vt: 2,
        bd: {
          t: { s: 1, cl: { rgb: '#cbd5e1' } },
          b: { s: 1, cl: { rgb: '#cbd5e1' } },
          l: { s: 1, cl: { rgb: '#cbd5e1' } },
          r: { s: 1, cl: { rgb: '#cbd5e1' } },
        },
      },
      num: {
        fs: 11,
        ht: 3,
        vt: 2,
        n: { pattern: '#,##0' },
        bd: {
          t: { s: 1, cl: { rgb: '#cbd5e1' } },
          b: { s: 1, cl: { rgb: '#cbd5e1' } },
          l: { s: 1, cl: { rgb: '#cbd5e1' } },
          r: { s: 1, cl: { rgb: '#cbd5e1' } },
        },
      },
    },
    sheetOrder: [],
    sheets: {},
  };

  const effectiveTables: string[][][] =
    tables.length > 0
      ? tables
      : [
          [
            ['STT', 'Nội dung trích xuất từ tài liệu'],
            ...fallbackLines
              .map((l) => l.trim())
              .filter(Boolean)
              .map((line, idx) => [String(idx + 1), line]),
          ],
        ];

  effectiveTables.forEach((tbl, tIdx) => {
    const sheet: SheetData = emptySheet(
      effectiveTables.length === 1 ? 'Bảng trích xuất' : `Bảng ${tIdx + 1}`,
      Math.max(100, tbl.length + 30),
      Math.max(26, Math.max(...tbl.map((r) => r.length), 2) + 4)
    );
    const maxCols = Math.max(...tbl.map((r) => r.length), 1);

    for (let c = 0; c < maxCols; c++) {
      const longest = Math.max(...tbl.map((r) => (r[c] ?? '').length), 10);
      sheet.columnData[c] = { w: Math.min(340, Math.max(110, longest * 7 + 24)) };
    }

    tbl.forEach((row, rIdx) => {
      sheet.rowData[rIdx] = { h: rIdx === 0 ? 30 : 26 };
      row.forEach((rawCell, cIdx) => {
        const trimmed = rawCell.trim();
        const numericCleaned = trimmed.replace(/\s*(VNĐ|₫|USD|\$)\s*$/i, '').replace(/\./g, '').replace(',', '.');
        const isPureNumber =
          rIdx > 0 &&
          /^-?\d+(\.\d+)?$/.test(numericCleaned) &&
          Number.isFinite(Number(numericCleaned));

        const entry: CellValue = isPureNumber
          ? { v: Number(numericCleaned), t: 2, s: 'num' }
          : { v: trimmed, t: 1, s: rIdx === 0 ? 'hdr' : 'cell' };
        (sheet.cellData[rIdx] ??= {})[cIdx] = entry;
      });
    });

    wb.sheetOrder.push(sheet.id);
    wb.sheets[sheet.id] = sheet;
  });

  return wb;
}

export function convertPdfToSlideDeckHtml(
  title: string,
  pagesText: string[]
): { slides: Array<{ title: string; bullets: string[] }>; html: string } {
  const cleanTitle = title.replace(/\.[^.]+$/, '');
  const slides: Array<{ title: string; bullets: string[] }> = pagesText.map((txt, idx) => {
    const lines = txt
      .split('\n')
      .map((l) => l.replace(/\t+/g, ' — ').trim())
      .filter(Boolean);
    const slideTitle = lines[0] || `${cleanTitle} — Trang ${idx + 1}`;
    const bullets = lines.slice(1, 7);
    return {
      title: slideTitle.slice(0, 95),
      bullets: bullets.length > 0 ? bullets : ['Nội dung trực quan trên trang PDF gốc.'],
    };
  });

  const escape = (s: string) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  const slideBlocks = slides
    .map(
      (s, idx) => `<section class="slide">
        <div class="badge">MINH SPARK SLIDES · TRANG ${idx + 1} / ${slides.length}</div>
        <h2>${escape(s.title)}</h2>
        <ul>${s.bullets.map((b) => `<li>${escape(b)}</li>`).join('')}</ul>
      </section>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>${escape(cleanTitle)} — Slide Deck</title>
<style>
  body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px; display: flex; flex-direction: column; gap: 28px; align-items: center; }
  .slide { width: min(960px, 94vw); min-height: 500px; background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 16px; padding: 48px 56px; box-sizing: border-box; box-shadow: 0 20px 50px rgba(0,0,0,0.45); display: flex; flex-direction: column; justify-content: center; }
  .badge { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; color: #f87171; margin-bottom: 16px; }
  h2 { font-size: 28px; margin: 0 0 24px; line-height: 1.3; color: #ffffff; }
  ul { margin: 0; padding-left: 24px; display: flex; flex-direction: column; gap: 12px; font-size: 18px; line-height: 1.55; color: #cbd5e1; }
  @media print { body { background: #fff; padding: 0; } .slide { page-break-after: always; box-shadow: none; width: 100%; } }
</style>
</head>
<body>
${slideBlocks}
</body>
</html>`;

  return { slides, html };
}
