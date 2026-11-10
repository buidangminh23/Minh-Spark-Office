import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Copy, File, Files, LayoutGrid, Layers, Loader2, Maximize2, Printer, RectangleHorizontal, RectangleVertical, X } from 'lucide-react';
import { PAPERS, mmToPx, type OrientationChoice, type ScaleMode } from '../../lib/print/printLayout';
import { PAPER_CATALOG, PAPER_GROUP_LABELS, PAPER_KEYS, type PaperKey } from '../../lib/paperSizes';
import { PRINT_ROOT_ID, PRINTING_CLASS, onAfterPrint, openSystemPrint, printErrorMessage, printPlatform, waitForPrintReady } from '../../lib/print/printRun';
import { PrinterPicker } from './PrinterPicker';
import { usePrinters } from './usePrinters';
import { loadChoice, printerNotes, resolveChoice, saveChoice, targetFor, type PrinterChoice } from './printerChoice';
import { OptionCard, type CardOption } from './OptionCard';
import { CmField } from './MarginGallery';
import { MarginControls } from './PrintLayoutControls';
import { PAGES_PER_SHEET, composePages, duplexSide, expandCopies, filterParity, physicalSheets, type PagesPerSheet, type PrintRun } from './printOutput';
import { planSheets, selectSheets } from './printPages';
import { OutputPageView, PrintPortal } from './PrintSheetView';
import { loadSettings, saveSettings, type PrintSettings, type PrintSource } from './printTypes';
import './printDialog.css';

type CardOverrides = { orientation?: ReactNode; paper?: ReactNode; margins?: ReactNode };

type Props = {
  source: PrintSource;
  onClose: () => void;
  extraOptions?: ReactNode;
  cards?: CardOverrides;
  autoNotes?: string[];
  initial?: Partial<PrintSettings>;
  onSettingsChange?: (settings: PrintSettings) => void;
  onPageSetup?: () => void;
};

type Phase = 'idle' | 'preparing' | 'flip' | 'waiting' | 'done';
type Notice = { tone: 'ok' | 'error'; title: string; text: string };
const SENT_CLOSE_MS = 2_500;
type RangeChoice = 'all' | 'current' | 'custom' | 'odd' | 'even';

const SCALE_LABELS: Record<ScaleMode, string> = {
  auto: 'Tự động vừa trang',
  actual: 'Kích thước thật (100%)',
  'fit-width': 'Vừa bề ngang',
  'fit-page': 'Vừa cả trang',
  custom: 'Tùy chỉnh %',
};

const PAGE_GAP_PX = 24;
const ZOOM_MIN = 10;
const ZOOM_MAX = 200;
const CUSTOM_PAPER = 'custom';

const RANGE_OPTIONS: CardOption<RangeChoice>[] = [
  { value: 'all', title: 'In tất cả trang', subtitle: 'Toàn bộ nội dung', icon: <Files size={20} /> },
  { value: 'current', title: 'In trang hiện tại', subtitle: 'Chỉ trang đang mở', icon: <File size={20} /> },
  { value: 'custom', title: 'In phạm vi tùy chỉnh', subtitle: 'Nhập số trang, ví dụ 1-3, 5', icon: <Files size={20} /> },
  { value: 'odd', title: 'Chỉ in trang lẻ', subtitle: 'Trang 1, 3, 5…', icon: <Files size={20} /> },
  { value: 'even', title: 'Chỉ in trang chẵn', subtitle: 'Trang 2, 4, 6…', icon: <Files size={20} /> },
];

const ORIENTATION_OPTIONS: CardOption<OrientationChoice>[] = [
  { value: 'auto', title: 'Hướng tự động', subtitle: 'Chọn dọc hoặc ngang cho vừa nội dung', icon: <Maximize2 size={20} /> },
  { value: 'portrait', title: 'Hướng dọc', icon: <RectangleVertical size={20} /> },
  { value: 'landscape', title: 'Hướng ngang', icon: <RectangleHorizontal size={20} /> },
];

const paperSubtitle = (w: number, h: number) => `${String(Math.round(w) / 10).replace('.', ',')} cm × ${String(Math.round(h) / 10).replace('.', ',')} cm`;

