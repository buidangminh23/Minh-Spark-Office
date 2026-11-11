import type { JSONContent } from '@tiptap/react';
import type { WorkBook, WorkSheet } from 'xlsx';
import { checkConversionAbort, conversionBaseName, type ConversionOptions, type ConversionResult } from './conversionTypes';
import { officeConversionTargets, officeFileKind } from './officeConversionFormats';
import { conversionDocumentHtml, conversionNodeText, htmlConversionDocument, textConversionDocument } from './officeConversionDocument';
import { conversionTables, spreadsheetDocumentTable } from './officeConversionTables';

export { officeConversionTargets } from './officeConversionFormats';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_CELLS = 250_000;
const MAX_TEXT = 2_000_000;
const page = { size: 'A4' as const, orientation: 'portrait' as const, margins: { top: 72, right: 72, bottom: 72, left: 72 }, header: '', footer: '', pageNumbers: true };
const textBlob = (value: string, mime: string) => new Blob([value], { type: `${mime};charset=utf-8` });
const mimeTypes: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

export async function convertOfficeFile(file: File, target: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  checkConversionAbort(options);
  if (!officeConversionTargets(file.name).some((item) => item.id === target)) throw new Error('Không hỗ trợ phép chuyển đổi này.');
  if (!file.size) throw new Error('Tệp nguồn trống.');
  if (file.size > MAX_BYTES) throw new Error('Tệp Office vượt giới hạn 50 MB. Hãy chia nhỏ tệp trước khi chuyển đổi.');
  const kind = officeFileKind(file.name);
  const ext = file.name.split('.').pop()!.toLowerCase();
  const base = conversionBaseName(file.name);
  options.onProgress?.('Đang đọc nội dung tệp…');
  const buffer = await file.arrayBuffer();
  checkConversionAbort(options);
  const warnings: string[] = [];
  let json: JSONContent;
  if (kind === 'sheet') return convertSpreadsheet(buffer, ext, base, target, options);
  if (kind === 'slide') {
    const zip = await openOfficeZip(buffer);
    if (!zip.file('ppt/presentation.xml')) throw new Error('Tệp không phải bài trình chiếu PowerPoint hợp lệ.');
    if (target === 'pptx' && ext === 'pptx') return { files: [{ name: `${base}.pptx`, blob: new Blob([buffer], { type: mimeTypes.pptx }) }], warnings };
    if (target === 'pptx') return { files: [{ name: `${base}.pptx`, blob: await convertOfficePackage(zip, 'pptx') }], warnings };
    json = await readSlideOutline(zip, options);
    warnings.push('Đã trích văn bản và ảnh nhúng theo thứ tự trang chiếu. Vị trí, hiệu ứng, biểu đồ, SmartArt, video và bố cục trang chiếu gốc không được giữ trong bản trích nội dung.');
  } else if (ext === 'docx' || ext === 'dotx') {
    const zip = await openOfficeZip(buffer);
    if (!zip.file('word/document.xml')) throw new Error('Tệp không phải tài liệu Word hợp lệ.');
    if (target === 'docx' && ext === 'docx') return { files: [{ name: `${base}.docx`, blob: new Blob([buffer], { type: mimeTypes.docx }) }], warnings };
    if (target === 'docx') return { files: [{ name: `${base}.docx`, blob: await convertOfficePackage(zip, 'docx') }], warnings };
    const { importDocx } = await import('./docxConvert');
    const parsed = htmlConversionDocument(await importDocx(buffer));
    json = parsed.json;
    warnings.push(...parsed.warnings, 'Giữ nội dung, bảng, danh sách và ảnh được hỗ trợ; kiểu trang, đầu/chân trang, chú thích, công thức và đối tượng Word nâng cao có thể thay đổi.');
  } else {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.length > MAX_TEXT) throw new Error('Văn bản vượt giới hạn 2 triệu ký tự.');
    if (ext === 'txt') json = textConversionDocument(text);
    else {
      const html = ext === 'md' ? (await import('../addins/markdown')).renderMarkdown(text) : text;
      const parsed = htmlConversionDocument(html);
      json = parsed.json;
      warnings.push(...parsed.warnings);
      if (ext === 'html' || ext === 'htm') warnings.push('Chuyển nội dung HTML an toàn; CSS, mã chạy, biểu mẫu và tài nguyên ngoài tệp không đi theo.');
      if (ext === 'md') warnings.push('Hỗ trợ tiêu đề, danh sách, bảng và định dạng Markdown cơ bản. Cú pháp mở rộng có thể hiển thị dưới dạng chữ.');
    }
  }
  if (!json.content?.length) throw new Error('Không tìm thấy nội dung có thể chuyển đổi trong tệp.');
  checkConversionAbort(options);
  return exportConversionDocument(json, base, target, warnings, options);
}

