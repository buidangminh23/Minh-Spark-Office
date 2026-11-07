import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, MessageSquare, Reply, Trash2, X, XCircle, FileDiff, Navigation } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { AUTHOR, newId, useDoc } from '../DocContext';
import { collectChanges } from '../trackChanges';
import { addComment } from '../actions';

export function OutlinePanel() {
  const { editor, setView } = useDoc();
  const headings = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const list: { pos: number; level: number; text: string }[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.textContent.trim()) list.push({ pos, level: node.attrs.level, text: node.textContent });
        return node.isBlock && node.type.name !== 'heading';
      });
      const head = e.state.selection.from;
      const current = [...list].reverse().find((h) => h.pos <= head)?.pos ?? -1;
      return { list, current };
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  const [filter, setFilter] = useState('');
  const jump = (pos: number) => {
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.chain().focus().setTextSelection(pos + 1).run();
  };
  const items = headings.list.filter((h) => h.text.toLowerCase().includes(filter.toLowerCase()));
  return (
    <aside className="doc-outline" aria-label="Khung điều hướng">
      <div className="panel-head"><span><Navigation size={14} /> Điều hướng</span><button className="icon-btn" aria-label="Đóng" onClick={() => setView({ showNav: false })}><X size={14} /></button></div>
      <input className="text-field panel-search" placeholder="Lọc tiêu đề…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {items.length === 0 ? <div className="panel-empty">Chưa có tiêu đề. Dùng kiểu Heading 1–6 để tạo đề mục điều hướng.</div> : items.map((h) => (
        <button key={h.pos} type="button" className={`outline-item h${Math.min(h.level, 4)} ${h.pos === headings.current ? 'current' : ''}`} onClick={() => jump(h.pos)} title={h.text}>{h.text}</button>
      ))}
    </aside>
  );
}

const commentRange = (editor: ReturnType<typeof useDoc>['editor'], id: string) => {
  let from = -1;
  let to = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.marks.some((m) => m.type.name === 'comment' && m.attrs.commentId === id)) {
      if (from < 0) from = pos;
      to = pos + node.nodeSize;
    }
  });
  return from < 0 ? null : { from, to };
};

