import { useState } from 'react';
import { Palette, Sparkles, Check, X } from 'lucide-react';
import type { SlideTheme } from '../../lib/slideTypes';

interface SlideBrandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBrandTheme: (theme: Partial<SlideTheme>) => void;
}

interface PalettePreset {
  name: string;
  desc: string;
  primary: string;
  secondary: string;
  accent: string;
  darkNeutral: string;
  lightNeutral: string;
}

const PRESET_PALETTES: PalettePreset[] = [
  {
    name: 'Công Nghệ Hiện Đại (Tech Blue)',
    desc: 'Tông xanh dương trí tuệ, điểm nhấn cam năng động, nền sáng tinh khiết.',
    primary: '#0284C7',
    secondary: '#0F172A',
    accent: '#F97316',
    darkNeutral: '#1E293B',
    lightNeutral: '#F8FAFC',
  },
  {
    name: 'Doanh Nghiệp Đẳng Cấp (Executive Navy)',
    desc: 'Xanh hải quân quyền lực kết hợp vàng kim sang trọng cho bài báo cáo cấp cao.',
    primary: '#1E3A8A',
    secondary: '#B45309',
    accent: '#D97706',
    darkNeutral: '#0F172A',
    lightNeutral: '#F1F5F9',
  },
  {
    name: 'Sáng Tạo Xanh Lá (Eco Emerald)',
    desc: 'Tông lục bảo biểu trưng cho sự tăng trưởng, bền vững và sinh thái.',
    primary: '#059669',
    secondary: '#064E3B',
    accent: '#10B981',
    darkNeutral: '#064E3B',
    lightNeutral: '#ECFDF5',
  },
  {
    name: 'Tối Giản Sang Trọng (Minimal Obsidian)',
    desc: 'Dark mode cao cấp với màu tím neon tương phản sắc sảo cho hội thảo công nghệ.',
    primary: '#8B5CF6',
    secondary: '#6366F1',
    accent: '#EC4899',
    darkNeutral: '#0B0F19',
    lightNeutral: '#1E293B',
  },
];

export function SlideBrandPaletteModal({
  isOpen,
  onClose,
  onApplyBrandTheme,
}: SlideBrandPaletteModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PalettePreset>(PRESET_PALETTES[0]);
  const [customPrimary, setCustomPrimary] = useState(PRESET_PALETTES[0].primary);
  const [customSecondary, setCustomSecondary] = useState(PRESET_PALETTES[0].secondary);
  const [customAccent, setCustomAccent] = useState(PRESET_PALETTES[0].accent);
  const [customDark, setCustomDark] = useState(PRESET_PALETTES[0].darkNeutral);
  const [customLight, setCustomLight] = useState(PRESET_PALETTES[0].lightNeutral);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (p: PalettePreset) => {
    setSelectedPreset(p);
    setCustomPrimary(p.primary);
    setCustomSecondary(p.secondary);
    setCustomAccent(p.accent);
    setCustomDark(p.darkNeutral);
    setCustomLight(p.lightNeutral);
  };

  const handleApply = () => {
    onApplyBrandTheme({
      primaryColor: customPrimary,
      secondaryColor: customSecondary,
      accentColor: customAccent,
      backgroundColor: customLight,
      cardBackground: customLight === '#F8FAFC' ? '#FFFFFF' : customLight,
      titleColor: customDark,
      textColor: customDark,
    });
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={20} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              Trích Xuất Bảng Màu Thương Hiệu (Brand Palette Generator)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="ppt-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Tự động trích xuất bảng 5 màu nhận diện chuẩn (Chính, Phụ, Nhấn, Nền tối, Nền sáng) và đồng bộ tức thì vào toàn bộ Slide Theme, Bảng biểu và Biểu đồ.
          </p>

          <div>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B', marginBottom: '8px', display: 'block' }}>
              Chọn bộ nhận diện thương hiệu mẫu hoặc tùy chỉnh:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {PRESET_PALETTES.map((p) => {
                const isSelected = selectedPreset.name === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => handleSelectPreset(p)}
                    style={{
                      border: `2px solid ${isSelected ? '#D83B01' : '#E2E8F0'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#FFF7ED' : '#FFFFFF',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>{p.name}</strong>
                      {isSelected && <Check size={16} color="#D83B01" />}
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 8px 0' }}>{p.desc}</p>
                    <div style={{ display: 'flex', gap: '6px', height: '22px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ flex: 2, background: p.primary }} title={`Chính: ${p.primary}`} />
                      <div style={{ flex: 1.5, background: p.secondary }} title={`Phụ: ${p.secondary}`} />
                      <div style={{ flex: 1, background: p.accent }} title={`Nhấn: ${p.accent}`} />
                      <div style={{ flex: 1, background: p.darkNeutral }} title={`Tối: ${p.darkNeutral}`} />
                      <div style={{ flex: 1, background: p.lightNeutral, border: '1px solid #CBD5E1' }} title={`Sáng: ${p.lightNeutral}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color adjustments */}
          <div>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B', marginBottom: '8px', display: 'block' }}>
              Bảng 5 màu đang áp dụng:
            </span>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Primary (Chính)
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <span style={{ fontFamily: 'monospace' }}>{customPrimary}</span>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Secondary (Phụ)
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="color" value={customSecondary} onChange={(e) => setCustomSecondary(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <span style={{ fontFamily: 'monospace' }}>{customSecondary}</span>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Accent (Nhấn)
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <span style={{ fontFamily: 'monospace' }}>{customAccent}</span>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Dark Neutral (Chữ/Nền tối)
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="color" value={customDark} onChange={(e) => setCustomDark(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <span style={{ fontFamily: 'monospace' }}>{customDark}</span>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Light Neutral (Nền sáng)
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="color" value={customLight} onChange={(e) => setCustomLight(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <span style={{ fontFamily: 'monospace' }}>{customLight}</span>
                </div>
              </label>
            </div>
          </div>

          {isSuccess && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
              <Check size={16} /> Đã áp dụng bảng màu thương hiệu vào toàn bộ bài trình chiếu!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button className="ppt-primary-action-btn" onClick={handleApply}>
            <Sparkles size={16} /> Áp dụng bảng màu vào Slide Theme
          </button>
        </div>
      </div>
    </div>
  );
}
