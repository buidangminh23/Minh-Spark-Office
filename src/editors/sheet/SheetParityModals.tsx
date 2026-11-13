import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronsDown, ChevronsUp, Download, Languages, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { CHART_KINDS, CHART_PALETTES, type ChartKind } from '../doc/insertCharts';
import { renderChart } from '../doc/chartRender';
import { LANGUAGES, runAi, translateText } from '../doc/ai';
import {
  evaluateFormulaSteps,
  pivotChartRaw,
  recommendChartKinds,
  valuesToChartRaw,
  type ErrorCheckIssue,
  type FormulaStep,
  type PivotAgg,
  type Scenario,
  type SpellingIssue,
} from './excelParity';
import type { SheetHeaderFooter } from '../../lib/storage';

const CHART_PIXEL_RATIO = 2;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 420;

export function ParityDialog({ title, subtitle, width = 560, onClose, children, actions }: { title: string; subtitle?: string; width?: number; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width, maxWidth: 'calc(100vw - 32px)' }} role="dialog" aria-label={title}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {subtitle && <div className="dialog-subtitle">{subtitle}</div>}
        {children}
        <div className="dialog-actions">{actions ?? <button className="btn" onClick={onClose}>Đóng</button>}</div>
      </section>
    </div>
  );
}

export type ChartGalleryMode = 'all' | 'recommended' | 'pivot';

