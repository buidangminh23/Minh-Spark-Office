import { useMemo, useState, type KeyboardEvent } from 'react';
import { FilePlus2, Pencil, Play, Save, Trash2 } from 'lucide-react';
import { ProDialog } from './SheetProModals';
import { defaultAttributes, type VbaModuleData } from '../../lib/vbaProject';
import { listProcedures, runnableMacros } from './vba/vbaInterpreter';

const INPUT_STYLE = { padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 } as const;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,30}$/;
const KIND_LABEL: Record<VbaModuleData['kind'], string> = { standard: 'Mô-đun', document: 'Đối tượng', class: 'Lớp', form: 'Biểu mẫu' };
const INDENT = '    ';

export const newStandardModule = (name: string): VbaModuleData => ({
  name,
  kind: 'standard',
  code: `Option Explicit\r\n\r\nSub ${name === 'Module1' ? 'Macro1' : `${name}_Macro`}()\r\n    \r\nEnd Sub\r\n`,
  attributes: defaultAttributes({ name, kind: 'standard' }),
});

const nextModuleName = (modules: VbaModuleData[]) => {
  const taken = new Set(modules.map((module) => module.name.toLowerCase()));
  let index = 1;
  while (taken.has(`module${index}`)) index += 1;
  return `Module${index}`;
};

const renameAttributes = (attributes: string[], name: string) =>
  attributes.map((line) => (/^\s*Attribute\s+VB_Name\s*=/i.test(line) ? `Attribute VB_Name = "${name}"` : line));

