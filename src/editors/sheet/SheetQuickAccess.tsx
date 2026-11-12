import type { ReactNode } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Download, Filter, History, Paintbrush, Printer, Redo2, Save, Search, Snowflake, Undo2 } from 'lucide-react';
import { useSettings } from '../../lib/appSettings';
import type { SheetQatCommand, SheetQatPosition } from '../../lib/settings/sheetDefaults';
import { SHEET_QAT_LABELS } from '../../lib/settings/sheetMeta';
import './sheetQuickAccess.css';

const ICON = 16;

const ICONS: Record<SheetQatCommand, ReactNode> = {
  save: <Save size={ICON} />,
  undo: <Undo2 size={ICON} />,
  redo: <Redo2 size={ICON} />,
  print: <Printer size={ICON} />,
  find: <Search size={ICON} />,
  sortAsc: <ArrowDownAZ size={ICON} />,
  sortDesc: <ArrowUpAZ size={ICON} />,
  filter: <Filter size={ICON} />,
  freeze: <Snowflake size={ICON} />,
  formatPainter: <Paintbrush size={ICON} />,
  exportXlsx: <Download size={ICON} />,
  history: <History size={ICON} />,
};

const SHORTCUTS: Partial<Record<SheetQatCommand, string>> = {
  save: 'Ctrl+S',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  print: 'Ctrl+P',
  find: 'Ctrl+F',
};

export type SheetQatHandlers = Record<SheetQatCommand, (anchor: HTMLElement) => void>;

export function SheetQuickAccess({ placement, handlers, active }: { placement: SheetQatPosition; handlers: SheetQatHandlers; active?: Partial<Record<SheetQatCommand, boolean>> }) {
  const { sheetQatShow, sheetQatPosition, sheetQatCommands } = useSettings();
  const commands = sheetQatCommands.filter((id) => id in SHEET_QAT_LABELS);
  if (!sheetQatShow || sheetQatPosition !== placement || !commands.length) return null;
  return (
    <div className={`sheet-qat sheet-qat-${placement}`} role="toolbar" aria-label="Thanh truy cập nhanh">
      {commands.map((id) => {
        const label = SHEET_QAT_LABELS[id];
        const shortcut = SHORTCUTS[id];
        const pressed = active?.[id];
        return (
          <button
            key={id}
            type="button"
            className={`icon-btn${pressed ? ' active' : ''}`}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            aria-pressed={pressed === undefined ? undefined : pressed}
            onClick={(event) => handlers[id](event.currentTarget)}
          >
            {ICONS[id]}
          </button>
        );
      })}
    </div>
  );
}
