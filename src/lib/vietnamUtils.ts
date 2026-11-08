/**
 * Vietnam Business & Localization Utilities for Minh Spark Office
 * - docSoTien: Convert number/amount into standard Vietnamese currency words
 * - VietQR generator for bank transfer QR codes
 * - validateTaxCode: Vietnam Tax Identification Number (MST) validator with Modulo 11
 * - fuzzyMatch: String distance & similarity for bank/reconciliation matching
 * - runSheetSql: Lightweight in-memory SQL query engine for spreadsheet data
 */

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
  { bin: '970468', shortName: 'SEAB', name: 'SeABank' },
  { bin: '970409', shortName: 'BAB', name: 'BacABank' },
  { bin: '970425', shortName: 'ABB', name: 'ABBank' },
  { bin: '970419', shortName: 'NCB', name: 'NCB' },
  { bin: '970400', shortName: 'SGB', name: 'SaigonBank' },
] as const;

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readGroupOfThree(group: number, showZeroHundred: boolean): string {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor((group % 100) / 10);
  const units = group % 10;
  let result = '';

  if (hundreds > 0 || showZeroHundred) {
    result += `${DIGITS[hundreds]} trăm `;
  }

  if (tens === 0) {
    if (hundreds > 0 || showZeroHundred) {
      if (units > 0) result += `lẻ ${DIGITS[units]} `;
    } else {
      if (units > 0) result += `${DIGITS[units]} `;
    }
  } else if (tens === 1) {
    result += 'mười ';
    if (units === 1) result += 'một ';
    else if (units === 5) result += 'lăm ';
    else if (units > 0) result += `${DIGITS[units]} `;
  } else {
    result += `${DIGITS[tens]} mươi `;
    if (units === 1) result += 'mốt ';
    else if (units === 4) result += 'tư ';
    else if (units === 5) result += 'lăm ';
    else if (units > 0) result += `${DIGITS[units]} `;
  }

  return result.trim();
}

/**
 * Convert a numeric amount into standard Vietnamese words
 * e.g. 150000000 -> "Một trăm năm mươi triệu đồng chẵn"
 */
export function docSoTien(amount: number | string, currency = 'đồng', suffix = 'chẵn'): string {
  if (typeof amount === 'string') {
    amount = amount.replace(/[.,\s]/g, '');
  }
  const num = Math.floor(Math.abs(Number(amount)));
  if (isNaN(num) || num === 0) {
    return `Không ${currency}${suffix ? ` ${suffix}` : ''}`;
  }

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const groups: number[] = [];
  let temp = num;

  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp === 0) continue;
    const showZeroHundred = i < groups.length - 1;
    const read = readGroupOfThree(grp, showZeroHundred);
    if (read) {
      const unit = units[i];
      parts.push(unit ? `${read} ${unit}` : read);
    }
  }

  const fullText = parts.join(' ').replace(/\s+/g, ' ').trim();
  const capitalized = fullText.charAt(0).toUpperCase() + fullText.slice(1);
  return `${capitalized} ${currency}${suffix ? ` ${suffix}` : ''}`.trim();
}

/**
 * Generate standard VietQR image URL
 */
