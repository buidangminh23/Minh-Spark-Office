import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowUp, Check as CheckIcon, CircleHelp, Download, FileText, Image, Languages, LogOut, Plus, Presentation,
  RefreshCw, RotateCcw, Sheet, Trash2, Upload,
} from 'lucide-react';
import { useAccount } from '../Authentication';
import { DesktopFileSettings } from '../DesktopFileSettings';
import { openDraftImport, useWorkspaceSync } from '../WorkspaceStatus';
import { SYNC_DETAIL, SYNC_SHORT } from '../HomeParts';
import { getLanguage, setLanguage, type AppLanguage } from '../../lib/i18n/language';
import { isDesktop } from '../../lib/desktop';
import { DEFAULT_PAGE_KEY } from '../../lib/storage';
import { FONT_CATALOG } from '../../editors/doc/fonts';
import { AUTOCORRECT_KEY, loadAutoCorrect, type AutoCorrectEntry } from '../../editors/doc/extView';
import {
  resetSettings, setSettings, useSettings,
  type AppSettings, type DocTab, type HomeApp,
} from '../../lib/appSettings';
import { QAT_LABELS } from '../../lib/appSettingsMeta';
import { Check, Select, Toggle } from './controls';
import { AUTO_UPDATE_KEY, HELP_URL, SettingsActionsContext, UPDATE_EVENTS } from './settingsShared';
import { updateNeedsAttention, updaterLabel, useUpdaterStatus } from '../../lib/updaterStatus';

const YEAR = new Date().getFullYear();

declare const __APP_VERSION__: string;


function useActions() {
  const actions = useContext(SettingsActionsContext);
  if (!actions) throw new Error('Settings actions are unavailable');
  return actions;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="st-row">
      <span className="st-row-text"><span className="st-row-label">{label}</span>{hint && <span className="st-row-hint">{hint}</span>}</span>
      <span className="st-row-control">{children}</span>
    </div>
  );
}

const HOME_APPS: Array<[HomeApp, string, string, ReactNode]> = [
  ['doc', '23 Docs', 'Soạn thảo văn bản', <FileText key="doc" size={20} />],
  ['sheet', '23 Sheets', 'Bảng tính', <Sheet key="sheet" size={20} />],
  ['slide', '23 Slides', 'Trình chiếu', <Presentation key="slide" size={20} />],
  ['pdf', '23 PDF', 'Chỉnh sửa & chuyển đổi', <FileText key="pdf" size={20} />],
  ['image', '23 Photos', 'Xem và sửa ảnh', <Image key="image" size={20} />],
];

export function AppsPicker() {
  const { homeApps } = useSettings();
  const shown = Object.values(homeApps).filter(Boolean).length;
  return (
    <div className="st-apps">
      {HOME_APPS.map(([id, name, desc, icon]) => (
        <label key={id} className={`st-app st-app-${id}${homeApps[id] ? ' is-on' : ''}`}>
          <input type="checkbox" checked={homeApps[id]} disabled={homeApps[id] && shown === 1} onChange={(event) => setSettings({ homeApps: { ...homeApps, [id]: event.target.checked } })} />
          <span className="st-app-icon" aria-hidden="true">{icon}</span>
          <span className="st-app-text"><strong>{name}</strong><span>{desc}</span></span>
        </label>
      ))}
    </div>
  );
}

const LANGUAGES: Array<[AppLanguage, string]> = [['vi', 'Tiếng Việt'], ['en', 'English']];

export function LanguagePanel() {
  const language = getLanguage();
  return (
    <div className="st-buttons" data-no-translate>
      {LANGUAGES.map(([code, label]) => (
        <button key={code} type="button" className={`st-btn${language === code ? ' is-primary' : ''}`} aria-pressed={language === code} onClick={() => language !== code && setLanguage(code)}>
          {language === code ? <CheckIcon size={16} /> : <Languages size={16} />}{label}
        </button>
      ))}
    </div>
  );
}

