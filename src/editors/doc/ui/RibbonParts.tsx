import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const keepFocus = (event: React.MouseEvent) => event.preventDefault();

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-section">
      <div className="ribbon-controls">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="ribbon-two-rows">{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="ribbon-row">{children}</div>;
}

type BtnProps = { icon: ReactNode; label?: ReactNode; title: string; onClick: () => void; active?: boolean; disabled?: boolean };

export function Big({ icon, label, title, onClick, active, disabled }: BtnProps) {
  return (
    <button type="button" className={`ribbon-btn-large ${active ? 'active' : ''}`} title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={keepFocus} onClick={onClick}>
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

export function Small({ icon, label, title, onClick, active, disabled }: BtnProps) {
  return (
    <button type="button" className={`ribbon-btn-small ${active ? 'active' : ''} ${label ? 'with-label' : ''}`} title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={keepFocus} onClick={onClick}>
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

const MENU_MARGIN = 8;

function placeMenu(host: HTMLElement) {
  const menu = host.querySelector<HTMLElement>(':scope > .ribbon-menu');
  if (!menu) return;
  const anchor = host.getBoundingClientRect();
  const left = Math.max(MENU_MARGIN, Math.min(anchor.left, window.innerWidth - menu.offsetWidth - MENU_MARGIN));
  const top = anchor.bottom + 4;
  Object.assign(menu.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, maxHeight: `${Math.max(160, window.innerHeight - top - MENU_MARGIN)}px` });
}

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!open || !host) return;
    const place = () => placeMenu(host);
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
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as globalThis.Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function Dropdown({ trigger, title, children, large, active, width }: { trigger: ReactNode; title: string; children: (close: () => void) => ReactNode; large?: boolean; active?: boolean; width?: number }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="ribbon-dropdown" ref={ref}>
      <button type="button" className={`${large ? 'ribbon-btn-large' : 'ribbon-btn-small with-label'} ${active || open ? 'active' : ''}`} title={title} aria-label={title} aria-haspopup="menu" aria-expanded={open} onMouseDown={keepFocus} onClick={() => setOpen(!open)}>
        {trigger}
        <ChevronDown size={10} className="dropdown-caret" />
      </button>
      {open && (
        <div className="ribbon-menu" role="menu" style={width ? { width } : undefined} onMouseDown={(event) => { if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) event.preventDefault(); }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, label, hint, onClick, active, danger }: { icon?: ReactNode; label: ReactNode; hint?: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`ribbon-menu-item ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="menu-icon">{icon}</span>
      <span className="menu-label">{label}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  );
}

export const MenuSeparator = () => <div className="ribbon-menu-sep" role="separator" />;
export const MenuHeading = ({ children }: { children: ReactNode }) => <div className="ribbon-menu-heading">{children}</div>;

export const THEME_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
];

export function ColorPicker({ title, swatch, icon, onPick, noneLabel }: { title: string; swatch: string; icon: ReactNode; onPick: (color: string | null) => void; noneLabel: string }) {
  return (
    <Dropdown title={title} trigger={<span className="color-trigger">{icon}<span className="color-bar" style={{ background: swatch || 'transparent' }} /></span>}>
      {(close) => (
        <div className="color-menu">
          <button type="button" className="ribbon-menu-item" onClick={() => { onPick(null); close(); }}>{noneLabel}</button>
          <div className="color-grid">
            {THEME_COLORS.map((color) => (
              <button key={color} type="button" className="color-swatch" style={{ background: color }} title={color} aria-label={color} onClick={() => { onPick(color); close(); }} />
            ))}
          </div>
          <label className="ribbon-menu-item custom-color">
            <span>Màu khác…</span>
            <input type="color" onChange={(event) => onPick(event.target.value)} />
          </label>
        </div>
      )}
    </Dropdown>
  );
}
