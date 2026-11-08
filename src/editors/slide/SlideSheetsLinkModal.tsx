import { useState } from 'react';
import { RefreshCw, Check, X, FileSpreadsheet } from 'lucide-react';
import type { SlideElement } from '../../lib/slideTypes';

interface SlideSheetsLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElement: SlideElement | null;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
}

export function SlideSheetsLinkModal({
  isOpen,
  onClose,
  selectedElement,
  onUpdateElement,
}: SlideSheetsLinkModalProps) {
  const [sheetName, setSheetName] = useState(selectedElement?.sheetLink?.sheetName || 'BaoCaoTaiChinh_Q4.xlsx');
  const [range, setRange] = useState(selectedElement?.sheetLink?.range || 'Sheet1!B2:E7');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !selectedElement) return null;

  const handleSyncData = () => {
    setIsUpdating(true);
    setTimeout(() => {
      // Simulate live data pull from Minh Sheets
      if (selectedElement.type === 'chart' && selectedElement.chartSeries) {
        const updatedSeries = selectedElement.chartSeries.map((s) => ({
          ...s,
          values: s.values.map((v) => Math.round(v * (1 + (Math.random() * 0.2 - 0.1)))),
        }));
        onUpdateElement(selectedElement.id, {
          chartSeries: updatedSeries,
          sheetLink: {
            sheetName,
            range,
            lastSync: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            autoUpdate: true,
          },
        });
      } else if (selectedElement.type === 'table' && selectedElement.tableData) {
        onUpdateElement(selectedElement.id, {
          sheetLink: {
            sheetName,
            range,
            lastSync: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            autoUpdate: true,
          },
        });
      }
      setIsUpdating(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1000);
    }, 600);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color="#059669" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              Liên Kết Dữ Liệu Sống Từ Minh Sheets (.xlsx)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="ppt-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Biểu đồ hoặc Bảng biểu này được kết nối trực tiếp với sổ tính trong hệ sinh thái <strong>Minh Spark Office</strong>. Khi số liệu báo cáo thay đổi, chỉ cần 1 click để cập nhật lại hình vẽ mà không cần nhập thủ công.
          </p>

          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#166534' }}>
            <strong>Đang liên kết với đối tượng:</strong> [{selectedElement.type.toUpperCase()}] {selectedElement.chartTitle || selectedElement.id}
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
              Tên tệp Minh Sheets (.xlsx):
            </label>
            <input
              type="text"
              className="ppt-input"
              style={{ width: '100%' }}
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Ví dụ: DoanhSo_Q4.xlsx"
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
              Vùng dữ liệu trang tính (Sheet & Cell Range):
            </label>
            <input
              type="text"
              className="ppt-input"
              style={{ width: '100%', fontFamily: 'monospace' }}
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="Sheet1!B2:F10"
            />
          </div>

          {selectedElement.sheetLink?.lastSync && (
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              ⏱ Lần đồng bộ gần nhất: <strong>{selectedElement.sheetLink.lastSync}</strong>
            </div>
          )}

          {isSuccess && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
              <Check size={18} /> Đã cập nhật số liệu mới nhất từ Minh Sheets thành công!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button
            className="ppt-primary-action-btn"
            style={{ background: '#059669', borderColor: '#059669' }}
            onClick={handleSyncData}
            disabled={isUpdating}
          >
            <RefreshCw size={16} className={isUpdating ? 'animate-spin' : ''} />
            {isUpdating ? 'Đang kéo số liệu...' : 'Cập nhật số liệu tức thì'}
          </button>
        </div>
      </div>
    </div>
  );
}
