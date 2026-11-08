import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { ProDialog } from '../SheetProModals';
import type { WorkbookHealth } from '../../../lib/workbookDoctor';

const kb = (bytes: number) => `${(bytes / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} KB`;

export function WorkbookDoctorModal({
  health,
  onClean,
  onClose,
}: {
  health: WorkbookHealth;
  onClean: () => Promise<void>;
  onClose: () => void;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const cleanable = health.totalGhostCells + health.totalEmptyMerges + health.unusedStyles;

  const run = async () => {
    setState('working');
    try {
      await onClean();
      setState('done');
    } catch {
      setState('idle');
    }
  };

  return (
    <ProDialog
      title="Bác sĩ tối ưu sổ tính"
      subtitle="Tìm định dạng thừa ngoài vùng dữ liệu, ô gộp rỗng, kiểu định dạng không dùng và ô lỗi công thức"
      width={640}
      onClose={onClose}
      actions={
        state === 'done' ? (
          <button className="btn btn-primary" onClick={onClose}>Xong</button>
        ) : (
          <>
            <button className="btn" onClick={onClose}>Đóng</button>
            <button className="btn btn-primary" onClick={() => void run()} disabled={!cleanable || state === 'working'}>
              <Sparkles size={15} /> {state === 'working' ? 'Đang dọn…' : cleanable ? 'Dọn dẹp ngay' : 'Không có gì cần dọn'}
            </button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {[
            ['Ô định dạng thừa', health.totalGhostCells],
            ['Ô gộp rỗng', health.totalEmptyMerges],
            ['Kiểu không dùng', health.unusedStyles],
            ['Ô lỗi công thức', health.totalErrorCells],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{Number(value).toLocaleString('vi-VN')}</div>
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Trang tính', 'Vùng dữ liệu', 'Định dạng thừa', 'Gộp rỗng', 'Ô lỗi'].map((h) => <th key={h} style={{ padding: '6px 10px', textAlign: 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {health.sheets.map((s) => (
                <tr key={s.sheetId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px' }}>{s.name}</td>
                  <td style={{ padding: '6px 10px' }}>{s.dataRows ? `${s.dataRows} hàng × ${s.dataColumns} cột` : 'Trống'}</td>
                  <td style={{ padding: '6px 10px' }}>{s.ghostCells}</td>
                  <td style={{ padding: '6px 10px' }}>{s.emptyMerges}</td>
                  <td style={{ padding: '6px 10px', color: s.errorCells.length ? '#b91c1c' : undefined }} title={s.errorCells.join(', ')}>
                    {s.errorCells.length ? `${s.errorCells.length} (${s.errorCells.slice(0, 4).join(', ')}${s.errorCells.length > 4 ? '…' : ''})` : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          Dung lượng dữ liệu sổ tính: {kb(health.bytesBefore)}{cleanable ? ` → khoảng ${kb(health.bytesAfter)} sau khi dọn` : ''}. Trước khi dọn, app tự lưu một mốc trong Lịch sử để khôi phục nếu cần. Ô lỗi công thức chỉ được liệt kê để bạn tự sửa, không bị xoá.
        </div>
        {state === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600 }}>
            <CheckCircle2 size={18} /> Đã dọn {cleanable.toLocaleString('vi-VN')} mục và lưu mốc "Trước khi tối ưu" trong Lịch sử.
          </div>
        )}
        {health.totalErrorCells > 0 && state !== 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontSize: 12 }}>
            <AlertTriangle size={15} /> Có {health.totalErrorCells} ô báo lỗi công thức. Rê chuột vào cột Ô lỗi để xem địa chỉ.
          </div>
        )}
      </div>
    </ProDialog>
  );
}
