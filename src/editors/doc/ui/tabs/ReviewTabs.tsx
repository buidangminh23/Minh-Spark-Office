import { Accessibility, BookMarked, BookOpenCheck, Check, CheckCheck, ChevronLeft, ChevronRight, Database, Eye, EyeOff, FileDiff, FilePlus2, FileStack, FileText, FolderInput, Gauge, Globe, Images, IndentIncrease, Languages, Library, Link2, ListChecks, ListPlus, ListTree, Lock, LockOpen, MessageSquare, MessageSquarePlus, MessageSquareX, PanelBottom, PanelRight, PencilLine, Pencil, Quote, RefreshCw, Scale, ScrollText, SpellCheck, StickyNote, Tag, Trash2, Volume2, VolumeX, Wand2, X, XCircle, Calculator, Download, ShieldCheck, Filter, UserX } from 'lucide-react';
import { useDoc, type MarkupMode } from '../../DocContext';
import { addComment, imageSettings, insertFootnote } from '../../actions';
import { insertEndnote } from '../../actionsExtra';
import type { CitationStyle } from '../../../../lib/storage';
import { finishMerge } from '../MailMerge';
import { addPlaceholderSource, insertCaptionPrompt, insertManualToc, jumpNote, markEntryPrompt, removeToc, setTocLevel, showNotes, updateAuthorities, updateFigures, updateIndex, updateTocPrompt } from '../../refsActions';
import { TRACK_EVERYONE, changeAuthors, countLocked, deleteComments, jumpChange, jumpComment, resolveAll, resolveCurrent, resolveShown, setLocked, setTrackScope, toggleTrackLock, trackLocked } from '../../reviewActions';
import { Big, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Rows, Small } from '../RibbonParts';

const CITATION_STYLES: CitationStyle[] = ['apa', 'ieee', 'chicago', 'mla', 'vancouver'];
const PROOF_LANGUAGES = [{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'Tiếng Anh' }, { value: 'fr', label: 'Tiếng Pháp' }, { value: 'zh', label: 'Tiếng Trung' }, { value: 'ja', label: 'Tiếng Nhật' }, { value: 'ko', label: 'Tiếng Hàn' }];
const MARKUP_MODES: { value: MarkupMode; label: string }[] = [{ value: 'simple', label: 'Đánh dấu đơn giản' }, { value: 'all', label: 'Mọi đánh dấu' }, { value: 'none', label: 'Không đánh dấu' }, { value: 'original', label: 'Bản gốc' }];

