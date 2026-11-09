export type PaperGroup = 'iso-a' | 'iso-b' | 'jis' | 'america' | 'envelope' | 'photo';

export const PAPER_GROUP_LABELS: Record<PaperGroup, string> = {
  'iso-a': 'Khổ A (ISO)',
  'iso-b': 'Khổ B (ISO)',
  jis: 'Khổ B (JIS Nhật)',
  america: 'Bắc Mỹ và khổ khác',
  envelope: 'Phong bì',
  photo: 'Ảnh và thẻ',
};

type PaperDef = { w: number; h: number; name: string; group: PaperGroup; unit?: 'in' };

const define = <T extends Record<string, PaperDef>>(catalog: T) => catalog;

export const PAPER_CATALOG = define({
  A4: { w: 210, h: 297, name: 'A4', group: 'iso-a' },
  A3: { w: 297, h: 420, name: 'A3', group: 'iso-a' },
  A5: { w: 148, h: 210, name: 'A5', group: 'iso-a' },
  A6: { w: 105, h: 148, name: 'A6', group: 'iso-a' },
  A7: { w: 74, h: 105, name: 'A7', group: 'iso-a' },
  A2: { w: 420, h: 594, name: 'A2', group: 'iso-a' },
  A1: { w: 594, h: 841, name: 'A1', group: 'iso-a' },
  A0: { w: 841, h: 1189, name: 'A0', group: 'iso-a' },
  B5: { w: 176, h: 250, name: 'B5', group: 'iso-b' },
  B4: { w: 250, h: 353, name: 'B4', group: 'iso-b' },
  B6: { w: 125, h: 176, name: 'B6', group: 'iso-b' },
  B3: { w: 353, h: 500, name: 'B3', group: 'iso-b' },
  JISB5: { w: 182, h: 257, name: 'B5 JIS', group: 'jis' },
  JISB4: { w: 257, h: 364, name: 'B4 JIS', group: 'jis' },
  JISB6: { w: 128, h: 182, name: 'B6 JIS', group: 'jis' },
  Letter: { w: 215.9, h: 279.4, name: 'Letter', group: 'america', unit: 'in' },
  Legal: { w: 215.9, h: 355.6, name: 'Legal', group: 'america', unit: 'in' },
  Executive: { w: 184.15, h: 266.7, name: 'Executive', group: 'america', unit: 'in' },
  Statement: { w: 139.7, h: 215.9, name: 'Statement', group: 'america', unit: 'in' },
  Tabloid: { w: 279.4, h: 431.8, name: 'Tabloid / Ledger', group: 'america', unit: 'in' },
  Folio: { w: 215.9, h: 330.2, name: 'Folio', group: 'america', unit: 'in' },
  F4: { w: 210, h: 330, name: 'F4', group: 'america' },
  GovLetter: { w: 203.2, h: 266.7, name: 'Government Letter', group: 'america', unit: 'in' },
  Quarto: { w: 215, h: 275, name: 'Quarto', group: 'america' },
  DL: { w: 110, h: 220, name: 'Phong bì DL', group: 'envelope' },
  C4: { w: 229, h: 324, name: 'Phong bì C4', group: 'envelope' },
  C5: { w: 162, h: 229, name: 'Phong bì C5', group: 'envelope' },
  C6: { w: 114, h: 162, name: 'Phong bì C6', group: 'envelope' },
  Env10: { w: 104.8, h: 241.3, name: 'Phong bì #10', group: 'envelope', unit: 'in' },
  Monarch: { w: 98.4, h: 190.5, name: 'Phong bì Monarch', group: 'envelope', unit: 'in' },
  Photo4x6: { w: 101.6, h: 152.4, name: 'Ảnh 10 × 15', group: 'photo', unit: 'in' },
  Photo5x7: { w: 127, h: 177.8, name: 'Ảnh 13 × 18', group: 'photo', unit: 'in' },
  Photo8x10: { w: 203.2, h: 254, name: 'Ảnh 20 × 25', group: 'photo', unit: 'in' },
  Hagaki: { w: 100, h: 148, name: 'Bưu thiếp', group: 'photo' },
  Index3x5: { w: 76.2, h: 127, name: 'Thẻ 3 × 5 in', group: 'photo', unit: 'in' },
});

export type PaperKey = keyof typeof PAPER_CATALOG;

const decimal = (value: number, digits: number) => String(Math.round(value * 10 ** digits) / 10 ** digits).replace('.', ',');

export function paperLabel(key: PaperKey): string {
  const p: PaperDef = PAPER_CATALOG[key];
  const size = p.unit === 'in' ? `${decimal(p.w / 25.4, 2)} × ${decimal(p.h / 25.4, 2)} in` : `${decimal(p.w / 10, 1)} × ${decimal(p.h / 10, 1)} cm`;
  return `${p.name} · ${size}`;
}

export const PAPER_KEYS = Object.keys(PAPER_CATALOG) as PaperKey[];

export const papersByGroup = () =>
  (Object.keys(PAPER_GROUP_LABELS) as PaperGroup[]).map((group) => ({
    group,
    label: PAPER_GROUP_LABELS[group],
    keys: PAPER_KEYS.filter((key) => PAPER_CATALOG[key].group === group),
  }));

const PX_PER_MM = 96 / 25.4;

export const paperPx = (key: PaperKey) => ({
  width: Math.round(PAPER_CATALOG[key].w * PX_PER_MM),
  height: Math.round(PAPER_CATALOG[key].h * PX_PER_MM),
});
