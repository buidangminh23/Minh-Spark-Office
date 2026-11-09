import { isDesktop } from './desktop';

const COUNTED_KEY = 'ms-usage-counted-v1';
const STATS_ORIGIN = 'https://office.minhspark.com';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;

function statsUrl() {
  return `${isDesktop() ? STATS_ORIGIN : window.location.origin}/api/stats?event=user`;
}

function alreadyCounted() {
  try { return window.localStorage.getItem(COUNTED_KEY) === '1'; } catch { return true; }
}

function markCounted() {
  try { window.localStorage.setItem(COUNTED_KEY, '1'); } catch { /* storage unavailable */ }
}

export function countThisDeviceOnce() {
  if (typeof window === 'undefined' || alreadyCounted() || LOCAL_HOST.test(window.location.hostname)) return;
  const send = () => {
    fetch(statsUrl(), { method: 'POST', keepalive: true })
      .then((response) => { if (response.status === 204) markCounted(); })
      .catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(send, { timeout: 10_000 });
  else setTimeout(send, 3_000);
}
