import { useRef, useState, type ReactNode } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, BringToFront, ChevronDown, ChevronLeft, ChevronRight, Columns2, Droplets, FileType, FlipHorizontal, FlipVertical, Frame, Group as GroupIcon, Hash, Layers, LayoutTemplate, Maximize, Palette, PanelTop, Paintbrush, PilcrowLeft, RectangleHorizontal, RectangleVertical, RotateCcw, RotateCw, Rows3, ScissorsLineDashed, SendToBack, Settings2, Sparkles, Square, Stamp, Star, Ungroup, WrapText, Languages, SquareDashed, Shapes } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { allFontPairs, allPalettes, allStyleSets, clearDefaultPage, EFFECTS, fontPatch, palettePatch, paletteSwatches, resetDesignPatch, saveAsDefaultPage, saveCustomStyleSet, SPACING_PRESETS, spacingPatch, styleSetPatch, THEMES, themePatch, type StyleSet } from '../../designThemes';
import { activeStyleId, resolveStyles } from '../../docStyles';
import { ensureFont } from '../../fonts';
import { flipImage, groupImages, imagesInSelection, insertBreak, insertSideColumns, placeImage, rotateCustom, rotateImage, selectedImage, setWrap, ungroupImage, WRAP_LABELS, wrapOf, zOrder, type BreakKind, type HAlign, type VAlign, type WrapKind } from '../../layoutObjects';
import { newId } from '../../DocContext';
import { PAGE_SIZES, type DocStyleDef, type PageSettings } from '../../../../lib/storage';
import { Big, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Rows, Small, THEME_COLORS } from '../RibbonParts';

const CM = 37.8;
const GALLERY_SCROLL = 240;

const MARGINS: { id: string; label: string; detail: string; value: PageSettings['margins']; mirror?: boolean }[] = [
  { id: 'normal', label: 'Bình thường', detail: '2,54 cm mọi phía', value: { top: 96, right: 96, bottom: 96, left: 96 } },
  { id: 'vn', label: 'Văn bản hành chính', detail: 'Trên/dưới 2 cm · trái 3 cm · phải 1,5 cm', value: { top: 76, right: 57, bottom: 76, left: 113 } },
  { id: 'narrow', label: 'Hẹp', detail: '1,27 cm mọi phía', value: { top: 48, right: 48, bottom: 48, left: 48 } },
  { id: 'moderate', label: 'Vừa', detail: 'Trên/dưới 2,54 · trái/phải 1,91 cm', value: { top: 96, right: 72, bottom: 96, left: 72 } },
  { id: 'wide', label: 'Rộng', detail: 'Trên/dưới 2,54 · trái/phải 5,08 cm', value: { top: 96, right: 192, bottom: 96, left: 192 } },
  { id: 'mirrored', label: 'Đối xứng', detail: 'Trên/dưới 2,54 · trong 3,18 · ngoài 2,54 cm', value: { top: 96, right: 96, bottom: 96, left: 120 }, mirror: true },
];

const WATERMARKS = ['BẢN NHÁP', 'MẬT', 'TUYỆT MẬT', 'LƯU HÀNH NỘI BỘ', 'KHẨN', 'MẪU', 'CONFIDENTIAL', 'DRAFT'];
const WRAP_KINDS = Object.keys(WRAP_LABELS) as WrapKind[];
const POSITION_ROWS: VAlign[] = ['top', 'middle', 'bottom'];
const POSITION_COLS: HAlign[] = ['left', 'center', 'right'];
const ROW_LABELS: Record<VAlign, string> = { top: 'trên', middle: 'giữa', bottom: 'dưới' };
const COL_LABELS: Record<HAlign, string> = { left: 'trái', center: 'giữa', right: 'phải' };
const PAGE_BREAKS: { kind: BreakKind; label: string; detail: string }[] = [
  { kind: 'page', label: 'Trang', detail: 'Bắt đầu trang mới' },
  { kind: 'column', label: 'Cột', detail: 'Chuyển chữ sang cột kế tiếp' },
  { kind: 'wrap', label: 'Bao chữ', detail: 'Chữ tiếp theo nằm dưới ảnh đang bao' },
];
const SECTION_BREAKS: { kind: BreakKind; label: string; detail: string }[] = [
  { kind: 'next', label: 'Trang kế tiếp', detail: 'Phần mới bắt đầu ở trang sau' },
  { kind: 'continuous', label: 'Liên tục', detail: 'Phần mới bắt đầu ngay trên trang này' },
  { kind: 'even', label: 'Trang chẵn', detail: 'Phần mới bắt đầu ở trang chẵn kế tiếp' },
  { kind: 'odd', label: 'Trang lẻ', detail: 'Phần mới bắt đầu ở trang lẻ kế tiếp' },
];

