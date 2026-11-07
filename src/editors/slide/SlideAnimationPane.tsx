import { useState } from 'react';
import {
  X,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  MousePointer,
  Clock,
  Timer,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import type { SlideData, SlideElement, ElementAnimation, AnimationTrigger } from '../../lib/slideTypes';

interface SlideAnimationPaneProps {
  slide: SlideData;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onClose: () => void;
  onPlayPreview: () => void;
  isPlayingPreview: boolean;
}

export function SlideAnimationPane({
  slide,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onClose,
  onPlayPreview,
  isPlayingPreview,
}: SlideAnimationPaneProps) {
  // Collect all animations from all elements on this slide
  const animationList: {
    element: SlideElement;
    anim: ElementAnimation;
  }[] = [];

  slide.elements.forEach((el) => {
    if (el.animations && el.animations.length > 0) {
      el.animations.forEach((anim) => {
        animationList.push({ element: el, anim });
      });
    } else if (el.animation && el.animation.type !== 'none') {
      // Legacy single animation fallback
      const cat = el.animation.type.includes('fade-out') || el.animation.type.includes('disappear') || el.animation.type.includes('fly-out')
        ? 'exit'
        : el.animation.type.includes('pulse') || el.animation.type.includes('spin') || el.animation.type.includes('teeter')
        ? 'emphasis'
        : 'entrance';

      animationList.push({
        element: el,
        anim: {
          id: `anim-${el.id}`,
          type: el.animation.type,
          category: cat,
          duration: el.animation.duration || 0.5,
          delay: el.animation.delay || 0,
          trigger: el.animation.trigger || 'on-click',
          direction: el.animation.direction,
          order: 1,
        },
      });
    }
  });

  const [activeItemMenuId, setActiveItemMenuId] = useState<string | null>(null);

  // Move animation up or down
  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === animationList.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const itemA = animationList[index];
    const itemB = animationList[targetIdx];

    // Swap z-index or order
    const updatedA = { ...itemA.anim, order: targetIdx + 1 };
    const updatedB = { ...itemB.anim, order: index + 1 };

    // Update element A
    if (itemA.element.animations) {
      const newAnims = itemA.element.animations.map((a) => (a.id === itemA.anim.id ? updatedA : a));
      onUpdateElement(itemA.element.id, { animations: newAnims });
    }
    // Update element B
    if (itemB.element.animations) {
      const newAnims = itemB.element.animations.map((a) => (a.id === itemB.anim.id ? updatedB : a));
      onUpdateElement(itemB.element.id, { animations: newAnims });
    }
  };

  // Delete animation
  const handleDeleteAnimation = (item: { element: SlideElement; anim: ElementAnimation }) => {
    if (item.element.animations) {
      const newAnims = item.element.animations.filter((a) => a.id !== item.anim.id);
      onUpdateElement(item.element.id, {
        animations: newAnims,
        animation: newAnims.length > 0 ? { type: newAnims[0].type, duration: newAnims[0].duration, delay: newAnims[0].delay } : { type: 'none', duration: 0.5, delay: 0 },
      });
    } else {
      onUpdateElement(item.element.id, {
        animation: { type: 'none', duration: 0.5, delay: 0 },
      });
    }
  };

  // Change trigger
  const handleChangeTrigger = (item: { element: SlideElement; anim: ElementAnimation }, trigger: AnimationTrigger) => {
    if (item.element.animations) {
      const newAnims = item.element.animations.map((a) => (a.id === item.anim.id ? { ...a, trigger } : a));
      onUpdateElement(item.element.id, { animations: newAnims });
    } else if (item.element.animation) {
      onUpdateElement(item.element.id, {
        animation: { ...item.element.animation, trigger },
      });
    }
  };

  return (
    <aside className="ppt-anim-pane" aria-label="Ngăn Hoạt hình">
      {/* Header */}
      <div className="ppt-anim-pane-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#D83B01" />
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Ngăn Hoạt hình (Animation Pane)</span>
        </div>
        <button className="ppt-format-close-btn" onClick={onClose} title="Đóng Ngăn hoạt hình">
          <X size={15} />
        </button>
      </div>

      {/* Toolbar actions */}
      <div className="ppt-anim-pane-toolbar">
        <button
          className="ppt-anim-play-btn"
          onClick={onPlayPreview}
          disabled={isPlayingPreview || animationList.length === 0}
        >
          <Play size={14} fill={isPlayingPreview ? '#CBD5E1' : '#107C41'} color={isPlayingPreview ? '#CBD5E1' : '#107C41'} />
          <span>{isPlayingPreview ? 'Đang phát…' : 'Phát tất cả'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <button
            className="ppt-anim-order-btn"
            title="Di chuyển hoạt hình lên trước"
            disabled={animationList.length <= 1}
            onClick={() => {
              const selIdx = animationList.findIndex((item) => item.element.id === selectedElementId);
              if (selIdx > 0) handleMoveOrder(selIdx, 'up');
            }}
          >
            <ArrowUp size={14} />
          </button>
          <button
            className="ppt-anim-order-btn"
            title="Di chuyển hoạt hình xuống sau"
            disabled={animationList.length <= 1}
            onClick={() => {
              const selIdx = animationList.findIndex((item) => item.element.id === selectedElementId);
              if (selIdx >= 0 && selIdx < animationList.length - 1) handleMoveOrder(selIdx, 'down');
            }}
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>

      {/* Animation Items List */}
      <div className="ppt-anim-pane-list">
        {animationList.length === 0 ? (
          <div className="ppt-anim-empty-state">
            <Sparkles size={32} color="#CBD5E1" />
            <p>Trang chiếu này chưa có hoạt ảnh nào.</p>
            <span>Chọn một đối tượng trên trang và bấm một hiệu ứng trong thẻ Hoạt hình để thêm.</span>
          </div>
        ) : (
          animationList.map((item, idx) => {
            const isSelected = item.element.id === selectedElementId;
            const categoryColor =
              item.anim.category === 'exit'
                ? '#DC2626' // Red
                : item.anim.category === 'emphasis'
                ? '#D97706' // Yellow
                : '#16A34A'; // Green (Entrance)

            const triggerIcon =
              item.anim.trigger === 'with-previous' ? (
                <Clock size={12} color="#0078D4" />
              ) : item.anim.trigger === 'after-previous' ? (
                <Timer size={12} color="#7C3AED" />
              ) : (
                <MousePointer size={12} color="#475569" />
              );

            const displayName =
              item.element.text
                ? item.element.text.slice(0, 22) + (item.element.text.length > 22 ? '…' : '')
                : item.element.type === 'shape'
                ? `Hình ${item.element.shapeType || 'khối'}`
                : item.element.type === 'image'
                ? 'Hình ảnh'
                : item.element.type === 'chart'
                ? 'Biểu đồ'
                : item.element.type === 'table'
                ? 'Bảng biểu'
                : 'Phần tử';

            return (
              <div
                key={item.anim.id || idx}
                className={`ppt-anim-item-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectElement(item.element.id)}
              >
                {/* Index badge */}
                <span className="ppt-anim-badge" style={{ background: categoryColor }}>
                  {idx + 1}
                </span>

                {/* Trigger icon */}
                <span className="ppt-anim-trigger-icon" title={`Bắt đầu: ${item.anim.trigger}`}>
                  {triggerIcon}
                </span>

                {/* Item label */}
                <div className="ppt-anim-item-details">
                  <div className="ppt-anim-item-title">{displayName}</div>
                  <div className="ppt-anim-item-type" style={{ color: categoryColor }}>
                    {item.anim.type} ({item.anim.duration}s)
                  </div>
                </div>

                {/* Visual Gantt Bar */}
                <div className="ppt-anim-timeline-bar" style={{ width: `${Math.min(60, item.anim.duration * 30)}px`, background: categoryColor }} />

                {/* Dropdown Options toggle */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="ppt-anim-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveItemMenuId(activeItemMenuId === item.anim.id ? null : item.anim.id);
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>

                  {activeItemMenuId === item.anim.id && (
                    <div className="ppt-anim-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`ppt-anim-drop-item ${item.anim.trigger === 'on-click' ? 'is-active' : ''}`}
                        onClick={() => {
                          handleChangeTrigger(item, 'on-click');
                          setActiveItemMenuId(null);
                        }}
                      >
                        <MousePointer size={13} /> Bắt đầu khi nhấp chuột
                      </button>
                      <button
                        className={`ppt-anim-drop-item ${item.anim.trigger === 'with-previous' ? 'is-active' : ''}`}
                        onClick={() => {
                          handleChangeTrigger(item, 'with-previous');
                          setActiveItemMenuId(null);
                        }}
                      >
                        <Clock size={13} /> Bắt đầu cùng lúc trước
                      </button>
                      <button
                        className={`ppt-anim-drop-item ${item.anim.trigger === 'after-previous' ? 'is-active' : ''}`}
                        onClick={() => {
                          handleChangeTrigger(item, 'after-previous');
                          setActiveItemMenuId(null);
                        }}
                      >
                        <Timer size={13} /> Bắt đầu sau trước đó
                      </button>
                      <div className="ppt-ctx-divider" />
                      <button
                        className="ppt-anim-drop-item is-danger"
                        onClick={() => {
                          handleDeleteAnimation(item);
                          setActiveItemMenuId(null);
                        }}
                      >
                        <Trash2 size={13} /> Xóa hoạt hình này
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
