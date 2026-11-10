export const STALE_CHUNK_RELOAD_KEY = 'mso-stale-chunk-reload';
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (?:CSS )?chunk \S+ failed/i;

export const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
};

type ReloadEnvironment = {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload: () => void;
  now: () => number;
  desktop: boolean;
};

const browserEnvironment = (): ReloadEnvironment => {
  let storage: ReloadEnvironment['storage'] = null;
  try { storage = window.sessionStorage; } catch { storage = null; }
  return { storage, reload: () => window.location.reload(), now: () => Date.now(), desktop: '__TAURI_INTERNALS__' in window };
};

export const reloadOnceForStaleChunk = (environment: ReloadEnvironment = browserEnvironment()) => {
  if (environment.desktop || !environment.storage) return false;
  try {
    const last = Number(environment.storage.getItem(STALE_CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && environment.now() - last < STALE_CHUNK_RELOAD_WINDOW_MS) return false;
    environment.storage.setItem(STALE_CHUNK_RELOAD_KEY, String(environment.now()));
  } catch {
    return false;
  }
  environment.reload();
  return true;
};
