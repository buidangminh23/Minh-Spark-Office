import { OFFICE_DOCUMENT_EXTENSIONS, OFFICE_SHEET_EXTENSIONS, OFFICE_SLIDE_EXTENSIONS, officeConversionTargets, officeFileKind, officeTargets } from './officeConversionFormats';
import { IMAGE_OUTPUT_EXTENSIONS, IMAGE_SOURCE_EXTENSIONS, mediaConversionTargets } from './mediaConversionFormats';
import { conversionAliases, withConversionExtension } from './conversionAliases';

const extensions = new Set<string>([...OFFICE_DOCUMENT_EXTENSIONS, ...OFFICE_SHEET_EXTENSIONS, ...OFFICE_SLIDE_EXTENSIONS, 'pdf', ...IMAGE_SOURCE_EXTENSIONS]);
for (const [alias, canonical] of Object.entries(conversionAliases)) if (extensions.has(canonical)) extensions.add(alias);
export const CONVERSION_ACCEPT = [...extensions].map(ext => '.' + ext).join(',');

export function conversionSourceKind(name: string) {
  if (!name.includes('.')) return null;
  const alias = conversionAliases[name.split('.').pop()!.toLowerCase()];
  if (typeof alias === 'string') name = withConversionExtension(name, alias);
  const kind = officeFileKind(name);
  if (kind) return ({ document: 'doc', sheet: 'sheet', slide: 'slide' } as const)[kind];
  if (/\.pdf$/i.test(name)) return 'pdf';
  return mediaConversionTargets(name).length ? 'image' : null;
}

export function conversionTargets(name: string) {
  if (!conversionSourceKind(name)) return [];
  const ext = name.split('.').pop()!.toLowerCase();
  if (typeof conversionAliases[ext] === 'string') name = withConversionExtension(name, conversionAliases[ext]);
  const media = mediaConversionTargets(name);
  const base = media.length ? media : officeConversionTargets(name);
  const extra = media.length ? Object.values(officeTargets) : mediaConversionTargets('page.pdf').filter(item => IMAGE_OUTPUT_EXTENSIONS.includes(item.id));
  const targets = [...base, ...extra.filter(item => !base.some(format => format.id === item.id))];
  for (const [id, canonical] of Object.entries(conversionAliases)) {
    const format = targets.find(item => item.id === canonical);
    if (format) targets.push({ ...format, id, label: format.label.replace(/\(\.\w+\)$/, '(.' + id + ')') });
  }
  return targets;
}
