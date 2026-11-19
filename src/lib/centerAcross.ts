import type { CellValue, SheetData } from './sheetTypes';

export const CENTER_ACROSS_KEY = 'centerAcross';

type Merge = SheetData['mergeData'][number];

const hasContent = (cell?: CellValue) => Boolean(cell && ((cell.v !== undefined && cell.v !== null && cell.v !== '') || cell.f));

const mergedCells = (merges: Merge[]) => {
  const taken = new Set<string>();
  for (const merge of merges) {
    for (let row = merge.startRow; row <= merge.endRow; row += 1) {
      for (let column = merge.startColumn; column <= merge.endColumn; column += 1) taken.add(`${row}:${column}`);
    }
  }
  return taken;
};

export function applyCenterAcross(sheet: SheetData, continuous: Map<number, Set<number>>) {
  const taken = mergedCells(sheet.mergeData);
  for (const [row, columns] of continuous) {
    const cells = sheet.cellData[row] ?? {};
    const free = (column: number) => columns.has(column) && !taken.has(`${row}:${column}`);
    for (const start of [...columns].sort((a, b) => a - b)) {
      if (!free(start) || !hasContent(cells[start])) continue;
      let end = start;
      while (free(end + 1) && !hasContent(cells[end + 1])) end += 1;
      if (end === start) continue;
      sheet.mergeData.push({ startRow: row, endRow: row, startColumn: start, endColumn: end });
      cells[start] = { ...cells[start], custom: { ...(cells[start].custom ?? {}), [CENTER_ACROSS_KEY]: 1 } };
      for (let column = start; column <= end; column += 1) taken.add(`${row}:${column}`);
    }
  }
}

export const isCenterAcrossMerge = (sheet: SheetData, merge: Merge) =>
  merge.startRow === merge.endRow && sheet.cellData[merge.startRow]?.[merge.startColumn]?.custom?.[CENTER_ACROSS_KEY] === 1;
