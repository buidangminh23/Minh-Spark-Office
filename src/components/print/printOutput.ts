import { fitInto, gridCells, type GridCell, type Orientation, type Size } from '../../lib/print/printLayout';
import type { PrintSheet } from './printPages';

export type PagesPerSheet = 1 | 2 | 4 | 6 | 8 | 9 | 16;
export const PAGES_PER_SHEET: PagesPerSheet[] = [1, 2, 4, 6, 8, 9, 16];

export type OutputSlot = { sheet: number; box: GridCell; scale: number };
export type OutputPage = { key: string; paper: Size; orientation: Orientation; slots: OutputSlot[]; framed: boolean };

const NUP_GRIDS: Record<PagesPerSheet, [number, number][]> = {
  1: [[1, 1]],
  2: [[2, 1], [1, 2]],
  4: [[2, 2]],
  6: [[3, 2], [2, 3]],
  8: [[4, 2], [2, 4]],
  9: [[3, 3]],
  16: [[4, 4]],
};

const NUP_MARGIN = 6;
const NUP_GAP = 4;

export function filterParity(indices: number[], parity: 'all' | 'odd' | 'even'): number[] {
  if (parity === 'all') return indices;
  return indices.filter((i) => ((i + 1) % 2 === 1) === (parity === 'odd'));
}

function single(sheet: PrintSheet, index: number): OutputPage {
  return {
    key: `s${index}`,
    paper: sheet.paper,
    orientation: sheet.orientation,
    framed: false,
    slots: [{ sheet: index, box: { x: 0, y: 0, w: sheet.paper.w, h: sheet.paper.h }, scale: 1 }],
  };
}

function nupLayout(base: Size, child: Size, n: PagesPerSheet) {
  const candidates = NUP_GRIDS[n].flatMap(([cols, rows]) =>
    (['portrait', 'landscape'] as Orientation[]).map((orientation) => {
      const paper = orientation === 'landscape' ? { w: Math.max(base.w, base.h), h: Math.min(base.w, base.h) } : { w: Math.min(base.w, base.h), h: Math.max(base.w, base.h) };
      const cells = gridCells({ x: NUP_MARGIN, y: NUP_MARGIN, w: paper.w - NUP_MARGIN * 2, h: paper.h - NUP_MARGIN * 2 }, cols, rows, NUP_GAP);
      return { orientation, paper, cells, size: fitInto(child, cells[0]).w };
    }),
  );
  return candidates.reduce((best, next) => (next.size > best.size + 0.5 ? next : best));
}

export function composePages(sheets: PrintSheet[], indices: number[], perSheet: PagesPerSheet): OutputPage[] {
  if (perSheet === 1) return indices.map((i) => single(sheets[i], i));
  const pages: OutputPage[] = [];
  for (let start = 0; start < indices.length; start += perSheet) {
    const group = indices.slice(start, start + perSheet);
    const first = sheets[group[0]];
    const layout = nupLayout(first.paper, first.paper, perSheet);
    pages.push({
      key: `n${group.join('-')}`,
      paper: layout.paper,
      orientation: layout.orientation,
      framed: true,
      slots: group.map((sheetIndex, i) => {
        const box = fitInto(sheets[sheetIndex].paper, layout.cells[i]);
        return { sheet: sheetIndex, box, scale: box.w / sheets[sheetIndex].paper.w };
      }),
    });
  }
  return pages;
}

export type PrintRun = (OutputPage | null)[];

export function expandCopies(pages: OutputPage[], copies: number, collate: boolean, padToEven: boolean): PrintRun {
  const count = Math.max(1, Math.min(999, Math.floor(copies) || 1));
  const set: PrintRun = padToEven && pages.length % 2 === 1 ? [...pages, null] : [...pages];
  if (collate) return Array.from({ length: count }, () => set).flat();
  return set.flatMap((page) => Array.from({ length: count }, () => page));
}

export function duplexSide(run: PrintRun, side: 'front' | 'back', reverseBack: boolean): PrintRun {
  const picked = run.filter((_, i) => (i % 2 === 0) === (side === 'front'));
  return side === 'back' && reverseBack ? picked.reverse() : picked;
}

export function physicalSheets(run: PrintRun, sides: 'one' | 'manual' | 'auto'): number {
  return sides === 'one' ? run.length : Math.ceil(run.length / 2);
}
