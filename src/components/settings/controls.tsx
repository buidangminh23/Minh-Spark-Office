import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`st-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch-thumb" />
    </button>
  );
}

export function Select<T extends string | number>({ value, options, onChange, label, wide }: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <span className={`st-select${wide ? ' is-wide' : ''}`}>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(event) => {
          const picked = options.find(([option]) => String(option) === event.target.value);
          if (picked) onChange(picked[0]);
        }}
      >
        {options.map(([option, text]) => <option key={String(option)} value={String(option)}>{text}</option>)}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: readonly (readonly [T, string, ReactNode?])[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="st-segmented" role="radiogroup" aria-label={label}>
      {options.map(([option, text, icon]) => (
        <button key={option} type="button" role="radio" aria-checked={value === option} className={value === option ? 'is-active' : ''} onClick={() => onChange(option)}>
          {icon}{text}
        </button>
      ))}
    </div>
  );
}

export function NumberField({ value, onChange, min, max, step = 1, suffix, label }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
}) {
  return (
    <span className="st-number">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

export function TextField({ value, onChange, placeholder, maxLength, label }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  label: string;
}) {
  return <input className="st-text" aria-label={label} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />;
}

export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label className={`st-check${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}
