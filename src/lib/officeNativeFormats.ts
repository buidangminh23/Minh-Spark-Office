import { odfMime, odfTypes, officePackages, packageContentType, packageMime } from './conversionPackages';
import { openOfficeZip } from './openOfficeZip';

const legacyMime: Record<string, string> = { doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint', rtf: 'application/rtf', pdf: 'application/pdf', epub: 'application/epub+zip' };
export function nativeOutputMime(extension: string): string | undefined {
  if (Object.hasOwn(officePackages, extension)) return packageMime(extension as keyof typeof officePackages);
  if (Object.hasOwn(odfTypes, extension)) return odfMime(extension as keyof typeof odfTypes);
  return Object.hasOwn(legacyMime, extension) ? legacyMime[extension] : undefined;
}

export async function checkLegacySheetSize(file: File) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 1 });
  for (const sheet of Object.values(workbook.Sheets)) {
    const ref = sheet['!fullref'] || sheet['!ref'];
    if (!ref) continue;
    const { e } = XLSX.utils.decode_range(ref);
    if (e.r >= 65_536 || e.c >= 256) throw new Error('XLS chỉ chứa tối đa 65.536 hàng và 256 cột mỗi trang tính. Hãy chọn XLSX để giữ đủ dữ liệu.');
  }
}

export async function checkNativeFile(bytes: ArrayBuffer, ext: string) {
  let valid = false;
  const header = new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength));
  const text = new TextDecoder().decode(header);
  if (ext === 'pdf') valid = text.startsWith('%PDF-');
  else if (['txt', 'md', 'htm', 'html'].includes(ext)) valid = !new Uint8Array(bytes).includes(0) || header[0] === 0xff && header[1] === 0xfe || header[0] === 0xfe && header[1] === 0xff;
  else if (ext === 'rtf') valid = text.trimStart().startsWith('{\\rtf');
  else if (['doc', 'ppt', 'xls'].includes(ext)) {
    valid = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, i) => header[i] === byte);
    if (valid) {
      const { read } = await import('cfb');
      const streams = read(new Uint8Array(bytes), { type: 'array' }).FileIndex;
      const names = ext === 'doc' ? ['WordDocument'] : ext === 'xls' ? ['Book', 'Workbook'] : ['PowerPoint Document'];
      valid = streams.some(stream => stream.type === 2 && names.includes(stream.name));
    }
  } else {
    const zip = await openOfficeZip(bytes);
    if (ext === 'xlsb') valid = !!zip.file('xl/workbook.bin') && !!(await zip.file('[Content_Types].xml')?.async('string'))?.includes('application/vnd.ms-excel.sheet.binary.macroEnabled.main');
    else if (ext === 'epub') valid = !!zip.file('META-INF/container.xml') && (await zip.file('mimetype')?.async('string')) === 'application/epub+zip';
    else if (Object.hasOwn(odfTypes, ext)) valid = !!zip.file('content.xml') && (await zip.file('mimetype')?.async('string')) === nativeOutputMime(ext);
    else if (Object.hasOwn(officePackages, ext)) {
      const part = officePackages[ext as keyof typeof officePackages];
      valid = !!zip.file(part[1]) && !!(await zip.file('[Content_Types].xml')?.async('string'))?.includes(packageContentType(ext as keyof typeof officePackages));
    }
  }
  if (!valid) throw new Error('Nội dung tệp không khớp với định dạng ' + ext.toUpperCase() + '.');
}
