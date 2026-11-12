import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { videoEmbedUrl } from '../src/editors/doc/insertNodes';
import { PYODIDE_INDEX_URL } from '../src/lib/python/protocol';
import { VERSION_FILES, bumpVersionText, nextPatchVersion } from '../scripts/release-lib.mjs';

type Rule = { source: string; headers: { key: string; value: string }[] };

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const rules: Rule[] = JSON.parse(read('vercel.json')).headers;
const STATIC_PAGES = ['public/gioi-thieu.html', 'public/tai-ung-dung.html', 'public/minh-docs.html', 'public/minh-sheets.html'];
const FIREBASE_AUTH_DOMAIN = 'https://minh-spark-office.firebaseapp.com';

const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path);

const headersFor = (path: string, key: string) => rules
  .filter((rule) => matches(rule.source, path))
  .flatMap((rule) => rule.headers.filter((header) => header.key.toLowerCase() === key.toLowerCase()).map((header) => header.value));

const policyFor = (path: string) => {
  const policies = headersFor(path, 'Content-Security-Policy');
  assert.equal(policies.length, 1, `${path} must get exactly one CSP, got ${policies.length}`);
  return Object.fromEntries(policies[0].split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...sources] = part.split(/\s+/);
    return [name, sources];
  })) as Record<string, string[]>;
};

const allows = (sources: string[], url: string) => {
  const target = new URL(url);
  return sources.some((source) => {
    if (source === `${target.protocol}`) return true;
    if (source.startsWith("'")) return false;
    const [, scheme, host, port, path = '/'] = /^(https?):\/\/([^/:]+)(?::(\*|\d+))?(\/.*)?$/.exec(source) ?? [];
    if (!scheme || `${scheme}:` !== target.protocol || host !== target.hostname) return false;
    if (port !== '*' && (port ?? '') !== target.port) return false;
    return path.endsWith('/') ? target.pathname.startsWith(path) : target.pathname === path;
  });
};

