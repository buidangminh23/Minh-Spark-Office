import type { FormatBadge } from '../../lib/conversionPresets';
import type { PartsFormat } from '../../lib/fileParts';

export const PART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#db2777', '#a16207', '#475569'];

export const colorAt = (index: number) => PART_COLORS[index % PART_COLORS.length];

export const FORMAT_BADGES: Record<PartsFormat, FormatBadge> = {
  pdf: { text: 'PDF', light: '#f87171', dark: '#dc2626' },
  docx: { text: 'DOCX', light: '#60a5fa', dark: '#1d4ed8' },
  xlsx: { text: 'XLSX', light: '#4ade80', dark: '#15803d' },
  pptx: { text: 'PPTX', light: '#fb923c', dark: '#c2410c' },
};

export const UNIT_NOUN: Record<PartsFormat, string> = { pdf: 'trang', docx: 'trang', xlsx: 'trang tính', pptx: 'trang chiếu' };

export type QueueItem = { id: number; file: File; color: string };

export type DonePart = { blob: Blob; stem: string; extension: string; pages: number };

export type DoneResult = { title: string; source: string; noun: string; parts: DonePart[]; zipStem: string; again: string };

export function pageRangeText(pages: number[]) {
  const sorted = [...pages].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    runs.push(start === end ? String(sorted[start] + 1) : `${sorted[start] + 1}–${sorted[end] + 1}`);
    start = end + 1;
  }
  return runs.join(', ');
}
