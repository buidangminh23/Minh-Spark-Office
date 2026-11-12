import { useCallback, useMemo, useState } from 'react';
import { Copy, Edit2, Ellipsis, FilePlus2, FolderOpen, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { SuiteLogo } from '../SuiteLogo';
import { Popover } from '../HomeParts';
import { useUi } from '../ui';
import { relativeTime } from '../../lib/download';
import type { FileMeta } from '../../lib/storage';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { can, canDeleteItem, canEditItem, type TeamItem, type TeamItemKind, type TeamItemType, type TeamMember, type TeamRole } from '../../lib/teams';
import { PublishDialog } from './PublishDialog';
import { PersonAvatar, TmButton } from './TeamParts';

const KIND_TABS: Array<'all' | TeamItemKind> = ['all', 'doc', 'sheet', 'slide'];
const KIND_LABEL: Record<'all' | TeamItemKind, string> = { all: 'Tất cả', doc: 'Docs', sheet: 'Sheets', slide: 'Slides' };

export function TeamLibrary({ store, teamId, type, role, items, members, files, loading, error, onUse, onOpen }: {
  store: TeamStore;
  teamId: string;
  type: TeamItemType;
  role: TeamRole;
  items: TeamItem[];
  members: TeamMember[];
  files: FileMeta[];
  loading: boolean;
  error: string;
  onUse: (item: TeamItem) => void;
  onOpen: (item: TeamItem) => void;
}) {
  const ui = useUi();
  const uid = store.user.uid;
  const [kind, setKind] = useState<'all' | TeamItemKind>('all');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [publishing, setPublishing] = useState<false | 'new' | TeamItem>(false);
  const [menu, setMenu] = useState<string | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const ofType = useMemo(() => items.filter((item) => item.type === type), [items, type]);
  const categories = useMemo(() => [...new Set(ofType.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [ofType]);
  const photos = useMemo(() => new Map(members.map((member) => [member.uid, member.photoURL])), [members]);
  const q = query.trim().toLowerCase();
  const visible = ofType.filter((item) => (kind === 'all' || item.kind === kind) && (!category || item.category === category)
    && (!q || `${item.name} ${item.description} ${item.category} ${item.authorName}`.toLowerCase().includes(q)));
  const isTemplate = type === 'template';
  const canPublish = can(role, 'publish');

  const editInfo = async (item: TeamItem) => {
    const values = await ui.ask({
      title: isTemplate ? 'Sửa thông tin mẫu' : 'Sửa thông tin tài liệu',
      fields: [
        { name: 'name', label: 'Tên', value: item.name },
        { name: 'description', label: 'Mô tả', type: 'textarea', value: item.description },
        { name: 'category', label: 'Danh mục', value: item.category },
      ],
      confirmText: 'Lưu',
      validate: (input) => (String(input.name).trim() ? null : 'Tên không được để trống.'),
    });
    if (!values) return;
    try {
      await store.updateItemInfo(item, { name: String(values.name), description: String(values.description), category: String(values.category) });
      ui.toast('Đã lưu thông tin.');
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  const remove = async (item: TeamItem) => {
    if (!(await ui.confirm(isTemplate ? `Xoá mẫu “${item.name}”?` : `Xoá tài liệu chung “${item.name}”?`, 'Mọi thành viên sẽ không còn thấy mục này. Các bản sao đã tạo trong kho riêng vẫn giữ nguyên.', true))) return;
    try {
      await store.deleteItem(item);
      ui.toast('Đã xoá.');
    } catch (failure) { ui.toast(teamErrorMessage(failure), true); }
  };

  return (
    <section className="tm-library" aria-label={isTemplate ? 'Mẫu chung' : 'Tài liệu chung'}>
      <div className="tm-toolbar">
        <div className="ws-tabs" role="tablist" aria-label="Lọc theo loại">
          {KIND_TABS.map((tab) => (
            <button key={tab} role="tab" aria-selected={kind === tab} className={kind === tab ? 'is-active' : ''} onClick={() => setKind(tab)}>{KIND_LABEL[tab]}</button>
          ))}
        </div>
        {categories.length > 0 && (
          <select className="tm-input tm-select" value={category} aria-label="Lọc theo danh mục" onChange={(event) => setCategory(event.target.value)}>
            <option value="">Mọi danh mục</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        )}
        <label className="tm-search tm-toolbar-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} placeholder={isTemplate ? 'Tìm mẫu…' : 'Tìm tài liệu…'} aria-label={isTemplate ? 'Tìm mẫu' : 'Tìm tài liệu'} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {canPublish && (
          <TmButton variant="primary" icon={<FilePlus2 size={18} aria-hidden="true" />} onClick={() => setPublishing('new')}>
            {isTemplate ? 'Đăng mẫu' : 'Thêm tài liệu'}
          </TmButton>
        )}
      </div>

      {error && <p className="tm-alert" role="alert">{error}</p>}
      {loading && !ofType.length ? (
        <div className="tm-grid" aria-busy="true">{[0, 1, 2].map((index) => <div key={index} className="tm-item tm-skeleton" />)}</div>
      ) : visible.length ? (
        <div className="tm-grid">
          {visible.map((item) => {
            const editable = canEditItem(role, item, uid);
            const deletable = canDeleteItem(role, item, uid);
            return (
              <article key={item.id} className={`tm-item tm-kind-${item.kind}`}>
                <button type="button" className="tm-item-cover" onClick={() => (isTemplate ? onUse(item) : onOpen(item))} aria-label={isTemplate ? `Dùng mẫu ${item.name}` : `Mở ${item.name}`}>
                  <span className="tm-item-paper" aria-hidden="true">
                    <span className="tm-item-paper-title">{item.name}</span>
                    <span className="tm-item-paper-text">{item.preview || item.description || ' '}</span>
                  </span>
                  <SuiteLogo kind={item.kind} size={32} />
                </button>
                <div className="tm-item-body">
                  <div className="tm-item-title">
                    <h3 title={item.name}>{item.name}</h3>
                    {(editable || deletable) && (
                      <Popover open={menu === item.id} onClose={closeMenu} align="end" trigger={
                        <button type="button" className="tm-icon-btn" aria-label={`Tác vụ cho ${item.name}`} aria-haspopup="menu" aria-expanded={menu === item.id} onClick={() => setMenu((current) => (current === item.id ? null : item.id))}><Ellipsis size={18} /></button>
                      }>
                        {editable && <button role="menuitem" className="ws-menu-item" onClick={() => { closeMenu(); void editInfo(item); }}><Edit2 size={16} />Sửa thông tin</button>}
                        {editable && <button role="menuitem" className="ws-menu-item" onClick={() => { closeMenu(); setPublishing(item); }}><RefreshCw size={16} />Thay nội dung</button>}
                        {!isTemplate && <button role="menuitem" className="ws-menu-item" onClick={() => { closeMenu(); onUse(item); }}><Copy size={16} />Tạo bản sao riêng</button>}
                        {deletable && <button role="menuitem" className="ws-menu-item ws-menu-danger" onClick={() => { closeMenu(); void remove(item); }}><Trash2 size={16} />Xoá</button>}
                      </Popover>
                    )}
                  </div>
                  {item.description && <p className="tm-item-desc">{item.description}</p>}
                  <div className="tm-item-meta">
                    {item.category && <span className="tm-chip">{item.category}</span>}
                    <span className="tm-item-author">
                      <PersonAvatar uid={item.updatedBy || item.authorUid} name={item.updatedByName || item.authorName} photoURL={photos.get(item.updatedBy || item.authorUid)} size={20} />
                      <span>{isTemplate ? item.authorName : item.updatedByName} · {relativeTime(item.updatedAt)}</span>
                    </span>
                  </div>
                  <div className="tm-item-actions">
                    {isTemplate ? (
                      <TmButton variant="primary" icon={<Copy size={16} aria-hidden="true" />} onClick={() => onUse(item)}>Dùng mẫu</TmButton>
                    ) : (
                      <TmButton variant="primary" icon={<FolderOpen size={16} aria-hidden="true" />} onClick={() => onOpen(item)}>{can(role, 'editDocument') ? 'Mở và sửa chung' : 'Mở để xem'}</TmButton>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="ws-empty tm-empty">
          <Users size={32} aria-hidden="true" />
          <h3>{ofType.length ? 'Không có mục nào khớp bộ lọc' : isTemplate ? 'Nhóm chưa có mẫu nào' : 'Nhóm chưa có tài liệu chung'}</h3>
          <p>{ofType.length ? 'Thử đổi loại, danh mục hoặc từ khoá.' : canPublish ? (isTemplate ? 'Đăng một văn bản, bảng tính hoặc slide làm mẫu để cả nhóm dùng lại.' : 'Thêm một tài liệu để cả nhóm cùng mở và chỉnh sửa theo thời gian thực.') : 'Khi biên tập viên đăng, mục mới sẽ hiện ở đây ngay.'}</p>
          {canPublish && !ofType.length && <TmButton variant="primary" icon={<FilePlus2 size={18} aria-hidden="true" />} onClick={() => setPublishing('new')}>{isTemplate ? 'Đăng mẫu đầu tiên' : 'Thêm tài liệu đầu tiên'}</TmButton>}
        </div>
      )}

      {publishing && (
        <PublishDialog
          store={store}
          teamId={teamId}
          type={type}
          files={files}
          categories={categories}
          replacing={publishing === 'new' ? undefined : publishing}
          onClose={() => setPublishing(false)}
          onDone={(message) => { setPublishing(false); ui.toast(message); }}
        />
      )}
    </section>
  );
}
