import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { SheetPrintSettings } from '../../lib/storage';
import type { SheetData, WorkbookData } from '../../lib/sheetTypes';
import { exportSheetToStyledHtml } from '../../lib/xlsxConvert';
import { PrintDialog } from '../../components/print/PrintDialog';
import type { PrintItem, PrintSlice, PrintSource } from '../../components/print/printTypes';

type SheetScope = 'active' | 'all';
type AreaMode = 'data' | 'selection' | 'custom';

type MeasuredSheet = {
  key: string;
  header: string;
  tableOpen: string;
  colgroup: string;
  rows: string[];
  tops: number[];
  bottoms: number[];
  stamp: string;
  forced: number[];
  width: number;
  height: number;
};

const EDGE = 0.5;

function splitSheetHtml(html: string) {
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrap = parsed.body.firstElementChild!;
  const table = wrap.querySelector('table');
  const header = table?.previousElementSibling?.outerHTML ?? '';
  const stamp = table?.nextElementSibling?.outerHTML ?? '';
  const colgroup = table?.querySelector('colgroup')?.outerHTML ?? '';
  const rows = Array.from(table?.querySelectorAll('tbody > tr') ?? []).map((row) => row.outerHTML);
  const tableOpen = table ? `<table style="${table.getAttribute('style') ?? ''}">` : '<table>';
  return { header, stamp, colgroup, rows, tableOpen };
}

function measureSheet(key: string, html: string): MeasuredSheet {
  const parts = splitSheetHtml(html);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;width:max-content;pointer-events:none;background:#fff';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const origin = host.getBoundingClientRect().top;
    const rowEls = Array.from(host.querySelectorAll('tbody > tr'));
    const tops = rowEls.map((row) => row.getBoundingClientRect().top - origin);
    const bottoms = rowEls.map((row) => row.getBoundingClientRect().bottom - origin);
    const forced = rowEls.flatMap((row, index) => (row.hasAttribute('data-page-break') ? [tops[index]] : []));
    return { key, ...parts, tops, bottoms, forced, width: Math.ceil(host.scrollWidth), height: Math.ceil(host.scrollHeight) };
  } finally {
    host.remove();
  }
}

function sliceHtml(sheet: MeasuredSheet, slice: PrintSlice, repeatRows: number) {
  const end = slice.offsetPx + slice.heightPx;
  const body: string[] = [];
  const repeat = slice.part > 0 ? Math.min(repeatRows, sheet.rows.length) : 0;
  for (let i = 0; i < repeat; i += 1) body.push(sheet.rows[i]);
  for (let i = 0; i < sheet.rows.length; i += 1) {
    if (sheet.tops[i] >= slice.offsetPx - EDGE && sheet.bottoms[i] <= end + EDGE && i >= repeat) body.push(sheet.rows[i]);
  }
  const header = slice.offsetPx < EDGE ? sheet.header : '';
  const lastBottom = sheet.bottoms[sheet.bottoms.length - 1] ?? 0;
  const stamp = end >= sheet.height - EDGE || lastBottom <= end + EDGE ? sheet.stamp : '';
  return `${header}${sheet.tableOpen}${sheet.colgroup}<tbody>${body.join('')}</tbody></table>${stamp}`;
}

function repeatHeight(sheet: MeasuredSheet, rows: number) {
  if (rows <= 0 || !sheet.rows.length) return 0;
  const last = Math.min(rows, sheet.rows.length) - 1;
  return sheet.bottoms[last] - sheet.tops[0];
}

function toItem(sheet: MeasuredSheet, repeatRows: number): PrintItem {
  return {
    key: sheet.key,
    size: { w: sheet.width, h: sheet.height },
    breaks: sheet.bottoms,
    forcedBreaks: sheet.forced,
    repeatPx: repeatHeight(sheet, repeatRows),
    slicesSelf: true,
    render: (slice) => <div className="mp-sheet-html" style={{ width: sheet.width }} dangerouslySetInnerHTML={{ __html: sliceHtml(sheet, slice, repeatRows) }} />,
  };
}

type Props = {
  workbook: WorkbookData;
  activeSheetId: string;
  title: string;
  activeRangeA1: string;
  settings: SheetPrintSettings;
  onSaveSettings: (next: SheetPrintSettings) => void;
  onDownloadHtml: (next: SheetPrintSettings) => void;
  onClose: () => void;
};

