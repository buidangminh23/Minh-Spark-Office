import { useCallback, useEffect, useRef, useState } from 'react';
import { listPrinters, type PrintPlatform, type PrinterInfo } from '../../lib/print/printRun';
import { mergePrinters, samePrinters } from './printerChoice';

const QUICK_POLL_MS = 4_000;
const DISCOVER_EVERY = 5;

export function usePrinters(platform: PrintPlatform, paused: boolean) {
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const discovered = useRef<PrinterInfo[]>([]);
  const ticks = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async (discover: boolean) => {
    if (platform === 'web' || inFlight.current) return;
    inFlight.current = true;
    if (discover) setScanning(true);
    try {
      const list = await listPrinters(discover);
      if (list === null) return;
      if (discover) discovered.current = list.filter((p) => !p.installed);
      const merged = mergePrinters(list.filter((p) => p.installed), discovered.current);
      setPrinters((previous) => (samePrinters(previous, merged) ? previous : merged));
    } finally {
      inFlight.current = false;
      if (discover) setScanning(false);
    }
  }, [platform]);

  useEffect(() => {
    if (platform === 'web') return;
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [platform, load]);

  useEffect(() => {
    if (platform === 'web' || paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      ticks.current += 1;
      void load(ticks.current % DISCOVER_EVERY === 0);
    }, QUICK_POLL_MS);
    const onFocus = () => void load(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [platform, paused, load]);

  return { printers, scanning, refresh: () => void load(true) };
}