function StyleThumb({ set, active, onClick }: { set: StyleSet; active: boolean; onClick: () => void }) {
  const title = set.styles.title ?? ({} as DocStyleDef);
  const h1 = set.styles.h1 ?? ({} as DocStyleDef);
  const headFont = title.font ?? set.font;
  return (
    <button type="button" className={`style-thumb ${active ? 'on' : ''}`} title={set.label} aria-label={set.label} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={onClick} style={{ fontFamily: `"${set.font}", Arial, sans-serif` }}>
      <span className="thumb-title" style={{ color: title.color, fontWeight: title.bold ? 700 : 400, textAlign: (title.align as 'left' | 'center' | undefined) ?? 'left', textTransform: title.caps ? 'uppercase' : undefined, fontFamily: `"${headFont}", Arial, sans-serif` }}>Tiêu đề</span>
      <span className="thumb-h1" style={{ color: h1.color, fontWeight: h1.bold === false ? 400 : 700, textTransform: h1.caps ? 'uppercase' : undefined, fontFamily: `"${h1.font ?? set.font}", Arial, sans-serif` }}>Đề mục 1</span>
      <span className="thumb-body">Trên tab Chèn, các thư viện gồm những mục được thiết kế để phối hợp với giao diện chung của tài liệu.</span>
    </button>
  );
}

function StyleGallery() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const strip = useRef<HTMLDivElement | null>(null);
  const [version, setVersion] = useState(0);
  const sets = allStyleSets();
  const current = page.styleSet ?? 'office';
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * GALLERY_SCROLL, behavior: 'smooth' });
  const pick = (set: StyleSet) => {
    setPage(styleSetPatch(set));
  };
  const saveNew = async () => {
    const res = await ctx.ui.ask({ title: 'Lưu thành bộ kiểu mới', fields: [{ name: 'name', label: 'Tên bộ kiểu', placeholder: 'Bộ kiểu công ty' }], confirmText: 'Lưu' });
    const name = String(res?.name ?? '').trim();
    if (!name) return;
    const id = newId('set');
    const saved = saveCustomStyleSet({ id, label: name, font: page.fontFamily ?? 'Arial', size: page.fontSize ?? 12, styles: resolveStyles(page) });
    if (!saved) return ctx.ui.toast('Không lưu được bộ kiểu trên máy này', true);
    setPage({ styleSet: id });
    setVersion(version + 1);
    ctx.ui.toast(`Đã lưu bộ kiểu "${name}"`);
  };
  return (
    <div className="style-gallery" data-version={version}>
      <div className="style-strip" ref={strip} role="listbox" aria-label="Bộ kiểu tài liệu">
        {sets.map((set) => <StyleThumb key={set.id} set={set} active={current === set.id} onClick={() => pick(set)} />)}
      </div>
      <div className="style-strip-nav">
        <button type="button" title="Cuộn sang trái" aria-label="Cuộn sang trái" onMouseDown={(e) => e.preventDefault()} onClick={() => scroll(-1)}><ChevronLeft size={12} /></button>
        <button type="button" title="Cuộn sang phải" aria-label="Cuộn sang phải" onMouseDown={(e) => e.preventDefault()} onClick={() => scroll(1)}><ChevronRight size={12} /></button>
        <Dropdown title="Mở rộng bộ kiểu" width={560} trigger={<span className="sr-only">Mở rộng</span>}>
          {(close) => (
            <div className="style-gallery-full">
              <MenuHeading>Tài liệu này</MenuHeading>
              <div className="style-grid">{sets.filter((set) => set.id === current).map((set) => <StyleThumb key={set.id} set={set} active onClick={close} />)}</div>
              <MenuHeading>Tất cả bộ kiểu</MenuHeading>
              <div className="style-grid">{sets.map((set) => <StyleThumb key={set.id} set={set} active={current === set.id} onClick={() => { close(); pick(set); }} />)}</div>
              <MenuSeparator />
              <MenuItem icon={<RotateCcw size={14} />} label="Đặt lại về kiểu mặc định" onClick={() => { close(); setPage(resetDesignPatch()); }} />
              <MenuItem icon={<Star size={14} />} label="Lưu thành bộ kiểu mới…" onClick={() => { close(); void saveNew(); }} />
            </div>
          )}
        </Dropdown>
      </div>
    </div>
  );
}

function ThemesMenu() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const palettes = allPalettes();
  const pairs = allFontPairs();
  return (
    <Dropdown large title="Chủ đề: màu và phông cho cả tài liệu" trigger={<><Palette size={22} color="#7c3aed" /><span>Chủ đề</span></>} width={400}>
      {(close) => (
        <>
          <div className="theme-grid">
            {THEMES.map((theme) => {
              const colors = palettes.find((p) => p.id === theme.colors) ?? palettes[0];
              const pair = pairs.find((p) => p.id === theme.fonts) ?? pairs[0];
              ensureFont(pair.heading);
              return (
                <button key={theme.id} type="button" className={`theme-tile ${page.themeId === theme.id ? 'on' : ''}`} title={`Chủ đề ${theme.label}`} onClick={() => { close(); setPage(themePatch(page, theme)); }}>
                  <span className="theme-sample" style={{ fontFamily: `"${pair.heading}", Arial, sans-serif`, color: colors.h1 }}>Aa</span>
                  <span className="swatch-row">{paletteSwatches(colors).map((color, i) => <i key={i} style={{ background: color }} />)}</span>
                  <small>{theme.label}</small>
                </button>
              );
            })}
          </div>
          <MenuSeparator />
          <MenuItem icon={<RotateCcw size={14} />} label="Đặt lại về chủ đề mặc định" onClick={() => { close(); setPage(resetDesignPatch()); }} />
        </>
      )}
    </Dropdown>
  );
}

