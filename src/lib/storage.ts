import { createStore, del, get, set, update } from 'idb-keyval';
import { createContext, useContext } from 'react';
import type { JSONContent } from '@tiptap/react';
import type { WorkbookData } from './sheetTypes';

export type FileKind = 'doc' | 'sheet' | 'pdf';

export type CommentItem = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  quote?: string;
  replies?: Array<{ id: string; author: string; text: string; createdAt: number }>;
};

export type PageSettings = {
  size: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: string;
  footer: string;
  pageNumbers: boolean;
};

export type DocFootnoteItem = {
  id: string;
  index: number;
  text: string;
};

export type DocContent = {
  kind: 'doc';
  json: JSONContent;
  page: PageSettings;
  comments?: CommentItem[];
  watermark?: string;
  paperBg?: string;
  columnCount?: number;
  footnotes?: DocFootnoteItem[];
};

export type SheetPrintSettings = {
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4' | 'A3' | 'Letter';
  margins: 'normal' | 'narrow' | 'wide';
  fitToPage: boolean;
  showGridlines: boolean;
  printArea?: string;
  signedBy?: string;
  signedRole?: string;
  signedAt?: number;
};

export type SheetContent = {
  kind: 'sheet';
  workbook: WorkbookData;
  comments?: CommentItem[];
  printSettings?: SheetPrintSettings;
};

export type PdfAnnotationKind =
  | 'highlight'
  | 'redact'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'freehand'
  | 'text'
  | 'stamp'
  | 'signature';

export type PdfAnnotationItem = {
  id: string;
  page: number;
  kind: PdfAnnotationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth?: number;
  text?: string;
  imageDataUrl?: string;
  points?: Array<{ x: number; y: number }>;
  createdAt: number;
};

export type PdfContent = {
  kind: 'pdf';
  pdfDataUrl?: string;
  pageCount?: number;
  comments?: CommentItem[];
  annotations?: PdfAnnotationItem[];
  extractedPages?: string[];
  watermark?: string;
};

export type FileContent = DocContent | SheetContent | PdfContent;

export type FileVersion = {
  id: string;
  fileId: string;
  timestamp: number;
  label: string;
  content: FileContent;
};

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

const INDEX_KEY = 'files-index';
const contentKey = (id: string) => `content:${id}`;
const versionsKey = (fileId: string) => `versions:${fileId}`;

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

export function createWorkspaceStorage(userId: string | null) {
  const store = createStore(userId ? `minh-office-user:${userId}` : 'minh-office', 'workspace');

  async function listFiles(): Promise<FileMeta[]> {
    return (await get<FileMeta[]>(INDEX_KEY, store)) ?? [];
  }

  async function writeIndex(files: FileMeta[]) {
    await set(INDEX_KEY, files, store);
  }

  async function loadContent(id: string) {
    return get<FileContent>(contentKey(id), store);
  }

  async function saveFile(meta: FileMeta, content?: FileContent) {
    if (content) await set(contentKey(meta.id), content, store);
    await update<FileMeta[]>(INDEX_KEY, (current = []) => {
      const files = [...current];
      const index = files.findIndex((file) => file.id === meta.id);
      if (index >= 0) files[index] = meta;
      else files.unshift(meta);
      return files;
    }, store);
  }

  async function updateMeta(id: string, patch: Partial<FileMeta>) {
    const files = await listFiles();
    const index = files.findIndex((file) => file.id === id);
    if (index < 0) return null;
    files[index] = { ...files[index], ...patch };
    await writeIndex(files);
    return files[index];
  }

  async function removeFile(id: string) {
    await del(contentKey(id), store);
    await del(versionsKey(id), store);
    await writeIndex((await listFiles()).filter((file) => file.id !== id));
  }

  async function listVersions(fileId: string): Promise<FileVersion[]> {
    return (await get<FileVersion[]>(versionsKey(fileId), store)) ?? [];
  }

  async function saveVersion(
    fileId: string,
    content: FileContent,
    label?: string
  ): Promise<FileVersion> {
    const versions = await listVersions(fileId);
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateStr = new Date(now).toLocaleDateString('vi-VN');
    const newVersion: FileVersion = {
      id: 'v_' + Math.random().toString(36).slice(2, 10),
      fileId,
      timestamp: now,
      label: label || `Bản lưu ${timeStr} (${dateStr})`,
      content,
    };
    const updated = [newVersion, ...versions].slice(0, 30);
    await set(versionsKey(fileId), updated, store);
    return newVersion;
  }

  async function restoreVersion(fileId: string, versionId: string): Promise<FileContent | null> {
    const versions = await listVersions(fileId);
    const found = versions.find((v) => v.id === versionId);
    if (!found) return null;
    await set(contentKey(fileId), found.content, store);
    return found.content;
  }

  async function deleteVersion(fileId: string, versionId: string): Promise<void> {
    const versions = await listVersions(fileId);
    const updated = versions.filter((v) => v.id !== versionId);
    await set(versionsKey(fileId), updated, store);
  }

  async function exportBackup() {
    const files = await listFiles();
    const contents: Record<string, FileContent | undefined> = {};
    for (const file of files) contents[file.id] = await loadContent(file.id);
    return { format: 'minh-office-backup', version: 2, exportedAt: new Date().toISOString(), files, contents };
  }

  async function importBackup(payload: unknown) {
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
      ids.add(file.id);
      count++;
    }
    await writeIndex(existing);
    return count;
  }

  return { listFiles, loadContent, saveFile, updateMeta, removeFile, listVersions, saveVersion, restoreVersion, deleteVersion, exportBackup, importBackup };
}

export type WorkspaceStorage = ReturnType<typeof createWorkspaceStorage>;
export const WorkspaceContext = createContext<WorkspaceStorage | null>(null);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('Workspace is unavailable');
  return workspace;
}

export async function estimateStorage() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
