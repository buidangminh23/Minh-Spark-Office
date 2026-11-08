import { useState, useMemo } from 'react';
import {
  QrCode,
  Sparkles,
  Scissors,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Table,
} from 'lucide-react';
import { ProDialog } from './SheetProModals';
import {
  VIETNAMESE_BANKS,
  generateVietQrUrl,
  fuzzyMatch,
  runSheetSql,
  type SheetSqlResult,
} from '../../lib/vietnamUtils';

// -------------------------------------------------------------
// 1. VIETQR MODAL
// -------------------------------------------------------------
export function VietQrModal({
  initialAmount,
  onInsertQr,
  onClose,
}: {
  initialAmount?: number;
  onInsertQr: (url: string, altText: string) => void;
  onClose: () => void;
}) {
  const [bankBin, setBankBin] = useState('970436'); // Vietcombank default
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [memo, setMemo] = useState('');
  const [template, setTemplate] = useState<'compact2' | 'compact' | 'qr_only' | 'print'>('compact2');

  const previewUrl = useMemo(() => {
    if (!accountNumber.trim()) return '';
    return generateVietQrUrl({
      bankBin,
      accountNumber,
      accountName,
      amount: amount ? Number(amount) : undefined,
      memo,
      template,
    });
  }, [bankBin, accountNumber, accountName, amount, memo, template]);

  const handleApply = () => {
    if (!previewUrl) return;
    const bankObj = VIETNAMESE_BANKS.find((b) => b.bin === bankBin);
    const alt = `VietQR - ${bankObj?.shortName ?? ''} ${accountNumber} ${amount ? `${Number(amount).toLocaleString('vi-VN')} VND` : ''}`.trim();
    onInsertQr(previewUrl, alt);
    onClose();
  };

  return (
    <ProDialog
      title="Tạo mã VietQR chuyển khoản (NAPAS 247)"
      subtitle="Tự động sinh mã QR thanh toán chuẩn ngân hàng chèn vào bảng tính hoặc phiếu in"
      width={600}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!previewUrl}>
            <QrCode size={16} /> Chèn VietQR vào ô
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="input-group">
            <span className="input-label">Ngân hàng thụ hưởng</span>
            <select
              value={bankBin}
              onChange={(e) => setBankBin(e.target.value)}
              className="select-input"
              style={{ width: '100%', padding: '6px 8px' }}
            >
              {VIETNAMESE_BANKS.map((b) => (
                <option key={b.bin} value={b.bin}>
                  {b.shortName} - {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="input-group">
            <span className="input-label">Số tài khoản nhận</span>
            <input
              type="text"
              placeholder="Ví dụ: 0011002233445"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              style={{ width: '100%', padding: '6px 8px' }}
            />
          </label>

          <label className="input-group">
            <span className="input-label">Tên chủ tài khoản (không dấu)</span>
            <input
              type="text"
              placeholder="Ví dụ: NGUYEN VAN A"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              style={{ width: '100%', padding: '6px 8px' }}
            />
          </label>

          <label className="input-group">
            <span className="input-label">Số tiền (VND)</span>
            <input
              type="number"
              placeholder="Để trống nếu không cố định số tiền"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '6px 8px' }}
            />
          </label>

          <label className="input-group">
            <span className="input-label">Nội dung chuyển khoản (Memo)</span>
            <input
              type="text"
              placeholder="Ví dụ: Thanh toan HD 102"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ width: '100%', padding: '6px 8px' }}
            />
          </label>

          <label className="input-group">
            <span className="input-label">Kiểu khung QR</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="select-input"
              style={{ width: '100%', padding: '6px 8px' }}
            >
              <option value="compact2">Khung hiện đại (Compact 2 - Có logo & số TK)</option>
              <option value="compact">Khung tiêu chuẩn (Compact)</option>
              <option value="qr_only">Chỉ mã QR (Không viền)</option>
              <option value="print">Bản in hóa đơn (Print)</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', padding: 8 }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="VietQR Preview"
              style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 4 }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 20 }}>
              <QrCode size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>Nhập số tài khoản để xem trước mã QR</div>
            </div>
          )}
        </div>
      </div>
    </ProDialog>
  );
}

