import {
  Accessibility, Brush, Crop, Droplets, Eraser, FlipHorizontal2, FlipVertical2, ImageDown, ImageMinus, Paintbrush2, Palette, PanelRightOpen,
  Proportions, RefreshCw, RotateCcw, RotateCw, Sparkle, SunMedium, Type, WandSparkles, Replace, Wallpaper, ImageOff,
} from 'lucide-react';
import type { SlideElement, ThemeOverrides } from '../../lib/slideTypes';
import {
  COLOR_SCHEMES, FONT_PAIRS, THEME_EFFECTS, THEME_VARIANT_LABELS, applyThemeOverrides, backgroundCss, backgroundStyles, baseTheme, themeVariant,
} from '../../lib/slideThemeOps';
import {
  ARTISTIC_EFFECTS, ASPECT_CROPS, CORRECTION_PRESETS, RECOLOR_PRESETS, SATURATION_PRESETS, SHARPNESS_PRESETS, TEMPERATURE_PRESETS,
  cropToAspect, imageFilterCss, removeBackground,
} from '../../lib/slideImageOps';
import { SLIDE_ASPECTS, slideBaseWidth } from '../../lib/settings/slideOptions';
import { WORDART_PRESETS } from '../../lib/slideTextOps';
import { readAsDataUrl } from '../../lib/download';
import { DropButton, MenuItem, MenuSeparator, MenuTitle, SwatchGrid } from './ribbonParts';
import { useSlideExtras } from './slideExtrasContext';

