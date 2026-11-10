import { useLayoutEffect, useRef } from 'react';

type Closer = (close: boolean) => Promise<boolean>;

export function createDocumentCloseRegistry() {
  let active: Closer | null = null;
  let pending: Promise<boolean> | null = null;
  return {
    register(closer: Closer) {
      active = closer;
      return () => { if (active === closer) active = null; };
    },
    save(close: boolean, allowEmpty = false): Promise<boolean> {
      if (pending) return pending;
      const closer = active;
      if (!closer) return Promise.resolve(allowEmpty);
      pending = Promise.resolve().then(() => closer(close)).catch(() => false).finally(() => { pending = null; });
      return pending;
    },
  };
}

const registry = createDocumentCloseRegistry();

export async function saveAndCloseActiveDocument(): Promise<boolean> {
  return registry.save(true);
}

export const saveActiveDocumentForExit = () => registry.save(false, true);

export function useDocumentCloser(close: Closer) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useLayoutEffect(() => registry.register((close) => latest.current(close)), []);
}
