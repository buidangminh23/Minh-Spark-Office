import { useState, useEffect, useRef, useCallback } from 'react';
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
  PenTool,
  Highlighter,
  Eraser,
  Search,
  Mic,
  MicOff,
  Volume2,
  Timer,
  Trash2,
  Moon,
  Sun,
  Radio,
  Video,
  VideoOff,
  Award,
  FileText,
  Heart,
  ThumbsUp,
  Flame,
  Music,
  MessageSquare,
  Smartphone,
  ZoomIn,
  Hand,
  Bell,
  Drum,
  PartyPopper,
} from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';
import { SlideCanvas } from './SlideCanvas';
import {
  playTransitionSound,
  playPresenterSound,
  startPresentationBgm,
  stopPresentationBgm,
  setPresentationBgmDucking,
} from '../../lib/slideAudio';

const COACH_MIN_MINUTES = 0.25;
const FILLER_PATTERN = /(?<!\p{L})(ờm|ờ|ừm|kiểu như|thì là mà|như là)(?!\p{L})/giu;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const countFillers = (text: string) => text.match(FILLER_PATTERN)?.length ?? 0;

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

  // Presentation Interactive Tools
  const [isLaserActive, setIsLaserActive] = useState(false);
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [blankMode, setBlankMode] = useState<'none' | 'black' | 'white'>('none');
  const [pointerPos, setPointerPos] = useState({ x: -100, y: -100 });

  // In-Show Annotations (Drawing)
  const [drawTool, setDrawTool] = useState<'none' | 'pen' | 'highlighter' | 'eraser'>('none');
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Slide Zoom Navigation
  const [zoomOriginIndex, setZoomOriginIndex] = useState<number | null>(null);

  // Background Music & Smart Audio Ducking
  const [isBgmActive, setIsBgmActive] = useState(false);
  const isBgmActiveRef = useRef(isBgmActive);
  useEffect(() => {
    isBgmActiveRef.current = isBgmActive;
  }, [isBgmActive]);
  const duckingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audience Anonymous Q&A Queue
  const [isQaDrawerOpen, setIsQaDrawerOpen] = useState(false);
  const [pinnedQuestion, setPinnedQuestion] = useState<string | null>(null);
  const [qaList, setQaList] = useState<Array<{ id: string; text: string; votes: number }>>([
    { id: 'qa_1', text: 'Sếp cho hỏi lộ trình tích hợp AI offline trong các tháng tới?', votes: 14 },
    { id: 'qa_2', text: 'Hệ sinh thái Minh Spark Office có hỗ trợ đồng bộ đa thiết bị không?', votes: 9 },
    { id: 'qa_3', text: 'Chính sách bảo mật dữ liệu doanh nghiệp hoạt động thế nào?', votes: 6 },
  ]);

  // Phone Clicker QR Modal
  const [isPhoneClickerOpen, setIsPhoneClickerOpen] = useState(false);

  // Live Vietnamese Subtitles
  const [isSubtitlesActive, setIsSubtitlesActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Presenter Countdown Timer
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(300); // 5 minutes default
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);

  // Soundboard popover
  const [showSoundboard, setShowSoundboard] = useState(false);

  // Elapsed presentation time
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Slide Recording Studio & Webcam Circle
  const [isRecording, setIsRecording] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // AI Speaker Coach (Pace & Filler word analyzer)
  const [isCoachActive, setIsCoachActive] = useState(false);
  const [coachWpm, setCoachWpm] = useState(135);
  const [fillerCount, setFillerCount] = useState(0);

  // Voice-Activated Teleprompter
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(1);

  // Live Audience Floating Reactions
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Animation step-by-step state
  const [animStep, setAnimStep] = useState(0);
  const [previewingAnimElementId, setPreviewingAnimElementId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentSlide = slides[currentIndex] || slides[0];
  const nextSlide = currentIndex < slides.length - 1 ? slides[currentIndex + 1] : null;

  // Sync to dual-screen via BroadcastChannel
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('minh-slides-screen');
      channel.postMessage({
        type: 'SLIDE_CHANGE',
        index: currentIndex,
        animStep,
        slideId: currentSlide?.id,
      });
      return () => channel.close();
    } catch {
      // BroadcastChannel unsupported fallback
    }
  }, [currentIndex, animStep, currentSlide?.id]);

  // Entrance animations on current slide
  const entranceElements = currentSlide.elements.filter((el) => {
    if (el.animations && el.animations.length > 0) {
      return el.animations.some((a) => a.category === 'entrance' && a.type !== 'none');
    }
    if (el.animation && el.animation.type !== 'none') {
      const t = el.animation.type;
      return !t.includes('out') && !t.includes('disappear') && !t.includes('pulse') && !t.includes('spin') && !t.includes('teeter');
    }
    return false;
  });

  const hiddenElementIds = entranceElements
    .filter((_, idx) => idx >= animStep)
    .map((el) => el.id);

  // Play transition sound on slide change
  useEffect(() => {
    playTransitionSound(currentSlide.transition?.sound || 'none');
    setAnimStep(0);
    // Clear drawing canvas on slide change
    if (drawCanvasRef.current) {
      const ctx = drawCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
  }, [currentIndex, currentSlide.transition?.sound]);

  // Advance presentation
  const handleAdvance = useCallback(() => {
    if (blankMode !== 'none') {
      setBlankMode('none');
      return;
    }
    if (animStep < entranceElements.length) {
      const nextEl = entranceElements[animStep];
      setAnimStep((s) => s + 1);
      setPreviewingAnimElementId(nextEl.id);
      const animSound = nextEl.animations?.[0]?.sound || (nextEl.animation as any)?.sound;
      if (animSound && animSound !== 'none') {
        playTransitionSound(animSound);
      }
      setTimeout(() => setPreviewingAnimElementId(null), 800);
    } else {
      let nextIdx = currentIndex + 1;
      while (nextIdx < slides.length && slides[nextIdx].hidden) {
        nextIdx++;
      }
      if (nextIdx < slides.length) {
        setCurrentIndex(nextIdx);
        setAnimStep(0);
      }
    }
  }, [blankMode, animStep, entranceElements, currentIndex, slides]);

  // Step back presentation
  const handleStepBack = useCallback(() => {
    if (blankMode !== 'none') {
      setBlankMode('none');
      return;
    }
    if (animStep > 0) {
      setAnimStep((s) => s - 1);
    } else {
      let prevIdx = currentIndex - 1;
      while (prevIdx >= 0 && slides[prevIdx].hidden) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        setCurrentIndex(prevIdx);
        const prevSlide = slides[prevIdx];
        const prevAnimCount = prevSlide.elements.filter((el) => {
          if (el.animations && el.animations.length > 0) {
            return el.animations.some((a) => a.category === 'entrance' && a.type !== 'none');
          }
          if (el.animation && el.animation.type !== 'none') {
            const t = el.animation.type;
            return !t.includes('out') && !t.includes('disappear') && !t.includes('pulse') && !t.includes('spin') && !t.includes('teeter');
          }
          return false;
        }).length;
        setAnimStep(prevAnimCount);
      }
    }
  }, [blankMode, animStep, currentIndex, slides]);

  // Auto-advance slide if advanceAfterSeconds is configured
  useEffect(() => {
    const afterSec = currentSlide.transition?.advanceAfterSeconds;
    if (afterSec && afterSec > 0 && animStep >= entranceElements.length) {
      const timer = setTimeout(() => {
        handleAdvance();
      }, afterSec * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentSlide, animStep, entranceElements.length, handleAdvance]);

  // Key navigation & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkeys for presenter tools
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLaserActive((v) => !v);
        setIsSpotlightActive(false);
        setIsMagnifierActive(false);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSpotlightActive((v) => !v);
        setIsLaserActive(false);
        setIsMagnifierActive(false);
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsMagnifierActive((v) => !v);
        setIsLaserActive(false);
        setIsSpotlightActive(false);
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setBlankMode((m) => (m === 'black' ? 'none' : 'black'));
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setBlankMode((m) => (m === 'white' ? 'none' : 'white'));
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setDrawTool((t) => (t === 'pen' ? 'none' : 'pen'));
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setDrawTool((t) => (t === 'highlighter' ? 'none' : 'highlighter'));
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setDrawTool((t) => (t === 'eraser' ? 'none' : 'eraser'));
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (drawCanvasRef.current) {
          const ctx = drawCanvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
        }
      } else if (e.key === '1') {
        playPresenterSound('applause');
      } else if (e.key === '2') {
        playPresenterSound('ding');
      } else if (e.key === '3') {
        playPresenterSound('drum');
      } else if (e.key === '4') {
        playPresenterSound('fanfare');
      } else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault();
        handleAdvance();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        handleStepBack();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAdvance, handleStepBack, onClose]);

  // Web Speech API for Vietnamese Subtitles
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!isSubtitlesActive || !SpeechRecognition) {
      setLiveTranscript('');
      return;
    }

    let stopped = false;
    let recognition: any = null;
    const startedAt = Date.now();
    let finalWords = 0;
    let finalFillers = 0;

    try {
      recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interimText = '';
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk: string = event.results[i][0].transcript;
          currentText += chunk;
          if (event.results[i].isFinal) {
            finalWords += countWords(chunk);
            finalFillers += countFillers(chunk);
          } else {
            interimText += chunk;
          }
        }
        setLiveTranscript(currentText);

        if (isBgmActiveRef.current) {
          setPresentationBgmDucking(true);
          if (duckingTimeoutRef.current) clearTimeout(duckingTimeoutRef.current);
          duckingTimeoutRef.current = setTimeout(() => {
            setPresentationBgmDucking(false);
          }, 1400);
        }

        const spokenWords = finalWords + countWords(interimText);
        const minutes = (Date.now() - startedAt) / 60000;
        if (spokenWords > 2 && minutes >= COACH_MIN_MINUTES) {
          setCoachWpm(Math.round(spokenWords / minutes));
        }
        setFillerCount(finalFillers + countFillers(interimText));
      };

      recognition.onend = () => {
        if (stopped) return;
        try { recognition.start(); } catch {}
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognition = null;
    }

    return () => {
      stopped = true;
      if (recognition) {
        recognition.onend = null;
        recognition.onresult = null;
        try { recognition.stop(); } catch {}
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
  }, [isSubtitlesActive]);

  // Countdown timer interval
  useEffect(() => {
    if (!isCountdownRunning || timerSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((s) => {
        if (s <= 1) {
          setIsCountdownRunning(false);
          playPresenterSound('timer');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCountdownRunning, timerSecondsLeft]);

  // Live Audience Reactions trigger
  const handleSendReaction = (emoji: string) => {
    const id = `rx-${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id, emoji, x: 75 + Math.random() * 20 }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  };

  // Recording Studio & Webcam toggle
  const toggleRecordingStudio = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setIsWebcamActive(false);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsWebcamActive(true);
        setIsRecording(true);

        const recorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Minh-Presentation-Studio-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch {
        // Fallback simulation if no hardware device is connected
        setIsWebcamActive(true);
        setIsRecording(true);
      }
    }
  };

  // Resize canvas for drawing
  useEffect(() => {
    const handleResize = () => {
      if (drawCanvasRef.current) {
        drawCanvasRef.current.width = window.innerWidth;
        drawCanvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drawing event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (drawTool === 'none') return;
    isDrawingRef.current = true;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);

    if (drawTool === 'pen') {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'highlighter') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 20;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'eraser') {
      ctx.lineWidth = 30;
      ctx.globalCompositeOperation = 'destination-out';
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setPointerPos({ x: e.clientX, y: e.clientY });

    if (!isDrawingRef.current || drawTool === 'none') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX, e.clientY);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
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

  const transitionClass = currentSlide.transition?.type !== 'none'
    ? `ppt-transition-${currentSlide.transition?.type}`
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
              <Maximize2 size={16} />
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
              hiddenElementIds={hiddenElementIds}
              previewingAnimElementId={previewingAnimElementId}
              showAnimBadges={false}
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
                  showAnimBadges={false}
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
            onClick={handleStepBack}
            disabled={currentIndex === 0 && animStep === 0}
            className="ppt-ss-btn"
            title="Lùi lại (Mũi tên trái)"
          >
            <ChevronLeft size={24} />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            Trang chiếu {currentIndex + 1} / {slides.length}
            {entranceElements.length > 0 && (
              <span style={{ color: '#38BDF8', marginLeft: '8px' }}>
                (Hoạt hình: {animStep}/{entranceElements.length})
              </span>
            )}
          </span>
          <button
            onClick={handleAdvance}
            disabled={currentIndex === slides.length - 1 && animStep === entranceElements.length}
            className="ppt-ss-btn"
            title="Tiến tới (Mũi tên phải / Phím cách)"
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={drawTool === 'none' ? handleAdvance : undefined}
      style={{
        cursor: drawTool !== 'none'
          ? 'crosshair'
          : isLaserActive
          ? 'none'
          : 'default',
      }}
    >
      {/* 1. Blank Screen Overlays */}
      {blankMode === 'black' && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000000', zIndex: 1000, cursor: 'pointer' }}
          onClick={() => setBlankMode('none')}
        />
      )}
      {blankMode === 'white' && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#FFFFFF', zIndex: 1000, cursor: 'pointer' }}
          onClick={() => setBlankMode('none')}
        />
      )}

      {/* Slide Zoom Out Pill */}
      {zoomOriginIndex !== null && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,0.92)',
            color: '#38BDF8',
            padding: '8px 20px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 700,
            zIndex: 9999,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #38BDF8',
          }}
          onClick={() => {
            setCurrentIndex(zoomOriginIndex);
            setZoomOriginIndex(null);
            playTransitionSound('whoosh');
          }}
        >
          <ZoomIn size={16} /> Đang phóng to chi tiết • Bấm để quay lại trang Tổng quan (Zoom Out)
        </div>
      )}

      {/* Pinned Audience Question Banner */}
      {pinnedQuestion && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,0.95)',
            border: '2px solid #F59E0B',
            borderRadius: '12px',
            padding: '12px 24px',
            color: '#FFFFFF',
            zIndex: 9000,
            maxWidth: '680px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ background: '#F59E0B', color: '#0F172A', fontWeight: 800, fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
            HỎI ĐÁP KHÁN GIẢ
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, flex: 1 }}>{pinnedQuestion}</div>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
            onClick={() => setPinnedQuestion(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Main Slide Canvas */}
      <div className={`ppt-slideshow-canvas ${transitionClass}`}>
        <SlideCanvas
          slide={currentSlide}
          aspectRatio={aspectRatio}
          zoom={100}
          selectedElementId={null}
          onSelectElement={(elId) => {
            if (!elId || drawTool !== 'none') return;
            const clicked = currentSlide.elements.find((e) => e.id === elId);
            if (clicked?.type === 'zoom' && clicked.zoomSlideId) {
              const targetIdx = slides.findIndex((s) => s.id === clicked.zoomSlideId);
              if (targetIdx !== -1) {
                setZoomOriginIndex(currentIndex);
                setCurrentIndex(targetIdx);
                playTransitionSound('whoosh');
              }
            }
          }}
          onUpdateElement={() => {}}
          hiddenElementIds={hiddenElementIds}
          previewingAnimElementId={previewingAnimElementId}
          showAnimBadges={false}
          readOnly
        />
      </div>

      {/* 3. In-Show Annotation Canvas Layer */}
      <canvas
        ref={drawCanvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: drawTool !== 'none' ? 'auto' : 'none',
          zIndex: 800,
        }}
      />

      {/* 4. Spotlight Focus Overlay */}
      {isSpotlightActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            maskImage: `radial-gradient(circle 140px at ${pointerPos.x}px ${pointerPos.y}px, transparent 100%, black 100%)`,
            WebkitMaskImage: `radial-gradient(circle 140px at ${pointerPos.x}px ${pointerPos.y}px, transparent 0%, transparent 120px, black 140px)`,
            pointerEvents: 'none',
            zIndex: 850,
          }}
        />
      )}

      {/* 5. Laser Pointer Glow */}
      {isLaserActive && (
        <div
          className="ppt-laser-dot"
          style={{
            left: `${pointerPos.x}px`,
            top: `${pointerPos.y}px`,
            pointerEvents: 'none',
            zIndex: 900,
          }}
        />
      )}

      {/* 6. Magnifier Loupe (2.5x Zoom) */}
      {isMagnifierActive && (
        <div
          style={{
            position: 'fixed',
            left: `${pointerPos.x - 90}px`,
            top: `${pointerPos.y - 90}px`,
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '3px solid #0078D4',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(0,120,212,0.2)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 950,
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '100vw',
              height: '100vh',
              transformOrigin: '0 0',
              transform: `scale(2.2) translate(${-pointerPos.x + 40}px, ${-pointerPos.y + 40}px)`,
            }}
          >
            <SlideCanvas
              slide={currentSlide}
              aspectRatio={aspectRatio}
              zoom={100}
              selectedElementId={null}
              onSelectElement={() => {}}
              onUpdateElement={() => {}}
              hiddenElementIds={hiddenElementIds}
              showAnimBadges={false}
              readOnly
            />
          </div>
        </div>
      )}

      {/* 7. Live Vietnamese Subtitles Bar */}
      {isSubtitlesActive && (
        <div
          style={{
            position: 'fixed',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '850px',
            width: '90%',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '12px 24px',
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: 600,
            textAlign: 'center',
            zIndex: 880,
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span style={{ display: 'inline-flex', width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', animation: 'pptPulse 1s infinite' }} />
          <span>{liveTranscript || 'Đang lắng nghe giọng nói tiếng Việt...'}</span>
        </div>
      )}

      {/* 8. Floating Countdown Timer Box */}
      {isTimerOpen && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#FFFFFF',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
              Đồng hồ đếm ngược
            </span>
            <button
              onClick={() => setIsTimerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'monospace', textAlign: 'center', color: timerSecondsLeft <= 30 ? '#EF4444' : '#38BDF8' }}>
            {formatTimer(timerSecondsLeft)}
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <button
              onClick={() => setIsCountdownRunning((r) => !r)}
              className="ppt-ss-btn"
              style={{ padding: '4px 12px', fontSize: '12px', background: isCountdownRunning ? '#EF4444' : '#107C41' }}
            >
              {isCountdownRunning ? 'Dừng' : 'Bắt đầu'}
            </button>
            <button
              onClick={() => { setIsCountdownRunning(false); setTimerSecondsLeft(300); }}
              className="ppt-ss-btn"
              style={{ padding: '4px 8px' }}
              title="Đặt lại 5 phút"
            >
              5p
            </button>
            <button
              onClick={() => { setIsCountdownRunning(false); setTimerSecondsLeft(600); }}
              className="ppt-ss-btn"
              style={{ padding: '4px 8px' }}
              title="Đặt lại 10 phút"
            >
              10p
            </button>
          </div>
        </div>
      )}

      {/* 9. Presenter Soundboard Popover */}
      {showSoundboard && (
        <div
          style={{
            position: 'fixed',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '10px 16px',
            display: 'flex',
            gap: '12px',
            zIndex: 900,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => playPresenterSound('applause')}
            className="ppt-ss-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            title="Phím tắt: 1"
          >
            <Hand size={14} /> <span>Vỗ tay (1)</span>
          </button>
          <button
            onClick={() => playPresenterSound('ding')}
            className="ppt-ss-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            title="Phím tắt: 2"
          >
            <Bell size={14} /> <span>Đing đúng (2)</span>
          </button>
          <button
            onClick={() => playPresenterSound('drum')}
            className="ppt-ss-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            title="Phím tắt: 3"
          >
            <Drum size={14} /> <span>Trống cuộn (3)</span>
          </button>
          <button
            onClick={() => playPresenterSound('fanfare')}
            className="ppt-ss-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            title="Phím tắt: 4"
          >
            <PartyPopper size={14} /> <span>Kèn mừng (4)</span>
          </button>
        </div>
      )}

      {/* Floating Audience Reactions */}
      {reactions.map((rx) => (
        <div
          key={rx.id}
          style={{
            position: 'fixed',
            bottom: '80px',
            left: `${rx.x}%`,
            fontSize: '32px',
            zIndex: 960,
            pointerEvents: 'none',
            animation: 'pptFloatOut 2.5s ease-out forwards',
          }}
        >
          {rx.emoji}
        </div>
      ))}

      {/* Draggable Circular Webcam Bubble */}
      {isWebcamActive && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            right: '24px',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #EF4444',
            boxShadow: '0 8px 30px rgba(239, 68, 68, 0.4)',
            zIndex: 950,
            background: '#000000',
          }}
          title="Webcam Studio Diễn Giả"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(220, 38, 38, 0.85)',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '8px',
            }}
          >
            REC
          </div>
        </div>
      )}

      {/* AI Speaker Coach HUD */}
      {isCoachActive && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '20px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #334155',
            borderRadius: '10px',
            padding: '8px 14px',
            color: '#FFFFFF',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="#F59E0B" />
            <span style={{ fontWeight: 700, color: '#F8FAFC' }}>AI Speaker Coach</span>
          </div>
          <span style={{ color: '#475569' }}>|</span>
          <div>
            Tốc độ: <strong style={{ color: coachWpm >= 120 && coachWpm <= 160 ? '#22C55E' : '#F59E0B' }}>{coachWpm} từ/phút</strong>
            <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '4px' }}>
              ({coachWpm >= 120 && coachWpm <= 160 ? 'Tốc độ vàng' : coachWpm > 160 ? 'Nói hơi nhanh' : 'Nói hơi chậm'})
            </span>
          </div>
          <span style={{ color: '#475569' }}>|</span>
          <div>
            Từ đệm (&quot;ờ/ừm&quot;): <strong style={{ color: fillerCount === 0 ? '#22C55E' : '#EF4444' }}>{fillerCount}</strong>
          </div>
        </div>
      )}

      {/* Voice-Activated Teleprompter Bar */}
      {isTeleprompterOpen && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '20px',
            width: '420px',
            maxHeight: '220px',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #4338CA',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#F8FAFC',
            zIndex: 920,
            boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#818CF8' }}>
              <FileText size={14} />
              <span>MÁY NHẮC CHỮ (TELEPROMPTER)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setTeleprompterSpeed((s) => Math.max(0.5, s - 0.5))}
                style={{ background: '#334155', border: 'none', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
              >
                -
              </button>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{teleprompterSpeed}x</span>
              <button
                onClick={() => setTeleprompterSpeed((s) => Math.min(3, s + 0.5))}
                style={{ background: '#334155', border: 'none', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
              >
                +
              </button>
              <button
                onClick={() => setIsTeleprompterOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div
            style={{
              overflowY: 'auto',
              fontSize: '15px',
              lineHeight: 1.6,
              color: '#F1F5F9',
              fontWeight: 500,
              paddingRight: '6px',
            }}
          >
            {currentSlide.notes || 'Chưa có ghi chú cho trang chiếu này. Bấm vào ô Ghi chú dưới slide để soạn bài phát biểu.'}
          </div>
        </div>
      )}

      {/* Audience Q&A Drawer */}
      {isQaDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '90px',
            width: '340px',
            background: 'rgba(15,23,42,0.95)',
            borderRadius: '12px',
            border: '1px solid #334155',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            zIndex: 8900,
            padding: '14px',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={16} /> Câu Hỏi Khán Giả (Live Q&A)
            </span>
            <button
              type="button"
              style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
              onClick={() => setIsQaDrawerOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {qaList.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'rgba(30,41,59,0.7)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ flex: 1, marginRight: '8px' }}>{item.text}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: '#38BDF8',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setQaList((prev) =>
                        prev.map((q) => (q.id === item.id ? { ...q, votes: q.votes + 1 } : q))
                      );
                    }}
                  >
                    <ThumbsUp size={12} /> {item.votes}
                  </button>
                  <button
                    type="button"
                    style={{
                      background: '#F59E0B',
                      color: '#0F172A',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => setPinnedQuestion(item.text)}
                  >
                    Ghim
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phone Clicker Remote Modal */}
      {isPhoneClickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setIsPhoneClickerOpen(false)}
        >
          <div
            style={{
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '420px',
              textAlign: 'center',
              color: '#FFFFFF',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Smartphone size={36} color="#38BDF8" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px 0' }}>
              Điều Khiển Từ Xa Bằng Điện Thoại
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 16px 0' }}>
              Quét mã QR bằng camera điện thoại để lật slide, bật laser và xem ghi chú từ xa.
            </p>
            <div
              style={{
                width: '160px',
                height: '160px',
                background: '#FFFFFF',
                borderRadius: '8px',
                margin: '0 auto 16px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0F172A',
                fontWeight: 800,
                fontSize: '14px',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              }}
            >
              <Smartphone size={40} color="#0F172A" />
              <span>MINH CLICKER</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                className="ppt-secondary-action-btn"
                style={{ padding: '6px 14px', fontSize: '12px' }}
                onClick={() => handleStepBack()}
              >
                <ChevronLeft size={14} /> Trang trước
              </button>
              <button
                type="button"
                className="ppt-primary-action-btn"
                style={{ padding: '6px 14px', fontSize: '12px' }}
                onClick={() => handleAdvance()}
              >
                Trang sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Sleek Floating Presenter Dock at Bottom */}
      <div className="ppt-slideshow-bar" onClick={(e) => e.stopPropagation()}>
        <button
          className="ppt-ss-btn"
          disabled={currentIndex === 0 && animStep === 0}
          onClick={handleStepBack}
          title="Lùi lại (Mũi tên trái)"
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '70px', textAlign: 'center' }}>
          {currentIndex + 1} / {slides.length}
          {entranceElements.length > 0 && (
            <span style={{ color: '#F59E0B', marginLeft: '4px', fontSize: '10px' }}>
              [{animStep}/{entranceElements.length}]
            </span>
          )}
        </span>

        <button
          className="ppt-ss-btn"
          disabled={currentIndex === slides.length - 1 && animStep === entranceElements.length}
          onClick={handleAdvance}
          title="Tiến tới (Mũi tên phải / Phím cách)"
        >
          <ChevronRight size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Laser (L) */}
        <button
          className={`ppt-ss-btn ${isLaserActive ? 'is-active' : ''}`}
          onClick={() => {
            setIsLaserActive((v) => !v);
            setIsSpotlightActive(false);
            setIsMagnifierActive(false);
            setDrawTool('none');
          }}
          title="Tia Laser đỏ (L)"
        >
          <Sparkles size={16} />
        </button>

        {/* Spotlight (S) */}
        <button
          className={`ppt-ss-btn ${isSpotlightActive ? 'is-active' : ''}`}
          onClick={() => {
            setIsSpotlightActive((v) => !v);
            setIsLaserActive(false);
            setIsMagnifierActive(false);
          }}
          title="Đèn rọi Spotlight (S)"
        >
          <Radio size={16} />
        </button>

        {/* Magnifier (Z) */}
        <button
          className={`ppt-ss-btn ${isMagnifierActive ? 'is-active' : ''}`}
          onClick={() => {
            setIsMagnifierActive((v) => !v);
            setIsLaserActive(false);
            setIsSpotlightActive(false);
          }}
          title="Kính lúp phóng đại (Z)"
        >
          <Search size={16} />
        </button>

        {/* In-Show Pen (P) */}
        <button
          className={`ppt-ss-btn ${drawTool === 'pen' ? 'is-active' : ''}`}
          onClick={() => setDrawTool((t) => (t === 'pen' ? 'none' : 'pen'))}
          title="Bút vẽ trực tiếp (P)"
        >
          <PenTool size={16} />
        </button>

        {/* In-Show Highlighter (I) */}
        <button
          className={`ppt-ss-btn ${drawTool === 'highlighter' ? 'is-active' : ''}`}
          onClick={() => setDrawTool((t) => (t === 'highlighter' ? 'none' : 'highlighter'))}
          title="Bút dạ quang đánh dấu (I)"
        >
          <Highlighter size={16} />
        </button>

        {/* Eraser Tool (E) */}
        <button
          className={`ppt-ss-btn ${drawTool === 'eraser' ? 'is-active' : ''}`}
          onClick={() => setDrawTool((t) => (t === 'eraser' ? 'none' : 'eraser'))}
          title="Tẩy nét vẽ (E)"
        >
          <Eraser size={16} />
        </button>

        {/* Clear All Drawing (C) */}
        <button
          className="ppt-ss-btn"
          onClick={() => {
            if (drawCanvasRef.current) {
              const ctx = drawCanvasRef.current.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
            }
          }}
          title="Xóa tất cả nét vẽ trên trang chiếu (C)"
        >
          <Trash2 size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Live Vietnamese Subtitles */}
        <button
          className={`ppt-ss-btn ${isSubtitlesActive ? 'is-active' : ''}`}
          onClick={() => setIsSubtitlesActive((v) => !v)}
          title="Bật/tắt Phụ đề tiếng Việt theo giọng nói"
        >
          {isSubtitlesActive ? <Mic size={16} color="#22C55E" /> : <MicOff size={16} />}
        </button>

        {/* Soundboard */}
        <button
          className={`ppt-ss-btn ${showSoundboard ? 'is-active' : ''}`}
          onClick={() => setShowSoundboard((v) => !v)}
          title="Bàn phím âm thanh tương tác (1: Vỗ tay, 2: Ding, 3: Trống, 4: Kèn)"
        >
          <Volume2 size={16} />
        </button>

        {/* Countdown Timer */}
        <button
          className={`ppt-ss-btn ${isTimerOpen ? 'is-active' : ''}`}
          onClick={() => setIsTimerOpen((v) => !v)}
          title="Đồng hồ đếm ngược"
        >
          <Timer size={16} />
        </button>

        {/* Slide Recording Studio */}
        <button
          className={`ppt-ss-btn ${isRecording ? 'is-active' : ''}`}
          onClick={toggleRecordingStudio}
          style={{ background: isRecording ? '#DC2626' : undefined }}
          title={isRecording ? "Dừng thu bài giảng và lưu file video" : "Ghi âm & Thu bài thuyết trình kèm Webcam (Studio)"}
        >
          {isRecording ? <VideoOff size={16} /> : <Video size={16} />}
        </button>

        {/* AI Speaker Coach */}
        <button
          className={`ppt-ss-btn ${isCoachActive ? 'is-active' : ''}`}
          onClick={() => setIsCoachActive((v) => !v)}
          title="Huấn luyện viên thuyết trình AI (Đo WPM & Đếm từ đệm)"
        >
          <Award size={16} color={isCoachActive ? '#F59E0B' : undefined} />
        </button>

        {/* Teleprompter */}
        <button
          className={`ppt-ss-btn ${isTeleprompterOpen ? 'is-active' : ''}`}
          onClick={() => setIsTeleprompterOpen((v) => !v)}
          title="Máy nhắc chữ thông minh (Teleprompter)"
        >
          <FileText size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Presentation Ambient BGM & Smart Ducking */}
        <button
          className={`ppt-ss-btn ${isBgmActive ? 'is-active' : ''}`}
          onClick={() => {
            if (isBgmActive) {
              stopPresentationBgm();
              setIsBgmActive(false);
            } else {
              const ok = startPresentationBgm();
              setIsBgmActive(ok);
            }
          }}
          title="Nhạc nền thuyết trình & Tự động hạ âm lượng khi có tiếng nói (Smart Audio Ducking)"
        >
          <Music size={16} color={isBgmActive ? '#38BDF8' : undefined} />
        </button>

        {/* Live Audience Q&A */}
        <button
          className={`ppt-ss-btn ${isQaDrawerOpen ? 'is-active' : ''}`}
          onClick={() => setIsQaDrawerOpen((v) => !v)}
          title="Hàng đợi câu hỏi ẩn danh từ khán giả (Audience Q&A)"
        >
          <MessageSquare size={16} color={isQaDrawerOpen ? '#F59E0B' : undefined} />
        </button>

        {/* Phone Clicker Remote */}
        <button
          className={`ppt-ss-btn ${isPhoneClickerOpen ? 'is-active' : ''}`}
          onClick={() => setIsPhoneClickerOpen((v) => !v)}
          title="Biến điện thoại thành điều khiển từ xa (Phone Clicker QR)"
        >
          <Smartphone size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Live Audience Reactions */}
        <button className="ppt-ss-btn" onClick={() => handleSendReaction('❤️')} title="Khán giả thả tim">
          <Heart size={14} color="#EF4444" />
        </button>
        <button className="ppt-ss-btn" onClick={() => handleSendReaction('👏')} title="Khán giả vỗ tay">
          <ThumbsUp size={14} color="#3B82F6" />
        </button>
        <button className="ppt-ss-btn" onClick={() => handleSendReaction('🔥')} title="Khán giả cổ vũ">
          <Flame size={14} color="#F97316" />
        </button>

        {/* Black Screen (B) */}
        <button
          className="ppt-ss-btn"
          onClick={() => setBlankMode((m) => (m === 'black' ? 'none' : 'black'))}
          title="Màn hình Đen (B)"
        >
          <Moon size={16} />
        </button>

        {/* White Screen (W) */}
        <button
          className="ppt-ss-btn"
          onClick={() => setBlankMode((m) => (m === 'white' ? 'none' : 'white'))}
          title="Màn hình Trắng (W)"
        >
          <Sun size={16} />
        </button>

        <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Presenter View */}
        <button
          className="ppt-ss-btn"
          onClick={() => setIsPresenterMode(true)}
          title="Chế độ Diễn giả (Presenter View)"
        >
          <Layout size={16} />
        </button>

        {/* Exit (Esc) */}
        <button
          className="ppt-ss-btn"
          onClick={onClose}
          title="Thoát trình chiếu (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
