import { useId, type CSSProperties } from 'react';

export function ConvertLogo({ size = 28, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const tile = `${id}-tile`;
  const gloss = `${id}-gloss`;
  const back = `${id}-back`;
  return (
    <span className="convert-logo" style={{ '--convert-logo-size': `${size}px` } as CSSProperties} aria-hidden={title ? undefined : true}>
      <svg viewBox="0 0 64 64" width={size} height={size} role={title ? 'img' : undefined} aria-label={title}>
        <defs>
          <linearGradient id={tile} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.52" stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b2bf2" />
          </linearGradient>
          <linearGradient id={gloss} x1="32" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={back} x1="14" y1="12" x2="34" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${tile})`} />
        <path d="M2 18A16 16 0 0 1 18 2h28a16 16 0 0 1 16 16v6C46 30 20 30 2 22Z" fill={`url(#${gloss})`} />
        <path d="M14 15.5a3.5 3.5 0 0 1 3.5-3.5H29l6 6v15.5a3.5 3.5 0 0 1-3.5 3.5h-14a3.5 3.5 0 0 1-3.5-3.5Z" fill={`url(#${back})`} />
        <path d="M30.5 28a3.5 3.5 0 0 1 3.5-3.5h11.5l6 6V48a3.5 3.5 0 0 1-3.5 3.5H34a3.5 3.5 0 0 1-3.5-3.5Z" fill="#fff" />
        <path d="M45.5 24.5v4.5a1.5 1.5 0 0 0 1.5 1.5h4.5Z" fill="#c7d2fe" />
        <path d="M35.5 37h11M35.5 41.5h11M35.5 46h7" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M40 12.5c5.4.4 9.2 3.8 10.2 8.6" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        <path d="m46.4 19.6 3.9 3.6 3.3-4.2" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 51.5c-5.4-.4-9.2-3.8-10.2-8.6" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        <path d="m17.6 44.4-3.9-3.6-3.3 4.2" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
