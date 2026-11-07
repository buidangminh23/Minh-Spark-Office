import { useState } from 'react';
import {
  X,
  Palette,
  Layers,
  Square,
  Type,
  Maximize2,
  RotateCw,
  Sun,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BarChart3,
  Sliders,
  Check,
} from 'lucide-react';
import type { SlideData, SlideElement, SlideBackground, AnimationType } from '../../lib/slideTypes';

interface SlideFormatPaneProps {
  selectedElement: SlideElement | null;
  slide: SlideData;
  onUpdateElement: (updates: Partial<SlideElement>) => void;
  onUpdateSlideBackground: (bg: SlideBackground) => void;
  onApplyBgToAll: () => void;
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onAlignElement: (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
}

const GRADIENT_PRESETS = [
  { name: 'Hoàng hôn', value: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)' },
  { name: 'Biển xanh', value: 'linear-gradient(135deg, #0072FF 0%, #00C6FF 100%)' },
  { name: 'Rừng ngọc', value: 'linear-gradient(135deg, #0575E6 0%, #00F260 100%)' },
  { name: 'Bình minh', value: 'linear-gradient(135deg, #F857A6 0%, #FF5858 100%)' },
  { name: 'Tím khói', value: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' },
  { name: 'Than chì', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Hổ phách', value: 'linear-gradient(135deg, #F7971E 0%, #FFD200 100%)' },
  { name: 'Thanh lịch', value: 'linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 100%)' },
];

export function SlideFormatPane({
  selectedElement,
  slide,
  onUpdateElement,
  onUpdateSlideBackground,
  onApplyBgToAll,
  onClose,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onAlignElement,
}: SlideFormatPaneProps) {
  const [activeTab, setActiveTab] = useState<'shape' | 'text' | 'chart' | 'effects'>('shape');

  const hasText =
    selectedElement?.type === 'text' ||
    (selectedElement?.type === 'shape' && typeof selectedElement.text === 'string');
  const isChart = selectedElement?.type === 'chart';

  return (
    <aside className="ppt-format-pane" aria-label="Khung định dạng">
      {/* Pane Header */}
      <div className="ppt-format-header">
        <div className="ppt-format-title-wrap">
          <Palette size={18} color="#D83B01" />
          <span className="ppt-format-title">
            {selectedElement
              ? selectedElement.type === 'shape'
                ? 'Định dạng Hình dạng'
                : selectedElement.type === 'image'
                ? 'Định dạng Hình ảnh'
                : selectedElement.type === 'table'
                ? 'Định dạng Bảng biểu'
                : selectedElement.type === 'chart'
                ? 'Định dạng Biểu đồ'
                : 'Định dạng Đối tượng'
              : 'Định dạng Nền Trang chiếu'}
          </span>
        </div>
        <button className="ppt-format-close-btn" onClick={onClose} title="Đóng khung định dạng">
          <X size={16} />
        </button>
      </div>

      {/* Mode Sub-tabs (when element selected) */}
      {selectedElement && (
        <div className="ppt-format-tabs">
          <button
            className={`ppt-format-tab-btn ${activeTab === 'shape' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('shape')}
          >
            <Square size={14} /> Hình & Lớp
          </button>
          {hasText && (
            <button
              className={`ppt-format-tab-btn ${activeTab === 'text' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              <Type size={14} /> Chữ viết
            </button>
          )}
          {isChart && (
            <button
              className={`ppt-format-tab-btn ${activeTab === 'chart' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <BarChart3 size={14} /> Dữ liệu số
            </button>
          )}
          <button
            className={`ppt-format-tab-btn ${activeTab === 'effects' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            <Sliders size={14} /> Hiệu ứng
          </button>
        </div>
      )}

      {/* Pane Scroll Body */}
      <div className="ppt-format-body">
        {/* CASE 1: NO ELEMENT SELECTED -> FORMAT SLIDE BACKGROUND */}
        {!selectedElement && (
          <div className="ppt-format-section">
            <div className="ppt-format-section-title">
              <Sun size={15} /> Kiểu Nền Trang Chiếu
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Loại màu nền:</span>
              <div className="ppt-format-btn-group">
                <button
                  className={`ppt-btn-toggle ${slide.background.type === 'solid' ? 'is-active' : ''}`}
                  onClick={() => onUpdateSlideBackground({ type: 'solid', value: '#FFFFFF' })}
                >
                  Đơn sắc
                </button>
                <button
                  className={`ppt-btn-toggle ${slide.background.type === 'gradient' ? 'is-active' : ''}`}
                  onClick={() =>
                    onUpdateSlideBackground({
                      type: 'gradient',
                      value: GRADIENT_PRESETS[0].value,
                    })
                  }
                >
                  Chuyển màu
                </button>
              </div>
            </div>

            {slide.background.type === 'solid' ? (
              <div className="ppt-format-row">
                <span className="ppt-format-label">Màu sắc:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    className="ppt-input-color"
                    value={slide.background.value.startsWith('#') ? slide.background.value : '#FFFFFF'}
                    onChange={(e) => onUpdateSlideBackground({ type: 'solid', value: e.target.value })}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B' }}>
                    {slide.background.value}
                  </span>
                </div>
              </div>
            ) : (
              <div className="ppt-format-col">
                <span className="ppt-format-label">Mẫu Gradient nghệ thuật:</span>
                <div className="ppt-gradient-grid">
                  {GRADIENT_PRESETS.map((gp, i) => (
                    <button
                      key={i}
                      className="ppt-gradient-preset-btn"
                      style={{ background: gp.value }}
                      onClick={() => onUpdateSlideBackground({ type: 'gradient', value: gp.value })}
                      title={gp.name}
                    >
                      {slide.background.value === gp.value && <Check size={14} color="#FFFFFF" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="ppt-primary-action-btn" onClick={onApplyBgToAll}>
                Áp dụng cho tất cả trang chiếu
              </button>
              <button
                className="ppt-secondary-action-btn"
                onClick={() => onUpdateSlideBackground({ type: 'solid', value: '#FFFFFF' })}
              >
                Đặt lại nền trắng chuẩn
              </button>
            </div>
          </div>
        )}

        {/* CASE 2: ELEMENT SELECTED -> TAB: SHAPE & ARRANGE */}
        {selectedElement && activeTab === 'shape' && (
          <>
            {/* Fill group */}
            <div className="ppt-format-section">
              <div className="ppt-format-section-title">
                <Palette size={15} /> Tô Màu Phần Tử (Fill)
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Kiểu tô:</span>
                <div className="ppt-format-btn-group">
                  <button
                    className={`ppt-btn-toggle ${selectedElement.fillType === 'none' ? 'is-active' : ''}`}
                    onClick={() => onUpdateElement({ fillType: 'none', fill: 'transparent' })}
                  >
                    Không tô
                  </button>
                  <button
                    className={`ppt-btn-toggle ${!selectedElement.fillType || selectedElement.fillType === 'solid' ? 'is-active' : ''}`}
                    onClick={() => onUpdateElement({ fillType: 'solid', fill: selectedElement.fill || '#0284C7' })}
                  >
                    Đơn sắc
                  </button>
                  <button
                    className={`ppt-btn-toggle ${selectedElement.fillType === 'gradient' ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateElement({
                        fillType: 'gradient',
                        gradient: GRADIENT_PRESETS[1].value,
                      })
                    }
                  >
                    Gradient
                  </button>
                </div>
              </div>

              {selectedElement.fillType !== 'none' && selectedElement.fillType !== 'gradient' && (
                <div className="ppt-format-row">
                  <span className="ppt-format-label">Màu tô:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      className="ppt-input-color"
                      value={selectedElement.fill && selectedElement.fill.startsWith('#') ? selectedElement.fill : '#0284C7'}
                      onChange={(e) => onUpdateElement({ fill: e.target.value, fillType: 'solid' })}
                    />
                    <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {selectedElement.fill || '#0284C7'}
                    </span>
                  </div>
                </div>
              )}

              {selectedElement.fillType === 'gradient' && (
                <div className="ppt-format-col">
                  <span className="ppt-format-label">Mẫu Gradient:</span>
                  <div className="ppt-gradient-grid">
                    {GRADIENT_PRESETS.map((gp, i) => (
                      <button
                        key={i}
                        className="ppt-gradient-preset-btn"
                        style={{ background: gp.value }}
                        onClick={() => onUpdateElement({ gradient: gp.value })}
                        title={gp.name}
                      >
                        {selectedElement.gradient === gp.value && <Check size={14} color="#FFFFFF" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Opacity slider */}
              <div className="ppt-format-row">
                <span className="ppt-format-label">Độ trong suốt:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round((selectedElement.opacity ?? 1) * 100)}
                    onChange={(e) => onUpdateElement({ opacity: Number(e.target.value) / 100 })}
                    style={{ width: '90px' }}
                  />
                  <span style={{ fontSize: '12px', minWidth: '32px', textAlign: 'right' }}>
                    {Math.round((selectedElement.opacity ?? 1) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Outline / Stroke group */}
            <div className="ppt-format-section">
              <div className="ppt-format-section-title">
                <Square size={15} /> Đường Viền (Line / Outline)
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Màu đường viền:</span>
                <input
                  type="color"
                  className="ppt-input-color"
                  value={selectedElement.stroke && selectedElement.stroke.startsWith('#') ? selectedElement.stroke : '#0284C7'}
                  onChange={(e) => onUpdateElement({ stroke: e.target.value })}
                />
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Độ dày viền:</span>
                <select
                  className="ppt-select"
                  value={selectedElement.strokeWidth ?? 1}
                  onChange={(e) => onUpdateElement({ strokeWidth: Number(e.target.value) })}
                >
                  <option value="0">Không viền (0px)</option>
                  <option value="1">1 px (Mỏng)</option>
                  <option value="2">2 px (Chuẩn)</option>
                  <option value="3">3 px (Vừa)</option>
                  <option value="4">4 px (Đậm)</option>
                  <option value="6">6 px (Dày)</option>
                  <option value="8">8 px (Rất dày)</option>
                </select>
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Kiểu nét viền:</span>
                <select
                  className="ppt-select"
                  value={selectedElement.borderStyle ?? 'solid'}
                  onChange={(e) => onUpdateElement({ borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })}
                >
                  <option value="solid">Nét liền (Solid)</option>
                  <option value="dashed">Nét đứt (Dashed)</option>
                  <option value="dotted">Nét chấm (Dotted)</option>
                </select>
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Bo tròn góc:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={selectedElement.borderRadius ?? 0}
                    onChange={(e) => onUpdateElement({ borderRadius: Number(e.target.value) })}
                    style={{ width: '90px' }}
                  />
                  <span style={{ fontSize: '12px', minWidth: '32px', textAlign: 'right' }}>
                    {selectedElement.borderRadius ?? 0}px
                  </span>
                </div>
              </div>
            </div>

            {/* Position, Size, Rotation */}
            <div className="ppt-format-section">
              <div className="ppt-format-section-title">
                <Maximize2 size={15} /> Kích Thước & Góc Xoay
              </div>

              <div className="ppt-format-grid-2">
                <div className="ppt-format-input-unit">
                  <label>Rộng (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={Math.round(selectedElement.width)}
                    onChange={(e) => onUpdateElement({ width: Math.max(5, Math.min(100, Number(e.target.value))) })}
                  />
                </div>
                <div className="ppt-format-input-unit">
                  <label>Cao (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={Math.round(selectedElement.height)}
                    onChange={(e) => onUpdateElement({ height: Math.max(5, Math.min(100, Number(e.target.value))) })}
                  />
                </div>
                <div className="ppt-format-input-unit">
                  <label>Vị trí X (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) => onUpdateElement({ x: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  />
                </div>
                <div className="ppt-format-input-unit">
                  <label>Vị trí Y (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) => onUpdateElement({ y: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  />
                </div>
              </div>

              <div className="ppt-format-row" style={{ marginTop: '10px' }}>
                <span className="ppt-format-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RotateCw size={14} /> Góc xoay:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={selectedElement.rotation ?? 0}
                    onChange={(e) => onUpdateElement({ rotation: Number(e.target.value) })}
                    style={{ width: '90px' }}
                  />
                  <span style={{ fontSize: '12px', minWidth: '36px', textAlign: 'right' }}>
                    {selectedElement.rotation ?? 0}°
                  </span>
                </div>
              </div>
            </div>

            {/* Arrange & Align */}
            <div className="ppt-format-section">
              <div className="ppt-format-section-title">
                <Layers size={15} /> Sắp Xếp Thứ Tự Lớp (Arrange)
              </div>

              <div className="ppt-format-grid-2">
                <button className="ppt-btn-action" onClick={onBringToFront}>
                  Lên trên cùng
                </button>
                <button className="ppt-btn-action" onClick={onSendToBack}>
                  Xuống dưới cùng
                </button>
                <button className="ppt-btn-action" onClick={onBringForward}>
                  Lên một mức
                </button>
                <button className="ppt-btn-action" onClick={onSendBackward}>
                  Xuống một mức
                </button>
              </div>

              <div style={{ marginTop: '12px' }}>
                <span className="ppt-format-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Căn lề phần tử:
                </span>
                <div className="ppt-format-align-btn-grid">
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('left')} title="Căn trái">
                    Trái
                  </button>
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('center')} title="Căn giữa ngang">
                    Giữa
                  </button>
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('right')} title="Căn phải">
                    Phải
                  </button>
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('top')} title="Căn trên">
                    Trên
                  </button>
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('middle')} title="Căn giữa dọc">
                    Giữa dọc
                  </button>
                  <button className="ppt-btn-icon" onClick={() => onAlignElement('bottom')} title="Căn đáy">
                    Đáy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* CASE 3: TAB: TEXT FORMATTING */}
        {selectedElement && activeTab === 'text' && (
          <div className="ppt-format-section">
            <div className="ppt-format-section-title">
              <Type size={15} /> Thuộc Tính Hộp Văn Bản
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Căn lề ngang:</span>
              <div className="ppt-format-btn-group">
                <button
                  className={`ppt-btn-toggle ${selectedElement.textAlign === 'left' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ textAlign: 'left' })}
                  title="Căn trái"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  className={`ppt-btn-toggle ${selectedElement.textAlign === 'center' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ textAlign: 'center' })}
                  title="Căn giữa"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  className={`ppt-btn-toggle ${selectedElement.textAlign === 'right' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ textAlign: 'right' })}
                  title="Căn phải"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  className={`ppt-btn-toggle ${selectedElement.textAlign === 'justify' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ textAlign: 'justify' })}
                  title="Căn đều"
                >
                  <AlignJustify size={14} />
                </button>
              </div>
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Căn lề dọc:</span>
              <div className="ppt-format-btn-group">
                <button
                  className={`ppt-btn-toggle ${!selectedElement.verticalAlign || selectedElement.verticalAlign === 'top' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ verticalAlign: 'top' })}
                >
                  Trên cùng
                </button>
                <button
                  className={`ppt-btn-toggle ${selectedElement.verticalAlign === 'middle' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ verticalAlign: 'middle' })}
                >
                  Ở giữa
                </button>
                <button
                  className={`ppt-btn-toggle ${selectedElement.verticalAlign === 'bottom' ? 'is-active' : ''}`}
                  onClick={() => onUpdateElement({ verticalAlign: 'bottom' })}
                >
                  Dưới cùng
                </button>
              </div>
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Giãn dòng (Line Height):</span>
              <select
                className="ppt-select"
                value={selectedElement.lineHeight ?? 1.4}
                onChange={(e) => onUpdateElement({ lineHeight: Number(e.target.value) })}
              >
                <option value="1.1">1.1 (Đoàn kết)</option>
                <option value="1.4">1.4 (Tiêu chuẩn)</option>
                <option value="1.6">1.6 (Thoáng)</option>
                <option value="2.0">2.0 (Gấp đôi)</option>
              </select>
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Khoảng đệm (Padding):</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={selectedElement.padding ?? 8}
                  onChange={(e) => onUpdateElement({ padding: Number(e.target.value) })}
                  style={{ width: '90px' }}
                />
                <span style={{ fontSize: '12px' }}>{selectedElement.padding ?? 8}px</span>
              </div>
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Đổ bóng văn bản:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!selectedElement.textShadow}
                  onChange={(e) => onUpdateElement({ textShadow: e.target.checked })}
                />
                <span style={{ fontSize: '13px' }}>Bật bóng đổ nhẹ</span>
              </label>
            </div>
          </div>
        )}

        {/* CASE 4: TAB: CHART DATA */}
        {selectedElement && activeTab === 'chart' && isChart && (
          <div className="ppt-format-section">
            <div className="ppt-format-section-title">
              <BarChart3 size={15} /> Dữ Liệu Biểu Đồ (Spreadsheet)
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Tiêu đề biểu đồ:</span>
              <input
                type="text"
                className="ppt-input-text"
                value={selectedElement.chartTitle || ''}
                onChange={(e) => onUpdateElement({ chartTitle: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '12px' }}>
              <span className="ppt-format-label" style={{ display: 'block', marginBottom: '6px' }}>
                Các mốc danh mục (Categories):
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(selectedElement.chartCategories || ['Q1', 'Q2', 'Q3', 'Q4']).map((cat, ci) => (
                  <input
                    key={ci}
                    type="text"
                    className="ppt-input-text"
                    style={{ width: '60px', padding: '3px 6px', fontSize: '12px' }}
                    value={cat}
                    onChange={(e) => {
                      const newCats = [...(selectedElement.chartCategories || ['Q1', 'Q2', 'Q3', 'Q4'])];
                      newCats[ci] = e.target.value;
                      onUpdateElement({ chartCategories: newCats });
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <span className="ppt-format-label" style={{ display: 'block', marginBottom: '6px' }}>
                Chuỗi dữ liệu số (Series):
              </span>
              {(selectedElement.chartSeries || []).map((ser, si) => (
                <div key={si} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <input
                      type="text"
                      className="ppt-input-text"
                      style={{ fontWeight: 600, width: '130px' }}
                      value={ser.name}
                      onChange={(e) => {
                        const newSeries = [...(selectedElement.chartSeries || [])];
                        newSeries[si] = { ...newSeries[si], name: e.target.value };
                        onUpdateElement({ chartSeries: newSeries });
                      }}
                    />
                    <input
                      type="color"
                      className="ppt-input-color"
                      value={ser.color}
                      onChange={(e) => {
                        const newSeries = [...(selectedElement.chartSeries || [])];
                        newSeries[si] = { ...newSeries[si], color: e.target.value };
                        onUpdateElement({ chartSeries: newSeries });
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {ser.values.map((val, vi) => (
                      <input
                        key={vi}
                        type="number"
                        className="ppt-input-text"
                        style={{ width: '50px', fontSize: '12px' }}
                        value={val}
                        onChange={(e) => {
                          const newSeries = [...(selectedElement.chartSeries || [])];
                          const newVals = [...newSeries[si].values];
                          newVals[vi] = Number(e.target.value);
                          newSeries[si] = { ...newSeries[si], values: newVals };
                          onUpdateElement({ chartSeries: newSeries });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CASE 5: TAB: EFFECTS & ANIMATIONS */}
        {selectedElement && activeTab === 'effects' && (
          <div className="ppt-format-section">
            <div className="ppt-format-section-title">
              <Sliders size={15} /> Đổ Bóng Ngoài (Drop Shadow)
            </div>

            <div className="ppt-format-row">
              <span className="ppt-format-label">Đổ bóng:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!selectedElement.shapeShadow}
                  onChange={(e) =>
                    onUpdateElement({
                      shapeShadow: e.target.checked,
                      shadowColor: selectedElement.shadowColor || 'rgba(0,0,0,0.25)',
                      shadowBlur: selectedElement.shadowBlur || 12,
                    })
                  }
                />
                <span style={{ fontSize: '13px' }}>Bật đổ bóng đối tượng</span>
              </label>
            </div>

            {selectedElement.shapeShadow && (
              <>
                <div className="ppt-format-row">
                  <span className="ppt-format-label">Độ mờ bóng (Blur):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="2"
                      max="40"
                      value={selectedElement.shadowBlur ?? 12}
                      onChange={(e) => onUpdateElement({ shadowBlur: Number(e.target.value) })}
                      style={{ width: '90px' }}
                    />
                    <span style={{ fontSize: '12px' }}>{selectedElement.shadowBlur ?? 12}px</span>
                  </div>
                </div>

                <div className="ppt-format-row">
                  <span className="ppt-format-label">Độ lệch dọc (Y):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={selectedElement.shadowOffsetY ?? 6}
                      onChange={(e) => onUpdateElement({ shadowOffsetY: Number(e.target.value) })}
                      style={{ width: '90px' }}
                    />
                    <span style={{ fontSize: '12px' }}>{selectedElement.shadowOffsetY ?? 6}px</span>
                  </div>
                </div>
              </>
            )}

            {/* Animation details */}
            <div style={{ marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <div className="ppt-format-section-title">
                🎬 Hoạt Ảnh Của Đối Tượng
              </div>

              <div className="ppt-format-row">
                <span className="ppt-format-label">Hiệu ứng:</span>
                <select
                  className="ppt-select"
                  value={selectedElement.animation?.type || 'none'}
                  onChange={(e) =>
                    onUpdateElement({
                      animation: {
                        type: e.target.value as AnimationType,
                        duration: selectedElement.animation?.duration || 0.5,
                        delay: selectedElement.animation?.delay || 0,
                      },
                    })
                  }
                >
                  <option value="none">Không hiệu ứng</option>
                  <option value="appear">Xuất hiện (Appear)</option>
                  <option value="fade-in">Mờ dần vào (Fade In)</option>
                  <option value="fly-in-up">Bay từ dưới lên (Fly In Up)</option>
                  <option value="fly-in-left">Bay từ trái sang (Fly In Left)</option>
                  <option value="zoom-in">Phóng to (Zoom In)</option>
                  <option value="bounce">Nảy bóng (Bounce)</option>
                </select>
              </div>

              {selectedElement.animation && selectedElement.animation.type !== 'none' && (
                <div className="ppt-format-row">
                  <span className="ppt-format-label">Thời lượng (giây):</span>
                  <select
                    className="ppt-select"
                    value={selectedElement.animation.duration}
                    onChange={(e) =>
                      onUpdateElement({
                        animation: {
                          ...selectedElement.animation!,
                          duration: Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value="0.25">0.25 giây (Rất nhanh)</option>
                    <option value="0.5">0.5 giây (Tiêu chuẩn)</option>
                    <option value="1">1.0 giây (Chậm rãi)</option>
                    <option value="2">2.0 giây (Rất chậm)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
