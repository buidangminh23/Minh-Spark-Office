import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Sigma } from 'lucide-react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { useDoc } from '../DocContext';
import Modal from './Modal';
import { STRUCTURE_GROUPS, SYMBOL_GROUPS, TEMPLATE_SUBJECTS, fieldToLatex, katexStrict, latexForPreview, latexForSource, usesChemistry, type MathGroup, type MathItem } from '../mathCatalog';
import { EQUATION_COLORS, EQUATION_SIZES, equationClassName, equationInlineStyle, normalizePresentation, type EquationAlign, type EquationPresentation } from '../equationStyle';
import { createMathfield, type MathfieldLike } from '../mathliveLoader';
import './mathType.css';

type Panel = 'structure' | 'symbol' | 'template' | 'format';
type Mode = 'visual' | 'latex';


interface VirtualKeyboardLike {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

const PANELS: { id: Panel; name: string }[] = [
  { id: 'structure', name: 'Cấu trúc' },
  { id: 'symbol', name: 'Ký hiệu' },
  { id: 'template', name: 'Mẫu theo môn' },
  { id: 'format', name: 'Trình bày' },
];

const ALIGN_LABELS: Record<EquationAlign, string> = { left: 'Trái', center: 'Giữa', right: 'Phải' };
const COLOR_LABELS: Record<string, string> = { '': 'Mặc định', '#c00000': 'Đỏ', '#1f4e9c': 'Xanh dương', '#107c41': 'Xanh lá', '#7030a0': 'Tím', '#c55a11': 'Cam' };
const DEFAULT_LATEX = 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}';

const keyboard = () => (window as unknown as { mathVirtualKeyboard?: VirtualKeyboardLike }).mathVirtualKeyboard;

const renderKatex = (latex: string, display: boolean) =>
  katex.renderToString(latex || '\\square', { throwOnError: false, displayMode: display, output: 'html', strict: katexStrict });

function MathButton({ item, onPick, compact }: { item: MathItem; onPick: (item: MathItem) => void; compact?: boolean }) {
  const html = useMemo(() => renderKatex(latexForPreview(item.latex), false), [item.latex]);
  return (
    <button type="button" className={`mt-item ${compact ? 'compact' : ''}`} title={item.label} aria-label={item.label} onClick={() => onPick(item)}>
      <span className="mt-item-math" dangerouslySetInnerHTML={{ __html: html }} />
      {!compact && <span className="mt-item-label">{item.label}</span>}
    </button>
  );
}

function GroupPicker({ groups, active, onChange }: { groups: MathGroup[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="mt-groups" role="tablist">
      {groups.map((group) => (
        <button key={group.id} type="button" role="tab" aria-selected={active === group.id} className={`mt-group ${active === group.id ? 'active' : ''}`} onClick={() => onChange(group.id)}>
          {group.name}
        </button>
      ))}
    </div>
  );
}

function useMathfield(host: React.RefObject<HTMLDivElement | null>, initial: string, onInput: (latex: string) => void) {
  const fieldRef = useRef<MathfieldLike | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const field = await createMathfield(initial);
        if (cancelled || !host.current) return;
        field.mathVirtualKeyboardPolicy = 'manual';
        field.addEventListener('input', () => onInputRef.current(fieldToLatex(field.value)));
        host.current.append(field);
        fieldRef.current = field;
        setReady(true);
        requestAnimationFrame(() => field.focus());
      } catch (err) {
        console.warn('MathLive failed to load:', err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      keyboard()?.hide();
      fieldRef.current?.remove();
      fieldRef.current = null;
    };
  }, [host, initial]);
  return { fieldRef, ready, failed };
}

