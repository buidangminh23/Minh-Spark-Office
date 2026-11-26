import { get, set } from 'idb-keyval';
import type { ThumbVariant } from '../components/HomeParts';
import { contentUrl } from './contentFeed';
import type { WorkbookData } from './sheetTypes';
import type { PresentationData } from './slideTypes';
import { blankPresentation } from './slideTemplates';
import { uid } from './workbookBasics';

type Kind = 'doc' | 'sheet' | 'slide';
const formats = {
  doc: ['html', 'docx'],
  sheet: ['workbook.json', 'xlsx'],
  slide: ['slides.json', 'pptx'],
  image: ['webp', 'png', 'jpg', 'jpeg'],
} as const;
type Format = (typeof formats)[keyof typeof formats][number];
export type TemplateAsset = { sha256: string; format: Format };
export type GalleryTemplate = { id: string; title: string; kind: Kind; thumb: ThumbVariant; asset?: TemplateAsset; image?: TemplateAsset };
export type TemplateManifest = { schema: 1; templates: GalleryTemplate[] };

const thumbVariants: ThumbVariant[] = ['report', 'minutes', 'budget', 'gantt', 'blank-doc', 'contract', 'blank-sheet', 'payroll', 'cashbook', 'pitch', 'product-launch', 'blank-slide'];

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === 'object' && !Array.isArray(raw);
}

function parseAsset(raw: unknown, allowed: readonly Format[]): TemplateAsset | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || typeof raw.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.sha256)
    || !allowed.includes(raw.format as Format)) throw new Error('Invalid template asset');
  return { sha256: raw.sha256, format: raw.format as Format };
}

export function parseTemplateManifest(raw: unknown): TemplateManifest {
  if (!isRecord(raw) || raw.schema !== 1 || !Array.isArray(raw.templates)) throw new Error('Invalid template catalog');
  const ids = new Set<string>();
  const templates = raw.templates.map((item): GalleryTemplate => {
    if (!isRecord(item) || typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || ids.has(item.id)
      || typeof item.title !== 'string' || !item.title.trim() || !['doc', 'sheet', 'slide'].includes(String(item.kind))) {
      throw new Error('Invalid template entry');
    }
    ids.add(item.id);
    const kind = item.kind as Kind;
    const thumb = thumbVariants.includes(item.thumb as ThumbVariant) ? item.thumb as ThumbVariant : `blank-${kind}` as ThumbVariant;
    return { id: item.id, title: item.title, kind, thumb, asset: parseAsset(item.asset, formats[kind]), image: parseAsset(item.image, formats.image) };
  });
  return { schema: 1, templates };
}

async function matchesDigest(bytes: ArrayBuffer, sha256: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('') === sha256;
}

export async function readTemplateAsset(asset: TemplateAsset, packaged: boolean): Promise<ArrayBuffer> {
  const path = `/content/templates/${asset.sha256}.${asset.format}`;
  const key = `office23-template:${asset.sha256}`;
  const cached = await get<ArrayBuffer>(key).catch(() => undefined);
  if (cached instanceof ArrayBuffer && await matchesDigest(cached, asset.sha256)) return cached;

  const remote = contentUrl(path);
  const urls = packaged ? [path, remote] : [remote];
  for (const url of new Set(urls)) {
    try {
      const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(12000) });
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      if (!await matchesDigest(bytes, asset.sha256)) continue;
      await set(key, bytes).catch(() => undefined);
      return bytes;
    } catch { continue; }
  }
  throw new Error(`Template asset unavailable: ${asset.sha256}`);
}

type TemplateActions = {
  onCreateDoc: (html?: string) => void;
  onCreateSheet: (workbook?: WorkbookData) => void;
  onCreateSlide: (presentation?: PresentationData) => void;
  onImportFile: (file: File) => void;
};

export async function openGalleryTemplate(template: GalleryTemplate, bundled: GalleryTemplate | undefined, actions: TemplateActions) {
  if (!template.asset) {
    if (template.kind === 'doc') return actions.onCreateDoc();
    if (template.kind === 'sheet') return actions.onCreateSheet();
    return actions.onCreateSlide(blankPresentation());
  }
  let asset = template.asset;
  let bytes: ArrayBuffer;
  const lastOpenedKey = `office23-template-opened:${template.kind}:${template.id}`;
  try {
    bytes = await readTemplateAsset(asset, bundled?.asset?.sha256 === asset.sha256);
  } catch (error) {
    const previous = await get<TemplateAsset>(lastOpenedKey).catch(() => undefined);
    const fallback = previous && previous.sha256 !== asset.sha256 ? previous : bundled?.asset;
    if (!fallback || fallback.sha256 === asset.sha256 || !parseAsset(fallback, formats[template.kind])) throw error;
    asset = fallback;
    bytes = await readTemplateAsset(asset, bundled?.asset?.sha256 === asset.sha256);
  }
  const { format } = asset;
  await set(lastOpenedKey, asset).catch(() => undefined);
  if (format === 'html') return actions.onCreateDoc(new TextDecoder().decode(bytes).replaceAll('{{today}}', new Date().toLocaleDateString('vi-VN')));
  if (format === 'workbook.json') {
    const workbook = JSON.parse(new TextDecoder().decode(bytes)) as WorkbookData;
    if (!Array.isArray(workbook?.sheetOrder) || !workbook.sheetOrder.length || !workbook.sheetOrder.every(id => workbook.sheets?.[id]?.cellData)) {
      throw new Error('Invalid workbook template');
    }
    workbook.id = uid('wb');
    return actions.onCreateSheet(workbook);
  }
  if (format === 'slides.json') {
    const presentation = JSON.parse(new TextDecoder().decode(bytes)) as PresentationData;
    if (!Array.isArray(presentation?.slides) || !presentation.slides.length || !presentation.slides.every(slide => Array.isArray(slide?.elements))) {
      throw new Error('Invalid presentation template');
    }
    return actions.onCreateSlide(presentation);
  }
  const officeType = { docx: 'wordprocessingml.document', xlsx: 'spreadsheetml.sheet', pptx: 'presentationml.presentation' } as const;
  if (format !== 'docx' && format !== 'xlsx' && format !== 'pptx') throw new Error('Unsupported template format');
  return actions.onImportFile(new File([bytes], `${template.title}.${format}`, { type: `application/vnd.openxmlformats-officedocument.${officeType[format]}` }));
}
