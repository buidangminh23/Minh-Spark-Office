import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ConversionOptions, ConversionResult } from './conversionTypes';
import { checkConversionAbort, conversionBaseName } from './conversionTypes';

export type MediaTextLine = { text: string; x: number; y: number; width: number; height: number };
export type MediaPage = { width: number; height: number; lines: MediaTextLine[]; image?: Blob; transform?: number[] };

const MAX_PIXELS = 16_000_000;
const MAX_PAGES = 200;
const MAX_BYTES = 100 * 1024 * 1024;
export { mediaConversionTargets } from './mediaConversionFormats';
import { mediaConversionTargets } from './mediaConversionFormats';

function positionedRows(lines: MediaTextLine[]): { text: string; x: number }[][] {
  const rows: { y: number; height: number; parts: MediaTextLine[] }[] = [];
  for (const line of [...lines].filter((line) => line.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.findLast((entry) => Math.abs(entry.y - line.y) <= Math.max(2, Math.min(entry.height, line.height) * 0.45));
    if (row) row.parts.push(line);
    else rows.push({ y: line.y, height: line.height, parts: [line] });
  }
  return rows.map((row) => {
    const cells: { text: string; x: number }[] = [];
    let right = -Infinity;
    for (const part of row.parts.sort((a, b) => a.x - b.x)) {
      const gap = part.x - right;
      if (cells.length && gap <= Math.max(12, part.height * 1.5)) cells[cells.length - 1].text += `${gap > 1 ? ' ' : ''}${part.text}`;
      else cells.push({ text: part.text, x: part.x });
      right = Math.max(right, part.x + part.width);
    }
    return cells;
  });
}

export function mediaTextRows(lines: MediaTextLine[]): string[][] {
  return positionedRows(lines).map((row) => row.map((cell) => cell.text));
}

export function mediaTextTable(lines: MediaTextLine[]): string[][] {
  const rows = positionedRows(lines);
  const starts: number[] = [];
  for (const x of rows.flatMap((row) => row.map((cell) => cell.x)).sort((a, b) => a - b)) {
    if (!starts.length || x - starts[starts.length - 1] > 14) starts.push(x);
  }
  if (starts.length > 512) throw new Error('Trang có quá nhiều cột nhận dạng. Hãy chuyển sang Word hoặc văn bản để kiểm tra.');
  return rows.map((row) => {
    const values = Array<string>(starts.length).fill('');
    for (const cell of row) {
      const index = starts.reduce((best, x, candidate) => Math.abs(x - cell.x) < Math.abs(starts[best] - cell.x) ? candidate : best, 0);
      values[index] += (values[index] ? ' ' : '') + cell.text;
    }
    return values;
  });
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!);
const pageText = (page: MediaPage) => mediaTextRows(page.lines).map((cells) => cells.join('\t')).join('\n');

export async function buildMediaTextResult(pages: MediaPage[], target: string, title: string): Promise<ConversionResult> {
  if (!pages.some((page) => page.lines.some((line) => line.text.trim()))) throw new Error('Không tìm thấy chữ để chuyển đổi. Bật OCR cho bản quét hoặc chọn định dạng giữ ảnh trang.');
  let blob: Blob;
  const warnings = ['Chữ và cột được tái dựng từ vị trí trên trang. Hãy đối chiếu số liệu, bảng và thứ tự đọc; phông chữ, công thức và bố cục gốc không được giữ nguyên.'];
  if (pages.some((page) => !page.lines.some((line) => line.text.trim()))) warnings.push('Một số trang không có chữ nhận dạng được; xem lại các trang trống trong kết quả.');
  if (target === 'txt') blob = new Blob([pages.map((page, index) => `--- Trang ${index + 1} ---\n${pageText(page)}`).join('\n\n')], { type: 'text/plain;charset=utf-8' });
  else if (target === 'html') blob = new Blob([`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{max-width:900px;margin:32px auto;padding:16px;font-family:Arial,sans-serif}section{break-after:page}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><body>${pages.map((page, index) => `<section><h2>Trang ${index + 1}</h2><pre>${escapeHtml(pageText(page))}</pre></section>`).join('')}</body></html>`], { type: 'text/html;charset=utf-8' });
  else if (target === 'xlsx') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    for (const [index, page] of pages.entries()) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mediaTextTable(page.lines)), `Trang ${index + 1}`);
    blob = new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } else if (target === 'docx') {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = await import('docx');
    blob = await Packer.toBlob(new Document({ title, sections: pages.map((page) => {
      const rows = mediaTextTable(page.lines);
      const tabular = rows.filter((row) => row.filter((cell) => cell.trim()).length > 1).length >= 2;
      const children = tabular
        ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((row) => new TableRow({ children: row.map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun(text)] })] })) })) })]
        : pageText(page).split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] }));
      return { children };
    }) }));
  } else if (target === 'pptx') {
    blob = await buildTextSlides(pages, title);
  } else throw new Error('Định dạng trích chữ chưa được hỗ trợ.');
  return { files: [{ name: `${title}.${target}`, blob }], warnings };
}

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;
const SLIDE_MARGIN = 0.5;