export function BackupPanel() {
  const { onExportBackup, onImportBackup, onClose } = useActions();
  return (
    <>
      <Row label="Tự động lưu" hint="Luôn bật. Mỗi thay đổi được ghi vào máy sau chưa tới 1 giây, kể cả khi mất mạng.">
        <span className="st-badge">Luôn bật</span>
      </Row>
      <Row label="Sao lưu toàn bộ tài liệu" hint="Tải về một tệp .json chứa mọi tài liệu trên máy này.">
        <button type="button" className="st-btn" onClick={onExportBackup}><Download size={16} />Sao lưu</button>
      </Row>
      <Row label="Khôi phục từ bản sao lưu" hint="Mở lại tài liệu từ tệp sao lưu đã tải.">
        <label className="st-btn">
          <Upload size={16} />Khôi phục
          <input type="file" accept=".json" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) { onImportBackup(file); onClose(); }
            event.target.value = '';
          }} />
        </label>
      </Row>
    </>
  );
}

type PageDefaults = { fontFamily?: string; fontSize?: number };

function readPageDefaults(): PageDefaults {
  try { return JSON.parse(localStorage.getItem(DEFAULT_PAGE_KEY) ?? '{}') as PageDefaults; } catch { return {}; }
}

const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24].map((size) => [size, String(size)] as const);
const FONT_NAMES = [...new Set(FONT_CATALOG.filter((font) => !font.google).map((font) => font.name))].sort((a, b) => a.localeCompare(b)).map((name) => [name, name] as const);

export function FontPicker() {
  const [page, setPage] = useState(readPageDefaults);
  const save = (patch: PageDefaults) => {
    const next = { ...readPageDefaults(), ...patch };
    try { localStorage.setItem(DEFAULT_PAGE_KEY, JSON.stringify(next)); } catch { return; }
    setPage(next);
  };
  return (
    <>
      <Row label="Phông chữ mặc định (23 Docs)">
        <Select label="Phông chữ mặc định" wide value={page.fontFamily ?? 'Arial'} options={FONT_NAMES} onChange={(fontFamily) => save({ fontFamily })} />
      </Row>
      <Row label="Cỡ chữ mặc định">
        <Select label="Cỡ chữ mặc định" value={page.fontSize ?? 12} options={FONT_SIZES} onChange={(fontSize) => save({ fontSize })} />
      </Row>
    </>
  );
}

