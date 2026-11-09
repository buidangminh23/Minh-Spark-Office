import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPageSize } from './pdfRender';

const THUMBNAIL_WIDTH = 100;
const THUMBNAIL_LIMIT = 60;
const RENDER_DEBOUNCE_MS = 60;

const loadRenderer = () => import('./pdfRender');

export type PdfDocumentState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; doc: PDFDocumentProxy; sizes: PdfPageSize[] };

export function usePdfDocument(dataUrl: string | undefined): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>(dataUrl ? { status: 'loading' } : { status: 'none' });

  useEffect(() => {
    if (!dataUrl) {
      setState({ status: 'none' });
      return;
    }
    let cancelled = false;
    let close: (() => Promise<void>) | null = null;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const renderer = await loadRenderer();
        const loading = renderer.openPdfDocument(dataUrl);
        close = loading.close;
        if (cancelled) return void close();
        const { doc } = await loading.opened;
        const sizes = await renderer.readPageSizes(doc);
        if (!cancelled) setState({ status: 'ready', doc, sizes });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      void close?.();
    };
  }, [dataUrl]);

  return state;
}

export function usePdfThumbnails(state: PdfDocumentState): string[] {
  const [thumbs, setThumbs] = useState<string[]>([]);

  useEffect(() => {
    setThumbs([]);
    if (state.status !== 'ready') return;
    let cancelled = false;
    const count = Math.min(state.doc.numPages, THUMBNAIL_LIMIT);
    void (async () => {
      const renderer = await loadRenderer();
      for (let n = 1; n <= count && !cancelled; n++) {
        try {
          const url = await renderer.renderPageThumbnail(state.doc, n, THUMBNAIL_WIDTH);
          if (!cancelled) setThumbs((prev) => { const next = [...prev]; next[n - 1] = url; return next; });
        } catch {
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [state]);

  return thumbs;
}

export function usePdfPageCanvas(state: PdfDocumentState, pageNumber: number, cssWidth: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (state.status !== 'ready' || !canvas || cssWidth <= 0) return;
    let cancelled = false;
    setFailed(false);
    const timer = window.setTimeout(() => {
      void loadRenderer()
        .then((renderer) => renderer.renderPageToCanvas(state.doc, pageNumber, canvas, cssWidth, window.devicePixelRatio || 1, () => cancelled))
        .catch(() => { if (!cancelled) setFailed(true); });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, pageNumber, cssWidth]);

  return { canvasRef, failed };
}

export function usePdfPageText(state: PdfDocumentState, pageNumber: number): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    if (state.status !== 'ready') return;
    let cancelled = false;
    void loadRenderer()
      .then((renderer) => renderer.readPageText(state.doc, pageNumber))
      .then((value) => { if (!cancelled) setText(value); })
      .catch(() => { if (!cancelled) setText(''); });
    return () => { cancelled = true; };
  }, [state, pageNumber]);

  return text;
}
