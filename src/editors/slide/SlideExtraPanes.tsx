import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, MessageSquare, Reply, Trash2, X, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import type { SlideComment, SlideElement } from '../../lib/slideTypes';
import { ACCESSIBILITY_RULE_LABELS, checkAccessibility } from '../../lib/slideAccessibility';
import { slideBaseWidth } from '../../lib/settings/slideOptions';
import { SlideCanvas } from './SlideCanvas';
import { useSlideExtras } from './slideExtrasContext';

const TYPE_LABELS: Partial<Record<SlideElement['type'], string>> = {
  text: 'Hộp chữ', shape: 'Hình', image: 'Ảnh', table: 'Bảng', chart: 'Biểu đồ', smartart: 'SmartArt', ink: 'Nét mực', icon: 'Biểu tượng',
  video: 'Video', audio: 'Âm thanh', cameo: 'Cameo', object: 'Đối tượng', math: 'Công thức', code: 'Mã nguồn', qr: 'Mã QR', zoom: 'Thu phóng', '3d': 'Mô hình 3D',
};

export function elementLabel(el: SlideElement) {
  return el.name || (el.text ? el.text.split('\n')[0].slice(0, 32) : `${TYPE_LABELS[el.type] ?? el.type}`);
}

function PaneShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="ppx-pane" aria-label={title}>
      <div className="ppx-pane-head">
        <span>{title}</span>
        <button type="button" className="ppt-dialog-close-btn" onClick={onClose} aria-label="Đóng ngăn"><X size={16} /></button>
      </div>
      <div className="ppx-pane-body">{children}</div>
    </aside>
  );
}

