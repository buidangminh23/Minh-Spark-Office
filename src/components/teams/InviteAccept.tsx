import { useEffect, useState } from 'react';
import { MailCheck, ShieldAlert } from 'lucide-react';
import { useAccount } from '../Authentication';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { inviteExpired, ROLE_DESCRIPTION, ROLE_LABEL, type TeamInvite, type TeamMembership } from '../../lib/teams';
import { formatDate, RoleBadge, TmButton, TmModal } from './TeamParts';

type Phase = { kind: 'loading' } | { kind: 'login' } | { kind: 'ready'; invite: TeamInvite } | { kind: 'member'; teamId: string } | { kind: 'unavailable'; reason: string };

export function InviteAcceptDialog({ token, store, memberships, onJoined, onClose }: {
  token: { teamId: string; inviteId: string };
  store: TeamStore | null;
  memberships: TeamMembership[];
  onJoined: (teamId: string) => void;
  onClose: () => void;
}) {
  const { user, ready, login, logout } = useAccount();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const alreadyMember = memberships.some((membership) => membership.team.id === token.teamId);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setPhase({ kind: 'login' }); return; }
    if (alreadyMember) { setPhase({ kind: 'member', teamId: token.teamId }); return; }
    if (!store) { setPhase({ kind: 'loading' }); return; }
    let alive = true;
    setPhase({ kind: 'loading' });
    store.getInvite(token.teamId, token.inviteId).then((invite) => {
      if (!alive) return;
      if (!invite) setPhase({ kind: 'unavailable', reason: 'Lời mời đã được dùng, đã bị thu hồi hoặc không tồn tại.' });
      else if (inviteExpired(invite)) setPhase({ kind: 'unavailable', reason: `Lời mời đã hết hạn ngày ${formatDate(invite.expireAt)}. Hãy nhờ người mời gửi lại.` });
      else setPhase({ kind: 'ready', invite });
    }, (failure) => {
      if (!alive) return;
      const denied = String((failure as { code?: string })?.code ?? '').includes('permission-denied');
      setPhase({ kind: 'unavailable', reason: denied
        ? `Tài khoản ${user.email} không mở được lời mời này. Lời mời có thể đã gửi tới email khác, đã hết hạn hoặc đã bị thu hồi.`
        : teamErrorMessage(failure) });
    });
    return () => { alive = false; };
  }, [ready, user, store, alreadyMember, token.teamId, token.inviteId]);

  const accept = async (invite: TeamInvite) => {
    if (!store) return;
    setBusy(true);
    try {
      await store.acceptInvite(invite);
      onJoined(invite.teamId);
    } catch (failure) {
      setPhase({ kind: 'unavailable', reason: teamErrorMessage(failure) });
    } finally { setBusy(false); }
  };

  const decline = async (invite: TeamInvite) => {
    if (!store) return;
    setBusy(true);
    await store.deleteInvite(invite.teamId, invite.id).catch(() => undefined);
    setBusy(false);
    onClose();
  };

  return (
    <TmModal title="Lời mời tham gia nhóm" onClose={() => { if (!busy) onClose(); }} labelledBy="tm-invite-accept-title">
      {phase.kind === 'loading' && <p className="tm-muted" role="status">Đang kiểm tra lời mời…</p>}
      {phase.kind === 'login' && (
        <div className="tm-invite-accept">
          <span className="tm-accept-icon" aria-hidden="true"><MailCheck size={28} /></span>
          <p>Đăng nhập Google bằng <strong>đúng email đã nhận lời mời</strong> để xem và tham gia nhóm.</p>
          <TmButton variant="primary" onClick={() => void login()}><img src="/google.svg" width="18" height="18" alt="" />Đăng nhập bằng Google</TmButton>
        </div>
      )}
      {phase.kind === 'member' && (
        <div className="tm-invite-accept">
          <span className="tm-accept-icon" aria-hidden="true"><MailCheck size={28} /></span>
          <p>Bạn đã là thành viên của nhóm này.</p>
          <TmButton variant="primary" onClick={() => onJoined(phase.teamId)}>Mở nhóm</TmButton>
        </div>
      )}
      {phase.kind === 'unavailable' && (
        <div className="tm-invite-accept">
          <span className="tm-accept-icon tm-accept-warn" aria-hidden="true"><ShieldAlert size={28} /></span>
          <p>{phase.reason}</p>
          <div className="tm-form-actions">
            <TmButton onClick={onClose}>Đóng</TmButton>
            {user && <TmButton variant="primary" onClick={() => { void logout().then(() => login()); }}>Đăng nhập tài khoản khác</TmButton>}
          </div>
        </div>
      )}
      {phase.kind === 'ready' && (
        <div className="tm-invite-accept">
          <span className="tm-accept-icon" aria-hidden="true"><MailCheck size={28} /></span>
          <h3>{phase.invite.teamName}</h3>
          <p><strong>{phase.invite.invitedByName || 'Một thành viên'}</strong> mời bạn tham gia với vai trò <RoleBadge role={phase.invite.role} /></p>
          <p className="tm-muted">{ROLE_DESCRIPTION[phase.invite.role]}</p>
          <p className="tm-muted">Tham gia bằng tài khoản {user?.email}. Lời mời hết hạn ngày {formatDate(phase.invite.expireAt)}.</p>
          <div className="tm-form-actions">
            <TmButton disabled={busy} onClick={() => void decline(phase.invite)}>Từ chối</TmButton>
            <TmButton variant="primary" disabled={busy} onClick={() => void accept(phase.invite)}>{busy ? 'Đang tham gia…' : `Tham gia với vai trò ${ROLE_LABEL[phase.invite.role]}`}</TmButton>
          </div>
        </div>
      )}
    </TmModal>
  );
}

export function PendingInvites({ invites, store, onJoined }: { invites: TeamInvite[]; store: TeamStore; onJoined: (teamId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!invites.length) return null;
  const act = async (invite: TeamInvite, accept: boolean) => {
    setBusy(invite.id);
    setError('');
    try {
      if (accept) { await store.acceptInvite(invite); onJoined(invite.teamId); }
      else await store.deleteInvite(invite.teamId, invite.id);
    } catch (failure) { setError(teamErrorMessage(failure)); }
    finally { setBusy(null); }
  };
  return (
    <section className="tm-pending" aria-labelledby="tm-pending-mine">
      <h2 id="tm-pending-mine"><MailCheck size={18} aria-hidden="true" />Lời mời dành cho bạn</h2>
      <ul>
        {invites.map((invite) => (
          <li key={invite.id}>
            <span><strong>{invite.teamName}</strong> · {invite.invitedByName || 'Một thành viên'} mời bạn làm <RoleBadge role={invite.role} /></span>
            <div className="tm-row-actions">
              <TmButton disabled={busy === invite.id} onClick={() => void act(invite, false)}>Từ chối</TmButton>
              <TmButton variant="primary" disabled={busy === invite.id} onClick={() => void act(invite, true)}>Tham gia</TmButton>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="tm-alert" role="alert">{error}</p>}
    </section>
  );
}