const PAPER_OPTIONS: CardOption<string>[] = [
  ...PAPER_KEYS.map((key) => ({ value: key, title: PAPER_CATALOG[key].name, subtitle: paperSubtitle(PAPER_CATALOG[key].w, PAPER_CATALOG[key].h), group: PAPER_GROUP_LABELS[PAPER_CATALOG[key].group], icon: <File size={20} /> })),
  { value: CUSTOM_PAPER, title: 'Khổ tùy chỉnh…', subtitle: 'Tự nhập chiều rộng và chiều cao', group: 'Khác', icon: <File size={20} /> },
];

const PER_SHEET_OPTIONS: CardOption<PagesPerSheet>[] = PAGES_PER_SHEET.map((n) => ({ value: n, title: `${n} trang mỗi tờ`, subtitle: n === 1 ? 'Mỗi trang in trên một tờ giấy' : `Thu nhỏ ${n} trang lên một mặt giấy`, icon: <LayoutGrid size={20} /> }));

function useFitZoom(paper: { w: number; h: number } | undefined) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(50);
  const paperW = paper?.w;
  const paperH = paper?.h;
  useLayoutEffect(() => {
    const pane = ref.current;
    if (!pane || paperW === undefined || paperH === undefined) return;
    const measure = () => {
      const w = mmToPx(paperW);
      const h = mmToPx(paperH);
      const percent = Math.min((pane.clientWidth - 64) / w, (pane.clientHeight - 64) / h) * 100;
      setFit(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(percent))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    measure();
    return () => observer.disconnect();
  }, [paperW, paperH]);
  return { ref, fit };
}

function LazyPage({ width, height, root, children, index, onVisible }: { width: number; height: number; root: HTMLElement | null; children: ReactNode; index: number; onVisible: (index: number, ratio: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !root) return;
    const nearObserver = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { root, rootMargin: '600px' });
    const visibleObserver = new IntersectionObserver(([entry]) => onVisible(index, entry.intersectionRatio), { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    nearObserver.observe(el);
    visibleObserver.observe(el);
    return () => { nearObserver.disconnect(); visibleObserver.disconnect(); };
  }, [root, index, onVisible]);
  return (
    <div ref={ref} className="mp-paper-frame" data-page-index={index} style={{ width, height }}>
      {near ? children : null}
    </div>
  );
}

