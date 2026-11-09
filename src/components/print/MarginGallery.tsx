import { useState } from 'react';
import { ChevronDown, Wand2 } from 'lucide-react';
import { MARGIN_PRESETS, describeMargins, presetMargins, type MarginPresetId, type Margins } from '../../lib/print/printLayout';

export type MarginChoice = MarginPresetId | 'auto' | 'custom' | 'last';

const PAGE = { w: 210, h: 297 };
const ICON = { w: 30, h: 40 };

export function MiniPage({ margins, mirror = false }: { margins: Margins; mirror?: boolean }) {
  const sx = ICON.w / PAGE.w;
  const sy = ICON.h / PAGE.h;
  const inner = { x: margins.left * sx, y: margins.top * sy, w: ICON.w - (margins.left + margins.right) * sx, h: ICON.h - (margins.top + margins.bottom) * sy };
  return (
    <svg className="mp-mini-page" width={mirror ? ICON.w * 2 + 2 : ICON.w} height={ICON.h} viewBox={`0 0 ${mirror ? ICON.w * 2 + 2 : ICON.w} ${ICON.h}`} aria-hidden>
      <rect x="0.5" y="0.5" width={ICON.w - 1} height={ICON.h - 1} fill="#fff" stroke="#94a3b8" />
      <rect x={inner.x} y={inner.y} width={Math.max(1, inner.w)} height={Math.max(1, inner.h)} fill="#dbe7ff" stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {mirror && (
        <g transform={`translate(${ICON.w + 2} 0)`}>
          <rect x="0.5" y="0.5" width={ICON.w - 1} height={ICON.h - 1} fill="#fff" stroke="#94a3b8" />
          <rect x={margins.right * sx} y={inner.y} width={Math.max(1, inner.w)} height={Math.max(1, inner.h)} fill="#dbe7ff" stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2 1.5" />
        </g>
      )}
    </svg>
  );
}

type Props = {
  value: MarginChoice;
  presets: MarginPresetId[];
  current: Margins;
  mirror: boolean;
  lastCustom: { margins: Margins; mirror: boolean } | null;
  allowAuto: boolean;
  onPick: (choice: MarginChoice) => void;
};

function Row({ icon, name, detail, active, onClick }: { icon: React.ReactNode; name: string; detail: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="option" aria-selected={active} className={`mp-margin-row ${active ? 'on' : ''}`} onClick={onClick}>
      {icon}
      <span className="mp-margin-text">
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}

export function MarginGallery({ value, presets, current, mirror, lastCustom, allowAuto, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const pick = (choice: MarginChoice) => {
    onPick(choice);
    setOpen(false);
  };
  const currentName = value === 'auto' ? 'Tự căn lề' : value === 'custom' || value === 'last' ? 'Lề tùy chỉnh' : MARGIN_PRESETS[value].name;
  const currentDetail = value === 'auto' ? 'Tự chọn lề, hướng giấy và tỉ lệ cho vừa trang' : describeMargins(current, mirror);
  return (
    <div className="mp-margin-gallery">
      <button type="button" className="mp-margin-trigger" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((v) => !v)}>
        {value === 'auto' ? <span className="mp-auto-icon"><Wand2 size={16} /></span> : <MiniPage margins={current} mirror={mirror} />}
        <span className="mp-margin-text">
          <strong>{currentName}</strong>
          <small>{currentDetail}</small>
        </span>
        <ChevronDown size={16} className="mp-margin-caret" />
      </button>
      {open && (
        <div className="mp-margin-list" role="listbox" aria-label="Kiểu lề">
          {allowAuto && <Row icon={<span className="mp-auto-icon"><Wand2 size={16} /></span>} name="Tự căn lề (khuyên dùng)" detail="Tự chọn lề, hướng giấy và tỉ lệ cho vừa trang" active={value === 'auto'} onClick={() => pick('auto')} />}
          {lastCustom && (
            <Row icon={<MiniPage margins={lastCustom.margins} mirror={lastCustom.mirror} />} name="Lần tùy chỉnh gần nhất" detail={describeMargins(lastCustom.margins, lastCustom.mirror)} active={false} onClick={() => pick('last')} />
          )}
          {presets.map((id) => {
            const def = MARGIN_PRESETS[id];
            const m = presetMargins(id);
            const isMirror = 'mirror' in def && Boolean(def.mirror);
            return <Row key={id} icon={<MiniPage margins={m} mirror={isMirror} />} name={def.name} detail={describeMargins(m, isMirror)} active={value === id} onClick={() => pick(id)} />;
          })}
          <Row icon={<MiniPage margins={current} mirror={mirror} />} name="Lề tùy chỉnh…" detail="Tự nhập lề, lề gáy, đối xứng, đầu và chân trang" active={value === 'custom'} onClick={() => pick('custom')} />
        </div>
      )}
    </div>
  );
}

const CM_STEP = 0.1;

export function CmField({ label, mm, onChange, max = 30 }: { label: string; mm: number; onChange: (mm: number) => void; max?: number }) {
  return (
    <label className="mp-field">
      <span>{label}</span>
      <span className="mp-unit-input">
        <input
          className="text-field"
          type="number"
          min={0}
          max={max}
          step={CM_STEP}
          value={Math.round(mm) === mm ? mm / 10 : Math.round(mm * 10) / 100}
          onChange={(e) => onChange(Math.max(0, Math.min(max * 10, (Number(e.target.value) || 0) * 10)))}
        />
        <em>cm</em>
      </span>
    </label>
  );
}
