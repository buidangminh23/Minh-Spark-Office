import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { createUniver } from '@univerjs/presets';
import {
  AlertTriangle,
  AreaChart,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarRange,
  Camera,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Compass,
  Eraser,
  Eye,
  EyeOff,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Footprints,
  Globe,
  Highlighter,
  ImagePlus,
  Languages,
  Layers,
  LayoutTemplate,
  LineChart,
  Lock,
  MousePointer2,
  Network,
  PenLine,
  PieChart,
  Play,
  RefreshCw,
  RotateCw,
  Ruler,
  ScatterChart,
  Scissors,
  Shapes,
  SlidersHorizontal,
  Smile,
  SpellCheck2,
  Sparkles,
  SquareStack,
  Tag,
  TrendingUp,
  Type,
  Undo2,
  Unlock,
  View,
  WandSparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import type { ChartKind } from '../doc/insertCharts';
import { downloadBlob, pickFile } from '../../lib/download';
import { PAPER_KEYS, paperLabel, type PaperKey } from '../../lib/paperSizes';
import { MARGIN_PRESETS, type MarginPresetId } from '../../lib/print/printLayout';
import type { CommentItem, SheetCustomView, SheetExcelState, SheetHeaderFooter, SheetPrintSettings, SheetQuery } from '../../lib/storage';
import { formatA1Cell, formatA1Range, parseA1Range } from './sheetUtils';
import {
  CALC_RESULT_MUTATION,
  checkErrors,
  coerceImportedCell,
  parseCsv,
  parseHtmlTables,
  rangesFromIndexes,
  scenarioSummary,
  spellingIssuesForCells,
  zoomToFit,
  type CalcMode,
  type ErrorCheckCell,
  type ErrorCheckIssue,
  type Scenario,
  type SpellingIssue,
} from './excelParity';
import { FUNCTION_CATEGORIES, MORE_CATEGORY_IDS, PRIMARY_CATEGORY_IDS, readRecentFunctions, rememberFunction } from './excelFunctionCatalog';
import {
  ChartGalleryModal,
  ErrorCheckingModal,
  EvaluateFormulaModal,
  ForecastSheetModal,
  HeaderFooterModal,
  ScenarioManagerModal,
  SelectionPaneModal,
  SparklineModal,
  SpellingModal,
  ThesaurusModal,
  TranslateModal,
  renderSparkline,
  type ChartGalleryMode,
  type SelectionPaneItem,
  type SparklineKind,
} from './SheetParityModals';
import {
  CustomViewsModal,
  IconPickerModal,
  InkLayer,
  NavigationModal,
  OfficeScriptsModal,
  QueriesModal,
  SmartArtModal,
  TimelineModal,
  WordArtModal,
  strokesToImage,
  type ImagePayload,
  type InkStroke,
  type InkTool,
  type NavigationEntry,
  type OfficeScript,
} from './SheetParityExtras';

type UniverApi = ReturnType<typeof createUniver>['univerAPI'];
type FWorkbookLike = NonNullable<ReturnType<UniverApi['getActiveWorkbook']>>;
type FWorksheetLike = ReturnType<FWorkbookLike['getActiveSheet']>;
type FRangeLike = ReturnType<FWorksheetLike['getRange']>;
export type ParityContext = { api: UniverApi; fWorkbook: FWorkbookLike; fWorksheet: FWorksheetLike; fRange: FRangeLike };
type GridCell = string | number | boolean;
type ImageHandle = {
  getId: () => string;
  getPlacement?: () => { row?: number; column?: number; angle?: number };
  setFront: () => boolean;
  setForward: () => boolean;
  setBackward: () => boolean;
  setBack: () => boolean;
  setRotate: (angle: number) => boolean;
  remove: () => boolean;
};
type ImageSheet = {
  getImages?: () => ImageHandle[];
  getActiveImages?: () => ImageHandle[];
  getImageById?: (id: string) => ImageHandle | null;
  getScrollState?: () => { sheetViewStartRow: number; sheetViewStartColumn: number; offsetX: number; offsetY: number };
};
type AskField = { name: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea'; value?: string | number; options?: { value: string; label: string }[] };

export type SheetParityHost = {
  initialExcel?: SheetExcelState;
  univerAPIRef: MutableRefObject<UniverApi | null>;
  apiReady: number;
  getActiveContext: () => ParityContext | null;
  getEditableContext: () => ParityContext | null;
  activeRangeA1: string;
  activeCellA1: string;
  activeSheetId: string;
  printSettings: SheetPrintSettings;
  updatePrintSettings: (patch: Partial<SheetPrintSettings>) => void;
  markDirty: () => void;
  syncUi: () => void;
  embedImage: (dataUrl: string, widthPx: number, heightPx: number) => Promise<void>;
  readRangeValues: (rangeA1: string) => unknown[][];
  getSmartRange: () => string;
  writeGridToNewSheet: (baseName: string, grid: (string | number | boolean | null)[][]) => { getSheetName: () => string } | null;
  beginFormula: (text: string, mode: 'replace' | 'append') => void;
  setZoom: (pct: number) => void;
  clearAuditArrows: () => void;
  comments: CommentItem[];
  openComments: () => void;
  openSignature: () => void;
  toast: (text: string, error?: boolean) => void;
  ask: (title: string, fields: AskField[], message?: string) => Promise<Record<string, string | boolean> | null>;
};

type ParityModal =
  | { kind: 'chart'; mode: ChartGalleryMode; initialKind?: ChartKind; range: string }
  | { kind: 'sparkline'; sparkKind: SparklineKind; data: string; location: string }
  | { kind: 'scenarios' }
  | { kind: 'forecast'; range: string }
  | { kind: 'evaluate'; a1: string; formula: string; result: unknown }
  | { kind: 'errors'; issues: ErrorCheckIssue[] }
  | { kind: 'spelling'; issues: SpellingIssue[] }
  | { kind: 'thesaurus'; word: string }
  | { kind: 'translate'; cells: { a1: string; text: string }[] }
  | { kind: 'headerFooter' }
  | { kind: 'selectionPane' }
  | { kind: 'smartArt' }
  | { kind: 'icons' }
  | { kind: 'wordArt' }
  | { kind: 'timeline'; headers: string[]; rows: unknown[][]; startRow: number }
  | { kind: 'queries' }
  | { kind: 'navigation' }
  | { kind: 'customViews' }
  | { kind: 'scripts'; initialId: string | null };

type MenuState = { id: string; left: number; top: number };

const ROW_HEADER_WIDTH = 46;
const COLUMN_HEADER_HEIGHT = 20;
const STRUCTURE_COMMANDS = new Set([
  'sheet.command.insert-sheet',
  'sheet.command.remove-sheet',
  'sheet.command.set-worksheet-name',
  'sheet.command.set-worksheet-order',
  'sheet.command.set-worksheet-hidden',
  'sheet.command.set-worksheet-show',
  'sheet.command.copy-sheet',
]);
const PEN_PRESETS: { id: string; label: string; color: string; alpha: number; width: number }[] = [
  { id: 'black', label: 'Bút đen', color: '#0f172a', alpha: 1, width: 0 },
  { id: 'red', label: 'Bút đỏ', color: '#dc2626', alpha: 1, width: 0 },
  { id: 'blue', label: 'Bút xanh', color: '#2563eb', alpha: 1, width: 0 },
  { id: 'marker', label: 'Bút dạ quang', color: '#facc15', alpha: 0.4, width: 14 },
];
const PEN_WIDTHS = [1, 2, 4, 8];
const RIBBON_PAPERS: PaperKey[] = (['A4', 'A3', 'A5', 'Letter', 'Legal'] as PaperKey[]).filter((key) => PAPER_KEYS.includes(key));
const RIBBON_MARGINS: MarginPresetId[] = ['excelNormal', 'excelWide', 'excelNarrow', 'none'];
const SCROLL_CAP_COLUMNS = 16384;
const SCROLL_CAP_ROWS = 1048576;

const cellString = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const sanitizeName = (text: string) => {
  const cleaned = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9_.]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return '';
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
};
const quoteSheet = (name: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);
const absoluteRange = (sr: number, sc: number, er: number, ec: number) => {
  const abs = (a1: string) => a1.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2');
  return `${abs(formatA1Cell(sr, sc))}:${abs(formatA1Cell(er, ec))}`;
};
function RibbonButton({ icon, label, title, onClick, active, disabled }: { icon: ReactNode; label: string; title?: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; active?: boolean; disabled?: boolean }) {
  return (
    <button className={`ribbon-btn-large${active ? ' active' : ''}`} onClick={onClick} title={title} aria-pressed={active} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CompactButton({ icon, label, title, onClick, active }: { icon?: ReactNode; label: string; title?: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; active?: boolean }) {
  return (
    <button className={`ribbon-btn-compact${active ? ' active' : ''}`} onClick={onClick} title={title} aria-pressed={active}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RibbonSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-section">
      <div className="ribbon-controls">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function useSheetParity(host: SheetParityHost) {
  const hostRef = useRef(host);
  hostRef.current = host;
  const [excel, setExcel] = useState<SheetExcelState>(() => host.initialExcel ?? {});
  const excelRef = useRef(excel);
  excelRef.current = excel;
  const [modal, setModal] = useState<ParityModal | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [inkTool, setInkTool] = useState<InkTool | null>(null);
  const [inkWidth, setInkWidth] = useState(2);
  const [inkBySheet, setInkBySheet] = useState<Record<string, InkStroke[]>>({});
  const [inkHidden, setInkHidden] = useState(false);
  const [headingsHidden, setHeadingsHidden] = useState(false);
  const [recentFunctions, setRecentFunctions] = useState<string[]>(() => readRecentFunctions());
  const forcingRef = useRef(false);
  const calcMode: CalcMode = excel.calcMode ?? 'automatic';
  const structureLocked = Boolean(excel.protection?.structure);

  const patchExcel = useCallback((patch: Partial<SheetExcelState>) => {
    const next = { ...excelRef.current, ...patch };
    excelRef.current = next;
    setExcel(next);
    hostRef.current.markDirty();
  }, []);

  useEffect(() => {
    const api = host.univerAPIRef.current;
    if (!api) return;
    const disposable = api.addEvent(api.Event.BeforeCommandExecute, (event) => {
      const state = excelRef.current;
      if (event.id === CALC_RESULT_MUTATION) {
        if (state.calcMode === 'manual' && !forcingRef.current) event.cancel = true;
        return;
      }
      if (state.protection?.structure && STRUCTURE_COMMANDS.has(event.id)) {
        event.cancel = true;
        hostRef.current.toast('Sổ tính đang khoá cấu trúc: không thể thêm, xoá, đổi tên, ẩn hay di chuyển trang tính. Vào Xem lại → Mở khoá sổ tính.', true);
      }
    });
    return () => disposable.dispose();
  }, [host.univerAPIRef, host.apiReady]);

  const openMenu = (event: React.MouseEvent<HTMLElement>, id: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu((prev) => (prev?.id === id ? null : { id, left: Math.max(8, Math.min(window.innerWidth - 280, rect.left)), top: Math.min(window.innerHeight - 120, rect.bottom + 4) }));
  };

  const recalc = useCallback(async (ctx: ParityContext) => {
    const formula = ctx.api.getFormula();
    forcingRef.current = true;
    try {
      formula.executeCalculation();
      await formula.onCalculationResultApplied(5000).catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    } finally {
      forcingRef.current = false;
    }
  }, []);

  const calculateNow = useCallback(
    async (scope: 'workbook' | 'sheet') => {
      const ctx = hostRef.current.getActiveContext();
      if (!ctx) return;
      await recalc(ctx);
      hostRef.current.syncUi();
      hostRef.current.toast(scope === 'sheet' ? `Đã tính lại trang tính ${ctx.fWorksheet.getSheetName()}` : 'Đã tính lại toàn bộ sổ tính');
    },
    [recalc],
  );

  const setCalcMode = (mode: CalcMode) => {
    patchExcel({ calcMode: mode });
    setMenu(null);
    if (mode === 'automatic') void calculateNow('workbook');
    hostRef.current.toast(mode === 'manual' ? 'Đã chuyển sang tính thủ công: bấm Tính ngay (F9) để cập nhật kết quả' : 'Đã chuyển sang tính tự động');
  };

  useEffect(() => {
    if (calcMode !== 'manual') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F9') return;
      event.preventDefault();
      void calculateNow(event.shiftKey ? 'sheet' : 'workbook');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [calcMode, calculateNow]);

  const usedCells = (ctx: ParityContext): ErrorCheckCell[] => {
    const lastRow = ctx.fWorksheet.getLastRow();
    const lastColumn = ctx.fWorksheet.getLastColumn();
    if (lastRow < 0 || lastColumn < 0) return [];
    const range = ctx.fWorksheet.getRange(0, 0, lastRow + 1, lastColumn + 1);
    const values = range.getRawValues();
    const formulas = range.getFormulas();
    const cells: ErrorCheckCell[] = [];
    values.forEach((row, r) =>
      row.forEach((value, c) => {
        const formula = formulas[r]?.[c] || null;
        if ((value === null || value === undefined || value === '') && !formula) return;
        cells.push({ row: r, column: c, a1: formatA1Cell(r, c), value, formula });
      }),
    );
    return cells;
  };

  const goToCell = (row: number, column: number, rows = 1, columns = 1) => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    ctx.fWorksheet.getRange(row, column, rows, columns).activate();
    hostRef.current.syncUi();
  };

  const openErrorChecking = () => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const issues = checkErrors(usedCells(ctx));
    if (!issues.length) {
      hostRef.current.toast('Đã kiểm tra lỗi toàn trang tính: không có lỗi nào.');
      return;
    }
    setModal({ kind: 'errors', issues });
  };

  const openEvaluate = (a1?: string) => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const parsed = parseA1Range(a1 ?? hostRef.current.activeCellA1);
    if (!parsed) return;
    const cell = ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, 1, 1);
    const formula = cell.getFormula();
    if (!formula) {
      hostRef.current.toast('Ô đang chọn không chứa công thức để đánh giá', true);
      return;
    }
    setModal({ kind: 'evaluate', a1: formatA1Cell(parsed.startRow, parsed.startColumn), formula, result: cell.getRawValue() });
  };

  const resolveRef = (ref: string): unknown => {
    const values = hostRef.current.readRangeValues(ref.replace(/\$/g, ''));
    if (values.length === 1 && values[0].length === 1) return values[0][0];
    return values;
  };

  const openSpelling = () => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    const single = raw.startRow === raw.endRow && raw.startColumn === raw.endColumn;
    const all = usedCells(ctx);
    const source = single ? all : all.filter((cell) => cell.row >= raw.startRow && cell.row <= raw.endRow && cell.column >= raw.startColumn && cell.column <= raw.endColumn);
    const issues = spellingIssuesForCells(source.filter((cell) => !cell.formula && typeof cell.value === 'string').map((cell) => ({ a1: cell.a1, row: cell.row, column: cell.column, text: String(cell.value) })));
    if (!issues.length) {
      hostRef.current.toast('Kiểm tra chính tả hoàn tất: không thấy lỗi nào.');
      return;
    }
    setModal({ kind: 'spelling', issues });
  };

  const applySpelling = (issue: SpellingIssue, all: boolean) => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx || issue.suggestion === null || modal?.kind !== 'spelling') return;
    const targets = all ? modal.issues.filter((item) => item.text === issue.text && item.suggestion === issue.suggestion) : [issue];
    for (const target of targets) {
      const cell = ctx.fWorksheet.getRange(target.row, target.column, 1, 1);
      const current = cellString(cell.getRawValue());
      cell.setValue(current.split(target.text).join(target.suggestion ?? target.text));
    }
    hostRef.current.markDirty();
    const fixed = new Set(targets);
    setModal({ kind: 'spelling', issues: modal.issues.filter((item) => !fixed.has(item)) });
  };

  const spellingRef = useRef(openSpelling);
  spellingRef.current = openSpelling;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F7' || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      spellingRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const selectedTextCells = (ctx: ParityContext) => {
    const raw = ctx.fRange.getRange();
    const cells: { a1: string; text: string }[] = [];
    ctx.fRange.getRawValues().forEach((row, r) =>
      row.forEach((value, c) => {
        if (typeof value === 'string' && value.trim()) cells.push({ a1: formatA1Cell(raw.startRow + r, raw.startColumn + c), text: value });
      }),
    );
    return cells;
  };

  const writeTranslations = (results: { a1: string; text: string }[], mode: 'replace' | 'right') => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    const width = raw.endColumn - raw.startColumn + 1;
    for (const result of results) {
      const parsed = parseA1Range(result.a1);
      if (parsed) ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn + (mode === 'right' ? width : 0), 1, 1).setValue(result.text);
    }
    hostRef.current.markDirty();
    hostRef.current.toast(`Đã ghi ${results.length} bản dịch`);
  };

  const anchorAt = (ctx: ParityContext, x: number, y: number, zoom: number) => {
    const scroll = (ctx.fWorksheet as unknown as ImageSheet).getScrollState?.();
    let column = scroll?.sheetViewStartColumn ?? 0;
    let row = scroll?.sheetViewStartRow ?? 0;
    let restX = Math.max(0, x / zoom - ROW_HEADER_WIDTH) + (scroll?.offsetX ?? 0);
    let restY = Math.max(0, y / zoom - COLUMN_HEADER_HEIGHT) + (scroll?.offsetY ?? 0);
    while (column < SCROLL_CAP_COLUMNS && restX > ctx.fWorksheet.getColumnWidth(column)) restX -= ctx.fWorksheet.getColumnWidth(column++);
    while (row < SCROLL_CAP_ROWS && restY > ctx.fWorksheet.getRowHeight(row)) restY -= ctx.fWorksheet.getRowHeight(row++);
    return { row, column, rowOffset: restY, columnOffset: restX };
  };

  const activeStrokes = inkBySheet[host.activeSheetId] ?? [];
  const setActiveStrokes = (next: InkStroke[]) => setInkBySheet((prev) => ({ ...prev, [hostRef.current.activeSheetId]: next }));

  const commitInk = async () => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const image = strokesToImage(activeStrokes);
    if (!image) {
      hostRef.current.toast('Chưa có nét vẽ nào để chèn', true);
      return;
    }
    const zoom = ctx.fWorksheet.getZoom() || 1;
    const anchor = anchorAt(ctx, image.left, image.top, zoom);
    const built = await ctx.fWorksheet
      .newOverGridImage()
      .setSource(image.url)
      .setRow(anchor.row)
      .setColumn(anchor.column)
      .setRowOffset(anchor.rowOffset)
      .setColumnOffset(anchor.columnOffset)
      .setWidth(image.width / zoom)
      .setHeight(image.height / zoom)
      .buildAsync();
    ctx.fWorksheet.insertImages([built]);
    setActiveStrokes([]);
    setInkTool(null);
    hostRef.current.markDirty();
    hostRef.current.toast('Đã gắn nét vẽ vào trang tính thành hình ảnh: có thể kéo, đổi cỡ hoặc xoá như ảnh');
  };

  const pickPen = (preset: (typeof PEN_PRESETS)[number]) => {
    setInkHidden(false);
    setInkTool({ kind: 'pen', color: preset.color, alpha: preset.alpha, width: preset.width || inkWidth });
  };

  const insertImagePayload = async (image: ImagePayload) => {
    await hostRef.current.embedImage(image.url, image.width, image.height);
    hostRef.current.toast('Đã chèn vào trang tính');
  };

  const captureScreenshot = async () => {
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (!media?.getDisplayMedia) {
      hostRef.current.toast('Ứng dụng này không cho phép chụp màn hình', true);
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await media.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const scale = Math.min(1, 640 / Math.max(1, canvas.width));
      await hostRef.current.embedImage(canvas.toDataURL('image/png'), Math.round(canvas.width * scale), Math.round(canvas.height * scale));
      hostRef.current.toast('Đã chèn ảnh chụp màn hình');
    } catch {
      hostRef.current.toast('Đã huỷ chụp màn hình', true);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const insertSparklines = async (kind: SparklineKind, dataRange: string, location: string, color: string): Promise<string> => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return 'Bảng tính đang khoá';
    const place = parseA1Range(location);
    if (!parseA1Range(dataRange) || !place) return 'Địa chỉ vùng không hợp lệ';
    const values = hostRef.current.readRangeValues(dataRange);
    const rows = place.endRow - place.startRow + 1;
    const columns = place.endColumn - place.startColumn + 1;
    const horizontal = columns > 1 && rows === 1;
    const series = horizontal ? (values[0] ?? []).map((_, c) => values.map((row) => row[c])) : values;
    const count = Math.min(series.length, horizontal ? columns : rows);
    let made = 0;
    for (let i = 0; i < count; i++) {
      const numbers = series[i].filter((value) => value !== null && value !== '').map(Number).filter(Number.isFinite);
      if (!numbers.length) continue;
      const row = horizontal ? place.startRow : place.startRow + i;
      const column = horizontal ? place.startColumn + i : place.startColumn;
      const width = Math.max(24, ctx.fWorksheet.getColumnWidth(column) - 4);
      const height = Math.max(12, ctx.fWorksheet.getRowHeight(row) - 4);
      const built = await ctx.fWorksheet
        .newOverGridImage()
        .setSource(renderSparkline(numbers, kind, color, width, height))
        .setRow(row)
        .setColumn(column)
        .setRowOffset(2)
        .setColumnOffset(2)
        .setWidth(width)
        .setHeight(height)
        .buildAsync();
      ctx.fWorksheet.insertImages([built]);
      made++;
    }
    hostRef.current.markDirty();
    return made ? `Đã tạo ${made} sparkline` : 'Vùng dữ liệu chưa có số';
  };

  const selectionOrSmartRange = () => (hostRef.current.activeRangeA1.includes(':') ? hostRef.current.activeRangeA1 : hostRef.current.getSmartRange());

  const openSparkline = (sparkKind: SparklineKind) => {
    const data = selectionOrSmartRange();
    const parsed = parseA1Range(data);
    if (!parsed) return;
    const firstNumericColumn = (() => {
      const values = hostRef.current.readRangeValues(data);
      const width = values[0]?.length ?? 1;
      for (let c = 0; c < width; c++) if (values.slice(1).some((row) => typeof row[c] === 'number')) return c;
      return 0;
    })();
    const headerRows = typeof hostRef.current.readRangeValues(data)[0]?.[firstNumericColumn] === 'number' ? 0 : 1;
    const startRow = parsed.startRow + headerRows;
    const sourceA1 = formatA1Range(startRow, parsed.startColumn + firstNumericColumn, parsed.endRow, parsed.endColumn);
    const location = formatA1Range(startRow, parsed.endColumn + 1, parsed.endRow, parsed.endColumn + 1);
    setModal({ kind: 'sparkline', sparkKind, data: sourceA1, location });
  };

  const openChart = (mode: ChartGalleryMode, initialKind?: ChartKind) => setModal({ kind: 'chart', mode, initialKind, range: selectionOrSmartRange() });

  const openTimeline = () => {
    const range = selectionOrSmartRange();
    const parsed = parseA1Range(range);
    const values = hostRef.current.readRangeValues(range);
    if (!parsed || values.length < 2) {
      hostRef.current.toast('Hãy chọn bảng dữ liệu có dòng tiêu đề và cột ngày', true);
      return;
    }
    setModal({ kind: 'timeline', headers: values[0].map((cell, i) => cellString(cell) || `Cột ${i + 1}`), rows: values.slice(1), startRow: parsed.startRow + 1 });
  };

  const applyTimeline = (visible: number[] | null, caption: string) => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx || modal?.kind !== 'timeline') return;
    const total = modal.rows.length;
    ctx.fWorksheet.showRows(modal.startRow, total);
    if (visible) {
      const shown = new Set(visible);
      const hidden = Array.from({ length: total }, (_, i) => i).filter((i) => !shown.has(i));
      for (const run of rangesFromIndexes(hidden)) ctx.fWorksheet.hideRows(modal.startRow + run.start, run.count);
    }
    hostRef.current.markDirty();
    hostRef.current.toast(`Timeline: ${caption}`);
  };

  const embedChart = async (png: string, _title: string, width: number, height: number) => {
    await hostRef.current.embedImage(png, width, height);
    hostRef.current.toast('Đã chèn biểu đồ vào trang tính');
  };

  const downloadChart = (png: string, title: string) => {
    void fetch(png)
      .then((res) => res.blob())
      .then((blob) => downloadBlob(blob, `${sanitizeName(title) || 'bieu-do'}.png`));
  };

  const insertFunction = (name: string) => {
    setMenu(null);
    setRecentFunctions(rememberFunction(name));
    hostRef.current.beginFormula(`=${name}(`, 'replace');
  };

  const insertNameInFormula = (name: string) => {
    setMenu(null);
    hostRef.current.beginFormula(name, 'append');
  };

  const definedNameList = () => {
    const ctx = hostRef.current.getActiveContext();
    return ctx ? ctx.fWorkbook.getDefinedNames().map((item) => ({ name: item.getName(), ref: item.getFormulaOrRefString() })) : [];
  };

  const createNamesFromSelection = async () => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    if (raw.endRow <= raw.startRow && raw.endColumn <= raw.startColumn) {
      hostRef.current.toast('Hãy chọn bảng gồm dòng tiêu đề và dữ liệu bên dưới', true);
      return;
    }
    const answer = await hostRef.current.ask('Tạo tên từ vùng chọn', [
      {
        name: 'from',
        label: 'Lấy tên từ',
        type: 'select',
        value: 'top',
        options: [
          { value: 'top', label: 'Dòng trên cùng' },
          { value: 'left', label: 'Cột bên trái' },
        ],
      },
    ]);
    if (!answer) return;
    const values = ctx.fRange.getRawValues();
    const sheet = quoteSheet(ctx.fWorksheet.getSheetName());
    const existing = new Set(ctx.fWorkbook.getDefinedNames().map((item) => item.getName().toLowerCase()));
    let made = 0;
    const define = (label: unknown, ref: string) => {
      const name = sanitizeName(cellString(label));
      if (!name || existing.has(name.toLowerCase())) return;
      ctx.fWorkbook.insertDefinedName(name, `${sheet}!${ref}`);
      existing.add(name.toLowerCase());
      made++;
    };
    if (answer.from === 'top') values[0].forEach((label, c) => define(label, absoluteRange(raw.startRow + 1, raw.startColumn + c, raw.endRow, raw.startColumn + c)));
    else values.forEach((row, r) => define(row[0], absoluteRange(raw.startRow + r, raw.startColumn + 1, raw.startRow + r, raw.endColumn)));
    hostRef.current.markDirty();
    hostRef.current.toast(made ? `Đã tạo ${made} tên vùng` : 'Không tạo được tên mới (nhãn trống hoặc trùng tên đã có)', !made);
  };

  const importedGrid = (grid: string[][]) => grid.map((row, r) => row.map((cell) => (r === 0 ? cell : coerceImportedCell(cell))));

  const writeQueryGrid = (ctx: ParityContext, sheetName: string, grid: string[][]) => {
    const sheet = ctx.fWorkbook.getSheetByName(sheetName);
    if (!sheet) return false;
    const width = Math.max(...grid.map((row) => row.length));
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow >= 0 && lastColumn >= 0) sheet.getRange(0, 0, lastRow + 1, lastColumn + 1).clear();
    const normalized = importedGrid(grid).map((row) => Array.from({ length: width }, (_, c) => row[c] ?? ''));
    sheet.getRange(0, 0, normalized.length, width).setValues(normalized as GridCell[][]);
    sheet.getRange(0, 0, 1, width).setFontWeight('bold');
    return true;
  };

  const fetchTables = async (url: string): Promise<string[][][]> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const type = response.headers.get('content-type') ?? '';
    if (/csv|text\/plain/.test(type) || /\.csv(\?|$)/i.test(url)) return [parseCsv(text)];
    return parseHtmlTables(text);
  };

  const addQuery = (query: SheetQuery) => patchExcel({ queries: [...(excelRef.current.queries ?? []), query] });

  const importFromWeb = async () => {
    const answer = await hostRef.current.ask('Lấy dữ liệu từ Web', [{ name: 'url', label: 'Địa chỉ trang có bảng hoặc tệp CSV', value: 'https://' }]);
    const url = typeof answer?.url === 'string' ? answer.url.trim() : '';
    if (!/^https?:\/\/.+/i.test(url)) return;
    let tables: string[][][];
    try {
      tables = await fetchTables(url);
    } catch (error) {
      hostRef.current.toast(`Không tải được trang: máy chủ chặn truy cập từ ứng dụng khác hoặc mất mạng. Có thể tải tệp CSV về rồi dùng Từ văn bản/CSV. (${(error as Error).message})`, true);
      return;
    }
    if (!tables.length) {
      hostRef.current.toast('Trang này không có bảng dữ liệu nào', true);
      return;
    }
    let index = 0;
    if (tables.length > 1) {
      const pick = await hostRef.current.ask('Chọn bảng cần nhập', [
        { name: 'table', label: `Trang có ${tables.length} bảng`, type: 'select', value: '0', options: tables.map((table, i) => ({ value: String(i), label: `Bảng ${i + 1}: ${table.length} dòng · ${table[0].slice(0, 3).join(', ')}` })) },
      ]);
      if (!pick) return;
      index = Number(pick.table) || 0;
    }
    const grid = tables[index];
    const sheet = hostRef.current.writeGridToNewSheet(`Web ${index + 1}`, importedGrid(grid));
    if (!sheet) return;
    addQuery({ id: crypto.randomUUID(), name: new URL(url).hostname, kind: 'web', source: url, tableIndex: index, sheetName: sheet.getSheetName(), refreshedAt: Date.now() });
    hostRef.current.toast(`Đã nhập ${grid.length} dòng vào trang ${sheet.getSheetName()}. Làm mới ở Truy vấn & Kết nối.`);
  };

  const importFromCsv = async () => {
    const file = await pickFile('.csv,.tsv,.txt,text/csv,text/plain');
    if (!file) return;
    const grid = parseCsv(await file.text());
    if (!grid.length) {
      hostRef.current.toast('Tệp không có dữ liệu', true);
      return;
    }
    const sheet = hostRef.current.writeGridToNewSheet(file.name.replace(/\.[^.]+$/, ''), importedGrid(grid));
    if (!sheet) return;
    addQuery({ id: crypto.randomUUID(), name: file.name, kind: 'csv', source: file.name, tableIndex: 0, sheetName: sheet.getSheetName(), refreshedAt: Date.now() });
    hostRef.current.toast(`Đã nhập ${grid.length} dòng từ ${file.name}`);
  };

  const refreshQuery = async (query: SheetQuery) => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx || query.kind !== 'web') return;
    try {
      const tables = await fetchTables(query.source);
      const grid = tables[query.tableIndex] ?? tables[0];
      if (!grid || !writeQueryGrid(ctx, query.sheetName, grid)) throw new Error(`không thấy trang ${query.sheetName}`);
      patchExcel({ queries: (excelRef.current.queries ?? []).map((item) => (item.id === query.id ? { ...item, refreshedAt: Date.now() } : item)) });
      hostRef.current.toast(`Đã làm mới ${query.name}`);
    } catch (error) {
      hostRef.current.toast(`Làm mới ${query.name} thất bại: ${(error as Error).message}`, true);
    }
  };

  const refreshAll = async () => {
    for (const query of (excelRef.current.queries ?? []).filter((item) => item.kind === 'web')) await refreshQuery(query);
    await calculateNow('workbook');
  };

  const writeScenarioCells = (ctx: ParityContext, scenario: Scenario) => {
    for (const cell of scenario.cells) {
      const parsed = parseA1Range(cell.a1);
      if (parsed) ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, 1, 1).setValue(coerceImportedCell(cell.value));
    }
  };

  const showScenario = (scenario: Scenario) => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    writeScenarioCells(ctx, scenario);
    hostRef.current.markDirty();
    hostRef.current.toast(`Đang hiện kịch bản: ${scenario.name}`);
  };

  const summarizeScenarios = async (resultCells: string[]) => {
    const ctx = hostRef.current.getEditableContext();
    const scenarios = excelRef.current.scenarios ?? [];
    if (!ctx || !scenarios.length) return;
    const changing = [...new Set(scenarios.flatMap((scenario) => scenario.cells.map((cell) => cell.a1)))];
    const original = changing.map((a1) => {
      const parsed = parseA1Range(a1);
      const cell = parsed ? ctx.fWorksheet.getRange(parsed.startRow, parsed.startColumn, 1, 1) : null;
      return { cell, formula: cell?.getFormula() || null, value: cell?.getRawValue() ?? null };
    });
    const computed = new Map<string, Record<string, unknown>>();
    for (const scenario of scenarios) {
      writeScenarioCells(ctx, scenario);
      await recalc(ctx);
      computed.set(scenario.id, Object.fromEntries(resultCells.map((a1) => [a1, resolveRef(a1)])));
    }
    for (const item of original) item.cell?.setValue((item.formula ?? item.value ?? '') as GridCell);
    await recalc(ctx);
    const grid = scenarioSummary(scenarios, resultCells, (scenario) => computed.get(scenario.id) ?? {});
    hostRef.current.writeGridToNewSheet('Tóm tắt kịch bản', grid.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : (cell as GridCell)))));
    hostRef.current.toast(`Đã lập bảng tóm tắt ${scenarios.length} kịch bản`);
  };

  const createForecast = async ({ range, periods, confidence, seasonality }: { range: string; periods: number; confidence: number; seasonality: number }): Promise<string> => {
    const values = hostRef.current.readRangeValues(range);
    if (values.length < 4 || (values[0]?.length ?? 0) < 2) return 'Cần ít nhất 3 dòng dữ liệu có 2 cột: thời gian và giá trị';
    const [header, ...body] = values;
    const rows = body.filter((row) => row[0] !== null && row[0] !== '' && row[1] !== null && row[1] !== '' && Number.isFinite(Number(row[1])));
    if (rows.length < 3) return 'Cột giá trị cần ít nhất 3 số';
    const times = rows.map((row) => Number(row[0]));
    const numericTime = times.every((t) => Number.isFinite(t));
    const step = numericTime ? (times[times.length - 1] - times[0]) / Math.max(1, times.length - 1) : 1;
    const n = rows.length;
    const grid: (string | number)[][] = [[cellString(header[0]) || 'Thời gian', cellString(header[1]) || 'Giá trị', 'Dự báo', 'Cận dưới', 'Cận trên']];
    rows.forEach((row, i) => grid.push([numericTime ? Number(row[0]) : i + 1, Number(row[1]), '', '', '']));
    const timeRef = `$A$2:$A$${n + 1}`;
    const valueRef = `$B$2:$B$${n + 1}`;
    for (let i = 0; i < periods; i++) {
      const rowNumber = n + 2 + i;
      const t = numericTime ? Math.round((times[times.length - 1] + step * (i + 1)) * 1e6) / 1e6 : n + i + 1;
      const forecast = `FORECAST.ETS(A${rowNumber},${valueRef},${timeRef},${seasonality})`;
      const band = `FORECAST.ETS.CONFINT(A${rowNumber},${valueRef},${timeRef},${confidence},${seasonality})`;
      grid.push([t, '', `=${forecast}`, `=C${rowNumber}-${band}`, `=C${rowNumber}+${band}`]);
    }
    grid[n][2] = `=B${n + 1}`;
    grid[n][3] = `=B${n + 1}`;
    grid[n][4] = `=B${n + 1}`;
    const sheet = hostRef.current.writeGridToNewSheet('Dự báo', grid);
    if (!sheet) return 'Bảng tính đang khoá';
    const ctx = hostRef.current.getActiveContext();
    if (ctx) await recalc(ctx);
    return `Đã tạo trang ${sheet.getSheetName()} với ${periods} kỳ dự báo, khoảng tin cậy ${Math.round(confidence * 100)}%`;
  };

  const sheetImages = (ctx: ParityContext) => (ctx.fWorksheet as unknown as ImageSheet).getImages?.() ?? [];

  const arrangeSelected = (where: 'front' | 'forward' | 'backward' | 'back') => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const selected = (ctx.fWorksheet as unknown as ImageSheet).getActiveImages?.() ?? [];
    if (!selected.length) {
      hostRef.current.toast('Hãy bấm chọn một ảnh, biểu đồ hoặc nét vẽ trên trang tính trước', true);
      return;
    }
    for (const image of selected) {
      if (where === 'front') image.setFront();
      else if (where === 'forward') image.setForward();
      else if (where === 'backward') image.setBackward();
      else image.setBack();
    }
    hostRef.current.markDirty();
  };

  const rotateSelected = () => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const selected = (ctx.fWorksheet as unknown as ImageSheet).getActiveImages?.() ?? [];
    if (!selected.length) {
      hostRef.current.toast('Hãy bấm chọn một ảnh trước khi xoay', true);
      return;
    }
    for (const image of selected) image.setRotate(((image.getPlacement?.()?.angle ?? 0) + 90) % 360);
    hostRef.current.markDirty();
  };

  const selectionPaneItems = (): SelectionPaneItem[] => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return [];
    return sheetImages(ctx)
      .map((image, i) => {
        const placement = image.getPlacement?.();
        const at = placement && typeof placement.row === 'number' && typeof placement.column === 'number' ? formatA1Cell(placement.row, placement.column) : '';
        return { id: image.getId(), label: `Đối tượng ${i + 1}`, kind: at ? `Ảnh tại ${at}` : 'Ảnh' };
      })
      .reverse();
  };

  const withImage = (id: string, run: (image: ImageHandle) => void) => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return;
    const image = (ctx.fWorksheet as unknown as ImageSheet).getImageById?.(id);
    if (!image) return;
    run(image);
    hostRef.current.markDirty();
    setModal({ kind: 'selectionPane' });
  };

  const toggleHeadings = () => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const hide = !headingsHidden;
    ctx.fWorksheet.setRowHeaderWidth(hide ? 0 : ROW_HEADER_WIDTH);
    ctx.fWorksheet.setColumnHeaderHeight(hide ? 0 : COLUMN_HEADER_HEIGHT);
    setHeadingsHidden(hide);
    hostRef.current.markDirty();
  };

  const zoomToSelection = () => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const raw = ctx.fRange.getRange();
    let width = 0;
    let height = 0;
    for (let c = raw.startColumn; c <= raw.endColumn; c++) width += ctx.fWorksheet.getColumnWidth(c);
    for (let r = raw.startRow; r <= raw.endRow; r++) height += ctx.fWorksheet.getRowHeight(r);
    const container = document.querySelector('.sheet-container') as HTMLElement | null;
    const viewport = { width: (container?.clientWidth ?? 900) - ROW_HEADER_WIDTH - 24, height: (container?.clientHeight ?? 500) - COLUMN_HEADER_HEIGHT - 48 };
    hostRef.current.setZoom(zoomToFit({ width, height }, viewport));
    ctx.fWorksheet.getRange(raw.startRow, raw.startColumn, raw.endRow - raw.startRow + 1, raw.endColumn - raw.startColumn + 1).activate();
  };

  const currentView = (name: string): SheetCustomView | null => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return null;
    const model = ctx.fWorksheet.getSheet();
    const lastRow = Math.max(0, ctx.fWorksheet.getLastRow());
    const lastColumn = Math.max(0, ctx.fWorksheet.getLastColumn());
    const hiddenRows: number[] = [];
    const hiddenColumns: number[] = [];
    for (let r = 0; r <= lastRow + 50; r++) if (!model.getRowVisible(r)) hiddenRows.push(r);
    for (let c = 0; c <= lastColumn + 10; c++) if (!model.getColVisible(c)) hiddenColumns.push(c);
    return {
      id: crypto.randomUUID(),
      name,
      sheetId: ctx.fWorksheet.getSheetId(),
      zoom: Math.round((ctx.fWorksheet.getZoom() || 1) * 100),
      frozenRows: ctx.fWorksheet.getFrozenRows(),
      frozenColumns: ctx.fWorksheet.getFrozenColumns(),
      hiddenRows,
      hiddenColumns,
      selection: hostRef.current.activeRangeA1,
      showGridlines: !ctx.fWorksheet.hasHiddenGridLines(),
    };
  };

  const showView = (view: SheetCustomView) => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return;
    const sheet = ctx.fWorkbook.getSheetBySheetId(view.sheetId);
    if (!sheet) {
      hostRef.current.toast('Trang tính của chế độ xem này đã bị xoá', true);
      return;
    }
    ctx.fWorkbook.setActiveSheet(sheet);
    const lastRow = Math.max(sheet.getLastRow(), ...view.hiddenRows, 0);
    const lastColumn = Math.max(sheet.getLastColumn(), ...view.hiddenColumns, 0);
    sheet.showRows(0, lastRow + 51);
    sheet.showColumns(0, lastColumn + 11);
    for (const run of rangesFromIndexes(view.hiddenRows)) sheet.hideRows(run.start, run.count);
    for (const run of rangesFromIndexes(view.hiddenColumns)) sheet.hideColumns(run.start, run.count);
    sheet.setFrozenRows(view.frozenRows);
    sheet.setFrozenColumns(view.frozenColumns);
    sheet.setHiddenGridlines(!view.showGridlines);
    const parsed = parseA1Range(view.selection);
    if (parsed) sheet.getRange(parsed.startRow, parsed.startColumn, parsed.endRow - parsed.startRow + 1, parsed.endColumn - parsed.startColumn + 1).activate();
    hostRef.current.setZoom(view.zoom);
    hostRef.current.syncUi();
    hostRef.current.markDirty();
    hostRef.current.toast(`Đã chuyển sang chế độ xem ${view.name}`);
  };

  const navigationEntries = (): NavigationEntry[] => {
    const ctx = hostRef.current.getActiveContext();
    if (!ctx) return [];
    const entries: NavigationEntry[] = ctx.fWorkbook.getSheets().map((sheet) => ({
      id: `sheet-${sheet.getSheetId()}`,
      group: 'Trang tính',
      label: sheet.getSheetName(),
      detail: sheet.isSheetHidden() ? 'đang ẩn' : `${sheet.getLastRow() + 1} dòng`,
      go: () => {
        ctx.fWorkbook.setActiveSheet(sheet);
        hostRef.current.syncUi();
      },
    }));
    for (const item of definedNameList()) {
      entries.push({
        id: `name-${item.name}`,
        group: 'Vùng đã đặt tên',
        label: item.name,
        detail: item.ref,
        go: () => {
          const match = item.ref.match(/^(?:'?([^'!]+)'?!)?(.+)$/);
          const sheet = match?.[1] ? ctx.fWorkbook.getSheetByName(match[1]) : ctx.fWorksheet;
          const parsed = parseA1Range((match?.[2] ?? '').replace(/\$/g, ''));
          if (!sheet || !parsed) return;
          ctx.fWorkbook.setActiveSheet(sheet);
          sheet.getRange(parsed.startRow, parsed.startColumn, parsed.endRow - parsed.startRow + 1, parsed.endColumn - parsed.startColumn + 1).activate();
          hostRef.current.syncUi();
        },
      });
    }
    sheetImages(ctx).forEach((image, i) => {
      const placement = image.getPlacement?.();
      if (!placement || typeof placement.row !== 'number' || typeof placement.column !== 'number') return;
      const { row, column } = placement;
      entries.push({ id: `image-${image.getId()}`, group: 'Đối tượng trên trang này', label: `Đối tượng ${i + 1}`, detail: formatA1Cell(row, column), go: () => goToCell(row, column) });
    });
    return entries;
  };

  const stepComment = (direction: 1 | -1) => {
    const list = hostRef.current.comments
      .map((comment) => ({ comment, parsed: parseA1Range(comment.quote ?? '') }))
      .flatMap((item) => (item.parsed ? [{ comment: item.comment, parsed: item.parsed }] : []))
      .sort((a, b) => a.parsed.startRow - b.parsed.startRow || a.parsed.startColumn - b.parsed.startColumn);
    if (!list.length) {
      hostRef.current.toast('Trang tính chưa có thảo luận nào', true);
      return;
    }
    const current = parseA1Range(hostRef.current.activeCellA1);
    const key = (p: { startRow: number; startColumn: number }) => p.startRow * SCROLL_CAP_COLUMNS + p.startColumn;
    const here = current ? key(current) : -1;
    const next = direction === 1 ? list.find((item) => key(item.parsed) > here) ?? list[0] : [...list].reverse().find((item) => key(item.parsed) < here) ?? list[list.length - 1];
    goToCell(next.parsed.startRow, next.parsed.startColumn, next.parsed.endRow - next.parsed.startRow + 1, next.parsed.endColumn - next.parsed.startColumn + 1);
    hostRef.current.openComments();
    hostRef.current.toast(`Thảo luận tại ${next.comment.quote}: ${next.comment.text.slice(0, 80)}`);
  };

  const toggleStructureLock = async () => {
    if (structureLocked) {
      patchExcel({ protection: { ...excelRef.current.protection, structure: undefined } });
      hostRef.current.toast('Đã mở khoá cấu trúc sổ tính');
      return;
    }
    const ok = await hostRef.current.ask('Bảo vệ cấu trúc sổ tính', [], 'Khi bật, không ai thêm, xoá, đổi tên, ẩn hay di chuyển được trang tính cho tới khi mở khoá. Nội dung ô vẫn sửa được.');
    if (!ok) return;
    patchExcel({ protection: { ...excelRef.current.protection, structure: {} } });
    hostRef.current.toast('Đã khoá cấu trúc sổ tính');
  };

  const runScript = async (code: string): Promise<string[]> => {
    const ctx = hostRef.current.getEditableContext();
    if (!ctx) return ['Bảng tính đang khoá'];
    const output: string[] = [];
    const log = (...parts: unknown[]) => output.push(parts.map((part) => (typeof part === 'object' ? JSON.stringify(part) : String(part))).join(' '));
    try {
      const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
      const result = await new AsyncFunction('workbook', 'sheet', 'range', 'log', code)(ctx.fWorkbook, ctx.fWorksheet, ctx.fRange, log);
      if (result !== undefined) log('Kết quả:', result);
      hostRef.current.markDirty();
      hostRef.current.syncUi();
    } catch (error) {
      output.push(`Lỗi: ${(error as Error).message}`);
    }
    return output.length ? output : ['Đã chạy xong'];
  };

  const askPrintTitles = async () => {
    const answer = await hostRef.current.ask('In tiêu đề', [{ name: 'rows', label: 'Số dòng đầu lặp lại trên mỗi trang in', type: 'number', value: hostRef.current.printSettings.printTitleRows ?? 1 }]);
    if (!answer) return;
    const rows = Math.max(0, Math.min(50, Math.floor(Number(answer.rows) || 0)));
    hostRef.current.updatePrintSettings({ printTitleRows: rows });
    hostRef.current.toast(rows ? `Đã đặt lặp ${rows} dòng tiêu đề trên mỗi trang in` : 'Đã bỏ lặp dòng tiêu đề');
  };

  const askScale = async () => {
    const answer = await hostRef.current.ask('Tỉ lệ in', [{ name: 'scale', label: 'Phần trăm (10–400)', type: 'number', value: Math.round((hostRef.current.printSettings.customScale ?? 1) * 100) }]);
    if (!answer) return;
    const pct = Math.max(10, Math.min(400, Number(answer.scale) || 100));
    hostRef.current.updatePrintSettings({ scaleMode: 'custom', customScale: pct / 100 });
    hostRef.current.toast(`Đã đặt tỉ lệ in ${pct}%`);
  };

  const setScaleMode = (mode: NonNullable<SheetPrintSettings['scaleMode']>, label: string) => {
    hostRef.current.updatePrintSettings({ scaleMode: mode });
    hostRef.current.toast(label);
  };

  const saveHeaderFooter = (header: SheetHeaderFooter, footer: SheetHeaderFooter) => {
    hostRef.current.updatePrintSettings({ header, footer });
    hostRef.current.toast('Đã lưu đầu trang và chân trang cho bản in');
  };

  const scripts: OfficeScript[] = excel.officeScripts ?? [];
  const ps = host.printSettings;
  const scaleMode = ps.scaleMode ?? 'auto';
  const currentPen = inkTool?.kind === 'pen' ? inkTool : null;

  const chartSection = (
    <RibbonSection label="Biểu đồ">
      <RibbonButton icon={<Sparkles size={20} color="#107c41" />} label="Biểu đồ đề xuất" title="Gợi ý loại biểu đồ hợp với dữ liệu đang chọn" onClick={() => openChart('recommended')} />
      <RibbonButton icon={<BarChart3 size={20} color="#107c41" />} label="Cột" onClick={() => openChart('all', 'column')} />
      <RibbonButton icon={<LineChart size={20} color="#2563eb" />} label="Đường" onClick={() => openChart('all', 'line')} />
      <RibbonButton icon={<PieChart size={20} color="#d97706" />} label="Tròn" onClick={() => openChart('all', 'pie')} />
      <div className="ribbon-two-rows">
        <CompactButton icon={<BarChart3 size={13} style={{ transform: 'rotate(90deg)' }} />} label="Thanh" onClick={() => openChart('all', 'bar')} />
        <CompactButton icon={<AreaChart size={13} />} label="Vùng" onClick={() => openChart('all', 'area')} />
        <CompactButton icon={<ScatterChart size={13} />} label="Phân tán" onClick={() => openChart('all', 'scatter')} />
      </div>
      <div className="ribbon-two-rows">
        <CompactButton icon={<TrendingUp size={13} />} label="Thác nước" onClick={() => openChart('all', 'waterfall')} />
        <CompactButton icon={<Layers size={13} />} label="Kết hợp" onClick={() => openChart('all', 'combo')} />
        <CompactButton icon={<Shapes size={13} />} label="Tất cả biểu đồ" onClick={() => openChart('all')} />
      </div>
      <RibbonButton icon={<Network size={20} color="#7c3aed" />} label="PivotChart" title="Biểu đồ tổng hợp theo nhóm từ bảng dữ liệu" onClick={() => openChart('pivot')} />
    </RibbonSection>
  );

  const insertSections = (
    <>
      <RibbonSection label="Sparkline">
        <RibbonButton icon={<LineChart size={20} color="#2563eb" />} label="Đường" onClick={() => openSparkline('line')} />
        <RibbonButton icon={<BarChart3 size={20} color="#107c41" />} label="Cột" onClick={() => openSparkline('column')} />
        <RibbonButton icon={<Columns3 size={20} color="#dc2626" />} label="Thắng/Thua" onClick={() => openSparkline('winloss')} />
      </RibbonSection>
      <RibbonSection label="Bộ lọc">
        <RibbonButton icon={<CalendarRange size={20} color="#0d9488" />} label="Timeline" title="Lọc bảng theo năm, quý, tháng của cột ngày" onClick={openTimeline} />
      </RibbonSection>
      <RibbonSection label="Minh hoạ thêm">
        <RibbonButton icon={<Smile size={20} color="#d97706" />} label="Biểu tượng" onClick={() => setModal({ kind: 'icons' })} />
        <RibbonButton icon={<Network size={20} color="#2563eb" />} label="SmartArt" onClick={() => setModal({ kind: 'smartArt' })} />
        <RibbonButton icon={<Camera size={20} color="#475569" />} label="Chụp màn hình" title="Chụp một cửa sổ hoặc màn hình rồi chèn vào trang tính" onClick={() => void captureScreenshot()} />
      </RibbonSection>
      <RibbonSection label="Văn bản">
        <RibbonButton icon={<LayoutTemplate size={20} color="#107c41" />} label="Đầu & chân trang" onClick={() => setModal({ kind: 'headerFooter' })} />
        <RibbonButton icon={<Type size={20} color="#7c3aed" />} label="WordArt" onClick={() => setModal({ kind: 'wordArt' })} />
        <RibbonButton icon={<PenLine size={20} color="#b91c1c" />} label="Dòng chữ ký" onClick={() => host.openSignature()} />
      </RibbonSection>
    </>
  );

  const drawSections = (
    <>
      <RibbonSection label="Công cụ vẽ">
        <RibbonButton icon={<MousePointer2 size={20} color="#475569" />} label="Chọn ô" active={!inkTool} onClick={() => setInkTool(null)} />
        {PEN_PRESETS.map((preset) => (
          <RibbonButton
            key={preset.id}
            icon={preset.alpha < 1 ? <Highlighter size={20} color="#ca8a04" /> : <PenLine size={20} color={preset.color} />}
            label={preset.label}
            active={currentPen?.color === preset.color}
            onClick={() => pickPen(preset)}
          />
        ))}
        <RibbonButton icon={<Eraser size={20} color="#dc2626" />} label="Tẩy nét" active={inkTool?.kind === 'eraser'} onClick={() => setInkTool({ kind: 'eraser' })} />
        <div className="ribbon-two-rows">
          {PEN_WIDTHS.map((width) => (
            <CompactButton
              key={width}
              icon={<span style={{ display: 'inline-block', width: 14, height: Math.max(1, width), background: '#334155', borderRadius: width }} />}
              label={`${width} px`}
              active={inkWidth === width}
              onClick={() => {
                setInkWidth(width);
                if (currentPen && currentPen.alpha === 1) setInkTool({ ...currentPen, width });
              }}
            />
          ))}
        </div>
      </RibbonSection>
      <RibbonSection label="Chuyển đổi">
        <RibbonButton icon={<ImagePlus size={20} color="#107c41" />} label="Gắn nét vẽ" title="Gắn các nét vẽ vào trang tính thành một hình ảnh" disabled={!activeStrokes.length} onClick={() => void commitInk()} />
        <RibbonButton icon={<Undo2 size={20} color="#475569" />} label="Bỏ nét cuối" disabled={!activeStrokes.length} onClick={() => setActiveStrokes(activeStrokes.slice(0, -1))} />
        <RibbonButton icon={<Scissors size={20} color="#dc2626" />} label="Xoá hết nét" disabled={!activeStrokes.length} onClick={() => setActiveStrokes([])} />
        <RibbonButton icon={inkHidden ? <Eye size={20} color="#475569" /> : <EyeOff size={20} color="#475569" />} label={inkHidden ? 'Hiện nét vẽ' : 'Ẩn nét vẽ'} onClick={() => setInkHidden((v) => !v)} />
      </RibbonSection>
    </>
  );

  const pageLayoutSections = (
    <>
      <RibbonSection label="Thiết lập trang">
        <RibbonButton icon={<Ruler size={20} color="#0284c7" />} label="Lề ▾" onClick={(e) => openMenu(e, 'margins')} />
        <RibbonButton icon={<FileText size={20} color="#475569" />} label={`Khổ ${ps.paper ?? ps.paperSize} ▾`} onClick={(e) => openMenu(e, 'paper')} />
        <RibbonButton icon={<ArrowDownToLine size={20} color="#7c3aed" />} label={`In tiêu đề${ps.printTitleRows ? ` (${ps.printTitleRows})` : ''}`} title="Lặp lại các dòng đầu trên mỗi trang in" onClick={() => void askPrintTitles()} />
        <RibbonButton icon={<LayoutTemplate size={20} color="#107c41" />} label="Đầu & chân trang" onClick={() => setModal({ kind: 'headerFooter' })} />
      </RibbonSection>
      <RibbonSection label="Co giãn để vừa">
        <div className="ribbon-two-rows">
          <CompactButton label="Vừa chiều rộng" active={scaleMode === 'fit-width'} onClick={() => setScaleMode('fit-width', 'Bản in co cho vừa chiều rộng trang')} />
          <CompactButton label="Vừa 1 trang" active={scaleMode === 'fit-page'} onClick={() => setScaleMode('fit-page', 'Bản in co cho vừa 1 trang')} />
          <CompactButton label="Cỡ thực 100%" active={scaleMode === 'actual'} onClick={() => setScaleMode('actual', 'Bản in giữ cỡ thực 100%')} />
        </div>
        <RibbonButton icon={<SlidersHorizontal size={20} color="#0d9488" />} label={scaleMode === 'custom' ? `Tỉ lệ ${Math.round((ps.customScale ?? 1) * 100)}%` : 'Tỉ lệ %'} active={scaleMode === 'custom'} onClick={() => void askScale()} />
      </RibbonSection>
      <RibbonSection label="Tiêu đề hàng/cột">
        <RibbonButton icon={<View size={20} color="#475569" />} label="Xem" active={!headingsHidden} onClick={toggleHeadings} />
        <RibbonButton icon={<FileSpreadsheet size={20} color="#107c41" />} label="In" active={Boolean(ps.printHeadings)} onClick={() => host.updatePrintSettings({ printHeadings: !ps.printHeadings })} />
      </RibbonSection>
      <RibbonSection label="Sắp xếp">
        <div className="ribbon-two-rows">
          <CompactButton icon={<ArrowUpToLine size={13} />} label="Đưa lên trước" onClick={() => arrangeSelected('forward')} />
          <CompactButton icon={<ArrowDownToLine size={13} />} label="Đưa ra sau" onClick={() => arrangeSelected('backward')} />
          <CompactButton icon={<RotateCw size={13} />} label="Xoay 90°" onClick={rotateSelected} />
        </div>
        <RibbonButton icon={<SquareStack size={20} color="#4f46e5" />} label="Ngăn chọn" onClick={() => setModal({ kind: 'selectionPane' })} />
      </RibbonSection>
    </>
  );

  const categoryButton = (id: string) => {
    const category = FUNCTION_CATEGORIES.find((item) => item.id === id);
    return category ? <CompactButton key={id} label={`${category.label} ▾`} onClick={(e) => openMenu(e, `fn-${id}`)} /> : null;
  };

  const formulaLibrary = (
    <>
      <RibbonButton icon={<BookOpen size={20} color="#475569" />} label="Dùng gần đây ▾" onClick={(e) => openMenu(e, 'fn-recent')} />
      <div className="ribbon-two-rows">{PRIMARY_CATEGORY_IDS.slice(0, 3).map(categoryButton)}</div>
      <div className="ribbon-two-rows">{PRIMARY_CATEGORY_IDS.slice(3).map(categoryButton)}</div>
      <RibbonButton icon={<Shapes size={20} color="#7c3aed" />} label="Hàm khác ▾" onClick={(e) => openMenu(e, 'fn-more')} />
    </>
  );

  const formulaNames = (
    <div className="ribbon-two-rows">
      <CompactButton icon={<Tag size={13} />} label="Dùng trong công thức ▾" onClick={(e) => openMenu(e, 'use-name')} />
      <CompactButton icon={<WandSparkles size={13} />} label="Tạo từ vùng chọn" onClick={() => void createNamesFromSelection()} />
    </div>
  );

  const formulaAudit = (
    <>
      <RibbonButton icon={<X size={20} color="#dc2626" />} label="Xoá mũi tên" title="Xoá vết tiền đề và phụ thuộc đang hiện" onClick={() => host.clearAuditArrows()} />
      <RibbonButton icon={<AlertTriangle size={20} color="#dc2626" />} label="Kiểm tra lỗi" title="Tìm ô lỗi #DIV/0!, #N/A…, số lưu dạng chữ, công thức lệch với cột" onClick={openErrorChecking} />
      <RibbonButton icon={<Footprints size={20} color="#2563eb" />} label="Đánh giá công thức" title="Xem từng bước công thức ở ô đang chọn được tính ra sao" onClick={() => openEvaluate()} />
    </>
  );

  const calculationSection = (
    <RibbonSection label="Tính toán">
      <RibbonButton icon={<Calculator size={20} color="#475569" />} label={calcMode === 'manual' ? 'Tính: Thủ công ▾' : 'Tính: Tự động ▾'} title="Tuỳ chọn tính toán" onClick={(e) => openMenu(e, 'calc')} />
      <div className="ribbon-two-rows">
        <CompactButton icon={<RefreshCw size={13} />} label="Tính ngay" title="F9" onClick={() => void calculateNow('workbook')} />
        <CompactButton icon={<RefreshCw size={13} />} label="Tính trang tính" title="Shift + F9" onClick={() => void calculateNow('sheet')} />
      </div>
    </RibbonSection>
  );

  const dataSections = (
    <>
      <RibbonSection label="Lấy & biến đổi dữ liệu">
        <RibbonButton icon={<Globe size={20} color="#2563eb" />} label="Từ Web" title="Nhập bảng HTML hoặc tệp CSV từ địa chỉ web" onClick={() => void importFromWeb()} />
        <RibbonButton icon={<FileText size={20} color="#107c41" />} label="Từ văn bản/CSV" onClick={() => void importFromCsv()} />
        <RibbonButton icon={<Network size={20} color="#7c3aed" />} label={`Truy vấn (${(excel.queries ?? []).length})`} title="Truy vấn & Kết nối" onClick={() => setModal({ kind: 'queries' })} />
        <RibbonButton icon={<RefreshCw size={20} color="#0d9488" />} label="Làm mới tất cả" onClick={() => void refreshAll()} />
      </RibbonSection>
      <RibbonSection label="Dự báo">
        <RibbonButton icon={<Layers size={20} color="#4f46e5" />} label={`Kịch bản (${(excel.scenarios ?? []).length})`} title="Lưu và so sánh các bộ giá trị đầu vào" onClick={() => setModal({ kind: 'scenarios' })} />
        <RibbonButton icon={<TrendingUp size={20} color="#d97706" />} label="Trang dự báo" onClick={() => setModal({ kind: 'forecast', range: selectionOrSmartRange() })} />
      </RibbonSection>
    </>
  );

  const reviewProofing = (
    <>
      <RibbonButton icon={<SpellCheck2 size={20} color="#107c41" />} label="Chính tả" title="Kiểm tra chính tả tiếng Việt trong trang tính (F7)" onClick={openSpelling} />
      <RibbonButton
        icon={<BookOpen size={20} color="#2563eb" />}
        label="Từ đồng nghĩa"
        onClick={() => {
          const ctx = host.getActiveContext();
          setModal({ kind: 'thesaurus', word: cellString(ctx?.fRange.getRawValue()).trim() });
        }}
      />
    </>
  );

  const reviewSections = (
    <>
      <RibbonSection label="Ngôn ngữ">
        <RibbonButton
          icon={<Languages size={20} color="#0284c7" />}
          label="Dịch"
          onClick={() => {
            const ctx = host.getActiveContext();
            if (!ctx) return;
            const cells = selectedTextCells(ctx);
            if (!cells.length) {
              host.toast('Hãy chọn các ô có chữ cần dịch', true);
              return;
            }
            setModal({ kind: 'translate', cells });
          }}
        />
      </RibbonSection>
      <RibbonSection label="Điều hướng thảo luận">
        <RibbonButton icon={<ChevronLeft size={20} color="#4f46e5" />} label="Trước" onClick={() => stepComment(-1)} />
        <RibbonButton icon={<ChevronRight size={20} color="#4f46e5" />} label="Sau" onClick={() => stepComment(1)} />
      </RibbonSection>
      <RibbonSection label="Bảo vệ & mực">
        <RibbonButton icon={structureLocked ? <Unlock size={20} color="#dc2626" /> : <Lock size={20} color="#0f766e" />} label={structureLocked ? 'Mở khoá sổ tính' : 'Bảo vệ sổ tính'} active={structureLocked} title="Khoá cấu trúc: chặn thêm, xoá, đổi tên, ẩn, di chuyển trang tính" onClick={() => void toggleStructureLock()} />
        <RibbonButton icon={inkHidden ? <Eye size={20} color="#475569" /> : <EyeOff size={20} color="#475569" />} label={inkHidden ? 'Hiện nét vẽ' : 'Ẩn nét vẽ'} onClick={() => setInkHidden((v) => !v)} />
      </RibbonSection>
    </>
  );

  const viewSections = (
    <>
      <RibbonSection label="Chế độ xem">
        <RibbonButton icon={<Compass size={20} color="#2563eb" />} label="Điều hướng" title="Trang tính, vùng đã đặt tên và đối tượng" onClick={() => setModal({ kind: 'navigation' })} />
        <RibbonButton icon={<Eye size={20} color="#107c41" />} label={`Xem tuỳ chỉnh (${(excel.customViews ?? []).length})`} onClick={() => setModal({ kind: 'customViews' })} />
        <RibbonButton icon={<View size={20} color="#475569" />} label="Tiêu đề hàng/cột" active={!headingsHidden} onClick={toggleHeadings} />
      </RibbonSection>
      <RibbonSection label="Thu phóng & cửa sổ">
        <RibbonButton icon={<ZoomIn size={20} color="#0d9488" />} label="Vừa vùng chọn" onClick={zoomToSelection} />
        <RibbonButton icon={<FileSpreadsheet size={20} color="#475569" />} label="Cửa sổ mới" title="Mở thêm một cửa sổ cùng tài liệu" onClick={() => window.open(window.location.href, '_blank', 'noopener')} />
      </RibbonSection>
    </>
  );

  const automateSections = (
    <RibbonSection label="Office Scripts">
      <RibbonButton icon={<FileCode2 size={20} color="#2563eb" />} label="Script mới" onClick={() => setModal({ kind: 'scripts', initialId: null })} />
      <RibbonButton icon={<Play size={20} color="#107c41" />} label={`Tất cả script (${scripts.length})`} onClick={(e) => (scripts.length ? openMenu(e, 'scripts') : setModal({ kind: 'scripts', initialId: null }))} />
    </RibbonSection>
  );

  const fnItems = (names: string[]) =>
    names.map((name) => (
      <button key={name} className="sheet-popover-item" onClick={() => insertFunction(name)}>
        <span>{name}</span>
      </button>
    ));

  const menuItems = (id: string): ReactNode => {
    if (id === 'margins')
      return RIBBON_MARGINS.map((key) => (
        <button
          key={key}
          className={`sheet-popover-item${ps.marginPreset === key ? ' is-checked' : ''}`}
          onClick={() => {
            host.updatePrintSettings({ marginPreset: key });
            setMenu(null);
            host.toast(`Đã đặt lề in: ${MARGIN_PRESETS[key].name}`);
          }}
        >
          <span>{MARGIN_PRESETS[key].name}</span>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>
            {MARGIN_PRESETS[key].top} · {MARGIN_PRESETS[key].left} mm
          </span>
        </button>
      ));
    if (id === 'paper')
      return RIBBON_PAPERS.map((key) => (
        <button
          key={key}
          className={`sheet-popover-item${(ps.paper ?? ps.paperSize) === key ? ' is-checked' : ''}`}
          onClick={() => {
            host.updatePrintSettings({ paper: key, ...(key === 'A4' || key === 'A3' || key === 'Letter' ? { paperSize: key } : {}) });
            setMenu(null);
            host.toast(`Đã đặt khổ giấy in ${paperLabel(key)}`);
          }}
        >
          <span>{paperLabel(key)}</span>
        </button>
      ));
    if (id === 'calc')
      return (
        <>
          <button className={`sheet-popover-item${calcMode === 'automatic' ? ' is-checked' : ''}`} onClick={() => setCalcMode('automatic')}>
            <span>Tự động</span>
          </button>
          <button className={`sheet-popover-item${calcMode === 'manual' ? ' is-checked' : ''}`} onClick={() => setCalcMode('manual')}>
            <span>Thủ công (F9 để tính)</span>
          </button>
        </>
      );
    if (id === 'fn-recent') return recentFunctions.length ? fnItems(recentFunctions) : <div className="sheet-popover-title">Chưa dùng hàm nào</div>;
    if (id === 'fn-more')
      return MORE_CATEGORY_IDS.map((categoryId) => {
        const category = FUNCTION_CATEGORIES.find((item) => item.id === categoryId);
        return category ? (
          <div key={categoryId}>
            <div className="sheet-popover-title">{category.label}</div>
            {fnItems(category.functions)}
          </div>
        ) : null;
      });
    if (id.startsWith('fn-')) return fnItems(FUNCTION_CATEGORIES.find((item) => `fn-${item.id}` === id)?.functions ?? []);
    if (id === 'use-name') {
      const names = definedNameList();
      return names.length ? (
        names.map((item) => (
          <button key={item.name} className="sheet-popover-item" onClick={() => insertNameInFormula(item.name)}>
            <span>{item.name}</span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{item.ref}</span>
          </button>
        ))
      ) : (
        <div className="sheet-popover-title">Chưa có vùng nào được đặt tên</div>
      );
    }
    if (id === 'scripts')
      return scripts.map((script) => (
        <button
          key={script.id}
          className="sheet-popover-item"
          onClick={() => {
            setMenu(null);
            setModal({ kind: 'scripts', initialId: script.id });
          }}
        >
          <span>{script.name}</span>
        </button>
      ));
    return null;
  };

  const menuNode = menu && (
    <>
      <div className="sheet-popover-backdrop" onClick={() => setMenu(null)} />
      <div className="sheet-popover" style={{ left: menu.left, top: menu.top }}>
        {menuItems(menu.id)}
      </div>
    </>
  );

  const renderModal = (): ReactNode => {
    if (!modal) return null;
    const close = () => setModal(null);
    switch (modal.kind) {
      case 'chart':
        return <ChartGalleryModal mode={modal.mode} initialKind={modal.initialKind} initialRange={modal.range} readRangeValues={host.readRangeValues} onEmbed={embedChart} onDownload={downloadChart} onClose={close} />;
      case 'sparkline':
        return <SparklineModal initialKind={modal.sparkKind} initialData={modal.data} initialLocation={modal.location} onInsert={insertSparklines} onClose={close} />;
      case 'scenarios':
        return (
          <ScenarioManagerModal
            scenarios={excel.scenarios ?? []}
            activeRange={host.activeRangeA1}
            readCell={(a1) => cellString(resolveRef(a1))}
            onSave={(next) => patchExcel({ scenarios: next })}
            onShow={showScenario}
            onSummary={(cells) => void summarizeScenarios(cells)}
            onClose={close}
          />
        );
      case 'forecast':
        return <ForecastSheetModal initialRange={modal.range} onCreate={createForecast} onClose={close} />;
      case 'evaluate':
        return <EvaluateFormulaModal cellA1={modal.a1} formula={modal.formula} resolve={resolveRef} result={modal.result} onClose={close} />;
      case 'errors':
        return (
          <ErrorCheckingModal
            issues={modal.issues}
            onGoTo={(issue) => goToCell(issue.row, issue.column)}
            onConvertNumber={(issue) => {
              const ctx = host.getEditableContext();
              if (!ctx) return;
              const cell = ctx.fWorksheet.getRange(issue.row, issue.column, 1, 1);
              cell.setValue(Number(cellString(cell.getRawValue()).replace(/,/g, '')));
              host.markDirty();
              setModal({ kind: 'errors', issues: modal.issues.filter((item) => item !== issue) });
            }}
            onEvaluate={(issue) => openEvaluate(issue.a1)}
            onClose={close}
          />
        );
      case 'spelling':
        return <SpellingModal issues={modal.issues} onGoTo={(issue) => goToCell(issue.row, issue.column)} onApply={applySpelling} onClose={close} />;
      case 'thesaurus':
        return (
          <ThesaurusModal
            initialWord={modal.word}
            onReplace={(word) => {
              const ctx = host.getEditableContext();
              if (!ctx) return;
              const current = cellString(ctx.fRange.getRawValue());
              ctx.fRange.setValue(modal.word && current.includes(modal.word) ? current.replace(modal.word, word) : word);
              host.markDirty();
              close();
            }}
            onClose={close}
          />
        );
      case 'translate':
        return <TranslateModal cells={modal.cells} onWrite={writeTranslations} onClose={close} />;
      case 'headerFooter':
        return <HeaderFooterModal header={ps.header} footer={ps.footer} onSave={saveHeaderFooter} onClose={close} />;
      case 'selectionPane':
        return (
          <SelectionPaneModal
            items={selectionPaneItems()}
            onSelect={(id) =>
              withImage(id, (image) => {
                const placement = image.getPlacement?.();
                if (placement && typeof placement.row === 'number' && typeof placement.column === 'number') goToCell(placement.row, placement.column);
              })
            }
            onOrder={(id, where) =>
              withImage(id, (image) => {
                if (where === 'front') image.setFront();
                else if (where === 'forward') image.setForward();
                else if (where === 'backward') image.setBackward();
                else image.setBack();
              })
            }
            onDelete={(id) => withImage(id, (image) => image.remove())}
            onClose={close}
          />
        );
      case 'smartArt':
        return <SmartArtModal onInsert={insertImagePayload} onClose={close} />;
      case 'icons':
        return <IconPickerModal onInsert={insertImagePayload} onClose={close} />;
      case 'wordArt':
        return <WordArtModal onInsert={insertImagePayload} onClose={close} />;
      case 'timeline':
        return <TimelineModal headers={modal.headers} rows={modal.rows} onApply={applyTimeline} onClose={close} />;
      case 'queries':
        return (
          <QueriesModal
            queries={excel.queries ?? []}
            onRefresh={refreshQuery}
            onDelete={(query) => patchExcel({ queries: (excelRef.current.queries ?? []).filter((item) => item.id !== query.id) })}
            onRename={(query) => {
              void host.ask('Đổi tên truy vấn', [{ name: 'name', label: 'Tên mới', value: query.name }]).then((answer) => {
                const name = typeof answer?.name === 'string' ? answer.name.trim() : '';
                if (name) patchExcel({ queries: (excelRef.current.queries ?? []).map((item) => (item.id === query.id ? { ...item, name } : item)) });
              });
            }}
            onClose={close}
          />
        );
      case 'navigation':
        return <NavigationModal entries={navigationEntries()} onClose={close} />;
      case 'customViews':
        return (
          <CustomViewsModal
            views={excel.customViews ?? []}
            onAdd={(name) => {
              const view = currentView(name);
              if (view) patchExcel({ customViews: [...(excelRef.current.customViews ?? []), view] });
            }}
            onShow={showView}
            onDelete={(view) => patchExcel({ customViews: (excelRef.current.customViews ?? []).filter((item) => item.id !== view.id) })}
            onClose={close}
          />
        );
      case 'scripts':
        return (
          <OfficeScriptsModal
            scripts={scripts}
            initialId={modal.initialId}
            onSave={(script) => {
              const list = excelRef.current.officeScripts ?? [];
              patchExcel({ officeScripts: list.some((item) => item.id === script.id) ? list.map((item) => (item.id === script.id ? script : item)) : [...list, script] });
            }}
            onDelete={(id) => patchExcel({ officeScripts: (excelRef.current.officeScripts ?? []).filter((item) => item.id !== id) })}
            onRun={runScript}
            onClose={close}
          />
        );
      default:
        return null;
    }
  };

  const overlay =
    !inkHidden && (inkTool || activeStrokes.length) ? (
      <div className="sheet-ink-host" style={{ pointerEvents: inkTool ? 'auto' : 'none' }}>
        <InkLayer tool={inkTool ?? { kind: 'pen', color: '#0f172a', width: 2, alpha: 1 }} strokes={activeStrokes} onChange={setActiveStrokes} />
      </div>
    ) : null;

  const statusBadge =
    calcMode === 'manual' ? (
      <button className="sheet-calc-badge" title="Bấm để tính lại ngay (F9)" onClick={() => void calculateNow('workbook')}>
        Tính: Thủ công
      </button>
    ) : null;

  return {
    excel,
    chartSection,
    insertSections,
    drawSections,
    pageLayoutSections,
    formulaLibrary,
    formulaNames,
    formulaAudit,
    calculationSection,
    dataSections,
    reviewProofing,
    reviewSections,
    viewSections,
    automateSections,
    nodes: (
      <>
        {menuNode}
        {renderModal()}
      </>
    ),
    overlay,
    statusBadge,
    openSpelling,
  };
}
