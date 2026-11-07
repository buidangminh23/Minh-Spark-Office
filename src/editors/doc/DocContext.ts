import { createContext, useContext } from 'react';
import type { Editor } from '@tiptap/react';
import type { CommentItem, FileMeta, PageSettings } from '../../lib/storage';
import type { useUi } from '../../components/ui';

export type ViewMode = 'print' | 'web' | 'read';
export type EditMode = 'editing' | 'suggesting' | 'viewing';
export type SidePanel = 'comments' | 'changes' | null;
export type DialogId = 'history' | 'mailmerge' | 'shortcuts' | 'signature' | 'ai' | 'translate' | 'proofread' | 'chart' | 'templates' | 'symbols' | 'wordcount' | 'backstage' | 'tablegrid';

export type ViewState = {
  zoom: number;
  viewMode: ViewMode;
  editMode: EditMode;
  showRuler: boolean;
  showGrid: boolean;
  showMarks: boolean;
  showNav: boolean;
  spellcheck: boolean;
  sidePanel: SidePanel;
  showFind: boolean;
  findReplace: boolean;
};

export type MergeData = { headers: string[]; rows: Record<string, string>[]; source: string };

export type DocCtx = {
  editor: Editor;
  ui: ReturnType<typeof useUi>;
  meta: FileMeta;
  title: string;
  page: PageSettings;
  setPage: (patch: Partial<PageSettings>) => void;
  view: ViewState;
  setView: (patch: Partial<ViewState>) => void;
  comments: CommentItem[];
  setComments: (updater: (items: CommentItem[]) => CommentItem[]) => void;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  openDialog: (id: DialogId) => void;
  merge: MergeData | null;
  setMerge: (data: MergeData | null) => void;
  mergePreview: number | null;
  setMergePreview: (index: number | null) => void;
  readAloud: { speaking: boolean; toggle: () => void };
  dictation: { listening: boolean; toggle: () => void };
  formatPainter: { active: boolean; toggle: () => void };
  markDirty: () => void;
  saveNow: () => void;
  onNewDocument: (html?: string) => void;
  onOpenFile: (file: File) => void;
  onBack: () => void;
};

export const DocContext = createContext<DocCtx | null>(null);

export const useDoc = () => {
  const value = useContext(DocContext);
  if (!value) throw new Error('DocContext missing');
  return value;
};

export const AUTHOR = 'Minh Spark';
export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
