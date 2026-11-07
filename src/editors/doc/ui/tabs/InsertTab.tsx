import { useState } from 'react';
import { BarChart3, Bookmark, BookOpen, Calendar, CaseUpper, CircleUser, FileText, Globe, Hash, Image as ImageIcon, Link2, ListChecks, ListTree, MapPin, MessageSquarePlus, Minus, Omega, PanelBottom, PanelTop, Paperclip, Pencil, PenTool, QrCode, ScissorsLineDashed, Shapes, Signature, Sigma, SquareDashed, SquareSplitVertical, Table as TableIcon, TableProperties, Upload, FilePlus2 } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { addComment, editLink, insertDateTime, insertFootnote, insertImageFromDevice, insertImageFromUrl, mergeDocument } from '../../actions';
import { insertBookmarkPrompt, insertChip, textToTable } from '../../actionsExtra';
import { SHAPES, shapeDataUrl } from '../InsertDialogs';
import { coverPageHtml } from '../../docTemplates';
import { Big, Dropdown, Group, MenuItem, MenuSeparator, Rows, Small } from '../RibbonParts';

function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  return (
    <div className="table-grid-picker">
      <div className="table-grid-label">{hover.rows ? `Bảng ${hover.cols} × ${hover.rows}` : 'Chèn bảng'}</div>
      <div className="table-grid" onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
        {Array.from({ length: 8 }, (_, r) => Array.from({ length: 10 }, (_, c) => (
          <button key={`${r}-${c}`} type="button" aria-label={`${c + 1} × ${r + 1}`} className={`table-grid-cell ${r < hover.rows && c < hover.cols ? 'on' : ''}`} onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })} onClick={() => onPick(r + 1, c + 1)} />
        )))}
      </div>
    </div>
  );
}

