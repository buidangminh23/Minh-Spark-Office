import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { headerRulesFor, type HeaderRule } from '../worker/headers.ts';

const rules = (JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { headers: HeaderRule[] }).headers;

function headersFor(pathname: string) {
  const result = new Map<string, string>();
  for (const rule of headerRulesFor(rules, pathname)) for (const { key, value } of rule.headers) result.set(key, value);
  return result;
}

test('headerRulesFor_appShell_getsAppCspAndNoCache', () => {
  const headers = headersFor('/');
  assert.match(headers.get('Content-Security-Policy') ?? '', /wasm-unsafe-eval/);
  assert.equal(headers.get('Cache-Control'), 'no-cache');
  assert.equal(headers.get('X-Frame-Options'), 'SAMEORIGIN');
});

test('headerRulesFor_layoutEngineScript_getsIsolationAndScriptCspOnly', () => {
  const headers = headersFor('/layout-engine/2.3.1/soffice.js');
  assert.equal(headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
  assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(headers.get('Content-Security-Policy'), "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src 'self'; connect-src 'self' blob:");
  assert.equal(headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});

test('headerRulesFor_seoPage_getsStrictCsp', () => {
  assert.match(headersFor('/gioi-thieu.html').get('Content-Security-Policy') ?? '', /frame-ancestors 'none'/);
});

test('headerRulesFor_firebaseAuthProxy_skipsAppCsp', () => {
  const headers = headersFor('/__/auth/handler');
  assert.equal(headers.has('Content-Security-Policy'), false);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
});

test('headerRulesFor_updateManifest_isNeverCached', () => {
  assert.equal(headersFor('/updates/latest.json').get('Cache-Control'), 'no-cache');
  assert.equal(headersFor('/ocr/vietocr/vietocr-encoder.onnx').get('Access-Control-Allow-Origin'), '*');
});
