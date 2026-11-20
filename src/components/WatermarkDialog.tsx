import { useState, type CSSProperties } from 'react';
import { Stamp, Upload, X } from 'lucide-react';
import ComboBox from './ComboBox';
import { pickFile, readAsDataUrl } from '../lib/download';
import {
  DEFAULT_WATERMARK,
  WATERMARK_FONTS,
  WATERMARK_PRESETS,
  WATERMARK_SIZES,
  normalizeWatermark,
  watermarkCss,
  type WatermarkLayout,
  type WatermarkSpec,
} from '../lib/watermark';
import './watermarkDialog.css';

type Kind = 'none' | 'text' | 'image';

type Props = {
  title?: string;
  initial: WatermarkSpec | null | undefined;
  aspect?: 'portrait' | 'landscape';
  note?: string;
  applyLabel?: string;
  allowNone?: boolean;
  onApply: (spec: WatermarkSpec | null) => void;
  onClose: () => void;
  onError?: (message: string) => void;
};

const PREVIEW_SCALE = 0.22;

export default function WatermarkDialog({ title = 'Hình mờ', initial, aspect = 'portrait', note, applyLabel = 'Áp dụng', allowNone = true, onApply, onClose, onError }: Props) {
  const start = initial ?? null;
  const [kind, setKind] = useState<Kind>(start ? start.kind : allowNone ? 'none' : 'text');
  const [text, setText] = useState(start?.text || DEFAULT_WATERMARK.text!);
  const [font, setFont] = useState(start?.font ?? DEFAULT_WATERMARK.font!);
  const [size, setSize] = useState(start?.size ?? DEFAULT_WATERMARK.size!);
  const [color, setColor] = useState(start?.color ?? DEFAULT_WATERMARK.color!);
  const [layout, setLayout] = useState<WatermarkLayout>(start?.layout ?? 'diagonal');
  const [opacity, setOpacity] = useState(start?.opacity ?? DEFAULT_WATERMARK.opacity!);
  const [image, setImage] = useState(start?.image ?? '');

  const draft = kind === 'none' ? null : normalizeWatermark(kind === 'text' ? { kind, text, font, size, color, layout, opacity } : { kind, image, layout, opacity });
  const fonts = WATERMARK_FONTS.includes(font) ? WATERMARK_FONTS : [font, ...WATERMARK_FONTS];

  const pick = async () => {
    const file = await pickFile('image/png,image/jpeg,image/gif');
    if (!file) return;
    try {
      setImage(await readAsDataUrl(file));
    } catch {
      onError?.('Không đọc được ảnh này');
    }
  };

  const apply = () => {
    onApply(kind === 'none' ? null : draft);
    onClose();
  };

  const sheet: CSSProperties = aspect === 'landscape' ? { width: 200, height: 112 } : { width: 124, height: 172 };
  const preview = draft ? watermarkCss(draft, PREVIEW_SCALE) : null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog wide watermark-dialog" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="watermark-dialog-head">
          <h2><Stamp size={18} /> {title}</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        {note && <p className="dialog-subtitle">{note}</p>}
        <div className="watermark-kinds" role="radiogroup">
          {([...(allowNone ? [['none', 'Không có hình mờ']] : []), ['text', 'Hình mờ chữ'], ['image', 'Hình mờ ảnh']] as [Kind, string][]).map(([value, label]) => (
            <label key={value}><input type="radio" name="watermark-kind" checked={kind === value} onChange={() => setKind(value)} /> {label}</label>
          ))}
        </div>
        {kind !== 'none' && (
          <div className="watermark-body">
            <div className="watermark-form">
              {kind === 'text' ? (
                <>
                  <label className="watermark-field"><span>Nội dung</span><ComboBox label="Nội dung hình mờ" value={text} options={WATERMARK_PRESETS} onCommit={setText} onInput={setText} /></label>
                  <div className="watermark-grid">
                    <label className="watermark-field"><span>Phông</span><select className="text-field" value={font} onChange={(event) => setFont(event.target.value)}>{fonts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label className="watermark-field"><span>Cỡ chữ (px)</span><ComboBox label="Cỡ chữ hình mờ (px)" value={size} options={WATERMARK_SIZES} numeric={{ min: 8, max: 400, step: 1 }} onCommit={(value) => setSize(Number(value) || size)} /></label>
                    <label className="watermark-field"><span>Màu</span><input className="text-field watermark-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
                  </div>
                </>
              ) : (
                <button type="button" className="btn" onClick={() => void pick()}><Upload size={14} /> {image ? 'Chọn ảnh khác' : 'Chọn ảnh…'}</button>
              )}
              <div className="watermark-grid">
                <label className="watermark-field"><span>Độ đậm ({Math.round(opacity * 100)}%)</span><input type="range" min={0.05} max={0.8} step={0.05} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
                <label className="watermark-field"><span>Bố cục</span><select className="text-field" value={layout} onChange={(event) => setLayout(event.target.value as WatermarkLayout)}><option value="diagonal">Chéo</option><option value="horizontal">Ngang</option></select></label>
              </div>
            </div>
            <div className="watermark-preview" aria-hidden>
              <div className="watermark-preview-sheet" style={sheet}>
                {draft?.kind === 'image' && preview ? <img src={draft.image} alt="" style={preview as CSSProperties} /> : draft && preview ? <span style={preview as CSSProperties}>{draft.text}</span> : null}
              </div>
            </div>
          </div>
        )}
        <div className="watermark-actions">
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button type="button" className="btn btn-primary" disabled={kind !== 'none' && !draft} onClick={apply}>{applyLabel}</button>
        </div>
      </div>
    </div>
  );
}
