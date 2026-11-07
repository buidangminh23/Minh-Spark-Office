import { useState } from 'react';
import { BarChart3, BookOpen, Calendar, FileText, Globe, Hash, Image as ImageIcon, Link2, ListTree, MessageSquarePlus, Minus, Omega, PanelBottom, PanelTop, PenTool, ScissorsLineDashed, SquareSplitVertical, Table as TableIcon, Upload, FilePlus2 } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { addComment, editLink, headerFooterSetup, insertDateTime, insertFootnote, insertImageFromDevice, insertImageFromUrl, mergeDocument } from '../../actions';
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

export default function InsertTab() {
  const ctx = useDoc();
  const { editor } = ctx;
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
        <Big icon={<BarChart3 size={22} color="#d98e04" />} label="Biểu đồ" title="Tạo biểu đồ cột, đường hoặc tròn" onClick={() => ctx.openDialog('chart')} />
        <Big icon={<PenTool size={22} color="#4338ca" />} label="Vẽ / Ký" title="Vẽ tay hoặc ký tên" onClick={() => ctx.openDialog('signature')} />
        <Big icon={<Minus size={22} color="#586071" />} label="Đường kẻ" title="Chèn đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </Group>

      <Group label="Liên kết">
        <Big icon={<Link2 size={22} color="#2b579a" />} label="Liên kết" title="Chèn liên kết (Ctrl+K)" onClick={() => void editLink(ctx)} />
        <Big icon={<ListTree size={22} color="#2b579a" />} label="Mục lục" title="Chèn mục lục tự cập nhật" onClick={() => editor.chain().focus().insertTableOfContents().run()} />
      </Group>

      <Group label="Bình luận">
        <Big icon={<MessageSquarePlus size={22} color="#d98e04" />} label="Bình luận" title="Bình luận mới (Ctrl+Alt+M)" onClick={() => void addComment(ctx)} />
      </Group>

      <Group label="Đầu & chân trang">
        <Rows>
          <Small icon={<PanelTop size={14} />} label="Đầu trang" title="Sửa đầu trang" onClick={() => void headerFooterSetup(ctx)} />
          <Small icon={<PanelBottom size={14} />} label="Chân trang" title="Sửa chân trang" onClick={() => void headerFooterSetup(ctx)} />
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
        <Big icon={<FileText size={22} color="#107c41" />} label="Chú thích" title="Chú thích cuối trang (Ctrl+Alt+F)" onClick={() => void insertFootnote(ctx)} />
        <Big icon={<SquareSplitVertical size={22} color="#586071" />} label="Mã code" title="Chèn khối mã" onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      </Group>

      <Group label="Ký hiệu">
        <Big icon={<Omega size={22} color="#d98e04" />} label="Ký hiệu" title="Ký hiệu đặc biệt và biểu tượng cảm xúc" onClick={() => ctx.openDialog('symbols')} />
      </Group>
    </>
  );
}
