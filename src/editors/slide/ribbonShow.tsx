import { useEffect, useState } from 'react';
import {
  AlarmClock, AppWindow, AudioLines, BookOpenCheck, CaptionsIcon, Clapperboard, Eraser, FileVideo, GraduationCap, HelpCircle, LayoutPanelTop,
  ListChecks, MessageSquareDashed, MessageSquareMore, MessageSquarePlus, MessageSquareX, MonitorCog, MonitorPlay, NotebookPen,
  NotebookText, PanelsTopLeft, Play, Presentation, Rows3, ScreenShare, SquareStack, SpellCheck2, Speech, Trash2, UserRound, Video, Columns2,
  Contrast, Palette, SquareSplitHorizontal, Code, Accessibility, Languages, BookA, PenOff, CheckCheck, GitCompare, CircleDot,
} from 'lucide-react';
import type { SlideComment, SlideData, SlideElement } from '../../lib/slideTypes';
import { buildPptxFile } from '../../lib/pptxExport';
import { downloadBlob } from '../../lib/download';
import { slideBaseWidth } from '../../lib/settings/slideOptions';
import { DropButton, MenuItem, MenuTitle, RibbonGroup } from './ribbonParts';
import { newElementId, useSlideExtras } from './slideExtrasContext';

const SUBTITLE_LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ['vi-VN', 'Tiếng Việt'],
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['ja-JP', '日本語'],
  ['ko-KR', '한국어'],
  ['zh-CN', '中文 (简体)'],
  ['fr-FR', 'Français'],
];

function useShowSettings() {
  const x = useSlideExtras();
  const settings = x.presentation.showSettings ?? {};
  const set = (patch: Partial<NonNullable<typeof x.presentation.showSettings>>) => x.commit((p) => ({ ...p, showSettings: { ...(p.showSettings ?? {}), ...patch } }));
  return { settings, set };
}

interface ScreenInfo {
  id: string;
  label: string;
}

function useScreens(): ScreenInfo[] {
  const [screens, setScreens] = useState<ScreenInfo[]>([{ id: 'auto', label: 'Tự động' }]);
  useEffect(() => {
    const api = (window as unknown as { getScreenDetails?: () => Promise<{ screens: Array<{ label: string; isPrimary: boolean; width: number; height: number }> }> }).getScreenDetails;
    if (!api) return;
    api
      .call(window)
      .then((details) => setScreens([{ id: 'auto', label: 'Tự động' }, ...details.screens.map((s, i) => ({ id: String(i), label: `${s.label || `Màn hình ${i + 1}`}${s.isPrimary ? ' (chính)' : ''} ${s.width}x${s.height}` }))]))
      .catch(() => undefined);
  }, []);
  return screens;
}

