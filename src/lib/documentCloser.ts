import { useEffect, useLayoutEffect, useRef } from 'react';

type Closer = () => Promise<boolean>;

let active: Closer | null = null;

export async function saveAndCloseActiveDocument(): Promise<boolean> {
  if (!active) return false;
  try {
    return await active();
  } catch {
    return false;
  }
}

export function useDocumentCloser(close: Closer) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    const closer: Closer = () => latest.current();
    active = closer;
    return () => {
      if (active === closer) active = null;
    };
  }, []);
}
