import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, SquareArrowOutDownRight } from 'lucide-react';

export function RibbonGroup({ label, onLauncher, launcherTitle, children, column }: { label: string; onLauncher?: () => void; launcherTitle?: string; children: ReactNode; column?: boolean }) {
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className={`ppt-group-content ${column ? 'ppx-col' : ''}`}>{children}</div>
      <div className="ppt-group-footer ppx-footer">
        <span>{label}</span>
        {onLauncher && (
          <button type="button" className="ppx-launcher" onClick={onLauncher} title={launcherTitle ?? `Mở hộp thoại ${label}`} aria-label={launcherTitle ?? `Mở hộp thoại ${label}`}>
            <SquareArrowOutDownRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

export function GroupFooter({ label, onLauncher, launcherTitle }: { label: string; onLauncher?: () => void; launcherTitle?: string }) {
  return (
    <div className="ppt-group-footer ppx-footer">
      <span>{label}</span>
      {onLauncher && (
        <button type="button" className="ppx-launcher" onClick={onLauncher} title={launcherTitle ?? `Mở hộp thoại ${label}`} aria-label={launcherTitle ?? `Mở hộp thoại ${label}`}>
          <SquareArrowOutDownRight size={10} />
        </button>
      )}
    </div>
  );
}

export function GroupLauncher({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button type="button" className="ppx-launcher ppx-launcher-abs" onClick={onClick} title={title} aria-label={title}>
      <SquareArrowOutDownRight size={10} />
    </button>
  );
}

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handle = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', handle, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', handle, true);
      document.removeEventListener('keydown', key);
    };
  }, [open, close]);
  return ref;
}

interface DropButtonProps {
  icon: ReactNode;
  label?: string;
  title: string;
  large?: boolean;
  disabled?: boolean;
  active?: boolean;
  onMain?: () => void;
  menuWidth?: number;
  children: (close: () => void) => ReactNode;
}

export function DropButton({ icon, label, title, large, disabled, active, onMain, menuWidth = 240, children }: DropButtonProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useOutsideClose(open, close);
  const toggle = () => setOpen((value) => !value);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const anchor = ref.current;
    if (!open || !menu || !anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const top = rect.bottom + 4;
      Object.assign(menu.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, marginTop: '0px', maxHeight: `${Math.max(160, window.innerHeight - top - 8)}px`, overflowY: 'auto', zIndex: '1300' });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, ref]);
  const buttonClass = `${large ? 'ppt-tool-btn-large' : 'ppt-tool-btn'} ${active ? 'is-active' : ''}`;
  return (
    <div className="ppx-drop" ref={ref}>
      {onMain ? (
        <div className={`ppx-split ${large ? 'is-large' : ''}`}>
          <button type="button" className={buttonClass} disabled={disabled} onClick={onMain} title={title}>
            {icon}
            {label && <span>{label}</span>}
          </button>
          <button type="button" className="ppx-split-arrow" disabled={disabled} onClick={toggle} title={`${title}: tùy chọn`} aria-haspopup="menu" aria-expanded={open}>
            <ChevronDown size={11} />
          </button>
        </div>
      ) : (
        <button type="button" className={buttonClass} disabled={disabled} onClick={toggle} title={title} aria-haspopup="menu" aria-expanded={open}>
          {icon}
          {label && (
            <span className="ppx-drop-label">
              {label}
              <ChevronDown size={10} />
            </span>
          )}
          {!label && <ChevronDown size={10} />}
        </button>
      )}
      {open && (
        <div ref={menuRef} className="ppx-menu" style={{ width: menuWidth }} role="menu">
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, label, hint, onClick, active, disabled }: { icon?: ReactNode; label: ReactNode; hint?: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`ppx-menu-item ${active ? 'is-active' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="ppx-menu-icon">{icon}</span>
      <span className="ppx-menu-text">{label}</span>
      {hint && <span className="ppx-menu-hint">{hint}</span>}
    </button>
  );
}

export function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="ppt-layout-menu-title">{children}</div>;
}

export function MenuSeparator() {
  return <div className="ppx-menu-sep" />;
}

export function SwatchGrid({ colors, onPick, columns = 5, none }: { colors: string[]; onPick: (color: string | undefined) => void; columns?: number; none?: string }) {
  return (
    <>
      <div className="ppx-swatches" style={{ gridTemplateColumns: `repeat(${columns}, 22px)` }}>
        {colors.map((color) => (
          <button type="button" key={color} className="ppx-swatch" style={{ background: color }} title={color} onClick={() => onPick(color)} />
        ))}
      </div>
      {none && (
        <button type="button" className="ppx-menu-item" onClick={() => onPick(undefined)}>
          <span className="ppx-menu-icon" />
          <span className="ppx-menu-text">{none}</span>
        </button>
      )}
    </>
  );
}

export function Dialog({ title, onClose, children, footer, wide, width }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; width?: number }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="ppt-modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`ppt-dialog-card ppx-dialog ${wide ? 'is-wide' : ''}`} style={width ? { width } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ppt-dialog-header">
          <span style={{ fontWeight: 700 }}>{title}</span>
          <button type="button" className="ppt-dialog-close-btn" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="ppt-dialog-body ppx-dialog-body">{children}</div>
        {footer && <div className="ppt-dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function DialogButtons({ onCancel, onOk, okLabel = 'OK', okDisabled }: { onCancel: () => void; onOk: () => void; okLabel?: string; okDisabled?: boolean }) {
  return (
    <>
      <button type="button" className="ppt-secondary-action-btn" onClick={onCancel}>
        Hủy
      </button>
      <button type="button" className="ppt-primary-action-btn" onClick={onOk} disabled={okDisabled}>
        {okLabel}
      </button>
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ppx-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
