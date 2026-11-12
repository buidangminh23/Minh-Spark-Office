import { useMemo, useState } from 'react';
import { Circle, Code2, Play, Trash2, MousePointerClick, Save, Wand2 } from 'lucide-react';
import { ProDialog } from './SheetProModals';
import {
  BUILTIN_MACROS,
  MAX_MACRO_NAME_LENGTH,
  decodeTarget,
  describeStep,
  encodeTarget,
  normalizeShortcut,
  shortcutLabel,
  shortcutProblem,
  shortcutWarning,
  type BuiltinMacroId,
  type MacroTarget,
  type SheetMacro,
} from './sheetMacros';
import type { VbaMacroInfo } from './vba/runVba';

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
  const withShift = !!value && value === value.toUpperCase();
  const warning = problem ? null : shortcutWarning(value);
  return (
    <div style={FIELD_STYLE}>
      <span>Phím tắt (một chữ cái, để trống nếu không cần)</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#475569' }}>Ctrl +</span>
        <input
          style={{ ...INPUT_STYLE, width: 64, textTransform: 'uppercase' }}
          value={value.toUpperCase()}
          maxLength={1}
          placeholder="K"
          aria-label="Chữ cái của phím tắt"
          onChange={(e) => {
            const letter = normalizeShortcut(e.target.value).toLowerCase();
            onChange(letter && withShift ? letter.toUpperCase() : letter);
          }}
        />
        <label className="check-field" style={{ margin: 0 }}>
          <input type="checkbox" checked={withShift} disabled={!value} onChange={(e) => onChange(e.target.checked ? value.toUpperCase() : value.toLowerCase())} />
          <span>Kèm Shift</span>
        </label>
        {value && <span style={{ color: '#0f172a', fontWeight: 600 }}>{shortcutLabel(value)}</span>}
      </div>
      {problem && <span style={{ color: '#dc2626' }}>{problem}</span>}
      {warning && <span style={{ color: '#b45309' }}>{warning}</span>}
    </div>
  );
}

const vbaTaken = (vbaMacros: VbaMacroInfo[], ownId = '') =>
  Object.fromEntries(vbaMacros.filter((item) => item.shortcut && item.id !== ownId).map((item) => [item.shortcut, item.name]));

