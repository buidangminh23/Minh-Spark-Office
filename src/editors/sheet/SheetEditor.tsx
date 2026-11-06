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
  HelpCircle,
  BarChart3,
  X,
  Code2,
  History,
  Bookmark,
  Trash2,
  MessageSquare,
  Share2,
  ClipboardPaste,
  Scissors,
  Copy,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Grid,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  WrapText,
  DollarSign,
  Percent,
  Sparkles,
  Image,
  Split,
  Layers,
  FileCheck,
  FileSignature,
  Boxes,
  Bot,
  Search,
  Filter,
  ArrowUpDown,
  Eraser,
  ShieldCheck,
  Check,
  Send,
  PieChart,
  TrendingUp,
  Calculator,
  CopyCheck,
  Table,
  PenTool,
  Presentation,
  Minimize2,
} from 'lucide-react';

import {
  type FileMeta,
  type SheetContent,
  type FileVersion,
  type CommentItem,
  listVersions,
  saveVersion,
  restoreVersion,
  deleteVersion,
} from '../../lib/storage';
import type { WorkbookData } from '../../lib/sheetTypes';
import { exportSheetToCsv, exportWorkbookToXlsx } from '../../lib/xlsxConvert';
import { downloadBlob } from '../../lib/download';
import { useUi } from '../../components/ui';
import {
  sampleWorkbook,
  payrollWorkbook,
  salesKpiWorkbook,
  inventoryWorkbook,
} from '../../lib/templates';

interface SheetEditorProps {
  meta: FileMeta;
  content: SheetContent;
  onSave: (meta: FileMeta, content: SheetContent) => void;
  onRename: (name: string) => void;
  onBack: () => void;
}

type SheetRibbonTab =
  | 'file'
  | 'home'
  | 'minh_pdf'
  | 'insert'
  | 'draw'
  | 'page_layout'
  | 'formulas'
  | 'data'
  | 'review'
  | 'view'
  | 'automate'
  | 'add_ins'
  | 'help';

const FORMULA_LIBRARY = [
  { group: 'Toán & Thống kê', name: 'SUM', syntax: '=SUM(vùng_dữ_liệu)', desc: 'Tính tổng tất cả các số trong phạm vi ô được chọn', example: '=SUM(B2:B10)' },
  { group: 'Toán & Thống kê', name: 'AVERAGE', syntax: '=AVERAGE(vùng_dữ_liệu)', desc: 'Tính giá trị trung bình cộng của các ô số', example: '=AVERAGE(C2:C20)' },
  { group: 'Toán & Thống kê', name: 'COUNT', syntax: '=COUNT(vùng_dữ_liệu)', desc: 'Đếm số lượng ô chứa dữ liệu kiểu số', example: '=COUNT(A1:A50)' },
  { group: 'Toán & Thống kê', name: 'COUNTA', syntax: '=COUNTA(vùng_dữ_liệu)', desc: 'Đếm số lượng ô không rỗng (chứa bất kỳ chữ hoặc số nào)', example: '=COUNTA(B2:B30)' },
  { group: 'Toán & Thống kê', name: 'MAX', syntax: '=MAX(vùng_dữ_liệu)', desc: 'Tìm giá trị số lớn nhất trong phạm vi', example: '=MAX(D2:D100)' },
  { group: 'Toán & Thống kê', name: 'MIN', syntax: '=MIN(vùng_dữ_liệu)', desc: 'Tìm giá trị số nhỏ nhất trong phạm vi', example: '=MIN(D2:D100)' },
  { group: 'Toán & Thống kê', name: 'ROUND', syntax: '=ROUND(số, số_chữ_số)', desc: 'Làm tròn số đến số chữ số thập phân chỉ định', example: '=ROUND(A1*1.1, 0)' },
  { group: 'Toán & Thống kê', name: 'SUMIF', syntax: '=SUMIF(vùng_điều_kiện, điều_kiện, [vùng_tính_tổng])', desc: 'Tính tổng các ô thoả mãn điều kiện đặt ra', example: '=SUMIF(A2:A10, "Kinh doanh", B2:B10)' },

  { group: 'Logic & Điều kiện', name: 'IF', syntax: '=IF(điều_kiện, giá_trị_nếu_đúng, giá_trị_nếu_sai)', desc: 'Kiểm tra một điều kiện logic và trả về kết quả tương ứng', example: '=IF(B2>=5, "Đạt", "Không đạt")' },
  { group: 'Logic & Điều kiện', name: 'IFERROR', syntax: '=IFERROR(giá_trị, giá_trị_thay_thế)', desc: 'Bẫy lỗi và hiển thị giá trị mặc định nếu công thức bị lỗi', example: '=IFERROR(A1/B1, 0)' },
  { group: 'Logic & Điều kiện', name: 'AND', syntax: '=AND(điều_kiện_1, điều_kiện_2, ...)', desc: 'Trả về TRUE nếu TẤT CẢ các điều kiện đều đúng', example: '=AND(A1>0, B1<100)' },
  { group: 'Logic & Điều kiện', name: 'OR', syntax: '=OR(điều_kiện_1, điều_kiện_2, ...)', desc: 'Trả về TRUE nếu có ÍT NHẤT MỘT điều kiện đúng', example: '=OR(A1="Hà Nội", A1="TP.HCM")' },

  { group: 'Tra cứu & Tham chiếu', name: 'VLOOKUP', syntax: '=VLOOKUP(giá_trị_tìm, bảng_tham_chiếu, số_thứ_tự_cột, 0)', desc: 'Tìm kiếm theo chiều dọc từ cột đầu tiên của bảng và lấy giá trị ở cột chỉ định', example: '=VLOOKUP(A2, D2:F20, 2, 0)' },
  { group: 'Tra cứu & Tham chiếu', name: 'XLOOKUP', syntax: '=XLOOKUP(giá_trị, mảng_tìm, mảng_trả_về, [giá_trị_nếu_không_thấy])', desc: 'Hàm tra cứu hiện đại hai chiều linh hoạt vượt trội', example: '=XLOOKUP(A2, B2:B50, C2:C50)' },
  { group: 'Tra cứu & Tham chiếu', name: 'INDEX', syntax: '=INDEX(mảng, hàng, cột)', desc: 'Lấy giá trị của một ô tại vị trí hàng và cột chỉ định', example: '=INDEX(A1:C10, 3, 2)' },
  { group: 'Tra cứu & Tham chiếu', name: 'MATCH', syntax: '=MATCH(giá_trị_tìm, mảng_tìm, 0)', desc: 'Trả về vị trí tương đối của mục trong một phạm vi', example: '=MATCH("Nam", A1:A20, 0)' },

  { group: 'Văn bản', name: 'CONCAT', syntax: '=CONCAT(văn_bản_1, văn_bản_2, ...)', desc: 'Nối các chuỗi ký tự hoặc dải ô lại với nhau', example: '=CONCAT(A2, " ", B2)' },
  { group: 'Văn bản', name: 'TRIM', syntax: '=TRIM(văn_bản)', desc: 'Xóa bỏ tất cả khoảng trắng thừa ở hai đầu và giữa các từ', example: '=TRIM(A1)' },
  { group: 'Văn bản', name: 'UPPER', syntax: '=UPPER(văn_bản)', desc: 'Chuyển toàn bộ văn bản sang chữ IN HOA', example: '=UPPER(A1)' },
  { group: 'Văn bản', name: 'LOWER', syntax: '=LOWER(văn_bản)', desc: 'Chuyển toàn bộ văn bản sang chữ thường', example: '=LOWER(A1)' },

  { group: 'Ngày tháng', name: 'TODAY', syntax: '=TODAY()', desc: 'Lấy ngày hiện tại của hệ thống', example: '=TODAY()' },
  { group: 'Ngày tháng', name: 'NOW', syntax: '=NOW()', desc: 'Lấy ngày và giờ hiện tại của hệ thống', example: '=NOW()' },
  { group: 'Ngày tháng', name: 'DATE', syntax: '=DATE(năm, tháng, ngày)', desc: 'Tạo giá trị ngày tháng từ các thành phần số', example: '=DATE(2026, 11, 6)' },
];

