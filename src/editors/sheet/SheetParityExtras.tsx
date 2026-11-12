import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Play, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { ParityDialog } from './SheetParityModals';
import { WORDART_FONTS, WORDART_PRESETS, WORDART_TRANSFORMS, wordArtDataUrl, type WordArtTransform } from '../doc/insertWordArt';
import type { SheetAllowRange, SheetCustomView, SheetQuery } from '../../lib/storage';

export type ImagePayload = { url: string; width: number; height: number };

export function svgToPng(svgUrl: string, scale = 2): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || 400;
      const height = image.naturalHeight || 120;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas không khả dụng'));
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, width, height);
      resolve({ url: canvas.toDataURL('image/png'), width, height });
    };
    image.onerror = () => reject(new Error('Không dựng được ảnh'));
    image.src = svgUrl;
  });
}

export type SmartArtLayout = 'list' | 'process' | 'cycle' | 'hierarchy' | 'pyramid' | 'matrix';
const SMARTART_LAYOUTS: { id: SmartArtLayout; label: string }[] = [
  { id: 'list', label: 'Danh sách' },
  { id: 'process', label: 'Quy trình' },
  { id: 'cycle', label: 'Chu trình' },
  { id: 'hierarchy', label: 'Phân cấp' },
  { id: 'pyramid', label: 'Kim tự tháp' },
  { id: 'matrix', label: 'Ma trận' },
];
const SMARTART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'];

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) => {
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((item, i) => ctx.fillText(item, x, y + (i - (Math.min(lines.length, 3) - 1) / 2) * 17));
};

export function renderSmartArt(layout: SmartArtLayout, items: string[], width = 720, height = 360): ImagePayload {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { url: '', width, height };
  ctx.scale(2, 2);
  const list = items.length ? items : ['Bước 1', 'Bước 2', 'Bước 3'];
  const n = list.length;
  const color = (i: number) => SMARTART_COLORS[i % SMARTART_COLORS.length];
  if (layout === 'list' || layout === 'process') {
    const gap = layout === 'process' ? 34 : 14;
    const w = (width - 20 - gap * (n - 1)) / n;
    list.forEach((item, i) => {
      const x = 10 + i * (w + gap);
      ctx.fillStyle = color(i);
      roundRect(ctx, x, height / 2 - 50, w, 100, 10);
      ctx.fill();
      label(ctx, item, x + w / 2, height / 2, w - 12);
      if (layout === 'process' && i < n - 1) {
        ctx.fillStyle = '#94a3b8';
        const ax = x + w + 6;
        ctx.beginPath();
        ctx.moveTo(ax, height / 2 - 12);
        ctx.lineTo(ax + gap - 12, height / 2);
        ctx.lineTo(ax, height / 2 + 12);
        ctx.fill();
      }
    });
  } else if (layout === 'cycle') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 60;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    list.forEach((item, i) => {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.fillStyle = color(i);
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, item, x, y, 84);
    });
  } else if (layout === 'hierarchy') {
    const [root, ...children] = list;
    const childW = Math.min(150, (width - 20 - 12 * Math.max(0, children.length - 1)) / Math.max(1, children.length));
    const rootX = width / 2 - 90;
    ctx.fillStyle = color(0);
    roundRect(ctx, rootX, 30, 180, 70, 10);
    ctx.fill();
    label(ctx, root, width / 2, 65, 168);
    const totalW = children.length * childW + (children.length - 1) * 12;
    children.forEach((item, i) => {
      const x = (width - totalW) / 2 + i * (childW + 12);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width / 2, 100);
      ctx.lineTo(width / 2, 150);
      ctx.lineTo(x + childW / 2, 150);
      ctx.lineTo(x + childW / 2, 200);
      ctx.stroke();
      ctx.fillStyle = color(i + 1);
      roundRect(ctx, x, 200, childW, 70, 10);
      ctx.fill();
      label(ctx, item, x + childW / 2, 235, childW - 10);
    });
  } else if (layout === 'pyramid') {
    const levelH = (height - 20) / n;
    list.forEach((item, i) => {
      const topW = ((i + 0.0) / n) * (width - 40);
      const bottomW = ((i + 1) / n) * (width - 40);
      const y = 10 + i * levelH;
      ctx.fillStyle = color(i);
      ctx.beginPath();
      ctx.moveTo(width / 2 - topW / 2, y);
      ctx.lineTo(width / 2 + topW / 2, y);
      ctx.lineTo(width / 2 + bottomW / 2, y + levelH - 3);
      ctx.lineTo(width / 2 - bottomW / 2, y + levelH - 3);
      ctx.fill();
      label(ctx, item, width / 2, y + levelH / 2, Math.max(80, bottomW - 40));
    });
  } else {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const w = (width - 20 - 10 * (cols - 1)) / cols;
    const h = (height - 20 - 10 * (rows - 1)) / rows;
    list.forEach((item, i) => {
      const x = 10 + (i % cols) * (w + 10);
      const y = 10 + Math.floor(i / cols) * (h + 10);
      ctx.fillStyle = color(i);
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
      label(ctx, item, x + w / 2, y + h / 2, w - 16);
    });
  }
  return { url: canvas.toDataURL('image/png'), width, height };
}

