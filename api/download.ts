import { incrementCounter, installerCounter, isBot } from './_shared/stats.js';

const CONFIG = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'minh-spark-office',
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  fetch,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get('file');
  const counter = installerCounter(file);
  if (!counter || !file) return new Response('Không tìm thấy bộ cài.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (!isBot(request.headers.get('user-agent'))) await incrementCounter(CONFIG, counter);
  return new Response(null, { status: 302, headers: { Location: `/downloads/${file}`, 'Cache-Control': 'no-store' } });
}
