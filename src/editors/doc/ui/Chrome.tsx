import { useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, Clipboard, Download, FileCode2, FileImage, FileText, FileType2, FolderOpen, History, Info, Mail, MonitorPlay, Printer, Save, Share2, FilePlus2, X, BookOpen, ScrollText, Columns3, Minus, Plus, PencilLine } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { pickFile, formatBytes } from '../../../lib/download';
import { saveVersion } from '../../../lib/storage';
import { useDoc } from '../DocContext';
import { textStats } from '../docTools';
import { exportAsDocx, exportAsHtml, exportAsMarkdown, exportAsPng, exportAsText, exportSlides, printDocument, standaloneHtml, toggleProtection } from '../actions';
import { DOC_TEMPLATES } from '../docTemplates';
import { ZOOM_STEPS } from './tabs/ViewTabs';

type Section = 'info' | 'new' | 'open' | 'export' | 'share';

export function Backstage({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [section, setSection] = useState<Section>('info');
  const stats = useMemo(() => textStats(ctx.editor.getText({ blockSeparator: '\n' })), [ctx.editor]);
  const nav: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Thông tin', icon: <Info size={16} /> },
    { id: 'new', label: 'Mới', icon: <FilePlus2 size={16} /> },
    { id: 'open', label: 'Mở', icon: <FolderOpen size={16} /> },
    { id: 'export', label: 'Xuất', icon: <Download size={16} /> },
    { id: 'share', label: 'Chia sẻ', icon: <Share2 size={16} /> },
  ];
  const act = (fn: () => void) => { onClose(); fn(); };
  const exportItems: { icon: React.ReactNode; title: string; desc: string; run: () => void }[] = [
    { icon: <FileText size={22} color="#2b579a" />, title: 'Word (.docx)', desc: 'Mở được bằng Microsoft Word, Google Docs, WPS', run: () => void exportAsDocx(ctx) },
    { icon: <Printer size={22} color="#d7473c" />, title: 'PDF', desc: 'Chọn “Lưu dưới dạng PDF” trong hộp thoại in', run: printDocument },
    { icon: <FileCode2 size={22} color="#d98e04" />, title: 'Trang web (.html)', desc: 'Một tệp HTML độc lập', run: () => exportAsHtml(ctx) },
    { icon: <FileType2 size={22} color="#586071" />, title: 'Markdown (.md)', desc: 'Cho GitHub, Obsidian, Notion', run: () => exportAsMarkdown(ctx) },
    { icon: <FileText size={22} color="#586071" />, title: 'Văn bản thuần (.txt)', desc: 'Chỉ chữ, không định dạng', run: () => exportAsText(ctx) },
    { icon: <FileImage size={22} color="#107c41" />, title: 'Ảnh (.png)', desc: 'Ảnh độ phân giải cao của trang', run: () => void exportAsPng(ctx) },
    { icon: <MonitorPlay size={22} color="#ea580c" />, title: 'Trình chiếu (.html)', desc: 'Mỗi tiêu đề thành một slide', run: () => exportSlides(ctx) },
  ];
  return (
    <div className="backstage" role="dialog" aria-modal="true" aria-label="Tệp">
      <nav className="backstage-nav">
        <button className="backstage-back" onClick={onClose}><ArrowLeft size={18} /> Quay lại</button>
        {nav.map((item) => <button key={item.id} className={`backstage-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>{item.icon}{item.label}</button>)}
        <div className="backstage-sep" />
        <button className="backstage-item" onClick={() => act(ctx.saveNow)}><Save size={16} /> Lưu ngay</button>
        <button className="backstage-item" onClick={async () => { await saveVersion(ctx.meta.id, { kind: 'doc', json: ctx.editor.getJSON(), page: ctx.page, comments: ctx.comments }); ctx.ui.toast('Đã lưu một phiên bản'); }}><Bookmark size={16} /> Lưu phiên bản</button>
        <button className="backstage-item" onClick={() => act(() => ctx.openDialog('history'))}><History size={16} /> Lịch sử phiên bản</button>
        <button className="backstage-item" onClick={() => act(printDocument)}><Printer size={16} /> In</button>
        <div className="backstage-sep" />
        <button className="backstage-item" onClick={() => act(ctx.onBack)}><X size={16} /> Đóng tài liệu</button>
      </nav>
      <div className="backstage-body">
        {section === 'info' && (
          <>
            <h1>Thông tin</h1>
            <div className="backstage-info">
              <div className="info-card">
                <h3>Thuộc tính</h3>
                <dl>
                  <dt>Tên</dt><dd>{ctx.title}</dd>
                  <dt>Kích thước</dt><dd>{formatBytes(JSON.stringify(ctx.editor.getJSON()).length)}</dd>
                  <dt>Tạo lúc</dt><dd>{new Date(ctx.meta.createdAt).toLocaleString('vi-VN')}</dd>
                  <dt>Sửa lần cuối</dt><dd>{new Date(ctx.meta.updatedAt).toLocaleString('vi-VN')}</dd>
                  <dt>Tác giả</dt><dd>Minh Spark</dd>
                  <dt>Số từ</dt><dd>{stats.words.toLocaleString('vi-VN')}</dd>
                  <dt>Số ký tự</dt><dd>{stats.chars.toLocaleString('vi-VN')}</dd>
                  <dt>Bình luận</dt><dd>{ctx.comments.length}</dd>
                </dl>
              </div>
              <div className="info-card">
                <h3>Bảo vệ tài liệu</h3>
                <p>{ctx.page.protectHash ? 'Tài liệu đang khoá chỉnh sửa bằng mật khẩu.' : 'Mọi người mở tệp đều có thể chỉnh sửa.'}</p>
                <button className="btn" onClick={() => act(() => void toggleProtection(ctx))}>{ctx.page.protectHash ? 'Bỏ hạn chế chỉnh sửa' : 'Hạn chế chỉnh sửa…'}</button>
                <h3>Lưu trữ</h3>
                <p>Lưu tự động trên máy này (IndexedDB) sau mỗi lần sửa. Không cần mạng.</p>
              </div>
            </div>
          </>
        )}
        {section === 'new' && (
          <>
            <h1>Mới</h1>
            <div className="template-grid">
              {DOC_TEMPLATES.map((t) => (
                <button key={t.id} className="template-tile clickable" onClick={() => act(() => ctx.onNewDocument(t.html()))}>
                  <div className="template-thumb" dangerouslySetInnerHTML={{ __html: t.html() }} />
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {section === 'open' && (
          <>
            <h1>Mở</h1>
            <div className="export-grid">
              <button className="export-tile" onClick={async () => { const file = await pickFile('.docx,.doc,.xlsx,.xls,.csv,.pdf'); if (file) act(() => ctx.onOpenFile(file)); }}>
                <FolderOpen size={22} color="#2b579a" /><div><strong>Mở tệp từ máy</strong><span>.docx, .xlsx, .csv, .pdf</span></div>
              </button>
              <button className="export-tile" onClick={() => act(ctx.onBack)}>
                <FileText size={22} color="#2b579a" /><div><strong>Tệp gần đây</strong><span>Về danh sách tệp trong Minh Office</span></div>
              </button>
            </div>
          </>
        )}
        {section === 'export' && (
          <>
            <h1>Xuất</h1>
            <div className="export-grid">
              {exportItems.map((item) => <button key={item.title} className="export-tile" onClick={() => act(item.run)}>{item.icon}<div><strong>{item.title}</strong><span>{item.desc}</span></div></button>)}
            </div>
          </>
        )}
        {section === 'share' && (
          <>
            <h1>Chia sẻ</h1>
            <div className="export-grid">
              <button className="export-tile" onClick={async () => {
                try {
                  await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([standaloneHtml(ctx)], { type: 'text/html' }), 'text/plain': new Blob([ctx.editor.getText({ blockSeparator: '\n' })], { type: 'text/plain' }) })]);
                  ctx.ui.toast('Đã sao chép tài liệu có định dạng — dán vào email hoặc Google Docs');
                } catch {
                  ctx.ui.toast('Trình duyệt chặn ghi clipboard', true);
                }
              }}><Clipboard size={22} color="#2b579a" /><div><strong>Sao chép có định dạng</strong><span>Dán thẳng vào Gmail, Outlook, Google Docs</span></div></button>
              <button className="export-tile" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(ctx.title)}`; }}><Mail size={22} color="#d7473c" /><div><strong>Gửi email</strong><span>Mở ứng dụng email với tiêu đề sẵn (đính kèm tệp .docx đã xuất)</span></div></button>
              <button className="export-tile" onClick={() => act(() => void exportAsDocx(ctx))}><FileText size={22} color="#2b579a" /><div><strong>Tải .docx để gửi</strong><span>Gửi qua Zalo, email, Drive</span></div></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type TabId = 'file' | 'home' | 'insert' | 'draw' | 'design' | 'layout' | 'references' | 'mailings' | 'review' | 'view' | 'pdf' | 'help' | 'table' | 'image';

export function TabBar({ tab, setTab, contextual }: { tab: TabId; setTab: (t: TabId) => void; contextual: TabId[] }) {
  const ctx = useDoc();
  const tabs: { id: TabId; label: string }[] = [
    { id: 'home', label: 'Trang chủ' }, { id: 'insert', label: 'Chèn' }, { id: 'design', label: 'Thiết kế' }, { id: 'layout', label: 'Bố cục' },
    { id: 'references', label: 'Tham chiếu' }, { id: 'mailings', label: 'Gửi thư' }, { id: 'review', label: 'Xem lại' }, { id: 'view', label: 'Xem' },
    { id: 'pdf', label: 'Minh PDF' }, { id: 'help', label: 'Trợ giúp' },
  ];
  const labels: Partial<Record<TabId, string>> = { table: 'Bảng', image: 'Ảnh' };
  return (
    <div className="ribbon-tabs-bar" role="tablist">
      <div className="ribbon-tabs-list">
        <button role="tab" className="ribbon-tab file-tab" onClick={() => ctx.openDialog('backstage')}>Tệp</button>
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`ribbon-tab ${tab === t.id ? 'active' : ''} ${t.id === 'pdf' ? 'pdf-tab' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        {contextual.map((id) => <button key={id} role="tab" aria-selected={tab === id} className={`ribbon-tab contextual ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{labels[id]}</button>)}
      </div>
      <div className="ribbon-top-actions">
        <select className="ribbon-pill-btn mode-select" aria-label="Chế độ" value={ctx.view.editMode} disabled={Boolean(ctx.page.protectHash)} onChange={(e) => ctx.setView({ editMode: e.target.value as typeof ctx.view.editMode })}>
          <option value="editing">✏️ Chỉnh sửa</option>
          <option value="suggesting">💬 Đề xuất</option>
          <option value="viewing">👁 Chỉ xem</option>
        </select>
      </div>
    </div>
  );
}

export function StatusBar({ page, pages }: { page: number; pages: number }) {
  const ctx = useDoc();
  const { editor, view, setView } = ctx;
  const counts = useEditorState({ editor, selector: ({ editor: e }) => {
    const { from, to, empty } = e.state.selection;
    const words = e.storage.characterCount?.words?.() ?? 0;
    const selected = empty ? 0 : e.state.doc.textBetween(from, to, ' ').trim().split(/\s+/).filter(Boolean).length;
    return { words, selected, chars: e.storage.characterCount?.characters?.() ?? 0 };
  } });
  const zoomStep = (dir: 1 | -1) => setView({ zoom: dir > 0 ? ZOOM_STEPS.find((z) => z > view.zoom) ?? 200 : [...ZOOM_STEPS].reverse().find((z) => z < view.zoom) ?? 50 });
  return (
    <footer className="editor-status">
      <div className="status-left">
        {view.viewMode === 'print' && <span>Trang {page}/{pages}</span>}
        <button className="status-btn" onClick={() => ctx.openDialog('wordcount')} title="Đếm từ">{counts.selected ? `${counts.selected.toLocaleString('vi-VN')} / ` : ''}{counts.words.toLocaleString('vi-VN')} từ</button>
        <span>{counts.chars.toLocaleString('vi-VN')} ký tự</span>
        <span>Tiếng Việt</span>
        {view.editMode === 'suggesting' && <span className="status-badge suggest"><PencilLine size={11} /> Đang theo dõi thay đổi</span>}
        {view.editMode === 'viewing' && <span className="status-badge view">Chỉ xem</span>}
        {ctx.dictation.listening && <span className="status-badge rec">● Đang nghe…</span>}
        {ctx.readAloud.speaking && <span className="status-badge">🔊 Đang đọc</span>}
      </div>
      <div className="status-right">
        <button className={`status-icon ${view.viewMode === 'read' ? 'on' : ''}`} title="Chế độ đọc" aria-label="Chế độ đọc" onClick={() => setView({ viewMode: 'read' })}><BookOpen size={14} /></button>
        <button className={`status-icon ${view.viewMode === 'print' ? 'on' : ''}`} title="Bố cục in" aria-label="Bố cục in" onClick={() => setView({ viewMode: 'print' })}><ScrollText size={14} /></button>
        <button className={`status-icon ${view.viewMode === 'web' ? 'on' : ''}`} title="Không chia trang" aria-label="Không chia trang" onClick={() => setView({ viewMode: 'web' })}><Columns3 size={14} /></button>
        <button className="status-icon" aria-label="Thu nhỏ" onClick={() => zoomStep(-1)}><Minus size={13} /></button>
        <input type="range" min={50} max={200} step={5} value={view.zoom} aria-label="Thu phóng" onChange={(e) => setView({ zoom: Number(e.target.value) })} />
        <button className="status-icon" aria-label="Phóng to" onClick={() => zoomStep(1)}><Plus size={13} /></button>
        <button className="status-btn zoom" onClick={() => setView({ zoom: 100 })} title="Về 100%">{view.zoom}%</button>
      </div>
    </footer>
  );
}
