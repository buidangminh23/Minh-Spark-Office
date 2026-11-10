import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkspaceStorage, defaultPage, type DocContent, type FileMeta } from '../src/lib/storage.ts';
import { createSyncedWorkspace, createSyncStateStore } from '../src/lib/syncEngine.ts';
import { RemoteConflictError, type RemoteRecord, type RemoteWorkspace } from '../src/lib/syncTypes.ts';
import { saveAccountSnapshot } from '../src/lib/accountSnapshots.ts';

const content = (text: string): DocContent => ({ kind: 'doc', page: defaultPage(), json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
const meta = (id: string): FileMeta => ({ id, name: `${id}.docx`, kind: 'doc', createdAt: 1, updatedAt: 1, openedAt: 1, starred: false, deletedAt: null, size: 1, preview: '' });
let sequence = 0;
class FakeRemote implements RemoteWorkspace {
  records = new Map<string, RemoteRecord>();
  listeners = new Set<() => void>();
  online = true;
  beforeWrite?: () => Promise<void>;
  revision = 0;
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  check() { if (!this.online) throw Object.assign(new Error('Offline'), { code: 'unavailable' }); }
  async list() { this.check(); return [...this.records.values()].map(({ id, revision, deleted }) => ({ id, revision, deleted })); }
  async read(id: string) { this.check(); return structuredClone(this.records.get(id) ?? null); }
  async write(record: RemoteRecord, expected: string | null) {
    this.check();
    await this.beforeWrite?.();
    const current = this.records.get(record.id) ?? null;
    if ((current?.revision ?? null) !== expected) throw new RemoteConflictError(structuredClone(current));
    const revision = `${++this.revision}`;
    this.records.set(record.id, structuredClone({ ...record, revision }));
    for (const listener of this.listeners) listener();
    return revision;
  }
}
function client(remote: FakeRemote, uid = 'same-account', device = `device-${++sequence}`) {
  const local = createWorkspaceStorage(device);
  const state = createSyncStateStore(device);
  return { local, state, workspace: createSyncedWorkspace(uid, local, remote, state), reopen: () => createSyncedWorkspace(uid, local, remote, state) };
}

test('two devices transfer document content, metadata, versions, restore, trash, and permanent delete', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  const b = client(remote).workspace;
  await a.saveFile(meta('document'), content('initial'));
  await a.syncNow(); await b.syncNow();
  assert.deepEqual(await b.loadContent('document'), content('initial'));
  await a.updateMeta('document', { name: 'renamed', starred: true, deletedAt: 15 });
  const version = await a.saveVersion('document', content('history'), 'old');
  await a.syncNow(); await b.syncNow();
  assert.equal((await b.listFiles())[0].name, 'renamed');
  assert.equal((await b.listFiles())[0].starred, true);
  assert.equal((await b.listFiles())[0].deletedAt, 15);
  assert.equal((await b.listVersions('document'))[0].id, version.id);
  await b.restoreVersion('document', version.id);
  await b.updateMeta('document', { deletedAt: null });
  await b.syncNow(); await a.syncNow();
  assert.deepEqual(await a.loadContent('document'), content('history'));
  await a.deleteVersion('document', version.id);
  await a.syncNow(); await b.syncNow();
  assert.deepEqual(await b.listVersions('document'), []);
  await a.removeFile('document');
  await a.syncNow(); await b.syncNow();
  assert.deepEqual(await b.listFiles(), []);
  assert.equal(await b.loadContent('document'), undefined);
  assert.equal(remote.records.get('document')?.deleted, true);
});

test('offline outbox survives reopening and uploads backup imports', async () => {
  const remote = new FakeRemote();
  remote.online = false;
  const device = client(remote);
  await device.workspace.saveFile(meta('offline'), content('saved offline'));
  await device.workspace.syncNow();
  assert.equal(device.workspace.getStatus().state, 'offline');
  const reopened = device.reopen();
  assert.deepEqual(await reopened.loadContent('offline'), content('saved offline'));
  await reopened.importBackup({ format: 'minh-office-backup', files: [meta('backup')], contents: { backup: content('backup contents') } });
  remote.online = true;
  await reopened.syncNow();
  assert.equal(reopened.getStatus().state, 'synced');
  const second = client(remote).workspace;
  await second.syncNow();
  assert.equal((await second.listFiles()).length, 2);
});

test('concurrent edits create a distinct conflict copy and preserve the remote original', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  const b = client(remote).workspace;
  await a.saveFile(meta('shared'), content('original'));
  await a.syncNow(); await b.syncNow();
  await a.saveFile(meta('shared'), content('first edit'));
  await b.saveFile(meta('shared'), content('second edit'));
  await a.syncNow(); await b.syncNow(); await a.syncNow();
  const files = await b.listFiles();
  assert.equal(files.length, 2);
  const conflict = files.find((file) => file.id !== 'shared')!;
  assert.match(conflict.name, /bản xung đột/);
  assert.deepEqual(await b.loadContent('shared'), content('first edit'));
  assert.deepEqual(await b.loadContent(conflict.id), content('second edit'));
  assert.equal((await a.listFiles()).length, 2);
});

