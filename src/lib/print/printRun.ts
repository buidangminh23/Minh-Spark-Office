import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from '../desktop';

export const PRINT_ROOT_ID = 'minh-print-root';
export const PRINTING_CLASS = 'minh-printing';
const PENDING_SELECTOR = '[data-print-pending]';
const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 120;

export type PrintPlatform = 'web' | 'windows' | 'mac' | 'linux';

export function printPlatform(): PrintPlatform {
  if (!isDesktop()) return 'web';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Mac|iPhone|iPad/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  return 'linux';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForPrintReady(root: HTMLElement, onProgress?: (left: number) => void): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    const pending = root.querySelectorAll(PENDING_SELECTOR).length;
    onProgress?.(pending);
    if (!pending) break;
    await sleep(POLL_MS);
  }
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready.catch(() => undefined);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export type NativePrintRequest = { widthMm: number; heightMm: number; landscape: boolean; title: string };

export async function openSystemPrint(request: NativePrintRequest): Promise<'blocking' | 'detached'> {
  if (printPlatform() === 'mac') {
    await invoke<void>('print_window', { request });
    return 'detached';
  }
  window.print();
  return 'blocking';
}

export async function readDefaultPrinter(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return (await invoke<string | null>('default_printer')) ?? null;
  } catch {
    return null;
  }
}

export function onAfterPrint(handler: () => void): () => void {
  window.addEventListener('afterprint', handler);
  return () => window.removeEventListener('afterprint', handler);
}

export type MeasuredHtml = { width: number; height: number; breaks: number[] };

export function measureHtml(html: string, className = ''): MeasuredHtml {
  const host = document.createElement('div');
  host.className = className;
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;width:max-content;max-width:none;pointer-events:none;background:#fff';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const rect = host.getBoundingClientRect();
    const top = rect.top;
    const breaks = Array.from(host.querySelectorAll('tr')).map((row) => (row as HTMLElement).getBoundingClientRect().bottom - top);
    return { width: Math.ceil(host.scrollWidth), height: Math.ceil(host.scrollHeight), breaks };
  } finally {
    host.remove();
  }
}
