import { useWorkspace } from '../../lib/storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Crop,
  Download,
  Eraser,
  Eye,
  FileCheck,
  FilePlus2,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Hash,
  HelpCircle,
  Highlighter,
  History,
  Image as ImageIcon,
  Info,
  Layers,
  Maximize2,
  MessageSquare,
  Minimize2,
  Minus,
  MousePointer,
  PenTool,
  Play,
  Plus,
  Presentation,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  ScanText,
  Search,
  Share2,
  Shield,
  Split,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import {
  defaultPage,
  type CommentItem,
  type DocContent,
  type FileContent,
  type FileMeta,
  type FileVersion,
  type PdfAnnotationItem,
  type PdfAnnotationKind,
  type PdfContent,
  type SheetContent,
} from '../../lib/storage';
import {
  bakeAnnotationsIntoPdf,
  buildWorkbookFromTables,
  bytesToDataUrl,
  compressOrRasterizePdf,
  convertPdfToDocxJson,
  convertPdfToSlideDeckHtml,
  createBlankPdfDocument,
  createCorporateSamplePdf,
  cropPdfPages,
  dataUrlToBytes,
  deletePdfPage,
  duplicatePdfPage,
  extractPdfTextAndTables,
  insertBlankPdfPage,
  loadPdfDocumentProxy,
  disposePdfDocumentProxy,
  mergePdfBuffers,
  renderPdfPageToCanvas,
  renderPdfPageToPngBlob,
  renderRedCorporateStampPng,
  rotatePdfPages,
  splitPdfByRanges,
  stampPageNumbersOnPdf,
  type ExtractedPdfBundle,
} from '../../lib/pdfEngine';
import { exportDocx } from '../../lib/docxConvert';
import { exportWorkbookToXlsx } from '../../lib/xlsxConvert';
import { downloadBlob, formatBytes, readAsDataUrl } from '../../lib/download';
import { useUi } from '../../components/ui';

interface PdfEditorProps {
  meta: FileMeta;
  content: PdfContent;
  onSave: (meta: FileMeta, content: PdfContent) => void;
  onRename: (name: string) => void;
  onBack: () => void;
  onOpenWorkspaceFile?: (meta: FileMeta, content: FileContent) => void;
}

type PdfRibbonTab = 'file' | 'home' | 'minh_pdf' | 'insert' | 'view' | 'tools' | 'help';
type ActivePdfTool = 'select' | PdfAnnotationKind;

function PdfThumbnailCanvas({
  pdfProxy,
  pageNumber,
}: {
  pdfProxy: PDFDocumentProxy;
  pageNumber: number;
}) {
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    let active = true;
    renderPdfPageToCanvas(pdfProxy, pageNumber, el, 0.22).catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [pdfProxy, pageNumber]);

  return (
    <canvas
      ref={thumbRef}
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
        borderRadius: 3,
        background: '#ffffff',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.14)',
      }}
    />
  );
}

