export type SheetTab = 'home' | 'insert' | 'draw' | 'page_layout' | 'formulas' | 'data' | 'review' | 'view' | 'automate' | 'help';
export type SheetEnterDirection = 'down' | 'right' | 'up' | 'left';
export type SheetQatCommand =
  | 'save'
  | 'undo'
  | 'redo'
  | 'print'
  | 'find'
  | 'sortAsc'
  | 'sortDesc'
  | 'filter'
  | 'freeze'
  | 'formatPainter'
  | 'exportXlsx'
  | 'history';
export type SheetQatPosition = 'above' | 'below';

export const SHEET_DEFAULTS = {
  sheetFormulaAutoComplete: true,
  sheetEnterMove: true,
  sheetEnterDirection: 'down' as SheetEnterDirection,
  sheetValueAutoComplete: true,
  sheetHeaderAutoFormat: true,
  sheetShowFormulaBar: true,
  sheetShowStatusBar: true,
  sheetShowSheetTabs: true,
  sheetShowHScroll: true,
  sheetShowVScroll: true,
  sheetNewSheetCount: 1,
  sheetTabs: {
    home: true,
    insert: true,
    draw: true,
    page_layout: true,
    formulas: true,
    data: true,
    review: true,
    view: true,
    automate: true,
    help: true,
  } as Record<SheetTab, boolean>,
  sheetQatShow: false,
  sheetQatPosition: 'above' as SheetQatPosition,
  sheetQatCommands: ['save', 'undo', 'redo'] as SheetQatCommand[],
};
