import { useEffect, useRef } from 'react';
import {
  Scissors,
  Copy,
  Clipboard,
  CopyPlus,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit3,
  Palette,
  Square,
  Circle,
  Triangle,
  Star,
  ArrowRight,
  Plus,
  Layout,
  Sparkles,
  Group,
  Ungroup,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import type { ShapeType, SlideLayout } from '../../lib/slideTypes';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface SlideContextMenuProps {
  position: ContextMenuPosition | null;
  targetElementId: string | null;
  canPaste: boolean;
  selectionCount?: number;
  canGroup?: boolean;
  canUngroup?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onAlign?: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (mode: 'horizontal' | 'vertical') => void;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditText: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onChangeShape: (shape: ShapeType) => void;
  onOpenFormat: () => void;
  onOpenAnimation?: () => void;
  onAddSlide: (layout: SlideLayout) => void;
  onDuplicateSlide: () => void;
}

export function SlideContextMenu({
  position,
  targetElementId,
  canPaste,
  selectionCount = 0,
  canGroup = false,
  canUngroup = false,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onEditText,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onChangeShape,
  onOpenFormat,
  onOpenAnimation,
  onAddSlide,
  onDuplicateSlide,
}: SlideContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!position) return null;

  // Keep menu on screen
  const menuX = Math.min(position.x, window.innerWidth - 240);
  const menuY = Math.max(8, Math.min(position.y, window.innerHeight - 520));

  return (
    <div
      ref={menuRef}
      className="ppt-context-menu"
      style={{ left: `${menuX}px`, top: `${menuY}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {targetElementId ? (
        /* Element Context Menu */
        <>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onCut();
              onClose();
            }}
          >
            <Scissors size={16} /> <span>Cắt</span> <kbd>Ctrl+X</kbd>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <Copy size={16} /> <span>Sao chép</span> <kbd>Ctrl+C</kbd>
          </button>
          {canPaste && (
            <button
              className="ppt-ctx-item"
              onClick={() => {
                onPaste();
                onClose();
              }}
            >
              <Clipboard size={16} /> <span>Dán</span> <kbd>Ctrl+V</kbd>
            </button>
          )}
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            <CopyPlus size={16} /> <span>Nhân bản đối tượng</span> <kbd>Ctrl+D</kbd>
          </button>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onEditText();
              onClose();
            }}
          >
            <Edit3 size={16} /> <span>Chỉnh sửa văn bản</span>
          </button>

          {(canGroup || canUngroup) && (
            <>
              {canGroup && (
                <button className="ppt-ctx-item" onClick={() => { onGroup?.(); onClose(); }}>
                  <Group size={16} /> <span>Nhóm{selectionCount > 1 ? ` ${selectionCount} đối tượng` : ''}</span>
                </button>
              )}
              {canUngroup && (
                <button className="ppt-ctx-item" onClick={() => { onUngroup?.(); onClose(); }}>
                  <Ungroup size={16} /> <span>Bỏ nhóm</span>
                </button>
              )}
            </>
          )}

          <div className="ppt-ctx-group-label">{selectionCount > 1 ? 'Căn các đối tượng đang chọn:' : 'Căn theo trang chiếu:'}</div>
          <div className="ppt-ctx-shape-grid" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
            <button onClick={() => { onAlign?.('left'); onClose(); }} title="Căn trái"><AlignStartVertical size={14} /></button>
            <button onClick={() => { onAlign?.('center'); onClose(); }} title="Căn giữa theo chiều ngang"><AlignCenterVertical size={14} /></button>
            <button onClick={() => { onAlign?.('right'); onClose(); }} title="Căn phải"><AlignEndVertical size={14} /></button>
            <button onClick={() => { onAlign?.('top'); onClose(); }} title="Căn trên"><AlignStartHorizontal size={14} /></button>
            <button onClick={() => { onAlign?.('middle'); onClose(); }} title="Căn giữa theo chiều dọc"><AlignCenterHorizontal size={14} /></button>
            <button onClick={() => { onAlign?.('bottom'); onClose(); }} title="Căn dưới"><AlignEndHorizontal size={14} /></button>
            <button onClick={() => { onDistribute?.('horizontal'); onClose(); }} title="Giãn đều theo chiều ngang"><AlignHorizontalDistributeCenter size={14} /></button>
            <button onClick={() => { onDistribute?.('vertical'); onClose(); }} title="Giãn đều theo chiều dọc"><AlignVerticalDistributeCenter size={14} /></button>
          </div>

          {/* Change shape submenu */}
          <div className="ppt-ctx-group-label">Đổi hình dạng:</div>
          <div className="ppt-ctx-shape-grid">
            <button onClick={() => { onChangeShape('rectangle'); onClose(); }} title="Hình chữ nhật">
              <Square size={14} />
            </button>
            <button onClick={() => { onChangeShape('rounded-rectangle'); onClose(); }} title="Bo góc">
              <Square size={14} style={{ borderRadius: '3px' }} />
            </button>
            <button onClick={() => { onChangeShape('circle'); onClose(); }} title="Hình tròn">
              <Circle size={14} />
            </button>
            <button onClick={() => { onChangeShape('triangle'); onClose(); }} title="Tam giác">
              <Triangle size={14} />
            </button>
            <button onClick={() => { onChangeShape('star'); onClose(); }} title="Ngôi sao">
              <Star size={14} />
            </button>
            <button onClick={() => { onChangeShape('right-arrow'); onClose(); }} title="Mũi tên">
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onBringToFront();
              onClose();
            }}
          >
            <ArrowUpToLine size={16} /> <span>Lên trên cùng</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onBringForward();
              onClose();
            }}
          >
            <ChevronUp size={16} /> <span>Lên một lớp</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onSendBackward();
              onClose();
            }}
          >
            <ChevronDown size={16} /> <span>Xuống một lớp</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onSendToBack();
              onClose();
            }}
          >
            <ArrowDownToLine size={16} /> <span>Xuống dưới cùng</span>
          </button>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onOpenAnimation?.();
              onClose();
            }}
          >
            <Sparkles size={16} color="#107C41" /> <span>Gán hoạt hình (Animation)...</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onOpenFormat();
              onClose();
            }}
          >
            <Palette size={16} color="#D83B01" /> <span>Định dạng đối tượng…</span>
          </button>

          <button
            className="ppt-ctx-item is-danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={16} /> <span>Xoá</span> <kbd>Del</kbd>
          </button>
        </>
      ) : (
        /* Canvas Background Context Menu */
        <>
          {canPaste && (
            <button
              className="ppt-ctx-item"
              onClick={() => {
                onPaste();
                onClose();
              }}
            >
              <Clipboard size={16} /> <span>Dán đối tượng</span> <kbd>Ctrl+V</kbd>
            </button>
          )}

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onAddSlide('title-content');
              onClose();
            }}
          >
            <Plus size={16} color="#D83B01" /> <span>Thêm trang chiếu mới</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onDuplicateSlide();
              onClose();
            }}
          >
            <CopyPlus size={16} /> <span>Nhân bản trang chiếu này</span>
          </button>

          <div className="ppt-ctx-divider" />

          <div className="ppt-ctx-group-label">Đổi bố cục trang:</div>
          <div className="ppt-ctx-layout-list">
            <button onClick={() => { onAddSlide('title'); onClose(); }}>
              <Layout size={14} /> Trang tiêu đề
            </button>
            <button onClick={() => { onAddSlide('title-content'); onClose(); }}>
              <Layout size={14} /> Tiêu đề & Nội dung
            </button>
            <button onClick={() => { onAddSlide('two-content'); onClose(); }}>
              <Layout size={14} /> Hai nội dung
            </button>
            <button onClick={() => { onAddSlide('blank'); onClose(); }}>
              <Layout size={14} /> Trang trống
            </button>
          </div>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onOpenFormat();
              onClose();
            }}
          >
            <Palette size={16} color="#D83B01" /> <span>Định dạng nền trang chiếu…</span>
          </button>
        </>
      )}
    </div>
  );
}
