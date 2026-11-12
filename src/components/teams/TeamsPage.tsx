import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileStack, Files, Plus, Settings2, UserPlus, Users } from 'lucide-react';
import { useAccount } from '../Authentication';
import { Popover } from '../HomeParts';
import { useUi } from '../ui';
import type { FileContent, FileMeta } from '../../lib/storage';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { can, ROLE_LABEL, type TeamItem, type TeamMembership, type TeamRole } from '../../lib/teams';
import { InviteAcceptDialog, PendingInvites } from './InviteAccept';
import { TeamCreateForm, TeamOnboarding } from './TeamOnboarding';
import { TeamLibrary } from './TeamLibrary';
import { TeamMembers } from './TeamMembers';
import { TeamSettings } from './TeamSettings';
import { PersonAvatar, RoleBadge, TeamAvatar, TmButton, TmModal } from './TeamParts';
import { useMemberships, useMyInvites, useTeamData, useTeamStore } from './useTeams';
import './teams.css';

type Tab = 'templates' | 'documents' | 'members' | 'settings';
const SELECTED_KEY = 'office-team-selected';

function readSelected(uid: string) {
  try { return localStorage.getItem(`${SELECTED_KEY}:${uid}`); } catch { return null; }
}

function writeSelected(uid: string, teamId: string) {
  try { localStorage.setItem(`${SELECTED_KEY}:${uid}`, teamId); } catch { return; }
}

export type SharedOpen = (item: TeamItem, membership: TeamMembership, store: TeamStore) => void;

