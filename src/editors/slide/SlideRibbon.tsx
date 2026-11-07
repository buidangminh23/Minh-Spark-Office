import { useRef } from 'react';
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
} from 'lucide-react';
import type {
  SlideElement,
  SlideLayout,
  ShapeType,
  ChartType,
  TransitionType,
  AnimationType,
} from '../../lib/slideTypes';
import { SLIDE_THEMES } from '../../lib/slideThemes';

export type RibbonTab =
  | 'home'
  | 'insert'
  | 'draw'
  | 'design'
  | 'transitions'
  | 'animations'
  | 'slideshow'
  | 'review'
  | 'view';

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
  onChangeAspectRatio: (ratio: '16:9' | '4:3') => void;
  currentTransition: TransitionType;
  onChangeTransition: (trans: TransitionType) => void;
  onApplyTransitionToAll: () => void;
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
  onAiGenerate: () => void;
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
    onChangeAspectRatio,
    currentTransition,
    onChangeTransition,
    onApplyTransitionToAll,
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
    onAiGenerate,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Ribbon Tabs bar */}
      <div className="ppt-ribbon-tabs">
        <button
          className="ppt-file-tab-btn"
          onClick={onOpenFileMenu}
          title="Mở menu Tệp (Backstage)"
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

        {/* AI Copilot quick launcher */}
        <button
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            color: '#FFFFFF',
            border: 'none',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={onAiGenerate}
          title="Trợ lý tạo nội dung bài thuyết trình bằng AI"
        >
          <Sparkles size={14} /> AI Copilot
        </button>
      </div>

      {/* Ribbon Body Toolbar */}
      <div className="ppt-ribbon-body">
        {/* Tab 1: Home */}
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
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content">
                <button
                  className="ppt-tool-btn-large"
                  onClick={() => onAddSlide('title-content')}
                  title="Thêm trang chiếu mới"
                >
                  <Plus size={20} color="#D83B01" />
                  <span>Trang mới</span>
                </button>
              </div>
              <div className="ppt-group-footer">Trang chiếu</div>
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

                  {/* Text Color input */}
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

            {/* Shape formatting (when shape is selected) */}
            {selectedElement?.type === 'shape' && (
              <div className="ppt-ribbon-group">
                <div className="ppt-group-content">
                  <label className="ppt-tool-btn" title="Đổ màu nền hình (Shape Fill)" style={{ cursor: 'pointer' }}>
                    <Palette size={16} />
                    <input
                      type="color"
                      hidden
                      value={selectedElement.fill || '#0284C7'}
                      onChange={(e) => onUpdateSelectedElement({ fill: e.target.value })}
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
                <div className="ppt-group-footer">Định dạng hình</div>
              </div>
            )}

            {/* Delete element action */}
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

        {/* Tab 2: Insert */}
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

        {/* Tab 3: Draw */}
        {activeTab === 'draw' && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button
                className="ppt-tool-btn-large is-active"
                onClick={() => onAddShape('line')}
                title="Bút vẽ đường thẳng"
              >
                <span style={{ fontSize: '18px' }}>✏️</span>
                <span>Bút mực</span>
              </button>
              <button
                className="ppt-tool-btn-large"
                onClick={() => onAddShape('rectangle')}
                title="Bút dạ quang"
              >
                <span style={{ fontSize: '18px' }}>🖍️</span>
                <span>Dạ quang</span>
              </button>
            </div>
            <div className="ppt-group-footer">Công cụ vẽ</div>
          </div>
        )}

        {/* Tab 4: Design */}
        {activeTab === 'design' && (
          <>
            <div className="ppt-ribbon-group">
              <div className="ppt-group-content" style={{ gap: '8px' }}>
                {Object.values(SLIDE_THEMES).map((th) => (
                  <button
                    key={th.id}
                    style={{
                      width: '64px',
                      height: '48px',
                      borderRadius: '6px',
                      border: th.id === currentThemeId ? '2px solid #D83B01' : '1px solid #CBD5E1',
                      background: th.backgroundColor,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
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
          </>
        )}

        {/* Tab 5: Transitions */}
        {activeTab === 'transitions' && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              {(['none', 'fade', 'push', 'wipe', 'split', 'zoom', 'flip'] as TransitionType[]).map((t) => (
                <button
                  key={t}
                  className={`ppt-tool-btn ${currentTransition === t ? 'is-active' : ''}`}
                  onClick={() => onChangeTransition(t)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {t === 'none' ? 'Không' : t}
                </button>
              ))}
              <span style={{ width: '1px', height: '24px', background: '#E2E8F0', margin: '0 4px' }} />
              <button className="ppt-tool-btn" onClick={onApplyTransitionToAll} title="Áp dụng cho tất cả trang chiếu">
                Áp dụng tất cả
              </button>
            </div>
            <div className="ppt-group-footer">Hiệu ứng chuyển tiếp</div>
          </div>
        )}

        {/* Tab 6: Animations */}
        {activeTab === 'animations' && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              {(['none', 'appear', 'fade-in', 'fly-in-up', 'zoom-in', 'bounce'] as AnimationType[]).map((anim) => (
                <button
                  key={anim}
                  className={`ppt-tool-btn ${selectedElement?.animation?.type === anim ? 'is-active' : ''}`}
                  onClick={() =>
                    onUpdateSelectedElement({
                      animation: { type: anim, duration: 0.5, delay: 0 },
                    })
                  }
                  style={{ textTransform: 'capitalize' }}
                >
                  {anim === 'none' ? 'Không' : anim}
                </button>
              ))}
            </div>
            <div className="ppt-group-footer">Hoạt hình đối tượng</div>
          </div>
        )}

        {/* Tab 7: Slide Show */}
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

        {/* Tab 8: Review */}
        {activeTab === 'review' && (
          <div className="ppt-ribbon-group">
            <div className="ppt-group-content">
              <button className="ppt-tool-btn-large" onClick={onAiGenerate} title="Trợ lý AI rà soát nội dung">
                <Sparkles size={20} color="#7C3AED" />
                <span>AI Rà soát</span>
              </button>
            </div>
            <div className="ppt-group-footer">Soát lỗi & AI</div>
          </div>
        )}

        {/* Tab 9: View */}
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
                  className={`ppt-tool-btn ${showNotes ? 'is-active' : ''}`}
                  onClick={onToggleNotes}
                  title="Bật/tắt khung ghi chú của người thuyết trình"
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
      </div>
    </div>
  );
}
