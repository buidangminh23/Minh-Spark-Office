import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, House, Plus, X } from 'lucide-react';
import { useAccount } from './Authentication';
import { useUi } from './ui';
import { WorkspaceStatus } from './WorkspaceStatus';
import { useWorkspace, type FileContent, type FileMeta } from '../lib/storage';
import { syncedWorkspace } from '../lib/workspaces';
import { suiteLogos } from '../lib/suiteBranding';
import { useDocumentCloser } from '../lib/documentCloser';
import { printFrameDocument } from '../lib/print/tabPrint';
import { getSettings } from '../lib/appSettings';
import { restoredSharedMeta } from '../lib/live/sharedTabs';
import {
  cycleTarget,
  frameShowsTab,
  gotoTarget,
  installTabHost,
  shortcutPlatform,
  tabModifierLabel,
  readTabSession,
  tabFrameUrl,
  tabFromMeta,
  withTab,
  withoutTab,
  writeTabSession,
  type DocumentTab,
  type TabFrameApi,
  type TabHandoff,
  type TabCommand,
  type TabHost,
} from '../lib/documentTabs';
import './documentTabs.css';

type TabsApi = {
  open(meta: FileMeta, content?: FileContent): void;
  close(id: string): Promise<boolean>;
  isOpen(id: string): boolean;
  rename(id: string, name: string): void;
  homeVisible: boolean;
};

type TabState = { tabs: DocumentTab[]; active: string | null };

const HOME_ICON = '/logo-icon.png';
const SAVE_FAILED = 'Chưa lưu được tài liệu nên tab vẫn mở. Hãy thử lưu lại rồi đóng tab.';
const REOPEN_FAILED = 'Tài liệu vừa đóng không còn, có thể đã bị xoá hoặc chuyển vào thùng rác.';
const CLOSED_HISTORY = 20;
const NUMBERED_TABS = 8;

const TabsContext = createContext<TabsApi | null>(null);

export function useDocumentTabs() {
  return useContext(TabsContext);
}

function setFavicon(href: string) {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = href;
}

const LAUNCH_RESTORED_KEY = 'minh-office-tabs-launch-restored';

function startOnHome() {
  try {
    if (sessionStorage.getItem(LAUNCH_RESTORED_KEY)) return false;
    sessionStorage.setItem(LAUNCH_RESTORED_KEY, '1');
  } catch {
    return false;
  }
  return getSettings().startup === 'home';
}

function useTabState(uid: string | null, ready: boolean) {
  const storage = useWorkspace();
  const [state, setState] = useState<TabState>({ tabs: [], active: null });
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const session = readTabSession(uid);
    void storage.listFiles().then((files) => {
      if (!alive) return;
      const live = new Map(files.filter((file) => !file.deletedAt).map((file) => [file.id, file]));
      const tabs = session.ids.flatMap((id) => { const meta = live.get(id) ?? restoredSharedMeta(id); return meta ? [tabFromMeta(meta)] : []; });
      const known = (id: string) => live.has(id) || Boolean(restoredSharedMeta(id));
      const active = session.active && known(session.active) && !startOnHome() ? session.active : null;
      setState((current) => ({ tabs: tabs.reduce(withTab, current.tabs), active: current.active ?? active }));
    }).catch(() => undefined).finally(() => { if (alive) setRestored(true); });
    return () => { alive = false; };
  }, [ready, uid, storage]);
  useEffect(() => {
    if (restored) writeTabSession(uid, { ids: state.tabs.map((tab) => tab.id), active: state.active });
  }, [restored, uid, state]);
  return [state, setState] as const;
}

