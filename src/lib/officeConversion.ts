import { openOfficeZip } from './openOfficeZip';
import type { JSONContent } from '@tiptap/react';
import type { WorkBook, WorkSheet } from 'xlsx';
import type { FormButton, FormImageMap } from './formButtons';
import { checkConversionAbort, conversionBaseName, type ConversionOptions, type ConversionResult } from './conversionTypes';
import { officeConversionTargets, officeFileKind } from './officeConversionFormats';
import { conversionDocumentHtml, conversionNodeText, htmlConversionDocument, textConversionDocument } from './officeConversionDocument';
import { spreadsheetDocumentTable } from './officeConversionTables';
import { isDataExchangeFormat } from './dataExchangeFormats';

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
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  json: 'application/json',
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
    json = await (await import('./slideConversionOutline')).readSlideOutline(zip, options);
    warnings.push('Đã trích văn bản, bảng và ảnh nhúng theo thứ tự trang chiếu. Vị trí, hiệu ứng, biểu đồ, SmartArt và video có thể thay đổi hoặc bị lược bỏ.');
  } else if (ext === 'epub') {
    const zip = await openOfficeZip(buffer);
    const { readEpubDocument, readEpubPublication } = await import('./epubConversion');
    const publication = await readEpubPublication(zip);
    if (target === 'epub') return { files: [{ name: `${base}.epub`, blob: new Blob([buffer], { type: 'application/epub+zip' }) }], warnings };
    const parsed = await readEpubDocument(zip, publication, options);
    json = parsed.json;
    warnings.push(...parsed.warnings);
  } else if (ext === 'docx' || ext === 'dotx') {
    const zip = await openOfficeZip(buffer);
    if (!zip.file('word/document.xml')) throw new Error('Tệp không phải tài liệu Word hợp lệ.');
    if (target === 'docx' && ext === 'docx') return { files: [{ name: `${base}.docx`, blob: new Blob([buffer], { type: mimeTypes.docx }) }], warnings };
    if (target === 'docx') return { files: [{ name: `${base}.docx`, blob: await convertOfficePackage(zip, 'docx') }], warnings };
    const { importDocx } = await import('./docxConvert');
    const parsed = htmlConversionDocument(await importDocx(buffer));
    json = await (await import('./docxConversionRegions')).includeDocxConversionRegions(zip, parsed.json);
    warnings.push(...parsed.warnings, 'Giữ nội dung, bảng, danh sách và ảnh được hỗ trợ; kiểu trang, đầu/chân trang, chú thích, công thức và đối tượng Word nâng cao có thể thay đổi.');
  } else {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.length > MAX_TEXT) throw new Error('Văn bản vượt giới hạn 2 triệu ký tự.');
    if (ext === 'txt') json = textConversionDocument(text);
    else {
      const html = ext === 'md' ? (await import('../addins/markdown')).renderMarkdown(text, 0) : text;
      const parsed = htmlConversionDocument(html);
      json = parsed.json;
      warnings.push(...parsed.warnings);
      if (ext === 'html' || ext === 'htm') warnings.push('Văn bản, bảng và ảnh nhúng được lấy từ HTML. CSS và tài nguyên ngoài tệp có thể làm thay đổi bố cục.');
      if (ext === 'md') warnings.push('Hỗ trợ tiêu đề, danh sách, bảng và định dạng Markdown cơ bản. Cú pháp mở rộng có thể hiển thị dưới dạng chữ.');
    }
  }
  if (!json.content?.length) throw new Error('Không tìm thấy nội dung có thể chuyển đổi trong tệp.');
  checkConversionAbort(options);
  return exportConversionDocument(json, base, target, warnings, options);
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

function worksheetJsonRows(sheet: WorkSheet, xlsx: typeof import('xlsx')) {
  const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');
  const rows: unknown[][] = [];
  for (let row = range.s.r; row <= range.e.r; row++) {
    const values: unknown[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: col })];
      if (cell?.f && cell.v == null) values.push(`=${cell.f}`);
      else if (cell?.t === 'e') values.push(cell.w ?? xlsx.utils.format_cell(cell));
      else values.push(cell?.v ?? null);
    }
    rows.push(values);
  }
  return rows;
}

