import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLiveBuild, isNewerBuild, parseBuildInfo } from '../src/lib/webUpdate';

test('parseBuildInfo accepts only a build id and version', () => {
  assert.deepEqual(parseBuildInfo({ build: '0.3.10-abc', version: '0.3.10' }), { build: '0.3.10-abc', version: '0.3.10' });
  assert.equal(parseBuildInfo({ build: '', version: '0.3.10' }), null);
  assert.equal(parseBuildInfo(null), null);
  assert.equal(parseBuildInfo('0.3.10'), null);
});

test('isNewerBuild only flags a different live build', () => {
  const live = { build: 'b2', version: '0.3.10' };
  assert.equal(isNewerBuild('b1', live), true);
  assert.equal(isNewerBuild('b2', live), false);
  assert.equal(isNewerBuild('b1', null), false);
  assert.equal(isNewerBuild('', live), false);
});

test('fetchLiveBuild bypasses the cache and survives network errors', async () => {
  let requested = '';
  let cache: RequestCache | undefined;
  const ok = (async (url: string, init?: RequestInit) => { requested = url; cache = init?.cache; return new Response(JSON.stringify({ build: 'b3', version: '0.3.11' })); }) as typeof fetch;
  assert.deepEqual(await fetchLiveBuild(ok), { build: 'b3', version: '0.3.11' });
  assert.match(requested, /^\/version\.json\?t=\d+$/);
  assert.equal(cache, 'no-store');
  const failing = (async () => { throw new TypeError('offline'); }) as typeof fetch;
  assert.equal(await fetchLiveBuild(failing), null);
  const missing = (async () => new Response('', { status: 404 })) as typeof fetch;
  assert.equal(await fetchLiveBuild(missing), null);
});