export function SelectionPane({ onClose }: { onClose: () => void }) {
  const x = useSlideExtras();
  const [editing, setEditing] = useState<string | null>(null);
  const ordered = [...x.currentSlide.elements].sort((a, b) => (b.zIndex ?? 10) - (a.zIndex ?? 10));
  const move = (el: SlideElement, dir: 1 | -1) => {
    const list = [...ordered];
    const index = list.findIndex((e) => e.id === el.id);
    const swap = list[index - dir];
    if (!swap) return;
    const z = el.zIndex ?? 10;
    const zSwap = swap.zIndex ?? 10;
    x.updateElement(el.id, { zIndex: zSwap === z ? z + dir : zSwap });
    x.updateElement(swap.id, { zIndex: z });
  };
  return (
    <PaneShell title="Ngăn chọn" onClose={onClose}>
      <div className="ppx-pane-tools">
        <button type="button" className="ppt-secondary-action-btn" onClick={() => x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, elements: s.elements.map((e) => ({ ...e, hidden: undefined })) } : s)) }))} disabled={!ordered.some((e) => e.hidden)}>Hiện tất cả</button>
        <button type="button" className="ppt-secondary-action-btn" onClick={() => x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, elements: s.elements.map((e) => ({ ...e, hidden: true })) } : s)) }))}>Ẩn tất cả</button>
      </div>
      <div className="ppx-muted">Trên cùng = lớp trên cùng. Trình đọc màn hình đọc từ dưới lên.</div>
      <ul className="ppx-sel-list">
        {ordered.map((el) => {
          const selected = x.selectedElements.some((s) => s.id === el.id);
          return (
            <li key={el.id} className={`ppx-sel-item ${selected ? 'is-active' : ''} ${el.hidden ? 'is-hidden' : ''}`}>
              {editing === el.id ? (
                <input className="ppt-input" autoFocus defaultValue={elementLabel(el)} onBlur={(e) => { x.updateElement(el.id, { name: e.target.value.trim() || undefined }); setEditing(null); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
              ) : (
                <button type="button" className="ppx-sel-name" onClick={(e) => x.selectElements(e.ctrlKey || e.metaKey ? [...x.selectedElements.map((s) => s.id), el.id] : [el.id], el.id)} onDoubleClick={() => setEditing(el.id)} title="Bấm để chọn, bấm đúp để đổi tên">
                  {elementLabel(el)}
                </button>
              )}
              <button type="button" className="ppt-tool-btn" onClick={() => move(el, 1)} title="Đưa lên một lớp"><ArrowUp size={13} /></button>
              <button type="button" className="ppt-tool-btn" onClick={() => move(el, -1)} title="Đưa xuống một lớp"><ArrowDown size={13} /></button>
              <button type="button" className="ppt-tool-btn" onClick={() => x.updateElement(el.id, { hidden: !el.hidden || undefined })} title={el.hidden ? 'Hiện' : 'Ẩn'}>
                {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </li>
          );
        })}
      </ul>
    </PaneShell>
  );
}

const AUTHOR_KEY = 'minh-slides-comment-author';

function commentAuthor() {
  try {
    return localStorage.getItem(AUTHOR_KEY) || 'Tôi';
  } catch {
    return 'Tôi';
  }
}

export function CommentsPane({ onClose }: { onClose: () => void }) {
  const x = useSlideExtras();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const comments = x.currentSlide.comments ?? [];
  useEffect(() => {
    const open = () => setComposing(true);
    window.addEventListener('minh-slides:new-comment', open);
    return () => window.removeEventListener('minh-slides:new-comment', open);
  }, []);
  useEffect(() => {
    if (comments.some((c) => !c.read)) x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, comments: s.comments?.map((c) => ({ ...c, read: true })) } : s)) }));
  }, [x.activeSlideIndex]);
  const setComments = (fn: (list: SlideComment[]) => SlideComment[]) => x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, comments: fn(s.comments ?? []) } : s)) }));
  const add = () => {
    if (!draft.trim()) return;
    setComments((list) => [...list, { id: `cm-${Date.now()}`, author: commentAuthor(), text: draft.trim(), createdAt: Date.now(), elementId: x.selectedElement?.id, read: true }]);
    setDraft('');
    setComposing(false);
  };
  const reply = (id: string) => {
    if (!replyText.trim()) return;
    setComments((list) => list.map((c) => (c.id === id ? { ...c, replies: [...(c.replies ?? []), { id: `rp-${Date.now()}`, author: commentAuthor(), text: replyText.trim(), createdAt: Date.now() }] } : c)));
    setReplyText('');
    setReplyTo(null);
  };
  const target = (c: SlideComment) => x.currentSlide.elements.find((e) => e.id === c.elementId);
  return (
    <PaneShell title={`Nhận xét · Trang ${x.activeSlideIndex + 1}`} onClose={onClose}>
      {composing ? (
        <div className="ppx-comment-new">
          <textarea className="ppt-input ppx-textarea" rows={3} autoFocus placeholder={x.selectedElement ? `Nhận xét về "${elementLabel(x.selectedElement)}"` : 'Nhận xét về trang này'} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && add()} />
          <div className="ppx-inline">
            <button type="button" className="ppt-secondary-action-btn" onClick={() => setComposing(false)}>Hủy</button>
            <button type="button" className="ppt-primary-action-btn" disabled={!draft.trim()} onClick={add}>Đăng</button>
          </div>
        </div>
      ) : (
        <button type="button" className="ppt-primary-action-btn" onClick={() => setComposing(true)}><MessageSquare size={14} /> Nhận xét mới</button>
      )}
      {comments.length === 0 && !composing && <div className="ppx-muted">Trang này chưa có nhận xét.</div>}
      {comments.map((c) => (
        <div key={c.id} className={`ppx-comment ${c.resolved ? 'is-resolved' : ''}`}>
          <div className="ppx-comment-head">
            <b>{c.author}</b>
            <span>{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          {target(c) && <button type="button" className="ppx-comment-target" onClick={() => x.selectElements([c.elementId!], c.elementId)}>↳ {elementLabel(target(c)!)}</button>}
          <p>{c.text}</p>
          {c.replies?.map((r) => (
            <div key={r.id} className="ppx-comment-reply"><b>{r.author}</b>: {r.text}</div>
          ))}
          {replyTo === c.id ? (
            <div className="ppx-inline">
              <input className="ppt-input" autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reply(c.id)} placeholder="Trả lời" />
              <button type="button" className="ppt-primary-action-btn" onClick={() => reply(c.id)}>Gửi</button>
            </div>
          ) : (
            <div className="ppx-comment-actions">
              <button type="button" className="ppt-tool-btn" onClick={() => setReplyTo(c.id)} title="Trả lời"><Reply size={13} /></button>
              <button type="button" className="ppt-tool-btn" onClick={() => setComments((list) => list.map((item) => (item.id === c.id ? { ...item, resolved: !item.resolved } : item)))} title={c.resolved ? 'Mở lại' : 'Giải quyết'}><Check size={13} /></button>
              <button type="button" className="ppt-tool-btn" onClick={() => setComments((list) => list.filter((item) => item.id !== c.id))} title="Xóa"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      ))}
    </PaneShell>
  );
}

const SEVERITY_ICON = { error: <AlertCircle size={14} color="#DC2626" />, warning: <AlertTriangle size={14} color="#D97706" />, tip: <Lightbulb size={14} color="#2563EB" /> };
const SEVERITY_LABEL = { error: 'Lỗi', warning: 'Cảnh báo', tip: 'Mẹo' };

