import { SuiteLogo } from '../../components/SuiteLogo';
import './pdfEditor.css';
import { saveAccountSnapshot } from '../../lib/accountSnapshots';
import { useAccount } from '../../components/Authentication';
import { useWorkspace } from '../../lib/storage';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Save,
  X,
  History,
  Trash2,
  MessageSquare,
  Share2,
  FileCheck,
  FileSignature,
  Split,
  Layers,
  Crop,
  Minimize2,
  Image as ImageIcon,
  ScanText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  Play,
  Share,
  Users as TeamUsers,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Maximize,
  PanelLeft,
  Copy,
  FilePlus,
  ImagePlus,
  Hash,
  StickyNote,
  Info,
  Keyboard,
  BookOpen,
  FolderOpen,
  Camera,
  MoveHorizontal,
  FileMinus,
  FileOutput,
  RectangleHorizontal,
} from 'lucide-react';

import {
  type FileMeta,
  type PdfContent,
  type FileVersion,
  type CommentItem,
} from '../../lib/storage';
import { downloadBlob, formatBytes } from '../../lib/download';
import { useUi } from '../../components/ui';
import { useDocumentCloser } from '../../lib/documentCloser';
import { currentAuthorName } from '../../lib/currentAuthor';
import { looksLikePdf, pdfBytesToDataUrl, pdfDataUrlToBytes } from './pdfBytes';
import { usePageCanvas, usePdfDocument, usePdfPageText } from './usePdfDocument';
import { PdfPrintDialog } from './PdfPrintDialog';
import { PdfPageScroller, PdfThumb, typicalWidth } from './PdfPageScroller';
import { usePageNavigation } from './usePageNavigation';
import { extractAllText, rasterizePages, trimmedCanvasPng } from './pdfRaster';
import type { ImagePageInput, Margins, PageNumberFormat, PageNumberPosition, PdfProperties, SignatureAnchor } from './pdfTools';
import { isShareableFileId, requestTeamShare } from '../../lib/teamShare';

const loadPdfTools = () => import('./pdfTools');

const SIGN_ANCHORS: { value: SignatureAnchor; label: string }[] = [
  { value: 'bottom-right', label: 'Góc dưới bên phải' },
  { value: 'bottom-center', label: 'Giữa cuối trang' },
  { value: 'bottom-left', label: 'Góc dưới bên trái' },
  { value: 'top-right', label: 'Góc trên bên phải' },
  { value: 'top-left', label: 'Góc trên bên trái' },
  { value: 'center', label: 'Giữa trang' },
];

const PAGE_NUMBER_POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: 'bottom-center', label: 'Giữa cuối trang' },
  { value: 'bottom-right', label: 'Góc dưới bên phải' },
  { value: 'top-right', label: 'Góc trên bên phải' },
];

const PDF_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl + S', action: 'Lưu tài liệu' },
  { keys: 'Ctrl + P', action: 'In tài liệu' },
  { keys: 'Ctrl + =', action: 'Phóng to' },
  { keys: 'Ctrl + -', action: 'Thu nhỏ' },
  { keys: 'Ctrl + 0', action: 'Vừa chiều rộng khung' },
  { keys: 'Alt + Home', action: 'Về trang đầu' },
  { keys: 'Alt + End', action: 'Tới trang cuối' },
  { keys: 'Esc', action: 'Thoát toàn màn hình' },
];

const PDF_TAB_GUIDE: { tab: string; text: string }[] = [
  { tab: 'File', text: 'Mở, lưu, tải xuống, in, chia sẻ tệp; xem lịch sử phiên bản và sửa thuộc tính tài liệu.' },
  { tab: 'Home', text: 'Chuyển trang, phóng to thu nhỏ, xoay hướng xem, sao chép chữ của trang đang xem.' },
  { tab: '23 PDF', text: 'Ký, tách, ghép, cắt lề, nén, chuyển đổi và nhận dạng chữ OCR.' },
  { tab: 'Insert', text: 'Chèn chữ ký, trang trống, ảnh thành trang mới, trang từ tệp PDF khác, số trang và ghi chú.' },
  { tab: 'View', text: 'Chọn mức thu phóng, ẩn hiện bảng trang thu nhỏ và bảng ghi chú, trình chiếu hoặc xem toàn màn hình.' },
  { tab: 'Tools', text: 'Xoay, xoá, trích trang và lưu thay đổi vào tệp; nén, cắt lề, chuyển đổi tệp.' },
];

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

const RASTER_DPI_OPTIONS = [96, 150, 300];
const IMAGE_ONLY_DPI = 150;
const NO_PDF_MESSAGE = 'Tài liệu này chưa có tệp PDF. Bấm "Mở tệp PDF" để nạp tệp trước.';

type ConvertTarget = 'text' | 'image';

function bytesBlob(bytes: Uint8Array | string, type: string) {
  return new Blob([bytes as BlobPart], { type });
}

