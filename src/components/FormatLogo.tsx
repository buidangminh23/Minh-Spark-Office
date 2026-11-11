import { useId, type CSSProperties } from 'react';
import type { FormatBadge } from '../lib/conversionPresets';

const CARD_PATH = 'M12 15h32l12 12v25a10 10 0 0 1-10 10H12A10 10 0 0 1 2 52V25a10 10 0 0 1 10-10Z';
const FOLD_PATH = 'M44 15l12 12h-8a4 4 0 0 1-4-4Z';

export function FormatLogo({ badge, size = 28 }: { badge: FormatBadge; size?: number }) {
  const id = useId().replace(/:/g, '');
  const back = `${id}-back`;
  const shine = `${id}-shine`;
  const fold = `${id}-fold`;
  const clip = `${id}-clip`;
  const fontSize = badge.text.length >= 4 ? 13.5 : 17;
  return (
    <span className="format-logo" style={{ '--format-logo-size': `${size}px` } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={back} x1="10" y1="2" x2="62" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={badge.light} stopOpacity="0.45" />
            <stop offset="1" stopColor={badge.light} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={shine} x1="4" y1="15" x2="46" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={badge.light} />
            <stop offset="1" stopColor={badge.dark} />
          </linearGradient>
          <linearGradient id={fold} x1="44" y1="15" x2="54" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#d9e3f1" />
          </linearGradient>
          <clipPath id={clip}><rect x="2" y="2" width="60" height="60" rx="12" /></clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x="2" y="2" width="60" height="60" rx="12" fill="#fff" />
          <rect x="2" y="2" width="60" height="60" rx="12" fill={`url(#${back})`} />
          <rect x="25" y="2" width="15" height="20" fill="#fff" opacity="0.22" />
          <rect x="40" y="2" width="22" height="20" fill="#fff" opacity="0.36" />
        </g>
        <path d={CARD_PATH} fill={`url(#${shine})`} />
        <path d="M8 15.7h35.5" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
        <path d={FOLD_PATH} fill={`url(#${fold})`} />
        <text x="29" y={fontSize > 14 ? 46 : 44.5} textAnchor="middle" fontSize={fontSize} fontWeight="800" letterSpacing="-0.4" fill="#fff" fontFamily="Inter, 'Segoe UI', Arial, sans-serif">{badge.text}</text>
      </svg>
    </span>
  );
}
