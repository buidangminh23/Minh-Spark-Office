import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { createDesktopCloseHandler, installAfterDocumentSave } from '../src/lib/desktopClose.ts';
import { createDocumentCloseRegistry } from '../src/lib/documentCloser.ts';
import { acquireWorkspaceExit, createWorkspaceLifecycle, trackWorkspaceOperation } from '../src/lib/workspaceLifecycle.ts';
import { createDesktopFileQueue } from '../src/lib/desktopFileQueue.ts';
import { createWorkspaceStorage, defaultPage, type FileMeta, type DocContent } from '../src/lib/storage.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('native close waits for durable storage and saves without navigating away', async () => {
  const userId = `close-${crypto.randomUUID()}`;
  const storage = createWorkspaceStorage(userId);
  const meta: FileMeta = { id: 'draft', name: 'Last keystroke', kind: 'doc', createdAt: 1, updatedAt: 2, size: 0, starred: false, deletedAt: null, preview: '' };
  const content: DocContent = { kind: 'doc', page: defaultPage(), json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Just typed' }] }] } };
  const gate = deferred<void>();
  const registry = createDocumentCloseRegistry();
  let navigation = false;
  registry.register(async (close) => {
    await gate.promise;
    await storage.saveFile(meta, content);
    navigation = close;
    return true;
  });
  const exits: number[] = [];
  const busy: boolean[] = [];
  let prepared = false;
  const close = createDesktopCloseHandler({
    prepare: () => { prepared = true; },
    save: () => registry.save(false, true),
    finish: async (id, saved) => {
      assert.ok(saved);
      assert.deepEqual(await storage.loadContent(meta.id), content);
      exits.push(id);
    },
    setBusy: (value) => busy.push(value),
    reportFailure: () => assert.fail('Unexpected save failure'),
  });
  const first = close(1);
  assert.equal(close(1), first);
  await Promise.resolve();
  assert.ok(prepared);
  assert.deepEqual(exits, []);
  assert.deepEqual(busy, [true]);
  gate.resolve();
  await first;
  assert.deepEqual(exits, [1]);
  assert.equal(navigation, false);
  assert.deepEqual(busy, [true]);
  assert.deepEqual(await createWorkspaceStorage(userId).loadContent(meta.id), content);
});

test('failed or rejected saves keep the app open and permit retry', async () => {
  for (const throws of [false, true]) {
    const registry = createDocumentCloseRegistry();
    let attempt = 0;
    registry.register(async () => {
      if (++attempt === 1) {
        if (throws) throw new Error('Quota exceeded');
        return false;
      }
      return true;
    });
    const replies: boolean[] = [];
    let errors = 0;
    const close = createDesktopCloseHandler({
      prepare() {}, save: () => registry.save(false, true),
      finish: async (_id, saved) => { replies.push(saved); },
      setBusy() {}, reportFailure: () => { errors++; },
    });
    await close(1);
    await close(2);
    assert.deepEqual(replies, [false, true]);
    assert.equal(errors, 1);
  }
});

test('IPC failure reports an error and retries instead of discarding the document', async () => {
  let attempts = 0;
  let errors = 0;
  const close = createDesktopCloseHandler({
    prepare() {}, save: async () => true,
    finish: async () => { if (++attempts === 1) throw new Error('Disconnected'); },
    setBusy() {}, reportFailure: () => { errors++; },
  });
  await close(1);
  await close(1);
  assert.equal(attempts, 2);
  assert.equal(errors, 1);
});

test('registry distinguishes an empty workspace, updater navigation and replaced editors', async () => {
  const registry = createDocumentCloseRegistry();
  assert.equal(await registry.save(false, true), true);
  assert.equal(await registry.save(true), false);
  const oldCleanup = registry.register(async () => assert.fail('Stale editor called'));
  let navigate: boolean | undefined;
  const cleanup = registry.register(async (close) => { navigate = close; return true; });
  oldCleanup();
  assert.equal(await registry.save(true), true);
  assert.equal(navigate, true);
  cleanup();
  assert.equal(await registry.save(false, true), true);
});

