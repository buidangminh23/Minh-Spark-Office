import { BookOpen, Columns3, Combine, Expand, FileDown, FileImage, Grid3x3, Keyboard, Info, Maximize2, Minimize2, MonitorPlay, Navigation, PenTool, Pilcrow, Printer, Ruler, ScrollText, Split, SpellCheck2, ZoomIn, ZoomOut, Share2, Sparkles, LayoutGrid } from 'lucide-react';
import { useDoc } from '../../DocContext';
import { exportAsPng, exportSlides, mergeDocument, printDocument, splitDocument } from '../../actions';
import { Big, Group, Rows, Small } from '../RibbonParts';

export const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

export const fitWidthZoom = (pageWidth: number) => {
  const canvas = document.querySelector('.doc-canvas');
  const available = (canvas?.clientWidth ?? window.innerWidth) - 64;
  return Math.max(50, Math.min(200, Math.floor((available / pageWidth) * 100)));
};

export function ViewTab({ pageWidth, pageHeight }: { pageWidth: number; pageHeight: number }) {
  const { view, setView } = useDoc();
  const zoomBy = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > view.zoom) ?? 200 : [...ZOOM_STEPS].reverse().find((z) => z < view.zoom) ?? 50;
    setView({ zoom: next });
  };
  const onePage = () => {
    const canvas = document.querySelector('.doc-canvas');
    const available = (canvas?.clientHeight ?? window.innerHeight) - 80;
    setView({ zoom: Math.max(30, Math.min(200, Math.floor((available / pageHeight) * 100))) });
  };
  const fullscreen = () => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.());
  return (
    <>
      <Group label="Chế độ xem">
        <Big icon={<BookOpen size={22} color="#2b579a" />} label="Đọc" title="Chế độ đọc (ẩn công cụ)" active={view.viewMode === 'read'} onClick={() => setView({ viewMode: 'read' })} />
        <Big icon={<ScrollText size={22} color="#2b579a" />} label="Bố cục in" title="Hiển thị theo trang giấy" active={view.viewMode === 'print'} onClick={() => setView({ viewMode: 'print' })} />
        <Big icon={<Columns3 size={22} color="#2b579a" />} label="Không chia trang" title="Bố cục web / không chia trang (như Google Docs)" active={view.viewMode === 'web'} onClick={() => setView({ viewMode: 'web' })} />
      </Group>
      <Group label="Hiển thị">
        <Rows>
          <Small icon={<Ruler size={14} />} label="Thước" title="Hiện thước kẻ" active={view.showRuler} onClick={() => setView({ showRuler: !view.showRuler })} />
          <Small icon={<Grid3x3 size={14} />} label="Lưới" title="Hiện đường lưới" active={view.showGrid} onClick={() => setView({ showGrid: !view.showGrid })} />
          <Small icon={<Navigation size={14} />} label="Điều hướng" title="Khung điều hướng tiêu đề" active={view.showNav} onClick={() => setView({ showNav: !view.showNav })} />
        </Rows>
        <Rows>
          <Small icon={<Pilcrow size={14} />} label="Ký hiệu ¶" title="Hiện ký hiệu định dạng" active={view.showMarks} onClick={() => setView({ showMarks: !view.showMarks })} />
          <Small icon={<SpellCheck2 size={14} />} label="Gạch lỗi chính tả" title="Gạch chân từ sai theo từ điển của trình duyệt" active={view.spellcheck} onClick={() => setView({ spellcheck: !view.spellcheck })} />
        </Rows>
      </Group>
      <Group label="Thu phóng">
        <Big icon={<ZoomIn size={22} color="#2b579a" />} label="Phóng to" title="Phóng to (Ctrl+=)" onClick={() => zoomBy(1)} />
        <Big icon={<ZoomOut size={22} color="#2b579a" />} label="Thu nhỏ" title="Thu nhỏ (Ctrl+-)" onClick={() => zoomBy(-1)} />
        <Rows>
          <Small icon={<span className="zoom-chip">100%</span>} title="Về 100%" onClick={() => setView({ zoom: 100 })} />
          <Small icon={<Expand size={14} />} label="Vừa chiều rộng" title="Vừa chiều rộng cửa sổ" onClick={() => setView({ zoom: fitWidthZoom(pageWidth) })} />
          <Small icon={<LayoutGrid size={14} />} label="Một trang" title="Nhìn trọn một trang" onClick={onePage} />
        </Rows>
      </Group>
      <Group label="Cửa sổ">
        <Big icon={document.fullscreenElement ? <Minimize2 size={22} color="#2b579a" /> : <Maximize2 size={22} color="#2b579a" />} label="Toàn màn hình" title="Bật/tắt toàn màn hình (F11)" onClick={fullscreen} />
      </Group>
    </>
  );
}

export function PdfTab() {
  const ctx = useDoc();
  return (
    <>
      <Group label="Tạo PDF">
        <Big icon={<FileDown size={22} color="#d7473c" />} label="Lưu PDF" title="Lưu thành PDF qua hộp thoại in (chọn “Lưu dưới dạng PDF”)" onClick={printDocument} />
        <Big icon={<Printer size={22} color="#d7473c" />} label="In" title="In tài liệu (Ctrl+P)" onClick={printDocument} />
        <Big icon={<Share2 size={22} color="#d7473c" />} label="Xuất & chia sẻ" title="Mở trang Xuất tệp" onClick={() => ctx.openDialog('backstage')} />
      </Group>
      <Group label="Công cụ">
        <Big icon={<PenTool size={22} color="#4338ca" />} label="Ký tên" title="Vẽ chữ ký và chèn vào tài liệu" onClick={() => ctx.openDialog('signature')} />
        <Big icon={<Split size={22} color="#d98e04" />} label="Tách" title="Tách tài liệu theo tiêu đề thành nhiều tệp" onClick={() => void splitDocument(ctx)} />
        <Big icon={<Combine size={22} color="#0891b2" />} label="Ghép" title="Ghép thêm tệp vào cuối tài liệu" onClick={() => void mergeDocument(ctx)} />
      </Group>
      <Group label="Chuyển đổi">
        <Big icon={<FileImage size={22} color="#107c41" />} label="Thành ảnh" title="Xuất trang thành ảnh PNG" onClick={() => void exportAsPng(ctx)} />
        <Big icon={<MonitorPlay size={22} color="#ea580c" />} label="Thành slide" title="Tạo bộ trình chiếu HTML từ các tiêu đề" onClick={() => exportSlides(ctx)} />
        <Big icon={<Sparkles size={22} color="#7c3aed" />} label="Tóm tắt AI" title="Tóm tắt tài liệu bằng Minh AI" onClick={() => ctx.openDialog('ai')} />
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
        <Big icon={<Info size={22} color="#2b579a" />} label="Giới thiệu" title="Thông tin Minh Docs" onClick={() => void ctx.ui.ask({ title: 'Minh Docs', message: 'Trình soạn thảo văn bản của bộ Minh Office. Dữ liệu lưu ngay trên máy (IndexedDB), xuất được .docx, PDF, HTML, Markdown, PNG.', confirmText: 'Đóng', cancelText: null })} />
      </Group>
    </>
  );
}