export function SlideShowExtras() {
  const x = useSlideExtras();
  const { settings, set } = useShowSettings();
  const screens = useScreens();
  return (
    <>
      <RibbonGroup label="Diễn tập">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.launchShow({ fromCurrent: false, coach: true })} title="Diễn tập với Huấn luyện viên: đo tốc độ nói, từ đệm, rồi tổng kết">
          <GraduationCap size={20} color="#7C3AED" />
          <span>Huấn luyện viên</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Thiết lập" onLauncher={() => x.openDialog('setup-show')} launcherTitle="Thiết lập trình chiếu">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('setup-show')} title="Thiết lập trình chiếu">
          <MonitorCog size={20} color="#475569" />
          <span>Thiết lập trình chiếu</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.launchShow({ fromCurrent: false, rehearse: true })} title="Diễn tập và ghi thời gian từng trang">
          <AlarmClock size={20} color="#D97706" />
          <span>Diễn tập thời gian</span>
        </button>
        <DropButton large icon={<CircleDot size={20} color="#DC2626" />} label="Ghi" title="Ghi bài thuyết trình kèm camera" onMain={() => x.launchShow({ fromCurrent: true, recording: true })} menuWidth={240}>
          {(close) => (
            <>
              <MenuItem icon={<Play size={14} />} label="Ghi từ trang hiện tại…" onClick={() => { close(); x.launchShow({ fromCurrent: true, recording: true }); }} />
              <MenuItem icon={<Play size={14} />} label="Ghi từ đầu…" onClick={() => { close(); x.launchShow({ fromCurrent: false, recording: true }); }} />
            </>
          )}
        </DropButton>
        <div className="ppx-col ppx-col-tight ppx-checks">
          <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.keepSlidesUpdated ?? true} onChange={(e) => set({ keepSlidesUpdated: e.target.checked })} /> Cập nhật trang khi trình chiếu</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.playNarrations ?? true} onChange={(e) => set({ playNarrations: e.target.checked })} /> Phát lời thuyết minh</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.useTimings ?? true} onChange={(e) => set({ useTimings: e.target.checked })} /> Dùng thời gian đã lưu</label>
          <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.showMediaControls ?? true} onChange={(e) => set({ showMediaControls: e.target.checked })} /> Hiện nút điều khiển media</label>
        </div>
      </RibbonGroup>
      <RibbonGroup label="Màn hình" column>
        <label className="ppx-inline">
          <ScreenShare size={14} color="#2563EB" />
          <span>Màn hình:</span>
          <select className="ppt-select" value={settings.monitor ?? 'auto'} onChange={(e) => set({ monitor: e.target.value })}>
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>{screen.label}</option>
            ))}
          </select>
        </label>
        <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.usePresenterView ?? false} onChange={(e) => set({ usePresenterView: e.target.checked })} /> Dùng chế độ Diễn giả</label>
      </RibbonGroup>
      <RibbonGroup label="Chú thích & phụ đề" column>
        <label className="ppt-checkbox-label"><input type="checkbox" checked={settings.alwaysSubtitles ?? false} onChange={(e) => set({ alwaysSubtitles: e.target.checked })} /> Luôn dùng phụ đề</label>
        <DropButton icon={<CaptionsIcon size={14} />} label="Cài đặt phụ đề" title="Ngôn ngữ và vị trí phụ đề" menuWidth={230}>
          {(close) => (
            <>
              <MenuTitle>Ngôn ngữ nói</MenuTitle>
              {SUBTITLE_LANGUAGES.map(([id, label]) => (
                <MenuItem key={id} label={label} active={(settings.subtitleLanguage ?? 'vi-VN') === id} onClick={() => { close(); set({ subtitleLanguage: id }); }} />
              ))}
              <MenuTitle>Vị trí</MenuTitle>
              {([['bottom', 'Dưới trang (ngoài)'], ['top', 'Trên trang (ngoài)'], ['overlay-bottom', 'Phủ phía dưới'], ['overlay-top', 'Phủ phía trên']] as const).map(([id, label]) => (
                <MenuItem key={id} label={label} active={(settings.subtitlePosition ?? 'overlay-bottom') === id} onClick={() => { close(); set({ subtitlePosition: id }); }} />
              ))}
            </>
          )}
        </DropButton>
      </RibbonGroup>
    </>
  );
}

async function saveAsShow(slidesTitle: string, build: () => Promise<Uint8Array>) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await build());
  const types = await zip.file('[Content_Types].xml')?.async('string');
  if (types) zip.file('[Content_Types].xml', types.replace('presentationml.presentation.main+xml', 'presentationml.slideshow.main+xml'));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' });
  downloadBlob(blob, `${slidesTitle}.ppsx`);
}

