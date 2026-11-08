import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ProDialog } from '../SheetProModals';
import { columnLetter, diffSheets, type CellChange, type DiffValue, type SheetSnapshot } from '../../../lib/sheetDiff';

export type DiffVersion = { id: string; label: string; timestamp: number; sheets: SheetSnapshot[] };
type Source = { key: string; label: string; sheet: SheetSnapshot };

const KIND_LABEL: Record<CellChange['kind'], string> = { modified: 'Sửa đổi', added: 'Thêm mới', deleted: 'Xoá bỏ' };
const KIND_COLOR: Record<CellChange['kind'], string> = { modified: '#b45309', added: '#15803d', deleted: '#b91c1c' };
const SHOWN_LIMIT = 400;

const show = (value: DiffValue, formula: string | null) => {
  const text = value === null || value === undefined || value === '' ? '' : String(value);
  if (formula) return text ? `${text}  (${formula})` : formula;
  return text || '(trống)';
};

function buildSources(sheets: SheetSnapshot[], versions: DiffVersion[]): Source[] {
  const current = sheets.map((sheet, i) => ({ key: `cur:${i}`, label: `Hiện tại · ${sheet.name}`, sheet }));
  const saved = versions.flatMap((v) => {
    const when = new Date(v.timestamp).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    return v.sheets.map((sheet, i) => ({ key: `ver:${v.id}:${i}`, label: `Bản lưu ${v.label || when} (${when}) · ${sheet.name}`, sheet }));
  });
  return [...current, ...saved];
}

export function WorkbookDiffModal({
  sheets,
  versions,
  activeSheetName,
  onExportDiffReport,
  onClose,
}: {
  sheets: SheetSnapshot[];
  versions: DiffVersion[];
  activeSheetName: string;
  onExportDiffReport: (headers: string[], rows: (string | number | boolean | null)[][]) => void;
  onClose: () => void;
}) {
  const sources = useMemo(() => buildSources(sheets, versions), [sheets, versions]);
  const activeIndex = Math.max(0, sheets.findIndex((s) => s.name === activeSheetName));
  const defaultBefore = useMemo(() => {
    const latest = [...versions].sort((a, b) => b.timestamp - a.timestamp)[0];
    const sameName = latest?.sheets.findIndex((s) => s.name === activeSheetName) ?? -1;
    if (latest && sameName >= 0) return `ver:${latest.id}:${sameName}`;
    const other = sheets.findIndex((_, i) => i !== activeIndex);
    return other >= 0 ? `cur:${other}` : `cur:${activeIndex}`;
  }, [versions, sheets, activeSheetName, activeIndex]);
  const [beforeKey, setBeforeKey] = useState(defaultBefore);
  const [afterKey, setAfterKey] = useState(`cur:${activeIndex}`);

  const before = sources.find((s) => s.key === beforeKey);
  const after = sources.find((s) => s.key === afterKey);
  const changes = useMemo(() => (before && after ? diffSheets(before.sheet, after.sheet) : []), [before, after]);
  const counts = useMemo(() => {
    const c = { modified: 0, added: 0, deleted: 0 };
    changes.forEach((x) => c[x.kind]++);
    return c;
  }, [changes]);

  const handleExport = () => {
    if (!before || !after || !changes.length) return;
    const headers = ['Ô', 'Hàng', 'Cột', 'Giá trị trước', 'Giá trị sau', 'Công thức trước', 'Công thức sau', 'Loại thay đổi', 'So sánh'];
    const pair = `${before.label} → ${after.label}`;
    onExportDiffReport(headers, changes.map((x) => [
      `${columnLetter(x.col)}${x.row + 1}`,
      x.row + 1,
      columnLetter(x.col),
      x.before,
      x.after,
      x.beforeFormula ?? '',
      x.afterFormula ?? '',
      KIND_LABEL[x.kind],
      pair,
    ]));
  };

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="input-group" style={{ flex: 1, minWidth: 0 }}>
      <span className="input-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="select-input" style={{ width: '100%', padding: '6px 8px' }}>
        {sources.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <ProDialog
      title="So sánh trang tính và phiên bản"
      subtitle="So từng ô giữa hai trang tính, hoặc giữa trang hiện tại và một bản đã lưu trong Lịch sử"
      width={760}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={!changes.length}>
            <FileSpreadsheet size={15} /> Xuất {changes.length} thay đổi ra Sheet mới
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {select(beforeKey, setBeforeKey, 'Bản trước')}
          {select(afterKey, setAfterKey, 'Bản sau')}
        </div>
        {!versions.length && (
          <div style={{ fontSize: 12, color: '#64748b' }}>Chưa có bản lưu nào. Tạo bản lưu ở Tệp → Lịch sử để so với phiên bản cũ.</div>
        )}
        {beforeKey === afterKey ? (
          <div style={{ fontSize: 13, color: '#b45309' }}>Hãy chọn hai nguồn khác nhau để so sánh.</div>
        ) : (
          <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
            <strong>{changes.length ? `${changes.length} ô khác nhau` : 'Hai bản giống hệt nhau'}</strong>
            {(Object.keys(counts) as CellChange['kind'][]).map((k) => (
              <span key={k} style={{ color: KIND_COLOR[k] }}>{KIND_LABEL[k]}: {counts[k]}</span>
            ))}
          </div>
        )}
        {changes.length > 0 && beforeKey !== afterKey && (
          <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Ô</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Trước</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Sau</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Loại</th>
                </tr>
              </thead>
              <tbody>
                {changes.slice(0, SHOWN_LIMIT).map((x) => (
                  <tr key={`${x.row}:${x.col}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'Consolas, monospace' }}>{columnLetter(x.col)}{x.row + 1}</td>
                    <td style={{ padding: '6px 10px', color: '#b91c1c', wordBreak: 'break-word' }}>{show(x.before, x.beforeFormula)}</td>
                    <td style={{ padding: '6px 10px', color: '#15803d', wordBreak: 'break-word' }}>{show(x.after, x.afterFormula)}</td>
                    <td style={{ padding: '6px 10px', color: KIND_COLOR[x.kind] }}>{KIND_LABEL[x.kind]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {changes.length > SHOWN_LIMIT && (
              <div style={{ padding: 8, fontSize: 12, color: '#64748b' }}>Đang hiện {SHOWN_LIMIT}/{changes.length} thay đổi. Xuất ra Sheet mới để xem đủ.</div>
            )}
          </div>
        )}
      </div>
    </ProDialog>
  );
}
