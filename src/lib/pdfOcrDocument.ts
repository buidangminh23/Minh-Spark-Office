import {
  PDFArray, PDFContentStream, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFStream, decodePDFRawStream,
  TextRenderingMode, beginText, degrees, drawImage, endText, popGraphicsState,
  pushGraphicsState, setCharacterSqueeze, setFillingRgbColor, setFontAndSize,
  setTextMatrix, setTextRenderingMode, showText,
  type PDFFont, type PDFOperator, type PDFPage,
} from 'pdf-lib';
import fontkit, { type Font } from '@pdf-lib/fontkit';
import type { EditablePdfLine, EditablePdfPage, EditablePdfPageInput } from './pdfOcrTypes';

export type PdfOcrFontLoader = (family: EditablePdfLine['fontFamily'], bold: boolean) => Promise<Uint8Array>;
type Metadata = Omit<EditablePdfPage, 'pageIndex'> & { version: 1; background: string; scales: number[]; sizes: number[]; contentHash: string };
type FontCache = Map<string, Promise<{ font: PDFFont; metrics: Font }>>;

const METADATA_KEY = PDFName.of('OfficeOcrV1');
const MAX_METADATA_LENGTH = 4_000_000;
const MAX_PAGE_SIZE = 20_000;
const MAX_LINES = 10_000;
const MAX_TEXT_LENGTH = 10_000;
const fontBytes = new Map<string, Promise<Uint8Array>>();
const invalidMetadata = () => new Error('Dữ liệu chỉnh sửa OCR trong PDF không hợp lệ.');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

async function bundledFont(family: EditablePdfLine['fontFamily'], bold: boolean): Promise<Uint8Array> {
  const key = `${family}:${bold}`;
  let loading = fontBytes.get(key);
  if (!loading) {
    loading = (async () => {
      const asset = family === 'serif'
        ? bold ? await import('dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf?url') : await import('dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url')
        : bold ? await import('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url') : await import('dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url');
      const response = await fetch(asset.default);
      if (!response.ok) throw new Error('Không tải được phông chữ để tạo PDF chỉnh sửa được.');
      return new Uint8Array(await response.arrayBuffer());
    })().catch((error: unknown) => { fontBytes.delete(key); throw error; });
    fontBytes.set(key, loading);
  }
  return loading;
}

export { bundledFont as loadEditablePdfFont };

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH && ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function validatePage(value: unknown): asserts value is EditablePdfPage {
  if (!value || typeof value !== 'object') throw invalidMetadata();
  const page = value as EditablePdfPage;
  if (!Number.isInteger(page.pageIndex) || page.pageIndex < 0 || page.pageIndex > 100_000
    || !finite(page.width) || !finite(page.height) || page.width <= 0 || page.height <= 0
    || page.width > MAX_PAGE_SIZE || page.height > MAX_PAGE_SIZE
    || !Array.isArray(page.lines) || page.lines.length > MAX_LINES) throw invalidMetadata();
  const ids = new Set<string>();
  for (const line of page.lines) {
    if (!line || typeof line !== 'object' || typeof line.id !== 'string' || !line.id.length || line.id.length > 128 || ids.has(line.id)
      || !validText(line.text) || !finite(line.x) || !finite(line.y) || !finite(line.width) || !finite(line.height)
      || line.x < 0 || line.y < 0 || line.width <= 0 || line.height <= 0
      || line.x + line.width > page.width + 0.01 || line.y + line.height > page.height + 0.01
      || !finite(line.fontSize) || line.fontSize <= 0 || line.fontSize > MAX_PAGE_SIZE
      || !['sans', 'serif'].includes(line.fontFamily) || typeof line.bold !== 'boolean'
      || !Array.isArray(line.color) || line.color.length !== 3 || line.color.some((color) => !finite(color) || color < 0 || color > 1)) throw invalidMetadata();
    ids.add(line.id);
  }
}

function copyLine(line: EditablePdfLine): EditablePdfLine {
  return { id: line.id, text: line.text, x: line.x, y: line.y, width: line.width, height: line.height, fontSize: line.fontSize, fontFamily: line.fontFamily, bold: line.bold, color: [...line.color] };
}

