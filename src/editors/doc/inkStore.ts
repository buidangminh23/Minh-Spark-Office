import { useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';
import type { InkKind, InkStroke } from '../../lib/storage';
import { newId, type DocCtx } from './DocContext';

export type PenPreset = { id: string; label: string; kind: InkKind; color: string; width: number };

const PENS_KEY = 'minh-docs-pens';
const HISTORY_LIMIT = 200;

export const DEFAULT_PENS: PenPreset[] = [
  { id: 'pen-black', label: 'Bút đen', kind: 'pen', color: '#111827', width: 2 },
  { id: 'pen-red', label: 'Bút đỏ', kind: 'pen', color: '#dc2626', width: 2 },
  { id: 'pen-galaxy', label: 'Bút thiên hà', kind: 'galaxy', color: '#7c3aed', width: 3 },
  { id: 'pen-pencil', label: 'Bút chì', kind: 'pencil', color: '#475569', width: 3 },
  { id: 'pen-highlight', label: 'Bút dạ vàng', kind: 'highlighter', color: '#fde047', width: 5 },
  { id: 'pen-fountain', label: 'Bút máy xanh', kind: 'fountain', color: '#1d4ed8', width: 3 },
  { id: 'pen-green', label: 'Bút xanh lá', kind: 'pen', color: '#16a34a', width: 2 },
  { id: 'pen-action', label: 'Bút hành động', kind: 'action', color: '#2563eb', width: 3 },
];

export const KIND_LABELS: Record<InkKind, string> = { pen: 'Bút bi', pencil: 'Bút chì', highlighter: 'Bút dạ', fountain: 'Bút máy', galaxy: 'Bút thiên hà', action: 'Bút hành động' };

const readPens = (): PenPreset[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(PENS_KEY) ?? 'null') as PenPreset[] | null;
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PENS;
  } catch {
    return DEFAULT_PENS;
  }
};

let pens = readPens();
const penListeners = new Set<() => void>();

const publishPens = (next: PenPreset[]) => {
  pens = next;
  try {
    localStorage.setItem(PENS_KEY, JSON.stringify(next));
  } catch {
    penListeners.forEach((listener) => listener());
    return;
  }
  penListeners.forEach((listener) => listener());
};

export const getPens = () => pens;
export const updatePen = (id: string, patch: Partial<PenPreset>) => publishPens(pens.map((pen) => (pen.id === id ? { ...pen, ...patch } : pen)));
export const removePen = (id: string) => publishPens(pens.filter((pen) => pen.id !== id));
export const resetPens = () => publishPens(DEFAULT_PENS);
export const addPen = (kind: InkKind, color: string, width: number) => {
  const pen: PenPreset = { id: newId('pen'), label: KIND_LABELS[kind], kind, color, width };
  publishPens([...pens, pen]);
  return pen;
};

export const usePens = () => useSyncExternalStore((listener) => {
  penListeners.add(listener);
  return () => { penListeners.delete(listener); };
}, getPens);

export const inkDefaults = (kind: InkKind) => ({
  opacity: kind === 'highlighter' ? 0.35 : kind === 'pencil' ? 0.9 : 1,
  widthFactor: kind === 'highlighter' ? 4 : 1,
});

type InkStoreState = { undo: InkStroke[][]; redo: InkStroke[][]; selected: ReadonlySet<string>; version: number; listeners: Set<() => void> };

const stores = new WeakMap<Editor, InkStoreState>();

const storeOf = (editor: Editor) => {
  let store = stores.get(editor);
  if (!store) {
    store = { undo: [], redo: [], selected: new Set(), version: 0, listeners: new Set() };
    stores.set(editor, store);
  }
  return store;
};

const notify = (store: InkStoreState) => {
  store.version += 1;
  store.listeners.forEach((listener) => listener());
};

export const useInkStore = (editor: Editor) => {
  const store = storeOf(editor);
  useSyncExternalStore((listener) => {
    store.listeners.add(listener);
    return () => { store.listeners.delete(listener); };
  }, () => store.version);
  return { selected: store.selected, canUndo: store.undo.length > 0, canRedo: store.redo.length > 0 };
};

export const pushInkHistory = (editor: Editor, snapshot: InkStroke[]) => {
  const store = storeOf(editor);
  store.undo.push(snapshot);
  if (store.undo.length > HISTORY_LIMIT) store.undo.shift();
  store.redo = [];
  notify(store);
};

export const commitInk = (ctx: DocCtx, next: InkStroke[]) => {
  pushInkHistory(ctx.editor, ctx.page.ink ?? []);
  ctx.setPage({ ink: next });
};

export const undoInk = (ctx: DocCtx) => {
  const store = storeOf(ctx.editor);
  const previous = store.undo.pop();
  if (!previous) return false;
  store.redo.push(ctx.page.ink ?? []);
  store.selected = new Set();
  ctx.setPage({ ink: previous });
  notify(store);
  return true;
};

export const redoInk = (ctx: DocCtx) => {
  const store = storeOf(ctx.editor);
  const next = store.redo.pop();
  if (!next) return false;
  store.undo.push(ctx.page.ink ?? []);
  store.selected = new Set();
  ctx.setPage({ ink: next });
  notify(store);
  return true;
};

export const setInkSelection = (editor: Editor, ids: Iterable<string>) => {
  const store = storeOf(editor);
  store.selected = new Set(ids);
  notify(store);
};

export const getInkSelection = (editor: Editor) => storeOf(editor).selected;

export const updateSelectedInk = (ctx: DocCtx, patch: (stroke: InkStroke) => InkStroke) => {
  const selected = getInkSelection(ctx.editor);
  if (!selected.size) return;
  commitInk(ctx, (ctx.page.ink ?? []).map((stroke) => (selected.has(stroke.id) ? patch(stroke) : stroke)));
};

export const deleteSelectedInk = (ctx: DocCtx) => {
  const selected = getInkSelection(ctx.editor);
  if (!selected.size) return;
  commitInk(ctx, (ctx.page.ink ?? []).filter((stroke) => !selected.has(stroke.id)));
  setInkSelection(ctx.editor, []);
};
