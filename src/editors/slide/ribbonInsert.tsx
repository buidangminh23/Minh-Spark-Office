import { useState } from 'react';
import {
  AppWindow, AudioLines, BookImage, CalendarClock, Camera, FileBox, Hash, Image as ImageIcon, Link, MessageSquarePlus, MonitorPlay, Music,
  Omega, Shapes, Sheet, Table, UserRound, Video, WandSparkles, MousePointerClick, PanelBottom, Mic, Upload,
} from 'lucide-react';
import type { SlideData, SlideElement } from '../../lib/slideTypes';
import { WORDART_PRESETS } from '../../lib/slideTextOps';
import { captureScreenFrame, imageAspect } from '../../lib/slideImageOps';
import { createSlideFromLayout } from '../../lib/slideTemplates';
import { baseTheme, remapSlideTheme } from '../../lib/slideThemeOps';
import { readAsDataUrl } from '../../lib/download';
import { slideBaseWidth } from '../../lib/settings/slideOptions';
import { DropButton, MenuItem, MenuSeparator, MenuTitle } from './ribbonParts';
import { newElementId, useSlideExtras } from './slideExtrasContext';
import { textElement } from './ribbonHome';

const GRID_COLS = 10;
const GRID_ROWS = 8;
const MAX_MEDIA_BYTES = 60 * 1024 * 1024;

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export function TableGridButton({ onInsert, onOpenSheets }: { onInsert: (rows: number, cols: number) => void; onOpenSheets?: () => void }) {
  const x = useSlideExtras();
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  return (
    <DropButton large icon={<Table size={20} color="#D83B01" />} label="Bảng" title="Chèn bảng" menuWidth={250}>
      {(close) => (
        <>
          <MenuTitle>{hover.rows ? `Bảng ${hover.cols}x${hover.rows}` : 'Chèn bảng'}</MenuTitle>
          <div className="ppx-table-grid" onPointerLeave={() => setHover({ rows: 0, cols: 0 })}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
              const row = Math.floor(index / GRID_COLS) + 1;
              const col = (index % GRID_COLS) + 1;
              const lit = row <= hover.rows && col <= hover.cols;
              return (
                <button
                  type="button"
                  key={index}
                  className={`ppx-table-cell ${lit ? 'is-lit' : ''}`}
                  onPointerEnter={() => setHover({ rows: row, cols: col })}
                  onClick={() => { close(); onInsert(row, col); }}
                  aria-label={`Bảng ${col} cột ${row} hàng`}
                />
              );
            })}
          </div>
          <MenuSeparator />
          <MenuItem icon={<Table size={14} />} label="Chèn bảng…" onClick={() => { close(); x.openDialog('insert-table'); }} />
          {onOpenSheets && <MenuItem icon={<Sheet size={14} />} label="Bảng tính 23 Sheets…" onClick={() => { close(); onOpenSheets(); }} />}
        </>
      )}
    </DropButton>
  );
}

export function PictureSourceButtons({ onUploadPicture }: { onUploadPicture: () => void }) {
  const x = useSlideExtras();
  const screenshot = async () => {
    try {
      const src = await captureScreenFrame();
      const ratio = await imageAspect(src);
      x.addElement(imageEl(src, ratio, slideBaseWidth(x.presentation.aspectRatio) / 540, 'Ảnh chụp màn hình'));
      x.toast('Đã chèn ảnh chụp màn hình');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      x.toast(error instanceof Error ? error.message : 'Không chụp được màn hình', true);
    }
  };
  const photoAlbum = async () => {
    const files = await pickFiles('image/*', true);
    if (files.length === 0) return;
    const slides: SlideData[] = [];
    const slideAspect = slideBaseWidth(x.presentation.aspectRatio) / 540;
    for (const [index, file] of files.entries()) {
      const src = await readAsDataUrl(file);
      const ratio = await imageAspect(src).catch(() => 4 / 3);
      const base = remapSlideTheme(createSlideFromLayout('title-only', x.presentation.slides.length + index, x.presentation.themeId, file.name.replace(/\.[^.]+$/, '')), baseTheme(x.presentation.themeId), x.theme);
      const picture = imageEl(src, ratio, slideAspect, file.name);
      const fitted = { ...picture, y: 22, height: Math.min(72, picture.height), width: Math.min(90, picture.width) };
      fitted.x = (100 - fitted.width) / 2;
      slides.push({ ...base, elements: [...base.elements, fitted] });
    }
    x.commit((p) => ({ ...p, slides: [...p.slides.slice(0, x.activeSlideIndex + 1), ...slides, ...p.slides.slice(x.activeSlideIndex + 1)] }));
    x.goToSlide(x.activeSlideIndex + 1);
    x.toast(`Đã tạo album ${files.length} ảnh`);
  };
  return (
    <>
      <DropButton large icon={<ImageIcon size={20} color="#107C41" />} label="Hình ảnh" title="Chèn hình ảnh từ máy tính" onMain={onUploadPicture} menuWidth={220}>
        {(close) => (
          <>
            <MenuItem icon={<Upload size={14} />} label="Từ thiết bị này…" onClick={() => { close(); onUploadPicture(); }} />
            <MenuItem icon={<MonitorPlay size={14} />} label="Ảnh chụp màn hình" onClick={() => { close(); void screenshot(); }} />
            <MenuItem icon={<BookImage size={14} />} label="Album ảnh…" onClick={() => { close(); void photoAlbum(); }} />
          </>
        )}
      </DropButton>
      <button type="button" className="ppt-tool-btn-large" onClick={() => void screenshot()} title="Chụp một cửa sổ hoặc màn hình rồi chèn vào trang">
        <Camera size={20} color="#0284C7" />
        <span>Chụp màn hình</span>
      </button>
      <button type="button" className="ppt-tool-btn-large" onClick={() => void photoAlbum()} title="Tạo album: mỗi ảnh một trang chiếu">
        <BookImage size={20} color="#7C3AED" />
        <span>Album ảnh</span>
      </button>
    </>
  );
}

