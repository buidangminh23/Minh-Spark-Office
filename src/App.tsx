import { suiteLogos } from './lib/suiteBranding';
import { Authentication, useAccount } from './components/Authentication';
import { createDraftWorkspaceStorage, WorkspaceContext, useWorkspace } from './lib/storage';
import { accountWorkspace, syncedWorkspace } from './lib/workspaces';
import { WorkspaceStatus } from './components/WorkspaceStatus';
import { DesktopUpdater } from './components/DesktopUpdater';
import { DesktopCloseGuard } from './components/DesktopCloseGuard';
import { DocumentTabs, useDocumentTabs } from './components/DocumentTabs';
import { addToTabSession, readTabSession, tabFrameId, tabHost } from './lib/documentTabs';
import { saveActiveDocumentForExit } from './lib/documentCloser';
import { createDesktopFileQueue } from './lib/desktopFileQueue';
import { workspaceLifecycle } from './lib/workspaceLifecycle';
import { DesktopSignIn, isDesktopSignInRequest } from './components/DesktopSignIn';
import { isDesktop } from './lib/desktop';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Home from './components/Home';
import { formatFileSize } from './lib/imageFormatNames';
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
import { loadEditor, loadedEditors, preloadEditor, type EditorKind } from './lib/editorModules';
import { importTargetOf, isOleContainer } from './lib/importTarget';
import { getSettings } from './lib/appSettings';
import { SettingsHost } from './components/settings/SettingsHost';
import { registerBackupActions } from './components/settings/settingsShared';
import type { DesktopFileBatch } from './lib/desktopFileQueue';

const STARTUP_KEY = 'office-startup-done';
const LAUNCH_FILE_WAIT_MS = 4000;

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

const OPEN_FAILED = 'Không mở được tài liệu này. Có thể tệp đã bị xoá hoặc chuyển vào thùng rác.';
const BOOT_FAILED = 'Chưa mở được tài liệu. Hãy thử mở lại từ trang chủ.';

function EditorLoading({ kind }: { kind?: FileKind }) {
  return (
    <div role="status" aria-label="Đang tải trình soạn thảo" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#f6f7fb', zIndex: 1000 }}>
      <div className="desktop-splash-content">
        <div className="desktop-splash-mark">
          <svg className="desktop-splash-ring" viewBox="0 0 132 132"><circle className="desktop-splash-track" cx="66" cy="66" r="64" /><circle className="desktop-splash-arc" cx="66" cy="66" r="64" /></svg>
          <div className="desktop-splash-tile"><img src={kind ? suiteLogos[kind] : '/logo-icon.png'} alt="" width="62" height="62" /></div>
        </div>
        <p className="desktop-splash-name">Minh Spark Office</p>
      </div>
    </div>
  );
}