function ShapeGallery({ onPick }: { onPick: (id: string, label: string, fill: string, stroke: string) => void }) {
  const [fill, setFill] = useState('#dbe6fb');
  const [stroke, setStroke] = useState('#2b579a');
  return (
    <div className="shape-gallery">
      <div className="shape-colors">
        <label>Tô <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} /></label>
        <label>Viền <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} /></label>
      </div>
      <div className="shape-grid">
        {SHAPES.map((shape) => (
          <button key={shape.id} type="button" className="shape-cell" title={shape.label} aria-label={shape.label} onClick={() => onPick(shape.id, shape.label, fill, stroke)}>
            <img src={shapeDataUrl(shape.id, fill, stroke)} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InsertTab() {
  const ctx = useDoc();
  const { editor } = ctx;
  const insertSignatureLine = async () => {
    const res = await ctx.ui.ask({ title: 'Dòng chữ ký', fields: [{ name: 'title', label: 'Chức danh', placeholder: 'Giám đốc' }, { name: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A' }, { name: 'date', label: 'Thêm dòng ngày tháng', type: 'checkbox', value: true }], confirmText: 'Chèn' });
    if (!res) return;
    const now = new Date();
    const line = (text: string, marks: { type: string }[] = []) => ({ type: 'paragraph', attrs: { textAlign: 'center', keepNext: true }, content: text ? [{ type: 'text', text, marks }] : [] });
    editor.chain().focus().insertContent([
      ...(res.date ? [line(`ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`, [{ type: 'italic' }])] : []),
      line(String(res.title ?? '').toUpperCase(), [{ type: 'bold' }]),
      line(''), line(''), line(''),
      line(String(res.name ?? ''), [{ type: 'bold' }]),
    ]).run();
  };
  const toggleDropCap = () => editor.chain().focus().updateAttributes('paragraph', { dropCap: !editor.getAttributes('paragraph').dropCap }).run();
  const insertCustomTable = async () => {
    const res = await ctx.ui.ask({ title: 'Chèn bảng', fields: [{ name: 'cols', label: 'Số cột', type: 'number', value: 4, min: 1, max: 30 }, { name: 'rows', label: 'Số dòng', type: 'number', value: 3, min: 1, max: 200 }, { name: 'header', label: 'Dòng đầu là tiêu đề', type: 'checkbox', value: true }], confirmText: 'Chèn' });
    if (res) editor.chain().focus().insertTable({ rows: Math.max(1, Number(res.rows) || 3), cols: Math.max(1, Number(res.cols) || 3), withHeaderRow: Boolean(res.header) }).run();
  };
  return (
    <>
      <Group label="Trang">
        <Big icon={<BookOpen size={20} color="#2b579a" />} label="Trang bìa" title="Chèn trang bìa ở đầu tài liệu" onClick={() => editor.chain().focus().insertContentAt(0, coverPageHtml(ctx.title.replace(/\.[^/.]+$/, ''))).run()} />
        <Rows>
          <Small icon={<FilePlus2 size={14} />} label="Trang trống" title="Chèn một trang trống" onClick={() => editor.chain().focus().insertPageBreak().insertPageBreak().run()} />
          <Small icon={<ScissorsLineDashed size={14} />} label="Ngắt trang" title="Ngắt trang (Ctrl+Enter)" onClick={() => editor.chain().focus().insertPageBreak().run()} />
          <Small icon={<Upload size={14} />} label="Chèn từ tệp" title="Chèn nội dung từ tệp .docx/.html/.txt" onClick={() => void mergeDocument(ctx)} />
        </Rows>
      </Group>

      <Group label="Bảng">
        <Dropdown large title="Chèn bảng" trigger={<><TableIcon size={22} color="#2b579a" /><span>Bảng</span></>}>
          {(close) => (
            <>
              <TableGrid onPick={(rows, cols) => { close(); editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(); }} />
              <MenuSeparator />
              <MenuItem icon={<TableIcon size={14} />} label="Chèn bảng tuỳ chỉnh…" onClick={() => { close(); void insertCustomTable(); }} />
              <MenuItem icon={<TableProperties size={14} />} label="Chuyển chữ đang chọn thành bảng" onClick={() => { close(); textToTable(ctx); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Minh hoạ">
        <Dropdown large title="Chèn ảnh" trigger={<><ImageIcon size={22} color="#107c41" /><span>Ảnh</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<Upload size={14} />} label="Tải lên từ máy" onClick={() => { close(); void insertImageFromDevice(ctx); }} />
              <MenuItem icon={<Globe size={14} />} label="Theo địa chỉ URL" onClick={() => { close(); void insertImageFromUrl(ctx); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Chèn hình dạng" trigger={<><Shapes size={22} color="#0891b2" /><span>Hình</span></>} width={280}>
          {(close) => <ShapeGallery onPick={(id, label, fill, stroke) => { close(); editor.chain().focus().setImage({ src: shapeDataUrl(id, fill, stroke), alt: label }).run(); }} />}
        </Dropdown>
        <Big icon={<BarChart3 size={22} color="#d98e04" />} label="Biểu đồ" title="Tạo biểu đồ cột, đường hoặc tròn" onClick={() => ctx.openDialog('chart')} />
        <Big icon={<Pencil size={22} color="#4338ca" />} label="Bản vẽ" title="Vẽ đường, mũi tên, hình, chữ rồi chèn thành ảnh" onClick={() => ctx.openDialog('drawing')} />
        <Rows>
          <Small icon={<QrCode size={14} />} label="Mã QR" title="Tạo mã QR từ đường dẫn hoặc nội dung" onClick={() => ctx.openDialog('qr')} />
          <Small icon={<PenTool size={14} />} label="Vẽ / Ký" title="Vẽ tay hoặc ký tên" onClick={() => ctx.openDialog('signature')} />
          <Small icon={<Minus size={14} />} label="Đường kẻ" title="Chèn đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        </Rows>
      </Group>

      <Group label="Liên kết">
        <Big icon={<Link2 size={22} color="#2b579a" />} label="Liên kết" title="Chèn liên kết (Ctrl+K)" onClick={() => void editLink(ctx)} />
        <Big icon={<ListTree size={22} color="#2b579a" />} label="Mục lục" title="Chèn mục lục tự cập nhật" onClick={() => editor.chain().focus().insertDocList('tableOfContents').run()} />
        <Rows>
          <Small icon={<Bookmark size={14} />} label="Dấu trang" title="Đặt dấu trang tại con trỏ" onClick={() => void insertBookmarkPrompt(ctx)} />
          <Small icon={<Link2 size={14} />} label="Tham chiếu chéo" title="Chèn tham chiếu tới tiêu đề, nhãn hoặc dấu trang" onClick={() => ctx.openDialog('crossref')} />
        </Rows>
      </Group>

      <Group label="Bình luận">
        <Big icon={<MessageSquarePlus size={22} color="#d98e04" />} label="Bình luận" title="Bình luận mới (Ctrl+Alt+M)" onClick={() => void addComment(ctx)} />
      </Group>

      <Group label="Đầu & chân trang">
        <Rows>
          <Small icon={<PanelTop size={14} />} label="Đầu trang" title="Sửa đầu trang" onClick={() => ctx.openDialog('headerfooter')} />
          <Small icon={<PanelBottom size={14} />} label="Chân trang" title="Sửa chân trang" onClick={() => ctx.openDialog('headerfooter')} />
          <Small icon={<Hash size={14} />} label="Số trang" title="Bật/tắt đánh số trang" active={ctx.page.pageNumbers} onClick={() => ctx.setPage({ pageNumbers: !ctx.page.pageNumbers })} />
        </Rows>
      </Group>

      <Group label="Văn bản">
        <Dropdown large title="Chèn ngày giờ" trigger={<><Calendar size={22} color="#2b579a" /><span>Ngày giờ</span></>}>
          {(close) => (
            <>
              <MenuItem label={new Date().toLocaleDateString('vi-VN')} onClick={() => { close(); insertDateTime(ctx, 'date'); }} />
              <MenuItem label={`ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`} onClick={() => { close(); insertDateTime(ctx, 'long'); }} />
              <MenuItem label={new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} onClick={() => { close(); insertDateTime(ctx, 'time'); }} />
              <MenuItem label="Giờ và ngày" onClick={() => { close(); insertDateTime(ctx, 'datetime'); }} />
            </>
          )}
        </Dropdown>
        <Big icon={<SquareDashed size={22} color="#2b579a" />} label="Hộp chữ" title="Chèn hộp chữ" onClick={() => editor.chain().focus().insertTextBox({ align: 'full' }).run()} />
        <Dropdown large title="Chèn chip thông minh" trigger={<><ListChecks size={22} color="#107c41" /><span>Chip</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<Calendar size={14} />} label="Ngày" onClick={() => { close(); void insertChip(ctx, 'date'); }} />
              <MenuItem icon={<CircleUser size={14} />} label="Người" onClick={() => { close(); void insertChip(ctx, 'person'); }} />
              <MenuItem icon={<ListChecks size={14} />} label="Danh sách thả xuống" onClick={() => { close(); void insertChip(ctx, 'status'); }} />
              <MenuItem icon={<MapPin size={14} />} label="Địa điểm" onClick={() => { close(); void insertChip(ctx, 'place'); }} />
              <MenuItem icon={<Paperclip size={14} />} label="Tệp" onClick={() => { close(); void insertChip(ctx, 'file'); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<FileText size={14} />} label="Chú thích" title="Chú thích cuối trang (Ctrl+Alt+F)" onClick={() => void insertFootnote(ctx)} />
          <Small icon={<CaseUpper size={14} />} label="Chữ hoa lớn" title="Bật/tắt chữ cái đầu đoạn cỡ lớn" active={Boolean(editor.getAttributes('paragraph').dropCap)} onClick={toggleDropCap} />
          <Small icon={<Signature size={14} />} label="Dòng ký" title="Chèn khối chữ ký: ngày tháng, chức danh, họ tên" onClick={() => void insertSignatureLine()} />
        </Rows>
        <Small icon={<SquareSplitVertical size={14} />} label="Mã code" title="Chèn khối mã" onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      </Group>

      <Group label="Ký hiệu">
        <Big icon={<Sigma size={22} color="#7c3aed" />} label="Công thức" title="Chèn công thức toán bằng LaTeX" onClick={() => { ctx.setEditing(null); ctx.openDialog('equation'); }} />
        <Big icon={<Omega size={22} color="#d98e04" />} label="Ký hiệu" title="Ký hiệu đặc biệt và biểu tượng cảm xúc" onClick={() => ctx.openDialog('symbols')} />
      </Group>
    </>
  );
}
