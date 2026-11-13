import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, Search } from 'lucide-react';
import './featureMenu.css';

export type FeatureItem = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  group: string;
  run: () => void;
};

const MARGIN = 8;
const WIDTH = 340;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function FeatureMenu({ items, className, labelClass, activeClass = 'active' }: { items: FeatureItem[]; className: string; labelClass?: string; activeClass?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - WIDTH - MARGIN));
      const top = anchor.bottom + 4;
      setPosition({ left, top, maxHeight: Math.max(220, window.innerHeight - top - MARGIN) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const needle = normalize(query.trim());
    const matched = needle ? items.filter((item) => normalize(`${item.label} ${item.description} ${item.group}`).includes(needle)) : items;
    const byGroup = new Map<string, FeatureItem[]>();
    for (const item of matched) byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item]);
    return [...byGroup.entries()];
  }, [items, query]);

  const toggle = () => {
    setQuery('');
    setOpen((value) => !value);
  };

  const run = (item: FeatureItem) => {
    setOpen(false);
    item.run();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${className} ${open ? activeClass : ''}`}
        title="Các tính năng riêng của Office 23"
        aria-label="Tính năng"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <LayoutGrid size={20} color="#0f766e" />
        <span className={labelClass}>Tính năng</span>
      </button>
      {open && position && createPortal(
        <div ref={panelRef} className="feature-menu" role="menu" aria-label="Tính năng" style={{ left: position.left, top: position.top, maxHeight: position.maxHeight, width: WIDTH }}>
          <label className="feature-menu-search">
            <Search size={14} />
            <input autoFocus value={query} placeholder={`Tìm trong ${items.length} tính năng`} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="feature-menu-list">
            {groups.length === 0 && <p className="feature-menu-empty">Không có tính năng nào khớp</p>}
            {groups.map(([group, list]) => (
              <section key={group} className="feature-menu-group">
                <h3>{group}</h3>
                {list.map((item) => (
                  <button key={item.id} type="button" role="menuitem" className="feature-menu-item" onClick={() => run(item)}>
                    <span className="feature-menu-icon">{item.icon}</span>
                    <span className="feature-menu-text">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
