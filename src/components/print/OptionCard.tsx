import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export type CardOption<T extends string | number> = { value: T; title: string; subtitle?: string; icon?: ReactNode; group?: string };

type Props<T extends string | number> = {
  label: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  options: CardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);
  return ref;
}

export function CardFace({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <>
      <span className="mp-card-icon">{icon}</span>
      <span className="mp-card-text">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </>
  );
}

export function OptionCard<T extends string | number>({ label, icon, title, subtitle, options, value, onChange, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div className="mp-card-wrap" ref={ref}>
      <button type="button" className="mp-card" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <CardFace icon={icon} title={title} subtitle={subtitle} />
        <ChevronDown size={16} className="mp-card-caret" />
      </button>
      {open && (
        <div className="mp-card-list" role="listbox" aria-label={label}>
          {options.map((option, index) => {
            const previous = index > 0 ? options[index - 1].group : undefined;
            const heading = option.group && option.group !== previous ? option.group : null;
            return (
              <div key={String(option.value)} className="mp-card-option-wrap">
                {heading && <div className="mp-card-group">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`mp-card-option ${option.value === value ? 'on' : ''}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <CardFace icon={option.icon ?? icon} title={option.title} subtitle={option.subtitle} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
