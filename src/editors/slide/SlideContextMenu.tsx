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
  const menuY = Math.min(position.y, window.innerHeight - 340);

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
            <Scissors size={15} /> <span>Cắt</span> <kbd>Ctrl+X</kbd>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <Copy size={15} /> <span>Sao chép</span> <kbd>Ctrl+C</kbd>
          </button>
          {canPaste && (
            <button
              className="ppt-ctx-item"
              onClick={() => {
                onPaste();
                onClose();
              }}
            >
              <Clipboard size={15} /> <span>Dán</span> <kbd>Ctrl+V</kbd>
            </button>
          )}
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            <CopyPlus size={15} /> <span>Nhân bản đối tượng</span> <kbd>Ctrl+D</kbd>
          </button>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onEditText();
              onClose();
            }}
          >
            <Edit3 size={15} /> <span>Chỉnh sửa văn bản</span>
          </button>

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
            <ArrowUpToLine size={15} /> <span>Lên trên cùng</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onBringForward();
              onClose();
            }}
          >
            <ChevronUp size={15} /> <span>Lên một lớp</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onSendBackward();
              onClose();
            }}
          >
            <ChevronDown size={15} /> <span>Xuống một lớp</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onSendToBack();
              onClose();
            }}
          >
            <ArrowDownToLine size={15} /> <span>Xuống dưới cùng</span>
          </button>

          <div className="ppt-ctx-divider" />

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onOpenAnimation?.();
              onClose();
            }}
          >
            <Sparkles size={15} color="#107C41" /> <span>Gán hoạt hình (Animation)...</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onOpenFormat();
              onClose();
            }}
          >
            <Palette size={15} color="#D83B01" /> <span>Định dạng đối tượng…</span>
          </button>

          <button
            className="ppt-ctx-item is-danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={15} /> <span>Xoá</span> <kbd>Del</kbd>
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
              <Clipboard size={15} /> <span>Dán đối tượng</span> <kbd>Ctrl+V</kbd>
            </button>
          )}

          <button
            className="ppt-ctx-item"
            onClick={() => {
              onAddSlide('title-content');
              onClose();
            }}
          >
            <Plus size={15} color="#D83B01" /> <span>Thêm trang chiếu mới</span>
          </button>
          <button
            className="ppt-ctx-item"
            onClick={() => {
              onDuplicateSlide();
              onClose();
            }}
          >
            <CopyPlus size={15} /> <span>Nhân bản trang chiếu này</span>
          </button>

          <div className="ppt-ctx-divider" />

          <div className="ppt-ctx-group-label">Đổi bố cục trang:</div>
          <div className="ppt-ctx-layout-list">
            <button onClick={() => { onAddSlide('title'); onClose(); }}>
              <Layout size={13} /> Trang tiêu đề
            </button>
            <button onClick={() => { onAddSlide('title-content'); onClose(); }}>
              <Layout size={13} /> Tiêu đề & Nội dung
            </button>
            <button onClick={() => { onAddSlide('two-content'); onClose(); }}>
              <Layout size={13} /> Hai nội dung
            </button>
            <button onClick={() => { onAddSlide('blank'); onClose(); }}>
              <Layout size={13} /> Trang trống
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
            <Palette size={15} color="#D83B01" /> <span>Định dạng nền trang chiếu…</span>
          </button>
        </>
      )}
    </div>
  );
}
