import { Accessibility, Bookmark, BookMarked, Check, CheckCheck, ChevronLeft, ChevronRight, Database, Eye, FileDiff, FileStack, FileText, Globe, Images, IndentIncrease, Languages, Link2, ListTree, Lock, LockOpen, MessageSquare, MessageSquarePlus, MessageSquareX, PencilLine, Quote, ScrollText, SpellCheck, Tag, Volume2, VolumeX, Wand2, X, XCircle, Calculator, Download } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useDoc } from '../../DocContext';
import { addComment, insertCaption, insertFootnote, toggleProtection } from '../../actions';
import { insertBookmarkPrompt, insertEndnote, markIndexEntry } from '../../actionsExtra';
import type { CitationStyle } from '../../../../lib/storage';
import { collectChanges } from '../../trackChanges';
import { finishMerge } from '../MailMerge';
import { getPagination } from '../../pagination';
import { Big, Dropdown, Group, MenuItem, Rows, Small } from '../RibbonParts';

export function ReferencesTab() {
  const ctx = useDoc();
  const { editor } = ctx;
  const updateToc = () => {
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableOfContents') found = true;
      return !found;
    });
    if (!found) editor.chain().focus().insertDocList('tableOfContents').run();
    getPagination(editor).runNow();
    ctx.ui.toast(found ? 'Đã cập nhật mục lục và số trang' : 'Đã chèn mục lục tự động');
  };
  const insertList = (kind: 'bibliography' | 'docIndex' | 'figureList', attrs?: Record<string, unknown>) => editor.chain().focus().insertDocList(kind, attrs).run();
  return (
    <>
      <Group label="Mục lục">
        <Dropdown large title="Chèn mục lục" trigger={<><ListTree size={22} color="#2b579a" /><span>Mục lục</span></>}>
          {(close) => (
            <>
              <MenuItem label="Tiêu đề cấp 1 đến 3, có số trang" onClick={() => { close(); editor.chain().focus().insertDocList('tableOfContents', { levels: 3, showPages: true }).run(); }} />
              <MenuItem label="Tiêu đề cấp 1 đến 2, có số trang" onClick={() => { close(); editor.chain().focus().insertDocList('tableOfContents', { levels: 2, showPages: true }).run(); }} />
              <MenuItem label="Tiêu đề cấp 1 đến 4, có số trang" onClick={() => { close(); editor.chain().focus().insertDocList('tableOfContents', { levels: 4, showPages: true }).run(); }} />
              <MenuItem label="Tiêu đề cấp 1 đến 3, không số trang" onClick={() => { close(); editor.chain().focus().insertDocList('tableOfContents', { levels: 3, showPages: false }).run(); }} />
            </>
          )}
        </Dropdown>
        <Small icon={<Check size={14} />} label="Cập nhật" title="Làm mới mục lục" onClick={updateToc} />
      </Group>
      <Group label="Chú thích">
        <Big icon={<FileText size={22} color="#107c41" />} label="Chú thích cuối trang" title="Chèn chú thích cuối trang (Ctrl+Alt+F)" onClick={() => void insertFootnote(ctx)} />
        <Big icon={<ScrollText size={22} color="#107c41" />} label="Chú thích cuối bài" title="Chèn chú thích tập trung ở cuối tài liệu" onClick={() => void insertEndnote(ctx)} />
      </Group>
      <Group label="Đánh nhãn">
        <Big icon={<Tag size={22} color="#d98e04" />} label="Chèn nhãn" title="Đánh số tự động Hình/Bảng/Biểu đồ" onClick={() => void insertCaption(ctx)} />
        <Big icon={<Images size={22} color="#d98e04" />} label="Danh mục hình" title="Chèn danh mục hình, bảng theo các nhãn đã đánh" onClick={() => insertList('figureList')} />
        <Rows>
          <Small icon={<Link2 size={14} />} label="Tham chiếu chéo" title="Chèn tham chiếu tới tiêu đề, nhãn hoặc dấu trang" onClick={() => ctx.openDialog('crossref')} />
          <Small icon={<Bookmark size={14} />} label="Dấu trang" title="Đặt dấu trang tại con trỏ" onClick={() => void insertBookmarkPrompt(ctx)} />
        </Rows>
      </Group>
      <Group label="Trích dẫn">
        <Big icon={<Quote size={22} color="#2b579a" />} label="Chèn trích dẫn" title="Quản lý nguồn và chèn trích dẫn tại con trỏ" onClick={() => ctx.openDialog('citations')} />
        <Big icon={<BookMarked size={22} color="#586071" />} label="Danh mục tài liệu" title="Chèn danh mục tài liệu tham khảo, tự cập nhật theo trích dẫn" onClick={() => insertList('bibliography')} />
        <Rows>
          <select className="ribbon-select citation-style" aria-label="Kiểu trích dẫn" title="Kiểu trích dẫn" value={ctx.page.citationStyle ?? 'apa'} onChange={(e) => ctx.setPage({ citationStyle: e.target.value as CitationStyle })}>
            {['apa', 'ieee', 'chicago', 'mla', 'vancouver'].map((style) => <option key={style} value={style}>{style.toUpperCase()}</option>)}
          </select>
          <Small icon={<Quote size={14} />} label="Khối trích dẫn" title="Định dạng đoạn thành khối trích dẫn" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        </Rows>
      </Group>
      <Group label="Chỉ mục">
        <Big icon={<Tag size={22} color="#7c3aed" />} label="Đánh dấu mục" title="Đánh dấu từ đang chọn vào chỉ mục" onClick={() => void markIndexEntry(ctx)} />
        <Big icon={<IndentIncrease size={22} color="#7c3aed" />} label="Chèn chỉ mục" title="Chèn bảng chỉ mục theo các mục đã đánh dấu" onClick={() => insertList('docIndex')} />
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

const commentPositions = (editor: Editor) => {
  const list: { id: string; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    const mark = node.marks.find((m) => m.type.name === 'comment');
    if (mark && !list.some((c) => c.id === mark.attrs.commentId)) list.push({ id: String(mark.attrs.commentId), pos });
  });
  return list;
};

