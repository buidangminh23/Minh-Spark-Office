import type { ReactNode } from 'react';
import { CircleHelp, Eraser, Eye, EyeOff, ImageDown, Lasso, MousePointer2, Paintbrush, Pencil, PenLine, Play, Plus, Redo2, RotateCcw, Ruler, Shapes, Sigma, Signature, Smartphone, Trash2, Undo2, Grid2x2 } from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import type { InkKind, PageSettings } from '../../../../lib/storage';
import { useDoc, type InkTool } from '../../DocContext';
import { bakeInkToImage } from '../../actionsExtra';
import { KIND_LABELS, addPen, commitInk, deleteSelectedInk, redoInk, removePen, resetPens, setInkSelection, undoInk, updatePen, updateSelectedInk, useInkStore, usePens, type PenPreset } from '../../inkStore';
import { Big, ColorPicker, Dropdown, Group, MenuHeading, MenuItem, MenuSeparator, Rows, Small, THEME_COLORS, usePopover } from '../RibbonParts';

const WIDTHS = [1, 2, 3, 5, 8, 12];
const PEN_COLORS = ['#111827', '#ffffff', '#dc2626', '#ea580c', '#fde047', '#16a34a', '#0891b2', '#1d4ed8', '#7c3aed', '#db2777', '#475569', '#92400e'];
const BACKGROUNDS: { id: NonNullable<PageSettings['background']>; label: string }[] = [
  { id: 'none', label: 'Không kẻ nền' },
  { id: 'ruled-narrow', label: 'Dòng kẻ hẹp' },
  { id: 'ruled-wide', label: 'Dòng kẻ rộng' },
  { id: 'grid-small', label: 'Ô lưới nhỏ' },
  { id: 'grid-large', label: 'Ô lưới lớn' },
  { id: 'dots', label: 'Chấm' },
];
const PEN_KINDS: InkKind[] = ['pen', 'pencil', 'highlighter', 'fountain', 'galaxy', 'action'];
const DRAW_TOOLS: InkTool[] = ['pen', 'highlighter'];

function PenIcon({ kind, color, width }: { kind: InkKind; color: string; width: number }) {
  const tipWidth = Math.min(6, 1.5 + width / 2);
  const gradient = `pen-galaxy-${color.replace('#', '')}`;
  const band = kind === 'galaxy' ? `url(#${gradient})` : color;
  const body = kind === 'pencil' ? '#cbd5e1' : '#9aa3b2';
  return (
    <svg width="22" height="42" viewBox="0 0 22 42" aria-hidden>
      {kind === 'galaxy' && <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="0.5" stopColor="#06b6d4" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>}
      <rect x="5" y="0" width="12" height="22" fill={body} rx="1" />
      <rect x="5" y="16" width="12" height="7" fill={band} />
      {kind === 'highlighter'
        ? <polygon points="5,23 17,23 17,32 8,36 5,32" fill={band} stroke="#64748b" strokeWidth="0.6" />
        : kind === 'fountain'
          ? <><polygon points="5,23 17,23 11,40" fill={band} /><line x1="11" y1="28" x2="11" y2="39" stroke="#ffffff" strokeWidth="0.8" /></>
          : kind === 'pencil'
            ? <><polygon points="5,23 17,23 11,38" fill="#f1d9b5" /><polygon points="9,33 13,33 11,38" fill={band} /></>
            : <><polygon points="5,23 17,23 12.5,36 9.5,36" fill="#334155" /><rect x={11 - tipWidth / 2} y="36" width={tipWidth} height="4" rx="1" fill={band} /></>}
      {kind === 'action' && <><circle cx="4" cy="33" r="1.4" fill={color} /><circle cx="18" cy="30" r="1.1" fill={color} /><circle cx="19" cy="37" r="0.9" fill={color} /></>}
    </svg>
  );
}

