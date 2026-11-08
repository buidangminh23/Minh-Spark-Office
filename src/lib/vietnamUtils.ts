export const VIETNAMESE_BANKS = [
  { bin: '970436', shortName: 'VCB', name: 'Vietcombank' },
  { bin: '970422', shortName: 'MB', name: 'MBBank' },
  { bin: '970407', shortName: 'TCB', name: 'Techcombank' },
  { bin: '970415', shortName: 'CTG', name: 'VietinBank' },
  { bin: '970418', shortName: 'BIDV', name: 'BIDV' },
  { bin: '970416', shortName: 'ACB', name: 'ACB' },
  { bin: '970432', shortName: 'VPB', name: 'VPBank' },
  { bin: '970423', shortName: 'TPB', name: 'TPBank' },
  { bin: '970403', shortName: 'STB', name: 'Sacombank' },
  { bin: '970441', shortName: 'VIB', name: 'VIB' },
  { bin: '970443', shortName: 'SHB', name: 'SHB' },
  { bin: '970437', shortName: 'HDB', name: 'HDBank' },
  { bin: '970426', shortName: 'MSB', name: 'MSB' },
  { bin: '970448', shortName: 'OCB', name: 'OCB' },
  { bin: '970449', shortName: 'LPB', name: 'LPBank' },
  { bin: '970440', shortName: 'SEAB', name: 'SeABank' },
  { bin: '970409', shortName: 'BAB', name: 'BacABank' },
  { bin: '970425', shortName: 'ABB', name: 'ABBank' },
  { bin: '970419', shortName: 'NCB', name: 'NCB' },
  { bin: '970400', shortName: 'SGB', name: 'SaigonBank' },
] as const;

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUP_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readGroupOfThree(group: number, showZeroHundred: boolean): string {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor((group % 100) / 10);
  const units = group % 10;
  const words: string[] = [];
  const hasHundred = hundreds > 0 || showZeroHundred;
  if (hasHundred) words.push(DIGITS[hundreds], 'trăm');
  if (tens === 0) {
    if (units > 0) words.push(...(hasHundred ? ['lẻ', DIGITS[units]] : [DIGITS[units]]));
  } else if (tens === 1) {
    words.push('mười');
    if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  } else {
    words.push(DIGITS[tens], 'mươi');
    if (units === 1) words.push('mốt');
    else if (units === 4) words.push('tư');
    else if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  }
  return words.join(' ');
}

export function parseVietnameseAmount(amount: number | string): number {
  if (typeof amount === 'number') return amount;
  const clean = amount.trim().replace(/\s|đ|₫|vnd/gi, '');
  const decimalComma = /,\d{1,2}$/.test(clean) && !/,\d{3}/.test(clean.slice(0, -3));
  const integerPart = decimalComma ? clean.slice(0, clean.lastIndexOf(',')) : clean;
  return Number(integerPart.replace(/[.,]/g, ''));
}

export function docSoTien(amount: number | string, currency = 'đồng', suffix = 'chẵn'): string {
  const value = parseVietnameseAmount(amount);
  const tail = `${currency}${suffix ? ` ${suffix}` : ''}`;
  if (!Number.isFinite(value)) return '';
  const num = Math.floor(Math.abs(value));
  if (num === 0) return `Không ${tail}`;
  const groups: number[] = [];
  for (let temp = num; temp > 0; temp = Math.floor(temp / 1000)) groups.push(temp % 1000);
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const read = readGroupOfThree(groups[i], i < groups.length - 1);
    parts.push(GROUP_UNITS[i] ? `${read} ${GROUP_UNITS[i]}` : read);
  }
  const text = `${value < 0 ? 'âm ' : ''}${parts.join(' ')}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${tail}`;
}

export interface VietQrOptions {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  memo?: string;
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function removeVietnameseAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

export function buildVietQrPayload(opts: VietQrOptions): string {
  const account = opts.accountNumber.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(opts.bankBin)) throw new Error('Mã ngân hàng không hợp lệ');
  if (!/^[0-9A-Za-z]{1,19}$/.test(account)) throw new Error('Số tài khoản chỉ gồm chữ số hoặc chữ cái, tối đa 19 ký tự');
  const amount = opts.amount && opts.amount > 0 ? Math.round(opts.amount) : 0;
  const memo = removeVietnameseAccents(opts.memo ?? '').replace(/[^0-9A-Za-z .,_-]/g, '').trim().slice(0, 50);
  const beneficiary = tlv('00', opts.bankBin) + tlv('01', account);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  let payload = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (amount) payload += tlv('54', String(amount));
  payload += tlv('58', 'VN');
  if (memo) payload += tlv('62', tlv('08', memo));
  payload += '6304';
  return payload + crc16Ccitt(payload);
}

