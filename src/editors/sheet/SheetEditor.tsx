import { SuiteLogo } from '../../components/SuiteLogo';
import { SheetPrintDialog } from './SheetPrintDialog';
import { saveAccountSnapshot } from '../../lib/accountSnapshots';
import { useAccount } from '../../components/Authentication';
import { useWorkspace } from '../../lib/storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddinPanel, AddinRibbonButtons } from '../../addins/AddinPane';
import { FeatureMenu, type FeatureItem } from '../../components/FeatureMenu';
import { sheetHost } from '../../addins/hosts';
import { currentAuthorName } from '../../lib/currentAuthor';
import type { VietQrCard } from '../../lib/vietQrCard';
import { snapshotWorkbook } from '../../lib/sheetDiff';
import { WorkbookDiffModal, type DiffVersion } from './biz/WorkbookDiffModal';
import { VietnamMapModal } from './biz/VietnamMapModal';
import { MarketQuotesModal } from './biz/MarketQuotesModal';
import { WorkbookDoctorModal } from './biz/WorkbookDoctorModal';
import { PythonSandboxModal } from './biz/PythonSandboxModal';
import { diagnoseWorkbook } from '../../lib/workbookDoctor';

const ADDIN_MAX_ROWS = 300;
const ADDIN_MAX_COLS = 40;
const TAB = '\t';
const LINE_BREAK = '\n';
import {
  createUniver,
  LocaleType,
  UniverInstanceType,
  mergeLocales,
  BorderType,
  BorderStyleTypes,
  Dimension,
  ImageSourceType,
} from '@univerjs/presets';
import {
  UniverSheetsCorePreset,
  ClearSelectionContentCommand,
  IShortcutService,
  KeyCode,
  SheetsSelectionsService,
  whenSheetEditorFocused,
} from '@univerjs/preset-sheets-core';
import { EXTRA_FUNCTION_DESCRIPTIONS, EXTRA_FUNCTIONS } from './extraFunctions';
import {
  EXCEL_NUMBER_FORMATS,
  PAGE_COLUMN_STEP,
  PAGE_ROW_STEP,
  ZOOM_STEP_PCT,
  clampIndex,
  formatClockTime,
  isNumberFormatAction,
  resolveSheetShortcut,
  structureScope,
  type SheetShortcutAction,
} from './sheetShortcuts';
import {
  EMPTY_OUTLINE,
  MAX_OUTLINE_LEVEL,
  addGroup,
  collapseToLevel,
  describeGroup,
  innermostGroup,
  levelAt,
  maxLevel,
  removeGroup,
  setCollapsed,
  shiftBreaks,
  shiftGroups,
  toggleBreak,
  visibilityChanges,
  type OutlineAxis,
  type OutlineGroup,
  type SheetOutline,
} from './sheetOutline';
import {
  MACRO_CELL_KEY,
  MacroRecorder,
  decodeTarget,
  encodeTarget,
  isReplayable,
  nextMacroName,
  remapParams,
  sanitizeMacros,
  shiftBox,
  shiftParams,
  shortcutLabel,
  shortcutLetter,
  shortcutProblem,
  targetLabel,
  uniqueMacroName,
  type AppAction,
  type BuiltinMacroId,
  type MacroStep,
  type MacroTarget,
  type SheetMacro,
} from './sheetMacros';
import { VbaEditorModal } from './VbaEditorModal';
import { createExcelHost, listVbaMacros, messageBoxAnswer, runVbaMacro, vbaSources } from './vba/runVba';
import { listProcedures } from './vba/vbaInterpreter';
import { recordedMacrosToVba } from './vba/recordedToVba';
import { defaultAttributes, withProcShortcut, type VbaModuleData, type VbaProjectData } from '../../lib/vbaProject';
import { RECORDED_VBA_MODULE } from '../../lib/xlsmPackage';
import { MacroButtonModal, MacroManagerModal, MacroRecordModal, type MacroButtonColor, type MacroRecordOptions } from './SheetMacroModals';
import { BACKSPACE_CLEAR_PRIORITY, selectionCoversMultipleCells } from './backspaceClear';
import UniverPresetSheetsCoreViVN from '@univerjs/preset-sheets-core/locales/vi-VN';
import { UniverSheetsConditionalFormattingPreset, CFValueType } from '@univerjs/preset-sheets-conditional-formatting';
import UniverPresetSheetsCfViVN from '@univerjs/preset-sheets-conditional-formatting/locales/vi-VN';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDvViVN from '@univerjs/preset-sheets-data-validation/locales/vi-VN';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import UniverPresetSheetsDrawingViVN from '@univerjs/preset-sheets-drawing/locales/vi-VN';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import UniverPresetSheetsFilterViVN from '@univerjs/preset-sheets-filter/locales/vi-VN';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import UniverPresetSheetsFindViVN from '@univerjs/preset-sheets-find-replace/locales/vi-VN';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import UniverPresetSheetsLinkViVN from '@univerjs/preset-sheets-hyper-link/locales/vi-VN';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import UniverPresetSheetsNoteViVN from '@univerjs/preset-sheets-note/locales/vi-VN';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import UniverPresetSheetsSortViVN from '@univerjs/preset-sheets-sort/locales/vi-VN';

import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Save,
  HelpCircle,
  BarChart3,
  X,
  Code2,
  History,
  Bookmark,
  Trash2,
  MessageSquare,
  Share2,
  ClipboardPaste,
  Scissors,
  Copy,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Grid,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  WrapText,
  DollarSign,
  Percent,
  Sparkles,
  Image as ImageIcon,
  Split,
  Layers,
  FileCheck,
  FileSignature,
  Bot,
  Search,
  Filter,
  ArrowUpDown,
  Eraser,
  ShieldCheck,
  Check,
  Send,
  PieChart,
  TrendingUp,
  Calculator,
  CopyCheck,
  Table,
  Minimize2,
  Maximize2,
  Plus,
  Undo2,
  Redo2,
  Link2,
  StickyNote,
  Columns,
  Rows,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Play,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Upload,
  CheckSquare,
  ListFilter,
  AlertTriangle,
  RotateCw,
  Snowflake,
  FileJson,
  FileText,
  CornerDownRight,
  CornerUpRight,
  FileCode,
  Tv,
  Zap,
  Shapes,
  Omega,
  Crosshair,
  Accessibility,
  Globe,
  GitCompare,
  Terminal,
  SlidersHorizontal,
  Sigma,
  TextCursorInput,
  ArrowDownUp,
  ChartNoAxesColumn,
  TableProperties,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  QrCode,
  Database,
  Group,
  Ungroup,
  FoldVertical,
  UnfoldVertical,
  SeparatorHorizontal,
  Circle,
  Square,
  MousePointerClick,
  ListVideo,
  PencilRuler,
} from 'lucide-react';

import {
  type FileMeta,
  type SheetContent,
  type SheetPrintSettings,
  type FileVersion,
  type CommentItem,
} from '../../lib/storage';
import type { CellStyle, SheetData, WorkbookData } from '../../lib/sheetTypes';
import {
  emptyWorkbook,
  importSpreadsheet,
  exportSheetToCsv,
  exportSheetToTsv,
  exportSheetToJson,
  exportWorkbookToXlsx,
  exportWorkbookToXlsm,
  exportSingleSheetToXlsx,
  exportSheetToStyledHtml,
  renderSheetToPngBlob,
  describeImportTruncation,
} from '../../lib/xlsxConvert';
import { downloadBlob } from '../../lib/download';
import {
  DEFAULT_CELL_FONT_FAMILY,
  DEFAULT_CELL_FONT_SIZE_PT,
  keepWidestColumn,
  measureTextWithCanvas,
  requiredColumnWidthPx,
  shouldWidenColumn,
} from './autoFitColumn';
import {
  AUTOCOMPLETE_SCAN_ROWS,
  findAutoComplete,
  isRowEmptyExcept,
  looksLikeHeaderRow,
  parseEnUsMoney,
  thousandsFormatFor,
} from './sheetAutomation';
import { useUi } from '../../components/ui';
import {
  sampleWorkbook,
  payrollWorkbook,
  salesKpiWorkbook,
  inventoryWorkbook,
  cashbookWorkbook,
  projectEstimateWorkbook,
} from '../../lib/templates';
import {
  stripSpreadsheetExt,
  formatA1Cell,
  formatA1Range,
  colIndexToLetter,
  parseA1Range,
  readVietnameseMoneyWords,
  THEME_COLOR_SWATCHES,
  CELL_STYLE_PRESETS,
  TABLE_THEMES,
  WORKBOOK_THEMES,
  coerceNumeric,
  subtractRect,
  findDuplicateRowIndexes,
  groupDescendingRuns,
  extractTableRecords,
  buildPivotSheetData,
  analyzeSheetData,
  type CellStylePreset,
  type TableThemePreset,
  type WorkbookThemePreset,
  type PivotAggFn,
} from './sheetUtils';
import { shiftFormulaReferences } from './formulaShift';
import {
  FormulaLibraryModal,
  ChartStudioModal,
  PivotBuilderModal,
  ConditionalFormatModal,
  DataValidationModal,
  FindReplaceGoToModal,
  SignatureStampModal,
  NameManagerModal,
  GoalSeekModal,
  AiAuditModal,
  SplitMergeImageModal,
  TemplatesGalleryModal,
  VersionHistoryModal,
  ShareAndProtectModal,
  HelpShortcutsModal,
  type ConditionalRuleInput,
  type ValidationRuleInput,
  type DefinedNameEntry,
  type FindMatchItem,
} from './SheetModals';
import {
  FormatCellsModal,
  CustomSortModal,
  SubtotalModal,
  AdvancedFilterModal,
  DataTableModal,
  SymbolPickerModal,
  ShapeInsertModal,
  GoToSpecialModal,
  AccessibilityCheckerModal,
  type FormatCellsState,
  type SortLevel,
} from './SheetProModals';
import {
  buildSubtotalGrid,
  buildStatisticsGrid,
  buildDataTableGrid,
  buildShapeSvg,
  rasterizeSvg,
  describeColumns,
  filterRecords,
  findSpecialCells,
  cellsToRects,
  rectToA1,
  auditAccessibility,
  STAT_ROW_LABELS,
  numberFormatForValues,
  estimateColumnWidths,
  SUBTOTAL_FN_LABELS,
  SPECIAL_CELL_LABELS,
  SHAPE_LABELS,
  type AccessibilityIssue,
  type AccessibilitySheetInput,
  type FilterCriterion,
  type GridValue,
  type ShapeKind,
  type ShapeSpec,
  type SpecialCellKind,
  type SubtotalFn,
} from './sheetPro';
import { useDocumentCloser } from '../../lib/documentCloser';
import {
  VietQrModal,
  DataCleaningModal,
  FuzzyReconcileModal,
  SheetSqlModal,
  TableSlicerModal,
  slicerKey,
} from './SheetBizModals';

interface SheetEditorProps {
  meta: FileMeta;
  content: SheetContent;
  onSave: (meta: FileMeta, content: SheetContent, explicit?: boolean) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
}

type SheetRibbonTab =
  | 'file'
  | 'home'
  | 'insert'
  | 'draw'
  | 'page_layout'
  | 'formulas'
  | 'data'
  | 'review'
  | 'view'
  | 'automate'
  | 'help';

type PopoverKind =
  | 'paste'
  | 'fillColor'
  | 'fontColor'
  | 'borders'
  | 'merge'
  | 'tableTheme'
  | 'cellStyle'
  | 'insertCells'
  | 'deleteCells'
  | 'formatCells'
  | 'autosum'
  | 'fillSeries'
  | 'clearMenu'
  | 'freezeMenu'
  | 'tabColor';

interface PopoverState {
  kind: PopoverKind;
  left: number;
  top: number;
}

interface ClipboardBuffer {
  values: unknown[][];
  formulas: (string | null)[][];
  styles: (CellStyle | null)[][];
  origin: { row: number; column: number };
  cutSource?: { sheetId: string; sr: number; sc: number; er: number; ec: number };
}

interface SelectionStats {
  count: number;
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface AuditTraceItem {
  ref: string;
  row: number;
  col: number;
  endRow?: number;
  endCol?: number;
  formula?: string;
  displayValue: string;
}

export interface AuditTraceInfo {
  mode: 'precedents' | 'dependents';
  cellA1: string;
  formula: string;
  items: AuditTraceItem[];
}

export interface WatchedCellItem {
  id: string;
  sheetName: string;
  a1: string;
  row: number;
  col: number;
  label: string;
  value: string;
  formula: string;
}

const autoSumFormat = (
  fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN',
  source: { getCellStyleData: () => unknown }
): string => {
  if (fn === 'COUNT') return '#,##0';
  const pattern = (source.getCellStyleData() as CellStyle | null)?.n?.pattern;
  if (pattern && pattern !== 'General') return fn === 'AVERAGE' && pattern === '#,##0' ? '#,##0.00' : pattern;
  return fn === 'AVERAGE' ? '#,##0.00' : '#,##0';
};

const waitForRecalc = async (api: { getFormula: () => { executeCalculation: () => void; onCalculationResultApplied: (timeout?: number) => Promise<void> } | null | undefined }) => {
  const formula = api.getFormula();
  try {
    formula?.executeCalculation();
  } catch {
    void 0;
  }
  await new Promise((r) => setTimeout(r, 0));
  try {
    await formula?.onCalculationResultApplied(2500);
  } catch {
    void 0;
  }
  await new Promise((r) => setTimeout(r, 16));
};

const copyTextSafely = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

type UniverApi = ReturnType<typeof createUniver>['univerAPI'];
type ActiveWorksheet = NonNullable<ReturnType<NonNullable<ReturnType<UniverApi['getActiveWorkbook']>>['getActiveSheet']>>;

const registerBackspaceClearsSelection = (univer: ReturnType<typeof createUniver>['univer']) => {
  const injector = univer.__getInjector();
  const selections = injector.get(SheetsSelectionsService);
  injector.get(IShortcutService).registerShortcut({
    id: ClearSelectionContentCommand.id,
    binding: KeyCode.BACKSPACE,
    priority: BACKSPACE_CLEAR_PRIORITY,
    preconditions: (contextService) =>
      whenSheetEditorFocused(contextService) && selectionCoversMultipleCells(selections.getCurrentSelections()),
  });
};

const widenColumnToFitCell = (worksheet: ActiveWorksheet, row: number, column: number): boolean => {
  const cell = worksheet.getRange(row, column, 1, 1);
  if (cell.isMerged() || cell.getWrap()) return false;
  const text = cell.getDisplayValue();
  const style = cell.getCellStyleData();
  const font = {
    sizePt: style?.fs ?? DEFAULT_CELL_FONT_SIZE_PT,
    family: style?.ff ?? DEFAULT_CELL_FONT_FAMILY,
    bold: style?.bl === 1,
    italic: style?.it === 1,
  };
  const beforePx = worksheet.getColumnWidth(column);
  if (!shouldWidenColumn(text, requiredColumnWidthPx(text, font, measureTextWithCanvas), beforePx)) return false;
  worksheet.autoResizeColumns(column, 1);
  const afterPx = worksheet.getColumnWidth(column);
  if (afterPx < beforePx) worksheet.setColumnWidth(column, keepWidestColumn(beforePx, afterPx));
  return true;
};

const readColumnValues = (worksheet: ActiveWorksheet, column: number, skipRow: number): unknown[] => {
  const lastRow = Math.min(worksheet.getLastRow(), AUTOCOMPLETE_SCAN_ROWS - 1);
  if (lastRow < 0) return [];
  return worksheet
    .getRange(0, column, lastRow + 1, 1)
    .getValues()
    .map((cells) => cells[0])
    .filter((_, index) => index !== skipRow);
};

const readRowValues = (worksheet: ActiveWorksheet, row: number): unknown[] => {
  const lastColumn = worksheet.getLastColumn();
  if (lastColumn < 0) return [];
  return worksheet.getRange(row, 0, 1, lastColumn + 1).getValues()[0] ?? [];
};

interface EditSnapshot {
  key: string;
  firstDataRowWasEmpty: boolean;
}

type AutomationNotice = 'autocomplete' | 'header';

const editKey = (worksheet: ActiveWorksheet, row: number, column: number) => `${worksheet.getSheetId()}:${row}:${column}`;

const captureEditSnapshot = (worksheet: ActiveWorksheet, row: number, column: number): EditSnapshot => ({
  key: editKey(worksheet, row, column),
  firstDataRowWasEmpty: row === 1 && isRowEmptyExcept(readRowValues(worksheet, 1), -1),
});

const suggestCompletion = (worksheet: ActiveWorksheet, row: number, column: number, typed: string): string | null => {
  const completion = findAutoComplete(typed, readColumnValues(worksheet, column, row));
  return completion && completion !== typed.trim() ? completion : null;
};

const formatHeaderRow = (worksheet: ActiveWorksheet): boolean => {
  const header = readRowValues(worksheet, 0);
  if (!looksLikeHeaderRow(header) || worksheet.getFreeze().ySplit > 0) return false;
  if (header.some((_, column) => worksheet.getRange(0, column, 1, 1).getCellStyleData()?.bl === 1)) return false;
  worksheet.getRange(0, 0, 1, header.length).setFontWeight('bold');
  worksheet.setFrozenRows(1);
  header.forEach((_, column) => widenColumnToFitCell(worksheet, 0, column));
  return true;
};

const applyEditAutomation = (
  worksheet: ActiveWorksheet,
  row: number,
  column: number,
  raw: string | null,
  snapshot: EditSnapshot | null
): AutomationNotice[] => {
  const notices: AutomationNotice[] = [];
  const cell = worksheet.getRange(row, column, 1, 1);
  const money = raw === null ? null : parseEnUsMoney(raw);
  if (money !== null) {
    cell.setValue(money);
    cell.setNumberFormat('$#,##0.00');
  } else if (raw !== null && typeof cell.getValue() === 'string') {
    const completion = suggestCompletion(worksheet, row, column, raw);
    if (completion) {
      cell.setValue(completion);
      notices.push('autocomplete');
    }
  }
  const pattern = thousandsFormatFor(cell.getValue(), cell.getNumberFormat());
  if (pattern) cell.setNumberFormat(pattern);
  if (snapshot?.key === editKey(worksheet, row, column) && snapshot.firstDataRowWasEmpty && formatHeaderRow(worksheet)) {
    notices.push('header');
  }
  widenColumnToFitCell(worksheet, row, column);
  return notices;
};

const AUTOMATION_NOTICE_TEXT: Record<AutomationNotice, string> = {
  autocomplete: 'Đã tự điền theo giá trị có sẵn trong cột. Bấm Ctrl+Z nếu muốn giữ đúng chữ đã gõ.',
  header: 'Đã in đậm và cố định dòng tiêu đề.',
};

const DEFAULT_PRINT_SETTINGS: SheetPrintSettings = {
  orientation: 'landscape',
  paperSize: 'A4',
  margins: 'normal',
  fitToPage: true,
  showGridlines: true,
  printArea: '',
};

const inlineSheetStyles = (sheet: SheetData, styles: Record<string, CellStyle>): SheetData => {
  const clonedCells: SheetData['cellData'] = {};
  for (const [rKey, rowObj] of Object.entries(sheet.cellData ?? {})) {
    const r = Number(rKey);
    clonedCells[r] = {};
    for (const [cKey, cell] of Object.entries(rowObj ?? {})) {
      if (!cell) continue;
      const c = Number(cKey);
      const resolvedStyle = typeof cell.s === 'string' ? styles[cell.s] ?? null : cell.s ?? null;
      clonedCells[r][c] = {
        ...cell,
        ...(resolvedStyle ? { s: { ...resolvedStyle } } : {}),
      };
    }
  }
  return {
    ...sheet,
    cellData: clonedCells,
  };
};

type OutlineAction = 'group' | 'ungroup' | 'collapse' | 'expand' | 'clear';
const PASTE_COMMAND = /^sheet\.command\.[\w-]*paste/;
const MAX_PASTE_SNAPSHOT_CELLS = 50_000;
const MAX_VBA_OUTPUT_LINES = 500;
const CONVERTED_VBA_MODULE = 'MacroGhiLai';
export default function SheetEditor({ meta, content, onSave, onBack }: SheetEditorProps) {
  const ui = useUi();
  const { user, login } = useAccount();
  const sourceStorage = useWorkspace();
  const { listFiles, loadContent, saveFile, listVersions, restoreVersion, deleteVersion } = sourceStorage;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const importSheetInputRef = useRef<HTMLInputElement | null>(null);
  const univerRef = useRef<ReturnType<typeof createUniver>['univer'] | null>(null);
  const univerAPIRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null);
  const workbookSubsRef = useRef<Array<{ dispose: () => void }>>([]);
  const editSnapshotRef = useRef<EditSnapshot | null>(null);
  const editRawRef = useRef<string | null>(null);
  const shownNoticesRef = useRef<Set<AutomationNotice>>(new Set());
  const [autoCompleteHint, setAutoCompleteHint] = useState<string | null>(null);
  const announceAutomation = useCallback(
    (notices: AutomationNotice[]) => {
      notices.forEach((notice) => {
        if (shownNoticesRef.current.has(notice)) return;
        shownNoticesRef.current.add(notice);
        ui.toast(AUTOMATION_NOTICE_TEXT[notice]);
      });
    },
    [ui]
  );
  const announceRef = useRef(announceAutomation);
  announceRef.current = announceAutomation;
  const painterStyleRef = useRef<CellStyle | null>(null);