async function openOfficeZip(buffer: ArrayBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files);
  if (files.length > 10_000) throw new Error('Tệp Office có quá nhiều thành phần.');
  let total = 0;
  for (const file of files) {
    const entry = file as unknown as { _data?: { uncompressedSize?: number } };
    total += entry._data?.uncompressedSize ?? 0;
    if (total > 200 * 1024 * 1024) throw new Error('Nội dung giải nén của tệp vượt giới hạn 200 MB.');
  }
  return zip;
}

async function convertOfficePackage(zip: Awaited<ReturnType<typeof openOfficeZip>>, target: 'docx' | 'pptx'): Promise<Blob> {
  const entry = zip.file('[Content_Types].xml');
  if (!entry) throw new Error('Tệp Office thiếu mô tả định dạng.');
  const content = await entry.async('string');
  const pattern = target === 'docx'
    ? /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.(?:document|template)\.main\+xml/g
    : /application\/vnd\.openxmlformats-officedocument\.presentationml\.(?:presentation|slideshow|template)\.main\+xml/g;
  if (!pattern.test(content)) throw new Error('Loại tài liệu bên trong không khớp định dạng Office được hỗ trợ.');
  zip.file('[Content_Types].xml', content.replace(pattern, target === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'));
  return zip.generateAsync({ type: 'blob', mimeType: mimeTypes[target], compression: 'DEFLATE' });
}

function decodeXml(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(lt|gt|amp|quot|apos);/gi, (_, numeric: string | undefined, named: string | undefined) => {
    if (numeric) {
      const number = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : parseInt(numeric, 10);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\uFFFD';
    }
    return ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[named!.toLowerCase()] ?? '';
  });
}

async function readSlideOutline(zip: Awaited<ReturnType<typeof openOfficeZip>>, options: ConversionOptions): Promise<JSONContent> {
  const presentation = await zip.file('ppt/presentation.xml')!.async('string');
  const relations = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string') ?? '';
  const relationshipMap = new Map<string, string>();
  for (const relation of relations.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId=["']([^"']+)["']/.exec(relation[0])?.[1];
    const target = /\bTarget=["']([^"']+)["']/.exec(relation[0])?.[1];
    if (id && target && !/TargetMode=["']External/i.test(relation[0])) relationshipMap.set(id, target.startsWith('/') ? target.slice(1) : `ppt/${target}`);
  }
  const paths = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id=["']([^"']+)["'][^>]*\/?\s*>/g)].map((match) => relationshipMap.get(match[1])).filter((path): path is string => Boolean(path));
  if (!paths.length || paths.length > 500) throw new Error('Bài trình chiếu phải có từ 1 đến 500 trang chiếu hợp lệ.');
  const content: JSONContent[] = [];
  for (const [index, path] of paths.entries()) {
    checkConversionAbort(options);
    options.onProgress?.(`Đang đọc trang chiếu ${index + 1}/${paths.length}…`);
    const source = zip.file(path);
    if (!source) throw new Error(`Thiếu dữ liệu trang chiếu ${index + 1}.`);
    const xml = await source.async('string');
    if (index) content.push({ type: 'pageBreak' });
    content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: `Trang chiếu ${index + 1}` }] });
    for (const paragraph of xml.matchAll(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g)) {
      const text = [...paragraph[0].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g)].map((match) => match[1] === undefined ? '\n' : decodeXml(match[1])).join('');
      if (text) content.push(...textConversionDocument(text).content!);
    }
    const slash = path.lastIndexOf('/');
    const relPath = `${path.slice(0, slash)}/_rels/${path.slice(slash + 1)}.rels`;
    const relXml = await zip.file(relPath)?.async('string') ?? '';
    const images = new Map<string, string>();
    for (const relation of relXml.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId=["']([^"']+)["']/.exec(relation[0])?.[1];
      const target = /\bTarget=["']([^"']+)["']/.exec(relation[0])?.[1];
      if (!id || !target || /TargetMode=["']External/i.test(relation[0])) continue;
      const parts = `${path.slice(0, slash)}/${target}`.split('/');
      const resolved: string[] = [];
      for (const part of parts) { if (part === '..') resolved.pop(); else if (part && part !== '.') resolved.push(part); }
      if (/\.(png|jpe?g|gif|webp)$/i.test(target)) images.set(id, resolved.join('/'));
    }
    for (const embed of xml.matchAll(/<a:blip\b[^>]*\br:embed=["']([^"']+)["']/g)) {
      const imagePath = images.get(embed[1]);
      if (!imagePath) continue;
      const image = zip.file(imagePath);
      if (!image) continue;
      const extension = imagePath.split('.').pop()!.toLowerCase();
      const mime = extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension;
      content.push({ type: 'image', attrs: { src: `data:image/${mime};base64,${await image.async('base64')}`, alt: `Ảnh trang chiếu ${index + 1}` } });
    }
  }
  return { type: 'doc', content };
}

