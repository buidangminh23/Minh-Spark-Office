import { useState } from 'react';
import { Sparkles, X, Wand2, Check } from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { createSlideFromLayout } from '../../lib/slideTemplates';

interface SlideAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
  onApplyGeneratedDeck: (newSlides: SlideData[], themeId: string) => void;
}

const TONES = [
  { id: 'business', label: 'Doanh nghiệp & Đầu tư', desc: 'Súc tích, chuyên nghiệp, tập trung vào số liệu tăng trưởng' },
  { id: 'startup', label: 'Khởi nghiệp Pitch Deck', desc: 'Ấn tượng, nêu bật nỗi đau thị trường và giải pháp đột phá' },
  { id: 'project', label: 'Báo cáo Tiến độ Dự án', desc: 'Rõ ràng, phân bổ theo các cột mốc thời gian và trách nhiệm' },
  { id: 'product', label: 'Giới thiệu Sản phẩm', desc: 'Tập trung tính năng, so sánh lợi thế và giá trị cho người dùng' },
];

export function SlideAiModal({
  isOpen,
  onClose,
  currentThemeId,
  onApplyGeneratedDeck,
}: SlideAiModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedTone, setSelectedTone] = useState('business');
  const [slideCount, setSlideCount] = useState<number>(5);
  const [selectedTheme, setSelectedTheme] = useState(currentThemeId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  if (!isOpen) return null;

  const handleStartGenerate = () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStepIndex(1); // Analyzing topic

    setTimeout(() => {
      setStepIndex(2); // Structuring outline
    }, 600);

    setTimeout(() => {
      setStepIndex(3); // Designing layouts, charts & smartart
    }, 1200);

    setTimeout(() => {
      // Build deck
      const titleUpper = prompt.trim().toUpperCase();
      const theme = SLIDE_THEMES[selectedTheme] || SLIDE_THEMES['sapphire-modern'];

      const generatedSlides: SlideData[] = [];

      // Slide 1: Title Slide
      const s1 = createSlideFromLayout('title', 0, selectedTheme, titleUpper);
      s1.elements[1].text = `KẾ HOẠCH HÀNH ĐỘNG & ĐỊNH HƯỚNG PHÁT TRIỂN NĂM 2026\nNgười trình bày: Minh Spark Office AI Team`;
      s1.notes = `Kính chào toàn thể quý vị đại biểu. Hôm nay em xin trình bày về chủ đề "${prompt.trim()}".`;
      generatedSlides.push(s1);

      // Slide 2: Agenda
      const s2 = createSlideFromLayout('title-content', 1, selectedTheme, 'NỘI DUNG CHÍNH (AGENDA)');
      s2.elements[1].text = `1. Bối cảnh và Thách thức hiện tại\n2. Mục tiêu chiến lược và Kế hoạch hành động\n3. Biểu đồ dự phóng tăng trưởng & Ngân sách dự kiến\n4. Lộ trình triển khai 4 giai đoạn then chốt\n5. Kết luận và Thảo luận mở`;
      s2.notes = 'Điểm qua 5 nội dung chính của buổi thuyết trình.';
      generatedSlides.push(s2);

      // Slide 3: Comparison / Two content
      const s3 = createSlideFromLayout('two-content', 2, selectedTheme, 'HIỆN TRẠNG & ĐỊNH HƯỚNG MỚI');
      s3.elements[1].text = `• Quy trình thủ công mất nhiều thời gian\n• Dữ liệu phân tán, thiếu liên kết\n• Chi phí vận hành gia tăng\n• Tốc độ phản hồi khách hàng chậm`;
      s3.elements[2].text = `• Tự động hoá 80% quy trình cốt lõi\n• Tập trung dữ liệu thông suốt theo thời gian thực\n• Tối ưu 35% chi phí vận hành\n• Trải nghiệm khách hàng vượt trội và tức thời`;
      s3.notes = 'So sánh trước và sau khi áp dụng giải pháp.';
      generatedSlides.push(s3);

      // Slide 4: Chart slide
      const s4 = createSlideFromLayout('title-content', 3, selectedTheme, 'DỰ BÁO TĂNG TRƯỞNG & DOANH THU 2026');
      s4.elements = [
        s4.elements[0],
        {
          id: `el-chart-${Date.now()}`,
          type: 'chart',
          chartType: 'column',
          chartTitle: `Mục tiêu tăng trưởng chỉ số KPI "${prompt.slice(0, 25)}"`,
          chartCategories: ['Quý I', 'Quý II', 'Quý III', 'Quý IV'],
          chartSeries: [
            { name: 'Kế hoạch', values: [120, 180, 240, 350], color: theme.secondaryColor },
            { name: 'Kỳ vọng AI', values: [150, 230, 310, 480], color: theme.primaryColor },
          ],
          x: 10,
          y: 22,
          width: 80,
          height: 65,
        },
      ];
      s4.notes = 'Giải thích các cột mốc doanh số và tăng trưởng theo từng quý.';
      generatedSlides.push(s4);

      // Slide 5: Closing Slide
      const s5 = createSlideFromLayout('section', 4, selectedTheme, 'HỢP TÁC & BỨT PHÁ 2026');
      s5.elements[1].text = `CẢM ƠN QUÝ VỊ ĐÃ LẮNG NGHE!\nSẵn sàng giải đáp mọi thắc mắc và đóng góp ý kiến.`;
      s5.notes = 'Chuyển sang phần hỏi đáp (Q&A).';
      generatedSlides.push(s5);

      setIsGenerating(false);
      onApplyGeneratedDeck(generatedSlides, selectedTheme);
      onClose();
    }, 1800);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        <div className="ppt-dialog-header" style={{ background: 'linear-gradient(135deg, #312E81 0%, #4338CA 100%)', color: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#FBBF24" />
            <span style={{ fontWeight: 700, fontSize: '17px' }}>AI Presentation Copilot · Soạn Thảo Thông Minh</span>
          </div>
          <button className="ppt-dialog-close-btn" style={{ color: '#FFFFFF' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ppt-dialog-body">
          {!isGenerating ? (
            <>
              {/* Prompt field */}
              <div className="ppt-dialog-field">
                <label style={{ fontWeight: 600 }}>Chủ đề hoặc Mục tiêu bài thuyết trình:</label>
                <textarea
                  className="ppt-dialog-textarea"
                  rows={3}
                  placeholder="Ví dụ: Chiến lược mở rộng thị trường số và chuyển đổi khách hàng tiềm năng năm 2026…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Tone selection */}
              <div className="ppt-dialog-field">
                <label style={{ fontWeight: 600 }}>Phong cách thuyết trình (Tone & Structure):</label>
                <div className="ppt-tone-grid">
                  {TONES.map((t) => (
                    <div
                      key={t.id}
                      className={`ppt-tone-card ${selectedTone === t.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedTone(t.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong>{t.label}</strong>
                        {selectedTone === t.id && <Check size={16} color="#D83B01" />}
                      </div>
                      <p>{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide count & Theme */}
              <div className="ppt-format-grid-2" style={{ marginTop: '12px' }}>
                <div className="ppt-dialog-field">
                  <label style={{ fontWeight: 600 }}>Số lượng trang chiếu:</label>
                  <select
                    className="ppt-select"
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                  >
                    <option value="3">3 trang chiếu (Tóm lược nhanh)</option>
                    <option value="5">5 trang chiếu (Chuẩn tiêu chuẩn)</option>
                    <option value="8">8 trang chiếu (Chi tiết chuyên sâu)</option>
                  </select>
                </div>

                <div className="ppt-dialog-field">
                  <label style={{ fontWeight: 600 }}>Bộ chủ đề giao diện (Theme):</label>
                  <select
                    className="ppt-select"
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                  >
                    {Object.values(SLIDE_THEMES).map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            /* Generating Progress Screen */
            <div className="ppt-ai-generating-view">
              <div className="ppt-ai-spinner">
                <Wand2 size={36} color="#4F46E5" />
              </div>
              <h3 style={{ margin: '14px 0 6px 0', fontSize: '18px', color: '#1E293B' }}>
                AI Copilot đang soạn bài thuyết trình…
              </h3>
              <p style={{ color: '#64748B', fontSize: '14px', maxWidth: '380px', margin: '0 auto 20px auto', textAlign: 'center' }}>
                Đang tổng hợp thông tin, thiết kế bố cục và số liệu phù hợp với chủ đề &quot;{prompt.slice(0, 40)}...&quot;
              </p>

              <div className="ppt-ai-steps">
                <div className={`ppt-ai-step-row ${stepIndex >= 1 ? 'is-done' : ''}`}>
                  <span className="ppt-step-bullet">{stepIndex > 1 ? '✓' : '1'}</span>
                  <span>Phân tích yêu cầu và xác định mục tiêu bài thuyết trình</span>
                </div>
                <div className={`ppt-ai-step-row ${stepIndex >= 2 ? 'is-done' : ''}`}>
                  <span className="ppt-step-bullet">{stepIndex > 2 ? '✓' : '2'}</span>
                  <span>Xây dựng dàn ý chi tiết và các luận điểm chính</span>
                </div>
                <div className={`ppt-ai-step-row ${stepIndex >= 3 ? 'is-done' : ''}`}>
                  <span className="ppt-step-bullet">{stepIndex >= 3 ? '✓' : '3'}</span>
                  <span>Thiết kế trang chiếu, biểu đồ số liệu & hiệu ứng chuẩn PowerPoint</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" disabled={isGenerating} onClick={onClose}>
            Huỷ
          </button>
          <button
            className="ppt-primary-action-btn"
            disabled={!prompt.trim() || isGenerating}
            onClick={handleStartGenerate}
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
          >
            <Sparkles size={16} /> Bắt đầu tạo bài thuyết trình
          </button>
        </div>
      </div>
    </div>
  );
}
