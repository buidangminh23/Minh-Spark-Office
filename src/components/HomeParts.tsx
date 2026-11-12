import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, Cloud, CloudCheck, CloudOff, Download, Languages, LogOut, RefreshCw, Upload, X } from 'lucide-react';
import { useAccount } from './Authentication';
import { DesktopFileSettings } from './DesktopFileSettings';
import { openDraftImport, useWorkspaceSync } from './WorkspaceStatus';
import type { SyncStatus } from '../lib/syncTypes';
import { getLanguage, setLanguage, type AppLanguage } from '../lib/i18n/language';

const LANGUAGE_OPTIONS: Array<[AppLanguage, string]> = [
  ['vi', 'Tiếng Việt'],
  ['en', 'English'],
];

export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: Event) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Popover({ open, onClose, trigger, children, align = 'end', className = '' }: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const ref = useDismiss<HTMLDivElement>(open, onClose);
  return (
    <div className={`ws-popover-anchor ${className}`} ref={ref}>
      {trigger}
      {open && <div className={`ws-popover ws-popover-${align}`} role="menu">{children}</div>}
    </div>
  );
}

const SYNC_SHORT: Record<SyncStatus['state'], string> = {
  connecting: 'Đang kết nối',
  syncing: 'Đang đồng bộ',
  synced: 'Đã đồng bộ',
  offline: 'Ngoại tuyến',
  error: 'Chưa đồng bộ',
};

const SYNC_DETAIL: Record<SyncStatus['state'], string> = {
  connecting: 'Đang kết nối với kho tài liệu của tài khoản.',
  syncing: 'Đang gửi thay đổi lên tài khoản.',
  synced: 'Mọi thay đổi đã có trên web và ứng dụng máy tính.',
  offline: 'Thay đổi được lưu trên máy và sẽ đồng bộ khi có mạng.',
  error: 'Chưa đồng bộ được. Thay đổi vẫn được giữ trên máy.',
};

function SyncIcon({ signedIn, state }: { signedIn: boolean; state: SyncStatus['state'] }) {
  if (!signedIn) return <Cloud size={20} aria-hidden="true" />;
  if (state === 'synced') return <CloudCheck size={20} aria-hidden="true" />;
  if (state === 'syncing' || state === 'connecting') return <RefreshCw size={18} className="ws-spin" aria-hidden="true" />;
  return <CloudOff size={20} aria-hidden="true" />;
}

export function SyncButton() {
  const { user, login, status, syncNow } = useWorkspaceSync();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const tone = !user ? 'draft' : status.state;
  return (
    <Popover
      open={open}
      onClose={close}
      trigger={
        <button className={`ws-top-link ws-sync ws-sync-${tone}`} aria-label={user ? SYNC_SHORT[status.state] : 'Lưu trên máy'} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
          <SyncIcon signedIn={Boolean(user)} state={status.state} />
          <span>{user ? SYNC_SHORT[status.state] : 'Lưu trên máy'}</span>
        </button>
      }
    >
      <div className="ws-popover-head">
        <strong>{user ? SYNC_SHORT[status.state] : 'Bản nháp trên thiết bị'}</strong>
        <span>{user ? SYNC_DETAIL[status.state] : 'Đăng nhập Google để đồng bộ tài liệu với bản web và ứng dụng máy tính.'}</span>
        {user && status.message && <span className="ws-popover-note">{status.message}</span>}
      </div>
      {user ? (
        <>
          <button role="menuitem" className="ws-menu-item" onClick={() => { close(); syncNow(); }}><RefreshCw size={16} aria-hidden="true" />Đồng bộ ngay</button>
          <button role="menuitem" className="ws-menu-item" onClick={() => { close(); openDraftImport(); }}><Upload size={16} aria-hidden="true" />Thêm tài liệu trên máy</button>
        </>
      ) : (
        <button role="menuitem" className="ws-menu-item" onClick={() => { close(); void login(); }}><Cloud size={16} aria-hidden="true" />Đăng nhập để đồng bộ</button>
      )}
    </Popover>
  );
}

