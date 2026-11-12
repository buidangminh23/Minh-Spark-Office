import { createStore, delMany, get, getMany, keys, set, setMany } from 'idb-keyval';
import { parseWorkspaceBackup, type FileVersion, type WorkspaceStorage } from './storage';
import { RemoteConflictError, type PendingRecord, type RemoteRecord, type RemoteWorkspace, type SyncState, type SyncStateStore, type SyncStatus, type SyncedWorkspace } from './syncTypes';

type UploadMark = { generation: number; revision: string; editor?: boolean };
type Attempt = UploadMark;
type Blocked = { generation: number; message: string };
type EngineState = SyncState & { uploads?: Record<string, UploadMark>; attempts?: Record<string, Attempt>; blocked?: Record<string, Blocked> };

const LARGE_RECORD_BYTES = 1_000_000;
const LARGE_RECORD_DELAY_MS = 15_000;
const QUIET_FAILURES = 3;
const QUIET_FAILURE_WINDOW_MS = 45_000;
const QUOTA_RETRY_MS = 5 * 60_000;
const MAX_RETRY_MS = 60_000;
const PERMANENT_ERROR = /cloud\/payload-too-large|cloud\/invalid-data|cloud\/invalid-revision|cloud\/invalid-user|permission-denied/;
const RECORD_ERROR = /cloud\/payload-too-large|cloud\/invalid-data/;
const backoff = (failures: number) => Math.min(MAX_RETRY_MS, 2000 * 2 ** Math.min(Math.max(failures - 1, 0), 5)) + Math.floor(Math.random() * 1000);
const errorReason = (error: unknown) => {
  const rawCode = (error as { code?: unknown })?.code;
  return `${typeof rawCode === 'string' ? rawCode : ''} ${error instanceof Error ? error.message : ''}`.toLowerCase();
};
const kickChannel = (userId: string) => (typeof BroadcastChannel === 'undefined' ? null : `minh-office-sync:${userId}`);
const emptyState = (): SyncState => ({ bases: {}, pending: {}, generation: 0 });
const queues = new Map<string, Promise<unknown>>();

type StoredPending = Omit<PendingRecord, 'record'> & { record?: RemoteRecord; recordKey?: string };
type StoredState = Omit<SyncState, 'pending' | 'incoming'> & {
  pending: Record<string, StoredPending>;
  incoming?: Record<string, RemoteRecord | string>;
  records?: string[];
};

