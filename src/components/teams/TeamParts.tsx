import { useState, type ReactNode } from 'react';
import { colorForUid, initials, ROLE_LABEL, type TeamRole } from '../../lib/teams';

export function TeamAvatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <span className="tm-team-avatar" style={{ '--tm-color': color, '--tm-size': `${size}px` } as React.CSSProperties} aria-hidden="true">
      {initials(name, 'N')}
    </span>
  );
}

export function PersonAvatar({ uid, name, photoURL, size = 32, title }: { uid: string; name: string; photoURL?: string; size?: number; title?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { '--tm-color': colorForUid(uid), '--tm-size': `${size}px` } as React.CSSProperties;
  if (photoURL && !broken) {
    return <img className="tm-person-avatar" style={style} src={photoURL} alt="" title={title} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="tm-person-avatar" style={style} title={title} aria-hidden="true">{initials(name)}</span>;
}

export function RoleBadge({ role }: { role: TeamRole }) {
  return <span className={`tm-role tm-role-${role}`}>{ROLE_LABEL[role]}</span>;
}

export function TmButton({ variant = 'default', icon, children, ...props }: { variant?: 'default' | 'primary' | 'danger' | 'ghost'; icon?: ReactNode; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`tm-btn tm-btn-${variant} ${props.className ?? ''}`}>
      {icon}{children}
    </button>
  );
}

export function TmModal({ title, subtitle, onClose, children, footer, wide, labelledBy = 'tm-modal-title' }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; labelledBy?: string }) {
  return (
    <div className="dialog-backdrop tm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`tm-modal ${wide ? 'tm-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
        <header className="tm-modal-head">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <div className="tm-modal-body">{children}</div>
        {footer && <footer className="tm-modal-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function TmField({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="tm-field">
      <span className="tm-field-label">{label}</span>
      {children}
      {hint && <span className="tm-field-hint">{hint}</span>}
    </label>
  );
}

export function formatDate(value: number) {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: number) {
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}
