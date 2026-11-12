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
  Settings,
  HelpCircle,
  Volume2,
  Pilcrow,
} from 'lucide-react';
import type { SlideData, SlideElement, ElementAnimation, AnimationTrigger } from '../../lib/slideTypes';
import { SlideAnimationDialog } from './SlideAnimationDialog';
import { animationLabel, collectSlideAnimations, elementAnimations } from '../../lib/slideEffects';

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
  const animationList = collectSlideAnimations(slide.elements);

  const [activeItemMenuId, setActiveItemMenuId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    element: SlideElement | null;
    anim: ElementAnimation | null;
    defaultTab: 'effect' | 'timing';
  }>({
    isOpen: false,
    element: null,
    anim: null,
    defaultTab: 'effect',
  });

  // Move animation up or down
  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === animationList.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...animationList];
    [reordered[index], reordered[targetIdx]] = [reordered[targetIdx], reordered[index]];
    const orderById = new Map(reordered.map((item, position) => [item.anim.id, position + 1]));

    for (const element of slide.elements) {
      const current = elementAnimations(element);
      if (current.length === 0) continue;
      const renumbered = current.map((anim) => ({ ...anim, order: orderById.get(anim.id) ?? anim.order }));
      if (renumbered.every((anim, position) => anim.order === current[position].order) && element.animations) continue;
      onUpdateElement(element.id, { animations: renumbered });
    }
  };

  // Delete animation
  const handleDeleteAnimation = (item: { element: SlideElement; anim: ElementAnimation }) => {
    if (item.element.animations) {
      const newAnims = item.element.animations.filter((a) => a.id !== item.anim.id);
      onUpdateElement(item.element.id, {
        animations: newAnims,
        animation:
          newAnims.length > 0
            ? {
                type: newAnims[0].type,
                duration: newAnims[0].duration,
                delay: newAnims[0].delay,
                direction: newAnims[0].direction,
                trigger: newAnims[0].trigger,
              }
            : { type: 'none', duration: 0.5, delay: 0 },
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

  const handleOpenDialog = (
    item: { element: SlideElement; anim: ElementAnimation },
    tab: 'effect' | 'timing'
  ) => {
    setDialogState({
      isOpen: true,
      element: item.element,
      anim: item.anim,
      defaultTab: tab,
    });
    setActiveItemMenuId(null);
  };

  const handleSaveDialogAnimation = (elementId: string, updatedAnim: ElementAnimation) => {
    const el = slide.elements.find((e) => e.id === elementId);
    if (!el) return;

    if (el.animations && el.animations.length > 0) {
      const newAnims = el.animations.map((a) => (a.id === updatedAnim.id ? updatedAnim : a));
      onUpdateElement(elementId, {
        animations: newAnims,
        animation: {
          type: updatedAnim.type,
          duration: updatedAnim.duration,
          delay: updatedAnim.delay,
          direction: updatedAnim.direction,
          trigger: updatedAnim.trigger,
        },
      });
    } else {
      onUpdateElement(elementId, {
        animation: {
          type: updatedAnim.type,
          duration: updatedAnim.duration,
          delay: updatedAnim.delay,
          direction: updatedAnim.direction,
          trigger: updatedAnim.trigger,
        },
        animations: [updatedAnim],
      });
    }
  };

  const hasSelectedAnimation = animationList.some((item) => item.element.id === selectedElementId);

  return (
    <>
      <aside className="ppt-anim-pane" aria-label="Ngăn Hoạt hình">
        {/* Header */}
        <div className="ppt-anim-pane-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>Ngăn Hoạt hình (Animation Pane)</span>
          </div>
          <button className="ppt-format-close-btn" onClick={onClose} title="Đóng Ngăn hoạt hình">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar actions */}
        <div className="ppt-anim-pane-toolbar">
          <button
            className="ppt-anim-play-btn"
            onClick={onPlayPreview}
            disabled={isPlayingPreview || animationList.length === 0}
            title={hasSelectedAnimation ? 'Phát từ đối tượng đang chọn' : 'Phát tất cả hoạt hình trên trang chiếu'}
          >
            <Play
              size={14}
              fill={isPlayingPreview ? '#CBD5E1' : '#107C41'}
              color={isPlayingPreview ? '#CBD5E1' : '#107C41'}
            />
            <span>
              {isPlayingPreview
                ? 'Đang phát…'
                : hasSelectedAnimation
                ? 'Phát từ đây'
                : 'Phát tất cả'}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <button
              className="ppt-anim-order-btn"
              title="Di chuyển hoạt hình sớm hơn"
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
              title="Di chuyển hoạt hình muộn hơn"
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

        {/* Timeline Header bar */}
        <div className="ppt-anim-timeline-header">
          <span>Thứ tự & Kích hoạt</span>
          <span>Thời gian (Giây)</span>
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
                item.anim.category === 'motion-path'
                  ? '#7C3AED' // Purple (Motion Path)
                  : item.anim.category === 'exit'
                  ? '#DC2626' // Red (Exit)
                  : item.anim.category === 'emphasis'
                  ? '#D97706' // Yellow (Emphasis)
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
                  ? item.element.text.slice(0, 20) + (item.element.text.length > 20 ? '…' : '')
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
                  onDoubleClick={() => handleOpenDialog(item, 'effect')}
                  title="Nhấp đúp để mở hộp thoại Tùy chọn hiệu ứng và Định thời gian"
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
                      {animationLabel(item.anim.type)} ({item.anim.duration}s)
                      {item.anim.sound && item.anim.sound !== 'none' ? <Volume2 size={12} aria-label="Có âm thanh" /> : null}
                      {item.anim.animateText === 'paragraph' ? <Pilcrow size={12} aria-label="Theo từng đoạn" /> : null}
                    </div>
                  </div>

                  {/* Visual Gantt Bar */}
                  <div
                    className="ppt-anim-timeline-bar"
                    style={{
                      width: `${Math.min(70, Math.max(16, item.anim.duration * 30))}px`,
                      marginLeft: `${Math.min(40, item.anim.delay * 15)}px`,
                      background: categoryColor,
                    }}
                    title={`Độ trễ: ${item.anim.delay}s, Thời lượng: ${item.anim.duration}s`}
                  />

                  {/* Dropdown Options toggle */}
                  <div style={{ position: 'relative' }}>
                    <button
                      className="ppt-anim-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveItemMenuId(activeItemMenuId === item.anim.id ? null : item.anim.id);
                      }}
                      title="Tùy chọn hoạt hình"
                    >
                      <ChevronDown size={14} />
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
                          <MousePointer size={14} /> Bắt đầu khi nhấp chuột
                        </button>
                        <button
                          className={`ppt-anim-drop-item ${item.anim.trigger === 'with-previous' ? 'is-active' : ''}`}
                          onClick={() => {
                            handleChangeTrigger(item, 'with-previous');
                            setActiveItemMenuId(null);
                          }}
                        >
                          <Clock size={14} /> Bắt đầu cùng trước đó
                        </button>
                        <button
                          className={`ppt-anim-drop-item ${item.anim.trigger === 'after-previous' ? 'is-active' : ''}`}
                          onClick={() => {
                            handleChangeTrigger(item, 'after-previous');
                            setActiveItemMenuId(null);
                          }}
                        >
                          <Timer size={14} /> Bắt đầu sau trước đó
                        </button>

                        <div className="ppt-ctx-divider" />

                        <button
                          className="ppt-anim-drop-item"
                          onClick={() => handleOpenDialog(item, 'effect')}
                        >
                          <Settings size={14} color="#0078D4" /> Tùy chọn hiệu ứng...
                        </button>
                        <button
                          className="ppt-anim-drop-item"
                          onClick={() => handleOpenDialog(item, 'timing')}
                        >
                          <Clock size={14} color="#7C3AED" /> Định thời gian...
                        </button>

                        <div className="ppt-ctx-divider" />

                        <button
                          className="ppt-anim-drop-item is-danger"
                          onClick={() => {
                            handleDeleteAnimation(item);
                            setActiveItemMenuId(null);
                          }}
                        >
                          <Trash2 size={14} /> Xóa hoạt hình này
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info tip */}
        <div className="ppt-anim-pane-footer-tip">
          <HelpCircle size={12} color="#64748B" />
          <span>Nhấp đúp vào hiệu ứng để mở hộp thoại chi tiết</span>
        </div>
      </aside>

      {/* Detail Dialog Modal */}
      <SlideAnimationDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState({ ...dialogState, isOpen: false })}
        element={dialogState.element}
        animation={dialogState.anim}
        slideElements={slide.elements}
        defaultTab={dialogState.defaultTab}
        onSave={handleSaveDialogAnimation}
      />
    </>
  );
}
