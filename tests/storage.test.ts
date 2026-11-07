import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, set } from 'idb-keyval';
import { createWorkspaceStorage, defaultPage, type DocContent, type FileMeta } from '../src/lib/storage.ts';

const content = (text: string): DocContent => ({ kind: 'doc', page: defaultPage(), json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
const meta = (id: string): FileMeta => ({ id, name: `${id}.docx`, kind: 'doc', createdAt: 1, updatedAt: 1, openedAt: 1, starred: false, deletedAt: null, size: 1, preview: '' });

test('separates content, metadata and version history for identical file IDs across accounts', async () => {
  const first = createWorkspaceStorage('account-first');
  const second = createWorkspaceStorage('account-second');
  await first.saveFile(meta('same-id'), content('first account'));
  const version = await first.saveVersion('same-id', content('old first account'));
  assert.deepEqual(await second.listFiles(), []);
  assert.equal(await second.loadContent('same-id'), undefined);
  assert.deepEqual(await second.listVersions('same-id'), []);
  await second.saveFile(meta('same-id'), content('second account'));
  assert.equal(await second.restoreVersion('same-id', version.id), null);
  await second.removeFile('same-id');
  assert.deepEqual(await first.loadContent('same-id'), content('first account'));
  assert.equal((await first.listVersions('same-id')).length, 1);
});

test('late writes remain bound to the original account after another workspace opens', async () => {
  const original = createWorkspaceStorage('delayed-original');
  let resume!: () => void;
  const wait = new Promise<void>((resolve) => { resume = resolve; });
  const delayedSave = (async () => { await wait; await original.saveFile(meta('late'), content('original')); })();
  const replacement = createWorkspaceStorage('delayed-replacement');
  await replacement.saveFile(meta('replacement'), content('replacement'));
  resume();
  await delayedSave;
  assert.deepEqual((await original.listFiles()).map((file) => file.id), ['late']);
  assert.deepEqual((await replacement.listFiles()).map((file) => file.id), ['replacement']);
  assert.equal(await replacement.loadContent('late'), undefined);
});

test('preserves existing guest files without assigning them to the first Google account', async () => {
  const legacy = createStore('minh-office', 'workspace');
  await set('files-index', [meta('legacy')], legacy);
  await set('content:legacy', content('legacy data'), legacy);
  const guest = createWorkspaceStorage(null);
  const signedIn = createWorkspaceStorage('new-google-account');
  assert.deepEqual(await guest.loadContent('legacy'), content('legacy data'));
  assert.deepEqual(await signedIn.listFiles(), []);
  assert.equal(await signedIn.loadContent('legacy'), undefined);
  assert.equal(await signedIn.importBackup(await guest.exportBackup()), 1);
  assert.deepEqual(await signedIn.loadContent('legacy'), content('legacy data'));
  assert.deepEqual(await guest.loadContent('legacy'), content('legacy data'));
});

test('persists account data on reopening and keeps concurrent new files in the index', async () => {
  const workspace = createWorkspaceStorage('concurrent-account');
  await Promise.all(Array.from({ length: 12 }, (_, index) => workspace.saveFile(meta(`file-${index}`), content(`${index}`))));
  const reopened = createWorkspaceStorage('concurrent-account');
  assert.equal((await reopened.listFiles()).length, 12);
  assert.deepEqual(await reopened.loadContent('file-11'), content('11'));
});

test('imports a backup once per ID into only the selected account', async () => {
  const target = createWorkspaceStorage('backup-target');
  const other = createWorkspaceStorage('backup-other');
  const backup = { format: 'minh-office-backup', files: [meta('one'), meta('one')], contents: { one: content('backup') } };
  assert.equal(await target.importBackup(backup), 1);
  assert.equal(await target.importBackup(backup), 0);
  assert.equal((await target.listFiles()).length, 1);
  assert.deepEqual(await other.listFiles(), []);
  await assert.rejects(target.importBackup({ format: 'wrong', files: [] }));
});
