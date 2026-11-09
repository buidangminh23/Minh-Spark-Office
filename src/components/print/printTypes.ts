import type { ReactNode } from 'react';
import { PAPERS } from '../../lib/print/printLayout';
import type { PagesPerSheet } from './printOutput';
import type { ContentKind, MarginPreset, Margins, OrientationChoice, PaperKey, ScaleMode, Size } from '../../lib/print/printLayout';

export type PrintSlice = { offsetPx: number; heightPx: number; part: number };

export type PrintItem = {
  slicesSelf?: boolean;
  key: string;
  size: Size;
  breaks?: number[];
  repeatPx?: number;
  render: (slice: PrintSlice) => ReactNode;
};

export type PrintSource = {
  kind: ContentKind;
  title: string;
  items: PrintItem[];
  flowsVertically?: boolean;
  perPage?: { cols: number; rows: number; gapMm: number };
  fixedPaper?: { size: Size; landscape: boolean };
  guideMargins?: Margins;
  currentItem?: number;
  loading?: boolean;
};

export type PrintSettings = {
  paper: PaperKey;
  orientation: OrientationChoice;
  marginPreset: MarginPreset;
  customMargins: Margins;
  scaleMode: ScaleMode;
  customScale: number;
  centerH: boolean;
  centerV: boolean;
  range: 'all' | 'current' | 'custom';
  pageRange: string;
  pageNumbers: boolean;
  showTitle: boolean;
  showDate: boolean;
  grayscale: boolean;
  frame: boolean;
  gutterMm: number;
  gutterPos: 'left' | 'top';
  mirror: boolean;
  headerMm: number;
  footerMm: number;
  lastCustom: { margins: Margins; mirror: boolean } | null;
  customPaper: Size | null;
  copies: number;
  collate: boolean;
  sides: 'one' | 'manual' | 'auto';
  reverseBack: boolean;
  parity: 'all' | 'odd' | 'even';
  pagesPerSheet: PagesPerSheet;
};

export const SETTINGS_KEY = 'minh-print-settings-v1';

export const DEFAULT_SETTINGS: Record<ContentKind, PrintSettings> = {
  document: base({ marginPreset: 'none', scaleMode: 'actual', centerH: false, centerV: false }),
  sheet: base({ orientation: 'auto', centerH: true, centerV: false, pageNumbers: true, showTitle: true }),
  slide: base({ orientation: 'auto', centerH: true, centerV: true, frame: true }),
  pdf: base({ orientation: 'auto', centerH: true, centerV: true }),
  image: base({ orientation: 'auto', centerH: true, centerV: true }),
};

function base(overrides: Partial<PrintSettings>): PrintSettings {
  return {
    paper: 'A4',
    orientation: 'auto',
    marginPreset: 'auto',
    customMargins: { top: 20, right: 15, bottom: 20, left: 20 },
    scaleMode: 'auto',
    customScale: 100,
    centerH: true,
    centerV: false,
    range: 'all',
    pageRange: '',
    pageNumbers: false,
    showTitle: false,
    showDate: false,
    grayscale: false,
    frame: false,
    gutterMm: 0,
    gutterPos: 'left',
    mirror: false,
    headerMm: 7.6,
    footerMm: 7.6,
    lastCustom: null,
    customPaper: null,
    copies: 1,
    collate: true,
    sides: 'one',
    reverseBack: false,
    parity: 'all',
    pagesPerSheet: 1,
    ...overrides,
  };
}

export function loadSettings(kind: ContentKind): PrintSettings {
  const fallback = DEFAULT_SETTINGS[kind];
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY}:${kind}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    const merged = { ...fallback, ...parsed, range: 'all' as const, pageRange: '', copies: 1, parity: 'all' as const };
    return merged.paper in PAPERS ? merged : { ...merged, paper: fallback.paper };
  } catch {
    return fallback;
  }
}

export function saveSettings(kind: ContentKind, settings: PrintSettings) {
  try {
    localStorage.setItem(`${SETTINGS_KEY}:${kind}`, JSON.stringify(settings));
  } catch {
    return;
  }
}
