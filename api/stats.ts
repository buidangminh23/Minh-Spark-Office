import { incrementCounter, isBot, readStats, type Counter, type Stats } from './_shared/stats.js';

const CONFIG = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'minh-spark-office',
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  fetch,
};
const EVENTS: Record<string, Counter> = { user: 'users' };
const ALLOWED_ORIGINS = new Set(['https://office.minhspark.com', 'https://minh-spark-office.vercel.app', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : { Vary: 'Origin' };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

let lastGood: Stats | null = null;

export async function GET(request: Request) {
  const fresh = await readStats(CONFIG);
  const ok = Object.values(fresh).every((value) => value !== null);
  if (ok) lastGood = fresh;
  const stats = ok ? fresh : lastGood;
  return new Response(JSON.stringify(stats ?? fresh), {
    status: stats ? 200 : 503,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ok ? 'public, s-maxage=5, stale-while-revalidate=60' : 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const counter = EVENTS[new URL(request.url).searchParams.get('event') ?? ''];
  if (!counter) return new Response(null, { status: 400, headers: corsHeaders(request) });
  const saved = isBot(request.headers.get('user-agent')) ? false : await incrementCounter(CONFIG, counter);
  return new Response(null, { status: saved ? 204 : 202, headers: { ...corsHeaders(request), 'Cache-Control': 'no-store' } });
}