function sheetBounds(sheet: WorkSheet): { rows: number; columns: number } {
  const ref = sheet['!ref'];
  if (!ref) return { rows: 0, columns: 0 };
  const match = /\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(ref);
  if (!match) throw new Error('Vùng dữ liệu bảng tính không hợp lệ.');
  const column = (match[3] ?? match[1]).toUpperCase().split('').reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
  return { rows: Number(match[4] ?? match[2]), columns: column };
}

function checkWorkbook(book: WorkBook) {
  if (!book.SheetNames.length) throw new Error('Bảng tính không có trang tính.');
  let cells = 0;
  let mergedCells = 0;
  for (const name of book.SheetNames) {
    const bounds = sheetBounds(book.Sheets[name]);
    cells += bounds.rows * bounds.columns;
    if (bounds.rows > 50_000 || bounds.columns > 512 || cells > MAX_CELLS) throw new Error('Bảng tính quá lớn: tối đa 50.000 hàng, 512 cột và 250.000 ô trong vùng dữ liệu. Hãy chia nhỏ tệp.');
    for (const merge of book.Sheets[name]['!merges'] ?? []) {
      if (![merge.s.r, merge.s.c, merge.e.r, merge.e.c].every((value) => Number.isInteger(value) && value >= 0) || merge.e.r < merge.s.r || merge.e.c < merge.s.c || merge.e.r >= 50_000 || merge.e.c >= 512) throw new Error('Vùng ô gộp không hợp lệ hoặc quá lớn.');
      mergedCells += (merge.e.r - merge.s.r + 1) * (merge.e.c - merge.s.c + 1);
      if (mergedCells > MAX_CELLS) throw new Error('Tổng vùng ô gộp quá lớn. Hãy chia nhỏ bảng tính.');
    }
  }
}

function delimitedBook(XLSX: typeof import('xlsx'), rows: string[][]): WorkBook {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return book;
}