const MST_WEIGHTS = [31, 29, 23, 19, 17, 13, 7, 5, 3];

export function validateTaxCode(taxCode: string): { valid: boolean; message: string; type: 'enterprise' | 'branch' | 'invalid' } {
  const clean = taxCode.trim().replace(/\s+/g, '');
  if (!clean) return { valid: false, message: 'Mã số thuế không được để trống', type: 'invalid' };
  if (!/^\d{10}(-?\d{3})?$/.test(clean)) {
    return { valid: false, message: 'Mã số thuế phải gồm 10 chữ số, hoặc 13 chữ số dạng XXXXXXXXXX-XXX', type: 'invalid' };
  }
  const digits = clean.replace('-', '').split('').map(Number);
  const remainder = MST_WEIGHTS.reduce((sum, weight, i) => sum + digits[i] * weight, 0) % 11;
  const checkDigit = 10 - remainder;
  if (checkDigit === 10) {
    return { valid: false, message: 'Dãy 9 số đầu cho chữ số kiểm tra bằng 10, mã này không được cấp', type: 'invalid' };
  }
  if (checkDigit !== digits[9]) {
    return { valid: false, message: `Chữ số kiểm tra không hợp lệ (đúng phải là ${checkDigit}, nhận được ${digits[9]})`, type: 'invalid' };
  }
  if (digits.length === 10) return { valid: true, message: 'Mã số thuế doanh nghiệp hợp lệ (10 số)', type: 'enterprise' };
  if (digits.slice(10).every((d) => d === 0)) {
    return { valid: false, message: 'Ba số cuối của mã chi nhánh phải từ 001 đến 999', type: 'invalid' };
  }
  return { valid: true, message: 'Mã số thuế chi nhánh / phụ thuộc hợp lệ (13 số)', type: 'branch' };
}

