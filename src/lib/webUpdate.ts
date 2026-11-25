export const WEB_BUILD_PATH = '/version.json';
export const WEB_UPDATE_INTERVAL_MS = 10 * 60_000;

export type WebBuildInfo = { build: string; version: string };

export const parseBuildInfo = (value: unknown): WebBuildInfo | null => {
  if (!value || typeof value !== 'object') return null;
  const { build, version } = value as Record<string, unknown>;
  if (typeof build !== 'string' || !build || typeof version !== 'string') return null;
  return { build, version };
};

export const isNewerBuild = (current: string, live: WebBuildInfo | null) => Boolean(current && live && live.build !== current);

export async function fetchLiveBuild(fetchImpl: typeof fetch = fetch): Promise<WebBuildInfo | null> {
  try {
    const response = await fetchImpl(`${WEB_BUILD_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return parseBuildInfo(await response.json());
  } catch {
    return null;
  }
}
