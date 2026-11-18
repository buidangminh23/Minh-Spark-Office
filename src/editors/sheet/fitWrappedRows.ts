import { InterceptorEffectEnum, WrapStrategy, type IRowData, type Nullable, type createUniver } from '@univerjs/presets';
import { INTERCEPTOR_POINT, MAXIMUM_ROW_HEIGHT, SetRowDataMutation, SheetInterceptorService, SheetSkeletonService, type SpreadsheetSkeleton } from '@univerjs/preset-sheets-core';
import type { SheetData } from '../../lib/sheetTypes';

type SheetRuntime = ReturnType<typeof createUniver>;

export const WRAPPED_LINE_GAP = 4;
const WRAPPED_CELL_PADDING = { t: 4, b: 4, l: 8, r: 8 };

const hasFixedHeight = (row?: Partial<IRowData> | null) => row?.ia === 0 || (row?.h != null && row.ia !== 1 && row.ah == null);
const DISPLAY_HEIGHT = 'office23WrappedDisplayHeight';

export function forgetDisplayHeight(row: Nullable<Partial<IRowData>>) {
  if (!row?.custom || !(DISPLAY_HEIGHT in row.custom)) return;
  delete row.custom[DISPLAY_HEIGHT];
  if (!Object.keys(row.custom).length) delete row.custom;
}

export function restoreAuthoredRowHeights(sheet: SheetData) {
  for (const row of Object.values(sheet.rowData ?? {})) {
    const custom = row.custom;
    if (!custom) continue;
    const adjustment = custom[DISPLAY_HEIGHT];
    if (!Array.isArray(adjustment) || adjustment.length !== 2) continue;
    const [original, fitted] = adjustment;
    if (row.h === fitted && hasFixedHeight(row)) {
      if (typeof original === 'number') row.h = original;
      else delete row.h;
    }
    forgetDisplayHeight(row);
  }
}

export function registerWrappedCellSpacing(univer: SheetRuntime['univer']) {
  univer.__getInjector().get(SheetInterceptorService).intercept(INTERCEPTOR_POINT.CELL_CONTENT, {
    effect: InterceptorEffectEnum.Style,
    handler: (cell, { worksheet, workbook, row, col }, next) => {
      if (!cell || (typeof cell.v !== 'string' && !cell.p)) return next(cell);
      const style = worksheet.getComposedCellStyleByCellData(row, col, cell);
      if (style.tb !== WrapStrategy.WRAP) return next(cell);
      const fixed = hasFixedHeight(worksheet.getConfig().rowData[row]);
      let padding = style.pd;
      if (!padding) {
        let width = worksheet.getColumnWidth(col);
        const fullInsetWidth = WRAPPED_CELL_PADDING.l * 12;
        if (width < fullInsetWidth) {
          const merge = worksheet.getCellInfoInMergeData(row, col);
          for (let i = col + 1; i <= merge.endColumn && width < fullInsetWidth; i++) {
            if (worksheet.getColVisible(i)) width += worksheet.getColumnWidth(i);
          }
        }
        const inset = Math.min(WRAPPED_CELL_PADDING.l, Math.floor(width / 12));
        padding = inset === WRAPPED_CELL_PADDING.l ? WRAPPED_CELL_PADDING : { ...WRAPPED_CELL_PADDING, l: inset, r: inset };
      }
      const displayed = {
        ...cell,
        ...(fixed && { fontRenderExtension: { ...cell.fontRenderExtension, lineGap: 0 } }),
        ...(!style.pd && { s: { ...workbook.getStyles().getStyleByCell(cell), pd: padding } }),
      };
      return next(displayed);
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
    const heights = new Map<number, number>();
    const spans: { first: number; last: number; required: number }[] = [];
    const currentHeight = (row: number) => heights.get(row) ?? sheet.getRowManager().getRowHeight(row);
    sheet.getCellMatrix().forEach((row, cells) => {
      if (!sheet.getRowVisible(row)) return;
      for (const [column, cell] of Object.entries(cells)) {
        if (!cell || (typeof cell.v !== 'string' && !cell.p)) continue;
        const col = Number(column);
        if (!sheet.getColVisible(col) || sheet.getComposedCellStyleByCellData(row, col, cell).tb !== WrapStrategy.WRAP) continue;
        const merge = sheet.getCellInfoInMergeData(row, col);
        if (merge.isMerged && !merge.isMergedMainCell) continue;
        skeleton ??= skeletons.ensureSkeleton(unitId, subUnitId);
        const measured = skeleton?.calculateAutoHeightForCell(row, col);
        if (measured === undefined || !Number.isFinite(measured)) continue;
        const required = Math.ceil(measured);
        if (merge.startRow !== merge.endRow) {
          spans.push({ first: row, last: merge.endRow, required });
        } else if (Math.min(MAXIMUM_ROW_HEIGHT, required) > currentHeight(row)) {
          heights.set(row, Math.min(MAXIMUM_ROW_HEIGHT, required));
        }
      }
    });
    for (const { first, last, required } of spans) {
      let available = 0;
      for (let row = first; row <= last && available < required; row++) {
        if (sheet.getRowVisible(row)) available += currentHeight(row);
      }
      for (let row = last; row >= first && available < required; row--) {
        if (!sheet.getRowVisible(row)) continue;
        const height = currentHeight(row);
        const extra = Math.min(required - available, MAXIMUM_ROW_HEIGHT - height);
        if (extra > 0) {
          heights.set(row, height + extra);
          available += extra;
        }
      }
    }
    if (heights.size) {
      const changes: Record<number, Partial<IRowData>> = {};
      for (const [row, h] of heights) {
        const previous = rowData[row];
        if (hasFixedHeight(previous)) {
          const prior = previous.custom?.[DISPLAY_HEIGHT];
          const original = Array.isArray(prior) && prior[1] === previous.h ? prior[0] : previous.h ?? null;
          changes[row] = { h, custom: { ...previous.custom, [DISPLAY_HEIGHT]: [original, h] } };
        } else {
          changes[row] = { ah: h };
        }
      }
      api.syncExecuteCommand(SetRowDataMutation.id, { unitId, subUnitId, rowData: changes }, { onlyLocal: true });
    }
  }
}
