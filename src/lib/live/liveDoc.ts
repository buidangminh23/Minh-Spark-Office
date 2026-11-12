import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, Timestamp, writeBatch, type Firestore } from 'firebase/firestore';
import type { LivePeer, PeerMesh } from './peerMesh';
import { MAX_CHUNKS } from '../cloudCodec';

export const CHANNEL_SYNC = 0;
export const CHANNEL_AWARENESS = 1;
export const CHANNEL_APP = 2;

const CHUNK_CHARS = 600_000;
const CHUNK_BATCH = 8;
const LOCK_STALE_MS = 60_000;
const ORIGIN_REMOTE = 'live-remote';
const ORIGIN_PERSIST = 'live-persist';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'readonly';
export type OpenResult = 'loaded' | 'seed' | 'wait';

export function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function fromBase64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function splitChunks(text: string, size = CHUNK_CHARS) {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += size) chunks.push(text.slice(start, start + size));
  return chunks.length ? chunks : [''];
}

class StaleHead extends Error {}

export function createLiveDocument(db: Firestore, path: { teamId: string; itemId: string }, mesh: PeerMesh, options: { canWrite: boolean; userName: string; uid: string }) {
  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);
  const itemPath = ['teams', path.teamId, 'items', path.itemId] as const;
  const headRef = doc(db, ...itemPath, 'live', 'head');
  const lockRef = doc(db, ...itemPath, 'live', 'lock');
  const chunkRef = (revision: string, index: number) => doc(db, ...itemPath, 'liveChunks', `${revision}_${index}`);
  const stateListeners = new Set<(state: SaveState, savedAt: number) => void>();
  const appListeners = new Set<(message: unknown, from: LivePeer) => void>();
  const stops: Array<() => void> = [];
  let baseRevision: string | null = null;
  let localDirty = false;
  let anyDirty = false;
  let dirtySince = 0;
  let saving: Promise<void> | null = null;
  let state: SaveState = options.canWrite ? 'saved' : 'readonly';
  let savedAt = Date.now();
  let destroyed = false;

  const setState = (next: SaveState) => {
    state = options.canWrite ? next : 'readonly';
    stateListeners.forEach((listener) => listener(state, savedAt));
  };

  const readHead = async () => {
    const snapshot = await getDoc(headRef);
    const data = snapshot.data();
    if (!data || typeof data.revision !== 'string') return null;
    return { revision: data.revision, chunkCount: Number(data.chunkCount) || 0, updatedBy: String(data.updatedBy ?? '') };
  };

  const applyHead = async (head: { revision: string; chunkCount: number }) => {
    const parts: string[] = [];
    for (let index = 0; index < head.chunkCount; index++) {
      const chunk = await getDoc(chunkRef(head.revision, index));
      const data = chunk.data();
      if (!data || typeof data.data !== 'string') throw new Error('live/missing-chunk');
      parts.push(data.data);
    }
    Y.applyUpdate(ydoc, fromBase64(parts.join('')), ORIGIN_PERSIST);
    baseRevision = head.revision;
  };

  const writeChunks = async (revision: string, chunks: string[]) => {
    for (let start = 0; start < chunks.length; start += CHUNK_BATCH) {
      const batch = writeBatch(db);
      chunks.slice(start, start + CHUNK_BATCH).forEach((data, offset) => batch.set(chunkRef(revision, start + offset), { revision, index: start + offset, data }));
      await batch.commit();
    }
  };

  const deleteChunks = async (revision: string, count: number) => {
    const batch = writeBatch(db);
    for (let index = 0; index < count; index++) batch.delete(chunkRef(revision, index));
    await batch.commit().catch(() => undefined);
  };

  const persistOnce = async () => {
    const encoded = toBase64(Y.encodeStateAsUpdate(ydoc));
    const chunks = splitChunks(encoded);
    if (chunks.length > MAX_CHUNKS) throw new Error('live/too-large');
    const revision = crypto.randomUUID();
    const expected = baseRevision;
    let previous: { revision: string; chunkCount: number } | null = null;
    await writeChunks(revision, chunks);
    try {
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(headRef);
        const data = current.data();
        const currentRevision = typeof data?.revision === 'string' ? data.revision : null;
        if (currentRevision !== expected) throw new StaleHead();
        previous = currentRevision ? { revision: currentRevision, chunkCount: Number(data?.chunkCount) || 0 } : null;
        transaction.set(headRef, { revision, chunkCount: chunks.length, bytes: encoded.length, updatedBy: mesh.peerId, updatedByUid: options.uid, updatedByName: options.userName.slice(0, 120), at: serverTimestamp() });
      });
    } catch (error) {
      await deleteChunks(revision, chunks.length);
      throw error;
    }
    baseRevision = revision;
    const old = previous as { revision: string; chunkCount: number } | null;
    if (old) void deleteChunks(old.revision, old.chunkCount);
  };

  const save = async (force = false) => {
    if (!options.canWrite || destroyed) return;
    if (saving) { await saving; if (!localDirty && !force) return; }
    if (!anyDirty && !force) return;
    const run = (async () => {
      setState('saving');
      const before = { localDirty, anyDirty };
      localDirty = false;
      anyDirty = false;
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          try { await persistOnce(); break; }
          catch (error) {
            if (!(error instanceof StaleHead) || attempt === 3) throw error;
            const head = await readHead();
            if (head) await applyHead(head);
          }
        }
        savedAt = Date.now();
        setState(localDirty || anyDirty ? 'pending' : 'saved');
      } catch (error) {
        console.warn('live: save failed', error);
        localDirty = localDirty || before.localDirty;
        anyDirty = anyDirty || before.anyDirty;
        setState('error');
      }
    })();
    saving = run;
    try { await run; } finally { if (saving === run) saving = null; }
  };

  const claimSeed = async () => {
    try {
      return await runTransaction(db, async (transaction) => {
        const head = await transaction.get(headRef);
        if (head.exists()) return false;
        const lock = await transaction.get(lockRef);
        const at = lock.data()?.at;
        if (lock.exists() && at instanceof Timestamp && Date.now() - at.toMillis() < LOCK_STALE_MS) return false;
        transaction.set(lockRef, { peerId: mesh.peerId, uid: options.uid, at: serverTimestamp() });
        return true;
      });
    } catch (error) {
      console.warn('live: seed claim failed', error);
      return false;
    }
  };

  const open = async (): Promise<OpenResult> => {
    const head = await readHead();
    if (head) { await applyHead(head); return 'loaded'; }
    if (options.canWrite && await claimSeed()) return 'seed';
    return 'wait';
  };

  const sendSyncStep1 = (target?: string) => {
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, ydoc);
    mesh.send(CHANNEL_SYNC, encoding.toUint8Array(encoder), target);
  };

  const onMessage = (channel: number, data: Uint8Array, from: LivePeer) => {
    if (channel === CHANNEL_SYNC) {
      const decoder = decoding.createDecoder(data);
      const encoder = encoding.createEncoder();
      const type = decoding.peekVarUint(decoder);
      if (type !== syncProtocol.messageYjsSyncStep1 && from.role === 'viewer') return;
      syncProtocol.readSyncMessage(decoder, encoder, ydoc, ORIGIN_REMOTE);
      if (encoding.length(encoder) > 0) mesh.send(CHANNEL_SYNC, encoding.toUint8Array(encoder), from.peerId);
    } else if (channel === CHANNEL_AWARENESS) {
      applyAwarenessUpdate(awareness, data, ORIGIN_REMOTE);
    } else if (channel === CHANNEL_APP) {
      try {
        const message = JSON.parse(new TextDecoder().decode(data));
        appListeners.forEach((listener) => listener(message, from));
      } catch { return; }
    }
  };

  const start = () => {
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === ORIGIN_PERSIST) return;
      if (!anyDirty) dirtySince = Date.now();
      anyDirty = true;
      if (origin !== ORIGIN_REMOTE) {
        localDirty = true;
        const encoder = encoding.createEncoder();
        syncProtocol.writeUpdate(encoder, update);
        mesh.send(CHANNEL_SYNC, encoding.toUint8Array(encoder));
      }
      if (options.canWrite && state !== 'saving') setState('pending');
    });
    awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === ORIGIN_REMOTE) return;
      const changed = [...added, ...updated, ...removed];
      mesh.send(CHANNEL_AWARENESS, encodeAwarenessUpdate(awareness, changed));
    });
    stops.push(mesh.onMessage(onMessage));
    stops.push(mesh.onJoin((peer) => {
      sendSyncStep1(peer.peerId);
      mesh.send(CHANNEL_AWARENESS, encodeAwarenessUpdate(awareness, [...awareness.getStates().keys()]), peer.peerId);
    }));
    stops.push(onSnapshot(headRef, (snapshot) => {
      const data = snapshot.data();
      if (!data || typeof data.revision !== 'string' || data.revision === baseRevision) return;
      if (String(data.updatedBy ?? '') === mesh.peerId) return;
      void applyHead({ revision: data.revision, chunkCount: Number(data.chunkCount) || 0 }).catch((error) => console.warn('live: head refresh failed', error));
    }, (error) => console.warn('live: head listener failed', error)));
    const tick = setInterval(() => {
      const interval = mesh.status() === 'online' ? 30_000 : 10_000;
      if (localDirty && Date.now() - dirtySince >= interval) void save();
      else if (anyDirty && Date.now() - dirtySince >= 90_000) void save();
    }, 5_000);
    stops.push(() => clearInterval(tick));
    const flush = () => { if (document.visibilityState === 'hidden' && localDirty) void save(); };
    document.addEventListener('visibilitychange', flush);
    stops.push(() => document.removeEventListener('visibilitychange', flush));
    sendSyncStep1();
  };

  const destroy = async () => {
    if (destroyed) return;
    if (localDirty) await save().catch(() => undefined);
    destroyed = true;
    stops.forEach((stop) => stop());
    awareness.setLocalState(null);
    awareness.destroy();
    ydoc.destroy();
  };

  return {
    ydoc,
    awareness,
    open,
    start,
    save,
    destroy,
    hasUnsaved: () => localDirty || anyDirty,
    saveState: () => state,
    onSaveState: (listener: (state: SaveState, savedAt: number) => void) => { stateListeners.add(listener); listener(state, savedAt); return () => { stateListeners.delete(listener); }; },
    sendApp: (message: unknown, target?: string) => mesh.send(CHANNEL_APP, new TextEncoder().encode(JSON.stringify(message)), target),
    onApp: (listener: (message: unknown, from: LivePeer) => void) => { appListeners.add(listener); return () => { appListeners.delete(listener); }; },
  };
}

export type LiveDocument = ReturnType<typeof createLiveDocument>;
