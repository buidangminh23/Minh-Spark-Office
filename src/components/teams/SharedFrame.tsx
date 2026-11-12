import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { useAccount } from '../Authentication';
import { useUi } from '../ui';
import { loadEditor, loadedEditors } from '../../lib/editorModules';
import { tabHost } from '../../lib/documentTabs';
import type { FileContent, FileMeta } from '../../lib/storage';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { can, colorForUid, type TeamItem, type TeamRole } from '../../lib/teams';
import { createPeerMesh, type LivePeer, type MeshStatus, type PeerMesh } from '../../lib/live/peerMesh';
import { createLiveDocument, type LiveDocument, type OpenResult, type SaveState } from '../../lib/live/liveDoc';
import { parseSharedTabId, pickLeader, rememberSharedMeta, sharedMeta } from '../../lib/live/sharedTabs';
import { caretColorsByUid, keepCaretColorUnique } from '../../lib/live/caretColors';
import { readFlat, writeFlat } from '../../lib/live/flatSync';
import { flattenWorkbook, SHEET_MAP, unflattenWorkbook } from '../../lib/live/sheetSync';
import { flattenPresentation, SLIDE_MAP, unflattenPresentation } from '../../lib/live/slideSync';
import { LiveBar } from './LiveBar';
import { TmButton } from './TeamParts';
import { useTeamStore } from './useTeams';

const SNAPSHOT_INTERVAL_MS = 120_000;
const WAIT_PREVIEW_MS = 20_000;
const SEED_RETRY_MS = 15_000;

type Session = { store: TeamStore; item: TeamItem; role: TeamRole; content: FileContent; mesh: PeerMesh; live: LiveDocument; opened: OpenResult };
type Phase = { kind: 'loading'; text: string } | { kind: 'error'; text: string } | { kind: 'ready'; session: Session };

function SharedMessage({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="tm-shared-state">
      <section className="tm-gate" role="status">
        <span className="tm-gate-icon" aria-hidden="true">{icon}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {action}
      </section>
    </div>
  );
}

async function openSession(store: TeamStore, teamId: string, itemId: string, onProgress: (text: string) => void): Promise<Session> {
  const role = await store.getMyRole(teamId);
  if (!role) throw new Error('team/not-member');
  const item = await store.getItem(teamId, itemId);
  if (!item) throw new Error('team/item-gone');
  onProgress('Đang tải tài liệu chung…');
  const content = await store.loadItemContent(item);
  const user = store.user;
  const mesh = createPeerMesh(store.db, { teamId, itemId }, { uid: user.uid, name: user.name, photoURL: user.photoURL, color: colorForUid(user.uid), role });
  const live = createLiveDocument(store.db, { teamId, itemId }, mesh, { canWrite: can(role, 'editDocument'), userName: user.name, uid: user.uid });
  onProgress('Đang đồng bộ với nhóm…');
  const opened = await live.open();
  live.start();
  mesh.start();
  if (opened === 'seed' && seedStructured(live, content)) void live.save(true);
  return { store, item, role, content, mesh, live, opened };
}

function seedStructured(live: LiveDocument, content: FileContent) {
  if (content.kind === 'sheet') {
    const { kind: _kind, workbook, ...extras } = content;
    writeFlat(live.ydoc.getMap(SHEET_MAP), flattenWorkbook(workbook, extras));
    return true;
  }
  if (content.kind === 'slide') {
    writeFlat(live.ydoc.getMap(SLIDE_MAP), flattenPresentation(content));
    return true;
  }
  return false;
}

function hasLiveContent(live: LiveDocument, kind: TeamItem['kind']) {
  if (kind === 'sheet') return live.ydoc.getMap(SHEET_MAP).size > 0;
  if (kind === 'slide') return live.ydoc.getMap(SLIDE_MAP).size > 0;
  return live.ydoc.getXmlFragment('default').length > 0 || live.ydoc.getMap('docMeta').size > 0;
}

function liveContent(session: Session): FileContent {
  if (session.content.kind === 'sheet') return unflattenWorkbook(readFlat(session.live.ydoc.getMap(SHEET_MAP))) ?? session.content;
  if (session.content.kind === 'slide') return unflattenPresentation(readFlat(session.live.ydoc.getMap(SLIDE_MAP))) ?? session.content;
  return session.content;
}

const EXTENSIONS = /\.(docx|xlsx|xlsm|xls|csv|pptx|ppt)$/i;

function useMeshState(mesh: PeerMesh | null) {
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [status, setStatus] = useState<MeshStatus>('connecting');
  useEffect(() => {
    if (!mesh) return;
    let alive = true;
    const stop = mesh.onPeers((next) => queueMicrotask(() => {
      if (!alive) return;
      setPeers(next);
      setStatus(mesh.status());
    }));
    return () => { alive = false; stop(); };
  }, [mesh]);
  return { peers, status };
}

function useCaretColors(session: Session | null) {
  const [colors, setColors] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    if (!session) return;
    const awareness = session.live.awareness;
    const stopUnique = keepCaretColorUnique(awareness, session.store.user.uid);
    let alive = true;
    let queued = false;
    const update = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (alive) setColors(caretColorsByUid(awareness));
      });
    };
    update();
    awareness.on('change', update);
    return () => { alive = false; stopUnique(); awareness.off('change', update); };
  }, [session]);
  return colors;
}

