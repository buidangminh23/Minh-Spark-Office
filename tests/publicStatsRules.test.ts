import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, increment, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

describe('publicStats rules', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let environment: RulesTestEnvironment;
  const anonymous = () => environment.unauthenticatedContext().firestore() as unknown as Firestore;
  before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    environment = await initializeTestEnvironment({ projectId: 'demo-minh-office-stats', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await environment?.cleanup(); });

  test('anyone can read and step a known counter by one, nothing else', async () => {
    const db = anonymous();
    const ref = doc(db, 'publicStats', 'downloadsWindows');
    await assertSucceeds(setDoc(ref, { count: increment(1) }, { merge: true }));
    await assertSucceeds(updateDoc(ref, { count: increment(1) }));
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { count: increment(5) }));
    await assertFails(updateDoc(ref, { count: 0 }));
    await assertFails(updateDoc(ref, { count: increment(1), note: 'x' }));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(doc(db, 'publicStats', 'downloadsMac'), { count: 50 }));
    await assertFails(setDoc(doc(db, 'publicStats', 'revenue'), { count: increment(1) }, { merge: true }));
    await assertFails(getDoc(doc(db, 'publicStats', 'revenue')));
  });
});
