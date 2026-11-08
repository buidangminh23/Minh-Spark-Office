import QRCode from 'qrcode';
import { buildVietQrPayload, removeVietnameseAccents, VIETNAMESE_BANKS, type VietQrOptions } from './vietnamUtils';

export type VietQrCardOptions = VietQrOptions & { accountName?: string; withCaption?: boolean };
export type VietQrCard = { dataUrl: string; width: number; height: number; payload: string };

const QR_SIZE = 440;
const PADDING = 24;
const LINE_HEIGHT = 30;

export function vietQrCaptionLines(opts: VietQrCardOptions): string[] {
  const bank = VIETNAMESE_BANKS.find((b) => b.bin === opts.bankBin);
  const lines = [`${bank?.name ?? opts.bankBin} · ${opts.accountNumber.replace(/\s/g, '')}`];
  const name = removeVietnameseAccents(opts.accountName ?? '').trim().toUpperCase();
  if (name) lines.push(name);
  if (opts.amount && opts.amount > 0) lines.push(`${Math.round(opts.amount).toLocaleString('vi-VN')} VND`);
  if (opts.memo?.trim()) lines.push(removeVietnameseAccents(opts.memo.trim()).slice(0, 50));
  return lines;
}

export async function renderVietQrCard(opts: VietQrCardOptions): Promise<VietQrCard> {
  const payload = buildVietQrPayload(opts);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, payload, { width: QR_SIZE, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  const lines = opts.withCaption === false ? [] : vietQrCaptionLines(opts);
  const card = document.createElement('canvas');
  card.width = QR_SIZE + PADDING * 2;
  card.height = QR_SIZE + PADDING * 2 + (lines.length ? lines.length * LINE_HEIGHT + 8 : 0);
  const g = card.getContext('2d');
  if (!g) throw new Error('Trình duyệt không vẽ được mã QR');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, card.width, card.height);
  g.drawImage(qr, PADDING, PADDING);
  g.textAlign = 'center';
  lines.forEach((line, i) => {
    g.fillStyle = i === 0 ? '#0f172a' : '#334155';
    g.font = `${i === 0 ? '600 ' : ''}22px Arial, sans-serif`;
    g.fillText(line, card.width / 2, QR_SIZE + PADDING + 8 + LINE_HEIGHT * (i + 1) - 8, card.width - PADDING * 2);
  });
  return { dataUrl: card.toDataURL('image/png'), width: card.width, height: card.height, payload };
}