function ChartCanvas({ kind, raw, title, palette, mini }: { kind: ChartKind; raw: string; title: string; palette: string; mini?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const width = mini ? 132 : CHART_WIDTH;
  const height = mini ? 84 : CHART_HEIGHT;
  useEffect(() => {
    if (!ref.current) return;
    renderChart(ref.current, { kind, title: mini ? '' : title, raw, palette, legend: true, labels: false, grid: true }, { mini });
  }, [kind, raw, title, palette, mini]);
  const scale = mini ? 1 : CHART_PIXEL_RATIO;
  return <canvas ref={ref} width={width * scale} height={height * scale} style={{ width, height, display: 'block', maxWidth: '100%' }} />;
}

export function ChartGalleryModal({
  mode,
  initialKind,
  initialRange,
  readRangeValues,
  onEmbed,
  onDownload,
  onClose,
}: {
  mode: ChartGalleryMode;
  initialKind?: ChartKind;
  initialRange: string;
  readRangeValues: (rangeA1: string) => unknown[][];
  onEmbed: (pngDataUrl: string, title: string, widthPx: number, heightPx: number) => Promise<void>;
  onDownload: (pngDataUrl: string, title: string) => void;
  onClose: () => void;
}) {
  const [rangeText, setRangeText] = useState(initialRange);
  const values = useMemo(() => readRangeValues(rangeText), [rangeText, readRangeValues]);
  const headers = useMemo(() => (values[0] ?? []).map((cell, i) => (cell === null || cell === undefined || cell === '' ? `Cột ${i + 1}` : String(cell))), [values]);
  const recommended = useMemo(() => recommendChartKinds(values), [values]);
  const [kind, setKind] = useState<ChartKind>(initialKind ?? (mode === 'recommended' ? recommended[0] : mode === 'pivot' ? 'column' : 'column'));
  const [palette, setPalette] = useState(CHART_PALETTES[0].id);
  const [title, setTitle] = useState('Biểu đồ');
  const [pivotCategory, setPivotCategory] = useState(0);
  const [pivotValue, setPivotValue] = useState(Math.min(1, Math.max(0, headers.length - 1)));
  const [pivotAgg, setPivotAgg] = useState<PivotAgg>('sum');
  const [busy, setBusy] = useState(false);
  const raw = useMemo(
    () => (mode === 'pivot' ? pivotChartRaw(values, pivotCategory, [pivotValue], pivotAgg) : valuesToChartRaw(values)),
    [mode, values, pivotCategory, pivotValue, pivotAgg]
  );
  const kinds = mode === 'recommended' ? CHART_KINDS.filter((item) => recommended.includes(item.id)) : CHART_KINDS;
  const groups = useMemo(() => [...new Set(kinds.map((item) => item.group))], [kinds]);

  const toPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = CHART_WIDTH * CHART_PIXEL_RATIO;
    canvas.height = CHART_HEIGHT * CHART_PIXEL_RATIO;
    renderChart(canvas, { kind, title, raw, palette, legend: true, labels: false, grid: true });
    return canvas.toDataURL('image/png');
  };

  const embed = async () => {
    setBusy(true);
    try {
      await onEmbed(toPng(), title, 520, 304);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'recommended' ? 'Biểu đồ đề xuất' : mode === 'pivot' ? 'PivotChart: biểu đồ tổng hợp' : 'Chèn biểu đồ';
  return (
    <ParityDialog
      title={heading}
      subtitle={mode === 'recommended' ? '23 Sheets đọc hình dạng dữ liệu rồi gợi ý loại biểu đồ phù hợp nhất.' : 'Chọn loại biểu đồ, xem trước rồi nhúng vào trang tính.'}
      width={980}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn" disabled={busy || !raw} onClick={() => onDownload(toPng(), title)}><Download size={14} /><span>Tải PNG</span></button>
          <button className="btn btn-sheet" disabled={busy || !raw} onClick={() => void embed()}><Plus size={14} /><span>{busy ? 'Đang chèn…' : 'Chèn vào trang tính'}</span></button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, minHeight: 440 }}>
        <div style={{ overflowY: 'auto', maxHeight: 500, borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
          {groups.map((group) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '6px 0 4px' }}>{group}</div>
              {kinds.filter((item) => item.group === group).map((item) => (
                <button key={item.id} className={`sheet-popover-item ${kind === item.id ? 'active' : ''}`} style={{ width: '100%', background: kind === item.id ? '#e8f5ee' : undefined }} onClick={() => setKind(item.id)}>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 8, marginBottom: 10 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Vùng dữ liệu</span>
              <input className="text-field" value={rangeText} onChange={(e) => setRangeText(e.target.value.toUpperCase())} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Tiêu đề</span>
              <input className="text-field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Bảng màu</span>
              <select className="text-field" value={palette} onChange={(e) => setPalette(e.target.value)}>
                {CHART_PALETTES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
          {mode === 'pivot' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Nhóm theo (trục)</span>
                <select className="text-field" value={pivotCategory} onChange={(e) => setPivotCategory(Number(e.target.value))}>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Giá trị</span>
                <select className="text-field" value={pivotValue} onChange={(e) => setPivotValue(Number(e.target.value))}>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Hàm tổng hợp</span>
                <select className="text-field" value={pivotAgg} onChange={(e) => setPivotAgg(e.target.value as PivotAgg)}>
                  <option value="sum">Tổng (SUM)</option>
                  <option value="count">Đếm (COUNT)</option>
                  <option value="average">Trung bình</option>
                  <option value="max">Lớn nhất</option>
                  <option value="min">Nhỏ nhất</option>
                </select>
              </label>
            </div>
          )}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', display: 'flex', justifyContent: 'center', padding: 6 }}>
            {raw ? <ChartCanvas kind={kind} raw={raw} title={title} palette={palette} /> : <div style={{ padding: 60, color: '#64748b' }}>Vùng dữ liệu chưa có số liệu để vẽ.</div>}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>Dạng dữ liệu: {CHART_KINDS.find((item) => item.id === kind)?.hint}</div>
        </div>
      </div>
    </ParityDialog>
  );
}

export type SparklineKind = 'line' | 'column' | 'winloss';

export function renderSparkline(values: number[], kind: SparklineKind, color: string, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx || !values.length) return canvas.toDataURL('image/png');
  ctx.scale(2, 2);
  const pad = 3;
  const min = Math.min(0, ...values);
  const max = Math.max(...values, min + 1e-9);
  const y = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad * 2);
  const step = (width - pad * 2) / Math.max(1, kind === 'line' ? values.length - 1 : values.length);
  if (kind === 'line') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(pad + i * step, y(v)) : ctx.moveTo(pad, y(v))));
    ctx.stroke();
    const hi = values.indexOf(Math.max(...values));
    const lo = values.indexOf(Math.min(...values));
    [[hi, '#16a34a'], [lo, '#dc2626']].forEach(([i, fill]) => {
      ctx.fillStyle = fill as string;
      ctx.beginPath();
      ctx.arc(pad + (i as number) * step, y(values[i as number]), 2, 0, Math.PI * 2);
      ctx.fill();
    });
    return canvas.toDataURL('image/png');
  }
  const mid = height / 2;
  values.forEach((v, i) => {
    const x = pad + i * step + step * 0.15;
    const w = step * 0.7;
    if (kind === 'winloss') {
      ctx.fillStyle = v >= 0 ? color : '#dc2626';
      ctx.fillRect(x, v >= 0 ? pad : mid, w, mid - pad);
      return;
    }
    ctx.fillStyle = v < 0 ? '#dc2626' : color;
    const top = y(Math.max(v, 0));
    ctx.fillRect(x, top, w, Math.max(1, y(Math.min(v, 0)) - top));
  });
  return canvas.toDataURL('image/png');
}

