import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { FileContent, FileMeta } from './storage';

export type UnsavedCopy = { meta: FileMeta; content: FileContent; at: number };

let store: UseStore | null = null;
const unsavedStore = () => (store ??= createStore('minh-office-unsaved', 'changes'));

export const unsavedKey = (scope: string | null, fileId: string) => `${scope ?? 'local'}:${fileId}`;

export async function keepUnsaved(scope: string | null, meta: FileMeta, content: FileContent, at = Date.now()) {
  await set(unsavedKey(scope, meta.id), { meta, content, at } satisfies UnsavedCopy, unsavedStore());
}

export async function readUnsaved(scope: string | null, fileId: string): Promise<UnsavedCopy | null> {
  const value = await get<UnsavedCopy>(unsavedKey(scope, fileId), unsavedStore());
  return value && value.content && value.meta ? value : null;
}

export async function discardUnsaved(scope: string | null, fileId: string) {
  await del(unsavedKey(scope, fileId), unsavedStore());
}

export function isNewerThanSaved(copy: UnsavedCopy | null, meta: FileMeta) {
  return Boolean(copy && copy.content.kind === meta.kind && copy.at > meta.updatedAt);
}
