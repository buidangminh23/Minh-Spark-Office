import { memo, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Plus,
  EyeOff,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { SlideAspect, SlideData, SlideLayout } from '../../lib/slideTypes';
import { SLIDE_BASE_HEIGHT, slideBaseWidth } from '../../lib/settings/slideOptions';
import { SlideCanvas } from './SlideCanvas';
import { useSlideDraftText, withDraftText } from './slideDraftText';
import { finalSlideIndex } from './slideReorder';
import { useThumbReorder } from './useThumbReorder';

interface SlideThumbnailsProps {
  slides: SlideData[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: (layout: SlideLayout) => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  peerMarks?: Record<string, Array<{ key: string; name: string; color: string }>>;
  aspectRatio: SlideAspect;
  watermark?: CanvasProps['watermark'];
  slideMaster?: CanvasProps['slideMaster'];
}

type CanvasProps = ComponentProps<typeof SlideCanvas>;

const noop = () => undefined;

const ThumbPreview = memo(function ThumbPreview({
  slide,
  index,
  aspectRatio,
  watermark,
  slideMaster,
}: {
  slide: SlideData;
  index: number;
  aspectRatio: SlideAspect;
  watermark?: CanvasProps['watermark'];
  slideMaster?: CanvasProps['slideMaster'];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const baseWidth = slideBaseWidth(aspectRatio);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setHostWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="ppt-thumb-preview" aria-hidden="true">
      {hostWidth > 0 && (
        <div className="ppt-thumb-scale" style={{ width: baseWidth, height: SLIDE_BASE_HEIGHT, transform: `scale(${hostWidth / baseWidth})` }}>
          <SlideCanvas
            slide={slide}
            aspectRatio={aspectRatio}
            zoom={100}
            selectedElementId={null}
            onSelectElement={noop}
            onUpdateElement={noop}
            readOnly
            thumbnail
            showAnimBadges={false}
            watermark={watermark}
            slideMaster={slideMaster}
            slideIndex={index}
          />
        </div>
      )}
    </div>
  );
});

const LAYOUT_OPTIONS: Array<{ layout: SlideLayout; label: string; desc: string }> = [
  { layout: 'title', label: 'Trang chiếu Tiêu đề', desc: 'Bìa bài thuyết trình với tiêu đề lớn và phụ đề' },
  { layout: 'title-content', label: 'Tiêu đề và Nội dung', desc: 'Tiêu đề trang và danh sách các dấu đầu dòng' },
  { layout: 'section', label: 'Đầu đề Phần', desc: 'Trang ngăn cách giữa các phần nội dung' },
  { layout: 'two-content', label: 'Hai Nội dung', desc: 'So sánh hoặc trình bày hai cột văn bản' },
  { layout: 'comparison', label: 'So sánh Phương án', desc: 'Hai cột có tiêu đề phụ rõ ràng' },
  { layout: 'title-only', label: 'Chỉ Tiêu đề', desc: 'Dành cho chèn biểu đồ hoặc bảng biểu lớn' },
  { layout: 'content-caption', label: 'Nội dung & Chú thích', desc: 'Khung nội dung chính kèm phần giải thích' },
  { layout: 'picture-caption', label: 'Hình ảnh & Chú thích', desc: 'Khung ảnh lớn với phần chú dẫn nguồn' },
  { layout: 'blank', label: 'Trang chiếu Trống', desc: 'Khung vẽ tự do không có bố cục mẫu sẵn' },
];

export function SlideThumbnails({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  peerMarks = {},
  aspectRatio,
  watermark,
  slideMaster,
}: SlideThumbnailsProps) {
  const draft = useSlideDraftText();
  const liveSlides = useMemo(() => slides.map((slide) => withDraftText(slide, draft)), [slides, draft]);
  const cardAspect = `${slideBaseWidth(aspectRatio)} / ${SLIDE_BASE_HEIGHT}`;
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { drag, onPointerDown, consumeClick } = useThumbReorder(listRef, onMoveSlide);
  const dropAt = drag && finalSlideIndex(drag.from, drag.insertBefore) !== drag.from ? drag.insertBefore : -1;

  return (
    <aside className="ppt-thumbnails-pane">
      <div className="ppt-thumb-header">
        <span>Trang chiếu ({slides.length})</span>
        <div style={{ position: 'relative' }}>
          <button
            className="ppt-add-slide-btn"
            onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
            title="Thêm trang chiếu mới"
          >
            <Plus size={14} /> Mới
          </button>

          {layoutMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                background: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid #E2E8F0',
                width: '260px',
                zIndex: 100,
                padding: '6px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', padding: '6px 8px', textTransform: 'uppercase' }}>
                Chọn Bố Cục Trang Chiếu
              </div>
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.layout}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    onAddSlide(opt.layout);
                    setLayoutMenuOpen(false);
                  }}
                >
                  <strong style={{ fontSize: '13px', color: '#1E293B' }}>{opt.label}</strong>
                  <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={listRef} className={`ppt-thumbnails-list ${drag ? 'is-reordering' : ''}`}>
        {slides.map((slide, idx) => {
          const isSelected = idx === activeSlideIndex;
          const isDragged = drag?.from === idx;
          const dropClass = dropAt === idx ? 'drop-before' : dropAt === slides.length && idx === slides.length - 1 ? 'drop-after' : '';

          return (
            <div
              key={slide.id}
              className={`ppt-thumb-item ${isSelected ? 'is-selected' : ''} ${isDragged ? 'is-dragging' : ''} ${dropClass}`}
              style={isDragged ? { ['--thumb-drag' as string]: `${drag.offset}px` } : undefined}
              title={drag ? undefined : 'Bấm giữ rồi kéo để đổi thứ tự'}
              onPointerDown={(event) => onPointerDown(event, idx)}
              onContextMenu={(event) => { if (drag) event.preventDefault(); }}
              onClick={() => { if (!consumeClick()) onSelectSlide(idx); }}
            >
              <div className="ppt-thumb-index" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {slide.hidden && <span title="Trang chiếu này bị ẩn khi trình chiếu" style={{ display: 'inline-flex' }}><EyeOff size={12} color="#DC2626" /></span>}
                <span style={{ textDecoration: slide.hidden ? 'line-through' : 'none', color: slide.hidden ? '#94A3B8' : undefined }}>{idx + 1}</span>
                {(peerMarks[slide.id] ?? []).map((peer) => (
                  <span key={peer.key} className="ppt-thumb-peer" style={{ background: peer.color }} title={`${peer.name} đang ở trang này`} aria-label={`${peer.name} đang ở trang này`} />
                ))}
              </div>

              <div className="ppt-thumb-card" style={{ aspectRatio: cardAspect, background: slide.background.value || '#FFFFFF', opacity: slide.hidden ? 0.6 : 1 }}>
                <ThumbPreview slide={liveSlides[idx]} index={idx} aspectRatio={aspectRatio} watermark={watermark} slideMaster={slideMaster} />

                {/* Hover action buttons */}
                <div className="ppt-thumb-actions" onClick={(e) => e.stopPropagation()}>
                  {idx > 0 && (
                    <button
                      className="ppt-thumb-mini-btn"
                      onClick={() => onMoveSlide(idx, idx - 1)}
                      title="Di chuyển lên trên"
                    >
                      <ChevronUp size={14} />
                    </button>
                  )}
                  {idx < slides.length - 1 && (
                    <button
                      className="ppt-thumb-mini-btn"
                      onClick={() => onMoveSlide(idx, idx + 1)}
                      title="Di chuyển xuống dưới"
                    >
                      <ChevronDown size={14} />
                    </button>
                  )}
                  <button
                    className="ppt-thumb-mini-btn"
                    onClick={() => onDuplicateSlide(idx)}
                    title="Nhân bản trang chiếu"
                  >
                    <Copy size={14} />
                  </button>
                  {slides.length > 1 && (
                    <button
                      className="ppt-thumb-mini-btn"
                      onClick={() => onDeleteSlide(idx)}
                      title="Xoá trang chiếu"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
