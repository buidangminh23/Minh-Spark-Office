import { useMemo, useState } from 'react';
import { Circle, Play, Trash2, MousePointerClick, Save } from 'lucide-react';
import { ProDialog } from './SheetProModals';
import {
  BUILTIN_MACROS,
  MAX_MACRO_NAME_LENGTH,
  decodeTarget,
  describeStep,
  encodeTarget,
  normalizeShortcut,
  shortcutProblem,
  type BuiltinMacroId,
  type MacroTarget,
  type SheetMacro,
} from './sheetMacros';

const FIELD_STYLE = { display: 'grid', gap: 4, fontSize: 12.5 } as const;
const INPUT_STYLE = { padding: '7px 9px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 } as const;
const MAX_STEPS_SHOWN = 200;

export const MACRO_BUTTON_COLORS = [
  { id: 'green', label: 'Xanh lá', background: '#107c41', text: '#ffffff' },
  { id: 'blue', label: 'Xanh dương', background: '#2563eb', text: '#ffffff' },
  { id: 'orange', label: 'Cam', background: '#d97706', text: '#ffffff' },
  { id: 'gray', label: 'Xám', background: '#e2e8f0', text: '#0f172a' },
] as const;

export type MacroButtonColor = (typeof MACRO_BUTTON_COLORS)[number];

export interface MacroRecordOptions {
  name: string;
  description: string;
  shortcut: string;
  relative: boolean;
}

function ShortcutField({ value, problem, onChange }: { value: string; problem: string | null; onChange: (next: string) => void }) {
  return (
    <label style={FIELD_STYLE}>
      <span>Phím tắt: Ctrl + Shift + (một chữ cái, để trống nếu không cần)</span>
      <input style={{ ...INPUT_STYLE, width: 90 }} value={value} maxLength={1} placeholder="K" onChange={(e) => onChange(normalizeShortcut(e.target.value))} />
      {problem && <span style={{ color: '#dc2626' }}>{problem}</span>}
    </label>
  );
}

export function MacroRecordModal({
  suggestedName,
  macros,
  startCellA1,
  onStart,
  onClose,
}: {
  suggestedName: string;
  macros: SheetMacro[];
  startCellA1: string;
  onStart: (options: MacroRecordOptions) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [relative, setRelative] = useState(false);
  const problem = shortcutProblem(shortcut, macros, '');
  const canStart = name.trim().length > 0 && !problem;
  return (
    <ProDialog
      title="Ghi macro (Record Macro)"
      subtitle="Sau khi bấm Bắt đầu ghi, mọi thao tác nhập liệu, định dạng, chèn xoá hàng cột trên bảng tính sẽ được ghi lại cho tới khi sếp bấm Dừng ghi."
      width={520}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn btn-sheet" disabled={!canStart} onClick={() => onStart({ name: name.trim(), description: description.trim(), shortcut, relative })}>
            <Circle size={14} fill="#dc2626" color="#dc2626" /> <span>Bắt đầu ghi</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={FIELD_STYLE}>
          <span>Tên macro</span>
          <input style={INPUT_STYLE} value={name} maxLength={MAX_MACRO_NAME_LENGTH} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <ShortcutField value={shortcut} problem={problem} onChange={setShortcut} />
        <label style={FIELD_STYLE}>
          <span>Mô tả (không bắt buộc)</span>
          <input style={INPUT_STYLE} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="check-field">
          <input type="checkbox" checked={relative} onChange={(e) => setRelative(e.target.checked)} />
          <span>Dùng tham chiếu tương đối: khi chạy, mọi vùng dịch theo ô đang chọn (ô gốc lúc ghi là {startCellA1})</span>
        </label>
      </div>
    </ProDialog>
  );
}

export function MacroManagerModal({
  macros,
  onRun,
  onRunBuiltin,
  onUpdate,
  onDelete,
  onClose,
}: {
  macros: SheetMacro[];
  onRun: (id: string) => void;
  onRunBuiltin: (id: BuiltinMacroId) => void;
  onUpdate: (macro: SheetMacro) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(macros[0]?.id ?? '');
  const selected = macros.find((macro) => macro.id === selectedId) ?? null;
  const [draft, setDraft] = useState<SheetMacro | null>(selected);
  const select = (macro: SheetMacro) => {
    setSelectedId(macro.id);
    setDraft(macro);
  };
  const problem = draft ? shortcutProblem(draft.shortcut, macros, draft.id) : null;
  const isDirty = !!draft && !!selected && JSON.stringify({ ...draft, steps: [] }) !== JSON.stringify({ ...selected, steps: [] });
  const commandCount = useMemo(() => selected?.steps.filter((step) => step.kind === 'command').length ?? 0, [selected]);

  return (
    <ProDialog
      title="Macro (Alt + F8)"
      subtitle="Chạy, đổi tên, gán phím tắt hoặc xoá macro đã ghi. Macro được lưu cùng bảng tính này."
      width={760}
      onClose={onClose}
      actions={<button className="btn" onClick={onClose}>Đóng</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 14, minHeight: 320 }}>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start', maxHeight: 420, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Macro đã ghi ({macros.length})</div>
          {macros.length === 0 && <div style={{ fontSize: 12.5, color: '#64748b' }}>Chưa có macro nào. Vào tab Automate → Ghi macro để tạo.</div>}
          {macros.map((macro) => (
            <button
              key={macro.id}
              className="sheet-popover-item"
              style={{ textAlign: 'left', border: macro.id === selectedId ? '1px solid #107c41' : '1px solid var(--line)', borderRadius: 6, padding: '7px 9px' }}
              onClick={() => select(macro)}
            >
              <span style={{ fontWeight: 600 }}>{macro.name}</span>
              {macro.shortcut && <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11.5 }}>Ctrl+Shift+{macro.shortcut}</span>}
            </button>
          ))}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginTop: 6 }}>Macro có sẵn</div>
          {BUILTIN_MACROS.map(([id, label]) => (
            <button key={id} className="sheet-popover-item" style={{ textAlign: 'left', padding: '5px 9px' }} onClick={() => onRunBuiltin(id)} title="Chạy ngay">
              <Play size={12} color="#107c41" /> <span>{label}</span>
            </button>
          ))}
        </div>

        {draft && selected ? (
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <label style={FIELD_STYLE}>
              <span>Tên macro</span>
              <input style={INPUT_STYLE} value={draft.name} maxLength={MAX_MACRO_NAME_LENGTH} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label style={FIELD_STYLE}>
              <span>Mô tả</span>
              <input style={INPUT_STYLE} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <ShortcutField value={draft.shortcut} problem={problem} onChange={(shortcut) => setDraft({ ...draft, shortcut })} />
            <label className="check-field">
              <input type="checkbox" checked={draft.relative} onChange={(e) => setDraft({ ...draft, relative: e.target.checked })} />
              <span>Chạy theo tham chiếu tương đối (dịch theo ô đang chọn)</span>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sheet" onClick={() => onRun(selected.id)}>
                <Play size={14} /> <span>Chạy</span>
              </button>
              <button
                className="btn"
                disabled={!isDirty || !!problem || draft.name.trim().length === 0}
                onClick={() => onUpdate({ ...draft, name: draft.name.trim(), steps: selected.steps })}
              >
                <Save size={14} /> <span>Lưu thay đổi</span>
              </button>
              <button
                className="btn"
                style={{ color: '#dc2626' }}
                onClick={() => {
                  onDelete(selected.id);
                  const next = macros.find((macro) => macro.id !== selected.id) ?? null;
                  setSelectedId(next?.id ?? '');
                  setDraft(next);
                }}
              >
                <Trash2 size={14} /> <span>Xoá</span>
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
              {commandCount} thao tác đã ghi{selected.steps.length > MAX_STEPS_SHOWN ? ` (hiện ${MAX_STEPS_SHOWN} bước đầu)` : ''}
            </div>
            <ol style={{ margin: 0, paddingLeft: 22, maxHeight: 190, overflow: 'auto', fontSize: 12.5, border: '1px solid var(--line)', borderRadius: 6, padding: '8px 8px 8px 30px' }}>
              {selected.steps.slice(0, MAX_STEPS_SHOWN).map((step, index) => (
                <li key={index} style={{ color: step.kind === 'select' ? '#64748b' : '#0f172a' }}>{describeStep(step)}</li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="pro-result">Chọn một macro ở cột bên trái để xem các bước, đổi tên, gán phím tắt hoặc chạy.</div>
        )}
      </div>
    </ProDialog>
  );
}

export function MacroButtonModal({
  macros,
  rangeA1,
  initialLabel,
  initialTarget,
  onInsert,
  onRemove,
  onClose,
}: {
  macros: SheetMacro[];
  rangeA1: string;
  initialLabel: string;
  initialTarget: MacroTarget | null;
  onInsert: (label: string, target: MacroTarget, color: MacroButtonColor) => void;
  onRemove: (() => void) | null;
  onClose: () => void;
}) {
  const fallback: MacroTarget = macros[0] ? { kind: 'macro', id: macros[0].id } : { kind: 'builtin', id: BUILTIN_MACROS[0][0] };
  const [target, setTarget] = useState(encodeTarget(initialTarget ?? fallback));
  const [label, setLabel] = useState(initialLabel);
  const [colorId, setColorId] = useState<MacroButtonColor['id']>('green');
  const color = MACRO_BUTTON_COLORS.find((item) => item.id === colorId) ?? MACRO_BUTTON_COLORS[0];
  const decoded = decodeTarget(target);
  return (
    <ProDialog
      title="Chèn nút bấm chạy macro"
      subtitle={`Vùng ${rangeA1} sẽ thành một nút: bấm chuột vào nút là macro chạy. Nút đi theo ô khi chèn, xoá hàng cột hoặc sắp xếp.`}
      width={520}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Huỷ</button>
          {onRemove && (
            <button className="btn" style={{ color: '#dc2626' }} onClick={onRemove}>
              <Trash2 size={14} /> <span>Gỡ nút</span>
            </button>
          )}
          <button className="btn btn-sheet" disabled={!decoded || label.trim().length === 0} onClick={() => decoded && onInsert(label.trim(), decoded, color)}>
            <MousePointerClick size={15} /> <span>{onRemove ? 'Cập nhật nút' : 'Chèn nút'}</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={FIELD_STYLE}>
          <span>Chữ trên nút</span>
          <input style={INPUT_STYLE} value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label style={FIELD_STYLE}>
          <span>Khi bấm thì chạy</span>
          <select style={INPUT_STYLE} value={target} onChange={(e) => setTarget(e.target.value)}>
            {macros.length > 0 && (
              <optgroup label="Macro đã ghi">
                {macros.map((macro) => (
                  <option key={macro.id} value={encodeTarget({ kind: 'macro', id: macro.id })}>{macro.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Macro có sẵn">
              {BUILTIN_MACROS.map(([id, text]) => (
                <option key={id} value={encodeTarget({ kind: 'builtin', id })}>{text}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <div style={FIELD_STYLE}>
          <span>Màu nút</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MACRO_BUTTON_COLORS.map((item) => (
              <button
                key={item.id}
                onClick={() => setColorId(item.id)}
                style={{ background: item.background, color: item.text, border: item.id === colorId ? '2px solid #0f172a' : '2px solid transparent', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ProDialog>
  );
}