test('editing during an upload retains a new generation with the acknowledged base', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  await a.saveFile(meta('during'), content('first'));
  let entered!: () => void;
  const uploading = new Promise<void>((resolve) => { entered = resolve; });
  let resume!: () => void;
  const wait = new Promise<void>((resolve) => { resume = resolve; });
  remote.beforeWrite = async () => { remote.beforeWrite = undefined; entered(); await wait; };
  const syncing = a.syncNow();
  await uploading;
  await a.saveFile(meta('during'), content('second'));
  resume();
  await syncing;
  assert.deepEqual(remote.records.get('during')?.content, content('second'));
  assert.equal(a.getStatus().pending, 0);
  assert.equal(remote.records.size, 1);
});

test('offline delete versus concurrent remote edit preserves the edited original', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  const b = client(remote).workspace;
  await a.saveFile(meta('delete-edit'), content('original'));
  await a.syncNow(); await b.syncNow();
  await b.removeFile('delete-edit');
  await a.saveFile(meta('delete-edit'), content('keep edited'));
  await a.syncNow(); await b.syncNow();
  assert.deepEqual(await b.loadContent('delete-edit'), content('keep edited'));
  assert.equal(remote.records.get('delete-edit')?.deleted, false);
});

test('remote delete versus offline local edit preserves the edit as a distinct file', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  const b = client(remote).workspace;
  await a.saveFile(meta('deleted'), content('original'));
  await a.syncNow(); await b.syncNow();
  await b.saveFile(meta('deleted'), content('keep edited'));
  await a.removeFile('deleted');
  await a.syncNow(); await b.syncNow();
  assert.equal(await b.loadContent('deleted'), undefined);
  const files = await b.listFiles();
  assert.equal(files.length, 1);
  assert.notEqual(files[0].id, 'deleted');
  assert.deepEqual(await b.loadContent(files[0].id), content('keep edited'));
});

test('account-local migration preserves collisions and never imports guest drafts', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  await a.saveFile(meta('existing'), content('remote'));
  await a.syncNow();
  const device = client(remote);
  await device.local.saveFile(meta('existing'), content('old local'));
  const guest = createWorkspaceStorage(null);
  await guest.saveFile(meta('guest-only'), content('private draft'));
  await device.workspace.syncNow();
  assert.equal((await device.workspace.listFiles()).length, 2);
  assert.deepEqual(await device.workspace.loadContent('existing'), content('remote'));
  assert.equal(remote.records.has('guest-only'), false);
});

