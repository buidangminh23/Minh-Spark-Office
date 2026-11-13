import { useMemo, useState } from 'react';
import type { SlideElement, SlideLink, SlideLinkKind } from '../../lib/slideTypes';
import { DATE_FORMATS, SYMBOL_GROUPS, clampIndent, formatDate, HIGHLIGHT_COLORS } from '../../lib/slideTextOps';
import { SLIDE_FONTS } from '../../lib/settings/slideOptions';
import { readAsDataUrl, formatBytes } from '../../lib/download';
import { Dialog, DialogButtons, Field } from './ribbonParts';
import { newElementId, useSlideExtras } from './slideExtrasContext';
import { SLIDE_ICON_GROUPS } from './slideIconLibrary';
import { textElement } from './ribbonHome';

type CloseProps = { onClose: () => void };

const FONT_STYLES: ReadonlyArray<readonly [string, Pick<SlideElement, 'fontWeight' | 'fontStyle'>]> = [
  ['Thường', { fontWeight: 'normal', fontStyle: 'normal' }],
  ['Nghiêng', { fontWeight: 'normal', fontStyle: 'italic' }],
  ['Đậm', { fontWeight: 'bold', fontStyle: 'normal' }],
  ['Đậm nghiêng', { fontWeight: 'bold', fontStyle: 'italic' }],
];