async function convertSpreadsheet(buffer: ArrayBuffer, ext: string, base: string, target: string, options: ConversionOptions): Promise<ConversionResult> {
  const XLSX = await import('xlsx');
  if (['xlsx', 'xlsm', 'xlsb', 'ods'].includes(ext)) await openOfficeZip(buffer);
  const delimited = ext === 'csv' || ext === 'tsv' ? (await import('./delimitedTable')).readDelimitedTable(buffer, ext) : null;
  if (delimited) {
    if (delimited.rows.length > 50_000 || delimited.columns > 512 || delimited.rows.length * delimited.columns > MAX_CELLS) throw new Error('Bảng tính quá lớn: tối đa 50.000 hàng, 512 cột và 250.000 ô trong vùng dữ liệu. Hãy chia nhỏ tệp.');
    if (!delimited.rows.length) throw new Error('Tệp không có dữ liệu để chuyển đổi.');
    if (target === 'xlsx') {
      options.onProgress?.('Đang dựng bảng Excel…');
      const { blob, warnings } = await (await import('./delimitedToXlsx')).delimitedToXlsx(delimited, base);
      return { files: [{ name: `${base}.xlsx`, blob }], warnings };
    }
  }
  const book = delimited ? delimitedBook(XLSX, delimited.rows) : XLSX.read(buffer, { type: 'array', cellStyles: true, cellNF: true, cellFormula: true });
  checkWorkbook(book);
  checkConversionAbort(options);
  if (target === ext && ['xlsx', 'ods'].includes(ext)) return { files: [{ name: `${base}.${target}`, blob: new Blob([buffer], { type: mimeTypes[target] }) }], warnings: [] };
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (const merge of sheet['!merges'] ?? []) {
      const anchor = XLSX.utils.encode_cell(merge.s);
      if (!sheet[anchor] || sheet[anchor].t === 'z') sheet[anchor] = { t: 's', v: '' };
      range.s.r = Math.min(range.s.r, merge.s.r);
      range.s.c = Math.min(range.s.c, merge.s.c);
      range.e.r = Math.max(range.e.r, merge.e.r);
      range.e.c = Math.max(range.e.c, merge.e.c);
    }
    sheet['!ref'] = XLSX.utils.encode_range(range);
  }
  checkWorkbook(book);
  const warnings = ['Chuyển đổi giữ dữ liệu ô và công thức được hỗ trợ. Macro, biểu đồ, ảnh, xác thực dữ liệu và định dạng nâng cao có thể không đi theo; công thức không được tính lại.'];
  if (target === 'xlsx' || target === 'ods') {
    const bytes = XLSX.write(book, { type: 'array', bookType: target, cellStyles: true, bookSST: true }) as ArrayBuffer;
    return { files: [{ name: `${base}.${target}`, blob: new Blob([bytes], { type: mimeTypes[target] }) }], warnings };
  }
  const sheets = book.SheetNames.map((name) => ({ name, sheet: book.Sheets[name] }));
  if (['csv', 'tsv', 'json'].includes(target)) {
    warnings.push('Mỗi trang tính được xuất thành một tệp; chỉ giữ giá trị hiển thị hoặc giá trị đã lưu, không giữ công thức, ô gộp và định dạng.');
    const files = sheets.map(({ name, sheet }, index) => {
      const stem = sheets.length > 1 ? `${base} - ${index + 1} - ${conversionBaseName(name)}` : base;
      if (target === 'json') return { name: `${stem}.json`, blob: textBlob(JSON.stringify(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: true }), null, 2), 'application/json') };
      const value = XLSX.utils.sheet_to_csv(sheet, { FS: target === 'tsv' ? '\t' : ',', RS: '\r\n', blankrows: true });
      return { name: `${stem}.${target}`, blob: textBlob(`\uFEFF${value}`, target === 'tsv' ? 'text/tab-separated-values' : 'text/csv') };
    });
    return { files, warnings };
  }
  const content: JSONContent[] = [];
  for (const [index, { name, sheet }] of sheets.entries()) {
    checkConversionAbort(options);
    if (index) content.push({ type: 'pageBreak' });
    content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: name }] });
    const bounds = sheetBounds(sheet);
    if (bounds.rows) content.push(spreadsheetDocumentTable(sheet, bounds.rows, bounds.columns, XLSX.utils.encode_cell, XLSX.utils.format_cell));
  }
  warnings.push('Bản Word/HTML giữ ô gộp và độ rộng cột được hỗ trợ. PDF/ảnh dàn lại bảng theo trang; kiểu ô và vùng in có thể thay đổi. Công thức chưa có giá trị đã lưu được hiển thị dưới dạng công thức.');
  return exportConversionDocument({ type: 'doc', content }, base, target, warnings, options);
}