function prepareBinaryWorkbook(book: WorkBook, xlsx: typeof import('xlsx')) {
  const names = new Set(book.SheetNames.map(name => name.toLowerCase()));
  const headers = ['Trang tính', 'Ô', 'Công thức nguồn', 'Tác giả', 'Ghi chú nguồn'];
  let rows = [headers];
  let serial = 0;
  const appendIndex = () => {
    let name: string;
    do { serial++; name = 'Công thức và ghi chú' + (serial === 1 ? '' : ' ' + serial); } while (names.has(name.toLowerCase()));
    names.add(name.toLowerCase());
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [24, 12, 60, 24, 60].map(wch => ({ wch }));
    xlsx.utils.book_append_sheet(book, sheet, name);
    rows = [headers];
  };
  for (const name of [...book.SheetNames]) {
    const sheet = book.Sheets[name];
    for (const key of Object.keys(sheet)) {
      if (key.startsWith('!')) continue;
      const cell = sheet[key];
      if (!cell.f && !cell.c?.length) continue;
      const formula = cell.f ? `=${cell.f}` : '';
      if (formula && cell.v == null) { cell.t = 's'; cell.v = formula; delete cell.w; }
      delete cell.f;
      delete cell.F;
      const notes = cell.c?.length ? cell.c : [{ a: '', t: '' }];
      for (const [index, note] of notes.entries()) {
        rows.push([name, key, index === 0 ? formula : '', note.a ?? '', note.t ?? '']);
        if (rows.length === 50_000) appendIndex();
      }
    }
  }
  if (rows.length > 1) appendIndex();
  const warnings = ['XLSB giữ dữ liệu và ô gộp của các trang tính. Macro VBA, ảnh, biểu đồ và định dạng nâng cao có thể bị mất.'];
  if (serial) warnings.push('Trang “Công thức và ghi chú” lưu biểu thức, địa chỉ ô và ghi chú nguồn. Các ô XLSB hiển thị kết quả đã lưu hoặc biểu thức dạng chữ khi thiếu kết quả. Công thức không tự tính lại.');
  return warnings;
}

