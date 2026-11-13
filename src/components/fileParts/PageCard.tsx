import type { CSSProperties, MouseEvent } from 'react';

type PageCardProps = {
  number: number;
  label?: string;
  thumb?: string;
  color?: string;
  tag?: string;
  badge?: number;
  dim?: boolean;
  selected?: boolean;
  size?: 'small' | 'medium';
  ariaLabel: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  role?: 'option' | undefined;
};

export function PageCard({ number, label, thumb, color, tag, badge, dim, selected, size = 'medium', ariaLabel, onClick, role }: PageCardProps) {
  const style = color ? ({ '--fp-color': color } as CSSProperties) : undefined;
  const className = ['fp-page', `fp-page-${size}`, color ? 'is-colored' : '', dim ? 'is-dim' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={className} style={style} onClick={onClick} aria-label={ariaLabel} title={label} role={role} aria-selected={role ? Boolean(selected) : undefined}>
      <span className="fp-page-sheet">
        {thumb ? <img src={thumb} alt="" /> : <span className="fp-page-text" data-no-translate>{label}</span>}
        {tag && <span className="fp-page-tag">{tag}</span>}
        {badge !== undefined && <span className="fp-page-badge">{badge}</span>}
      </span>
      <span className="fp-page-number">{number}</span>
    </button>
  );
}
