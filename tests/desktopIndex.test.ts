import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stripSeoFallback } from '../scripts/strip-seo-fallback.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('desktop index.html drops the web SEO fallback but keeps the app mount point and metadata', () => {
  const desktop = stripSeoFallback(html);
  assert.doesNotMatch(desktop, /seo-fallback/);
  assert.doesNotMatch(desktop, /Văn phòng online miễn phí<\/h1>/);
  assert.match(desktop, /<div id="root"><\/div>/);
  assert.match(desktop, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.match(desktop, /<title>/);
});

test('web index.html still carries the SEO fallback exactly once', () => {
  assert.equal(html.match(/class="seo-page seo-fallback"/g)?.length, 1);
  assert.throws(() => stripSeoFallback(stripSeoFallback(html)), /found 0/);
});
