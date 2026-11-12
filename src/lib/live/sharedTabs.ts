import type { FileMeta } from '../storage';
import type { TeamItem } from '../teams';

const PREFIX = 'team.';
const PATTERN = /^team\.([A-Za-z0-9_-]{20})\.([A-Za-z0-9_-]{20})$/;

export function sharedTabId(teamId: string, itemId: string) {
  return `${PREFIX}${teamId}.${itemId}`;
}

export function parseSharedTabId(id: string | null | undefined) {
  const match = PATTERN.exec(id ?? '');
  return match ? { teamId: match[1], itemId: match[2] } : null;
}

export function isSharedTabId(id: string | null | undefined) {
  return Boolean(parseSharedTabId(id));
}

export function sharedMeta(item: Pick<TeamItem, 'teamId' | 'id' | 'kind' | 'name' | 'createdAt' | 'updatedAt' | 'size' | 'preview'>): FileMeta {
  return {
    id: sharedTabId(item.teamId, item.id),
    name: item.name,
    kind: item.kind,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    openedAt: Date.now(),
    starred: false,
    deletedAt: null,
    size: item.size,
    preview: item.preview.slice(0, 160),
  };
}

export function pickLeader(peerIds: readonly string[]) {
  return [...peerIds].sort()[0] ?? null;
}

const META_KEY = 'office.sharedTab.';

export function rememberSharedMeta(meta: FileMeta) {
  try { localStorage.setItem(META_KEY + meta.id, JSON.stringify({ name: meta.name, kind: meta.kind })); } catch { return; }
}

export function restoredSharedMeta(id: string): FileMeta | null {
  if (!isSharedTabId(id)) return null;
  let saved: { name?: unknown; kind?: unknown } = {};
  try { saved = JSON.parse(localStorage.getItem(META_KEY + id) ?? '{}'); } catch { saved = {}; }
  const kind = saved.kind === 'sheet' || saved.kind === 'slide' ? saved.kind : 'doc';
  const name = typeof saved.name === 'string' && saved.name.trim() ? saved.name : 'Tài liệu chung';
  const now = Date.now();
  return { id, name, kind, createdAt: now, updatedAt: now, openedAt: now, starred: false, deletedAt: null, size: 0, preview: '' };
}
