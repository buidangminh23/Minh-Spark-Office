import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPageSize } from './pdfRender';

const RENDER_DEBOUNCE_MS = 60;

export const loadRenderer = () => import('./pdfRender');

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

export function useNearViewport(target: RefObject<Element | null>, root: Element | null, margin: string): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element || !root || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) setNear(entry.isIntersecting);
    }, { root, rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, root, margin]);

  return near;
}

export function usePageCanvas(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number, rotation: number, active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || cssWidth <= 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadRenderer()
        .then((renderer) => renderer.renderPageToCanvas(doc, pageNumber, canvas, cssWidth, window.devicePixelRatio || 1, () => cancelled, rotation))
        .then(() => { if (!cancelled) setFailed(false); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, pageNumber, cssWidth, rotation, active]);

  return { canvasRef, failed };
}

export function usePdfPageText(state: PdfDocumentState, pageNumber: number): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    if (state.status !== 'ready') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadRenderer()
        .then((renderer) => renderer.readPageText(state.doc, pageNumber))
        .then((value) => { if (!cancelled) setText(value); })
        .catch(() => { if (!cancelled) setText(''); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, pageNumber]);

  return text;
}
