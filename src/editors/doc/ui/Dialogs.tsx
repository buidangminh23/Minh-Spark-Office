import { useMemo, useRef, useState } from 'react';
import { Calculator, Keyboard, LayoutTemplate, PenTool } from 'lucide-react';
import { useDoc } from '../DocContext';
import { textStats } from '../docTools';
import { DOC_TEMPLATES } from '../docTemplates';
import Modal from './Modal';

export const SHORTCUTS: [string, string][] = [
  ['Ctrl+S', 'Lưu ngay'], ['Ctrl+Z / Ctrl+Y', 'Hoàn tác / Làm lại'], ['Ctrl+F', 'Tìm'], ['Ctrl+H', 'Tìm và thay thế'], ['Ctrl+P', 'In / Lưu PDF'],
  ['Ctrl+B / I / U', 'Đậm / Nghiêng / Gạch chân'], ['Ctrl+Shift+X', 'Gạch ngang'], ['Ctrl+, / Ctrl+.', 'Chỉ số dưới / trên'], ['Ctrl+] / Ctrl+[', 'Tăng / giảm cỡ chữ'],
  ['Ctrl+L / E / R / J', 'Căn trái / giữa / phải / đều'], ['Ctrl+Alt+0…3', 'Normal / Heading 1–3'], ['Ctrl+Shift+7 / 8 / 9', 'Đánh số / dấu đầu dòng / việc cần làm'],
  ['Tab / Shift+Tab', 'Thụt lề / bỏ thụt lề'], ['Ctrl+Enter', 'Ngắt trang'], ['Ctrl+K', 'Chèn liên kết'], ['Ctrl+Alt+M', 'Bình luận mới'], ['Ctrl+Alt+F', 'Chú thích cuối trang'],
  ['Ctrl+Shift+C', 'Chổi định dạng'], ['Ctrl+Shift+V', 'Dán chỉ lấy chữ'], ['Ctrl+Shift+E', 'Bật/tắt theo dõi thay đổi'], ['Ctrl+Shift+G', 'Đếm từ'], ['F7', 'Soát chính tả'],
  ['Ctrl+1 / 2 / 5', 'Giãn dòng đơn / đôi / rưỡi'], ['Ctrl+0', 'Thêm hoặc bỏ khoảng trước đoạn'], ['Ctrl+M / Ctrl+Shift+M', 'Thụt lề / bỏ thụt lề'], ['Ctrl+Q', 'Xoá định dạng đoạn'], ['Ctrl+Space', 'Xoá định dạng ký tự'], ['Ctrl+Shift+D', 'Gạch chân đôi'], ['Ctrl+Shift+K', 'Chữ hoa nhỏ'], ['Ctrl+Shift+F', 'Hộp thoại phông chữ'], ['Ctrl+Shift+S', 'Áp dụng kiểu'], ['Shift+F3', 'Đổi hoa thường'], ['F4', 'Lặp lại thao tác vừa làm'], ['F9', 'Cập nhật trường và mục lục'], ['Shift+F5', 'Về vị trí sửa trước đó'], ['Shift+F7', 'Từ đồng nghĩa'], ['Alt+Q', 'Tìm lệnh'], ['Alt+Shift+← / →', 'Nâng / hạ cấp tiêu đề'], ['Alt+Shift+↑ / ↓', 'Chuyển đoạn lên / xuống'], ['Alt+Shift+D / T', 'Chèn ngày / giờ'], ['Alt+Shift+X', 'Đánh dấu mục chỉ mục'], ['Alt+Shift+I', 'Đánh dấu trích dẫn pháp lý'], ['Ctrl+Alt+D', 'Chú thích cuối bài'], ['Ctrl+Alt+O / N / P', 'Dàn ý / Bản nháp / Bố cục in'], ['Ctrl+Alt+S', 'Chia đôi màn hình'], ['Ctrl+Alt+H', 'Tô sáng chữ'], ['Alt+=', 'Chèn công thức toán (Word)'], ['Ctrl+\\', 'Xoá định dạng'], ['Ctrl+= / Ctrl+-', 'Phóng to / thu nhỏ'], ['Ctrl+/', 'Danh sách phím tắt'], ['/', 'Menu chèn nhanh ở đầu dòng'], ['Chuột phải', 'Menu ngữ cảnh'], ['Esc', 'Thoát chế độ đọc / đóng hộp thoại'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const rows = SHORTCUTS.filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal title="Phím tắt" icon={<Keyboard size={20} />} onClose={onClose} width={620}>
      <input className="text-field" placeholder="Tìm phím tắt…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
      <div className="shortcut-list">
        {rows.map(([key, label]) => <div key={key} className="shortcut-row"><span>{label}</span><kbd>{key}</kbd></div>)}
      </div>
    </Modal>
  );
}