export function SparklineModal({ initialKind, initialData, initialLocation, onInsert, onClose }: { initialKind: SparklineKind; initialData: string; initialLocation: string; onInsert: (kind: SparklineKind, dataRange: string, location: string, color: string) => Promise<string>; onClose: () => void }) {
  const [kind, setKind] = useState(initialKind);
  const [data, setData] = useState(initialData);
  const [location, setLocation] = useState(initialLocation);
  const [color, setColor] = useState('#2563eb');
  const [message, setMessage] = useState('');
  return (
    <ParityDialog
      title="Tạo Sparkline"
      subtitle="Biểu đồ mini trong từng ô: mỗi dòng của vùng dữ liệu thành một sparkline ở ô tương ứng của vùng đặt."
      width={480}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-sheet" onClick={() => void onInsert(kind, data, location, color).then(setMessage)}><Check size={14} /><span>Tạo</span></button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Kiểu</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['line', 'Đường (Line)'], ['column', 'Cột (Column)'], ['winloss', 'Thắng/Thua']] as const).map(([id, label]) => (
            <button key={id} className={`btn ${kind === id ? 'btn-sheet' : ''}`} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
      </div>
      <label className="field"><span className="field-label">Vùng dữ liệu</span><input className="text-field" value={data} onChange={(e) => setData(e.target.value.toUpperCase())} /></label>
      <label className="field"><span className="field-label">Vùng đặt sparkline (một cột)</span><input className="text-field" value={location} onChange={(e) => setLocation(e.target.value.toUpperCase())} /></label>
      <label className="field"><span className="field-label">Màu</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      {message && <div className="parity-note">{message}</div>}
    </ParityDialog>
  );
}

