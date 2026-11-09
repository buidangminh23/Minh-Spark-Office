import { currentAuthorName } from '../../lib/currentAuthor';
import { createContext, useContext } from 'react';
import type { Editor } from '@tiptap/react';
import type { CommentItem, FileMeta, PageSettings, WorkspaceStorage } from '../../lib/storage';
import type { useUi } from '../../components/ui';

export type ViewMode = 'print' | 'web' | 'read' | 'outline' | 'draft';
export type EditMode = 'editing' | 'suggesting' | 'viewing';
export type SidePanel = 'comments' | 'changes' | 'selection' | 'thesaurus' | 'restrict' | null;
export type DialogId = 'history' | 'mailmerge' | 'shortcuts' | 'signature' | 'ai' | 'translate' | 'proofread' | 'chart' | 'templates' | 'symbols' | 'wordcount' | 'backstage' | 'tablegrid' | 'headerfooter' | 'font' | 'paragraph' | 'style' | 'equation' | 'qr' | 'drawing' | 'imageedit' | 'citations' | 'crossref' | 'accessibility' | 'goto' | 'compare'
  | 'smartart' | 'wordart' | 'icons' | 'model3d' | 'video' | 'object' | 'bookmarks' | 'quickparts' | 'fields' | 'drawtable' | 'dropcap' | 'datetime' | 'esign' | 'pagenumber'
  | 'inkmath' | 'inkhelp'
  | 'pagesetup' | 'columns' | 'watermark' | 'pageborders' | 'themecolors' | 'themefonts' | 'linenumbers' | 'wrapoptions'
  | 'footnotes' | 'toc' | 'tableoffigures' | 'insertindex' | 'toa' | 'markcitation' | 'sources' | 'trackoptions' | 'markupfilter' | 'readability' | 'combine'
  | 'zoom' | 'macros' | 'sidebyside' | 'autocorrect' | 'immersive' | 'commandpalette' | 'diagram' | 'preflight' | 'docToSlide' | 'print';

export type InkTool = 'pen' | 'highlighter' | 'eraser' | 'select' | 'lasso';
export type MarkupMode = 'all' | 'simple' | 'none' | 'original';
export type EditingNode = { pos: number; attrs: Record<string, unknown> };

export type ViewState = {
  inkTool: InkTool | null;
  inkColor: string;
  inkWidth: number;
  focusMode: boolean;
  dark: boolean;
  ribbonCollapsed: boolean;
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
  hideInk: boolean;
  inkInput: 'any' | 'pen';
  inkEraser: 'stroke' | 'point';
  inkToShape: boolean;
  inkRuler: { x: number; y: number; angle: number } | null;
  inkReplay: number | null;
  penId: string | null;
  pageMove: 'vertical' | 'side';
  splitView: boolean;
  sideBySide: string | null;
  syncScroll: boolean;
  outlineLevel: number;
  markup: MarkupMode;
  markupComments: boolean;
  markupInsDel: boolean;
  markupFormatting: boolean;
  markupAuthor: string | null;
  reviewPane: 'none' | 'vertical' | 'horizontal';
  commentsMode: 'contextual' | 'list';
  recording: boolean;
};

export type MergeData = { headers: string[]; rows: Record<string, string>[]; source: string };

export type DocCtx = {
  storage: WorkspaceStorage;
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
  setTab: (id: string) => void;
  editing: EditingNode | null;
  setEditing: (node: EditingNode | null) => void;
  editingStyle: string | null;
  setEditingStyle: (id: string | null) => void;
  print: () => void;
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

export const currentAuthor = () => currentAuthorName();
export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
