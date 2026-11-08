import { collectMarket, normalizeSymbols } from './_shared/market.js';

const ALLOWED_ORIGINS = new Set(['https://office.minhspark.com', 'https://minh-spark-office.vercel.app', 'https://minhsparkoffice.minhspark.com', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' } : { Vary: 'Origin' };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const symbols = normalizeSymbols(new URL(request.url).searchParams.get('stocks'));
  const snapshot = await collectMarket(fetch, symbols);
  const status = snapshot.quotes.length ? 200 : 502;
  return new Response(JSON.stringify(snapshot), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, s-maxage=60, stale-while-revalidate=120' : 'no-store',
    },
  });
}
