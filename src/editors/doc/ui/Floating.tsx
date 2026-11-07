import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bold, ChevronDown, ChevronUp, ClipboardPaste, Code, Copy, Heading1, Heading2, Heading3, Highlighter, Image as ImageIcon, Italic, Link2, List, ListOrdered, ListTodo, ListTree, MessageSquarePlus, Minus, Quote, Scissors, Sparkles, Strikethrough, Table, Type, Underline, X, Calendar, ScissorsLineDashed, BarChart3, Languages, Settings2, Trash2, FileText } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { searchKey } from '../search';
import { useDoc } from '../DocContext';
import { addComment, copySelection, editLink, imageSettings, insertDateTime, insertFootnote, insertImageFromDevice, paragraphSettings, pastePlainText, pasteRich } from '../actions';

export function FindBar() {
  const { editor, view, setView } = useDoc();
  const [term, setTerm] = useState(() => {
    const { from, to, empty } = editor.state.selection;
    return empty ? '' : editor.state.doc.textBetween(from, to, ' ').slice(0, 100);
  });
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState({ matchCase: false, wholeWord: false, regex: false });
  const input = useRef<HTMLInputElement | null>(null);
  const state = useEditorState({ editor, selector: ({ editor: e }) => {
    const s = searchKey.getState(e.state);
    return { count: s?.results.length ?? 0, index: s?.index ?? -1, error: s?.error ?? null };
  } });
  useEffect(() => {
    editor.commands.setSearch(term, options);
  }, [editor, term, options]);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    return () => { editor.commands.clearSearch(); };
  }, [editor]);
  const close = () => {
    setView({ showFind: false });
    editor.commands.focus();
  };
  const toggle = (key: keyof typeof options) => setOptions({ ...options, [key]: !options[key] });
  return (
    <div className="find-bar" role="search" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <div className="find-row">
        <input ref={input} className="text-field" placeholder="Tìm trong tài liệu" value={term} aria-label="Tìm" onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') editor.commands.gotoMatch(e.shiftKey ? -1 : 1); }} />
        <span className="find-count">{state.error ? 'Biểu thức lỗi' : term ? `${state.count ? state.index + 1 : 0}/${state.count}` : ''}</span>
        <button className="icon-btn" title="Kết quả trước (Shift+Enter)" aria-label="Trước" disabled={!state.count} onClick={() => editor.commands.gotoMatch(-1)}><ChevronUp size={15} /></button>
        <button className="icon-btn" title="Kết quả sau (Enter)" aria-label="Sau" disabled={!state.count} onClick={() => editor.commands.gotoMatch(1)}><ChevronDown size={15} /></button>
        <button className="icon-btn" title="Đóng (Esc)" aria-label="Đóng" onClick={close}><X size={15} /></button>
      </div>
      <div className="find-options">
        <button type="button" className={`find-opt ${options.matchCase ? 'on' : ''}`} title="Phân biệt hoa/thường" onClick={() => toggle('matchCase')}>Aa</button>
        <button type="button" className={`find-opt ${options.wholeWord ? 'on' : ''}`} title="Khớp nguyên từ" onClick={() => toggle('wholeWord')}>ab|</button>
        <button type="button" className={`find-opt ${options.regex ? 'on' : ''}`} title="Biểu thức chính quy" onClick={() => toggle('regex')}>.*</button>
        <button type="button" className="find-opt link" onClick={() => setView({ findReplace: !view.findReplace })}>{view.findReplace ? 'Ẩn thay thế' : 'Thay thế…'}</button>
      </div>
      {view.findReplace && (
        <div className="find-row">
          <input className="text-field" placeholder="Thay bằng" value={replacement} aria-label="Thay bằng" onChange={(e) => setReplacement(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && editor.commands.replaceMatch(replacement)} />
          <button className="btn" disabled={!state.count} onClick={() => editor.commands.replaceMatch(replacement)}>Thay</button>
          <button className="btn" disabled={!state.count} onClick={() => editor.commands.replaceAllMatches(replacement)}>Thay tất cả</button>
        </div>
      )}
    </div>
  );
}

