import JSZip from 'jszip';

const WORKBOOK = 'xl/workbook.xml';
const STYLES = 'xl/styles.xml';
const FALLBACK_FONT = 'Calibri';

export function repairWorkbookXml(xml: string): string {
  const cleaned = xml.replace(/<definedName\b[^>]*?(?:\/>|>\s*<\/definedName>)/g, '');
  return cleaned.replace(/<definedNames>\s*<\/definedNames>/, '');
}

export function repairStylesXml(xml: string): string {
  if (!/<name val=""\s*\/>/.test(xml)) return xml;
  const named = /<name val="([^"]+)"\s*\/>/.exec(xml)?.[1] ?? FALLBACK_FONT;
  return xml.replace(/<name val=""\s*\/>/g, `<name val="${named}"/>`);
}

export async function repairEngineXlsx(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  for (const [path, repair] of [[WORKBOOK, repairWorkbookXml], [STYLES, repairStylesXml]] as const) {
    const entry = zip.file(path);
    if (!entry) continue;
    const xml = await entry.async('string');
    const repaired = repair(xml);
    if (repaired === xml) continue;
    zip.file(path, repaired);
    changed = true;
  }
  if (!changed) return bytes;
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }) as Promise<Uint8Array<ArrayBuffer>>;
}