async function buildTextSlides(pages: MediaPage[], title: string): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const deck = new PptxGenJS();
  deck.layout = 'LAYOUT_WIDE';
  deck.title = title;
  for (const [index, page] of pages.entries()) {
    const lines = mediaTextRows(page.lines).map((cells) => cells.join('   ')).filter((line) => line.trim());
    const slide = deck.addSlide();
    const heading = lines[0] ?? `Trang ${index + 1}`;
    slide.addText(heading, { x: SLIDE_MARGIN, y: 0.35, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: 0.9, fontFace: 'Arial', fontSize: 26, bold: true, color: '1F2937', fit: 'shrink' });
    const body = lines.slice(1);
    if (body.length) slide.addText(body.map((text) => ({ text, options: { breakLine: true } })), { x: SLIDE_MARGIN, y: 1.4, w: SLIDE_WIDTH - SLIDE_MARGIN * 2, h: SLIDE_HEIGHT - 1.9, fontFace: 'Arial', fontSize: 16, color: '374151', valign: 'top', fit: 'shrink', paraSpaceAfter: 6 });
  }
  return await deck.write({ outputType: 'blob' }) as Blob;
}

async function canvasBlob(canvas: HTMLCanvasElement, target: string): Promise<Blob> {
  const mime = target === 'jpg' ? 'image/jpeg' : `image/${target}`;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Không mã hóa được ảnh.')), mime, 0.92));
  if (blob.type !== mime) throw new Error(`Trình duyệt này không xuất được ${target.toUpperCase()}. Hãy chọn PNG hoặc JPEG.`);
  return blob;
}

async function renderPdfPage(doc: PDFDocumentProxy, number: number, target: string, options: ConversionOptions): Promise<Blob> {
  checkConversionAbort(options);
  const page = await doc.getPage(number);
  checkConversionAbort(options);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (base.width * base.height)), 8192 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const render = page.render({ canvas, viewport, background: '#ffffff' });
  const cancel = () => render.cancel();
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    await render.promise;
    checkConversionAbort(options);
    return await canvasBlob(canvas, target);
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
}

async function readPdfLines(doc: PDFDocumentProxy, number: number): Promise<MediaPage> {
  const page = await doc.getPage(number);
  const viewport = page.getViewport({ scale: 1 });
  try {
    const content = await page.getTextContent();
    const lines = content.items.flatMap((item): MediaTextLine[] => {
      if (!('str' in item) || !item.str.trim()) return [];
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const height = Math.max(1, item.height || Math.hypot(item.transform[2], item.transform[3]));
      return [{ text: item.str, x, y: y - height, width: item.width, height }];
    });
    return { width: viewport.width, height: viewport.height, lines, transform: viewport.transform };
  } finally { page.cleanup(); }
}

async function loadImageCanvas(file: File, options: ConversionOptions, flatten: boolean): Promise<HTMLCanvasElement> {
  const { readImageFile } = await import('./imageFormats');
  const source = await readImageFile(file);
  checkConversionAbort(options);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        window.clearTimeout(timer);
        image.onload = image.onerror = null;
        options.signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new DOMException('Đã hủy chuyển đổi.', 'AbortError'));
      const timer = window.setTimeout(() => finish(new Error('Ảnh không đọc được hoặc quá lớn.')), 30_000);
      image.onload = () => finish();
      image.onerror = () => finish(new Error('Không đọc được định dạng ảnh này. Với HEIC/TIFF, hãy xuất PNG hoặc JPEG từ ứng dụng gốc rồi thử lại.'));
      options.signal?.addEventListener('abort', abort, { once: true });
      image.src = source.dataUrl;
      if (options.signal?.aborted) abort();
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_PIXELS || Math.max(image.naturalWidth, image.naturalHeight) > 8192) throw new Error('Ảnh vượt giới hạn 16 triệu điểm ảnh hoặc cạnh 8.192 px. Hãy giảm kích thước trước khi chuyển đổi.');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
    if (flatten) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    image.src = '';
    if (source.dataUrl.startsWith('blob:')) URL.revokeObjectURL(source.dataUrl);
  }
}