// -------------------------------------------------------------
// 2. DATA CLEANING STUDIO MODAL
// -------------------------------------------------------------
export function DataCleaningModal({
  headers,
  rows,
  onApplyCleaned,
  onClose,
}: {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  onApplyCleaned: (cleanedHeaders: string[], cleanedRows: (string | number | boolean | null)[][]) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'dedup' | 'normalize' | 'split'>('dedup');

  // Dedup state
  const [selectedCols, setSelectedCols] = useState<boolean[]>(headers.map(() => true));

  // Normalize state
  const [trimSpaces, setTrimSpaces] = useState(true);
  const [caseMode, setCaseMode] = useState<'none' | 'upper' | 'lower' | 'title'>('none');
  const [stripAccents, setStripAccents] = useState(false);

  // Split state
  const [splitColIdx, setSplitColIdx] = useState(0);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [customDelim, setCustomDelim] = useState('');

  // Dedup calculation
  const duplicateInfo = useMemo(() => {
    const seen = new Set<string>();
    let dupCount = 0;
    rows.forEach((r) => {
      const key = headers
        .map((_, i) => (selectedCols[i] ? String(r[i] ?? '') : ''))
        .join('|#|');
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    });
    return { dupCount, uniqueCount: rows.length - dupCount };
  }, [headers, rows, selectedCols]);

  const handleApplyDedup = () => {
    const seen = new Set<string>();
    const newRows = rows.filter((r) => {
      const key = headers
        .map((_, i) => (selectedCols[i] ? String(r[i] ?? '') : ''))
        .join('|#|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    onApplyCleaned(headers, newRows);
    onClose();
  };

  const handleApplyNormalize = () => {
    const toTitle = (s: string) =>
      s
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());

    const removeAcc = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

    const newRows = rows.map((r) =>
      r.map((val) => {
        if (typeof val !== 'string') return val;
        let s = val;
        if (trimSpaces) s = s.trim().replace(/\s+/g, ' ');
        if (caseMode === 'upper') s = s.toUpperCase();
        else if (caseMode === 'lower') s = s.toLowerCase();
        else if (caseMode === 'title') s = toTitle(s);
        if (stripAccents) s = removeAcc(s);
        return s;
      })
    );
    onApplyCleaned(headers, newRows);
    onClose();
  };

  const handleApplySplit = () => {
    const sep = delimiter === 'custom' ? customDelim : delimiter;
    if (!sep) return;

    let maxParts = 1;
    const splitRows = rows.map((r) => {
      const raw = String(r[splitColIdx] ?? '');
      const parts = raw.split(sep).map((p) => p.trim());
      if (parts.length > maxParts) maxParts = parts.length;
      return { r, parts };
    });

    const newHeaders = [...headers];
    const baseColName = headers[splitColIdx] ?? 'Col';
    const insertHeaders: string[] = [];
    for (let i = 1; i <= maxParts; i++) {
      insertHeaders.push(`${baseColName}_${i}`);
    }
    newHeaders.splice(splitColIdx, 1, ...insertHeaders);

    const newRows = splitRows.map(({ r, parts }) => {
      const copy = [...r];
      const filledParts = Array.from({ length: maxParts }, (_, i) => parts[i] ?? '');
      copy.splice(splitColIdx, 1, ...filledParts);
      return copy;
    });

    onApplyCleaned(newHeaders, newRows);
    onClose();
  };

  return (
    <ProDialog
      title="Xưởng làm sạch dữ liệu (Data Cleaning Studio)"
      subtitle="Xóa trùng lặp, chuẩn hóa chữ hoa/thường và tách cột văn bản"
      width={640}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          {activeTab === 'dedup' && (
            <button className="btn btn-primary" onClick={handleApplyDedup}>
              Xóa {duplicateInfo.dupCount} dòng trùng lặp
            </button>
          )}
          {activeTab === 'normalize' && (
            <button className="btn btn-primary" onClick={handleApplyNormalize}>
              Áp dụng chuẩn hóa văn bản
            </button>
          )}
          {activeTab === 'split' && (
            <button className="btn btn-primary" onClick={handleApplySplit}>
              Tách thành các cột
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
        <button
          className={`ribbon-tab-btn ${activeTab === 'dedup' ? 'active' : ''}`}
          onClick={() => setActiveTab('dedup')}
          style={{ padding: '6px 14px', borderBottom: activeTab === 'dedup' ? '2px solid #107c41' : 'none' }}
        >
          <Layers size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Xóa trùng lặp ({duplicateInfo.dupCount})
        </button>
        <button
          className={`ribbon-tab-btn ${activeTab === 'normalize' ? 'active' : ''}`}
          onClick={() => setActiveTab('normalize')}
          style={{ padding: '6px 14px', borderBottom: activeTab === 'normalize' ? '2px solid #107c41' : 'none' }}
        >
          <Sparkles size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Chuẩn hóa văn bản
        </button>
        <button
          className={`ribbon-tab-btn ${activeTab === 'split' ? 'active' : ''}`}
          onClick={() => setActiveTab('split')}
          style={{ padding: '6px 14px', borderBottom: activeTab === 'split' ? '2px solid #107c41' : 'none' }}
        >
          <Scissors size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Tách cột (Text to Columns)
        </button>
      </div>

      {activeTab === 'dedup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Chọn các cột định danh để so khớp dòng trùng lặp. Tổng số dòng hiện tại:{' '}
            <strong>{rows.length}</strong> (Tìm thấy <strong>{duplicateInfo.dupCount}</strong> dòng trùng, sẽ giữ lại{' '}
            <strong>{duplicateInfo.uniqueCount}</strong> dòng duy nhất).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
            {headers.map((h, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={selectedCols[i]}
                  onChange={(e) => {
                    const copy = [...selectedCols];
                    copy[i] = e.target.checked;
                    setSelectedCols(copy);
                  }}
                />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{h}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'normalize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={trimSpaces} onChange={(e) => setTrimSpaces(e.target.checked)} />
            <span>Xóa dấu cách thừa ở đầu, cuối và khoảng trống kép ở giữa từ</span>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Chuyển đổi kiểu chữ (Letter Case):</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="radio" name="case" checked={caseMode === 'none'} onChange={() => setCaseMode('none')} />
                <span>Giữ nguyên</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="radio" name="case" checked={caseMode === 'upper'} onChange={() => setCaseMode('upper')} />
                <span>IN HOA TOÀN BỘ</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="radio" name="case" checked={caseMode === 'lower'} onChange={() => setCaseMode('lower')} />
                <span>in thường toàn bộ</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="radio" name="case" checked={caseMode === 'title'} onChange={() => setCaseMode('title')} />
                <span>Viết Hoa Đầu Từng Từ (Proper Case)</span>
              </label>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={stripAccents} onChange={(e) => setStripAccents(e.target.checked)} />
            <span>Chuyển tiếng Việt có dấu thành không dấu (Ví dụ: "Hà Nội" $\rightarrow$ "Ha Noi")</span>
          </label>
        </div>
      )}

      {activeTab === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="input-group">
            <span className="input-label">Chọn cột cần tách</span>
            <select
              value={splitColIdx}
              onChange={(e) => setSplitColIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px' }}
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Ký tự phân cách:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="radio" name="delim" checked={delimiter === ','} onChange={() => setDelimiter(',')} />
              <span>Dấu phẩy (,)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="radio" name="delim" checked={delimiter === ';'} onChange={() => setDelimiter(';')} />
              <span>Dấu chấm phẩy (;)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="radio" name="delim" checked={delimiter === ' '} onChange={() => setDelimiter(' ')} />
              <span>Khoảng trắng (Space)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="radio" name="delim" checked={delimiter === 'custom'} onChange={() => setDelimiter('custom')} />
              <span>Tùy chỉnh:</span>
            </label>
            {delimiter === 'custom' && (
              <input
                type="text"
                placeholder="Ví dụ: -"
                value={customDelim}
                onChange={(e) => setCustomDelim(e.target.value)}
                style={{ width: 60, padding: '4px 6px' }}
              />
            )}
          </div>
        </div>
      )}
    </ProDialog>
  );
}

// -------------------------------------------------------------
// 3. FUZZY RECONCILE / MATCHING MODAL
// -------------------------------------------------------------
export function FuzzyReconcileModal({
  headers,
  rows,
  onClose,
}: {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  onClose: () => void;
}) {
  const [colA, setColA] = useState(0);
  const [colB, setColB] = useState(headers.length > 1 ? 1 : 0);
  const [threshold, setThreshold] = useState(70);

  const reconcileResults = useMemo(() => {
    if (colA === colB || !rows.length) return [];
    const threshFrac = threshold / 100;
    const listB = rows.map((r, idx) => ({ idx, val: String(r[colB] ?? '') })).filter((x) => x.val.trim());

    return rows.map((r) => {
      const valA = String(r[colA] ?? '').trim();
      if (!valA) return { valA: '(Trống)', bestMatch: '', score: 0, status: 'missing' as const };

      let bestScore = 0;
      let bestVal = '';

      for (const item of listB) {
        const s = fuzzyMatch(valA, item.val);
        if (s > bestScore) {
          bestScore = s;
          bestVal = item.val;
        }
      }

      let status: 'exact' | 'partial' | 'missing' = 'missing';
      if (bestScore >= 0.98) status = 'exact';
      else if (bestScore >= threshFrac) status = 'partial';

      return {
        valA,
        bestMatch: bestVal,
        score: Math.round(bestScore * 100),
        status,
      };
    });
  }, [rows, colA, colB, threshold]);

  return (
    <ProDialog
      title="Đối soát dữ liệu gần đúng (Fuzzy Reconcile)"
      subtitle="Tự động tìm kiếm và so khớp các bản ghi lệch tên (Sổ ngân hàng vs Sổ kế toán)"
      width={680}
      onClose={onClose}
      actions={
        <button className="btn btn-primary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 12, marginBottom: 14 }}>
        <label className="input-group">
          <span className="input-label">Cột nguồn (Ví dụ: Sổ phụ)</span>
          <select value={colA} onChange={(e) => setColA(Number(e.target.value))} style={{ width: '100%', padding: '6px' }}>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <label className="input-group">
          <span className="input-label">Cột đối chiếu (Ví dụ: Sổ quỹ)</span>
          <select value={colB} onChange={(e) => setColB(Number(e.target.value))} style={{ width: '100%', padding: '6px' }}>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <label className="input-group">
          <span className="input-label">Ngưỡng khớp: {threshold}%</span>
          <input
            type="range"
            min={40}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: '100%', marginTop: 8 }}
          />
        </label>
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Giá trị nguồn</th>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Khớp tốt nhất</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', width: 90 }}>Độ khớp</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', width: 90 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {reconcileResults.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 10px' }}>{r.valA}</td>
                <td style={{ padding: '6px 10px', color: r.bestMatch ? '#0f172a' : '#94a3b8' }}>
                  {r.bestMatch || '(Không tìm thấy)'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, color: r.score >= 90 ? '#16a34a' : r.score >= 70 ? '#ea580c' : '#dc2626' }}>
                    {r.score}%
                  </span>
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  {r.status === 'exact' && <span className="tag" style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4 }}>Khớp 100%</span>}
                  {r.status === 'partial' && <span className="tag" style={{ background: '#ffedd5', color: '#9a3412', padding: '2px 6px', borderRadius: 4 }}>Gần đúng</span>}
                  {r.status === 'missing' && <span className="tag" style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4 }}>Lệch</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProDialog>
  );
}

// -------------------------------------------------------------
// 4. IN-SHEET SQL QUERY MODAL
// -------------------------------------------------------------
export function SheetSqlModal({
  headers,
  rows,
  onExportQueryResults,
  onClose,
}: {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  onExportQueryResults: (resHeaders: string[], resRows: (string | number | boolean | null)[][]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(`SELECT * WHERE ${headers[0] ?? 'Col'} IS NOT NULL LIMIT 20`);
  const [result, setResult] = useState<SheetSqlResult | null>(null);

  const handleRun = () => {
    const res = runSheetSql(headers, rows, query);
    setResult(res);
  };

  const handleExport = () => {
    if (!result || result.error || !result.rows.length) return;
    onExportQueryResults(result.headers, result.rows);
    onClose();
  };

  return (
    <ProDialog
      title="Truy vấn dữ liệu bằng SQL (In-Sheet SQL Engine)"
      subtitle="Chạy câu lệnh SELECT, WHERE, ORDER BY, LIMIT trực tiếp trên bảng tính"
      width={680}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn" onClick={handleRun}>
            <Database size={15} /> Chạy truy vấn (Execute)
          </button>
          {result && !result.error && result.rows.length > 0 && (
            <button className="btn btn-primary" onClick={handleExport}>
              <Table size={15} /> Xuất kết quả vào Sheet mới
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Các cột khả dụng:{' '}
          {headers.map((h, i) => (
            <span key={i} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, marginRight: 4, fontFamily: 'monospace' }}>
              {h}
            </span>
          ))}
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          style={{ width: '100%', fontFamily: 'Consolas, monospace', fontSize: 13, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />

        {result?.error && (
          <div style={{ color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {result.error}
          </div>
        )}

        {result && !result.error && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
              Tìm thấy <strong>{result.totalCount}</strong> dòng kết quả:
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    {result.headers.map((h, i) => (
                      <th key={i} style={{ padding: '6px 10px', textAlign: 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {r.map((c, ci) => (
                        <td key={ci} style={{ padding: '6px 10px' }}>
                          {String(c ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProDialog>
  );
}

// -------------------------------------------------------------
// 5. WORKBOOK DOCTOR / HEALTH OPTIMIZER MODAL
// -------------------------------------------------------------
export function WorkbookDoctorModal({
  sheetNames,
  onCleanWorkbook,
  onClose,
}: {
  sheetNames: string[];
  onCleanWorkbook: () => void;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);

  const handleClean = () => {
    onCleanWorkbook();
    setDone(true);
  };

  return (
    <ProDialog
      title="Bác sĩ tối ưu sổ tính (Workbook Health Doctor)"
      subtitle="Dọn sạch ô ma (Ghost cells), nén style rác và giảm dung lượng file Excel"
      width={540}
      onClose={onClose}
      actions={
        done ? (
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        ) : (
          <>
            <button className="btn" onClick={onClose}>
              Hủy
            </button>
            <button className="btn btn-primary" onClick={handleClean}>
              <Sparkles size={15} /> Bắt đầu dọn dẹp & tối ưu
            </button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, fontSize: 13, color: '#166534' }}>
          <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Sổ tính hiện có <strong>{sheetNames.length}</strong> trang tính (
          {sheetNames.slice(0, 4).join(', ')}
          {sheetNames.length > 4 ? '...' : ''}).
        </div>

        <ul style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, paddingLeft: 20 }}>
          <li>Xóa các hàng và cột trống vô hình nhưng mang định dạng thừa (Ghost cells).</li>
          <li>Thu nhỏ phạm vi sử dụng thực tế (Reset UsedRange).</li>
          <li>Xóa các định dạng style trùng lặp không sử dụng.</li>
          <li>Tăng tốc độ tải file và giảm dung lượng file khi lưu trữ.</li>
        </ul>

        {done && (
          <div style={{ color: '#15803d', fontWeight: 600, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            ✓ Đã hoàn tất dọn dẹp và tối ưu hóa sổ tính!
          </div>
        )}
      </div>
    </ProDialog>
  );
}