export function TeamsPage({ files, inviteToken, onInviteDone, onCreateFromContent, onOpenShared }: {
  files: FileMeta[];
  inviteToken: { teamId: string; inviteId: string } | null;
  onInviteDone: () => void;
  onCreateFromContent: (name: string, content: FileContent) => void;
  onOpenShared: SharedOpen;
}) {
  const ui = useUi();
  const { user, ready, login, pending: loginPending } = useAccount();
  const { store, error: storeError } = useTeamStore(user);
  const memberships = useMemberships(store);
  const myInvites = useMyInvites(store);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('templates');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const closeSwitcher = useCallback(() => setSwitcher(false), []);

  useEffect(() => { if (user) setSelectedId(readSelected(user.uid)); }, [user]);

  const current = useMemo(() => memberships.data.find((entry) => entry.team.id === selectedId) ?? memberships.data[0] ?? null, [memberships.data, selectedId]);
  const role: TeamRole | null = current?.role ?? null;
  const data = useTeamData(store, current?.team.id ?? null, can(role, 'invite'));
  const me = data.members.data.find((member) => member.uid === user?.uid);

  useEffect(() => {
    if (store && current && me) void store.syncProfile(current.team.id, me).catch(() => undefined);
  }, [store, current, me]);

  useEffect(() => { if (tab === 'settings' && !role) setTab('templates'); }, [tab, role]);

  const select = (teamId: string) => {
    setSelectedId(teamId);
    if (user) writeSelected(user.uid, teamId);
    setSwitcher(false);
  };

  const create = async (input: { name: string; description: string; color: string }) => {
    if (!store) return;
    setBusy(true);
    try {
      const teamId = await store.createTeam(input);
      select(teamId);
      setCreating(false);
      setTab('members');
      ui.toast(`Đã tạo nhóm “${input.name}”. Hãy mời thành viên đầu tiên.`);
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
    finally { setBusy(false); }
  };

  const applyTemplate = async (item: TeamItem) => {
    if (!store) return;
    ui.showBusy('Đang tải mẫu…');
    try {
      const content = await store.loadItemContent(item);
      onCreateFromContent(item.name, content);
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
    finally { ui.showBusy(null); }
  };

  const joined = (teamId: string) => {
    select(teamId);
    setTab('templates');
    onInviteDone();
    ui.toast('Đã tham gia nhóm.');
  };

  const inviteDialog = inviteToken && (
    <InviteAcceptDialog token={inviteToken} store={store} memberships={memberships.data} onJoined={joined} onClose={onInviteDone} />
  );

  if (!ready) return <div className="tm-page"><p className="tm-muted" role="status">Đang tải…</p>{inviteDialog}</div>;

  if (!user) {
    return (
      <div className="tm-page">
        <section className="tm-gate">
          <span className="tm-gate-icon" aria-hidden="true"><Users size={32} /></span>
          <h1>Nhóm cần tài khoản Google</h1>
          <p>Đăng nhập để tạo nhóm, nhận lời mời và cùng chỉnh sửa tài liệu với đồng nghiệp. Mỗi thành viên được nhận diện bằng email Google của mình.</p>
          <TmButton variant="primary" className="tm-gate-btn" disabled={loginPending} onClick={() => void login()}><img src="/google.svg" width="20" height="20" alt="" />Đăng nhập bằng Google</TmButton>
        </section>
        {inviteDialog}
      </div>
    );
  }

  const error = storeError || memberships.error;
  const loading = !store || memberships.loading;

  return (
    <div className="tm-page">
      {store && <PendingInvites invites={myInvites.data} store={store} onJoined={joined} />}
      {error && <p className="tm-alert" role="alert">{error}</p>}
      {loading && !memberships.data.length ? (
        <div className="tm-hero tm-skeleton" aria-busy="true" />
      ) : !current ? (
        <TeamOnboarding onCreate={(input) => void create(input)} busy={busy} />
      ) : (
        <>
          <header className="tm-hero" style={{ '--tm-color': current.team.color } as React.CSSProperties}>
            <TeamAvatar name={current.team.name} color={current.team.color} size={64} />
            <div className="tm-hero-text">
              <div className="tm-hero-title">
                <h1>{current.team.name}</h1>
                <RoleBadge role={current.role} />
              </div>
              {current.team.description && <p>{current.team.description}</p>}
              <div className="tm-hero-meta">
                <span className="tm-stack" aria-label={`${data.members.data.length} thành viên`}>
                  {data.members.data.slice(0, 5).map((member) => <PersonAvatar key={member.uid} uid={member.uid} name={member.name || member.email} photoURL={member.photoURL} size={28} title={member.name || member.email} />)}
                </span>
                <span>{data.members.data.length} thành viên · {data.items.data.filter((item) => item.type === 'template').length} mẫu · {data.items.data.filter((item) => item.type === 'document').length} tài liệu chung</span>
              </div>
            </div>
            <div className="tm-hero-actions">
              <Popover open={switcher} onClose={closeSwitcher} align="end" trigger={
                <TmButton aria-haspopup="menu" aria-expanded={switcher} onClick={() => setSwitcher((value) => !value)}>Đổi nhóm<ChevronDown size={16} aria-hidden="true" /></TmButton>
              }>
                {memberships.data.map((entry) => (
                  <button key={entry.team.id} role="menuitem" className={`ws-menu-item tm-switch-item ${entry.team.id === current.team.id ? 'is-active' : ''}`} onClick={() => select(entry.team.id)}>
                    <TeamAvatar name={entry.team.name} color={entry.team.color} size={28} />
                    <span><strong>{entry.team.name}</strong><small>{ROLE_LABEL[entry.role]}</small></span>
                  </button>
                ))}
                <button role="menuitem" className="ws-menu-item" onClick={() => { setSwitcher(false); setCreating(true); }}><Plus size={18} />Tạo nhóm mới</button>
              </Popover>
              {can(current.role, 'invite') && <TmButton variant="primary" icon={<UserPlus size={18} aria-hidden="true" />} onClick={() => setTab('members')}>Mời thành viên</TmButton>}
            </div>
          </header>

          <nav className="tm-tabs" role="tablist" aria-label="Khu vực của nhóm">
            {([
              ['templates', 'Mẫu chung', <FileStack key="t" size={18} />],
              ['documents', 'Tài liệu chung', <Files key="d" size={18} />],
              ['members', 'Thành viên', <Users key="m" size={18} />],
              ['settings', 'Cài đặt nhóm', <Settings2 key="s" size={18} />],
            ] as Array<[Tab, string, React.ReactNode]>).map(([value, label, icon]) => (
              <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{icon}{label}</button>
            ))}
          </nav>

          {store && (tab === 'templates' || tab === 'documents') && (
            <TeamLibrary
              key={`${current.team.id}:${tab}`}
              store={store}
              teamId={current.team.id}
              type={tab === 'templates' ? 'template' : 'document'}
              role={current.role}
              items={data.items.data}
              members={data.members.data}
              files={files}
              loading={data.items.loading}
              error={data.items.error}
              onUse={(item) => void applyTemplate(item)}
              onOpen={(item) => onOpenShared(item, current, store)}
            />
          )}
          {store && tab === 'members' && <TeamMembers store={store} team={current.team} role={current.role} members={data.members.data} invites={data.invites.data} loading={data.members.loading} />}
          {store && tab === 'settings' && <TeamSettings key={current.team.id + current.team.updatedAt} store={store} team={current.team} role={current.role} members={data.members.data} onLeft={() => { setSelectedId(null); setTab('templates'); }} />}
        </>
      )}

      {creating && (
        <TmModal title="Tạo nhóm mới" subtitle="Bạn sẽ là chủ sở hữu của nhóm này." onClose={() => { if (!busy) setCreating(false); }}>
          <TeamCreateForm onCreate={(input) => void create(input)} onCancel={() => setCreating(false)} busy={busy} />
        </TmModal>
      )}
      {inviteDialog}
    </div>
  );
}