export function AutoCorrectList() {
  const [entries, setEntries] = useState<AutoCorrectEntry[]>(loadAutoCorrect);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const persist = (next: AutoCorrectEntry[]) => {
    try { localStorage.setItem(AUTOCORRECT_KEY, JSON.stringify(next)); } catch { return; }
    setEntries(next);
  };
  const add = () => {
    const key = from.trim();
    if (!key || !to) return;
    persist([...entries.filter((entry) => entry.from !== key), { from: key, to }]);
    setFrom(''); setTo('');
  };
  return (
    <div className="st-ac">
      <div className="st-ac-add">
        <input className="st-text" aria-label="Gõ" placeholder="Gõ, VD: ko" value={from} onChange={(event) => setFrom(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} />
        <input className="st-text" aria-label="Thay bằng" placeholder="Thay bằng, VD: không" value={to} onChange={(event) => setTo(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} />
        <button type="button" className="st-btn" disabled={!from.trim() || !to} onClick={add}><Plus size={16} />Thêm</button>
      </div>
      {entries.length ? (
        <ul className="st-ac-list">
          {entries.map((entry) => (
            <li key={entry.from}>
              <code>{entry.from}</code><span aria-hidden="true">→</span><span>{entry.to}</span>
              <button type="button" className="st-icon-btn" aria-label={`Xoá ${entry.from}`} onClick={() => persist(entries.filter((item) => item.from !== entry.from))}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="st-empty">Chưa có mục thay thế nào. Thêm cặp “gõ → thay bằng” ở trên.</p>}
    </div>
  );
}

type RecordKey = { [K in keyof AppSettings]: AppSettings[K] extends Record<string, boolean> ? K : never }[keyof AppSettings];
type ListKey = { [K in keyof AppSettings]: AppSettings[K] extends string[] ? K : never }[keyof AppSettings];

export function TabsPicker({ settingKey, tabs, locked, resetKeys }: { settingKey: RecordKey; tabs: ReadonlyArray<readonly [string, string]>; locked?: string; resetKeys?: (keyof AppSettings)[] }) {
  const settings = useSettings();
  const value = settings[settingKey] as Record<string, boolean>;
  return (
    <div className="st-grid-checks">
      {tabs.map(([id, label]) => (
        <Check key={id} checked={value[id] !== false} disabled={id === locked} onChange={(checked) => setSettings({ [settingKey]: { ...value, [id]: checked } } as Partial<AppSettings>)}>{label}</Check>
      ))}
      <button type="button" className="st-link" onClick={() => resetSettings(resetKeys ?? [settingKey])}><RotateCcw size={14} />Hiện lại tất cả</button>
    </div>
  );
}

export function CommandListEditor({ settingKey, labels, resetKeys }: { settingKey: ListKey; labels: Record<string, string>; resetKeys?: (keyof AppSettings)[] }) {
  const settings = useSettings();
  const commands = (settings[settingKey] as string[]).filter((command) => command in labels);
  const save = (next: string[]) => setSettings({ [settingKey]: next } as Partial<AppSettings>);
  const available = Object.keys(labels).filter((command) => !commands.includes(command));
  const move = (index: number, delta: number) => {
    const next = [...commands];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next);
  };
  return (
    <div className="st-qat">
      <div>
        <p className="st-qat-title">Lệnh có thể thêm</p>
        <ul className="st-qat-list">
          {available.map((command) => (
            <li key={command}>
              <span>{labels[command]}</span>
              <button type="button" className="st-icon-btn" aria-label={`Thêm ${labels[command]}`} onClick={() => save([...commands, command])}><Plus size={15} /></button>
            </li>
          ))}
          {!available.length && <li className="st-empty">Đã thêm tất cả lệnh.</li>}
        </ul>
      </div>
      <div>
        <p className="st-qat-title">Trên thanh truy cập nhanh</p>
        <ul className="st-qat-list">
          {commands.map((command, index) => (
            <li key={command}>
              <span>{labels[command]}</span>
              <span className="st-qat-actions">
                <button type="button" className="st-icon-btn" aria-label={`Đưa ${labels[command]} lên`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                <button type="button" className="st-icon-btn" aria-label={`Đưa ${labels[command]} xuống`} disabled={index === commands.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="st-icon-btn" aria-label={`Bỏ ${labels[command]}`} onClick={() => save(commands.filter((item) => item !== command))}><Trash2 size={15} /></button>
              </span>
            </li>
          ))}
          {!commands.length && <li className="st-empty">Chưa có lệnh nào.</li>}
        </ul>
        <button type="button" className="st-link" onClick={() => resetSettings(resetKeys ?? [settingKey])}><RotateCcw size={14} />Đặt lại thanh truy cập nhanh</button>
      </div>
    </div>
  );
}

const DOC_TABS: ReadonlyArray<readonly [DocTab, string]> = [
  ['home', 'Trang chủ'], ['insert', 'Chèn'], ['draw', 'Vẽ'], ['design', 'Thiết kế'], ['layout', 'Bố cục'],
  ['references', 'Tham chiếu'], ['mailings', 'Gửi thư'], ['review', 'Xem lại'], ['view', 'Xem'], ['help', 'Trợ giúp'],
];

export function DocTabsPicker() {
  return <TabsPicker settingKey="docTabs" tabs={DOC_TABS} locked="home" />;
}

export function QatEditor() {
  return <CommandListEditor settingKey="qatCommands" labels={QAT_LABELS} resetKeys={['qatCommands', 'qatPosition', 'qatShow']} />;
}

export function AccountPanel() {
  const { user, pending, error, login, logout } = useAccount();
  const { status, syncNow } = useWorkspaceSync();
  if (!user) {
    return (
      <div className="st-account">
        <p className="st-row-hint">Chưa đăng nhập. Tài liệu đang lưu trên máy này. Đăng nhập Google để đồng bộ với bản web và ứng dụng máy tính.</p>
        <button type="button" className="st-btn is-primary" disabled={pending} onClick={() => void login()}><img src="/google.svg" width="18" height="18" alt="" />Đăng nhập bằng Google</button>
      </div>
    );
  }
  return (
    <div className="st-account">
      <div className="st-account-head">
        <span className="st-avatar" aria-hidden="true">{(user.displayName || user.email || 'G').slice(0, 1).toUpperCase()}</span>
        <span className="st-row-text"><span className="st-row-label">{user.email}</span><span className="st-row-hint">{user.displayName || 'Đã đăng nhập'}</span></span>
        <button type="button" className="st-btn" disabled={pending} onClick={() => void logout()}><LogOut size={16} />Đăng xuất</button>
      </div>
      <Row label={`Đồng bộ: ${SYNC_SHORT[status.state]}`} hint={status.message || SYNC_DETAIL[status.state]}>
        <button type="button" className="st-btn" onClick={syncNow}><RefreshCw size={16} />Đồng bộ ngay</button>
      </Row>
      <Row label="Thêm tài liệu trên máy vào tài khoản" hint="Đưa các bản nháp tạo lúc chưa đăng nhập lên tài khoản.">
        <button type="button" className="st-btn" onClick={openDraftImport}><Upload size={16} />Chọn tài liệu</button>
      </Row>
      {error && <p className="st-error" role="alert">{error}</p>}
    </div>
  );
}

export function DefaultAppsPanel() {
  return (
    <div className="st-buttons">
      {isDesktop()
        ? <DesktopFileSettings />
        : <a className="st-btn" href="https://office.minhspark.com/tai-ung-dung.html" target="_blank" rel="noopener noreferrer"><Download size={16} />Tải ứng dụng cho Windows và macOS</a>}
    </div>
  );
}

export function ResetPanel() {
  const [asked, setAsked] = useState(false);
  return asked ? (
    <div className="st-buttons">
      <span className="st-row-hint">Đặt lại mọi cài đặt? Tài liệu không bị ảnh hưởng.</span>
      <button type="button" className="st-btn" onClick={() => setAsked(false)}>Huỷ</button>
      <button type="button" className="st-btn is-danger" onClick={() => { resetSettings(); setAsked(false); }}><RotateCcw size={16} />Đặt lại</button>
    </div>
  ) : (
    <button type="button" className="st-btn" onClick={() => setAsked(true)}><RotateCcw size={16} />Đặt lại cài đặt về mặc định</button>
  );
}

function useAppVersion() {
  const [version, setVersion] = useState(() => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''));
  useEffect(() => {
    if (!isDesktop()) return;
    void import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setVersion).catch(() => undefined);
  }, []);
  return version;
}

export function AboutPanel() {
  const version = useAppVersion();
  return (
    <div className="st-about">
      <img src="/logo-icon.png" alt="" width="44" height="44" />
      <span className="st-row-text">
        <span className="st-row-label">Office 23 {version && `· Phiên bản ${version}`}</span>
        <span className="st-row-hint">{isDesktop() ? 'Ứng dụng máy tính' : 'Bản web'} · © {YEAR} Minh Spark</span>
      </span>
    </div>
  );
}


export function HelpPanel() {
  return (
    <div className="st-buttons">
      <a className="st-btn" href={HELP_URL} target="_blank" rel="noopener noreferrer"><CircleHelp size={16} />Mở trang hướng dẫn</a>
    </div>
  );
}

export function UpdatePanel() {
  const status = useUpdaterStatus();
  const [automatic, setAutomatic] = useState(() => localStorage.getItem(AUTO_UPDATE_KEY) !== 'false');
  if (!isDesktop()) {
    return (
      <>
        <Row label="Bản web luôn là phiên bản mới nhất" hint="Mỗi lần tải lại trang là dùng bản mới. Ứng dụng máy tính tự cập nhật theo bản web.">
          <span className="st-badge">Mới nhất</span>
        </Row>
        <div className="st-buttons">
          <a className="st-btn" href="https://office.minhspark.com/tai-ung-dung.html" target="_blank" rel="noopener noreferrer"><Download size={16} />Tải ứng dụng máy tính</a>
        </div>
      </>
    );
  }
  const busy = status.phase === 'checking' || status.phase === 'installing';
  const action = status.phase === 'downloaded' ? 'Cài bản mới' : status.phase === 'available' ? 'Tải bản mới' : status.phase === 'downloading' ? 'Xem tiến trình' : 'Kiểm tra ngay';
  return (
    <>
      <Row label={updaterLabel(status)} hint={status.version ? `Đang dùng phiên bản ${status.version}` : undefined}>
        <button type="button" className={`st-btn${updateNeedsAttention(status.phase) ? ' is-primary' : ''}`} disabled={busy} onClick={() => window.dispatchEvent(new Event(UPDATE_EVENTS.check))}>
          <RefreshCw size={16} className={busy ? 'st-spin' : undefined} />{action}
        </button>
      </Row>
      <Row label="Tự động cập nhật" hint="Tải và cài bản mới để app luôn giống bản web.">
        <Toggle label="Tự động cập nhật" checked={automatic} onChange={(value) => {
          setAutomatic(value);
          localStorage.setItem(AUTO_UPDATE_KEY, String(value));
          window.dispatchEvent(new CustomEvent(UPDATE_EVENTS.auto, { detail: value }));
        }} />
      </Row>
    </>
  );
}