const TEXT_COLORS = ['#000000', '#FFFFFF', '#1E293B', '#475569', '#D83B01', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#0284C7', '#2563EB', '#7C3AED', '#DB2777', '#78350F'];

export function ThemeCustomizeGroups() {
  const x = useSlideExtras();
  const overrides = x.presentation.themeOverrides ?? {};
  const base = baseTheme(x.presentation.themeId);
  const apply = (next: ThemeOverrides) => x.commit((p) => applyThemeOverrides(p, next));
  return (
    <>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <div className="ppx-variants">
            {THEME_VARIANT_LABELS.map((label, index) => {
              const variant = { ...base, ...themeVariant(base, index) };
              return (
                <button
                  type="button"
                  key={label}
                  className={`ppx-variant ${(overrides.variant ?? 0) === index ? 'is-active' : ''}`}
                  title={`Biến thể: ${label}`}
                  onClick={() => apply({ ...overrides, variant: index })}
                  style={{ background: variant.backgroundColor }}
                >
                  <span style={{ background: variant.primaryColor }} />
                  <span style={{ background: variant.secondaryColor }} />
                  <span style={{ background: variant.accentColor }} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="ppt-group-footer">Biến thể</div>
      </div>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <DropButton large icon={<Palette size={20} color="#D83B01" />} label="Màu" title="Bảng màu chủ đề" menuWidth={260}>
            {(close) => (
              <>
                <MenuTitle>Bảng màu</MenuTitle>
                {COLOR_SCHEMES.map((scheme) => (
                  <MenuItem
                    key={scheme.id}
                    active={overrides.colorSchemeId === scheme.id}
                    icon={<span className="ppx-scheme">{[scheme.colors.primaryColor, scheme.colors.secondaryColor, scheme.colors.accentColor, scheme.colors.titleColor].map((c) => <i key={c} style={{ background: c }} />)}</span>}
                    label={scheme.name}
                    onClick={() => { close(); apply({ ...overrides, colorSchemeId: scheme.id, colors: { ...overrides.colors, ...scheme.colors } }); }}
                  />
                ))}
                <MenuSeparator />
                <MenuItem label="Khôi phục màu của chủ đề" onClick={() => { close(); apply({ ...overrides, colorSchemeId: undefined, colors: undefined }); }} />
              </>
            )}
          </DropButton>
          <DropButton large icon={<Type size={20} color="#2563EB" />} label="Phông" title="Bộ phông chủ đề" menuWidth={270}>
            {(close) => (
              <>
                <MenuTitle>Phông tiêu đề / nội dung</MenuTitle>
                {FONT_PAIRS.map((pair) => (
                  <MenuItem
                    key={pair.id}
                    active={overrides.fonts?.id === pair.id}
                    icon={<span style={{ fontFamily: pair.titleFont, fontWeight: 700 }}>Aa</span>}
                    label={<span><b style={{ fontFamily: pair.titleFont }}>{pair.name}</b></span>}
                    onClick={() => { close(); apply({ ...overrides, fonts: { id: pair.id, titleFont: pair.titleFont, bodyFont: pair.bodyFont } }); }}
                  />
                ))}
              </>
            )}
          </DropButton>
          <DropButton large icon={<Sparkle size={20} color="#7C3AED" />} label="Hiệu ứng" title="Hiệu ứng chủ đề cho hình và ảnh" menuWidth={200}>
            {(close) => (
              <>
                {THEME_EFFECTS.map(([id, label]) => (
                  <MenuItem key={id} label={label} active={(overrides.effects ?? 'none') === id} onClick={() => { close(); apply({ ...overrides, effects: id }); }} />
                ))}
              </>
            )}
          </DropButton>
          <DropButton large icon={<Wallpaper size={20} color="#0284C7" />} label="Kiểu nền" title="Kiểu nền trang chiếu" menuWidth={252}>
            {(close) => (
              <>
                <div className="ppx-bg-grid">
                  {backgroundStyles(x.theme).map((bg, index) => (
                    <button
                      type="button"
                      key={index}
                      className="ppx-bg-cell"
                      style={{ background: backgroundCss(bg) }}
                      title={`Kiểu ${index + 1}. Bấm để áp cho trang này, giữ Shift để áp cho tất cả`}
                      onClick={(event) => {
                        close();
                        const all = event.shiftKey;
                        x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (all || i === x.activeSlideIndex ? { ...s, background: bg } : s)) }));
                      }}
                    />
                  ))}
                </div>
                <MenuSeparator />
                <MenuItem
                  label="Áp kiểu nền hiện tại cho tất cả trang"
                  onClick={() => { close(); x.commit((p) => ({ ...p, slides: p.slides.map((s) => ({ ...s, background: x.currentSlide.background })) })); }}
                />
                <MenuItem
                  label={x.currentSlide.hideBackgroundGraphics ? 'Hiện đồ họa nền' : 'Ẩn đồ họa nền (đầu/chân trang, logo)'}
                  onClick={() => { close(); x.commit((p) => ({ ...p, slides: p.slides.map((s, i) => (i === x.activeSlideIndex ? { ...s, hideBackgroundGraphics: !s.hideBackgroundGraphics } : s)) })); }}
                />
              </>
            )}
          </DropButton>
        </div>
        <div className="ppt-group-footer">Tùy biến</div>
      </div>
    </>
  );
}

export function SlideSizeMenu({ onChange }: { onChange: (aspect: (typeof SLIDE_ASPECTS)[number]['id']) => void }) {
  const x = useSlideExtras();
  return (
    <DropButton large icon={<Proportions size={20} color="#475569" />} label="Kích cỡ" title="Kích cỡ trang chiếu" menuWidth={260}>
      {(close) => (
        <>
          {SLIDE_ASPECTS.slice(0, 2).map((item) => (
            <MenuItem key={item.id} label={item.label} hint={item.description} active={x.presentation.aspectRatio === item.id} onClick={() => { close(); onChange(item.id); }} />
          ))}
          <MenuSeparator />
          <MenuItem label="Tùy chỉnh kích cỡ trang chiếu…" onClick={() => { close(); x.openDialog('slide-size'); }} />
        </>
      )}
    </DropButton>
  );
}

function patchSelected(x: ReturnType<typeof useSlideExtras>, patch: (el: SlideElement) => Partial<SlideElement>) {
  x.updateSelected(patch);
}

export function PictureFormatExtras() {
  const x = useSlideExtras();
  const el = x.selectedElement;
  if (!el || el.type !== 'image') return null;
  const adjust = el.imageAdjust ?? {};
  const setAdjust = (next: Partial<NonNullable<SlideElement['imageAdjust']>>) => patchSelected(x, (item) => ({ imageAdjust: { ...(item.imageAdjust ?? {}), ...next } }));
  const preview = (extra: NonNullable<SlideElement['imageAdjust']>) => ({ backgroundImage: `url("${el.src}")`, filter: imageFilterCss({ ...extra }) });
  const removeBg = async () => {
    if (!el.src) return;
    try {
      const out = await removeBackground(el.src);
      x.updateElement(el.id, { src: out, originalSrc: el.originalSrc ?? el.src });
      x.toast('Đã xóa nền dựa trên màu ở các góc ảnh');
    } catch (error) {
      x.toast(error instanceof Error ? error.message : 'Không xử lý được ảnh này', true);
    }
  };
  const changePicture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      x.updateElement(el.id, { src: await readAsDataUrl(file), originalSrc: undefined, crop: undefined });
    };
    input.click();
  };
  const slideAspect = slideBaseWidth(x.presentation.aspectRatio) / 540;
  return (
    <>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <button type="button" className="ppt-tool-btn-large" onClick={() => void removeBg()} title="Xóa nền ảnh">
            <ImageMinus size={20} color="#DC2626" />
            <span>Xóa nền</span>
          </button>
          <DropButton large icon={<SunMedium size={20} color="#CA8A04" />} label="Hiệu chỉnh" title="Độ sắc nét, độ sáng và tương phản" menuWidth={330}>
            {(close) => (
              <>
                <MenuTitle>Làm sắc nét / làm mềm</MenuTitle>
                <div className="ppx-thumb-row">
                  {SHARPNESS_PRESETS.map((value) => (
                    <button type="button" key={value} className="ppx-thumb" title={`${value > 0 ? 'Làm sắc' : value < 0 ? 'Làm mềm' : 'Gốc'} ${Math.abs(value)}%`} style={preview({ ...adjust, sharpness: value })} onClick={() => { close(); setAdjust({ sharpness: value }); }} />
                  ))}
                </div>
                <MenuTitle>Độ sáng / tương phản</MenuTitle>
                <div className="ppx-thumb-grid">
                  {CORRECTION_PRESETS.map((preset) => (
                    <button type="button" key={preset.label} className="ppx-thumb" title={preset.label} style={preview({ ...adjust, brightness: preset.brightness, contrast: preset.contrast })} onClick={() => { close(); setAdjust({ brightness: preset.brightness, contrast: preset.contrast }); }} />
                  ))}
                </div>
              </>
            )}
          </DropButton>
          <DropButton large icon={<Droplets size={20} color="#2563EB" />} label="Màu" title="Độ bão hòa, tông màu và tô màu lại" menuWidth={330}>
            {(close) => (
              <>
                <MenuTitle>Độ bão hòa</MenuTitle>
                <div className="ppx-thumb-row">
                  {SATURATION_PRESETS.map((value) => (
                    <button type="button" key={value} className="ppx-thumb" title={`Bão hòa ${value}%`} style={preview({ ...adjust, saturation: value })} onClick={() => { close(); setAdjust({ saturation: value }); }} />
                  ))}
                </div>
                <MenuTitle>Tông màu</MenuTitle>
                <div className="ppx-thumb-row">
                  {TEMPERATURE_PRESETS.map((value) => (
                    <button type="button" key={value} className="ppx-thumb" title={`Nhiệt độ ${value}K`} style={preview({ ...adjust, temperature: value })} onClick={() => { close(); setAdjust({ temperature: value }); }} />
                  ))}
                </div>
                <MenuTitle>Tô màu lại</MenuTitle>
                <div className="ppx-thumb-row is-wrap">
                  {RECOLOR_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className="ppx-thumb"
                      title={preset.label}
                      style={preview(preset.adjust)}
                      onClick={() => { close(); patchSelected(x, (item) => ({ imageAdjust: { ...(item.imageAdjust ?? {}), grayscale: undefined, sepia: undefined, hue: undefined, invert: undefined, ...preset.adjust, recolor: preset.id } })); }}
                    />
                  ))}
                </div>
              </>
            )}
          </DropButton>
          <DropButton large icon={<Paintbrush2 size={20} color="#7C3AED" />} label="Nghệ thuật" title="Hiệu ứng nghệ thuật" menuWidth={300}>
            {(close) => (
              <div className="ppx-thumb-row is-wrap">
                {ARTISTIC_EFFECTS.map((effect) => (
                  <button type="button" key={effect.id} className="ppx-thumb is-labeled" title={effect.label} style={preview({ artistic: effect.id })} onClick={() => { close(); setAdjust({ artistic: effect.id === 'none' ? undefined : effect.id }); }}>
                    <span>{effect.label}</span>
                  </button>
                ))}
              </div>
            )}
          </DropButton>
          <div className="ppx-col ppx-col-tight">
            <button type="button" className="ppt-tool-btn ppx-labeled" onClick={() => x.openDialog('compress')} title="Nén ảnh để giảm dung lượng tệp">
              <ImageDown size={14} /> <span>Nén ảnh</span>
            </button>
            <button type="button" className="ppt-tool-btn ppx-labeled" onClick={changePicture} title="Thay ảnh khác, giữ nguyên vị trí và kích cỡ">
              <Replace size={14} /> <span>Đổi ảnh</span>
            </button>
            <button type="button" className="ppt-tool-btn ppx-labeled" onClick={() => x.updateElement(el.id, { imageAdjust: undefined, crop: undefined, src: el.originalSrc ?? el.src, originalSrc: undefined })} title="Đặt lại ảnh và kích cỡ">
              <RefreshCw size={14} /> <span>Đặt lại ảnh</span>
            </button>
          </div>
        </div>
        <div className="ppt-group-footer">Điều chỉnh</div>
      </div>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('alt-text')} title="Văn bản thay thế cho trình đọc màn hình">
            <Accessibility size={20} color="#16A34A" />
            <span>Văn bản thay thế</span>
          </button>
          <DropButton large icon={<Crop size={20} color="#475569" />} label="Cắt" title="Cắt ảnh" onMain={() => x.openDialog('crop')} menuWidth={210}>
            {(close) => (
              <>
                <MenuItem icon={<Crop size={14} />} label="Cắt…" onClick={() => { close(); x.openDialog('crop'); }} />
                <MenuTitle>Tỷ lệ khung hình</MenuTitle>
                {ASPECT_CROPS.map(([label, ratio]) => (
                  <MenuItem key={label} label={label} onClick={() => { close(); x.updateElement(el.id, { crop: cropToAspect(el, ratio, slideAspect) }); }} />
                ))}
                <MenuSeparator />
                <MenuItem icon={<ImageOff size={14} />} label="Bỏ cắt" onClick={() => { close(); x.updateElement(el.id, { crop: undefined }); }} />
              </>
            )}
          </DropButton>
          <SizeAndRotate />
        </div>
        <div className="ppt-group-footer">Kích cỡ & trợ năng</div>
      </div>
    </>
  );
}