export async function buildMediaLayoutResult(pages: MediaPage[], target: string, title: string): Promise<ConversionResult> {
  if (!pages.length || pages.some((page) => !page.image)) throw new Error('Thiếu ảnh trang để giữ bố cục.');
  let blob: Blob;
  if (target === 'docx') {
    const { Document, Packer, Paragraph, ImageRun, SectionType, VerticalPositionRelativeFrom, HorizontalPositionRelativeFrom } = await import('docx');
    blob = await Packer.toBlob(new Document({ title, sections: await Promise.all(pages.map(async (page) => {
      const scale = Math.min(1, 1584 / page.width, 1584 / page.height);
      const width = page.width * scale;
      const height = page.height * scale;
      return {
        properties: { type: SectionType.NEXT_PAGE, page: { size: { width: Math.round(width * 20), height: Math.round(height * 20) }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: 'png', data: new Uint8Array(await page.image!.arrayBuffer()), transformation: { width: width * 4 / 3, height: height * 4 / 3 }, floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true } })] })],
      };
    })) }));
  } else if (target === 'pptx') {
    const { default: PptxGenJS } = await import('pptxgenjs');
    const deck = new PptxGenJS();
    const first = pages[0];
    const width = 10;
    const height = Math.min(56, width * first.height / first.width);
    deck.defineLayout({ name: 'CONVERSION', width, height });
    deck.layout = 'CONVERSION';
    deck.title = title;
    for (const page of pages) {
      const data = await blobDataUrl(page.image!);
      const scale = Math.min(width / page.width, height / page.height);
      const w = page.width * scale;
      const h = page.height * scale;
      deck.addSlide().addImage({ data, x: (width - w) / 2, y: (height - h) / 2, w, h });
    }
    blob = await deck.write({ outputType: 'blob' }) as Blob;
  } else throw new Error('Định dạng giữ bố cục chưa được hỗ trợ.');
  return { files: [{ name: `${title}.${target}`, blob }], warnings: ['Mỗi trang được giữ dưới dạng ảnh. Chữ, ô bảng và đối tượng trong trang không chỉnh sửa riêng được.', ...(target === 'pptx' && pages.some((page) => Math.abs(page.width / page.height - pages[0].width / pages[0].height) > 0.01) ? ['Các trang khác tỷ lệ được đặt vừa slide với khoảng trắng xung quanh.'] : [])] };
}

async function blobDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 24_576) parts.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24_576))));
  return `data:${blob.type};base64,${parts.join('')}`;
}

export async function convertMediaFile(file: File, target: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  checkConversionAbort(options);
  if (!mediaConversionTargets(file.name).some((entry) => entry.id === target)) throw new Error('Không hỗ trợ phép chuyển đổi này.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('Tệp phải có dữ liệu và không lớn hơn 100 MB.');
  const title = conversionBaseName(file.name);
  const pages: MediaPage[] = [];
  let originalPdf: ArrayBuffer | undefined;
  const ocrPages = new Set<number>();
  const warnings: string[] = [];
  const imageTarget = ['png', 'jpg', 'webp'].includes(target);
  const layout = (target === 'pptx' || target === 'docx') && options.fidelity !== 'editable';
  const textNeeded = !imageTarget && !layout;
  if (/\.pdf$/i.test(file.name)) {
    await import('../editors/pdf/pdfRender');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    originalPdf = await file.arrayBuffer();
    const task = getDocument({ data: new Uint8Array(originalPdf.slice(0)) });
    const cancel = () => { void task.destroy(); };
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const doc = await task.promise;
      if (doc.numPages > MAX_PAGES) throw new Error(`Tệp có ${doc.numPages} trang. Hãy tách thành phần tối đa ${MAX_PAGES} trang trước khi chuyển đổi.`);
      let totalBytes = 0;
      for (let index = 1; index <= doc.numPages; index++) {
        checkConversionAbort(options);
        options.onProgress?.(`Đang chuyển trang ${index}/${doc.numPages}…`);
        const page = await readPdfLines(doc, index);
        if (imageTarget || layout || (textNeeded && !page.lines.length && options.ocr !== false)) {
          page.image = await renderPdfPage(doc, index, imageTarget ? target : 'png', options);
          totalBytes += page.image.size;
          if (totalBytes > 200 * 1024 * 1024) throw new Error('Kết quả vượt 200 MB. Hãy tách tệp thành nhiều phần nhỏ.');
        }
        if (textNeeded && !page.lines.length && options.ocr !== false && page.image) {
          await applyOcr(page, options, warnings);
          ocrPages.add(index - 1);
        }
        pages.push(page);
      }
    } finally {
      options.signal?.removeEventListener('abort', cancel);
      await task.destroy();
    }
  } else {
    options.onProgress?.('Đang đọc ảnh…');
    const canvas = await loadImageCanvas(file, options, target === 'jpg');
    try {
      pages.push({ width: canvas.width * 0.75, height: canvas.height * 0.75, lines: [], image: await canvasBlob(canvas, imageTarget ? target : 'png') });
    } finally { canvas.width = canvas.height = 0; }
    if (textNeeded && options.ocr !== false) await applyOcr(pages[0], options, warnings);
    if (/\.(gif|webp|avif)$/i.test(file.name)) warnings.push('Ảnh động chỉ chuyển một khung hình tĩnh.');
  }
  checkConversionAbort(options);
  let result: ConversionResult;
  if (imageTarget) result = { files: pages.map((page, index) => ({ name: `${title}${pages.length > 1 ? ` - trang ${String(index + 1).padStart(3, '0')}` : ''}.${target}`, blob: page.image! })), warnings: [] };
  else if (layout) result = await buildMediaLayoutResult(pages, target, title);
  else if (target === 'pdf') result = await buildSearchableMediaPdf(pages, title, originalPdf, ocrPages);
  else result = await buildMediaTextResult(pages, target, title);
  checkConversionAbort(options);
  return { ...result, warnings: [...new Set([...warnings, ...result.warnings])] };
}

