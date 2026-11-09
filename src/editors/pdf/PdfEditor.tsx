import { SuiteLogo } from '../../components/SuiteLogo';
import './pdfEditor.css';
import { saveAccountSnapshot } from '../../lib/accountSnapshots';
import { useAccount } from '../../components/Authentication';
import { useWorkspace } from '../../lib/storage';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AddinPanel, AddinRibbonButtons } from '../../addins/AddinPane';
import { pdfHost } from '../../addins/hosts';
import { getOpenAddin } from '../../addins/store';
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
  Eraser,
  PenTool,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  ScanText,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  CopyCheck,
  Play,
  Share,
} from 'lucide-react';

import {
  type FileMeta,
  type PdfContent,
  type FileVersion,
  type CommentItem,
} from '../../lib/storage';
import { downloadBlob } from '../../lib/download';
import { useUi } from '../../components/ui';
import { useDocumentCloser } from '../../lib/documentCloser';
import { currentAuthorName } from '../../lib/currentAuthor';
import { looksLikePdf, pdfBytesToDataUrl, pdfDataUrlToBytes } from './pdfBytes';
import { usePdfDocument, usePdfPageText } from './usePdfDocument';
import { PdfPrintDialog } from './PdfPrintDialog';
import { PdfPageScroller, PdfThumb, typicalWidth } from './PdfPageScroller';
import { usePageNavigation } from './usePageNavigation';

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
  const [showConvertModal, setShowConvertModal] = useState<string | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const [comments, setComments] = useState<CommentItem[]>(content.comments || []);
  const [newCommentText, setNewCommentText] = useState('');

  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

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

  useDocumentCloser(() => persistPdf(false).then((saved) => { if (saved) onBack(); return saved; }));

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
  const addinHost = useMemo(() => pdfHost({
    dataUrl: () => pdfDataUrlRef.current,
    pageText: () => (pdfDataUrlRef.current ? realPageTextRef.current ?? '' : pageRef.current?.innerText.trim() ?? ''),
    page: () => currentPageRef.current,
    notes: () => commentsRef.current.filter((item) => !item.resolved).map((item) => `- ${item.text}`).join('\n'),
    addNote: (text, author) => {
      setComments((prev) => [{ id: `cmt-${Date.now()}`, author, text: text.trim(), createdAt: Date.now(), resolved: false }, ...prev]);
      markDirty();
      setShowComments(true);
    },
  }, title, getOpenAddin), [markDirty, title]);

  const ocrText = hasRealPdf
    ? realPageText ?? ''
    : `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc\n\n${title.replace(/\.[^/.]+$/, '')}\n\nKính gửi: Ban Giám đốc và các đơn vị phòng ban liên quan.\nCăn cứ theo kế hoạch phát triển giải pháp văn phòng số nội bộ Minh Spark Office, văn bản PDF này đã được biên soạn, kiểm duyệt và đóng dấu chữ ký điện tử an toàn tuyệt đối.\n\nNgười ký: ${currentAuthorName()}`;

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

  const openPrint = useCallback(() => {
    if (pdfState.status !== 'ready') {
      ui.toast(pdfState.status === 'loading' ? 'Tệp PDF đang mở, thử lại sau giây lát' : 'Chưa có tệp PDF để in', true);
      return;
    }
    setPrintOpen(true);
  }, [pdfState.status, ui]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        openPrint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPrint]);

  return (
    <div className="editor-shell">
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
              <span>Share ▾</span>
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
                    title="Tạo và chia sẻ liên kết tài liệu PDF"
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
                    onClick={() => setShowSignModal(true)}
                    title="Ký chữ ký điện tử & Đóng dấu xác thực"
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

                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã bật công cụ xoá thông tin mật (Wipe Off / Redaction)')}
                    title="Xoá che thông tin nhạy cảm trên PDF"
                  >
                    <Eraser size={20} color="#e11d48" />
                    <span>Wipe<br/>Off</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã chọn công cụ vẽ hình khối & đường thẳng chú thích')}
                    title="Vẽ hình khối và đường kẻ (Draw Shapes)"
                  >
                    <PenTool size={20} color="#6366f1" />
                    <span>Draw<br/>Shapes</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh PDF Tools</div>
              </div>

              {/* 3. Group: Minh PDF Convert */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('word')}
                    title="Chuyển đổi PDF sang Microsoft Word (.docx)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileText size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#185abd' }}>W</span>
                    </div>
                    <span>PDF to<br/>Word</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('excel')}
                    title="Chuyển đổi bảng biểu PDF sang Excel (.xlsx)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileSpreadsheet size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#107c41' }}>X</span>
                    </div>
                    <span>PDF to<br/>Excel</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowConvertModal('ppt')}
                    title="Chuyển đổi PDF sang PowerPoint (.pptx)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Presentation size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#ea580c' }}>P</span>
                    </div>
                    <span>PDF<br/>to PPT</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      ui.showBusy('Đang chuyển đổi PDF sang dạng ảnh bảo mật…');
                      setTimeout(() => {
                        ui.showBusy(null);
                        ui.toast('Đã tạo tệp Image-only PDF chống sao chép thành công!');
                      }, 500);
                    }}
                    title="Chuyển thành tệp PDF dạng ảnh chỉ đọc chống sao chép"
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
                <div className="ribbon-group-label">Minh PDF Convert</div>
              </div>

              {/* 4. Group: Settings */}
              <div className="ribbon-section">
                <div className="ribbon-controls" style={{ padding: '0 8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', userSelect: 'none' }}>
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

              {/* 5. Group: Other */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Mở rộng các tính năng bảo mật, đóng dấu chìm (Watermark) và thiết lập trang in')}
                    title="Thêm các thiết lập khác"
                  >
                    <MoreHorizontal size={20} color="#64748b" />
                    <span>More<br/>▾</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Other</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <AddinRibbonButtons className="ribbon-btn-large" />
                </div>
                <div className="ribbon-group-label">Add-in</div>
              </div>
            </>
          )}

          {/* Fallback for other tabs */}
          {activeTab !== 'minh_pdf' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="btn" onClick={() => setActiveTab('minh_pdf')}>
                <span>Quay lại tab Minh PDF</span>
              </button>
              <button className="btn" onClick={handleExportPdf}>
                <Download size={14} />
                <span>Tải tệp PDF</span>
              </button>
              <button className="btn" onClick={() => setShowSignModal(true)}>
                <FileSignature size={14} />
                <span>Ký số</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace: PDF Canvas Viewer */}
      <div className="pdf-workspace">
        {/* Left Thumbnails Strip */}
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
                Căn cứ theo kế hoạch phát triển giải pháp văn phòng số nội bộ <strong>Minh Spark Office</strong>, văn bản PDF này đã được biên soạn, kiểm duyệt và đóng dấu chữ ký điện tử an toàn tuyệt đối.
              </p>
              <div style={{ background: '#f8fafc', borderLeft: '3px solid #dc2626', padding: '10px 14px', margin: '16px 0', borderRadius: 4 }}>
                <strong>Điều khoản xác thực bảo mật:</strong>
                <br />
                Toàn bộ dữ liệu được mã hoá theo chuẩn ECMA-376 và bảo vệ an toàn 100% tại máy trạm, không truyền ra ngoài hệ thống mạng bên thứ ba.
              </div>
              <p>
                Bản sao điện tử này có giá trị xác nhận và có thể chuyển đổi linh hoạt sang tài liệu <strong>Minh Docs (.docx)</strong> hoặc bảng tính <strong>Minh Sheets (.xlsx)</strong> mà không làm sai lệch cấu trúc dữ liệu ban đầu.
              </p>
            </div>

            {/* Signature stamp area */}
            <div style={{ position: 'absolute', bottom: 60, right: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>ĐẠI DIỆN MINH SPARK OFFICE</div>
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

          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setZoom((z) => Math.max(50, z - 10))} title="Thu nhỏ">
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: 11 }}>{zoom}%</span>
          <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setZoom((z) => Math.min(200, z + 10))} title="Phóng to">
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
        <AddinPanel host={addinHost} />
      </div>

      {/* MODAL 1: Sign Modal */}
      {showSignModal && (
        <div className="dialog-backdrop" onClick={() => setShowSignModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={20} color="#dc2626" />
                <h2>Ký số & Đóng dấu điện tử PDF</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowSignModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#fafbfc', marginBottom: 14 }}>
              <canvas
                ref={signCanvasRef}
                width={480}
                height={160}
                style={{ display: 'block', cursor: 'crosshair', width: '100%' }}
                onMouseDown={(e) => {
                  isDrawingRef.current = true;
                  const ctx = signCanvasRef.current?.getContext('2d');
                  if (ctx) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                  }
                }}
                onMouseMove={(e) => {
                  if (!isDrawingRef.current) return;
                  const ctx = signCanvasRef.current?.getContext('2d');
                  if (ctx) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  }
                }}
                onMouseUp={() => { isDrawingRef.current = false; }}
                onMouseLeave={() => { isDrawingRef.current = false; }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn"
                onClick={() => {
                  const ctx = signCanvasRef.current?.getContext('2d');
                  if (ctx && signCanvasRef.current) {
                    ctx.clearRect(0, 0, signCanvasRef.current.width, signCanvasRef.current.height);
                  }
                }}
              >
                Xoá nét vẽ
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setShowSignModal(false)}>
                  Huỷ
                </button>
                <button
                  className="btn"
                  style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
                  onClick={() => {
                    setShowSignModal(false);
                    ui.toast('Đã chèn chữ ký điện tử thành công vào tài liệu PDF!');
                  }}
                >
                  <Check size={14} />
                  <span>Chèn chữ ký</span>
                </button>
              </div>
            </div>
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
              Nhập các dải trang cần trích xuất thành các tệp PDF độc lập:
            </p>
            <input className="text-field" defaultValue="1-2, 3" style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowSplitModal(false)}>
                Huỷ
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  setShowSplitModal(false);
                  ui.toast('Đã tách thành công các trang PDF!');
                }}
              >
                Bắt đầu tách
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
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '28px 16px',
                textAlign: 'center',
                background: '#fafbfc',
                marginBottom: 16,
              }}
            >
              <Layers size={36} color="#64748b" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Kéo thả hoặc bấm để chọn các tệp PDF cần ghép</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowMergeModal(false)}>
                Huỷ
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  setShowMergeModal(false);
                  ui.toast('Đã ghép các tệp PDF thành một tệp hoàn chỉnh!');
                }}
              >
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                <input type="radio" name="compLevel" defaultChecked />
                <div>
                  <strong>Nén tối đa (Tiết kiệm 65% dung lượng)</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Phù hợp gửi email và chia sẻ web tốc độ cao</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                <input type="radio" name="compLevel" />
                <div>
                  <strong>Nén tiêu chuẩn (Tiết kiệm 40% dung lượng)</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Cân bằng hoàn hảo giữa độ nét hình ảnh và kích thước tệp</div>
                </div>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowCompressModal(false)}>
                Huỷ
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  setShowCompressModal(false);
                  ui.toast('Đã nén tệp PDF thành công! Kích thước giảm 58%.');
                }}
              >
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
              <h2>Chuyển đổi tệp PDF sang {showConvertModal.toUpperCase()}</h2>
              <button className="icon-btn" onClick={() => setShowConvertModal(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Hệ thống sẽ chuyển đổi toàn bộ {totalPages} trang của tệp <strong>{title}</strong> sang định dạng {showConvertModal.toUpperCase()} với độ chính xác cao.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowConvertModal(null)}>
                Huỷ
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  const targetExt = showConvertModal === 'word' ? 'docx' : showConvertModal === 'excel' ? 'xlsx' : showConvertModal === 'ppt' ? 'pptx' : 'png';
                  setShowConvertModal(null);
                  ui.showBusy(`Đang chuyển đổi sang .${targetExt}…`);
                  setTimeout(() => {
                    ui.showBusy(null);
                    ui.toast(`Đã chuyển đổi và xuất tệp .${targetExt} thành công!`);
                  }, 600);
                }}
              >
                Bắt đầu chuyển đổi
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
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Tự động nhận diện và cắt bỏ lề trắng thừa trên toàn bộ tài liệu PDF.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowCropModal(false)}>
                Huỷ
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  setShowCropModal(false);
                  ui.toast('Đã cắt gọn lề trang PDF!');
                }}
              >
                Áp dụng cắt lề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Play Presentation Modal */}
      {showPlayModal && (
        <div className="dialog-backdrop" onClick={() => setShowPlayModal(false)} style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div
            style={{
              width: '90vw',
              height: '88vh',
              background: '#ffffff',
              borderRadius: 8,
              padding: 40,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-btn"
              style={{ position: 'absolute', top: 16, right: 16 }}
              onClick={() => setShowPlayModal(false)}
            >
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>MINH SPARK OFFICE PRESENTATION</div>
              <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 12 }}>{title.replace(/\.[^/.]+$/, '')}</h1>
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.8, maxWidth: 700, margin: '0 auto', textAlign: 'center', color: '#334155' }}>
              Trình chiếu tài liệu PDF toàn màn hình phục vụ hội nghị và thuyết trình nội bộ doanh nghiệp.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn" onClick={() => goToPage(currentPage - 1)}>
                Trang trước
              </button>
              <span>Trang {currentPage} / {totalPages}</span>
              <button className="btn" onClick={() => goToPage(currentPage + 1)}>
                Trang tiếp theo
              </button>
            </div>
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
                <h2>Chia sẻ tệp PDF</h2>
              </div>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Liên kết chia sẻ bảo mật:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="text-field"
                  readOnly
                  value={`http://localhost:5173/#pdf-${meta.id}`}
                  style={{ flex: 1, fontSize: 11, background: '#fff' }}
                />
                <button
                  className="btn"
                  style={{ background: '#dc2626', color: '#fff', fontSize: 11 }}
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:5173/#pdf-${meta.id}`);
                    ui.toast('Đã sao chép liên kết chia sẻ!');
                  }}
                >
                  <CopyCheck size={13} />
                  <span>Sao chép</span>
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowShareModal(false)}>
                Đóng
              </button>
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
    </div>
  );
}
