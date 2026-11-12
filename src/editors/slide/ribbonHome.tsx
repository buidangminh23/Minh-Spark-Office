import {
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowDownAZ, BetweenHorizontalStart, Brush, ClipboardPaste,
  Columns2, Columns3, Copy, Eraser, FileImage, FileType2, Highlighter, IndentDecrease, IndentIncrease, LayoutTemplate, List, ListOrdered,
  ListTree, Mic, MicOff, MousePointer2, PanelRightOpen, Pilcrow, RefreshCcw, Replace, Rows3, Scissors, Square, SquareDashedMousePointer,
  Strikethrough, TextCursorInput, Type, Undo2, Redo2, Rows2, Workflow, FolderPlus, FolderPen, FolderMinus, FolderX, ChevronsDownUp,
  ChevronsUpDown, Languages, FileOutput, Sparkles, PenLine, Puzzle,
} from 'lucide-react';
import type { SlideElement, SlideLayout } from '../../lib/slideTypes';
import {
  BULLET_STYLES, HIGHLIGHT_COLORS, LETTER_SPACING_OPTIONS, LINE_SPACING_OPTIONS, NUMBER_FORMATS, TEXT_CASE_OPTIONS, changeCase, clampIndent,
  clearTextFormatting, linesToSmartArt,
} from '../../lib/slideTextOps';
import { createSlideFromLayout } from '../../lib/slideTemplates';
import { remapSlideTheme, baseTheme } from '../../lib/slideThemeOps';
import { DropButton, MenuItem, MenuSeparator, MenuTitle, SwatchGrid } from './ribbonParts';
import { newElementId, useSlideExtras } from './slideExtrasContext';
import { TipsRibbonButton } from '../../components/tips/TipsPane';

const SIGNATURE_LINE = `______________________________
Người ký: `;

const TEXT_TYPES = new Set<SlideElement['type']>(['text', 'shape']);

export function ClipboardGroup({ canUndo, canRedo, onUndo, onRedo }: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void }) {
  const x = useSlideExtras();
  const hasSelection = x.selectedElements.length > 0;
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className="ppt-group-content">
        <DropButton large icon={<ClipboardPaste size={22} color="#D83B01" />} label="Dán" title="Dán (Ctrl+V)" onMain={() => void x.paste('keep')} menuWidth={250}>
          {(close) => (
            <>
              <MenuTitle>Tùy chọn dán</MenuTitle>
              <MenuItem icon={<ClipboardPaste size={14} />} label="Giữ định dạng nguồn" hint="K" onClick={() => { close(); void x.paste('keep'); }} />
              <MenuItem icon={<LayoutTemplate size={14} />} label="Dùng chủ đề đích" hint="H" onClick={() => { close(); void x.paste('destination'); }} />
              <MenuItem icon={<FileImage size={14} />} label="Dán thành hình ảnh" hint="U" onClick={() => { close(); void x.paste('picture'); }} />
              <MenuItem icon={<Type size={14} />} label="Chỉ giữ văn bản" hint="T" onClick={() => { close(); void x.paste('text'); }} />
            </>
          )}
        </DropButton>
        <div className="ppx-col ppx-col-tight">
          <button type="button" className="ppt-tool-btn ppx-labeled" disabled={!hasSelection} onClick={x.cut} title="Cắt (Ctrl+X)">
            <Scissors size={14} /> <span>Cắt</span>
          </button>
          <button type="button" className="ppt-tool-btn ppx-labeled" disabled={!hasSelection} onClick={x.copy} title="Sao chép (Ctrl+C)">
            <Copy size={14} /> <span>Sao chép</span>
          </button>
          <button
            type="button"
            className={`ppt-tool-btn ppx-labeled ${x.formatPainter !== 'off' ? 'is-active' : ''}`}
            disabled={!x.selectedElement && x.formatPainter === 'off'}
            onClick={() => x.startFormatPainter(false)}
            onDoubleClick={() => x.startFormatPainter(true)}
            title="Sao chép định dạng (Ctrl+Shift+C). Bấm đúp để áp cho nhiều đối tượng."
          >
            <Brush size={14} /> <span>Sao định dạng</span>
          </button>
        </div>
        <div className="ppx-col ppx-col-tight">
          <button type="button" className="ppt-tool-btn" disabled={!canUndo} onClick={onUndo} title="Hoàn tác (Ctrl+Z)">
            <Undo2 size={15} />
          </button>
          <button type="button" className="ppt-tool-btn" disabled={!canRedo} onClick={onRedo} title="Làm lại (Ctrl+Y)">
            <Redo2 size={15} />
          </button>
        </div>
      </div>
      <div className="ppt-group-footer">Bộ nhớ tạm</div>
    </div>
  );
}