export function imageEl(src: string, ratio: number, slideAspect: number, name: string): SlideElement {
  const width = 50;
  const height = Math.min(80, (width * slideAspect) / ratio);
  return { id: newElementId('img'), type: 'image', src, x: (100 - width) / 2, y: (100 - height) / 2, width, height, objectFit: 'contain', name, altText: '' };
}

export function CameoButton() {
  const x = useSlideExtras();
  const insert = () => {
    x.addElement({ id: newElementId('cameo'), type: 'cameo', x: 72, y: 62, width: 20, height: 20 * (slideBaseWidth(x.presentation.aspectRatio) / 540), cameoData: { shape: 'circle', mirror: true }, stroke: '#FFFFFF', strokeWidth: 3, name: 'Cameo', altText: 'Hình ảnh trực tiếp của người thuyết trình' });
    x.toast('Đã chèn Cameo: camera trực tiếp sẽ hiện khi trình chiếu');
  };
  return (
    <button type="button" className="ppt-tool-btn-large" onClick={insert} title="Chèn camera trực tiếp (Cameo) vào trang">
      <UserRound size={20} color="#16A34A" />
      <span>Cameo</span>
    </button>
  );
}

export function IconsButton() {
  const x = useSlideExtras();
  return (
    <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('icons')} title="Chèn biểu tượng">
      <Shapes size={20} color="#2563EB" />
      <span>Biểu tượng</span>
    </button>
  );
}

export function LinkButtons() {
  const x = useSlideExtras();
  return (
    <>
      <button type="button" className="ppt-tool-btn-large" disabled={!x.selectedElement} onClick={() => x.openDialog('link')} title="Chèn liên kết (Ctrl+K)">
        <Link size={20} color="#2563EB" />
        <span>Liên kết</span>
      </button>
      <button type="button" className="ppt-tool-btn-large" disabled={!x.selectedElement} onClick={() => x.openDialog('link')} title="Hành động khi bấm hoặc rê chuột">
        <MousePointerClick size={20} color="#D97706" />
        <span>Hành động</span>
      </button>
    </>
  );
}

export function CommentButton() {
  const x = useSlideExtras();
  return (
    <button type="button" className="ppt-tool-btn-large" onClick={() => x.togglePane('comments')} title="Thêm nhận xét (Ctrl+Alt+M)">
      <MessageSquarePlus size={20} color="#0284C7" />
      <span>Nhận xét</span>
    </button>
  );
}

