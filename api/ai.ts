import { createRemoteJWKSet, jwtVerify } from 'jose';
import { quotaDay, validateRequest, type AddinProvider } from './_shared/addin.js';
import { AddinProviderError, runProvider } from './_shared/run.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'minh-spark-office';
const DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 30);
const MAX_BODY_BYTES = 4_000_000;
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ALLOWED_ORIGINS = new Set(['https://office.minhspark.com', 'https://minh-spark-office.vercel.app', 'https://minhsparkoffice.minhspark.com', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']);
const PROVIDER_KEY: Record<AddinProvider, string | undefined> = { claude: process.env.ANTHROPIC_API_KEY, chatgpt: process.env.OPENAI_API_KEY };

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Expose-Headers': 'X-Addin-Remaining', Vary: 'Origin' } : { Vary: 'Origin' };
}

function fail(request: Request, status: number, error: string, code?: string) {
  return new Response(JSON.stringify({ error, code }), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function verifyUser(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, GOOGLE_KEYS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
    return typeof payload.sub === 'string' && payload.sub ? { uid: payload.sub, token } : null;
  } catch {
    return null;
  }
}

type QuotaResult = { ok: true; remaining: number } | { ok: false; status: number; error: string; code: string };

async function consumeQuota(uid: string, token: string): Promise<QuotaResult> {
  const documentUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/aiUsage/${encodeURIComponent(uid)}`;
  const headers = { Authorization: `Bearer ${token}` };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const day = quotaDay(Date.now());
    const current = await fetch(documentUrl, { headers });
    let count = 1;
    let precondition = 'currentDocument.exists=false';
    if (current.ok) {
      const document = await current.json() as { updateTime: string; fields?: { day?: { integerValue?: string }; count?: { integerValue?: string } } };
      const storedDay = Number(document.fields?.day?.integerValue);
      const storedCount = Number(document.fields?.count?.integerValue);
      if (storedDay === day) {
        if (storedCount >= DAILY_LIMIT) return { ok: false, status: 429, error: `Đã dùng hết ${DAILY_LIMIT} lượt miễn phí hôm nay. Nhập API key riêng trong Cài đặt add-in để dùng tiếp, hoặc quay lại vào ngày mai.`, code: 'quota' };
        count = storedCount + 1;
      }
      precondition = `currentDocument.updateTime=${encodeURIComponent(document.updateTime)}`;
    } else if (current.status !== 404) {
      return { ok: false, status: 503, error: 'Chưa kiểm tra được hạn mức sử dụng. Thử lại sau ít phút.', code: 'quota-unavailable' };
    }
    const written = await fetch(`${documentUrl}?${precondition}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { day: { integerValue: String(day) }, count: { integerValue: String(count) } } }),
    });
    if (written.ok) return { ok: true, remaining: DAILY_LIMIT - count };
    if (written.status !== 400 && written.status !== 409) break;
  }
  return { ok: false, status: 503, error: 'Chưa ghi được hạn mức sử dụng. Thử lại sau ít phút.', code: 'quota-unavailable' };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const user = await verifyUser(request);
  if (!user) return fail(request, 401, 'Hãy đăng nhập Google để dùng add-in bằng hạn mức của Office 23.', 'auth');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(request, 413, 'Nội dung gửi đi quá lớn cho chế độ dùng chung. Nhập API key riêng để gửi tài liệu lớn.', 'too-large');
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(request, 413, 'Nội dung gửi đi quá lớn cho chế độ dùng chung. Nhập API key riêng để gửi tài liệu lớn.', 'too-large');
    body = JSON.parse(raw);
  } catch {
    return fail(request, 400, 'Yêu cầu không hợp lệ.', 'bad-request');
  }
  const validation = validateRequest(body);
  if (!validation.ok) return fail(request, 400, validation.error, 'bad-request');
  const apiKey = PROVIDER_KEY[validation.request.provider];
  if (!apiKey) return fail(request, 503, `${validation.request.provider === 'claude' ? 'Claude' : 'ChatGPT'} chưa được bật trên máy chủ. Nhập API key riêng trong Cài đặt add-in để dùng ngay.`, 'not-configured');
  const quota = await consumeQuota(user.uid, user.token);
  if (!quota.ok) return fail(request, quota.status, quota.error, quota.code);

  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener('abort', () => controller.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(sink) {
      try {
        await runProvider(validation.request, apiKey, (chunk) => sink.enqueue(encoder.encode(chunk)), controller.signal);
      } catch (error) {
        const message = error instanceof AddinProviderError ? error.message : 'Không trả lời được. Thử lại sau.';
        sink.enqueue(encoder.encode(`\u0000ERROR:${message}`));
      } finally {
        sink.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders(request), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Addin-Remaining': String(quota.remaining) } });
}
