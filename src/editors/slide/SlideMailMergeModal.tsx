import { useState } from 'react';
import { Users, FileSpreadsheet, X, Check, Sparkles, Lightbulb } from 'lucide-react';
import type { SlideData, SlideElement } from '../../lib/slideTypes';

interface SlideMailMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSlide: SlideData;
  onBatchGenerate: (newSlides: SlideData[]) => void;
}

const DEFAULT_SAMPLE_CSV = `ho_ten,chuc_vu,cong_ty,xep_loai
Nguyễn Văn An,Giám đốc Công nghệ,Tập đoàn FPT,Xuất sắc
Trần Thị Bình,Trưởng phòng Marketing,Vingroup,Hạng Nhất
Lê Hoàng Cường,Kỹ sư Trí tuệ Nhân tạo,Minh Spark AI,Xuất sắc
Phạm Minh Đức,Chuyên gia Phân tích Dữ liệu,Viettel Solutions,Hạng Nhất
Hoàng Thu Hà,Giám đốc Vận hành,Techcombank,Xuất sắc`;

export function SlideMailMergeModal({
  isOpen,
  onClose,
  currentSlide,
  onBatchGenerate,
}: SlideMailMergeModalProps) {
  const [csvText, setCsvText] = useState(DEFAULT_SAMPLE_CSV);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  if (!isOpen) return null;

  // Extract available tags in the current slide template (e.g. {{ho_ten}})
  const detectedTags: string[] = [];
  currentSlide.elements.forEach((el) => {
    if (el.text) {
      const matches = el.text.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        matches.forEach((m) => {
          const tag = m.replace(/\{\{|\}\}/g, '').trim();
          if (!detectedTags.includes(tag)) detectedTags.push(tag);
        });
      }
    }
  });

  const handleGenerate = () => {
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim());
    const dataRows = lines.slice(1).map((row) => row.split(',').map((c) => c.trim()));

    const generatedSlides: SlideData[] = dataRows.map((row, idx) => {
      const rowData: Record<string, string> = {};
      headers.forEach((h, hIdx) => {
        rowData[h] = row[hIdx] || '';
      });

      // Clone elements with replaced tokens
      const newElements: SlideElement[] = currentSlide.elements.map((el) => {
        if (!el.text) return { ...el, id: `merge_el_${idx}_${el.id}` };
        let newText = el.text;
        Object.entries(rowData).forEach(([key, val]) => {
          newText = newText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
        });
        return {
          ...el,
          id: `merge_el_${idx}_${el.id}`,
          text: newText,
        };
      });

      return {
        ...currentSlide,
        id: `slide_merge_${Date.now()}_${idx}`,
        elements: newElements,
        notes: `Tạo tự động từ Trộn Thư (Mail Merge) cho: ${rowData['ho_ten'] || rowData[headers[0]] || `Mục #${idx + 1}`}`,
      };
    });

    onBatchGenerate(generatedSlides);
    setGeneratedCount(generatedSlides.length);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              Trộn Thư & Tự Động Tạo Hàng Loạt Slide (Slide Mail Merge)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="ppt-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
            <Lightbulb size={14} className="ppt-inline-icon" /> <strong>Cách hoạt động:</strong> Đặt các thẻ dạng <code>{`{{ten_truong}}`}</code> trong hộp chữ trên trang chiếu mẫu (ví dụ: <code>{`{{ho_ten}}`}</code>, <code>{`{{chuc_vu}}`}</code>, <code>{`{{cong_ty}}`}</code>). Khi bấm nút tạo, Minh Slides sẽ tự động nhân bản trang chiếu và điền thông tin tương ứng cho từng người trong danh sách dữ liệu.
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="#059669" /> Dữ liệu danh sách (CSV / Bảng Excel dán vào):
              </label>
              <button
                type="button"
                className="ppt-secondary-action-btn"
                style={{ padding: '2px 8px', fontSize: '12px' }}
                onClick={() => setCsvText(DEFAULT_SAMPLE_CSV)}
              >
                Tải lại dữ liệu mẫu
              </button>
            </div>
            <textarea
              className="ppt-input"
              rows={6}
              style={{ fontFamily: 'Consolas, monospace', fontSize: '12px', width: '100%', resize: 'vertical' }}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="ho_ten,chuc_vu,cong_ty..."
            />
          </div>

          <div>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>Các thẻ nhận diện được trên slide hiện tại:</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {detectedTags.length > 0 ? (
                detectedTags.map((t) => (
                  <span key={t} style={{ background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 600, border: '1px solid #BFDBFE' }}>
                    {`{{${t}}}`}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                  Chưa thấy thẻ dạng {`{{...}}`} trong slide này. Bạn có thể thêm {`{{ho_ten}}`} vào tiêu đề hoặc nội dung.
                </span>
              )}
            </div>
          </div>

          {isSuccess && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
              <Check size={16} /> Đã nhân bản thành công {generatedCount} slide từ danh sách dữ liệu!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="ppt-primary-action-btn" onClick={handleGenerate}>
            <Sparkles size={16} /> Bắt đầu tạo hàng loạt slide
          </button>
        </div>
      </div>
    </div>
  );
}
