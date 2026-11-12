import { createStore, get, set, update, promisifyRequest, type UseStore } from 'idb-keyval';
import { createContext, useContext } from 'react';
import type { JSONContent } from '@tiptap/react';
import type { WorkbookData } from './sheetTypes';
import type { VbaProjectData } from './vbaProject';
import type { PresentationData } from './slideTypes';
import { PAPER_KEYS, paperLabel, paperPx, type PaperKey } from './paperSizes';
import { validateCloudMeta, validateCloudPayload } from './cloudCodec';

export type FileKind = 'doc' | 'sheet' | 'pdf' | 'slide' | 'image';

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

export type InkKind = 'pen' | 'pencil' | 'highlighter' | 'fountain' | 'galaxy' | 'action';
export type InkStroke = { id: string; color: string; width: number; opacity: number; points: number[]; kind?: InkKind; shape?: boolean };
export type DocProperties = { author?: string; subject?: string; keywords?: string; company?: string };

export type PageSettings = {
  size: PaperKey;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: string;
  footer: string;
  pageNumbers: boolean;
  watermark?: string;
  pageColor?: string;
  columns?: number;
  pageBorder?: 'none' | 'single' | 'double' | 'shadow' | 'dashed' | 'dotted' | 'thick';
  pageBorderColor?: string;
  pageBorderWidth?: number;
  mirrorMargins?: boolean;
  columnGap?: number;
  columnLine?: boolean;
  background?: 'none' | 'ruled-narrow' | 'ruled-wide' | 'grid-small' | 'grid-large' | 'dots';
  watermarkOptions?: { kind?: 'text' | 'image'; image?: string; color?: string; size?: number; layout?: 'diagonal' | 'horizontal'; opacity?: number; font?: string };
  lineNumberMode?: 'continuous' | 'page' | 'section';
  lineNumberStep?: number;
  hyphenMode?: 'none' | 'auto' | 'manual';
  gutter?: number;
  verticalAlign?: 'top' | 'center' | 'justify' | 'bottom';
  effect?: string;
  themeId?: string;
  colorsId?: string;
  fontsId?: string;
  spacingId?: string;
  footnoteFormat?: 'decimal' | 'lower-alpha' | 'lower-roman' | 'symbol';
  footnoteStart?: number;
  footnoteRestart?: 'continuous' | 'page';
  endnoteFormat?: 'decimal' | 'lower-alpha' | 'lower-roman' | 'symbol';
  protectMode?: 'readonly' | 'tracked' | 'comments';
  trackColors?: { insertion?: string; deletion?: string };
  trackLock?: string;
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
  mergeType?: 'letters' | 'emails' | 'envelopes' | 'labels' | 'directory';
  mergeEmail?: { to?: string; cc?: string; subject?: string; format?: 'html' | 'text' | 'attachment' };
  headingNumbers?: 'none' | 'decimal' | 'legal' | 'chapter';
};

export type DocContent = {
  kind: 'doc';
  json: JSONContent;
  page: PageSettings;
  comments?: CommentItem[];
};
export type SheetOutlineGroup = { start: number; end: number; collapsed: boolean };
export type SheetPrintSettings = {
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4' | 'A3' | 'Letter';
  margins: 'normal' | 'narrow' | 'wide';
  fitToPage: boolean;
  showGridlines: boolean;
  printArea?: string;
  pageBreaks?: Record<string, number[]>;
  signedBy?: string;
  signedRole?: string;
  signedAt?: number;
};

export type SheetContent = {
  kind: 'sheet';
  workbook: WorkbookData;
  comments?: CommentItem[];
  printSettings?: SheetPrintSettings;
  outlines?: Record<string, { rows: SheetOutlineGroup[]; cols: SheetOutlineGroup[] }>;
  macros?: unknown[];
  vba?: VbaProjectData;
};
export type PdfContent = {
  kind: 'pdf';
  pdfDataUrl?: string;
  pageCount?: number;
  comments?: CommentItem[];
};
export type SlideContent = {
  kind: 'slide';
  presentation: PresentationData;
  comments?: CommentItem[];
};
export type ImageContent = {
  kind: 'image';
  imageDataUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  comments?: CommentItem[];
  zoom?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  filter?: string;
  markupDataUrl?: string;
};
export type FileContent = DocContent | SheetContent | PdfContent | SlideContent | ImageContent;

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

