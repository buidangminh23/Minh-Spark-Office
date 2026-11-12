import type { FileContent, FileMeta, FileVersion, WorkspaceStorage } from './storage';

export type RemoteFile = { id: string; revision: string; deleted: boolean };
export type RemoteRecord = RemoteFile & { meta: FileMeta | null; content: FileContent | undefined; versions: FileVersion[] };
export interface RemoteWorkspace {
  subscribe(onChange: () => void, onError: (error: unknown) => void): () => void;
  list(): Promise<RemoteFile[]>;
  read(id: string): Promise<RemoteRecord | null>;
  write(record: RemoteRecord, expectedRevision: string | null): Promise<string>;
}

export class RemoteConflictError extends Error {
  readonly current: RemoteRecord | null;
  constructor(current: RemoteRecord | null) {
    super('The cloud file changed on another device.');
    this.name = 'RemoteConflictError';
    this.current = current;
  }
}

export type SyncStatus = { state: 'connecting' | 'syncing' | 'synced' | 'offline' | 'error'; pending: number; message?: string };
export type PendingRecord = { generation: number; record: RemoteRecord; baseRevision?: string | null };
export type SyncState = { bases: Record<string, string>; pending: Record<string, PendingRecord>; generation: number; incoming?: Record<string, RemoteRecord> };
export interface SyncStateStore { read(): Promise<SyncState>; write(state: SyncState): Promise<void> }
export type SyncedWorkspace = WorkspaceStorage & {
  start(): () => void;
  subscribe(listener: () => void): () => void;
  getStatus(): SyncStatus;
  syncNow(): Promise<void>;
  setActiveFile(id: string | null): void;
  setOpenFiles(ids: readonly string[]): void;
};
