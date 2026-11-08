import type { LucideIcon } from 'lucide-react';
import './slideIcons.css';

export type EffectTone =
  | 'neutral'
  | 'subtle'
  | 'exciting'
  | 'dynamic'
  | 'entrance'
  | 'emphasis'
  | 'exit'
  | 'motion-path';

interface EffectIconProps {
  icon: LucideIcon;
  tone: EffectTone;
  size?: 'sm' | 'md' | 'lg';
}

const GLYPH_SIZE = { sm: 14, md: 16, lg: 20 } as const;

export function EffectIcon({ icon: Icon, tone, size = 'md' }: EffectIconProps) {
  return (
    <span className={`ppt-effect-icon is-${tone} is-${size}`} aria-hidden="true">
      <Icon size={GLYPH_SIZE[size]} strokeWidth={1.75} />
    </span>
  );
}

export function ToneDot({ tone }: { tone: EffectTone }) {
  return <span className={`ppt-tone-dot is-${tone}`} aria-hidden="true" />;
}
