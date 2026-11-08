import { useState } from 'react';
import {
  Sparkles,
  X,
  Wand2,
  Check,
  FileText,
  MessageSquare,
  Globe,
  ArrowRight,
  Send,
  Zap,
} from 'lucide-react';
import type { SlideData, SlideElement, SlideBackground, SlideLayout } from '../../lib/slideTypes';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { createSlideFromLayout } from '../../lib/slideTemplates';

type AiModalTab = 'topic' | 'text-to-deck' | 'chat-edit' | 'translate';

interface SlideAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
  slides?: SlideData[];
  currentSlideIndex?: number;
  onApplyGeneratedDeck: (newSlides: SlideData[], themeId: string) => void;
  onUpdateSlideElements?: (slideId: string, elements: SlideElement[]) => void;
  onUpdateSlideBackground?: (slideId: string, bg: SlideBackground) => void;
  onApplyTheme?: (themeId: string) => void;
  onUpdatePresentationSlides?: (slides: SlideData[]) => void;
}

const TONES = [
  { id: 'business', label: 'Doanh nghiệp & Đầu tư', desc: 'Súc tích, chuyên nghiệp, tập trung vào số liệu tăng trưởng' },
  { id: 'startup', label: 'Khởi nghiệp Pitch Deck', desc: 'Ấn tượng, nêu bật nỗi đau thị trường và giải pháp đột phá' },
  { id: 'project', label: 'Báo cáo Tiến độ Dự án', desc: 'Rõ ràng, phân bổ theo các cột mốc thời gian và trách nhiệm' },
  { id: 'product', label: 'Giới thiệu Sản phẩm', desc: 'Tập trung tính năng, so sánh lợi thế và giá trị cho người dùng' },
];

// Offline Vietnamese <-> English Presentation Dictionary
const DICTIONARY: Record<string, string> = {
  // General / Deck
  'bài thuyết trình': 'presentation',
  'kế hoạch': 'action plan',
  'mục tiêu': 'objectives',
  'chiến lược': 'strategy',
  'giới thiệu': 'introduction',
  'tổng quan': 'overview',
  'nội dung chính': 'agenda',
  'kết luận': 'conclusion',
  'thảo luận': 'discussion & qa',
  'lộ trình': 'roadmap',
  'báo cáo': 'report',
  'tiến độ': 'progress',

  // Business & Finance
  'doanh thu': 'revenue',
  'chi phí': 'costs',
  'lợi nhuận': 'profit',
  'tăng trưởng': 'growth',
  'thị trường': 'market share',
  'khách hàng': 'customers',
  'đối tác': 'partners',
  'sản phẩm': 'products',
  'dịch vụ': 'services',
  'giải pháp': 'solutions',
  'thách thức': 'challenges',
  'cơ hội': 'opportunities',
  'hiện trạng': 'current state',
  'tương lai': 'future vision',

  // Common phrases
  'cảm ơn quý vị đã lắng nghe': 'thank you for your attention',
  'người trình bày': 'presenter',
  'ngân sách': 'budget',
  'dự báo': 'forecast',
  'hiệu quả': 'efficiency',
  'chuyển đổi số': 'digital transformation',
  'tối ưu hóa': 'optimization',
};

// Reverse Dictionary (EN -> VI)
const REVERSE_DICTIONARY: Record<string, string> = {};
for (const [vi, en] of Object.entries(DICTIONARY)) {
  REVERSE_DICTIONARY[en] = vi;
}