export function TextInsertButtons() {
  const x = useSlideExtras();
  const font = x.theme.bodyFont;
  const color = x.theme.textColor;
  const insertWordArt = (presetId: string) => {
    const preset = WORDART_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    x.addElement(textElement({ x: 15, y: 38, width: 70, height: 22, text: 'Nhập chữ nghệ thuật tại đây', fontSize: 54, textAlign: 'center', verticalAlign: 'middle', wordArt: preset.id, ...preset.patch, name: 'WordArt' }, x.theme.titleFont, color));
  };
  return (
    <>
      <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('header-footer')} title="Đầu trang và chân trang">
        <PanelBottom size={20} color="#475569" />
        <span>Đầu & chân trang</span>
      </button>
      <DropButton large icon={<WandSparkles size={20} color="#D83B01" />} label="WordArt" title="Chèn chữ nghệ thuật" menuWidth={240}>
        {(close) => (
          <div className="ppx-wordart-grid">
            {WORDART_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className="ppx-wordart-cell"
                title={preset.label}
                onClick={() => { close(); insertWordArt(preset.id); }}
                style={{
                  color: preset.patch.textGradient ? 'transparent' : preset.patch.color,
                  backgroundImage: preset.patch.textGradient,
                  WebkitBackgroundClip: preset.patch.textGradient ? 'text' : undefined,
                  WebkitTextStroke: preset.patch.textOutline ? `1px ${preset.patch.textOutline}` : undefined,
                  textShadow: preset.patch.textGlow ? `0 0 6px ${preset.patch.textGlow}` : preset.patch.textShadow ? '0 2px 3px rgba(0,0,0,.35)' : undefined,
                }}
              >
                A
              </button>
            ))}
          </div>
        )}
      </DropButton>
      <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('date-time')} title="Chèn ngày và giờ">
        <CalendarClock size={20} color="#0284C7" />
        <span>Ngày & giờ</span>
      </button>
      <button
        type="button"
        className="ppt-tool-btn-large"
        onClick={() => {
          if (x.selectedElement?.type === 'text') {
            x.updateSelected({ field: 'slide-number' });
            return;
          }
          x.addElement(textElement({ x: 88, y: 90, width: 9, height: 7, field: 'slide-number', text: '', fontSize: 14, textAlign: 'right', name: 'Số trang chiếu' }, font, color));
        }}
        title="Chèn số trang chiếu tự cập nhật"
      >
        <Hash size={20} color="#475569" />
        <span>Số trang</span>
      </button>
      <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('object')} title="Nhúng tệp (PDF, Word, Excel…) vào trang">
        <FileBox size={20} color="#2563EB" />
        <span>Đối tượng</span>
      </button>
    </>
  );
}

export function SymbolButton() {
  const x = useSlideExtras();
  return (
    <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('symbol')} title="Chèn ký hiệu đặc biệt">
      <Omega size={20} color="#475569" />
      <span>Ký hiệu</span>
    </button>
  );
}

export function MediaButtons({ onAddSampleVideo }: { onAddSampleVideo: () => void }) {
  const x = useSlideExtras();
  const insertVideoFile = async () => {
    const [file] = await pickFiles('video/*', false);
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      x.toast('Video lớn hơn 60 MB. Hãy cắt ngắn hoặc nén video trước khi chèn.', true);
      return;
    }
    const url = await readAsDataUrl(file);
    x.addElement({ id: newElementId('video'), type: 'video', x: 15, y: 15, width: 70, height: 70, name: file.name, videoData: { url, autoplay: false, loop: false, shape: 'rounded' }, altText: file.name });
    x.toast('Đã chèn video');
  };
  const insertAudioFile = async () => {
    const [file] = await pickFiles('audio/*', false);
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      x.toast('Tệp âm thanh lớn hơn 60 MB.', true);
      return;
    }
    const url = await readAsDataUrl(file);
    x.addElement({ id: newElementId('audio'), type: 'audio', x: 42, y: 44, width: 22, height: 12, name: file.name, audioData: { url, name: file.name, autoplay: false, loop: false, volume: 1 } });
    x.toast('Đã chèn âm thanh');
  };
  return (
    <>
      <DropButton large icon={<Video size={20} color="#DC2626" />} label="Video" title="Chèn video" menuWidth={220}>
        {(close) => (
          <>
            <MenuItem icon={<Upload size={14} />} label="Video trên thiết bị này…" onClick={() => { close(); void insertVideoFile(); }} />
            <MenuItem icon={<Video size={14} />} label="Video Studio (cắt ghép video)" onClick={() => { close(); onAddSampleVideo(); }} />
          </>
        )}
      </DropButton>
      <DropButton large icon={<Music size={20} color="#7C3AED" />} label="Âm thanh" title="Chèn âm thanh" menuWidth={220}>
        {(close) => (
          <>
            <MenuItem icon={<AudioLines size={14} />} label="Âm thanh trên máy tính…" onClick={() => { close(); void insertAudioFile(); }} />
            <MenuItem icon={<Mic size={14} />} label="Ghi âm…" onClick={() => { close(); x.openDialog('record-audio'); }} />
          </>
        )}
      </DropButton>
      <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('screen-record')} title="Quay màn hình rồi chèn video vào trang">
        <AppWindow size={20} color="#0284C7" />
        <span>Quay màn hình</span>
      </button>
    </>
  );
}
