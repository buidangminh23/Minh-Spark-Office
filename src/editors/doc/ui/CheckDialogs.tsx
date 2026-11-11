import { useMemo, useState } from 'react';
import { Accessibility, FileDiff, Hash, Upload } from 'lucide-react';
import { getText, getTextSerializersFromSchema, type Editor } from '@tiptap/core';
import { DOMParser as ProseMirrorParser } from '@tiptap/pm/model';
import { pickFile } from '../../../lib/download';
import { importDocx } from '../../../lib/docxConvertLazy';
import { importDocxFull } from '../../../lib/docxImport';
import { useDoc } from '../DocContext';
import { getPagination } from '../pagination';
import { jumpToPage } from '../actionsExtra';
import { diffWords, normalizeLines, type DiffPart } from '../docTools';
import Modal from './Modal';

type Issue = { id: string; level: 'error' | 'warning' | 'tip'; title: string; detail: string; pos: number };

const luminance = (hex: string) => {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return null;
  const channel = (i: number) => {
    const v = parseInt(raw.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

export function AccessibilityDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const issues = useMemo(() => {
    const list: Issue[] = [];
    let lastLevel = 0;
    let index = 0;
    const add = (level: Issue['level'], title: string, detail: string, pos: number) => list.push({ id: `${index++}`, level, title, detail, pos });
    editor.state.doc.descendants((node, pos) => {
      const name = node.type.name;
      if (name === 'image' && !String(node.attrs.alt ?? '').trim()) add('error', 'Ảnh thiếu mô tả', 'Người dùng trình đọc màn hình không biết ảnh này nói gì. Chọn ảnh, mở Định dạng ảnh để thêm mô tả.', pos);
      if (name === 'heading') {
        const level = Number(node.attrs.level);
        if (!node.textContent.trim()) add('warning', 'Tiêu đề trống', 'Tiêu đề không có chữ làm rối khung điều hướng.', pos);
        if (lastLevel && level > lastLevel + 1) add('warning', `Nhảy cấp tiêu đề (H${lastLevel} sang H${level})`, 'Nên tăng từng cấp một để cấu trúc tài liệu rõ ràng.', pos);
        lastLevel = level;
      }
      if (name === 'table') {
        const hasHeader = node.firstChild?.firstChild?.type.name === 'tableHeader';
        if (!hasHeader) add('warning', 'Bảng thiếu hàng tiêu đề', 'Bật Hàng tiêu đề trong tab Bảng để trình đọc màn hình đọc đúng cột.', pos);
      }
      if (node.isText) {
        const color = node.marks.find((m) => m.type.name === 'textStyle')?.attrs.color;
        if (typeof color === 'string' && color.startsWith('#')) {
          const l = luminance(color);
          if (l !== null && (1.05 / (l + 0.05)) < 4.5) add('warning', `Chữ màu ${color} khó đọc trên nền trắng`, `“${(node.text ?? '').slice(0, 40)}” có độ tương phản dưới 4,5:1.`, pos);
        }
        const link = node.marks.find((m) => m.type.name === 'link');
        if (link && /^(ở đây|tại đây|click here|here|xem thêm)$/i.test((node.text ?? '').trim())) add('tip', 'Liên kết chưa rõ nghĩa', `“${node.text}” không nói liên kết dẫn tới đâu.`, pos);
      }
      return true;
    });
    return list;
  }, [editor]);
  const jump = (pos: number) => {
    editor.chain().focus().setTextSelection(Math.min(pos + 1, editor.state.doc.content.size)).scrollIntoView().run();
    onClose();
  };
  const labels = { error: 'Lỗi', warning: 'Cảnh báo', tip: 'Gợi ý' };
  return (
    <Modal title="Kiểm tra trợ năng" subtitle={issues.length ? `Tìm thấy ${issues.length} điểm cần xem.` : undefined} icon={<Accessibility size={20} />} onClose={onClose} width={620} actions={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      {issues.length === 0 ? <div className="empty-note">Không phát hiện vấn đề nào về ảnh, tiêu đề, bảng, độ tương phản và liên kết.</div> : (
        <div className="issue-list">
          {issues.map((issue) => (
            <button key={issue.id} type="button" className={`issue-card a11y-${issue.level}`} onClick={() => jump(issue.pos)}>
              <span className="issue-head"><span className="issue-kind">{labels[issue.level]}</span><strong>{issue.title}</strong></span>
              <span className="issue-text">{issue.detail}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function GoToDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const pages = getPagination(ctx.editor).result.pages;
  const [value, setValue] = useState('1');
  const go = () => {
    const target = Math.max(1, Math.min(pages, Number(value) || 1));
    onClose();
    jumpToPage(ctx, target);
  };
  return (
    <Modal title="Đi tới trang" subtitle={`Tài liệu có ${pages} trang.`} icon={<Hash size={20} />} onClose={onClose} width={360} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={go}>Đi tới</button></>}>
      <label className="field"><span className="field-label">Số trang</span><input className="text-field" type="number" min={1} max={pages} autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
    </Modal>
  );
}

export const htmlToText = (html: string, editor: Editor) => {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const node = ProseMirrorParser.fromSchema(editor.schema).parse(body);
  return getText(node, { blockSeparator: '\n', textSerializers: getTextSerializersFromSchema(editor.schema) });
};

export const docxToHtml = async (buffer: ArrayBuffer) => (await importDocxFull(buffer).catch(async () => ({ html: await importDocx(buffer) }))).html;

export function CompareDialog({ onClose }: { onClose: () => void }) {
  const { editor, ui } = useDoc();
  const [parts, setParts] = useState<DiffPart[] | null>(null);
  const [name, setName] = useState('');
  const load = async () => {
    const file = await pickFile('.docx,.txt,.md,.html,.htm');
    if (!file) return;
    try {
      ui.showBusy(`Đang đọc ${file.name}…`);
      const lower = file.name.toLowerCase();
      const other = lower.endsWith('.docx') ? htmlToText(await docxToHtml(await file.arrayBuffer()), editor) : lower.endsWith('.html') || lower.endsWith('.htm') ? htmlToText(await file.text(), editor) : await file.text();
      setName(file.name);
      setParts(diffWords(normalizeLines(other), normalizeLines(editor.getText({ blockSeparator: '\n' }))));
    } catch {
      ui.toast('Không đọc được tệp để so sánh', true);
    } finally {
      ui.showBusy(null);
    }
  };
  const changes = parts?.filter((p) => p.type !== 'same' && p.text.trim()).length ?? 0;
  return (
    <Modal title="So sánh với tệp khác" subtitle={name ? `${name} so với bản đang mở: ${changes} chỗ khác nhau.` : 'Chọn tệp .docx, .txt, .md hoặc .html để so sánh nội dung.'} icon={<FileDiff size={20} />} onClose={onClose} width={760} actions={<><button className="btn" onClick={() => void load()}><Upload size={14} /> Chọn tệp</button><button className="btn btn-primary" onClick={onClose}>Đóng</button></>}>
      {parts ? (
        <div className="diff-view">{parts.map((part, i) => (part.type === 'same' ? <span key={i}>{part.text}</span> : <span key={i} className={part.type === 'added' ? 'diff-added' : 'diff-removed'}>{part.text}</span>))}</div>
      ) : <div className="empty-note">Chưa có gì để so sánh.</div>}
    </Modal>
  );
}
