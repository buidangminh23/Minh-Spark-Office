import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementCounter, installerCounter, isBot, readStats } from '../api/_shared/stats.ts';

describe('download and usage counters', () => {
  test('only release installers map to a platform counter', () => {
    assert.equal(installerCounter('MinhSparkOffice-0.2.32-windows-x64-vi-Setup.exe'), 'downloadsWindows');
    assert.equal(installerCounter('MinhSparkOffice-0.2.32-windows-x64-en-US.msi'), 'downloadsWindows');
    assert.equal(installerCounter('MinhSparkOffice-0.2.32-macos-arm64.dmg'), 'downloadsMac');
    assert.equal(installerCounter('MinhSparkOffice-0.2.32-macos-arm64.app.tar.gz'), null);
    assert.equal(installerCounter('../SHA256SUMS.txt'), null);
    assert.equal(installerCounter('MinhSparkOffice-0.2.32-windows-x64-vi-Setup.exe?x=1'), null);
    assert.equal(installerCounter(null), null);
  });

  test('bots and missing user agents are not counted', () => {
    assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36'), false);
    assert.equal(isBot('Googlebot/2.1'), true);
    assert.equal(isBot('curl/8.4.0'), true);
    assert.equal(isBot(null), true);
  });

  test('increment sends one atomic transform and survives a failing network', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const ok = await incrementCounter({ projectId: 'p', apiKey: 'k', fetch: (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}'); }) as typeof fetch }, 'downloadsMac');
    assert.equal(ok, true);
    assert.match(calls[0].url, /documents:commit\?key=k$/);
    assert.deepEqual(calls[0].body, { writes: [{ transform: { document: 'projects/p/databases/(default)/documents/publicStats/downloadsMac', fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] } }] });
    assert.equal(await incrementCounter({ projectId: 'p', apiKey: 'k', fetch: (async () => { throw new Error('offline'); }) as typeof fetch }, 'users'), false);
    assert.equal(await incrementCounter({ projectId: 'p', apiKey: undefined, fetch }, 'users'), false);
  });

  test('missing counters read as zero and failures read as null', async () => {
    const rows = [
      { found: { name: 'projects/p/databases/(default)/documents/publicStats/downloadsWindows', fields: { count: { integerValue: '1064' } } } },
      { missing: 'projects/p/databases/(default)/documents/publicStats/downloadsMac' },
      { found: { name: 'projects/p/databases/(default)/documents/publicStats/users', fields: { count: { integerValue: '37' } } } },
    ];
    const stats = await readStats({ projectId: 'p', apiKey: 'k', fetch: (async () => new Response(JSON.stringify(rows))) as typeof fetch });
    assert.deepEqual(stats, { downloadsWindows: 1064, downloadsMac: 0, users: 37 });
    const failed = await readStats({ projectId: 'p', apiKey: 'k', fetch: (async () => new Response('', { status: 403 })) as typeof fetch });
    assert.deepEqual(failed, { downloadsWindows: null, downloadsMac: null, users: null });
  });
});