export function SizeAndRotate() {
  const x = useSlideExtras();
  const el = x.selectedElement;
  if (!el) return null;
  const rotate = (delta: number) => x.updateSelected((item) => ({ rotation: (((item.rotation ?? 0) + delta) % 360 + 360) % 360 }));
  return (
    <div className="ppx-col ppx-col-tight">
      <label className="ppx-size-input" title="Chiều cao (% chiều cao trang)">
        <span>Cao</span>
        <input type="number" min={1} max={100} step={0.5} value={Math.round(el.height * 10) / 10} onChange={(e) => x.updateElement(el.id, { height: Math.max(1, Number(e.target.value)) })} />
      </label>
      <label className="ppx-size-input" title="Chiều rộng (% chiều rộng trang)">
        <span>Rộng</span>
        <input type="number" min={1} max={100} step={0.5} value={Math.round(el.width * 10) / 10} onChange={(e) => x.updateElement(el.id, { width: Math.max(1, Number(e.target.value)) })} />
      </label>
      <DropButton icon={<RotateCw size={14} />} label="Xoay" title="Xoay và lật" menuWidth={190}>
        {(close) => (
          <>
            <MenuItem icon={<RotateCw size={14} />} label="Xoay phải 90°" onClick={() => { close(); rotate(90); }} />
            <MenuItem icon={<RotateCcw size={14} />} label="Xoay trái 90°" onClick={() => { close(); rotate(-90); }} />
            <MenuItem icon={<FlipVertical2 size={14} />} label="Lật dọc" onClick={() => { close(); x.updateSelected((item) => ({ flipV: !item.flipV })); }} />
            <MenuItem icon={<FlipHorizontal2 size={14} />} label="Lật ngang" onClick={() => { close(); x.updateSelected((item) => ({ flipH: !item.flipH })); }} />
            <MenuSeparator />
            <MenuItem label="Kích cỡ và vị trí…" onClick={() => { close(); x.openDialog('size-position'); }} />
          </>
        )}
      </DropButton>
    </div>
  );
}