export type WorkspaceBackup = {
  format: 'minh-office-backup';
  version?: number;
  exportedAt?: string;
  files: FileMeta[];
  contents: Record<string, FileContent | undefined>;
  versions?: Record<string, FileVersion[]>;
};

export function parseWorkspaceBackup(payload: unknown): WorkspaceBackup {
  const data = structuredClone(payload) as WorkspaceBackup;
  if (data?.format !== 'minh-office-backup' || !Array.isArray(data.files) || !data.contents || typeof data.contents !== 'object' || Array.isArray(data.contents)) throw new Error('Tệp sao lưu không hợp lệ.');
  if (data.versions !== undefined && (!data.versions || typeof data.versions !== 'object' || Array.isArray(data.versions))) throw new Error('Lịch sử trong tệp sao lưu không hợp lệ.');
  for (const file of data.files) {
    try { validateCloudMeta(file, file?.id); }
    catch { throw new Error('Tệp sao lưu không hợp lệ.'); }
    const content = data.contents[file.id];
    if (content !== undefined) {
      try { validateCloudPayload({ content, versions: [] }, file); }
      catch { throw new Error('Nội dung trong tệp sao lưu không hợp lệ.'); }
    }
    const versions = data.versions?.[file.id];
    if (versions === undefined) continue;
    if (Array.isArray(versions) && versions.length === 0) continue;
    try { validateCloudPayload({ content: content ?? versions?.[0]?.content, versions }, file); }
    catch { throw new Error('Lịch sử trong tệp sao lưu không hợp lệ.'); }
  }
  return data;
}

const INDEX_KEY = 'files-index';
const contentKey = (id: string) => `content:${id}`;
const versionsKey = (fileId: string) => `versions:${fileId}`;

export const PAGE_SIZES = Object.fromEntries(
  PAPER_KEYS.map((key) => [key, { ...paperPx(key), label: paperLabel(key) }]),
) as Record<PageSettings['size'], { width: number; height: number; label: string }>;

export const DEFAULT_PAGE_KEY = 'minh-docs-default-page';

export const basePage = (): PageSettings => ({
  size: 'A4',
  orientation: 'portrait',
  margins: { top: 96, right: 96, bottom: 96, left: 96 },
  header: '',
  footer: '',
  pageNumbers: true,
});

const storedDefaultPage = (): Partial<PageSettings> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(DEFAULT_PAGE_KEY) ?? '{}') as Partial<PageSettings>;
  } catch {
    return {};
  }
};

export const defaultPage = (): PageSettings => ({ ...basePage(), ...storedDefaultPage() });

