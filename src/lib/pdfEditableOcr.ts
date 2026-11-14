import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ConversionOptions } from './conversionTypes';
import { checkConversionAbort } from './conversionTypes';
import type { MediaPage } from './mediaConversion';
import type { EditablePdfPageInput } from './pdfOcrTypes';
import { prepareEditableBackground } from './ocr/editableBackground';

export async function prepareEditablePdfPage(page: MediaPage, pageIndex: number, options: ConversionOptions = {}): Promise<{ page: EditablePdfPageInput; warnings: string[] }> {
  checkConversionAbort(options);
  if (!page.image) throw new Error('Thiếu ảnh nền trang PDF để tạo chữ chỉnh sửa được.');
  const url = URL.createObjectURL(page.image);
  const image = new Image();
  image.src = url;
  const canvas = document.createElement('canvas');
  try {
    await image.decode();
    checkConversionAbort(options);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không tạo được nền trang PDF.');
    context.drawImage(image, 0, 0);
    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / page.width;
    const scaleY = canvas.height / page.height;
    const result = prepareEditableBackground(source, page.lines.map((line) => ({
      text: line.text, confidence: 100,
      bbox: { x0: line.x * scaleX, y0: line.y * scaleY, x1: (line.x + line.width) * scaleX, y1: (line.y + line.height) * scaleY },
    })), page.width, page.height);
    const { matchOcrAppearance } = await import('./pdfOcrAppearance');
    await matchOcrAppearance(canvas, result.lines, page.width, page.height);
    checkConversionAbort(options);
    context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), canvas.width, canvas.height), 0, 0);
    const background = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Không lưu được nền trang PDF.')), 'image/png'));
    checkConversionAbort(options);
    return { page: { pageIndex, width: page.width, height: page.height, lines: result.lines, background: new Uint8Array(await background.arrayBuffer()) }, warnings: result.warnings };
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}

export async function createEditablePdfFromDocument(doc: PDFDocumentProxy, source: ArrayBuffer, options: ConversionOptions & { pageNumbers?: number[]; forceOcr?: boolean } = {}): Promise<{ bytes: Uint8Array; pages: number; warnings: string[] }> {
  const { readPdfLines, renderPdfPage, applyOcr } = await import('./mediaConversion');
  const { buildEditablePdf, readEditablePdfPages } = await import('./pdfOcrDocument');
  checkConversionAbort(options);
  const existing = new Set((await readEditablePdfPages(source)).map((page) => page.pageIndex));
  const numbers = options.pageNumbers ?? Array.from({ length: doc.numPages }, (_, index) => index + 1);
  if (!numbers.length || numbers.length > 200 || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > doc.numPages)) throw new Error('Chọn từ 1 đến 200 trang hợp lệ để OCR.');
  const pages: EditablePdfPageInput[] = [];
  let backgroundBytes = 0;
  const warnings = new Set<string>();
  for (const number of [...new Set(numbers)]) {
    checkConversionAbort(options);
    if (existing.has(number - 1) && !options.forceOcr) continue;
    const onProgress = (message: string) => options.onProgress?.(`Trang ${number}/${doc.numPages} · ${message}`);
    const pageOptions = { ...options, onProgress };
    onProgress('Đang dựng ảnh trang để nhận dạng chữ…');
    const page = await readPdfLines(doc, number);
    page.image = await renderPdfPage(doc, number, 'png', pageOptions);
    if (!page.lines.length || options.forceOcr) {
      const messages: string[] = [];
      await applyOcr(page, pageOptions, messages);
      messages.forEach((message) => warnings.add(message));
    }
    if (!page.lines.length) {
      warnings.add(`Trang ${number}: không nhận dạng được chữ. Trang gốc được giữ nguyên.`);
      continue;
    }
    onProgress('Đang tạo chữ PDF chỉnh sửa được và giữ nền trang…');
    const prepared = await prepareEditablePdfPage(page, number - 1, pageOptions);
    if (!prepared.page.lines.length) continue;
    backgroundBytes += prepared.page.background.byteLength;
    if (backgroundBytes > 200 * 1024 * 1024) throw new Error('Kết quả OCR vượt 200 MB. Hãy nhận dạng từng phần nhỏ hơn.');
    pages.push(prepared.page);
    prepared.warnings.forEach((message) => warnings.add(message));
  }
  checkConversionAbort(options);
  if (!pages.length) return { bytes: new Uint8Array(source), pages: 0, warnings: [...warnings] };
  options.onProgress?.('Đang lưu lớp chữ chỉnh sửa được vào PDF…');
  const bytes = await buildEditablePdf(source, pages);
  checkConversionAbort(options);
  return { bytes, pages: pages.length, warnings: [...warnings] };
}
