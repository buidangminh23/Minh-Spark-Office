import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { CONVERSION_PRESET_GROUPS, type ConversionPreset, type FormatBadge } from '../lib/conversionPresets';
import { SuiteLogo } from './SuiteLogo';
import './conversion.css';

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 16;
const STACKED_LAYOUT_MAX_WIDTH = 768;

function FormatTile({ badge, size }: { badge: FormatBadge; size: number }) {
  return (
    <span className="format-tile" style={{ '--format-tile-size': `${size}px`, '--format-tile-color': badge.color } as CSSProperties}>
      <span>{badge.text}</span>
    </span>
  );
}

export function ConversionPair({ preset, size = 36 }: { preset: ConversionPreset; size?: number }) {
  return (
    <span className="conversion-pair" aria-hidden="true">
      <SuiteLogo kind={preset.from} size={size} />
      <ArrowRight size={Math.round(size * 0.5)} className="conversion-pair-arrow" />
      {typeof preset.to === 'string' ? <SuiteLogo kind={preset.to} size={size} /> : <FormatTile badge={preset.to} size={size} />}
    </span>
  );
}

function menuPosition(anchor: DOMRect, edge: number, menu: DOMRect): CSSProperties {
  const maxLeft = window.innerWidth - menu.width - VIEWPORT_MARGIN;
  const maxTop = window.innerHeight - menu.height - VIEWPORT_MARGIN;
  if (window.innerWidth <= STACKED_LAYOUT_MAX_WIDTH) {
    return { left: Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft)), top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.bottom + MENU_GAP, maxTop)) };
  }
  return { left: Math.min(edge + MENU_GAP, maxLeft), top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.top - MENU_GAP, maxTop)) };
}

export function ConversionMenu({ anchor, onPick, onAll, onClose }: { anchor: HTMLElement; onPick: (preset: ConversionPreset) => void; onAll: () => void; onClose: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: -9999, top: 0 });
  const close = useRef(onClose);

  useLayoutEffect(() => { close.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const place = () => {
      if (!menu.current) return;
      const rect = anchor.getBoundingClientRect();
      const edge = anchor.closest('aside')?.getBoundingClientRect().right ?? rect.right;
      setPosition(menuPosition(rect, edge, menu.current.getBoundingClientRect()));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !anchor.contains(target)) close.current();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); anchor.focus(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', keys); };
  }, [anchor]);

  return createPortal(
    <div ref={menu} className="conversion-menu" role="menu" aria-label="Chuyển định dạng" style={position}>
      {CONVERSION_PRESET_GROUPS.map((group) => (
        <div key={group.title} className="conversion-menu-group" role="group" aria-label={group.title}>
          <div className="conversion-menu-heading" aria-hidden="true">{group.title}</div>
          <div className="conversion-menu-grid">
            {group.presets.map((preset) => (
              <button key={preset.id} role="menuitem" className="conversion-menu-item" onClick={() => onPick(preset)}>
                <ConversionPair preset={preset} size={26} />
                <span className="conversion-menu-text"><strong>{preset.title}</strong><span>{preset.note}</span></span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button role="menuitem" className="conversion-menu-item conversion-menu-more" onClick={onAll}>
        <span className="conversion-menu-text"><strong>Nhiều loại tệp cùng lúc</strong><span>Chọn định dạng riêng cho từng tệp</span></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
