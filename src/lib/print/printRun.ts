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

export type PrinterKind = 'usb' | 'network' | 'shared' | 'local' | 'pdf' | 'xps' | 'onenote' | 'fax' | 'virtual' | 'class';
export type PrinterState = 'ready' | 'printing' | 'paused' | 'offline' | 'error' | 'unknown';
export type PrinterIssue = 'paper-out' | 'paper-jam' | 'toner-low' | 'toner-empty' | 'door-open' | 'output-full' | 'needs-attention' | 'not-accepting';

export type PrinterInfo = {
  name: string;
  displayName: string;
  isDefault: boolean;
  kind: PrinterKind;
  state: PrinterState;
  issues: PrinterIssue[];
  location: string | null;
  model: string | null;
  installed: boolean;
  duplex: boolean | null;
  color: boolean | null;
  asksForFile?: boolean;
};

export type PrintTarget = { kind: 'system' } | { kind: 'printer'; name: string; displayName?: string; installed?: boolean } | { kind: 'pdf' };

export type NativePrintRequest = { widthMm: number; heightMm: number; landscape: boolean; title: string; target?: PrintTarget; duplex?: boolean; grayscale?: boolean };

export type PrintResult = { mode: 'blocking' | 'detached' | 'done'; status: 'dialog' | 'sent' | 'saved' | 'cancelled'; path: string | null };

type NativeOutcome = { status: 'dialog' | 'sent' | 'saved' | 'cancelled'; path?: string | null } | null | undefined;

export function canPrintDirect(platform: PrintPlatform = printPlatform()) {
  return platform === 'mac' || platform === 'windows';
}

export async function openSystemPrint(request: NativePrintRequest): Promise<PrintResult> {
  const platform = printPlatform();
  const target = request.target ?? { kind: 'system' };
  if (target.kind !== 'system' && canPrintDirect(platform)) {
    const outcome = await invoke<NativeOutcome>('print_window', { request: { ...request, target } });
    const status = outcome?.status ?? 'sent';
    return { mode: status === 'dialog' ? 'detached' : 'done', status, path: outcome?.path ?? null };
  }
  if (platform === 'mac') {
    await invoke<NativeOutcome>('print_window', { request: { ...request, target: { kind: 'system' } } });
    return { mode: 'detached', status: 'dialog', path: null };
  }
  window.print();
  return { mode: 'blocking', status: 'dialog', path: null };
}

export async function listPrinters(discover = false): Promise<PrinterInfo[] | null> {
  if (!isDesktop()) return null;
  try {
    const list = await invoke<PrinterInfo[]>('list_printers', { discover });
    return Array.isArray(list) ? list : [];
  } catch {
    return null;
  }
}

export async function readDefaultPrinter(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return (await invoke<string | null>('default_printer')) ?? null;
  } catch {
    return null;
  }
}

export function printErrorMessage(error: unknown, printer?: string | null): string {
  const code = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  const who = printer ? `“${printer}”` : 'đã chọn';
  if (code === 'PRINTER_NOT_FOUND') return `Không tìm thấy máy in ${who}. Có thể máy in vừa bị gỡ hoặc đổi tên; danh sách đã được làm mới.`;
  if (code === 'PRINTER_UNAVAILABLE') return `Máy in ${who} không phản hồi. Kiểm tra máy in đã bật, còn kết nối (cáp USB hoặc cùng mạng) rồi in lại.`;
  if (code === 'PDF_NOT_WRITTEN') return 'Không ghi được tệp PDF vào thư mục Tải về. Kiểm tra ổ đĩa còn trống và quyền ghi.';
  if (code === 'PRINT_TIMEOUT') return 'Máy in không trả lời sau 15 phút. Mở hàng đợi in của hệ thống để kiểm tra lệnh in.';
  if (code.startsWith('LP: ')) return `Hệ thống in từ chối lệnh in tới ${who}: ${code.slice(4)}`;
  return `Không in được${code ? ` (mã ${code})` : ''}. Thử lại, hoặc chọn máy in khác.`;
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