export function AccountMenu() {
  const { user, pending, error, login, logout } = useAccount();
  const [open, setOpen] = useState(false);
  if (!user) {
    return (
      <button className="btn google-signin ws-signin" disabled={pending} onClick={() => void login()}>
        <img src="/google.svg" width="20" height="20" alt="" />Đăng nhập
      </button>
    );
  }
  const initial = (user.displayName || user.email || 'G').slice(0, 1).toUpperCase();
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button className="ws-account" aria-expanded={open} aria-haspopup="menu" aria-label={`Tài khoản ${user.email ?? ''}`} onClick={() => setOpen((value) => !value)}>
          <span className="ws-avatar" aria-hidden="true">{initial}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      }
    >
      <div className="ws-popover-head ws-account-head">
        <span className="ws-avatar ws-avatar-lg" aria-hidden="true">{initial}</span>
        <div>
          <strong>{user.displayName || 'Tài khoản Google'}</strong>
          <span>{user.email}</span>
        </div>
      </div>
      {error && <p className="ws-popover-error" role="alert">{error}</p>}
      <button role="menuitem" className="ws-menu-item" disabled={pending} onClick={() => { setOpen(false); void logout(); }}><LogOut size={16} aria-hidden="true" />Đăng xuất</button>
    </Popover>
  );
}

export function SettingsDialog({ onClose, onExportBackup, onImportBackup }: {
  onClose: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}) {
  const language = getLanguage();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sync-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sync-dialog ws-settings" role="dialog" aria-modal="true" aria-labelledby="ws-settings-title">
        <div className="ws-settings-head">
          <h2 id="ws-settings-title">Cài đặt</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>
        <div className="ws-settings-group">
          <h3>Ngôn ngữ giao diện</h3>
          <p>Chọn ngôn ngữ cho toàn bộ ứng dụng. Nội dung tài liệu của sếp giữ nguyên.</p>
          <div className="ws-settings-actions" data-no-translate>
            {LANGUAGE_OPTIONS.map(([code, label]) => (
              <button key={code} className={`btn${language === code ? ' btn-primary' : ''}`} aria-pressed={language === code} onClick={() => language !== code && setLanguage(code)}>
                <Languages size={16} />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="ws-settings-group">
          <h3>Sao lưu &amp; khôi phục</h3>
          <p>Tải về một tệp chứa toàn bộ tài liệu, hoặc mở lại từ bản sao lưu đã tải.</p>
          <div className="ws-settings-actions">
            <button className="btn" onClick={onExportBackup}><Download size={16} />Sao lưu toàn bộ</button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              <Upload size={16} />Khôi phục từ bản sao lưu
              <input type="file" accept=".json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) { onImportBackup(file); onClose(); }
                event.target.value = '';
              }} />
            </label>
          </div>
        </div>
        <div className="ws-settings-group">
          <h3>Ứng dụng máy tính</h3>
          <p>Dùng Minh Spark Office trên Windows và macOS, đồng bộ cùng tài khoản với bản web.</p>
          <div className="ws-settings-actions">
            <a className="btn" href="https://office.minhspark.com/tai-ung-dung.html" target="_blank" rel="noopener noreferrer"><Download size={16} />Tải ứng dụng</a>
            <DesktopFileSettings />
          </div>
        </div>
      </section>
    </div>
  );
}

type ThumbVariant = 'report' | 'minutes' | 'budget' | 'gantt' | 'blank-doc' | 'contract' | 'blank-sheet' | 'payroll' | 'cashbook' | 'pitch' | 'product-launch' | 'blank-slide';

const SHEET_HEADERS: Partial<Record<ThumbVariant, string[]>> = {
  budget: ['Hạng mục', 'Dự toán', 'Thực tế', 'Chênh lệch'],
  payroll: ['Nhân viên', 'Ngày công', 'Lương', 'Thực lĩnh'],
  cashbook: ['Ngày', 'Diễn giải', 'Thu', 'Chi'],
};

