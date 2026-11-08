import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { ProDialog } from '../SheetProModals';
import { detectProvinceColumn, REGION_LABELS, summarizeByProvince, type RegionId } from '../../../lib/vnProvinces';

const REGION_COLOR: Record<RegionId, [number, number, number]> = { north: [2, 132, 199], central: [217, 119, 6], south: [16, 124, 65] };
const REGION_PATH: Record<RegionId, string> = {
  north: 'M70,12 L110,8 L150,30 L148,60 L132,78 L118,96 L104,104 L92,90 L70,80 L52,62 L44,40 Z',
  central: 'M104,104 L118,96 L132,78 L138,96 L130,120 L142,150 L150,185 L148,215 L136,236 L116,240 L108,215 L112,180 L104,150 L98,124 Z',
  south: 'M116,240 L136,236 L142,258 L128,284 L104,310 L80,330 L66,322 L70,296 L82,276 L100,256 Z',
};
const REGION_LABEL_AT: Record<RegionId, [number, number]> = { north: [98, 52], central: [126, 170], south: [104, 288] };
const REGIONS: RegionId[] = ['north', 'central', 'south'];
const COUNT_ROWS = -1;

const fill = (region: RegionId, share: number) => {
  const [r, g, b] = REGION_COLOR[region];
  return `rgba(${r}, ${g}, ${b}, ${(0.18 + 0.82 * share).toFixed(2)})`;
};
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const pct = (part: number, total: number) => (total ? `${((part / total) * 100).toFixed(1)}%` : '0%');

export function VietnamMapModal({
  headers,
  rows,
  numericColumns,
  onExportReport,
  onClose,
}: {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  numericColumns: number[];
  onExportReport: (headers: string[], rows: (string | number)[][]) => void;
  onClose: () => void;
}) {
  const [provinceCol, setProvinceCol] = useState(() => Math.max(0, detectProvinceColumn(headers, rows)));
  const [valueCol, setValueCol] = useState(() => numericColumns.find((c) => c !== provinceCol) ?? COUNT_ROWS);
  const summary = useMemo(() => summarizeByProvince(rows, provinceCol, valueCol === COUNT_ROWS ? null : valueCol), [rows, provinceCol, valueCol]);
  const maxRegion = Math.max(...REGIONS.map((r) => Math.abs(summary.regions[r])), 0);
  const maxProvince = Math.max(...summary.provinces.map((p) => Math.abs(p.value)), 0);
  const valueName = valueCol === COUNT_ROWS ? 'Số dòng' : headers[valueCol];

  const handleExport = () => {
    const out: (string | number)[][] = summary.provinces.map((p) => [p.province, REGION_LABELS[p.region], p.value, summary.total ? p.value / summary.total : 0, p.rows]);
    REGIONS.forEach((r) => out.push([`Tổng ${REGION_LABELS[r]}`, REGION_LABELS[r], summary.regions[r], summary.total ? summary.regions[r] / summary.total : 0, summary.provinces.filter((p) => p.region === r).reduce((n, p) => n + p.rows, 0)]));
    out.push(['Tổng cộng', '', summary.total, summary.total ? 1 : 0, summary.matchedRows]);
    onExportReport(['Tỉnh / thành', 'Miền', valueName, 'Tỷ trọng', 'Số dòng'], out);
  };

  return (
    <ProDialog
      title="Bản đồ phân bổ theo tỉnh thành Việt Nam"
      subtitle="Cộng số liệu của bảng đang chọn theo tỉnh/thành và theo 3 miền, nhận cả tên tỉnh cũ lẫn tên sau sáp nhập"
      width={780}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={!summary.matchedRows}>
            <MapPin size={15} /> Xuất báo cáo ra Sheet mới
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <label className="input-group" style={{ flex: 1 }}>
          <span className="input-label">Cột tỉnh / thành / địa chỉ</span>
          <select value={provinceCol} onChange={(e) => setProvinceCol(Number(e.target.value))} className="select-input" style={{ width: '100%', padding: '6px 8px' }}>
            {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
          </select>
        </label>
        <label className="input-group" style={{ flex: 1 }}>
          <span className="input-label">Giá trị cộng dồn</span>
          <select value={valueCol} onChange={(e) => setValueCol(Number(e.target.value))} className="select-input" style={{ width: '100%', padding: '6px 8px' }}>
            <option value={COUNT_ROWS}>Đếm số dòng</option>
            {numericColumns.map((c) => <option key={c} value={c}>{headers[c]}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 16 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
          <svg viewBox="0 0 200 345" style={{ width: '100%', height: 300 }} role="img" aria-label="Bản đồ Việt Nam theo 3 miền">
            {REGIONS.map((r) => (
              <g key={r}>
                <path d={REGION_PATH[r]} fill={fill(r, maxRegion ? Math.abs(summary.regions[r]) / maxRegion : 0)} stroke="#ffffff" strokeWidth={2}>
                  <title>{`${REGION_LABELS[r]}: ${fmt(summary.regions[r])} (${pct(summary.regions[r], summary.total)})`}</title>
                </path>
                <text x={REGION_LABEL_AT[r][0]} y={REGION_LABEL_AT[r][1]} fontSize={10} fontWeight={700} fill="#0f172a" textAnchor="middle">{pct(summary.regions[r], summary.total)}</text>
              </g>
            ))}
            {[[180, 118], [186, 124], [178, 128]].map(([x, y], i) => <circle key={`hs${i}`} cx={x} cy={y} r={2} fill="#64748b" />)}
            <text x={182} y={140} fontSize={7} fill="#475569" textAnchor="middle">QĐ Hoàng Sa</text>
            {[[170, 270], [178, 278], [172, 286], [182, 292]].map(([x, y], i) => <circle key={`ts${i}`} cx={x} cy={y} r={2} fill="#64748b" />)}
            <text x={176} y={306} fontSize={7} fill="#475569" textAnchor="middle">QĐ Trường Sa</text>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {REGIONS.map((r) => (
              <div key={r} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: `4px solid ${fill(r, 1)}`, borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{REGION_LABELS[r]}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(summary.regions[r])}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{pct(summary.regions[r], summary.total)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {summary.matchedRows}/{rows.length} dòng nhận ra tỉnh thành · {summary.provinces.length} tỉnh thành · Tổng {valueName}: <strong>{fmt(summary.total)}</strong>
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
            {summary.provinces.length ? summary.provinces.map((p) => (
              <div key={p.province} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) 90px', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
                <span>{p.province}</span>
                <span style={{ height: 8, borderRadius: 4, background: fill(p.region, 1), width: `${maxProvince ? Math.max(2, (Math.abs(p.value) / maxProvince) * 100) : 0}%` }} />
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value)}</span>
              </div>
            )) : <div style={{ fontSize: 12, color: '#94a3b8', padding: 8 }}>Không nhận ra tỉnh thành nào trong cột "{headers[provinceCol]}". Hãy chọn cột chứa tên tỉnh hoặc địa chỉ.</div>}
          </div>
          {summary.unmatched.length > 0 && (
            <div style={{ fontSize: 12, color: '#b45309' }}>
              Chưa nhận ra: {summary.unmatched.slice(0, 6).map((u) => `${u.text} (${u.rows})`).join(', ')}{summary.unmatched.length > 6 ? `, và ${summary.unmatched.length - 6} giá trị khác` : ''}
            </div>
          )}
        </div>
      </div>
    </ProDialog>
  );
}