export function SlideGroupExtras() {
  const x = useSlideExtras();
  const resetSlide = () => {
    const slide = x.currentSlide;
    const fresh = createSlideFromLayout(slide.layout, x.activeSlideIndex, x.presentation.themeId);
    const themed = remapSlideTheme(fresh, baseTheme(x.presentation.themeId), x.theme);
    x.commit((p) => ({
      ...p,
      slides: p.slides.map((s, i) => {
        if (i !== x.activeSlideIndex) return s;
        const placeholders = themed.elements;
        const elements = s.elements.map((el, index) => {
          const ref = placeholders.find((ph) => ph.isTitle === el.isTitle && ph.type === el.type) ?? placeholders[index];
          if (!ref || el.type !== 'text') return el;
          return { ...el, x: ref.x, y: ref.y, width: ref.width, height: ref.height, fontFamily: ref.fontFamily, fontSize: ref.fontSize, color: ref.color, fontWeight: ref.fontWeight, textAlign: ref.textAlign };
        });
        return { ...s, elements, background: themed.background };
      }),
    }));
    x.toast('Đã đặt lại vị trí, kích cỡ và định dạng của các ô chữ theo bố cục');
  };
  const sections = x.presentation.sections ?? [];
  const sectionOfCurrent = sections.find((sec) => sec.id === x.currentSlide.sectionId);
  const addSection = () => {
    const id = `sec-${Date.now()}`;
    x.commit((p) => {
      const list = [...(p.sections ?? [])];
      list.push({ id, name: `Phần ${list.length + 1}` });
      return { ...p, sections: list, slides: p.slides.map((s, i) => (i >= x.activeSlideIndex && (!s.sectionId || s.sectionId === x.currentSlide.sectionId) ? { ...s, sectionId: id } : s)) };
    });
    x.toast('Đã thêm phần mới từ trang chiếu hiện tại');
  };
  const removeSection = (all: boolean) => {
    x.commit((p) => ({
      ...p,
      sections: all ? [] : (p.sections ?? []).filter((sec) => sec.id !== x.currentSlide.sectionId),
      slides: p.slides.map((s) => (all || s.sectionId === x.currentSlide.sectionId ? { ...s, sectionId: undefined } : s)),
    }));
  };
  const setCollapsed = (collapsed: boolean) => x.commit((p) => ({ ...p, sections: (p.sections ?? []).map((sec) => ({ ...sec, collapsed })) }));
  return (
    <div className="ppx-col ppx-col-tight">
      <button type="button" className="ppt-tool-btn ppx-labeled" onClick={resetSlide} title="Đặt lại vị trí, kích cỡ và định dạng của ô giữ chỗ về mặc định">
        <RefreshCcw size={14} /> <span>Đặt lại</span>
      </button>
      <DropButton icon={<ListTree size={14} />} label="Phần" title="Sắp xếp trang chiếu thành các phần" menuWidth={230}>
        {(close) => (
          <>
            <MenuItem icon={<FolderPlus size={14} />} label="Thêm phần" onClick={() => { close(); addSection(); }} />
            <MenuItem icon={<FolderPen size={14} />} label="Đổi tên phần…" disabled={!sectionOfCurrent} onClick={() => { close(); x.openDialog('section-rename'); }} />
            <MenuItem icon={<FolderMinus size={14} />} label="Xóa phần" disabled={!sectionOfCurrent} onClick={() => { close(); removeSection(false); }} />
            <MenuItem icon={<FolderX size={14} />} label="Xóa tất cả các phần" disabled={sections.length === 0} onClick={() => { close(); removeSection(true); }} />
            <MenuSeparator />
            <MenuItem icon={<ChevronsDownUp size={14} />} label="Thu gọn tất cả" disabled={sections.length === 0} onClick={() => { close(); setCollapsed(true); }} />
            <MenuItem icon={<ChevronsUpDown size={14} />} label="Bung rộng tất cả" disabled={sections.length === 0} onClick={() => { close(); setCollapsed(false); }} />
          </>
        )}
      </DropButton>
    </div>
  );
}