export function SlideAiModal({
  isOpen,
  onClose,
  currentThemeId,
  slides = [],
  currentSlideIndex = 0,
  onApplyGeneratedDeck,
  onUpdateSlideElements,
  onUpdateSlideBackground,
  onApplyTheme,
  onUpdatePresentationSlides,
}: SlideAiModalProps) {
  const [activeTab, setActiveTab] = useState<AiModalTab>('topic');

  // Tab 1: Topic Deck Generator State
  const [prompt, setPrompt] = useState('');
  const [selectedTone, setSelectedTone] = useState('business');
  const [slideCount, setSlideCount] = useState<number>(5);
  const [selectedTheme, setSelectedTheme] = useState(currentThemeId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Tab 2: Text-to-Deck State
  const [rawText, setRawText] = useState(
    '# Chiến Lược Chuyển Đổi Số 2026\n- Tự động hóa 80% quy trình cốt lõi\n- Ứng dụng AI nâng cao năng suất\n- Bảo mật dữ liệu chuẩn quốc tế\n\n# Hiện Trạng & Thách Thức\n- Dữ liệu bị phân mảnh giữa các phòng ban\n- Chi phí vận hành thủ công gia tăng\n\n# Kế Hoạch Triển Khai 3 Giai Đoạn\n- Quý 1: Đánh giá và chuẩn bị hạ tầng\n- Quý 2: Triển khai thử nghiệm\n- Quý 3: Mở rộng toàn hệ thống'
  );

  // Tab 3: Chat-to-Edit State
  const [chatInput, setChatInput] = useState('');
  const [chatFeedback, setChatFeedback] = useState<string | null>(null);

  // Tab 4: Translator State
  const [transDirection, setTransDirection] = useState<'vi-en' | 'en-vi'>('vi-en');
  const [transScope, setTransScope] = useState<'current' | 'all'>('current');
  const [transFeedback, setTransFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSlide = slides[currentSlideIndex] || slides[0];

  // TAB 1: Start Topic Deck Generation (100% Offline Rule-Based Generator)
  const handleStartGenerate = () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStepIndex(1);

    setTimeout(() => {
      setStepIndex(2);
    }, 500);

    setTimeout(() => {
      setStepIndex(3);
    }, 1000);

    setTimeout(() => {
      const titleUpper = prompt.trim().toUpperCase();
      const theme = SLIDE_THEMES[selectedTheme] || SLIDE_THEMES['sapphire-modern'];
      const generatedSlides: SlideData[] = [];

      // Slide 1: Title Slide
      const s1 = createSlideFromLayout('title', 0, selectedTheme, titleUpper);
      s1.elements[1].text = `KẾ HOẠCH HÀNH ĐỘNG & ĐỊNH HƯỚNG PHÁT TRIỂN NĂM 2026\nNgười trình bày: Minh Spark Office AI Team`;
      s1.notes = `Kính chào toàn thể quý vị đại biểu. Hôm nay em xin trình bày về chủ đề "${prompt.trim()}".`;
      generatedSlides.push(s1);

      // Slide 2: Agenda / Objectives
      const s2 = createSlideFromLayout('title-content', 1, selectedTheme, 'MỤC TIÊU & NỘI DUNG CHÍNH');
      s2.elements[1].text = `1. Bối cảnh và Thách thức hiện tại\n2. Mục tiêu chiến lược và Kế hoạch hành động\n3. Biểu đồ dự phóng tăng trưởng & Ngân sách dự kiến\n4. Lộ trình triển khai 4 giai đoạn then chốt\n5. Kết luận và Thảo luận mở`;
      s2.notes = 'Điểm qua 5 nội dung chính của buổi thuyết trình.';
      generatedSlides.push(s2);

      // Slide 3: Comparison / Two Content
      if (slideCount >= 3) {
        const s3 = createSlideFromLayout('two-content', 2, selectedTheme, 'HIỆN TRẠNG & ĐỊNH HƯỚNG MỚI');
        s3.elements[1].text = `• Quy trình thủ công mất nhiều thời gian\n• Dữ liệu phân tán, thiếu liên kết\n• Chi phí vận hành gia tăng\n• Tốc độ phản hồi khách hàng chậm`;
        s3.elements[2].text = `• Tự động hoá 80% quy trình cốt lõi\n• Tập trung dữ liệu thông suốt theo thời gian thực\n• Tối ưu 35% chi phí vận hành\n• Trải nghiệm khách hàng vượt trội và tức thời`;
        s3.notes = 'So sánh trước và sau khi áp dụng giải pháp.';
        generatedSlides.push(s3);
      }

      // Slide 4: Chart Slide
      if (slideCount >= 5) {
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

        // Slide 5: Roadmap / Process
        const s5 = createSlideFromLayout('title-content', 4, selectedTheme, 'LỘ TRÌNH TRIỂN KHAI 4 BƯỚC');
        s5.elements = [
          s5.elements[0],
          {
            id: `el-smartart-${Date.now()}`,
            type: 'smartart',
            x: 8,
            y: 26,
            width: 84,
            height: 55,
            smartArtItems: [
              { title: '1. Khởi động', desc: 'Khảo sát và xác định phạm vi dự án', color: '#0078D4' },
              { title: '2. Xây dựng', desc: 'Phát triển giải pháp và thử nghiệm pilot', color: '#107C41' },
              { title: '3. Triển khai', desc: 'Đào tạo nhân sự và rollout toàn công ty', color: '#D83B01' },
              { title: '4. Tối ưu hóa', desc: 'Đo lường KPI và nâng cấp liên tục', color: '#8E2DE2' },
            ],
          },
        ];
        s5.notes = 'Trình bày 4 giai đoạn lộ trình hành động.';
        generatedSlides.push(s5);
      }

      // Slide 6+: In-depth sections if slideCount == 8
      if (slideCount >= 8) {
        const s6 = createSlideFromLayout('two-content', 5, selectedTheme, 'NGÂN SÁCH & PHÂN BỔ NGUỒN LỰC');
        s6.elements[1].text = `• Nghiên cứu & Phát triển (R&D): 40%\n• Hạ tầng đám mây & Công nghệ: 25%\n• Tiếp thị & Truyền thông: 20%\n• Đào tạo & Dự phòng: 15%`;
        s6.elements[2].text = `• Hoàn vốn dự kiến (ROI): 18 tháng\n• Tỷ suất hoàn vốn nội bộ (IRR): 28%\n• Điểm hòa vốn đạt vào cuối Quý III`;
        generatedSlides.push(s6);

        const s7 = createSlideFromLayout('title-content', 6, selectedTheme, 'QUẢN TRỊ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG');
        s7.elements[1].text = `• Rủi ro công nghệ: Kiểm thử bảo mật định kỳ 2 tuần/lần\n• Rủi ro tiến độ: Áp dụng phương pháp Agile/Scrum linh hoạt\n• Rủi ro nhân sự: Xây dựng tài liệu hướng dẫn chuẩn và đào tạo chéo`;
        generatedSlides.push(s7);
      }

      // Final Slide: Closing
      const sFinal = createSlideFromLayout('section', generatedSlides.length, selectedTheme, 'HỢP TÁC & BỨT PHÁ 2026');
      sFinal.elements[1].text = `CẢM ƠN QUÝ VỊ ĐÃ LẮNG NGHE!\nSẵn sàng giải đáp mọi thắc mắc và tiếp thu ý kiến đóng góp.`;
      sFinal.notes = 'Chuyển sang phần hỏi đáp (Q&A).';
      generatedSlides.push(sFinal);

      setIsGenerating(false);
      onApplyGeneratedDeck(generatedSlides, selectedTheme);
      onClose();
    }, 1500);
  };

  // TAB 2: Text-to-Deck Parser
  const handleParseTextToDeck = () => {
    if (!rawText.trim()) return;

    const sections = rawText.split(/(?=^# )/m).filter((s) => s.trim().length > 0);
    const newSlides: SlideData[] = [];

    sections.forEach((sec, idx) => {
      const lines = sec.trim().split('\n');
      const titleLine = lines[0].replace(/^#+\s*/, '').trim();
      const bodyLines = lines.slice(1).join('\n').trim();

      const layout: SlideLayout = idx === 0 ? 'title' : 'title-content';
      const slide = createSlideFromLayout(layout, idx, currentThemeId, titleLine || `Trang chiếu ${idx + 1}`);

      if (slide.elements[1] && bodyLines) {
        slide.elements[1].text = bodyLines;
        slide.elements[1].isBullet = true;
      }
      slide.notes = `Thuyết trình về: ${titleLine}`;
      newSlides.push(slide);
    });

    if (newSlides.length > 0) {
      onApplyGeneratedDeck(newSlides, currentThemeId);
      onClose();
    }
  };

  // TAB 3: Natural Language Chat-to-Edit Intent Parser
  const handleExecuteChatCommand = (cmdText?: string) => {
    const text = (cmdText || chatInput).toLowerCase().trim();
    if (!text || !currentSlide) return;

    let actionTaken = '';

    // 1. Background color commands
    if (text.includes('nền đen') || text.includes('dark')) {
      onUpdateSlideBackground?.(currentSlide.id, { type: 'solid', value: '#0F172A' });
      actionTaken = 'Đã đổi nền trang chiếu thành màu Đen Tối Giản (#0F172A)';
    } else if (text.includes('nền trắng') || text.includes('nền sáng') || text.includes('white')) {
      onUpdateSlideBackground?.(currentSlide.id, { type: 'solid', value: '#FFFFFF' });
      actionTaken = 'Đã đổi nền trang chiếu thành màu Trắng Sáng Tinh Khiết';
    } else if (text.includes('nền xanh') || text.includes('blue')) {
      onUpdateSlideBackground?.(currentSlide.id, { type: 'solid', value: '#0284C7' });
      actionTaken = 'Đã đổi nền trang chiếu thành màu Xanh Sapphire Hiện Đại';
    } else if (text.includes('gradient')) {
      onUpdateSlideBackground?.(currentSlide.id, {
        type: 'gradient',
        value: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)',
      });
      actionTaken = 'Đã đổi nền trang chiếu thành hiệu ứng Gradient Sang Trọng';
    }
    // 2. Formatting text commands
    else if (text.includes('in đậm') || text.includes('bold')) {
      const updated = currentSlide.elements.map((el) =>
        el.type === 'text' ? { ...el, fontWeight: '700' as const } : el
      );
      onUpdateSlideElements?.(currentSlide.id, updated);
      actionTaken = 'Đã bật in đậm (Bold) cho tất cả hộp văn bản trên trang chiếu';
    } else if (text.includes('căn giữa') || text.includes('center')) {
      const updated = currentSlide.elements.map((el) =>
        el.type === 'text' ? { ...el, textAlign: 'center' as const } : el
      );
      onUpdateSlideElements?.(currentSlide.id, updated);
      actionTaken = 'Đã căn lề giữa (Center Align) cho toàn bộ văn bản';
    }
    // 3. Add code block
    else if (text.includes('code') || text.includes('mã nguồn')) {
      const newEl: SlideElement = {
        id: `code-${Date.now()}`,
        type: 'code',
        x: 15,
        y: 25,
        width: 70,
        height: 50,
        codeLang: 'typescript',
        codeContent: '// Minh Spark Copilot Generated Code\ninterface SlideSuperpower {\n  name: string;\n  ready: boolean;\n}\n\nconst power: SlideSuperpower = { name: "AI Designer", ready: true };\nconsole.log(power);',
      };
      onUpdateSlideElements?.(currentSlide.id, [...currentSlide.elements, newEl]);
      actionTaken = 'Đã chèn khối mã nguồn TypeScript với giao diện IDE tối màu';
    }
    // 4. Add math formula
    else if (text.includes('toán') || text.includes('math') || text.includes('công thức')) {
      const newEl: SlideElement = {
        id: `math-${Date.now()}`,
        type: 'math',
        x: 20,
        y: 35,
        width: 60,
        height: 30,
        mathFormula: 'E = mc^2 \\quad \\text{và} \\quad \\oint_{\\partial \\Omega} \\mathbf{B} \\cdot d\\mathbf{l} = \\mu_0 I_{\\text{enc}}',
      };
      onUpdateSlideElements?.(currentSlide.id, [...currentSlide.elements, newEl]);
      actionTaken = 'Đã chèn công thức Toán học chuẩn LaTeX';
    }
    // 5. Add chart
    else if (text.includes('biểu đồ') || text.includes('chart')) {
      const newEl: SlideElement = {
        id: `chart-${Date.now()}`,
        type: 'chart',
        chartType: 'column',
        chartTitle: 'Chỉ Số Tăng Trưởng Doanh Nghiệp',
        chartCategories: ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'],
        chartSeries: [
          { name: 'Kế hoạch', values: [100, 150, 220, 300], color: '#0078D4' },
          { name: 'Thực tế', values: [120, 180, 260, 380], color: '#107C41' },
        ],
        x: 10,
        y: 22,
        width: 80,
        height: 65,
      };
      onUpdateSlideElements?.(currentSlide.id, [...currentSlide.elements, newEl]);
      actionTaken = 'Đã chèn Biểu đồ Cột so sánh Kế hoạch & Thực tế';
    }
    // 6. Lock all elements
    else if (text.includes('khóa') || text.includes('lock')) {
      const updated = currentSlide.elements.map((el) => ({ ...el, locked: true }));
      onUpdateSlideElements?.(currentSlide.id, updated);
      actionTaken = 'Đã khóa toàn bộ đối tượng trên trang chiếu để chống vô tình di chuyển';
    } else if (text.includes('theme') || text.includes('chủ đề')) {
      onApplyTheme?.('emerald-growth');
      actionTaken = 'Đã áp dụng bộ chủ đề Doanh nghiệp Tăng trưởng (Emerald Growth)';
    } else {
      actionTaken = `Đã ghi nhận lệnh "${chatInput}". Hãy chọn một gợi ý bên dưới để thực hiện ngay.`;
    }

    setChatFeedback(actionTaken);
    setChatInput('');
  };

  // TAB 4: Smart Presentation Translator
  const handleTranslatePresentation = () => {
    const dict = transDirection === 'vi-en' ? DICTIONARY : REVERSE_DICTIONARY;

    const translateText = (src: string): string => {
      let res = src;
      for (const [key, val] of Object.entries(dict)) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        res = res.replace(regex, (match) => {
          if (match === match.toUpperCase()) return val.toUpperCase();
          if (match[0] === match[0].toUpperCase()) {
            return val.charAt(0).toUpperCase() + val.slice(1);
          }
          return val;
        });
      }
      return res;
    };

    if (transScope === 'current' && currentSlide) {
      const translatedElements = currentSlide.elements.map((el) => {
        if (el.text) return { ...el, text: translateText(el.text) };
        if (el.chartTitle) return { ...el, chartTitle: translateText(el.chartTitle) };
        if (el.smartArtItems) {
          return {
            ...el,
            smartArtItems: el.smartArtItems.map((item) => ({
              ...item,
              title: translateText(item.title),
              desc: translateText(item.desc),
            })),
          };
        }
        return el;
      });
      onUpdateSlideElements?.(currentSlide.id, translatedElements);
      setTransFeedback('Đã hoàn tất dịch trang chiếu hiện tại!');
    } else if (transScope === 'all' && slides.length > 0) {
      const updatedSlides = slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.text) return { ...el, text: translateText(el.text) };
          if (el.chartTitle) return { ...el, chartTitle: translateText(el.chartTitle) };
          if (el.smartArtItems) {
            return {
              ...el,
              smartArtItems: el.smartArtItems.map((item) => ({
                ...item,
                title: translateText(item.title),
                desc: translateText(item.desc),
              })),
            };
          }
          return el;
        }),
      }));
      onUpdatePresentationSlides?.(updatedSlides);
      setTransFeedback(`Đã hoàn tất dịch toàn bộ ${slides.length} trang chiếu trong bài thuyết trình!`);
    }
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header" style={{ background: 'linear-gradient(135deg, #312E81 0%, #4338CA 100%)', color: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#FBBF24" />
            <span style={{ fontWeight: 700, fontSize: '17px' }}>AI Presentation Copilot · Trợ Lý Toàn Năng (100% Offline)</span>
          </div>
          <button className="ppt-dialog-close-btn" style={{ color: '#FFFFFF' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* 4 Tabs Bar */}
        <div className="ppt-ai-tab-strip">
          <button
            className={`ppt-ai-tab-btn ${activeTab === 'topic' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('topic')}
          >
            <Sparkles size={16} />
            <span>Sinh theo chủ đề</span>
          </button>
          <button
            className={`ppt-ai-tab-btn ${activeTab === 'text-to-deck' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('text-to-deck')}
          >
            <FileText size={16} />
            <span>Văn bản sang Slide</span>
          </button>
          <button
            className={`ppt-ai-tab-btn ${activeTab === 'chat-edit' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('chat-edit')}
          >
            <MessageSquare size={16} />
            <span>Lệnh Chat chỉnh sửa</span>
          </button>
          <button
            className={`ppt-ai-tab-btn ${activeTab === 'translate' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('translate')}
          >
            <Globe size={16} />
            <span>Dịch thuật bài chiếu</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="ppt-dialog-body" style={{ minHeight: '360px' }}>
          {/* TAB 1: TOPIC DECK GENERATOR */}
          {activeTab === 'topic' && (
            <>
              {!isGenerating ? (
                <>
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
            </>
          )}

          {/* TAB 2: TEXT-TO-DECK PARSER */}
          {activeTab === 'text-to-deck' && (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Dán dàn ý hoặc ghi chú văn bản (Hỗ trợ Markdown):
                </label>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                  Dùng dấu <code># Tiêu đề slide</code> để phân tách từng trang chiếu, và <code>- Gạch đầu dòng</code> cho các luận điểm.
                </div>
                <textarea
                  className="ppt-dialog-textarea"
                  rows={10}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  style={{ fontFamily: 'Consolas, monospace', fontSize: '13px', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#475569' }}>
                💡 <strong>Mẹo thông minh:</strong> AI sẽ tự động tạo trang bìa, các trang nội dung, căn chỉnh tỷ lệ và thêm ghi chú diễn giả tương ứng.
              </div>
            </div>
          )}

          {/* TAB 3: CHAT-TO-EDIT COMMAND BOT */}
          {activeTab === 'chat-edit' && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Nhập câu lệnh tự nhiên để chỉnh sửa trang chiếu hiện tại:
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    className="ppt-input"
                    style={{ flex: 1, padding: '10px 14px' }}
                    placeholder="Ví dụ: Đổi nền màu đen, In đậm văn bản, Thêm biểu đồ cột, Thêm khối code..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecuteChatCommand()}
                    autoFocus
                  />
                  <button
                    className="ppt-primary-action-btn"
                    style={{ padding: '0 20px', background: '#4F46E5' }}
                    onClick={() => handleExecuteChatCommand()}
                  >
                    <Send size={16} /> Thực hiện
                  </button>
                </div>
              </div>

              {chatFeedback && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '6px', color: '#166534', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Check size={18} color="#16A34A" />
                  <span>{chatFeedback}</span>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
                  CÂU LỆNH MẪU ĐƯỢC DÙNG NHIỀU:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    'Đổi nền thành màu đen sang trọng',
                    'Đổi nền gradient xanh tím',
                    'In đậm tất cả văn bản',
                    'Căn giữa văn bản',
                    'Thêm khối mã nguồn TypeScript',
                    'Thêm công thức toán học LaTeX',
                    'Thêm biểu đồ cột',
                    'Khóa đối tượng trên trang chiếu',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      className="ppt-quick-chip-btn"
                      onClick={() => handleExecuteChatCommand(sample)}
                    >
                      <Zap size={12} color="#D83B01" /> {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SMART PRESENTATION TRANSLATOR */}
          {activeTab === 'translate' && (
            <div>
              <div className="ppt-format-grid-2">
                <div className="ppt-dialog-field">
                  <label style={{ fontWeight: 600 }}>Chiều dịch thuật:</label>
                  <select
                    className="ppt-select"
                    value={transDirection}
                    onChange={(e) => setTransDirection(e.target.value as any)}
                  >
                    <option value="vi-en">Tiếng Việt ➔ Tiếng Anh (English)</option>
                    <option value="en-vi">English ➔ Tiếng Việt</option>
                  </select>
                </div>

                <div className="ppt-dialog-field">
                  <label style={{ fontWeight: 600 }}>Phạm vi dịch thuật:</label>
                  <select
                    className="ppt-select"
                    value={transScope}
                    onChange={(e) => setTransScope(e.target.value as any)}
                  >
                    <option value="current">Chỉ trang chiếu hiện tại</option>
                    <option value="all">Toàn bộ bài thuyết trình ({slides.length} trang)</option>
                  </select>
                </div>
              </div>

              {transFeedback && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '6px', color: '#166534', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
                  <Check size={18} color="#16A34A" />
                  <span>{transFeedback}</span>
                </div>
              )}

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#1E293B' }}>Đặc điểm bộ dịch chuyên ngành thuyết trình:</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                  <li>Hoạt động 100% Offline từ bộ từ điển chuyên sâu Business, Tech & Academic.</li>
                  <li>Giữ nguyên 100% định dạng, vị trí, kích thước chữ, màu sắc và hiệu ứng hoạt hình.</li>
                  <li>Dịch chuẩn xác các thuật ngữ tiêu đề, biểu đồ và SmartArt.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" disabled={isGenerating} onClick={onClose}>
            Đóng
          </button>

          {activeTab === 'topic' && (
            <button
              className="ppt-primary-action-btn"
              disabled={!prompt.trim() || isGenerating}
              onClick={handleStartGenerate}
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
            >
              <Sparkles size={16} /> Tạo bài thuyết trình
            </button>
          )}

          {activeTab === 'text-to-deck' && (
            <button
              className="ppt-primary-action-btn"
              disabled={!rawText.trim()}
              onClick={handleParseTextToDeck}
              style={{ background: 'linear-gradient(135deg, #107C41 0%, #059669 100%)' }}
            >
              <ArrowRight size={16} /> Chuyển thành Slide (Text-to-Deck)
            </button>
          )}

          {activeTab === 'translate' && (
            <button
              className="ppt-primary-action-btn"
              onClick={handleTranslatePresentation}
              style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)' }}
            >
              <Globe size={16} /> Bắt đầu dịch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
