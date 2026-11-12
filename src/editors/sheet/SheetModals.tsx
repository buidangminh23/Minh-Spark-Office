import { useEffect, useMemo, useRef, useState } from 'react';
import { SHEET_SHORTCUT_HELP } from './sheetShortcuts';
import {
  X,
  Search,
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Upload,
  Layers,
  Split,
  Image,
  FileSignature,
  History,
  Bookmark,
  Copy,
  Table,
  Calculator,
  ShieldCheck,
  Users as TeamUsers,
} from 'lucide-react';
import type { FileMeta, FileVersion } from '../../lib/storage';
import type { WorkbookData } from '../../lib/sheetTypes';
import {
  FORMULA_CATALOG,
  CHART_PALETTES,
  extractChartDataset,
  renderChartSvg,
  renderChartPngDataUrl,
  answerSpreadsheetPrompt,
  type ChartType,
  type PivotAggFn,
  type SheetAnalysisResult,
} from './sheetUtils';
import { currentAuthorName } from '../../lib/currentAuthor';

export interface DefinedNameEntry {
  id: string;
  name: string;
  formulaOrRef: string;
}

export interface FindMatchItem {
  a1: string;
  row: number;
  col: number;
  preview: string;
}

export function FormulaLibraryModal({
  activeCellA1,
  activeRangeA1,
  onInsert,
  onClose,
}: {
  activeCellA1: string;
  activeRangeA1: string;
  onInsert: (formula: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('Tất cả');

  const groups = useMemo(
    () => ['Tất cả', ...Array.from(new Set(FORMULA_CATALOG.map((item) => item.group)))],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_CATALOG.filter((item) => {
      if (group !== 'Tất cả' && item.group !== group) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.syntax.toLowerCase().includes(q)
      );
    });
  }, [query, group]);

  const resolveTemplate = (tpl: string) => {
    const fallbackRange = activeRangeA1.includes(':') ? activeRangeA1 : 'B3:D7';
    return tpl.replaceAll('{range}', fallbackRange).replaceAll('{cell}', activeCellA1 || 'B3');
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width: 760, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Thư viện hàm công thức Minh Sheets ({FORMULA_CATALOG.length} hàm)</h2>
        <div className="dialog-subtitle">
          Ô đích hiện tại: <strong>{activeCellA1}</strong> · Vùng tham chiếu: <strong>{activeRangeA1}</strong>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div className="search-box" style={{ width: '100%' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Tìm tên hàm (SUMIFS, XLOOKUP, IFERROR, PMT) hoặc mô tả…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {groups.map((g) => (
            <button
              key={g}
              className={`filter-tab ${group === g ? 'active' : ''}`}
              style={{ padding: '4px 10px', fontSize: 11.5 }}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
          {filtered.map((item) => {
            const readyFormula = resolveTemplate(item.template);
            return (
              <div
                key={item.name}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: '#107c41', fontSize: 13.5 }}>{item.name}</span>
                    <span style={{ fontSize: 10.5, padding: '1px 6px', background: '#f1f5f9', borderRadius: 4, color: '#475569' }}>
                      {item.group}
                    </span>
                    <code style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', padding: '1px 6px', borderRadius: 4 }}>
                      {item.syntax}
                    </code>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{item.desc}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Ví dụ: <code>{item.example}</code> → Sẽ chèn: <code>{readyFormula}</code>
                  </div>
                </div>
                <button
                  className="btn btn-sheet"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
                  onClick={() => {
                    onInsert(readyFormula);
                    onClose();
                  }}
                >
                  Chèn vào {activeCellA1}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function ChartStudioModal({
  initialRange,
  sheetName,
  readRangeValues,
  onEmbedToSheet,
  onDownloadPng,
  onClose,
}: {
  initialRange: string;
  sheetName: string;
  readRangeValues: (rangeA1: string) => unknown[][];
  onEmbedToSheet: (pngDataUrl: string, title: string) => Promise<void>;
  onDownloadPng: (pngDataUrl: string, title: string) => void;
  onClose: () => void;
}) {
  const [rangeText, setRangeText] = useState(initialRange);
  const [chartType, setChartType] = useState<ChartType>('column');
  const [paletteId, setPaletteId] = useState<string>('emerald');
  const [title, setTitle] = useState(`Biểu đồ phân tích — ${sheetName}`);
  const [includeTotals, setIncludeTotals] = useState(false);
  const [busy, setBusy] = useState(false);

  const dataset = useMemo(() => {
    const raw = readRangeValues(rangeText);
    return extractChartDataset(raw, rangeText, paletteId, includeTotals);
  }, [rangeText, paletteId, includeTotals, readRangeValues]);

  const svgMarkup = useMemo(
    () => renderChartSvg(dataset, chartType, title, 660, 350),
    [dataset, chartType, title]
  );

  const handleEmbed = async () => {
    setBusy(true);
    try {
      const png = await renderChartPngDataUrl(dataset, chartType, title, 680, 380);
      await onEmbedToSheet(png, title);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const png = await renderChartPngDataUrl(dataset, chartType, title, 880, 480);
      onDownloadPng(png, title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width: 760 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Chart Studio — Tạo & Nhúng biểu đồ dữ liệu trực tiếp</h2>
        <div className="dialog-subtitle">
          Đọc dữ liệu thực từ trang tính <strong>{sheetName}</strong>, tự động nhận diện nhãn danh mục và chuỗi số liệu.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 1fr', gap: 10, marginBottom: 12 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Vùng dữ liệu (A1)</span>
            <input
              className="text-field"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="Ví dụ: A2:E7"
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Tiêu đề biểu đồ</span>
            <input
              className="text-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Bảng màu</span>
            <select className="text-field" value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
              {Object.keys(CHART_PALETTES).map((id) => (
                <option key={id} value={id}>
                  {id.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                ['column', 'Cột đứng', BarChart3],
                ['bar', 'Thanh ngang', BarChart3],
                ['line', 'Đường xu hướng', TrendingUp],
                ['area', 'Miền diện tích', TrendingUp],
                ['pie', 'Cơ cấu Donut', PieChart],
              ] as const
            ).map(([typeKey, label, IconComp]) => (
              <button
                key={typeKey}
                className={`btn ${chartType === typeKey ? 'btn-sheet' : ''}`}
                style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                onClick={() => setChartType(typeKey)}
              >
                <IconComp size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <label className="check-field" style={{ marginBottom: 0, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={includeTotals}
              onChange={(e) => setIncludeTotals(e.target.checked)}
            />
            <span>Gộp dòng Tổng cộng</span>
          </label>
        </div>

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 10,
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn" disabled={busy} onClick={() => void handleDownload()}>
            <Download size={14} />
            <span>Tải ảnh PNG (2x)</span>
          </button>
          <button className="btn btn-sheet" disabled={busy} onClick={() => void handleEmbed()}>
            <Plus size={15} />
            <span>{busy ? 'Đang kết xuất…' : 'Nhúng biểu đồ vào Sheet'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function PivotBuilderModal({
  sourceRange,
  headers,
  rowCount,
  defaultSheetName,
  onCreatePivot,
  onClose,
}: {
  sourceRange: string;
  headers: string[];
  rowCount: number;
  defaultSheetName: string;
  onCreatePivot: (config: {
    rowField: number;
    colField: number;
    valueField: number;
    aggFn: PivotAggFn;
    targetSheetName: string;
  }) => void;
  onClose: () => void;
}) {
  const [rowField, setRowField] = useState(() => {
    const catIdx = headers.findIndex((h) => /phân loại|hạng mục|chức vụ|khu vực|nhóm|phụ trách|trạng thái/i.test(h));
    if (catIdx >= 0) return catIdx;
    const nonSttIdx = headers.findIndex((h) => !/^stt$|^mã/i.test(h.trim()));
    return nonSttIdx >= 0 ? nonSttIdx : 0;
  });
  const [colField, setColField] = useState(-1);
  const [valueField, setValueField] = useState(() => {
    const numIdx = headers.findIndex((h) => /thu|chi|tổng|dự toán|doanh|thành tiền|lương|thực lĩnh|giá trị|tháng/i.test(h));
    return numIdx >= 0 ? numIdx : Math.max(0, headers.length - 1);
  });
  const [aggFn, setAggFn] = useState<PivotAggFn>('SUM');
  const [targetSheetName, setTargetSheetName] = useState(defaultSheetName);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 520 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Tạo bảng tổng hợp Pivot Table</h2>
        <div className="dialog-subtitle">
          Nguồn dữ liệu: <strong>{sourceRange}</strong> ({rowCount} dòng bản ghi, {headers.length} cột)
        </div>

        <label className="field">
          <span className="field-label">Nhóm theo dòng (Row Labels)</span>
          <select className="text-field" value={rowField} onChange={(e) => setRowField(Number(e.target.value))}>
            {headers.map((h, idx) => (
              <option key={idx} value={idx}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Phân tách theo cột (Column Labels — Tuỳ chọn)</span>
          <select className="text-field" value={colField} onChange={(e) => setColField(Number(e.target.value))}>
            <option value={-1}>-- Không tách cột (1 cột tổng hợp) --</option>
            {headers.map((h, idx) => (
              <option key={idx} value={idx}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
          <label className="field">
            <span className="field-label">Cột tính toán giá trị (Values)</span>
            <select className="text-field" value={valueField} onChange={(e) => setValueField(Number(e.target.value))}>
              {headers.map((h, idx) => (
                <option key={idx} value={idx}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Phép tổng hợp</span>
            <select className="text-field" value={aggFn} onChange={(e) => setAggFn(e.target.value as PivotAggFn)}>
              <option value="SUM">SUM (Tính tổng)</option>
              <option value="COUNT">COUNT (Đếm dòng)</option>
              <option value="AVERAGE">AVERAGE (Trung bình)</option>
              <option value="MAX">MAX (Lớn nhất)</option>
              <option value="MIN">MIN (Nhỏ nhất)</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Tên Sheet báo cáo Pivot mới</span>
          <input
            className="text-field"
            value={targetSheetName}
            onChange={(e) => setTargetSheetName(e.target.value)}
          />
        </label>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button
            className="btn btn-sheet"
            disabled={headers.length === 0 || rowCount === 0}
            onClick={() => {
              onCreatePivot({
                rowField,
                colField,
                valueField,
                aggFn,
                targetSheetName: targetSheetName.trim() || 'Pivot Table',
              });
              onClose();
            }}
          >
            <Table size={15} />
            <span>Tạo Sheet Pivot</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export type ConditionalRuleInput = {
  ruleType:
    | 'gt'
    | 'lt'
    | 'between'
    | 'eq'
    | 'textContains'
    | 'duplicate'
    | 'unique'
    | 'empty'
    | 'dataBar'
    | 'colorScale';
  val1: string;
  val2: string;
  bg: string;
  fg: string;
};

export function ConditionalFormatModal({
  activeRangeA1,
  ruleCount,
  onApply,
  onClearSheetRules,
  onClose,
}: {
  activeRangeA1: string;
  ruleCount: number;
  onApply: (input: ConditionalRuleInput) => void;
  onClearSheetRules: () => void;
  onClose: () => void;
}) {
  const [ruleType, setRuleType] = useState<ConditionalRuleInput['ruleType']>('gt');
  const [val1, setVal1] = useState('50000000');
  const [val2, setVal2] = useState('150000000');
  const [preset, setPreset] = useState<'green' | 'red' | 'amber' | 'blue'>('green');

  const presetMap = {
    green: { bg: '#dcfce7', fg: '#166534', label: 'Nền Xanh lá — Chữ Xanh đậm (Tích cực)' },
    red: { bg: '#fee2e2', fg: '#991b1b', label: 'Nền Đỏ nhạt — Chữ Đỏ đậm (Cảnh báo)' },
    amber: { bg: '#fef3c7', fg: '#92400e', label: 'Nền Vàng nhạt — Chữ Nâu cam (Chú ý)' },
    blue: { bg: '#dbeafe', fg: '#1e40af', label: 'Nền Xanh dương — Chữ Xanh đậm (Thông tin)' },
  };

  const needsVal1 = ['gt', 'lt', 'between', 'eq', 'textContains'].includes(ruleType);
  const needsVal2 = ruleType === 'between';
  const needsColors = ruleType !== 'dataBar' && ruleType !== 'colorScale';

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 500 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Định dạng có điều kiện (Conditional Formatting)</h2>
        <div className="dialog-subtitle">
          Áp dụng cho vùng: <strong>{activeRangeA1}</strong> · Đang có <strong>{ruleCount}</strong> quy tắc trên Sheet
        </div>

        <label className="field">
          <span className="field-label">Loại điều kiện</span>
          <select
            className="text-field"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as ConditionalRuleInput['ruleType'])}
          >
            <option value="gt">Số lớn hơn (&gt;)</option>
            <option value="lt">Số nhỏ hơn (&lt;)</option>
            <option value="between">Số nằm trong khoảng (Between)</option>
            <option value="eq">Bằng giá trị (=)</option>
            <option value="textContains">Văn bản có chứa cụm từ</option>
            <option value="duplicate">Giá trị trùng lặp (Duplicate Values)</option>
            <option value="unique">Giá trị duy nhất (Unique Values)</option>
            <option value="empty">Ô đang để trống (Blank Cells)</option>
            <option value="dataBar">Thanh dữ liệu trực quan (Data Bars)</option>
            <option value="colorScale">Thang màu nhiệt độ 3 mức (Color Scale)</option>
          </select>
        </label>

        {needsVal1 && (
          <div style={{ display: 'grid', gridTemplateColumns: needsVal2 ? '1fr 1fr' : '1fr', gap: 10 }}>
            <label className="field">
              <span className="field-label">{needsVal2 ? 'Từ giá trị' : 'Giá trị so sánh'}</span>
              <input className="text-field" value={val1} onChange={(e) => setVal1(e.target.value)} />
            </label>
            {needsVal2 && (
              <label className="field">
                <span className="field-label">Đến giá trị</span>
                <input className="text-field" value={val2} onChange={(e) => setVal2(e.target.value)} />
              </label>
            )}
          </div>
        )}

        {needsColors && (
          <label className="field">
            <span className="field-label">Kiểu tô nổi bật khi thoả điều kiện</span>
            <select
              className="text-field"
              value={preset}
              onChange={(e) => setPreset(e.target.value as 'green' | 'red' | 'amber' | 'blue')}
            >
              {Object.entries(presetMap).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn btn-danger"
            onClick={() => {
              onClearSheetRules();
              onClose();
            }}
          >
            Xoá hết quy tắc Sheet
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Huỷ
            </button>
            <button
              className="btn btn-sheet"
              onClick={() => {
                onApply({
                  ruleType,
                  val1,
                  val2,
                  bg: presetMap[preset].bg,
                  fg: presetMap[preset].fg,
                });
                onClose();
              }}
            >
              Áp dụng ngay
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export type ValidationRuleInput = {
  kind: 'list' | 'range' | 'checkbox' | 'numberBetween' | 'numberGt' | 'formula';
  listText: string;
  minVal: string;
  maxVal: string;
  integerOnly: boolean;
  allowBlank: boolean;
  strictStop: boolean;
  errorMessage: string;
};

export function DataValidationModal({
  activeRangeA1,
  onApply,
  onClearValidation,
  onClose,
}: {
  activeRangeA1: string;
  onApply: (rule: ValidationRuleInput) => void;
  onClearValidation: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ValidationRuleInput['kind']>('list');
  const [listText, setListText] = useState('Hoàn thành, Đang chạy, Chuẩn bị, Tạm dừng');
  const [minVal, setMinVal] = useState('0');
  const [maxVal, setMaxVal] = useState('1000000000');
  const [integerOnly, setIntegerOnly] = useState(false);
  const [allowBlank, setAllowBlank] = useState(true);
  const [strictStop, setStrictStop] = useState(true);
  const [errorMessage, setErrorMessage] = useState('Giá trị nhập vào không hợp lệ theo quy tắc kiểm soát dữ liệu.');

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 520 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Kiểm tra & Ràng buộc dữ liệu (Data Validation)</h2>
        <div className="dialog-subtitle">
          Áp dụng cho vùng ô: <strong>{activeRangeA1}</strong>
        </div>

        <label className="field">
          <span className="field-label">Kiểu kiểm soát</span>
          <select
            className="text-field"
            value={kind}
            onChange={(e) => setKind(e.target.value as ValidationRuleInput['kind'])}
          >
            <option value="list">Danh sách thả xuống (Dropdown List)</option>
            <option value="range">Danh sách lấy từ vùng ô (List from Range)</option>
            <option value="checkbox">Ô đánh dấu (Checkbox TRUE / FALSE)</option>
            <option value="numberBetween">Số nằm trong khoảng (Min → Max)</option>
            <option value="numberGt">Số lớn hơn ngưỡng tối thiểu (&gt;)</option>
            <option value="formula">Công thức tuỳ chỉnh (Custom Formula)</option>
          </select>
        </label>

        {kind === 'list' && (
          <label className="field">
            <span className="field-label">Các lựa chọn (phân tách bằng dấu phẩy)</span>
            <input
              className="text-field"
              value={listText}
              onChange={(e) => setListText(e.target.value)}
              placeholder="Đạt, Chưa đạt, Đang xét duyệt"
            />
          </label>
        )}

        {kind === 'range' && (
          <label className="field">
            <span className="field-label">Vùng ô nguồn chứa danh mục (A1)</span>
            <input
              className="text-field"
              value={listText}
              onChange={(e) => setListText(e.target.value)}
              placeholder="Ví dụ: A3:A10"
            />
          </label>
        )}

        {kind === 'formula' && (
          <label className="field">
            <span className="field-label">Công thức kiểm tra (phải trả về TRUE/FALSE)</span>
            <input
              className="text-field"
              value={listText}
              onChange={(e) => setListText(e.target.value)}
              placeholder="Ví dụ: =AND(B3>=0, B3<=100)"
            />
          </label>
        )}

        {(kind === 'numberBetween' || kind === 'numberGt') && (
          <div style={{ display: 'grid', gridTemplateColumns: kind === 'numberBetween' ? '1fr 1fr' : '1fr', gap: 10 }}>
            <label className="field">
              <span className="field-label">{kind === 'numberBetween' ? 'Giá trị nhỏ nhất' : 'Lớn hơn giá trị'}</span>
              <input className="text-field" type="number" value={minVal} onChange={(e) => setMinVal(e.target.value)} />
            </label>
            {kind === 'numberBetween' && (
              <label className="field">
                <span className="field-label">Giá trị lớn nhất</span>
                <input className="text-field" type="number" value={maxVal} onChange={(e) => setMaxVal(e.target.value)} />
              </label>
            )}
          </div>
        )}

        {(kind === 'numberBetween' || kind === 'numberGt') && (
          <label className="check-field">
            <input type="checkbox" checked={integerOnly} onChange={(e) => setIntegerOnly(e.target.checked)} />
            <span>Chỉ chấp nhận số nguyên (Whole Number)</span>
          </label>
        )}

        <div style={{ display: 'flex', gap: 18 }}>
          <label className="check-field">
            <input type="checkbox" checked={allowBlank} onChange={(e) => setAllowBlank(e.target.checked)} />
            <span>Cho phép để trống ô</span>
          </label>
          <label className="check-field">
            <input type="checkbox" checked={strictStop} onChange={(e) => setStrictStop(e.target.checked)} />
            <span>Chặn cứng dữ liệu sai</span>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Thông báo khi nhập sai</span>
          <input className="text-field" value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} />
        </label>

        <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn"
            onClick={() => {
              onClearValidation();
              onClose();
            }}
          >
            Gỡ bỏ kiểm tra
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Huỷ
            </button>
            <button
              className="btn btn-sheet"
              onClick={() => {
                onApply({
                  kind,
                  listText,
                  minVal,
                  maxVal,
                  integerOnly,
                  allowBlank,
                  strictStop,
                  errorMessage,
                });
                onClose();
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FindReplaceGoToModal({
  initialMode,
  definedNames,
  onFindAll,
  onReplaceOne,
  onReplaceAll,
  onGoToRef,
  onClose,
}: {
  initialMode: 'find' | 'goto';
  definedNames: DefinedNameEntry[];
  onFindAll: (query: string, matchCase: boolean, wholeCell: boolean) => Promise<FindMatchItem[]>;
  onReplaceOne: (query: string, replacement: string, matchCase: boolean, wholeCell: boolean) => Promise<number>;
  onReplaceAll: (query: string, replacement: string, matchCase: boolean, wholeCell: boolean) => Promise<number>;
  onGoToRef: (a1Ref: string) => boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'find' | 'goto'>(initialMode);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [matches, setMatches] = useState<FindMatchItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [goToInput, setGoToInput] = useState('A1');

  const runSearch = async () => {
    if (!query.trim()) {
      setMatches([]);
      setStatusMsg('Nhập từ khoá cần tìm trên Sheet.');
      return;
    }
    const found = await onFindAll(query, matchCase, wholeCell);
    setMatches(found);
    setActiveIdx(0);
    if (found.length > 0) {
      onGoToRef(found[0].a1);
      setStatusMsg(`Tìm thấy ${found.length} ô khớp.`);
    } else {
      setStatusMsg('Không tìm thấy ô nào khớp từ khoá.');
    }
  };

  const stepMatch = (delta: number) => {
    if (matches.length === 0) return;
    const next = (activeIdx + delta + matches.length) % matches.length;
    setActiveIdx(next);
    onGoToRef(matches[next].a1);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 540 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Tìm kiếm, Thay thế & Đi tới ô</h2>

        <div style={{ display: 'flex', gap: 6, margin: '10px 0 14px' }}>
          <button className={`filter-tab ${tab === 'find' ? 'active' : ''}`} onClick={() => setTab('find')}>
            Tìm & Thay thế (Ctrl+F / Ctrl+H)
          </button>
          <button className={`filter-tab ${tab === 'goto' ? 'active' : ''}`} onClick={() => setTab('goto')}>
            Đi tới địa chỉ ô (Ctrl+G)
          </button>
        </div>

        {tab === 'find' ? (
          <>
            <label className="field">
              <span className="field-label">Nội dung cần tìm</span>
              <input
                className="text-field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                placeholder="Nhập văn bản hoặc con số…"
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Thay thế bằng (để trống nếu chỉ tìm kiếm)</span>
              <input
                className="text-field"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Giá trị thay thế mới…"
              />
            </label>

            <div style={{ display: 'flex', gap: 16 }}>
              <label className="check-field">
                <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
                <span>Phân biệt chữ HOA/thường</span>
              </label>
              <label className="check-field">
                <input type="checkbox" checked={wholeCell} onChange={(e) => setWholeCell(e.target.checked)} />
                <span>Khớp toàn bộ nội dung ô</span>
              </label>
            </div>

            {statusMsg && (
              <div style={{ fontSize: 12, color: '#065f46', background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                {statusMsg}
              </div>
            )}

            {matches.length > 0 && (
              <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 6, marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {matches.map((m, idx) => (
                  <button
                    key={`${m.a1}-${idx}`}
                    className={`filter-tab ${idx === activeIdx ? 'active' : ''}`}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => {
                      setActiveIdx(idx);
                      onGoToRef(m.a1);
                    }}
                  >
                    <strong>{m.a1}</strong>: {m.preview.slice(0, 18)}
                  </button>
                ))}
              </div>
            )}

            <div className="dialog-actions" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => void runSearch()}>
                Tìm tất cả
              </button>
              <button className="btn" disabled={matches.length === 0} onClick={() => stepMatch(-1)}>
                Trước
              </button>
              <button className="btn" disabled={matches.length === 0} onClick={() => stepMatch(1)}>
                Tiếp theo
              </button>
              <button
                className="btn"
                disabled={!query.trim()}
                onClick={async () => {
                  const count = await onReplaceOne(query, replacement, matchCase, wholeCell);
                  setStatusMsg(`Đã thay thế ${count} vị trí.`);
                  void runSearch();
                }}
              >
                Thay thế 1 ô
              </button>
              <button
                className="btn btn-sheet"
                disabled={!query.trim()}
                onClick={async () => {
                  const count = await onReplaceAll(query, replacement, matchCase, wholeCell);
                  setStatusMsg(`Đã thay thế đồng loạt ${count} ô.`);
                  setMatches([]);
                }}
              >
                Thay thế tất cả
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Nhập toạ độ ô hoặc vùng (ví dụ: E8, B3:F7, Sheet1!A1)</span>
              <input
                className="text-field"
                value={goToInput}
                onChange={(e) => setGoToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onGoToRef(goToInput)) onClose();
                }}
                autoFocus
              />
            </label>

            {definedNames.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="field-label" style={{ marginBottom: 6 }}>Tên vùng đã đặt (Defined Names)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {definedNames.map((dn) => (
                    <button
                      key={dn.id}
                      className="btn"
                      style={{ minHeight: 28, padding: '3px 8px', fontSize: 11.5 }}
                      onClick={() => {
                        if (onGoToRef(dn.formulaOrRef)) onClose();
                      }}
                    >
                      <strong>{dn.name}</strong> ({dn.formulaOrRef})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="dialog-actions">
              <button className="btn" onClick={onClose}>
                Đóng
              </button>
              <button
                className="btn btn-sheet"
                onClick={() => {
                  if (onGoToRef(goToInput)) onClose();
                }}
              >
                Nhảy tới vùng chọn
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function SignatureStampModal({
  defaultSigner,
  defaultRole,
  onEmbedSignature,
  onSignAndSavePdf,
  onClose,
}: {
  defaultSigner: string;
  defaultRole: string;
  onEmbedSignature: (pngDataUrl: string, signer: string, role: string) => Promise<void>;
  onSignAndSavePdf: (pngDataUrl: string, signer: string, role: string) => Promise<void>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [signer, setSigner] = useState(defaultSigner || currentAuthorName());
  const [role, setRole] = useState(defaultRole || 'Giám đốc');
  const [inkColor, setInkColor] = useState('#b91c1c');
  const [includeStampBox, setIncludeStampBox] = useState(true);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pos = getPos(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setHasStrokes(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const buildCompositeSealPng = (): string => {
    const out = document.createElement('canvas');
    out.width = 520;
    out.height = 240;
    const ctx = out.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(0, 0, out.width, out.height);

    if (includeStampBox) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, out.width - 16, out.height - 16);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(14, 14, out.width - 28, out.height - 28);

      ctx.fillStyle = '#b91c1c';
      ctx.font = '800 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('XÁC THỰC CHỮ KÝ SỐ · MINH SPARK OFFICE', out.width / 2, 36);
    }

    if (canvasRef.current && hasStrokes) {
      ctx.drawImage(canvasRef.current, 60, 44, 400, 120);
    } else {
      ctx.fillStyle = inkColor;
      ctx.font = 'italic 700 32px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.fillText(signer, out.width / 2, 118);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(signer, out.width / 2, 186);

    ctx.fillStyle = '#475569';
    ctx.font = '600 12px Arial, sans-serif';
    ctx.fillText(`${role} · Ký ngày ${new Date().toLocaleDateString('vi-VN')}`, out.width / 2, 208);

    return out.toDataURL('image/png');
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 540 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Ký tươi & Đóng dấu xác thực lên Bảng tính</h2>
        <div className="dialog-subtitle">
          Vẽ chữ ký trực tiếp trên bảng cảm ứng hoặc chuột, tự động kết xuất con dấu chèn vào ô đang chọn.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span className="field-label">Người ký duyệt</span>
            <input className="text-field" value={signer} onChange={(e) => setSigner(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Chức danh / Đơn vị</span>
            <input className="text-field" value={role} onChange={(e) => setRole(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Màu mực:</span>
            {[
              ['#b91c1c', 'Đỏ dấu'],
              ['#1d4ed8', 'Xanh bút ký'],
              ['#0f172a', 'Đen'],
            ].map(([c, lbl]) => (
              <button
                key={c}
                className={`btn ${inkColor === c ? 'btn-primary' : ''}`}
                style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                onClick={() => setInkColor(c)}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                <span>{lbl}</span>
              </button>
            ))}
          </div>
          <button className="btn" style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }} onClick={clearCanvas}>
            Xoá nét vẽ
          </button>
        </div>

        <div style={{ border: '2px dashed #cbd5e1', borderRadius: 8, background: '#ffffff', overflow: 'hidden', marginBottom: 10 }}>
          <canvas
            ref={canvasRef}
            width={480}
            height={140}
            style={{ width: '100%', height: 140, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        <label className="check-field">
          <input type="checkbox" checked={includeStampBox} onChange={(e) => setIncludeStampBox(e.target.checked)} />
          <span>Đóng khung mộc đỏ quanh chữ ký</span>
        </label>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button
            className="btn"
            onClick={async () => {
              const png = buildCompositeSealPng();
              await onEmbedSignature(png, signer, role);
              onClose();
            }}
          >
            <FileSignature size={15} />
            <span>Chèn dấu vào Sheet</span>
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              const png = buildCompositeSealPng();
              await onSignAndSavePdf(png, signer, role);
              onClose();
            }}
          >
            <span>Ký & Xuất sang Minh PDF</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function NameManagerModal({
  activeRangeA1,
  sheetName,
  definedNames,
  onAddName,
  onDeleteName,
  onJumpToRef,
  onClose,
}: {
  activeRangeA1: string;
  sheetName: string;
  definedNames: DefinedNameEntry[];
  onAddName: (name: string, ref: string) => void;
  onDeleteName: (name: string) => void;
  onJumpToRef: (ref: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [ref, setRef] = useState(`'${sheetName}'!${activeRangeA1}`);
  const [err, setErr] = useState('');

  const handleCreate = () => {
    const clean = name.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(clean)) {
      setErr('Tên vùng phải bắt đầu bằng chữ cái hoặc dấu _ và không chứa khoảng trắng.');
      return;
    }
    setErr('');
    onAddName(clean, ref.trim());
    setName('');
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 540 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Quản lý Tên vùng (Name Manager)</h2>
        <div className="dialog-subtitle">
          Đặt tên gợi nhớ cho vùng dữ liệu để viết công thức ngắn gọn như <code>=SUM(DoanhThuQuy4)</code>.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Tên định danh</span>
            <input
              className="text-field"
              placeholder="VD: NganSachQuy4"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Tham chiếu / Công thức</span>
            <input className="text-field" value={ref} onChange={(e) => setRef(e.target.value)} />
          </label>
          <button className="btn btn-sheet" style={{ height: 35 }} onClick={handleCreate}>
            Thêm tên
          </button>
        </div>

        {err && <div className="form-error">{err}</div>}

        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, marginTop: 8 }}>
          {definedNames.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              Chưa có tên vùng nào trong Workbook này.
            </div>
          ) : (
            definedNames.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong style={{ color: '#107c41' }}>{item.name}</strong>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    <code>{item.formulaOrRef}</code>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn"
                    style={{ minHeight: 28, padding: '2px 8px', fontSize: 11.5 }}
                    onClick={() => {
                      onJumpToRef(item.formulaOrRef);
                      onClose();
                    }}
                  >
                    Đi tới
                  </button>
                  <button className="icon-btn" style={{ color: 'var(--accent)' }} onClick={() => onDeleteName(item.name)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function GoalSeekModal({
  activeCellA1,
  onRunGoalSeek,
  onClose,
}: {
  activeCellA1: string;
  onRunGoalSeek: (formulaCell: string, targetValue: number, variableCell: string) => Promise<string>;
  onClose: () => void;
}) {
  const [formulaCell, setFormulaCell] = useState(activeCellA1 || 'E8');
  const [targetValue, setTargetValue] = useState('650000000');
  const [variableCell, setVariableCell] = useState('D3');
  const [resultMsg, setResultMsg] = useState('');
  const [running, setRunning] = useState(false);

  const handleSolve = async () => {
    const num = Number(targetValue.replaceAll(',', '').trim());
    if (!Number.isFinite(num)) {
      setResultMsg('Vui lòng nhập giá trị mục tiêu hợp lệ.');
      return;
    }
    setRunning(true);
    try {
      const msg = await onRunGoalSeek(formulaCell.trim(), num, variableCell.trim());
      setResultMsg(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 460 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Phân tích độ nhạy — Goal Seek (What-If)</h2>
        <div className="dialog-subtitle">
          Tự động giải phương trình ngược để tìm giá trị đầu vào giúp ô công thức đạt đúng mục tiêu mong muốn.
        </div>

        <label className="field">
          <span className="field-label">Ô chứa công thức mục tiêu (Set Cell)</span>
          <input className="text-field" value={formulaCell} onChange={(e) => setFormulaCell(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Giá trị mục tiêu cần đạt (To Value)</span>
          <input className="text-field" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Ô biến số đầu vào cần thay đổi (By Changing Cell)</span>
          <input className="text-field" value={variableCell} onChange={(e) => setVariableCell(e.target.value)} />
        </label>

        {resultMsg && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 12 }}>
            {resultMsg}
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-sheet" disabled={running} onClick={() => void handleSolve()}>
            <Calculator size={15} />
            <span>{running ? 'Đang giải nghiệm…' : 'Chạy Goal Seek'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function AiAuditModal({
  initialTab,
  analysis,
  activeRangeA1,
  onJumpToCell,
  onWrapErrorsWithIfError,
  onTrimAllSpaces,
  onConvertTextNumbers,
  onInsertFormula,
  onClose,
}: {
  initialTab: 'analysis' | 'audit' | 'assistant';
  analysis: SheetAnalysisResult;
  activeRangeA1: string;
  onJumpToCell: (a1: string) => void;
  onWrapErrorsWithIfError: () => void;
  onTrimAllSpaces: () => void;
  onConvertTextNumbers: () => void;
  onInsertFormula: (formula: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'analysis' | 'audit' | 'assistant'>(initialTab);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState(() => answerSpreadsheetPrompt('phân tích tổng quan', analysis, activeRangeA1));

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Minh AI & Kiểm toán dữ liệu trực tiếp — {analysis.sheetName}</h2>
        <div className="dialog-subtitle">
          Tính toán thời gian thực trên toàn bộ dữ liệu đang mở (không dùng dữ liệu giả lập).
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button className={`filter-tab ${tab === 'analysis' ? 'active' : ''}`} onClick={() => setTab('analysis')}>
            Thống kê & KPI trực tiếp
          </button>
          <button className={`filter-tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
            Kiểm toán & Khử lỗi ({analysis.errorCells.length + analysis.trailingSpaceCells.length + analysis.numericTextCells.length})
          </button>
          <button className={`filter-tab ${tab === 'assistant' ? 'active' : ''}`} onClick={() => setTab('assistant')}>
            Trợ lý Công thức AI
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'analysis' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, color: '#166534' }}>Tổng giá trị số</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#065f46', marginTop: 2 }}>
                    {analysis.sum.toLocaleString('en-US')}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 11, color: '#1e40af' }}>Trung bình ô số</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#1e3a8a', marginTop: 2 }}>
                    {Math.round(analysis.avg).toLocaleString('en-US')}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#475569' }}>Ô có dữ liệu / Ô số</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {analysis.nonEmptyCells} / {analysis.numericCells}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: '#fefce8', border: '1px solid #fde047' }}>
                  <div style={{ fontSize: 11, color: '#854d0e' }}>Số ô công thức (fx)</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#713f12', marginTop: 2 }}>
                    {analysis.formulaCells}
                  </div>
                </div>
              </div>

              {analysis.columnSummaries.length > 0 && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="file-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Cột chỉ tiêu</th>
                        <th style={{ textAlign: 'right' }}>Tổng (SUM)</th>
                        <th style={{ textAlign: 'right' }}>Trung bình</th>
                        <th style={{ textAlign: 'right' }}>Nhỏ nhất → Lớn nhất</th>
                        <th>Đóng góp cao nhất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.columnSummaries.map((col) => (
                        <tr key={col.colIndex}>
                          <td>
                            <strong>{col.header}</strong> <span style={{ color: '#64748b' }}>({col.colLetter})</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#107c41' }}>
                            {col.sum.toLocaleString('en-US')}
                          </td>
                          <td style={{ textAlign: 'right' }}>{Math.round(col.avg).toLocaleString('en-US')}</td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>
                            {col.min.toLocaleString('en-US')} → {col.max.toLocaleString('en-US')}
                          </td>
                          <td>
                            {col.topLabel} (<strong>{col.topValue.toLocaleString('en-US')}</strong>)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {analysis.errorCells.length === 0 ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#dc2626" />}
                    <span>Lỗi công thức (#DIV/0!, #VALUE!, #REF!, #N/A): {analysis.errorCells.length} ô</span>
                  </div>
                  {analysis.errorCells.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {analysis.errorCells.map((e) => (
                        <button
                          key={e.a1}
                          className="filter-tab"
                          style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px' }}
                          onClick={() => {
                            onJumpToCell(e.a1);
                            onClose();
                          }}
                        >
                          {e.a1}: {e.error}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {analysis.errorCells.length > 0 && (
                  <button className="btn btn-sheet" onClick={onWrapErrorsWithIfError}>
                    Bọc IFERROR(..., 0)
                  </button>
                )}
              </div>

              <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Ô văn bản dư khoảng trắng thừa: {analysis.trailingSpaceCells.length} ô</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    Khoảng trắng đầu/cuối làm sai lệch kết quả hàm VLOOKUP, XLOOKUP và SUMIF.
                  </div>
                </div>
                {analysis.trailingSpaceCells.length > 0 && (
                  <button className="btn btn-sheet" onClick={onTrimAllSpaces}>
                    Chuẩn hoá TRIM ngay
                  </button>
                )}
              </div>

              <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Con số đang bị lưu dưới dạng Chuỗi (Text Number): {analysis.numericTextCells.length} ô</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    Các ô này bị hàm SUM / AVERAGE bỏ qua cho đến khi chuyển về kiểu Number.
                  </div>
                </div>
                {analysis.numericTextCells.length > 0 && (
                  <button className="btn btn-sheet" onClick={onConvertTextNumbers}>
                    Ép sang kiểu Số
                  </button>
                )}
              </div>

              <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>Dòng bản ghi trùng lặp hoàn toàn: {analysis.duplicateRowCount} dòng</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  Dùng công cụ <strong>Data → Xoá trùng lặp</strong> để khử trùng lặp trên vùng dữ liệu bất kỳ.
                </div>
              </div>
            </div>
          )}

          {tab === 'assistant' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  'Phân tích tổng quan dữ liệu Sheet',
                  'Gợi ý hàm XLOOKUP tra cứu hai chiều',
                  'Công thức SUMIFS tính tổng nhiều điều kiện',
                  'Kiểm toán chất lượng & lỗi công thức',
                ].map((chip) => (
                  <button
                    key={chip}
                    className="filter-tab"
                    style={{ background: '#f1f5f9', color: '#1e293b' }}
                    onClick={() => {
                      setPrompt(chip);
                      setAnswer(answerSpreadsheetPrompt(chip, analysis, activeRangeA1));
                    }}
                  >
                    <Sparkles size={12} style={{ marginRight: 4 }} />
                    {chip}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  className="text-field"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setAnswer(answerSpreadsheetPrompt(prompt, analysis, activeRangeA1))}
                  placeholder="Hỏi về số liệu trên Sheet hoặc yêu cầu viết công thức Excel…"
                />
                <button
                  className="btn btn-sheet"
                  onClick={() => setAnswer(answerSpreadsheetPrompt(prompt || 'phân tích', analysis, activeRangeA1))}
                >
                  Phân tích
                </button>
              </div>

              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: 14,
                  margin: 0,
                  color: '#0f172a',
                }}
              >
                {answer}
              </pre>

              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  style={{ minHeight: 30, fontSize: 11.5 }}
                  onClick={() => {
                    onInsertFormula(`=SUM(${activeRangeA1})`);
                    onClose();
                  }}
                >
                  Chèn =SUM({activeRangeA1})
                </button>
                <button
                  className="btn"
                  style={{ minHeight: 30, fontSize: 11.5 }}
                  onClick={() => {
                    onInsertFormula(`=AVERAGE(${activeRangeA1})`);
                    onClose();
                  }}
                >
                  Chèn =AVERAGE({activeRangeA1})
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function SplitMergeImageModal({
  mode,
  workbook,
  workspaceSheets,
  onSplitSingle,
  onSplitAll,
  onMergeFiles,
  onMergeWorkspaceSheet,
  onExportPng,
  onClose,
}: {
  mode: 'split' | 'merge' | 'image';
  workbook: WorkbookData;
  workspaceSheets: FileMeta[];
  onSplitSingle: (sheetId: string) => Promise<void>;
  onSplitAll: () => Promise<void>;
  onMergeFiles: (files: FileList) => Promise<void>;
  onMergeWorkspaceSheet: (fileId: string) => Promise<void>;
  onExportPng: (scale: number, showGridlines: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(2);
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 540 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>

        {mode === 'split' && (
          <>
            <h2>Tách trang tính thành tệp độc lập (.xlsx)</h2>
            <div className="dialog-subtitle">
              Xuất riêng từng Sheet hoặc tách đồng loạt toàn bộ {workbook.sheetOrder.length} Sheet giữ nguyên định dạng và công thức.
            </div>
            <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14 }}>
              {workbook.sheetOrder.map((sid, idx) => {
                const sh = workbook.sheets[sid];
                if (!sh) return null;
                const filledRows = Object.keys(sh.cellData ?? {}).length;
                return (
                  <div
                    key={sid}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>
                        {idx + 1}. {sh.name}
                      </strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{filledRows} dòng có dữ liệu</div>
                    </div>
                    <button
                      className="btn"
                      style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                      onClick={() => void onSplitSingle(sid)}
                    >
                      <Split size={13} />
                      <span>Tách .xlsx</span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="dialog-actions">
              <button className="btn" onClick={onClose}>
                Đóng
              </button>
              <button
                className="btn btn-sheet"
                onClick={async () => {
                  await onSplitAll();
                  onClose();
                }}
              >
                Tách tải xuống tất cả ({workbook.sheetOrder.length} tệp)
              </button>
            </div>
          </>
        )}

        {mode === 'merge' && (
          <>
            <h2>Gộp nhiều Bảng tính vào Workbook hiện tại</h2>
            <div className="dialog-subtitle">
              Chọn các tệp Excel/CSV từ máy tính hoặc gộp trực tiếp từ kho lưu trữ Minh Spark Office.
            </div>

            <label
              style={{
                border: '2px dashed #107c41',
                borderRadius: 10,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: '#f0fdf4',
                cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              <Upload size={26} color="#107c41" />
              <strong style={{ color: '#065f46' }}>Chọn một hoặc nhiều tệp (.xlsx, .xlsm, .xls, .csv, .tsv)</strong>
              <span style={{ fontSize: 11.5, color: '#475569' }}>Mỗi Sheet trong tệp tải lên sẽ được gộp thêm vào cuối Workbook</span>
              <input
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv,.tsv"
                multiple
                hidden
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await onMergeFiles(e.target.files);
                    onClose();
                  }
                }}
              />
            </label>

            {workspaceSheets.length > 0 && (
              <>
                <div className="field-label" style={{ marginBottom: 6 }}>Hoặc gộp từ bảng tính có sẵn trong Workspace:</div>
                <div style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                  {workspaceSheets.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 12.5 }}>{f.name}</span>
                      <button
                        className="btn"
                        style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                        onClick={async () => {
                          await onMergeWorkspaceSheet(f.id);
                          onClose();
                        }}
                      >
                        <Layers size={13} />
                        <span>Gộp vào đây</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {mode === 'image' && (
          <>
            <h2>Xuất trang tính thành Hình ảnh độ nét cao (.PNG)</h2>
            <div className="dialog-subtitle">
              Kết xuất trực tiếp từ dữ liệu và định dạng ô thực tế sang ảnh PNG sắc nét để gửi báo cáo nhanh.
            </div>

            <label className="field">
              <span className="field-label">Độ phân giải kết xuất</span>
              <select className="text-field" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                <option value={1}>Tiêu chuẩn 1x (Nhẹ, gửi nhanh)</option>
                <option value={2}>Sắc nét Retina 2x (Khuyên dùng)</option>
                <option value={3}>Siêu nét In ấn 3x (Ultra HD)</option>
              </select>
            </label>

            <label className="check-field">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              <span>Vẽ đường kẻ lưới ô (Gridlines) trên ảnh xuất</span>
            </label>

            <div className="dialog-actions">
              <button className="btn" onClick={onClose}>
                Huỷ
              </button>
              <button
                className="btn btn-sheet"
                onClick={async () => {
                  await onExportPng(scale, showGrid);
                  onClose();
                }}
              >
                <Image size={15} />
                <span>Tải ảnh PNG</span>
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function TemplatesGalleryModal({
  onSelectTemplate,
  onClose,
}: {
  onSelectTemplate: (
    templateId: 'budget' | 'payroll' | 'sales' | 'inventory' | 'cashbook' | 'project',
    asNewSheet: boolean
  ) => void;
  onClose: () => void;
}) {
  const [asNewSheet, setAsNewSheet] = useState(true);

  const items: Array<{
    id: 'budget' | 'payroll' | 'sales' | 'inventory' | 'cashbook' | 'project';
    title: string;
    desc: string;
    accent: string;
  }> = [
    { id: 'budget', title: 'Ngân sách hoạt động Quý', desc: 'Tổng hợp chi phí phòng ban với hàm SUM và tỷ trọng % tự động.', accent: '#107c41' },
    { id: 'payroll', title: 'Bảng lương & Chấm công', desc: 'Tính lương ngày công thực tế, phụ cấp, BHXH 10.5% và thực lĩnh.', accent: '#1d4ed8' },
    { id: 'sales', title: 'Doanh số & KPI Kinh doanh', desc: 'Đánh giá tỷ lệ hoàn thành chỉ tiêu và xếp loại tự động bằng hàm IF.', accent: '#6d28d9' },
    { id: 'inventory', title: 'Nhập Xuất Tồn Kho Vật Tư', desc: 'Tính tồn cuối kỳ, giá trị kho và cảnh báo chạm ngưỡng tồn an toàn.', accent: '#ea580c' },
    { id: 'cashbook', title: 'Sổ Quỹ Thu Chi Kế Toán', desc: 'Theo dõi phiếu thu, phiếu chi và số dư tồn quỹ luỹ kế theo dòng.', accent: '#0f766e' },
    { id: 'project', title: 'Dự Toán & Tiến Độ Dự Án', desc: 'Quản lý ngày công, dự toán, giải ngân thực tế và chênh lệch ngân sách.', accent: '#3730a3' },
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width: 700 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Kho mẫu nghiệp vụ Minh Sheets chuẩn doanh nghiệp</h2>
        <div className="dialog-subtitle">
          Tất cả mẫu đều tích hợp sẵn công thức Excel sống (SUM, AVERAGE, IF, tỷ trọng, luỹ kế).
        </div>

        <label className="check-field" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={asNewSheet} onChange={(e) => setAsNewSheet(e.target.checked)} />
          <span>Chèn mẫu thành 1 Sheet mới trong tệp hiện tại (giữ nguyên các Sheet đang làm)</span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map((item) => (
            <button
              key={item.id}
              className="template-card"
              style={{ padding: 14, gap: 6 }}
              onClick={() => {
                onSelectTemplate(item.id, asNewSheet);
                onClose();
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, color: item.accent }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VersionHistoryModal({
  versions,
  onCreateSnapshot,
  onRestore,
  onDelete,
  onClose,
}: {
  versions: FileVersion[];
  onCreateSnapshot: (label: string) => Promise<void>;
  onRestore: (v: FileVersion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 520 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>
          <History size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Lịch sử phiên bản Bảng tính
        </h2>
        <div className="dialog-subtitle">Đánh dấu mốc quan trọng và khôi phục dữ liệu bất kỳ lúc nào.</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="text-field"
            placeholder="Tên mốc lưu (VD: Trước khi chốt sổ Q4)…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="btn btn-sheet"
            onClick={async () => {
              await onCreateSnapshot(label);
              setLabel('');
            }}
          >
            <Bookmark size={14} />
            <span>Tạo mốc</span>
          </button>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
          {versions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              Chưa có mốc phiên bản nào được ghi lại.
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {new Date(v.timestamp).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" style={{ minHeight: 28, padding: '2px 8px', fontSize: 11.5 }} onClick={() => void onRestore(v)}>
                    Khôi phục
                  </button>
                  <button className="icon-btn" style={{ color: 'var(--accent)' }} onClick={() => void onDelete(v.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function ShareAndProtectModal({
  title,
  isProtected,
  onCopySummaryTsv,
  onExportXlsx,
  onExportJson,
  onToggleProtect,
  onShareTeam,
  onClose,
}: {
  title: string;
  isProtected: boolean;
  onShareTeam?: () => void;
  onCopySummaryTsv: () => Promise<void>;
  onExportXlsx: () => Promise<void>;
  onExportJson: () => void;
  onToggleProtect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog" style={{ width: 480 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Chia sẻ & Bảo vệ dữ liệu — {title}</h2>
        <div className="dialog-subtitle">
          Gửi bảng tính cho người khác hoặc đưa lên nhóm để mọi thành viên dùng chung.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onShareTeam && (
            <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={onShareTeam}>
              <TeamUsers size={16} color="#107c41" />
              <span>Chia sẻ với nhóm để cùng mở và sửa chung</span>
            </button>
          )}

          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={() => void onCopySummaryTsv()}>
            <Copy size={16} color="#107c41" />
            <span>Sao chép toàn bộ bảng (TSV) để dán sang Zalo / Email / Word</span>
          </button>

          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={() => void onExportXlsx()}>
            <Download size={16} color="#1d4ed8" />
            <span>Tải tệp chuẩn Microsoft Excel (.xlsx) gửi đối tác</span>
          </button>

          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={onExportJson}>
            <Download size={16} color="#6d28d9" />
            <span>Xuất dữ liệu cấu trúc JSON cho API / BI Dashboard</span>
          </button>

          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={onToggleProtect}>
            <ShieldCheck size={16} color={isProtected ? '#dc2626' : '#0f766e'} />
            <span>{isProtected ? 'Mở khoá cho phép chỉnh sửa lại bảng tính' : 'Khoá bảo vệ bảng tính (Chế độ Chỉ đọc)'}</span>
          </button>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Hoàn tất
          </button>
        </div>
      </section>
    </div>
  );
}

export function HelpShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = SHEET_SHORTCUT_HELP;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" style={{ width: 600 }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>Phím tắt & Hướng dẫn nhanh Minh Sheets</h2>
        <div className="dialog-subtitle">Tăng tốc thao tác kế toán, tài chính và xử lý bảng biểu chuyên nghiệp.</div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'auto', maxHeight: '60vh' }}>
          <table className="file-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ width: 250 }}>Tổ hợp phím</th>
                <th>Chức năng thực thi</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map(([k, desc]) => (
                <tr key={k}>
                  <td>
                    <span className="keycap" style={{ fontWeight: 700, color: '#0f172a' }}>{k}</span>
                  </td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-sheet" onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </section>
    </div>
  );
}
