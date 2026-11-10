import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getDocs, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { createFirestoreWorkspace, type FirestoreWorkspaceOptions, type OrphanJournalStore } from '../src/lib/cloudWorkspace.ts';
import { ORPHAN_SAFE_AGE_MS, type OrphanJournal } from '../src/lib/cloudCodec.ts';
import { RemoteConflictError, type RemoteRecord } from '../src/lib/syncTypes.ts';
import { MAX_COMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES, CHUNK_CHARACTERS, LEGACY_MAX_CHUNKS, LEGACY_MAX_COMPRESSED_BYTES, encodeCloudPayload } from '../src/lib/cloudCodec.ts';
import { revisionChunkId } from '../src/lib/cloudWorkspace.ts';

const record = (id: string, text = 'Tài liệu'): RemoteRecord => ({ id, revision: '', deleted: false, meta: { id, name: 'Tài liệu', kind: 'doc', createdAt: 1, updatedAt: 1, openedAt: 1, starred: false, deletedAt: null, size: 1, preview: '' }, content: { kind: 'doc', json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, page: { size: 'A4', orientation: 'portrait', margins: { top: 1, right: 1, bottom: 1, left: 1 }, header: '', footer: '', pageNumbers: false } }, versions: [] });

describe('Firestore workspace and adversarial rules', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let environment: RulesTestEnvironment;
  const database = (uid: string) => environment.authenticatedContext(uid).firestore() as unknown as Firestore;
  const memoryJournal = (): OrphanJournalStore & { value: OrphanJournal } => ({ value: {}, read() { return { ...this.value }; }, write(journal) { this.value = { ...journal }; } });
  const adapter = (uid: string, db = database(uid), options: FirestoreWorkspaceOptions = { journal: memoryJournal() }) => createFirestoreWorkspace({ currentUser: { uid } } as Auth, db, uid, options);
  before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    environment = await initializeTestEnvironment({ projectId: 'demo-minh-office-sync', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await environment?.cleanup(); });

  test('atomically round trips chunks, shrinks files, preserves tombstones and rejects stale CAS writes', async () => {
    const cloud = adapter('owner');
    const large = record('large-file', randomBytes(800000).toString('base64'));
    const first = await cloud.write(large, null);
    assert.deepEqual(await cloud.read(large.id), { ...large, revision: first });
    const updated = record(large.id, 'new contents');
    const second = await cloud.write(updated, first);
    assert.deepEqual(await cloud.read(large.id), { ...updated, revision: second });
    const db = database('owner');
    assert.equal((await getDocs(collection(db, 'users/owner/files/large-file/chunks'))).size, 1);
    await assert.rejects(cloud.write(large, first), (error: unknown) => error instanceof RemoteConflictError && error.current?.revision === second);
    const tombstone = { ...updated, deleted: true, meta: null, content: undefined, versions: [] };
    const deletedRevision = await cloud.write(tombstone, second);
    assert.deepEqual(await cloud.read(large.id), { ...tombstone, revision: deletedRevision });
    assert.equal((await getDocs(collection(db, 'users/owner/files/large-file/chunks'))).size, 0);
    assert.deepEqual(await cloud.list(), [{ id: large.id, revision: deletedRevision, deleted: true }]);
    await assert.rejects(cloud.write(updated, null), RemoteConflictError);
  });

  test('concurrent create/update races have exactly one winner and surface the committed remote payload', async () => {
    const first = adapter('racer');
    const second = adapter('racer');
    const creates = await Promise.allSettled([first.write(record('race', 'one'), null), second.write(record('race', 'two'), null)]);
    assert.equal(creates.filter((result) => result.status === 'fulfilled').length, 1);
    const loser = creates.find((result) => result.status === 'rejected');
    assert.ok(loser?.status === 'rejected' && loser.reason instanceof RemoteConflictError);
    const current = await first.read('race');
    assert.ok(current);
    assert.deepEqual(loser.reason.current, current);
    const updates = await Promise.allSettled([first.write(record('race', 'three'), current.revision), second.write(record('race', 'four'), current.revision)]);
    assert.equal(updates.filter((result) => result.status === 'fulfilled').length, 1);
  });

  test('denies unauthenticated and cross-account reads, lists, writes and deletes', async () => {
    const owner = database('private-owner');
    await adapter('private-owner', owner).write(record('private'), null);
    for (const db of [database('intruder'), environment.unauthenticatedContext().firestore() as unknown as Firestore]) {
      await assertFails(getDoc(doc(db, 'users/private-owner/files/private')));
      await assertFails(getDocs(collection(db, 'users/private-owner/files')));
      await assertFails(getDoc(doc(db, 'users/private-owner/files/private/chunks/0')));
      await assertFails(setDoc(doc(db, 'users/private-owner/files/private'), { deleted: true }));
      await assertFails(deleteDoc(doc(db, 'users/private-owner/files/private/chunks/0')));
    }
    await assertFails(setDoc(doc(owner, 'arbitrary/unprotected'), { value: 1 }));
  });

  test('rejects malformed metadata, oversize manifests and edits to committed chunks', async () => {
    const db = database('validator');
    const cloud = adapter('validator', db);
    const revision = await cloud.write(record('valid'), null);
    const parent = doc(db, 'users/validator/files/valid');
    const chunk = doc(parent, 'chunks', '0');
    const original = (await getDoc(parent)).data()!;
    const originalChunk = (await getDoc(chunk)).data()!;
    assert.equal(original.schema, 1);
    assert.equal(originalChunk.revision, revision);
    for (const patch of [{ extra: true }, { schema: 3 }, { chunkCount: 601 }, { compressedBytes: MAX_COMPRESSED_BYTES + 1 }, { uncompressedBytes: MAX_UNCOMPRESSED_BYTES + 1 }, { meta: { ...original.meta, id: 'wrong' } }, { meta: { ...original.meta, starred: 'yes' } }, { updatedAt: 123 }, { sha256: 'wrong' }]) {
      await assertFails(setDoc(parent, { ...original, revision: randomUUID(), updatedAt: serverTimestamp(), ...patch }));
    }
    await assertFails(setDoc(parent, { ...original, schema: 1, chunkCount: 15, revision: randomUUID(), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(chunk, { ...originalChunk, data: originalChunk.data.replace(/^./, 'A') }));
    await assertFails(deleteDoc(chunk));
    await assertFails(deleteDoc(parent));
    const other = randomUUID();
    for (const [id, data] of [[revisionChunkId(other, 1), { revision: other, index: 0, data: 'AAAA' }], [revisionChunkId(other, 600), { revision: other, index: 600, data: 'AAAA' }], [revisionChunkId(other, 0), { revision: other, index: 0, data: 'x'.repeat(CHUNK_CHARACTERS + 1) }], [revisionChunkId(other, 0), { revision: other, index: 0, data: 'AAAA', extra: true }], [revisionChunkId(other, 0), { revision: other, index: 0, data: 'AAA' }], [revisionChunkId(revision, 5), { revision, index: 5, data: 'AAAA' }], ['other_0', { revision: other, index: 0, data: 'AAAA' }]] as const) {
      await assertFails(setDoc(doc(parent, 'chunks', id), data));
    }
    await assertFails(setDoc(doc(db, 'users/validator/files/bad.file.id/chunks', revisionChunkId(other, 0)), { revision: other, index: 0, data: 'AAAA' }));
    const staged = doc(parent, 'chunks', revisionChunkId(other, 0));
    await setDoc(staged, { revision: other, index: 0, data: 'AAAA' });
    await assertFails(setDoc(staged, { revision: other, index: 0, data: 'BBBB' }));
    await deleteDoc(staged);
  });

  test('syncs records far beyond the former 6 MiB limit and removes replaced revisions', async () => {
    const cloud = adapter('large');
    const db = database('large');
    const big = record('big', randomBytes(LEGACY_MAX_COMPRESSED_BYTES + 1024 * 1024).toString('base64'));
    const first = await cloud.write(big, null);
    const parent = doc(db, 'users/large/files/big');
    assert.equal((await getDoc(parent)).data()!.schema, 2);
    const chunks = collection(db, 'users/large/files/big/chunks');
    const firstCount = (await getDocs(chunks)).size;
    assert.ok(firstCount > LEGACY_MAX_CHUNKS);
    await assertFails(deleteDoc(doc(chunks, revisionChunkId(first, 0))));
    assert.deepEqual(await cloud.read('big'), { ...big, revision: first });
    const second = await cloud.write(record('big', 'small again'), first);
    assert.equal((await getDoc(parent)).data()!.schema, 1);
    assert.deepEqual((await getDocs(chunks)).docs.map((entry) => entry.id), ['0']);
    assert.deepEqual(await cloud.read('big'), { ...record('big', 'small again'), revision: second });
    const third = await cloud.write(big, second);
    assert.equal((await getDoc(parent)).data()!.schema, 2);
    assert.ok((await getDocs(chunks)).docs.every((entry) => entry.id.startsWith(`${third}_`)));
    assert.deepEqual(await cloud.read('big'), { ...big, revision: third });
  });

  test('keeps records written by older apps in schema 1 and only upgrades when a record outgrows it', async () => {
    const db = database('legacy');
    const parent = doc(db, 'users/legacy/files/old');
    const revision = randomUUID();
    const old = record('old', 'written by an older app');
    const encoded = await encodeCloudPayload(old.content, old.versions, old.meta!);
    const batch = writeBatch(db);
    batch.set(parent, { schema: 1, revision, deleted: false, meta: old.meta, chunkCount: encoded.chunks.length, encoding: 'gzip-base64', compressedBytes: encoded.compressedBytes, uncompressedBytes: encoded.uncompressedBytes, sha256: encoded.sha256, updatedAt: serverTimestamp() });
    encoded.chunks.forEach((data, index) => batch.set(doc(parent, 'chunks', String(index)), { revision, index, data }));
    await batch.commit();
    const cloud = adapter('legacy', db);
    assert.deepEqual(await cloud.read('old'), { ...old, revision });
    const next = await cloud.write(record('old', 'still small'), revision);
    assert.equal((await getDoc(parent)).data()!.schema, 1);
    assert.deepEqual((await getDocs(collection(parent, 'chunks'))).docs.map((entry) => [entry.id, entry.data().revision]), [['0', next]]);
    assert.deepEqual(await cloud.read('old'), { ...record('old', 'still small'), revision: next });
    const large = record('old', randomBytes(LEGACY_MAX_COMPRESSED_BYTES + 1024 * 1024).toString('base64'));
    const upgraded = await cloud.write(large, next);
    assert.equal((await getDoc(parent)).data()!.schema, 2);
    assert.ok((await getDocs(collection(parent, 'chunks'))).docs.every((entry) => entry.id.startsWith(`${upgraded}_`)));
  });

  test('a manifest that already carries the write revision is reported as committed, not as a conflict', async () => {
    const db = database('ambiguous');
    const cloud = adapter('ambiguous', db);
    const first = await cloud.write(record('retry', 'first'), null);
    const own = randomUUID();
    const original = crypto.randomUUID;
    const second = record('retry', 'second');
    const encoded = await encodeCloudPayload(second.content, [], second.meta!);
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as Firestore;
      const parent = doc(admin, 'users/ambiguous/files/retry');
      const batch = writeBatch(admin);
      batch.set(parent, { schema: 1, revision: own, deleted: false, meta: second.meta, chunkCount: encoded.chunks.length, encoding: 'gzip-base64', compressedBytes: encoded.compressedBytes, uncompressedBytes: encoded.uncompressedBytes, sha256: encoded.sha256, updatedAt: serverTimestamp() });
      encoded.chunks.forEach((data, index) => batch.set(doc(parent, 'chunks', String(index)), { revision: own, index, data }));
      await batch.commit();
    });
    Object.assign(crypto, { randomUUID: () => own });
    try { assert.equal(await cloud.write(second, first), own); }
    finally { Object.assign(crypto, { randomUUID: original }); }
    assert.deepEqual(await cloud.read('retry'), { ...second, revision: own });
  });

  test('sweeps journaled orphan chunk revisions once they are old, and never the live revision', async () => {
    const db = database('sweeper');
    const journal = memoryJournal();
    let clock = 0;
    const cloud = adapter('sweeper', db, { journal, now: () => clock });
    const big = record('swept', randomBytes(LEGACY_MAX_COMPRESSED_BYTES + 1024 * 1024).toString('base64'));
    const live = await cloud.write(big, null);
    assert.deepEqual(journal.value, {});
    const parent = doc(db, 'users/sweeper/files/swept');
    const orphan = randomUUID();
    for (let index = 0; index < 3; index++) await setDoc(doc(parent, 'chunks', revisionChunkId(orphan, index)), { revision: orphan, index, data: 'AAAA' });
    journal.value = { [orphan]: { fileId: 'swept', chunkCount: 3, since: 0, attempts: 0 }, [live]: { fileId: 'swept', chunkCount: 50, since: 0, attempts: 0 } };
    await cloud.list();
    assert.ok((await getDoc(doc(parent, 'chunks', revisionChunkId(orphan, 0)))).exists());
    clock = ORPHAN_SAFE_AGE_MS * 2;
    const later = adapter('sweeper', db, { journal, now: () => clock });
    await later.list();
    assert.deepEqual(journal.value, {});
    const ids = (await getDocs(collection(parent, 'chunks'))).docs.map((entry) => entry.id);
    assert.ok(ids.length > LEGACY_MAX_CHUNKS);
    assert.ok(ids.every((id) => id.startsWith(`${live}_`)));
    assert.deepEqual(await later.read('swept'), { ...big, revision: live });
  });

  test('validates account binding before every operation and after an asynchronous encode', async () => {
    const auth = { currentUser: { uid: 'binding' } } as Auth;
    const cloud = createFirestoreWorkspace(auth, database('binding'), 'binding');
    const pending = cloud.write(record('switch', randomBytes(100000).toString('base64')), null);
    Object.assign(auth, { currentUser: { uid: 'different' } });
    await assert.rejects(pending, /account-changed/);
    await assert.rejects(cloud.list(), /account-changed/);
    await assert.rejects(cloud.read('switch'), /account-changed/);
    await assert.rejects(cloud.write(record('switch'), null), /account-changed/);
    assert.throws(() => cloud.subscribe(() => {}, () => {}), /account-changed/);
    assert.equal((await getDoc(doc(database('binding'), 'users/binding/files/switch'))).exists(), false);
  });

  test('rejects checksum-corrupt persisted payloads without returning partial data', async () => {
    const cloud = adapter('corruption');
    await cloud.write(record('corrupt'), null);
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const parent = doc(db, 'users/corruption/files/corrupt');
      const data = (await getDoc(parent)).data()!;
      await setDoc(parent, { ...data, sha256: '0'.repeat(64) });
    });
    await assert.rejects(cloud.read('corrupt'), /checksum/);
  });

  test('does not treat cached empty results as a server list while offline', async () => {
    const db = database('offline-reader');
    const cloud = adapter('offline-reader', db);
    assert.deepEqual(await cloud.list(), []);
    await disableNetwork(db);
    try { await assert.rejects(cloud.list(), /offline|server|client is offline/i); }
    finally { await enableNetwork(db); }
  });

  test('invalidates on initial and changed server snapshots', async () => {
    const cloud = adapter('listener');
    let count = 0;
    let notify: (() => void) | undefined;
    let failure: unknown;
    const stop = cloud.subscribe(() => { count++; notify?.(); }, (error) => { failure = error; notify?.(); });
    const waitFor = (minimum: number) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Snapshot timeout')), 5000);
      notify = () => { if (failure) { clearTimeout(timer); reject(failure); } else if (count >= minimum) { clearTimeout(timer); resolve(); } };
      notify();
    });
    try {
      await waitFor(1);
      await cloud.write(record('listener-file'), null);
      await waitFor(2);
    } finally { stop(); }
  });

  test('accepts the maximum legacy 14-slot atomic write within the rules access-call budget', async () => {
    const db = database('maximum');
    const parent = doc(db, 'users/maximum/files/maximum');
    const revision = randomUUID();
    const total = Math.ceil(LEGACY_MAX_COMPRESSED_BYTES / 3) * 4;
    const batch = writeBatch(db);
    batch.set(parent, { schema: 1, revision, deleted: false, meta: record('maximum').meta, chunkCount: 14, encoding: 'gzip-base64', compressedBytes: LEGACY_MAX_COMPRESSED_BYTES, uncompressedBytes: 33554432, sha256: '0'.repeat(64), updatedAt: serverTimestamp() });
    for (let index = 0; index < 14; index++) batch.set(doc(parent, 'chunks', String(index)), { revision, index, data: 'A'.repeat(Math.min(CHUNK_CHARACTERS, total - index * CHUNK_CHARACTERS)) });
    await batch.commit();
    assert.equal((await getDocs(collection(parent, 'chunks'))).size, 14);
    await adapter('maximum', db).write({ id: 'maximum', revision, deleted: true, meta: null, content: undefined, versions: [] }, revision);
    assert.equal((await getDocs(collection(parent, 'chunks'))).size, 0);
  });
});
