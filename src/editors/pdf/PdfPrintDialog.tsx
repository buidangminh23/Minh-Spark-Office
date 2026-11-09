import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PrintDialog } from '../../components/print/PrintDialog';
import type { PrintItem, PrintSource } from '../../components/print/printTypes';
import type { PdfPageSize } from './pdfRender';
import { loadRenderer } from './usePdfDocument';

const PX_PER_PT = 96 / 72;
const PRINT_PIXEL_RATIO = 2.2;

type Cache = Map<number, Promise<string>>;

function renderPage(cache: Cache, doc: PDFDocumentProxy, page: number, cssWidth: number, rotation: number) {
  const hit = cache.get(page);
  if (hit) return hit;
  const job = loadRenderer().then(async (renderer) => {
    const canvas = document.createElement('canvas');
    await renderer.renderPageToCanvas(doc, page, canvas, cssWidth, PRINT_PIXEL_RATIO, () => false, rotation);
    return canvas.toDataURL('image/png');
  });
  cache.set(page, job);
  return job;
}

function PdfPageImage({ cache, doc, page, size, rotation }: { cache: Cache; doc: PDFDocumentProxy; page: number; size: { w: number; h: number }; rotation: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void renderPage(cache, doc, page, size.w, rotation).then((url) => { if (alive) setSrc(url); }).catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [cache, doc, page, size.w, rotation]);
  if (src === null) return <div data-print-pending style={{ width: size.w, height: size.h, background: '#f8fafc' }} />;
  if (!src) return <div style={{ width: size.w, height: size.h, display: 'grid', placeItems: 'center', color: '#b91c1c' }}>Không vẽ được trang {page}</div>;
  return <img src={src} alt={`Trang ${page}`} style={{ width: size.w, height: size.h, display: 'block' }} />;
}

type Props = { doc: PDFDocumentProxy; sizes: PdfPageSize[]; rotation: number; title: string; currentPage: number; onClose: () => void };

export function PdfPrintDialog({ doc, sizes, rotation, title, currentPage, onClose }: Props) {
  const cache = useRef<Cache>(new Map()).current;
  const turned = rotation % 180 !== 0;
  const source: PrintSource = useMemo(() => {
    const items: PrintItem[] = sizes.map((s, i) => {
      const w = (turned ? s.height : s.width) * PX_PER_PT;
      const h = (turned ? s.width : s.height) * PX_PER_PT;
      const size = { w, h };
      return { key: `p${i + 1}-${rotation}`, size, render: () => <PdfPageImage cache={cache} doc={doc} page={i + 1} size={size} rotation={rotation} /> };
    });
    return { kind: 'pdf', title, items, currentItem: Math.max(0, currentPage - 1) };
  }, [sizes, turned, rotation, cache, doc, title, currentPage]);
  return <PrintDialog source={source} onClose={onClose} />;
}
