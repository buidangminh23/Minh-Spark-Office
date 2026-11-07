import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  Layout,
  Presentation,
} from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';
import { SlideCanvas } from './SlideCanvas';

interface SlideShowProps {
  slides: SlideData[];
  initialIndex?: number;
  aspectRatio: '16:9' | '4:3';
  isPresenterMode?: boolean;
  onClose: () => void;
}

export function SlideShow({
  slides,
  initialIndex = 0,
  aspectRatio,
  isPresenterMode: defaultPresenter = false,
  onClose,
}: SlideShowProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPresenterMode, setIsPresenterMode] = useState(defaultPresenter);
  const [isLaserActive, setIsLaserActive] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: -100, y: -100 });

  // Timer state for presenter mode
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentSlide = slides[currentIndex];
  const nextSlide = currentIndex < slides.length - 1 ? slides[currentIndex + 1] : null;

  // Key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        if (currentIndex < slides.length - 1) setCurrentIndex((i) => i + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key.toLowerCase() === 'l') {
        setIsLaserActive((val) => !val);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, slides.length, onClose]);

  // Mouse move for laser pointer
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isLaserActive) {
      setLaserPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Timer interval for presenter mode
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsElapsed((sec) => sec + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const transitionClass = currentSlide.transition.type !== 'none'
    ? `ppt-transition-${currentSlide.transition.type}`
    : '';

  // Render Presenter View
  if (isPresenterMode) {
    return (
      <div className="ppt-presenter-modal">
        <header className="ppt-presenter-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Presentation size={20} /> Chế Độ Diễn Giả (Presenter View)
            </span>
            <span style={{ color: '#64748B' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
              <Clock size={16} />
              <span>Thời gian: <strong>{formatTimer(secondsElapsed)}</strong></span>
              <button
                onClick={() => setIsTimerRunning((r) => !r)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title={isTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}
              >
                {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={() => setSecondsElapsed(0)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title="Bắt đầu lại bộ đếm"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsPresenterMode(false)}
              className="ppt-ss-btn"
              title="Chuyển sang chiếu toàn màn hình chuẩn"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={onClose}
              className="ppt-ss-btn"
              title="Thoát trình chiếu (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="ppt-presenter-body">
          {/* Main Current Slide */}
          <div className="ppt-presenter-main-slide">
            <SlideCanvas
              slide={currentSlide}
              aspectRatio={aspectRatio}
              zoom={100}
              selectedElementId={null}
              onSelectElement={() => {}}
              onUpdateElement={() => {}}
              readOnly
            />
          </div>

          {/* Right Sidebar: Next slide & Notes */}
          <div className="ppt-presenter-sidebar">
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase' }}>
              Trang chiếu tiếp theo
            </div>
            <div className="ppt-presenter-next-slide">
              {nextSlide ? (
                <SlideCanvas
                  slide={nextSlide}
                  aspectRatio={aspectRatio}
                  zoom={50}
                  selectedElementId={null}
                  onSelectElement={() => {}}
                  onUpdateElement={() => {}}
                  readOnly
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
                  Hết trang chiếu
                </div>
              )}
            </div>

            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginTop: '10px' }}>
              Ghi chú của Diễn giả
            </div>
            <div className="ppt-presenter-notes-box">
              {currentSlide.notes ? (
                currentSlide.notes
              ) : (
                <span style={{ color: '#64748B', fontStyle: 'italic' }}>Không có ghi chú nào cho trang chiếu này.</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div style={{ height: '54px', background: '#111827', borderTop: '1px solid #1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <button
            onClick={() => currentIndex > 0 && setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
            className="ppt-ss-btn"
          >
            <ChevronLeft size={24} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            Trang chiếu {currentIndex + 1} / {slides.length}
          </span>
          <button
            onClick={() => currentIndex < slides.length - 1 && setCurrentIndex((i) => i + 1)}
            disabled={currentIndex === slides.length - 1}
            className="ppt-ss-btn"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    );
  }

  // Standard Fullscreen Presentation Mode
  return (
    <div
      ref={containerRef}
      className="ppt-slideshow-overlay"
      onPointerMove={handlePointerMove}
      onClick={() => {
        if (currentIndex < slides.length - 1) setCurrentIndex((i) => i + 1);
      }}
    >
      {/* Laser pointer glow */}
      {isLaserActive && (
        <div
          className="ppt-laser-dot"
          style={{ left: `${laserPos.x}px`, top: `${laserPos.y}px` }}
        />
      )}

      <div className={`ppt-slideshow-canvas ${transitionClass}`}>
        <SlideCanvas
          slide={currentSlide}
          aspectRatio={aspectRatio}
          zoom={100}
          selectedElementId={null}
          onSelectElement={() => {}}
          onUpdateElement={() => {}}
          readOnly
        />
      </div>

      {/* Floating on-screen toolbar */}
      <div className="ppt-slideshow-bar" onClick={(e) => e.stopPropagation()}>
        <button
          className="ppt-ss-btn"
          disabled={currentIndex === 0}
          onClick={() => currentIndex > 0 && setCurrentIndex((i) => i - 1)}
          title="Trang chiếu trước (Mũi tên trái)"
        >
          <ChevronLeft size={20} />
        </button>

        <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '60px', textAlign: 'center' }}>
          {currentIndex + 1} / {slides.length}
        </span>

        <button
          className="ppt-ss-btn"
          disabled={currentIndex === slides.length - 1}
          onClick={() => currentIndex < slides.length - 1 && setCurrentIndex((i) => i + 1)}
          title="Trang chiếu kế tiếp (Mũi tên phải)"
        >
          <ChevronRight size={20} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        <button
          className={`ppt-ss-btn ${isLaserActive ? 'is-active' : ''}`}
          onClick={() => setIsLaserActive((v) => !v)}
          title="Bút Laser Pointer (L)"
        >
          <Sparkles size={18} />
        </button>

        <button
          className="ppt-ss-btn"
          onClick={() => setIsPresenterMode(true)}
          title="Chế độ Diễn giả (Presenter View)"
        >
          <Layout size={18} />
        </button>

        <button
          className="ppt-ss-btn"
          onClick={onClose}
          title="Thoát trình chiếu (Esc)"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
