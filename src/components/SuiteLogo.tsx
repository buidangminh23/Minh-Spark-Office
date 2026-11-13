import type { CSSProperties } from 'react';
import { suiteLogos } from '../lib/suiteBranding';
import type { FileKind } from '../lib/storage';

const suiteNames: Record<FileKind, string> = {
  doc: '23 Docs',
  sheet: '23 Sheets',
  pdf: '23 PDF',
  slide: '23 Slides',
  image: '23 Photos',
};

export function SuiteLogo({ kind, size = 28, decorative = true }: { kind: FileKind; size?: number; decorative?: boolean }) {
  return (
    <span className="suite-logo" style={{ '--suite-logo-size': `${size}px` } as CSSProperties} aria-hidden={decorative || undefined}>
      <img
        src={suiteLogos[kind]}
        alt={decorative ? '' : suiteNames[kind]}
        width={1280}
        height={1280}
        draggable={false}
      />
    </span>
  );
}