export function AccessibilityPane({ onClose }: { onClose: () => void }) {
  const x = useSlideExtras();
  const issues = useMemo(() => checkAccessibility(x.presentation), [x.presentation]);
  const groups = (['error', 'warning', 'tip'] as const).map((severity) => ({ severity, items: issues.filter((i) => i.severity === severity) }));
  return (
    <PaneShell title="Trợ năng" onClose={onClose}>
      {issues.length === 0 ? (
        <div className="ppx-ok">Không phát hiện vấn đề trợ năng nào. Người dùng khuyết tật sẽ đọc được bài này.</div>
      ) : (
        groups.map(({ severity, items }) =>
          items.length === 0 ? null : (
            <div key={severity}>
              <div className="ppx-subhead">{SEVERITY_ICON[severity]} {SEVERITY_LABEL[severity]} ({items.length})</div>
              {items.map((issue) => (
                <button
                  type="button"
                  key={issue.id}
                  className="ppx-issue"
                  onClick={() => {
                    x.goToSlide(issue.slideIndex);
                    if (issue.elementId) setTimeout(() => x.selectElements([issue.elementId!], issue.elementId), 0);
                  }}
                >
                  <b>{ACCESSIBILITY_RULE_LABELS[issue.rule]}</b>
                  <span>{issue.message}</span>
                  <em>{issue.fix}</em>
                </button>
              ))}
            </div>
          ),
        )
      )}
      {x.selectedElement && <button type="button" className="ppt-secondary-action-btn" onClick={() => x.openDialog('alt-text')}>Sửa văn bản thay thế của đối tượng đang chọn</button>}
    </PaneShell>
  );
}

export function OutlinePanel() {
  const x = useSlideExtras();
  const setText = (slideIndex: number, elementId: string, text: string) =>
    x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === slideIndex ? { ...s, elements: s.elements.map((e) => (e.id === elementId ? { ...e, text } : e)) } : s)) }));
  return (
    <div className="ppx-outline" aria-label="Dàn ý">
      {x.presentation.slides.map((slide, index) => {
        const title = slide.elements.find((e) => e.isTitle);
        const bodies = slide.elements.filter((e) => !e.isTitle && e.type === 'text' && e.text !== undefined && !e.field);
        return (
          <div key={slide.id} className={`ppx-outline-slide ${index === x.activeSlideIndex ? 'is-active' : ''}`} onClick={() => x.goToSlide(index)}>
            <span className="ppx-outline-num">{index + 1}</span>
            <div className="ppx-outline-body">
              {title ? (
                <textarea className="ppx-outline-title" rows={1} value={title.text ?? ''} onChange={(e) => setText(index, title.id, e.target.value)} />
              ) : (
                <div className="ppx-outline-title ppx-muted">(Không có tiêu đề)</div>
              )}
              {bodies.map((body) => (
                <textarea key={body.id} className="ppx-outline-text" rows={Math.max(1, (body.text ?? '').split('\n').length)} value={body.text ?? ''} onChange={(e) => setText(index, body.id, e.target.value)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NotesPageView({ onNotesChange }: { onNotesChange: (text: string) => void }) {
  const x = useSlideExtras();
  const master = x.presentation.notesMaster;
  const width = 560;
  const zoom = (width / slideBaseWidth(x.presentation.aspectRatio)) * 100;
  return (
    <div className="ppx-notes-view">
      <div className="ppx-notes-page" style={{ fontSize: master?.bodyFontSize ?? 13 }}>
        {(master?.header || x.presentation.headerFooter?.notesHeader) && <div className="ppx-notes-hf">{master?.header || x.presentation.headerFooter?.notesHeader}</div>}
        {master?.showSlideImage !== false && (
          <div className="ppx-notes-slide" style={{ width, height: (540 * zoom) / 100 }}>
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
              <SlideCanvas slide={x.currentSlide} aspectRatio={x.presentation.aspectRatio} zoom={100} selectedElementId={null} onSelectElement={() => {}} onUpdateElement={() => {}} readOnly slideIndex={x.activeSlideIndex} />
            </div>
          </div>
        )}
        <textarea className="ppx-notes-text" value={x.currentSlide.notes ?? ''} placeholder="Bấm để thêm ghi chú" onChange={(e) => onNotesChange(e.target.value)} />
        <div className="ppx-notes-hf">
          <span>{master?.footer || x.presentation.headerFooter?.notesFooter}</span>
          {master?.showPageNumber !== false && <span>{x.activeSlideIndex + 1}</span>}
        </div>
      </div>
    </div>
  );
}
