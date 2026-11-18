import type { JSONContent } from '@tiptap/react';
import type { Workbook, Worksheet } from 'exceljs';
import type { Range } from 'xlsx';
import { checkConversionAbort, type ConversionOptions, type ConversionResult } from './conversionTypes';
import { conversionNodeText } from './officeConversionDocument';
import { conversionTableGrid } from './officeConversionTables';

type Picture = { node: JSONContent; row: number; column: number };
type Section = { rows: string[][]; merges: Range[]; pictures: Picture[]; headings: number[]; tableRows: Set<number>; widths: number[] };
const newSection = (): Section => ({ rows: [], merges: [], pictures: [], headings: [], tableRows: new Set(), widths: [] });
const imagesOf = (node: JSONContent): JSONContent[] => node.type === 'image' ? [node] : (node.content ?? []).flatMap(imagesOf);

function documentSections(json: JSONContent, options: ConversionOptions) {
  const sections: Section[] = [];
  let section = newSection();
  let cellCount = 0;
  let hasTable = false;
  let hasImage = false;
  const addSection = () => {
    if (section.rows.length) sections.push(section);
    section = newSection();
  };
  const append = (values: string[]) => {
    cellCount += values.length;
    if (cellCount > 250_000 || section.rows.length >= 50_000) throw new Error('Bảng quá lớn để chuyển đổi an toàn.');
    section.rows.push(values);
  };
  const nodes = json.content ?? [];
  const tablesOnly = nodes.every((node) => node.type === 'table' || node.type === 'pageBreak');
  const write = (node: JSONContent, prefix = '') => {
    checkConversionAbort(options);
    if (node.type === 'pageBreak') { addSection(); return; }
    if (node.type === 'table') {
      hasTable = true;
      if (tablesOnly) addSection();
      const offset = section.rows.length;
      const grid = conversionTableGrid(node, (cell, row, column) => {
        for (const image of imagesOf(cell)) section.pictures.push({ node: image, row: row + offset, column });
        const widths = cell.attrs?.colwidth;
        if (Array.isArray(widths)) widths.forEach((width, index) => {
          if (Number.isFinite(width) && width > 0) section.widths[column + index] = Math.max(section.widths[column + index] ?? 0, width);
        });
      });
      for (const row of grid.rows) { section.tableRows.add(section.rows.length); append(row); }
      for (const { s, e } of grid.merges) section.merges.push({ s: { r: s.r + offset, c: s.c }, e: { r: e.r + offset, c: e.c } });
      return;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      (node.content ?? []).forEach((item, index) => {
        (item.content ?? []).forEach((block, blockIndex) => write(block, blockIndex ? '' : node.type === 'orderedList' ? `${(Number(node.attrs?.start) || 1) + index}. ` : '• '));
      });
      return;
    }
    if (node.type === 'blockquote' || node.type === 'doc') { for (const block of node.content ?? []) write(block); return; }
    const row = section.rows.length;
    const images = imagesOf(node);
    const text = conversionNodeText(node);
    if (!text.trim() && !images.length) return;
    if (node.type === 'heading') section.headings.push(row);
    for (const image of images) section.pictures.push({ node: image, row, column: 0 });
    hasImage ||= images.length > 0;
    append([prefix + text]);
  };
  for (const node of nodes) write(node);
  addSection();
  if (!sections.length) throw new Error('Tài liệu không có nội dung chữ hoặc ảnh để chuyển sang bảng tính.');
  if (!hasTable && !hasImage) {
    for (const sheet of sections) {
      sheet.rows.unshift(['Nội dung']);
      sheet.headings = [0, ...sheet.headings.map((row) => row + 1)];
    }
  }
  return { sections, hasTable, tablesOnly };
}

async function pictureSource(node: JSONContent) {
  const src = String(node.attrs?.src ?? '');
  const match = /^data:image\/(png|jpe?g|gif|webp);base64,/i.exec(src);
  if (!match) throw new Error('Không đọc được ảnh nhúng để đưa vào Excel.');
  let extension = match[1].toLowerCase();
  if (extension === 'jpg') extension = 'jpeg';
  let source = src;
  let width = Number(node.attrs?.width);
  let height = Number(node.attrs?.height);
  if (!width || !height || extension === 'webp') {
    const img = new Image();
    img.src = src;
    await img.decode();
    const ratio = img.naturalWidth / img.naturalHeight;
    width ||= height ? height * ratio : img.naturalWidth;
    height ||= width / ratio;
    if (extension === 'webp') {
      if (img.naturalWidth * img.naturalHeight > 60_000_000) throw new Error('Ảnh nhúng vượt giới hạn 60 triệu điểm ảnh.');
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không tạo được ảnh PNG để đưa vào Excel.');
      try { ctx.drawImage(img, 0, 0); source = canvas.toDataURL('image/png'); } finally { canvas.width = canvas.height = 0; }
      extension = 'png';
    }
  }
  const scale = Math.min(1, 480 / width, 320 / height);
  return { source, extension: extension as 'png' | 'jpeg' | 'gif', width: Math.max(1, width * scale), height: Math.max(1, height * scale) };
}