export function RecordTab({ fileName }: { fileName: string }) {
  const x = useSlideExtras();
  const narrations = (slide: SlideData) => slide.elements.filter((el) => el.type === 'audio' && el.audioData && (el.name ?? '').startsWith('Thuyết minh'));
  const current = narrations(x.currentSlide);
  const clear = (all: boolean) => {
    x.commit((p) => ({
      ...p,
      slides: p.slides.map((s, i) => (all || i === x.activeSlideIndex ? { ...s, rehearsedSeconds: undefined, elements: s.elements.filter((el) => !narrations(s).includes(el)), transition: { ...s.transition, advanceAfterSeconds: 0 } } : s)),
    }));
    x.toast(all ? 'Đã xóa bản ghi trên tất cả trang chiếu' : 'Đã xóa bản ghi trên trang này');
  };
  const resetToCameo = () => {
    const height = 20 * (slideBaseWidth(x.presentation.aspectRatio) / 540);
    const cameo: SlideElement = { id: newElementId('cameo'), type: 'cameo', x: 74, y: 100 - height - 6, width: 20, height, cameoData: { shape: 'circle', mirror: true }, stroke: '#FFFFFF', strokeWidth: 3, name: 'Cameo' };
    x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, elements: [...s.elements.filter((el) => !narrations(s).includes(el)), cameo] } : s)) }));
    x.toast('Đã thay bản ghi trên trang này bằng Cameo trực tiếp');
  };
  const preview = () => {
    const audio = current[0]?.audioData;
    if (!audio) return;
    void new Audio(audio.url).play().catch(() => x.toast('Không phát được bản ghi', true));
  };
  const insertCameo = () => {
    const height = 20 * (slideBaseWidth(x.presentation.aspectRatio) / 540);
    x.addElement({ id: newElementId('cameo'), type: 'cameo', x: 74, y: 100 - height - 6, width: 20, height, cameoData: { shape: 'circle', mirror: true }, stroke: '#FFFFFF', strokeWidth: 3, name: 'Cameo', altText: 'Camera của người thuyết trình' });
  };
  const title = fileName.replace(/\.[^.]+$/, '') || 'Trình chiếu';
  return (
    <>
      <RibbonGroup label="Xem trước">
        <button type="button" className="ppt-tool-btn-large" disabled={current.length === 0} onClick={preview} title="Nghe lại lời thuyết minh của trang này">
          <Play size={20} color="#16A34A" />
          <span>Xem trước</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Camera">
        <button type="button" className="ppt-tool-btn-large" onClick={insertCameo} title="Chèn Cameo (camera trực tiếp)">
          <UserRound size={20} color="#16A34A" />
          <span>Cameo</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Ghi">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.launchShow({ fromCurrent: false, recording: true })} title="Quay bài thuyết trình từ đầu, kèm camera">
          <Clapperboard size={20} color="#DC2626" />
          <span>Ghi từ đầu</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.launchShow({ fromCurrent: true, recording: true })} title="Quay bài thuyết trình từ trang hiện tại, kèm camera">
          <Presentation size={20} color="#DC2626" />
          <span>Ghi từ trang này</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('screen-record')} title="Quay màn hình và chèn vào trang">
          <MonitorPlay size={20} color="#0284C7" />
          <span>Quay màn hình</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('record-audio')} title="Ghi âm và chèn vào trang">
          <AudioLines size={20} color="#7C3AED" />
          <span>Âm thanh</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Sửa">
        <DropButton large icon={<Eraser size={20} color="#64748B" />} label="Xóa bản ghi" title="Xóa lời thuyết minh và thời gian đã ghi" menuWidth={240}>
          {(close) => (
            <>
              <MenuItem icon={<Trash2 size={14} />} label="Xóa bản ghi trên trang hiện tại" onClick={() => { close(); clear(false); }} />
              <MenuItem icon={<Trash2 size={14} />} label="Xóa bản ghi trên tất cả trang" onClick={() => { close(); clear(true); }} />
            </>
          )}
        </DropButton>
        <button type="button" className="ppt-tool-btn-large" disabled={current.length === 0} onClick={resetToCameo} title="Thay bản ghi của trang này bằng Cameo trực tiếp">
          <Video size={20} color="#64748B" />
          <span>Đặt lại về Cameo</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Xuất">
        <button type="button" className="ppt-tool-btn-large" onClick={() => void saveAsShow(title, () => buildPptxFile(x.presentation)).catch(() => x.toast('Không tạo được tệp trình chiếu', true))} title="Lưu thành tệp .ppsx mở thẳng vào chế độ trình chiếu">
          <Presentation size={20} color="#D83B01" />
          <span>Lưu dạng trình chiếu</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('export-video')} title="Xuất bài thuyết trình thành video">
          <FileVideo size={20} color="#D83B01" />
          <span>Xuất video</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Trợ giúp">
        <DropButton large icon={<HelpCircle size={20} color="#2563EB" />} label="Tìm hiểu" title="Hướng dẫn quay bài thuyết trình" menuWidth={320}>
          {() => (
            <div className="ppx-help">
              <p><b>Ghi từ đầu / từ trang này</b>: chọn camera, micro rồi bấm Bắt đầu. Ứng dụng xin quyền ghi thẻ hiện tại, rồi vào trình chiếu.</p>
              <p><b>Thu gọn camera</b>: bấm nút thu gọn trên khung camera. Video vẫn ghi đầy đủ trang chiếu và camera ở góc màn hình.</p>
              <p><b>Kết thúc</b>: bấm Dừng hoặc Esc. Video được lưu thành tệp, thời gian từng trang được lưu vào bài.</p>
            </div>
          )}
        </DropButton>
      </RibbonGroup>
    </>
  );
}

function commentTargets(slides: SlideData[]) {
  return slides.flatMap((slide, slideIndex) => (slide.comments ?? []).map((comment) => ({ slideIndex, comment })));
}