export function fuzzyMatch(a: string, b: string, foldAccents = true): number {
  const norm = (s: string) => (foldAccents ? removeVietnameseAccents(s).toLowerCase() : s).trim();
  let s1 = norm(a);
  let s2 = norm(b);
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  if (s1.length > s2.length) [s1, s2] = [s2, s1];
  const row = Array.from({ length: s1.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s2.length; i++) {
    let prev = i;
    for (let j = 1; j <= s1.length; j++) {
      const val = s2[i - 1] === s1[j - 1] ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[s1.length] = prev;
  }
  return Math.max(0, 1 - row[s1.length] / Math.max(s1.length, s2.length));
}

export type SqlCell = string | number | boolean | null;

export interface SheetSqlResult {
  headers: string[];
  rows: SqlCell[][];
  totalCount: number;
  error?: string;
}

type Aggregate = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
type SelectItem = { label: string; column: number | null; aggregate: Aggregate | null };
type Condition = { column: number; op: string; value: SqlCell; negate: boolean };

class SqlError extends Error {}

const QUOTE_PAIRS: Record<string, string> = { "'": "'", '"': '"', '`': '`', '[': ']' };

function splitTopLevel(text: string, keyword: RegExp): string[] {
  const isWord = /^[A-Za-z]/.test(keyword.source);
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (QUOTE_PAIRS[ch]) {
      quote = QUOTE_PAIRS[ch];
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth > 0) continue;
    keyword.lastIndex = i;
    const match = keyword.exec(text);
    if (match && match.index === i && (!isWord || (/\s/.test(text[i - 1] ?? '') && /\s/.test(text[i + match[0].length] ?? '')))) {
      parts.push(text.slice(start, i));
      start = i + match[0].length;
      i = start - 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

function findClause(text: string, name: string): number {
  let quote = '';
  const upper = text.toUpperCase();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (QUOTE_PAIRS[ch]) {
      quote = QUOTE_PAIRS[ch];
      continue;
    }
    if (upper.startsWith(name, i) && /\s/.test(text[i - 1] ?? ' ') && /\s/.test(text[i + name.length] ?? ' ')) return i;
  }
  return -1;
}

function unquote(text: string): string | null {
  const t = text.trim();
  const close = QUOTE_PAIRS[t[0]];
  return close && t.length >= 2 && t.endsWith(close) ? t.slice(1, -1) : null;
}

function resolveColumn(headers: string[], raw: string): number {
  const name = (unquote(raw) ?? raw).trim();
  const exact = headers.indexOf(name);
  if (exact >= 0) return exact;
  const folded = removeVietnameseAccents(name).toLowerCase();
  const loose = headers.findIndex((h) => removeVietnameseAccents(h).toLowerCase() === folded);
  if (loose >= 0) return loose;
  throw new SqlError(`Không có cột "${name}". Cột hiện có: ${headers.join(', ')}`);
}

function parseLiteral(raw: string): SqlCell {
  const t = raw.trim();
  if (t[0] === "'" || t[0] === '"') {
    const inner = unquote(t);
    if (inner === null) throw new SqlError(`Chuỗi chưa đóng dấu nháy: ${t}`);
    return inner;
  }
  if (/^null$/i.test(t)) return null;
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  const n = Number(t);
  if (t !== '' && Number.isFinite(n)) return n;
  return t;
}

const CONDITION_OPS = ['>=', '<=', '!=', '<>', '=', '>', '<'];

function parseCondition(headers: string[], text: string): Condition {
  const isNull = /^(.+?)\s+IS\s+(NOT\s+)?NULL$/i.exec(text);
  if (isNull) return { column: resolveColumn(headers, isNull[1]), op: 'NULL', value: null, negate: !!isNull[2] };
  const word = /^(.+?)\s+(NOT\s+)?(LIKE|CONTAINS)\s+(.+)$/i.exec(text);
  if (word) return { column: resolveColumn(headers, word[1]), op: word[3].toUpperCase(), value: parseLiteral(word[4]), negate: !!word[2] };
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (QUOTE_PAIRS[ch]) {
      quote = QUOTE_PAIRS[ch];
      continue;
    }
    const op = CONDITION_OPS.find((candidate) => text.startsWith(candidate, i));
    if (op && i > 0) return { column: resolveColumn(headers, text.slice(0, i)), op, value: parseLiteral(text.slice(i + op.length)), negate: false };
  }
  throw new SqlError(`Không hiểu điều kiện: "${text}"`);
}

const isBlank = (v: SqlCell | undefined) => v === null || v === undefined || v === '';

function asNumber(v: SqlCell | undefined): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function compareCells(a: SqlCell | undefined, b: SqlCell | undefined): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;
  return String(a).localeCompare(String(b), 'vi');
}

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function testCondition(row: SqlCell[], cond: Condition): boolean {
  const cell = row[cond.column];
  let result: boolean;
  switch (cond.op) {
    case 'NULL': result = isBlank(cell); break;
    case 'LIKE': result = !isBlank(cell) && likeToRegExp(String(cond.value ?? '')).test(String(cell)); break;
    case 'CONTAINS': result = !isBlank(cell) && String(cell).toLowerCase().includes(String(cond.value ?? '').toLowerCase()); break;
    case '=': result = cond.value === null ? isBlank(cell) : compareCells(cell, cond.value) === 0 && !isBlank(cell); break;
    case '!=': case '<>': result = cond.value === null ? !isBlank(cell) : isBlank(cell) || compareCells(cell, cond.value) !== 0; break;
    default: {
      if (isBlank(cell) || cond.value === null) return false;
      const diff = compareCells(cell, cond.value);
      result = cond.op === '>' ? diff > 0 : cond.op === '<' ? diff < 0 : cond.op === '>=' ? diff >= 0 : diff <= 0;
    }
  }
  return cond.negate ? !result : result;
}

function parseSelectItem(headers: string[], raw: string): SelectItem {
  const agg = /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(.*?)\s*\)$/i.exec(raw);
  if (agg) {
    const aggregate = agg[1].toUpperCase() as Aggregate;
    if (agg[2] === '*') {
      if (aggregate !== 'COUNT') throw new SqlError(`${aggregate}(*) không hợp lệ, hãy ghi tên cột`);
      return { label: 'COUNT(*)', column: null, aggregate };
    }
    const column = resolveColumn(headers, agg[2]);
    return { label: `${aggregate}(${headers[column]})`, column, aggregate };
  }
  const column = resolveColumn(headers, raw);
  return { label: headers[column], column, aggregate: null };
}

function aggregate(rows: SqlCell[][], item: SelectItem): SqlCell {
  if (item.column === null) return rows.length;
  const values = rows.map((r) => r[item.column as number]).filter((v) => !isBlank(v));
  if (item.aggregate === 'COUNT') return values.length;
  if (item.aggregate === 'MIN' || item.aggregate === 'MAX') {
    if (!values.length) return null;
    const sorted = [...values].sort(compareCells);
    return item.aggregate === 'MIN' ? sorted[0] : sorted[sorted.length - 1];
  }
  const nums = values.map(asNumber).filter((n): n is number => n !== null);
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return item.aggregate === 'SUM' ? sum : Math.round((sum / nums.length) * 10000) / 10000;
}

