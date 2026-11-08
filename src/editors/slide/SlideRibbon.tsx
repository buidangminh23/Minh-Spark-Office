import { useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Play,
  Presentation,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  Type,
  Square,
  Circle,
  Triangle,
  ArrowRight,
  Star,
  Table as TableIcon,
  Image as ImageIcon,
  BarChart3,
  PieChart,
  LineChart,
  Layers,
  Palette,
  Sparkles,
  QrCode,
  Trash2,
  Monitor,
  Search,
  Sliders,
  Ruler,
  Grid,
  ChevronDown,
  Printer,
  Volume2,
  Compass,
  CopyCheck,
  Clock,
  Timer,
  MousePointer,
  Paintbrush,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type {
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
} from '../../lib/slideTypes';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { playTransitionSound } from '../../lib/slideAudio';

export interface TransitionItem {
  type: TransitionType;
  label: string;
  icon: string;
  category: 'subtle' | 'exciting' | 'dynamic';
}

export const TRANSITIONS_CATALOGUE: TransitionItem[] = [
  { type: 'none', label: 'Không có', icon: '🚫', category: 'subtle' },
  { type: 'morph', label: 'Biến đổi', icon: '🔄', category: 'subtle' },
  { type: 'fade', label: 'Mờ dần', icon: '🌫️', category: 'subtle' },
  { type: 'push', label: 'Đẩy', icon: '⬆️', category: 'subtle' },
  { type: 'wipe', label: 'Lau', icon: '🧹', category: 'subtle' },
  { type: 'split', label: 'Tách', icon: '↔️', category: 'subtle' },
  { type: 'reveal', label: 'Tiết lộ', icon: '👁️', category: 'subtle' },
  { type: 'cut', label: 'Cắt nhanh', icon: '✂️', category: 'subtle' },
  { type: 'random-bars', label: 'Thanh ngẫu nhiên', icon: '📊', category: 'subtle' },
  { type: 'cover', label: 'Che phủ', icon: '📁', category: 'subtle' },
  { type: 'uncover', label: 'Mở ra', icon: '📂', category: 'subtle' },

  { type: 'flip', label: 'Lật trang', icon: '🔁', category: 'exciting' },
  { type: 'cube', label: 'Khối hộp', icon: '🎲', category: 'exciting' },
  { type: 'doors', label: 'Cánh cửa', icon: '🚪', category: 'exciting' },
  { type: 'box', label: 'Hộp vuông', icon: '📦', category: 'exciting' },
  { type: 'zoom', label: 'Thu phóng', icon: '🔍', category: 'exciting' },
  { type: 'conveyor', label: 'Băng chuyền', icon: '🏭', category: 'exciting' },
  { type: 'rotate', label: 'Xoay tròn', icon: '🌪️', category: 'exciting' },
  { type: 'vortex', label: 'Xoáy nước', icon: '🌀', category: 'exciting' },
  { type: 'ripple', label: 'Gợn sóng', icon: '🌊', category: 'exciting' },
  { type: 'honeycomb', label: 'Tổ ong', icon: '🐝', category: 'exciting' },
  { type: 'fracture', label: 'Vỡ vụn', icon: '💎', category: 'exciting' },

  { type: 'pan', label: 'Lia máy', icon: '🎥', category: 'dynamic' },
  { type: 'ferris', label: 'Đu quay', icon: '🎡', category: 'dynamic' },
  { type: 'carousel', label: 'Băng xoay', icon: '🎠', category: 'dynamic' },
  { type: 'gallery', label: 'Triển lãm', icon: '🖼️', category: 'dynamic' },
];

export interface AnimationItem {
  type: AnimationType;
  label: string;
  icon: string;
  category: AnimationCategory;
}

export const ANIMATIONS_CATALOGUE: AnimationItem[] = [
  { type: 'none', label: 'Không có', icon: '🚫', category: 'entrance' },
  // Entrance (Xuất hiện - 🟢)
  { type: 'appear', label: 'Xuất hiện', icon: '✨', category: 'entrance' },
  { type: 'fade-in', label: 'Mờ dần vào', icon: '🌫️', category: 'entrance' },
  { type: 'fly-in', label: 'Bay vào', icon: '↗️', category: 'entrance' },
  { type: 'float-in', label: 'Nổi vào', icon: '🎈', category: 'entrance' },
  { type: 'split-in', label: 'Tách vào', icon: '↔️', category: 'entrance' },
  { type: 'wipe-in', label: 'Lau vào', icon: '🧹', category: 'entrance' },
  { type: 'zoom-in', label: 'Phóng to vào', icon: '🔍', category: 'entrance' },
  { type: 'bounce-in', label: 'Nảy bật', icon: '⚡', category: 'entrance' },
  { type: 'swivel-in', label: 'Xoay đảo', icon: '🌪️', category: 'entrance' },
  { type: 'wheel-in', label: 'Bánh xe', icon: '☸️', category: 'entrance' },
  { type: 'grow-turn', label: 'Lớn & Xoay', icon: '🌀', category: 'entrance' },

  // Emphasis (Nhấn mạnh - 🟡)
  { type: 'pulse', label: 'Nhấp nháy', icon: '💓', category: 'emphasis' },
  { type: 'spin', label: 'Xoay tròn', icon: '🔄', category: 'emphasis' },
  { type: 'teeter', label: 'Bập bênh', icon: '⚖️', category: 'emphasis' },
  { type: 'grow-shrink', label: 'Phóng to/Thu nhỏ', icon: '↔️', category: 'emphasis' },
  { type: 'color-pulse', label: 'Đổi màu', icon: '🎨', category: 'emphasis' },
  { type: 'wave', label: 'Lượn sóng', icon: '🌊', category: 'emphasis' },
  { type: 'darken', label: 'Làm tối', icon: '🌑', category: 'emphasis' },
  { type: 'lighten', label: 'Làm sáng', icon: '☀️', category: 'emphasis' },

  // Exit (Thoát - 🔴)
  { type: 'disappear', label: 'Biến mất', icon: '💨', category: 'exit' },
  { type: 'fade-out', label: 'Mờ dần ra', icon: '🌫️', category: 'exit' },
  { type: 'fly-out', label: 'Bay ra ngoài', icon: '↘️', category: 'exit' },
  { type: 'float-out', label: 'Nổi ra ngoài', icon: '🎈', category: 'exit' },
  { type: 'split-out', label: 'Tách ra ngoài', icon: '↔️', category: 'exit' },
  { type: 'wipe-out', label: 'Lau đi', icon: '🧹', category: 'exit' },
  { type: 'zoom-out', label: 'Thu nhỏ thoát', icon: '🔍', category: 'exit' },
  { type: 'bounce-out', label: 'Nảy ra ngoài', icon: '⚡', category: 'exit' },
  { type: 'swivel-out', label: 'Xoay thoát', icon: '🌪️', category: 'exit' },

  // Motion Paths (Đường chuyển động - 🟣)
  { type: 'path-line-down', label: 'Thẳng xuống', icon: '⬇️', category: 'motion-path' },
  { type: 'path-line-up', label: 'Thẳng lên', icon: '⬆️', category: 'motion-path' },
  { type: 'path-line-left', label: 'Sang trái', icon: '⬅️', category: 'motion-path' },
  { type: 'path-line-right', label: 'Sang phải', icon: '➡️', category: 'motion-path' },
  { type: 'path-arc', label: 'Đường cong', icon: '⌒', category: 'motion-path' },
  { type: 'path-turn', label: 'Khúc quanh', icon: '⤵️', category: 'motion-path' },
  { type: 'path-circle', label: 'Vòng tròn', icon: '⭕', category: 'motion-path' },
  { type: 'path-loop', label: 'Vòng lặp số 8', icon: '♾️', category: 'motion-path' },
  { type: 'path-custom', label: 'Tùy chỉnh', icon: '✍️', category: 'motion-path' },
];

export const TRANSITION_SOUNDS: { id: TransitionSound; label: string }[] = [
  { id: 'none', label: '[Không có âm thanh]' },
  { id: 'applause', label: 'Tiếng vỗ tay (Applause)' },
  { id: 'camera', label: 'Tiếng máy ảnh (Camera)' },
  { id: 'chime', label: 'Tiếng chuông ngân (Chime)' },
  { id: 'click', label: 'Tiếng bấm chuột (Click)' },
  { id: 'coin', label: 'Tiếng đồng xu (Coin)' },
  { id: 'drum', label: 'Tiếng trống cuộn (Drum)' },
  { id: 'laser', label: 'Tia Laser (Laser)' },
  { id: 'whoosh', label: 'Tiếng vụt qua (Whoosh)' },
  { id: 'wind', label: 'Gió thổi (Wind)' },
  { id: 'bomb', label: 'Tiếng bom nổ (Bomb)' },
  { id: 'typewriter', label: 'Máy đánh chữ (Typewriter)' },
  { id: 'voltage', label: 'Xung điện (Voltage)' },
];

export const TRANSITION_DIRECTIONS: { id: TransitionDirection; label: string }[] = [
  { id: 'from-bottom', label: 'Từ dưới lên' },
  { id: 'from-left', label: 'Từ bên trái' },
  { id: 'from-right', label: 'Từ bên phải' },
  { id: 'from-top', label: 'Từ trên xuống' },
  { id: 'horizontal', label: 'Theo chiều ngang' },
  { id: 'vertical', label: 'Theo chiều dọc' },
  { id: 'in', label: 'Hướng vào trong' },
  { id: 'out', label: 'Hướng ra ngoài' },
];

export const ANIMATION_DIRECTIONS: { id: AnimationDirection; label: string }[] = [
  { id: 'bottom', label: 'Từ dưới lên' },
  { id: 'left', label: 'Từ bên trái qua' },
  { id: 'right', label: 'Từ bên phải qua' },
  { id: 'top', label: 'Từ trên xuống' },
  { id: 'bottom-left', label: 'Từ góc dưới trái' },
  { id: 'bottom-right', label: 'Từ góc dưới phải' },
  { id: 'top-left', label: 'Từ góc trên trái' },
  { id: 'top-right', label: 'Từ góc trên phải' },
];

export const MORPH_MODES: { id: 'objects' | 'words' | 'characters'; label: string; desc: string }[] = [
  { id: 'objects', label: 'Đối tượng (Objects)', desc: 'Khớp nối các hình dạng và đối tượng cùng tên' },
  { id: 'words', label: 'Từ ngữ (Words)', desc: 'Di chuyển và chuyển đổi từng từ ngữ trùng lặp' },
  { id: 'characters', label: 'Ký tự (Characters)', desc: 'Chuyển đổi từng chữ cái và ký tự tương ứng' },
];

export const ANIMATION_SEQUENCES: { id: 'all' | 'paragraph' | 'word'; label: string }[] = [
  { id: 'all', label: 'Như một đối tượng / Cùng lúc' },
  { id: 'paragraph', label: 'Theo từng đoạn / Gạch đầu dòng' },
  { id: 'word', label: 'Theo từng từ ngữ' },
];

export type RibbonTab =
  | 'home'
  | 'insert'
  | 'draw'
  | 'design'
  | 'transitions'
  | 'animations'
  | 'slideshow'
  | 'review'
  | 'view'
  | 'shape-format'
  | 'picture-format'
  | 'table-design'
  | 'chart-design';

interface SlideRibbonProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onOpenFileMenu: () => void;
  selectedElement: SlideElement | null;
  onUpdateSelectedElement: (updates: Partial<SlideElement>) => void;
  onDeleteSelectedElement: () => void;
  onAddSlide: (layout: SlideLayout) => void;
  onAddShape: (shapeType: ShapeType) => void;
  onAddText: () => void;
  onAddTable: (rows: number, cols: number) => void;
  onAddChart: (chartType: ChartType) => void;
  onAddSmartArt: (type: 'process' | 'cycle' | 'pyramid') => void;
  onAddImage: (src: string) => void;
  onAddQrCode: (url: string) => void;
  currentThemeId: string;
  onApplyTheme: (themeId: string) => void;
  aspectRatio: '16:9' | '4:3';
  slideElements?: SlideElement[];
  morphMode?: 'objects' | 'words' | 'characters';
  onChangeMorphMode?: (mode: 'objects' | 'words' | 'characters') => void;
  loopSound?: boolean;
  onChangeLoopSound?: (loop: boolean) => void;
  onSetTriggerElementId?: (id: string) => void;
  onChangeAspectRatio: (ratio: '16:9' | '4:3') => void;
  currentTransition: TransitionType;
  onChangeTransition: (trans: TransitionType) => void;
  transitionDuration?: number;
  onChangeTransitionDuration?: (dur: number) => void;
  transitionDirection?: TransitionDirection;
  onChangeTransitionDirection?: (dir: TransitionDirection) => void;
  transitionSound?: TransitionSound;
  onChangeTransitionSound?: (snd: TransitionSound) => void;
  advanceOnClick?: boolean;
  onChangeAdvanceOnClick?: (val: boolean) => void;
  advanceAfterSeconds?: number;
  onChangeAdvanceAfterSeconds?: (sec: number) => void;
  onApplyTransitionToAll: () => void;
  onPreviewTransition?: () => void;
  onPreviewAnimation?: () => void;
  isAnimationPaneOpen?: boolean;
  onToggleAnimationPane?: () => void;
  onAddAnimation?: (type: AnimationType, category: AnimationCategory) => void;
  animationPainterActive?: boolean;
  onToggleAnimationPainter?: () => void;
  onUpdateAnimationTiming?: (timing: {
    trigger?: AnimationTrigger;
    duration?: number;
    delay?: number;
    direction?: AnimationDirection;
  }) => void;
  onReorderAnimation?: (direction: 'earlier' | 'later') => void;
  onStartSlideShow: (fromCurrent?: boolean) => void;
  onStartPresenterMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewMode: 'normal' | 'sorter';
  onViewModeChange: (mode: 'normal' | 'sorter') => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  showGridlines: boolean;
  onToggleGridlines: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  isFormatPaneOpen: boolean;
  onToggleFormatPane: () => void;
  onOpenFindReplace: () => void;
  onOpenExportModal: () => void;
  onOpenAiModal: () => void;
  drawMode: 'select' | 'pen' | 'highlighter' | 'eraser';
  onChangeDrawMode: (mode: 'select' | 'pen' | 'highlighter' | 'eraser') => void;
  inkColor: string;
  onChangeInkColor: (c: string) => void;
  inkWidth: number;
  onChangeInkWidth: (w: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onAlignElement: (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
}

const FONTS = [
  'Segoe UI',
  'Calibri',
  'Arial',
  'Roboto',
  'Be Vietnam Pro',
  'Montserrat',
  'Playfair Display',
  'Times New Roman',
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96];

export function SlideRibbon(props: SlideRibbonProps) {
  const {
    activeTab,
    onTabChange,
    onOpenFileMenu,
    selectedElement,
    onUpdateSelectedElement,
    onDeleteSelectedElement,
    onAddSlide,
    onAddShape,
    onAddText,
    onAddTable,
    onAddChart,
    onAddSmartArt,
    onAddImage,
    onAddQrCode,
    currentThemeId,
    onApplyTheme,
    aspectRatio,
    slideElements,
    morphMode = 'objects',
    onChangeMorphMode,
    loopSound = false,
    onChangeLoopSound,
    onSetTriggerElementId,
    onChangeAspectRatio,
    currentTransition,
    onChangeTransition,
    transitionDuration = 0.5,
    onChangeTransitionDuration,
    transitionDirection = 'from-bottom',
    onChangeTransitionDirection,
    transitionSound = 'none',
    onChangeTransitionSound,
    advanceOnClick = true,
    onChangeAdvanceOnClick,
    advanceAfterSeconds = 0,
    onChangeAdvanceAfterSeconds,
    onApplyTransitionToAll,
    onPreviewTransition,
    onPreviewAnimation,
    isAnimationPaneOpen = false,
    onToggleAnimationPane,
    onAddAnimation,
    animationPainterActive = false,
    onToggleAnimationPainter,
    onUpdateAnimationTiming,
    onReorderAnimation,
    onStartSlideShow,
    onStartPresenterMode,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    zoom,
    onZoomChange,
    viewMode,
    onViewModeChange,
    showNotes,
    onToggleNotes,
    showRuler,
    onToggleRuler,
    showGridlines,
    onToggleGridlines,
    showGuides,
    onToggleGuides,
    isFormatPaneOpen,
    onToggleFormatPane,
    onOpenFindReplace,
    onOpenExportModal,
    onOpenAiModal,
    drawMode,
    onChangeDrawMode,
    inkColor,
    onChangeInkColor,
    inkWidth,
    onChangeInkWidth,
    onBringToFront,
    onSendToBack,
    onBringForward,
    onSendBackward,
    onAlignElement,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showTransOptionsDropdown, setShowTransOptionsDropdown] = useState(false);
  const [showAnimOptionsDropdown, setShowAnimOptionsDropdown] = useState(false);
  const [showAddAnimDropdown, setShowAddAnimDropdown] = useState(false);
  const [showFullTransGallery, setShowFullTransGallery] = useState(false);
  const [showFullAnimGallery, setShowFullAnimGallery] = useState(false);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  const [transGalleryScrollPos, setTransGalleryScrollPos] = useState(0);
  const [animGalleryScrollPos, setAnimGalleryScrollPos] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAddImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isShapeSelected = selectedElement?.type === 'shape';
  const isImageSelected = selectedElement?.type === 'image';
  const isTableSelected = selectedElement?.type === 'table';
  const isChartSelected = selectedElement?.type === 'chart';

  return (
    <div className="ppt-ribbon-container">
      {/* 1. Ribbon Tabs Bar */}
      <div className="ppt-ribbon-tabs">
        <button
          className="ppt-file-tab-btn"
          onClick={onOpenFileMenu}
          title="Mở menu Tệp (Backstage: Lưu, Tải .pptx, In ấn)"
        >
          <FileText size={16} /> Tệp
        </button>

        <button
          className={`ppt-ribbon-tab ${activeTab === 'home' ? 'is-active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          Trang đầu
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'insert' ? 'is-active' : ''}`}
          onClick={() => onTabChange('insert')}
        >
          Chèn
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'draw' ? 'is-active' : ''}`}
          onClick={() => onTabChange('draw')}
        >
          Vẽ
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'design' ? 'is-active' : ''}`}
          onClick={() => onTabChange('design')}
        >
          Thiết kế
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'transitions' ? 'is-active' : ''}`}
          onClick={() => onTabChange('transitions')}
        >
          Chuyển tiếp
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'animations' ? 'is-active' : ''}`}
          onClick={() => onTabChange('animations')}
        >
          Hoạt hình
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'slideshow' ? 'is-active' : ''}`}
          onClick={() => onTabChange('slideshow')}
        >
          Trình chiếu
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'review' ? 'is-active' : ''}`}
          onClick={() => onTabChange('review')}
        >
          Xem lại
        </button>
        <button
          className={`ppt-ribbon-tab ${activeTab === 'view' ? 'is-active' : ''}`}
          onClick={() => onTabChange('view')}
        >
          Xem
        </button>

        {/* Contextual Tabs when elements selected */}
        {isShapeSelected && (
          <button
            className={`ppt-ribbon-tab is-contextual ${activeTab === 'shape-format' ? 'is-active' : ''}`}
            onClick={() => onTabChange('shape-format')}
          >
            Định dạng Hình dạng
          </button>
        )}
        {isImageSelected && (
          <button
            className={`ppt-ribbon-tab is-contextual ${activeTab === 'picture-format' ? 'is-active' : ''}`}
            onClick={() => onTabChange('picture-format')}
          >
            Định dạng Hình ảnh
          </button>
        )}
        {isTableSelected && (
          <button
            className={`ppt-ribbon-tab is-contextual ${activeTab === 'table-design' ? 'is-active' : ''}`}
            onClick={() => onTabChange('table-design')}
          >
            Thiết kế Bảng
          </button>
        )}
        {isChartSelected && (
          <button
            className={`ppt-ribbon-tab is-contextual ${activeTab === 'chart-design' ? 'is-active' : ''}`}
            onClick={() => onTabChange('chart-design')}
          >
            Thiết kế Biểu đồ
          </button>
        )}

        {/* AI Copilot quick launcher */}
        <button
          className="ppt-ai-launcher-btn"
          onClick={onOpenAiModal}
          title="Trợ lý tạo nội dung bài thuyết trình bằng AI"
        >
          <Sparkles size={14} /> AI Copilot
        </button>
      </div>

      {/* 2. Ribbon Body Toolbar */}
      <div className="ppt-ribbon-body">
        {/* TAB: HOME */}
        {activeTab === 'home' && (
          <>
            {/* Clipboard group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn"
                  disabled={!canUndo}
                  onClick={onUndo}
                  title="Hoàn tác (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="ppt-tool-btn"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Làm lại (Ctrl+Y)"
                >
                  <Redo2 size={16} />
                </button>
              </div>
              <div className="ppt-group-footer">Hoàn tác</div>
            </div>

            {/* Slides group */}
            <div className="ppt-ribbon-group" style={{ position: 'relative' }}>
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={() => onAddSlide('title-content')}
                  title="Thêm trang chiếu mới"
                >
                  <Plus size={20} color="#D83B01" />
                  <span>Trang mới</span>
                </button>
                <button
                  className="ppt-tool-btn"
                  onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                  title="Chọn bố cục trang chiếu"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="ppt-group-footer">Trang chiếu</div>

              {/* Layout Dropdown Menu */}
              {showLayoutDropdown && (
                <div className="ppt-layout-menu" onClick={() => setShowLayoutDropdown(false)}>
                  <div className="ppt-layout-menu-title">Bố cục trang chiếu (Layouts)</div>
                  <div className="ppt-layout-menu-grid">
                    <button onClick={() => onAddSlide('title')}>Trang tiêu đề</button>
                    <button onClick={() => onAddSlide('title-content')}>Tiêu đề & Nội dung</button>
                    <button onClick={() => onAddSlide('section')}>Tiêu đề mục</button>
                    <button onClick={() => onAddSlide('two-content')}>Hai nội dung</button>
                    <button onClick={() => onAddSlide('comparison')}>So sánh</button>
                    <button onClick={() => onAddSlide('title-only')}>Chỉ có tiêu đề</button>
                    <button onClick={() => onAddSlide('blank')}>Trống</button>
                    <button onClick={() => onAddSlide('content-caption')}>Nội dung có chú thích</button>
                    <button onClick={() => onAddSlide('picture-caption')}>Hình ảnh có chú thích</button>
                  </div>
                </div>
              )}
            </div>

            {/* Font group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <select
                    className="ppt-select"
                    style={{ width: '130px' }}
                    value={selectedElement?.fontFamily || 'Segoe UI'}
                    onChange={(e) => onUpdateSelectedElement({ fontFamily: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <select
                    className="ppt-select"
                    style={{ width: '60px' }}
                    value={selectedElement?.fontSize || 20}
                    onChange={(e) => onUpdateSelectedElement({ fontSize: Number(e.target.value) })}
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <button
                    className="ppt-tool-btn"
                    onClick={() => onUpdateSelectedElement({ fontSize: (selectedElement?.fontSize || 20) + 2 })}
                    title="Tăng cỡ chữ"
                  >
                    A⁺
                  </button>
                  <button
                    className="ppt-tool-btn"
                    onClick={() => onUpdateSelectedElement({ fontSize: Math.max(10, (selectedElement?.fontSize || 20) - 2) })}
                    title="Giảm cỡ chữ"
                  >
                    A⁻
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <button
                    className={`ppt-tool-btn ${selectedElement?.fontWeight === 'bold' ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateSelectedElement({
                        fontWeight: selectedElement?.fontWeight === 'bold' ? 'normal' : 'bold',
                      })
                    }
                    title="Đậm (Ctrl+B)"
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    className={`ppt-tool-btn ${selectedElement?.fontStyle === 'italic' ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateSelectedElement({
                        fontStyle: selectedElement?.fontStyle === 'italic' ? 'normal' : 'italic',
                      })
                    }
                    title="Nghiêng (Ctrl+I)"
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    className={`ppt-tool-btn ${selectedElement?.textDecoration === 'underline' ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateSelectedElement({
                        textDecoration: selectedElement?.textDecoration === 'underline' ? 'none' : 'underline',
                      })
                    }
                    title="Gạch chân (Ctrl+U)"
                  >
                    <Underline size={15} />
                  </button>
                  <button
                    className={`ppt-tool-btn ${selectedElement?.textShadow ? 'is-active' : ''}`}
                    onClick={() => onUpdateSelectedElement({ textShadow: !selectedElement?.textShadow })}
                    title="Đổ bóng văn bản"
                  >
                    <span style={{ fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.4)' }}>S</span>
                  </button>

                  <label className="ppt-color-picker-btn" title="Màu chữ">
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>A</span>
                    <span className="ppt-color-bar" style={{ background: selectedElement?.color || '#1E293B' }} />
                    <input
                      type="color"
                      hidden
                      value={selectedElement?.color || '#1E293B'}
                      onChange={(e) => onUpdateSelectedElement({ color: e.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div className="ppt-group-footer">Phông chữ</div>
            </div>

            {/* Paragraph group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className={`ppt-tool-btn ${selectedElement?.textAlign === 'left' ? 'is-active' : ''}`}
                  onClick={() => onUpdateSelectedElement({ textAlign: 'left' })}
                  title="Căn trái"
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  className={`ppt-tool-btn ${selectedElement?.textAlign === 'center' ? 'is-active' : ''}`}
                  onClick={() => onUpdateSelectedElement({ textAlign: 'center' })}
                  title="Căn giữa"
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  className={`ppt-tool-btn ${selectedElement?.textAlign === 'right' ? 'is-active' : ''}`}
                  onClick={() => onUpdateSelectedElement({ textAlign: 'right' })}
                  title="Căn phải"
                >
                  <AlignRight size={16} />
                </button>
                <button
                  className={`ppt-tool-btn ${selectedElement?.textAlign === 'justify' ? 'is-active' : ''}`}
                  onClick={() => onUpdateSelectedElement({ textAlign: 'justify' })}
                  title="Căn đều hai bên"
                >
                  <AlignJustify size={16} />
                </button>
                <button
                  className={`ppt-tool-btn ${selectedElement?.isBullet ? 'is-active' : ''}`}
                  onClick={() => onUpdateSelectedElement({ isBullet: !selectedElement?.isBullet })}
                  title="Dấu đầu dòng (Bullets)"
                >
                  <List size={16} />
                </button>
              </div>
              <div className="ppt-group-footer">Đoạn văn</div>
            </div>

            {/* Quick Drawing group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn" onClick={() => onAddShape('rectangle')} title="Hình chữ nhật">
                  <Square size={16} />
                </button>
                <button className="ppt-tool-btn" onClick={() => onAddShape('rounded-rectangle')} title="Hình bo góc">
                  <Square size={16} style={{ borderRadius: '4px' }} />
                </button>
                <button className="ppt-tool-btn" onClick={() => onAddShape('circle')} title="Hình tròn">
                  <Circle size={16} />
                </button>
                <button className="ppt-tool-btn" onClick={() => onAddShape('triangle')} title="Hình tam giác">
                  <Triangle size={16} />
                </button>
                <button className="ppt-tool-btn" onClick={() => onAddShape('right-arrow')} title="Mũi tên phải">
                  <ArrowRight size={16} />
                </button>
                <button className="ppt-tool-btn" onClick={() => onAddShape('star')} title="Ngôi sao">
                  <Star size={16} />
                </button>
              </div>
              <div className="ppt-group-footer">Hình vẽ</div>
            </div>

            {/* Editing / Find & Format */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={onOpenFindReplace} title="Tìm kiếm & Thay thế (Ctrl+F)">
                  <Search size={18} color="#0078D4" />
                  <span>Tìm kiếm</span>
                </button>
                <button
                  className={`ppt-tool-btn-large ${isFormatPaneOpen ? 'is-active' : ''}`}
                  onClick={onToggleFormatPane}
                  title="Bật/tắt Khung Định dạng chuyên sâu"
                >
                  <Sliders size={18} color="#D83B01" />
                  <span>Định dạng</span>
                </button>
              </div>
              <div className="ppt-group-footer">Chỉnh sửa</div>
            </div>

            {/* Delete button */}
            {selectedElement && (
              <div className="ppt-ribbon-group">
                <div className="ppt-group-content">
                  <button
                    className="ppt-tool-btn"
                    style={{ color: '#EF4444' }}
                    onClick={onDeleteSelectedElement}
                    title="Xoá phần tử đang chọn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="ppt-group-footer">Xoá</div>
              </div>
            )}
          </>
        )}

        {/* TAB: INSERT */}
        {activeTab === 'insert' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={() => onAddSlide('title-content')}>
                  <Plus size={20} color="#D83B01" />
                  <span>Trang mới</span>
                </button>
              </div>
              <div className="ppt-group-footer">Trang chiếu</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={() => onAddTable(4, 4)} title="Chèn bảng 4x4">
                  <TableIcon size={20} color="#0078D4" />
                  <span>Bảng</span>
                </button>
              </div>
              <div className="ppt-group-footer">Bảng biểu</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <label className="ppt-tool-btn-large" style={{ cursor: 'pointer' }} title="Tải ảnh từ máy tính">
                  <ImageIcon size={20} color="#107C41" />
                  <span>Hình ảnh</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              <div className="ppt-group-footer">Hình ảnh</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={() => onAddChart('column')} title="Biểu đồ Cột">
                  <BarChart3 size={20} color="#F59E0B" />
                  <span>Cột</span>
                </button>
                <button className="ppt-tool-btn-large" onClick={() => onAddChart('line')} title="Biểu đồ Đường">
                  <LineChart size={20} color="#3B82F6" />
                  <span>Đường</span>
                </button>
                <button className="ppt-tool-btn-large" onClick={() => onAddChart('pie')} title="Biểu đồ Tròn">
                  <PieChart size={20} color="#EC4899" />
                  <span>Tròn</span>
                </button>
              </div>
              <div className="ppt-group-footer">Biểu đồ</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={() => onAddSmartArt('process')} title="Quy trình 4 bước">
                  <Layers size={20} color="#8B5CF6" />
                  <span>Quy trình</span>
                </button>
                <button className="ppt-tool-btn-large" onClick={() => onAddSmartArt('cycle')} title="Vòng tuần hoàn">
                  <Layers size={20} color="#059669" />
                  <span>Vòng tròn</span>
                </button>
              </div>
              <div className="ppt-group-footer">SmartArt</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn-large" onClick={onAddText} title="Chèn hộp văn bản tự do">
                  <Type size={20} color="#0F172A" />
                  <span>Hộp chữ</span>
                </button>
                <button
                  className="ppt-tool-btn-large"
                  onClick={() => onAddQrCode('https://office.minhspark.com')}
                  title="Tạo mã QR cho buổi thuyết trình"
                >
                  <QrCode size={20} color="#1E293B" />
                  <span>Mã QR</span>
                </button>
              </div>
              <div className="ppt-group-footer">Văn bản & Mã</div>
            </div>
          </>
        )}

        {/* TAB: DRAW */}
        {activeTab === 'draw' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className={`ppt-tool-btn-large ${drawMode === 'select' ? 'is-active' : ''}`}
                  onClick={() => onChangeDrawMode('select')}
                  title="Con trỏ chọn & di chuyển đối tượng"
                >
                  <span style={{ fontSize: '18px' }}>↖️</span>
                  <span>Chọn</span>
                </button>
                <button
                  className={`ppt-tool-btn-large ${drawMode === 'pen' ? 'is-active' : ''}`}
                  onClick={() => onChangeDrawMode('pen')}
                  title="Bút mực tự do"
                >
                  <span style={{ fontSize: '18px' }}>✍️</span>
                  <span>Bút vẽ</span>
                </button>
                <button
                  className={`ppt-tool-btn-large ${drawMode === 'highlighter' ? 'is-active' : ''}`}
                  onClick={() => onChangeDrawMode('highlighter')}
                  title="Bút dạ quang đánh dấu"
                >
                  <span style={{ fontSize: '18px' }}>🖍️</span>
                  <span>Dạ quang</span>
                </button>
                <button
                  className={`ppt-tool-btn-large ${drawMode === 'eraser' ? 'is-active' : ''}`}
                  onClick={() => onChangeDrawMode('eraser')}
                  title="Tẩy nét mực"
                >
                  <span style={{ fontSize: '18px' }}>🧹</span>
                  <span>Tẩy nét</span>
                </button>
              </div>
              <div className="ppt-group-footer">Công cụ vẽ</div>
            </div>

            {/* Ink color presets */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                {['#000000', '#0078D4', '#D83B01', '#107C41', '#8E2DE2', '#F59E0B'].map((c) => (
                  <button
                    key={c}
                    className="ppt-tool-btn"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c,
                      border: inkColor === c ? '2px solid #000' : '1px solid #CBD5E1',
                      padding: 0,
                    }}
                    onClick={() => {
                      onChangeInkColor(c);
                      onChangeDrawMode('pen');
                    }}
                    title={`Màu ${c}`}
                  />
                ))}
              </div>
              <div className="ppt-group-footer">Bảng màu mực</div>
            </div>

            {/* Thickness */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                {[1, 2, 4, 8].map((w) => (
                  <button
                    key={w}
                    className={`ppt-tool-btn ${inkWidth === w ? 'is-active' : ''}`}
                    onClick={() => onChangeInkWidth(w)}
                    title={`Độ dày ${w}px`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
              <div className="ppt-group-footer">Cỡ nét</div>
            </div>
          </>
        )}

        {/* TAB: DESIGN */}
        {activeTab === 'design' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content" style={{ gap: '8px' }}>
                {Object.values(SLIDE_THEMES).map((th) => (
                  <button
                    key={th.id}
                    className="ppt-theme-card-btn"
                    style={{
                      border: th.id === currentThemeId ? '2px solid #D83B01' : '1px solid #CBD5E1',
                      background: th.backgroundColor,
                    }}
                    onClick={() => onApplyTheme(th.id)}
                    title={th.name}
                  >
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: th.primaryColor }} />
                    <span style={{ fontSize: '9px', fontWeight: 600, color: th.titleColor, marginTop: '2px' }}>
                      {th.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ppt-group-footer">Bộ chủ đề (Themes)</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className={`ppt-tool-btn ${aspectRatio === '16:9' ? 'is-active' : ''}`}
                  onClick={() => onChangeAspectRatio('16:9')}
                  title="Tỉ lệ 16:9 màn hình rộng"
                >
                  16:9 (Rộng)
                </button>
                <button
                  className={`ppt-tool-btn ${aspectRatio === '4:3' ? 'is-active' : ''}`}
                  onClick={() => onChangeAspectRatio('4:3')}
                  title="Tỉ lệ 4:3 truyền thống"
                >
                  4:3 (Chuẩn)
                </button>
              </div>
              <div className="ppt-group-footer">Kích cỡ trang chiếu</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={onToggleFormatPane}
                  title="Mở khung Định dạng Nền trang chiếu"
                >
                  <Palette size={20} color="#D83B01" />
                  <span>Định dạng Nền</span>
                </button>
              </div>
              <div className="ppt-group-footer">Tùy biến</div>
            </div>
          </>
        )}

        {/* TAB: TRANSITIONS */}
        {activeTab === 'transitions' && (
          <>
            {/* 1. Preview Group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={onPreviewTransition}
                  title="Xem trước hiệu ứng chuyển tiếp của trang chiếu này"
                >
                  <Play size={20} color="#0078D4" fill="#0078D4" />
                  <span>Xem trước</span>
                </button>
              </div>
              <div className="ppt-group-footer">Xem trước</div>
            </div>

            {/* 2. Transition Gallery & Effect Options */}
            <div className="ppt-ribbon-group" style={{ position: 'relative' }}>
              <div className="ppt-group-content" style={{ alignItems: 'center' }}>
                {/* Office Ribbon Gallery Container with Navigation Strip */}
                <div className="ppt-ribbon-gallery-shell">
                  <div className="ppt-ribbon-gallery-cards">
                    {TRANSITIONS_CATALOGUE.slice(transGalleryScrollPos, transGalleryScrollPos + 5).map((t) => (
                      <button
                        key={t.type}
                        className={`ppt-gallery-card-btn ${currentTransition === t.type ? 'is-active' : ''}`}
                        onClick={() => onChangeTransition(t.type)}
                        title={`${t.label} (${t.type})`}
                      >
                        <span className="ppt-gallery-card-icon">{t.icon}</span>
                        <span className="ppt-gallery-card-label">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 3-Button Ribbon Expander Strip (Up, Down, More) */}
                  <div className="ppt-ribbon-gallery-controls">
                    <button
                      className="ppt-gallery-scroll-btn"
                      disabled={transGalleryScrollPos === 0}
                      onClick={() => setTransGalleryScrollPos((p) => Math.max(0, p - 2))}
                      title="Cuộn lên"
                    >
                      ▲
                    </button>
                    <button
                      className="ppt-gallery-scroll-btn"
                      disabled={transGalleryScrollPos + 5 >= TRANSITIONS_CATALOGUE.length}
                      onClick={() => setTransGalleryScrollPos((p) => Math.min(TRANSITIONS_CATALOGUE.length - 5, p + 2))}
                      title="Cuộn xuống"
                    >
                      ▼
                    </button>
                    <button
                      className={`ppt-gallery-scroll-btn is-more ${showFullTransGallery ? 'is-open' : ''}`}
                      onClick={() => setShowFullTransGallery(!showFullTransGallery)}
                      title="Mở toàn bộ thư viện chuyển tiếp"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>

                {/* Full Gallery Popover Dropdown */}
                {showFullTransGallery && (
                  <div className="ppt-full-gallery-popover" onMouseLeave={() => setShowFullTransGallery(false)}>
                    <div className="ppt-full-gallery-section">
                      <div className="ppt-full-gallery-title">TẤT CẢ HIỆU ỨNG CHUYỂN TIẾP TRANG CHIẾU</div>

                      {/* Subtle group */}
                      <div className="ppt-gallery-group-header">Nhẹ nhàng (Subtle)</div>
                      <div className="ppt-full-gallery-grid">
                        {TRANSITIONS_CATALOGUE.filter((t) => t.category === 'subtle').map((t) => (
                          <button
                            key={t.type}
                            className={`ppt-full-card-btn ${currentTransition === t.type ? 'is-active' : ''}`}
                            onClick={() => {
                              onChangeTransition(t.type);
                              setShowFullTransGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{t.icon}</span>
                            <span className="ppt-full-card-label">{t.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Exciting group */}
                      <div className="ppt-gallery-group-header">Hào nhoáng & Thú vị (Exciting)</div>
                      <div className="ppt-full-gallery-grid">
                        {TRANSITIONS_CATALOGUE.filter((t) => t.category === 'exciting').map((t) => (
                          <button
                            key={t.type}
                            className={`ppt-full-card-btn ${currentTransition === t.type ? 'is-active' : ''}`}
                            onClick={() => {
                              onChangeTransition(t.type);
                              setShowFullTransGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{t.icon}</span>
                            <span className="ppt-full-card-label">{t.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Dynamic Content group */}
                      <div className="ppt-gallery-group-header">Nội dung Động (Dynamic Content)</div>
                      <div className="ppt-full-gallery-grid">
                        {TRANSITIONS_CATALOGUE.filter((t) => t.category === 'dynamic').map((t) => (
                          <button
                            key={t.type}
                            className={`ppt-full-card-btn ${currentTransition === t.type ? 'is-active' : ''}`}
                            onClick={() => {
                              onChangeTransition(t.type);
                              setShowFullTransGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{t.icon}</span>
                            <span className="ppt-full-card-label">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <span style={{ width: '1px', height: '54px', background: '#E2E8F0', margin: '0 4px' }} />

                {/* Effect Options Button */}
                <div style={{ position: 'relative' }}>
                  <button
                    className={`ppt-tool-btn-large ${showTransOptionsDropdown ? 'is-active' : ''}`}
                    onClick={() => setShowTransOptionsDropdown(!showTransOptionsDropdown)}
                    title="Tùy chọn hiệu ứng chuyển tiếp"
                  >
                    <Compass size={20} color="#0078D4" />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Tùy chọn <ChevronDown size={11} />
                    </span>
                  </button>

                  {showTransOptionsDropdown && (
                    <div
                      className="ppt-anim-dropdown-menu"
                      style={{ minWidth: '220px' }}
                      onMouseLeave={() => setShowTransOptionsDropdown(false)}
                    >
                      {currentTransition === 'morph' ? (
                        <>
                          <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#0078D4' }}>
                            TÙY CHỌN BIẾN ĐỔI (MORPH)
                          </div>
                          {MORPH_MODES.map((m) => (
                            <button
                              key={m.id}
                              className={`ppt-anim-drop-item ${morphMode === m.id ? 'is-active' : ''}`}
                              onClick={() => {
                                onChangeMorphMode?.(m.id);
                                setShowTransOptionsDropdown(false);
                              }}
                            >
                              <span>{morphMode === m.id ? '✓' : '•'}</span>
                              <div style={{ textAlign: 'left' }}>
                                <div>{m.label}</div>
                                <div style={{ fontSize: '10px', color: '#64748B' }}>{m.desc}</div>
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                            HƯỚNG HIỆU ỨNG
                          </div>
                          {TRANSITION_DIRECTIONS.map((dir) => (
                            <button
                              key={dir.id}
                              className={`ppt-anim-drop-item ${transitionDirection === dir.id ? 'is-active' : ''}`}
                              onClick={() => {
                                onChangeTransitionDirection?.(dir.id);
                                setShowTransOptionsDropdown(false);
                              }}
                            >
                              <span>{transitionDirection === dir.id ? '✓' : '•'}</span>
                              <span>{dir.label}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="ppt-group-footer">Chuyển tiếp tới Trang chiếu này</div>
            </div>

            {/* 3. Timing Controls */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <div className="ppt-timing-grid">
                  {/* Sound picker */}
                  <div className="ppt-timing-row">
                    <span className="ppt-timing-label">
                      <Volume2 size={13} color="#64748B" /> Âm thanh:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <select
                        className="ppt-select-control"
                        value={transitionSound}
                        onChange={(e) => onChangeTransitionSound?.(e.target.value as TransitionSound)}
                        title="Âm thanh khi chuyển trang chiếu"
                      >
                        {TRANSITION_SOUNDS.map((snd) => (
                          <option key={snd.id} value={snd.id}>
                            {snd.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ppt-stepper-btn"
                        disabled={transitionSound === 'none'}
                        onClick={() => playTransitionSound(transitionSound || 'none')}
                        title="Nghe thử âm thanh chuyển tiếp"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {/* Duration stepper */}
                  <div className="ppt-timing-row">
                    <span className="ppt-timing-label">
                      <Clock size={13} color="#64748B" /> Thời lượng:
                    </span>
                    <div className="ppt-stepper-control">
                      <button
                        className="ppt-stepper-btn"
                        onClick={() => onChangeTransitionDuration?.(Math.max(0.1, Number((transitionDuration - 0.25).toFixed(2))))}
                        title="Giảm thời lượng"
                      >
                        -
                      </button>
                      <span className="ppt-stepper-value">{transitionDuration.toFixed(2)}s</span>
                      <button
                        className="ppt-stepper-btn"
                        onClick={() => onChangeTransitionDuration?.(Math.min(10.0, Number((transitionDuration + 0.25).toFixed(2))))}
                        title="Tăng thời lượng"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Loop sound */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer', marginTop: '2px' }}>
                    <input
                      type="checkbox"
                      checked={loopSound}
                      onChange={(e) => onChangeLoopSound?.(e.target.checked)}
                    />
                    <span>Lặp lại cho đến âm thanh sau</span>
                  </label>
                </div>

                <span style={{ width: '1px', height: '54px', background: '#E2E8F0', margin: '0 4px' }} />

                {/* Apply to All */}
                <button
                  className="ppt-tool-btn-large"
                  onClick={onApplyTransitionToAll}
                  title="Áp dụng kiểu chuyển tiếp, âm thanh và thời lượng cho toàn bộ bài thuyết trình"
                >
                  <CopyCheck size={20} color="#107C41" />
                  <span>Áp dụng tất cả</span>
                </button>
              </div>
              <div className="ppt-group-footer">Định thời gian</div>
            </div>

            {/* 4. Advance Slide */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <div className="ppt-advance-slide-col">
                  <label className="ppt-checkbox-label" title="Chuyển trang khi bấm chuột hoặc phím cách">
                    <input
                      type="checkbox"
                      checked={advanceOnClick}
                      onChange={(e) => onChangeAdvanceOnClick?.(e.target.checked)}
                    />
                    <span>Khi bấm chuột</span>
                  </label>
                  <label className="ppt-checkbox-label" title="Tự động chuyển trang sau số giây thiết lập">
                    <input
                      type="checkbox"
                      checked={advanceAfterSeconds > 0}
                      onChange={(e) => onChangeAdvanceAfterSeconds?.(e.target.checked ? 3 : 0)}
                    />
                    <span>Sau:</span>
                    <div className="ppt-stepper-control" style={{ marginLeft: '4px' }}>
                      <button
                        className="ppt-stepper-btn"
                        disabled={advanceAfterSeconds <= 0}
                        onClick={() => onChangeAdvanceAfterSeconds?.(Math.max(0, advanceAfterSeconds - 1))}
                      >
                        -
                      </button>
                      <span className="ppt-stepper-value" style={{ minWidth: '32px' }}>
                        {advanceAfterSeconds}s
                      </span>
                      <button
                        className="ppt-stepper-btn"
                        onClick={() => onChangeAdvanceAfterSeconds?.(advanceAfterSeconds + 1)}
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>
              </div>
              <div className="ppt-group-footer">Nâng cao trang chiếu</div>
            </div>
          </>
        )}

        {/* TAB: ANIMATIONS */}
        {activeTab === 'animations' && (
          <>
            {/* 1. Preview Group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={onPreviewAnimation}
                  title="Xem trước hoạt hình trên trang chiếu hiện tại"
                >
                  <Play size={20} color="#107C41" fill="#107C41" />
                  <span>Xem trước</span>
                </button>
              </div>
              <div className="ppt-group-footer">Xem trước</div>
            </div>

            {/* 2. Animation Gallery with Up/Down/More & Effect Options */}
            <div className="ppt-ribbon-group" style={{ position: 'relative' }}>
              <div className="ppt-group-content" style={{ alignItems: 'center' }}>
                {/* Ribbon Gallery Container */}
                <div className="ppt-ribbon-gallery-shell">
                  <div className="ppt-ribbon-gallery-cards">
                    {ANIMATIONS_CATALOGUE.slice(animGalleryScrollPos, animGalleryScrollPos + 5).map((a) => {
                      const isCurrent =
                        selectedElement?.animation?.type === a.type ||
                        selectedElement?.animations?.some((anim) => anim.type === a.type);
                      return (
                        <button
                          key={a.type}
                          className={`ppt-gallery-card-btn ${isCurrent ? 'is-active-anim' : ''}`}
                          onClick={() => {
                            if (onAddAnimation) {
                              onAddAnimation(a.type, a.category);
                            } else {
                              onUpdateSelectedElement({
                                animation: {
                                  type: a.type,
                                  duration: 0.5,
                                  delay: 0,
                                  direction: 'bottom',
                                  trigger: 'on-click',
                                },
                              });
                            }
                          }}
                          title={`${a.label} (${a.type})`}
                        >
                          <span className="ppt-gallery-card-icon">{a.icon}</span>
                          <span className="ppt-gallery-card-label">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3-Button Ribbon Expander Strip (Up, Down, More) */}
                  <div className="ppt-ribbon-gallery-controls">
                    <button
                      className="ppt-gallery-scroll-btn"
                      disabled={animGalleryScrollPos === 0}
                      onClick={() => setAnimGalleryScrollPos((p) => Math.max(0, p - 2))}
                      title="Cuộn lên"
                    >
                      ▲
                    </button>
                    <button
                      className="ppt-gallery-scroll-btn"
                      disabled={animGalleryScrollPos + 5 >= ANIMATIONS_CATALOGUE.length}
                      onClick={() => setAnimGalleryScrollPos((p) => Math.min(ANIMATIONS_CATALOGUE.length - 5, p + 2))}
                      title="Cuộn xuống"
                    >
                      ▼
                    </button>
                    <button
                      className={`ppt-gallery-scroll-btn is-more ${showFullAnimGallery ? 'is-open' : ''}`}
                      onClick={() => setShowFullAnimGallery(!showFullAnimGallery)}
                      title="Mở toàn bộ thư viện hoạt hình 4 nhóm"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>

                {/* Full Categorized Animation Popover Menu */}
                {showFullAnimGallery && (
                  <div className="ppt-full-gallery-popover" onMouseLeave={() => setShowFullAnimGallery(false)}>
                    <div className="ppt-full-gallery-section">
                      <div className="ppt-full-gallery-title">THƯ VIỆN HOẠT HÌNH MICROSOFT POWERPOINT</div>

                      {/* Entrance 🟢 */}
                      <div className="ppt-gallery-group-header is-entrance">🟢 Lối vào (Entrance)</div>
                      <div className="ppt-full-gallery-grid">
                        {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'entrance').map((a) => (
                          <button
                            key={a.type}
                            className="ppt-full-card-btn is-entrance"
                            onClick={() => {
                              onAddAnimation?.(a.type, 'entrance');
                              setShowFullAnimGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{a.icon}</span>
                            <span className="ppt-full-card-label">{a.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Emphasis 🟡 */}
                      <div className="ppt-gallery-group-header is-emphasis">🟡 Nhấn mạnh (Emphasis)</div>
                      <div className="ppt-full-gallery-grid">
                        {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'emphasis').map((a) => (
                          <button
                            key={a.type}
                            className="ppt-full-card-btn is-emphasis"
                            onClick={() => {
                              onAddAnimation?.(a.type, 'emphasis');
                              setShowFullAnimGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{a.icon}</span>
                            <span className="ppt-full-card-label">{a.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Exit 🔴 */}
                      <div className="ppt-gallery-group-header is-exit">🔴 Lối thoát (Exit)</div>
                      <div className="ppt-full-gallery-grid">
                        {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'exit').map((a) => (
                          <button
                            key={a.type}
                            className="ppt-full-card-btn is-exit"
                            onClick={() => {
                              onAddAnimation?.(a.type, 'exit');
                              setShowFullAnimGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{a.icon}</span>
                            <span className="ppt-full-card-label">{a.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Motion Paths 🟣 */}
                      <div className="ppt-gallery-group-header is-motion-path">🟣 Đường chuyển động (Motion Paths)</div>
                      <div className="ppt-full-gallery-grid">
                        {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'motion-path').map((a) => (
                          <button
                            key={a.type}
                            className="ppt-full-card-btn is-motion-path"
                            onClick={() => {
                              onAddAnimation?.(a.type, 'motion-path');
                              setShowFullAnimGallery(false);
                            }}
                          >
                            <span className="ppt-full-card-icon">{a.icon}</span>
                            <span className="ppt-full-card-label">{a.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <span style={{ width: '1px', height: '54px', background: '#E2E8F0', margin: '0 4px' }} />

                {/* Effect Options Dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    className={`ppt-tool-btn-large ${showAnimOptionsDropdown ? 'is-active' : ''}`}
                    disabled={!selectedElement}
                    onClick={() => setShowAnimOptionsDropdown(!showAnimOptionsDropdown)}
                    title="Tùy chọn hướng và trình tự hoạt hình"
                  >
                    <Compass size={20} color="#D83B01" />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Tùy chọn <ChevronDown size={11} />
                    </span>
                  </button>

                  {showAnimOptionsDropdown && (
                    <div
                      className="ppt-anim-dropdown-menu"
                      style={{ minWidth: '220px' }}
                      onMouseLeave={() => setShowAnimOptionsDropdown(false)}
                    >
                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                        HƯỚNG HOẠT HÌNH
                      </div>
                      {ANIMATION_DIRECTIONS.map((dir) => (
                        <button
                          key={dir.id}
                          className={`ppt-anim-drop-item ${
                            selectedElement?.animation?.direction === dir.id ? 'is-active' : ''
                          }`}
                          onClick={() => {
                            onUpdateAnimationTiming?.({ direction: dir.id });
                            setShowAnimOptionsDropdown(false);
                          }}
                        >
                          <span>{selectedElement?.animation?.direction === dir.id ? '✓' : '•'}</span>
                          <span>{dir.label}</span>
                        </button>
                      ))}

                      {selectedElement?.text && (
                        <>
                          <div className="ppt-ctx-divider" />
                          <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                            TRÌNH TỰ VĂN BẢN
                          </div>
                          {ANIMATION_SEQUENCES.map((seq) => (
                            <button
                              key={seq.id}
                              className="ppt-anim-drop-item"
                              onClick={() => {
                                onUpdateSelectedElement({
                                  animation: {
                                    ...(selectedElement.animation || { type: 'fade-in', duration: 0.5, delay: 0 }),
                                    direction: selectedElement.animation?.direction || 'bottom',
                                  },
                                });
                                setShowAnimOptionsDropdown(false);
                              }}
                            >
                              <span>•</span>
                              <span>{seq.label}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="ppt-group-footer">Hoạt hình đối tượng</div>
            </div>

            {/* 3. Advanced Animation Group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                {/* Add Animation */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="ppt-tool-btn-large"
                    disabled={!selectedElement}
                    onClick={() => setShowAddAnimDropdown(!showAddAnimDropdown)}
                    title="Thêm thêm hoạt hình cho phần tử đã chọn mà không ghi đè"
                  >
                    <Plus size={20} color="#107C41" />
                    <span>Thêm hoạt hình</span>
                  </button>

                  {showAddAnimDropdown && (
                    <div
                      className="ppt-anim-dropdown-menu"
                      style={{ minWidth: '240px', maxHeight: '320px', overflowY: 'auto' }}
                      onMouseLeave={() => setShowAddAnimDropdown(false)}
                    >
                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#107C41' }}>
                        🟢 XUẤT HIỆN (ENTRANCE)
                      </div>
                      {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'entrance' && a.type !== 'none').map((a) => (
                        <button
                          key={a.type}
                          className="ppt-anim-drop-item"
                          onClick={() => {
                            onAddAnimation?.(a.type, 'entrance');
                            setShowAddAnimDropdown(false);
                          }}
                        >
                          <span>{a.icon}</span> <span>{a.label}</span>
                        </button>
                      ))}

                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#D97706' }}>
                        🟡 NHẤN MẠNH (EMPHASIS)
                      </div>
                      {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'emphasis').map((a) => (
                        <button
                          key={a.type}
                          className="ppt-anim-drop-item"
                          onClick={() => {
                            onAddAnimation?.(a.type, 'emphasis');
                            setShowAddAnimDropdown(false);
                          }}
                        >
                          <span>{a.icon}</span> <span>{a.label}</span>
                        </button>
                      ))}

                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
                        🔴 THOÁT (EXIT)
                      </div>
                      {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'exit').map((a) => (
                        <button
                          key={a.type}
                          className="ppt-anim-drop-item"
                          onClick={() => {
                            onAddAnimation?.(a.type, 'exit');
                            setShowAddAnimDropdown(false);
                          }}
                        >
                          <span>{a.icon}</span> <span>{a.label}</span>
                        </button>
                      ))}

                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#7C3AED' }}>
                        🟣 ĐƯỜNG CHUYỂN ĐỘNG (MOTION PATHS)
                      </div>
                      {ANIMATIONS_CATALOGUE.filter((a) => a.category === 'motion-path').map((a) => (
                        <button
                          key={a.type}
                          className="ppt-anim-drop-item"
                          onClick={() => {
                            onAddAnimation?.(a.type, 'motion-path');
                            setShowAddAnimDropdown(false);
                          }}
                        >
                          <span>{a.icon}</span> <span>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Animation Pane Toggle */}
                <button
                  className={`ppt-tool-btn-large ${isAnimationPaneOpen ? 'is-active' : ''}`}
                  onClick={onToggleAnimationPane}
                  title="Mở hoặc đóng Ngăn Hoạt hình để quản lý thứ tự, thanh thời gian và kích hoạt"
                >
                  <Sliders size={20} color="#4F46E5" />
                  <span>Ngăn Hoạt hình</span>
                </button>

                {/* Trigger (Bộ kích hoạt) */}
                <div style={{ position: 'relative' }}>
                  <button
                    className={`ppt-tool-btn-large ${showTriggerDropdown ? 'is-active' : ''}`}
                    disabled={!selectedElement}
                    onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
                    title="Thiết lập bộ kích hoạt: Khi bấm chuột hoặc khi nhấp vào đối tượng cụ thể"
                  >
                    <MousePointer size={20} color="#0078D4" />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Bộ kích hoạt <ChevronDown size={11} />
                    </span>
                  </button>

                  {showTriggerDropdown && (
                    <div
                      className="ppt-anim-dropdown-menu"
                      style={{ minWidth: '220px' }}
                      onMouseLeave={() => setShowTriggerDropdown(false)}
                    >
                      <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                        ĐIỀU KIỆN KÍCH HOẠT
                      </div>
                      <button
                        className="ppt-anim-drop-item is-active"
                        onClick={() => {
                          onSetTriggerElementId?.('');
                          setShowTriggerDropdown(false);
                        }}
                      >
                        <span>✓</span> <span>Khi bấm chuột (Chuẩn)</span>
                      </button>
                      {slideElements && slideElements.length > 0 && (
                        <>
                          <div className="ppt-ctx-divider" />
                          <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#0078D4' }}>
                            KHI BẤM VÀO ĐỐI TƯỢNG...
                          </div>
                          {slideElements.map((el, i) => {
                            const name = el.text
                              ? `"${el.text.slice(0, 18)}…"`
                              : el.type === 'shape'
                              ? `Hình: ${el.shapeType || 'khối'}`
                              : el.type === 'image'
                              ? `Hình ảnh [${i + 1}]`
                              : `Phần tử [${i + 1}]`;
                            return (
                              <button
                                key={el.id}
                                className="ppt-anim-drop-item"
                                onClick={() => {
                                  onSetTriggerElementId?.(el.id);
                                  setShowTriggerDropdown(false);
                                }}
                              >
                                <span>•</span> <span>{name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Animation Painter */}
                <button
                  className={`ppt-tool-btn-large ${animationPainterActive ? 'is-active' : ''}`}
                  disabled={!selectedElement}
                  onClick={onToggleAnimationPainter}
                  title="Sao chép hoạt hình từ đối tượng này sang đối tượng khác (Animation Painter)"
                >
                  <Paintbrush size={20} color="#F59E0B" />
                  <span>Sao chép</span>
                </button>
              </div>
              <div className="ppt-group-footer">Hoạt hình nâng cao</div>
            </div>

            {/* 4. Timing Group */}
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <div className="ppt-timing-grid">
                  {/* Start Trigger */}
                  <div className="ppt-timing-row">
                    <span className="ppt-timing-label">
                      <MousePointer size={13} color="#64748B" /> Bắt đầu:
                    </span>
                    <select
                      className="ppt-select-control"
                      value={selectedElement?.animation?.trigger || 'on-click'}
                      onChange={(e) => onUpdateAnimationTiming?.({ trigger: e.target.value as AnimationTrigger })}
                      title="Thời điểm bắt đầu hoạt hình"
                    >
                      <option value="on-click">Khi bấm chuột</option>
                      <option value="with-previous">Cùng trước đó</option>
                      <option value="after-previous">Sau trước đó</option>
                    </select>
                  </div>

                  {/* Duration stepper */}
                  <div className="ppt-timing-row">
                    <span className="ppt-timing-label">
                      <Clock size={13} color="#64748B" /> Thời lượng:
                    </span>
                    <div className="ppt-stepper-control">
                      <button
                        className="ppt-stepper-btn"
                        onClick={() =>
                          onUpdateAnimationTiming?.({
                            duration: Math.max(0.1, Number(((selectedElement?.animation?.duration || 0.5) - 0.25).toFixed(2))),
                          })
                        }
                        title="Giảm thời lượng"
                      >
                        -
                      </button>
                      <span className="ppt-stepper-value">
                        {(selectedElement?.animation?.duration || 0.5).toFixed(2)}s
                      </span>
                      <button
                        className="ppt-stepper-btn"
                        onClick={() =>
                          onUpdateAnimationTiming?.({
                            duration: Math.min(10.0, Number(((selectedElement?.animation?.duration || 0.5) + 0.25).toFixed(2))),
                          })
                        }
                        title="Tăng thời lượng"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Delay stepper */}
                  <div className="ppt-timing-row">
                    <span className="ppt-timing-label">
                      <Timer size={13} color="#64748B" /> Độ trễ:
                    </span>
                    <div className="ppt-stepper-control">
                      <button
                        className="ppt-stepper-btn"
                        onClick={() =>
                          onUpdateAnimationTiming?.({
                            delay: Math.max(0, Number(((selectedElement?.animation?.delay || 0) - 0.25).toFixed(2))),
                          })
                        }
                        title="Giảm độ trễ"
                      >
                        -
                      </button>
                      <span className="ppt-stepper-value">
                        {(selectedElement?.animation?.delay || 0).toFixed(2)}s
                      </span>
                      <button
                        className="ppt-stepper-btn"
                        onClick={() =>
                          onUpdateAnimationTiming?.({
                            delay: Math.min(10.0, Number(((selectedElement?.animation?.delay || 0) + 0.25).toFixed(2))),
                          })
                        }
                        title="Tăng độ trễ"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <span style={{ width: '1px', height: '54px', background: '#E2E8F0', margin: '0 4px' }} />

                {/* Reorder Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    className="ppt-tool-btn"
                    onClick={() => onReorderAnimation?.('earlier')}
                    title="Di chuyển sớm hơn trong thứ tự diễn hoạt"
                  >
                    <ArrowUp size={14} color="#0078D4" /> <span>Sớm hơn</span>
                  </button>
                  <button
                    className="ppt-tool-btn"
                    onClick={() => onReorderAnimation?.('later')}
                    title="Di chuyển muộn hơn trong thứ tự diễn hoạt"
                  >
                    <ArrowDown size={14} color="#0078D4" /> <span>Muộn hơn</span>
                  </button>
                </div>
              </div>
              <div className="ppt-group-footer">Định thời gian</div>
            </div>
          </>
        )}

        {/* TAB: SLIDESHOW */}
        {activeTab === 'slideshow' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={() => onStartSlideShow(false)}
                  title="Bắt đầu chiếu từ đầu (F5)"
                >
                  <Play size={20} color="#D83B01" />
                  <span>Từ đầu (F5)</span>
                </button>
                <button
                  className="ppt-tool-btn-large"
                  onClick={() => onStartSlideShow(true)}
                  title="Bắt đầu chiếu từ trang chiếu hiện tại (Shift+F5)"
                >
                  <Presentation size={20} color="#0078D4" />
                  <span>Từ trang này</span>
                </button>
              </div>
              <div className="ppt-group-footer">Trình chiếu</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={onStartPresenterMode}
                  title="Mở chế độ Diễn giả (kèm đồng hồ và ghi chú)"
                >
                  <Monitor size={20} color="#107C41" />
                  <span>Chế độ Diễn giả</span>
                </button>
              </div>
              <div className="ppt-group-footer">Thiết lập</div>
            </div>
          </>
        )}

        {/* TAB: REVIEW */}
        {activeTab === 'review' && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button className="ppt-tool-btn-large" onClick={onOpenAiModal} title="Trợ lý AI rà soát nội dung">
                <Sparkles size={20} color="#7C3AED" />
                <span>AI Rà soát</span>
              </button>
              <button className="ppt-tool-btn-large" onClick={onOpenExportModal} title="In ấn bài thuyết trình">
                <Printer size={20} color="#0078D4" />
                <span>In ấn</span>
              </button>
            </div>
            <div className="ppt-group-footer">Soát lỗi & In</div>
          </div>
        )}

        {/* TAB: VIEW */}
        {activeTab === 'view' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className={`ppt-tool-btn ${viewMode === 'normal' ? 'is-active' : ''}`}
                  onClick={() => onViewModeChange('normal')}
                  title="Chế độ xem bình thường"
                >
                  Bình thường
                </button>
                <button
                  className={`ppt-tool-btn ${viewMode === 'sorter' ? 'is-active' : ''}`}
                  onClick={() => onViewModeChange('sorter')}
                  title="Bộ sắp xếp trang chiếu"
                >
                  Bộ sắp xếp
                </button>
              </div>
              <div className="ppt-group-footer">Dạng xem</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className={`ppt-tool-btn ${showRuler ? 'is-active' : ''}`}
                  onClick={onToggleRuler}
                  title="Bật/tắt Thước đo (Ruler)"
                >
                  <Ruler size={15} /> Thước kẻ
                </button>
                <button
                  className={`ppt-tool-btn ${showGridlines ? 'is-active' : ''}`}
                  onClick={onToggleGridlines}
                  title="Bật/tắt Đường lưới (Gridlines)"
                >
                  <Grid size={15} /> Đường lưới
                </button>
                <button
                  className={`ppt-tool-btn ${showGuides ? 'is-active' : ''}`}
                  onClick={onToggleGuides}
                  title="Bật/tắt Đường dẫn hướng (Guides)"
                >
                  Đường dẫn
                </button>
                <button
                  className={`ppt-tool-btn ${showNotes ? 'is-active' : ''}`}
                  onClick={onToggleNotes}
                  title="Bật/tắt Ghi chú"
                >
                  Ghi chú
                </button>
              </div>
              <div className="ppt-group-footer">Hiển thị</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn" onClick={() => onZoomChange(100)} title="Thu phóng 100%">
                  100%
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', padding: '0 4px' }}>{zoom}%</span>
                <button className="ppt-tool-btn" onClick={() => onZoomChange(75)} title="Vừa khung nhìn">
                  Vừa khung
                </button>
              </div>
              <div className="ppt-group-footer">Thu phóng</div>
            </div>
          </>
        )}

        {/* CONTEXTUAL TAB: SHAPE FORMAT */}
        {activeTab === 'shape-format' && isShapeSelected && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <label className="ppt-tool-btn" title="Đổ màu nền hình (Shape Fill)" style={{ cursor: 'pointer' }}>
                  <Palette size={16} />
                  <input
                    type="color"
                    hidden
                    value={selectedElement.fill || '#0284C7'}
                    onChange={(e) => onUpdateSelectedElement({ fill: e.target.value, fillType: 'solid' })}
                  />
                </label>
                <label className="ppt-tool-btn" title="Màu đường viền (Shape Outline)" style={{ cursor: 'pointer' }}>
                  <Square size={16} color={selectedElement.stroke || '#0284C7'} />
                  <input
                    type="color"
                    hidden
                    value={selectedElement.stroke || '#0284C7'}
                    onChange={(e) => onUpdateSelectedElement({ stroke: e.target.value })}
                  />
                </label>
                <button
                  className="ppt-tool-btn"
                  onClick={() => onUpdateSelectedElement({ strokeWidth: ((selectedElement.strokeWidth || 1) % 4) + 1 })}
                  title="Độ dày viền"
                >
                  {selectedElement.strokeWidth || 1}px
                </button>
              </div>
              <div className="ppt-group-footer">Kiểu hình dạng</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button className="ppt-tool-btn" onClick={onBringToFront} title="Lên trên cùng">
                  Lên trên
                </button>
                <button className="ppt-tool-btn" onClick={onBringForward} title="Lên một lớp">
                  Lên 1 lớp
                </button>
                <button className="ppt-tool-btn" onClick={onSendBackward} title="Xuống một lớp">
                  Xuống 1 lớp
                </button>
                <button className="ppt-tool-btn" onClick={onSendToBack} title="Xuống dưới cùng">
                  Xuống dưới
                </button>
                <button className="ppt-tool-btn" onClick={() => onAlignElement('center')} title="Căn giữa">
                  Căn giữa
                </button>
              </div>
              <div className="ppt-group-footer">Sắp xếp</div>
            </div>

            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={onToggleFormatPane}
                  title="Mở bảng Định dạng Chi tiết"
                >
                  <Sliders size={20} color="#D83B01" />
                  <span>Chi tiết</span>
                </button>
              </div>
              <div className="ppt-group-footer">Định dạng</div>
            </div>
          </>
        )}

        {/* CONTEXTUAL TAB: PICTURE FORMAT */}
        {activeTab === 'picture-format' && isImageSelected && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button
                className="ppt-tool-btn"
                onClick={() => onUpdateSelectedElement({ borderRadius: 12 })}
                title="Bo tròn góc ảnh"
              >
                Bo góc
              </button>
              <button
                className="ppt-tool-btn"
                onClick={() => onUpdateSelectedElement({ borderRadius: 100 })}
                title="Cắt ảnh hình tròn"
              >
                Tròn
              </button>
              <button
                className="ppt-tool-btn"
                onClick={() => onUpdateSelectedElement({ shapeShadow: !selectedElement.shapeShadow })}
                title="Đổ bóng ảnh"
              >
                Đổ bóng
              </button>
            </div>
            <div className="ppt-group-footer">Kiểu hình ảnh</div>
          </div>
        )}

        {/* CONTEXTUAL TAB: TABLE DESIGN */}
        {activeTab === 'table-design' && isTableSelected && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button
                className="ppt-tool-btn"
                onClick={() => onUpdateSelectedElement({ tableHeaderRow: !selectedElement.tableHeaderRow })}
                title="Bật/tắt Dòng tiêu đề"
              >
                Dòng đầu
              </button>
              <label className="ppt-tool-btn" title="Màu nền tiêu đề">
                <Palette size={16} />
                <input
                  type="color"
                  hidden
                  value={selectedElement.tableHeaderColor || '#D83B01'}
                  onChange={(e) => onUpdateSelectedElement({ tableHeaderColor: e.target.value })}
                />
              </label>
            </div>
            <div className="ppt-group-footer">Tùy chọn kiểu bảng</div>
          </div>
        )}

        {/* CONTEXTUAL TAB: CHART DESIGN */}
        {activeTab === 'chart-design' && isChartSelected && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button
                className={`ppt-tool-btn ${selectedElement.chartType === 'column' ? 'is-active' : ''}`}
                onClick={() => onUpdateSelectedElement({ chartType: 'column' })}
              >
                Cột
              </button>
              <button
                className={`ppt-tool-btn ${selectedElement.chartType === 'line' ? 'is-active' : ''}`}
                onClick={() => onUpdateSelectedElement({ chartType: 'line' })}
              >
                Đường
              </button>
              <button
                className={`ppt-tool-btn ${selectedElement.chartType === 'pie' ? 'is-active' : ''}`}
                onClick={() => onUpdateSelectedElement({ chartType: 'pie' })}
              >
                Tròn
              </button>
              <button
                className="ppt-tool-btn-large"
                onClick={onToggleFormatPane}
                title="Sửa số liệu biểu đồ"
              >
                <Sliders size={18} color="#0078D4" />
                <span>Sửa dữ liệu</span>
              </button>
            </div>
            <div className="ppt-group-footer">Kiểu biểu đồ & Dữ liệu</div>
          </div>
        )}
      </div>
    </div>
  );
}
