import { useWorkspace } from '../../lib/storage';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';

import {
  ArrowLeft,
  Save,
  Download,
  Printer,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SuperIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Indent,
  Outdent,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  FileText,
  CheckCircle2,
  Clock,
  Layout,
  Eye,
  Settings,
  Trash2,
  Paintbrush,
  Search,
  Replace,
  X,
  ChevronDown,
  BarChart2,
  Split,
  Combine,
  Mic,
  MicOff,
  PenTool,
  Columns,
  Shield,
  Palette,
  Bookmark,
  Type,
  MessageSquare,
  History,
  Maximize2,
  Minimize2,
  Check,
  Send,
  Reply,
  Scissors,
  Copy,
  ClipboardPaste,
  Share2,
  Pencil,
  Languages,
  Presentation,
  FileImage,
  FileDown,
  Sparkles,
  Grid,
  PaintBucket,
  Eraser,
  CheckCheck,
  ArrowUpDown,
  Pilcrow,
  FileSpreadsheet,
  Upload,
  Layers,
  Crop,
  Keyboard,
  Mail,
  Plus,
} from 'lucide-react';

import { ParagraphFormat, PageBreak } from './extensions';
import { exportDocx, importDocx, jsonToMarkdown } from '../../lib/docxConvert';
import { exportWorkbookToXlsx, importSpreadsheet } from '../../lib/xlsxConvert';
import {
  tiptapJsonToPdfBlocks,
  createPdfFromBlocks,
  loadPdfDocumentProxy,
  disposePdfDocumentProxy,
  renderPdfPageToPngBlob,
  buildWorkbookFromTables,
  extractPdfTextAndTables,
  convertPdfToSlideDeckHtml,
} from '../../lib/pdfEngine';
import { downloadBlob, pickFile, readAsDataUrl } from '../../lib/download';
import {
  defaultPage,
  PAGE_SIZES,
  type DocContent,
  type DocFootnoteItem,
  type FileContent,
  type FileMeta,
  type PageSettings,
  type CommentItem,
  type FileVersion,
  type PdfContent,
  type SheetContent,
} from '../../lib/storage';
import { useUi } from '../../components/ui';

import { sampleDocHtml, contractDocHtml, meetingMinutesDocHtml } from '../../lib/templates';

interface DocEditorProps {
  meta: FileMeta;
  content: DocContent;
  onSave: (meta: FileMeta, content: DocContent) => void;
  onRename: (name: string) => void;
  onBack: () => void;
  onOpenWorkspaceFile?: (meta: FileMeta, content: FileContent) => void;
}

type RibbonTab =
  | 'file'
  | 'home'
  | 'minh_pdf'
  | 'insert'
  | 'draw'
  | 'design'
  | 'layout'
  | 'references'
  | 'mailings'
  | 'review'
  | 'view'
  | 'help';

const COMMON_SYMBOLS = [
  '©', '®', '™', '€', '¥', '£', '$', '₫',
  '±', '≠', '≤', '≥', '≈', '÷', '×', '‰',
  'π', '∞', '√', '∑', '∫', '∆', 'µ', '°',
  '→', '←', '↑', '↓', '↔', '⇒', '⇔',
  '★', '✔', '✕', '●', '■', '▲', '◆', '♥',
];