export default function PdfEditor({
  meta,
  content,
  onSave,
  onRename,
  onBack,
  onOpenWorkspaceFile,
}: PdfEditorProps) {
  const ui = useUi();
  const { listFiles, loadContent, saveFile, listVersions, saveVersion, restoreVersion, deleteVersion } =
    useWorkspace();

  const [activeTab, setActiveTab] = useState<PdfRibbonTab>('minh_pdf');
  const [title, setTitle] = useState(meta.name);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [keepAttributes, setKeepAttributes] = useState(true);

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(() =>
    content.pdfDataUrl ? dataUrlToBytes(content.pdfDataUrl) : null
  );
  const [pdfProxy, setPdfProxy] = useState<PDFDocumentProxy | null>(null);
  const [extractedPages, setExtractedPages] = useState<string[]>(content.extractedPages ?? []);
  const [extractedTables, setExtractedTables] = useState<string[][][]>([]);
  const [docInfo, setDocInfo] = useState<ExtractedPdfBundle['metadata'] | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(content.pageCount || 1);
  const [zoom, setZoom] = useState(100);
  const [viewRotation, setViewRotation] = useState(0);
  const [pageViewportSize, setPageViewportSize] = useState<{ width: number; height: number }>({
    width: 744,
    height: 1052,
  });

  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [annotations, setAnnotations] = useState<PdfAnnotationItem[]>(content.annotations ?? []);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string>(content.watermark ?? '');
  const [activeTool, setActiveTool] = useState<ActivePdfTool>('select');
  const [toolColor, setToolColor] = useState('#dc2626');

  const [draftBox, setDraftBox] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    points: Array<{ x: number; y: number }>;
  } | null>(null);

  const [draggingAnn, setDraggingAnn] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [comments, setComments] = useState<CommentItem[]>(
    content.comments || [
      {
        id: 'cmt-pdf-default',
        author: 'Bùi Đăng Minh',
        text: 'Hồ sơ PDF đã sẵn sàng ký số và đối soát bảng biểu.',
        createdAt: 1762500000000,
        resolved: false,
      },
    ]
  );
  const [newCommentText, setNewCommentText] = useState('');

  const [showSignModal, setShowSignModal] = useState(false);
  const [signMode, setSignMode] = useState<'draw' | 'stamp'>('draw');
  const [stampCompany, setStampCompany] = useState('CÔNG TY MINH SPARK');
  const [stampRole, setStampRole] = useState('GIÁM ĐỐC PHÊ DUYỆT');
  const [stampSigner, setStampSigner] = useState('Bùi Đăng Minh');

  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitRangeSpec, setSplitRangeSpec] = useState('1, 2-3');

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [workspacePdfs, setWorkspacePdfs] = useState<FileMeta[]>([]);
  const [selectedWorkspacePdfIds, setSelectedWorkspacePdfIds] = useState<string[]>([]);
  const [uploadedMergeFiles, setUploadedMergeFiles] = useState<File[]>([]);

  const [showCropModal, setShowCropModal] = useState(false);
  const [cropTop, setCropTop] = useState(28);
  const [cropRight, setCropRight] = useState(28);
  const [cropBottom, setCropBottom] = useState(28);
  const [cropLeft, setCropLeft] = useState(28);
  const [cropAllPages, setCropAllPages] = useState(true);

  const [showCompressModal, setShowCompressModal] = useState(false);
  const [compressQuality, setCompressQuality] = useState(0.62);
  const [compressResultMsg, setCompressResultMsg] = useState('');

  const [showConvertModal, setShowConvertModal] = useState<'word' | 'excel' | 'ppt' | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrSearch, setOcrSearch] = useState('');

  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState('');

  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingSignRef = useRef(false);
  const fallbackPagesRef = useRef(content.extractedPages);
  const uiRef = useRef(ui);

  useEffect(() => {
    fallbackPagesRef.current = content.extractedPages;
    uiRef.current = ui;
  }, [content.extractedPages, ui]);

  const persistPdfState = useCallback(
    (
      nextBytes: Uint8Array,
      overrides?: {
        nextName?: string;
        nextAnnotations?: PdfAnnotationItem[];
        nextComments?: CommentItem[];
        nextWatermark?: string;
        nextPages?: string[];
        nextPageCount?: number;
      }
    ) => {
      const dataUrl = bytesToDataUrl(nextBytes);
      const effectiveName = overrides?.nextName ?? title;
      const effectiveAnns = overrides?.nextAnnotations ?? annotations;
      const effectiveComments = overrides?.nextComments ?? comments;
      const effectiveWatermark = overrides?.nextWatermark ?? watermark;
      const effectivePages = overrides?.nextPages ?? extractedPages;
      const effectiveCount = overrides?.nextPageCount ?? totalPages;
      const firstLine =
        effectivePages
          .map((p) => p.replace(/\s+/g, ' ').trim())
          .find(Boolean)
          ?.slice(0, 150) || meta.preview;

      const updatedMeta: FileMeta = {
        ...meta,
        name: effectiveName,
        size: nextBytes.byteLength,
        updatedAt: Date.now(),
        preview: firstLine,
      };
      const updatedContent: PdfContent = {
        kind: 'pdf',
        pdfDataUrl: dataUrl,
        pageCount: effectiveCount,
        comments: effectiveComments,
        annotations: effectiveAnns,
        extractedPages: effectivePages,
        watermark: effectiveWatermark || undefined,
      };
      onSave(updatedMeta, updatedContent);
      setSavedStatus('saved');
    },
    [annotations, comments, extractedPages, meta, onSave, title, totalPages, watermark]
  );

  const persistRef = useRef(persistPdfState);
  useEffect(() => {
    persistRef.current = persistPdfState;
  }, [persistPdfState]);

  useEffect(() => {
    if (pdfBytes) return;
    let cancelled = false;
    createCorporateSamplePdf(meta.name)
      .then((generated) => {
        if (cancelled) return;
        setPdfBytes(generated.bytes);
        setTotalPages(generated.pageCount);
        setExtractedPages(generated.extractedPages);
        persistRef.current(generated.bytes, {
          nextPages: generated.extractedPages,
          nextPageCount: generated.pageCount,
        });
      })
      .catch((err) => {
        console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.name, pdfBytes]);

  useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;
    let loadedProxy: PDFDocumentProxy | null = null;

    loadPdfDocumentProxy(pdfBytes)
      .then((proxy) => {
        if (cancelled) {
          void disposePdfDocumentProxy(proxy);
          return;
        }
        loadedProxy = proxy;
        setPdfProxy(proxy);
        setTotalPages(proxy.numPages);
        setCurrentPage((prev) => Math.max(1, Math.min(proxy.numPages, prev)));
      })
      .catch((err) => {
        console.error(err);
        uiRef.current.toast('Tệp PDF không hợp lệ hoặc bị hỏng cấu trúc', true);
      });

    extractPdfTextAndTables(pdfBytes, fallbackPagesRef.current)
      .then((bundle) => {
        if (cancelled) return;
        setExtractedPages(bundle.pagesText);
        setExtractedTables(bundle.tables);
        setDocInfo(bundle.metadata);
      })
      .catch(() => {
        void 0;
      });

    return () => {
      cancelled = true;
      if (loadedProxy) {
        void disposePdfDocumentProxy(loadedProxy);
      }
    };
  }, [pdfBytes]);

  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!pdfProxy || !canvas) return;
    const scale = (zoom / 100) * 1.25;
    renderPdfPageToCanvas(pdfProxy, currentPage, canvas, scale, viewRotation)
      .then((dims) => {
        setPageViewportSize(dims);
      })
      .catch(() => {
        void 0;
      });
  }, [pdfProxy, currentPage, zoom, viewRotation]);

  useEffect(() => {
    const canvas = playCanvasRef.current;
    if (!showPlayModal || !pdfProxy || !canvas) return;
    renderPdfPageToCanvas(pdfProxy, currentPage, canvas, 1.35, viewRotation).catch(() => {
      void 0;
    });
  }, [showPlayModal, pdfProxy, currentPage, viewRotation]);

  useEffect(() => {
    if (savedStatus !== 'saving' || !pdfBytes) return;
    const timer = setTimeout(() => {
      persistPdfState(pdfBytes);
    }, 650);
    return () => clearTimeout(timer);
  }, [savedStatus, pdfBytes, persistPdfState]);

  const handleSaveNow = useCallback(() => {
    if (!pdfBytes) return;
    persistPdfState(pdfBytes);
    ui.toast('Đã lưu tài liệu PDF');
  }, [pdfBytes, persistPdfState, ui]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveNow();
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearchBar(true);
      } else if (e.key === 'F5') {
        e.preventDefault();
        setShowPlayModal(true);
      } else if (e.key === 'Escape') {
        if (showPlayModal) setShowPlayModal(false);
        else if (activeTool !== 'select') setActiveTool('select');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnId) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnId));
          setSelectedAnnId(null);
          setSavedStatus('saving');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, handleSaveNow, selectedAnnId, showPlayModal]);

  const getBakedBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (!pdfBytes) return null;
    if (annotations.length === 0 && !watermark) return pdfBytes;
    return bakeAnnotationsIntoPdf(pdfBytes, annotations, watermark || undefined);
  }, [annotations, pdfBytes, watermark]);

  const handleFlattenIntoPdf = async () => {
    if (!pdfBytes) return;
    if (annotations.length === 0 && !watermark) {
      ui.toast('Chưa có lớp chữ ký, con dấu hoặc hình vẽ nào cần ghi vào PDF');
      return;
    }
    ui.showBusy('Đang ghi vĩnh viễn lớp chữ ký & chú thích vào tệp nhị phân PDF…');
    try {
      const baked = await bakeAnnotationsIntoPdf(pdfBytes, annotations, watermark || undefined);
      setPdfBytes(baked);
      setAnnotations([]);
      setWatermark('');
      setSelectedAnnId(null);
      persistPdfState(baked, { nextAnnotations: [], nextWatermark: '' });
      ui.toast('Đã ghi vĩnh viễn toàn bộ chữ ký & hình vẽ vào trang PDF');
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể ghi lớp chú thích', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      ui.showBusy('Đang kết xuất tệp PDF chuẩn nhị phân…');
      const finalBytes = await getBakedBytes();
      if (!finalBytes) return;
      const blob = new Blob([finalBytes.slice(0)], { type: 'application/pdf' });
      const clean = title.replace(/\.pdf$/i, '') || 'Tai-lieu';
      downloadBlob(blob, `${clean}.pdf`);
      ui.toast(`Đã tải xuống "${clean}.pdf" (${formatBytes(finalBytes.byteLength)})`);
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportCurrentPagePng = async () => {
    if (!pdfProxy) return;
    ui.showBusy(`Đang xuất ảnh PNG trang ${currentPage}…`);
    try {
      const baked = await getBakedBytes();
      const targetProxy = baked && baked !== pdfBytes ? await loadPdfDocumentProxy(baked) : pdfProxy;
      const blob = await renderPdfPageToPngBlob(targetProxy, currentPage, 2.2);
      if (targetProxy !== pdfProxy) await disposePdfDocumentProxy(targetProxy);
      const clean = title.replace(/\.pdf$/i, '') || 'Trang-PDF';
      downloadBlob(blob, `${clean}-trang-${currentPage}.png`);
      ui.toast(`Đã tải xuống ảnh PNG trang ${currentPage}`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể xuất ảnh PNG', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleUploadLocalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    ui.showBusy(`Đang nạp tệp PDF "${file.name}"…`);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bundle = await extractPdfTextAndTables(bytes);
      setTitle(file.name);
      onRename(file.name);
      setAnnotations([]);
      setCurrentPage(1);
      setPdfBytes(bytes);
      setTotalPages(bundle.metadata.pageCount);
      setExtractedPages(bundle.pagesText);
      setExtractedTables(bundle.tables);
      persistPdfState(bytes, {
        nextName: file.name,
        nextAnnotations: [],
        nextPages: bundle.pagesText,
        nextPageCount: bundle.metadata.pageCount,
      });
      ui.toast(`Đã mở "${file.name}" (${bundle.metadata.pageCount} trang · ${formatBytes(bytes.byteLength)})`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể đọc tệp PDF này', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleCreateNewBlankPdf = async () => {
    const res = await ui.ask({
      title: 'Tạo tệp PDF trắng mới',
      fields: [
        { name: 'pages', label: 'Số trang A4 khởi tạo', type: 'number', value: 2, min: 1, max: 30 },
        {
          name: 'orientation',
          label: 'Hướng trang',
          type: 'select',
          value: 'portrait',
          options: [
            { value: 'portrait', label: 'Khổ dọc (A4 Portrait)' },
            { value: 'landscape', label: 'Khổ ngang (A4 Landscape)' },
          ],
        },
      ],
      confirmText: 'Khởi tạo',
    });
    if (!res) return;
    const count = Math.max(1, Math.min(30, Number(res.pages) || 1));
    const orient = res.orientation === 'landscape' ? 'landscape' : 'portrait';
    const created = await createBlankPdfDocument(title, count, orient);
    setAnnotations([]);
    setCurrentPage(1);
    setPdfBytes(created.bytes);
    setTotalPages(created.pageCount);
    setExtractedPages(created.extractedPages);
    persistPdfState(created.bytes, {
      nextAnnotations: [],
      nextPages: created.extractedPages,
      nextPageCount: created.pageCount,
    });
    ui.toast(`Đã khởi tạo PDF trắng (${count} trang)`);
  };

  const handleRotatePage = async (pageNum: number, deg: 90 | -90) => {
    if (!pdfBytes) return;
    const updated = await rotatePdfPages(pdfBytes, [pageNum], deg);
    setPdfBytes(updated);
    persistPdfState(updated);
    ui.toast(`Đã xoay trang ${pageNum} (${deg > 0 ? '+90°' : '-90°'})`);
  };

  const handleDuplicatePage = async (pageNum: number) => {
    if (!pdfBytes) return;
    const updated = await duplicatePdfPage(pdfBytes, pageNum);
    setPdfBytes(updated);
    setCurrentPage(pageNum + 1);
    persistPdfState(updated, { nextPageCount: totalPages + 1 });
    ui.toast(`Đã nhân bản trang ${pageNum}`);
  };

  const handleInsertPageAfterCurrent = async () => {
    if (!pdfBytes) return;
    const updated = await insertBlankPdfPage(pdfBytes, currentPage);
    setPdfBytes(updated);
    setCurrentPage(currentPage + 1);
    persistPdfState(updated, { nextPageCount: totalPages + 1 });
    ui.toast(`Đã chèn trang trắng sau trang ${currentPage}`);
  };

  const handleDeletePage = async (pageNum: number) => {
    if (!pdfBytes) return;
    if (totalPages <= 1) {
      ui.toast('Tài liệu PDF phải giữ lại ít nhất 1 trang', true);
      return;
    }
    try {
      const updated = await deletePdfPage(pdfBytes, pageNum);
      setAnnotations((prev) =>
        prev
          .filter((a) => a.page !== pageNum)
          .map((a) => (a.page > pageNum ? { ...a, page: a.page - 1 } : a))
      );
      setPdfBytes(updated);
      setCurrentPage((p) => Math.max(1, Math.min(totalPages - 1, p)));
      persistPdfState(updated, { nextPageCount: totalPages - 1 });
      ui.toast(`Đã xoá trang ${pageNum}`);
    } catch (err) {
      ui.toast((err as Error).message, true);
    }
  };

  const handleAddPageNumbers = async () => {
    if (!pdfBytes) return;
    const res = await ui.ask({
      title: 'Đánh số trang tự động lên PDF',
      fields: [
        {
          name: 'pos',
          label: 'Vị trí số trang',
          type: 'select',
          value: 'bottom-right',
          options: [
            { value: 'bottom-right', label: 'Góc dưới bên phải (Page 1 / N)' },
            { value: 'bottom-center', label: 'Chính giữa chân trang' },
            { value: 'top-right', label: 'Góc trên bên phải' },
          ],
        },
      ],
      confirmText: 'Đóng số trang',
    });
    if (!res) return;
    const pos = (res.pos as 'bottom-center' | 'bottom-right' | 'top-right') || 'bottom-right';
    const updated = await stampPageNumbersOnPdf(pdfBytes, pos);
    setPdfBytes(updated);
    persistPdfState(updated);
    ui.toast(`Đã đóng số trang lên toàn bộ ${totalPages} trang PDF`);
  };

  const handlePromptWatermark = async () => {
    const res = await ui.ask({
      title: 'Đóng dấu chìm bảo mật (Watermark)',
      fields: [
        {
          name: 'wm',
          label: 'Nội dung chữ chìm chéo trang (để trống nếu muốn xoá)',
          value: watermark || 'LƯU HÀNH NỘI BỘ',
          placeholder: 'TUYỆT MẬT / BẢN SAO / ĐÃ PHÊ DUYỆT…',
        },
      ],
      confirmText: 'Áp dụng',
    });
    if (!res) return;
    const nextWm = String(res.wm ?? '').trim();
    setWatermark(nextWm);
    setSavedStatus('saving');
    ui.toast(nextWm ? `Đã bật dấu chìm "${nextWm}"` : 'Đã gỡ dấu chìm');
  };

  const handleInsertImageOnPage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      const item: PdfAnnotationItem = {
        id: `ann-${Date.now()}`,
        page: currentPage,
        kind: 'stamp',
        x: 0.56,
        y: 0.68,
        w: 0.3,
        h: 0.14,
        color: '#dc2626',
        imageDataUrl: dataUrl,
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, item]);
      setSelectedAnnId(item.id);
      setActiveTool('select');
      setSavedStatus('saving');
      ui.toast(`Đã đặt ảnh "${file.name}" lên trang ${currentPage} (kéo để chỉnh vị trí)`);
    } catch {
      ui.toast('Không thể đọc tệp ảnh đã chọn', true);
    }
  };

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setShowHistoryModal(true);
  };

  const handleCreateSnapshot = async () => {
    if (!pdfBytes) return;
    const snapContent: PdfContent = {
      kind: 'pdf',
      pdfDataUrl: bytesToDataUrl(pdfBytes),
      pageCount: totalPages,
      comments,
      annotations,
      extractedPages,
      watermark: watermark || undefined,
    };
    const saved = await saveVersion(meta.id, snapContent, snapshotLabel.trim() || undefined);
    setVersions((prev) => [saved, ...prev]);
    setSnapshotLabel('');
    ui.toast('Đã lưu mốc lịch sử phiên bản PDF');
  };

  const handleRestoreVersion = async (v: FileVersion) => {
    const restored = await restoreVersion(meta.id, v.id);
    if (!restored || restored.kind !== 'pdf') return;
    if (restored.pdfDataUrl) {
      const bytes = dataUrlToBytes(restored.pdfDataUrl);
      setPdfBytes(bytes);
      setAnnotations(restored.annotations ?? []);
      setComments(restored.comments ?? []);
      setWatermark(restored.watermark ?? '');
      if (restored.extractedPages) setExtractedPages(restored.extractedPages);
      onSave({ ...meta, updatedAt: Date.now(), size: bytes.byteLength }, restored);
    }
    setShowHistoryModal(false);
    ui.toast(`Đã khôi phục về "${v.label}"`);
  };

  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(meta.id, versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    ui.toast('Đã xoá phiên bản lưu');
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      onRename(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const cmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: 'Bùi Đăng Minh',
      quote: `Trang ${currentPage}`,
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [cmt, ...prev]);
    setNewCommentText('');
    setSavedStatus('saving');
    ui.toast(`Đã gắn ghi chú vào trang ${currentPage}`);
  };

  const handlePlaceSignatureOrStamp = () => {
    let dataUrl = '';
    if (signMode === 'draw') {
      if (!signCanvasRef.current) return;
      dataUrl = signCanvasRef.current.toDataURL('image/png');
    } else {
      dataUrl = renderRedCorporateStampPng(stampCompany, stampRole, stampSigner);
    }
    if (!dataUrl) return;
    const item: PdfAnnotationItem = {
      id: `sig-${Date.now()}`,
      page: currentPage,
      kind: signMode === 'draw' ? 'signature' : 'stamp',
      x: 0.56,
      y: 0.74,
      w: signMode === 'draw' ? 0.28 : 0.34,
      h: 0.13,
      color: '#dc2626',
      imageDataUrl: dataUrl,
      createdAt: Date.now(),
    };
    setAnnotations((prev) => [...prev, item]);
    setSelectedAnnId(item.id);
    setActiveTool('select');
    setShowSignModal(false);
    setSavedStatus('saving');
    ui.toast(
      signMode === 'draw'
        ? `Đã đặt chữ ký lên trang ${currentPage} (kéo để di chuyển hoặc bấm Ghi lớp vẽ)`
        : `Đã đóng dấu đỏ doanh nghiệp lên trang ${currentPage}`
    );
  };

  const handleRunSplitPdf = async (saveToWorkspace: boolean) => {
    const src = await getBakedBytes();
    if (!src) return;
    ui.showBusy('Đang tách trang PDF…');
    try {
      const parts = await splitPdfByRanges(src, splitRangeSpec);
      const base = title.replace(/\.pdf$/i, '') || 'Tai-lieu';
      for (const part of parts) {
        if (saveToWorkspace) {
          const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newMeta: FileMeta = {
            id,
            name: `${base} - ${part.label}.pdf`,
            kind: 'pdf',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            openedAt: Date.now(),
            starred: false,
            deletedAt: null,
            size: part.bytes.byteLength,
            preview: `Tách từ "${title}" (${part.label}, ${part.pageCount} trang)`,
          };
          const newContent: PdfContent = {
            kind: 'pdf',
            pdfDataUrl: bytesToDataUrl(part.bytes),
            pageCount: part.pageCount,
          };
          await saveFile(newMeta, newContent);
        } else {
          downloadBlob(new Blob([part.bytes.slice(0)], { type: 'application/pdf' }), `${base}-${part.label}.pdf`);
        }
      }
      setShowSplitModal(false);
      ui.toast(
        saveToWorkspace
          ? `Đã lưu ${parts.length} tệp PDF đã tách vào Kho tài liệu`
          : `Đã tải xuống ${parts.length} tệp PDF đã tách`
      );
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi tách PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleOpenMergeDialog = async () => {
    const all = await listFiles();
    setWorkspacePdfs(all.filter((f) => !f.deletedAt && f.kind === 'pdf' && f.id !== meta.id));
    setSelectedWorkspacePdfIds([]);
    setUploadedMergeFiles([]);
    setShowMergeModal(true);
  };

  const handleRunMergePdf = async () => {
    const baseBytes = await getBakedBytes();
    if (!baseBytes) return;
    if (selectedWorkspacePdfIds.length === 0 && uploadedMergeFiles.length === 0) {
      ui.toast('Vui lòng chọn ít nhất 1 tệp PDF từ máy hoặc từ Kho tài liệu để gộp', true);
      return;
    }
    ui.showBusy('Đang hợp nhất các trang PDF…');
    try {
      const buffers: Uint8Array[] = [baseBytes];
      for (const id of selectedWorkspacePdfIds) {
        const c = await loadContent(id);
        if (c && c.kind === 'pdf' && c.pdfDataUrl) {
          buffers.push(dataUrlToBytes(c.pdfDataUrl));
        }
      }
      for (const f of uploadedMergeFiles) {
        buffers.push(new Uint8Array(await f.arrayBuffer()));
      }
      const merged = await mergePdfBuffers(buffers, title);
      setPdfBytes(merged.bytes);
      setAnnotations([]);
      setTotalPages(merged.pageCount);
      persistPdfState(merged.bytes, {
        nextAnnotations: [],
        nextPageCount: merged.pageCount,
        nextPages: merged.extractedPages,
      });
      setShowMergeModal(false);
      ui.toast(`Đã hợp nhất thành công! Tổng cộng: ${merged.pageCount} trang PDF`);
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể gộp các tệp PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleRunCropPdf = async () => {
    if (!pdfBytes) return;
    ui.showBusy('Đang cắt lề trang PDF…');
    try {
      const targets = cropAllPages ? undefined : [currentPage];
      const cropped = await cropPdfPages(
        pdfBytes,
        { top: cropTop, right: cropRight, bottom: cropBottom, left: cropLeft },
        targets
      );
      setPdfBytes(cropped);
      persistPdfState(cropped);
      setShowCropModal(false);
      ui.toast(
        cropAllPages
          ? `Đã cắt lề toàn bộ ${totalPages} trang PDF`
          : `Đã cắt lề trang ${currentPage}`
      );
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể cắt lề PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleRunCompressPdf = async (replaceCurrent: boolean, imageOnlyMode = false) => {
    const src = await getBakedBytes();
    if (!src) return;
    ui.showBusy(imageOnlyMode ? 'Đang chuyển đổi sang Image-only PDF chống sao chép…' : 'Đang nén tối ưu dung lượng PDF…');
    try {
      const beforeSize = src.byteLength;
      const q = imageOnlyMode ? 0.78 : compressQuality;
      const sc = imageOnlyMode ? 1.6 : compressQuality <= 0.5 ? 1.1 : 1.3;
      const compressed = await compressOrRasterizePdf(src, q, sc);
      const afterSize = compressed.byteLength;
      const diffPct = Math.round((1 - afterSize / Math.max(1, beforeSize)) * 100);
      const summary = `${formatBytes(beforeSize)} → ${formatBytes(afterSize)} (${diffPct >= 0 ? `giảm ${diffPct}%` : 'đã chuẩn hoá ảnh'})`;
      setCompressResultMsg(summary);

      if (replaceCurrent) {
        setPdfBytes(compressed);
        setAnnotations([]);
        persistPdfState(compressed, { nextAnnotations: [] });
        ui.toast(`Đã cập nhật tệp PDF sau xử lý (${summary})`);
      } else {
        const clean = title.replace(/\.pdf$/i, '') || 'Tai-lieu';
        const suffix = imageOnlyMode ? 'image-only' : 'compressed';
        downloadBlob(new Blob([compressed.slice(0)], { type: 'application/pdf' }), `${clean}-${suffix}.pdf`);
        ui.toast(`Đã tải xuống "${clean}-${suffix}.pdf" (${summary})`);
      }
      if (!imageOnlyMode) setShowCompressModal(false);
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi nén PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleConvertPdfAction = async (mode: 'word' | 'excel' | 'ppt', openInSuite: boolean) => {
    const clean = title.replace(/\.pdf$/i, '') || 'Tai-lieu';
    ui.showBusy('Đang phân tích cấu trúc văn bản & bảng biểu từ PDF…');
    try {
      const src = await getBakedBytes();
      const bundle = src
        ? await extractPdfTextAndTables(src, extractedPages)
        : { pagesText: extractedPages, tables: extractedTables };

      if (mode === 'word') {
        const json = convertPdfToDocxJson(clean, bundle.pagesText, bundle.tables);
        const page = defaultPage();
        if (openInSuite) {
          const docId = `doc-${Date.now()}`;
          const newMeta: FileMeta = {
            id: docId,
            name: `${clean}.docx`,
            kind: 'doc',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            openedAt: Date.now(),
            starred: false,
            deletedAt: null,
            size: 16384,
            preview: bundle.pagesText.join(' ').slice(0, 150),
          };
          const newContent: DocContent = { kind: 'doc', json, page };
          await saveFile(newMeta, newContent);
          setShowConvertModal(null);
          if (onOpenWorkspaceFile) {
            onOpenWorkspaceFile(newMeta, newContent);
          } else {
            ui.toast(`Đã lưu "${newMeta.name}" vào Kho Minh Docs`);
          }
        } else {
          const blob = await exportDocx(json, page, clean);
          downloadBlob(blob, `${clean}.docx`);
          setShowConvertModal(null);
          ui.toast(`Đã xuất tệp Word "${clean}.docx"`);
        }
      } else if (mode === 'excel') {
        const fallbackLines = bundle.pagesText.flatMap((p) => p.split('\n'));
        const wb = buildWorkbookFromTables(clean, bundle.tables, fallbackLines);
        if (openInSuite) {
          const sheetId = `sheet-${Date.now()}`;
          const newMeta: FileMeta = {
            id: sheetId,
            name: `${clean}.xlsx`,
            kind: 'sheet',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            openedAt: Date.now(),
            starred: false,
            deletedAt: null,
            size: 20480,
            preview: `Trích xuất ${wb.sheetOrder.length} bảng từ PDF "${title}"`,
          };
          const newContent: SheetContent = { kind: 'sheet', workbook: wb };
          await saveFile(newMeta, newContent);
          setShowConvertModal(null);
          if (onOpenWorkspaceFile) {
            onOpenWorkspaceFile(newMeta, newContent);
          } else {
            ui.toast(`Đã lưu "${newMeta.name}" vào Kho Minh Sheets`);
          }
        } else {
          const blob = await exportWorkbookToXlsx(wb);
          downloadBlob(blob, `${clean}.xlsx`);
          setShowConvertModal(null);
          ui.toast(`Đã xuất bảng tính "${clean}.xlsx"`);
        }
      } else {
        const { html } = convertPdfToSlideDeckHtml(clean, bundle.pagesText);
        downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${clean}-slides.html`);
        setShowConvertModal(null);
        ui.toast(`Đã tải xuống bộ Slide trình chiếu "${clean}-slides.html"`);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi chuyển đổi định dạng', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleOverlayMouseDown = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pt = getRelativeCoords(e.clientX, e.clientY);

    if (activeTool === 'select') {
      if (e.target === overlayRef.current) {
        setSelectedAnnId(null);
      }
      return;
    }

    if (activeTool === 'text') {
      const res = await ui.ask({
        title: `Thêm hộp chú thích lên trang ${currentPage}`,
        fields: [
          { name: 'text', label: 'Nội dung chú thích', placeholder: 'Nhập ghi chú hoặc phê duyệt…', value: 'Đã kiểm tra & đối chiếu' },
        ],
        confirmText: 'Chèn lên trang',
      });
      if (res?.text) {
        const ann: PdfAnnotationItem = {
          id: `ann-${Date.now()}`,
          page: currentPage,
          kind: 'text',
          x: Math.min(0.72, pt.x),
          y: Math.min(0.9, pt.y),
          w: 0.26,
          h: 0.055,
          color: toolColor,
          text: String(res.text).trim(),
          createdAt: Date.now(),
        };
        setAnnotations((prev) => [...prev, ann]);
        setSelectedAnnId(ann.id);
        setActiveTool('select');
        setSavedStatus('saving');
      }
      return;
    }

    setDraftBox({
      startX: pt.x,
      startY: pt.y,
      curX: pt.x,
      curY: pt.y,
      points: [pt],
    });
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = getRelativeCoords(e.clientX, e.clientY);

    if (draggingAnn) {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === draggingAnn.id
            ? {
                ...a,
                x: Math.max(0, Math.min(1 - a.w, pt.x - draggingAnn.offsetX)),
                y: Math.max(0, Math.min(1 - a.h, pt.y - draggingAnn.offsetY)),
              }
            : a
        )
      );
      return;
    }

    if (!draftBox) return;
    setDraftBox((prev) =>
      prev
        ? {
            ...prev,
            curX: pt.x,
            curY: pt.y,
            points: activeTool === 'freehand' ? [...prev.points, pt] : prev.points,
          }
        : null
    );
  };

  const handleOverlayMouseUp = () => {
    if (draggingAnn) {
      setDraggingAnn(null);
      setSavedStatus('saving');
      return;
    }
    if (!draftBox) return;

    const minX = Math.min(draftBox.startX, draftBox.curX);
    const minY = Math.min(draftBox.startY, draftBox.curY);
    const boxW = Math.abs(draftBox.curX - draftBox.startX);
    const boxH = Math.abs(draftBox.curY - draftBox.startY);

    if (activeTool === 'freehand' && draftBox.points.length > 2) {
      const xs = draftBox.points.map((p) => p.x);
      const ys = draftBox.points.map((p) => p.y);
      const fx = Math.min(...xs);
      const fy = Math.min(...ys);
      const fw = Math.max(0.02, Math.max(...xs) - fx);
      const fh = Math.max(0.02, Math.max(...ys) - fy);
      const ann: PdfAnnotationItem = {
        id: `ann-${Date.now()}`,
        page: currentPage,
        kind: 'freehand',
        x: fx,
        y: fy,
        w: fw,
        h: fh,
        color: toolColor,
        strokeWidth: 2.5,
        points: draftBox.points,
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, ann]);
      setSavedStatus('saving');
    } else if (activeTool === 'line' && (boxW > 0.01 || boxH > 0.01)) {
      const ann: PdfAnnotationItem = {
        id: `ann-${Date.now()}`,
        page: currentPage,
        kind: 'line',
        x: draftBox.startX,
        y: draftBox.startY,
        w: draftBox.curX - draftBox.startX,
        h: draftBox.curY - draftBox.startY,
        color: toolColor,
        strokeWidth: 2.5,
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, ann]);
      setSavedStatus('saving');
    } else if (
      (activeTool === 'highlight' ||
        activeTool === 'redact' ||
        activeTool === 'rect' ||
        activeTool === 'ellipse') &&
      (boxW > 0.012 || boxH > 0.012)
    ) {
      const defaultCol =
        activeTool === 'highlight'
          ? '#facc15'
          : activeTool === 'redact'
          ? '#0f172a'
          : toolColor;
      const ann: PdfAnnotationItem = {
        id: `ann-${Date.now()}`,
        page: currentPage,
        kind: activeTool,
        x: minX,
        y: minY,
        w: Math.max(0.02, boxW),
        h: Math.max(0.018, boxH),
        color: defaultCol,
        strokeWidth: 2.2,
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, ann]);
      setSavedStatus('saving');
    }

    setDraftBox(null);
  };

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === currentPage),
    [annotations, currentPage]
  );

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{ page: number; snippet: string }> = [];
    extractedPages.forEach((txt, idx) => {
      const pos = txt.toLowerCase().indexOf(q);
      if (pos >= 0) {
        const start = Math.max(0, pos - 24);
        const snippet = txt.slice(start, pos + q.length + 42).replace(/\s+/g, ' ');
        hits.push({ page: idx + 1, snippet });
      }
    });
    return hits;
  }, [extractedPages, searchQuery]);

  const ocrFullText = useMemo(() => {
    const q = ocrSearch.trim().toLowerCase();
    return extractedPages
      .map((txt, idx) => {
        const header = `=== TRANG ${idx + 1} / ${totalPages} ===`;
        const body = txt.trim() || '(Trang không có lớp văn bản)';
        return `${header}\n${body}`;
      })
      .filter((section) => (!q ? true : section.toLowerCase().includes(q)))
      .join('\n\n');
  }, [extractedPages, ocrSearch, totalPages]);

  return (
    <div className="editor-shell">
      <header className="editor-top">
        <div className="editor-title-group">
          <button className="icon-btn" onClick={onBack} title="Quay lại danh sách tệp">
            <ArrowLeft size={18} />
          </button>
          <div className="file-icon-box pdf" style={{ width: 28, height: 28 }} title="Minh PDF">
            <FileText size={16} />
          </div>
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          <label className="btn" style={{ cursor: 'pointer' }} title="Mở tệp PDF từ máy tính">
            <Upload size={14} />
            <span>Mở PDF</span>
            <input type="file" accept=".pdf" hidden onChange={handleUploadLocalPdf} />
          </label>
          {annotations.length > 0 && (
            <button
              className="btn"
              onClick={handleFlattenIntoPdf}
              title="Ghi vĩnh viễn chữ ký & hình vẽ vào tệp nhị phân PDF"
            >
              <FileCheck size={14} color="#dc2626" />
              <span>Ghi lớp vẽ ({annotations.length})</span>
            </button>
          )}
          <button className="btn" onClick={handleOpenHistory} title="Lịch sử phiên bản">
            <History size={15} />
            <span>Lịch sử</span>
          </button>
          <button className="btn" onClick={handleSaveNow} title="Lưu ngay (Ctrl+S)">
            <Save size={15} />
            <span>Lưu</span>
          </button>
          <button
            className="btn"
            style={{ background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }}
            onClick={handleExportPdf}
            title="Tải xuống tệp PDF chuẩn"
          >
            <Download size={15} />
            <span>Tải xuống PDF</span>
          </button>
          <button className="btn" onClick={() => window.print()} title="In tài liệu PDF">
            <Printer size={15} />
            <span>In</span>
          </button>
        </div>
      </header>

      <div className="ribbon pdf">
        <div className="ribbon-tabs-bar">
          <div className="ribbon-tabs-list">
            {(
              [
                ['file', 'File'],
                ['home', 'Home'],
                ['minh_pdf', 'Minh PDF'],
                ['insert', 'Insert'],
                ['view', 'View'],
                ['tools', 'Tools'],
                ['help', 'Help'],
              ] as Array<[PdfRibbonTab, string]>
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                className={`ribbon-tab ${activeTab === tabKey ? 'active' : ''}`}
                style={
                  activeTab === tabKey
                    ? { color: '#dc2626', borderBottomColor: '#dc2626', fontWeight: 700 }
                    : undefined
                }
                onClick={() => setActiveTab(tabKey)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ribbon-top-actions">
            <button
              className={`ribbon-pill-btn ${showSearchBar ? 'active' : ''}`}
              onClick={() => setShowSearchBar((v) => !v)}
              title="Tìm kiếm trong PDF (Ctrl+F)"
            >
              <Search size={13} />
              <span>Tìm kiếm</span>
            </button>
            <button
              className="ribbon-pill-btn"
              onClick={() => setShowComments((v) => !v)}
              title="Ghi chú bình luận"
            >
              <MessageSquare size={13} />
              <span>Bình luận ({comments.filter((c) => !c.resolved).length})</span>
            </button>
            <button
              className="ribbon-share-btn"
              style={{ background: '#dc2626', borderColor: '#b91c1c' }}
              onClick={() => setShowShareModal(true)}
            >
              <Share2 size={13} />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>

        <div className="ribbon-body">
          {activeTab === 'minh_pdf' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={handleCreateNewBlankPdf}
                    title="Khởi tạo tài liệu PDF A4 mới"
                  >
                    <FilePlus2 size={20} color="#dc2626" />
                    <span>Create<br />PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowPlayModal(true)}
                    title="Trình chiếu tài liệu PDF toàn màn hình (F5)"
                  >
                    <Play size={20} color="#059669" />
                    <span>Create<br />and play</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowShareModal(true)}
                    title="Chia sẻ & đóng gói xuất bản PDF"
                  >
                    <Share2 size={20} color="#2563eb" />
                    <span>Create<br />and share</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Create PDF</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setSignMode('draw');
                      setShowSignModal(true);
                    }}
                    title="Ký tên tay hoặc đóng dấu đỏ công ty lên trang PDF"
                  >
                    <FileSignature size={20} color="#dc2626" />
                    <span>Sign</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowSplitModal(true)}
                    title="Tách trang PDF theo khoảng tuỳ chọn"
                  >
                    <Split size={20} color="#475569" />
                    <span>PDF<br />Split</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={handleOpenMergeDialog}
                    title="Gộp nhiều tệp PDF thành một hồ sơ"
                  >
                    <Layers size={20} color="#475569" />
                    <span>PDF<br />Merge</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowCropModal(true)}
                    title="Cắt căn lề khung giấy PDF (CropBox)"
                  >
                    <Crop size={20} color="#2563eb" />
                    <span>Crop<br />Pages</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setCompressResultMsg('');
                      setShowCompressModal(true);
                    }}
                    title="Nén giảm dung lượng tệp PDF"
                  >
                    <Minimize2 size={20} color="#059669" />
                    <span>PDF<br />Compressor</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'redact' ? 'active' : ''}`}
                    onClick={() =>
                      setActiveTool((t) => (t === 'redact' ? 'select' : 'redact'))
                    }
                    title="Kéo chuột che đen thông tin mật trên trang PDF (Redaction)"
                  >
                    <Eraser size={20} color="#dc2626" />
                    <span>Wipe<br />Off</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${
                      activeTool === 'rect' || activeTool === 'freehand' ? 'active' : ''
                    }`}
                    onClick={() =>
                      setActiveTool((t) =>
                        t === 'rect' ? 'freehand' : t === 'freehand' ? 'select' : 'rect'
                      )
                    }
                    title="Vẽ khung chữ nhật / bút mực trực tiếp lên trang PDF"
                  >
                    <PenTool size={20} color="#4f46e5" />
                    <span>Draw<br />Shapes</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh PDF Tools</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('word')}
                    title="Chuyển đổi sang Minh Docs (.docx)"
                  >
                    <FileText size={20} color="#185abd" />
                    <span>PDF to<br />Word</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('excel')}
                    title="Trích xuất bảng dữ liệu sang Minh Sheets (.xlsx)"
                  >
                    <FileSpreadsheet size={20} color="#107c41" />
                    <span>PDF to<br />Excel</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('ppt')}
                    title="Chuyển đổi sang bộ Slide trình chiếu"
                  >
                    <Presentation size={20} color="#ea580c" />
                    <span>PDF<br />to PPT</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => void handleRunCompressPdf(false, true)}
                    title="Kết xuất thành PDF dạng ảnh phẳng chống sao chép văn bản"
                  >
                    <ImageIcon size={20} color="#475569" />
                    <span>To Image-<br />only PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={handleExportCurrentPagePng}
                    title="Xuất trang hiện tại thành ảnh PNG độ phân giải cao"
                  >
                    <ImageIcon size={20} color="#059669" />
                    <span>PDF to<br />Picture</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowOcrModal(true)}
                    title="Trích xuất toàn bộ lớp văn bản tiếng Việt & bảng biểu"
                  >
                    <ScanText size={20} color="#7c3aed" />
                    <span>OCR<br />PDF</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh PDF Convert</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-two-rows">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={keepAttributes}
                      onChange={(e) => setKeepAttributes(e.target.checked)}
                    />
                    <span>Giữ thuộc tính gốc</span>
                  </label>
                  <div className="ribbon-row" style={{ gap: 4 }}>
                    <button
                      className="ribbon-btn-compact"
                      onClick={handlePromptWatermark}
                      title="Đóng dấu chìm bảo mật"
                    >
                      <Shield size={13} color="#dc2626" />
                      <span>Dấu chìm</span>
                    </button>
                    <button
                      className="ribbon-btn-compact"
                      onClick={handleAddPageNumbers}
                      title="Đánh số trang tự động"
                    >
                      <Hash size={13} color="#2563eb" />
                      <span>Số trang</span>
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Thuộc tính & Bảo mật</div>
              </div>
            </>
          )}

          {activeTab === 'file' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <label className="ribbon-btn-large" style={{ cursor: 'pointer' }}>
                    <Upload size={20} color="#dc2626" />
                    <span>Mở PDF<br />từ máy</span>
                    <input type="file" accept=".pdf" hidden onChange={handleUploadLocalPdf} />
                  </label>
                  <button className="ribbon-btn-large" onClick={handleCreateNewBlankPdf}>
                    <FilePlus2 size={20} color="#2563eb" />
                    <span>Tạo PDF<br />trắng</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Tệp nguồn</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handleSaveNow}>
                    <Save size={20} color="#059669" />
                    <span>Lưu ngay<br />(Ctrl+S)</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleFlattenIntoPdf}>
                    <FileCheck size={20} color="#dc2626" />
                    <span>Ghi lớp<br />chú thích</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleOpenHistory}>
                    <History size={20} color="#0891b2" />
                    <span>Lịch sử<br />phiên bản</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Lưu trữ & Lịch sử</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handleExportPdf}>
                    <Download size={20} color="#dc2626" />
                    <span>Tải xuống<br />(.pdf)</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleExportCurrentPagePng}>
                    <ImageIcon size={20} color="#059669" />
                    <span>Xuất ảnh<br />(.png)</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowConvertModal('word')}>
                    <FileText size={20} color="#185abd" />
                    <span>Xuất Word<br />(.docx)</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowConvertModal('excel')}>
                    <FileSpreadsheet size={20} color="#107c41" />
                    <span>Xuất Excel<br />(.xlsx)</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => window.print()}>
                    <Printer size={20} color="#475569" />
                    <span>In ấn<br />(Ctrl+P)</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Xuất bản & In ấn</div>
              </div>
            </>
          )}

          {activeTab === 'home' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className={`ribbon-btn-large ${activeTool === 'select' ? 'active' : ''}`}
                    onClick={() => setActiveTool('select')}
                  >
                    <MousePointer size={20} color="#2563eb" />
                    <span>Con trỏ</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'highlight' ? 'active' : ''}`}
                    onClick={() => setActiveTool('highlight')}
                  >
                    <Highlighter size={20} color="#ca8a04" />
                    <span>Tô sáng</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'freehand' ? 'active' : ''}`}
                    onClick={() => setActiveTool('freehand')}
                  >
                    <PenTool size={20} color="#4f46e5" />
                    <span>Bút mực</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'text' ? 'active' : ''}`}
                    onClick={() => setActiveTool('text')}
                  >
                    <Type size={20} color="#0891b2" />
                    <span>Hộp chữ</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'redact' ? 'active' : ''}`}
                    onClick={() => setActiveTool('redact')}
                  >
                    <Eraser size={20} color="#dc2626" />
                    <span>Che mật</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Công cụ tương tác</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-two-rows">
                  <div className="ribbon-row" style={{ gap: 4 }}>
                    {['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#0f172a', '#ffffff'].map((col) => (
                      <button
                        key={col}
                        onClick={() => setToolColor(col)}
                        title={`Màu nét ${col}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: col,
                          border: toolColor === col ? '2px solid #0f172a' : '1px solid #cbd5e1',
                        }}
                      />
                    ))}
                  </div>
                  <div className="ribbon-row" style={{ gap: 4 }}>
                    <button
                      className="ribbon-btn-compact"
                      onClick={() => {
                        setAnnotations((prev) => prev.slice(0, -1));
                        setSavedStatus('saving');
                      }}
                      disabled={annotations.length === 0}
                    >
                      <Undo2 size={13} />
                      <span>Hoàn tác</span>
                    </button>
                    <button
                      className="ribbon-btn-compact"
                      onClick={handleFlattenIntoPdf}
                      disabled={annotations.length === 0 && !watermark}
                    >
                      <Check size={13} color="#16a34a" />
                      <span>Ghi vào PDF</span>
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Màu nét & Lớp vẽ</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => void handleRotatePage(currentPage, -90)}
                  >
                    <RotateCcw size={20} color="#475569" />
                    <span>Xoay trái</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => void handleRotatePage(currentPage, 90)}
                  >
                    <RotateCw size={20} color="#475569" />
                    <span>Xoay phải</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleInsertPageAfterCurrent}>
                    <Plus size={20} color="#059669" />
                    <span>Thêm trang</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => void handleDuplicatePage(currentPage)}
                  >
                    <Copy size={20} color="#2563eb" />
                    <span>Nhân bản</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => void handleDeletePage(currentPage)}
                  >
                    <Trash2 size={20} color="#dc2626" />
                    <span>Xoá trang</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Quản lý trang</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setSignMode('stamp');
                      setShowSignModal(true);
                    }}
                  >
                    <Award size={20} color="#dc2626" />
                    <span>Đóng dấu</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowSearchBar(true)}
                  >
                    <Search size={20} color="#2563eb" />
                    <span>Tìm chữ</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Dấu & Tra cứu</div>
              </div>
            </>
          )}

          {activeTab === 'insert' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setSignMode('draw');
                      setShowSignModal(true);
                    }}
                  >
                    <FileSignature size={20} color="#1d4ed8" />
                    <span>Chữ ký<br />viết tay</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setSignMode('stamp');
                      setShowSignModal(true);
                    }}
                  >
                    <Award size={20} color="#dc2626" />
                    <span>Dấu đỏ<br />công ty</span>
                  </button>
                  <label className="ribbon-btn-large" style={{ cursor: 'pointer' }}>
                    <ImageIcon size={20} color="#059669" />
                    <span>Chèn ảnh<br />lên trang</span>
                    <input type="file" accept="image/*" hidden onChange={handleInsertImageOnPage} />
                  </label>
                </div>
                <div className="ribbon-group-label">Chữ ký & Hình ảnh</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className={`ribbon-btn-large ${activeTool === 'text' ? 'active' : ''}`}
                    onClick={() => setActiveTool('text')}
                  >
                    <Type size={20} color="#0284c7" />
                    <span>Hộp chữ</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'rect' ? 'active' : ''}`}
                    onClick={() => setActiveTool('rect')}
                  >
                    <Square size={20} color="#dc2626" />
                    <span>Khung vuông</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'ellipse' ? 'active' : ''}`}
                    onClick={() => setActiveTool('ellipse')}
                  >
                    <Circle size={20} color="#2563eb" />
                    <span>Khoanh tròn</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${activeTool === 'line' ? 'active' : ''}`}
                    onClick={() => setActiveTool('line')}
                  >
                    <Minus size={20} color="#ea580c" />
                    <span>Đường kẻ</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Hình khối đánh dấu</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handlePromptWatermark}>
                    <Shield size={20} color="#dc2626" />
                    <span>Đóng dấu<br />chìm</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleAddPageNumbers}>
                    <Hash size={20} color="#2563eb" />
                    <span>Đánh số<br />trang</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={handleInsertPageAfterCurrent}>
                    <FilePlus2 size={20} color="#059669" />
                    <span>Chèn trang<br />trắng</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Trang & Bảo chứng</div>
              </div>
            </>
          )}

          {activeTab === 'view' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowPlayModal(true)}>
                    <Maximize2 size={20} color="#dc2626" />
                    <span>Trình chiếu<br />(F5)</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${showThumbnails ? 'active' : ''}`}
                    onClick={() => setShowThumbnails((v) => !v)}
                  >
                    <Eye size={20} color="#2563eb" />
                    <span>Cột trang<br />thu nhỏ</span>
                  </button>
                  <button
                    className={`ribbon-btn-large ${showComments ? 'active' : ''}`}
                    onClick={() => setShowComments((v) => !v)}
                  >
                    <MessageSquare size={20} color="#059669" />
                    <span>Khung<br />bình luận</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Bố cục hiển thị</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  >
                    <ZoomOut size={20} color="#475569" />
                    <span>Thu nhỏ</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setZoom(100)}>
                    <Search size={20} color="#2563eb" />
                    <span>100%</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setZoom((z) => Math.min(200, z + 15))}
                  >
                    <ZoomIn size={20} color="#475569" />
                    <span>Phóng to</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setViewRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCw size={20} color="#ea580c" />
                    <span>Xoay góc<br />xem</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Thu phóng & Góc nhìn</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={20} color="#0f172a" />
                    <span>Trang trước</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={20} color="#0f172a" />
                    <span>Trang tiếp</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Điều hướng trang</div>
              </div>
            </>
          )}

          {activeTab === 'tools' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={handleOpenMergeDialog}>
                    <Layers size={20} color="#2563eb" />
                    <span>Gộp nhiều<br />PDF</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowSplitModal(true)}>
                    <Split size={20} color="#dc2626" />
                    <span>Tách trang<br />PDF</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowCropModal(true)}>
                    <Crop size={20} color="#059669" />
                    <span>Cắt lề<br />trang</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setCompressResultMsg('');
                      setShowCompressModal(true);
                    }}
                  >
                    <Minimize2 size={20} color="#ea580c" />
                    <span>Nén dung<br />lượng</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Xử lý cấu trúc PDF</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowOcrModal(true)}>
                    <ScanText size={20} color="#7c3aed" />
                    <span>Trích xuất<br />OCR</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowInfoModal(true)}>
                    <Info size={20} color="#0284c7" />
                    <span>Kiểm định<br />Metadata</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setAnnotations([]);
                      setWatermark('');
                      setSavedStatus('saving');
                      ui.toast('Đã xoá toàn bộ lớp chú thích nổi');
                    }}
                  >
                    <Trash2 size={20} color="#64748b" />
                    <span>Xoá lớp<br />vẽ nổi</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Kiểm định & Làm sạch</div>
              </div>
            </>
          )}

          {activeTab === 'help' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button className="ribbon-btn-large" onClick={() => setShowShortcutsModal(true)}>
                    <HelpCircle size={20} color="#dc2626" />
                    <span>Phím tắt<br />Minh PDF</span>
                  </button>
                  <button className="ribbon-btn-large" onClick={() => setShowInfoModal(true)}>
                    <Info size={20} color="#2563eb" />
                    <span>Thông số<br />tệp PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={async () => {
                      const sample = await createCorporateSamplePdf(title);
                      setPdfBytes(sample.bytes);
                      setAnnotations([]);
                      setCurrentPage(1);
                      setTotalPages(sample.pageCount);
                      setExtractedPages(sample.extractedPages);
                      persistPdfState(sample.bytes, {
                        nextAnnotations: [],
                        nextPages: sample.extractedPages,
                        nextPageCount: sample.pageCount,
                      });
                      ui.toast('Đã tạo lại hồ sơ PDF quy chuẩn 3 trang');
                    }}
                  >
                    <Bookmark size={20} color="#059669" />
                    <span>Nạp hồ sơ<br />mẫu chuẩn</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Trợ giúp & Mẫu chuẩn</div>
              </div>
            </>
          )}
        </div>
      </div>

      {showSearchBar && (
        <div
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Search size={15} color="#dc2626" />
          <input
            className="text-field"
            style={{ width: 260, height: 30, fontSize: 12, padding: '4px 10px' }}
            placeholder="Nhập từ khoá cần tìm trong các trang PDF…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery.trim() && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>
                Khớp tại <strong>{searchMatches.length}</strong> trang:
              </span>
              {searchMatches.map((m) => (
                <button
                  key={m.page}
                  className="btn"
                  style={{ height: 26, minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setCurrentPage(m.page)}
                  title={m.snippet}
                >
                  Trang {m.page}
                </button>
              ))}
            </div>
          )}
          <button
            className="icon-btn"
            style={{ marginLeft: 'auto', width: 26, height: 26 }}
            onClick={() => setShowSearchBar(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#e2e8f0' }}>
        {showThumbnails && (
          <aside
            style={{
              width: 184,
              background: '#f8fafc',
              borderRight: '1px solid #cbd5e1',
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
              }}
            >
              <span>Trang ({totalPages})</span>
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={handleInsertPageAfterCurrent}
                title="Thêm trang trắng"
              >
                <Plus size={14} />
              </button>
            </div>

            {pdfProxy &&
              Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = currentPage === pageNum;
                return (
                  <div
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      borderRadius: 8,
                      background: isSelected ? '#fff1f2' : '#ffffff',
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <PdfThumbnailCanvas pdfProxy={pdfProxy} pageNumber={pageNum} />
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#dc2626' : '#475569',
                      }}
                    >
                      <span>Trang {pageNum}</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          className="icon-btn"
                          style={{ width: 24, height: 24 }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void handleRotatePage(pageNum, 90);
                          }}
                          title="Xoay 90°"
                        >
                          <RotateCw size={11} />
                        </button>
                        {totalPages > 1 && (
                          <button
                            className="icon-btn"
                            style={{ width: 24, height: 24, color: '#dc2626' }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void handleDeletePage(pageNum);
                            }}
                            title="Xoá trang"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </aside>
        )}

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {activeTool !== 'select' && (
            <div
              style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
              }}
            >
              <span>
                Đang bật công cụ:{' '}
                <strong>
                  {activeTool === 'highlight'
                    ? 'Tô sáng (kéo chuột trên trang)'
                    : activeTool === 'redact'
                    ? 'Wipe Off / Che mật thông tin (kéo khung đen)'
                    : activeTool === 'text'
                    ? 'Hộp chữ (nhấp vào vị trí cần chèn)'
                    : activeTool === 'freehand'
                    ? 'Bút mực vẽ tự do'
                    : 'Vẽ hình khối đánh dấu'}
                </strong>
              </span>
              <button
                className="btn"
                style={{ minHeight: 24, height: 24, padding: '0 8px', fontSize: 11 }}
                onClick={() => setActiveTool('select')}
              >
                Thoát (Esc)
              </button>
            </div>
          )}

          <div
            style={{
              position: 'relative',
              width: pageViewportSize.width,
              height: pageViewportSize.height,
              background: '#ffffff',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
              borderRadius: 2,
              flexShrink: 0,
            }}
          >
            <canvas ref={mainCanvasRef} style={{ display: 'block' }} />

            {watermark && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  pointerEvents: 'none',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    transform: 'rotate(-42deg)',
                    fontSize: 54,
                    fontWeight: 900,
                    letterSpacing: 6,
                    color: 'rgba(220, 38, 38, 0.14)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {watermark}
                </span>
              </div>
            )}

            <div
              ref={overlayRef}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              style={{
                position: 'absolute',
                inset: 0,
                cursor: activeTool === 'select' ? 'default' : 'crosshair',
                userSelect: 'none',
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                {pageAnnotations.map((ann) => {
                  if (ann.kind === 'freehand' && ann.points && ann.points.length > 1) {
                    const d = ann.points
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * 1000} ${p.y * 1000}`)
                      .join(' ');
                    return (
                      <path
                        key={ann.id}
                        d={d}
                        fill="none"
                        stroke={ann.color}
                        strokeWidth={ann.strokeWidth ? ann.strokeWidth * 1.4 : 3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  }
                  if (ann.kind === 'line') {
                    return (
                      <line
                        key={ann.id}
                        x1={ann.x * 1000}
                        y1={ann.y * 1000}
                        x2={(ann.x + ann.w) * 1000}
                        y2={(ann.y + ann.h) * 1000}
                        stroke={ann.color}
                        strokeWidth={3}
                      />
                    );
                  }
                  if (ann.kind === 'ellipse') {
                    return (
                      <ellipse
                        key={ann.id}
                        cx={(ann.x + ann.w / 2) * 1000}
                        cy={(ann.y + ann.h / 2) * 1000}
                        rx={Math.abs((ann.w / 2) * 1000)}
                        ry={Math.abs((ann.h / 2) * 1000)}
                        fill="none"
                        stroke={ann.color}
                        strokeWidth={3}
                      />
                    );
                  }
                  return null;
                })}

                {draftBox && activeTool === 'freehand' && draftBox.points.length > 1 && (
                  <path
                    d={draftBox.points
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * 1000} ${p.y * 1000}`)
                      .join(' ')}
                    fill="none"
                    stroke={toolColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                )}
                {draftBox && activeTool === 'line' && (
                  <line
                    x1={draftBox.startX * 1000}
                    y1={draftBox.startY * 1000}
                    x2={draftBox.curX * 1000}
                    y2={draftBox.curY * 1000}
                    stroke={toolColor}
                    strokeWidth={3}
                  />
                )}
              </svg>

              {pageAnnotations.map((ann) => {
                if (ann.kind === 'freehand' || ann.kind === 'line' || ann.kind === 'ellipse') {
                  return null;
                }
                const isSelected = selectedAnnId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onMouseDown={(ev) => {
                      if (activeTool !== 'select') return;
                      ev.stopPropagation();
                      setSelectedAnnId(ann.id);
                      const pt = getRelativeCoords(ev.clientX, ev.clientY);
                      setDraggingAnn({
                        id: ann.id,
                        offsetX: pt.x - ann.x,
                        offsetY: pt.y - ann.y,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: `${ann.x * 100}%`,
                      top: `${ann.y * 100}%`,
                      width: `${ann.w * 100}%`,
                      height: `${ann.h * 100}%`,
                      cursor: activeTool === 'select' ? 'move' : 'crosshair',
                      outline: isSelected ? '2px dashed #2563eb' : 'none',
                      outlineOffset: 2,
                      background:
                        ann.kind === 'highlight'
                          ? 'rgba(250, 204, 21, 0.42)'
                          : ann.kind === 'redact'
                          ? ann.color || '#0f172a'
                          : ann.kind === 'text'
                          ? 'rgba(255, 255, 255, 0.94)'
                          : 'transparent',
                      border:
                        ann.kind === 'rect'
                          ? `2px solid ${ann.color}`
                          : ann.kind === 'text'
                          ? `1.5px solid ${ann.color}`
                          : 'none',
                      borderRadius: 2,
                      padding: ann.kind === 'text' ? '4px 6px' : 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: ann.color || '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {ann.kind === 'text' && (
                      <span style={{ width: '100%', wordBreak: 'break-word' }}>{ann.text}</span>
                    )}
                    {(ann.kind === 'signature' || ann.kind === 'stamp') && ann.imageDataUrl && (
                      <img
                        src={ann.imageDataUrl}
                        alt="Chữ ký / Con dấu"
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          margin: 0,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setAnnotations((prev) => prev.filter((item) => item.id !== ann.id));
                          setSelectedAnnId(null);
                          setSavedStatus('saving');
                        }}
                        style={{
                          position: 'absolute',
                          top: -12,
                          right: -12,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: '#dc2626',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                        }}
                        title="Xoá mục này"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              {draftBox &&
                (activeTool === 'highlight' ||
                  activeTool === 'redact' ||
                  activeTool === 'rect' ||
                  activeTool === 'ellipse') && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${Math.min(draftBox.startX, draftBox.curX) * 100}%`,
                      top: `${Math.min(draftBox.startY, draftBox.curY) * 100}%`,
                      width: `${Math.abs(draftBox.curX - draftBox.startX) * 100}%`,
                      height: `${Math.abs(draftBox.curY - draftBox.startY) * 100}%`,
                      background:
                        activeTool === 'highlight'
                          ? 'rgba(250, 204, 21, 0.38)'
                          : activeTool === 'redact'
                          ? 'rgba(15, 23, 42, 0.85)'
                          : 'transparent',
                      border: `2px dashed ${toolColor}`,
                      borderRadius: activeTool === 'ellipse' ? '50%' : 2,
                      pointerEvents: 'none',
                    }}
                  />
                )}
            </div>
          </div>
        </div>

        {showComments && (
          <aside className="doc-comments">
            <div className="comments-header">
              <h3>
                <MessageSquare size={16} />
                <span>Ghi chú kiểm duyệt ({comments.length})</span>
              </h3>
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setShowComments(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="comments-list">
              {comments.map((c) => (
                <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
                  <div className="comment-card-top">
                    <strong style={{ fontSize: 12 }}>{c.author}</strong>
                    <button
                      className="icon-btn"
                      style={{ width: 24, height: 24 }}
                      onClick={() => {
                        setComments((prev) => prev.filter((item) => item.id !== c.id));
                        setSavedStatus('saving');
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {c.quote && <div className="comment-quote">{c.quote}</div>}
                  <div className="comment-text">{c.text}</div>
                  <div className="comment-actions">
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>
                      {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                    <button
                      className="btn"
                      style={{ minHeight: 24, height: 24, padding: '0 8px', fontSize: 11 }}
                      onClick={() => {
                        setComments((prev) =>
                          prev.map((item) =>
                            item.id === c.id ? { ...item, resolved: !item.resolved } : item
                          )
                        );
                        setSavedStatus('saving');
                      }}
                    >
                      {c.resolved ? 'Mở lại' : 'Hoàn tất'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="comment-new-box">
              <textarea
                className="text-field"
                rows={2}
                placeholder={`Ghi chú cho trang ${currentPage}…`}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ fontSize: 12, marginBottom: 8 }}
              />
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleAddComment}>
                Gửi ghi chú trang {currentPage}
              </button>
            </div>
          </aside>
        )}
      </div>

      <footer className="editor-status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span>
              Trang <strong>{currentPage}</strong> / {totalPages}
            </span>
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <span>·</span>
          <span>Dung lượng: {pdfBytes ? formatBytes(pdfBytes.byteLength) : '—'}</span>
          {annotations.length > 0 && (
            <>
              <span>·</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>
                {annotations.length} lớp ký/vẽ nổi
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="icon-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
          >
            <ZoomOut size={14} />
          </button>
          <span style={{ minWidth: 42, textAlign: 'center', fontWeight: 600 }}>{zoom}%</span>
          <button
            className="icon-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </footer>

      {showSignModal && (
        <div className="dialog-backdrop" onClick={() => setShowSignModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Chữ ký số & Con dấu đỏ doanh nghiệp</h2>
              <button className="icon-btn" onClick={() => setShowSignModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                className={`btn ${signMode === 'draw' ? 'btn-danger' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setSignMode('draw')}
              >
                <PenTool size={14} />
                <span>Vẽ chữ ký tay</span>
              </button>
              <button
                className={`btn ${signMode === 'stamp' ? 'btn-danger' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setSignMode('stamp')}
              >
                <Award size={14} />
                <span>Đóng dấu đỏ pháp nhân</span>
              </button>
            </div>

            {signMode === 'draw' ? (
              <>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc', overflow: 'hidden' }}>
                  <canvas
                    ref={signCanvasRef}
                    width={430}
                    height={160}
                    style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
                    onMouseDown={(e) => {
                      isDrawingSignRef.current = true;
                      const ctx = signCanvasRef.current?.getContext('2d');
                      if (ctx && signCanvasRef.current) {
                        const r = signCanvasRef.current.getBoundingClientRect();
                        ctx.beginPath();
                        ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
                        ctx.strokeStyle = '#1e3a8a';
                        ctx.lineWidth = 2.8;
                        ctx.lineCap = 'round';
                      }
                    }}
                    onMouseMove={(e) => {
                      if (!isDrawingSignRef.current || !signCanvasRef.current) return;
                      const ctx = signCanvasRef.current.getContext('2d');
                      if (ctx) {
                        const r = signCanvasRef.current.getBoundingClientRect();
                        ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
                        ctx.stroke();
                      }
                    }}
                    onMouseUp={() => {
                      isDrawingSignRef.current = false;
                    }}
                    onMouseLeave={() => {
                      isDrawingSignRef.current = false;
                    }}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      const c = signCanvasRef.current;
                      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
                    }}
                  >
                    Xoá ký lại
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Tên đơn vị / Pháp nhân trên con dấu</span>
                  <input
                    className="text-field"
                    value={stampCompany}
                    onChange={(e) => setStampCompany(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Chức danh / Trạng thái phê duyệt</span>
                  <input
                    className="text-field"
                    value={stampRole}
                    onChange={(e) => setStampRole(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span className="field-label">Người ký xác thực</span>
                  <input
                    className="text-field"
                    value={stampSigner}
                    onChange={(e) => setStampSigner(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowSignModal(false)}>
                Huỷ
              </button>
              <button className="btn btn-danger" onClick={handlePlaceSignatureOrStamp}>
                Đặt lên trang {currentPage}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && (
        <div className="dialog-backdrop" onClick={() => setShowSplitModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Tách trang PDF (PDF Split)</h2>
              <button className="icon-btn" onClick={() => setShowSplitModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 0 }}>
              Tài liệu hiện có <strong>{totalPages}</strong> trang. Nhập khoảng trang cần tách (ví dụ:{' '}
              <code>1, 2-3</code> hoặc gõ <code>each</code> để tách rời từng trang):
            </p>
            <div className="field">
              <span className="field-label">Khoảng trang cần trích xuất</span>
              <input
                className="text-field"
                value={splitRangeSpec}
                onChange={(e) => setSplitRangeSpec(e.target.value)}
                placeholder="1, 2-3 hoặc each"
              />
            </div>
            <div className="dialog-actions">
              <button className="btn" onClick={() => void handleRunSplitPdf(true)}>
                Lưu vào Kho Minh PDF
              </button>
              <button className="btn btn-danger" onClick={() => void handleRunSplitPdf(false)}>
                Tải xuống các tệp .pdf
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="dialog-backdrop" onClick={() => setShowMergeModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Hợp nhất nhiều tệp PDF (PDF Merge)</h2>
              <button className="icon-btn" onClick={() => setShowMergeModal(false)}>
                <X size={16} />
              </button>
            </div>

            {workspacePdfs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="field-label" style={{ marginBottom: 6 }}>
                  Chọn thêm tệp PDF có sẵn trong Kho tài liệu:
                </div>
                <div
                  style={{
                    maxHeight: 150,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {workspacePdfs.map((item) => (
                    <label
                      key={item.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkspacePdfIds.includes(item.id)}
                        onChange={(e) =>
                          setSelectedWorkspacePdfIds((prev) =>
                            e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                          )
                        }
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <span className="field-label">Hoặc chọn thêm tệp .pdf từ máy tính:</span>
              <label
                className="btn"
                style={{ cursor: 'pointer', justifyContent: 'center', padding: 14, borderStyle: 'dashed' }}
              >
                <Upload size={16} color="#dc2626" />
                <span>
                  {uploadedMergeFiles.length > 0
                    ? `Đã chọn ${uploadedMergeFiles.length} tệp: ${uploadedMergeFiles.map((f) => f.name).join(', ')}`
                    : 'Nhấp chọn một hoặc nhiều tệp .pdf…'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  hidden
                  onChange={(e) => setUploadedMergeFiles(Array.from(e.target.files ?? []))}
                />
              </label>
            </div>

            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowMergeModal(false)}>
                Huỷ
              </button>
              <button className="btn btn-danger" onClick={() => void handleRunMergePdf()}>
                Gộp nối vào tài liệu hiện tại
              </button>
            </div>
          </div>
        </div>
      )}

      {showCropModal && (
        <div className="dialog-backdrop" onClick={() => setShowCropModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Cắt lề trang PDF (Crop Pages)</h2>
              <button className="icon-btn" onClick={() => setShowCropModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Lề trên (pt)</span>
                <input
                  type="number"
                  className="text-field"
                  value={cropTop}
                  onChange={(e) => setCropTop(Number(e.target.value) || 0)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Lề dưới (pt)</span>
                <input
                  type="number"
                  className="text-field"
                  value={cropBottom}
                  onChange={(e) => setCropBottom(Number(e.target.value) || 0)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Lề trái (pt)</span>
                <input
                  type="number"
                  className="text-field"
                  value={cropLeft}
                  onChange={(e) => setCropLeft(Number(e.target.value) || 0)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Lề phải (pt)</span>
                <input
                  type="number"
                  className="text-field"
                  value={cropRight}
                  onChange={(e) => setCropRight(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                checked={cropAllPages}
                onChange={(e) => setCropAllPages(e.target.checked)}
              />
              <span>Áp dụng cho toàn bộ {totalPages} trang (bỏ chọn để chỉ cắt trang {currentPage})</span>
            </label>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowCropModal(false)}>
                Huỷ
              </button>
              <button className="btn btn-danger" onClick={() => void handleRunCropPdf()}>
                Áp dụng CropBox
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompressModal && (
        <div className="dialog-backdrop" onClick={() => setShowCompressModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Nén giảm dung lượng PDF (Compressor)</h2>
              <button className="icon-btn" onClick={() => setShowCompressModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 0 }}>
              Dung lượng hiện tại: <strong>{pdfBytes ? formatBytes(pdfBytes.byteLength) : '—'}</strong>. Chọn mức chất lượng nén ảnh trang:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {[
                { q: 0.42, label: 'Nén cực đại (Ưu tiên dung lượng nhỏ nhất để gửi email)' },
                { q: 0.62, label: 'Nén cân bằng khuyên dùng (Giữ chữ sắc nét, giảm dung lượng tốt)' },
                { q: 0.82, label: 'Nén nhẹ bảo toàn chất lượng in ấn' },
              ].map((opt) => (
                <label
                  key={opt.q}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: compressQuality === opt.q ? '#fef2f2' : '#ffffff',
                  }}
                >
                  <input
                    type="radio"
                    checked={compressQuality === opt.q}
                    onChange={() => setCompressQuality(opt.q)}
                  />
                  <span style={{ fontSize: 12.5 }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {compressResultMsg && (
              <div style={{ fontSize: 12, color: '#15803d', marginBottom: 10, fontWeight: 600 }}>
                Kết quả: {compressResultMsg}
              </div>
            )}
            <div className="dialog-actions">
              <button className="btn" onClick={() => void handleRunCompressPdf(true, false)}>
                Nén & Cập nhật tệp hiện tại
              </button>
              <button className="btn btn-danger" onClick={() => void handleRunCompressPdf(false, false)}>
                Nén & Tải bản .pdf mới
              </button>
            </div>
          </div>
        </div>
      )}

      {showConvertModal && (
        <div className="dialog-backdrop" onClick={() => setShowConvertModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>
                {showConvertModal === 'word'
                  ? 'Chuyển đổi PDF sang Minh Docs (.docx)'
                  : showConvertModal === 'excel'
                  ? 'Trích xuất bảng PDF sang Minh Sheets (.xlsx)'
                  : 'Chuyển đổi PDF sang Slide trình chiếu'}
              </h2>
              <button className="icon-btn" onClick={() => setShowConvertModal(null)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
              {showConvertModal === 'word'
                ? `Đã nhận diện ${totalPages} trang văn bản tiếng Việt và ${extractedTables.length} bảng biểu. Sếp có thể tải tệp .docx về máy hoặc mở chỉnh sửa trực tiếp trong Minh Docs.`
                : showConvertModal === 'excel'
                ? `Đã phát hiện ${Math.max(1, extractedTables.length)} vùng dữ liệu bảng trong PDF. Sếp có thể tải tệp .xlsx chuẩn công thức hoặc mở ngay trong Minh Sheets.`
                : `Tự động tổng hợp tiêu đề và luận điểm của ${totalPages} trang PDF thành bộ Slide HTML 16:9 sẵn sàng trình chiếu.`}
            </p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowConvertModal(null)}>
                Huỷ
              </button>
              <button
                className="btn"
                onClick={() => void handleConvertPdfAction(showConvertModal, false)}
              >
                <Download size={14} />
                <span>
                  Tải tệp{' '}
                  {showConvertModal === 'word'
                    ? '.docx'
                    : showConvertModal === 'excel'
                    ? '.xlsx'
                    : '.html'}
                </span>
              </button>
              {showConvertModal !== 'ppt' && (
                <button
                  className={showConvertModal === 'word' ? 'btn btn-doc' : 'btn btn-sheet'}
                  onClick={() => void handleConvertPdfAction(showConvertModal, true)}
                >
                  <span>
                    Lưu & Mở trong {showConvertModal === 'word' ? 'Minh Docs' : 'Minh Sheets'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showOcrModal && (
        <div className="dialog-backdrop" onClick={() => setShowOcrModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>
                Trích xuất văn bản & OCR tiếng Việt ({totalPages} trang)
              </h2>
              <button className="icon-btn" onClick={() => setShowOcrModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="text-field"
                placeholder="Lọc nhanh trang chứa từ khoá…"
                value={ocrSearch}
                onChange={(e) => setOcrSearch(e.target.value)}
                style={{ fontSize: 12.5 }}
              />
            </div>
            <textarea
              className="text-field"
              rows={12}
              readOnly
              value={ocrFullText}
              style={{ fontFamily: 'Consolas, monospace', fontSize: 12, lineHeight: 1.55 }}
            />
            <div className="dialog-actions">
              <button
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(ocrFullText);
                  ui.toast('Đã sao chép toàn bộ văn bản trích xuất vào Clipboard');
                }}
              >
                <Copy size={14} />
                <span>Sao chép văn bản</span>
              </button>
              <button
                className="btn btn-doc"
                onClick={() => {
                  setShowOcrModal(false);
                  void handleConvertPdfAction('word', true);
                }}
              >
                Mở chỉnh sửa trong Minh Docs
              </button>
            </div>
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="dialog-backdrop" onClick={() => setShowInfoModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Thông số kỹ thuật & Metadata PDF</h2>
              <button className="icon-btn" onClick={() => setShowInfoModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 8, fontSize: 12.5 }}>
              <span style={{ color: '#64748b' }}>Tên tệp:</span>
              <strong>{title}</strong>
              <span style={{ color: '#64748b' }}>Số trang:</span>
              <strong>{totalPages} trang</strong>
              <span style={{ color: '#64748b' }}>Dung lượng nhị phân:</span>
              <strong>{pdfBytes ? formatBytes(pdfBytes.byteLength) : '—'}</strong>
              <span style={{ color: '#64748b' }}>Tiêu đề nhúng:</span>
              <span>{docInfo?.title || title}</span>
              <span style={{ color: '#64748b' }}>Tác giả / Đơn vị:</span>
              <span>{docInfo?.author || 'Minh Spark Office'}</span>
              <span style={{ color: '#64748b' }}>Trình tạo PDF:</span>
              <span>{docInfo?.creator || 'Minh Spark PDF Engine'}</span>
              <span style={{ color: '#64748b' }}>Bảng biểu phát hiện:</span>
              <span>{extractedTables.length} bảng</span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-danger" onClick={() => setShowInfoModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutsModal && (
        <div className="dialog-backdrop" onClick={() => setShowShortcutsModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Bảng phím tắt Minh PDF</h2>
              <button className="icon-btn" onClick={() => setShowShortcutsModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 10, fontSize: 12.5 }}>
              <code>Ctrl + S</code>
              <span>Lưu nhanh tài liệu PDF hiện tại</span>
              <code>Ctrl + F</code>
              <span>Mở thanh tìm kiếm từ khoá theo trang</span>
              <code>F5</code>
              <span>Bật chế độ Trình chiếu toàn màn hình</span>
              <code>Delete</code>
              <span>Xoá chữ ký / con dấu / khung vẽ đang chọn</span>
              <code>Esc</code>
              <span>Thoát công cụ vẽ hoặc thoát trình chiếu</span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-danger" onClick={() => setShowShortcutsModal(false)}>
                Đã rõ
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlayModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0f172a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 20,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#cbd5e1', fontSize: 13 }}>
              {title} — Trang {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-danger"
              onClick={() => setShowPlayModal(false)}
            >
              Thoát trình chiếu (Esc)
            </button>
          </div>

          <div
            style={{
              maxHeight: '84vh',
              maxWidth: '90vw',
              overflow: 'auto',
              background: '#ffffff',
              borderRadius: 4,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
            }}
          >
            <canvas ref={playCanvasRef} style={{ display: 'block' }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button
              className="btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              <span>Trang trước</span>
            </button>
            <button
              className="btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Trang tiếp</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="dialog-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Xuất bản & Chia sẻ hồ sơ PDF</h2>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={handleExportPdf}>
                <Download size={15} color="#dc2626" />
                <span>Tải xuống tệp PDF chuẩn đã gộp chữ ký (.pdf)</span>
              </button>
              <button
                className="btn"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => void handleRunCompressPdf(false, true)}
              >
                <Shield size={15} color="#0f172a" />
                <span>Tải bản PDF phẳng chống sao chép văn bản (Image-only PDF)</span>
              </button>
              <button
                className="btn"
                style={{ justifyContent: 'flex-start' }}
                onClick={handleExportCurrentPagePng}
              >
                <ImageIcon size={15} color="#059669" />
                <span>Xuất trang hiện tại thành ảnh sắc nét (.png)</span>
              </button>
            </div>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowShareModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="dialog-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>Lịch sử phiên bản PDF</h2>
              <button className="icon-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="text-field"
                placeholder="Ghi nhãn mốc phiên bản (ví dụ: Bản trước khi đóng dấu)…"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
              />
              <button className="btn btn-danger" onClick={handleCreateSnapshot}>
                Lưu mốc mới
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                  Chưa có bản chụp nào được lưu.
                </div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {new Date(v.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn"
                        style={{ minHeight: 28, padding: '2px 10px', fontSize: 12 }}
                        onClick={() => void handleRestoreVersion(v)}
                      >
                        Khôi phục
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => void handleDeleteVersion(v.id)}
                        title="Xoá bản lưu"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