const STATE_KEY = 'state';
const RECORD_PREFIX = 'record:';
const recordKeys = new WeakMap<RemoteRecord, string>();
const keyFor = (record: RemoteRecord) => {
  let key = recordKeys.get(record);
  if (!key) {
    key = `${RECORD_PREFIX}${record.id}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    recordKeys.set(record, key);
  }
  return key;
};

export function createSyncStateStore(userId: string): SyncStateStore {
  if (!userId) throw new Error('Account sync requires a user ID.');
  const store = createStore(`minh-office-sync:${userId}`, 'outbox');
  const cache = new Map<string, RemoteRecord>();
  let swept = false;
  const resolve = async (keys: string[]) => {
    const missing = [...new Set(keys)].filter((key) => !cache.has(key));
    if (!missing.length) return;
    const loaded = await getMany<RemoteRecord | undefined>(missing, store);
    missing.forEach((key, index) => {
      const record = loaded[index];
      if (!record) return;
      recordKeys.set(record, key);
      cache.set(key, record);
    });
  };
  const cleanup = async (stale: string[], live: Set<string>) => {
    try {
      if (stale.length) await delMany(stale, store);
      if (swept) return;
      const orphans = (await keys(store)).filter((key): key is string => typeof key === 'string' && key.startsWith(RECORD_PREFIX) && !live.has(key));
      if (orphans.length) await delMany(orphans, store);
      swept = true;
    } catch (error) {
      console.warn('sync: unused outbox entries could not be removed yet', error);
    }
  };
  return {
    async read() {
      const stored = await get<StoredState>(STATE_KEY, store);
      if (!stored) return emptyState();
      await resolve([
        ...Object.values(stored.pending).flatMap((entry) => (!entry.record && entry.recordKey ? [entry.recordKey] : [])),
        ...Object.values(stored.incoming ?? {}).filter((entry): entry is string => typeof entry === 'string'),
      ]);
      const { records: referenced, incoming: storedIncoming, ...rest } = stored;
      const pending: Record<string, PendingRecord> = {};
      for (const [id, { recordKey, record, ...entry }] of Object.entries(stored.pending)) {
        const found = record ?? (recordKey ? cache.get(recordKey) : undefined);
        if (found) pending[id] = { ...entry, record: found };
        else console.warn(`sync: the queued change for ${id} is missing from the outbox and was skipped`);
      }
      const state: SyncState = { ...rest, pending };
      if (storedIncoming) {
        state.incoming = {};
        for (const [id, entry] of Object.entries(storedIncoming)) {
          const found = typeof entry === 'string' ? cache.get(entry) : entry;
          if (found) state.incoming[id] = found;
        }
      }
      if (referenced) {
        const live = new Set(referenced);
        for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
      }
      return state;
    },
    async write(state) {
      const records = new Map<string, RemoteRecord>();
      const pending: Record<string, StoredPending> = {};
      for (const [id, { record, ...entry }] of Object.entries(state.pending)) {
        const key = keyFor(record);
        records.set(key, record);
        pending[id] = { ...entry, recordKey: key };
      }
      const { incoming, ...rest } = state;
      const stored: StoredState = { ...rest, pending };
      if (incoming) {
        stored.incoming = {};
        for (const [id, record] of Object.entries(incoming)) {
          const key = keyFor(record);
          records.set(key, record);
          stored.incoming[id] = key;
        }
      }
      stored.records = [...records.keys()];
      const previous = (await get<StoredState>(STATE_KEY, store))?.records ?? [];
      const known = new Set(previous);
      const fresh = [...records].filter(([key]) => !known.has(key));
      if (fresh.length) await setMany(fresh.map(([key, record]) => [key, structuredClone(record)]), store);
      await set(STATE_KEY, stored, store);
      cache.clear();
      for (const [key, record] of records) cache.set(key, record);
      await cleanup(previous.filter((key) => !records.has(key)), new Set(records.keys()));
    },
  };
}

async function locked<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(key, operation);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  queues.set(key, next);
  try { return await next; }
  finally { if (queues.get(key) === next) queues.delete(key); }
}

const normalized = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]));
  return value;
};
const sameRecord = (a: RemoteRecord, b: RemoteRecord) => JSON.stringify(normalized({ ...a, revision: '' })) === JSON.stringify(normalized({ ...b, revision: '' }));
const uniqueId = () => globalThis.crypto?.randomUUID?.() ?? `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const conflictCopy = (record: RemoteRecord): RemoteRecord => {
  const copy = structuredClone(record);
  copy.id = uniqueId();
  copy.revision = '';
  copy.meta = { ...copy.meta!, id: copy.id, name: `${copy.meta!.name} (bản xung đột ${new Date().toLocaleString('vi-VN')})` };
  copy.versions = copy.versions.map((version) => ({ ...version, fileId: copy.id }));
  return copy;
};
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function createSyncedWorkspace(userId: string, local: WorkspaceStorage, remote: RemoteWorkspace, stateStore: SyncStateStore): SyncedWorkspace {
  if (!userId) throw new Error('Account sync requires a user ID.');
  const localLock = `minh-office-local:${userId}`;
  const listeners = new Set<() => void>();
  let status: SyncStatus = { state: 'connecting', pending: 0 };
  let initialized = false;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let releaseRemote: (() => void) | undefined;
  let startCount = 0;
  let epoch = 0;
  let conflictMessage: string | undefined;
  let activeId: string | null = null;
  let activeBase: string | null | undefined;
  let activeGeneration: number | null | undefined;
  const ownGenerations = new Set<number>();
  const deferred = new Set<string>();
  const heldElsewhere = new Set<string>();
  let failures = 0;
  let firstFailureAt = 0;
  let subscribeFailures = 0;
  let resubscribeTimer: ReturnType<typeof setTimeout> | undefined;
  let kickListener: BroadcastChannel | undefined;
  let kickSender: BroadcastChannel | undefined;
  const channelName = kickChannel(userId);
  const kickOthers = (delay: number) => {
    if (!channelName) return;
    try {
      if (!kickSender) {
        kickSender = new BroadcastChannel(channelName);
        (kickSender as unknown as { unref?: () => void }).unref?.();
      }
      kickSender.postMessage(delay);
    } catch {
      kickSender = undefined;
    }
  };
  const holds = (id: string) => id === activeId || heldElsewhere.has(id);
  const emit = () => {
    for (const listener of listeners) {
      try { listener(); } catch { listeners.delete(listener); }
    }
  };
  const setStatus = (state: SyncStatus['state'], pending = status.pending, message?: string) => {
    status = { state, pending, message };
    emit();
  };
  const schedule = (delay = 1500) => {
    if (!startCount) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void syncNow(); }, delay);
  };
  const apply = async (record: RemoteRecord) => {
    if (record.deleted || !record.meta) await local.removeFile(record.id);
    else await local.replaceFile(record.meta, record.content, record.versions);
  };
  const snapshot = async (id: string): Promise<RemoteRecord> => ({
    id, meta: (await local.listFiles()).find((file) => file.id === id) ?? null,
    content: await local.loadContent(id), versions: await local.listVersions(id), deleted: false, revision: '',
  });
  const enqueue = async (state: SyncState, record: RemoteRecord) => {
    const previous = state.pending[record.id];
    let preserved: RemoteRecord | undefined;
    const fromAnotherEditor = previous?.editor !== false;
    if (activeId === record.id && previous && fromAnotherEditor && activeGeneration !== undefined && previous.generation !== activeGeneration && !previous.record.deleted && previous.record.meta && !sameRecord(previous.record, record)) {
      preserved = conflictCopy(previous.record);
      state.pending[preserved.id] = { generation: ++state.generation, record: preserved, baseRevision: null };
      conflictMessage = 'Đã giữ thay đổi từ thẻ trình duyệt khác trong bản xung đột riêng.';
    }
    const upload = (state as EngineState).uploads?.[record.id];
    if (activeId === record.id && upload && (ownGenerations.has(upload.generation) || (upload.editor === false && upload.revision === state.bases[record.id]))) activeBase = upload.revision;
    const anotherEditor = previous && fromAnotherEditor && activeGeneration !== undefined && previous.generation !== activeGeneration;
    const baseRevision = activeId === record.id && activeBase !== undefined && (!previous || anotherEditor) ? activeBase : previous?.baseRevision !== undefined ? previous.baseRevision : state.bases[record.id] ?? null;
    state.pending[record.id] = { generation: ++state.generation, record: structuredClone(record), baseRevision, editor: activeId === record.id };
    if (activeId === record.id) { activeGeneration = state.generation; ownGenerations.add(state.generation); }
    await stateStore.write(state);
    if (preserved) await apply(preserved);
    await apply(record);
    setStatus(isOffline() ? 'offline' : 'syncing', Object.keys(state.pending).length);
    const delay = (record.meta?.size ?? 0) > LARGE_RECORD_BYTES ? LARGE_RECORD_DELAY_MS : 1500;
    schedule(delay);
    kickOthers(delay);
  };
  const adoptOwnCommit = async (state: SyncState, id: string, attempt: Attempt) => {
    const engine = state as EngineState;
    state.bases[id] = attempt.revision;
    (engine.uploads ??= {})[id] = attempt;
    if (state.pending[id]?.generation === attempt.generation) delete state.pending[id];
    else if (state.pending[id]) state.pending[id].baseRevision = attempt.revision;
    if (engine.attempts) delete engine.attempts[id];
    if (activeId === id) activeBase = attempt.revision;
    deferred.delete(id);
    await stateStore.write(state);
  };
  const initialize = async () => {
    const state = await stateStore.read();
    for (const record of Object.values(state.incoming ?? {})) await apply(record);
    if (Object.keys(state.incoming ?? {}).length) {
      state.incoming = {};
      await stateStore.write(state);
    }
    if (initialized) return;
    state.incoming = {};
    for (const entry of Object.values(state.pending)) await apply(entry.record);
    for (const file of await local.listFiles()) {
      if (state.bases[file.id] || state.pending[file.id]) continue;
      state.pending[file.id] = { generation: ++state.generation, record: await snapshot(file.id) };
    }
    await stateStore.write(state);
    initialized = true;
    status = { ...status, pending: Object.keys(state.pending).length };
  };
  const mutate = <T>(operation: (state: SyncState) => Promise<T>) => locked(localLock, async () => {
    await initialize();
    return operation(await stateStore.read());
  });
  const readLocal = <T>(operation: () => Promise<T>) => locked(localLock, async () => { await initialize(); return operation(); });
  const resolveConflict = async (state: SyncState, id: string, current: RemoteRecord | null) => {
    const pending = state.pending[id];
    if (!pending) return;
    if (current && sameRecord(pending.record, current)) {
      state.bases[id] = current.revision;
      delete state.pending[id];
      await stateStore.write(state);
      return;
    }
    if (!pending.record.deleted && pending.record.meta) {
      const copy = conflictCopy(pending.record);
      state.pending[copy.id] = { generation: ++state.generation, record: copy, baseRevision: null };
    }
    delete state.pending[id];
    if (current) state.bases[id] = current.revision;
    else delete state.bases[id];
    state.incoming ??= {};
    state.incoming[id] = current ?? { id, meta: null, content: undefined, versions: [], deleted: true, revision: '' };
    await stateStore.write(state);
    for (const entry of Object.values(state.pending)) await apply(entry.record);
    if (current) await apply(current);
    else await local.removeFile(id);
    delete state.incoming[id];
    await stateStore.write(state);
    conflictMessage = 'Đã giữ các thay đổi khác nhau trong bản xung đột. Nếu tệp vừa được sửa trên thiết bị khác, thao tác xóa được bỏ qua.';
    emit();
  };
  const describe = (reason: string) => {
    const offline = isOffline() || /unavailable|network|deadline-exceeded|failed to fetch|fetch failed|client is offline/.test(reason);
    let message = 'Chưa thể đồng bộ tài liệu. Các thay đổi vẫn được giữ trên máy; ứng dụng sẽ thử lại.';
    if (reason.includes('cloud/payload-too-large')) {
      message = 'Tài liệu này lớn hơn mức trình duyệt xử lý được khi đồng bộ (trên 512 MiB dữ liệu hoặc 256 MiB sau nén). Bản lưu trên máy vẫn được giữ nguyên; hãy tách bớt nội dung hoặc lịch sử phiên bản rồi thử lại.';
    } else if (/cloud\/account-changed|unauthenticated|auth\/user-token-expired|auth\/invalid-user-token/.test(reason)) {
      message = 'Phiên đăng nhập đã thay đổi hoặc hết hạn. Hãy đăng nhập lại đúng tài khoản để tiếp tục đồng bộ; các thay đổi vẫn được giữ trên máy.';
    } else if (/cloud\/invalid-data|cloud\/invalid-revision|cloud\/invalid-user/.test(reason)) {
      message = 'Dữ liệu đồng bộ không hợp lệ hoặc đã hỏng. Ứng dụng chưa áp dụng dữ liệu này; các bản lưu trên máy vẫn được giữ nguyên.';
    } else if (reason.includes('permission-denied')) {
      message = 'Tài khoản hiện tại chưa có quyền đồng bộ kho tài liệu này. Hãy kiểm tra tài khoản đăng nhập; các thay đổi vẫn được giữ trên máy.';
    } else if (reason.includes('resource-exhausted')) {
      message = 'Hạn mức đồng bộ tạm thời đã hết. Các thay đổi vẫn được giữ trên máy và sẽ được thử lại khi dịch vụ cho phép.';
    } else if (offline) {
      message = 'Chưa kết nối được với dịch vụ đồng bộ. Các thay đổi vẫn được giữ trên máy và sẽ được thử lại khi có mạng.';
    } else if (reason.includes('aborted')) {
      message = 'Tài liệu đang được cập nhật trên thiết bị khác. Các thay đổi vẫn được giữ trên máy; ứng dụng sẽ thử đồng bộ lại.';
    }
    return { offline, message };
  };
  const fail = (error: unknown) => {
    const reason = errorReason(error);
    const { offline, message } = describe(reason);
    failures++;
    firstFailureAt ||= Date.now();
    const quota = reason.includes('resource-exhausted');
    const visible = PERMANENT_ERROR.test(reason) || quota || failures >= QUIET_FAILURES || Date.now() - firstFailureAt >= QUIET_FAILURE_WINDOW_MS;
    if (visible) setStatus(offline ? 'offline' : 'error', status.pending, message);
    else setStatus('syncing', status.pending);
    schedule(quota ? QUOTA_RETRY_MS : backoff(failures));
  };
  const recovered = () => {
    failures = 0;
    firstFailureAt = 0;
  };
  const pass = async (token: number) => {
    await mutate(async (state) => { setStatus('syncing', Object.keys(state.pending).length); });
    if (isOffline()) { setStatus('offline'); return; }
    const manifests = await remote.list();
    if (token !== epoch) return;
    const failedIds = new Set<string>();
    let lastError: unknown;
    for (const manifest of manifests) {
      const needsRead = await mutate(async (state) => {
        if (state.bases[manifest.id] === manifest.revision) return false;
        const attempt = (state as EngineState).attempts?.[manifest.id];
        if (attempt && attempt.revision === manifest.revision) { await adoptOwnCommit(state, manifest.id, attempt); return false; }
        return true;
      });
      if (!needsRead) continue;
      if (holds(manifest.id)) { deferred.add(manifest.id); continue; }
      let record: RemoteRecord | null;
      try { record = await remote.read(manifest.id); }
      catch (error) { if (token !== epoch) return; failedIds.add(manifest.id); lastError = error; continue; }
      if (token !== epoch) return;
      if (!record) continue;
      await mutate(async (state) => {
        if (holds(record.id)) { deferred.add(record.id); return; }
        if (state.pending[record.id]) await resolveConflict(state, record.id, record);
        else {
          state.bases[record.id] = record.revision;
          state.incoming ??= {};
          state.incoming[record.id] = record;
          await stateStore.write(state);
          await apply(record);
          delete state.incoming[record.id];
          await stateStore.write(state);
          emit();
        }
      });
    }
    for (let batch = 0; batch < 5; batch++) {
      const pending = await mutate(async (state) => Object.fromEntries(Object.entries(state.pending).map(([id, entry]) => [id, { ...entry }])));
      if (!Object.keys(pending).length) break;
      for (const [id, entry] of Object.entries(pending)) {
        if (token !== epoch) return;
        if (failedIds.has(id)) continue;
        if (holds(id) && deferred.has(id)) continue;
        const prepared = await mutate(async (state) => {
          const engine = state as EngineState;
          if (engine.blocked?.[id]?.generation === entry.generation) return null;
          const previous = engine.attempts?.[id];
          const attempt: Attempt = previous?.generation === entry.generation ? previous : { generation: entry.generation, revision: uniqueId(), editor: entry.editor };
          if (attempt !== previous) {
            (engine.attempts ??= {})[id] = attempt;
            await stateStore.write(state);
          }
          return { attempt, base: entry.baseRevision !== undefined ? entry.baseRevision : state.bases[id] ?? null };
        });
        if (!prepared) continue;
        try {
          const revision = await remote.write(entry.record, prepared.base, prepared.attempt.revision);
          if (token !== epoch) return;
          await mutate((state) => adoptOwnCommit(state, id, { ...prepared.attempt, revision }));
        } catch (error) {
          if (token !== epoch) return;
          if (error instanceof RemoteConflictError && error.current?.revision === prepared.attempt.revision) {
            await mutate((state) => adoptOwnCommit(state, id, prepared.attempt));
            continue;
          }
          if (!(error instanceof RemoteConflictError)) {
            failedIds.add(id);
            const reason = errorReason(error);
            if (RECORD_ERROR.test(reason)) await mutate(async (state) => {
              ((state as EngineState).blocked ??= {})[id] = { generation: entry.generation, message: describe(reason).message };
              await stateStore.write(state);
            });
            else lastError = error;
            continue;
          }
          if (holds(id)) { deferred.add(id); continue; }
          await mutate((state) => resolveConflict(state, id, error.current));
        }
      }
    }
    await mutate(async (state) => {
      const engine = state as EngineState;
      const count = Object.keys(state.pending).length;
      if (token !== epoch) return;
      const blocked = Object.entries(state.pending).flatMap(([id, entry]) => {
        const mark = engine.blocked?.[id];
        return mark && mark.generation === entry.generation ? [mark] : [];
      });
      if (lastError) {
        status = { ...status, pending: count };
        fail(lastError);
        return;
      }
      recovered();
      const actionable = Object.entries(state.pending).filter(([id, entry]) => !(holds(id) && deferred.has(id)) && engine.blocked?.[id]?.generation !== entry.generation).length;
      const waiting = (activeId !== null && deferred.has(activeId)) || Object.keys(state.pending).some((id) => holds(id) && deferred.has(id));
      const message = blocked[0]?.message ?? (waiting ? 'Tài liệu đã thay đổi trên thiết bị khác. Đóng tài liệu để lưu bản xung đột riêng.' : conflictMessage);
      setStatus(blocked.length || waiting ? 'error' : count ? 'syncing' : 'synced', count, message);
      if (actionable) schedule();
    });
  };
  function syncNow(): Promise<void> {
    if (running) return running;
    if (timer) clearTimeout(timer);
    timer = undefined;
    const token = epoch;
    running = locked(`minh-office-sync-pass:${userId}`, async () => {
      if (token !== epoch) return;
      try { await pass(token); }
      catch (error) { if (token === epoch) fail(error); }
    }).finally(() => {
      running = undefined;
      if (token !== epoch && startCount) schedule(0);
    });
    return running;
  }
  function subscribeRemote() {
    releaseRemote?.();
    releaseRemote = undefined;
    let dead = false;
    let stop: (() => void) | undefined;
    stop = remote.subscribe(() => { subscribeFailures = 0; schedule(); }, (error) => {
      if (dead) return;
      dead = true;
      stop?.();
      if (releaseRemote === stop) releaseRemote = undefined;
      if (!startCount) return;
      fail(error);
      if (resubscribeTimer) clearTimeout(resubscribeTimer);
      resubscribeTimer = setTimeout(() => { resubscribeTimer = undefined; if (startCount) subscribeRemote(); }, backoff(++subscribeFailures));
    });
    if (!dead) releaseRemote = stop;
  }
  const onOnline = () => { if (!releaseRemote && startCount) subscribeRemote(); schedule(0); };
  const onOffline = () => setStatus('offline');
  return {
    listFiles: () => readLocal(() => local.listFiles()),
    loadContent: (id) => readLocal(() => local.loadContent(id)),
    listVersions: (id) => readLocal(() => local.listVersions(id)),
    exportBackup: () => readLocal(() => local.exportBackup()),
    async saveFile(meta, content) {
      const input = structuredClone({ meta, content });
      await mutate(async (state) => {
        const record = await snapshot(input.meta.id);
        const stored = record.meta;
        record.meta = stored ? { ...input.meta, starred: stored.starred, deletedAt: stored.deletedAt, openedAt: Math.max(stored.openedAt, input.meta.openedAt) } : input.meta;
        if (input.content !== undefined) record.content = input.content;
        await enqueue(state, record);
      });
    },
    async replaceFile(meta, content, versions) {
      const input = structuredClone({ meta, content, versions });
      await mutate((state) => enqueue(state, { id: input.meta.id, ...input, deleted: false, revision: '' }));
    },
    async updateMeta(id, patch) {
      const input = structuredClone(patch);
      if (Object.keys(input).every((key) => key === 'openedAt')) return readLocal(() => local.updateMeta(id, input));
      return mutate(async (state) => {
        const record = await snapshot(id);
        if (!record.meta) return null;
        record.meta = { ...record.meta, ...input, id };
        await enqueue(state, record);
        return record.meta;
      });
    },
    async removeFile(id) {
      await mutate((state) => enqueue(state, { id, meta: null, content: undefined, versions: [], deleted: true, revision: '' }));
    },
    async saveVersion(fileId, content, label) {
      const input = structuredClone(content);
      return mutate(async (state) => {
        const record = await snapshot(fileId);
        if (!record.meta) throw new Error('Tài liệu không còn tồn tại.');
        const timestamp = Date.now();
        const version: FileVersion = { id: `v_${uniqueId()}`, fileId, content: input, timestamp, label: label || `Bản lưu ${new Date(timestamp).toLocaleString('vi-VN')}` };
        record.versions = [version, ...record.versions].slice(0, 30);
        await enqueue(state, record);
        return version;
      });
    },
    async restoreVersion(fileId, versionId) {
      return mutate(async (state) => {
        const record = await snapshot(fileId);
        const version = record.versions.find((item) => item.id === versionId);
        if (!record.meta || !version) return null;
        record.content = version.content;
        record.meta.updatedAt = Date.now();
        await enqueue(state, record);
        return version.content;
      });
    },
    async deleteVersion(fileId, versionId) {
      await mutate(async (state) => {
        const record = await snapshot(fileId);
        if (!record.meta) return;
        record.versions = record.versions.filter((item) => item.id !== versionId);
        await enqueue(state, record);
      });
    },
    async importBackup(payload) {
      const data = parseWorkspaceBackup(payload);
      return mutate(async (state) => {
        const ids = new Set((await local.listFiles()).map((file) => file.id));
        let count = 0;
        for (const meta of data.files) {
          const content = data.contents?.[meta.id];
          if (ids.has(meta.id) || !content) continue;
          await enqueue(state, { id: meta.id, meta, content, versions: data.versions?.[meta.id] ?? [], deleted: false, revision: '' });
          ids.add(meta.id);
          count++;
        }
        return count;
      });
    },
    start() {
      if (++startCount === 1) {
        subscribeRemote();
        if (channelName) {
          try {
            kickListener = new BroadcastChannel(channelName);
            kickListener.onmessage = (event: MessageEvent) => { if (!timer) schedule(typeof event.data === 'number' ? event.data : 1500); };
            (kickListener as unknown as { unref?: () => void }).unref?.();
          } catch {
            kickListener = undefined;
          }
        }
        globalThis.addEventListener?.('online', onOnline);
        globalThis.addEventListener?.('offline', onOffline);
        schedule(0);
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        if (--startCount) return;
        epoch++;
        releaseRemote?.();
        releaseRemote = undefined;
        if (resubscribeTimer) clearTimeout(resubscribeTimer);
        resubscribeTimer = undefined;
        kickListener?.close();
        kickListener = undefined;
        recovered();
        status = { state: 'connecting', pending: status.pending };
        if (timer) clearTimeout(timer);
        timer = undefined;
        globalThis.removeEventListener?.('online', onOnline);
        globalThis.removeEventListener?.('offline', onOffline);
      };
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getStatus: () => status,
    syncNow,
    setActiveFile(id) {
      if (activeId === id) return;
      activeId = id;
      activeBase = undefined;
      activeGeneration = undefined;
      ownGenerations.clear();
      if (id) void mutate(async (state) => {
        if (activeId !== id) return;
        activeBase = state.pending[id]?.baseRevision !== undefined ? state.pending[id].baseRevision : state.bases[id] ?? null;
        activeGeneration = state.pending[id]?.generation ?? null;
        if (activeGeneration !== null) ownGenerations.add(activeGeneration);
      }).catch(fail);
      for (const fileId of deferred) if (!holds(fileId)) deferred.delete(fileId);
      schedule(0);
    },
    setOpenFiles(ids) {
      const next = new Set(ids);
      if (next.size === heldElsewhere.size && [...next].every((id) => heldElsewhere.has(id))) return;
      heldElsewhere.clear();
      for (const id of next) heldElsewhere.add(id);
      for (const fileId of deferred) if (!holds(fileId)) deferred.delete(fileId);
      schedule(0);
    },
  };
}
