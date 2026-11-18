import { OFFICE_DOCUMENT_EXTENSIONS, OFFICE_SHEET_EXTENSIONS, OFFICE_SLIDE_EXTENSIONS, officeConversionTargets, officeFileKind, officeTargets } from './officeConversionFormats';
import { IMAGE_SOURCE_EXTENSIONS, mediaConversionTargets } from './mediaConversionFormats';

import { macroVariants } from './conversionPackages';

export const CONVERSION_ACCEPT = [...OFFICE_DOCUMENT_EXTENSIONS, ...OFFICE_SHEET_EXTENSIONS, ...OFFICE_SLIDE_EXTENSIONS, 'pdf', ...IMAGE_SOURCE_EXTENSIONS].map(ext => '.' + ext).join(',');

export function conversionSourceKind(name: string) {
  if (!name.includes('.')) return null;
  const kind = officeFileKind(name);
  if (kind) return ({ document: 'doc', sheet: 'sheet', slide: 'slide' } as const)[kind];
  if (/\.pdf$/i.test(name)) return 'pdf';
  return mediaConversionTargets(name).length ? 'image' : null;
}

export function conversionTargets(name: string) {
  if (!conversionSourceKind(name)) return [];
  const media = mediaConversionTargets(name);
  if (media.length) {
    const existing = new Set(media.map(item => item.id));
    return [...media, ...Object.values(officeTargets).filter(item => !existing.has(item.id))];
  }
  const pageTargets = mediaConversionTargets('page.pdf').filter(item => ['bmp', 'tiff'].includes(item.id));
  const ext = name.split('.').pop()!.toLowerCase();
  const macros = macroVariants(ext).map(id => ({
    id, label: id.toUpperCase() + ' (.' + id + ')', description: 'Giữ nguyên nội dung và dự án VBA của tệp gốc.',
  }));
  return [...officeConversionTargets(name), ...macros, ...pageTargets];
}
