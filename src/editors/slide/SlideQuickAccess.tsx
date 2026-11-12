import type { ReactNode } from 'react';
import { Download, FileSearch, NotebookPen, Play, PlaySquare, Printer, Redo2, Save, SquarePlus, Type, Undo2 } from 'lucide-react';
import { useSettings } from '../../lib/appSettings';
import type { SlideQatCommand, SlideQatPosition } from '../../lib/settings/slideDefaults';
import { SLIDE_QAT_LABELS } from '../../lib/settings/slideOptions';

export type SlideQatAction = { run: () => void; disabled?: boolean; active?: boolean };

const ICON = 16;

const ICONS: Record<SlideQatCommand, ReactNode> = {
  save: <Save size={ICON} />,
  undo: <Undo2 size={ICON} />,
  redo: <Redo2 size={ICON} />,
  present: <Play size={ICON} />,
  presentCurrent: <PlaySquare size={ICON} />,
  newSlide: <SquarePlus size={ICON} />,
  textBox: <Type size={ICON} />,
  find: <FileSearch size={ICON} />,
  print: <Printer size={ICON} />,
  pptx: <Download size={ICON} />,
  notes: <NotebookPen size={ICON} />,
};

const SHORTCUTS: Partial<Record<SlideQatCommand, string>> = {
  save: 'Ctrl+S',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  present: 'F5',
  presentCurrent: 'Shift+F5',
  find: 'Ctrl+F',
};

export function SlideQuickAccess({ placement, actions }: { placement: SlideQatPosition; actions: Record<SlideQatCommand, SlideQatAction> }) {
  const { slideQatShow, slideQatPosition, slideQatCommands } = useSettings();
  const commands = slideQatCommands.filter((id) => id in actions);
  if (!slideQatShow || slideQatPosition !== placement || !commands.length) return null;
  const buttons = commands.map((id) => {
    const action = actions[id];
    const label = SLIDE_QAT_LABELS[id];
    const shortcut = SHORTCUTS[id];
    return (
      <button
        key={id}
        type="button"
        className={`ppt-quick-btn${action.active ? ' is-active' : ''}`}
        disabled={action.disabled}
        onClick={action.run}
        title={shortcut ? `${label} (${shortcut})` : label}
        aria-label={label}
        aria-pressed={action.active === undefined ? undefined : action.active}
      >
        {ICONS[id]}
      </button>
    );
  });
  if (placement === 'above') return <>{buttons}</>;
  return <div className="ppt-qat-below" role="toolbar" aria-label="Thanh truy cập nhanh">{buttons}</div>;
}
