import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Network, Type, Upload } from 'lucide-react';
import { pickFile } from '../../../../lib/download';
import { useDoc } from '../../DocContext';
import { insertMetaImage } from '../../insertActions';
import { ICON_CATEGORIES, ICONS, searchIcons, type IconEntry } from '../../insertIcons';
import { normalizeMesh, parseObj, parseStl, primitiveMesh, PRIMITIVE_GROUPS, PRIMITIVES, renderMesh, type Mesh, type Primitive } from '../../insertModel3d';
import { parseItems, SMARTART_LAYOUTS, SMARTART_PALETTES, smartArtDataUrl, type SmartArtLayout } from '../../insertSmartArt';
import { WORDART_FONTS, WORDART_PRESETS, WORDART_TRANSFORMS, wordArtDataUrl, type WordArtTransform } from '../../insertWordArt';
import Modal from '../Modal';

export function SmartArtDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const meta = ctx.editing?.attrs.meta as { layout?: SmartArtLayout; text?: string; palette?: string } | undefined;
  const [layout, setLayout] = useState<SmartArtLayout>(meta?.layout ?? 'process');
  const [text, setText] = useState(meta?.text ?? SMARTART_LAYOUTS.find((item) => item.id === 'process')!.sample);
  const [palette, setPalette] = useState(meta?.palette ?? 'blue');
  const preview = useMemo(() => smartArtDataUrl({ layout, text, palette }), [layout, text, palette]);
  const thumbs = useMemo(() => SMARTART_LAYOUTS.map((item) => ({ ...item, src: smartArtDataUrl({ layout: item.id, text: item.sample, palette }) })), [palette]);
  const close = () => { ctx.setEditing(null); onClose(); };
  const pickLayout = (id: SmartArtLayout) => {
    const current = SMARTART_LAYOUTS.find((item) => item.id === layout);
    setLayout(id);
    if (!text.trim() || text === current?.sample) setText(SMARTART_LAYOUTS.find((item) => item.id === id)!.sample);
  };
  const apply = () => {
    insertMetaImage(ctx, { src: preview, alt: `Sơ đồ: ${parseItems(text).map((item) => item.text).join(', ')}`, meta: { kind: 'smartart', layout, text, palette }, width: '100%' });
    close();
  };
  return (
    <Modal title={ctx.editing ? 'Sửa sơ đồ SmartArt' : 'Chèn sơ đồ SmartArt'} subtitle="Mỗi dòng là một mục, thụt vào hai dấu cách để tạo mục con. Nhấp đúp sơ đồ để sửa lại." icon={<Network size={20} />} onClose={close} width={900} actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!parseItems(text).length} onClick={apply}>{ctx.editing ? 'Lưu' : 'Chèn'}</button></>}>
      <div className="insert-graphic-editor">
        <div className="insert-graphic-form">
          <div className="insert-thumb-scroll">
            <div className="insert-thumb-grid">
              {thumbs.map((item) => <button key={item.id} type="button" className={`insert-thumb ${layout === item.id ? 'on' : ''}`} title={item.label} onClick={() => pickLayout(item.id)}><img src={item.src} alt="" /><span>{item.label}</span></button>)}
            </div>
          </div>
          <label className="field"><span className="field-label">Màu</span><select className="text-field" value={palette} onChange={(e) => setPalette(e.target.value)}>{SMARTART_PALETTES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Nội dung</span><textarea className="text-field insert-outline-input" rows={10} value={text} onChange={(e) => setText(e.target.value)} /></label>
        </div>
        <div className="insert-graphic-preview"><img src={preview} alt="Xem trước sơ đồ" /></div>
      </div>
    </Modal>
  );
}

