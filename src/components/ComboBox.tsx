import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

type Variant = 'ribbon' | 'field' | 'ppt' | 'plain';

type Props = {
  value: string | number;
  options: readonly (string | number)[];
  onCommit: (value: string) => void;
  numeric?: { min: number; max: number; step?: number };
  variant?: Variant;
  label: string;
  width?: number | string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  style?: CSSProperties;
  onFocus?: () => void;
  onBlur?: () => void;
  onInput?: (value: string) => void;
};

type Place = { left: number; top: number; width: number; maxHeight: number; up: boolean; host: HTMLElement };

const MENU_GAP = 2;
const MENU_MAX = 360;

function parseComboNumber(text: string, min: number, max: number, step = 0.5): number | null {
  const value = parseFloat(text.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

export default function ComboBox({ value, options, onCommit, numeric, variant = 'field', label, width, disabled, readOnly, className, style, onFocus, onBlur, onInput }: Props) {
  const text = String(value);
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const picking = useRef(false);
  const input = useRef<HTMLInputElement | null>(null);
  const items = options.map(String);
  const currentIndex = items.findIndex((item) => numeric ? Number(item) === Number(text) : item === text);

  const measure = () => {
    const host = root.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const height = host.ownerDocument.defaultView?.innerHeight ?? 800;
    const below = height - rect.bottom - 8;
    const above = rect.top - 8;
    const up = below < Math.min(MENU_MAX, items.length * 26) && above > below;
    setPlace({ left: rect.left, top: up ? rect.top - MENU_GAP : rect.bottom + MENU_GAP, width: rect.width, maxHeight: Math.min(MENU_MAX, up ? above : below), up, host: host.ownerDocument.body });
  };

  useEffect(() => {
    const view = root.current?.ownerDocument.defaultView;
    if (!open || !view) return;
    const onScroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const onResize = () => setOpen(false);
    view.addEventListener('resize', onResize);
    view.addEventListener('scroll', onScroll, true);
    return () => {
      view.removeEventListener('resize', onResize);
      view.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const doc = root.current?.ownerDocument ?? document;
    const away = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    doc.addEventListener('mousedown', away);
    return () => doc.removeEventListener('mousedown', away);
  }, [open]);

  useEffect(() => {
    if (!open || !menu.current) return;
    menu.current.querySelector<HTMLElement>('.combo-item.highlight, .combo-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [open, cursor, place]);

  const show = (next: boolean) => {
    if (next) {
      setCursor(currentIndex);
      measure();
    }
    setOpen(next);
  };

  const commit = (raw: string | null) => {
    setDraft(null);
    setOpen(false);
    if (raw === null) return;
    if (numeric) {
      const parsed = parseComboNumber(raw, numeric.min, numeric.max, numeric.step);
      if (parsed !== null && parsed !== Number(text)) onCommit(String(parsed));
      return;
    }
    if (raw !== text) onCommit(raw);
  };

  const move = (step: 1 | -1) => {
    if (!open) {
      show(true);
      return;
    }
    setCursor((index) => {
      if (index < 0 && numeric) {
        const target = Number(draft ?? text);
        const after = items.findIndex((item) => Number(item) > target);
        const start = after < 0 ? items.length : after;
        return Math.min(items.length - 1, Math.max(0, step > 0 ? start : start - 1));
      }
      return Math.min(items.length - 1, Math.max(0, index + step));
    });
  };

  const choose = (item: string) => {
    picking.current = true;
    input.current?.blur();
    picking.current = false;
    setDraft(null);
    setOpen(false);
    if (item !== text) onCommit(item);
  };

  return (
    <div ref={root} className={`combo combo-${variant} ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className ?? ''}`} style={{ width, ...style }}>
      <input
        ref={input}
        className="combo-input"
        role="combobox"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-autocomplete="list"
        inputMode={numeric ? 'decimal' : undefined}
        disabled={disabled}
        readOnly={readOnly}
        value={draft ?? text}
        onFocus={(e) => { setDraft(text); onFocus?.(); const target = e.target; requestAnimationFrame(() => target.select()); }}
        onChange={(e) => { setDraft(e.target.value); setCursor(-1); onInput?.(e.target.value); }}
        onBlur={() => { if (!picking.current) commit(draft); onBlur?.(); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && cursor >= 0 && (draft === null || draft === text)) choose(items[cursor]);
            else { commit(draft); e.currentTarget.blur(); }
          } else if (e.key === 'Escape' && (open || draft !== null)) {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
      />
      <button type="button" className="combo-toggle" tabIndex={-1} aria-label={`Mở danh sách ${label.toLowerCase()}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled || readOnly} onMouseDown={(e) => e.preventDefault()} onClick={() => show(!open)}>
        <ChevronDown size={variant === 'field' ? 14 : 12} />
      </button>
      {open && place && createPortal(
        <div
          ref={menu}
          className="combo-menu"
          role="listbox"
          aria-label={label}
          style={{ left: place.left, top: place.top, minWidth: place.width, maxHeight: place.maxHeight, transform: place.up ? 'translateY(-100%)' : undefined }}
        >
          {items.map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              role="option"
              aria-selected={index === currentIndex}
              className={`combo-item ${index === currentIndex ? 'active' : ''} ${index === cursor ? 'highlight' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(item)}
            >
              {item || ' '}
            </button>
          ))}
        </div>,
        place.host,
      )}
    </div>
  );
}
