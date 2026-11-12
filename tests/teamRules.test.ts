import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore';

const TEAM = 'T'.repeat(20);
const INVITE = 'I'.repeat(24);
const ITEM = 'M'.repeat(20);
const REVISION = '12345678-1234-4123-8123-123456789abc';
const people = {
  owner: { uid: 'owner', email: 'owner@example.com' },
  admin: { uid: 'admin', email: 'admin@example.com' },
  editor: { uid: 'editor', email: 'editor@example.com' },
  viewer: { uid: 'viewer', email: 'viewer@example.com' },
  guest: { uid: 'guest', email: 'guest@example.com' },
  stranger: { uid: 'stranger', email: 'stranger@example.com' },
} as const;
type Person = keyof typeof people;

const team = (ownerUid = 'owner', name = 'Phòng Kỹ thuật') => ({ name, description: '', color: '#2563eb', ownerUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const member = (who: Person, role: string, inviteId = '') => ({ uid: people[who].uid, email: people[who].email, name: who, photoURL: '', role, joinedAt: serverTimestamp(), inviteId });
const invite = (email: string, role: string, invitedBy = 'owner', teamName = 'Phòng Kỹ thuật', ttlMs = 3 * 86400000) => ({ email, role, invitedBy, invitedByName: invitedBy, teamName, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + ttlMs) });
const item = (by: string, type = 'template', revision = REVISION) => ({
  type, name: 'Biên bản họp', kind: 'doc', description: '', category: '', authorUid: by, authorName: by, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  updatedBy: by, updatedByName: by, revision, chunkCount: 1, compressedBytes: 100, uncompressedBytes: 400, sha256: 'a'.repeat(64), preview: '', size: 400,
});
const chunk = (revision = REVISION) => ({ revision, index: 0, data: 'QUJD' });

describe('team rules', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let environment: RulesTestEnvironment;
  const cache = new Map<string, Firestore>();
  const as = (who: Person, verified = true) => {
    const key = `${who}:${verified}`;
    if (!cache.has(key)) cache.set(key, environment.authenticatedContext(people[who].uid, { email: people[who].email, email_verified: verified }).firestore() as unknown as Firestore);
    return cache.get(key)!;
  };

  before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    environment = await initializeTestEnvironment({ projectId: 'demo-minh-office-teams', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await environment?.cleanup(); });

  beforeEach(async () => {
    cache.clear();
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'teams', TEAM), team());
      for (const [who, role] of [['owner', 'owner'], ['admin', 'admin'], ['editor', 'editor'], ['viewer', 'viewer']] as const) await setDoc(doc(db, 'teams', TEAM, 'members', people[who].uid), member(who, role));
      await setDoc(doc(db, 'teams', TEAM, 'items', ITEM), item('editor'));
      await setDoc(doc(db, 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`), chunk());
    });
  });

  test('a signed-in user creates a team only together with their owner membership', async () => {
    const db = as('stranger');
    const id = 'N'.repeat(20);
    await assertFails(setDoc(doc(db, 'teams', id), team('stranger')));
    const batch = writeBatch(db);
    batch.set(doc(db, 'teams', id), team('stranger'));
    batch.set(doc(db, 'teams', id, 'members', 'stranger'), member('stranger', 'owner'));
    await assertSucceeds(batch.commit());
    const forged = writeBatch(as('guest'));
    forged.set(doc(as('guest'), 'teams', 'X'.repeat(20)), team('owner'));
    forged.set(doc(as('guest'), 'teams', 'X'.repeat(20), 'members', 'guest'), member('guest', 'owner'));
    await assertFails(forged.commit());
  });

  test('only members read the team, its members and items', async () => {
    await assertSucceeds(getDoc(doc(as('viewer'), 'teams', TEAM)));
    await assertSucceeds(getDocs(collection(as('viewer'), 'teams', TEAM, 'members')));
    await assertSucceeds(getDocs(collection(as('viewer'), 'teams', TEAM, 'items')));
    await assertSucceeds(getDoc(doc(as('viewer'), 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`)));
    await assertFails(getDoc(doc(as('stranger'), 'teams', TEAM)));
    await assertFails(getDocs(collection(as('stranger'), 'teams', TEAM, 'items')));
    await assertFails(getDoc(doc(as('stranger'), 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`)));
    await assertSucceeds(getDocs(query(collectionGroup(as('viewer'), 'members'), where('uid', '==', 'viewer'))));
    await assertFails(getDocs(query(collectionGroup(as('viewer'), 'members'), where('uid', '==', 'owner'))));
  });

  test('invites follow the role ladder', async () => {
    await assertSucceeds(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', INVITE), invite('guest@example.com', 'admin')));
    await assertSucceeds(setDoc(doc(as('admin'), 'teams', TEAM, 'invites', 'J'.repeat(24)), invite('a@example.com', 'editor', 'admin')));
    await assertFails(setDoc(doc(as('admin'), 'teams', TEAM, 'invites', 'K'.repeat(24)), invite('b@example.com', 'admin', 'admin')));
    await assertFails(setDoc(doc(as('editor'), 'teams', TEAM, 'invites', 'L'.repeat(24)), invite('c@example.com', 'viewer', 'editor')));
    await assertFails(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', 'O'.repeat(24)), invite('d@example.com', 'owner')));
    await assertFails(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', 'P'.repeat(24)), invite('e@example.com', 'viewer', 'owner', 'Tên khác')));
    await assertFails(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', 'Q'.repeat(24)), invite('f@example.com', 'viewer', 'owner', 'Phòng Kỹ thuật', 30 * 86400000)));
    await assertFails(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', 'R'.repeat(24)), invite('Upper@Example.com', 'viewer')));
  });

  test('only the invited verified email can read and accept the invite', async () => {
    await assertSucceeds(setDoc(doc(as('owner'), 'teams', TEAM, 'invites', INVITE), invite('guest@example.com', 'editor')));
    await assertFails(getDoc(doc(as('stranger'), 'teams', TEAM, 'invites', INVITE)));
    await assertSucceeds(getDoc(doc(as('guest'), 'teams', TEAM, 'invites', INVITE)));
    await assertSucceeds(getDocs(query(collectionGroup(as('guest'), 'invites'), where('email', '==', 'guest@example.com'))));
    await assertFails(getDocs(query(collectionGroup(as('stranger'), 'invites'), where('email', '==', 'guest@example.com'))));

    const steal = writeBatch(as('stranger'));
    steal.set(doc(as('stranger'), 'teams', TEAM, 'members', 'stranger'), { ...member('stranger', 'editor', INVITE) });
    steal.delete(doc(as('stranger'), 'teams', TEAM, 'invites', INVITE));
    await assertFails(steal.commit());

    const promote = writeBatch(as('guest'));
    promote.set(doc(as('guest'), 'teams', TEAM, 'members', 'guest'), member('guest', 'admin', INVITE));
    promote.delete(doc(as('guest'), 'teams', TEAM, 'invites', INVITE));
    await assertFails(promote.commit());

    await assertFails(setDoc(doc(as('guest'), 'teams', TEAM, 'members', 'guest'), member('guest', 'editor', INVITE)));

    const unverified = writeBatch(as('guest', false));
    unverified.set(doc(as('guest', false), 'teams', TEAM, 'members', 'guest'), member('guest', 'editor', INVITE));
    unverified.delete(doc(as('guest', false), 'teams', TEAM, 'invites', INVITE));
    await assertFails(unverified.commit());

    const accept = writeBatch(as('guest'));
    accept.set(doc(as('guest'), 'teams', TEAM, 'members', 'guest'), member('guest', 'editor', INVITE));
    accept.delete(doc(as('guest'), 'teams', TEAM, 'invites', INVITE));
    await assertSucceeds(accept.commit());
    await assertSucceeds(getDoc(doc(as('guest'), 'teams', TEAM)));
  });

  test('expired invites cannot be accepted', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'teams', TEAM, 'invites', INVITE), { ...invite('guest@example.com', 'viewer'), expireAt: Timestamp.fromMillis(Date.now() - 1000) });
    });
    const accept = writeBatch(as('guest'));
    accept.set(doc(as('guest'), 'teams', TEAM, 'members', 'guest'), member('guest', 'viewer', INVITE));
    accept.delete(doc(as('guest'), 'teams', TEAM, 'invites', INVITE));
    await assertFails(accept.commit());
  });

  test('role changes and removals respect rank', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'teams', TEAM, 'members', 'viewer'), { role: 'editor' }));
    await assertFails(updateDoc(doc(as('admin'), 'teams', TEAM, 'members', 'editor'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as('admin'), 'teams', TEAM, 'members', 'owner'), { role: 'viewer' }));
    await assertFails(updateDoc(doc(as('editor'), 'teams', TEAM, 'members', 'viewer'), { role: 'editor' }));
    await assertFails(updateDoc(doc(as('viewer'), 'teams', TEAM, 'members', 'viewer'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(as('viewer'), 'teams', TEAM, 'members', 'viewer'), { name: 'Tên mới' }));
    await assertSucceeds(updateDoc(doc(as('owner'), 'teams', TEAM, 'members', 'admin'), { role: 'editor' }));
    await assertFails(deleteDoc(doc(as('editor'), 'teams', TEAM, 'members', 'viewer')));
    await assertFails(deleteDoc(doc(as('owner'), 'teams', TEAM, 'members', 'owner')));
    await assertSucceeds(deleteDoc(doc(as('viewer'), 'teams', TEAM, 'members', 'viewer')));
    await assertSucceeds(deleteDoc(doc(as('owner'), 'teams', TEAM, 'members', 'editor')));
  });

  test('ownership moves only in one consistent batch', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await setDoc(doc(raw, 'teams', TEAM), { ...team(), createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000) });
    });
    await assertFails(updateDoc(doc(as('owner'), 'teams', TEAM, 'members', 'admin'), { role: 'owner' }));
    const db = as('owner');
    const halfway = writeBatch(db);
    halfway.set(doc(db, 'teams', TEAM), { ...team('admin'), createdAt: Timestamp.fromMillis(1000) });
    halfway.update(doc(db, 'teams', TEAM, 'members', 'admin'), { role: 'owner' });
    await assertFails(halfway.commit());
    const byAdmin = writeBatch(as('admin'));
    byAdmin.set(doc(as('admin'), 'teams', TEAM), { ...team('admin'), createdAt: Timestamp.fromMillis(1000) });
    byAdmin.update(doc(as('admin'), 'teams', TEAM, 'members', 'admin'), { role: 'owner' });
    byAdmin.update(doc(as('admin'), 'teams', TEAM, 'members', 'owner'), { role: 'admin' });
    await assertFails(byAdmin.commit());
    const valid = writeBatch(db);
    valid.set(doc(db, 'teams', TEAM), { ...team('admin'), createdAt: Timestamp.fromMillis(1000) });
    valid.update(doc(db, 'teams', TEAM, 'members', 'admin'), { role: 'owner' });
    valid.update(doc(db, 'teams', TEAM, 'members', 'owner'), { role: 'admin' });
    await assertSucceeds(valid.commit());
    await assertFails(updateDoc(doc(as('owner'), 'teams', TEAM), { name: 'Đổi tên' }));
  });

  test('templates: editors publish, authors and admins edit, viewers only read', async () => {
    const newItem = 'N'.repeat(20);
    await assertSucceeds(setDoc(doc(as('editor'), 'teams', TEAM, 'items', newItem, 'chunks', `${REVISION}_0`), chunk()));
    await assertSucceeds(setDoc(doc(as('editor'), 'teams', TEAM, 'items', newItem), item('editor')));
    await assertFails(setDoc(doc(as('viewer'), 'teams', TEAM, 'items', 'V'.repeat(20)), item('viewer')));
    await assertFails(setDoc(doc(as('viewer'), 'teams', TEAM, 'items', 'V'.repeat(20), 'chunks', `${REVISION}_0`), chunk()));
    await assertFails(setDoc(doc(as('admin'), 'teams', TEAM, 'items', 'W'.repeat(20)), item('editor')));
    await assertFails(setDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`), chunk()));

    const rename = (by: string) => ({ ...item('editor'), name: 'Đổi tên', updatedBy: by, updatedByName: by, createdAt: Timestamp.fromMillis(0) });
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'teams', TEAM, 'items', ITEM), { ...item('editor'), createdAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(0) });
      await setDoc(doc(context.firestore() as unknown as Firestore, 'teams', TEAM, 'members', 'guest'), { ...member('guest', 'editor'), joinedAt: Timestamp.fromMillis(0) });
    });
    await assertFails(setDoc(doc(as('guest'), 'teams', TEAM, 'items', ITEM), rename('guest')));
    await assertFails(setDoc(doc(as('viewer'), 'teams', TEAM, 'items', ITEM), rename('viewer')));
    await assertSucceeds(setDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM), rename('editor')));
    await assertSucceeds(setDoc(doc(as('admin'), 'teams', TEAM, 'items', ITEM), rename('admin')));
    await assertFails(setDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM), { ...rename('editor'), sha256: 'b'.repeat(64) }));
    await assertFails(deleteDoc(doc(as('guest'), 'teams', TEAM, 'items', ITEM)));
    await assertFails(deleteDoc(doc(as('viewer'), 'teams', TEAM, 'items', ITEM)));
    await assertSucceeds(deleteDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM)));
    await assertSucceeds(deleteDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`)));
  });

  test('shared documents are editable by every editor', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await setDoc(doc(raw, 'teams', TEAM, 'items', ITEM), { ...item('owner', 'document'), createdAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(0) });
    });
    const next = '87654321-4321-4321-8321-cba987654321';
    await assertSucceeds(setDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM, 'chunks', `${next}_0`), chunk(next)));
    await assertSucceeds(setDoc(doc(as('editor'), 'teams', TEAM, 'items', ITEM), { ...item('owner', 'document', next), updatedBy: 'editor', updatedByName: 'editor', createdAt: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(as('viewer'), 'teams', TEAM, 'items', ITEM), { ...item('owner', 'document', REVISION), updatedBy: 'viewer', updatedByName: 'viewer', createdAt: Timestamp.fromMillis(0) }));
  });

  test('the owner can delete the whole team', async () => {
    await assertFails(deleteDoc(doc(as('admin'), 'teams', TEAM)));
    const db = as('owner');
    await assertSucceeds(deleteDoc(doc(db, 'teams', TEAM, 'items', ITEM)));
    await assertSucceeds(deleteDoc(doc(db, 'teams', TEAM, 'items', ITEM, 'chunks', `${REVISION}_0`)));
    for (const uid of ['admin', 'editor', 'viewer']) await assertSucceeds(deleteDoc(doc(db, 'teams', TEAM, 'members', uid)));
    await assertSucceeds(deleteDoc(doc(db, 'teams', TEAM)));
    await assertSucceeds(deleteDoc(doc(db, 'teams', TEAM, 'members', 'owner')));
  });
});
