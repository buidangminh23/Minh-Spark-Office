import { useState } from 'react';
import { Printer, Download, X, FileText, Image as ImageIcon } from 'lucide-react';
import type { PresentationData } from '../../lib/slideTypes';

interface SlideExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation: PresentationData;
  onExportPptx: () => void;
  onExportPdf: () => void;
}

export type PrintLayoutType = '1-slide' | '2-slides' | '3-slides-notes' | '4-slides' | '6-slides';

export function SlideExportModal({
  isOpen,
  onClose,
  presentation,
  onExportPptx,
  onExportPdf,
}: SlideExportModalProps) {
  const [activeTab, setActiveTab] = useState<'print' | 'export'>('print');
  const [printLayout, setPrintLayout] = useState<PrintLayoutType>('1-slide');
  const [includeNotes, setIncludeNotes] = useState(false);

  if (!isOpen) return null;

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleExportHtml5 = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${presentation.title || 'Bài Thuyết Trình Minh Slides'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0F172A; color: #FFF; font-family: Segoe UI, sans-serif; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    .slide-stage { width: 90vw; height: 50.625vw; max-height: 88vh; max-width: 156vh; background: #FFF; border-radius: 8px; position: relative; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .element { position: absolute; display: flex; align-items: center; }
    .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); padding: 8px 16px; border-radius: 999px; display: flex; gap: 12px; align-items: center; z-index: 100; font-size: 13px; }
    .btn { background: #334155; border: none; color: #FFF; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="slide-stage" id="stage"></div>
  <div class="controls">
    <button class="btn" id="prevBtn">◀ Trước</button>
    <span id="pageIndicator" style="font-weight: 700; color: #38BDF8;">1 / \${presentation.slides.length}</span>
    <button class="btn" id="nextBtn">Sau ▶</button>
  </div>
  <script>
    const slides = \${JSON.stringify(presentation.slides)};
    let currentIdx = 0;
    const stage = document.getElementById('stage');
    const pageIndicator = document.getElementById('pageIndicator');
    function renderSlide(idx) {
      const slide = slides[idx];
      stage.style.background = slide.background?.value || '#FFFFFF';
      stage.innerHTML = '';
      slide.elements.forEach(el => {
        const div = document.createElement('div');
        div.className = 'element';
        div.style.left = el.x + '%';
        div.style.top = el.y + '%';
        div.style.width = el.width + '%';
        div.style.height = el.height + '%';
        div.style.color = el.color || '#1E293B';
        div.style.fontSize = (el.fontSize || 18) + 'px';
        div.style.fontWeight = el.fontWeight || 'normal';
        div.style.textAlign = el.textAlign || 'left';
        div.innerText = el.text || '';
        stage.appendChild(div);
      });
      pageIndicator.innerText = (idx + 1) + ' / ' + slides.length;
    }
    renderSlide(0);
    document.getElementById('prevBtn').onclick = () => { if (currentIdx > 0) { currentIdx--; renderSlide(currentIdx); } };
    document.getElementById('nextBtn').onclick = () => { if (currentIdx < slides.length - 1) { currentIdx++; renderSlide(currentIdx); } };
    window.onkeydown = (e) => {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { if (currentIdx < slides.length - 1) { currentIdx++; renderSlide(currentIdx); } }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { if (currentIdx > 0) { currentIdx--; renderSlide(currentIdx); } }
    };
  </script>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presentation.title || 'Bai-Thuyet-Trinh'}-Offline.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>In & Xuất Bài Thuyết Trình</span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="ppt-dialog-tabs">
          <button
            className={`ppt-dialog-tab ${activeTab === 'print' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('print')}
          >
            <Printer size={15} /> Thiết lập In ấn (Print Setup)
          </button>
          <button
            className={`ppt-dialog-tab ${activeTab === 'export' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={15} /> Xuất Tệp Đa Định Dạng (Export)
          </button>
        </div>

        {/* Body */}
        <div className="ppt-dialog-body">
          {activeTab === 'print' ? (
            <div className="ppt-print-setup-grid">
              <div className="ppt-print-settings">
                <span className="ppt-format-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Bố cục trang in (Handouts & Layout):
                </span>

                <div className="ppt-print-layout-list">
                  <label className={`ppt-print-option ${printLayout === '1-slide' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="printLayout"
                      checked={printLayout === '1-slide'}
                      onChange={() => setPrintLayout('1-slide')}
                    />
                    <div>
                      <strong>1 trang chiếu / trang (Toàn trang)</strong>
                      <p>Khổ ngang (Landscape), kích thước tối đa cho bài thuyết trình</p>
                    </div>
                  </label>

                  <label className={`ppt-print-option ${printLayout === '2-slides' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="printLayout"
                      checked={printLayout === '2-slides'}
                      onChange={() => setPrintLayout('2-slides')}
                    />
                    <div>
                      <strong>2 trang chiếu / trang</strong>
                      <p>Tiết kiệm giấy in, xem tuần tự 2 slide trên 1 trang dọc</p>
                    </div>
                  </label>

                  <label className={`ppt-print-option ${printLayout === '3-slides-notes' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="printLayout"
                      checked={printLayout === '3-slides-notes'}
                      onChange={() => setPrintLayout('3-slides-notes')}
                    />
                    <div>
                      <strong>3 trang chiếu kèm dòng kẻ ghi chú (Handouts chuẩn)</strong>
                      <p>Cột trái hiển thị slide thu nhỏ, cột phải có 4 dòng kẻ để khán giả ghi chép</p>
                    </div>
                  </label>

                  <label className={`ppt-print-option ${printLayout === '4-slides' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="printLayout"
                      checked={printLayout === '4-slides'}
                      onChange={() => setPrintLayout('4-slides')}
                    />
                    <div>
                      <strong>4 trang chiếu / trang (Lưới 2×2)</strong>
                      <p>Thích hợp in tài liệu ôn tập và kiểm tra tổng quát</p>
                    </div>
                  </label>
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <label className="ppt-checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                    />
                    <span>In kèm phần ghi chú của Diễn giả (Speaker Notes)</span>
                  </label>
                </div>
              </div>

              {/* Print Preview Column */}
              <div className="ppt-print-preview-pane">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Xem trước trang in mẫu:</span>
                <div className="ppt-print-paper-sheet">
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px', marginBottom: '8px' }}>
                    Trang 1 · Tổng {presentation.slides.length} trang chiếu
                  </div>
                  {printLayout === '1-slide' && (
                    <div className="ppt-preview-slide-box">
                      <div className="ppt-preview-slide-title">
                        {presentation.slides[0]?.elements.find((el) => el.isTitle)?.text || 'TIÊU ĐỀ TRANG CHIẾU'}
                      </div>
                    </div>
                  )}
                  {printLayout === '2-slides' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="ppt-preview-slide-box is-mini" />
                      <div className="ppt-preview-slide-box is-mini" />
                    </div>
                  )}
                  {printLayout === '3-slides-notes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[1, 2, 3].map((n) => (
                        <div key={n} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                          <div className="ppt-preview-slide-box is-nano" />
                          <div className="ppt-preview-notes-lines">
                            <span /><span /><span />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {printLayout === '4-slides' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div className="ppt-preview-slide-box is-nano" />
                      <div className="ppt-preview-slide-box is-nano" />
                      <div className="ppt-preview-slide-box is-nano" />
                      <div className="ppt-preview-slide-box is-nano" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Tab: Export Options */
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

              <div className="ppt-export-card" onClick={handleTriggerPrint}>
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
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          {activeTab === 'print' ? (
            <button className="ppt-primary-action-btn" onClick={handleTriggerPrint}>
              <Printer size={16} /> Mở hộp thoại In
            </button>
          ) : (
            <button className="ppt-primary-action-btn" onClick={onExportPptx}>
              <Download size={16} /> Tải tệp .pptx
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