function MainApp({ onEditing, frameId }: { onEditing: (editing: boolean) => void; frameId: string | null }) {
  const ui = useUi();
  const toast = ui.toast;
  const { user, ready, login } = useAccount();
  const storage = useWorkspace();
  const tabs = useDocumentTabs();
  const host = useMemo(() => (frameId ? tabHost() : null), [frameId]);
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

  const initialized = useRef<typeof storage | null>(null);
  const currentStorage = useRef(storage);
  currentStorage.current = storage;

  const activeDocument = useRef(activeMeta);
  activeDocument.current = activeMeta;
  const hasDocument = Boolean(activeMeta);

  const showDocument = (meta: FileMeta, content: FileContent) => {
    if (!frameId) { tabs?.open(meta, content); return; }
    if (activeDocument.current) { host?.open(meta, content); return; }
    activeDocument.current = meta;
    setActiveMeta(meta);
    setActiveContent(content);
  };

  const focusOpenTab = (meta: FileMeta) => {
    if (frameId || !tabs?.isOpen(meta.id)) return false;
    tabs.open(meta);
    void updateMeta(meta.id, { openedAt: Date.now() }).catch(() => undefined);
    return true;
  };

  useEffect(() => {
    if (!frameId) return;
    onEditing(Boolean(activeMeta));
    syncedWorkspace(storage)?.setActiveFile(activeMeta?.id ?? null);
    return () => { syncedWorkspace(storage)?.setActiveFile(null); onEditing(false); };
  }, [frameId, activeMeta?.id, storage, onEditing]);

  useEffect(() => {
    if (frameId) return;
    let mounted = true;
    const stop = syncedWorkspace(storage)?.subscribe(() => {
      void storage.listFiles().then((list) => { if (mounted) setFiles(list); });
    });
    return () => { mounted = false; stop?.(); };
  }, [frameId, storage]);

  useEffect(() => {
    if (!frameId || !ready) return;
    let alive = true;
    const boot = async () => {
      const handed = host?.take(frameId);
      const copy = handed ? structuredClone(handed) : null;
      const meta = copy?.meta ?? (await storage.listFiles()).find((file) => file.id === frameId && !file.deletedAt);
      const content = copy?.content ?? (meta ? await storage.loadContent(meta.id) : undefined);
      if (!alive) return;
      if (!meta || !content || content.kind !== meta.kind) { host?.fail(frameId, OPEN_FAILED); return; }
      activeDocument.current = meta;
      setActiveMeta(meta);
      setActiveContent(content);
    };
    boot().catch(() => { if (alive) host?.fail(frameId, BOOT_FAILED); });
    return () => { alive = false; };
  }, [frameId, ready, storage, host]);

  useEffect(() => {
    if (!frameId || !host || !hasDocument) return;
    return host.attach(frameId, {
      save: () => saveActiveDocumentForExit(),
      rename: (name) => setActiveMeta((current) => (current ? { ...current, name } : current)),
    });
  }, [frameId, host, hasDocument]);

  useEffect(() => {
    if (!frameId || !host) return;
    const sync = syncedWorkspace(storage);
    if (!sync) return;
    sync.setOpenFiles(host.openIds());
    return host.subscribe(frameId, (ids) => sync.setOpenFiles(ids));
  }, [frameId, host, storage]);

  // Refresh files list and storage
  const refreshFiles = useCallback(async () => {
    const list = await listFiles();
    setFiles(list);
    const est = await estimateStorage();
    if (est) setStorageInfo(est);
  }, [listFiles]);

  const refreshFilesSoon = () => { void refreshFiles().catch(() => undefined); };

  const handleCloseEditor = () => {
    host?.showHome();
  };

  const homeVisible = tabs?.homeVisible ?? false;
  useEffect(() => {
    if (!frameId && homeVisible) void refreshFiles().catch(() => undefined);
  }, [frameId, homeVisible, refreshFiles]);

  // Initial load & seed default files if empty
  useEffect(() => {
    if (frameId || initialized.current === storage) return;
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
  }, [frameId, listFiles, saveFile, storage, user]);

  // Open Document
  const handleOpenDoc = async (meta: FileMeta) => {
    if (focusOpenTab(meta)) return;
    try {
      preloadEditor(meta.kind);
      ui.showBusy('Đang mở tài liệu…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'doc') {
        showDocument(meta, content);
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
    if (focusOpenTab(meta)) return;
    try {
      preloadEditor(meta.kind);
      ui.showBusy('Đang mở bảng tính…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'sheet') {
        showDocument(meta, content);
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
    preloadEditor('doc');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo văn bản Word mới');
  };

  // Create new Excel Sheet
  const handleCreateSheet = async (templateWorkbook?: SheetContent['workbook']) => {
    preloadEditor('sheet');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo bảng tính Minh Sheets mới');
  };

  // Open PDF Document
  const handleOpenPdf = async (meta: FileMeta) => {
    if (focusOpenTab(meta)) return;
    try {
      preloadEditor(meta.kind);
      ui.showBusy('Đang mở tài liệu PDF…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'pdf') {
        showDocument(meta, content);
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
    preloadEditor('pdf');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo tài liệu Minh PDF mới');
  };

  // Open Slide Presentation
  const handleOpenSlide = async (meta: FileMeta) => {
    if (focusOpenTab(meta)) return;
    try {
      preloadEditor(meta.kind);
      ui.showBusy('Đang mở bài thuyết trình…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'slide') {
        showDocument(meta, content);
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
    preloadEditor('slide');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo bài thuyết trình Minh Slides mới');
  };


  // Open Image Document
  const handleOpenImage = async (meta: FileMeta) => {
    if (focusOpenTab(meta)) return;
    try {
      preloadEditor(meta.kind);
      ui.showBusy('Đang mở hình ảnh…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'image') {
        showDocument(meta, content);
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
    preloadEditor('doc');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo tài liệu Minh Docs từ hình ảnh');
  };

  const handleCreateSlideWithImage = async (imageDataUrl: string, imageName: string) => {
    preloadEditor('slide');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo bài thuyết trình Minh Slides từ hình ảnh');
  };

  const handleCreateSheetWithImage = async (_imageDataUrl: string, imageName: string) => {
    preloadEditor('sheet');
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
    refreshFilesSoon();
    showDocument(meta, content);
    ui.toast('Đã tạo bảng tính Minh Sheets từ hình ảnh');
  };

  // Import file (.docx, .xlsx, .csv) with password decryption support
  const handleImportFile = async (file: File): Promise<boolean> => {
    try {
      ui.showBusy(`Đang xử lý ${file.name}…`);
      const target = importTargetOf(file.name);
      if (target) preloadEditor(target.editor);
      const buffer = await file.arrayBuffer();
      let bytes: Uint8Array<any> = new Uint8Array(buffer);
      const isDoc = target?.format === 'word';
      const isText = target?.format === 'text';
      const isXls = target?.format === 'spreadsheet';
      const isPdf = target?.format === 'pdf';
      const isPpt = target?.format === 'presentation';
      const isImage = target?.format === 'image';

      // Check if file is encrypted with MS Office agile encryption
      const officeCrypto = isOleContainer(bytes) ? await import('./lib/officeCrypto') : null;
      if (officeCrypto?.isEncryptedOffice(bytes)) {
        const { decryptOfficeFile, DEFAULT_EXCEL_PASSWORD } = officeCrypto;
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
        refreshFilesSoon();
        showDocument(meta, content);
        ui.toast(`Đã nạp tệp Word "${file.name}"`);
      } else if (isText) {
        const source = new TextDecoder().decode(bytes);
        const { extractHtmlBody, markdownToHtml, textToHtml } = await import('./lib/docxImport');
        const html = /\.(md|markdown)$/i.test(file.name) ? markdownToHtml(source) : /\.txt$/i.test(file.name) ? textToHtml(source) : extractHtmlBody(source);
        const meta: FileMeta = { id: `doc-${Date.now()}`, name: file.name, kind: 'doc', createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false, deletedAt: null, size: file.size, preview: '' };
        const content: DocContent = { kind: 'doc', json: html as any, page: defaultPage() };
        await saveFile(meta, content);
        refreshFilesSoon();
        showDocument(meta, content);
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
        refreshFilesSoon();
        showDocument(meta, content);
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
        refreshFilesSoon();
        showDocument(meta, content);
        ui.toast(`Đã nạp tệp PDF "${file.name}"`);
      } else if (isPpt) {
        ui.showBusy('Đang đọc bài thuyết trình…');
        const { importPptxDetailed } = await import('./lib/pptxImport');
        const { presentation, report: pptxReport } = await importPptxDetailed(bytes.buffer as ArrayBuffer, file.name);
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
        refreshFilesSoon();
        showDocument(meta, content);
        ui.toast(
          pptxReport.skipped.length > 0
            ? `Đã nạp "${file.name}": ${pptxReport.slides} trang, ${pptxReport.elements} đối tượng. Chưa đọc được: ${pptxReport.skipped.slice(0, 2).join('; ')}`
            : `Đã nạp bài thuyết trình "${file.name}": ${pptxReport.slides} trang, ${pptxReport.elements} đối tượng`
        );
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
        refreshFilesSoon();
        showDocument(meta, content);
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

  const launchFiles = useRef((() => {
    let resolve: (hadFiles: boolean) => void = () => undefined;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    return { promise, resolve };
  })());
  const importFromDesktop = useRef(handleImportFile);
  importFromDesktop.current = handleImportFile;
  const drainDesktopFiles = useRef<() => void>(() => {});
  useEffect(() => {
    if (frameId || !ready || !isDesktop()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    const queue = createDesktopFileQueue({
      isEditing: () => workspaceLifecycle.isBlocked(),
      drain: async () => {
        const batch = await invoke<DesktopFileBatch>('drain_open_files');
        launchFiles.current.resolve(batch.files.length > 0);
        return batch;
      },
      read: (file) => {
        const target = importTargetOf(file.name);
        if (target) preloadEditor(target.editor);
        return invoke<ArrayBuffer>('take_open_file', { id: file.id });
      },
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
  }, [frameId, ready, storage, toast]);

  const startupHandled = useRef(false);
  useEffect(() => {
    const mode = getSettings().startup;
    const hasRestoredTab = () => readTabSession(user?.uid).ids.some((id) => files.some((file) => file.id === id && !file.deletedAt));
    if (frameId || !ready || startupHandled.current || mode === 'home' || (!files.length && mode === 'lastDocument')) return;
    startupHandled.current = true;
    try {
      if (sessionStorage.getItem(STARTUP_KEY)) return;
      sessionStorage.setItem(STARTUP_KEY, '1');
      if (mode === 'lastDocument' && hasRestoredTab()) return;
    } catch {
      return;
    }
    const launchWait = isDesktop()
      ? Promise.race([launchFiles.current.promise, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LAUNCH_FILE_WAIT_MS))])
      : Promise.resolve(false);
    void launchWait.then((hadLaunchFile) => {
      if (hadLaunchFile || (mode === 'lastDocument' && hasRestoredTab())) return;
      if (mode === 'newDoc') { void handleCreateDoc(); return; }
      const last = files.filter((file) => !file.deletedAt).sort((a, b) => b.openedAt - a.openedAt)[0];
      if (!last) return;
      if (last.kind === 'doc') void handleOpenDoc(last);
      else if (last.kind === 'sheet') void handleOpenSheet(last);
      else if (last.kind === 'slide') void handleOpenSlide(last);
      else if (last.kind === 'pdf') void handleOpenPdf(last);
      else if (last.kind === 'image') void handleOpenImage(last);
    });
  }, [ready, files]);

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
        addToTabSession(account.uid, id);
        const shell = frameId ? window.parent : window;
        shell.dispatchEvent(new (shell as Window & typeof globalThis).CustomEvent('office-open-saved', { detail: { uid: account.uid, id } }));
      } else {
        await target.saveFile(meta, content);
      }
      if (currentStorage.current === storage && activeDocument.current?.id === meta.id) {
        setActiveMeta(meta);
        setActiveContent(content);
        host?.updateMeta(meta);
        if (!frameId) setFiles(await target.listFiles());
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
      tabs?.rename(file.id, newName);
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
    if (tabs?.isOpen(file.id) && !(await tabs.close(file.id))) return;
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
    if (tabs?.isOpen(file.id) && !(await tabs.close(file.id))) return;
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

  registerBackupActions({ exportBackup: () => void handleExportBackup(), importBackup: (file) => void handleImportBackup(file) });

  if (frameId && (!activeMeta || !activeContent)) return <EditorLoading />;
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
          onOpenSaved={(meta, content) => { refreshFilesSoon(); showDocument(meta, content); }}
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

const frameId = tabFrameId();

function Workspace({ userId, onEditing, editing }: { userId: string | null; onEditing: (editing: boolean) => void; editing: boolean }) {
  const workspace = useMemo(() => userId ? accountWorkspace(userId) : createDraftWorkspaceStorage(), [userId]);
  useEffect(() => (frameId ? undefined : syncedWorkspace(workspace)?.start()), [workspace]);
  return (
    <WorkspaceContext value={workspace}>
      <UiProvider>
        {frameId ? (
          <div className={`workspace-frame ${editing ? 'is-editing' : ''}`}><div className="workspace-content"><MainApp onEditing={onEditing} frameId={frameId} /></div><WorkspaceStatus /><SettingsHost /></div>
        ) : (
          <>
            <DesktopCloseGuard />
            <DocumentTabs onEditing={onEditing}><MainApp onEditing={onEditing} frameId={null} /></DocumentTabs>
            <SettingsHost />
          </>
        )}
      </UiProvider>
    </WorkspaceContext>
  );
}

export default function App() {
  const [editing, setEditing] = useState(false);
  if (isDesktopSignInRequest()) return <DesktopSignIn />;
  return <><Authentication>{(user, session) => <Workspace key={`${session}:${user?.uid ?? 'guest'}`} userId={user?.uid ?? null} onEditing={setEditing} editing={editing} />}</Authentication>{!frameId && <DesktopUpdater editing={editing} />}</>;
}