export function ReferencesTab() {
  const ctx = useDoc();
  const { editor, page } = ctx;
  const chain = () => editor.chain().focus();
  const sources = page.sources ?? [];
  const headingLevel = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? null;
  return (
    <>
      <Group label="Mục lục">
        <Dropdown large title="Mục lục" trigger={<><ListTree size={22} color="#2b579a" /><span>Mục lục</span></>} width={280}>
          {(close) => (
            <>
              <MenuHeading>Tích hợp sẵn</MenuHeading>
              <MenuItem label={<span><strong>Mục lục tự động 1</strong><br /><small>Tiêu đề “Mục lục”, cấp 1 đến 3</small></span>} onClick={() => { close(); chain().insertDocList('tableOfContents', { levels: 3, showPages: true, titleText: 'Mục lục' }).run(); }} />
              <MenuItem label={<span><strong>Mục lục tự động 2</strong><br /><small>Tiêu đề “MỤC LỤC”, cấp 1 đến 2</small></span>} onClick={() => { close(); chain().insertDocList('tableOfContents', { levels: 2, showPages: true, titleText: 'MỤC LỤC' }).run(); }} />
              <MenuItem label={<span><strong>Mục lục thủ công</strong><br /><small>Tự gõ được, không tự cập nhật</small></span>} onClick={() => { close(); insertManualToc(ctx); }} />
              <MenuSeparator />
              <MenuItem icon={<ListPlus size={14} />} label="Mục lục tuỳ chỉnh…" onClick={() => { close(); ctx.openDialog('toc'); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Xoá mục lục" onClick={() => { close(); removeToc(ctx); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Dropdown title="Đưa đoạn đang chọn vào mục lục" trigger={<><ListPlus size={14} /><span>Thêm chữ</span></>}>
            {(close) => (
              <>
                <MenuItem label="Không hiện trong mục lục" active={editor.getAttributes('heading').tocHide === true} onClick={() => { close(); setTocLevel(ctx, null); }} />
                {[1, 2, 3].map((level) => <MenuItem key={level} label={`Cấp ${level}`} active={headingLevel === level && !editor.getAttributes('heading').tocHide} onClick={() => { close(); setTocLevel(ctx, level); }} />)}
              </>
            )}
          </Dropdown>
          <Small icon={<RefreshCw size={14} />} label="Cập nhật mục lục" title="Cập nhật số trang hoặc toàn bộ mục lục" onClick={() => void updateTocPrompt(ctx)} />
        </Rows>
      </Group>

      <Group label="Chú thích" onLauncher={() => ctx.openDialog('footnotes')} launcherTitle="Hộp thoại Chú thích">
        <Big icon={<FileText size={22} color="#107c41" />} label="Chèn chú thích" title="Chèn chú thích cuối trang (Ctrl+Alt+F)" onClick={() => void insertFootnote(ctx)} />
        <Rows>
          <Small icon={<ScrollText size={14} />} label="Chèn chú thích cuối" title="Chèn chú thích ở cuối tài liệu (Ctrl+Alt+D)" onClick={() => void insertEndnote(ctx)} />
          <Dropdown title="Chuyển tới chú thích khác" trigger={<><ChevronRight size={14} /><span>Chú thích sau</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<ChevronRight size={14} />} label="Chú thích cuối trang sau" onClick={() => { close(); jumpNote(ctx, 'foot', 1); }} />
                <MenuItem icon={<ChevronLeft size={14} />} label="Chú thích cuối trang trước" onClick={() => { close(); jumpNote(ctx, 'foot', -1); }} />
                <MenuItem icon={<ChevronRight size={14} />} label="Chú thích cuối tài liệu sau" onClick={() => { close(); jumpNote(ctx, 'end', 1); }} />
                <MenuItem icon={<ChevronLeft size={14} />} label="Chú thích cuối tài liệu trước" onClick={() => { close(); jumpNote(ctx, 'end', -1); }} />
              </>
            )}
          </Dropdown>
          <Small icon={<StickyNote size={14} />} label="Hiện chú thích" title="Cuộn tới vùng chú thích" onClick={() => void showNotes(ctx)} />
        </Rows>
      </Group>

      <Group label="Trích dẫn & thư mục">
        <Dropdown large title="Chèn trích dẫn" trigger={<><Quote size={22} color="#2b579a" /><span>Chèn trích dẫn</span></>} width={320}>
          {(close) => (
            <>
              {sources.length > 0 && <MenuHeading>Nguồn trong tài liệu</MenuHeading>}
              {sources.map((source) => <MenuItem key={source.id} label={<span><strong>{source.authors || 'Không rõ tác giả'}</strong> ({source.year})<br /><small>{source.title}</small></span>} onClick={() => { close(); chain().insertCitation(source.id).run(); }} />)}
              {sources.length > 0 && <MenuSeparator />}
              <MenuItem icon={<FilePlus2 size={14} />} label="Thêm nguồn mới…" onClick={() => { close(); ctx.openDialog('citations'); }} />
              <MenuItem icon={<Pencil size={14} />} label="Thêm nguồn tạm…" onClick={() => { close(); void addPlaceholderSource(ctx); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<Library size={14} />} label="Quản lý nguồn" title="Thêm, sửa, xoá nguồn tham khảo" onClick={() => ctx.openDialog('citations')} />
          <select className="ribbon-select citation-style" aria-label="Kiểu trích dẫn" title="Kiểu trích dẫn" value={page.citationStyle ?? 'apa'} onChange={(e) => ctx.setPage({ citationStyle: e.target.value as CitationStyle })}>
            {CITATION_STYLES.map((style) => <option key={style} value={style}>{style.toUpperCase()}</option>)}
          </select>
          <Dropdown title="Thư mục tài liệu" trigger={<><BookMarked size={14} /><span>Thư mục</span></>} width={260}>
            {(close) => (
              <>
                <MenuItem label="Tài liệu tham khảo" onClick={() => { close(); chain().insertDocList('bibliography', { titleText: 'TÀI LIỆU THAM KHẢO' }).run(); }} />
                <MenuItem label="Danh mục tham khảo" onClick={() => { close(); chain().insertDocList('bibliography', { titleText: 'DANH MỤC THAM KHẢO' }).run(); }} />
                <MenuItem label="Công trình được trích dẫn" onClick={() => { close(); chain().insertDocList('bibliography', { titleText: 'CÔNG TRÌNH ĐƯỢC TRÍCH DẪN' }).run(); }} />
                <MenuItem label="Mọi nguồn, kể cả chưa trích dẫn" onClick={() => { close(); chain().insertDocList('bibliography', { titleText: 'THƯ MỤC', all: true }).run(); }} />
                <MenuSeparator />
                <MenuItem label="Chèn thư mục không có tiêu đề" onClick={() => { close(); chain().insertDocList('bibliography', { showTitle: false }).run(); }} />
              </>
            )}
          </Dropdown>
        </Rows>
        <Small icon={<FolderInput size={14} />} label="Đổi nguồn cấp" title="Nhập nguồn từ tệp BibTeX hoặc RIS, xuất ra BibTeX" onClick={() => ctx.openDialog('sources')} />
      </Group>

      <Group label="Nhãn">
        <Big icon={<Tag size={22} color="#d98e04" />} label="Chèn nhãn" title="Đánh số tự động Hình, Bảng, Biểu đồ" onClick={() => void insertCaptionPrompt(ctx)} />
        <Rows>
          <Small icon={<Images size={14} />} label="Chèn danh mục hình" title="Chèn danh mục theo các nhãn đã đánh" onClick={() => ctx.openDialog('tableoffigures')} />
          <Small icon={<RefreshCw size={14} />} label="Cập nhật danh mục" title="Đánh lại số nhãn và cập nhật danh mục hình" onClick={() => updateFigures(ctx)} />
          <Small icon={<Link2 size={14} />} label="Tham chiếu chéo" title="Chèn tham chiếu tới tiêu đề, nhãn hoặc dấu trang" onClick={() => ctx.openDialog('crossref')} />
        </Rows>
      </Group>

      <Group label="Chỉ mục">
        <Big icon={<Tag size={22} color="#7c3aed" />} label="Đánh dấu mục" title="Đánh dấu từ đang chọn vào chỉ mục (Alt+Shift+X)" onClick={() => void markEntryPrompt(ctx)} />
        <Rows>
          <Small icon={<IndentIncrease size={14} />} label="Chèn chỉ mục" title="Chèn bảng chỉ mục theo các mục đã đánh dấu" onClick={() => ctx.openDialog('insertindex')} />
          <Small icon={<RefreshCw size={14} />} label="Cập nhật chỉ mục" title="Cập nhật số trang trong chỉ mục" onClick={() => updateIndex(ctx)} />
        </Rows>
      </Group>

      <Group label="Danh mục viện dẫn">
        <Big icon={<Scale size={22} color="#be185d" />} label="Đánh dấu viện dẫn" title="Đánh dấu tên văn bản pháp luật, án lệ (Alt+Shift+I)" onClick={() => ctx.openDialog('markcitation')} />
        <Rows>
          <Small icon={<ListChecks size={14} />} label="Chèn danh mục viện dẫn" title="Chèn danh mục văn bản đã đánh dấu" onClick={() => ctx.openDialog('toa')} />
          <Small icon={<RefreshCw size={14} />} label="Cập nhật danh mục" title="Cập nhật danh mục viện dẫn" onClick={() => updateAuthorities(ctx)} />
        </Rows>
      </Group>
    </>
  );
}

export function MailingsTab() {
  const ctx = useDoc();
  const { merge, mergePreview, setMergePreview, editor } = ctx;
  const total = merge?.rows.length ?? 0;
  const step = (delta: number) => setMergePreview(Math.max(0, Math.min(total - 1, (mergePreview ?? 0) + delta)));
  return (
    <>
      <Group label="Bắt đầu trộn thư">
        <Big icon={<Database size={22} color="#2b579a" />} label="Chọn danh sách" title="Chọn danh sách người nhận (CSV, Excel hoặc Minh Sheets)" onClick={() => ctx.openDialog('mailmerge')} />
      </Group>
      <Group label="Trường dữ liệu">
        <Dropdown large title="Chèn trường trộn" trigger={<><PencilLine size={22} color={merge ? '#2b579a' : '#9aa3b2'} /><span>Chèn trường</span></>}>
          {(close) => merge ? merge.headers.map((h) => <MenuItem key={h} label={`«${h}»`} onClick={() => { close(); editor.chain().focus().insertMergeField(h).run(); }} />) : <div className="ribbon-menu-empty">Hãy chọn danh sách người nhận trước.</div>}
        </Dropdown>
      </Group>
      <Group label="Xem trước">
        <Big icon={<Eye size={22} color={merge ? '#2b579a' : '#9aa3b2'} />} label="Xem kết quả" title="Hiện dữ liệu thật thay cho «trường»" active={mergePreview !== null} disabled={!merge} onClick={() => setMergePreview(mergePreview === null ? 0 : null)} />
        <Rows>
          <Small icon={<ChevronLeft size={14} />} title="Bản ghi trước" disabled={mergePreview === null || mergePreview <= 0} onClick={() => step(-1)} />
          <span className="merge-counter">{mergePreview === null ? '—' : `${mergePreview + 1} / ${total}`}</span>
          <Small icon={<ChevronRight size={14} />} title="Bản ghi sau" disabled={mergePreview === null || mergePreview >= total - 1} onClick={() => step(1)} />
        </Rows>
      </Group>
      <Group label="Hoàn tất">
        <Dropdown large title="Hoàn tất & trộn" trigger={<><FileStack size={22} color={merge ? '#107c41' : '#9aa3b2'} /><span>Hoàn tất</span></>}>
          {(close) => merge ? (
            <>
              <MenuItem icon={<FileStack size={14} />} label="Tạo tài liệu mới chứa mọi bản ghi" onClick={() => { close(); void finishMerge(ctx, 'single'); }} />
              <MenuItem icon={<Download size={14} />} label="Tải mỗi bản ghi thành một .docx" onClick={() => { close(); void finishMerge(ctx, 'files'); }} />
            </>
          ) : <div className="ribbon-menu-empty">Hãy chọn danh sách người nhận trước.</div>}
        </Dropdown>
      </Group>
    </>
  );
}

export function ReviewTab() {
  const ctx = useDoc();
  const { editor, view, setView, page } = ctx;
  const suggesting = view.editMode === 'suggesting';
  const protectedDoc = Boolean(page.protectHash);
  const locked = trackLocked(ctx);
  const inkCount = page.ink?.length ?? 0;
  const paragraphLocks = countLocked(editor);
  const authors = changeAuthors(ctx);
  const showingComments = view.sidePanel === 'comments' || view.commentsMode === 'contextual';
  const translate = (whole: boolean) => {
    if (whole) editor.commands.setTextSelection(editor.state.selection.head);
    else if (editor.state.selection.empty) return ctx.ui.toast('Hãy chọn đoạn cần dịch', true);
    ctx.openDialog('translate');
  };
  return (
    <>
      <Group label="Soát lỗi">
        <Big icon={<Gauge size={22} color="#7c3aed" />} label="Trình biên tập" title="Chấm điểm và gợi ý sửa chính tả, ngữ pháp, trình bày (F7)" onClick={() => ctx.openDialog('proofread')} />
        <Dropdown large title="Chính tả và ngữ pháp" trigger={<><SpellCheck size={22} color="#107c41" /><span>Chính tả & ngữ pháp</span></>} width={240}>
          {(close) => (
            <>
              <MenuItem icon={<SpellCheck size={14} />} label="Kiểm tra tài liệu" hint="F7" onClick={() => { close(); ctx.openDialog('proofread'); }} />
              <MenuItem icon={<BookOpenCheck size={14} />} label="Thống kê độ dễ đọc" onClick={() => { close(); ctx.openDialog('readability'); }} />
              <MenuSeparator />
              <MenuItem icon={view.spellcheck ? <EyeOff size={14} /> : <Eye size={14} />} label={view.spellcheck ? 'Ẩn gạch lỗi chính tả' : 'Hiện gạch lỗi chính tả'} onClick={() => { close(); setView({ spellcheck: !view.spellcheck }); }} />
              <MenuItem icon={<Wand2 size={14} />} label="Tự sửa khi gõ" active={page.autocorrect !== false} onClick={() => { close(); ctx.setPage({ autocorrect: page.autocorrect === false }); }} />
            </>
          )}
        </Dropdown>
        <Big icon={<BookMarked size={22} color="#0891b2" />} label="Từ đồng nghĩa" title="Tra từ đồng nghĩa của từ đang chọn (Shift+F7)" active={view.sidePanel === 'thesaurus'} onClick={() => setView({ sidePanel: view.sidePanel === 'thesaurus' ? null : 'thesaurus' })} />
        <Big icon={<Calculator size={22} color="#2b579a" />} label="Đếm từ" title="Thống kê số từ (Ctrl+Shift+G)" onClick={() => ctx.openDialog('wordcount')} />
      </Group>

      <Group label="Giọng nói">
        <Big icon={ctx.readAloud.speaking ? <VolumeX size={22} color="#d7473c" /> : <Volume2 size={22} color="#2b579a" />} label="Đọc to" title="Đọc to (Ctrl+Alt+Space)" active={ctx.readAloud.speaking} onClick={ctx.readAloud.toggle} />
      </Group>

      <Group label="Trợ năng">
        <Dropdown large title="Kiểm tra trợ năng" trigger={<><Accessibility size={22} color="#0891b2" /><span>Kiểm tra trợ năng</span></>} width={240}>
          {(close) => (
            <>
              <MenuItem icon={<Accessibility size={14} />} label="Kiểm tra trợ năng" onClick={() => { close(); ctx.openDialog('accessibility'); }} />
              <MenuItem icon={<Images size={14} />} label="Sửa mô tả ảnh đang chọn" onClick={() => { close(); if (editor.isActive('image')) void imageSettings(ctx); else ctx.ui.toast('Hãy chọn một ảnh trước', true); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Ngôn ngữ">
        <Dropdown large title="Dịch" trigger={<><Languages size={22} color="#2b579a" /><span>Dịch</span></>} width={220}>
          {(close) => (
            <>
              <MenuItem label="Dịch đoạn đang chọn" onClick={() => { close(); translate(false); }} />
              <MenuItem label="Dịch cả tài liệu" onClick={() => { close(); translate(true); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Ngôn ngữ kiểm tra chính tả" trigger={<><Globe size={22} color="#2b579a" /><span>Ngôn ngữ</span></>} width={260}>
          {(close) => (
            <>
              <MenuHeading>Cả tài liệu</MenuHeading>
              {PROOF_LANGUAGES.map((item) => <MenuItem key={item.value} label={item.label} active={(page.language ?? 'vi') === item.value} onClick={() => { close(); ctx.setPage({ language: item.value }); }} />)}
              <MenuSeparator />
              <MenuHeading>Đoạn đang chọn</MenuHeading>
              <MenuItem label="Theo ngôn ngữ tài liệu" onClick={() => { close(); editor.chain().focus().setParagraphAttrs({ proofLang: null }).run(); }} />
              {PROOF_LANGUAGES.map((item) => <MenuItem key={item.value} label={item.label} active={editor.getAttributes('paragraph').proofLang === item.value} onClick={() => { close(); editor.chain().focus().setParagraphAttrs({ proofLang: item.value }).run(); }} />)}
              <MenuSeparator />
              <MenuItem label="Không kiểm tra chính tả đoạn này" active={Boolean(editor.getAttributes('paragraph').noProof)} onClick={() => { close(); editor.chain().focus().setParagraphAttrs({ noProof: !editor.getAttributes('paragraph').noProof }).run(); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Bình luận">
        <Big icon={<MessageSquarePlus size={22} color="#d98e04" />} label="Bình luận mới" title="Bình luận mới (Ctrl+Alt+M)" disabled={page.protectMode === 'readonly'} onClick={() => void addComment(ctx)} />
        <Dropdown large title="Xoá bình luận" trigger={<><MessageSquareX size={22} color="#d7473c" /><span>Xoá</span></>} width={250}>
          {(close) => (
            <>
              <MenuItem label="Xoá bình luận này" onClick={() => { close(); deleteComments(ctx, 'current'); }} />
              <MenuItem label="Xoá mọi bình luận đang hiện" onClick={() => { close(); deleteComments(ctx, 'shown'); }} />
              <MenuItem label="Xoá mọi bình luận trong tài liệu" danger onClick={() => { close(); void ctx.ui.confirm('Xoá mọi bình luận?', 'Bình luận đã xoá chỉ lấy lại được từ phiên bản cũ.', true).then((yes) => { if (yes) deleteComments(ctx, 'all'); }); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<ChevronLeft size={14} />} label="Trước" title="Bình luận trước" onClick={() => jumpComment(ctx, -1)} />
          <Small icon={<ChevronRight size={14} />} label="Sau" title="Bình luận sau" onClick={() => jumpComment(ctx, 1)} />
        </Rows>
        <Dropdown large title="Hiện bình luận" active={showingComments} trigger={<><MessageSquare size={22} color="#2b579a" /><span>Hiện bình luận</span></>} width={220}>
          {(close) => (
            <>
              <MenuItem label="Theo vị trí trong văn bản" active={view.commentsMode === 'contextual'} onClick={() => { close(); setView({ commentsMode: 'contextual', sidePanel: view.sidePanel === 'comments' ? null : view.sidePanel }); }} />
              <MenuItem label="Danh sách" active={view.sidePanel === 'comments'} onClick={() => { close(); setView({ commentsMode: 'list', sidePanel: 'comments' }); }} />
              <MenuSeparator />
              <MenuItem label="Ẩn bình luận" onClick={() => { close(); setView({ commentsMode: 'list', sidePanel: view.sidePanel === 'comments' ? null : view.sidePanel }); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Đánh dấu">
        <Big icon={<Filter size={22} color={view.markupAuthor ? '#d98e04' : '#2b579a'} />} label="Lọc đánh dấu" title="Lọc thay đổi theo người sửa và loại" active={Boolean(view.markupAuthor)} onClick={() => ctx.openDialog('markupfilter')} />
        <Rows>
          <select className="ribbon-select markup-select" aria-label="Hiển thị để xem lại" title="Hiển thị để xem lại" value={view.markup} onChange={(e) => setView({ markup: e.target.value as MarkupMode })}>
            {MARKUP_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
          </select>
          <Dropdown title="Hiện đánh dấu" trigger={<><Eye size={14} /><span>Hiện đánh dấu</span></>} width={240}>
            {(close) => (
              <>
                <MenuItem icon={view.markupComments ? <Check size={14} /> : undefined} label="Bình luận" onClick={() => setView({ markupComments: !view.markupComments })} />
                <MenuItem icon={view.markupInsDel ? <Check size={14} /> : undefined} label="Chèn và xoá" onClick={() => setView({ markupInsDel: !view.markupInsDel })} />
                <MenuItem icon={view.markupFormatting ? <Check size={14} /> : undefined} label="Định dạng" onClick={() => setView({ markupFormatting: !view.markupFormatting })} />
                <MenuSeparator />
                <MenuHeading>Người cụ thể</MenuHeading>
                <MenuItem icon={!view.markupAuthor ? <Check size={14} /> : undefined} label="Mọi người" onClick={() => { close(); setView({ markupAuthor: null }); }} />
                {authors.map((author) => <MenuItem key={author} icon={view.markupAuthor === author ? <Check size={14} /> : undefined} label={author} onClick={() => { close(); setView({ markupAuthor: author }); }} />)}
              </>
            )}
          </Dropdown>
          <Dropdown title="Khung xem lại" active={view.reviewPane !== 'none'} trigger={<><PanelRight size={14} /><span>Khung xem lại</span></>} width={220}>
            {(close) => (
              <>
                <MenuItem icon={<PanelRight size={14} />} label="Khung dọc" active={view.reviewPane === 'vertical'} onClick={() => { close(); setView({ reviewPane: view.reviewPane === 'vertical' ? 'none' : 'vertical' }); }} />
                <MenuItem icon={<PanelBottom size={14} />} label="Khung ngang" active={view.reviewPane === 'horizontal'} onClick={() => { close(); setView({ reviewPane: view.reviewPane === 'horizontal' ? 'none' : 'horizontal' }); }} />
              </>
            )}
          </Dropdown>
        </Rows>
      </Group>

      <Group label="Theo dõi" onLauncher={() => ctx.openDialog('trackoptions')} launcherTitle="Tuỳ chọn Theo dõi thay đổi">
        <Dropdown large title="Theo dõi thay đổi (Ctrl+Shift+E)" active={suggesting} trigger={<><PencilLine size={22} color={suggesting ? '#107c41' : '#2b579a'} /><span>Theo dõi thay đổi</span></>} width={250}>
          {(close) => (
            <>
              <MenuItem label="Cho mọi người" hint="Lưu trong tệp" active={suggesting && page.trackLock === TRACK_EVERYONE} onClick={() => { close(); setTrackScope(ctx, 'everyone'); }} />
              <MenuItem label="Chỉ riêng tôi" active={suggesting && page.trackLock !== TRACK_EVERYONE && !locked} onClick={() => { close(); setTrackScope(ctx, 'mine'); }} />
              <MenuItem label="Tắt theo dõi" active={!suggesting} onClick={() => { close(); setTrackScope(ctx, 'off'); }} />
              <MenuSeparator />
              <MenuItem icon={locked ? <LockOpen size={14} /> : <Lock size={14} />} label={locked ? 'Mở khoá theo dõi…' : 'Khoá theo dõi…'} onClick={() => { close(); void toggleTrackLock(ctx); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Thay đổi">
        <Dropdown large title="Chấp nhận" trigger={<><CheckCheck size={22} color="#107c41" /><span>Chấp nhận</span></>} width={280}>
          {(close) => (
            <>
              <MenuItem icon={<Check size={14} />} label="Chấp nhận và chuyển tiếp" onClick={() => { close(); resolveCurrent(ctx, true, true); }} />
              <MenuItem icon={<Check size={14} />} label="Chấp nhận thay đổi này" onClick={() => { close(); resolveCurrent(ctx, true, false); }} />
              <MenuItem icon={<CheckCheck size={14} />} label="Chấp nhận mọi thay đổi đang hiện" onClick={() => { close(); resolveShown(ctx, true); }} />
              <MenuItem icon={<CheckCheck size={14} />} label="Chấp nhận mọi thay đổi" onClick={() => { close(); resolveAll(ctx, true, false); }} />
              <MenuItem icon={<CheckCheck size={14} />} label="Chấp nhận mọi thay đổi và ngừng theo dõi" onClick={() => { close(); resolveAll(ctx, true, true); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Từ chối" trigger={<><XCircle size={22} color="#d7473c" /><span>Từ chối</span></>} width={280}>
          {(close) => (
            <>
              <MenuItem icon={<X size={14} />} label="Từ chối và chuyển tiếp" onClick={() => { close(); resolveCurrent(ctx, false, true); }} />
              <MenuItem icon={<X size={14} />} label="Từ chối thay đổi này" onClick={() => { close(); resolveCurrent(ctx, false, false); }} />
              <MenuItem icon={<XCircle size={14} />} label="Từ chối mọi thay đổi đang hiện" onClick={() => { close(); resolveShown(ctx, false); }} />
              <MenuItem icon={<XCircle size={14} />} label="Từ chối mọi thay đổi" onClick={() => { close(); resolveAll(ctx, false, false); }} />
              <MenuItem icon={<XCircle size={14} />} label="Từ chối mọi thay đổi và ngừng theo dõi" onClick={() => { close(); resolveAll(ctx, false, true); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<ChevronLeft size={14} />} label="Trước" title="Thay đổi trước" onClick={() => jumpChange(ctx, -1)} />
          <Small icon={<ChevronRight size={14} />} label="Sau" title="Thay đổi sau" onClick={() => jumpChange(ctx, 1)} />
        </Rows>
      </Group>

      <Group label="So sánh">
        <Dropdown large title="So sánh" trigger={<><FileDiff size={22} color="#7c3aed" /><span>So sánh</span></>} width={270}>
          {(close) => (
            <>
              <MenuItem icon={<FileDiff size={14} />} label="So sánh với tệp khác…" onClick={() => { close(); ctx.openDialog('compare'); }} />
              <MenuItem icon={<FileDiff size={14} />} label="So sánh với phiên bản đã lưu…" onClick={() => { close(); ctx.openDialog('history'); }} />
              <MenuItem icon={<FileStack size={14} />} label="Gộp thay đổi từ tệp khác…" onClick={() => { close(); ctx.openDialog('combine'); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Bảo vệ">
        <Dropdown large title="Khoá đoạn để không ai sửa được" active={paragraphLocks > 0} trigger={<><UserX size={22} color={paragraphLocks ? '#d7473c' : '#586071'} /><span>Chặn tác giả</span></>} width={250}>
          {(close) => (
            <>
              <MenuItem icon={<Lock size={14} />} label="Khoá các đoạn đang chọn" onClick={() => { close(); setLocked(ctx, true); }} />
              <MenuItem icon={<LockOpen size={14} />} label="Mở khoá các đoạn đang chọn" onClick={() => { close(); setLocked(ctx, false); }} />
              <MenuItem icon={<LockOpen size={14} />} label={`Mở khoá toàn bộ (${paragraphLocks} đoạn)`} onClick={() => { close(); setLocked(ctx, false, true); }} />
            </>
          )}
        </Dropdown>
        <Big icon={protectedDoc ? <ShieldCheck size={22} color="#d7473c" /> : <Lock size={22} color="#586071" />} label="Hạn chế sửa" title="Khoá tài liệu bằng mật khẩu: chỉ xem, chỉ bình luận hoặc bắt buộc theo dõi thay đổi" active={protectedDoc || view.sidePanel === 'restrict'} onClick={() => setView({ sidePanel: view.sidePanel === 'restrict' ? null : 'restrict' })} />
      </Group>

      <Group label="Nét vẽ">
        <Dropdown large title="Ẩn nét vẽ tay" active={view.hideInk} trigger={<><EyeOff size={22} color={view.hideInk ? '#d7473c' : '#586071'} /><span>Ẩn nét vẽ</span></>} width={220}>
          {(close) => (
            <>
              <MenuItem icon={view.hideInk ? <Eye size={14} /> : <EyeOff size={14} />} label={view.hideInk ? 'Hiện nét vẽ' : 'Ẩn nét vẽ'} onClick={() => { close(); setView({ hideInk: !view.hideInk }); }} />
              <MenuItem icon={<Trash2 size={14} />} label={`Xoá mọi nét vẽ (${inkCount})`} danger onClick={() => { close(); if (!inkCount) return ctx.ui.toast('Tài liệu chưa có nét vẽ nào', true); void ctx.ui.confirm('Xoá mọi nét vẽ?', undefined, true).then((yes) => { if (yes) ctx.setPage({ ink: [] }); }); }} />
            </>
          )}
        </Dropdown>
      </Group>
    </>
  );
}
