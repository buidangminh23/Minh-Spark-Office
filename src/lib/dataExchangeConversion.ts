import type { WorkBook, WorkSheet } from 'xlsx';
import type { CP$Utils } from 'xlsx/dist/cpexcel.full.mjs';
import { checkConversionAbort, type ConversionOptions, type ConversionResult } from './conversionTypes';
import { openOfficeZip } from './openOfficeZip';
import { readDbf, writeDbf } from './dbfExchange';
import type { DataExchangeFormat } from './dataExchangeFormats';

type Engine = typeof import('xlsx');
const ns = 'urn:schemas-microsoft-com:office:spreadsheet';
const limit = () => new Error('Bảng vượt giới hạn 50.000 hàng, 512 cột hoặc 250.000 ô. Hãy chia nhỏ tệp.');

async function codepages() {
  const module = await import('xlsx/dist/cpexcel.full.mjs') as unknown as { utils: CP$Utils };
  return module.utils;
}

async function decodeText(buffer: ArrayBuffer, ext: DataExchangeFormat) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch {
    if (ext === 'dif') return (await codepages()).decode(437, bytes);
    if (ext === 'xml') {
      const prefix = new TextDecoder('windows-1252').decode(bytes.subarray(0, 256));
      const charset = /^<\?xml\s+[^?]*?encoding\s*=\s*["']([^"']+)["']/i.exec(prefix)?.[1];
      if (charset) return new TextDecoder(charset, { fatal: true }).decode(bytes);
    }
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function readSpreadsheetXml(text: string, xlsx: Engine) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Excel XML có khai báo tài nguyên bên ngoài hoặc thực thể không được hỗ trợ.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const root = doc.documentElement;
  if (root?.localName !== 'Workbook' || root.namespaceURI !== ns || doc.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('Hãy chọn tệp Excel XML 2003 (SpreadsheetML) hợp lệ.');
  const worksheets = Array.from(root.getElementsByTagNameNS(ns, 'Worksheet'));
  if (!worksheets.length || worksheets.length > 500) throw new Error('Excel XML cần có từ 1 đến 500 trang tính.');
  let cells = 0;
  const uncached: { name: string; address: string }[] = [];
  for (const sheet of worksheets) {
    const name = sheet.getAttributeNS(ns, 'Name') ?? '';
    let row = 0, maxCol = 0, maxRow = 0;
    for (const line of Array.from(sheet.getElementsByTagNameNS(ns, 'Row'))) {
      row = Number(line.getAttributeNS(ns, 'Index') || row + 1);
      if (!Number.isSafeInteger(row) || row < 1 || row > 50_000) throw limit();
      let col = 0;
      for (const cell of Array.from(line.getElementsByTagNameNS(ns, 'Cell'))) {
        const left = Number(cell.getAttributeNS(ns, 'Index') || col + 1);
        const across = Number(cell.getAttributeNS(ns, 'MergeAcross') || 0);
        const down = Number(cell.getAttributeNS(ns, 'MergeDown') || 0);
        if (![left, across, down].every(Number.isSafeInteger) || left <= 0 || across < 0 || down < 0) throw limit();
        col = left + across;
        maxRow = Math.max(maxRow, row + down);
        maxCol = Math.max(maxCol, col);
        if (maxRow > 50_000 || maxCol > 512 || cells + maxRow * maxCol > 250_000) throw limit();
        if (cell.hasAttributeNS(ns, 'Formula')) {
          let data = Array.from(cell.childNodes).find(child => child.nodeType === 1 && (child as Element).localName === 'Data') as Element | undefined;
          if (!data || (!data.textContent && data.getAttributeNS(ns, 'Type') !== 'String')) {
            if (!data) { data = doc.createElementNS(ns, 'Data'); cell.insertBefore(data, cell.firstChild); }
            data.setAttributeNS(ns, 'ss:Type', 'Number');
            data.textContent = '0';
            uncached.push({ name, address: xlsx.utils.encode_cell({ r: row - 1, c: left - 1 }) });
          }
        }
      }
    }
    cells += maxRow * maxCol;
  }
  const xml = uncached.length ? new XMLSerializer().serializeToString(doc) : text;
  const book = xlsx.read(xml, { type: 'string', cellNF: true, cellStyles: true });
  for (const { name, address } of uncached) {
    const cell = book.Sheets[name]?.[address];
    if (!cell?.f) throw new Error('Không đọc được công thức trong Excel XML.');
    delete cell.v;
    delete cell.w;
  }
  return book;
}

export async function readDataExchangeWorkbook(buffer: ArrayBuffer, ext: DataExchangeFormat, xlsx: Engine): Promise<WorkBook> {
  if (ext === 'dbf') return readDbf(buffer, xlsx);
  if (ext === 'numbers') {
    const zip = await openOfficeZip(buffer);
    if (!zip.file('Index/Document.iwa') || !zip.file(/^Index\/Tables\/.*\.iwa$/).length) throw new Error('Hãy chọn tệp Apple Numbers (.numbers) có bảng tính và chỉ mục IWA.');
    const book = xlsx.read(buffer, { type: 'array', cellNF: true });
    for (const sheet of Object.values(book.Sheets)) {
      for (const [key, cell] of Object.entries(sheet)) {
        if (key.startsWith('!') || cell.t !== 'n' || !Number.isFinite(cell.v) || Number.isInteger(cell.v)) continue;
        const nearest = Math.round(cell.v);
        if (nearest !== 0 && Math.abs(nearest - cell.v) <= Math.min(1e-9, Math.abs(cell.v) * Number.EPSILON)) cell.v = nearest;
      }
    }
    return book;
  }
  const text = (await decodeText(buffer, ext)).trimStart();
  if (ext === 'xml') return readSpreadsheetXml(text, xlsx);
  if (ext === 'slk') {
    if (!/^ID;/i.test(text) || !/(?:^|[\r\n])E\s*$/.test(text)) throw new Error('Tệp SYLK phải có bản ghi ID và bản ghi kết thúc E.');
    let maxRow = 0, maxCol = 0;
    for (const line of text.split(/[\r\n]+/)) {
      if (!/^[BCF];/.test(line)) continue;
      const fields = line.split(';K', 1)[0].replace(/;;/g, '');
      for (const [, axis, value] of fields.matchAll(/;([XY])(\d+)/g)) {
        if (axis === 'X') maxCol = Math.max(maxCol, Number(value));
        else maxRow = Math.max(maxRow, Number(value));
      }
      if (maxCol > 512 || maxRow > 50_000 || maxCol * maxRow > 250_000) throw limit();
    }
  } else if (!/^TABLE[\r\n]/i.test(text) || !/[\r\n]DATA[\r\n]/i.test(text) || !/[\r\n]EOD\s*$/i.test(text)) {
    throw new Error('Tệp DIF thiếu bảng dữ liệu hoặc bản ghi kết thúc.');
  }
  return xlsx.read(text.replace(/\r\n|\r/g, '\n'), { type: 'binary', cellNF: true });
}

function projectedSheet(sheet: WorkSheet, format: DataExchangeFormat, xlsx: Engine) {
  const result = { ...sheet };
  for (const [key, orig] of Object.entries(sheet)) {
    if (key.startsWith('!')) continue;
    if (orig.f && (orig.v == null || orig.t === 'z')) {
      result[key] = { t: 's', v: '=' + orig.f };
    } else if (format === 'slk' && orig.f && (orig.f.includes('!') || orig.t !== 'n')) {
      result[key] = { ...orig, f: undefined };
    } else if (orig.t === 'e' && format !== 'slk') {
      result[key] = { t: 's', v: orig.w || xlsx.utils.format_cell(orig) };
    }
  }
  return result;
}

function writeSylk(book: WorkBook, name: string, sheet: WorkSheet, xlsx: Engine) {
  const strings = new Map<string, string>();
  for (const [addr, cell] of Object.entries(sheet)) {
    if (addr.startsWith('!') || cell.t !== 's') continue;
    const text = String(cell.v);
    if (/\u001b/.test(text)) throw new Error('Ô chứa ký tự ESC đặc biệt của SYLK. Hãy chọn XML để giữ dữ liệu.');
    strings.set(addr, text.replaceAll(';', ';;').replace(/\r\n|\n|\r/g, '\u001b :'));
    sheet[addr] = { ...cell, v: 'OFFICE23TEXT' };
  }
  const raw: string = xlsx.write({ ...book, Sheets: { [name]: sheet }, SheetNames: [name] }, { type: 'string', bookType: 'slk' });
  return raw.replace(/^C;Y(\d+);X(\d+);K"OFFICE23TEXT"(?=\r?$)/gm, (match, row, col) => {
    const value = strings.get(xlsx.utils.encode_cell({ r: Number(row) - 1, c: Number(col) - 1 }));
    return value === undefined ? match : `C;Y${row};X${col};K"${value}"`;
  });
}

export async function writeDataExchangeWorkbook(book: WorkBook, target: DataExchangeFormat, base: string, options: ConversionOptions, xlsx: Engine): Promise<ConversionResult> {
  checkConversionAbort(options);
  if (target === 'xml') {
    for (const sheet of Object.values(book.Sheets)) if (xlsx.utils.decode_range(sheet['!ref'] || 'A1').e.c >= 256) throw new Error('Excel XML 2003 hỗ trợ tối đa 256 cột. Hãy chọn XLSX để giữ toàn bộ cột.');
    const xml = (xlsx.write(book, { bookType: 'xlml', type: 'string', cellStyles: true }) as string).replaceAll('<Data ss:Type="Error"></Data>', '');
    return { files: [{ name: base + '.xml', blob: new Blob([xml], { type: 'application/xml;charset=utf-8' }) }], warnings: ['Excel XML giữ công thức, dữ liệu nhiều trang và ô gộp được hỗ trợ. Ảnh, biểu đồ, macro và kiểu nâng cao có thể bị lược bỏ.'] };
  }
  if (target === 'numbers') {
    const { default: template } = await import('xlsx/dist/xlsx.zahl.mjs');
    const sheets = Object.fromEntries(book.SheetNames.map(name => {
      const sheet = projectedSheet(book.Sheets[name], target, xlsx);
      if (!sheet['!ref']) sheet['!ref'] = 'A1';
      return [name, sheet];
    }));
    const bytes = xlsx.write({ ...book, Sheets: sheets }, { bookType: 'numbers', type: 'array', numbers: template });
    return { files: [{ name: base + '.numbers', blob: new Blob([bytes], { type: 'application/vnd.apple.numbers' }) }], warnings: ['Numbers lưu mỗi trang tính thành một bảng. Công thức dùng kết quả đã lưu hoặc biểu thức dạng chữ. Định dạng nâng cao và đối tượng nhúng có thể bị lược bỏ.'] };
  }
  const result: ConversionResult = { files: [], warnings: [target === 'slk'
    ? 'SYLK xuất riêng từng trang tính. Công thức số cùng trang có kết quả đã lưu được giữ; liên kết sang trang khác chỉ giữ giá trị.'
    : 'Mỗi trang tính xuất riêng với các giá trị ô. Công thức thiếu kết quả được lưu thành chữ. Ô gộp, hình ảnh và kiểu trang cần định dạng sổ làm việc.'] };
  const warnings = new Set(result.warnings);
  for (const [index, name] of book.SheetNames.entries()) {
    checkConversionAbort(options);
    const stem = book.SheetNames.length === 1 ? base : `${base} - ${index + 1} - ${name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}`;
    const sheet = projectedSheet(book.Sheets[name], target, xlsx);
    if (target === 'dbf') {
      const { blob, unicode, labels } = writeDbf(sheet, xlsx);
      result.files.push({ name: stem + '.dbf', blob });
      if (unicode) {
        result.files.push({ name: stem + '.cpg', blob: new Blob(['UTF-8'], { type: 'text/plain' }) });
        warnings.add('Giữ tệp .cpg cạnh bảng DBF để phần mềm đọc đúng UTF-8. Excel mở trực tiếp có thể dùng bảng mã cũ; hãy dùng XLSX nếu cần mở tiếng Việt trong Excel.');
      }
      if (labels.length) {
        const text = [['Trường DBF', 'Tiêu đề gốc'], ...labels].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n');
        result.files.push({ name: stem + '.fields.csv', blob: new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }) });
        warnings.add('Tên trường DBF giới hạn 10 ký tự ASCII. Tệp .fields.csv đối chiếu từng tên trường với tiêu đề gốc.');
      }
    } else {
      const text = target === 'slk' ? writeSylk(book, name, sheet, xlsx)
        : xlsx.write({ ...book, Sheets: { [name]: sheet }, SheetNames: [name] }, { type: 'string', bookType: 'dif' });
      const codepage = target === 'slk' ? 1252 : 437;
      const table = await codepages();
      const legacy = Uint8Array.from(table.encode(codepage, text, 'arr') as ArrayLike<number>);
      const compatible = table.decode(codepage, legacy) === text;
      if (!compatible) warnings.add('Nội dung có ký tự ngoài bảng mã gốc của định dạng này. Tệp dùng UTF-8; Excel mở trực tiếp có thể hiển thị sai dấu. Chọn XML hoặc XLSX để giữ tiếng Việt khi mở bằng Excel.');
      const mime = compatible ? 'application/octet-stream' : 'text/plain;charset=utf-8';
      result.files.push({ name: stem + '.' + target, blob: new Blob([compatible ? legacy : text], { type: mime }) });
    }
  }
  result.warnings = [...warnings];
  return result;
}