export interface VietQrOptions {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  memo?: string;
  accountName?: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

export function generateVietQrUrl(opts: VietQrOptions): string {
  const template = opts.template ?? 'compact2';
  const cleanAcc = opts.accountNumber.replace(/[\s-]/g, '');
  const base = `https://img.vietqr.io/image/${opts.bankBin}-${cleanAcc}-${template}.png`;
  const params = new URLSearchParams();
  if (opts.amount && opts.amount > 0) {
    params.set('amount', Math.round(opts.amount).toString());
  }
  if (opts.memo && opts.memo.trim()) {
    params.set('addInfo', opts.memo.trim());
  }
  if (opts.accountName && opts.accountName.trim()) {
    params.set('accountName', opts.accountName.trim().toUpperCase());
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Validate Vietnamese Tax Identification Number (MST)
 * - 10 digits for primary companies/organizations
 * - 13 digits for branches/dependents (formatted as XXXXXXXXXX-XXX or XXXXXXXXXXXXX)
 * Uses Modulo 11 checksum standard of the General Department of Taxation
 */
export function validateTaxCode(taxCode: string): { valid: boolean; message: string; type?: 'enterprise' | 'branch' | 'invalid' } {
  const clean = taxCode.trim().replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, message: 'Mã số thuế không được để trống', type: 'invalid' };
  }

  // Normalize 13-digit format
  const normalized = clean.replace('-', '');
  if (!/^\d{10}(\d{3})?$/.test(normalized)) {
    return { valid: false, message: 'Mã số thuế phải gồm 10 hoặc 13 chữ số', type: 'invalid' };
  }

  const digits = normalized.split('').map(Number);
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = 10 - remainder;
  const expectedDigit = checkDigit === 10 ? 0 : checkDigit;

  if (expectedDigit !== digits[9]) {
    return {
      valid: false,
      message: `Chữ số kiểm tra không hợp lệ (kỳ vọng ${expectedDigit}, nhận được ${digits[9]})`,
      type: 'invalid',
    };
  }

  if (normalized.length === 10) {
    return { valid: true, message: 'Mã số thuế doanh nghiệp hợp lệ (10 số)', type: 'enterprise' };
  } else {
    return { valid: true, message: 'Mã số thuế chi nhánh / phụ thuộc hợp lệ (13 số)', type: 'branch' };
  }
}

/**
 * Remove Vietnamese accents/diacritics for normalization
 */
export function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Compute string similarity (0.0 to 1.0) using normalized Levenshtein distance
 */
export function fuzzyMatch(a: string, b: string, caseInsensitive = true): number {
  let s1 = caseInsensitive ? removeVietnameseAccents(a).trim() : a.trim();
  let s2 = caseInsensitive ? removeVietnameseAccents(b).trim() : b.trim();

  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  if (s1.length > s2.length) {
    const temp = s1;
    s1 = s2;
    s2 = temp;
  }

  const row = Array.from({ length: s1.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s2.length; i++) {
    let prev = i;
    for (let j = 1; j <= s1.length; j++) {
      let val = row[j - 1];
      if (s2[i - 1] !== s1[j - 1]) {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[s1.length] = prev;
  }

  const distance = row[s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Lightweight in-memory SQL query engine for spreadsheet tables
 * Syntax supported:
 * SELECT colA, colB, SUM(colC) WHERE colA = 'value' AND colB > 100 ORDER BY colA ASC LIMIT 50
 */
export interface SheetSqlResult {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  totalCount: number;
  error?: string;
}

export function runSheetSql(
  headers: string[],
  rows: (string | number | boolean | null)[][],
  query: string
): SheetSqlResult {
  try {
    const trimmed = query.trim();
    if (!trimmed.toUpperCase().startsWith('SELECT')) {
      return { headers: [], rows: [], totalCount: 0, error: 'Câu lệnh phải bắt đầu bằng SELECT' };
    }

    const selectMatch = /^SELECT\s+(.+?)(?:\s+FROM\s+\w+)?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i.exec(trimmed);
    if (!selectMatch) {
      return { headers: [], rows: [], totalCount: 0, error: 'Cú pháp SELECT không hợp lệ' };
    }

    const [, selectFieldsRaw, whereRaw, orderByRaw, limitRaw] = selectMatch;

    // Build row objects
    const records = rows.map((r) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? null;
      });
      return obj;
    });

    // Filter WHERE
    let filtered = records;
    if (whereRaw) {
      const conds = whereRaw.split(/\s+AND\s+/i);
      filtered = records.filter((rec) => {
        return conds.every((c) => {
          const m = /^\s*([A-Za-z0-9_À-ỹ\s]+?)\s*(=|!=|<>|>=|<=|>|<|LIKE|CONTAINS)\s*(.+?)\s*$/i.exec(c);
          if (!m) return true;
          const [, colName, op, rawVal] = m;
          const col = colName.trim();
          let valTarget: any = rawVal.trim().replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(valTarget)) && valTarget !== '') valTarget = Number(valTarget);

          const cellVal = rec[col];
          const numCell = typeof cellVal === 'number' ? cellVal : Number(cellVal);
          const numTarget = typeof valTarget === 'number' ? valTarget : Number(valTarget);

          const isNum = !isNaN(numCell) && !isNaN(numTarget);

          switch (op.toUpperCase()) {
            case '=':
              return isNum ? numCell === numTarget : String(cellVal ?? '').toLowerCase() === String(valTarget).toLowerCase();
            case '!=':
            case '<>':
              return isNum ? numCell !== numTarget : String(cellVal ?? '').toLowerCase() !== String(valTarget).toLowerCase();
            case '>':
              return isNum ? numCell > numTarget : false;
            case '<':
              return isNum ? numCell < numTarget : false;
            case '>=':
              return isNum ? numCell >= numTarget : false;
            case '<=':
              return isNum ? numCell <= numTarget : false;
            case 'LIKE':
            case 'CONTAINS':
              return String(cellVal ?? '').toLowerCase().includes(String(valTarget).toLowerCase());
            default:
              return true;
          }
        });
      });
    }

    // ORDER BY
    if (orderByRaw) {
      const parts = orderByRaw.trim().split(/\s+/);
      const orderCol = parts[0];
      const desc = parts[1]?.toUpperCase() === 'DESC';
      filtered.sort((a, b) => {
        const va = a[orderCol];
        const vb = b[orderCol];
        if (typeof va === 'number' && typeof vb === 'number') {
          return desc ? vb - va : va - vb;
        }
        return desc ? String(vb ?? '').localeCompare(String(va ?? '')) : String(va ?? '').localeCompare(String(vb ?? ''));
      });
    }

    // LIMIT
    if (limitRaw) {
      const limit = parseInt(limitRaw, 10);
      if (!isNaN(limit)) filtered = filtered.slice(0, limit);
    }

    // SELECT columns
    let outHeaders: string[] = [];
    let outRows: (string | number | boolean | null)[][] = [];

    if (selectFieldsRaw.trim() === '*') {
      outHeaders = headers;
      outRows = filtered.map((rec) => headers.map((h) => rec[h]));
    } else {
      const cols = selectFieldsRaw.split(',').map((c) => c.trim());
      outHeaders = cols;
      outRows = filtered.map((rec) => cols.map((c) => rec[c] ?? null));
    }

    return {
      headers: outHeaders,
      rows: outRows,
      totalCount: outRows.length,
    };
  } catch (err: any) {
    return { headers: [], rows: [], totalCount: 0, error: err.message ?? 'Lỗi truy vấn SQL' };
  }
}
