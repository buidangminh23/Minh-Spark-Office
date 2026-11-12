import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { openTeamStore, teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import type { TeamInvite, TeamItem, TeamMember, TeamMembership } from '../../lib/teams';

export function teamUserOf(user: User) {
  return { uid: user.uid, email: user.email ?? '', name: user.displayName || user.email || 'Thành viên', photoURL: user.photoURL ?? '' };
}

export function useTeamStore(user: User | null) {
  const [store, setStore] = useState<TeamStore | null>(null);
  const [error, setError] = useState('');
  const uid = user?.uid ?? null;
  useEffect(() => {
    setStore(null);
    setError('');
    if (!user) return;
    let alive = true;
    openTeamStore(teamUserOf(user)).then((next) => { if (alive) setStore(next); }, (failure) => { if (alive) setError(teamErrorMessage(failure)); });
    return () => { alive = false; };
  }, [uid]);
  return { store, error };
}

type Live<T> = { data: T; loading: boolean; error: string };

function useLive<T>(initial: T, subscribe: ((onData: (value: T) => void, onError: (error: unknown) => void) => () => void) | null, key: string): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: initial, loading: Boolean(subscribe), error: '' });
  useEffect(() => {
    if (!subscribe) { setState({ data: initial, loading: false, error: '' }); return; }
    setState({ data: initial, loading: true, error: '' });
    return subscribe(
      (data) => setState({ data, loading: false, error: '' }),
      (failure) => { console.warn('team subscription failed', failure); setState((current) => ({ ...current, loading: false, error: teamErrorMessage(failure) })); },
    );
  }, [key]);
  return state;
}

export function useMemberships(store: TeamStore | null) {
  return useLive<TeamMembership[]>([], store ? store.subscribeMemberships : null, store ? `m:${store.user.uid}` : 'none');
}

export function useMyInvites(store: TeamStore | null) {
  return useLive<TeamInvite[]>([], store ? store.subscribeMyInvites : null, store ? `i:${store.user.uid}` : 'none');
}

export function useTeamData(store: TeamStore | null, teamId: string | null, canSeeInvites: boolean) {
  const members = useLive<TeamMember[]>([], store && teamId ? (onData, onError) => store.subscribeMembers(teamId, onData, onError) : null, `${teamId}:members`);
  const items = useLive<TeamItem[]>([], store && teamId ? (onData, onError) => store.subscribeItems(teamId, onData, onError) : null, `${teamId}:items`);
  const invites = useLive<TeamInvite[]>([], store && teamId && canSeeInvites ? (onData, onError) => store.subscribeInvites(teamId, onData, onError) : null, `${teamId}:invites:${canSeeInvites}`);
  return useMemo(() => ({ members, items, invites }), [members, items, invites]);
}
