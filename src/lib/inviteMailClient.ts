import { authConfigured, initializeAuthentication } from './auth';
import { isDesktop } from './desktop';

const API_URL = isDesktop() ? 'https://office.minhspark.com/api/invite-mail' : '/api/invite-mail';
const TIMEOUT_MS = 20_000;

export type InviteMailResult = { sent: string[]; skipped: string[] };

export class InviteMailError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export async function sendInviteMails(teamId: string, inviteIds: string[]): Promise<InviteMailResult> {
  if (!authConfigured) throw new InviteMailError('Chưa đăng nhập.', 'unauthenticated');
  const auth = await initializeAuthentication();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  if (!token) throw new InviteMailError('Hãy đăng nhập lại.', 'unauthenticated');
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, inviteIds }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new InviteMailError('Không kết nối được máy chủ gửi thư.', 'network');
  }
  const data = await response.json().catch(() => ({})) as Partial<InviteMailResult> & { error?: string; code?: string };
  if (!response.ok) throw new InviteMailError(data.error || 'Chưa gửi được thư mời.', data.code || `http-${response.status}`);
  return { sent: data.sent ?? [], skipped: data.skipped ?? [] };
}
