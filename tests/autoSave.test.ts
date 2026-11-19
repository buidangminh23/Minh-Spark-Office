import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/lib/appSettings';
import { isNewerThanSaved, unsavedKey, type UnsavedCopy } from '../src/lib/unsavedChanges';
import type { FileMeta } from '../src/lib/storage';

const meta = (updatedAt: number): FileMeta => ({ id: 'doc-1', name: 'A.docx', kind: 'doc', createdAt: 0, updatedAt, openedAt: 0, starred: false, deletedAt: null, size: 0, preview: '' });
const copy = (at: number, kind: 'doc' | 'sheet' = 'doc') => ({ meta: meta(0), content: kind === 'doc' ? { kind: 'doc', json: {} } : { kind: 'sheet', workbook: {} }, at }) as unknown as UnsavedCopy;

test('auto save is off by default', () => {
  assert.equal(DEFAULT_SETTINGS.autoSave, false);
});

test('unsaved changes are offered only when newer than the saved file and of the same kind', () => {
  assert.equal(isNewerThanSaved(copy(200), meta(100)), true);
  assert.equal(isNewerThanSaved(copy(100), meta(100)), false);
  assert.equal(isNewerThanSaved(copy(200, 'sheet'), meta(100)), false);
  assert.equal(isNewerThanSaved(null, meta(100)), false);
});

test('unsaved changes are kept per account', () => {
  assert.notEqual(unsavedKey('uid-a', 'doc-1'), unsavedKey(null, 'doc-1'));
  assert.equal(unsavedKey(null, 'doc-1'), 'local:doc-1');
});
