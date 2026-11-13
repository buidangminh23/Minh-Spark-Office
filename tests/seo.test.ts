import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const origin = 'https://office.minhspark.com';
const pages = [
  { path: '/', file: 'index.html' },
  { path: '/gioi-thieu.html', file: 'public/gioi-thieu.html' },
  { path: '/minh-docs.html', file: 'public/minh-docs.html' },
  { path: '/minh-sheets.html', file: 'public/minh-sheets.html' },
  { path: '/tai-ung-dung.html', file: 'public/tai-ung-dung.html' },
  { path: '/trinh-chieu-online.html', file: 'public/trinh-chieu-online.html' },
  { path: '/pdf-online.html', file: 'public/pdf-online.html' },
  { path: '/mo-file-word-excel-online.html', file: 'public/mo-file-word-excel-online.html' },
].map((page) => ({ ...page, html: readFileSync(new URL(page.file, root), 'utf8') }));

test('public URLs expose unique metadata, readable content and matching canonical signals', () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const page of pages) {
    assert.match(page.html, /<html lang="vi">/);
    assert.match(page.html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
    const title = page.html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = page.html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title?.includes('miễn phí'), page.path);
    assert.ok(description?.includes('miễn phí'), page.path);
    assert.ok(!titles.has(title));
    assert.ok(!descriptions.has(description));
    titles.add(title);
    descriptions.add(description);
    assert.equal((page.html.match(/rel="canonical"/g) ?? []).length, 1);
    assert.ok(page.html.includes(`rel="canonical" href="${origin}${page.path}"`));
    assert.ok(page.html.includes(`property="og:url" content="${origin}${page.path}"`));
    assert.match(page.html, /property="og:image" content="https:\/\/office\.minhspark\.com\/logo\.jpg"/);
    assert.match(page.html, /name="twitter:card" content="summary_large_image"/);
    assert.equal((page.html.match(/<h1[ >]/g) ?? []).length, 1);
    assert.doesNotMatch(page.html, /noindex|aggregateRating|reviewCount|miễn phí trọn đời/i);
  }
});

test('sitemap and robots expose exactly the public canonical URLs without private document routes', () => {
  const robots = readFileSync(new URL('public/robots.txt', root), 'utf8');
  const sitemap = readFileSync(new URL('public/sitemap.xml', root), 'utf8');
  assert.match(robots, /User-agent: \*\s+Allow: \//);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  assert.deepEqual(urls, pages.map((page) => origin + page.path).sort());
});

test('public pages link to existing assets and pages, and remain mutually discoverable', () => {
  for (const page of pages) {
    const links = [...page.html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
    for (const link of links) {
      const path = link.split(/[?#]/)[0];
      const relativePath = path === '/' ? 'index.html' : path.startsWith('/src/') ? path.slice(1) : path.startsWith('/api/') ? `${path.slice(1)}.ts` : `public${path}`;
      assert.ok(existsSync(fileURLToPath(new URL(relativePath, root))), `${page.path} references missing ${link}`);
    }
    for (const other of pages.filter((candidate) => candidate.path !== '/' && candidate.path !== page.path)) {
      assert.ok(links.includes(other.path), `${page.path} has no link to ${other.path}`);
    }
    assert.match(page.html, /<main[ >]/);
    assert.match(page.html, /trình duyệt/);
  }
});

test('the brand name Office 23 leads the home page signals and is declared as the site and app name', () => {
  const home = pages[0].html;
  assert.match(home, /<title>Office 23 /);
  assert.match(home, /<meta name="description" content="Office 23 /);
  assert.match(home, /<meta name="application-name" content="Office 23"/);
  assert.match(home, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  const schema = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  const website = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'WebSite');
  const app = schema['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'SoftwareApplication');
  assert.equal(website.name, 'Office 23');
  assert.ok(website.alternateName.includes('Minh Spark Office'));
  assert.equal(app.name, 'Office 23');
  const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.name, 'Office 23');
  for (const icon of manifest.icons) assert.ok(existsSync(fileURLToPath(new URL(`public${icon.src}`, root))), icon.src);
  assert.ok(existsSync(fileURLToPath(new URL('public/favicon.ico', root))));
});

test('JSON-LD describes the public website without unsupported review or offer claims', () => {
  for (const page of pages) {
    const blocks = [...page.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1);
    const schema = JSON.parse(blocks[0][1]);
    assert.equal(schema['@context'], 'https://schema.org');
    const nodes = schema['@graph'] ?? [schema];
    assert.ok(nodes.some((node: Record<string, unknown>) => node.url === origin + page.path));
    for (const node of nodes) {
      assert.equal(node.aggregateRating, undefined);
      assert.equal(node.review, undefined);
      assert.equal(node.offers, undefined);
      assert.ok(String(node['@id']).startsWith(origin));
    }
  }
});
