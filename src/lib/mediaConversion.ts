import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ConversionOptions, ConversionResult } from './conversionTypes';
import { checkConversionAbort, conversionBaseName } from './conversionTypes';
import type { OcrPage } from './conversionOcr';
import type { EditableSlide } from './editableSlidesDeck';
import type { TextSegment } from './slideTextPaint';
import { includeWidgetValues, pdfFormFields, wordPageSize, type PdfFormField } from './mediaPageLayout';

export type MediaTextLine = { text: string; x: number; y: number; width: number; height: number; rotated?: boolean };
export type MediaPage = { width: number; height: number; lines: MediaTextLine[]; image?: Blob; transform?: number[]; fields?: PdfFormField[]; hasAnnotations?: boolean };

const MAX_PIXELS = 16_000_000;
const MAX_PAGES = 200;
const MAX_BYTES = 100 * 1024 * 1024;
const OCR_MAX_EDGE = 2600;
const LAYOUT_MAX_EDGE = 3200;
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024;
const IMAGE_POINTS_PER_PIXEL = 0.75;
const BASE64_BYTES_PER_CHAR = 0.75;
export { mediaConversionTargets } from './mediaConversionFormats';
import { imageSourceFormat, IMAGE_OUTPUT_EXTENSIONS, mediaConversionTargets } from './mediaConversionFormats';
import { imageCanvases, svgzImage, validatedImageCopy, type FrameTiming } from './mediaConversionImage';
import { encodeBmp, encodeTiff, joinEncodedTiffPages } from './mediaConversionRaster';
import { compressedSvg, encodeIcon, encodeImageInWorker, hasJfifHeader, jpegAsJfif, svgWithImage } from './mediaConversionOutput';
import { pdfReadingSpans, type PdfTextSpan } from './mediaConversionPdfGlyphs';

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
  if (['csv', 'tsv', 'json'].includes(target)) {
    const files = pages.map((page, index) => {
      const rows = mediaTextTable(page.lines);
      const name = mediaPageName(title, target, index, pages.length);
      if (target === 'json') return { name, blob: new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' }) };
      const separator = target === 'csv' ? ',' : '\t';
      const quote = (cell: string) => /["\r\n\t,]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
      const content = rows.map((row) => row.map(quote).join(separator)).join('\r\n');
      const mime = target === 'csv' ? 'text/csv' : 'text/tab-separated-values';
      return { name, blob: new Blob(['\uFEFF', content, '\r\n'], { type: `${mime};charset=utf-8` }) };
    });
    return { files, warnings };
  }
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
      const { width, height, size } = wordPageSize(page);
      const margin = Math.round(Math.min(36, Math.min(width, height) / 12) * 20);
      return { properties: { page: { size, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children };
    }) }));
  } else throw new Error('Định dạng trích chữ chưa được hỗ trợ.');
  return { files: [{ name: `${title}.${target}`, blob }], warnings };
}

function mediaPageName(title: string, target: string, index: number, count: number) {
  return `${title}${count > 1 ? ` - trang ${String(index + 1).padStart(3, '0')}` : ''}.${target}`;
}

async function canvasBlob(canvas: HTMLCanvasElement, target: string, options: ConversionOptions = {}, frame?: FrameTiming): Promise<Blob> {
  const pixels = () => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
    return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  if (target === 'bmp') return encodeBmp(pixels());
  if (target === 'dib') return encodeBmp(pixels()).slice(14, undefined, 'image/bmp');
  if (target === 'tiff') return encodeTiff(pixels());
  if (target === 'ico') return encodeIcon(canvas);
  if (target === 'jfif') return jpegAsJfif(await canvasBlob(canvas, 'jpg'));
  if (['gif', 'avif', 'heic', 'heif'].includes(target)) return encodeImageInWorker(canvas, target, options, frame);
  if (target === 'svg' || target === 'svgz') {
    const svg = await svgWithImage(await canvasBlob(canvas, 'png'), canvas.width, canvas.height);
    return target === 'svgz' ? compressedSvg(svg) : svg;
  }
  const mime = target === 'jpg' ? 'image/jpeg' : `image/${target}`;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (target === 'webp' && blob?.type !== mime) {
    const { default: encode } = await import('@jsquash/webp/encode');
    return new Blob([await encode(pixels(), { quality: 92 })], { type: mime });
  }
  if (blob?.type !== mime) throw new Error(`Trình duyệt này không xuất được ${target.toUpperCase()}. Hãy chọn PNG hoặc JPEG.`);
  return blob;
}

