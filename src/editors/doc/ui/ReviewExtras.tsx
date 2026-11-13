import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, BookOpenCheck, Check, FileDiff, FileStack, Filter, FileText, Images, IndentIncrease, ListChecks, ListTree, Lock, MessageSquare, PencilLine, Scale, Search, Sparkles, Trash2, Upload, X, Download, FolderInput, ShieldCheck } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { CitationSource } from '../../../lib/storage';
import { downloadBlob, pickFile } from '../../../lib/download';
import { newId, useDoc, type DialogId } from '../DocContext';
import { getRefs, setRefs, type NoteFormat } from '../extensionsExtra';
import { refreshNoteNumbers } from '../extReview';
import { AUTHORITY_CATEGORIES, convertNotes, findNodes, insertAuthority } from '../refsActions';
import { exportBibtex, parseSourcesFile } from '../refsImport';
import { collectChanges } from '../trackChanges';
import { TRACK_EVERYONE, changeAuthors, countLocked, readabilityReport, setLocked, startProtection, stopProtection, trackLocked, visibleChanges } from '../reviewActions';
import { combineAsTrackedChanges } from '../reviewCombine';
import { matchCase, thesaurusLookup } from '../reviewThesaurus';
import { describeProvider, runAi } from '../ai';
import { getPagination } from '../pagination';
import { docxToHtml, htmlToText } from './CheckDialogs';
import Modal from './Modal';

type DialogProps = { onClose: () => void };
type Leader = 'dots' | 'dashes' | 'underline' | 'none';

const LEADER_OPTIONS: { value: Leader; label: string }[] = [{ value: 'dots', label: 'Chấm ........' }, { value: 'dashes', label: 'Gạch ngang --------' }, { value: 'underline', label: 'Gạch dưới ________' }, { value: 'none', label: 'Không có' }];
const NOTE_FORMATS: { value: NoteFormat; label: string }[] = [{ value: 'decimal', label: '1, 2, 3' }, { value: 'lower-alpha', label: 'a, b, c' }, { value: 'lower-roman', label: 'i, ii, iii' }, { value: 'symbol', label: '*, †, ‡' }];

function LeaderField({ value, onChange, disabled }: { value: Leader; onChange: (value: Leader) => void; disabled?: boolean }) {
  return (
    <label className="field"><span className="field-label">Đường dẫn tới số trang</span>
      <select className="text-field" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Leader)}>{LEADER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </label>
  );
}

function ListPreview({ title, rows, showPages, right, leader }: { title: string; rows: { text: string; indent: number; page: string }[]; showPages: boolean; right: boolean; leader: Leader }) {
  return (
    <div className="doc-toc refs-preview" data-leader={leader} data-right={String(right)}>
      {title && <div className="toc-title">{title}</div>}
      {rows.map((row, index) => (
        <div key={index} className="toc-entry" style={{ paddingLeft: row.indent * 16 }}>
          <span className="toc-text">{row.text}</span>
          {showPages && <><span className="toc-dots" /><span className="toc-page">{row.page}</span></>}
        </div>
      ))}
    </div>
  );
}

function TocDialog({ onClose }: DialogProps) {
  const { editor, ui } = useDoc();
  const existing = useMemo(() => findNodes(editor, ['tableOfContents'])[0] ?? null, [editor]);
  const attrs = existing?.node.attrs;
  const [levels, setLevels] = useState(Number(attrs?.levels ?? 3));
  const [showPages, setShowPages] = useState(attrs?.showPages !== false);
  const [right, setRight] = useState(attrs?.rightAlign !== false);
  const [leader, setLeader] = useState<Leader>((attrs?.leader as Leader) ?? 'dots');
  const [showTitle, setShowTitle] = useState(attrs?.showTitle !== false);
  const [title, setTitle] = useState(String(attrs?.titleText ?? 'MỤC LỤC'));
  const apply = () => {
    const next = { levels, showPages, rightAlign: right, leader, showTitle, titleText: title.trim() || 'MỤC LỤC' };
    if (existing) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(existing.pos, undefined, { ...existing.node.attrs, ...next }));
      ui.toast('Đã cập nhật mục lục hiện có');
    } else {
      editor.chain().focus().insertDocList('tableOfContents', next).run();
    }
    onClose();
  };
  const sample = [{ text: 'Tiêu đề cấp 1', indent: 0, page: '1' }, { text: 'Tiêu đề cấp 2', indent: 1, page: '3' }, { text: 'Tiêu đề cấp 3', indent: 2, page: '5' }, { text: 'Tiêu đề cấp 4', indent: 3, page: '7' }].slice(0, Math.min(levels, 4));
  return (
    <Modal title="Mục lục tuỳ chỉnh" subtitle={existing ? 'Tài liệu đã có mục lục. Bấm Áp dụng để đổi mục lục đó.' : undefined} icon={<ListTree size={20} />} onClose={onClose} width={620} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>{existing ? 'Áp dụng' : 'Chèn'}</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Số cấp tiêu đề</span><input className="text-field" type="number" min={1} max={6} value={levels} onChange={(e) => setLevels(Math.max(1, Math.min(6, Number(e.target.value) || 3)))} /></label>
        <label className="field"><span className="field-label">Tiêu đề mục lục</span><input className="text-field" value={title} disabled={!showTitle} onChange={(e) => setTitle(e.target.value)} /></label>
        <LeaderField value={leader} onChange={setLeader} disabled={!showPages || !right} />
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Hiện tiêu đề</label>
        <label><input type="checkbox" checked={showPages} onChange={(e) => setShowPages(e.target.checked)} /> Hiện số trang</label>
        <label><input type="checkbox" checked={right} disabled={!showPages} onChange={(e) => setRight(e.target.checked)} /> Căn phải số trang</label>
      </div>
      <div className="form-section-title">Xem trước</div>
      <ListPreview title={showTitle ? title : ''} rows={sample} showPages={showPages} right={right} leader={leader} />
    </Modal>
  );
}

