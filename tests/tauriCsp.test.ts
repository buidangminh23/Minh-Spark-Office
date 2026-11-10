import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { videoEmbedUrl } from '../src/editors/doc/insertNodes';
import { PYODIDE_INDEX_URL } from '../src/lib/python/protocol';

const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp: string = config.app.security.csp;
const directive = (name: string) => (new RegExp(`(?:^|;)\\s*${name} ([^;]*)`).exec(csp)?.[1] ?? '').trim().split(/\s+/);
const frameSources = directive('frame-src');

test('the desktop app allows every video host the editor embeds', () => {
  const samples = ['https://www.youtube.com/watch?v=xwnv4J66Ndc', 'https://youtu.be/xwnv4J66Ndc', 'https://vimeo.com/76979871'];
  for (const sample of samples) {
    const embed = videoEmbedUrl(sample);
    assert.ok(embed, sample);
    assert.ok(frameSources.includes(new URL(embed).origin), `${new URL(embed).origin} missing from frame-src`);
  }
});

test('the desktop CSP only lets the pinned Pyodide build in from jsDelivr', () => {
  assert.ok(PYODIDE_INDEX_URL.endsWith('/'), 'a path source without a trailing slash matches a single file only');
  for (const name of ['script-src', 'connect-src']) {
    const jsdelivr = directive(name).filter((source) => source.includes('jsdelivr'));
    assert.deepEqual(jsdelivr, [PYODIDE_INDEX_URL], `${name} must scope jsDelivr to ${PYODIDE_INDEX_URL}`);
  }
});

test('the desktop CSP has no wildcard or inline script sources', () => {
  for (const source of directive('script-src')) {
    assert.ok(!source.includes('*'), source);
    assert.ok(!["'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:', 'data:', 'blob:'].includes(source), source);
    assert.ok(source.startsWith("'") || /^https:\/\/[^/]+\/.+/.test(source), `${source} must be a keyword or a path-scoped https source`);
  }
});
