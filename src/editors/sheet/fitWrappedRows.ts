import { InterceptorEffectEnum, WrapStrategy, type IRowData, type createUniver } from '@univerjs/presets';
import { INTERCEPTOR_POINT, MAXIMUM_ROW_HEIGHT, SetWorksheetRowAutoHeightMutation, SheetInterceptorService, SheetSkeletonService, type SpreadsheetSkeleton } from '@univerjs/preset-sheets-core';

type SheetRuntime = ReturnType<typeof createUniver>;

export const WRAPPED_LINE_GAP = 4;
const WRAPPED_CELL_PADDING = { t: 4, b: 4, l: 4, r: 4 };

const hasFixedHeight = (row?: Partial<IRowData> | null) => row?.ia === 0 || (row?.h != null && row.ia !== 1 && row.ah == null);

export function registerWrappedCellSpacing(univer: SheetRuntime['univer']) {
  univer.__getInjector().get(SheetInterceptorService).intercept(INTERCEPTOR_POINT.CELL_CONTENT, {
    effect: InterceptorEffectEnum.Style,
    handler: (cell, { worksheet, workbook, row, col }, next) => {
      if (!cell || (typeof cell.v !== 'string' && !cell.p)) return next(cell);
      const style = worksheet.getComposedCellStyleByCellData(row, col, cell);
      if (style.tb !== WrapStrategy.WRAP) return next(cell);
      if (hasFixedHeight(worksheet.getConfig().rowData[row])) {
        const fontRenderExtension = { ...cell.fontRenderExtension, lineGap: 0 };
        return next({ ...cell, fontRenderExtension });
      }
      if (style.pd) return next(cell);
      return next({ ...cell, s: { ...workbook.getStyles().getStyleByCell(cell), pd: WRAPPED_CELL_PADDING } });
    },
  });
}

export function fitWrappedRows(univer: SheetRuntime['univer'], api: SheetRuntime['univerAPI']) {
  const workbook = api.getActiveWorkbook()?.getWorkbook();
  if (!workbook) return;
  const unitId = workbook.getUnitId();
  const skeletons = univer.__getInjector().get(SheetSkeletonService);

  for (const [subUnitId, sheet] of workbook.getWorksheets()) {
    let skeleton: SpreadsheetSkeleton | undefined;
    const { rowData } = sheet.getConfig();
    const rowsAutoHeightInfo: { row: number; autoHeight: number }[] = [];
    sheet.getCellMatrix().forEach((row, cells) => {
      const settings = rowData[row];
      if (hasFixedHeight(settings)) return;
      const height = sheet.getRowManager().getRowHeight(row);
      let required = height;
      for (const [column, cell] of Object.entries(cells)) {
        if (!cell || (typeof cell.v !== 'string' && !cell.p)) continue;
        const col = Number(column);
        if (!sheet.getColVisible(col) || sheet.getComposedCellStyleByCellData(row, col, cell).tb !== WrapStrategy.WRAP) continue;
        const merge = sheet.getCellInfoInMergeData(row, col);
        if (merge.startRow !== merge.endRow) continue;
        skeleton ??= skeletons.ensureSkeleton(unitId, subUnitId);
        const measured = skeleton?.calculateAutoHeightForCell(row, col);
        if (measured !== undefined) required = Math.max(required, Math.min(MAXIMUM_ROW_HEIGHT, Math.ceil(measured)));
      }
      if (required > height) rowsAutoHeightInfo.push({ row, autoHeight: required });
    });
    if (rowsAutoHeightInfo.length) {
      api.syncExecuteCommand(SetWorksheetRowAutoHeightMutation.id, { unitId, subUnitId, rowsAutoHeightInfo }, { onlyLocal: true });
    }
  }
}