async function convertSpreadsheet(buffer: ArrayBuffer, ext: string, base: string, target: string, options: ConversionOptions): Promise<ConversionResult> {
  const XLSX = await import('xlsx');
  const zip = ['xlsx', 'xlsm', 'xlsb', 'ods'].includes(ext) ? await openOfficeZip(buffer) : null;
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
  const book = isDataExchangeFormat(ext) ? await (await import('./dataExchangeConversion')).readDataExchangeWorkbook(buffer, ext, XLSX)
    : ext === 'json' ? (await import('./jsonWorkbook')).readJsonWorkbook(buffer, XLSX)
    : delimited ? delimitedBook(XLSX, delimited.rows) : XLSX.read(buffer, { type: 'array', cellStyles: true, cellNF: true, cellFormula: true });
  checkWorkbook(book);
  checkConversionAbort(options);
  if (isDataExchangeFormat(ext) && target === ext) return { files: [{ name: `${base}.${ext}`, blob: new Blob([buffer]) }], warnings: [] };
  if (target === ext && ['xlsx', 'xlsb', 'ods', 'json', 'csv', 'tsv'].includes(ext)) return { files: [{ name: `${base}.${target}`, blob: new Blob([buffer], { type: mimeTypes[target] ?? (ext === 'csv' ? 'text/csv' : 'text/tab-separated-values') }) }], warnings: [] };
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      const cell = sheet[address];
      if (!cell.f || (cell.t !== 'z' && cell.v != null)) continue;
      if (target === 'csv' || target === 'tsv') {
        sheet[address] = { t: 's', v: '=' + cell.f };
      } else if (cell.t === 'z') {
        cell.t = 'n';
        delete cell.v;
        delete cell.w;
      }
    }
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
  if (isDataExchangeFormat(target)) return (await import('./dataExchangeConversion')).writeDataExchangeWorkbook(book, target, base, options, XLSX);
  const warnings = ['Chuyển đổi giữ dữ liệu ô và công thức được hỗ trợ. Macro, biểu đồ, ảnh, xác thực dữ liệu và định dạng nâng cao có thể không đi theo; công thức không được tính lại.'];
  if (target === 'xlsx' || target === 'ods' || target === 'xlsb') {
    const outputWarnings = target === 'xlsb' ? prepareBinaryWorkbook(book, XLSX) : warnings;
    const bytes = XLSX.write(book, { type: 'array', bookType: target, cellStyles: true, bookSST: true }) as ArrayBuffer;
    return { files: [{ name: `${base}.${target}`, blob: new Blob([bytes], { type: mimeTypes[target] }) }], warnings: outputWarnings };
  }
  const sheets = book.SheetNames.map((name) => ({ name, sheet: book.Sheets[name] }));
  if (['csv', 'tsv', 'json'].includes(target)) {
    warnings.push('Mỗi trang tính được xuất thành một tệp dữ liệu. Công thức chưa có kết quả được xuất dạng chữ. Ô gộp và định dạng không đi theo.');
    const files = sheets.map(({ name, sheet }, index) => {
      const stem = sheets.length > 1 ? `${base} - ${index + 1} - ${conversionBaseName(name)}` : base;
      if (target === 'json') return { name: `${stem}.json`, blob: textBlob(JSON.stringify(worksheetJsonRows(sheet, XLSX), null, 2), 'application/json') };
      const value = XLSX.utils.sheet_to_csv(sheet, { FS: target === 'tsv' ? '\t' : ',', RS: '\r\n', blankrows: true });
      return { name: `${stem}.${target}`, blob: textBlob(`\uFEFF${value}`, target === 'tsv' ? 'text/tab-separated-values' : 'text/csv') };
    });
    return { files, warnings };
  }
  const content: JSONContent[] = [];
  const richTarget = target === 'docx' || target === 'html';
  let styles: import('exceljs').Workbook | undefined;
  let drawings: Awaited<ReturnType<typeof import('./formButtons').readSheetObjects>> | undefined;
  if (zip?.file('xl/workbook.xml')) {
    const { worksheetPaths } = await import('./xlsmPackage');
    drawings = await (await import('./formButtons')).readSheetObjects(zip, await worksheetPaths(zip));
    if (richTarget) {
      const { default: ExcelJS } = await import('exceljs');
      try { styles = await new ExcelJS.Workbook().xlsx.load(buffer); }
      catch { warnings.push('Một số kiểu chữ và kiểu ô Excel chưa đọc được. Bản chuyển dùng giá trị hiển thị của các ô.'); }
    }
  }
  for (const [index, { name, sheet }] of sheets.entries()) {
    checkConversionAbort(options);
    if (index) content.push({ type: 'pageBreak' });
    content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: name }] });
    const bounds = sheetBounds(sheet);
    const attachments = new Map<string, JSONContent[]>();
    const extra: JSONContent[] = [];
    for (const shape of drawings?.objects[index] ?? []) {
      const node = spreadsheetDrawing(shape, drawings!.images);
      if (!node) continue;
      const { row: r, column: c } = shape.from;
      if (!richTarget || shape.at || r >= bounds.rows || c >= bounds.columns) { extra.push(node); continue; }
      const merged = sheet['!merges']?.find(({ s, e }) => s.r <= r && s.c <= c && e.r >= r && e.c >= c);
      const address = XLSX.utils.encode_cell(merged?.s ?? { r, c });
      const nodes = attachments.get(address) ?? [];
      nodes.push(node);
      attachments.set(address, nodes);
    }
    if (bounds.rows) content.push(spreadsheetDocumentTable(sheet, bounds.rows, bounds.columns, XLSX.utils.encode_cell, XLSX.utils.format_cell, styles?.getWorksheet(name), attachments));
    content.push(...extra);
  }
  warnings.push('Bản Word/HTML giữ ô gộp và độ rộng cột được hỗ trợ. PDF/ảnh dàn lại bảng theo trang; kiểu ô và vùng in có thể thay đổi. Công thức chưa có giá trị đã lưu được hiển thị dưới dạng công thức.');
  return exportConversionDocument({ type: 'doc', content }, base, target, warnings, options);
}

function spreadsheetDrawing(shape: FormButton, images: FormImageMap): JSONContent | undefined {
  if (shape.hidden) return;
  if (shape.image && images[shape.image]) return { type: 'image', attrs: { src: images[shape.image], alt: shape.name || '', ...shape.size } };
  if (shape.label) return { type: 'paragraph', content: [{ type: 'text', text: shape.label }] };
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
  if (['xlsx', 'csv', 'tsv', 'json'].includes(target)) return (await import('./documentSpreadsheet')).exportDocumentSpreadsheet(json, base, target, warnings, options);
  throw new Error('Định dạng đầu ra chưa được hỗ trợ.');
}

export { conversionNodeText };
