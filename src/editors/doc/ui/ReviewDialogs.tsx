import { useEffect, useMemo, useState } from 'react';
import { Bookmark, FileDiff, History, SpellCheck, Trash2 } from 'lucide-react';
import { deleteVersion, listVersions, restoreVersion, saveVersion, type DocContent, type FileVersion } from '../../../lib/storage';
import { useDoc } from '../DocContext';
import { diffWords, jsonText, proofread, textStats, type ProofIssue } from '../docTools';
import Modal from './Modal';

export function ProofreadDialog({ onClose }: { onClose: () => void }) {
  const { editor, ui } = useDoc();
  const [issues, setIssues] = useState<ProofIssue[]>(() => proofread(editor.state.doc));
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const visible = issues.filter((i) => !ignored.has(i.id));
  const stats = useMemo(() => textStats(editor.getText({ blockSeparator: '\n' })), [editor, issues]);
  const recheck = () => setIssues(proofread(editor.state.doc));
  const select = (issue: ProofIssue) => editor.chain().focus().setTextSelection({ from: issue.from, to: issue.to }).scrollIntoView().run();
  const fix = (issue: ProofIssue) => {
    if (issue.suggestion === null) return;
    const current = editor.state.doc.textBetween(issue.from, issue.to);
    if (current !== issue.text) return recheck();
    editor.chain().focus().insertContentAt({ from: issue.from, to: issue.to }, issue.suggestion).run();
    recheck();
  };
  const fixAll = () => {
    const fixable = visible.filter((i) => i.suggestion !== null).sort((a, b) => b.from - a.from);
    let last = Infinity;
    const tr = editor.state.tr;
    for (const issue of fixable) {
      if (issue.to > last) continue;
      tr.insertText(issue.suggestion!, issue.from, issue.to);
      last = issue.from;
    }
    editor.view.dispatch(tr);
    ui.toast(`Đã sửa ${fixable.length} lỗi`);
    recheck();
  };
  const KIND = { spelling: 'Chính tả', grammar: 'Ngữ pháp', style: 'Trình bày' };
  return (
    <Modal title="Chính tả & ngữ pháp" subtitle={`${visible.length} vấn đề · độ dễ đọc ${stats.readability}/100 · ${stats.words.toLocaleString('vi-VN')} từ · câu trung bình ${stats.avgSentence.toFixed(1)} từ`} icon={<SpellCheck size={20} />} onClose={onClose} width={680}
      actions={<><button className="btn" onClick={recheck}>Kiểm tra lại</button><button className="btn btn-primary" disabled={!visible.some((i) => i.suggestion !== null)} onClick={fixAll}>Sửa tất cả lỗi có gợi ý</button></>}>
      {visible.length === 0 ? <div className="empty-note">Không phát hiện lỗi nào. Văn bản sạch.</div> : (
        <div className="issue-list">
          {visible.map((issue) => (
            <div key={issue.id} className={`issue-card ${issue.kind}`} onClick={() => select(issue)}>
              <div className="issue-head"><span className="issue-kind">{KIND[issue.kind]}</span><span>{issue.message}</span></div>
              <div className="issue-text">“{issue.text.replace(/ /g, '·')}”{issue.suggestion !== null && <> → <strong>“{issue.suggestion}”</strong></>}</div>
              <div className="issue-actions">
                {issue.suggestion !== null && <button className="btn" onClick={(e) => { e.stopPropagation(); fix(issue); }}>Sửa</button>}
                <button className="btn" onClick={(e) => { e.stopPropagation(); setIgnored(new Set([...ignored, issue.id])); }}>Bỏ qua</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [label, setLabel] = useState('');
  const [compare, setCompare] = useState<FileVersion | null>(null);
  useEffect(() => { void listVersions(ctx.meta.id).then(setVersions); }, [ctx.meta.id]);
  const content = (): DocContent => ({ kind: 'doc', json: ctx.editor.getJSON(), page: ctx.page, comments: ctx.comments });
  const snapshot = async () => {
    const saved = await saveVersion(ctx.meta.id, content(), label.trim() || undefined);
    setVersions((list) => [saved, ...list]);
    setLabel('');
    ctx.ui.toast('Đã lưu phiên bản');
  };
  const restore = async (v: FileVersion) => {
    if (!(await ctx.ui.confirm('Khôi phục phiên bản?', `Tài liệu sẽ trở về “${v.label}”. Trạng thái hiện tại được lưu thành một phiên bản để có thể quay lại.`))) return;
    await saveVersion(ctx.meta.id, content(), `Trước khi khôi phục (${new Date().toLocaleTimeString('vi-VN')})`);
    await restoreVersion(ctx.meta.id, v.id);
    const doc = v.content as DocContent;
    ctx.editor.commands.setContent(doc.json);
    if (doc.page) ctx.setPage(doc.page);
    if (doc.comments) ctx.setComments(() => doc.comments ?? []);
    ctx.markDirty();
    ctx.ui.toast(`Đã khôi phục “${v.label}”`);
    onClose();
  };
  const diff = useMemo(() => (compare ? diffWords(jsonText((compare.content as DocContent).json), ctx.editor.getText({ blockSeparator: '\n' }) + '\n') : []), [compare, ctx.editor]);
  if (compare) {
    const added = diff.filter((d) => d.type === 'added').reduce((n, d) => n + d.text.trim().split(/\s+/).filter(Boolean).length, 0);
    const removed = diff.filter((d) => d.type === 'removed').reduce((n, d) => n + d.text.trim().split(/\s+/).filter(Boolean).length, 0);
    return (
      <Modal title="So sánh phiên bản" subtitle={<>“{compare.label}” → bản hiện tại · <span className="diff-added">+{added} từ</span> · <span className="diff-removed">−{removed} từ</span></>} icon={<FileDiff size={20} />} onClose={onClose} width={820} actions={<><button className="btn" onClick={() => setCompare(null)}>Quay lại</button><button className="btn btn-primary" onClick={() => void restore(compare)}>Khôi phục bản cũ</button></>}>
        <div className="diff-view">{diff.map((part, i) => <span key={i} className={`diff-${part.type}`}>{part.text}</span>)}</div>
      </Modal>
    );
  }
  return (
    <Modal title="Lịch sử phiên bản" subtitle="Lưu, so sánh và khôi phục các phiên bản của tài liệu" icon={<History size={20} />} onClose={onClose} width={680}>
      <div className="ai-prompt">
        <input className="text-field" placeholder="Tên phiên bản, ví dụ: Bản gửi sếp duyệt" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void snapshot()} />
        <button className="btn btn-primary" onClick={() => void snapshot()}><Bookmark size={14} /> Lưu phiên bản</button>
      </div>
      <div className="version-list">
        {versions.length === 0 && <div className="empty-note">Chưa có phiên bản nào. Phiên bản tự động được tạo mỗi 10 phút khi tài liệu thay đổi.</div>}
        {versions.map((v) => (
          <div key={v.id} className="version-row">
            <div><strong>{v.label}</strong><div className="muted">{new Date(v.timestamp).toLocaleString('vi-VN')}</div></div>
            <div className="version-actions">
              <button className="btn" onClick={() => setCompare(v)}>So sánh</button>
              <button className="btn" onClick={() => void restore(v)}>Khôi phục</button>
              <button className="icon-btn" aria-label="Xoá phiên bản" onClick={async () => { await deleteVersion(ctx.meta.id, v.id); setVersions((list) => list.filter((x) => x.id !== v.id)); }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
