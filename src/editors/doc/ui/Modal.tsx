import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, icon, onClose, children, actions, width = 560 }: { title: string; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; width?: number }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <section className="dialog doc-modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width, width: `min(${width}px, calc(100vw - 32px))` }}>
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <div className="doc-modal-head">
          {icon && <span className="doc-modal-icon">{icon}</span>}
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="dialog-subtitle">{subtitle}</div>}
          </div>
        </div>
        <div className="doc-modal-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </section>
    </div>
  );
}
