import type { FileContent, FileMeta, WorkspaceStorage } from './storage';
import { accountWorkspace } from './workspaces';

export async function saveAccountSnapshot(options: {
  accountId: string;
  sourceUserId: string | undefined;
  sourceStorage: WorkspaceStorage;
  meta: FileMeta;
  content: FileContent;
  label?: string;
}) {
  const { accountId, sourceUserId, sourceStorage, content, label } = options;
  const storage = accountWorkspace(accountId);
  const copying = sourceUserId !== accountId;
  const meta = structuredClone(options.meta);
  if (copying) {
    const versions = await sourceStorage.listVersions(meta.id);
    meta.id = `${meta.kind}-${crypto.randomUUID()}`;
    await storage.replaceFile(meta, content, versions.map((version) => ({ ...version, fileId: meta.id })));
  } else await storage.saveFile(meta, content);
  const version = await storage.saveVersion(meta.id, content, label);
  if (copying && typeof window !== 'undefined') {
    try { sessionStorage.setItem(`minh-office-open:${accountId}`, meta.id); } catch {}
    window.dispatchEvent(new CustomEvent('office-open-saved', { detail: { uid: accountId, id: meta.id } }));
  }
  return { storage, meta, version };
}