test('overlapping updater and native close requests share a pending durable save', async () => {
  const registry = createDocumentCloseRegistry();
  const gate = deferred<boolean>();
  let calls = 0;
  registry.register(async () => { calls++; return gate.promise; });
  const updater = registry.save(true);
  const native = registry.save(false, true);
  assert.equal(updater, native);
  gate.resolve(true);
  assert.equal(await native, true);
  assert.equal(calls, 1);
});

test('a pending document mutation refuses quit without clearing its busy overlay', async () => {
  const lifecycle = createWorkspaceLifecycle();
  const operation = Symbol('pdf-signature');
  lifecycle.setBusy(operation, true);
  let content = 'unsigned';
  let savedContent: string | undefined;
  const replies: boolean[] = [];
  const busy: boolean[] = [];
  const close = createDesktopCloseHandler({
    acquire: () => acquireWorkspaceExit(lifecycle, null),
    prepare() {},
    save: async () => { savedContent = content; return true; },
    finish: async (_id, saved) => { replies.push(saved); },
    setBusy: (value) => busy.push(value),
    reportFailure() {},
  });
  await close(1);
  assert.deepEqual(replies, [false]);
  assert.deepEqual(busy, []);
  assert.equal(savedContent, undefined);
  assert.equal(lifecycle.isBlocked(), true);
  content = 'signed';
  lifecycle.setBusy(operation, false);
  await close(2);
  assert.equal(savedContent, 'signed');
  assert.deepEqual(replies, [false, true]);
  assert.equal(lifecycle.isBlocked(), true);
});

test('failed native save restores input and successful save locks it until process exit', async () => {
  const lifecycle = createWorkspaceLifecycle();
  const target = new EventTarget();
  const gate = deferred<boolean>();
  let attempt = 0;
  const close = createDesktopCloseHandler({
    acquire: () => acquireWorkspaceExit(lifecycle, target),
    prepare() {},
    save: async () => ++attempt === 1 ? gate.promise : true,
    finish: async () => {},
    setBusy() {}, reportFailure() {},
  });
  const pending = close(1);
  for (const name of ['keydown', 'beforeinput', 'paste', 'click', 'drop']) {
    assert.equal(target.dispatchEvent(new Event(name, { cancelable: true })), false);
  }
  gate.resolve(false);
  await pending;
  assert.equal(lifecycle.isBlocked(), false);
  assert.equal(target.dispatchEvent(new Event('keydown', { cancelable: true })), true);
  await close(2);
  assert.equal(lifecycle.isBlocked(), true);
  assert.equal(target.dispatchEvent(new Event('keydown', { cancelable: true })), false);
});

test('update saves without navigation and blocks queued files throughout installation', async () => {
  const lifecycle = createWorkspaceLifecycle();
  const registry = createDocumentCloseRegistry();
  const installGate = deferred<void>();
  let editing = true;
  let opened = 0;
  let saved = false;
  registry.register(async (navigate) => { saved = true; if (navigate) editing = false; return true; });
  const queue = createDesktopFileQueue({
    isEditing: () => editing || lifecycle.isBlocked(),
    drain: async () => ({ files: [{ id: 1, name: 'queued.txt' }], errors: [], hasMore: false }),
    read: async () => new ArrayBuffer(0),
    open: async () => { opened++; return true; },
    notify() {},
  });
  const installing = installAfterDocumentSave({
    acquire: () => acquireWorkspaceExit(lifecycle, null),
    prepare() {},
    save: () => registry.save(false, true),
    install: () => installGate.promise,
  });
  await Promise.resolve();
  await queue.request();
  assert.equal(editing, true);
  assert.equal(opened, 0);
  assert.equal(saved, true);
  assert.equal(lifecycle.isBlocked(), true);
  installGate.resolve();
  assert.equal(await installing, 'installing');
  assert.equal(lifecycle.isBlocked(), true);
  queue.stop();
});

