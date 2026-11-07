import { collection, doc, getDocsFromServer, getFirestore, onSnapshot, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { CLOUD_ENCODING, CHUNK_CHARACTERS, MAX_CHUNKS, MAX_COMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES, decodeCloudPayload, encodeCloudPayload, validateCloudId, validateCloudMeta } from './cloudCodec';
import { RemoteConflictError, type RemoteRecord, type RemoteWorkspace } from './syncTypes';
import type { FileMeta } from './storage';

type Manifest = {
  schema: 1;
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

const revisionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const invalid = (): never => { throw new Error('cloud/invalid-data: Invalid cloud manifest or chunk'); };

function manifest(value: unknown, id: string): Manifest {
  if (!value || typeof value !== 'object') return invalid();
  const data = value as Manifest;
  const keys = ['schema', 'revision', 'deleted', 'meta', 'chunkCount', 'encoding', 'compressedBytes', 'uncompressedBytes', 'sha256', 'updatedAt'];
  if (Object.keys(data).length !== keys.length || keys.some((key) => !(key in data))) return invalid();
  if (data.schema !== 1 || !revisionPattern.test(data.revision) || typeof data.deleted !== 'boolean' || data.encoding !== CLOUD_ENCODING || !(data.updatedAt instanceof Timestamp)) return invalid();
  if (!Number.isInteger(data.chunkCount) || data.chunkCount < 0 || data.chunkCount > MAX_CHUNKS || !Number.isInteger(data.compressedBytes) || !Number.isInteger(data.uncompressedBytes)) return invalid();
  if (data.deleted) {
    if (data.meta !== null || data.chunkCount !== 0 || data.compressedBytes !== 0 || data.uncompressedBytes !== 0 || data.sha256 !== '') return invalid();
  } else {
    validateCloudMeta(data.meta, id);
    if (data.compressedBytes < 1 || data.compressedBytes > MAX_COMPRESSED_BYTES || data.uncompressedBytes < 1 || data.uncompressedBytes > MAX_UNCOMPRESSED_BYTES || !/^[a-f0-9]{64}$/.test(data.sha256)) return invalid();
    if (data.chunkCount !== Math.ceil(Math.ceil(data.compressedBytes / 3) * 4 / CHUNK_CHARACTERS)) return invalid();
  }
  return data;
}

class RevisionChanged extends Error {}

export function createFirestoreWorkspace(auth: Pick<Auth, 'currentUser'>, database: Firestore, uid: string): RemoteWorkspace {
  if (!uid || uid.includes('/')) throw new Error('cloud/invalid-user');
  const assertAccount = () => {
    if (auth.currentUser?.uid !== uid) throw new Error('cloud/account-changed');
  };
  const files = collection(database, 'users', uid, 'files');
  const reference = (id: string) => { validateCloudId(id); return doc(files, id); };

  const read = async (id: string): Promise<RemoteRecord | null> => {
    assertAccount();
    const file = reference(id);
    const snapshot = await runTransaction(database, async (transaction) => {
      assertAccount();
      const parent = await transaction.get(file);
      assertAccount();
      if (!parent.exists()) return null;
      const data = manifest(parent.data(), id);
      const chunks: string[] = [];
      for (let index = 0; index < data.chunkCount; index++) {
        const part = await transaction.get(doc(file, 'chunks', String(index)));
        const chunk = part.data();
        if (!part.exists() || !chunk || Object.keys(chunk).length !== 3 || chunk.index !== index || chunk.revision !== data.revision || typeof chunk.data !== 'string' || chunk.data.length > CHUNK_CHARACTERS) return invalid();
        chunks.push(chunk.data);
      }
      assertAccount();
      return { data, chunks };
    });
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
      try {
        await runTransaction(database, async (transaction) => {
          assertAccount();
          const existing = await transaction.get(file);
          assertAccount();
          const previous = existing.exists() ? manifest(existing.data(), id) : null;
          if ((previous?.revision ?? null) !== expectedRevision) throw new RevisionChanged();
          for (let index = 0; index < encoded.chunks.length; index++) transaction.set(doc(file, 'chunks', String(index)), { revision, index, data: encoded.chunks[index] });
          for (let index = encoded.chunks.length; index < (previous?.chunkCount ?? 0); index++) transaction.delete(doc(file, 'chunks', String(index)));
          transaction.set(file, { schema: 1, revision, deleted, meta, chunkCount: encoded.chunks.length, encoding: CLOUD_ENCODING, compressedBytes: encoded.compressedBytes, uncompressedBytes: encoded.uncompressedBytes, sha256: encoded.sha256, updatedAt: serverTimestamp() });
        });
      } catch (error) {
        assertAccount();
        if (error instanceof RevisionChanged) throw new RemoteConflictError(await read(id));
        throw error;
      }
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
