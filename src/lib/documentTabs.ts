import type { FileContent, FileKind, FileMeta } from './storage';
import type { NativePrintRequest, PrintResult } from './print/printRun';

export const TAB_PARAM = 'officeTab';
const HOST_KEY = '__minhOfficeTabs';

export type DocumentTab = { id: string; kind: FileKind; name: string };
export type TabHandoff = { meta: FileMeta; content: FileContent };
export type TabSession = { ids: string[]; active: string | null };
export type TabCycleStep = 1 | -1;
export type TabCommand =
  | { type: 'cycle'; step: TabCycleStep }
  | { type: 'goto'; index: number | 'last' }
  | { type: 'close' }
  | { type: 'reopen' }
  | { type: 'home' };
export type ShortcutPlatform = { mac: boolean; desktop: boolean };
type ShortcutKey = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;

const DIGIT_CODE = /^Digit([1-9])$/;
const LAST_TAB_DIGIT = 9;

export type TabFrameApi = {
  save(): Promise<boolean>;
  rename(name: string): void;
};

export type TabHost = {
  take(id: string): TabHandoff | undefined;
  attach(id: string, api: TabFrameApi): () => void;
  open(meta: FileMeta, content: FileContent): void;
  showHome(): void;
  command(command: TabCommand): boolean;
  fail(id: string, message: string): void;
  updateMeta(meta: FileMeta): void;
  openIds(): string[];
  subscribe(id: string, listener: (ids: string[]) => void): () => void;
  print(request: NativePrintRequest, frame: Window): Promise<PrintResult>;
  workspace(): unknown;
};

export function tabFrameId(win: Window = window): string | null {
  if (win.parent === win) return null;
  return new URLSearchParams(win.location.search).get(TAB_PARAM);
}

export function tabHost(win: Window = window): TabHost | null {
  if (win.parent === win) return null;
  try {
    return ((win.parent as unknown as Record<string, unknown>)[HOST_KEY] as TabHost | undefined) ?? null;
  } catch {
    return null;
  }
}

function ownTabHost(win: Window): TabHost | null {
  return ((win as unknown as Record<string, unknown>)[HOST_KEY] as TabHost | undefined) ?? null;
}

export function shortcutPlatform(win: Window = window): ShortcutPlatform {
  const nav = win.navigator;
  const mac = /Mac|iPhone|iPad/i.test(nav.platform || nav.userAgent);
  return { mac, desktop: '__TAURI_INTERNALS__' in win };
}

export const tabModifierLabel = (platform: ShortcutPlatform) => (platform.mac ? 'Ctrl' : 'Alt');

function tabModifierOnly(event: ShortcutKey, mac: boolean, shift: boolean) {
  if (event.metaKey || event.shiftKey !== shift) return false;
  return mac ? event.ctrlKey && !event.altKey : event.altKey && !event.ctrlKey;
}

function desktopCtrlCommand(event: ShortcutKey): TabCommand | null {
  if (!event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.key === 'Tab') return { type: 'cycle', step: event.shiftKey ? -1 : 1 };
  if (event.code === 'KeyW' && !event.shiftKey) return { type: 'close' };
  return null;
}

export function tabShortcut(event: ShortcutKey, platform: ShortcutPlatform): TabCommand | null {
  if (event.ctrlKey && !event.altKey && !event.metaKey && event.key === 'Tab') return { type: 'cycle', step: event.shiftKey ? -1 : 1 };
  if (platform.desktop) {
    const command = desktopCtrlCommand(event);
    if (command) return command;
  }
  if (tabModifierOnly(event, platform.mac, true)) return event.code === 'KeyT' ? { type: 'reopen' } : null;
  if (!tabModifierOnly(event, platform.mac, false)) return null;
  if (event.code === 'BracketRight') return { type: 'cycle', step: 1 };
  if (event.code === 'BracketLeft') return { type: 'cycle', step: -1 };
  if (event.code === 'KeyW') return { type: 'close' };
  if (event.code === 'KeyT') return { type: 'home' };
  const digit = DIGIT_CODE.exec(event.code);
  if (!digit) return null;
  const position = Number(digit[1]);
  return { type: 'goto', index: position === LAST_TAB_DIGIT ? 'last' : position - 1 };
}

