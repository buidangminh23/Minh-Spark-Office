export const INVITE_ORIGIN = 'https://office.minhspark.com';
export const MAX_INVITES_PER_REQUEST = 20;
export const SEND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', editor: 'Biên tập viên', viewer: 'Thành viên' };
const TEAM_ID = /^[A-Za-z0-9_-]{20}$/;
const INVITE_ID = /^[A-Za-z0-9_-]{24}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export type InviteRecord = { id: string; teamId: string; email: string; role: string; invitedBy: string; invitedByName: string; teamName: string; createdAt: number; expireAt: number };

type FirestoreValue = { stringValue?: string; timestampValue?: string };
export type FirestoreDocument = { fields?: Record<string, FirestoreValue> };

export function parseSendRequest(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const { teamId, inviteIds } = body as { teamId?: unknown; inviteIds?: unknown };
  if (typeof teamId !== 'string' || !TEAM_ID.test(teamId) || !Array.isArray(inviteIds)) return null;
  const ids = [...new Set(inviteIds)];
  if (!ids.length || ids.length > MAX_INVITES_PER_REQUEST || !ids.every((id) => typeof id === 'string' && INVITE_ID.test(id))) return null;
  return { teamId, inviteIds: ids as string[] };
}

export function toInviteRecord(teamId: string, id: string, document: FirestoreDocument): InviteRecord | null {
  const fields = document.fields ?? {};
  const text = (key: string) => fields[key]?.stringValue ?? '';
  const time = (key: string) => { const value = Date.parse(fields[key]?.timestampValue ?? ''); return Number.isFinite(value) ? value : 0; };
  const record = { id, teamId, email: text('email'), role: text('role'), invitedBy: text('invitedBy'), invitedByName: text('invitedByName'), teamName: text('teamName'), createdAt: time('createdAt'), expireAt: time('expireAt') };
  if (!EMAIL.test(record.email) || !ROLE_LABEL[record.role] || !record.invitedBy || !record.teamName || !record.expireAt) return null;
  return record;
}

export function inviteSendable(invite: InviteRecord, uid: string, now: number) {
  return invite.invitedBy === uid && invite.expireAt > now && (!invite.createdAt || now - invite.createdAt <= SEND_WINDOW_MS);
}

export function inviteUrl(invite: Pick<InviteRecord, 'teamId' | 'id'>) {
  const url = new URL('/', INVITE_ORIGIN);
  url.searchParams.set('invite', `${invite.teamId}.${invite.id}`);
  return url.toString();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export function buildInviteMail(invite: InviteRecord, inviterName: string) {
  const inviter = (inviterName || invite.invitedByName || 'Một thành viên').slice(0, 120);
  const team = invite.teamName.slice(0, 120);
  const role = ROLE_LABEL[invite.role];
  const link = inviteUrl(invite);
  const expires = new Date(invite.expireAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
  const subject = `${inviter} mời bạn vào nhóm "${team}" trên Office 23`;
  const text = [
    'Xin chào,',
    '',
    `${inviter} mời bạn tham gia nhóm "${team}" trên Office 23 với vai trò ${role}.`,
    'Trong nhóm, mọi người tải mẫu về máy để dùng riêng và cùng sửa các tài liệu chung theo thời gian thực.',
    '',
    'Mở liên kết sau và đăng nhập Google bằng chính địa chỉ email nhận thư này để tham gia:',
    link,
    '',
    `Lời mời có hiệu lực đến ngày ${expires}.`,
  ].join('\n');
  const html = `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#f7f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e6ee;border-radius:12px">
<tr><td style="padding:32px">
<p style="margin:0 0 16px;font-size:15px;line-height:24px">Xin chào,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:24px"><strong>${escapeHtml(inviter)}</strong> mời bạn tham gia nhóm <strong>${escapeHtml(team)}</strong> trên Office 23 với vai trò ${escapeHtml(role)}.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:24px">Trong nhóm, mọi người tải mẫu về máy để dùng riêng và cùng sửa các tài liệu chung theo thời gian thực.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#2b579a;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Tham gia nhóm</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#677085">Đăng nhập Google bằng chính địa chỉ email nhận thư này. Lời mời có hiệu lực đến ngày ${escapeHtml(expires)}.</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#677085;word-break:break-all">${escapeHtml(link)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
