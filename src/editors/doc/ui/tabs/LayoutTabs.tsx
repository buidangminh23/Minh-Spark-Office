import { Columns2, Droplets, FileType, Frame, Hash, Indent, Languages, LayoutTemplate, Link, Maximize, Palette, PanelTop, RectangleHorizontal, RectangleVertical, Ruler, ScissorsLineDashed, Square, Stamp, WrapText } from 'lucide-react';
import { useDoc } from '../../DocContext';
import type { FormatState } from '../../useFormatState';
import { customWatermark, imageSettings, pageSetup } from '../../actions';
import { STYLE_SETS, styleSample } from '../../docStyles';
import { ensureFont } from '../../fonts';
import type { PageSettings } from '../../../../lib/storage';
import { Big, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Row, Rows, Small, THEME_COLORS } from '../RibbonParts';

const MARGINS: { id: string; label: string; detail: string; value: PageSettings['margins'] }[] = [
  { id: 'normal', label: 'Bình thường', detail: '2,54 cm mọi phía', value: { top: 96, right: 96, bottom: 96, left: 96 } },
  { id: 'vn', label: 'Văn bản hành chính', detail: 'Trên/dưới 2 cm · trái 3 cm · phải 1,5 cm', value: { top: 76, right: 57, bottom: 76, left: 113 } },
  { id: 'narrow', label: 'Hẹp', detail: '1,27 cm mọi phía', value: { top: 48, right: 48, bottom: 48, left: 48 } },
  { id: 'moderate', label: 'Vừa', detail: 'Trên/dưới 2,54 · trái/phải 1,91 cm', value: { top: 96, right: 72, bottom: 96, left: 72 } },
  { id: 'wide', label: 'Rộng', detail: 'Trên/dưới 2,54 · trái/phải 5,08 cm', value: { top: 96, right: 192, bottom: 96, left: 192 } },
];

const THEMES: { id: string; label: string; font: string; size: number }[] = [
  { id: 'office', label: 'Office (Arial 12)', font: 'Arial', size: 12 },
  { id: 'formal', label: 'Hành chính (Times New Roman 13)', font: 'Times New Roman', size: 13 },
  { id: 'modern', label: 'Hiện đại (Segoe UI 11)', font: 'Segoe UI', size: 11 },
  { id: 'classic', label: 'Cổ điển (Georgia 12)', font: 'Georgia', size: 12 },
  { id: 'compact', label: 'Gọn (Calibri 11)', font: 'Calibri', size: 11 },
  { id: 'vietnam', label: 'Be Vietnam Pro 11', font: 'Be Vietnam Pro', size: 11 },
  { id: 'noto', label: 'Noto Serif 12', font: 'Noto Serif', size: 12 },
  { id: 'roboto', label: 'Roboto 11', font: 'Roboto', size: 11 },
];

const WATERMARKS = ['BẢN NHÁP', 'MẬT', 'TUYỆT MẬT', 'LƯU HÀNH NỘI BỘ', 'KHẨN', 'MẪU', 'CONFIDENTIAL', 'DRAFT'];

