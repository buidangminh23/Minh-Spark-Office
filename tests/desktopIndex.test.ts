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

test('web shows the loading splash, never the SEO fallback text, while scripts load', () => {
  const css = readFileSync(new URL('../public/seo.css', import.meta.url), 'utf8');
  const scripting = css.match(/@media \(scripting: enabled\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(scripting, /\.seo-fallback \{[^}]*clip-path: inset\(50%\)/);
  assert.match(scripting, /\.desktop-splash \{ display: grid; \}/);
  assert.match(html, /class="desktop-splash"/);
});

test('home page no longer renders the about block in the workspace', () => {
  const home = readFileSync(new URL('../src/components/Home.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /ws-about|office-overview-title/);
});

test('web index.html still carries the SEO fallback exactly once', () => {
  assert.equal(html.match(/class="seo-page seo-fallback"/g)?.length, 1);
  assert.throws(() => stripSeoFallback(stripSeoFallback(html)), /found 0/);
});
