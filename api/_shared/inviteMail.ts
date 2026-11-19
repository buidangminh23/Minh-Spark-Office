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

const MAIL_APPS = [
  { icon: 'docs', name: '23 Docs' },
  { icon: 'sheets', name: '23 Sheets' },
  { icon: 'slides', name: '23 Slides' },
  { icon: 'pdf', name: '23 PDF' },
  { icon: 'photos', name: '23 Photos' },
];

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
  const asset = (name: string) => `${INVITE_ORIGIN}/mail/${name}.png`;
  const apps = MAIL_APPS.map((app) => `<td align="center" valign="top" width="20%" style="padding:0 4px"><img src="${asset(app.icon)}" width="48" height="48" alt="" style="display:block;margin:0 auto 8px;border:0;outline:none"><span style="font-size:12px;line-height:16px;color:#3d4556;white-space:nowrap">${app.name}</span></td>`).join('');
  const initial = escapeHtml(inviter.trim().charAt(0).toUpperCase() || 'O');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1f7;font-family:'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:#1f2430">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(inviter)} mời bạn vào nhóm ${escapeHtml(team)} để cùng sửa tài liệu theo thời gian thực.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 24px"><a href="${INVITE_ORIGIN}" style="text-decoration:none"><img src="${asset('logo-full')}" width="159" height="64" alt="Office 23" style="display:block;border:0;outline:none"></a></td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid #dfe3ec;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:6px;border-radius:16px 16px 0 0;background:#2b579a;background-image:linear-gradient(90deg,#2b579a 0%,#217346 33%,#d24726 66%,#b7472a 100%);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 8px" align="center">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:28px;background:#e8eefb;color:#2b579a;font-size:24px;font-weight:700;text-align:center">${initial}</td></tr></table>
<p style="margin:16px 0 4px;font-size:14px;line-height:20px;color:#5b6477"><strong style="color:#1f2430">${escapeHtml(inviter)}</strong> đã mời bạn vào nhóm</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:34px;font-weight:700;color:#1f2430">${escapeHtml(team)}</h1>
<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef3fc;color:#2b579a;font-size:13px;line-height:18px;font-weight:600">Vai trò: ${escapeHtml(role)}</span>
</td></tr>
<tr><td style="padding:24px 40px 8px" align="center">
<p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#3d4556">Cùng cả nhóm soạn văn bản, bảng tính và bài thuyết trình: tài liệu chung sửa được cùng lúc theo thời gian thực, mẫu chung tải về máy để dùng riêng.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:10px;background:#2b579a"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 32px;border-radius:10px;background:#2b579a;color:#ffffff;font-size:16px;line-height:20px;font-weight:700;text-decoration:none">Tham gia nhóm</a></td></tr></table>
</td></tr>
<tr><td style="padding:32px 32px 8px">
<p style="margin:0 0 16px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#8a92a5;text-align:center">Làm việc cùng nhau trên</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${apps}</tr></table>
</td></tr>
<tr><td style="padding:24px 40px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border-radius:10px"><tr><td style="padding:16px 20px">
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#5b6477">Đăng nhập Google bằng chính địa chỉ <strong style="color:#1f2430">${escapeHtml(invite.email)}</strong>. Lời mời có hiệu lực đến ngày <strong style="color:#1f2430">${escapeHtml(expires)}</strong>.</p>
<p style="margin:0;font-size:12px;line-height:18px;color:#8a92a5;word-break:break-all">Nút không bấm được? Mở liên kết này: <a href="${escapeHtml(link)}" style="color:#2b579a">${escapeHtml(link)}</a></p>
</td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:18px;color:#8a92a5">Bạn nhận thư này vì ${escapeHtml(inviter)} đã nhập địa chỉ email của bạn trên Office 23.<br>Nếu không biết người gửi, bạn có thể bỏ qua thư này.<br><a href="${INVITE_ORIGIN}" style="color:#8a92a5">office.minhspark.com</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