function PdfPlayPage({ doc, pageNumber, width, height, rotation }: { doc: Parameters<typeof usePageCanvas>[0]; pageNumber: number; width: number; height: number; rotation: number }) {
  const quarter = rotation % 180 !== 0;
  const pageWidth = quarter ? height : width;
  const pageHeight = quarter ? width : height;
  const cssWidth = Math.floor(Math.min(window.innerWidth * 0.86, (window.innerHeight * 0.74 * pageWidth) / pageHeight));
  const { canvasRef, failed } = usePageCanvas(doc, pageNumber, cssWidth, rotation, true);
  if (failed) return <div style={{ color: '#fff' }}>Không vẽ được trang {pageNumber}.</div>;
  return <canvas ref={canvasRef} style={{ width: cssWidth, height: Math.round((cssWidth * pageHeight) / pageWidth), background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} />;
}

interface PdfEditorProps {
  meta: FileMeta;
  content: PdfContent;
  onSave: (meta: FileMeta, content: PdfContent, explicit?: boolean) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
}

type PdfRibbonTab = 'file' | 'home' | 'minh_pdf' | 'insert' | 'view' | 'tools' | 'help';

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MIN_FIT_ZOOM = 30;
const PDF_MIN_REAL_FIT_ZOOM = 5;

export default function PdfEditor({ meta, content, onSave, onBack }: PdfEditorProps) {
  const ui = useUi();
  const { user, login } = useAccount();
  const sourceStorage = useWorkspace();
  const { listVersions, deleteVersion } = sourceStorage;
  const [activeTab, setActiveTab] = useState<PdfRibbonTab>('minh_pdf');
  const [title, setTitle] = useState(meta.name);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [revision, setRevision] = useState(0);
  const changeRevision = useRef(0);
  const markDirty = useCallback(() => {
    changeRevision.current++;
    setRevision(changeRevision.current);
    setSavedStatus('saving');
  }, []);
  const [keepAttributes, setKeepAttributes] = useState(true);

  const currentPageState = useState(1);
  const [currentPage, setCurrentPage] = currentPageState;
  const [pdfDataUrl, setPdfDataUrl] = useState(content.pdfDataUrl);
  const hasRealPdf = Boolean(pdfDataUrl);
  const pdfState = usePdfDocument(pdfDataUrl);
  const thumbCache = useMemo(() => new Map<string, string>(), [pdfState]);
  const [totalPages, setTotalPages] = useState(content.pageCount || (content.pdfDataUrl ? 1 : 3));
  const storedPageCount = content.pageCount;

  useEffect(() => {
    if (pdfState.status !== 'ready') return;
    const count = pdfState.doc.numPages;
    setTotalPages(count);
    setCurrentPage((page) => Math.min(Math.max(1, page), count));
    if (storedPageCount !== count) markDirty();
  }, [pdfState, storedPageCount, markDirty, setCurrentPage]);

  const [rotation, setRotation] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);
  const pageBaseWidth = pdfState.status === 'ready' ? typicalWidth(pdfState.sizes, rotation) : PDF_PAGE_WIDTH;
  const [zoomSetting, setZoomSetting] = useState<number | null>(null);
  const [fitZoom, setFitZoom] = useState(100);
  const zoom = zoomSetting ?? fitZoom;
  const setZoom = (update: (value: number) => number) => setZoomSetting(update(zoom));
  const [pdfCanvas, setPdfCanvas] = useState<HTMLDivElement | null>(null);
  const realPageText = usePdfPageText(pdfState, currentPage);
  const pageNav = usePageNavigation({
    root: pdfCanvas,
    enabled: pdfState.status === 'ready',
    pageCount: totalPages,
    currentPage,
    setCurrentPage,
    layoutKey: `${pdfState.status}:${zoom}:${rotation}`,
  });
  const navigateToPage = pageNav.goToPage;
  const goToPage = useCallback((page: number) => {
    if (hasRealPdf) navigateToPage(page);
    else setCurrentPage(Math.min(Math.max(1, page), totalPages));
  }, [hasRealPdf, navigateToPage, setCurrentPage, totalPages]);
  const [thumbStrip, setThumbStrip] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pdfCanvas || typeof ResizeObserver === 'undefined') return;
    const minZoom = hasRealPdf ? PDF_MIN_REAL_FIT_ZOOM : PDF_MIN_FIT_ZOOM;
    const measure = () => {
      const style = getComputedStyle(pdfCanvas);
      const width = pdfCanvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (width <= 0) return;
      setFitZoom(Math.max(minZoom, Math.min(100, Math.floor((width / pageBaseWidth) * 100))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pdfCanvas);
    return () => observer.disconnect();
  }, [pdfCanvas, pageBaseWidth, hasRealPdf]);

  const [showSignModal, setShowSignModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCompressModal, setShowCompressModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<ConvertTarget | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [pageOp, setPageOp] = useState<'rotate' | 'delete' | null>(null);
  const [pageOpRange, setPageOpRange] = useState('');
  const [pageOpAngle, setPageOpAngle] = useState(90);
  const [showPageNumberModal, setShowPageNumberModal] = useState(false);
  const [pageNumberPosition, setPageNumberPosition] = useState<PageNumberPosition>('bottom-center');
  const [pageNumberFormat, setPageNumberFormat] = useState<PageNumberFormat>('of-total');
  const [properties, setProperties] = useState<PdfProperties | null>(null);
  const [helpModal, setHelpModal] = useState<'shortcuts' | 'guide' | null>(null);
  const [pageInput, setPageInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [comments, setComments] = useState<CommentItem[]>(content.comments || []);
  const [newCommentText, setNewCommentText] = useState('');

  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [signHasInk, setSignHasInk] = useState(false);
  const [signPage, setSignPage] = useState(1);
  const [signAnchor, setSignAnchor] = useState<SignatureAnchor>('bottom-right');
  const [signWidth, setSignWidth] = useState(30);
  const [splitInput, setSplitInput] = useState('');
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [cropMm, setCropMm] = useState<Margins>({ top: 10, right: 10, bottom: 10, left: 10 });
  const [cropScope, setCropScope] = useState<'all' | 'current'>('all');
  const [rasterFormat, setRasterFormat] = useState<'png' | 'jpeg'>('png');
  const [rasterDpi, setRasterDpi] = useState(150);

  const [versions, setVersions] = useState<FileVersion[]>([]);

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setShowHistoryModal(true);
  };

  const handleCreateSnapshot = async () => {
    const draft: PdfContent = { ...content, pdfDataUrl, pageCount: totalPages, comments };
    const currentMeta = { ...meta, name: title, updatedAt: Date.now() };
    try {
      if (!user) await sourceStorage.saveFile(currentMeta, draft);
      const account = await login();
      if (!account) return;
      const { version: saved } = await saveAccountSnapshot({ accountId: account.uid, sourceUserId: user?.uid, sourceStorage, meta: currentMeta, content: draft, label: `Bản lưu ${new Date().toLocaleTimeString('vi-VN')}` });
      setVersions((prev) => [saved, ...prev]);
      ui.toast('Đã lưu bản chụp tài liệu PDF vào lịch sử');
    } catch {
      ui.toast('Chưa lưu được phiên bản. Nội dung đang soạn vẫn được giữ nguyên.', true);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(meta.id, versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    ui.toast('Đã xoá phiên bản lưu');
  };

  const persistPdf = useCallback(async (explicit = false) => {
    const savedRevision = changeRevision.current;
    const updatedMeta: FileMeta = { ...meta, name: title.trim() || meta.name, updatedAt: Date.now() };
    const saved = await onSave(updatedMeta, { ...content, pdfDataUrl, pageCount: totalPages, comments }, explicit);
    if (saved && changeRevision.current === savedRevision) setSavedStatus('saved');
    return saved;
  }, [meta, title, onSave, content, pdfDataUrl, totalPages, comments]);

  useDocumentCloser((close) => persistPdf(false).then((saved) => { if (saved && close) onBack(); return saved; }));

  const handleSaveNow = async () => {
    if (await persistPdf(true)) ui.toast('Đã lưu tài liệu PDF');
  };

  useEffect(() => {
    if (savedStatus !== 'saving') return;
    const timer = setTimeout(() => void persistPdf(false), 800);
    return () => clearTimeout(timer);
  }, [savedStatus, persistPdf, revision]);

  useEffect(() => {
    if (savedStatus === 'saved') return;
    const flush = () => { void persistPdf(false); };
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
  }, [savedStatus, persistPdf]);

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      setTitle(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newCmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: currentAuthorName(),
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [newCmt, ...prev]);
    markDirty();
    setNewCommentText('');
    ui.toast('Đã thêm ghi chú bình luận');
  };

  const pageRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(currentPage);
  const commentsRef = useRef(comments);
  const pdfDataUrlRef = useRef(pdfDataUrl);
  const realPageTextRef = useRef(realPageText);
  useEffect(() => {
    currentPageRef.current = currentPage;
    commentsRef.current = comments;
    pdfDataUrlRef.current = pdfDataUrl;
    realPageTextRef.current = realPageText;
  }, [currentPage, comments, pdfDataUrl, realPageText]);

  const ocrText = hasRealPdf
    ? realPageText ?? ''
    : `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc\n\n${title.replace(/\.[^/.]+$/, '')}\n\nKính gửi: Ban Giám đốc và các đơn vị phòng ban liên quan.\nCăn cứ theo kế hoạch phát triển giải pháp văn phòng số nội bộ Office 23, văn bản PDF này đã được biên soạn, kiểm duyệt và đóng dấu chữ ký điện tử an toàn tuyệt đối.\n\nNgười ký: ${currentAuthorName()}`;

  const handleExportPdf = () => {
    if (!pdfDataUrl) {
      ui.toast('Tài liệu này chưa có tệp PDF. Bấm "Mở tệp PDF" để nạp tệp trước khi tải xuống.', true);
      return;
    }
    const blob = new Blob([pdfDataUrlToBytes(pdfDataUrl) as BlobPart], { type: 'application/pdf' });
    downloadBlob(blob, `${title.replace(/\.[^/.]+$/, '')}.pdf`);
    ui.toast('Đã tải xuống tệp PDF');
  };

  const handleUploadLocalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!looksLikePdf(bytes)) {
        ui.toast(`"${file.name}" không phải tệp PDF hợp lệ`, true);
        return;
      }
      setPdfDataUrl(await pdfBytesToDataUrl(bytes));
      setTitle(file.name);
      setCurrentPage(1);
      setZoomSetting(null);
      markDirty();
      ui.toast(`Đã nạp tệp PDF: ${file.name}`);
    } catch {
      ui.toast(`Không đọc được tệp "${file.name}"`, true);
    }
  };

  const baseName = title.replace(/\.[^/.]+$/, '') || 'tai-lieu';

  const runPdfTool = async (busy: string, work: () => Promise<void>) => {
    ui.showBusy(busy);
    try {
      await work();
    } catch (error) {
      const tools = await loadPdfTools().catch(() => null);
      ui.toast(tools && tools.isPdfToolError(error) ? error.message : 'Không xử lý được tệp PDF này. Tài liệu vẫn giữ nguyên.', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const requireBytes = () => {
    if (!pdfDataUrl) {
      ui.toast(NO_PDF_MESSAGE, true);
      return null;
    }
    return pdfDataUrlToBytes(pdfDataUrl);
  };

  const requireReadyDoc = () => {
    if (pdfState.status === 'ready') return pdfState;
    ui.toast(pdfState.status === 'loading' ? 'Tệp PDF đang mở, thử lại sau giây lát' : NO_PDF_MESSAGE, true);
    return null;
  };

  const applyPdfBytes = async (bytes: Uint8Array) => {
    setPdfDataUrl(await pdfBytesToDataUrl(bytes));
    markDirty();
  };

  const openSignModal = () => {
    setSignPage(currentPage);
    setSignHasInk(false);
    setShowSignModal(true);
  };

  const signPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSignHasInk(false);
  };

  const handleInsertSignature = () => {
    const bytes = requireBytes();
    const canvas = signCanvasRef.current;
    if (!bytes || !canvas) return;
    void runPdfTool('Đang chèn chữ ký vào trang PDF…', async () => {
      const png = await trimmedCanvasPng(canvas);
      if (!png) {
        ui.toast('Chưa có nét chữ ký. Hãy ký vào khung trước khi chèn.', true);
        return;
      }
      const tools = await loadPdfTools();
      const signed = await tools.stampSignature(bytes, png, { pageIndex: signPage - 1, anchor: signAnchor, widthFraction: signWidth / 100 }, { keepAttributes });
      await applyPdfBytes(signed);
      setShowSignModal(false);
      ui.toast(`Đã chèn chữ ký vào trang ${signPage}`);
    });
  };

  const handleSplit = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang tách trang PDF…', async () => {
      const tools = await loadPdfTools();
      const ranges = tools.parsePageRanges(splitInput, totalPages);
      const parts = await tools.splitPdf(bytes, ranges, { keepAttributes });
      if (parts.length === 1) {
        downloadBlob(bytesBlob(parts[0], 'application/pdf'), `${baseName}_trang_${ranges[0].label}.pdf`);
      } else {
        const zipped = await tools.zipFiles(parts.map((part, index) => ({ name: `${baseName}_trang_${ranges[index].label}.pdf`, bytes: part })));
        downloadBlob(bytesBlob(zipped, 'application/zip'), `${baseName}_tach_trang.zip`);
      }
      setShowSplitModal(false);
      ui.toast(parts.length === 1 ? 'Đã tách và tải xuống 1 tệp PDF' : `Đã tách ${parts.length} tệp PDF và tải xuống dạng .zip`);
    });
  };

  const handlePickMergeFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    setMergeFiles((prev) => [...prev, ...picked]);
  };

  const handleMerge = () => {
    if (mergeFiles.length === 0) {
      ui.toast('Chọn ít nhất một tệp PDF để ghép', true);
      return;
    }
    void runPdfTool('Đang ghép các tệp PDF…', async () => {
      const extra: Uint8Array[] = [];
      for (const file of mergeFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!looksLikePdf(bytes)) {
          ui.toast(`"${file.name}" không phải tệp PDF hợp lệ. Chưa ghép tệp nào.`, true);
          return;
        }
        extra.push(bytes);
      }
      const tools = await loadPdfTools();
      const sources = pdfDataUrl ? [pdfDataUrlToBytes(pdfDataUrl), ...extra] : extra;
      const merged = await tools.mergePdfs(sources, { keepAttributes });
      await applyPdfBytes(merged.bytes);
      setMergeFiles([]);
      setShowMergeModal(false);
      ui.toast(`Đã ghép ${mergeFiles.length} tệp. Tài liệu hiện có ${merged.pageCount} trang.`);
    });
  };

  const handleCompress = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang nén tệp PDF…', async () => {
      const tools = await loadPdfTools();
      const result = await tools.compressPdf(bytes, { keepAttributes });
      setShowCompressModal(false);
      if (!result.reduced) {
        ui.toast(`Tệp đã gọn sẵn (${formatBytes(result.before)}), không giảm thêm được. Tài liệu giữ nguyên.`);
        return;
      }
      await applyPdfBytes(result.bytes);
      const percent = Math.round((1 - result.after / result.before) * 100);
      ui.toast(`Đã nén: ${formatBytes(result.before)} → ${formatBytes(result.after)} (giảm ${percent}%)`);
    });
  };

  const handleCrop = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang cắt lề trang PDF…', async () => {
      const tools = await loadPdfTools();
      const margins = { top: cropMm.top * tools.MM_TO_PT, right: cropMm.right * tools.MM_TO_PT, bottom: cropMm.bottom * tools.MM_TO_PT, left: cropMm.left * tools.MM_TO_PT };
      const result = await tools.cropPdf(bytes, margins, cropScope === 'current' ? [currentPage - 1] : null, { keepAttributes });
      await applyPdfBytes(result.bytes);
      setShowCropModal(false);
      ui.toast(`Đã cắt lề ${result.pageCount} trang`);
    });
  };

  const handleConvert = (target: ConvertTarget) => {
    const ready = requireReadyDoc();
    if (!ready) return;
    void runPdfTool(target === 'text' ? 'Đang trích xuất chữ…' : 'Đang xuất trang thành ảnh…', async () => {
      if (target === 'text') {
        const { text, hasText } = await extractAllText(ready.doc);
        if (!hasText) {
          ui.toast('Tệp không có lớp chữ (có thể là bản quét), chưa trích xuất được chữ.', true);
          return;
        }
        downloadBlob(bytesBlob(`\ufeff${text}`, 'text/plain;charset=utf-8'), `${baseName}.txt`);
        setShowConvertModal(null);
        ui.toast(`Đã xuất chữ của ${ready.doc.numPages} trang thành ${baseName}.txt`);
        return;
      }
      const ext = rasterFormat === 'png' ? 'png' : 'jpg';
      const pages = await rasterizePages(ready.doc, ready.sizes, rasterDpi, rasterFormat, (done, total) => ui.showBusy(`Đang xuất trang ${done}/${total}…`));
      if (pages.length === 1) {
        downloadBlob(bytesBlob(pages[0].bytes, `image/${rasterFormat}`), `${baseName}.${ext}`);
      } else {
        const tools = await loadPdfTools();
        const zipped = await tools.zipFiles(pages.map((page, index) => ({ name: `${baseName}_trang_${index + 1}.${ext}`, bytes: page.bytes })));
        downloadBlob(bytesBlob(zipped, 'application/zip'), `${baseName}_anh.zip`);
      }
      setShowConvertModal(null);
      ui.toast(pages.length === 1 ? `Đã xuất trang thành ${baseName}.${ext}` : `Đã xuất ${pages.length} trang thành ảnh .${ext} (tệp .zip)`);
    });
  };

  const handleImageOnlyPdf = () => {
    const ready = requireReadyDoc();
    if (!ready || !pdfDataUrl) return;
    void runPdfTool('Đang chuyển các trang thành ảnh…', async () => {
      const pages = await rasterizePages(ready.doc, ready.sizes, IMAGE_ONLY_DPI, 'jpeg', (done, total) => ui.showBusy(`Đang chuyển trang ${done}/${total} thành ảnh…`));
      const tools = await loadPdfTools();
      const bytes = await tools.imagesToPdf(pages, pdfDataUrlToBytes(pdfDataUrl), { keepAttributes });
      downloadBlob(bytesBlob(bytes, 'application/pdf'), `${baseName}_chi_anh.pdf`);
      ui.toast(`Đã tải xuống ${baseName}_chi_anh.pdf (${pages.length} trang dạng ảnh, không còn lớp chữ)`);
    });
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(Math.min(ZOOM_MIN, z), z - ZOOM_STEP));
  const fitWidth = () => setZoomSetting(null);
  const actualSize = () => setZoomSetting(100);

  const handlePageJump = () => {
    const page = Number.parseInt(pageInput, 10);
    setPageInput('');
    if (!Number.isFinite(page) || page < 1 || page > totalPages) {
      ui.toast(`Nhập số trang từ 1 đến ${totalPages}`, true);
      return;
    }
    goToPage(page);
  };

  const handleCopyPageText = async () => {
    if (!hasRealPdf) {
      ui.toast(NO_PDF_MESSAGE, true);
      return;
    }
    if (realPageText === null) {
      ui.toast('Đang đọc chữ của trang, thử lại sau giây lát', true);
      return;
    }
    const text = realPageText.trim();
    if (!text) {
      ui.toast(`Trang ${currentPage} không có lớp chữ để sao chép (có thể là bản quét). Dùng OCR PDF để nhận dạng chữ.`, true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      ui.toast(`Đã sao chép chữ của trang ${currentPage}`);
    } catch {
      ui.toast('Chưa sao chép được vào bộ nhớ tạm. Hãy bấm vào trang rồi thử lại.', true);
    }
  };

  const handleInsertBlankPage = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang chèn trang trống…', async () => {
      const tools = await loadPdfTools();
      const result = await tools.insertBlankPage(bytes, currentPage - 1, { keepAttributes });
      await applyPdfBytes(result.bytes);
      ui.toast(`Đã chèn trang trống thành trang ${result.pageNumber}. Tài liệu có ${result.pageCount} trang.`);
    });
  };

  const readImageFile = async (file: File): Promise<ImagePageInput> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, format: 'png' };
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, format: 'jpeg' };
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('image');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), format: 'png' };
  };

  const handleInsertImagePage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang chèn ảnh thành trang mới…', async () => {
      const tools = await loadPdfTools();
      let image: ImagePageInput;
      try {
        image = await readImageFile(file);
      } catch {
        throw new tools.PdfToolError(`Không đọc được ảnh "${file.name}". Chọn ảnh PNG, JPG hoặc WebP.`);
      }
      const result = await tools.insertImagePage(bytes, image, currentPage - 1, { keepAttributes });
      await applyPdfBytes(result.bytes);
      ui.toast(`Đã chèn ảnh thành trang ${result.pageNumber}. Tài liệu có ${result.pageCount} trang.`);
    });
  };

  const handleAddPageNumbers = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang đánh số trang…', async () => {
      const tools = await loadPdfTools();
      const result = await tools.addPageNumbers(bytes, pageNumberPosition, pageNumberFormat, { keepAttributes });
      await applyPdfBytes(result.bytes);
      setShowPageNumberModal(false);
      ui.toast(`Đã đánh số ${result.pageCount} trang`);
    });
  };

  const openCommentComposer = () => {
    setShowComments(true);
    window.setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const openPageOp = (kind: 'rotate' | 'delete') => {
    if (!requireBytes()) return;
    setPageOpRange(String(currentPage));
    setPageOpAngle(90);
    setPageOp(kind);
  };

  const openExtractPages = () => {
    if (!requireBytes()) return;
    setSplitInput(String(currentPage));
    setShowSplitModal(true);
  };

  const handlePageOp = async () => {
    const bytes = requireBytes();
    if (!bytes || !pageOp) return;
    const kind = pageOp;
    const tools = await loadPdfTools();
    let indexes: number[];
    try {
      indexes = [...new Set(tools.parsePageRanges(pageOpRange, totalPages).flatMap((range) => range.pages))].sort((a, b) => a - b);
    } catch (error) {
      ui.toast(tools.isPdfToolError(error) ? error.message : 'Dải trang chưa hợp lệ', true);
      return;
    }
    if (kind === 'delete' && !(await ui.confirm(`Xoá ${indexes.length} trang khỏi tệp PDF?`, 'Các trang này sẽ bị bỏ khỏi tệp PDF đang mở.', true))) return;
    void runPdfTool(kind === 'rotate' ? 'Đang xoay trang…' : 'Đang xoá trang…', async () => {
      if (kind === 'rotate') {
        const result = await tools.rotatePages(bytes, pageOpAngle, indexes, { keepAttributes });
        await applyPdfBytes(result.bytes);
        setPageOp(null);
        ui.toast(`Đã xoay ${result.pageCount} trang và lưu vào tệp`);
        return;
      }
      const result = await tools.deletePages(bytes, indexes, { keepAttributes });
      await applyPdfBytes(result.bytes);
      setPageOp(null);
      ui.toast(`Đã xoá ${result.removed} trang. Tài liệu còn ${result.pageCount} trang.`);
    });
  };

  const openProperties = () => {
    const bytes = requireBytes();
    if (!bytes) return;
    void runPdfTool('Đang đọc thuộc tính tệp…', async () => {
      const tools = await loadPdfTools();
      setProperties(await tools.readProperties(bytes));
    });
  };

  const handleSaveProperties = () => {
    const bytes = requireBytes();
    if (!bytes || !properties) return;
    const next = properties;
    void runPdfTool('Đang lưu thuộc tính tài liệu…', async () => {
      const tools = await loadPdfTools();
      await applyPdfBytes(await tools.writeProperties(bytes, next));
      setProperties(null);
      ui.toast('Đã lưu thuộc tính vào tệp PDF');
    });
  };

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === editorRootRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await editorRootRef.current?.requestFullscreen();
    } catch {
      ui.toast('Thiết bị này chưa cho phép xem toàn màn hình', true);
    }
  };

  const closeDocument = () => void persistPdf(false).then((saved) => { if (saved) onBack(); });

  const shortcutActions = { save: handleSaveNow, zoomIn, zoomOut, fitWidth, first: () => goToPage(1), last: () => goToPage(totalPages) };
  const shortcutRef = useRef(shortcutActions);
  useEffect(() => {
    shortcutRef.current = shortcutActions;
  });

  const shareFile = useMemo(() => {
    if (!showShareModal || !pdfDataUrl) return null;
    return new File([pdfDataUrlToBytes(pdfDataUrl) as BlobPart], `${baseName}.pdf`, { type: 'application/pdf' });
  }, [showShareModal, pdfDataUrl, baseName]);

  const currentPdfSize = pdfDataUrl ? Math.floor(((pdfDataUrl.length - pdfDataUrl.indexOf(',') - 1) * 3) / 4) - (pdfDataUrl.endsWith('==') ? 2 : pdfDataUrl.endsWith('=') ? 1 : 0) : null;

  const canShareFile = Boolean(shareFile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] }));

  const handleSystemShare = async () => {
    const file = shareFile;
    if (!file) {
      ui.toast(NO_PDF_MESSAGE, true);
      return;
    }
    try {
      await navigator.share({ files: [file], title: baseName });
      setShowShareModal(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      ui.toast('Thiết bị này chưa gửi được tệp qua bảng chia sẻ. Hãy tải tệp xuống rồi gửi.', true);
    }
  };

  const openPrint = useCallback(() => {
    if (pdfState.status !== 'ready') {
      ui.toast(pdfState.status === 'loading' ? 'Tệp PDF đang mở, thử lại sau giây lát' : 'Chưa có tệp PDF để in', true);
      return;
    }
    setPrintOpen(true);
  }, [pdfState.status, ui]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const actions = shortcutRef.current;
      let handled = true;
      if (mod && !event.shiftKey && !event.altKey && key === 'p') openPrint();
      else if (mod && !event.shiftKey && !event.altKey && key === 's') void actions.save();
      else if (mod && !event.altKey && (event.key === '=' || event.key === '+')) actions.zoomIn();
      else if (mod && !event.altKey && event.key === '-') actions.zoomOut();
      else if (mod && !event.altKey && event.key === '0') actions.fitWidth();
      else if (!mod && event.altKey && event.key === 'Home') actions.first();
      else if (!mod && event.altKey && event.key === 'End') actions.last();
      else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPrint]);

  return (
    <div className="editor-shell pdf-editor" ref={editorRootRef}>
      {printOpen && pdfState.status === 'ready' && (
        <PdfPrintDialog doc={pdfState.doc} sizes={pdfState.sizes} rotation={rotation} title={title.replace(/\.pdf$/i, '')} currentPage={currentPage} onClose={() => setPrintOpen(false)} />
      )}
      {/* Top Header */}
      <header className="editor-top">
        <div className="editor-title-group">
          <button className="icon-btn" onClick={() => void persistPdf(false).then((saved) => { if (saved) onBack(); })} title="Quay lại danh sách tệp">
            <ArrowLeft size={18} />
          </button>
          <SuiteLogo kind="pdf" size={32} decorative={false} />
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            title="Nhấp để đổi tên tệp PDF"
          />
          <div
            className={`save-pill ${savedStatus}`}
            onClick={handleOpenHistory}
            title="Nhấp để xem lịch sử phiên bản"
            style={{ cursor: 'pointer' }}
          >
            {savedStatus === 'saved' ? (
              <>
                <CheckCircle2 size={13} />
                <span>{user ? 'Đã lưu' : 'Đã lưu nháp trên máy'}</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>{user ? 'Đang lưu…' : 'Đang lưu nháp…'}</span>
              </>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Upload size={14} />
            <span>Mở tệp PDF</span>
            <input type="file" accept=".pdf,application/pdf" hidden onChange={(e) => void handleUploadLocalPdf(e)} />
          </label>
          <button className="btn" onClick={handleOpenHistory} title="Lịch sử phiên bản">
            <History size={15} />
            <span>Lịch sử</span>
          </button>
          <button className="btn" onClick={handleSaveNow} title="Lưu chính thức">
            <Save size={15} />
            <span>Lưu</span>
          </button>
          <button
            className="btn"
            style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
            onClick={handleExportPdf}
            title="Tải xuống tệp PDF"
          >
            <Download size={15} />
            <span>Tải xuống PDF</span>
          </button>
          <button className="btn" onClick={openPrint} title="In tài liệu PDF (Ctrl+P)">
            <Printer size={15} />
            <span>In</span>
          </button>
        </div>
      </header>

      {/* Ribbon Bar */}
      <div className="ribbon" style={{ borderBottom: '1px solid #dce1e8' }}>
        {/* Top Tabs */}
        <div className="ribbon-tabs-bar">
          <div className="ribbon-tabs-list">
            <button className={`ribbon-tab oc-file-tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => setActiveTab('file')}>
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
              23 PDF
            </button>
            <button className={`ribbon-tab ${activeTab === 'insert' ? 'active' : ''}`} onClick={() => setActiveTab('insert')}>
              Insert
            </button>
            <button className={`ribbon-tab ${activeTab === 'view' ? 'active' : ''}`} onClick={() => setActiveTab('view')}>
              View
            </button>
            <button className={`ribbon-tab ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}>
              Tools
            </button>
            <button className={`ribbon-tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>
              Help
            </button>
          </div>

          <div className="ribbon-top-actions">
            <button
              className={`ribbon-pill-btn ${showComments ? 'active' : ''}`}
              onClick={() => setShowComments(!showComments)}
              title="Bình luận & Ghi chú trên PDF"
            >
              <MessageSquare size={13} />
              <span>Comments{comments.filter((c) => !c.resolved).length > 0 ? ` (${comments.filter((c) => !c.resolved).length})` : ''}</span>
            </button>

            <button
              className="ribbon-share-btn"
              style={{ background: '#dc2626', borderColor: '#b91c1c' }}
              onClick={() => setShowShareModal(true)}
              title="Chia sẻ tệp PDF"
            >
              <Share2 size={13} />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>

        {/* Ribbon Body */}
        <div className="ribbon-body">
          {activeTab === 'minh_pdf' && (
            <>
              {/* 1. Group: Create PDF */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={handleExportPdf}
                    title="Tạo tệp PDF mới từ nội dung hiện tại"
                  >
                    <div style={{ position: 'relative' }}>
                      <FileCheck size={20} color="#dc2626" />
                      <span style={{ position: 'absolute', bottom: -2, right: -4, fontSize: 11, fontWeight: 900, color: '#dc2626' }}>+</span>
                    </div>
                    <span>Create<br/>PDF</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowPlayModal(true)}
                    title="Tạo và trình chiếu PDF toàn màn hình"
                  >
                    <div style={{ position: 'relative' }}>
                      <FileCheck size={20} color="#dc2626" />
                      <Play size={10} color="#dc2626" fill="#dc2626" style={{ position: 'absolute', bottom: 0, right: -4 }} />
                    </div>
                    <span>Create<br/>and play</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowShareModal(true)}
                    title="Gửi tệp PDF qua bảng chia sẻ của hệ thống hoặc tải xuống để gửi"
                  >
                    <div style={{ position: 'relative' }}>
                      <FileCheck size={20} color="#dc2626" />
                      <Share size={10} color="#dc2626" style={{ position: 'absolute', bottom: 0, right: -4 }} />
                    </div>
                    <span>Create<br/>and share</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Create PDF</div>
              </div>

              {/* 2. Group: WPS PDF Tools */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={openSignModal}
                    title="Chèn chữ ký tay vào trang PDF"
                  >
                    <FileSignature size={20} color="#475569" />
                    <span>Sign</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowSplitModal(true)}
                    title="Tách các trang PDF thành tệp riêng"
                  >
                    <Split size={20} color="#0284c7" />
                    <span>PDF<br/>Split</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowMergeModal(true)}
                    title="Ghép nối nhiều tệp PDF lại với nhau"
                  >
                    <Layers size={20} color="#2563eb" />
                    <span>PDF<br/>Merge</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowCropModal(true)}
                    title="Cắt lề trang PDF (Crop Pages)"
                  >
                    <Crop size={20} color="#059669" />
                    <span>Crop<br/>Pages</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowCompressModal(true)}
                    title="Nén giảm dung lượng tệp PDF (Compressor)"
                  >
                    <Minimize2 size={20} color="#d97706" />
                    <span>PDF<br/>Compressor</span>
                  </button>

                </div>
                <div className="ribbon-group-label">23 PDF Tools</div>
              </div>

              {/* 3. Group: 23 PDF Convert */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('text')}
                    title="Trích toàn bộ chữ của tệp PDF ra tệp văn bản (.txt)"
                  >
                    <FileText size={20} color="#dc2626" />
                    <span>PDF to<br/>Text</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={handleImageOnlyPdf}
                    title="Tải xuống bản PDF mà mỗi trang là một ảnh, không còn lớp chữ để chọn hay sao chép"
                  >
                    <ImageIcon size={20} color="#475569" />
                    <span>To Image-<br/>only PDF</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('image')}
                    title="Xuất từng trang PDF thành hình ảnh PNG/JPG sắc nét"
                  >
                    <ImageIcon size={20} color="#059669" />
                    <span>PDF to<br/>Picture</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowOcrModal(true)}
                    title="Nhận dạng chữ quang học OCR từ tài liệu scan"
                  >
                    <ScanText size={20} color="#7c3aed" />
                    <span>OCR<br/>PDF</span>
                  </button>
                </div>
                <div className="ribbon-group-label">23 PDF Convert</div>
              </div>

              {/* 4. Group: Settings */}
              <div className="ribbon-section">
                <div className="ribbon-controls" style={{ padding: '0 8px' }}>
                  <label title="Giữ tiêu đề, tác giả và ngày sửa gốc của tệp khi ký, ghép, cắt, nén hoặc tách" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={keepAttributes}
                      onChange={(e) => setKeepAttributes(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Keep Document<br/>Attributes</span>
                  </label>
                </div>
                <div className="ribbon-group-label">Settings</div>
              </div>
            </>
          )}

          {activeTab === 'file' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <label className="ribbon-btn-large" title="Mở một tệp PDF từ máy vào tài liệu này">
                    <FolderOpen size={20} color="#d97706" />
                    <span className="pdf-ribbon-label">Mở tệp PDF</span>
                    <input type="file" accept=".pdf,application/pdf" hidden onChange={(e) => void handleUploadLocalPdf(e)} />
                  </label>
                  <button className="ribbon-btn-large" onClick={handleSaveNow} title="Lưu tài liệu (Ctrl+S)">
                    <Save size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Lưu</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleExportPdf} title="Tải tệp PDF về máy">
                    <Download size={20} color="#dc2626" />
                    <span className="pdf-ribbon-label">Tải xuống</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={openPrint} title="In tài liệu (Ctrl+P)">
                    <Printer size={20} color="#475569" />
                    <span className="pdf-ribbon-label">In</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowShareModal(true)} title="Gửi tệp PDF qua bảng chia sẻ của hệ thống">
                    <Share2 size={20} color="#0284c7" />
                    <span className="pdf-ribbon-label">Chia sẻ</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Tệp</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handleOpenHistory} title="Xem và xoá các phiên bản đã lưu">
                    <History size={20} color="#7c3aed" />
                    <span className="pdf-ribbon-label">Lịch sử phiên bản</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleCreateSnapshot} title="Lưu một bản chụp của tài liệu vào lịch sử">
                    <Camera size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Lưu bản chụp</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={openProperties} title="Sửa tiêu đề, tác giả, chủ đề và từ khoá lưu trong tệp PDF">
                    <Info size={20} color="#0f766e" />
                    <span className="pdf-ribbon-label">Thuộc tính</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Thông tin</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={closeDocument} title="Lưu và quay lại danh sách tệp">
                    <X size={20} color="#64748b" />
                    <span className="pdf-ribbon-label">Đóng</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Đóng</div>
              </div>
            </>
          )}

          {activeTab === 'home' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handleSaveNow} title="Lưu tài liệu (Ctrl+S)">
                    <Save size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Lưu</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={openPrint} title="In tài liệu (Ctrl+P)">
                    <Printer size={20} color="#475569" />
                    <span className="pdf-ribbon-label">In</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => void handleCopyPageText()} title="Sao chép toàn bộ chữ của trang đang xem vào bộ nhớ tạm">
                    <Copy size={20} color="#0284c7" />
                    <span className="pdf-ribbon-label">Sao chép chữ trang</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Tài liệu</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button className="ribbon-btn-small" disabled={currentPage <= 1} onClick={() => goToPage(1)} title="Trang đầu (Alt+Home)">
                        <ChevronsLeft size={15} />
                      </button>
                      <button className="ribbon-btn-small" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)} title="Trang trước">
                        <ChevronLeft size={15} />
                      </button>
                      <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 52, textAlign: 'center' }}>{currentPage} / {totalPages}</span>
                      <button className="ribbon-btn-small" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)} title="Trang sau">
                        <ChevronRight size={15} />
                      </button>
                      <button className="ribbon-btn-small" disabled={currentPage >= totalPages} onClick={() => goToPage(totalPages)} title="Trang cuối (Alt+End)">
                        <ChevronsRight size={15} />
                      </button>
                    </div>
                    <div className="ribbon-row">
                      <input
                        className="ribbon-select"
                        style={{ width: 72, cursor: 'text' }}
                        inputMode="numeric"
                        placeholder="Đến trang"
                        aria-label="Đến trang"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePageJump(); }}
                      />
                      <button className="btn" style={{ height: 24, padding: '0 8px', fontSize: 11.5 }} disabled={!pageInput} onClick={handlePageJump}>
                        Đi
                      </button>
                    </div>
                  </div>
                </div>
                <div className="ribbon-group-label">Trang</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button className="ribbon-btn-small" onClick={zoomOut} title="Thu nhỏ (Ctrl+-)">
                        <ZoomOut size={15} />
                      </button>
                      <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
                      <button className="ribbon-btn-small" onClick={zoomIn} title="Phóng to (Ctrl+=)">
                        <ZoomIn size={15} />
                      </button>
                    </div>
                    <div className="ribbon-row">
                      <button className={`ribbon-btn-small ${zoomSetting === null ? 'active' : ''}`} onClick={fitWidth} title="Vừa chiều rộng khung (Ctrl+0)">
                        <MoveHorizontal size={15} />
                      </button>
                      <button className={`ribbon-btn-small ${zoomSetting === 100 ? 'active' : ''}`} onClick={actualSize} title="Kích thước thật 100%">
                        <RectangleHorizontal size={15} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => setRotation((r) => (r + 270) % 360)} title="Xoay hướng xem sang trái">
                        <RotateCcw size={15} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => setRotation((r) => (r + 90) % 360)} title="Xoay hướng xem sang phải">
                        <RotateCw size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="ribbon-group-label">Thu phóng</div>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={openSignModal} title="Ký tay rồi chèn chữ ký vào trang PDF">
                    <FileSignature size={20} color="#475569" />
                    <span className="pdf-ribbon-label">Chữ ký</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleInsertBlankPage} title="Chèn một trang trống ngay sau trang đang xem">
                    <FilePlus size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Trang trống</span>
                  </button>
                  <label className="ribbon-btn-large" title="Chèn ảnh PNG, JPG hoặc WebP thành một trang mới sau trang đang xem">
                    <ImagePlus size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Ảnh thành trang</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleInsertImagePage} />
                  </label>
                  <button className="ribbon-btn-large" onClick={() => setShowMergeModal(true)} title="Thêm các trang từ tệp PDF khác vào cuối tài liệu">
                    <Layers size={20} color="#7c3aed" />
                    <span className="pdf-ribbon-label">Trang từ tệp PDF</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Trang</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => { if (requireBytes()) setShowPageNumberModal(true); }} title="Đánh số lên mọi trang của tệp PDF">
                    <Hash size={20} color="#d97706" />
                    <span className="pdf-ribbon-label">Số trang</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={openCommentComposer} title="Thêm ghi chú cho tài liệu">
                    <StickyNote size={20} color="#ca8a04" />
                    <span className="pdf-ribbon-label">Ghi chú</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Đánh dấu</div>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className={`ribbon-btn-large ${zoomSetting === null ? 'active' : ''}`} onClick={fitWidth} title="Vừa chiều rộng khung (Ctrl+0)">
                    <MoveHorizontal size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Vừa chiều rộng</span>
                  </button>
                  <button className={`ribbon-btn-large ${zoomSetting === 100 ? 'active' : ''}`} onClick={actualSize} title="Kích thước thật 100%">
                    <RectangleHorizontal size={20} color="#475569" />
                    <span className="pdf-ribbon-label">Kích thước thật</span>
                  </button>
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button className="ribbon-btn-small" onClick={zoomOut} title="Thu nhỏ (Ctrl+-)">
                        <ZoomOut size={15} />
                      </button>
                      <span style={{ fontSize: 11.5, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
                      <button className="ribbon-btn-small" onClick={zoomIn} title="Phóng to (Ctrl+=)">
                        <ZoomIn size={15} />
                      </button>
                    </div>
                    <div className="ribbon-row">
                      <select
                        className="ribbon-select"
                        aria-label="Mức thu phóng"
                        value={zoomSetting === null ? 'fit' : String(zoomSetting)}
                        onChange={(e) => (e.target.value === 'fit' ? fitWidth() : setZoomSetting(Number(e.target.value)))}
                      >
                        <option value="fit">Vừa khung</option>
                        {[50, 75, 100, 125, 150, 200].map((value) => (
                          <option key={value} value={value}>{value}%</option>
                        ))}
                        {zoomSetting !== null && ![50, 75, 100, 125, 150, 200].includes(zoomSetting) && <option value={zoomSetting}>{zoomSetting}%</option>}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="ribbon-group-label">Thu phóng</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setRotation((r) => (r + 270) % 360)} title="Xoay hướng xem sang trái, không đổi tệp">
                    <RotateCcw size={20} color="#475569" />
                    <span className="pdf-ribbon-label">Xoay trái</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setRotation((r) => (r + 90) % 360)} title="Xoay hướng xem sang phải, không đổi tệp">
                    <RotateCw size={20} color="#475569" />
                    <span className="pdf-ribbon-label">Xoay phải</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Hướng xem</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className={`ribbon-btn-large ${showThumbs ? 'active' : ''}`} onClick={() => setShowThumbs((value) => !value)} title="Ẩn hoặc hiện bảng trang thu nhỏ bên trái">
                    <PanelLeft size={20} color="#0284c7" />
                    <span className="pdf-ribbon-label">Trang thu nhỏ</span>
                  </button>
                  <button className={`ribbon-btn-large ${showComments ? 'active' : ''}`} onClick={() => setShowComments((value) => !value)} title="Ẩn hoặc hiện bảng ghi chú bên phải">
                    <MessageSquare size={20} color="#ca8a04" />
                    <span className="pdf-ribbon-label">Bảng ghi chú</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Hiển thị</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowPlayModal(true)} title="Trình chiếu từng trang toàn màn hình">
                    <Play size={20} color="#dc2626" />
                    <span className="pdf-ribbon-label">Trình chiếu</span>
                  </button>
                  <button className={`ribbon-btn-large ${isFullscreen ? 'active' : ''}`} onClick={() => void toggleFullscreen()} title="Xem trình soạn PDF toàn màn hình (Esc để thoát)">
                    <Maximize size={20} color="#475569" />
                    <span className="pdf-ribbon-label">{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Chế độ xem</div>
              </div>
            </>
          )}

          {activeTab === 'tools' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => openPageOp('rotate')} title="Xoay trang và lưu hướng mới vào tệp PDF">
                    <RotateCw size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Xoay trang</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => openPageOp('delete')} title="Xoá các trang khỏi tệp PDF">
                    <FileMinus size={20} color="#dc2626" />
                    <span className="pdf-ribbon-label">Xoá trang</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={openExtractPages} title="Trích các trang ra tệp PDF riêng">
                    <FileOutput size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Trích trang</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleInsertBlankPage} title="Chèn một trang trống ngay sau trang đang xem">
                    <FilePlus size={20} color="#7c3aed" />
                    <span className="pdf-ribbon-label">Trang trống</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Sắp xếp trang</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowMergeModal(true)} title="Ghép nhiều tệp PDF vào tài liệu này">
                    <Layers size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Ghép tệp</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowCropModal(true)} title="Cắt lề trang PDF">
                    <Crop size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Cắt lề</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowCompressModal(true)} title="Nén giảm dung lượng tệp PDF">
                    <Minimize2 size={20} color="#d97706" />
                    <span className="pdf-ribbon-label">Nén tệp</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Xử lý tệp</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowOcrModal(true)} title="Nhận dạng chữ từ tài liệu scan">
                    <ScanText size={20} color="#7c3aed" />
                    <span className="pdf-ribbon-label">OCR</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowConvertModal('text')} title="Trích chữ của tệp PDF ra tệp .txt">
                    <FileText size={20} color="#dc2626" />
                    <span className="pdf-ribbon-label">Ra văn bản</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowConvertModal('image')} title="Xuất từng trang thành ảnh PNG hoặc JPG">
                    <ImageIcon size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Ra ảnh</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Chuyển đổi</div>
              </div>
            </>
          )}

          {activeTab === 'help' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setHelpModal('shortcuts')} title="Xem các phím tắt của trình soạn PDF">
                    <Keyboard size={20} color="#2563eb" />
                    <span className="pdf-ribbon-label">Phím tắt</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setHelpModal('guide')} title="Xem mỗi tab dùng để làm gì">
                    <BookOpen size={20} color="#059669" />
                    <span className="pdf-ribbon-label">Hướng dẫn</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Trợ giúp</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace: PDF Canvas Viewer */}
      <div className="pdf-workspace">
        {/* Left Thumbnails Strip */}
        {showThumbs && (
          <div className="pdf-thumbs" ref={setThumbStrip}>
            {pdfState.status === 'ready' ? pdfState.sizes.map((_, idx) => (
              <PdfThumb
                key={idx}
                doc={pdfState.doc}
                pageNumber={idx + 1}
                rotation={rotation}
                root={thumbStrip}
                active={currentPage === idx + 1}
                cache={thumbCache}
                onSelect={goToPage}
              />
            )) : !hasRealPdf && Array.from({ length: totalPages }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: 100,
                  height: 140,
                  background: '#fafbfc',
                  border: currentPage === idx + 1 ? '2px solid #dc2626' : '1px solid #cbd5e1',
                  borderRadius: 4,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 6,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => goToPage(idx + 1)}
              >
                <>
                  <div style={{ width: '100%', height: 4, background: '#e2e8f0', borderRadius: 2 }} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Trang {idx + 1}</div>
                  <div style={{ width: '80%', height: 4, background: '#e2e8f0', borderRadius: 2 }} />
                </>
              </div>
            ))}
          </div>
        )}

        {/* Center Canvas */}
        <div className="pdf-canvas" ref={setPdfCanvas}>
          {hasRealPdf ? (
            pdfState.status === 'ready' ? (
              <PdfPageScroller
                doc={pdfState.doc}
                sizes={pdfState.sizes}
                zoom={zoom}
                rotation={rotation}
                root={pdfCanvas}
                title={title}
                register={pageNav.register}
              />
            ) : (
              <div className="pdf-page pdf-page-real" style={{ width: PDF_PAGE_WIDTH * (zoom / 100), height: PDF_PAGE_HEIGHT * (zoom / 100) }}>
                {pdfState.status === 'error' ? (
                  <div className="pdf-page-status pdf-page-status-error">
                    Không đọc được nội dung tệp PDF này. Tệp gốc vẫn được giữ nguyên; bấm "Tải xuống PDF" để mở bằng ứng dụng khác.
                  </div>
                ) : (
                  <div className="pdf-page-status">Đang mở tệp PDF…</div>
                )}
              </div>
            )
          ) : (
          <div
            ref={pageRef}
            className="pdf-page"
            style={{
              width: PDF_PAGE_WIDTH * (zoom / 100),
              minHeight: PDF_PAGE_HEIGHT * (zoom / 100),
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {/* Header of PDF */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #dc2626', paddingBottom: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                Độc lập – Tự do – Hạnh phúc
              </div>
              <h1 style={{ fontSize: 18, color: '#0f172a', fontWeight: 800, marginTop: 14 }}>
                {title.replace(/\.[^/.]+$/, '')}
              </h1>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Trang {currentPage} / {totalPages} · Ngày lập: {new Date().toLocaleDateString('vi-VN')}
              </div>
            </div>

            {/* Document Body */}
            <div style={{ fontSize: 13, lineHeight: 1.8, color: '#1e293b' }}>
              <p>
                <strong>Kính gửi:</strong> Ban Giám đốc và các đơn vị phòng ban liên quan.
              </p>
              <p>
                Căn cứ theo kế hoạch phát triển giải pháp văn phòng số nội bộ <strong>Office 23</strong>, văn bản PDF này đã được biên soạn, kiểm duyệt và đóng dấu chữ ký điện tử an toàn tuyệt đối.
              </p>
              <div style={{ background: '#f8fafc', borderLeft: '3px solid #dc2626', padding: '10px 14px', margin: '16px 0', borderRadius: 4 }}>
                <strong>Điều khoản xác thực bảo mật:</strong>
                <br />
                Toàn bộ dữ liệu được mã hoá theo chuẩn ECMA-376 và bảo vệ an toàn 100% tại máy trạm, không truyền ra ngoài hệ thống mạng bên thứ ba.
              </div>
              <p>
                Bản sao điện tử này có giá trị xác nhận và có thể chuyển đổi linh hoạt sang tài liệu <strong>23 Docs (.docx)</strong> hoặc bảng tính <strong>23 Sheets (.xlsx)</strong> mà không làm sai lệch cấu trúc dữ liệu ban đầu.
              </p>
            </div>

            {/* Signature stamp area */}
            <div style={{ position: 'absolute', bottom: 60, right: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>ĐẠI DIỆN OFFICE 23</div>
              <div
                style={{
                  width: 120,
                  height: 60,
                  border: '1.5px dashed #dc2626',
                  borderRadius: 8,
                  margin: '8px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(220, 38, 38, 0.04)',
                }}
              >
                ✔ ĐÃ KÝ SỐ
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{currentAuthorName()}</div>
            </div>
          </div>
          )}
        </div>

        {/* Floating Bottom Toolbar for Zoom and Page Nav */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: 30,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            color: '#ffffff',
            zIndex: 10,
          }}
        >
          <button
            className="icon-btn"
            style={{ color: '#fff' }}
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            title="Trang trước"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            className="icon-btn"
            style={{ color: '#fff' }}
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            title="Trang sau"
          >
            <ChevronRight size={16} />
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />

          <button className="icon-btn" style={{ color: '#fff' }} onClick={zoomOut} title="Thu nhỏ (Ctrl+-)">
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: 11 }}>{zoom}%</span>
          <button className="icon-btn" style={{ color: '#fff' }} onClick={zoomIn} title="Phóng to (Ctrl+=)">
            <ZoomIn size={15} />
          </button>

          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setRotation((r) => (r + 90) % 360)} title="Xoay 90°">
            <RotateCw size={15} />
          </button>
        </div>

        {/* Comments Drawer */}
        {showComments && (
          <aside className="doc-comments">
            <div className="comments-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={16} color="#dc2626" />
                <strong style={{ fontSize: 13 }}>Ghi chú tài liệu PDF</strong>
              </div>
              <button className="icon-btn" onClick={() => setShowComments(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
              <textarea
                ref={commentInputRef}
                className="text-field"
                rows={2}
                placeholder="Nhập ghi chú cho trang PDF này…"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ fontSize: 12, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  style={{ background: '#dc2626', color: '#fff', fontSize: 11, padding: '3px 10px' }}
                  onClick={handleAddComment}
                >
                  Thêm ghi chú
                </button>
              </div>
            </div>

            <div className="comments-list">
              {comments.map((c) => (
                <div key={c.id} className="comment-card">
                  <div className="comment-meta">
                    <strong>{c.author}</strong>
                    <span className="comment-time">
                      {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="comment-text">{c.text}</div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* MODAL 1: Sign Modal */}
      {showSignModal && (
        <div className="dialog-backdrop" onClick={() => setShowSignModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={20} color="#dc2626" />
                <h2>Chèn chữ ký tay vào PDF</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowSignModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#fafbfc', marginBottom: 12 }}>
              <canvas
                ref={signCanvasRef}
                width={480}
                height={160}
                style={{ display: 'block', cursor: 'crosshair', width: '100%', touchAction: 'none' }}
                onPointerDown={(e) => {
                  const ctx = signCanvasRef.current?.getContext('2d');
                  if (!ctx) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isDrawingRef.current = true;
                  const point = signPoint(e);
                  ctx.strokeStyle = '#0f172a';
                  ctx.lineWidth = 2.5;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.beginPath();
                  ctx.moveTo(point.x, point.y);
                }}
                onPointerMove={(e) => {
                  if (!isDrawingRef.current) return;
                  const ctx = signCanvasRef.current?.getContext('2d');
                  if (!ctx) return;
                  const point = signPoint(e);
                  ctx.lineTo(point.x, point.y);
                  ctx.stroke();
                  if (!signHasInk) setSignHasInk(true);
                }}
                onPointerUp={() => { isDrawingRef.current = false; }}
                onPointerCancel={() => { isDrawingRef.current = false; }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Trang</span>
                <input className="text-field" type="number" min={1} max={totalPages} value={signPage} onChange={(e) => setSignPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Vị trí</span>
                <select className="text-field" value={signAnchor} onChange={(e) => setSignAnchor(e.target.value as SignatureAnchor)}>
                  {SIGN_ANCHORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Độ rộng: {signWidth}% trang</span>
                <input type="range" min={10} max={60} step={5} value={signWidth} onChange={(e) => setSignWidth(Number(e.target.value))} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn" onClick={clearSignature}>
                Xoá nét vẽ
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setShowSignModal(false)}>
                  Huỷ
                </button>
                <button
                  className="btn"
                  style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
                  disabled={!signHasInk || !hasRealPdf}
                  onClick={handleInsertSignature}
                >
                  <Check size={14} />
                  <span>Chèn chữ ký</span>
                </button>
              </div>
            </div>
            {!hasRealPdf && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{NO_PDF_MESSAGE}</div>}
          </div>
        </div>
      )}

      {/* MODAL 2: Split Modal */}
      {showSplitModal && (
        <div className="dialog-backdrop" onClick={() => setShowSplitModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Tách trang PDF (PDF Split)</h2>
              <button className="icon-btn" onClick={() => setShowSplitModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Nhập các dải trang, mỗi dải thành một tệp PDF riêng (tệp có {totalPages} trang). Nhiều tệp sẽ được gom vào một tệp .zip.
            </p>
            <input
              className="text-field"
              value={splitInput}
              placeholder={totalPages > 1 ? `Ví dụ: 1-${Math.ceil(totalPages / 2)}, ${Math.ceil(totalPages / 2) + 1}-${totalPages}` : 'Ví dụ: 1'}
              onChange={(e) => setSplitInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSplit(); }}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowSplitModal(false)}>
                Huỷ
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!hasRealPdf || !splitInput.trim()} onClick={handleSplit}>
                Tách và tải xuống
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Merge Modal */}
      {showMergeModal && (
        <div className="dialog-backdrop" onClick={() => setShowMergeModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Ghép nối tệp PDF (PDF Merge)</h2>
              <button className="icon-btn" onClick={() => setShowMergeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              {hasRealPdf ? 'Các trang của tệp được chọn sẽ được nối vào sau tài liệu hiện tại, theo thứ tự bên dưới.' : 'Các tệp được chọn sẽ được ghép thành tài liệu này, theo thứ tự bên dưới.'}
            </p>
            <label
              style={{
                display: 'block',
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '22px 16px',
                textAlign: 'center',
                background: '#fafbfc',
                marginBottom: 12,
                cursor: 'pointer',
              }}
            >
              <Layers size={32} color="#64748b" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Bấm để chọn các tệp PDF cần ghép</div>
              <input type="file" accept=".pdf,application/pdf" multiple hidden onChange={handlePickMergeFiles} />
            </label>
            {mergeFiles.length > 0 && (
              <ol style={{ fontSize: 12.5, margin: '0 0 14px', paddingLeft: 0, listStyle: 'none', maxHeight: 160, overflowY: 'auto' }}>
                {mergeFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {file.name} · {formatBytes(file.size)}</span>
                    <button className="icon-btn" title="Bỏ tệp này" onClick={() => setMergeFiles((prev) => prev.filter((_, i) => i !== index))}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => { setMergeFiles([]); setShowMergeModal(false); }}>
                Huỷ
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={mergeFiles.length === 0} onClick={handleMerge}>
                Ghép tệp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Compress Modal */}
      {showCompressModal && (
        <div className="dialog-backdrop" onClick={() => setShowCompressModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Nén dung lượng PDF (Compressor)</h2>
              <button className="icon-btn" onClick={() => setShowCompressModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
              Lưu lại cấu trúc tệp ở dạng gọn hơn (object stream). Ảnh bên trong không bị nén lại nên chất lượng giữ nguyên; mức giảm tuỳ từng tệp và có thể bằng 0.
              {currentPdfSize !== null ? ` Kích thước hiện tại: ${formatBytes(currentPdfSize)}.` : ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowCompressModal(false)}>
                Huỷ
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!hasRealPdf} onClick={handleCompress}>
                Tiến hành nén
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Convert Modal */}
      {showConvertModal && (
        <div className="dialog-backdrop" onClick={() => setShowConvertModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>{showConvertModal === 'text' ? 'Xuất chữ trong PDF ra tệp .txt' : 'Xuất trang PDF thành ảnh'}</h2>
              <button className="icon-btn" onClick={() => setShowConvertModal(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              {showConvertModal === 'text'
                ? `Lấy lớp chữ của cả ${totalPages} trang trong tệp ${title}. Bố cục, bảng và hình không được giữ; trang scan không có lớp chữ sẽ để trống.`
                : `Mỗi trang trong ${totalPages} trang thành một ảnh. Nhiều trang sẽ được gom vào một tệp .zip.`}
            </p>
            {showConvertModal === 'image' && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span>Định dạng</span>
                  <select className="text-field" value={rasterFormat} onChange={(e) => setRasterFormat(e.target.value as 'png' | 'jpeg')}>
                    <option value="png">PNG (nét, tệp lớn)</option>
                    <option value="jpeg">JPG (nhẹ hơn)</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span>Độ phân giải</span>
                  <select className="text-field" value={rasterDpi} onChange={(e) => setRasterDpi(Number(e.target.value))}>
                    {RASTER_DPI_OPTIONS.map((dpi) => <option key={dpi} value={dpi}>{dpi} dpi</option>)}
                  </select>
                </label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowConvertModal(null)}>
                Huỷ
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!hasRealPdf} onClick={() => handleConvert(showConvertModal)}>
                Xuất và tải xuống
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: OCR Modal */}
      {showOcrModal && (
        <div className="dialog-backdrop" onClick={() => setShowOcrModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScanText size={20} color="#7c3aed" />
                <h2>Nhận diện văn bản quang học OCR (Tiếng Việt)</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowOcrModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
              Trích xuất toàn bộ ký tự từ hình ảnh trang quét sang văn bản có thể chỉnh sửa:
            </p>
            <div
              style={{
                background: '#fafbfc',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 14,
                fontSize: 12.5,
                lineHeight: 1.6,
                maxHeight: '40vh',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                marginBottom: 16,
              }}
            >
              {ocrText || (hasRealPdf && realPageText === null
                ? 'Đang đọc chữ trên trang…'
                : 'Trang này là ảnh chụp hoặc bản quét, chưa có lớp chữ để trích xuất.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="btn"
                disabled={!ocrText}
                onClick={() => {
                  void navigator.clipboard.writeText(ocrText);
                  ui.toast('Đã sao chép văn bản vào clipboard');
                }}
              >
                Sao chép văn bản
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={() => setShowOcrModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Crop Modal */}
      {showCropModal && (
        <div className="dialog-backdrop" onClick={() => setShowCropModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Cắt xén lề trang (Crop Pages)</h2>
              <button className="icon-btn" onClick={() => setShowCropModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Nhập lề cần cắt bỏ (mm), tính theo hướng trang đang hiển thị. Phần bị cắt được ẩn khỏi trang khi xem và in.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, fontSize: 12 }}>
              {([['top', 'trên'], ['bottom', 'dưới'], ['left', 'trái'], ['right', 'phải']] as const).map(([side, label]) => (
                <label key={side} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Lề {label} (mm)</span>
                  <input
                    className="text-field"
                    type="number"
                    min={0}
                    step={1}
                    value={cropMm[side]}
                    onChange={(e) => setCropMm((prev) => ({ ...prev, [side]: Math.max(0, Number(e.target.value) || 0) }))}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12.5, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="cropScope" checked={cropScope === 'all'} onChange={() => setCropScope('all')} />
                Mọi trang
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="cropScope" checked={cropScope === 'current'} onChange={() => setCropScope('current')} />
                Chỉ trang {currentPage}
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowCropModal(false)}>
                Huỷ
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!hasRealPdf} onClick={handleCrop}>
                Áp dụng cắt lề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Play Presentation Modal */}
      {showPlayModal && (
        <div
          className="dialog-backdrop"
          onClick={() => setShowPlayModal(false)}
          style={{ background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
        >
          <button
            className="icon-btn"
            style={{ position: 'absolute', top: 16, right: 16, color: '#fff' }}
            onClick={() => setShowPlayModal(false)}
            title="Thoát trình chiếu"
          >
            <X size={20} />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            {pdfState.status === 'ready' && pdfState.sizes[currentPage - 1] ? (
              <PdfPlayPage
                doc={pdfState.doc}
                pageNumber={currentPage}
                width={pdfState.sizes[currentPage - 1].width}
                height={pdfState.sizes[currentPage - 1].height}
                rotation={rotation}
              />
            ) : (
              <div style={{ color: '#fff', fontSize: 15 }}>{pdfState.status === 'loading' ? 'Đang mở tệp PDF…' : NO_PDF_MESSAGE}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#fff' }} onClick={(e) => e.stopPropagation()}>
            <button className="btn" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              Trang trước
            </button>
            <span>Trang {currentPage} / {totalPages}</span>
            <button className="btn" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
              Trang tiếp theo
            </button>
          </div>
        </div>
      )}

      {/* MODAL 9: Share Modal */}
      {showShareModal && (
        <div className="dialog-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={20} color="#dc2626" />
                <h2>Gửi tệp PDF</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {!hasRealPdf
                ? NO_PDF_MESSAGE
                : canShareFile
                  ? 'Đưa tệp lên nhóm để thành viên mở bản sao, gửi thẳng qua bảng chia sẻ của hệ thống, hoặc tải tệp xuống rồi đính kèm.'
                  : 'Đưa tệp lên nhóm để thành viên mở bản sao, hoặc tải tệp xuống rồi đính kèm khi gửi qua Zalo, email, Drive.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowShareModal(false)}>
                Đóng
              </button>
              {isShareableFileId(meta.id) && (
                <button className="btn" disabled={!hasRealPdf} onClick={() => { setShowShareModal(false); void persistPdf(false).then(() => requestTeamShare({ fileId: meta.id, kind: 'pdf' })); }}>
                  <TeamUsers size={13} />
                  <span>Chia sẻ với nhóm</span>
                </button>
              )}
              <button className="btn" disabled={!hasRealPdf} onClick={() => { handleExportPdf(); setShowShareModal(false); }}>
                <Download size={13} />
                <span>Tải tệp xuống</span>
              </button>
              {canShareFile && (
                <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={() => void handleSystemShare()}>
                  <Share size={13} />
                  <span>Gửi tệp…</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: Version History Modal */}
      {showHistoryModal && (
        <div className="dialog-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Lịch sử phiên bản PDF</h2>
              <button className="icon-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleCreateSnapshot}>
                Lưu bản chụp hiện tại
              </button>
            </div>
            <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 12 }}>
                  Chưa có phiên bản lưu nào.
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {new Date(v.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => handleDeleteVersion(v.id)} title="Xoá">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setShowHistoryModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {pageOp && (
        <div className="dialog-backdrop" onClick={() => setPageOp(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>{pageOp === 'rotate' ? 'Xoay trang PDF' : 'Xoá trang PDF'}</h2>
              <button className="icon-btn" onClick={() => setPageOp(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              {`Nhập trang hoặc dải trang (tệp có ${totalPages} trang), ví dụ: 1, 3-5.`}
            </p>
            <input
              className="text-field"
              value={pageOpRange}
              onChange={(e) => setPageOpRange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handlePageOp(); }}
              style={{ marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <button className="btn" onClick={() => setPageOpRange(String(currentPage))}>Trang đang xem</button>
              <button className="btn" onClick={() => setPageOpRange(totalPages > 1 ? `1-${totalPages}` : '1')}>Tất cả trang</button>
            </div>
            {pageOp === 'rotate' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[{ value: 270, label: 'Trái 90°' }, { value: 90, label: 'Phải 90°' }, { value: 180, label: '180°' }].map((option) => (
                  <button
                    key={option.value}
                    className="btn"
                    style={pageOpAngle === option.value ? { background: '#dc2626', color: '#fff', borderColor: '#b91c1c' } : undefined}
                    onClick={() => setPageOpAngle(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setPageOp(null)}>Huỷ</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} disabled={!pageOpRange.trim()} onClick={() => void handlePageOp()}>
                {pageOp === 'rotate' ? 'Xoay trang' : 'Xoá trang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPageNumberModal && (
        <div className="dialog-backdrop" onClick={() => setShowPageNumberModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Đánh số trang</h2>
              <button className="icon-btn" onClick={() => setShowPageNumberModal(false)}>
                <X size={18} />
              </button>
            </div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Vị trí</label>
            <select className="text-field" value={pageNumberPosition} onChange={(e) => setPageNumberPosition(e.target.value as PageNumberPosition)} style={{ marginBottom: 12 }}>
              {PAGE_NUMBER_POSITIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Kiểu số</label>
            <select className="text-field" value={pageNumberFormat} onChange={(e) => setPageNumberFormat(e.target.value as PageNumberFormat)} style={{ marginBottom: 16 }}>
              <option value="of-total">1 / {totalPages}</option>
              <option value="number">1</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowPageNumberModal(false)}>Huỷ</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleAddPageNumbers}>{`Đánh số ${totalPages} trang`}</button>
            </div>
          </div>
        </div>
      )}

      {properties && (
        <div className="dialog-backdrop" onClick={() => setProperties(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>Thuộc tính tài liệu</h2>
              <button className="icon-btn" onClick={() => setProperties(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
              <span>Số trang</span><strong>{totalPages}</strong>
              {currentPdfSize !== null && (<><span>Dung lượng</span><strong>{formatBytes(currentPdfSize)}</strong></>)}
              {pdfState.status === 'ready' && pdfState.sizes[currentPage - 1] && (
                <>
                  <span>{`Khổ trang ${currentPage}`}</span>
                  <strong>{Math.round((pdfState.sizes[currentPage - 1].width * 25.4) / 72)} × {Math.round((pdfState.sizes[currentPage - 1].height * 25.4) / 72)} mm</strong>
                </>
              )}
            </div>
            {([
              { key: 'title', label: 'Tiêu đề' },
              { key: 'author', label: 'Tác giả' },
              { key: 'subject', label: 'Chủ đề' },
              { key: 'keywords', label: 'Từ khoá (cách nhau bằng dấu phẩy)' },
            ] as const).map((field) => (
              <div key={field.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{field.label}</label>
                <input
                  className="text-field"
                  value={properties[field.key]}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProperties((prev) => (prev ? { ...prev, [field.key]: value } : prev));
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button className="btn" onClick={() => setProperties(null)}>Huỷ</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleSaveProperties}>Lưu thuộc tính</button>
            </div>
          </div>
        </div>
      )}

      {helpModal && (
        <div className="dialog-backdrop" onClick={() => setHelpModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2>{helpModal === 'shortcuts' ? 'Phím tắt trình soạn PDF' : 'Hướng dẫn các tab'}</h2>
              <button className="icon-btn" onClick={() => setHelpModal(null)}>
                <X size={18} />
              </button>
            </div>
            {helpModal === 'shortcuts' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {PDF_SHORTCUTS.map((item) => (
                    <tr key={item.keys} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '7px 0', width: 130 }}><kbd>{item.keys}</kbd></td>
                      <td style={{ padding: '7px 0' }}>{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PDF_TAB_GUIDE.map((item) => (
                  <div key={item.tab} style={{ fontSize: 13 }}>
                    <strong>{item.tab}</strong>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setHelpModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
