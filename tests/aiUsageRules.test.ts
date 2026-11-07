import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { quotaDay } from '../api/_shared/addin.ts';

describe('aiUsage quota rules', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let environment: RulesTestEnvironment;
  const database = (uid: string) => environment.authenticatedContext(uid).firestore() as unknown as Firestore;
  before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    environment = await initializeTestEnvironment({ projectId: 'demo-minh-office-ai', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  after(async () => { await environment?.cleanup(); });

  test('owner can only start at one and step by one within today', async () => {
    const db = database('alice');
    const ref = doc(db, 'aiUsage', 'alice');
    const day = quotaDay(Date.now());
    await assertFails(setDoc(ref, { day, count: 5 }));
    await assertSucceeds(setDoc(ref, { day, count: 1 }));
    await assertFails(setDoc(ref, { day, count: 3 }));
    await assertFails(setDoc(ref, { day, count: 0 }));
    await assertSucceeds(setDoc(ref, { day, count: 2 }));
    await assertFails(setDoc(ref, { day: day + 1, count: 1 }));
    await assertFails(setDoc(ref, { day, count: 3, extra: true }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDoc(ref));
  });

  test('a stale day resets to one and other users are locked out', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'aiUsage', 'bob'), { day: quotaDay(Date.now()) - 1, count: 30 });
    });
    const ref = doc(database('bob'), 'aiUsage', 'bob');
    await assertFails(setDoc(ref, { day: quotaDay(Date.now()), count: 31 }));
    await assertSucceeds(setDoc(ref, { day: quotaDay(Date.now()), count: 1 }));
    await assertFails(getDoc(doc(database('mallory'), 'aiUsage', 'bob')));
    await assertFails(setDoc(doc(database('mallory'), 'aiUsage', 'bob'), { day: quotaDay(Date.now()), count: 2 }));
  });
});