export function WordArtDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const meta = ctx.editing?.attrs.meta as { text?: string; preset?: string; font?: string; size?: number; transform?: WordArtTransform } | undefined;
  const [text, setText] = useState(meta?.text ?? (ctx.editor.state.selection.empty ? 'Chữ nghệ thuật' : ctx.editor.state.doc.textBetween(ctx.editor.state.selection.from, ctx.editor.state.selection.to, ' ').trim().slice(0, 120)));
  const [preset, setPreset] = useState(meta?.preset ?? 'blue-grad');
  const [font, setFont] = useState(meta?.font ?? 'Arial');
  const [size, setSize] = useState(meta?.size ?? 48);
  const [transform, setTransform] = useState<WordArtTransform>(meta?.transform ?? 'none');
  const preview = useMemo(() => wordArtDataUrl({ text, preset, font, size, transform }), [text, preset, font, size, transform]);
  const thumbs = useMemo(() => WORDART_PRESETS.map((item) => ({ ...item, src: wordArtDataUrl({ text: 'Aa', preset: item.id, font: 'Arial', size: 32, transform: 'none' }) })), []);
  const close = () => { ctx.setEditing(null); onClose(); };
  const apply = () => {
    insertMetaImage(ctx, { src: preview, alt: text, meta: { kind: 'wordart', text, preset, font, size, transform } });
    close();
  };
  return (
    <Modal title={ctx.editing ? 'Sửa chữ nghệ thuật' : 'Chèn chữ nghệ thuật'} subtitle="Nhấp đúp chữ nghệ thuật trong tài liệu để sửa lại." icon={<Type size={20} />} onClose={close} width={760} actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!text.trim()} onClick={apply}>{ctx.editing ? 'Lưu' : 'Chèn'}</button></>}>
      <div className="insert-wordart-grid">
        {thumbs.map((item) => <button key={item.id} type="button" className={`insert-wordart-cell ${preset === item.id ? 'on' : ''}`} title={item.label} aria-label={item.label} onClick={() => setPreset(item.id)}><img src={item.src} alt="" /></button>)}
      </div>
      <label className="field"><span className="field-label">Nội dung</span><input className="text-field" value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Phông</span><select className="text-field" value={font} onChange={(e) => setFont(e.target.value)}>{WORDART_FONTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span className="field-label">Cỡ (px)</span><input className="text-field" type="number" min={16} max={160} value={size} onChange={(e) => setSize(Math.max(16, Math.min(160, Number(e.target.value) || 48)))} /></label>
        <label className="field"><span className="field-label">Biến dạng</span><select className="text-field" value={transform} onChange={(e) => setTransform(e.target.value as WordArtTransform)}>{WORDART_TRANSFORMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <div className="insert-graphic-preview wordart"><img src={preview} alt="Xem trước chữ nghệ thuật" /></div>
    </Modal>
  );
}

const ICON_COLORS = ['#1f2430', '#2b579a', '#107c41', '#d7473c', '#d98e04', '#7c3aed', '#0891b2', '#64748b'];

export function IconsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<IconEntry>(ICONS[0]);
  const [color, setColor] = useState(ICON_COLORS[1]);
  const [size, setSize] = useState(64);
  const [stroke, setStroke] = useState(2);
  const [filled, setFilled] = useState(false);
  const preview = useRef<HTMLDivElement | null>(null);
  const list = useMemo(() => searchIcons(query, category), [query, category]);
  const Selected = selected.Icon;
  const insert = () => {
    const svg = preview.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    insertMetaImage(ctx, { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clone.outerHTML)}`, alt: selected.name, width: `${size}px` });
    onClose();
  };
  return (
    <Modal title="Chèn biểu tượng" subtitle={`${ICONS.length} biểu tượng. Tìm bằng tiếng Việt có dấu hoặc không dấu.`} icon={<Box size={20} />} onClose={onClose} width={820} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={insert}>Chèn</button></>}>
      <input className="text-field" placeholder="Tìm biểu tượng, ví dụ: điện thoại" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="insert-icon-cats">
        <button type="button" className={`insert-chip ${category === null ? 'on' : ''}`} onClick={() => setCategory(null)}>Tất cả</button>
        {ICON_CATEGORIES.map((item) => <button key={item} type="button" className={`insert-chip ${category === item ? 'on' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="insert-icon-layout">
        <div className="insert-icon-grid">
          {list.length === 0 && <div className="panel-empty">Không có biểu tượng nào khớp.</div>}
          {list.map((item) => <button key={`${item.category}-${item.name}`} type="button" className={`insert-icon-cell ${selected === item ? 'on' : ''}`} title={item.name} aria-label={item.name} onClick={() => setSelected(item)}><item.Icon size={22} /></button>)}
        </div>
        <div className="insert-icon-side">
          <div className="insert-icon-preview" ref={preview}><Selected size={size} color={color} strokeWidth={stroke} fill={filled ? color : 'none'} fillOpacity={filled ? 0.22 : undefined} /></div>
          <div className="muted">{selected.name}</div>
          <div className="pen-toolbar">{ICON_COLORS.map((item) => <button key={item} type="button" className={`color-swatch ${color === item ? 'selected' : ''}`} style={{ background: item }} aria-label={item} onClick={() => setColor(item)} />)}</div>
          <label className="field"><span className="field-label">Màu khác</span><input className="text-field color-field" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <label className="insert-check"><input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /> Tô nền nhạt</label>
          <label className="field"><span className="field-label">Kích thước: {size} px</span><input type="range" min={16} max={200} step={4} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
          <label className="field"><span className="field-label">Độ dày nét: {stroke}</span><input type="range" min={1} max={4} step={0.5} value={stroke} onChange={(e) => setStroke(Number(e.target.value))} /></label>
        </div>
      </div>
    </Modal>
  );
}

const MODEL_COLORS = ['#5b8def', '#2b579a', '#107c41', '#d7473c', '#d98e04', '#7c3aed', '#0891b2', '#94a3b8'];

const modelThumbs = (color: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 90;
  return Object.fromEntries(PRIMITIVES.map((item) => {
    renderMesh(canvas, primitiveMesh(item.id), { rx: 20, ry: 35, rz: 0, color, zoom: 1 });
    return [item.id, canvas.toDataURL('image/png')];
  })) as Record<Primitive, string>;
};

