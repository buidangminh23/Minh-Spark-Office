import { suiteLogos } from './lib/suiteBranding';
import { Authentication, useAccount } from './components/Authentication';
import { createDraftWorkspaceStorage, WorkspaceContext, useWorkspace } from './lib/storage';
import { accountWorkspace, syncedWorkspace } from './lib/workspaces';
import { WorkspaceStatus } from './components/WorkspaceStatus';
import { DesktopUpdater } from './components/DesktopUpdater';
import { DesktopCloseGuard } from './components/DesktopCloseGuard';
import { createDesktopFileQueue } from './lib/desktopFileQueue';
import { workspaceLifecycle } from './lib/workspaceLifecycle';
import { DesktopSignIn, isDesktopSignInRequest } from './components/DesktopSignIn';
import { isDesktop } from './lib/desktop';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Home from './components/Home';
import { isImageFile, formatFileSize } from './lib/imageFormatNames';
import { UiProvider, useUi } from './components/ui';
import {
  estimateStorage,
  defaultPage,
  type FileMeta,
  type FileContent,
  type DocContent,
  type SheetContent,
  type PdfContent,
  type SlideContent,
  type ImageContent,
} from './lib/storage';
import { blankDoc, sampleDocHtml, sampleWorkbook } from './lib/templates';
import { blankPresentation, businessPitchPresentation, createSlideFromLayout } from './lib/slideTemplates';
import type { PresentationData } from './lib/slideTypes';
import { emptyWorkbook } from './lib/workbookBasics';
import { downloadBlob } from './lib/download';
import { isChunkLoadError, reloadOnceForStaleChunk } from './lib/staleChunk';
import type { FileKind } from './lib/storage';

const editorLoaders = {
  doc: () => import('./editors/doc/DocEditor'),
  sheet: () => import('./editors/sheet/SheetEditor'),
  pdf: () => import('./editors/pdf/PdfEditor'),
  slide: () => import('./editors/slide/SlideEditor'),
  image: () => import('./editors/image/ImageEditor'),
};
type EditorKind = keyof typeof editorLoaders;
type LoadedEditors = { [K in EditorKind]?: Awaited<ReturnType<(typeof editorLoaders)[K]>>['default'] };
const loadedEditors: LoadedEditors = {};

const loadEditor = async (kind: EditorKind) => {
  const module = await editorLoaders[kind]();
  (loadedEditors as Record<EditorKind, unknown>)[kind] = module.default;
};

function useLoadedEditors(kind: EditorKind | null, onError: (error: unknown) => void) {
  const [, setLoaded] = useState(0);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (!kind || loadedEditors[kind]) return;
    let alive = true;
    loadEditor(kind).then(() => { if (alive) setLoaded((count) => count + 1); }, (error) => { if (alive) errorRef.current(error); });
    return () => { alive = false; };
  }, [kind]);
  return loadedEditors;
}

function EditorLoading({ kind }: { kind: FileKind }) {
  return (
    <div role="status" aria-label="Đang tải trình soạn thảo" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#f6f7fb', zIndex: 1000 }}>
      <div className="desktop-splash-content">
        <div className="desktop-splash-mark">
          <svg className="desktop-splash-ring" viewBox="0 0 132 132"><circle className="desktop-splash-track" cx="66" cy="66" r="64" /><circle className="desktop-splash-arc" cx="66" cy="66" r="64" /></svg>
          <div className="desktop-splash-tile"><img src={suiteLogos[kind]} alt="" width="62" height="62" /></div>
        </div>
        <p className="desktop-splash-name">Minh Spark Office</p>
      </div>
    </div>
  );
}

