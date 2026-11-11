import type { WorkbookData } from './sheetTypes';

export type CodecRequest =
  | { id: number; op: 'read'; buffer: ArrayBuffer; fileName: string }
  | { id: number; op: 'write'; workbook: WorkbookData };

export type CodecResponse =
  | { id: number; ok: true; result: WorkbookData | ArrayBuffer }
  | { id: number; ok: false; message: string };
