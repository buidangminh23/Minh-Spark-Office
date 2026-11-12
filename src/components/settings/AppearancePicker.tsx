import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import {
  AlignLeft, Bold, Check as CheckIcon, ClipboardPaste, FileText, Image, Italic, List, Table, Underline,
} from 'lucide-react';
import { setSettings, useSettings, type AppSettings, type ThemeMode } from '../../lib/appSettings';
import {
  THEME_GROUPS, chromeFamily, customColorOf, hexToHsl, hslString, hslToHex, hslToRgb, previewVars,
} from '../../lib/chromeThemes';

type ColorSettings = Pick<AppSettings, 'customHue' | 'customSat' | 'customLight' | 'customTint'>;

const WINDOW_TABS = ['Tệp', 'Trang chủ', 'Chèn', 'Bố cục', 'Xem lại', 'Xem'];
const WINDOW_GROUPS = [
  { label: 'Bảng tạm', icons: [ClipboardPaste], large: true },
  { label: 'Phông chữ', icons: [Bold, Italic, Underline], pressed: 0 },
  { label: 'Đoạn văn', icons: [AlignLeft, List] },
  { label: 'Chèn', icons: [Image, Table], large: true },
];

function ThemeWindow({ theme, settings, mini }: { theme: ThemeMode; settings: ColorSettings; mini?: boolean }) {
  const style = previewVars(theme, settings) as CSSProperties;
  const family = chromeFamily(theme);
  const modern = family === 'modern';
  return (
    <span className={`st-win${mini ? ' is-mini' : ''}`} data-family={family} data-modern={modern || undefined} style={style} aria-hidden="true">
      <span className="st-win-title"><FileText /><b>Báo cáo tháng 11</b><em>Đã lưu</em></span>
      <span className="st-win-tabs">
        {WINDOW_TABS.map((tab, index) => (
          <span key={tab} className={index === 0 ? 'st-win-file' : index === 1 ? 'st-win-tab is-active' : 'st-win-tab'}>{tab}</span>
        ))}
      </span>
      <span className="st-win-ribbon">
        {WINDOW_GROUPS.map((group) => (
          <span key={group.label} className="st-win-group">
            <span className="st-win-buttons">
              {group.icons.map((Icon, index) => (
                <span key={index} className={`st-win-btn${group.large && index === 0 ? ' is-large' : ''}${group.pressed === index ? ' is-pressed' : ''}`}><Icon /></span>
              ))}
            </span>
            <span className="st-win-label">{group.label}</span>
          </span>
        ))}
      </span>
      <span className="st-win-canvas"><span className="st-win-page"><i className="is-heading" /><i /><i /><i /><i /></span></span>
      <span className="st-win-status">Trang 1/3 · 412 từ<em>100%</em></span>
    </span>
  );
}

function ThemeCardPreview({ theme, settings }: { theme: ThemeMode; settings: ColorSettings }) {
  if (theme !== 'system') return <ThemeWindow theme={theme} settings={settings} mini />;
  return (
    <span className="st-win-split">
      <span><ThemeWindow theme="light" settings={settings} mini /></span>
      <span><ThemeWindow theme="dark" settings={settings} mini /></span>
    </span>
  );
}