export function DesignTab() {
  const ctx = useDoc();
  const { page, setPage } = ctx;
  return (
    <>
      <Group label="Định dạng tài liệu">
        <Dropdown large title="Bộ kiểu cho cả tài liệu" trigger={<><Palette size={22} color="#7c3aed" /><span>Bộ kiểu</span></>} width={320}>
          {(close) => STYLE_SETS.map((set) => { ensureFont(set.font); return (
            <MenuItem key={set.id} label={<span className="style-set-row"><strong style={{ fontFamily: set.font }}>{set.label}</strong><span style={{ ...styleSample(set.styles.h1), fontFamily: set.font }}>Tiêu đề</span><small style={{ fontFamily: set.font }}>{set.font} {set.size}</small></span>} active={(page.styleSet ?? 'office') === set.id} onClick={() => { close(); ensureFont(set.font); setPage({ styles: set.styles, styleSet: set.id, fontFamily: set.font, fontSize: set.size }); }} />
          ); })}
        </Dropdown>
        <Dropdown large title="Bộ phông chữ mặc định cho tài liệu" trigger={<><FileType size={22} color="#2b579a" /><span>Phông chủ đạo</span></>}>
          {(close) => THEMES.map((theme) => { ensureFont(theme.font); return (
            <MenuItem key={theme.id} label={<span style={{ fontFamily: theme.font }}>{theme.label}</span>} active={page.fontFamily === theme.font && page.fontSize === theme.size} onClick={() => { close(); ensureFont(theme.font); setPage({ fontFamily: theme.font, fontSize: theme.size }); }} />
          ); })}
        </Dropdown>
      </Group>
      <Group label="Nền trang">
        <Dropdown large title="Hình mờ" trigger={<><Stamp size={22} color="#586071" /><span>Hình mờ</span></>}>
          {(close) => (
            <>
              <MenuItem label="Không có" active={!page.watermark} onClick={() => { close(); setPage({ watermark: '' }); }} />
              {WATERMARKS.map((w) => <MenuItem key={w} label={w} active={page.watermark === w} onClick={() => { close(); setPage({ watermark: w }); }} />)}
              <MenuSeparator />
              <MenuItem label="Hình mờ tuỳ chỉnh…" onClick={() => { close(); void customWatermark(ctx); }} />
            </>
          )}
        </Dropdown>
        <Dropdown large title="Màu trang" trigger={<><Droplets size={22} color="#0891b2" /><span>Màu trang</span></>}>
          {(close) => (
            <div className="color-menu">
              <button type="button" className="ribbon-menu-item" onClick={() => { close(); setPage({ pageColor: '' }); }}>Không màu (trắng)</button>
              <div className="color-grid">
                {['#ffffff', '#faf8f5', '#fdf6e3', '#f3f4f6', '#eef6ff', '#f0fdf4', '#fff7ed', '#fdf2f8', ...THEME_COLORS.slice(20, 30)].map((color) => (
                  <button key={color} type="button" className="color-swatch" aria-label={color} style={{ background: color }} onClick={() => { close(); setPage({ pageColor: color }); }} />
                ))}
              </div>
            </div>
          )}
        </Dropdown>
        <Dropdown large title="Viền trang" trigger={<><Frame size={22} color="#586071" /><span>Viền trang</span></>}>
          {(close) => (['none', 'single', 'double', 'shadow'] as const).map((style) => (
            <MenuItem key={style} label={{ none: 'Không viền', single: 'Viền đơn', double: 'Viền đôi', shadow: 'Viền đổ bóng' }[style]} active={(page.pageBorder ?? 'none') === style} onClick={() => { close(); setPage({ pageBorder: style }); }} />
          ))}
        </Dropdown>
      </Group>
    </>
  );
}