export function SmartArtModal({ onInsert, onClose }: { onInsert: (image: ImagePayload) => Promise<void>; onClose: () => void }) {
  const [layout, setLayout] = useState<SmartArtLayout>('process');
  const [text, setText] = useState('Tiếp nhận\nKhảo sát\nThi công\nNghiệm thu');
  const items = useMemo(() => text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12), [text]);
  const preview = useMemo(() => renderSmartArt(layout, items), [layout, items]);
  return (
    <ParityDialog
      title="Chèn SmartArt"
      subtitle="Mỗi dòng là một khối. Dòng đầu là gốc khi chọn kiểu Phân cấp."
      width={820}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-sheet" onClick={() => void onInsert({ ...preview, width: 480, height: 240 }).then(onClose)}><Plus size={14} /><span>Chèn</span></button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {SMARTART_LAYOUTS.map((item) => <button key={item.id} className={`btn ${layout === item.id ? 'btn-sheet' : ''}`} onClick={() => setLayout(item.id)}>{item.label}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10 }}>
        <textarea className="text-field" style={{ minHeight: 240 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Nội dung SmartArt" />
        <img src={preview.url} alt="Xem trước SmartArt" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8 }} />
      </div>
    </ParityDialog>
  );
}

const ICON_SET: { group: string; glyphs: string[] }[] = [
  { group: 'Mũi tên', glyphs: ['⬆️', '⬇️', '⬅️', '➡️', '↗️', '↘️', '🔄', '🔁'] },
  { group: 'Trạng thái', glyphs: ['✅', '❌', '⚠️', '⛔', '🟢', '🟡', '🔴', '⭐', '❗', '❓'] },
  { group: 'Kinh doanh', glyphs: ['📈', '📉', '📊', '💰', '💵', '🧾', '🏦', '💼', '🛒', '📦'] },
  { group: 'Con người', glyphs: ['👤', '👥', '👷', '🧑‍💼', '🤝', '📞', '✉️', '💬'] },
  { group: 'Công trình', glyphs: ['🏗️', '🏠', '🏢', '⚡', '🔧', '🔨', '🚧', '🚚', '🔌', '💡'] },
  { group: 'Thời gian', glyphs: ['📅', '⏰', '⌛', '🗓️', '⏳', '🕒'] },
];