export function CommentsPanel() {
  const ctx = useDoc();
  const { comments, setComments, editor, activeCommentId, setActiveCommentId } = ctx;
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const list = comments.filter((c) => (tab === 'open' ? !c.resolved : c.resolved));
  useEffect(() => {
    if (!activeCommentId) return;
    document.querySelector(`[data-card-id="${activeCommentId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    editor.view.dom.querySelectorAll('.comment-anchor.active').forEach((el) => el.classList.remove('active'));
    editor.view.dom.querySelectorAll(`[data-comment-id="${activeCommentId}"]`).forEach((el) => el.classList.add('active'));
  }, [activeCommentId, editor, comments]);
  const focus = (id: string) => {
    setActiveCommentId(id);
    const range = commentRange(editor, id);
    if (range) {
      editor.chain().setTextSelection(range).run();
      (editor.view.nodeDOM(range.from) as HTMLElement | null)?.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  const update = (id: string, patch: (c: (typeof comments)[number]) => (typeof comments)[number]) => {
    setComments((items) => items.map((c) => (c.id === id ? patch(c) : c)));
    ctx.markDirty();
  };
  const remove = (id: string) => {
    editor.chain().unsetCommentById(id).run();
    setComments((items) => items.filter((c) => c.id !== id));
    ctx.markDirty();
  };
  const reply = (id: string) => {
    const text = replies[id]?.trim();
    if (!text) return;
    update(id, (c) => ({ ...c, replies: [...(c.replies ?? []), { id: newId('r'), author: AUTHOR, text, createdAt: Date.now() }] }));
    setReplies({ ...replies, [id]: '' });
  };
  return (
    <aside className="doc-comments" aria-label="Bình luận">
      <div className="panel-head"><span><MessageSquare size={14} /> Bình luận</span><button className="icon-btn" aria-label="Đóng" onClick={() => ctx.setView({ sidePanel: null })}><X size={14} /></button></div>
      <button className="btn btn-primary panel-new" onClick={() => void addComment(ctx)}>+ Bình luận mới</button>
      <div className="comments-tabs">
        <button className={`comments-tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>Đang mở ({comments.filter((c) => !c.resolved).length})</button>
        <button className={`comments-tab ${tab === 'resolved' ? 'active' : ''}`} onClick={() => setTab('resolved')}>Đã xong ({comments.filter((c) => c.resolved).length})</button>
      </div>
      <div className="comments-list">
        {list.length === 0 && <div className="panel-empty">{tab === 'open' ? 'Chưa có bình luận. Bôi chọn đoạn văn rồi bấm Bình luận (Ctrl+Alt+M).' : 'Chưa có bình luận đã giải quyết.'}</div>}
        {list.map((c) => (
          <div key={c.id} data-card-id={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''} ${activeCommentId === c.id ? 'active' : ''}`} onClick={() => focus(c.id)}>
            <div className="comment-card-top">
              <div className="comment-author-badge"><div className="comment-avatar">{c.author.slice(0, 1)}</div><div><div className="comment-author">{c.author}</div><div className="muted">{new Date(c.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div></div></div>
              <div className="comment-tools">
                <button className="icon-btn" title={c.resolved ? 'Mở lại' : 'Đánh dấu đã giải quyết'} aria-label="Giải quyết" onClick={(e) => { e.stopPropagation(); update(c.id, (x) => ({ ...x, resolved: !x.resolved })); }}><Check size={13} /></button>
                <button className="icon-btn" title="Xoá bình luận" aria-label="Xoá" onClick={(e) => { e.stopPropagation(); remove(c.id); }}><Trash2 size={13} /></button>
              </div>
            </div>
            {c.quote && <div className="comment-quote">“{c.quote}”</div>}
            <div className="comment-text">{c.text}</div>
            {(c.replies ?? []).map((r) => <div key={r.id} className="comment-reply"><strong>{r.author}:</strong> {r.text}</div>)}
            {!c.resolved && (
              <div className="comment-reply-box" onClick={(e) => e.stopPropagation()}>
                <input className="text-field" placeholder="Trả lời…" value={replies[c.id] ?? ''} onChange={(e) => setReplies({ ...replies, [c.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && reply(c.id)} />
                <button className="icon-btn" aria-label="Gửi trả lời" disabled={!replies[c.id]?.trim()} onClick={() => reply(c.id)}><Reply size={13} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ChangesPanel() {
  const { editor, setView } = useDoc();
  const version = useEditorState({ editor, selector: ({ editor: e }) => e.state.doc });
  const changes = useMemo(() => collectChanges(version), [version]);
  return (
    <aside className="doc-comments" aria-label="Thay đổi">
      <div className="panel-head"><span><FileDiff size={14} /> Thay đổi ({changes.length})</span><button className="icon-btn" aria-label="Đóng" onClick={() => setView({ sidePanel: null })}><X size={14} /></button></div>
      <div className="panel-row">
        <button className="btn" disabled={!changes.length} onClick={() => editor.chain().focus().acceptAllChanges().run()}><CheckCheck size={13} /> Nhận tất cả</button>
        <button className="btn" disabled={!changes.length} onClick={() => editor.chain().focus().rejectAllChanges().run()}><XCircle size={13} /> Từ chối tất cả</button>
      </div>
      <div className="comments-list">
        {changes.length === 0 && <div className="panel-empty">Không có thay đổi nào. Bật “Theo dõi thay đổi” ở tab Xem lại để mọi chỉnh sửa được đánh dấu.</div>}
        {changes.map((c) => (
          <div key={c.id} className={`comment-card change-${c.kind}`} onClick={() => editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run()}>
            <div className="comment-card-top">
              <span className="change-kind">{c.kind === 'insertion' ? 'Đã chèn' : 'Đã xoá'}</span>
              <div className="comment-tools">
                <button className="icon-btn" title="Chấp nhận" aria-label="Chấp nhận" onClick={(e) => { e.stopPropagation(); editor.chain().acceptChange(c).run(); }}><Check size={13} /></button>
                <button className="icon-btn" title="Từ chối" aria-label="Từ chối" onClick={(e) => { e.stopPropagation(); editor.chain().rejectChange(c).run(); }}><X size={13} /></button>
              </div>
            </div>
            <div className="comment-text">“{c.text.slice(0, 160) || '(định dạng)'}”</div>
            <div className="muted">{c.author}{c.date ? ` · ${new Date(c.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
