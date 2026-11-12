import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function setTipsOpen(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

export const closeTips = () => setTipsOpen(false);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTipsOpen = () => useSyncExternalStore(subscribe, () => open, () => false);
