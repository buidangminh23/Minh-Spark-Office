import { BarChart3, Blocks, Bookmark, BookOpen, Box, Calendar, CalendarClock, CaseUpper, CircleUser, FilePlus2, FileSpreadsheet, FileText, FileUp, Globe, Grid3x3, Hash, Image as ImageIcon, Link2, ListChecks, ListTree, MapPin, MessageSquarePlus, Minus, Monitor, Network, Omega, PanelBottom, PanelTop, Paperclip, Pencil, PenTool, ScissorsLineDashed, Shapes, Signature, Sigma, Smile, SquareDashed, SquareSplitVertical, Table as TableIcon, TableProperties, Trash2, Type, Upload, Variable, Video } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { addComment, editLink, insertFootnote, insertImageFromDevice, insertImageFromUrl, mergeDocument } from '../../actions';
import { insertChip, textToTable } from '../../actionsExtra';
import { captureScreenshot, insertBlock, insertMetaImage, insertSpreadsheet, insertTableJson, insertTextFromFile, loadBlocks, QUICK_TABLES, saveSelectionAsBlock, tableJson } from '../../insertActions';
import { FOOTER_GALLERY, HEADER_GALLERY, NUMBER_POSITIONS, TEXT_BOXES, clearHeaderFooter, hasCover, insertCover, removeCover, textBoxContent } from '../../insertGalleries';
import { formatDate, type FieldKind } from '../../insertFields';
import { shapeDataUrl } from '../../insertShapes';
import { Big, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Rows, Small } from '../RibbonParts';
import { CoverGallery, EquationGallery, ShapeGallery, SymbolGallery, TableGrid } from '../insert/InsertGalleries';
import { currentAuthorName } from '../../../../lib/currentAuthor';

const PROPERTY_FIELDS: { kind: FieldKind; label: string }[] = [
  { kind: 'author', label: 'Tác giả' }, { kind: 'title', label: 'Tiêu đề' }, { kind: 'subject', label: 'Chủ đề' }, { kind: 'keywords', label: 'Từ khoá' }, { kind: 'company', label: 'Đơn vị' },
];

const detailRow = (label: string, detail: string) => <span><strong>{label}</strong><br /><small>{detail}</small></span>;