export function LayoutTab({ fmt }: { fmt: FormatState }) {
  const ctx = useDoc();
  const { page, setPage, editor } = ctx;
  return (
    <>
      <Group label="Thiết lập trang">
        <Dropdown large title="Lề trang" trigger={<><LayoutTemplate size={22} color="#2b579a" /><span>Lề</span></>} width={280}>
          {(close) => (
            <>
              {MARGINS.map((m) => <MenuItem key={m.id} label={<span><strong>{m.label}</strong><br /><small>{m.detail}</small></span>} active={JSON.stringify(page.margins) === JSON.stringify(m.value)} onClick={() => { close(); setPage({ margins: m.value }); }} />)}
              <MenuSeparator />
              <MenuItem label="Lề tuỳ chỉnh…" onClick={() => { close(); void pageSetup(ctx); }} />
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
        <Dropdown large title="Khổ giấy" trigger={<><Square size={22} color="#2b579a" /><span>Khổ</span></>}>
          {(close) => (['A4', 'A5', 'Letter', 'Legal'] as const).map((size) => <MenuItem key={size} label={size} active={page.size === size} onClick={() => { close(); setPage({ size }); }} />)}
        </Dropdown>
        <Dropdown large title="Chia cột" trigger={<><Columns2 size={22} color="#2b579a" /><span>Cột</span></>}>
          {(close) => (
            <>
              <MenuHeading>Cả tài liệu</MenuHeading>
              {[1, 2, 3].map((n) => <MenuItem key={n} label={`${n} cột`} active={(page.columns ?? 1) === n} onClick={() => { close(); setPage({ columns: n }); }} />)}
              <MenuSeparator />
              <MenuHeading>Chỉ đoạn đang chọn</MenuHeading>
              <MenuItem label="Chia đoạn chọn thành 2 cột" onClick={() => { close(); editor.chain().focus().wrapInColumns(2).run(); }} />
              <MenuItem label="Chia đoạn chọn thành 3 cột" onClick={() => { close(); editor.chain().focus().wrapInColumns(3).run(); }} />
              {fmt.inColumns && <MenuItem label="Bỏ chia cột đoạn này" onClick={() => { close(); editor.chain().focus().unwrapColumns().run(); }} />}
            </>
          )}
        </Dropdown>
        <Rows>
          <Small icon={<ScissorsLineDashed size={14} />} label="Ngắt trang" title="Chèn ngắt trang (Ctrl+Enter)" onClick={() => editor.chain().focus().insertPageBreak().run()} />
          <Small icon={<Hash size={14} />} label="Số dòng" title="Hiện số dòng bên lề" active={Boolean(page.lineNumbers)} onClick={() => setPage({ lineNumbers: !page.lineNumbers })} />
          <Small icon={<Languages size={14} />} label="Ngắt từ" title="Tự động ngắt từ cuối dòng" active={Boolean(page.hyphenate)} onClick={() => setPage({ hyphenate: !page.hyphenate })} />
        </Rows>
        <Rows>
          <Small icon={<PanelTop size={14} />} label="Đầu/chân trang" title="Đầu trang, chân trang, số trang" onClick={() => ctx.openDialog('headerfooter')} />
          <Small icon={<Maximize size={14} />} label="Thiết lập trang…" title="Mở hộp thoại thiết lập trang" onClick={() => void pageSetup(ctx)} />
        </Rows>
      </Group>

      <Group label="Đoạn văn" onLauncher={() => ctx.openDialog('paragraph')} launcherTitle="Hộp thoại Đoạn văn">
        <Rows>
          <MenuHeading>Thụt lề</MenuHeading>
          <Row>
            <Small icon={<Indent size={14} />} label="−" title="Giảm thụt lề" onClick={() => editor.chain().focus().decreaseIndent().run()} />
            <Small icon={<Indent size={14} />} label="+" title="Tăng thụt lề" onClick={() => editor.chain().focus().increaseIndent().run()} />
          </Row>
        </Rows>
        <Rows>
          <MenuHeading>Giãn cách</MenuHeading>
          <Row>
            <Small icon={<Ruler size={14} />} label={fmt.lineHeight ? `${fmt.lineHeight}×` : 'Giãn dòng'} title="Tuỳ chỉnh thụt lề và giãn cách" onClick={() => ctx.openDialog('paragraph')} />
          </Row>
        </Rows>
        <Rows>
          <Small icon={<Link size={14} />} label="Giữ với đoạn sau" title="Không để đoạn này nằm cuối trang, tách khỏi đoạn kế" active={fmt.keepNext} onClick={() => editor.chain().focus().setParagraphAttrs({ keepNext: !fmt.keepNext }).run()} />
          <Small icon={<ScissorsLineDashed size={14} />} label="Sang trang trước đoạn" title="Luôn bắt đầu đoạn này ở trang mới" active={fmt.pageBreakBefore} onClick={() => editor.chain().focus().setParagraphAttrs({ pageBreakBefore: !fmt.pageBreakBefore }).run()} />
        </Rows>
      </Group>

      <Group label="Sắp xếp ảnh">
        <Big icon={<WrapText size={22} color={fmt.imageSelected ? '#2b579a' : '#9aa3b2'} />} label="Bố cục ảnh" title="Chọn một ảnh để đặt kích thước và cách bao chữ" disabled={!fmt.imageSelected} onClick={() => void imageSettings(ctx)} />
      </Group>
    </>
  );
}