export function ThemePicker() {
  const settings = useSettings();
  return (
    <div className="st-appearance">
      {THEME_GROUPS.map((group) => (
        <div key={group.title} className="st-theme-group">
          <span className="st-theme-group-title">{group.title}</span>
          <div className="st-themes" role="radiogroup" aria-label={group.title}>
            {group.themes.map((card) => {
              const active = settings.theme === card.id;
              return (
                <button key={card.id} type="button" role="radio" aria-checked={active} className={`st-theme${active ? ' is-active' : ''}`} onClick={() => setSettings({ theme: card.id })}>
                  <span className="st-theme-preview">
                    <ThemeCardPreview theme={card.id} settings={settings} />
                    {active && <span className="st-theme-tick"><CheckIcon size={12} strokeWidth={3} /></span>}
                  </span>
                  <span className="st-theme-label">{card.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {settings.theme === 'custom' && <CustomColorPanel />}
      <div className="st-theme-group">
        <span className="st-theme-group-title">Xem trước</span>
        <div className="st-win-large"><ThemeWindow theme={settings.theme === 'system' ? 'light' : settings.theme} settings={settings} /></div>
      </div>
    </div>
  );
}

const PALETTE_HUES: Array<[number, string]> = [
  [0, 'Đỏ'], [22, 'Cam'], [40, 'Hổ phách'], [52, 'Vàng'], [90, 'Xanh mạ'], [140, 'Xanh lá'], [170, 'Ngọc'],
  [195, 'Xanh lơ'], [215, 'Xanh dương'], [240, 'Chàm'], [270, 'Tím'], [320, 'Hồng'], [-1, 'Xám'],
];
const PALETTE_LIGHTS = [90, 78, 64, 50, 38, 26];
const lightLabel = (light: number) => (light > 70 ? 'nhạt' : light < 40 ? 'đậm' : 'vừa');

const updateColor = (patch: Partial<ColorSettings>) => setSettings({ theme: 'custom', ...patch });

function CustomColorPanel() {
  const settings = useSettings();
  const color = customColorOf(settings);
  return (
    <div className="st-color-panel">
      <div className="st-color-head">
        <strong>Màu của bạn</strong>
        <span>Màu này phủ thanh tiêu đề, thanh thẻ và thanh trạng thái; ribbon và nền nhuộm nhạt theo màu.</span>
      </div>
      <div className="st-palette" role="radiogroup" aria-label="Bảng màu">
        {PALETTE_LIGHTS.map((light) => PALETTE_HUES.map(([hue, name]) => {
          const h = Math.max(hue, 0);
          const sat = hue < 0 ? 0 : light > 80 ? 70 : 75;
          const active = color.hue === h && color.sat === sat && color.light === light;
          return (
            <button
              key={`${hue}-${light}`}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${name} ${lightLabel(light)}`}
              title={`${name} – ${lightLabel(light)}`}
              className={active ? 'is-active' : undefined}
              style={{ background: hslString(h, sat, light) }}
              onClick={() => updateColor({ customHue: h, customSat: sat, customLight: light })}
            />
          );
        }))}
      </div>
      <div className="st-palette-scale"><span>Nhạt</span><span>Đậm</span></div>
      <strong className="st-color-sub">Chỉnh chuyên sâu</strong>
      <div className="st-color-tools">
        <ColorWheel hue={color.hue} sat={color.sat} light={color.light} />
        <div className="st-color-side">
          <div className="st-dials">
            <Dial label="Nhạt ↔ đậm" value={color.light} min={92} max={10} display={`${color.light}%`} fill={hslString(color.hue, color.sat, color.light)} onChange={(value) => updateColor({ customLight: value })} />
            <Dial label="Nhuộm ribbon" value={color.tint} min={0} max={30} display={`${color.tint}%`} fill={`color-mix(in srgb, ${hslString(color.hue, color.sat, color.light)} ${color.tint * 3 + 10}%, white)`} onChange={(value) => updateColor({ customTint: value })} />
          </div>
          <HexField key={hslToHex(color.hue, color.sat, color.light)} hue={color.hue} sat={color.sat} light={color.light} />
        </div>
      </div>
    </div>
  );
}

const WHEEL_SIZE = 200;

function paintWheel(canvas: HTMLCanvasElement, light: number) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(WHEEL_SIZE * ratio);
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - radius;
      const dy = y - radius;
      const distance = Math.hypot(dx, dy);
      const index = (y * size + x) * 4;
      if (distance > radius) continue;
      const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const [r, g, b] = hslToRgb(hue, (distance / radius) * 100, light);
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function ColorWheel({ hue, sat, light }: { hue: number; sat: number; light: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) paintWheel(canvasRef.current, light);
  }, [light]);
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - box.left - box.width / 2;
    const dy = event.clientY - box.top - box.height / 2;
    updateColor({
      customHue: Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360),
      customSat: Math.round(Math.min(1, Math.hypot(dx, dy) / (box.width / 2)) * 100),
    });
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<ColorSettings>> = {
      ArrowLeft: { customHue: (hue - step + 360) % 360 },
      ArrowRight: { customHue: (hue + step) % 360 },
      ArrowUp: { customSat: Math.min(100, sat + step) },
      ArrowDown: { customSat: Math.max(0, sat - step) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    updateColor(move);
  };
  const angle = hue * Math.PI / 180;
  const offset = sat / 100 * 50;
  return (
    <div className="st-wheel-wrap">
      <div
        className="st-wheel"
        role="slider"
        tabIndex={0}
        aria-label="Bánh xe màu: mũi tên trái phải đổi sắc độ, lên xuống đổi độ rực"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={hue}
        aria-valuetext={`Sắc độ ${hue}°, độ rực ${sat}%`}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pick(event); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event); }}
        onKeyDown={onKey}
      >
        <canvas ref={canvasRef} />
        <span className="st-wheel-knob" style={{ left: `${50 + offset * Math.cos(angle)}%`, top: `${50 + offset * Math.sin(angle)}%`, background: hslString(hue, sat, light) }} />
      </div>
      <span className="st-color-caption">Bánh xe màu</span>
      <span className="st-color-value">{`Sắc độ ${hue}° · Độ rực ${sat}%`}</span>
    </div>
  );
}

const DIAL_START = 135;
const DIAL_SWEEP = 270;
const DIAL_RADIUS = 40;

const dialPoint = (degrees: number, radius: number) => {
  const radians = degrees * Math.PI / 180;
  return [52 + radius * Math.cos(radians), 52 + radius * Math.sin(radians)];
};

const dialArc = (from: number, to: number) => {
  const [x1, y1] = dialPoint(from, DIAL_RADIUS);
  const [x2, y2] = dialPoint(to, DIAL_RADIUS);
  return `M${x1} ${y1} A${DIAL_RADIUS} ${DIAL_RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

type DialProps = { label: string; value: number; min: number; max: number; display: string; fill: string; onChange: (value: number) => void };

function Dial({ label, value, min, max, display, fill, onChange }: DialProps) {
  const progress = (value - min) / (max - min);
  const angle = DIAL_START + DIAL_SWEEP * progress;
  const [knobX, knobY] = dialPoint(angle, DIAL_RADIUS);
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const set = (next: number) => onChange(Math.round(Math.min(high, Math.max(low, next))));
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const degrees = Math.atan2(event.clientY - box.top - box.height / 2, event.clientX - box.left - box.width / 2) * 180 / Math.PI;
    let sweep = (degrees - DIAL_START + 720) % 360;
    if (sweep > DIAL_SWEEP) sweep = sweep > DIAL_SWEEP + 45 ? 0 : DIAL_SWEEP;
    set(min + (max - min) * sweep / DIAL_SWEEP);
  };
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const direction = Math.sign(max - min);
    const step = (event.shiftKey ? 5 : 1) * direction;
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : 0;
    if (!delta) return;
    event.preventDefault();
    set(value + delta);
  };
  return (
    <div className="st-dial">
      <svg
        width="104"
        height="104"
        viewBox="0 0 104 104"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={low}
        aria-valuemax={high}
        aria-valuenow={value}
        aria-valuetext={display}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pick(event); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event); }}
        onKeyDown={onKey}
      >
        <path d={dialArc(DIAL_START, DIAL_START + DIAL_SWEEP)} className="st-dial-track" />
        <path d={dialArc(DIAL_START, Math.max(angle, DIAL_START + 0.01))} className="st-dial-fill" style={{ stroke: fill }} />
        <circle cx="52" cy="52" r="26" style={{ fill }} className="st-dial-core" />
        <circle cx={knobX} cy={knobY} r="9" className="st-dial-knob" />
      </svg>
      <span className="st-color-caption">{label}</span>
      <span className="st-color-value">{display}</span>
    </div>
  );
}

function HexField({ hue, sat, light }: { hue: number; sat: number; light: number }) {
  const hex = hslToHex(hue, sat, light);
  const [draft, setDraft] = useState(hex);
  const [invalid, setInvalid] = useState(false);
  const commit = (value: string) => {
    const parsed = hexToHsl(value);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    updateColor({ customHue: parsed.hue, customSat: parsed.sat, customLight: Math.min(92, Math.max(10, parsed.light)) });
  };
  return (
    <div className="st-hex">
      <span className="st-hex-swatch" style={{ background: hslString(hue, sat, light) }} />
      <input
        className={`st-hex-input${invalid ? ' is-invalid' : ''}`}
        value={draft}
        aria-label="Mã màu HEX"
        aria-invalid={invalid}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => { if (event.key === 'Enter') commit(draft); }}
      />
      {invalid && <span className="st-hex-error">Nhập mã dạng #29AE59</span>}
    </div>
  );
}
