import { Eraser, Highlighter, ImageDown, MousePointer2, PenLine, Pencil, Shapes, Trash2 } from 'lucide-react';
import { useDoc, type InkTool } from '../../DocContext';
import { bakeInkToImage } from '../../actionsExtra';
import { Big, Group, Rows, Small } from '../RibbonParts';

const PEN_COLORS = ['#111827', '#1d4ed8', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
const WIDTHS = [1, 2, 3, 5, 8];

export default function DrawTab() {
  const ctx = useDoc();
  const { view, setView, page, setPage } = ctx;
  const pick = (tool: InkTool | null) => {
    if (tool && view.viewMode !== 'print') setView({ viewMode: 'print', inkTool: tool });
    else setView({ inkTool: tool });
  };
  const strokes = page.ink?.length ?? 0;
  return (
    <>
      <Group label="Công cụ">
        <Big icon={<MousePointer2 size={22} color="#2b579a" />} label="Chọn" title="Thoát chế độ vẽ, quay lại soạn thảo" active={!view.inkTool} onClick={() => pick(null)} />
        <Big icon={<PenLine size={22} color={view.inkColor} />} label="Bút" title="Vẽ tay lên trang" active={view.inkTool === 'pen'} onClick={() => pick('pen')} />
        <Big icon={<Highlighter size={22} color="#d97706" />} label="Bút dạ" title="Tô dạ quang lên trang" active={view.inkTool === 'highlighter'} onClick={() => pick('highlighter')} />
        <Big icon={<Eraser size={22} color="#586071" />} label="Tẩy" title="Rê qua nét vẽ để xoá" active={view.inkTool === 'eraser'} onClick={() => pick('eraser')} />
      </Group>
      <Group label="Nét vẽ">
        <div className="ink-palette">
          {PEN_COLORS.map((color) => (
            <button key={color} type="button" className={`color-swatch ${view.inkColor === color ? 'selected' : ''}`} style={{ background: color }} title={`Màu ${color}`} aria-label={`Màu ${color}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setView({ inkColor: color })} />
          ))}
        </div>
        <div className="ink-widths">
          {WIDTHS.map((width) => (
            <button key={width} type="button" className={`ink-width ${view.inkWidth === width ? 'on' : ''}`} title={`Độ dày ${width}`} aria-label={`Độ dày ${width}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setView({ inkWidth: width })}>
              <span style={{ height: width, background: view.inkColor }} />
            </button>
          ))}
        </div>
      </Group>
      <Group label="Nét đã vẽ">
        <Rows>
          <Small icon={<ImageDown size={14} />} label="Chuyển thành ảnh" title="Gộp mọi nét vẽ thành một ảnh tại vị trí con trỏ, ảnh này đi theo khi xuất tệp" disabled={!strokes} onClick={() => void bakeInkToImage(ctx)} />
          <Small icon={<Trash2 size={14} />} label="Xoá hết nét" title="Xoá mọi nét vẽ trên các trang" disabled={!strokes} onClick={() => setPage({ ink: [] })} />
        </Rows>
      </Group>
      <Group label="Bản vẽ">
        <Big icon={<Pencil size={22} color="#4338ca" />} label="Bản vẽ" title="Mở khung vẽ đường, mũi tên, hình và chữ rồi chèn thành ảnh" onClick={() => ctx.openDialog('drawing')} />
        <Big icon={<Shapes size={22} color="#0891b2" />} label="Ký tên" title="Vẽ chữ ký và chèn vào tài liệu" onClick={() => ctx.openDialog('signature')} />
      </Group>
    </>
  );
}
