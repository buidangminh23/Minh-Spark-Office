import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookMarked, Circle, Crop, FlipHorizontal, FlipVertical, Link2, Pencil, QrCode, RotateCcw, RotateCw, Sigma, Slash, Square, Trash2, Type, Undo2, Shapes } from 'lucide-react';
import katex from 'katex';
import QRCodeLib from 'qrcode';
import type { CitationSource, CitationStyle } from '../../../lib/storage';
import { newId, useDoc } from '../DocContext';
import { setRefs } from '../extensionsExtra';
import Modal from './Modal';

type SnippetCategory = {
  id: string;
  name: string;
  snippets: { label: string; latex: string }[];
};

const EQUATION_CATEGORIES: SnippetCategory[] = [
  {
    id: 'structure',
    name: 'Cấu trúc',
    snippets: [
      { label: 'Phân số', latex: '\\frac{a}{b}' },
      { label: 'Phân số nhỏ', latex: '\\tfrac{a}{b}' },
      { label: 'Đạo hàm', latex: '\\frac{df}{dx}' },
      { label: 'Đạo hàm riêng', latex: '\\frac{\\partial f}{\\partial x}' },
      { label: 'Căn bậc 2', latex: '\\sqrt{x}' },
      { label: 'Căn bậc n', latex: '\\sqrt[n]{x}' },
      { label: 'Mũ', latex: 'x^{2}' },
      { label: 'Chỉ số', latex: 'x_{i}' },
      { label: 'Mũ & Chỉ số', latex: 'x_{i}^{2}' },
      { label: 'Tích phân', latex: '\\int f(x)\\,dx' },
      { label: 'Tích phân xác định', latex: '\\int_{a}^{b} f(x)\\,dx' },
      { label: 'Tích phân 2 lớp', latex: '\\iint_{D} f(x,y)\\,dx\\,dy' },
      { label: 'Tích phân mặt kín', latex: '\\oint_{C} \\vec{F}\\cdot d\\vec{r}' },
      { label: 'Tổng ∑', latex: '\\sum_{i=1}^{n} x_i' },
      { label: 'Tích ∏', latex: '\\prod_{i=1}^{n} x_i' },
      { label: 'Giới hạn', latex: '\\lim_{x \\to \\infty} f(x)' },
      { label: 'Ngoặc tròn ( )', latex: '\\left( \\frac{a}{b} \\right)' },
      { label: 'Ngoặc vuông [ ]', latex: '\\left[ \\frac{a}{b} \\right]' },
      { label: 'Ngoặc nhọn { }', latex: '\\left\\{ \\frac{a}{b} \\right\\}' },
      { label: 'Trị tuyệt đối | |', latex: '\\left| x \\right|' },
      { label: 'Chuẩn ‖ ‖', latex: '\\left\\| \\vec{v} \\right\\|' },
      { label: 'Ma trận tròn ( )', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: 'Ma trận vuông [ ]', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
      { label: 'Định thức | |', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}' },
      { label: 'Hệ 2 PT', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}' },
      { label: 'Hệ 3 PT', latex: '\\begin{cases} x + y + z = 1 \\\\ 2x - y + z = 3 \\\\ x + 2y - z = 0 \\end{cases}' },
      { label: 'Vector →', latex: '\\vec{a}' },
      { label: 'Vector AB', latex: '\\overrightarrow{AB}' },
      { label: 'Gạch đầu x̄', latex: '\\bar{x}' },
      { label: 'Mũ ước lượng ŷ', latex: '\\hat{y}' },
      { label: 'Tổ hợp C', latex: '\\binom{n}{k}' },
      { label: 'Ngoặc trên', latex: '\\overbrace{a + b}^{n}' },
      { label: 'Ngoặc dưới', latex: '\\underbrace{a + b}_{n}' },
    ],
  },
  {
    id: 'symbols',
    name: 'Ký hiệu & Phép toán',
    snippets: [
      { label: '±', latex: '\\pm' },
      { label: '∓', latex: '\\mp' },
      { label: '×', latex: '\\times' },
      { label: '÷', latex: '\\div' },
      { label: '·', latex: '\\cdot' },
      { label: '≤', latex: '\\leq' },
      { label: '≥', latex: '\\geq' },
      { label: '≠', latex: '\\neq' },
      { label: '≈', latex: '\\approx' },
      { label: '≡', latex: '\\equiv' },
      { label: '∝', latex: '\\propto' },
      { label: '∞', latex: '\\infty' },
      { label: '∂', latex: '\\partial' },
      { label: '∇', latex: '\\nabla' },
      { label: '∈', latex: '\\in' },
      { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' },
      { label: '⊆', latex: '\\subseteq' },
      { label: '⊃', latex: '\\supset' },
      { label: '∪', latex: '\\cup' },
      { label: '∩', latex: '\\cap' },
      { label: '∅', latex: '\\emptyset' },
      { label: '∀', latex: '\\forall' },
      { label: '∃', latex: '\\exists' },
      { label: '¬', latex: '\\neg' },
      { label: '→', latex: '\\to' },
      { label: '←', latex: '\\leftarrow' },
      { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '⊥', latex: '\\perp' },
      { label: '∥', latex: '\\parallel' },
      { label: '∠', latex: '\\angle' },
      { label: '°', latex: '^{\\circ}' },
      { label: 'ℝ', latex: '\\mathbb{R}' },
      { label: 'ℕ', latex: '\\mathbb{N}' },
      { label: 'ℤ', latex: '\\mathbb{Z}' },
      { label: 'ℚ', latex: '\\mathbb{Q}' },
      { label: 'ℂ', latex: '\\mathbb{C}' },
      { label: '⋯', latex: '\\cdots' },
      { label: '⋮', latex: '\\vdots' },
      { label: '⋱', latex: '\\ddots' },
    ],
  },
  {
    id: 'greek',
    name: 'Chữ Hy Lạp',
    snippets: [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' },
      { label: 'Δ', latex: '\\Delta' },
      { label: 'ε', latex: '\\epsilon' },
      { label: 'ζ', latex: '\\zeta' },
      { label: 'η', latex: '\\eta' },
      { label: 'θ', latex: '\\theta' },
      { label: 'Θ', latex: '\\Theta' },
      { label: 'ι', latex: '\\iota' },
      { label: 'κ', latex: '\\kappa' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'Λ', latex: '\\Lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'ν', latex: '\\nu' },
      { label: 'ξ', latex: '\\xi' },
      { label: 'π', latex: '\\pi' },
      { label: 'Π', latex: '\\Pi' },
      { label: 'ρ', latex: '\\rho' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'Σ', latex: '\\Sigma' },
      { label: 'τ', latex: '\\tau' },
      { label: 'υ', latex: '\\upsilon' },
      { label: 'φ', latex: '\\phi' },
      { label: 'Φ', latex: '\\Phi' },
      { label: 'χ', latex: '\\chi' },
      { label: 'ψ', latex: '\\psi' },
      { label: 'Ψ', latex: '\\Psi' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    id: 'common',
    name: 'Mẫu nhanh',
    snippets: [
      { label: 'Nghiệm bậc 2', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      { label: 'Pythagoras', latex: 'a^2 + b^2 = c^2' },
      { label: 'Diện tích tròn', latex: 'A = \\pi r^2' },
      { label: 'Nhị thức', latex: '(x + a)^n = \\sum_{k=0}^n \\binom{n}{k} x^k a^{n-k}' },
      { label: 'Euler', latex: 'e^{i\\pi} + 1 = 0' },
      { label: 'Tích phân từng phần', latex: '\\int u\\,dv = uv - \\int v\\,du' },
      { label: 'AM-GM', latex: '\\frac{a + b}{2} \\ge \\sqrt{ab}' },
      { label: 'Phân phối chuẩn', latex: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}' },
    ],
  },
];

export function EquationDialog({ onClose }: { onClose: () => void }) {
  const { editor, editing, setEditing } = useDoc();
  const [latex, setLatex] = useState(String(editing?.attrs.latex ?? 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'));
  const [display, setDisplay] = useState(Boolean(editing?.attrs.display ?? true));
  const [tab, setTab] = useState('structure');
  const preview = useRef<HTMLDivElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (preview.current) katex.render(latex || '\\square', preview.current, { throwOnError: false, displayMode: display });
  }, [latex, display]);
  const insertSnippet = (snippet: string) => {
    const el = area.current;
    if (!el) return setLatex((v) => v + snippet);
    const next = latex.slice(0, el.selectionStart) + snippet + latex.slice(el.selectionEnd);
    setLatex(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = el.selectionStart + snippet.length; });
  };
  const close = () => { setEditing(null); onClose(); };
  const apply = () => {
    if (editing) {
      const node = editor.state.doc.nodeAt(editing.pos);
      if (node?.type.name === 'equation') editor.view.dispatch(editor.state.tr.setNodeMarkup(editing.pos, undefined, { latex, display }));
    } else {
      editor.chain().focus().insertEquation(latex, display).run();
    }
    close();
  };
  const activeCategory = EQUATION_CATEGORIES.find((c) => c.id === tab) ?? EQUATION_CATEGORIES[0];
  return (
    <Modal title={editing ? 'Sửa công thức' : 'Chèn công thức'} subtitle="Viết bằng LaTeX, chọn mẫu hoặc gõ tự động trực tiếp trên trang." icon={<Sigma size={20} />} onClose={close} width={740} actions={<><button className="btn" onClick={close}>Huỷ</button><button className="btn btn-primary" disabled={!latex.trim()} onClick={apply}>{editing ? 'Lưu' : 'Chèn'}</button></>}>
      <div className="comments-tabs" style={{ marginBottom: 8 }}>
        {EQUATION_CATEGORIES.map((cat) => (
          <button key={cat.id} type="button" className={`comments-tab ${tab === cat.id ? 'active' : ''}`} onClick={() => setTab(cat.id)}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="snippet-row" style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 10 }}>
        {activeCategory.snippets.map((s) => (
          <button key={s.label} type="button" className="btn snippet" title={s.latex} onClick={() => insertSnippet(s.latex)}>
            {s.label}
          </button>
        ))}
      </div>
      <textarea ref={area} className="text-field mono" rows={3} aria-label="Công thức LaTeX" value={latex} onChange={(e) => setLatex(e.target.value)} />
      <div className="equation-preview" ref={preview} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
        <label><input type="checkbox" checked={display} onChange={(e) => setDisplay(e.target.checked)} /> Hiển thị riêng một dòng, căn giữa</label>
        <span>💡 Gõ <code>$công_thức$</code> hoặc <code>Alt+=</code> trên trang để chèn tự động</span>
      </div>
    </Modal>
  );
}

export function QrDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const [text, setText] = useState('https://minhspark.com');
  const [size, setSize] = useState(200);
  const [dark, setDark] = useState('#000000');
  const [image, setImage] = useState('');
  useEffect(() => {
    let alive = true;
    if (!text.trim()) { setImage(''); return; }
    void QRCodeLib.toDataURL(text, { width: size * 2, margin: 1, color: { dark, light: '#ffffff' } }).then((url) => { if (alive) setImage(url); });
    return () => { alive = false; };
  }, [text, size, dark]);
  return (
    <Modal title="Chèn mã QR" icon={<QrCode size={20} />} onClose={onClose} width={520} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!image} onClick={() => { editor.chain().focus().setImage({ src: image, alt: `Mã QR: ${text}`, width: size } as never).run(); onClose(); }}>Chèn</button></>}>
      <label className="field"><span className="field-label">Nội dung hoặc đường dẫn</span><textarea className="text-field" rows={2} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">Kích thước (px)</span><input className="text-field" type="number" min={80} max={500} step={20} value={size} onChange={(e) => setSize(Number(e.target.value) || 200)} /></label>
        <label className="field"><span className="field-label">Màu</span><input className="text-field color-field" type="color" value={dark} onChange={(e) => setDark(e.target.value)} /></label>
      </div>
      <div className="qr-preview">{image ? <img src={image} alt="Xem trước mã QR" /> : 'Nhập nội dung để tạo mã'}</div>
    </Modal>
  );
}

export const SHAPES: { id: string; label: string; svg: (fill: string, stroke: string) => string }[] = [
  { id: 'rect', label: 'Chữ nhật', svg: (f, s) => `<rect x="4" y="14" width="112" height="72" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'round', label: 'Bo góc', svg: (f, s) => `<rect x="4" y="14" width="112" height="72" rx="16" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'ellipse', label: 'Elip', svg: (f, s) => `<ellipse cx="60" cy="50" rx="56" ry="38" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'circle', label: 'Tròn', svg: (f, s) => `<circle cx="60" cy="50" r="44" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'triangle', label: 'Tam giác', svg: (f, s) => `<polygon points="60,8 114,92 6,92" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'diamond', label: 'Thoi', svg: (f, s) => `<polygon points="60,6 114,50 60,94 6,50" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'pentagon', label: 'Ngũ giác', svg: (f, s) => `<polygon points="60,6 114,44 94,94 26,94 6,44" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'hexagon', label: 'Lục giác', svg: (f, s) => `<polygon points="30,8 90,8 116,50 90,92 30,92 4,50" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'star', label: 'Sao', svg: (f, s) => `<polygon points="60,6 73,38 108,40 81,62 90,96 60,77 30,96 39,62 12,40 47,38" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'arrow-r', label: 'Mũi tên phải', svg: (f, s) => `<polygon points="4,34 72,34 72,14 116,50 72,86 72,66 4,66" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'arrow-l', label: 'Mũi tên trái', svg: (f, s) => `<polygon points="116,34 48,34 48,14 4,50 48,86 48,66 116,66" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'arrow-u', label: 'Mũi tên lên', svg: (f, s) => `<polygon points="44,96 44,44 24,44 60,4 96,44 76,44 76,96" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'callout', label: 'Bong bóng', svg: (f, s) => `<path d="M14 10 H106 A10 10 0 0 1 116 20 V62 A10 10 0 0 1 106 72 H50 L30 94 L34 72 H14 A10 10 0 0 1 4 62 V20 A10 10 0 0 1 14 10 Z" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'heart', label: 'Tim', svg: (f, s) => `<path d="M60 92 C10 56 6 30 22 16 C36 6 52 12 60 28 C68 12 84 6 98 16 C114 30 110 56 60 92 Z" fill="${f}" stroke="${s}" stroke-width="3"/>` },
  { id: 'line', label: 'Đường thẳng', svg: (_f, s) => `<line x1="6" y1="50" x2="114" y2="50" stroke="${s}" stroke-width="4"/>` },
  { id: 'cloud', label: 'Mây', svg: (f, s) => `<path d="M34 84 A22 22 0 0 1 28 42 A28 28 0 0 1 80 34 A20 20 0 0 1 104 56 A16 16 0 0 1 96 84 Z" fill="${f}" stroke="${s}" stroke-width="3"/>` },
];

export const shapeDataUrl = (id: string, fill: string, stroke: string) => {
  const shape = SHAPES.find((s) => s.id === id) ?? SHAPES[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 120 100">${shape.svg(fill, stroke)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

type DrawTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';
type DrawItem = { tool: DrawTool; color: string; width: number; fill: string | null; points: number[]; text?: string };
const CANVAS_W = 1000;
const CANVAS_H = 560;

function paint(c: CanvasRenderingContext2D, item: DrawItem) {
  c.strokeStyle = item.color;
  c.fillStyle = item.color;
  c.lineWidth = item.width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const [x1, y1] = item.points;
  const x2 = item.points[item.points.length - 2];
  const y2 = item.points[item.points.length - 1];
  c.beginPath();
  if (item.tool === 'pen') {
    c.moveTo(x1, y1);
    for (let i = 2; i < item.points.length; i += 2) c.lineTo(item.points[i], item.points[i + 1]);
    c.stroke();
  } else if (item.tool === 'line' || item.tool === 'arrow') {
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    if (item.tool === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 10 + item.width * 2;
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
      c.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
      c.closePath();
      c.fill();
    }
  } else if (item.tool === 'text') {
    c.font = `${14 + item.width * 3}px Arial, sans-serif`;
    c.fillText(item.text ?? '', x1, y1);
  } else {
    if (item.tool === 'rect') c.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else c.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    if (item.fill) { c.fillStyle = item.fill; c.fill(); }
    c.stroke();
  }
}

export function DrawingDialog({ onClose }: { onClose: () => void }) {
  const ctx = useDoc();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [items, setItems] = useState<DrawItem[]>([]);
  const [draft, setDraft] = useState<DrawItem | null>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#2b579a');
  const [fill, setFill] = useState('');
  const [width, setWidth] = useState(3);
  useEffect(() => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, CANVAS_W, CANVAS_H);
    [...items, ...(draft ? [draft] : [])].forEach((item) => paint(c, item));
  }, [items, draft]);
  const at = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) * CANVAS_W) / rect.width, ((e.clientY - rect.top) * CANVAS_H) / rect.height];
  };
  const down = async (e: React.PointerEvent) => {
    const [x, y] = at(e);
    if (tool === 'text') {
      const res = await ctx.ui.ask({ title: 'Thêm chữ', fields: [{ name: 'text', label: 'Nội dung' }], confirmText: 'Thêm' });
      const text = String(res?.text ?? '').trim();
      if (text) setItems((list) => [...list, { tool, color, width, fill: null, points: [x, y], text }]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ tool, color, width, fill: fill || null, points: [x, y, x, y] });
  };
  const move = (e: React.PointerEvent) => {
    if (!draft) return;
    const [x, y] = at(e);
    setDraft({ ...draft, points: draft.tool === 'pen' ? [...draft.points, x, y] : [draft.points[0], draft.points[1], x, y] });
  };
  const up = () => {
    if (draft) setItems((list) => [...list, draft]);
    setDraft(null);
  };
  const insert = () => {
    const c = canvas.current;
    const c2 = c?.getContext('2d');
    if (!c || !c2) return;
    const { data } = c2.getImageData(0, 0, CANVAS_W, CANVAS_H);
    let minX = CANVAS_W; let minY = CANVAS_H; let maxX = 0; let maxY = 0;
    for (let y = 0; y < CANVAS_H; y++) for (let x = 0; x < CANVAS_W; x++) if (data[(y * CANVAS_W + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (maxX <= minX) return;
    const crop = document.createElement('canvas');
    crop.width = maxX - minX + 12;
    crop.height = maxY - minY + 12;
    crop.getContext('2d')!.drawImage(c, minX - 6, minY - 6, crop.width, crop.height, 0, 0, crop.width, crop.height);
    ctx.editor.chain().focus().setImage({ src: crop.toDataURL('image/png'), alt: 'Hình vẽ' }).run();
    onClose();
  };
  const tools: { id: DrawTool; label: string; icon: React.ReactNode }[] = [
    { id: 'pen', label: 'Bút', icon: <Pencil size={15} /> }, { id: 'line', label: 'Đường', icon: <Slash size={15} /> }, { id: 'arrow', label: 'Mũi tên', icon: <ArrowRight size={15} /> },
    { id: 'rect', label: 'Hình chữ nhật', icon: <Square size={15} /> }, { id: 'ellipse', label: 'Elip', icon: <Circle size={15} /> }, { id: 'text', label: 'Chữ', icon: <Type size={15} /> },
  ];
  return (
    <Modal title="Bản vẽ" icon={<Shapes size={20} />} onClose={onClose} width={820} actions={<><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!items.length} onClick={insert}>Chèn vào tài liệu</button></>}>
      <div className="pen-toolbar">
        {tools.map((t) => <button key={t.id} type="button" className={`icon-btn ${tool === t.id ? 'on' : ''}`} title={t.label} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.icon}</button>)}
        <label>Màu nét <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label>Tô <input type="color" value={fill || '#ffffff'} onChange={(e) => setFill(e.target.value)} /></label>
        <button type="button" className="btn" disabled={!fill} onClick={() => setFill('')}>Không tô</button>
        <label>Nét <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
        <button type="button" className="icon-btn" title="Hoàn tác" aria-label="Hoàn tác" disabled={!items.length} onClick={() => setItems((list) => list.slice(0, -1))}><Undo2 size={15} /></button>
        <button type="button" className="icon-btn" title="Xoá hết" aria-label="Xoá hết" disabled={!items.length} onClick={() => setItems([])}><Trash2 size={15} /></button>
      </div>
      <canvas ref={canvas} width={CANVAS_W} height={CANVAS_H} className="drawing-pad" onPointerDown={(e) => void down(e)} onPointerMove={move} onPointerUp={up} />
    </Modal>
  );
}

const FILTERS = [
  { key: 'brightness', label: 'Độ sáng', min: 0, max: 200, base: 100, unit: '%' },
  { key: 'contrast', label: 'Tương phản', min: 0, max: 200, base: 100, unit: '%' },
  { key: 'saturate', label: 'Bão hoà', min: 0, max: 200, base: 100, unit: '%' },
  { key: 'grayscale', label: 'Đen trắng', min: 0, max: 100, base: 0, unit: '%' },
  { key: 'sepia', label: 'Nâu cổ', min: 0, max: 100, base: 0, unit: '%' },
  { key: 'blur', label: 'Làm mờ', min: 0, max: 10, base: 0, unit: 'px' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export function ImageEditDialog({ onClose }: { onClose: () => void }) {
  const { editor, ui } = useDoc();
  const src = useMemo(() => String(editor.getAttributes('image').src ?? ''), [editor]);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [values, setValues] = useState<Record<FilterKey, number>>(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.base])) as Record<FilterKey, number>);
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setSource(image);
    image.onerror = () => setFailed(true);
    image.src = src;
  }, [src]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !source) return;
    const sw = source.naturalWidth * (1 - (crop.left + crop.right) / 100);
    const sh = source.naturalHeight * (1 - (crop.top + crop.bottom) / 100);
    const quarter = rotation % 180 !== 0;
    c.width = Math.max(1, Math.round(quarter ? sh : sw));
    c.height = Math.max(1, Math.round(quarter ? sw : sh));
    const g = c.getContext('2d');
    if (!g) return;
    g.filter = FILTERS.map((f) => `${f.key}(${values[f.key]}${f.unit})`).join(' ');
    g.translate(c.width / 2, c.height / 2);
    g.rotate((rotation * Math.PI) / 180);
    g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    g.drawImage(source, (source.naturalWidth * crop.left) / 100, (source.naturalHeight * crop.top) / 100, sw, sh, -sw / 2, -sh / 2, sw, sh);
  }, [source, rotation, flipX, flipY, values, crop]);
  const apply = () => {
    try {
      const url = canvas.current!.toDataURL(src.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', 0.92);
      editor.chain().focus().setImageLayout({ src: url }).run();
      onClose();
    } catch {
      ui.toast('Ảnh từ trang web khác không cho phép sửa. Hãy tải ảnh lên từ máy.', true);
    }
  };
  const reset = () => {
    setRotation(0); setFlipX(false); setFlipY(false); setCrop({ left: 0, top: 0, right: 0, bottom: 0 });
    setValues(Object.fromEntries(FILTERS.map((f) => [f.key, f.base])) as Record<FilterKey, number>);
  };
  return (
    <Modal title="Sửa ảnh" icon={<Crop size={20} />} onClose={onClose} width={860} actions={<><button className="btn" onClick={reset}>Đặt lại</button><span className="spacer" /><button className="btn" onClick={onClose}>Huỷ</button><button className="btn btn-primary" disabled={!source} onClick={apply}>Áp dụng</button></>}>
      {failed ? <div className="empty-note">Không đọc được ảnh này để sửa. Ảnh từ trang web khác có thể bị chặn, hãy tải ảnh lên từ máy.</div> : (
        <div className="image-editor">
          <div className="image-stage"><canvas ref={canvas} /></div>
          <div className="image-controls">
            <div className="snippet-row">
              <button type="button" className="icon-btn" title="Xoay trái 90°" aria-label="Xoay trái" onClick={() => setRotation((r) => (r + 270) % 360)}><RotateCcw size={16} /></button>
              <button type="button" className="icon-btn" title="Xoay phải 90°" aria-label="Xoay phải" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw size={16} /></button>
              <button type="button" className={`icon-btn ${flipX ? 'on' : ''}`} title="Lật ngang" aria-label="Lật ngang" onClick={() => setFlipX(!flipX)}><FlipHorizontal size={16} /></button>
              <button type="button" className={`icon-btn ${flipY ? 'on' : ''}`} title="Lật dọc" aria-label="Lật dọc" onClick={() => setFlipY(!flipY)}><FlipVertical size={16} /></button>
            </div>
            <div className="form-section-title">Cắt ảnh</div>
            {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
              <label key={side} className="slider-row"><span>{{ left: 'Trái', right: 'Phải', top: 'Trên', bottom: 'Dưới' }[side]}</span><input type="range" min={0} max={45} value={crop[side]} onChange={(e) => setCrop({ ...crop, [side]: Number(e.target.value) })} /><span className="slider-value">{crop[side]}%</span></label>
            ))}
            <div className="form-section-title">Điều chỉnh</div>
            {FILTERS.map((f) => (
              <label key={f.key} className="slider-row"><span>{f.label}</span><input type="range" min={f.min} max={f.max} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })} /><span className="slider-value">{values[f.key]}{f.unit}</span></label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

const STYLES: { value: CitationStyle; label: string }[] = [{ value: 'apa', label: 'APA' }, { value: 'ieee', label: 'IEEE' }, { value: 'chicago', label: 'Chicago' }, { value: 'mla', label: 'MLA' }, { value: 'vancouver', label: 'Vancouver' }];
const TYPES: { value: CitationSource['type']; label: string }[] = [{ value: 'book', label: 'Sách' }, { value: 'article', label: 'Bài báo' }, { value: 'web', label: 'Trang web' }, { value: 'report', label: 'Báo cáo' }, { value: 'other', label: 'Khác' }];
const EMPTY_SOURCE = (): CitationSource => ({ id: newId('src'), type: 'book', authors: '', title: '', year: String(new Date().getFullYear()), publisher: '', url: '', pages: '' });

export function CitationDialog({ onClose }: { onClose: () => void }) {
  const { editor, page, setPage } = useDoc();
  const [sources, setSources] = useState<CitationSource[]>(page.sources ?? []);
  const [style, setStyle] = useState<CitationStyle>(page.citationStyle ?? 'apa');
  const [form, setForm] = useState<CitationSource>(EMPTY_SOURCE);
  const editingExisting = sources.some((s) => s.id === form.id);
  const put = (patch: Partial<CitationSource>) => setForm((f) => ({ ...f, ...patch }));
  const commit = (next: CitationSource[], nextStyle = style) => {
    setSources(next);
    setPage({ sources: next, citationStyle: nextStyle });
    setRefs(editor, next, nextStyle);
  };
  const saveSource = () => {
    if (!form.title.trim() || !form.authors.trim()) return;
    commit(editingExisting ? sources.map((s) => (s.id === form.id ? form : s)) : [...sources, form]);
    setForm(EMPTY_SOURCE());
  };
  return (
    <Modal title="Trích dẫn và nguồn tham khảo" icon={<BookMarked size={20} />} onClose={onClose} width={760} actions={<><button className="btn" onClick={() => { editor.chain().focus().insertDocList('bibliography').run(); onClose(); }}>Chèn danh mục tài liệu</button><span className="spacer" /><button className="btn btn-primary" onClick={onClose}>Xong</button></>}>
      <label className="field inline-field"><span className="field-label">Kiểu trích dẫn</span><select className="text-field" value={style} onChange={(e) => { const next = e.target.value as CitationStyle; setStyle(next); commit(sources, next); }}>{STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <div className="form-section-title">{editingExisting ? 'Sửa nguồn' : 'Thêm nguồn'}</div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Loại</span><select className="text-field" value={form.type} onChange={(e) => put({ type: e.target.value as CitationSource['type'] })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Tác giả</span><input className="text-field" placeholder="Nguyễn Văn A; Trần Văn B" value={form.authors} onChange={(e) => put({ authors: e.target.value })} /></label>
        <label className="field"><span className="field-label">Năm</span><input className="text-field" value={form.year} onChange={(e) => put({ year: e.target.value })} /></label>
        <label className="field span-2"><span className="field-label">Tiêu đề</span><input className="text-field" value={form.title} onChange={(e) => put({ title: e.target.value })} /></label>
        <label className="field"><span className="field-label">Nhà xuất bản, tạp chí</span><input className="text-field" value={form.publisher} onChange={(e) => put({ publisher: e.target.value })} /></label>
        <label className="field"><span className="field-label">Trang</span><input className="text-field" value={form.pages} onChange={(e) => put({ pages: e.target.value })} /></label>
        <label className="field span-2"><span className="field-label">Đường dẫn</span><input className="text-field" placeholder="https://" value={form.url} onChange={(e) => put({ url: e.target.value })} /></label>
      </div>
      <div className="form-actions"><button className="btn" disabled={!form.title.trim() || !form.authors.trim()} onClick={saveSource}>{editingExisting ? 'Lưu nguồn' : 'Thêm nguồn'}</button>{editingExisting && <button className="btn" onClick={() => setForm(EMPTY_SOURCE())}>Thôi sửa</button>}</div>
      <div className="form-section-title">Nguồn trong tài liệu ({sources.length})</div>
      {sources.length === 0 ? <div className="empty-note">Chưa có nguồn nào.</div> : (
        <div className="version-list">
          {sources.map((source) => (
            <div key={source.id} className="version-row">
              <div className="source-text"><strong>{source.title}</strong><div className="muted">{source.authors} · {source.year}</div></div>
              <div className="version-actions">
                <button className="btn btn-primary" onClick={() => { editor.chain().focus().insertCitation(source.id).run(); onClose(); }}>Chèn trích dẫn</button>
                <button className="btn" onClick={() => setForm(source)}>Sửa</button>
                <button className="icon-btn" title="Xoá nguồn" aria-label="Xoá nguồn" onClick={() => commit(sources.filter((s) => s.id !== source.id))}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function CrossRefDialog({ onClose }: { onClose: () => void }) {
  const { editor } = useDoc();
  const [show, setShow] = useState('text');
  const targets = useMemo(() => {
    const list: { key: string; label: string; kind: string; pos: number; bookmark: string | null }[] = [];
    editor.state.doc.descendants((node, pos, parent) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        let bookmark: string | null = null;
        node.forEach((child) => { if (child.type.name === 'bookmark') bookmark = String(child.attrs.name); });
        list.push({ key: `h${pos}`, label: node.textContent, kind: 'Tiêu đề', pos, bookmark });
      } else if (node.attrs?.captionKind) {
        let bookmark: string | null = null;
        node.forEach((child) => { if (child.type.name === 'bookmark') bookmark = String(child.attrs.name); });
        list.push({ key: `c${pos}`, label: node.textContent, kind: String(node.attrs.captionKind), pos, bookmark });
      } else if (node.type.name === 'bookmark' && parent?.type.name !== 'heading' && !parent?.attrs?.captionKind) {
        list.push({ key: `b${pos}`, label: String(node.attrs.name), kind: 'Dấu trang', pos, bookmark: String(node.attrs.name) });
      }
      return true;
    });
    return list;
  }, [editor]);
  const insert = (target: (typeof targets)[number]) => {
    let name = target.bookmark;
    if (!name) {
      name = newId('ref');
      editor.chain().insertContentAt(target.pos + 1, { type: 'bookmark', attrs: { name } }).run();
    }
    editor.chain().focus().insertCrossRef(name, show).run();
    onClose();
  };
  return (
    <Modal title="Tham chiếu chéo" subtitle="Chèn chữ tự cập nhật theo tiêu đề, nhãn hoặc số trang đích." icon={<Link2 size={20} />} onClose={onClose} width={560} actions={<button className="btn" onClick={onClose}>Đóng</button>}>
      <label className="field inline-field"><span className="field-label">Hiển thị</span><select className="text-field" value={show} onChange={(e) => setShow(e.target.value)}><option value="text">Nội dung đích</option><option value="page">Số trang đích</option></select></label>
      {targets.length === 0 ? <div className="empty-note">Chưa có tiêu đề, nhãn hay dấu trang nào để tham chiếu.</div> : (
        <div className="version-list">
          {targets.map((target) => (
            <button key={target.key} type="button" className="version-row xref-row" onClick={() => insert(target)}>
              <span className="source-text">{target.label}</span><span className="muted">{target.kind}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}


