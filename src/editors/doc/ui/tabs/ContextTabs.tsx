import { AlignCenter, AlignLeft, AlignRight, ArrowDownAZ, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ChevronDown, Columns2, Crop, FileText, Frame, Image as ImageIcon, Merge, PaintBucket, Replace, Rows2, Settings2, Sigma, SplitSquareHorizontal, Table as TableIcon, Trash2, Type, UnfoldHorizontal } from 'lucide-react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { imageSettings } from '../../actions';
import { distributeColumns, insertTableFormula, sortTable, tableToText } from '../../actionsExtra';
import { pickFile, readAsDataUrl } from '../../../../lib/download';
import { Big, ColorPicker, Dropdown, Group, MenuItem, Rows, Small } from '../RibbonParts';

const TABLE_STYLES = [
  { id: 'grid', label: 'Lưới' }, { id: 'plain', label: 'Không viền' }, { id: 'lines', label: 'Chỉ kẻ ngang' }, { id: 'striped', label: 'Sọc hàng' },
  { id: 'blue', label: 'Tiêu đề xanh' }, { id: 'dark', label: 'Tiêu đề tối' }, { id: 'green', label: 'Tiêu đề lục' }, { id: 'report', label: 'Báo cáo' },
];
const CELL_BORDERS = [{ id: '', label: 'Theo kiểu bảng' }, { id: 'all', label: 'Viền đủ bốn phía' }, { id: 'none', label: 'Không viền' }, { id: 'bottom', label: 'Chỉ viền dưới' }, { id: 'top', label: 'Chỉ viền trên' }, { id: 'sides', label: 'Chỉ viền hai bên' }];
const IMAGE_FRAMES = [{ id: '', label: 'Không khung' }, { id: 'thin', label: 'Viền mảnh' }, { id: 'thick', label: 'Viền dày' }, { id: 'shadow', label: 'Đổ bóng' }, { id: 'rounded', label: 'Bo góc' }, { id: 'circle', label: 'Hình tròn' }, { id: 'polaroid', label: 'Ảnh in' }];

export function TableTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const chain = () => editor.chain().focus();
  return (
    <>
      <Group label="Hàng & cột">
        <Rows>
          <Small icon={<ArrowUpToLine size={14} />} label="Chèn hàng trên" title="Chèn hàng phía trên" onClick={() => chain().addRowBefore().run()} />
          <Small icon={<ArrowDownToLine size={14} />} label="Chèn hàng dưới" title="Chèn hàng phía dưới" onClick={() => chain().addRowAfter().run()} />
        </Rows>
        <Rows>
          <Small icon={<ArrowLeftToLine size={14} />} label="Chèn cột trái" title="Chèn cột bên trái" onClick={() => chain().addColumnBefore().run()} />
          <Small icon={<ArrowRightToLine size={14} />} label="Chèn cột phải" title="Chèn cột bên phải" onClick={() => chain().addColumnAfter().run()} />
        </Rows>
        <Rows>
          <Small icon={<Rows2 size={14} />} label="Xoá hàng" title="Xoá hàng" onClick={() => chain().deleteRow().run()} />
          <Small icon={<Columns2 size={14} />} label="Xoá cột" title="Xoá cột" onClick={() => chain().deleteColumn().run()} />
          <Small icon={<Trash2 size={14} />} label="Xoá bảng" title="Xoá cả bảng" onClick={() => chain().deleteTable().run()} />
        </Rows>
      </Group>
      <Group label="Gộp ô">
        <Big icon={<Merge size={22} color="#2b579a" />} label="Gộp ô" title="Gộp các ô đang chọn" disabled={!fmt.canMerge} onClick={() => chain().mergeCells().run()} />
        <Big icon={<SplitSquareHorizontal size={22} color="#2b579a" />} label="Tách ô" title="Tách ô đã gộp" disabled={!fmt.canSplit} onClick={() => chain().splitCell().run()} />
      </Group>
      <Group label="Kiểu bảng">
        <Rows>
          <Small icon={<TableIcon size={14} />} label="Hàng tiêu đề" title="Bật/tắt hàng tiêu đề" onClick={() => chain().toggleHeaderRow().run()} />
          <Small icon={<TableIcon size={14} />} label="Cột tiêu đề" title="Bật/tắt cột tiêu đề" onClick={() => chain().toggleHeaderColumn().run()} />
        </Rows>
        <Dropdown large title="Kiểu bảng" trigger={<><TableIcon size={22} color="#2b579a" /><span>Mẫu bảng</span></>}>
          {(close) => TABLE_STYLES.map((style) => <MenuItem key={style.id} label={style.label} active={fmt.tableStyle === style.id} onClick={() => { close(); chain().updateAttributes('table', { tableStyle: style.id }).run(); }} />)}
        </Dropdown>
        <ColorPicker title="Tô nền ô" icon={<PaintBucket size={14} />} swatch="#f4f6fa" noneLabel="Không tô" onPick={(color) => chain().setCellAttribute('backgroundColor', color).run()} />
        <Dropdown title="Viền ô đang chọn" trigger={<><Frame size={14} /><span>Viền ô</span></>}>
          {(close) => CELL_BORDERS.map((item) => <MenuItem key={item.id} label={item.label} onClick={() => { close(); chain().setCellAttribute('cellBorders', item.id || null).run(); }} />)}
        </Dropdown>
        <Dropdown title="Căn dọc trong ô" trigger={<><ChevronDown size={14} /><span>Căn dọc</span></>}>
          {(close) => [{ id: 'top', label: 'Trên' }, { id: 'middle', label: 'Giữa' }, { id: 'bottom', label: 'Dưới' }].map((item) => <MenuItem key={item.id} label={item.label} onClick={() => { close(); chain().setCellAttribute('vAlign', item.id).run(); }} />)}
        </Dropdown>
      </Group>
      <Group label="Dữ liệu">
        <Rows>
          <Small icon={<ArrowDownAZ size={14} />} label="Sắp xếp" title="Sắp xếp hàng theo cột đang chọn" onClick={() => void sortTable(ctx)} />
          <Small icon={<Sigma size={14} />} label="Công thức" title="Tính tổng, trung bình, đếm, lớn nhất, nhỏ nhất" onClick={() => void insertTableFormula(ctx)} />
        </Rows>
        <Rows>
          <Small icon={<UnfoldHorizontal size={14} />} label="Chia đều cột" title="Đặt các cột rộng bằng nhau" onClick={() => distributeColumns(ctx)} />
          <Small icon={<FileText size={14} />} label="Thành chữ" title="Chuyển bảng thành các dòng chữ, ô cách nhau bằng Tab" onClick={() => tableToText(ctx)} />
        </Rows>
      </Group>
    </>
  );
}

