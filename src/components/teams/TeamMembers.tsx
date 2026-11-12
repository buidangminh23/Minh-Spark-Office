import { useRef, useState } from 'react';
import { Check, Link2, Mail, MailPlus, Plus, Send, Trash2, UserMinus, X } from 'lucide-react';
import { useUi } from '../ui';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import {
  assignableRoles,
  can,
  canManageMember,
  gmailComposeUrl,
  inviteBody,
  inviteGroupBody,
  inviteExpired,
  inviteLink,
  inviteSubject,
  mailtoUrl,
  parseEmailList,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  sortMembers,
  type Team,
  type TeamInvite,
  type TeamMember,
  type TeamRole,
} from '../../lib/teams';
import { formatDate, PersonAvatar, RoleBadge, TmButton, TmField } from './TeamParts';

const ROLES: TeamRole[] = ['owner', 'admin', 'editor', 'viewer'];
const MATRIX: Array<{ label: string; roles: TeamRole[] }> = [
  { label: 'Xem và dùng mẫu, đọc tài liệu chung', roles: ['owner', 'admin', 'editor', 'viewer'] },
  { label: 'Đăng mẫu, sửa chung tài liệu', roles: ['owner', 'admin', 'editor'] },
  { label: 'Sửa, xoá mẫu của người khác', roles: ['owner', 'admin'] },
  { label: 'Mời, đổi quyền, xoá thành viên cấp dưới', roles: ['owner', 'admin'] },
  { label: 'Đổi tên, xoá nhóm, chuyển quyền sở hữu', roles: ['owner'] },
];

function openCompose(url: string) {
  window.open(url, '_blank', 'noopener');
}

const MAX_BATCH = 20;

function groupCompose(made: TeamInvite[], inviterName: string) {
  const first = made[0];
  if (made.length === 1) return gmailComposeUrl(first.email, inviteSubject(first.teamName), inviteMail(first, inviterName).body);
  const entries = made.map((invite) => ({ email: invite.email, link: inviteLink(window.location.origin, invite.teamId, invite.id) }));
  const expireAt = Math.min(...made.map((invite) => invite.expireAt));
  const body = inviteGroupBody({ teamName: first.teamName, inviterName, role: first.role, entries, expireAt });
  return gmailComposeUrl(made.map((invite) => invite.email).join(','), inviteSubject(first.teamName), body);
}

function inviteMail(invite: TeamInvite, inviterName: string) {
  const link = inviteLink(window.location.origin, invite.teamId, invite.id);
  const subject = inviteSubject(invite.teamName);
  const body = inviteBody({ teamName: invite.teamName, inviterName, role: invite.role, link, expireAt: invite.expireAt });
  return { link, subject, body };
}

function InviteActions({ invite, inviterName, compact }: { invite: TeamInvite; inviterName: string; compact?: boolean }) {
  const ui = useUi();
  const [copied, setCopied] = useState(false);
  const mail = inviteMail(invite, inviterName);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mail.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { ui.toast('Không sao chép được. Hãy chọn và sao chép liên kết thủ công.', true); }
  };
  return (
    <div className="tm-invite-actions">
      <TmButton variant={compact ? 'ghost' : 'primary'} icon={<Send size={16} aria-hidden="true" />} onClick={() => openCompose(gmailComposeUrl(invite.email, mail.subject, mail.body))}>{compact ? 'Gmail' : 'Gửi qua Gmail'}</TmButton>
      {!compact && <TmButton icon={<Mail size={16} aria-hidden="true" />} onClick={() => { window.location.href = mailtoUrl(invite.email, mail.subject, mail.body); }}>Ứng dụng email</TmButton>}
      <TmButton variant={compact ? 'ghost' : 'default'} icon={copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />} onClick={() => void copy()}>{copied ? 'Đã sao chép' : compact ? 'Liên kết' : 'Sao chép liên kết'}</TmButton>
    </div>
  );
}

