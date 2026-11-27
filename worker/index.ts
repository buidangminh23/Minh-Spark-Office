import * as ai from '../api/ai.js';
import * as download from '../api/download.js';
import * as inviteMail from '../api/invite-mail.js';
import * as market from '../api/market.js';
import * as stats from '../api/stats.js';
import site from '../vercel.json' with { type: 'json' };
import { headerRulesFor, type HeaderRule } from './headers.js';

interface R2Range { offset?: number; length?: number; suffix?: number }
interface R2Object {
  body?: ReadableStream;
  size: number;
  httpEtag: string;
  range?: R2Range;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  get(key: string, options?: { range?: Headers; onlyIf?: Headers }): Promise<R2Object | null>;
  head(key: string): Promise<R2Object | null>;
}
interface Fetcher { fetch(request: Request): Promise<Response> }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void }
interface Env { ASSETS: Fetcher; LARGE_FILES: R2Bucket }

type Handler = (request: Request) => Response | Promise<Response>;
type Module = Partial<Record<'GET' | 'POST' | 'OPTIONS', Handler>>;

const API: Record<string, Module> = {
  '/api/ai': ai,
  '/api/download': download,
  '/api/invite-mail': inviteMail,
  '/api/market': market,
  '/api/stats': stats,
};
const FIREBASE_ORIGIN = 'https://minh-spark-office.firebaseapp.com';
const FIREBASE_PREFIXES = ['/__/auth/', '/__/firebase/'];
const DEFAULT_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const RULES: HeaderRule[] = site.headers;
const TEXT_TYPE = /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg\+xml)/i;

async function callApi(request: Request, module: Module, context: ExecutionContext) {
  const method = request.method === 'HEAD' ? 'GET' : request.method;
  const handler = module[method as keyof Module];
  if (!handler) return new Response('Method Not Allowed', { status: 405, headers: { Allow: Object.keys(module).join(', ') } });
  const cache = method === 'GET' ? (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default : undefined;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return cached;
  const response = await handler(request);
  const sharedAge = /s-maxage=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
  if (cache && sharedAge && response.status === 200 && !response.headers.get('vary')?.toLowerCase().includes('origin')) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set('Cache-Control', `public, max-age=${sharedAge}`);
    context.waitUntil(cache.put(cacheKey, stored));
  }
  return response;
}

async function proxyFirebase(request: Request, url: URL) {
  const target = new URL(url.pathname + url.search, FIREBASE_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete('host');
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
  return new Response(response.body, response);
}

async function serveLargeFile(request: Request, url: URL, env: Env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const key = decodeURIComponent(url.pathname.slice(1));
  if (!key || key.includes('..')) return null;
  const object = request.method === 'HEAD'
    ? await env.LARGE_FILES.head(key)
    : await env.LARGE_FILES.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', DEFAULT_CACHE_CONTROL);
  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { headers });
  }
  if (!object.body) return new Response(null, { status: 304, headers });
  const range = object.range;
  if (range && request.headers.has('range')) {
    const start = range.offset ?? (range.suffix !== undefined ? object.size - range.suffix : 0);
    const length = range.length ?? object.size - start;
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}

function withSiteHeaders(response: Response, pathname: string) {
  const rules = headerRulesFor(RULES, pathname);
  if (!rules.length) return response;
  const result = new Response(response.body, response);
  for (const rule of rules) for (const { key, value } of rule.headers) result.headers.set(key, value);
  return result;
}

async function route(request: Request, env: Env, context: ExecutionContext) {
  const url = new URL(request.url);
  const api = API[url.pathname.replace(/\/$/, '')];
  if (api) return callApi(request, api, context);
  if (FIREBASE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return proxyFirebase(request, url);
  const assetUrl = url.pathname.endsWith('/') ? new URL(`${url.pathname}index.html${url.search}`, url) : url;
  const asset = await env.ASSETS.fetch(assetUrl === url ? request : new Request(assetUrl, request));
  const file = asset.status === 404 ? await serveLargeFile(request, url, env) : null;
  return staticResponse(file ?? asset);
}

function staticResponse(response: Response) {
  if (response.status === 404) {
    return new Response('The page could not be found\n\nNOT_FOUND\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': DEFAULT_CACHE_CONTROL } });
  }
  const result = new Response(response.body, response);
  result.headers.set('Access-Control-Allow-Origin', '*');
  const type = result.headers.get('content-type');
  if (type && !/charset=/i.test(type) && TEXT_TYPE.test(type)) result.headers.set('Content-Type', `${type}; charset=utf-8`);
  return result;
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const response = await route(request, env, context);
    return withSiteHeaders(response, new URL(request.url).pathname);
  },
};
