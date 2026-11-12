import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Columns2, Eye, EyeOff, FileType, Frame, Hash, Layers, LayoutTemplate, Paintbrush, Stamp, Upload, WrapText, X } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { DialogId } from '../DocContext';
import { newId, useDoc } from '../DocContext';
import { pickFile, readAsDataUrl } from '../../../lib/download';
import { PAGE_SIZES, type PageSettings } from '../../../lib/storage';
import { fontPatch, palettePatch, PALETTES, saveCustomFontPair, saveCustomPalette, type Palette } from '../designThemes';
import { ensureFont, FONT_CATALOG, GROUP_LABELS } from '../fonts';
import { listObjects, patchObject, selectedImage, WRAP_LABELS, wrapOf, zOrder, type WrapKind } from '../layoutObjects';
import Modal from './Modal';
import './layout.css';
import ComboBox from '../../../components/ComboBox';

const WATERMARK_TEXTS = ['BẢN NHÁP', 'MẬT', 'TUYỆT MẬT', 'LƯU HÀNH NỘI BỘ', 'KHẨN', 'MẪU', 'CONFIDENTIAL', 'DRAFT'];
const WATERMARK_SIZES = [24, 32, 40, 48, 64, 80, 96, 120, 160, 200];

const CM = 37.8;
const toCm = (px: number) => Math.round((px / CM) * 100) / 100;
const fromCm = (cm: string | number, fallback: number) => {
  const value = parseFloat(String(cm).replace(',', '.'));
  return Number.isFinite(value) && value >= 0 && value < 30 ? Math.round(value * CM) : fallback;
};

type PageTab = 'margins' | 'paper' | 'layout';
const PAGE_TABS: { id: PageTab; label: string }[] = [{ id: 'margins', label: 'Lề' }, { id: 'paper', label: 'Khổ giấy' }, { id: 'layout', label: 'Bố cục' }];
const V_ALIGNS: { value: NonNullable<PageSettings['verticalAlign']>; label: string }[] = [{ value: 'top', label: 'Trên' }, { value: 'center', label: 'Giữa' }, { value: 'justify', label: 'Đều hai đầu' }, { value: 'bottom', label: 'Dưới' }];

function PageSetupDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const gutterNow = page.gutter ?? 0;
  const [tab, setTab] = useState<PageTab>('margins');
  const [top, setTop] = useState(String(toCm(page.margins.top)));
  const [bottom, setBottom] = useState(String(toCm(page.margins.bottom)));
  const [left, setLeft] = useState(String(toCm(page.margins.left - gutterNow)));
  const [right, setRight] = useState(String(toCm(page.margins.right)));
  const [gutter, setGutter] = useState(String(toCm(gutterNow)));
  const [mirror, setMirror] = useState(Boolean(page.mirrorMargins));
  const [orientation, setOrientation] = useState(page.orientation);
  const [size, setSize] = useState(page.size);
  const [first, setFirst] = useState(Boolean(page.differentFirstPage));
  const [oddEven, setOddEven] = useState(Boolean(page.differentOddEven));
  const [vAlign, setVAlign] = useState<NonNullable<PageSettings['verticalAlign']>>(page.verticalAlign ?? 'top');
  const [startAt, setStartAt] = useState(page.pageNumberStart ?? 1);
  const paper = PAGE_SIZES[size];
  const previewW = orientation === 'portrait' ? paper.width : paper.height;
  const previewH = orientation === 'portrait' ? paper.height : paper.width;
  const scale = 150 / Math.max(previewW, previewH);
  const apply = () => {
    const gutterPx = fromCm(gutter, 0);
    setPage({
      margins: { top: fromCm(top, page.margins.top), bottom: fromCm(bottom, page.margins.bottom), left: fromCm(left, page.margins.left) + gutterPx, right: fromCm(right, page.margins.right) },
      gutter: gutterPx, mirrorMargins: mirror, orientation, size, differentFirstPage: first, differentOddEven: oddEven, verticalAlign: vAlign, pageNumberStart: startAt,
    });
    onClose();
  };
  const numberField = (label: string, value: string, set: (v: string) => void) => <label className="field"><span className="field-label">{label}</span><input className="text-field" type="number" step={0.1} min={0} value={value} onChange={(e) => set(e.target.value)} /></label>;
  return (
    <Modal title="Thiết lập trang" icon={<LayoutTemplate size={20} />} onClose={onClose} width={640} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="layout-dialog-tabs" role="tablist">{PAGE_TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      <div className="page-setup-body">
        <div className="page-setup-form">
          {tab === 'margins' && (
            <>
              <div className="form-grid">
                {numberField('Lề trên (cm)', top, setTop)}
                {numberField('Lề dưới (cm)', bottom, setBottom)}
                {numberField(mirror ? 'Lề trong (cm)' : 'Lề trái (cm)', left, setLeft)}
                {numberField(mirror ? 'Lề ngoài (cm)' : 'Lề phải (cm)', right, setRight)}
                {numberField('Lề đóng gáy (cm)', gutter, setGutter)}
                <label className="field"><span className="field-label">Hướng giấy</span><select className="text-field" value={orientation} onChange={(e) => setOrientation(e.target.value as PageSettings['orientation'])}><option value="portrait">Dọc</option><option value="landscape">Ngang</option></select></label>
              </div>
              <div className="check-row"><label><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Lề đối xứng trang chẵn lẻ</label></div>
            </>
          )}
          {tab === 'paper' && (
            <label className="field"><span className="field-label">Khổ giấy</span><select className="text-field" size={9} value={size} onChange={(e) => setSize(e.target.value as PageSettings['size'])}>{(Object.keys(PAGE_SIZES) as PageSettings['size'][]).map((key) => <option key={key} value={key}>{PAGE_SIZES[key].label}</option>)}</select></label>
          )}
          {tab === 'layout' && (
            <>
              <div className="form-section-title">Đầu trang và chân trang</div>
              <div className="check-row">
                <label><input type="checkbox" checked={first} onChange={(e) => setFirst(e.target.checked)} /> Trang đầu khác</label>
                <label><input type="checkbox" checked={oddEven} onChange={(e) => setOddEven(e.target.checked)} /> Trang chẵn lẻ khác nhau</label>
              </div>
              <div className="form-grid">
                <label className="field"><span className="field-label">Căn dọc nội dung trên trang</span><select className="text-field" value={vAlign} onChange={(e) => setVAlign(e.target.value as typeof vAlign)}>{V_ALIGNS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="field"><span className="field-label">Số trang bắt đầu từ</span><input className="text-field" type="number" min={1} value={startAt} onChange={(e) => setStartAt(Number(e.target.value) || 1)} /></label>
              </div>
              <div className="panel-row">
                <button type="button" className="btn" onClick={() => ctx.openDialog('linenumbers')}><Hash size={14} /> Số dòng…</button>
                <button type="button" className="btn" onClick={() => ctx.openDialog('pageborders')}><Frame size={14} /> Viền trang…</button>
                <button type="button" className="btn" onClick={() => ctx.openDialog('headerfooter')}>Đầu, chân trang…</button>
              </div>
            </>
          )}
        </div>
        <div className="page-preview" aria-hidden>
          <div className="page-preview-sheet" style={{ width: previewW * scale, height: previewH * scale }}>
            <div style={{ position: 'absolute', top: fromCm(top, 0) * scale, bottom: fromCm(bottom, 0) * scale, left: (fromCm(left, 0) + fromCm(gutter, 0)) * scale, right: fromCm(right, 0) * scale }} className="page-preview-text" />
          </div>
          <small>{paper.label}</small>
        </div>
      </div>
    </Modal>
  );
}

function ColumnsDialog({ onClose }: { onClose: () => void }) {
  const { page, setPage } = useDoc();
  const [count, setCount] = useState(page.columns ?? 1);
  const [gap, setGap] = useState(String(toCm(page.columnGap ?? 32)));
  const [line, setLine] = useState(page.columnLine ?? true);
  const apply = () => {
    setPage({ columns: Math.max(1, Math.min(6, count)), columnGap: fromCm(gap, 32), columnLine: line });
    onClose();
  };
  return (
    <Modal title="Cột" subtitle="Áp dụng cho cả tài liệu. Tài liệu chia cột in bằng hộp thoại in của trình duyệt." icon={<Columns2 size={20} />} onClose={onClose} width={460} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Số cột</span><input className="text-field" type="number" min={1} max={6} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} /></label>
        <label className="field"><span className="field-label">Khoảng cách giữa cột (cm)</span><input className="text-field" type="number" step={0.1} min={0} value={gap} onChange={(e) => setGap(e.target.value)} /></label>
      </div>
      <div className="check-row"><label><input type="checkbox" checked={line} onChange={(e) => setLine(e.target.checked)} /> Đường kẻ giữa các cột</label></div>
      <div className="columns-preview" style={{ columnCount: count, columnGap: `${fromCm(gap, 32) / 4}px`, columnRule: line ? '1px solid #94a3b8' : 'none' }} aria-hidden>{'Nội dung xem trước của các cột trong tài liệu. '.repeat(14)}</div>
    </Modal>
  );
}

function WatermarkDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const options = page.watermarkOptions ?? {};
  const [kind, setKind] = useState<'none' | 'text' | 'image'>(options.kind === 'image' ? 'image' : page.watermark ? 'text' : 'none');
  const [text, setText] = useState(page.watermark || 'BẢN NHÁP');
  const [font, setFont] = useState(options.font ?? 'Arial');
  const [color, setColor] = useState(options.color ?? '#475569');
  const [size, setSize] = useState(options.size ?? 64);
  const [layout, setLayout] = useState<'diagonal' | 'horizontal'>(options.layout ?? 'diagonal');
  const [opacity, setOpacity] = useState(options.opacity ?? 0.2);
  const [image, setImage] = useState(options.image ?? '');
  const pick = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      setImage(await readAsDataUrl(file));
    } catch {
      ctx.ui.toast('Không đọc được ảnh này', true);
    }
  };
  const apply = () => {
    if (kind === 'none') setPage({ watermark: '', watermarkOptions: undefined });
    else if (kind === 'text') setPage({ watermark: text.trim(), watermarkOptions: { kind, color, size, layout, opacity, font } });
    else setPage({ watermark: '', watermarkOptions: { kind, image, layout, opacity } });
    if (font) ensureFont(font);
    onClose();
  };
  const rotate = layout === 'diagonal' ? 'rotate(-35deg)' : 'none';
  return (
    <Modal title="Hình mờ tuỳ chỉnh" icon={<Stamp size={20} />} onClose={onClose} width={620} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={kind === 'image' && !image} onClick={apply}>Áp dụng</button></>}>
      <div className="check-row">
        {([['none', 'Không có hình mờ'], ['text', 'Hình mờ chữ'], ['image', 'Hình mờ ảnh']] as const).map(([value, label]) => <label key={value}><input type="radio" name="watermark-kind" checked={kind === value} onChange={() => setKind(value)} /> {label}</label>)}
      </div>
      {kind !== 'none' && (
        <div className="page-setup-body">
          <div className="page-setup-form">
            {kind === 'text' ? (
              <>
                <div className="field"><span className="field-label">Nội dung</span><ComboBox label="Nội dung hình mờ" value={text} options={WATERMARK_TEXTS} onCommit={setText} onInput={setText} /></div>
                <div className="form-grid">
                  <label className="field"><span className="field-label">Phông</span><FontSelect value={font} onChange={setFont} /></label>
                  <div className="field"><span className="field-label">Cỡ chữ (px)</span><ComboBox label="Cỡ chữ hình mờ (px)" value={size} options={WATERMARK_SIZES} numeric={{ min: 16, max: 200, step: 1 }} onCommit={(value) => setSize(Number(value))} /></div>
                  <label className="field"><span className="field-label">Màu</span><input className="text-field color-field" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
                </div>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => void pick()}><Upload size={14} /> {image ? 'Chọn ảnh khác' : 'Chọn ảnh…'}</button>
            )}
            <div className="form-grid">
              <label className="field"><span className="field-label">Độ đậm ({Math.round(opacity * 100)}%)</span><input type="range" min={0.05} max={0.8} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
              <label className="field"><span className="field-label">Bố cục</span><select className="text-field" value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)}><option value="diagonal">Chéo</option><option value="horizontal">Ngang</option></select></label>
            </div>
          </div>
          <div className="page-preview" aria-hidden>
            <div className="page-preview-sheet" style={{ width: 120, height: 170 }}>
              {kind === 'image' && image ? <img src={image} alt="" style={{ position: 'absolute', left: '50%', top: '50%', maxWidth: '80%', transform: `translate(-50%, -50%) ${rotate}`, opacity }} /> : kind === 'text' ? <span style={{ position: 'absolute', left: '50%', top: '50%', whiteSpace: 'nowrap', fontWeight: 800, fontFamily: `"${font}", Arial, sans-serif`, fontSize: size / 5, color, opacity, transform: `translate(-50%, -50%) ${rotate}` }}>{text}</span> : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

const BORDER_STYLES: { value: NonNullable<PageSettings['pageBorder']>; label: string }[] = [
  { value: 'none', label: 'Không viền' }, { value: 'single', label: 'Viền đơn' }, { value: 'double', label: 'Viền đôi' }, { value: 'thick', label: 'Viền dày' },
  { value: 'dashed', label: 'Nét đứt' }, { value: 'dotted', label: 'Chấm' }, { value: 'shadow', label: 'Đổ bóng' },
];

function PageBordersDialog({ onClose }: { onClose: () => void }) {
  const { page, setPage } = useDoc();
  const [style, setStyle] = useState<NonNullable<PageSettings['pageBorder']>>(page.pageBorder ?? 'single');
  const [color, setColor] = useState(page.pageBorderColor ?? '#334155');
  const [width, setWidth] = useState(page.pageBorderWidth ?? 2);
  const cssStyle = style === 'double' ? 'double' : style === 'dashed' ? 'dashed' : style === 'dotted' ? 'dotted' : 'solid';
  const previewWidth = style === 'double' ? Math.max(3, width * 2) : style === 'thick' ? width * 3 : width;
  const apply = () => {
    setPage({ pageBorder: style, pageBorderColor: color, pageBorderWidth: width });
    onClose();
  };
  return (
    <Modal title="Viền trang" subtitle="Viền áp dụng cho mọi trang của tài liệu." icon={<Frame size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="page-setup-body">
        <div className="page-setup-form">
          <div className="form-grid">
            <label className="field"><span className="field-label">Kiểu</span><select className="text-field" value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>{BORDER_STYLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field"><span className="field-label">Màu</span><input className="text-field color-field" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
            <label className="field"><span className="field-label">Độ dày (px)</span><input className="text-field" type="number" min={1} max={8} value={width} onChange={(e) => setWidth(Number(e.target.value) || 1)} /></label>
          </div>
        </div>
        <div className="page-preview" aria-hidden>
          <div className="page-preview-sheet" style={{ width: 120, height: 170 }}>
            {style !== 'none' && <div style={{ position: 'absolute', inset: 10, border: `${previewWidth}px ${cssStyle} ${color}`, boxShadow: style === 'shadow' ? '4px 4px 0 #94a3b8' : undefined }} />}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const COLOR_FIELDS: { key: keyof Omit<Palette, 'id' | 'label'>; label: string }[] = [
  { key: 'title', label: 'Tiêu đề' }, { key: 'subtitle', label: 'Phụ đề' }, { key: 'h1', label: 'Đề mục 1' }, { key: 'h2', label: 'Đề mục 2' }, { key: 'h3', label: 'Đề mục 3' }, { key: 'h4', label: 'Đề mục 4' }, { key: 'quote', label: 'Trích dẫn' },
];

function ThemeColorsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const [draft, setDraft] = useState<Palette>(() => ({ ...(PALETTES.find((p) => p.id === page.colorsId) ?? PALETTES[0]), id: newId('pal'), label: 'Bảng màu của tôi' }));
  const apply = () => {
    if (!saveCustomPalette(draft)) ctx.ui.toast('Không lưu được bảng màu trên máy này, chỉ áp dụng cho tài liệu', true);
    setPage(palettePatch(page, draft));
    onClose();
  };
  return (
    <Modal title="Tuỳ chỉnh màu" icon={<Paintbrush size={20} />} onClose={onClose} width={520} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Lưu và áp dụng</button></>}>
      <label className="field"><span className="field-label">Tên bảng màu</span><input className="text-field" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
      <div className="form-grid">
        {COLOR_FIELDS.map((item) => <label key={item.key} className="field"><span className="field-label">{item.label}</span><input className="text-field color-field" type="color" value={draft[item.key]} onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })} /></label>)}
      </div>
      <div className="color-preview" aria-hidden>
        <div style={{ color: draft.title, fontSize: 20 }}>Tiêu đề tài liệu</div>
        <div style={{ color: draft.subtitle }}>Phụ đề</div>
        <div style={{ color: draft.h1, fontWeight: 700, fontSize: 16 }}>Đề mục 1</div>
        <div style={{ color: draft.h2, fontWeight: 700, fontSize: 14 }}>Đề mục 2</div>
        <div style={{ color: draft.h3, fontWeight: 700 }}>Đề mục 3</div>
        <div style={{ color: draft.quote, fontStyle: 'italic' }}>Trích dẫn</div>
      </div>
    </Modal>
  );
}

function FontSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of FONT_CATALOG) {
      const label = GROUP_LABELS[entry.group];
      map.set(label, [...(map.get(label) ?? []), entry.name]);
    }
    return [...map.entries()];
  }, []);
  return (
    <select className="text-field" value={value} onChange={(e) => { ensureFont(e.target.value); onChange(e.target.value); }}>
      {!FONT_CATALOG.some((entry) => entry.name === value) && <option value={value}>{value}</option>}
      {groups.map(([label, names]) => <optgroup key={label} label={label}>{names.map((name) => <option key={name} value={name}>{name}</option>)}</optgroup>)}
    </select>
  );
}

function ThemeFontsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const [label, setLabel] = useState('Cặp phông của tôi');
  const [heading, setHeading] = useState(page.styles?.h1?.font ?? page.fontFamily ?? 'Arial');
  const [body, setBody] = useState(page.fontFamily ?? 'Arial');
  const apply = () => {
    const pair = { id: newId('fonts'), label, heading, body };
    if (!saveCustomFontPair(pair)) ctx.ui.toast('Không lưu được cặp phông trên máy này, chỉ áp dụng cho tài liệu', true);
    setPage(fontPatch(page, pair));
    onClose();
  };
  return (
    <Modal title="Tuỳ chỉnh phông" icon={<FileType size={20} />} onClose={onClose} width={520} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Lưu và áp dụng</button></>}>
      <label className="field"><span className="field-label">Tên cặp phông</span><input className="text-field" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Phông tiêu đề</span><FontSelect value={heading} onChange={setHeading} /></label>
        <label className="field"><span className="field-label">Phông nội dung</span><FontSelect value={body} onChange={setBody} /></label>
      </div>
      <div className="color-preview" aria-hidden>
        <div style={{ fontFamily: `"${heading}", Arial, sans-serif`, fontSize: 20, fontWeight: 700 }}>Tiêu đề mẫu</div>
        <div style={{ fontFamily: `"${body}", Arial, sans-serif` }}>Đoạn nội dung mẫu dùng phông nội dung của tài liệu.</div>
      </div>
    </Modal>
  );
}

