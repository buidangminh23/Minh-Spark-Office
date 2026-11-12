import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore';

const id = 'a'.repeat(43);
const envelope = () => ({
  ephemeralKey: `B${'b'.repeat(86)}`,
  iv: 'c'.repeat(16),
  ciphertext: 'd'.repeat(200),
  createdAt: serverTimestamp(),
  expireAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
});

describe('desktopLogins rules', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let environment: RulesTestEnvironment;
  const anonymous = () => environment.unauthenticatedContext().firestore() as unknown as Firestore;
  const signedIn = (uid: string) => environment.authenticatedContext(uid).firestore() as unknown as Firestore;
  before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    environment = await initializeTestEnvironment({ projectId: 'demo-minh-office-login', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await environment?.cleanup(); });

  test('a signed-in browser creates one sealed delivery that nobody can overwrite', async () => {
    await environment.clearFirestore();
    await assertFails(setDoc(doc(anonymous(), 'desktopLogins', id), envelope()));
    await assertSucceeds(setDoc(doc(signedIn('owner'), 'desktopLogins', id), envelope()));
    await assertFails(setDoc(doc(signedIn('attacker'), 'desktopLogins', id), envelope()));
    await assertFails(setDoc(doc(signedIn('owner'), 'desktopLogins', id), envelope()));
    await assertFails(updateDoc(doc(signedIn('owner'), 'desktopLogins', id), { iv: 'e'.repeat(16) }));
  });

  test('the app reads and deletes by id but cannot list deliveries', async () => {
    await environment.clearFirestore();
    await assertSucceeds(setDoc(doc(signedIn('owner'), 'desktopLogins', id), envelope()));
    await assertSucceeds(getDoc(doc(anonymous(), 'desktopLogins', id)));
    await assertFails(getDocs(collection(anonymous(), 'desktopLogins')));
    await assertFails(getDocs(collection(signedIn('owner'), 'desktopLogins')));
    await assertSucceeds(deleteDoc(doc(anonymous(), 'desktopLogins', id)));
  });

  test('malformed ids and payloads are rejected', async () => {
    await environment.clearFirestore();
    const db = signedIn('owner');
    await assertFails(setDoc(doc(db, 'desktopLogins', 'short'), envelope()));
    await assertFails(getDoc(doc(anonymous(), 'desktopLogins', 'short')));
    const cases: Record<string, unknown>[] = [
      { ...envelope(), extra: 1 },
      { ...envelope(), ephemeralKey: `A${'b'.repeat(86)}` },
      { ...envelope(), iv: 'c'.repeat(15) },
      { ...envelope(), ciphertext: 'd'.repeat(8193) },
      { ...envelope(), ciphertext: 'not base64url!'.repeat(4) },
      { ...envelope(), createdAt: Timestamp.fromMillis(Date.now() - 60_000) },
      { ...envelope(), expireAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000) },
      { ...envelope(), expireAt: Timestamp.fromMillis(Date.now() - 1000) },
    ];
    for (const [index, data] of cases.entries()) {
      await assertFails(setDoc(doc(db, 'desktopLogins', `${'z'.repeat(42)}${index}`), data));
    }
  });
});
