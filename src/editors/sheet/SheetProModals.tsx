import { useMemo, useState, type ReactNode } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowDownUp,
  ListFilter,
  Sigma,
  Calculator,
  Omega,
  Shapes,
  Crosshair,
  Accessibility,
  CheckCircle2,
  AlertTriangle,
  Info,
  PaintBucket,
} from 'lucide-react';
import { THEME_COLOR_SWATCHES } from './sheetUtils';
import {
  NUMBER_FORMAT_CATEGORIES,
  formatNumberPreview,
  SUBTOTAL_FN_LABELS,
  FILTER_OPERATOR_LABELS,
  filterRecords,
  SPECIAL_CELL_LABELS,
  SYMBOL_GROUPS,
  SHAPE_LABELS,
  buildShapeSvg,
  parseNumberList,
  type FilterCriterion,
  type FilterOperator,
  type ShapeKind,
  type ShapeSpec,
  type SpecialCellKind,
  type SubtotalFn,
  type AccessibilityIssue,
} from './sheetPro';

export function ProDialog({
  title,
  subtitle,
  width = 560,
  onClose,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog pro-dialog" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {subtitle && <div className="dialog-subtitle">{subtitle}</div>}
        <div className="pro-dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </section>
    </div>
  );
}

const COMPACT_SWATCHES = ['#000000', '#334155', '#94a3b8', '#ffffff', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#107c41', '#0284c7', '#2563eb', '#7c3aed', '#fee2e2', '#fef9c3', '#dcfce7', '#dbeafe'];

function SwatchRow({ value, onPick, allowNone, compact }: { value: string; onPick: (c: string) => void; allowNone?: boolean; compact?: boolean }) {
  return (
    <div className="pro-swatches">
      {allowNone && (
        <button className={`pro-swatch none ${value === '' ? 'active' : ''}`} title="Không màu" onClick={() => onPick('')}>
          <X size={12} />
        </button>
      )}
      {(compact ? COMPACT_SWATCHES : THEME_COLOR_SWATCHES).map((c) => (
        <button
          key={c}
          className={`pro-swatch ${value.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
          style={{ background: c }}
          title={c}
          aria-label={`Màu ${c}`}
          onClick={() => onPick(c)}
        />
      ))}
      <input type="color" className="pro-color-input" value={value || '#ffffff'} onChange={(e) => onPick(e.target.value)} aria-label="Chọn màu khác" />
    </div>
  );
}

export interface FormatCellsState {
  numberFormat: string;
  hAlign: 'left' | 'center' | 'normal';
  vAlign: 'top' | 'middle' | 'bottom';
  wrap: boolean;
  rotation: number;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontColor: string;
  fill: string;
  border: 'keep' | 'all' | 'outside' | 'thickOutside' | 'bottom' | 'none';
  borderColor: string;
}

type FormatTab = 'number' | 'align' | 'font' | 'border' | 'fill';

const FONT_CHOICES = ['Arial', 'Segoe UI', 'Times New Roman', 'Calibri', 'Cambria', 'Tahoma', 'Verdana', 'Roboto', 'Consolas'];

export function FormatCellsModal({
  rangeA1,
  sampleValue,
  initial,
  onApply,
  onClose,
}: {
  rangeA1: string;
  sampleValue: unknown;
  initial: FormatCellsState;
  onApply: (state: FormatCellsState) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FormatTab>('number');
  const [st, setSt] = useState<FormatCellsState>(initial);
  const [category, setCategory] = useState(() => {
    const hit = NUMBER_FORMAT_CATEGORIES.find((c) => c.patterns.some((p) => p.pattern === initial.numberFormat));
    return hit?.id ?? 'general';
  });
  const set = <K extends keyof FormatCellsState>(key: K, value: FormatCellsState[K]) => setSt((prev) => ({ ...prev, [key]: value }));
  const cat = NUMBER_FORMAT_CATEGORIES.find((c) => c.id === category) ?? NUMBER_FORMAT_CATEGORIES[0];
  const preview = formatNumberPreview(sampleValue === '' || sampleValue === null || sampleValue === undefined ? 1234567.891 : sampleValue, st.numberFormat);

  const tabs: { id: FormatTab; label: string }[] = [
    { id: 'number', label: 'Số' },
    { id: 'align', label: 'Căn lề' },
    { id: 'font', label: 'Phông chữ' },
    { id: 'border', label: 'Viền' },
    { id: 'fill', label: 'Tô nền' },
  ];

  return (
    <ProDialog
      title="Định dạng ô (Format Cells)"
      subtitle={`Áp dụng cho vùng ${rangeA1} — phím tắt Ctrl + 1`}
      width={640}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-sheet" onClick={() => onApply(st)}>Áp dụng</button>
        </>
      }
    >
      <div className="pro-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`filter-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'number' && (
        <div className="pro-two-col">
          <div className="pro-list" role="listbox" aria-label="Nhóm định dạng">
            {NUMBER_FORMAT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`pro-list-item ${category === c.id ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c.id);
                  set('numberFormat', c.patterns[0].pattern);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div>
            <div className="pro-preview" aria-live="polite">
              <span className="field-label">Xem trước</span>
              <strong>{preview || '—'}</strong>
            </div>
            <div className="pro-list compact">
              {cat.patterns.map((p) => (
                <button key={p.pattern} className={`pro-list-item ${st.numberFormat === p.pattern ? 'active' : ''}`} onClick={() => set('numberFormat', p.pattern)}>
                  <span>{p.label}</span>
                  <code>{p.pattern}</code>
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">Mã định dạng tuỳ chỉnh (Custom)</span>
              <input className="text-field" value={st.numberFormat} onChange={(e) => set('numberFormat', e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {tab === 'align' && (
        <div className="pro-grid-2">
          <label className="field">
            <span className="field-label">Căn ngang</span>
            <select className="text-field" value={st.hAlign} onChange={(e) => set('hAlign', e.target.value as FormatCellsState['hAlign'])}>
              <option value="left">Trái</option>
              <option value="center">Giữa</option>
              <option value="normal">Phải</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Căn dọc</span>
            <select className="text-field" value={st.vAlign} onChange={(e) => set('vAlign', e.target.value as FormatCellsState['vAlign'])}>
              <option value="top">Trên</option>
              <option value="middle">Giữa</option>
              <option value="bottom">Dưới</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Xoay chữ: {st.rotation}°</span>
            <input type="range" min={-90} max={90} step={5} value={st.rotation} onChange={(e) => set('rotation', Number(e.target.value))} />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={st.wrap} onChange={(e) => set('wrap', e.target.checked)} />
            <span>Tự xuống dòng trong ô (Wrap text)</span>
          </label>
        </div>
      )}

      {tab === 'font' && (
        <div className="pro-grid-2">
          <label className="field">
            <span className="field-label">Phông chữ</span>
            <select className="text-field" value={st.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
              {FONT_CHOICES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Cỡ chữ</span>
            <input className="text-field" type="number" min={6} max={96} value={st.fontSize} onChange={(e) => set('fontSize', Math.max(6, Math.min(96, Number(e.target.value) || 11)))} />
          </label>
          <div className="pro-checks">
            <label className="check-field"><input type="checkbox" checked={st.bold} onChange={(e) => set('bold', e.target.checked)} /><span>Đậm</span></label>
            <label className="check-field"><input type="checkbox" checked={st.italic} onChange={(e) => set('italic', e.target.checked)} /><span>Nghiêng</span></label>
            <label className="check-field"><input type="checkbox" checked={st.underline} onChange={(e) => set('underline', e.target.checked)} /><span>Gạch chân</span></label>
            <label className="check-field"><input type="checkbox" checked={st.strike} onChange={(e) => set('strike', e.target.checked)} /><span>Gạch ngang</span></label>
          </div>
          <div className="field">
            <span className="field-label">Màu chữ</span>
            <SwatchRow value={st.fontColor} onPick={(c) => set('fontColor', c || '#0f172a')} />
          </div>
          <div
            className="pro-font-sample"
            style={{
              fontFamily: st.fontFamily,
              fontSize: Math.min(st.fontSize, 28),
              fontWeight: st.bold ? 700 : 400,
              fontStyle: st.italic ? 'italic' : 'normal',
              textDecoration: [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].join(' ').trim() || 'none',
              color: st.fontColor,
              background: st.fill || '#ffffff',
            }}
          >
            Minh Sheets AaBb 123
          </div>
        </div>
      )}

      {tab === 'border' && (
        <div className="pro-stack">
          <div className="pro-border-grid">
            {(
              [
                ['keep', 'Giữ nguyên'],
                ['all', 'Mọi đường viền'],
                ['outside', 'Viền ngoài'],
                ['thickOutside', 'Viền ngoài đậm'],
                ['bottom', 'Viền dưới'],
                ['none', 'Không viền'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={`pro-border-option ${st.border === id ? 'active' : ''}`} onClick={() => set('border', id)}>
                <span className={`pro-border-glyph ${id}`} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="field">
            <span className="field-label">Màu viền</span>
            <SwatchRow value={st.borderColor} onPick={(c) => set('borderColor', c || '#0f172a')} />
          </div>
        </div>
      )}

      {tab === 'fill' && (
        <div className="pro-stack">
          <div className="field">
            <span className="field-label">Màu nền ô</span>
            <SwatchRow value={st.fill} onPick={(c) => set('fill', c)} allowNone />
          </div>
          <div className="pro-fill-sample" style={{ background: st.fill || '#ffffff', color: st.fontColor }}>
            <PaintBucket size={16} /> Mẫu nền ô
          </div>
        </div>
      )}
    </ProDialog>
  );
}

export interface SortLevel {
  column: number;
  ascending: boolean;
}

export function CustomSortModal({
  rangeA1,
  headers,
  onApply,
  onClose,
}: {
  rangeA1: string;
  headers: string[];
  onApply: (levels: SortLevel[], hasHeader: boolean) => void;
  onClose: () => void;
}) {
  const [hasHeader, setHasHeader] = useState(true);
  const [levels, setLevels] = useState<SortLevel[]>([{ column: 0, ascending: true }]);
  const label = (i: number) => (hasHeader ? headers[i] || `Cột ${i + 1}` : `Cột ${String.fromCharCode(65 + (i % 26))}`);
  const update = (idx: number, patch: Partial<SortLevel>) => setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  return (
    <ProDialog
      title="Sắp xếp tuỳ chỉnh nhiều cấp (Custom Sort)"
      subtitle={`Vùng dữ liệu ${rangeA1}. Cấp trên được ưu tiên trước, cấp dưới phân xử khi trùng.`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-sheet" onClick={() => onApply(levels, hasHeader)}>
            <ArrowDownUp size={15} /> <span>Sắp xếp</span>
          </button>
        </>
      }
    >
      <label className="check-field">
        <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
        <span>Dữ liệu có dòng tiêu đề (không sắp xếp dòng đầu)</span>
      </label>
      <div className="pro-rows">
        {levels.map((lv, idx) => (
          <div key={idx} className="pro-row tagged">
            <span className="pro-row-tag">{idx === 0 ? 'Sắp theo' : 'Rồi theo'}</span>
            <select className="text-field" value={lv.column} onChange={(e) => update(idx, { column: Number(e.target.value) })} aria-label="Cột sắp xếp">
              {headers.map((_, i) => (
                <option key={i} value={i}>{label(i)}</option>
              ))}
            </select>
            <select className="text-field" value={lv.ascending ? 'asc' : 'desc'} onChange={(e) => update(idx, { ascending: e.target.value === 'asc' })} aria-label="Thứ tự">
              <option value="asc">Tăng dần (A → Z, nhỏ → lớn)</option>
              <option value="desc">Giảm dần (Z → A, lớn → nhỏ)</option>
            </select>
            <button className="icon-btn" disabled={levels.length === 1} onClick={() => setLevels((prev) => prev.filter((_, i) => i !== idx))} aria-label="Xoá cấp">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn" disabled={levels.length >= Math.min(6, headers.length)} onClick={() => setLevels((prev) => [...prev, { column: Math.min(headers.length - 1, prev.length), ascending: true }])}>
        <Plus size={14} /> <span>Thêm cấp sắp xếp</span>
      </button>
    </ProDialog>
  );
}

export function SubtotalModal({
  rangeA1,
  headers,
  numericColumns,
  onApply,
  onClose,
}: {
  rangeA1: string;
  headers: string[];
  numericColumns: number[];
  onApply: (groupCol: number, fn: SubtotalFn, valueCols: number[]) => void;
  onClose: () => void;
}) {
  const [groupCol, setGroupCol] = useState(0);
  const [fn, setFn] = useState<SubtotalFn>('SUM');
  const [valueCols, setValueCols] = useState<number[]>(numericColumns.filter((c) => c !== 0));
  const toggle = (c: number) => setValueCols((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].sort((a, b) => a - b)));
  return (
    <ProDialog
      title="Tổng phụ theo nhóm (Subtotal)"
      subtitle={`Dữ liệu ${rangeA1} được nhóm, chèn dòng tổng phụ =SUBTOTAL(...) và tổng chung ra một Sheet mới.`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-sheet" disabled={!valueCols.length} onClick={() => onApply(groupCol, fn, valueCols)}>
            <Sigma size={15} /> <span>Tạo tổng phụ</span>
          </button>
        </>
      }
    >
      <div className="pro-grid-2">
        <label className="field">
          <span className="field-label">Mỗi khi thay đổi ở cột</span>
          <select className="text-field" value={groupCol} onChange={(e) => setGroupCol(Number(e.target.value))}>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Dùng hàm</span>
          <select className="text-field" value={fn} onChange={(e) => setFn(e.target.value as SubtotalFn)}>
            {(Object.keys(SUBTOTAL_FN_LABELS) as SubtotalFn[]).map((k) => (
              <option key={k} value={k}>{SUBTOTAL_FN_LABELS[k]}</option>
            ))}
          </select>
        </label>
      </div>
      <span className="field-label">Cộng tổng phụ cho các cột</span>
      <div className="pro-checks wrap">
        {headers.map((h, i) =>
          i === groupCol ? null : (
            <label key={i} className="check-field">
              <input type="checkbox" checked={valueCols.includes(i)} onChange={() => toggle(i)} />
              <span>{h || `Cột ${i + 1}`}{numericColumns.includes(i) ? '' : ' (chữ)'}</span>
            </label>
          )
        )}
      </div>
    </ProDialog>
  );
}

export function AdvancedFilterModal({
  rangeA1,
  headers,
  rows,
  onApply,
  onClose,
}: {
  rangeA1: string;
  headers: string[];
  rows: unknown[][];
  onApply: (criteria: FilterCriterion[], mode: 'and' | 'or', unique: boolean) => void;
  onClose: () => void;
}) {
  const [criteria, setCriteria] = useState<FilterCriterion[]>([{ column: 0, operator: 'contains', value: '' }]);
  const [mode, setMode] = useState<'and' | 'or'>('and');
  const [unique, setUnique] = useState(false);
  const matched = useMemo(() => filterRecords(rows, criteria, mode, unique).length, [rows, criteria, mode, unique]);
  const update = (idx: number, patch: Partial<FilterCriterion>) => setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const noValueOps: FilterOperator[] = ['blank', 'notBlank'];
  return (
    <ProDialog
      title="Lọc nâng cao (Advanced Filter)"
      subtitle={`Lọc ${rows.length} dòng của ${rangeA1} theo nhiều điều kiện, xuất kết quả ra Sheet mới, không làm đổi dữ liệu gốc.`}
      width={640}
      onClose={onClose}
      actions={
        <>
          <span className="pro-count">{matched}/{rows.length} dòng khớp</span>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-sheet" disabled={matched === 0} onClick={() => onApply(criteria, mode, unique)}>
            <ListFilter size={15} /> <span>Xuất kết quả lọc</span>
          </button>
        </>
      }
    >
      <div className="pro-tabs">
        <button className={`filter-tab ${mode === 'and' ? 'active' : ''}`} onClick={() => setMode('and')}>Khớp TẤT CẢ điều kiện (VÀ)</button>
        <button className={`filter-tab ${mode === 'or' ? 'active' : ''}`} onClick={() => setMode('or')}>Khớp MỘT điều kiện (HOẶC)</button>
      </div>
      <div className="pro-rows">
        {criteria.map((c, idx) => (
          <div key={idx} className="pro-row">
            <select className="text-field" value={c.column} onChange={(e) => update(idx, { column: Number(e.target.value) })} aria-label="Cột">
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>
              ))}
            </select>
            <select className="text-field" value={c.operator} onChange={(e) => update(idx, { operator: e.target.value as FilterOperator })} aria-label="Phép so sánh">
              {(Object.keys(FILTER_OPERATOR_LABELS) as FilterOperator[]).map((op) => (
                <option key={op} value={op}>{FILTER_OPERATOR_LABELS[op]}</option>
              ))}
            </select>
            <input className="text-field" value={c.value} disabled={noValueOps.includes(c.operator)} placeholder="Giá trị" onChange={(e) => update(idx, { value: e.target.value })} aria-label="Giá trị" />
            <button className="icon-btn" disabled={criteria.length === 1} onClick={() => setCriteria((prev) => prev.filter((_, i) => i !== idx))} aria-label="Xoá điều kiện">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="pro-inline">
        <button className="btn" onClick={() => setCriteria((prev) => [...prev, { column: 0, operator: 'eq', value: '' }])}>
          <Plus size={14} /> <span>Thêm điều kiện</span>
        </button>
        <label className="check-field">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          <span>Chỉ giữ bản ghi duy nhất</span>
        </label>
      </div>
    </ProDialog>
  );
}

export function DataTableModal({
  activeCellA1,
  onRun,
  onClose,
}: {
  activeCellA1: string;
  onRun: (inputCell: string, outputCell: string, values: number[]) => Promise<string>;
  onClose: () => void;
}) {
  const [inputCell, setInputCell] = useState('');
  const [outputCell, setOutputCell] = useState(activeCellA1);
  const [valuesText, setValuesText] = useState('');
  const [msg, setMsg] = useState('');
  const [running, setRunning] = useState(false);
  const values = parseNumberList(valuesText);
  const run = async () => {
    setRunning(true);
    try {
      setMsg(await onRun(inputCell.trim(), outputCell.trim(), values));
    } finally {
      setRunning(false);
    }
  };
  return (
    <ProDialog
      title="Bảng dữ liệu What-If (Data Table)"
      subtitle="Thử lần lượt nhiều giá trị cho một ô đầu vào, ghi lại kết quả của ô công thức thành bảng ở Sheet mới. Ô đầu vào được trả về giá trị cũ sau khi chạy."
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-sheet" disabled={running || !values.length || !inputCell || !outputCell} onClick={() => void run()}>
            <Calculator size={15} /> <span>{running ? 'Đang tính…' : `Chạy ${values.length} giá trị`}</span>
          </button>
        </>
      }
    >
      <div className="pro-grid-2">
        <label className="field">
          <span className="field-label">Ô đầu vào thay đổi (Input cell)</span>
          <input className="text-field" value={inputCell} placeholder="Ví dụ: B3" onChange={(e) => setInputCell(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Ô công thức kết quả (Result cell)</span>
          <input className="text-field" value={outputCell} placeholder="Ví dụ: E8" onChange={(e) => setOutputCell(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Danh sách giá trị thử (cách nhau bởi ; hoặc dạng "100 đến 200 bước 25")</span>
        <textarea className="text-field" rows={3} value={valuesText} onChange={(e) => setValuesText(e.target.value)} placeholder="100000000; 120000000; 150000000" />
      </label>
      {values.length > 0 && <div className="pro-hint">Sẽ thử: {values.slice(0, 12).map((v) => v.toLocaleString('vi-VN')).join(' · ')}{values.length > 12 ? ' …' : ''}</div>}
      {msg && <div className="pro-result">{msg}</div>}
    </ProDialog>
  );
}

export function SymbolPickerModal({ onInsert, onClose }: { onInsert: (symbol: string) => void; onClose: () => void }) {
  const [group, setGroup] = useState(SYMBOL_GROUPS[0].id);
  const [buffer, setBuffer] = useState('');
  const current = SYMBOL_GROUPS.find((g) => g.id === group) ?? SYMBOL_GROUPS[0];
  return (
    <ProDialog
      title="Chèn ký hiệu (Symbol)"
      subtitle="Bấm ký hiệu để thêm vào chuỗi, rồi chèn vào cuối nội dung ô đang chọn."
      width={600}
      onClose={onClose}
      actions={
        <>
          <input className="text-field pro-symbol-buffer" value={buffer} onChange={(e) => setBuffer(e.target.value)} aria-label="Chuỗi ký hiệu" />
          <button className="btn" onClick={() => setBuffer('')}>Xoá</button>
          <button className="btn btn-sheet" disabled={!buffer} onClick={() => onInsert(buffer)}>
            <Omega size={15} /> <span>Chèn vào ô</span>
          </button>
        </>
      }
    >
      <div className="pro-tabs wrap">
        {SYMBOL_GROUPS.map((g) => (
          <button key={g.id} className={`filter-tab ${group === g.id ? 'active' : ''}`} onClick={() => setGroup(g.id)}>{g.label}</button>
        ))}
      </div>
      <div className="pro-symbol-grid">
        {current.symbols.map((s) => (
          <button key={s} className="pro-symbol" onClick={() => setBuffer((b) => b + s)} title={s}>{s}</button>
        ))}
      </div>
    </ProDialog>
  );
}

const SHAPE_SIZES: Record<ShapeKind, [number, number]> = {
  rect: [240, 110],
  rounded: [240, 110],
  ellipse: [220, 130],
  arrow: [260, 110],
  callout: [260, 140],
  star: [170, 170],
  banner: [360, 90],
  textbox: [300, 120],
};

export function ShapeInsertModal({
  initialKind,
  onInsert,
  onClose,
}: {
  initialKind: ShapeKind;
  onInsert: (spec: ShapeSpec) => void;
  onClose: () => void;
}) {
  const [spec, setSpec] = useState<ShapeSpec>(() => ({
    kind: initialKind,
    width: SHAPE_SIZES[initialKind][0],
    height: SHAPE_SIZES[initialKind][1],
    fill: initialKind === 'textbox' ? '#ffffff' : '#dcfce7',
    stroke: initialKind === 'textbox' ? '#94a3b8' : '#15803d',
    strokeWidth: 2,
    text: initialKind === 'textbox' ? 'Nhập ghi chú, giải trình số liệu…' : 'Nội dung',
    textColor: '#0f172a',
    fontSize: 15,
    bold: initialKind !== 'textbox',
  }));
  const set = <K extends keyof ShapeSpec>(k: K, v: ShapeSpec[K]) => setSpec((p) => ({ ...p, [k]: v }));
  const svg = useMemo(() => buildShapeSvg(spec), [spec]);
  return (
    <ProDialog
      title={spec.kind === 'textbox' ? 'Chèn hộp văn bản (Text Box)' : 'Chèn hình dạng (Shapes)'}
      subtitle="Hình được chèn nổi trên lưới tại ô đang chọn; kéo để di chuyển, kéo góc để đổi cỡ."
      width={700}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-sheet" onClick={() => onInsert(spec)}>
            <Shapes size={15} /> <span>Chèn vào trang tính</span>
          </button>
        </>
      }
    >
      <div className="pro-shape-kinds">
        {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((k) => (
          <button
            key={k}
            className={`pro-list-item ${spec.kind === k ? 'active' : ''}`}
            onClick={() => setSpec((p) => ({ ...p, kind: k, width: SHAPE_SIZES[k][0], height: SHAPE_SIZES[k][1] }))}
          >
            {SHAPE_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="pro-two-col even">
        <div>
          <label className="field">
            <span className="field-label">Nội dung chữ</span>
            <textarea className="text-field" rows={2} value={spec.text} onChange={(e) => set('text', e.target.value)} />
          </label>
          <div className="pro-grid-2">
            <label className="field">
              <span className="field-label">Rộng (px)</span>
              <input className="text-field" type="number" min={40} max={900} value={spec.width} onChange={(e) => set('width', Math.max(40, Math.min(900, Number(e.target.value) || 40)))} />
            </label>
            <label className="field">
              <span className="field-label">Cao (px)</span>
              <input className="text-field" type="number" min={30} max={700} value={spec.height} onChange={(e) => set('height', Math.max(30, Math.min(700, Number(e.target.value) || 30)))} />
            </label>
            <label className="field">
              <span className="field-label">Cỡ chữ</span>
              <input className="text-field" type="number" min={8} max={72} value={spec.fontSize} onChange={(e) => set('fontSize', Math.max(8, Math.min(72, Number(e.target.value) || 14)))} />
            </label>
            <label className="field">
              <span className="field-label">Độ dày viền</span>
              <input className="text-field" type="number" min={0} max={12} value={spec.strokeWidth} onChange={(e) => set('strokeWidth', Math.max(0, Math.min(12, Number(e.target.value) || 0)))} />
            </label>
          </div>
          <label className="check-field">
            <input type="checkbox" checked={spec.bold} onChange={(e) => set('bold', e.target.checked)} />
            <span>Chữ đậm</span>
          </label>
          <div className="field"><span className="field-label">Màu nền</span><SwatchRow value={spec.fill} onPick={(c) => set('fill', c || 'none')} allowNone compact /></div>
          <div className="field"><span className="field-label">Màu viền</span><SwatchRow value={spec.stroke} onPick={(c) => set('stroke', c || 'none')} allowNone compact /></div>
          <div className="field"><span className="field-label">Màu chữ</span><SwatchRow value={spec.textColor} onPick={(c) => set('textColor', c || '#0f172a')} compact /></div>
        </div>
        <div className="pro-shape-preview" aria-label="Xem trước hình" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </ProDialog>
  );
}

export function GoToSpecialModal({
  scopeA1,
  onApply,
  onClose,
}: {
  scopeA1: string;
  onApply: (kind: SpecialCellKind, action: 'select' | 'highlight') => string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<SpecialCellKind>('blanks');
  const [msg, setMsg] = useState('');
  return (
    <ProDialog
      title="Đi tới ô đặc biệt (Go To Special)"
      subtitle={`Tìm trong vùng ${scopeA1}. Chọn tất cả ô khớp hoặc tô vàng để rà soát.`}
      width={500}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn" onClick={() => setMsg(onApply(kind, 'highlight'))}>Tô vàng</button>
          <button className="btn btn-sheet" onClick={() => setMsg(onApply(kind, 'select'))}>
            <Crosshair size={15} /> <span>Chọn các ô</span>
          </button>
        </>
      }
    >
      <div className="pro-radio-list" role="radiogroup">
        {(Object.keys(SPECIAL_CELL_LABELS) as SpecialCellKind[]).map((k) => (
          <label key={k} className="check-field">
            <input type="radio" name="special" checked={kind === k} onChange={() => setKind(k)} />
            <span>{SPECIAL_CELL_LABELS[k]}</span>
          </label>
        ))}
      </div>
      {msg && <div className="pro-result">{msg}</div>}
    </ProDialog>
  );
}

export function AccessibilityCheckerModal({
  issues,
  onGoTo,
  onClose,
}: {
  issues: AccessibilityIssue[];
  onGoTo: (sheet: string, where: string) => void;
  onClose: () => void;
}) {
  const icon = (sev: AccessibilityIssue['severity']) =>
    sev === 'error' ? <AlertTriangle size={16} color="#dc2626" /> : sev === 'warning' ? <AlertTriangle size={16} color="#d97706" /> : <Info size={16} color="#2563eb" />;
  return (
    <ProDialog
      title="Kiểm tra trợ năng (Accessibility)"
      subtitle="Rà toàn bộ Workbook theo WCAG: độ tương phản chữ/nền, ô gộp, Sheet ẩn, tên Sheet và tiêu đề cột."
      width={620}
      onClose={onClose}
      actions={<button className="btn btn-sheet" onClick={onClose}>Xong</button>}
    >
      {issues.length === 0 ? (
        <div className="pro-result ok">
          <CheckCircle2 size={16} /> Không phát hiện vấn đề trợ năng nào. Bảng tính dễ đọc với mọi người dùng.
        </div>
      ) : (
        <div className="pro-issue-list">
          {issues.map((it, i) => (
            <button key={i} className={`pro-issue ${it.severity}`} onClick={() => onGoTo(it.sheet, it.where)}>
              {icon(it.severity)}
              <div>
                <div className="pro-issue-title">
                  <strong>{it.sheet}</strong> · {it.where}
                </div>
                <div>{it.message}</div>
                <div className="pro-issue-fix">Cách sửa: {it.fix}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="pro-hint">
        <Accessibility size={14} /> {issues.filter((i) => i.severity === 'error').length} lỗi · {issues.filter((i) => i.severity === 'warning').length} cảnh báo · {issues.filter((i) => i.severity === 'tip').length} gợi ý
      </div>
    </ProDialog>
  );
}
