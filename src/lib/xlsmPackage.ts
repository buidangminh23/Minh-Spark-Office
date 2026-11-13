import JSZip from 'jszip';

export const MINH_BUNDLE_NAMESPACE = 'urn:minhspark:office:sheet-automation';
export const RECORDED_VBA_MODULE = 'MinhSheetsMacros';
const VBA_CONTENT_TYPE = 'application/vnd.ms-office.vbaProject';
const MACRO_MAIN_CONTENT_TYPE = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml';
const PLAIN_MAIN_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
const VBA_REL_TYPE = 'http://schemas.microsoft.com/office/2006/relationships/vbaProject';
const CUSTOM_XML_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
const CUSTOM_XML_PROPS_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps';
const CUSTOM_XML_PROPS_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.customXmlProperties+xml';

export interface CodeNames {
  workbook: string;
  sheets: string[];
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function addRelationship(xml: string, id: string, type: string, target: string): string {
  if (xml.includes(`Type="${type}"`) && xml.includes(`Target="${target}"`)) return xml;
  return xml.replace('</Relationships>', `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`);
}

function nextRelationshipId(xml: string): string {
  const ids = [...xml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

function setWorkbookCodeName(xml: string, codeName: string): string {
  if (/<workbookPr\b[^>]*codeName=/.test(xml)) return xml.replace(/(<workbookPr\b[^>]*codeName=")[^"]*(")/, `$1${escapeXml(codeName)}$2`);
  if (/<workbookPr\b/.test(xml)) return xml.replace(/<workbookPr\b/, `<workbookPr codeName="${escapeXml(codeName)}"`);
  if (/<fileVersion\b[^>]*\/>/.test(xml)) return xml.replace(/(<fileVersion\b[^>]*\/>)/, `$1<workbookPr codeName="${escapeXml(codeName)}"/>`);
  return xml.replace(/(<workbook\b[^>]*>)/, `$1<workbookPr codeName="${escapeXml(codeName)}"/>`);
}

function setSheetCodeName(xml: string, codeName: string): string {
  if (/<sheetPr\b[^>]*codeName=/.test(xml)) return xml.replace(/(<sheetPr\b[^>]*codeName=")[^"]*(")/, `$1${escapeXml(codeName)}$2`);
  if (/<sheetPr\b[^>]*\/>/.test(xml)) return xml.replace(/<sheetPr\b/, `<sheetPr codeName="${escapeXml(codeName)}"`);
  if (/<sheetPr\b/.test(xml)) return xml.replace(/<sheetPr\b/, `<sheetPr codeName="${escapeXml(codeName)}"`);
  return xml.replace(/(<worksheet\b[^>]*>)/, `$1<sheetPr codeName="${escapeXml(codeName)}"/>`);
}

export async function worksheetPaths(zip: JSZip): Promise<string[]> {
  const workbook = await zip.file('xl/workbook.xml')!.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const attribute = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((match) => [attribute(match[0], 'Id'), attribute(match[0], 'Target')]));
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((match) => {
    const target = targets.get(attribute(match[0], 'r:id')) ?? '';
    return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  });
}

export async function readCodeNames(zip: JSZip): Promise<{ workbook?: string; sheets: Array<string | undefined> }> {
  const workbook = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbook) return { sheets: [] };
  const workbookCodeName = /<workbookPr\b[^>]*codeName="([^"]+)"/.exec(workbook)?.[1];
  const sheets: Array<string | undefined> = [];
  for (const path of await worksheetPaths(zip)) {
    const xml = await zip.file(path)?.async('string');
    sheets.push(xml ? /<sheetPr\b[^>]*codeName="([^"]+)"/.exec(xml)?.[1] : undefined);
  }
  return { workbook: workbookCodeName, sheets };
}

export async function addVbaProject(zip: JSZip, vbaProject: Uint8Array, codeNames: CodeNames): Promise<void> {
  zip.file('xl/vbaProject.bin', vbaProject);
  let types = await zip.file('[Content_Types].xml')!.async('string');
  if (!/Extension="bin"/.test(types)) types = types.replace(/(<Types\b[^>]*>)/, `$1<Default Extension="bin" ContentType="${VBA_CONTENT_TYPE}"/>`);
  types = types.replace(PLAIN_MAIN_CONTENT_TYPE, MACRO_MAIN_CONTENT_TYPE);
  zip.file('[Content_Types].xml', types);
  let rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  if (!rels.includes(VBA_REL_TYPE)) rels = addRelationship(rels, nextRelationshipId(rels), VBA_REL_TYPE, 'vbaProject.bin');
  zip.file('xl/_rels/workbook.xml.rels', rels);
  zip.file('xl/workbook.xml', setWorkbookCodeName(await zip.file('xl/workbook.xml')!.async('string'), codeNames.workbook));
  const paths = await worksheetPaths(zip);
  for (const [index, path] of paths.entries()) {
    const codeName = codeNames.sheets[index];
    const file = zip.file(path);
    if (!codeName || !file) continue;
    zip.file(path, setSheetCodeName(await file.async('string'), codeName));
  }
}

export async function addMinhBundle(zip: JSZip, payload: unknown): Promise<void> {
  const json = JSON.stringify(payload);
  const encoded = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
  const existing = Object.keys(zip.files).filter((name) => /^customXml\/item\d+\.xml$/.test(name));
  let index = existing.length + 1;
  for (const name of existing) {
    const text = await zip.file(name)!.async('string');
    if (text.includes(MINH_BUNDLE_NAMESPACE)) index = Number(/item(\d+)\.xml$/.exec(name)![1]);
  }
  const itemPath = `customXml/item${index}.xml`;
  zip.file(itemPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<minhAutomation xmlns="${MINH_BUNDLE_NAMESPACE}" version="1">${encoded}</minhAutomation>`);
  zip.file(
    `customXml/itemProps${index}.xml`,
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<ds:datastoreItem ds:itemID="{6B1F2A3C-4D5E-4F60-8A7B-9C0D1E2F3A4B}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="${MINH_BUNDLE_NAMESPACE}"/></ds:schemaRefs></ds:datastoreItem>`
  );
  zip.file(`customXml/_rels/item${index}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${CUSTOM_XML_PROPS_REL_TYPE}" Target="itemProps${index}.xml"/></Relationships>`);
  let types = await zip.file('[Content_Types].xml')!.async('string');
  if (!types.includes(`/customXml/itemProps${index}.xml`)) {
    types = types.replace('</Types>', `<Override PartName="/customXml/itemProps${index}.xml" ContentType="${CUSTOM_XML_PROPS_CONTENT_TYPE}"/></Types>`);
  }
  zip.file('[Content_Types].xml', types);
  let rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const target = `../customXml/item${index}.xml`;
  if (!rels.includes(target)) rels = addRelationship(rels, nextRelationshipId(rels), CUSTOM_XML_REL_TYPE, target);
  zip.file('xl/_rels/workbook.xml.rels', rels);
}

export async function readMinhBundle(zip: JSZip): Promise<unknown | null> {
  for (const name of Object.keys(zip.files)) {
    if (!/^customXml\/item\d+\.xml$/.test(name)) continue;
    const text = await zip.file(name)!.async('string');
    if (!text.includes(MINH_BUNDLE_NAMESPACE)) continue;
    const match = /<minhAutomation\b[^>]*>([^<]*)<\/minhAutomation>/.exec(text);
    if (!match) continue;
    try {
      const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(match[1].trim()))) : Buffer.from(match[1].trim(), 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}

export const defaultSheetCodeName = (index: number) => `Sheet${index + 1}`;
