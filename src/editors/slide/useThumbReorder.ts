import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { edgeScrollStep, finalSlideIndex, insertionIndex } from './slideReorder';

const HOLD_MS = 280;
const MOVE_TOLERANCE_PX = 6;
const EDGE_PX = 40;
const EDGE_STEP_PX = 14;

export type ThumbDrag = { from: number; insertBefore: number; offset: number };

type Press = { index: number; pointerId: number; startX: number; startY: number; timer: number };

type Active = {
  from: number;
  pointerId: number;
  vertical: boolean;
  startPos: number;
  startScroll: number;
  midpoints: number[];
  lastClient: number;
  insertBefore: number;
};

const axisOf = (list: HTMLElement) => getComputedStyle(list).flexDirection.startsWith('column');

export function useThumbReorder(listRef: RefObject<HTMLDivElement | null>, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<ThumbDrag | null>(null);
  const press = useRef<Press | null>(null);
  const active = useRef<Active | null>(null);
  const suppressClick = useRef(false);
  const frame = useRef(0);
  const tickRef = useRef<() => void>(() => undefined);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const contentPos = useCallback((state: Active, client: number) => {
    const list = listRef.current;
    if (!list) return client;
    const rect = list.getBoundingClientRect();
    return state.vertical ? client - rect.top + list.scrollTop : client - rect.left + list.scrollLeft;
  }, [listRef]);

  const update = useCallback(() => {
    const state = active.current;
    const list = listRef.current;
    if (!state || !list) return;
    const position = contentPos(state, state.lastClient);
    state.insertBefore = insertionIndex(state.midpoints, position);
    const scrollNow = state.vertical ? list.scrollTop : list.scrollLeft;
    setDrag({ from: state.from, insertBefore: state.insertBefore, offset: state.lastClient - state.startPos + (scrollNow - state.startScroll) });
  }, [contentPos, listRef]);

  const stopFrame = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  const tick = useCallback(() => {
    const state = active.current;
    const list = listRef.current;
    if (!state || !list) return;
    const rect = list.getBoundingClientRect();
    const step = state.vertical
      ? edgeScrollStep(state.lastClient, rect.top, rect.bottom, EDGE_PX, EDGE_STEP_PX)
      : edgeScrollStep(state.lastClient, rect.left, rect.right, EDGE_PX, EDGE_STEP_PX);
    if (step) {
      if (state.vertical) list.scrollTop += step;
      else list.scrollLeft += step;
      update();
    }
    frame.current = requestAnimationFrame(() => tickRef.current());
  }, [listRef, update]);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  const finish = useCallback((commit: boolean) => {
    clearPress();
    stopFrame();
    const state = active.current;
    active.current = null;
    setDrag(null);
    if (!state) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const to = finalSlideIndex(state.from, state.insertBefore);
    if (commit && to !== state.from) onMoveRef.current(state.from, to);
  }, []);

  const begin = useCallback((current: Press, client: { x: number; y: number }) => {
    const list = listRef.current;
    if (!list) return;
    const vertical = axisOf(list);
    const listRect = list.getBoundingClientRect();
    const items = [...list.querySelectorAll<HTMLElement>(':scope > .ppt-thumb-item')];
    const midpoints = items.map((item) => {
      const rect = item.getBoundingClientRect();
      return vertical ? rect.top + rect.height / 2 - listRect.top + list.scrollTop : rect.left + rect.width / 2 - listRect.left + list.scrollLeft;
    });
    const startPos = vertical ? client.y : client.x;
    active.current = {
      from: current.index,
      pointerId: current.pointerId,
      vertical,
      startPos,
      startScroll: vertical ? list.scrollTop : list.scrollLeft,
      midpoints,
      lastClient: startPos,
      insertBefore: current.index,
    };
    press.current = null;
    navigator.vibrate?.(12);
    setDrag({ from: current.index, insertBefore: current.index, offset: 0 });
    frame.current = requestAnimationFrame(() => tickRef.current());
  }, [listRef]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const pending = press.current;
      if (pending && event.pointerId === pending.pointerId) {
        if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) > MOVE_TOLERANCE_PX) clearPress();
        return;
      }
      const state = active.current;
      if (!state || event.pointerId !== state.pointerId) return;
      event.preventDefault();
      state.lastClient = state.vertical ? event.clientY : event.clientX;
      update();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (press.current?.pointerId === event.pointerId) clearPress();
      if (active.current?.pointerId === event.pointerId) finish(event.type === 'pointerup');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && active.current) {
        event.preventDefault();
        finish(false);
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (active.current) event.preventDefault();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('touchmove', onTouchMove);
      clearPress();
      stopFrame();
    };
  }, [finish, update]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0 || active.current) return;
    if ((event.target as HTMLElement).closest('button')) return;
    clearPress();
    const client = { x: event.clientX, y: event.clientY };
    const pending: Press = { index, pointerId: event.pointerId, startX: client.x, startY: client.y, timer: 0 };
    pending.timer = window.setTimeout(() => {
      if (press.current === pending) begin(pending, client);
    }, HOLD_MS);
    press.current = pending;
  }, [begin]);

  const consumeClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { drag, onPointerDown, consumeClick };
}
