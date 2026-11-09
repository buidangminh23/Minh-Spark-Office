import { MARGIN_PRESETS, presetMargins, type ContentKind, type MarginPresetId, type Margins } from '../../lib/print/printLayout';
import { papersByGroup, paperLabel, type PaperKey } from '../../lib/paperSizes';
import { CmField, MarginGallery, type MarginChoice } from './MarginGallery';
import type { PrintSettings } from './printTypes';

const CUSTOM_PAPER = '__custom';
const DEFAULT_CUSTOM_PAPER = { w: 210, h: 297 };

export const WORD_PRESETS: MarginPresetId[] = ['normal', 'narrow', 'moderate', 'wide', 'mirrored', 'office2003', 'decree30'];
export const EXCEL_PRESETS: MarginPresetId[] = ['excelNormal', 'excelWide', 'excelNarrow', 'normal', 'narrow', 'decree30', 'none'];
const MEDIA_PRESETS: MarginPresetId[] = ['normal', 'narrow', 'moderate', 'wide', 'mirrored', 'none'];

export const presetsFor = (kind: ContentKind) => (kind === 'sheet' ? EXCEL_PRESETS : kind === 'document' ? WORD_PRESETS : MEDIA_PRESETS);

const MARGIN_KEYS: (keyof Margins)[] = ['top', 'bottom', 'left', 'right'];

export function PaperSelect({ value, onChange, allowCustom }: { value: string; onChange: (value: PaperKey | typeof CUSTOM_PAPER) => void; allowCustom: boolean }) {
  return (
    <select className="text-field" value={value} onChange={(e) => onChange(e.target.value as PaperKey)}>
      {papersByGroup().map((group) => (
        <optgroup key={group.group} label={group.label}>
          {group.keys.map((key) => <option key={key} value={key}>{paperLabel(key)}</option>)}
        </optgroup>
      ))}
      {allowCustom && <option value={CUSTOM_PAPER}>Khổ tùy chỉnh…</option>}
    </select>
  );
}

type Update = (patch: Partial<PrintSettings>) => void;

export function PaperControls({ settings, update }: { settings: PrintSettings; update: Update }) {
  const custom = settings.customPaper;
  return (
    <>
      <label className="mp-field">
        <span>Khổ giấy</span>
        <PaperSelect
          value={custom ? CUSTOM_PAPER : settings.paper}
          allowCustom
          onChange={(value) => (value === CUSTOM_PAPER ? update({ customPaper: custom ?? DEFAULT_CUSTOM_PAPER }) : update({ paper: value, customPaper: null }))}
        />
      </label>
      {custom && (
        <div className="mp-margin-grid">
          <CmField label="Rộng" mm={custom.w} max={120} onChange={(w) => update({ customPaper: { ...custom, w: Math.max(50, w) } })} />
          <CmField label="Cao" mm={custom.h} max={120} onChange={(h) => update({ customPaper: { ...custom, h: Math.max(50, h) } })} />
        </div>
      )}
    </>
  );
}

const choiceOf = (settings: PrintSettings): MarginChoice => settings.marginPreset;

export function marginsShown(settings: PrintSettings, kind: ContentKind): Margins {
  if (settings.marginPreset === 'custom') return settings.customMargins;
  if (settings.marginPreset === 'auto') return presetMargins(kind === 'sheet' ? 'excelNormal' : 'narrow');
  return presetMargins(settings.marginPreset);
}

export function MarginControls({ settings, update, kind }: { settings: PrintSettings; update: Update; kind: ContentKind }) {
  const pick = (choice: MarginChoice) => {
    if (choice === 'auto') return update({ marginPreset: 'auto', mirror: false, gutterMm: 0 });
    if (choice === 'last' && settings.lastCustom) return update({ marginPreset: 'custom', customMargins: settings.lastCustom.margins, mirror: settings.lastCustom.mirror });
    if (choice === 'custom' || choice === 'last') return update({ marginPreset: 'custom', customMargins: marginsShown(settings, kind) });
    const def = MARGIN_PRESETS[choice];
    update({
      marginPreset: choice,
      mirror: 'mirror' in def && Boolean(def.mirror),
      gutterMm: 0,
      ...('header' in def ? { headerMm: def.header, footerMm: def.footer } : {}),
    });
  };
  const editCustom = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    update({ ...patch, lastCustom: { margins: next.customMargins, mirror: next.mirror } });
  };
  const custom = settings.marginPreset === 'custom';
  const names: Record<keyof Margins, string> = { top: 'Trên', bottom: 'Dưới', left: settings.mirror ? 'Trong' : 'Trái', right: settings.mirror ? 'Ngoài' : 'Phải' };
  return (
    <>
      <MarginGallery
        value={choiceOf(settings)}
        presets={presetsFor(kind)}
        current={marginsShown(settings, kind)}
        mirror={settings.mirror}
        lastCustom={settings.lastCustom}
        allowAuto
        onPick={pick}
      />
      {custom && (
        <div className="mp-custom-margins">
          <div className="mp-margin-grid">
            {MARGIN_KEYS.map((key) => (
              <CmField key={key} label={names[key]} mm={settings.customMargins[key]} onChange={(value) => editCustom({ customMargins: { ...settings.customMargins, [key]: value } })} />
            ))}
            <CmField label="Lề gáy" mm={settings.gutterMm} onChange={(value) => editCustom({ gutterMm: value })} />
            <label className="mp-field">
              <span>Vị trí gáy</span>
              <select className="text-field" value={settings.gutterPos} onChange={(e) => editCustom({ gutterPos: e.target.value as 'left' | 'top' })}>
                <option value="left">Bên trái</option>
                <option value="top">Phía trên</option>
              </select>
            </label>
            <CmField label="Lề đầu trang" mm={settings.headerMm} max={10} onChange={(value) => editCustom({ headerMm: value })} />
            <CmField label="Lề chân trang" mm={settings.footerMm} max={10} onChange={(value) => editCustom({ footerMm: value })} />
          </div>
          <label className="mp-check"><input type="checkbox" checked={settings.mirror} onChange={(e) => editCustom({ mirror: e.target.checked })} /><span>Lề đối xứng khi in hai mặt</span></label>
        </div>
      )}
    </>
  );
}
