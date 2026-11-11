export const BACKSPACE_CLEAR_PRIORITY = 100;

export interface CellSpan {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface SelectionLike {
  range: CellSpan;
  primary?: (CellSpan & { isMerged?: boolean }) | null | void;
}

const isSameSpan = (a: CellSpan, b: CellSpan): boolean =>
  a.startRow === b.startRow && a.endRow === b.endRow && a.startColumn === b.startColumn && a.endColumn === b.endColumn;

const isSingleCell = (span: CellSpan): boolean => span.startRow === span.endRow && span.startColumn === span.endColumn;

export const selectionCoversMultipleCells = (selections: readonly SelectionLike[] | null | undefined): boolean => {
  if (!selections || selections.length === 0) return false;
  if (selections.length > 1) return true;
  const { range, primary } = selections[0];
  if (isSingleCell(range)) return false;
  if (primary?.isMerged && isSameSpan(primary, range)) return false;
  return true;
};