export function VbaEditorModal({
  modules: initialModules,
  initialModule,
  output,
  onSave,
  onRun,
  onClearOutput,
  onClose,
}: {
  modules: VbaModuleData[];
  initialModule?: string;
  output: string[];
  onSave: (modules: VbaModuleData[]) => void;
  onRun: (macroId: string, modules: VbaModuleData[]) => void;
  onClearOutput: () => void;
  onClose: () => void;
}) {
  const [modules, setModules] = useState<VbaModuleData[]>(() => (initialModules.length ? initialModules : [newStandardModule('Module1')]));
  const [selected, setSelected] = useState(() => initialModule ?? initialModules.find((module) => module.kind === 'standard')?.name ?? initialModules[0]?.name ?? 'Module1');
  const [renaming, setRenaming] = useState<string | null>(null);
  const current = modules.find((module) => module.name === selected) ?? modules[0];
  const sources = useMemo(() => modules.map((module) => ({ name: module.name, code: module.code })), [modules]);
  const errors = useMemo(() => listProcedures(sources).errors, [sources]);
  const macros = useMemo(() => runnableMacros(sources.filter((_, index) => modules[index].kind !== 'form')), [sources, modules]);
  const [macroId, setMacroId] = useState('');
  const runTarget = macros.find((proc) => `${proc.module}.${proc.name}` === macroId) ?? macros.find((proc) => proc.module === current?.name) ?? macros[0];
  const isDirty = JSON.stringify(modules) !== JSON.stringify(initialModules);

  const updateCode = (code: string) => setModules((previous) => previous.map((module) => (module.name === current.name ? { ...module, code } : module)));

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const area = event.currentTarget;
    const { selectionStart, selectionEnd, value } = area;
    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
    updateCode(next);
    requestAnimationFrame(() => area.setSelectionRange(selectionStart + INDENT.length, selectionStart + INDENT.length));
  };

  const addModule = () => {
    const name = nextModuleName(modules);
    setModules((previous) => [...previous, newStandardModule(name)]);
    setSelected(name);
  };

  const removeModule = () => {
    if (!current || current.kind === 'document') return;
    const rest = modules.filter((module) => module.name !== current.name);
    setModules(rest);
    setSelected(rest[0]?.name ?? '');
  };

  const commitRename = (name: string) => {
    setRenaming(null);
    const clean = name.trim();
    if (!current || clean === current.name || !IDENTIFIER.test(clean)) return;
    if (modules.some((module) => module.name.toLowerCase() === clean.toLowerCase())) return;
    setModules((previous) => previous.map((module) => (module.name === current.name ? { ...module, name: clean, attributes: renameAttributes(module.attributes, clean) } : module)));
    setSelected(clean);
  };

  return (
    <ProDialog
      title="Trình soạn VBA (Alt + F11)"
      subtitle="Viết, sửa và chạy macro VBA ngay trong 23 Sheets. Mã được lưu cùng bảng tính và đi theo tệp .xlsm khi xuất để mở bằng Microsoft Excel."
      width={1040}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Đóng</button>
          <button className="btn" disabled={!isDirty} onClick={() => onSave(modules)}>
            <Save size={14} /> <span>Lưu mã</span>
          </button>
          <button className="btn btn-sheet" disabled={!runTarget || errors.length > 0} onClick={() => runTarget && onRun(`${runTarget.module}.${runTarget.name}`, modules)}>
            <Play size={14} /> <span>Lưu và chạy</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 12, minHeight: 440 }}>
        <div style={{ display: 'grid', gap: 6, alignContent: 'start', maxHeight: 520, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ flex: 1 }} onClick={addModule} title="Thêm mô-đun mới">
              <FilePlus2 size={14} /> <span>Mô-đun</span>
            </button>
            <button className="btn" disabled={!current || current.kind === 'document'} onClick={() => setRenaming(current?.name ?? null)} title="Đổi tên mô-đun">
              <Pencil size={14} />
            </button>
            <button className="btn" style={{ color: '#dc2626' }} disabled={!current || current.kind === 'document'} onClick={removeModule} title="Xoá mô-đun">
              <Trash2 size={14} />
            </button>
          </div>
          {modules.map((module) =>
            renaming === module.name ? (
              <input
                key={module.name}
                style={INPUT_STYLE}
                defaultValue={module.name}
                autoFocus
                onBlur={(e) => commitRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(e.currentTarget.value);
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <button
                key={module.name}
                className="sheet-popover-item"
                style={{ textAlign: 'left', border: module.name === current?.name ? '1px solid #107c41' : '1px solid var(--line)', borderRadius: 6, padding: '6px 9px' }}
                onClick={() => setSelected(module.name)}
              >
                <span style={{ fontWeight: 600 }}>{module.name}</span>
                <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11.5 }}>{KIND_LABEL[module.kind]}</span>
              </button>
            )
          )}
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateRows: 'auto minmax(0, 1fr) auto auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span>Macro chạy:</span>
            <select style={INPUT_STYLE} value={runTarget ? `${runTarget.module}.${runTarget.name}` : ''} onChange={(e) => setMacroId(e.target.value)}>
              {macros.length === 0 && <option value="">Chưa có Sub nào chạy được</option>}
              {macros.map((proc) => (
                <option key={`${proc.module}.${proc.name}`} value={`${proc.module}.${proc.name}`}>{`${proc.name} (${proc.module})`}</option>
              ))}
            </select>
            <span style={{ color: errors.length ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{errors.length ? `${errors.length} lỗi cú pháp` : 'Cú pháp hợp lệ'}</span>
          </div>
          {current ? (
            <textarea
              aria-label={`Mã VBA của ${current.name}`}
              spellCheck={false}
              value={current.code}
              onChange={(e) => updateCode(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ width: '100%', minHeight: 330, resize: 'vertical', fontFamily: 'Consolas, "Cascadia Mono", monospace', fontSize: 13, lineHeight: 1.5, padding: 10, border: '1px solid var(--line)', borderRadius: 6, whiteSpace: 'pre', tabSize: 4 }}
            />
          ) : (
            <div className="pro-result">Bảng tính chưa có mô-đun nào. Bấm “Mô-đun” để thêm.</div>
          )}
          {errors.length > 0 && (
            <div style={{ color: '#dc2626', fontSize: 12.5, maxHeight: 70, overflow: 'auto' }}>
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#475569' }}>
              <span>Cửa sổ Immediate (Debug.Print)</span>
              <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} disabled={!output.length} onClick={onClearOutput}>Xoá</button>
            </div>
            <pre style={{ margin: 0, minHeight: 56, maxHeight: 120, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', borderRadius: 6, padding: 8, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
              {output.length ? output.join('\n') : ' '}
            </pre>
          </div>
        </div>
      </div>
    </ProDialog>
  );
}
