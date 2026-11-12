import { Blend, Eraser, FileArchive, Palette, RotateCcw, AlignCenter, AlignLeft, AlignRight, ArrowDownAZ, ArrowUpDown, BetweenHorizontalStart, Grid3x3, Maximize2, SquareDashedMousePointer, PanelTop, ScanLine, TextCursor, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ChevronDown, Columns2, Crop, FileText, Frame, Image as ImageIcon, Merge, PaintBucket, Replace, Rows2, Settings2, Sigma, SplitSquareHorizontal, Table as TableIcon, Trash2, Type, UnfoldHorizontal, WrapText } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { imageSettings } from '../../actions';
import { distributeColumns, insertTableFormula, sortTable, tableToText } from '../../actionsExtra';
import { pickFile, readAsDataUrl } from '../../../../lib/download';
import { Big, ColorPicker, Dropdown, Group, MenuItem, Rows, Small } from '../RibbonParts';
import { setWrap, WRAP_LABELS, wrapOf, type WrapKind } from '../../layoutObjects';
import { alignCells, cellMargins, currentColumnWidth, currentRowHeight, distributeRows, repeatsHeader, selectInTable, setAutofit, setColumnWidth, setRowHeight, setTextDirection, splitTable, tableProperties, toggleRepeatHeader, type CellAlign, type SelectTarget } from '../../tableLayout';
import { Spinner } from './LayoutTabs';
import { ART_EFFECTS } from '../../imageEffects';
import { applyImageArtEffect, compressImage, removeImageBackground, resetImage, setImageTransparency } from '../../imageTools';

const CM = 37.8;
const toCm = (px: number | null) => (px ? Math.round((px / CM) * 100) / 100 : 0);
const V_LABEL = { top: 'trên', middle: 'giữa', bottom: 'dưới' } as const;
const H_LABEL = { left: 'trái', center: 'giữa', right: 'phải' } as const;
const CELL_ALIGNS: { align: CellAlign; label: string }[] = (['top', 'middle', 'bottom'] as const).flatMap((v) => (['left', 'center', 'right'] as const).map((h) => ({ align: { h, v }, label: `${V_LABEL[v]} ${H_LABEL[h]}` })));
const SELECT_TARGETS: { id: SelectTarget; label: string }[] = [{ id: 'cell', label: 'Chọn ô' }, { id: 'row', label: 'Chọn hàng' }, { id: 'column', label: 'Chọn cột' }, { id: 'table', label: 'Chọn bảng' }];
const TEXT_DIRECTIONS = [{ id: null, label: 'Ngang' }, { id: 'vertical-rl' as const, label: 'Dọc, trên xuống dưới' }, { id: 'vertical-lr' as const, label: 'Dọc, dưới lên trên' }];
const AUTOFITS = [{ id: 'contents' as const, label: 'Tự khớp theo nội dung' }, { id: 'window' as const, label: 'Tự khớp theo khổ trang' }, { id: 'fixed' as const, label: 'Độ rộng cột cố định' }];

const TABLE_STYLES = [
  { id: 'grid', label: 'Lưới' }, { id: 'plain', label: 'Không viền' }, { id: 'lines', label: 'Chỉ kẻ ngang' }, { id: 'striped', label: 'Sọc hàng' },
  { id: 'blue', label: 'Tiêu đề xanh' }, { id: 'dark', label: 'Tiêu đề tối' }, { id: 'green', label: 'Tiêu đề lục' }, { id: 'report', label: 'Báo cáo' },
];
const CELL_BORDERS = [{ id: '', label: 'Theo kiểu bảng' }, { id: 'all', label: 'Viền đủ bốn phía' }, { id: 'none', label: 'Không viền' }, { id: 'bottom', label: 'Chỉ viền dưới' }, { id: 'top', label: 'Chỉ viền trên' }, { id: 'sides', label: 'Chỉ viền hai bên' }];
const IMAGE_FRAMES = [{ id: '', label: 'Không khung' }, { id: 'thin', label: 'Viền mảnh' }, { id: 'thick', label: 'Viền dày' }, { id: 'shadow', label: 'Đổ bóng' }, { id: 'rounded', label: 'Bo góc' }, { id: 'circle', label: 'Hình tròn' }, { id: 'polaroid', label: 'Ảnh in' }, { id: 'soft-shadow', label: 'Bóng mềm' }, { id: 'reflection', label: 'Phản chiếu' }, { id: 'bevel', label: 'Vát cạnh' }, { id: 'tilt-left', label: 'Phối cảnh 3D, nghiêng trái' }, { id: 'tilt-right', label: 'Phối cảnh 3D, nghiêng phải' }];

