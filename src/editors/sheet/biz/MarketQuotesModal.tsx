import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { ProDialog } from '../SheetProModals';
import { isDesktop } from '../../../lib/desktop';
import type { MarketCategory, MarketQuote, MarketSnapshot } from '../../../../api/_shared/market';

const API_URL = isDesktop() ? 'https://office.minhspark.com/api/market' : '/api/market';
const STOCKS_KEY = 'minh-sheets-market-stocks';
const DEFAULT_STOCKS = 'FPT, VNM, VIC, HPG, MWG, SSI, VCB, TCB, ACB, MBB';
const CATEGORY_LABEL: Record<MarketCategory, string> = { index: 'Chỉ số', stock: 'Cổ phiếu', crypto: 'Tiền mã hoá', forex: 'Ngoại tệ', gold: 'Giá vàng' };
const CATEGORIES: ('all' | MarketCategory)[] = ['all', 'index', 'stock', 'crypto', 'forex', 'gold'];

const readStocks = () => {
  try {
    return localStorage.getItem(STOCKS_KEY) || DEFAULT_STOCKS;
  } catch {
    return DEFAULT_STOCKS;
  }
};

const signed = (n: number | null, suffix = '') => (n === null ? '' : `${n > 0 ? '+' : ''}${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${suffix}`);
const asOfText = (q: MarketQuote) => {
  if (!q.asOf) return '';
  const d = new Date(q.asOf);
  return Number.isNaN(d.getTime()) ? q.asOf : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};

export function MarketQuotesModal({
  onExportQuotes,
  onClose,
}: {
  onExportQuotes: (headers: string[], rows: (string | number)[][]) => void;
  onClose: () => void;
}) {
  const [stocks, setStocks] = useState(readStocks);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState('');
  const [category, setCategory] = useState<'all' | MarketCategory>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async (symbols: string) => {
    setLoading(true);
    setFailure('');
    try {
      const response = await fetch(`${API_URL}?stocks=${encodeURIComponent(symbols)}`, { cache: 'no-store' });
      const body = (await response.json()) as MarketSnapshot;
      if (!body.quotes?.length) throw new Error(body.errors?.map((e) => `${e.source}: ${e.message}`).join('; ') || `HTTP ${response.status}`);
      setSnapshot(body);
      setSelected(new Set(body.quotes.map((q) => q.id)));
      try {
        localStorage.setItem(STOCKS_KEY, symbols);
      } catch {
        return;
      }
    } catch (error) {
      setFailure(`Chưa lấy được dữ liệu thị trường. ${error instanceof Error ? error.message : ''} Kiểm tra kết nối mạng rồi bấm Cập nhật.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(readStocks());
  }, [load]);

  const visible = useMemo(() => (snapshot?.quotes ?? []).filter((q) => category === 'all' || q.category === category), [snapshot, category]);
  const allVisibleSelected = visible.length > 0 && visible.every((q) => selected.has(q.id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    visible.forEach((q) => (allVisibleSelected ? next.delete(q.id) : next.add(q.id)));
    return next;
  });

  const handleExport = () => {
    const picked = (snapshot?.quotes ?? []).filter((q) => selected.has(q.id));
    if (!picked.length || !snapshot) return;
    const fetchedAt = new Date(snapshot.updatedAt).toLocaleString('vi-VN');
    onExportQuotes(
      ['Mã', 'Tên', 'Nhóm', 'Giá', 'Thay đổi', '% Thay đổi', 'Đơn vị', 'Nguồn', 'Thời điểm dữ liệu', 'Lấy lúc'],
      picked.map((q) => [q.symbol, q.name, CATEGORY_LABEL[q.category], q.price, q.change ?? '', q.changePercent === null ? '' : q.changePercent / 100, q.unit, q.source, asOfText(q), fetchedAt]),
    );
  };

  return (
    <ProDialog
      title="Dữ liệu thị trường"
      subtitle="Giá thật lấy qua máy chủ Office 23: chỉ số và cổ phiếu (SSI), tiền mã hoá (CoinGecko), tỷ giá (Vietcombank), vàng (PNJ)"
      width={780}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={!selected.size || !snapshot}>
            <FileSpreadsheet size={15} /> Chèn {selected.size} mã vào Sheet mới
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label className="input-group" style={{ flex: 1 }}>
            <span className="input-label">Mã cổ phiếu cần lấy (cách nhau bằng dấu phẩy, tối đa 20)</span>
            <input value={stocks} onChange={(e) => setStocks(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load(stocks)} style={{ width: '100%', padding: '6px 8px' }} />
          </label>
          <button type="button" className="btn" onClick={() => void load(stocks)} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: 4 }} /> {loading ? 'Đang tải…' : 'Cập nhật'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`btn btn-sm ${category === c ? 'btn-primary' : ''}`} onClick={() => setCategory(c)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {c === 'all' ? 'Tất cả' : CATEGORY_LABEL[c]}
            </button>
          ))}
          {snapshot && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>Lấy lúc {new Date(snapshot.updatedAt).toLocaleTimeString('vi-VN')}</span>}
        </div>
        {failure && <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{failure}</div>}
        {snapshot?.errors.length ? (
          <div style={{ color: '#b45309', fontSize: 12 }}>Một số nguồn chưa trả dữ liệu: {snapshot.errors.map((e) => `${e.source} (${e.message})`).join('; ')}</div>
        ) : null}
        <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <th style={{ width: 36, padding: '6px 8px' }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Chọn tất cả" /></th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Mã</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Giá</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Thay đổi</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nguồn · thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const color = q.change === null ? '#334155' : q.change >= 0 ? '#15803d' : '#b91c1c';
                return (
                  <tr key={q.id} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => toggle(q.id)}>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}><input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} onClick={(e) => e.stopPropagation()} aria-label={q.symbol} /></td>
                    <td style={{ padding: '6px 8px' }}><div style={{ fontWeight: 600 }}>{q.symbol}</div><div style={{ fontSize: 11, color: '#64748b' }}>{q.name}</div></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{q.price.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}<div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{q.unit}</div></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color, fontVariantNumeric: 'tabular-nums' }}>{signed(q.change)}<div style={{ fontSize: 11 }}>{signed(q.changePercent, '%')}</div></td>
                    <td style={{ padding: '6px 8px', fontSize: 11, color: '#64748b' }}>{q.source}<div>{asOfText(q)}</div></td>
                  </tr>
                );
              })}
              {!visible.length && !loading && (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProDialog>
  );
}
