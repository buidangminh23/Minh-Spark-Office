import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePopover } from './RibbonParts';

const MAX_SIZE = 1638;

const parseFontSize = (text: string) => {
  const value = parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 1 && value <= MAX_SIZE ? Math.round(value * 2) / 2 : null;
};

export default function FontSizeBox({ value, sizes, onPick }: { value: string; sizes: readonly number[]; onPick: (size: number) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [draft, setDraft] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const current = parseFontSize(value);

  useEffect(() => {
    if (!open || !list.current) return;
    list.current.querySelector<HTMLElement>('.size-item.highlight, .size-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [open, cursor]);

  const apply = (size: number | null) => {
    setDraft(null);
    setOpen(false);
    if (size !== null && size !== current) onPick(size);
  };

  const toggle = (next: boolean) => {
    if (next) setCursor(sizes.findIndex((size) => size === current));
    setOpen(next);
  };

  const move = (step: 1 | -1) => {
    if (!open) {
      toggle(true);
      return;
    }
    setCursor((index) => {
      const start = index < 0 ? sizes.findIndex((size) => size > (current ?? 0)) - (step > 0 ? 1 : 0) : index;
      return Math.min(sizes.length - 1, Math.max(0, start + step));
    });
  };

  return (
    <div className={`ribbon-dropdown size-box ${open ? 'open' : ''}`} ref={ref}>
      <input
        ref={input}
        className="size-input"
        title="Cỡ chữ"
        aria-label="Cỡ chữ"
        role="combobox"
        aria-expanded={open}
        inputMode="decimal"
        value={draft ?? value}
        onFocus={(e) => { setDraft(value); const target = e.target; requestAnimationFrame(() => target.select()); }}
        onChange={(e) => { setDraft(e.target.value); setCursor(-1); }}
        onBlur={() => { if (draft !== null) apply(parseFontSize(draft)); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          if (e.key === 'Enter') {
            e.preventDefault();
            apply(open && cursor >= 0 && draft === value ? sizes[cursor] : parseFontSize(draft ?? value));
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') { setDraft(null); setOpen(false); e.currentTarget.blur(); }
        }}
      />
      <button
        type="button"
        className="size-toggle"
        title="Chọn cỡ chữ"
        aria-label="Chọn cỡ chữ"
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggle(!open)}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="ribbon-menu size-menu" role="listbox" aria-label="Cỡ chữ" ref={list}>
          {sizes.map((size, index) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={size === current}
              className={`size-item ${size === current ? 'active' : ''} ${index === cursor ? 'highlight' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { input.current?.blur(); apply(size); }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
