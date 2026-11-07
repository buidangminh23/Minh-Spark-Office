import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  Save,
  Undo2,
  Redo2,
  Presentation,
} from 'lucide-react';
import type { FileMeta, SlideContent } from '../../lib/storage';
import type {
  PresentationData,
  SlideData,
  SlideElement,
  SlideLayout,
  ShapeType,
  ChartType,
  TransitionType,
} from '../../lib/slideTypes';
import { SuiteLogo } from '../../components/SuiteLogo';
import { useUi } from '../../components/ui';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { createSlideFromLayout } from '../../lib/slideTemplates';
import { exportToPptx } from '../../lib/pptxExport';
import { SlideCanvas } from './SlideCanvas';
import { SlideThumbnails } from './SlideThumbnails';
import { SlideRibbon, type RibbonTab } from './SlideRibbon';
import { SlideShow } from './SlideShow';
import { SlideBackstage } from './SlideBackstage';
import './slideEditor.css';
import { useDocumentCloser } from '../../lib/documentCloser';

interface SlideEditorProps {
  meta: FileMeta;
  content: SlideContent;
  onSave: (meta: FileMeta, content: SlideContent, explicit?: boolean) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 1000;

export default function SlideEditor({
  meta,
  content,
  onSave,
  onRename,
  onBack,
}: SlideEditorProps) {
  const ui = useUi();
  const [presentation, setPresentation] = useState<PresentationData>(content.presentation);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<'normal' | 'sorter'>('normal');
  const [showNotes, setShowNotes] = useState(true);

  const [isSlideShowActive, setIsSlideShowActive] = useState(false);
  const [isPresenterMode, setIsPresenterMode] = useState(false);
  const [isBackstageOpen, setIsBackstageOpen] = useState(false);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<PresentationData[]>([]);
  const [redoStack, setRedoStack] = useState<PresentationData[]>([]);

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSlide = presentation.slides[activeSlideIndex] || presentation.slides[0];
  const selectedElement = currentSlide?.elements.find((el) => el.id === selectedElementId) || null;

  // Record history for Undo
  const pushHistory = useCallback((currentPres: PresentationData) => {
    setUndoStack((prev) => [...prev.slice(-25), currentPres]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, presentation]);
    setPresentation(prev);
    setSaveStatus('unsaved');
  }, [undoStack, presentation]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, presentation]);
    setPresentation(next);
    setSaveStatus('unsaved');
  }, [redoStack, presentation]);

  // Debounced Autosave
  const triggerAutoSave = useCallback(
    (newPres: PresentationData) => {
      setSaveStatus('unsaved');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

      autosaveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        const updatedContent: SlideContent = {
          kind: 'slide',
          presentation: newPres,
          comments: content.comments,
        };
        const ok = await onSave(meta, updatedContent, false);
        setSaveStatus(ok ? 'saved' : 'unsaved');
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [content.comments, meta, onSave]
  );

  // Explicit Save (Ctrl+S)
  const handleExplicitSave = useCallback(async () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveStatus('saving');
    const updatedContent: SlideContent = {
      kind: 'slide',
      presentation,
      comments: content.comments,
    };
    const ok = await onSave(meta, updatedContent, true);
    setSaveStatus(ok ? 'saved' : 'unsaved');
    if (ok) ui.toast('Đã lưu bài thuyết trình');
  }, [content.comments, meta, onSave, presentation, ui]);

  useDocumentCloser(async () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const saved = await onSave(meta, { kind: 'slide', presentation, comments: content.comments }, false);
    if (saved) onBack();
    return saved;
  });

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleExplicitSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) {
          setIsSlideShowActive(true);
        } else {
          setActiveSlideIndex(0);
          setIsSlideShowActive(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [handleExplicitSave, handleUndo, handleRedo]);

  // Update elements
  const updateSlideElement = (elementId: string, updates: Partial<SlideElement>) => {
    pushHistory(presentation);
    const updatedSlides = presentation.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s;
      return {
        ...s,
        elements: s.elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el)),
      };
    });

    const newPres: PresentationData = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const deleteSlideElement = (elementId: string) => {
    pushHistory(presentation);
    const updatedSlides = presentation.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s;
      return {
        ...s,
        elements: s.elements.filter((el) => el.id !== elementId),
      };
    });

    const newPres: PresentationData = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(null);
    triggerAutoSave(newPres);
  };

  // Add Slide
  const handleAddSlide = (layout: SlideLayout) => {
    pushHistory(presentation);
    const newSlide = createSlideFromLayout(
      layout,
      presentation.slides.length,
      presentation.themeId
    );
    const newSlides = [...presentation.slides];
    newSlides.splice(activeSlideIndex + 1, 0, newSlide);

    const newPres = { ...presentation, slides: newSlides };
    setPresentation(newPres);
    setActiveSlideIndex(activeSlideIndex + 1);
    setSelectedElementId(null);
    triggerAutoSave(newPres);
    ui.toast('Đã thêm trang chiếu mới');
  };

  // Duplicate Slide
  const handleDuplicateSlide = (index: number) => {
    pushHistory(presentation);
    const sourceSlide = presentation.slides[index];
    const duplicated: SlideData = {
      ...sourceSlide,
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      elements: sourceSlide.elements.map((el) => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };

    const newSlides = [...presentation.slides];
    newSlides.splice(index + 1, 0, duplicated);

    const newPres = { ...presentation, slides: newSlides };
    setPresentation(newPres);
    setActiveSlideIndex(index + 1);
    triggerAutoSave(newPres);
    ui.toast('Đã nhân bản trang chiếu');
  };

  // Delete Slide
  const handleDeleteSlide = (index: number) => {
    if (presentation.slides.length <= 1) {
      ui.toast('Không thể xoá trang chiếu duy nhất', true);
      return;
    }
    pushHistory(presentation);
    const newSlides = presentation.slides.filter((_, idx) => idx !== index);
    const nextIdx = Math.min(index, newSlides.length - 1);

    const newPres = { ...presentation, slides: newSlides };
    setPresentation(newPres);
    setActiveSlideIndex(nextIdx);
    setSelectedElementId(null);
    triggerAutoSave(newPres);
    ui.toast('Đã xoá trang chiếu');
  };

  // Move Slide
  const handleMoveSlide = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= presentation.slides.length) return;
    pushHistory(presentation);
    const newSlides = [...presentation.slides];
    const [moved] = newSlides.splice(fromIndex, 1);
    newSlides.splice(toIndex, 0, moved);

    const newPres = { ...presentation, slides: newSlides };
    setPresentation(newPres);
    setActiveSlideIndex(toIndex);
    triggerAutoSave(newPres);
  };

  // Add Elements
  const handleAddText = () => {
    pushHistory(presentation);
    const theme = SLIDE_THEMES[presentation.themeId] || SLIDE_THEMES['office-classic'];
    const newEl: SlideElement = {
      id: `el-text-${Date.now()}`,
      type: 'text',
      x: 25,
      y: 35,
      width: 50,
      height: 20,
      text: 'Nhập nội dung văn bản tại đây',
      fontSize: 24,
      fontFamily: theme.bodyFont,
      color: theme.textColor,
      textAlign: 'left',
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
  };

  const handleAddShape = (shapeType: ShapeType) => {
    pushHistory(presentation);
    const theme = SLIDE_THEMES[presentation.themeId] || SLIDE_THEMES['office-classic'];
    const newEl: SlideElement = {
      id: `el-shape-${Date.now()}`,
      type: 'shape',
      shapeType,
      x: 35,
      y: 30,
      width: 30,
      height: 30,
      fill: theme.primaryColor,
      stroke: theme.primaryColor,
      strokeWidth: 1,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
  };

  const handleAddTable = (rows: number, cols: number) => {
    pushHistory(presentation);
    const data: string[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r === 0 ? `Cột ${c + 1}` : `Ô ${r},${c + 1}`))
    );

    const newEl: SlideElement = {
      id: `el-table-${Date.now()}`,
      type: 'table',
      x: 10,
      y: 20,
      width: 80,
      height: 60,
      tableRows: rows,
      tableCols: cols,
      tableData: data,
      tableHeaderRow: true,
      tableHeaderColor: '#D83B01',
      tableHeaderTextColor: '#FFFFFF',
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn bảng biểu');
  };

  const handleAddChart = (chartType: ChartType) => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `el-chart-${Date.now()}`,
      type: 'chart',
      chartType,
      chartTitle: 'Biểu đồ tăng trưởng doanh số',
      chartCategories: ['Q1', 'Q2', 'Q3', 'Q4'],
      chartSeries: [
        { name: 'Kế hoạch', values: [30, 45, 60, 80], color: '#64748B' },
        { name: 'Thực tế', values: [35, 52, 75, 95], color: '#0284C7' },
      ],
      x: 15,
      y: 20,
      width: 70,
      height: 60,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn biểu đồ');
  };

  const handleAddSmartArt = (type: 'process' | 'cycle' | 'pyramid') => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `el-smartart-${Date.now()}`,
      type: 'smartart',
      smartArtType: type,
      smartArtItems: [
        { title: 'Giai đoạn 1', desc: 'Khởi động và lên ý tưởng', color: '#0284C7' },
        { title: 'Giai đoạn 2', desc: 'Nghiên cứu thị trường', color: '#059669' },
        { title: 'Giai đoạn 3', desc: 'Sản xuất và thử nghiệm', color: '#D97706' },
        { title: 'Giai đoạn 4', desc: 'Bàn giao và đánh giá', color: '#7C3AED' },
      ],
      x: 8,
      y: 25,
      width: 84,
      height: 50,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn sơ đồ SmartArt');
  };

  const handleAddImage = (src: string) => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `el-img-${Date.now()}`,
      type: 'image',
      src,
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      borderRadius: 8,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã thêm hình ảnh vào trang chiếu');
  };

  const handleAddQrCode = (url: string) => {
    pushHistory(presentation);
    const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
    const newEl: SlideElement = {
      id: `el-qr-${Date.now()}`,
      type: 'image',
      src: qrDataUrl,
      x: 40,
      y: 30,
      width: 20,
      height: 35,
      borderRadius: 8,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn mã QR');
  };

  // Change Theme
  const handleApplyTheme = (themeId: string) => {
    pushHistory(presentation);
    const theme = SLIDE_THEMES[themeId];
    if (!theme) return;

    const updatedSlides = presentation.slides.map((s) => ({
      ...s,
      background: {
        type: 'solid' as const,
        value: theme.backgroundColor,
      },
    }));

    const newPres: PresentationData = {
      ...presentation,
      themeId,
      slides: updatedSlides,
    };

    setPresentation(newPres);
    triggerAutoSave(newPres);
    ui.toast(`Đã áp dụng chủ đề "${theme.name}"`);
  };

  // Transitions
  const handleChangeTransition = (type: TransitionType) => {
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { type, duration: 0.5 } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleApplyTransitionToAll = () => {
    const trans = currentSlide.transition;
    const updatedSlides = presentation.slides.map((s) => ({
      ...s,
      transition: { ...trans },
    }));
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
    ui.toast('Đã áp dụng hiệu ứng chuyển tiếp cho tất cả các trang');
  };

  // Speaker notes change
  const handleNotesChange = (text: string) => {
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, notes: text } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  // AI Copilot generator
  const handleAiGenerate = async () => {
    const res = await ui.ask({
      title: 'AI Copilot · Tạo nội dung thuyết trình',
      message: 'Nhập chủ đề hoặc bài thuyết trình bạn muốn tạo để AI soạn thảo bài thuyết trình hoàn chỉnh:',
      fields: [
        {
          name: 'prompt',
          label: 'Chủ đề thuyết trình',
          type: 'text',
          placeholder: 'Ví dụ: Kế hoạch mở rộng kinh doanh tại TP. Hồ Chí Minh quý 4',
        },
      ],
      confirmText: 'Tạo bài thuyết trình',
      cancelText: 'Huỷ',
    });

    if (!res || !res.prompt) return;

    ui.showBusy('AI Copilot đang soạn thảo bài thuyết trình…');
    setTimeout(() => {
      pushHistory(presentation);
      const newSlide = createSlideFromLayout(
        'title-content',
        presentation.slides.length,
        presentation.themeId,
        String(res.prompt).toUpperCase()
      );
      newSlide.elements[1].text = `• Tổng quan chiến lược triển khai cho chủ đề "${res.prompt}"\n• Phân tích cơ hội thị trường và các yếu tố cạnh tranh\n• Nguồn lực và kinh phí cần chuẩn bị\n• Dự kiến các cột mốc quan trọng trong năm 2026`;

      const newPres = {
        ...presentation,
        slides: [...presentation.slides, newSlide],
      };
      setPresentation(newPres);
      setActiveSlideIndex(presentation.slides.length);
      ui.showBusy(null);
      ui.toast('AI Copilot đã tạo trang chiếu mới thành công!');
    }, 1200);
  };

  return (
    <div className="ppt-editor">
      {/* 1. Office Title Bar */}
      <header className="ppt-titlebar">
        <div className="ppt-title-left">
          <button className="ppt-back-btn" onClick={onBack} title="Trở về Trang chủ">
            <ArrowLeft size={18} />
          </button>
          <SuiteLogo kind="slide" size={26} />
          <div className="ppt-file-name-wrap">
            <input
              type="text"
              className="ppt-file-name-input"
              value={meta.name}
              onChange={(e) => onRename(e.target.value)}
              title="Nhấp để đổi tên tệp"
            />
            <span className="ppt-save-badge">
              {saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 size={13} color="#10B981" /> Đã lưu
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <Clock size={13} color="#F59E0B" /> Đang lưu…
                </>
              ) : (
                'Chưa lưu'
              )}
            </span>
          </div>
        </div>

        <div className="ppt-title-quick">
          <button
            className="ppt-quick-btn"
            onClick={handleExplicitSave}
            title="Lưu (Ctrl+S)"
          >
            <Save size={16} />
          </button>
          <button
            className="ppt-quick-btn"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="ppt-quick-btn"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <span style={{ width: '1px', height: '18px', background: '#E2E8F0', margin: '0 6px' }} />

          <button
            className="ppt-present-top-btn"
            onClick={() => setIsSlideShowActive(true)}
            title="Bắt đầu Trình chiếu từ đầu (F5)"
          >
            <Play size={14} fill="#FFFFFF" /> Trình chiếu (F5)
          </button>
        </div>
      </header>

      {/* 2. Ribbon Tabs & Body */}
      <SlideRibbon
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenFileMenu={() => setIsBackstageOpen(true)}
        selectedElement={selectedElement}
        onUpdateSelectedElement={(updates) => selectedElementId && updateSlideElement(selectedElementId, updates)}
        onDeleteSelectedElement={() => selectedElementId && deleteSlideElement(selectedElementId)}
        onAddSlide={handleAddSlide}
        onAddShape={handleAddShape}
        onAddText={handleAddText}
        onAddTable={handleAddTable}
        onAddChart={handleAddChart}
        onAddSmartArt={handleAddSmartArt}
        onAddImage={handleAddImage}
        onAddQrCode={handleAddQrCode}
        currentThemeId={presentation.themeId}
        onApplyTheme={handleApplyTheme}
        aspectRatio={presentation.aspectRatio}
        onChangeAspectRatio={(ratio) => {
          const newPres = { ...presentation, aspectRatio: ratio };
          setPresentation(newPres);
          triggerAutoSave(newPres);
        }}
        currentTransition={currentSlide?.transition.type || 'none'}
        onChangeTransition={handleChangeTransition}
        onApplyTransitionToAll={handleApplyTransitionToAll}
        onStartSlideShow={(fromCurrent) => {
          if (!fromCurrent) setActiveSlideIndex(0);
          setIsSlideShowActive(true);
        }}
        onStartPresenterMode={() => {
          setIsPresenterMode(true);
          setIsSlideShowActive(true);
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showNotes={showNotes}
        onToggleNotes={() => setShowNotes(!showNotes)}
        onAiGenerate={handleAiGenerate}
      />

      {/* 3. Main Workspace Area */}
      <div className="ppt-workspace">
        {/* Left Thumbnails list */}
        <SlideThumbnails
          slides={presentation.slides}
          activeSlideIndex={activeSlideIndex}
          onSelectSlide={(idx) => {
            setActiveSlideIndex(idx);
            setSelectedElementId(null);
          }}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
        />

        {/* Central Stage: Normal vs Slide Sorter */}
        <div className="ppt-stage">
          {viewMode === 'normal' ? (
            <>
              <div className="ppt-canvas-container">
                <SlideCanvas
                  slide={currentSlide}
                  aspectRatio={presentation.aspectRatio}
                  zoom={zoom}
                  selectedElementId={selectedElementId}
                  onSelectElement={setSelectedElementId}
                  onUpdateElement={updateSlideElement}
                  onDeleteElement={deleteSlideElement}
                />
              </div>

              {/* Bottom Speaker Notes */}
              {showNotes && (
                <div className="ppt-notes-pane">
                  <div className="ppt-notes-header">
                    <span>Ghi chú của Diễn giả (Trang chiếu {activeSlideIndex + 1})</span>
                  </div>
                  <textarea
                    className="ppt-notes-textarea"
                    placeholder="Bấm vào đây để thêm ghi chú cho người thuyết trình..."
                    value={currentSlide?.notes || ''}
                    onChange={(e) => handleNotesChange(e.target.value)}
                  />
                </div>
              )}
            </>
          ) : (
            /* Slide Sorter Grid View */
            <div style={{ flex: 1, overflow: 'auto', padding: '30px', background: '#E2E8F0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {presentation.slides.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveSlideIndex(idx);
                      setViewMode('normal');
                    }}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#FFFFFF',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      border: idx === activeSlideIndex ? '3px solid #D83B01' : '1px solid #CBD5E1',
                    }}
                  >
                    <div style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: '13px' }}>
                      Trang chiếu {idx + 1}
                    </div>
                    <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
                      <SlideCanvas
                        slide={s}
                        aspectRatio={presentation.aspectRatio}
                        zoom={32}
                        selectedElementId={null}
                        onSelectElement={() => {}}
                        onUpdateElement={() => {}}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Office Status Bar */}
      <footer className="ppt-statusbar">
        <div className="ppt-status-left">
          <span>
            Trang chiếu <strong>{activeSlideIndex + 1}</strong> trên <strong>{presentation.slides.length}</strong>
          </span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span>Chủ đề: <strong>{SLIDE_THEMES[presentation.themeId]?.name || 'Office Classic'}</strong></span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <button className="ppt-status-btn" onClick={() => setShowNotes(!showNotes)}>
            Ghi chú {showNotes ? '▲' : '▼'}
          </button>
        </div>

        <div className="ppt-status-right">
          <button
            className={`ppt-status-btn ${viewMode === 'normal' ? 'is-active' : ''}`}
            onClick={() => setViewMode('normal')}
            title="Chế độ xem Bình thường"
          >
            Bình thường
          </button>
          <button
            className={`ppt-status-btn ${viewMode === 'sorter' ? 'is-active' : ''}`}
            onClick={() => setViewMode('sorter')}
            title="Bộ sắp xếp trang chiếu (Slide Sorter)"
          >
            Bộ sắp xếp
          </button>
          <button
            className="ppt-status-btn"
            onClick={() => setIsSlideShowActive(true)}
            title="Bắt đầu Trình chiếu (F5)"
          >
            <Presentation size={14} /> Chiếu
          </button>

          <span style={{ color: '#CBD5E1' }}>|</span>

          {/* Zoom Controls */}
          <button className="ppt-status-btn" onClick={() => setZoom(Math.max(50, zoom - 10))} title="Thu nhỏ">
            -
          </button>
          <input
            type="range"
            min={50}
            max={150}
            step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="ppt-zoom-slider"
          />
          <button className="ppt-status-btn" onClick={() => setZoom(Math.min(150, zoom + 10))} title="Phóng to">
            +
          </button>
          <span style={{ minWidth: '36px', textAlign: 'right' }}>{zoom}%</span>
          <button className="ppt-status-btn" onClick={() => setZoom(100)} title="Vừa màn hình">
            Vừa khung
          </button>
        </div>
      </footer>

      {/* Fullscreen Slide Show Mode */}
      {isSlideShowActive && (
        <SlideShow
          slides={presentation.slides}
          initialIndex={activeSlideIndex}
          aspectRatio={presentation.aspectRatio}
          isPresenterMode={isPresenterMode}
          onClose={() => {
            setIsSlideShowActive(false);
            setIsPresenterMode(false);
          }}
        />
      )}

      {/* Backstage File Modal */}
      {isBackstageOpen && (
        <SlideBackstage
          meta={meta}
          content={{ kind: 'slide', presentation }}
          onClose={() => setIsBackstageOpen(false)}
          onSave={handleExplicitSave}
          onExportPptx={() => exportToPptx(presentation, meta.name)}
          onPrint={() => window.print()}
          onNew={() => {
            setIsBackstageOpen(false);
            onBack();
          }}
          onBackToHome={onBack}
        />
      )}
    </div>
  );
}