export default function DocEditor({
  meta,
  content,
  onSave,
  onRename,
  onBack,
  onOpenWorkspaceFile,
}: DocEditorProps) {
  const ui = useUi();
  const { listFiles, loadContent, saveFile, listVersions, saveVersion, restoreVersion, deleteVersion } = useWorkspace();
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [title, setTitle] = useState(meta.name);
  const [page, setPage] = useState<PageSettings>(content.page || defaultPage());
  const [zoom, setZoom] = useState(100);
  const [showOutline, setShowOutline] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number; pos: number }[]>([]);

  const [watermark, setWatermark] = useState<string>(content.watermark ?? '');
  const [paperBg, setPaperBg] = useState<string>(content.paperBg ?? '#ffffff');
  const [columnCount, setColumnCount] = useState<number>(content.columnCount ?? 1);
  const [footnotes, setFootnotes] = useState<DocFootnoteItem[]>(content.footnotes ?? []);
  const [sortAscending, setSortAscending] = useState(true);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<Record<string, unknown> | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [showDrawModal, setShowDrawModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const [showSymbols, setShowSymbols] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [customVersionName, setCustomVersionName] = useState('');

  const [comments, setComments] = useState<CommentItem[]>(content.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'open' | 'resolved'>('open');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentQuote, setCommentQuote] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const [isFocusMode, setIsFocusMode] = useState(false);

  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [translateTargetLang, setTranslateTargetLang] = useState('en');
  const [translatedText, setTranslatedText] = useState('');

  const [showSlidesModal, setShowSlidesModal] = useState(false);
  const [slideDeck, setSlideDeck] = useState<Array<{ title: string; bullets: string[] }>>([]);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [workspaceDocs, setWorkspaceDocs] = useState<FileMeta[]>([]);
  const [showEditorCheckModal, setShowEditorCheckModal] = useState(false);
  const [showParagraphMarks, setShowParagraphMarks] = useState(false);
  const [pdfExportMode, setPdfExportMode] = useState<null | 'standard' | 'compressed' | 'imageOnly'>(null);
  const [keepPdfAttributes, setKeepPdfAttributes] = useState(true);
  const [showOcrImportModal, setShowOcrImportModal] = useState(false);
  const [ocrExtractedText, setOcrExtractedText] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showMailMergeModal, setShowMailMergeModal] = useState(false);
  const [mailPreviewIdx, setMailPreviewIdx] = useState(0);
  const [mailRecipients, setMailRecipients] = useState<Array<Record<string, string>>>(() => {
    const today = new Date().toLocaleDateString('vi-VN');
    return [
      {
        Ho_ten: 'Nguyễn Minh Quân',
        Chuc_vu: 'Giám đốc Vận hành',
        Phong_ban: 'Khối Vận hành',
        Email: 'quan.nm@minhspark.vn',
        Ngay: today,
      },
      {
        Ho_ten: 'Trần Thu Hà',
        Chuc_vu: 'Trưởng phòng Tài chính',
        Phong_ban: 'Khối Tài chính - Kế toán',
        Email: 'ha.tt@minhspark.vn',
        Ngay: today,
      },
      {
        Ho_ten: 'Lê Hoàng Nam',
        Chuc_vu: 'Trưởng nhóm Kỹ thuật',
        Phong_ban: 'Khối Công nghệ',
        Email: 'nam.lh@minhspark.vn',
        Ngay: today,
      },
    ];
  });

  const [editMode, setEditMode] = useState<'editing' | 'viewing'>('editing');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        link: { openOnClick: false },
        underline: {},
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: true, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: 'Bắt đầu soạn thảo văn bản tại đây…' }),
      CharacterCount,
      ParagraphFormat,
      PageBreak,
    ],
    content: content.json || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: e }) => {
      setSavedStatus('saving');
      updateHeadings(e);
    },
    onSelectionUpdate: ({ editor: e }) => {
      if (formatPainterActive && copiedFormat) {
        const chain = e.chain().focus();
        if (copiedFormat.bold) chain.setBold();
        else chain.unsetBold();
        if (copiedFormat.italic) chain.setItalic();
        else chain.unsetItalic();
        if (copiedFormat.underline) chain.setUnderline();
        else chain.unsetUnderline();
        if (copiedFormat.strike) chain.setStrike();
        else chain.unsetStrike();
        if (copiedFormat.color) chain.setColor(copiedFormat.color as string);
        if (copiedFormat.fontFamily) chain.setFontFamily(copiedFormat.fontFamily as string);
        if (copiedFormat.fontSize) chain.setFontSize(copiedFormat.fontSize as string);
        if (copiedFormat.highlight) chain.setHighlight({ color: copiedFormat.highlight as string });
        chain.run();
        setFormatPainterActive(false);
        setCopiedFormat(null);
        ui.toast('Đã dán định dạng văn bản');
      }
    },
  });

  const updateHeadings = (e: typeof editor) => {
    if (!e) return;
    const items: { id: string; text: string; level: number; pos: number }[] = [];
    e.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent;
        if (text) {
          items.push({
            id: `heading-${pos}`,
            text,
            level: node.attrs.level,
            pos,
          });
        }
      }
    });
    setHeadings(items);
  };

  useEffect(() => {
    if (editor) {
      updateHeadings(editor);
    }
  }, [editor]);

  const toggleVoiceDictation = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      ui.toast('Trình duyệt hiện tại chưa hỗ trợ Web Speech API', true);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      ui.toast('Đã tắt micro nhập giọng nói');
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = 'vi-VN';
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((r: any) => r[0].transcript)
          .join(' ');
        if (transcript.trim() && editor) {
          editor.chain().focus().insertContent(`${transcript} `).run();
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      ui.toast('Đang lắng nghe giọng nói tiếng Việt… Hãy nói vào micro!');
    }
  };

  const buildDocContentPayload = useCallback(
    (jsonOverride?: JSONContent): DocContent => ({
      kind: 'doc',
      json: jsonOverride ?? editor?.getJSON() ?? content.json,
      page,
      comments,
      watermark: watermark || undefined,
      paperBg: paperBg !== '#ffffff' ? paperBg : undefined,
      columnCount: columnCount !== 1 ? columnCount : undefined,
      footnotes: footnotes.length > 0 ? footnotes : undefined,
    }),
    [editor, content.json, page, comments, watermark, paperBg, columnCount, footnotes]
  );

  const handleSaveImmediate = useCallback(() => {
    if (!editor) return;
    onSave(
      { ...meta, name: title, updatedAt: Date.now(), preview: editor.getText().slice(0, 160) },
      buildDocContentPayload()
    );
    setSavedStatus('saved');
    ui.toast('Đã lưu tài liệu thành công!');
  }, [editor, meta, title, onSave, buildDocContentPayload, ui]);

  const handleOpenAddComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    setCommentQuote(selectedText || '');
    setNewCommentText('');
    setShowComments(true);
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveImmediate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleOpenAddComment();
      }
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveImmediate, handleOpenAddComment, isFocusMode]);

  useEffect(() => {
    if (savedStatus !== 'saving' || !editor) return;
    const timer = setTimeout(() => {
      const updatedMeta: FileMeta = {
        ...meta,
        name: title,
        updatedAt: Date.now(),
        preview: editor.getText().slice(0, 160),
      };
      onSave(updatedMeta, buildDocContentPayload());
      setSavedStatus('saved');
    }, 800);

    return () => clearTimeout(timer);
  }, [savedStatus, editor, meta, title, buildDocContentPayload, onSave]);

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment: CommentItem = {
      id: 'c_' + Math.random().toString(36).slice(2, 9),
      author: 'Minh Spark',
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
      quote: commentQuote || undefined,
      replies: [],
    };
    setComments((prev) => [newComment, ...prev]);
    setNewCommentText('');
    setCommentQuote('');
    setSavedStatus('saving');
    ui.toast('Đã thêm bình luận');
  };

  const handleResolveComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))
    );
    setSavedStatus('saving');
  };

  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setSavedStatus('saving');
    ui.toast('Đã xoá bình luận');
  };

  const handleAddReply = (commentId: string) => {
    const text = replyTexts[commentId]?.trim();
    if (!text) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const replies = c.replies || [];
        return {
          ...c,
          replies: [
            ...replies,
            {
              id: 'r_' + Math.random().toString(36).slice(2, 9),
              author: 'Minh Spark',
              text,
              createdAt: Date.now(),
            },
          ],
        };
      })
    );
    setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
    setSavedStatus('saving');
  };

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setShowHistoryModal(true);
  };

  const handleCreateSnapshot = async (label?: string) => {
    if (!editor) return;
    const docCont = buildDocContentPayload();
    const saved = await saveVersion(meta.id, docCont, label || customVersionName.trim() || undefined);
    setVersions((prev) => [saved, ...prev]);
    setCustomVersionName('');
    ui.toast('Đã ghi nhớ phiên bản vào lịch sử');
  };

  const handleRestoreVersion = async (v: FileVersion) => {
    if (!editor) return;
    await restoreVersion(meta.id, v.id);
    const cont = v.content as DocContent;
    if (cont?.json) {
      editor.commands.setContent(cont.json);
      if (cont.page) setPage(cont.page);
      if (cont.comments) setComments(cont.comments);
      setWatermark(cont.watermark ?? '');
      setPaperBg(cont.paperBg ?? '#ffffff');
      setColumnCount(cont.columnCount ?? 1);
      setFootnotes(cont.footnotes ?? []);
      setShowHistoryModal(false);
      ui.toast(`Đã khôi phục về "${v.label}"`);
      setSavedStatus('saving');
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(meta.id, versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    ui.toast('Đã xoá phiên bản lưu');
  };

  const buildPdfBlocksWithFootnotes = () => {
    const blocks = tiptapJsonToPdfBlocks(editor?.getJSON());
    if (footnotes.length > 0) {
      blocks.push({ type: 'hr' });
      blocks.push({ type: 'h3', text: 'Chú thích cuối trang (Footnotes)' });
      for (const fn of footnotes) {
        blocks.push({ type: 'p', text: `[${fn.index}] ${fn.text}` });
      }
    }
    return blocks;
  };

  const handleExportImage = async () => {
    if (!editor) return;
    ui.showBusy('Đang kết xuất trang tài liệu ra ảnh PNG độ phân giải cao…');
    try {
      const blocks = buildPdfBlocksWithFootnotes();
      const generated = await createPdfFromBlocks(title, blocks, {
        orientation: page.orientation,
        watermark: watermark || undefined,
        header: keepPdfAttributes ? page.header : undefined,
        footer: keepPdfAttributes ? page.footer : undefined,
        pageNumbers: keepPdfAttributes ? page.pageNumbers : false,
        scale: 2,
      });
      const proxy = await loadPdfDocumentProxy(generated.bytes);
      const pngBlob = await renderPdfPageToPngBlob(proxy, 1, 2);
      await disposePdfDocumentProxy(proxy);
      const base = title.replace(/\.[^/.]+$/, '') || 'Tai-lieu';
      downloadBlob(pngBlob, `${base}.png`);
      ui.toast('Đã xuất ảnh PNG trang tài liệu sắc nét!');
    } catch (err) {
      ui.toast((err as Error).message || 'Có lỗi xảy ra khi xuất ảnh', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleCreatePdfDocument = async (
    mode: 'standard' | 'compressed' | 'imageOnly',
    openInWorkspace: boolean
  ) => {
    if (!editor) return;
    ui.showBusy(
      mode === 'compressed'
        ? 'Đang nén tối ưu dung lượng tệp PDF…'
        : mode === 'imageOnly'
        ? 'Đang kết xuất PDF dạng ảnh phẳng chống sao chép…'
        : 'Đang khởi tạo tệp nhị phân PDF chuẩn A4…'
    );
    try {
      const blocks = buildPdfBlocksWithFootnotes();
      const base = title.replace(/\.[^/.]+$/, '') || 'Tai-lieu';
      const suffix =
        mode === 'compressed'
          ? ' (Nén gọn)'
          : mode === 'imageOnly'
          ? ' (Chỉ đọc)'
          : '';
      const pdfName = `${base}${suffix}.pdf`;
      const generated = await createPdfFromBlocks(pdfName, blocks, {
        orientation: page.orientation,
        watermark: watermark || undefined,
        header: keepPdfAttributes ? page.header : undefined,
        footer: keepPdfAttributes ? page.footer : undefined,
        pageNumbers: keepPdfAttributes ? page.pageNumbers : false,
        useJpeg: mode !== 'standard',
        quality: mode === 'compressed' ? 0.52 : mode === 'imageOnly' ? 0.86 : 0.94,
        scale: mode === 'compressed' ? 1.35 : 2,
      });
      setPdfExportMode(null);
      if (openInWorkspace) {
        const newMeta: FileMeta = {
          id: `pdf-${Date.now()}`,
          name: pdfName,
          kind: 'pdf',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: generated.bytes.byteLength,
          preview: generated.extractedPages[0]?.slice(0, 160) || `Xuất từ Minh Docs "${title}"`,
        };
        const newContent: PdfContent = {
          kind: 'pdf',
          pdfDataUrl: generated.dataUrl,
          pageCount: generated.pageCount,
          extractedPages: mode === 'imageOnly' ? generated.extractedPages.map(() => '') : generated.extractedPages,
          watermark: watermark || undefined,
        };
        await saveFile(newMeta, newContent);
        ui.toast(`Đã lưu "${pdfName}" (${generated.pageCount} trang) vào Minh PDF`);
        onOpenWorkspaceFile?.(newMeta, newContent);
      } else {
        downloadBlob(new Blob([generated.bytes.slice(0)], { type: 'application/pdf' }), pdfName);
        ui.toast(`Đã tải xuống "${pdfName}" (${generated.pageCount} trang)`);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi tạo tệp PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExtractTablesToExcel = async (openInWorkspace: boolean) => {
    if (!editor) return;
    ui.showBusy('Đang trích xuất bảng biểu sang Minh Sheets (.xlsx)…');
    try {
      const blocks = tiptapJsonToPdfBlocks(editor.getJSON());
      const tables = blocks
        .filter((b) => b.type === 'table' && b.rows && b.rows.length > 0)
        .map((b) => b.rows!);
      const fallbackLines = editor
        .getText()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const base = title.replace(/\.[^/.]+$/, '') || 'Trich-xuat-bang';
      const xlsxName = `${base}.xlsx`;
      const wb = buildWorkbookFromTables(base, tables, fallbackLines);
      const blob = await exportWorkbookToXlsx(wb);
      if (openInWorkspace) {
        const newMeta: FileMeta = {
          id: `sheet-${Date.now()}`,
          name: xlsxName,
          kind: 'sheet',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: blob.size,
          preview: `Trích xuất ${Math.max(1, tables.length)} bảng từ "${title}"`,
        };
        const newContent: SheetContent = {
          kind: 'sheet',
          workbook: wb,
        };
        await saveFile(newMeta, newContent);
        ui.toast(`Đã mở bảng trích xuất trong Minh Sheets`);
        onOpenWorkspaceFile?.(newMeta, newContent);
      } else {
        downloadBlob(blob, xlsxName);
        ui.toast(`Đã tải xuống bảng tính "${xlsxName}"`);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi trích xuất bảng sang Excel', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleSortParagraphs = () => {
    if (!editor) return;
    const json = editor.getJSON();
    const nodes = [...(json.content ?? [])];
    if (nodes.length < 2) {
      ui.toast('Cần ít nhất 2 đoạn văn để sắp xếp');
      return;
    }
    const textOf = (n: JSONContent): string => {
      if (n.type === 'text') return n.text ?? '';
      return (n.content ?? []).map(textOf).join('');
    };
    const nextAsc = !sortAscending;
    const sorted = [...nodes].sort((a, b) => {
      const ta = textOf(a).trim();
      const tb = textOf(b).trim();
      const cmp = ta.localeCompare(tb, 'vi', { numeric: true, sensitivity: 'base' });
      return sortAscending ? cmp : -cmp;
    });
    editor.commands.setContent({ type: 'doc', content: sorted });
    setSortAscending(nextAsc);
    setSavedStatus('saving');
    ui.toast(`Đã sắp xếp ${sorted.length} khối văn bản theo thứ tự ${sortAscending ? 'A → Z' : 'Z → A'}`);
  };

  const handleInsertFootnote = async () => {
    if (!editor) return;
    const nextIdx = footnotes.length + 1;
    const res = await ui.ask({
      title: `Chèn chú thích cuối trang [${nextIdx}]`,
      fields: [
        {
          name: 'note',
          label: 'Nội dung giải thích / nguồn trích dẫn',
          type: 'textarea',
          placeholder: 'Ví dụ: Theo Thông tư 30/2020/TT-BTTTT về công tác văn thư điện tử…',
        },
      ],
      confirmText: 'Chèn Footnote',
    });
    if (!res || !String(res.note ?? '').trim()) return;
    const noteText = String(res.note).trim();
    editor.chain().focus().insertContent(`<sup>[${nextIdx}]</sup>`).run();
    setFootnotes((prev) => [
      ...prev,
      { id: `fn-${Date.now()}`, index: nextIdx, text: noteText },
    ]);
    setSavedStatus('saving');
    ui.toast(`Đã chèn chú thích cuối trang [${nextIdx}]`);
  };

  const handleRemoveFootnote = (id: string) => {
    setFootnotes((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f, idx) => ({ ...f, index: idx + 1 }))
    );
    setSavedStatus('saving');
  };

  const splitSections = (() => {
    const docJson = editor?.getJSON();
    const nodes = docJson?.content ?? [];
    const sections: Array<{ title: string; nodes: JSONContent[] }> = [];
    let currentTitle = 'Phần mở đầu';
    let currentNodes: JSONContent[] = [];

    const readNodeText = (n: JSONContent): string =>
      n.type === 'text' ? n.text ?? '' : (n.content ?? []).map(readNodeText).join('');

    for (const node of nodes) {
      if (node.type === 'heading' && Number(node.attrs?.level ?? 1) <= 2) {
        if (currentNodes.length > 0) {
          sections.push({ title: currentTitle, nodes: currentNodes });
        }
        currentTitle = readNodeText(node).trim() || `Phần ${sections.length + 1}`;
        currentNodes = [node];
      } else {
        currentNodes.push(node);
      }
    }
    if (currentNodes.length > 0) {
      sections.push({ title: currentTitle, nodes: currentNodes });
    }
    return sections;
  })();

  const handleRunSplitDocument = async (saveToWorkspace: boolean) => {
    if (!editor || splitSections.length === 0) return;
    ui.showBusy('Đang tách tài liệu theo từng chương mục…');
    try {
      const base = title.replace(/\.[^/.]+$/, '') || 'Tai-lieu';
      for (let i = 0; i < splitSections.length; i++) {
        const sec = splitSections[i];
        const safeSecTitle = sec.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 48);
        const secFileName = `${base} - Phần ${i + 1} (${safeSecTitle}).docx`;
        const secDocJson: JSONContent = { type: 'doc', content: sec.nodes };
        if (saveToWorkspace) {
          const blob = await exportDocx(secDocJson, page, secFileName);
          const newMeta: FileMeta = {
            id: `doc-${Date.now()}-${i}`,
            name: secFileName,
            kind: 'doc',
            createdAt: Date.now() + i,
            updatedAt: Date.now() + i,
            openedAt: Date.now() + i,
            starred: false,
            deletedAt: null,
            size: blob.size,
            preview: sec.title,
          };
          const newCont: DocContent = {
            kind: 'doc',
            json: secDocJson,
            page,
          };
          await saveFile(newMeta, newCont);
        } else {
          const blob = await exportDocx(secDocJson, page, secFileName);
          downloadBlob(blob, secFileName);
        }
      }
      setShowSplitModal(false);
      ui.toast(
        saveToWorkspace
          ? `Đã tách và lưu ${splitSections.length} tài liệu con vào Kho Minh Docs`
          : `Đã tải xuống ${splitSections.length} tệp .docx độc lập`
      );
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi tách tài liệu', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleOpenMergeModal = async () => {
    const all = await listFiles();
    setWorkspaceDocs(all.filter((f) => !f.deletedAt && f.kind === 'doc' && f.id !== meta.id));
    setShowMergeModal(true);
  };

  const handleMergeUploadedDocx = async (file: File) => {
    if (!editor) return;
    ui.showBusy(`Đang đọc và ghép nối "${file.name}"…`);
    try {
      const buf = await file.arrayBuffer();
      const html = await importDocx(buf);
      editor.chain().focus('end').insertPageBreak().insertContent(html).run();
      setShowMergeModal(false);
      setSavedStatus('saving');
      ui.toast(`Đã ghép toàn bộ nội dung "${file.name}" vào cuối văn bản!`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể đọc tệp .docx đã chọn', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleMergeWorkspaceDoc = async (docMeta: FileMeta) => {
    if (!editor) return;
    ui.showBusy(`Đang ghép tài liệu "${docMeta.name}"…`);
    try {
      const target = await loadContent(docMeta.id);
      if (target && target.kind === 'doc' && target.json) {
        const currentNodes = editor.getJSON().content ?? [];
        const extraNodes =
          typeof target.json === 'string'
            ? []
            : target.json.content ?? [];
        if (typeof target.json === 'string') {
          editor.chain().focus('end').insertPageBreak().insertContent(target.json).run();
        } else {
          editor.commands.setContent({
            type: 'doc',
            content: [...currentNodes, { type: 'pageBreak' }, ...extraNodes],
          });
        }
        setShowMergeModal(false);
        setSavedStatus('saving');
        ui.toast(`Đã ghép "${docMeta.name}" vào cuối văn bản hiện tại!`);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi ghép tài liệu', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const currentPlainText = editor?.getText() || '';
  const proofreadReport = useMemo(() => {
    const raw = currentPlainText;
    const doubleSpaces = (raw.match(/ {2,}/g) || []).length;
    const spaceBeforePunct = (raw.match(/\s+[,.;:!?]/g) || []).length;
    const lowerAfterDot = (raw.match(/[.!?]\s+[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g) || []).length;
    const repeatedWords = (raw.match(/\b(\p{L}{2,})\s+\1\b/giu) || []).length;
    const sentences = raw
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const longSentences = sentences.filter((s) => s.split(/\s+/).length > 45).length;
    const totalIssues = doubleSpaces + spaceBeforePunct + lowerAfterDot + repeatedWords + longSentences;
    const score = Math.max(55, 100 - doubleSpaces * 2 - spaceBeforePunct * 3 - lowerAfterDot * 3 - repeatedWords * 4 - longSentences * 3);
    return {
      doubleSpaces,
      spaceBeforePunct,
      lowerAfterDot,
      repeatedWords,
      longSentences,
      totalIssues,
      score,
      sentenceCount: sentences.length,
    };
  }, [currentPlainText]);

  const handleAutoFixProofread = () => {
    if (!editor) return;
    const cleanNode = (node: JSONContent): JSONContent => {
      if (node.type === 'text' && typeof node.text === 'string') {
        const cleaned = node.text
          .replace(/ {2,}/g, ' ')
          .replace(/\s+([,.;:!?])/g, '$1')
          .replace(/([.!?]\s+)([\p{Ll}])/gu, (_, p1: string, p2: string) => p1 + p2.toUpperCase());
        return { ...node, text: cleaned };
      }
      if (node.content) {
        return { ...node, content: node.content.map(cleanNode) };
      }
      return node;
    };
    const nextJson = cleanNode(editor.getJSON());
    editor.commands.setContent(nextJson);
    setSavedStatus('saving');
    ui.toast('Đã tự động chuẩn hoá khoảng trắng, dấu câu và viết hoa đầu câu!');
  };

  const handleOcrFileUpload = async (file: File) => {
    ui.showBusy(`Đang trích xuất văn bản từ "${file.name}"…`);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const bundle = await extractPdfTextAndTables(bytes);
        setOcrExtractedText(bundle.pagesText.join('\n\n--- Ngắt trang ---\n\n'));
      } else if (/\.(docx|doc)$/i.test(file.name)) {
        const html = await importDocx(await file.arrayBuffer());
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        setOcrExtractedText(tmp.innerText || tmp.textContent || '');
      } else {
        setOcrExtractedText(await file.text());
      }
      ui.toast(`Đã trích xuất nội dung từ "${file.name}"`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể nhận dạng tệp', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleImportMailRecipients = async (file: File) => {
    try {
      const wb = await importSpreadsheet(await file.arrayBuffer(), file.name);
      const firstSheet = wb.sheets[wb.sheetOrder[0]];
      if (!firstSheet) return;
      const cellStr = (r: number, c: number) => String(firstSheet.cellData[r]?.[c]?.v ?? '').trim();
      const headers: string[] = [];
      for (let c = 0; c < 12; c++) {
        const h = cellStr(0, c);
        if (h) headers.push(h.replace(/\s+/g, '_'));
      }
      if (headers.length === 0) return;
      const rows: Array<Record<string, string>> = [];
      for (let r = 1; r < 200; r++) {
        const rec: Record<string, string> = {};
        let nonEmpty = false;
        headers.forEach((h, cIdx) => {
          const val = cellStr(r, cIdx);
          if (val) nonEmpty = true;
          rec[h] = val;
        });
        if (nonEmpty) rows.push(rec);
      }
      if (rows.length > 0) {
        setMailRecipients(rows);
        setMailPreviewIdx(0);
        ui.toast(`Đã nạp ${rows.length} người nhận từ "${file.name}"`);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể đọc danh sách người nhận', true);
    }
  };

  const handleGenerateMailMerge = () => {
    if (!editor || mailRecipients.length === 0) return;
    const templateHtml = editor.getHTML();
    const mergedHtmlParts = mailRecipients.map((rec) => {
      let part = templateHtml;
      for (const [k, v] of Object.entries(rec)) {
        const pattern = new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'gi');
        part = part.replace(pattern, v);
      }
      return part;
    });
    editor.commands.setContent(mergedHtmlParts.join('<hr data-page-break="true" class="page-break" />'));
    setShowMailMergeModal(false);
    setSavedStatus('saving');
    ui.toast(`Đã trộn thành công ${mailRecipients.length} văn bản cá nhân hoá (ngắt trang riêng từng người)!`);
  };

  const handleOpenTranslate = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    const sourceText = selected || editor.getText();
    const dictionary: Record<string, string> = {
      'báo cáo': 'report',
      'kế hoạch': 'action plan',
      'cuộc họp': 'meeting',
      'biên bản': 'minutes',
      'hợp đồng': 'contract',
      'kinh tế': 'economic / commercial',
      'hoạt động': 'operations',
      'mục tiêu': 'objectives',
      'nội dung': 'content / agenda',
      'kết luận': 'conclusion',
      'thời gian': 'time',
      'ngày': 'date',
      'thành viên': 'participants',
      'chủ trì': 'chairperson',
      'thư ký': 'secretary',
      'triển khai': 'deploy / execute',
      'tiến độ': 'progress',
      'ngân sách': 'budget',
      'nhân sự': 'human resources',
    };
    let result = sourceText;
    if (translateTargetLang === 'en') {
      for (const [k, v] of Object.entries(dictionary)) {
        const regex = new RegExp(k, 'gi');
        result = result.replace(regex, v);
      }
      result = `[Bản dịch tiếng Anh]\n\n${result}`;
    } else {
      result = `[Bản dịch (${translateTargetLang.toUpperCase()})]\n\n${sourceText}`;
    }
    setTranslatedText(result);
    setShowTranslateModal(true);
  };

  const handleApplyTranslation = () => {
    if (!editor || !translatedText) return;
    editor.chain().focus().insertContent(`<p><em>${translatedText.replace(/\n/g, '<br/>')}</em></p>`).run();
    setShowTranslateModal(false);
    ui.toast('Đã chèn bản dịch vào văn bản');
  };

  const handleGenerateSlides = () => {
    if (!editor) return;
    const deck = splitSections.map((sec, idx) => {
      const bullets: string[] = [];
      for (const node of sec.nodes) {
        if (node.type === 'heading') continue;
        const txt = (node.content ?? [])
          .map((c) => (c.type === 'text' ? c.text ?? '' : ''))
          .join('')
          .trim();
        if (txt) bullets.push(txt.slice(0, 120));
        if (bullets.length >= 4) break;
      }
      return {
        title: `${idx + 1}. ${sec.title}`,
        bullets: bullets.length > 0 ? bullets : ['Nội dung trọng tâm trích xuất từ tài liệu.'],
      };
    });
    setSlideDeck(deck);
    setShowSlidesModal(true);
  };

  const handleExportSlideDeckHtml = () => {
    const pagesText = slideDeck.map((s) => `${s.title}\n${s.bullets.join('\n')}`);
    const { html } = convertPdfToSlideDeckHtml(title, pagesText);
    const base = title.replace(/\.[^/.]+$/, '') || 'Slide-Deck';
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}-Slides.html`);
    ui.toast('Đã tải xuống bộ Slide trình chiếu HTML 16:9!');
  };

  const handleRunAiSmart = (action: string) => {
    if (!editor) return;
    setIsAiLoading(true);
    setTimeout(() => {
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, ' ').trim();
      const rawText = selected || editor.getText().trim();
      const paragraphs = rawText
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      let res = '';
      if (action === 'formal') {
        const core = paragraphs.slice(0, 4).join('\n\n');
        res = `Kính gửi Ban Giám đốc và các bộ phận liên quan,\n\nCăn cứ nội dung "${title.replace(/\.[^/.]+$/, '')}":\n\n${core}\n\nĐề nghị các đơn vị phối hợp triển khai đúng tiến độ và tiêu chuẩn chất lượng đã ban hành.\n\nTrân trọng.`;
      } else if (action === 'summary') {
        const keyPoints =
          headings.length > 0
            ? headings.map((h, i) => `${i + 1}. ${h.text}`)
            : paragraphs.slice(0, 5).map((p, i) => `${i + 1}. ${p.slice(0, 140)}`);
        res = `TÓM TẮT TÀI LIỆU (${paragraphs.length} đoạn · ${editor.storage.characterCount?.words() ?? 0} từ):\n` + keyPoints.join('\n');
      } else if (action === 'expand') {
        const seed = selected || paragraphs[0] || title;
        res = `${seed}\n\nTriển khai chi tiết:\n- Xác định đầu mối phụ trách, mốc thời gian hoàn thành (SLA) và chỉ số nghiệm thu định lượng.\n- Thiết lập cơ chế rà soát định kỳ hàng tuần nhằm kiểm soát rủi ro tiến độ và ngân sách.\n- Lưu trữ hồ sơ điện tử và đối chiếu kết quả thực tế so với kế hoạch ban đầu.`;
      } else {
        res =
          `Điểm chuẩn văn phong hiện tại: ${proofreadReport.score}/100 (${proofreadReport.sentenceCount} câu).\n` +
          `- Khoảng trắng kép thừa: ${proofreadReport.doubleSpaces} vị trí\n` +
          `- Khoảng trắng trước dấu câu: ${proofreadReport.spaceBeforePunct} vị trí\n` +
          `- Chữ thường sau dấu chấm câu: ${proofreadReport.lowerAfterDot} vị trí\n` +
          `- Từ lặp liên tiếp: ${proofreadReport.repeatedWords} vị trí\n` +
          `- Câu dài trên 45 từ: ${proofreadReport.longSentences} câu`;
      }
      setAiResult(res);
      setIsAiLoading(false);
    }, 180);
  };

  const handleApplyAiResult = () => {
    if (!editor || !aiResult) return;
    editor.chain().focus().insertContent(`<p>${aiResult.replace(/\n/g, '<br/>')}</p>`).run();
    setShowAiModal(false);
    ui.toast('Đã chèn nội dung AI vào tài liệu');
  };

  const handleInsertTemplate = (type: string) => {
    if (!editor) return;
    let html = '';
    if (type === 'report') html = sampleDocHtml();
    else if (type === 'contract') html = contractDocHtml();
    else html = meetingMinutesDocHtml();
    editor.commands.setContent(html);
    setShowTemplatesModal(false);
    ui.toast('Đã nạp mẫu tài liệu thành công!');
    setSavedStatus('saving');
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      onRename(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  // Case Transformation
  const handleTransformCase = (mode: 'upper' | 'lower' | 'title') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    if (!text) return;

    let converted = text;
    if (mode === 'upper') converted = text.toUpperCase();
    if (mode === 'lower') converted = text.toLowerCase();
    if (mode === 'title') {
      converted = text.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    editor.chain().focus().insertContentAt({ from, to }, converted).run();
    ui.toast('Đã chuyển đổi kiểu chữ');
  };

  // Insert Table of Contents
  const handleInsertTOC = () => {
    if (!editor) return;
    if (headings.length === 0) {
      ui.toast('Chưa có tiêu đề nào để lập mục lục', true);
      return;
    }
    const tocHtml = `
      <div style="background: #f7f9fd; border: 1px solid #d4dae5; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <h3 style="margin: 0 0 10px 0; color: #2b579a;">MỤC LỤC TÀI LIỆU</h3>
        <ul style="list-style-type: none; padding-left: 0; margin: 0;">
          ${headings
            .map(
              (h) => `
            <li style="margin-left: ${(h.level - 1) * 20}px; margin-bottom: 6px;">
              <span style="font-weight: ${h.level === 1 ? 'bold' : 'normal'}; color: #333;">${h.text}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
    editor.chain().focus().insertContent(tocHtml).run();
    ui.toast('Đã chèn bảng mục lục vào tài liệu');
  };

  // Format painter toggle
  const handleToggleFormatPainter = () => {
    if (!editor) return;
    if (formatPainterActive) {
      setFormatPainterActive(false);
      setCopiedFormat(null);
    } else {
      const attrs = editor.getAttributes('textStyle');
      const format = {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        color: attrs.color,
        fontFamily: attrs.fontFamily,
        fontSize: attrs.fontSize,
        highlight: editor.getAttributes('highlight').color,
      };
      setCopiedFormat(format);
      setFormatPainterActive(true);
      ui.toast('Đã sao chép định dạng. Nhấp chọn đoạn văn bản cần áp dụng.');
    }
  };

  // Find & Replace actions
  const handleFindNext = () => {
    if (!editor || !findText.trim()) return;
    const docText = editor.getText();
    const query = matchCase ? findText : findText.toLowerCase();
    const target = matchCase ? docText : docText.toLowerCase();
    const index = target.indexOf(query);
    if (index >= 0) {
      ui.toast(`Tìm thấy từ khớp tại vị trí ${index + 1}`);
    } else {
      ui.toast('Không tìm thấy từ cần tìm', true);
    }
  };

  const handleReplaceCurrent = () => {
    if (!editor || !findText.trim()) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    if (selected.toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceText).run();
      ui.toast('Đã thay thế');
    } else {
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!editor || !findText.trim()) return;
    let html = editor.getHTML();
    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const matches = (html.match(regex) || []).length;
    if (matches > 0) {
      html = html.replace(regex, replaceText);
      editor.commands.setContent(html);
      ui.toast(`Đã thay thế ${matches} vị trí`);
    } else {
      ui.toast('Không tìm thấy vị trí nào khớp để thay thế', true);
    }
  };

  // Export handlers
  const handleExportDocx = async () => {
    if (!editor) return;
    try {
      ui.showBusy('Đang tạo tệp Minh Docs (.docx)…');
      const blob = await exportDocx(editor.getJSON(), page, title);
      downloadBlob(blob, `${title}.docx`);
      ui.toast('Đã tải xuống tệp Minh Docs (.docx) thành công!');
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất DOCX', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportHtml = () => {
    if (!editor) return;
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 24px;line-height:1.7}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}blockquote{border-left:3px solid #2b579a;padding-left:12px;color:#555}</style></head><body>${editor.getHTML()}</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${title}.html`);
    ui.toast('Đã tải xuống HTML!');
  };

  const handleExportMarkdown = () => {
    if (!editor) return;
    const md = jsonToMarkdown(editor.getJSON());
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${title}.md`);
    ui.toast('Đã tải xuống tệp Markdown (.md)!');
  };

  const handleExportTxt = () => {
    if (!editor) return;
    const blob = new Blob([editor.getText()], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${title}.txt`);
    ui.toast('Đã tải xuống Plain Text!');
  };

  const handleInsertImage = async () => {
    if (!editor) return;
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      editor.chain().focus().setImage({ src: dataUrl }).run();
      ui.toast('Đã chèn hình ảnh');
    } catch {
      ui.toast('Không thể tải ảnh này', true);
    }
  };

  const handleInsertLink = async () => {
    if (!editor) return;
    const prevUrl = editor.getAttributes('link').href || '';
    const result = await ui.ask({
      title: 'Chèn liên kết',
      fields: [{ name: 'url', label: 'Địa chỉ URL (https://...)', value: prevUrl, placeholder: 'https://example.com' }],
      confirmText: 'Lưu link',
    });
    if (!result) return;
    const url = String(result.url || '').trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
  };

  const handleInsertTable = async () => {
    if (!editor) return;
    const res = await ui.ask({
      title: 'Chèn bảng mới',
      fields: [
        { name: 'rows', label: 'Số dòng', type: 'number', value: 3, min: 1, max: 50 },
        { name: 'cols', label: 'Số cột', type: 'number', value: 3, min: 1, max: 20 },
      ],
      confirmText: 'Chèn bảng',
    });
    if (!res) return;
    const rows = Math.max(1, Number(res.rows) || 3);
    const cols = Math.max(1, Number(res.cols) || 3);
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  const handlePageSettings = async () => {
    const res = await ui.ask({
      title: 'Thiết lập trang (Page Setup)',
      fields: [
        {
          name: 'size',
          label: 'Khổ giấy',
          type: 'select',
          value: page.size,
          options: [
            { value: 'A4', label: 'A4 (210 × 297 mm)' },
            { value: 'A5', label: 'A5 (148 × 210 mm)' },
            { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
            { value: 'Legal', label: 'Legal (8.5 × 14 in)' },
          ],
        },
        {
          name: 'orientation',
          label: 'Hướng giấy',
          type: 'select',
          value: page.orientation,
          options: [
            { value: 'portrait', label: 'Trang dọc (Portrait)' },
            { value: 'landscape', label: 'Trang ngang (Landscape)' },
          ],
        },
        { name: 'header', label: 'Tiêu đề đầu trang (Header)', value: page.header, placeholder: 'Văn bản đầu trang...' },
        { name: 'footer', label: 'Tiêu đề chân trang (Footer)', value: page.footer, placeholder: 'Văn bản chân trang...' },
        { name: 'pageNumbers', label: 'Hiển thị số trang', type: 'checkbox', value: page.pageNumbers },
      ],
      confirmText: 'Áp dụng',
    });
    if (!res) return;
    setPage((prev) => ({
      ...prev,
      size: (res.size as PageSettings['size']) || prev.size,
      orientation: (res.orientation as PageSettings['orientation']) || prev.orientation,
      header: String(res.header || ''),
      footer: String(res.footer || ''),
      pageNumbers: Boolean(res.pageNumbers),
    }));
    setSavedStatus('saving');
    ui.toast('Đã cập nhật thiết lập trang');
  };

  const handleShowDetailedStats = async () => {
    if (!editor) return;
    const text = editor.getText();
    const words = editor.storage.characterCount?.words() ?? 0;
    const chars = editor.storage.characterCount?.characters() ?? 0;
    const charsNoSpaces = text.replace(/\s+/g, '').length;
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0).length;
    const readMin = Math.max(1, Math.ceil(words / 200));
    const speakMin = Math.max(1, Math.ceil(words / 130));

    await ui.ask({
      title: 'Thống kê chi tiết tài liệu',
      body: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13, padding: '10px 0' }}>
          <div>Số trang ước tính: <strong>{Math.max(1, Math.ceil(chars / 2500))}</strong></div>
          <div>Số đoạn văn: <strong>{paragraphs}</strong></div>
          <div>Số từ: <strong>{words}</strong></div>
          <div>Số tiêu đề: <strong>{headings.length}</strong></div>
          <div>Số ký tự (kèm dấu cách): <strong>{chars}</strong></div>
          <div>Số ký tự (không dấu cách): <strong>{charsNoSpaces}</strong></div>
          <div>Thời gian đọc: <strong>~{readMin} phút</strong></div>
          <div>Thời gian nói / thuyết trình: <strong>~{speakMin} phút</strong></div>
        </div>
      ),
      confirmText: 'Đóng',
      cancelText: null,
    });
  };

  // Drawing Canvas logic
  const handleSaveSignature = () => {
    if (!canvasRef.current || !editor) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    editor.chain().focus().setImage({ src: dataUrl }).run();
    setShowDrawModal(false);
    ui.toast('Đã chèn chữ ký điện tử');
  };

  const handleClearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const pageSizeStyle = useMemo(() => {
    const s = PAGE_SIZES[page.size];
    const isLandscape = page.orientation === 'landscape';
    const w = isLandscape ? s.height : s.width;
    const h = isLandscape ? s.width : s.height;
    return {
      width: `${w}px`,
      minHeight: `${h}px`,
      backgroundColor: paperBg,
      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
      transformOrigin: 'top center',
    };
  }, [page, zoom, paperBg]);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;
  const charCount = editor?.storage.characterCount?.characters() ?? 0;

  return (
    <div className={`editor-shell ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* Focus Mode Floating Bar */}
      {isFocusMode && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: 30,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            color: '#ffffff',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>Chế độ đọc & tập trung</span>
          <div style={{ height: 14, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <button
            className="btn"
            style={{ fontSize: 11, padding: '4px 10px', height: 26, background: '#2563eb', color: '#fff', border: 'none' }}
            onClick={() => setIsFocusMode(false)}
          >
            <Minimize2 size={13} />
            <span>Thoát (Esc)</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      {!isFocusMode && (
        <header className="editor-top">
          <div className="editor-title-group">
            <button className="icon-btn" onClick={onBack} title="Quay lại danh sách tệp">
              <ArrowLeft size={18} />
            </button>
            <div className="file-icon-box doc" style={{ width: 28, height: 28 }} title="Minh Docs">
              <FileText size={16} />
            </div>
            <input
              className="editor-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              title="Nhấp để đổi tên tài liệu"
            />
            <div
              className={`save-pill ${savedStatus}`}
              onClick={handleOpenHistory}
              title="Nhấp để xem lịch sử các phiên bản"
              style={{ cursor: 'pointer' }}
            >
              {savedStatus === 'saved' ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Đã lưu</span>
                </>
              ) : (
                <>
                  <Clock size={13} />
                  <span>Đang lưu…</span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="btn"
              onClick={handleOpenHistory}
              title="Xem lịch sử các phiên bản tài liệu"
            >
              <History size={15} />
              <span>Lịch sử</span>
            </button>

            <button
              className={`btn ${showComments ? 'btn-primary' : ''}`}
              onClick={() => setShowComments(!showComments)}
              title="Hiện/Ẩn bình luận & ghi chú"
            >
              <MessageSquare size={15} />
              <span>
                Bình luận
                {comments.filter((c) => !c.resolved).length > 0 && ` (${comments.filter((c) => !c.resolved).length})`}
              </span>
            </button>

            <button
              className="btn"
              onClick={() => setIsFocusMode(true)}
              title="Chế độ tập trung đọc (Focus mode)"
            >
              <Maximize2 size={15} />
              <span>Tập trung</span>
            </button>

            {/* Voice Typing Button */}
            <button
              className={`btn ${isListening ? 'btn-danger' : ''}`}
              onClick={toggleVoiceDictation}
              title="Nhập liệu bằng giọng nói (Voice Typing)"
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              <span>{isListening ? 'Dừng thu âm' : 'Nhập giọng nói'}</span>
            </button>

            <button
              className={`icon-btn ${showFindReplace ? 'active' : ''}`}
              onClick={() => setShowFindReplace(!showFindReplace)}
              title="Tìm kiếm & Thay thế (Ctrl+F)"
            >
              <Search size={16} />
            </button>
            <button className="btn btn-doc" onClick={handleExportDocx} title="Tải xuống Minh Docs (.docx)">
              <Download size={15} />
              <span>Xuất Minh Docs (.docx)</span>
            </button>
            <button className="btn" onClick={() => window.print()} title="In tài liệu (Ctrl+P)">
              <Printer size={15} />
              <span>In / PDF</span>
            </button>
          </div>
        </header>
      )}

      {!isFocusMode && (
        <div className="ribbon doc">
          <div className="ribbon-tabs-bar">
            <div className="ribbon-tabs-list">
              <button className={`ribbon-tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => setActiveTab('file')}>
                File
              </button>
              <button className={`ribbon-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                Home
              </button>
              <button
                className={`ribbon-tab ${activeTab === 'minh_pdf' ? 'active' : ''}`}
                style={{ color: activeTab === 'minh_pdf' ? '#dc2626' : undefined, borderBottomColor: activeTab === 'minh_pdf' ? '#dc2626' : undefined }}
                onClick={() => setActiveTab('minh_pdf')}
              >
                Minh PDF
              </button>
              <button className={`ribbon-tab ${activeTab === 'insert' ? 'active' : ''}`} onClick={() => setActiveTab('insert')}>
                Insert
              </button>
              <button className={`ribbon-tab ${activeTab === 'draw' ? 'active' : ''}`} onClick={() => setActiveTab('draw')}>
                Draw
              </button>
              <button className={`ribbon-tab ${activeTab === 'design' ? 'active' : ''}`} onClick={() => setActiveTab('design')}>
                Design
              </button>
              <button className={`ribbon-tab ${activeTab === 'layout' ? 'active' : ''}`} onClick={() => setActiveTab('layout')}>
                Layout
              </button>
              <button className={`ribbon-tab ${activeTab === 'references' ? 'active' : ''}`} onClick={() => setActiveTab('references')}>
                References
              </button>
              <button className={`ribbon-tab ${activeTab === 'mailings' ? 'active' : ''}`} onClick={() => setActiveTab('mailings')}>
                Mailings
              </button>
              <button className={`ribbon-tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
                Review
              </button>
              <button className={`ribbon-tab ${activeTab === 'view' ? 'active' : ''}`} onClick={() => setActiveTab('view')}>
                View
              </button>
              <button className={`ribbon-tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>
                Help
              </button>
            </div>

            <div className="ribbon-top-actions">
              <button className="ribbon-pill-btn" onClick={() => setShowComments(!showComments)} title="Bình luận & Ghi chú">
                <MessageSquare size={13} />
                <span>Comments{comments.filter((c) => !c.resolved).length > 0 ? ` (${comments.filter((c) => !c.resolved).length})` : ''}</span>
              </button>

              <select
                className="ribbon-pill-btn"
                value={editMode}
                onChange={(e) => {
                  const mode = e.target.value as 'editing' | 'viewing';
                  setEditMode(mode);
                  if (editor) editor.setEditable(mode === 'editing');
                  ui.toast(mode === 'editing' ? 'Chế độ Chỉnh sửa' : 'Chế độ Chỉ xem');
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                <option value="editing">Editing ▾</option>
                <option value="viewing">Viewing</option>
              </select>

              <button className="ribbon-share-btn" onClick={() => setShowShareModal(true)} title="Chia sẻ tài liệu">
                <Share2 size={13} />
                <span>Share ▾</span>
              </button>
            </div>
          </div>

          <div className="ribbon-body">
            {activeTab === 'home' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text && editor) editor.chain().focus().insertContent(text).run();
                        } catch {
                          ui.toast('Nhấn Ctrl+V để dán nội dung');
                        }
                      }}
                      title="Dán từ bảng nhớ tạm (Ctrl+V)"
                    >
                      <ClipboardPaste size={20} color="#2563eb" />
                      <span>Paste ▾</span>
                    </button>
                    <div className="ribbon-two-rows">
                      <button
                        className="ribbon-btn-small"
                        onClick={() => {
                          document.execCommand('cut');
                          ui.toast('Đã cắt đoạn chọn (Ctrl+X)');
                        }}
                        title="Cắt (Ctrl+X)"
                      >
                        <Scissors size={14} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => {
                          document.execCommand('copy');
                          ui.toast('Đã sao chép (Ctrl+C)');
                        }}
                        title="Sao chép (Ctrl+C)"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${formatPainterActive ? 'active' : ''}`}
                        onClick={handleToggleFormatPainter}
                        title="Sao chép định dạng (Format Painter)"
                      >
                        <Paintbrush size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Clipboard</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <select
                        className="ribbon-select"
                        style={{ width: 106 }}
                        onChange={(e) => {
                          if (e.target.value === 'default') editor?.chain().focus().unsetFontFamily().run();
                          else editor?.chain().focus().setFontFamily(e.target.value).run();
                        }}
                        title="Phông chữ"
                        defaultValue="Times New Roman"
                      >
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="Verdana">Verdana</option>
                      </select>

                      <select
                        className="ribbon-select"
                        style={{ width: 44 }}
                        onChange={(e) => editor?.chain().focus().setFontSize(e.target.value).run()}
                        title="Cỡ chữ"
                        defaultValue="13pt"
                      >
                        <option value="9pt">9</option>
                        <option value="10pt">10</option>
                        <option value="11pt">11</option>
                        <option value="12pt">12</option>
                        <option value="13pt">13</option>
                        <option value="14pt">14</option>
                        <option value="16pt">16</option>
                        <option value="18pt">18</option>
                        <option value="20pt">20</option>
                        <option value="24pt">24</option>
                        <option value="32pt">32</option>
                      </select>

                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().setFontSize('16pt').run()}
                        title="Tăng cỡ chữ (A^)"
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>A<sup style={{ fontSize: 9 }}>▲</sup></span>
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().setFontSize('11pt').run()}
                        title="Giảm cỡ chữ (A_v)"
                      >
                        <span style={{ fontSize: 11, fontWeight: 700 }}>A<sub style={{ fontSize: 8 }}>▼</sub></span>
                      </button>

                      <select
                        className="ribbon-select"
                        style={{ width: 48 }}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleTransformCase(e.target.value as any);
                            e.target.value = '';
                          }
                        }}
                        title="Đổi kiểu chữ HOA / thường (Aa)"
                      >
                        <option value="">Aa ▾</option>
                        <option value="upper">IN HOA</option>
                        <option value="lower">chữ thường</option>
                        <option value="title">Viết Hoa Đầu Từ</option>
                      </select>

                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
                        title="Xoá toàn bộ định dạng"
                      >
                        <Eraser size={14} />
                      </button>
                    </div>

                    <div className="ribbon-row">
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('bold') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        title="Đậm (Ctrl+B)"
                      >
                        <Bold size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('italic') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        title="Nghiêng (Ctrl+I)"
                      >
                        <Italic size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('underline') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleUnderline().run()}
                        title="Gạch chân (Ctrl+U)"
                      >
                        <UnderlineIcon size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('strike') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                        title="Gạch ngang chữ"
                      >
                        <Strikethrough size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('subscript') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleSubscript().run()}
                        title="Chỉ số dưới (x₂)"
                      >
                        <SubIcon size={13} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('superscript') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleSuperscript().run()}
                        title="Chỉ số trên (x²)"
                      >
                        <SuperIcon size={13} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().setHighlight({ color: '#fef08a' }).run()}
                        title="Hiệu ứng chữ (Text Effects)"
                      >
                        <Sparkles size={13} color="#f59e0b" />
                      </button>
                      <label title="Màu dạ quang (Highlight)" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <span style={{ fontSize: 11, background: '#fef08a', padding: '1px 4px', borderRadius: 2, fontWeight: 700, border: '1px solid #eab308' }}>H</span>
                        <input
                          type="color"
                          defaultValue="#fff59d"
                          hidden
                          onChange={(e) => editor?.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                        />
                      </label>
                      <label title="Màu chữ (Font Color)" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, borderBottom: '3px solid #ef4444', padding: '0 2px' }}>A</span>
                        <input
                          type="color"
                          defaultValue="#000000"
                          hidden
                          onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Font</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('bulletList') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        title="Danh sách dấu đầu dòng"
                      >
                        <List size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('orderedList') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        title="Danh sách số"
                      >
                        <ListOrdered size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive('taskList') ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().toggleTaskList().run()}
                        title="Danh sách việc cần làm (Multilevel task list)"
                      >
                        <ListTodo size={14} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().decreaseIndent().run()}
                        title="Giảm thụt lề"
                      >
                        <Outdent size={14} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().increaseIndent().run()}
                        title="Tăng thụt lề"
                      >
                        <Indent size={14} />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={handleSortParagraphs}
                        title={`Sắp xếp đoạn văn (${sortAscending ? 'A → Z' : 'Z → A'})`}
                      >
                        <ArrowUpDown size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${showParagraphMarks ? 'active' : ''}`}
                        onClick={() => setShowParagraphMarks(!showParagraphMarks)}
                        title="Hiện/Ẩn ký hiệu đoạn văn (¶)"
                      >
                        <Pilcrow size={14} />
                      </button>
                    </div>

                    <div className="ribbon-row">
                      <button
                        className={`ribbon-btn-small ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                        title="Căn trái"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                        title="Căn giữa"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                        title="Căn phải"
                      >
                        <AlignRight size={14} />
                      </button>
                      <button
                        className={`ribbon-btn-small ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
                        onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                        title="Căn đều"
                      >
                        <AlignJustify size={14} />
                      </button>

                      <select
                        className="ribbon-select"
                        style={{ width: 52 }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (Number.isFinite(val)) editor?.chain().focus().setLineHeight(val).run();
                        }}
                        title="Giãn dòng (Line Spacing)"
                        defaultValue="1.15"
                      >
                        <option value="1.0">1.0</option>
                        <option value="1.15">1.15</option>
                        <option value="1.5">1.5</option>
                        <option value="2.0">2.0</option>
                      </select>

                      <button
                        className="ribbon-btn-small"
                        onClick={() => editor?.chain().focus().toggleHighlight({ color: '#e0f2fe' }).run()}
                        title="Đổ màu nền đoạn (Shading)"
                      >
                        <PaintBucket size={14} color="#0284c7" />
                      </button>
                      <button
                        className="ribbon-btn-small"
                        onClick={handleInsertTable}
                        title="Viền bảng & khung (Borders)"
                      >
                        <Grid size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Paragraph</div>
                </div>

                <div className="ribbon-section">
                  <div className="styles-gallery-container">
                    <button
                      className={`styles-card ${editor?.isActive('paragraph') && !editor?.isActive('heading') ? 'active' : ''}`}
                      onClick={() => editor?.chain().focus().setParagraph().run()}
                      title="Áp dụng kiểu Normal"
                    >
                      <span className="styles-card-sample">Normal</span>
                      <span className="styles-card-title">Normal</span>
                    </button>

                    <button
                      className={`styles-card ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      title="Áp dụng kiểu Heading 1"
                    >
                      <span className="styles-card-sample" style={{ fontWeight: 800, color: '#185abd' }}>
                        H1
                      </span>
                      <span className="styles-card-title">Heading 1</span>
                    </button>

                    <button
                      className={`styles-card ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      title="Áp dụng kiểu Heading 2"
                    >
                      <span className="styles-card-sample" style={{ fontWeight: 700, color: '#2563eb' }}>
                        H2
                      </span>
                      <span className="styles-card-title">Heading 2</span>
                    </button>

                    <button
                      className={`styles-card ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                      title="Áp dụng kiểu Heading 3"
                    >
                      <span className="styles-card-sample" style={{ fontWeight: 700, color: '#334155' }}>
                        H3
                      </span>
                      <span className="styles-card-title">Heading 3</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Styles</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-two-rows">
                    <button
                      className="ribbon-btn-compact"
                      style={{ height: 25 }}
                      onClick={() => setShowFindReplace(true)}
                      title="Tìm kiếm & Thay thế (Ctrl+F)"
                    >
                      <Search size={13} color="#2563eb" />
                      <span>Tìm & Thay</span>
                    </button>
                    <button
                      className="ribbon-btn-compact"
                      style={{ height: 25 }}
                      onClick={() => editor?.chain().focus().selectAll().run()}
                      title="Chọn tất cả (Ctrl+A)"
                    >
                      <Pencil size={13} color="#4b5563" />
                      <span>Chọn tất cả</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Editing</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowTemplatesModal(true)}
                      title="Thư viện mẫu tài liệu chuyên nghiệp"
                    >
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', opacity: 0.8 }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', opacity: 0.8, marginLeft: -4 }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', opacity: 0.8, marginLeft: -4 }} />
                      </div>
                      <span>Templates</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Library</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => void handleExportImage()}
                      title="Xuất văn bản thành ảnh PNG chất lượng cao"
                    >
                      <FileImage size={18} color="#059669" />
                      <span>Export<br/>Image</span>
                    </button>
                    <div className="ribbon-two-rows">
                      <button
                        className="ribbon-btn-compact"
                        style={{ height: 25 }}
                        onClick={() => setShowSplitModal(true)}
                        title="Chia nhỏ / tách tài liệu"
                      >
                        <Split size={13} color="#d97706" />
                        <span>Tách bài</span>
                      </button>
                      <button
                        className="ribbon-btn-compact"
                        style={{ height: 25 }}
                        onClick={() => void handleOpenMergeModal()}
                        title="Ghép nối tài liệu"
                      >
                        <Combine size={13} color="#0284c7" />
                        <span>Ghép bài</span>
                      </button>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Output</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setPdfExportMode('standard')}
                      title="Kết xuất tệp PDF nhị phân chuẩn A4"
                    >
                      <FileDown size={19} color="#dc2626" />
                      <span>Create<br/>PDF</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowDrawModal(true)}
                      title="Ký tên số hoặc vẽ tay trên tài liệu"
                    >
                      <PenTool size={19} color="#4338ca" />
                      <span>Sign</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh PDF</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className={`ribbon-btn-large ${isListening ? 'active' : ''}`}
                      onClick={toggleVoiceDictation}
                      title="Gõ văn bản bằng giọng nói tiếng Việt"
                    >
                      {isListening ? <MicOff size={19} color="#dc2626" /> : <Mic size={19} color="#2563eb" />}
                      <span>Dictate ▾</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Voice</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowEditorCheckModal(true)}
                      title="Kiểm tra ngữ pháp, lỗi chính tả & văn phong"
                    >
                      <CheckCheck size={19} color="#059669" />
                      <span>Editor</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Editor</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowAiModal(true)}
                      title="Minh AI: Trợ lý văn bản toàn năng"
                    >
                      <div style={{ position: 'relative' }}>
                        <Sparkles size={19} color="#7c3aed" />
                      </div>
                      <span style={{ fontWeight: 600, color: '#6d28d9' }}>Minh AI</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh AI</div>
                </div>
              </>
            )}

            {activeTab === 'minh_pdf' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setPdfExportMode('standard')}
                      title="Kết xuất tệp PDF nhị phân chuẩn từ tài liệu"
                    >
                      <FileDown size={20} color="#dc2626" />
                      <span>Create<br/>PDF</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={handleGenerateSlides}
                      title="Trình chiếu tài liệu toàn màn hình"
                    >
                      <Presentation size={20} color="#dc2626" />
                      <span>Create<br/>and play</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowShareModal(true)}
                      title="Chia sẻ tài liệu PDF nhanh"
                    >
                      <Share2 size={20} color="#dc2626" />
                      <span>Create<br/>and share</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Create PDF</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowDrawModal(true)}
                      title="Ký tên số & đóng dấu trên tài liệu"
                    >
                      <PenTool size={20} color="#dc2626" />
                      <span>Sign</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowSplitModal(true)}
                      title="Tách đoạn / chương mục tài liệu"
                    >
                      <Split size={20} color="#475569" />
                      <span>PDF<br/>Split</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => void handleOpenMergeModal()}
                      title="Ghép nối tài liệu"
                    >
                      <Layers size={20} color="#475569" />
                      <span>PDF<br/>Merge</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={handlePageSettings}
                      title="Thiết lập lề & kích thước trang in PDF"
                    >
                      <Crop size={20} color="#2563eb" />
                      <span>Crop<br/>Pages</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setPdfExportMode('compressed')}
                      title="Nén giảm dung lượng tệp PDF"
                    >
                      <Minimize2 size={20} color="#059669" />
                      <span>PDF<br/>Compressor</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        editor?.chain().focus().unsetAllMarks().clearNodes().run();
                        ui.toast('Đã tẩy sạch định dạng trên vùng văn bản đã chọn');
                      }}
                      title="Tẩy sạch định dạng hoặc nội dung thừa"
                    >
                      <Eraser size={20} color="#64748b" />
                      <span>Wipe<br/>Off</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setShowDrawModal(true)}
                      title="Vẽ hình khối và đường kẻ trực tiếp"
                    >
                      <PenTool size={20} color="#6366f1" />
                      <span>Draw<br/>Shapes</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh PDF Tools</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={handleExportDocx}
                      title="Tải xuống tệp Minh Docs (.docx)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileText size={16} color="#dc2626" />
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#185abd' }}>W</span>
                      </div>
                      <span>PDF to<br/>Word</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => void handleExtractTablesToExcel(true)}
                      title="Trích xuất bảng dữ liệu trong tài liệu sang Minh Sheets (.xlsx)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileSpreadsheet size={16} color="#dc2626" />
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#107c41' }}>X</span>
                      </div>
                      <span>PDF to<br/>Excel</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={handleGenerateSlides}
                      title="Chuyển đổi tài liệu thành slide trình chiếu"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Presentation size={16} color="#dc2626" />
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#ea580c' }}>P</span>
                      </div>
                      <span>PDF<br/>to PPT</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => setPdfExportMode('imageOnly')}
                      title="Kết xuất thành tệp PDF dạng ảnh phẳng chống sao chép"
                    >
                      <ImageIcon size={20} color="#475569" />
                      <span>To Image-<br/>only PDF</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => void handleExportImage()}
                      title="Xuất trang văn bản thành hình ảnh PNG sắc nét"
                    >
                      <FileImage size={20} color="#059669" />
                      <span>PDF to<br/>Picture</span>
                    </button>
                    <button
                      className="ribbon-btn-large"
                      onClick={() => {
                        setOcrExtractedText(editor?.getText() || '');
                        setShowOcrImportModal(true);
                      }}
                      title="Trích xuất văn bản OCR từ tệp PDF hoặc văn bản scan"
                    >
                      <Search size={20} color="#7c3aed" />
                      <span>OCR<br/>PDF</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh PDF Convert</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls" style={{ padding: '0 6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={keepPdfAttributes}
                        onChange={(e) => setKeepPdfAttributes(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Keep Document<br/>Attributes</span>
                    </label>
                  </div>
                  <div className="ribbon-group-label">Settings</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button
                      className="ribbon-btn-large"
                      onClick={handlePageSettings}
                      title="Thiết lập khổ giấy, hướng trang, đầu trang & chân trang"
                    >
                      <Settings size={20} color="#64748b" />
                      <span>More<br/>▾</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Other</div>
                </div>
              </>
            )}

            {activeTab === 'insert' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => editor?.chain().focus().insertPageBreak().run()} title="Chèn ngắt trang">
                      <Layout size={20} color="#2563eb" />
                      <span>Ngắt trang</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleInsertTOC} title="Chèn bảng mục lục tự động">
                      <Bookmark size={20} color="#d97706" />
                      <span>Mục lục</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Trang & Mục lục</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleInsertTable} title="Chèn bảng">
                      <TableIcon size={20} color="#0284c7" />
                      <span>Bảng</span>
                    </button>
                    {editor?.isActive('table') && (
                      <div className="ribbon-two-rows">
                        <button className="btn" style={{ fontSize: 11, padding: '2px 6px', height: 22 }} onClick={() => editor.chain().focus().addRowAfter().run()}>
                          + Dòng
                        </button>
                        <button className="btn" style={{ fontSize: 11, padding: '2px 6px', height: 22 }} onClick={() => editor.chain().focus().addColumnAfter().run()}>
                          + Cột
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="ribbon-group-label">Bảng biểu</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleInsertImage} title="Chèn hình ảnh">
                      <ImageIcon size={20} color="#059669" />
                      <span>Hình ảnh</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowDrawModal(true)} title="Chèn chữ ký điện tử / vẽ tay">
                      <PenTool size={20} color="#4338ca" />
                      <span>Chữ ký</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowSymbols(!showSymbols)} title="Ký hiệu đặc biệt">
                      <Type size={20} color="#d97706" />
                      <span>Ký hiệu (Ω)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleInsertLink} title="Chèn liên kết">
                      <Link2 size={20} color="#2563eb" />
                      <span>Liên kết</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Minh hoạ & Liên kết</div>
                </div>
              </>
            )}

            {activeTab === 'draw' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setShowDrawModal(true)} title="Bảng vẽ tay và ký tên">
                      <PenTool size={22} color="#2563eb" />
                      <span>Bút vẽ tay</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowDrawModal(true)} title="Chữ ký điện tử">
                      <CheckCheck size={22} color="#059669" />
                      <span>Chữ ký số</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Công cụ vẽ</div>
                </div>
              </>
            )}

            {activeTab === 'design' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} color="#64748b" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>Hình mờ:</span>
                        <select
                          className="ribbon-select"
                          value={watermark}
                          onChange={(e) => {
                            setWatermark(e.target.value);
                            setSavedStatus('saving');
                          }}
                        >
                          <option value="">Không có</option>
                          <option value="BẢN THẢO">BẢN THẢO</option>
                          <option value="TUYỆT MẬT">TUYỆT MẬT</option>
                          <option value="LƯU HÀNH NỘI BỘ">LƯU HÀNH NỘI BỘ</option>
                          <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Palette size={14} color="#64748b" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>Màu trang:</span>
                        <select
                          className="ribbon-select"
                          value={paperBg}
                          onChange={(e) => {
                            setPaperBg(e.target.value);
                            setSavedStatus('saving');
                          }}
                        >
                          <option value="#ffffff">Trắng tinh</option>
                          <option value="#faf8f5">Vàng kem (Ivory)</option>
                          <option value="#f3f4f6">Ghi nhạt</option>
                          <option value="#202530">Chế độ tối (Dark)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Nền trang & Bản quyền</div>
                </div>
              </>
            )}

            {activeTab === 'layout' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handlePageSettings} title="Thiết lập trang chi tiết">
                      <Settings size={20} color="#2563eb" />
                      <span>Căn lề…</span>
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Khổ giấy:</span>
                        <select
                          className="ribbon-select"
                          value={page.size}
                          onChange={(e) => {
                            setPage((p) => ({ ...p, size: e.target.value as any }));
                            setSavedStatus('saving');
                          }}
                        >
                          <option value="A4">A4 (21 × 29.7 cm)</option>
                          <option value="A5">A5 (14.8 × 21 cm)</option>
                          <option value="Letter">Letter (8.5 × 11 in)</option>
                          <option value="Legal">Legal (8.5 × 14 in)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Hướng giấy:</span>
                        <select
                          className="ribbon-select"
                          value={page.orientation}
                          onChange={(e) => {
                            setPage((p) => ({ ...p, orientation: e.target.value as any }));
                            setSavedStatus('saving');
                          }}
                        >
                          <option value="portrait">Dọc (Portrait)</option>
                          <option value="landscape">Ngang (Landscape)</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
                      <Columns size={16} color="#64748b" />
                      <span style={{ fontSize: 11, color: '#64748b' }}>Chia cột:</span>
                      <select
                        className="ribbon-select"
                        value={columnCount}
                        onChange={(e) => {
                          setColumnCount(Number(e.target.value));
                          setSavedStatus('saving');
                        }}
                      >
                        <option value={1}>1 cột</option>
                        <option value={2}>2 cột báo chí</option>
                        <option value={3}>3 cột</option>
                      </select>
                    </div>
                  </div>
                  <div className="ribbon-group-label">Page Setup</div>
                </div>
              </>
            )}

            {activeTab === 'references' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleInsertTOC} title="Chèn mục lục tự động">
                      <Bookmark size={22} color="#2563eb" />
                      <span>Mục lục tự động</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleInsertFootnote()} title="Chèn chú thích cuối trang">
                      <FileText size={22} color="#059669" />
                      <span>Footnote ({footnotes.length})</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Mục lục & Tham chiếu</div>
                </div>
              </>
            )}

            {activeTab === 'mailings' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setShowMailMergeModal(true)} title="Mở bảng danh sách người nhận & xuất thư trộn">
                      <Mail size={20} color="#2563eb" />
                      <span>Trộn thư<br/>({mailRecipients.length})</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Mail Merge</div>
                </div>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    {['Ho_ten', 'Chuc_vu', 'Phong_ban', 'Email', 'Ngay'].map((fieldKey) => (
                      <button
                        key={fieldKey}
                        className="ribbon-btn-compact"
                        onClick={() => {
                          editor?.chain().focus().insertContent(`{{${fieldKey}}}`).run();
                          ui.toast(`Đã chèn trường {{${fieldKey}}} vào vị trí con trỏ`);
                        }}
                      >
                        <Plus size={12} color="#2563eb" />
                        <span>{`{{${fieldKey}}}`}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ribbon-group-label">Chèn trường dữ liệu động</div>
                </div>
              </>
            )}

            {activeTab === 'review' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setShowComments(!showComments)} title="Bình luận & phản hồi">
                      <MessageSquare size={20} color="#2563eb" />
                      <span>Bình luận ({comments.filter((c) => !c.resolved).length})</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleShowDetailedStats} title="Thống kê từ ngữ chi tiết">
                      <BarChart2 size={20} color="#059669" />
                      <span>Thống kê từ</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowEditorCheckModal(true)} title="Kiểm tra văn phong">
                      <CheckCheck size={20} color="#d97706" />
                      <span>Kiểm tra lỗi</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Đóng góp & Kiểm duyệt</div>
                </div>
              </>
            )}

            {activeTab === 'view' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={() => setIsFocusMode(true)} title="Chế độ tập trung đọc toàn màn hình (Esc)">
                      <Maximize2 size={20} color="#2563eb" />
                      <span>Tập trung</span>
                    </button>
                    <button className={`ribbon-btn-large ${showOutline ? 'active' : ''}`} onClick={() => setShowOutline(!showOutline)} title="Bật/Tắt khung mục lục">
                      <Eye size={20} color="#0284c7" />
                      <span>Mục lục</span>
                    </button>
                    <button className={`ribbon-btn-large ${showRuler ? 'active' : ''}`} onClick={() => setShowRuler(!showRuler)} title="Bật/Tắt thước kẻ căn lề">
                      <Layout size={20} color="#059669" />
                      <span>Thước kẻ</span>
                    </button>
                    <button className={`ribbon-btn-large ${showParagraphMarks ? 'active' : ''}`} onClick={() => setShowParagraphMarks(!showParagraphMarks)} title="Hiện/Ẩn ký hiệu đoạn văn (¶)">
                      <Pilcrow size={20} color="#6366f1" />
                      <span>Ký hiệu ¶</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Chế độ xem</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <select className="ribbon-select" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                      <option value={75}>75%</option>
                      <option value={90}>90%</option>
                      <option value={100}>100%</option>
                      <option value={125}>125%</option>
                      <option value={150}>150%</option>
                    </select>
                  </div>
                  <div className="ribbon-group-label">Thu phóng</div>
                </div>
              </>
            )}

            {activeTab === 'help' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleShowDetailedStats}>
                      <BarChart2 size={20} color="#2563eb" />
                      <span>Thống kê</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setShowShortcutsModal(true)}>
                      <Keyboard size={20} color="#059669" />
                      <span>Phím tắt</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Trợ giúp</div>
                </div>
              </>
            )}

            {activeTab === 'file' && (
              <>
                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleSaveImmediate} title="Lưu ngay tài liệu (Ctrl+S)">
                      <Save size={20} color="#2563eb" />
                      <span>Lưu ngay</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleOpenHistory} title="Xem lịch sử các phiên bản">
                      <History size={20} color="#0891b2" />
                      <span>Lịch sử</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => handleCreateSnapshot()} title="Lưu bản chụp hiện tại">
                      <Bookmark size={20} color="#059669" />
                      <span>Lưu Snapshot</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Lưu & Phiên bản</div>
                </div>

                <div className="ribbon-section">
                  <div className="ribbon-controls">
                    <button className="ribbon-btn-large" onClick={handleExportDocx} title="Tải xuống Minh Docs (.docx)">
                      <Download size={20} color="#185abd" />
                      <span>Minh Docs (.docx)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => setPdfExportMode('standard')} title="Kết xuất tệp Minh PDF (.pdf)">
                      <FileDown size={20} color="#dc2626" />
                      <span>Minh PDF (.pdf)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => void handleExtractTablesToExcel(false)} title="Trích xuất bảng sang Minh Sheets (.xlsx)">
                      <FileSpreadsheet size={20} color="#107c41" />
                      <span>Bảng (.xlsx)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleExportMarkdown} title="Tải xuống Markdown (.md)">
                      <Download size={20} color="#374151" />
                      <span>Markdown (.md)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleExportHtml} title="Tải xuống trang Web (.html)">
                      <Download size={20} color="#d97706" />
                      <span>Web (.html)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={handleExportTxt} title="Tải xuống văn bản thuần (.txt)">
                      <Download size={20} color="#4b5563" />
                      <span>Text (.txt)</span>
                    </button>
                    <button className="ribbon-btn-large" onClick={() => window.print()} title="In tài liệu (Ctrl+P)">
                      <Printer size={20} color="#64748b" />
                      <span>In trang</span>
                    </button>
                  </div>
                  <div className="ribbon-group-label">Xuất & In ấn</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Symbols Palette Dropdown */}
      {showSymbols && (
        <div
          style={{
            position: 'absolute',
            top: 110,
            left: 280,
            background: '#ffffff',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            padding: 12,
            zIndex: 60,
            width: 290,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>Chèn ký hiệu đặc biệt</span>
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setShowSymbols(false)}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {COMMON_SYMBOLS.map((sym) => (
              <button
                key={sym}
                className="btn"
                style={{ padding: 4, height: 30, fontSize: 14, minHeight: 0 }}
                onClick={() => {
                  editor?.chain().focus().insertContent(sym).run();
                  ui.toast(`Đã chèn ký hiệu ${sym}`);
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Signature / Drawing Pad Modal */}
      {showDrawModal && (
        <div className="dialog-backdrop" onClick={() => setShowDrawModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16 }}>Ký tên hoặc vẽ tay</h2>
              <button className="icon-btn" onClick={() => setShowDrawModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ border: '2px dashed #ccd3e0', borderRadius: 8, background: '#fafbfc', overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                width={390}
                height={160}
                style={{ cursor: 'crosshair', display: 'block' }}
                onMouseDown={(e) => {
                  isDrawingRef.current = true;
                  const ctx = canvasRef.current?.getContext('2d');
                  if (ctx) {
                    const rect = canvasRef.current!.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                    ctx.strokeStyle = '#1a365d';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                  }
                }}
                onMouseMove={(e) => {
                  if (!isDrawingRef.current) return;
                  const ctx = canvasRef.current?.getContext('2d');
                  if (ctx) {
                    const rect = canvasRef.current!.getBoundingClientRect();
                    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                    ctx.stroke();
                  }
                }}
                onMouseUp={() => { isDrawingRef.current = false; }}
                onMouseLeave={() => { isDrawingRef.current = false; }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <button className="btn" onClick={handleClearSignature}>
                Xoá vẽ lại
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setShowDrawModal(false)}>
                  Huỷ
                </button>
                <button className="btn btn-doc" onClick={handleSaveSignature}>
                  Chèn chữ ký vào bài
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Find & Replace Floating Bar */}
      {showFindReplace && (
        <div
          style={{
            position: 'absolute',
            top: 110,
            right: 32,
            background: '#ffffff',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-lg)',
            padding: 12,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: 320,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>Tìm kiếm & Thay thế</span>
            <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setShowFindReplace(false)}>
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="text-field"
              style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
              placeholder="Tìm từ…"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFindNext()}
              autoFocus
            />
            <button className="btn" style={{ height: 28, padding: '0 8px' }} onClick={handleFindNext} title="Tìm tiếp">
              <ChevronDown size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="text-field"
              style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
              placeholder="Thay thế bằng…"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
            <button className="btn" style={{ height: 28, padding: '0 8px' }} onClick={handleReplaceCurrent} title="Thay thế từ hiện tại">
              <Replace size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
              <span>Phân biệt hoa/thường</span>
            </label>
            <button className="btn btn-doc" style={{ fontSize: 11, height: 26, padding: '0 10px' }} onClick={handleReplaceAll}>
              Thay thế tất cả
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Canvas */}
      <div className="doc-workspace">
        <div className="doc-canvas" style={{ flexDirection: 'column', alignItems: 'center' }}>
          {/* Top Ruler */}
          {showRuler && (
            <div
              style={{
                width: pageSizeStyle.width,
                height: 18,
                background: '#ffffff',
                border: '1px solid #d4dae5',
                borderBottom: 'none',
                display: 'flex',
                alignItems: 'flex-end',
                fontSize: 9,
                color: '#8c95a6',
                userSelect: 'none',
                padding: '0 12px 2px',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transform: pageSizeStyle.transform,
                transformOrigin: pageSizeStyle.transformOrigin,
              }}
            >
              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((cm) => (
                <div key={cm} style={{ borderLeft: '1px solid #b0bac9', height: cm % 5 === 0 ? 8 : 5, paddingLeft: 2 }}>
                  {cm > 0 && cm}
                </div>
              ))}
            </div>
          )}

          <div className={`doc-paper ${showParagraphMarks ? 'doc-show-pilcrow' : ''}`} style={pageSizeStyle}>
            {watermark && (
              <div
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-45deg)',
                  fontSize: 72,
                  fontWeight: 900,
                  letterSpacing: 8,
                  color: 'rgba(0, 0, 0, 0.05)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 1,
                }}
              >
                {watermark}
              </div>
            )}

            {page.header && <div className="header-region">{page.header}</div>}

            <div style={{ columns: columnCount, columnGap: 28, columnRule: columnCount > 1 ? '1px solid #e1e5ee' : undefined }}>
              <EditorContent editor={editor} />
            </div>

            {footnotes.length > 0 && (
              <div className="doc-footnotes-region">
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Chú thích cuối trang ({footnotes.length})
                </div>
                {footnotes.map((fn) => (
                  <div key={fn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: '#334155', marginBottom: 4 }}>
                    <div>
                      <strong>[{fn.index}]</strong> {fn.text}
                    </div>
                    <button
                      className="icon-btn"
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                      onClick={() => handleRemoveFootnote(fn.id)}
                      title="Xoá chú thích này"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(page.footer || page.pageNumbers) && (
              <div className="footer-region">
                <span>{page.footer}</span>
                {page.pageNumbers && <span>Trang 1</span>}
              </div>
            )}
          </div>
        </div>

        {showOutline && (
          <aside className="doc-outline">
            <div className="outline-title">Mục lục văn bản</div>
            {headings.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>
                Chưa có tiêu đề nào. Sử dụng Tiêu đề 1, 2, 3 để tạo mục lục tự động.
              </div>
            ) : (
              headings.map((h, i) => (
                <button
                  key={i}
                  className={`outline-item h${h.level}`}
                  onClick={() => {
                    const domHeadings = document.querySelectorAll('.doc-paper .ProseMirror h1, .doc-paper .ProseMirror h2, .doc-paper .ProseMirror h3');
                    domHeadings[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    editor?.chain().focus(h.pos + 1).run();
                  }}
                >
                  {h.text}
                </button>
              ))
            )}

            <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Thống kê</div>
              <div>Số từ: <strong>{wordCount}</strong></div>
              <div>Số ký tự: <strong>{charCount}</strong></div>
              <div>Thời gian đọc: <strong>~{Math.max(1, Math.ceil(wordCount / 200))} phút</strong></div>
              <button
                className="btn"
                style={{ fontSize: 11, padding: '4px 8px', marginTop: 10, width: '100%' }}
                onClick={handleShowDetailedStats}
              >
                Xem chi tiết…
              </button>
            </div>
          </aside>
        )}
        {/* Comments Drawer */}
        {showComments && (
          <aside className="doc-comments">
            <div className="comments-header">
              <h3>
                <MessageSquare size={16} />
                <span>Bình luận & Ghi chú ({comments.length})</span>
              </h3>
              <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setShowComments(false)}>
                <X size={15} />
              </button>
            </div>

            <div className="comments-tabs">
              <button
                className={`comments-tab ${activeCommentTab === 'open' ? 'active' : ''}`}
                onClick={() => setActiveCommentTab('open')}
              >
                Đang mở ({comments.filter((c) => !c.resolved).length})
              </button>
              <button
                className={`comments-tab ${activeCommentTab === 'resolved' ? 'active' : ''}`}
                onClick={() => setActiveCommentTab('resolved')}
              >
                Đã giải quyết ({comments.filter((c) => c.resolved).length})
              </button>
            </div>

            {/* New Comment Input Box */}
            <div className="comment-new-box">
              {commentQuote && (
                <div className="comment-quote" style={{ marginBottom: 6 }} title="Đoạn văn bản được trích dẫn">
                  "{commentQuote}"
                </div>
              )}
              <textarea
                className="text-field"
                placeholder={commentQuote ? 'Viết bình luận cho đoạn đã chọn…' : 'Viết bình luận hoặc ghi chú mới…'}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'none', fontSize: 12, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                {commentQuote && (
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => setCommentQuote('')}
                  >
                    Bỏ trích
                  </button>
                )}
                <button
                  className="btn btn-doc"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={handleAddComment}
                  disabled={!newCommentText.trim()}
                >
                  <Send size={12} />
                  <span>Gửi</span>
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="comments-list">
              {comments.filter((c) => (activeCommentTab === 'open' ? !c.resolved : c.resolved)).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '24px 8px' }}>
                  {activeCommentTab === 'open' ? 'Chưa có bình luận nào đang mở.' : 'Chưa có bình luận nào đã giải quyết.'}
                </div>
              ) : (
                comments
                  .filter((c) => (activeCommentTab === 'open' ? !c.resolved : c.resolved))
                  .map((c) => (
                    <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
                      <div className="comment-card-top">
                        <div className="comment-author-badge">
                          <div className="comment-avatar">{c.author.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{c.author}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                              {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                              · {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                        <button
                          className="icon-btn"
                          style={{ width: 20, height: 20 }}
                          onClick={() => handleDeleteComment(c.id)}
                          title="Xoá bình luận"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {c.quote && (
                        <div className="comment-quote" title={c.quote}>
                          "{c.quote}"
                        </div>
                      )}

                      <div className="comment-text">{c.text}</div>

                      {/* Replies List */}
                      {c.replies && c.replies.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
                          {c.replies.map((r) => (
                            <div key={r.id} style={{ fontSize: 11 }}>
                              <strong style={{ color: '#2563eb' }}>{r.author}: </strong>
                              <span>{r.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Input */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <input
                          className="text-field"
                          placeholder="Trả lời…"
                          value={replyTexts[c.id] || ''}
                          onChange={(e) => setReplyTexts({ ...replyTexts, [c.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddReply(c.id)}
                          style={{ fontSize: 11, padding: '3px 6px', height: 24, flex: 1 }}
                        />
                        <button
                          className="btn"
                          style={{ fontSize: 10, padding: '0 6px', height: 24 }}
                          onClick={() => handleAddReply(c.id)}
                          disabled={!replyTexts[c.id]?.trim()}
                        >
                          <Reply size={11} />
                        </button>
                      </div>

                      <div className="comment-actions">
                        <button
                          className="btn"
                          style={{ fontSize: 10, padding: '2px 8px', height: 22 }}
                          onClick={() => handleResolveComment(c.id)}
                        >
                          <Check size={11} />
                          <span>{c.resolved ? 'Mở lại' : 'Đã giải quyết'}</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="dialog-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Lịch sử phiên bản (Version History)</h2>
                <div className="dialog-subtitle">Xem các bản lưu tự động và khôi phục về trạng thái trước đó</div>
              </div>
              <button className="icon-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Create Named Version Snapshot */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
              <input
                className="text-field"
                placeholder="Đặt tên cho phiên bản hiện tại (vd: Bản duyệt ngày 06/11)…"
                value={customVersionName}
                onChange={(e) => setCustomVersionName(e.target.value)}
                style={{ flex: 1, fontSize: 12 }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <button className="btn btn-doc" onClick={() => handleCreateSnapshot()}>
                <Bookmark size={14} />
                <span>Lưu bản chụp</span>
              </button>
            </div>

            <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
              {versions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
                  Chưa có phiên bản nào được lưu trong lịch sử. Bấm "Lưu bản chụp" ở trên để tạo snapshot đầu tiên!
                </div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {new Date(v.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                        - {new Date(v.timestamp).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-doc"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => handleRestoreVersion(v)}
                        title="Khôi phục tài liệu về phiên bản này"
                      >
                        Khôi phục
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 26, height: 26 }}
                        onClick={() => handleDeleteVersion(v.id)}
                        title="Xoá bản lưu này"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn" onClick={() => setShowHistoryModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parallel Translate Modal */}
      {showTranslateModal && (
        <div className="dialog-backdrop" onClick={() => setShowTranslateModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Languages size={20} color="#2563eb" />
                <h2 style={{ fontSize: 16 }}>Dịch song ngữ thông minh (Parallel Translate)</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowTranslateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ngôn ngữ đích:</span>
              <select
                className="ribbon-select"
                value={translateTargetLang}
                onChange={(e) => {
                  setTranslateTargetLang(e.target.value);
                  handleOpenTranslate();
                }}
              >
                <option value="en">Tiếng Anh (English)</option>
                <option value="ja">Tiếng Nhật (日本語)</option>
                <option value="zh">Tiếng Trung (中文)</option>
                <option value="fr">Tiếng Pháp (Français)</option>
                <option value="de">Tiếng Đức (Deutsch)</option>
              </select>
            </div>

            <textarea
              className="text-field"
              rows={8}
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              style={{ width: '100%', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowTranslateModal(false)}>
                Huỷ
              </button>
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(translatedText);
                  ui.toast('Đã sao chép bản dịch vào clipboard');
                }}
              >
                Sao chép
              </button>
              <button className="btn btn-doc" onClick={handleApplyTranslation}>
                Chèn vào văn bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Slides Modal */}
      {showSlidesModal && (
        <div className="dialog-backdrop" onClick={() => setShowSlidesModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Presentation size={20} color="#7c3aed" />
                <h2 style={{ fontSize: 16 }}>Dàn ý trình chiếu tự động (Generate Slides from Doc)</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowSlidesModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: '55vh', overflowY: 'auto', marginBottom: 16 }}>
              {slideDeck.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                    Slide {idx + 1}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{s.title}</h3>
                  <ul style={{ paddingLeft: 18, fontSize: 12, color: '#334155', margin: 0 }}>
                    {s.bullets.map((b, bIdx) => (
                      <li key={bIdx} style={{ marginBottom: 4 }}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowSlidesModal(false)}>
                Đóng
              </button>
              <button
                className="btn"
                onClick={() => {
                  const text = slideDeck
                    .map((s, i) => `SLIDE ${i + 1}: ${s.title}\n` + s.bullets.map((b) => `- ${b}`).join('\n'))
                    .join('\n\n');
                  navigator.clipboard.writeText(text);
                  ui.toast('Đã sao chép toàn bộ dàn ý slide!');
                }}
              >
                Sao chép dàn ý
              </button>
              <button className="btn btn-doc" onClick={handleExportSlideDeckHtml}>
                <Download size={14} />
                <span>Tải Slide HTML 16:9</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="dialog-backdrop" onClick={() => setShowAiModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: 7, borderRadius: 8, display: 'flex' }}>
                  <Sparkles size={20} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, margin: 0 }}>Minh AI — Trợ lý Văn bản Toàn năng</h2>
                  <div className="dialog-subtitle" style={{ marginTop: 2 }}>Soạn thảo, dịch thuật, tạo slide và kiểm chuẩn văn phong</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowAiModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => handleRunAiSmart('formal')}>
                Viết trang trọng hơn
              </button>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => handleRunAiSmart('summary')}>
                Tóm tắt ý chính
              </button>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => handleRunAiSmart('expand')}>
                Mở rộng luận điểm
              </button>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => handleRunAiSmart('proofread')}>
                Báo cáo hành văn
              </button>
              <button
                className="btn"
                style={{ fontSize: 11.5 }}
                onClick={() => {
                  setShowAiModal(false);
                  handleOpenTranslate();
                }}
              >
                Dịch song ngữ
              </button>
              <button
                className="btn"
                style={{ fontSize: 11.5 }}
                onClick={() => {
                  setShowAiModal(false);
                  handleGenerateSlides();
                }}
              >
                Tạo slide từ văn bản
              </button>
            </div>

            <textarea
              className="text-field"
              rows={6}
              value={aiResult || (isAiLoading ? 'Đang phân tích văn bản và tạo nội dung thông minh với Minh AI…' : 'Bấm chọn một hành động AI phía trên hoặc nhập nội dung cần chèn…')}
              onChange={(e) => setAiResult(e.target.value)}
              style={{ width: '100%', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowAiModal(false)}>
                Đóng
              </button>
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(aiResult);
                  ui.toast('Đã sao chép phản hồi của Minh AI!');
                }}
                disabled={!aiResult || isAiLoading}
              >
                Sao chép
              </button>
              <button className="btn btn-doc" onClick={handleApplyAiResult} disabled={!aiResult || isAiLoading}>
                Chèn kết quả vào bài
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="dialog-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={18} color="#2563eb" />
                <h2 style={{ fontSize: 16 }}>Chia sẻ & Xuất bản tài liệu</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 16 }}>
              Tài liệu của sếp được lưu trữ cục bộ an toàn trên máy (IndexedDB) và sẵn sàng xuất ra các định dạng chuẩn văn phòng:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={handleExportDocx}>
                <FileText size={16} color="#185abd" />
                <span>Xuất tệp Minh Docs (.docx)</span>
              </button>
              <button
                className="btn"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowShareModal(false);
                  setPdfExportMode('standard');
                }}
              >
                <FileDown size={16} color="#dc2626" />
                <span>Xuất tệp Minh PDF (.pdf)</span>
              </button>
              <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={handleExportImage}>
                <FileImage size={16} color="#059669" />
                <span>Xuất ảnh độ phân giải cao (.png)</span>
              </button>
              <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={handleExportMarkdown}>
                <Download size={16} color="#475569" />
                <span>Xuất văn bản Markdown (.md)</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-doc" onClick={() => setShowShareModal(false)}>
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="dialog-backdrop" onClick={() => setShowTemplatesModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={18} color="#2563eb" />
                <h2 style={{ fontSize: 16 }}>Thư viện mẫu tài liệu chuyên nghiệp</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowTemplatesModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <button
                className="btn"
                style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                onClick={() => handleInsertTemplate('report')}
              >
                <strong style={{ fontSize: 13, color: '#0f172a' }}>Báo cáo hoạt động quý & Tài chính</strong>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Mẫu báo cáo đầy đủ mục tiêu, chỉ số KPI, biểu bảng tài chính</span>
              </button>

              <button
                className="btn"
                style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                onClick={() => handleInsertTemplate('contract')}
              >
                <strong style={{ fontSize: 13, color: '#0f172a' }}>Hợp đồng dịch vụ kinh tế công nghệ</strong>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Hợp đồng kinh tế thương mại chuẩn quy phạm pháp luật Việt Nam</span>
              </button>

              <button
                className="btn"
                style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 'auto' }}
                onClick={() => handleInsertTemplate('meeting')}
              >
                <strong style={{ fontSize: 13, color: '#0f172a' }}>Biên bản cuộc họp giao ban tuần</strong>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Mẫu ghi chép kết luận giao ban, thành phần tham dự & danh sách task</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowTemplatesModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && (
        <div className="dialog-backdrop" onClick={() => setShowSplitModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16 }}>Tách tài liệu theo chương mục (Split Document)</h2>
              <button className="icon-btn" onClick={() => setShowSplitModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              Hệ thống tự động nhận diện <strong>{splitSections.length}</strong> phần dựa trên cấu trúc Tiêu đề 1 & 2:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18, maxHeight: 220, overflowY: 'auto' }}>
              {splitSections.map((sec, i) => (
                <div key={i} style={{ padding: '7px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Phần {i + 1}:</strong> {sec.title}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{sec.nodes.length} khối</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setShowSplitModal(false)}>
                Đóng
              </button>
              <button className="btn" onClick={() => handleRunSplitDocument(false)}>
                <Download size={14} />
                <span>Tải các tệp .docx</span>
              </button>
              <button className="btn btn-doc" onClick={() => handleRunSplitDocument(true)}>
                Lưu vào Kho Minh Docs
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="dialog-backdrop" onClick={() => setShowMergeModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16 }}>Ghép nối tài liệu (Merge Document)</h2>
              <button className="icon-btn" onClick={() => setShowMergeModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              Chọn tài liệu khác trong Kho Minh Docs hoặc tải tệp .docx từ máy để ghép tiếp vào cuối văn bản hiện tại (kèm ngắt trang):
            </p>
            {workspaceDocs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 180, overflowY: 'auto' }}>
                {workspaceDocs.map((docItem) => (
                  <button
                    key={docItem.id}
                    className="btn"
                    style={{ justifyContent: 'space-between', fontSize: 12 }}
                    onClick={() => handleMergeWorkspaceDoc(docItem)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color="#185abd" />
                      <span>{docItem.name}</span>
                    </span>
                    <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>Ghép vào cuối</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <label className="btn" style={{ cursor: 'pointer', justifyContent: 'center' }}>
                <Upload size={14} />
                <span>Tải tệp Minh Docs (.docx) từ máy tính…</span>
                <input
                  type="file"
                  accept=".docx"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) {
                      await handleMergeUploadedDocx(f);
                    }
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowMergeModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditorCheckModal && (
        <div className="dialog-backdrop" onClick={() => setShowEditorCheckModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCheck size={20} color="#059669" />
                <h2 style={{ fontSize: 16 }}>Báo cáo kiểm chuẩn văn phong tiếng Việt (Editor)</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowEditorCheckModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Điểm chuẩn trình bày</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{proofreadReport.score}/100</div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                  {proofreadReport.totalIssues === 0 ? 'Không có lỗi định dạng câu' : `Phát hiện ${proofreadReport.totalIssues} điểm cần rà soát`}
                </div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Cấu trúc câu văn</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>{proofreadReport.sentenceCount} câu</div>
                <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>{wordCount} từ · {headings.length} đề mục</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#334155', marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Khoảng trắng kép thừa:</span>
                <strong>{proofreadReport.doubleSpaces} vị trí</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Khoảng trắng thừa trước dấu câu (, . ; : ! ?):</span>
                <strong>{proofreadReport.spaceBeforePunct} vị trí</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Chữ thường ngay sau dấu kết câu (. ! ?):</span>
                <strong>{proofreadReport.lowerAfterDot} vị trí</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Từ lặp liên tiếp nhau:</span>
                <strong>{proofreadReport.repeatedWords} vị trí</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Câu quá dài (&gt; 45 từ):</span>
                <strong>{proofreadReport.longSentences} câu</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                className="btn"
                onClick={handleAutoFixProofread}
                disabled={proofreadReport.doubleSpaces + proofreadReport.spaceBeforePunct + proofreadReport.lowerAfterDot === 0}
              >
                Tự động chuẩn hoá khoảng trắng & dấu câu
              </button>
              <button className="btn btn-doc" onClick={() => setShowEditorCheckModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfExportMode && (
        <div className="dialog-backdrop" onClick={() => setPdfExportMode(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileDown size={20} color="#dc2626" />
                <h2 style={{ fontSize: 16 }}>
                  {pdfExportMode === 'compressed'
                    ? 'Nén & Xuất PDF dung lượng nhỏ (PDF Compressor)'
                    : pdfExportMode === 'imageOnly'
                    ? 'Xuất PDF dạng ảnh chống chỉnh sửa (Image-only PDF)'
                    : 'Tạo tệp nhị phân chuẩn Minh PDF (Create PDF)'}
                </h2>
              </div>
              <button className="icon-btn" onClick={() => setPdfExportMode(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                className={`btn ${pdfExportMode === 'standard' ? 'btn-doc' : ''}`}
                style={{ fontSize: 11.5 }}
                onClick={() => setPdfExportMode('standard')}
              >
                Chuẩn sắc nét (300 DPI)
              </button>
              <button
                className={`btn ${pdfExportMode === 'compressed' ? 'btn-doc' : ''}`}
                style={{ fontSize: 11.5 }}
                onClick={() => setPdfExportMode('compressed')}
              >
                Nén gọn gửi Email
              </button>
              <button
                className={`btn ${pdfExportMode === 'imageOnly' ? 'btn-doc' : ''}`}
                style={{ fontSize: 11.5 }}
                onClick={() => setPdfExportMode('imageOnly')}
              >
                Ảnh phẳng bảo mật
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#334155', marginBottom: 18, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={keepPdfAttributes}
                onChange={(e) => setKeepPdfAttributes(e.target.checked)}
              />
              <span>Giữ nguyên Header, Footer, Đánh số trang và Chú thích cuối trang</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setPdfExportMode(null)}>
                Huỷ
              </button>
              <button className="btn" onClick={() => handleCreatePdfDocument(pdfExportMode, false)}>
                <Download size={14} />
                <span>Tải tệp .pdf</span>
              </button>
              <button className="btn btn-doc" onClick={() => handleCreatePdfDocument(pdfExportMode, true)}>
                Lưu & Mở trong Minh PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showOcrImportModal && (
        <div className="dialog-backdrop" onClick={() => setShowOcrImportModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16 }}>Nhận dạng & Trích xuất văn bản (OCR PDF / DOCX / TXT)</h2>
              <button className="icon-btn" onClick={() => setShowOcrImportModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="btn" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <Upload size={14} />
                <span>Chọn tệp .pdf, .docx hoặc .txt để trích xuất chữ…</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) await handleOcrFileUpload(f);
                  }}
                />
              </label>
            </div>

            <textarea
              className="text-field"
              rows={8}
              placeholder="Nội dung nhận dạng từ tệp PDF/DOCX sẽ hiển thị tại đây để sếp biên tập trước khi chèn…"
              value={ocrExtractedText}
              onChange={(e) => setOcrExtractedText(e.target.value)}
              style={{ width: '100%', fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowOcrImportModal(false)}>
                Đóng
              </button>
              <button
                className="btn btn-doc"
                disabled={!ocrExtractedText.trim()}
                onClick={() => {
                  if (!editor || !ocrExtractedText.trim()) return;
                  const paragraphsHtml = ocrExtractedText
                    .split(/\n{2,}/)
                    .map((p) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
                    .join('');
                  editor.chain().focus('end').insertContent(paragraphsHtml).run();
                  setShowOcrImportModal(false);
                  setSavedStatus('saving');
                  ui.toast('Đã chèn nội dung OCR vào tài liệu');
                }}
              >
                Chèn vào văn bản
              </button>
            </div>
          </div>
        </div>
      )}

      {showMailMergeModal && (
        <div className="dialog-backdrop" onClick={() => setShowMailMergeModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 16 }}>Trộn thư & Xuất văn bản hàng loạt (Mail Merge Studio)</h2>
                <div className="dialog-subtitle">Chèn trường biến vào văn bản rồi trộn danh sách người nhận thành tài liệu nhiều trang</div>
              </div>
              <button className="icon-btn" onClick={() => setShowMailMergeModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>Chèn trường biến tại con trỏ:</span>
              {(Object.keys(mailRecipients[0] ?? { Ho_ten: '', Chuc_vu: '', Phong_ban: '', Email: '', Ngay: '' })).map((fieldKey) => (
                <button
                  key={fieldKey}
                  className="btn"
                  style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
                  onClick={() => {
                    editor?.chain().focus().insertContent(`{{${fieldKey}}}`).run();
                    ui.toast(`Đã chèn biến {{${fieldKey}}}`);
                  }}
                >
                  {`{{${fieldKey}}}`}
                </button>
              ))}
              <label className="btn" style={{ fontSize: 11, padding: '2px 8px', height: 24, cursor: 'pointer', marginLeft: 'auto' }}>
                <Upload size={12} />
                <span>Nhập CSV / XLSX</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) await handleImportMailRecipients(f);
                  }}
                />
              </label>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: 34 }}>#</th>
                    {Object.keys(mailRecipients[0] ?? { Ho_ten: '', Chuc_vu: '', Phong_ban: '', Email: '', Ngay: '' }).map((colKey) => (
                      <th key={colKey} style={{ padding: '6px 8px', textAlign: 'left' }}>{colKey}</th>
                    ))}
                    <th style={{ padding: '6px 8px', width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {mailRecipients.map((rec, rIdx) => {
                    const colKeys = Object.keys(mailRecipients[0] ?? rec);
                    return (
                      <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9', background: mailPreviewIdx === rIdx ? '#eff6ff' : '#ffffff' }} onClick={() => setMailPreviewIdx(rIdx)}>
                        <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600 }}>{rIdx + 1}</td>
                        {colKeys.map((colKey) => (
                          <td key={colKey} style={{ padding: '4px 6px' }}>
                            <input
                              className="text-field"
                              style={{ fontSize: 11.5, padding: '3px 6px', height: 24, width: '100%' }}
                              value={rec[colKey] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMailRecipients((prev) =>
                                  prev.map((row, idx) => (idx === rIdx ? { ...row, [colKey]: val } : row))
                                );
                              }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <button
                            className="icon-btn"
                            style={{ width: 22, height: 22 }}
                            disabled={mailRecipients.length <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMailRecipients((prev) => prev.filter((_, idx) => idx !== rIdx));
                              setMailPreviewIdx(0);
                            }}
                            title="Xoá dòng này"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mailRecipients[mailPreviewIdx] && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#334155', marginBottom: 14 }}>
                <strong>Xem trước bản ghi #{mailPreviewIdx + 1}:</strong>{' '}
                {Object.entries(mailRecipients[mailPreviewIdx])
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  const templateKeys = Object.keys(mailRecipients[0] ?? { Ho_ten: '', Chuc_vu: '', Phong_ban: '', Email: '', Ngay: '' });
                  const emptyRow: Record<string, string> = {};
                  templateKeys.forEach((k) => {
                    emptyRow[k] = k === 'Ngay' ? new Date().toLocaleDateString('vi-VN') : '';
                  });
                  setMailRecipients((prev) => [...prev, emptyRow]);
                }}
              >
                + Thêm người nhận
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setShowMailMergeModal(false)}>
                  Đóng
                </button>
                <button className="btn btn-doc" onClick={handleGenerateMailMerge}>
                  Trộn & Xuất toàn bộ văn bản ({mailRecipients.length} người)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShortcutsModal && (
        <div className="dialog-backdrop" onClick={() => setShowShortcutsModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16 }}>Phím tắt soạn thảo nhanh (Minh Docs)</h2>
              <button className="icon-btn" onClick={() => setShowShortcutsModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, columnGap: 16, fontSize: 12.5, color: '#334155', marginBottom: 18 }}>
              <span>Lưu tài liệu ngay lập tức</span><strong>Ctrl + S</strong>
              <span>Hoàn tác / Làm lại</span><strong>Ctrl + Z / Ctrl + Y</strong>
              <span>In đậm / In nghiêng / Gạch chân</span><strong>Ctrl + B / I / U</strong>
              <span>Tìm kiếm & Thay thế</span><strong>Ctrl + F</strong>
              <span>Thêm bình luận cho đoạn chọn</span><strong>Ctrl + Alt + M</strong>
              <span>In trang / Xuất bản in</span><strong>Ctrl + P</strong>
              <span>Thoát chế độ tập trung (Focus Mode)</span><strong>Esc</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-doc" onClick={() => setShowShortcutsModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {!isFocusMode && (
        <footer className="editor-status">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>Khổ: {page.size} ({page.orientation === 'portrait' ? 'Dọc' : 'Ngang'})</span>
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={handleShowDetailedStats} title="Bấm để xem thống kê">
            Từ: {wordCount} · Ký tự: {charCount}
          </span>
          {isListening && <span style={{ color: '#d32f2f', fontWeight: 600 }}>● Đang ghi âm giọng nói…</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>Thu phóng: {zoom}%</span>
          <input
            type="range"
            min={50}
            max={150}
            step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: 80, cursor: 'pointer' }}
          />
        </div>
      </footer>
      )}
    </div>
  );
}