function ToolButton({ active, title, icon, onActivate, children, width }: { active: boolean; title: string; icon: ReactNode; onActivate: () => void; children: (close: () => void) => ReactNode; width?: number }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="ribbon-dropdown ink-tool-host" ref={ref}>
      <button type="button" className={`ribbon-btn-large ink-pen-btn ${active ? 'active' : ''}`} title={title} aria-label={title} aria-pressed={active} aria-haspopup="menu" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (active) setOpen(!open); else { onActivate(); setOpen(false); } }}>
        {icon}
      </button>
      {open && <div className="ribbon-menu" role="menu" style={width ? { width } : undefined} onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function PenMenu({ pen, onChange, onRemove, close }: { pen: PenPreset; onChange: (patch: Partial<PenPreset>) => void; onRemove: (() => void) | null; close: () => void }) {
  return (
    <div className="ink-pen-menu">
      <MenuHeading>{pen.label}: độ dày</MenuHeading>
      <div className="ink-width-row">
        {WIDTHS.map((width) => (
          <button key={width} type="button" className={`ink-width-choice ${pen.width === width ? 'on' : ''}`} title={`Độ dày ${width}`} aria-label={`Độ dày ${width}`} aria-pressed={pen.width === width} onClick={() => onChange({ width })}>
            <span style={{ width, height: width, background: pen.color }} />
          </button>
        ))}
      </div>
      <MenuHeading>Màu bút</MenuHeading>
      <div className="color-grid ink-color-grid">
        {PEN_COLORS.map((color) => <button key={color} type="button" className={`color-swatch ${pen.color === color ? 'selected' : ''}`} style={{ background: color }} title={color} aria-label={color} onClick={() => onChange({ color })} />)}
      </div>
      <label className="ribbon-menu-item custom-color"><span>Màu khác…</span><input type="color" value={pen.color.length === 7 ? pen.color : '#000000'} onChange={(e) => onChange({ color: e.target.value })} /></label>
      {onRemove && <><MenuSeparator /><MenuItem icon={<Trash2 size={14} />} label="Xoá bút này" danger onClick={() => { close(); onRemove(); }} /></>}
    </div>
  );
}

export default function DrawTab() {
  const ctx = useDoc();
  const { view, setView, page, setPage, editor } = ctx;
  const pens = usePens();
  const { selected, canUndo, canRedo } = useInkStore(editor);
  const editorHistory = useEditorState({ editor, selector: ({ editor: e }) => ({ canUndo: e.can().undo(), canRedo: e.can().redo() }) });
  const inking = Boolean(view.inkTool);
  const strokes = page.ink?.length ?? 0;

  const enter = (tool: InkTool | null, patch: Partial<typeof view> = {}) => setView({ inkTool: tool, ...(tool ? { hideInk: false, inkReplay: null } : {}), ...(tool && view.viewMode !== 'print' ? { viewMode: 'print' as const } : {}), ...patch });
  const selectPen = (pen: PenPreset) => enter(pen.kind === 'highlighter' ? 'highlighter' : 'pen', { penId: pen.id, inkColor: pen.color, inkWidth: pen.width });
  const activePen = pens.find((pen) => pen.id === view.penId);
  const changePen = (pen: PenPreset, patch: Partial<PenPreset>) => {
    updatePen(pen.id, patch);
    if (view.penId === pen.id) setView({ inkColor: patch.color ?? pen.color, inkWidth: patch.width ?? pen.width });
  };
  const toggleDraw = () => {
    if (inking) enter(null);
    else selectPen(activePen ?? pens[0]);
  };
  const createPen = (kind: InkKind) => selectPen(addPen(kind, activePen?.color ?? '#1d4ed8', activePen?.width ?? 3));
  const toggleRuler = () => {
    if (view.inkRuler) return setView({ inkRuler: null });
    const paper = document.querySelector('.doc-paper');
    const canvas = document.querySelector('.doc-canvas');
    const scale = view.zoom / 100;
    const paperRect = paper?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const x = paperRect ? paperRect.width / scale / 2 : 400;
    const y = paperRect && canvasRect ? (canvasRect.top + canvasRect.height / 2 - paperRect.top) / scale : 300;
    setView({ inkRuler: { x: Math.round(x), y: Math.round(y), angle: 0 }, hideInk: false, ...(view.viewMode !== 'print' ? { viewMode: 'print' as const } : {}) });
  };
  const undo = () => (inking ? undoInk(ctx) : editor.chain().focus().undo().run());
  const redo = () => (inking ? redoInk(ctx) : editor.chain().focus().redo().run());
  const clearAll = () => {
    commitInk(ctx, []);
    setInkSelection(editor, []);
  };
  const background = page.background ?? 'none';
  return (
    <>
      <Group label="Chế độ nhập">
        <Big icon={<PenLine size={22} color="#d7473c" />} label="Vẽ" title="Bật hoặc tắt chế độ vẽ, tắt để quay lại soạn thảo (Esc)" active={inking} onClick={toggleDraw} />
        <Small icon={<Smartphone size={14} />} label="Chỉ bút cảm ứng" title="Bật: chỉ bút cảm ứng mới vẽ, chuột và tay vẫn chọn chữ và cuộn trang. Tắt: chuột và tay cũng vẽ được" active={view.inkInput === 'pen'} onClick={() => setView({ inkInput: view.inkInput === 'pen' ? 'any' : 'pen' })} />
      </Group>

      <Group label="Hoàn tác">
        <Rows>
          <Small icon={<Undo2 size={14} />} title={inking ? 'Hoàn tác nét vẽ (Ctrl+Z)' : 'Hoàn tác (Ctrl+Z)'} disabled={inking ? !canUndo : !editorHistory.canUndo} onClick={undo} />
          <Small icon={<Redo2 size={14} />} title={inking ? 'Làm lại nét vẽ (Ctrl+Y)' : 'Làm lại (Ctrl+Y)'} disabled={inking ? !canRedo : !editorHistory.canRedo} onClick={redo} />
        </Rows>
      </Group>

      <Group label="Công cụ vẽ">
        <Big icon={<MousePointer2 size={22} color="#2b579a" />} title="Chọn nét vẽ: bấm vào nét, kéo khung, Shift để chọn thêm" active={view.inkTool === 'select'} onClick={() => enter(view.inkTool === 'select' ? null : 'select')} />
        <Big icon={<Lasso size={22} color="#2b579a" />} title="Chọn tự do: khoanh vùng quanh các nét vẽ" active={view.inkTool === 'lasso'} onClick={() => enter(view.inkTool === 'lasso' ? null : 'lasso')} />
        <ToolButton active={view.inkTool === 'eraser'} title="Tẩy: bấm lần nữa để chọn kiểu tẩy" icon={<Eraser size={24} color="#586071" />} onActivate={() => enter('eraser')}>
          {(close) => (
            <>
              <MenuItem label="Tẩy cả nét" active={view.inkEraser === 'stroke'} onClick={() => { close(); setView({ inkEraser: 'stroke' }); }} />
              <MenuItem label="Tẩy từng điểm" active={view.inkEraser === 'point'} onClick={() => { close(); setView({ inkEraser: 'point' }); }} />
            </>
          )}
        </ToolButton>
        <div className="ink-pen-gallery" role="group" aria-label="Bộ bút">
          {pens.map((pen) => (
            <ToolButton key={pen.id} width={212} active={view.penId === pen.id && DRAW_TOOLS.includes(view.inkTool as InkTool)} title={`${pen.label}: bấm lần nữa để đổi màu và độ dày`} icon={<PenIcon kind={pen.kind} color={pen.color} width={pen.width} />} onActivate={() => selectPen(pen)}>
              {(close) => <PenMenu pen={pen} close={close} onChange={(patch) => changePen(pen, patch)} onRemove={pens.length > 1 ? () => { removePen(pen.id); if (view.penId === pen.id) enter(null, { penId: null }); } : null} />}
            </ToolButton>
          ))}
        </div>
        <Dropdown large title="Thêm bút" trigger={<><Plus size={22} color="#586071" /><span>Thêm</span></>}>
          {(close) => (
            <>
              {PEN_KINDS.map((kind) => <MenuItem key={kind} icon={<PenLine size={14} />} label={KIND_LABELS[kind]} onClick={() => { close(); createPen(kind); }} />)}
              <MenuSeparator />
              <MenuItem icon={<RotateCcw size={14} />} label="Khôi phục bộ bút mặc định" onClick={() => { close(); resetPens(); enter(null, { penId: null }); }} />
            </>
          )}
        </Dropdown>
      </Group>

      {selected.size > 0 && (
        <Group label={`Đã chọn ${selected.size} nét`}>
          <Rows>
            <ColorPicker title="Đổi màu các nét đã chọn" icon={<Paintbrush size={14} />} swatch="#1d4ed8" noneLabel="Giữ nguyên màu" onPick={(color) => { if (color) updateSelectedInk(ctx, (stroke) => ({ ...stroke, color })); }} />
            <Dropdown title="Đổi độ dày các nét đã chọn" trigger={<><PenLine size={14} /><span>Độ dày</span></>}>
              {(close) => WIDTHS.map((width) => <MenuItem key={width} label={`${width} px`} onClick={() => { close(); updateSelectedInk(ctx, (stroke) => ({ ...stroke, width: stroke.kind === 'highlighter' ? width * 4 : width })); }} />)}
            </Dropdown>
          </Rows>
          <Big icon={<Trash2 size={22} color="#d7473c" />} label="Xoá" title="Xoá các nét đã chọn (Delete)" onClick={() => deleteSelectedInk(ctx)} />
        </Group>
      )}

      <Group label="Thước vẽ">
        <Big icon={<Ruler size={22} color="#2b579a" />} label="Thước" title="Hiện thước: kéo để dời, lăn chuột hoặc kéo nút tròn để xoay, vẽ sát mép thước sẽ ra đường thẳng" active={Boolean(view.inkRuler)} onClick={toggleRuler} />
      </Group>

      <Group label="Chỉnh sửa">
        <Dropdown large title="Định dạng nền trang" active={background !== 'none' || Boolean(page.pageColor)} trigger={<><Grid2x2 size={22} color="#0891b2" /><span>Nền trang</span></>} width={250}>
          {(close) => (
            <>
              <MenuHeading>Màu trang</MenuHeading>
              <div className="color-menu">
                <button type="button" className="ribbon-menu-item" onClick={() => { close(); setPage({ pageColor: '' }); }}>Không màu</button>
                <div className="color-grid">
                  {['#ffffff', '#fdf6e3', '#f3f4f6', '#eef6ff', '#f0fdf4', '#fff7ed', '#fdf2f8', ...THEME_COLORS.slice(20, 30)].map((color) => <button key={color} type="button" className="color-swatch" style={{ background: color }} aria-label={color} title={color} onClick={() => { close(); setPage({ pageColor: color }); }} />)}
                </div>
                <label className="ribbon-menu-item custom-color"><span>Màu khác…</span><input type="color" value={page.pageColor || '#ffffff'} onChange={(e) => setPage({ pageColor: e.target.value })} /></label>
              </div>
              <MenuSeparator />
              <MenuHeading>Kẻ nền</MenuHeading>
              {BACKGROUNDS.map((item) => <MenuItem key={item.id} label={item.label} active={background === item.id} onClick={() => { close(); setPage({ background: item.id }); }} />)}
            </>
          )}
        </Dropdown>
      </Group>

      <Group label="Chuyển đổi">
        <Big icon={<Shapes size={22} color="#0891b2" />} label="Thành hình" title="Bật: nét vừa vẽ tự thành đường thẳng, chữ nhật, elip, tam giác hoặc mũi tên" active={view.inkToShape} onClick={() => setView({ inkToShape: !view.inkToShape })} />
        <Big icon={<Sigma size={22} color="#7c3aed" />} label="Thành công thức" title="Viết tay công thức rồi chèn vào tài liệu" onClick={() => ctx.openDialog('inkmath')} />
      </Group>

      <Group label="Chèn">
        <Big icon={<Pencil size={22} color="#4338ca" />} label="Khung vẽ" title="Mở khung vẽ đường, mũi tên, hình và chữ rồi chèn thành ảnh" onClick={() => ctx.openDialog('drawing')} />
        <Big icon={<Signature size={22} color="#2b579a" />} label="Ký tên" title="Vẽ chữ ký và chèn vào tài liệu" onClick={() => ctx.openDialog('signature')} />
      </Group>

      <Group label="Nét đã vẽ">
        <Rows>
          <Small icon={<ImageDown size={14} />} label="Chuyển thành ảnh" title="Gộp mọi nét vẽ thành một ảnh đặt sau đoạn đang chọn, ảnh này đi theo khi xuất tệp" disabled={!strokes} onClick={() => void bakeInkToImage(ctx)} />
          <Small icon={<Trash2 size={14} />} label="Xoá hết nét" title="Xoá mọi nét vẽ trên các trang" disabled={!strokes} onClick={clearAll} />
          <Small icon={view.hideInk ? <Eye size={14} /> : <EyeOff size={14} />} label={view.hideInk ? 'Hiện nét vẽ' : 'Ẩn nét vẽ'} title="Ẩn hoặc hiện nét vẽ, nét bị ẩn cũng không được in" active={view.hideInk} disabled={!strokes} onClick={() => setView({ hideInk: !view.hideInk, ...(view.hideInk ? {} : { inkTool: null }) })} />
        </Rows>
      </Group>

      <Group label="Phát lại">
        <Big icon={<Play size={22} color="#107c41" />} label="Phát lại nét" title="Phát lại quá trình vẽ theo đúng thứ tự" disabled={!strokes} active={view.inkReplay !== null} onClick={() => setView({ inkReplay: view.inkReplay === null ? 0 : null, inkTool: null, hideInk: false, ...(view.viewMode !== 'print' ? { viewMode: 'print' as const } : {}) })} />
      </Group>

      <Group label="Trợ giúp">
        <Big icon={<CircleHelp size={22} color="#2b579a" />} label="Hướng dẫn" title="Cách dùng các công cụ vẽ" onClick={() => ctx.openDialog('inkhelp')} />
      </Group>
    </>
  );
}
