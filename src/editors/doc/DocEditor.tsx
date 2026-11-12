import { SuiteLogo } from '../../components/SuiteLogo';
import { useAccount } from '../../components/Authentication';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, History, MessageSquare, Search, Share2, X } from 'lucide-react';

import { CommentMark, Footnote, FontSizeStep, LayoutImage, MergeField, PageBreak, ParagraphFormat, ShadedTableCell, ShadedTableHeader } from './extensions';
import { AutoCorrect, Bibliography, Bookmark, Citation, ColumnSection, CrossRef, DocIndex, DocRefs, EndnoteList, Equation, FigureList, IndexEntry, ListStyles, SmartChip, TableExtras, TableOfContents, TextBox, TextStyleExtras, setRefs } from './extensionsExtra';
import { ALL_DIRECTIONS, TableTools } from './resizeObjects';
import { Pagination } from './pagination';
import { editNodeAt } from './actionsExtra';
import { EQUATION_OPEN_DIALOG } from './equationInline';
import { SearchAndReplace } from './search';
import { DeletionMark, InsertionMark, TrackChanges } from './trackChanges';
import { DocContext, currentAuthor, type DialogId, type DocCtx, type EditingNode, type MergeData, type ViewState } from './DocContext';
import { useFormatState } from './useFormatState';
import { ensureFont, ensureFontsInJson } from './fonts';
import { useDictation, useReadAloud } from './useSpeech';
import { addComment, editLink, insertFootnote } from './actions';
import { basePage, useWorkspace, type CommentItem, type DocContent, type FileMeta, type PageSettings } from '../../lib/storage';
import { useUi } from '../../components/ui';
import 'katex/dist/katex.min.css';
import './docEditor.css';
import './ui/insert.css';
import './ui/draw.css';
import './ui/layout.css';
import './ui/review.css';
import './ui/view.css';
import { INSERT_EXTENSIONS } from './extInsert';
import { LAYOUT_EXTENSIONS } from './extLayout';
import { REVIEW_EXTENSIONS } from './extReview';
import { MAILING_EXTENSIONS } from './extMailings';
import { consumePrintOnOpen } from './docLaunch';
import { VIEW_EXTENSIONS } from './extView';
import { NODE_EDITORS } from './nodeEditors';
import InsertExtras from './ui/InsertExtras';
import DrawExtras from './ui/DrawExtras';
import LayoutExtras, { LayoutPanels } from './ui/LayoutExtras';
import ReviewExtras, { ReviewPanels } from './ui/ReviewExtras';
import ViewExtras, { SplitPane, ViewPanels } from './ui/ViewExtras';
import MailingsExtras from './ui/MailingsExtras';
import OnlinePicturesDialog from './ui/OnlinePicturesDialog';
import MailingsTab from './ui/tabs/MailingsTab';