function MainApp({ onEditing }: { onEditing: (editing: boolean) => void }) {
  const ui = useUi();
  const toast = ui.toast;
  const { user, ready, login } = useAccount();
  const storage = useWorkspace();
  const { listFiles, loadContent, saveFile, updateMeta, removeFile, exportBackup, importBackup } = useWorkspace();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [activeMeta, setActiveMeta] = useState<FileMeta | null>(null);
  const [activeContent, setActiveContent] = useState<FileContent | null>(null);
  const activeEditorKind = activeMeta && activeContent && activeMeta.kind === activeContent.kind ? activeMeta.kind : null;
  const editors = useLoadedEditors(activeEditorKind, (error) => {
    if (isChunkLoadError(error) && reloadOnceForStaleChunk()) return;
    console.error(error);
    toast('Không tải được trình soạn thảo. Kiểm tra kết nối mạng rồi mở lại tệp.', true);
    setActiveMeta(null);
    setActiveContent(null);
  });
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);

  const activeKind = activeMeta?.kind;

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = activeKind ? suiteLogos[activeKind] : '/logo-icon.png';
  }, [activeKind]);

  const initialized = useRef<typeof storage | null>(null);
  const currentStorage = useRef(storage);
  currentStorage.current = storage;

  const activeDocument = useRef(activeMeta);
  activeDocument.current = activeMeta;
  const openDocumentKey = `minh-office-open:${user?.uid ?? 'drafts'}`;

  useEffect(() => {
    onEditing(Boolean(activeMeta));
    syncedWorkspace(storage)?.setActiveFile(activeMeta?.id ?? null);
    return () => { syncedWorkspace(storage)?.setActiveFile(null); onEditing(false); };
  }, [activeMeta?.id, storage, onEditing]);

  useEffect(() => {
    let mounted = true;
    const sync = syncedWorkspace(storage);
    const refresh = () => { void storage.listFiles().then(async (list) => {
      if (!mounted) return;
      setFiles(list);
      const requested = sessionStorage.getItem(openDocumentKey);
      const meta = !activeDocument.current && requested ? list.find((file) => file.id === requested && !file.deletedAt) : undefined;
      if (meta) sync?.setActiveFile(meta.id);
      const content = meta ? await storage.loadContent(meta.id) : undefined;
      if (mounted && meta && content && !activeDocument.current && sessionStorage.getItem(openDocumentKey) === requested) { activeDocument.current = meta; setActiveMeta(meta); setActiveContent(content); }
    }); };
    const stop = sync?.subscribe(refresh);
    const openSaved = (event: Event) => {
      const { uid, id } = (event as CustomEvent<{ uid: string; id: string }>).detail;
      if (uid !== user?.uid) return;
      void storage.listFiles().then(async (list) => {
        const meta = list.find((file) => file.id === id);
        if (activeDocument.current || sessionStorage.getItem(openDocumentKey) !== id) return;
        if (meta) sync?.setActiveFile(meta.id);
        const content = meta && await storage.loadContent(id);
        if (mounted && meta && content && !activeDocument.current && sessionStorage.getItem(openDocumentKey) === id) { activeDocument.current = meta; setActiveMeta(meta); setActiveContent(content); }
      });
    };
    window.addEventListener('office-open-saved', openSaved);
    return () => { mounted = false; stop?.(); window.removeEventListener('office-open-saved', openSaved); };
  }, [storage, user?.uid, openDocumentKey]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const restore = async () => {
      try {
        const id = sessionStorage.getItem(openDocumentKey);
        if (!id || activeDocument.current) return;
        const meta = (await storage.listFiles()).find((file) => file.id === id && !file.deletedAt);
        if (meta && !activeDocument.current) syncedWorkspace(storage)?.setActiveFile(meta.id);
        const content = meta ? await storage.loadContent(meta.id) : undefined;
        if (active && meta && content?.kind === meta.kind && !activeDocument.current) {
          activeDocument.current = meta;
          setActiveMeta(meta);
          setActiveContent(content);
        }
      } catch {
        if (active) toast('Chưa mở lại được bản nháp. Hãy thử mở từ danh sách tài liệu.', true);
      }
    };
    void restore();
    return () => { active = false; };
  }, [ready, storage, openDocumentKey, toast]);

  useEffect(() => {
    if (!ready || !activeMeta) return;
    try { sessionStorage.setItem(openDocumentKey, activeMeta.id); } catch { return; }
  }, [ready, activeMeta, openDocumentKey]);

  // Refresh files list and storage
  const refreshFiles = useCallback(async () => {
    const list = await listFiles();
    setFiles(list);
    const est = await estimateStorage();
    if (est) setStorageInfo(est);
  }, [listFiles]);

  const handleCloseEditor = () => {
    try { sessionStorage.removeItem(openDocumentKey); } catch {}
    activeDocument.current = null;
    setActiveMeta(null);
    setActiveContent(null);
    void refreshFiles();
  };

  // Initial load & seed default files if empty
  useEffect(() => {
    if (initialized.current === storage) return;
    initialized.current = storage;
    const init = async () => {
      const list = await listFiles();
      if (list.length === 0 && !user) {
        // Seed initial Word doc
        const docId = `doc-${Date.now()}`;
        const docMeta: FileMeta = {
          id: docId,
          name: 'Kế hoạch hoạt động quý IV.docx',
          kind: 'doc',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: true,
          deletedAt: null,
          size: 15400,
          preview: 'CÔNG TY MINH SPARK · BÁO CÁO NỘI BỘ - Kế hoạch hoạt động quý IV/2026',
        };
        const docContent: DocContent = {
          kind: 'doc',
          json: sampleDocHtml() as any,
          page: defaultPage(),
        };
        await saveFile(docMeta, docContent);

        // Seed initial Excel sheet
        const sheetId = `sheet-${Date.now() + 1}`;
        const sheetMeta: FileMeta = {
          id: sheetId,
          name: 'Báo cáo ngân sách quý IV.xlsx',
          kind: 'sheet',
          createdAt: Date.now() + 1,
          updatedAt: Date.now() + 1,
          openedAt: Date.now() + 1,
          starred: false,
          deletedAt: null,
          size: 28500,
          preview: 'Ngân sách hoạt động quý IV/2026 - Chi tiêu nhân sự, marketing, công nghệ',
        };
        const sheetContent: SheetContent = {
          kind: 'sheet',
          workbook: sampleWorkbook('Báo cáo ngân sách'),
        };
        await saveFile(sheetMeta, sheetContent);

        // Seed initial PDF doc
        const pdfId = `pdf-${Date.now() + 2}`;
        const pdfMeta: FileMeta = {
          id: pdfId,
          name: 'Quy chuẩn văn phòng số.pdf',
          kind: 'pdf',
          createdAt: Date.now() + 2,
          updatedAt: Date.now() + 2,
          openedAt: Date.now() + 2,
          starred: false,
          deletedAt: null,
          size: 18400,
          preview: 'Văn bản PDF đã được kiểm duyệt chữ ký số. Cần chuẩn hoá định dạng trang trước khi ban hành.',
        };
        const pdfContent: PdfContent = {
          kind: 'pdf',
          pageCount: 3,
        };
        await saveFile(pdfMeta, pdfContent);

        // Seed initial Slide presentation
        const slideId = `slide-${Date.now() + 3}`;
        const slideMeta: FileMeta = {
          id: slideId,
          name: 'Kế hoạch phát triển & Báo cáo quý.pptx',
          kind: 'slide',
          createdAt: Date.now() + 3,
          updatedAt: Date.now() + 3,
          openedAt: Date.now() + 3,
          starred: false,
          deletedAt: null,
          size: 32000,
          preview: 'Chiến lược kinh doanh & Tăng trưởng 2026 — Công ty Minh Spark',
        };
        const slideContent: SlideContent = {
          kind: 'slide',
          presentation: businessPitchPresentation(),
        };
        await saveFile(slideMeta, slideContent);

        if (initialized.current === storage) setFiles(await listFiles());
      } else {
        if (initialized.current === storage) setFiles(list);
      }

      const est = await estimateStorage();
      if (est) setStorageInfo(est);
    };

    void init();
  }, [listFiles, saveFile, storage, user]);

  // Open Document
  const handleOpenDoc = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở tài liệu…');
      syncedWorkspace(storage)?.setActiveFile(meta.id);
      const content = await loadContent(meta.id);
      if (content && content.kind === 'doc') {
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        await updateMeta(meta.id, { openedAt: Date.now() });
      } else {
        ui.toast('Không tìm thấy nội dung tài liệu', true);
      }
    } catch {
      ui.toast('Lỗi khi mở tài liệu', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Open Spreadsheet
  const handleOpenSheet = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở bảng tính…');
      syncedWorkspace(storage)?.setActiveFile(meta.id);
      const content = await loadContent(meta.id);
      if (content && content.kind === 'sheet') {
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        await updateMeta(meta.id, { openedAt: Date.now() });
      } else {
        ui.toast('Không tìm thấy nội dung bảng tính', true);
      }
    } catch {
      ui.toast('Lỗi khi mở bảng tính', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Create new Word Doc
  const handleCreateDoc = async (templateHtml?: string) => {
    const id = `doc-${Date.now()}`;
    const name = templateHtml ? 'Báo cáo mẫu.docx' : 'Tài liệu mới.docx';
    const meta: FileMeta = {
      id,
      name,
      kind: 'doc',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 1024,
      preview: '',
    };
    const content: DocContent = {
      kind: 'doc',
      json: (templateHtml || blankDoc()) as any,
      page: defaultPage(),
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo văn bản Word mới');
  };

  // Create new Excel Sheet
  const handleCreateSheet = async (templateWorkbook?: SheetContent['workbook']) => {
    const id = `sheet-${Date.now()}`;
    const baseName = templateWorkbook?.name
      ? templateWorkbook.name.replace(/\.(xlsx|xlsm|xls|csv|tsv)$/i, '')
      : 'Bảng tính mới';
    const name = `${baseName}.xlsx`;
    const meta: FileMeta = {
      id,
      name,
      kind: 'sheet',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 2048,
      preview: '',
    };
    const content: SheetContent = {
      kind: 'sheet',
      workbook: templateWorkbook || emptyWorkbook('Sheet1'),
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo bảng tính Minh Sheets mới');
  };

  // Open PDF Document
  const handleOpenPdf = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở tài liệu PDF…');
      syncedWorkspace(storage)?.setActiveFile(meta.id);
      const content = await loadContent(meta.id);
      if (content && content.kind === 'pdf') {
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        await updateMeta(meta.id, { openedAt: Date.now() });
      } else {
        ui.toast('Không tìm thấy nội dung tài liệu PDF', true);
      }
    } catch {
      ui.toast('Lỗi khi mở tài liệu PDF', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Create new PDF Document
  const handleCreatePdf = async () => {
    const id = `pdf-${Date.now()}`;
    const name = 'Tài liệu mới.pdf';
    const meta: FileMeta = {
      id,
      name,
      kind: 'pdf',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 4096,
      preview: 'Minh PDF — Bộ công cụ xử lý và ký số PDF chuyên nghiệp',
    };
    const content: PdfContent = {
      kind: 'pdf',
      pageCount: 3,
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo tài liệu Minh PDF mới');
  };

  // Open Slide Presentation
  const handleOpenSlide = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở bài thuyết trình…');
      syncedWorkspace(storage)?.setActiveFile(meta.id);
      const content = await loadContent(meta.id);
      if (content && content.kind === 'slide') {
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        await updateMeta(meta.id, { openedAt: Date.now() });
      } else {
        ui.toast('Không tìm thấy nội dung bài thuyết trình', true);
      }
    } catch {
      ui.toast('Lỗi khi mở bài thuyết trình', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Create new Slide Presentation
  const handleCreateSlide = async (templatePres?: PresentationData) => {
    const id = `slide-${Date.now()}`;
    const name = templatePres?.title || 'Bài thuyết trình mới.pptx';
    const meta: FileMeta = {
      id,
      name,
      kind: 'slide',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 8192,
      preview: 'Minh Slides — Bài thuyết trình phong cách Microsoft PowerPoint',
    };
    const content: SlideContent = {
      kind: 'slide',
      presentation: templatePres || blankPresentation(),
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo bài thuyết trình Minh Slides mới');
  };


  // Open Image Document
  const handleOpenImage = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở hình ảnh…');
      syncedWorkspace(storage)?.setActiveFile(meta.id);
      const content = await loadContent(meta.id);
      if (content && content.kind === 'image') {
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        await updateMeta(meta.id, { openedAt: Date.now() });
      } else {
        ui.toast('Không tìm thấy nội dung hình ảnh', true);
      }
    } catch {
      ui.toast('Lỗi khi mở hình ảnh', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleCreateDocWithImage = async (imageDataUrl: string, imageName: string) => {
    const id = `doc-${Date.now()}`;
    const name = `Tài liệu có ảnh ${imageName.replace(/\.[^/.]+$/, '')}.docx`;
    const html = `<p><img src="${imageDataUrl}" alt="${imageName}" style="max-width:100%" /></p><p></p>`;
    const meta: FileMeta = {
      id,
      name,
      kind: 'doc',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 2048,
      preview: `Văn bản chèn ảnh ${imageName}`,
    };
    const content: DocContent = {
      kind: 'doc',
      json: html as any,
      page: defaultPage(),
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo tài liệu Minh Docs từ hình ảnh');
  };

  const handleCreateSlideWithImage = async (imageDataUrl: string, imageName: string) => {
    const id = `slide-${Date.now()}`;
    const name = `Trình chiếu ${imageName.replace(/\.[^/.]+$/, '')}.pptx`;
    const slide = createSlideFromLayout('blank', 0);
    slide.elements = [
      {
        id: 'el-title',
        type: 'text',
        x: 10,
        y: 8,
        width: 80,
        height: 12,
        text: imageName,
        fontSize: 28,
        fontWeight: 'bold',
      },
      {
        id: 'el-img',
        type: 'image',
        src: imageDataUrl,
        x: 10,
        y: 22,
        width: 80,
        height: 70,
      },
    ];
    const presentation: PresentationData = {
      title: name,
      aspectRatio: '16:9',
      themeId: 'office-classic',
      slides: [slide],
    };
    const meta: FileMeta = {
      id,
      name,
      kind: 'slide',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 4096,
      preview: `Bài thuyết trình chèn ảnh ${imageName}`,
    };
    const content: SlideContent = {
      kind: 'slide',
      presentation,
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo bài thuyết trình Minh Slides từ hình ảnh');
  };

  const handleCreateSheetWithImage = async (_imageDataUrl: string, imageName: string) => {
    const id = `sheet-${Date.now()}`;
    const name = `Bảng tính ${imageName.replace(/\.[^/.]+$/, '')}.xlsx`;
    const wb = emptyWorkbook(imageName.slice(0, 20));
    const meta: FileMeta = {
      id,
      name,
      kind: 'sheet',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openedAt: Date.now(),
      starred: false,
      deletedAt: null,
      size: 2048,
      preview: `Bảng tính đính kèm ảnh ${imageName}`,
    };
    const content: SheetContent = {
      kind: 'sheet',
      workbook: wb,
    };
    await saveFile(meta, content);
    await refreshFiles();
    setActiveMeta(meta);
    setActiveContent(content);
    ui.toast('Đã tạo bảng tính Minh Sheets từ hình ảnh');
  };

  // Import file (.docx, .xlsx, .csv) with password decryption support
  const handleImportFile = async (file: File): Promise<boolean> => {
    try {
      ui.showBusy(`Đang xử lý ${file.name}…`);
      const buffer = await file.arrayBuffer();
      let bytes: Uint8Array<any> = new Uint8Array(buffer);
      const isDoc = /\.(docx|doc)$/i.test(file.name);
      const isText = /\.(txt|md|markdown|html|htm)$/i.test(file.name);
      const isXls = /\.(xlsx|xlsm|xls|csv|tsv)$/i.test(file.name);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isPpt = /\.(pptx|ppt)$/i.test(file.name);
      const isImage = isImageFile(file.name);

      // Check if file is encrypted with MS Office agile encryption
      const { isEncryptedOffice, decryptOfficeFile, DEFAULT_EXCEL_PASSWORD } = await import('./lib/officeCrypto');
      if (isEncryptedOffice(bytes)) {
        ui.showBusy('Đang thử mở khoá tệp bảo vệ…');
        let unlocked = false;
        let plainBytes: Uint8Array | null = null;

        // Try default VelvetSweatshop password first
        try {
          plainBytes = await decryptOfficeFile(bytes, DEFAULT_EXCEL_PASSWORD);
          unlocked = true;
        } catch {
          // VelvetSweatshop failed, prompt user for password
        }

        while (!unlocked) {
          ui.showBusy(null);
          const res = await ui.ask({
            title: 'Tệp được bảo vệ bằng mật khẩu',
            message: `Tệp "${file.name}" đã được mã hoá bằng mật khẩu của Microsoft Office. Vui lòng nhập mật khẩu để mở:`,
            fields: [{ name: 'password', label: 'Mật khẩu', type: 'password', placeholder: 'Nhập mật khẩu tệp…' }],
            confirmText: 'Mở khoá',
            cancelText: 'Huỷ bỏ',
          });

          if (!res || !res.password) {
            ui.toast('Đã huỷ mở tệp mã hoá');
            return false;
          }

          ui.showBusy('Đang giải mã tệp…');
          try {
            plainBytes = await decryptOfficeFile(bytes, String(res.password));
            unlocked = true;
          } catch {
            ui.toast('Mật khẩu không chính xác, vui lòng thử lại', true);
          }
        }

        if (plainBytes) {
          bytes = plainBytes;
        }
      }

      // Convert decrypted or plain buffer into document or sheet
      if (isDoc) {
        ui.showBusy('Đang chuyển đổi tệp Word…');
        const { importDocxFull } = await import('./lib/docxImport');
        const imported = await importDocxFull(bytes.buffer as ArrayBuffer).catch(async () => {
          const { importDocx } = await import('./lib/docxConvert');
          return { html: await importDocx(bytes.buffer as ArrayBuffer), page: defaultPage() };
        });
        const id = `doc-${Date.now()}`;
        const meta: FileMeta = {
          id,
          name: file.name,
          kind: 'doc',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: file.size,
          preview: '',
        };
        const content: DocContent = {
          kind: 'doc',
          json: imported.html as any,
          page: imported.page,
        };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp tệp Word "${file.name}"`);
      } else if (isText) {
        const source = new TextDecoder().decode(bytes);
        const { extractHtmlBody, markdownToHtml, textToHtml } = await import('./lib/docxImport');
        const html = /\.(md|markdown)$/i.test(file.name) ? markdownToHtml(source) : /\.txt$/i.test(file.name) ? textToHtml(source) : extractHtmlBody(source);
        const meta: FileMeta = { id: `doc-${Date.now()}`, name: file.name, kind: 'doc', createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false, deletedAt: null, size: file.size, preview: '' };
        const content: DocContent = { kind: 'doc', json: html as any, page: defaultPage() };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã mở "${file.name}"`);
      } else if (isXls) {
        ui.showBusy('Đang đọc dữ liệu bảng tính…');
        const { importSpreadsheet } = await import('./lib/xlsxConvert');
        const workbook = await importSpreadsheet(bytes.buffer as ArrayBuffer, file.name);
        const id = `sheet-${Date.now()}`;
        const meta: FileMeta = {
          id,
          name: file.name,
          kind: 'sheet',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: file.size,
          preview: '',
        };
        const content: SheetContent = {
          kind: 'sheet',
          workbook,
        };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp bảng tính "${file.name}"`);
      } else if (isPdf) {
        ui.showBusy('Đang mở tệp PDF…');
        const id = `pdf-${Date.now()}`;
        const meta: FileMeta = {
          id,
          name: file.name,
          kind: 'pdf',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: file.size,
          preview: 'Tệp PDF tải lên từ thiết bị',
        };
        const content: PdfContent = {
          kind: 'pdf',
          pdfDataUrl: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(new Blob([bytes], { type: 'application/pdf' }));
          }),
        };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp tệp PDF "${file.name}"`);
      } else if (isPpt) {
        ui.showBusy('Đang đọc bài thuyết trình…');
        const { importFromPptx } = await import('./lib/pptxImport');
        const presentation = await importFromPptx(bytes.buffer as ArrayBuffer, file.name);
        const id = `slide-${Date.now()}`;
        const meta: FileMeta = {
          id,
          name: file.name,
          kind: 'slide',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: file.size,
          preview: `Bài thuyết trình PowerPoint ${presentation.slides.length} trang chiếu`,
        };
        const content: SlideContent = {
          kind: 'slide',
          presentation,
        };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp bài thuyết trình "${file.name}"`);
      } else if (isImage) {
        ui.showBusy(`Đang nạp hình ảnh ${file.name}…`);
        const { readImageFile } = await import('./lib/imageFormats');
        const parsed = await readImageFile(file);
        const id = `image-${Date.now()}`;
        const meta: FileMeta = {
          id,
          name: file.name,
          kind: 'image',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          openedAt: Date.now(),
          starred: false,
          deletedAt: null,
          size: file.size,
          preview: `${parsed.width} × ${parsed.height} · ${formatFileSize(file.size)}`,
        };
        const content: ImageContent = {
          kind: 'image',
          imageDataUrl: parsed.dataUrl,
          mimeType: parsed.mimeType,
          width: parsed.width,
          height: parsed.height,
        };
        await saveFile(meta, content);
        await refreshFiles();
        activeDocument.current = meta;
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp hình ảnh "${file.name}"`);
      } else {
        ui.toast('Định dạng tệp không được hỗ trợ', true);
        return false;
      }
      return true;
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể mở tệp này', true);
      return false;
    } finally {
      ui.showBusy(null);
    }
  };

  const importFromDesktop = useRef(handleImportFile);
  importFromDesktop.current = handleImportFile;
  const drainDesktopFiles = useRef<() => void>(() => {});
  useEffect(() => {
    if (!ready || !isDesktop()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    const queue = createDesktopFileQueue({
      isEditing: () => Boolean(activeDocument.current) || workspaceLifecycle.isBlocked(),
      drain: () => invoke('drain_open_files'),
      read: (file) => invoke<ArrayBuffer>('take_open_file', { id: file.id }),
      open: (file) => importFromDesktop.current(file),
      notify: toast,
    });
    drainDesktopFiles.current = () => { void queue.resume(); };
    const stopLifecycle = workspaceLifecycle.subscribe(() => {
      if (!workspaceLifecycle.isBlocked()) void queue.resume();
    });
    void listen('office-open-files-changed', () => { void queue.request(true); }).then((stop) => {
      if (!alive) { stop(); return; }
      unlisten = stop;
      void queue.request();
    }).catch(() => {
      if (alive) toast('Chưa nhận được yêu cầu mở tệp từ hệ điều hành. Có thể dùng nút Mở tệp từ máy để thử lại.', true);
    });
    return () => { alive = false; queue.stop(); stopLifecycle(); unlisten?.(); drainDesktopFiles.current = () => {}; };
  }, [ready, storage, toast]);
  useEffect(() => { if (!activeMeta) drainDesktopFiles.current(); }, [activeMeta]);

  // Save current active document or sheet
  const handleSaveActive = async (meta: FileMeta, content: FileContent, explicit = false) => {
    try {
      if (explicit && !user) await storage.saveFile(meta, content);
      const account = explicit ? await login() : user;
      if (explicit && !account) return false;
      const target = account ? accountWorkspace(account.uid) : storage;
      if (account && !user) {
        const id = `${meta.kind}-${crypto.randomUUID()}`;
        const versions = (await storage.listVersions(meta.id)).map((version) => ({ ...version, fileId: id }));
        await target.replaceFile({ ...meta, id }, content, versions);
        sessionStorage.setItem(`minh-office-open:${account.uid}`, id);
        window.dispatchEvent(new CustomEvent('office-open-saved', { detail: { uid: account.uid, id } }));
      } else {
        await target.saveFile(meta, content);
      }
      if (currentStorage.current === storage && activeDocument.current?.id === meta.id) {
        setActiveMeta(meta);
        setActiveContent(content);
        setFiles(await target.listFiles());
      }
      return true;
    } catch {
      ui.toast('Chưa lưu được tài liệu. Nội dung đang soạn vẫn được giữ nguyên, hãy thử lại.', true);
      return false;
    }
  };

  // Rename file
  const handleRename = async (file: FileMeta) => {
    const res = await ui.ask({
      title: 'Đổi tên tệp',
      fields: [{ name: 'name', label: 'Tên tệp mới', value: file.name }],
      confirmText: 'Lưu tên',
    });
    if (!res || !res.name) return;
    const newName = String(res.name).trim();
    if (newName && newName !== file.name) {
      await updateMeta(file.id, { name: newName, updatedAt: Date.now() });
      await refreshFiles();
      if (activeMeta?.id === file.id) {
        setActiveMeta((prev) => (prev ? { ...prev, name: newName } : null));
      }
      ui.toast('Đã đổi tên tệp');
    }
  };

  // Duplicate file
  const handleDuplicate = async (file: FileMeta) => {
    try {
      const content = await loadContent(file.id);
      if (!content) return;
      const newId = `${file.kind}-${Date.now()}`;
      const newMeta: FileMeta = {
        ...file,
        id: newId,
        name: `Bản sao của ${file.name}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        openedAt: Date.now(),
      };
      await saveFile(newMeta, content);
      await refreshFiles();
      ui.toast(`Đã nhân bản "${file.name}"`);
    } catch {
      ui.toast('Lỗi khi nhân bản tệp', true);
    }
  };

  // Toggle star
  const handleToggleStar = async (file: FileMeta) => {
    const updated = !file.starred;
    await updateMeta(file.id, { starred: updated });
    await refreshFiles();
    ui.toast(updated ? 'Đã gắn sao' : 'Đã bỏ gắn sao');
  };

  // Move to trash
  const handleTrash = async (file: FileMeta) => {
    await updateMeta(file.id, { deletedAt: Date.now() });
    await refreshFiles();
    ui.toast('Đã chuyển tệp vào thùng rác');
  };

  // Restore from trash
  const handleRestore = async (file: FileMeta) => {
    await updateMeta(file.id, { deletedAt: null });
    await refreshFiles();
    ui.toast('Đã khôi phục tệp');
  };

  // Delete permanent
  const handleDeletePermanent = async (file: FileMeta) => {
    const ok = await ui.confirm(
      'Xoá vĩnh viễn tệp',
      `Bạn có chắc chắn muốn xoá vĩnh viễn "${file.name}"? Hành động này không thể hoàn tác.`,
      true
    );
    if (!ok) return;
    await removeFile(file.id);
    await refreshFiles();
    ui.toast('Đã xoá tệp vĩnh viễn');
  };

  // Export full workspace backup
  const handleExportBackup = async () => {
    try {
      ui.showBusy('Đang tạo tệp sao lưu…');
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `Minh-Office-Backup-${new Date().toISOString().slice(0, 10)}.json`);
      ui.toast('Đã tải xuống bản sao lưu toàn bộ');
    } catch {
      ui.toast('Lỗi khi tạo bản sao lưu', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Import full workspace backup
  const handleImportBackup = async (file: File) => {
    try {
      ui.showBusy('Đang khôi phục từ tệp sao lưu…');
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await importBackup(data);
      await refreshFiles();
      ui.toast(`Đã khôi phục thành công ${count} tệp!`);
    } catch {
      ui.toast('Tệp sao lưu không hợp lệ', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Render active editor or Home
  if (activeMeta && activeContent && activeEditorKind && !editors[activeEditorKind]) return <EditorLoading kind={activeEditorKind} />;
  const { doc: DocEditor, sheet: SheetEditor, slide: SlideEditor, image: ImageEditor, pdf: PdfEditor } = editors;

  if (activeMeta && activeContent) {
    if (activeMeta.kind === 'doc' && activeContent.kind === 'doc' && DocEditor) {
      return (
        <DocEditor
          key={activeMeta.id}
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onNewDocument={(html) => void handleCreateDoc(html)}
          onOpenFile={(file) => void handleImportFile(file)}
          onBack={handleCloseEditor}
        />
      );
    }

    if (activeMeta.kind === 'sheet' && activeContent.kind === 'sheet' && SheetEditor) {
      return (
        <SheetEditor
          key={activeMeta.id}
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={handleCloseEditor}
        />
      );
    }

    if (activeMeta.kind === 'slide' && activeContent.kind === 'slide' && SlideEditor) {
      return (
        <SlideEditor
          key={activeMeta.id}
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={handleCloseEditor}
        />
      );
    }

    if (activeMeta.kind === 'image' && activeContent.kind === 'image' && ImageEditor) {
      return (
        <ImageEditor
          key={activeMeta.id}
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={handleCloseEditor}
          onOpenInDoc={handleCreateDocWithImage}
          onOpenInSheet={handleCreateSheetWithImage}
          onOpenInSlide={handleCreateSlideWithImage}
        />
      );
    }

    if (activeMeta.kind === 'pdf' && activeContent.kind === 'pdf' && PdfEditor) {
      return (
        <PdfEditor
          key={activeMeta.id}
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={handleCloseEditor}
        />
      );
    }
  }

  return (
    <Home
      files={files}
      storageInfo={storageInfo}
      onOpenDoc={handleOpenDoc}
      onOpenSheet={handleOpenSheet}
      onOpenPdf={handleOpenPdf}
      onOpenSlide={handleOpenSlide}
      onOpenImage={handleOpenImage}
      onCreateDoc={handleCreateDoc}
      onCreateSheet={handleCreateSheet}
      onCreatePdf={handleCreatePdf}
      onCreateSlide={handleCreateSlide}
      onImportFile={handleImportFile}
      onRename={handleRename}
      onDuplicate={handleDuplicate}
      onToggleStar={handleToggleStar}
      onTrash={handleTrash}
      onRestore={handleRestore}
      onDeletePermanent={handleDeletePermanent}
      onExportBackup={handleExportBackup}
      onImportBackup={handleImportBackup}
    />
  );
}

function Workspace({ userId, onEditing, editing }: { userId: string | null; onEditing: (editing: boolean) => void; editing: boolean }) {
  const workspace = useMemo(() => userId ? accountWorkspace(userId) : createDraftWorkspaceStorage(), [userId]);
  useEffect(() => syncedWorkspace(workspace)?.start(), [workspace]);
  return (
    <WorkspaceContext value={workspace}>
      <UiProvider>
        <DesktopCloseGuard />
        <div className={`workspace-frame ${editing ? 'is-editing' : ''}`}><div className="workspace-content"><MainApp onEditing={onEditing} /></div><WorkspaceStatus /></div>
      </UiProvider>
    </WorkspaceContext>
  );
}

export default function App() {
  const [editing, setEditing] = useState(false);
  if (isDesktopSignInRequest()) return <DesktopSignIn />;
  return <><Authentication>{(user, session) => <Workspace key={`${session}:${user?.uid ?? 'guest'}`} userId={user?.uid ?? null} onEditing={setEditing} editing={editing} />}</Authentication><DesktopUpdater editing={editing} /></>;
}
