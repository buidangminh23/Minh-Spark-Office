import { useState, type ComponentType, type CSSProperties } from 'react';
import { Sparkles, X, Check, LayoutGrid, SplitSquareVertical, BarChart2, Layers, Moon, Columns, ImageIcon } from 'lucide-react';
import type { SlideData, SlideElement, SlideBackground } from '../../lib/slideTypes';
import './slideDesigner.css';

interface SlideDesignerPaneProps {
  slide: SlideData;
  themeId: string;
  onApplyDesign: (newElements: SlideElement[], newBackground?: SlideBackground) => void;
  onClose: () => void;
}

interface SlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesignIdea {
  id: string;
  title: string;
  desc: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  category: string;
  mediaSlot?: SlotRect & { replaces: RegExp };
  generate: (currentElements: SlideElement[], slideBg: SlideBackground) => { elements: SlideElement[]; background?: SlideBackground };
}

interface DesignResult {
  elements: SlideElement[];
  background?: SlideBackground;
  mediaPlaced: boolean;
}

const TEXT_TYPES = new Set<SlideElement['type']>(['text', 'shape']);
const MEDIA_GAP = 2;
const SLIDE_BASE_WIDTH = 960;
const VERTICAL_ALIGN: Record<string, CSSProperties['justifyContent']> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

const toPreviewUnit = (px: number) => `${(px / SLIDE_BASE_WIDTH) * 100}cqw`;

function fitIntoSlot(media: SlideElement[], slot: SlotRect): SlideElement[] {
  const cellHeight = (slot.height - MEDIA_GAP * (media.length - 1)) / media.length;
  return media.map((el, i) => {
    const ratio = el.height > 0 ? el.width / el.height : 1;
    const width = Math.min(slot.width, cellHeight * ratio);
    const height = width / ratio;
    return {
      ...el,
      x: slot.x + (slot.width - width) / 2,
      y: slot.y + i * (cellHeight + MEDIA_GAP) + (cellHeight - height) / 2,
      width,
      height,
    };
  });
}

function composeDesign(idea: DesignIdea, slide: SlideData, media: SlideElement[]): DesignResult {
  const base = idea.generate(slide.elements, slide.background);
  if (media.length === 0) return { ...base, mediaPlaced: false };
  if (!idea.mediaSlot) return { ...base, elements: [...base.elements, ...media], mediaPlaced: false };
  const kept = base.elements.filter((el) => !idea.mediaSlot!.replaces.test(el.id));
  return { ...base, elements: [...kept, ...fitIntoSlot(media, idea.mediaSlot)], mediaPlaced: true };
}

function DesignPreview({ result }: { result: DesignResult }) {
  const bg = result.background?.value || '#FFFFFF';
  return (
    <div className="ppt-designer-preview" style={{ background: bg }} aria-hidden="true">
      {result.elements.map((el) => {
        const isMedia = !TEXT_TYPES.has(el.type);
        const isShape = el.type === 'shape';
        return (
          <div
            key={el.id}
            className={`ppt-designer-preview-el${isMedia ? ' is-media' : ''}`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              background: isShape ? el.fill || 'transparent' : undefined,
              borderColor: isShape ? el.stroke || 'transparent' : undefined,
              borderRadius: el.borderRadius ? toPreviewUnit(el.borderRadius) : undefined,
              boxShadow: el.shapeShadow ? '0 1px 3px rgba(15, 23, 42, 0.12)' : undefined,
              padding: el.padding ? toPreviewUnit(el.padding) : undefined,
              justifyContent: VERTICAL_ALIGN[el.verticalAlign ?? 'top'],
              color: el.color || '#0F172A',
              fontSize: toPreviewUnit(el.fontSize || 16),
              fontWeight: el.fontWeight as CSSProperties['fontWeight'],
              textAlign: el.textAlign,
            }}
          >
            {isMedia ? <ImageIcon size={12} /> : el.text}
          </div>
        );
      })}
    </div>
  );
}

