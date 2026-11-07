import { useMemo, useState } from 'react';
import { Baseline, PanelTop, Pilcrow, Palette } from 'lucide-react';
import type { DocStyleDef, PageNumberFormat, PageNumberPosition } from '../../../lib/storage';
import { newId, useDoc } from '../DocContext';
import { FONT_SIZES } from '../extensions';
import { resolveStyles } from '../docStyles';
import { pageNumberText } from '../pageFormat';
import Modal from './Modal';

const UNDERLINES = [{ value: '', label: 'Không' }, { value: 'solid', label: 'Đơn' }, { value: 'double', label: 'Đôi' }, { value: 'dotted', label: 'Chấm' }, { value: 'dashed', label: 'Gạch' }, { value: 'wavy', label: 'Lượn sóng' }];
const CM = 37.8;

const sizeInPt = (raw: unknown) => {
  const value = parseFloat(String(raw ?? ''));
  if (!Number.isFinite(value)) return '';
  return String(String(raw).endsWith('px') ? Math.round(value * 0.75 * 2) / 2 : value);
};

export function FontDialog({ onClose }: { onClose: () => void }) {
  const { editor, page } = useDoc();
  const initial = useMemo(() => editor.getAttributes('textStyle'), [editor]);
  const [font, setFont] = useState(String(initial.fontFamily ?? '').split(',')[0].replaceAll(/["']/g, '') || page.fontFamily || 'Arial');
  const [size, setSize] = useState(sizeInPt(initial.fontSize) || String(page.fontSize ?? 12));
  const [color, setColor] = useState(String(initial.color ?? '#1f2430'));
  const [bold, setBold] = useState(editor.isActive('bold'));
  const [italic, setItalic] = useState(editor.isActive('italic'));
  const [strike, setStrike] = useState(editor.isActive('strike'));
  const [underline, setUnderline] = useState(String(initial.underlineStyle ?? (editor.isActive('underline') ? 'solid' : '')));
  const [underlineColor, setUnderlineColor] = useState(String(initial.underlineColor ?? '#1f2430'));
  const [caps, setCaps] = useState(String(initial.textTransform ?? ''));
  const [smallCaps, setSmallCaps] = useState(initial.fontVariant === 'small-caps');
  const [spacing, setSpacing] = useState(parseFloat(String(initial.letterSpacing ?? 0)) || 0);
  const [shadow, setShadow] = useState(Boolean(initial.textShadow));
  const previewStyle: React.CSSProperties = {
    fontFamily: font, fontSize: `${size}pt`, color, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal',
    textDecoration: [underline ? `underline ${underline} ${underlineColor}` : '', strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    textTransform: (caps || 'none') as React.CSSProperties['textTransform'], fontVariant: smallCaps ? 'small-caps' : 'normal', letterSpacing: spacing ? `${spacing}px` : undefined,
    textShadow: shadow ? '1px 1px 2px rgba(0,0,0,0.35)' : undefined,
  };
  const apply = () => {
    let chain = editor.chain().focus().setFontFamily(font).setFontSize(`${size}pt`).setColor(color);
    chain = bold ? chain.setBold() : chain.unsetBold();
    chain = italic ? chain.setItalic() : chain.unsetItalic();
    chain = strike ? chain.setStrike() : chain.unsetStrike();
    chain = underline === 'solid' ? chain.setUnderline() : chain.unsetUnderline();
    chain.setMark('textStyle', {
      underlineStyle: underline && underline !== 'solid' ? underline : null,
      underlineColor: underline && underline !== 'solid' ? underlineColor : null,
      textTransform: caps || null,
      fontVariant: smallCaps ? 'small-caps' : null,
      letterSpacing: spacing ? `${spacing}px` : null,
      textShadow: shadow ? '1px 1px 2px rgba(0,0,0,0.35)' : null,
    }).run();
    onClose();
  };
  return (
    <Modal title="Phông chữ" icon={<Baseline size={20} />} onClose={onClose} width={560} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Phông</span><input className="text-field" value={font} onChange={(e) => setFont(e.target.value)} /></label>
        <label className="field"><span className="field-label">Cỡ (pt)</span><input className="text-field" list="font-dialog-sizes" value={size} onChange={(e) => setSize(e.target.value)} /><datalist id="font-dialog-sizes">{FONT_SIZES.map((s) => <option key={s} value={s} />)}</datalist></label>
        <label className="field"><span className="field-label">Màu chữ</span><input className="text-field color-field" type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label className="field"><span className="field-label">Gạch chân</span><select className="text-field" value={underline} onChange={(e) => setUnderline(e.target.value)}>{UNDERLINES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Màu gạch chân</span><input className="text-field color-field" type="color" value={underlineColor} disabled={!underline || underline === 'solid'} onChange={(e) => setUnderlineColor(e.target.value)} /></label>
        <label className="field"><span className="field-label">Khoảng cách ký tự (px)</span><input className="text-field" type="number" step={0.5} min={-3} max={20} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Kiểu hoa</span><select className="text-field" value={caps} onChange={(e) => setCaps(e.target.value)}><option value="">Bình thường</option><option value="uppercase">TẤT CẢ HOA</option><option value="lowercase">tất cả thường</option><option value="capitalize">Hoa Đầu Từ</option></select></label>
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /> Đậm</label>
        <label><input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} /> Nghiêng</label>
        <label><input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} /> Gạch ngang</label>
        <label><input type="checkbox" checked={smallCaps} onChange={(e) => setSmallCaps(e.target.checked)} /> Chữ hoa nhỏ</label>
        <label><input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} /> Đổ bóng</label>
      </div>
      <div className="font-preview" style={previewStyle}>Minh Spark Office — Xem trước</div>
    </Modal>
  );
}

export function ParagraphDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const attrs = useMemo(() => editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph'), [editor]);
  const toCm = (px: number) => Number((px / CM).toFixed(2));
  const [align, setAlign] = useState(String(attrs.textAlign ?? 'left'));
  const [left, setLeft] = useState(toCm((Number(attrs.indent) || 0) * 48));
  const [right, setRight] = useState(toCm(Number(attrs.indentRight) || 0));
  const first = Number(attrs.firstLine) || 0;
  const [special, setSpecial] = useState(first > 0 ? 'first' : first < 0 ? 'hanging' : 'none');
  const [specialBy, setSpecialBy] = useState(toCm(Math.abs(first)) || 1.27);
  const [before, setBefore] = useState(Number(attrs.spaceBefore ?? 0));
  const [after, setAfter] = useState(Number(attrs.spaceAfter ?? 6));
  const [line, setLine] = useState(String(attrs.lineHeight ?? '1.5'));
  const [keepNext, setKeepNext] = useState(Boolean(attrs.keepNext));
  const [breakBefore, setBreakBefore] = useState(Boolean(attrs.pageBreakBefore));
  const [dropCap, setDropCap] = useState(Boolean(attrs.dropCap));
  const [sides, setSides] = useState(String(attrs.borderSides ?? ''));
  const [borderStyle, setBorderStyle] = useState(String(attrs.borderStyle ?? 'solid'));
  const [borderColor, setBorderColor] = useState(String(attrs.borderColor ?? '#334155'));
  const [borderWidth, setBorderWidth] = useState(Number(attrs.borderWidth ?? 1));
  const [shading, setShading] = useState(String(attrs.shading ?? ''));
  const apply = () => {
    const firstLine = special === 'first' ? specialBy * CM : special === 'hanging' ? -specialBy * CM : 0;
    editor.chain().focus().setTextAlign(align)
      .setParagraphIndent({ left: left * CM, right: right * CM, firstLine: Math.round(firstLine) })
      .setParagraphSpacing(before, after).setLineHeight(parseFloat(line) || null)
      .setParagraphAttrs({ keepNext, pageBreakBefore: breakBefore, dropCap, borderSides: sides || null, borderStyle: sides ? borderStyle : null, borderColor: sides ? borderColor : null, borderWidth: sides ? borderWidth : null, shading: shading || null })
      .run();
    onClose();
  };
  return (
    <Modal title="Đoạn văn" icon={<Pilcrow size={20} />} onClose={onClose} width={620} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <div className="form-section-title">Căn lề và thụt lề</div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Căn lề</span><select className="text-field" value={align} onChange={(e) => setAlign(e.target.value)}><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option><option value="justify">Đều hai bên</option></select></label>
        <label className="field"><span className="field-label">Thụt trái (cm)</span><input className="text-field" type="number" step={0.25} min={0} value={left} onChange={(e) => setLeft(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Thụt phải (cm)</span><input className="text-field" type="number" step={0.25} min={0} value={right} onChange={(e) => setRight(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Dòng đầu</span><select className="text-field" value={special} onChange={(e) => setSpecial(e.target.value)}><option value="none">Không</option><option value="first">Thụt dòng đầu</option><option value="hanging">Treo (hanging)</option></select></label>
        <label className="field"><span className="field-label">Bằng (cm)</span><input className="text-field" type="number" step={0.25} min={0} disabled={special === 'none'} value={specialBy} onChange={(e) => setSpecialBy(Number(e.target.value))} /></label>
      </div>
      <div className="form-section-title">Khoảng cách</div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Trước đoạn (pt)</span><input className="text-field" type="number" min={0} max={96} value={before} onChange={(e) => setBefore(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Sau đoạn (pt)</span><input className="text-field" type="number" min={0} max={96} value={after} onChange={(e) => setAfter(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Giãn dòng (bội số)</span><input className="text-field" list="line-heights" value={line} onChange={(e) => setLine(e.target.value)} /><datalist id="line-heights">{['1', '1.15', '1.3', '1.5', '2', '2.5', '3'].map((v) => <option key={v} value={v} />)}</datalist></label>
      </div>
      <div className="form-section-title">Viền và tô nền</div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Viền</span><select className="text-field" value={sides} onChange={(e) => setSides(e.target.value)}><option value="">Không viền</option><option value="box">Hộp</option><option value="top">Trên</option><option value="bottom">Dưới</option><option value="left">Trái</option><option value="top,bottom">Trên và dưới</option></select></label>
        <label className="field"><span className="field-label">Kiểu nét</span><select className="text-field" value={borderStyle} disabled={!sides} onChange={(e) => setBorderStyle(e.target.value)}><option value="solid">Liền</option><option value="double">Đôi</option><option value="dashed">Gạch</option><option value="dotted">Chấm</option></select></label>
        <label className="field"><span className="field-label">Độ dày (px)</span><input className="text-field" type="number" min={1} max={6} value={borderWidth} disabled={!sides} onChange={(e) => setBorderWidth(Number(e.target.value))} /></label>
        <label className="field"><span className="field-label">Màu viền</span><input className="text-field color-field" type="color" value={borderColor} disabled={!sides} onChange={(e) => setBorderColor(e.target.value)} /></label>
        <label className="field"><span className="field-label">Màu nền</span><span className="color-inline"><input className="text-field color-field" type="color" value={shading || '#ffffff'} onChange={(e) => setShading(e.target.value)} /><button type="button" className="btn" onClick={() => setShading('')}>Bỏ</button></span></label>
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={keepNext} onChange={(e) => setKeepNext(e.target.checked)} /> Giữ cùng trang với đoạn sau</label>
        <label><input type="checkbox" checked={breakBefore} onChange={(e) => setBreakBefore(e.target.checked)} /> Sang trang trước đoạn này</label>
        <label><input type="checkbox" checked={dropCap} onChange={(e) => setDropCap(e.target.checked)} /> Chữ cái lớn đầu đoạn</label>
      </div>
    </Modal>
  );
}

const POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Chân trang, phải' }, { value: 'bottom-center', label: 'Chân trang, giữa' }, { value: 'bottom-left', label: 'Chân trang, trái' },
  { value: 'top-right', label: 'Đầu trang, phải' }, { value: 'top-center', label: 'Đầu trang, giữa' }, { value: 'top-left', label: 'Đầu trang, trái' },
];
const FORMATS: PageNumberFormat[] = ['page-of', 'page', 'plain', 'dash', 'roman'];

function ZoneInputs({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parts = value.split('\t');
  const zones = parts.length === 1 ? [parts[0], '', ''] : [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  const update = (index: number, text: string) => {
    const next = [...zones];
    next[index] = text.replaceAll('\t', ' ');
    onChange(next[1] || next[2] ? next.join('\t') : next[0]);
  };
  return (
    <div className="zone-row">
      <span className="field-label">{label}</span>
      <div className="zone-inputs">
        <input className="text-field" placeholder="Trái" aria-label={`${label}, trái`} value={zones[0]} onChange={(e) => update(0, e.target.value)} />
        <input className="text-field" placeholder="Giữa" aria-label={`${label}, giữa`} value={zones[1]} onChange={(e) => update(1, e.target.value)} />
        <input className="text-field" placeholder="Phải" aria-label={`${label}, phải`} value={zones[2]} onChange={(e) => update(2, e.target.value)} />
      </div>
    </div>
  );
}

export function HeaderFooterDialog({ onClose }: { onClose: () => void }) {
  const { page, setPage } = useDoc();
  const [draft, setDraft] = useState({ header: page.header, footer: page.footer, headerFirst: page.headerFirst ?? '', footerFirst: page.footerFirst ?? '', headerEven: page.headerEven ?? '', footerEven: page.footerEven ?? '' });
  const [differentFirstPage, setFirst] = useState(Boolean(page.differentFirstPage));
  const [differentOddEven, setOddEven] = useState(Boolean(page.differentOddEven));
  const [pageNumbers, setPageNumbers] = useState(page.pageNumbers);
  const [position, setPosition] = useState<PageNumberPosition>(page.pageNumberPosition ?? 'bottom-right');
  const [format, setFormat] = useState<PageNumberFormat>(page.pageNumberFormat ?? 'page-of');
  const [start, setStart] = useState(page.pageNumberStart ?? 1);
  const put = (key: keyof typeof draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const apply = () => {
    setPage({ ...draft, differentFirstPage, differentOddEven, pageNumbers, pageNumberPosition: position, pageNumberFormat: format, pageNumberStart: start });
    onClose();
  };
  return (
    <Modal title="Đầu trang, chân trang và số trang" subtitle="Dùng được {page}, {pages}, {title}, {date} trong nội dung." icon={<PanelTop size={20} />} onClose={onClose} width={680} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={apply}>Áp dụng</button></>}>
      <ZoneInputs label="Đầu trang" value={draft.header} onChange={put('header')} />
      <ZoneInputs label="Chân trang" value={draft.footer} onChange={put('footer')} />
      <div className="check-row">
        <label><input type="checkbox" checked={differentFirstPage} onChange={(e) => setFirst(e.target.checked)} /> Trang đầu khác</label>
        <label><input type="checkbox" checked={differentOddEven} onChange={(e) => setOddEven(e.target.checked)} /> Trang chẵn lẻ khác nhau</label>
      </div>
      {differentFirstPage && <><ZoneInputs label="Đầu trang, trang 1" value={draft.headerFirst} onChange={put('headerFirst')} /><ZoneInputs label="Chân trang, trang 1" value={draft.footerFirst} onChange={put('footerFirst')} /></>}
      {differentOddEven && <><ZoneInputs label="Đầu trang, trang chẵn" value={draft.headerEven} onChange={put('headerEven')} /><ZoneInputs label="Chân trang, trang chẵn" value={draft.footerEven} onChange={put('footerEven')} /></>}
      <div className="form-section-title">Số trang</div>
      <div className="check-row"><label><input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} /> Đánh số trang</label></div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Vị trí</span><select className="text-field" value={position} disabled={!pageNumbers} onChange={(e) => setPosition(e.target.value as PageNumberPosition)}>{POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Định dạng</span><select className="text-field" value={format} disabled={!pageNumbers} onChange={(e) => setFormat(e.target.value as PageNumberFormat)}>{FORMATS.map((f) => <option key={f} value={f}>{pageNumberText(f, 3, 12)}</option>)}</select></label>
        <label className="field"><span className="field-label">Bắt đầu từ</span><input className="text-field" type="number" min={1} value={start} disabled={!pageNumbers} onChange={(e) => setStart(Number(e.target.value) || 1)} /></label>
      </div>
    </Modal>
  );
}

export function StyleDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const { editor, page, setPage, editingStyle } = ctx;
  const styles = resolveStyles(page);
  const creating = editingStyle === 'new';
  const fromSelection = (): DocStyleDef => {
    const attrs = editor.getAttributes('textStyle');
    const para = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph');
    return {
      name: 'Kiểu mới', custom: true,
      font: String(attrs.fontFamily ?? '').split(',')[0].replaceAll(/["']/g, '') || undefined,
      size: parseFloat(sizeInPt(attrs.fontSize)) || undefined,
      color: attrs.color ? String(attrs.color) : undefined,
      bold: editor.isActive('bold') || undefined, italic: editor.isActive('italic') || undefined, underline: editor.isActive('underline') || undefined,
      align: para.textAlign ? String(para.textAlign) : undefined,
      before: para.spaceBefore ?? undefined, after: para.spaceAfter ?? undefined, line: para.lineHeight ?? undefined,
    };
  };
  const [def, setDef] = useState<DocStyleDef>(creating ? fromSelection() : styles[String(editingStyle)] ?? fromSelection());
  const put = (patch: Partial<DocStyleDef>) => setDef((d) => ({ ...d, ...patch }));
  const number = (value: string) => (value === '' ? undefined : Number(value));
  const save = () => {
    const id = creating ? newId('st') : String(editingStyle);
    setPage({ styles: { ...styles, [id]: def }, styleSet: undefined });
    if (creating) editor.chain().focus().setParagraph().updateAttributes('paragraph', { styleId: id }).run();
    onClose();
  };
  const remove = () => {
    const next = { ...styles };
    delete next[String(editingStyle)];
    setPage({ styles: next });
    onClose();
  };
  return (
    <Modal title={creating ? 'Tạo kiểu mới' : `Sửa kiểu: ${def.name}`} subtitle="Sửa kiểu thì mọi đoạn đang dùng kiểu đó đổi theo." icon={<Palette size={20} />} onClose={onClose} width={560} actions={<>{def.custom && !creating && <button className="btn" onClick={remove}>Xoá kiểu</button>}<span className="spacer" /><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" onClick={save}>Lưu kiểu</button></>}>
      <div className="form-grid">
        <label className="field"><span className="field-label">Tên kiểu</span><input className="text-field" value={def.name} disabled={!def.custom} onChange={(e) => put({ name: e.target.value })} /></label>
        <label className="field"><span className="field-label">Phông</span><input className="text-field" placeholder="Theo tài liệu" value={def.font ?? ''} onChange={(e) => put({ font: e.target.value || undefined })} /></label>
        <label className="field"><span className="field-label">Cỡ (pt)</span><input className="text-field" type="number" min={6} max={96} value={def.size ?? ''} onChange={(e) => put({ size: number(e.target.value) })} /></label>
        <label className="field"><span className="field-label">Màu</span><input className="text-field color-field" type="color" value={def.color ?? '#1f2430'} onChange={(e) => put({ color: e.target.value })} /></label>
        <label className="field"><span className="field-label">Căn lề</span><select className="text-field" value={def.align ?? ''} onChange={(e) => put({ align: e.target.value || undefined })}><option value="">Theo đoạn</option><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option><option value="justify">Đều</option></select></label>
        <label className="field"><span className="field-label">Giãn dòng</span><input className="text-field" type="number" step={0.05} min={1} max={3} value={def.line ?? ''} onChange={(e) => put({ line: number(e.target.value) })} /></label>
        <label className="field"><span className="field-label">Trước đoạn (pt)</span><input className="text-field" type="number" min={0} value={def.before ?? ''} onChange={(e) => put({ before: number(e.target.value) })} /></label>
        <label className="field"><span className="field-label">Sau đoạn (pt)</span><input className="text-field" type="number" min={0} value={def.after ?? ''} onChange={(e) => put({ after: number(e.target.value) })} /></label>
      </div>
      <div className="check-row">
        <label><input type="checkbox" checked={Boolean(def.bold)} onChange={(e) => put({ bold: e.target.checked })} /> Đậm</label>
        <label><input type="checkbox" checked={Boolean(def.italic)} onChange={(e) => put({ italic: e.target.checked })} /> Nghiêng</label>
        <label><input type="checkbox" checked={Boolean(def.underline)} onChange={(e) => put({ underline: e.target.checked })} /> Gạch chân</label>
        <label><input type="checkbox" checked={Boolean(def.caps)} onChange={(e) => put({ caps: e.target.checked })} /> In hoa</label>
      </div>
    </Modal>
  );
}