function LineNumbersDialog({ onClose }: { onClose: () => void }) {
  const { page, setPage } = useDoc();
  const [enabled, setEnabled] = useState(Boolean(page.lineNumbers));
  const [mode, setMode] = useState<NonNullable<PageSettings['lineNumberMode']>>(page.lineNumberMode ?? 'continuous');
  const [step, setStep] = useState(page.lineNumberStep ?? 1);
  const apply = () => {
    setPage({ lineNumbers: enabled, lineNumberMode: mode, lineNumberStep: Math.max(1, step) });
    onClose();
  };
  return (
    <Modal title="Số dòng" subtitle="Số dòng hiện bên lề trái khi xem theo bố cục in." icon={<Hash size={20} />} onClose={onClose} width={440} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="check-row"><label><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Hiện số dòng</label></div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Đánh số</span><select className="text-field" value={mode} disabled={!enabled} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="continuous">Liên tục</option><option value="page">Đánh lại mỗi trang</option><option value="section">Đánh lại mỗi phần</option></select></label>
        <label className="field"><span className="field-label">Hiện mỗi (dòng)</span><input className="text-field" type="number" min={1} max={100} value={step} disabled={!enabled} onChange={(e) => setStep(Number(e.target.value) || 1)} /></label>
      </div>
    </Modal>
  );
}

function WrapOptionsDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const selected = selectedImage(editor);
  const attrs = selected?.node.attrs ?? {};
  const [wrap, setWrap] = useState<WrapKind>(wrapOf(attrs));
  const [side, setSide] = useState(attrs.align === 'right' ? 'right' : attrs.align === 'center' ? 'center' : 'left');
  const [gap, setGap] = useState(Number(attrs.wrapGap) || 0);
  const [offsetX, setOffsetX] = useState(String(toCm(Number(attrs.offsetX) || 0)));
  const [offsetY, setOffsetY] = useState(String(toCm(Number(attrs.offsetY) || 0)));
  const [rotate, setRotate] = useState(Number(attrs.rotate) || 0);
  const [width, setWidth] = useState(parseInt(String(attrs.width ?? '100'), 10) || 100);
  const [unit, setUnit] = useState(String(attrs.width ?? '%').includes('%') ? '%' : 'px');
  const [alt, setAlt] = useState(String(attrs.alt ?? ''));
  if (!selected) return <Modal title="Bố cục ảnh" icon={<WrapText size={20} />} onClose={onClose} width={420}><div className="panel-empty">Hãy chọn một ảnh trước.</div></Modal>;
  const parse = (value: string) => {
    const number = parseFloat(value.replace(',', '.'));
    return Number.isFinite(number) ? Math.round(number * CM) : 0;
  };
  const apply = () => {
    const isFloat = wrap === 'square' || wrap === 'tight' || wrap === 'through';
    const align = wrap === 'inline' ? 'inline' : wrap === 'behind' || wrap === 'front' ? 'inline' : wrap === 'topBottom' ? side : side === 'right' ? 'right' : 'left';
    patchObject(editor, selected.pos, { wrap: wrap === 'inline' ? null : wrap, align, wrapGap: isFloat || wrap === 'topBottom' ? gap : 0, offsetX: wrap === 'inline' ? 0 : parse(offsetX), offsetY: wrap === 'inline' ? 0 : parse(offsetY), rotate: ((rotate % 360) + 360) % 360, width: `${Math.max(1, width)}${unit}`, alt, position: null });
    onClose();
  };
  return (
    <Modal title="Bố cục ảnh" icon={<WrapText size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Cách bao chữ</span><select className="text-field" value={wrap} onChange={(e) => setWrap(e.target.value as WrapKind)}>{(Object.keys(WRAP_LABELS) as WrapKind[]).map((kind) => <option key={kind} value={kind}>{WRAP_LABELS[kind]}</option>)}</select></label>
        <label className="field"><span className="field-label">Phía đặt ảnh</span><select className="text-field" value={side} disabled={wrap === 'inline' || wrap === 'behind' || wrap === 'front'} onChange={(e) => setSide(e.target.value)}><option value="left">Trái</option>{wrap === 'topBottom' && <option value="center">Giữa</option>}<option value="right">Phải</option></select></label>
        <label className="field"><span className="field-label">Cách chữ (px, 0 là mặc định)</span><input className="text-field" type="number" min={0} max={96} value={gap} disabled={wrap === 'inline' || wrap === 'behind' || wrap === 'front'} onChange={(e) => setGap(Number(e.target.value) || 0)} /></label>
        <label className="field"><span className="field-label">Dịch ngang (cm)</span><input className="text-field" type="number" step={0.1} value={offsetX} disabled={wrap === 'inline'} onChange={(e) => setOffsetX(e.target.value)} /></label>
        <label className="field"><span className="field-label">Dịch dọc (cm)</span><input className="text-field" type="number" step={0.1} value={offsetY} disabled={wrap === 'inline'} onChange={(e) => setOffsetY(e.target.value)} /></label>
        <label className="field"><span className="field-label">Góc xoay (độ)</span><input className="text-field" type="number" min={-360} max={360} value={rotate} onChange={(e) => setRotate(Number(e.target.value) || 0)} /></label>
        <label className="field"><span className="field-label">Chiều rộng</span><span className="inline-field"><input className="text-field" type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value) || 1)} /><select className="text-field" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="%">% khổ trang</option><option value="px">px</option></select></span></label>
        <label className="field span-2"><span className="field-label">Mô tả ảnh (alt)</span><input className="text-field" value={alt} onChange={(e) => setAlt(e.target.value)} /></label>
      </div>
    </Modal>
  );
}

