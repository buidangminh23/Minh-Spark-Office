import { createRemoteJWKSet, jwtVerify } from 'jose';
import { buildInviteMail, inviteSendable, parseSendRequest, toInviteRecord, type FirestoreDocument, type InviteRecord } from './_shared/inviteMail.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'minh-spark-office';
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim();
const MAIL_FROM = (process.env.INVITE_MAIL_FROM ?? '').trim() || 'Office 23 <office@minhspark.com>';
const MAX_BODY_BYTES = 8_000;
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ALLOWED_ORIGINS = new Set(['https://office.minhspark.com', 'https://minh-spark-office.vercel.app', 'https://minhsparkoffice.minhspark.com', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']);

type Caller = { uid: string; token: string; name: string; email: string };

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : { Vary: 'Origin' };
}

function reply(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function verifyCaller(request: Request): Promise<Caller | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, GOOGLE_KEYS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub, token, name: typeof payload.name === 'string' ? payload.name : '', email: payload.email_verified === true && typeof payload.email === 'string' ? payload.email : '' };
  } catch {
    return null;
  }
}

async function loadInvite(caller: Caller, teamId: string, inviteId: string): Promise<InviteRecord | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams/${teamId}/invites/${inviteId}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${caller.token}` } });
  if (!response.ok) return null;
  return toInviteRecord(teamId, inviteId, await response.json() as FirestoreDocument);
}

async function sendBatch(invites: InviteRecord[], caller: Caller) {
  const messages = invites.map((invite) => {
    const mail = buildInviteMail(invite, caller.name);
    return { from: MAIL_FROM, to: [invite.email], subject: mail.subject, html: mail.html, text: mail.text, ...(caller.email ? { reply_to: caller.email } : {}) };
  });
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export async function POST(request: Request) {
  if (!RESEND_API_KEY) return reply(request, 503, { error: 'Máy chủ chưa bật gửi thư.', code: 'mail-disabled' });
  const caller = await verifyCaller(request);
  if (!caller) return reply(request, 401, { error: 'Hãy đăng nhập lại.', code: 'unauthenticated' });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply(request, 413, { error: 'Yêu cầu quá lớn.', code: 'too-large' });
  let parsed: ReturnType<typeof parseSendRequest> = null;
  try { parsed = parseSendRequest(JSON.parse(raw)); } catch { parsed = null; }
  if (!parsed) return reply(request, 400, { error: 'Yêu cầu không hợp lệ.', code: 'bad-request' });
  const now = Date.now();
  const loaded = await Promise.all(parsed.inviteIds.map((id) => loadInvite(caller, parsed.teamId, id).catch(() => null)));
  const sendable = loaded.filter((invite): invite is InviteRecord => Boolean(invite && inviteSendable(invite, caller.uid, now)));
  const skipped = parsed.inviteIds.filter((id) => !sendable.some((invite) => invite.id === id));
  if (!sendable.length) return reply(request, 403, { error: 'Không có lời mời nào của bạn còn hiệu lực để gửi.', code: 'not-allowed', skipped });
  try {
    await sendBatch(sendable, caller);
  } catch (error) {
    console.error('invite-mail: send failed', error instanceof Error ? error.message : error);
    return reply(request, 502, { error: 'Dịch vụ gửi thư đang lỗi.', code: 'send-failed' });
  }
  return reply(request, 200, { sent: sendable.map((invite) => invite.id), skipped });
}
