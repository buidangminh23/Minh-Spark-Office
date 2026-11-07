import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowDownUp, Bookmark, Blocks, CalendarClock, CaseUpper, FileSignature, FileUp, Grid3x3, Hash, Paperclip, Trash2, Video, Variable } from 'lucide-react';
import { pickFile, readAsDataUrl, formatBytes } from '../../../../lib/download';
import { PAGE_SIZES, type PageNumberFormat, type PageNumberPosition } from '../../../../lib/storage';
import { newId, useDoc } from '../../DocContext';
import { insertBlock, insertTableJson, insertTextFromFile, loadBlocks, saveBlocks, saveSelectionAsBlock, tableJson, type BuildingBlock } from '../../insertActions';
import { DATE_FORMATS, defaultFormat, FIELD_KINDS, formatDate, type FieldKind } from '../../insertFields';
import { NUMBER_FORMATS, NUMBER_POSITIONS } from '../../insertGalleries';
import { ESIGN_KINDS, esignLabel, fieldText, videoEmbedUrl } from '../../insertNodes';
import { pageNumberText } from '../../pageFormat';
import Modal from '../Modal';

export function VideoDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [url, setUrl] = useState('');
  const [width, setWidth] = useState(100);
  const embed = videoEmbedUrl(url);
  const insert = () => {
    ctx.editor.chain().focus().insertVideoEmbed(url.trim(), width).run();
    onClose();
  };
  return (
    <Modal title="Video trực tuyến" subtitle="Dán liên kết YouTube hoặc Vimeo. Khi xuất tệp, video trở thành một liên kết." icon={<Video size={20} />} onClose={onClose} width={640} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!embed} onClick={insert}>Chèn</button></>}>
      <label className="field"><span className="field-label">Địa chỉ video</span><input className="text-field" autoFocus placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      <label className="field"><span className="field-label">Chiều rộng: {width}% khổ trang</span><input type="range" min={30} max={100} step={5} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
      {url.trim() && !embed && <div className="field-error">Chỉ nhận liên kết YouTube hoặc Vimeo.</div>}
      {embed && <div className="insert-video-preview"><iframe src={embed} title="Xem trước video" allowFullScreen /></div>}
    </Modal>
  );
}

const MAX_OBJECT_BYTES = 5 * 1024 * 1024;