export function ShapeFormatExtras() {
  const x = useSlideExtras();
  const el = x.selectedElement;
  if (!el || el.type !== 'shape') return null;
  return (
    <>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <DropButton large icon={<WandSparkles size={20} color="#D83B01" />} label="Kiểu WordArt" title="Kiểu chữ nghệ thuật cho chữ trong hình" menuWidth={240}>
            {(close) => (
              <div className="ppx-wordart-grid">
                {WORDART_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className="ppx-wordart-cell"
                    title={preset.label}
                    onClick={() => { close(); x.updateSelected({ wordArt: preset.id, ...preset.patch }); }}
                    style={{ color: preset.patch.textGradient ? 'transparent' : preset.patch.color, backgroundImage: preset.patch.textGradient, WebkitBackgroundClip: preset.patch.textGradient ? 'text' : undefined, WebkitTextStroke: preset.patch.textOutline ? `1px ${preset.patch.textOutline}` : undefined }}
                  >
                    A
                  </button>
                ))}
              </div>
            )}
          </DropButton>
          <div className="ppx-col ppx-col-tight">
            <DropButton icon={<Brush size={14} color={el.color ?? '#FFFFFF'} />} label="Tô chữ" title="Màu tô chữ" menuWidth={150}>
              {(close) => <SwatchGrid colors={TEXT_COLORS} onPick={(color) => { close(); x.updateSelected({ color: color ?? '#FFFFFF', textGradient: undefined }); }} />}
            </DropButton>
            <DropButton icon={<Eraser size={14} color={el.textOutline ?? '#64748B'} />} label="Viền chữ" title="Màu viền chữ" menuWidth={150}>
              {(close) => <SwatchGrid colors={TEXT_COLORS} none="Không viền" onPick={(color) => { close(); x.updateSelected({ textOutline: color }); }} />}
            </DropButton>
            <DropButton icon={<Sparkle size={14} />} label="Hiệu ứng chữ" title="Phát sáng, đổ bóng chữ" menuWidth={170}>
              {(close) => (
                <>
                  <MenuItem label={el.textShadow ? 'Bỏ đổ bóng' : 'Đổ bóng'} onClick={() => { close(); x.updateSelected((item) => ({ textShadow: !item.textShadow })); }} />
                  <MenuTitle>Phát sáng</MenuTitle>
                  <SwatchGrid colors={['#22D3EE', '#F472B6', '#FACC15', '#4ADE80', '#A78BFA']} none="Không phát sáng" onPick={(color) => { close(); x.updateSelected({ textGlow: color }); }} />
                </>
              )}
            </DropButton>
          </div>
        </div>
        <div className="ppt-group-footer">Kiểu WordArt</div>
      </div>
      <div className="ppt-ribbon-group ppx-group">
        <div className="ppt-group-content">
          <button type="button" className="ppt-tool-btn-large" onClick={() => x.openDialog('alt-text')} title="Văn bản thay thế">
            <Accessibility size={20} color="#16A34A" />
            <span>Văn bản thay thế</span>
          </button>
          <button type="button" className={`ppt-tool-btn-large ${x.pane === 'selection' ? 'is-active' : ''}`} onClick={() => x.togglePane('selection')} title="Ngăn chọn: ẩn/hiện và đổi thứ tự đối tượng">
            <PanelRightOpen size={20} color="#475569" />
            <span>Ngăn chọn</span>
          </button>
          <SizeAndRotate />
        </div>
        <div className="ppt-group-footer">Kích cỡ & trợ năng</div>
      </div>
    </>
  );
}