test('durable snapshot recovers interruption between outbox persistence and local write', async () => {
  const remote = new FakeRemote();
  const device = client(remote);
  const broken = { ...device.local, replaceFile: async () => { throw new Error('Simulated interrupted local write'); } };
  const a = createSyncedWorkspace('crash-account', broken, remote, device.state);
  await assert.rejects(a.saveFile(meta('crash'), content('recover me')));
  const recovered = device.reopen();
  assert.deepEqual(await recovered.loadContent('crash'), content('recover me'));
  await recovered.syncNow();
  assert.deepEqual(remote.records.get('crash')?.content, content('recover me'));
});

test('stopping cancels subscriptions and late uploads remain bound to their original account', async () => {
  const firstRemote = new FakeRemote();
  const secondRemote = new FakeRemote();
  const first = client(firstRemote, 'first-account');
  const second = client(secondRemote, 'second-account').workspace;
  const stop = first.workspace.start();
  assert.equal(firstRemote.listeners.size, 1);
  await first.workspace.saveFile(meta('private'), content('first account'));
  let entered!: () => void;
  const uploading = new Promise<void>((resolve) => { entered = resolve; });
  let resume!: () => void;
  const wait = new Promise<void>((resolve) => { resume = resolve; });
  firstRemote.beforeWrite = async () => { firstRemote.beforeWrite = undefined; entered(); await wait; };
  const syncing = first.workspace.syncNow();
  await uploading;
  stop(); stop();
  assert.equal(firstRemote.listeners.size, 0);
  await second.saveFile(meta('second'), content('second account'));
  await second.syncNow();
  resume(); await syncing;
  assert.equal(secondRemote.records.has('private'), false);
  assert.equal(await second.loadContent('private'), undefined);
  const recovered = first.reopen();
  await recovered.syncNow();
  assert.equal((await recovered.listFiles()).length, 1);
  assert.equal(recovered.getStatus().pending, 0);
});

test('active editors defer remote adoption and preserve subsequent edits until close', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  const b = client(remote).workspace;
  await a.saveFile(meta('active'), content('original'));
  await a.syncNow(); await b.syncNow();
  b.setActiveFile('active');
  await a.saveFile(meta('active'), content('remote update'));
  await a.syncNow(); await b.syncNow();
  assert.deepEqual(await b.loadContent('active'), content('original'));
  await b.saveFile(meta('active'), content('local edit after remote update'));
  await b.syncNow();
  assert.equal(b.getStatus().pending, 1);
  assert.match(b.getStatus().message!, /Đóng tài liệu/);
  assert.deepEqual(remote.records.get('active')?.content, content('remote update'));
  await b.saveFile(meta('active'), content('latest local edit'));
  b.setActiveFile(null);
  await b.syncNow();
  const copy = (await b.listFiles()).find((file) => file.id !== 'active')!;
  assert.deepEqual(await b.loadContent(copy.id), content('latest local edit'));
  assert.deepEqual(await b.loadContent('active'), content('remote update'));
  assert.equal(b.getStatus().pending, 0);
});

test('an interrupted remote adoption is replayed on reopening', async () => {
  const remote = new FakeRemote();
  const a = client(remote).workspace;
  await a.saveFile(meta('incoming'), content('remote contents'));
  await a.syncNow();
  const device = client(remote);
  const broken = { ...device.local, replaceFile: async () => { throw new Error('Interrupted download'); } };
  const b = createSyncedWorkspace('download-crash', broken, remote, device.state);
  await b.syncNow();
  assert.equal(b.getStatus().state, 'error');
  const recovered = device.reopen();
  assert.deepEqual(await recovered.loadContent('incoming'), content('remote contents'));
  await recovered.syncNow();
  assert.equal((await recovered.listFiles()).length, 1);
});

