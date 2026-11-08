import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { VIETNAMESE_BANKS, parseVietnameseAmount } from '../lib/vietnamUtils';
import { renderVietQrCard, type VietQrCard } from '../lib/vietQrCard';

const FIELD_STYLE = { width: '100%', padding: '6px 8px' } as const;

export function VietQrPanel({ onCard }: { onCard: (card: VietQrCard | null) => void }) {
  const [bankBin, setBankBin] = useState<string>(VIETNAMESE_BANKS[0].bin);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [withCaption, setWithCaption] = useState(true);
  const [card, setCard] = useState<VietQrCard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!accountNumber.trim()) {
        setCard(null);
        setError('');
        onCard(null);
        return;
      }
      const parsed = amount.trim() ? parseVietnameseAmount(amount) : 0;
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCard(null);
        setError('Số tiền không hợp lệ');
        onCard(null);
        return;
      }
      renderVietQrCard({ bankBin, accountNumber, accountName, amount: parsed, memo, withCaption })
        .then((next) => {
          if (!alive) return;
          setCard(next);
          setError('');
          onCard(next);
        })
        .catch((failure: unknown) => {
          if (!alive) return;
          setCard(null);
          setError(failure instanceof Error ? failure.message : 'Không tạo được mã QR');
          onCard(null);
        });
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [bankBin, accountNumber, accountName, amount, memo, withCaption, onCard]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="input-group">
          <span className="input-label">Ngân hàng nhận</span>
          <select value={bankBin} onChange={(e) => setBankBin(e.target.value)} className="select-input" style={FIELD_STYLE}>
            {VIETNAMESE_BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>{b.shortName} - {b.name}</option>
            ))}
          </select>
        </label>
        <label className="input-group">
          <span className="input-label">Số tài khoản nhận</span>
          <input type="text" inputMode="numeric" placeholder="Ví dụ: 0123456789" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} style={FIELD_STYLE} />
        </label>
        <label className="input-group">
          <span className="input-label">Tên chủ tài khoản (hiện dưới mã, không bắt buộc)</span>
          <input type="text" placeholder="Ví dụ: NGUYEN VAN A" value={accountName} onChange={(e) => setAccountName(e.target.value)} style={FIELD_STYLE} />
        </label>
        <label className="input-group">
          <span className="input-label">Số tiền (VND)</span>
          <input type="text" inputMode="numeric" placeholder="Để trống nếu người trả tự nhập" value={amount} onChange={(e) => setAmount(e.target.value)} style={FIELD_STYLE} />
        </label>
        <label className="input-group">
          <span className="input-label">Nội dung chuyển khoản</span>
          <input type="text" maxLength={50} placeholder="Ví dụ: Thanh toan HD 102" value={memo} onChange={(e) => setMemo(e.target.value)} style={FIELD_STYLE} />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={withCaption} onChange={(e) => setWithCaption(e.target.checked)} />
          <span>In ngân hàng, số tài khoản và số tiền dưới mã</span>
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', padding: 8 }}>
        {card ? (
          <img src={card.dataUrl} alt="Xem trước mã VietQR" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: error ? '#b91c1c' : '#94a3b8', fontSize: 13, padding: 16 }}>
            <QrCode size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>{error || 'Nhập số tài khoản để xem trước mã QR'}</div>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>Mã tạo ngay trên máy theo chuẩn VietQR (NAPAS 247), không gửi thông tin ra ngoài.</div>
      </div>
    </div>
  );
}
