import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Edit2,
  Ellipsis,
  File,
  Files,
  Folder,
  Funnel,
  HardDrive,
  House,
  LayoutGrid,
  List as ListIcon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useAccount } from './Authentication';
import { SuiteLogo } from './SuiteLogo';
import { DownloadMenu } from './DownloadMenu';
import { ConversionDialog } from './ConversionDialog';
import { ConversionMenu } from './ConversionPicker';
import { ConvertLogo } from './ConvertLogo';
import type { ConversionPreset } from '../lib/conversionPresets';
import { AccountMenu, Popover, SyncButton, TemplateThumb, type ThumbVariant } from './HomeParts';
import { SettingsDialog } from './settings/SettingsDialog';
import { useSettings } from '../lib/appSettings';
import { updateNeedsAttention, useUpdaterStatus } from '../lib/updaterStatus';
import './home.css';

import type { FileContent, FileKind, FileMeta } from '../lib/storage';
import { INVITE_PARAM, parseInviteToken } from '../lib/teams';
import type { SharedOpen } from './teams/TeamsPage';
import type { WorkbookData } from '../lib/sheetTypes';
import type { PresentationData } from '../lib/slideTypes';
import { businessPitchPresentation, productLaunchPresentation, blankPresentation } from '../lib/slideTemplates';
import { relativeTime } from '../lib/download';
import { IMAGE_ACCEPT_STRING } from '../lib/imageFormatNames';
import { editorIntentHandlers } from '../lib/editorModules';
import {
  sampleDocHtml,
  contractDocHtml,
  meetingMinutesDocHtml,
  sampleWorkbook,
  payrollWorkbook,
  cashbookWorkbook,
  projectEstimateWorkbook,
} from '../lib/templates';

interface HomeProps {
  files: FileMeta[];
  storageInfo: { usage: number; quota: number } | null;
  onOpenDoc: (file: FileMeta) => void;
  onOpenSheet: (file: FileMeta) => void;
  onOpenPdf: (file: FileMeta) => void;
  onOpenSlide: (file: FileMeta) => void;
  onOpenImage: (file: FileMeta) => void;
  onCreateDoc: (templateHtml?: string) => void;
  onCreateSheet: (templateWorkbook?: WorkbookData) => void;
  onCreatePdf: () => void;
  onCreateSlide: (template?: PresentationData) => void;
  onImportFile: (file: File) => void;
  onRename: (file: FileMeta) => void;
  onDuplicate: (file: FileMeta) => void;
  onToggleStar: (file: FileMeta) => void;
  onTrash: (file: FileMeta) => void;
  onRestore: (file: FileMeta) => void;
  onDeletePermanent: (file: FileMeta) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onCreateFromContent: (name: string, content: FileContent) => void;
  onOpenShared: SharedOpen;
}

type View = 'home' | 'all' | 'starred' | FileKind | 'trash' | 'team';
type KindTab = 'all' | FileKind;
type SortOrder = 'recent' | 'oldest' | 'name';

const TeamsPage = lazy(() => import('./teams/TeamsPage').then((module) => ({ default: module.TeamsPage })));
const FilePartsDialog = lazy(() => import('./FilePartsDialog').then((module) => ({ default: module.FilePartsDialog })));
const FEATURED_TEMPLATES = 4;
const IMPORT_ACCEPT = '.docx,.txt,.md,.html,.htm,.xlsx,.xlsm,.xls,.csv,.tsv,.pdf,.pptx,.ppt,.png,.jpg,.jpeg,.jfif,.jpe,.webp,.gif,.svg,.svgz,.bmp,.dib,.ico,.avif,.tiff,.tif,.heic,.heif';

const KIND_LABEL: Record<FileKind, string> = { doc: 'Docs', sheet: 'Sheets', pdf: 'PDF', slide: 'Slides', image: 'Photos' };
const PRODUCT_NAME: Record<FileKind, string> = { doc: 'Minh Docs', sheet: 'Minh Sheets', pdf: 'Minh PDF', slide: 'Minh Slides', image: 'Minh Photos' };
const VIEW_TITLE: Record<Exclude<View, 'home'>, string> = {
  all: 'Tất cả tệp',
  starred: 'Được gắn sao',
  doc: 'Minh Docs',
  sheet: 'Minh Sheets',
  pdf: 'Minh PDF',
  slide: 'Minh Slides',
  image: 'Minh Photos',
  trash: 'Thùng rác',
  team: 'Nhóm',
};
const SORT_LABEL: Record<SortOrder, string> = { recent: 'Mới cập nhật', oldest: 'Cũ nhất', name: 'Tên A → Z' };

