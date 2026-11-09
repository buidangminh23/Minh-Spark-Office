import { collection, doc, getDocFromServer, getDocsFromServer, getFirestore, onSnapshot, runTransaction, serverTimestamp, Timestamp, writeBatch, type DocumentReference, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { CLOUD_ENCODING, CHUNK_CHARACTERS, LEGACY_MAX_CHUNKS, LEGACY_MAX_COMPRESSED_BYTES, LEGACY_MAX_UNCOMPRESSED_BYTES, MAX_CHUNKS, MAX_COMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES, chunkCountFor, decodeCloudPayload, encodeCloudPayload, validateCloudId, validateCloudMeta } from './cloudCodec';
import { RemoteConflictError, type RemoteRecord, type RemoteWorkspace } from './syncTypes';
import type { FileMeta } from './storage';

type Manifest = {
  schema: 1 | 2;
  revision: string;
  deleted: boolean;
  meta: FileMeta | null;
  chunkCount: number;
  encoding: typeof CLOUD_ENCODING;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  updatedAt: Timestamp;
};

export const CLOUD_SCHEMA = 2;
const UPLOAD_BATCH_CHUNKS = 12;
const DELETE_BATCH_CHUNKS = 400;
const PARALLEL_BATCHES = 3;
const PARALLEL_READS = 8;
const READ_ATTEMPTS = 3;

const revisionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const invalid = (): never => { throw new Error('cloud/invalid-data: Invalid cloud manifest or chunk'); };

export const revisionChunkId = (revision: string, index: number) => `${revision}_${index}`;

function manifest(value: unknown, id: string): Manifest {
  if (!value || typeof value !== 'object') return invalid();
  const data = value as Manifest;
  const keys = ['schema', 'revision', 'deleted', 'meta', 'chunkCount', 'encoding', 'compressedBytes', 'uncompressedBytes', 'sha256', 'updatedAt'];
  if (Object.keys(data).length !== keys.length || keys.some((key) => !(key in data))) return invalid();
  if ((data.schema !== 1 && data.schema !== 2) || !revisionPattern.test(data.revision) || typeof data.deleted !== 'boolean' || data.encoding !== CLOUD_ENCODING || !(data.updatedAt instanceof Timestamp)) return invalid();
  const legacy = data.schema === 1;
  const maxChunks = legacy ? LEGACY_MAX_CHUNKS : MAX_CHUNKS;
  const maxCompressed = legacy ? LEGACY_MAX_COMPRESSED_BYTES : MAX_COMPRESSED_BYTES;
  const maxUncompressed = legacy ? LEGACY_MAX_UNCOMPRESSED_BYTES : MAX_UNCOMPRESSED_BYTES;
  if (!Number.isInteger(data.chunkCount) || data.chunkCount < 0 || data.chunkCount > maxChunks || !Number.isInteger(data.compressedBytes) || !Number.isInteger(data.uncompressedBytes)) return invalid();
  if (data.deleted) {
    if (data.meta !== null || data.chunkCount !== 0 || data.compressedBytes !== 0 || data.uncompressedBytes !== 0 || data.sha256 !== '') return invalid();
  } else {
    validateCloudMeta(data.meta, id);
    if (data.compressedBytes < 1 || data.compressedBytes > maxCompressed || data.uncompressedBytes < 1 || data.uncompressedBytes > maxUncompressed || !/^[a-f0-9]{64}$/.test(data.sha256)) return invalid();
    if (data.chunkCount !== chunkCountFor(data.compressedBytes)) return invalid();
  }
  return data;
}

function chunkData(value: Record<string, unknown> | undefined, index: number, revision: string) {
  if (!value || Object.keys(value).length !== 3 || value.index !== index || value.revision !== revision || typeof value.data !== 'string' || value.data.length > CHUNK_CHARACTERS) return invalid();
  return value.data;
}

async function inPool<T>(count: number, width: number, task: (index: number) => Promise<T>): Promise<T[]> {
  const results = new Array<T>(count);
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const index = next++;
      results[index] = await task(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, count) }, worker));
  return results;
}

class RevisionChanged extends Error {}
class ChunkMissing extends Error {}

type Snapshot = { data: Manifest; chunks: string[] } | null;