export function ReviewExtras({ onOpenDiff }: { onOpenDiff: () => void }) {
  const x = useSlideExtras();
  const targets = commentTargets(x.presentation.slides);
  const navigate = (direction: 1 | -1) => {
    if (targets.length === 0) return;
    const after = targets.filter((t) => (direction > 0 ? t.slideIndex > x.activeSlideIndex : t.slideIndex < x.activeSlideIndex));
    const next = direction > 0 ? after[0] ?? targets[0] : after[after.length - 1] ?? targets[targets.length - 1];
    x.goToSlide(next.slideIndex);
    if (x.pane !== 'comments') x.togglePane('comments');
  };
  const deleteComments = (scope: 'slide' | 'all') => {
    x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (scope === 'all' || i === x.activeSlideIndex ? { ...s, comments: [] } : s)) }));
  };
  const markAllRead = () => x.commit((p) => ({ ...p, slides: p.slides.map((s) => ({ ...s, comments: s.comments?.map((c: SlideComment) => ({ ...c, read: true })) })) }));
  const unread = targets.filter((t) => !t.comment.read).length;
  return (
    <>
      <RibbonGroup label="Soát lỗi">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('thesaurus')} title="Từ điển đồng nghĩa (Shift+F7)">
          <BookA size={20} color="#2563EB" />
          <span>Từ đồng nghĩa</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Trợ năng">
        <DropButton large icon={<Accessibility size={20} color="#16A34A" />} label="Trợ năng" title="Kiểm tra trợ năng (F7)" onMain={() => x.togglePane('accessibility')} menuWidth={220}>
          {(close) => (
            <>
              <MenuItem icon={<ListChecks size={14} />} label="Kiểm tra trợ năng" onClick={() => { close(); x.togglePane('accessibility'); }} />
              <MenuItem icon={<Accessibility size={14} />} label="Văn bản thay thế…" disabled={!x.selectedElement} onClick={() => { close(); x.openDialog('alt-text'); }} />
              <MenuItem icon={<Rows3 size={14} />} label="Thứ tự đọc (Ngăn chọn)" onClick={() => { close(); x.togglePane('selection'); }} />
            </>
          )}
        </DropButton>
      </RibbonGroup>
      <RibbonGroup label="Ngôn ngữ">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('translate')} title="Dịch văn bản đang chọn hoặc cả trang">
          <Languages size={20} color="#0284C7" />
          <span>Dịch</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('language')} title="Ngôn ngữ soát chính tả">
          <SpellCheck2 size={20} color="#475569" />
          <span>Ngôn ngữ</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Hoạt động">
        <button type="button" className="ppt-tool-btn-large" disabled={unread === 0} onClick={markAllRead} title="Đánh dấu tất cả nhận xét là đã đọc">
          <CheckCheck size={20} color="#16A34A" />
          <span>Đã đọc hết</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={onOpenDiff} title="So sánh thay đổi giữa các phiên bản trang">
          <GitCompare size={20} color="#7C3AED" />
          <span>Hiện thay đổi</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Nhận xét">
        <button type="button" className="ppt-tool-btn-large" onClick={() => { if (x.pane !== 'comments') x.togglePane('comments'); window.dispatchEvent(new CustomEvent('minh-slides:new-comment')); }} title="Nhận xét mới (Ctrl+Alt+M)">
          <MessageSquarePlus size={20} color="#0284C7" />
          <span>Nhận xét mới</span>
        </button>
        <DropButton large icon={<MessageSquareX size={20} color="#DC2626" />} label="Xóa" title="Xóa nhận xét" disabled={targets.length === 0} menuWidth={260}>
          {(close) => (
            <>
              <MenuItem label="Xóa tất cả nhận xét trên trang này" onClick={() => { close(); deleteComments('slide'); }} />
              <MenuItem label="Xóa tất cả nhận xét trong bài" onClick={() => { close(); deleteComments('all'); }} />
            </>
          )}
        </DropButton>
        <button type="button" className="ppt-tool-btn-large" disabled={targets.length === 0} onClick={() => navigate(-1)} title="Nhận xét trước">
          <MessageSquareDashed size={20} />
          <span>Trước</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" disabled={targets.length === 0} onClick={() => navigate(1)} title="Nhận xét tiếp">
          <MessageSquareMore size={20} />
          <span>Tiếp</span>
        </button>
        <button type="button" className={`ppt-tool-btn-large ${x.pane === 'comments' ? 'is-active' : ''}`} onClick={() => x.togglePane('comments')} title="Hiện ngăn Nhận xét">
          <Speech size={20} color="#0284C7" />
          <span>Hiện nhận xét</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Mực">
        <button type="button" className={`ppt-tool-btn-large ${x.hideInk ? 'is-active' : ''}`} onClick={() => x.setHideInk(!x.hideInk)} title="Ẩn/hiện nét mực vẽ tay">
          <PenOff size={20} color="#475569" />
          <span>{x.hideInk ? 'Hiện mực' : 'Ẩn mực'}</span>
        </button>
      </RibbonGroup>
    </>
  );
}