export function ObjectDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const embed = async () => {
    const file = await pickFile('*/*');
    if (!file) return;
    if (file.size > MAX_OBJECT_BYTES) {
      ctx.ui.toast(`Tệp quá lớn (${formatBytes(file.size)}). Giới hạn đính kèm là 5 MB.`, true);
      return;
    }
    ctx.editor.chain().focus().insertFileObject({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream', data: await readAsDataUrl(file) }).run();
    ctx.ui.toast(`Đã đính kèm ${file.name}. Nhấp đúp để tải lại.`);
    onClose();
  };
  return (
    <Modal title="Đối tượng" icon={<Paperclip size={20} />} onClose={onClose} width={520} actions={<button className="btn" onClick={onClose}>Đóng</button>}>
      <div className="export-grid">
        <button className="export-tile" onClick={() => void embed()}><Paperclip size={22} color="#2b579a" /><div><strong>Đính kèm tệp</strong><span>Lưu tệp ngay trong tài liệu, tối đa 5 MB. Nhấp đúp để tải lại.</span></div></button>
        <button className="export-tile" onClick={() => { onClose(); void insertTextFromFile(ctx); }}><FileUp size={22} color="#107c41" /><div><strong>Văn bản từ tệp</strong><span>Chèn nội dung .docx, .html, .txt, .md tại con trỏ.</span></div></button>
      </div>
    </Modal>
  );
}

type BookmarkRow = { name: string; pos: number; size: number; context: string };

const listBookmarks = (editor: ReturnType<typeof useDoc>['editor']) => {
  const rows: BookmarkRow[] = [];
  editor.state.doc.descendants((node, pos, parent) => {
    if (node.type.name === 'bookmark') rows.push({ name: String(node.attrs.name), pos, size: node.nodeSize, context: parent?.textContent.slice(0, 60) ?? '' });
  });
  return rows;
};

export function BookmarksDialog({ onClose }: { onClose: () => void }) {
  const { editor, ui } = useDoc();
  const [rows, setRows] = useState(() => listBookmarks(editor));
  const [name, setName] = useState('');
  const [sort, setSort] = useState<'name' | 'position'>('name');
  const shown = useMemo(() => [...rows].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'vi') : a.pos - b.pos)), [rows, sort]);
  const clean = name.trim().replace(/\s+/g, '-');
  const add = () => {
    if (rows.some((row) => row.name === clean)) {
      ui.toast('Tên dấu trang đã tồn tại', true);
      return;
    }
    editor.chain().focus().insertBookmark(clean).run();
    setRows(listBookmarks(editor));
    setName('');
  };
  const go = (row: BookmarkRow) => {
    editor.chain().focus().setTextSelection(row.pos).scrollIntoView().run();
    onClose();
  };
  const remove = (row: BookmarkRow) => {
    editor.view.dispatch(editor.state.tr.delete(row.pos, row.pos + row.size));
    setRows(listBookmarks(editor));
  };
  return (
    <Modal title="Dấu trang" subtitle="Thêm dấu trang tại con trỏ, nhảy tới hoặc xoá." icon={<Bookmark size={20} />} onClose={onClose} width={560} actions={<button className="btn" onClick={onClose}>Đóng</button>}>
      <div className="symbol-code">
        <input className="text-field" placeholder="Tên dấu trang" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && clean) add(); }} />
        <button className="btn btn-primary" disabled={!clean} onClick={add}>Thêm</button>
        <button className="btn" onClick={() => setSort(sort === 'name' ? 'position' : 'name')} title="Đổi cách sắp xếp">{sort === 'name' ? <ArrowDownAZ size={14} /> : <ArrowDownUp size={14} />}{sort === 'name' ? 'Theo tên' : 'Theo vị trí'}</button>
      </div>
      <div className="insert-list">
        {shown.length === 0 && <div className="panel-empty">Tài liệu chưa có dấu trang.</div>}
        {shown.map((row) => (
          <div key={`${row.name}-${row.pos}`} className="insert-list-row">
            <div><strong>{row.name}</strong><span>{row.context || 'Đoạn trống'}</span></div>
            <button className="btn snippet" onClick={() => go(row)}>Đi tới</button>
            <button className="icon-btn" aria-label={`Xoá ${row.name}`} title="Xoá" onClick={() => remove(row)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function QuickPartsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [blocks, setBlocks] = useState<BuildingBlock[]>(loadBlocks);
  const update = (next: BuildingBlock[]) => { saveBlocks(next); setBlocks(next); };
  const preview = (block: BuildingBlock) => block.description || block.json.map((node) => JSON.stringify(node).replace(/.*?"text":"([^"]*)".*/, '$1')).join(' ').slice(0, 80);
  const rename = async (block: BuildingBlock) => {
    const res = await ctx.ui.ask({ title: 'Sửa khối', fields: [{ name: 'name', label: 'Tên', value: block.name }, { name: 'description', label: 'Mô tả', value: block.description ?? '' }], confirmText: 'Lưu' });
    if (res) update(blocks.map((item) => (item.id === block.id ? { ...item, name: String(res.name).trim() || item.name, description: String(res.description) } : item)));
  };
  return (
    <Modal title="Quản lý khối dựng sẵn" subtitle="Các khối lưu trên máy này và dùng được cho mọi tài liệu." icon={<Blocks size={20} />} onClose={onClose} width={640} actions={<><button className="btn" onClick={() => { void saveSelectionAsBlock(ctx).then(() => setBlocks(loadBlocks())); }}>Lưu vùng chọn thành khối</button><button className="btn" onClick={onClose}>Đóng</button></>}>
      <div className="insert-list">
        {blocks.length === 0 && <div className="panel-empty">Chưa có khối nào. Bôi chọn nội dung rồi bấm “Lưu vùng chọn thành khối”.</div>}
        {blocks.map((block) => (
          <div key={block.id} className="insert-list-row">
            <div><strong>{block.name}</strong><span>{block.gallery} · {preview(block)}</span></div>
            <button className="btn snippet" onClick={() => { insertBlock(ctx, block); onClose(); }}>Chèn</button>
            <button className="btn snippet" onClick={() => void rename(block)}>Sửa</button>
            <button className="icon-btn" aria-label={`Xoá ${block.name}`} title="Xoá" onClick={() => update(blocks.filter((item) => item.id !== block.id))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function FieldsDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const [kind, setKind] = useState<FieldKind>('page');
  const [format, setFormat] = useState('');
  const timeLike = kind === 'date' || kind === 'time';
  const effective = format || defaultFormat(kind);
  const insert = () => {
    editor.chain().focus().insertDocField(kind, effective).run();
    onClose();
  };
  return (
    <Modal title="Trường" subtitle="Trường tự cập nhật theo tài liệu. Khi xuất tệp, trường trở thành chữ thường." icon={<Variable size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="insert-list compact" role="listbox" aria-label="Loại trường">
        {FIELD_KINDS.map((item) => (
          <button key={item.id} type="button" role="option" aria-selected={kind === item.id} className={`insert-list-row selectable ${kind === item.id ? 'on' : ''}`} onClick={() => { setKind(item.id); setFormat(''); }}>
            <div><strong>{item.label}</strong><span>{item.hint}</span></div>
          </button>
        ))}
      </div>
      {timeLike && <label className="field"><span className="field-label">Định dạng</span><select className="text-field" value={effective} onChange={(e) => setFormat(e.target.value)}>{DATE_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.render(new Date())}</option>)}</select></label>}
      <div className="insert-field-preview"><span className="field-label">Xem trước</span><strong>{fieldText(editor, { kind, format: effective })}</strong></div>
    </Modal>
  );
}

export function DateTimeDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const [format, setFormat] = useState('short');
  const [live, setLive] = useState(false);
  const insert = () => {
    const isClock = format === 'time' || format === 'time-seconds';
    if (live) editor.chain().focus().insertDocField(isClock ? 'time' : 'date', format).run();
    else editor.chain().focus().insertContent(formatDate(format)).run();
    onClose();
  };
  return (
    <Modal title="Ngày và giờ" icon={<CalendarClock size={20} />} onClose={onClose} width={460} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <div className="insert-list compact" role="listbox" aria-label="Định dạng ngày giờ">
        {DATE_FORMATS.map((item) => <button key={item.id} type="button" role="option" aria-selected={format === item.id} className={`insert-list-row selectable ${format === item.id ? 'on' : ''}`} onClick={() => setFormat(item.id)} onDoubleClick={insert}><div><strong>{item.render(new Date())}</strong></div></button>)}
      </div>
      <div className="check-row"><label><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Tự động cập nhật mỗi lần mở tài liệu</label></div>
    </Modal>
  );
}

export function DropCapDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const attrs = editor.getAttributes('paragraph');
  const [mode, setMode] = useState<string>(attrs.dropCap ? String(attrs.dropCapMode ?? 'dropped') : 'none');
  const [lines, setLines] = useState(Number(attrs.dropCapLines) || 3);
  const [gap, setGap] = useState(Number(attrs.dropCapGap) || 4);
  const apply = () => {
    if (mode === 'none') editor.chain().focus().setParagraphAttrs({ dropCap: false, dropCapMode: null, dropCapLines: null, dropCapGap: null }).run();
    else editor.chain().focus().setParagraphAttrs({ dropCap: true, dropCapMode: mode, dropCapLines: lines, dropCapGap: gap }).run();
    onClose();
  };
  return (
    <Modal title="Chữ hoa lớn đầu đoạn" icon={<CaseUpper size={20} />} onClose={onClose} width={440} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="check-row">
        {[{ id: 'none', label: 'Không' }, { id: 'dropped', label: 'Trong đoạn' }, { id: 'margin', label: 'Trên lề' }].map((item) => <label key={item.id}><input type="radio" name="dropcap-mode" checked={mode === item.id} onChange={() => setMode(item.id)} /> {item.label}</label>)}
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Số dòng phủ</span><input className="text-field" type="number" min={2} max={6} disabled={mode === 'none'} value={lines} onChange={(e) => setLines(Math.max(2, Math.min(6, Number(e.target.value) || 3)))} /></label>
        <label className="field"><span className="field-label">Khoảng cách với chữ (px)</span><input className="text-field" type="number" min={0} max={40} disabled={mode === 'none'} value={gap} onChange={(e) => setGap(Math.max(0, Math.min(40, Number(e.target.value) || 0)))} /></label>
      </div>
    </Modal>
  );
}

export function PageNumberDialog({ onClose }: { onClose: () => void }) {
  const { page, setPage } = useDoc();
  const [format, setFormat] = useState<PageNumberFormat>(page.pageNumberFormat ?? 'page-of');
  const [position, setPosition] = useState<PageNumberPosition>(page.pageNumberPosition ?? 'bottom-right');
  const [start, setStart] = useState(page.pageNumberStart ?? 1);
  const [hideFirst, setHideFirst] = useState(Boolean(page.differentFirstPage));
  const apply = () => {
    setPage({ pageNumbers: true, pageNumberFormat: format, pageNumberPosition: position, pageNumberStart: start, differentFirstPage: hideFirst });
    onClose();
  };
  return (
    <Modal title="Định dạng số trang" icon={<Hash size={20} />} onClose={onClose} width={480} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Kiểu số</span><select className="text-field" value={format} onChange={(e) => setFormat(e.target.value as PageNumberFormat)}>{NUMBER_FORMATS.map((item) => <option key={item} value={item}>{pageNumberText(item, 3, 12)}</option>)}</select></label>
        <label className="field"><span className="field-label">Vị trí</span><select className="text-field" value={position} onChange={(e) => setPosition(e.target.value as PageNumberPosition)}>{NUMBER_POSITIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Bắt đầu từ</span><input className="text-field" type="number" min={0} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))} /></label>
      </div>
      <div className="check-row"><label><input type="checkbox" checked={hideFirst} onChange={(e) => setHideFirst(e.target.checked)} /> Không hiện số ở trang đầu</label></div>
    </Modal>
  );
}

type Point = { x: number; y: number };
const BOARD_W = 640;
const BOARD_H = 380;
const HIT = 8;

export function DrawTableDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const svg = useRef<SVGSVGElement | null>(null);
  const [outer, setOuter] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cols, setCols] = useState<number[]>([]);
  const [rows, setRows] = useState<number[]>([]);
  const [erase, setErase] = useState(false);
  const [header, setHeader] = useState(true);
  const [drag, setDrag] = useState<{ start: Point; now: Point } | null>(null);
  const point = (e: React.PointerEvent): Point => {
    const rect = svg.current!.getBoundingClientRect();
    return { x: Math.round(((e.clientX - rect.left) * BOARD_W) / rect.width), y: Math.round(((e.clientY - rect.top) * BOARD_H) / rect.height) };
  };
  const finish = () => {
    if (!drag) return;
    const { start, now } = drag;
    setDrag(null);
    const dx = Math.abs(now.x - start.x);
    const dy = Math.abs(now.y - start.y);
    if (!outer) {
      if (dx > 40 && dy > 20) setOuter({ x: Math.min(start.x, now.x), y: Math.min(start.y, now.y), w: dx, h: dy });
      return;
    }
    if (Math.max(dx, dy) < 12) return;
    if (dx > dy) {
      if (start.y > outer.y + HIT && start.y < outer.y + outer.h - HIT) setRows((list) => [...new Set([...list, start.y])].sort((a, b) => a - b));
    } else if (start.x > outer.x + HIT && start.x < outer.x + outer.w - HIT) setCols((list) => [...new Set([...list, start.x])].sort((a, b) => a - b));
  };
  const eraseAt = (p: Point) => {
    setCols((list) => list.filter((x) => Math.abs(x - p.x) > HIT));
    setRows((list) => list.filter((y) => Math.abs(y - p.y) > HIT));
  };
  const insert = () => {
    if (!outer) return;
    const size = PAGE_SIZES[ctx.page.size];
    const pageWidth = ctx.page.orientation === 'landscape' ? size.height : size.width;
    const contentWidth = pageWidth - ctx.page.margins.left - ctx.page.margins.right;
    const edges = [outer.x, ...cols, outer.x + outer.w];
    const widths = edges.slice(1).map((edge, i) => Math.max(24, Math.round(((edge - edges[i]) / outer.w) * contentWidth)));
    const body = Array.from({ length: rows.length + 1 }, () => widths.map(() => ''));
    insertTableJson(ctx, tableJson(body, { header, widths }));
    onClose();
  };
  const hint = !outer ? 'Kéo để vẽ khung ngoài của bảng.' : erase ? 'Bấm vào một đường để xoá.' : 'Kéo ngang để thêm hàng, kéo dọc để thêm cột.';
  return (
    <Modal title="Vẽ bảng" subtitle={hint} icon={<Grid3x3 size={20} />} onClose={onClose} width={720} actions={<><button className="btn" onClick={() => { setOuter(null); setCols([]); setRows([]); }}>Vẽ lại</button><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!outer} onClick={insert}>Chèn bảng {outer ? `${cols.length + 1} × ${rows.length + 1}` : ''}</button></>}>
      <div className="check-row">
        <label><input type="checkbox" checked={erase} disabled={!outer} onChange={(e) => setErase(e.target.checked)} /> Tẩy đường kẻ</label>
        <label><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Dòng đầu là tiêu đề</label>
      </div>
      <svg ref={svg} className="insert-draw-table" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} role="img" aria-label="Khung vẽ bảng"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); if (erase) eraseAt(p); else setDrag({ start: p, now: p }); }}
        onPointerMove={(e) => { if (drag) { const now = point(e); setDrag({ ...drag, now }); } }}
        onPointerUp={finish}>
        {outer && <rect x={outer.x} y={outer.y} width={outer.w} height={outer.h} fill="#ffffff" stroke="#1f2430" strokeWidth={2} />}
        {outer && cols.map((x) => <line key={`c${x}`} x1={x} x2={x} y1={outer.y} y2={outer.y + outer.h} stroke="#1f2430" />)}
        {outer && rows.map((y) => <line key={`r${y}`} y1={y} y2={y} x1={outer.x} x2={outer.x + outer.w} stroke="#1f2430" />)}
        {drag && !outer && <rect x={Math.min(drag.start.x, drag.now.x)} y={Math.min(drag.start.y, drag.now.y)} width={Math.abs(drag.now.x - drag.start.x)} height={Math.abs(drag.now.y - drag.start.y)} fill="none" stroke="#5b8def" strokeDasharray="4 3" />}
        {drag && outer && (Math.abs(drag.now.x - drag.start.x) > Math.abs(drag.now.y - drag.start.y)
          ? <line x1={outer.x} x2={outer.x + outer.w} y1={drag.start.y} y2={drag.start.y} stroke="#5b8def" strokeDasharray="4 3" />
          : <line y1={outer.y} y2={outer.y + outer.h} x1={drag.start.x} x2={drag.start.x} stroke="#5b8def" strokeDasharray="4 3" />)}
      </svg>
    </Modal>
  );
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const at = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * canvas.current!.width) / rect.width, y: ((e.clientY - rect.top) * canvas.current!.height) / rect.height };
  };
  return (
    <div>
      <canvas ref={canvas} width={720} height={220} className="signature-pad" aria-label="Khung ký tay"
        onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const c = canvas.current!.getContext('2d')!; const p = at(e); c.beginPath(); c.moveTo(p.x, p.y); c.strokeStyle = '#1a365d'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = canvas.current!.getContext('2d')!; const p = at(e); c.lineTo(p.x, p.y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; onChange(canvas.current!.toDataURL('image/png')); }} />
      <button type="button" className="btn snippet" onClick={() => { canvas.current?.getContext('2d')?.clearRect(0, 0, 720, 220); onChange(''); }}>Xoá vẽ lại</button>
    </div>
  );
}

