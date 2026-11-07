import { useState, useMemo } from 'react';
import { AccountButton, useAccount } from './Authentication';
import {
  FileText,
  FileSpreadsheet,
  Plus,
  Search,
  Upload,
  HardDrive,
  Download,
  Trash2,
  Star,
  Copy,
  Edit2,
  RotateCcw,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';

import type { FileMeta } from '../lib/storage';
import type { WorkbookData } from '../lib/sheetTypes';
import { formatBytes, relativeTime } from '../lib/download';
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
  onCreateDoc: (templateHtml?: string) => void;
  onCreateSheet: (templateWorkbook?: WorkbookData) => void;
  onCreatePdf: () => void;
  onImportFile: (file: File) => void;
  onRename: (file: FileMeta) => void;
  onDuplicate: (file: FileMeta) => void;
  onToggleStar: (file: FileMeta) => void;
  onTrash: (file: FileMeta) => void;
  onRestore: (file: FileMeta) => void;
  onDeletePermanent: (file: FileMeta) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

type NavCategory = 'all' | 'docs' | 'sheets' | 'pdfs' | 'starred' | 'trash';

export default function Home({
  files,
  storageInfo,
  onOpenDoc,
  onOpenSheet,
  onOpenPdf,
  onCreateDoc,
  onCreateSheet,
  onCreatePdf,
  onImportFile,
  onRename,
  onDuplicate,
  onToggleStar,
  onTrash,
  onRestore,
  onDeletePermanent,
  onExportBackup,
  onImportBackup,
}: HomeProps) {
  const { user } = useAccount();
  const [category, setCategory] = useState<NavCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Filter files based on category and search query
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Trash filter
      if (category === 'trash') {
        if (!file.deletedAt) return false;
      } else {
        if (file.deletedAt) return false;
        if (category === 'docs' && file.kind !== 'doc') return false;
        if (category === 'sheets' && file.kind !== 'sheet') return false;
        if (category === 'pdfs' && file.kind !== 'pdf') return false;
        if (category === 'starred' && !file.starred) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return file.name.toLowerCase().includes(q) || (file.preview && file.preview.toLowerCase().includes(q));
      }

      return true;
    });
  }, [files, category, searchQuery]);

  const docCount = useMemo(() => files.filter((f) => !f.deletedAt && f.kind === 'doc').length, [files]);
  const sheetCount = useMemo(() => files.filter((f) => !f.deletedAt && f.kind === 'sheet').length, [files]);
  const pdfCount = useMemo(() => files.filter((f) => !f.deletedAt && f.kind === 'pdf').length, [files]);
  const starCount = useMemo(() => files.filter((f) => !f.deletedAt && f.starred).length, [files]);
  const trashCount = useMemo(() => files.filter((f) => f.deletedAt).length, [files]);

  const handleOpenFile = (file: FileMeta) => {
    if (file.kind === 'doc') onOpenDoc(file);
    else if (file.kind === 'sheet') onOpenSheet(file);
    else onOpenPdf(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      e.target.value = '';
    }
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`app-shell ${isDragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          onImportFile(file);
        }
      }}
    >
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '36px 48px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: '2px dashed #2563eb',
              maxWidth: 440,
            }}
          >
            <Upload size={54} color="#2563eb" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Thả tệp vào đây để mở ngay
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              Hỗ trợ tệp Minh Docs (<strong>.docx</strong>), Minh Sheets (<strong>.xlsx</strong>, <strong>.xls</strong>), Minh PDF (<strong>.pdf</strong>) và bảng tính <strong>.csv</strong>
            </p>
          </div>
        </div>
      )}
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div
          className="brand"
          style={{
            cursor: 'pointer',
            padding: '4px 8px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            userSelect: 'none',
          }}
          onClick={() => setCategory('all')}
          title="Minh Spark Office — Về trang chủ"
        >
          {/* Official 3D Isometric Brand Mark */}
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="Minh Spark Office"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Vertical Hairline Divider */}
          <div
            style={{
              width: 1.5,
              height: 34,
              background: 'rgba(255, 255, 255, 0.16)',
              borderRadius: 1,
              flexShrink: 0,
            }}
          />

          {/* Typography */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              Minh Spark
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.2px',
                lineHeight: 1.2,
                marginTop: 1,
              }}
            >
              Office
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#64748b',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginTop: 3,
                whiteSpace: 'nowrap',
              }}
            >
              Minh Docs · Sheets · PDF
            </div>
          </div>
        </div>

        {/* Create Button */}
        <div className="create-split">
          <button
            className="create-main"
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            aria-expanded={showCreateMenu}
          >
            <span>+ Tạo tài liệu mới</span>
            <Plus size={16} />
          </button>
        </div>

        {showCreateMenu && (
          <div style={{ background: '#252a35', borderRadius: 8, padding: 6, margin: '-14px 4px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className="nav-item"
              style={{ color: '#ffffff' }}
              onClick={() => {
                setShowCreateMenu(false);
                onCreateDoc();
              }}
            >
              <div className="nav-dot docs" />
              <span>Minh Docs (.docx)</span>
            </button>
            <button
              className="nav-item"
              style={{ color: '#ffffff' }}
              onClick={() => {
                setShowCreateMenu(false);
                onCreateSheet();
              }}
            >
              <div className="nav-dot sheets" />
              <span>Minh Sheets (.xlsx)</span>
            </button>
            <button
              className="nav-item"
              style={{ color: '#ffffff' }}
              onClick={() => {
                setShowCreateMenu(false);
                onCreatePdf();
              }}
            >
              <div className="nav-dot" style={{ background: '#ef4444' }} />
              <span>Minh PDF (.pdf)</span>
            </button>
          </div>
        )}

        <div className="sidebar-label">Danh mục</div>

        <button
          className={`nav-item ${category === 'all' ? 'active' : ''}`}
          onClick={() => setCategory('all')}
        >
          <FileText size={16} />
          <span>Tất cả tệp</span>
          <span className="nav-count">{docCount + sheetCount + pdfCount}</span>
        </button>

        <button
          className={`nav-item ${category === 'docs' ? 'active' : ''}`}
          onClick={() => setCategory('docs')}
        >
          <div className="nav-dot docs" />
          <span>Minh Docs</span>
          <span className="nav-count">{docCount}</span>
        </button>

        <button
          className={`nav-item ${category === 'sheets' ? 'active' : ''}`}
          onClick={() => setCategory('sheets')}
        >
          <div className="nav-dot sheets" />
          <span>Minh Sheets</span>
          <span className="nav-count">{sheetCount}</span>
        </button>

        <button
          className={`nav-item ${category === 'pdfs' ? 'active' : ''}`}
          onClick={() => setCategory('pdfs')}
        >
          <div className="nav-dot" style={{ background: '#ef4444' }} />
          <span>Minh PDF</span>
          <span className="nav-count">{pdfCount}</span>
        </button>

        <button
          className={`nav-item ${category === 'starred' ? 'active' : ''}`}
          onClick={() => setCategory('starred')}
        >
          <Star size={16} />
          <span>Được gắn sao</span>
          <span className="nav-count">{starCount}</span>
        </button>

        <button
          className={`nav-item ${category === 'trash' ? 'active' : ''}`}
          onClick={() => setCategory('trash')}
        >
          <Trash2 size={16} />
          <span>Thùng rác</span>
          {trashCount > 0 && <span className="nav-count">{trashCount}</span>}
        </button>

        {/* Bottom Storage & Backup */}
        <div className="sidebar-bottom">
          <div className="storage-box">
            <strong>
              <span className="storage-dot" />
              {user ? 'Kho riêng trên máy này' : 'Kho cục bộ không đăng nhập'}
            </strong>
            <div>
              {storageInfo ? (
                <>
                  Đã dùng {formatBytes(storageInfo.usage)}
                  <div className="storage-bar">
                    <div
                      className="storage-fill"
                      style={{ width: `${Math.min(100, (storageInfo.usage / (storageInfo.quota || 1)) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                'IndexedDB khả dụng'
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                className="btn"
                style={{ fontSize: 11, padding: '4px 8px', flex: 1, minHeight: 28 }}
                onClick={onExportBackup}
                title="Tải về bản sao lưu toàn bộ tệp"
              >
                <Download size={12} />
                <span>Sao lưu</span>
              </button>
              <label
                className="btn"
                style={{ fontSize: 11, padding: '4px 8px', flex: 1, minHeight: 28, cursor: 'pointer' }}
                title="Khôi phục tệp từ bản sao lưu"
              >
                <Upload size={12} />
                <span>Khôi phục</span>
                <input type="file" accept=".json" hidden onChange={handleBackupUpload} />
              </label>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu, bảng tính… (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setSearchQuery('')}>
                ×
              </button>
            )}
          </div>

          <div className="topbar-right">
            <AccountButton />
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={15} />
              <span>Mở tệp từ máy (.docx, .xlsx, .pdf, .csv)…</span>
              <input type="file" accept=".docx,.xlsx,.xlsm,.xls,.csv,.tsv,.pdf" hidden onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="home-content">
          {category !== 'trash' && !searchQuery && (
            <>
              <div className="welcome-section">
                <div>
                  <h1>Bắt đầu tạo mới</h1>
                  <p>{user ? 'Đã đăng nhập Google. Tài liệu lưu riêng trên trình duyệt này, chưa đồng bộ cloud.' : 'Chọn mẫu tài liệu hoặc bảng tính chuyên nghiệp để bắt đầu làm việc ngay'}</p>
                </div>
              </div>

              {/* Templates Gallery */}
              <div className="templates-grid">
                <button className="template-card" onClick={() => onCreateDoc()}>
                  <div className="template-badge doc">
                    <Plus size={20} />
                  </div>
                  <div className="template-title">Văn bản trống</div>
                  <div className="template-desc">Tạo tài liệu Minh Docs mới với định dạng chuẩn</div>
                </button>

                <button className="template-card" onClick={() => onCreateDoc(sampleDocHtml())}>
                  <div className="template-badge doc">
                    <Sparkles size={20} />
                  </div>
                  <div className="template-title">Báo cáo hoạt động quý</div>
                  <div className="template-desc">Mẫu báo cáo kinh doanh kèm bảng biểu & chỉ số</div>
                </button>

                <button className="template-card" onClick={() => onCreateDoc(contractDocHtml())}>
                  <div className="template-badge doc">
                    <FileText size={20} />
                  </div>
                  <div className="template-title">Hợp đồng kinh tế</div>
                  <div className="template-desc">Hợp đồng dịch vụ công nghệ chuẩn pháp lý Việt Nam</div>
                </button>

                <button className="template-card" onClick={() => onCreateDoc(meetingMinutesDocHtml())}>
                  <div className="template-badge doc">
                    <FileText size={20} />
                  </div>
                  <div className="template-title">Biên bản cuộc họp</div>
                  <div className="template-desc">Ghi chép giao ban tuần, kết luận và phân công task</div>
                </button>

                <button className="template-card" onClick={() => onCreateSheet()}>
                  <div className="template-badge sheet">
                    <Plus size={20} />
                  </div>
                  <div className="template-title">Bảng tính trống</div>
                  <div className="template-desc">Tạo bảng tính Minh Sheets mới với lưới dữ liệu mở rộng</div>
                </button>

                <button className="template-card" onClick={() => onCreateSheet(sampleWorkbook('Báo cáo ngân sách'))}>
                  <div className="template-badge sheet">
                    <Sparkles size={20} />
                  </div>
                  <div className="template-title">Ngân sách quý IV</div>
                  <div className="template-desc">Bảng tính có sẵn công thức SUM, AVERAGE và phân bổ chi phí</div>
                </button>

                <button className="template-card" onClick={() => onCreateSheet(payrollWorkbook())}>
                  <div className="template-badge sheet">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div className="template-title">Bảng lương & Chấm công</div>
                  <div className="template-desc">Tính toán ngày công, lương thực lĩnh & tự động làm tròn</div>
                </button>

                <button className="template-card" onClick={() => onCreateSheet(cashbookWorkbook())}>
                  <div className="template-badge sheet">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div className="template-title">Sổ quỹ Thu Chi</div>
                  <div className="template-desc">Theo dõi phiếu thu, phiếu chi và tồn quỹ luỹ kế theo ngày</div>
                </button>

                <button className="template-card" onClick={() => onCreateSheet(projectEstimateWorkbook())}>
                  <div className="template-badge sheet">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div className="template-title">Dự toán & Tiến độ dự án</div>
                  <div className="template-desc">Quản lý hạng mục, chi phí giải ngân thực tế & tiến độ %</div>
                </button>

                <button className="template-card" onClick={() => onCreatePdf()}>
                  <div className="template-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                    <FileText size={20} />
                  </div>
                  <div className="template-title">Minh PDF Tools</div>
                  <div className="template-desc">Bộ công cụ ký số, tách, ghép, nén & chuyển đổi PDF chuyên nghiệp</div>
                </button>
              </div>
            </>
          )}

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="tabs-group">
              <button className={`filter-tab ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
                Gần đây
              </button>
              <button className={`filter-tab ${category === 'docs' ? 'active' : ''}`} onClick={() => setCategory('docs')}>
                Minh Docs ({docCount})
              </button>
              <button className={`filter-tab ${category === 'sheets' ? 'active' : ''}`} onClick={() => setCategory('sheets')}>
                Minh Sheets ({sheetCount})
              </button>
              <button className={`filter-tab ${category === 'pdfs' ? 'active' : ''}`} onClick={() => setCategory('pdfs')}>
                Minh PDF ({pdfCount})
              </button>
              <button className={`filter-tab ${category === 'starred' ? 'active' : ''}`} onClick={() => setCategory('starred')}>
                Gắn sao ({starCount})
              </button>
              {trashCount > 0 && (
                <button className={`filter-tab ${category === 'trash' ? 'active' : ''}`} onClick={() => setCategory('trash')}>
                  Thùng rác ({trashCount})
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Dạng danh sách"
              >
                <ListIcon size={16} />
              </button>
              <button
                className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Dạng lưới thẻ"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>

          {/* Files List / Grid */}
          {filteredFiles.length === 0 ? (
            <div className="empty-state">
              <HardDrive size={36} />
              <h3>Không tìm thấy tệp nào</h3>
              <p>
                {searchQuery
                  ? `Không có kết quả nào khớp với "${searchQuery}"`
                  : category === 'trash'
                  ? 'Thùng rác hiện đang trống.'
                  : 'Chưa có tài liệu nào. Bấm nút Tạo mới hoặc Tải lên từ máy để bắt đầu.'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="file-table-wrap">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Tên tệp</th>
                    <th>Loại</th>
                    <th>Cập nhật</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr key={file.id} className="file-row">
                      <td>
                        <div className="file-info">
                          <button
                            className="icon-btn"
                            style={{ width: 28, height: 28, color: file.starred ? '#f59e0b' : 'var(--muted)' }}
                            onClick={() => onToggleStar(file)}
                            title={file.starred ? 'Bỏ gắn sao' : 'Gắn sao'}
                          >
                            <Star size={15} fill={file.starred ? '#f59e0b' : 'none'} />
                          </button>
                          <div
                            className={`file-icon-box ${file.kind}`}
                            onClick={() => handleOpenFile(file)}
                            style={{ cursor: 'pointer' }}
                          >
                            {file.kind === 'sheet' ? <FileSpreadsheet size={18} /> : <FileText size={18} />}
                          </div>
                          <div>
                            <div className="file-name-cell" onClick={() => handleOpenFile(file)}>
                              {file.name}
                            </div>
                            {file.preview && (
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.preview}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`file-tag ${file.kind}`}>
                          {file.kind === 'doc' ? 'Minh Docs' : file.kind === 'sheet' ? 'Minh Sheets' : 'Minh PDF'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {relativeTime(file.updatedAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {file.deletedAt ? (
                            <>
                              <button className="icon-btn" onClick={() => onRestore(file)} title="Khôi phục tệp">
                                <RotateCcw size={15} />
                              </button>
                              <button
                                className="icon-btn"
                                style={{ color: 'var(--accent)' }}
                                onClick={() => onDeletePermanent(file)}
                                title="Xoá vĩnh viễn"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="icon-btn" onClick={() => onRename(file)} title="Đổi tên">
                                <Edit2 size={15} />
                              </button>
                              <button className="icon-btn" onClick={() => onDuplicate(file)} title="Nhân bản">
                                <Copy size={15} />
                              </button>
                              <button className="icon-btn" onClick={() => onTrash(file)} title="Xoá vào thùng rác">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="template-card"
                  style={{ cursor: 'pointer', minHeight: 140 }}
                  onClick={() => handleOpenFile(file)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={`template-badge ${file.kind}`}>
                      {file.kind === 'sheet' ? <FileSpreadsheet size={18} /> : <FileText size={18} />}
                    </div>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(file);
                      }}
                    >
                      <Star size={15} fill={file.starred ? '#f59e0b' : 'none'} color={file.starred ? '#f59e0b' : 'var(--muted)'} />
                    </button>
                  </div>

                  <div className="template-title" style={{ marginTop: 8 }}>{file.name}</div>
                  <div className="template-desc" style={{ minHeight: 32 }}>
                    {file.preview || (file.kind === 'doc' ? 'Tài liệu Minh Docs' : file.kind === 'sheet' ? 'Bảng tính Minh Sheets' : 'Tài liệu Minh PDF')}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                    <span>{relativeTime(file.updatedAt)}</span>
                    <button
                      className="icon-btn"
                      style={{ width: 24, height: 24 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrash(file);
                      }}
                      title="Xoá"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <section aria-labelledby="office-overview-title" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)', lineHeight: 1.7 }}>
            <h2 id="office-overview-title" style={{ fontSize: 18, marginBottom: 8 }}>Minh Spark Office — Free online office</h2>
            <p style={{ color: 'var(--ink-secondary)', maxWidth: 760 }}>Soạn thảo văn bản với Minh Docs, làm bảng tính với Minh Sheets và xử lý PDF với Minh PDF miễn phí trên trình duyệt, không cần cài bộ ứng dụng văn phòng. Bản nháp được lưu an toàn trên thiết bị.</p>
            <nav aria-label="Tìm hiểu sản phẩm" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: 12 }}>
              <a href="/gioi-thieu.html" style={{ color: '#a93229', padding: '10px 0' }}>Giới thiệu Minh Spark Office</a>
              <a href="/minh-docs.html" style={{ color: '#a93229', padding: '10px 0' }}>Soạn thảo văn bản miễn phí</a>
              <a href="/minh-sheets.html" style={{ color: '#a93229', padding: '10px 0' }}>Bảng tính online miễn phí</a>
              <a href="/minh-pdf.html" style={{ color: '#a93229', padding: '10px 0' }}>Xử lý PDF online miễn phí</a>
            </nav>
          </section>
        </div>
      </main>
    </div>
  );
}
