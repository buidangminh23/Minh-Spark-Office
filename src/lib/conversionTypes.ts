export type ConversionFile = { name: string; blob: Blob };
export type ConversionResult = { files: ConversionFile[]; warnings: string[] };
export type ConversionOptions = { signal?: AbortSignal; onProgress?: (message: string) => void; fidelity?: 'layout' | 'editable'; ocr?: boolean };
export type ConversionTarget = { id: string; label: string; description: string };

export function checkConversionAbort(options: ConversionOptions = {}) {
  options.signal?.throwIfAborted();
}

export function conversionBaseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Tai-lieu';
}