export function createFirestoreWorkspace(auth: Pick<Auth, 'currentUser'>, database: Firestore, uid: string): RemoteWorkspace {
  if (!uid || uid.includes('/')) throw new Error('cloud/invalid-user');
  const assertAccount = () => {
    if (auth.currentUser?.uid !== uid) throw new Error('cloud/account-changed');
  };
  const files = collection(database, 'users', uid, 'files');
  const reference = (id: string) => { validateCloudId(id); return doc(files, id); };
  const chunkRef = (file: DocumentReference, revision: string, index: number) => doc(file, 'chunks', revisionChunkId(revision, index));

  const writeChunks = async (file: DocumentReference, revision: string, chunks: string[]) => {
    await inPool(Math.ceil(chunks.length / UPLOAD_BATCH_CHUNKS), PARALLEL_BATCHES, async (batchIndex) => {
      assertAccount();
      const batch = writeBatch(database);
      const start = batchIndex * UPLOAD_BATCH_CHUNKS;
      for (let index = start; index < Math.min(chunks.length, start + UPLOAD_BATCH_CHUNKS); index++) batch.set(chunkRef(file, revision, index), { revision, index, data: chunks[index] });
      await batch.commit();
    });
  };

  const removeQuietly = async (file: DocumentReference, revision: string, count: number) => {
    if (count < 1) return;
    try {
      await inPool(Math.ceil(count / DELETE_BATCH_CHUNKS), PARALLEL_BATCHES, async (batchIndex) => {
        const batch = writeBatch(database);
        const start = batchIndex * DELETE_BATCH_CHUNKS;
        for (let index = start; index < Math.min(count, start + DELETE_BATCH_CHUNKS); index++) batch.delete(chunkRef(file, revision, index));
        await batch.commit();
      });
    } catch {
      return;
    }
  };

  const readLegacy = (id: string, file: DocumentReference): Promise<Snapshot> => runTransaction(database, async (transaction) => {
    assertAccount();
    const parent = await transaction.get(file);
    assertAccount();
    if (!parent.exists()) return null;
    const data = manifest(parent.data(), id);
    if (data.schema !== 1) throw new RevisionChanged();
    const chunks: string[] = [];
    for (let index = 0; index < data.chunkCount; index++) {
      const part = await transaction.get(doc(file, 'chunks', String(index)));
      if (!part.exists()) return invalid();
      chunks.push(chunkData(part.data(), index, data.revision));
    }
    assertAccount();
    return { data, chunks };
  });

  const readOnce = async (id: string, file: DocumentReference): Promise<Snapshot> => {
    assertAccount();
    const parent = await getDocFromServer(file);
    assertAccount();
    if (!parent.exists()) return null;
    const data = manifest(parent.data(), id);
    if (data.schema === 1) return readLegacy(id, file);
    const chunks = await inPool(data.chunkCount, PARALLEL_READS, async (index) => {
      const part = await getDocFromServer(chunkRef(file, data.revision, index));
      if (!part.exists()) throw new ChunkMissing();
      return chunkData(part.data(), index, data.revision);
    });
    assertAccount();
    return { data, chunks };
  };

  const read = async (id: string): Promise<RemoteRecord | null> => {
    assertAccount();
    const file = reference(id);
    let snapshot: Snapshot = null;
    for (let attempt = 1; ; attempt++) {
      try {
        snapshot = await readOnce(id, file);
        break;
      } catch (error) {
        const transient = error instanceof ChunkMissing || error instanceof RevisionChanged;
        if (!transient) throw error;
        if (attempt >= READ_ATTEMPTS) return invalid();
      }
    }
    assertAccount();
    if (!snapshot) return null;
    const { data, chunks } = snapshot;
    if (data.deleted) return { id, revision: data.revision, deleted: true, meta: null, content: undefined, versions: [] };
    const payload = await decodeCloudPayload({ ...data, chunks }, data.meta!);
    assertAccount();
    return { id, revision: data.revision, deleted: false, meta: data.meta, ...payload };
  };

  return {
    async list() {
      assertAccount();
      const snapshot = await getDocsFromServer(files);
      assertAccount();
      return snapshot.docs.map((entry) => {
        validateCloudId(entry.id);
        const data = manifest(entry.data(), entry.id);
        return { id: entry.id, revision: data.revision, deleted: data.deleted };
      });
    },
    read,
    async write(record, expectedRevision) {
      assertAccount();
      const id = record.id;
      const deleted = record.deleted;
      const meta = record.meta === null ? null : { ...record.meta };
      const file = reference(id);
      if (expectedRevision !== null && !revisionPattern.test(expectedRevision)) throw new Error('cloud/invalid-revision');
      if (typeof deleted !== 'boolean' || !Array.isArray(record.versions)) return invalid();
      if (deleted && (meta !== null || record.content !== undefined || record.versions.length !== 0)) return invalid();
      if (!deleted) validateCloudMeta(meta, id);
      const encoded = deleted ? { chunks: [], compressedBytes: 0, uncompressedBytes: 0, sha256: '' } : await encodeCloudPayload(record.content, record.versions, meta!);
      assertAccount();
      const revision = crypto.randomUUID();
      const replaced: { manifest: Manifest | null } = { manifest: null };
      try {
        await writeChunks(file, revision, encoded.chunks);
        assertAccount();
        await runTransaction(database, async (transaction) => {
          assertAccount();
          const existing = await transaction.get(file);
          assertAccount();
          const previous = existing.exists() ? manifest(existing.data(), id) : null;
          replaced.manifest = previous;
          if ((previous?.revision ?? null) !== expectedRevision) throw new RevisionChanged();
          if (previous?.schema === 1) for (let index = 0; index < previous.chunkCount; index++) transaction.delete(doc(file, 'chunks', String(index)));
          transaction.set(file, { schema: CLOUD_SCHEMA, revision, deleted, meta, chunkCount: encoded.chunks.length, encoding: CLOUD_ENCODING, compressedBytes: encoded.compressedBytes, uncompressedBytes: encoded.uncompressedBytes, sha256: encoded.sha256, updatedAt: serverTimestamp() });
        });
      } catch (error) {
        await removeQuietly(file, revision, encoded.chunks.length);
        assertAccount();
        if (error instanceof RevisionChanged) throw new RemoteConflictError(await read(id));
        throw error;
      }
      const previous = replaced.manifest;
      if (previous?.schema === 2) await removeQuietly(file, previous.revision, previous.chunkCount);
      assertAccount();
      return revision;
    },
    subscribe(onChange, onError) {
      assertAccount();
      let stop: (() => void) | undefined;
      stop = onSnapshot(files, { includeMetadataChanges: true }, (snapshot) => {
        try {
          assertAccount();
          if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) onChange();
        } catch (error) { stop?.(); onError(error); }
      }, onError);
      return stop;
    },
  };
}

export async function createCloudWorkspace(uid: string): Promise<RemoteWorkspace> {
  const { initializeAuthentication } = await import('./auth');
  const auth = await initializeAuthentication();
  if (auth.currentUser?.uid !== uid) throw new Error('cloud/account-changed');
  return createFirestoreWorkspace(auth, getFirestore(auth.app), uid);
}
