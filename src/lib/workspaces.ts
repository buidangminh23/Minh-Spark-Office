import { createWorkspaceStorage } from './storage';
import { createSyncedWorkspace, createSyncStateStore } from './syncEngine';
import type { RemoteWorkspace, SyncedWorkspace } from './syncTypes';

const workspaces = new Map<string, SyncedWorkspace>();

export function accountWorkspace(uid: string) {
  const existing = workspaces.get(uid);
  if (existing) return existing;
  const connect = async () => (await import('./cloudWorkspace')).createCloudWorkspace(uid);
  const remote: RemoteWorkspace = {
    list: async () => (await connect()).list(),
    read: async (id) => (await connect()).read(id),
    write: async (record, revision, planned) => (await connect()).write(record, revision, planned),
    subscribe(onChange, onError) {
      let active = true;
      let stop: (() => void) | undefined;
      void connect().then((cloud) => { if (active) stop = cloud.subscribe(onChange, onError); }).catch((error) => { if (active) onError(error); });
      return () => { active = false; stop?.(); };
    },
  };
  const workspace = createSyncedWorkspace(uid, createWorkspaceStorage(uid), remote, createSyncStateStore(uid));
  workspaces.set(uid, workspace);
  return workspace;
}

export function syncedWorkspace(value: unknown): SyncedWorkspace | null {
  return value && typeof value === 'object' && 'getStatus' in value ? value as SyncedWorkspace : null;
}