test('an active tab keeps its editor base when a sibling tab advances shared IndexedDB', async () => {
  const remote = new FakeRemote();
  const firstDevice = client(remote).workspace;
  const secondDevice = client(remote);
  const editingTab = secondDevice.workspace;
  const siblingTab = secondDevice.reopen();
  await firstDevice.saveFile(meta('tab-shared'), content('original'));
  await firstDevice.syncNow(); await editingTab.syncNow();
  editingTab.setActiveFile('tab-shared');
  await editingTab.loadContent('tab-shared');
  await firstDevice.saveFile(meta('tab-shared'), content('remote edit'));
  await firstDevice.syncNow(); await siblingTab.syncNow();
  await editingTab.saveFile(meta('tab-shared'), content('stale editor changes'));
  await editingTab.syncNow();
  assert.deepEqual(remote.records.get('tab-shared')?.content, content('remote edit'));
  editingTab.setActiveFile(null);
  await editingTab.syncNow();
  const copy = (await editingTab.listFiles()).find((file) => file.id !== 'tab-shared')!;
  assert.deepEqual(await editingTab.loadContent(copy.id), content('stale editor changes'));
  assert.deepEqual(await editingTab.loadContent('tab-shared'), content('remote edit'));
});

for (const uploader of ['editing', 'sibling'] as const) {
  test(`an active tab adopts the base when a sibling tab uploads its own edit (next pass by ${uploader} tab)`, async () => {
    const remote = new FakeRemote();
    const device = client(remote);
    const editingTab = device.workspace;
    const siblingTab = device.reopen();
    await editingTab.saveFile(meta('own-upload'), content('original'));
    await editingTab.syncNow();
    editingTab.setActiveFile('own-upload');
    await editingTab.loadContent('own-upload');
    await editingTab.saveFile(meta('own-upload'), content('first edit'));
    await siblingTab.syncNow();
    assert.deepEqual(remote.records.get('own-upload')?.content, content('first edit'));
    await editingTab.saveFile(meta('own-upload'), content('second edit'));
    await (uploader === 'editing' ? editingTab : siblingTab).syncNow();
    assert.deepEqual(remote.records.get('own-upload')?.content, content('second edit'));
    assert.equal(remote.records.size, 1);
    assert.equal((await editingTab.listFiles()).length, 1);
    assert.deepEqual(await editingTab.loadContent('own-upload'), content('second edit'));
    assert.deepEqual(Object.keys((await device.state.read()).pending), []);
    assert.notEqual(editingTab.getStatus().state, 'error');
    await editingTab.saveFile(meta('own-upload'), content('third edit'));
    await siblingTab.syncNow();
    await editingTab.saveFile(meta('own-upload'), content('fourth edit'));
    await editingTab.syncNow();
    assert.deepEqual(remote.records.get('own-upload')?.content, content('fourth edit'));
    assert.equal(remote.records.size, 1);
  });
}

test('a file rejected by the cloud stays local without blocking other pending files', async () => {
  const remote = new FakeRemote();
  const write = remote.write.bind(remote);
  let rejected = 0;
  remote.write = async (record, expected) => {
    if (record.id === 'too-large') { rejected++; throw new Error('Tài liệu quá lớn để đồng bộ. Bản cục bộ vẫn được giữ.'); }
    return write(record, expected);
  };
  const a = client(remote).workspace;
  await a.saveFile(meta('too-large'), content('large file'));
  await a.saveFile(meta('normal'), content('normal file'));
  await a.syncNow();
  assert.equal(rejected, 1);
  assert.deepEqual(remote.records.get('normal')?.content, content('normal file'));
  assert.deepEqual(await a.loadContent('too-large'), content('large file'));
  assert.equal(a.getStatus().pending, 1);
  assert.equal(a.getStatus().state, 'error');
});