function createPersistentStorage(store: UseStore) {

  async function listFiles(): Promise<FileMeta[]> {
    return (await get<FileMeta[]>(INDEX_KEY, store)) ?? [];
  }

  async function loadContent(id: string) {
    return get<FileContent>(contentKey(id), store);
  }

  async function saveFile(meta: FileMeta, content?: FileContent) {
    meta = structuredClone(meta);
    content = structuredClone(content);
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
    patch = structuredClone(patch);
    let updated: FileMeta | null = null;
    await update<FileMeta[]>(INDEX_KEY, (current = []) => {
      const index = current.findIndex((file) => file.id === id);
      if (index < 0) { updated = null; return current; }
      const files = [...current];
      files[index] = { ...files[index], ...patch };
      updated = files[index];
      return files;
    }, store);
    return updated as FileMeta | null;
  }

  async function removeFile(id: string) {
    await store('readwrite', (target) => {
      target.delete(contentKey(id));
      target.delete(versionsKey(id));
      const request = target.get(INDEX_KEY);
      request.onsuccess = () => {
        const files: FileMeta[] = request.result ?? [];
        target.put(files.filter((file) => file.id !== id), INDEX_KEY);
      };
      return promisifyRequest(target.transaction);
    });
  }

  async function listVersions(fileId: string): Promise<FileVersion[]> {
    return (await get<FileVersion[]>(versionsKey(fileId), store)) ?? [];
  }

  async function replaceFile(meta: FileMeta, content: FileContent | undefined, versions: FileVersion[]) {
    const snapshot = structuredClone({ meta, content, versions });
    await store('readwrite', (target) => {
      const request = target.get(INDEX_KEY);
      request.onsuccess = () => {
        const files: FileMeta[] = request.result ?? [];
        const index = files.findIndex((file) => file.id === snapshot.meta.id);
        if (index < 0) files.unshift(snapshot.meta);
        else files[index] = snapshot.meta;
        target.put(files, INDEX_KEY);
        if (snapshot.content !== undefined) target.put(snapshot.content, contentKey(snapshot.meta.id));
        else target.delete(contentKey(snapshot.meta.id));
        target.put(snapshot.versions, versionsKey(snapshot.meta.id));
      };
      return promisifyRequest(target.transaction);
    });
  }

  async function saveVersion(
    fileId: string,
    content: FileContent,
    label?: string
  ): Promise<FileVersion> {
    content = structuredClone(content);
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
    await update<FileVersion[]>(versionsKey(fileId), (versions = []) => [newVersion, ...versions].slice(0, 30), store);
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
    await update<FileVersion[]>(versionsKey(fileId), (versions = []) => versions.filter((version) => version.id !== versionId), store);
  }

  async function exportBackup(): Promise<WorkspaceBackup> {
    const backup: WorkspaceBackup = { format: 'minh-office-backup', version: 3, exportedAt: new Date().toISOString(), files: [], contents: Object.create(null), versions: Object.create(null) };
    await store('readonly', (target) => {
      const index = target.get(INDEX_KEY);
      index.onsuccess = () => {
        backup.files = index.result ?? [];
        for (const file of backup.files) {
          const content = target.get(contentKey(file.id));
          content.onsuccess = () => { backup.contents[file.id] = content.result; };
          const versions = target.get(versionsKey(file.id));
          versions.onsuccess = () => { backup.versions![file.id] = versions.result ?? []; };
        }
      };
      return promisifyRequest(target.transaction);
    });
    return backup;
  }

  async function importBackup(payload: unknown) {
    const data = parseWorkspaceBackup(payload);
    let count = 0;
    await store('readwrite', (target) => {
      const request = target.get(INDEX_KEY);
      request.onsuccess = () => {
        const existing: FileMeta[] = request.result ?? [];
        const ids = new Set(existing.map((file) => file.id));
        count = 0;
        for (const file of data.files) {
          const content = data.contents?.[file.id];
          if (!content || ids.has(file.id)) continue;
          target.put(content, contentKey(file.id));
          target.put(data.versions?.[file.id] ?? [], versionsKey(file.id));
          existing.push(file);
          ids.add(file.id);
          count++;
        }
        target.put(existing, INDEX_KEY);
      };
      return promisifyRequest(target.transaction);
    });
    return count;
  }

  return { listFiles, loadContent, saveFile, updateMeta, removeFile, listVersions, saveVersion, restoreVersion, deleteVersion, exportBackup, importBackup, replaceFile };
}

export type WorkspaceStorage = ReturnType<typeof createPersistentStorage>;

export function createWorkspaceStorage(userId: string | null): WorkspaceStorage {
  return createPersistentStorage(createStore(userId ? `minh-office-user:${userId}` : 'minh-office', 'workspace'));
}

export function createDraftWorkspaceStorage(): WorkspaceStorage {
  const rawStore = createStore('minh-office-drafts', 'workspace');
  const migrationKey = 'legacy-migration-v1';
  let initialization: Promise<void> | undefined;

  const migrate = async () => {
    if (await get<boolean>(migrationKey, rawStore)) return;
    const legacy = createWorkspaceStorage(null);
    const snapshot = await legacy.exportBackup();
    await rawStore('readwrite', (store) => {
      const marker = store.get(migrationKey);
      marker.onsuccess = () => {
        if (marker.result) return;
        const index = store.get(INDEX_KEY);
        index.onsuccess = () => {
          const files: FileMeta[] = index.result ?? [];
          const ids = new Set(files.map((file) => file.id));
          for (const file of snapshot.files) {
            if (ids.has(file.id)) continue;
            files.push(file);
            ids.add(file.id);
            const content = snapshot.contents[file.id];
            if (content) store.put(content, contentKey(file.id));
            store.put(snapshot.versions?.[file.id] ?? [], versionsKey(file.id));
          }
          store.put(files, INDEX_KEY);
          store.put(true, migrationKey);
        };
      };
      return promisifyRequest(store.transaction);
    });
  };

  const store: UseStore = async (mode, callback) => {
    initialization ??= migrate().catch((error) => { initialization = undefined; throw error; });
    await initialization;
    return rawStore(mode, callback);
  };
  return createPersistentStorage(store);
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