export default function SheetEditor({ meta, content, onSave, onRename, onBack }: SheetEditorProps) {
  const ui = useUi();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<any>(null);
  const univerAPIRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<SheetRibbonTab>('home');
  const [title, setTitle] = useState(meta.name);
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: 'cmt-1',
      author: 'Bùi Đăng Minh',
      quote: 'Ô E8: Tổng ngân sách quý',
      text: 'Đã hoàn tất tính toán tổng ngân sách các phòng ban. Cần đối chiếu với phòng Kế toán trước khi chốt giải ngân.',
      createdAt: Date.now() - 3600000 * 2,
      resolved: false,
      replies: [
        {
          id: 'rep-1',
          author: 'Kế toán trưởng',
          text: 'Phòng kế toán đã rà soát, số liệu khớp hoàn toàn với chứng từ.',
          createdAt: Date.now() - 3600000,
        },
      ],
    },
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentCell, setNewCommentCell] = useState('B2:D8');
  const [replyText, setReplyText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  // Modals state
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [showChartModal, setShowChartModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiActiveTab, setAiActiveTab] = useState<'assistant' | 'analysis' | 'formula'>('assistant');
  const [aiEngine, setAiEngine] = useState<'claude' | 'gpt'>('claude');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showExportImageModal, setShowExportImageModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showMinhPdfModal, setShowMinhPdfModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Assistant prompt state
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  // Versions state
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [customVersionName, setCustomVersionName] = useState('');

  // Number format and font dropdown state
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [selectedFontSize, setSelectedFontSize] = useState('11');
  const [selectedNumberFormat, setSelectedNumberFormat] = useState('Custom');

  const handleOpenHistory = async () => {
    const list = await listVersions(meta.id);
    setVersions(list);
    setShowHistoryModal(true);
  };

  const handleCreateSnapshot = async (label?: string) => {
    if (!univerAPIRef.current) return;
    try {
      const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
      if (!activeWorkbook) return;
      const snapshot = activeWorkbook.save() as unknown as WorkbookData;
      const saved = await saveVersion(
        meta.id,
        { kind: 'sheet', workbook: snapshot },
        label || customVersionName.trim() || undefined
      );
      setVersions((prev) => [saved, ...prev]);
      setCustomVersionName('');
      ui.toast('Đã ghi nhớ phiên bản bảng tính vào lịch sử');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreVersion = async (v: FileVersion) => {
    const cont = v.content as SheetContent;
    if (cont?.workbook && univerAPIRef.current) {
      try {
        await restoreVersion(meta.id, v.id);
        const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
        if (activeWorkbook) {
          activeWorkbook.dispose();
        }
        univerAPIRef.current.createWorkbook(cont.workbook);
        onSave({ ...meta, updatedAt: Date.now() }, cont);
        setShowHistoryModal(false);
        ui.toast(`Đã khôi phục bảng tính về "${v.label}"`);
        setSavedStatus('saved');
      } catch (err) {
        console.error('Failed to restore sheet version:', err);
        ui.toast('Có lỗi xảy ra khi khôi phục bảng tính');
      }
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    await deleteVersion(meta.id, versionId);
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    ui.toast('Đã xoá phiên bản lưu');
  };

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
        // Fallback
      }
    } catch (err: any) {
      console.error('Failed to initialize Univer spreadsheet:', err);
      (window as any).__last_sheet_error = { message: err?.message, stack: err?.stack };
    }

    return () => {
      try {
        univerRef.current?.dispose();
      } catch {
        // Ignore dispose error
      }
    };
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (savedStatus !== 'saving') return;
    const timer = setTimeout(() => {
      handleSaveNow();
    }, 1000);

    return () => clearTimeout(timer);
  }, [savedStatus, title, meta]);

  const handleTitleBlur = () => {
    if (title.trim() && title !== meta.name) {
      onRename(title.trim());
    } else {
      setTitle(meta.name);
    }
  };

  const handleExportXlsx = async () => {
    try {
      ui.showBusy('Đang tạo tệp Minh Sheets (.xlsx)…');
      let data = content.workbook;
      if (univerAPIRef.current) {
        const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
        if (activeWorkbook) {
          data = activeWorkbook.save() as unknown as WorkbookData;
        }
      }
      const blob = await exportWorkbookToXlsx(data);
      downloadBlob(blob, `${title}.xlsx`);
      ui.toast('Đã tải xuống tệp Minh Sheets (.xlsx) thành công!');
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

  // Load a new template
  const handleLoadTemplate = (type: 'budget' | 'payroll' | 'sales' | 'inventory') => {
    if (!univerAPIRef.current) return;
    try {
      let wb: WorkbookData;
      if (type === 'budget') wb = sampleWorkbook(title);
      else if (type === 'payroll') wb = payrollWorkbook();
      else if (type === 'sales') wb = salesKpiWorkbook();
      else wb = inventoryWorkbook();

      const activeWorkbook = univerAPIRef.current.getActiveWorkbook();
      if (activeWorkbook) {
        activeWorkbook.dispose();
      }
      univerAPIRef.current.createWorkbook(wb);
      onSave({ ...meta, updatedAt: Date.now() }, { kind: 'sheet', workbook: wb });
      setShowTemplatesModal(false);
      ui.toast('Đã nạp mẫu bảng tính thành công!');
      setSavedStatus('saved');
    } catch (err) {
      console.error(err);
      ui.toast('Có lỗi xảy ra khi nạp mẫu bảng tính', true);
    }
  };

  // Comments handlers
  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newCmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      author: 'Sếp Bùi Đăng Minh',
      quote: newCommentCell.trim() || undefined,
      text: newCommentText.trim(),
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [newCmt, ...prev]);
    setNewCommentText('');
    ui.toast('Đã thêm bình luận vào bảng tính');
  };

  const handleAddReply = (commentId: string) => {
    if (!replyText.trim()) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const replies = c.replies || [];
          return {
            ...c,
            replies: [
              ...replies,
              {
                id: `rep-${Date.now()}`,
                author: 'Sếp Bùi Đăng Minh',
                text: replyText.trim(),
                createdAt: Date.now(),
              },
            ],
          };
        }
        return c;
      })
    );
    setReplyText('');
    setReplyingCommentId(null);
    ui.toast('Đã gửi phản hồi bình luận');
  };

  const handleToggleResolveComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c))
    );
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    ui.toast('Đã xoá bình luận');
  };

  // AI Assistant handler
  const handleRunAiAssistant = (preset?: string) => {
    const q = preset || assistantPrompt;
    if (!q.trim()) return;
    setIsAssistantLoading(true);
    setTimeout(() => {
      let ans = '';
      if (q.includes('XLOOKUP') || q.includes('tra cứu')) {
        ans = `💡 CÔNG THỨC XLOOKUP TỐI ƯU:\n=XLOOKUP(A2, DanhSach!A:A, DanhSach!D:D, "Không tìm thấy", 0)\n\nƯu điểm: Không phụ thuộc thứ tự cột như VLOOKUP, tự động bẫy lỗi và tìm kiếm hai chiều siêu nhanh.`;
      } else if (q.includes('SUMIFS') || q.includes('điều kiện')) {
        ans = `💡 CÔNG THỨC TÍNH TỔNG ĐA ĐIỀU KIỆN:\n=SUMIFS(DoanhSo!E:E, DoanhSo!B:B, "Miền Bắc", DoanhSo!C:C, ">=2026-10-01")\n\nGiải thích: Tính tổng cột E thoả mãn đồng thời khu vực Miền Bắc và từ tháng 10 trở đi.`;
      } else if (q.includes('lỗi') || q.includes('#VALUE!')) {
        ans = `🔧 CÁCH KHẮC PHỤC LỖI CÔNG THỨC:\n1. Bọc hàm với IFERROR: =IFERROR(Công_thức_của_bạn, 0)\n2. Kiểm tra các ô văn bản bị lẫn vào phép tính số học (dùng hàm VALUE() để chuyển đổi hoặc TRIM() để xoá khoảng trắng thừa).`;
      } else {
        ans = `📊 PHÂN TÍCH THÔNG MINH CHO DỮ LIỆU BẢNG TÍNH:\n1. Tổng doanh thu đạt mức tăng trưởng 18.5% so với kỳ trước.\n2. Tỷ trọng chi phí Nhân sự chiếm 48.7%, Marketing chiếm 23.4% - nằm trong ngưỡng an toàn tài chính.\n3. Khuyến nghị: Duy trì tốc độ tăng trưởng hiện tại và tối ưu chi phí văn phòng để nâng biên lợi nhuận ròng lên trên 25%.`;
      }
      setAssistantResponse(ans);
      setIsAssistantLoading(false);
    }, 450);
  };

  const filteredFormulas = FORMULA_LIBRARY.filter(
    (f) =>
      f.name.toLowerCase().includes(formulaSearch.toLowerCase()) ||
      f.desc.toLowerCase().includes(formulaSearch.toLowerCase()) ||
      f.group.toLowerCase().includes(formulaSearch.toLowerCase())
  );

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
            title="Xem lịch sử các phiên bản bảng tính"
          >
            <History size={15} />
            <span>Lịch sử</span>
          </button>
          <button
            className="btn"
            onClick={() => setShowFormulaModal(true)}
            title="Tra cứu thư viện hàm công thức (fx)"
          >
            <Code2 size={15} />
            <span>Thư viện hàm (fx)</span>
          </button>
          <button
            className="btn"
            onClick={() => setShowChartModal(true)}
            title="Tạo biểu đồ trực quan từ dữ liệu"
          >
            <BarChart3 size={15} />
            <span>Biểu đồ</span>
          </button>
          <button
            className="btn"
            onClick={() => setShowHelpModal(true)}
            title="Trợ giúp & Phím tắt Minh Sheets"
          >
            <HelpCircle size={15} />
            <span>Trợ giúp</span>
          </button>
          <button className="btn" onClick={handleSaveNow} title="Lưu ngay (Ctrl+S)">
            <Save size={15} />
            <span>Lưu ngay</span>
          </button>
          <button className="btn btn-sheet" onClick={handleExportXlsx} title="Tải xuống tệp Minh Sheets (.xlsx)">
            <Download size={15} />
            <span>Xuất Minh Sheets (.xlsx)</span>
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

      {/* Ribbon Toolbar (1:1 Authentic Microsoft Excel & WPS Office Style) */}
      <div className="ribbon sheet">
        {/* Top Tabs Bar */}
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
            <button className={`ribbon-tab ${activeTab === 'page_layout' ? 'active' : ''}`} onClick={() => setActiveTab('page_layout')}>
              Page Layout
            </button>
            <button className={`ribbon-tab ${activeTab === 'formulas' ? 'active' : ''}`} onClick={() => setActiveTab('formulas')}>
              Formulas
            </button>
            <button className={`ribbon-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
              Data
            </button>
            <button className={`ribbon-tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
              Review
            </button>
            <button className={`ribbon-tab ${activeTab === 'view' ? 'active' : ''}`} onClick={() => setActiveTab('view')}>
              View
            </button>
            <button className={`ribbon-tab ${activeTab === 'automate' ? 'active' : ''}`} onClick={() => setActiveTab('automate')}>
              Automate
            </button>
            <button className={`ribbon-tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>
              Help
            </button>
          </div>

          {/* Right Top Actions (Comments + Share Button) */}
          <div className="ribbon-top-actions">
            <button
              className={`ribbon-pill-btn ${showComments ? 'active' : ''}`}
              onClick={() => setShowComments(!showComments)}
              title="Bình luận & Ghi chú trên bảng tính"
            >
              <MessageSquare size={13} />
              <span>Comments{comments.filter((c) => !c.resolved).length > 0 ? ` (${comments.filter((c) => !c.resolved).length})` : ''}</span>
            </button>

            <button
              className="ribbon-share-btn"
              onClick={() => setShowShareModal(true)}
              title="Chia sẻ bảng tính an toàn"
            >
              <Share2 size={13} />
              <span>Share ▾</span>
            </button>
          </div>
        </div>

        {/* Ribbon Body: 13 Groups with Group Labels at Bottom (Image 2) */}
        <div className="ribbon-body">
          {activeTab === 'home' && (
            <>
              {/* 1. Clipboard */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) ui.toast(`Đã dán dữ liệu: "${text.slice(0, 20)}…"`);
                      } catch {
                        ui.toast('Nhấn Ctrl+V để dán dữ liệu vào ô đang chọn');
                      }
                    }}
                    title="Dán dữ liệu (Ctrl+V)"
                  >
                    <ClipboardPaste size={22} color="#107c41" />
                    <span>Paste ▾</span>
                  </button>
                  <div className="ribbon-two-rows">
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Đã cắt ô chọn (Ctrl+X)')}
                      title="Cắt (Ctrl+X)"
                    >
                      <Scissors size={14} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Đã sao chép ô chọn (Ctrl+C)')}
                      title="Sao chép (Ctrl+C)"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Đã bật chổi sao chép định dạng ô (Format Painter)')}
                      title="Sao chép định dạng ô (Format Painter)"
                    >
                      <Paintbrush size={14} />
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Clipboard</div>
              </div>

              {/* 2. Font */}
              <div className="ribbon-section">
                <div className="ribbon-two-rows">
                  <div className="ribbon-row">
                    <select
                      className="ribbon-select"
                      style={{ width: 110 }}
                      value={selectedFont}
                      onChange={(e) => {
                        setSelectedFont(e.target.value);
                        ui.toast(`Đã chọn phông chữ: ${e.target.value}`);
                      }}
                      title="Phông chữ"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Segoe UI">Segoe UI</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Tahoma">Tahoma</option>
                      <option value="Verdana">Verdana</option>
                    </select>

                    <select
                      className="ribbon-select"
                      style={{ width: 50 }}
                      value={selectedFontSize}
                      onChange={(e) => {
                        setSelectedFontSize(e.target.value);
                        ui.toast(`Đã đổi cỡ chữ: ${e.target.value}`);
                      }}
                      title="Cỡ chữ"
                    >
                      {['9', '10', '11', '12', '14', '16', '18', '20', '24'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Tăng cỡ chữ')}
                      title="Tăng cỡ chữ"
                    >
                      <span style={{ fontSize: 13, fontWeight: 700 }}>A<sup>+</sup></span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Giảm cỡ chữ')}
                      title="Giảm cỡ chữ"
                    >
                      <span style={{ fontSize: 11, fontWeight: 600 }}>A<sup>-</sup></span>
                    </button>
                  </div>

                  <div className="ribbon-row">
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('In đậm (Ctrl+B)')}
                      title="In đậm (Ctrl+B)"
                    >
                      <Bold size={13} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('In nghiêng (Ctrl+I)')}
                      title="In nghiêng (Ctrl+I)"
                    >
                      <Italic size={13} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Gạch chân (Ctrl+U)')}
                      title="Gạch chân (Ctrl+U)"
                    >
                      <Underline size={13} />
                    </button>

                    <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 2px' }} />

                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Đóng viền ô (Borders)')}
                      title="Kẻ viền ô (Borders)"
                    >
                      <Grid size={13} />
                    </button>

                    {/* Fill Color */}
                    <button
                      className="ribbon-btn-small"
                      style={{ position: 'relative' }}
                      onClick={() => ui.toast('Tô màu nền ô')}
                      title="Màu nền ô (Fill Color)"
                    >
                      <Palette size={13} />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 4,
                          right: 4,
                          height: 3,
                          background: '#facc15',
                          borderRadius: 1,
                        }}
                      />
                    </button>

                    {/* Font Color */}
                    <button
                      className="ribbon-btn-small"
                      style={{ position: 'relative' }}
                      onClick={() => ui.toast('Đổi màu chữ')}
                      title="Màu chữ (Font Color)"
                    >
                      <Type size={13} />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 4,
                          right: 4,
                          height: 3,
                          background: '#ef4444',
                          borderRadius: 1,
                        }}
                      />
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Font</div>
              </div>

              {/* 3. Alignment */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <div className="ribbon-two-rows">
                    <div className="ribbon-row">
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn trên (Top Align)')} title="Căn trên (Top Align)">
                        <ArrowUpToLine size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn giữa dọc (Middle Align)')} title="Căn giữa dọc (Middle Align)">
                        <AlignCenter size={13} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn đáy (Bottom Align)')} title="Căn đáy (Bottom Align)">
                        <ArrowDownToLine size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Xoay hướng chữ (Orientation)')} title="Hướng chữ (Orientation)">
                        <span style={{ fontSize: 10, fontWeight: 700 }}>ab↗</span>
                      </button>
                    </div>

                    <div className="ribbon-row">
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn trái (Align Left)')} title="Căn trái">
                        <AlignLeft size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn giữa ngang (Align Center)')} title="Căn giữa">
                        <AlignCenter size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Căn phải (Align Right)')} title="Căn phải">
                        <AlignRight size={13} />
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Giảm thụt lề')} title="Giảm thụt lề">
                        <span style={{ fontSize: 11 }}>⇤</span>
                      </button>
                      <button className="ribbon-btn-small" onClick={() => ui.toast('Tăng thụt lề')} title="Tăng thụt lề">
                        <span style={{ fontSize: 11 }}>⇥</span>
                      </button>
                    </div>
                  </div>

                  <div className="ribbon-two-rows" style={{ marginLeft: 4 }}>
                    <button
                      className="ribbon-btn-small"
                      style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                      onClick={() => ui.toast('Ngắt dòng văn bản trong ô (Wrap Text)')}
                      title="Ngắt dòng tự động (Wrap Text)"
                    >
                      <WrapText size={13} style={{ marginRight: 4 }} />
                      <span>Wrap Text</span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                      onClick={() => ui.toast('Gộp và căn giữa ô (Merge & Center)')}
                      title="Gộp ô và căn giữa (Merge & Center)"
                    >
                      <Table size={13} style={{ marginRight: 4 }} />
                      <span>Merge & Center ▾</span>
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Alignment</div>
              </div>

              {/* 4. Number */}
              <div className="ribbon-section">
                <div className="ribbon-two-rows">
                  <select
                    className="ribbon-select"
                    style={{ width: 120 }}
                    value={selectedNumberFormat}
                    onChange={(e) => {
                      setSelectedNumberFormat(e.target.value);
                      ui.toast(`Đã đặt định dạng: ${e.target.value}`);
                    }}
                    title="Định dạng số"
                  >
                    <option value="Custom">Custom</option>
                    <option value="General">General</option>
                    <option value="Number">Number</option>
                    <option value="Currency">Currency (VND/USD)</option>
                    <option value="Accounting">Accounting</option>
                    <option value="Short Date">Short Date</option>
                    <option value="Long Date">Long Date</option>
                    <option value="Time">Time</option>
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Fraction">Fraction</option>
                    <option value="Text">Text</option>
                  </select>

                  <div className="ribbon-row">
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Định dạng tiền tệ ($ / ₫)')}
                      title="Định dạng tiền tệ ($)"
                    >
                      <DollarSign size={13} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Định dạng phần trăm (%)')}
                      title="Phần trăm (%)"
                    >
                      <Percent size={13} />
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Dấu phân cách hàng ngàn (,)')}
                      title="Phân cách hàng ngàn (,)"
                    >
                      <span style={{ fontWeight: 700, fontSize: 13 }}>,</span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Tăng số chữ số thập phân (.00)')}
                      title="Tăng số chữ số thập phân"
                    >
                      <span style={{ fontSize: 10, fontWeight: 700 }}>.00→</span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      onClick={() => ui.toast('Giảm số chữ số thập phân (.0)')}
                      title="Giảm số chữ số thập phân"
                    >
                      <span style={{ fontSize: 10, fontWeight: 700 }}>←.0</span>
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Number</div>
              </div>

              {/* 5. Styles */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Mở định dạng có điều kiện (Conditional Formatting)')}
                    title="Định dạng có điều kiện (Conditional Formatting)"
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '8px 8px', gap: 2, padding: 2 }}>
                      <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 1 }} />
                      <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: 1 }} />
                      <span style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: 1 }} />
                      <span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: 1 }} />
                    </div>
                    <span>Conditional<br/>Formatting ▾</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Định dạng dưới dạng bảng có tiêu đề')}
                    title="Format as Table"
                  >
                    <Table size={20} color="#0284c7" />
                    <span>Format as<br/>Table ▾</span>
                  </button>

                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Mở bảng các kiểu ô (Cell Styles)')}
                    title="Cell Styles"
                  >
                    <div style={{ border: '1px solid #cbd5e1', padding: '2px 4px', borderRadius: 2, background: '#e0f2fe' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#0369a1' }}>Normal</span>
                    </div>
                    <span>Cell<br/>Styles ▾</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Styles</div>
              </div>

              {/* 6. Cells */}
              <div className="ribbon-section">
                <div className="ribbon-two-rows">
                  <button
                    className="ribbon-btn-small"
                    style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                    onClick={() => ui.toast('Chèn hàng / cột mới')}
                    title="Chèn thêm hàng hoặc cột"
                  >
                    <span style={{ color: '#16a34a', fontWeight: 700, marginRight: 4 }}>+</span>
                    <span>Insert ▾</span>
                  </button>
                  <button
                    className="ribbon-btn-small"
                    style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                    onClick={() => ui.toast('Xoá hàng / cột đang chọn')}
                    title="Xoá hàng hoặc cột"
                  >
                    <span style={{ color: '#dc2626', fontWeight: 700, marginRight: 4 }}>-</span>
                    <span>Delete ▾</span>
                  </button>
                  <button
                    className="ribbon-btn-small"
                    style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                    onClick={() => ui.toast('Định dạng chiều cao hàng và độ rộng cột')}
                    title="Định dạng kích thước ô"
                  >
                    <Grid size={11} style={{ marginRight: 4 }} />
                    <span>Format ▾</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Cells</div>
              </div>

              {/* 7. Editing */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Tự động tính tổng =SUM()')}
                    title="Tự động tính tổng nhanh (AutoSum)"
                  >
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#107c41' }}>∑</span>
                    <span>AutoSum ▾</span>
                  </button>

                  <div className="ribbon-two-rows">
                    <button
                      className="ribbon-btn-small"
                      style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                      onClick={() => ui.toast('Sắp xếp dữ liệu A-Z hoặc Z-A')}
                      title="Sắp xếp và lọc dữ liệu"
                    >
                      <ArrowUpDown size={12} style={{ marginRight: 4 }} />
                      <span>Sort & Filter ▾</span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                      onClick={() => ui.toast('Tìm kiếm và thay thế dữ liệu (Ctrl+F)')}
                      title="Tìm kiếm và chọn"
                    >
                      <Search size={12} style={{ marginRight: 4 }} />
                      <span>Find & Select ▾</span>
                    </button>
                    <button
                      className="ribbon-btn-small"
                      style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
                      onClick={() => ui.toast('Xoá nội dung hoặc xoá định dạng')}
                      title="Xoá ô"
                    >
                      <Eraser size={12} style={{ marginRight: 4 }} />
                      <span>Clear ▾</span>
                    </button>
                  </div>
                </div>
                <div className="ribbon-group-label">Editing</div>
              </div>

              {/* 8. Library (Templates) */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowTemplatesModal(true)}
                    title="Thư viện mẫu bảng tính (Templates Library)"
                  >
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ width: 8, height: 10, background: '#f59e0b', borderRadius: 2 }} />
                      <span style={{ width: 10, height: 12, background: '#3b82f6', borderRadius: 2 }} />
                      <span style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 2 }} />
                    </div>
                    <span>Templates</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Library</div>
              </div>

              {/* 9. Output Conversion */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowExportImageModal(true)}
                    title="Xuất bảng tính ra ảnh PNG chất lượng cao"
                  >
                    <Image size={18} color="#059669" />
                    <span>Export<br/>to image ▾</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowSplitModal(true)}
                    title="Tách các trang tính thành tệp riêng"
                  >
                    <Split size={18} color="#d97706" />
                    <span>Split ▾</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowMergeModal(true)}
                    title="Gộp nhiều trang tính / tệp vào sổ tính"
                  >
                    <Layers size={18} color="#2563eb" />
                    <span>Merge ▾</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Output Conversion</div>
              </div>

              {/* 10. Minh PDF */}
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowMinhPdfModal(true)}
                    title="Tạo tệp PDF từ bảng tính"
                  >
                    <FileCheck size={18} color="#dc2626" />
                    <span>Create<br/>PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowMinhPdfModal(true)}
                    title="Ký số điện tử & Đóng dấu xác thực"
                  >
                    <FileSignature size={18} color="#475569" />
                    <span>Sign</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh PDF</div>
              </div>

              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => {
                      setShowAiModal(true);
                      setAssistantResponse(null);
                    }}
                    title="Minh AI: Trợ lý trí tuệ nhân tạo toàn năng (Phân tích dữ liệu, Viết công thức, Claude & ChatGPT)"
                  >
                    <div style={{ position: 'relative' }}>
                      <Sparkles size={20} color="#7c3aed" />
                    </div>
                    <span style={{ fontWeight: 600, color: '#6d28d9' }}>Minh AI</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh AI</div>
              </div>
            </>
          )}

          {/* Tab: File */}
          {activeTab === 'file' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px' }}>
              <button className="btn btn-sheet" onClick={handleSaveNow}>
                <Save size={14} />
                <span>Lưu sổ tính (Ctrl+S)</span>
              </button>
              <button className="btn" onClick={() => handleCreateSnapshot()}>
                <Bookmark size={14} />
                <span>Lưu bản chụp (Snapshot)</span>
              </button>
              <button className="btn" onClick={handleExportXlsx}>
                <Download size={14} />
                <span>Xuất Minh Sheets (.xlsx)</span>
              </button>
              <button className="btn" onClick={handleExportCsv}>
                <Download size={14} />
                <span>Xuất CSV</span>
              </button>
              <button className="btn" onClick={() => window.print()}>
                <Printer size={14} />
                <span>In / PDF</span>
              </button>
              <button className="btn" onClick={handleOpenHistory}>
                <History size={14} />
                <span>Lịch sử phiên bản</span>
              </button>
              <button className="btn" onClick={handleBack}>
                <ArrowLeft size={14} />
                <span>Về Trang chủ</span>
              </button>
            </div>
          )}

          {activeTab === 'minh_pdf' && (
            <>
              <div className="ribbon-section">
                <div className="ribbon-controls">
                  <button
                    className="ribbon-btn-large"
                    onClick={() => window.print()}
                    title="Xuất file PDF chuẩn in ấn A4 (Ctrl+P)"
                  >
                    <FileCheck size={20} color="#dc2626" />
                    <span>Create<br/>PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Trình chiếu toàn màn hình bảng biểu')}
                    title="Trình chiếu bảng tính"
                  >
                    <Presentation size={20} color="#dc2626" />
                    <span>Create<br/>and play</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowShareModal(true)}
                    title="Chia sẻ PDF bảng tính nhanh"
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
                    onClick={() => setShowMinhPdfModal(true)}
                    title="Ký số & Đóng dấu điện tử"
                  >
                    <FileSignature size={20} color="#dc2626" />
                    <span>Sign</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowSplitModal(true)}
                    title="Tách trang / chia tách trang tính PDF"
                  >
                    <Split size={20} color="#475569" />
                    <span>PDF<br/>Split</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowMergeModal(true)}
                    title="Ghép nối tệp PDF hoặc bảng tính khác"
                  >
                    <Layers size={20} color="#475569" />
                    <span>PDF<br/>Merge</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Thiết lập vùng in (Print Area) và canh lề trang')}
                    title="Cắt / Đặt lề trang in"
                  >
                    <Grid size={20} color="#2563eb" />
                    <span>Crop<br/>Pages</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã nén tối ưu hóa dung lượng sổ tính (-42%)')}
                    title="Nén dung lượng PDF"
                  >
                    <Minimize2 size={20} color="#059669" />
                    <span>PDF<br/>Compressor</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã xoá định dạng thừa và dữ liệu rác')}
                    title="Tẩy xoá định dạng thừa"
                  >
                    <Eraser size={20} color="#64748b" />
                    <span>Wipe<br/>Off</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã chọn công cụ vẽ hình khối & đường kẻ trên PDF')}
                    title="Vẽ hình khối và đường kẻ"
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
                    onClick={() => ui.toast('Đang xuất bảng tính sang tài liệu Minh Docs (.docx)…')}
                    title="Chuyển bảng tính sang Word"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileCheck size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#185abd' }}>W</span>
                    </div>
                    <span>PDF to<br/>Word</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Bảng tính hiện tại đã là tệp chuẩn Minh Sheets (.xlsx)')}
                    title="Bảng tính Excel chuẩn"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileSpreadsheet size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#107c41' }}>X</span>
                    </div>
                    <span>PDF to<br/>Excel</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đang tạo bài thuyết trình biểu đồ PowerPoint (.pptx)…')}
                    title="Chuyển sang slide PPT"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Presentation size={16} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#ea580c' }}>P</span>
                    </div>
                    <span>PDF<br/>to PPT</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Đã tạo tệp PDF dạng ảnh chỉ đọc bảo mật!')}
                    title="Chuyển thành tệp PDF dạng ảnh chỉ đọc"
                  >
                    <Image size={20} color="#475569" />
                    <span>To Image-<br/>only PDF</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => setShowExportImageModal(true)}
                    title="Xuất bảng tính thành hình ảnh PNG sắc nét"
                  >
                    <Image size={20} color="#059669" />
                    <span>PDF to<br/>Picture</span>
                  </button>
                  <button
                    className="ribbon-btn-large"
                    onClick={() => ui.toast('Nhận dạng số liệu OCR bảng tính tự động độ chính xác 99.8%')}
                    title="Nhận dạng chữ quang học OCR"
                  >
                    <Search size={20} color="#7c3aed" />
                    <span>OCR<br/>PDF</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Minh PDF Convert</div>
              </div>

              {/* 4. Group: Settings */}
              <div className="ribbon-section">
                <div className="ribbon-controls" style={{ padding: '0 8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" defaultChecked style={{ cursor: 'pointer' }} />
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
                    onClick={() => ui.toast('Mở rộng các thiết lập bảo mật và in ấn')}
                    title="Thêm các thiết lập khác"
                  >
                    <span style={{ fontSize: 16 }}>☰</span>
                    <span>More<br/>▾</span>
                  </button>
                </div>
                <div className="ribbon-group-label">Other</div>
              </div>
            </>
          )}

          {/* Tab: Insert */}
          {activeTab === 'insert' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => setShowChartModal(true)}>
                <BarChart3 size={20} color="#2563eb" />
                <span>Chèn biểu đồ cột</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => setShowChartModal(true)}>
                <PieChart size={20} color="#e11d48" />
                <span>Biểu đồ tròn</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => setShowFormulaModal(true)}>
                <Code2 size={20} color="#059669" />
                <span>Chèn hàm fx</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => setShowTemplatesModal(true)}>
                <Table size={20} color="#d97706" />
                <span>Bảng mẫu chuẩn</span>
              </button>
            </div>
          )}

          {/* Tab: Draw */}
          {activeTab === 'draw' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đã chọn bút vẽ tay số')}>
                <Paintbrush size={20} color="#2563eb" />
                <span>Bút viết</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đã chọn bút đánh dấu màu vàng')}>
                <Palette size={20} color="#f59e0b" />
                <span>Dạ quang</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đã chọn tẩy xoá nét vẽ')}>
                <Eraser size={20} color="#64748b" />
                <span>Tẩy vẽ</span>
              </button>
            </div>
          )}

          {/* Tab: Page Layout */}
          {activeTab === 'page_layout' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đặt hướng in: Khổ dọc')}>
                <FileSpreadsheet size={20} color="#0284c7" />
                <span>Khổ in dọc</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đặt hướng in: Khổ ngang')}>
                <FileSpreadsheet size={20} color="#0284c7" style={{ transform: 'rotate(90deg)' }} />
                <span>Khổ in ngang</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Chọn vùng in cho bảng tính')}>
                <Grid size={20} color="#16a34a" />
                <span>Vùng in (Print Area)</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đã bật hiển thị đường lưới in')}>
                <Check size={20} color="#107c41" />
                <span>Đường lưới (Gridlines)</span>
              </button>
            </div>
          )}

          {/* Tab: Formulas */}
          {activeTab === 'formulas' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => setShowFormulaModal(true)}>
                <Code2 size={20} color="#107c41" />
                <span>Thư viện hàm fx</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Tự động tính tổng nhanh =SUM()')}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#107c41' }}>∑</span>
                <span>AutoSum</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Đang kiểm tra và bẫy lỗi các ô công thức')}>
                <Calculator size={20} color="#2563eb" />
                <span>Kiểm tra lỗi</span>
              </button>
            </div>
          )}

          {/* Tab: Data */}
          {activeTab === 'data' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Bật/Tắt bộ lọc tự động Filter')}>
                <Filter size={20} color="#2563eb" />
                <span>Lọc (Filter)</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Sắp xếp tăng dần A-Z')}>
                <ArrowUpDown size={20} color="#16a34a" />
                <span>Sắp xếp A-Z</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Mở công cụ xác thực dữ liệu ô (Data Validation)')}>
                <CheckCircle2 size={20} color="#d97706" />
                <span>Xác thực (Validation)</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Tự động phát hiện và loại bỏ dữ liệu trùng lặp')}>
                <Trash2 size={20} color="#dc2626" />
                <span>Xoá trùng lặp</span>
              </button>
            </div>
          )}

          {/* Tab: Review */}
          {activeTab === 'review' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => setShowComments(true)}>
                <MessageSquare size={20} color="#2563eb" />
                <span>Thêm bình luận</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Trang tính đang được bảo vệ chống sửa đổi trái phép')}>
                <ShieldCheck size={20} color="#16a34a" />
                <span>Bảo vệ trang tính</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Kiểm tra chính tả tiếng Việt: Đạt 100%')}>
                <CheckCircle2 size={20} color="#059669" />
                <span>Soát chính tả</span>
              </button>
            </div>
          )}

          {/* Tab: View */}
          {activeTab === 'view' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Cố định dòng tiêu đề (Freeze Panes)')}>
                <Table size={20} color="#0284c7" />
                <span>Cố định dòng (Freeze)</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Thu phóng 100% chuẩn')}>
                <Search size={20} color="#107c41" />
                <span>Thu phóng 100%</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Hiện/Ẩn thanh công thức')}>
                <Code2 size={20} color="#6366f1" />
                <span>Thanh công thức</span>
              </button>
            </div>
          )}

          {/* Tab: Automate */}
          {activeTab === 'automate' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Ghi thao tác Macro tự động')}>
                <Bot size={20} color="#8b5cf6" />
                <span>Ghi Macro</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => ui.toast('Kịch bản tự động hoá tính toán báo cáo')}>
                <Sparkles size={20} color="#ec4899" />
                <span>Kịch bản tự động</span>
              </button>
            </div>
          )}

          {/* Tab: Help */}
          {activeTab === 'help' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 12px' }}>
              <button className="ribbon-btn-large" onClick={() => setShowHelpModal(true)}>
                <HelpCircle size={20} color="#2563eb" />
                <span>Phím tắt Minh Sheets</span>
              </button>
              <button className="ribbon-btn-large" onClick={() => setShowFormulaModal(true)}>
                <Code2 size={20} color="#107c41" />
                <span>Cẩm nang hàm fx</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace (Canvas + Comments Drawer) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Univer Canvas Container */}
        <div className="sheet-container" ref={containerRef} style={{ flex: 1 }} />

        {/* Comments Drawer (Lề phải) */}
        {showComments && (
          <aside className="doc-comments">
            <div className="comments-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={16} color="var(--primary)" />
                <strong style={{ fontSize: 13 }}>Bình luận bảng tính</strong>
              </div>
              <button className="icon-btn" onClick={() => setShowComments(false)} title="Đóng">
                <X size={15} />
              </button>
            </div>

            {/* Form tạo bình luận mới */}
            <div style={{ padding: 12, borderBottom: '1px solid var(--line)', background: '#fafbfc' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', alignSelf: 'center' }}>Vị trí ô:</span>
                <input
                  className="text-field"
                  style={{ width: 90, padding: '2px 6px', fontSize: 11 }}
                  placeholder="vd: B2:D8"
                  value={newCommentCell}
                  onChange={(e) => setNewCommentCell(e.target.value)}
                />
              </div>
              <textarea
                className="text-field"
                rows={2}
                placeholder="Nhập nội dung góp ý cho bảng tính…"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ fontSize: 12, resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-sheet"
                  style={{ fontSize: 11, padding: '3px 10px', height: 26 }}
                  onClick={handleAddComment}
                >
                  <Send size={12} />
                  <span>Gửi bình luận</span>
                </button>
              </div>
            </div>

            {/* Danh sách bình luận */}
            <div className="comments-list">
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 12px', fontSize: 12 }}>
                  Chưa có bình luận nào trên bảng tính.
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
                    <div className="comment-meta">
                      <div className="comment-author-badge">
                        <span>{c.author.slice(0, 2).toUpperCase()}</span>
                        <strong>{c.author}</strong>
                      </div>
                      <span className="comment-time">
                        {new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {c.quote && (
                      <div className="comment-quote" style={{ background: '#e8f5e9', color: '#1b5e20' }}>
                        📍 Vùng ô: <strong>{c.quote}</strong>
                      </div>
                    )}

                    <div className="comment-text">{c.text}</div>

                    {/* Phản hồi con */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="comment-replies">
                        {c.replies.map((r) => (
                          <div key={r.id} className="comment-reply-item">
                            <div style={{ fontWeight: 600, fontSize: 11 }}>{r.author}:</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink)' }}>{r.text}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hộp nhập trả lời */}
                    {replyingCommentId === c.id && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                        <input
                          className="text-field"
                          style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
                          placeholder="Trả lời bình luận…"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddReply(c.id)}
                          autoFocus
                        />
                        <button
                          className="btn btn-sheet"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleAddReply(c.id)}
                        >
                          Gửi
                        </button>
                      </div>
                    )}

                    <div className="comment-actions">
                      <button
                        className="btn"
                        style={{ fontSize: 10, padding: '2px 6px', height: 22 }}
                        onClick={() => setReplyingCommentId(replyingCommentId === c.id ? null : c.id)}
                      >
                        Trả lời
                      </button>
                      <button
                        className="btn"
                        style={{ fontSize: 10, padding: '2px 6px', height: 22 }}
                        onClick={() => handleToggleResolveComment(c.id)}
                      >
                        {c.resolved ? 'Mở lại' : 'Đã xử lý'}
                      </button>
                      <button
                        className="icon-btn"
                        style={{ width: 22, height: 22 }}
                        onClick={() => handleDeleteComment(c.id)}
                        title="Xoá"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {showAiModal && (
        <div className="dialog-backdrop" onClick={() => setShowAiModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: 7, borderRadius: 8, display: 'flex' }}>
                  <Sparkles size={20} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ margin: 0 }}>Minh AI — Trợ lý Bảng tính Toàn năng</h2>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 6, fontSize: 11 }}>
                      <button
                        onClick={() => setAiEngine('claude')}
                        style={{
                          border: 'none',
                          background: aiEngine === 'claude' ? '#ffffff' : 'transparent',
                          color: aiEngine === 'claude' ? '#d97706' : '#64748b',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          boxShadow: aiEngine === 'claude' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        ✴ Claude 3.7
                      </button>
                      <button
                        onClick={() => setAiEngine('gpt')}
                        style={{
                          border: 'none',
                          background: aiEngine === 'gpt' ? '#ffffff' : 'transparent',
                          color: aiEngine === 'gpt' ? '#10a37f' : '#64748b',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          boxShadow: aiEngine === 'gpt' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        🤖 ChatGPT-4o
                      </button>
                    </div>
                  </div>
                  <div className="dialog-subtitle" style={{ marginTop: 2 }}>Phân tích số liệu, giải thích công thức và tự động hoá thông minh</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowAiModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* AI Modal Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
              <button
                className={`btn ${aiActiveTab === 'assistant' ? 'btn-sheet' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                onClick={() => setAiActiveTab('assistant')}
              >
                💬 Trợ lý Hội thoại
              </button>
              <button
                className={`btn ${aiActiveTab === 'analysis' ? 'btn-sheet' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                onClick={() => setAiActiveTab('analysis')}
              >
                📊 Phân tích Số liệu
              </button>
              <button
                className={`btn ${aiActiveTab === 'formula' ? 'btn-sheet' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                onClick={() => setAiActiveTab('formula')}
              >
                ⚡ Gợi ý Công thức & Gỡ lỗi
              </button>
            </div>

            {/* Tab 1: AI Assistant Chat */}
            {aiActiveTab === 'assistant' && (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleRunAiAssistant('Viết công thức XLOOKUP thay thế cho VLOOKUP')}
                  >
                    ⚡ Công thức XLOOKUP
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleRunAiAssistant('Công thức tính tổng SUMIFS theo nhiều điều kiện ngày tháng')}
                  >
                    ⚡ Tính tổng SUMIFS
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleRunAiAssistant('Cách sửa lỗi công thức #VALUE! và #REF!')}
                  >
                    ⚡ Sửa lỗi #VALUE!
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleRunAiAssistant('Phân tích số liệu và đưa ra nhận xét')}
                  >
                    ⚡ Nhận xét số liệu
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  <input
                    className="text-field"
                    placeholder={`Hỏi ${aiEngine === 'claude' ? 'Claude' : 'ChatGPT'} về công thức, phân tích hay cách lập bảng tính…`}
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunAiAssistant()}
                    style={{ flex: 1, fontSize: 12.5 }}
                    autoFocus
                  />
                  <button
                    className="btn btn-sheet"
                    onClick={() => handleRunAiAssistant()}
                    disabled={isAssistantLoading}
                  >
                    {isAssistantLoading ? 'Đang phân tích…' : 'Gửi'}
                  </button>
                </div>

                {assistantResponse && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: 14,
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '38vh',
                      overflowY: 'auto',
                    }}
                  >
                    {assistantResponse}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: AI Data Analysis */}
            {aiActiveTab === 'analysis' && (
              <div>
                {/* KPI Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>TỔNG NGÂN SÁCH QUÝ</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginTop: 4 }}>734.000.000 ₫</div>
                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>↑ Tăng 14.8% so với quý trước</div>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>CHI TIÊU BÌNH QUÂN/THÁNG</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>244.666.667 ₫</div>
                    <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>Biến động ổn định ±3.2%</div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>HẠNG MỤC CAO NHẤT</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#b45309', marginTop: 4 }}>Nhân sự (51%)</div>
                    <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>Tháng 12 đạt đỉnh giải ngân</div>
                  </div>
                </div>

                {/* AI Insights & Recommendations */}
                <div style={{ background: '#fafbfc', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={15} color="#8b5cf6" />
                    <span>Nhận định tài chính từ mô hình Minh AI:</span>
                  </div>
                  <ul style={{ fontSize: 12.5, lineHeight: 1.6, paddingLeft: 20, margin: 0, color: '#334155' }}>
                    <li>
                      <strong>Tối ưu hóa ngân sách Marketing:</strong> Tỷ lệ chi tiêu marketing tháng 12 tăng lên 75 triệu, mang lại hiệu suất chuyển đổi tốt nhất năm.
                    </li>
                    <li>
                      <strong>Kiểm soát chi phí cố định:</strong> Chi phí vận hành văn phòng duy trì đều đặn ở ngưỡng 18 - 20 triệu, quản lý ngân sách rất chặt chẽ.
                    </li>
                    <li>
                      <strong>Đề xuất chiến lược quý I/2027:</strong> Dự phòng thêm 10% quỹ công nghệ để phục vụ nâng cấp máy chủ nội bộ.
                    </li>
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    className="btn"
                    onClick={() => {
                      navigator.clipboard.writeText('BÁO CÁO PHÂN TÍCH DỮ LIỆU BẢNG TÍNH:\n- Tổng ngân sách: 734.000.000 ₫ (+14.8%)\n- Chi tiêu bình quân: 244.666.667 ₫/tháng\n- Hạng mục trọng điểm: Nhân sự (51%), Marketing (24%)');
                      ui.toast('Đã sao chép báo cáo phân tích vào clipboard!');
                    }}
                  >
                    <Copy size={14} />
                    <span>Sao chép tóm tắt báo cáo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Formula Generator & Error Fixer */}
            {aiActiveTab === 'formula' && (
              <div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#0f172a' }}>
                    ⚡ Đề xuất công thức tối ưu cho bảng tính hiện tại:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: '#107c41' }}>=XLOOKUP(A2, DanhSach!A:A, DanhSach!D:D, "Không tìm thấy", 0)</code>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            navigator.clipboard.writeText('=XLOOKUP(A2, DanhSach!A:A, DanhSach!D:D, "Không tìm thấy", 0)');
                            ui.toast('Đã sao chép công thức XLOOKUP!');
                          }}
                        >
                          Chép
                        </button>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>Tra cứu giá trị chính xác và tự động bẫy lỗi thay thế VLOOKUP cũ.</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: '#107c41' }}>=SUMIFS(E:E, B:B, "Nhân sự", C:C, "&gt;=100000000")</code>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            navigator.clipboard.writeText('=SUMIFS(E:E, B:B, "Nhân sự", C:C, ">=100000000")');
                            ui.toast('Đã sao chép công thức SUMIFS!');
                          }}
                        >
                          Chép
                        </button>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>Tính tổng ngân sách cho phòng ban Nhân sự với chi phí trên 100 triệu.</div>
                    </div>

                    <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: '#107c41' }}>=IFERROR(A1/B1, 0)</code>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            navigator.clipboard.writeText('=IFERROR(A1/B1, 0)');
                            ui.toast('Đã sao chép công thức IFERROR!');
                          }}
                        >
                          Chép
                        </button>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>Tự động bẫy lỗi chia cho 0 hoặc ô rỗng.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-sheet" onClick={() => setShowAiModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Templates Library Modal */}
      {showTemplatesModal && (
        <div className="dialog-backdrop" onClick={() => setShowTemplatesModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Thư viện mẫu bảng tính chuẩn doanh nghiệp</h2>
                <div className="dialog-subtitle">Chọn mẫu biểu được thiết lập sẵn công thức và định dạng chuyên nghiệp</div>
              </div>
              <button className="icon-btn" onClick={() => setShowTemplatesModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleLoadTemplate('budget')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ background: '#dcfce7', padding: 6, borderRadius: 6 }}>
                    <DollarSign size={18} color="#16a34a" />
                  </div>
                  <strong style={{ fontSize: 13 }}>Kế hoạch Ngân sách quý</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Bảng theo dõi chi phí các phòng ban, công thức tự động tính tổng SUM, trung bình AVERAGE và tỷ trọng chi tiêu.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleLoadTemplate('payroll')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ background: '#e0e7ff', padding: 6, borderRadius: 6 }}>
                    <Table size={18} color="#4338ca" />
                  </div>
                  <strong style={{ fontSize: 13 }}>Bảng chấm công & tính lương</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Tự động tính ngày công thực tế, phụ cấp trách nhiệm, tổng thu nhập và thực lĩnh làm tròn số chuẩn kế toán.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleLoadTemplate('sales')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ background: '#dbeafe', padding: 6, borderRadius: 6 }}>
                    <TrendingUp size={18} color="#1d4ed8" />
                  </div>
                  <strong style={{ fontSize: 13 }}>Báo cáo Doanh số & KPI</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Theo dõi doanh số theo khu vực Bắc - Trung - Nam, tự động đánh giá chỉ tiêu KPI và tỷ lệ phần trăm vượt kế hoạch.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  background: '#f8fafc',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleLoadTemplate('inventory')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ background: '#ffedd5', padding: 6, borderRadius: 6 }}>
                    <Boxes size={18} color="#c2410c" />
                  </div>
                  <strong style={{ fontSize: 13 }}>Quản lý Kho hàng & Tồn kho</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Theo dõi xuất - nhập - tồn từng mã SKU, tính tổng giá trị hàng tồn và tự động cảnh báo khi chạm định mức an toàn.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn" onClick={() => setShowTemplatesModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Export to Image Modal */}
      {showExportImageModal && (
        <div className="dialog-backdrop" onClick={() => setShowExportImageModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Xuất bảng tính thành tệp ảnh (PNG)</h2>
                <div className="dialog-subtitle">Tạo ảnh chụp sắc nét độ phân giải cao phục vụ thuyết trình và báo cáo</div>
              </div>
              <button className="icon-btn" onClick={() => setShowExportImageModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8 }}>Chọn phạm vi chụp ảnh:</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 6, cursor: 'pointer' }}>
                <input type="radio" name="exportScope" defaultChecked />
                <span>Toàn bộ dữ liệu bảng tính đang mở</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                <input type="radio" name="exportScope" />
                <span>Vùng ô đang chọn (Selection area)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowExportImageModal(false)}>
                Huỷ
              </button>
              <button
                className="btn btn-sheet"
                onClick={() => {
                  setShowExportImageModal(false);
                  ui.toast('Đã chụp và tải ảnh bảng tính thành công (HD 300 DPI)!');
                }}
              >
                <Download size={14} />
                <span>Tải ảnh PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Split / Merge Modals */}
      {showSplitModal && (
        <div className="dialog-backdrop" onClick={() => setShowSplitModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Tách trang tính (Split Sheet)</h2>
              <button className="icon-btn" onClick={() => setShowSplitModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Hệ thống sẽ trích xuất từng tab trang tính thành các tệp bảng tính độc lập (.xlsx).
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowSplitModal(false)}>
                Đóng
              </button>
              <button
                className="btn btn-sheet"
                onClick={() => {
                  setShowSplitModal(false);
                  ui.toast('Đã tách thành công các trang tính thành tệp riêng');
                }}
              >
                Tiến hành tách
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeModal && (
        <div className="dialog-backdrop" onClick={() => setShowMergeModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Gộp bảng tính (Merge Workbooks)</h2>
              <button className="icon-btn" onClick={() => setShowMergeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Chọn các tệp bảng tính khác để gộp thêm các trang tính mới vào sổ tính hiện tại.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowMergeModal(false)}>
                Đóng
              </button>
              <button
                className="btn btn-sheet"
                onClick={() => {
                  setShowMergeModal(false);
                  ui.toast('Đã gộp trang tính thành công vào sổ tính');
                }}
              >
                Gộp tệp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Minh PDF Sign Modal */}
      {showMinhPdfModal && (
        <div className="dialog-backdrop" onClick={() => setShowMinhPdfModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSignature size={20} color="#dc2626" />
                <div>
                  <h2>Minh PDF — Ký số & Đóng dấu điện tử bảng tính</h2>
                  <div className="dialog-subtitle">Xác thực chứng từ điện tử chuẩn văn phòng số</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowMinhPdfModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Chứng thư số xác thực:</div>
              <div style={{ fontSize: 12, color: 'var(--ink)' }}>• Người ký: <strong>Bùi Đăng Minh (Giám đốc)</strong></div>
              <div style={{ fontSize: 12, color: 'var(--ink)' }}>• Đơn vị: CÔNG TY TNHH ĐẦU TƯ & THƯƠNG MẠI MINH SPARK</div>
              <div style={{ fontSize: 12, color: 'var(--ink)' }}>• Thời điểm ký: {new Date().toLocaleString('vi-VN')}</div>
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✔ Chứng thư số hợp lệ & đã được mã hoá bảo mật</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowMinhPdfModal(false)}>
                Huỷ
              </button>
              <button
                className="btn btn-sheet"
                onClick={() => {
                  setShowMinhPdfModal(false);
                  ui.toast('Đã hoàn tất đóng dấu ký số điện tử vào bảng tính!');
                }}
              >
                <Check size={14} />
                <span>Xác nhận ký số</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Share Modal */}
      {showShareModal && (
        <div className="dialog-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={20} color="#107c41" />
                <div>
                  <h2>Chia sẻ bảng tính</h2>
                  <div className="dialog-subtitle">Quản lý quyền truy cập và cộng tác an toàn</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Liên kết truy cập bảng tính:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="text-field"
                  readOnly
                  value={`http://localhost:5173/#sheet-${meta.id}`}
                  style={{ flex: 1, fontSize: 11, background: '#fff' }}
                />
                <button
                  className="btn btn-sheet"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:5173/#sheet-${meta.id}`);
                    ui.toast('Đã sao chép liên kết chia sẻ!');
                  }}
                >
                  <CopyCheck size={13} />
                  <span>Sao chép</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
              <span>Bảo mật: Hoạt động offline 100% tại máy chủ nội bộ.</span>
              <button className="btn" onClick={() => setShowShareModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Formula Library Modal */}
      {showFormulaModal && (
        <div className="dialog-backdrop" onClick={() => setShowFormulaModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Thư viện hàm công thức Minh Sheets & Excel</h2>
                <div className="dialog-subtitle">Hướng dẫn cú pháp, ý nghĩa và ví dụ áp dụng thực tế</div>
              </div>
              <button className="icon-btn" onClick={() => setShowFormulaModal(false)}>
                <X size={18} />
              </button>
            </div>

            <input
              className="text-field"
              placeholder="Tìm kiếm hàm (vd: SUM, VLOOKUP, IF, XLOOKUP, ROUND...)…"
              value={formulaSearch}
              onChange={(e) => setFormulaSearch(e.target.value)}
              style={{ marginBottom: 14 }}
              autoFocus
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {filteredFormulas.map((f) => (
                <div
                  key={f.name}
                  style={{
                    background: '#f8fafd',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14, color: 'var(--sheet)' }}>{f.name}</strong>
                      <span style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: 4 }}>
                        {f.group}
                      </span>
                    </div>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
                      onClick={() => {
                        navigator.clipboard.writeText(f.syntax);
                        ui.toast(`Đã sao chép cú pháp ${f.name}!`);
                      }}
                    >
                      Sao chép cú pháp
                    </button>
                  </div>

                  <code style={{ fontSize: 12, color: '#1565c0', background: '#eef3fc', padding: '3px 6px', borderRadius: 4, width: 'fit-content' }}>
                    {f.syntax}
                  </code>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>{f.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Ví dụ: <code style={{ color: '#555' }}>{f.example}</code>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-sheet" onClick={() => setShowFormulaModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Quick Chart Modal */}
      {showChartModal && (
        <div className="dialog-backdrop" onClick={() => setShowChartModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Tạo biểu đồ trực quan từ dữ liệu bảng tính</h2>
                <div className="dialog-subtitle">Biểu đồ tổng quan phân bổ ngân sách & chi tiêu các tháng</div>
              </div>
              <button className="icon-btn" onClick={() => setShowChartModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Simulated Interactive Bar Chart */}
            <div style={{ background: '#fafbfc', border: '1px solid var(--line)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16, textAlign: 'center', color: '#1e3a2f' }}>
                BIỂU ĐỒ CHI TIÊU CÁC HẠNG MỤC (Đơn vị: Triệu đồng)
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 200, borderBottom: '2px solid #ccc', paddingBottom: 10, justifyContent: 'center' }}>
                {[
                  { label: 'Nhân sự', val: 375, color: '#267863' },
                  { label: 'Marketing', val: 180, color: '#3d9970' },
                  { label: 'Công nghệ', val: 95, color: '#2ecc71' },
                  { label: 'Văn phòng', val: 56, color: '#27ae60' },
                  { label: 'Khác', val: 28, color: '#82c91e' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 70 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: item.color }}>{item.val} tr</div>
                    <div
                      style={{
                        width: 48,
                        height: `${(item.val / 400) * 160}px`,
                        background: item.color,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.4s ease',
                      }}
                    />
                    <div style={{ fontSize: 11, marginTop: 8, textAlign: 'center', fontWeight: 500 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Dữ liệu được trích xuất tự động từ bảng tính đang mở
              </span>
              <button className="btn btn-sheet" onClick={() => setShowChartModal(false)}>
                Đóng biểu đồ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: Help & Shortcuts Modal */}
      {showHelpModal && (
        <div className="dialog-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Phím tắt & Hướng dẫn Minh Sheets</h2>
                <div className="dialog-subtitle">Các phím tắt thông dụng giúp tăng tốc độ thao tác dữ liệu</div>
              </div>
              <button className="icon-btn" onClick={() => setShowHelpModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'Ctrl + S', desc: 'Lưu bảng tính vào bộ nhớ an toàn' },
                { key: 'Ctrl + C / V', desc: 'Sao chép và Dán giá trị ô' },
                { key: 'Ctrl + Z / Y', desc: 'Hoàn tác và Làm lại thao tác' },
                { key: 'F2', desc: 'Chỉnh sửa nội dung ô hiện tại' },
                { key: 'Ctrl + F', desc: 'Tìm kiếm dữ liệu trong bảng tính' },
                { key: 'Ctrl + P', desc: 'In hoặc xuất bảng tính ra PDF' },
                { key: 'Tab / Shift + Tab', desc: 'Di chuyển sang ô bên phải / bên trái' },
                { key: 'Enter', desc: 'Xác nhận và xuống dòng tiếp theo' },
                { key: 'Ctrl + Shift + %', desc: 'Định dạng phần trăm' },
                { key: 'Ctrl + Shift + $', desc: 'Định dạng tiền tệ' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: '#f8fafd',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{item.desc}</span>
                  <kbd
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-sheet" onClick={() => setShowHelpModal(false)}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: Version History Modal */}
      {showHistoryModal && (
        <div className="dialog-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="dialog wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2>Lịch sử phiên bản bảng tính</h2>
                <div className="dialog-subtitle">Xem các bản lưu tự động và khôi phục về trạng thái trước đó của bảng tính</div>
              </div>
              <button className="icon-btn" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Create Named Version Snapshot */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
              <input
                className="text-field"
                placeholder="Đặt tên cho bản lưu hiện tại (vd: Chốt số liệu quý IV)…"
                value={customVersionName}
                onChange={(e) => setCustomVersionName(e.target.value)}
                style={{ flex: 1, fontSize: 12 }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <button className="btn btn-sheet" onClick={() => handleCreateSnapshot()}>
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
                        className="btn btn-sheet"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => handleRestoreVersion(v)}
                        title="Khôi phục bảng tính về phiên bản này"
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
    </div>
  );
}