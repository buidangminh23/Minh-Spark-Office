import { openOfficeZip } from './openOfficeZip';

const macroTypes = {
  docm: ['docm', 'word/document.xml', 'application/vnd.ms-word.document'],
  dotm: ['docm', 'word/document.xml', 'application/vnd.ms-word.template'],
  xlsm: ['xlsm', 'xl/workbook.xml', 'application/vnd.ms-excel.sheet'],
  xltm: ['xlsm', 'xl/workbook.xml', 'application/vnd.ms-excel.template'],
  pptm: ['pptm', 'ppt/presentation.xml', 'application/vnd.ms-powerpoint.presentation'],
  potm: ['pptm', 'ppt/presentation.xml', 'application/vnd.ms-powerpoint.template'],
  ppsm: ['pptm', 'ppt/presentation.xml', 'application/vnd.ms-powerpoint.slideshow'],
} as const;
export const macroOutputBase: Partial<Record<string, string>> = {
  docm: 'docx', dotm: 'docx', xlsm: 'xlsx', xltm: 'xlsx', pptm: 'pptx', ppsm: 'pptx', potm: 'pptx',
};

export const officePackages = {
  docx: ['docx', 'word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  dotx: ['docx', 'word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
  xlsx: ['xlsx', 'xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xltx: ['xlsx', 'xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
  pptx: ['pptx', 'ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ppsx: ['pptx', 'ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
  potx: ['pptx', 'ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.template'],
  ...macroTypes,
} as const;

export function packageMime(ext: keyof typeof officePackages) {
  return officePackages[ext][2] + (Object.hasOwn(macroTypes, ext) ? '.macroEnabled.12' : '');
}
export function packageContentType(ext: keyof typeof officePackages) {
  return officePackages[ext][2] + (Object.hasOwn(macroTypes, ext) ? '.macroEnabled.main+xml' : '.main+xml');
}

export const odfTypes = {
  odt: 'text', ott: 'text-template', ods: 'spreadsheet', ots: 'spreadsheet-template',
  odp: 'presentation', otp: 'presentation-template',
} as const;
export const odfMime = (ext: keyof typeof odfTypes) => 'application/vnd.oasis.opendocument.' + odfTypes[ext];
export const packageBase: Record<string, string> = { dotx: 'docx', xltx: 'xlsx', ppsx: 'pptx', potx: 'pptx', ott: 'odt', ots: 'ods', otp: 'odp', dotm: 'docm', xltm: 'xlsm', potm: 'pptm', ppsm: 'pptm' };

export async function changeOfficePackage(file: File, from: string, to: string): Promise<Blob> {
  const zip = await openOfficeZip(await file.arrayBuffer());
  if (Object.hasOwn(odfTypes, from) && Object.hasOwn(odfTypes, to)) {
    const oldMime = odfMime(from as keyof typeof odfTypes);
    const mime = odfMime(to as keyof typeof odfTypes);
    const manifest = await zip.file('META-INF/manifest.xml')?.async('string');
    if (await zip.file('mimetype')?.async('string') !== oldMime || !manifest?.includes(oldMime) || !zip.file('content.xml')) throw new Error('Gói OpenDocument thiếu dữ liệu hoặc sai loại tài liệu.');
    const xml = new DOMParser().parseFromString(manifest, 'application/xml');
    const ns = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
    const root = Array.from(xml.getElementsByTagNameNS(ns, 'file-entry')).find(el => el.getAttributeNS(ns, 'full-path') === '/');
    if (root?.getAttributeNS(ns, 'media-type') !== oldMime) throw new Error('Gói OpenDocument thiếu mô tả loại tài liệu.');
    root.setAttributeNS(ns, 'manifest:media-type', mime);
    zip.file('mimetype', mime, { compression: 'STORE' });
    zip.file('META-INF/manifest.xml', new XMLSerializer().serializeToString(xml));
    return zip.generateAsync({ type: 'blob', mimeType: mime, compression: 'DEFLATE' });
  }
  const source = officePackages[from as keyof typeof officePackages];
  const target = officePackages[to as keyof typeof officePackages];
  const types = await zip.file('[Content_Types].xml')?.async('string');
  if (!source || !target || (source[0] !== target[0] && source[0] !== macroOutputBase[to]) || !types || !zip.file(source[1])) throw new Error('Gói Office không đúng định dạng đã chọn.');
  const xml = new DOMParser().parseFromString(types, 'application/xml');
  const part = Array.from(xml.getElementsByTagNameNS('*', 'Override')).find(el => el.getAttribute('PartName') === '/' + source[1]);
  if (part?.getAttribute('ContentType') !== packageContentType(from as keyof typeof officePackages)) throw new Error('Loại tài liệu bên trong không khớp phần mở rộng Office.');
  part.setAttribute('ContentType', packageContentType(to as keyof typeof officePackages));
  zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({ type: 'blob', mimeType: packageMime(to as keyof typeof officePackages), compression: 'DEFLATE' });
}
