import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ICellDataForSheetInterceptor, IRowData } from '@univerjs/presets';
import { FontCache, SpreadsheetSkeleton } from '@univerjs/preset-sheets-core';
import { fitWrappedRows, registerWrappedCellSpacing, restoreAuthoredRowHeights, WRAPPED_LINE_GAP } from '../src/editors/sheet/fitWrappedRows.ts';
import { emptySheet } from '../src/lib/workbookBasics.ts';

test('fixed, legacy and automatic wrapped cells on the same sheet use the correct native line spacing', (t) => {
  const rowData: IRowData[] = [{ h: 32, ia: 0 }, { h: 32 }, { h: 32, ia: 1 }];
  const style = { tb: 3, fs: 11 };
  const input = { v: 'One\nTwo\nThree', t: 1, s: style, fontRenderExtension: { leftOffset: 1 } };
  const workbook = { getStyles: () => ({ getStyleByCell: () => style }) };
  const worksheet = {
    getColumnWidth: () => 120,
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
  assert.deepEqual(heights, [38, 38, 46]);
  assert.deepEqual(displayed.map(cell => (cell.s as { pd: object }).pd), Array(3).fill({ t: 4, b: 4, l: 8, r: 8 }));
  assert.deepEqual(input.fontRenderExtension, { leftOffset: 1 });
  assert.deepEqual(rowData, [{ h: 32, ia: 0 }, { h: 32 }, { h: 32, ia: 1 }]);
});

test('opening a sheet fits wrapped content and restores authored fixed heights in the saved snapshot', () => {
  const model = emptySheet('Layout');
  model.rowData = { 0: { h: 32, ia: 0, custom: { other: 1 } }, 1: { h: 40 }, 3: { h: 50, ia: 0 }, 4: { h: 20, ia: 0 } };
  const required = [40, 18, 70, 100, 24];
  const heights = () => required.map((_, i) => model.rowData[i]?.ah ?? model.rowData[i]?.h ?? 24);
  const sheet = {
    getConfig: () => model,
    getRowVisible: () => true,
    getColVisible: () => true,
    getRowManager: () => ({ getRowHeight: (i: number) => heights()[i] }),
    getCellMatrix: () => ({ forEach: (visit: (i: number, cells: object) => void) =>
      required.forEach((_value, i) => visit(i, { 0: { v: 'Text' } })) }),
    getComposedCellStyleByCellData: () => ({ tb: 3 }),
    getCellInfoInMergeData: (i: number) => ({ startRow: i, endRow: i === 3 ? 4 : i }),
  };
  const skeleton = { calculateAutoHeightForCell: (row: number) => required[row] };
  const runtime = { __getInjector: () => ({ get: () => ({ ensureSkeleton: () => skeleton }) }) };
  let mutations = 0;
  const api = {
    getActiveWorkbook: () => ({ getWorkbook: () => ({ getUnitId: () => 'book', getWorksheets: () => [[model.id, sheet]] }) }),
    syncExecuteCommand: (_id: string, { rowData }: { rowData: typeof model.rowData }) => {
      mutations++;
      for (const [index, update] of Object.entries(rowData)) Object.assign(model.rowData[Number(index)] ??= {}, update);
    },
  };
  fitWrappedRows(runtime as never, api as never);
  fitWrappedRows(runtime as never, api as never);
  assert.equal(mutations, 1);
  assert.deepEqual(heights(), [40, 40, 70, 50, 50]);
  model.rowData[4].h = 64;
  const saved = structuredClone(model);
  restoreAuthoredRowHeights(saved);
  assert.deepEqual(saved.rowData, {
    0: { h: 32, ia: 0, custom: { other: 1 } }, 1: { h: 40 }, 2: { ah: 70 }, 3: { h: 50, ia: 0 }, 4: { h: 64, ia: 0 },
  });
  assert.equal(model.rowData[0].h, 40);
});
