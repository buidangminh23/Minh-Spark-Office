import { SuiteLogo } from '../../components/SuiteLogo';
import { saveAccountSnapshot } from '../../lib/accountSnapshots';
import { useAccount } from '../../components/Authentication';
import { useWorkspace } from '../../lib/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreViVN from '@univerjs/preset-sheets-core/locales/vi-VN';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsConditionalFormattingPreset, CFValueType } from '@univerjs/preset-sheets-conditional-formatting';
import UniverPresetSheetsCfViVN from '@univerjs/preset-sheets-conditional-formatting/locales/vi-VN';
import UniverPresetSheetsCfEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDvViVN from '@univerjs/preset-sheets-data-validation/locales/vi-VN';
import UniverPresetSheetsDvEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import UniverPresetSheetsDrawingViVN from '@univerjs/preset-sheets-drawing/locales/vi-VN';
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import UniverPresetSheetsFilterViVN from '@univerjs/preset-sheets-filter/locales/vi-VN';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import UniverPresetSheetsFindViVN from '@univerjs/preset-sheets-find-replace/locales/vi-VN';
import UniverPresetSheetsFindEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import UniverPresetSheetsLinkViVN from '@univerjs/preset-sheets-hyper-link/locales/vi-VN';
import UniverPresetSheetsLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import UniverPresetSheetsNoteViVN from '@univerjs/preset-sheets-note/locales/vi-VN';
import UniverPresetSheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import UniverPresetSheetsSortViVN from '@univerjs/preset-sheets-sort/locales/vi-VN';
import UniverPresetSheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';

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
  PenTool,
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
  exportSingleSheetToXlsx,
  exportSheetToStyledHtml,
  renderSheetToPngBlob,
} from '../../lib/xlsxConvert';
import { downloadBlob } from '../../lib/download';
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
  parseA1Range,
  readVietnameseMoneyWords,
  THEME_COLOR_SWATCHES,
  CELL_STYLE_PRESETS,
  TABLE_THEMES,
  WORKBOOK_THEMES,
  coerceNumeric,
  extractTableRecords,
  buildPivotSheetData,
  analyzeSheetData,
  type CellStylePreset,
  type TableThemePreset,
  type WorkbookThemePreset,
  type PivotAggFn,
} from './sheetUtils';
import {
  FormulaLibraryModal,
  ChartStudioModal,
  PivotBuilderModal,
  ConditionalFormatModal,
  DataValidationModal,
  FindReplaceGoToModal,
  SignatureStampModal,
  PageSetupPreviewModal,
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
  | 'minh_pdf'
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

interface MacroExecutionRecord {
  id: string;
  macroId: string;
  title: string;
  detail: string;
  time: number;
}

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

  const [comments, setComments] = useState<CommentItem[]>(
    () =>
      content.comments ?? [
        {
          id: 'cmt-init',
          author: 'Bùi Đăng Minh',
          quote: 'E8',
          text: 'Kiểm tra đối chiếu tổng hợp số liệu và tỷ trọng trước khi ký phát hành.',
          createdAt: Date.now() - 3600000,
          resolved: false,
        },
      ]
  );
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentCell, setNewCommentCell] = useState('A1');
  const [replyText, setReplyText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  const [printSettings, setPrintSettings] = useState<SheetPrintSettings>(
    () => content.printSettings ?? DEFAULT_PRINT_SETTINGS
  );
  const [printHostHtml, setPrintHostHtml] = useState('');

  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [clipboardBuf, setClipboardBuf] = useState<ClipboardBuffer | null>(null);
  const [painterArmed, setPainterArmed] = useState(false);

  const [activeSheetName, setActiveSheetName] = useState('Sheet1');
  const [activeCellA1, setActiveCellA1] = useState('A1');
  const [activeRangeA1, setActiveRangeA1] = useState('A1');
  const [nameBoxText, setNameBoxText] = useState('A1');
  const [formulaBarText, setFormulaBarText] = useState('');
  const formulaBarFocusedRef = useRef(false);
  const [selectedFont, setSelectedFont] = useState('Segoe UI');
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

  const [selStats, setSelStats] = useState<SelectionStats>({
    count: 0,
    numericCount: 0,
    sum: 0,
    avg: 0,
    min: 0,
    max: 0,
  });

  const [macroLogs, setMacroLogs] = useState<MacroExecutionRecord[]>([]);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [workspaceSheets, setWorkspaceSheets] = useState<FileMeta[]>([]);

  type SheetModalKind =
    | null
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
    | 'help';

  const [modal, setModalState] = useState<SheetModalKind>(null);
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
    const { fWorksheet, fRange } = ctx;
    try {
      const rawRange = fRange.getRange();
      const cellA1 = formatA1Cell(rawRange.startRow, rawRange.startColumn);
      const fullA1 = formatA1Range(rawRange.startRow, rawRange.startColumn, rawRange.endRow, rawRange.endColumn);
      setActiveSheetName(fWorksheet.getSheetName());
      setActiveCellA1(cellA1);
      setActiveRangeA1(fullA1);
      setNameBoxText(fullA1);
      setNewCommentCell(fullA1);

      if (!formulaBarFocusedRef.current) {
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
      setSelectedFont(styleData?.ff || 'Segoe UI');
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
  }, [setSavedStatus, captureHydratedWorkbook, meta, title, onSave, comments, printSettings, ui]);

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
          if (
            id.includes('mutation') ||
            id.includes('set-') ||
            id.includes('insert-') ||
            id.includes('remove-') ||
            id.includes('delete-') ||
            id.includes('merge') ||
            id.includes('sort') ||
            id.includes('filter') ||
            id.includes('validation') ||
            id.includes('conditional')
          ) {
            setSavedStatus('saving');
          }
          if (id.includes('active-sheet') || id.includes('set-style') || id.includes('zoom') || id.includes('freeze') || id.includes('gridlines')) {
            setTimeout(() => syncUiFromSelection(), 20);
          }
        });
        workbookSubsRef.current.push(selectionSub, commandSub);
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
          [LocaleType.EN_US]: mergeLocales(
            UniverPresetSheetsCoreEnUS,
            UniverPresetSheetsCfEnUS,
            UniverPresetSheetsDvEnUS,
            UniverPresetSheetsDrawingEnUS,
            UniverPresetSheetsFilterEnUS,
            UniverPresetSheetsFindEnUS,
            UniverPresetSheetsLinkEnUS,
            UniverPresetSheetsNoteEnUS,
            UniverPresetSheetsSortEnUS
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: mountEl,
            header: false,
            toolbar: false,
            formulaBar: true,
            footer: {
              sheetBar: true,
              statisticBar: true,
              menus: true,
              zoomSlider: true,
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
      univer.createUnit(UniverInstanceType.UNIVER_SHEET, clonedWb);
      recalculateAndBindWorkbook(univerAPI);

      setTimeout(() => {
        if (cancelled) return;
        syncUiFromSelection();
        syncDefinedNames();
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
      const ctx = getActiveContext();
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
    [getActiveContext, activeRangeA1, ui]
  );

  const handlePasteMode = useCallback(
    async (mode: 'all' | 'values' | 'formulas' | 'formats' | 'transpose') => {
      setPopover(null);
      const ctx = getActiveContext();
      if (!ctx) return;
      const dest = ctx.fRange.getRange();

      if (clipboardBuf) {
        const srcRows = clipboardBuf.values.length;
        const srcCols = Math.max(1, ...clipboardBuf.values.map((r) => r.length));
        const outRows = mode === 'transpose' ? srcCols : srcRows;
        const outCols = mode === 'transpose' ? srcRows : srcCols;

        for (let r = 0; r < outRows; r++) {
          for (let c = 0; c < outCols; c++) {
            const sr = mode === 'transpose' ? c : r;
            const sc = mode === 'transpose' ? r : c;
            const targetCell = ctx.fWorksheet.getRange(dest.startRow + r, dest.startColumn + c, 1, 1);
            const f = clipboardBuf.formulas[sr]?.[sc];
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
          if (cutSheet) {
            const { sr, sc, er, ec } = clipboardBuf.cutSource;
            cutSheet.getRange(sr, sc, er - sr + 1, ec - sc + 1).clear();
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
    [setSavedStatus, clipboardBuf, getActiveContext, applyStyleObjectToRange, syncUiFromSelection, ui]
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
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setFontFamily(font);
    setSavedStatus('saving');
  };

  const applyFontSize = (sizeStr: string) => {
    const num = Math.max(6, Math.min(72, Number(sizeStr) || 11));
    setSelectedFontSize(String(num));
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setFontSize(num);
    setSavedStatus('saving');
  };

  const toggleBold = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const next = !isBold;
    ctx.fRange.setFontWeight(next ? 'bold' : 'normal');
    setIsBold(next);
    setSavedStatus('saving');
  };

  const toggleItalic = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const next = !isItalic;
    ctx.fRange.setFontStyle(next ? 'italic' : 'normal');
    setIsItalic(next);
    setSavedStatus('saving');
  };

  const toggleUnderline = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const next = !isUnderline;
    ctx.fRange.setFontLine(next ? 'underline' : 'none');
    setIsUnderline(next);
    if (next) setIsStrike(false);
    setSavedStatus('saving');
  };

  const toggleStrike = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const next = !isStrike;
    ctx.fRange.setFontLine(next ? 'line-through' : 'none');
    setIsStrike(next);
    if (next) setIsUnderline(false);
    setSavedStatus('saving');
  };

  const applyFill = (color: string | null) => {
    setPopover(null);
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    if (color) setFontColor(color);
    ctx.fRange.setFontColor(color ?? '#0f172a');
    setSavedStatus('saving');
  };

  const applyBorder = (preset: 'all' | 'outside' | 'thickOutside' | 'bottom' | 'topBottomDouble' | 'dashed' | 'none') => {
    setPopover(null);
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setHorizontalAlignment(align);
    setHAlign(align);
    setSavedStatus('saving');
  };

  const applyVAlign = (align: 'top' | 'middle' | 'bottom') => {
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setVerticalAlignment(align);
    setVAlign(align);
    setSavedStatus('saving');
  };

  const toggleWrapText = () => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const next = !isWrap;
    ctx.fRange.setWrap(next);
    setIsWrap(next);
    setSavedStatus('saving');
  };

  const applyTextRotation = (angle: number) => {
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setTextRotation(angle);
    setSavedStatus('saving');
  };

  const handleMergeCells = (mode: 'toggle' | 'center' | 'across' | 'vertical' | 'unmerge') => {
    setPopover(null);
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    setSelectedNumberFormat(pattern);
    ctx.fRange.setNumberFormat(pattern === 'General' ? '@' : pattern);
    setSavedStatus('saving');
  };

  const adjustDecimals = (delta: number) => {
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    const { fWorkbook, fWorksheet, fRange } = ctx;
    const r = fRange.getRange();
    const rowSpan = r.endRow - r.startRow + 1;
    const colSpan = r.endColumn - r.startColumn + 1;

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
      const ctx = getActiveContext();
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
            dest.setNumberFormat('#,##0.##');
          }
          ui.toast(`Đã điền công thức =${fn}(...) xuống dòng ${r.endRow + 2}`);
        } else {
          const ref = formatA1Range(r.startRow, r.startColumn, r.startRow, r.endColumn);
          const dest = fWorksheet.getRange(r.startRow, r.endColumn + 1, 1, 1);
          dest.setValue(`=${fn}(${ref})`);
          dest.setFontWeight('bold');
          dest.setNumberFormat('#,##0.##');
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
    [setSavedStatus, getActiveContext, ui]
  );

  const handleFillRange = useCallback(
    async (mode: 'down' | 'right' | 'series') => {
      setPopover(null);
      const ctx = getActiveContext();
      if (!ctx) return;
      const { fWorksheet, fRange } = ctx;
      const r = fRange.getRange();

      if (mode === 'down') {
        if (r.endRow === r.startRow && r.startRow > 0) {
          for (let c = r.startColumn; c <= r.endColumn; c++) {
            const above = fWorksheet.getRange(r.startRow - 1, c, 1, 1);
            const f = above.getFormula();
            fWorksheet.getRange(r.startRow, c, 1, 1).setValue(f || (above.getRawValue() as string | number | boolean) || '');
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
            fWorksheet.getRange(row, r.startColumn, 1, 1).setValue(f || (left.getRawValue() as string | number | boolean) || '');
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
    [setSavedStatus, getActiveContext, ui]
  );

  const handleSortSheet = (ascending: boolean) => {
    const ctx = getActiveContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    if (raw.endRow > raw.startRow) {
      ctx.fRange.sort({ column: 0, ascending });
      setSavedStatus('saving');
      ui.toast(`Đã sắp xếp vùng chọn ${ascending ? 'tăng dần (A → Z)' : 'giảm dần (Z → A)'}`);
      return;
    }
    const smart = parseA1Range(getSmartDataRangeA1());
    if (!smart || smart.endRow <= smart.startRow + 1) return;
    const bodyStartRow = smart.startRow + 1;
    let bodyEndRow = smart.endRow;
    const lastLbl = String(ctx.fWorksheet.getRange(bodyEndRow, smart.startColumn, 1, 1).getValue() ?? '').toLowerCase();
    if (lastLbl.startsWith('tổng') || lastLbl.startsWith('total')) bodyEndRow -= 1;
    if (bodyEndRow <= bodyStartRow) return;
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    const targetA1 = ctx.fRange.getRange().endRow > ctx.fRange.getRange().startRow ? activeRangeA1 : getSmartDataRangeA1();
    const parsed = parseA1Range(targetA1);
    if (!parsed) return;
    const rows = parsed.endRow - parsed.startRow + 1;
    const cols = parsed.endColumn - parsed.startColumn + 1;
    const range = ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, rows, cols);
    const vals = range.getRawValues();
    const seen = new Set<string>();
    const uniqueRows: unknown[][] = [];
    let removed = 0;
    vals.forEach((row, idx) => {
      if (idx === 0) {
        uniqueRows.push(row);
        return;
      }
      const key = JSON.stringify(row.map((v) => (v === null || v === undefined ? '' : String(v).trim())));
      if (seen.has(key)) removed += 1;
      else {
        seen.add(key);
        uniqueRows.push(row);
      }
    });
    if (removed === 0) {
      ui.toast('Không phát hiện dòng dữ liệu trùng lặp nào');
      return;
    }
    while (uniqueRows.length < rows) {
      uniqueRows.push(Array.from({ length: cols }, () => ''));
    }
    range.setValues(uniqueRows as (string | number | boolean)[][]);
    setSavedStatus('saving');
    ui.toast(`Đã loại bỏ ${removed} dòng trùng lặp trong ${targetA1}`);
  };

  const handleApplyValidation = (input: ValidationRuleInput) => {
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    (ctx.fRange as unknown as { setDataValidation: (rule: null) => void }).setDataValidation(null);
    setSavedStatus('saving');
    ui.toast(`Đã gỡ kiểm tra dữ liệu tại ${activeRangeA1}`);
  };

  const handleDataCleanup = (op: 'trim' | 'toNumber' | 'upper' | 'lower' | 'proper') => {
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    ctx.fRange.setValue(formula.startsWith('=') ? formula : `=${formula}`);
    setSavedStatus('saving');
    syncUiFromSelection();
    ui.toast(`Đã chèn công thức vào ${activeCellA1}`);
  };

  const handleReadMoneyWords = () => {
    const ctx = getActiveContext();
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
      void navigator.clipboard?.writeText(words);
      ui.toast(`${words} (Đã sao chép vào Clipboard)`);
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    const cell = ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, 1, 1);
    const trimmed = formulaBarText.trim();
    if (trimmed === '') {
      cell.setValue('');
    } else if (trimmed.startsWith('=')) {
      cell.setValue(trimmed);
    } else {
      const n = coerceNumeric(trimmed);
      cell.setValue(n !== null && /^-?\d+(\.\d+)?$/.test(trimmed) ? n : formulaBarText);
    }
    try {
      ctx.api.getFormula()?.executeCalculation();
    } catch {
      void 0;
    }
    setSavedStatus('saving');
    setTimeout(() => syncUiFromSelection(), 35);
  }, [setSavedStatus, getActiveContext, formulaBarText, syncUiFromSelection]);

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

    const waitTick = () => new Promise((r) => setTimeout(r, 25));
    const evalAt = async (x: number): Promise<number> => {
      vCell.setValue(x);
      try {
        ctx.api.getFormula()?.executeCalculation();
      } catch {
        void 0;
      }
      await waitTick();
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
      const ctx = getActiveContext();
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
    [setSavedStatus, getActiveContext]
  );

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
    const ctx = getActiveContext();
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

  const handleTriggerVectorPrint = useCallback(
    (overrideSettings?: SheetPrintSettings) => {
      const nextSettings = overrideSettings ?? printSettings;
      if (overrideSettings) setPrintSettings(overrideSettings);
      const wb = captureHydratedWorkbook();
      const ctx = getActiveContext();
      const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
      const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
      if (!sh) return;
      const html = exportSheetToStyledHtml(wb, sh, {
        title: stripSpreadsheetExt(title),
        showGridlines: nextSettings.showGridlines,
        printArea: nextSettings.printArea,
        orientation: nextSettings.orientation,
        paperSize: nextSettings.paperSize,
        fitToPage: nextSettings.fitToPage,
        signedBy: nextSettings.signedBy,
        signedRole: nextSettings.signedRole,
        signedAt: nextSettings.signedAt,
        standalone: false,
      });
      setPrintHostHtml(html);
      document.body.classList.add('printing-sheet');
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-sheet');
        }, 400);
      }, 120);
    },
    [printSettings, captureHydratedWorkbook, getActiveContext, title]
  );

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
      standalone: true,
    });
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `${stripSpreadsheetExt(title)}-${sh.name}.html`);
    ui.toast('Đã tải tệp bản in HTML Vector sắc nét');
  };

  const handleExportXlsx = async () => {
    try {
      ui.showBusy('Đang xuất tệp Excel (.xlsx)…');
      const wb = captureHydratedWorkbook();
      const blob = await exportWorkbookToXlsx(wb);
      downloadBlob(blob, `${stripSpreadsheetExt(title)}.xlsx`);
      ui.toast(`Đã tải xuống "${stripSpreadsheetExt(title)}.xlsx"`);
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất XLSX', true);
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
    const blob = ext === 'csv' ? exportSheetToCsv(sh, wb) : exportSheetToTsv(sh, wb);
    downloadBlob(blob, `${stripSpreadsheetExt(title)}.${ext}`);
    ui.toast(`Đã tải xuống "${stripSpreadsheetExt(title)}.${ext}"`);
  };

  const handleExportJsonFile = () => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const activeId = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[activeId] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    const blob = exportSheetToJson(sh, wb);
    downloadBlob(blob, `${stripSpreadsheetExt(title)}.json`);
    ui.toast(`Đã xuất dữ liệu JSON "${stripSpreadsheetExt(title)}.json"`);
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
      const ctx = getActiveContext();
      if (!ctx) return 0;
      let added = 0;
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
        ctx.fWorkbook.setActiveSheet(created);
        added += 1;
      }
      try {
        ctx.api.getFormula()?.executeCalculation();
      } catch {
        void 0;
      }
      setSavedStatus('saving');
      syncUiFromSelection();
      return added;
    },
    [setSavedStatus, getActiveContext, syncUiFromSelection]
  );

  const handleMergeFiles = async (files: FileList) => {
    ui.showBusy('Đang đọc và gộp các trang tính…');
    try {
      let totalSheets = 0;
      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer();
        const parsedWb = await importSpreadsheet(buf, file.name);
        totalSheets += appendWorkbookSheetsIntoLive(parsedWb);
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
    const ctx = getActiveContext();
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
    setMacroLogs((prev) => [
      { id: `m-${Date.now()}`, macroId, title: macroTitle, detail, time: Date.now() },
      ...prev.slice(0, 9),
    ]);
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
      } else if (mod && e.key === ';') {
        e.preventDefault();
        const ctx = getActiveContext();
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
  }, [setSavedStatus, handleSaveNow, handleAutoSum, handleFillRange, getActiveContext, syncDefinedNames, setModal, focusMode, ui]);

  const handleInsertHyperlink = async () => {
    const ctx = getActiveContext();
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
    const ctx = getActiveContext();
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
    const draft: SheetContent = { kind: 'sheet', workbook: captureHydratedWorkbook(), comments, printSettings };
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
    handleTriggerVectorPrint(nextPrint);
  };

  const handleCopySummaryTsv = async () => {
    const wb = captureHydratedWorkbook();
    const ctx = getActiveContext();
    const sid = ctx?.fWorksheet.getSheetId() ?? wb.sheetOrder[0];
    const sh = wb.sheets[sid] ?? wb.sheets[wb.sheetOrder[0]];
    if (!sh) return;
    const blob = exportSheetToTsv(sh, wb);
    const text = await blob.text();
    await navigator.clipboard.writeText(text.replace(/^\uFEFF/, ''));
    ui.toast('Đã sao chép toàn bộ bảng (TSV) vào Clipboard');
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const cmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: 'Bùi Đăng Minh',
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
                  author: 'Bùi Đăng Minh',
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
                  ['minh_pdf', 'Minh PDF'],
                  ['help', 'Help'],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  className={`ribbon-tab ${activeTab === tabId ? 'active' : ''}`}
                  style={
                    tabId === 'minh_pdf' && activeTab === 'minh_pdf'
                      ? { color: '#dc2626', borderBottomColor: '#dc2626' }
                      : undefined
                  }
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
                        {['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Tahoma', 'Verdana', 'Roboto', 'Courier New'].map((f) => (
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
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAnalysis')}>
                      <Bot size={20} color="#7c3aed" />
                      <span>Minh AI</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Trí tuệ AI</div>
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
                  </div>
                  <div className="ribbon-group-label">Bảng tổng hợp</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => imageInputRef.current?.click()}>
                      <ImageIcon size={20} color="#2563eb" />
                      <span>Chèn ảnh</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('signature')}>
                      <FileSignature size={20} color="#dc2626" />
                      <span>Con dấu ký</span>
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
                        const ctx = getActiveContext();
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
                    <button className="ribbon-btn-large" onClick={() => setModal('signature')}>
                      <PenTool size={20} color="#dc2626" />
                      <span>Vẽ chữ ký tay</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('signature')}>
                      <FileSignature size={20} color="#1d4ed8" />
                      <span>Đóng mộc đỏ</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Bút ký & Con dấu</div>
                </div>

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
                      onClick={() =>
                        setPrintSettings((p) => ({
                          ...p,
                          orientation: p.orientation === 'landscape' ? 'portrait' : 'landscape',
                        }))
                      }
                    >
                      <Rows size={20} color="#0284c7" />
                      <span>{printSettings.orientation === 'landscape' ? 'Khổ Ngang' : 'Khổ Dọc'}</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        setPrintSettings((p) => ({ ...p, printArea: activeRangeA1 }));
                        ui.toast(`Đã đặt Vùng in = ${activeRangeA1}`);
                      }}
                    >
                      <Check size={20} color="#16a34a" />
                      <span>Đặt vùng in</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        setPrintSettings((p) => ({ ...p, printArea: '' }));
                        ui.toast('Đã xoá giới hạn vùng in (In toàn bộ Sheet)');
                      }}
                    >
                      <X size={20} color="#dc2626" />
                      <span>Xoá vùng in</span>
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
                    <button className="ribbon-btn-large" onClick={handleReadMoneyWords} title="Đọc số tiền VNĐ thành chữ kế toán">
                      <Calculator size={20} color="#d97706" />
                      <span>Đọc số VNĐ</span>
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
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAudit')}>
                      <AlertTriangle size={20} color="#dc2626" />
                      <span>Kiểm lỗi #</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleWrapErrorsWithIfError}>
                      <ShieldCheck size={20} color="#0f766e" />
                      <span>Bọc IFERROR</span>
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
                  </div>
                  <div className="ribbon-group-label">Sắp xếp & Lọc</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
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
                    <button className="ribbon-btn-large" onClick={() => setModal('pivot')}>
                      <Table size={20} color="#107c41" />
                      <span>PivotTable</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Phân tích What-If</div>
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
                    <button className="ribbon-btn-large" onClick={() => setModal('signature')}>
                      <FileSignature size={20} color="#b91c1c" />
                      <span>Chữ ký số</span>
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
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('normalizeTable')}>
                      <Play size={20} color="#107c41" />
                      <span>Chuẩn hoá Bảng</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('autoNumberStt')}>
                      <Play size={20} color="#0284c7" />
                      <span>Đánh STT 1..N</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('moneyWordsCol')}>
                      <Calculator size={20} color="#d97706" />
                      <span>Đọc chữ VNĐ</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('highlightVariance')}>
                      <Sparkles size={20} color="#7c3aed" />
                      <span>Tô Âm/Dương</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('cleanBlankRows')}>
                      <Trash2 size={20} color="#dc2626" />
                      <span>Xoá dòng trống</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleRunMacro('wrapIfError')}>
                      <ShieldCheck size={20} color="#0f766e" />
                      <span>Bọc IFERROR</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Macro Kế toán 1-chạm ({macroLogs.length} lần chạy)</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('aiAssistant')}>
                      <Bot size={20} color="#4f46e5" />
                      <span>Trợ lý Công thức</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Tự động hoá AI</div>
                </div>
              </>
            )}

            {activeTab === 'minh_pdf' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('pageSetup')}>
                      <Printer size={20} color="#dc2626" />
                      <span>Xuất PDF Vector</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setModal('image')}>
                      <ImageIcon size={20} color="#ea580c" />
                      <span>Kết xuất PNG</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleDownloadPrintHtml(printSettings)}>
                      <FileCheck size={20} color="#0284c7" />
                      <span>Tải bản HTML</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Xuất bản Hồ sơ</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('split')}>
                      <Split size={20} color="#107c41" />
                      <span>Tách từng Sheet</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleOpenMergeModal()}>
                      <Layers size={20} color="#2563eb" />
                      <span>Gộp nhiều File</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Tách & Gộp Bảng tính</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setModal('signature')}>
                      <FileSignature size={20} color="#b91c1c" />
                      <span>Ký tươi & Mộc đỏ</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Xác thực Pháp lý</div>
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
                        const ctx = getActiveContext();
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
            onChange={(e) => setFormulaBarText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                formulaBarFocusedRef.current = false;
                handleCommitFormulaBar();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                formulaBarFocusedRef.current = false;
                syncUiFromSelection();
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      )}

      <div className="sheet-workspace">
        <div
          ref={containerRef}
          className={`sheet-container ${!showFormulaBar ? 'sheet-hide-formula-bar' : ''}`}
        />

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

      <div className="sheet-print-host" dangerouslySetInnerHTML={{ __html: printHostHtml }} />

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
          defaultSigner={printSettings.signedBy ?? 'Bùi Đăng Minh'}
          defaultRole={printSettings.signedRole ?? 'Giám đốc · Công ty Minh Spark'}
          onEmbedSignature={handleEmbedSignature}
          onSignAndSavePdf={handleSignAndSavePdf}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'pageSetup' && (
        <PageSetupPreviewModal
          workbook={liveSnapshotForModal}
          sheet={
            liveSnapshotForModal.sheets[modalActiveSheetId] ??
            liveSnapshotForModal.sheets[liveSnapshotForModal.sheetOrder[0]]
          }
          title={stripSpreadsheetExt(title)}
          activeRangeA1={activeRangeA1}
          settings={printSettings}
          onSaveSettings={(next) => {
            setPrintSettings(next);
            setSavedStatus('saving');
            ui.toast('Đã lưu thiết lập trang in');
          }}
          onPrintNow={handleTriggerVectorPrint}
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
            const ctx = getActiveContext();
            if (!ctx) return;
            ctx.fWorkbook.insertDefinedName(name, ref);
            syncDefinedNames();
            setSavedStatus('saving');
            ui.toast(`Đã thêm tên vùng "${name}"`);
          }}
          onDeleteName={(name) => {
            const ctx = getActiveContext();
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
    </div>
  );
}
