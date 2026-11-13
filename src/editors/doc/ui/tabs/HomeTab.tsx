import { ListTree, MousePointer2, PanelsTopLeft, SquareDashed, WandSparkles, AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ClipboardPaste, Copy, Eraser, Highlighter, Indent, Italic, List, ListOrdered, ListTodo, Mic, MicOff, Outdent, Paintbrush, Pilcrow, Quote, Replace, Scissors, Search, Sparkles, Strikethrough, Subscript, Superscript, TextSelect, Type, Underline, ArrowDownAZ, Code, Volume2, VolumeX, Baseline, PaintBucket, CaseSensitive, ChevronDown, ChevronUp, Pencil, Plus, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { FONT_SIZES } from '../../extensions';
import { changeCase, copySelection, pastePlainText, pasteRich, sortParagraphs } from '../../actions';
import { BUILTIN_STYLE_ORDER, activeStyleId, applyDocStyle, resolveStyles, styleSample } from '../../docStyles';
import FontPicker from '../FontPicker';
import ComboBox from '../../../../components/ComboBox';
import { TipsRibbonButton } from '../../../../components/tips/TipsPane';
import { DocFeatureMenu } from './DocFeatures';
import { MULTILEVEL_LISTS, PARAGRAPH_BORDERS, TEXT_EFFECTS, UNDERLINE_STYLES, changeListLevel, selectNextObject, selectionPane, setMultilevel, setParagraphBorder, setTextEffect, setUnderline } from '../../homeExtras';
import { Big, ColorPicker, Dropdown, Group, MenuItem, MenuSeparator, Row, Rows, Small } from '../RibbonParts';

const BULLET_STYLES = [{ value: 'disc', label: '●  Chấm tròn' }, { value: 'circle', label: '○  Tròn rỗng' }, { value: 'square', label: '■  Vuông' }, { value: '–', label: '–  Gạch ngang' }, { value: '+', label: '+  Dấu cộng' }, { value: '✓', label: '✓  Dấu tích' }, { value: '»', label: '»  Mũi tên' }];
const NUMBER_STYLES = [{ value: 'decimal', label: '1. 2. 3.' }, { value: 'decimal-leading-zero', label: '01. 02. 03.' }, { value: 'lower-alpha', label: 'a. b. c.' }, { value: 'upper-alpha', label: 'A. B. C.' }, { value: 'lower-roman', label: 'i. ii. iii.' }, { value: 'upper-roman', label: 'I. II. III.' }];

const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];