export function cycleTarget(tabIds: readonly string[], active: string | null, step: TabCycleStep): string | null {
  const order: (string | null)[] = [null, ...tabIds];
  const index = Math.max(0, order.indexOf(active));
  return order[(index + step + order.length) % order.length] ?? null;
}

export function gotoTarget(tabIds: readonly string[], index: number | 'last'): string | null | undefined {
  const order: (string | null)[] = [null, ...tabIds];
  return index === 'last' ? order[order.length - 1] : index < order.length ? order[index] : undefined;
}

export function installTabShortcuts(win: Window = window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const command = tabShortcut(event, shortcutPlatform(win));
    if (!command) return;
    const host = win.parent === win ? ownTabHost(win) : tabHost(win);
    if (!host?.command(command)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  win.addEventListener('keydown', onKeyDown, true);
  return () => win.removeEventListener('keydown', onKeyDown, true);
}

export function installTabHost(host: TabHost, win: Window = window): () => void {
  const slot = win as unknown as Record<string, unknown>;
  slot[HOST_KEY] = host;
  return () => { if (slot[HOST_KEY] === host) delete slot[HOST_KEY]; };
}

export function tabFrameUrl(id: string, location: Pick<Location, 'pathname'> = window.location): string {
  return `${location.pathname}?${TAB_PARAM}=${encodeURIComponent(id)}`;
}

export const tabSessionKey = (uid: string | null | undefined) => `minh-office-tabs:${uid ?? 'drafts'}`;
export const legacyOpenKey = (uid: string | null | undefined) => `minh-office-open:${uid ?? 'drafts'}`;

export function parseTabSession(raw: string | null, legacy: string | null = null): TabSession {
  const session: TabSession = { ids: [], active: null };
  if (raw) {
    try {
      const value = JSON.parse(raw) as Partial<TabSession>;
      if (Array.isArray(value.ids)) session.ids = [...new Set(value.ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
      if (typeof value.active === 'string' && session.ids.includes(value.active)) session.active = value.active;
    } catch {
      return { ids: legacy ? [legacy] : [], active: legacy };
    }
  }
  if (legacy && !session.ids.includes(legacy)) {
    session.ids.push(legacy);
    session.active ??= legacy;
  }
  return session;
}

const NO_STORAGE: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

export function tabSessionStorage(win: Window = window): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    return '__TAURI_INTERNALS__' in win ? win.localStorage : win.sessionStorage;
  } catch {
    return NO_STORAGE;
  }
}

export function readTabSession(uid: string | null | undefined, storage: Pick<Storage, 'getItem'> = tabSessionStorage()): TabSession {
  try {
    return parseTabSession(storage.getItem(tabSessionKey(uid)), storage.getItem(legacyOpenKey(uid)));
  } catch {
    return { ids: [], active: null };
  }
}

export function writeTabSession(uid: string | null | undefined, session: TabSession, storage: Pick<Storage, 'setItem' | 'removeItem'> = tabSessionStorage()) {
  try {
    storage.setItem(tabSessionKey(uid), JSON.stringify(session));
    storage.removeItem(legacyOpenKey(uid));
  } catch {
    return;
  }
}

export function addToTabSession(uid: string | null | undefined, id: string, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = tabSessionStorage()) {
  const session = readTabSession(uid, storage);
  if (!session.ids.includes(id)) session.ids.push(id);
  session.active = id;
  writeTabSession(uid, session, storage);
}

export function withTab(tabs: readonly DocumentTab[], tab: DocumentTab): DocumentTab[] {
  return tabs.some((item) => item.id === tab.id) ? tabs.map((item) => (item.id === tab.id ? { ...item, ...tab } : item)) : [...tabs, tab];
}

export function withoutTab(tabs: readonly DocumentTab[], id: string, active: string | null): { tabs: DocumentTab[]; active: string | null } {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return { tabs: [...tabs], active };
  const next = tabs.filter((tab) => tab.id !== id);
  if (active !== id) return { tabs: next, active };
  const neighbour = next[index] ?? next[index - 1] ?? null;
  return { tabs: next, active: neighbour?.id ?? null };
}

export function tabFromMeta(meta: Pick<FileMeta, 'id' | 'kind' | 'name'>): DocumentTab {
  return { id: meta.id, kind: meta.kind, name: meta.name };
}
