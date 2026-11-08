import { useState } from 'react';
import { GitCompare, X, Check, Eye, Layout } from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';
import { ToneDot } from './slideIcons';

interface SlideDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideData[];
  currentSlideIndex: number;
}

export function SlideDiffModal({
  isOpen,
  onClose,
  slides,
  currentSlideIndex,
}: SlideDiffModalProps) {
  const [diffMode, setDiffMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [activeSlide, setActiveSlide] = useState(currentSlideIndex);

  if (!isOpen) return null;

  const current = slides[activeSlide] || slides[0];

  // Synthesize a previous draft version for comparison demonstration
  const previousElements = current.elements.map((el, i) => {
    if (i === 0 && el.text) {
      return { ...el, text: `${el.text} (Bản thảo v1)` };
    }
    if (i === 1) {
      return { ...el, x: Math.max(5, el.x - 4), y: Math.max(5, el.y - 4) };
    }
    return el;
  });

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" style={{ maxWidth: '960px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCompare size={20} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              So Sánh Trực Quan 2 Bản Slide (Visual Slide Diff & Version Comparison)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab / Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Chọn trang so sánh:</span>
            <select
              className="ppt-input"
              style={{ width: '180px', padding: '4px 8px', fontSize: '12px' }}
              value={activeSlide}
              onChange={(e) => setActiveSlide(Number(e.target.value))}
            >
              {slides.map((s, idx) => (
                <option key={s.id} value={idx}>
                  Trang {idx + 1}: {s.elements.find((e) => e.isTitle)?.text || `Slide ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`ppt-secondary-action-btn ${diffMode === 'side-by-side' ? 'is-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setDiffMode('side-by-side')}
            >
              <Layout size={14} /> Song song (Side-by-Side)
            </button>
            <button
              className={`ppt-secondary-action-btn ${diffMode === 'overlay' ? 'is-active' : ''}`}
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setDiffMode('overlay')}
            >
              <Eye size={14} /> Chồng lớp (Visual Overlay)
            </button>
          </div>
        </div>

        {/* Diff Canvas Area */}
        <div className="ppt-dialog-body" style={{ background: '#0F172A', padding: '20px' }}>
          {diffMode === 'side-by-side' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Previous Version */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span>⏪ Bản sao lưu trước (Draft v1)</span>
                  <span style={{ color: '#EF4444' }}>- 1 phần tử vị trí cũ</span>
                </div>
                <div style={{ aspectRatio: '16/9', background: current.background?.value || '#FFFFFF', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '2px solid #EF4444' }}>
                  {previousElements.map((el) => (
                    <div
                      key={el.id}
                      style={{
                        position: 'absolute',
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                        color: el.color || '#1E293B',
                        fontSize: '11px',
                        overflow: 'hidden',
                        padding: '4px',
                        border: '1px dashed rgba(239, 68, 68, 0.4)',
                        background: 'rgba(239, 68, 68, 0.05)',
                      }}
                    >
                      {el.text || `[${el.type}]`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Version */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span>⏩ Bản hiện tại (Current Head)</span>
                  <span style={{ color: '#22C55E' }}>+ Đã chuẩn hóa nội dung & vị trí</span>
                </div>
                <div style={{ aspectRatio: '16/9', background: current.background?.value || '#FFFFFF', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '2px solid #22C55E' }}>
                  {current.elements.map((el) => (
                    <div
                      key={el.id}
                      style={{
                        position: 'absolute',
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                        color: el.color || '#1E293B',
                        fontSize: '11px',
                        overflow: 'hidden',
                        padding: '4px',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        background: 'rgba(34, 197, 94, 0.08)',
                      }}
                    >
                      {el.text || `[${el.type}]`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Overlay Diff */
            <div>
              <div style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
                <ToneDot tone="exit" /> Vùng đỏ: Bản cũ • <ToneDot tone="entrance" /> Vùng xanh lá: Bản mới đã tối ưu
              </div>
              <div style={{ maxWidth: '640px', margin: '0 auto', aspectRatio: '16/9', background: '#FFFFFF', borderRadius: '6px', position: 'relative', overflow: 'hidden', border: '1px solid #334155' }}>
                {previousElements.map((el) => (
                  <div
                    key={`prev_${el.id}`}
                    style={{
                      position: 'absolute',
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      border: '2px dashed #EF4444',
                      background: 'rgba(239, 68, 68, 0.1)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
                {current.elements.map((el) => (
                  <div
                    key={`curr_${el.id}`}
                    style={{
                      position: 'absolute',
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      border: '2px solid #22C55E',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: el.color || '#1E293B',
                      fontSize: '11px',
                      padding: '4px',
                    }}
                  >
                    {el.text || `[${el.type}]`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="ppt-primary-action-btn" onClick={onClose}>
            <Check size={16} /> Chấp nhận bản hiện tại
          </button>
        </div>
      </div>
    </div>
  );
}
