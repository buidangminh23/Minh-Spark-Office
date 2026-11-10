import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Save,
  Download,
  Printer,
  Upload,
  History,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Crop,
  Sliders,
  PenTool,
  Share2,
  Info,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Presentation,
  Trash2,
  MessageSquare,
  X,
  Type,
  Square,
  Circle,
  MoveRight,
  ShieldAlert,
  Undo2,
  Paintbrush,
  Sun,
  Contrast,
  Droplet,
} from 'lucide-react';

import { SuiteLogo } from '../../components/SuiteLogo';
import { useAccount } from '../../components/Authentication';
import { useWorkspace } from '../../lib/storage';
import { saveAccountSnapshot } from '../../lib/accountSnapshots';
import { useDocumentCloser } from '../../lib/documentCloser';
import { useUi } from '../../components/ui';
import { ImagePrintDialog } from './ImagePrintDialog';
import { downloadBlob } from '../../lib/download';
import {
  formatFileSize,
  formatResolution,
  formatAspectRatio,
  exportImageAsPdf,
  readImageFile,
} from '../../lib/imageFormats';
import type {
  FileMeta,
  ImageContent,
  FileVersion,
  CommentItem,
} from '../../lib/storage';
import { flattenEncoding, isMarkupBlank, screenOffsetToImagePoint } from './markupMath';
import { IMAGE_FILTER_PRESETS as PRESET_FILTERS, buildImageFilter, parseImageFilter } from './imageFilters';
import { trackWorkspaceOperation } from '../../lib/workspaceLifecycle';
import './imageEditor.css';

interface ImageEditorProps {
  meta: FileMeta;
  content: ImageContent;
  onSave: (
    meta: FileMeta,
    content: ImageContent,
    explicit?: boolean
  ) => Promise<boolean>;
  onRename: (name: string) => void;
  onBack: () => void;
  onOpenInDoc?: (dataUrl: string, name: string) => void;
  onOpenInSheet?: (dataUrl: string, name: string) => void;
  onOpenInSlide?: (dataUrl: string, name: string) => void;
}

type RibbonTab = 'view' | 'crop' | 'adjust' | 'markup' | 'office' | 'info';
type Backdrop = 'dark' | 'light' | 'checker';

