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

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export function sameContent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b) || a instanceof ArrayBuffer || b instanceof ArrayBuffer) {
    const left = a instanceof ArrayBuffer ? new Uint8Array(a) : ArrayBuffer.isView(a) ? new Uint8Array(a.buffer, a.byteOffset, a.byteLength) : null;
    const right = b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null;
    if (!left || !right || left.length !== right.length) return false;
    return left.every((byte, index) => byte === right[index]);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameContent(item, b[index]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const leftKeys = Object.keys(a);
  const rightKeys = Object.keys(b);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameContent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

const DERIVED_FIELDS: Partial<Record<FileContent['kind'], readonly string[]>> = { pdf: ['pageCount'] };

export function comparableContent(content: FileContent): Record<string, unknown> {
  const derived = DERIVED_FIELDS[content.kind] ?? [];
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (derived.includes(key) || value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    result[key] = value;
  }
  return result;
}

export function sameDocument(a: FileContent | null | undefined, b: FileContent | null | undefined) {
  if (!a || !b) return a === b;
  return a.kind === b.kind && sameContent(comparableContent(a), comparableContent(b));
}

export function hasRealUnsavedChanges(copy: UnsavedCopy | null, meta: FileMeta, saved: FileContent) {
  return isNewerThanSaved(copy, meta) && !sameDocument(copy?.content, saved);
}