function InvitePanel({ store, team, role, members, invites }: { store: TeamStore; team: Team; role: TeamRole; members: TeamMember[]; invites: TeamInvite[] }) {
  const ui = useUi();
  const roles = assignableRoles(role);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<Exclude<TeamRole, 'owner'>>(roles.includes('editor') ? 'editor' : roles[0] ?? 'viewer');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<TeamInvite[]>([]);
  const [note, setNote] = useState('');

  const add = (value = draft) => {
    const { valid, invalid } = parseEmailList(value);
    const memberEmails = new Set(members.map((member) => member.email.toLowerCase()));
    const pending = new Set(invites.filter((invite) => !inviteExpired(invite)).map((invite) => invite.email));
    const queued = new Set(queue);
    const fresh = valid.filter((email) => !memberEmails.has(email) && !pending.has(email) && !queued.has(email));
    const room = Math.max(0, MAX_BATCH - queue.length);
    const problems = [
      invalid.length ? `email không hợp lệ: ${invalid.slice(0, 3).join(', ')}` : '',
      valid.some((email) => memberEmails.has(email)) ? 'đã là thành viên' : '',
      valid.some((email) => pending.has(email)) ? 'đang có lời mời chờ' : '',
      valid.some((email) => queued.has(email)) ? 'đã có trong danh sách' : '',
      fresh.length > room ? `mỗi lần gửi tối đa ${MAX_BATCH} người` : '',
    ].filter(Boolean);
    if (fresh.length && room) setQueue((current) => [...current, ...fresh.slice(0, room)]);
    setNote(problems.length ? `Chưa thêm một số email: ${problems.join('; ')}.` : '');
    setDraft(invalid.length ? invalid.join(', ') : '');
    draftRef.current?.focus();
  };

  const send = async () => {
    if (!queue.length) return;
    setBusy(true);
    setNote('');
    const made: TeamInvite[] = [];
    try {
      for (const email of queue) made.push(await store.createInvite(team, email, inviteRole));
      setQueue([]);
      openCompose(groupCompose(made, store.user.name));
    } catch (failure) {
      setQueue((current) => current.filter((email) => !made.some((invite) => invite.email === email)));
      ui.toast(teamErrorMessage(failure), true);
    } finally {
      setCreated((current) => [...made, ...current].slice(0, MAX_BATCH));
      setBusy(false);
    }
  };

  return (
    <section className="tm-card tm-invite-panel" aria-labelledby="tm-invite-title">
      <div className="tm-card-head">
        <span className="tm-card-icon" aria-hidden="true"><MailPlus size={20} /></span>
        <div>
          <h2 id="tm-invite-title">Mời thành viên</h2>
          <p>Người được mời phải đăng nhập Google bằng đúng email này. Lời mời hết hạn sau 7 ngày.</p>
        </div>
      </div>
      <div className="tm-invite-form">
        <TmField label="Email người được mời" hint="Nhập từng email rồi bấm + hoặc Enter để thêm người tiếp theo.">
          <span className="tm-input-group">
            <input
              ref={draftRef}
              className="tm-input"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={draft}
              placeholder="ten@congty.vn"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text');
                if (!/[\s,;]/.test(text.trim())) return;
                event.preventDefault();
                add(text);
              }}
            />
            <button type="button" className="tm-input-add" aria-label="Thêm email vào danh sách mời" title="Thêm vào danh sách" disabled={!draft.trim()} onClick={() => add()}><Plus size={18} aria-hidden="true" /></button>
          </span>
        </TmField>
        <TmField label="Vai trò" hint={ROLE_DESCRIPTION[inviteRole]}>
          <select className="tm-input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<TeamRole, 'owner'>)}>
            {roles.map((value) => <option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
          </select>
        </TmField>
        <TmButton variant="primary" className="tm-invite-submit" icon={<Send size={16} aria-hidden="true" />} disabled={busy || !queue.length} onClick={() => void send()}>{busy ? 'Đang gửi…' : queue.length ? `Gửi lời mời (${queue.length})` : 'Gửi lời mời'}</TmButton>
      </div>
      {queue.length > 0 && (
        <ul className="tm-invite-queue" aria-label="Danh sách sẽ mời">
          {queue.map((email) => (
            <li key={email} className="tm-chip tm-email-chip">
              <span>{email}</span>
              <button type="button" aria-label={`Bỏ ${email} khỏi danh sách`} onClick={() => setQueue((current) => current.filter((item) => item !== email))}><X size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="tm-note" role="status">{note}</p>}
      {created.length > 0 && (
        <div className="tm-created">
          <div className="tm-created-head">
            <h3>Đã tạo {created.length} lời mời</h3>
            <TmButton icon={<Send size={16} aria-hidden="true" />} onClick={() => openCompose(groupCompose(created, store.user.name))}>Mở lại thư gửi chung</TmButton>
          </div>
          <ul>
            {created.map((invite) => (
              <li key={invite.id}>
                <span className="tm-created-who"><strong>{invite.email}</strong><RoleBadge role={invite.role} /></span>
                <InviteActions invite={invite} inviterName={store.user.name} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TeamMembers({ store, team, role, members, invites, loading }: { store: TeamStore; team: Team; role: TeamRole; members: TeamMember[]; invites: TeamInvite[]; loading: boolean }) {
  const ui = useUi();
  const uid = store.user.uid;
  const canInvite = can(role, 'invite');

  const changeRole = async (member: TeamMember, next: Exclude<TeamRole, 'owner'>) => {
    try {
      await store.changeRole(team.id, member, next);
      ui.toast(`${member.name || member.email} giờ là ${ROLE_LABEL[next]}.`);
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  const remove = async (member: TeamMember) => {
    if (!(await ui.confirm(`Xoá ${member.name || member.email} khỏi nhóm?`, 'Người này sẽ mất quyền xem mẫu và tài liệu chung của nhóm ngay lập tức.', true))) return;
    try {
      await store.removeMember(team.id, member.uid);
      ui.toast('Đã xoá thành viên.');
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  const revoke = async (invite: TeamInvite) => {
    try {
      await store.deleteInvite(team.id, invite.id);
      ui.toast(`Đã thu hồi lời mời gửi ${invite.email}.`);
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  const sorted = sortMembers(members);
  return (
    <div className="tm-members">
      {canInvite && <InvitePanel store={store} team={team} role={role} members={members} invites={invites} />}

      <section className="tm-block" aria-labelledby="tm-members-title">
        <h2 id="tm-members-title" className="tm-block-title">Thành viên <span className="tm-count">{members.length}</span></h2>
        <div className="ws-table-wrap tm-table-wrap">
          <table className="ws-table tm-table">
            <thead><tr><th>Thành viên</th><th className="tm-col-role">Vai trò</th><th className="tm-col-date">Tham gia</th><th className="tm-col-act"><span className="tm-sr">Tác vụ</span></th></tr></thead>
            <tbody>
              {loading && !members.length && <tr><td colSpan={4} className="tm-muted">Đang tải…</td></tr>}
              {sorted.map((member) => {
                const manageable = member.uid !== uid && canManageMember(role, member.role);
                const options = assignableRoles(role);
                return (
                  <tr key={member.uid}>
                    <td>
                      <span className="tm-person">
                        <PersonAvatar uid={member.uid} name={member.name || member.email} photoURL={member.photoURL} size={36} />
                        <span className="tm-person-text">
                          <strong>{member.name || member.email}{member.uid === uid && <span className="tm-you">Bạn</span>}</strong>
                          <small>{member.email}</small>
                        </span>
                      </span>
                    </td>
                    <td className="tm-col-role">
                      {manageable ? (
                        <select className="tm-input tm-role-select" value={member.role} aria-label={`Vai trò của ${member.name || member.email}`} onChange={(event) => void changeRole(member, event.target.value as Exclude<TeamRole, 'owner'>)}>
                          {options.map((value) => <option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
                        </select>
                      ) : <RoleBadge role={member.role} />}
                    </td>
                    <td className="tm-col-date">{formatDate(member.joinedAt)}</td>
                    <td className="tm-col-act">
                      {manageable && <button type="button" className="tm-icon-btn tm-danger" aria-label={`Xoá ${member.name || member.email} khỏi nhóm`} title="Xoá khỏi nhóm" onClick={() => void remove(member)}><UserMinus size={18} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {canInvite && invites.length > 0 && (
        <section className="tm-block" aria-labelledby="tm-pending-title">
          <h2 id="tm-pending-title" className="tm-block-title">Lời mời đang chờ <span className="tm-count">{invites.length}</span></h2>
          <div className="ws-table-wrap tm-table-wrap">
            <table className="ws-table tm-table">
              <thead><tr><th>Email</th><th className="tm-col-role">Vai trò</th><th className="tm-col-date">Hết hạn</th><th className="tm-col-wide"><span className="tm-sr">Tác vụ</span></th></tr></thead>
              <tbody>
                {invites.map((invite) => {
                  const expired = inviteExpired(invite);
                  return (
                    <tr key={invite.id} className={expired ? 'tm-expired' : ''}>
                      <td><span className="tm-person-text"><strong>{invite.email}</strong><small>Mời bởi {invite.invitedByName || 'thành viên'}</small></span></td>
                      <td className="tm-col-role"><RoleBadge role={invite.role} /></td>
                      <td className="tm-col-date">{expired ? 'Đã hết hạn' : formatDate(invite.expireAt)}</td>
                      <td className="tm-col-wide">
                        <div className="tm-row-actions">
                          {!expired && <InviteActions invite={invite} inviterName={invite.invitedByName || store.user.name} compact />}
                          <button type="button" className="tm-icon-btn tm-danger" aria-label={`Thu hồi lời mời gửi ${invite.email}`} title="Thu hồi" onClick={() => void revoke(invite)}><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="tm-block" aria-labelledby="tm-matrix-title">
        <h2 id="tm-matrix-title" className="tm-block-title">Phân quyền</h2>
        <div className="ws-table-wrap tm-table-wrap">
          <table className="ws-table tm-table tm-matrix">
            <thead><tr><th>Quyền</th>{ROLES.map((value) => <th key={value} className="tm-col-check">{ROLE_LABEL[value]}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {ROLES.map((value) => <td key={value} className="tm-col-check">{row.roles.includes(value) ? <Check size={18} aria-label="Có" /> : <span className="tm-dash" aria-label="Không">–</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

