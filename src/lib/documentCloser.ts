import { useLayoutEffect, useRef } from 'react';

type Closer = (close: boolean) => Promise<boolean>;

export function createDocumentCloseRegistry() {
  const closers: Closer[] = [];
  let pending: Promise<boolean> | null = null;
  return {
    register(closer: Closer) {
      closers.push(closer);
      return () => {
        const index = closers.lastIndexOf(closer);
        if (index >= 0) closers.splice(index, 1);
      };
    },
    save(close: boolean, allowEmpty = false): Promise<boolean> {
      if (pending) return pending;
      const closer = closers[closers.length - 1] ?? null;
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
