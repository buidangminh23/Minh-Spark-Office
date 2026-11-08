import { useState } from 'react';
import { LayoutTemplate, Check, X, ShieldCheck } from 'lucide-react';

interface SlideMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  slideMaster?: {
    enabled: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    showSlideNumber?: boolean;
  };
  onSaveSlideMaster: (master: {
    enabled: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    showSlideNumber?: boolean;
  }) => void;
}

export function SlideMasterModal({
  isOpen,
  onClose,
  slideMaster,
  onSaveSlideMaster,
}: SlideMasterModalProps) {
  const [enabled, setEnabled] = useState(slideMaster?.enabled ?? true);
  const [headerText, setHeaderText] = useState(slideMaster?.headerText ?? 'MINH SPARK CORPORATION • BÁO CÁO CHIẾN LƯỢC');
  const [footerText, setFooterText] = useState(slideMaster?.footerText ?? 'Tài liệu mật lưu hành nội bộ • Bản quyền © 2026');
  const [logoUrl, setLogoUrl] = useState(slideMaster?.logoUrl ?? '');
  const [showSlideNumber, setShowSlideNumber] = useState(slideMaster?.showSlideNumber ?? true);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSlideMaster({
      enabled,
      headerText,
      footerText,
      logoUrl,
      showSlideNumber,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutTemplate size={20} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              Quản Lý Bố Cục Gốc (Slide Master)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="ppt-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#D83B01' }}
            />
            <strong style={{ fontSize: '13px', color: '#1E293B' }}>
              Áp dụng Bố cục gốc lên toàn bộ bài thuyết trình
            </strong>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Tiêu đề trên cùng (Header / Tổ chức):
              </label>
              <input
                type="text"
                className="ppt-input"
                style={{ width: '100%' }}
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Ví dụ: TẬP ĐOÀN MINH SPARK..."
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Chân trang (Footer / Ghi chú bản quyền):
              </label>
              <input
                type="text"
                className="ppt-input"
                style={{ width: '100%' }}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Ví dụ: Tài liệu bảo mật..."
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Đường dẫn Logo nhận diện (URL ảnh logo ở góc):
              </label>
              <input
                type="text"
                className="ppt-input"
                style={{ width: '100%' }}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://... hoặc để trống để dùng logo mặc định"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSlideNumber}
                onChange={(e) => setShowSlideNumber(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#D83B01' }}
              />
              <span style={{ fontSize: '13px', color: '#334155' }}>
                Tự động đánh số trang ở góc dưới bên phải (ví dụ: Trang 3)
              </span>
            </label>
          </div>

          {isSaved && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
              <Check size={16} /> Đã cập nhật Slide Master thành công!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="ppt-primary-action-btn" onClick={handleSave}>
            <ShieldCheck size={16} /> Lưu thiết lập Master
          </button>
        </div>
      </div>
    </div>
  );
}
