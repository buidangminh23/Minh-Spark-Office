import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const READING_LINE_RATIO = 0.3;
const PAGE_TOP_GAP = 16;

type Options = {
  root: HTMLElement | null;
  enabled: boolean;
  pageCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  layoutKey: string;
};

export function usePageNavigation({ root, enabled, pageCount, currentPage, setCurrentPage, layoutKey }: Options) {
  const elements = useRef(new Map<number, HTMLDivElement>());
  const anchor = useRef({ page: currentPage, fraction: 0 });

  const register = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    if (element) elements.current.set(pageNumber, element);
    else elements.current.delete(pageNumber);
  }, []);

  const offsetOf = useCallback((element: HTMLElement) => {
    if (!root) return 0;
    return element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
  }, [root]);

  const scrollToAnchor = useCallback((page: number, fraction: number) => {
    const element = elements.current.get(page);
    if (!root || !element) return;
    root.scrollTop = Math.max(0, offsetOf(element) + element.offsetHeight * fraction - PAGE_TOP_GAP);
  }, [root, offsetOf]);

  const goToPage = useCallback((page: number) => {
    const target = Math.min(Math.max(1, page), Math.max(1, pageCount));
    setCurrentPage(target);
    anchor.current = { page: target, fraction: 0 };
    if (enabled) scrollToAnchor(target, 0);
  }, [enabled, pageCount, setCurrentPage, scrollToAnchor]);

  useEffect(() => {
    if (!enabled || !root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = root.getBoundingClientRect().top + root.clientHeight * READING_LINE_RATIO;
      let low = 1, high = pageCount, found = 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const element = elements.current.get(mid);
        if (!element) break;
        if (element.getBoundingClientRect().top <= line) {
          found = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      const element = elements.current.get(found);
      if (element) {
        const rect = element.getBoundingClientRect();
        const top = root.getBoundingClientRect().top + PAGE_TOP_GAP;
        anchor.current = { page: found, fraction: Math.min(1, Math.max(0, (top - rect.top) / Math.max(1, rect.height))) };
      }
      setCurrentPage(found);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, root, pageCount, setCurrentPage]);

  useLayoutEffect(() => {
    if (!enabled) return;
    scrollToAnchor(anchor.current.page, anchor.current.fraction);
  }, [enabled, layoutKey, scrollToAnchor]);

  return { register, goToPage };
}