const inlineScripts = (html: string) => [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter((match) => !/\ssrc=/.test(match[1] ?? '') && !/type="application\/ld\+json"/.test(match[1] ?? ''));

const externalScripts = (html: string) => [...html.matchAll(/<script\s[^>]*src="([^"]+)"/g)].map((match) => match[1]);

test('the app and its static pages each get exactly one policy', () => {
  for (const path of ['/', '/index.html', '/assets/index-abc.js', '/assets/pyodideWorker-abc.js', '/api/download', '/updates/latest.json']) policyFor(path);
  for (const page of STATIC_PAGES) policyFor(page.replace(/^public/, ''));
  for (const path of ['/', '/tai-ung-dung.html', '/assets/a.js']) {
    assert.equal(headersFor(path, 'X-Content-Type-Options')[0], 'nosniff');
    assert.ok(headersFor(path, 'Referrer-Policy').length === 1);
  }
});

test('no policy allows wildcard, scheme-wide or inline script sources', () => {
  for (const path of ['/', ...STATIC_PAGES.map((page) => page.replace(/^public/, ''))]) {
    const policy = policyFor(path);
    for (const name of ['script-src', 'default-src']) {
      for (const source of policy[name] ?? []) {
        assert.ok(!source.includes('*'), `${path} ${name} ${source}`);
        assert.ok(!["'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:', 'data:', 'blob:'].includes(source), `${path} ${name} ${source}`);
      }
    }
    assert.deepEqual(policy['object-src'], ["'none'"]);
    assert.deepEqual(policy['frame-ancestors'], [path === '/' ? "'self'" : "'none'"], `${path} frame-ancestors`);
    assert.deepEqual(policy['base-uri'], ["'self'"]);
  }
});

test('the app policy admits every external origin the web build uses', () => {
  const policy = policyFor('/');
  assert.ok(allows(policy['script-src'], `${PYODIDE_INDEX_URL}pyodide.mjs`), 'Pyodide module');
  assert.ok(!allows(policy['script-src'], 'https://cdn.jsdelivr.net/gh/attacker/repo/p.js'), 'jsDelivr must stay path-scoped');
  assert.ok(allows(policy['script-src'], 'https://apis.google.com/js/api.js'), 'Firebase popup sign-in loader');
  assert.ok(policy['script-src'].includes("'wasm-unsafe-eval'"), 'Pyodide compiles WebAssembly');
  for (const url of [
    `${PYODIDE_INDEX_URL}pyodide-lock.json`,
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
    'https://securetoken.googleapis.com/v1/token',
    'https://api.anthropic.com/v1/messages',
    'https://api.openai.com/v1/chat/completions',
    'https://fonts.gstatic.com/s/roboto/v1/a.woff2',
  ]) assert.ok(allows(policy['connect-src'], url), `connect-src ${url}`);
  for (const sample of ['https://www.youtube.com/watch?v=xwnv4J66Ndc', 'https://youtu.be/xwnv4J66Ndc', 'https://vimeo.com/76979871']) {
    assert.ok(allows(policy['frame-src'], videoEmbedUrl(sample)!), `frame-src ${sample}`);
  }
  assert.ok(allows(policy['frame-src'], `${FIREBASE_AUTH_DOMAIN}/__/auth/iframe`), 'Firebase auth iframe');
  assert.ok(allows(policy['style-src'], 'https://fonts.googleapis.com/css2?family=Roboto'), 'Google Fonts stylesheet');
  assert.ok(allows(policy['font-src'], 'https://fonts.gstatic.com/s/roboto/v1/a.woff2'), 'Google Fonts files');
  assert.ok(allows(policy['img-src'], 'https://img.vietqr.io/image/a.png'), 'remote images');
  assert.ok(allows(policy['media-src'], 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'), 'sample slide video');
  assert.ok(policy['worker-src'].includes("'self'"));
  assert.ok(!allows(policy['form-action'], 'http://127.0.0.1:49152/callback'), 'no page may post to a loopback port');
});

test('static pages run no inline scripts, so the policy needs no line-ending dependent hashes', () => {
  const policy = policyFor('/tai-ung-dung.html');
  assert.deepEqual(policy['script-src'], ["'self'"]);
  const current = JSON.parse(read('src-tauri/tauri.conf.json')).version;
  const next = nextPatchVersion(current);
  for (const page of STATIC_PAGES) {
    const html = read(page);
    const file = VERSION_FILES.find((entry) => entry.path === page);
    const bumped = file ? bumpVersionText(html, file, current, next) : html;
    assert.equal(inlineScripts(html).length + inlineScripts(bumped).length, 0, `${page} has an inline script`);
    for (const src of externalScripts(html)) {
      assert.ok(src.startsWith('/') && !src.startsWith('//'), `${page} loads ${src} from another origin`);
      assert.ok(read(`public${src}`).length > 0, `${page} script ${src} is missing`);
    }
  }
});

test('hashed bundles are immutable while the entry document and update manifest revalidate', () => {
  assert.deepEqual(headersFor('/assets/index-D9WgCTSU.js', 'Cache-Control'), ['public, max-age=31536000, immutable']);
  for (const path of ['/', '/index.html', '/updates/latest.json']) assert.deepEqual(headersFor(path, 'Cache-Control'), ['no-cache'], path);
  assert.deepEqual(headersFor('/downloads/SHA256SUMS.txt', 'Cache-Control'), []);
});

test('only the app itself may frame the app, so document tabs load while other sites stay blocked', () => {
  for (const path of ['/', '/index.html']) {
    assert.deepEqual(policyFor(path)['frame-ancestors'], ["'self'"], path);
    assert.deepEqual(headersFor(path, 'X-Frame-Options'), ['SAMEORIGIN'], path);
  }
  for (const page of STATIC_PAGES) assert.deepEqual(policyFor(page.replace(/^public/, ''))['frame-ancestors'], ["'none'"], page);
  assert.ok(policyFor('/')['frame-src'].includes("'self'"), 'tabs load same-origin frames');
});
