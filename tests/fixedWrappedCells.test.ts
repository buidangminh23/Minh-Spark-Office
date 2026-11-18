import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ICellDataForSheetInterceptor, IRowData } from '@univerjs/presets';
import { FontCache, SpreadsheetSkeleton } from '@univerjs/preset-sheets-core';
import { registerWrappedCellSpacing, WRAPPED_LINE_GAP } from '../src/editors/sheet/fitWrappedRows.ts';

test('fixed, legacy and automatic wrapped cells on the same sheet use the correct native line spacing', (t) => {
  const rowData: IRowData[] = [{ h: 32, ia: 0 }, { h: 32 }, { h: 32, ia: 1 }];
  const style = { tb: 3, fs: 11 };
  const input = { v: 'One\nTwo\nThree', t: 1, s: style, fontRenderExtension: { leftOffset: 1 } };
  const workbook = { getStyles: () => ({ getStyleByCell: () => style }) };
  const worksheet = {
    getComposedCellStyleByCellData: (_row: number, _col: number, cell: ICellDataForSheetInterceptor) => cell.s,
    getConfig: () => ({ rowData }),
    getCellInfoInMergeData: () => ({ isMerged: false }),
    getCell: (row: number) => displayed[row],
  };
  type Handler = (
    cell: typeof input,
    context: { worksheet: typeof worksheet; workbook: typeof workbook; row: number; col: number },
    next: (cell: ICellDataForSheetInterceptor) => ICellDataForSheetInterceptor,
  ) => ICellDataForSheetInterceptor;
  let handler!: Handler;
  const service = { intercept: (_point: unknown, entry: { handler: Handler }) => { handler = entry.handler; } };
  registerWrappedCellSpacing({ __getInjector: () => ({ get: () => service }) } as never);
  const displayed: ICellDataForSheetInterceptor[] = rowData.map((_settings, row) =>
    handler(input, { worksheet, workbook, row, col: 0 }, (cell) => cell));
  t.mock.method(FontCache, 'getMeasureText', (value: string) => ({
    width: value.length * 6, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2,
  }));
  const skeleton = { worksheet, textLineGap: WRAPPED_LINE_GAP, _worksheetData: { columnData: {}, defaultColumnWidth: 120 } };
  const heights = displayed.map((_cell, row) => SpreadsheetSkeleton.prototype.calculateAutoHeightForCell.call(skeleton as never, row, 0));
  assert.deepEqual(heights, [32, 32, 46]);
  assert.deepEqual(input.fontRenderExtension, { leftOffset: 1 });
  assert.deepEqual(rowData, [{ h: 32, ia: 0 }, { h: 32 }, { h: 32, ia: 1 }]);
});
