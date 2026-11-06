import { createStore, del, get, set } from 'idb-keyval';
import type { JSONContent } from '@tiptap/react';
import type { WorkbookData } from './sheetTypes';

export type FileKind = 'doc' | 'sheet';

export type PageSettings = {
  size: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: string;
  footer: string;
  pageNumbers: boolean;
};

export type DocContent = { kind: 'doc'; json: JSONContent; page: PageSettings };
export type SheetContent = { kind: 'sheet'; workbook: WorkbookData };
export type FileContent = DocContent | SheetContent;

export type FileMeta = {
  id: string;
  name: string;
  kind: FileKind;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
  starred: boolean;
  deletedAt: number | null;
  size: number;
  preview: string;
};

const store = createStore('minh-office', 'workspace');
const INDEX_KEY = 'files-index';
const contentKey = (id: string) => `content:${id}`;

export const PAGE_SIZES: Record<PageSettings['size'], { width: number; height: number; label: string }> = {
  A4: { width: 794, height: 1123, label: 'A4 (21 × 29,7 cm)' },
  A5: { width: 559, height: 794, label: 'A5 (14,8 × 21 cm)' },
  Letter: { width: 816, height: 1056, label: 'Letter (8,5 × 11 in)' },
  Legal: { width: 816, height: 1344, label: 'Legal (8,5 × 14 in)' },
};

export const defaultPage = (): PageSettings => ({
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 96, right: 96, bottom: 96, left: 96 },
  header: '',
  footer: '',
  pageNumbers: true,
});

export async function listFiles(): Promise<FileMeta[]> {
  return (await get<FileMeta[]>(INDEX_KEY, store)) ?? [];
}

async function writeIndex(files: FileMeta[]) {
  await set(INDEX_KEY, files, store);
}

export async function loadContent(id: string) {
  return get<FileContent>(contentKey(id), store);
}

export async function saveFile(meta: FileMeta, content?: FileContent) {
  if (content) await set(contentKey(meta.id), content, store);
  const files = await listFiles();
  const index = files.findIndex((file) => file.id === meta.id);
  if (index >= 0) files[index] = meta;
  else files.unshift(meta);
  await writeIndex(files);
}

export async function updateMeta(id: string, patch: Partial<FileMeta>) {
  const files = await listFiles();
  const index = files.findIndex((file) => file.id === id);
  if (index < 0) return null;
  files[index] = { ...files[index], ...patch };
  await writeIndex(files);
  return files[index];
}

export async function removeFile(id: string) {
  await del(contentKey(id), store);
  await writeIndex((await listFiles()).filter((file) => file.id !== id));
}

export async function exportBackup() {
  const files = await listFiles();
  const contents: Record<string, FileContent | undefined> = {};
  for (const file of files) contents[file.id] = await loadContent(file.id);
  return { format: 'minh-office-backup', version: 2, exportedAt: new Date().toISOString(), files, contents };
}

export async function importBackup(payload: unknown) {
  const data = payload as { format?: string; files?: FileMeta[]; contents?: Record<string, FileContent> };
  if (data?.format !== 'minh-office-backup' || !Array.isArray(data.files)) throw new Error('Tệp sao lưu không hợp lệ.');
  const existing = await listFiles();
  const ids = new Set(existing.map((file) => file.id));
  let count = 0;
  for (const file of data.files) {
    const content = data.contents?.[file.id];
    if (!content || ids.has(file.id)) continue;
    await set(contentKey(file.id), content, store);
    existing.push(file);
    count++;
  }
  await writeIndex(existing);
  return count;
}

export async function estimateStorage() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