test('remote adoption retries in the same engine after a temporary local write failure', async () => {
  const remote = new FakeRemote();
  const source = client(remote).workspace;
  await source.saveFile(meta('retry-incoming'), content('remote copy'));
  await source.syncNow();
  const device = client(remote);
  let failOnce = true;
  const storage = { ...device.local, replaceFile: async (...args: Parameters<typeof device.local.replaceFile>) => {
    if (failOnce) { failOnce = false; throw new Error('Temporary local storage error'); }
    return device.local.replaceFile(...args);
  } };
  const target = createSyncedWorkspace('retry-account', storage, remote, device.state);
  await target.syncNow();
  assert.equal(target.getStatus().state, 'error');
  await target.syncNow();
  assert.deepEqual(await target.loadContent('retry-incoming'), content('remote copy'));
  assert.equal(target.getStatus().state, 'synced');
});

test('two open tabs preserve both unsent edits in their shared local outbox', async () => {
  const remote = new FakeRemote();
  const device = client(remote);
  const first = device.workspace;
  const second = device.reopen();
  await first.saveFile(meta('two-tabs'), content('original'));
  await first.syncNow();
  first.setActiveFile('two-tabs');
  second.setActiveFile('two-tabs');
  await first.loadContent('two-tabs');
  await second.loadContent('two-tabs');
  await first.saveFile(meta('two-tabs'), content('first tab edit'));
  await second.saveFile(meta('two-tabs'), content('second tab edit'));
  first.setActiveFile(null);
  second.setActiveFile(null);
  await second.syncNow();
  const files = await first.listFiles();
  assert.equal(files.length, 2);
  const copy = files.find((file) => file.id !== 'two-tabs')!;
  assert.deepEqual(await first.loadContent(copy.id), content('first tab edit'));
  assert.deepEqual(await first.loadContent('two-tabs'), content('second tab edit'));
  assert.equal(remote.records.size, 2);
});

test('guest snapshot copies chosen history under a new ID without overwriting an account document', async () => {
  const accountId = `snapshot-target-${++sequence}`;
  const guest = createWorkspaceStorage(`snapshot-draft-${sequence}`);
  await guest.saveFile(meta('collision'), content('guest draft'));
  const originalVersion = await guest.saveVersion('collision', content('guest history'), 'previous guest version');
  const accountLocal = createWorkspaceStorage(accountId);
  await accountLocal.saveFile(meta('collision'), content('existing account document'));
  const saved = await saveAccountSnapshot({ accountId, sourceUserId: undefined, sourceStorage: guest, meta: meta('collision'), content: content('new guest snapshot'), label: 'chosen snapshot' });
  assert.notEqual(saved.meta.id, 'collision');
  assert.deepEqual(await accountLocal.loadContent('collision'), content('existing account document'));
  assert.deepEqual(await accountLocal.loadContent(saved.meta.id), content('new guest snapshot'));
  assert.deepEqual(await guest.loadContent('collision'), content('guest draft'));
  const versions = await saved.storage.listVersions(saved.meta.id);
  assert.equal(versions.length, 2);
  assert.equal(versions[1].id, originalVersion.id);
  assert.ok(versions.every((version) => version.fileId === saved.meta.id));
  const outbox = await createSyncStateStore(accountId).read();
  assert.equal(outbox.pending[saved.meta.id].record.versions.length, 2);
});

test('signed-in snapshot writes its content and version through the durable sync outbox', async () => {
  const accountId = `signed-snapshot-${++sequence}`;
  const sourceStorage = createWorkspaceStorage(accountId);
  await sourceStorage.saveFile(meta('signed-snapshot'), content('original'));
  const saved = await saveAccountSnapshot({ accountId, sourceUserId: accountId, sourceStorage, meta: meta('signed-snapshot'), content: content('latest'), label: 'snapshot' });
  assert.equal(saved.meta.id, 'signed-snapshot');
  const outbox = await createSyncStateStore(accountId).read();
  assert.deepEqual(outbox.pending['signed-snapshot'].record.content, content('latest'));
  assert.equal(outbox.pending['signed-snapshot'].record.versions[0].id, saved.version.id);
});
