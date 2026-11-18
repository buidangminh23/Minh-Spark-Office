import type { WorkSheet } from 'xlsx';

type Engine = typeof import('xlsx');
type Value = string | boolean | number | null;
const utf8 = new TextEncoder();
const invalid = () => new Error('Cấu trúc bảng DBF không hợp lệ hoặc phiên bản chưa được hỗ trợ.');

export async function readDbf(buffer: ArrayBuffer, xlsx: Engine) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 33 || ![3, 0x30, 0x31, 0x83, 0x8b, 0xf5].includes(bytes[0])) throw invalid();
  const count = view.getUint32(4, true);
  const header = view.getUint16(8, true);
  const stride = view.getUint16(10, true);
  if (count > 49_999 || header > bytes.length || !stride || header + count * stride > bytes.length) throw invalid();
  const chars: { start: number; width: number }[] = [];
  let column = 0, offset = 1, field = 32;
  for (; field < header && bytes[field] !== 13; field += 32) {
    if (field + 32 > header) throw invalid();
    const type = String.fromCharCode(bytes[field + 11]);
    if ('MGPW'.includes(type)) throw new Error('Bảng DBF có trường memo hoặc đối tượng lưu riêng. Hãy xuất cả dữ liệu từ ứng dụng gốc sang XLSX.');
    const width = bytes[field + 16];
    if (type === 'C') chars.push({ start: offset, width });
    offset += width;
    column++;
  }
  if (!column || bytes[field] !== 13 || offset > stride || column > 512 || column * (count + 1) > 250_000) throw invalid();
  let codepage = 1252;
  if (bytes[29] === 0) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      for (let i = 0; i < count; i++) for (const { start, width } of chars) {
        const index = header + i * stride + start;
        decoder.decode(bytes.subarray(index, index + width));
      }
      codepage = 65001;
    } catch { codepage = 1252; }
  }
  xlsx.set_cptable(await import('xlsx/dist/cpexcel.full.mjs'));
  return xlsx.read(buffer, { type: 'array', codepage, WTF: true, cellNF: true });
}

export function writeDbf(sheet: WorkSheet, xlsx: Engine) {
  const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');
  const columns = range.e.c - range.s.c + 1;
  if (columns > 255) throw new Error('Một bảng DBF chỉ hỗ trợ tối đa 255 trường.');
  const get = (row: number, col: number): Value => {
    const cell = sheet[xlsx.utils.encode_cell({ r: row, c: col + range.s.c })];
    if (!cell) return null;
    if (cell.f && (cell.t === 'z' || cell.v == null)) return '=' + cell.f;
    if (cell.t === 'd' || cell.t === 'e' || cell.t === 'n' && cell.z && xlsx.SSF.is_date(String(cell.z))) return xlsx.utils.format_cell(cell);
    return cell.v ?? null;
  };
  const heads = Array.from({ length: columns }, (_, c) => get(range.s.r, c));
  const hasHeaders = heads.every(v => v == null || typeof v === 'string') && heads.some(v => typeof v === 'string' && v.trim());
  const validNames = heads.every(v => typeof v === 'string' && /^[A-Z_][A-Z0-9_]{0,9}$/i.test(v)) &&
    new Set(heads.map(v => String(v).toUpperCase())).size === columns;
  const start = range.s.r + (hasHeaders ? 1 : 0);
  const used = new Set<string>();
  const fields = heads.map((original, col) => {
    let width = 1;
    let allNumbers = true, allFlags = true, seen = false;
    let decimals = 0;
    for (let row = start; row <= range.e.r; row++) {
      const value = get(row, col);
      if (value === null) continue;
      seen = true;
      const text = String(value);
      width = Math.max(width, utf8.encode(text).length);
      allNumbers &&= typeof value === 'number' && Number.isFinite(value) && !/[eE]/.test(text);
      allFlags &&= typeof value === 'boolean';
      if (typeof value === 'number') decimals = Math.max(decimals, (text.split('.')[1] ?? '').length);
    }
    const type = seen && allFlags ? 'L' : seen && allNumbers && width <= 20 && decimals <= 15 ? 'N' : 'C';
    if (width > 254) throw new Error('Một giá trị vượt giới hạn 254 byte của trường DBF. Hãy chọn XML hoặc XLSX để giữ nguyên văn bản.');
    const normalized = hasHeaders ? String(original ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'D').replace(/\W+/g, '_') : '';
    const stem = /^[a-z_]/i.test(normalized) ? normalized.slice(0, 10) : 'FIELD_' + (col + 1);
    let name = stem;
    for (let n = 2; used.has(name.toUpperCase()); n++) {
      const suffix = '_' + n;
      name = stem.slice(0, 10 - suffix.length) + suffix;
    }
    used.add(name.toUpperCase());
    return { name, width: type === 'L' ? 1 : width, type, decimals: type === 'N' ? decimals : 0 };
  });
  const records = Math.max(0, range.e.r - start + 1);
  const header = 33 + fields.length * 32;
  const stride = 1 + fields.reduce((sum, f) => sum + f.width, 0);
  const length = header + records * stride + 1;
  if (stride > 65_535 || length > 100 * 1024 * 1024) throw new Error('Bảng DBF vượt giới hạn kích thước. Hãy tách bảng trước khi xuất.');
  const data = new Uint8Array(length);
  const view = new DataView(data.buffer);
  const now = new Date();
  data.set([3, now.getFullYear() - 1900, now.getMonth() + 1, now.getDate()]);
  view.setUint32(4, records, true);
  view.setUint16(8, header, true);
  view.setUint16(10, stride, true);
  fields.forEach((f, col) => {
    const at = 32 + 32 * col;
    data.set(utf8.encode(f.name), at);
    data[at + 11] = f.type.charCodeAt(0);
    data[at + 16] = f.width;
    data[at + 17] = f.decimals;
  });
  data[header - 1] = 13;
  data.fill(32, header);
  let unicode = false;
  for (let row = start; row <= range.e.r; row++) {
    let at = header + (row - start) * stride + 1;
    for (const [col, f] of fields.entries()) {
      const value = get(row, col);
      const text = f.type === 'L' ? value == null ? '?' : value ? 'T' : 'F' : String(value ?? '');
      const bytes = utf8.encode(text);
      unicode ||= bytes.length !== text.length;
      data.set(bytes, f.type === 'N' ? at + f.width - bytes.length : at);
      at += f.width;
    }
  }
  data[length - 1] = 0x1a;
  const labels = hasHeaders && !validNames ? fields.map((field, i) => [field.name, String(heads[i] ?? '')]) : [];
  return { blob: new Blob([data], { type: 'application/x-dbf' }), unicode, labels };
}
