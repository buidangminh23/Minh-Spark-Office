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

export type PageNumberFormat = 'plain' | 'page' | 'page-of' | 'dash' | 'roman';
export type PageNumberPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';
export type CitationStyle = 'apa' | 'ieee' | 'chicago' | 'mla' | 'vancouver';

export type DocStyleDef = {
  name: string;
  font?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  caps?: boolean;
  align?: string;
  before?: number;
  after?: number;
  line?: number;
  custom?: boolean;
};

export type CitationSource = {
  id: string;
  type: 'book' | 'article' | 'web' | 'report' | 'other';
  authors: string;
  title: string;
  year: string;
  publisher?: string;
  url?: string;
  pages?: string;
};

export type InkStroke = { id: string; color: string; width: number; opacity: number; points: number[] };
export type DocProperties = { author?: string; subject?: string; keywords?: string; company?: string };

export type PageSettings = {
  size: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: string;
  footer: string;
  pageNumbers: boolean;
  watermark?: string;
  pageColor?: string;
  columns?: number;
  pageBorder?: 'none' | 'single' | 'double' | 'shadow';
  lineNumbers?: boolean;
  hyphenate?: boolean;
  fontFamily?: string;
  fontSize?: number;
  differentFirstPage?: boolean;
  protectHash?: string;
  headerFirst?: string;
  footerFirst?: string;
  differentOddEven?: boolean;
  headerEven?: string;
  footerEven?: string;
  pageNumberFormat?: PageNumberFormat;
  pageNumberPosition?: PageNumberPosition;
  pageNumberStart?: number;
  styles?: Record<string, DocStyleDef>;
  styleSet?: string;
  sources?: CitationSource[];
  citationStyle?: CitationStyle;
  ink?: InkStroke[];
  language?: string;
  properties?: DocProperties;
  autocorrect?: boolean;
};

export type DocContent = {
  kind: 'doc';
  json: JSONContent;
  page: PageSettings;
  comments?: CommentItem[];
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
export type PdfContent = {
  kind: 'pdf';
  pdfDataUrl?: string;
  pageCount?: number;
  comments?: CommentItem[];
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

export function createDraftWorkspaceStorage(): WorkspaceStorage {
  const legacy = createWorkspaceStorage(null);
  let files: FileMeta[] = [];
  const contents = new Map<string, FileContent>();
  const histories = new Map<string, FileVersion[]>();
  let initialization: Promise<void> | undefined;

  function ready() {
    initialization ??= (async () => {
      const existing = await legacy.listFiles();
      await Promise.all(existing.map(async (file) => {
        const [content, versions] = await Promise.all([legacy.loadContent(file.id), legacy.listVersions(file.id)]);
        if (content) contents.set(file.id, structuredClone(content));
        histories.set(file.id, structuredClone(versions));
      }));
      files = structuredClone(existing);
    })();
    return initialization;
  }

  async function listFiles() {
    await ready();
    return structuredClone(files);
  }

  async function loadContent(id: string) {
    await ready();
    return structuredClone(contents.get(id));
  }

  async function saveFile(meta: FileMeta, content?: FileContent) {
    const nextMeta = structuredClone(meta);
    const nextContent = structuredClone(content);
    await ready();
    if (nextContent) contents.set(nextMeta.id, nextContent);
    const index = files.findIndex((file) => file.id === nextMeta.id);
    if (index >= 0) files[index] = nextMeta;
    else files.unshift(nextMeta);
  }

  async function updateMeta(id: string, patch: Partial<FileMeta>) {
    const nextPatch = structuredClone(patch);
    await ready();
    const index = files.findIndex((file) => file.id === id);
    if (index < 0) return null;
    files[index] = { ...files[index], ...nextPatch };
    return structuredClone(files[index]);
  }

  async function removeFile(id: string) {
    await ready();
    contents.delete(id);
    histories.delete(id);
    files = files.filter((file) => file.id !== id);
  }

  async function listVersions(fileId: string) {
    await ready();
    return structuredClone(histories.get(fileId) ?? []);
  }

  async function saveVersion(fileId: string, content: FileContent, label?: string) {
    const snapshot = structuredClone(content);
    await ready();
    const now = Date.now();
    const time = new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(now).toLocaleDateString('vi-VN');
    const version: FileVersion = { id: 'v_' + Math.random().toString(36).slice(2, 10), fileId, timestamp: now, label: label || `Bản lưu ${time} (${date})`, content: snapshot };
    histories.set(fileId, [version, ...(histories.get(fileId) ?? [])].slice(0, 30));
    return structuredClone(version);
  }

  async function restoreVersion(fileId: string, versionId: string) {
    await ready();
    const version = histories.get(fileId)?.find((item) => item.id === versionId);
    if (!version) return null;
    contents.set(fileId, structuredClone(version.content));
    return structuredClone(version.content);
  }

  async function deleteVersion(fileId: string, versionId: string) {
    await ready();
    histories.set(fileId, (histories.get(fileId) ?? []).filter((version) => version.id !== versionId));
  }

  async function exportBackup() {
    await ready();
    return structuredClone({ format: 'minh-office-backup', version: 2, exportedAt: new Date().toISOString(), files, contents: Object.fromEntries(files.map((file) => [file.id, contents.get(file.id)])) });
  }

  async function importBackup(payload: unknown) {
    const data = structuredClone(payload) as { format?: string; files?: FileMeta[]; contents?: Record<string, FileContent> };
    if (data?.format !== 'minh-office-backup' || !Array.isArray(data.files)) throw new Error('Tệp sao lưu không hợp lệ.');
    await ready();
    const ids = new Set(files.map((file) => file.id));
    let count = 0;
    for (const file of data.files) {
      const content = data.contents?.[file.id];
      if (!content || ids.has(file.id)) continue;
      contents.set(file.id, content);
      files.push(file);
      ids.add(file.id);
      count++;
    }
    return count;
  }

  return { listFiles, loadContent, saveFile, updateMeta, removeFile, listVersions, saveVersion, restoreVersion, deleteVersion, exportBackup, importBackup };
}

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
