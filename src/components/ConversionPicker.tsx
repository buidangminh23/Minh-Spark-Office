import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronRight, X } from 'lucide-react';
import { CONVERSION_PRESET_GROUPS, type ConversionPreset } from '../lib/conversionPresets';
import { ConvertLogo } from './ConvertLogo';
import { SuiteLogo } from './SuiteLogo';
import './conversion.css';

export function ConversionPair({ preset, size = 36 }: { preset: ConversionPreset; size?: number }) {
  return (
    <span className="conversion-pair" aria-hidden="true">
      <SuiteLogo kind={preset.from} size={size} />
      <ArrowRight size={Math.round(size * 0.5)} className="conversion-pair-arrow" />
      <SuiteLogo kind={preset.to} size={size} />
    </span>
  );
}

export function ConversionPicker({ onPick, onAll, onClose }: { onPick: (preset: ConversionPreset) => void; onAll: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog
      ref={dialog}
      className="conversion-dialog conversion-picker"
      aria-labelledby="conversion-picker-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <header className="conversion-header">
        <div className="conversion-heading">
          <ConvertLogo size={44} />
          <div>
            <h2 id="conversion-picker-title">Chuyển đổi định dạng</h2>
            <p>Bạn muốn chuyển tệp sang định dạng nào? Xử lý ngay trên thiết bị, tệp không rời khỏi máy.</p>
          </div>
        </div>
        <button className="icon-btn" aria-label="Đóng chuyển đổi" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="conversion-body">
        {CONVERSION_PRESET_GROUPS.map((group) => (
          <section key={group.title} className="conversion-group" aria-label={group.title}>
            <h3>{group.title}</h3>
            <div className="conversion-presets">
              {group.presets.map((preset) => (
                <button key={preset.id} className="conversion-preset" onClick={() => onPick(preset)}>
                  <ConversionPair preset={preset} />
                  <strong>{preset.title}</strong>
                  <span>{preset.note}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <button className="conversion-all" onClick={onAll}>
          <span><strong>Định dạng khác</strong><span>ODT, RTF, EPUB, Markdown, HTML, CSV, JSON, PNG, WebP… hoặc chọn nhiều loại tệp cùng lúc</span></span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}