function contentHash(page: PDFPage): string {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((entry) => page.doc.context.lookup(entry)) : [contents];
  let hash = 2166136261;
  for (const stream of streams) {
    const bytes = stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream instanceof PDFContentStream ? stream.getUnencodedContents() : new Uint8Array();
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function getMetadata(page: PDFPage, pageIndex: number): Metadata | null {
  const raw = page.node.get(METADATA_KEY);
  if (!raw) return null;
  if (!(raw instanceof PDFHexString) || raw.asBytes().length > MAX_METADATA_LENGTH * 2) throw invalidMetadata();
  const text = raw.decodeText();
  if (text.length > MAX_METADATA_LENGTH) throw invalidMetadata();
  let meta: Metadata;
  try { meta = JSON.parse(text) as Metadata; } catch { throw invalidMetadata(); }
  validatePage({ ...meta, pageIndex });
  if (meta.version !== 1 || typeof meta.background !== 'string' || !/^OfficeOcrBackground[-\w]{0,50}$/.test(meta.background)
    || !Array.isArray(meta.scales) || meta.scales.length !== meta.lines.length
    || !Array.isArray(meta.sizes) || meta.sizes.length !== meta.lines.length || meta.sizes.some((size) => !finite(size) || size <= 0 || size > MAX_PAGE_SIZE)
    || meta.scales.some((scale) => !finite(scale) || scale <= 0 || scale > 1000)) throw invalidMetadata();
  const crop = page.getCropBox();
  if (page.getRotation().angle % 360 || Math.abs(crop.x) > 0.01 || Math.abs(crop.y) > 0.01 || Math.abs(crop.width - meta.width) > 0.01 || Math.abs(crop.height - meta.height) > 0.01) throw new Error('Trang đã xoay hoặc cắt sau OCR. Hãy nhận dạng lại trang trước khi sửa chữ.');
  if (meta.contentHash !== contentHash(page)) throw new Error('Nội dung trang đã thay đổi sau OCR. Hãy nhận dạng lại để giữ các thay đổi mới.');
  const resources = page.node.Resources();
  const objects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  const background = objects?.lookupMaybe(PDFName.of(meta.background), PDFStream);
  if (!(background instanceof PDFRawStream) || background.dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) throw invalidMetadata();
  return meta;
}

function metadataPage(meta: Metadata, pageIndex: number): EditablePdfPage {
  return { pageIndex, width: meta.width, height: meta.height, lines: meta.lines.map(copyLine) };
}

function writeMetadata(page: PDFPage, meta: Metadata) {
  const text = JSON.stringify(meta);
  if (text.length > MAX_METADATA_LENGTH) throw invalidMetadata();
  page.node.set(METADATA_KEY, PDFHexString.fromText(text));
}

function getFont(doc: PDFDocument, cache: FontCache, line: EditablePdfLine, loader: PdfOcrFontLoader): Promise<{ font: PDFFont; metrics: Font }> {
  const key = `${line.fontFamily}:${line.bold}`;
  let font = cache.get(key);
  if (!font) {
    font = loader(line.fontFamily, line.bold).then(async (bytes) => ({ font: await doc.embedFont(bytes, { subset: true }), metrics: fontkit.create(bytes) }));
    cache.set(key, font);
  }
  return font;
}

async function renderPage(doc: PDFDocument, page: PDFPage, meta: Metadata, cache: FontCache, loader: PdfOcrFontLoader, preserveScale: boolean) {
  const operators: PDFOperator[] = drawImage(PDFName.of(meta.background), {
    x: 0, y: 0, width: meta.width, height: meta.height, rotate: degrees(0), xSkew: degrees(0), ySkew: degrees(0),
  });
  for (const [index, line] of meta.lines.entries()) {
    const { font, metrics } = await getFont(doc, cache, line, loader);
    let pen = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const glyph of metrics.layout(line.text || 'M').glyphs) {
      if (glyph.bbox.width > 0 && glyph.bbox.height > 0) {
        minX = Math.min(minX, pen + glyph.bbox.minX); maxX = Math.max(maxX, pen + glyph.bbox.maxX);
        minY = Math.min(minY, glyph.bbox.minY); maxY = Math.max(maxY, glyph.bbox.maxY);
      }
      pen += glyph.advanceWidth;
    }
    if (!Number.isFinite(minY)) { minX = 0; maxX = pen || metrics.unitsPerEm; minY = 0; maxY = metrics.ascent; }
    const fitSize = line.height * metrics.unitsPerEm / (maxY - minY);
    const size = preserveScale ? Math.min(meta.sizes[index], fitSize) : Math.min(MAX_PAGE_SIZE, fitSize);
    if (!preserveScale) meta.sizes[index] = size;
    const baseline = meta.height - line.y - maxY * size / metrics.unitsPerEm;
    const width = (maxX - minX) * size / metrics.unitsPerEm;
    const fit = width > 0 ? line.width / width : 1;
    const scale = preserveScale ? Math.min(meta.scales[index], fit) : Math.min(1000, fit);
    if (!preserveScale) meta.scales[index] = scale;
    if (!line.text.length) continue;
    const name = page.node.newFontDictionary(font.name, font.ref);
    operators.push(pushGraphicsState(), beginText(), setFillingRgbColor(...line.color), setFontAndSize(name, size),
      setTextRenderingMode(TextRenderingMode.Fill), setCharacterSqueeze(scale * 100),
      setTextMatrix(1, 0, 0, 1, line.x - minX * size / metrics.unitsPerEm * scale, baseline), showText(font.encodeText(line.text)), endText(), popGraphicsState());
  }
  const stream = PDFContentStream.of(doc.context.obj({}), operators);
  page.node.set(PDFName.of('Contents'), doc.context.register(stream));
  meta.contentHash = contentHash(page);
  writeMetadata(page, meta);
}

export async function buildEditablePdf(source: ArrayBuffer | undefined, pages: EditablePdfPageInput[], fontLoader: PdfOcrFontLoader = bundledFont): Promise<Uint8Array> {
  if (!pages.length || pages.length > 1000) throw invalidMetadata();
  const indices = new Set<number>();
  for (const page of pages) {
    validatePage(page);
    if (indices.has(page.pageIndex) || !(page.background instanceof Uint8Array) || !page.background.length || page.background.length > 100 * 1024 * 1024) throw invalidMetadata();
    indices.add(page.pageIndex);
  }
  const doc = source ? await PDFDocument.load(source, { updateMetadata: false }) : await PDFDocument.create();
  doc.registerFontkit(fontkit);
  if (!source) {
    const ordered = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
    if (ordered.some((page, index) => page.pageIndex !== index)) throw invalidMetadata();
    for (const page of ordered) doc.addPage([page.width, page.height]);
  }
  const cache: FontCache = new Map();
  for (const input of pages) {
    if (input.pageIndex >= doc.getPageCount()) throw invalidMetadata();
    const page = doc.getPage(input.pageIndex);
    const image = await doc.embedPng(input.background);
    const background = page.node.newXObject('OfficeOcrBackground', image.ref).decodeText();
    page.setMediaBox(0, 0, input.width, input.height);
    page.setCropBox(0, 0, input.width, input.height);
    page.setTrimBox(0, 0, input.width, input.height);
    page.setBleedBox(0, 0, input.width, input.height);
    page.setArtBox(0, 0, input.width, input.height);
    page.setRotation(degrees(0));
    page.node.set(PDFName.of('UserUnit'), PDFNumber.of(1));
    page.node.delete(PDFName.of('Annots'));
    const meta: Metadata = { version: 1, background, width: input.width, height: input.height, lines: input.lines.map(copyLine), scales: input.lines.map(() => 1), sizes: input.lines.map((line) => line.fontSize), contentHash: '' };
    await renderPage(doc, page, meta, cache, fontLoader, false);
  }
  return doc.save();
}

export async function readEditablePdfPages(source: ArrayBuffer | Uint8Array): Promise<EditablePdfPage[]> {
  const doc = await PDFDocument.load(source, { updateMetadata: false });
  const result: EditablePdfPage[] = [];
  doc.getPages().forEach((page, index) => {
    try {
      const metadata = getMetadata(page, index);
      if (metadata) result.push(metadataPage(metadata, index));
    } catch { return; }
  });
  return result;
}

export async function updateEditablePdfText(source: ArrayBuffer | Uint8Array, pageIndex: number, lineId: string, text: string, fontLoader: PdfOcrFontLoader = bundledFont): Promise<Uint8Array> {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || !validText(text)) throw invalidMetadata();
  const doc = await PDFDocument.load(source, { updateMetadata: false });
  if (pageIndex >= doc.getPageCount()) throw invalidMetadata();
  const page = doc.getPage(pageIndex);
  const meta = getMetadata(page, pageIndex);
  const line = meta?.lines.find((entry) => entry.id === lineId);
  if (!meta || !line) throw new Error('Không tìm thấy vùng chữ OCR cần sửa trong PDF.');
  line.text = text;
  doc.registerFontkit(fontkit);
  await renderPage(doc, page, meta, new Map(), fontLoader, true);
  return doc.save();
}