type Template = { id: string; title: string; kind: FileKind; thumb: ThumbVariant; create: (props: HomeProps) => void };

const TEMPLATES: Template[] = [
  { id: 'report', title: 'Báo cáo hoạt động quý', kind: 'doc', thumb: 'report', create: (p) => p.onCreateDoc(sampleDocHtml()) },
  { id: 'minutes', title: 'Biên bản cuộc họp', kind: 'doc', thumb: 'minutes', create: (p) => p.onCreateDoc(meetingMinutesDocHtml()) },
  { id: 'budget', title: 'Ngân sách quý IV', kind: 'sheet', thumb: 'budget', create: (p) => p.onCreateSheet(sampleWorkbook('Báo cáo ngân sách')) },
  { id: 'project', title: 'Kế hoạch dự án', kind: 'sheet', thumb: 'gantt', create: (p) => p.onCreateSheet(projectEstimateWorkbook()) },
  { id: 'blank-doc', title: 'Văn bản trống', kind: 'doc', thumb: 'blank-doc', create: (p) => p.onCreateDoc() },
  { id: 'contract', title: 'Hợp đồng kinh tế', kind: 'doc', thumb: 'contract', create: (p) => p.onCreateDoc(contractDocHtml()) },
  { id: 'blank-sheet', title: 'Bảng tính trống', kind: 'sheet', thumb: 'blank-sheet', create: (p) => p.onCreateSheet() },
  { id: 'payroll', title: 'Bảng lương & chấm công', kind: 'sheet', thumb: 'payroll', create: (p) => p.onCreateSheet(payrollWorkbook()) },
  { id: 'cashbook', title: 'Sổ quỹ thu chi', kind: 'sheet', thumb: 'cashbook', create: (p) => p.onCreateSheet(cashbookWorkbook()) },
  { id: 'pitch', title: 'Chiến lược kinh doanh 2026', kind: 'slide', thumb: 'pitch', create: (p) => p.onCreateSlide(businessPitchPresentation()) },
  { id: 'product-launch', title: 'Ra mắt sản phẩm mới', kind: 'slide', thumb: 'product-launch', create: (p) => p.onCreateSlide(productLaunchPresentation()) },
  { id: 'blank-slide', title: 'Bài thuyết trình trống', kind: 'slide', thumb: 'blank-slide', create: (p) => p.onCreateSlide(blankPresentation()) },
];

