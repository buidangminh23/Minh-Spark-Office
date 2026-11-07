import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ClipboardPaste, Copy, Eraser, Highlighter, Indent, Italic, List, ListOrdered, ListTodo, Mic, MicOff, Outdent, Paintbrush, Pilcrow, Quote, Replace, Scissors, Search, Sparkles, Strikethrough, Subscript, Superscript, TextSelect, Type, Underline, ArrowDownAZ, Code, Volume2, VolumeX, Baseline, PaintBucket, CaseSensitive } from 'lucide-react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { FONT_SIZES } from '../../extensions';
import { changeCase, copySelection, paragraphSettings, pastePlainText, pasteRich, sortParagraphs } from '../../actions';
import FontPicker from '../FontPicker';
import { Big, ColorPicker, Dropdown, Group, MenuItem, MenuSeparator, Row, Rows, Small } from '../RibbonParts';

export const STYLES: { id: string; label: string; sample: React.CSSProperties; apply: (e: ReturnType<typeof useDoc>['editor']) => void; isActive: (f: FormatState) => boolean }[] = [
  { id: 'normal', label: 'Normal', sample: {}, apply: (e) => e.chain().focus().setParagraph().run(), isActive: (f) => !f.heading && !f.blockquote && !f.codeBlock },
  { id: 'title', label: 'Title', sample: { fontSize: 17, fontWeight: 300 }, apply: (e) => e.chain().focus().setHeading({ level: 1 }).setTextAlign('center').run(), isActive: () => false },
  { id: 'h1', label: 'Heading 1', sample: { fontWeight: 700, color: '#2b579a', fontSize: 14 }, apply: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (f) => f.heading === 1 },
  { id: 'h2', label: 'Heading 2', sample: { fontWeight: 700, color: '#2b579a', fontSize: 13 }, apply: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (f) => f.heading === 2 },
  { id: 'h3', label: 'Heading 3', sample: { fontWeight: 600, color: '#1f3864' }, apply: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (f) => f.heading === 3 },
  { id: 'h4', label: 'Heading 4', sample: { fontWeight: 600, fontStyle: 'italic', color: '#2b579a' }, apply: (e) => e.chain().focus().toggleHeading({ level: 4 }).run(), isActive: (f) => f.heading === 4 },
  { id: 'subtitle', label: 'Subtitle', sample: { color: '#5a6478', letterSpacing: 1 }, apply: (e) => e.chain().focus().setHeading({ level: 5 }).run(), isActive: (f) => f.heading === 5 },
  { id: 'quote', label: 'Quote', sample: { fontStyle: 'italic', color: '#555f73' }, apply: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (f) => f.blockquote },
  { id: 'code', label: 'Code', sample: { fontFamily: 'Consolas, monospace', fontSize: 11 }, apply: (e) => e.chain().focus().toggleCodeBlock().run(), isActive: (f) => f.codeBlock },
];

const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];