function Lines({ count, widths }: { count: number; widths?: number[] }) {
  return <div className="tt-lines">{Array.from({ length: count }, (_, index) => <i key={index} style={{ width: `${widths?.[index % widths.length] ?? 100}%` }} />)}</div>;
}

function SheetThumb({ headers, rows = 4 }: { headers: string[]; rows?: number }) {
  return (
    <div className="tt-sheet" style={{ gridTemplateColumns: `1.4fr repeat(${headers.length - 1}, 1fr)` }}>
      {headers.map((header) => <b key={header}>{header}</b>)}
      {Array.from({ length: rows * headers.length }, (_, index) => <i key={index} />)}
    </div>
  );
}

function GanttThumb() {
  const bars = [[0, 1], [1, 1.5], [2, 1.6], [3, 0.8]];
  return (
    <div className="tt-gantt">
      <div className="tt-gantt-row tt-gantt-head"><b>Công việc</b>{[1, 2, 3, 4].map((week) => <b key={week}>Tuần {week}</b>)}</div>
      {bars.map(([start, length], index) => (
        <div className="tt-gantt-row" key={index}>
          <i className="tt-gantt-label" />
          <span className="tt-gantt-track"><em style={{ left: `${start * 25}%`, width: `${length * 25}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

function ThumbBody({ variant }: { variant: ThumbVariant }) {
  const headers = SHEET_HEADERS[variant];
  if (headers) return <SheetThumb headers={headers} />;
  switch (variant) {
    case 'report':
      return <>
        <span className="tt-accent" />
        <Lines count={3} widths={[100, 92, 70]} />
        <div className="tt-split"><Lines count={4} widths={[100, 86, 94, 60]} /><div className="tt-bars">{[34, 52, 70, 88].map((height) => <i key={height} style={{ height: `${height}%` }} />)}</div></div>
      </>;
    case 'minutes':
      return <>
        <div className="tt-fields"><span>Thời gian</span><i /><span>Địa điểm</span><i /></div>
        <span className="tt-caption">Nội dung</span>
        <ul className="tt-bullets">{[82, 64, 72].map((width) => <li key={width}><i style={{ width: `${width}%` }} /></li>)}</ul>
      </>;
    case 'gantt':
      return <GanttThumb />;
    case 'contract':
      return <><span className="tt-center" /><Lines count={6} widths={[100, 96, 90, 100, 84, 58]} /></>;
    case 'blank-sheet':
      return <div className="tt-grid">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>;
    case 'pitch':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ height: '6px', width: '60%', background: '#D83B01', borderRadius: '3px' }} />
          <Lines count={2} widths={[80, 50]} />
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <span style={{ flex: 1, height: '24px', background: '#FDBA74', borderRadius: '3px' }} />
            <span style={{ flex: 1, height: '24px', background: '#FED7AA', borderRadius: '3px' }} />
          </div>
        </div>
      );
    case 'product-launch':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ height: '8px', width: '75%', background: '#EA580C', borderRadius: '4px' }} />
          <Lines count={3} widths={[90, 70, 45]} />
        </div>
      );
    case 'blank-slide':
      return <Lines count={2} widths={[60, 30]} />;
    default:
      return <Lines count={2} widths={[72, 40]} />;
  }
}

export function TemplateThumb({ variant, title }: { variant: ThumbVariant; title: string }) {
  const tone = SHEET_HEADERS[variant] || variant === 'gantt' || variant === 'blank-sheet' ? 'sheet' : (variant === 'pitch' || variant === 'product-launch' || variant === 'blank-slide' ? 'slide' : 'doc');
  return (
    <div className={`tt-page tt-${tone}`} aria-hidden="true">
      <strong className="tt-title">{title}</strong>
      <ThumbBody variant={variant} />
    </div>
  );
}

export type { ThumbVariant };