export default function HomeTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const chain = () => editor.chain().focus();
  const setList = (type: 'bulletList' | 'orderedList', listStyle: string) => {
    if (editor.isActive(type)) chain().updateAttributes(type, { listStyle }).run();
    else if (type === 'bulletList') chain().toggleBulletList().updateAttributes(type, { listStyle }).run();
    else chain().toggleOrderedList().updateAttributes(type, { listStyle }).run();
  };
  const styles = resolveStyles(ctx.page);
  const styleIds = [...BUILTIN_STYLE_ORDER, ...Object.keys(styles).filter((id) => !(BUILTIN_STYLE_ORDER as readonly string[]).includes(id))];
  const editStyle = (id: string) => {
    ctx.setEditingStyle(id);
    ctx.openDialog('style');
  };
  const updateStyleFromSelection = () => {
    const id = activeStyleId(editor);
    const text = editor.getAttributes('textStyle');
    const para = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph');
    const size = parseFloat(String(text.fontSize ?? ''));
    ctx.setPage({ styles: { ...(ctx.page.styles ?? {}), [id]: { ...styles[id], ...(text.fontFamily ? { font: String(text.fontFamily).split(',')[0].replaceAll(/["']/g, '') } : {}), ...(size ? { size: String(text.fontSize).endsWith('px') ? size * 0.75 : size } : {}), ...(text.color ? { color: String(text.color) } : {}), ...(para.textAlign ? { align: String(para.textAlign) } : {}), ...(para.lineHeight ? { line: Number(para.lineHeight) } : {}), bold: editor.isActive('bold') || styles[id]?.bold, italic: editor.isActive('italic') || styles[id]?.italic } } });
    ctx.ui.toast(`Đã cập nhật kiểu ${styles[id]?.name ?? id} theo đoạn đang chọn`);
  };
  return (
    <>
      <Group label="Hoàn tác">
        <Rows>
          <Small icon={<Undo2 size={14} color="#2b579a" />} label="Hoàn tác" title="Hoàn tác thao tác vừa làm (Ctrl+Z)" disabled={!fmt.canUndo} onClick={() => chain().undo().run()} />
          <Small icon={<Redo2 size={14} color="#2b579a" />} label="Làm lại" title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)" disabled={!fmt.canRedo} onClick={() => chain().redo().run()} />
        </Rows>
      </Group>

      <Group label="Clipboard">
        <Dropdown large title="Dán (Ctrl+V)" trigger={<><ClipboardPaste size={22} color="#2b579a" /><span>Dán</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<ClipboardPaste size={14} />} label="Dán giữ định dạng" hint="Ctrl+V" onClick={() => { close(); void pasteRich(ctx); }} />
              <MenuItem icon={<Type size={14} />} label="Dán chỉ lấy chữ" hint="Ctrl+Shift+V" onClick={() => { close(); void pastePlainText(ctx); }} />
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<Scissors size={14} />} label="Cắt" title="Cắt (Ctrl+X)" onClick={() => copySelection(ctx, true)} />
          <Small icon={<Copy size={14} />} label="Sao chép" title="Sao chép (Ctrl+C)" onClick={() => copySelection(ctx, false)} />
          <Small icon={<Paintbrush size={14} />} label="Chổi định dạng" title="Sao chép định dạng rồi bôi lên đoạn khác (Ctrl+Shift+C)" active={ctx.formatPainter.active} onClick={ctx.formatPainter.toggle} />
        </Rows>
      </Group>

      <Group label="Phông chữ" onLauncher={() => ctx.openDialog('font')} launcherTitle="Hộp thoại Phông chữ (Ctrl+D)">
        <Rows>
          <Row>
            <FontPicker value={fmt.fontFamily || ctx.page.fontFamily || 'Arial'} onPick={(font) => chain().setFontFamily(font).run()} onError={(message) => ctx.ui.toast(message, true)} />
            <ComboBox variant="ribbon" width={54} label="Cỡ chữ" value={fmt.fontSize || String(ctx.page.fontSize ?? 12)} options={FONT_SIZES} numeric={{ min: 1, max: 1638 }} onCommit={(size) => chain().setFontSize(`${size}pt`).run()} />
            <Small icon={<span className="grow-icon">A<ChevronUp size={9} strokeWidth={3} /></span>} title="Tăng cỡ chữ (Ctrl+])" onClick={() => editor.chain().focus().stepFontSize(1, ctx.page.fontSize).run()} />
            <Small icon={<span className="grow-icon small">A<ChevronDown size={9} strokeWidth={3} /></span>} title="Giảm cỡ chữ (Ctrl+[)" onClick={() => editor.chain().focus().stepFontSize(-1, ctx.page.fontSize).run()} />
            <Dropdown title="Đổi kiểu chữ hoa/thường" trigger={<CaseSensitive size={15} />}>
              {(close) => (
                <>
                  <MenuItem label="Viết hoa đầu câu." onClick={() => { close(); changeCase(ctx, 'sentence'); }} />
                  <MenuItem label="chữ thường" onClick={() => { close(); changeCase(ctx, 'lower'); }} />
                  <MenuItem label="CHỮ IN HOA" onClick={() => { close(); changeCase(ctx, 'upper'); }} />
                  <MenuItem label="Viết Hoa Mỗi Từ" onClick={() => { close(); changeCase(ctx, 'title'); }} />
                  <MenuItem label="đẢO cHỮ hOA" onClick={() => { close(); changeCase(ctx, 'toggle'); }} />
                </>
              )}
            </Dropdown>
            <Small icon={<Eraser size={14} />} title="Xoá định dạng (Ctrl+\)" onClick={() => chain().unsetAllMarks().clearNodes().run()} />
          </Row>
          <Row>
            <Small icon={<Bold size={14} />} title="Đậm (Ctrl+B)" active={fmt.bold} onClick={() => chain().toggleBold().run()} />
            <Small icon={<Italic size={14} />} title="Nghiêng (Ctrl+I)" active={fmt.italic} onClick={() => chain().toggleItalic().run()} />
            <Small icon={<Underline size={14} />} title="Gạch chân (Ctrl+U)" active={fmt.underline} onClick={() => chain().toggleUnderline().run()} />
            <Dropdown title="Kiểu gạch chân" trigger={<span className="sr-only">Kiểu gạch chân</span>}>
              {(close) => <>{UNDERLINE_STYLES.map((item) => <MenuItem key={item.id} label={<span style={{ textDecoration: `underline ${item.id}` }}>{item.label}</span>} onClick={() => { close(); setUnderline(ctx, item.id); }} />)}<MenuSeparator /><MenuItem label="Màu và kiểu khác…" onClick={() => { close(); ctx.openDialog('font'); }} /></>}
            </Dropdown>
            <Small icon={<Strikethrough size={14} />} title="Gạch ngang (Ctrl+Shift+X)" active={fmt.strike} onClick={() => chain().toggleStrike().run()} />
            <Small icon={<Subscript size={14} />} title="Chỉ số dưới (Ctrl+,)" active={fmt.subscript} onClick={() => chain().toggleSubscript().run()} />
            <Small icon={<Superscript size={14} />} title="Chỉ số trên (Ctrl+.)" active={fmt.superscript} onClick={() => chain().toggleSuperscript().run()} />
            <Small icon={<Code size={14} />} title="Mã nội dòng (Ctrl+E)" active={fmt.code} onClick={() => chain().toggleCode().run()} />
            <Dropdown title="Hiệu ứng chữ" trigger={<WandSparkles size={14} />}>
              {(close) => TEXT_EFFECTS.map((item) => <MenuItem key={item.id} label={<span style={{ textShadow: item.shadow ?? undefined }}>{item.label}</span>} onClick={() => { close(); setTextEffect(ctx, item.shadow); }} />)}
            </Dropdown>
            <ColorPicker title="Màu tô sáng chữ" icon={<Highlighter size={14} />} swatch={fmt.highlight || '#fff59d'} noneLabel="Không tô" onPick={(color) => (color ? chain().setHighlight({ color }).run() : chain().unsetHighlight().run())} />
            <ColorPicker title="Màu chữ" icon={<Baseline size={14} />} swatch={fmt.color || '#d7473c'} noneLabel="Tự động (đen)" onPick={(color) => (color ? chain().setColor(color).run() : chain().unsetColor().run())} />
          </Row>
        </Rows>
      </Group>

      <Group label="Đoạn văn" onLauncher={() => ctx.openDialog('paragraph')} launcherTitle="Hộp thoại Đoạn văn">
        <Rows>
          <Row>
            <Small icon={<List size={14} />} title="Dấu đầu dòng" active={fmt.bulletList} onClick={() => chain().toggleBulletList().run()} />
            <Dropdown title="Kiểu dấu đầu dòng" trigger={<span className="sr-only">Kiểu dấu đầu dòng</span>}>
              {(close) => BULLET_STYLES.map((item) => <MenuItem key={item.value} label={item.label} onClick={() => { close(); setList('bulletList', item.value); }} />)}
            </Dropdown>
            <Small icon={<ListOrdered size={14} />} title="Đánh số" active={fmt.orderedList} onClick={() => chain().toggleOrderedList().run()} />
            <Dropdown title="Kiểu đánh số" trigger={<span className="sr-only">Kiểu đánh số</span>}>
              {(close) => NUMBER_STYLES.map((item) => <MenuItem key={item.value} label={item.label} onClick={() => { close(); setList('orderedList', item.value); }} />)}
            </Dropdown>
            <Dropdown title="Danh sách nhiều cấp" trigger={<ListTree size={14} />} width={260}>
              {(close) => <>
                {MULTILEVEL_LISTS.map((item) => <MenuItem key={item.id} label={item.label} onClick={() => { close(); setMultilevel(ctx, item.id); }} />)}
                <MenuSeparator />
                <MenuItem label="Xuống một cấp (Tab)" onClick={() => { close(); changeListLevel(ctx, true); }} />
                <MenuItem label="Lên một cấp (Shift+Tab)" onClick={() => { close(); changeListLevel(ctx, false); }} />
              </>}
            </Dropdown>
            <Small icon={<ListTodo size={14} />} title="Danh sách việc cần làm" active={fmt.taskList} onClick={() => chain().toggleTaskList().run()} />
            <Small icon={<Outdent size={14} />} title="Giảm thụt lề (Shift+Tab)" onClick={() => chain().decreaseIndent().run()} />
            <Small icon={<Indent size={14} />} title="Tăng thụt lề (Tab)" onClick={() => chain().increaseIndent().run()} />
            <Small icon={<ArrowDownAZ size={14} />} title="Sắp xếp A→Z" onClick={() => void sortParagraphs(ctx)} />
            <Small icon={<Pilcrow size={14} />} title="Hiện/ẩn ký hiệu định dạng (Ctrl+*)" active={ctx.view.showMarks} onClick={() => ctx.setView({ showMarks: !ctx.view.showMarks })} />
          </Row>
          <Row>
            <Small icon={<AlignLeft size={14} />} title="Căn trái (Ctrl+L)" active={fmt.align === 'left'} onClick={() => chain().setTextAlign('left').run()} />
            <Small icon={<AlignCenter size={14} />} title="Căn giữa (Ctrl+E)" active={fmt.align === 'center'} onClick={() => chain().setTextAlign('center').run()} />
            <Small icon={<AlignRight size={14} />} title="Căn phải (Ctrl+R)" active={fmt.align === 'right'} onClick={() => chain().setTextAlign('right').run()} />
            <Small icon={<AlignJustify size={14} />} title="Căn đều (Ctrl+J)" active={fmt.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()} />
            <Dropdown title="Giãn dòng và đoạn" trigger={<span className="spacing-icon">↕</span>}>
              {(close) => (
                <>
                  {LINE_SPACINGS.map((value) => <MenuItem key={value} label={value.toFixed(value % 1 ? 2 : 1).replace(/0$/, '')} active={fmt.lineHeight === value} onClick={() => { close(); chain().setLineHeight(value).run(); }} />)}
                  <MenuSeparator />
                  <MenuItem label="Thêm khoảng trước đoạn" onClick={() => { close(); chain().setParagraphSpacing(12, null).run(); }} />
                  <MenuItem label="Bỏ khoảng sau đoạn" onClick={() => { close(); chain().setParagraphSpacing(null, 0).run(); }} />
                  <MenuItem label="Tuỳ chọn giãn dòng…" onClick={() => { close(); ctx.openDialog('paragraph'); }} />
                </>
              )}
            </Dropdown>
            <ColorPicker title="Tô nền đoạn chọn" icon={<PaintBucket size={14} />} swatch="#e0f2fe" noneLabel="Không tô nền" onPick={(color) => (color ? chain().setBackgroundColor(color).run() : chain().unsetBackgroundColor().run())} />
            <Dropdown title="Viền đoạn văn" trigger={<SquareDashed size={14} />}>
              {(close) => <>{PARAGRAPH_BORDERS.map((item) => <MenuItem key={item.id || 'none'} label={item.label} onClick={() => { close(); setParagraphBorder(ctx, item.id); }} />)}<MenuSeparator /><MenuItem label="Viền và tô nền…" onClick={() => { close(); ctx.openDialog('paragraph'); }} /></>}
            </Dropdown>
            <Small icon={<Quote size={14} />} title="Trích dẫn" active={fmt.blockquote} onClick={() => chain().toggleBlockquote().run()} />
          </Row>
        </Rows>
      </Group>

      <Group label="Kiểu">
        <div className="styles-gallery-container">
          {styleIds.map((id) => (
            <button key={id} type="button" className={`styles-card ${fmt.styleId === id ? 'active' : ''}`} title={`Áp dụng kiểu ${styles[id].name}. Nhấp đúp để sửa kiểu.`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyDocStyle(editor, id)} onDoubleClick={() => editStyle(id)}>
              <span className="styles-card-sample" style={styleSample(styles[id])}>AaBbCc</span>
              <span className="styles-card-title">{styles[id].name}</span>
            </button>
          ))}
        </div>
        <Dropdown title="Quản lý kiểu" trigger={<ChevronDown size={14} />}>
          {(close) => (
            <>
              <MenuItem icon={<Pencil size={14} />} label={`Sửa kiểu ${styles[fmt.styleId]?.name ?? 'đang dùng'}…`} onClick={() => { close(); editStyle(fmt.styleId); }} />
              <MenuItem icon={<RefreshCw size={14} />} label="Cập nhật kiểu theo đoạn đang chọn" onClick={() => { close(); updateStyleFromSelection(); }} />
              <MenuItem icon={<Plus size={14} />} label="Tạo kiểu mới từ đoạn đang chọn…" onClick={() => { close(); editStyle('new'); }} />
              <MenuItem icon={<Eraser size={14} />} label="Xoá định dạng thủ công" onClick={() => { close(); chain().unsetAllMarks().run(); }} />
              <MenuSeparator />
              {styleIds.map((id) => <MenuItem key={id} label={<span style={styleSample(styles[id])}>{styles[id].name}</span>} active={fmt.styleId === id} onClick={() => { close(); applyDocStyle(editor, id); }} />)}
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Chỉnh sửa">
        <Rows>
          <Small icon={<Search size={14} />} label="Tìm" title="Tìm (Ctrl+F)" onClick={() => ctx.setView({ showFind: true, findReplace: false })} />
          <Small icon={<Replace size={14} />} label="Thay thế" title="Thay thế (Ctrl+H)" onClick={() => ctx.setView({ showFind: true, findReplace: true })} />
          <Dropdown title="Chọn" trigger={<><TextSelect size={14} /><span>Chọn</span></>}>
            {(close) => <>
              <MenuItem icon={<TextSelect size={14} />} label="Chọn tất cả" hint="Ctrl+A" onClick={() => { close(); chain().selectAll().run(); }} />
              <MenuItem icon={<MousePointer2 size={14} />} label="Chọn đối tượng" hint="ảnh, bảng, hộp chữ kế tiếp" onClick={() => { close(); selectNextObject(ctx); }} />
              <MenuItem icon={<PanelsTopLeft size={14} />} label="Ngăn chọn…" onClick={() => { close(); void selectionPane(ctx); }} />
            </>}
          </Dropdown>
        </Rows>
      </Group>

      <Group label="Giọng nói">
        <Rows>
          <Small icon={ctx.dictation.listening ? <MicOff size={14} color="#d7473c" /> : <Mic size={14} color="#2b579a" />} label="Đọc chính tả" title="Nhập văn bản bằng giọng nói tiếng Việt" active={ctx.dictation.listening} onClick={ctx.dictation.toggle} />
          <Small icon={ctx.readAloud.speaking ? <VolumeX size={14} color="#d7473c" /> : <Volume2 size={14} color="#2b579a" />} label="Đọc to" title="Đọc to đoạn chọn hoặc cả tài liệu" active={ctx.readAloud.speaking} onClick={ctx.readAloud.toggle} />
        </Rows>
      </Group>

      <Group label="Tính năng">
        <DocFeatureMenu />
      </Group>

      <Group label="Mẹo">
        <TipsRibbonButton className="ribbon-btn-large" />
      </Group>

      <Group label="Minh AI">
        <Big icon={<Sparkles size={20} color="#7c3aed" />} label="Minh AI" title="Viết lại, tóm tắt, dịch, viết tiếp bằng AI" onClick={() => ctx.openDialog('ai')} />
      </Group>
    </>
  );
}