function FootnotesDialog({ onClose }: DialogProps) {
  const ctx = useDoc();
  const { editor, page, setPage, ui } = ctx;
  const counts = useMemo(() => {
    const notes = findNodes(editor, ['footnote']);
    return { foot: notes.filter(({ node }) => node.attrs.kind !== 'end').length, end: notes.filter(({ node }) => node.attrs.kind === 'end').length };
  }, [editor]);
  const [kind, setKind] = useState<'foot' | 'end'>('foot');
  const [foot, setFoot] = useState<NoteFormat>(page.footnoteFormat ?? 'decimal');
  const [end, setEnd] = useState<NoteFormat>(page.endnoteFormat ?? 'lower-roman');
  const [start, setStart] = useState(page.footnoteStart ?? 1);
  const [restart, setRestart] = useState<'continuous' | 'page'>(page.footnoteRestart ?? 'continuous');
  const convert = (mode: 'to-end' | 'to-foot' | 'swap') => {
    const changed = convertNotes(ctx, mode);
    ui.toast(changed ? `Đã chuyển ${changed} chú thích` : 'Không có chú thích nào để chuyển');
    onClose();
  };
  const apply = () => {
    setPage({ footnoteFormat: foot, endnoteFormat: end, footnoteStart: start, footnoteRestart: restart });
    onClose();
  };
  return (
    <Modal title="Chú thích" subtitle={`Tài liệu có ${counts.foot} chú thích cuối trang và ${counts.end} chú thích cuối tài liệu.`} icon={<FileText size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="outline-tabs refs-tabs" role="tablist">
        <button role="tab" aria-selected={kind === 'foot'} className={kind === 'foot' ? 'on' : ''} onClick={() => setKind('foot')}>Cuối trang</button>
        <button role="tab" aria-selected={kind === 'end'} className={kind === 'end' ? 'on' : ''} onClick={() => setKind('end')}>Cuối tài liệu</button>
      </div>
      {kind === 'foot' ? (
        <div className="form-grid">
          <label className="field"><span className="field-label">Vị trí</span><select className="text-field" value="page" onChange={(e) => e.target.value === 'document' && convert('to-end')}><option value="page">Cuối mỗi trang</option><option value="document">Chuyển hết về cuối tài liệu</option></select></label>
          <label className="field"><span className="field-label">Kiểu số</span><select className="text-field" value={foot} onChange={(e) => setFoot(e.target.value as NoteFormat)}>{NOTE_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Bắt đầu từ</span><input className="text-field" type="number" min={1} value={start} disabled={restart === 'page'} onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))} /></label>
          <label className="field"><span className="field-label">Đánh số</span><select className="text-field" value={restart} onChange={(e) => setRestart(e.target.value as 'continuous' | 'page')}><option value="continuous">Liên tục</option><option value="page">Đánh lại mỗi trang</option></select></label>
        </div>
      ) : (
        <div className="form-grid">
          <label className="field"><span className="field-label">Vị trí</span><select className="text-field" value="document" onChange={(e) => e.target.value === 'page' && convert('to-foot')}><option value="document">Cuối tài liệu</option><option value="page">Chuyển hết về cuối mỗi trang</option></select></label>
          <label className="field"><span className="field-label">Kiểu số</span><select className="text-field" value={end} onChange={(e) => setEnd(e.target.value as NoteFormat)}>{NOTE_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select></label>
        </div>
      )}
      <div className="form-section-title">Chuyển đổi</div>
      <div className="form-actions refs-actions">
        <button className="btn" onClick={() => convert('to-end')}>Mọi chú thích thành cuối tài liệu</button>
        <button className="btn" onClick={() => convert('to-foot')}>Mọi chú thích thành cuối trang</button>
        <button className="btn" onClick={() => convert('swap')}>Đổi chỗ hai loại</button>
      </div>
    </Modal>
  );
}