import HomeTab from './ui/tabs/HomeTab';
import { AddinPanel } from '../../addins/AddinPane';
import { docHost } from '../../addins/hosts';
import InsertTab from './ui/tabs/InsertTab';
import { DesignTab, LayoutTab } from './ui/tabs/LayoutTabs';
import { ReferencesTab, ReviewTab } from './ui/tabs/ReviewTabs';
import DrawTab from './ui/tabs/DrawTab';
import { HelpTab, OutlineTab, ViewTab, ZOOM_STEPS } from './ui/tabs/ViewTabs';
import { ImageTab, TableTab } from './ui/tabs/ContextTabs';
import { Backstage, StatusBar, TabBar, type TabId } from './ui/Chrome';
import { ChangesPanel, CommentsPanel, OutlinePanel } from './ui/Panels';
import { ContextMenu, FindBar, SelectionBubble, SlashMenu, AtMentionMenu } from './ui/Floating';
import { Paper, PrintStyles, pageDimensions } from './ui/Paper';
import { ChartDialog } from './ui/insert/ChartDialog';
import { ShortcutsDialog, SignatureDialog, TemplatesDialog, WordCountDialog } from './ui/Dialogs';
import { SymbolsDialog } from './ui/insert/SymbolsDialog';
import { AiDialog, TranslateDialog } from './ui/AiDialogs';
import { HistoryDialog, ProofreadDialog } from './ui/ReviewDialogs';
import { MailMergeDialog } from './ui/MailMerge';
import { FontDialog, HeaderFooterDialog, ParagraphDialog, StyleDialog } from './ui/FormatDialogs';
import { CitationDialog, CrossRefDialog, DrawingDialog, EquationDialog, ImageEditDialog, QrDialog } from './ui/InsertDialogs';
import { AccessibilityDialog, CompareDialog, GoToDialog } from './ui/CheckDialogs';
import { PreflightDialog, DiagramDialog, DocToSlideDialog } from './ui/DocSuperDialogs';
import { DocPrintDialog } from './ui/DocPrintDialog';
import SafeBoundary from './ui/SafeBoundary';
import { AUTO_TITLE_SCAN_BLOCKS, deriveDocTitle, isDefaultDocName, type TitleBlock } from './autoTitle';
import { useDocumentCloser } from '../../lib/documentCloser';
import { getSettings } from '../../lib/appSettings';
import { FormattingMarks } from './formattingMarks';
import { QuickAccess } from './ui/QuickAccess';
import { openExternalLink } from '../../lib/externalLinks';
import { handleConfiguredPaste, rememberView, shellClasses, useDocEditorSettings, viewFromSettings } from './docSettings';

const AUTO_TITLE_DEBOUNCE_MS = 800;

interface DocEditorProps {
  meta: FileMeta;
  content: DocContent;
  onSave: (meta: FileMeta, content: DocContent, explicit?: boolean) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
  onNewDocument?: (html?: string) => void;
  onOpenFile?: (file: File) => void;
  onOpenSaved?: (meta: FileMeta, content: DocContent) => void;
}

const AUTOSAVE_MS = 800;
const AUTO_VERSION_MS = 10 * 60 * 1000;
const VIEW_KEY = 'minh-docs-view';

const loadView = (): ViewState => {
  const base: ViewState = { inkTool: null, inkColor: '#1d4ed8', inkWidth: 3, focusMode: false, dark: false, ribbonCollapsed: false, zoom: 100, viewMode: 'print', editMode: 'editing', showRuler: true, showGrid: false, showMarks: false, showNav: true, spellcheck: true, sidePanel: null, showFind: false, findReplace: false, hideInk: false, inkInput: 'any', inkEraser: 'stroke', inkToShape: false, inkRuler: null, inkReplay: null, penId: null, pageMove: 'vertical', splitView: false, sideBySide: null, syncScroll: true, outlineLevel: 9, markup: 'all', markupComments: true, markupInsDel: true, markupFormatting: true, markupAuthor: null, reviewPane: 'none', commentsMode: 'list', recording: false, highlightMerge: false, tableGridlines: false };
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<ViewState>;
    return { ...base, viewMode: saved.viewMode === 'read' ? 'print' : saved.viewMode ?? base.viewMode, ...viewFromSettings({ ribbonCollapsed: saved.ribbonCollapsed ?? base.ribbonCollapsed }) };
  } catch {
    return { ...base, ...viewFromSettings(base) };
  }
};

type CopiedFormat = { marks: Record<string, Record<string, unknown> | true>; textAlign?: string };

const captureFormat = (editor: Editor): CopiedFormat => {
  const marks: CopiedFormat['marks'] = {};
  for (const name of ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'code']) if (editor.isActive(name)) marks[name] = true;
  const textStyle = editor.getAttributes('textStyle');
  if (Object.values(textStyle).some(Boolean)) marks.textStyle = textStyle;
  if (editor.isActive('highlight')) marks.highlight = editor.getAttributes('highlight');
  return { marks, textAlign: editor.getAttributes('paragraph').textAlign };
};

const applyFormat = (editor: Editor, format: CopiedFormat) => {
  let chain = editor.chain().focus().unsetAllMarks();
  for (const [name, attrs] of Object.entries(format.marks)) chain = chain.setMark(name, attrs === true ? {} : attrs);
  if (format.textAlign) chain = chain.setTextAlign(format.textAlign);
  chain.run();
};