const fontLabel = (family: string | undefined) => family?.replace(/['"]/g, '').split(',')[0].trim() || 'Segoe UI';

export function FontDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [draft, setDraft] = useState<Partial<SlideElement>>(() => ({
    fontFamily: el?.fontFamily,
    fontSize: el?.fontSize ?? 20,
    fontWeight: el?.fontWeight ?? 'normal',
    fontStyle: el?.fontStyle ?? 'normal',
    color: el?.color ?? '#1E293B',
    textDecoration: el?.textDecoration ?? 'none',
    strikethrough: el?.strikethrough ?? false,
    highlight: el?.highlight,
    letterSpacing: el?.letterSpacing ?? 0,
    textShadow: el?.textShadow ?? false,
  }));
  const styleIndex = FONT_STYLES.findIndex(([, s]) => s.fontWeight === (draft.fontWeight === 'normal' ? 'normal' : 'bold') && s.fontStyle === draft.fontStyle);
  const families = Array.from(new Set([fontLabel(el?.fontFamily), ...SLIDE_FONTS, 'Calibri Light', 'Cambria', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Arial Black', 'Courier New']));
  const apply = () => {
    x.updateSelected({ ...draft, letterSpacing: draft.letterSpacing || undefined });
    onClose();
  };
  return (
    <Dialog title="Phông chữ" onClose={onClose} width={520} footer={<DialogButtons onCancel={onClose} onOk={apply} okDisabled={!el} />}>
      <div className="ppx-grid-3">
        <Field label="Phông chữ">
          <select className="ppt-select" value={fontLabel(draft.fontFamily)} onChange={(e) => setDraft({ ...draft, fontFamily: `'${e.target.value}', sans-serif` })}>
            {families.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
        </Field>
        <Field label="Kiểu">
          <select className="ppt-select" value={Math.max(0, styleIndex)} onChange={(e) => setDraft({ ...draft, ...FONT_STYLES[Number(e.target.value)][1] })}>
            {FONT_STYLES.map(([label], index) => <option key={label} value={index}>{label}</option>)}
          </select>
        </Field>
        <Field label="Cỡ (pt)">
          <input className="ppt-input" type="number" min={6} max={400} value={draft.fontSize} onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="ppx-grid-3">
        <Field label="Màu chữ">
          <input type="color" value={draft.color ?? '#000000'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        </Field>
        <Field label="Gạch chân">
          <select className="ppt-select" value={draft.textDecoration === 'underline' ? 'underline' : 'none'} onChange={(e) => setDraft({ ...draft, textDecoration: e.target.value as SlideElement['textDecoration'] })}>
            <option value="none">(không có)</option>
            <option value="underline">Gạch đơn</option>
          </select>
        </Field>
        <Field label="Tô sáng">
          <select className="ppt-select" value={draft.highlight ?? ''} onChange={(e) => setDraft({ ...draft, highlight: e.target.value || undefined })}>
            <option value="">(không)</option>
            {HIGHLIGHT_COLORS.map((c) => <option key={c} value={c} style={{ background: c }}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="ppx-checks-row">
        <label className="ppt-checkbox-label"><input type="checkbox" checked={draft.strikethrough ?? false} onChange={(e) => setDraft({ ...draft, strikethrough: e.target.checked })} /> Gạch ngang</label>
        <label className="ppt-checkbox-label"><input type="checkbox" checked={draft.textShadow ?? false} onChange={(e) => setDraft({ ...draft, textShadow: e.target.checked })} /> Đổ bóng</label>
      </div>
      <Field label={`Giãn cách ký tự: ${draft.letterSpacing ?? 0} pt`}>
        <input type="range" min={-5} max={20} step={0.5} value={draft.letterSpacing ?? 0} onChange={(e) => setDraft({ ...draft, letterSpacing: Number(e.target.value) })} />
      </Field>
      <div className="ppx-font-preview" style={{ fontFamily: draft.fontFamily, fontWeight: draft.fontWeight, fontStyle: draft.fontStyle, color: draft.color, textDecoration: [draft.textDecoration === 'underline' ? 'underline' : '', draft.strikethrough ? 'line-through' : ''].join(' ').trim() || 'none', letterSpacing: `${draft.letterSpacing ?? 0}px`, background: draft.highlight }}>
        {el?.text?.split('\n')[0]?.slice(0, 40) || 'Office 23'}
      </div>
    </Dialog>
  );
}

export function ParagraphDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [draft, setDraft] = useState<Partial<SlideElement>>(() => ({
    textAlign: el?.textAlign ?? 'left',
    indentLevel: el?.indentLevel ?? 0,
    lineHeight: el?.lineHeight ?? 1.4,
    padding: el?.padding ?? 8,
    verticalAlign: el?.verticalAlign ?? 'top',
    textDirection: el?.textDirection ?? 'horizontal',
    textColumns: el?.textColumns ?? 1,
  }));
  const apply = () => {
    x.updateSelected({ ...draft, indentLevel: clampIndent(draft.indentLevel ?? 0), textDirection: draft.textDirection === 'horizontal' ? undefined : draft.textDirection, textColumns: (draft.textColumns ?? 1) > 1 ? draft.textColumns : undefined });
    onClose();
  };
  return (
    <Dialog title="Đoạn văn" onClose={onClose} width={480} footer={<DialogButtons onCancel={onClose} onOk={apply} okDisabled={!el} />}>
      <div className="ppx-grid-2">
        <Field label="Căn lề">
          <select className="ppt-select" value={draft.textAlign} onChange={(e) => setDraft({ ...draft, textAlign: e.target.value as SlideElement['textAlign'] })}>
            <option value="left">Trái</option>
            <option value="center">Giữa</option>
            <option value="right">Phải</option>
            <option value="justify">Đều hai bên</option>
          </select>
        </Field>
        <Field label="Căn chiều dọc">
          <select className="ppt-select" value={draft.verticalAlign} onChange={(e) => setDraft({ ...draft, verticalAlign: e.target.value as SlideElement['verticalAlign'] })}>
            <option value="top">Trên</option>
            <option value="middle">Giữa</option>
            <option value="bottom">Dưới</option>
          </select>
        </Field>
        <Field label="Mức thụt lề">
          <input className="ppt-input" type="number" min={0} max={8} value={draft.indentLevel} onChange={(e) => setDraft({ ...draft, indentLevel: Number(e.target.value) })} />
        </Field>
        <Field label="Lề trong ô (px)">
          <input className="ppt-input" type="number" min={0} max={80} value={draft.padding} onChange={(e) => setDraft({ ...draft, padding: Number(e.target.value) })} />
        </Field>
        <Field label="Giãn dòng (bội số)">
          <input className="ppt-input" type="number" min={0.8} max={4} step={0.05} value={draft.lineHeight} onChange={(e) => setDraft({ ...draft, lineHeight: Number(e.target.value) })} />
        </Field>
        <Field label="Số cột">
          <input className="ppt-input" type="number" min={1} max={4} value={draft.textColumns} onChange={(e) => setDraft({ ...draft, textColumns: Number(e.target.value) })} />
        </Field>
        <Field label="Hướng văn bản">
          <select className="ppt-select" value={draft.textDirection} onChange={(e) => setDraft({ ...draft, textDirection: e.target.value as SlideElement['textDirection'] })}>
            <option value="horizontal">Ngang</option>
            <option value="rotate-90">Xoay 90°</option>
            <option value="rotate-270">Xoay 270°</option>
            <option value="stacked">Xếp chồng</option>
          </select>
        </Field>
      </div>
    </Dialog>
  );
}

export function ReplaceFontsDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const used = useMemo(() => Array.from(new Set(x.presentation.slides.flatMap((s) => s.elements.map((e) => fontLabel(e.fontFamily))))).sort(), [x.presentation.slides]);
  const [from, setFrom] = useState(used[0] ?? 'Segoe UI');
  const [to, setTo] = useState(SLIDE_FONTS[1]);
  const apply = () => {
    let count = 0;
    x.commit((p) => ({
      ...p,
      slides: p.slides.map((s) => ({
        ...s,
        elements: s.elements.map((e) => {
          if (fontLabel(e.fontFamily) !== from) return e;
          count += 1;
          return { ...e, fontFamily: `'${to}', sans-serif` };
        }),
      })),
    }));
    x.toast(`Đã thay phông ${from} bằng ${to}${count ? ` (${count} đối tượng)` : ''}`);
    onClose();
  };
  return (
    <Dialog title="Thay phông chữ" onClose={onClose} width={420} footer={<DialogButtons onCancel={onClose} onOk={apply} okLabel="Thay thế" />}>
      <Field label="Thay phông">
        <select className="ppt-select" value={from} onChange={(e) => setFrom(e.target.value)}>
          {used.map((f) => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Bằng phông">
        <select className="ppt-select" value={to} onChange={(e) => setTo(e.target.value)}>
          {[...SLIDE_FONTS, 'Calibri Light', 'Cambria', 'Georgia', 'Verdana', 'Tahoma'].map((f) => <option key={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </Field>
    </Dialog>
  );
}

export function InsertTableDialog({ onClose, onInsert }: CloseProps & { onInsert: (rows: number, cols: number) => void }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  return (
    <Dialog title="Chèn bảng" onClose={onClose} width={340} footer={<DialogButtons onCancel={onClose} onOk={() => { onInsert(rows, cols); onClose(); }} />}>
      <div className="ppx-grid-2">
        <Field label="Số cột">
          <input className="ppt-input" type="number" min={1} max={30} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(30, Number(e.target.value))))} />
        </Field>
        <Field label="Số hàng">
          <input className="ppt-input" type="number" min={1} max={60} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(60, Number(e.target.value))))} />
        </Field>
      </div>
    </Dialog>
  );
}

const LINK_KINDS: ReadonlyArray<readonly [SlideLinkKind, string]> = [
  ['url', 'Trang web hoặc tệp'],
  ['slide', 'Trang chiếu trong bài'],
  ['next', 'Trang tiếp theo'],
  ['prev', 'Trang trước'],
  ['first', 'Trang đầu tiên'],
  ['last', 'Trang cuối cùng'],
  ['end', 'Kết thúc trình chiếu'],
  ['email', 'Địa chỉ email'],
];

export function LinkDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [link, setLink] = useState<SlideLink>(() => el?.link ?? { kind: 'url', url: 'https://', trigger: 'click' });
  const slideTitle = (index: number) => x.presentation.slides[index].elements.find((e) => e.isTitle)?.text?.trim() || `Trang chiếu ${index + 1}`;
  const apply = () => {
    if (!el) return;
    const clean: SlideLink = { ...link };
    if (clean.kind === 'email' && clean.url && !clean.url.startsWith('mailto:')) clean.url = `mailto:${clean.url}`;
    if (clean.kind === 'url' && clean.url && !/^[a-z][a-z0-9+.-]*:/i.test(clean.url)) clean.url = `https://${clean.url}`;
    x.updateElement(el.id, { link: clean });
    onClose();
  };
  const valid = link.kind === 'slide' ? Boolean(link.slideId) : link.kind === 'url' || link.kind === 'email' ? Boolean(link.url && link.url !== 'https://') : true;
  return (
    <Dialog
      title="Liên kết và hành động"
      onClose={onClose}
      width={520}
      footer={
        <>
          {el?.link && <button type="button" className="ppt-secondary-action-btn" onClick={() => { if (el) x.updateElement(el.id, { link: undefined }); onClose(); }}>Gỡ liên kết</button>}
          <DialogButtons onCancel={onClose} onOk={apply} okDisabled={!el || !valid} />
        </>
      }
    >
      <div className="ppx-grid-2">
        <Field label="Liên kết tới">
          <select className="ppt-select" value={link.kind} onChange={(e) => setLink({ ...link, kind: e.target.value as SlideLinkKind })}>
            {LINK_KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        <Field label="Kích hoạt khi">
          <select className="ppt-select" value={link.trigger ?? 'click'} onChange={(e) => setLink({ ...link, trigger: e.target.value as SlideLink['trigger'] })}>
            <option value="click">Bấm chuột</option>
            <option value="hover">Rê chuột qua</option>
          </select>
        </Field>
      </div>
      {(link.kind === 'url' || link.kind === 'email') && (
        <Field label={link.kind === 'email' ? 'Địa chỉ email' : 'Địa chỉ'}>
          <input className="ppt-input" value={link.url ?? ''} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder={link.kind === 'email' ? 'ten@congty.vn' : 'https://'} autoFocus />
        </Field>
      )}
      {link.kind === 'slide' && (
        <div className="ppx-list" role="listbox">
          {x.presentation.slides.map((s, i) => (
            <button type="button" key={s.id} className={`ppx-list-item ${link.slideId === s.id ? 'is-active' : ''}`} onClick={() => setLink({ ...link, slideId: s.id })}>
              {i + 1}. {slideTitle(i)}
            </button>
          ))}
        </div>
      )}
      <Field label="Mẹo màn hình (ScreenTip)">
        <input className="ppt-input" value={link.tooltip ?? ''} onChange={(e) => setLink({ ...link, tooltip: e.target.value })} placeholder="Mô tả ngắn hiện khi rê chuột" />
      </Field>
    </Dialog>
  );
}

export function HeaderFooterDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const initial = x.presentation.headerFooter ?? {};
  const [hf, setHf] = useState({
    showDate: initial.showDate ?? false,
    dateMode: initial.dateMode ?? 'auto',
    dateFormat: initial.dateFormat ?? DATE_FORMATS[0],
    fixedDate: initial.fixedDate ?? formatDate(new Date(), DATE_FORMATS[0]),
    showSlideNumber: initial.showSlideNumber ?? x.presentation.slideMaster?.showSlideNumber ?? false,
    showFooter: initial.showFooter ?? Boolean(x.presentation.slideMaster?.footerText),
    footerText: initial.footerText ?? x.presentation.slideMaster?.footerText ?? '',
    hideOnTitle: initial.hideOnTitle ?? false,
    notesHeader: initial.notesHeader ?? '',
    notesFooter: initial.notesFooter ?? '',
  });
  const apply = (all: boolean) => {
    x.commit((p) => ({
      ...p,
      headerFooter: hf,
      slides: all ? p.slides : p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, hideBackgroundGraphics: undefined } : { ...s, hideBackgroundGraphics: true })),
    }));
    onClose();
  };
  return (
    <Dialog
      title="Đầu trang và chân trang"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="ppt-secondary-action-btn" onClick={onClose}>Hủy</button>
          <button type="button" className="ppt-secondary-action-btn" onClick={() => apply(false)}>Chỉ áp trang này</button>
          <button type="button" className="ppt-primary-action-btn" onClick={() => apply(true)}>Áp dụng cho tất cả</button>
        </>
      }
    >
      <label className="ppt-checkbox-label"><input type="checkbox" checked={hf.showDate} onChange={(e) => setHf({ ...hf, showDate: e.target.checked })} /> Ngày và giờ</label>
      {hf.showDate && (
        <div className="ppx-indent">
          <label className="ppt-checkbox-label"><input type="radio" checked={hf.dateMode === 'auto'} onChange={() => setHf({ ...hf, dateMode: 'auto' })} /> Tự động cập nhật</label>
          <select className="ppt-select" disabled={hf.dateMode !== 'auto'} value={hf.dateFormat} onChange={(e) => setHf({ ...hf, dateFormat: e.target.value })}>
            {DATE_FORMATS.map((f) => <option key={f} value={f}>{formatDate(new Date(), f)}</option>)}
          </select>
          <label className="ppt-checkbox-label"><input type="radio" checked={hf.dateMode === 'fixed'} onChange={() => setHf({ ...hf, dateMode: 'fixed' })} /> Cố định</label>
          <input className="ppt-input" disabled={hf.dateMode !== 'fixed'} value={hf.fixedDate} onChange={(e) => setHf({ ...hf, fixedDate: e.target.value })} />
        </div>
      )}
      <label className="ppt-checkbox-label"><input type="checkbox" checked={hf.showSlideNumber} onChange={(e) => setHf({ ...hf, showSlideNumber: e.target.checked })} /> Số trang chiếu</label>
      <label className="ppt-checkbox-label"><input type="checkbox" checked={hf.showFooter} onChange={(e) => setHf({ ...hf, showFooter: e.target.checked })} /> Chân trang</label>
      {hf.showFooter && <input className="ppt-input ppx-indent" value={hf.footerText} onChange={(e) => setHf({ ...hf, footerText: e.target.value })} placeholder="Nội dung chân trang" />}
      <label className="ppt-checkbox-label"><input type="checkbox" checked={hf.hideOnTitle} onChange={(e) => setHf({ ...hf, hideOnTitle: e.target.checked })} /> Không hiện trên trang tiêu đề</label>
      <div className="ppx-subhead">Ghi chú và tài liệu phát tay</div>
      <div className="ppx-grid-2">
        <Field label="Đầu trang"><input className="ppt-input" value={hf.notesHeader} onChange={(e) => setHf({ ...hf, notesHeader: e.target.value })} /></Field>
        <Field label="Chân trang"><input className="ppt-input" value={hf.notesFooter} onChange={(e) => setHf({ ...hf, notesFooter: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

export function DateTimeDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [format, setFormat] = useState(DATE_FORMATS[0]);
  const [auto, setAuto] = useState(true);
  const now = new Date();
  const apply = () => {
    const sel = x.selectedElement;
    if (sel?.type === 'text' && !auto) {
      x.updateSelected((item) => ({ text: `${item.text ?? ''}${item.text ? ' ' : ''}${formatDate(now, format)}` }));
    } else if (sel?.type === 'text' && auto) {
      x.updateSelected({ field: 'date', fieldFormat: format });
    } else {
      x.addElement(textElement({ x: 4, y: 90, width: 30, height: 7, fontSize: 14, name: 'Ngày giờ', ...(auto ? { field: 'date' as const, fieldFormat: format, text: '' } : { text: formatDate(now, format) }) }, x.theme.bodyFont, x.theme.textColor));
    }
    onClose();
  };
  return (
    <Dialog title="Ngày và giờ" onClose={onClose} width={380} footer={<DialogButtons onCancel={onClose} onOk={apply} />}>
      <div className="ppx-list" role="listbox">
        {DATE_FORMATS.map((f) => (
          <button type="button" key={f} className={`ppx-list-item ${format === f ? 'is-active' : ''}`} onClick={() => setFormat(f)} onDoubleClick={apply}>
            {formatDate(now, f)}
          </button>
        ))}
      </div>
      <label className="ppt-checkbox-label"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tự động cập nhật</label>
    </Dialog>
  );
}

export function SymbolDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [group, setGroup] = useState(0);
  const [picked, setPicked] = useState('');
  const insert = (char: string) => {
    const sel = x.selectedElement;
    if (sel && (sel.type === 'text' || sel.type === 'shape')) x.updateSelected((item) => ({ text: `${item.text ?? ''}${char}` }));
    else x.addElement(textElement({ text: char, fontSize: 40, width: 10, height: 14, x: 45, y: 43, textAlign: 'center' }, x.theme.bodyFont, x.theme.textColor));
    setPicked(char);
  };
  return (
    <Dialog title="Ký hiệu" onClose={onClose} width={520} footer={<button type="button" className="ppt-primary-action-btn" onClick={onClose}>Đóng</button>}>
      <Field label="Nhóm">
        <select className="ppt-select" value={group} onChange={(e) => setGroup(Number(e.target.value))}>
          {SYMBOL_GROUPS.map((g, i) => <option key={g.name} value={i}>{g.name}</option>)}
        </select>
      </Field>
      <div className="ppx-symbol-grid">
        {Array.from(SYMBOL_GROUPS[group].chars).map((char) => (
          <button type="button" key={char} className={`ppx-symbol ${picked === char ? 'is-active' : ''}`} onClick={() => insert(char)} title={`U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`}>
            {char}
          </button>
        ))}
      </div>
      <div className="ppx-muted">Bấm ký hiệu để chèn vào ô đang chọn. Chưa chọn ô nào thì tạo ô chữ mới.</div>
    </Dialog>
  );
}

export function IconsDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const q = query.trim().toLowerCase();
  const groups = SLIDE_ICON_GROUPS.map((g) => ({ ...g, icons: g.icons.filter(([id, , label]) => !q || id.includes(q) || label.includes(q)) })).filter((g) => g.icons.length);
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((i) => i !== id) : [...list, id]));
  const insert = () => {
    x.addElements(
      selected.map((name, index) => ({ id: newElementId('icon'), type: 'icon' as const, iconName: name, x: 10 + (index % 6) * 14, y: 30 + Math.floor(index / 6) * 22, width: 10, height: 17, fill: x.theme.primaryColor, name: `Biểu tượng ${name}`, altText: name })),
    );
    onClose();
  };
  return (
    <Dialog title="Chèn biểu tượng" onClose={onClose} wide footer={<DialogButtons onCancel={onClose} onOk={insert} okLabel={`Chèn (${selected.length})`} okDisabled={selected.length === 0} />}>
      <input className="ppt-input" placeholder="Tìm biểu tượng (ví dụ: tiền, xe, nhóm…)" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="ppx-icon-scroll">
        {groups.map((group) => (
          <div key={group.name}>
            <div className="ppx-subhead">{group.name}</div>
            <div className="ppx-icon-grid">
              {group.icons.map(([id, Icon, label]) => (
                <button type="button" key={id} className={`ppx-icon-cell ${selected.includes(id) ? 'is-active' : ''}`} title={label} onClick={() => toggle(id)}>
                  <Icon size={26} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

const MAX_OBJECT_BYTES = 25 * 1024 * 1024;

export function ObjectDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const [file, setFile] = useState<File | null>(null);
  const apply = async () => {
    if (!file) return;
    if (file.size > MAX_OBJECT_BYTES) {
      x.toast('Tệp lớn hơn 25 MB, không nhúng được.', true);
      return;
    }
    const url = await readAsDataUrl(file);
    x.addElement({ id: newElementId('obj'), type: 'object', x: 40, y: 38, width: 20, height: 24, name: file.name, objectData: { name: file.name, mime: file.type || 'application/octet-stream', url, size: file.size, displayAsIcon: true }, altText: file.name });
    x.toast('Đã nhúng tệp. Khi trình chiếu, bấm vào biểu tượng để mở tệp.');
    onClose();
  };
  return (
    <Dialog title="Chèn đối tượng" onClose={onClose} width={420} footer={<DialogButtons onCancel={onClose} onOk={() => void apply()} okDisabled={!file} />}>
      <Field label="Tạo từ tệp">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      {file && <div className="ppx-muted">{file.name} · {formatBytes(file.size)}</div>}
      <div className="ppx-muted">Tệp được nhúng vào bài thuyết trình và hiện thành biểu tượng.</div>
    </Dialog>
  );
}

export function AltTextDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [text, setText] = useState(el?.altText ?? el?.alt ?? '');
  const [decorative, setDecorative] = useState(el?.decorative ?? false);
  return (
    <Dialog title="Văn bản thay thế" onClose={onClose} width={440} footer={<DialogButtons onCancel={onClose} onOk={() => { if (el) x.updateElement(el.id, { altText: text, alt: el.type === 'image' ? text : el.alt, decorative }); onClose(); }} okDisabled={!el} />}>
      <div className="ppx-muted">Mô tả đối tượng cho người dùng trình đọc màn hình (1-2 câu).</div>
      <textarea className="ppt-input ppx-textarea" rows={5} value={text} disabled={decorative} onChange={(e) => setText(e.target.value)} autoFocus />
      <label className="ppt-checkbox-label"><input type="checkbox" checked={decorative} onChange={(e) => setDecorative(e.target.checked)} /> Đánh dấu là trang trí</label>
    </Dialog>
  );
}

export function SectionRenameDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const section = (x.presentation.sections ?? []).find((s) => s.id === x.currentSlide.sectionId);
  const [name, setName] = useState(section?.name ?? '');
  return (
    <Dialog title="Đổi tên phần" onClose={onClose} width={360} footer={<DialogButtons onCancel={onClose} okLabel="Đổi tên" okDisabled={!name.trim() || !section} onOk={() => { x.commit((p) => ({ ...p, sections: (p.sections ?? []).map((s) => (s.id === section?.id ? { ...s, name: name.trim() } : s)) })); onClose(); }} />}>
      <Field label="Tên phần">
        <input className="ppt-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Dialog>
  );
}

export function SizePositionDialog({ onClose }: CloseProps) {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const [draft, setDraft] = useState({ x: el?.x ?? 0, y: el?.y ?? 0, width: el?.width ?? 10, height: el?.height ?? 10, rotation: el?.rotation ?? 0 });
  const [lock, setLock] = useState(false);
  const ratio = (el?.width ?? 1) / (el?.height ?? 1);
  const num = (key: keyof typeof draft) => (
    <input
      className="ppt-input"
      type="number"
      step={0.5}
      value={Math.round(draft[key] * 10) / 10}
      onChange={(e) => {
        const value = Number(e.target.value);
        if (lock && key === 'width') setDraft({ ...draft, width: value, height: value / ratio });
        else if (lock && key === 'height') setDraft({ ...draft, height: value, width: value * ratio });
        else setDraft({ ...draft, [key]: value });
      }}
    />
  );
  return (
    <Dialog title="Kích cỡ và vị trí" onClose={onClose} width={420} footer={<DialogButtons onCancel={onClose} onOk={() => { if (el) x.updateElement(el.id, { ...draft, rotation: ((draft.rotation % 360) + 360) % 360 }); onClose(); }} okDisabled={!el} />}>
      <div className="ppx-grid-2">
        <Field label="Rộng (%)">{num('width')}</Field>
        <Field label="Cao (%)">{num('height')}</Field>
        <Field label="Vị trí ngang (%)">{num('x')}</Field>
        <Field label="Vị trí dọc (%)">{num('y')}</Field>
        <Field label="Xoay (độ)">{num('rotation')}</Field>
      </div>
      <label className="ppt-checkbox-label"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Khóa tỷ lệ khung hình</label>
    </Dialog>
  );
}
