import { useMemo } from 'react';
import { PrintDialog } from '../../components/print/PrintDialog';
import type { PrintSource } from '../../components/print/printTypes';

type Props = { src: string; width: number; height: number; title: string; onClose: () => void };

export function ImagePrintDialog({ src, width, height, title, onClose }: Props) {
  const source: PrintSource = useMemo(() => ({
    kind: 'image',
    title,
    items: [{ key: 'image', size: { w: width, h: height }, render: () => <img src={src} alt={title} style={{ width, height, display: 'block' }} /> }],
  }), [src, width, height, title]);
  return <PrintDialog source={source} onClose={onClose} />;
}
