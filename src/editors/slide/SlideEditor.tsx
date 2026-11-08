import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  Save,
  Undo2,
  Redo2,
  Sliders,
  Ruler,
  Grid,
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
  TransitionDirection,
  TransitionSound,
  AnimationType,
  AnimationCategory,
  AnimationDirection,
  AnimationTrigger,
  ElementAnimation,
  SlideBackground,
  SlideTheme,
} from '../../lib/slideTypes';
import { SuiteLogo } from '../../components/SuiteLogo';
import { useUi } from '../../components/ui';
import { useDocumentCloser } from '../../lib/documentCloser';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { createSlideFromLayout } from '../../lib/slideTemplates';
import { exportToPptx } from '../../lib/pptxExport';
import { playTransitionSound } from '../../lib/slideAudio';
import { SlideCanvas } from './SlideCanvas';
import { SlideThumbnails } from './SlideThumbnails';
import { SlideRibbon, type RibbonTab } from './SlideRibbon';
import { SlideShow } from './SlideShow';
import { SlideBackstage } from './SlideBackstage';
import { SlideFormatPane } from './SlideFormatPane';
import { SlideAnimationPane } from './SlideAnimationPane';
import { SlideContextMenu, type ContextMenuPosition } from './SlideContextMenu';
import { SlideHorizontalRuler, SlideVerticalRuler } from './SlideRuler';
import { SlideFindReplaceModal } from './SlideFindReplaceModal';
import { SlideExportModal } from './SlideExportModal';
import { SlideAiModal } from './SlideAiModal';
import { SlideDesignerPane } from './SlideDesignerPane';
import { SlideMailMergeModal } from './SlideMailMergeModal';
import { SlideBrandPaletteModal } from './SlideBrandPaletteModal';
import { SlideDiffModal } from './SlideDiffModal';
import { SlideMasterModal } from './SlideMasterModal';
import { SlideSheetsLinkModal } from './SlideSheetsLinkModal';
import { SlideCustomShowsModal } from './SlideCustomShowsModal';
import './slideEditor.css';

interface SlideEditorProps {
  meta: FileMeta;
  content: SlideContent;
  onSave: (meta: FileMeta, content: SlideContent, explicit?: boolean) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 1000;

const CONTEXTUAL_TAB_BY_TYPE: Partial<Record<SlideElement['type'], RibbonTab>> = {
  shape: 'shape-format',
  image: 'picture-format',
  table: 'table-design',
  chart: 'chart-design',
};
const CONTEXTUAL_TABS = new Set<RibbonTab>(Object.values(CONTEXTUAL_TAB_BY_TYPE));

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

  // Advanced features state
  const [showRuler, setShowRuler] = useState(true);
  const [showGridlines, setShowGridlines] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [isFormatPaneOpen, setIsFormatPaneOpen] = useState(false);

  // Drawing state
  const [drawMode, setDrawMode] = useState<'select' | 'pen' | 'highlighter' | 'eraser'>('select');
  const [inkColor, setInkColor] = useState('#000000');
  const [inkWidth, setInkWidth] = useState(3);

  // Context menu state
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const [contextMenuElementId, setContextMenuElementId] = useState<string | null>(null);