export function FontExtrasRow() {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const textual = Boolean(el && (TEXT_TYPES.has(el.type) || el.text !== undefined));
  return (
    <div className="ppx-row">
      <button type="button" className={`ppt-tool-btn ${el?.strikethrough ? 'is-active' : ''}`} disabled={!textual} onClick={() => x.updateSelected((item) => ({ strikethrough: !item.strikethrough }))} title="Gạch ngang chữ">
        <Strikethrough size={15} />
      </button>
      <DropButton icon={<BetweenHorizontalStart size={15} style={{ transform: 'rotate(90deg)' }} />} title="Giãn cách ký tự" disabled={!textual} menuWidth={180}>
        {(close) => (
          <>
            {LETTER_SPACING_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} label={label} hint={`${value > 0 ? '+' : ''}${value}pt`} active={(el?.letterSpacing ?? 0) === value} onClick={() => { close(); x.updateSelected({ letterSpacing: value || undefined }); }} />
            ))}
            <MenuSeparator />
            <MenuItem label="Tùy chọn khác…" onClick={() => { close(); x.openDialog('font'); }} />
          </>
        )}
      </DropButton>
      <DropButton icon={<ArrowDownAZ size={15} />} title="Đổi chữ hoa/thường (Shift+F3)" disabled={!textual} menuWidth={200}>
        {(close) => (
          <>
            {TEXT_CASE_OPTIONS.map(([mode, label]) => (
              <MenuItem key={mode} label={label} onClick={() => { close(); x.updateSelected((item) => ({ text: changeCase(item.text ?? '', mode) })); }} />
            ))}
          </>
        )}
      </DropButton>
      <DropButton icon={<Highlighter size={15} color={el?.highlight ?? '#CA8A04'} />} title="Màu tô sáng văn bản" disabled={!textual} menuWidth={150}>
        {(close) => <SwatchGrid colors={HIGHLIGHT_COLORS} columns={5} none="Không tô màu" onPick={(color) => { close(); x.updateSelected({ highlight: color }); }} />}
      </DropButton>
      <button type="button" className="ppt-tool-btn" disabled={!textual} onClick={() => x.updateSelected(clearTextFormatting())} title="Xóa toàn bộ định dạng chữ">
        <Eraser size={15} />
      </button>
    </div>
  );
}

const TEXT_DIRECTIONS: ReadonlyArray<readonly [NonNullable<SlideElement['textDirection']>, string]> = [
  ['horizontal', 'Ngang'],
  ['rotate-90', 'Xoay tất cả 90°'],
  ['rotate-270', 'Xoay tất cả 270°'],
  ['stacked', 'Xếp chồng'],
];

