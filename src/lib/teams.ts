export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TeamItemType = 'template' | 'document';
export type TeamItemKind = 'doc' | 'sheet' | 'slide';

export type Team = {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
};

export type TeamMember = {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: TeamRole;
  joinedAt: number;
};

export type TeamInvite = {
  id: string;
  teamId: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>;
  invitedBy: string;
  invitedByName: string;
  teamName: string;
  createdAt: number;
  expireAt: number;
};

export type TeamItem = {
  id: string;
  teamId: string;
  type: TeamItemType;
  name: string;
  kind: TeamItemKind;
  description: string;
  category: string;
  authorUid: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  updatedByName: string;
  revision: string;
  chunkCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  preview: string;
  size: number;
};

export type TeamMembership = { team: Team; role: TeamRole };

export type TeamAction =
  | 'view'
  | 'useTemplate'
  | 'publish'
  | 'editDocument'
  | 'manageOthersItems'
  | 'invite'
  | 'manageMembers'
  | 'editTeam'
  | 'deleteTeam'
  | 'transferOwnership';

export const ROLE_RANK: Record<TeamRole, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị viên',
  editor: 'Biên tập viên',
  viewer: 'Người xem',
};

export const ROLE_DESCRIPTION: Record<TeamRole, string> = {
  owner: 'Toàn quyền với nhóm, kể cả đổi tên, xoá nhóm và chuyển quyền sở hữu.',
  admin: 'Mời, đổi quyền và xoá thành viên cấp thấp hơn; quản lý mọi mẫu và tài liệu.',
  editor: 'Đăng mẫu, sửa tài liệu chung và mẫu do mình đăng.',
  viewer: 'Xem và dùng mẫu, đọc tài liệu chung.',
};

const MIN_RANK: Record<TeamAction, number> = {
  view: 1,
  useTemplate: 1,
  publish: 2,
  editDocument: 2,
  manageOthersItems: 3,
  invite: 3,
  manageMembers: 3,
  editTeam: 4,
  deleteTeam: 4,
  transferOwnership: 4,
};

export const TEAM_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#475569'] as const;

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TEAM_ITEM_MAX_COMPRESSED = 60 * 450000;
export const TEAM_ITEM_MAX_UNCOMPRESSED = 128 * 1024 * 1024;
export const TEAM_ITEM_KINDS: TeamItemKind[] = ['doc', 'sheet', 'slide'];

export function isTeamRole(value: unknown): value is TeamRole {
  return value === 'owner' || value === 'admin' || value === 'editor' || value === 'viewer';
}

export function can(role: TeamRole | null | undefined, action: TeamAction) {
  return Boolean(role) && ROLE_RANK[role as TeamRole] >= MIN_RANK[action];
}

export function canEditItem(role: TeamRole | null | undefined, item: Pick<TeamItem, 'type' | 'authorUid'>, uid: string | null | undefined) {
  if (!role || !uid || !can(role, 'publish')) return false;
  if (item.type === 'document') return true;
  return item.authorUid === uid || can(role, 'manageOthersItems');
}

export function canDeleteItem(role: TeamRole | null | undefined, item: Pick<TeamItem, 'authorUid'>, uid: string | null | undefined) {
  if (!role || !uid) return false;
  if (can(role, 'manageOthersItems')) return true;
  return can(role, 'publish') && item.authorUid === uid;
}

export function canManageMember(actor: TeamRole | null | undefined, target: TeamRole) {
  if (!actor || !can(actor, 'manageMembers')) return false;
  return ROLE_RANK[target] < ROLE_RANK[actor];
}

export function assignableRoles(actor: TeamRole | null | undefined): Array<Exclude<TeamRole, 'owner'>> {
  if (!actor || !can(actor, 'invite')) return [];
  return (['admin', 'editor', 'viewer'] as const).filter((role) => ROLE_RANK[role] < ROLE_RANK[actor]);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  return email.length >= 3 && email.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
}

export function parseEmailList(value: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of value.split(/[\s,;]+/)) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    (isValidEmail(email) ? valid : invalid).push(email);
  }
  return { valid, invalid };
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function randomId(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ID_ALPHABET[byte & 63]).join('');
}

export const INVITE_PARAM = 'invite';

export function inviteToken(teamId: string, inviteId: string) {
  return `${teamId}.${inviteId}`;
}

export function inviteLink(origin: string, teamId: string, inviteId: string) {
  const url = new URL('/', origin);
  url.searchParams.set(INVITE_PARAM, inviteToken(teamId, inviteId));
  return url.toString();
}

export function parseInviteToken(value: string | null | undefined) {
  const match = /^([A-Za-z0-9_-]{20})\.([A-Za-z0-9_-]{24})$/.exec(value?.trim() ?? '');
  return match ? { teamId: match[1], inviteId: match[2] } : null;
}

export function inviteSubject(teamName: string) {
  return `Lời mời tham gia nhóm "${teamName}" trên Minh Spark Office`;
}

export function inviteBody(input: { teamName: string; inviterName: string; role: TeamRole; link: string; expireAt: number }) {
  const expires = new Date(input.expireAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return [
    'Xin chào,',
    '',
    `${input.inviterName || 'Một thành viên'} mời bạn tham gia nhóm "${input.teamName}" trên Minh Spark Office với vai trò ${ROLE_LABEL[input.role]}.`,
    'Trong nhóm, mọi người chia sẻ mẫu tài liệu, bảng tính, bài thuyết trình và cùng chỉnh sửa tài liệu chung.',
    '',
    'Mở liên kết sau và đăng nhập Google bằng chính địa chỉ email nhận thư này để tham gia:',
    input.link,
    '',
    `Lời mời có hiệu lực đến ngày ${expires}.`,
  ].join('\n');
}

export function inviteGroupBody(input: { teamName: string; inviterName: string; role: TeamRole; entries: Array<{ email: string; link: string }>; expireAt: number }) {
  const expires = new Date(input.expireAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return [
    'Xin chào mọi người,',
    '',
    `${input.inviterName || 'Một thành viên'} mời mọi người tham gia nhóm "${input.teamName}" trên Minh Spark Office với vai trò ${ROLE_LABEL[input.role]}.`,
    'Trong nhóm, mọi người chia sẻ mẫu tài liệu, bảng tính, bài thuyết trình và cùng chỉnh sửa tài liệu chung.',
    '',
    'Mỗi người mở đúng liên kết ghi email của mình và đăng nhập Google bằng chính email đó (liên kết của người khác sẽ không dùng được):',
    '',
    ...input.entries.map((entry) => `${entry.email}: ${entry.link}`),
    '',
    `Lời mời có hiệu lực đến ngày ${expires}.`,
  ].join('\n');
}

export function gmailComposeUrl(to: string, subject: string, body: string) {
  const url = new URL('https://mail.google.com/mail/');
  url.searchParams.set('view', 'cm');
  url.searchParams.set('fs', '1');
  url.searchParams.set('to', to);
  url.searchParams.set('su', subject);
  url.searchParams.set('body', body);
  return url.toString();
}

export function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function initials(name: string, fallback = '?') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function colorForUid(uid: string) {
  let hash = 0;
  for (let index = 0; index < uid.length; index++) hash = (hash * 31 + uid.charCodeAt(index)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

export function inviteExpired(invite: Pick<TeamInvite, 'expireAt'>, now = Date.now()) {
  return invite.expireAt <= now;
}

export function sortMembers(members: TeamMember[]) {
  return [...members].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || (a.name || a.email).localeCompare(b.name || b.email, 'vi'));
}