function TableOfFiguresDialog({ onClose }: DialogProps) {
  const { editor } = useDoc();
  const labels = useMemo(() => [...new Set(findNodes(editor, ['paragraph']).map(({ node }) => node.attrs.captionKind).filter(Boolean).map(String))], [editor]);
  const [kind, setKind] = useState('all');
  const [showPages, setShowPages] = useState(true);
  const [right, setRight] = useState(true);
  const [leader, setLeader] = useState<Leader>('dots');
  const [title, setTitle] = useState('DANH MỤC HÌNH, BẢNG');
  const insert = () => {
    editor.chain().focus().insertDocList('figureList', { captionKind: kind === 'all' ? null : kind, showPages, rightAlign: right, leader, titleText: title.trim() || 'DANH MỤC HÌNH, BẢNG' }).run();
    onClose();
  };
  const rows = [{ text: `${kind === 'all' ? 'Hình' : kind} 1: Nội dung nhãn`, indent: 0, page: '2' }, { text: `${kind === 'all' ? 'Bảng' : kind} 2: Nội dung nhãn`, indent: 0, page: '4' }];
  return (
    <Modal title="Danh mục hình" subtitle={labels.length ? undefined : 'Chưa có nhãn nào. Danh mục sẽ tự có nội dung khi anh chị thêm nhãn.'} icon={<Images size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Nhãn</span><select className="text-field" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Mọi nhãn</option>{labels.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
        <label className="field"><span className="field-label">Tiêu đề</span><input className="text-field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <LeaderField value={leader} onChange={setLeader} disabled={!showPages || !right} />
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={showPages} onChange={(e) => setShowPages(e.target.checked)} /> Hiện số trang</label>
        <label><input type="checkbox" checked={right} disabled={!showPages} onChange={(e) => setRight(e.target.checked)} /> Căn phải số trang</label>
      </div>
      <div className="form-section-title">Xem trước</div>
      <ListPreview title={title} rows={rows} showPages={showPages} right={right} leader={leader} />
    </Modal>
  );
}

function InsertIndexDialog({ onClose }: DialogProps) {
  const { editor } = useDoc();
  const [columns, setColumns] = useState(2);
  const [right, setRight] = useState(false);
  const [leader, setLeader] = useState<Leader>('dots');
  const [title, setTitle] = useState('CHỈ MỤC');
  const count = useMemo(() => findNodes(editor, ['indexEntry']).length, [editor]);
  const insert = () => {
    editor.chain().focus().insertDocList('docIndex', { columns, rightPages: right, rightAlign: right, leader, titleText: title.trim() || 'CHỈ MỤC' }).run();
    onClose();
  };
  return (
    <Modal title="Chèn chỉ mục" subtitle={`Đã đánh dấu ${count} mục trong tài liệu.`} icon={<IndentIncrease size={20} />} onClose={onClose} width={500} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Số cột</span><input className="text-field" type="number" min={1} max={4} value={columns} onChange={(e) => setColumns(Math.max(1, Math.min(4, Number(e.target.value) || 1)))} /></label>
        <label className="field"><span className="field-label">Tiêu đề</span><input className="text-field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <LeaderField value={leader} onChange={setLeader} disabled={!right} />
      </div>
      <div className="check-row"><label><input type="checkbox" checked={right} onChange={(e) => setRight(e.target.checked)} /> Căn phải số trang</label></div>
    </Modal>
  );
}

function MarkCitationDialog({ onClose }: DialogProps) {
  const ctx = useDoc();
  const { editor, ui } = ctx;
  const selected = useMemo(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ').trim();
  }, [editor]);
  const [text, setText] = useState(selected);
  const [short, setShort] = useState(selected.slice(0, 60));
  const [category, setCategory] = useState(AUTHORITY_CATEGORIES[1]);
  const mark = (all: boolean) => {
    const count = insertAuthority(ctx, { text: text.trim(), short: short.trim(), category }, all);
    ui.toast(all ? `Đã đánh dấu ${count} vị trí` : 'Đã đánh dấu viện dẫn');
    onClose();
  };
  return (
    <Modal title="Đánh dấu viện dẫn" subtitle="Đánh dấu tên luật, nghị định, án lệ để đưa vào danh mục." icon={<Scale size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn" disabled={!text.trim()} onClick={() => mark(true)}>Đánh dấu tất cả</button><button className="btn btn-primary" disabled={!text.trim()} onClick={() => mark(false)}>Đánh dấu</button></>}>
      <label className="field"><span className="field-label">Tên đầy đủ</span><textarea className="text-field" rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Tên rút gọn</span><input className="text-field" value={short} onChange={(e) => setShort(e.target.value)} /></label>
        <label className="field"><span className="field-label">Loại</span><select className="text-field" value={category} onChange={(e) => setCategory(e.target.value)}>{AUTHORITY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
    </Modal>
  );
}

function ToaDialog({ onClose }: DialogProps) {
  const { editor } = useDoc();
  const [category, setCategory] = useState('all');
  const [passim, setPassim] = useState(true);
  const [right, setRight] = useState(true);
  const [leader, setLeader] = useState<Leader>('dots');
  const [title, setTitle] = useState('DANH MỤC VĂN BẢN VIỆN DẪN');
  const count = useMemo(() => findNodes(editor, ['authorityEntry']).length, [editor]);
  const insert = () => {
    editor.chain().focus().insertDocList('authorityList', { category, passim, rightAlign: right, leader, titleText: title.trim() || 'DANH MỤC VĂN BẢN VIỆN DẪN' }).run();
    onClose();
  };
  return (
    <Modal title="Danh mục viện dẫn" subtitle={`Đã đánh dấu ${count} viện dẫn trong tài liệu.`} icon={<ListChecks size={20} />} onClose={onClose} width={520} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Loại</span><select className="text-field" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Mọi loại, chia theo nhóm</option>{AUTHORITY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span className="field-label">Tiêu đề</span><input className="text-field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <LeaderField value={leader} onChange={setLeader} disabled={!right} />
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={passim} onChange={(e) => setPassim(e.target.checked)} /> Ghi “passim” khi xuất hiện từ 5 trang trở lên</label>
        <label><input type="checkbox" checked={right} onChange={(e) => setRight(e.target.checked)} /> Căn phải số trang</label>
      </div>
    </Modal>
  );
}

function SourcesDialog({ onClose }: DialogProps) {
  const { editor, page, setPage, ui } = useDoc();
  const [parsed, setParsed] = useState<Omit<CitationSource, 'id'>[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');
  const current = page.sources ?? [];
  const load = async () => {
    const file = await pickFile('.bib,.bibtex,.ris,.txt');
    if (!file) return;
    const list = parseSourcesFile(file.name, await file.text());
    setFileName(file.name);
    setParsed(list);
    setPicked(new Set(list.map((_, index) => index)));
    if (!list.length) ui.toast('Không tìm thấy nguồn nào trong tệp này', true);
  };
  const add = () => {
    const known = new Set(current.map((source) => source.title.trim().toLowerCase()));
    const fresh = parsed.filter((source, index) => picked.has(index) && !known.has(source.title.trim().toLowerCase())).map((source) => ({ ...source, id: newId('src') }));
    const next = [...current, ...fresh];
    setPage({ sources: next });
    setRefs(editor, next, page.citationStyle ?? 'apa');
    ui.toast(`Đã thêm ${fresh.length} nguồn. Bỏ qua ${picked.size - fresh.length} nguồn trùng tên.`);
    onClose();
  };
  const exportFile = () => {
    if (!current.length) return ui.toast('Tài liệu chưa có nguồn nào', true);
    downloadBlob(new Blob([exportBibtex(current)], { type: 'text/plain;charset=utf-8' }), 'nguon-tham-khao.bib');
  };
  const toggle = (index: number) => setPicked((set) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });
  return (
    <Modal title="Đổi nguồn cấp trích dẫn" subtitle={fileName ? `${fileName}: ${parsed.length} nguồn` : 'Nhập nguồn từ Zotero, EndNote, Mendeley qua tệp BibTeX (.bib) hoặc RIS (.ris).'} icon={<FolderInput size={20} />} onClose={onClose} width={680} actions={<><button className="btn" onClick={exportFile}><Download size={14} /> Xuất BibTeX</button><button className="btn" onClick={() => void load()}><Upload size={14} /> Chọn tệp</button><span className="spacer" /><button className="btn" onClick={onClose}>Đóng</button><button className="btn btn-primary" disabled={!picked.size} onClick={add}>Thêm {picked.size} nguồn</button></>}>
      {parsed.length === 0 ? <div className="empty-note">Tài liệu hiện có {current.length} nguồn. Chọn tệp để thêm.</div> : (
        <div className="version-list">
          {parsed.map((source, index) => (
            <label key={index} className="version-row refs-source-row">
              <input type="checkbox" checked={picked.has(index)} onChange={() => toggle(index)} />
              <span className="source-text"><strong>{source.title}</strong><span className="muted"> {source.authors || 'Không rõ tác giả'} · {source.year || 'k.n.'}</span></span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function TrackOptionsDialog({ onClose }: DialogProps) {
  const { page, setPage, view, setView } = useDoc();
  const [insertion, setInsertion] = useState(page.trackColors?.insertion ?? '#1e7b34');
  const [deletion, setDeletion] = useState(page.trackColors?.deletion ?? '#b3261e');
  const [comments, setComments] = useState(view.markupComments);
  const [insDel, setInsDel] = useState(view.markupInsDel);
  const [formatting, setFormatting] = useState(view.markupFormatting);
  const apply = () => {
    setPage({ trackColors: { insertion, deletion } });
    setView({ markupComments: comments, markupInsDel: insDel, markupFormatting: formatting });
    onClose();
  };
  return (
    <Modal title="Tuỳ chọn Theo dõi thay đổi" icon={<PencilLine size={20} />} onClose={onClose} width={520} actions={<><button className="btn" onClick={() => { setInsertion('#1e7b34'); setDeletion('#b3261e'); }}>Về mặc định</button><span className="spacer" /><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Màu phần chèn</span><input className="text-field color-field" type="color" value={insertion} onChange={(e) => setInsertion(e.target.value)} /></label>
        <label className="field"><span className="field-label">Màu phần xoá</span><input className="text-field color-field" type="color" value={deletion} onChange={(e) => setDeletion(e.target.value)} /></label>
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={comments} onChange={(e) => setComments(e.target.checked)} /> Hiện bình luận</label>
        <label><input type="checkbox" checked={insDel} onChange={(e) => setInsDel(e.target.checked)} /> Hiện chèn và xoá</label>
        <label><input type="checkbox" checked={formatting} onChange={(e) => setFormatting(e.target.checked)} /> Hiện định dạng</label>
      </div>
      <div className="form-section-title">Xem trước</div>
      <div className="refs-track-preview">Văn bản giữ nguyên <span style={{ color: insertion, textDecoration: 'underline' }}>phần được chèn</span> <span style={{ color: deletion, textDecoration: 'line-through' }}>phần bị xoá</span>.</div>
    </Modal>
  );
}

function MarkupFilterDialog({ onClose }: DialogProps) {
  const ctx = useDoc();
  const { view, setView } = ctx;
  const authors = changeAuthors(ctx);
  const [author, setAuthor] = useState(view.markupAuthor ?? '');
  const [comments, setComments] = useState(view.markupComments);
  const [insDel, setInsDel] = useState(view.markupInsDel);
  const [formatting, setFormatting] = useState(view.markupFormatting);
  const apply = () => {
    setView({ markupAuthor: author || null, markupComments: comments, markupInsDel: insDel, markupFormatting: formatting });
    onClose();
  };
  return (
    <Modal title="Lọc đánh dấu" subtitle="Chỉ hiện và chỉ duyệt các thay đổi khớp bộ lọc." icon={<Filter size={20} />} onClose={onClose} width={460} actions={<><button className="btn" onClick={() => { setAuthor(''); setComments(true); setInsDel(true); setFormatting(true); }}>Xoá bộ lọc</button><span className="spacer" /><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <label className="field"><span className="field-label">Người sửa</span><select className="text-field" value={author} onChange={(e) => setAuthor(e.target.value)}><option value="">Mọi người</option>{authors.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <div className="check-row">
        <label><input type="checkbox" checked={insDel} onChange={(e) => setInsDel(e.target.checked)} /> Chèn và xoá</label>
        <label><input type="checkbox" checked={formatting} onChange={(e) => setFormatting(e.target.checked)} /> Định dạng</label>
        <label><input type="checkbox" checked={comments} onChange={(e) => setComments(e.target.checked)} /> Bình luận</label>
      </div>
    </Modal>
  );
}

function ReadabilityDialog({ onClose }: DialogProps) {
  const { editor } = useDoc();
  const report = useMemo(() => {
    const { from, to, empty } = editor.state.selection;
    return readabilityReport(empty ? editor.getText({ blockSeparator: '\n' }) : editor.state.doc.textBetween(from, to, '\n'));
  }, [editor]);
  const number = (value: number, digits = 1) => value.toLocaleString('vi-VN', { maximumFractionDigits: digits });
  const rows: [string, string][] = [
    ['Số từ', number(report.words, 0)], ['Số ký tự, kể cả dấu cách', number(report.chars, 0)], ['Số ký tự, không kể dấu cách', number(report.charsNoSpaces, 0)], ['Số đoạn', number(report.paragraphs, 0)], ['Số câu', number(report.sentences, 0)],
    ['Số câu mỗi đoạn', number(report.sentencesPerParagraph)], ['Số từ mỗi câu', number(report.wordsPerSentence)], ['Số ký tự mỗi từ', number(report.charsPerWord)],
    ['Câu bị động', `${report.passive}%`], ['Điểm dễ đọc Flesch', number(report.ease)], ['Cấp lớp Flesch-Kincaid', number(report.grade)],
  ];
  return (
    <Modal title="Thống kê độ dễ đọc" subtitle="Tính trên đoạn đang chọn, hoặc cả tài liệu nếu chưa chọn. Công thức Flesch vốn dành cho tiếng Anh nên chỉ để tham khảo với tiếng Việt." icon={<BookOpenCheck size={20} />} onClose={onClose} width={480} actions={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      <table className="refs-stats"><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
    </Modal>
  );
}

function CombineDialog({ onClose }: DialogProps) {
  const ctx = useDoc();
  const { editor, ui, setView } = ctx;
  const [author, setAuthor] = useState('Bản được gộp');
  const [result, setResult] = useState<{ insertions: number; deletions: number } | null>(null);
  const run = async () => {
    const file = await pickFile('.docx,.txt,.md,.html,.htm');
    if (!file) return;
    try {
      ui.showBusy(`Đang gộp ${file.name}…`);
      const lower = file.name.toLowerCase();
      const text = lower.endsWith('.docx') ? htmlToText(await docxToHtml(await file.arrayBuffer()), editor) : lower.endsWith('.html') || lower.endsWith('.htm') ? htmlToText(await file.text(), editor) : await file.text();
      const counts = combineAsTrackedChanges(editor, text, author.trim() || file.name);
      setResult(counts);
      setView({ reviewPane: 'vertical', markup: 'all', markupInsDel: true });
    } catch {
      ui.toast('Không đọc được tệp để gộp', true);
    } finally {
      ui.showBusy(null);
    }
  };
  return (
    <Modal title="Gộp thay đổi từ tệp khác" subtitle="Khác biệt về chữ được đánh dấu thành thay đổi theo dõi ở mức từng từ để anh chị chấp nhận hoặc từ chối. Định dạng, ảnh và bảng của tệp kia không được gộp." icon={<FileStack size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Đóng</button><button className="btn btn-primary" onClick={() => void run()}><Upload size={14} /> Chọn tệp và gộp</button></>}>
      <label className="field"><span className="field-label">Ghi tên người sửa là</span><input className="text-field" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
      {result && <div className="empty-note"><Check size={14} /> Đã gộp: {result.insertions} chỗ chèn, {result.deletions} chỗ xoá.</div>}
    </Modal>
  );
}

const DIALOGS: Partial<Record<DialogId, (props: DialogProps) => React.ReactNode>> = {
  toc: TocDialog,
  footnotes: FootnotesDialog,
  tableoffigures: TableOfFiguresDialog,
  insertindex: InsertIndexDialog,
  markcitation: MarkCitationDialog,
  toa: ToaDialog,
  sources: SourcesDialog,
  trackoptions: TrackOptionsDialog,
  markupfilter: MarkupFilterDialog,
  readability: ReadabilityDialog,
  combine: CombineDialog,
};

export default function ReviewExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  const Dialog = dialog ? DIALOGS[dialog] : undefined;
  return Dialog ? <Dialog onClose={onClose} /> : null;
}

const wordAtCaret = (editor: Editor) => {
  const { selection, doc } = editor.state;
  const { from, to, empty, $from } = selection;
  if (!empty) return { word: doc.textBetween(from, to, ' ').trim(), from, to };
  if (!$from.parent.isTextblock) return { word: '', from, to };
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, '￼');
  const offset = $from.parentOffset;
  let start = offset;
  let end = offset;
  while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) start--;
  while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
  const base = $from.pos - offset;
  const word = text.slice(start, end);
  if (word) {
    const after = /^\s+([\p{L}\p{N}]+)/u.exec(text.slice(end));
    if (after && thesaurusLookup(`${word} ${after[1]}`)) return { word: `${word} ${after[1]}`, from: base + start, to: base + end + after[0].length };
    const before = /([\p{L}\p{N}]+)\s+$/u.exec(text.slice(0, start));
    if (before && thesaurusLookup(`${before[1]} ${word}`)) return { word: `${before[1]} ${word}`, from: base + start - before[0].length, to: base + end };
  }
  return { word, from: base + start, to: base + end };
};

function ThesaurusPanel() {
  const { editor, setView, ui } = useDoc();
  const [target, setTarget] = useState(() => wordAtCaret(editor));
  const [query, setQuery] = useState(target.word);
  const [aiList, setAiList] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    void describeProvider().then((name) => setHasProvider(!name.includes('cục bộ')));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    const onSelection = () => {
      const next = wordAtCaret(editor);
      if (!next.word) return;
      setTarget(next);
      setQuery(next.word);
      setAiList(null);
    };
    editor.on('selectionUpdate', onSelection);
    return () => { editor.off('selectionUpdate', onSelection); };
  }, [editor]);
  const local = thesaurusLookup(query);
  const list = [...new Set([...(local ?? []), ...(aiList ?? [])])];
  const replace = (synonym: string) => {
    const matchesTarget = target.word && target.word.toLocaleLowerCase('vi') === query.trim().toLocaleLowerCase('vi') && editor.state.doc.textBetween(target.from, Math.min(target.to, editor.state.doc.content.size), ' ').trim() === target.word;
    if (!matchesTarget) {
      editor.chain().focus().insertContent(synonym).run();
      return;
    }
    const text = matchCase(target.word, synonym);
    editor.view.dispatch(editor.state.tr.insertText(text, target.from, target.to));
    editor.commands.focus();
    const next = { word: text, from: target.from, to: target.from + text.length };
    setTarget(next);
    setQuery(text);
    setAiList(null);
    ui.toast(`Đã thay bằng “${text}”`);
  };
  const askAi = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      const output = await runAi('custom', query, 'List up to 12 synonyms for the word or phrase below, in the same language. Reply with one synonym per line and nothing else.', () => undefined, controller.signal);
      setAiList(output.split('\n').map((line) => line.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 12));
    } catch (error) {
      if (!controller.signal.aborted) ui.toast((error as Error).message || '23 AI chưa trả lời được', true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="doc-comments" aria-label="Từ đồng nghĩa">
      <div className="panel-head"><span><BookMarked size={14} /> Từ đồng nghĩa</span><button className="icon-btn" aria-label="Đóng" onClick={() => setView({ sidePanel: null })}><X size={14} /></button></div>
      <div className="refs-panel-body">
        <div className="find-row"><input className="text-field" aria-label="Từ cần tra" placeholder="Nhập từ cần tra" value={query} onChange={(e) => { setQuery(e.target.value); setAiList(null); }} /><Search size={14} /></div>
        {list.length > 0 ? (
          <div className="thesaurus-list">
            {list.map((item) => <button key={item} type="button" className="thesaurus-item" title={`Thay bằng “${item}”`} onClick={() => replace(item)}>{item}</button>)}
          </div>
        ) : <div className="panel-empty">{query.trim() ? `Từ điển trong máy chưa có “${query.trim()}”.` : 'Đặt con trỏ vào một từ hoặc nhập từ cần tra.'}</div>}
        {query.trim() && (hasProvider ? (
          <button className="btn" disabled={busy} onClick={() => void askAi()}><Sparkles size={13} /> {busy ? 'Đang hỏi 23 AI…' : 'Hỏi thêm 23 AI'}</button>
        ) : <div className="panel-empty">Nhập API key trong 23 AI để tra thêm các từ ngoài từ điển.</div>)}
      </div>
    </aside>
  );
}

function RestrictPanel() {
  const ctx = useDoc();
  const { editor, page, setView, ui } = ctx;
  const [mode, setMode] = useState<'readonly' | 'tracked' | 'comments'>(page.protectMode ?? 'readonly');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const protectedDoc = Boolean(page.protectHash);
  const labels = { readonly: 'Chỉ xem', tracked: 'Chỉ sửa khi có theo dõi thay đổi', comments: 'Chỉ bình luận' };
  const start = async () => {
    if (!password) return setError('Hãy nhập mật khẩu');
    if (password !== confirm) return setError('Hai mật khẩu không khớp');
    setError('');
    await startProtection(ctx, mode, password);
    setPassword('');
    setConfirm('');
  };
  const stop = async () => {
    if (await stopProtection(ctx, password)) {
      setPassword('');
      setError('');
    } else {
      setError('Mật khẩu không đúng');
    }
  };
  const locks = countLocked(editor);
  return (
    <aside className="doc-comments" aria-label="Hạn chế chỉnh sửa">
      <div className="panel-head"><span><ShieldCheck size={14} /> Hạn chế chỉnh sửa</span><button className="icon-btn" aria-label="Đóng" onClick={() => setView({ sidePanel: null })}><X size={14} /></button></div>
      <div className="refs-panel-body">
        {protectedDoc ? (
          <>
            <div className="refs-status"><Lock size={13} /> Đang bật: {labels[page.protectMode ?? 'readonly']}</div>
            <label className="field"><span className="field-label">Mật khẩu để bỏ hạn chế</span><input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void stop()} /></label>
            <button className="btn btn-primary" onClick={() => void stop()}>Bỏ hạn chế</button>
          </>
        ) : (
          <>
            <label className="field"><span className="field-label">Cho phép người khác</span><select className="text-field" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>{(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
            <label className="field"><span className="field-label">Mật khẩu</span><input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="field"><span className="field-label">Nhập lại mật khẩu</span><input className="text-field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void start()} /></label>
            <button className="btn btn-primary" onClick={() => void start()}>Bắt đầu hạn chế</button>
          </>
        )}
        {error && <div className="refs-error" role="alert">{error}</div>}
        <div className="form-section-title">Đoạn đã khoá</div>
        <div className="panel-empty">{locks ? `${locks} đoạn đang khoá.` : 'Chưa có đoạn nào bị khoá.'}</div>
        <div className="panel-row">
          <button className="btn" onClick={() => setLocked(ctx, true)}>Khoá đoạn chọn</button>
          <button className="btn" disabled={!locks} onClick={() => { setLocked(ctx, false, true); ui.toast('Đã mở khoá mọi đoạn'); }}>Mở khoá hết</button>
        </div>
      </div>
    </aside>
  );
}

function ReviewPane() {
  const ctx = useDoc();
  const { editor, view, setView, comments } = ctx;
  const version = useEditorState({ editor, selector: ({ editor: e }) => e.state.doc });
  const changes = useMemo(() => visibleChanges(editor, view), [editor, view, version]);
  const all = useMemo(() => collectChanges(version), [version]);
  const shownComments = view.markupComments ? comments.filter((comment) => !comment.resolved && (!view.markupAuthor || comment.author === view.markupAuthor)) : [];
  const select = (from: number, to: number) => editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
  const labels = { insertion: 'Đã chèn', deletion: 'Đã xoá', format: 'Định dạng' };
  const horizontal = view.reviewPane === 'horizontal';
  return (
    <aside className={`doc-comments review-pane ${horizontal ? 'horizontal' : ''}`} aria-label="Khung xem lại">
      <div className="panel-head">
        <span className="review-pane-title">
          <span><FileDiff size={14} /> Khung xem lại · {changes.length + shownComments.length} mục</span>
          <span className="review-summary">{all.filter((c) => c.kind === 'insertion').length} chèn · {all.filter((c) => c.kind === 'deletion').length} xoá · {all.filter((c) => c.kind === 'format').length} định dạng · {comments.length} bình luận</span>
        </span>
        <button className="icon-btn" aria-label="Đóng" onClick={() => setView({ reviewPane: 'none' })}><X size={14} /></button>
      </div>
      <div className="comments-list">
        {changes.length + shownComments.length === 0 && <div className="panel-empty">Không có mục nào khớp bộ lọc đánh dấu.</div>}
        {changes.map((change) => (
          <div key={change.id} className={`comment-card change-${change.kind}`} onClick={() => select(change.from, change.to)}>
            <div className="comment-card-top">
              <span className="change-kind">{change.label ?? labels[change.kind]}</span>
              <div className="comment-tools">
                <button className="icon-btn" title="Chấp nhận" aria-label="Chấp nhận" onClick={(e) => { e.stopPropagation(); editor.chain().acceptChange(change).run(); }}><Check size={13} /></button>
                <button className="icon-btn" title="Từ chối" aria-label="Từ chối" onClick={(e) => { e.stopPropagation(); editor.chain().rejectChange(change).run(); }}><X size={13} /></button>
              </div>
            </div>
            <div className="comment-text">“{change.text.slice(0, 160) || '(đối tượng)'}”</div>
            <div className="muted">{change.author}{change.date ? ` · ${new Date(change.date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</div>
          </div>
        ))}
        {shownComments.map((comment) => (
          <div key={comment.id} className="comment-card" onClick={() => { ctx.setActiveCommentId(comment.id); setView({ sidePanel: 'comments' }); }}>
            <div className="comment-card-top"><span className="change-kind"><MessageSquare size={12} /> Bình luận</span></div>
            <div className="comment-text">{comment.text}</div>
            <div className="muted">{comment.author}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CommentsRail() {
  const ctx = useDoc();
  const { editor, comments, view } = ctx;
  const rail = useRef<HTMLElement | null>(null);
  const open = comments.filter((comment) => !comment.resolved && (!view.markupAuthor || comment.author === view.markupAuthor));
  useLayoutEffect(() => {
    const place = () => {
      const host = rail.current;
      if (!host) return;
      const top = host.getBoundingClientRect().top;
      let cursor = 8;
      host.querySelectorAll<HTMLElement>('[data-rail-id]').forEach((card) => {
        const anchor = editor.view.dom.querySelector(`[data-comment-id="${CSS.escape(card.dataset.railId ?? '')}"]`);
        const wanted = anchor ? anchor.getBoundingClientRect().top - top : cursor;
        const y = Math.max(cursor, wanted);
        card.style.top = `${y}px`;
        cursor = y + card.offsetHeight + 8;
      });
    };
    place();
    const canvas = document.querySelector('.doc-canvas');
    canvas?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    editor.on('update', place);
    return () => {
      canvas?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
      editor.off('update', place);
    };
  });
  const focus = (id: string) => {
    ctx.setActiveCommentId(id);
    const anchor = editor.view.dom.querySelector(`[data-comment-id="${CSS.escape(id)}"]`);
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const resolve = (id: string) => ctx.setComments((items) => items.map((item) => (item.id === id ? { ...item, resolved: true } : item)));
  return (
    <aside ref={rail} className="comments-rail" aria-label="Bình luận theo vị trí">
      {open.length === 0 && <div className="panel-empty">Chưa có bình luận đang mở.</div>}
      {open.map((comment) => (
        <div key={comment.id} data-rail-id={comment.id} className={`rail-card ${ctx.activeCommentId === comment.id ? 'active' : ''}`} onClick={() => focus(comment.id)}>
          <div className="rail-head"><strong>{comment.author}</strong><span className="comment-tools"><button className="icon-btn" title="Đánh dấu đã giải quyết" aria-label="Giải quyết" onClick={(e) => { e.stopPropagation(); resolve(comment.id); }}><Check size={12} /></button><button className="icon-btn" title="Xoá bình luận" aria-label="Xoá" onClick={(e) => { e.stopPropagation(); editor.chain().unsetCommentById(comment.id).run(); ctx.setComments((items) => items.filter((item) => item.id !== comment.id)); }}><Trash2 size={12} /></button></span></div>
          <div className="rail-text">{comment.text}</div>
          {(comment.replies?.length ?? 0) > 0 && <div className="muted">{comment.replies?.length} trả lời</div>}
        </div>
      ))}
    </aside>
  );
}

const cssValue = (value: string) => JSON.stringify(value);

function MarkupStyles() {
  const { comments, view } = useDoc();
  const author = view.markupAuthor;
  if (!author) return null;
  const others = comments.filter((comment) => comment.author !== author).map((comment) => `.doc-editor .tiptap [data-comment-id=${cssValue(comment.id)}] { background: none; border: 0; }`).join('\n');
  const css = `.doc-editor .tiptap ins.track-insertion:not([data-author=${cssValue(author)}]) { color: inherit; background: none; text-decoration: none; }
.doc-editor .tiptap del.track-deletion:not([data-author=${cssValue(author)}]) { display: none; }
.doc-editor .tiptap .track-format:not([data-author=${cssValue(author)}]) { border-bottom: 0; }
${others}`;
  return <style>{css}</style>;
}

export function ReviewPanels() {
  const ctx = useDoc();
  const { editor, page, view, setView, setPage } = ctx;
  const everyoneApplied = useRef(false);
  useEffect(() => {
    const dom = editor.view.dom;
    dom.dataset.markup = view.markup;
    dom.dataset.markupComments = view.markupComments ? 'on' : 'off';
    dom.dataset.markupInsdel = view.markupInsDel ? 'on' : 'off';
    dom.dataset.markupFormatting = view.markupFormatting ? 'on' : 'off';
  }, [editor, view.markup, view.markupComments, view.markupInsDel, view.markupFormatting]);
  useEffect(() => {
    const dom = editor.view.dom;
    dom.style.setProperty('--track-ins', page.trackColors?.insertion ?? '#1e7b34');
    dom.style.setProperty('--track-del', page.trackColors?.deletion ?? '#b3261e');
  }, [editor, page.trackColors]);
  useEffect(() => {
    const refs = getRefs(editor);
    refs.notes = { foot: page.footnoteFormat ?? 'decimal', start: page.footnoteStart ?? 1, restart: page.footnoteRestart ?? 'continuous', end: page.endnoteFormat ?? 'lower-roman' };
    refreshNoteNumbers(editor);
    refs.listeners.forEach((listener) => listener());
    getPagination(editor).listeners.forEach((listener) => listener(getPagination(editor).result));
  }, [editor, page.footnoteFormat, page.footnoteStart, page.footnoteRestart, page.endnoteFormat]);
  useEffect(() => {
    if (trackLocked(ctx) && !page.protectHash && view.editMode !== 'suggesting') {
      setView({ editMode: 'suggesting' });
      ctx.ui.toast('Theo dõi thay đổi đang bị khoá', true);
    }
    if (page.protectHash && page.protectMode === 'tracked' && view.editMode !== 'suggesting') setView({ editMode: 'suggesting' });
    if (!page.protectHash && page.protectMode) setPage({ protectMode: undefined });
  }, [view.editMode, page.trackLock, page.protectHash, page.protectMode]);
  useEffect(() => {
    if (everyoneApplied.current) return;
    everyoneApplied.current = true;
    if (page.trackLock === TRACK_EVERYONE && !page.protectHash) setView({ editMode: 'suggesting' });
  }, [page.trackLock, page.protectHash, setView]);
  return (
    <>
      <MarkupStyles />
      {view.sidePanel === 'thesaurus' && <ThesaurusPanel />}
      {view.sidePanel === 'restrict' && <RestrictPanel />}
      {view.reviewPane !== 'none' && <ReviewPane />}
      {view.commentsMode === 'contextual' && view.markupComments && view.sidePanel !== 'comments' && view.viewMode !== 'read' && <CommentsRail />}
    </>
  );
}