export function PrintDialog({ source, onClose, extraOptions, cards, autoNotes, initial, onSettingsChange, onPageSetup }: Props) {
  const [settings, setSettings] = useState<PrintSettings>(() => ({ ...loadSettings(source.kind), ...initial }));
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState<'front' | 'back' | 'all'>('all');
  const [pendingLeft, setPendingLeft] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [guides, setGuides] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const platform = printPlatform();
  const [storedChoice, setStoredChoice] = useState<PrinterChoice | null>(() => loadChoice());
  const [notice, setNotice] = useState<Notice | null>(null);
  const { printers, scanning, refresh } = usePrinters(platform, phase === 'preparing');
  const resolved = useMemo(() => resolveChoice(storedChoice, printers, platform), [storedChoice, printers, platform]);
  const target = useMemo(() => targetFor(resolved, platform), [resolved, platform]);
  const choosePrinter = useCallback((choice: PrinterChoice) => { setStoredChoice(choice); saveChoice(choice); setNotice(null); }, []);
  const update = useCallback((patch: Partial<PrintSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const settingsListener = useRef(onSettingsChange);
  useLayoutEffect(() => { settingsListener.current = onSettingsChange; });
  useEffect(() => {
    saveSettings(source.kind, settings);
    settingsListener.current?.(settings);
  }, [source.kind, settings]);

  const plan = useMemo(() => planSheets(source, settings), [source, settings]);
  const selected = useMemo(() => filterParity(selectSheets(plan, settings, source.currentItem), settings.parity), [plan, settings, source.currentItem]);
  const outputs = useMemo(() => (plan.sheets.length ? composePages(plan.sheets, selected, settings.pagesPerSheet) : []), [plan.sheets, selected, settings.pagesPerSheet]);
  const manual = settings.sides === 'manual';
  const fullRun = useMemo(() => expandCopies(outputs, settings.copies, settings.collate || manual, manual), [outputs, settings.copies, settings.collate, manual]);
  const run: PrintRun = useMemo(() => (step === 'all' ? fullRun : duplexSide(fullRun, step, settings.reverseBack)), [fullRun, step, settings.reverseBack]);
  const ctx = useMemo(() => ({ sheets: plan.sheets, source, settings, total: plan.sheets.length }), [plan.sheets, source, settings]);

  const firstPaper = outputs[0]?.paper;
  const { ref: fitRef, fit } = useFitZoom(firstPaper);
  const zoomPercent = zoom ?? fit;
  const scale = zoomPercent / 100;

  const printerLabel = resolved.printer?.displayName ?? null;
  const latest = useRef({ run, title: source.title, onClose, manual, step, target, printerLabel, duplex: settings.sides === 'auto', grayscale: settings.grayscale, refresh });
  useLayoutEffect(() => { latest.current = { run, title: source.title, onClose, manual, step, target, printerLabel, duplex: settings.sides === 'auto', grayscale: settings.grayscale, refresh }; });

  useEffect(() => {
    if (phase !== 'preparing') return;
    let cancelled = false;
    const root = document.getElementById(PRINT_ROOT_ID);
    if (!root) return;
    const afterFront = () => latest.current.manual && latest.current.step === 'front';
    const finish = () => {
      document.body.classList.remove(PRINTING_CLASS);
      if (cancelled) return;
      if (afterFront()) setPhase('flip');
      else latest.current.onClose();
    };
    let detach: (() => void) | undefined;
    (async () => {
      await waitForPrintReady(root, setPendingLeft);
      if (cancelled) return;
      const job = latest.current;
      document.body.classList.add(PRINTING_CLASS);
      if (job.target.kind === 'system') detach = onAfterPrint(finish);
      const first = job.run.find(Boolean);
      const result = await openSystemPrint({
        widthMm: first?.paper.w ?? 210,
        heightMm: first?.paper.h ?? 297,
        landscape: first?.orientation === 'landscape',
        title: job.title,
        target: job.target,
        duplex: job.duplex,
        grayscale: job.grayscale,
      }).catch((error: unknown) => ({ mode: 'failed' as const, error }));
      if (cancelled) return;
      if (result.mode === 'failed') {
        document.body.classList.remove(PRINTING_CLASS);
        setNotice({ tone: 'error', title: 'Chưa in được', text: printErrorMessage(result.error, job.printerLabel) });
        if (job.target.kind === 'printer') job.refresh();
        setPhase(job.manual && job.step === 'back' ? 'flip' : 'idle');
        return;
      }
      if (result.mode === 'detached') setPhase(afterFront() ? 'flip' : 'waiting');
      if (result.mode !== 'done') return;
      document.body.classList.remove(PRINTING_CLASS);
      if (result.status === 'cancelled') {
        setNotice({ tone: 'error', title: 'Đã hủy', text: 'Lệnh in đã bị hủy, chưa có trang nào được gửi.' });
        setPhase(job.manual && job.step === 'back' ? 'flip' : 'idle');
        return;
      }
      if (afterFront()) {
        setNotice(null);
        setPhase('flip');
        return;
      }
      if (result.status === 'saved') {
        const file = result.path?.split(/[\\/]/).pop() ?? 'tệp PDF';
        setNotice({ tone: 'ok', title: 'Đã lưu PDF', text: `${file} đã nằm trong thư mục Tải về.` });
      } else {
        setNotice({ tone: 'ok', title: 'Đã gửi lệnh in', text: `Đã gửi ${job.run.filter(Boolean).length} mặt in tới ${job.printerLabel ? `“${job.printerLabel}”` : 'máy in'}.` });
      }
      setPhase('done');
    })();
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done' || notice?.title !== 'Đã gửi lệnh in') return;
    const timer = window.setTimeout(() => latest.current.onClose(), SENT_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, notice]);

  useEffect(() => () => document.body.classList.remove(PRINTING_CLASS), []);

  const startPrint = useCallback(() => {
    if (!outputs.length || source.loading || (phase !== 'idle' && phase !== 'flip')) return;
    setNotice(null);
    if (phase === 'flip') {
      document.body.classList.remove(PRINTING_CLASS);
      setStep('back');
    } else {
      setStep(manual ? 'front' : 'all');
    }
    setPhase('preparing');
  }, [outputs.length, source.loading, phase, manual]);

  const scrollToPage = useCallback((index: number) => {
    const target = stage?.querySelector<HTMLElement>(`[data-page-index="${index}"]`);
    target?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
    setCurrent(index);
  }, [stage]);

  const visibility = useRef(new Map<number, number>());
  const onVisible = useCallback((index: number, ratio: number) => {
    visibility.current.set(index, ratio);
    let best = 0;
    let bestRatio = -1;
    for (const [i, r] of visibility.current) if (r > bestRatio + 0.01 || (Math.abs(r - bestRatio) <= 0.01 && i < best)) { best = i; bestRatio = r; }
    setCurrent(best);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === 'Escape' && !typing) { event.preventDefault(); latest.current.onClose(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); startPrint(); }
      if (!typing && event.key === 'PageDown') scrollToPage(Math.min(outputs.length - 1, current + 1));
      if (!typing && event.key === 'PageUp') scrollToPage(Math.max(0, current - 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [startPrint, scrollToPage, current, outputs.length]);

  const rangeValue: RangeChoice = settings.parity !== 'all' ? settings.parity : settings.range;
  const rangeOption = RANGE_OPTIONS.find((o) => o.value === rangeValue)!;
  const setRange = (value: RangeChoice) => (value === 'odd' || value === 'even' ? update({ parity: value, range: 'all' }) : update({ range: value, parity: 'all' }));
  const sheetsUsed = physicalSheets(fullRun, settings.sides);
  const paperValue = settings.customPaper ? CUSTOM_PAPER : settings.paper;
  const paperSize = settings.customPaper ?? PAPERS[settings.paper];
  const orientationOption = ORIENTATION_OPTIONS.find((o) => o.value === settings.orientation)!;
  const busy = phase === 'preparing';
  const notes = [...printerNotes(resolved, settings.sides, platform), ...(autoNotes ?? []), ...plan.notes];
  const direct = target.kind !== 'system';

  const sidesOptions: CardOption<PrintSettings['sides']>[] = [
    { value: 'one', title: 'In một mặt', subtitle: 'Chỉ in một mặt của tờ giấy', icon: <File size={20} /> },
    { value: 'manual', title: 'In hai mặt thủ công', subtitle: 'In mặt trước, lật giấy theo hướng dẫn rồi in mặt sau', icon: <BookOpen size={20} /> },
    { value: 'auto', title: 'In hai mặt tự động', subtitle: target.kind === 'printer' ? 'Máy in có bộ đảo mặt tự in mặt sau' : 'Bật "In hai mặt" ở bước kế tiếp (máy in có đảo mặt)', icon: <Copy size={20} /> },
  ];
  const collateOptions: CardOption<'yes' | 'no'>[] = [
    { value: 'yes', title: 'Theo bộ', subtitle: '1,2,3   1,2,3   1,2,3', icon: <Layers size={20} /> },
    { value: 'no', title: 'Không theo bộ', subtitle: '1,1,1   2,2,2   3,3,3', icon: <Layers size={20} /> },
  ];

  const printLabel = busy
    ? pendingLeft ? `Đang chuẩn bị ${pendingLeft} trang…` : 'Đang mở…'
    : phase === 'flip' ? 'In mặt sau' : target.kind === 'pdf' ? 'Lưu PDF' : 'In';

  return (
    <div className="dialog-backdrop mp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && (phase === 'idle' || phase === 'done') && onClose()}>
      <section className="mp-dialog" role="dialog" aria-modal="true" aria-label="In">
        <aside className="mp-settings">
          <header className="mp-head">
            <div className="mp-head-text">
              <h2>In</h2>
              <span className="mp-file" title={source.title}>{source.title}</span>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
          </header>

          <div className="mp-scroll">
            <div className="mp-print-row">
              <button className="mp-print-big" onClick={startPrint} disabled={busy || phase === 'waiting' || phase === 'done' || !outputs.length || source.loading}>
                {busy ? <Loader2 size={28} className="mp-spin" /> : <Printer size={28} />}
                <span>{printLabel}</span>
              </button>
              <div className="mp-print-meta">
                <label className="mp-copies">
                  <span>Số bản</span>
                  <input className="text-field" type="number" min={1} max={999} value={settings.copies} onChange={(e) => update({ copies: Math.max(1, Math.min(999, Math.floor(Number(e.target.value)) || 1)) })} />
                </label>
                <span className="mp-summary">{source.loading ? 'Đang dựng bản xem trước…' : `${sheetsUsed} tờ giấy · ${outputs.length} mặt in`}</span>
              </div>
            </div>

            {phase === 'flip' && (
              <div className="mp-notice">
                <strong>Đã in xong mặt trước</strong>
                <span>Lấy xấp giấy vừa in, giữ nguyên thứ tự, lật mặt và đặt lại vào khay giấy. Sau đó bấm "In mặt sau".</span>
                <label className="mp-check"><input type="checkbox" checked={settings.reverseBack} onChange={(e) => update({ reverseBack: e.target.checked })} /><span>In mặt sau theo thứ tự ngược</span></label>
              </div>
            )}
            {notice && (
              <div className={`mp-notice ${notice.tone === 'error' ? 'is-error' : 'is-ok'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
                <strong>{notice.title}</strong>
                <span>{notice.text}</span>
                {phase === 'done' && <button className="btn" onClick={onClose}>Xong</button>}
              </div>
            )}
            {phase === 'waiting' && (
              <div className="mp-notice">
                <span>Hộp thoại in của macOS đang mở. Chọn máy in rồi bấm In.</span>
                <button className="btn" onClick={onClose}>Xong</button>
              </div>
            )}

            <PrinterPicker platform={platform} printers={printers} resolved={resolved} scanning={scanning} onChange={choosePrinter} onRefresh={refresh} />

            <section className="mp-group">
              <h3>Thiết lập</h3>
              <OptionCard label="Phạm vi in" icon={<Files size={20} />} title={rangeOption.title} subtitle={rangeOption.subtitle} options={RANGE_OPTIONS} value={rangeValue} onChange={setRange} />
              <label className="mp-inline-field">
                <span>Trang:</span>
                <input className="text-field" value={settings.pageRange} placeholder={`1-${plan.sheets.length}`} onChange={(e) => update({ pageRange: e.target.value, range: e.target.value.trim() ? 'custom' : 'all', parity: 'all' })} />
              </label>
              <OptionCard label="In một hay hai mặt" icon={<File size={20} />} title={sidesOptions.find((o) => o.value === settings.sides)!.title} subtitle={sidesOptions.find((o) => o.value === settings.sides)!.subtitle} options={sidesOptions} value={settings.sides} onChange={(sides) => update({ sides })} />
              <OptionCard label="Thứ tự bản in" icon={<Layers size={20} />} title={settings.collate || manual ? 'Theo bộ' : 'Không theo bộ'} subtitle={settings.collate || manual ? '1,2,3   1,2,3   1,2,3' : '1,1,1   2,2,2   3,3,3'} options={collateOptions} value={settings.collate || manual ? 'yes' : 'no'} onChange={(v) => update({ collate: v === 'yes' })} disabled={manual} />
              {cards?.orientation ?? (
                <OptionCard label="Hướng giấy" icon={settings.orientation === 'landscape' ? <RectangleHorizontal size={20} /> : settings.orientation === 'auto' ? <Maximize2 size={20} /> : <RectangleVertical size={20} />} title={orientationOption.title} subtitle={orientationOption.subtitle} options={ORIENTATION_OPTIONS} value={settings.orientation} onChange={(orientation) => update({ orientation })} />
              )}
              {cards?.paper ?? (
                <>
                  <OptionCard
                    label="Khổ giấy"
                    icon={<File size={20} />}
                    title={settings.customPaper ? 'Khổ tùy chỉnh' : PAPER_CATALOG[settings.paper].name}
                    subtitle={paperSubtitle(paperSize.w, paperSize.h)}
                    options={PAPER_OPTIONS}
                    value={paperValue}
                    onChange={(value) => (value === CUSTOM_PAPER ? update({ customPaper: settings.customPaper ?? { w: 210, h: 297 } }) : update({ paper: value as PaperKey, customPaper: null }))}
                  />
                  {settings.customPaper && (
                    <div className="mp-margin-grid">
                      <CmField label="Rộng" mm={settings.customPaper.w} max={120} onChange={(w) => update({ customPaper: { ...settings.customPaper!, w: Math.max(50, w) } })} />
                      <CmField label="Cao" mm={settings.customPaper.h} max={120} onChange={(h) => update({ customPaper: { ...settings.customPaper!, h: Math.max(50, h) } })} />
                    </div>
                  )}
                </>
              )}
              {cards?.margins ?? <MarginControls settings={settings} update={update} kind={source.kind} />}
              <OptionCard label="Số trang mỗi tờ" icon={<LayoutGrid size={20} />} title={`${settings.pagesPerSheet} trang mỗi tờ`} subtitle={PER_SHEET_OPTIONS.find((o) => o.value === settings.pagesPerSheet)?.subtitle} options={PER_SHEET_OPTIONS} value={settings.pagesPerSheet} onChange={(pagesPerSheet) => update({ pagesPerSheet })} />
              <button type="button" className="mp-link" onClick={() => (onPageSetup ? onPageSetup() : setAdvanced((v) => !v))}>{onPageSetup ? 'Thiết lập trang' : advanced ? 'Ẩn thiết lập trang' : 'Thiết lập trang'}</button>
            </section>

            {(advanced || onPageSetup) && (
              <section className="mp-group">
                <h3>Thiết lập trang</h3>
                {!source.fixedPaper && (
                  <>
                    <label className="mp-field">
                      <span>Co giãn nội dung</span>
                      <select className="text-field" value={settings.scaleMode} onChange={(e) => update({ scaleMode: e.target.value as ScaleMode })}>
                        {(Object.keys(SCALE_LABELS) as ScaleMode[]).map((key) => <option key={key} value={key}>{SCALE_LABELS[key]}</option>)}
                      </select>
                    </label>
                    {settings.scaleMode === 'custom' && (
                      <label className="mp-field">
                        <span>Phần trăm (10–400)</span>
                        <input className="text-field" type="number" min={10} max={400} step={5} value={settings.customScale} onChange={(e) => update({ customScale: Math.min(400, Math.max(10, Number(e.target.value) || 100)) })} />
                      </label>
                    )}
                    <div className="mp-field">
                      <span>Căn giữa trên trang</span>
                      <div className="mp-checks">
                        <label className="mp-check"><input type="checkbox" checked={settings.centerH} onChange={(e) => update({ centerH: e.target.checked })} /><span>Theo chiều ngang</span></label>
                        <label className="mp-check"><input type="checkbox" checked={settings.centerV} onChange={(e) => update({ centerV: e.target.checked })} disabled={source.flowsVertically} /><span>Theo chiều dọc</span></label>
                      </div>
                    </div>
                  </>
                )}
                <div className="mp-checks">
                  {!source.fixedPaper && <label className="mp-check"><input type="checkbox" checked={settings.pageNumbers} onChange={(e) => update({ pageNumbers: e.target.checked })} /><span>Số trang ở chân trang</span></label>}
                  {!source.fixedPaper && <label className="mp-check"><input type="checkbox" checked={settings.showTitle} onChange={(e) => update({ showTitle: e.target.checked })} /><span>Tên tệp ở đầu trang</span></label>}
                  {!source.fixedPaper && <label className="mp-check"><input type="checkbox" checked={settings.showDate} onChange={(e) => update({ showDate: e.target.checked })} /><span>Ngày in ở đầu trang</span></label>}
                  {source.kind === 'slide' && <label className="mp-check"><input type="checkbox" checked={settings.frame} onChange={(e) => update({ frame: e.target.checked })} /><span>Viền quanh trang chiếu</span></label>}
                  <label className="mp-check"><input type="checkbox" checked={settings.grayscale} onChange={(e) => update({ grayscale: e.target.checked })} /><span>In đen trắng</span></label>
                </div>
              </section>
            )}

            {extraOptions && <section className="mp-group">{extraOptions}</section>}

            {notes.length > 0 && (
              <section className="mp-group mp-notes" aria-live="polite">
                <h3>Đã tự căn chỉnh</h3>
                <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
              </section>
            )}

            <p className="mp-hint">
              {direct
                ? target.kind === 'pdf'
                  ? 'Bấm Lưu PDF là ghi thẳng ra tệp, đúng khổ giấy và lề như bản xem trước.'
                  : `Bấm In là gửi thẳng tới “${resolved.printer?.displayName ?? 'máy in'}”, không mở thêm hộp thoại. Cần chỉnh khay giấy hay chất lượng in thì chọn Hộp thoại in của hệ thống.`
                : platform === 'mac'
                  ? 'Máy in và in hai mặt tự động chọn trong hộp thoại in của macOS.'
                  : 'Ở bước kế tiếp, để Lề là Mặc định hoặc Không có và Tỉ lệ là 100% để bản in đúng như xem trước.'}
            </p>
          </div>
        </aside>

        <div className="mp-preview">
          <div className="mp-stage" ref={(el) => { fitRef.current = el; setStage(el); }}>
            {source.loading && <div className="mp-empty"><Loader2 size={20} className="mp-spin" /> Đang dựng bản xem trước…</div>}
            {!source.loading && !outputs.length && <div className="mp-empty">Không có trang nào khớp phạm vi đã chọn.</div>}
            {!source.loading && outputs.length > 0 && (
              <div className="mp-pages" style={{ gap: PAGE_GAP_PX }}>
                {outputs.map((page, i) => (
                  <LazyPage key={page.key} index={i} root={stage} width={mmToPx(page.paper.w) * scale} height={mmToPx(page.paper.h) * scale} onVisible={onVisible}>
                    <div className="mp-paper-scaler" style={{ transform: `scale(${scale})` }}>
                      <OutputPageView page={page} ctx={ctx} guides={guides} />
                    </div>
                  </LazyPage>
                ))}
              </div>
            )}
          </div>
          <footer className="mp-preview-bar">
            <div className="mp-nav">
              <button className="icon-btn" aria-label="Trang trước" disabled={current <= 0} onClick={() => scrollToPage(current - 1)}><ChevronLeft size={18} /></button>
              <input className="text-field mp-page-input" aria-label="Trang đang xem" value={outputs.length ? current + 1 : 0} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= outputs.length) scrollToPage(n - 1); }} />
              <span>trên {outputs.length}</span>
              <button className="icon-btn" aria-label="Trang sau" disabled={current >= outputs.length - 1} onClick={() => scrollToPage(current + 1)}><ChevronRight size={18} /></button>
            </div>
            <div className="mp-zoom">
              <label className="mp-check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /><span>Đường lề</span></label>
              <span className="mp-zoom-value">{zoomPercent}%</span>
              <button className="icon-btn" aria-label="Thu nhỏ" onClick={() => setZoom(Math.max(ZOOM_MIN, zoomPercent - 10))}>−</button>
              <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} value={zoomPercent} aria-label="Thu phóng" onChange={(e) => setZoom(Number(e.target.value))} />
              <button className="icon-btn" aria-label="Phóng to" onClick={() => setZoom(Math.min(ZOOM_MAX, zoomPercent + 10))}>+</button>
              <button className="icon-btn" aria-label="Vừa trang" title="Vừa trang" onClick={() => setZoom(null)}><Maximize2 size={16} /></button>
            </div>
          </footer>
        </div>
      </section>
      {(phase === 'preparing' || phase === 'waiting' || (phase === 'flip' && platform === 'mac')) && <PrintPortal run={run} ctx={ctx} />}
    </div>
  );
}