async function renderPdfCanvas(doc: PDFDocumentProxy, number: number, maxEdge: number, options: ConversionOptions): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  checkConversionAbort(options);
  const page = await doc.getPage(number);
  checkConversionAbort(options);
  const base = page.getViewport({ scale: 1 });
  const longest = Math.max(base.width, base.height);
  const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (base.width * base.height)), 8192 / longest, maxEdge / longest);
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
    return { canvas, scale };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    page.cleanup();
  }
}

export async function renderPdfPage(doc: PDFDocumentProxy, number: number, target: string, options: ConversionOptions, maxEdge = Infinity): Promise<Blob> {
  const { canvas } = await renderPdfCanvas(doc, number, maxEdge, options);
  try {
    return await canvasBlob(canvas, target, options);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function readPdfLines(doc: PDFDocumentProxy, number: number, includeAnnotations = false): Promise<MediaPage> {
  const page = await doc.getPage(number);
  const viewport = page.getViewport({ scale: 1 });
  try {
    const [content, annotations] = await Promise.all([page.getTextContent(), includeAnnotations ? page.getAnnotations({ intent: 'any' }) : Promise.resolve([])]);
    const spans = content.items.flatMap((item): PdfTextSpan[] => {
      if (!('str' in item) || !item.str.trim()) return [];
      const [a, b, c, d, e, f] = item.transform;
      const advance = item.width / (Math.hypot(a, b) || 1);
      const rise = (item.height || Math.hypot(c, d)) / (Math.hypot(c, d) || 1);
      const start = viewport.convertToViewportPoint(e, f);
      const end = viewport.convertToViewportPoint(e + a * advance, f + b * advance);
      const top = viewport.convertToViewportPoint(e + c * rise, f + d * rise);
      const far = [end[0] + top[0] - start[0], end[1] + top[1] - start[1]];
      const xs = [start[0], end[0], top[0], far[0]];
      const ys = [start[1], end[1], top[1], far[1]];
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return [{ item, line: { text: item.str, x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y), rotated: end[0] <= start[0] || Math.abs(end[1] - start[1]) > Math.abs(end[0] - start[0]) * 0.05 } }];
    });
    const lines = await pdfReadingSpans(page, spans);
    return { width: viewport.width, height: viewport.height, lines, transform: viewport.transform, fields: pdfFormFields(annotations, (x, y) => viewport.convertToViewportPoint(x, y)), hasAnnotations: annotations.length > 0 };
  } finally { page.cleanup(); }
}

export async function buildMediaLayoutResult(pages: MediaPage[], target: string, title: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  if (!pages.length || pages.some((page) => !page.image)) throw new Error('Thiếu ảnh trang để giữ bố cục.');
  let blob: Blob;
  if (target === 'docx') {
    const { Document, Packer, Paragraph, ImageRun, SectionType, VerticalPositionRelativeFrom, HorizontalPositionRelativeFrom } = await import('docx');
    blob = await Packer.toBlob(new Document({ title, sections: await Promise.all(pages.map(async (page) => {
      const { width, height, size } = wordPageSize(page);
      return {
        properties: { type: SectionType.NEXT_PAGE, page: { size, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
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
  } else if (target === 'html' || target === 'xlsx') {
    return buildPageReference(pages, target, title, options);
  } else throw new Error('Định dạng giữ bố cục chưa được hỗ trợ.');
  return { files: [{ name: `${title}.${target}`, blob }], warnings: ['Mỗi trang được giữ dưới dạng ảnh. Chữ, ô bảng và đối tượng trong trang không chỉnh sửa riêng được.', ...(target === 'pptx' && pages.some((page) => Math.abs(page.width / page.height - pages[0].width / pages[0].height) > 0.01) ? ['Các trang khác tỷ lệ được đặt vừa slide với khoảng trắng xung quanh.'] : [])] };
}

async function blobDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 24_576) parts.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24_576))));
  return `data:${blob.type};base64,${parts.join('')}`;
}

function htmlFormField(field: PdfFormField, page: MediaPage) {
  const { x, y, width, height } = field.line;
  const attributes = `class="field" aria-label="${escapeHtml(field.label)}" name="pdf-${escapeHtml(field.name)}" style="left:${100*x/page.width}%;top:${100*y/page.height}%;width:${100*width/page.width}%;height:${100*height/page.height}%;font-size:${Math.min(13, height * 0.75) / page.width * 100}cqw"${field.readOnly ? ' disabled' : ''}`;
  const value = escapeHtml(field.values.join('\n'));
  if (field.kind === 'textarea') return `<textarea ${attributes}>${value}</textarea>`;
  if (field.kind === 'select') {
    const choices = [...field.choices];
    for (const entry of field.values) if (!choices.some((choice) => choice.exportValue === entry)) choices.push({ displayValue: entry, exportValue: entry });
    const empty = field.values.length || field.multiple ? '' : '<option selected value=""></option>';
    const items = choices.map((choice) => `<option value="${escapeHtml(choice.exportValue)}"${field.values.includes(choice.exportValue) ? ' selected' : ''}>${escapeHtml(choice.displayValue)}</option>`).join('');
    return `<select ${attributes}${field.multiple ? ' multiple' : ''}>${empty}${items}</select>`;
  }
  return `<input ${attributes} type="${field.kind}" value="${value}"${field.checked ? ' checked' : ''}>`;
}

async function buildPageReference(pages: MediaPage[], target: 'xlsx' | 'html', title: string, options: ConversionOptions): Promise<ConversionResult> {
  if (target === 'html') {
    const parts = ['<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>', escapeHtml(title), '</title><style>*{box-sizing:border-box}body{margin:0;background:#eee}section{position:relative;container-type:inline-size;margin:auto auto 16px;background:white;break-after:page}section:last-child{break-after:auto}img{display:block;width:100%;height:100%}span{position:absolute;white-space:pre;color:transparent;font-family:Arial,sans-serif;line-height:1}::selection{background:#77aaff99}@media print{body{background:white}section{margin:0;max-width:100%}}</style><body>'];
    if (pages.some((page) => page.fields?.length)) {
      parts.push('<style>.field{display:none;position:absolute;box-sizing:border-box;margin:0;padding:0 2px;font-family:Arial,sans-serif;color:#111;background:white;border:1px solid #778;resize:none}.field:disabled{opacity:1}#edit-fields:checked~section .field{display:block}#edit-fields+label{font:14px system-ui;display:inline-block;margin:8px 4px}@media print{#edit-fields,#edit-fields+label{display:none}}</style><input id="edit-fields" type="checkbox"><label for="edit-fields">Điền biểu mẫu</label>');
    }
    for (const [index, page] of pages.entries()) {
      checkConversionAbort(options);
      parts.push(`<section aria-label="Trang ${index + 1}" style="width:min(100%,${page.width}pt);aspect-ratio:${page.width}/${page.height}"><img alt="Trang ${index + 1}" src="${await blobDataUrl(page.image!)}">`);
      for (const line of page.lines) parts.push(`<span style="left:${line.x / page.width * 100}%;top:${line.y / page.height * 100}%;font-size:${line.height / page.width * 100}cqw">${escapeHtml(line.text)}</span>`);
      for (const field of page.fields ?? []) parts.push(htmlFormField(field, page));
      parts.push('</section>');
    }
    parts.push('</body></html>');
    return { files: [{ name: `${title}.html`, blob: new Blob(parts, { type: 'text/html;charset=utf-8' }) }], warnings: ['Ảnh từng trang được nhúng trong HTML. Có thể tìm và sao chép những phần có lớp chữ.'] };
  }
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.title = title;
  let hasData = false;
  for (const [index, page] of pages.entries()) {
    checkConversionAbort(options);
    const sheet = book.addWorksheet(`Mẫu ${index + 1}`, { views: [{ showGridLines: false }], pageSetup: { orientation: page.width > page.height ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
    const id = book.addImage({ extension: 'png', base64: await blobDataUrl(page.image!) });
    const width = page.width / IMAGE_POINTS_PER_PIXEL;
    const height = page.height / IMAGE_POINTS_PER_PIXEL;
    sheet.addImage(id, { tl: { col: 0, row: 0 }, ext: { width, height } });
    const rows = mediaTextTable(page.lines);
    if (rows.length) {
      hasData = true;
      const data = book.addWorksheet(`Dữ liệu ${index + 1}`);
      data.addRows(rows);
      data.columns.forEach((column) => {
        let widest = 0;
        column.eachCell?.((cell) => { widest = Math.max(widest, cell.text.length); });
        column.width = Math.max(12, Math.min(70, widest + 2));
        column.alignment = { wrapText: true, vertical: 'top' };
      });
    }
  }
  checkConversionAbort(options);
  const { writeImageWorkbook } = await import('./conversionImageWorkbook');
  const blob = await writeImageWorkbook(book, options);
  return { files: [{ name: `${title}.xlsx`, blob }], warnings: [hasData ? 'Trang tính Mẫu giữ ảnh gốc. Trang tính Dữ liệu chứa chữ và giá trị có thể chỉnh sửa theo cột nhận dạng.' : 'Các trang tính Mẫu giữ ảnh gốc. Chưa có chữ để tạo trang tính Dữ liệu.'] };
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
  const imageTarget = IMAGE_OUTPUT_EXTENSIONS.includes(target);
  const editableSlides = target === 'pptx' && options.fidelity === 'editable';
  const pageReference = (target === 'html' || target === 'xlsx') && options.fidelity !== 'editable';
  const layout = ((target === 'pptx' || target === 'docx') && options.fidelity !== 'editable') || pageReference;
  const textNeeded = !imageTarget && (!layout || pageReference) && !editableSlides;
  const slides: EditableSlide[] = [];
  let timing: FrameTiming | undefined;
  if (/\.pdf$/i.test(file.name)) {
    await import('../editors/pdf/pdfRender');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    originalPdf = await file.arrayBuffer();
    const task = getDocument({ data: new Uint8Array(originalPdf.slice(0)) });
    const cancel = () => { void task.destroy(); };
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const doc = await task.promise;
      if (target === 'pdf') {
        const { info } = await doc.getMetadata() as { info: { IsAcroFormPresent?: boolean; IsXFAPresent?: boolean; IsSignaturesPresent?: boolean } };
        if (options.ocr === false || info.IsAcroFormPresent || info.IsXFAPresent || info.IsSignaturesPresent) {
          checkConversionAbort(options);
          return { files: [{ name: `${title}.pdf`, blob: file }], warnings: options.ocr !== false ? ['PDF có biểu mẫu hoặc chữ ký. Đã giữ nguyên tệp gốc cùng các trường, giá trị và chữ ký hiện có.'] : [] };
        }
      }
      if (doc.numPages > MAX_PAGES) throw new Error(`Tệp có ${doc.numPages} trang. Hãy tách thành phần tối đa ${MAX_PAGES} trang trước khi chuyển đổi.`);
      let totalBytes = 0;
      for (let index = 1; index <= doc.numPages; index++) {
        checkConversionAbort(options);
        options.onProgress?.(`Đang chuyển trang ${index}/${doc.numPages}…`);
        const page = await readPdfLines(doc, index, textNeeded);
        if (target === 'pdf' && page.hasAnnotations && !page.lines.length) {
          warnings.push(`Trang ${index} có chú thích hoặc liên kết. Đã giữ nguyên trang gốc khi tạo PDF.`);
          pages.push(page);
          continue;
        }
        if (editableSlides) {
          const slide = await editablePdfSlide(doc, index, page, options, warnings);
          totalBytes += slide.background.length * BASE64_BYTES_PER_CHAR;
          if (totalBytes > MAX_OUTPUT_BYTES) throw new Error('Kết quả vượt 200 MB. Hãy tách tệp thành nhiều phần nhỏ.');
          slides.push(slide);
          continue;
        }
        if (imageTarget || layout || (textNeeded && !page.lines.length && options.ocr !== false)) {
          page.image = await renderPdfPage(doc, index, imageTarget ? target : 'png', options, imageTarget ? Infinity : layout ? LAYOUT_MAX_EDGE : OCR_MAX_EDGE);
          totalBytes += page.image.size;
          if (totalBytes > 200 * 1024 * 1024) throw new Error('Kết quả vượt 200 MB. Hãy tách tệp thành nhiều phần nhỏ.');
        }
        if (textNeeded && !page.lines.length && options.ocr !== false && page.image) {
          await mediaExportOcr(page, options, warnings, pageReference);
          ocrPages.add(index - 1);
        }
        if (page.fields?.length) page.lines = includeWidgetValues(page.lines, page.fields.map((field) => field.line));
        pages.push(page);
      }
    } finally {
      options.signal?.removeEventListener('abort', cancel);
      await task.destroy();
    }
  } else {
    options.onProgress?.('Đang đọc ảnh…');
    const sourceFormat = imageSourceFormat(file.name);
    if (sourceFormat === target) {
      const copy = await validatedImageCopy(file, target, options);
      checkConversionAbort(options);
      return { files: [{ name: `${title}.${target}`, blob: copy }], warnings: [] };
    }
    if (['svg', 'svgz'].includes(sourceFormat) && ['svg', 'svgz'].includes(target)) {
      const svg = sourceFormat === 'svgz' ? await svgzImage(file, options) : file;
      const original = await validatedImageCopy(new File([svg], 'source.svg'), 'svg', options);
      const blob = target === 'svgz' ? await compressedSvg(original) : original;
      return { files: [{ name: `${title}.${target}`, blob }], warnings: [] };
    }
    if (sourceFormat === 'heic' && target === 'heif') {
      const original = await validatedImageCopy(file, sourceFormat, options);
      return { files: [{ name: `${title}.heif`, blob: original.slice(0, original.size, 'image/heif') }], warnings: [] };
    }
    if (sourceFormat === 'jpg' && target === 'jfif' && await hasJfifHeader(file)) {
      return { files: [{ name: `${title}.jfif`, blob: file.slice(0, file.size, 'image/jpeg') }], warnings: [] };
    }
    let totalBytes = 0;
    for await (const canvas of imageCanvases(file, options, target === 'jpg' || target === 'jfif' || editableSlides, warnings, target === 'gif' ? frame => { timing = frame; } : undefined)) {
      try {
        checkConversionAbort(options);
        options.onProgress?.(`Đang chuyển trang ${(editableSlides ? slides : pages).length + 1}…`);
        if (editableSlides) {
          const segments = options.ocr === false ? [] : await ocrSegments(await canvasBlob(canvas, 'png'), canvas, options, warnings);
          const slide = await finishEditableSlide(canvas, canvas.width * IMAGE_POINTS_PER_PIXEL, canvas.height * IMAGE_POINTS_PER_PIXEL, 1 / IMAGE_POINTS_PER_PIXEL, segments);
          totalBytes += slide.background.length * BASE64_BYTES_PER_CHAR;
          slides.push(slide);
        } else {
          const image = await canvasBlob(canvas, imageTarget ? target : 'png', options, timing);
          totalBytes += image.size;
          const page: MediaPage = { width: canvas.width * IMAGE_POINTS_PER_PIXEL, height: canvas.height * IMAGE_POINTS_PER_PIXEL, lines: [], image };
          if (textNeeded && options.ocr !== false) await mediaExportOcr(page, options, warnings, pageReference || target === 'pdf');
          pages.push(page);
        }
        if (totalBytes > MAX_OUTPUT_BYTES) throw new Error('Kết quả vượt 200 MB. Hãy tách tệp thành nhiều phần nhỏ.');
      } finally { canvas.width = canvas.height = 0; }
    }
  }
  checkConversionAbort(options);
  let result: ConversionResult;
  if (editableSlides) result = await buildEditableSlidesResult(slides, title);
  else if (target === 'tiff') result = { files: [{ name: `${title}.tiff`, blob: await joinEncodedTiffPages(pages.map((page) => page.image!), options) }], warnings: [] };
  else if (target === 'gif' && timing) result = { files: [{ name: `${title}.gif`, blob: new Blob(pages.map(page => page.image!), { type: 'image/gif' }) }], warnings: [] };
  else if (imageTarget) result = { files: pages.map((page, index) => ({ name: mediaPageName(title, target, index, pages.length), blob: page.image! })), warnings: [] };
  else if (layout) result = await buildMediaLayoutResult(pages, target, title, options);
  else if (target === 'pdf') result = await buildEditableMediaPdf(pages, title, originalPdf, ocrPages, options);
  else result = await buildMediaTextResult(pages, target, title);
  checkConversionAbort(options);
  return { ...result, warnings: [...new Set([...warnings, ...result.warnings])] };
}

async function mediaExportOcr(page: MediaPage, options: ConversionOptions, warnings: string[], keepImage: boolean) {
  try { await applyOcr(page, options, warnings); }
  catch (error) {
    checkConversionAbort(options);
    if (!keepImage || (error instanceof Error && error.name === 'AbortError')) throw error;
    warnings.push('Chưa nhận dạng được chữ trên một số trang. Ảnh gốc của các trang này vẫn có trong kết quả.');
  }
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

export async function applyOcr(page: MediaPage, options: ConversionOptions, warnings: string[]) {
  const { recognizeImage } = await import('./conversionOcr');
  const recognized = await recognizeImage(page.image!, options);
  const scaleX = page.width / recognized.width;
  const scaleY = page.height / recognized.height;
  page.lines = recognized.lines.flatMap((line) => line.words?.length ? line.words : [line]).map((line) => ({ text: line.text, x: line.bbox.x0 * scaleX, y: line.bbox.y0 * scaleY, width: (line.bbox.x1 - line.bbox.x0) * scaleX, height: (line.bbox.y1 - line.bbox.y0) * scaleY }));
  addOcrWarnings(recognized, warnings);
}

function addOcrWarnings(recognized: OcrPage, warnings: string[]) {
  warnings.push('Đã dùng OCR. Hãy đối chiếu chữ, dấu tiếng Việt và số liệu với bản gốc trước khi sử dụng.');
  if (recognized.fallbackReason) warnings.push(`Chưa dùng được bộ đọc chữ tiếng Việt (${recognized.fallbackReason}), đã chuyển sang bộ OCR cơ bản nên độ chính xác thấp hơn.`);
  const turn = Math.round((recognized.angle ?? 0) / 90) % 4;
  if (turn) warnings.push(`Trang ${turn === 2 ? 'bị lật ngược' : 'bị xoay ngang'} đã được tự xoay lại trước khi nhận dạng.`);
  if (recognized.confidence < 70) warnings.push(`Độ tin cậy OCR thấp (${Math.round(recognized.confidence)}%). Nên dùng ảnh rõ hơn và kiểm tra lại nội dung nhận dạng.`);
}

async function ocrSegments(image: Blob, canvas: HTMLCanvasElement, options: ConversionOptions, warnings: string[]): Promise<TextSegment[]> {
  const [{ recognizeImage }, { segmentsFromOcr }] = await Promise.all([import('./conversionOcr'), import('./slideTextPaint')]);
  const recognized = await recognizeImage(image, options);
  addOcrWarnings(recognized, warnings);
  const scaleX = canvas.width / recognized.width;
  const scaleY = canvas.height / recognized.height;
  const scaleBox = (box: OcrPage['lines'][number]['bbox']) => ({ x0: box.x0 * scaleX, y0: box.y0 * scaleY, x1: box.x1 * scaleX, y1: box.y1 * scaleY });
  return segmentsFromOcr(recognized.lines.map((line) => ({ ...line, bbox: scaleBox(line.bbox), words: line.words.map((word) => ({ ...word, bbox: scaleBox(word.bbox) })) })));
}

async function slideBackground(canvas: HTMLCanvasElement): Promise<string> {
  const png = await canvasBlob(canvas, 'png');
  const jpeg = await canvasBlob(canvas, 'jpg');
  return blobDataUrl(png.size <= jpeg.size * 1.5 ? png : jpeg);
}

async function finishEditableSlide(canvas: HTMLCanvasElement, width: number, height: number, scale: number, segments: TextSegment[]): Promise<EditableSlide> {
  const { paintAndErase } = await import('./slideTextPaint');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Không khởi tạo được bộ xử lý ảnh.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const measure = (text: string, fontPx: number, bold: boolean) => {
    context.font = `${bold ? 'bold ' : ''}${fontPx}px Arial, Helvetica, sans-serif`;
    return context.measureText(text).width;
  };
  const lines = paintAndErase({ data: pixels.data, width: pixels.width, height: pixels.height }, segments, measure);
  context.putImageData(pixels, 0, 0);
  return { width, height, scale, background: await slideBackground(canvas), lines };
}

async function editablePdfSlide(doc: PDFDocumentProxy, number: number, page: MediaPage, options: ConversionOptions, warnings: string[]): Promise<EditableSlide> {
  const { canvas, scale } = await renderPdfCanvas(doc, number, OCR_MAX_EDGE, options);
  try {
    let segments: TextSegment[] = [];
    if (page.lines.length) segments = (await import('./slideTextPaint')).segmentsFromTextItems(page.lines.filter((line) => !line.rotated), scale);
    else if (options.ocr !== false) {
      options.onProgress?.(`Đang nhận dạng chữ trang ${number}…`);
      segments = await ocrSegments(await canvasBlob(canvas, 'png'), canvas, options, warnings);
    }
    checkConversionAbort(options);
    return await finishEditableSlide(canvas, page.width, page.height, scale, segments);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

async function buildEditableSlidesResult(slides: EditableSlide[], title: string): Promise<ConversionResult> {
  if (!slides.length) throw new Error('Không có trang nào để dựng slide.');
  const [{ default: PptxGenJS }, { fillEditableDeck }] = await Promise.all([import('pptxgenjs'), import('./editableSlidesDeck')]);
  const blob = await fillEditableDeck(new PptxGenJS(), slides, title).write({ outputType: 'blob' }) as Blob;
  const warnings = ['Chữ được đặt lại đúng vị trí trên nền trang gốc và sửa được trong PowerPoint. Phông chữ thay bằng Arial nên độ rộng chữ có thể lệch nhẹ so với bản gốc.'];
  if (slides.some((slide) => !slide.lines.length)) warnings.push('Một số trang không có chữ nhận dạng được nên giữ nguyên dạng ảnh.');
  return { files: [{ name: `${title}.pptx`, blob }], warnings };
}

async function buildEditableMediaPdf(pages: MediaPage[], title: string, originalPdf: ArrayBuffer | undefined, ocrPages: Set<number>, options: ConversionOptions): Promise<ConversionResult> {
  const editableIndices = originalPdf ? [...ocrPages] : pages.flatMap((page, index) => page.lines.length ? [index] : []);
  if (editableIndices.length) {
    const { prepareEditablePdfPage } = await import('./pdfEditableOcr');
    const { buildEditablePdf } = await import('./pdfOcrDocument');
    const inputs = [];
    const warnings = ['Đã tạo chữ PDF chỉnh sửa được. Nền trang và bố cục được giữ; phông chữ tái tạo có thể khác bản scan.'];
    const indices = originalPdf ? editableIndices : pages.map((_, index) => index);
    for (const index of indices) {
      checkConversionAbort(options);
      if (!originalPdf && !pages[index].lines.length) {
        const { width, height, image } = pages[index];
        inputs.push({ pageIndex: index, width, height, lines: [], background: new Uint8Array(await image!.arrayBuffer()) });
        continue;
      }
      const result = await prepareEditablePdfPage(pages[index], index, options);
      if (result.page.lines.length || !originalPdf) inputs.push(result.page);
      warnings.push(...result.warnings);
    }
    if (!inputs.length && originalPdf) return { files: [{ name: `${title}.pdf`, blob: new Blob([originalPdf], { type: 'application/pdf' }) }], warnings: ['Không nhận dạng được vùng chữ để chỉnh sửa. Tệp gốc được giữ nguyên.'] };
    if (!inputs.length) throw new Error('Không nhận dạng được vùng chữ để chỉnh sửa. Tệp gốc được giữ nguyên.');
    const bytes = await buildEditablePdf(originalPdf, inputs);
    checkConversionAbort(options);
    if (originalPdf) warnings.push('Việc lưu lại PDF có thể làm mất hiệu lực chữ ký số.');
    return { files: [{ name: `${title}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }], warnings };
  }
  if (originalPdf) {
    return { files: [{ name: `${title}.pdf`, blob: new Blob([originalPdf], { type: 'application/pdf' }) }], warnings: [] };
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
