import { removeVietnameseAccents } from './vietnamUtils';

export type RegionId = 'north' | 'central' | 'south';

export const REGION_LABELS: Record<RegionId, string> = {
  north: 'Miền Bắc',
  central: 'Miền Trung & Tây Nguyên',
  south: 'Miền Nam',
};

const PROVINCES: Record<RegionId, string[]> = {
  north: [
    'Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Cao Bằng', 'Lạng Sơn', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Tuyên Quang', 'Lào Cai',
    'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'Ninh Bình', 'Hà Giang', 'Yên Bái', 'Bắc Kạn', 'Vĩnh Phúc', 'Hòa Bình',
    'Bắc Giang', 'Thái Bình', 'Hà Nam', 'Nam Định', 'Hải Dương',
  ],
  central: [
    'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Trị', 'Huế', 'Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng',
    'Đắk Lắk', 'Quảng Bình', 'Quảng Nam', 'Kon Tum', 'Bình Định', 'Ninh Thuận', 'Đắk Nông', 'Bình Thuận', 'Phú Yên', 'Thừa Thiên Huế',
  ],
  south: [
    'Hồ Chí Minh', 'Đồng Nai', 'Tây Ninh', 'Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang', 'Bình Dương', 'Bà Rịa - Vũng Tàu',
    'Bình Phước', 'Long An', 'Sóc Trăng', 'Hậu Giang', 'Bến Tre', 'Trà Vinh', 'Tiền Giang', 'Bạc Liêu', 'Kiên Giang',
  ],
};

const ALIASES: Record<string, string> = {
  hcm: 'Hồ Chí Minh', tphcm: 'Hồ Chí Minh', hcmc: 'Hồ Chí Minh', saigon: 'Hồ Chí Minh', sg: 'Hồ Chí Minh',
  hn: 'Hà Nội', hanoi: 'Hà Nội', hp: 'Hải Phòng', dn: 'Đà Nẵng', ct: 'Cần Thơ',
  vungtau: 'Bà Rịa - Vũng Tàu', bariavungtau: 'Bà Rịa - Vũng Tàu', brvt: 'Bà Rịa - Vũng Tàu', baria: 'Bà Rịa - Vũng Tàu',
  thuathienhue: 'Thừa Thiên Huế', tthue: 'Thừa Thiên Huế', daklak: 'Đắk Lắk', daclac: 'Đắk Lắk', daknong: 'Đắk Nông',
  backan: 'Bắc Kạn', baccan: 'Bắc Kạn', kontum: 'Kon Tum',
};

const fold = (text: string) =>
  removeVietnameseAccents(text)
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?|t\.)\s*/, '')
    .replace(/[^a-z0-9]/g, '');

const INDEX = new Map<string, { province: string; region: RegionId }>();
(Object.keys(PROVINCES) as RegionId[]).forEach((region) => PROVINCES[region].forEach((province) => INDEX.set(fold(province), { province, region })));
Object.entries(ALIASES).forEach(([alias, province]) => {
  const hit = INDEX.get(fold(province));
  if (hit) INDEX.set(alias, hit);
});

export function provinceOf(raw: unknown): { province: string; region: RegionId } | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const direct = INDEX.get(fold(text));
  if (direct) return direct;
  const parts = text.split(/[,;\-–|/]/).map((p) => p.trim()).filter(Boolean).reverse();
  for (const part of parts) {
    const hit = INDEX.get(fold(part));
    if (hit) return hit;
  }
  return null;
}

export type RegionSummary = {
  regions: Record<RegionId, number>;
  provinces: { province: string; region: RegionId; value: number; rows: number }[];
  unmatched: { text: string; rows: number }[];
  total: number;
  matchedRows: number;
};

export function summarizeByProvince(rows: unknown[][], provinceCol: number, valueCol: number | null): RegionSummary {
  const regions: Record<RegionId, number> = { north: 0, central: 0, south: 0 };
  const byProvince = new Map<string, { province: string; region: RegionId; value: number; rows: number }>();
  const unmatched = new Map<string, number>();
  let matchedRows = 0;
  for (const row of rows) {
    const hit = provinceOf(row[provinceCol]);
    const raw = valueCol === null ? 1 : Number(row[valueCol]);
    const value = Number.isFinite(raw) ? raw : 0;
    if (!hit) {
      const text = String(row[provinceCol] ?? '').trim();
      if (text) unmatched.set(text, (unmatched.get(text) ?? 0) + 1);
      continue;
    }
    matchedRows++;
    regions[hit.region] += value;
    const entry = byProvince.get(hit.province) ?? { ...hit, value: 0, rows: 0 };
    entry.value += value;
    entry.rows += 1;
    byProvince.set(hit.province, entry);
  }
  return {
    regions,
    provinces: [...byProvince.values()].sort((a, b) => b.value - a.value),
    unmatched: [...unmatched.entries()].map(([text, count]) => ({ text, rows: count })).sort((a, b) => b.rows - a.rows),
    total: regions.north + regions.central + regions.south,
    matchedRows,
  };
}

export function detectProvinceColumn(headers: string[], rows: unknown[][]): number {
  let best = -1;
  let bestHits = 0;
  headers.forEach((_, c) => {
    const hits = rows.reduce<number>((n, r) => n + (provinceOf(r[c]) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = c;
      bestHits = hits;
    }
  });
  return best;
}