export default function LayoutExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  switch (dialog) {
    case 'pagesetup': return <PageSetupDialog onClose={onClose} />;
    case 'columns': return <ColumnsDialog onClose={onClose} />;
    case 'watermark': return <WatermarkDialog onClose={onClose} />;
    case 'pageborders': return <PageBordersDialog onClose={onClose} />;
    case 'themecolors': return <ThemeColorsDialog onClose={onClose} />;
    case 'themefonts': return <ThemeFontsDialog onClose={onClose} />;
    case 'linenumbers': return <LineNumbersDialog onClose={onClose} />;
    case 'wrapoptions': return <WrapOptionsDialog onClose={onClose} />;
    default: return null;
  }
}

function SelectionPane() {
  const ctx = useDoc();
  const { editor, setView } = ctx;
  const rows = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { selection } = e.state;
      const current = selection instanceof NodeSelection ? selection.from : -1;
      return { list: listObjects(e.state.doc), current };
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  const select = (row: (typeof rows.list)[number]) => {
    if (row.kind === 'image') editor.chain().focus().setNodeSelection(row.pos).run();
    else editor.chain().focus().setTextSelection(row.pos + 1).run();
    const dom = editor.view.nodeDOM(row.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const setAllHidden = (hidden: boolean) => {
    const tr = editor.state.tr;
    for (const row of rows.list) {
      const node = tr.doc.nodeAt(row.pos);
      if (node) tr.setNodeMarkup(row.pos, undefined, { ...node.attrs, hidden });
    }
    editor.view.dispatch(tr);
  };
  const reorder = (row: (typeof rows.list)[number], action: 'forward' | 'backward') => {
    if (row.kind !== 'image') return;
    editor.chain().focus().setNodeSelection(row.pos).run();
    zOrder(ctx, action);
  };
  return (
    <aside className="doc-comments selection-pane" aria-label="Ngăn chọn">
      <div className="panel-head"><span><Layers size={14} /> Ngăn chọn</span><button className="icon-btn" aria-label="Đóng" onClick={() => setView({ sidePanel: null })}><X size={14} /></button></div>
      <div className="panel-row">
        <button className="btn" disabled={!rows.list.length} onClick={() => setAllHidden(false)}><Eye size={13} /> Hiện tất cả</button>
        <button className="btn" disabled={!rows.list.length} onClick={() => setAllHidden(true)}><EyeOff size={13} /> Ẩn tất cả</button>
      </div>
      <div className="selection-list">
        {rows.list.length === 0 && <div className="panel-empty">Tài liệu chưa có ảnh, hình hay hộp chữ nào.</div>}
        {rows.list.map((row) => (
          <div key={row.pos} className={`selection-row ${rows.current === row.pos ? 'on' : ''} ${row.hidden ? 'is-hidden' : ''}`}>
            <input className="selection-name" aria-label={`Tên ${row.name}`} defaultValue={row.name} key={row.name} onFocus={() => select(row)} onBlur={(e) => { const next = e.target.value.trim(); if (next && next !== row.name) patchObject(editor, row.pos, { name: next }); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            {row.kind === 'image' && (
              <>
                <button className="icon-btn" title="Đưa lên một lớp" aria-label={`Đưa ${row.name} lên một lớp`} onClick={() => reorder(row, 'forward')}><ArrowUp size={13} /></button>
                <button className="icon-btn" title="Đưa xuống một lớp" aria-label={`Đưa ${row.name} xuống một lớp`} onClick={() => reorder(row, 'backward')}><ArrowDown size={13} /></button>
              </>
            )}
            <button className="icon-btn" title={row.hidden ? 'Hiện' : 'Ẩn'} aria-label={`${row.hidden ? 'Hiện' : 'Ẩn'} ${row.name}`} aria-pressed={row.hidden} onClick={() => patchObject(editor, row.pos, { hidden: !row.hidden })}>{row.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function LayoutPanels() {
  const { view } = useDoc();
  return view.sidePanel === 'selection' ? <SelectionPane /> : null;
}