export function MacroRecordModal({
  suggestedName,
  macros,
  vbaMacros = [],
  startCellA1,
  onStart,
  onClose,
}: {
  suggestedName: string;
  macros: SheetMacro[];
  vbaMacros?: VbaMacroInfo[];
  startCellA1: string;
  onStart: (options: MacroRecordOptions) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [relative, setRelative] = useState(false);
  const problem = shortcutProblem(shortcut, macros, '', vbaTaken(vbaMacros));
  const canStart = name.trim().length > 0 && !problem;
  return (
    <ProDialog
      title="Ghi macro (Record Macro)"
      subtitle="Sau khi bấm Bắt đầu ghi, mọi thao tác trên bảng tính được ghi lại: nhập liệu, dán, định dạng, chèn xoá hàng cột, nhóm hàng cột, ngắt trang và thiết lập in, cho tới khi sếp bấm Dừng ghi."
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

function VbaMacroPanel({
  macro,
  macros,
  vbaMacros,
  onRun,
  onShortcut,
  onEdit,
}: {
  macro: VbaMacroInfo;
  macros: SheetMacro[];
  vbaMacros: VbaMacroInfo[];
  onRun: (id: string) => void;
  onShortcut: (id: string, letter: string) => void;
  onEdit: (module: string) => void;
}) {
  const [shortcut, setShortcut] = useState(macro.shortcut);
  const problem = shortcutProblem(shortcut, macros, '', vbaTaken(vbaMacros, macro.id));
  return (
    <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
      <div style={{ fontSize: 13 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{macro.name}</div>
        <div style={{ color: '#64748b' }}>Macro VBA trong mô-đun {macro.module}</div>
      </div>
      <ShortcutField value={shortcut} problem={problem} onChange={setShortcut} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-sheet" onClick={() => onRun(macro.id)}>
          <Play size={14} /> <span>Chạy</span>
        </button>
        <button className="btn" disabled={shortcut === macro.shortcut || !!problem} onClick={() => onShortcut(macro.id, shortcut)}>
          <Save size={14} /> <span>Lưu phím tắt</span>
        </button>
        <button className="btn" onClick={() => onEdit(macro.module)}>
          <Code2 size={14} /> <span>Sửa mã</span>
        </button>
      </div>
      <div className="pro-result" style={{ fontSize: 12.5 }}>
        Macro VBA chạy ngay trong Minh Sheets: đọc ghi ô, định dạng, trang tính, vòng lặp, hàm, MsgBox, InputBox và UserForm. Sau khi bật macro, các sự kiện Workbook_Open, Workbook_BeforeSave, Worksheet_Change, Worksheet_SelectionChange và Worksheet_Activate tự chạy như trong Excel.
      </div>
    </div>
  );
}

export function MacroManagerModal({
  macros,
  vbaMacros = [],
  onRun,
  onRunBuiltin,
  onRunVba,
  onVbaShortcut,
  onEditVba,
  onConvertToVba,
  onUpdate,
  onDelete,
  onClose,
}: {
  macros: SheetMacro[];
  vbaMacros?: VbaMacroInfo[];
  onRun: (id: string) => void;
  onRunBuiltin: (id: BuiltinMacroId) => void;
  onRunVba: (id: string) => void;
  onVbaShortcut: (id: string, letter: string) => void;
  onEditVba: (module: string) => void;
  onConvertToVba: (id: string) => void;
  onUpdate: (macro: SheetMacro) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(macros[0]?.id ?? (vbaMacros[0] ? `vba:${vbaMacros[0].id}` : ''));
  const selected = macros.find((macro) => macro.id === selectedId) ?? null;
  const selectedVba = vbaMacros.find((macro) => `vba:${macro.id}` === selectedId) ?? null;
  const [draft, setDraft] = useState<SheetMacro | null>(selected);
  const select = (macro: SheetMacro) => {
    setSelectedId(macro.id);
    setDraft(macro);
  };
  const problem = draft ? shortcutProblem(draft.shortcut, macros, draft.id, vbaTaken(vbaMacros)) : null;
  const isDirty = !!draft && !!selected && JSON.stringify({ ...draft, steps: [] }) !== JSON.stringify({ ...selected, steps: [] });
  const commandCount = useMemo(() => selected?.steps.filter((step) => step.kind === 'command').length ?? 0, [selected]);

  return (
    <ProDialog
      title="Macro (Alt + F8)"
      subtitle="Chạy, đổi tên, gán phím tắt hoặc xoá macro đã ghi và macro VBA. Macro được lưu cùng bảng tính này và đi theo tệp .xlsm khi xuất."
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
              {macro.shortcut && <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11.5 }}>{shortcutLabel(macro.shortcut)}</span>}
            </button>
          ))}
          {vbaMacros.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginTop: 6 }}>Macro VBA ({vbaMacros.length})</div>}
          {vbaMacros.map((macro) => (
            <button
              key={macro.id}
              className="sheet-popover-item"
              style={{ textAlign: 'left', border: `vba:${macro.id}` === selectedId ? '1px solid #107c41' : '1px solid var(--line)', borderRadius: 6, padding: '7px 9px' }}
              onClick={() => {
                setSelectedId(`vba:${macro.id}`);
                setDraft(null);
              }}
            >
              <span style={{ fontWeight: 600 }}>{macro.name}</span>
              <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11.5 }}>{macro.shortcut ? shortcutLabel(macro.shortcut) : macro.module}</span>
            </button>
          ))}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginTop: 6 }}>Macro có sẵn</div>
          {BUILTIN_MACROS.map(([id, label]) => (
            <button key={id} className="sheet-popover-item" style={{ textAlign: 'left', padding: '5px 9px' }} onClick={() => onRunBuiltin(id)} title="Chạy ngay">
              <Play size={12} color="#107c41" /> <span>{label}</span>
            </button>
          ))}
        </div>

        {selectedVba ? (
          <VbaMacroPanel key={selectedVba.id} macro={selectedVba} macros={macros} vbaMacros={vbaMacros} onRun={onRunVba} onShortcut={onVbaShortcut} onEdit={onEditVba} />
        ) : draft && selected ? (
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
              <button className="btn" onClick={() => onConvertToVba(selected.id)} title="Viết macro này thành mã VBA để sửa tay và chạy được trong Microsoft Excel">
                <Wand2 size={14} /> <span>Chuyển sang VBA</span>
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
  vbaMacros = [],
  rangeA1,
  initialLabel,
  initialTarget,
  onInsert,
  onRemove,
  onClose,
}: {
  macros: SheetMacro[];
  vbaMacros?: VbaMacroInfo[];
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
      subtitle={`Vùng ${rangeA1} sẽ thành một nút: bấm chuột vào nút là macro chạy. Bật Chế độ thiết kế ở tab Automate để chọn và sửa nút mà không chạy macro.`}
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
            {vbaMacros.length > 0 && (
              <optgroup label="Macro VBA">
                {vbaMacros.map((macro) => (
                  <option key={macro.id} value={encodeTarget({ kind: 'vba', id: macro.id })}>{`${macro.name} (${macro.module})`}</option>
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