export default function InsertTab() {
  const ctx = useDoc();
  const { editor, page, setPage } = ctx;
  const chain = () => editor.chain().focus();

  const insertSignatureLine = async () => {
    const res = await ctx.ui.ask({ title: 'Dòng chữ ký', fields: [{ name: 'title', label: 'Chức danh', placeholder: 'Giám đốc' }, { name: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A' }, { name: 'date', label: 'Thêm dòng ngày tháng', type: 'checkbox', value: true }], confirmText: 'Chèn' });
    if (!res) return;
    const line = (text: string, marks: { type: string }[] = []) => ({ type: 'paragraph', attrs: { textAlign: 'center', keepNext: true }, content: text ? [{ type: 'text', text, marks }] : [] });
    chain().insertContent([
      ...(res.date ? [line(formatDate('long'), [{ type: 'italic' }])] : []),
      line(String(res.title ?? '').toUpperCase(), [{ type: 'bold' }]),
      line(''), line(''), line(''),
      line(String(res.name ?? ''), [{ type: 'bold' }]),
    ]).run();
  };

  const insertCustomTable = async () => {
    const res = await ctx.ui.ask({ title: 'Chèn bảng', fields: [{ name: 'cols', label: 'Số cột', type: 'number', value: 4, min: 1, max: 30 }, { name: 'rows', label: 'Số dòng', type: 'number', value: 3, min: 1, max: 200 }, { name: 'header', label: 'Dòng đầu là tiêu đề', type: 'checkbox', value: true }], confirmText: 'Chèn' });
    if (res) chain().insertTable({ rows: Math.max(1, Number(res.rows) || 3), cols: Math.max(1, Number(res.cols) || 3), withHeaderRow: Boolean(res.header) }).run();
  };

  const placeCover = (id: string) => {
    insertCover(editor, id, { title: ctx.title.replace(/\.[^/.]+$/, ''), author: page.properties?.author || currentAuthorName(), date: formatDate('long') });
    ctx.ui.toast('Đã chèn trang bìa ở đầu tài liệu');
  };

  const dropCap = (mode: 'none' | 'dropped' | 'margin') => {
    if (mode === 'none') chain().setParagraphAttrs({ dropCap: false, dropCapMode: null, dropCapLines: null, dropCapGap: null }).run();
    else chain().setParagraphAttrs({ dropCap: true, dropCapMode: mode, dropCapLines: Number(editor.getAttributes('paragraph').dropCapLines) || 3 }).run();
  };

  const formatTextBox = async () => {
    const attrs = editor.getAttributes('textBox');
    const res = await ctx.ui.ask({
      title: 'Định dạng hộp chữ',
      fields: [
        { name: 'align', label: 'Vị trí', type: 'select', value: String(attrs.align ?? 'full'), options: [{ value: 'full', label: 'Rộng hết dòng' }, { value: 'center', label: 'Giữa trang' }, { value: 'left', label: 'Trái, chữ bao quanh' }, { value: 'right', label: 'Phải, chữ bao quanh' }] },
        { name: 'boxWidth', label: 'Chiều rộng (%)', type: 'number', value: Number(attrs.boxWidth) || 50, min: 15, max: 100 },
        { name: 'fill', label: 'Màu nền, ví dụ #ffffff', value: String(attrs.fill ?? '#ffffff') },
        { name: 'stroke', label: 'Màu viền, ví dụ #94a3b8', value: String(attrs.stroke ?? '#94a3b8') },
      ],
      confirmText: 'Áp dụng',
    });
    if (res) chain().updateAttributes('textBox', { align: String(res.align), boxWidth: String(res.boxWidth), fill: String(res.fill), stroke: String(res.stroke) }).run();
  };

  return (
    <>
      <Group label="Trang">
        <Dropdown large title="Trang bìa" trigger={<><BookOpen size={20} color="#2b579a" /><span>Trang bìa</span></>} width={340}>
          {(close) => (
            <>
              <MenuHeading>Kiểu dựng sẵn</MenuHeading>
              <CoverGallery onPick={(id) => { close(); placeCover(id); }} />
              <MenuSeparator />
              <MenuItem icon={<Trash2 size={14} />} label="Xoá trang bìa hiện tại" onClick={() => { close(); if (!removeCover(editor)) ctx.ui.toast('Tài liệu chưa có trang bìa dựng sẵn', true); }} active={hasCover(editor)} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<FilePlus2 size={14} />} label="Trang trống" title="Chèn một trang trống" onClick={() => chain().insertPageBreak().insertPageBreak().run()} />
          <Small icon={<ScissorsLineDashed size={14} />} label="Ngắt trang" title="Ngắt trang (Ctrl+Enter)" onClick={() => chain().insertPageBreak().run()} />
          <Small icon={<Upload size={14} />} label="Ghép tệp" title="Ghép nội dung tệp vào cuối tài liệu" onClick={() => void mergeDocument(ctx)} />
        </Rows>
      </Group>

      <Group label="Bảng">
        <Dropdown large title="Chèn bảng" trigger={<><TableIcon size={22} color="#2b579a" /><span>Bảng</span></>} width={270}>
          {(close) => (
            <>
              <TableGrid onPick={(rows, cols) => { close(); chain().insertTable({ rows, cols, withHeaderRow: true }).run(); }} />
              <MenuSeparator />
              <MenuItem icon={<TableIcon size={14} />} label="Chèn bảng…" onClick={() => { close(); void insertCustomTable(); }} />
              <MenuItem icon={<Grid3x3 size={14} />} label="Vẽ bảng…" onClick={() => { close(); ctx.openDialog('drawtable'); }} />
              <MenuItem icon={<TableProperties size={14} />} label="Chuyển chữ đang chọn thành bảng" onClick={() => { close(); textToTable(ctx); }} />
              <MenuItem icon={<FileSpreadsheet size={14} />} label="Chèn bảng tính từ tệp Excel, CSV…" onClick={() => { close(); void insertSpreadsheet(ctx); }} />
              <MenuSeparator />
              <MenuHeading>Bảng nhanh</MenuHeading>
              {QUICK_TABLES.map((item) => <MenuItem key={item.id} label={detailRow(item.label, item.detail)} onClick={() => { close(); insertTableJson(ctx, tableJson(item.rows(), { style: item.style, header: item.id !== 'signoff' })); }} />)}
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Ký hiệu">
        <Dropdown large title="Công thức" trigger={<><Sigma size={22} color="#7c3aed" /><span>Công thức</span></>} width={420}>
          {(close) => (
            <>
              <MenuItem icon={<Sigma size={14} />} label="Viết công thức mới… (Alt+=)" onClick={() => { close(); ctx.setEditing(null); ctx.openDialog('equation'); }} />
              <MenuSeparator />
              <MenuHeading>Công thức dựng sẵn</MenuHeading>
              <EquationGallery onPick={(latex) => { close(); chain().insertEquation(latex, true).run(); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Ký hiệu" trigger={<><Omega size={22} color="#d98e04" /><span>Ký hiệu</span></>} width={260}>
          {(close) => (
            <>
              <MenuHeading>Dùng gần đây</MenuHeading>
              <SymbolGallery onPick={(symbol) => { close(); chain().insertContent(symbol).run(); }} />
              <MenuSeparator />
              <MenuItem icon={<Omega size={14} />} label="Ký hiệu khác…" onClick={() => { close(); ctx.openDialog('symbols'); }} />
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
        <Dropdown large title="Chèn hình dạng" trigger={<><Shapes size={22} color="#0891b2" /><span>Hình</span></>} width={320}>
          {(close) => <ShapeGallery onPick={({ id, label, fill, stroke, text }) => { close(); insertMetaImage(ctx, { src: shapeDataUrl({ id, fill, stroke, text }), alt: text || label, meta: { kind: 'shape', id, fill, stroke, text } }); }} />}
        </Dropdown>
        <Big icon={<Smile size={22} color="#d98e04" />} label="Biểu tượng" title="Chèn biểu tượng, đổi màu và kích thước" onClick={() => ctx.openDialog('icons')} />
        <Big icon={<Box size={22} color="#7c3aed" />} label="Mô hình 3D" title="Khối 3D hoặc tệp .obj, .stl, xoay rồi chèn thành ảnh" onClick={() => { ctx.setEditing(null); ctx.openDialog('model3d'); }} />
        <Big icon={<Network size={22} color="#107c41" />} label="SmartArt" title="22 bố cục: danh sách, quy trình, chu kỳ, phân cấp, quan hệ, ma trận, kim tự tháp, dòng thời gian, phễu, toả tròn, bánh răng…" onClick={() => { ctx.setEditing(null); ctx.openDialog('smartart'); }} />
        <Big icon={<BarChart3 size={22} color="#d98e04" />} label="Biểu đồ" title="Hơn 30 loại biểu đồ: cột, thanh, đường, vùng, tròn, phân tán, bong bóng, cổ phiếu, Pareto, hộp và râu, Gantt, đồng hồ đo…" onClick={() => { ctx.setEditing(null); ctx.openDialog('chart'); }} />
        <Dropdown large title="Chụp màn hình" trigger={<><Monitor size={22} color="#2b579a" /><span>Chụp màn hình</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<Monitor size={14} />} label="Chụp một cửa sổ hoặc màn hình…" onClick={() => { close(); void captureScreenshot(ctx, false); }} />
              <MenuItem icon={<ScissorsLineDashed size={14} />} label="Chụp rồi cắt vùng cần lấy…" onClick={() => { close(); void captureScreenshot(ctx, true); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<Pencil size={14} />} label="Bản vẽ" title="Vẽ đường, mũi tên, hình, chữ rồi chèn thành ảnh" onClick={() => ctx.openDialog('drawing')} />
          <Small icon={<Minus size={14} />} label="Đường kẻ" title="Chèn đường kẻ ngang" onClick={() => chain().setHorizontalRule().run()} />
        </Rows>
      </Group>

      <Group label="Phương tiện">
        <Big icon={<Video size={22} color="#d7473c" />} label="Video trực tuyến" title="Nhúng video YouTube hoặc Vimeo" onClick={() => ctx.openDialog('video')} />
      </Group>

      <Group label="Liên kết">
        <Big icon={<Link2 size={22} color="#2b579a" />} label="Liên kết" title="Chèn liên kết (Ctrl+K)" onClick={() => void editLink(ctx)} />
        <Big icon={<ListTree size={22} color="#2b579a" />} label="Mục lục" title="Chèn mục lục tự cập nhật" onClick={() => chain().insertDocList('tableOfContents').run()} />
        <Rows>
          <Small icon={<Bookmark size={14} />} label="Dấu trang" title="Thêm, nhảy tới, xoá dấu trang" onClick={() => ctx.openDialog('bookmarks')} />
          <Small icon={<Link2 size={14} />} label="Tham chiếu chéo" title="Chèn tham chiếu tới tiêu đề, nhãn hoặc dấu trang" onClick={() => ctx.openDialog('crossref')} />
        </Rows>
      </Group>

      <Group label="Bình luận">
        <Big icon={<MessageSquarePlus size={22} color="#d98e04" />} label="Bình luận" title="Bình luận mới (Ctrl+Alt+M)" onClick={() => void addComment(ctx)} />
      </Group>

      <Group label="Đầu & chân trang">
        <Dropdown large title="Đầu trang" trigger={<><PanelTop size={22} color="#2b579a" /><span>Đầu trang</span></>} width={300}>
          {(close) => (
            <>
              <MenuHeading>Kiểu dựng sẵn</MenuHeading>
              {HEADER_GALLERY.map((item) => <MenuItem key={item.id} label={detailRow(item.label, item.detail)} active={page.header === item.value} onClick={() => { close(); setPage({ header: item.value }); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Pencil size={14} />} label="Sửa đầu trang…" onClick={() => { close(); ctx.openDialog('headerfooter'); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Xoá đầu trang" onClick={() => { close(); setPage(clearHeaderFooter('header')); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Chân trang" trigger={<><PanelBottom size={22} color="#2b579a" /><span>Chân trang</span></>} width={300}>
          {(close) => (
            <>
              <MenuHeading>Kiểu dựng sẵn</MenuHeading>
              {FOOTER_GALLERY.map((item) => <MenuItem key={item.id} label={detailRow(item.label, item.detail)} active={page.footer === item.value} onClick={() => { close(); setPage({ footer: item.value }); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Pencil size={14} />} label="Sửa chân trang…" onClick={() => { close(); ctx.openDialog('headerfooter'); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Xoá chân trang" onClick={() => { close(); setPage(clearHeaderFooter('footer')); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Số trang" trigger={<><Hash size={22} color="#2b579a" /><span>Số trang</span></>} width={260}>
          {(close) => (
            <>
              <MenuHeading>Vị trí</MenuHeading>
              {NUMBER_POSITIONS.map((item) => <MenuItem key={item.id} label={item.label} active={page.pageNumbers && (page.pageNumberPosition ?? 'bottom-right') === item.id} onClick={() => { close(); setPage({ pageNumbers: true, pageNumberPosition: item.id }); }} />)}
              <MenuSeparator />
              <MenuHeading>Tại vị trí con trỏ</MenuHeading>
              <MenuItem label="Số trang" onClick={() => { close(); chain().insertDocField('page').run(); }} />
              <MenuItem label="Trang X / Y" onClick={() => { close(); chain().insertContent('Trang ').insertDocField('page').insertContent(' / ').insertDocField('numpages').run(); }} />
              <MenuSeparator />
              <MenuItem icon={<Hash size={14} />} label="Định dạng số trang…" onClick={() => { close(); ctx.openDialog('pagenumber'); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Bỏ số trang" onClick={() => { close(); setPage({ pageNumbers: false }); }} />
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Văn bản">
        <Dropdown large title="Hộp chữ" trigger={<><SquareDashed size={22} color="#2b579a" /><span>Hộp chữ</span></>} width={290}>
          {(close) => (
            <>
              <MenuHeading>Kiểu dựng sẵn</MenuHeading>
              {TEXT_BOXES.map((item) => <MenuItem key={item.id} label={detailRow(item.label, item.detail)} onClick={() => { close(); chain().insertContent(textBoxContent(item)).run(); }} />)}
              <MenuSeparator />
              <MenuItem label="Đóng khung đoạn đang chọn" onClick={() => { close(); if (!chain().wrapIn('textBox').run()) ctx.ui.toast('Không đóng khung được đoạn này', true); }} />
              {editor.isActive('textBox') && <MenuItem label="Định dạng hộp chữ này…" onClick={() => { close(); void formatTextBox(); }} />}
            </>
          )}
        </Dropdown>
        <Dropdown large title="Khối nhanh" trigger={<><Blocks size={22} color="#2b579a" /><span>Khối nhanh</span></>} width={270}>
          {(close) => (
            <>
              <MenuHeading>Văn bản tự động</MenuHeading>
              {loadBlocks().length ? loadBlocks().slice(0, 8).map((block) => <MenuItem key={block.id} label={block.name} onClick={() => { close(); insertBlock(ctx, block); }} />) : <div className="ribbon-menu-empty">Chưa có khối nào đã lưu.</div>}
              <MenuSeparator />
              <MenuHeading>Thuộc tính tài liệu</MenuHeading>
              {PROPERTY_FIELDS.map((item) => <MenuItem key={item.kind} label={item.label} onClick={() => { close(); chain().insertDocField(item.kind).run(); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Variable size={14} />} label="Trường…" onClick={() => { close(); ctx.openDialog('fields'); }} />
              <MenuItem icon={<Blocks size={14} />} label="Quản lý khối dựng sẵn…" onClick={() => { close(); ctx.openDialog('quickparts'); }} />
              <MenuItem label="Lưu vùng chọn thành khối…" onClick={() => { close(); void saveSelectionAsBlock(ctx); }} />
            </>
          )}
        </Dropdown>
        <Big icon={<Type size={22} color="#2563eb" />} label="Chữ nghệ thuật" title="Chèn chữ nghệ thuật, nhấp đúp để sửa lại" onClick={() => { ctx.setEditing(null); ctx.openDialog('wordart'); }} />
        <Dropdown large title="Chữ hoa lớn đầu đoạn" trigger={<><CaseUpper size={22} color="#2b579a" /><span>Chữ hoa lớn</span></>}>
          {(close) => (
            <>
              <MenuItem label="Không dùng" onClick={() => { close(); dropCap('none'); }} active={!editor.getAttributes('paragraph').dropCap} />
              <MenuItem label="Trong đoạn" onClick={() => { close(); dropCap('dropped'); }} active={editor.getAttributes('paragraph').dropCap && editor.getAttributes('paragraph').dropCapMode !== 'margin'} />
              <MenuItem label="Trên lề" onClick={() => { close(); dropCap('margin'); }} active={editor.getAttributes('paragraph').dropCapMode === 'margin'} />
              <MenuSeparator />
              <MenuItem label="Tuỳ chọn…" onClick={() => { close(); ctx.openDialog('dropcap'); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Dropdown title="Dòng chữ ký" trigger={<><Signature size={14} /><span>Dòng chữ ký</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<Signature size={14} />} label="Khối chữ ký: ngày, chức danh, họ tên…" onClick={() => { close(); void insertSignatureLine(); }} />
                <MenuItem icon={<PenTool size={14} />} label="Vẽ chữ ký tay…" onClick={() => { close(); ctx.openDialog('signature'); }} />
              </>
            )}
          </Dropdown>
          <Small icon={<CalendarClock size={14} />} label="Ngày giờ" title="Chọn định dạng ngày giờ, có thể tự cập nhật" onClick={() => ctx.openDialog('datetime')} />
          <Dropdown title="Đối tượng" trigger={<><Paperclip size={14} /><span>Đối tượng</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<Paperclip size={14} />} label="Đính kèm tệp vào tài liệu…" onClick={() => { close(); ctx.openDialog('object'); }} />
                <MenuItem icon={<FileUp size={14} />} label="Văn bản từ tệp tại con trỏ…" onClick={() => { close(); void insertTextFromFile(ctx); }} />
              </>
            )}
          </Dropdown>
        </Rows>
        <Rows>
          <Dropdown title="Chèn chip thông minh" trigger={<><ListChecks size={14} /><span>Chip</span></>}>
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
          <Small icon={<FileText size={14} />} label="Chú thích" title="Chú thích cuối trang (Ctrl+Alt+F)" onClick={() => void insertFootnote(ctx)} />
          <Small icon={<SquareSplitVertical size={14} />} label="Mã code" title="Chèn khối mã" onClick={() => chain().toggleCodeBlock().run()} />
        </Rows>
      </Group>
    </>
  );
}
