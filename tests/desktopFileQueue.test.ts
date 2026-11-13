import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDesktopFileQueue, type DesktopFile, type DesktopFileBatch } from '../src/lib/desktopFileQueue.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(names: string[]) {
  const native = names.map((name, id) => ({ name, id }));
  const opened: string[] = [];
  const messages: string[] = [];
  const state = { editing: false, reads: 0, drains: 0 };
  const options = {
    isEditing: () => state.editing,
    drain: async (): Promise<DesktopFileBatch> => {
      state.drains++;
      const file = native.shift();
      return { files: file ? [file] : [], errors: [], hasMore: native.length > 0 };
    },
    read: async (_file: DesktopFile) => { state.reads++; return new ArrayBuffer(1); },
    open: async (file: File) => { opened.push(file.name); state.editing = true; return true; },
    notify: (message: string) => { messages.push(message); },
  };
  return { native, opened, messages, state, options };
}

test('a failed import continues to the next native file', async () => {
  const f = fixture(['broken.docx', 'valid.docx']);
  const attempts: string[] = [];
  const queue = createDesktopFileQueue({ ...f.options, open: async (file) => {
    attempts.push(file.name);
    return file.name === 'broken.docx' ? false : f.options.open(file);
  } });
  await queue.request();
  assert.deepEqual(attempts, ['broken.docx', 'valid.docx']);
  assert.deepEqual(f.opened, ['valid.docx']);
});

test('a failed native read continues to the next file', async () => {
  const f = fixture(['unreadable.docx', 'valid.docx']);
  const queue = createDesktopFileQueue({ ...f.options, read: async (file) => {
    if (file.name === 'unreadable.docx') throw 'File locked';
    return f.options.read(file);
  } });
  await queue.request();
  assert.deepEqual(f.opened, ['valid.docx']);
  assert.ok(f.messages.includes('File locked'));
});

test('a successful import defers further files until the editor closes', async () => {
  const f = fixture(['first.docx', 'second.docx']);
  const queue = createDesktopFileQueue(f.options);
  await queue.request();
  await queue.request(true);
  await queue.resume();
  assert.deepEqual(f.opened, ['first.docx']);
  assert.equal(f.native.length, 1);
  f.state.editing = false;
  await queue.resume();
  assert.deepEqual(f.opened, ['first.docx', 'second.docx']);
});

test('multiple files open in separate tabs and new arrivals open without closing the previous tab', async () => {
  const f = fixture(['first.docx', 'second.docx']);
  const queue = createDesktopFileQueue({ ...f.options, open: async (file) => {
    f.opened.push(file.name);
    return true;
  } });
  await queue.request();
  assert.deepEqual(f.opened, ['first.docx', 'second.docx']);
  f.native.push({ id: 2, name: 'third.pdf' });
  await queue.request();
  assert.deepEqual(f.opened, ['first.docx', 'second.docx', 'third.pdf']);
});

test('a cancelled password prompt or thrown import does not stall the queue', async () => {
  const f = fixture(['cancelled.xlsx', 'throws.docx', 'valid.docx']);
  const queue = createDesktopFileQueue({ ...f.options, open: async (file) => {
    if (file.name === 'cancelled.xlsx') return false;
    if (file.name === 'throws.docx') throw new Error('Invalid document');
    return f.options.open(file);
  } });
  await queue.request();
  assert.deepEqual(f.opened, ['valid.docx']);
  assert.ok(f.messages.includes('Invalid document'));
});

test('native errors without a descriptor continue to the next batch', async () => {
  const f = fixture(['valid.docx']);
  let first = true;
  const queue = createDesktopFileQueue({ ...f.options, drain: async () => {
    if (!first) return f.options.drain();
    first = false;
    return { files: [], errors: ['Missing file'], hasMore: true };
  } });
  await queue.request();
  assert.deepEqual(f.opened, ['valid.docx']);
  assert.ok(f.messages.includes('Missing file'));
});

test('reentrant requests are serialized and remember arrivals during an import', async () => {
  const f = fixture(['broken.docx']);
  const result = deferred<boolean>();
  const queue = createDesktopFileQueue({ ...f.options, open: async (file) => {
    if (file.name === 'broken.docx') return result.promise;
    return f.options.open(file);
  } });
  const first = queue.request();
  await new Promise((done) => setImmediate(done));
  f.native.push({ id: 2, name: 'arrived.docx' });
  const second = queue.request(true);
  assert.equal(first, second);
  assert.equal(f.state.drains, 1);
  result.resolve(false);
  await first;
  assert.deepEqual(f.opened, ['arrived.docx']);
  assert.equal(f.state.drains, 2);
});

test('an editor opened during a native read preserves the waiting file', async () => {
  const f = fixture(['waiting.docx']);
  const bytes = deferred<ArrayBuffer>();
  const queue = createDesktopFileQueue({ ...f.options, read: async () => {
    f.state.reads++;
    return bytes.promise;
  } });
  const running = queue.request();
  await new Promise((done) => setImmediate(done));
  f.state.editing = true;
  bytes.resolve(new ArrayBuffer(1));
  await running;
  assert.deepEqual(f.opened, []);
  f.state.editing = false;
  await queue.resume();
  assert.deepEqual(f.opened, ['waiting.docx']);
  assert.equal(f.state.reads, 1);
});

test('cleanup prevents an in-flight read from opening a document', async () => {
  const f = fixture(['waiting.docx']);
  const bytes = deferred<ArrayBuffer>();
  const queue = createDesktopFileQueue({ ...f.options, read: () => bytes.promise });
  const running = queue.request();
  await new Promise((done) => setImmediate(done));
  queue.stop();
  bytes.resolve(new ArrayBuffer(1));
  await running;
  await queue.request();
  assert.deepEqual(f.opened, []);
});

test('a drain failure reports once and permits a later explicit retry', async () => {
  const f = fixture(['valid.docx']);
  let failed = false;
  const queue = createDesktopFileQueue({ ...f.options, drain: async () => {
    if (failed) return f.options.drain();
    failed = true;
    throw new Error('IPC unavailable');
  } });
  await queue.request();
  assert.equal(f.messages.length, 1);
  assert.deepEqual(f.opened, []);
  await queue.request();
  assert.deepEqual(f.opened, ['valid.docx']);
});
