export const COUNTERS = ['downloadsWindows', 'downloadsMac', 'downloadsLinux', 'users'] as const;
export type Counter = (typeof COUNTERS)[number];
export type Stats = Record<Counter, number | null>;

const INSTALLER = /^MinhSparkOffice-\d+\.\d+\.\d+-(windows-x64-vi-Setup\.exe|windows-x64-en-US\.msi|macos-arm64\.dmg|linux-x64\.deb|linux-x64\.AppImage)$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|monitor|curl\/|wget|python-requests|go-http-client/i;
const TIMEOUT_MS = 1500;

export type StatsConfig = { projectId: string; apiKey: string | undefined; fetch: typeof fetch };

export function installerCounter(file: string | null): Counter | null {
  const match = file ? INSTALLER.exec(file) : null;
  if (!match) return null;
  if (match[1].startsWith('windows')) return 'downloadsWindows';
  return match[1].startsWith('linux') ? 'downloadsLinux' : 'downloadsMac';
}

export function isBot(userAgent: string | null) {
  return !userAgent || BOT.test(userAgent);
}

function documentsUrl(config: StatsConfig) {
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
}

function withTimeout(signalMs: number) {
  return AbortSignal.timeout(signalMs);
}

export async function incrementCounter(config: StatsConfig, counter: Counter) {
  if (!config.apiKey) return false;
  const name = `projects/${config.projectId}/databases/(default)/documents/publicStats/${counter}`;
  try {
    const response = await config.fetch(`${documentsUrl(config)}:commit?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ transform: { document: name, fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] } }] }),
      signal: withTimeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function readStats(config: StatsConfig): Promise<Stats> {
  const empty: Stats = { downloadsWindows: null, downloadsMac: null, downloadsLinux: null, users: null };
  if (!config.apiKey) return empty;
  try {
    const response = await config.fetch(`${documentsUrl(config)}:batchGet?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: COUNTERS.map((counter) => `projects/${config.projectId}/databases/(default)/documents/publicStats/${counter}`) }),
      signal: withTimeout(TIMEOUT_MS),
    });
    if (!response.ok) return empty;
    const rows = await response.json() as { found?: { name: string; fields?: { count?: { integerValue?: string } } }; missing?: string }[];
    const stats: Stats = { downloadsWindows: 0, downloadsMac: 0, downloadsLinux: 0, users: 0 };
    for (const row of rows) {
      if (!row.found) continue;
      const counter = row.found.name.split('/').pop() as Counter;
      if (COUNTERS.includes(counter)) stats[counter] = Number(row.found.fields?.count?.integerValue ?? 0);
    }
    return stats;
  } catch {
    return empty;
  }
}
