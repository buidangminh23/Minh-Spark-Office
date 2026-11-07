import { useState } from 'react';
import { Search, Replace, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { PresentationData } from '../../lib/slideTypes';

interface SlideFindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation: PresentationData;
  onReplaceAll: (find: string, replaceWith: string, matchCase: boolean) => number;
  onNavigateToSlide: (slideIndex: number) => void;
}

export function SlideFindReplaceModal({
  isOpen,
  onClose,
  presentation,
  onReplaceAll,
  onNavigateToSlide,
}: SlideFindReplaceModalProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Search matches across slides
  const matches: { slideIndex: number; text: string }[] = [];
  if (findText.trim()) {
    presentation.slides.forEach((slide, sIdx) => {
      slide.elements.forEach((el) => {
        if (el.text) {
          const hay = matchCase ? el.text : el.text.toLowerCase();
          const needle = matchCase ? findText : findText.toLowerCase();
          if (hay.includes(needle)) {
            matches.push({ slideIndex: sIdx, text: el.text });
          }
        }
      });
    });
  }

  const handleExecuteReplaceAll = () => {
    if (!findText) return;
    const count = onReplaceAll(findText, replaceText, matchCase);
    setStatusMessage(`Đã thay thế thành công ${count} vị trí trong toàn bộ bài thuyết trình.`);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Tìm kiếm & Thay thế</span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ppt-dialog-body">
          <div className="ppt-dialog-field">
            <label>Tìm nội dung:</label>
            <div className="ppt-input-icon-wrap">
              <Search size={15} color="#64748B" />
              <input
                type="text"
                autoFocus
                placeholder="Nhập từ hoặc cụm từ cần tìm…"
                value={findText}
                onChange={(e) => {
                  setFindText(e.target.value);
                  setStatusMessage(null);
                }}
              />
            </div>
          </div>

          <div className="ppt-dialog-field">
            <label>Thay thế bằng:</label>
            <div className="ppt-input-icon-wrap">
              <Replace size={15} color="#64748B" />
              <input
                type="text"
                placeholder="Nhập nội dung thay thế…"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
            </div>
          </div>

          <label className="ppt-checkbox-label">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />
            <span>Khớp chính xác chữ hoa / chữ thường</span>
          </label>

          {/* Search Result Matches */}
          {findText && (
            <div className="ppt-search-results">
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Tìm thấy {matches.length} kết quả:
              </div>
              <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {matches.map((m, idx) => (
                  <div
                    key={idx}
                    className="ppt-search-match-item"
                    onClick={() => onNavigateToSlide(m.slideIndex)}
                  >
                    <span className="ppt-match-badge">Trang {m.slideIndex + 1}</span>
                    <span className="ppt-match-text">{m.text.slice(0, 50)}...</span>
                    <ChevronRight size={14} color="#94A3B8" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="ppt-dialog-status-success">
              <CheckCircle2 size={16} color="#10B981" /> {statusMessage}
            </div>
          )}
        </div>

        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button
            className="ppt-primary-action-btn"
            disabled={!findText || matches.length === 0}
            onClick={handleExecuteReplaceAll}
          >
            Thay thế tất cả ({matches.length})
          </button>
        </div>
      </div>
    </div>
  );
}