function ColorsMenu() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  return (
    <Dropdown large title="Bảng màu cho tiêu đề và đề mục" trigger={<><Paintbrush size={22} color="#d97706" /><span>Màu</span></>} width={300}>
      {(close) => (
        <>
          {allPalettes().map((item) => <MenuItem key={item.id} active={page.colorsId === item.id} label={<span className="palette-row"><span className="swatch-row">{paletteSwatches(item).map((color, i) => <i key={i} style={{ background: color }} />)}</span>{item.label}</span>} onClick={() => { close(); setPage(palettePatch(page, item)); }} />)}
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chỉnh màu…" onClick={() => { close(); ctx.openDialog('themecolors'); }} />
        </>
      )}
    </Dropdown>
  );
}

function FontsMenu() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  return (
    <Dropdown large title="Cặp phông cho tiêu đề và nội dung" trigger={<><FileType size={22} color="#2b579a" /><span>Phông</span></>} width={300}>
      {(close) => (
        <>
          {allFontPairs().map((pair) => { ensureFont(pair.heading); ensureFont(pair.body); return (
            <MenuItem key={pair.id} active={page.fontsId === pair.id} label={<span className="font-pair-row"><strong style={{ fontFamily: `"${pair.heading}", Arial, sans-serif` }}>{pair.heading}</strong><small style={{ fontFamily: `"${pair.body}", Arial, sans-serif` }}>{pair.body} · {pair.label}</small></span>} onClick={() => { close(); setPage(fontPatch(page, pair)); }} />
          ); })}
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chỉnh phông…" onClick={() => { close(); ctx.openDialog('themefonts'); }} />
        </>
      )}
    </Dropdown>
  );
}

function SpacingMenu() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const custom = async () => {
    const normal = resolveStyles(page).normal;
    const res = await ctx.ui.ask({ title: 'Giãn đoạn tuỳ chỉnh', fields: [{ name: 'after', label: 'Sau đoạn (pt)', type: 'number', value: normal.after ?? 6, min: 0, max: 96 }, { name: 'line', label: 'Giãn dòng (bội số)', type: 'number', value: normal.line ?? 1.5, min: 1, max: 4 }], confirmText: 'Áp dụng' });
    if (res) setPage(spacingPatch(page, 'custom', Math.max(0, Number(res.after) || 0), Math.max(1, Number(res.line) || 1)));
  };
  return (
    <Dropdown title="Giãn đoạn cho toàn tài liệu" trigger={<><Rows3 size={14} /><span>Giãn đoạn</span></>} width={280}>
      {(close) => (
        <>
          {SPACING_PRESETS.map((item) => <MenuItem key={item.id} active={page.spacingId === item.id} label={<span><strong>{item.label}</strong><br /><small>{item.detail}</small></span>} onClick={() => { close(); setPage(spacingPatch(page, item.id, item.after, item.line)); }} />)}
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Giãn đoạn tuỳ chỉnh…" onClick={() => { close(); void custom(); }} />
        </>
      )}
    </Dropdown>
  );
}

