import type * as XLSX from 'xlsx';

type CellValue = string | number | boolean | null;
type SourceSheet = { name: string; rows: unknown[] };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const boundsError = () => new Error('Bảng JSON vượt giới hạn 50.000 hàng, 512 cột hoặc 250.000 ô. Hãy chia nhỏ tệp.');

function jsonValue(input: string): unknown {
  const tokens = /"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  try {
    return JSON.parse(input.replace(tokens, (token) => {
      if (token.startsWith('"')) return token;
      const digits = token.split(/[eE]/)[0].replace(/[-.]/g, '').replace(/^0+/, '');
      const value = Number(token);
      return digits.length > 15 || !Number.isFinite(value) || (value === 0 && digits.length > 0) ? JSON.stringify(token) : token;
    }));
  } catch {
    throw new Error('JSON không hợp lệ. Hãy kiểm tra dấu ngoặc, dấu phẩy và dấu ngoặc kép.');
  }
}

function sources(data: unknown): SourceSheet[] {
  if (Array.isArray(data)) return [{ name: 'Sheet1', rows: data }];
  if (record(data) && Array.isArray(data.sheets) && Object.keys(data).length === 1) {
    if (!data.sheets.length || data.sheets.length > 500) throw new Error('Tệp JSON phải có từ 1 đến 500 trang tính.');
    if (!data.sheets.every((sheet) => record(sheet) && Array.isArray(sheet.rows) && typeof sheet.name === 'string')) throw new Error('Mỗi trang tính JSON cần có tên (name) và danh sách hàng (rows).');
    return data.sheets as SourceSheet[];
  }
  if (record(data)) return [{ name: 'Sheet1', rows: [data] }];
  throw new Error('Chọn JSON chứa mảng hàng, mảng bản ghi hoặc danh sách trang tính.');
}

function cellValue(value: unknown): CellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length > 32767) throw new Error('Một giá trị JSON dài hơn 32.767 ký tự. Hãy chia nhỏ nội dung ô trước khi xuất.');
  return text;
}

export function readJsonWorkbook(buffer: ArrayBuffer, xlsx: typeof XLSX): XLSX.WorkBook {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (source.length > 8_000_000) throw new Error('JSON vượt giới hạn 8 triệu ký tự. Hãy chia nhỏ tệp.');
  const book = xlsx.utils.book_new();
  const names = new Set<string>();
  let cells = 0;
  for (const { name, rows } of sources(jsonValue(source))) {
    const invalidCharacter = [...name].some(char => char.charCodeAt(0) < 32 || ':\\/?*[]'.includes(char));
    if (!name.trim() || name.length > 31 || invalidCharacter || name.startsWith("'") || name.endsWith("'") || name.toLowerCase() === 'history' || names.has(name.toLowerCase())) {
      throw new Error('Tên trang tính JSON phải hợp lệ, khác nhau và có tối đa 31 ký tự.');
    }
    names.add(name.toLowerCase());
    if (rows.length > 50_000) throw boundsError();
    const table: CellValue[][] = [];
    let columns = 0;
    if (rows.length && rows.every(record)) {
      const fields = new Set<string>();
      for (const row of rows) {
        for (const key of Object.keys(row)) fields.add(key);
        if (fields.size > 512 || fields.size * (rows.length + 1) + cells > 250_000 || rows.length === 50_000) throw boundsError();
      }
      const headers = [...fields];
      if (!headers.length) throw new Error('Các bản ghi JSON không có trường dữ liệu.');
      columns = headers.length;
      table.push(headers.map(cellValue));
      for (const row of rows) table.push(headers.map((key) => Object.hasOwn(row, key) ? cellValue(row[key]) : null));
    } else {
      const arrays = rows.every(Array.isArray);
      if (!arrays && rows.some((row) => Array.isArray(row) || record(row))) throw new Error('Các hàng JSON phải cùng dạng mảng, bản ghi hoặc giá trị đơn.');
      for (const row of rows) {
        const values = Array.isArray(row) ? row : [row];
        columns = Math.max(columns, values.length);
        if (columns > 512 || columns * rows.length + cells > 250_000) throw boundsError();
        table.push(values.map(cellValue));
      }
    }
    cells += table.length * columns;
    const sheet = xlsx.utils.aoa_to_sheet(table);
    if (columns && table.length) sheet['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: table.length - 1, c: columns - 1 } });
    xlsx.utils.book_append_sheet(book, sheet, name);
  }
  return book;
}