test('update rejects pending operations and releases its lock on save or install failures', async () => {
  for (const failure of ['busy', 'save', 'prepare', 'install']) {
    const lifecycle = createWorkspaceLifecycle();
    const owner = Symbol('operation');
    if (failure === 'busy') lifecycle.setBusy(owner, true);
    let installed = false;
    const result = await installAfterDocumentSave({
      acquire: () => acquireWorkspaceExit(lifecycle, null),
      prepare() { if (failure === 'prepare') throw new Error('Blur failed'); },
      save: async () => failure !== 'save',
      install: async () => { installed = true; throw new Error('Installer failed'); },
    });
    assert.equal(result, failure === 'busy' ? 'blocked' : failure === 'install' ? 'install-failed' : 'save-failed');
    assert.equal(installed, failure === 'install');
    assert.equal(lifecycle.isBlocked(), failure === 'busy');
    lifecycle.setBusy(owner, false);
    assert.equal(lifecycle.isBlocked(), false);
  }
});

test('a save that never answers releases input instead of freezing the app', async () => {
  const lifecycle = createWorkspaceLifecycle();
  let installed = false;
  const update = await installAfterDocumentSave({
    acquire: () => acquireWorkspaceExit(lifecycle, null),
    prepare() {},
    save: () => new Promise<boolean>(() => undefined),
    install: async () => { installed = true; },
    saveTimeoutMs: 20,
  });
  assert.equal(update, 'save-failed');
  assert.equal(installed, false);
  assert.equal(lifecycle.isBlocked(), false);
  const failures: number[] = [];
  const close = createDesktopCloseHandler({
    acquire: () => acquireWorkspaceExit(lifecycle, null),
    prepare() {},
    save: () => new Promise<boolean>(() => undefined),
    finish: async () => undefined,
    setBusy() {},
    reportFailure: () => { failures.push(1); },
    saveTimeoutMs: 20,
  });
  await close(1);
  assert.equal(failures.length, 1);
  assert.equal(lifecycle.isBlocked(), false);
});

test('blur can commit its final input before exit blocks subsequent edits', async () => {
  const lifecycle = createWorkspaceLifecycle();
  const target = new EventTarget();
  let text = 'before composition';
  let saved = '';
  const close = createDesktopCloseHandler({
    acquire: () => acquireWorkspaceExit(lifecycle, target),
    prepare() {
      assert.equal(target.dispatchEvent(new Event('beforeinput', { cancelable: true })), true);
      text = 'final composition';
    },
    save: async () => {
      saved = text;
      assert.equal(target.dispatchEvent(new Event('beforeinput', { cancelable: true })), false);
      return true;
    },
    finish: async () => {}, setBusy() {}, reportFailure() {},
  });
  await close(1);
  assert.equal(saved, 'final composition');
});

test('overlapping image operations keep exit blocked until every earlier write completes', async () => {
  const lifecycle = createWorkspaceLifecycle();
  const firstGate = deferred<void>();
  const secondGate = deferred<void>();
  let durableImage = '';
  const firstSave = trackWorkspaceOperation(async () => {
    await firstGate.promise;
    durableImage = 'older image';
  }, lifecycle);
  const secondSave = trackWorkspaceOperation(async () => {
    await secondGate.promise;
    durableImage = 'newer image';
  }, lifecycle);
  const replies: boolean[] = [];
  const close = createDesktopCloseHandler({
    acquire: () => acquireWorkspaceExit(lifecycle, null),
    prepare() {},
    save: () => trackWorkspaceOperation(async () => { durableImage = 'final image'; return true; }, lifecycle),
    finish: async (_id, saved) => { replies.push(saved); }, setBusy() {}, reportFailure() {},
  });
  await close(1);
  secondGate.resolve();
  await secondSave;
  assert.equal(lifecycle.isBlocked(), true);
  await close(2);
  firstGate.resolve();
  await firstSave;
  assert.equal(durableImage, 'older image');
  assert.equal(lifecycle.isBlocked(), false);
  await close(3);
  assert.deepEqual(replies, [false, false, true]);
  assert.equal(durableImage, 'final image');
  assert.equal(lifecycle.isBlocked(), true);
});