export async function exportConversionDocument(json: JSONContent, base: string, target: string, warnings: string[], options: ConversionOptions): Promise<ConversionResult> {
  checkConversionAbort(options);
  options.onProgress?.('Đang tạo tệp kết quả…');
  const one = (blob: Blob): ConversionResult => ({ files: [{ name: `${base}.${target}`, blob }], warnings });
  if (['pdf', 'png', 'jpg', 'webp'].includes(target)) {
    warnings.push('Các trang được dàn lại để đọc; vị trí, phông chữ và ngắt trang có thể khác tệp gốc.');
    return { files: await (await import('./officeConversionRender')).renderConversionDocument(json, base, target, options), warnings };
  }
  if (target === 'html') return one(textBlob(conversionDocumentHtml(json, base), 'text/html'));
  if (target === 'docx') return one(await (await import('./docxConvert')).exportDocx(json, page, base));
  if (target === 'md') return one(textBlob((await import('./docxConvert')).jsonToMarkdown(json), 'text/markdown'));
  if (target === 'txt') return one(textBlob((await import('./docOtherFormats')).jsonToText(json), 'text/plain'));
  if (target === 'rtf') return one((await import('./docExports')).exportRtf(json, page));
  if (target === 'odt') return one(await (await import('./docExports')).exportOdt(json, page, base));
  if (target === 'epub') return one(await (await import('./docExports')).exportEpub(json, page, base));
  if (target === 'pptx') return one(await (await import('./docOtherFormats')).exportPptx(json, page, base));
  if (['xlsx', 'csv', 'tsv'].includes(target)) {
    let tables = conversionTables(json);
    if (tables.length) warnings.push('Chỉ xuất các bảng; văn bản ngoài bảng và hình ảnh không nằm trong kết quả.');
    else {
      const lines = (json.content ?? []).map((node) => conversionNodeText(node).trim()).filter(Boolean);
      if (!lines.length) throw new Error('Tài liệu không có nội dung chữ để chuyển sang bảng tính.');
      tables = [{ rows: [['Nội dung'], ...lines.map((line) => [line])], merges: [] }];
      warnings.push('Tài liệu không có bảng nên mỗi đoạn văn được đưa vào một dòng của cột Nội dung.');
    }
    if (target === 'xlsx') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      for (const [index, table] of tables.entries()) {
        const sheet = XLSX.utils.aoa_to_sheet(table.rows);
        sheet['!merges'] = table.merges;
        XLSX.utils.book_append_sheet(workbook, sheet, `Bảng ${index + 1}`);
      }
      warnings.push('Giá trị bảng được lưu dưới dạng chữ để giữ nguyên mã có số 0 đầu và số dài.');
      return one(new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], { type: mimeTypes.xlsx }));
    }
    const separator = target === 'csv' ? ',' : '\t';
    const cell = (value: string) => /["\r\n\t,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    return { files: tables.map((table, index) => ({ name: `${base}${tables.length > 1 ? ` - bang ${index + 1}` : ''}.${target}`, blob: textBlob(`\uFEFF${table.rows.map((row) => row.map(cell).join(separator)).join('\r\n')}\r\n`, target === 'csv' ? 'text/csv' : 'text/tab-separated-values') })), warnings };
  }
  throw new Error('Định dạng đầu ra chưa được hỗ trợ.');
}

export { conversionNodeText };