export default function HomeTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { editor } = ctx;
  const chain = () => editor.chain().focus();
  return (
    <>
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

      <Group label="Phông chữ">
        <Rows>
          <Row>
            <FontPicker value={fmt.fontFamily || ctx.page.fontFamily || 'Arial'} onPick={(font) => chain().setFontFamily(font).run()} onError={(message) => ctx.ui.toast(message, true)} />
            <input className="ribbon-select size-input" list="doc-font-sizes" title="Cỡ chữ" value={fmt.fontSize || String(ctx.page.fontSize ?? 12)} onChange={(e) => { const n = parseFloat(e.target.value); if (n > 0 && n <= 400) chain().setFontSize(`${n}pt`).run(); }} />
            <datalist id="doc-font-sizes">{FONT_SIZES.map((s) => <option key={s} value={s} />)}</datalist>
            <Small icon={<span className="grow-icon">A<sup>▲</sup></span>} title="Tăng cỡ chữ (Ctrl+])" onClick={() => editor.chain().focus().stepFontSize(1).run()} />
            <Small icon={<span className="grow-icon small">A<sub>▼</sub></span>} title="Giảm cỡ chữ (Ctrl+[)" onClick={() => editor.chain().focus().stepFontSize(-1).run()} />
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
            <Small icon={<Strikethrough size={14} />} title="Gạch ngang (Ctrl+Shift+X)" active={fmt.strike} onClick={() => chain().toggleStrike().run()} />
            <Small icon={<Subscript size={14} />} title="Chỉ số dưới (Ctrl+,)" active={fmt.subscript} onClick={() => chain().toggleSubscript().run()} />
            <Small icon={<Superscript size={14} />} title="Chỉ số trên (Ctrl+.)" active={fmt.superscript} onClick={() => chain().toggleSuperscript().run()} />
            <Small icon={<Code size={14} />} title="Mã nội dòng (Ctrl+E)" active={fmt.code} onClick={() => chain().toggleCode().run()} />
            <ColorPicker title="Màu tô sáng chữ" icon={<Highlighter size={14} />} swatch={fmt.highlight || '#fff59d'} noneLabel="Không tô" onPick={(color) => (color ? chain().setHighlight({ color }).run() : chain().unsetHighlight().run())} />
            <ColorPicker title="Màu chữ" icon={<Baseline size={14} />} swatch={fmt.color || '#d7473c'} noneLabel="Tự động (đen)" onPick={(color) => (color ? chain().setColor(color).run() : chain().unsetColor().run())} />
          </Row>
        </Rows>
      </Group>

      <Group label="Đoạn văn">
        <Rows>
          <Row>
            <Small icon={<List size={14} />} title="Dấu đầu dòng" active={fmt.bulletList} onClick={() => chain().toggleBulletList().run()} />
            <Small icon={<ListOrdered size={14} />} title="Đánh số" active={fmt.orderedList} onClick={() => chain().toggleOrderedList().run()} />
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
                  <MenuItem label="Tuỳ chọn giãn dòng…" onClick={() => { close(); void paragraphSettings(ctx); }} />
                </>
              )}
            </Dropdown>
            <ColorPicker title="Tô nền đoạn chọn" icon={<PaintBucket size={14} />} swatch="#e0f2fe" noneLabel="Không tô nền" onPick={(color) => (color ? chain().setBackgroundColor(color).run() : chain().unsetBackgroundColor().run())} />
            <Small icon={<Quote size={14} />} title="Trích dẫn" active={fmt.blockquote} onClick={() => chain().toggleBlockquote().run()} />
          </Row>
        </Rows>
      </Group>

      <Group label="Kiểu">
        <div className="styles-gallery-container">
          {STYLES.map((style) => (
            <button key={style.id} type="button" className={`styles-card ${style.isActive(fmt) ? 'active' : ''}`} title={`Áp dụng kiểu ${style.label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => style.apply(editor)}>
              <span className="styles-card-sample" style={style.sample}>AaBbCc</span>
              <span className="styles-card-title">{style.label}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group label="Chỉnh sửa">
        <Rows>
          <Small icon={<Search size={14} />} label="Tìm" title="Tìm (Ctrl+F)" onClick={() => ctx.setView({ showFind: true, findReplace: false })} />
          <Small icon={<Replace size={14} />} label="Thay thế" title="Thay thế (Ctrl+H)" onClick={() => ctx.setView({ showFind: true, findReplace: true })} />
          <Small icon={<TextSelect size={14} />} label="Chọn tất cả" title="Chọn tất cả (Ctrl+A)" onClick={() => chain().selectAll().run()} />
        </Rows>
      </Group>

      <Group label="Giọng nói">
        <Big icon={ctx.dictation.listening ? <MicOff size={20} color="#d7473c" /> : <Mic size={20} color="#2b579a" />} label="Đọc chính tả" title="Nhập văn bản bằng giọng nói tiếng Việt" active={ctx.dictation.listening} onClick={ctx.dictation.toggle} />
        <Big icon={ctx.readAloud.speaking ? <VolumeX size={20} color="#d7473c" /> : <Volume2 size={20} color="#2b579a" />} label="Đọc to" title="Đọc to đoạn chọn hoặc cả tài liệu" active={ctx.readAloud.speaking} onClick={ctx.readAloud.toggle} />
      </Group>

      <Group label="Minh AI">
        <Big icon={<Sparkles size={20} color="#7c3aed" />} label="Minh AI" title="Viết lại, tóm tắt, dịch, viết tiếp bằng AI" onClick={() => ctx.openDialog('ai')} />
      </Group>
    </>
  );
}
