import { useState } from 'react';
import { Presentation, X, Plus, Trash2 } from 'lucide-react';
import type { SlideData } from '../../lib/slideTypes';

interface SlideCustomShowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideData[];
  customShows?: { id: string; name: string; slideIds: string[] }[];
  onSaveCustomShows: (shows: { id: string; name: string; slideIds: string[] }[]) => void;
  onStartCustomShow: (slideIds: string[]) => void;
}

export function SlideCustomShowsModal({
  isOpen,
  onClose,
  slides,
  customShows = [],
  onSaveCustomShows,
  onStartCustomShow,
}: SlideCustomShowsModalProps) {
  const [shows, setShows] = useState<{ id: string; name: string; slideIds: string[] }[]>(
    customShows.length > 0
      ? customShows
      : [
          {
            id: 'cs_1',
            name: 'Bản 5 phút cho Ban Giám Đốc (Executive Summary)',
            slideIds: slides.slice(0, Math.min(3, slides.length)).map((s) => s.id),
          },
          {
            id: 'cs_2',
            name: 'Bản 20 phút cho Đội Ngũ Kỹ Thuật (Deep-dive Deck)',
            slideIds: slides.map((s) => s.id),
          },
        ]
  );
  const [selectedShowId, setSelectedShowId] = useState<string>(shows[0]?.id || '');

  if (!isOpen) return null;

  const currentShow = shows.find((s) => s.id === selectedShowId) || shows[0];

  const handleToggleSlideInShow = (slideId: string) => {
    if (!currentShow) return;
    const exists = currentShow.slideIds.includes(slideId);
    const updatedIds = exists
      ? currentShow.slideIds.filter((id) => id !== slideId)
      : [...currentShow.slideIds, slideId];

    const updatedShows = shows.map((s) => (s.id === currentShow.id ? { ...s, slideIds: updatedIds } : s));
    setShows(updatedShows);
    onSaveCustomShows(updatedShows);
  };

  const handleAddNewShow = () => {
    const newShow = {
      id: `cs_${Date.now()}`,
      name: `Bài chiếu tùy biến #${shows.length + 1}`,
      slideIds: slides.slice(0, 2).map((s) => s.id),
    };
    const updated = [...shows, newShow];
    setShows(updated);
    setSelectedShowId(newShow.id);
    onSaveCustomShows(updated);
  };

  const handleDeleteShow = (id: string) => {
    const updated = shows.filter((s) => s.id !== id);
    setShows(updated);
    if (selectedShowId === id && updated.length > 0) {
      setSelectedShowId(updated[0].id);
    }
    onSaveCustomShows(updated);
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card is-wide" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Presentation size={20} color="#D83B01" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>
              Bài Trình Chiếu Tùy Biến (Custom Shows & Sections)
            </span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="ppt-dialog-body" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', minHeight: '340px' }}>
          {/* Left: Custom Shows list */}
          <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Danh sách bài chiếu:</span>
              <button
                type="button"
                className="ppt-secondary-action-btn"
                style={{ padding: '2px 8px', fontSize: '11px' }}
                onClick={handleAddNewShow}
                title="Tạo bài chiếu mới"
              >
                <Plus size={12} /> Thêm
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
              {shows.map((s) => {
                const isSelected = s.id === currentShow?.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedShowId(s.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: `1px solid ${isSelected ? '#D83B01' : '#E2E8F0'}`,
                      background: isSelected ? '#FFF7ED' : '#FFFFFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <strong style={{ fontSize: '12px', color: '#1E293B', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {s.name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>{s.slideIds.length} trang chiếu</span>
                    </div>
                    {shows.length > 1 && (
                      <button
                        type="button"
                        style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShow(s.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Checkbox selection of slides */}
          {currentShow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Tên bài trình chiếu tùy biến:
                </label>
                <input
                  type="text"
                  className="ppt-input"
                  style={{ width: '100%' }}
                  value={currentShow.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const updated = shows.map((s) => (s.id === currentShow.id ? { ...s, name: newName } : s));
                    setShows(updated);
                    onSaveCustomShows(updated);
                  }}
                />
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Tích chọn các trang chiếu đưa vào bài này:
                </span>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px' }}>
                  {slides.map((s, idx) => {
                    const checked = currentShow.slideIds.includes(s.id);
                    const title = s.elements.find((e) => e.isTitle)?.text || `Trang ${idx + 1}`;
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: checked ? '#F0FDF4' : '#FFFFFF',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleSlideInShow(s.id)}
                          style={{ accentColor: '#16A34A' }}
                        />
                        <span style={{ fontWeight: 600, color: '#64748B', width: '60px' }}>Trang {idx + 1}:</span>
                        <span style={{ color: '#1E293B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          {currentShow && (
            <button
              className="ppt-primary-action-btn"
              onClick={() => {
                onClose();
                onStartCustomShow(currentShow.slideIds);
              }}
            >
              <Presentation size={16} /> Bắt đầu chiếu bài này ({currentShow.slideIds.length} trang)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