export function ParagraphExtrasRow() {
  const x = useSlideExtras();
  const el = x.selectedElement;
  const textual = Boolean(el && (TEXT_TYPES.has(el.type) || el.text !== undefined));
  const toSmartArt = (type: 'process' | 'cycle' | 'pyramid' | 'list' | 'matrix') => {
    if (!el?.text) return;
    const items = linesToSmartArt(el.text, [x.theme.primaryColor, x.theme.secondaryColor, x.theme.accentColor, x.theme.titleColor]);
    if (items.length === 0) return;
    x.commit((p) => ({
      ...p,
      slides: p.slides.map((s, i) => (i !== x.activeSlideIndex ? s : { ...s, elements: s.elements.map((item) => (item.id === el.id ? { ...item, type: 'smartart' as const, smartArtType: type, smartArtItems: items, text: undefined } : item)) })),
    }));
    x.toast('Đã chuyển văn bản thành SmartArt');
  };
  return (
    <div className="ppx-row">
      <DropButton icon={<List size={15} />} title="Dấu đầu dòng" disabled={!textual} active={el?.isBullet && el.bulletStyle !== 'number'} onMain={() => x.updateSelected((item) => ({ isBullet: !(item.isBullet && item.bulletStyle !== 'number'), bulletStyle: item.bulletStyle === 'number' ? 'disc' : item.bulletStyle ?? 'disc' }))} menuWidth={190}>
        {(close) => (
          <>
            <MenuItem label="Không có" onClick={() => { close(); x.updateSelected({ isBullet: false }); }} />
            {BULLET_STYLES.map(([style, glyph, label]) => (
              <MenuItem key={style} icon={<span style={{ fontSize: 13 }}>{glyph}</span>} label={label} active={el?.isBullet && el.bulletStyle === style} onClick={() => { close(); x.updateSelected({ isBullet: true, bulletStyle: style }); }} />
            ))}
          </>
        )}
      </DropButton>
      <DropButton icon={<ListOrdered size={15} />} title="Đánh số" disabled={!textual} active={el?.isBullet && el.bulletStyle === 'number'} onMain={() => x.updateSelected((item) => ({ isBullet: !(item.isBullet && item.bulletStyle === 'number'), bulletStyle: 'number' }))} menuWidth={180}>
        {(close) => (
          <>
            <MenuItem label="Không có" onClick={() => { close(); x.updateSelected({ isBullet: false }); }} />
            {NUMBER_FORMATS.map(([format, label]) => (
              <MenuItem key={format} label={label} active={el?.isBullet && el.bulletStyle === 'number' && (el.fieldFormat ?? '1.') === format} onClick={() => { close(); x.updateSelected({ isBullet: true, bulletStyle: 'number', fieldFormat: format }); }} />
            ))}
          </>
        )}
      </DropButton>
      <button type="button" className="ppt-tool-btn" disabled={!textual || !(el?.indentLevel)} onClick={() => x.updateSelected((item) => ({ indentLevel: clampIndent((item.indentLevel ?? 0) - 1) }))} title="Giảm mức thụt lề">
        <IndentDecrease size={15} />
      </button>
      <button type="button" className="ppt-tool-btn" disabled={!textual} onClick={() => x.updateSelected((item) => ({ indentLevel: clampIndent((item.indentLevel ?? 0) + 1) }))} title="Tăng mức thụt lề">
        <IndentIncrease size={15} />
      </button>
      <DropButton icon={<Rows3 size={15} />} title="Giãn dòng và đoạn" disabled={!textual} menuWidth={170}>
        {(close) => (
          <>
            {LINE_SPACING_OPTIONS.map((value) => (
              <MenuItem key={value} label={value.toFixed(value % 1 ? 2 : 1).replace('.', ',')} active={(el?.lineHeight ?? 1.4) === value} onClick={() => { close(); x.updateSelected({ lineHeight: value }); }} />
            ))}
            <MenuSeparator />
            <MenuItem icon={<Pilcrow size={14} />} label="Tùy chọn giãn dòng…" onClick={() => { close(); x.openDialog('paragraph'); }} />
          </>
        )}
      </DropButton>
      <DropButton icon={<TextCursorInput size={15} style={{ transform: 'rotate(90deg)' }} />} title="Hướng văn bản" disabled={!textual} menuWidth={180}>
        {(close) => (
          <>
            {TEXT_DIRECTIONS.map(([dir, label]) => (
              <MenuItem key={dir} label={label} active={(el?.textDirection ?? 'horizontal') === dir} onClick={() => { close(); x.updateSelected({ textDirection: dir === 'horizontal' ? undefined : dir }); }} />
            ))}
          </>
        )}
      </DropButton>
      <DropButton icon={<AlignVerticalJustifyCenter size={15} />} title="Căn văn bản theo chiều dọc" disabled={!textual} menuWidth={150}>
        {(close) => (
          <>
            <MenuItem icon={<AlignVerticalJustifyStart size={14} />} label="Trên" active={(el?.verticalAlign ?? 'top') === 'top'} onClick={() => { close(); x.updateSelected({ verticalAlign: 'top' }); }} />
            <MenuItem icon={<AlignVerticalJustifyCenter size={14} />} label="Giữa" active={el?.verticalAlign === 'middle'} onClick={() => { close(); x.updateSelected({ verticalAlign: 'middle' }); }} />
            <MenuItem icon={<AlignVerticalJustifyEnd size={14} />} label="Dưới" active={el?.verticalAlign === 'bottom'} onClick={() => { close(); x.updateSelected({ verticalAlign: 'bottom' }); }} />
          </>
        )}
      </DropButton>
      <DropButton icon={<Columns2 size={15} />} title="Chia cột văn bản" disabled={!textual} menuWidth={150}>
        {(close) => (
          <>
            <MenuItem icon={<Square size={14} />} label="Một cột" active={(el?.textColumns ?? 1) === 1} onClick={() => { close(); x.updateSelected({ textColumns: undefined }); }} />
            <MenuItem icon={<Columns2 size={14} />} label="Hai cột" active={el?.textColumns === 2} onClick={() => { close(); x.updateSelected({ textColumns: 2 }); }} />
            <MenuItem icon={<Columns3 size={14} />} label="Ba cột" active={el?.textColumns === 3} onClick={() => { close(); x.updateSelected({ textColumns: 3 }); }} />
          </>
        )}
      </DropButton>
      <DropButton icon={<Workflow size={15} />} title="Chuyển thành SmartArt" disabled={!el?.text} menuWidth={190}>
        {(close) => (
          <>
            <MenuTitle>Chuyển văn bản thành SmartArt</MenuTitle>
            <MenuItem label="Quy trình" onClick={() => { close(); toSmartArt('process'); }} />
            <MenuItem label="Vòng tuần hoàn" onClick={() => { close(); toSmartArt('cycle'); }} />
            <MenuItem label="Kim tự tháp" onClick={() => { close(); toSmartArt('pyramid'); }} />
            <MenuItem label="Danh sách" onClick={() => { close(); toSmartArt('list'); }} />
            <MenuItem label="Ma trận" onClick={() => { close(); toSmartArt('matrix'); }} />
          </>
        )}
      </DropButton>
    </div>
  );
}

