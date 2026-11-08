import { Sparkles, X, Check, LayoutGrid, SplitSquareVertical, BarChart2, Layers, Moon, Columns } from 'lucide-react';
import type { SlideData, SlideElement, SlideBackground } from '../../lib/slideTypes';

interface SlideDesignerPaneProps {
  slide: SlideData;
  themeId: string;
  onApplyDesign: (newElements: SlideElement[], newBackground?: SlideBackground) => void;
  onClose: () => void;
}

interface DesignIdea {
  id: string;
  title: string;
  desc: string;
  icon: any;
  category: string;
  generate: (currentElements: SlideElement[], slideBg: SlideBackground) => { elements: SlideElement[]; background?: SlideBackground };
}

export function SlideDesignerPane({
  slide,
  themeId: _themeId,
  onApplyDesign,
  onClose,
}: SlideDesignerPaneProps) {
  // Extract text and elements from current slide
  const titleEl = slide.elements.find((el) => el.isTitle || el.fontSize && el.fontSize >= 28) || slide.elements[0];
  const titleText = titleEl?.text || 'Tiêu đề bài thuyết trình';
  const bodyElements = slide.elements.filter((el) => el.id !== titleEl?.id);

  // 6 Algorithmic Designer Layouts (100% Offline, Zero API Key Required)
  const DESIGN_IDEAS: DesignIdea[] = [
    {
      id: 'cards-3',
      title: 'Lưới 3 Thẻ Hiện Đại',
      desc: 'Bố cục chia 3 thẻ bóng mờ, viền bo tròn sang trọng với màu sắc tương phản cao',
      icon: LayoutGrid,
      category: 'Thẻ bài',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 8,
          y: 8,
          width: 84,
          height: 14,
          text: titleText,
          fontSize: 32,
          fontWeight: '700',
          color: '#0F172A',
          textAlign: 'left',
          isTitle: true,
        };

        const colors = ['#0284C7', '#059669', '#7C3AED'];
        const cardElements: SlideElement[] = [0, 1, 2].map((i) => {
          const bodyText = bodyElements[i]?.text || (i === 0 ? 'Chiến lược phát triển cốt lõi' : i === 1 ? 'Mở rộng quy mô người dùng' : 'Tối ưu hóa biên lợi nhuận');
          return {
            id: `card-${Date.now()}-${i}`,
            type: 'shape',
            shapeType: 'rectangle',
            x: 8 + i * 29,
            y: 28,
            width: 26,
            height: 58,
            fill: '#FFFFFF',
            stroke: colors[i],
            strokeWidth: 2,
            borderRadius: 12,
            shapeShadow: true,
            shadowColor: 'rgba(0,0,0,0.08)',
            shadowBlur: 16,
            text: `0${i + 1}\n\n${bodyText}`,
            fontSize: 16,
            fontWeight: '600',
            color: '#1E293B',
            textAlign: 'center',
            verticalAlign: 'middle',
            padding: 16,
          };
        });

        return {
          elements: [title, ...cardElements],
          background: { type: 'solid', value: '#F8FAFC' },
        };
      },
    },
    {
      id: 'split-visual',
      title: 'Chia Cột Đối Xứng (Visual Split)',
      desc: 'Nửa trái làm nổi bật tiêu đề và thông điệp chính, nửa phải là thẻ đồ họa tương phản',
      icon: SplitSquareVertical,
      category: 'Đối xứng',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 8,
          y: 20,
          width: 40,
          height: 30,
          text: titleText,
          fontSize: 36,
          fontWeight: '800',
          color: '#0F172A',
          textAlign: 'left',
        };

        const subtitle: SlideElement = {
          id: `sub-${Date.now()}`,
          type: 'text',
          x: 8,
          y: 52,
          width: 40,
          height: 25,
          text: 'Tập trung vào những giải pháp đột phá và tạo ra giá trị bền vững cho toàn hệ sinh thái doanh nghiệp.',
          fontSize: 18,
          color: '#475569',
          textAlign: 'left',
        };

        const rightCard: SlideElement = {
          id: `card-right-${Date.now()}`,
          type: 'shape',
          shapeType: 'rectangle',
          x: 52,
          y: 15,
          width: 40,
          height: 70,
          fill: '#0F172A',
          stroke: '#D83B01',
          strokeWidth: 3,
          borderRadius: 16,
          shapeShadow: true,
          shadowColor: 'rgba(15, 23, 42, 0.25)',
          shadowBlur: 24,
          text: 'ĐIỂM NHẤN CHIẾN LƯỢC\n\n✓ Tăng trưởng thần tốc\n✓ Ứng dụng AI thông minh\n✓ Dẫn đầu trải nghiệm người dùng',
          fontSize: 18,
          fontWeight: '600',
          color: '#F8FAFC',
          textAlign: 'left',
          verticalAlign: 'middle',
          padding: 24,
        };

        return {
          elements: [title, subtitle, rightCard],
          background: { type: 'solid', value: '#FFFFFF' },
        };
      },
    },
    {
      id: 'stats-highlight',
      title: 'Chỉ Số Nổi Bật (Big Stats Highlight)',
      desc: 'Thiết kế nhấn mạnh 3 con số thống kê ấn tượng kích thước 54px kèm chú thích',
      icon: BarChart2,
      category: 'Số liệu',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 10,
          y: 12,
          width: 80,
          height: 16,
          text: titleText,
          fontSize: 32,
          fontWeight: '800',
          color: '#0F172A',
          textAlign: 'center',
        };

        const stats = [
          { num: '150 TỶ', label: 'Doanh thu kế hoạch năm' },
          { num: '+240%', label: 'Tăng trưởng so với cùng kỳ' },
          { num: '500K+', label: 'Người dùng tin cậy' },
        ];

        const statEls: SlideElement[] = [];
        stats.forEach((s, i) => {
          statEls.push({
            id: `stat-box-${Date.now()}-${i}`,
            type: 'shape',
            shapeType: 'rectangle',
            x: 10 + i * 28,
            y: 35,
            width: 24,
            height: 45,
            fill: '#FFFFFF',
            stroke: '#E2E8F0',
            strokeWidth: 1,
            borderRadius: 12,
            shapeShadow: true,
            shadowColor: 'rgba(0,0,0,0.06)',
            shadowBlur: 12,
          });
          statEls.push({
            id: `stat-num-${Date.now()}-${i}`,
            type: 'text',
            x: 10 + i * 28,
            y: 42,
            width: 24,
            height: 16,
            text: s.num,
            fontSize: 36,
            fontWeight: '800',
            color: i === 1 ? '#059669' : i === 0 ? '#D83B01' : '#0284C7',
            textAlign: 'center',
          });
          statEls.push({
            id: `stat-lbl-${Date.now()}-${i}`,
            type: 'text',
            x: 11 + i * 28,
            y: 58,
            width: 22,
            height: 16,
            text: s.label,
            fontSize: 14,
            fontWeight: 'normal',
            color: '#64748B',
            textAlign: 'center',
          });
        });

        return {
          elements: [title, ...statEls],
          background: { type: 'solid', value: '#F1F5F9' },
        };
      },
    },
    {
      id: 'process-flow',
      title: 'Quy Trình 4 Bước (Process Steps)',
      desc: 'Bố cục đường tiến trình ngang với số thứ tự và thẻ mô tả trực quan',
      icon: Layers,
      category: 'Quy trình',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 8,
          y: 10,
          width: 84,
          height: 14,
          text: titleText,
          fontSize: 30,
          fontWeight: '700',
          color: '#0F172A',
        };

        const steps = ['Ý TƯỞNG', 'THIẾT KẾ', 'SẢN XUẤT', 'BÀN GIAO'];
        const colors = ['#0284C7', '#0D9488', '#F59E0B', '#107C41'];

        const stepEls: SlideElement[] = [];
        steps.forEach((name, i) => {
          stepEls.push({
            id: `step-card-${Date.now()}-${i}`,
            type: 'shape',
            shapeType: 'rectangle',
            x: 8 + i * 21.5,
            y: 35,
            width: 20,
            height: 48,
            fill: '#FFFFFF',
            stroke: colors[i],
            strokeWidth: 2,
            borderRadius: 8,
            shapeShadow: true,
            shadowColor: 'rgba(0,0,0,0.06)',
            shadowBlur: 10,
            text: `BƯỚC ${i + 1}\n\n${name}\n\nTriển khai các tiêu chuẩn nghiệm thu nghiêm ngặt`,
            fontSize: 14,
            fontWeight: '600',
            color: '#334155',
            textAlign: 'center',
            verticalAlign: 'middle',
            padding: 12,
          });
        });

        return {
          elements: [title, ...stepEls],
          background: { type: 'solid', value: '#F8FAFC' },
        };
      },
    },
    {
      id: 'dark-minimal',
      title: 'Tối Giản Cao Cấp (Dark Minimalist)',
      desc: 'Nền tối Midnight tương phản cao với chữ vàng kim và khối viền phát sáng',
      icon: Moon,
      category: 'Dark Mode',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 10,
          y: 20,
          width: 80,
          height: 20,
          text: titleText,
          fontSize: 40,
          fontWeight: '800',
          color: '#F8FAFC',
          textAlign: 'center',
        };

        const subtitle: SlideElement = {
          id: `sub-${Date.now()}`,
          type: 'text',
          x: 15,
          y: 42,
          width: 70,
          height: 35,
          text: 'KIẾN TẠO TƯƠNG LAI BẰNG NHỮNG BƯỚC ĐI VỮNG CHẮC\n\nTrải nghiệm văn phòng số hiện đại, bảo mật và tốc độ vượt bậc',
          fontSize: 18,
          color: '#F59E0B',
          textAlign: 'center',
          lineHeight: 1.6,
        };

        return {
          elements: [title, subtitle],
          background: { type: 'solid', value: '#0B1329' },
        };
      },
    },
    {
      id: 'compare-columns',
      title: 'So Sánh 2 Cột (Comparison Deck)',
      desc: 'Bố cục phân tích song song giữa Hiện trạng và Đề xuất giải pháp mới',
      icon: Columns,
      category: 'So sánh',
      generate: () => {
        const title: SlideElement = {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 8,
          y: 8,
          width: 84,
          height: 14,
          text: titleText,
          fontSize: 30,
          fontWeight: '700',
          color: '#0F172A',
        };

        const col1: SlideElement = {
          id: `col1-${Date.now()}`,
          type: 'shape',
          shapeType: 'rectangle',
          x: 8,
          y: 25,
          width: 40,
          height: 65,
          fill: '#FEF2F2',
          stroke: '#EF4444',
          strokeWidth: 2,
          borderRadius: 12,
          text: 'HIỆN TRẠNG (BEFORE)\n\n• Quy trình thủ công mất thời gian\n• Rủi ro thất lạc số liệu\n• Chi phí vận hành tốn kém',
          fontSize: 16,
          fontWeight: '600',
          color: '#991B1B',
          textAlign: 'left',
          verticalAlign: 'top',
          padding: 20,
        };

        const col2: SlideElement = {
          id: `col2-${Date.now()}`,
          type: 'shape',
          shapeType: 'rectangle',
          x: 52,
          y: 25,
          width: 40,
          height: 65,
          fill: '#F0FDF4',
          stroke: '#107C41',
          strokeWidth: 2,
          borderRadius: 12,
          text: 'GIẢI PHÁP MINH OFFICE (AFTER)\n\n• Tự động hóa 100% bằng AI\n• Đồng bộ thời gian thực bảo mật\n• Tối ưu 70% ngân sách',
          fontSize: 16,
          fontWeight: '600',
          color: '#065F46',
          textAlign: 'left',
          verticalAlign: 'top',
          padding: 20,
        };

        return {
          elements: [title, col1, col2],
          background: { type: 'solid', value: '#FFFFFF' },
        };
      },
    },
  ];

  return (
    <div className="ppt-designer-pane">
      <div className="ppt-designer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D83B01', fontWeight: 700, fontSize: '13px' }}>
          <Sparkles size={18} />
          <span>Ý Tưởng Thiết Kế (Designer)</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}
          title="Đóng bảng Designer"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: '8px 16px', background: '#FFF7ED', borderBottom: '1px solid #FFEDD5', fontSize: '11px', color: '#9A3412', lineHeight: 1.4 }}>
        💡 <strong>100% Tự động & Không cần API key:</strong> Chọn 1 mẫu bên dưới để tự động sắp xếp lại bố cục, phông chữ và màu sắc chuyên nghiệp trong 1 cú nhấp.
      </div>

      <div className="ppt-designer-cards-list">
        {DESIGN_IDEAS.map((idea) => {
          const IconComp = idea.icon;
          return (
            <div
              key={idea.id}
              className="ppt-designer-card-item"
              onClick={() => {
                const res = idea.generate(slide.elements, slide.background);
                onApplyDesign(res.elements, res.background);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: '#0F172A' }}>
                  <IconComp size={16} color="#D83B01" />
                  {idea.title}
                </span>
                <span style={{ fontSize: '10px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#64748B' }}>
                  {idea.category}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                {idea.desc}
              </p>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="ppt-dialog-btn is-primary"
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Check size={12} /> Áp dụng bố cục
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
