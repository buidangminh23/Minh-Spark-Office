import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STALE_CHUNK_RELOAD_KEY, STALE_CHUNK_RELOAD_WINDOW_MS, isChunkLoadError, reloadOnceForStaleChunk } from '../src/lib/staleChunk';

const environment = (overrides: { desktop?: boolean; now?: number } = {}) => {
  const values = new Map<string, string>();
  let reloads = 0;
  let now = overrides.now ?? 1_000_000;
  return {
    env: {
      storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
      reload: () => { reloads += 1; },
      now: () => now,
      desktop: overrides.desktop ?? false,
    },
    reloads: () => reloads,
    advance: (ms: number) => { now += ms; },
    values,
  };
};

test('chunk-load failures from each browser are recognised', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://office.minhspark.com/assets/pdfRender-abc.js',
    'error loading dynamically imported module: https://office.minhspark.com/assets/pdfRender-abc.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/x.css',
  ]) assert.ok(isChunkLoadError(new TypeError(message)), message);
  assert.ok(!isChunkLoadError(new Error('Invalid PDF structure')));
  assert.ok(!isChunkLoadError(null));
});

test('a stale chunk reloads the page once, then stops to avoid a reload loop', () => {
  const state = environment();
  assert.equal(reloadOnceForStaleChunk(state.env), true);
  assert.equal(state.reloads(), 1);
  assert.ok(state.values.has(STALE_CHUNK_RELOAD_KEY));
  state.advance(1000);
  assert.equal(reloadOnceForStaleChunk(state.env), false);
  assert.equal(state.reloads(), 1);
  state.advance(STALE_CHUNK_RELOAD_WINDOW_MS);
  assert.equal(reloadOnceForStaleChunk(state.env), true);
  assert.equal(state.reloads(), 2);
});

test('the desktop app and browsers without session storage never reload', () => {
  const desktop = environment({ desktop: true });
  assert.equal(reloadOnceForStaleChunk(desktop.env), false);
  assert.equal(desktop.reloads(), 0);
  const noStorage = environment();
  assert.equal(reloadOnceForStaleChunk({ ...noStorage.env, storage: null }), false);
  const throwing = environment();
  assert.equal(reloadOnceForStaleChunk({ ...throwing.env, storage: { getItem: () => { throw new Error('denied'); }, setItem: () => undefined } }), false);
  assert.equal(throwing.reloads(), 0);
});