export function ReviewTab() {
  const ctx = useDoc();
  const { editor, view, setView } = ctx;
  const suggesting = view.editMode === 'suggesting';
  const jumpComment = (dir: 1 | -1) => {
    const list = commentPositions(editor).filter((c) => ctx.comments.some((x) => x.id === c.id && !x.resolved));
    if (!list.length) return ctx.ui.toast('Không có bình luận nào đang mở', true);
    const head = editor.state.selection.from;
    const target = dir > 0 ? list.find((c) => c.pos > head) ?? list[0] : [...list].reverse().find((c) => c.pos < head) ?? list[list.length - 1];
    editor.chain().focus().setTextSelection(target.pos + 1).scrollIntoView().run();
    ctx.setActiveCommentId(target.id);
    setView({ sidePanel: 'comments' });
  };
  const jumpChange = (dir: 1 | -1) => {
    const list = collectChanges(editor.state.doc);
    if (!list.length) return ctx.ui.toast('Không còn thay đổi nào cần duyệt');
    const head = editor.state.selection.from;
    const target = dir > 0 ? list.find((c) => c.from > head) ?? list[0] : [...list].reverse().find((c) => c.to < head) ?? list[list.length - 1];
    editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
  };
  const deleteActiveComment = () => {
    const id = ctx.activeCommentId ?? editor.getAttributes('comment').commentId;
    if (!id) return ctx.ui.toast('Đặt con trỏ vào đoạn có bình luận để xoá', true);
    editor.chain().unsetCommentById(id).run();
    ctx.setComments((items) => items.filter((c) => c.id !== id));
    ctx.markDirty();
  };
  const protectedDoc = Boolean(ctx.page.protectHash);
  return (
    <>
      <Group label="Soát lỗi">
        <Big icon={<SpellCheck size={22} color="#107c41" />} label="Chính tả & ngữ pháp" title="Kiểm tra chính tả, ngữ pháp, văn phong (F7)" onClick={() => ctx.openDialog('proofread')} />
        <Big icon={<Calculator size={22} color="#2b579a" />} label="Đếm từ" title="Thống kê số từ (Ctrl+Shift+G)" onClick={() => ctx.openDialog('wordcount')} />
        <Big icon={<Accessibility size={22} color="#0891b2" />} label="Trợ năng" title="Kiểm tra ảnh thiếu mô tả, tiêu đề nhảy cấp, bảng thiếu tiêu đề, chữ khó đọc" onClick={() => ctx.openDialog('accessibility')} />
        <Big icon={<Wand2 size={22} color="#7c3aed" />} label="Tự sửa" title="Tự viết hoa đầu câu và đổi cụm gõ tắt khi nhập" active={ctx.page.autocorrect !== false} onClick={() => ctx.setPage({ autocorrect: ctx.page.autocorrect === false })} />
      </Group>
      <Group label="Giọng nói & ngôn ngữ">
        <Big icon={ctx.readAloud.speaking ? <VolumeX size={22} color="#d7473c" /> : <Volume2 size={22} color="#2b579a" />} label="Đọc to" title="Đọc to (Ctrl+Alt+Space)" active={ctx.readAloud.speaking} onClick={ctx.readAloud.toggle} />
        <Big icon={<Languages size={22} color="#2b579a" />} label="Dịch" title="Dịch đoạn chọn hoặc cả tài liệu" onClick={() => ctx.openDialog('translate')} />
        <Dropdown large title="Ngôn ngữ kiểm tra chính tả của tài liệu" trigger={<><Globe size={22} color="#2b579a" /><span>Ngôn ngữ</span></>}>
          {(close) => [{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'Tiếng Anh' }, { value: 'fr', label: 'Tiếng Pháp' }, { value: 'zh', label: 'Tiếng Trung' }, { value: 'ja', label: 'Tiếng Nhật' }, { value: 'ko', label: 'Tiếng Hàn' }].map((item) => <MenuItem key={item.value} label={item.label} active={(ctx.page.language ?? 'vi') === item.value} onClick={() => { close(); ctx.setPage({ language: item.value }); }} />)}
        </Dropdown>
      </Group>
      <Group label="Bình luận">
        <Big icon={<MessageSquarePlus size={22} color="#d98e04" />} label="Mới" title="Bình luận mới (Ctrl+Alt+M)" onClick={() => void addComment(ctx)} />
        <Rows>
          <Small icon={<MessageSquareX size={14} />} label="Xoá" title="Xoá bình luận tại con trỏ" onClick={deleteActiveComment} />
          <Small icon={<ChevronLeft size={14} />} label="Trước" title="Bình luận trước" onClick={() => jumpComment(-1)} />
          <Small icon={<ChevronRight size={14} />} label="Sau" title="Bình luận sau" onClick={() => jumpComment(1)} />
        </Rows>
        <Big icon={<MessageSquare size={22} color="#2b579a" />} label="Hiện bình luận" title="Mở khung bình luận" active={view.sidePanel === 'comments'} onClick={() => setView({ sidePanel: view.sidePanel === 'comments' ? null : 'comments' })} />
      </Group>
      <Group label="Theo dõi">
        <Big icon={<PencilLine size={22} color={suggesting ? '#107c41' : '#2b579a'} />} label="Theo dõi thay đổi" title="Bật chế độ Đề xuất: mọi chỉnh sửa được đánh dấu để duyệt (Ctrl+Shift+E)" active={suggesting} disabled={protectedDoc} onClick={() => setView({ editMode: suggesting ? 'editing' : 'suggesting' })} />
        <Big icon={<FileDiff size={22} color="#2b579a" />} label="Khung thay đổi" title="Danh sách các thay đổi chờ duyệt" active={view.sidePanel === 'changes'} onClick={() => setView({ sidePanel: view.sidePanel === 'changes' ? null : 'changes' })} />
      </Group>
      <Group label="Thay đổi">
        <Dropdown large title="Chấp nhận" trigger={<><CheckCheck size={22} color="#107c41" /><span>Chấp nhận</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<Check size={14} />} label="Chấp nhận thay đổi đang chọn" onClick={() => { close(); const { from, to } = editor.state.selection; editor.chain().focus().acceptChange({ from: Math.max(0, from - 1), to: Math.min(editor.state.doc.content.size, to + 1) }).run(); }} />
              <MenuItem icon={<CheckCheck size={14} />} label="Chấp nhận tất cả" onClick={() => { close(); editor.chain().focus().acceptAllChanges().run(); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Từ chối" trigger={<><XCircle size={22} color="#d7473c" /><span>Từ chối</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<X size={14} />} label="Từ chối thay đổi đang chọn" onClick={() => { close(); const { from, to } = editor.state.selection; editor.chain().focus().rejectChange({ from: Math.max(0, from - 1), to: Math.min(editor.state.doc.content.size, to + 1) }).run(); }} />
              <MenuItem icon={<XCircle size={14} />} label="Từ chối tất cả" onClick={() => { close(); editor.chain().focus().rejectAllChanges().run(); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<ChevronLeft size={14} />} label="Trước" title="Thay đổi trước" onClick={() => jumpChange(-1)} />
          <Small icon={<ChevronRight size={14} />} label="Sau" title="Thay đổi sau" onClick={() => jumpChange(1)} />
        </Rows>
      </Group>
      <Group label="So sánh">
        <Big icon={<FileDiff size={22} color="#7c3aed" />} label="So với phiên bản" title="So sánh với một phiên bản đã lưu" onClick={() => ctx.openDialog('history')} />
        <Big icon={<FileDiff size={22} color="#0891b2" />} label="So với tệp" title="So sánh với một tệp trên máy" onClick={() => ctx.openDialog('compare')} />
      </Group>
      <Group label="Bảo vệ">
        <Big icon={protectedDoc ? <LockOpen size={22} color="#d7473c" /> : <Lock size={22} color="#586071" />} label={protectedDoc ? 'Bỏ bảo vệ' : 'Hạn chế sửa'} title="Khoá tài liệu bằng mật khẩu (chỉ xem)" active={protectedDoc} onClick={() => void toggleProtection(ctx)} />
      </Group>
    </>
  );
}