export function emojiToPng(glyph: string, size = 96): ImagePayload {
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(2, 2);
    ctx.font = `${size * 0.82}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.04);
  }
  return { url: canvas.toDataURL('image/png'), width: 48, height: 48 };
}

export function IconPickerModal({ onInsert, onClose }: { onInsert: (image: ImagePayload) => Promise<void>; onClose: () => void }) {
  return (
    <ParityDialog title="Chèn biểu tượng (Icons)" subtitle="Bấm một biểu tượng để chèn vào ô đang chọn." width={560} onClose={onClose}>
      {ICON_SET.map((set) => (
        <div key={set.group} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>{set.group}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {set.glyphs.map((glyph) => (
              <button key={glyph} className="btn" style={{ fontSize: 22, minWidth: 44 }} onClick={() => void onInsert(emojiToPng(glyph))} aria-label={`Chèn ${glyph}`}>{glyph}</button>
            ))}
          </div>
        </div>
      ))}
    </ParityDialog>
  );
}

export function WordArtModal({ onInsert, onClose }: { onInsert: (image: ImagePayload) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState('Minh Spark');
  const [preset, setPreset] = useState(WORDART_PRESETS[1].id);
  const [font, setFont] = useState(WORDART_FONTS[0]);
  const [transform, setTransform] = useState<WordArtTransform>('none');
  const url = useMemo(() => wordArtDataUrl({ text, preset, font, size: 64, transform }), [text, preset, font, transform]);
  const insert = async () => {
    const png = await svgToPng(url);
    const scale = Math.min(1, 480 / png.width);
    await onInsert({ url: png.url, width: Math.round(png.width * scale), height: Math.round(png.height * scale) });
    onClose();
  };
  return (
    <ParityDialog
      title="Chèn WordArt"
      width={640}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn btn-sheet" onClick={() => void insert()}><Plus size={14} /><span>Chèn</span></button>
        </>
      }
    >
      <label className="field"><span className="field-label">Nội dung</span><input className="text-field" value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field"><span className="field-label">Phông</span><select className="text-field" value={font} onChange={(e) => setFont(e.target.value)}>{WORDART_FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label className="field"><span className="field-label">Hiệu ứng</span><select className="text-field" value={transform} onChange={(e) => setTransform(e.target.value as WordArtTransform)}>{WORDART_TRANSFORMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {WORDART_PRESETS.map((item) => <button key={item.id} className={`btn ${preset === item.id ? 'btn-sheet' : ''}`} onClick={() => setPreset(item.id)}>{item.label}</button>)}
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, textAlign: 'center', background: '#fff' }}><img src={url} alt="Xem trước WordArt" style={{ maxWidth: '100%', maxHeight: 160 }} /></div>
    </ParityDialog>
  );
}

const toDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && value > 20000 && value < 80000) return new Date(Math.round((value - 25569) * 86400000));
  if (typeof value === 'string') {
    const vn = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (vn) return new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]));
    const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  return null;
};

export type TimelineLevel = 'year' | 'quarter' | 'month';

export const periodKey = (date: Date, level: TimelineLevel) =>
  level === 'year' ? `${date.getFullYear()}` : level === 'quarter' ? `Q${Math.floor(date.getMonth() / 3) + 1}/${date.getFullYear()}` : `T${date.getMonth() + 1}/${date.getFullYear()}`;

export function TimelineModal({ headers, rows, onApply, onClose }: { headers: string[]; rows: unknown[][]; onApply: (visibleRowIndexes: number[] | null, caption: string) => void; onClose: () => void }) {
  const dateColumns = headers.map((_, i) => i).filter((i) => rows.filter((row) => toDate(row[i])).length >= Math.max(1, rows.length / 2));
  const [column, setColumn] = useState(dateColumns[0] ?? 0);
  const [level, setLevel] = useState<TimelineLevel>('month');
  const [active, setActive] = useState<string | null>(null);
  const periods = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row) => {
      const date = toDate(row[column]);
      if (date) seen.set(periodKey(date, level), date.getTime());
    });
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key);
  }, [rows, column, level]);
  const choose = (key: string | null) => {
    setActive(key);
    if (!key) return onApply(null, 'Tất cả thời gian');
    const visible = rows.flatMap((row, i) => {
      const date = toDate(row[column]);
      return date && periodKey(date, level) === key ? [i] : [];
    });
    onApply(visible, key);
  };
  return (
    <ParityDialog title="Timeline: lọc theo thời gian" subtitle="Bấm một mốc để chỉ hiện các dòng thuộc mốc đó." width={640} onClose={onClose}>
      {!dateColumns.length && <div className="parity-note">Vùng đang chọn chưa có cột ngày tháng.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="field"><span className="field-label">Cột ngày</span><select className="text-field" value={column} onChange={(e) => setColumn(Number(e.target.value))}>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
        <label className="field"><span className="field-label">Mức</span><select className="text-field" value={level} onChange={(e) => setLevel(e.target.value as TimelineLevel)}><option value="year">Năm</option><option value="quarter">Quý</option><option value="month">Tháng</option></select></label>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className={`btn ${active === null ? 'btn-sheet' : ''}`} onClick={() => choose(null)}>Tất cả</button>
        {periods.map((key) => <button key={key} className={`btn ${active === key ? 'btn-sheet' : ''}`} onClick={() => choose(key)}>{key}</button>)}
      </div>
    </ParityDialog>
  );
}

export function QueriesModal({ queries, onRefresh, onDelete, onRename, onClose }: { queries: SheetQuery[]; onRefresh: (query: SheetQuery) => Promise<void>; onDelete: (query: SheetQuery) => void; onRename: (query: SheetQuery) => void; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = async (query: SheetQuery) => {
    setBusy(query.id);
    try {
      await onRefresh(query);
    } finally {
      setBusy(null);
    }
  };
  return (
    <ParityDialog title="Truy vấn & Kết nối (Queries & Connections)" subtitle="Nguồn dữ liệu đã nhập vào sổ tính, làm mới để tải lại." width={640} onClose={onClose}>
      {!queries.length && <div className="parity-note">Chưa có truy vấn nào. Dùng Lấy dữ liệu → Từ Web để tạo.</div>}
      {queries.map((query) => (
        <div key={query.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{query.name}</div>
            <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>{query.kind === 'web' ? query.source : query.kind === 'csv' ? 'Tệp CSV' : 'Ảnh'} → {query.sheetName} · {new Date(query.refreshedAt).toLocaleString('vi-VN')}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {query.kind === 'web' && <button className="btn" disabled={busy === query.id} onClick={() => void refresh(query)}><RefreshCw size={14} /><span>{busy === query.id ? 'Đang tải…' : 'Làm mới'}</span></button>}
            <button className="btn" onClick={() => onRename(query)}>Đổi tên</button>
            <button className="btn" onClick={() => onDelete(query)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </ParityDialog>
  );
}

export type NavigationEntry = { id: string; group: string; label: string; detail: string; go: () => void };

export function NavigationModal({ entries, onClose }: { entries: NavigationEntry[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const shown = entries.filter((entry) => `${entry.label} ${entry.detail}`.toLowerCase().includes(query.toLowerCase()));
  const groups = [...new Set(shown.map((entry) => entry.group))];
  return (
    <ParityDialog title="Điều hướng (Navigation)" subtitle="Trang tính, vùng đã đặt tên và đối tượng trong sổ tính." width={460} onClose={onClose}>
      <input className="text-field" placeholder="Tìm…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 8 }}>
        {groups.map((group) => (
          <div key={group}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '8px 0 2px' }}>{group}</div>
            {shown.filter((entry) => entry.group === group).map((entry) => (
              <button key={entry.id} className="sheet-popover-item" onClick={entry.go}><span>{entry.label}</span><span style={{ color: '#94a3b8', fontSize: 11 }}>{entry.detail}</span></button>
            ))}
          </div>
        ))}
      </div>
    </ParityDialog>
  );
}

export function CustomViewsModal({ views, onAdd, onShow, onDelete, onClose }: { views: SheetCustomView[]; onAdd: (name: string) => void; onShow: (view: SheetCustomView) => void; onDelete: (view: SheetCustomView) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <ParityDialog title="Chế độ xem tuỳ chỉnh (Custom Views)" subtitle="Lưu thu phóng, cố định, dòng/cột ẩn, đường lưới và vùng chọn để quay lại nhanh." width={480} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="text-field" placeholder="Tên chế độ xem" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-sheet" disabled={!name.trim()} onClick={() => { onAdd(name.trim()); setName(''); }}><Save size={14} /><span>Thêm</span></button>
      </div>
      <div style={{ marginTop: 8 }}>
        {views.map((view) => (
          <div key={view.id} style={{ display: 'flex', gap: 4, alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '4px 0' }}>
            <span style={{ flex: 1 }}>{view.name} <span style={{ color: '#94a3b8', fontSize: 11 }}>{view.zoom}% · {view.selection}</span></span>
            <button className="btn" onClick={() => onShow(view)}>Hiện</button>
            <button className="btn" onClick={() => onDelete(view)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </ParityDialog>
  );
}

export function AllowRangesModal({ ranges, activeRange, onSave, onClose }: { ranges: SheetAllowRange[]; activeRange: string; onSave: (next: SheetAllowRange[]) => void; onClose: () => void }) {
  const [list, setList] = useState(ranges);
  const [title, setTitle] = useState('Vùng 1');
  const [range, setRange] = useState(activeRange);
  const commit = (next: SheetAllowRange[]) => {
    setList(next);
    onSave(next);
  };
  return (
    <ParityDialog title="Cho phép sửa vùng (Allow Edit Ranges)" subtitle="Khi trang tính bị khoá, người dùng vẫn sửa được các vùng dưới đây." width={500} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
        <input className="text-field" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tên vùng" />
        <input className="text-field" value={range} onChange={(e) => setRange(e.target.value.toUpperCase())} aria-label="Vùng ô" />
        <button className="btn btn-sheet" disabled={!range.trim()} onClick={() => commit([...list, { id: crypto.randomUUID(), title: title.trim() || 'Vùng', range: range.trim() }])}><Plus size={14} /><span>Thêm</span></button>
      </div>
      <div style={{ marginTop: 8 }}>
        {list.map((item) => (
          <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '4px 0' }}>
            <span style={{ flex: 1 }}>{item.title}</span><code>{item.range}</code>
            <button className="btn" onClick={() => commit(list.filter((r) => r.id !== item.id))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </ParityDialog>
  );
}

export type OfficeScript = { id: string; name: string; code: string };

export const SCRIPT_TEMPLATE = `// workbook: sổ tính đang mở (Univer FWorkbook)
// sheet: trang tính đang mở, range: vùng đang chọn
// log(...): in kết quả bên dưới
const values = range.getValues();
log('Vùng chọn có', values.length, 'dòng');
`;

export function OfficeScriptsModal({ scripts, initialId, onSave, onDelete, onRun, onClose }: { scripts: OfficeScript[]; initialId: string | null; onSave: (script: OfficeScript) => void; onDelete: (id: string) => void; onRun: (code: string) => Promise<string[]>; onClose: () => void }) {
  const first = scripts.find((s) => s.id === initialId) ?? null;
  const [current, setCurrent] = useState<OfficeScript>(first ?? { id: crypto.randomUUID(), name: `Script ${scripts.length + 1}`, code: SCRIPT_TEMPLATE });
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      setOutput(await onRun(current.code));
    } finally {
      setRunning(false);
    }
  };
  return (
    <ParityDialog
      title="Office Scripts"
      subtitle="Viết JavaScript để tự động hoá trang tính. Script chỉ chạy khi bấm Chạy."
      width={860}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn" onClick={() => onSave(current)}><Save size={14} /><span>Lưu</span></button>
          <button className="btn btn-sheet" disabled={running} onClick={() => void run()}><Play size={14} /><span>{running ? 'Đang chạy…' : 'Chạy'}</span></button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10 }}>
        <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
          <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => setCurrent({ id: crypto.randomUUID(), name: `Script ${scripts.length + 1}`, code: SCRIPT_TEMPLATE })}><Plus size={14} /><span>Script mới</span></button>
          {scripts.map((script) => (
            <div key={script.id} style={{ display: 'flex', alignItems: 'center' }}>
              <button className="sheet-popover-item" style={{ background: script.id === current.id ? '#e8f5ee' : undefined }} onClick={() => setCurrent(script)}><span>{script.name}</span></button>
              <button className="icon-btn" aria-label="Xoá script" onClick={() => onDelete(script.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div>
          <input className="text-field" value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} aria-label="Tên script" />
          <textarea className="text-field" spellCheck={false} style={{ marginTop: 6, minHeight: 280, fontFamily: 'Consolas, monospace', fontSize: 12.5 }} value={current.code} onChange={(e) => setCurrent({ ...current, code: e.target.value })} aria-label="Mã script" />
          <pre style={{ marginTop: 6, maxHeight: 120, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 6, fontSize: 12 }}>{output.join('\n') || 'Kết quả chạy hiện ở đây.'}</pre>
        </div>
      </div>
    </ParityDialog>
  );
}

export type InkTool = { kind: 'pen'; color: string; width: number; alpha: number } | { kind: 'eraser' };
export type InkStroke = { color: string; width: number; alpha: number; points: number[] };

export function InkLayer({ tool, strokes, onChange }: { tool: InkTool; strokes: InkStroke[]; onChange: (next: InkStroke[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<InkStroke | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrokes(ctx, strokes);
  }, [strokes, size]);
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as const;
  };
  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = point(event);
    if (tool.kind === 'eraser') {
      onChange(strokes.filter((stroke) => !strokeNear(stroke, x, y, 8)));
      return;
    }
    drawing.current = { color: tool.color, width: tool.width, alpha: tool.alpha, points: [x, y] };
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const [x, y] = point(event);
    if (tool.kind === 'eraser') {
      if (event.buttons === 1) onChange(strokes.filter((stroke) => !strokeNear(stroke, x, y, 8)));
      return;
    }
    const stroke = drawing.current;
    if (!stroke) return;
    stroke.points.push(x, y);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawStrokes(ctx, [...strokes, stroke]);
  };
  const up = () => {
    const stroke = drawing.current;
    drawing.current = null;
    if (stroke && stroke.points.length >= 4) onChange([...strokes, stroke]);
  };
  return <canvas ref={canvasRef} className={`sheet-ink-layer ${tool.kind === 'eraser' ? 'is-eraser' : ''}`} style={{ width: size.w, height: size.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}

const strokeNear = (stroke: InkStroke, x: number, y: number, radius: number) => {
  for (let i = 0; i < stroke.points.length; i += 2) if (Math.hypot(stroke.points[i] - x, stroke.points[i + 1] - y) <= radius + stroke.width / 2) return true;
  return false;
};

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: InkStroke[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const stroke of strokes) {
    ctx.globalAlpha = stroke.alpha;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0], stroke.points[1]);
    for (let i = 2; i < stroke.points.length; i += 2) ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function strokesToImage(strokes: InkStroke[]): (ImagePayload & { left: number; top: number }) | null {
  if (!strokes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.points.length; i += 2) {
      minX = Math.min(minX, stroke.points[i] - stroke.width);
      maxX = Math.max(maxX, stroke.points[i] + stroke.width);
      minY = Math.min(minY, stroke.points[i + 1] - stroke.width);
      maxY = Math.max(maxY, stroke.points[i + 1] + stroke.width);
    }
  }
  const width = Math.max(4, Math.ceil(maxX - minX));
  const height = Math.max(4, Math.ceil(maxY - minY));
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.translate(-minX, -minY);
  drawStrokes(ctx, strokes);
  return { url: canvas.toDataURL('image/png'), width, height, left: minX, top: minY };
}