export async function extractPdfPageText(doc: PDFDocumentProxy, number: number, options: ConversionOptions & { forceOcr?: boolean } = {}): Promise<{ text: string; warnings: string[]; usedOcr: boolean }> {
  checkConversionAbort(options);
  const page = await readPdfLines(doc, number);
  checkConversionAbort(options);
  const warnings: string[] = [];
  const usedOcr = options.ocr !== false && (options.forceOcr === true || !page.lines.length);
  if (usedOcr) {
    options.onProgress?.('Đang dựng ảnh trang để nhận dạng chữ…');
    page.image = await renderPdfPage(doc, number, 'png', options);
    await applyOcr(page, options, warnings);
  }
  checkConversionAbort(options);
  return { text: pageText(page), warnings, usedOcr };
}

async function applyOcr(page: MediaPage, options: ConversionOptions, warnings: string[]) {
  const { recognizeImage } = await import('./conversionOcr');
  const recognized = await recognizeImage(page.image!, options);
  const scaleX = page.width / recognized.width;
  const scaleY = page.height / recognized.height;
  page.lines = recognized.lines.flatMap((line) => line.words?.length ? line.words : [line]).map((line) => ({ text: line.text, x: line.bbox.x0 * scaleX, y: line.bbox.y0 * scaleY, width: (line.bbox.x1 - line.bbox.x0) * scaleX, height: (line.bbox.y1 - line.bbox.y0) * scaleY }));
  warnings.push('Đã dùng OCR. Hãy đối chiếu chữ, dấu tiếng Việt và số liệu với bản gốc trước khi sử dụng.');
  if (recognized.fallbackReason) warnings.push(`Chưa dùng được bộ đọc chữ tiếng Việt (${recognized.fallbackReason}), đã chuyển sang bộ OCR cơ bản nên độ chính xác thấp hơn.`);
  const turn = Math.round((recognized.angle ?? 0) / 90) % 4;
  if (turn) warnings.push(`Trang ${turn === 2 ? 'bị lật ngược' : 'bị xoay ngang'} đã được tự xoay lại trước khi nhận dạng.`);
  if (recognized.confidence < 70) warnings.push(`Độ tin cậy OCR thấp (${Math.round(recognized.confidence)}%). Nên dùng ảnh rõ hơn và kiểm tra lại nội dung nhận dạng.`);
}

async function buildSearchableMediaPdf(pages: MediaPage[], title: string, originalPdf?: ArrayBuffer, ocrPages = new Set<number>()): Promise<ConversionResult> {
  if (originalPdf) {
    if (!ocrPages.size) return { files: [{ name: `${title}.pdf`, blob: new Blob([originalPdf], { type: 'application/pdf' }) }], warnings: [] };
    const { overlayMediaPdfText } = await import('./mediaConversionPdf');
    return { files: [{ name: `${title}.pdf`, blob: await overlayMediaPdfText(originalPdf, pages, ocrPages) }], warnings: ['Đã bổ sung lớp chữ OCR trên trang gốc. Việc lưu lại PDF có thể làm mất hiệu lực chữ ký số.'] };
  }
  const { buildPdf } = await import('./docPageFormats');
  const { basePage } = await import('./storage');
  const blob = await buildPdf({
    title,
    page: basePage(),
    pages: pages.map((page) => ({ blob: page.image!, mime: 'image/png', cssWidth: page.width / 0.75, cssHeight: page.height / 0.75, pixelWidth: page.width / 0.75, pixelHeight: page.height / 0.75 })),
    runs: pages.flatMap((page, index) => page.lines.map((line) => ({ page: index, text: line.text, x: line.x / 0.75, y: line.y / 0.75, w: line.width / 0.75, h: line.height / 0.75 }))),
    links: [],
  });
  return { files: [{ name: `${title}.pdf`, blob }], warnings: pages.some((page) => page.lines.length) ? [] : ['PDF chỉ chứa ảnh; không có lớp chữ tìm kiếm.'] };
}