function sortFiles(files: FileMeta[], order: SortOrder) {
  const sorted = [...files];
  if (order === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  else if (order === 'oldest') sorted.sort((a, b) => a.updatedAt - b.updatedAt);
  else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted;
}

function matchesView(file: FileMeta, view: View) {
  if (view === 'trash') return Boolean(file.deletedAt);
  if (file.deletedAt) return false;
  if (view === 'starred') return file.starred;
  if (view === 'doc' || view === 'sheet' || view === 'pdf' || view === 'slide') return file.kind === view;
  return true;
}

function matchesQuery(file: FileMeta, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return file.name.toLowerCase().includes(q) || Boolean(file.preview?.toLowerCase().includes(q));
}

export default function Home(props: HomeProps) {
  const { files, onCreateDoc, onCreateSheet, onCreatePdf, onImportFile, onExportBackup, onImportBackup } = props;
  const { user } = useAccount();
  const appSettings = useSettings();
  const updater = useUpdaterStatus();
  const RECENT_LIMIT = appSettings.recentCount;
  const [inviteToken, setInviteToken] = useState(() => (typeof window === 'undefined' ? null : parseInviteToken(new URLSearchParams(window.location.search).get(INVITE_PARAM))));
  const [view, setView] = useState<View>(() => (inviteToken ? 'team' : 'home'));
  const [kindTab, setKindTab] = useState<KindTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [starredOnly, setStarredOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filePartsOpen, setFilePartsOpen] = useState(false);
  const [conversion, setConversion] = useState<null | 'all' | ConversionPreset>(null);
  const [conversionAnchor, setConversionAnchor] = useState<HTMLElement | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const query = searchQuery.trim();
  const isSearching = query.length > 0;
  const kindFixed = view === 'doc' || view === 'sheet' || view === 'pdf' || view === 'slide';

  const listedFiles = useMemo(() => {
    const base = files.filter((file) => (isSearching ? !file.deletedAt : matchesView(file, view)) && matchesQuery(file, query));
    const byKind = kindFixed || kindTab === 'all' ? base : base.filter((file) => file.kind === kindTab);
    const starred = starredOnly ? byKind.filter((file) => file.starred) : byKind;
    return sortFiles(starred, sortOrder);
  }, [files, view, kindTab, starredOnly, sortOrder, query, isSearching, kindFixed]);

  const trashCount = useMemo(() => files.filter((file) => file.deletedAt).length, [files]);

  useEffect(() => {
    shell.current?.scrollIntoView({ block: 'start' });
  }, [view]);

  const goTo = (next: View) => {
    setView(next);
    setKindTab('all');
    setSearchQuery('');
  };

  const openFile = (file: FileMeta) => {
    if (file.kind === 'doc') props.onOpenDoc(file);
    else if (file.kind === 'sheet') props.onOpenSheet(file);
    else if (file.kind === 'pdf') props.onOpenPdf(file);
    else if (file.kind === 'slide') props.onOpenSlide(file);
    else if (file.kind === 'image') props.onOpenImage(file);
  };

  const create = (kind: FileKind) => {
    setCreateOpen(false);
    if (kind === 'doc') onCreateDoc();
    else if (kind === 'sheet') onCreateSheet();
    else if (kind === 'pdf') onCreatePdf();
    else if (kind === 'slide') props.onCreateSlide();
  };

  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportFile(file);
    event.target.value = '';
  };

  const showDashboard = view === 'home' && !isSearching;
  const showTeams = view === 'team' && !isSearching;
  const finishInvite = useCallback(() => {
    setInviteToken(null);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(INVITE_PARAM)) return;
    url.searchParams.delete(INVITE_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);
  const location = (file: FileMeta) => (file.deletedAt ? 'Thùng rác' : user ? 'Kho tài liệu' : 'Trên máy này');
  const fileList = (items: FileMeta[]) => viewMode === 'list'
    ? <FileTable files={items} location={location} props={props} onOpen={openFile} />
    : <FileGrid files={items} location={location} props={props} onOpen={openFile} />;

  const tabs = !kindFixed && (
    <div className="ws-tabs" role="tablist" aria-label="Lọc theo loại tài liệu">
      {(['all', 'doc', 'sheet', 'slide', 'pdf'] as KindTab[]).map((tab) => (
        <button key={tab} role="tab" aria-selected={kindTab === tab} className={kindTab === tab ? 'is-active' : ''} onClick={() => setKindTab(tab)}>
          {tab === 'all' ? 'Tất cả' : KIND_LABEL[tab]}
        </button>
      ))}
    </div>
  );

  const toolbar = (
    <div className="ws-toolbar">
      <FilterMenu sortOrder={sortOrder} onSort={setSortOrder} starredOnly={starredOnly} onStarredOnly={setStarredOnly} />
      <div className="ws-view-toggle" role="group" aria-label="Kiểu hiển thị">
        <button className={viewMode === 'list' ? 'is-active' : ''} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} title="Dạng danh sách"><ListIcon size={18} /></button>
        <button className={viewMode === 'grid' ? 'is-active' : ''} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} title="Dạng lưới"><LayoutGrid size={18} /></button>
      </div>
    </div>
  );

  const emptyState = (
    <div className="ws-empty">
      <HardDrive size={32} aria-hidden="true" />
      <h3>Không có tài liệu nào</h3>
      <p>
        {isSearching ? `Không có kết quả khớp với “${query}”.` : view === 'trash' ? 'Thùng rác đang trống.' : 'Bấm Tạo mới hoặc mở tệp từ máy để bắt đầu.'}
      </p>
    </div>
  );

  return (
    <div
      ref={shell}
      className="ws-shell"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onImportFile(file);
      }}
    >
      {isDragging && (
        <div className="ws-drop">
          <div className="ws-drop-card">
            <Upload size={48} aria-hidden="true" />
            <h2>Thả tệp vào đây để mở ngay</h2>
            <p>Hỗ trợ <strong>.docx</strong>, <strong>.xlsx</strong>, <strong>.pptx</strong>, <strong>.pdf</strong> và <strong>các định dạng ảnh</strong> (PNG, JPG, WebP, GIF, SVG, BMP, ICO, AVIF, TIFF...)</p>
          </div>
        </div>
      )}

      <aside className="ws-sidebar">
        <button className="ws-brand" onClick={() => goTo('home')} title="Minh Spark Office — Về trang chủ">
          <img src="/logo-icon.png" alt="" />
          <span>Minh Spark<br />Office</span>
        </button>

        <Popover
          open={createOpen}
          onClose={closeCreate}
          align="start"
          className="ws-create"
          trigger={
            <button className="ws-create-btn" aria-expanded={createOpen} aria-haspopup="menu" onClick={() => setCreateOpen((value) => !value)}>
              <Plus size={20} aria-hidden="true" />Tạo mới
            </button>
          }
        >
          {(['doc', 'sheet', 'slide', 'pdf', 'image'] as FileKind[]).map((kind) => (
            <button key={kind} role="menuitem" className="ws-menu-item" onClick={() => create(kind)}>
              <SuiteLogo kind={kind} size={24} />{PRODUCT_NAME[kind]}
            </button>
          ))}
        </Popover>

        <nav className="ws-nav" aria-label="Điều hướng">
          <NavItem active={view === 'home' && !isSearching} onClick={() => goTo('home')} icon={<House size={20} />}>Trang chủ</NavItem>
          <NavItem active={view === 'all' && !isSearching} onClick={() => goTo('all')} icon={<File size={20} />}>Tất cả tệp</NavItem>
          <NavItem active={view === 'starred' && !isSearching} onClick={() => goTo('starred')} icon={<Star size={20} />}>Được gắn sao</NavItem>
          <hr />
          {(['doc', 'sheet', 'slide', 'pdf'] as FileKind[]).map((kind) => (
            <NavItem key={kind} active={view === kind && !isSearching} onClick={() => goTo(kind)} icon={<SuiteLogo kind={kind} size={26} />}>{PRODUCT_NAME[kind]}</NavItem>
          ))}
          <NavItem active={conversion !== null || conversionAnchor !== null} menuOpen={conversionAnchor !== null} onClick={(event) => { const anchor = event.currentTarget; setConversionAnchor((current) => current ? null : anchor); }} icon={<ConvertLogo size={26} />}>Chuyển định dạng</NavItem>
          <button className="ws-nav-item" aria-haspopup="dialog" onClick={() => setFilePartsOpen(true)}><span className="ws-nav-icon" aria-hidden="true"><Files size={22} /></span><span className="ws-nav-label">Gộp và tách tệp</span></button>
          <NavItem active={view === 'team' && !isSearching} onClick={() => goTo('team')} icon={<Users size={22} />}>Nhóm</NavItem>
          <hr />
          <NavItem active={view === 'trash' && !isSearching} onClick={() => goTo('trash')} icon={<Trash2 size={20} />} badge={trashCount || undefined}>Thùng rác</NavItem>
          <NavItem active={settingsOpen} onClick={() => setSettingsOpen(true)} icon={<Settings size={20} />} dot={updateNeedsAttention(updater.phase) ? `Có phiên bản ${updater.nextVersion}` : undefined}>Cài đặt</NavItem>
        </nav>
      </aside>

      <main className="ws-main">
        <header className="ws-topbar">
          <label className="ws-search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={searchInput}
              type="search"
              placeholder="Tìm kiếm tài liệu..."
              aria-label="Tìm kiếm tài liệu"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
            />
            <kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
          </label>
          <div className="ws-top-actions">
            <SyncButton />
            <span className="ws-divider" aria-hidden="true" />
            <DownloadMenu />
            <span className="ws-divider" aria-hidden="true" />
            <AccountMenu />
          </div>
        </header>

        <div className="ws-content">
          {showTeams ? (
            <Suspense fallback={<p className="tm-muted" role="status">Đang tải nhóm…</p>}>
              <TeamsPage files={files} inviteToken={inviteToken} onInviteDone={finishInvite} onCreateFromContent={props.onCreateFromContent} onOpenShared={props.onOpenShared} />
            </Suspense>
          ) : showDashboard ? (
            <>
              <div className="ws-heading">
                <div>
                  <h1>Không gian làm việc</h1>
                  <p>Mọi tài liệu, trong một nơi.</p>
                </div>
                <label className="ws-open-btn">
                  <Upload size={20} aria-hidden="true" />Mở tệp từ máy
                  <input type="file" accept={IMPORT_ACCEPT} hidden onChange={handleImport} />
                </label>
              </div>

              <div className="ws-apps">
                {appSettings.homeApps.doc && <AppCard kind="doc" title="Minh Docs" desc="Soạn thảo văn bản" action="plus" onClick={() => onCreateDoc()} />}
                {appSettings.homeApps.sheet && <AppCard kind="sheet" title="Minh Sheets" desc="Tạo bảng tính" action="plus" onClick={() => onCreateSheet()} />}
                {appSettings.homeApps.slide && <AppCard kind="slide" title="Minh Slides" desc="Soạn bài thuyết trình" action="plus" onClick={() => props.onCreateSlide()} />}
                {appSettings.homeApps.pdf && <AppCard kind="pdf" title="Minh PDF" desc="Chỉnh sửa & chuyển đổi" action="arrow" onClick={onCreatePdf} />}
                {appSettings.homeApps.image && <AppCard kind="image" title="Minh Photos" desc="Xem và sửa ảnh đa định dạng" action="arrow" onClick={() => imageInput.current?.click()} />}
                <input ref={imageInput} type="file" accept={IMAGE_ACCEPT_STRING} hidden onChange={handleImport} data-testid="photos-input" />
              </div>

              <div className="ws-dash-cols">
                <section className="ws-section" aria-labelledby="ws-recent-title">
                  <div className="ws-section-head">
                    <h2 id="ws-recent-title">Tài liệu gần đây</h2>
                    {tabs}
                    {toolbar}
                  </div>
                  {listedFiles.length ? fileList(listedFiles.slice(0, RECENT_LIMIT)) : emptyState}
                  {listedFiles.length > RECENT_LIMIT && (
                    <button className="ws-more" onClick={() => goTo('all')}>Xem tất cả {listedFiles.length} tài liệu <ArrowRight size={16} aria-hidden="true" /></button>
                  )}
                </section>

                <section className="ws-section" aria-labelledby="ws-templates-title">
                  <div className="ws-section-head">
                    <h2 id="ws-templates-title">Bắt đầu từ mẫu</h2>
                    <button className="ws-link" aria-expanded={showAllTemplates} onClick={() => setShowAllTemplates((value) => !value)}>
                      {showAllTemplates ? 'Thu gọn' : 'Xem tất cả'} <ArrowRight size={18} aria-hidden="true" className={showAllTemplates ? 'ws-rotate' : ''} />
                    </button>
                  </div>
                  <div className="ws-templates">
                    {(showAllTemplates ? TEMPLATES : TEMPLATES.slice(0, FEATURED_TEMPLATES)).map((template) => (
                      <button key={template.id} className="ws-template" onClick={() => template.create(props)}>
                        <TemplateThumb variant={template.thumb} title={template.title} />
                        <span className="ws-template-meta">
                          <SuiteLogo kind={template.kind} size={32} />
                          <span><strong>{template.title}</strong><small>{KIND_LABEL[template.kind]}</small></span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <section className="ws-section ws-section-first" aria-labelledby="ws-list-title">
              <div className="ws-heading ws-heading-list">
                <div>
                  <h1 id="ws-list-title">{isSearching ? 'Kết quả tìm kiếm' : VIEW_TITLE[view as Exclude<View, 'home'>]}</h1>
                  <p>{isSearching ? `${listedFiles.length} tài liệu khớp với “${query}”` : view === 'trash' ? 'Tài liệu trong thùng rác có thể khôi phục hoặc xoá vĩnh viễn.' : `${listedFiles.length} tài liệu`}</p>
                </div>
                <label className="ws-open-btn">
                  <Upload size={20} aria-hidden="true" />Mở tệp từ máy
                  <input type="file" accept={IMPORT_ACCEPT} hidden onChange={handleImport} />
                </label>
              </div>
              <div className="ws-section-head">
                {tabs}
                {toolbar}
              </div>
              {listedFiles.length ? fileList(listedFiles) : emptyState}
            </section>
          )}
        </div>
      </main>

      {settingsOpen && <SettingsDialog onClose={closeSettings} onExportBackup={onExportBackup} onImportBackup={onImportBackup} />}
      {filePartsOpen && <Suspense fallback={null}><FilePartsDialog onClose={() => setFilePartsOpen(false)} /></Suspense>}
      {conversionAnchor && <ConversionMenu anchor={conversionAnchor} onPick={(preset) => { setConversionAnchor(null); setConversion(preset); }} onAll={() => { setConversionAnchor(null); setConversion('all'); }} onClose={() => setConversionAnchor(null)} />}
      {conversion !== null && <ConversionDialog key={conversion === 'all' ? 'all' : conversion.id} preset={conversion === 'all' ? undefined : conversion} onClose={() => setConversion(null)} />}
    </div>
  );
}

function NavItem({ active, onClick, icon, badge, dot, menuOpen, children }: { active: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void; icon: ReactNode; badge?: number; dot?: string; menuOpen?: boolean; children: ReactNode }) {
  const isMenu = menuOpen !== undefined;
  return (
    <button className={`ws-nav-item ${active ? 'is-active' : ''}`} aria-current={active && !isMenu ? 'page' : undefined} aria-haspopup={isMenu ? 'menu' : undefined} aria-expanded={isMenu ? menuOpen : undefined} onClick={onClick}>
      <span className="ws-nav-icon" aria-hidden="true">{icon}</span>
      <span className="ws-nav-label">{children}</span>
      {badge ? <span className="ws-nav-badge">{badge}</span> : null}
      {dot ? <span className="ws-nav-dot" role="status" aria-label={dot} title={dot} /> : null}
    </button>
  );
}

function AppCard({ kind, title, desc, action, onClick }: { kind: FileKind; title: string; desc: string; action: 'plus' | 'arrow'; onClick: () => void }) {
  return (
    <button className={`ws-app ws-app-${kind}`} onClick={onClick} {...editorIntentHandlers(kind)}>
      <SuiteLogo kind={kind} size={56} />
      <span className="ws-app-text"><strong>{title}</strong><span>{desc}</span></span>
      <span className="ws-app-action" aria-hidden="true">{action === 'plus' ? <Plus size={22} /> : <ArrowRight size={22} />}</span>
    </button>
  );
}

function FilterMenu({ sortOrder, onSort, starredOnly, onStarredOnly }: { sortOrder: SortOrder; onSort: (order: SortOrder) => void; starredOnly: boolean; onStarredOnly: (value: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const active = starredOnly || sortOrder !== 'recent';
  return (
    <Popover
      open={open}
      onClose={close}
      trigger={
        <button className={`ws-filter ${active ? 'is-active' : ''}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
          <Funnel size={18} aria-hidden="true" />Lọc
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      }
    >
      <span className="ws-menu-label">Sắp xếp</span>
      {(Object.keys(SORT_LABEL) as SortOrder[]).map((order) => (
        <button key={order} role="menuitemradio" aria-checked={sortOrder === order} className="ws-menu-item" onClick={() => onSort(order)}>
          <span className="ws-menu-check">{sortOrder === order && <Check size={16} />}</span>{SORT_LABEL[order]}
        </button>
      ))}
      <hr />
      <button role="menuitemcheckbox" aria-checked={starredOnly} className="ws-menu-item" onClick={() => onStarredOnly(!starredOnly)}>
        <span className="ws-menu-check">{starredOnly && <Check size={16} />}</span>Chỉ tài liệu gắn sao
      </button>
    </Popover>
  );
}

function RowMenu({ file, props }: { file: FileMeta; props: HomeProps }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const run = (action: (file: FileMeta) => void) => () => { setOpen(false); action(file); };
  return (
    <Popover
      open={open}
      onClose={close}
      trigger={
        <button className="ws-icon-btn" aria-label={`Thao tác với ${file.name}`} aria-expanded={open} aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); setOpen((value) => !value); }}>
          <Ellipsis size={20} />
        </button>
      }
    >
      {file.deletedAt ? (
        <>
          <button role="menuitem" className="ws-menu-item" onClick={run(props.onRestore)}><RotateCcw size={16} aria-hidden="true" />Khôi phục</button>
          <button role="menuitem" className="ws-menu-item ws-danger" onClick={run(props.onDeletePermanent)}><Trash2 size={16} aria-hidden="true" />Xoá vĩnh viễn</button>
        </>
      ) : (
        <>
          <button role="menuitem" className="ws-menu-item" onClick={run(props.onRename)}><Edit2 size={16} aria-hidden="true" />Đổi tên</button>
          <button role="menuitem" className="ws-menu-item" onClick={run(props.onDuplicate)}><Copy size={16} aria-hidden="true" />Nhân bản</button>
          <button role="menuitem" className="ws-menu-item" onClick={run(props.onToggleStar)}><Star size={16} aria-hidden="true" />{file.starred ? 'Bỏ gắn sao' : 'Gắn sao'}</button>
          <hr />
          <button role="menuitem" className="ws-menu-item ws-danger" onClick={run(props.onTrash)}><Trash2 size={16} aria-hidden="true" />Chuyển vào thùng rác</button>
        </>
      )}
    </Popover>
  );
}

function StarButton({ file, onToggle }: { file: FileMeta; onToggle: (file: FileMeta) => void }) {
  return (
    <button
      className={`ws-star ${file.starred ? 'is-on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle(file); }}
      aria-pressed={file.starred}
      aria-label={file.starred ? `Bỏ gắn sao ${file.name}` : `Gắn sao ${file.name}`}
      disabled={Boolean(file.deletedAt)}
    >
      <Star size={20} fill={file.starred ? 'currentColor' : 'none'} />
    </button>
  );
}

type ListProps = { files: FileMeta[]; location: (file: FileMeta) => string; props: HomeProps; onOpen: (file: FileMeta) => void };

function FileTable({ files, location, props, onOpen }: ListProps) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th className="ws-col-star"><span className="ws-sr">Gắn sao</span></th>
            <th>Tên tài liệu</th>
            <th className="ws-col-location">Vị trí</th>
            <th className="ws-col-updated">Cập nhật</th>
            <th className="ws-col-menu"><span className="ws-sr">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} onDoubleClick={() => onOpen(file)} {...(file.deletedAt ? {} : editorIntentHandlers(file.kind))}>
              <td className="ws-col-star"><StarButton file={file} onToggle={props.onToggleStar} /></td>
              <td>
                <button className="ws-file-name" onClick={() => onOpen(file)} disabled={Boolean(file.deletedAt)}>
                  <SuiteLogo kind={file.kind} size={32} />
                  <span>{file.name}</span>
                </button>
              </td>
              <td className="ws-col-location"><span className="ws-location"><Folder size={20} aria-hidden="true" />{location(file)}</span></td>
              <td className="ws-col-updated">{relativeTime(file.updatedAt)}</td>
              <td className="ws-col-menu"><RowMenu file={file} props={props} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileGrid({ files, location, props, onOpen }: ListProps) {
  return (
    <div className="ws-file-grid">
      {files.map((file) => (
        <div key={file.id} className="ws-file-card" {...(file.deletedAt ? {} : editorIntentHandlers(file.kind))}>
          <div className="ws-file-card-top">
            <SuiteLogo kind={file.kind} size={40} />
            <StarButton file={file} onToggle={props.onToggleStar} />
          </div>
          <button className="ws-file-card-name" onClick={() => onOpen(file)} disabled={Boolean(file.deletedAt)}>{file.name}</button>
          <p>{file.preview || PRODUCT_NAME[file.kind]}</p>
          <div className="ws-file-card-foot">
            <span>{location(file)} · {relativeTime(file.updatedAt)}</span>
            <RowMenu file={file} props={props} />
          </div>
        </div>
      ))}
    </div>
  );
}
