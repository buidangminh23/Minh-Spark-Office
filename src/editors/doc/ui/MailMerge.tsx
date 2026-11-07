import { useEffect, useState } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import { exportDocx } from '../../../lib/docxConvert';
import { downloadBlob, pickFile } from '../../../lib/download';
import { listFiles, loadContent, saveFile, type FileMeta } from '../../../lib/storage';
import type { WorkbookData } from '../../../lib/sheetTypes';
import { newId, useDoc, type DocCtx, type MergeData } from '../DocContext';
import { fillMergeFields, jsonText, parseDelimited } from '../docTools';

const cellText = (cell?: { v?: unknown; p?: { body?: { dataStream?: string } } }) => {
  if (!cell) return '';
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return (cell.p?.body?.dataStream ?? '').replace(/[\r\n]+$/, '');
};

const fromWorkbook = (workbook: WorkbookData, source: string): MergeData => {
  const sheet = workbook.sheets[workbook.sheetOrder[0]];
  const rowIndexes = Object.keys(sheet.cellData).map(Number).sort((a, b) => a - b);
  const headerRow = sheet.cellData[rowIndexes[0]] ?? {};
  const columns = Object.keys(headerRow).map(Number).sort((a, b) => a - b);
  const headers = columns.map((c, i) => cellText(headerRow[c]).trim() || `Cột ${i + 1}`);
  const rows = rowIndexes.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [headers[i], cellText(sheet.cellData[r]?.[c]).trim()]))).filter((row) => Object.values(row).some(Boolean));
  return { headers, rows, source };
};

async function readSpreadsheetFile(file: File): Promise<MergeData> {
  if (/\.(csv|txt|tsv)$/i.test(file.name)) {
    const parsed = parseDelimited(await file.text());
    return { ...parsed, source: file.name };
  }
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer());
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const [head = [], ...body] = rows;
  const headers = head.map((h, i) => String(h).trim() || `Cột ${i + 1}`);
  return { headers, rows: body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? '').trim()]))).filter((row) => Object.values(row).some(Boolean)), source: file.name };
}

export function MailMergeDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [sheets, setSheets] = useState<FileMeta[]>([]);
  const [data, setData] = useState<MergeData | null>(ctx.merge);
  const [error, setError] = useState('');

  useEffect(() => {
    void listFiles().then((files) => setSheets(files.filter((f) => f.kind === 'sheet' && !f.deletedAt)));
  }, []);

  const loadSheet = async (meta: FileMeta) => {
    const content = await loadContent(meta.id);
    if (content?.kind !== 'sheet') return setError('Không đọc được bảng tính này.');
    setData(fromWorkbook(content.workbook, meta.name));
    setError('');
  };

  const upload = async () => {
    const file = await pickFile('.csv,.tsv,.txt,.xlsx,.xls');
    if (!file) return;
    try {
      setData(await readSpreadsheetFile(file));
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Không đọc được tệp.');
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="dialog wide" role="dialog" aria-modal="true" aria-label="Chọn danh sách người nhận">
        <button className="dialog-close icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <h2>Trộn thư — chọn danh sách người nhận</h2>
        <div className="dialog-subtitle">Dòng đầu tiên là tên cột. Mỗi dòng tiếp theo tạo ra một bản tài liệu.</div>
        <div className="merge-sources">
          <button className="btn" onClick={() => void upload()}><Upload size={14} /> Tải tệp CSV / Excel</button>
          {sheets.map((sheet) => <button key={sheet.id} className="btn" onClick={() => void loadSheet(sheet)}><FileSpreadsheet size={14} color="#107c41" /> {sheet.name}</button>)}
        </div>
        {error && <div className="form-error">{error}</div>}
        {data && (
          <div className="merge-preview">
            <div className="merge-preview-head">{data.source} — {data.rows.length} bản ghi, {data.headers.length} trường</div>
            <div className="merge-table-wrap">
              <table>
                <thead><tr>{data.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{data.rows.slice(0, 6).map((row, i) => <tr key={i}>{data.headers.map((h) => <td key={h}>{row[h]}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" disabled={!data?.rows.length} onClick={() => { ctx.setMerge(data); ctx.ui.toast('Đã nạp danh sách. Vào tab Gửi thư → Chèn trường.'); onClose(); }}>Dùng danh sách này</button>
        </div>
      </section>
    </div>
  );
}

const MAX_FILES = 300;

export async function finishMerge(ctx: DocCtx, mode: 'single' | 'files') {
  const merge = ctx.merge;
  if (!merge?.rows.length) return;
  const doc = ctx.editor.getJSON();
  let hasField = false;
  JSON.stringify(doc, (key, value) => {
    if (key === 'type' && value === 'mergeField') hasField = true;
    return value;
  });
  if (!hasField && !(await ctx.ui.confirm('Chưa có trường trộn nào', 'Tài liệu chưa chèn «trường» nào nên mọi bản sẽ giống hệt nhau. Vẫn tiếp tục?'))) return;
  const base = ctx.title.replace(/\.[^/.]+$/, '');
  try {
    if (mode === 'single') {
      ctx.ui.showBusy(`Đang trộn ${merge.rows.length} bản ghi…`);
      const content: JSONContent[] = [];
      merge.rows.forEach((row, index) => {
        content.push(...(fillMergeFields(doc, row).content ?? []));
        if (index < merge.rows.length - 1) content.push({ type: 'pageBreak' });
      });
      const json: JSONContent = { type: 'doc', content };
      const meta: FileMeta = { id: newId('doc'), name: `${base} - đã trộn (${merge.rows.length}).docx`, kind: 'doc', createdAt: Date.now(), updatedAt: Date.now(), openedAt: Date.now(), starred: false, deletedAt: null, size: JSON.stringify(json).length, preview: jsonText(json).slice(0, 160) };
      await saveFile(meta, { kind: 'doc', json, page: ctx.page });
      ctx.ui.toast(`Đã tạo “${meta.name}” trong danh sách tệp`);
    } else {
      const rows = merge.rows.slice(0, MAX_FILES);
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const firstKey = merge.headers[0];
      for (const [index, row] of rows.entries()) {
        ctx.ui.showBusy(`Đang tạo tệp ${index + 1}/${rows.length}…`);
        const name = `${String(index + 1).padStart(3, '0')} - ${(row[firstKey] || 'ban-ghi').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60)}.docx`;
        zip.file(name, await exportDocx(fillMergeFields(doc, row), ctx.page, base));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base} - tron thu.zip`);
      ctx.ui.toast(`Đã tải ${rows.length} tệp .docx (nén trong .zip)${merge.rows.length > MAX_FILES ? `, giới hạn ${MAX_FILES} bản` : ''}`);
    }
  } catch (error) {
    ctx.ui.toast((error as Error).message || 'Trộn thư thất bại', true);
  } finally {
    ctx.ui.showBusy(null);
  }
}