function useSaveState(live: LiveDocument | null) {
  const [state, setState] = useState<{ value: SaveState; at: number }>({ value: 'saved', at: Date.now() });
  useEffect(() => {
    if (!live) return;
    let alive = true;
    const stop = live.onSaveState((value, at) => queueMicrotask(() => {
      if (alive) setState({ value, at });
    }));
    return () => { alive = false; stop(); };
  }, [live]);
  return state;
}

export function SharedFrame({ frameId, onEditing }: { frameId: string; onEditing: (editing: boolean) => void }) {
  const ids = useMemo(() => parseSharedTabId(frameId), [frameId]);
  const ui = useUi();
  const { user, ready } = useAccount();
  const { store, error: storeError } = useTeamStore(user);
  const host = useMemo(() => tabHost(), []);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', text: 'Đang mở tài liệu chung…' });
  const [editorReady, setEditorReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [seedLate, setSeedLate] = useState(false);
  const session = phase.kind === 'ready' ? phase.session : null;
  const meshState = useMeshState(session?.mesh ?? null);
  const saveState = useSaveState(session?.live ?? null);
  const caretColors = useCaretColors(session);
  const openedContent = useMemo(() => (session && !waiting ? liveContent(session) : null), [session, waiting]);
  const snapshot = useRef<{ meta: FileMeta; content: FileContent } | null>(null);
  const lastFlush = useRef(0);
  const flushing = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setPhase({ kind: 'error', text: 'Hãy đăng nhập Google ở cửa sổ chính để mở tài liệu chung của nhóm.' }); return; }
    if (storeError) { setPhase({ kind: 'error', text: storeError }); return; }
    if (!store || !ids) return;
    let alive = true;
    let opened: Session | null = null;
    openSession(store, ids.teamId, ids.itemId, (text) => { if (alive) setPhase({ kind: 'loading', text }); }).then((next) => {
      opened = next;
      if (!alive) { void next.live.destroy(); next.mesh.stop(); return; }
      const meta = sharedMeta(next.item);
      rememberSharedMeta(meta);
      tabHost()?.updateMeta(meta);
      setWaiting(next.opened === 'wait');
      setPhase({ kind: 'ready', session: next });
    }, (failure) => {
      if (!alive) return;
      const code = failure instanceof Error ? failure.message : '';
      setPhase({ kind: 'error', text: code === 'team/not-member' ? 'Bạn không còn là thành viên của nhóm này.' : code === 'team/item-gone' ? 'Tài liệu chung này đã bị xoá khỏi nhóm.' : teamErrorMessage(failure) });
    });
    return () => {
      alive = false;
      if (opened) { void opened.live.destroy(); opened.mesh.stop(); }
    };
  }, [ready, user, store, storeError, ids]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    if (loadedEditors[session.item.kind]) setEditorReady(true);
    else loadEditor(session.item.kind).then(() => { if (alive) setEditorReady(true); }, () => { if (alive) setPhase({ kind: 'error', text: 'Không tải được trình soạn thảo. Kiểm tra mạng rồi mở lại.' }); });
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    if (!session || !waiting) return;
    let alive = true;
    const ydoc = session.live.ydoc;
    const hasContent = () => hasLiveContent(session.live, session.item.kind);
    const check = () => { if (alive && hasContent()) { setWaiting(false); setPreview(false); } };
    ydoc.on('update', check);
    check();
    const canWrite = can(session.role, 'editDocument');
    const timer = canWrite ? null : setTimeout(() => { if (alive && !hasContent()) setPreview(true); }, WAIT_PREVIEW_MS);
    const retry = canWrite ? setInterval(() => {
      void session.live.open().then((result) => {
        if (!alive) return;
        if (result === 'seed') setSeedLate(true);
        if (result !== 'wait') setWaiting(false);
      }, (failure) => console.warn('shared: reopen failed', failure));
    }, SEED_RETRY_MS) : null;
    return () => {
      alive = false;
      ydoc.off('update', check);
      if (timer) clearTimeout(timer);
      if (retry) clearInterval(retry);
    };
  }, [session, waiting]);

  const previewBinding = useMemo(() => {
    if (!preview) return null;
    const ydoc = new Y.Doc();
    return { ydoc, awareness: new Awareness(ydoc) };
  }, [preview]);

  useEffect(() => () => { previewBinding?.awareness.destroy(); previewBinding?.ydoc.destroy(); }, [previewBinding]);

  useEffect(() => {
    onEditing(Boolean(session));
    return () => onEditing(false);
  }, [session, onEditing]);

  const isLeader = useCallback(() => {
    if (!session) return false;
    const writers = session.mesh.peers().filter((peer) => peer.self || (peer.connected && peer.role !== 'viewer')).map((peer) => peer.peerId);
    return pickLeader(writers) === session.mesh.peerId;
  }, [session]);

  const flushSnapshot = useCallback(async (force: boolean) => {
    if (!session || !can(session.role, 'editDocument') || !snapshot.current) return;
    if (!force && (Date.now() - lastFlush.current < SNAPSHOT_INTERVAL_MS || !isLeader())) return;
    if (flushing.current) { await flushing.current; return; }
    const current = snapshot.current;
    const run = (async () => {
      try {
        const latest = await session.store.getItem(session.item.teamId, session.item.id);
        if (!latest) return;
        const name = current.meta.name.replace(EXTENSIONS, '').trim() || latest.name;
        await session.store.replaceItemContent(latest, current.content, { name });
        lastFlush.current = Date.now();
        if (snapshot.current === current) snapshot.current = null;
      } catch (failure) { console.warn('shared: snapshot flush failed', failure); }
    })();
    flushing.current = run;
    try { await run; } finally { flushing.current = null; }
  }, [session, isLeader]);

  useEffect(() => {
    if (!session || !host) return;
    return host.attach(frameId, {
      save: async () => {
        await session.live.save();
        await flushSnapshot(true);
        return session.live.saveState() !== 'error';
      },
      rename: () => undefined,
    });
  }, [session, host, frameId, flushSnapshot]);

  const onSave = useCallback(async (meta: FileMeta, content: FileContent) => {
    snapshot.current = { meta, content };
    void flushSnapshot(false);
    return true;
  }, [flushSnapshot]);

  if (phase.kind === 'loading') return <SharedMessage icon={<Users size={32} />} title="Tài liệu chung" text={phase.text} />;
  if (phase.kind === 'error') return <SharedMessage icon={<ShieldAlert size={32} />} title="Không mở được tài liệu" text={phase.text} action={<TmButton onClick={() => host?.showHome()}>Về trang chủ</TmButton>} />;
  if (!session || !editorReady) return <SharedMessage icon={<Users size={32} />} title="Tài liệu chung" text="Đang tải trình soạn thảo…" />;
  if (waiting && !previewBinding) return <SharedMessage icon={<Users size={32} />} title="Đang chờ đồng bộ" text="Một thành viên khác đang chuẩn bị tài liệu này lần đầu. Vui lòng đợi vài giây…" />;

  const meta = sharedMeta(session.item);
  const readOnly = !can(session.role, 'editDocument');
  const peers = meshState.peers.map((peer) => ({ ...peer, color: caretColors.get(peer.uid) ?? peer.color }));
  const bar = <LiveBar peers={peers} status={meshState.status} saveState={saveState.value} savedAt={saveState.at} />;
  const back = () => host?.showHome();

  if (session.item.kind === 'doc' && session.content.kind === 'doc' && loadedEditors.doc) {
    const DocEditor = loadedEditors.doc;
    if (waiting && previewBinding) {
      return (
        <DocEditor
          key="preview"
          meta={meta}
          content={session.content}
          onSave={async () => true}
          onRename={() => undefined}
          onBack={back}
          live={{ ydoc: previewBinding.ydoc, awareness: previewBinding.awareness, user: { name: session.store.user.name, color: colorForUid(session.store.user.uid) }, seed: true, readOnly: true, bar, onSeeded: () => undefined }}
        />
      );
    }
    return (
      <DocEditor
        key="live"
        meta={meta}
        content={session.content}
        onSave={(next, content) => onSave(next, content)}
        onRename={() => undefined}
        onBack={back}
        live={{
          ydoc: session.live.ydoc,
          awareness: session.live.awareness,
          user: { name: session.store.user.name, color: colorForUid(session.store.user.uid) },
          seed: session.opened === 'seed' || seedLate,
          readOnly,
          bar,
          onSeeded: () => { void session.live.save(true).then(() => ui.toast('Đã bật sửa chung cho tài liệu này.')); },
        }}
      />
    );
  }
  const liveUser = { uid: session.store.user.uid, name: session.store.user.name, color: colorForUid(session.store.user.uid) };
  const previewing = Boolean(waiting && previewBinding);
  const structured = previewing && previewBinding
    ? { ydoc: previewBinding.ydoc, awareness: previewBinding.awareness, user: liveUser, readOnly: true, bar }
    : { ydoc: session.live.ydoc, awareness: session.live.awareness, user: liveUser, readOnly, bar };
  const editorKey = previewing ? 'preview' : 'live';
  const current = openedContent ?? session.content;
  if (current.kind === 'sheet' && loadedEditors.sheet) {
    const SheetEditor = loadedEditors.sheet;
    return <SheetEditor key={editorKey} meta={meta} content={current} onSave={(next, content) => onSave(next, content)} onRename={() => undefined} onBack={back} live={structured} />;
  }
  if (current.kind === 'slide' && loadedEditors.slide) {
    const SlideEditor = loadedEditors.slide;
    return <SlideEditor key={editorKey} meta={meta} content={current} onSave={(next, content) => onSave(next, content)} onRename={() => undefined} onBack={back} live={structured} />;
  }
  return <SharedMessage icon={<Users size={32} />} title="Chưa hỗ trợ" text="Loại tài liệu này chưa sửa chung được." action={<TmButton onClick={back}>Về trang chủ</TmButton>} />;
}