const usePosition = (anchor: { left: number; top: number } | null, ref: React.RefObject<HTMLDivElement | null>) => {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const left = anchor?.left;
  const top = anchor?.top;
  useLayoutEffect(() => {
    if (left === undefined || top === undefined) return setPos(null);
    const rect = ref.current?.getBoundingClientRect();
    const next = rect
      ? { left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)), top: Math.max(8, Math.min(top, window.innerHeight - rect.height - 8)) }
      : { left, top };
    setPos((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
  }, [left, top, ref]);
  return pos ?? anchor;
};

export function SelectionBubble() {
  const ctx = useDoc();
  const { editor } = ctx;
  const ref = useRef<HTMLDivElement | null>(null);
  const info = useEditorState({ editor, selector: ({ editor: e }) => {
    const { from, to, empty } = e.state.selection;
    if (empty || !e.isEditable || e.isActive('image') || !e.view.hasFocus()) return null;
    if (!e.state.doc.textBetween(from, to, ' ').trim()) return null;
    const start = e.view.coordsAtPos(from);
    const end = e.view.coordsAtPos(to);
    return { left: (start.left + end.left) / 2 - 150, top: Math.min(start.top, end.top) - 48, bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike') };
  }, equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const pos = usePosition(info ? { left: info.left, top: info.top } : null, ref);
  if (!info || !pos) return null;
  const chain = () => editor.chain().focus();
  return (
    <div ref={ref} className="selection-bubble" style={{ left: pos.left, top: pos.top }} onMouseDown={(e) => e.preventDefault()}>
      <button className={info.bold ? 'on' : ''} title="Đậm" aria-label="Đậm" onClick={() => chain().toggleBold().run()}><Bold size={14} /></button>
      <button className={info.italic ? 'on' : ''} title="Nghiêng" aria-label="Nghiêng" onClick={() => chain().toggleItalic().run()}><Italic size={14} /></button>
      <button className={info.underline ? 'on' : ''} title="Gạch chân" aria-label="Gạch chân" onClick={() => chain().toggleUnderline().run()}><Underline size={14} /></button>
      <button className={info.strike ? 'on' : ''} title="Gạch ngang" aria-label="Gạch ngang" onClick={() => chain().toggleStrike().run()}><Strikethrough size={14} /></button>
      <button title="Tô sáng" aria-label="Tô sáng" onClick={() => chain().toggleHighlight({ color: '#fff59d' }).run()}><Highlighter size={14} /></button>
      <span className="bubble-sep" />
      <button title="Liên kết (Ctrl+K)" aria-label="Liên kết" onClick={() => void editLink(ctx)}><Link2 size={14} /></button>
      <button title="Bình luận (Ctrl+Alt+M)" aria-label="Bình luận" onClick={() => void addComment(ctx)}><MessageSquarePlus size={14} /></button>
      <button className="ai" title="Minh AI" aria-label="Minh AI" onClick={() => ctx.openDialog('ai')}><Sparkles size={14} /> AI</button>
    </div>
  );
}

type MenuEntry = { label: string; icon: React.ReactNode; hint?: string; run: () => void; danger?: boolean } | 'sep';

export function ContextMenu({ at, onClose }: { at: { x: number; y: number }; onClose: () => void }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const ref = useRef<HTMLDivElement | null>(null);
  const pos = usePosition({ left: at.x, top: at.y }, ref);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('blur', onClose);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); window.removeEventListener('blur', onClose); };
  }, [onClose]);
  const inTable = editor.isActive('table');
  const onImage = editor.isActive('image');
  const onLink = editor.isActive('link');
  const chain = () => editor.chain().focus();
  const entries: MenuEntry[] = [
    { label: 'Cắt', icon: <Scissors size={14} />, hint: 'Ctrl+X', run: () => copySelection(ctx, true) },
    { label: 'Sao chép', icon: <Copy size={14} />, hint: 'Ctrl+C', run: () => copySelection(ctx, false) },
    { label: 'Dán', icon: <ClipboardPaste size={14} />, hint: 'Ctrl+V', run: () => void pasteRich(ctx) },
    { label: 'Dán chỉ lấy chữ', icon: <Type size={14} />, hint: 'Ctrl+Shift+V', run: () => void pastePlainText(ctx) },
    'sep',
    ...(onImage ? [{ label: 'Định dạng ảnh…', icon: <Settings2 size={14} />, run: () => void imageSettings(ctx) }, { label: 'Xoá ảnh', icon: <Trash2 size={14} />, run: () => chain().deleteSelection().run(), danger: true }, 'sep' as const] : []),
    ...(inTable ? [
      { label: 'Chèn hàng phía trên', icon: <Table size={14} />, run: () => chain().addRowBefore().run() },
      { label: 'Chèn hàng phía dưới', icon: <Table size={14} />, run: () => chain().addRowAfter().run() },
      { label: 'Chèn cột bên trái', icon: <Table size={14} />, run: () => chain().addColumnBefore().run() },
      { label: 'Chèn cột bên phải', icon: <Table size={14} />, run: () => chain().addColumnAfter().run() },
      { label: 'Gộp/tách ô', icon: <Table size={14} />, run: () => chain().mergeOrSplit().run() },
      { label: 'Xoá hàng', icon: <Trash2 size={14} />, run: () => chain().deleteRow().run(), danger: true },
      { label: 'Xoá cột', icon: <Trash2 size={14} />, run: () => chain().deleteColumn().run(), danger: true },
      { label: 'Xoá bảng', icon: <Trash2 size={14} />, run: () => chain().deleteTable().run(), danger: true },
      'sep' as const,
    ] : []),
    { label: onLink ? 'Sửa liên kết…' : 'Liên kết…', icon: <Link2 size={14} />, hint: 'Ctrl+K', run: () => void editLink(ctx) },
    ...(onLink ? [{ label: 'Mở liên kết', icon: <Link2 size={14} />, run: () => window.open(editor.getAttributes('link').href, '_blank', 'noopener') }, { label: 'Bỏ liên kết', icon: <X size={14} />, run: () => chain().extendMarkRange('link').unsetLink().run() }] : []),
    { label: 'Bình luận mới', icon: <MessageSquarePlus size={14} />, hint: 'Ctrl+Alt+M', run: () => void addComment(ctx) },
    { label: 'Chú thích cuối trang', icon: <FileText size={14} />, run: () => void insertFootnote(ctx) },
    'sep',
    { label: 'Đoạn văn…', icon: <Settings2 size={14} />, run: () => void paragraphSettings(ctx) },
    { label: 'Minh AI…', icon: <Sparkles size={14} />, run: () => ctx.openDialog('ai') },
    { label: 'Dịch…', icon: <Languages size={14} />, run: () => ctx.openDialog('translate') },
  ];
  return (
    <div ref={ref} className="context-menu ribbon-menu" role="menu" style={{ left: pos?.left, top: pos?.top }} onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {entries.map((entry, i) => entry === 'sep' ? <div key={i} className="ribbon-menu-sep" /> : (
        <button key={entry.label} type="button" role="menuitem" className={`ribbon-menu-item ${entry.danger ? 'danger' : ''}`} onClick={() => { onClose(); entry.run(); }}>
          <span className="menu-icon">{entry.icon}</span><span className="menu-label">{entry.label}</span>{entry.hint && <span className="menu-hint">{entry.hint}</span>}
        </button>
      ))}
    </div>
  );
}

