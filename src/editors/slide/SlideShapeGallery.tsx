import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Shapes } from 'lucide-react';
import { shapesByCategory } from '../../lib/slideShapes';
import { ShapeGlyph } from './SlideShapeSvg';

interface SlideShapeGalleryProps {
  onPick: (shapeId: string) => void;
  title?: string;
  label?: string;
  large?: boolean;
}

const CATEGORIES = shapesByCategory();
const POPOVER_WIDTH = 348;

export function SlideShapeGallery({ onPick, title = 'Tất cả hình dạng', label, large = false }: SlideShapeGalleryProps) {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const close = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (popoverRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      setAnchor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAnchor(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const toggle = () => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      left: Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, rect.left)),
      top: rect.bottom + 4,
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${large ? 'ppt-tool-btn-large' : 'ppt-tool-btn'} ${anchor ? 'is-active' : ''}`}
        onClick={toggle}
        title={title}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
      >
        <Shapes size={large ? 22 : 16} />
        {label ? <span>{label}</span> : <ChevronDown size={10} />}
      </button>
      {anchor && (
        <div
          ref={popoverRef}
          className="ppt-shape-gallery"
          style={{ left: anchor.left, top: anchor.top, width: POPOVER_WIDTH, maxHeight: `calc(100vh - ${anchor.top + 12}px)` }}
          role="menu"
        >
          {CATEGORIES.map((group) => (
            <section key={group.category}>
              <h5>{group.label}</h5>
              <div className="ppt-shape-gallery-grid">
                {group.shapes.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    title={shape.label}
                    aria-label={shape.label}
                    onClick={() => {
                      onPick(shape.id);
                      setAnchor(null);
                    }}
                  >
                    <ShapeGlyph def={shape} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
