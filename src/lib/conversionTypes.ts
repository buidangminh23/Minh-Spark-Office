export type ConversionFile = { name: string; blob: Blob };
export type ConversionResult = { files: ConversionFile[]; warnings: string[] };
export type ConversionOptions = { signal?: AbortSignal; onProgress?: (message: string) => void; fidelity?: 'layout' | 'editable'; ocr?: boolean; layoutSession?: import('./officeLayoutSession').OfficeLayoutSession };
export type ConversionTarget = { id: string; label: string; description: string };

export const cleanPdfText = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, '');

export function checkConversionAbort(options: ConversionOptions = {}) {
  options.signal?.throwIfAborted();
}

export function conversionBaseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Tai-lieu';
}