export function SlideDesignerPane({
  slide,
  themeId: _themeId,
  onApplyDesign,
  onClose,
}: SlideDesignerPaneProps) {
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const textElements = slide.elements.filter((el) => TEXT_TYPES.has(el.type) && el.text?.trim());
  const titleEl =
    textElements.find((el) => el.isTitle) ||
    textElements.find((el) => (el.fontSize ?? 0) >= 28) ||
    textElements[0];
  const titleText = titleEl?.text || 'Tiêu đề bài thuyết trình';
  const bodyElements = textElements.filter((el) => el.id !== titleEl?.id);
  const bodyText = (index: number, fallback: string) => bodyElements[index]?.text?.trim() || fallback;
  const media = slide.elements.filter((el) => !TEXT_TYPES.has(el.type));

  // 6 Algorithmic Designer Layouts (100% Offline, Zero API Key Required)
  const DESIGN_IDEAS: DesignIdea[] = [
    {
      id: 'cards-3',
      title: 'Lưới 3 Thẻ Hiện Đại',
      desc: 'Bố cục chia 3 thẻ bóng mờ, viền bo tròn sang trọng với màu sắc tương phản cao',
      icon: LayoutGrid,
      category: 'Thẻ bài',
      mediaSlot: { x: 66, y: 28, width: 26, height: 58, replaces: /^card-\d+-2$/ },
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
          const cardText = bodyText(i, i === 0 ? 'Chiến lược phát triển cốt lõi' : i === 1 ? 'Mở rộng quy mô người dùng' : 'Tối ưu hóa biên lợi nhuận');
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
            text: `0${i + 1}\n\n${cardText}`,
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
      mediaSlot: { x: 52, y: 15, width: 40, height: 70, replaces: /^card-right-/ },
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
          text: bodyText(0, 'Tập trung vào những giải pháp đột phá và tạo ra giá trị bền vững cho toàn hệ sinh thái doanh nghiệp.'),
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
          text: bodyText(1, 'ĐIỂM NHẤN CHIẾN LƯỢC\n\n✓ Tăng trưởng thần tốc\n✓ Ứng dụng AI thông minh\n✓ Dẫn đầu trải nghiệm người dùng'),
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
      mediaSlot: { x: 72.5, y: 35, width: 20, height: 48, replaces: /^step-card-\d+-3$/ },
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
            text: `BƯỚC ${i + 1}\n\n${bodyText(i, `${name}\n\nTriển khai các tiêu chuẩn nghiệm thu nghiêm ngặt`)}`,
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
          text: bodyText(0, 'KIẾN TẠO TƯƠNG LAI BẰNG NHỮNG BƯỚC ĐI VỮNG CHẮC\n\nTrải nghiệm văn phòng số hiện đại, bảo mật và tốc độ vượt bậc'),
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
          text: bodyText(0, 'HIỆN TRẠNG (BEFORE)\n\n• Quy trình thủ công mất thời gian\n• Rủi ro thất lạc số liệu\n• Chi phí vận hành tốn kém'),
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
          text: bodyText(1, 'GIẢI PHÁP OFFICE 23 (AFTER)\n\n• Tự động hóa 100% bằng AI\n• Đồng bộ thời gian thực bảo mật\n• Tối ưu 70% ngân sách'),
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

  const designs = DESIGN_IDEAS.map((idea) => ({ idea, result: composeDesign(idea, slide, media) })).sort(
    (a, b) => Number(b.result.mediaPlaced) - Number(a.result.mediaPlaced)
  );

  const applyDesign = (ideaId: string, result: DesignResult) => {
    onApplyDesign(result.elements, result.background);
    setAppliedId(ideaId);
  };

  return (
    <aside className="ppt-designer-pane" aria-label="Ý tưởng thiết kế">
      <header className="ppt-designer-header">
        <div className="ppt-designer-title">
          <span className="ppt-designer-badge">
            <Sparkles size={14} />
          </span>
          <div>
            <strong>Ý tưởng thiết kế</strong>
            <span>{designs.length} bố cục cho trang chiếu này</span>
          </div>
        </div>
        <button type="button" className="ppt-designer-close" onClick={onClose} aria-label="Đóng bảng Designer">
          <X size={16} />
        </button>
      </header>

      <p className="ppt-designer-note">
        Chạy ngay trên máy, không cần API key. Chữ trên trang được giữ lại
        {media.length > 0 ? `, cùng ${media.length} ảnh, bảng hoặc biểu đồ` : ''}. Bấm Ctrl+Z để quay lại.
      </p>

      <div className="ppt-designer-cards-list">
        {designs.map(({ idea, result }) => {
          const IconComp = idea.icon;
          const isApplied = appliedId === idea.id;
          return (
            <button
              type="button"
              key={idea.id}
              className={`ppt-designer-card-item${isApplied ? ' is-applied' : ''}`}
              onClick={() => applyDesign(idea.id, result)}
            >
              <DesignPreview result={result} />
              <div className="ppt-designer-card-body">
                <div className="ppt-designer-card-head">
                  <span className="ppt-designer-card-name">
                    <IconComp size={14} />
                    {idea.title}
                  </span>
                  <span className="ppt-designer-chip">{idea.category}</span>
                </div>
                <p className="ppt-designer-card-desc">{idea.desc}</p>
                {media.length > 0 && (
                  <span className={`ppt-designer-hint${result.mediaPlaced ? '' : ' is-muted'}`}>
                    {result.mediaPlaced ? 'Tự xếp ảnh, bảng vào khung riêng' : 'Ảnh, bảng giữ nguyên vị trí cũ'}
                  </span>
                )}
              </div>
              <span className="ppt-designer-apply">
                <Check size={12} /> {isApplied ? 'Đã áp dụng' : 'Áp dụng'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
