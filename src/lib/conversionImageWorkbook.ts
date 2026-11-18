import type { Workbook } from 'exceljs';
import { checkConversionAbort, type ConversionOptions } from './conversionTypes';

export async function writeImageWorkbook(workbook: Workbook, options: ConversionOptions = {}): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  checkConversionAbort(options);
  if (!workbook.worksheets.some(sheet => sheet.getImages().length)) return new Blob([buffer], { type });
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  for (const drawing of zip.file(/^xl\/drawings\/drawing\d+\.xml$/)) {
    checkConversionAbort(options);
    const xml = await drawing.async('string');
    const valid = xml.replace(/(<xdr:oneCellAnchor)\s+editAs="[^"]*"/g, '$1');
    if (xml !== valid) { zip.file(drawing.name, valid); changed = true; }
  }
  return changed ? zip.generateAsync({ type: 'blob', mimeType: type, compression: 'DEFLATE' }) : new Blob([buffer], { type });
}
