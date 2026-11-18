import { WrapStrategy, type createUniver } from '@univerjs/presets';
import { MAXIMUM_ROW_HEIGHT, SetWorksheetRowAutoHeightMutation, SheetSkeletonService, type SpreadsheetSkeleton } from '@univerjs/preset-sheets-core';

type SheetRuntime = ReturnType<typeof createUniver>;

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
      if (settings?.ia === 0 || (settings?.h != null && settings.ia !== 1) || settings?.ah != null) return;
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
