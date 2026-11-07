import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, set } from 'idb-keyval';
import { createDraftWorkspaceStorage, createWorkspaceStorage, defaultPage, type DocContent, type FileMeta } from '../src/lib/storage.ts';

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

test('keeps new drafts and imported backups in memory without writing the legacy store', async () => {
  const legacy = createWorkspaceStorage(null);
  const before = await legacy.exportBackup();
  const draft = createDraftWorkspaceStorage();
  const draftMeta = meta('memory-new');
  const draftContent = content('draft text');
  const saving = draft.saveFile(draftMeta, draftContent);
  draftMeta.name = 'changed outside';
  draftContent.page.header = 'changed outside';
  await saving;
  assert.equal((await draft.listFiles()).find((file) => file.id === 'memory-new')?.name, 'memory-new.docx');
  assert.deepEqual(await draft.loadContent('memory-new'), content('draft text'));
  const backup = { format: 'minh-office-backup', files: [meta('memory-import'), meta('memory-import')], contents: { 'memory-import': content('imported text') } };
  assert.equal(await draft.importBackup(backup), 1);
  backup.contents['memory-import'].page.header = 'changed after import';
  assert.deepEqual(await draft.loadContent('memory-import'), content('imported text'));
  assert.equal(await legacy.loadContent('memory-new'), undefined);
  assert.equal(await legacy.loadContent('memory-import'), undefined);
  assert.deepEqual(await legacy.listFiles(), before.files);
  await assert.rejects(draft.importBackup({ format: 'wrong', files: [] }));
});

test('isolates legacy content and metadata edits and snapshots legacy data only once', async () => {
  const legacy = createWorkspaceStorage(null);
  await legacy.saveFile(meta('memory-legacy'), content('original text'));
  const draft = createDraftWorkspaceStorage();
  const firstRead = await draft.loadContent('memory-legacy') as DocContent;
  firstRead.page.header = 'external mutation';
  const listed = await draft.listFiles();
  listed.find((file) => file.id === 'memory-legacy')!.name = 'external mutation';
  assert.deepEqual(await draft.loadContent('memory-legacy'), content('original text'));
  assert.equal((await draft.listFiles()).find((file) => file.id === 'memory-legacy')?.name, 'memory-legacy.docx');
  const updated = await draft.updateMeta('memory-legacy', { name: 'draft rename' });
  updated!.name = 'mutated returned metadata';
  assert.equal((await draft.listFiles()).find((file) => file.id === 'memory-legacy')?.name, 'draft rename');
  await draft.saveFile({ ...meta('memory-legacy'), name: 'draft rename' }, content('edited text'));
  assert.deepEqual(await legacy.loadContent('memory-legacy'), content('original text'));
  assert.equal((await legacy.listFiles()).find((file) => file.id === 'memory-legacy')?.name, 'memory-legacy.docx');
  await legacy.saveFile(meta('legacy-late'), content('created after snapshot'));
  assert.equal(await draft.loadContent('legacy-late'), undefined);
  await draft.removeFile('memory-legacy');
  assert.equal(await draft.loadContent('memory-legacy'), undefined);
  assert.deepEqual(await legacy.loadContent('memory-legacy'), content('original text'));
});

test('keeps version creation, restore and deletion isolated in draft memory', async () => {
  const legacy = createWorkspaceStorage(null);
  await legacy.saveFile(meta('memory-version'), content('legacy current'));
  const originalVersion = await legacy.saveVersion('memory-version', content('legacy previous'));
  const draft = createDraftWorkspaceStorage();
  assert.equal((await draft.listVersions('memory-version')).length, 1);
  const snapshot = content('draft previous');
  const created = await draft.saveVersion('memory-version', snapshot);
  snapshot.page.header = 'input mutation';
  created.content = content('return mutation');
  const history = await draft.listVersions('memory-version');
  assert.deepEqual(history[0].content, content('draft previous'));
  history[0].content = content('list mutation');
  const restored = await draft.restoreVersion('memory-version', created.id) as DocContent;
  restored.page.header = 'restore return mutation';
  assert.deepEqual(await draft.loadContent('memory-version'), content('draft previous'));
  await draft.deleteVersion('memory-version', originalVersion.id);
  assert.equal((await draft.listVersions('memory-version')).length, 1);
  assert.equal((await legacy.listVersions('memory-version')).length, 1);
  assert.deepEqual(await legacy.loadContent('memory-version'), content('legacy current'));
  assert.equal(await draft.restoreVersion('memory-version', 'missing'), null);
  await draft.removeFile('memory-version');
  assert.deepEqual(await draft.listVersions('memory-version'), []);
});

test('copies only the chosen draft to an account while keeping original and other drafts untouched', async () => {
  const legacy = createWorkspaceStorage(null);
  await legacy.saveFile(meta('chosen-draft'), content('legacy original'));
  const draft = createDraftWorkspaceStorage();
  await draft.saveFile(meta('chosen-draft'), content('latest draft'));
  await draft.saveFile(meta('unrelated-draft'), content('other draft'));
  const account = createWorkspaceStorage('explicit-draft-save');
  const chosen = (await draft.listFiles()).find((file) => file.id === 'chosen-draft')!;
  await account.saveFile(chosen, await draft.loadContent(chosen.id));
  assert.deepEqual(await account.loadContent('chosen-draft'), content('latest draft'));
  assert.deepEqual((await account.listFiles()).map((file) => file.id), ['chosen-draft']);
  assert.equal(await account.loadContent('unrelated-draft'), undefined);
  assert.deepEqual(await legacy.loadContent('chosen-draft'), content('legacy original'));
  assert.deepEqual(await draft.loadContent('chosen-draft'), content('latest draft'));
  assert.deepEqual(await draft.loadContent('unrelated-draft'), content('other draft'));
  const exported = await draft.exportBackup();
  exported.files[0].name = 'export mutation';
  exported.contents['chosen-draft'] = content('export mutation');
  assert.deepEqual(await draft.loadContent('chosen-draft'), content('latest draft'));
  assert.equal((await draft.listFiles())[0].name, 'unrelated-draft.docx');
});