export function DesignTab() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  const setDefault = async () => {
    const res = await ctx.ui.ask({ title: 'Đặt làm mặc định', message: 'Các tài liệu mới sẽ dùng khổ giấy, lề, chủ đề, phông, màu và giãn đoạn hiện tại. Tài liệu đã có không đổi.', fields: [{ name: 'action', label: 'Thao tác', type: 'select', value: 'save', options: [{ value: 'save', label: 'Dùng thiết lập hiện tại cho tài liệu mới' }, { value: 'clear', label: 'Xoá thiết lập mặc định đã lưu' }] }], confirmText: 'Áp dụng' });
    if (!res) return;
    if (res.action === 'clear') {
      clearDefaultPage();
      return ctx.ui.toast('Đã xoá thiết lập mặc định');
    }
    ctx.ui.toast(saveAsDefaultPage(page) ? 'Tài liệu mới sẽ dùng thiết lập này' : 'Không lưu được trên máy này', !saveAsDefaultPage(page));
  };
  return (
    <>
      <Group label="Định dạng tài liệu">
        <ThemesMenu />
        <StyleGallery />
        <ColorsMenu />
        <FontsMenu />
        <Rows>
          <SpacingMenu />
          <Dropdown title="Hiệu ứng cho ảnh và hộp chữ" trigger={<><Sparkles size={14} /><span>Hiệu ứng</span></>} width={260}>
            {(close) => EFFECTS.map((item) => <MenuItem key={item.id} active={(page.effect ?? 'none') === item.id} label={<span><strong>{item.label}</strong><br /><small>{item.detail}</small></span>} onClick={() => { close(); setPage({ effect: item.id === 'none' ? undefined : item.id }); }} />)}
          </Dropdown>
          <Small icon={<Star size={14} />} label="Đặt làm mặc định" title="Dùng thiết lập hiện tại cho các tài liệu mới" onClick={() => void setDefault()} />
        </Rows>
      </Group>
      <Group label="Nền trang">
        <Dropdown large title="Hình mờ" trigger={<><Stamp size={22} color="#586071" /><span>Hình mờ</span></>} width={300}>
          {(close) => (
            <>
              <div className="watermark-grid">
                {WATERMARKS.map((w) => <button key={w} type="button" className={`watermark-tile ${page.watermark === w ? 'on' : ''}`} title={`Hình mờ ${w}`} onClick={() => { close(); setPage({ watermark: w, watermarkOptions: undefined }); }}><span>{w}</span></button>)}
              </div>
              <MenuSeparator />
              <MenuItem icon={<Settings2 size={14} />} label="Hình mờ tuỳ chỉnh…" onClick={() => { close(); ctx.openDialog('watermark'); }} />
              <MenuItem label="Xoá hình mờ" onClick={() => { close(); setPage({ watermark: '', watermarkOptions: undefined }); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Màu trang" trigger={<><Droplets size={22} color="#0891b2" /><span>Màu trang</span></>}>
          {(close) => (
            <div className="color-menu">
              <button type="button" className="ribbon-menu-item" onClick={() => { close(); setPage({ pageColor: '' }); }}>Không màu (trắng)</button>
              <div className="color-grid">
                {['#ffffff', '#faf8f5', '#fdf6e3', '#f3f4f6', '#eef6ff', '#f0fdf4', '#fff7ed', '#fdf2f8', '#fefce8', '#ecfeff', ...THEME_COLORS.slice(20, 40)].map((color) => (
                  <button key={color} type="button" className="color-swatch" title={color} aria-label={color} style={{ background: color }} onClick={() => { close(); setPage({ pageColor: color }); }} />
                ))}
              </div>
              <label className="ribbon-menu-item custom-color"><span>Màu khác…</span><input type="color" value={page.pageColor || '#ffffff'} onChange={(e) => setPage({ pageColor: e.target.value })} /></label>
            </div>
          )}
        </Dropdown>
        <Big icon={<Frame size={22} color="#586071" />} label="Viền trang" title="Kiểu, màu và độ dày viền trang" onClick={() => ctx.openDialog('pageborders')} />
      </Group>
    </>
  );
}

export function Spinner({ label, icon, value, step, min, max, unit, onCommit }: { label: string; icon: ReactNode; value: number; step: number; min: number; max: number; unit: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const clamp = (next: number) => Math.max(min, Math.min(max, Math.round(next * 100) / 100));
  const commit = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft.replace(',', '.'));
    setDraft(null);
    if (Number.isFinite(parsed)) onCommit(clamp(parsed));
  };
  return (
    <label className="layout-spinner" title={`${label} (${unit})`}>
      <span className="spinner-label">{icon}{label}</span>
      <span className="spinner-box">
        <input aria-label={`${label} (${unit})`} value={draft ?? `${text} ${unit}`} onFocus={(e) => { setDraft(text); requestAnimationFrame(() => e.target.select()); }} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); } if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const base = parseFloat((draft ?? text).replace(',', '.')); const next = clamp((Number.isFinite(base) ? base : value) + (e.key === 'ArrowUp' ? step : -step)); setDraft(next.toLocaleString('vi-VN', { maximumFractionDigits: 2 })); onCommit(next); } }} />
        <span className="spinner-arrows">
          <button type="button" tabIndex={-1} aria-label={`Tăng ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onCommit(clamp(value + step))}><ChevronDown size={10} className="flip" /></button>
          <button type="button" tabIndex={-1} aria-label={`Giảm ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onCommit(clamp(value - step))}><ChevronDown size={10} /></button>
        </span>
      </span>
    </label>
  );
}