  const [activeTab, setActiveTab] = useState<SheetRibbonTab>('home');
  const [title, setTitle] = useState(meta.name);
  const [savedStatus, updateSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [changeVersion, setChangeVersion] = useState(0);
  const changeRevision = useRef(0);
  const setSavedStatus = useCallback((status: 'saved' | 'saving') => {
    if (status === 'saving') {
      changeRevision.current++;
      setChangeVersion(changeRevision.current);
    }
    updateSavedStatus(status);
  }, []);

  const [comments, setComments] = useState<CommentItem[]>(() => content.comments ?? []);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentCell, setNewCommentCell] = useState('A1');
  const [replyText, setReplyText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  const [printSettings, setPrintSettings] = useState<SheetPrintSettings>(
    () => content.printSettings ?? DEFAULT_PRINT_SETTINGS
  );

  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [clipboardBuf, setClipboardBuf] = useState<ClipboardBuffer | null>(null);
  const [painterArmed, setPainterArmed] = useState(false);

  const [activeSheetName, setActiveSheetName] = useState('Sheet1');
  const [activeCellA1, setActiveCellA1] = useState('A1');
  const [activeRangeA1, setActiveRangeA1] = useState('A1');
  const [nameBoxText, setNameBoxText] = useState('A1');
  const [outlines, setOutlines] = useState<Record<string, SheetOutline>>(() => content.outlines ?? {});
  const [macros, setMacros] = useState<SheetMacro[]>(() => sanitizeMacros(content.macros ?? content.workbook.automation?.macros));
  const macrosRef = useRef(macros);
  macrosRef.current = macros;
  const [vbaProject, setVbaProject] = useState<VbaProjectData | null>(() => content.vba ?? content.workbook.vba ?? null);
  const vbaProjectRef = useRef(vbaProject);
  vbaProjectRef.current = vbaProject;
  const vbaMacros = useMemo(() => listVbaMacros(vbaProject), [vbaProject]);
  const vbaMacrosRef = useRef(vbaMacros);
  vbaMacrosRef.current = vbaMacros;
  const [vbaOutput, setVbaOutput] = useState<string[]>([]);
  const [vbaEditorModule, setVbaEditorModule] = useState<string | undefined>(undefined);
  const [designMode, setDesignMode] = useState(false);
  const designModeRef = useRef(false);
  designModeRef.current = designMode;
  const suppressRecordRef = useRef(0);
  const outlinesRef = useRef(outlines);
  outlinesRef.current = outlines;
  const printSettingsRef = useRef(printSettings);
  printSettingsRef.current = printSettings;
  const runVbaRef = useRef<(id: string) => void>(() => undefined);
  const openVbaEditorRef = useRef<() => void>(() => undefined);
  const pasteSnapshotRef = useRef<(recorder: MacroRecorder, step: MacroStep) => void>(() => undefined);
  const [recordedCount, setRecordedCount] = useState<number | null>(null);
  const recorderRef = useRef<MacroRecorder | null>(null);
  const recordMetaRef = useRef<(MacroRecordOptions & { origin: { row: number; column: number } }) | null>(null);
  const isReplayingRef = useRef(false);
  const runMacroRef = useRef<(macro: SheetMacro) => void>(() => undefined);
  const cellClickRef = useRef<(row: number, column: number) => void>(() => undefined);
  const [activeSheetId, setActiveSheetId] = useState('');
  const activeOutline = outlines[activeSheetId] ?? EMPTY_OUTLINE;
  const activePageBreakCount = printSettings.pageBreaks?.[activeSheetId]?.length ?? 0;
  const [formulaBarText, setFormulaBarText] = useState('');
  const formulaBarFocusedRef = useRef(false);
  const [selectedFont, setSelectedFont] = useState(DEFAULT_CELL_FONT_FAMILY);
  const [selectedFontSize, setSelectedFontSize] = useState('11');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [fillColor, setFillColor] = useState('#fef08a');
  const [fontColor, setFontColor] = useState('#dc2626');
  const [borderColor, setBorderColor] = useState('#0f172a');
  const [hAlign, setHAlign] = useState<'left' | 'center' | 'normal' | 'general'>('general');
  const [vAlign, setVAlign] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [isWrap, setIsWrap] = useState(false);
  const [isMerged, setIsMerged] = useState(false);
  const [selectedNumberFormat, setSelectedNumberFormat] = useState('General');
  const [hasFilter, setHasFilter] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [isProtected, setIsProtected] = useState(false);
  const [cfRuleCount, setCfRuleCount] = useState(0);
  const [definedNames, setDefinedNames] = useState<DefinedNameEntry[]>([]);
  const [auditTrace, setAuditTrace] = useState<AuditTraceInfo | null>(null);
  const [showFormulasMode, setShowFormulasMode] = useState(false);
  const [showWatchWindow, setShowWatchWindow] = useState(false);
  const [watchList, setWatchList] = useState<WatchedCellItem[]>(() => {
    try {
      const stored = localStorage.getItem(`sheet-watch-${meta.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const watchListRef = useRef(watchList);
  useEffect(() => {
    watchListRef.current = watchList;
  }, [watchList]);

  const [selStats, setSelStats] = useState<SelectionStats>({
    count: 0,
    numericCount: 0,
    sum: 0,
    avg: 0,
    min: 0,
    max: 0,
  });

  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [workspaceSheets, setWorkspaceSheets] = useState<FileMeta[]>([]);

  type SheetModalKind =
    | null
    | 'macroRecord'
    | 'macros'
    | 'macroButton'
    | 'vba'
    | 'formulas'
    | 'chart'
    | 'pivot'
    | 'cf'
    | 'dv'
    | 'find'
    | 'goto'
    | 'signature'
    | 'pageSetup'
    | 'nameManager'
    | 'goalSeek'
    | 'aiAnalysis'
    | 'aiAudit'
    | 'aiAssistant'
    | 'split'
    | 'merge'
    | 'image'
    | 'templates'
    | 'history'
    | 'share'
    | 'formatCells'
    | 'customSort'
    | 'subtotal'
    | 'advFilter'
    | 'dataTable'
    | 'symbol'
    | 'shape'
    | 'gotoSpecial'
    | 'a11y'
    | 'help'
    | 'vietqr'
    | 'dataCleaning'
    | 'fuzzyReconcile'
    | 'sheetSql'
    | 'workbookDoctor'
    | 'marketQuotes'
    | 'choropleth'
    | 'workbookDiff'
    | 'pythonSandbox'
    | 'slicer';

  const [modal, setModalState] = useState<SheetModalKind>(null);
  const [doctorData, setDoctorData] = useState<ReturnType<typeof diagnoseWorkbook> | null>(null);
  const [diffData, setDiffData] = useState<{ sheets: ReturnType<typeof snapshotWorkbook>; versions: DiffVersion[] } | null>(null);
  const [proTable, setProTable] = useState<{
    a1: string;
    parsed: NonNullable<ReturnType<typeof parseA1Range>>;
    headers: string[];
    rows: GridValue[][];
    numericColumns: number[];
    formats: (string | null)[];
  } | null>(null);
  const [formatCellsInit, setFormatCellsInit] = useState<{ state: FormatCellsState; sample: unknown } | null>(null);
  const [a11yIssues, setA11yIssues] = useState<AccessibilityIssue[]>([]);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rounded');
  const [gotoScope, setGotoScope] = useState<{ startRow: number; startColumn: number; endRow: number; endColumn: number } | null>(null);
  const [modalSmartRange, setModalSmartRange] = useState('A1:F8');
  const [modalActiveSheetId, setModalActiveSheetId] = useState(() => content.workbook.sheetOrder[0] || 'sheet-1');
  const [pivotSourceInfo, setPivotSourceInfo] = useState<{ range: string; headers: string[]; rowCount: number }>({
    range: 'A1:F8',
    headers: [],
    rowCount: 0,
  });
  const [liveSnapshotForModal, setLiveSnapshotForModal] = useState<WorkbookData>(() => content.workbook);
  const [liveAnalysisForModal, setLiveAnalysisForModal] = useState(() => analyzeSheetData('Sheet1', [], [], 0, 0));

  const openPopover = (e: React.MouseEvent<HTMLElement>, kind: PopoverKind) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - 250, rect.left));
    const top = Math.min(window.innerHeight - 120, rect.bottom + 4);
    setPopover((prev) => (prev?.kind === kind ? null : { kind, left, top }));
  };

  const getActiveContext = useCallback(() => {
    const api = univerAPIRef.current;
    if (!api) return null;
    const fWorkbook = api.getActiveWorkbook();
    if (!fWorkbook) return null;
    const fWorksheet = fWorkbook.getActiveSheet();
    if (!fWorksheet) return null;
    const fSelection = fWorksheet.getSelection();
    const fRange = fSelection?.getActiveRange() ?? fWorksheet.getRange(0, 0, 1, 1);
    return { api, fWorkbook, fWorksheet, fRange };
  }, []);

  const isProtectedRef = useRef(false);
  const isCellEditingRef = useRef(false);
  const getEditableContext = useCallback(() => {
    if (isProtectedRef.current) {
      ui.toast('Bảng tính đang khoá bảo vệ (chỉ đọc). Vào Review → Mở khoá Sheet để chỉnh sửa.', true);
      return null;
    }
    return getActiveContext();
  }, [getActiveContext, ui]);

  const pendingFormulaEdit = useRef<{ text: string; context: ReturnType<typeof getEditableContext> } | null>(null);

  const syncDefinedNames = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    try {
      const list = ctx.fWorkbook.getDefinedNames() ?? [];
      setDefinedNames(
        list.map((dn) => ({
          id: dn.getName(),
          name: dn.getName(),
          formulaOrRef: dn.getFormulaOrRefString(),
        }))
      );
    } catch {
      setDefinedNames([]);
    }
  }, [getActiveContext]);

  const applyStyleObjectToRange = useCallback(
    (targetRange: NonNullable<ReturnType<typeof getActiveContext>>['fRange'], st: CellStyle) => {
      if (st.ff) targetRange.setFontFamily(st.ff);
      if (st.fs) targetRange.setFontSize(st.fs);
      targetRange.setFontWeight(st.bl ? 'bold' : 'normal');
      targetRange.setFontStyle(st.it ? 'italic' : 'normal');
      if (st.ul?.s) targetRange.setFontLine('underline');
      else if (st.st?.s) targetRange.setFontLine('line-through');
      else targetRange.setFontLine('none');
      if (st.bg?.rgb) targetRange.setBackgroundColor(st.bg.rgb);
      if (st.cl?.rgb) targetRange.setFontColor(st.cl.rgb);
      if (st.ht === 1) targetRange.setHorizontalAlignment('left');
      else if (st.ht === 2) targetRange.setHorizontalAlignment('center');
      else if (st.ht === 3) targetRange.setHorizontalAlignment('normal');
      if (st.vt === 1) targetRange.setVerticalAlignment('top');
      else if (st.vt === 2) targetRange.setVerticalAlignment('middle');
      else if (st.vt === 3) targetRange.setVerticalAlignment('bottom');
      targetRange.setWrap(st.tb === 3);
      if (st.n?.pattern) targetRange.setNumberFormat(st.n.pattern);
    },
    []
  );

  const syncUiFromSelection = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const { fWorkbook, fWorksheet, fRange } = ctx;
    try {
      const rawRange = fRange.getRange();
      const cellA1 = formatA1Cell(rawRange.startRow, rawRange.startColumn);
      const fullA1 = formatA1Range(rawRange.startRow, rawRange.startColumn, rawRange.endRow, rawRange.endColumn);
      setActiveSheetName(fWorksheet.getSheetName());
      setActiveSheetId(fWorksheet.getSheetId());
      setActiveCellA1(cellA1);
      setActiveRangeA1(fullA1);
      setNameBoxText(fullA1);
      setNewCommentCell(fullA1);

      if (!formulaBarFocusedRef.current && !pendingFormulaEdit.current) {
        const topLeft = fWorksheet.getRange(rawRange.startRow, rawRange.startColumn, 1, 1);
        const fStr = topLeft.getFormula();
        const rawV = topLeft.getRawValue();
        setFormulaBarText(fStr || (rawV === null || rawV === undefined ? '' : String(rawV)));
      }

      if (painterStyleRef.current) {
        const st = painterStyleRef.current;
        painterStyleRef.current = null;
        setPainterArmed(false);
        applyStyleObjectToRange(fRange, st);
      }

      const styleData = fRange.getCellStyleData() as CellStyle | null;
      setSelectedFont(styleData?.ff || DEFAULT_CELL_FONT_FAMILY);
      setSelectedFontSize(String(styleData?.fs || 11));
      setIsBold(Boolean(styleData?.bl));
      setIsItalic(Boolean(styleData?.it));
      setIsUnderline(Boolean(styleData?.ul?.s));
      setIsStrike(Boolean(styleData?.st?.s));
      setHAlign(fRange.getHorizontalAlignment() as typeof hAlign);
      setVAlign(fRange.getVerticalAlignment() as typeof vAlign);
      setIsWrap(Boolean(fRange.getWrap()));
      setIsMerged(Boolean(fRange.isMerged() || fRange.isPartOfMerge()));
      const nf = styleData?.n?.pattern || 'General';
      setSelectedNumberFormat(nf);

      setHasFilter(Boolean(fWorksheet.getFilter()));
      const frz = fWorksheet.getFreeze();
      setIsFrozen(Boolean(frz && ((frz.xSplit ?? 0) > 0 || (frz.ySplit ?? 0) > 0)));
      setShowGridlines(!fWorksheet.hasHiddenGridLines());
      setZoomPct(Math.round((fWorksheet.getZoom() || 1) * 100));
      setCfRuleCount((fWorksheet.getConditionalFormattingRules() ?? []).length);

      const maxRows = Math.min(200, rawRange.endRow - rawRange.startRow + 1);
      const maxCols = Math.min(50, rawRange.endColumn - rawRange.startColumn + 1);
      const statRange = fWorksheet.getRange(rawRange.startRow, rawRange.startColumn, maxRows, maxCols);
      const vals = statRange.getRawValues();
      let count = 0;
      let numericCount = 0;
      let sum = 0;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const row of vals) {
        for (const v of row) {
          if (v !== null && v !== undefined && v !== '') {
            count += 1;
            const n = typeof v === 'number' && Number.isFinite(v) ? v : coerceNumeric(v);
            if (n !== null) {
              numericCount += 1;
              sum += n;
              if (n < min) min = n;
              if (n > max) max = n;
            }
          }
        }
      }
      setSelStats({
        count,
        numericCount,
        sum,
        avg: numericCount > 0 ? sum / numericCount : 0,
        min: numericCount > 0 ? min : 0,
        max: numericCount > 0 ? max : 0,
      });

      if (watchListRef.current.length > 0) {
        setWatchList((prev) =>
          prev.map((w) => {
            try {
              const targetSheet = fWorkbook.getSheetByName(w.sheetName) || fWorksheet;
              const cellRange = targetSheet.getRange(w.row, w.col, 1, 1);
              const v = cellRange.getValue();
              const f = cellRange.getFormula();
              return {
                ...w,
                value: v === null || v === undefined ? '(Trống)' : String(v),
                formula: f || '',
              };
            } catch {
              return w;
            }
          })
        );
      }
    } catch {
      return;
    }
  }, [getActiveContext, applyStyleObjectToRange]);

  const captureHydratedWorkbook = useCallback((): WorkbookData => {
    const api = univerAPIRef.current;
    if (!api) return content.workbook;
    const fWorkbook = api.getActiveWorkbook();
    if (!fWorkbook) return content.workbook;
    const rawSnapshot = JSON.parse(JSON.stringify(fWorkbook.save())) as WorkbookData;
    for (const fSheet of fWorkbook.getSheets()) {
      const sid = fSheet.getSheetId();
      const targetSheet = rawSnapshot.sheets[sid];
      if (!targetSheet?.cellData) continue;
      let maxR = -1;
      let maxC = -1;
      for (const [rk, cols] of Object.entries(targetSheet.cellData)) {
        const r = Number(rk);
        if (!Number.isFinite(r) || r > 1500) continue;
        for (const [ck, cell] of Object.entries(cols ?? {})) {
          const c = Number(ck);
          if (!Number.isFinite(c) || c > 150) continue;
          if (cell && (cell.f || cell.v !== undefined)) {
            if (r > maxR) maxR = r;
            if (c > maxC) maxC = c;
          }
        }
      }
      if (maxR >= 0 && maxC >= 0) {
        try {
          const liveVals = fSheet.getRange(0, 0, maxR + 1, maxC + 1).getRawValues();
          for (let r = 0; r <= maxR; r++) {
            const rowObj = targetSheet.cellData[r];
            if (!rowObj) continue;
            for (let c = 0; c <= maxC; c++) {
              const cell = rowObj[c];
              const v = liveVals[r]?.[c];
              if (cell && cell.f && v !== undefined && v !== null) {
                cell.v = v as string | number | boolean;
                if (typeof v === 'number') cell.t = 2;
                else if (typeof v === 'boolean') cell.t = 3;
                else cell.t = 1;
              }
            }
          }
        } catch {
          continue;
        }
      }
    }
    return rawSnapshot;
  }, [content.workbook]);

  const persistWorkbook = useCallback(async (explicit = false) => {
    const savedRevision = changeRevision.current;
    try {
      const snapshot = captureHydratedWorkbook();
      const updatedMeta: FileMeta = {
        ...meta,
        name: title.trim() || meta.name,
        updatedAt: Date.now(),
      };
      const saved = await onSave(updatedMeta, {
        kind: 'sheet',
        workbook: snapshot,
        comments,
        printSettings,
        outlines,
        macros,
        vba: vbaProject ?? undefined,
      }, explicit);
      if (saved) {
        if (changeRevision.current === savedRevision) setSavedStatus('saved');
        if (explicit) ui.toast('Đã lưu bảng tính');
      }
      return saved;
    } catch (err) {
      console.error('Failed to save workbook:', err);
      ui.toast('Chưa lưu được bản nháp. Vui lòng giữ trang này mở và thử lại.', true);
      return false;
    }
  }, [setSavedStatus, captureHydratedWorkbook, meta, title, onSave, comments, printSettings, outlines, macros, vbaProject, ui]);

  const handleSaveNow = useCallback(() => void persistWorkbook(true), [persistWorkbook]);

  const recalculateAndBindWorkbook = useCallback(
    (api: ReturnType<typeof createUniver>['univerAPI']) => {
      workbookSubsRef.current.forEach((sub) => {
        try {
          sub.dispose();
        } catch {
          void 0;
        }
      });
      workbookSubsRef.current = [];

      const fWb = api.getActiveWorkbook();
      if (fWb) {
        const selectionSub = fWb.onSelectionChange(() => {
          syncUiFromSelection();
        });
        const commandSub = fWb.onCommandExecuted((cmd) => {
          const id = cmd.id || '';
          const isSheetSwitch = id.includes('set-worksheet-activ');
          if (
            !isSheetSwitch &&
            !id.includes('set-selections') &&
            (id.includes('mutation') ||
            id.includes('set-') ||
            id.includes('insert-') ||
            id.includes('remove-') ||
            id.includes('delete-') ||
            id.includes('merge') ||
            id.includes('sort') ||
            id.includes('filter') ||
            id.includes('validation') ||
            id.includes('conditional'))
          ) {
            setSavedStatus('saving');
          }
          if (isSheetSwitch || id.includes('active-sheet') || id.includes('set-style') || id.includes('zoom') || id.includes('freeze') || id.includes('gridlines')) {
            setTimeout(() => syncUiFromSelection(), 20);
          }
        });
        const editStartSub = api.addEvent(api.Event.SheetEditStarted, ({ worksheet, row, column }) => {
          isCellEditingRef.current = true;
          try {
            editSnapshotRef.current = captureEditSnapshot(worksheet, row, column);
          } catch {
            editSnapshotRef.current = null;
          }
        });
        const editChangingSub = api.addEvent(api.Event.SheetEditChanging, ({ worksheet, row, column, value }) => {
          try {
            setAutoCompleteHint(suggestCompletion(worksheet, row, column, value.toPlainText()));
          } catch {
            setAutoCompleteHint(null);
          }
        });
        const beforeEditEndSub = api.addEvent(api.Event.BeforeSheetEditEnd, ({ value, isConfirm }) => {
          editRawRef.current = isConfirm ? value.toPlainText().replace(/\r?\n$/, '') : null;
        });
        const editEndSub = api.addEvent(api.Event.SheetEditEnded, (params) => {
          isCellEditingRef.current = false;
          setAutoCompleteHint(null);
          const raw = editRawRef.current;
          const snapshot = editSnapshotRef.current;
          editRawRef.current = null;
          editSnapshotRef.current = null;
          if (!params.isConfirm) return;
          const { worksheet, row, column } = params;
          setTimeout(() => {
            if (univerAPIRef.current !== api) return;
            try {
              announceRef.current(applyEditAutomation(worksheet, row, column, raw, snapshot));
            } catch (err) {
              console.warn('Auto-fit column after edit failed:', err);
            }
          }, 0);
        });
        const macroBeforeSub = api.addEvent(api.Event.BeforeCommandExecute, (event) => {
          if (!isReplayingRef.current && !suppressRecordRef.current) recorderRef.current?.before(event);
        });
        const macroAfterSub = api.addEvent(api.Event.CommandExecuted, (event) => {
          const recorder = recorderRef.current;
          if (!recorder || isReplayingRef.current || suppressRecordRef.current) return;
          const step = recorder.executed(event, api.getActiveWorkbook()?.getActiveSheet()?.getSheetId() ?? '');
          if (step?.kind === 'command' && PASTE_COMMAND.test(step.id)) setTimeout(() => pasteSnapshotRef.current(recorder, step), 0);
          setRecordedCount(recorder.count);
        });
        const macroClickSub = api.addEvent(api.Event.CellClicked, ({ row, column }) => cellClickRef.current(row, column));
        workbookSubsRef.current.push(selectionSub, commandSub, editStartSub, editChangingSub, beforeEditEndSub, editEndSub, macroBeforeSub, macroAfterSub, macroClickSub);
      }

      try {
        const formulaEngine = api.getFormula();
        if (formulaEngine) {
          const calcSub = formulaEngine.calculationEnd(() => {
            syncUiFromSelection();
          });
          workbookSubsRef.current.push(calcSub);
          formulaEngine.executeCalculation();
          setTimeout(() => {
            if (univerAPIRef.current !== api) return;
            try {
              formulaEngine.executeCalculation();
            } catch {
              void 0;
            }
          }, 50);
        }
      } catch {
        void 0;
      }
    },
    [setSavedStatus, syncUiFromSelection]
  );

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const mountEl = document.createElement('div');
    mountEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;';
    host.appendChild(mountEl);

    let instanceToDispose: ReturnType<typeof createUniver>['univer'] | null = null;
    let cancelled = false;

    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.VI_VN,
        locales: {
          [LocaleType.VI_VN]: mergeLocales(
            UniverPresetSheetsCoreViVN,
            UniverPresetSheetsCfViVN,
            UniverPresetSheetsDvViVN,
            UniverPresetSheetsDrawingViVN,
            UniverPresetSheetsFilterViVN,
            UniverPresetSheetsFindViVN,
            UniverPresetSheetsLinkViVN,
            UniverPresetSheetsNoteViVN,
            UniverPresetSheetsSortViVN
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: mountEl,
            header: false,
            toolbar: false,
            formulaBar: true,
            formula: {
              function: EXTRA_FUNCTIONS,
              description: EXTRA_FUNCTION_DESCRIPTIONS,
            },
            footer: {
              sheetBar: true,
              statisticBar: false,
              menus: true,
              zoomSlider: false,
            },
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsConditionalFormattingPreset(),
          UniverSheetsDataValidationPreset(),
          UniverSheetsDrawingPreset(),
          UniverSheetsFindReplacePreset(),
          UniverSheetsHyperLinkPreset(),
          UniverSheetsNotePreset(),
        ],
      });

      instanceToDispose = univer;
      univerRef.current = univer;
      univerAPIRef.current = univerAPI;
      const clonedWb = JSON.parse(JSON.stringify(content.workbook)) as WorkbookData;
      const truncationNotice = describeImportTruncation(clonedWb.importTruncation);
      delete clonedWb.importTruncation;
      const vbaNotice = clonedWb.vbaError ? `Tệp có mã VBA nhưng Minh Sheets chưa đọc được (${clonedWb.vbaError}). Dữ liệu bảng vẫn mở bình thường.` : '';
      delete clonedWb.vba;
      delete clonedWb.vbaError;
      delete clonedWb.automation;
      univer.createUnit(UniverInstanceType.UNIVER_SHEET, clonedWb);
      registerBackspaceClearsSelection(univer);
      recalculateAndBindWorkbook(univerAPI);

      setTimeout(() => {
        if (cancelled) return;
        syncUiFromSelection();
        syncDefinedNames();
        if (truncationNotice) ui.toast(truncationNotice, true);
        if (vbaNotice) ui.toast(vbaNotice, true);
      }, 140);
    } catch (err) {
      console.error('Failed to initialize Univer:', err);
    }

    return () => {
      cancelled = true;
      mountEl.style.display = 'none';
      mountEl.style.pointerEvents = 'none';
      workbookSubsRef.current.forEach((sub) => {
        try {
          sub.dispose();
        } catch {
          void 0;
        }
      });
      workbookSubsRef.current = [];
      univerRef.current = null;
      univerAPIRef.current = null;
      if (instanceToDispose) {
        const refToClean = instanceToDispose;
        setTimeout(() => {
          try {
            refToClean.dispose();
          } catch {
            void 0;
          } finally {
            mountEl.remove();
          }
        }, 0);
      } else {
        mountEl.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (savedStatus !== 'saving') return;
    const timer = setTimeout(() => {
      void persistWorkbook(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [savedStatus, persistWorkbook, changeVersion]);

  useEffect(() => {
    if (savedStatus === 'saved') return;
    const flush = () => { void persistWorkbook(false); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      event.preventDefault();
      event.returnValue = '';
    };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [savedStatus, persistWorkbook]);

  const getSmartDataRangeA1 = useCallback((): string => {
    const ctx = getActiveContext();
    if (!ctx) return 'A1:F8';
    const raw = ctx.fRange.getRange();
    if (raw.endRow > raw.startRow || raw.endColumn > raw.startColumn) {
      return formatA1Range(raw.startRow, raw.startColumn, raw.endRow, raw.endColumn);
    }
    const snap = ctx.fWorkbook.save() as unknown as WorkbookData;
    const sh = snap.sheets[ctx.fWorksheet.getSheetId()];
    if (!sh?.cellData) return 'A1:F8';
    let minR = Number.POSITIVE_INFINITY;
    let maxR = -1;
    let minC = Number.POSITIVE_INFINITY;
    let maxC = -1;
    for (const [rk, rowObj] of Object.entries(sh.cellData)) {
      const r = Number(rk);
      if (!Number.isFinite(r) || r > 500) continue;
      for (const [ck, cell] of Object.entries(rowObj ?? {})) {
        const c = Number(ck);
        if (!Number.isFinite(c) || c > 60) continue;
        if (cell && (cell.v !== undefined && cell.v !== null && cell.v !== '' || cell.f)) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
    if (maxR < 0 || maxC < 0) return 'A1:F8';
    const mergeSet = sh.mergeData ?? [];
    if (minR === 0 && mergeSet.some((m) => m.startRow === 0 && m.endRow === 0 && m.endColumn >= 2) && maxR >= 2) {
      minR = 1;
    }
    return formatA1Range(minR, minC, maxR, maxC);
  }, [getActiveContext]);

  const addinHost = useMemo(() => {
    const gridText = (startRow: number, startCol: number, values: unknown[][], formulas: string[][]) => {
      const rows = values.slice(0, ADDIN_MAX_ROWS);
      const width = Math.min(ADDIN_MAX_COLS, Math.max(0, ...rows.map((row) => row.length)));
      const header = ['', ...Array.from({ length: width }, (_, c) => colIndexToLetter(startCol + c))].join(TAB);
      const body = rows.map((row, r) => [String(startRow + r + 1), ...Array.from({ length: width }, (_, c) => {
        const formula = formulas[r]?.[c];
        const value = row[c] ?? '';
        return formula ? `${String(value)} {${formula}}` : String(value);
      })].join(TAB));
      return [header, ...body].join(LINE_BREAK);
    };
    const readA1 = (a1: string) => {
      const ctx = getActiveContext();
      const parsed = parseA1Range(a1);
      if (!ctx || !parsed) return '';
      const range = ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, Math.min(ADDIN_MAX_ROWS, parsed.endRow - parsed.startRow + 1), Math.min(ADDIN_MAX_COLS, parsed.endColumn - parsed.startColumn + 1));
      return gridText(parsed.startRow, parsed.startColumn, range.getRawValues() as unknown[][], range.getFormulas());
    };
    const selectionA1 = () => {
      const raw = getActiveContext()?.fRange.getRange();
      return raw ? formatA1Range(raw.startRow, raw.startColumn, raw.endRow, raw.endColumn) : 'A1';
    };
    return sheetHost({
      sheetName: () => getActiveContext()?.fWorksheet.getSheetName() ?? 'Sheet1',
      selectionA1,
      readSelection: () => readA1(selectionA1()),
      readSheet: () => {
        const ctx = getActiveContext();
        if (!ctx) return '';
        const snap = ctx.fWorkbook.save() as unknown as WorkbookData;
        const cells = snap.sheets[ctx.fWorksheet.getSheetId()]?.cellData ?? {};
        let maxR = -1;
        let maxC = -1;
        for (const [rk, rowObj] of Object.entries(cells)) {
          for (const [ck, cell] of Object.entries(rowObj ?? {})) {
            if (!cell || ((cell.v === undefined || cell.v === null || cell.v === '') && !cell.f)) continue;
            maxR = Math.max(maxR, Number(rk));
            maxC = Math.max(maxC, Number(ck));
          }
        }
        return maxR < 0 ? '(empty sheet)' : readA1(formatA1Range(0, 0, maxR, maxC));
      },
      writeTable: (rows) => {
        const ctx = getEditableContext();
        if (!ctx || !rows.length) return 'Không ghi được';
        const raw = ctx.fRange.getRange();
        const width = Math.max(...rows.map((row) => row.length));
        const normalized = rows.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? ''));
        ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, normalized.length, width).setValues(normalized);
        setSavedStatus('saving');
        syncUiFromSelection();
        return `Đã ghi ${normalized.length}×${width} ô từ ${formatA1Cell(raw.startRow, raw.startColumn)}`;
      },
      writeFormula: (formula) => {
        const ctx = getEditableContext();
        if (!ctx) return 'Không ghi được';
        const raw = ctx.fRange.getRange();
        ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, 1, 1).setValue(formula);
        setSavedStatus('saving');
        syncUiFromSelection();
        return `Đã đặt vào ${formatA1Cell(raw.startRow, raw.startColumn)}`;
      },
    }, title);
  }, [getActiveContext, getEditableContext, setSavedStatus, syncUiFromSelection, title]);

  const readRangeValuesByA1 = useCallback(
    (rangeA1: string): unknown[][] => {
      const ctx = getActiveContext();
      if (!ctx) return [];
      const parsed = parseA1Range(rangeA1);
      if (!parsed) return [];
      const targetSheet = parsed.sheetName
        ? ctx.fWorkbook.getSheetByName(parsed.sheetName) ?? ctx.fWorksheet
        : ctx.fWorksheet;
      const numRows = Math.max(1, parsed.endRow - parsed.startRow + 1);
      const numCols = Math.max(1, parsed.endColumn - parsed.startColumn + 1);
      try {
        return targetSheet.getRange(parsed.startRow, parsed.startColumn, numRows, numCols).getRawValues();
      } catch {
        return [];
      }
    },
    [getActiveContext]
  );

  const computeLiveAnalysis = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) {
      return analyzeSheetData('Sheet1', [], [], 0, 0);
    }
    const snap = ctx.fWorkbook.save() as unknown as WorkbookData;
    const sh = snap.sheets[ctx.fWorksheet.getSheetId()];
    let maxR = 20;
    let maxC = 10;
    for (const [rk, rowObj] of Object.entries(sh?.cellData ?? {})) {
      const r = Number(rk);
      if (Number.isFinite(r) && r < 600 && r > maxR) maxR = r;
      for (const ck of Object.keys(rowObj ?? {})) {
        const c = Number(ck);
        if (Number.isFinite(c) && c < 80 && c > maxC) maxC = c;
      }
    }
    const checkRange = ctx.fWorksheet.getRange(0, 0, maxR + 1, maxC + 1);
    return analyzeSheetData(
      ctx.fWorksheet.getSheetName(),
      checkRange.getRawValues(),
      checkRange.getFormulas(),
      0,
      0
    );
  }, [getActiveContext]);

  const setModal = useCallback(
    (next: SheetModalKind) => {
      if (next === 'chart') {
        setModalSmartRange(getSmartDataRangeA1());
      } else if (next === 'pivot') {
        const r = getSmartDataRangeA1();
        const raw = readRangeValuesByA1(r);
        const { headers, rows } = extractTableRecords(raw);
        setPivotSourceInfo({ range: r, headers, rowCount: rows.length });
      } else if (next === 'pageSetup' || next === 'split' || next === 'merge' || next === 'image') {
        const snap = captureHydratedWorkbook();
        setLiveSnapshotForModal(snap);
        setModalActiveSheetId(getActiveContext()?.fWorksheet.getSheetId() || snap.sheetOrder[0] || 'sheet-1');
      } else if (next === 'aiAnalysis' || next === 'aiAudit' || next === 'aiAssistant') {
        setLiveAnalysisForModal(computeLiveAnalysis());
      }
      setModalState(next);
    },
    [getSmartDataRangeA1, readRangeValuesByA1, captureHydratedWorkbook, getActiveContext, computeLiveAnalysis]
  );

  const handleCopyOrCut = useCallback(
    async (isCut: boolean) => {
      const ctx = isCut ? getEditableContext() : getActiveContext();
      if (!ctx) return;
      const raw = ctx.fRange.getRange();
      const values = ctx.fRange.getRawValues();
      const formulas = ctx.fRange.getFormulas();
      const rows = raw.endRow - raw.startRow + 1;
      const cols = raw.endColumn - raw.startColumn + 1;
      const styles: (CellStyle | null)[][] = [];
      for (let r = 0; r < rows; r++) {
        const rowStyles: (CellStyle | null)[] = [];
        for (let c = 0; c < cols; c++) {
          const cellRange = ctx.fWorksheet.getRange(raw.startRow + r, raw.startColumn + c, 1, 1);
          rowStyles.push((cellRange.getCellStyleData() as CellStyle | null) ?? null);
        }
        styles.push(rowStyles);
      }
      setClipboardBuf({
        values,
        formulas,
        styles,
        origin: { row: raw.startRow, column: raw.startColumn },
        cutSource: isCut
          ? {
              sheetId: ctx.fWorksheet.getSheetId(),
              sr: raw.startRow,
              sc: raw.startColumn,
              er: raw.endRow,
              ec: raw.endColumn,
            }
          : undefined,
      });
      const tsv = values.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))).join('\t')).join('\n');
      try {
        await navigator.clipboard.writeText(tsv);
      } catch {
        void 0;
      }
      ui.toast(isCut ? `Đã cắt vùng ${activeRangeA1}` : `Đã sao chép vùng ${activeRangeA1}`);
    },
    [getActiveContext, getEditableContext, activeRangeA1, ui]
  );

  const handlePasteMode = useCallback(
    async (mode: 'all' | 'values' | 'formulas' | 'formats' | 'transpose') => {
      setPopover(null);
      const ctx = getEditableContext();
      if (!ctx) return;
      const dest = ctx.fRange.getRange();

      if (clipboardBuf) {
        const srcRows = clipboardBuf.values.length;
        const srcCols = Math.max(1, ...clipboardBuf.values.map((r) => r.length));
        const outRows = mode === 'transpose' ? srcCols : srcRows;
        const outCols = mode === 'transpose' ? srcRows : srcCols;
        const isMove = Boolean(clipboardBuf.cutSource) && (mode === 'all' || mode === 'transpose');

        for (let r = 0; r < outRows; r++) {
          for (let c = 0; c < outCols; c++) {
            const sr = mode === 'transpose' ? c : r;
            const sc = mode === 'transpose' ? r : c;
            const targetRow = dest.startRow + r;
            const targetColumn = dest.startColumn + c;
            const targetCell = ctx.fWorksheet.getRange(targetRow, targetColumn, 1, 1);
            const sourceFormula = clipboardBuf.formulas[sr]?.[sc];
            const f = sourceFormula && !isMove
              ? shiftFormulaReferences(sourceFormula, targetRow - (clipboardBuf.origin.row + sr), targetColumn - (clipboardBuf.origin.column + sc))
              : sourceFormula;
            const v = clipboardBuf.values[sr]?.[sc];
            const st = clipboardBuf.styles[sr]?.[sc];

            if (mode === 'all' || mode === 'transpose') {
              if (f) targetCell.setValue(f);
              else targetCell.setValue((v as string | number | boolean) ?? '');
              if (st) applyStyleObjectToRange(targetCell, st);
            } else if (mode === 'values') {
              targetCell.setValue((v as string | number | boolean) ?? '');
            } else if (mode === 'formulas') {
              if (f) targetCell.setValue(f);
              else targetCell.setValue((v as string | number | boolean) ?? '');
            } else if (mode === 'formats' && st) {
              applyStyleObjectToRange(targetCell, st);
            }
          }
        }

        if (clipboardBuf.cutSource) {
          const cutSheet = ctx.fWorkbook.getSheetBySheetId(clipboardBuf.cutSource.sheetId);
          if (cutSheet && isMove) {
            const { sr, sc, er, ec } = clipboardBuf.cutSource;
            const sameSheet = clipboardBuf.cutSource.sheetId === ctx.fWorksheet.getSheetId();
            const pasted = { startRow: dest.startRow, endRow: dest.startRow + outRows - 1, startColumn: dest.startColumn, endColumn: dest.startColumn + outCols - 1 };
            const source = { startRow: sr, endRow: er, startColumn: sc, endColumn: ec };
            const toClear = sameSheet ? subtractRect(source, pasted) : [source];
            for (const area of toClear) {
              cutSheet.getRange(area.startRow, area.startColumn, area.endRow - area.startRow + 1, area.endColumn - area.startColumn + 1).clear();
            }
          }
          setClipboardBuf((prev) => (prev ? { ...prev, cutSource: undefined } : null));
        }

        setSavedStatus('saving');
        syncUiFromSelection();
        ui.toast(`Đã dán (${mode === 'values' ? 'Chỉ giá trị' : mode === 'formulas' ? 'Công thức' : mode === 'formats' ? 'Định dạng' : mode === 'transpose' ? 'Đảo chiều dòng/cột' : 'Đầy đủ'}) tại ${formatA1Cell(dest.startRow, dest.startColumn)}`);
        return;
      }

      try {
        const text = await navigator.clipboard.readText();
        if (!text) {
          ui.toast('Bộ nhớ tạm đang trống', true);
          return;
        }
        const parsedRows = text
          .replace(/\r\n/g, '\n')
          .replace(/\n$/, '')
          .split('\n')
          .map((line) =>
            line.split('\t').map((cellText) => {
              const num = coerceNumeric(cellText);
              return num !== null && /^-?\d+(\.\d+)?$/.test(cellText.trim()) ? num : cellText;
            })
          );
        const rLen = parsedRows.length;
        const cLen = Math.max(1, ...parsedRows.map((r) => r.length));
        const normalized = parsedRows.map((r) => {
          const copy = [...r];
          while (copy.length < cLen) copy.push('');
          return copy;
        });
        ctx.fWorksheet.getRange(dest.startRow, dest.startColumn, rLen, cLen).setValues(normalized);
        setSavedStatus('saving');
        syncUiFromSelection();
        ui.toast(`Đã dán ${rLen}×${cLen} ô từ Clipboard hệ thống`);
      } catch {
        ui.toast('Hãy sao chép vùng ô trong bảng hoặc nhấn Ctrl+V trực tiếp');
      }
    },
    [setSavedStatus, clipboardBuf, getEditableContext, applyStyleObjectToRange, syncUiFromSelection, ui]
  );

  const handleFormatPainter = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    if (painterArmed) {
      painterStyleRef.current = null;
      setPainterArmed(false);
      ui.toast('Đã tắt sao chép định dạng');
      return;
    }
    const style = (ctx.fRange.getCellStyleData() as CellStyle | null) ?? {};
    painterStyleRef.current = { ...style };
    setPainterArmed(true);
    ui.toast(`Đã lấy mẫu định dạng từ ${activeCellA1} — nhấp vào vùng đích để áp dụng`);
  }, [getActiveContext, painterArmed, activeCellA1, ui]);

  const applyFontFamily = (font: string) => {
    setSelectedFont(font);
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setFontFamily(font);
    setSavedStatus('saving');
  };

  const applyFontSize = (sizeStr: string) => {
    const num = Math.max(6, Math.min(72, Number(sizeStr) || 11));
    setSelectedFontSize(String(num));
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setFontSize(num);
    setSavedStatus('saving');
  };

  const toggleBold = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const next = !isBold;
    ctx.fRange.setFontWeight(next ? 'bold' : 'normal');
    setIsBold(next);
    setSavedStatus('saving');
  };

  const toggleItalic = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const next = !isItalic;
    ctx.fRange.setFontStyle(next ? 'italic' : 'normal');
    setIsItalic(next);
    setSavedStatus('saving');
  };

  const toggleUnderline = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const next = !isUnderline;
    ctx.fRange.setFontLine(next ? 'underline' : 'none');
    setIsUnderline(next);
    if (next) setIsStrike(false);
    setSavedStatus('saving');
  };

  const toggleStrike = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const next = !isStrike;
    ctx.fRange.setFontLine(next ? 'line-through' : 'none');
    setIsStrike(next);
    if (next) setIsUnderline(false);
    setSavedStatus('saving');
  };

  const applyFill = (color: string | null) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    if (color) {
      setFillColor(color);
      ctx.fRange.setBackgroundColor(color);
    } else {
      ctx.fRange.setBackgroundColor('#ffffff');
    }
    setSavedStatus('saving');
  };

  const applyFontClr = (color: string | null) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    if (color) setFontColor(color);
    ctx.fRange.setFontColor(color ?? '#0f172a');
    setSavedStatus('saving');
  };

  const applyBorder = (preset: 'all' | 'outside' | 'thickOutside' | 'bottom' | 'topBottomDouble' | 'dashed' | 'none') => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fRange } = ctx;
    if (preset === 'none') {
      fRange.setBorder(BorderType.ALL, BorderStyleTypes.NONE);
    } else if (preset === 'all') {
      fRange.setBorder(BorderType.ALL, BorderStyleTypes.THIN, borderColor);
    } else if (preset === 'outside') {
      fRange.setBorder(BorderType.OUTSIDE, BorderStyleTypes.THIN, borderColor);
    } else if (preset === 'thickOutside') {
      fRange.setBorder(BorderType.OUTSIDE, BorderStyleTypes.MEDIUM, borderColor);
    } else if (preset === 'bottom') {
      fRange.setBorder(BorderType.BOTTOM, BorderStyleTypes.THIN, borderColor);
    } else if (preset === 'topBottomDouble') {
      fRange.setBorder(BorderType.TOP, BorderStyleTypes.THIN, borderColor);
      fRange.setBorder(BorderType.BOTTOM, BorderStyleTypes.DOUBLE, borderColor);
    } else if (preset === 'dashed') {
      fRange.setBorder(BorderType.ALL, BorderStyleTypes.DASHED, borderColor);
    }
    setSavedStatus('saving');
  };

  const applyHAlign = (align: 'left' | 'center' | 'normal') => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setHorizontalAlignment(align);
    setHAlign(align);
    setSavedStatus('saving');
  };

  const applyVAlign = (align: 'top' | 'middle' | 'bottom') => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setVerticalAlignment(align);
    setVAlign(align);
    setSavedStatus('saving');
  };

  const toggleWrapText = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const next = !isWrap;
    ctx.fRange.setWrap(next);
    setIsWrap(next);
    setSavedStatus('saving');
  };

  const applyTextRotation = (angle: number) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setTextRotation(angle);
    setSavedStatus('saving');
  };

  const handleMergeCells = (mode: 'toggle' | 'center' | 'across' | 'vertical' | 'unmerge') => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fRange } = ctx;
    if (mode === 'unmerge' || (mode === 'toggle' && (fRange.isMerged() || fRange.isPartOfMerge()))) {
      fRange.breakApart();
      setIsMerged(false);
      ui.toast('Đã tách ô gộp');
    } else if (mode === 'across') {
      fRange.mergeAcross();
      setIsMerged(true);
    } else if (mode === 'vertical') {
      fRange.mergeVertically();
      setIsMerged(true);
    } else {
      fRange.merge();
      if (mode === 'center' || mode === 'toggle') {
        fRange.setHorizontalAlignment('center');
        fRange.setVerticalAlignment('middle');
      }
      setIsMerged(true);
      ui.toast(`Đã gộp và căn giữa vùng ${activeRangeA1}`);
    }
    setSavedStatus('saving');
  };

  const applyNumberFormat = (pattern: string) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    setSelectedNumberFormat(pattern);
    ctx.fRange.setNumberFormat(pattern === 'General' ? '@' : pattern);
    setSavedStatus('saving');
  };

  const adjustDecimals = (delta: number) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const cur = selectedNumberFormat;
    const isPct = cur.includes('%');
    const isVnd = cur.includes('₫');
    const match = /0\.(0+)/.exec(cur);
    const currentDec = match ? match[1].length : 0;
    const nextDec = Math.max(0, Math.min(6, currentDec + delta));
    const frac = nextDec > 0 ? `.${'0'.repeat(nextDec)}` : '';
    const nextPattern = isPct
      ? `0${frac}%`
      : isVnd
      ? `#,##0${frac} "₫"`
      : `#,##0${frac}`;
    applyNumberFormat(nextPattern);
  };

  const handleApplyCellPreset = (preset: CellStylePreset) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fRange } = ctx;
    fRange.setBackgroundColor(preset.bg ?? '#ffffff');
    fRange.setFontColor(preset.fg);
    fRange.setFontWeight(preset.bold ? 'bold' : 'normal');
    fRange.setFontStyle(preset.italic ? 'italic' : 'normal');
    if (preset.borderColor) {
      fRange.setBorder(BorderType.OUTSIDE, BorderStyleTypes.THIN, preset.borderColor);
    }
    if (preset.numFmt) {
      fRange.setNumberFormat(preset.numFmt);
    }
    setSavedStatus('saving');
    syncUiFromSelection();
  };

  const handleFormatAsTable = (theme: TableThemePreset) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const targetA1 = getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    const { startRow, startColumn, endRow, endColumn } = parsed;
    const numCols = endColumn - startColumn + 1;
    const numRows = endRow - startRow + 1;

    const fullRange = ctx.fWorksheet.getRange(startRow, startColumn, numRows, numCols);
    fullRange.setBorder(BorderType.ALL, BorderStyleTypes.THIN, theme.borderColor);

    const headerRange = ctx.fWorksheet.getRange(startRow, startColumn, 1, numCols);
    headerRange.setBackgroundColor(theme.headerBg);
    headerRange.setFontColor(theme.headerFg);
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');

    for (let r = startRow + 1; r <= endRow; r++) {
      const rowRange = ctx.fWorksheet.getRange(r, startColumn, 1, numCols);
      const firstCellVal = String(ctx.fWorksheet.getRange(r, startColumn, 1, 1).getValue() ?? '').toLowerCase();
      if (r === endRow && (firstCellVal.startsWith('tổng') || firstCellVal.startsWith('total'))) {
        rowRange.setBackgroundColor(theme.totalBg);
        rowRange.setFontWeight('bold');
      } else {
        rowRange.setBackgroundColor((r - startRow) % 2 === 1 ? theme.evenBg : theme.stripeBg);
      }
    }

    try {
      const existingFilter = ctx.fWorksheet.getFilter();
      if (existingFilter) existingFilter.remove();
      fullRange.createFilter();
      setHasFilter(true);
    } catch {
      void 0;
    }

    setSavedStatus('saving');
    ui.toast(`Đã định dạng Bảng chuyên nghiệp (${theme.name}) cho vùng ${targetA1}`);
  };

  const handleApplyWorkbookTheme = (wbTheme: WorkbookThemePreset) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const targetA1 = getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    const { startRow, startColumn, endRow, endColumn } = parsed;
    const cols = endColumn - startColumn + 1;
    const rows = endRow - startRow + 1;
    const full = ctx.fWorksheet.getRange(startRow, startColumn, rows, cols);
    full.setFontFamily(wbTheme.fontFamily);
    full.setBorder(BorderType.ALL, BorderStyleTypes.THIN, wbTheme.border);
    const hdr = ctx.fWorksheet.getRange(startRow, startColumn, 1, cols);
    hdr.setBackgroundColor(wbTheme.primary);
    hdr.setFontColor(wbTheme.headerFg);
    hdr.setFontWeight('bold');
    if (startRow > 0) {
      ctx.fWorksheet.getRange(0, startColumn, 1, cols).setFontColor(wbTheme.primary);
    }
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã áp dụng chủ đề "${wbTheme.name}"`);
  };

  const handleApplyConditionalRule = (input: ConditionalRuleInput) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const targetRange = ctx.fRange;
    const raw = targetRange.getRange();
    const vals = targetRange.getRawValues();
    const nums: number[] = [];
    vals.forEach((row) =>
      row.forEach((v) => {
        const n = coerceNumeric(v);
        if (n !== null) nums.push(n);
      })
    );
    const minNum = nums.length ? Math.min(...nums) : 0;
    const maxNum = nums.length ? Math.max(...nums) : 100;
    const midNum = (minNum + maxNum) / 2;

    try {
      const builder = ctx.fWorksheet.newConditionalFormattingRule();
      let rule;
      const n1 = Number(input.val1.replaceAll(',', '')) || 0;
      const n2 = Number(input.val2.replaceAll(',', '')) || 100;

      if (input.ruleType === 'dataBar') {
        rule = builder
          .setDataBar({
            min: { type: CFValueType.num, value: Math.min(0, minNum) },
            max: { type: CFValueType.num, value: maxNum === minNum ? minNum + 100 : maxNum },
            isGradient: true,
            positiveColor: '#10b981',
            nativeColor: '#ef4444',
            isShowValue: true,
          })
          .setRanges([raw])
          .build();
      } else if (input.ruleType === 'colorScale') {
        rule = builder
          .setColorScale([
            { index: 0, color: '#fee2e2', value: { type: CFValueType.num, value: minNum } },
            { index: 1, color: '#fef9c3', value: { type: CFValueType.num, value: midNum } },
            { index: 2, color: '#86efac', value: { type: CFValueType.num, value: maxNum === minNum ? minNum + 100 : maxNum } },
          ])
          .setRanges([raw])
          .build();
      } else {
        let highlight;
        if (input.ruleType === 'gt') highlight = builder.whenNumberGreaterThan(n1);
        else if (input.ruleType === 'lt') highlight = builder.whenNumberLessThan(n1);
        else if (input.ruleType === 'between') highlight = builder.whenNumberBetween(Math.min(n1, n2), Math.max(n1, n2));
        else if (input.ruleType === 'eq') highlight = builder.whenNumberEqualTo(n1);
        else if (input.ruleType === 'textContains') highlight = builder.whenTextContains(input.val1 || 'a');
        else if (input.ruleType === 'duplicate') highlight = builder.setDuplicateValues();
        else if (input.ruleType === 'unique') highlight = builder.setUniqueValues();
        else highlight = builder.whenCellEmpty();

        rule = highlight.setBackground(input.bg).setFontColor(input.fg).setBold(true).setRanges([raw]).build();
      }

      ctx.fWorksheet.addConditionalFormattingRule(rule);
      setCfRuleCount((ctx.fWorksheet.getConditionalFormattingRules() ?? []).length);
      setSavedStatus('saving');
      ui.toast(`Đã thêm quy tắc Định dạng có điều kiện cho ${activeRangeA1}`);
    } catch (err) {
      console.error(err);
      ui.toast('Không thể tạo quy tắc định dạng điều kiện trên vùng chọn', true);
    }
  };

  const handleClearSheetCfRules = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fWorksheet.clearConditionalFormatRules();
    setCfRuleCount(0);
    setSavedStatus('saving');
    ui.toast('Đã xoá toàn bộ quy tắc Định dạng điều kiện trên Sheet này');
  };

  const handleStructureMutation = async (
    action:
      | 'insertRowAbove'
      | 'insertRowBelow'
      | 'insertColLeft'
      | 'insertColRight'
      | 'shiftCellsDown'
      | 'shiftCellsRight'
      | 'deleteRows'
      | 'deleteCols'
      | 'shiftCellsUp'
      | 'shiftCellsLeft'
      | 'insertSheet'
      | 'duplicateSheet'
      | 'deleteSheet'
      | 'renameSheet'
      | 'rowHeight'
      | 'colWidth'
      | 'autoFitCols'
      | 'hideRows'
      | 'unhideRows'
      | 'hideCols'
      | 'unhideCols'
  ) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fWorkbook, fWorksheet, fRange } = ctx;
    const r = fRange.getRange();
    const rowSpan = r.endRow - r.startRow + 1;
    const colSpan = r.endColumn - r.startColumn + 1;

    const sheetId = fWorksheet.getSheetId();
    if (action === 'insertRowAbove') shiftSheetStructure(sheetId, 'rows', r.startRow, 1);
    else if (action === 'insertRowBelow') shiftSheetStructure(sheetId, 'rows', r.endRow + 1, 1);
    else if (action === 'deleteRows') shiftSheetStructure(sheetId, 'rows', r.startRow, -rowSpan);
    else if (action === 'insertColLeft') shiftSheetStructure(sheetId, 'cols', r.startColumn, 1);
    else if (action === 'insertColRight') shiftSheetStructure(sheetId, 'cols', r.endColumn + 1, 1);
    else if (action === 'deleteCols') shiftSheetStructure(sheetId, 'cols', r.startColumn, -colSpan);

    if (action === 'insertRowAbove') fWorksheet.insertRowBefore(r.startRow);
    else if (action === 'insertRowBelow') fWorksheet.insertRowAfter(r.endRow);
    else if (action === 'insertColLeft') fWorksheet.insertColumnBefore(r.startColumn);
    else if (action === 'insertColRight') fWorksheet.insertColumnAfter(r.endColumn);
    else if (action === 'shiftCellsDown') fRange.insertCells(Dimension.ROWS);
    else if (action === 'shiftCellsRight') fRange.insertCells(Dimension.COLUMNS);
    else if (action === 'deleteRows') fWorksheet.deleteRows(r.startRow, rowSpan);
    else if (action === 'deleteCols') fWorksheet.deleteColumns(r.startColumn, colSpan);
    else if (action === 'shiftCellsUp') fRange.deleteCells(Dimension.ROWS);
    else if (action === 'shiftCellsLeft') fRange.deleteCells(Dimension.COLUMNS);
    else if (action === 'insertSheet') {
      const idx = fWorkbook.getSheets().length + 1;
      fWorkbook.insertSheet(`Trang tính ${idx}`);
      ui.toast(`Đã thêm Trang tính ${idx}`);
    } else if (action === 'duplicateSheet') {
      fWorkbook.duplicateSheet(fWorksheet);
      ui.toast(`Đã nhân bản "${fWorksheet.getSheetName()}"`);
    } else if (action === 'deleteSheet') {
      if (fWorkbook.getSheets().length <= 1) {
        ui.toast('Workbook phải có ít nhất 1 Sheet', true);
        return;
      }
      const ok = await ui.confirm('Xoá Sheet hiện tại', `Xoá vĩnh viễn "${fWorksheet.getSheetName()}" khỏi tệp?`, true);
      if (!ok) return;
      fWorkbook.deleteSheet(fWorksheet);
    } else if (action === 'renameSheet') {
      const res = await ui.ask({
        title: 'Đổi tên Trang tính (Sheet)',
        fields: [{ name: 'name', label: 'Tên Sheet mới', value: fWorksheet.getSheetName() }],
        confirmText: 'Đổi tên',
      });
      if (res?.name && String(res.name).trim()) {
        fWorksheet.setName(String(res.name).trim().slice(0, 31));
      }
    } else if (action === 'rowHeight') {
      const res = await ui.ask({
        title: 'Chiều cao dòng (px)',
        fields: [{ name: 'h', label: `Chiều cao cho dòng ${r.startRow + 1}..${r.endRow + 1}`, type: 'number', value: 28, min: 14, max: 300 }],
      });
      if (res?.h) fWorksheet.setRowHeights(r.startRow, rowSpan, Math.max(14, Number(res.h)));
    } else if (action === 'colWidth') {
      const res = await ui.ask({
        title: 'Độ rộng cột (px)',
        fields: [{ name: 'w', label: 'Độ rộng cột', type: 'number', value: 120, min: 30, max: 600 }],
      });
      if (res?.w) fWorksheet.setColumnWidths(r.startColumn, colSpan, Math.max(30, Number(res.w)));
    } else if (action === 'autoFitCols') {
      fWorksheet.autoResizeColumns(r.startColumn, colSpan);
      ui.toast('Đã tự động căn vừa độ rộng cột theo nội dung');
    } else if (action === 'hideRows') {
      fWorksheet.hideRows(r.startRow, rowSpan);
    } else if (action === 'unhideRows') {
      fWorksheet.showRows(Math.max(0, r.startRow - 1), rowSpan + 2);
    } else if (action === 'hideCols') {
      fWorksheet.hideColumns(r.startColumn, colSpan);
    } else if (action === 'unhideCols') {
      fWorksheet.showColumns(Math.max(0, r.startColumn - 1), colSpan + 2);
    }
    setSavedStatus('saving');
    syncUiFromSelection();
  };

  const handleAutoSum = useCallback(
    (fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN') => {
      setPopover(null);
      const ctx = getEditableContext();
      if (!ctx) return;
      const { fWorksheet, fRange } = ctx;
      const r = fRange.getRange();

      if (r.endRow > r.startRow || r.endColumn > r.startColumn) {
        if (r.endRow > r.startRow) {
          for (let c = r.startColumn; c <= r.endColumn; c++) {
            const ref = formatA1Range(r.startRow, c, r.endRow, c);
            const dest = fWorksheet.getRange(r.endRow + 1, c, 1, 1);
            dest.setValue(`=${fn}(${ref})`);
            dest.setFontWeight('bold');
            dest.setNumberFormat(autoSumFormat(fn, fWorksheet.getRange(r.startRow, c, 1, 1)));
          }
          ui.toast(`Đã điền công thức =${fn}(...) xuống dòng ${r.endRow + 2}`);
        } else {
          const ref = formatA1Range(r.startRow, r.startColumn, r.startRow, r.endColumn);
          const dest = fWorksheet.getRange(r.startRow, r.endColumn + 1, 1, 1);
          dest.setValue(`=${fn}(${ref})`);
          dest.setFontWeight('bold');
          dest.setNumberFormat(autoSumFormat(fn, fWorksheet.getRange(r.startRow, r.startColumn, 1, 1)));
          ui.toast(`Đã điền =${fn}(${ref})`);
        }
        setSavedStatus('saving');
        return;
      }

      let topR = r.startRow - 1;
      while (topR >= 0) {
        const v = fWorksheet.getRange(topR, r.startColumn, 1, 1).getRawValue();
        if (coerceNumeric(v) === null) break;
        topR -= 1;
      }
      if (topR < r.startRow - 1) {
        const ref = formatA1Range(topR + 1, r.startColumn, r.startRow - 1, r.startColumn);
        fRange.setValue(`=${fn}(${ref})`);
        fRange.setFontWeight('bold');
        setSavedStatus('saving');
        ui.toast(`Đã chèn =${fn}(${ref})`);
        return;
      }

      let leftC = r.startColumn - 1;
      while (leftC >= 0) {
        const v = fWorksheet.getRange(r.startRow, leftC, 1, 1).getRawValue();
        if (coerceNumeric(v) === null) break;
        leftC -= 1;
      }
      if (leftC < r.startColumn - 1) {
        const ref = formatA1Range(r.startRow, leftC + 1, r.startRow, r.startColumn - 1);
        fRange.setValue(`=${fn}(${ref})`);
        fRange.setFontWeight('bold');
        setSavedStatus('saving');
        ui.toast(`Đã chèn =${fn}(${ref})`);
        return;
      }

      fRange.setValue(`=${fn}(B3:D7)`);
      setSavedStatus('saving');
    },
    [setSavedStatus, getEditableContext, ui]
  );

  const handleFillRange = useCallback(
    async (mode: 'down' | 'right' | 'series') => {
      setPopover(null);
      const ctx = getEditableContext();
      if (!ctx) return;
      const { fWorksheet, fRange } = ctx;
      const r = fRange.getRange();

      if (mode === 'down') {
        if (r.endRow === r.startRow && r.startRow > 0) {
          for (let c = r.startColumn; c <= r.endColumn; c++) {
            const above = fWorksheet.getRange(r.startRow - 1, c, 1, 1);
            const f = above.getFormula();
            fWorksheet.getRange(r.startRow, c, 1, 1).setValue(f ? shiftFormulaReferences(f, 1, 0) : ((above.getRawValue() as string | number | boolean | null) ?? ''));
          }
        } else if (r.endRow > r.startRow) {
          const topRow = fWorksheet.getRange(r.startRow, r.startColumn, 1, r.endColumn - r.startColumn + 1);
          topRow.autoFill(fRange);
        }
        ui.toast('Đã điền xuống (Fill Down)');
      } else if (mode === 'right') {
        if (r.endColumn === r.startColumn && r.startColumn > 0) {
          for (let row = r.startRow; row <= r.endRow; row++) {
            const left = fWorksheet.getRange(row, r.startColumn - 1, 1, 1);
            const f = left.getFormula();
            fWorksheet.getRange(row, r.startColumn, 1, 1).setValue(f ? shiftFormulaReferences(f, 0, 1) : ((left.getRawValue() as string | number | boolean | null) ?? ''));
          }
        } else if (r.endColumn > r.startColumn) {
          const leftCol = fWorksheet.getRange(r.startRow, r.startColumn, r.endRow - r.startRow + 1, 1);
          leftCol.autoFill(fRange);
        }
        ui.toast('Đã điền sang phải (Fill Right)');
      } else {
        const res = await ui.ask({
          title: 'Đánh số chuỗi cấp số cộng (Fill Series)',
          fields: [
            { name: 'start', label: 'Giá trị bắt đầu', type: 'number', value: 1 },
            { name: 'step', label: 'Bước nhảy', type: 'number', value: 1 },
            { name: 'count', label: 'Số lượng phần tử (nếu đang chọn 1 ô)', type: 'number', value: Math.max(10, r.endRow - r.startRow + 1) },
          ],
        });
        if (!res) return;
        const start = Number(res.start) || 1;
        const step = Number(res.step) || 1;
        const total = r.endRow > r.startRow ? r.endRow - r.startRow + 1 : Math.max(1, Math.min(500, Number(res.count) || 10));
        const colVals = Array.from({ length: total }, (_, idx) => [start + idx * step]);
        fWorksheet.getRange(r.startRow, r.startColumn, total, 1).setValues(colVals);
        ui.toast(`Đã điền chuỗi ${total} số từ ${start}`);
      }
      setSavedStatus('saving');
    },
    [setSavedStatus, getEditableContext, ui]
  );

  const handleFlashFill = useCallback(() => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fWorksheet, fRange } = ctx;
    const r = fRange.getRange();
    const targetCol = r.startColumn;
    const startRow = r.startRow;

    if (targetCol <= 0) {
      ui.toast('Flash Fill cần ít nhất một cột dữ liệu nguồn nằm ở bên trái cột đích.', true);
      return;
    }

    const sourceCol = targetCol - 1;
    let sampleVal = String(fWorksheet.getRange(startRow, targetCol, 1, 1).getValue() ?? '').trim();
    let sampleRow = startRow;
    if (!sampleVal && startRow > 0) {
      sampleVal = String(fWorksheet.getRange(startRow - 1, targetCol, 1, 1).getValue() ?? '').trim();
      sampleRow = startRow - 1;
    }

    if (!sampleVal) {
      ui.toast('Hãy nhập một giá trị mẫu vào ô đầu tiên (ví dụ: tách Họ Tên, mã số, viết hoa, định dạng) trước khi nhấn Flash Fill (Ctrl + E).', true);
      return;
    }

    const sourceSample = String(fWorksheet.getRange(sampleRow, sourceCol, 1, 1).getValue() ?? '').trim();
    if (!sourceSample) {
      ui.toast('Không tìm thấy dữ liệu nguồn tương ứng ở cột bên trái.', true);
      return;
    }

    type RuleFn = (src: string) => string;
    let rule: RuleFn | null = null;
    let ruleDesc = 'theo mẫu';

    const sourceWords = sourceSample.split(/\s+/);

    if (sourceSample.toUpperCase() === sampleVal && sourceSample !== sampleVal) {
      rule = (s) => s.toUpperCase();
      ruleDesc = 'VIẾT HOA TOÀN BỘ';
    } else if (sourceSample.toLowerCase() === sampleVal && sourceSample !== sampleVal) {
      rule = (s) => s.toLowerCase();
      ruleDesc = 'viết thường toàn bộ';
    } else if (sourceWords[0] === sampleVal) {
      rule = (s) => s.split(/\s+/)[0] || '';
      ruleDesc = 'Lấy từ đầu tiên (Họ/Mã đầu)';
    } else if (sourceWords[sourceWords.length - 1] === sampleVal) {
      rule = (s) => {
        const parts = s.split(/\s+/);
        return parts[parts.length - 1] || '';
      };
      ruleDesc = 'Lấy từ cuối cùng (Tên/Mã cuối)';
    } else if (sourceWords.slice(1, -1).join(' ') === sampleVal && sourceWords.length > 2) {
      rule = (s) => s.split(/\s+/).slice(1, -1).join(' ');
      ruleDesc = 'Lấy phần đệm giữa';
    } else if (sourceSample.replace(/\D/g, '') === sampleVal.replace(/\D/g, '') && sampleVal.includes('-')) {
      rule = (s) => {
        const digits = s.replace(/\D/g, '');
        if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
        if (digits.length === 11) return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
        return digits;
      };
      ruleDesc = 'Định dạng số điện thoại / Mã số';
    } else if (sampleVal.includes('@') && !sourceSample.includes('@')) {
      const domain = sampleVal.slice(sampleVal.indexOf('@'));
      rule = (s) => s.toLowerCase().replace(/\s+/g, '.') + domain;
      ruleDesc = 'Tạo email từ tên';
    } else if (sourceSample.includes(sampleVal)) {
      const startIdx = sourceSample.indexOf(sampleVal);
      const len = sampleVal.length;
      rule = (s) => s.slice(startIdx, startIdx + len);
      ruleDesc = 'Trích xuất chuỗi con tương ứng';
    } else {
      const pIdx = sampleVal.indexOf(sourceSample);
      if (pIdx >= 0) {
        const prefix = sampleVal.slice(0, pIdx);
        const suffix = sampleVal.slice(pIdx + sourceSample.length);
        rule = (s) => `${prefix}${s}${suffix}`;
        ruleDesc = 'Ghép tiền tố / hậu tố mẫu';
      }
    }

    if (!rule) {
      rule = (s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      ruleDesc = 'Viết hoa chữ cái đầu';
    }

    const maxScanRows = 500;
    let endRow = sampleRow + 1;
    while (endRow < sampleRow + maxScanRows) {
      const nextSrc = fWorksheet.getRange(endRow, sourceCol, 1, 1).getValue();
      if (nextSrc === null || nextSrc === undefined || String(nextSrc).trim() === '') break;
      endRow++;
    }

    const rowCount = endRow - (sampleRow + 1);
    if (rowCount <= 0) {
      ui.toast('Không có dòng tiếp theo ở cột bên trái để điền dữ liệu.', true);
      return;
    }

    const filledValues: string[][] = [];
    for (let rIdx = sampleRow + 1; rIdx < endRow; rIdx++) {
      const srcVal = String(fWorksheet.getRange(rIdx, sourceCol, 1, 1).getValue() ?? '').trim();
      filledValues.push([rule(srcVal)]);
    }

    fWorksheet.getRange(sampleRow + 1, targetCol, rowCount, 1).setValues(filledValues);
    setSavedStatus('saving');
    ui.toast(`Đã điền thông minh (Flash Fill) cho ${rowCount} dòng ${ruleDesc}`);
  }, [getEditableContext, ui]);

  const handleTracePrecedents = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const formula = ctx.fRange.getFormula();
    if (!formula) {
      ui.toast(`Ô ${activeCellA1} không chứa công thức. Hãy chọn ô có công thức (ví dụ: =SUM(B3:D7)) để truy vết tiền đề.`, true);
      return;
    }

    const refRegex = /(?:([A-Za-z0-9_]+)!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?/g;
    const matches = [...formula.matchAll(refRegex)];
    const items: AuditTraceItem[] = [];
    const seenRefs = new Set<string>();

    for (const m of matches) {
      const fullRef = m[0].replace(/\$/g, '');
      if (seenRefs.has(fullRef)) continue;
      seenRefs.add(fullRef);

      const parsed = parseA1Range(fullRef);
      if (parsed) {
        const rows = parsed.endRow - parsed.startRow + 1;
        const cols = parsed.endColumn - parsed.startColumn + 1;
        const targetRange = ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, rows, cols);
        const vals = targetRange.getRawValues();
        let displayVal = '';
        if (rows === 1 && cols === 1) {
          displayVal = String(vals[0]?.[0] ?? '(Trống)');
        } else {
          let sum = 0;
          let count = 0;
          vals.forEach((r) =>
            r.forEach((v) => {
              const n = coerceNumeric(v);
              if (n !== null) {
                sum += n;
                count++;
              }
            })
          );
          displayVal = count > 0 ? `Tổng: ${sum.toLocaleString('vi-VN')} (${count} số)` : `Vùng ${rows}x${cols}`;
        }
        items.push({
          ref: fullRef,
          row: parsed.startRow,
          col: parsed.startColumn,
          endRow: parsed.endRow,
          endCol: parsed.endColumn,
          displayValue: displayVal,
        });
      }
    }

    if (items.length === 0) {
      ui.toast(`Không phát hiện ô tiền đề trực tiếp nào trong công thức: ${formula}`);
      return;
    }

    const first = items[0];
    ctx.fWorksheet.getRange(first.row, first.col, (first.endRow ?? first.row) - first.row + 1, (first.endCol ?? first.col) - first.col + 1).activate();

    setAuditTrace({
      mode: 'precedents',
      cellA1: activeCellA1,
      formula,
      items,
    });
    ui.toast(`Đã phát hiện ${items.length} tham chiếu ô tiền đề của ${activeCellA1}`);
  }, [getActiveContext, activeCellA1, ui]);

  const handleTraceDependents = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const targetA1 = activeCellA1;
    const parsedTarget = parseA1Range(targetA1);
    if (!parsedTarget) return;

    const smartA1 = getSmartDataRangeA1();
    const smartParsed = parseA1Range(smartA1) ?? { startRow: 0, startColumn: 0, endRow: 100, endColumn: 26 };
    const scanRows = Math.max(smartParsed.endRow + 10, 60);
    const scanCols = Math.max(smartParsed.endColumn + 5, 20);

    const sheetRange = ctx.fWorksheet.getRange(0, 0, scanRows, scanCols);
    const formulas = sheetRange.getFormulas();
    const values = sheetRange.getRawValues();

    const dependents: AuditTraceItem[] = [];
    const tRow = parsedTarget.startRow;
    const tCol = parsedTarget.startColumn;

    for (let r = 0; r < formulas.length; r++) {
      for (let c = 0; c < formulas[r].length; c++) {
        const f = formulas[r][c];
        if (!f) continue;
        if (r === tRow && c === tCol) continue;

        const refRegex = /(?:([A-Za-z0-9_]+)!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?/g;
        const matches = [...f.matchAll(refRegex)];
        let isDependent = false;
        for (const m of matches) {
          const cleanRef = m[0].replace(/\$/g, '');
          const p = parseA1Range(cleanRef);
          if (p) {
            if (tRow >= p.startRow && tRow <= p.endRow && tCol >= p.startColumn && tCol <= p.endColumn) {
              isDependent = true;
              break;
            }
          }
        }

        if (isDependent) {
          const depA1 = formatA1Cell(r, c);
          dependents.push({
            ref: depA1,
            row: r,
            col: c,
            formula: f,
            displayValue: String(values[r]?.[c] ?? ''),
          });
        }
      }
    }

    if (dependents.length === 0) {
      ui.toast(`Không có ô nào trong bảng phụ thuộc vào ô ${targetA1}`);
      setAuditTrace(null);
      return;
    }

    const first = dependents[0];
    ctx.fWorksheet.getRange(first.row, first.col, 1, 1).activate();

    setAuditTrace({
      mode: 'dependents',
      cellA1: targetA1,
      formula: ctx.fRange.getFormula() || String(ctx.fRange.getValue() ?? ''),
      items: dependents,
    });
    ui.toast(`Tìm thấy ${dependents.length} ô công thức phụ thuộc vào ${targetA1}`);
  }, [getActiveContext, activeCellA1, getSmartDataRangeA1, ui]);

  const showFormulasRef = useRef(false);
  useEffect(() => {
    showFormulasRef.current = showFormulasMode;
  }, [showFormulasMode]);
  const handleToggleShowFormulas = useCallback(() => {
    const next = !showFormulasRef.current;
    showFormulasRef.current = next;
    setShowFormulasMode(next);
    ui.toast(
      next
        ? 'Đã bật chế độ Hiện công thức (Show Formulas). Nhấn Ctrl + ` hoặc nhấn nút để tắt.'
        : 'Đã tắt chế độ Hiện công thức, trở lại chế độ xem kết quả số liệu.'
    );
  }, [ui]);

  const handleAddWatch = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const a1 = activeCellA1;
    const parsed = parseA1Range(a1);
    if (!parsed) return;
    const rawVal = ctx.fRange.getValue();
    const formula = ctx.fRange.getFormula();
    const sheetName = activeSheetName;

    let label = '';
    try {
      const headerVal = ctx.fWorksheet.getRange(0, parsed.startColumn, 1, 1).getValue();
      if (headerVal && parsed.startRow > 0) label = String(headerVal);
    } catch {
      void 0;
    }

    setWatchList((prev) => {
      const exists = prev.find((w) => w.sheetName === sheetName && w.a1 === a1);
      if (exists) return prev;
      const next = [
        ...prev,
        {
          id: `${sheetName}-${a1}-${Date.now()}`,
          sheetName,
          a1,
          row: parsed.startRow,
          col: parsed.startColumn,
          label: label || `Ô ${a1}`,
          value: rawVal === null || rawVal === undefined ? '(Trống)' : String(rawVal),
          formula: formula || '',
        },
      ];
      try {
        localStorage.setItem(`sheet-watch-${meta.id}`, JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
    setShowWatchWindow(true);
    ui.toast(`Đã thêm ô ${a1} vào Cửa sổ giám sát (Watch Window)`);
  }, [getActiveContext, activeCellA1, activeSheetName, meta.id, ui]);

  const handleRemoveWatch = useCallback((id: string) => {
    setWatchList((prev) => {
      const next = prev.filter((w) => w.id !== id);
      try {
        localStorage.setItem(`sheet-watch-${meta.id}`, JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, [meta.id]);

  const handleClearWatch = useCallback(() => {
    setWatchList([]);
    try {
      localStorage.removeItem(`sheet-watch-${meta.id}`);
    } catch {
      void 0;
    }
    ui.toast('Đã xoá toàn bộ danh sách giám sát');
  }, [meta.id, ui]);

  const handleSortSheet = (ascending: boolean) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    if (raw.endRow > raw.startRow) {
      let activeCol = raw.startColumn;
      try {
        activeCol = ctx.fWorksheet.getActiveCell()?.getColumn() ?? raw.startColumn;
      } catch {
        activeCol = raw.startColumn;
      }
      const relCol = Math.max(0, Math.min(raw.endColumn - raw.startColumn, activeCol - raw.startColumn));
      ctx.fRange.sort({ column: relCol, ascending });
      setSavedStatus('saving');
      ui.toast(`Đã sắp xếp vùng chọn theo cột ${colIndexToLetter(raw.startColumn + relCol)} ${ascending ? 'tăng dần (A → Z)' : 'giảm dần (Z → A)'}`);
      return;
    }
    const smart = parseA1Range(getSmartDataRangeA1());
    if (!smart || smart.endRow <= smart.startRow + 1) {
      ui.toast('Không tìm thấy bảng dữ liệu để sắp xếp. Hãy chọn vùng cần sắp xếp (từ 2 dòng trở lên).', true);
      return;
    }
    const bodyStartRow = smart.startRow + 1;
    let bodyEndRow = smart.endRow;
    const lastLbl = String(ctx.fWorksheet.getRange(bodyEndRow, smart.startColumn, 1, 1).getValue() ?? '').toLowerCase();
    if (lastLbl.startsWith('tổng') || lastLbl.startsWith('total')) bodyEndRow -= 1;
    if (bodyEndRow <= bodyStartRow) {
      ui.toast('Bảng chỉ có 1 dòng dữ liệu, không cần sắp xếp.');
      return;
    }
    const relCol = Math.max(0, Math.min(smart.endColumn - smart.startColumn, raw.startColumn - smart.startColumn));
    const sortRange = ctx.fWorksheet.getRange(
      bodyStartRow,
      smart.startColumn,
      bodyEndRow - bodyStartRow + 1,
      smart.endColumn - smart.startColumn + 1
    );
    sortRange.sort({ column: relCol, ascending });
    setSavedStatus('saving');
    ui.toast(`Đã sắp xếp bảng theo cột ${formatA1Cell(0, smart.startColumn + relCol).replace(/\d+/g, '')} (${ascending ? 'A → Z' : 'Z → A'})`);
  };

  const handleToggleFilter = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const existing = ctx.fWorksheet.getFilter();
    if (existing) {
      existing.remove();
      setHasFilter(false);
      setSavedStatus('saving');
      ui.toast('Đã tắt Bộ lọc (Filter)');
      return;
    }
    const raw = ctx.fRange.getRange();
    if (raw.endRow > raw.startRow && raw.endColumn > raw.startColumn) {
      ctx.fRange.createFilter();
    } else {
      const smart = parseA1Range(getSmartDataRangeA1());
      if (smart) {
        ctx.fWorksheet
          .getRange(smart.startRow, smart.startColumn, smart.endRow - smart.startRow + 1, smart.endColumn - smart.startColumn + 1)
          .createFilter();
      }
    }
    setHasFilter(true);
    setSavedStatus('saving');
    ui.toast('Đã bật Bộ lọc dữ liệu tự động trên tiêu đề bảng');
  };

  const handleClearSelection = (kind: 'all' | 'contents' | 'formats' | 'notes' | 'links') => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    if (kind === 'all') ctx.fRange.clear();
    else if (kind === 'contents') ctx.fRange.clearContent();
    else if (kind === 'formats') ctx.fRange.clearFormat();
    else if (kind === 'notes') ctx.fRange.deleteNote();
    else if (kind === 'links') ctx.fRange.cancelHyperLink();
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast('Đã xoá theo tuỳ chọn trên vùng chọn');
  };

  const handleTextToColumns = async () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const res = await ui.ask({
      title: 'Tách văn bản thành nhiều cột (Text to Columns)',
      fields: [
        {
          name: 'delim',
          label: 'Ký tự phân tách',
          type: 'select',
          value: ',',
          options: [
            { value: ',', label: 'Dấu phẩy (,)' },
            { value: ';', label: 'Dấu chấm phẩy (;)' },
            { value: '|', label: 'Dấu sổ dọc (|)' },
            { value: ' ', label: 'Khoảng trắng (Space)' },
            { value: '-', label: 'Dấu gạch ngang (-)' },
          ],
        },
      ],
    });
    if (!res) return;
    const delim = String(res.delim || ',');
    const r = ctx.fRange.getRange();
    const vals = ctx.fRange.getValues();
    let maxParts = 1;
    const splitMatrix = vals.map((row) => {
      const parts = String(row[0] ?? '').split(delim).map((s) => s.trim());
      if (parts.length > maxParts) maxParts = parts.length;
      return parts;
    });
    const normalized = splitMatrix.map((parts) => {
      const out: (string | number)[] = [...parts];
      while (out.length < maxParts) out.push('');
      return out;
    });
    ctx.fWorksheet.getRange(r.startRow, r.startColumn, normalized.length, maxParts).setValues(normalized);
    setSavedStatus('saving');
    ui.toast(`Đã tách thành ${maxParts} cột dữ liệu`);
  };

  const handleRemoveDuplicates = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const targetA1 = ctx.fRange.getRange().endRow > ctx.fRange.getRange().startRow ? activeRangeA1 : getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    const rows = parsed.endRow - parsed.startRow + 1;
    const cols = parsed.endColumn - parsed.startColumn + 1;
    const vals = ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, rows, cols).getRawValues();
    const duplicates = findDuplicateRowIndexes(vals);
    if (!duplicates.length) {
      ui.toast('Không phát hiện dòng dữ liệu trùng lặp nào');
      return;
    }
    try {
      for (const run of groupDescendingRuns(duplicates)) {
        ctx.fWorksheet.getRange(parsed.startRow + run.start, parsed.startColumn, run.count, cols).deleteCells(Dimension.ROWS);
      }
      ctx.fWorksheet.getRange(parsed.endRow - duplicates.length + 1, parsed.startColumn, duplicates.length, cols).insertCells(Dimension.ROWS);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể xoá dòng trùng lặp trong vùng này', true);
      return;
    }
    setSavedStatus('saving');
    ui.toast(`Đã loại bỏ ${duplicates.length} dòng trùng lặp trong ${targetA1}`);
  };

  const handleApplyValidation = (input: ValidationRuleInput) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    try {
      const builder = ctx.api.newDataValidation();
      if (input.kind === 'list') {
        const items = input.listText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        builder.requireValueInList(items.length ? items : ['Có', 'Không'], false, true);
      } else if (input.kind === 'range') {
        const parsed = parseA1Range(input.listText);
        if (parsed) {
          const srcRange = ctx.fWorksheet.getRange(
            parsed.startRow,
            parsed.startColumn,
            parsed.endRow - parsed.startRow + 1,
            parsed.endColumn - parsed.startColumn + 1
          );
          builder.requireValueInRange(srcRange, false, true);
        }
      } else if (input.kind === 'checkbox') {
        builder.requireCheckbox();
      } else if (input.kind === 'numberBetween') {
        builder.requireNumberBetween(Number(input.minVal) || 0, Number(input.maxVal) || 100, input.integerOnly);
      } else if (input.kind === 'numberGt') {
        builder.requireNumberGreaterThan(Number(input.minVal) || 0, input.integerOnly);
      } else if (input.kind === 'formula') {
        builder.requireFormulaSatisfied(input.listText.startsWith('=') ? input.listText : `=${input.listText}`);
      }
      builder
        .setAllowBlank(input.allowBlank)
        .setAllowInvalid(!input.strictStop)
        .setOptions({
          showErrorMessage: true,
          error: input.errorMessage,
        });
      ctx.fRange.setDataValidation(builder.build());
      setSavedStatus('saving');
      ui.toast(`Đã thiết lập Kiểm tra dữ liệu cho ${activeRangeA1}`);
    } catch (err) {
      console.error(err);
      ui.toast('Không thể áp dụng quy tắc kiểm tra dữ liệu', true);
    }
  };

  const handleClearValidation = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    (ctx.fRange as unknown as { setDataValidation: (rule: null) => void }).setDataValidation(null);
    setSavedStatus('saving');
    ui.toast(`Đã gỡ kiểm tra dữ liệu tại ${activeRangeA1}`);
  };

  const handleDataCleanup = (op: 'trim' | 'toNumber' | 'upper' | 'lower' | 'proper') => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    const targetA1 = raw.endRow > raw.startRow || raw.endColumn > raw.startColumn ? activeRangeA1 : getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    const range = ctx.fWorksheet.getRange(
      parsed.startRow,
      parsed.startColumn,
      parsed.endRow - parsed.startRow + 1,
      parsed.endColumn - parsed.startColumn + 1
    );
    const vals = range.getRawValues();
    const formulas = range.getFormulas();
    let changed = 0;

    for (let r = 0; r < vals.length; r++) {
      for (let c = 0; c < vals[r].length; c++) {
        if (formulas[r]?.[c]) continue;
        const v = vals[r][c];
        if (typeof v !== 'string' || !v) continue;
        let nextVal: string | number = v;
        if (op === 'trim') nextVal = v.trim().replace(/\s{2,}/g, ' ');
        else if (op === 'upper') nextVal = v.toUpperCase();
        else if (op === 'lower') nextVal = v.toLowerCase();
        else if (op === 'proper') {
          nextVal = v.toLowerCase().replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
        } else if (op === 'toNumber') {
          const n = coerceNumeric(v);
          if (n !== null) nextVal = n;
        }
        if (nextVal !== v) {
          ctx.fWorksheet.getRange(parsed.startRow + r, parsed.startColumn + c, 1, 1).setValue(nextVal);
          changed += 1;
        }
      }
    }
    setSavedStatus('saving');
    ui.toast(`Đã chuẩn hoá ${changed} ô dữ liệu`);
  };

  const handleWrapErrorsWithIfError = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const analysis = computeLiveAnalysis();
    let fixed = 0;
    analysis.errorCells.forEach((errCell) => {
      const cellRange = ctx.fWorksheet.getRange(errCell.row, errCell.col, 1, 1);
      const f = cellRange.getFormula();
      if (f && !/^=IFERROR\(/i.test(f)) {
        cellRange.setValue(`=IFERROR(${f.replace(/^=/, '')}, 0)`);
        fixed += 1;
      }
    });
    setSavedStatus('saving');
    ui.toast(`Đã bọc IFERROR an toàn cho ${fixed} ô công thức lỗi`);
  };

  const handleInsertFormula = (formula: string) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setValue(formula.startsWith('=') ? formula : `=${formula}`);
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã chèn công thức vào ${activeCellA1}`);
  };

  const handleReadMoneyWords = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const val = coerceNumeric(ctx.fRange.getRawValue());
    if (val === null) {
      ui.toast('Hãy chọn 1 ô chứa số tiền để đọc thành chữ tiếng Việt', true);
      return;
    }
    const words = readVietnameseMoneyWords(val);
    const raw = ctx.fRange.getRange();
    const below = ctx.fWorksheet.getRange(raw.endRow + 1, raw.startColumn, 1, 1);
    if (!below.getRawValue()) {
      below.setValue(`Bằng chữ: ${words}`);
      below.setFontStyle('italic');
      setSavedStatus('saving');
      ui.toast(`Đã điền dòng chữ số tiền tại ${formatA1Cell(raw.endRow + 1, raw.startColumn)}: "${words}"`);
    } else {
      void copyTextSafely(words).then((copied) =>
        ui.toast(copied ? `${words} (Đã sao chép vào Clipboard)` : `${words} — ô bên dưới đã có dữ liệu, hãy sao chép thủ công`)
      );
    }
  };

  const handleFindAll = async (query: string, matchCase: boolean, wholeCell: boolean): Promise<FindMatchItem[]> => {
    const ctx = getActiveContext();
    if (!ctx) return [];
    const finder = await ctx.api.createTextFinderAsync(query);
    if (!finder) return [];
    await finder.matchCaseAsync(matchCase);
    await finder.matchEntireCellAsync(wholeCell);
    const found = finder.findAll();
    return found.map((fr) => {
      const rg = fr.getRange();
      return {
        a1: formatA1Cell(rg.startRow, rg.startColumn),
        row: rg.startRow,
        col: rg.startColumn,
        preview: String(fr.getValue() ?? ''),
      };
    });
  };

  const handleReplaceOne = async (query: string, replacement: string, matchCase: boolean, wholeCell: boolean) => {
    const ctx = getEditableContext();
    if (!ctx) return 0;
    const finder = await ctx.api.createTextFinderAsync(query);
    if (!finder) return 0;
    await finder.matchCaseAsync(matchCase);
    await finder.matchEntireCellAsync(wholeCell);
    const m = finder.findNext();
    if (!m) return 0;
    const ok = await finder.replaceWithAsync(replacement);
    setSavedStatus('saving');
    return ok ? 1 : 0;
  };

  const handleReplaceAll = async (query: string, replacement: string, matchCase: boolean, wholeCell: boolean) => {
    const ctx = getEditableContext();
    if (!ctx) return 0;
    const finder = await ctx.api.createTextFinderAsync(query);
    if (!finder) return 0;
    await finder.matchCaseAsync(matchCase);
    await finder.matchEntireCellAsync(wholeCell);
    const count = await finder.replaceAllWithAsync(replacement);
    setSavedStatus('saving');
    return count;
  };

  const handleGoToRef = useCallback(
    (refText: string): boolean => {
      const ctx = getActiveContext();
      if (!ctx) return false;
      const trimmed = refText.trim();
      const matchedName = definedNames.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
      const resolvedRef = matchedName ? matchedName.formulaOrRef.replace(/^=/, '') : trimmed;
      const parsed = parseA1Range(resolvedRef);
      if (!parsed) {
        ui.toast(`Địa chỉ ô "${refText}" không hợp lệ`, true);
        return false;
      }
      if (parsed.sheetName) {
        const sh = ctx.fWorkbook.getSheetByName(parsed.sheetName);
        if (sh) ctx.fWorkbook.setActiveSheet(sh);
      }
      const activeSheet = ctx.fWorkbook.getActiveSheet();
      const target = activeSheet.getRange(
        parsed.startRow,
        parsed.startColumn,
        parsed.endRow - parsed.startRow + 1,
        parsed.endColumn - parsed.startColumn + 1
      );
      target.activate();
      setTimeout(() => syncUiFromSelection(), 20);
      return true;
    },
    [getActiveContext, definedNames, syncUiFromSelection, ui]
  );

  const handleCommitFormulaBar = useCallback(() => {
    const pending = pendingFormulaEdit.current;
    const ctx = pending ? pending.context : getEditableContext();
    if (!ctx || isProtectedRef.current) return false;
    const text = pending?.text ?? formulaBarText;
    const raw = ctx.fRange.getRange();
    const cell = ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, 1, 1);
    const trimmed = text.trim();
    if (trimmed === '') {
      cell.setValue('');
    } else if (trimmed.startsWith('=')) {
      cell.setValue(trimmed);
    } else {
      const n = coerceNumeric(trimmed);
      cell.setValue(n !== null && /^-?\d+(\.\d+)?$/.test(trimmed) ? n : text);
    }
    try {
      ctx.api.getFormula()?.executeCalculation();
    } catch {
      void 0;
    }
    try {
      announceAutomation(applyEditAutomation(ctx.fWorksheet, raw.startRow, raw.startColumn, text, null));
    } catch (err) {
      console.warn('Auto-fit column after formula bar commit failed:', err);
    }
    pendingFormulaEdit.current = null;
    setSavedStatus('saving');
    setTimeout(() => syncUiFromSelection(), 35);
    return true;
  }, [setSavedStatus, getEditableContext, formulaBarText, syncUiFromSelection, announceAutomation]);

  useDocumentCloser(async (close) => {
    if (pendingFormulaEdit.current && !handleCommitFormulaBar()) return false;
    const workbook = univerAPIRef.current?.getActiveWorkbook();
    if (workbook?.isCellEditing() && !(await workbook.endEditingAsync(true))) return false;
    const saved = await persistWorkbook(false);
    if (saved && close) onBack();
    return saved;
  });

  const handleGoalSeek = async (formulaCellRef: string, targetValue: number, variableCellRef: string): Promise<string> => {
    const ctx = getActiveContext();
    if (!ctx) return 'Không tìm thấy bảng tính';
    const fCoord = parseA1Range(formulaCellRef);
    const vCoord = parseA1Range(variableCellRef);
    if (!fCoord || !vCoord) return 'Địa chỉ ô không hợp lệ (ví dụ hợp lệ: E8 và D3).';

    const fCell = ctx.fWorksheet.getRange(fCoord.startRow, fCoord.startColumn, 1, 1);
    const vCell = ctx.fWorksheet.getRange(vCoord.startRow, vCoord.startColumn, 1, 1);
    if (!fCell.getFormula()) {
      return `Ô ${formulaCellRef} không chứa công thức (fx) để giải nghiệm ngược.`;
    }

    const evalAt = async (x: number): Promise<number> => {
      vCell.setValue(x);
      await waitForRecalc(ctx.api);
      return coerceNumeric(fCell.getRawValue()) ?? Number.NaN;
    };

    const initialX = coerceNumeric(vCell.getRawValue()) ?? 1;
    let x0 = initialX;
    let y0 = await evalAt(x0);
    if (!Number.isFinite(y0)) return 'Công thức trả về giá trị không phải số.';
    if (Math.abs(y0 - targetValue) < 1e-4) {
      return `Ô ${formulaCellRef} đã đạt sẵn mục tiêu (${targetValue.toLocaleString('en-US')}).`;
    }

    let x1 = x0 === 0 ? 10 : x0 * 1.1;
    let y1 = await evalAt(x1);

    for (let iter = 0; iter < 24; iter++) {
      if (!Number.isFinite(y1)) break;
      const err = y1 - targetValue;
      if (Math.abs(err) <= Math.max(0.01, Math.abs(targetValue) * 1e-6)) break;
      const denom = y1 - y0;
      if (Math.abs(denom) < 1e-9) {
        x1 += stepFallback(x1);
      } else {
        const nextX = x1 - err * ((x1 - x0) / denom);
        x0 = x1;
        y0 = y1;
        x1 = nextX;
      }
      y1 = await evalAt(x1);
    }

    function stepFallback(v: number) {
      return Math.abs(v) > 1 ? v * 0.05 : 1;
    }

    const roundedX = Math.round(x1 * 10000) / 10000;
    const finalY = await evalAt(roundedX);
    setSavedStatus('saving');
    return `Đã tìm ra nghiệm: Đặt ${variableCellRef.toUpperCase()} = ${roundedX.toLocaleString('en-US')} → ${formulaCellRef.toUpperCase()} đạt ${finalY.toLocaleString('en-US')}`;
  };

  const embedBase64ImageAtSelection = useCallback(
    async (dataUrl: string, widthPx: number, heightPx: number, colOffsetCells = 0) => {
      const ctx = getEditableContext();
      if (!ctx) return;
      const r = ctx.fRange.getRange();
      const col = Math.max(0, r.startColumn + colOffsetCells);
      const row = Math.max(0, r.startRow);
      const img = await ctx.fWorksheet
        .newOverGridImage()
        .setSource(dataUrl, ImageSourceType.BASE64)
        .setColumn(col)
        .setRow(row)
        .setWidth(widthPx)
        .setHeight(heightPx)
        .buildAsync();
      ctx.fWorksheet.insertImages([img]);
      setSavedStatus('saving');
    },
    [setSavedStatus, getEditableContext]
  );

  const uniqueSheetName = useCallback((base: string): string => {
    const ctx = getActiveContext();
    const taken = new Set((ctx?.fWorkbook.getSheets() ?? []).map((s) => s.getSheetName()));
    const clean = base.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Trang tính';
    if (!taken.has(clean)) return clean;
    for (let i = 2; i < 200; i++) {
      const candidate = `${clean.slice(0, 26)} ${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${clean.slice(0, 20)} ${Date.now() % 10000}`;
  }, [getActiveContext]);

  const writeGridToNewSheet = useCallback(
    (baseName: string, grid: GridValue[][], boldRows: number[] = [0], columnFormats: (string | null)[] = []) => {
      const ctx = getEditableContext();
      if (!ctx || grid.length === 0) return null;
      const width = Math.max(...grid.map((r) => r.length));
      const normalized = grid.map((r) => Array.from({ length: width }, (_, c) => (r[c] === null || r[c] === undefined ? '' : r[c])));
      const sheet = ctx.fWorkbook.insertSheet(uniqueSheetName(baseName));
      ctx.fWorkbook.setActiveSheet(sheet);
      sheet.getRange(0, 0, normalized.length, width).setValues(normalized as (string | number | boolean)[][]);
      for (const r of boldRows) {
        if (r < normalized.length) sheet.getRange(r, 0, 1, width).setFontWeight('bold');
      }
      sheet.getRange(0, 0, 1, width).setBackgroundColor('#e8f5ee');
      sheet.getRange(0, 0, normalized.length, width).setBorder(BorderType.ALL, BorderStyleTypes.THIN, '#cbd5e1');
      estimateColumnWidths(grid).forEach((px, c) => sheet.setColumnWidth(c, px));
      for (let c = 0; c < width; c++) {
        const fmt = columnFormats[c] ?? numberFormatForValues(normalized.slice(1).map((r) => r[c]));
        if (fmt && normalized.length > 1) sheet.getRange(1, c, normalized.length - 1, 1).setNumberFormat(fmt);
      }
      setSavedStatus('saving');
      return sheet;
    },
    [setSavedStatus, getEditableContext, uniqueSheetName]
  );

  const readTableAtSelection = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return null;
    const raw = ctx.fRange.getRange();
    const a1 = raw.endRow > raw.startRow ? activeRangeA1 : getSmartDataRangeA1();
    const parsed = parseA1Range(a1);
    if (!parsed) return null;
    const grid = ctx.fWorksheet
      .getRange(parsed.startRow, parsed.startColumn, parsed.endRow - parsed.startRow + 1, parsed.endColumn - parsed.startColumn + 1)
      .getRawValues();
    if (grid.length < 2) return null;
    const headers = grid[0].map((h, i) => (h === null || h === undefined || h === '' ? `Cột ${colIndexToLetter(parsed.startColumn + i)}` : String(h)));
    const rows = grid.slice(1).filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''));
    const numericColumns = headers
      .map((_, c) => c)
      .filter((c) => rows.length > 0 && rows.filter((r) => coerceNumeric(r[c]) !== null).length >= Math.ceil(rows.length / 2));
    const formats = headers.map((_, c) => {
      const st = ctx.fWorksheet.getRange(parsed.startRow + 1, parsed.startColumn + c, 1, 1).getCellStyleData() as CellStyle | null;
      const pattern = st?.n?.pattern;
      return pattern && pattern !== 'General' ? pattern : numberFormatForValues(rows.map((r) => r[c]));
    });
    return { a1, parsed, headers, rows: rows as GridValue[][], numericColumns, formats };
  }, [getActiveContext, activeRangeA1, getSmartDataRangeA1]);

  const openTableTool = useCallback(
    (kind: 'customSort' | 'subtotal' | 'advFilter' | 'dataCleaning' | 'fuzzyReconcile' | 'sheetSql' | 'slicer' | 'pythonSandbox' | 'choropleth') => {
      const table = readTableAtSelection();
      if (!table) {
        ui.toast('Hãy chọn vùng dữ liệu có dòng tiêu đề và ít nhất 1 dòng số liệu', true);
        return;
      }
      setProTable(table);
      setModal(kind);
    },
    [readTableAtSelection, ui, setModal]
  );

  const handleCustomSort = (levels: SortLevel[], hasHeader: boolean) => {
    const ctx = getEditableContext();
    if (!ctx || !proTable) return;
    const p = proTable.parsed;
    const top = hasHeader ? p.startRow + 1 : p.startRow;
    if (p.endRow < top) return;
    ctx.fWorksheet
      .getRange(top, p.startColumn, p.endRow - top + 1, p.endColumn - p.startColumn + 1)
      .sort(levels.map((l) => ({ column: l.column, ascending: l.ascending })));
    setModal(null);
    setSavedStatus('saving');
    ui.toast(`Đã sắp xếp ${p.endRow - top + 1} dòng theo ${levels.length} cấp`);
  };

  const handleSubtotal = (groupCol: number, fn: SubtotalFn, valueCols: number[]) => {
    if (!proTable) return;
    const res = buildSubtotalGrid(proTable.headers, proTable.rows, groupCol, fn, valueCols);
    const sheet = writeGridToNewSheet(`Tổng phụ ${activeSheetName}`, res.grid, [0, ...res.subtotalRows, res.grandTotalRow], proTable.formats);
    if (!sheet) return;
    const width = proTable.headers.length;
    for (const r of res.subtotalRows) sheet.getRange(r, 0, 1, width).setBackgroundColor('#f1f5f9');
    sheet.getRange(res.grandTotalRow, 0, 1, width).setBackgroundColor('#dcfce7');
    setModal(null);
    ui.toast(`Đã tạo ${res.groupCount} nhóm tổng phụ (${SUBTOTAL_FN_LABELS[fn]}) ở Sheet mới`);
  };

  const handleAdvancedFilter = (criteria: FilterCriterion[], mode: 'and' | 'or', unique: boolean) => {
    if (!proTable) return;
    const kept = filterRecords(proTable.rows, criteria, mode, unique) as GridValue[][];
    const sheet = writeGridToNewSheet(`Lọc ${activeSheetName}`, [proTable.headers, ...kept], [0], proTable.formats);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã xuất ${kept.length}/${proTable.rows.length} dòng khớp điều kiện ra Sheet mới`);
  };

  const handleExportQueryResults = (resHeaders: string[], resRows: (string | number | boolean | null)[][]) => {
    const sheet = writeGridToNewSheet(`Truy vấn SQL`, [resHeaders, ...resRows], [0]);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã xuất ${resRows.length} dòng kết quả SQL ra Sheet mới`);
  };

  const handleApplyCleaned = (newHeaders: string[], newRows: GridValue[][], columnSources: number[]) => {
    const ctx = getEditableContext();
    if (!ctx || !proTable) return;
    const p = proTable.parsed;
    const sheet = ctx.fWorksheet;
    const oldHeight = p.endRow - p.startRow + 1;
    const oldWidth = p.endColumn - p.startColumn + 1;
    const width = newHeaders.length;
    const newFormats = columnSources.map((src) => (src >= 0 ? proTable.formats[src] ?? null : null));
    const toNewSheet = (reason: string) => {
      const target = writeGridToNewSheet(`Làm sạch ${activeSheetName}`, [newHeaders, ...newRows], [0], newFormats);
      if (!target) return;
      setModal(null);
      ui.toast(`${reason}, nên kết quả ${newRows.length} dòng được ghi ra Sheet mới, bảng gốc giữ nguyên`);
    };
    const formulas = sheet.getRange(p.startRow, p.startColumn, oldHeight, oldWidth).getFormulas();
    if (formulas.some((row) => row.some((f) => typeof f === 'string' && f.trim() !== ''))) {
      toNewSheet('Bảng có công thức');
      return;
    }
    if (width > oldWidth) {
      const spill = sheet.getRange(p.startRow, p.endColumn + 1, Math.max(oldHeight, newRows.length + 1), width - oldWidth).getRawValues();
      if (spill.some((row) => row.some((v) => v !== null && v !== undefined && v !== ''))) {
        toNewSheet('Các cột bên phải bảng đang có dữ liệu');
        return;
      }
    }
    sheet.getRange(p.startRow, p.startColumn, oldHeight, oldWidth).clearContent();
    const norm = [newHeaders, ...newRows].map((r) => Array.from({ length: width }, (_, c) => (r[c] === null || r[c] === undefined ? '' : r[c])));
    sheet.getRange(p.startRow, p.startColumn, norm.length, width).setValues(norm as (string | number | boolean)[][]);
    sheet.getRange(p.startRow, p.startColumn, 1, width).setFontWeight('bold');
    if (newRows.length) {
      columnSources.forEach((src, c) => {
        if (src === c) return;
        sheet.getRange(p.startRow + 1, p.startColumn + c, newRows.length, 1).setNumberFormat(newFormats[c] ?? 'General');
      });
    }
    setModal(null);
    setSavedStatus('saving');
    ui.toast(`Đã làm sạch và cập nhật ${newRows.length} dòng dữ liệu`);
  };

  const handleInsertVietQr = async (card: VietQrCard) => {
    try {
      await embedBase64ImageAtSelection(card.dataUrl, Math.round(card.width / 2.5), Math.round(card.height / 2.5));
      setModal(null);
      ui.toast(`Đã chèn mã VietQR tại ô ${activeCellA1}`);
    } catch {
      ui.toast('Không chèn được mã VietQR', true);
    }
  };

  const openWorkbookDoctor = () => {
    setDoctorData(diagnoseWorkbook(captureHydratedWorkbook()));
    setModal('workbookDoctor');
  };

  const handleCleanWorkbook = async () => {
    const ctx = getEditableContext();
    if (!ctx || !doctorData) throw new Error('Không có sổ tính để dọn');
    const draft: SheetContent = { kind: 'sheet', workbook: captureHydratedWorkbook(), comments, printSettings, outlines, macros, vba: vbaProject ?? undefined };
    try {
      const saved = await sourceStorage.saveVersion(meta.id, draft, 'Trước khi tối ưu');
      setVersions((prev) => [saved, ...prev]);
    } catch {
      ui.toast('Chưa lưu được mốc an toàn nên chưa dọn dẹp. Hãy thử lại.', true);
      throw new Error('snapshot failed');
    }
    const activeName = activeSheetName;
    const { cleaned } = diagnoseWorkbook(draft.workbook);
    ctx.fWorkbook.dispose();
    ctx.api.createWorkbook(cleaned as never);
    recalculateAndBindWorkbook(ctx.api);
    const restored = ctx.api.getActiveWorkbook()?.getSheetByName(activeName);
    if (restored) ctx.api.getActiveWorkbook()?.setActiveSheet(restored);
    setSavedStatus('saving');
    setTimeout(() => syncUiFromSelection(), 90);
    ui.toast('Đã tối ưu sổ tính, mốc "Trước khi tối ưu" nằm trong Lịch sử');
  };

  const handleExportQuotes = (resHeaders: string[], resRows: (string | number)[][]) => {
    const sheet = writeGridToNewSheet('Giá thị trường', [resHeaders, ...resRows], [0], [null, null, null, '#,##0.##', '#,##0.##', '0.00%']);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã chèn ${resRows.length} mã giá thị trường vào Sheet mới`);
  };

  const handleExportChoropleth = (resHeaders: string[], resRows: (string | number)[][]) => {
    const sheet = writeGridToNewSheet('Phân bổ tỉnh thành', [resHeaders, ...resRows], [0, resRows.length - 3, resRows.length - 2, resRows.length - 1, resRows.length], [null, null, null, '0.0%', '#,##0']);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã xuất báo cáo ${resRows.length - 4} tỉnh thành và 3 miền vào Sheet mới`);
  };

  const openWorkbookDiff = async () => {
    const sheets = snapshotWorkbook(captureHydratedWorkbook());
    let versions: DiffVersion[] = [];
    try {
      versions = (await listVersions(meta.id))
        .filter((v) => v.content && 'workbook' in v.content && v.content.workbook)
        .map((v) => ({ id: v.id, label: v.label, timestamp: v.timestamp, sheets: snapshotWorkbook((v.content as SheetContent).workbook) }));
    } catch {
      ui.toast('Không đọc được các bản lưu, chỉ so sánh giữa các trang tính hiện tại', true);
    }
    setDiffData({ sheets, versions });
    setModal('workbookDiff');
  };

  const handleExportDiffReport = (resHeaders: string[], resRows: (string | number | boolean | null)[][]) => {
    const sheet = writeGridToNewSheet('Đối chiếu Diff', [resHeaders, ...resRows], [0]);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã xuất ${resRows.length} biến động đối chiếu vào Sheet mới`);
  };

  const handleExportPythonResult = (resHeaders: string[], resRows: (string | number | boolean | null)[][]) => {
    const sheet = writeGridToNewSheet('Python DataFrame', [resHeaders, ...resRows], [0]);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã xuất ${resRows.length} dòng kết quả Python ra Sheet mới`);
  };

  const handleApplySlicerFilter = (colIndex: number, selectedValues: string[]) => {
    if (!proTable) return;
    const setVals = new Set(selectedValues);
    const filtered = proTable.rows.filter((r) => {
      return setVals.has(slicerKey(r[colIndex]));
    });
    const colName = proTable.headers[colIndex] || `Cột ${colIndex + 1}`;
    const sheet = writeGridToNewSheet(`Lọc ${colName}`, [proTable.headers, ...filtered], [0], proTable.formats);
    if (!sheet) return;
    setModal(null);
    ui.toast(`Đã lọc ${filtered.length}/${proTable.rows.length} dòng theo Slicer ra Sheet mới`);
  };

  const handleDescriptiveStats = () => {
    const table = readTableAtSelection();
    if (!table) {
      ui.toast('Hãy chọn vùng dữ liệu có dòng tiêu đề và cột số', true);
      return;
    }
    const stats = describeColumns(table.headers, table.rows);
    if (!stats.length) {
      ui.toast('Vùng chọn không có cột số nào để thống kê', true);
      return;
    }
    const sheet = writeGridToNewSheet(`Thống kê ${activeSheetName}`, buildStatisticsGrid(stats));
    if (!sheet) return;
    sheet.getRange(1, 0, STAT_ROW_LABELS.length, 1).setFontWeight('bold');
    sheet.getRange(1, 1, STAT_ROW_LABELS.length, stats.length).setNumberFormat('#,##0.00');
    ui.toast(`Đã lập bảng thống kê mô tả cho ${stats.length} cột số (${table.rows.length} quan sát)`);
  };

  const handleRunDataTable = async (inputRef: string, outputRef: string, values: number[]): Promise<string> => {
    const ctx = getEditableContext();
    if (!ctx) return 'Bảng tính đang khoá hoặc chưa sẵn sàng.';
    const inCoord = parseA1Range(inputRef);
    const outCoord = parseA1Range(outputRef);
    if (!inCoord || !outCoord) return 'Địa chỉ ô không hợp lệ (ví dụ: B3 và E8).';
    const inCell = ctx.fWorksheet.getRange(inCoord.startRow, inCoord.startColumn, 1, 1);
    const outCell = ctx.fWorksheet.getRange(outCoord.startRow, outCoord.startColumn, 1, 1);
    if (!outCell.getFormula()) return `Ô ${outputRef.toUpperCase()} không chứa công thức nên không phụ thuộc ô đầu vào.`;
    if (inCell.getFormula()) return `Ô đầu vào ${inputRef.toUpperCase()} đang là công thức; hãy chọn ô nhập số.`;
    const original = inCell.getRawValue();
    const results: { input: number; output: number | string }[] = [];
    for (const v of values) {
      inCell.setValue(v);
      await waitForRecalc(ctx.api);
      const raw = outCell.getRawValue();
      results.push({ input: v, output: coerceNumeric(raw) ?? String(raw ?? '') });
    }
    inCell.setValue(original === null || original === undefined ? '' : (original as string | number | boolean));
    await waitForRecalc(ctx.api);
    const patternOf = (cell: { getCellStyleData: () => unknown }) => {
      const pattern = (cell.getCellStyleData() as CellStyle | null)?.n?.pattern;
      return pattern && pattern !== 'General' ? pattern : null;
    };
    const created = writeGridToNewSheet(
      `What-If ${inputRef.toUpperCase()}`,
      buildDataTableGrid(`Giá trị ${inputRef.toUpperCase()}`, `Kết quả ${outputRef.toUpperCase()}`, results),
      [0],
      [patternOf(inCell), patternOf(outCell)]
    );
    if (!created) return 'Không tạo được Sheet kết quả.';
    return `Đã thử ${results.length} giá trị và ghi bảng kết quả ra Sheet mới. Ô ${inputRef.toUpperCase()} đã trả về giá trị cũ.`;
  };

  const handleInsertSymbol = (symbol: string) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const cell = ctx.fWorksheet.getRange(ctx.fRange.getRange().startRow, ctx.fRange.getRange().startColumn, 1, 1);
    if (cell.getFormula()) {
      ui.toast('Ô đang chứa công thức; hãy chọn ô văn bản để chèn ký hiệu', true);
      return;
    }
    const current = cell.getRawValue();
    cell.setValue(`${current === null || current === undefined ? '' : String(current)}${symbol}`);
    setModal(null);
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã chèn "${symbol}" vào ${activeCellA1}`);
  };

  const handleInsertShape = async (spec: ShapeSpec) => {
    if (isProtectedRef.current) {
      getEditableContext();
      return;
    }
    try {
      const png = await rasterizeSvg(buildShapeSvg(spec), spec.width, spec.height);
      await embedBase64ImageAtSelection(png, spec.width, spec.height);
      setModal(null);
      ui.toast(`Đã chèn ${SHAPE_LABELS[spec.kind].toLowerCase()} tại ${activeCellA1}`);
    } catch {
      ui.toast('Không dựng được hình, hãy thử lại', true);
    }
  };

  const handleGoToSpecial = (kind: SpecialCellKind, action: 'select' | 'highlight'): string => {
    const ctx = action === 'highlight' ? getEditableContext() : getActiveContext();
    if (!ctx) return 'Bảng tính đang khoá hoặc chưa sẵn sàng.';
    const scope = gotoScope ?? ctx.fRange.getRange();
    const range = ctx.fWorksheet.getRange(scope.startRow, scope.startColumn, scope.endRow - scope.startRow + 1, scope.endColumn - scope.startColumn + 1);
    const hits = findSpecialCells(range.getRawValues(), range.getFormulas(), kind);
    if (!hits.length) return `Không có ô nào thuộc loại "${SPECIAL_CELL_LABELS[kind]}" trong ${formatA1Range(scope.startRow, scope.startColumn, scope.endRow, scope.endColumn)}.`;
    const rects = cellsToRects(hits.map((h) => ({ row: h.row + scope.startRow, col: h.col + scope.startColumn })));
    if (action === 'highlight') {
      for (const r of rects) ctx.fWorksheet.getRange(r.startRow, r.startColumn, r.endRow - r.startRow + 1, r.endColumn - r.startColumn + 1).setBackgroundColor('#fef08a');
      setSavedStatus('saving');
      return `Đã tô vàng ${hits.length} ô (${rects.length} vùng).`;
    }
    const selections = rects.slice(0, 300).map((r, i) => ({
      range: { ...r, rangeType: 0 },
      primary:
        i === 0
          ? { startRow: r.startRow, startColumn: r.startColumn, endRow: r.startRow, endColumn: r.startColumn, actualRow: r.startRow, actualColumn: r.startColumn, isMerged: false, isMergedMainCell: false }
          : null,
      style: null,
    }));
    void ctx.api
      .executeCommand('sheet.operation.set-selections', {
        unitId: ctx.fWorkbook.getId(),
        subUnitId: ctx.fWorksheet.getSheetId(),
        selections,
        reveal: true,
      })
      .catch(() => ctx.fWorksheet.getRange(rects[0].startRow, rects[0].startColumn, 1, 1).activate());
    return `Đã chọn ${hits.length} ô trong ${rects.length} vùng: ${rects.slice(0, 6).map(rectToA1).join(', ')}${rects.length > 6 ? ' …' : ''}`;
  };

  const openGoToSpecial = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    if (raw.endRow > raw.startRow || raw.endColumn > raw.startColumn) {
      setGotoScope({ startRow: raw.startRow, startColumn: raw.startColumn, endRow: raw.endRow, endColumn: raw.endColumn });
    } else {
      const p = parseA1Range(getSmartDataRangeA1());
      setGotoScope(p ? { startRow: p.startRow, startColumn: p.startColumn, endRow: p.endRow, endColumn: p.endColumn } : { ...raw });
    }
    setModal('gotoSpecial');
  };

  const handleOpenAccessibility = () => {
    const wb = captureHydratedWorkbook();
    const input: AccessibilitySheetInput[] = wb.sheetOrder
      .map((id) => wb.sheets[id])
      .filter(Boolean)
      .map((raw) => {
        const sh = inlineSheetStyles(raw, wb.styles ?? {});
        const cells: AccessibilitySheetInput['cells'] = [];
        for (const [rKey, rowObj] of Object.entries(sh.cellData ?? {})) {
          for (const [cKey, cell] of Object.entries(rowObj ?? {})) {
            if (!cell) continue;
            const st = typeof cell.s === 'object' && cell.s ? cell.s : null;
            cells.push({ row: Number(rKey), col: Number(cKey), value: cell.v, fontColor: st?.cl?.rgb, background: st?.bg?.rgb });
          }
        }
        return { name: sh.name, hidden: sh.hidden === 1, mergeCount: (sh.mergeData ?? []).length, cells };
      });
    setA11yIssues(auditAccessibility(input));
    setModal('a11y');
  };

  const handleSheetOp = async (op: 'hide' | 'unhideAll' | 'moveLeft' | 'moveRight') => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fWorkbook, fWorksheet } = ctx;
    const sheets = fWorkbook.getSheets();
    if (op === 'hide') {
      if (sheets.filter((s) => !s.isSheetHidden()).length <= 1) {
        ui.toast('Phải còn ít nhất 1 Sheet hiển thị', true);
        return;
      }
      const name = fWorksheet.getSheetName();
      fWorksheet.hideSheet();
      ui.toast(`Đã ẩn Sheet "${name}"`);
    } else if (op === 'unhideAll') {
      const hidden = sheets.filter((s) => s.isSheetHidden());
      if (!hidden.length) {
        ui.toast('Không có Sheet nào đang ẩn');
        return;
      }
      hidden.forEach((s) => s.showSheet());
      ui.toast(`Đã hiện lại ${hidden.length} Sheet: ${hidden.map((s) => s.getSheetName()).join(', ')}`);
    } else {
      const idx = sheets.findIndex((s) => s.getSheetId() === fWorksheet.getSheetId());
      const target = op === 'moveLeft' ? idx - 1 : idx + 1;
      if (target < 0 || target >= sheets.length) {
        ui.toast(op === 'moveLeft' ? 'Sheet đã ở đầu' : 'Sheet đã ở cuối');
        return;
      }
      fWorkbook.moveSheet(fWorksheet, target);
      ui.toast(`Đã chuyển "${fWorksheet.getSheetName()}" sang vị trí ${target + 1}`);
    }
    setSavedStatus('saving');
  };

  const openFormatCells = useCallback(() => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const st = (ctx.fRange.getCellStyleData() as CellStyle | null) ?? {};
    const h = ctx.fRange.getHorizontalAlignment();
    const v = ctx.fRange.getVerticalAlignment();
    const initial: FormatCellsState = {
      numberFormat: st.n?.pattern || 'General',
      hAlign: h === 'center' ? 'center' : h === 'normal' || h === 'right' ? 'normal' : 'left',
      vAlign: v === 'top' ? 'top' : v === 'middle' ? 'middle' : 'bottom',
      wrap: Boolean(ctx.fRange.getWrap()),
      rotation: st.tr?.a ?? 0,
      fontFamily: st.ff || DEFAULT_CELL_FONT_FAMILY,
      fontSize: st.fs || 11,
      bold: Boolean(st.bl),
      italic: Boolean(st.it),
      underline: Boolean(st.ul?.s),
      strike: Boolean(st.st?.s),
      fontColor: st.cl?.rgb || '#0f172a',
      fill: st.bg?.rgb || '',
      border: 'keep',
      borderColor: borderColor || '#0f172a',
    };
    const raw = ctx.fRange.getRange();
    setFormatCellsInit({ state: initial, sample: ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, 1, 1).getRawValue() });
    setModal('formatCells');
  }, [getActiveContext, borderColor, setModal]);

  const handleApplyFormatCells = (next: FormatCellsState) => {
    const ctx = getEditableContext();
    if (!ctx || !formatCellsInit) return;
    const prev = formatCellsInit.state;
    const r = ctx.fRange;
    if (next.numberFormat !== prev.numberFormat) r.setNumberFormat(next.numberFormat);
    if (next.hAlign !== prev.hAlign) r.setHorizontalAlignment(next.hAlign);
    if (next.vAlign !== prev.vAlign) r.setVerticalAlignment(next.vAlign);
    if (next.wrap !== prev.wrap) r.setWrap(next.wrap);
    if (next.rotation !== prev.rotation) r.setTextRotation(next.rotation);
    if (next.fontFamily !== prev.fontFamily) r.setFontFamily(next.fontFamily);
    if (next.fontSize !== prev.fontSize) r.setFontSize(next.fontSize);
    if (next.bold !== prev.bold) r.setFontWeight(next.bold ? 'bold' : 'normal');
    if (next.italic !== prev.italic) r.setFontStyle(next.italic ? 'italic' : 'normal');
    if (next.underline !== prev.underline || next.strike !== prev.strike) {
      r.setFontLine(next.underline ? 'underline' : next.strike ? 'line-through' : 'none');
    }
    if (next.fontColor !== prev.fontColor) r.setFontColor(next.fontColor);
    if (next.fill !== prev.fill) r.setBackgroundColor(next.fill || '#ffffff');
    if (next.border !== 'keep') {
      if (next.border === 'none') r.setBorder(BorderType.ALL, BorderStyleTypes.NONE);
      else if (next.border === 'all') r.setBorder(BorderType.ALL, BorderStyleTypes.THIN, next.borderColor);
      else if (next.border === 'outside') r.setBorder(BorderType.OUTSIDE, BorderStyleTypes.THIN, next.borderColor);
      else if (next.border === 'thickOutside') r.setBorder(BorderType.OUTSIDE, BorderStyleTypes.MEDIUM, next.borderColor);
      else if (next.border === 'bottom') r.setBorder(BorderType.BOTTOM, BorderStyleTypes.THIN, next.borderColor);
    }
    setModal(null);
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã áp dụng định dạng ô cho ${activeRangeA1}`);
  };

  const openFormatCellsRef = useRef(openFormatCells);
  useEffect(() => {
    openFormatCellsRef.current = openFormatCells;
  }, [openFormatCells]);

  const handleUploadImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      const probe = new window.Image();
      probe.onload = async () => {
        const maxW = 420;
        const ratio = probe.width > maxW ? maxW / probe.width : 1;
        await embedBase64ImageAtSelection(dataUrl, Math.round(probe.width * ratio), Math.round(probe.height * ratio));
        ui.toast(`Đã chèn ảnh "${file.name}" vào ${activeCellA1}`);
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePivotSheet = (config: {
    rowField: number;
    colField: number;
    valueField: number;
    aggFn: PivotAggFn;
    targetSheetName: string;
  }) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const srcA1 = getSmartDataRangeA1();
    const rawVals = readRangeValuesByA1(srcA1);
    const { headers, rows } = extractTableRecords(rawVals);
    const { sheet, styles, rowGroupCount } = buildPivotSheetData(config.targetSheetName, headers, rows, config);
    const inlined = inlineSheetStyles(sheet, styles);
    let uniqueName = config.targetSheetName.slice(0, 28);
    let suffix = 1;
    while (ctx.fWorkbook.getSheetByName(uniqueName)) {
      suffix += 1;
      uniqueName = `${config.targetSheetName.slice(0, 24)} (${suffix})`;
    }
    inlined.name = uniqueName;
    const created = ctx.fWorkbook.insertSheet(uniqueName, { sheet: inlined as never });
    ctx.fWorkbook.setActiveSheet(created);
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã tạo báo cáo Pivot "${uniqueName}" (${rowGroupCount} nhóm tổng hợp)`);
  };

  const handleDownloadPrintHtml = (settingsToUse: SheetPrintSettings) => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    const fullHtml = exportSheetToStyledHtml(wb, sh, {
      title: stripSpreadsheetExt(title),
      showGridlines: settingsToUse.showGridlines,
      printArea: settingsToUse.printArea,
      orientation: settingsToUse.orientation,
      paperSize: settingsToUse.paperSize,
      fitToPage: settingsToUse.fitToPage,
      signedBy: settingsToUse.signedBy,
      signedRole: settingsToUse.signedRole,
      signedAt: settingsToUse.signedAt,
      pageBreakRows: settingsToUse.pageBreaks?.[sh.id],
      standalone: true,
    });
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `${stripSpreadsheetExt(title)}-${sh.name}.html`);
    ui.toast('Đã tải tệp bản in HTML Vector sắc nét');
  };

  const workbookWithAutomation = (withVba: boolean): WorkbookData => {
    const wb = captureHydratedWorkbook();
    if (macros.length) wb.automation = { version: 1, macros };
    if (!withVba) return wb;
    const base: VbaProjectData = vbaProject ?? { modules: [], codePage: 1252 };
    const kept = base.modules.filter((module) => module.name !== RECORDED_VBA_MODULE);
    if (!macros.length) {
      wb.vba = { ...base, modules: kept };
      return wb;
    }
    const reserved = new Set([...kept.map((module) => module.name), ...listProcedures(vbaSources({ ...base, modules: kept })).procedures.map((proc) => proc.name)]);
    const converted = recordedMacrosToVba(macros, reserved);
    const recordedModule: VbaModuleData = {
      name: RECORDED_VBA_MODULE,
      kind: 'standard',
      code: converted.code,
      attributes: defaultAttributes({ name: RECORDED_VBA_MODULE, kind: 'standard' }),
      procAttributes: converted.procAttributes,
    };
    wb.vba = { ...base, modules: [...kept, recordedModule] };
    return wb;
  };

  const handleExportXlsx = async () => {
    try {
      ui.showBusy('Đang xuất tệp Excel (.xlsx)…');
      const blob = await exportWorkbookToXlsx(workbookWithAutomation(false));
      downloadBlob(blob, `${stripSpreadsheetExt(title)}.xlsx`);
      const hasVba = !!vbaProject?.modules.some((module) => module.code.trim());
      ui.toast(
        hasVba
          ? `Đã tải xuống "${stripSpreadsheetExt(title)}.xlsx". Tệp .xlsx không chứa được mã VBA; dùng "Xuất .xlsm" để giữ macro cho Excel.`
          : `Đã tải xuống "${stripSpreadsheetExt(title)}.xlsx"`
      );
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất XLSX', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportXlsm = async () => {
    try {
      ui.showBusy('Đang xuất tệp Excel có macro (.xlsm)…');
      const blob = await exportWorkbookToXlsm(workbookWithAutomation(true));
      downloadBlob(blob, `${stripSpreadsheetExt(title)}.xlsm`);
      ui.toast(`Đã tải xuống "${stripSpreadsheetExt(title)}.xlsm" kèm macro VBA${macros.length ? ` (macro đã ghi nằm trong mô-đun ${RECORDED_VBA_MODULE})` : ''}`);
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất XLSM', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportDelimited = (ext: 'csv' | 'tsv') => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    try {
      const blob = ext === 'csv' ? exportSheetToCsv(sh, wb) : exportSheetToTsv(sh, wb);
      downloadBlob(blob, `${stripSpreadsheetExt(title)}.${ext}`);
      ui.toast(`Đã tải xuống "${stripSpreadsheetExt(title)}.${ext}"`);
    } catch (err) {
      ui.toast((err as Error).message || `Không thể xuất tệp .${ext}`, true);
    }
  };

  const handleExportJsonFile = () => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    try {
      const blob = exportSheetToJson(sh, wb);
      downloadBlob(blob, `${stripSpreadsheetExt(title)}.json`);
      ui.toast(`Đã xuất dữ liệu JSON "${stripSpreadsheetExt(title)}.json"`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể xuất tệp JSON', true);
    }
  };

  const handleSplitSingle = async (sheetId: string) => {
    const wb = captureHydratedWorkbook();
    const sh = wb.sheets[sheetId];
    if (!sh) return;
    const blob = await exportSingleSheetToXlsx(wb, sheetId);
    downloadBlob(blob, `${stripSpreadsheetExt(title)} - ${sh.name}.xlsx`);
    ui.toast(`Đã tách Sheet "${sh.name}.xlsx"`);
  };

  const handleSplitAll = async () => {
    const wb = captureHydratedWorkbook();
    for (const sid of wb.sheetOrder) {
      const sh = wb.sheets[sid];
      if (!sh) continue;
      const blob = await exportSingleSheetToXlsx(wb, sid);
      downloadBlob(blob, `${stripSpreadsheetExt(title)} - ${sh.name}.xlsx`);
    }
    ui.toast(`Đã tách thành công ${wb.sheetOrder.length} tệp .xlsx`);
  };

  const appendWorkbookSheetsIntoLive = useCallback(
    (incoming: WorkbookData) => {
      const ctx = getEditableContext();
      if (!ctx) return 0;
      let added = 0;
      let firstCreated: ReturnType<typeof ctx.fWorkbook.insertSheet> | null = null;
      for (const sid of incoming.sheetOrder) {
        const sh = incoming.sheets[sid];
        if (!sh) continue;
        const inlined = inlineSheetStyles(sh, incoming.styles ?? {});
        let candidate = (sh.name || 'Imported').slice(0, 27);
        let n = 1;
        while (ctx.fWorkbook.getSheetByName(candidate)) {
          n += 1;
          candidate = `${(sh.name || 'Sheet').slice(0, 22)} (${n})`;
        }
        inlined.name = candidate;
        const created = ctx.fWorkbook.insertSheet(candidate, { sheet: inlined as never });
        firstCreated = firstCreated ?? created;
        added += 1;
      }
      if (firstCreated) ctx.fWorkbook.setActiveSheet(firstCreated);
      try {
        ctx.api.getFormula()?.executeCalculation();
      } catch {
        void 0;
      }
      setSavedStatus('saving');
      syncUiFromSelection();
      return added;
    },
    [setSavedStatus, getEditableContext, syncUiFromSelection]
  );

  const handleMergeFiles = async (files: FileList) => {
    ui.showBusy('Đang đọc và gộp các trang tính…');
    try {
      let totalSheets = 0;
      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer();
        const parsedWb = await importSpreadsheet(buf, file.name);
        totalSheets += appendWorkbookSheetsIntoLive(parsedWb);
        const notice = describeImportTruncation(parsedWb.importTruncation);
        if (notice) ui.toast(`${file.name}: ${notice}`, true);
      }
      ui.toast(`Đã gộp thêm ${totalSheets} Sheet vào bảng tính hiện tại`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể gộp tệp đã chọn', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleMergeWorkspaceSheet = async (fileId: string) => {
    const loaded = await loadContent(fileId);
    if (!loaded || loaded.kind !== 'sheet') {
      ui.toast('Không tìm thấy dữ liệu bảng tính cần gộp', true);
      return;
    }
    const count = appendWorkbookSheetsIntoLive(loaded.workbook);
    ui.toast(`Đã gộp ${count} Sheet từ Workspace`);
  };

  const handleExportPng = async (scale: number, grid: boolean) => {
    ui.showBusy('Đang kết xuất ảnh PNG sắc nét…');
    try {
      const wb = captureHydratedWorkbook();
      const ctx = getActiveContext();
      const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
      const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
      if (!sh) return;
      const blob = await renderSheetToPngBlob(wb, sh, {
        scale,
        showGridlines: grid,
        title: stripSpreadsheetExt(title),
        signedBy: printSettings.signedBy,
      });
      downloadBlob(blob, `${stripSpreadsheetExt(title)}-${sh.name}.png`);
      ui.toast('Đã tải xuống ảnh PNG độ phân giải cao');
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi kết xuất ảnh PNG', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleRunMacro = (
    macroId: 'normalizeTable' | 'autoNumberStt' | 'moneyWordsCol' | 'highlightVariance' | 'cleanBlankRows' | 'wrapIfError'
  ) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const targetA1 = getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    let detail = '';
    let macroTitle = '';

    if (macroId === 'normalizeTable') {
      macroTitle = 'Chuẩn hoá định dạng Bảng báo cáo';
      handleDataCleanup('trim');
      handleFormatAsTable(TABLE_THEMES[0]);
      ctx.fWorksheet.autoResizeColumns(parsed.startColumn, parsed.endColumn - parsed.startColumn + 1);
      detail = `Chuẩn hoá TRIM, kẻ khung Emerald & AutoFit vùng ${targetA1}`;
    } else if (macroId === 'autoNumberStt') {
      macroTitle = 'Đánh số thứ tự STT tự động';
      const bodyStart = parsed.startRow + 1;
      let count = 0;
      for (let r = bodyStart; r <= parsed.endRow; r++) {
        const nextColVal = String(ctx.fWorksheet.getRange(r, Math.min(parsed.endColumn, parsed.startColumn + 1), 1, 1).getValue() ?? '');
        if (nextColVal.toLowerCase().startsWith('tổng')) break;
        count += 1;
        const cRange = ctx.fWorksheet.getRange(r, parsed.startColumn, 1, 1);
        cRange.setValue(count);
        cRange.setHorizontalAlignment('center');
      }
      detail = `Đã đánh STT 1..${count} tại cột đầu vùng ${targetA1}`;
    } else if (macroId === 'moneyWordsCol') {
      macroTitle = 'Đọc số tiền VNĐ thành chữ';
      handleReadMoneyWords();
      detail = `Chuyển số tiền tại ${activeCellA1} sang câu chữ kế toán tiếng Việt`;
    } else if (macroId === 'highlightVariance') {
      macroTitle = 'Tô màu Âm / Dương tự động';
      const numRange = ctx.fRange.getRange();
      const posRule = ctx.fWorksheet
        .newConditionalFormattingRule()
        .whenNumberGreaterThan(0)
        .setBackground('#dcfce7')
        .setFontColor('#166534')
        .setRanges([numRange])
        .build();
      const negRule = ctx.fWorksheet
        .newConditionalFormattingRule()
        .whenNumberLessThan(0)
        .setBackground('#fee2e2')
        .setFontColor('#991b1b')
        .setBold(true)
        .setRanges([numRange])
        .build();
      ctx.fWorksheet.addConditionalFormattingRule(posRule);
      ctx.fWorksheet.addConditionalFormattingRule(negRule);
      detail = `Tô xanh số > 0 và tô đỏ số < 0 trên vùng ${activeRangeA1}`;
    } else if (macroId === 'cleanBlankRows') {
      macroTitle = 'Xoá các dòng rỗng xen kẽ';
      let deleted = 0;
      for (let r = parsed.endRow; r > parsed.startRow; r--) {
        const rowVals = ctx.fWorksheet.getRange(r, parsed.startColumn, 1, parsed.endColumn - parsed.startColumn + 1).getRawValues()[0] ?? [];
        const hasAny = rowVals.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
        if (!hasAny) {
          ctx.fWorksheet.deleteRows(r, 1);
          deleted += 1;
        }
      }
      detail = `Đã dọn sạch ${deleted} dòng trống trong bảng`;
    } else {
      macroTitle = 'Bọc an toàn IFERROR cho toàn bộ công thức';
      const range = ctx.fWorksheet.getRange(
        parsed.startRow,
        parsed.startColumn,
        parsed.endRow - parsed.startRow + 1,
        parsed.endColumn - parsed.startColumn + 1
      );
      const formulas = range.getFormulas();
      let wrapped = 0;
      for (let r = 0; r < formulas.length; r++) {
        for (let c = 0; c < formulas[r].length; c++) {
          const f = formulas[r][c];
          if (f && !/^=IFERROR\(/i.test(f)) {
            ctx.fWorksheet.getRange(parsed.startRow + r, parsed.startColumn + c, 1, 1).setValue(`=IFERROR(${f.replace(/^=/, '')}, 0)`);
            wrapped += 1;
          }
        }
      }
      detail = `Đã bọc IFERROR cho ${wrapped} ô công thức`;
    }

    setSavedStatus('saving');
    ui.toast(`${macroTitle}: ${detail}`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveNow();
      } else if (mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        setModal('find');
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        syncDefinedNames();
        setModal('goto');
      } else if (mod && e.key === '1') {
        e.preventDefault();
        openFormatCellsRef.current();
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setModal('pageSetup');
      } else if (e.altKey && e.key === '=') {
        e.preventDefault();
        handleAutoSum('SUM');
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        void handleFillRange('down');
      } else if (mod && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void handleFillRange('right');
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleFlashFill();
      } else if (mod && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        handleToggleShowFormulas();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setShowWatchWindow((v) => !v);
      } else if (mod && e.key === ';') {
        e.preventDefault();
        const ctx = getEditableContext();
        if (ctx) {
          ctx.fRange.setValue(new Date().toLocaleDateString('vi-VN'));
          setSavedStatus('saving');
        }
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setSavedStatus,
    handleSaveNow,
    handleAutoSum,
    handleFillRange,
    handleFlashFill,
    handleToggleShowFormulas,
    getActiveContext,
    getEditableContext,
    syncDefinedNames,
    setModal,
    focusMode,
    ui,
  ]);

  const applyOutline = (sheet: NonNullable<ReturnType<typeof getActiveContext>>['fWorksheet'], axis: OutlineAxis, nextGroups: OutlineGroup[]) => {
    const sheetId = sheet.getSheetId();
    const current = outlinesRef.current[sheetId] ?? EMPTY_OUTLINE;
    const changes = visibilityChanges(current[axis], nextGroups);
    for (const run of changes.show) {
      if (axis === 'rows') sheet.showRows(run.start, run.count);
      else sheet.showColumns(run.start, run.count);
    }
    for (const run of changes.hide) {
      if (axis === 'rows') sheet.hideRows(run.start, run.count);
      else sheet.hideColumns(run.start, run.count);
    }
    outlinesRef.current = { ...outlinesRef.current, [sheetId]: { ...current, [axis]: nextGroups } };
    setOutlines((previous) => ({ ...previous, [sheetId]: { ...(previous[sheetId] ?? EMPTY_OUTLINE), [axis]: nextGroups } }));
    setSavedStatus('saving');
  };

  const recordAppStep = (action: AppAction, payload: unknown) => {
    const recorder = recorderRef.current;
    if (!recorder || isReplayingRef.current) return;
    const ctx = getActiveContext();
    if (!ctx) return;
    const range = ctx.fRange.getRange();
    recorder.recordApp(ctx.fWorksheet.getSheetId(), action, payload, { startRow: range.startRow, endRow: range.endRow, startColumn: range.startColumn, endColumn: range.endColumn });
    setRecordedCount(recorder.count);
  };

  const withoutRecording = (run: () => void) => {
    suppressRecordRef.current += 1;
    try {
      run();
    } finally {
      suppressRecordRef.current -= 1;
    }
  };

  const handleOutline = (action: OutlineAction) => {
    recordAppStep('outline', { action });
    withoutRecording(() => performOutline(action));
  };

  const performOutline = (action: OutlineAction) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fWorksheet, fRange } = ctx;
    const box = fRange.getRange();
    const scope = structureScope(box, fWorksheet.getMaxRows(), fWorksheet.getMaxColumns());
    const axis: OutlineAxis = scope === 'columns' ? 'cols' : 'rows';
    const start = axis === 'rows' ? box.startRow : box.startColumn;
    const end = axis === 'rows' ? box.endRow : box.endColumn;
    const outline = outlinesRef.current[fWorksheet.getSheetId()] ?? EMPTY_OUTLINE;
    const groups = outline[axis];
    const target = innermostGroup(groups, start, end);

    if (action === 'clear') {
      if (!outline.rows.length && !outline.cols.length) {
        ui.toast('Trang tính này chưa có nhóm nào', true);
        return;
      }
      applyOutline(fWorksheet, 'rows', []);
      applyOutline(fWorksheet, 'cols', []);
      ui.toast('Đã xoá toàn bộ nhóm (Clear Outline) của trang tính');
      return;
    }
    if (action === 'group') {
      const next = addGroup(groups, start, end);
      if (!next) {
        ui.toast(`Không nhóm được: vùng này đã là một nhóm, cắt ngang nhóm khác hoặc vượt quá ${MAX_OUTLINE_LEVEL} mức`, true);
        return;
      }
      applyOutline(fWorksheet, axis, next);
      ui.toast(`Đã nhóm ${describeGroup(axis, { start, end, collapsed: false })} (mức ${levelAt(next, start)})`);
      return;
    }
    if (action === 'expand') {
      const nearby = groups.filter((group) => group.collapsed && group.start - 1 <= end && group.end + 1 >= start);
      if (!nearby.length) {
        ui.toast('Không có nhóm nào đang thu gọn tại vùng chọn (hãy chọn ô ngay cạnh nhóm đã thu gọn)', true);
        return;
      }
      const outermost = nearby.reduce((best, group) => (group.end - group.start > best.end - best.start ? group : best));
      applyOutline(fWorksheet, axis, setCollapsed(groups, outermost, false));
      ui.toast(`Đã mở rộng nhóm ${describeGroup(axis, outermost)}`);
      return;
    }
    if (!target) {
      ui.toast('Vùng đang chọn không nằm trong nhóm nào', true);
      return;
    }
    if (action === 'ungroup') {
      applyOutline(fWorksheet, axis, removeGroup(groups, start, end) ?? groups);
      ui.toast(`Đã bỏ nhóm ${describeGroup(axis, target)}`);
      return;
    }
    applyOutline(fWorksheet, axis, setCollapsed(groups, target, true));
    ui.toast(`Đã thu gọn nhóm ${describeGroup(axis, target)}`);
  };

  const handleOutlineLevel = (level: number) => {
    recordAppStep('outlineLevel', { level });
    withoutRecording(() => performOutlineLevel(level));
  };

  const performOutlineLevel = (level: number) => {
    setPopover(null);
    const ctx = getEditableContext();
    if (!ctx) return;
    const sheetId = ctx.fWorksheet.getSheetId();
    const outline = outlinesRef.current[sheetId] ?? EMPTY_OUTLINE;
    if (!outline.rows.length && !outline.cols.length) {
      ui.toast('Trang tính này chưa có nhóm nào', true);
      return;
    }
    const nextRows = collapseToLevel(outline.rows, level);
    const nextCols = collapseToLevel(outline.cols, level);
    for (const [axis, before, after] of [['rows', outline.rows, nextRows], ['cols', outline.cols, nextCols]] as const) {
      const changes = visibilityChanges(before, after);
      for (const run of changes.show) {
        if (axis === 'rows') ctx.fWorksheet.showRows(run.start, run.count);
        else ctx.fWorksheet.showColumns(run.start, run.count);
      }
      for (const run of changes.hide) {
        if (axis === 'rows') ctx.fWorksheet.hideRows(run.start, run.count);
        else ctx.fWorksheet.hideColumns(run.start, run.count);
      }
    }
    outlinesRef.current = { ...outlinesRef.current, [sheetId]: { rows: nextRows, cols: nextCols } };
    setOutlines((previous) => ({ ...previous, [sheetId]: { rows: nextRows, cols: nextCols } }));
    setSavedStatus('saving');
    const deepest = Math.max(maxLevel(outline.rows), maxLevel(outline.cols));
    ui.toast(level > deepest ? 'Đã mở rộng toàn bộ nhóm' : `Đang hiện tới mức ${level} của dàn ý`);
  };

  const applyPrintPatch = (patch: Partial<SheetPrintSettings>) => {
    const next = { ...printSettingsRef.current, ...patch };
    printSettingsRef.current = next;
    setPrintSettings(next);
    setSavedStatus('saving');
  };

  const updatePrintSettings = (patch: Partial<SheetPrintSettings>) => {
    const { pageBreaks: _pageBreaks, signedBy: _signedBy, signedRole: _signedRole, signedAt: _signedAt, ...recorded } = patch;
    if (Object.keys(recorded).length) recordAppStep('printSetting', recorded);
    applyPrintPatch(patch);
  };

  const handlePageBreak = (action: 'toggle' | 'clear') => {
    recordAppStep('pageBreak', { action });
    withoutRecording(() => performPageBreak(action));
  };

  const performPageBreak = (action: 'toggle' | 'clear') => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const sheetId = ctx.fWorksheet.getSheetId();
    const current = printSettingsRef.current.pageBreaks?.[sheetId] ?? [];
    if (action === 'clear') {
      if (!current.length) {
        ui.toast('Trang tính này chưa có ngắt trang thủ công', true);
        return;
      }
      applyPrintPatch({ pageBreaks: { ...printSettingsRef.current.pageBreaks, [sheetId]: [] } });
      setSavedStatus('saving');
      ui.toast(`Đã xoá ${current.length} ngắt trang thủ công của trang tính`);
      return;
    }
    const row = ctx.fRange.getRange().startRow;
    if (row === 0) {
      ui.toast('Hãy chọn một ô từ hàng 2 trở xuống: ngắt trang được đặt phía trên hàng đang chọn', true);
      return;
    }
    const next = toggleBreak(current, row);
    applyPrintPatch({ pageBreaks: { ...printSettingsRef.current.pageBreaks, [sheetId]: next } });
    ui.toast(next.length > current.length ? `Đã chèn ngắt trang phía trên hàng ${row + 1} (xem ở In / Xem trước)` : `Đã bỏ ngắt trang phía trên hàng ${row + 1}`);
  };

  const shiftSheetStructure = (sheetId: string, axis: OutlineAxis, at: number, delta: number) => {
    setOutlines((previous) => {
      const outline = previous[sheetId];
      if (!outline || !outline[axis].length) return previous;
      return { ...previous, [sheetId]: { ...outline, [axis]: shiftGroups(outline[axis], at, delta) } };
    });
    if (axis !== 'rows') return;
    setPrintSettings((previous) => {
      const breaks = previous.pageBreaks?.[sheetId];
      if (!breaks?.length) return previous;
      return { ...previous, pageBreaks: { ...previous.pageBreaks, [sheetId]: shiftBreaks(breaks, at, delta) } };
    });
  };

  const shortcutRunnerRef = useRef<(action: SheetShortcutAction) => void>(() => undefined);
  const runBuiltinMacro = (id: BuiltinMacroId) => {
    switch (id) {
      case 'normalizeTable':
      case 'autoNumberStt':
      case 'moneyWordsCol':
      case 'highlightVariance':
      case 'cleanBlankRows':
      case 'wrapIfError':
        handleRunMacro(id);
        break;
      case 'recalculate':
        shortcutRunnerRef.current('recalculate');
        break;
      case 'save':
        handleSaveNow();
        break;
      case 'print':
        setModal('pageSetup');
        break;
      case 'exportXlsx':
        void handleExportXlsx();
        break;
      case 'toggleFilter':
        handleToggleFilter();
        break;
      case 'nextSheet':
      case 'prevSheet':
      case 'gotoStart':
        shortcutRunnerRef.current(id);
        break;
    }
  };

  const runRecordedMacro = async (macro: SheetMacro) => {
    if (isReplayingRef.current) return;
    if (recorderRef.current) {
      ui.toast('Đang ghi macro: hãy Dừng ghi trước khi chạy macro khác', true);
      return;
    }
    const ctx = getEditableContext();
    if (!ctx) return;
    const { api, fWorkbook, fWorksheet, fRange } = ctx;
    const active = fRange.getRange();
    const rowDelta = macro.relative ? active.startRow - macro.origin.row : 0;
    const columnDelta = macro.relative ? active.startColumn - macro.origin.column : 0;
    const unitId = fWorkbook.getId();
    const homeSheetId = macro.steps[0]?.sheetId ?? '';
    const sheetFor = (sheetId: string) =>
      sheetId === homeSheetId ? fWorksheet : (fWorkbook.getSheets().find((sheet) => sheet.getSheetId() === sheetId) ?? fWorksheet);
    let done = 0;
    isReplayingRef.current = true;
    try {
      for (const step of macro.steps) {
        if (!isReplayable(step)) continue;
        const sheet = sheetFor(step.sheetId);
        if (step.kind === 'select') {
          const box = shiftBox(step.box, rowDelta, columnDelta);
          sheet.getRange(box.startRow, box.startColumn, box.endRow - box.startRow + 1, box.endColumn - box.startColumn + 1).activate();
          continue;
        }
        if (step.kind === 'app') {
          runAppStep(step);
          done += 1;
          continue;
        }
        const params = remapParams(shiftParams(step.params, rowDelta, columnDelta), unitId, sheet.getSheetId());
        await api.executeCommand(step.id, (params ?? undefined) as object | undefined);
        done += 1;
      }
      ui.toast(`Đã chạy macro "${macro.name}" (${done} thao tác)`);
    } catch (err) {
      console.error('Macro replay failed:', err);
      ui.toast(`Macro "${macro.name}" dừng ở thao tác thứ ${done + 1}: ${err instanceof Error ? err.message : 'lỗi không xác định'}`, true);
    } finally {
      isReplayingRef.current = false;
      setSavedStatus('saving');
    }
  };
  runMacroRef.current = (macro) => void runRecordedMacro(macro);

  const runAppStep = (step: Extract<MacroStep, { kind: 'app' }>) => {
    const payload = (step.payload ?? {}) as Record<string, unknown>;
    if (step.action === 'outline') performOutline(String(payload.action) as OutlineAction);
    else if (step.action === 'outlineLevel') performOutlineLevel(Number(payload.level) || 1);
    else if (step.action === 'pageBreak') performPageBreak(payload.action === 'clear' ? 'clear' : 'toggle');
    else applyPrintPatch(payload as Partial<SheetPrintSettings>);
  };

  pasteSnapshotRef.current = (recorder, step) => {
    if (recorderRef.current !== recorder) return;
    const ctx = getActiveContext();
    if (!ctx) return;
    const range = ctx.fRange.getRange();
    const cellCount = (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1);
    if (cellCount > MAX_PASTE_SNAPSHOT_CELLS) return;
    const rows = (ctx.fRange.getCellDatas() ?? []) as Array<Array<Record<string, unknown> | null | undefined>>;
    const value = rows.map((row) => row.map((cell) => (cell ? { v: cell.v, f: cell.f, s: cell.s, t: cell.t, p: cell.p } : {})));
    recorder.replace(step, {
      kind: 'command',
      sheetId: ctx.fWorksheet.getSheetId(),
      id: 'sheet.command.set-range-values',
      params: {
        unitId: ctx.fWorkbook.getId(),
        subUnitId: ctx.fWorksheet.getSheetId(),
        range: { startRow: range.startRow, endRow: range.endRow, startColumn: range.startColumn, endColumn: range.endColumn },
        value: JSON.parse(JSON.stringify(value)),
      },
    });
  };

  const runVbaMacroById = (id: string, project: VbaProjectData | null = vbaProjectRef.current) => {
    const name = id.split('.').pop() ?? id;
    if (!project?.modules.length) {
      ui.toast('Bảng tính chưa có mã VBA', true);
      return;
    }
    if (recorderRef.current) {
      ui.toast('Đang ghi macro: hãy Dừng ghi trước khi chạy macro VBA', true);
      return;
    }
    if (isReplayingRef.current) return;
    const ctx = getEditableContext();
    if (!ctx) return;
    const lines: string[] = [];
    const withTitle = (title: string, prompt: string) => (title && title !== 'Microsoft Excel' ? `${title}\n\n${prompt}` : prompt);
    const host = createExcelHost(ctx.api, {
      msgBox: (prompt, buttons, title) => messageBoxAnswer(buttons, (text) => window.confirm(text), (text) => window.alert(text), withTitle(title, prompt)),
      inputBox: (prompt, title, defaultValue) => window.prompt(withTitle(title, prompt), defaultValue) ?? '',
      statusBar: (text) => {
        if (text) ui.toast(text);
      },
      save: () => handleSaveNow(),
      print: (text) => {
        lines.push(text);
      },
    });
    isReplayingRef.current = true;
    let result: ReturnType<typeof runVbaMacro>;
    try {
      result = runVbaMacro(project, id, host);
    } finally {
      isReplayingRef.current = false;
    }
    if (lines.length) setVbaOutput((previous) => [...previous, ...lines].slice(-MAX_VBA_OUTPUT_LINES));
    setSavedStatus('saving');
    if (result.ok) ui.toast(`Đã chạy macro VBA "${name}"`);
    else ui.toast(`Macro VBA "${name}" dừng: ${result.error}`, true);
  };
  runVbaRef.current = (id) => runVbaMacroById(id);

  const openVbaEditor = (module?: string) => {
    setVbaEditorModule(module);
    setModal('vba');
  };
  openVbaEditorRef.current = () => openVbaEditor();

  const saveVbaModules = (modules: VbaModuleData[]): VbaProjectData => {
    const next: VbaProjectData = { ...(vbaProjectRef.current ?? { codePage: 1252 }), modules };
    vbaProjectRef.current = next;
    setVbaProject(next);
    setSavedStatus('saving');
    return next;
  };

  const handleVbaShortcut = (id: string, letter: string) => {
    const [moduleName, procName] = id.split('.');
    const project = vbaProjectRef.current;
    if (!project || !procName) return;
    const key = procName.toLowerCase();
    saveVbaModules(
      project.modules.map((module) =>
        module.name === moduleName ? { ...module, procAttributes: { ...(module.procAttributes ?? {}), [key]: withProcShortcut(module.procAttributes?.[key], procName, letter) } } : module
      )
    );
    ui.toast(letter ? `Đã gán ${shortcutLabel(letter)} cho macro VBA "${procName}"` : `Đã bỏ phím tắt của macro VBA "${procName}"`);
  };

  const handleConvertToVba = (id: string) => {
    const macro = macros.find((item) => item.id === id);
    if (!macro) return;
    const project = vbaProjectRef.current ?? { modules: [], codePage: 1252 };
    const reserved = new Set([...project.modules.map((module) => module.name), ...listProcedures(vbaSources(project)).procedures.map((proc) => proc.name)]);
    const converted = recordedMacrosToVba([{ ...macro, shortcut: '' }], reserved);
    const body = converted.code.replace(/^Option Explicit\r\n\r\n/, '');
    const existing = project.modules.find((module) => module.name === CONVERTED_VBA_MODULE);
    const nextModule: VbaModuleData = existing
      ? { ...existing, code: `${existing.code.trimEnd()}\r\n\r\n${body}\r\n` }
      : { name: CONVERTED_VBA_MODULE, kind: 'standard', code: `${converted.code}\r\n`, attributes: defaultAttributes({ name: CONVERTED_VBA_MODULE, kind: 'standard' }) };
    saveVbaModules(existing ? project.modules.map((module) => (module === existing ? nextModule : module)) : [...project.modules, nextModule]);
    ui.toast(`Đã viết macro "${macro.name}" thành Sub ${converted.procNames[macro.id]} trong mô-đun ${CONVERTED_VBA_MODULE}`);
    openVbaEditor(CONVERTED_VBA_MODULE);
  };

  const runMacroTarget = (target: MacroTarget) => {
    if (target.kind === 'builtin') {
      runBuiltinMacro(target.id);
      return;
    }
    if (target.kind === 'vba') {
      if (vbaMacros.some((item) => item.id === target.id)) runVbaMacroById(target.id);
      else ui.toast(`Không còn macro VBA "${target.id}". Bật Chế độ thiết kế rồi vào Automate → Chèn nút để gán lại.`, true);
      return;
    }
    const macro = macros.find((item) => item.id === target.id);
    if (!macro) {
      ui.toast('Macro gắn với nút này đã bị xoá. Chọn ô bằng phím mũi tên rồi vào Automate → Chèn nút để gán lại.', true);
      return;
    }
    void runRecordedMacro(macro);
  };

  cellClickRef.current = (row, column) => {
    const ctx = getActiveContext();
    if (!ctx || recorderRef.current || isReplayingRef.current || designModeRef.current) return;
    const custom = ctx.fWorksheet.getRange(row, column, 1, 1).getCustomMetaData();
    const target = decodeTarget(custom?.[MACRO_CELL_KEY]);
    if (target) runMacroTarget(target);
  };

  const handleStartRecording = (options: MacroRecordOptions) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const box = ctx.fRange.getRange();
    recordMetaRef.current = { ...options, origin: { row: box.startRow, column: box.startColumn } };
    recorderRef.current = new MacroRecorder();
    setRecordedCount(0);
    setModal(null);
    ui.toast(`Đang ghi macro "${options.name}". Thao tác trên bảng tính rồi bấm Dừng ghi.`);
  };

  const handleStopRecording = () => {
    const recorder = recorderRef.current;
    const meta = recordMetaRef.current;
    recorderRef.current = null;
    recordMetaRef.current = null;
    setRecordedCount(null);
    if (!recorder || !meta) return;
    const steps = recorder.finish();
    if (!steps.some((step) => step.kind === 'command')) {
      ui.toast('Chưa ghi được thao tác nào nên không lưu macro', true);
      return;
    }
    const macro: SheetMacro = {
      id: `m${Date.now().toString(36)}`,
      name: uniqueMacroName(meta.name, macros),
      description: meta.description,
      shortcut: shortcutProblem(meta.shortcut, macros, '', Object.fromEntries(vbaMacros.filter((item) => item.shortcut).map((item) => [item.shortcut, item.name]))) ? '' : meta.shortcut,
      relative: meta.relative,
      origin: meta.origin,
      steps,
      createdAt: Date.now(),
    };
    setMacros((previous) => [...previous, macro]);
    setSavedStatus('saving');
    ui.toast(`Đã lưu macro "${macro.name}" (${recorder.count} thao tác)${macro.shortcut ? `, phím tắt ${shortcutLabel(macro.shortcut)}` : ''}`);
  };

  const macroButtonTarget = (): MacroTarget | null => {
    const ctx = getActiveContext();
    if (!ctx) return null;
    const box = ctx.fRange.getRange();
    return decodeTarget(ctx.fWorksheet.getRange(box.startRow, box.startColumn, 1, 1).getCustomMetaData()?.[MACRO_CELL_KEY]);
  };

  const handleApplyMacroButton = (label: string, target: MacroTarget, color: MacroButtonColor) => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const { fWorksheet, fRange } = ctx;
    const box = fRange.getRange();
    const isSingleCell = box.startRow === box.endRow && box.startColumn === box.endColumn;
    if (!isSingleCell && !fRange.isMerged()) fRange.merge();
    fWorksheet.getRange(box.startRow, box.startColumn, 1, 1).setValue(label);
    fRange
      .setBackgroundColor(color.background)
      .setFontColor(color.text)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(BorderType.OUTSIDE, BorderStyleTypes.THIN)
      .setCustomMetaData({ [MACRO_CELL_KEY]: encodeTarget(target) });
    setModal(null);
    setSavedStatus('saving');
    ui.toast(`Đã chèn nút "${label}" chạy ${targetLabel(target, macros)}. ${designMode ? 'Tắt Chế độ thiết kế rồi bấm vào nút để chạy.' : 'Bấm chuột vào nút để chạy.'}`);
  };

  const handleRemoveMacroButton = () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    ctx.fRange.setCustomMetaData({ [MACRO_CELL_KEY]: '' });
    ctx.fRange.clearFormat();
    setModal(null);
    setSavedStatus('saving');
    ui.toast('Đã gỡ nút khỏi vùng đang chọn (chữ trong ô được giữ lại)');
  };

  shortcutRunnerRef.current = (action) => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const { api, fWorkbook, fWorksheet, fRange } = ctx;
    const box = fRange.getRange();
    const maxRows = fWorksheet.getMaxRows();
    const maxColumns = fWorksheet.getMaxColumns();
    const rowSpan = box.endRow - box.startRow + 1;
    const colSpan = box.endColumn - box.startColumn + 1;
    const lastRow = Math.max(0, fWorksheet.getLastRow());
    const lastColumn = Math.max(0, fWorksheet.getLastColumn());
    const select = (row: number, column: number, rows = 1, columns = 1) => {
      fWorksheet.getRange(clampIndex(row, maxRows), clampIndex(column, maxColumns), Math.max(1, rows), Math.max(1, columns)).activate();
    };
    const jump = (row: number, column: number) => {
      const targetRow = clampIndex(row, maxRows);
      const targetColumn = clampIndex(column, maxColumns);
      select(targetRow, targetColumn);
      fWorksheet.scrollToCell(targetRow, targetColumn);
    };
    const switchSheet = (offset: number) => {
      const sheets = fWorkbook.getSheets();
      const index = sheets.findIndex((sheet) => sheet.getSheetId() === fWorksheet.getSheetId());
      const target = sheets[index + offset];
      if (target) fWorkbook.setActiveSheet(target);
    };
    const edit = (run: () => void) => {
      if (!getEditableContext()) return;
      run();
      setSavedStatus('saving');
    };
    const copyFromAbove = (asFormula: boolean) => {
      if (box.startRow === 0) return;
      const above = fWorksheet.getRange(box.startRow - 1, box.startColumn, 1, 1);
      const formula = asFormula ? above.getFormula() : '';
      const value = above.getValue();
      edit(() => fWorksheet.getRange(box.startRow, box.startColumn, 1, 1).setValue(formula || (value ?? '')));
    };
    const scope = structureScope(box, maxRows, maxColumns);

    if (isNumberFormatAction(action)) {
      edit(() => fRange.setNumberFormat(EXCEL_NUMBER_FORMATS[action]));
      return;
    }
    switch (action) {
      case 'goTo':
        syncDefinedNames();
        setModal('goto');
        break;
      case 'insertFunction':
        setModal('formulas');
        break;
      case 'recalculate':
        api.getFormula()?.executeCalculation();
        ui.toast('Đã tính lại toàn bộ công thức');
        break;
      case 'saveAs':
        void handleExportXlsx();
        break;
      case 'newSheet':
        void handleStructureMutation('insertSheet');
        break;
      case 'editNote':
        void handleInsertCellNote();
        break;
      case 'insertChart':
        setModal('chart');
        break;
      case 'nameManager':
        syncDefinedNames();
        setModal('nameManager');
        break;
      case 'printPreview':
        setModal('pageSetup');
        break;
      case 'rowStart':
        jump(box.startRow, 0);
        break;
      case 'extendRowStart':
        select(box.startRow, 0, rowSpan, box.endColumn + 1);
        break;
      case 'pageDown':
        jump(box.startRow + PAGE_ROW_STEP, box.startColumn);
        break;
      case 'pageUp':
        jump(box.startRow - PAGE_ROW_STEP, box.startColumn);
        break;
      case 'pageRight':
        jump(box.startRow, box.startColumn + PAGE_COLUMN_STEP);
        break;
      case 'pageLeft':
        jump(box.startRow, box.startColumn - PAGE_COLUMN_STEP);
        break;
      case 'gotoStart':
        jump(0, 0);
        break;
      case 'gotoEnd':
        jump(lastRow, lastColumn);
        break;
      case 'extendToStart':
        select(0, 0, box.endRow + 1, box.endColumn + 1);
        break;
      case 'extendToEnd':
        select(box.startRow, box.startColumn, lastRow - box.startRow + 1, lastColumn - box.startColumn + 1);
        break;
      case 'nextSheet':
        switchSheet(1);
        break;
      case 'prevSheet':
        switchSheet(-1);
        break;
      case 'selectRow':
        select(box.startRow, 0, rowSpan, maxColumns);
        break;
      case 'selectColumn':
        select(0, box.startColumn, maxRows, colSpan);
        break;
      case 'selectAll':
        select(0, 0, maxRows, maxColumns);
        break;
      case 'currentRegion':
        fRange.getDataRegion().activate();
        break;
      case 'showActiveCell':
        fWorksheet.scrollToCell(box.startRow, box.startColumn);
        break;
      case 'bold':
        edit(() => void api.executeCommand('sheet.command.set-range-bold'));
        break;
      case 'italic':
        edit(() => void api.executeCommand('sheet.command.set-range-italic'));
        break;
      case 'underline':
        edit(() => void api.executeCommand('sheet.command.set-range-underline'));
        break;
      case 'strikethrough':
        edit(() => void api.executeCommand('sheet.command.set-range-stroke'));
        break;
      case 'hideColumns':
        void handleStructureMutation('hideCols');
        break;
      case 'unhideColumns':
        void handleStructureMutation('unhideCols');
        break;
      case 'unhideRows':
        void handleStructureMutation('unhideRows');
        break;
      case 'borderOutline':
        edit(() => fRange.setBorder(BorderType.OUTSIDE, BorderStyleTypes.THIN));
        break;
      case 'borderNone':
        edit(() => fRange.setBorder(BorderType.ALL, BorderStyleTypes.NONE));
        break;
      case 'insertCells':
        void handleStructureMutation(scope === 'rows' ? 'insertRowAbove' : scope === 'columns' ? 'insertColLeft' : 'shiftCellsDown');
        break;
      case 'deleteCells':
        void handleStructureMutation(scope === 'rows' ? 'deleteRows' : scope === 'columns' ? 'deleteCols' : 'shiftCellsUp');
        break;
      case 'insertTime':
        edit(() => fRange.setValue(formatClockTime(new Date())));
        break;
      case 'copyFormulaAbove':
        copyFromAbove(true);
        break;
      case 'copyValueAbove':
        copyFromAbove(false);
        break;
      case 'pasteValues':
        void handlePasteMode('values');
        break;
      case 'pasteSpecial':
        setPopover({ kind: 'paste', left: Math.max(8, window.innerWidth / 2 - 125), top: 160 });
        break;
      case 'toggleFormulaBar':
        setShowFormulaBar((visible) => !visible);
        break;
      case 'formatCells':
        openFormatCellsRef.current();
        break;
      case 'tracePrecedents':
        handleTracePrecedents();
        break;
      case 'traceDependents':
        handleTraceDependents();
        break;
      case 'createTable':
        handleFormatAsTable(TABLE_THEMES[0]);
        break;
      case 'redo':
        edit(() => void fWorkbook.redo());
        break;
      case 'macroManager':
        setModal('macros');
        break;
      case 'groupSelection':
        handleOutline('group');
        break;
      case 'ungroupSelection':
        handleOutline('ungroup');
        break;
      case 'zoomIn':
        handleSetZoom(zoomPct + ZOOM_STEP_PCT);
        break;
      case 'zoomOut':
        handleSetZoom(zoomPct - ZOOM_STEP_PCT);
        break;
    }
  };

  useEffect(() => {
    const onShortcutKeyDown = (event: KeyboardEvent) => {
      const letter = shortcutLetter(event);
      const macro = letter ? (macrosRef.current.find((item) => item.shortcut === letter) ?? null) : null;
      const vbaMacro = !macro && letter ? (vbaMacrosRef.current.find((item) => item.shortcut === letter) ?? null) : null;
      const opensVbaEditor = event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'F11';
      const action = macro || vbaMacro || opensVbaEditor ? null : resolveSheetShortcut(event);
      if (!macro && !vbaMacro && !opensVbaEditor && !action) return;
      const target = event.target;
      const isTypingInField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (isTypingInField || isCellEditingRef.current || document.querySelector('.dialog-backdrop')) return;
      event.preventDefault();
      event.stopPropagation();
      if (macro) runMacroRef.current(macro);
      else if (vbaMacro) runVbaRef.current(vbaMacro.id);
      else if (opensVbaEditor) openVbaEditorRef.current();
      else if (action) shortcutRunnerRef.current(action);
    };
    window.addEventListener('keydown', onShortcutKeyDown, true);
    return () => window.removeEventListener('keydown', onShortcutKeyDown, true);
  }, []);

  const handleInsertHyperlink = async () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const existing = ctx.fRange.getHyperLinks()[0];
    const res = await ui.ask({
      title: 'Chèn / Cập nhật Liên kết (Hyperlink)',
      fields: [
        { name: 'url', label: 'Đường dẫn URL hoặc địa chỉ trang', value: existing?.url || 'https://', placeholder: 'https://example.com' },
        { name: 'label', label: 'Văn bản hiển thị trong ô', value: existing?.label || String(ctx.fRange.getValue() ?? '') || 'Mở liên kết' },
      ],
    });
    if (!res?.url) return;
    const url = String(res.url).trim();
    const label = String(res.label || url).trim();
    await ctx.fRange.setHyperLink(url, label);
    setSavedStatus('saving');
    ui.toast(`Đã gắn liên kết vào ô ${activeCellA1}`);
  };

  const handleInsertCellNote = async () => {
    const ctx = getEditableContext();
    if (!ctx) return;
    const current = ctx.fRange.getNote();
    const res = await ui.ask({
      title: `Ghi chú ô (Cell Note) — ${activeCellA1}`,
      fields: [
        { name: 'note', label: 'Nội dung ghi chú ghim trên góc ô', type: 'textarea', value: current?.note || '', placeholder: 'Nhập ghi chú giải trình số liệu…' },
      ],
    });
    if (!res) return;
    const text = String(res.note ?? '').trim();
    if (!text) {
      ctx.fRange.deleteNote();
      ui.toast(`Đã xoá ghi chú tại ${activeCellA1}`);
    } else {
      ctx.fRange.createOrUpdateNote({ note: text, width: 200, height: 110, show: false });
      ui.toast(`Đã gắn ghi chú vào góc ô ${activeCellA1}`);
    }
    setSavedStatus('saving');
  };

  const handleFreezeMode = (mode: 'row1' | 'row2' | 'col1' | 'cursor' | 'clear') => {
    setPopover(null);
    const ctx = getActiveContext();
    if (!ctx) return;
    const { fWorksheet, fRange } = ctx;
    if (mode === 'clear') {
      fWorksheet.cancelFreeze();
      setIsFrozen(false);
      ui.toast('Đã gỡ cố định dòng/cột');
    } else if (mode === 'row1') {
      fWorksheet.setFreeze({ startRow: 1, startColumn: 0, ySplit: 1, xSplit: 0 });
      setIsFrozen(true);
      ui.toast('Đã cố định dòng tiêu đề đầu tiên');
    } else if (mode === 'row2') {
      fWorksheet.setFreeze({ startRow: 2, startColumn: 0, ySplit: 2, xSplit: 0 });
      setIsFrozen(true);
      ui.toast('Đã cố định 2 dòng đầu tiên');
    } else if (mode === 'col1') {
      fWorksheet.setFreeze({ startRow: 0, startColumn: 1, ySplit: 0, xSplit: 1 });
      setIsFrozen(true);
      ui.toast('Đã cố định cột đầu tiên');
    } else {
      const r = fRange.getRange();
      const y = Math.max(1, r.startRow);
      const x = Math.max(0, r.startColumn);
      fWorksheet.setFreeze({ startRow: y, startColumn: x, ySplit: y, xSplit: x });
      setIsFrozen(true);
      ui.toast(`Đã cố định phía trên dòng ${y + 1} và bên trái cột ${x + 1}`);
    }
    setSavedStatus('saving');
  };

  const handleSetZoom = (pct: number) => {
    const clamped = Math.max(25, Math.min(300, pct));
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fWorksheet.zoom(clamped / 100);
    setZoomPct(clamped);
    setSavedStatus('saving');
  };

  const handleToggleGridlines = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const nextShow = !showGridlines;
    ctx.fWorksheet.setHiddenGridlines(!nextShow);
    setShowGridlines(nextShow);
    setSavedStatus('saving');
  };

  const handleToggleProtect = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const nextProtected = !isProtected;
    ctx.fWorkbook.setEditable(!nextProtected);
    isProtectedRef.current = nextProtected;
    setIsProtected(nextProtected);
    ui.toast(nextProtected ? 'Đã khoá bảo vệ bảng tính (Chỉ đọc)' : 'Đã mở khoá cho phép chỉnh sửa');
  };

  const handleSelectTemplate = (
    templateId: 'budget' | 'payroll' | 'sales' | 'inventory' | 'cashbook' | 'project',
    asNewSheet: boolean
  ) => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const wb =
      templateId === 'budget'
        ? sampleWorkbook(stripSpreadsheetExt(title))
        : templateId === 'payroll'
        ? payrollWorkbook()
        : templateId === 'sales'
        ? salesKpiWorkbook()
        : templateId === 'inventory'
        ? inventoryWorkbook()
        : templateId === 'cashbook'
        ? cashbookWorkbook()
        : projectEstimateWorkbook();

    if (asNewSheet) {
      appendWorkbookSheetsIntoLive(wb);
      ui.toast(`Đã chèn mẫu "${wb.name}" thành Sheet mới`);
    } else {
      ctx.fWorkbook.dispose();
      ctx.api.createWorkbook(wb as never);
      recalculateAndBindWorkbook(ctx.api);
      setSavedStatus('saving');
      setTimeout(() => syncUiFromSelection(), 90);
      ui.toast(`Đã nạp mẫu "${wb.name}"`);
    }
  };

  const handleResetBlankWorkbook = async () => {
    const ok = await ui.confirm('Làm mới toàn bộ Workbook', 'Tạo lại bảng tính trắng mới (có thể khôi phục từ Lịch sử nếu đã lưu)?', true);
    if (!ok) return;
    const ctx = getActiveContext();
    if (!ctx) return;
    const blank = emptyWorkbook(stripSpreadsheetExt(title));
    ctx.fWorkbook.dispose();
    ctx.api.createWorkbook(blank as never);
    recalculateAndBindWorkbook(ctx.api);
    setSavedStatus('saving');
    setTimeout(() => syncUiFromSelection(), 90);
  };

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setModal('history');
  };

  const handleCreateSnapshot = async (label: string) => {
    const draft: SheetContent = { kind: 'sheet', workbook: captureHydratedWorkbook(), comments, printSettings, outlines, macros, vba: vbaProject ?? undefined };
    const currentMeta = { ...meta, name: title.trim() || meta.name, updatedAt: Date.now() };
    try {
      if (!user) await sourceStorage.saveFile(currentMeta, draft);
      const account = await login();
      if (!account) return;
      const { version: saved } = await saveAccountSnapshot({ accountId: account.uid, sourceUserId: user?.uid, sourceStorage, meta: currentMeta, content: draft, label: label.trim() || undefined });
      setVersions((prev) => [saved, ...prev]);
      ui.toast('Đã lưu mốc lịch sử phiên bản');
    } catch {
      ui.toast('Chưa lưu được phiên bản. Nội dung đang soạn vẫn được giữ nguyên.', true);
    }
  };

  const handleRestoreVersion = async (v: FileVersion) => {
    const cont = v.content as SheetContent;
    const ctx = getActiveContext();
    if (!cont?.workbook || !ctx) return;
    await restoreVersion(meta.id, v.id);
    ctx.fWorkbook.dispose();
    ctx.api.createWorkbook(cont.workbook as never);
    recalculateAndBindWorkbook(ctx.api);
    if (cont.comments) setComments(cont.comments);
    if (cont.printSettings) setPrintSettings(cont.printSettings);
    setOutlines(cont.outlines ?? {});
    setMacros(sanitizeMacros(cont.macros));
    setVbaProject(cont.vba ?? null);
    setModal(null);
    setSavedStatus('saving');
    setTimeout(() => syncUiFromSelection(), 90);
    ui.toast(`Đã khôi phục mốc "${v.label}"`);
  };

  const handleDeleteVersion = async (id: string) => {
    await deleteVersion(meta.id, id);
    setVersions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOpenMergeModal = async () => {
    const all = await listFiles();
    setWorkspaceSheets(all.filter((f) => !f.deletedAt && f.kind === 'sheet' && f.id !== meta.id));
    setModal('merge');
  };

  const handleEmbedSignature = async (pngDataUrl: string, signer: string, role: string) => {
    await embedBase64ImageAtSelection(pngDataUrl, 230, 106);
    const nextPrint: SheetPrintSettings = {
      ...printSettings,
      signedBy: signer,
      signedRole: role,
      signedAt: Date.now(),
    };
    setPrintSettings(nextPrint);
    setSavedStatus('saving');
    ui.toast(`Đã đóng dấu chữ ký số của "${signer}" tại ${activeCellA1}`);
  };

  const handleSignAndSavePdf = async (pngDataUrl: string, signer: string, role: string) => {
    await handleEmbedSignature(pngDataUrl, signer, role);
    const nextPrint: SheetPrintSettings = {
      ...printSettings,
      signedBy: signer,
      signedRole: role,
      signedAt: Date.now(),
    };
    const pdfId = `pdf-${Date.now()}`;
    const pdfName = `${stripSpreadsheetExt(title)} (Đã ký số).pdf`;
    await saveFile(
      {
        id: pdfId,
        name: pdfName,
        kind: 'pdf',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        openedAt: Date.now(),
        starred: false,
        deletedAt: null,
        size: 32768,
        preview: `Bản xuất từ Minh Sheets "${activeSheetName}" · Đã ký xác thực bởi ${signer} (${role})`,
      },
      {
        kind: 'pdf',
        pageCount: 1,
      }
    );
    ui.toast(`Đã lưu "${pdfName}" vào kho Minh PDF và mở hộp thoại xuất PDF`);
    setPrintSettings(nextPrint);
    setModal('pageSetup');
  };

  const handleCopySummaryTsv = async () => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const sid = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[sid] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    let text: string;
    try {
      text = await exportSheetToTsv(sh, wb).text();
    } catch (err) {
      ui.toast((err as Error).message || 'Kh\u00F4ng th\u1EC3 sao ch\u00E9p b\u1EA3ng', true);
      return;
    }
    const copied = await copyTextSafely(text.replace(/^\uFEFF/, ''));
    ui.toast(copied ? 'Đã sao chép toàn bộ bảng (TSV) vào Clipboard' : 'Trình duyệt chặn quyền ghi Clipboard, hãy dùng Xuất .tsv', !copied);
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const cmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: currentAuthorName(),
      quote: newCommentCell.trim() || activeRangeA1,
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [cmt, ...prev]);
    setNewCommentText('');
    setSavedStatus('saving');
    ui.toast(`Đã ghim bình luận cho vùng ${cmt.quote}`);
  };

  const handleAddReply = (commentId: string) => {
    if (!replyText.trim()) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              replies: [
                ...(c.replies ?? []),
                {
                  id: `rep-${Date.now()}`,
                  author: currentAuthorName(),
                  text: replyText.trim(),
                  createdAt: Date.now(),
                },
              ],
            }
          : c
      )
    );
    setReplyText('');
    setReplyingCommentId(null);
    setSavedStatus('saving');
  };

  const unresolvedCommentCount = comments.filter((c) => !c.resolved).length;

  const MACRO_GROUP = 'Macro kế toán 1 chạm';
  const sheetFeatures: FeatureItem[] = [
    { id: 'pdf', group: 'Minh PDF', label: 'Xuất PDF', description: 'In hoặc lưu bảng tính thành PDF theo vùng in', icon: <Printer size={16} color="#dc2626" />, run: () => setModal('pageSetup') },
    { id: 'png', group: 'Minh PDF', label: 'Xuất ảnh PNG', description: 'Chụp vùng dữ liệu thành ảnh', icon: <ImageIcon size={16} color="#ea580c" />, run: () => setModal('image') },
    { id: 'html', group: 'Minh PDF', label: 'Tải bản HTML in', description: 'Bản HTML đúng bố cục in để gửi đi', icon: <FileCheck size={16} color="#0284c7" />, run: () => handleDownloadPrintHtml(printSettings) },
    { id: 'split', group: 'Minh PDF', label: 'Tách từng Sheet', description: 'Tách mỗi trang tính thành một tệp riêng', icon: <Split size={16} color="#107c41" />, run: () => setModal('split') },
    { id: 'merge', group: 'Minh PDF', label: 'Gộp nhiều tệp', description: 'Gộp dữ liệu từ nhiều bảng tính', icon: <Layers size={16} color="#2563eb" />, run: () => void handleOpenMergeModal() },
    { id: 'sign', group: 'Chữ ký & thanh toán', label: 'Ký tay & đóng mộc', description: 'Vẽ chữ ký, chèn con dấu đỏ vào bảng tính', icon: <FileSignature size={16} color="#b91c1c" />, run: () => setModal('signature') },
    { id: 'vietqr', group: 'Chữ ký & thanh toán', label: 'Mã VietQR', description: 'Tạo mã chuyển khoản NAPAS 247', icon: <QrCode size={16} color="#107c41" />, run: () => setModal('vietqr') },
    { id: 'money-words', group: MACRO_GROUP, label: 'Đọc số tiền thành chữ', description: 'Đọc số VNĐ ở ô đang chọn thành chữ kế toán', icon: <Calculator size={16} color="#d97706" />, run: handleReadMoneyWords },
    { id: 'money-words-col', group: MACRO_GROUP, label: 'Đọc chữ VNĐ cho cả cột', description: 'Thêm cột số tiền bằng chữ cho bảng dữ liệu', icon: <Calculator size={16} color="#b45309" />, run: () => handleRunMacro('moneyWordsCol') },
    { id: 'normalize', group: MACRO_GROUP, label: 'Chuẩn hoá bảng', description: 'Dọn khoảng trắng, chuẩn định dạng bảng dữ liệu', icon: <Play size={16} color="#107c41" />, run: () => handleRunMacro('normalizeTable') },
    { id: 'stt', group: MACRO_GROUP, label: 'Đánh STT 1..N', description: 'Đánh số thứ tự tự động cho bảng', icon: <Play size={16} color="#0284c7" />, run: () => handleRunMacro('autoNumberStt') },
    { id: 'variance', group: MACRO_GROUP, label: 'Tô âm/dương', description: 'Tô màu số âm và số dương', icon: <Sparkles size={16} color="#7c3aed" />, run: () => handleRunMacro('highlightVariance') },
    { id: 'blank-rows', group: MACRO_GROUP, label: 'Xoá dòng trống', description: 'Bỏ các dòng trống trong bảng', icon: <Trash2 size={16} color="#dc2626" />, run: () => handleRunMacro('cleanBlankRows') },
    { id: 'iferror', group: MACRO_GROUP, label: 'Bọc IFERROR', description: 'Bọc công thức đang lỗi để hiện ô trống', icon: <ShieldCheck size={16} color="#0f766e" />, run: handleWrapErrorsWithIfError },
    { id: 'cleaning', group: 'Dữ liệu', label: 'Xưởng làm sạch', description: 'Xoá trùng, chuẩn hoá, tách cột trong một chỗ', icon: <Sparkles size={16} color="#107c41" />, run: () => openTableTool('dataCleaning') },
    { id: 'fuzzy', group: 'Dữ liệu', label: 'Đối soát gần đúng', description: 'Khớp tên khách hàng với sổ ngân hàng', icon: <Search size={16} color="#4f46e5" />, run: () => openTableTool('fuzzyReconcile') },
    { id: 'sql', group: 'Dữ liệu', label: 'Truy vấn SQL', description: 'Hỏi dữ liệu bảng tính bằng câu lệnh SQL', icon: <Database size={16} color="#0284c7" />, run: () => openTableTool('sheetSql') },
    { id: 'python', group: 'Dữ liệu', label: 'Python Sandbox', description: 'Chạy Python (pandas, numpy) trên bảng tính', icon: <Terminal size={16} color="#0284c7" />, run: () => openTableTool('pythonSandbox') },
    { id: 'vn-map', group: 'Dữ liệu', label: 'Bản đồ Việt Nam', description: 'Cộng số liệu theo tỉnh thành và 3 miền', icon: <Globe size={16} color="#0284c7" />, run: () => openTableTool('choropleth') },
    { id: 'market', group: 'Dữ liệu', label: 'Dữ liệu thị trường', description: 'Giá cổ phiếu VN, crypto, ngoại tệ, vàng SJC', icon: <TrendingUp size={16} color="#16a34a" />, run: () => setModal('marketQuotes') },
    { id: 'diff', group: 'Dữ liệu', label: 'So sánh sổ tính', description: 'Tìm khác biệt giữa hai trang tính hoặc bản lưu', icon: <GitCompare size={16} color="#ea580c" />, run: () => void openWorkbookDiff() },
    { id: 'doctor', group: 'Dữ liệu', label: 'Bác sĩ tối ưu', description: 'Dọn ô thừa, giảm dung lượng sổ tính', icon: <Sparkles size={16} color="#059669" />, run: openWorkbookDoctor },
  ];

  return (
    <div className="editor-shell">
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleUploadImageFile} />
      <input
        ref={importSheetInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv,.tsv"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void handleMergeFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {!focusMode && (
        <header className="editor-top">
          <div className="editor-title-group">
            <button
              className="icon-btn"
              onClick={() => {
                void persistWorkbook(false).then((saved) => { if (saved) onBack(); });
              }}
              title="Quay về danh sách tệp"
            >
              <ArrowLeft size={18} />
            </button>
            <SuiteLogo kind="sheet" size={32} decorative={false} />
            <input
              className="editor-title-input"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setSavedStatus('saving'); }}
              onBlur={() => {
                if (title.trim()) setTitle(title.trim());
                else setTitle(meta.name);
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              title="Đổi tên bảng tính"
            />
            <button className={`save-pill ${savedStatus}`} onClick={() => void handleOpenHistory()} title="Mở lịch sử phiên bản">
              {savedStatus === 'saved' ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>{user ? 'Đã lưu' : 'Đã lưu nháp trên máy'}</span>
                </>
              ) : (
                <>
                  <Clock size={12} />
                  <span>{user ? 'Đang lưu…' : 'Đang lưu nháp…'}</span>
                </>
              )}
            </button>
          </div>

          <div className="topbar-right">
            <button className="btn" onClick={() => getActiveContext()?.fWorkbook.undo()} title="Hoàn tác (Ctrl+Z)">
              <Undo2 size={14} />
            </button>
            <button className="btn" onClick={() => getActiveContext()?.fWorkbook.redo()} title="Làm lại (Ctrl+Y)">
              <Redo2 size={14} />
            </button>
            <button className="btn" onClick={() => void handleOpenHistory()} title="Lịch sử phiên bản">
              <History size={14} />
              <span>Lịch sử</span>
            </button>
            <button className="btn" onClick={() => setModal('formulas')} title="Thư viện 54 hàm Excel (fx)">
              <Code2 size={14} />
              <span>Hàm (fx)</span>
            </button>
            <button className="btn" onClick={() => setModal('chart')} title="Chart Studio trực quan">
              <BarChart3 size={14} />
              <span>Biểu đồ</span>
            </button>
            <button className="btn" onClick={handleSaveNow} title="Lưu chính thức (Ctrl+S)">
              <Save size={14} />
              <span>Lưu</span>
            </button>
            <button className="btn btn-sheet" onClick={() => void handleExportXlsx()} title="Xuất chuẩn Excel (.xlsx)">
              <Download size={14} />
              <span>Xuất .xlsx</span>
            </button>
            {(macros.length > 0 || vbaMacros.length > 0) && (
              <button className="btn" onClick={() => void handleExportXlsm()} title="Xuất Excel có macro (.xlsm): giữ mã VBA và macro đã ghi để chạy trong Microsoft Excel">
                <Download size={14} />
                <span>Xuất .xlsm</span>
              </button>
            )}
            <button className="btn" onClick={() => handleExportDelimited('csv')} title="Xuất CSV (UTF-8)">
              <FileText size={14} />
              <span>CSV</span>
            </button>
            <button className="btn" onClick={() => setModal('pageSetup')} title="Xem trước & In PDF Vector (Ctrl+P)">
              <Printer size={14} />
              <span>In / PDF</span>
            </button>
          </div>
        </header>
      )}

      {!focusMode && (
        <div className="ribbon sheet">
          <div className="ribbon-tabs-bar">
            <div className="ribbon-tabs-list">
              {(
                [
                  ['file', 'File'],
                  ['home', 'Home'],
                  ['insert', 'Insert'],
                  ['draw', 'Draw'],
                  ['page_layout', 'Page Layout'],
                  ['formulas', 'Formulas'],
                  ['data', 'Data'],
                  ['review', 'Review'],
                  ['view', 'View'],
                  ['automate', 'Automate'],
                  ['help', 'Help'],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  className={`ribbon-tab ${activeTab === tabId ? 'active' : ''}`}
                  onClick={() => {
                    setPopover(null);
                    setActiveTab(tabId);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ribbon-top-actions">
              <button
                className={`ribbon-pill-btn ${showComments ? 'active' : ''}`}
                onClick={() => setShowComments((v) => !v)}
              >
                <MessageSquare size={13} />
                <span>Bình luận{unresolvedCommentCount > 0 ? ` (${unresolvedCommentCount})` : ''}</span>
              </button>
              <button className="ribbon-share-btn" onClick={() => setModal('share')}>
                <Share2 size={13} />
                <span>Chia sẻ</span>
              </button>
            </div>
          </div>

          <div className="ribbon-body">
            {activeTab === 'file' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('templates')}>
                      <Sparkles size={20} color="#107c41" />
                      <span>Kho mẫu</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleResetBlankWorkbook()}>
                      <FileSpreadsheet size={20} color="#0284c7" />
                      <span>Tạo trắng</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => importSheetInputRef.current?.click()}>
                      <Upload size={20} color="#4f46e5" />
                      <span>Nhập tệp</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Khởi tạo & Nhập</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleSaveNow}>
                      <Save size={20} color="#107c41" />
                      <span>Lưu ngay</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleCreateSnapshot('')}>
                      <Bookmark size={20} color="#d97706" />
                      <span>Tạo mốc</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleOpenHistory()}>
                      <History size={20} color="#2563eb" />
                      <span>Lịch sử</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Lưu trữ</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => void handleExportXlsx()}>
                      <Download size={20} color="#107c41" />
                      <span>Excel .xlsx</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleExportXlsm()} title="Excel có macro: giữ mã VBA và macro đã ghi">
                      <Download size={20} color="#7c3aed" />
                      <span>Excel .xlsm</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleExportDelimited('csv')}>
                      <FileText size={20} color="#0d9488" />
                      <span>Xuất .csv</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleExportDelimited('tsv')}>
                      <FileText size={20} color="#475569" />
                      <span>Xuất .tsv</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleExportJsonFile}>
                      <FileJson size={20} color="#7c3aed" />
                      <span>Xuất .json</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('image')}>
                      <ImageIcon size={20} color="#ea580c" />
                      <span>Ảnh .png</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('pageSetup')}>
                      <Printer size={20} color="#dc2626" />
                      <span>In & PDF</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Kết xuất đa định dạng</div>
                </div>
              </>
            )}

            {activeTab === 'home' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={(e) => openPopover(e, 'paste')}
                      title="Tuỳ chọn Dán dữ liệu (Ctrl+V)"
                    >
                      <ClipboardPaste size={20} color="#107c41" />
                      <span>Dán ▾</span>
                    </button>
                    <div className="ribbon-two-rows">
                      <div className="ribbon-row">
                        <button className="ribbon-btn-small" onClick={() => void handleCopyOrCut(true)} title="Cắt (Ctrl+X)">
                          <Scissors size={13} />
                        </button>
                        <button className="ribbon-btn-small" onClick={() => void handleCopyOrCut(false)} title="Sao chép (Ctrl+C)">
                          <Copy size={13} />
                        </button>
                      </div>
                      <div className="ribbon-row">
                        <button
                          className={`ribbon-btn-compact ${painterArmed ? 'active' : ''}`}
                          onClick={handleFormatPainter}
                          title="Sao chép định dạng ô (Format Painter)"
                        >
                          <Paintbrush size={12} />
                          <span>Chổi</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Clipboard</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <select
                        className="ribbon-select"
                        style={{ width: 104 }}
                        value={selectedFont}
                        onChange={(e) => applyFontFamily(e.target.value)}
                        title="Phông chữ"
                      >
                        {['Arial', 'Segoe UI', 'Calibri', 'Times New Roman', 'Tahoma', 'Verdana', 'Roboto', 'Courier New'].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <select
                        className="ribbon-select"
                        style={{ width: 46 }}
                        value={selectedFontSize}
                        onChange={(e) => applyFontSize(e.target.value)}
                        title="Cỡ chữ"
                      >
                        {['8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '36'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyFontSize(String(Number(selectedFontSize) + 1))}
                        title="Tăng cỡ chữ"
                      >
                        <span style={{ fontSize: 12, fontWeight: 700 }}>A+</span>
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyFontSize(String(Math.max(8, Number(selectedFontSize) - 1)))}
                        title="Giảm cỡ chữ"
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 700 }}>A-</span>
                      </button>
                    </div>

                    <div className="ribbon-row">
                      <button className={`ribbon-btn-small ${isBold ? 'active' : ''}`} onClick={toggleBold} title="In đậm (Ctrl+B)">
                        <Bold size={13} />
                      </button>
                      <button className={`ribbon-btn-small ${isItalic ? 'active' : ''}`} onClick={toggleItalic} title="In nghiêng (Ctrl+I)">
                        <Italic size={13} />
                      </button>
                      <button className={`ribbon-btn-small ${isUnderline ? 'active' : ''}`} onClick={toggleUnderline} title="Gạch chân (Ctrl+U)">
                        <Underline size={13} />
                      </button>
                      <button className={`ribbon-btn-small ${isStrike ? 'active' : ''}`} onClick={toggleStrike} title="Gạch ngang chữ">
                        <Strikethrough size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={(e) => openPopover(e, 'borders')} title="Kẻ khung viền ô">
                        <Grid size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={(e) => openPopover(e, 'fillColor')}
                        title="Màu nền ô"
                        style={{ borderBottom: `3px solid ${fillColor}` }}
                      >
                        <Palette size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={(e) => openPopover(e, 'fontColor')}
                        title="Màu chữ"
                        style={{ borderBottom: `3px solid ${fontColor}` }}
                      >
                        <Type size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Phông chữ</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button
                        className={`ribbon-btn-small ${vAlign === 'top' ? 'active' : ''}`}
                        onClick={() => applyVAlign('top')}
                        title="Căn lề trên"
                      >
                        <ArrowUpToLine size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${vAlign === 'middle' ? 'active' : ''}`}
                        onClick={() => applyVAlign('middle')}
                        title="Căn giữa dọc"
                      >
                        <Minimize2 size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${vAlign === 'bottom' ? 'active' : ''}`}
                        onClick={() => applyVAlign('bottom')}
                        title="Căn lề dưới"
                      >
                        <ArrowDownToLine size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyTextRotation(45)}
                        title="Xoay nghiêng chữ 45° (Nhấp đúp 0° ở Format)"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-compact ${isWrap ? 'active' : ''}`}
                        onClick={toggleWrapText}
                        title="Tự động xuống dòng trong ô (Wrap Text)"
                      >
                        <WrapText size={13} />
                        <span>Xuống dòng</span>
                      </button>
                    </div>

                    <div className="ribbon-row">
                      <button
                        className={`ribbon-btn-small ${hAlign === 'left' ? 'active' : ''}`}
                        onClick={() => applyHAlign('left')}
                        title="Căn trái"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${hAlign === 'center' ? 'active' : ''}`}
                        onClick={() => applyHAlign('center')}
                        title="Căn giữa ngang"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${hAlign === 'normal' ? 'active' : ''}`}
                        onClick={() => applyHAlign('normal')}
                        title="Căn phải"
                      >
                        <AlignRight size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-compact ${isMerged ? 'active' : ''}`}
                        onClick={() => handleMergeCells('toggle')}
                        title="Gộp ô & Căn giữa"
                      >
                        <span>Gộp ô</span>
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={(e) => openPopover(e, 'merge')}
                        title="Tuỳ chọn gộp / tách ô"
                      >
                        <span style={{ fontSize: 10 }}>▾</span>
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Căn chỉnh</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <select
                        className="ribbon-select"
                        style={{ width: 118 }}
                        value={selectedNumberFormat}
                        onChange={(e) => applyNumberFormat(e.target.value)}
                        title="Định dạng số"
                      >
                        <option value="General">Mặc định (General)</option>
                        <option value="#,##0">Số nguyên (1,234)</option>
                        <option value="#,##0.00">Số thập phân (1,234.56)</option>
                        <option value='#,##0 "₫"'>Tiền tệ VNĐ (₫)</option>
                        <option value="$#,##0.00">Tiền tệ USD ($)</option>
                        <option value="0.0%">Phần trăm (0.0%)</option>
                        <option value="dd/mm/yyyy">Ngày (dd/mm/yyyy)</option>
                        <option value="@">Văn bản thuần (@)</option>
                      </select>
                    </div>
                    <div className="ribbon-row">
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyNumberFormat('#,##0 "₫"')}
                        title="Định dạng Tiền tệ VNĐ"
                      >
                        <DollarSign size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyNumberFormat('0.0%')}
                        title="Định dạng Phần trăm (%)"
                      >
                        <Percent size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => applyNumberFormat('#,##0')}
                        title="Phân cách hàng nghìn (,)"
                      >
                        <span style={{ fontWeight: 800, fontSize: 12 }}>000</span>
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => adjustDecimals(1)}
                        title="Tăng chữ số thập phân"
                      >
                        <span style={{ fontSize: 10, fontWeight: 700 }}>.00</span>
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => adjustDecimals(-1)}
                        title="Giảm chữ số thập phân"
                      >
                        <span style={{ fontSize: 10, fontWeight: 700 }}>.0</span>
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Định dạng số</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <div className="ribbon-two-rows">
                      <button className="ribbon-btn-compact" onClick={() => setModal('cf')}>
                        <Sparkles size={13} color="#dc2626" />
                        <span>Định dạng ĐK</span>
                      </button>
                      <button className="ribbon-btn-compact" onClick={(e) => openPopover(e, 'tableTheme')}>
                        <Table size={13} color="#107c41" />
                        <span>Kẻ Bảng màu ▾</span>
                      </button>
                    </div>
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'cellStyle')}>
                      <Palette size={18} color="#2563eb" />
                      <span>Kiểu ô ▾</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Kiểu bảng</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <div className="ribbon-two-rows">
                      <button className="ribbon-btn-compact" onClick={(e) => openPopover(e, 'insertCells')}>
                        <Plus size={13} color="#107c41" />
                        <span>Chèn ▾</span>
                      </button>
                      <button className="ribbon-btn-compact" onClick={(e) => openPopover(e, 'deleteCells')}>
                        <Trash2 size={13} color="#dc2626" />
                        <span>Xoá ▾</span>
                      </button>
                    </div>
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'formatCells')}>
                      <Columns size={18} color="#0284c7" />
                      <span>Cỡ ô ▾</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Dòng & Cột</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'autosum')} title="AutoSum (Alt+=)">
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#107c41', lineHeight: 1 }}>∑</span>
                      <span>Tổng ▾</span>
                    </button>
                    <div className="ribbon-two-rows">
                      <div className="ribbon-row">
                        <button className="ribbon-btn-compact" onClick={(e) => openPopover(e, 'fillSeries')}>
                          <span>Điền ▾</span>
                        </button>
                        <button className="ribbon-btn-compact" onClick={() => handleSortSheet(true)} title="Sắp xếp tăng dần">
                          <ArrowUpDown size={12} />
                          <span>Sắp xếp</span>
                        </button>
                      </div>
                      <div className="ribbon-row">
                        <button className={`ribbon-btn-compact ${hasFilter ? 'active' : ''}`} onClick={handleToggleFilter}>
                          <Filter size={12} />
                          <span>Lọc</span>
                        </button>
                        <button className="ribbon-btn-compact" onClick={() => setModal('find')}>
                          <Search size={12} />
                          <span>Tìm</span>
                        </button>
                        <button className="ribbon-btn-small" onClick={openGoToSpecial} title="Đi tới ô đặc biệt: ô trống, công thức, lỗi… (Go To Special)" aria-label="Đi tới ô đặc biệt">
                          <Crosshair size={13} color="#4f46e5" />
                        </button>
                        <button className="ribbon-btn-small" onClick={(e) => openPopover(e, 'clearMenu')} title="Xoá nội dung / định dạng">
                          <Eraser size={13} color="#dc2626" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Biên tập</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <FeatureMenu items={sheetFeatures} className="ribbon-btn-large" />
                  </div>
                  <div className="ribbon-group-label">Tính năng</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAnalysis')}>
                      <Bot size={20} color="#7c3aed" />
                      <span>Minh AI</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Trí tuệ AI</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <AddinRibbonButtons className="ribbon-btn-large" />
                  </div>
                  <div className="ribbon-group-label">Add-in</div>
                </div>
              </>
            )}

            {activeTab === 'insert' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('pivot')}>
                      <Table size={20} color="#107c41" />
                      <span>PivotTable</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'tableTheme')}>
                      <Grid size={20} color="#0284c7" />
                      <span>Bảng dữ liệu</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => openTableTool('slicer')} title="Tạo thẻ nút bấm lọc nhanh dữ liệu theo danh mục">
                      <SlidersHorizontal size={20} color="#7c3aed" />
                      <span>Slicer lọc</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Bảng tổng hợp</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon size={20} color="#2563eb" />
                      <span>Chèn ảnh</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        setShapeKind('rounded');
                        setModal('shape');
                      }}
                      title="Chèn hình chữ nhật, elip, mũi tên, khung chú thích, ngôi sao, băng rôn"
                    >
                      <Shapes size={20} color="#0d9488" />
                      <span>Hình dạng</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        setShapeKind('textbox');
                        setModal('shape');
                      }}
                    >
                      <TextCursorInput size={20} color="#475569" />
                      <span>Hộp văn bản</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('symbol')} title="Chèn ký hiệu ₫, ±, °, ✓, →, m²…">
                      <Omega size={20} color="#7c3aed" />
                      <span>Ký hiệu</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh hoạ</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('chart')}>
                      <BarChart3 size={20} color="#107c41" />
                      <span>Biểu đồ Cột</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('chart')}>
                      <TrendingUp size={20} color="#2563eb" />
                      <span>Đường xu hướng</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('chart')}>
                      <PieChart size={20} color="#d97706" />
                      <span>Cơ cấu Tròn</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        const ctx = getEditableContext();
                        if (!ctx) return;
                        const raw = ctx.fRange.getRange();
                        const rule = ctx.fWorksheet
                          .newConditionalFormattingRule()
                          .setDataBar({
                            min: { type: CFValueType.num, value: 0 },
                            max: { type: CFValueType.num, value: Math.max(100, selStats.max || 100) },
                            isGradient: true,
                            positiveColor: '#107c41',
                            nativeColor: '#dc2626',
                            isShowValue: true,
                          })
                          .setRanges([raw])
                          .build();
                        ctx.fWorksheet.addConditionalFormattingRule(rule);
                        ui.toast(`Đã chèn thanh Sparkline DataBar trực quan vào ${activeRangeA1}`);
                      }}
                    >
                      <Sparkles size={20} color="#7c3aed" />
                      <span>Thanh DataBar</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Biểu đồ trực quan</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => handleApplyValidation({ kind: 'checkbox', listText: '', minVal: '0', maxVal: '1', integerOnly: false, allowBlank: true, strictStop: false, errorMessage: '' })}>
                      <CheckSquare size={20} color="#107c41" />
                      <span>Checkbox</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleInsertHyperlink()}>
                      <Link2 size={20} color="#0284c7" />
                      <span>Liên kết</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleInsertCellNote()}>
                      <StickyNote size={20} color="#ca8a04" />
                      <span>Ghi chú ô</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowComments(true)}>
                      <MessageSquare size={20} color="#4f46e5" />
                      <span>Thảo luận</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Tương tác & Liên kết</div>
                </div>
              </>
            )}

            {activeTab === 'draw' && (
              <>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    {[
                      ['#fef08a', 'Bút dạ Vàng'],
                      ['#bbf7d0', 'Bút dạ Xanh'],
                      ['#fecaca', 'Bút dạ Đỏ'],
                      ['#bae6fd', 'Bút dạ Lam'],
                    ].map(([clr, lbl]) => (
                      <button key={clr} className="ribbon-btn-large" onClick={() => applyFill(clr)}>
                        <span style={{ width: 20, height: 20, borderRadius: 4, background: clr, border: '1px solid #94a3b8' }} />
                        <span>{lbl}</span>
                      </button>
                    ))}
                    <button className="ribbon-btn-large" onClick={() => applyFill(null)}>
                      <Eraser size={20} color="#475569" />
                      <span>Tẩy nền tô</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Tô sáng số liệu nhanh</div>
                </div>
              </>
            )}

            {activeTab === 'page_layout' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    {WORKBOOK_THEMES.map((wt) => (
                      <button key={wt.id} className="ribbon-btn-large" onClick={() => handleApplyWorkbookTheme(wt)}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: wt.primary, display: 'inline-block' }} />
                        <span>{wt.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ribbon-group-label">Chủ đề Bảng tính</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('pageSetup')}>
                      <Printer size={20} color="#107c41" />
                      <span>Thiết lập in</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        const next = printSettings.orientation === 'landscape' ? 'portrait' : 'landscape';
                        updatePrintSettings({ orientation: next });
                        ui.toast(next === 'landscape' ? 'Đã đặt khổ giấy in: Ngang (Landscape)' : 'Đã đặt khổ giấy in: Dọc (Portrait)');
                      }}
                      title="Đổi hướng giấy in Ngang / Dọc"
                    >
                      <Rows size={20} color="#0284c7" />
                      <span>{printSettings.orientation === 'landscape' ? 'Khổ Ngang' : 'Khổ Dọc'}</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        updatePrintSettings({ printArea: activeRangeA1 });
                        ui.toast(`Đã đặt Vùng in = ${activeRangeA1}`);
                      }}
                    >
                      <Check size={20} color="#16a34a" />
                      <span>Đặt vùng in</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        updatePrintSettings({ printArea: '' });
                        ui.toast('Đã xoá giới hạn vùng in (In toàn bộ Sheet)');
                      }}
                    >
                      <X size={20} color="#dc2626" />
                      <span>Xoá vùng in</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handlePageBreak('toggle')} title="Chèn hoặc bỏ ngắt trang thủ công phía trên hàng đang chọn">
                      <SeparatorHorizontal size={20} color="#7c3aed" />
                      <span>Ngắt trang ({activePageBreakCount})</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handlePageBreak('clear')} title="Xoá mọi ngắt trang thủ công của trang tính">
                      <Eraser size={20} color="#dc2626" />
                      <span>Xoá ngắt trang</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Khổ giấy & Vùng in</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className={`ribbon-btn-large ${showGridlines ? 'active' : ''}`} onClick={handleToggleGridlines}>
                      {showGridlines ? <Eye size={20} color="#107c41" /> : <EyeOff size={20} color="#64748b" />}
                      <span>Lưới ô</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'tabColor')}>
                      <Palette size={20} color="#7c3aed" />
                      <span>Màu Tab Sheet</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Hiển thị Sheet</div>
                </div>
              </>
            )}


            {activeTab === 'formulas' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('formulas')}>
                      <Code2 size={20} color="#107c41" />
                      <span>Thư viện (fx)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={(e) => openPopover(e, 'autosum')}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#107c41', lineHeight: 1 }}>∑</span>
                      <span>AutoSum ▾</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Hàm & Kế toán</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        syncDefinedNames();
                        setModal('nameManager');
                      }}
                    >
                      <Bookmark size={20} color="#2563eb" />
                      <span>Tên vùng ({definedNames.length})</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Định danh</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleTracePrecedents} title="Truy vết ô tiền đề mà công thức này tham chiếu">
                      <CornerDownRight size={20} color="#2563eb" />
                      <span>Vết tiền đề</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleTraceDependents} title="Truy vết các ô phụ thuộc vào giá trị ô này">
                      <CornerUpRight size={20} color="#16a34a" />
                      <span>Vết phụ thuộc</span>
                    </button>
                    <button
                      className={`ribbon-btn-large ${showFormulasMode ? 'active' : ''}`}
                      onClick={handleToggleShowFormulas}
                      title="Bật/Tắt hiển thị công thức thay vì kết quả (Ctrl + `)"
                    >
                      <FileCode size={20} color="#d97706" />
                      <span>Hiện công thức</span>
                    </button>
                    <button
                      className={`ribbon-btn-large ${showWatchWindow ? 'active' : ''}`}
                      onClick={() => setShowWatchWindow((v) => !v)}
                      title="Mở Cửa sổ giám sát ô trọng yếu (Ctrl + Shift + W)"
                    >
                      <Tv size={20} color="#0f766e" />
                      <span>Giám sát ô ({watchList.length})</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAudit')}>
                      <AlertTriangle size={20} color="#dc2626" />
                      <span>Kiểm lỗi #</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        syncUiFromSelection();
                        ui.toast('Đã đồng bộ & tính toán lại toàn bộ công thức trên Sheet');
                      }}
                    >
                      <RefreshCw size={20} color="#475569" />
                      <span>Tính lại</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Kiểm toán công thức</div>
                </div>
              </>
            )}

            {activeTab === 'data' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => importSheetInputRef.current?.click()}>
                      <Upload size={20} color="#107c41" />
                      <span>Nhập CSV/XLSX</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleOpenMergeModal()}>
                      <Layers size={20} color="#2563eb" />
                      <span>Gộp dữ liệu</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Nguồn dữ liệu</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => handleSortSheet(true)}>
                      <ArrowUpDown size={20} color="#107c41" />
                      <span>Tăng A→Z</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleSortSheet(false)}>
                      <ArrowUpDown size={20} color="#0284c7" />
                      <span>Giảm Z→A</span>
                    </button>
                    <button className={`ribbon-btn-large ${hasFilter ? 'active' : ''}`} onClick={handleToggleFilter}>
                      <ListFilter size={20} color="#d97706" />
                      <span>Bộ lọc</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => openTableTool('customSort')} title="Sắp xếp theo nhiều cột, nhiều cấp">
                      <ArrowDownUp size={20} color="#4f46e5" />
                      <span>Sắp xếp tuỳ chỉnh</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => openTableTool('advFilter')} title="Lọc nhiều điều kiện VÀ/HOẶC, xuất ra Sheet mới">
                      <Filter size={20} color="#0d9488" />
                      <span>Lọc nâng cao</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Sắp xếp & Lọc</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleFlashFill} title="Tự động điền dữ liệu thông minh theo mẫu (Ctrl + E)">
                      <Zap size={20} color="#eab308" />
                      <span>Flash Fill</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleTextToColumns()}>
                      <Split size={20} color="#0284c7" />
                      <span>Tách cột</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleRemoveDuplicates}>
                      <CopyCheck size={20} color="#dc2626" />
                      <span>Khử trùng</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('dv')}>
                      <CheckSquare size={20} color="#107c41" />
                      <span>Kiểm tra DL</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleDataCleanup('trim')}>
                      <Eraser size={20} color="#7c3aed" />
                      <span>Dọn TRIM</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleDataCleanup('toNumber')}>
                      <Calculator size={20} color="#0f766e" />
                      <span>Ép kiểu Số</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Làm sạch & Ràng buộc</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('goalSeek')}>
                      <TrendingUp size={20} color="#4f46e5" />
                      <span>Goal Seek</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('dataTable')} title="Thử nhiều giá trị đầu vào, lập bảng kết quả (Data Table)">
                      <TableProperties size={20} color="#0284c7" />
                      <span>Bảng What-If</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('pivot')}>
                      <Table size={20} color="#107c41" />
                      <span>PivotTable</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Phân tích What-If</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => openTableTool('subtotal')} title="Nhóm theo cột và chèn dòng tổng phụ SUBTOTAL">
                      <Sigma size={20} color="#107c41" />
                      <span>Tổng phụ</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleDescriptiveStats} title="Trung bình, trung vị, độ lệch chuẩn, tứ phân vị… như Analysis ToolPak">
                      <ChartNoAxesColumn size={20} color="#d97706" />
                      <span>Thống kê mô tả</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Phân tích dữ liệu</div>
                </div>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => handleOutline('group')} title="Nhóm các hàng đang chọn (chọn cả cột để nhóm cột) — Alt + Shift + →">
                      <Group size={20} color="#107c41" />
                      <span>Nhóm</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleOutline('ungroup')} title="Bỏ nhóm trong cùng chứa vùng đang chọn — Alt + Shift + ←">
                      <Ungroup size={20} color="#475569" />
                      <span>Bỏ nhóm</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleOutline('collapse')} title="Thu gọn (ẩn) nhóm chứa ô đang chọn">
                      <FoldVertical size={20} color="#0284c7" />
                      <span>Thu gọn</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleOutline('expand')} title="Mở rộng (hiện lại) nhóm chứa ô đang chọn">
                      <UnfoldVertical size={20} color="#0284c7" />
                      <span>Mở rộng</span>
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 2, alignContent: 'center' }}>
                      {[1, 2, 3, 4].map((level) => (
                        <button key={level} className="ribbon-btn-small" onClick={() => handleOutlineLevel(level)} title={`Chỉ hiện tới mức ${level} của dàn ý`}>
                          {level}
                        </button>
                      ))}
                      <button className="ribbon-btn-small" style={{ gridColumn: 'span 2' }} onClick={() => handleOutlineLevel(MAX_OUTLINE_LEVEL + 1)} title="Mở rộng toàn bộ nhóm">
                        Hiện hết
                      </button>
                      <button className="ribbon-btn-small" style={{ gridColumn: 'span 2' }} onClick={() => handleOutline('clear')} title="Xoá toàn bộ nhóm của trang tính (Clear Outline)">
                        Xoá nhóm
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">
                    Dàn ý (Outline) · {activeOutline.rows.length} nhóm hàng, {activeOutline.cols.length} nhóm cột
                  </div>
                </div>
              </>
            )}

            {activeTab === 'review' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAudit')}>
                      <FileCheck size={20} color="#107c41" />
                      <span>Soát lỗi Sheet</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAnalysis')}>
                      <BarChart3 size={20} color="#2563eb" />
                      <span>Thống kê Sheet</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleOpenAccessibility} title="Kiểm tra độ tương phản, ô gộp, Sheet ẩn theo WCAG">
                      <Accessibility size={20} color="#0d9488" />
                      <span>Trợ năng</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Kiểm tra chất lượng</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className={`ribbon-btn-large ${showComments ? 'active' : ''}`} onClick={() => setShowComments((v) => !v)}>
                      <MessageSquare size={20} color="#4f46e5" />
                      <span>Thảo luận ({comments.length})</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleInsertCellNote()}>
                      <StickyNote size={20} color="#ca8a04" />
                      <span>Ghi chú ô</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleClearSelection('notes')}>
                      <Eraser size={20} color="#dc2626" />
                      <span>Xoá ghi chú</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Bình luận & Giải trình</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className={`ribbon-btn-large ${isProtected ? 'active' : ''}`} onClick={handleToggleProtect}>
                      {isProtected ? <Unlock size={20} color="#dc2626" /> : <Lock size={20} color="#0f766e" />}
                      <span>{isProtected ? 'Mở khoá Sheet' : 'Khoá bảo vệ'}</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Bảo vệ dữ liệu</div>
                </div>
              </>
            )}

            {activeTab === 'view' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className={`ribbon-btn-large ${showGridlines ? 'active' : ''}`} onClick={handleToggleGridlines}>
                      {showGridlines ? <Eye size={20} color="#107c41" /> : <EyeOff size={20} color="#64748b" />}
                      <span>Đường lưới</span>
                    </button>
                    <button className={`ribbon-btn-large ${showFormulaBar ? 'active' : ''}`} onClick={() => setShowFormulaBar((v) => !v)}>
                      <Code2 size={20} color="#0284c7" />
                      <span>Thanh fx</span>
                    </button>
                    <button className={`ribbon-btn-large ${showStatusBar ? 'active' : ''}`} onClick={() => setShowStatusBar((v) => !v)}>
                      <Table size={20} color="#475569" />
                      <span>Thanh đáy</span>
                    </button>
                    <button className={`ribbon-btn-large ${showWatchWindow ? 'active' : ''}`} onClick={() => setShowWatchWindow((v) => !v)} title="Bật/Tắt Cửa sổ giám sát ô trọng yếu (Ctrl + Shift + W)">
                      <Tv size={20} color="#0f766e" />
                      <span>Giám sát ô</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setFocusMode(true)}>
                      <Maximize2 size={20} color="#7c3aed" />
                      <span>Toàn màn hình</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Hiển thị cửa sổ</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className={`ribbon-btn-large ${isFrozen ? 'active' : ''}`} onClick={(e) => openPopover(e, 'freezeMenu')}>
                      <Snowflake size={20} color="#0284c7" />
                      <span>Cố định ▾</span>
                    </button>
                    {isFrozen && (
                      <button className="ribbon-btn-large" onClick={() => handleFreezeMode('clear')}>
                        <X size={20} color="#dc2626" />
                        <span>Bỏ cố định</span>
                      </button>
                    )}
                  </div>
                  <div className="ribbon-group-label">Cố định dòng/cột</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => void handleSheetOp('hide')}>
                      <EyeOff size={20} color="#64748b" />
                      <span>Ẩn Sheet</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleSheetOp('unhideAll')}>
                      <Eye size={20} color="#107c41" />
                      <span>Hiện Sheet ẩn</span>
                    </button>
                    <div className="ribbon-two-rows">
                      <button className="ribbon-btn-compact" onClick={() => void handleSheetOp('moveLeft')}>
                        <ChevronLeft size={13} />
                        <span>Chuyển trái</span>
                      </button>
                      <button className="ribbon-btn-compact" onClick={() => void handleSheetOp('moveRight')}>
                        <ChevronRight size={13} />
                        <span>Chuyển phải</span>
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Trang tính</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => handleSetZoom(zoomPct - 10)}>
                      <ZoomOut size={20} color="#475569" />
                      <span>Thu nhỏ</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleSetZoom(100)}>
                      <Search size={20} color="#107c41" />
                      <span>100% ({zoomPct}%)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleSetZoom(zoomPct + 10)}>
                      <ZoomIn size={20} color="#2563eb" />
                      <span>Phóng to</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Thu phóng</div>
                </div>
              </>
            )}

            {activeTab === 'automate' && (
              <>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAssistant')}>
                      <Bot size={20} color="#4f46e5" />
                      <span>Trợ lý Công thức</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Tự động hoá AI</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    {recordedCount === null ? (
                      <button className="ribbon-btn-large" onClick={() => setModal('macroRecord')} title="Ghi lại thao tác trên bảng tính thành macro để chạy lại">
                        <Circle size={20} color="#dc2626" fill="#dc2626" />
                        <span>Ghi macro</span>
                      </button>
                    ) : (
                      <button className="ribbon-btn-large active" onClick={handleStopRecording} title="Dừng ghi và lưu macro">
                        <Square size={20} color="#dc2626" fill="#dc2626" />
                        <span>Dừng ghi ({recordedCount})</span>
                      </button>
                    )}
                    <button className="ribbon-btn-large" onClick={() => setModal('macros')} title="Xem, chạy, đổi tên, gán phím tắt, xoá macro — Alt + F8">
                      <ListVideo size={20} color="#107c41" />
                      <span>Macro ({macros.length + vbaMacros.length})</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => openVbaEditor()} title="Viết, sửa và chạy mã VBA — Alt + F11">
                      <Code2 size={20} color="#7c3aed" />
                      <span>Visual Basic</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('macroButton')} title="Biến ô hoặc vùng đang chọn thành nút bấm chạy macro">
                      <MousePointerClick size={20} color="#2563eb" />
                      <span>Chèn nút</span>
                    </button>
                    <button
                      className={`ribbon-btn-large${designMode ? ' active' : ''}`}
                      aria-pressed={designMode}
                      onClick={() => {
                        setDesignMode((previous) => !previous);
                        ui.toast(designMode ? 'Đã tắt Chế độ thiết kế: bấm vào nút sẽ chạy macro' : 'Đã bật Chế độ thiết kế: bấm vào nút chỉ chọn ô để sửa chữ, màu hoặc gán lại macro');
                      }}
                      title="Bật để chọn và sửa nút bấm mà không chạy macro"
                    >
                      <PencilRuler size={20} color="#d97706" />
                      <span>Chế độ thiết kế</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Macro & nút bấm</div>
                </div>
              </>
            )}
{activeTab === 'help' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('help')}>
                      <HelpCircle size={20} color="#107c41" />
                      <span>Phím tắt nhanh</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('formulas')}>
                      <Code2 size={20} color="#2563eb" />
                      <span>54 Hàm mẫu</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAssistant')}>
                      <Bot size={20} color="#7c3aed" />
                      <span>Hỏi Minh AI</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('templates')}>
                      <Sparkles size={20} color="#d97706" />
                      <span>6 Mẫu chuẩn</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Trợ giúp & Đào tạo</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {focusMode && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            right: 16,
            zIndex: 95,
            display: 'flex',
            gap: 6,
            background: '#0f172a',
            padding: '4px 8px',
            borderRadius: 999,
            boxShadow: '0 6px 20px rgba(15,23,42,0.28)',
          }}
        >
          <button
            className="btn"
            style={{ minHeight: 26, padding: '2px 10px', fontSize: 11.5, background: '#107c41', color: '#fff', borderColor: '#107c41' }}
            onClick={() => setFocusMode(false)}
          >
            <Minimize2 size={13} />
            <span>Thoát Toàn màn hình (Esc)</span>
          </button>
        </div>
      )}

      {popover && (
        <>
          <div className="sheet-popover-backdrop" onMouseDown={() => setPopover(null)} />
          <div className="sheet-popover" style={{ left: popover.left, top: popover.top }}>
            {popover.kind === 'paste' && (
              <>
                <div className="sheet-popover-title">Tuỳ chọn Dán (Paste Special)</div>
                <button className="sheet-popover-item" onClick={() => void handlePasteMode('all')}>
                  <span>Dán đầy đủ (Công thức + Định dạng)</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>Ctrl+V</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handlePasteMode('values')}>
                  <span>Chỉ dán Giá trị (Values Only)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handlePasteMode('formulas')}>
                  <span>Chỉ dán Công thức (Formulas)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handlePasteMode('formats')}>
                  <span>Chỉ dán Định dạng ô (Formatting)</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handlePasteMode('transpose')}>
                  <span>Đảo chiều Dòng ↔ Cột (Transpose)</span>
                </button>
              </>
            )}

            {popover.kind === 'fillColor' && (
              <>
                <div className="sheet-popover-title">Màu nền ô ({activeRangeA1})</div>
                <div className="color-swatch-grid">
                  {THEME_COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      className="color-swatch-btn"
                      style={{ background: c }}
                      title={c}
                      onClick={() => applyFill(c)}
                    />
                  ))}
                </div>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => applyFill(null)}>
                  <span>Không màu nền (Mặc định)</span>
                </button>
              </>
            )}

            {popover.kind === 'fontColor' && (
              <>
                <div className="sheet-popover-title">Màu chữ ({activeRangeA1})</div>
                <div className="color-swatch-grid">
                  {THEME_COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      className="color-swatch-btn"
                      style={{ background: c }}
                      title={c}
                      onClick={() => applyFontClr(c)}
                    />
                  ))}
                </div>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => applyFontClr(null)}>
                  <span>Màu chữ tự động (#0F172A)</span>
                </button>
              </>
            )}

            {popover.kind === 'tabColor' && (
              <>
                <div className="sheet-popover-title">Màu đánh dấu Tab Sheet "{activeSheetName}"</div>
                <div className="color-swatch-grid">
                  {THEME_COLOR_SWATCHES.slice(10).map((c) => (
                    <button
                      key={c}
                      className="color-swatch-btn"
                      style={{ background: c }}
                      title={c}
                      onClick={() => {
                        setPopover(null);
                        const ctx = getEditableContext();
                        if (!ctx) return;
                        ctx.fWorksheet.setTabColor(c);
                        setSavedStatus('saving');
                        ui.toast(`Đã đổi màu Tab "${activeSheetName}"`);
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {popover.kind === 'borders' && (
              <>
                <div className="sheet-popover-title">Kẻ khung viền ({activeRangeA1})</div>
                <button className="sheet-popover-item" onClick={() => applyBorder('all')}>
                  <span>Tất cả viền ô (All Borders)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => applyBorder('outside')}>
                  <span>Viền bao ngoài mảnh (Outside)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => applyBorder('thickOutside')}>
                  <span>Viền bao ngoài đậm (Thick Box)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => applyBorder('bottom')}>
                  <span>Kẻ viền dưới (Bottom Border)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => applyBorder('topBottomDouble')}>
                  <span>Kế toán: Trên mảnh + Dưới đúp</span>
                </button>
                <button className="sheet-popover-item" onClick={() => applyBorder('dashed')}>
                  <span>Viền nét đứt (Dashed Grid)</span>
                </button>
                <div className="sheet-popover-sep" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
                  <span style={{ fontSize: 11.5, color: '#475569' }}>Màu đường kẻ:</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['#0f172a', '#64748b', '#107c41', '#1d4ed8', '#dc2626'].map((bc) => (
                      <button
                        key={bc}
                        className="color-swatch-btn"
                        style={{
                          width: 18,
                          height: 18,
                          background: bc,
                          outline: borderColor === bc ? '2px solid #107c41' : 'none',
                        }}
                        onClick={() => setBorderColor(bc)}
                      />
                    ))}
                  </div>
                </div>
                <button className="sheet-popover-item" onClick={() => applyBorder('none')}>
                  <span style={{ color: '#dc2626' }}>Xoá toàn bộ khung viền</span>
                </button>
              </>
            )}

            {popover.kind === 'merge' && (
              <>
                <div className="sheet-popover-title">Gộp & Tách ô</div>
                <button className="sheet-popover-item" onClick={() => handleMergeCells('center')}>
                  <span>Gộp & Căn giữa (Merge & Center)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleMergeCells('across')}>
                  <span>Gộp theo từng dòng ngang (Merge Across)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleMergeCells('vertical')}>
                  <span>Gộp theo chiều dọc (Merge Vertically)</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => handleMergeCells('unmerge')}>
                  <span>Tách toàn bộ ô gộp (Unmerge Cells)</span>
                </button>
              </>
            )}

            {popover.kind === 'tableTheme' && (
              <>
                <div className="sheet-popover-title">Định dạng Bảng màu chuyên nghiệp</div>
                {TABLE_THEMES.map((t) => (
                  <button key={t.id} className="sheet-popover-item" onClick={() => handleFormatAsTable(t)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: t.headerBg,
                          border: `2px solid ${t.stripeBg}`,
                        }}
                      />
                      <span>{t.name}</span>
                    </span>
                  </button>
                ))}
              </>
            )}

            {popover.kind === 'cellStyle' && (
              <>
                <div className="sheet-popover-title">Kiểu ô chuẩn Excel (Cell Styles)</div>
                {CELL_STYLE_PRESETS.map((preset) => (
                  <button key={preset.id} className="sheet-popover-item" onClick={() => handleApplyCellPreset(preset)}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: preset.bg ?? '#ffffff',
                        color: preset.fg,
                        fontWeight: preset.bold ? 700 : 500,
                        fontStyle: preset.italic ? 'italic' : 'normal',
                        border: `1px solid ${preset.borderColor ?? '#e2e8f0'}`,
                        fontSize: 11.5,
                      }}
                    >
                      {preset.label}
                    </span>
                  </button>
                ))}
              </>
            )}

            {popover.kind === 'insertCells' && (
              <>
                <div className="sheet-popover-title">Chèn Dòng / Cột / Sheet</div>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('insertRowAbove')}>
                  <span>Chèn 1 dòng lên phía trên</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('insertRowBelow')}>
                  <span>Chèn 1 dòng xuống bên dưới</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('insertColLeft')}>
                  <span>Chèn 1 cột sang bên trái</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('insertColRight')}>
                  <span>Chèn 1 cột sang bên phải</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('shiftCellsDown')}>
                  <span>Chèn ô & đẩy xuống dưới</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('shiftCellsRight')}>
                  <span>Chèn ô & đẩy sang phải</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('insertSheet')}>
                  <span>Thêm Trang tính (Sheet) mới</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('duplicateSheet')}>
                  <span>Nhân bản Sheet hiện tại</span>
                </button>
              </>
            )}

            {popover.kind === 'deleteCells' && (
              <>
                <div className="sheet-popover-title">Xoá Dòng / Cột / Sheet</div>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('deleteRows')}>
                  <span>Xoá dòng đang chọn</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('deleteCols')}>
                  <span>Xoá cột đang chọn</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('shiftCellsUp')}>
                  <span>Xoá ô & dồn lên trên</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('shiftCellsLeft')}>
                  <span>Xoá ô & dồn sang trái</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('deleteSheet')}>
                  <span style={{ color: '#dc2626' }}>Xoá Trang tính hiện tại</span>
                </button>
              </>
            )}

            {popover.kind === 'formatCells' && (
              <>
                <button
                  className="sheet-popover-item"
                  onClick={() => {
                    setPopover(null);
                    openFormatCells();
                  }}
                >
                  <SquarePen size={14} />
                  <span>Định dạng ô… (Ctrl + 1)</span>
                </button>
                <div className="sheet-popover-sep" />
                <div className="sheet-popover-title">Kích thước & Ẩn/Hiện Ô</div>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('rowHeight')}>
                  <span>Chiều cao dòng (Row Height)…</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('colWidth')}>
                  <span>Độ rộng cột (Column Width)…</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('autoFitCols')}>
                  <span>Tự động căn vừa cột (AutoFit)</span>
                </button>
                <button
                  className="sheet-popover-item"
                  onClick={() => {
                    setPopover(null);
                    applyTextRotation(0);
                  }}
                >
                  <span>Đặt góc xoay chữ về ngang (0°)</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('hideRows')}>
                  <span>Ẩn dòng đang chọn</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('unhideRows')}>
                  <span>Hiện lại dòng bị ẩn lân cận</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('hideCols')}>
                  <span>Ẩn cột đang chọn</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('unhideCols')}>
                  <span>Hiện lại cột bị ẩn lân cận</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleStructureMutation('renameSheet')}>
                  <span>Đổi tên Sheet "{activeSheetName}"…</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleSheetOp('hide')}>
                  <span>Ẩn Sheet này</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleSheetOp('unhideAll')}>
                  <span>Hiện mọi Sheet đang ẩn</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleSheetOp('moveLeft')}>
                  <span>Chuyển Sheet sang trái</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleSheetOp('moveRight')}>
                  <span>Chuyển Sheet sang phải</span>
                </button>
              </>
            )}

            {popover.kind === 'autosum' && (
              <>
                <div className="sheet-popover-title">Hàm tổng hợp tự động</div>
                <button className="sheet-popover-item" onClick={() => handleAutoSum('SUM')}>
                  <span>∑ Tổng cộng (SUM)</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>Alt+=</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleAutoSum('AVERAGE')}>
                  <span>Trung bình cộng (AVERAGE)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleAutoSum('COUNT')}>
                  <span>Đếm số lượng ô số (COUNT)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleAutoSum('MAX')}>
                  <span>Giá trị lớn nhất (MAX)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleAutoSum('MIN')}>
                  <span>Giá trị nhỏ nhất (MIN)</span>
                </button>
                <div className="sheet-popover-sep" />
                <button
                  className="sheet-popover-item"
                  onClick={() => {
                    setPopover(null);
                    setModal('formulas');
                  }}
                >
                  <span style={{ color: '#107c41', fontWeight: 600 }}>Mở toàn bộ 54 hàm công thức…</span>
                </button>
              </>
            )}

            {popover.kind === 'fillSeries' && (
              <>
                <div className="sheet-popover-title">Sao chép & Đánh chuỗi tự động</div>
                <button className="sheet-popover-item" onClick={() => void handleFillRange('down')}>
                  <span>Điền xuống dưới (Fill Down)</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>Ctrl+D</span>
                </button>
                <button className="sheet-popover-item" onClick={() => void handleFillRange('right')}>
                  <span>Điền sang phải (Fill Right)</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>Ctrl+R</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => void handleFillRange('series')}>
                  <span>Đánh chuỗi cấp số cộng (Series 1, 2, 3…)</span>
                </button>
              </>
            )}

            {popover.kind === 'clearMenu' && (
              <>
                <div className="sheet-popover-title">Xoá vùng chọn ({activeRangeA1})</div>
                <button className="sheet-popover-item" onClick={() => handleClearSelection('all')}>
                  <span>Xoá tất cả (Nội dung + Định dạng)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleClearSelection('contents')}>
                  <span>Chỉ xoá Nội dung / Công thức (Delete)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleClearSelection('formats')}>
                  <span>Chỉ xoá Định dạng (Giữ nguyên số liệu)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleClearSelection('notes')}>
                  <span>Xoá Ghi chú ô (Cell Notes)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleClearSelection('links')}>
                  <span>Gỡ Liên kết Hyperlink</span>
                </button>
              </>
            )}

            {popover.kind === 'freezeMenu' && (
              <>
                <div className="sheet-popover-title">Cố định khung cuộn (Freeze Panes)</div>
                <button className="sheet-popover-item" onClick={() => handleFreezeMode('row1')}>
                  <span>Cố định dòng đầu tiên (Row 1)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleFreezeMode('row2')}>
                  <span>Cố định 2 dòng tiêu đề đầu (Rows 1–2)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleFreezeMode('col1')}>
                  <span>Cố định cột đầu tiên (Column A)</span>
                </button>
                <button className="sheet-popover-item" onClick={() => handleFreezeMode('cursor')}>
                  <span>Cố định tại vị trí con trỏ ({activeCellA1})</span>
                </button>
                <div className="sheet-popover-sep" />
                <button className="sheet-popover-item" onClick={() => handleFreezeMode('clear')}>
                  <span style={{ color: '#dc2626' }}>Gỡ bỏ cố định dòng/cột</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {showFormulaBar && !focusMode && (
        <div className="sheet-formula-bar">
          <input
            className="sheet-name-box"
            value={nameBoxText}
            onChange={(e) => setNameBoxText(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleGoToRef(nameBoxText);
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setNameBoxText(activeRangeA1);
                e.currentTarget.blur();
              }
            }}
            onBlur={() => setNameBoxText(activeRangeA1)}
            title="Hộp toạ độ ô / Tên vùng (Nhấn Enter để nhảy tới ô)"
          />
          <button
            className="sheet-fx-act"
            title="Huỷ chỉnh sửa (Esc)"
            onClick={() => {
              pendingFormulaEdit.current = null;
              formulaBarFocusedRef.current = false;
              syncUiFromSelection();
            }}
          >
            <X size={13} />
          </button>
          <button
            className="sheet-fx-act"
            title="Xác nhận giá trị / công thức (Enter)"
            onClick={() => {
              formulaBarFocusedRef.current = false;
              handleCommitFormulaBar();
            }}
          >
            <Check size={13} color="#107c41" />
          </button>
          <button
            className="sheet-fx-btn"
            title="Mở thư viện 54 hàm công thức Excel (fx)"
            onClick={() => setModal('formulas')}
          >
            fx
          </button>
          <input
            className="sheet-fx-input"
            value={formulaBarText}
            placeholder="Nhập giá trị hoặc công thức bắt đầu bằng dấu = (VD: =SUM(F4:F9))"
            onFocus={() => {
              formulaBarFocusedRef.current = true;
            }}
            onBlur={() => {
              formulaBarFocusedRef.current = false;
            }}
            onChange={(e) => {
              pendingFormulaEdit.current = { text: e.target.value, context: pendingFormulaEdit.current?.context ?? getEditableContext() };
              setFormulaBarText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                formulaBarFocusedRef.current = false;
                handleCommitFormulaBar();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                pendingFormulaEdit.current = null;
                formulaBarFocusedRef.current = false;
                syncUiFromSelection();
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      )}

      {showFormulasMode && (
        <div
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
            fontWeight: 600,
            borderBottom: '1px solid #fde68a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={16} color="#d97706" />
            <span>Đang ở chế độ Hiện công thức (Show Formulas) — Xem chuỗi công thức gốc trong ô. Nhấn Ctrl + ` hoặc nhấn nút để tắt.</span>
          </div>
          <button className="btn" style={{ minHeight: 24, padding: '2px 10px', fontSize: 12 }} onClick={() => setShowFormulasMode(false)}>
            Tắt hiện công thức
          </button>
        </div>
      )}

      <div className="sheet-workspace">
        <div
          ref={containerRef}
          className={`sheet-container ${!showFormulaBar ? 'sheet-hide-formula-bar' : ''}`}
        />

        <AddinPanel host={addinHost} />

        {showComments && (
          <aside className="doc-comments">
            <div className="comments-header">
              <h3>
                <MessageSquare size={15} color="#107c41" />
                <span>Thảo luận ô ({comments.length})</span>
              </h3>
              <button className="icon-btn" onClick={() => setShowComments(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            <div className="comments-list">
              {comments.map((c) => (
                <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
                  <div className="comment-card-top">
                    <div className="comment-author-badge">
                      <div className="comment-avatar" style={{ background: '#107c41' }}>
                        {c.author.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{c.author}</div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                          {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <button
                      className="filter-tab"
                      style={{ padding: '2px 7px', fontSize: 11, background: '#ecfdf5', color: '#065f46' }}
                      title="Nhảy tới toạ độ ô này"
                      onClick={() => handleGoToRef(c.quote || 'A1')}
                    >
                      Ô {c.quote || 'A1'}
                    </button>
                  </div>

                  <div className="comment-text">{c.text}</div>

                  {c.replies && c.replies.length > 0 && (
                    <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {c.replies.map((rep) => (
                        <div key={rep.id} style={{ fontSize: 11.5 }}>
                          <strong>{rep.author}:</strong> {rep.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {replyingCommentId === c.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        className="text-field"
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                        placeholder="Nhập phản hồi…"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddReply(c.id)}
                        autoFocus
                      />
                      <button className="btn btn-sheet" style={{ minHeight: 26, padding: '2px 8px' }} onClick={() => handleAddReply(c.id)}>
                        <Send size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="comment-actions">
                      <button
                        className="btn"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setReplyingCommentId(c.id)}
                      >
                        Trả lời
                      </button>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn"
                          style={{ minHeight: 24, padding: '2px 7px', fontSize: 11 }}
                          onClick={() => {
                            setComments((prev) =>
                              prev.map((item) => (item.id === c.id ? { ...item, resolved: !item.resolved } : item))
                            );
                            setSavedStatus('saving');
                          }}
                        >
                          <Check size={12} color="#16a34a" />
                          <span>{c.resolved ? 'Mở lại' : 'Xong'}</span>
                        </button>
                        <button
                          className="icon-btn"
                          style={{ width: 24, height: 24, color: '#dc2626' }}
                          onClick={() => {
                            setComments((prev) => prev.filter((item) => item.id !== c.id));
                            setSavedStatus('saving');
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="comment-new-box">
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  className="text-field"
                  style={{ width: 88, padding: '5px 8px', fontSize: 11.5, fontWeight: 700 }}
                  value={newCommentCell}
                  onChange={(e) => setNewCommentCell(e.target.value)}
                  title="Toạ độ ô gắn bình luận"
                />
                <input
                  className="text-field"
                  style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                  placeholder="Gắn bình luận vào ô đang chọn…"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
              </div>
              <button className="btn btn-sheet" style={{ width: '100%', minHeight: 30, fontSize: 12 }} onClick={handleAddComment}>
                <Send size={13} />
                <span>Gửi bình luận vào {newCommentCell || activeRangeA1}</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {auditTrace && (
        <div
          style={{
            position: 'fixed',
            bottom: showStatusBar ? 42 : 12,
            left: 20,
            right: showComments ? 340 : 20,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
            border: '1px solid #cbd5e1',
            zIndex: 80,
            padding: '10px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {auditTrace.mode === 'precedents' ? (
                <>
                  <CornerDownRight size={18} color="#2563eb" />
                  <span>Truy vết tiền đề (Precedents): Ô <strong>{auditTrace.cellA1}</strong> ({auditTrace.formula})</span>
                </>
              ) : (
                <>
                  <CornerUpRight size={18} color="#16a34a" />
                  <span>Truy vết phụ thuộc (Dependents): Ô <strong>{auditTrace.cellA1}</strong></span>
                </>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>— {auditTrace.items.length} ô tham chiếu</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                style={{ minHeight: 24, padding: '2px 8px', fontSize: 12 }}
                onClick={() => {
                  const ctx = getActiveContext();
                  if (!ctx) return;
                  if (auditTrace.items.length > 0) {
                    const first = auditTrace.items[0];
                    ctx.fWorksheet.getRange(first.row, first.col, (first.endRow ?? first.row) - first.row + 1, (first.endCol ?? first.col) - first.col + 1).activate();
                  }
                }}
              >
                Chọn ô đầu tiên
              </button>
              <button className="icon-btn" onClick={() => setAuditTrace(null)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 80, overflowY: 'auto' }}>
            {auditTrace.items.map((it, idx) => (
              <button
                key={`${it.ref}-${idx}`}
                className="btn"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: '4px 10px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => {
                  const ctx = getActiveContext();
                  if (!ctx) return;
                  ctx.fWorksheet.getRange(it.row, it.col, (it.endRow ?? it.row) - it.row + 1, (it.endCol ?? it.col) - it.col + 1).activate();
                  ui.toast(`Đã chọn vùng ${it.ref}`);
                }}
                title={it.formula || it.displayValue}
              >
                <strong style={{ color: '#0f172a' }}>{it.ref}</strong>
                <span style={{ color: '#64748b' }}>({it.displayValue})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showWatchWindow && (
        <div
          style={{
            position: 'fixed',
            bottom: showStatusBar ? 40 : 12,
            right: 20,
            width: 460,
            maxHeight: 360,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
            border: '1px solid #cbd5e1',
            zIndex: 85,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: '#065f46',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tv size={16} />
              <span>Cửa sổ giám sát ô (Watch Window)</span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 11,
                }}
              >
                {watchList.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="icon-btn"
                style={{ color: '#ffffff', width: 24, height: 24 }}
                onClick={() => setShowWatchWindow(false)}
                aria-label="Đóng"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ padding: '8px 12px', background: '#f1f5f9', display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
            <button
              className="btn btn-sheet"
              style={{ fontSize: 12, padding: '4px 10px', minHeight: 26 }}
              onClick={handleAddWatch}
            >
              <Plus size={13} />
              <span>+ Thêm ô ({activeCellA1})</span>
            </button>
            {watchList.length > 0 && (
              <button
                className="btn"
                style={{ fontSize: 12, padding: '4px 8px', minHeight: 26, color: '#dc2626' }}
                onClick={handleClearWatch}
              >
                <Trash2 size={13} />
                <span>Xoá hết</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240 }}>
            {watchList.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                Chưa có ô nào trong danh sách giám sát. Hãy chọn ô cần theo dõi trên trang tính và nhấn <strong>+ Thêm ô</strong>.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Sheet</th>
                    <th style={{ padding: '6px 8px' }}>Ô</th>
                    <th style={{ padding: '6px 8px' }}>Nhãn</th>
                    <th style={{ padding: '6px 8px' }}>Giá trị</th>
                    <th style={{ padding: '6px 8px' }}>Công thức</th>
                    <th style={{ padding: '6px 4px', width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {watchList.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => handleGoToRef(item.a1)}
                      title={`Bấm để chuyển tới ô ${item.a1}`}
                    >
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>{item.sheetName}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f766e' }}>{item.a1}</td>
                      <td style={{ padding: '6px 8px', color: '#334155' }}>{item.label}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{item.value}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{item.formula}</td>
                      <td
                        style={{ padding: '6px 4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveWatch(item.id);
                        }}
                      >
                        <button className="icon-btn" style={{ width: 20, height: 20, color: '#94a3b8' }} title="Bỏ theo dõi ô này">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showStatusBar && !focusMode && (
        <footer className="sheet-status-bar">
          <div className="sheet-status-left">
            <span className="sheet-stat-pill" style={{ fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
              {activeSheetName} · {activeRangeA1}
            </span>
            {isProtected && (
              <span className="sheet-stat-pill" style={{ color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' }}>
                <Lock size={11} />
                <span>Chỉ đọc</span>
              </span>
            )}
            {autoCompleteHint && (
              <span className="sheet-stat-pill" style={{ color: '#1e3a8a', background: '#eff6ff', borderColor: '#bfdbfe' }} role="status">
                Enter để điền: {autoCompleteHint}
              </span>
            )}
            {hasFilter && <span className="sheet-stat-pill">Đang bật Lọc</span>}
            {isFrozen && <span className="sheet-stat-pill">Cố định khung</span>}
            {cfRuleCount > 0 && <span className="sheet-stat-pill">Định dạng ĐK: {cfRuleCount}</span>}
            {printSettings.signedBy && (
              <span className="sheet-stat-pill" style={{ color: '#b91c1c' }}>
                Đã ký: {printSettings.signedBy}
              </span>
            )}
          </div>

          <div className="sheet-status-right">
            {selStats.count > 0 && (
              <>
                <span className="sheet-stat-pill">Đếm: <strong>{selStats.count}</strong></span>
                {selStats.numericCount > 0 && (
                  <>
                    <span className="sheet-stat-pill">
                      Tổng: <strong style={{ color: '#107c41' }}>{Math.round(selStats.sum * 100) / 100 === selStats.sum ? selStats.sum.toLocaleString('en-US') : selStats.sum.toFixed(2)}</strong>
                    </span>
                    <span className="sheet-stat-pill">
                      TB: <strong>{(Math.round(selStats.avg * 100) / 100).toLocaleString('en-US')}</strong>
                    </span>
                    {selStats.numericCount > 1 && (
                      <span className="sheet-stat-pill">
                        Min..Max: <strong>{selStats.min.toLocaleString('en-US')} .. {selStats.max.toLocaleString('en-US')}</strong>
                      </span>
                    )}
                  </>
                )}
              </>
            )}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <button
                className="icon-btn"
                style={{ width: 22, height: 22 }}
                onClick={() => handleSetZoom(zoomPct - 10)}
                title="Thu nhỏ"
              >
                <ZoomOut size={13} />
              </button>
              <button
                className="sheet-stat-pill"
                style={{ cursor: 'pointer', minWidth: 46, justifyContent: 'center' }}
                onClick={() => handleSetZoom(100)}
                title="Đặt lại 100%"
              >
                {zoomPct}%
              </button>
              <button
                className="icon-btn"
                style={{ width: 22, height: 22 }}
                onClick={() => handleSetZoom(zoomPct + 10)}
                title="Phóng to"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>
        </footer>
      )}

      {modal === 'formulas' && (
        <FormulaLibraryModal
          activeCellA1={activeCellA1}
          activeRangeA1={activeRangeA1}
          onInsert={handleInsertFormula}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'chart' && (
        <ChartStudioModal
          initialRange={modalSmartRange}
          sheetName={activeSheetName}
          readRangeValues={readRangeValuesByA1}
          onEmbedToSheet={async (pngDataUrl, chartTitle) => {
            await embedBase64ImageAtSelection(pngDataUrl, 500, 280);
            ui.toast(`Đã nhúng biểu đồ "${chartTitle}" vào ${activeCellA1}`);
          }}
          onDownloadPng={async (pngDataUrl, chartTitle) => {
            const res = await fetch(pngDataUrl);
            const blob = await res.blob();
            downloadBlob(blob, `${chartTitle}.png`);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'pivot' && (
        <PivotBuilderModal
          sourceRange={pivotSourceInfo.range}
          headers={pivotSourceInfo.headers}
          rowCount={pivotSourceInfo.rowCount}
          defaultSheetName={`Pivot - ${activeSheetName.slice(0, 18)}`}
          onCreatePivot={handleCreatePivotSheet}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'cf' && (
        <ConditionalFormatModal
          activeRangeA1={activeRangeA1}
          ruleCount={cfRuleCount}
          onApply={handleApplyConditionalRule}
          onClearSheetRules={handleClearSheetCfRules}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'dv' && (
        <DataValidationModal
          activeRangeA1={activeRangeA1}
          onApply={handleApplyValidation}
          onClearValidation={handleClearValidation}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'find' || modal === 'goto') && (
        <FindReplaceGoToModal
          initialMode={modal}
          definedNames={definedNames}
          onFindAll={handleFindAll}
          onReplaceOne={handleReplaceOne}
          onReplaceAll={handleReplaceAll}
          onGoToRef={handleGoToRef}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'signature' && (
        <SignatureStampModal
          defaultSigner={printSettings.signedBy ?? currentAuthorName()}
          defaultRole={printSettings.signedRole ?? 'Giám đốc'}
          onEmbedSignature={handleEmbedSignature}
          onSignAndSavePdf={handleSignAndSavePdf}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'pageSetup' && (
        <SheetPrintDialog
          workbook={liveSnapshotForModal}
          activeSheetId={modalActiveSheetId}
          title={stripSpreadsheetExt(title)}
          activeRangeA1={activeRangeA1}
          settings={printSettings}
          onSaveSettings={(next) => updatePrintSettings(next)}
          onDownloadHtml={handleDownloadPrintHtml}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'nameManager' && (
        <NameManagerModal
          activeRangeA1={activeRangeA1}
          sheetName={activeSheetName}
          definedNames={definedNames}
          onAddName={(name, ref) => {
            const ctx = getEditableContext();
            if (!ctx) return;
            ctx.fWorkbook.insertDefinedName(name, ref);
            syncDefinedNames();
            setSavedStatus('saving');
            ui.toast(`Đã thêm tên vùng "${name}"`);
          }}
          onDeleteName={(name) => {
            const ctx = getEditableContext();
            if (!ctx) return;
            ctx.fWorkbook.deleteDefinedName(name);
            syncDefinedNames();
            setSavedStatus('saving');
          }}
          onJumpToRef={(ref) => {
            handleGoToRef(ref);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'formatCells' && formatCellsInit && (
        <FormatCellsModal
          rangeA1={activeRangeA1}
          sampleValue={formatCellsInit.sample}
          initial={formatCellsInit.state}
          onApply={handleApplyFormatCells}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'customSort' && proTable && (
        <CustomSortModal rangeA1={proTable.a1} headers={proTable.headers} onApply={handleCustomSort} onClose={() => setModal(null)} />
      )}

      {modal === 'subtotal' && proTable && (
        <SubtotalModal
          rangeA1={proTable.a1}
          headers={proTable.headers}
          numericColumns={proTable.numericColumns}
          onApply={handleSubtotal}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'advFilter' && proTable && (
        <AdvancedFilterModal
          rangeA1={proTable.a1}
          headers={proTable.headers}
          rows={proTable.rows}
          onApply={handleAdvancedFilter}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'dataTable' && <DataTableModal activeCellA1={activeCellA1} onRun={handleRunDataTable} onClose={() => setModal(null)} />}

      {modal === 'symbol' && <SymbolPickerModal onInsert={handleInsertSymbol} onClose={() => setModal(null)} />}

      {modal === 'shape' && (
        <ShapeInsertModal key={shapeKind} initialKind={shapeKind} onInsert={(spec) => void handleInsertShape(spec)} onClose={() => setModal(null)} />
      )}

      {modal === 'gotoSpecial' && gotoScope && (
        <GoToSpecialModal
          scopeA1={formatA1Range(gotoScope.startRow, gotoScope.startColumn, gotoScope.endRow, gotoScope.endColumn)}
          onApply={handleGoToSpecial}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'a11y' && (
        <AccessibilityCheckerModal
          issues={a11yIssues}
          onGoTo={(sheetName, where) => {
            const ctx = getActiveContext();
            const target = ctx?.fWorkbook.getSheetByName(sheetName);
            if (!ctx || !target) return;
            ctx.fWorkbook.setActiveSheet(target);
            const cell = parseA1Range(where.split(' ')[0]);
            if (cell) target.getRange(cell.startRow, cell.startColumn, 1, 1).activate();
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'goalSeek' && (
        <GoalSeekModal
          activeCellA1={activeCellA1}
          onRunGoalSeek={handleGoalSeek}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'aiAnalysis' || modal === 'aiAudit' || modal === 'aiAssistant') && (
        <AiAuditModal
          initialTab={modal === 'aiAudit' ? 'audit' : modal === 'aiAssistant' ? 'assistant' : 'analysis'}
          analysis={liveAnalysisForModal}
          activeRangeA1={activeRangeA1}
          onJumpToCell={(a1) => {
            handleGoToRef(a1);
          }}
          onWrapErrorsWithIfError={() => {
            handleWrapErrorsWithIfError();
            setLiveAnalysisForModal(computeLiveAnalysis());
          }}
          onTrimAllSpaces={() => {
            handleDataCleanup('trim');
            setLiveAnalysisForModal(computeLiveAnalysis());
          }}
          onConvertTextNumbers={() => {
            handleDataCleanup('toNumber');
            setLiveAnalysisForModal(computeLiveAnalysis());
          }}
          onInsertFormula={handleInsertFormula}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'split' || modal === 'merge' || modal === 'image') && (
        <SplitMergeImageModal
          mode={modal}
          workbook={liveSnapshotForModal}
          workspaceSheets={workspaceSheets}
          onSplitSingle={handleSplitSingle}
          onSplitAll={handleSplitAll}
          onMergeFiles={handleMergeFiles}
          onMergeWorkspaceSheet={handleMergeWorkspaceSheet}
          onExportPng={handleExportPng}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'templates' && (
        <TemplatesGalleryModal onSelectTemplate={handleSelectTemplate} onClose={() => setModal(null)} />
      )}

      {modal === 'history' && (
        <VersionHistoryModal
          versions={versions}
          onCreateSnapshot={handleCreateSnapshot}
          onRestore={handleRestoreVersion}
          onDelete={handleDeleteVersion}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'share' && (
        <ShareAndProtectModal
          title={stripSpreadsheetExt(title)}
          isProtected={isProtected}
          onCopySummaryTsv={handleCopySummaryTsv}
          onExportXlsx={handleExportXlsx}
          onExportJson={handleExportJsonFile}
          onToggleProtect={handleToggleProtect}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'help' && <HelpShortcutsModal onClose={() => setModal(null)} />}
      {modal === 'macroRecord' && (
        <MacroRecordModal suggestedName={nextMacroName(macros)} macros={macros} vbaMacros={vbaMacros} startCellA1={activeCellA1} onStart={handleStartRecording} onClose={() => setModal(null)} />
      )}
      {modal === 'macros' && (
        <MacroManagerModal
          macros={macros}
          vbaMacros={vbaMacros}
          onRunVba={(id) => {
            setModal(null);
            runVbaMacroById(id);
          }}
          onVbaShortcut={handleVbaShortcut}
          onEditVba={(module) => openVbaEditor(module)}
          onConvertToVba={handleConvertToVba}
          onRun={(id) => {
            const macro = macros.find((item) => item.id === id);
            setModal(null);
            if (macro) void runRecordedMacro(macro);
          }}
          onRunBuiltin={(id) => {
            setModal(null);
            runBuiltinMacro(id);
          }}
          onUpdate={(next) => {
            setMacros((previous) => previous.map((item) => (item.id === next.id ? { ...next, name: uniqueMacroName(next.name, previous.filter((other) => other.id !== next.id)) } : item)));
            setSavedStatus('saving');
            ui.toast(`Đã lưu thay đổi của macro "${next.name}"`);
          }}
          onDelete={(id) => {
            setMacros((previous) => previous.filter((item) => item.id !== id));
            setSavedStatus('saving');
            ui.toast('Đã xoá macro');
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'macroButton' && (
        <MacroButtonModal
          macros={macros}
          vbaMacros={vbaMacros}
          rangeA1={activeRangeA1}
          initialLabel={String(getActiveContext()?.fRange.getValue() ?? '') || 'Chạy macro'}
          initialTarget={macroButtonTarget()}
          onInsert={handleApplyMacroButton}
          onRemove={macroButtonTarget() ? handleRemoveMacroButton : null}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'vba' && (
        <VbaEditorModal
          modules={vbaProject?.modules ?? []}
          initialModule={vbaEditorModule}
          output={vbaOutput}
          onSave={(modules) => {
            saveVbaModules(modules);
            ui.toast('Đã lưu mã VBA');
          }}
          onRun={(macroId, modules) => runVbaMacroById(macroId, saveVbaModules(modules))}
          onClearOutput={() => setVbaOutput([])}
          onClose={() => setModal(null)}
        />
      )}
      {designMode && (
        <button
          onClick={() => setDesignMode(false)}
          style={{ position: 'fixed', left: 18, bottom: 54, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.18)' }}
          title="Tắt Chế độ thiết kế để bấm nút chạy macro"
        >
          <PencilRuler size={15} /> <span>Chế độ thiết kế: bấm để tắt</span>
        </button>
      )}
      {recordedCount !== null && (
        <button
          onClick={handleStopRecording}
          style={{ position: 'fixed', right: 18, bottom: 54, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.18)' }}
          title="Dừng ghi và lưu macro"
        >
          <Square size={14} fill="#dc2626" color="#dc2626" />
          <span>Đang ghi macro · {recordedCount} thao tác · Dừng</span>
        </button>
      )}

      {modal === 'vietqr' && (
        <VietQrModal
          onInsertQr={(card) => void handleInsertVietQr(card)}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'dataCleaning' && proTable && (
        <DataCleaningModal
          headers={proTable.headers}
          rows={proTable.rows}
          onApplyCleaned={handleApplyCleaned}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'fuzzyReconcile' && proTable && (
        <FuzzyReconcileModal
          headers={proTable.headers}
          rows={proTable.rows}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'sheetSql' && proTable && (
        <SheetSqlModal
          headers={proTable.headers}
          rows={proTable.rows}
          onExportQueryResults={handleExportQueryResults}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'workbookDoctor' && doctorData && (
        <WorkbookDoctorModal
          health={doctorData.health}
          onClean={handleCleanWorkbook}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'marketQuotes' && (
        <MarketQuotesModal
          onExportQuotes={handleExportQuotes}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'choropleth' && proTable && (
        <VietnamMapModal
          headers={proTable.headers}
          rows={proTable.rows}
          numericColumns={proTable.numericColumns}
          onExportReport={handleExportChoropleth}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'workbookDiff' && diffData && (
        <WorkbookDiffModal
          sheets={diffData.sheets}
          versions={diffData.versions}
          activeSheetName={activeSheetName}
          onExportDiffReport={handleExportDiffReport}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'pythonSandbox' && proTable && (
        <PythonSandboxModal
          headers={proTable.headers}
          rows={proTable.rows}
          onExportPythonResult={handleExportPythonResult}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'slicer' && proTable && (
        <TableSlicerModal
          headers={proTable.headers}
          rows={proTable.rows}
          onApplyFilter={handleApplySlicerFilter}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