export function ViewExtras() {
  const x = useSlideExtras();
  return (
    <>
      <RibbonGroup label="Dạng xem khác">
        <button type="button" className={`ppt-tool-btn-large ${x.viewMode === 'outline' ? 'is-active' : ''}`} onClick={() => x.setViewMode('outline')} title="Dạng xem Dàn ý">
          <NotebookText size={20} color="#2563EB" />
          <span>Dàn ý</span>
        </button>
        <button type="button" className={`ppt-tool-btn-large ${x.viewMode === 'notes' ? 'is-active' : ''}`} onClick={() => x.setViewMode('notes')} title="Trang ghi chú">
          <NotebookPen size={20} color="#16A34A" />
          <span>Trang ghi chú</span>
        </button>
        <button type="button" className={`ppt-tool-btn-large ${x.viewMode === 'reading' ? 'is-active' : ''}`} onClick={() => x.launchShow({ fromCurrent: true, windowed: true })} title="Dạng xem Đọc: trình chiếu trong cửa sổ">
          <BookOpenCheck size={20} color="#D97706" />
          <span>Dạng xem Đọc</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Dạng xem cái">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('handout-master')} title="Bản cái tài liệu phát tay">
          <PanelsTopLeft size={20} color="#475569" />
          <span>Bản cái phát tay</span>
        </button>
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('notes-master')} title="Bản cái ghi chú">
          <LayoutPanelTop size={20} color="#475569" />
          <span>Bản cái ghi chú</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="Màu/Thang xám">
        <div className="ppx-col ppx-col-tight">
          <button type="button" className={`ppt-tool-btn ppx-labeled ${x.colorView === 'color' ? 'is-active' : ''}`} onClick={() => x.setColorView('color')} title="Hiển thị màu đầy đủ">
            <Palette size={14} /> <span>Màu</span>
          </button>
          <button type="button" className={`ppt-tool-btn ppx-labeled ${x.colorView === 'grayscale' ? 'is-active' : ''}`} onClick={() => x.setColorView('grayscale')} title="Thang xám">
            <Contrast size={14} /> <span>Thang xám</span>
          </button>
          <button type="button" className={`ppt-tool-btn ppx-labeled ${x.colorView === 'black-white' ? 'is-active' : ''}`} onClick={() => x.setColorView('black-white')} title="Đen trắng">
            <SquareStack size={14} /> <span>Đen trắng</span>
          </button>
        </div>
      </RibbonGroup>
      <RibbonGroup label="Cửa sổ">
        <button type="button" className="ppt-tool-btn-large" onClick={x.openNewWindow} title="Mở bài này trong cửa sổ mới">
          <AppWindow size={20} color="#2563EB" />
          <span>Cửa sổ mới</span>
        </button>
        <div className="ppx-col ppx-col-tight">
          <button type="button" className="ppt-tool-btn ppx-labeled" onClick={() => x.arrangeWindows('tile')} title="Xếp cạnh nhau các cửa sổ đang mở">
            <Columns2 size={14} /> <span>Xếp tất cả</span>
          </button>
          <button type="button" className="ppt-tool-btn ppx-labeled" onClick={() => x.arrangeWindows('cascade')} title="Xếp chồng lớp các cửa sổ">
            <Rows3 size={14} /> <span>Xếp lớp</span>
          </button>
          <button type="button" className="ppt-tool-btn ppx-labeled" onClick={x.focusSplit} title="Di chuyển vạch chia giữa các ngăn bằng phím mũi tên">
            <SquareSplitHorizontal size={14} /> <span>Dời vạch chia</span>
          </button>
        </div>
      </RibbonGroup>
      <RibbonGroup label="Macro">
        <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('macros')} title="Macro: ghi chuỗi thao tác và chạy lại">
          <Code size={20} color="#475569" />
          <span>Macro</span>
        </button>
      </RibbonGroup>
    </>
  );
}