const MIN_AUTO_ZOOM = 25;

export default function DocEditor({ meta, content, onSave, onBack, onNewDocument, onOpenFile, onOpenSaved }: DocEditorProps) {
  const ui = useUi();
  const { user } = useAccount();
  const storage = useWorkspace();
  const { saveVersion } = storage;
  const [title, setTitle] = useState(meta.name);
  const autoTitleRef = useRef(isDefaultDocName(meta.name));
  const [page, setPageState] = useState<PageSettings>({ ...basePage(), ...content.page });
  const [comments, setCommentsState] = useState<CommentItem[]>(content.comments ?? []);
  const [view, setViewState] = useState<ViewState>(loadView);
  const [tab, setTab] = useState<TabId>('home');
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [editing, setEditing] = useState<EditingNode | null>(null);
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [merge, setMerge] = useState<MergeData | null>(null);
  const [mergePreview, setMergePreview] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [revision, setRevision] = useState(0);
  const changeRevision = useRef(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pages, setPages] = useState({ count: 1, current: 1 });
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const preferredZoom = useRef(view.zoom);
  const autoZoom = useRef<number | null>(null);
  const ctxRef = useRef<DocCtx | null>(null);
  const [painter, setPainter] = useState<CopiedFormat | null>(null);
  const painterRef = useRef<CopiedFormat | null>(null);
  const dirtySinceVersion = useRef(false);
  painterRef.current = painter;

  const markDirty = useCallback(() => {
    changeRevision.current++;
    setRevision(changeRevision.current);
    setSavedStatus('saving');
    dirtySinceVersion.current = true;
  }, []);

  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }, heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Table.configure({ resizable: true }),
      TableRow,
      ShadedTableHeader,
      ShadedTableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      LayoutImage.configure({ inline: true, allowBase64: true, resize: { enabled: true, directions: [...ALL_DIRECTIONS], alwaysPreserveAspectRatio: false, minWidth: 8, minHeight: 8 } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      BackgroundColor,
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: 'Nhập nội dung, hoặc gõ “/” để chèn nhanh…' }),
      CharacterCount,
      ParagraphFormat,
      FontSizeStep,
      PageBreak,
      CommentMark,
      Footnote,
      MergeField,
      Pagination,
      DocRefs,
      TableOfContents,
      FigureList,
      Bibliography,
      DocIndex,
      EndnoteList,
      TextStyleExtras,
      ListStyles,
      TableExtras,
      TableTools,
      TextBox,
      ColumnSection,
      Equation,
      SmartChip,
      Citation,
      Bookmark,
      CrossRef,
      IndexEntry,
      AutoCorrect,
      FormattingMarks,
      SearchAndReplace,
      InsertionMark,
      DeletionMark,
      TrackChanges.configure({ author: currentAuthor() }),
      ...INSERT_EXTENSIONS,
      ...LAYOUT_EXTENSIONS,
      ...REVIEW_EXTENSIONS,
      ...MAILING_EXTENSIONS,
      ...VIEW_EXTENSIONS,
    ],
    content: content.json || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: { spellcheck: 'true', lang: getSettings().proofLanguage, 'aria-label': 'Nội dung tài liệu' },
      handlePaste: (_view, event) => (editorRef.current ? handleConfiguredPaste(editorRef.current, event) : false),
      handleClick: (editorView, pos, event) => {
        const link = editorView.state.doc.resolve(pos).marks().find((m) => m.type.name === 'link');
        if (link && (event.ctrlKey || event.metaKey)) {
          openExternalLink(String(link.attrs.href ?? ''));
          return true;
        }
        const mark = editorView.state.doc.resolve(pos).marks().find((m) => m.type.name === 'comment');
        if (mark) {
          setActiveCommentId(String(mark.attrs.commentId));
          setViewState((v) => ({ ...v, sidePanel: 'comments' }));
        }
        return false;
      },
      handleDoubleClickOn: (_view, _pos, node, nodePos) => {
        const c = ctxRef.current;
        const custom = NODE_EDITORS[node.type.name];
        if (c && custom && custom(c, node, nodePos)) return true;
        if (!c || !['equation', 'footnote', 'smartChip', 'bookmark', 'indexEntry'].includes(node.type.name)) return false;
        void editNodeAt(c, node, nodePos);
        return true;
      },
    },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) markDirty();
    },
  });

  const fmt = useFormatState(editor);

  useEffect(() => {
    setRefs(editor, page.sources ?? [], page.citationStyle ?? 'apa');
  }, [editor, page.sources, page.citationStyle]);

  useEffect(() => {
    if (!editor.isDestroyed) editor.commands.setMergePreview(merge, merge && mergePreview !== null ? mergePreview : null);
  }, [editor, merge, mergePreview]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const openFullEditor = (event: Event) => {
      const pos = (event as CustomEvent<{ pos: number }>).detail.pos;
      const node = editor.state.doc.nodeAt(pos);
      if (ctxRef.current && node?.type.name === 'equation') void editNodeAt(ctxRef.current, node, pos);
    };
    dom.addEventListener(EQUATION_OPEN_DIALOG, openFullEditor);
    return () => dom.removeEventListener(EQUATION_OPEN_DIALOG, openFullEditor);
  }, [editor]);


  useEffect(() => {
    if (!autoTitleRef.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshTitle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!autoTitleRef.current) return;
        const blocks: TitleBlock[] = [];
        editor.state.doc.forEach((node) => {
          if (blocks.length < AUTO_TITLE_SCAN_BLOCKS) blocks.push({ heading: node.type.name === 'heading', text: node.textContent });
        });
        const next = deriveDocTitle(blocks);
        if (next) setTitle((current) => (current === next ? current : next));
      }, AUTO_TITLE_DEBOUNCE_MS);
    };
    editor.on('update', refreshTitle);
    return () => {
      editor.off('update', refreshTitle);
      clearTimeout(timer);
    };
  }, [editor]);

  useEffect(() => {
    editor.view.dom.setAttribute('lang', page.language ?? 'vi');
  }, [editor, page.language]);

  useEffect(() => {
    ensureFontsInJson(content.json);
  }, [content.json]);

  useEffect(() => {
    if (page.fontFamily) ensureFont(page.fontFamily);
  }, [page.fontFamily]);

  const setPage = useCallback((patch: Partial<PageSettings>) => {
    setPageState((p) => ({ ...p, ...patch }));
    markDirty();
  }, [markDirty]);

  const setView = useCallback((patch: Partial<ViewState>) => setViewState((v) => ({ ...v, ...patch })), []);
  editorRef.current = editor;
  const docSettings = useDocEditorSettings(editor, page.autocorrect, setView);

  const setComments = useCallback((updater: (items: CommentItem[]) => CommentItem[]) => setCommentsState(updater), []);

  const latest = useRef({ meta, title, page, comments, onSave });
  latest.current = { meta, title, page, comments, onSave };

  const persist = useCallback(async (explicit = false) => {
    const savedRevision = changeRevision.current;
    const { meta: m, title: t, page: p, comments: c, onSave: save } = latest.current;
    const saved = await save({ ...m, name: t, updatedAt: Date.now(), size: JSON.stringify(editor.getJSON()).length, preview: editor.getText().slice(0, 160) }, { kind: 'doc', json: editor.getJSON(), page: p, comments: c }, explicit);
    if (saved && changeRevision.current === savedRevision) setSavedStatus('saved');
    return saved;
  }, [editor]);

  useDocumentCloser((close) => persist(false).then((saved) => { if (saved && close) onBack(); return saved; }));

  const saveNow = useCallback(async () => {
    if (await persist(true)) ui.toast('Đã lưu tài liệu');
  }, [persist, ui]);

  useEffect(() => {
    if (savedStatus !== 'saving') return;
    const timer = setTimeout(() => void persist(false), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [savedStatus, persist, page, comments, title, revision]);

  useEffect(() => {
    if (savedStatus === 'saved') return;
    const flush = () => { void persist(false); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      event.preventDefault();
      event.returnValue = '';
    };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [savedStatus, persist]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirtySinceVersion.current) return;
      dirtySinceVersion.current = false;
      const { meta: m, page: p, comments: c } = latest.current;
      void saveVersion(m.id, { kind: 'doc', json: editor.getJSON(), page: p, comments: c }, `Tự động lưu ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    }, AUTO_VERSION_MS);
    return () => clearInterval(timer);
  }, [editor, saveVersion]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ zoom: preferredZoom.current, viewMode: view.viewMode, showRuler: view.showRuler, showNav: view.showNav, spellcheck: view.spellcheck, dark: view.dark, ribbonCollapsed: view.ribbonCollapsed }));
    } catch {
      return;
    }
    rememberView(view);
  }, [view.zoom, view.viewMode, view.showRuler, view.showNav, view.spellcheck, view.dark, view.ribbonCollapsed]);

  useEffect(() => {
    const locked = Boolean(page.protectHash);
    const mode = locked ? (page.protectMode === 'tracked' ? 'suggesting' : 'viewing') : view.editMode;
    editor.setEditable(mode !== 'viewing');
    editor.commands.setTrackChanges(mode === 'suggesting');
  }, [editor, view.editMode, page.protectHash, page.protectMode]);

  useEffect(() => {
    editor.view.dom.setAttribute('spellcheck', String(view.spellcheck));
  }, [editor, view.spellcheck]);

  useEffect(() => {
    const dom = editor.view.dom;
    const onMouseUp = () => {
      const format = painterRef.current;
      if (!format || editor.state.selection.empty) return;
      applyFormat(editor, format);
      setPainter(null);
    };
    dom.addEventListener('mouseup', onMouseUp);
    return () => dom.removeEventListener('mouseup', onMouseUp);
  }, [editor]);

  const contextual = useMemo<TabId[]>(() => [...(view.viewMode === 'outline' ? ['outline' as const] : []), ...(fmt.inTable ? ['table' as const] : []), ...(fmt.imageSelected ? ['image' as const] : [])], [view.viewMode, fmt.inTable, fmt.imageSelected]);
  useEffect(() => {
    if ((tab === 'table' && !fmt.inTable) || (tab === 'image' && !fmt.imageSelected) || (tab === 'outline' && view.viewMode !== 'outline')) setTab('home');
  }, [tab, fmt.inTable, fmt.imageSelected, view.viewMode]);
  useEffect(() => {
    if (view.viewMode === 'outline') setTab('outline');
  }, [view.viewMode]);

  const notify = useCallback((text: string, error?: boolean) => ui.toast(text, error), [ui]);
  const dictation = useDictation(editor, notify);
  const readAloud = useReadAloud(editor, notify);
  const formatPainter = useMemo(() => ({
    active: Boolean(painter),
    toggle: () => {
      if (painter) return setPainter(null);
      setPainter(captureFormat(editor));
      ui.toast('Đã sao chép định dạng — bôi chọn đoạn chữ cần áp dụng');
    },
  }), [painter, editor, ui]);

  const print = useCallback(() => setDialog('print'), []);

  useEffect(() => {
    if (!consumePrintOnOpen(meta.id)) return;
    const timer = window.setTimeout(() => setDialog('print'), 400);
    return () => window.clearTimeout(timer);
  }, [meta.id]);

  const ctx: DocCtx = {
    storage,
    editor, ui, meta, title, page, setPage, view, setView, comments,
    setComments: (updater) => { setComments(updater); markDirty(); },
    activeCommentId, setActiveCommentId, openDialog: setDialog, setTab: (id) => setTab(id as TabId), editing, setEditing, editingStyle, setEditingStyle, print, merge, setMerge, mergePreview, setMergePreview,
    readAloud, dictation, formatPainter, markDirty, saveNow,
    onNewDocument: onNewDocument ?? (() => ui.toast('Mở danh sách tệp để tạo tài liệu mới')),
    onOpenFile: onOpenFile ?? (() => undefined),
    onOpenSaved: onOpenSaved ?? (() => ui.toast('Đã lưu tệp mới trong danh sách tệp')),
    onBack: () => { void persist(false).then((saved) => { if (saved) onBack(); }); },
  };
  ctxRef.current = ctx;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const c = ctxRef.current;
      if (!c) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === 'F7') { e.preventDefault(); setDialog('proofread'); return; }
      if (e.key === 'Escape' && c.view.showFind) { setView({ showFind: false }); return; }
      if (e.key === 'Escape' && c.view.focusMode) { setView({ focusMode: false }); return; }
      if (e.key === 'Escape' && c.view.inkTool) { setView({ inkTool: null }); return; }
      if (e.key === 'Escape' && c.view.viewMode === 'read') { setView({ viewMode: 'print' }); return; }
      if (e.altKey && !mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setEditing(null);
        setDialog('equation');
        return;
      }
      if (!mod) return;
      const handled = (() => {
        if (key === 's') return c.saveNow(), true;
        if (key === 'f' && !e.shiftKey) return setView({ showFind: true, findReplace: false }), true;
        if (key === 'h') return setView({ showFind: true, findReplace: true }), true;
        if (key === 'p') return c.print(), true;
        if (key === 'd') return setDialog('font'), true;
        if (key === 'g' && !e.shiftKey) return setDialog('goto'), true;
        if (e.key === 'F1') return setView({ ribbonCollapsed: !c.view.ribbonCollapsed }), true;
        if (key === 'k') return void editLink(c), true;
        if (key === '/') return setDialog('shortcuts'), true;
        if (key === '\\') return editor.chain().focus().unsetAllMarks().run(), true;
        if (key === '=' || key === '+') return setView({ zoom: ZOOM_STEPS.find((z) => z > c.view.zoom) ?? 200 }), true;
        if (key === '-') return setView({ zoom: [...ZOOM_STEPS].reverse().find((z) => z < c.view.zoom) ?? 50 }), true;
        if (e.altKey && key === 'm') return void addComment(c), true;
        if (e.altKey && key === 'f') return void insertFootnote(c), true;
        if (e.altKey && key === ' ') return c.readAloud.toggle(), true;
        if (e.shiftKey && key === 'c') return c.formatPainter.toggle(), true;
        if (e.shiftKey && key === 'e') return setView({ editMode: c.view.editMode === 'suggesting' ? 'editing' : 'suggesting' }), true;
        if (e.shiftKey && key === 'g') return setDialog('wordcount'), true;
        return false;
      })();
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, setView]);

  const handleTitleBlur = () => {
    const next = title.trim();
    if (next) setTitle(next);
    else setTitle(meta.name);
  };

  const dims = pageDimensions(page.size, page.orientation);

  useEffect(() => {
    if (view.zoom !== autoZoom.current) preferredZoom.current = view.zoom;
  }, [view.zoom]);

  const autoFit = view.viewMode === 'print' && view.pageMove === 'vertical' && !view.sideBySide;
  useEffect(() => {
    const canvas = canvasEl;
    if (!canvas || !autoFit || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const style = getComputedStyle(canvas);
      const available = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (available <= 0) return;
      const target = Math.min(preferredZoom.current, Math.max(MIN_AUTO_ZOOM, Math.floor((available / dims.width) * 100)));
      setViewState((current) => {
        if (current.zoom === target) return current;
        autoZoom.current = target;
        return { ...current, zoom: target };
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [autoFit, canvasEl, dims.width]);
  const onPages = useCallback((count: number, current: number) => setPages((p) => (p.count === count && p.current === current ? p : { count, current })), []);
  const reading = view.viewMode === 'read';
  const addinHost = useMemo(() => docHost(editor, title), [editor, title]);
  const openComments = comments.filter((c) => !c.resolved).length;

  const renderTab = () => {
    switch (tab) {
      case 'home': return <HomeTab fmt={fmt} />;
      case 'insert': return <InsertTab />;
      case 'draw': return <DrawTab />;
      case 'design': return <DesignTab />;
      case 'layout': return <LayoutTab fmt={fmt} />;
      case 'references': return <ReferencesTab />;
      case 'mailings': return <MailingsTab />;
      case 'review': return <ReviewTab />;
      case 'view': return <ViewTab pageWidth={dims.width} pageHeight={dims.height} />;
      case 'help': return <HelpTab />;
      case 'table': return <TableTab fmt={fmt} />;
      case 'image': return <ImageTab />;
      case 'outline': return <OutlineTab />;
      default: return null;
    }
  };

  const closeDialog = () => setDialog(null);

  return (
    <DocContext.Provider value={ctx}>
      <div className={`editor-shell doc-editor ${reading ? 'reading' : ''} ${view.focusMode ? 'focus-mode' : ''} ${view.dark ? 'doc-dark' : ''} ${shellClasses(docSettings)}`}>
        <PrintStyles />
        {view.focusMode && <button className="btn focus-exit" onClick={() => setView({ focusMode: false })}><X size={14} /> Thoát tập trung (Esc)</button>}
        {reading ? (
          <div className="read-bar">
            <BookOpen size={15} />
            <span className="read-title">{title}</span>
            <span className="read-meta">{fmt.selectionText ? '' : ''}Chế độ đọc</span>
            <button className="btn" onClick={() => setView({ viewMode: 'print' })}><X size={14} /> Thoát (Esc)</button>
          </div>
        ) : (
          <>
            <header className="editor-top">
              <div className="editor-title-group">
                <button className="icon-btn" onClick={() => { void persist(false).then((saved) => { if (saved) onBack(); }); }} title="Về danh sách tệp" aria-label="Quay lại"><ArrowLeft size={18} /></button>
                <SuiteLogo kind="doc" size={32} decorative={false} />
                <input className="editor-title-input" value={title} aria-label="Tên tài liệu" onChange={(e) => { autoTitleRef.current = false; setTitle(e.target.value); markDirty(); }} onBlur={handleTitleBlur} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                <QuickAccess placement="above" />
                <button className={`save-pill ${savedStatus}`} onClick={() => user ? setDialog('history') : void saveNow()} title={user ? 'Xem lịch sử phiên bản' : 'Đăng nhập để lưu tài liệu'}>
                  {savedStatus === 'saved' ? <><CheckCircle2 size={13} /><span>{user ? 'Đã lưu trên máy' : 'Đã lưu nháp trên máy'}</span></> : <><Clock size={13} /><span>{user ? 'Đang lưu…' : 'Đang lưu nháp…'}</span></>}
                </button>
              </div>
              <div className="topbar-right">
                <button className="command-search" onClick={() => setDialog('commandpalette')} title="Tìm lệnh (Alt+Q)"><Search size={14} /><span>Tìm lệnh</span></button>
                <button className="btn" onClick={() => setDialog('history')} title="Lịch sử phiên bản"><History size={15} /><span>Lịch sử</span></button>
                <button className={`btn ${view.sidePanel === 'comments' ? 'btn-primary' : ''}`} onClick={() => setView({ sidePanel: view.sidePanel === 'comments' ? null : 'comments' })} title="Bình luận"><MessageSquare size={15} /><span>Bình luận{openComments ? ` (${openComments})` : ''}</span></button>
                <button className="btn" onClick={() => setView({ viewMode: 'read' })} title="Chế độ đọc"><BookOpen size={15} /><span>Đọc</span></button>
                <button className="btn btn-doc" onClick={() => setDialog('backstage')} title="Xuất & chia sẻ"><Share2 size={15} /><span>Chia sẻ</span></button>
              </div>
            </header>
            <div className="ribbon">
              <TabBar tab={tab} setTab={setTab} contextual={contextual} />
              {!view.ribbonCollapsed && <div className="ribbon-body" role="toolbar" aria-label="Thanh công cụ">{renderTab()}</div>}
            </div>
            <QuickAccess placement="below" />
          </>
        )}

        <div className="doc-workspace">
          {view.showFind && <FindBar />}
          {view.showNav && !reading && !view.focusMode && <OutlinePanel />}
          <div className="doc-center">
          <div className="doc-canvas" ref={setCanvasEl} onContextMenu={(e) => {
            if (!(e.target as HTMLElement).closest('.ProseMirror')) return;
            e.preventDefault();
            const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
            if (pos && editor.state.selection.empty) editor.chain().focus().setTextSelection(pos.pos).run();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}>
            <Paper onPages={onPages} />
          </div>
          {!reading && <SplitPane />}
          </div>
          {!reading && view.sidePanel === 'comments' && <CommentsPanel />}
          {!reading && view.sidePanel === 'changes' && <ChangesPanel />}
          {!reading && <LayoutPanels />}
          {!reading && <ReviewPanels />}
          <ViewPanels />
          {!reading && <AddinPanel host={addinHost} />}
        </div>

        {!reading && <StatusBar page={pages.current} pages={pages.count} />}

        {!view.showFind && !dialog && docSettings.miniToolbar && <SafeBoundary name="selection-bubble"><SelectionBubble /></SafeBoundary>}
        <SafeBoundary name="slash-menu"><SlashMenu /></SafeBoundary>
        <SafeBoundary name="at-menu"><AtMentionMenu /></SafeBoundary>
        {contextMenu && <SafeBoundary name="context-menu"><ContextMenu at={contextMenu} onClose={() => setContextMenu(null)} /></SafeBoundary>}

        <SafeBoundary key={dialog ?? 'none'} name={`dialog-${dialog}`}>
        {dialog === 'backstage' && <Backstage onClose={closeDialog} />}
        {dialog === 'history' && <HistoryDialog onClose={closeDialog} />}
        {dialog === 'mailmerge' && <MailMergeDialog onClose={closeDialog} />}
        {dialog === 'shortcuts' && <ShortcutsDialog onClose={closeDialog} />}
        {dialog === 'signature' && <SignatureDialog onClose={closeDialog} />}
        {dialog === 'ai' && <AiDialog onClose={closeDialog} />}
        {dialog === 'translate' && <TranslateDialog onClose={closeDialog} />}
        {dialog === 'proofread' && <ProofreadDialog onClose={closeDialog} />}
        {dialog === 'chart' && <ChartDialog onClose={closeDialog} />}
        {dialog === 'templates' && <TemplatesDialog onClose={closeDialog} />}
        {dialog === 'symbols' && <SymbolsDialog onClose={closeDialog} />}
        {dialog === 'wordcount' && <WordCountDialog onClose={closeDialog} />}
        {dialog === 'headerfooter' && <HeaderFooterDialog onClose={closeDialog} />}
        {dialog === 'font' && <FontDialog onClose={closeDialog} />}
        {dialog === 'paragraph' && <ParagraphDialog onClose={closeDialog} />}
        {dialog === 'style' && <StyleDialog onClose={closeDialog} />}
        {dialog === 'equation' && <EquationDialog onClose={closeDialog} />}
        {dialog === 'qr' && <QrDialog onClose={closeDialog} />}
        {dialog === 'drawing' && <DrawingDialog onClose={closeDialog} />}
        {dialog === 'imageedit' && <ImageEditDialog onClose={closeDialog} />}
        {dialog === 'citations' && <CitationDialog onClose={closeDialog} />}
        {dialog === 'crossref' && <CrossRefDialog onClose={closeDialog} />}
        {dialog === 'accessibility' && <AccessibilityDialog onClose={closeDialog} />}
        {dialog === 'goto' && <GoToDialog onClose={closeDialog} />}
        {dialog === 'compare' && <CompareDialog onClose={closeDialog} />}
        {dialog === 'preflight' && <PreflightDialog onClose={closeDialog} />}
        {dialog === 'print' && <DocPrintDialog onClose={closeDialog} />}
        {dialog === 'diagram' && <DiagramDialog onClose={closeDialog} />}
        {dialog === 'docToSlide' && <DocToSlideDialog onClose={closeDialog} />}
        <InsertExtras dialog={dialog} onClose={closeDialog} />
        <DrawExtras dialog={dialog} onClose={closeDialog} />
        <LayoutExtras dialog={dialog} onClose={closeDialog} />
        <ReviewExtras dialog={dialog} onClose={closeDialog} />
        <ViewExtras dialog={dialog} onClose={closeDialog} />
        <MailingsExtras dialog={dialog} onClose={closeDialog} />
        {dialog === 'onlinepictures' && <OnlinePicturesDialog onClose={closeDialog} />}
        </SafeBoundary>
      </div>
    </DocContext.Provider>
  );
}