function ParagraphGroup() {
  const ctx = useDoc();
  const { editor, page } = ctx;
  const styles = resolveStyles(page);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const attrs = e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph');
      const def = styles[activeStyleId(e)] ?? styles.normal;
      return {
        left: (Number(attrs.indent) || 0) * 48 / CM,
        right: (Number(attrs.indentRight) || 0) / CM,
        beforeAttr: attrs.spaceBefore ?? null,
        afterAttr: attrs.spaceAfter ?? null,
        before: Number(attrs.spaceBefore ?? def.before ?? 0),
        after: Number(attrs.spaceAfter ?? def.after ?? 0),
      };
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  return (
    <Group label="Đoạn văn" onLauncher={() => ctx.openDialog('paragraph')} launcherTitle="Hộp thoại Đoạn văn">
      <div className="spinner-column">
        <span className="spinner-head">Thụt lề</span>
        <Spinner label="Trái" icon={<PilcrowLeft size={12} />} value={Math.round(state.left * 100) / 100} step={0.25} min={0} max={20} unit="cm" onCommit={(value) => editor.chain().setParagraphIndent({ left: value * CM }).run()} />
        <Spinner label="Phải" icon={<PilcrowLeft size={12} className="mirror" />} value={Math.round(state.right * 100) / 100} step={0.25} min={0} max={20} unit="cm" onCommit={(value) => editor.chain().setParagraphIndent({ right: value * CM }).run()} />
      </div>
      <div className="spinner-column">
        <span className="spinner-head">Giãn cách</span>
        <Spinner label="Trước" icon={<ArrowUpToLine size={12} />} value={state.before} step={6} min={0} max={200} unit="pt" onCommit={(value) => editor.chain().setParagraphSpacing(value, state.afterAttr as number | null).run()} />
        <Spinner label="Sau" icon={<ArrowDownToLine size={12} />} value={state.after} step={6} min={0} max={200} unit="pt" onCommit={(value) => editor.chain().setParagraphSpacing(state.beforeAttr as number | null, value).run()} />
      </div>
    </Group>
  );
}

function BreaksMenu() {
  const { editor } = useDoc();
  return (
    <Dropdown title="Ngắt trang, cột và phần" trigger={<><ScissorsLineDashed size={14} /><span>Ngắt</span></>} width={290}>
      {(close) => (
        <>
          <MenuHeading>Ngắt trang</MenuHeading>
          {PAGE_BREAKS.map((item) => <MenuItem key={item.kind} label={<span><strong>{item.label}</strong><br /><small>{item.detail}</small></span>} onClick={() => { close(); insertBreak(editor, item.kind); }} />)}
          <MenuHeading>Ngắt phần</MenuHeading>
          {SECTION_BREAKS.map((item) => <MenuItem key={item.kind} label={<span><strong>{item.label}</strong><br /><small>{item.detail}</small></span>} onClick={() => { close(); insertBreak(editor, item.kind); }} />)}
        </>
      )}
    </Dropdown>
  );
}

function LineNumbersMenu() {
  const ctx = useDoc();
  const { page, setPage, editor } = ctx;
  const mode = page.lineNumbers ? page.lineNumberMode ?? 'continuous' : 'none';
  const suppressed = Boolean(editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').noLineNumbers);
  return (
    <Dropdown title="Số dòng bên lề" trigger={<><Hash size={14} /><span>Số dòng</span></>} width={270}>
      {(close) => (
        <>
          <MenuItem label="Không" active={mode === 'none'} onClick={() => { close(); setPage({ lineNumbers: false }); }} />
          <MenuItem label="Liên tục" active={mode === 'continuous'} onClick={() => { close(); setPage({ lineNumbers: true, lineNumberMode: 'continuous' }); }} />
          <MenuItem label="Đánh lại mỗi trang" active={mode === 'page'} onClick={() => { close(); setPage({ lineNumbers: true, lineNumberMode: 'page' }); }} />
          <MenuItem label="Đánh lại mỗi phần" active={mode === 'section'} onClick={() => { close(); setPage({ lineNumbers: true, lineNumberMode: 'section' }); }} />
          <MenuSeparator />
          <MenuItem label="Bỏ số dòng ở đoạn hiện tại" active={suppressed} onClick={() => { close(); editor.chain().focus().setParagraphAttrs({ noLineNumbers: !suppressed }).run(); }} />
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chọn số dòng…" onClick={() => { close(); ctx.openDialog('linenumbers'); }} />
        </>
      )}
    </Dropdown>
  );
}

function HyphenationMenu() {
  const ctx = useDoc();
  const { page, setPage, editor } = ctx;
  const mode = page.hyphenMode ?? (page.hyphenate ? 'auto' : 'none');
  const manual = () => {
    setPage({ hyphenMode: 'manual', hyphenate: false });
    editor.chain().focus().insertContent('­').run();
    ctx.ui.toast('Đã đặt điểm ngắt từ tại con trỏ. Từ chỉ tách ở điểm này khi chạm cuối dòng.');
  };
  const options = async () => {
    const res = await ctx.ui.ask({ title: 'Tuỳ chọn ngắt từ', message: 'Trình duyệt chỉ tự ngắt từ với ngôn ngữ có từ điển, chưa gồm tiếng Việt. Với tiếng Việt hãy đặt điểm ngắt thủ công.', fields: [{ name: 'mode', label: 'Chế độ', type: 'select', value: mode, options: [{ value: 'none', label: 'Không ngắt từ' }, { value: 'auto', label: 'Tự động' }, { value: 'manual', label: 'Chỉ tại điểm ngắt đã đặt' }] }, { name: 'clear', label: 'Xoá toàn bộ điểm ngắt đã đặt trong tài liệu', type: 'checkbox', value: false }], confirmText: 'Áp dụng' });
    if (!res) return;
    const next = res.mode as 'none' | 'auto' | 'manual';
    setPage({ hyphenMode: next, hyphenate: next === 'auto' });
    if (res.clear) {
      const tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text?.includes('­')) return;
        for (let i = node.text.length - 1; i >= 0; i--) if (node.text[i] === '­') tr.delete(pos + i, pos + i + 1);
      });
      if (tr.docChanged) editor.view.dispatch(tr);
    }
  };
  return (
    <Dropdown title="Ngắt từ cuối dòng" trigger={<><Languages size={14} /><span>Ngắt từ</span></>}>
      {(close) => (
        <>
          <MenuItem label="Không" active={mode === 'none'} onClick={() => { close(); setPage({ hyphenMode: 'none', hyphenate: false }); }} />
          <MenuItem label="Tự động" active={mode === 'auto'} onClick={() => { close(); setPage({ hyphenMode: 'auto', hyphenate: true }); }} />
          <MenuItem label="Thủ công: đặt điểm ngắt tại con trỏ" active={mode === 'manual'} onClick={() => { close(); manual(); }} />
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chọn ngắt từ…" onClick={() => { close(); void options(); }} />
        </>
      )}
    </Dropdown>
  );
}