function TabStrip({ state, onSelect, onClose }: { state: TabState; onSelect: (id: string | null) => void; onClose: (id: string) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const platform = useMemo(() => shortcutPlatform(), []);
  const mod = tabModifierLabel(platform);
  const closeKeys = platform.desktop ? `Ctrl+W hoặc ${mod}+W` : `${mod}+W`;
  const keyshortcuts = `${platform.mac ? 'Control' : 'Alt'}+BracketRight ${platform.mac ? 'Control' : 'Alt'}+BracketLeft Control+Tab Control+Shift+Tab`;
  useLayoutEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [state.active]);
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const tabs = Array.from(strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]?.focus();
  };
  return (
    <div className="doc-tabs" role="tablist" aria-label="Tài liệu đang mở" aria-keyshortcuts={keyshortcuts} ref={strip} onKeyDown={moveFocus}>
      <div className="doc-tab doc-tab-home" data-active={state.active === null}>
        <button type="button" role="tab" className="doc-tab-main" aria-selected={state.active === null} onClick={() => onSelect(null)} title={`Trang chủ (${mod}+1). Chuyển tab: ${mod}+] / ${mod}+[`}>
          <House size={16} aria-hidden="true" />
          <span className="doc-tab-name">Trang chủ</span>
        </button>
      </div>
      {state.tabs.map((tab, index) => (
        <div key={tab.id} className="doc-tab" data-active={state.active === tab.id}>
          <button
            type="button"
            role="tab"
            className="doc-tab-main"
            aria-selected={state.active === tab.id}
            title={index + 1 < NUMBERED_TABS ? `${tab.name} (${mod}+${index + 2})` : tab.name}
            onClick={() => onSelect(tab.id)}
            onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(tab.id); } }}
          >
            <img src={suiteLogos[tab.kind]} alt="" width="16" height="16" />
            <span className="doc-tab-name">{tab.name}</span>
          </button>
          <button type="button" className="doc-tab-close" aria-label={`Đóng ${tab.name}`} title={`Đóng tab (${closeKeys})`} onClick={() => onClose(tab.id)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="doc-tab-new" aria-label="Mở hoặc tạo tài liệu khác" title={`Mở hoặc tạo tài liệu khác (${mod}+T). Mở lại tab vừa đóng: ${mod}+Shift+T`} onClick={() => onSelect(null)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function DocumentTabs({ onEditing, children }: { onEditing: (editing: boolean) => void; children: ReactNode }) {
  const { user, ready } = useAccount();
  const uid = user?.uid ?? null;
  const storage = useWorkspace();
  const { toast } = useUi();
  const [state, setState] = useTabState(uid, ready);
  const handoffs = useRef(new Map<string, TabHandoff>());
  const apis = useRef(new Map<string, TabFrameApi>());
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const listeners = useRef(new Map<string, (ids: string[]) => void>());
  const closed = useRef<string[]>([]);
  const latestStorage = useRef(storage);
  latestStorage.current = storage;
  const latest = useRef(state);
  latest.current = state;
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const [lost, setLost] = useState<ReadonlySet<string>>(() => new Set());
  if (state.active && !loaded.has(state.active)) setLoaded(new Set(loaded).add(state.active));
  const homeVisible = state.active === null;
  const ids = useMemo(() => state.tabs.flatMap((tab) => (loaded.has(tab.id) ? [tab.id] : [])), [state.tabs, loaded]);
  const loadedIds = useRef(ids);
  loadedIds.current = ids;

  const markLost = (id: string, isLost: boolean) => setLost((current) => {
    if (current.has(id) === isLost) return current;
    const next = new Set(current);
    if (isLost) next.add(id); else next.delete(id);
    return next;
  });
  const frameLoaded = (id: string, frame: HTMLIFrameElement) => {
    const showsTab = frameShowsTab(frame, id);
    if (!showsTab) apis.current.delete(id);
    markLost(id, !showsTab);
  };
  const backToDocument = (id: string) => {
    const frame = frames.current.get(id);
    if (frame) frame.src = tabFrameUrl(id);
  };
  const drop = (id: string) => {
    markLost(id, false);
    handoffs.current.delete(id);
    apis.current.delete(id);
    listeners.current.delete(id);
    setLoaded((current) => { if (!current.has(id)) return current; const next = new Set(current); next.delete(id); return next; });
    setState((current) => withoutTab(current.tabs, id, current.active));
  };
  const open = (meta: FileMeta, content?: FileContent) => {
    if (content && !latest.current.tabs.some((tab) => tab.id === meta.id)) handoffs.current.set(meta.id, { meta, content });
    setState((current) => ({ tabs: withTab(current.tabs, tabFromMeta(meta)), active: meta.id }));
  };
  const close = async (id: string) => {
    const api = apis.current.get(id);
    if (api && !(await api.save().catch(() => false))) { toast(SAVE_FAILED, true); return false; }
    drop(id);
    closed.current = [...closed.current.filter((item) => item !== id), id].slice(-CLOSED_HISTORY);
    return true;
  };
  const reopen = () => {
    const isOpen = (id: string) => latest.current.tabs.some((tab) => tab.id === id);
    closed.current = closed.current.filter((id) => !isOpen(id));
    const id = closed.current.pop();
    if (!id) return false;
    void storage.listFiles().then((files) => {
      const meta = files.find((file) => file.id === id && !file.deletedAt);
      if (meta) open(meta);
      else toast(REOPEN_FAILED, true);
    });
    return true;
  };
  const runCommand = (command: TabCommand) => {
    const { tabs, active } = latest.current;
    const ids = tabs.map((tab) => tab.id);
    if (command.type === 'reopen') return reopen();
    if (!tabs.length) return false;
    if (command.type === 'cycle') { select(cycleTarget(ids, active, command.step)); return true; }
    if (command.type === 'home') { select(null); return true; }
    if (command.type === 'close') { if (active) void close(active); return active !== null; }
    const target = gotoTarget(ids, command.index);
    if (target === undefined) return false;
    select(target);
    return true;
  };
  const rename = (id: string, name: string) => {
    setState((current) => ({ ...current, tabs: current.tabs.map((tab) => (tab.id === id ? { ...tab, name } : tab)) }));
    apis.current.get(id)?.rename(name);
  };
  const select = (id: string | null) => setState((current) => ({ ...current, active: id }));

  const actions = useRef({ open, close, drop, select, toast, runCommand });
  actions.current = { open, close, drop, select, toast, runCommand };

  useEffect(() => {
    const host: TabHost = {
      take: (id) => handoffs.current.get(id),
      attach(id, api) {
        apis.current.set(id, api);
        handoffs.current.delete(id);
        return () => { if (apis.current.get(id) === api) apis.current.delete(id); };
      },
      open: (meta, content) => actions.current.open(meta, content),
      showHome: () => actions.current.select(null),
      command: (command) => actions.current.runCommand(command),
      fail(id, message) { actions.current.toast(message, true); actions.current.drop(id); },
      updateMeta(meta) {
        setState((current) => (current.tabs.some((tab) => tab.id === meta.id) ? { ...current, tabs: withTab(current.tabs, tabFromMeta(meta)) } : current));
      },
      openIds: () => loadedIds.current,
      subscribe(id, listener) {
        listeners.current.set(id, listener);
        return () => { if (listeners.current.get(id) === listener) listeners.current.delete(id); };
      },
      print: (request, frame) => printFrameDocument(request, frame),
      workspace: () => latestStorage.current,
    };
    return installTabHost(host);
  }, [setState]);

  useEffect(() => {
    syncedWorkspace(storage)?.setOpenFiles(ids);
    for (const [id, listener] of listeners.current) {
      try { listener(ids); } catch { listeners.current.delete(id); }
    }
  }, [ids, storage]);
  useEffect(() => () => { syncedWorkspace(storage)?.setOpenFiles([]); }, [storage]);

  useEffect(() => {
    const opened = (event: Event) => {
      const { uid: owner, id } = (event as CustomEvent<{ uid: string; id: string }>).detail;
      if (owner !== uid) return;
      void storage.listFiles().then((files) => {
        const meta = files.find((file) => file.id === id && !file.deletedAt);
        if (meta) actions.current.open(meta);
      });
    };
    window.addEventListener('office-open-saved', opened);
    return () => window.removeEventListener('office-open-saved', opened);
  }, [storage, uid]);

  useEffect(() => { onEditing(state.tabs.length > 0); }, [state.tabs.length, onEditing]);
  useEffect(() => () => onEditing(false), [onEditing]);

  const activeTab = state.tabs.find((tab) => tab.id === state.active) ?? null;
  const baseTitle = useRef(document.title);
  useEffect(() => {
    setFavicon(activeTab ? suiteLogos[activeTab.kind] : HOME_ICON);
    document.title = activeTab ? `${activeTab.name} - ${baseTitle.current}` : baseTitle.current;
  }, [activeTab]);
  useEffect(() => {
    if (state.active) frames.current.get(state.active)?.contentWindow?.focus();
    else if (document.activeElement === document.body || document.activeElement instanceof HTMLIFrameElement) document.querySelector<HTMLButtonElement>('.doc-tab-home .doc-tab-main')?.focus();
  }, [state.active]);

  useDocumentCloser(async (closeAll) => {
    for (const tab of latest.current.tabs) {
      const api = apis.current.get(tab.id);
      if (api && !(await api.save().catch(() => false))) return false;
    }
    if (closeAll) setState({ tabs: [], active: null });
    return true;
  });

  const api: TabsApi = {
    open,
    close,
    rename,
    isOpen: (id) => latest.current.tabs.some((tab) => tab.id === id),
    homeVisible,
  };

  return (
    <TabsContext value={api}>
      <div className={`workspace-frame ${state.tabs.length ? 'has-doc-tabs' : ''}`}>
        {state.tabs.length > 0 && <TabStrip state={state} onSelect={select} onClose={(id) => void close(id)} />}
        <div className="doc-stage">
          <div className="workspace-content" data-hidden={!homeVisible} inert={!homeVisible}>{children}</div>
          {state.tabs.filter((tab) => loaded.has(tab.id)).map((tab) => (
            <iframe
              key={tab.id}
              ref={(frame) => { if (frame) frames.current.set(tab.id, frame); else frames.current.delete(tab.id); }}
              className="doc-frame"
              src={tabFrameUrl(tab.id)}
              title={tab.name}
              data-active={state.active === tab.id}
              inert={state.active !== tab.id}
              allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; display-capture"
              onLoad={(event) => frameLoaded(tab.id, event.currentTarget)}
            />
          ))}
          {state.active && lost.has(state.active) && (
            <div className="doc-frame-lost" role="alert">
              <h2>Trang này không mở được trong tab</h2>
              <p>Tab vừa chuyển sang một trang khác nên bị chặn. Bấm Quay lại để mở lại tài liệu.</p>
              <div className="doc-frame-lost-actions">
                <button type="button" className="btn btn-doc" autoFocus onClick={() => backToDocument(state.active!)}>
                  <ArrowLeft size={16} aria-hidden="true" />Quay lại tài liệu
                </button>
                <button type="button" className="btn" onClick={() => void close(state.active!)}>Đóng tab</button>
              </div>
            </div>
          )}
        </div>
        {homeVisible && <WorkspaceStatus />}
      </div>
    </TabsContext>
  );
}
