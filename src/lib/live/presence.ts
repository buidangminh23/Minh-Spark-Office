import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

export type LiveUser = { uid: string; name: string; color: string };
export type RemotePresence<T> = { key: string; uid: string; name: string; color: string; value: T };

type PresenceState = { user?: Partial<LiveUser> } & Record<string, unknown>;

export function useLocalUser(awareness: Awareness | null, user: LiveUser | null) {
  const uid = user?.uid ?? '';
  const name = user?.name ?? '';
  const color = user?.color ?? '';
  useEffect(() => {
    if (!awareness || !uid) return;
    const current = (awareness.getLocalState() as PresenceState | null)?.user;
    awareness.setLocalStateField('user', { uid, name, color: current?.uid === uid && current.color ? current.color : color });
  }, [awareness, uid, name, color]);
}

export function useLocalPresence(awareness: Awareness | null, field: string, value: unknown) {
  const encoded = JSON.stringify(value ?? null);
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField(field, JSON.parse(encoded));
  }, [awareness, field, encoded]);
}

export function readRemotePresence<T>(awareness: Awareness, field: string, selfUid: string): RemotePresence<T>[] {
  const list: RemotePresence<T>[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const entry = state as PresenceState;
    const user = entry.user;
    if (clientId === awareness.clientID || !user?.uid || user.uid === selfUid || entry[field] == null) return;
    list.push({ key: String(clientId), uid: user.uid, name: user.name || 'Thành viên', color: user.color || '#2563eb', value: entry[field] as T });
  });
  return list;
}

export function useRemotePresence<T>(awareness: Awareness | null, field: string, selfUid: string) {
  const [list, setList] = useState<RemotePresence<T>[]>([]);
  useEffect(() => {
    if (!awareness) return;
    let alive = true;
    const update = () => queueMicrotask(() => { if (alive) setList(readRemotePresence<T>(awareness, field, selfUid)); });
    update();
    awareness.on('change', update);
    return () => { alive = false; awareness.off('change', update); };
  }, [awareness, field, selfUid]);
  return list;
}