  // Modals state
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSlideShowActive, setIsSlideShowActive] = useState(false);
  const [isPresenterMode, setIsPresenterMode] = useState(false);
  const [isBackstageOpen, setIsBackstageOpen] = useState(false);
  const [isAnimationPaneOpen, setIsAnimationPaneOpen] = useState(false);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [isMailMergeOpen, setIsMailMergeOpen] = useState(false);
  const [isBrandPaletteOpen, setIsBrandPaletteOpen] = useState(false);
  const [isSlideDiffOpen, setIsSlideDiffOpen] = useState(false);
  const [isSlideMasterOpen, setIsSlideMasterOpen] = useState(false);
  const [isSheetsLinkOpen, setIsSheetsLinkOpen] = useState(false);
  const [isCustomShowsOpen, setIsCustomShowsOpen] = useState(false);
  const [watermarkText, setWatermarkText] = useState(presentation.watermark?.text || 'BẢN QUYỀN - MINH SPARK');
  const [watermarkEnabled, setWatermarkEnabled] = useState(presentation.watermark?.enabled ?? false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(presentation.watermark?.opacity ?? 0.15);
  const [isPreviewingTransition, setIsPreviewingTransition] = useState(false);
  const [previewingAnimElementId, setPreviewingAnimElementId] = useState<string | null>(null);
  const [animationPainterActive, setAnimationPainterActive] = useState(false);
  const [copiedAnimation, setCopiedAnimation] = useState<ElementAnimation | null>(null);

  // Clipboard
  const [clipboardElement, setClipboardElement] = useState<SlideElement | null>(null);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<PresentationData[]>([]);
  const [redoStack, setRedoStack] = useState<PresentationData[]>([]);

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSlide = presentation.slides[activeSlideIndex] || presentation.slides[0];
  const selectedElement = currentSlide?.elements.find((el) => el.id === selectedElementId) || null;

  // Auto-switch contextual tab when element is selected
  const selectedElementType = selectedElement?.type;
  useEffect(() => {
    const contextualTab = selectedElementType ? CONTEXTUAL_TAB_BY_TYPE[selectedElementType] : undefined;
    setActiveTab((current) => {
      if (contextualTab) return contextualTab;
      return CONTEXTUAL_TABS.has(current) ? 'home' : current;
    });
  }, [selectedElementId, selectedElementType]);

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

  const duplicateElementRef = useRef<() => void>(() => {});

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsExportModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedElementId) duplicateElementRef.current();
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
  }, [handleExplicitSave, handleUndo, handleRedo, selectedElementId]);

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

  // Duplicate Element
  const handleDuplicateElement = () => {
    if (!selectedElement) return;
    pushHistory(presentation);
    const duplicated: SlideElement = {
      ...selectedElement,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.min(90, selectedElement.x + 3),
      y: Math.min(90, selectedElement.y + 3),
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, duplicated] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(duplicated.id);
    triggerAutoSave(newPres);
    ui.toast('Đã nhân bản phần tử');
  };

  useEffect(() => {
    duplicateElementRef.current = handleDuplicateElement;
  });

  // Clipboard Cut / Copy / Paste
  const handleCut = () => {
    if (!selectedElement) return;
    setClipboardElement({ ...selectedElement });
    deleteSlideElement(selectedElement.id);
    ui.toast('Đã cắt phần tử');
  };

  const handleCopy = () => {
    if (!selectedElement) return;
    setClipboardElement({ ...selectedElement });
    ui.toast('Đã sao chép phần tử');
  };

  const handlePaste = () => {
    if (!clipboardElement) return;
    pushHistory(presentation);
    const pasted: SlideElement = {
      ...clipboardElement,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.min(90, clipboardElement.x + 4),
      y: Math.min(90, clipboardElement.y + 4),
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, pasted] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(pasted.id);
    triggerAutoSave(newPres);
    ui.toast('Đã dán phần tử');
  };

  // Layers Arrangement
  const handleBringToFront = () => {
    if (!selectedElement) return;
    const maxZ = Math.max(...currentSlide.elements.map((e) => e.zIndex || 10), 10);
    updateSlideElement(selectedElement.id, { zIndex: maxZ + 1 });
  };

  const handleSendToBack = () => {
    if (!selectedElement) return;
    const minZ = Math.min(...currentSlide.elements.map((e) => e.zIndex || 10), 10);
    updateSlideElement(selectedElement.id, { zIndex: Math.max(1, minZ - 1) });
  };

  const handleBringForward = () => {
    if (!selectedElement) return;
    updateSlideElement(selectedElement.id, { zIndex: (selectedElement.zIndex || 10) + 1 });
  };

  const handleSendBackward = () => {
    if (!selectedElement) return;
    updateSlideElement(selectedElement.id, { zIndex: Math.max(1, (selectedElement.zIndex || 10) - 1) });
  };

  // Element Alignment
  const handleAlignElement = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElement) return;
    let { x, y } = selectedElement;
    if (align === 'left') x = 5;
    if (align === 'center') x = (100 - selectedElement.width) / 2;
    if (align === 'right') x = 95 - selectedElement.width;
    if (align === 'top') y = 5;
    if (align === 'middle') y = (100 - selectedElement.height) / 2;
    if (align === 'bottom') y = 95 - selectedElement.height;

    updateSlideElement(selectedElement.id, {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    });
  };

  // Add Freehand Ink Element
  const handleAddInkElement = (inkData: Partial<SlideElement>) => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `el-ink-${Date.now()}`,
      type: 'ink',
      x: inkData.x || 10,
      y: inkData.y || 10,
      width: inkData.width || 30,
      height: inkData.height || 30,
      inkPoints: inkData.inkPoints || [],
      inkColor: inkData.inkColor || inkColor,
      inkWidth: inkData.inkWidth || inkWidth,
    };

    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
  };

  // Slide Background
  const handleUpdateSlideBackground = (bg: SlideBackground) => {
    pushHistory(presentation);
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, background: bg } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleApplyBgToAll = () => {
    pushHistory(presentation);
    const bg = currentSlide.background;
    const updatedSlides = presentation.slides.map((s) => ({ ...s, background: { ...bg } }));
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
    ui.toast('Đã áp dụng nền cho tất cả trang chiếu');
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

  const handleAddCode = (lang: string = 'typescript') => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `code-${Date.now()}`,
      type: 'code',
      x: 15,
      y: 25,
      width: 70,
      height: 50,
      codeLang: lang,
      codeContent: '// Minh Spark Code Snippet\\nexport function calculateGrowth(rate: number, years: number) {\\n  return Math.pow(1 + rate, years);\\n}',
      placeholder: 'Khối mã nguồn',
    };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn khối mã nguồn');
  };

  const handleAddMath = () => {
    pushHistory(presentation);
    const newEl: SlideElement = {
      id: `math-${Date.now()}`,
      type: 'math',
      x: 20,
      y: 35,
      width: 60,
      height: 25,
      mathFormula: 'f(x) = \\\\int_{-\\\\infty}^\\\\infty \\\\hat{f}(\\\\xi) e^{2\\\\pi i \\\\xi x} d\\\\xi',
    };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
    ui.toast('Đã chèn công thức Toán LaTeX');
  };

  const handleToggleLockElement = () => {
    if (!selectedElement) return;
    const isLocked = !selectedElement.locked;
    updateSlideElement(selectedElement.id, { locked: isLocked });
    ui.toast(isLocked ? 'Đã khóa đối tượng' : 'Đã mở khóa đối tượng');
  };

  const handleAddNewElement = (newEl: SlideElement) => {
    pushHistory(presentation);
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, elements: [...s.elements, newEl] } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    setSelectedElementId(newEl.id);
    triggerAutoSave(newPres);
  };

  const handleAdd3dModel = () => {
    const newEl: SlideElement = {
      id: `el_3d_${Date.now()}`,
      type: '3d',
      x: 25,
      y: 20,
      width: 50,
      height: 60,
      model3d: {
        type: 'cube',
        rotX: 25,
        rotY: -35,
        rotZ: 0,
        zoom: 1,
        color: '#0284C7',
      },
    };
    handleAddNewElement(newEl);
    ui.toast('Đã chèn mô hình 3D xoay 360 độ');
  };

  const handleAddVideo = () => {
    const newEl: SlideElement = {
      id: `el_video_${Date.now()}`,
      type: 'video',
      x: 20,
      y: 20,
      width: 60,
      height: 55,
      videoData: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        trimStart: 0,
        trimEnd: 60,
        autoplay: true,
        loop: true,
        shape: 'rounded',
      },
    };
    handleAddNewElement(newEl);
    ui.toast('Đã chèn Video Studio vào slide');
  };

  const handleAddCountdown = () => {
    const newEl: SlideElement = {
      id: `el_countdown_${Date.now()}`,
      type: 'countdown',
      x: 30,
      y: 30,
      width: 40,
      height: 35,
      countdownData: {
        duration: 300,
        remaining: 300,
        running: false,
        title: 'Thảo luận nhóm: 05:00',
        theme: 'neon',
      },
    };
    handleAddNewElement(newEl);
    ui.toast('Đã chèn widget đồng hồ đếm ngược');
  };

  const handleAddLivePoll = () => {
    const newEl: SlideElement = {
      id: `el_poll_${Date.now()}`,
      type: 'poll',
      x: 20,
      y: 18,
      width: 60,
      height: 64,
      pollData: {
        question: 'Chiến lược trọng tâm của chúng ta trong Q4 là gì?',
        options: [
          { id: 'opt_1', text: 'Tối ưu trải nghiệm AI offline', votes: 42 },
          { id: 'opt_2', text: 'Mở rộng hệ sinh thái Minh Spark Office', votes: 68 },
          { id: 'opt_3', text: 'Bảo mật dữ liệu tuyệt đối & Cloud Sync', votes: 35 },
        ],
        type: 'multiple',
        active: true,
        qrCode: true,
      },
    };
    handleAddNewElement(newEl);
    ui.toast('Đã chèn thẻ bình chọn trực tiếp QR');
  };

  const handleAddSlideZoom = () => {
    const otherSlide = presentation.slides.find((s) => s.id !== currentSlide.id) || currentSlide;
    const newEl: SlideElement = {
      id: `el_zoom_${Date.now()}`,
      type: 'zoom',
      x: 30,
      y: 30,
      width: 40,
      height: 35,
      zoomSlideId: otherSlide.id,
      zoomSlideTitle: otherSlide.elements.find((e) => e.isTitle)?.text || 'Chi tiết Slide liên kết',
    };
    handleAddNewElement(newEl);
    ui.toast('Đã chèn Slide Zoom liên kết trang chiếu');
  };

  const handleMergeShapes = (op: 'union' | 'combine' | 'fragment' | 'intersect' | 'subtract') => {
    if (!selectedElement) return;
    updateSlideElement(selectedElement.id, {
      shapeType: op === 'combine' ? 'callout' : op === 'intersect' ? 'diamond' : op === 'subtract' ? 'star' : 'rounded-rectangle',
      fill: op === 'union' ? '#0284C7' : '#7C3AED',
    });
  };

  const handleCropToShape = (mask: 'none' | 'circle' | 'rounded' | 'hexagon' | 'star' | 'diamond') => {
    if (!selectedElement) return;
    updateSlideElement(selectedElement.id, { imageMask: mask });
  };

  const handleToggleReflection = () => {
    if (!selectedElement) return;
    updateSlideElement(selectedElement.id, { reflection: !selectedElement.reflection });
  };

  const handleBatchGenerateMailMerge = (newSlides: SlideData[]) => {
    setPresentation((prev) => ({
      ...prev,
      slides: [...prev.slides, ...newSlides],
    }));
  };

  const handleApplyBrandTheme = (themeUpdates: Partial<SlideTheme>) => {
    setPresentation((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => ({
        ...s,
        background: themeUpdates.backgroundColor
          ? { type: 'solid', value: themeUpdates.backgroundColor }
          : s.background,
      })),
    }));
  };

  const handleSaveSlideMaster = (master: {
    enabled: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    showSlideNumber?: boolean;
  }) => {
    setPresentation((prev) => ({
      ...prev,
      slideMaster: master,
    }));
  };

  const handleSaveCustomShows = (shows: { id: string; name: string; slideIds: string[] }[]) => {
    setPresentation((prev) => ({
      ...prev,
      customShows: shows,
    }));
  };

  const handleStartCustomShow = (_slideIds: string[]) => {
    setIsSlideShowActive(true);
  };

  const handleApplyDesignerLayout = (newElements: SlideElement[], newBackground?: SlideBackground) => {
    pushHistory(presentation);
    const updatedSlides = presentation.slides.map((s, idx) => {
      if (idx !== activeSlideIndex) return s;
      return {
        ...s,
        elements: newElements,
        background: newBackground || s.background,
      };
    });
    const updatedPres = { ...presentation, slides: updatedSlides };
    setPresentation(updatedPres);
    triggerAutoSave(updatedPres);
    ui.toast('Đã áp dụng bố cục thiết kế từ AI Designer');
  };

  const handleSaveWatermark = () => {
    pushHistory(presentation);
    const updated = {
      ...presentation,
      watermark: {
        text: watermarkText,
        enabled: watermarkEnabled,
        opacity: watermarkOpacity,
      },
    };
    setPresentation(updated);
    triggerAutoSave(updated);
    setIsWatermarkModalOpen(false);
    ui.toast('Đã lưu cấu hình hình mờ bài thuyết trình');
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

  // Transitions & Animations Handlers
  const handleChangeTransition = (type: TransitionType) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, type } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeTransitionDuration = (duration: number) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, duration } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeTransitionDirection = (direction: TransitionDirection) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, direction } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeTransitionSound = (sound: TransitionSound) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, sound } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
    playTransitionSound(sound);
  };

  const handleChangeAdvanceOnClick = (advanceOnClick: boolean) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, advanceOnClick } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeAdvanceAfterSeconds = (advanceAfterSeconds: number) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, advanceAfterSeconds } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeTransitionMorphMode = (morphMode: 'objects' | 'words' | 'characters') => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, morphMode } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleChangeTransitionLoopSound = (loopSound: boolean) => {
    const prevTrans = currentSlide?.transition || { type: 'none', duration: 0.5 };
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, transition: { ...prevTrans, loopSound } } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };

  const handleSetTriggerElementId = (triggerElementId: string) => {
    if (!selectedElement) return;
    const curAnim = selectedElement.animation;
    if (curAnim) {
      updateSlideElement(selectedElement.id, {
        animation: { ...curAnim, trigger: 'on-click' },
      });
    }
    if (selectedElement.animations && selectedElement.animations.length > 0) {
      const updatedAnims = selectedElement.animations.map((a) => ({
        ...a,
        triggerElementId: triggerElementId || undefined,
      }));
      updateSlideElement(selectedElement.id, { animations: updatedAnims });
    }
  };

  const handleToggleHideSlide = () => {
    const isCurHidden = !!currentSlide?.hidden;
    const updatedSlides = presentation.slides.map((s, idx) =>
      idx === activeSlideIndex ? { ...s, hidden: !isCurHidden } : s
    );
    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
  };


  const handlePreviewTransition = () => {
    const sound = currentSlide?.transition?.sound || 'none';
    playTransitionSound(sound);
    setIsPreviewingTransition(true);
    const durMs = Math.max(500, (currentSlide?.transition?.duration || 0.8) * 1000);
    setTimeout(() => {
      setIsPreviewingTransition(false);
    }, durMs);
  };

  const handlePreviewAnimation = () => {
    if (selectedElementId) {
      setPreviewingAnimElementId(selectedElementId);
      setTimeout(() => setPreviewingAnimElementId(null), 1000);
    } else {
      setPreviewingAnimElementId('ALL');
      setTimeout(() => setPreviewingAnimElementId(null), 1200);
    }
  };

  const handleAddAnimation = (type: AnimationType, category: AnimationCategory) => {
    if (!selectedElement) {
      ui.toast('Vui lòng chọn một đối tượng trên trang chiếu trước khi gán hoạt hình');
      return;
    }

    const newAnim: ElementAnimation = {
      id: `anim-${Date.now()}`,
      type,
      category,
      duration: 0.5,
      delay: 0,
      trigger: 'on-click',
      direction: 'bottom',
      order: (selectedElement.animations?.length || 0) + 1,
    };

    const existingAnims = selectedElement.animations || (selectedElement.animation && selectedElement.animation.type !== 'none' ? [{
      id: `anim-prev-${Date.now()}`,
      type: selectedElement.animation.type,
      category: 'entrance' as const,
      duration: selectedElement.animation.duration || 0.5,
      delay: selectedElement.animation.delay || 0,
      trigger: selectedElement.animation.trigger || 'on-click',
      direction: selectedElement.animation.direction || 'bottom',
      order: 1,
    }] : []);

    const updatedAnims = [...existingAnims, newAnim];
    updateSlideElement(selectedElement.id, {
      animations: updatedAnims,
      animation: {
        type,
        duration: 0.5,
        delay: 0,
        direction: 'bottom',
        trigger: 'on-click',
      },
    });

    // Quick visual preview on canvas
    setPreviewingAnimElementId(selectedElement.id);
    setTimeout(() => setPreviewingAnimElementId(null), 800);
    ui.toast(`Đã gán hoạt hình "${type}"`);
  };

  const handleUpdateAnimationTiming = (timing: {
    trigger?: AnimationTrigger;
    duration?: number;
    delay?: number;
    direction?: AnimationDirection;
  }) => {
    if (!selectedElement) return;
    const currentAnim = selectedElement.animation || {
      type: 'fade-in',
      duration: 0.5,
      delay: 0,
      direction: 'bottom',
      trigger: 'on-click',
    };
    const updatedAnim = { ...currentAnim, ...timing };

    let updatedAnims = selectedElement.animations;
    if (updatedAnims && updatedAnims.length > 0) {
      updatedAnims = updatedAnims.map((a, i) => (i === 0 ? { ...a, ...timing } : a));
    }

    updateSlideElement(selectedElement.id, {
      animation: updatedAnim,
      animations: updatedAnims,
    });
  };

  const handleReorderAnimation = (direction: 'earlier' | 'later') => {
    if (!selectedElement || !selectedElement.animations || selectedElement.animations.length <= 1) return;
    const list = [...selectedElement.animations];
    if (direction === 'earlier') {
      const first = list.shift()!;
      list.push(first);
    } else {
      const last = list.pop()!;
      list.unshift(last);
    }
    const reordered = list.map((a, idx) => ({ ...a, order: idx + 1 }));
    updateSlideElement(selectedElement.id, { animations: reordered });
    ui.toast(direction === 'earlier' ? 'Đã di chuyển hoạt hình sớm hơn' : 'Đã di chuyển hoạt hình muộn hơn');
  };

  const handleToggleAnimationPainter = () => {
    if (!selectedElement) return;
    if (animationPainterActive) {
      setAnimationPainterActive(false);
      setCopiedAnimation(null);
      ui.toast('Đã tắt sao chép hoạt hình');
    } else {
      const anim = selectedElement.animations?.[0] || (selectedElement.animation?.type !== 'none' ? {
        id: `anim-copy-${Date.now()}`,
        type: selectedElement.animation!.type,
        category: 'entrance' as const,
        duration: selectedElement.animation!.duration || 0.5,
        delay: selectedElement.animation!.delay || 0,
        trigger: selectedElement.animation!.trigger || 'on-click',
        direction: selectedElement.animation!.direction || 'bottom',
        order: 1,
      } : null);

      if (!anim) {
        ui.toast('Đối tượng này chưa có hoạt hình để sao chép');
        return;
      }
      setCopiedAnimation(anim);
      setAnimationPainterActive(true);
      ui.toast('Đã sao chép hoạt hình. Hãy bấm vào đối tượng khác để áp dụng');
    }
  };

  const handleSelectElementWithPainter = (elId: string | null) => {
    if (animationPainterActive && copiedAnimation && elId && elId !== selectedElementId) {
      updateSlideElement(elId, {
        animations: [{ ...copiedAnimation, id: `anim-${Date.now()}` }],
        animation: {
          type: copiedAnimation.type,
          duration: copiedAnimation.duration,
          delay: copiedAnimation.delay,
          direction: copiedAnimation.direction,
          trigger: copiedAnimation.trigger,
        },
      });
      setPreviewingAnimElementId(elId);
      setTimeout(() => setPreviewingAnimElementId(null), 800);
      ui.toast('Đã dán định dạng hoạt hình vào đối tượng mới!');
      setAnimationPainterActive(false);
      setCopiedAnimation(null);
    }
    setSelectedElementId(elId);
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

  // Find & Replace All
  const handleReplaceAll = (find: string, replaceWith: string, matchCase: boolean) => {
    pushHistory(presentation);
    let count = 0;
    const updatedSlides = presentation.slides.map((s) => ({
      ...s,
      elements: s.elements.map((el) => {
        if (!el.text) return el;
        const flags = matchCase ? 'g' : 'gi';
        const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        const matches = el.text.match(regex);
        if (matches) count += matches.length;
        return { ...el, text: el.text.replace(regex, replaceWith) };
      }),
    }));

    const newPres = { ...presentation, slides: updatedSlides };
    setPresentation(newPres);
    triggerAutoSave(newPres);
    return count;
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
        transitionDuration={currentSlide?.transition.duration ?? 0.5}
        onChangeTransitionDuration={handleChangeTransitionDuration}
        transitionDirection={currentSlide?.transition.direction ?? 'from-bottom'}
        onChangeTransitionDirection={handleChangeTransitionDirection}
        transitionSound={currentSlide?.transition.sound ?? 'none'}
        onChangeTransitionSound={handleChangeTransitionSound}
        advanceOnClick={currentSlide?.transition.advanceOnClick ?? true}
        onChangeAdvanceOnClick={handleChangeAdvanceOnClick}
        advanceAfterSeconds={currentSlide?.transition.advanceAfterSeconds ?? 0}
        onChangeAdvanceAfterSeconds={handleChangeAdvanceAfterSeconds}
        onApplyTransitionToAll={handleApplyTransitionToAll}
        slideElements={currentSlide?.elements || []}
        morphMode={currentSlide?.transition.morphMode || 'objects'}
        onChangeMorphMode={handleChangeTransitionMorphMode}
        loopSound={currentSlide?.transition.loopSound || false}
        onChangeLoopSound={handleChangeTransitionLoopSound}
        onSetTriggerElementId={handleSetTriggerElementId}
        isSlideHidden={!!currentSlide?.hidden}
        onToggleHideSlide={handleToggleHideSlide}
        onPreviewTransition={handlePreviewTransition}
        onPreviewAnimation={handlePreviewAnimation}
        isAnimationPaneOpen={isAnimationPaneOpen}
        onToggleAnimationPane={() => setIsAnimationPaneOpen(!isAnimationPaneOpen)}
        onAddAnimation={handleAddAnimation}
        animationPainterActive={animationPainterActive}
        onToggleAnimationPainter={handleToggleAnimationPainter}
        onUpdateAnimationTiming={handleUpdateAnimationTiming}
        onReorderAnimation={handleReorderAnimation}
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
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler(!showRuler)}
        showGridlines={showGridlines}
        onToggleGridlines={() => setShowGridlines(!showGridlines)}
        showGuides={showGuides}
        onToggleGuides={() => setShowGuides(!showGuides)}
        isFormatPaneOpen={isFormatPaneOpen}
        onToggleFormatPane={() => setIsFormatPaneOpen(!isFormatPaneOpen)}
        onOpenFindReplace={() => setIsFindReplaceOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        drawMode={drawMode}
        onChangeDrawMode={setDrawMode}
        inkColor={inkColor}
        onChangeInkColor={setInkColor}
        inkWidth={inkWidth}
        onChangeInkWidth={setInkWidth}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onAlignElement={handleAlignElement}
        isDesignerOpen={isDesignerOpen}
        onToggleDesigner={() => setIsDesignerOpen(!isDesignerOpen)}
        onAddCode={handleAddCode}
        onAddMath={handleAddMath}
        onToggleLockElement={handleToggleLockElement}
        onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
        onAdd3dModel={handleAdd3dModel}
        onAddVideo={handleAddVideo}
        onAddCountdown={handleAddCountdown}
        onAddLivePoll={handleAddLivePoll}
        onAddSlideZoom={handleAddSlideZoom}
        onOpenMailMerge={() => setIsMailMergeOpen(true)}
        onOpenBrandPalette={() => setIsBrandPaletteOpen(true)}
        onOpenSlideDiff={() => setIsSlideDiffOpen(true)}
        onOpenSlideMaster={() => setIsSlideMasterOpen(true)}
        onOpenLiveSheetsLink={() => setIsSheetsLinkOpen(true)}
        onOpenCustomShows={() => setIsCustomShowsOpen(true)}
        onMergeShapes={handleMergeShapes}
        onCropToShape={handleCropToShape}
        onToggleReflection={handleToggleReflection}
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
              {/* Optional Horizontal Ruler */}
              {showRuler && (
                <div className="ppt-ruler-h-container">
                  <SlideHorizontalRuler aspectRatio={presentation.aspectRatio} zoom={zoom} />
                </div>
              )}

              <div className="ppt-canvas-outer-wrap">
                {/* Optional Vertical Ruler */}
                {showRuler && (
                  <div className="ppt-ruler-v-container">
                    <SlideVerticalRuler aspectRatio={presentation.aspectRatio} zoom={zoom} />
                  </div>
                )}

                <div className="ppt-canvas-container">
                  <SlideCanvas
                    slide={currentSlide}
                    aspectRatio={presentation.aspectRatio}
                    zoom={zoom}
                    selectedElementId={selectedElementId}
                    slideMaster={presentation.slideMaster}
                    slideIndex={activeSlideIndex}
                    onSelectElement={handleSelectElementWithPainter}
                    onUpdateElement={updateSlideElement}
                    onDeleteElement={deleteSlideElement}
                    showGridlines={showGridlines}
                    showGuides={showGuides}
                    drawMode={drawMode}
                    inkColor={inkColor}
                    inkWidth={inkWidth}
                    onAddInkElement={handleAddInkElement}
                    onContextMenu={(e, elId) => {
                      setContextMenuPos({ x: e.clientX, y: e.clientY });
                      setContextMenuElementId(elId);
                    }}
                    isPreviewingTransition={isPreviewingTransition}
                    previewingAnimElementId={previewingAnimElementId}
                    showAnimBadges={activeTab === 'animations' || isAnimationPaneOpen}
                    watermark={presentation.watermark}
                  />
                </div>
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

        {/* Right-Hand Format Inspector Pane */}
        {isFormatPaneOpen && (
          <SlideFormatPane
            selectedElement={selectedElement}
            slide={currentSlide}
            onUpdateElement={(updates) => selectedElementId && updateSlideElement(selectedElementId, updates)}
            onUpdateSlideBackground={handleUpdateSlideBackground}
            onApplyBgToAll={handleApplyBgToAll}
            onClose={() => setIsFormatPaneOpen(false)}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onAlignElement={handleAlignElement}
          />
        )}

        {/* Right-Hand Animation Pane */}
        {isAnimationPaneOpen && (
          <SlideAnimationPane
            slide={currentSlide}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateElement={updateSlideElement}
            onClose={() => setIsAnimationPaneOpen(false)}
            onPlayPreview={handlePreviewAnimation}
            isPlayingPreview={previewingAnimElementId !== null}
          />
        )}

        {/* Right-Hand AI Designer Pane */}
        {isDesignerOpen && (
          <SlideDesignerPane
            slide={currentSlide}
            themeId={presentation.themeId}
            onApplyDesign={handleApplyDesignerLayout}
            onClose={() => setIsDesignerOpen(false)}
          />
        )}
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
            className={`ppt-status-btn ${showRuler ? 'is-active' : ''}`}
            onClick={() => setShowRuler(!showRuler)}
            title="Thước kẻ"
          >
            <Ruler size={13} />
          </button>
          <button
            className={`ppt-status-btn ${showGridlines ? 'is-active' : ''}`}
            onClick={() => setShowGridlines(!showGridlines)}
            title="Đường lưới"
          >
            <Grid size={13} />
          </button>
          <button
            className={`ppt-status-btn ${isFormatPaneOpen ? 'is-active' : ''}`}
            onClick={() => setIsFormatPaneOpen(!isFormatPaneOpen)}
            title="Khung định dạng"
          >
            <Sliders size={13} />
          </button>
          <button
            className={`ppt-status-btn ${isAnimationPaneOpen ? 'is-active' : ''}`}
            onClick={() => setIsAnimationPaneOpen(!isAnimationPaneOpen)}
            title="Ngăn Hoạt hình"
          >
            Ngăn Hoạt hình
          </button>
          <button
            className={`ppt-status-btn ${isDesignerOpen ? 'is-active' : ''}`}
            onClick={() => setIsDesignerOpen(!isDesignerOpen)}
            title="Ý tưởng Thiết kế AI (Slide Designer)"
          >
            Ý tưởng TK
          </button>

          <span style={{ color: '#CBD5E1' }}>|</span>

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
            Chiếu
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

      {/* Floating Context Menu */}
      <SlideContextMenu
        position={contextMenuPos}
        targetElementId={contextMenuElementId}
        canPaste={!!clipboardElement}
        onClose={() => setContextMenuPos(null)}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDuplicate={handleDuplicateElement}
        onDelete={() => contextMenuElementId && deleteSlideElement(contextMenuElementId)}
        onEditText={() => {
          // Double click triggers edit
        }}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onChangeShape={(shape) => {
          if (contextMenuElementId) updateSlideElement(contextMenuElementId, { shapeType: shape });
        }}
        onOpenFormat={() => setIsFormatPaneOpen(true)}
        onOpenAnimation={() => { setActiveTab('animations'); setIsAnimationPaneOpen(true); }}
        onAddSlide={handleAddSlide}
        onDuplicateSlide={() => handleDuplicateSlide(activeSlideIndex)}
      />

      {/* Find & Replace Modal */}
      <SlideFindReplaceModal
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
        presentation={presentation}
        onReplaceAll={handleReplaceAll}
        onNavigateToSlide={(idx) => {
          setActiveSlideIndex(idx);
          setIsFindReplaceOpen(false);
        }}
      />

      {/* Export & Print Modal */}
      <SlideExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        presentation={presentation}
        onExportPptx={() => exportToPptx(presentation, meta.name)}
        onExportPdf={() => {
          ui.toast('Đang chuẩn bị tệp PDF xuất ra...');
          window.print();
        }}
      />

      {/* AI Presentation Copilot Modal */}
      <SlideAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentThemeId={presentation.themeId}
        slides={presentation.slides}
        currentSlideIndex={activeSlideIndex}
        onApplyGeneratedDeck={(newSlides, themeId) => {
          pushHistory(presentation);
          const newPres = { ...presentation, slides: newSlides, themeId };
          setPresentation(newPres);
          setActiveSlideIndex(0);
          triggerAutoSave(newPres);
          ui.toast('AI Copilot đã tạo bài thuyết trình mới hoàn chỉnh!');
        }}
        onUpdateSlideElements={(slideId, elements) => {
          pushHistory(presentation);
          const updatedSlides = presentation.slides.map((s) =>
            s.id === slideId ? { ...s, elements } : s
          );
          const newPres = { ...presentation, slides: updatedSlides };
          setPresentation(newPres);
          triggerAutoSave(newPres);
        }}
        onUpdateSlideBackground={(slideId, bg) => {
          pushHistory(presentation);
          const updatedSlides = presentation.slides.map((s) =>
            s.id === slideId ? { ...s, background: bg } : s
          );
          const newPres = { ...presentation, slides: updatedSlides };
          setPresentation(newPres);
          triggerAutoSave(newPres);
        }}
        onApplyTheme={handleApplyTheme}
        onUpdatePresentationSlides={(newSlides) => {
          pushHistory(presentation);
          const newPres = { ...presentation, slides: newSlides };
          setPresentation(newPres);
          triggerAutoSave(newPres);
        }}
      />

      {/* Watermark Configuration Modal */}
      {isWatermarkModalOpen && (
        <div className="ppt-modal-backdrop" onClick={() => setIsWatermarkModalOpen(false)}>
          <div className="ppt-dialog-card" onClick={(e) => e.stopPropagation()} style={{ width: '440px' }}>
            <div className="ppt-dialog-header">
              <span style={{ fontWeight: 700 }}>Hình Mờ & Bản Quyền (Watermark)</span>
              <button className="ppt-dialog-close-btn" onClick={() => setIsWatermarkModalOpen(false)}>×</button>
            </div>
            <div className="ppt-dialog-body">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Bật hiển thị hình mờ trên toàn bộ bài thuyết trình</span>
              </label>

              <div className="ppt-dialog-field">
                <label style={{ fontWeight: 600 }}>Nội dung chữ hình mờ (Watermark Text):</label>
                <input
                  type="text"
                  className="ppt-input"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Ví dụ: BẢN QUYỀN - MINH SPARK, BẢO MẬT NỘI BỘ..."
                />
              </div>

              <div className="ppt-dialog-field" style={{ marginTop: '12px' }}>
                <label style={{ fontWeight: 600 }}>Độ mờ đục ({Math.round(watermarkOpacity * 100)}%):</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="ppt-dialog-footer">
              <button className="ppt-secondary-action-btn" onClick={() => setIsWatermarkModalOpen(false)}>Huỷ</button>
              <button className="ppt-primary-action-btn" onClick={handleSaveWatermark}>Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* Mail Merge Modal */}
      <SlideMailMergeModal
        isOpen={isMailMergeOpen}
        onClose={() => setIsMailMergeOpen(false)}
        currentSlide={currentSlide}
        onBatchGenerate={handleBatchGenerateMailMerge}
      />

      {/* Brand Palette Modal */}
      <SlideBrandPaletteModal
        isOpen={isBrandPaletteOpen}
        onClose={() => setIsBrandPaletteOpen(false)}
        onApplyBrandTheme={handleApplyBrandTheme}
      />

      {/* Visual Slide Diff Modal */}
      <SlideDiffModal
        isOpen={isSlideDiffOpen}
        onClose={() => setIsSlideDiffOpen(false)}
        slides={presentation.slides}
        currentSlideIndex={activeSlideIndex}
      />

      {/* Slide Master Modal */}
      <SlideMasterModal
        isOpen={isSlideMasterOpen}
        onClose={() => setIsSlideMasterOpen(false)}
        slideMaster={presentation.slideMaster}
        onSaveSlideMaster={handleSaveSlideMaster}
      />

      {/* Live Linked Data from Minh Sheets Modal */}
      <SlideSheetsLinkModal
        isOpen={isSheetsLinkOpen}
        onClose={() => setIsSheetsLinkOpen(false)}
        selectedElement={selectedElement}
        onUpdateElement={updateSlideElement}
      />

      {/* Custom Shows Modal */}
      <SlideCustomShowsModal
        isOpen={isCustomShowsOpen}
        onClose={() => setIsCustomShowsOpen(false)}
        slides={presentation.slides}
        customShows={presentation.customShows}
        onSaveCustomShows={handleSaveCustomShows}
        onStartCustomShow={handleStartCustomShow}
      />

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
          onPrint={() => setIsExportModalOpen(true)}
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
