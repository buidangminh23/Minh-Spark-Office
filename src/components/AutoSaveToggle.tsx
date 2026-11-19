import { setSettings, useSetting } from '../lib/appSettings';

export function AutoSaveToggle({ onEnable }: { onEnable?: () => void }) {
  const on = useSetting('autoSave');
  const toggle = () => {
    setSettings({ autoSave: !on });
    if (!on) onEnable?.();
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`autosave-toggle${on ? ' is-on' : ''}`}
      onClick={toggle}
      title={on ? 'Tự động lưu đang bật: mọi thay đổi được lưu ngay. Bấm để tắt.' : 'Tự động lưu đang tắt: thay đổi chỉ được lưu khi bạn bấm Lưu (Ctrl+S). Bấm để bật.'}
    >
      <span className="autosave-label">Tự động lưu</span>
      <span className="autosave-track" aria-hidden="true">
        <span className="autosave-knob" />
      </span>
      <span className="autosave-state">{on ? 'Bật' : 'Tắt'}</span>
    </button>
  );
}
