import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPageSize } from './pdfRender';
import { loadRenderer, useNearViewport, usePageCanvas } from './usePdfDocument';
import type { EditablePdfPage } from '../../lib/pdfOcrTypes';
import { PdfOcrTextLayer } from './PdfOcrTextLayer';

const PAGE_RENDER_MARGIN = '120% 0px';
const THUMB_RENDER_MARGIN = '400px 0px';
const THUMB_WIDTH = 100;
const THUMB_HEIGHT = 108;

export function rotatedSize(size: PdfPageSize, rotation: number): PdfPageSize {
  return rotation % 180 ? { width: size.height, height: size.width } : size;
}

export function typicalWidth(sizes: PdfPageSize[], rotation: number): number {
  const widths = sizes.map((size) => rotatedSize(size, rotation).width).sort((x, y) => x - y);
  return widths[Math.floor(widths.length / 2)] ?? 0;
}

type PageViewProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  size: PdfPageSize;
  zoom: number;
  rotation: number;
  root: HTMLElement | null;
  title: string;
  register: (pageNumber: number, element: HTMLDivElement | null) => void;
  editablePage?: EditablePdfPage;
  onEditText?: (pageIndex: number, id: string, text: string) => Promise<void>;
};

const PdfPageView = memo(function PdfPageView({ doc, pageNumber, size, zoom, rotation, root, title, register, editablePage, onEditText }: PageViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const near = useNearViewport(holder, root, PAGE_RENDER_MARGIN);
  const view = rotatedSize(size, rotation);
  const width = view.width * (zoom / 100);
  const height = view.height * (zoom / 100);
  const { canvasRef, failed } = usePageCanvas(doc, pageNumber, width, rotation, near);

  return (
    <div
      ref={(element) => { holder.current = element; register(pageNumber, element); }}
      className="pdf-page pdf-page-real"
      data-page={pageNumber}
      style={{ width, height }}
    >
      {near && !failed && <canvas ref={canvasRef} className="pdf-page-image" role="img" aria-label={`${title} – trang ${pageNumber}`} />}
      {failed && <div className="pdf-page-status pdf-page-status-error">Không vẽ được trang {pageNumber}.</div>}
      {near && !failed && editablePage && onEditText && <PdfOcrTextLayer page={editablePage} zoom={zoom} rotation={rotation} onEdit={onEditText} />}
    </div>
  );
});

type ScrollerProps = {
  doc: PDFDocumentProxy;
  sizes: PdfPageSize[];
  zoom: number;
  rotation: number;
  root: HTMLElement | null;
  title: string;
  register: (pageNumber: number, element: HTMLDivElement | null) => void;
  editablePages?: EditablePdfPage[];
  onEditText?: (pageIndex: number, id: string, text: string) => Promise<void>;
};

export function PdfPageScroller({ doc, sizes, zoom, rotation, root, title, register, editablePages, onEditText }: ScrollerProps) {
  return (
    <>
      {sizes.map((size, index) => (
        <PdfPageView
          key={index}
          doc={doc}
          pageNumber={index + 1}
          size={size}
          zoom={zoom}
          rotation={rotation}
          root={root}
          title={title}
          register={register}
          editablePage={editablePages?.find((page) => page.pageIndex === index)}
          onEditText={onEditText}
        />
      ))}
    </>
  );
}

type ThumbProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  rotation: number;
  root: HTMLElement | null;
  active: boolean;
  cache: Map<string, string>;
  onSelect: (pageNumber: number) => void;
};

export const PdfThumb = memo(function PdfThumb({ doc, pageNumber, rotation, root, active, cache, onSelect }: ThumbProps) {
  const holder = useRef<HTMLButtonElement | null>(null);
  const near = useNearViewport(holder, root, THUMB_RENDER_MARGIN);
  const key = `${pageNumber}:${rotation}`;
  const [url, setUrl] = useState<string | undefined>(() => cache.get(key));

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) return setUrl(cached);
    setUrl(undefined);
    if (!near) return;
    let cancelled = false;
    void loadRenderer()
      .then((renderer) => renderer.renderPageThumbnail(doc, pageNumber, THUMB_WIDTH, rotation))
      .then((value) => {
        cache.set(key, value);
        if (!cancelled) setUrl(value);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [doc, pageNumber, rotation, near, cache, key]);

  useEffect(() => {
    if (active) holder.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <button
      ref={holder}
      type="button"
      className={`pdf-thumb${active ? ' active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      aria-label={`Đến trang ${pageNumber}`}
      aria-current={active ? 'page' : undefined}
    >
      {url ? <img className="pdf-thumb-image" src={url} alt="" /> : <span className="pdf-thumb-image" style={{ height: THUMB_HEIGHT }} />}
      <span className="pdf-thumb-label">Trang {pageNumber}</span>
    </button>
  );
});
