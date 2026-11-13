import { AppWindow, ArrowLeftRight, ArrowUpDown, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, ChevronsUp, Circle, CirclePlay, Columns2, Columns3, Expand, File, FileType, Files, Focus, Glasses, Globe, Hash, Info, Keyboard, LayoutGrid, ListTree, Minus, Plus, RotateCcw, Rows2, ScrollText, Unlink2, X, ZoomIn } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { Big, Dropdown, Group, MenuItem, MenuSeparator, Row, Rows, Small } from '../RibbonParts';
import { moveBlock, shiftHeading } from '../../viewShortcuts';
import { openMirrorChannel } from '../../viewMirror';

export const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

export const fitWidthZoom = (pageWidth: number) => {
  const canvas = document.querySelector('.doc-canvas');
  const available = (canvas?.clientWidth ?? window.innerWidth) - 64;
  return Math.max(50, Math.min(200, Math.floor((available / pageWidth) * 100)));
};

const openWindows: Window[] = [];

const liveWindows = () => {
  const alive = openWindows.filter((win) => !win.closed);
  openWindows.length = 0;
  openWindows.push(...alive);
  return alive;
};

const CheckRow = ({ label, title, checked, onChange }: { label: string; title: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="ribbon-check" title={title}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
);

export function ViewTab({ pageWidth, pageHeight }: { pageWidth: number; pageHeight: number }) {
  const ctx = useDoc();
  const { view, setView, openDialog } = ctx;
  const available = () => {
    const canvas = document.querySelector('.doc-canvas');
    return { width: (canvas?.clientWidth ?? window.innerWidth) - 64, height: (canvas?.clientHeight ?? window.innerHeight) - 80 };
  };
  const onePage = () => setView({ viewMode: 'print', pageMove: 'vertical', zoom: Math.max(30, Math.min(200, Math.floor((available().height / pageHeight) * 100))) });
  const multiplePages = () => setView({ viewMode: 'print', pageMove: 'side', zoom: Math.max(30, Math.min(200, Math.floor((available().width / (pageWidth * 2 + 24)) * 100))) });
  const newWindow = () => {
    const channel = openMirrorChannel(ctx);
    const index = liveWindows().length;
    const popup = window.open(`${window.location.pathname}?mirror=${channel}`, `minh-docs-${channel}`, `popup,width=${Math.round(window.screen.availWidth / 2)},height=${window.screen.availHeight - 80},left=${Math.round(window.screen.availWidth / 2) - index * 24},top=${index * 24}`);
    if (!popup) return ctx.ui.toast('Trình duyệt đã chặn cửa sổ bật lên. Hãy cho phép cửa sổ bật lên của trang này.', true);
    openWindows.push(popup);
    ctx.ui.toast('Đã mở cửa sổ thứ hai. Cửa sổ này tự cập nhật theo tài liệu và chỉ để đọc.');
  };
  const arrangeAll = () => {
    const list = liveWindows();
    if (!list.length) return ctx.ui.toast('Chỉ có một cửa sổ. Bấm Cửa sổ mới để mở thêm.');
    const width = Math.round(window.screen.availWidth / (list.length + 1));
    list.forEach((win, index) => {
      win.moveTo(width * (index + 1), 0);
      win.resizeTo(width, window.screen.availHeight);
    });
    window.moveTo(0, 0);
    window.resizeTo(width, window.screen.availHeight);
    ctx.ui.toast('Đã xếp các cửa sổ phụ cạnh nhau. Trình duyệt không cho đổi cỡ tab chính, hãy kéo tab này sang nửa trái màn hình nếu cần.');
  };
  const resetPosition = () => {
    const canvas = document.querySelector('.doc-canvas');
    const pane = document.querySelector('.side-pane-scroll');
    canvas?.scrollTo({ top: 0, behavior: 'smooth' });
    pane?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <>
      <Group label="Dạng xem">
        <Big icon={<BookOpen size={22} color="#2b579a" />} label="Chế độ đọc" title="Chế độ đọc, ẩn công cụ" active={view.viewMode === 'read'} onClick={() => setView({ viewMode: 'read' })} />
        <Big icon={<ScrollText size={22} color="#2b579a" />} label="Bố cục in" title="Hiển thị theo trang giấy" active={view.viewMode === 'print'} onClick={() => setView({ viewMode: 'print' })} />
        <Big icon={<Globe size={22} color="#2b579a" />} label="Bố cục web" title="Hiển thị như trang web, không chia trang" active={view.viewMode === 'web'} onClick={() => setView({ viewMode: 'web' })} />
        <Rows>
          <Small icon={<ListTree size={14} />} label="Dàn ý" title="Xem tài liệu dạng dàn ý, thu gọn và sắp xếp mục (Ctrl+Alt+O)" active={view.viewMode === 'outline'} onClick={() => setView({ viewMode: 'outline' })} />
          <Small icon={<FileType size={14} />} label="Bản nháp" title="Chỉ hiện chữ, không có lề và đầu chân trang (Ctrl+Alt+N)" active={view.viewMode === 'draft'} onClick={() => setView({ viewMode: 'draft' })} />
        </Rows>
      </Group>
      <Group label="Đọc tập trung">
        <Big icon={<Focus size={22} color="#2b579a" />} label="Tập trung" title="Ẩn thanh công cụ và khung bên, chỉ còn trang giấy" active={view.focusMode} onClick={() => setView({ focusMode: !view.focusMode })} />
        <Big icon={<Glasses size={22} color="#7c3aed" />} label="Trình đọc chân thực" title="Đọc dễ hơn: đổi cỡ chữ, nền, giãn chữ, tiêu điểm dòng và đọc to" onClick={() => openDialog('immersive')} />
      </Group>
      <Group label="Di chuyển trang">
        <Big icon={<ArrowUpDown size={22} color="#2b579a" />} label="Dọc" title="Cuộn trang từ trên xuống" active={view.pageMove === 'vertical'} onClick={() => setView({ pageMove: 'vertical' })} />
        <Big icon={<ArrowLeftRight size={22} color="#2b579a" />} label="Ngang trang" title="Lật trang sang ngang, các trang nằm cạnh nhau" active={view.pageMove === 'side'} onClick={() => setView({ pageMove: 'side', viewMode: 'print' })} />
      </Group>
      <Group label="Hiển thị">
        <Rows>
          <CheckRow label="Thước" title="Hiện thước kẻ" checked={view.showRuler} onChange={(value) => setView({ showRuler: value })} />
          <CheckRow label="Đường lưới" title="Hiện đường lưới trên trang" checked={view.showGrid} onChange={(value) => setView({ showGrid: value })} />
          <CheckRow label="Ngăn điều hướng" title="Khung điều hướng tiêu đề và trang" checked={view.showNav} onChange={(value) => setView({ showNav: value })} />
        </Rows>
        <Rows>
          <CheckRow label="Ký hiệu ¶" title="Hiện ký hiệu định dạng" checked={view.showMarks} onChange={(value) => setView({ showMarks: value })} />
          <CheckRow label="Gạch lỗi chính tả" title="Gạch chân từ sai theo từ điển của trình duyệt" checked={view.spellcheck} onChange={(value) => setView({ spellcheck: value })} />
          <CheckRow label="Nền tối" title="Làm tối vùng làm việc khi soạn, không đổi màu khi in hay xuất" checked={view.dark} onChange={(value) => setView({ dark: value })} />
        </Rows>
        <Rows>
          <Small icon={<Hash size={14} />} label="Đi tới trang" title="Nhảy tới một trang (Ctrl+G)" onClick={() => openDialog('goto')} />
          <Small icon={<ChevronsUp size={14} />} label="Thu gọn ribbon" title="Ẩn thân ribbon, chỉ giữ hàng tab (Ctrl+F1)" active={view.ribbonCollapsed} onClick={() => setView({ ribbonCollapsed: !view.ribbonCollapsed })} />
        </Rows>
      </Group>
      <Group label="Thu phóng">
        <Big icon={<ZoomIn size={22} color="#2b579a" />} label="Thu phóng" title="Mở hộp thoại thu phóng" onClick={() => openDialog('zoom')} />
        <Big icon={<span className="zoom-chip big">100%</span>} label="100%" title="Về 100%" active={view.zoom === 100} onClick={() => setView({ zoom: 100 })} />
        <Rows>
          <Small icon={<File size={14} />} label="Một trang" title="Nhìn trọn một trang" onClick={onePage} />
          <Small icon={<Files size={14} />} label="Nhiều trang" title="Xem hai trang cạnh nhau" onClick={multiplePages} />
          <Small icon={<Expand size={14} />} label="Chiều rộng trang" title="Vừa chiều rộng cửa sổ" onClick={() => setView({ zoom: fitWidthZoom(pageWidth) })} />
        </Rows>
      </Group>
      <Group label="Cửa sổ">
        <Big icon={<AppWindow size={22} color="#107c41" />} label="Cửa sổ mới" title="Mở tài liệu trong cửa sổ thứ hai, tự cập nhật theo bản đang sửa" onClick={newWindow} />
        <Big icon={<Columns2 size={22} color="#2b579a" />} label="Sắp xếp tất cả" title="Xếp các cửa sổ cạnh nhau" onClick={arrangeAll} />
        <Big icon={<Rows2 size={22} color="#2b579a" />} label="Chia đôi" title="Chia màn hình để xem hai phần của tài liệu (Ctrl+Alt+S)" active={view.splitView} onClick={() => setView({ splitView: !view.splitView })} />
        <Rows>
          <Small icon={<Columns3 size={14} />} label="Xem song song" title="So hai tài liệu đặt cạnh nhau" active={Boolean(view.sideBySide)} onClick={() => (view.sideBySide ? setView({ sideBySide: null }) : openDialog('sidebyside'))} />
          <Small icon={<Unlink2 size={14} />} label="Cuộn đồng bộ" title="Cuộn hai tài liệu cùng lúc" active={view.syncScroll} disabled={!view.sideBySide} onClick={() => setView({ syncScroll: !view.syncScroll })} />
          <Small icon={<RotateCcw size={14} />} label="Đặt lại vị trí" title="Đưa hai tài liệu về cùng vị trí đầu trang" disabled={!view.sideBySide} onClick={resetPosition} />
        </Rows>
        <Dropdown large title="Chuyển cửa sổ" trigger={<><LayoutGrid size={22} color="#2b579a" /><span>Chuyển cửa sổ</span></>}>
          {(close) => (
            <>
              <MenuItem label={`1. ${ctx.title}`} active onClick={close} />
              {liveWindows().map((win, index) => <MenuItem key={index} label={`${index + 2}. Cửa sổ phụ ${index + 1}`} onClick={() => { close(); win.focus(); }} />)}
              <MenuSeparator />
              <MenuItem label="Mở cửa sổ mới" onClick={() => { close(); newWindow(); }} />
            </>
          )}
        </Dropdown>
      </Group>
      <Group label="Macro">
        <Dropdown large active={view.recording} title="Macro" trigger={<><CirclePlay size={22} color={view.recording ? '#d7473c' : '#2b579a'} /><span>Macro</span></>}>
          {(close) => (
            <>
              <MenuItem icon={<ListTree size={14} />} label="Xem macro…" onClick={() => { close(); openDialog('macros'); }} />
              <MenuItem icon={<Circle size={14} />} label={view.recording ? 'Dừng ghi macro' : 'Ghi macro…'} onClick={() => { close(); setView({ recording: !view.recording }); }} />
            </>
          )}
        </Dropdown>
      </Group>
      <Group label="Tài liệu">
        <Big icon={<Info size={22} color="#107c41" />} label="Thuộc tính" title="Tên, tác giả, chủ đề và thống kê của tài liệu" onClick={() => openDialog('backstage')} />
      </Group>
    </>
  );
}

export function OutlineTab() {
  const ctx = useDoc();
  const { editor, view, setView } = ctx;
  const chain = () => editor.chain().focus();
  const level = [1, 2, 3, 4, 5, 6].find((value) => editor.isActive('heading', { level: value }));
  const setLevel = (value: string) => {
    if (value === 'body') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };
  return (
    <>
      <Group label="Công cụ dàn ý">
        <Rows>
          <Row>
            <Small icon={<ChevronsLeft size={14} />} title="Nâng lên Tiêu đề 1" onClick={() => setLevel('1')} />
            <Small icon={<ChevronLeft size={14} />} title="Nâng một cấp (Alt+Shift+←)" onClick={() => shiftHeading(ctx, -1)} />
            <select className="ribbon-select outline-level" aria-label="Cấp của đoạn" title="Cấp của đoạn" value={level ? String(level) : 'body'} onChange={(event) => setLevel(event.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Cấp {value}</option>)}
              <option value="body">Nội dung</option>
            </select>
            <Small icon={<ChevronRight size={14} />} title="Hạ một cấp (Alt+Shift+→)" onClick={() => shiftHeading(ctx, 1)} />
            <Small icon={<ChevronsRight size={14} />} title="Hạ xuống thành nội dung" onClick={() => setLevel('body')} />
          </Row>
          <Row>
            <Small icon={<ChevronUp size={14} />} title="Chuyển đoạn lên (Alt+Shift+↑)" onClick={() => moveBlock(ctx, -1)} />
            <Small icon={<ChevronDown size={14} />} title="Chuyển đoạn xuống (Alt+Shift+↓)" onClick={() => moveBlock(ctx, 1)} />
            <Small icon={<Plus size={14} />} title="Mở rộng tất cả" onClick={() => editor.commands.setOutlineCollapsed(false)} />
            <Small icon={<Minus size={14} />} title="Thu gọn tất cả" onClick={() => editor.commands.setOutlineCollapsed(true)} />
            <select className="ribbon-select outline-level" aria-label="Hiện đến cấp" title="Hiện đến cấp" value={view.outlineLevel} onChange={(event) => setView({ outlineLevel: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Hiện cấp {value}</option>)}
              <option value={9}>Tất cả các cấp</option>
            </select>
          </Row>
        </Rows>
      </Group>
      <Group label="Đóng">
        <Big icon={<X size={22} color="#d7473c" />} label="Đóng dàn ý" title="Quay về Bố cục in" onClick={() => setView({ viewMode: 'print' })} />
      </Group>
    </>
  );
}

export function HelpTab() {
  const ctx = useDoc();
  return (
    <>
      <Group label="Trợ giúp">
        <Big icon={<Keyboard size={22} color="#2b579a" />} label="Phím tắt" title="Danh sách phím tắt (Ctrl+/)" onClick={() => ctx.openDialog('shortcuts')} />
        <Big icon={<Info size={22} color="#2b579a" />} label="Giới thiệu" title="Thông tin 23 Docs" onClick={() => void ctx.ui.ask({ title: '23 Docs', message: 'Trình soạn thảo văn bản của bộ Office 23. Dữ liệu lưu ngay trên máy (IndexedDB), xuất được .docx, PDF, HTML, Markdown, PNG.', confirmText: 'Đóng', cancelText: null })} />
      </Group>
    </>
  );
}