function ColumnsMenu({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { page, setPage, editor } = ctx;
  return (
    <Dropdown large title="Chia cột" trigger={<><Columns2 size={22} color="#2b579a" /><span>Cột</span></>} width={250}>
      {(close) => (
        <>
          <MenuHeading>Cả tài liệu</MenuHeading>
          {[{ n: 1, label: 'Một cột' }, { n: 2, label: 'Hai cột' }, { n: 3, label: 'Ba cột' }].map((item) => <MenuItem key={item.n} label={item.label} active={(page.columns ?? 1) === item.n} onClick={() => { close(); setPage({ columns: item.n }); }} />)}
          <MenuHeading>Cột rộng hẹp cho đoạn chọn</MenuHeading>
          <MenuItem label="Trái: cột trái hẹp, cột phải rộng" onClick={() => { close(); insertSideColumns(ctx, 'left'); }} />
          <MenuItem label="Phải: cột trái rộng, cột phải hẹp" onClick={() => { close(); insertSideColumns(ctx, 'right'); }} />
          <MenuHeading>Chỉ đoạn đang chọn</MenuHeading>
          <MenuItem label="Chia đoạn chọn thành 2 cột" onClick={() => { close(); editor.chain().focus().wrapInColumns(2).run(); }} />
          <MenuItem label="Chia đoạn chọn thành 3 cột" onClick={() => { close(); editor.chain().focus().wrapInColumns(3).run(); }} />
          {fmt.inColumns && <MenuItem label="Bỏ chia cột đoạn này" onClick={() => { close(); editor.chain().focus().unwrapColumns().run(); }} />}
          <MenuSeparator />
          <MenuItem icon={<Settings2 size={14} />} label="Cột khác…" onClick={() => { close(); ctx.openDialog('columns'); }} />
        </>
      )}
    </Dropdown>
  );
}

function Guarded({ enabled, icon, label, title, children }: { enabled: boolean; icon: ReactNode; label: string; title: string; children: ReactNode }) {
  if (enabled) return <>{children}</>;
  return <Big icon={icon} label={<>{label}<ChevronDown size={10} className="dropdown-caret" /></>} title={`${title} (hãy chọn một ảnh trước)`} disabled onClick={() => undefined} />;
}

function ArrangeGroup({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { editor, view, setView } = ctx;
  const info = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const selected = selectedImage(e);
      return {
        wrap: selected ? wrapOf(selected.node.attrs) : 'inline',
        position: selected ? String(selected.node.attrs.position ?? '') : '',
        align: selected ? String(selected.node.attrs.align ?? '') : '',
        grouped: Boolean((selected?.node.attrs.groupItems as unknown[] | null | undefined)?.length),
        selectedImages: e.state.selection.empty ? 0 : imagesInSelection(e).length,
      };
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  const has = fmt.imageSelected;
  const off = '#9aa3b2';
  const canGroup = info.selectedImages >= 2;
  return (
    <Group label="Sắp xếp">
      <Guarded enabled={has} icon={<SquareDashed size={22} color={off} />} label="Vị trí" title="Đặt ảnh theo vị trí trên trang">
        <Dropdown large title="Đặt ảnh theo vị trí trên trang" trigger={<><SquareDashed size={22} color="#2b579a" /><span>Vị trí</span></>} width={240}>
          {(close) => (
            <>
              <MenuHeading>Cùng dòng với chữ</MenuHeading>
              <MenuItem label="Cùng dòng với chữ" active={info.wrap === 'inline'} onClick={() => { close(); setWrap(ctx, 'inline'); }} />
              <MenuHeading>Có chữ bao quanh</MenuHeading>
              <div className="position-grid">
                {POSITION_ROWS.flatMap((row) => POSITION_COLS.map((col) => {
                  const id = `${row}-${col}`;
                  return <button key={id} type="button" className={`position-cell ${info.position === id ? 'on' : ''}`} title={`Hàng ${ROW_LABELS[row]}, cột ${COL_LABELS[col]}`} aria-label={`Hàng ${ROW_LABELS[row]}, cột ${COL_LABELS[col]}`} onClick={() => { close(); placeImage(ctx, { h: col, v: row }, id); }}><span className={`pos-${row} pos-${col}`} /></button>;
                }))}
              </div>
              <MenuSeparator />
              <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chọn bố cục khác…" onClick={() => { close(); ctx.openDialog('wrapoptions'); }} />
            </>
          )}
        </Dropdown>
      </Guarded>
      <Guarded enabled={has} icon={<WrapText size={22} color={off} />} label="Bao chữ" title="Cách chữ bao quanh ảnh">
        <Dropdown large title="Cách chữ bao quanh ảnh" trigger={<><WrapText size={22} color="#2b579a" /><span>Bao chữ</span></>} width={230}>
          {(close) => (
            <>
              {WRAP_KINDS.map((kind) => <MenuItem key={kind} label={WRAP_LABELS[kind]} active={info.wrap === kind} onClick={() => { close(); setWrap(ctx, kind); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Settings2 size={14} />} label="Tuỳ chọn bố cục khác…" onClick={() => { close(); ctx.openDialog('wrapoptions'); }} />
            </>
          )}
        </Dropdown>
      </Guarded>
      <Guarded enabled={has} icon={<BringToFront size={22} color={off} />} label="Đưa lên" title="Đưa ảnh lên trên">
        <Dropdown large title="Đưa ảnh lên trên" trigger={<><BringToFront size={22} color="#2b579a" /><span>Đưa lên</span></>}>
          {(close) => (
            <>
              <MenuItem label="Đưa lên một lớp" onClick={() => { close(); zOrder(ctx, 'forward'); }} />
              <MenuItem label="Đưa lên trên cùng" onClick={() => { close(); zOrder(ctx, 'front'); }} />
              <MenuItem label="Đưa lên trước chữ" onClick={() => { close(); zOrder(ctx, 'frontText'); }} />
            </>
          )}
        </Dropdown>
      </Guarded>
      <Guarded enabled={has} icon={<SendToBack size={22} color={off} />} label="Đưa xuống" title="Đưa ảnh xuống dưới">
        <Dropdown large title="Đưa ảnh xuống dưới" trigger={<><SendToBack size={22} color="#2b579a" /><span>Đưa xuống</span></>}>
          {(close) => (
            <>
              <MenuItem label="Đưa xuống một lớp" onClick={() => { close(); zOrder(ctx, 'backward'); }} />
              <MenuItem label="Đưa xuống dưới cùng" onClick={() => { close(); zOrder(ctx, 'back'); }} />
              <MenuItem label="Đưa xuống sau chữ" onClick={() => { close(); zOrder(ctx, 'behindText'); }} />
            </>
          )}
        </Dropdown>
      </Guarded>
      <Big icon={<Layers size={22} color="#d97706" />} label="Ngăn chọn" title="Danh sách ảnh và hộp chữ trong tài liệu" active={view.sidePanel === 'selection'} onClick={() => setView({ sidePanel: view.sidePanel === 'selection' ? null : 'selection' })} />
      <Rows>
        {has ? (
          <Dropdown title="Căn ảnh theo lề" trigger={<><AlignStartHorizontal size={14} /><span>Căn</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<AlignStartVertical size={14} />} label="Căn trái" onClick={() => { close(); placeImage(ctx, { h: 'left' }); }} />
                <MenuItem icon={<AlignCenterVertical size={14} />} label="Căn giữa" onClick={() => { close(); placeImage(ctx, { h: 'center' }); }} />
                <MenuItem icon={<AlignEndVertical size={14} />} label="Căn phải" onClick={() => { close(); placeImage(ctx, { h: 'right' }); }} />
                <MenuSeparator />
                <MenuItem icon={<AlignStartHorizontal size={14} />} label="Căn trên" onClick={() => { close(); placeImage(ctx, { v: 'top' }); }} />
                <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Căn giữa dọc" onClick={() => { close(); placeImage(ctx, { v: 'middle' }); }} />
                <MenuItem icon={<AlignEndHorizontal size={14} />} label="Căn dưới" onClick={() => { close(); placeImage(ctx, { v: 'bottom' }); }} />
              </>
            )}
          </Dropdown>
        ) : <Small icon={<AlignStartHorizontal size={14} />} label="Căn" title="Căn ảnh theo lề (hãy chọn một ảnh trước)" disabled onClick={() => undefined} />}
        {canGroup || info.grouped ? (
          <Dropdown title="Nhóm ảnh" trigger={<><GroupIcon size={14} /><span>Nhóm</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<GroupIcon size={14} />} label="Nhóm các ảnh đang chọn" onClick={() => { close(); void groupImages(ctx); }} />
                <MenuItem icon={<Ungroup size={14} />} label="Tách nhóm" onClick={() => { close(); ungroupImage(ctx); }} />
              </>
            )}
          </Dropdown>
        ) : <Small icon={<GroupIcon size={14} />} label="Nhóm" title="Bôi chọn ít nhất 2 ảnh để nhóm, hoặc chọn một ảnh đã nhóm để tách" disabled onClick={() => undefined} />}
        {has ? (
          <Dropdown title="Xoay và lật ảnh" trigger={<><RotateCw size={14} /><span>Xoay</span></>}>
            {(close) => (
              <>
                <MenuItem icon={<RotateCw size={14} />} label="Xoay phải 90°" onClick={() => { close(); rotateImage(ctx, 90); }} />
                <MenuItem icon={<RotateCcw size={14} />} label="Xoay trái 90°" onClick={() => { close(); rotateImage(ctx, -90); }} />
                <MenuItem icon={<FlipVertical size={14} />} label="Lật dọc" onClick={() => { close(); flipImage(ctx, 'flipV'); }} />
                <MenuItem icon={<FlipHorizontal size={14} />} label="Lật ngang" onClick={() => { close(); flipImage(ctx, 'flipH'); }} />
                <MenuSeparator />
                <MenuItem icon={<Settings2 size={14} />} label="Góc xoay khác…" onClick={() => { close(); void rotateCustom(ctx); }} />
              </>
            )}
          </Dropdown>
        ) : <Small icon={<RotateCw size={14} />} label="Xoay" title="Xoay và lật ảnh (hãy chọn một ảnh trước)" disabled onClick={() => undefined} />}
      </Rows>
    </Group>
  );
}

export function LayoutTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { page, setPage, editor } = ctx;
  const sizes = Object.keys(PAGE_SIZES) as PageSettings['size'][];
  const marginKey = (value: PageSettings['margins']) => JSON.stringify([value.top, value.right, value.bottom, value.left]);
  return (
    <>
      <Group label="Thiết lập trang" onLauncher={() => ctx.openDialog('pagesetup')} launcherTitle="Hộp thoại Thiết lập trang">
        <Dropdown large title="Lề trang" trigger={<><LayoutTemplate size={22} color="#2b579a" /><span>Lề</span></>} width={280}>
          {(close) => (
            <>
              {MARGINS.map((m) => <MenuItem key={m.id} label={<span><strong>{m.label}</strong><br /><small>{m.detail}</small></span>} active={marginKey(page.margins) === marginKey(m.value) && Boolean(page.mirrorMargins) === Boolean(m.mirror)} onClick={() => { close(); setPage({ margins: m.value, gutter: 0, mirrorMargins: Boolean(m.mirror) }); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Settings2 size={14} />} label="Lề tuỳ chỉnh…" onClick={() => { close(); ctx.openDialog('pagesetup'); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Hướng giấy" trigger={<>{page.orientation === 'portrait' ? <RectangleVertical size={22} color="#2b579a" /> : <RectangleHorizontal size={22} color="#2b579a" />}<span>Hướng</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<RectangleVertical size={14} />} label="Dọc" active={page.orientation === 'portrait'} onClick={() => { close(); setPage({ orientation: 'portrait' }); }} />
              <MenuItem icon={<RectangleHorizontal size={14} />} label="Ngang" active={page.orientation === 'landscape'} onClick={() => { close(); setPage({ orientation: 'landscape' }); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Khổ giấy" trigger={<><Square size={22} color="#2b579a" /><span>Khổ</span></>} width={250}>
          {(close) => (
            <>
              {sizes.map((size) => <MenuItem key={size} label={PAGE_SIZES[size].label} active={page.size === size} onClick={() => { close(); setPage({ size }); }} />)}
              <MenuSeparator />
              <MenuItem icon={<Settings2 size={14} />} label="Khổ giấy khác…" onClick={() => { close(); ctx.openDialog('pagesetup'); }} />
            </>
          )}
        </Dropdown>
        <ColumnsMenu fmt={fmt} />
        <Rows>
          <BreaksMenu />
          <LineNumbersMenu />
          <HyphenationMenu />
        </Rows>
        <Rows>
          <Small icon={<PanelTop size={14} />} label="Đầu/chân trang" title="Đầu trang, chân trang, số trang" onClick={() => ctx.openDialog('headerfooter')} />
          <Small icon={<Maximize size={14} />} label="Thiết lập trang…" title="Mở hộp thoại thiết lập trang" onClick={() => ctx.openDialog('pagesetup')} />
          <Small icon={<ScissorsLineDashed size={14} />} label="Sang trang trước đoạn" title="Luôn bắt đầu đoạn này ở trang mới" active={fmt.pageBreakBefore} onClick={() => editor.chain().focus().setParagraphAttrs({ pageBreakBefore: !fmt.pageBreakBefore }).run()} />
        </Rows>
      </Group>
      <ParagraphGroup />
      <ArrangeGroup fmt={fmt} />
      <Group label="Đoạn liền">
        <Small icon={<Shapes size={14} />} label="Giữ với đoạn sau" title="Không để đoạn này nằm cuối trang, tách khỏi đoạn kế" active={fmt.keepNext} onClick={() => editor.chain().focus().setParagraphAttrs({ keepNext: !fmt.keepNext }).run()} />
      </Group>
    </>
  );
}