export function WordCountDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const all = useMemo(() => textStats(editor.getText({ blockSeparator: '\n' })), [editor]);
  const { from, to, empty } = editor.state.selection;
  const selection = empty ? null : textStats(editor.state.doc.textBetween(from, to, '\n'));
  const pages = Math.max(1, document.querySelectorAll('.page-sheet').length);
  const rows: [string, number | string, number | string | null][] = [
    ['Trang', pages, null],
    ['Từ', all.words, selection?.words ?? null],
    ['Ký tự (không dấu cách)', all.charsNoSpaces, selection?.charsNoSpaces ?? null],
    ['Ký tự (có dấu cách)', all.chars, selection?.chars ?? null],
    ['Đoạn văn', all.paragraphs, selection?.paragraphs ?? null],
    ['Câu', all.sentences, selection?.sentences ?? null],
    ['Thời gian đọc', `~${all.readMinutes} phút`, null],
    ['Thời gian trình bày', `~${all.speakMinutes} phút`, null],
    ['Độ dễ đọc (0–100)', all.readability, null],
  ];
  return (
    <Modal title="Đếm từ" icon={<Calculator size={20} />} onClose={onClose} width={440} actions={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      <table className="stats-table">
        <thead><tr><th>Thống kê</th><th>Tài liệu</th>{selection && <th>Đoạn chọn</th>}</tr></thead>
        <tbody>{rows.map(([label, value, sel]) => <tr key={label}><td>{label}</td><td>{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</td>{selection && <td>{sel === null ? '' : sel.toLocaleString('vi-VN')}</td>}</tr>)}</tbody>
      </table>
    </Modal>
  );
}

export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const apply = async (html: string, replace: boolean) => {
    if (replace) {
      if (!(await ctx.ui.confirm('Thay nội dung hiện tại?', 'Nội dung đang soạn sẽ được thay bằng mẫu. Có thể hoàn tác bằng Ctrl+Z.'))) return;
      ctx.editor.chain().focus().setContent(html).run();
      ctx.markDirty();
    } else {
      ctx.onNewDocument(html);
    }
    onClose();
  };
  return (
    <Modal title="Mẫu tài liệu" icon={<LayoutTemplate size={20} />} onClose={onClose} width={720}>
      <div className="template-grid">
        {DOC_TEMPLATES.map((t) => (
          <div key={t.id} className="template-tile">
            <div className="template-thumb" dangerouslySetInnerHTML={{ __html: t.html() }} />
            <strong>{t.name}</strong>
            <span>{t.description}</span>
            <div className="template-actions">
              <button className="btn" onClick={() => void apply(t.html(), false)}>Tạo tệp mới</button>
              <button className="btn" onClick={() => void apply(t.html(), true)}>Dùng tại đây</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

const PEN_COLORS = ['#1a365d', '#000000', '#2b579a', '#d7473c', '#107c41'];

export function SignatureDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(2.5);
  const [dirty, setDirty] = useState(false);
  const point = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * canvas.current!.width) / rect.width, y: ((e.clientY - rect.top) * canvas.current!.height) / rect.height };
  };
  const insert = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx2d = c.getContext('2d')!;
    const { data, width: w, height: h } = ctx2d.getImageData(0, 0, c.width, c.height);
    let minX = w; let minY = h; let maxX = 0; let maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (maxX <= minX) return;
    const crop = document.createElement('canvas');
    crop.width = maxX - minX + 16;
    crop.height = maxY - minY + 16;
    crop.getContext('2d')!.drawImage(c, minX - 8, minY - 8, crop.width, crop.height, 0, 0, crop.width, crop.height);
    ctx.editor.chain().focus().setImage({ src: crop.toDataURL('image/png'), alt: 'Chữ ký' }).run();
    onClose();
  };
  return (
    <Modal title="Vẽ tay / ký tên" icon={<PenTool size={20} />} onClose={onClose} width={620} actions={<><button className="btn" onClick={() => { canvas.current?.getContext('2d')?.clearRect(0, 0, 1200, 400); setDirty(false); }}>Xoá vẽ lại</button><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!dirty} onClick={insert}>Chèn vào tài liệu</button></>}>
      <div className="pen-toolbar">
        {PEN_COLORS.map((c) => <button key={c} type="button" className={`color-swatch ${color === c ? 'selected' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />)}
        <label>Nét <input type="range" min={1} max={8} step={0.5} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
      </div>
      <canvas ref={canvas} width={1120} height={360} className="signature-pad"
        onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const c2 = canvas.current!.getContext('2d')!; const p = point(e); c2.beginPath(); c2.moveTo(p.x, p.y); c2.strokeStyle = color; c2.lineWidth = width * 2; c2.lineCap = 'round'; c2.lineJoin = 'round'; }}
        onPointerMove={(e) => { if (!drawing.current) return; const c2 = canvas.current!.getContext('2d')!; const p = point(e); c2.lineTo(p.x, p.y); c2.stroke(); setDirty(true); }}
        onPointerUp={() => { drawing.current = false; }} />
    </Modal>
  );
}
