import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SuiteLogo } from '../SuiteLogo';
import { useWorkspace, type FileMeta } from '../../lib/storage';
import { relativeTime } from '../../lib/download';
import { teamErrorMessage, type TeamStore } from '../../lib/teamStore';
import { LIVE_ITEM_KINDS, TEAM_ITEM_KINDS, type TeamItem, type TeamItemKind, type TeamItemType } from '../../lib/teams';
import { TmButton, TmField, TmModal } from './TeamParts';

const stripExtension = (name: string) => name.replace(/\.(docx?|xlsx|xlsm|xls|csv|pptx?|pdf|md|txt|html?)$/i, '');

export function PublishDialog({ store, teamId, type, files, categories, replacing, initialFileId = null, onClose, onDone }: {
  store: TeamStore;
  initialFileId?: string | null;
  teamId: string;
  type: TeamItemType;
  files: FileMeta[];
  categories: string[];
  replacing?: TeamItem;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const workspace = useWorkspace();
  const candidates = useMemo(() => files
    .filter((file) => !file.deletedAt && ((type === 'document' ? LIVE_ITEM_KINDS : TEAM_ITEM_KINDS) as string[]).includes(file.kind) && (!replacing || file.kind === replacing.kind))
    .sort((a, b) => b.updatedAt - a.updatedAt), [files, replacing, type]);
  const [query, setQuery] = useState('');
  const initialFile = useMemo(() => (initialFileId ? candidates.find((file) => file.id === initialFileId) ?? null : null), [candidates, initialFileId]);
  const [selected, setSelected] = useState<FileMeta | null>(initialFile);
  const [name, setName] = useState(replacing?.name ?? (initialFile ? stripExtension(initialFile.name) : ''));
  const [description, setDescription] = useState(replacing?.description ?? '');
  const [category, setCategory] = useState(replacing?.category ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visible = candidates.filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60);
  const noun = type === 'template' ? 'mẫu' : 'tài liệu chung';

  const pick = (file: FileMeta) => {
    setSelected(file);
    if (!replacing && (!name.trim() || name === stripExtension(selected?.name ?? ''))) setName(stripExtension(file.name));
  };

  const submit = async () => {
    if (!selected || !name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const content = await workspace.loadContent(selected.id);
      if (!content) throw new Error('team/source-missing');
      if (replacing) {
        await store.replaceItemContent(replacing, content, { name, description, category });
        onDone(`Đã cập nhật nội dung ${noun} “${name.trim()}”.`);
      } else {
        await store.publishItem(teamId, { type, name, kind: selected.kind as TeamItemKind, description, category, content });
        onDone(type === 'template' ? `Đã đăng mẫu “${name.trim()}” cho cả nhóm.` : `Đã thêm “${name.trim()}” vào tài liệu chung.`);
      }
    } catch (failure) {
      console.warn('team publish failed', failure);
      setError(failure instanceof Error && failure.message === 'team/source-missing' ? 'Không đọc được nội dung tài liệu này trên máy.' : teamErrorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <TmModal
      wide
      title={replacing ? `Cập nhật nội dung ${noun}` : type === 'template' ? 'Đăng mẫu lên nhóm' : 'Thêm tài liệu chung'}
      subtitle={replacing ? 'Chọn tài liệu trong kho của bạn để thay nội dung hiện tại.' : type === 'template' ? 'Chọn một tài liệu trong kho của bạn. Thành viên dùng mẫu sẽ nhận một bản sao riêng.' : 'Chọn văn bản, bảng tính hoặc bài thuyết trình để cả nhóm cùng mở và chỉnh sửa trực tiếp.'}
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <>
          <span className="tm-form-error" role="alert">{error}</span>
          <TmButton onClick={onClose} disabled={busy}>Hủy</TmButton>
          <TmButton variant="primary" disabled={!selected || !name.trim() || busy} onClick={() => void submit()}>{busy ? 'Đang tải lên…' : replacing ? 'Cập nhật' : type === 'template' ? 'Đăng mẫu' : 'Thêm vào nhóm'}</TmButton>
        </>
      )}
    >
      <div className="tm-publish">
        <div className="tm-publish-files">
          <span className="tm-field-label" id="tm-publish-files-label">Tài liệu của bạn</span>
          <label className="tm-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} placeholder="Tìm tài liệu của bạn…" aria-label="Tìm tài liệu của bạn" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="tm-file-pick" role="listbox" aria-labelledby="tm-publish-files-label">
            {visible.length ? visible.map((file) => (
              <button key={file.id} type="button" role="option" aria-selected={selected?.id === file.id} className={`tm-file-option ${selected?.id === file.id ? 'is-active' : ''}`} onClick={() => pick(file)}>
                <SuiteLogo kind={file.kind} size={28} />
                <span><strong>{file.name}</strong><small>Sửa {relativeTime(file.updatedAt)}</small></span>
              </button>
            )) : <p className="tm-muted">{candidates.length ? 'Không có tài liệu khớp.' : 'Kho của bạn chưa có văn bản, bảng tính hay bài thuyết trình nào.'}</p>}
          </div>
        </div>
        <div className="tm-publish-form">
          <TmField label={`Tên ${noun}`}>
            <input className="tm-input" value={name} maxLength={200} placeholder={`Tên hiển thị của ${noun}`} onChange={(event) => setName(event.target.value)} />
          </TmField>
          <TmField label="Mô tả" hint="Giúp mọi người biết khi nào nên dùng.">
            <textarea className="tm-input" rows={4} value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} />
          </TmField>
          <TmField label="Danh mục" hint="Ví dụ: Hành chính, Kế toán, Kỹ thuật.">
            <input className="tm-input" value={category} maxLength={60} list="tm-categories" onChange={(event) => setCategory(event.target.value)} />
            <datalist id="tm-categories">{categories.map((value) => <option key={value} value={value} />)}</datalist>
          </TmField>
        </div>
      </div>
    </TmModal>
  );
}
