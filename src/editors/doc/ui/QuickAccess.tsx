import type { ReactNode } from 'react';
import { useEditorState } from '@tiptap/react';
import { FileDown, FilePlus2, ImagePlus, MessageSquarePlus, Printer, Redo2, Save, Search, SpellCheck2, Table2, Undo2, Volume2 } from 'lucide-react';
import { useSettings, type QatCommand } from '../../../lib/appSettings';
import { QAT_LABELS } from '../../../lib/appSettingsMeta';
import { useDoc, type DocCtx } from '../DocContext';
import { addComment, insertImageFromDevice } from '../actions';
import { exportFormat } from '../exportFormats';

type Command = { icon: ReactNode; shortcut?: string; run: (ctx: DocCtx) => void; active?: (ctx: DocCtx) => boolean };

const ICON = 16;
const EMPTY_TABLE_SIZE = 3;

const COMMANDS: Record<QatCommand, Command> = {
  save: { icon: <Save size={ICON} />, shortcut: 'Ctrl+S', run: (ctx) => void ctx.saveNow() },
  undo: { icon: <Undo2 size={ICON} />, shortcut: 'Ctrl+Z', run: (ctx) => ctx.editor.chain().focus().undo().run() },
  redo: { icon: <Redo2 size={ICON} />, shortcut: 'Ctrl+Y', run: (ctx) => ctx.editor.chain().focus().redo().run() },
  print: { icon: <Printer size={ICON} />, shortcut: 'Ctrl+P', run: (ctx) => ctx.openDialog('print') },
  pdf: { icon: <FileDown size={ICON} />, run: (ctx) => void exportFormat(ctx, 'pdf') },
  find: { icon: <Search size={ICON} />, shortcut: 'Ctrl+F', run: (ctx) => ctx.setView({ showFind: true }) },
  newDoc: { icon: <FilePlus2 size={ICON} />, run: (ctx) => ctx.onNewDocument() },
  spelling: { icon: <SpellCheck2 size={ICON} />, run: (ctx) => ctx.setView({ spellcheck: !ctx.view.spellcheck }), active: (ctx) => ctx.view.spellcheck },
  readAloud: { icon: <Volume2 size={ICON} />, shortcut: 'Alt+Space', run: (ctx) => ctx.readAloud.toggle(), active: (ctx) => ctx.readAloud.speaking },
  comment: { icon: <MessageSquarePlus size={ICON} />, run: (ctx) => void addComment(ctx) },
  table: { icon: <Table2 size={ICON} />, run: (ctx) => ctx.editor.chain().focus().insertTable({ rows: EMPTY_TABLE_SIZE, cols: EMPTY_TABLE_SIZE, withHeaderRow: true }).run() },
  picture: { icon: <ImagePlus size={ICON} />, run: (ctx) => void insertImageFromDevice(ctx) },
};

export function QuickAccess({ placement }: { placement: 'above' | 'below' }) {
  const ctx = useDoc();
  const { qatShow, qatPosition, qatCommands } = useSettings();
  const history = useEditorState({ editor: ctx.editor, selector: ({ editor }) => ({ undo: editor.can().undo(), redo: editor.can().redo() }) });
  if (!qatShow || qatPosition !== placement || !qatCommands.length) return null;
  return (
    <div className={`quick-access quick-access-${placement}`} role="toolbar" aria-label="Thanh truy cập nhanh">
      {qatCommands.map((id) => {
        const command = COMMANDS[id];
        const label = QAT_LABELS[id];
        const disabled = (id === 'undo' && !history.undo) || (id === 'redo' && !history.redo);
        const active = command.active?.(ctx);
        return (
          <button key={id} type="button" className={`icon-btn${active ? ' active' : ''}`} title={command.shortcut ? `${label} (${command.shortcut})` : label} aria-label={label} aria-pressed={command.active ? active : undefined} disabled={disabled} onClick={() => command.run(ctx)}>
            {command.icon}
          </button>
        );
      })}
    </div>
  );
}