export function ScenarioManagerModal({
  scenarios,
  activeRange,
  readCell,
  onSave,
  onShow,
  onSummary,
  onClose,
}: {
  scenarios: Scenario[];
  activeRange: string;
  readCell: (a1: string) => string;
  onSave: (next: Scenario[]) => void;
  onShow: (scenario: Scenario) => void;
  onSummary: (resultCells: string[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState(scenarios);
  const [selected, setSelected] = useState<string | null>(scenarios[0]?.id ?? null);
  const [draft, setDraft] = useState<{ name: string; cells: string; values: string; comment: string } | null>(null);
  const [resultCells, setResultCells] = useState('');
  const commit = (next: Scenario[]) => {
    setList(next);
    onSave(next);
  };
  const startAdd = () => {
    const cells = activeRange.includes(':') ? expandRange(activeRange) : [activeRange];
    setDraft({ name: `Kịch bản ${list.length + 1}`, cells: cells.join(','), values: cells.map(readCell).join(';'), comment: '' });
  };
  const saveDraft = () => {
    if (!draft) return;
    const cells = draft.cells.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const values = draft.values.split(';');
    const scenario: Scenario = { id: crypto.randomUUID(), name: draft.name.trim() || 'Kịch bản', comment: draft.comment, cells: cells.map((a1, i) => ({ a1, value: (values[i] ?? '').trim() })) };
    commit([...list, scenario]);
    setSelected(scenario.id);
    setDraft(null);
  };
  const current = list.find((item) => item.id === selected) ?? null;
  return (
    <ParityDialog title="Trình quản lý kịch bản (Scenario Manager)" subtitle="Lưu nhiều bộ giá trị đầu vào, bấm Hiện để thay vào ô, hoặc lập bảng tóm tắt so sánh kết quả." width={620} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, minHeight: 180, maxHeight: 260, overflowY: 'auto' }}>
          {list.length === 0 && <div style={{ padding: 12, color: '#64748b', fontSize: 12 }}>Chưa có kịch bản nào.</div>}
          {list.map((item) => (
            <button key={item.id} className="sheet-popover-item" style={{ width: '100%', background: item.id === selected ? '#e8f5ee' : undefined }} onClick={() => setSelected(item.id)}>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div>
          {draft ? (
            <>
              <label className="field"><span className="field-label">Tên kịch bản</span><input className="text-field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label className="field"><span className="field-label">Ô thay đổi (cách nhau dấu phẩy)</span><input className="text-field" value={draft.cells} onChange={(e) => setDraft({ ...draft, cells: e.target.value })} /></label>
              <label className="field"><span className="field-label">Giá trị (cách nhau dấu chấm phẩy)</span><input className="text-field" value={draft.values} onChange={(e) => setDraft({ ...draft, values: e.target.value })} /></label>
              <label className="field"><span className="field-label">Ghi chú</span><input className="text-field" value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} /></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sheet" onClick={saveDraft}>Lưu kịch bản</button>
                <button className="btn" onClick={() => setDraft(null)}>Huỷ</button>
              </div>
            </>
          ) : (
            <>
              {current && (
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}>
                  {current.cells.map((cell) => <div key={cell.a1}>{cell.a1} = <strong>{cell.value}</strong></div>)}
                  {current.comment && <div style={{ color: '#64748b', marginTop: 4 }}>{current.comment}</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={startAdd}><Plus size={14} /><span>Thêm</span></button>
                <button className="btn" disabled={!current} onClick={() => current && onShow(current)}>Hiện</button>
                <button className="btn" disabled={!current} onClick={() => current && commit(list.filter((item) => item.id !== current.id))}><Trash2 size={14} /><span>Xoá</span></button>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span className="field-label">Ô kết quả cho bảng tóm tắt (vd: E8,E9)</span>
                <input className="text-field" value={resultCells} onChange={(e) => setResultCells(e.target.value.toUpperCase())} />
              </label>
              <button className="btn btn-sheet" disabled={!list.length || !resultCells.trim()} onClick={() => onSummary(resultCells.split(',').map((s) => s.trim()).filter(Boolean))}>Lập bảng tóm tắt</button>
            </>
          )}
        </div>
      </div>
    </ParityDialog>
  );
}

const letterToIndex = (letters: string) => letters.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const indexToLetter = (index: number) => {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

export function expandRange(a1: string): string[] {
  const match = a1.toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return [a1.toUpperCase()];
  const [, c1, r1, c2, r2] = match;
  const cells: string[] = [];
  for (let r = Number(r1); r <= Number(r2); r++) for (let c = letterToIndex(c1); c <= letterToIndex(c2); c++) cells.push(`${indexToLetter(c)}${r}`);
  return cells.slice(0, 32);
}

export function ForecastSheetModal({ initialRange, onCreate, onClose }: { initialRange: string; onCreate: (options: { range: string; periods: number; confidence: number; seasonality: number }) => Promise<string>; onClose: () => void }) {
  const [range, setRange] = useState(initialRange);
  const [periods, setPeriods] = useState(6);
  const [confidence, setConfidence] = useState(95);
  const [seasonality, setSeasonality] = useState(1);
  const [message, setMessage] = useState('');
  return (
    <ParityDialog
      title="Tạo trang dự báo (Forecast Sheet)"
      subtitle="Chọn 2 cột: mốc thời gian (ngày hoặc số tăng đều) và giá trị. 23 Sheets dùng FORECAST.ETS như Excel."
      width={480}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-sheet" onClick={() => void onCreate({ range, periods, confidence: confidence / 100, seasonality }).then(setMessage)}><Sparkles size={14} /><span>Tạo</span></button>
        </>
      }
    >
      <label className="field"><span className="field-label">Vùng dữ liệu (có dòng tiêu đề)</span><input className="text-field" value={range} onChange={(e) => setRange(e.target.value.toUpperCase())} /></label>
      <label className="field"><span className="field-label">Số kỳ dự báo</span><input className="text-field" type="number" min={1} max={500} value={periods} onChange={(e) => setPeriods(Math.max(1, Number(e.target.value) || 1))} /></label>
      <label className="field"><span className="field-label">Khoảng tin cậy (%)</span><input className="text-field" type="number" min={50} max={99} value={confidence} onChange={(e) => setConfidence(Math.min(99, Math.max(50, Number(e.target.value) || 95)))} /></label>
      <label className="field">
        <span className="field-label">Tính mùa vụ</span>
        <select className="text-field" value={seasonality} onChange={(e) => setSeasonality(Number(e.target.value))}>
          <option value={1}>Tự phát hiện</option>
          <option value={0}>Không có mùa vụ</option>
          {[4, 7, 12, 24, 52].map((n) => <option key={n} value={n}>{n} kỳ</option>)}
        </select>
      </label>
      {message && <div className="parity-note">{message}</div>}
    </ParityDialog>
  );
}

export function EvaluateFormulaModal({ cellA1, formula, resolve, result, onClose }: { cellA1: string; formula: string; resolve: (ref: string) => unknown; result: unknown; onClose: () => void }) {
  const steps: FormulaStep[] = useMemo(() => (formula ? evaluateFormulaSteps(formula, resolve, result) : []), [formula, resolve, result]);
  const [index, setIndex] = useState(0);
  return (
    <ParityDialog
      title="Đánh giá công thức (Evaluate Formula)"
      subtitle={`Ô ${cellA1}: thay từng tham chiếu bằng giá trị thật để thấy công thức tính ra kết quả thế nào.`}
      width={620}
      onClose={onClose}
      actions={
        <>
          <button className="btn" disabled={index === 0} onClick={() => setIndex(0)}>Làm lại</button>
          <button className="btn btn-sheet" disabled={index >= steps.length - 1} onClick={() => setIndex(index + 1)}>Đánh giá bước tiếp</button>
          <button className="btn" onClick={onClose}>Đóng</button>
        </>
      }
    >
      {!formula && <div className="parity-note">Ô đang chọn không có công thức.</div>}
      {steps.slice(0, index + 1).map((step, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>{i + 1}. {step.label}</div>
          <code style={{ display: 'block', padding: '6px 10px', background: i === index ? '#ecfdf5' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, wordBreak: 'break-all' }}>{step.expression}</code>
        </div>
      ))}
    </ParityDialog>
  );
}

const ERROR_KIND_LABEL: Record<ErrorCheckIssue['kind'], string> = {
  'error-value': 'Giá trị lỗi',
  'number-as-text': 'Số lưu dạng văn bản',
  'inconsistent-formula': 'Công thức không nhất quán',
  'empty-reference': 'Tham chiếu ô trống',
  'unlocked-formula': 'Công thức chưa khoá',
};

export function ErrorCheckingModal({ issues, onGoTo, onConvertNumber, onEvaluate, onClose }: { issues: ErrorCheckIssue[]; onGoTo: (issue: ErrorCheckIssue) => void; onConvertNumber: (issue: ErrorCheckIssue) => void; onEvaluate: (issue: ErrorCheckIssue) => void; onClose: () => void }) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const visible = issues.filter((issue) => !ignored.has(`${issue.a1}:${issue.kind}`));
  const [index, setIndex] = useState(0);
  const issue = visible[Math.min(index, visible.length - 1)];
  useEffect(() => {
    if (issue) onGoTo(issue);
  }, [issue, onGoTo]);
  return (
    <ParityDialog title="Kiểm tra lỗi (Error Checking)" subtitle={`Tìm thấy ${visible.length} vấn đề trên trang tính.`} width={540} onClose={onClose}>
      {!issue && <div className="parity-note">Không còn lỗi nào. Trang tính sạch.</div>}
      {issue && (
        <>
          <div style={{ fontWeight: 700 }}>{issue.a1} · {ERROR_KIND_LABEL[issue.kind]}</div>
          {issue.formula && <code style={{ display: 'block', margin: '6px 0', padding: '4px 8px', background: '#f8fafc', borderRadius: 6 }}>{issue.formula}</code>}
          <div style={{ fontSize: 13, color: '#334155', marginBottom: 10 }}>{issue.message}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {issue.kind === 'number-as-text' && <button className="btn btn-sheet" onClick={() => onConvertNumber(issue)}>Chuyển thành số</button>}
            {issue.formula && <button className="btn" onClick={() => onEvaluate(issue)}>Xem các bước tính</button>}
            <button className="btn" onClick={() => setIgnored(new Set([...ignored, `${issue.a1}:${issue.kind}`]))}>Bỏ qua lỗi</button>
            <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowUp size={14} /><span>Trước</span></button>
            <button className="btn" disabled={index >= visible.length - 1} onClick={() => setIndex(index + 1)}><ArrowDown size={14} /><span>Tiếp</span></button>
          </div>
        </>
      )}
    </ParityDialog>
  );
}

export function SpellingModal({ issues, onGoTo, onApply, onClose }: { issues: SpellingIssue[]; onGoTo: (issue: SpellingIssue) => void; onApply: (issue: SpellingIssue, all: boolean) => void; onClose: () => void }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const pending = issues.map((issue, i) => ({ issue, i })).filter(({ i }) => !done.has(i));
  const head = pending[0];
  useEffect(() => {
    if (head) onGoTo(head.issue);
  }, [head, onGoTo]);
  const finish = (all: boolean) => {
    if (!head) return;
    if (head.issue.fixed !== null) onApply(head.issue, all);
    const same = all ? pending.filter(({ issue }) => issue.text.toLowerCase() === head.issue.text.toLowerCase()).map(({ i }) => i) : [head.i];
    setDone(new Set([...done, ...same]));
  };
  const skip = (all: boolean) => {
    if (!head) return;
    const same = all ? pending.filter(({ issue }) => issue.text.toLowerCase() === head.issue.text.toLowerCase()).map(({ i }) => i) : [head.i];
    setDone(new Set([...done, ...same]));
  };
  return (
    <ParityDialog title="Chính tả (Spelling)" subtitle="Kiểm tra lỗi chính tả, lặp từ và dấu câu trong các ô chữ của trang tính." width={520} onClose={onClose}>
      {!head && <div className="parity-note">Đã kiểm tra xong chính tả của toàn trang tính.</div>}
      {head && (
        <>
          <div style={{ fontSize: 12, color: '#64748b' }}>Ô {head.issue.a1} · còn {pending.length} mục</div>
          <div style={{ margin: '6px 0', fontSize: 14 }}><strong style={{ color: '#dc2626' }}>{head.issue.text}</strong> — {head.issue.message}</div>
          {head.issue.suggestion !== null && <div style={{ marginBottom: 10 }}>Gợi ý: <strong>{head.issue.suggestion || '(xoá)'}</strong></div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-sheet" disabled={head.issue.fixed === null} onClick={() => finish(false)}>Sửa</button>
            <button className="btn" disabled={head.issue.fixed === null} onClick={() => finish(true)}>Sửa tất cả</button>
            <button className="btn" onClick={() => skip(false)}>Bỏ qua một lần</button>
            <button className="btn" onClick={() => skip(true)}>Bỏ qua tất cả</button>
          </div>
        </>
      )}
    </ParityDialog>
  );
}

const LOCAL_SYNONYMS: Record<string, string[]> = {
  'tăng': ['gia tăng', 'tăng thêm', 'nâng', 'tăng lên'],
  'giảm': ['hạ', 'sụt', 'giảm bớt', 'thu hẹp'],
  'doanh thu': ['thu nhập', 'doanh số', 'tiền thu'],
  'chi phí': ['phí tổn', 'chi tiêu', 'kinh phí'],
  'lợi nhuận': ['lãi', 'tiền lời', 'lợi tức'],
  'khách hàng': ['người mua', 'bên mua', 'đối tác'],
  'nhanh': ['mau', 'lẹ', 'gấp'],
  'tốt': ['hay', 'tuyệt', 'tốt đẹp', 'chất lượng'],
  'lớn': ['to', 'rộng', 'đồ sộ'],
  'nhỏ': ['bé', 'nhỏ bé', 'hẹp'],
  'increase': ['rise', 'grow', 'boost'],
  'decrease': ['reduce', 'drop', 'decline'],
  'revenue': ['income', 'sales', 'turnover'],
  'cost': ['expense', 'expenditure', 'charge'],
};

export function ThesaurusModal({ initialWord, onReplace, onClose }: { initialWord: string; onReplace: (word: string) => void; onClose: () => void }) {
  const [word, setWord] = useState(initialWord);
  const [results, setResults] = useState<string[]>(LOCAL_SYNONYMS[initialWord.trim().toLowerCase()] ?? []);
  const [status, setStatus] = useState('');
  const lookup = async () => {
    const key = word.trim().toLowerCase();
    if (!key) return;
    const local = LOCAL_SYNONYMS[key] ?? [];
    setResults(local);
    setStatus('Đang tra từ đồng nghĩa…');
    try {
      const text = await runAi('custom', key, 'List up to 12 synonyms of this word or phrase in the same language. One per line, no numbering, no explanation.', () => undefined, new AbortController().signal);
      const extra = text.split('\n').map((s) => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
      setResults([...new Set([...local, ...extra])].slice(0, 16));
      setStatus('');
    } catch (error) {
      setStatus(local.length ? '' : error instanceof Error ? error.message : 'Không tra được.');
    }
  };
  return (
    <ParityDialog title="Từ đồng nghĩa (Thesaurus)" width={440} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="text-field" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void lookup()} />
        <button className="btn btn-sheet" onClick={() => void lookup()}>Tra</button>
      </div>
      {status && <div className="parity-note">{status}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {results.map((item) => <button key={item} className="btn" onClick={() => onReplace(item)}>{item}</button>)}
      </div>
    </ParityDialog>
  );
}

export function TranslateModal({ cells, onWrite, onClose }: { cells: { a1: string; text: string }[]; onWrite: (results: { a1: string; text: string }[], mode: 'replace' | 'right') => void; onClose: () => void }) {
  const [target, setTarget] = useState('en');
  const [mode, setMode] = useState<'replace' | 'right'>('right');
  const [results, setResults] = useState<{ a1: string; text: string }[]>([]);
  const [status, setStatus] = useState('');
  const run = async () => {
    setStatus('Đang dịch…');
    try {
      const joined = cells.map((cell) => cell.text.replace(/\n/g, ' ')).join('\n');
      const output = await translateText(joined, target, () => undefined, new AbortController().signal);
      const lines = output.split('\n');
      setResults(cells.map((cell, i) => ({ a1: cell.a1, text: (lines[i] ?? '').trim() })));
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Không dịch được.');
    }
  };
  return (
    <ParityDialog
      title="Dịch (Translate)"
      subtitle={`${cells.length} ô chữ trong vùng đang chọn.`}
      width={560}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn" onClick={() => void run()}><Languages size={14} /><span>Dịch</span></button>
          <button className="btn btn-sheet" disabled={!results.length} onClick={() => onWrite(results, mode)}>Ghi vào bảng</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field"><span className="field-label">Dịch sang</span>
          <select className="text-field" value={target} onChange={(e) => setTarget(e.target.value)}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        </label>
        <label className="field"><span className="field-label">Ghi kết quả</span>
          <select className="text-field" value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'right')}>
            <option value="right">Sang cột bên phải</option>
            <option value="replace">Thay chữ gốc</option>
          </select>
        </label>
      </div>
      {status && <div className="parity-note">{status}</div>}
      <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 12 }}>
        {(results.length ? results : cells).slice(0, 200).map((cell) => (
          <div key={cell.a1} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 6, padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#64748b' }}>{cell.a1}</span><span>{cell.text}</span>
          </div>
        ))}
      </div>
    </ParityDialog>
  );
}

const HF_TOKENS: [string, string][] = [['&[Page]', 'Số trang'], ['&[Pages]', 'Tổng số trang'], ['&[Date]', 'Ngày'], ['&[Time]', 'Giờ'], ['&[File]', 'Tên tệp'], ['&[Sheet]', 'Tên trang tính']];
const EMPTY_BAND: SheetHeaderFooter = { left: '', center: '', right: '' };

export function HeaderFooterModal({ header, footer, onSave, onClose }: { header?: SheetHeaderFooter; footer?: SheetHeaderFooter; onSave: (header: SheetHeaderFooter, footer: SheetHeaderFooter) => void; onClose: () => void }) {
  const [head, setHead] = useState<SheetHeaderFooter>(header ?? EMPTY_BAND);
  const [foot, setFoot] = useState<SheetHeaderFooter>(footer ?? { left: '', center: 'Trang &[Page] / &[Pages]', right: '' });
  const [focus, setFocus] = useState<{ band: 'head' | 'foot'; part: keyof SheetHeaderFooter }>({ band: 'head', part: 'center' });
  const insertToken = (token: string) => {
    const set = focus.band === 'head' ? setHead : setFoot;
    set((prev) => ({ ...prev, [focus.part]: `${prev[focus.part]}${token}` }));
  };
  const row = (band: 'head' | 'foot', value: SheetHeaderFooter, set: (v: SheetHeaderFooter) => void) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      {(['left', 'center', 'right'] as const).map((part) => (
        <input key={part} className="text-field" placeholder={part === 'left' ? 'Trái' : part === 'center' ? 'Giữa' : 'Phải'} value={value[part]} onFocus={() => setFocus({ band, part })} onChange={(e) => set({ ...value, [part]: e.target.value })} />
      ))}
    </div>
  );
  return (
    <ParityDialog
      title="Đầu trang & Chân trang (Header & Footer)"
      subtitle="Hiện trên mọi trang khi in và xuất PDF."
      width={620}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={() => { setHead(EMPTY_BAND); setFoot(EMPTY_BAND); }}>Xoá hết</button>
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn btn-sheet" onClick={() => { onSave(head, foot); onClose(); }}>Lưu</button>
        </>
      }
    >
      <div className="field"><span className="field-label">Đầu trang</span>{row('head', head, setHead)}</div>
      <div className="field"><span className="field-label">Chân trang</span>{row('foot', foot, setFoot)}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {HF_TOKENS.map(([token, label]) => <button key={token} className="btn" onClick={() => insertToken(token)}>{label}</button>)}
      </div>
    </ParityDialog>
  );
}

