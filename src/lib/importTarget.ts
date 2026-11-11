import { isImageFile } from './imageFormatNames';

export type ImportFormat = 'word' | 'text' | 'spreadsheet' | 'pdf' | 'presentation' | 'image';
export type ImportTarget = { format: ImportFormat; editor: 'doc' | 'sheet' | 'pdf' | 'slide' | 'image' };

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function importTargetOf(fileName: string): ImportTarget | null {
  if (/\.(docx|doc)$/i.test(fileName)) return { format: 'word', editor: 'doc' };
  if (/\.(txt|md|markdown|html|htm)$/i.test(fileName)) return { format: 'text', editor: 'doc' };
  if (/\.(xlsx|xlsm|xls|csv|tsv)$/i.test(fileName)) return { format: 'spreadsheet', editor: 'sheet' };
  if (/\.pdf$/i.test(fileName)) return { format: 'pdf', editor: 'pdf' };
  if (/\.(pptx|ppt)$/i.test(fileName)) return { format: 'presentation', editor: 'slide' };
  if (isImageFile(fileName)) return { format: 'image', editor: 'image' };
  return null;
}

export const isOleContainer = (bytes: Uint8Array) =>
  bytes.length > OLE_SIGNATURE.length && OLE_SIGNATURE.every((value, index) => bytes[index] === value);