type SlashItem = { id: string; label: string; keywords: string; icon: React.ReactNode; run: () => void };

export function SlashMenu() {
  const ctx = useDoc();
  const { editor } = ctx;
  const ref = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const query = useEditorState({ editor, selector: ({ editor: e }) => {
    const { $from, empty } = e.state.selection;
    if (!empty || !e.isEditable || !$from.parent.isTextblock || e.isActive('codeBlock')) return null;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const match = /(?:^|\s)\/([\p{L}\p{N}]{0,20})$/u.exec(before);
    if (!match) return null;
    const coords = e.view.coordsAtPos($from.pos);
    return { text: match[1], from: $from.pos - match[1].length - 1, to: $from.pos, left: coords.left, top: coords.bottom + 6 };
  }, equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const items: SlashItem[] = useMemo(() => [
    { id: 'h1', label: 'Tiêu đề 1', keywords: 'heading tieu de h1', icon: <Heading1 size={15} />, run: () => editor.chain().focus().setHeading({ level: 1 }).run() },
    { id: 'h2', label: 'Tiêu đề 2', keywords: 'heading tieu de h2', icon: <Heading2 size={15} />, run: () => editor.chain().focus().setHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Tiêu đề 3', keywords: 'heading tieu de h3', icon: <Heading3 size={15} />, run: () => editor.chain().focus().setHeading({ level: 3 }).run() },
    { id: 'bullet', label: 'Danh sách dấu chấm', keywords: 'bullet list danh sach', icon: <List size={15} />, run: () => editor.chain().focus().toggleBulletList().run() },
    { id: 'number', label: 'Danh sách đánh số', keywords: 'number ordered danh so', icon: <ListOrdered size={15} />, run: () => editor.chain().focus().toggleOrderedList().run() },
    { id: 'todo', label: 'Việc cần làm', keywords: 'todo checklist task viec', icon: <ListTodo size={15} />, run: () => editor.chain().focus().toggleTaskList().run() },
    { id: 'table', label: 'Bảng 3×3', keywords: 'table bang', icon: <Table size={15} />, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'image', label: 'Ảnh', keywords: 'image anh hinh picture', icon: <ImageIcon size={15} />, run: () => void insertImageFromDevice(ctx) },
    { id: 'chart', label: 'Biểu đồ', keywords: 'chart bieu do', icon: <BarChart3 size={15} />, run: () => ctx.openDialog('chart') },
    { id: 'quote', label: 'Trích dẫn', keywords: 'quote trich dan', icon: <Quote size={15} />, run: () => editor.chain().focus().toggleBlockquote().run() },
    { id: 'code', label: 'Khối mã', keywords: 'code ma', icon: <Code size={15} />, run: () => editor.chain().focus().toggleCodeBlock().run() },
    { id: 'divider', label: 'Đường kẻ ngang', keywords: 'divider hr duong ke line', icon: <Minus size={15} />, run: () => editor.chain().focus().setHorizontalRule().run() },
    { id: 'toc', label: 'Mục lục', keywords: 'toc muc luc', icon: <ListTree size={15} />, run: () => editor.chain().focus().insertDocList('tableOfContents').run() },
    { id: 'break', label: 'Ngắt trang', keywords: 'page break ngat trang', icon: <ScissorsLineDashed size={15} />, run: () => editor.chain().focus().insertPageBreak().run() },
    { id: 'date', label: 'Ngày hôm nay', keywords: 'date ngay hom nay', icon: <Calendar size={15} />, run: () => insertDateTime(ctx, 'date') },
    { id: 'ai', label: 'Minh AI', keywords: 'ai tri tue viet', icon: <Sparkles size={15} />, run: () => ctx.openDialog('ai') },
  ], [editor, ctx]);
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
  const filtered = query ? items.filter((item) => fold(`${item.label} ${item.keywords}`).includes(fold(query.text))) : [];
  useEffect(() => setIndex(0), [query?.text]);
  const pos = usePosition(query ? { left: query.left, top: query.top } : null, ref);
  const choose = (item: SlashItem) => {
    if (!query) return;
    editor.chain().focus().deleteRange({ from: query.from, to: query.to }).run();
    item.run();
  };
  useEffect(() => {
    if (!query || !filtered.length) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % filtered.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + filtered.length) % filtered.length); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); choose(filtered[index]); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });
  if (!query || !filtered.length || !pos) return null;
  return (
    <div ref={ref} className="slash-menu ribbon-menu" role="listbox" style={{ left: pos.left, top: pos.top }} onMouseDown={(e) => e.preventDefault()}>
      <div className="ribbon-menu-heading">Chèn nhanh</div>
      {filtered.map((item, i) => (
        <button key={item.id} type="button" role="option" aria-selected={i === index} className={`ribbon-menu-item ${i === index ? 'active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => choose(item)}>
          <span className="menu-icon">{item.icon}</span><span className="menu-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