export type SelectionPaneItem = { id: string; label: string; kind: string };

export function SelectionPaneModal({ items, onSelect, onOrder, onDelete, onClose }: { items: SelectionPaneItem[]; onSelect: (id: string) => void; onOrder: (id: string, where: 'front' | 'forward' | 'backward' | 'back') => void; onDelete: (id: string) => void; onClose: () => void }) {
  return (
    <ParityDialog title="Ngăn chọn đối tượng (Selection Pane)" subtitle="Ảnh, biểu đồ, hình vẽ đang nổi trên trang tính, trên cùng ở đầu danh sách." width={480} onClose={onClose}>
      {!items.length && <div className="parity-note">Trang tính chưa có đối tượng nổi nào.</div>}
      {items.map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
          <button className="sheet-popover-item" style={{ flex: 1 }} onClick={() => onSelect(item.id)}><span>{item.label}</span><span style={{ color: '#94a3b8', fontSize: 11 }}>{item.kind}</span></button>
          <button className="icon-btn" title="Đưa lên trên cùng" onClick={() => onOrder(item.id, 'front')}><ChevronsUp size={15} /></button>
          <button className="icon-btn" title="Đưa lên một lớp" onClick={() => onOrder(item.id, 'forward')}><ArrowUp size={15} /></button>
          <button className="icon-btn" title="Đưa xuống một lớp" onClick={() => onOrder(item.id, 'backward')}><ArrowDown size={15} /></button>
          <button className="icon-btn" title="Đưa xuống dưới cùng" onClick={() => onOrder(item.id, 'back')}><ChevronsDown size={15} /></button>
          <button className="icon-btn" title="Xoá" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button>
        </div>
      ))}
    </ParityDialog>
  );
}
