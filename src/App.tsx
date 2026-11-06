import { useEffect, useState, useCallback } from 'react';
import Home from './components/Home';
import DocEditor from './editors/doc/DocEditor';
import SheetEditor from './editors/sheet/SheetEditor';
import PdfEditor from './editors/pdf/PdfEditor';
import { UiProvider, useUi } from './components/ui';
import {
  listFiles,
  loadContent,
  saveFile,
  updateMeta,
  removeFile,
  estimateStorage,
  exportBackup,
  importBackup,
  defaultPage,
  type FileMeta,
  type FileContent,
  type DocContent,
  type SheetContent,
  type PdfContent,
} from './lib/storage';
import { blankDoc, sampleDocHtml, sampleWorkbook } from './lib/templates';
import { emptyWorkbook, importSpreadsheet } from './lib/xlsxConvert';
import { importDocx } from './lib/docxConvert';
import { isEncryptedOffice, decryptOfficeFile, DEFAULT_EXCEL_PASSWORD } from './lib/officeCrypto';
import { downloadBlob } from './lib/download';

function MainApp() {
  const ui = useUi();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [activeMeta, setActiveMeta] = useState<FileMeta | null>(null);
  const [activeContent, setActiveContent] = useState<FileContent | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);

  // Refresh files list and storage
  const refreshFiles = useCallback(async () => {
    const list = await listFiles();
    setFiles(list);
    const est = await estimateStorage();
    if (est) setStorageInfo(est);
  }, []);

  // Initial load & seed default files if empty
  useEffect(() => {
    const init = async () => {
      const list = await listFiles();
      if (list.length === 0) {
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

        setFiles([docMeta, sheetMeta, pdfMeta]);
      } else {
        setFiles(list);
      }

      const est = await estimateStorage();
      if (est) setStorageInfo(est);
    };

    void init();
  }, []);

  // Open Document
  const handleOpenDoc = async (meta: FileMeta) => {
    try {
      ui.showBusy('Đang mở tài liệu…');
      const content = await loadContent(meta.id);
      if (content && content.kind === 'doc') {
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
      const content = await loadContent(meta.id);
      if (content && content.kind === 'sheet') {
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
  const handleCreateSheet = async (templateWorkbook?: any) => {
    const id = `sheet-${Date.now()}`;
    const name = templateWorkbook ? 'Bảng tính ngân sách.xlsx' : 'Bảng tính mới.xlsx';
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
      const content = await loadContent(meta.id);
      if (content && content.kind === 'pdf') {
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

  // Import file (.docx, .xlsx, .csv) with password decryption support
  const handleImportFile = async (file: File) => {
    try {
      ui.showBusy(`Đang xử lý ${file.name}…`);
      const buffer = await file.arrayBuffer();
      let bytes: Uint8Array<any> = new Uint8Array(buffer);
      const isDoc = file.name.endsWith('.docx') || file.name.endsWith('.doc');
      const isXls = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
      const isPdf = file.name.toLowerCase().endsWith('.pdf');

      // Check if file is encrypted with MS Office agile encryption
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
            return;
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
        const html = await importDocx(bytes.buffer as ArrayBuffer);
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
          json: html as any,
          page: defaultPage(),
        };
        await saveFile(meta, content);
        await refreshFiles();
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp tệp Word "${file.name}"`);
      } else if (isXls) {
        ui.showBusy('Đang đọc dữ liệu bảng tính…');
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
          pageCount: 3,
        };
        await saveFile(meta, content);
        await refreshFiles();
        setActiveMeta(meta);
        setActiveContent(content);
        ui.toast(`Đã nạp tệp PDF "${file.name}"`);
      } else {
        ui.toast('Định dạng tệp không được hỗ trợ', true);
      }
    } catch (err) {
      ui.toast((err as Error).message || 'Không thể mở tệp này', true);
    } finally {
      ui.showBusy(null);
    }
  };

  // Save current active document or sheet
  const handleSaveActive = async (meta: FileMeta, content: FileContent) => {
    await saveFile(meta, content);
    setActiveMeta(meta);
    setActiveContent(content);
    await refreshFiles();
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
  if (activeMeta && activeContent) {
    if (activeMeta.kind === 'doc' && activeContent.kind === 'doc') {
      return (
        <DocEditor
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={() => {
            setActiveMeta(null);
            setActiveContent(null);
            void refreshFiles();
          }}
        />
      );
    }

    if (activeMeta.kind === 'sheet' && activeContent.kind === 'sheet') {
      return (
        <SheetEditor
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={() => {
            setActiveMeta(null);
            setActiveContent(null);
            void refreshFiles();
          }}
        />
      );
    }

    if (activeMeta.kind === 'pdf' && activeContent.kind === 'pdf') {
      return (
        <PdfEditor
          meta={activeMeta}
          content={activeContent}
          onSave={handleSaveActive}
          onRename={(name) => handleSaveActive({ ...activeMeta, name }, activeContent)}
          onBack={() => {
            setActiveMeta(null);
            setActiveContent(null);
            void refreshFiles();
          }}
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
      onCreateDoc={handleCreateDoc}
      onCreateSheet={handleCreateSheet}
      onCreatePdf={handleCreatePdf}
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

export default function App() {
  return (
    <UiProvider>
      <MainApp />
    </UiProvider>
  );
}