export function EsignDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { editor, editing, setEditing } = ctx;
  const [kind, setKind] = useState('signature');
  const [signer, setSigner] = useState('Bên A');
  const [value, setValue] = useState(() => (editing?.attrs.kind === 'date' ? String(editing.attrs.value || formatDate('short')) : String(editing?.attrs.value ?? '')));
  const [image, setImage] = useState(String(editing?.attrs.image ?? ''));
  const [method, setMethod] = useState<'type' | 'draw'>(editing?.attrs.image ? 'draw' : 'type');
  const [fields, setFields] = useState<{ pos: number; label: string; filled: boolean }[]>([]);
  useEffect(() => {
    const list: { pos: number; label: string; filled: boolean }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'esignField') list.push({ pos, label: esignLabel(node.attrs), filled: Boolean(node.attrs.value || node.attrs.image) });
    });
    setFields(list);
  }, [editor, editing]);
  const close = () => { setEditing(null); onClose(); };
  if (editing) {
    const canDraw = editing.attrs.kind === 'signature' || editing.attrs.kind === 'initials';
    const sign = () => {
      const node = editor.state.doc.nodeAt(editing.pos);
      if (node?.type.name === 'esignField') editor.view.dispatch(editor.state.tr.setNodeMarkup(editing.pos, undefined, { ...node.attrs, value: method === 'type' ? value.trim() : '', image: method === 'draw' ? image : '', signedAt: new Date().toISOString() }));
      close();
    };
    const clear = () => {
      const node = editor.state.doc.nodeAt(editing.pos);
      if (node?.type.name === 'esignField') editor.view.dispatch(editor.state.tr.setNodeMarkup(editing.pos, undefined, { ...node.attrs, value: '', image: '', signedAt: '' }));
      close();
    };
    const ready = method === 'type' ? Boolean(value.trim()) : Boolean(image);
    return (
      <Modal title={esignLabel(editing.attrs)} subtitle="Đây là chữ ký hình ảnh trong tài liệu, không phải chữ ký số có giá trị pháp lý." icon={<FileSignature size={20} />} onClose={close} width={640} actions={<><button className="btn" onClick={clear}>Xoá nội dung</button><span className="spacer" /><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!ready} onClick={sign}>Hoàn tất</button></>}>
        {canDraw && <div className="check-row"><label><input type="radio" name="esign-method" checked={method === 'type'} onChange={() => setMethod('type')} /> Gõ tên</label><label><input type="radio" name="esign-method" checked={method === 'draw'} onChange={() => setMethod('draw')} /> Vẽ tay</label></div>}
        {method === 'type' ? <input className="text-field" autoFocus placeholder="Nhập nội dung" value={value} onChange={(e) => setValue(e.target.value)} /> : <SignaturePad onChange={setImage} />}
      </Modal>
    );
  }
  const insert = () => {
    editor.chain().focus().insertEsignField({ kind, signer: signer.trim() }).run();
    const list: { pos: number; label: string; filled: boolean }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'esignField') list.push({ pos, label: esignLabel(node.attrs), filled: Boolean(node.attrs.value || node.attrs.image) });
    });
    setFields(list);
  };
  return (
    <Modal title="Trường chữ ký điện tử" subtitle="Đặt các trường cần ký vào tài liệu. Nhấp đúp một trường để ký." icon={<FileSignature size={20} />} onClose={close} width={600} actions={<button className="btn" onClick={close}>Xong</button>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Loại trường</span><select className="text-field" value={kind} onChange={(e) => setKind(e.target.value)}>{ESIGN_KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Người ký</span><input className="text-field" value={signer} onChange={(e) => setSigner(e.target.value)} /></label>
      </div>
      <button className="btn btn-primary" onClick={insert}>Chèn tại con trỏ</button>
      <div className="form-section-title">Các trường trong tài liệu ({fields.length})</div>
      <div className="insert-list">
        {fields.length === 0 && <div className="panel-empty">Chưa có trường nào.</div>}
        {fields.map((field) => (
          <div key={`${field.pos}-${newId('r')}`} className="insert-list-row">
            <div><strong>{field.label}</strong><span>{field.filled ? 'Đã ký' : 'Chưa ký'}</span></div>
            <button className="btn snippet" onClick={() => { editor.chain().focus().setNodeSelection(field.pos).scrollIntoView().run(); close(); }}>Đi tới</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