export function TableTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const chain = () => editor.chain().focus();
  const size = useEditorState({
    editor,
    selector: () => ({ height: currentRowHeight(ctx), width: currentColumnWidth(ctx), repeat: repeatsHeader(ctx), autofit: String(editor.getAttributes('table').autofit ?? 'window') }),
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  return (
    <>
      <Group label="Bảng">
        <Dropdown large title="Chọn ô, hàng, cột hoặc cả bảng" trigger={<><SquareDashedMousePointer size={22} color="#2b579a" /><span>Chọn</span></>}>
          {(close) => SELECT_TARGETS.map((item) => <MenuItem key={item.id} label={item.label} onClick={() => { close(); selectInTable(ctx, item.id); }} />)}
        </Dropdown>
        <Big icon={<Grid3x3 size={22} color="#2b579a" />} label="Đường lưới" title="Hiện đường lưới nét đứt cho ô không viền (không in ra)" active={ctx.view.tableGridlines} onClick={() => ctx.setView({ tableGridlines: !ctx.view.tableGridlines })} />
        <Big icon={<Settings2 size={22} color="#2b579a" />} label="Thuộc tính" title="Chiều rộng, căn bảng, tự khớp, lề ô" onClick={() => void tableProperties(ctx)} />
      </Group>
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
        <Big icon={<BetweenHorizontalStart size={22} color="#2b579a" />} label="Tách bảng" title="Tách bảng thành hai, bảng sau bắt đầu từ hàng đang chọn" onClick={() => splitTable(ctx)} />
      </Group>
      <Group label="Kích thước ô">
        <Dropdown large title="Tự khớp độ rộng cột" trigger={<><Maximize2 size={22} color="#2b579a" /><span>Tự khớp</span></>} width={230}>
          {(close) => AUTOFITS.map((item) => <MenuItem key={item.id} label={item.label} active={size.autofit === item.id} onClick={() => { close(); setAutofit(ctx, item.id); }} />)}
        </Dropdown>
        <div className="spinner-column">
          <Spinner label="Cao" icon={<ArrowUpDown size={12} />} value={toCm(size.height)} step={0.1} min={0.3} max={20} unit="cm" onCommit={(value) => setRowHeight(ctx, value * CM)} />
          <Spinner label="Rộng" icon={<UnfoldHorizontal size={12} />} value={toCm(size.width)} step={0.1} min={0.6} max={40} unit="cm" onCommit={(value) => setColumnWidth(ctx, value * CM)} />
        </div>
        <Rows>
          <Small icon={<Rows2 size={14} />} label="Chia đều hàng" title="Đặt các hàng cao bằng nhau" onClick={() => distributeRows(ctx)} />
          <Small icon={<UnfoldHorizontal size={14} />} label="Chia đều cột" title="Đặt các cột rộng bằng nhau" onClick={() => distributeColumns(ctx)} />
        </Rows>
      </Group>
      <Group label="Căn chỉnh">
        <div className="cell-align-grid" role="group" aria-label="Căn chữ trong ô">
          {CELL_ALIGNS.map(({ align, label }) => (
            <button key={label} type="button" className="cell-align-btn" title={`Căn ${label}`} aria-label={`Căn ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => alignCells(ctx, align)}>
              <span className={`cell-align-icon v-${align.v} h-${align.h}`} aria-hidden="true"><i /><i /></span>
            </button>
          ))}
        </div>
        <Dropdown large title="Hướng chữ trong ô" trigger={<><TextCursor size={22} color="#2b579a" /><span>Hướng chữ</span></>}>
          {(close) => TEXT_DIRECTIONS.map((item) => <MenuItem key={item.label} label={item.label} onClick={() => { close(); setTextDirection(ctx, item.id); }} />)}
        </Dropdown>
        <Big icon={<ScanLine size={22} color="#2b579a" />} label="Lề ô" title="Khoảng cách từ chữ tới viền ô" onClick={() => void cellMargins(ctx)} />
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
          <Small icon={<PanelTop size={14} />} label="Lặp hàng tiêu đề" title="Lặp các hàng đầu tới hàng đang chọn ở đầu mỗi trang khi bảng sang trang" active={size.repeat} onClick={() => toggleRepeatHeader(ctx)} />
          <Small icon={<FileText size={14} />} label="Thành chữ" title="Chuyển bảng thành các dòng chữ, ô cách nhau bằng Tab" onClick={() => tableToText(ctx)} />
        </Rows>
      </Group>
    </>
  );
}

export function ImageTab() {
  const ctx = useDoc();
  const chain = () => ctx.editor.chain().focus();
  const imageAttrs = ctx.editor.getAttributes('image');
  const align = String(imageAttrs.align ?? 'inline');
  const frame = String(imageAttrs.frame ?? '');
  const wrap = wrapOf(imageAttrs);
  const floating = wrap === 'front' || wrap === 'behind';
  const placeInFlow = (next: 'left' | 'center' | 'right') => {
    if (floating) setWrap(ctx, 'inline');
    chain().setImageLayout({ align: next }).run();
  };
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
      <Group label="Điều chỉnh">
        <Big icon={<Eraser size={22} color="#7c3aed" />} label="Xoá nền" title="Xoá vùng nền liền mạch quanh mép ảnh, nền thành trong suốt" onClick={() => void removeImageBackground(ctx)} />
        <Dropdown large title="Hiệu ứng nghệ thuật" trigger={<><Palette size={22} color="#2b579a" /><span>Hiệu ứng</span></>} width={220}>
          {(close) => ART_EFFECTS.map((item) => <MenuItem key={item.id} label={item.label} onClick={() => { close(); void applyImageArtEffect(ctx, item.id); }} />)}
        </Dropdown>
        <Rows>
          <Small icon={<Blend size={14} />} label="Trong suốt" title="Đặt độ trong suốt cho cả ảnh" onClick={() => void setImageTransparency(ctx)} />
          <Small icon={<FileArchive size={14} />} label="Nén ảnh" title="Giảm kích thước tệp ảnh cho email, web hoặc in" onClick={() => void compressImage(ctx)} />
          <Small icon={<RotateCcw size={14} />} label="Đặt lại ảnh" title="Bỏ mọi chỉnh sửa, lấy lại ảnh gốc" onClick={() => resetImage(ctx)} />
        </Rows>
      </Group>
      <Group label="Sắp xếp">
        <Small icon={<Type size={14} />} label="Cùng dòng" title="Ảnh nằm cùng dòng chữ, kéo để đổi chỗ trong dòng" active={wrap === 'inline'} onClick={() => setWrap(ctx, 'inline')} />
        <Small icon={<AlignLeft size={14} />} label="Trái" title="Ảnh bên trái, chữ bao quanh" active={!floating && align === 'left'} onClick={() => placeInFlow('left')} />
        <Small icon={<AlignCenter size={14} />} label="Giữa" title="Ảnh giữa trang" active={!floating && align === 'center'} onClick={() => placeInFlow('center')} />
        <Small icon={<AlignRight size={14} />} label="Phải" title="Ảnh bên phải, chữ bao quanh" active={!floating && align === 'right'} onClick={() => placeInFlow('right')} />
      </Group>
      <Group label="Bố cục">
        <Big icon={<WrapText size={22} color="#7c3aed" />} label="Kéo tự do" title="Đặt ảnh trước chữ để kéo tới bất kỳ chỗ nào trên trang" active={wrap === 'front'} onClick={() => setWrap(ctx, 'front')} />
        <Dropdown large title="Cách chữ bao quanh ảnh. Chọn Trước chữ hoặc Sau chữ để kéo ảnh tự do trên trang" trigger={<><WrapText size={22} color="#2b579a" /><span>Bao chữ</span></>} width={250}>
          {(close) => (Object.keys(WRAP_LABELS) as WrapKind[]).map((kind) => (
            <MenuItem key={kind} label={kind === 'front' || kind === 'behind' ? `${WRAP_LABELS[kind]} (kéo tự do)` : WRAP_LABELS[kind]} active={wrap === kind} onClick={() => { close(); setWrap(ctx, kind); }} />
          ))}
        </Dropdown>
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