export function EquationDialog({ onClose }: { onClose: () => void }) {
  const { editor, editing, setEditing } = useDoc();
  const initialLatex = useMemo(() => String(editing?.attrs.latex ?? DEFAULT_LATEX), [editing]);
  const [latex, setLatex] = useState(initialLatex);
  const [presentation, setPresentation] = useState<EquationPresentation>(() => normalizePresentation(editing ? editing.attrs : { display: true }));
  const [panel, setPanel] = useState<Panel>('structure');
  const [structureGroup, setStructureGroup] = useState(STRUCTURE_GROUPS[0].id);
  const [symbolGroup, setSymbolGroup] = useState(SYMBOL_GROUPS[0].id);
  const [subject, setSubject] = useState(TEMPLATE_SUBJECTS[0].id);
  const [mode, setMode] = useState<Mode>(usesChemistry(initialLatex) ? 'latex' : 'visual');
  const host = useRef<HTMLDivElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const { fieldRef, ready, failed } = useMathfield(host, initialLatex, setLatex);
  const chemistry = usesChemistry(latex);
  const effectiveMode: Mode = failed || chemistry ? 'latex' : mode;
  const preview = useMemo(() => renderKatex(latex, presentation.display), [latex, presentation.display]);
  const update = (patch: Partial<EquationPresentation>) => setPresentation((current) => normalizePresentation({ ...current, ...patch }));

  const switchMode = (next: Mode) => {
    if (next === 'visual' && fieldRef.current) {
      fieldRef.current.value = latex;
      requestAnimationFrame(() => fieldRef.current?.focus());
    }
    setMode(next);
  };

  const insertIntoSource = (snippet: string) => {
    const el = area.current;
    if (!el) return setLatex((value) => value + snippet);
    const start = el.selectionStart;
    setLatex(latex.slice(0, start) + snippet + latex.slice(el.selectionEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  };

  const insertItem = (item: MathItem) => {
    if (effectiveMode === 'visual' && fieldRef.current && !usesChemistry(item.latex)) {
      fieldRef.current.executeCommand(['insert', item.latex, { selectionMode: 'placeholder', format: 'latex' }]);
      setLatex(fieldToLatex(fieldRef.current.value));
      fieldRef.current.focus();
      return;
    }
    if (usesChemistry(item.latex)) setMode('latex');
    insertIntoSource(latexForSource(item.latex));
  };

  const useTemplate = (item: MathItem) => {
    setLatex(item.latex);
    if (fieldRef.current && !usesChemistry(item.latex)) fieldRef.current.value = item.latex;
  };

  const close = () => {
    keyboard()?.hide();
    setEditing(null);
    onClose();
  };

  const apply = () => {
    const attrs = { ...presentation, latex };
    if (editing) {
      const node = editor.state.doc.nodeAt(editing.pos);
      if (node?.type.name === 'equation') editor.view.dispatch(editor.state.tr.setNodeMarkup(editing.pos, undefined, attrs));
    } else {
      editor.chain().focus().insertEquation(latex, presentation.display, presentation).run();
    }
    close();
  };

  const toggleKeyboard = () => {
    const vk = keyboard();
    if (!vk) return;
    if (vk.visible) vk.hide();
    else {
      fieldRef.current?.focus();
      vk.show();
    }
  };

  const activeStructure = STRUCTURE_GROUPS.find((group) => group.id === structureGroup) ?? STRUCTURE_GROUPS[0];
  const activeSymbols = SYMBOL_GROUPS.find((group) => group.id === symbolGroup) ?? SYMBOL_GROUPS[0];
  const activeSubject = TEMPLATE_SUBJECTS.find((group) => group.id === subject) ?? TEMPLATE_SUBJECTS[0];

  return (
    <Modal
      title={editing ? 'Sửa công thức' : 'Trình soạn công thức'}
      subtitle="Gõ trực tiếp như MathType: a/b thành phân số, ^ lên mũ, _ chỉ số, sqrt thành căn, Tab sang ô kế tiếp."
      icon={<Sigma size={20} />}
      onClose={close}
      width={880}
      actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!latex.trim()} onClick={apply}>{editing ? 'Lưu' : 'Chèn'}</button></>}
    >
      <div className="mt-panels" role="tablist">
        {PANELS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={panel === item.id} className={`comments-tab ${panel === item.id ? 'active' : ''}`} onClick={() => setPanel(item.id)}>
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-palette">
        {panel === 'structure' && (
          <>
            <GroupPicker groups={STRUCTURE_GROUPS} active={structureGroup} onChange={setStructureGroup} />
            <div className="mt-grid">{activeStructure.items.map((item) => <MathButton key={item.label} item={item} onPick={insertItem} />)}</div>
          </>
        )}
        {panel === 'symbol' && (
          <>
            <GroupPicker groups={SYMBOL_GROUPS} active={symbolGroup} onChange={setSymbolGroup} />
            <div className="mt-grid symbols">{activeSymbols.items.map((item) => <MathButton key={item.latex} item={item} onPick={insertItem} compact={activeSymbols.id !== 'letters'} />)}</div>
          </>
        )}
        {panel === 'template' && (
          <>
            <GroupPicker groups={TEMPLATE_SUBJECTS} active={subject} onChange={setSubject} />
            <div className="mt-grid templates">{activeSubject.items.map((item) => <MathButton key={item.label} item={item} onPick={useTemplate} />)}</div>
          </>
        )}
        {panel === 'format' && (
          <div className="mt-format">
            <label className="mt-check"><input type="checkbox" checked={presentation.display} onChange={(e) => update({ display: e.target.checked })} /> Riêng một dòng (công thức khối)</label>
            <div className="mt-row">
              <span>Căn lề</span>
              {(['left', 'center', 'right'] as EquationAlign[]).map((align) => (
                <button key={align} type="button" className={`mt-chip ${presentation.align === align ? 'active' : ''}`} disabled={!presentation.display} onClick={() => update({ align })}>{ALIGN_LABELS[align]}</button>
              ))}
            </div>
            <label className="mt-check"><input type="checkbox" checked={presentation.numbered} disabled={!presentation.display} onChange={(e) => update({ numbered: e.target.checked })} /> Đánh số phương trình (1), (2)… ở lề phải</label>
            <div className="mt-row">
              <span>Cỡ chữ</span>
              {EQUATION_SIZES.map((size) => (
                <button key={size} type="button" className={`mt-chip ${presentation.size === size ? 'active' : ''}`} onClick={() => update({ size })}>{size}%</button>
              ))}
            </div>
            <div className="mt-row">
              <span>Màu</span>
              {EQUATION_COLORS.map((color) => (
                <button key={color || 'auto'} type="button" className={`mt-swatch ${presentation.color === color ? 'active' : ''}`} style={{ background: color || '#1f2933' }} title={COLOR_LABELS[color]} aria-label={COLOR_LABELS[color]} onClick={() => update({ color })} />
              ))}
            </div>
            <label className="mt-check"><input type="checkbox" checked={presentation.boxed} onChange={(e) => update({ boxed: e.target.checked })} /> Đóng khung công thức</label>
          </div>
        )}
      </div>

      <div className="mt-toolbar">
        <div className="mt-modes" role="radiogroup" aria-label="Chế độ soạn">
          <button type="button" role="radio" aria-checked={effectiveMode === 'visual'} className={`mt-chip ${effectiveMode === 'visual' ? 'active' : ''}`} disabled={failed || chemistry} onClick={() => switchMode('visual')}>Trực quan</button>
          <button type="button" role="radio" aria-checked={effectiveMode === 'latex'} className={`mt-chip ${effectiveMode === 'latex' ? 'active' : ''}`} onClick={() => switchMode('latex')}>LaTeX</button>
        </div>
        {chemistry && <span className="mt-note">Công thức hóa học (\ce) soạn ở chế độ LaTeX.</span>}
        {failed && <span className="mt-note">Không tải được trình soạn trực quan, dùng chế độ LaTeX.</span>}
        <button type="button" className="btn mt-keyboard" disabled={!ready || effectiveMode !== 'visual'} onClick={toggleKeyboard}><Keyboard size={15} /> Bàn phím toán</button>
      </div>

      <div className="mt-editor" hidden={effectiveMode !== 'visual'} ref={host} />
      {!ready && !failed && effectiveMode === 'visual' && <div className="mt-loading">Đang tải trình soạn…</div>}
      {effectiveMode === 'latex' && (
        <textarea ref={area} className="text-field mono" rows={3} aria-label="Công thức LaTeX" value={latex} onChange={(e) => setLatex(e.target.value)} />
      )}

      <div className="mt-preview-label">Xem trước khi chèn</div>
      <div className="equation-preview mt-preview">
        <span className={equationClassName(presentation)} style={styleObject(equationInlineStyle(presentation))} dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </Modal>
  );
}

const styleObject = (css: string): React.CSSProperties =>
  Object.fromEntries(
    css
      .split(';')
      .filter(Boolean)
      .map((rule) => {
        const [key, value] = rule.split(':');
        return [key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value];
      })
  );
