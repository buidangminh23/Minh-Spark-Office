import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';

export class PdfToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfToolError';
  }
}

export const isPdfToolError = (error: unknown): error is PdfToolError =>
  error instanceof Error && error.name === 'PdfToolError';

export type PdfToolOptions = { keepAttributes?: boolean };
export type Box = { x: number; y: number; width: number; height: number };
export type Margins = { top: number; right: number; bottom: number; left: number };
export type PageRange = { label: string; pages: number[] };
export type SignatureAnchor = 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
export type DrawPlacement = { x: number; y: number; width: number; height: number; rotate: number };
export type RasterPage = { bytes: Uint8Array; format: 'png' | 'jpeg'; width: number; height: number };

const MIN_PAGE_SIZE_PT = 36;
const SIGNATURE_MARGIN_RATIO = 0.05;
const SIGNATURE_MAX_HEIGHT_RATIO = 0.4;

export const MM_TO_PT = 72 / 25.4;

export async function loadPdf(bytes: Uint8Array, options: PdfToolOptions = {}): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: !options.keepAttributes });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(`${error.name} ${error.message}`)) {
      throw new PdfToolError('Tệp PDF đang được mã hoá hoặc đặt mật khẩu nên chưa xử lý được.');
    }
    throw new PdfToolError('Không đọc được cấu trúc tệp PDF này.');
  }
}

function copyAttributes(source: PDFDocument, target: PDFDocument) {
  const title = source.getTitle();
  const author = source.getAuthor();
  const subject = source.getSubject();
  const keywords = source.getKeywords();
  const creator = source.getCreator();
  if (title) target.setTitle(title);
  if (author) target.setAuthor(author);
  if (subject) target.setSubject(subject);
  if (keywords) target.setKeywords(keywords.split(/\s+/).filter(Boolean));
  if (creator) target.setCreator(creator);
}

async function createDerived(source: PDFDocument | null, options: PdfToolOptions) {
  const target = await PDFDocument.create({ updateMetadata: !options.keepAttributes });
  if (source && options.keepAttributes) copyAttributes(source, target);
  return target;
}

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const value = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return value as 0 | 90 | 180 | 270;
}

export function parsePageRanges(input: string, pageCount: number): PageRange[] {
  const parts = input.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new PdfToolError('Nhập ít nhất một trang hoặc dải trang, ví dụ 1-2, 3.');
  return parts.map((part) => {
    const match = /^(\d+)\s*(?:[-–—]\s*(\d+))?$/.exec(part);
    const start = match ? Number(match[1]) : NaN;
    const end = match?.[2] ? Number(match[2]) : start;
    if (!match || start < 1 || end < start || end > pageCount) {
      throw new PdfToolError(`Dải trang "${part}" không hợp lệ (tệp có ${pageCount} trang).`);
    }
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
    return { label: start === end ? `${start}` : `${start}-${end}`, pages };
  });
}

export async function splitPdf(bytes: Uint8Array, ranges: PageRange[], options: PdfToolOptions = {}): Promise<Uint8Array[]> {
  const source = await loadPdf(bytes, options);
  const outputs: Uint8Array[] = [];
  for (const range of ranges) {
    const target = await createDerived(source, options);
    const pages = await target.copyPages(source, range.pages);
    pages.forEach((page) => target.addPage(page));
    outputs.push(await target.save());
  }
  return outputs;
}

export async function mergePdfs(sources: Uint8Array[], options: PdfToolOptions = {}): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (sources.length === 0) throw new PdfToolError('Chọn ít nhất một tệp PDF để ghép.');
  const [first, ...rest] = sources;
  const target = await loadPdf(first, options);
  for (const [index, source] of rest.entries()) {
    let doc: PDFDocument;
    try {
      doc = await loadPdf(source, { keepAttributes: true });
    } catch (error) {
      if (isPdfToolError(error)) throw new PdfToolError(`Tệp thứ ${index + 1}: ${error.message}`);
      throw error;
    }
    const pages = await target.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => target.addPage(page));
  }
  return { bytes: await target.save(), pageCount: target.getPageCount() };
}

export async function compressPdf(bytes: Uint8Array, options: PdfToolOptions = {}) {
  const doc = await loadPdf(bytes, options);
  const saved = await doc.save({ useObjectStreams: true });
  const reduced = saved.byteLength < bytes.byteLength;
  return { bytes: reduced ? saved : bytes, before: bytes.byteLength, after: reduced ? saved.byteLength : bytes.byteLength, reduced };
}

export function marginsForRotation(margins: Margins, rotation: number): Margins {
  const { top, right, bottom, left } = margins;
  switch (normalizeRotation(rotation)) {
    case 90:
      return { left: top, right: bottom, bottom: left, top: right };
    case 180:
      return { left: right, right: left, top: bottom, bottom: top };
    case 270:
      return { right: top, left: bottom, top: left, bottom: right };
    default:
      return margins;
  }
}

