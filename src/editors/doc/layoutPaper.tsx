import { useEffect, useState, type CSSProperties } from 'react';
import type { PageSettings } from '../../lib/storage';
import { useDoc } from './DocContext';
import { getPagination, pageGap } from './pagination';
import { PAGE_SIZES } from '../../lib/storage';

const SECTION_KINDS = new Set(['next', 'continuous', 'even', 'odd']);
const DEFAULT_WATERMARK_OPACITY = 0.15;
const REFRESH_MS = 160;
const BODY_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, pre, .page-break';
const EXCLUDED_SELECTOR = 'table, .doc-textbox, .doc-toc';

export const hasWatermark = (page: PageSettings) => (page.watermarkOptions?.kind === 'image' ? Boolean(page.watermarkOptions.image) : Boolean(page.watermark));

export function WatermarkMark({ page, flowing }: { page: PageSettings; flowing?: boolean }) {
  if (!hasWatermark(page)) return null;
  const options = page.watermarkOptions ?? {};
  const rotate = options.layout === 'horizontal' ? '' : ' rotate(-35deg)';
  const base: CSSProperties = { transform: `translate(-50%, -50%)${rotate}` };
  const className = `doc-watermark ${flowing ? 'flowing' : ''}`;
  if (options.kind === 'image') return <img className={`${className} image`} style={{ ...base, opacity: options.opacity ?? 0.2 }} src={options.image} alt="" aria-hidden />;
  const custom: CSSProperties = {
    ...base,
    ...(options.color ? { color: options.color, opacity: options.opacity ?? DEFAULT_WATERMARK_OPACITY } : options.opacity !== undefined ? { color: '#0f172a', opacity: options.opacity } : {}),
    ...(options.size ? { fontSize: options.size } : {}),
    ...(options.font ? { fontFamily: `"${options.font}", Arial, sans-serif` } : {}),
  };
  return <div className={className} style={custom} aria-hidden>{page.watermark}</div>;
}

const textLineTops = (element: Element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const rects: { top: number; bottom: number }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent) continue;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) if (rect.width > 0) rects.push({ top: rect.top, bottom: rect.bottom });
  }
  if (!rects.length) return [element.getBoundingClientRect().top];
  rects.sort((a, b) => a.top - b.top);
  const tops: number[] = [];
  let lastBottom = -Infinity;
  for (const rect of rects) {
    const middle = (rect.top + rect.bottom) / 2;
    if (middle > lastBottom) {
      tops.push(rect.top);
      lastBottom = rect.bottom;
    } else {
      lastBottom = Math.max(lastBottom, rect.bottom);
    }
  }
  return tops;
};

export function LineNumberGutter() {
  const { editor, page, view } = useDoc();
  const [items, setItems] = useState<{ top: number; value: number }[]>([]);
  const enabled = Boolean(page.lineNumbers) && view.viewMode === 'print';
  const mode = page.lineNumberMode ?? 'continuous';
  const step = Math.max(1, page.lineNumberStep ?? 1);
  const zoom = view.zoom / 100;
  const size = PAGE_SIZES[page.size];
  const pageHeight = page.orientation === 'landscape' ? size.width : size.height;
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      timer = null;
      const root = editor.view.dom;
      const paper = root.closest('.doc-paper');
      if (!paper) return;
      const origin = paper.getBoundingClientRect().top;
      const span = paper.classList.contains('paged') ? pageHeight + pageGap() : pageHeight;
      const next: { top: number; value: number }[] = [];
      let count = 0;
      let currentPage = 0;
      for (const element of Array.from(root.querySelectorAll(BODY_SELECTOR))) {
        if (element.classList.contains('page-break')) {
          if (mode === 'section' && SECTION_KINDS.has(element.getAttribute('data-break-kind') ?? '')) count = 0;
          continue;
        }
        if (element.closest(EXCLUDED_SELECTOR) || element.hasAttribute('data-no-line-numbers')) continue;
        for (const rawTop of textLineTops(element)) {
          const top = (rawTop - origin) / zoom;
          const onPage = Math.floor(top / span);
          if (mode === 'page' && onPage !== currentPage) count = 0;
          currentPage = onPage;
          count += 1;
          if (count % step === 0) next.push({ top, value: count });
        }
      }
      setItems(next);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(measure, REFRESH_MS);
    };
    const pagination = getPagination(editor);
    schedule();
    editor.on('update', schedule);
    pagination.listeners.add(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(editor.view.dom);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', schedule);
      pagination.listeners.delete(schedule);
      observer.disconnect();
    };
  }, [editor, enabled, mode, step, zoom, pageHeight, page.margins.left, page.margins.right, page.margins.top, page.columns]);
  if (!enabled || !items.length) return null;
  return (
    <div className="line-number-gutter" style={{ width: page.margins.left }} aria-hidden>
      {items.map((item) => <span key={item.value} style={{ top: item.top }}>{item.value}</span>)}
    </div>
  );
}