function sliceClauses(query: string) {
  const body = query.trim().replace(/;\s*$/, '');
  if (!/^SELECT\s/i.test(body)) throw new SqlError('Câu lệnh phải bắt đầu bằng SELECT');
  const marks = ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT']
    .map((name) => ({ name, at: findClause(body, name) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const order = ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'];
  marks.forEach((m, i) => {
    if (i > 0 && order.indexOf(m.name) < order.indexOf(marks[i - 1].name)) throw new SqlError(`${m.name} phải đứng sau ${marks[i - 1].name}`);
  });
  const clause = (name: string) => {
    const idx = marks.findIndex((m) => m.name === name);
    if (idx < 0) return undefined;
    const end = marks[idx + 1]?.at ?? body.length;
    return body.slice(marks[idx].at + name.length, end).trim();
  };
  return { select: body.slice(6, marks[0]?.at ?? body.length).trim(), where: clause('WHERE'), groupBy: clause('GROUP BY'), orderBy: clause('ORDER BY'), limit: clause('LIMIT') };
}

export function runSheetSql(headers: string[], rows: SqlCell[][], query: string): SheetSqlResult {
  try {
    const parts = sliceClauses(query);
    if (!parts.select) throw new SqlError('Thiếu danh sách cột sau SELECT');
    let filtered = rows;
    if (parts.where) {
      const groups = splitTopLevel(parts.where, /OR/iy).map((g) => splitTopLevel(g, /AND/iy).map((c) => parseCondition(headers, c)));
      filtered = rows.filter((row) => groups.some((conds) => conds.every((c) => testCondition(row, c))));
    }
    const items: SelectItem[] = parts.select === '*'
      ? headers.map((h, i) => ({ label: h, column: i, aggregate: null }))
      : splitTopLevel(parts.select, /,/y).map((raw) => parseSelectItem(headers, raw));
    const groupCols = parts.groupBy ? splitTopLevel(parts.groupBy, /,/y).map((c) => resolveColumn(headers, c)) : [];
    const hasAggregate = items.some((it) => it.aggregate);
    let records: { out: SqlCell[]; src: SqlCell[] | null }[];
    const grouped = hasAggregate || groupCols.length > 0;
    if (grouped) {
      const loose = items.find((it) => !it.aggregate && !groupCols.includes(it.column as number));
      if (loose) throw new SqlError(`Cột "${loose.label}" phải nằm trong GROUP BY hoặc dùng hàm SUM/COUNT/AVG/MIN/MAX`);
      const buckets = new Map<string, SqlCell[][]>();
      for (const row of filtered) {
        const key = JSON.stringify(groupCols.map((c) => row[c] ?? null));
        buckets.set(key, [...(buckets.get(key) ?? []), row]);
      }
      if (!groupCols.length && !buckets.size) buckets.set('[]', []);
      records = [...buckets.values()].map((bucket) => ({ out: items.map((it) => (it.aggregate ? aggregate(bucket, it) : bucket[0][it.column as number] ?? null)), src: null }));
    } else {
      records = filtered.map((row) => ({ out: items.map((it) => row[it.column as number] ?? null), src: row }));
    }
    const labels = items.map((it) => it.label);
    if (parts.orderBy) {
      const keys = splitTopLevel(parts.orderBy, /,/y).map((raw) => {
        const m = /^(.*?)(?:\s+(ASC|DESC))?$/i.exec(raw.trim()) as RegExpExecArray;
        const target = (unquote(m[1]) ?? m[1]).trim();
        const desc = (m[2] ?? '').toUpperCase() === 'DESC';
        const index = labels.findIndex((l) => l.toLowerCase() === target.toLowerCase());
        if (index >= 0) return { pick: (r: (typeof records)[number]) => r.out[index], desc };
        const column = resolveColumn(headers, m[1]);
        const outIndex = items.findIndex((it) => !it.aggregate && it.column === column);
        if (outIndex >= 0) return { pick: (r: (typeof records)[number]) => r.out[outIndex], desc };
        if (grouped) throw new SqlError(`ORDER BY "${target}" phải là một cột trong SELECT khi có GROUP BY`);
        return { pick: (r: (typeof records)[number]) => r.src?.[column] ?? null, desc };
      });
      records = [...records].sort((a, b) => {
        for (const k of keys) {
          const diff = compareCells(k.pick(a), k.pick(b));
          if (diff) return k.desc ? -diff : diff;
        }
        return 0;
      });
    }
    let outRows = records.map((r) => r.out);
    if (parts.limit !== undefined) {
      if (!/^\d+$/.test(parts.limit)) throw new SqlError('LIMIT phải là số nguyên');
      outRows = outRows.slice(0, Number(parts.limit));
    }
    return { headers: labels, rows: outRows, totalCount: outRows.length };
  } catch (err) {
    const message = err instanceof SqlError ? err.message : err instanceof Error ? `Lỗi truy vấn: ${err.message}` : 'Lỗi truy vấn SQL';
    return { headers: [], rows: [], totalCount: 0, error: message };
  }
}
