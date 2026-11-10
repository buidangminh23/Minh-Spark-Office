import type { PrintPlatform, PrintTarget, PrinterInfo, PrinterIssue, PrinterKind, PrinterState } from '../../lib/print/printRun';

export type PrinterChoice = 'system' | 'pdf' | `printer:${string}`;

export const CHOICE_KEY = 'minh-print-printer-v1';

export const KIND_LABELS: Record<PrinterKind, string> = {
  usb: 'Cắm USB',
  network: 'Máy in mạng',
  shared: 'Máy in chia sẻ',
  local: 'Máy in trên máy',
  pdf: 'Máy in ảo PDF',
  xps: 'Máy in ảo XPS',
  onenote: 'Gửi sang OneNote',
  fax: 'Máy fax',
  virtual: 'Máy in ảo',
  class: 'Nhóm máy in',
};

export const STATE_LABELS: Record<PrinterState, string> = {
  ready: 'Sẵn sàng',
  printing: 'Đang in',
  paused: 'Đang tạm dừng',
  offline: 'Ngoại tuyến',
  error: 'Đang báo lỗi',
  unknown: 'Chưa rõ trạng thái',
};

export const ISSUE_LABELS: Record<PrinterIssue, string> = {
  'paper-out': 'hết giấy',
  'paper-jam': 'kẹt giấy',
  'toner-low': 'sắp hết mực',
  'toner-empty': 'hết mực',
  'door-open': 'đang mở nắp',
  'output-full': 'khay ra giấy đầy',
  'needs-attention': 'cần kiểm tra máy',
  'not-accepting': 'đang từ chối lệnh in',
};

export const printerChoice = (printer: PrinterInfo): PrinterChoice => `printer:${printer.name}`;

export function loadChoice(): PrinterChoice | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    if (raw === 'system' || raw === 'pdf' || raw?.startsWith('printer:')) return raw as PrinterChoice;
    return null;
  } catch {
    return null;
  }
}

export function saveChoice(choice: PrinterChoice) {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    return;
  }
}

export function mergePrinters(current: PrinterInfo[], discovered: PrinterInfo[]): PrinterInfo[] {
  const names = new Set(current.map((p) => p.name));
  const extra = discovered.filter((p) => !p.installed && !names.has(p.name));
  return [...current, ...extra];
}

export function samePrinters(a: PrinterInfo[] | null, b: PrinterInfo[] | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type Resolved = { choice: PrinterChoice; printer: PrinterInfo | null; missing: string | null };

export const directPrinting = (platform: PrintPlatform) => platform === 'mac' || platform === 'windows';

export function resolveChoice(stored: PrinterChoice | null, printers: PrinterInfo[] | null, platform: PrintPlatform): Resolved {
  if (platform === 'web' || printers === null) return { choice: 'system', printer: null, missing: null };
  if (stored === 'pdf' && directPrinting(platform)) return { choice: 'pdf', printer: null, missing: null };
  if (stored === 'system' && !directPrinting(platform)) return { choice: 'system', printer: null, missing: null };
  const wanted = stored?.startsWith('printer:') ? stored.slice('printer:'.length) : null;
  const exact = wanted ? printers.find((p) => p.name === wanted) : undefined;
  if (exact) return { choice: printerChoice(exact), printer: exact, missing: null };
  const fallback = printers.find((p) => p.isDefault && p.installed) ?? printers.find((p) => p.installed && p.kind !== 'fax') ?? null;
  const missing = wanted ?? null;
  if (fallback) return { choice: printerChoice(fallback), printer: fallback, missing };
  return { choice: directPrinting(platform) ? 'pdf' : 'system', printer: null, missing };
}

export const savesAsPdf = (printer: PrinterInfo | null) => !!printer && printer.kind === 'pdf' && !!printer.asksForFile;

export function targetFor(resolved: Resolved, platform: PrintPlatform): PrintTarget {
  if (!directPrinting(platform)) return { kind: 'system' };
  const printer = resolved.printer;
  if (resolved.choice === 'pdf' || !printer || savesAsPdf(printer)) return { kind: 'pdf' };
  return { kind: 'printer', name: printer.name, displayName: printer.displayName, installed: printer.installed };
}

export function printerSubtitle(printer: PrinterInfo): string {
  const parts: string[] = [];
  if (printer.isDefault) parts.push('Mặc định');
  parts.push(printer.installed ? KIND_LABELS[printer.kind] : 'Tìm thấy trong mạng, chưa cài');
  const state = STATE_LABELS[printer.state];
  const issues = printer.issues.map((issue) => ISSUE_LABELS[issue]);
  parts.push(issues.length ? `${state}, ${issues.join(', ')}` : state);
  if (printer.location) parts.push(printer.location);
  return parts.join(' · ');
}

export function printerTone(printer: PrinterInfo | null): 'ok' | 'warn' | 'bad' | 'none' {
  if (!printer) return 'none';
  if (printer.state === 'offline' || printer.state === 'error' || printer.issues.includes('not-accepting')) return 'bad';
  if (printer.state === 'paused' || printer.issues.length) return 'warn';
  return 'ok';
}

export function printerNotes(resolved: Resolved, sides: 'one' | 'manual' | 'auto', platform: PrintPlatform): string[] {
  const notes: string[] = [];
  const printer = resolved.printer;
  const fallback = printer ? `“${printer.displayName}”` : resolved.choice === 'pdf' ? 'Lưu thành PDF' : 'máy in mặc định của hệ thống';
  if (resolved.missing) notes.push(`Máy in “${resolved.missing.replace(/_/g, ' ')}” chưa kết nối, đã tạm chọn ${fallback}. Cắm hoặc bật lại máy in, danh sách sẽ tự cập nhật.`);
  if (printer && !printer.installed && directPrinting(platform)) notes.push(`“${printer.displayName}” chưa cài trên máy này; app sẽ gửi lệnh in thẳng qua mạng, không cần cài.`);
  if (savesAsPdf(printer) && directPrinting(platform)) notes.push(`“${printer!.displayName}” vốn bật hộp thoại hỏi nơi lưu; app lưu thẳng PDF vào thư mục Tải về thay cho hộp thoại đó.`);
  if (printer && !directPrinting(platform)) notes.push('Trên Linux, máy in được chọn lại ở hộp thoại in kế tiếp.');
  if (printer?.installed && (printer.state === 'offline' || printer.state === 'paused')) notes.push(`“${printer.displayName}” ${STATE_LABELS[printer.state].toLowerCase()}. Lệnh in sẽ nằm trong hàng đợi cho tới khi máy in sẵn sàng.`);
  if (printer?.installed && sides === 'auto' && printer.duplex === false && platform !== 'web') notes.push(`“${printer.displayName}” không báo hỗ trợ in hai mặt tự động; nếu bản in ra một mặt, chọn In hai mặt thủ công.`);
  if ((resolved.choice === 'pdf' || savesAsPdf(printer)) && sides !== 'one' && directPrinting(platform)) notes.push('Lưu thành PDF ghi đủ mọi trang vào một tệp, không chia mặt trước mặt sau.');
  return notes;
}