export default function ImageEditor({
  meta,
  content,
  onSave,
  onRename,
  onBack,
  onOpenInDoc,
  onOpenInSheet,
  onOpenInSlide,
}: ImageEditorProps) {
  const ui = useUi();
  const { user, login } = useAccount();
  const sourceStorage = useWorkspace();
  const { listVersions, deleteVersion } = sourceStorage;

  const [activeTab, setActiveTab] = useState<RibbonTab>('view');
  const [title, setTitle] = useState(meta.name);
  const [printJob, setPrintJob] = useState<{ src: string; width: number; height: number } | null>(null);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [currentDataUrl, setCurrentDataUrl] = useState(content.imageDataUrl);
  const [mimeType, setMimeType] = useState(content.mimeType || 'image/png');
  const [dimensions, setDimensions] = useState({
    width: content.width || 800,
    height: content.height || 600,
  });

  const [zoom, setZoom] = useState(content.zoom || 100);
  const [autoFit, setAutoFit] = useState(true);
  const fitZoomRef = useRef<number | null>(content.zoom || 100);
  const [rotation, setRotation] = useState(content.rotation || 0);
  const [flipX, setFlipX] = useState(content.flipX || false);
  const [flipY, setFlipY] = useState(content.flipY || false);
  const [backdrop, setBackdrop] = useState<Backdrop>('dark');

  const [filterSettings, setFilterSettings] = useState(() => parseImageFilter(content.filter));
  const { preset: selectedFilter, brightness, contrast, saturation } = filterSettings;

  const [cropAspect, setCropAspect] = useState<
    'free' | '1:1' | '4:3' | '16:9' | '3:2' | '9:16'
  >('free');
  const [cropPercents, setCropPercents] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  const [markupTool, setMarkupTool] = useState<
    'none' | 'pen' | 'highlighter' | 'rect' | 'circle' | 'arrow' | 'censor' | 'text'
  >('none');
  const [markupColor, setMarkupColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(4);
  const [textInput, setTextInput] = useState('');

  const [comments, setComments] = useState<CommentItem[]>(
    content.comments || []
  );
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingMarkup = useRef(false);
  const markupHistory = useRef<ImageData[]>([]);
  const clearMarkupAfterCommit = useRef(false);

  const clearMarkupCanvas = useCallback(() => {
    const canvas = markupCanvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    markupHistory.current = [];
  }, []);

  useLayoutEffect(() => {
    if (!clearMarkupAfterCommit.current) return;
    clearMarkupAfterCommit.current = false;
    clearMarkupCanvas();
  }, [currentDataUrl, clearMarkupCanvas]);

  const flattenMarkup = useCallback(async (): Promise<{ url: string; mime: string }> => {
    const canvas = markupCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return { url: currentDataUrl, mime: mimeType };
    if (isMarkupBlank(ctx.getImageData(0, 0, canvas.width, canvas.height).data)) return { url: currentDataUrl, mime: mimeType };
    const img = new Image();
    img.src = currentDataUrl;
    await img.decode();
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('Canvas unavailable');
    const encoding = flattenEncoding(mimeType);
    if (encoding.mime === 'image/jpeg') {
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, out.width, out.height);
    }
    outCtx.drawImage(img, 0, 0, out.width, out.height);
    outCtx.drawImage(canvas, 0, 0);
    return { url: out.toDataURL(encoding.mime, encoding.quality), mime: encoding.mime };
  }, [currentDataUrl, mimeType]);

  const commitMarkup = useCallback((): Promise<{ url: string; mime: string }> => trackWorkspaceOperation(async () => {
    const flat = await flattenMarkup();
    if (flat.url === currentDataUrl) return flat;
    const preload = new Image();
    preload.src = flat.url;
    await preload.decode().catch(() => undefined);
    clearMarkupAfterCommit.current = true;
    setCurrentDataUrl(flat.url);
    setMimeType(flat.mime);
    return flat;
  }), [flattenMarkup, currentDataUrl]);

  const changeRevision = useRef(0);
  const markDirty = useCallback(() => {
    changeRevision.current++;
    setSavedStatus('saving');
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setDimensions({
        width: img.naturalWidth || 800,
        height: img.naturalHeight || 600,
      });
    };
    img.src = currentDataUrl;
  }, [currentDataUrl]);

  const activeCssFilter = buildImageFilter(filterSettings);

  const persistImage = useCallback(
    (explicit = false) => trackWorkspaceOperation(async () => {
      const savedRevision = changeRevision.current;
      let flat: { url: string; mime: string };
      try {
        flat = await commitMarkup();
      } catch {
        ui.toast('Không ghép được nét vẽ vào ảnh nên chưa lưu. Nét vẽ vẫn còn trên ảnh.', true);
        return false;
      }
      const updatedMeta: FileMeta = {
        ...meta,
        name: title.trim() || meta.name,
        updatedAt: Date.now(),
        preview: `${dimensions.width} × ${dimensions.height} · ${formatFileSize(
          meta.size
        )}`,
      };
      const updatedContent: ImageContent = {
        kind: 'image',
        imageDataUrl: flat.url,
        mimeType: flat.mime,
        width: dimensions.width,
        height: dimensions.height,
        comments,
        zoom,
        rotation,
        flipX,
        flipY,
        filter: activeCssFilter,
      };

      const saved = await onSave(updatedMeta, updatedContent, explicit);
      if (saved && changeRevision.current === savedRevision) {
        setSavedStatus('saved');
      }
      return saved;
    }),
    [
      meta,
      title,
      dimensions,
      commitMarkup,
      ui,
      comments,
      zoom,
      rotation,
      flipX,
      flipY,
      activeCssFilter,
      onSave,
    ]
  );

  useDocumentCloser((close) =>
    persistImage(false).then((saved) => {
      if (saved && close) onBack();
      return saved;
    })
  );

  const handleSaveNow = async () => {
    if (await persistImage(true)) {
      ui.toast('Đã lưu hình ảnh vào không gian làm việc!');
    }
  };

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== meta.name) {
      setTitle(trimmed);
      onRename(trimmed);
      markDirty();
    } else {
      setTitle(meta.name);
    }
  };

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setShowHistoryModal(true);
  };

  const handleCreateSnapshot = () => trackWorkspaceOperation(async () => {
    let flat: { url: string; mime: string };
    try {
      flat = await commitMarkup();
    } catch {
      ui.toast('Không ghép được nét vẽ vào ảnh nên chưa lưu phiên bản.', true);
      return;
    }
    const draft: ImageContent = {
      kind: 'image',
      imageDataUrl: flat.url,
      mimeType: flat.mime,
      width: dimensions.width,
      height: dimensions.height,
      comments,
      zoom,
      rotation,
      flipX,
      flipY,
      filter: activeCssFilter,
    };
    const currentMeta = { ...meta, name: title, updatedAt: Date.now() };
    try {
      if (!user) await sourceStorage.saveFile(currentMeta, draft);
      const account = await login();
      if (!account) return;
      const { version: saved } = await saveAccountSnapshot({
        accountId: account.uid,
        sourceUserId: user?.uid,
        sourceStorage,
        meta: currentMeta,
        content: draft,
        label: `Bản lưu ${new Date().toLocaleTimeString('vi-VN')}`,
      });
      setVersions((prev) => [saved, ...prev]);
      ui.toast('Đã lưu bản chụp ảnh vào lịch sử');
    } catch {
      ui.toast('Chưa lưu được phiên bản.', true);
    }
  });

  const handleDeleteVersion = (versionId: string) => trackWorkspaceOperation(async () => {
    await deleteVersion(meta.id, versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    ui.toast('Đã xoá phiên bản lưu');
  });

  const handleZoomIn = () => setZoom((z) => Math.min(800, z + 25));
  const handleZoomOut = () => setZoom((z) => Math.max(10, z - 25));
  const handleResetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };
  const fitToStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !dimensions.width || !dimensions.height) return;
    const margin = stage.clientWidth < 600 ? 32 : 80;
    const scale = Math.min(
      (stage.clientWidth - margin) / dimensions.width,
      (stage.clientHeight - margin) / dimensions.height,
      1
    );
    const next = Math.max(10, Math.round(scale * 100));
    fitZoomRef.current = next;
    setZoom(next);
    setPan({ x: 0, y: 0 });
  }, [dimensions.width, dimensions.height]);

  const handleFitScreen = () => {
    setAutoFit(true);
    fitToStage();
  };

  useEffect(() => {
    if (zoom !== fitZoomRef.current) setAutoFit(false);
  }, [zoom]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!autoFit || !stage || typeof ResizeObserver === 'undefined') return;
    fitToStage();
    const observer = new ResizeObserver(() => fitToStage());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [autoFit, fitToStage]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoom((z) => Math.max(10, Math.min(800, z + delta)));
    } else if (zoom > 100) {
      setPan((p) => ({
        x: p.x - e.deltaX * 0.8,
        y: p.y - e.deltaY * 0.8,
      }));
    }
  };

  const markupPoint = (e: React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return screenOffsetToImagePoint(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2),
      { scale: zoom / 100, rotation, flipX, flipY, width: canvas.width, height: canvas.height }
    );
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (markupTool === 'none' || e.button !== 0) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    markupHistory.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    );
    if (markupHistory.current.length > 20) markupHistory.current.shift();

    const { x, y } = markupPoint(e, canvas);

    isDrawingMarkup.current = true;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (markupTool === 'pen') {
      ctx.strokeStyle = markupColor;
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (markupTool === 'highlighter') {
      ctx.strokeStyle = markupColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = brushSize * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (markupTool === 'censor') {
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = 1.0;
      panStartRef.current = { x, y };
    } else if (
      markupTool === 'rect' ||
      markupTool === 'circle' ||
      markupTool === 'arrow'
    ) {
      panStartRef.current = { x, y };
    } else if (markupTool === 'text') {
      if (textInput.trim()) {
        ctx.fillStyle = markupColor;
        ctx.font = `bold ${Math.max(16, brushSize * 4)}px sans-serif`;
        ctx.fillText(textInput.trim(), x, y);
        markDirty();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    if (!isDrawingMarkup.current) return;
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = markupPoint(e, canvas);

    if (markupTool === 'pen' || markupTool === 'highlighter') {
      ctx.lineTo(x, y);
      ctx.stroke();
      markDirty();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDrawingMarkup.current) return;
    isDrawingMarkup.current = false;

    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x: currentX, y: currentY } = markupPoint(e, canvas);
    const startX = panStartRef.current.x;
    const startY = panStartRef.current.y;

    if (markupTool === 'rect') {
      ctx.strokeStyle = markupColor;
      ctx.lineWidth = brushSize;
      ctx.globalAlpha = 1.0;
      ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
      markDirty();
    } else if (markupTool === 'circle') {
      ctx.strokeStyle = markupColor;
      ctx.lineWidth = brushSize;
      ctx.globalAlpha = 1.0;
      const radiusX = Math.abs(currentX - startX) / 2;
      const radiusY = Math.abs(currentY - startY) / 2;
      const centerX = Math.min(startX, currentX) + radiusX;
      const centerY = Math.min(startY, currentY) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
      markDirty();
    } else if (markupTool === 'arrow') {
      ctx.strokeStyle = markupColor;
      ctx.fillStyle = markupColor;
      ctx.lineWidth = brushSize;
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      const angle = Math.atan2(currentY - startY, currentX - startX);
      const headLen = Math.max(12, brushSize * 3);
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(
        currentX - headLen * Math.cos(angle - Math.PI / 6),
        currentY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        currentX - headLen * Math.cos(angle + Math.PI / 6),
        currentY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      markDirty();
    } else if (markupTool === 'censor') {
      const rx = Math.min(startX, currentX);
      const ry = Math.min(startY, currentY);
      const rw = Math.abs(currentX - startX);
      const rh = Math.abs(currentY - startY);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
      markDirty();
    }
  };

  const handleUndoMarkup = () => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = markupHistory.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      markDirty();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      markDirty();
    }
  };

  const handleClearMarkup = () => {
    const canvas = markupCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    markDirty();
    ui.toast('Đã xoá các nét vẽ');
  };

  const handleApplyCrop = async () => {
    ui.showBusy('Đang cắt ảnh…');
    try {
      const source = (await commitMarkup()).url;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = source;
      await img.decode();
      const { left, right, top, bottom } = cropPercents;
      const sx = (img.naturalWidth * left) / 100;
      const sy = (img.naturalHeight * top) / 100;
      const sw = img.naturalWidth * (1 - (left + right) / 100);
      const sh = img.naturalHeight * (1 - (top + bottom) / 100);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const croppedUrl = canvas.toDataURL('image/png');
      clearMarkupAfterCommit.current = true;
      setCurrentDataUrl(croppedUrl);
      setMimeType('image/png');
      setDimensions({ width: canvas.width, height: canvas.height });
      setCropPercents({ top: 0, right: 0, bottom: 0, left: 0 });
      markDirty();
      ui.toast('Đã cắt ảnh thành công');
    } catch {
      ui.toast('Không cắt được ảnh. Ảnh và nét vẽ vẫn được giữ lại.', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleBakeAllToDataUrl = async (): Promise<string> => {
    const img = new Image();
    img.src = (await flattenMarkup()).url;
    await img.decode();

    const isQuarter = rotation % 180 !== 0;
    const w = isQuarter ? dimensions.height : dimensions.width;
    const h = isQuarter ? dimensions.width : dimensions.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.save();
    if (activeCssFilter && activeCssFilter !== 'none') {
      ctx.filter = activeCssFilter;
    }
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(
      img,
      -dimensions.width / 2,
      -dimensions.height / 2,
      dimensions.width,
      dimensions.height
    );
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  const bakeOrReport = async () => {
    try {
      return await handleBakeAllToDataUrl();
    } catch {
      ui.toast('Không chuẩn bị được ảnh kèm nét vẽ', true);
      return null;
    }
  };

  const handleExport = async (format: 'png' | 'jpeg' | 'webp' | 'pdf') => {
    try {
      ui.showBusy(`Đang xuất ảnh dưới dạng ${format.toUpperCase()}…`);
      const bakedUrl = await handleBakeAllToDataUrl();
      const baseTitle = title.replace(/\.[^/.]+$/, '');

      if (format === 'pdf') {
        const pdfBlob = await exportImageAsPdf(bakedUrl, title);
        downloadBlob(pdfBlob, `${baseTitle}.pdf`);
        ui.toast('Đã tải xuống tài liệu PDF');
      } else {
        const img = new Image();
        img.src = bakedUrl;
        await new Promise((r) => {
          img.onload = r;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (format === 'jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
        }

        const mime =
          format === 'jpeg'
            ? 'image/jpeg'
            : format === 'webp'
            ? 'image/webp'
            : 'image/png';
        const quality = format === 'jpeg' ? 0.92 : 0.95;
        const outUrl = canvas.toDataURL(mime, quality);

        const res = await fetch(outUrl);
        const blob = await res.blob();
        downloadBlob(blob, `${baseTitle}.${format}`);
        ui.toast(`Đã tải xuống ${baseTitle}.${format}`);
      }
    } catch {
      ui.toast('Có lỗi khi xuất ảnh', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleOpenPrint = async () => {
    try {
      ui.showBusy('Đang chuẩn bị ảnh để in…');
      const bakedUrl = await handleBakeAllToDataUrl();
      const img = new Image();
      img.src = bakedUrl;
      await img.decode();
      setPrintJob({ src: bakedUrl, width: img.naturalWidth || dimensions.width, height: img.naturalHeight || dimensions.height });
    } catch {
      ui.toast('Không chuẩn bị được ảnh để in', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const openPrintRef = useRef(handleOpenPrint);
  openPrintRef.current = handleOpenPrint;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void openPrintRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleCopyToClipboard = async () => {
    try {
      const bakedUrl = await handleBakeAllToDataUrl();
      const res = await fetch(bakedUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      ui.toast('Đã sao chép ảnh vào bộ nhớ tạm');
    } catch {
      ui.toast('Không thể sao chép vào bộ nhớ tạm trên trình duyệt này', true);
    }
  };

  const handleUploadAnother = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      ui.showBusy(`Đang tải ảnh ${file.name}…`);
      const parsed = await readImageFile(file);
      setTitle(file.name);
      setCurrentDataUrl(parsed.dataUrl);
      setMimeType(parsed.mimeType);
      setDimensions({ width: parsed.width, height: parsed.height });
      handleResetZoom();
      handleClearMarkup();
      markDirty();
      ui.toast(`Đã nạp ảnh "${file.name}"`);
    } catch {
      ui.toast('Không đọc được tệp ảnh này', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const cmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: 'Sếp Bùi Đăng Minh',
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [cmt, ...prev]);
    setNewCommentText('');
    markDirty();
    ui.toast('Đã thêm ghi chú bình luận');
  };

  return (
    <div className="image-editor-shell">
      {printJob && <ImagePrintDialog src={printJob.src} width={printJob.width} height={printJob.height} title={title.replace(/\.[^/.]+$/, '')} onClose={() => setPrintJob(null)} />}
      {/* Top Bar */}
      <header className="image-editor-top">
        <div className="image-title-group">
          <button
            className="icon-btn"
            onClick={() => {
              void persistImage(false).then((saved) => {
                if (saved) onBack();
              });
            }}
            title="Quay lại danh sách tệp"
          >
            <ArrowLeft size={18} />
          </button>
          <SuiteLogo kind="image" size={32} decorative={false} />
          <input
            className="image-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            title="Nhấp để đổi tên tệp ảnh"
          />
          <div
            className={`save-pill ${savedStatus}`}
            onClick={handleOpenHistory}
            title="Xem lịch sử phiên bản"
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

        <div className="image-top-actions">
          <label className="image-tool-btn" style={{ cursor: 'pointer' }}>
            <Upload size={14} />
            <span>Mở ảnh</span>
            <input
              type="file"
              accept="image/*,.heic,.heif,.tiff,.tif"
              hidden
              onChange={handleUploadAnother}
            />
          </label>
          <button
            className="image-tool-btn"
            onClick={handleOpenHistory}
            title="Lịch sử phiên bản"
          >
            <History size={14} />
            <span>Lịch sử</span>
          </button>
          <button
            className="image-tool-btn"
            onClick={handleSaveNow}
            title="Lưu chính thức"
          >
            <Save size={14} />
            <span>Lưu</span>
          </button>
          <button
            className="image-tool-btn"
            onClick={() => handleExport('png')}
            title="Tải ảnh PNG về máy"
            style={{ background: '#2563eb', borderColor: '#1d4ed8', color: '#fff' }}
          >
            <Download size={14} />
            <span>Tải PNG</span>
          </button>
          <button
            className="image-tool-btn"
            onClick={() => handleExport('pdf')}
            title="Xuất sang tài liệu PDF"
            style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
          >
            <Download size={14} />
            <span>Xuất PDF</span>
          </button>
          <button
            className="image-tool-btn"
            onClick={() => void handleOpenPrint()}
            title="In hình ảnh (Ctrl+P)"
          >
            <Printer size={14} />
          </button>
          <button
            className={`image-tool-btn ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
            title="Bình luận & Ghi chú"
          >
            <MessageSquare size={14} />
            {comments.length > 0 && <span>({comments.length})</span>}
          </button>
        </div>
      </header>

      {/* Ribbon Bar */}
      <nav className="image-ribbon">
        <div className="image-ribbon-tabs">
          <button
            className={`image-ribbon-tab ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            <Eye size={14} />
            <span>Xem & Thu phóng</span>
          </button>
          <button
            className={`image-ribbon-tab ${activeTab === 'crop' ? 'active' : ''}`}
            onClick={() => setActiveTab('crop')}
          >
            <Crop size={14} />
            <span>Cắt & Xoay</span>
          </button>
          <button
            className={`image-ribbon-tab ${activeTab === 'adjust' ? 'active' : ''}`}
            onClick={() => setActiveTab('adjust')}
          >
            <Sliders size={14} />
            <span>Màu sắc & Bộ lọc</span>
          </button>
          <button
            className={`image-ribbon-tab ${activeTab === 'markup' ? 'active' : ''}`}
            onClick={() => setActiveTab('markup')}
          >
            <PenTool size={14} />
            <span>Vẽ & Che thông tin</span>
          </button>
          <button
            className={`image-ribbon-tab ${activeTab === 'office' ? 'active' : ''}`}
            onClick={() => setActiveTab('office')}
          >
            <Share2 size={14} />
            <span>Chuyển sang Office</span>
          </button>
          <button
            className={`image-ribbon-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Info size={14} />
            <span>Thông tin</span>
          </button>
        </div>

        <div className="image-ribbon-content">
          {activeTab === 'view' && (
            <>
              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={handleZoomIn}
                  title="Phóng to (Ctrl + Cuộn lên)"
                >
                  <ZoomIn size={14} />
                  <span>Phóng to</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={handleZoomOut}
                  title="Thu nhỏ (Ctrl + Cuộn xuống)"
                >
                  <ZoomOut size={14} />
                  <span>Thu nhỏ</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={handleResetZoom}
                  title="Xem kích thước thật 100%"
                >
                  <span>100%</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={handleFitScreen}
                  title="Vừa màn hình"
                >
                  <Maximize2 size={14} />
                  <span>Vừa khung</span>
                </button>
              </div>

              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={() => {
                    setRotation((r) => (r + 270) % 360);
                    markDirty();
                  }}
                  title="Xoay trái 90°"
                >
                  <RotateCcw size={14} />
                  <span>Xoay trái</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={() => {
                    setRotation((r) => (r + 90) % 360);
                    markDirty();
                  }}
                  title="Xoay phải 90°"
                >
                  <RotateCw size={14} />
                  <span>Xoay phải</span>
                </button>
                <button
                  className={`image-tool-btn ${flipX ? 'active' : ''}`}
                  onClick={() => {
                    setFlipX(!flipX);
                    markDirty();
                  }}
                  title="Lật ngang"
                >
                  <FlipHorizontal size={14} />
                  <span>Lật ngang</span>
                </button>
                <button
                  className={`image-tool-btn ${flipY ? 'active' : ''}`}
                  onClick={() => {
                    setFlipY(!flipY);
                    markDirty();
                  }}
                  title="Lật dọc"
                >
                  <FlipVertical size={14} />
                  <span>Lật dọc</span>
                </button>
              </div>

              <div className="image-tool-group">
                <button
                  className={`image-tool-btn ${backdrop === 'dark' ? 'active' : ''}`}
                  onClick={() => setBackdrop('dark')}
                  title="Nền tối"
                >
                  <span>Nền tối</span>
                </button>
                <button
                  className={`image-tool-btn ${backdrop === 'light' ? 'active' : ''}`}
                  onClick={() => setBackdrop('light')}
                  title="Nền sáng"
                >
                  <span>Nền sáng</span>
                </button>
                <button
                  className={`image-tool-btn ${backdrop === 'checker' ? 'active' : ''}`}
                  onClick={() => setBackdrop('checker')}
                  title="Nền caro trong suốt"
                >
                  <span>Nền caro</span>
                </button>
              </div>

              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={handleCopyToClipboard}
                  title="Sao chép ảnh vào Clipboard"
                >
                  {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép ảnh'}</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'crop' && (
            <>
              <div className="image-tool-group">
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Tỉ lệ:</span>
                {(['free', '1:1', '4:3', '16:9', '3:2', '9:16'] as const).map(
                  (ratio) => (
                    <button
                      key={ratio}
                      className={`image-tool-btn ${
                        cropAspect === ratio ? 'active' : ''
                      }`}
                      onClick={() => setCropAspect(ratio)}
                    >
                      <span>{ratio === 'free' ? 'Tự do' : ratio}</span>
                    </button>
                  )
                )}
              </div>

              <div className="image-tool-group">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <label key={side} className="slider-group">
                    <span>
                      {{ top: 'Trên', bottom: 'Dưới', left: 'Trái', right: 'Phải' }[
                        side
                      ]}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={45}
                      value={cropPercents[side]}
                      onChange={(e) =>
                        setCropPercents({
                          ...cropPercents,
                          [side]: Number(e.target.value),
                        })
                      }
                    />
                    <span>{cropPercents[side]}%</span>
                  </label>
                ))}
              </div>

              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={handleApplyCrop}
                  style={{ background: '#0284c7', borderColor: '#38bdf8' }}
                >
                  <Crop size={14} />
                  <span>Áp dụng cắt</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={() =>
                    setCropPercents({ top: 0, right: 0, bottom: 0, left: 0 })
                  }
                >
                  <span>Huỷ</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'adjust' && (
            <>
              <div className="image-tool-group">
                <div className="filter-presets">
                  {PRESET_FILTERS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`filter-thumb ${
                        selectedFilter === preset.id ? 'active' : ''
                      }`}
                      onClick={() => {
                        setFilterSettings((current) => ({ ...current, preset: preset.id, preservedFilter: '' }));
                        markDirty();
                      }}
                    >
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="image-tool-group">
                <label className="slider-group">
                  <Sun size={13} />
                  <span>Sáng:</span>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    value={brightness}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFilterSettings((current) => ({ ...current, brightness: value }));
                      markDirty();
                    }}
                  />
                  <span>{brightness}%</span>
                </label>
                <label className="slider-group">
                  <Contrast size={13} />
                  <span>Tương phản:</span>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    value={contrast}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFilterSettings((current) => ({ ...current, contrast: value }));
                      markDirty();
                    }}
                  />
                  <span>{contrast}%</span>
                </label>
                <label className="slider-group">
                  <Droplet size={13} />
                  <span>Bão hoà:</span>
                  <input
                    type="range"
                    min={0}
                    max={250}
                    value={saturation}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setFilterSettings((current) => ({ ...current, saturation: value }));
                      markDirty();
                    }}
                  />
                  <span>{saturation}%</span>
                </label>
              </div>

              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={() => {
                    setFilterSettings(parseImageFilter(undefined));
                    markDirty();
                  }}
                >
                  <span>Đặt lại màu</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'markup' && (
            <>
              <div className="image-tool-group">
                <button
                  className={`image-tool-btn ${markupTool === 'pen' ? 'active' : ''}`}
                  onClick={() => setMarkupTool(markupTool === 'pen' ? 'none' : 'pen')}
                  title="Bút vẽ"
                >
                  <PenTool size={14} />
                  <span>Bút vẽ</span>
                </button>
                <button
                  className={`image-tool-btn ${
                    markupTool === 'highlighter' ? 'active' : ''
                  }`}
                  onClick={() =>
                    setMarkupTool(
                      markupTool === 'highlighter' ? 'none' : 'highlighter'
                    )
                  }
                  title="Dạ quang"
                >
                  <Paintbrush size={14} />
                  <span>Dạ quang</span>
                </button>
                <button
                  className={`image-tool-btn ${markupTool === 'rect' ? 'active' : ''}`}
                  onClick={() =>
                    setMarkupTool(markupTool === 'rect' ? 'none' : 'rect')
                  }
                  title="Khung chữ nhật"
                >
                  <Square size={14} />
                  <span>Khung</span>
                </button>
                <button
                  className={`image-tool-btn ${
                    markupTool === 'circle' ? 'active' : ''
                  }`}
                  onClick={() =>
                    setMarkupTool(markupTool === 'circle' ? 'none' : 'circle')
                  }
                  title="Hình tròn"
                >
                  <Circle size={14} />
                  <span>Tròn</span>
                </button>
                <button
                  className={`image-tool-btn ${
                    markupTool === 'arrow' ? 'active' : ''
                  }`}
                  onClick={() =>
                    setMarkupTool(markupTool === 'arrow' ? 'none' : 'arrow')
                  }
                  title="Mũi tên"
                >
                  <MoveRight size={14} />
                  <span>Mũi tên</span>
                </button>
                <button
                  className={`image-tool-btn ${
                    markupTool === 'censor' ? 'active' : ''
                  }`}
                  onClick={() =>
                    setMarkupTool(markupTool === 'censor' ? 'none' : 'censor')
                  }
                  title="Che mờ thông tin nhạy cảm"
                  style={{
                    background: markupTool === 'censor' ? '#dc2626' : undefined,
                  }}
                >
                  <ShieldAlert size={14} />
                  <span>Che thông tin</span>
                </button>
              </div>

              <div className="image-tool-group">
                <div className="color-swatch-picker">
                  {[
                    '#ef4444',
                    '#f59e0b',
                    '#10b981',
                    '#3b82f6',
                    '#8b5cf6',
                    '#ffffff',
                    '#000000',
                  ].map((color) => (
                    <div
                      key={color}
                      className={`color-swatch ${
                        markupColor === color ? 'active' : ''
                      }`}
                      style={{ background: color }}
                      onClick={() => setMarkupColor(color)}
                    />
                  ))}
                </div>
                <label className="slider-group">
                  <span>Cỡ nét:</span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                  />
                  <span>{brushSize}px</span>
                </label>
              </div>

              <div className="image-tool-group">
                <input
                  type="text"
                  placeholder="Chữ cần chèn…"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '12px',
                    width: '110px',
                  }}
                />
                <button
                  className={`image-tool-btn ${markupTool === 'text' ? 'active' : ''}`}
                  onClick={() =>
                    setMarkupTool(markupTool === 'text' ? 'none' : 'text')
                  }
                  title="Chèn chữ lên ảnh"
                >
                  <Type size={14} />
                  <span>Chèn chữ</span>
                </button>
              </div>

              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={handleUndoMarkup}
                  title="Hoàn tác nét vẽ"
                >
                  <Undo2 size={14} />
                  <span>Hoàn tác</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={handleClearMarkup}
                  title="Xoá tất cả nét vẽ"
                >
                  <span>Xoá hết</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'office' && (
            <>
              <div className="image-tool-group">
                <button
                  className="image-tool-btn"
                  onClick={async () => {
                    const baked = await bakeOrReport();
                    if (!baked) return;
                    if (onOpenInDoc) onOpenInDoc(baked, title);
                    else ui.toast('Đã chuẩn bị ảnh cho Minh Docs');
                  }}
                  title="Tạo tài liệu Word mới chứa ảnh này"
                  style={{ background: '#1d4ed8', color: '#fff' }}
                >
                  <FileText size={14} />
                  <span>Mở trong Minh Docs (Word)</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={async () => {
                    const baked = await bakeOrReport();
                    if (!baked) return;
                    if (onOpenInSheet) onOpenInSheet(baked, title);
                    else ui.toast('Đã chuẩn bị ảnh cho Minh Sheets');
                  }}
                  title="Chèn ảnh vào bảng tính Minh Sheets"
                  style={{ background: '#059669', color: '#fff' }}
                >
                  <FileSpreadsheet size={14} />
                  <span>Mở trong Minh Sheets (Excel)</span>
                </button>
                <button
                  className="image-tool-btn"
                  onClick={async () => {
                    const baked = await bakeOrReport();
                    if (!baked) return;
                    if (onOpenInSlide) onOpenInSlide(baked, title);
                    else ui.toast('Đã chuẩn bị ảnh cho Minh Slides');
                  }}
                  title="Tạo Slide trình chiếu PowerPoint với ảnh này"
                  style={{ background: '#ea580c', color: '#fff' }}
                >
                  <Presentation size={14} />
                  <span>Mở trong Minh Slides (PowerPoint)</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'info' && (
            <div className="image-tool-group" style={{ fontSize: '12px' }}>
              <span>
                <strong>Độ phân giải:</strong>{' '}
                {formatResolution(dimensions.width, dimensions.height)}
              </span>
              <span>
                <strong>Tỉ lệ:</strong>{' '}
                {formatAspectRatio(dimensions.width, dimensions.height)}
              </span>
              <span>
                <strong>Dung lượng:</strong> {formatFileSize(meta.size)}
              </span>
              <span>
                <strong>Định dạng:</strong>{' '}
                {title.split('.').pop()?.toUpperCase() ?? 'IMAGE'} (
                {content.mimeType || 'image/png'})
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Stage */}
      <main
        ref={stageRef}
        className={`image-stage-container backdrop-${backdrop} ${
          markupTool !== 'none'
            ? 'drawing'
            : zoom > 100
            ? isPanning
              ? 'is-panning'
              : 'panning'
            : ''
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="image-info-pill"
          title="Thông số hiển thị của hình ảnh"
        >
          <span className="image-info-badge">
            {title.split('.').pop()?.toUpperCase() ?? 'IMG'}
          </span>
          <span>
            {dimensions.width} × {dimensions.height}
          </span>
          <span>·</span>
          <span>{formatFileSize(meta.size)}</span>
        </div>

        <div
          className="image-canvas-wrapper"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${
              zoom / 100
            }) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${
              flipY ? -1 : 1
            })`,
            filter: activeCssFilter,
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          <img
            src={currentDataUrl}
            alt={title}
            width={dimensions.width}
            height={dimensions.height}
            draggable={false}
            style={{
              display: 'block',
              pointerEvents: 'none',
              clipPath:
                cropPercents.top > 0 ||
                cropPercents.right > 0 ||
                cropPercents.bottom > 0 ||
                cropPercents.left > 0
                  ? `inset(${cropPercents.top}% ${cropPercents.right}% ${cropPercents.bottom}% ${cropPercents.left}%)`
                  : undefined,
            }}
          />
          <canvas
            ref={markupCanvasRef}
            width={dimensions.width}
            height={dimensions.height}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: markupTool !== 'none' ? 'auto' : 'none',
            }}
          />
        </div>

        {/* Floating Zoom HUD */}
        <div className="image-floating-hud">
          <button
            className="image-hud-btn"
            onClick={handleZoomOut}
            title="Thu nhỏ"
          >
            <ZoomOut size={15} />
          </button>
          <span className="image-zoom-text">{zoom}%</span>
          <button
            className="image-hud-btn"
            onClick={handleZoomIn}
            title="Phóng to"
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="image-hud-btn"
            onClick={handleFitScreen}
            title="Vừa khung hình"
          >
            <Maximize2 size={15} />
          </button>
          <button
            className="image-hud-btn"
            onClick={handleResetZoom}
            title="Xem 100%"
          >
            <span style={{ fontSize: '11px', fontWeight: 600 }}>1:1</span>
          </button>
        </div>

        {/* Comments Sidebar */}
        {showComments && (
          <aside className="image-comments-drawer">
            <div className="image-comments-header">
              <span>Bình luận & Chú thích ({comments.length})</span>
              <button
                className="icon-btn"
                onClick={() => setShowComments(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="image-comments-list">
              {comments.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                  Chưa có bình luận nào cho bức ảnh này.
                </div>
              ) : (
                comments.map((cmt) => (
                  <div key={cmt.id} className="image-comment-item">
                    <div className="image-comment-meta">
                      <span className="image-comment-author">{cmt.author}</span>
                      <span>{new Date(cmt.createdAt).toLocaleTimeString('vi-VN')}</span>
                    </div>
                    <div className="image-comment-text">{cmt.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="image-comment-input-box">
              <input
                className="image-comment-input"
                type="text"
                placeholder="Thêm ghi chú cho bức ảnh…"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
              >
                Gửi
              </button>
            </div>
          </aside>
        )}
      </main>

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="sync-dialog-backdrop">
          <section
            className="sync-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h2 id="history-modal-title">Lịch sử phiên bản hình ảnh</h2>
              <button className="icon-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p>Xem các bản chụp lưu của bức ảnh và khôi phục khi cần thiết.</p>

            <div style={{ maxHeight: '240px', overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {versions.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  Chưa có bản chụp lưu nào được ghi nhận.
                </div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#0f172a',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                        {ver.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(ver.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => {
                          if (ver.content.kind === 'image') {
                            clearMarkupCanvas();
                            setCurrentDataUrl(ver.content.imageDataUrl);
                            setMimeType(ver.content.mimeType || 'image/png');
                            setRotation(ver.content.rotation || 0);
                            setFlipX(ver.content.flipX || false);
                            setFlipY(ver.content.flipY || false);
                            setFilterSettings(parseImageFilter(ver.content.filter));
                            setComments(ver.content.comments || []);
                            setZoom(ver.content.zoom || 100);
                            setAutoFit(false);
                            setPan({ x: 0, y: 0 });
                            setDimensions({
                              width: ver.content.width || 800,
                              height: ver.content.height || 600,
                            });
                            markDirty();
                            setShowHistoryModal(false);
                            ui.toast('Đã khôi phục phiên bản đã chọn');
                          }
                        }}
                      >
                        Khôi phục
                      </button>
                      <button
                        className="icon-btn"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleDeleteVersion(ver.id)}
                        title="Xoá bản chụp"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sync-dialog-actions" style={{ width: '100%' }}>
              <button className="btn" onClick={() => setShowHistoryModal(false)}>
                Đóng
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSnapshot}
              >
                Tạo bản chụp mới
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
