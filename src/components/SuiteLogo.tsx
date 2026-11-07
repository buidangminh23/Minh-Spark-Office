import { suiteLogos } from '../lib/suiteBranding';
import type { FileKind } from '../lib/storage';

const suiteNames: Record<FileKind, string> = {
  doc: 'Minh Docs',
  sheet: 'Minh Sheets',
  pdf: 'Minh PDF',
  slide: 'Minh Slides',
};

export function SuiteLogo({ kind, size = 28, decorative = true }: { kind: FileKind; size?: number; decorative?: boolean }) {
  return (
    <span className="suite-logo" style={{ width: size, height: size }} aria-hidden={decorative || undefined}>
      <img src={suiteLogos[kind]} alt={decorative ? '' : suiteNames[kind]} width={1280} height={1280} draggable={false} />
    </span>
  );
}
