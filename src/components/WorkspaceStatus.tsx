import { useEffect, useState, useSyncExternalStore } from 'react';
import { createDraftWorkspaceStorage, useWorkspace, type FileMeta } from '../lib/storage';
import { syncedWorkspace } from '../lib/workspaces';
import { useAccount } from './Authentication';
import { useUi } from './ui';
import type { SyncStatus } from '../lib/syncTypes';
import './workspaceStatus.css';

const draftStatus: SyncStatus = { state: 'offline', pending: 0 };
const noSubscribe = () => () => {};
const getDraftStatus = () => draftStatus;
const openDraftsEvent = 'minh-office:open-drafts';

export function openDraftImport() {
  window.dispatchEvent(new Event(openDraftsEvent));
}

export function useWorkspaceSync() {
  const storage = useWorkspace();
  const sync = syncedWorkspace(storage);
  const { user, login } = useAccount();
  const status = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getStatus ?? getDraftStatus);
  return { user, login, status, syncNow: () => void sync?.syncNow() };
}

export function WorkspaceStatus() {
  const storage = useWorkspace();
  const { user } = useWorkspaceSync();
  const ui = useUi();
  const [drafts, setDrafts] = useState<FileMeta[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDrafts(null); setSelected(new Set()); }, [user?.uid]);
  useEffect(() => {
    const open = async () => {
      const files = (await createDraftWorkspaceStorage().listFiles()).filter((file) => !file.deletedAt);
      setDrafts(files);
      setSelected(new Set());
    };
    const handler = () => void open();
    window.addEventListener(openDraftsEvent, handler);
    return () => window.removeEventListener(openDraftsEvent, handler);
  }, []);
  const importDrafts = async () => {
    setBusy(true);
    try {
      const source = createDraftWorkspaceStorage();
      for (const file of drafts ?? []) {
        if (!selected.has(file.id)) continue;
        const content = await source.loadContent(file.id);
        if (!content) continue;
        const id = `${file.kind}-${crypto.randomUUID()}`;
        const versions = (await source.listVersions(file.id)).map((version) => ({ ...version, fileId: id }));
        await storage.replaceFile({ ...file, id }, content, versions);
      }
      setDrafts(null);
      ui.toast('Đã sao chép các tài liệu đã chọn vào tài khoản. Bản trên thiết bị vẫn được giữ.');
    } catch { ui.toast('Chưa sao chép được tài liệu. Hãy thử lại.', true); }
    finally { setBusy(false); }
  };
  return <>
    {drafts && <div className="sync-dialog-backdrop"><section className="sync-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-title">
      <img className="sync-brand" src="/logo-icon.png" alt="Minh Spark Office" />
      <h2 id="draft-title">Thêm tài liệu vào tài khoản</h2>
      <p>Chọn tài liệu trên thiết bị để đồng bộ với {user?.email}.</p>
      <div className="draft-selection">{drafts.length ? drafts.map((file) => <label key={file.id}><input type="checkbox" checked={selected.has(file.id)} disabled={busy} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); return next; })} />{file.name}</label>) : <p>Không có bản nháp trên thiết bị.</p>}</div>
      <div className="sync-dialog-actions"><button className="btn" disabled={busy} onClick={() => setDrafts(null)}>Đóng</button><button className="btn btn-primary" disabled={busy || !selected.size} onClick={() => void importDrafts()}>{busy ? 'Đang sao chép…' : `Thêm ${selected.size} tài liệu`}</button></div>
    </section></div>}
  </>;
}