async function embedPictures(book: Workbook, sheet: Worksheet, section: Section, options: ConversionOptions) {
  const groups = new Map<string, Picture[]>();
  for (const picture of section.pictures) {
    const key = `${picture.row}/${picture.column}`;
    const group = groups.get(key) ?? [];
    group.push(picture);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const { row, column } = group[0];
    const items: Awaited<ReturnType<typeof pictureSource>>[] = [];
    for (const { node } of group) { checkConversionAbort(options); items.push(await pictureSource(node)); }
    const totalWidth = items.reduce((width, item) => width + item.width + 4, 0);
    const scale = Math.min(1, 1500 / totalWidth);
    let left = 0;
    let maxHeight = 0;
    for (const item of items) {
      const id = book.addImage({ base64: item.source, extension: item.extension });
      const width = item.width * scale;
      const height = item.height * scale;
      const tl = { col: column, row, nativeCol: column, nativeRow: row, nativeColOff: Math.round(left * 9525), nativeRowOff: 0 };
      sheet.addImage(id, { tl, ext: { width, height }, editAs: 'oneCell' });
      left += (item.width + 4) * scale;
      maxHeight = Math.max(maxHeight, height);
    }
    const targetColumn = sheet.getColumn(column + 1);
    targetColumn.width = Math.max(targetColumn.width ?? 10, Math.ceil(left / 7));
    const targetRow = sheet.getRow(row + 1);
    const cellText = section.rows[row][column];
    const lineCount = cellText ? cellText.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / targetColumn.width!)), 0) : 0;
    targetRow.height = Math.min(409, Math.max(targetRow.height ?? 15, maxHeight * 0.75 + lineCount * 15 + 4));
    sheet.getCell(row + 1, column + 1).alignment = { vertical: 'bottom', wrapText: true };
  }
}

export async function exportDocumentSpreadsheet(json: JSONContent, base: string, target: string, warnings: string[], options: ConversionOptions): Promise<ConversionResult> {
  const { sections, hasTable, tablesOnly } = documentSections(json, options);
  if (!hasTable) warnings.push('Tài liệu được sắp theo thứ tự gốc, mỗi đoạn văn nằm trên một dòng của trang tính.');
  if (target !== 'xlsx') {
    const separator = target === 'csv' ? ',' : '\t';
    const escape = (value: string) => /["\r\n\t,]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    if (sections.some((sheet) => sheet.pictures.length)) warnings.push('CSV và TSV lưu mô tả ảnh dưới dạng chữ.');
    const files = sections.map(({ rows, pictures }, index) => {
      for (const { node, row, column } of pictures) rows[row][column] += `${rows[row][column] ? ' ' : ''}[${node.attrs?.alt || 'Ảnh'}]`;
      const name = `${base}${sections.length > 1 ? ` - ${tablesOnly ? 'bang' : 'trang'} ${index + 1}` : ''}.${target}`;
      const content = rows.map((row) => row.map(escape).join(separator)).join('\r\n');
      return { name, blob: new Blob(['\uFEFF', content, '\r\n'], { type: `${target === 'csv' ? 'text/csv' : 'text/tab-separated-values'};charset=utf-8` }) };
    });
    return { files, warnings };
  }
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'Office 23';
  const line = { style: 'thin' as const, color: { argb: 'FFAAB3BF' } };
  for (const [index, section] of sections.entries()) {
    checkConversionAbort(options);
    const name = tablesOnly ? `Bảng ${index + 1}` : sections.length > 1 ? `Trang ${index + 1}` : 'Nội dung';
    const sheet = book.addWorksheet(name);
    const widths: number[] = [];
    for (const [r, values] of section.rows.entries()) {
      if (values.some((value) => value.length > 32767)) throw new Error('Nội dung một ô vượt giới hạn 32.767 ký tự của Excel. Hãy chọn định dạng khác hoặc chia nhỏ đoạn văn.');
      const row = sheet.addRow(values);
      row.eachCell((cell, column) => {
        const textWidth = Math.min(72, Math.max(12, ...String(cell.value).split('\n').map((v) => v.length + 2)));
        widths[column - 1] = Math.max(widths[column - 1] || 0, textWidth);
        cell.alignment = { vertical: 'top', wrapText: true };
        if (section.tableRows.has(r)) cell.border = { top: line, right: line, bottom: line, left: line };
      });
    }
    widths.forEach((width, c) => { sheet.getColumn(c + 1).width = Math.min(255, Math.max(3, section.widths[c] ? section.widths[c] / 7 : width)); });
    for (const row of section.headings) sheet.getCell(row + 1, 1).font = { bold: true };
    for (const { s, e } of section.merges) sheet.mergeCells(s.r + 1, s.c + 1, e.r + 1, e.c + 1);
    await embedPictures(book, sheet, section, options);
  }
  checkConversionAbort(options);
  const bytes = await book.xlsx.writeBuffer();
  checkConversionAbort(options);
  return { files: [{ name: `${base}.xlsx`, blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }], warnings };
}
