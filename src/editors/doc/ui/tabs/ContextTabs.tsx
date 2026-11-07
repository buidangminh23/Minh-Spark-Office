import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, Columns2, Image as ImageIcon, Merge, PaintBucket, Rows2, Settings2, SplitSquareHorizontal, Table as TableIcon, Trash2, Type } from 'lucide-react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { imageSettings } from '../../actions';
import { Big, ColorPicker, Group, Rows, Small } from '../RibbonParts';

export function TableTab({ fmt }: { fmt: FormatState }) {
  const { editor } = useDoc();
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
        <ColorPicker title="Tô nền ô" icon={<PaintBucket size={14} />} swatch="#f4f6fa" noneLabel="Không tô" onPick={(color) => chain().setCellAttribute('backgroundColor', color).run()} />
      </Group>
    </>
  );
}

export function ImageTab() {
  const ctx = useDoc();
  const chain = () => ctx.editor.chain().focus();
  const align = String(ctx.editor.getAttributes('image').align ?? 'inline');
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
      </Group>
      <Group label="Ảnh">
        <Big icon={<Settings2 size={22} color="#2b579a" />} label="Định dạng" title="Kích thước, mô tả ảnh, bố cục" onClick={() => void imageSettings(ctx)} />
        <Big icon={<Trash2 size={22} color="#d7473c" />} label="Xoá ảnh" title="Xoá ảnh" onClick={() => chain().deleteSelection().run()} />
      </Group>
    </>
  );
}