export function SheetPrintDialog({ workbook, activeSheetId, title, activeRangeA1, settings, onSaveSettings, onDownloadHtml, onClose }: Props) {
  const [scope, setScope] = useState<SheetScope>('active');
  const [areaMode, setAreaMode] = useState<AreaMode>(settings.printArea ? 'custom' : 'data');
  const [customArea, setCustomArea] = useState(settings.printArea ?? '');
  const [gridlines, setGridlines] = useState(settings.showGridlines);
  const [repeatRows, setRepeatRows] = useState(0);
  const [measured, setMeasured] = useState<MeasuredSheet[] | null>(null);
  const [paper, setPaper] = useState<{ paper: string; orientation: string }>({ paper: settings.paperSize, orientation: settings.orientation });

  const printArea = areaMode === 'selection' ? activeRangeA1 : areaMode === 'custom' ? customArea.trim() : '';
  const sheetIds = useMemo(
    () => (scope === 'all' ? workbook.sheetOrder.filter((id) => workbook.sheets[id] && !workbook.sheets[id].hidden) : [activeSheetId]),
    [scope, workbook, activeSheetId],
  );

  useEffect(() => {
    setMeasured(null);
    const timer = window.setTimeout(() => {
      const result = sheetIds
        .map((id) => workbook.sheets[id] as SheetData | undefined)
        .filter((sheet): sheet is SheetData => Boolean(sheet))
        .map((sheet) =>
          measureSheet(
            sheet.id,
            exportSheetToStyledHtml(workbook, sheet, {
              title,
              showGridlines: gridlines,
              printArea: scope === 'active' ? printArea : '',
              fitToPage: false,
              pageBreakRows: settings.pageBreaks?.[sheet.id],
              signedBy: settings.signedBy,
              signedRole: settings.signedRole,
              signedAt: settings.signedAt,
              standalone: false,
            }),
          ),
        );
      setMeasured(result);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [sheetIds, workbook, title, gridlines, printArea, scope, settings.signedBy, settings.signedRole, settings.signedAt, settings.pageBreaks]);

  const source: PrintSource = useMemo(
    () => ({
      kind: 'sheet',
      title,
      flowsVertically: true,
      loading: measured === null,
      items: (measured ?? []).map((sheet) => toItem(sheet, repeatRows)),
    }),
    [title, measured, repeatRows],
  );

  const persisted = (): SheetPrintSettings => ({
    ...settings,
    showGridlines: gridlines,
    printArea: areaMode === 'data' ? '' : printArea,
    paperSize: (['A4', 'A3', 'Letter'] as const).includes(paper.paper as 'A4') ? (paper.paper as SheetPrintSettings['paperSize']) : settings.paperSize,
    orientation: paper.orientation === 'portrait' || paper.orientation === 'landscape' ? paper.orientation : settings.orientation,
  });

  const close = () => {
    const next = persisted();
    if (next.showGridlines !== settings.showGridlines || next.printArea !== (settings.printArea ?? '') || next.paperSize !== settings.paperSize || next.orientation !== settings.orientation) onSaveSettings(next);
    onClose();
  };

  const extra = (
    <>
      <h3>Bảng tính</h3>
      <div className="mp-field">
        <span>Trang tính</span>
        <div className="mp-segment" role="radiogroup" aria-label="Trang tính">
          {([['active', 'Đang mở'], ['all', 'Tất cả']] as const).map(([value, label]) => (
            <button key={value} role="radio" aria-checked={scope === value} className={scope === value ? 'on' : ''} onClick={() => setScope(value)}>{label}</button>
          ))}
        </div>
      </div>
      {scope === 'active' && (
        <div className="mp-field">
          <span>Vùng in</span>
          <div className="mp-segment" role="radiogroup" aria-label="Vùng in">
            {([['data', 'Toàn bộ dữ liệu'], ['selection', 'Vùng đang chọn'], ['custom', 'Nhập vùng']] as const).map(([value, label]) => (
              <button key={value} role="radio" aria-checked={areaMode === value} className={areaMode === value ? 'on' : ''} onClick={() => setAreaMode(value)}>{label}</button>
            ))}
          </div>
          {areaMode === 'selection' && <span className="mp-hint">Đang chọn {activeRangeA1}</span>}
          {areaMode === 'custom' && <input className="text-field" value={customArea} onChange={(e) => setCustomArea(e.target.value.toUpperCase())} placeholder="Ví dụ A1:H40" aria-label="Vùng in" />}
        </div>
      )}
      <label className="mp-field">
        <span>Lặp lại dòng tiêu đề trên mọi trang</span>
        <select className="text-field" value={repeatRows} onChange={(e) => setRepeatRows(Number(e.target.value))}>
          <option value={0}>Không lặp</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} dòng đầu</option>)}
        </select>
      </label>
      <label className="mp-check"><input type="checkbox" checked={gridlines} onChange={(e) => setGridlines(e.target.checked)} /><span>In đường kẻ ô</span></label>
      <button className="btn mp-auto-btn" onClick={() => onDownloadHtml(persisted())}><Download size={14} /><span>Tải bản in HTML</span></button>
    </>
  );

  return (
    <PrintDialog
      source={source}
      onClose={close}
      extraOptions={extra}
      onSettingsChange={(s) => setPaper((prev) => (prev.paper === s.paper && prev.orientation === s.orientation ? prev : { paper: s.paper, orientation: s.orientation }))}
    />
  );
}
