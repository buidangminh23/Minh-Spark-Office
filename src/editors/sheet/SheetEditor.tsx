import { useEffect, useRef, useState } from 'react';
import {
  createUniver,
  LocaleType,
  UniverInstanceType,
  ICommandService,
} from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';

// @ts-ignore
import UniverPresetSheetsCoreViVN from '@univerjs/preset-sheets-core/lib/locales/vi-VN.js';
// @ts-ignore
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/lib/locales/en-US.js';

import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Save,
} from 'lucide-react';

import type { FileMeta, SheetContent } from '../../lib/storage';
import type { WorkbookData } from '../../lib/sheetTypes';
import { exportSheetToCsv, exportWorkbookToXlsx } from '../../lib/xlsxConvert';
import { downloadBlob } from '../../lib/download';
import { useUi } from '../../components/ui';

interface SheetEditorProps {
  meta: FileMeta;
  content: SheetContent;
  onSave: (meta: FileMeta, content: SheetContent) => void;
  onRename: (name: string) => void;
  onBack: () => void;
}

export default function SheetEditor({ meta, content, onSave, onRename, onBack }: SheetEditorProps) {
  const ui = useUi();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<any>(null);
  const univerAPIRef = useRef<any>(null);

  const [title, setTitle] = useState(meta.name);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');

  // Initialize Univer Spreadsheet
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.VI_VN,
        locales: {
          [LocaleType.VI_VN]: UniverPresetSheetsCoreViVN,
          [LocaleType.EN_US]: UniverPresetSheetsCoreEnUS,
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
            header: true,
            footer: {
              sheetBar: true,
              statisticBar: true,
              menus: true,
              zoomSlider: true,
            },
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsConditionalFormattingPreset(),
          UniverSheetsDataValidationPreset(),
          UniverSheetsDrawingPreset(),
          UniverSheetsFindReplacePreset(),
          UniverSheetsHyperLinkPreset(),
          UniverSheetsNotePreset(),
        ],
      });

      univerRef.current = univer;
      univerAPIRef.current = univerAPI;

      // Create sheet instance from stored workbook
      univer.createUnit(UniverInstanceType.UNIVER_SHEET, content.workbook);

      // Listen to commands for autosave
      try {
        const injector = (univer as any).__getInjector?.();
        const commandService = injector?.get(ICommandService);
        if (commandService) {
          commandService.onCommandExecuted(() => {
            setSavedStatus('saving');
          });
        }
      } catch {
        // Fallback: timer auto-save
      }
    } catch (err) {
      console.error('Failed to initialize Univer spreadsheet:', err);
    }

    return () => {
      try {
        univerRef.current?.dispose();
      } catch {
        // Ignore dispose error
      }
    };
  }, []);

  const handleSaveNow = () => {
    if (!univerAPIRef.current) return;
    try {
      const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
      if (!activeWorkbook) return;
      const snapshot = activeWorkbook.save() as unknown as WorkbookData;
      const updatedMeta: FileMeta = {
        ...meta,
        name: title,
        updatedAt: Date.now(),
      };
      onSave(updatedMeta, { kind: 'sheet', workbook: snapshot });
      setSavedStatus('saved');
    } catch (err) {
      console.error('Failed to save sheet snapshot:', err);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (savedStatus !== 'saving') return;
    const timer = setTimeout(() => {
      handleSaveNow();
    }, 1000);

    return () => clearTimeout(timer);
  }, [savedStatus, title, meta, onSave]);

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      onRename(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  const handleExportXlsx = async () => {
    try {
      ui.showBusy('Đang tạo tệp Excel (.xlsx)…');
      let data = content.workbook;
      if (univerAPIRef.current) {
        const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
        if (activeWorkbook) {
          data = activeWorkbook.save() as unknown as WorkbookData;
        }
      }
      const blob = await exportWorkbookToXlsx(data);
      downloadBlob(blob, `${title}.xlsx`);
      ui.toast('Đã tải xuống tệp Excel thành công!');
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất XLSX', true);
    } finally {
      ui.showBusy(null);
    }
  };

  const handleExportCsv = () => {
    try {
      let data = content.workbook;
      if (univerAPIRef.current) {
        const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
        if (activeWorkbook) {
          data = activeWorkbook.save() as unknown as WorkbookData;
        }
      }
      const firstSheetId = data.sheetOrder[0];
      const sheet = data.sheets[firstSheetId];
      if (!sheet) {
        ui.toast('Bảng tính không có dữ liệu để xuất CSV', true);
        return;
      }
      const blob = exportSheetToCsv(sheet);
      downloadBlob(blob, `${title}.csv`);
      ui.toast('Đã tải xuống tệp CSV!');
    } catch (err) {
      ui.toast((err as Error).message || 'Lỗi khi xuất CSV', true);
    }
  };

  const handleBack = () => {
    handleSaveNow();
    onBack();
  };

  return (
    <div className="editor-shell">
      {/* Top Header */}
      <header className="editor-top">
        <div className="editor-title-group">
          <button className="icon-btn" onClick={handleBack} title="Quay lại danh sách tệp">
            <ArrowLeft size={18} />
          </button>
          <div className="file-icon-box sheet" style={{ width: 28, height: 28 }}>
            <FileSpreadsheet size={16} />
          </div>
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            title="Nhấp để đổi tên bảng tính"
          />
          <div className={`save-pill ${savedStatus}`}>
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
          <button className="btn" onClick={handleSaveNow} title="Lưu ngay (Ctrl+S)">
            <Save size={15} />
            <span>Lưu ngay</span>
          </button>
          <button className="btn btn-sheet" onClick={handleExportXlsx} title="Tải xuống tệp Excel (.xlsx)">
            <Download size={15} />
            <span>Xuất Excel (.xlsx)</span>
          </button>
          <button className="btn" onClick={handleExportCsv} title="Xuất định dạng CSV">
            <Download size={15} />
            <span>Xuất CSV</span>
          </button>
          <button className="btn" onClick={() => window.print()} title="In bảng tính">
            <Printer size={15} />
            <span>In</span>
          </button>
        </div>
      </header>

      {/* Univer Canvas Container */}
      <div className="sheet-container" ref={containerRef} />
    </div>
  );
}