export function EditingExtras({ onOpenFind }: { onOpenFind: () => void }) {
  const x = useSlideExtras();
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className="ppt-group-content ppx-col ppx-col-tight">
        <button type="button" className="ppt-tool-btn ppx-labeled" onClick={onOpenFind} title="Tìm và thay thế (Ctrl+H)">
          <Replace size={14} /> <span>Thay thế</span>
        </button>
        <button type="button" className="ppt-tool-btn ppx-labeled" onClick={() => x.openDialog('replace-fonts')} title="Thay một phông chữ bằng phông khác trong cả bài">
          <FileType2 size={14} /> <span>Thay phông</span>
        </button>
        <DropButton icon={<MousePointer2 size={14} />} label="Chọn" title="Chọn đối tượng" menuWidth={200}>
          {(close) => (
            <>
              <MenuItem icon={<SquareDashedMousePointer size={14} />} label="Chọn tất cả" hint="Ctrl+A" onClick={() => { close(); x.selectElements(x.currentSlide.elements.filter((e) => !e.hidden && !e.locked).map((e) => e.id)); }} />
              <MenuItem icon={<Rows2 size={14} />} label="Chọn các ô văn bản" onClick={() => { close(); x.selectElements(x.currentSlide.elements.filter((e) => e.type === 'text' && !e.hidden).map((e) => e.id)); }} />
              <MenuItem icon={<PanelRightOpen size={14} />} label="Ngăn chọn…" onClick={() => { close(); x.togglePane('selection'); }} />
            </>
          )}
        </DropButton>
      </div>
      <div className="ppt-group-footer">Chỉnh sửa</div>
    </div>
  );
}

