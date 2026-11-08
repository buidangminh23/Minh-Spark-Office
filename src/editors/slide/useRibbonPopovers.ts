import { useLayoutEffect, type RefObject } from 'react';

const POPOVER_SELECTOR = '.ppt-anim-dropdown-menu, .ppt-full-gallery-popover, .ppt-layout-menu';
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 4;
const MIN_MENU_HEIGHT = 160;

function placePopover(menu: HTMLElement) {
  const anchor = menu.parentElement;
  if (!anchor) return;
  if (!menu.dataset.align) {
    const computed = getComputedStyle(menu);
    menu.dataset.align = computed.left === 'auto' && computed.right !== 'auto' ? 'end' : 'start';
  }
  const anchorRect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const preferredLeft = menu.dataset.align === 'end' ? anchorRect.right - width : anchorRect.left;
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft));
  const top = anchorRect.bottom + ANCHOR_GAP;
  Object.assign(menu.style, {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    bottom: 'auto',
    marginTop: '0px',
    maxHeight: `${Math.max(MIN_MENU_HEIGHT, window.innerHeight - top - VIEWPORT_MARGIN)}px`,
    overflowY: 'auto',
    zIndex: '1200',
  });
}

export function useRibbonPopovers(containerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const placeAll = () => container.querySelectorAll<HTMLElement>(POPOVER_SELECTOR).forEach(placePopover);
    placeAll();
    window.addEventListener('resize', placeAll);
    container.addEventListener('scroll', placeAll, { passive: true });
    return () => {
      window.removeEventListener('resize', placeAll);
      container.removeEventListener('scroll', placeAll);
    };
  });
}
