import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { insertMetaImage } from '../../insertActions';
import { CHART_KINDS, CHART_PALETTES, CHART_TEMPLATES, parseChartData, type ChartKind, type ChartSpec } from '../../insertCharts';
import { chartDataUrl, chartThumb } from '../../chartRender';
import Modal from '../Modal';

const DEFAULT_SPEC: ChartSpec = { kind: 'column', title: CHART_TEMPLATES[0].title, raw: CHART_TEMPLATES[0].raw, palette: 'office', legend: true, labels: false, grid: true };
const KIND_GROUPS = [...new Set(CHART_KINDS.map((item) => item.group))];

export function ChartDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const meta = ctx.editing?.attrs.meta as (Omit<Partial<ChartSpec>, 'kind'> & { chartKind?: ChartKind }) | undefined;
  const [spec, setSpec] = useState<ChartSpec>({ ...DEFAULT_SPEC, ...meta, kind: meta?.chartKind ?? DEFAULT_SPEC.kind });
  const patch = (next: Partial<ChartSpec>) => setSpec((current) => ({ ...current, ...next }));
  const thumbs = useMemo(() => Object.fromEntries(CHART_KINDS.map((item) => [item.id, chartThumb(item.id, spec.palette)])) as Record<ChartKind, string>, [spec.palette]);
  const preview = useMemo(() => chartDataUrl(spec), [spec]);
  const hasData = parseChartData(spec.raw).categories.length > 0;
  const kind = CHART_KINDS.find((item) => item.id === spec.kind) ?? CHART_KINDS[0];
  const pickKind = (id: ChartKind) => {
    const sample = CHART_TEMPLATES.find((item) => item.kind === id);
    const usingSample = CHART_TEMPLATES.some((item) => item.raw === spec.raw);
    patch(sample && usingSample ? { kind: id, raw: sample.raw, title: sample.title } : { kind: id });
  };
  const close = () => { ctx.setEditing(null); onClose(); };
  const apply = () => {
    insertMetaImage(ctx, { src: preview, alt: spec.title || 'Biểu đồ', meta: { ...spec, kind: 'chart', chartKind: spec.kind }, width: '100%' });
    close();
  };
  return (
    <Modal title={ctx.editing ? 'Sửa biểu đồ' : 'Chèn biểu đồ'} subtitle={`${CHART_KINDS.length} loại biểu đồ. Dán thẳng dữ liệu từ Excel được. Nhấp đúp biểu đồ để sửa lại.`} icon={<BarChart3 size={20} />} onClose={close} width={1080}
      actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!hasData} onClick={apply}>{ctx.editing ? 'Lưu' : 'Chèn biểu đồ'}</button></>}>
      <div className="chart-studio">
        <div className="insert-thumb-scroll chart-kinds">
          {KIND_GROUPS.map((group) => (
            <div key={group}>
              <div className="ribbon-menu-heading">{group}</div>
              <div className="insert-thumb-grid">
                {CHART_KINDS.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" className={`insert-thumb ${spec.kind === item.id ? 'on' : ''}`} title={item.label} onClick={() => pickKind(item.id)}><img src={thumbs[item.id]} alt="" /><span>{item.label}</span></button>)}
              </div>
            </div>
          ))}
        </div>
        <div className="chart-form">
          <label className="field"><span className="field-label">Mẫu dữ liệu</span>
            <select className="text-field" value="" onChange={(e) => { const sample = CHART_TEMPLATES.find((item) => item.id === e.target.value); if (sample) patch({ kind: sample.kind, raw: sample.raw, title: sample.title }); }}>
              <option value="">Chọn mẫu có sẵn…</option>
              {CHART_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label} ({CHART_KINDS.find((k) => k.id === item.kind)?.label})</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Tiêu đề</span><input className="text-field" value={spec.title} onChange={(e) => patch({ title: e.target.value })} /></label>
          <label className="field"><span className="field-label">Dữ liệu — {kind.hint}</span><textarea className="text-field insert-outline-input" rows={9} value={spec.raw} onChange={(e) => patch({ raw: e.target.value })} /></label>
          <label className="field"><span className="field-label">Bảng màu</span><select className="text-field" value={spec.palette} onChange={(e) => patch({ palette: e.target.value })}>{CHART_PALETTES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <div className="chart-toggles">
            <label className="insert-check"><input type="checkbox" checked={spec.legend} onChange={(e) => patch({ legend: e.target.checked })} /> Chú giải</label>
            <label className="insert-check"><input type="checkbox" checked={spec.labels} onChange={(e) => patch({ labels: e.target.checked })} /> Nhãn số liệu</label>
            <label className="insert-check"><input type="checkbox" checked={spec.grid} onChange={(e) => patch({ grid: e.target.checked })} /> Đường lưới</label>
          </div>
        </div>
        <div className="chart-preview">{hasData ? <img src={preview} alt="Xem trước biểu đồ" /> : 'Nhập dữ liệu để xem trước'}</div>
      </div>
    </Modal>
  );
}