export function VoiceGroup() {
  const x = useSlideExtras();
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className="ppt-group-content">
        <button type="button" className={`ppt-tool-btn-large ${x.dictating ? 'is-active' : ''}`} onClick={x.toggleDictation} title="Đọc chính tả: nói để nhập chữ vào ô đang chọn">
          {x.dictating ? <MicOff size={20} color="#DC2626" /> : <Mic size={20} color="#2563EB" />}
          <span>{x.dictating ? 'Dừng' : 'Đọc chính tả'}</span>
        </button>
      </div>
      <div className="ppt-group-footer">Giọng nói</div>
    </div>
  );
}

export function TipsGroup() {
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className="ppt-group-content">
        <TipsRibbonButton className="ppt-tool-btn-large" activeClass="is-active" />
      </div>
      <div className="ppt-group-footer">Mẹo</div>
    </div>
  );
}

export function HomeToolsGroup({ onOpenAi, onExportPdf, onAddSlide }: { onOpenAi: () => void; onExportPdf: () => void; onAddSlide: (layout: SlideLayout) => void }) {
  const x = useSlideExtras();
  return (
    <div className="ppt-ribbon-group ppx-group">
      <div className="ppt-group-content">
        <DropButton large icon={<LayoutTemplate size={20} color="#7C3AED" />} label="Mẫu" title="Chèn trang chiếu theo mẫu bố cục" menuWidth={220}>
          {(close) => (
            <>
              <MenuTitle>Trang chiếu theo mẫu</MenuTitle>
              {(['title', 'title-content', 'section', 'two-content', 'comparison', 'content-caption', 'picture-caption'] as SlideLayout[]).map((layout) => (
                <MenuItem key={layout} label={LAYOUT_NAMES[layout]} onClick={() => { close(); onAddSlide(layout); }} />
              ))}
            </>
          )}
        </DropButton>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('translate')} title="Dịch song song văn bản trong bài">
          <Languages size={20} color="#0284C7" />
          <span>Dịch</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={onOpenAi} title="Tạo trang chiếu bằng AI">
          <Sparkles size={20} color="#D83B01" />
          <span>AI tạo slide</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={onExportPdf} title="Tạo tệp PDF từ bài thuyết trình">
          <FileOutput size={20} color="#DC2626" />
          <span>Tạo PDF</span>
        </button>
        <button
          type="button"
          className="ppt-tool-btn-large"
          onClick={() => x.addElement(textElement({ x: 58, y: 74, width: 34, height: 14, text: SIGNATURE_LINE, fontSize: 16, textAlign: 'center', name: 'Dòng chữ ký' }, x.theme.bodyFont, x.theme.textColor))}
          title="Chèn dòng chữ ký vào trang"
        >
          <PenLine size={20} color="#059669" />
          <span>Ký tên</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={onOpenAi} title="Bổ trợ AI Claude/ChatGPT">
          <Puzzle size={20} color="#2563EB" />
          <span>Bổ trợ</span>
        </button>
      </div>
      <div className="ppt-group-footer">Công cụ</div>
    </div>
  );
}

export const LAYOUT_NAMES: Record<SlideLayout, string> = {
  title: 'Trang tiêu đề',
  'title-content': 'Tiêu đề & Nội dung',
  section: 'Tiêu đề mục',
  'two-content': 'Hai nội dung',
  comparison: 'So sánh',
  'title-only': 'Chỉ có tiêu đề',
  blank: 'Trống',
  'content-caption': 'Nội dung có chú thích',
  'picture-caption': 'Hình ảnh có chú thích',
};

export function textElement(overrides: Partial<SlideElement>, fontFamily: string, color: string): SlideElement {
  return {
    id: newElementId('text'),
    type: 'text',
    x: 30,
    y: 40,
    width: 40,
    height: 12,
    text: '',
    fontSize: 20,
    fontFamily,
    color,
    textAlign: 'left',
    ...overrides,
  };
}
