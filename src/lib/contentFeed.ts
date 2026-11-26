import { get, set } from 'idb-keyval';

const publishedContent = 'https://raw.githubusercontent.com/buidangminh23/Minh-Spark-Office/office-content-v1';

export function contentUrl(path: string): string {
  if (!/^\/content\/[a-z\d][a-z\d._/-]*$/i.test(path) || path.split('/').includes('..')) {
    throw new Error('Invalid Office content path');
  }
  const local = !('__TAURI_INTERNALS__' in window) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  return new URL(path.slice(1), (local ? location.origin : publishedContent) + '/').href;
}

export async function readContentManifest<T>(name: string, validate: (raw: unknown) => T): Promise<T | undefined> {
  const url = contentUrl(`/content/${name}.json`);
  const key = `office-content:${url}`;
  try {
    const response = await fetch(url, { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(4500) });
    if (!response.ok) throw new Error(`Content HTTP ${response.status}`);
    const raw: unknown = await response.json();
    const result = validate(raw);
    await set(key, raw).catch(() => undefined);
    return result;
  } catch {
    try {
      const raw: unknown = await get(key);
      if (raw !== undefined) return validate(raw);
    } catch {
      return undefined;
    }
  }
}