export function croppedBox(box: Box, margins: Margins, rotation: number): Box {
  const m = marginsForRotation(margins, rotation);
  return { x: box.x + m.left, y: box.y + m.bottom, width: box.width - m.left - m.right, height: box.height - m.top - m.bottom };
}

export async function cropPdf(bytes: Uint8Array, margins: Margins, pageIndexes: number[] | null, options: PdfToolOptions = {}) {
  if (Object.values(margins).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new PdfToolError('Lề cắt phải là số không âm.');
  }
  if (Object.values(margins).every((value) => value === 0)) throw new PdfToolError('Nhập ít nhất một lề cần cắt.');
  const doc = await loadPdf(bytes, options);
  const pages = doc.getPages();
  const targets = pageIndexes ?? pages.map((_, index) => index);
  for (const index of targets) {
    const page = pages[index];
    if (!page) throw new PdfToolError(`Không có trang ${index + 1}.`);
    const box = croppedBox(page.getCropBox(), margins, page.getRotation().angle);
    if (box.width < MIN_PAGE_SIZE_PT || box.height < MIN_PAGE_SIZE_PT) {
      throw new PdfToolError(`Lề quá lớn: trang ${index + 1} sẽ không còn nội dung.`);
    }
    page.setCropBox(box.x, box.y, box.width, box.height);
  }
  return { bytes: await doc.save(), pageCount: targets.length };
}

export function visualSize(box: Box, rotation: number) {
  return normalizeRotation(rotation) % 180 === 0
    ? { width: box.width, height: box.height }
    : { width: box.height, height: box.width };
}

export function placeSignature(visualWidth: number, visualHeight: number, imageWidth: number, imageHeight: number, anchor: SignatureAnchor, widthFraction: number) {
  let width = visualWidth * Math.min(0.9, Math.max(0.05, widthFraction));
  let height = width * (imageHeight / imageWidth);
  const maxHeight = visualHeight * SIGNATURE_MAX_HEIGHT_RATIO;
  if (height > maxHeight) {
    width *= maxHeight / height;
    height = maxHeight;
  }
  const margin = Math.min(visualWidth, visualHeight) * SIGNATURE_MARGIN_RATIO;
  const horizontal = anchor.endsWith('right') ? 'right' : anchor.endsWith('left') ? 'left' : 'center';
  const vertical = anchor.startsWith('top') ? 'top' : anchor.startsWith('bottom') ? 'bottom' : 'center';
  const u = horizontal === 'left' ? margin : horizontal === 'right' ? visualWidth - margin - width : (visualWidth - width) / 2;
  const v = vertical === 'bottom' ? margin : vertical === 'top' ? visualHeight - margin - height : (visualHeight - height) / 2;
  return { u, v, width, height };
}

export function visualRectToDraw(rect: { u: number; v: number; width: number; height: number }, box: Box, rotation: number): DrawPlacement {
  const { u, v, width, height } = rect;
  const W = box.width;
  const H = box.height;
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: box.x + W - v, y: box.y + u, width, height, rotate: 90 };
    case 180:
      return { x: box.x + W - u, y: box.y + H - v, width, height, rotate: 180 };
    case 270:
      return { x: box.x + v, y: box.y + H - u, width, height, rotate: 270 };
    default:
      return { x: box.x + u, y: box.y + v, width, height, rotate: 0 };
  }
}

export type SignatureRequest = { pageIndex: number; anchor: SignatureAnchor; widthFraction: number };

export async function stampSignature(bytes: Uint8Array, png: Uint8Array, request: SignatureRequest, options: PdfToolOptions = {}) {
  const doc = await loadPdf(bytes, options);
  const page = doc.getPages()[request.pageIndex];
  if (!page) throw new PdfToolError(`Tài liệu không có trang ${request.pageIndex + 1}.`);
  let image;
  try {
    image = await doc.embedPng(png);
  } catch {
    throw new PdfToolError('Không đọc được ảnh chữ ký.');
  }
  const box = page.getCropBox();
  const rotation = page.getRotation().angle;
  const visual = visualSize(box, rotation);
  const rect = placeSignature(visual.width, visual.height, image.width, image.height, request.anchor, request.widthFraction);
  const draw = visualRectToDraw(rect, box, rotation);
  page.drawImage(image, { x: draw.x, y: draw.y, width: draw.width, height: draw.height, rotate: degrees(draw.rotate) });
  return doc.save();
}

export async function imagesToPdf(pages: RasterPage[], source: Uint8Array | null, options: PdfToolOptions = {}) {
  if (pages.length === 0) throw new PdfToolError('Không có trang nào để dựng tệp PDF.');
  const origin = source && options.keepAttributes ? await loadPdf(source, options) : null;
  const target = await createDerived(origin, options);
  for (const raster of pages) {
    const image = raster.format === 'png' ? await target.embedPng(raster.bytes) : await target.embedJpg(raster.bytes);
    const page = target.addPage([raster.width, raster.height]);
    page.drawImage(image, { x: 0, y: 0, width: raster.width, height: raster.height });
  }
  return target.save();
}

export async function zipFiles(files: { name: string; bytes: Uint8Array | string }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.bytes);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
