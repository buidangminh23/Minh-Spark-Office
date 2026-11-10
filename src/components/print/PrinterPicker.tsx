import type { ReactNode } from 'react';
import { FileOutput, FileText, Layers, Loader2, MonitorCog, Network, NotebookPen, Phone, Printer, RefreshCw, Share2, Usb } from 'lucide-react';
import type { PrintPlatform, PrinterInfo, PrinterKind } from '../../lib/print/printRun';
import { CardFace, OptionCard, type CardOption } from './OptionCard';
import { directPrinting, printerChoice, printerSubtitle, printerTone, savesAsPdf, type PrinterChoice, type Resolved } from './printerChoice';

const KIND_ICONS: Record<PrinterKind, (size: number) => ReactNode> = {
  usb: (s) => <Usb size={s} />,
  network: (s) => <Network size={s} />,
  shared: (s) => <Share2 size={s} />,
  local: (s) => <Printer size={s} />,
  pdf: (s) => <FileText size={s} />,
  xps: (s) => <FileOutput size={s} />,
  onenote: (s) => <NotebookPen size={s} />,
  fax: (s) => <Phone size={s} />,
  virtual: (s) => <FileOutput size={s} />,
  class: (s) => <Layers size={s} />,
};

type Props = {
  platform: PrintPlatform;
  printers: PrinterInfo[] | null;
  resolved: Resolved;
  scanning: boolean;
  onChange: (choice: PrinterChoice) => void;
  onRefresh: () => void;
};

const PDF_OPTION = (platform: PrintPlatform): CardOption<PrinterChoice> => ({
  value: 'pdf',
  title: 'Lưu thành PDF',
  subtitle: `Lưu vào thư mục Tải về rồi mở ${platform === 'mac' ? 'Finder' : 'File Explorer'}`,
  group: 'Lưu thành tệp',
  icon: <FileText size={20} />,
});

const SYSTEM_OPTION = (): CardOption<PrinterChoice> => ({
  value: 'system',
  title: 'Hộp thoại in của hệ thống',
  subtitle: 'Chọn máy in ở hộp thoại in kế tiếp',
  group: 'Khác',
  icon: <MonitorCog size={20} />,
});

function optionFor(printer: PrinterInfo): CardOption<PrinterChoice> {
  return {
    value: printerChoice(printer),
    title: printer.displayName,
    subtitle: savesAsPdf(printer) ? `${printerSubtitle(printer)} · lưu thẳng vào Tải về` : printerSubtitle(printer),
    group: printer.installed ? 'Máy in' : 'Máy in mạng tìm thấy',
    icon: <span className={`mp-printer-icon tone-${printerTone(printer)}`}>{KIND_ICONS[printer.kind](20)}</span>,
  };
}

export function PrinterPicker({ platform, printers, resolved, scanning, onChange, onRefresh }: Props) {
  if (platform === 'web') {
    return (
      <section className="mp-group">
        <h3>Máy in</h3>
        <div className="mp-card is-static">
          <CardFace icon={<Printer size={20} />} title="Máy in của trình duyệt" subtitle="Trình duyệt không cho trang web đọc danh sách máy in. Chọn máy in ở hộp thoại kế tiếp, hoặc dùng ứng dụng máy tính để chọn ngay tại đây." />
        </div>
      </section>
    );
  }

  const installed = (printers ?? []).filter((p) => p.installed);
  const found = (printers ?? []).filter((p) => !p.installed);
  const direct = directPrinting(platform);
  const options: CardOption<PrinterChoice>[] = [...installed.map(optionFor), ...found.map(optionFor), ...(direct ? [PDF_OPTION(platform)] : [SYSTEM_OPTION()])];
  const current = options.find((o) => o.value === resolved.choice) ?? (direct ? PDF_OPTION(platform) : SYSTEM_OPTION());
  const printer = resolved.printer;
  const icon = printer ? <span className={`mp-printer-icon tone-${printerTone(printer)}`}>{KIND_ICONS[printer.kind](20)}</span> : current.icon;
  const count = printers === null ? 'Đang tìm máy in…' : installed.length ? `${installed.length} máy in${found.length ? `, ${found.length} máy in mạng chưa cài` : ''}` : 'Chưa có máy in nào được cài';

  return (
    <section className="mp-group">
      <div className="mp-group-head">
        <h3>Máy in</h3>
        <span className="mp-group-meta" aria-live="polite">{count}</span>
        <button type="button" className="icon-btn mp-refresh" onClick={onRefresh} disabled={scanning} aria-label="Tìm lại máy in" title="Tìm lại máy in">
          {scanning ? <Loader2 size={15} className="mp-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>
      <OptionCard label="Máy in" icon={icon ?? <Printer size={20} />} title={current.title} subtitle={current.subtitle} options={options} value={current.value} onChange={onChange} />
    </section>
  );
}
