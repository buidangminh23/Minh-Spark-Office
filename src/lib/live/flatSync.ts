import type * as Y from 'yjs';

export type FlatState = Map<string, string>;

export function readFlat(map: Y.Map<unknown>): FlatState {
  const state: FlatState = new Map();
  map.forEach((value, key) => { if (typeof value === 'string') state.set(key, value); });
  return state;
}

export function diffFlat(current: FlatState, next: FlatState) {
  const set: Array<[string, string]> = [];
  const removed: string[] = [];
  next.forEach((value, key) => { if (current.get(key) !== value) set.push([key, value]); });
  current.forEach((_, key) => { if (!next.has(key)) removed.push(key); });
  return { set, removed };
}

export function writeFlat(map: Y.Map<unknown>, next: FlatState, origin?: unknown) {
  const { set, removed } = diffFlat(readFlat(map), next);
  if (!set.length && !removed.length) return 0;
  const doc = map.doc;
  const apply = () => {
    for (const key of removed) map.delete(key);
    for (const [key, value] of set) map.set(key, value);
  };
  if (doc) doc.transact(apply, origin);
  else apply();
  return set.length + removed.length;
}

export function parseJson<T>(text: string | undefined): T | undefined {
  if (text === undefined) return undefined;
  try { return JSON.parse(text) as T; } catch { return undefined; }
}
