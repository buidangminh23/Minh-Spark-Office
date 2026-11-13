import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Check, X, FileSpreadsheet } from 'lucide-react';
import type { SlideElement } from '../../lib/slideTypes';
import type { FileMeta } from '../../lib/storage';
import { useWorkspace } from '../../lib/storage';
import type { WorkbookData } from '../../lib/sheetTypes';
import {
  SheetLinkError,
  buildChartFromGrid,
  buildTableFromGrid,
  findWorkbookSheet,
  formatSheetRange,
  listWorkbookSheets,
  parseSheetRange,
  readSheetRange,
} from '../../lib/slideSheetLink';

interface SlideSheetsLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElement: SlideElement | null;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
}

const LABEL_STYLE = { fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' } as const;
const DEFAULT_CELLS = 'A1:D5';

function splitStoredRange(range: string | undefined) {
  if (!range) return { sheetName: undefined, cells: DEFAULT_CELLS };
  try {
    const parsed = parseSheetRange(range);
    return { sheetName: parsed.sheetName, cells: formatSheetRange({ ...parsed, sheetName: undefined }) };
  } catch {
    return { sheetName: undefined, cells: DEFAULT_CELLS };
  }
}

function describeError(error: unknown) {
  if (error instanceof SheetLinkError) return error.message;
  return `Không đọc được sổ tính: ${error instanceof Error ? error.message : String(error)}`;
}

export function SlideSheetsLinkModal({
  isOpen,
  onClose,
  selectedElement,
  onUpdateElement,
}: SlideSheetsLinkModalProps) {
  const { listFiles, loadContent } = useWorkspace();
  const [files, setFiles] = useState<FileMeta[] | null>(null);
  const [fileId, setFileId] = useState('');
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [cells, setCells] = useState(DEFAULT_CELLS);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const elementId = selectedElement?.id;
  const storedLinkRef = useRef(selectedElement?.sheetLink);
  useLayoutEffect(() => {
    storedLinkRef.current = selectedElement?.sheetLink;
  });

  useEffect(() => {
    if (!isOpen || !elementId) return;
    let cancelled = false;
    const storedLink = storedLinkRef.current;
    const stored = splitStoredRange(storedLink?.range);
    setCells(stored.cells);
    setError(null);
    setIsSuccess(false);
    setWorkbook(null);
    setSheetId('');
    setFileId('');
    setFiles(null);
    listFiles()
      .then((all) => {
        if (cancelled) return;
        const sheets = all.filter((file) => file.kind === 'sheet' && !file.deletedAt);
        setFiles(sheets);
        const linked = storedLink?.fileId && sheets.some((file) => file.id === storedLink.fileId) ? storedLink.fileId : '';
        setFileId(linked);
        if (storedLink?.fileId && !linked) setError(`Không còn tìm thấy sổ tính đã liên kết "${storedLink.sheetName}". Hãy chọn lại sổ tính.`);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(describeError(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, elementId, listFiles]);

  useEffect(() => {
    if (!isOpen || !fileId) return;
    let cancelled = false;
    setWorkbook(null);
    loadContent(fileId)
      .then((content) => {
        if (cancelled) return;
        if (!content || content.kind !== 'sheet') {
          setError('Tệp đã chọn không phải sổ tính 23 Sheets hoặc chưa có nội dung.');
          return;
        }
        setWorkbook(content.workbook);
        const storedLink = storedLinkRef.current;
        const preferred = splitStoredRange(storedLink?.fileId === fileId ? storedLink.range : undefined).sheetName;
        try {
          setSheetId(findWorkbookSheet(content.workbook, preferred).id);
        } catch {
          setSheetId(listWorkbookSheets(content.workbook)[0]?.id ?? '');
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(describeError(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fileId, loadContent]);

  const sheets = useMemo(() => (workbook ? listWorkbookSheets(workbook) : []), [workbook]);

  if (!isOpen || !selectedElement) return null;

  const isSupported = selectedElement.type === 'chart' || selectedElement.type === 'table';
  const selectedFile = files?.find((file) => file.id === fileId);

  const handleSyncData = async () => {
    if (!fileId || !selectedFile) {
      setError('Hãy chọn một sổ tính 23 Sheets.');
      return;
    }
    setIsUpdating(true);
    setError(null);
    try {
      const content = await loadContent(fileId);
      if (!content || content.kind !== 'sheet') throw new SheetLinkError('Tệp đã chọn không phải sổ tính 23 Sheets hoặc chưa có nội dung.');
      const sheet = findWorkbookSheet(content.workbook, sheetId);
      const parsed = parseSheetRange(cells);
      if (parsed.sheetName && parsed.sheetName !== sheet.name) {
        throw new SheetLinkError('Chỉ nhập vùng ô (ví dụ B2:E7); chọn trang tính ở ô phía trên.');
      }
      const range = { ...parsed, sheetName: sheet.name };
      const grid = readSheetRange(sheet, range);
      const lastSync = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const sheetLink = { fileId, sheetName: selectedFile.name, range: formatSheetRange(range), lastSync };
      if (selectedElement.type === 'chart') {
        const chart = buildChartFromGrid(grid, range, selectedElement.chartSeries);
        onUpdateElement(selectedElement.id, { chartCategories: chart.categories, chartSeries: chart.series, sheetLink });
      } else {
        const tableData = buildTableFromGrid(grid);
        onUpdateElement(selectedElement.id, {
          tableData,
          tableRows: tableData.length,
          tableCols: tableData[0].length,
          sheetLink,
        });
      }
      setIsSuccess(true);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="ppt-modal-backdrop" onClick={onClose}>
      <div className="ppt-dialog-card" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="ppt-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color="#059669" />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>Liên kết dữ liệu từ 23 Sheets</span>
          </div>
          <button className="ppt-dialog-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ppt-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Chọn một sổ tính đã lưu trong <strong>Office 23</strong> và vùng ô cần lấy. Mỗi lần bấm cập nhật, số liệu được đọc lại từ bản đã lưu của sổ tính.
          </p>

          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#166534' }}>
            <strong>Đối tượng:</strong> [{selectedElement.type.toUpperCase()}] {selectedElement.chartTitle || selectedElement.id}
            {selectedElement.type === 'chart' && (
              <div style={{ marginTop: '4px' }}>Hàng đầu của vùng là tên chuỗi, cột đầu là nhãn danh mục, các ô còn lại phải là số.</div>
            )}
          </div>

          {!isSupported && (
            <div role="alert" style={{ color: '#B91C1C', fontSize: '13px' }}>
              Chỉ biểu đồ hoặc bảng mới liên kết được với 23 Sheets.
            </div>
          )}

          <div>
            <label style={LABEL_STYLE} htmlFor="slide-sheets-link-file">Sổ tính 23 Sheets:</label>
            <select
              id="slide-sheets-link-file"
              className="ppt-dialog-select"
              style={{ width: '100%' }}
              value={fileId}
              disabled={!files || files.length === 0}
              onChange={(e) => {
                setFileId(e.target.value);
                setError(null);
                setIsSuccess(false);
              }}
            >
              <option value="">{files === null ? 'Đang tải danh sách…' : files.length === 0 ? 'Chưa có sổ tính nào được lưu' : 'Chọn sổ tính…'}</option>
              {files?.map((file) => (
                <option key={file.id} value={file.id}>{file.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL_STYLE} htmlFor="slide-sheets-link-sheet">Trang tính:</label>
            <select
              id="slide-sheets-link-sheet"
              className="ppt-dialog-select"
              style={{ width: '100%' }}
              value={sheetId}
              disabled={sheets.length === 0}
              onChange={(e) => {
                setSheetId(e.target.value);
                setIsSuccess(false);
              }}
            >
              {sheets.length === 0 && <option value="">—</option>}
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL_STYLE} htmlFor="slide-sheets-link-range">Vùng ô:</label>
            <input
              id="slide-sheets-link-range"
              type="text"
              className="ppt-input"
              style={{ width: '100%', fontFamily: 'monospace' }}
              value={cells}
              onChange={(e) => {
                setCells(e.target.value);
                setIsSuccess(false);
              }}
              placeholder="B2:E7"
            />
          </div>

          {selectedElement.sheetLink?.lastSync && (
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Lần đồng bộ gần nhất: <strong>{selectedElement.sheetLink.lastSync}</strong> · {selectedElement.sheetLink.sheetName} · {selectedElement.sheetLink.range}
            </div>
          )}

          {error && (
            <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {isSuccess && (
            <div style={{ background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
              <Check size={16} /> Đã cập nhật số liệu từ {selectedFile?.name}.
            </div>
          )}
        </div>

        <div className="ppt-dialog-footer">
          <button className="ppt-secondary-action-btn" onClick={onClose}>
            Đóng
          </button>
          <button
            className="ppt-primary-action-btn"
            style={{ background: '#059669', borderColor: '#059669' }}
            onClick={() => void handleSyncData()}
            disabled={isUpdating || !isSupported || !fileId || !workbook}
          >
            <RefreshCw size={16} className={isUpdating ? 'animate-spin' : ''} />
            {isUpdating ? 'Đang đọc sổ tính…' : 'Cập nhật số liệu'}
          </button>
        </div>
      </div>
    </div>
  );
}
