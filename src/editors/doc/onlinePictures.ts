export type OnlinePicture = { title: string; thumb: string; full: string; width: number; height: number; author: string; license: string; page: string };

const API = 'https://commons.wikimedia.org/w/api.php';
const THUMB = 320;
const INSERT_MAX = 1280;

export function searchUrl(query: string, offset = 0): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '24',
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: String(THUMB),
    iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  return `${API}?${params}`;
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

const withoutQuery = (url: string) => url.split('?')[0];

export const sizedUrl = (thumb: string, original: string, width: number) => {
  if (width <= INSERT_MAX) return withoutQuery(original);
  return withoutQuery(thumb).replace(/\/\d+px-([^/]+)$/, `/${INSERT_MAX}px-$1`);
};

type ApiPage = { title?: string; index?: number; imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] };

export function parseResults(body: unknown): { items: OnlinePicture[]; next: number | null } {
  const data = body as { query?: { pages?: Record<string, ApiPage> }; continue?: { gsroffset?: number } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const items = pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.url) return [];
    const width = info.width ?? 0;
    return [{
      title: String(page.title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
      thumb: info.thumburl,
      full: sizedUrl(info.thumburl, info.url, width),
      width,
      height: info.height ?? 0,
      author: stripTags(info.extmetadata?.Artist?.value ?? ''),
      license: stripTags(info.extmetadata?.LicenseShortName?.value ?? ''),
      page: info.descriptionurl ?? '',
    }];
  });
  return { items, next: data.continue?.gsroffset ?? null };
}

export const credit = (picture: OnlinePicture) => [picture.title, picture.author && `Tác giả: ${picture.author}`, picture.license && `Giấy phép: ${picture.license}`, 'Wikimedia Commons'].filter(Boolean).join(' · ');
