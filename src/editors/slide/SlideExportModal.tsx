import { Printer, Download, X, FileText, Image as ImageIcon } from 'lucide-react';
import type { PresentationData } from '../../lib/slideTypes';
import { buildStandaloneHtml } from '../../lib/slideHtmlExport';
import { downloadBlob } from '../../lib/download';

interface SlideExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation: PresentationData;
  onExportPptx: () => void;
  onExportPdf: () => void;
}

export function SlideExportModal({
  isOpen,
  onClose,
  presentation,
  onExportPptx,
  onExportPdf,
}: SlideExportModalProps) {
  if (!isOpen) return null;

  const handleExportHtml5 = () => {
    const blob = new Blob([buildStandaloneHtml(presentation)], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${presentation.title || 'Bai-Thuyet-Trinh'}-Offline.html`);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>In & Xuất Bài Thuyết Trình</span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ppt-dialog-body">
            <div className="ppt-export-grid">
              <div className="ppt-export-card" onClick={onExportPptx}>
                <div className="ppt-export-icon" style={{ background: '#FFEFE6', color: '#D83B01' }}>
                  <FileText size={28} />
                </div>
                <div className="ppt-export-info">
                  <h4>Microsoft PowerPoint (.pptx)</h4>
                  <p>Mở và chỉnh sửa 100% trên Microsoft Office PowerPoint, Office 365, Keynote và Google Slides.</p>
                </div>
                <span className="ppt-export-badge">Khuyên dùng</span>
              </div>

              <div className="ppt-export-card" onClick={onExportPdf}>
                <div className="ppt-export-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  <Download size={28} />
                </div>
                <div className="ppt-export-info">
                  <h4>Tài liệu PDF (.pdf)</h4>
                  <p>Định dạng cố định hoàn hảo để gửi cho khách hàng, đối tác hoặc in ấn không bị lệch phông.</p>
                </div>
              </div>

              <div className="ppt-export-card" onClick={onExportPdf}>
                <div className="ppt-export-icon" style={{ background: '#E0E7FF', color: '#4F46E5' }}>
                  <ImageIcon size={28} />
                </div>
                <div className="ppt-export-info">
                  <h4>In ấn Handouts trực tiếp</h4>
                  <p>In ngay ra máy in vật lý hoặc lưu thành tệp in PDF chất lượng cao qua trình duyệt.</p>
                </div>
              </div>

              <div className="ppt-export-card" onClick={handleExportHtml5}>
                <div className="ppt-export-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                  <FileText size={28} />
                </div>
                <div className="ppt-export-info">
                  <h4>Đóng gói 1 file HTML5 Độc Lập (.html)</h4>
                  <p>Xuất thành đúng 1 tệp HTML duy nhất để mở và trình chiếu mượt mà 60fps trên mọi máy tính, iPad, điện thoại offline không cần mạng.</p>
                </div>
                <span className="ppt-export-badge" style={{ background: '#16A34A' }}>Offline 60fps</span>
              </div>
            </div>
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="ppt-secondary-action-btn" onClick={onExportPdf}>
            <Printer size={16} /> In
          </button>
          <button className="ppt-primary-action-btn" onClick={onExportPptx}>
            <Download size={16} /> Tải tệp .pptx
          </button>
        </div>
      </div>
    </div>
  );
}