const CANVAS_W = 720;
const CANVAS_H = 480;

export function Model3dDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const meta = ctx.editing?.attrs.meta as { primitive?: Primitive; rx?: number; ry?: number; rz?: number; color?: string; zoom?: number } | undefined;
  const [primitive, setPrimitive] = useState<Primitive>(meta?.primitive ?? 'cube');
  const [custom, setCustom] = useState<{ name: string; mesh: Mesh } | null>(null);
  const [rx, setRx] = useState(meta?.rx ?? 20);
  const [ry, setRy] = useState(meta?.ry ?? 35);
  const [rz, setRz] = useState(meta?.rz ?? 0);
  const [zoom, setZoom] = useState(meta?.zoom ?? 1);
  const [color, setColor] = useState(meta?.color ?? '#5b8def');
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const mesh = useMemo(() => custom?.mesh ?? primitiveMesh(primitive), [custom, primitive]);
  const thumbs = useMemo(() => modelThumbs(color), [color]);
  useEffect(() => {
    if (canvas.current) renderMesh(canvas.current, mesh, { rx, ry, rz, color, zoom });
  }, [mesh, rx, ry, rz, color, zoom]);
  const close = () => { ctx.setEditing(null); onClose(); };
  const openFile = async () => {
    const file = await pickFile('.obj,.stl');
    if (!file) return;
    try {
      const parsed = file.name.toLowerCase().endsWith('.stl') ? parseStl(await file.arrayBuffer()) : parseObj(await file.text());
      if (!parsed.faces.length) throw new Error('empty');
      setCustom({ name: file.name, mesh: normalizeMesh(parsed) });
    } catch {
      ctx.ui.toast('Không đọc được mô hình 3D trong tệp này', true);
    }
  };
  const apply = () => {
    if (!canvas.current) return;
    const label = custom?.name ?? PRIMITIVES.find((item) => item.id === primitive)?.label ?? 'Mô hình 3D';
    insertMetaImage(ctx, { src: canvas.current.toDataURL('image/png'), alt: `Mô hình 3D: ${label}`, meta: custom ? undefined : { kind: 'model3d', primitive, rx, ry, rz, color, zoom }, width: '50%' });
    close();
  };
  return (
    <Modal title="Mô hình 3D" subtitle="Kéo trên khung vẽ để xoay. Chèn thành ảnh ở góc nhìn đang chọn." icon={<Box size={20} />} onClose={close} width={920} actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" onClick={apply}>{ctx.editing ? 'Lưu' : 'Chèn'}</button></>}>
      <div className="insert-graphic-editor">
        <div className="insert-graphic-form">
          <div className="insert-thumb-scroll">
            {PRIMITIVE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="ribbon-menu-heading">{group.label}</div>
                <div className="insert-thumb-grid">
                  {group.items.map((item) => <button key={item.id} type="button" className={`insert-thumb ${!custom && primitive === item.id ? 'on' : ''}`} title={item.label} onClick={() => { setCustom(null); setPrimitive(item.id); }}><img src={thumbs[item.id]} alt="" /><span>{item.label}</span></button>)}
                </div>
              </div>
            ))}
          </div>
          <div className="pen-toolbar">{MODEL_COLORS.map((item) => <button key={item} type="button" className={`color-swatch ${color === item ? 'selected' : ''}`} style={{ background: item }} aria-label={item} onClick={() => setColor(item)} />)}</div>
          <button type="button" className="btn" onClick={() => void openFile()}><Upload size={14} /> Mở tệp .obj hoặc .stl</button>
          {custom && <div className="muted">Đang xem: {custom.name} ({custom.mesh.faces.length.toLocaleString('vi-VN')} mặt)</div>}
          <label className="field"><span className="field-label">Màu</span><input className="text-field color-field" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <label className="field"><span className="field-label">Xoay trục X: {rx}°</span><input type="range" min={-180} max={180} value={rx} onChange={(e) => setRx(Number(e.target.value))} /></label>
          <label className="field"><span className="field-label">Xoay trục Y: {ry}°</span><input type="range" min={-180} max={180} value={ry} onChange={(e) => setRy(Number(e.target.value))} /></label>
          <label className="field"><span className="field-label">Xoay trục Z: {rz}°</span><input type="range" min={-180} max={180} value={rz} onChange={(e) => setRz(Number(e.target.value))} /></label>
          <label className="field"><span className="field-label">Thu phóng</span><input type="range" min={0.4} max={1.6} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        </div>
        <canvas ref={canvas} width={CANVAS_W} height={CANVAS_H} className="insert-model-canvas" aria-label="Khung xem mô hình 3D"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, rx, ry }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setRy(Math.round(d.ry + (e.clientX - d.x) / 2)); setRx(Math.round(d.rx + (e.clientY - d.y) / 2)); }}
          onPointerUp={() => { drag.current = null; }} />
      </div>
    </Modal>
  );
}