export function ImageTab() {
  const ctx = useDoc();
  const chain = () => ctx.editor.chain().focus();
  const align = String(ctx.editor.getAttributes('image').align ?? 'inline');
  const frame = String(ctx.editor.getAttributes('image').frame ?? '');
  const replaceImage = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      chain().setImageLayout({ src: await readAsDataUrl(file), alt: file.name }).run();
    } catch {
      ctx.ui.toast('Không đọc được ảnh này', true);
    }
  };
  const customSize = async () => {
    const current = parseInt(String(ctx.editor.getAttributes('image').width ?? '100'), 10) || 100;
    const res = await ctx.ui.ask({ title: 'Kích thước ảnh', fields: [{ name: 'width', label: 'Chiều rộng (% khổ trang)', type: 'number', value: current, min: 5, max: 100 }], confirmText: 'Áp dụng' });
    if (res) chain().setImageLayout({ width: `${Math.max(5, Math.min(100, Number(res.width) || 100))}%` }).run();
  };
  return (
    <>
      <Group label="Sắp xếp">
        <Small icon={<Type size={14} />} label="Cùng dòng" title="Ảnh nằm cùng dòng chữ" active={align === 'inline'} onClick={() => chain().setImageLayout({ align: 'inline' }).run()} />
        <Small icon={<AlignLeft size={14} />} label="Trái" title="Ảnh bên trái, chữ bao quanh" active={align === 'left'} onClick={() => chain().setImageLayout({ align: 'left' }).run()} />
        <Small icon={<AlignCenter size={14} />} label="Giữa" title="Ảnh giữa trang" active={align === 'center'} onClick={() => chain().setImageLayout({ align: 'center' }).run()} />
        <Small icon={<AlignRight size={14} />} label="Phải" title="Ảnh bên phải, chữ bao quanh" active={align === 'right'} onClick={() => chain().setImageLayout({ align: 'right' }).run()} />
      </Group>
      <Group label="Kích thước">
        {['25%', '50%', '75%', '100%'].map((w) => <Small key={w} icon={<ImageIcon size={14} />} label={w} title={`Rộng ${w} khổ trang`} onClick={() => chain().setImageLayout({ width: w }).run()} />)}
        <Small icon={<ImageIcon size={14} />} label="Khác…" title="Nhập chiều rộng tuỳ ý" onClick={() => void customSize()} />
      </Group>
      <Group label="Kiểu ảnh">
        <Dropdown large title="Khung ảnh" trigger={<><Frame size={22} color="#2b579a" /><span>Khung</span></>}>
          {(close) => IMAGE_FRAMES.map((item) => <MenuItem key={item.id} label={item.label} active={frame === item.id} onClick={() => { close(); chain().setImageLayout({ frame: item.id || null }).run(); }} />)}
        </Dropdown>
        <Big icon={<Crop size={22} color="#7c3aed" />} label="Sửa ảnh" title="Cắt, xoay, lật, chỉnh sáng và màu" onClick={() => ctx.openDialog('imageedit')} />
        <Big icon={<Replace size={22} color="#2b579a" />} label="Thay ảnh" title="Thay bằng ảnh khác, giữ bố cục và kích thước" onClick={() => void replaceImage()} />
      </Group>
      <Group label="Ảnh">
        <Big icon={<Settings2 size={22} color="#2b579a" />} label="Định dạng" title="Kích thước, mô tả ảnh, bố cục" onClick={() => void imageSettings(ctx)} />
        <Big icon={<Trash2 size={22} color="#d7473c" />} label="Xoá ảnh" title="Xoá ảnh" onClick={() => chain().deleteSelection().run()} />
      </Group>
    </>
  );
}
