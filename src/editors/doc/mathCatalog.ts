export interface MathItem {
  label: string;
  latex: string;
}

export interface MathGroup {
  id: string;
  name: string;
  items: MathItem[];
}

const PLACEHOLDER = /#[?@0-9]/g;

const TEXT_PLACEHOLDER = /\\text\{#[?@0-9]\}/g;

export const latexForPreview = (latex: string): string => latex.replace(TEXT_PLACEHOLDER, '\\text{abc}').replace(PLACEHOLDER, '\\square');

export const latexForSource = (latex: string): string => latex.replace(PLACEHOLDER, '');

const FIELD_PLACEHOLDER = /\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g;

export const fieldToLatex = (latex: string): string => latex.replace(FIELD_PLACEHOLDER, (_, inner: string) => (inner ? inner : '{}'));

export const STRUCTURE_GROUPS: MathGroup[] = [
  {
    id: 'fraction',
    name: 'Phân số',
    items: [
      { label: 'Phân số đứng', latex: '\\frac{#@}{#?}' },
      { label: 'Phân số lớn', latex: '\\dfrac{#@}{#?}' },
      { label: 'Phân số nhỏ', latex: '\\tfrac{#@}{#?}' },
      { label: 'Phân số nghiêng', latex: '{}^{#@}\\!/_{#?}' },
      { label: 'Phân số ngang', latex: '#@/#?' },
      { label: 'Liên phân số', latex: '#?+\\cfrac{1}{#?+\\cfrac{1}{#?}}' },
      { label: 'dy/dx', latex: '\\frac{d#?}{d#?}' },
      { label: '∂y/∂x', latex: '\\frac{\\partial #?}{\\partial #?}' },
      { label: 'Đạo hàm cấp n', latex: '\\frac{d^{#?}#?}{d#?^{#?}}' },
    ],
  },
  {
    id: 'script',
    name: 'Mũ & chỉ số',
    items: [
      { label: 'Mũ', latex: '#@^{#?}' },
      { label: 'Chỉ số dưới', latex: '#@_{#?}' },
      { label: 'Chỉ số dưới và mũ', latex: '#@_{#?}^{#?}' },
      { label: 'Chỉ số bên trái', latex: '{}_{#?}^{#?}#@' },
      { label: 'Phần tử aᵢⱼ', latex: 'a_{ij}' },
      { label: 'eˣ', latex: 'e^{#?}' },
      { label: 'x²', latex: '#@^{2}' },
      { label: 'Độ', latex: '#@^{\\circ}' },
      { label: 'Phẩy', latex: '#@^{\\prime}' },
    ],
  },
  {
    id: 'radical',
    name: 'Căn',
    items: [
      { label: 'Căn bậc hai', latex: '\\sqrt{#@}' },
      { label: 'Căn bậc ba', latex: '\\sqrt[3]{#@}' },
      { label: 'Căn bậc n', latex: '\\sqrt[#?]{#@}' },
      { label: 'Nghiệm bậc hai', latex: '\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}' },
      { label: 'Khoảng cách', latex: '\\sqrt{(x_2-x_1)^{2}+(y_2-y_1)^{2}}' },
    ],
  },
  {
    id: 'integral',
    name: 'Tích phân',
    items: [
      { label: 'Tích phân', latex: '\\int #@\\,d#?' },
      { label: 'Tích phân xác định', latex: '\\int_{#?}^{#?} #@\\,d#?' },
      { label: 'Tích phân kép', latex: '\\iint_{#?} #@\\,d#?\\,d#?' },
      { label: 'Tích phân bội ba', latex: '\\iiint_{#?} #@\\,dV' },
      { label: 'Tích phân đường kín', latex: '\\oint_{#?} #@' },
      { label: 'Tích phân mặt kín', latex: '\\oiint_{#?} #@' },
      { label: 'Vi phân dx', latex: '\\,d#?' },
    ],
  },
  {
    id: 'operator',
    name: 'Toán tử lớn',
    items: [
      { label: 'Tổng', latex: '\\sum_{#?}^{#?} #@' },
      { label: 'Tổng không cận', latex: '\\sum #@' },
      { label: 'Tích', latex: '\\prod_{#?}^{#?} #@' },
      { label: 'Đối tích', latex: '\\coprod_{#?}^{#?} #@' },
      { label: 'Hợp', latex: '\\bigcup_{#?}^{#?} #@' },
      { label: 'Giao', latex: '\\bigcap_{#?}^{#?} #@' },
      { label: 'Hội lớn', latex: '\\bigwedge_{#?} #@' },
      { label: 'Tuyển lớn', latex: '\\bigvee_{#?} #@' },
      { label: 'Tổng trực tiếp', latex: '\\bigoplus_{#?} #@' },
    ],
  },
  {
    id: 'bracket',
    name: 'Ngoặc',
    items: [
      { label: '( )', latex: '\\left(#@\\right)' },
      { label: '[ ]', latex: '\\left[#@\\right]' },
      { label: '{ }', latex: '\\left\\{#@\\right\\}' },
      { label: '| |', latex: '\\left|#@\\right|' },
      { label: '‖ ‖', latex: '\\left\\|#@\\right\\|' },
      { label: '⟨ ⟩', latex: '\\left\\langle #@\\right\\rangle' },
      { label: '⌊ ⌋', latex: '\\left\\lfloor #@\\right\\rfloor' },
      { label: '⌈ ⌉', latex: '\\left\\lceil #@\\right\\rceil' },
      { label: 'Khoảng [a; b)', latex: '\\left[#?;\\,#?\\right)' },
      { label: 'Hệ phương trình', latex: '\\begin{cases}#@\\\\#?\\end{cases}' },
      { label: 'Hệ 3 phương trình', latex: '\\begin{cases}#@\\\\#?\\\\#?\\end{cases}' },
      { label: 'Hàm từng khúc', latex: 'f(x)=\\begin{cases}#? & \\text{khi } #?\\\\#? & \\text{khi } #?\\end{cases}' },
      { label: 'Tuyển [ (hoặc)', latex: '\\left[\\begin{array}{l}#@\\\\#?\\end{array}\\right.' },
      { label: 'Tổ hợp (n k)', latex: '\\binom{#?}{#?}' },
    ],
  },
  {
    id: 'function',
    name: 'Hàm',
    items: [
      { label: 'sin', latex: '\\sin #@' },
      { label: 'cos', latex: '\\cos #@' },
      { label: 'tan', latex: '\\tan #@' },
      { label: 'cot', latex: '\\cot #@' },
      { label: 'arcsin', latex: '\\arcsin #@' },
      { label: 'arccos', latex: '\\arccos #@' },
      { label: 'arctan', latex: '\\arctan #@' },
      { label: 'sinh', latex: '\\sinh #@' },
      { label: 'cosh', latex: '\\cosh #@' },
      { label: 'sin²x', latex: '\\sin^{2}#@' },
      { label: 'ln', latex: '\\ln #@' },
      { label: 'log', latex: '\\log #@' },
      { label: 'exp', latex: '\\exp #@' },
    ],
  },
  {
    id: 'accent',
    name: 'Dấu nhấn',
    items: [
      { label: 'Vectơ', latex: '\\vec{#@}' },
      { label: 'Vectơ AB', latex: '\\overrightarrow{#@}' },
      { label: 'Gạch trên', latex: '\\overline{#@}' },
      { label: 'Gạch dưới', latex: '\\underline{#@}' },
      { label: 'Trung bình x̄', latex: '\\bar{#@}' },
      { label: 'Mũ ^', latex: '\\hat{#@}' },
      { label: 'Mũ rộng', latex: '\\widehat{#@}' },
      { label: 'Ngã ~', latex: '\\tilde{#@}' },
      { label: 'Chấm (đạo hàm)', latex: '\\dot{#@}' },
      { label: 'Hai chấm', latex: '\\ddot{#@}' },
      { label: 'Ngoặc trên', latex: '\\overbrace{#@}^{#?}' },
      { label: 'Ngoặc dưới', latex: '\\underbrace{#@}_{#?}' },
      { label: 'Cung', latex: '\\overset{\\frown}{#@}' },
    ],
  },
  {
    id: 'limit',
    name: 'Giới hạn & log',
    items: [
      { label: 'Giới hạn', latex: '\\lim_{#?\\to #?} #@' },
      { label: 'Giới hạn → ∞', latex: '\\lim_{#?\\to\\infty} #@' },
      { label: 'Giới hạn trái', latex: '\\lim_{#?\\to #?^{-}} #@' },
      { label: 'Giới hạn phải', latex: '\\lim_{#?\\to #?^{+}} #@' },
      { label: 'log cơ số', latex: '\\log_{#?} #@' },
      { label: 'max', latex: '\\max_{#?} #@' },
      { label: 'min', latex: '\\min_{#?} #@' },
      { label: 'sup', latex: '\\sup_{#?} #@' },
      { label: 'inf', latex: '\\inf_{#?} #@' },
    ],
  },
  {
    id: 'relation',
    name: 'Toán tử',
    items: [
      { label: 'Mũi tên có chữ', latex: '\\xrightarrow{#?}' },
      { label: 'Mũi tên trái có chữ', latex: '\\xleftarrow{#?}' },
      { label: 'Bằng theo định nghĩa', latex: '\\overset{\\text{def}}{=}' },
      { label: 'Ký hiệu trên', latex: '\\overset{#?}{#@}' },
      { label: 'Ký hiệu dưới', latex: '\\underset{#?}{#@}' },
      { label: ':=', latex: ':=' },
      { label: 'Tương đương', latex: '\\Leftrightarrow' },
      { label: 'Suy ra', latex: '\\Rightarrow' },
      { label: 'Đồng dư', latex: '#@\\equiv #?\\pmod{#?}' },
    ],
  },
  {
    id: 'matrix',
    name: 'Ma trận',
    items: [
      { label: 'Ma trận 2×2 ( )', latex: '\\begin{pmatrix}#@ & #?\\\\#? & #?\\end{pmatrix}' },
      { label: 'Ma trận 2×2 [ ]', latex: '\\begin{bmatrix}#@ & #?\\\\#? & #?\\end{bmatrix}' },
      { label: 'Ma trận 3×3', latex: '\\begin{pmatrix}#@ & #? & #?\\\\#? & #? & #?\\\\#? & #? & #?\\end{pmatrix}' },
      { label: 'Định thức 2×2', latex: '\\begin{vmatrix}#@ & #?\\\\#? & #?\\end{vmatrix}' },
      { label: 'Định thức 3×3', latex: '\\begin{vmatrix}#@ & #? & #?\\\\#? & #? & #?\\\\#? & #? & #?\\end{vmatrix}' },
      { label: 'Vectơ cột', latex: '\\begin{pmatrix}#@\\\\#?\\\\#?\\end{pmatrix}' },
      { label: 'Vectơ hàng', latex: '\\begin{pmatrix}#@ & #? & #?\\end{pmatrix}' },
      { label: 'Ma trận đơn vị', latex: 'I_3=\\begin{pmatrix}1 & 0 & 0\\\\0 & 1 & 0\\\\0 & 0 & 1\\end{pmatrix}' },
      { label: 'Ma trận m×n', latex: '\\begin{pmatrix}a_{11} & \\cdots & a_{1n}\\\\\\vdots & \\ddots & \\vdots\\\\a_{m1} & \\cdots & a_{mn}\\end{pmatrix}' },
      { label: 'Ma trận mở rộng', latex: '\\left(\\begin{array}{cc|c}#@ & #? & #?\\\\#? & #? & #?\\end{array}\\right)' },
    ],
  },
  {
    id: 'layout',
    name: 'Căn dòng & khung',
    items: [
      { label: 'Biến đổi nhiều dòng', latex: '\\begin{aligned}#@ &= #?\\\\&= #?\\end{aligned}' },
      { label: 'Nhiều dòng căn giữa', latex: '\\begin{gathered}#@\\\\#?\\end{gathered}' },
      { label: 'Đóng khung', latex: '\\boxed{#@}' },
      { label: 'Gạch chéo (rút gọn)', latex: '\\cancel{#@}' },
      { label: 'Gạch chéo ngược', latex: '\\bcancel{#@}' },
      { label: 'Gạch X', latex: '\\xcancel{#@}' },
      { label: 'Chữ thường trong công thức', latex: '\\text{#@}' },
      { label: 'Tô màu đỏ', latex: '\\color{red}{#@}' },
      { label: 'Tô màu xanh', latex: '\\color{blue}{#@}' },
      { label: 'Khoảng trắng', latex: '\\quad' },
    ],
  },
];

const symbols = (list: string): MathItem[] =>
  list
    .split(' ')
    .filter(Boolean)
    .map((entry) => {
      const [label, latex] = entry.split('=');
      return { label, latex };
    });

export const SYMBOL_GROUPS: MathGroup[] = [
  { id: 'greek', name: 'Hy Lạp thường', items: symbols('α=\\alpha β=\\beta γ=\\gamma δ=\\delta ε=\\varepsilon ζ=\\zeta η=\\eta θ=\\theta ϑ=\\vartheta ι=\\iota κ=\\kappa λ=\\lambda μ=\\mu ν=\\nu ξ=\\xi π=\\pi ρ=\\rho σ=\\sigma τ=\\tau υ=\\upsilon φ=\\varphi χ=\\chi ψ=\\psi ω=\\omega') },
  { id: 'greek-upper', name: 'Hy Lạp hoa', items: symbols('Γ=\\Gamma Δ=\\Delta Θ=\\Theta Λ=\\Lambda Ξ=\\Xi Π=\\Pi Σ=\\Sigma Υ=\\Upsilon Φ=\\Phi Ψ=\\Psi Ω=\\Omega') },
  { id: 'binary', name: 'Phép toán', items: symbols('±=\\pm ∓=\\mp ×=\\times ÷=\\div ·=\\cdot ∘=\\circ ∗=\\ast ⊕=\\oplus ⊗=\\otimes ⊖=\\ominus ∖=\\setminus ∧=\\wedge ∨=\\vee †=\\dagger ⋆=\\star') },
  { id: 'relation', name: 'Quan hệ', items: symbols('≤=\\leq ≥=\\geq ≠=\\neq ≈=\\approx ≡=\\equiv ∼=\\sim ≃=\\simeq ≅=\\cong ∝=\\propto ≪=\\ll ≫=\\gg ⩽=\\leqslant ⩾=\\geqslant ≺=\\prec ≻=\\succ ∣=\\mid ∤=\\nmid ⊥=\\perp ∥=\\parallel') },
  { id: 'arrow', name: 'Mũi tên', items: symbols('→=\\to ←=\\leftarrow ↔=\\leftrightarrow ⇒=\\Rightarrow ⇐=\\Leftarrow ⇔=\\Leftrightarrow ↦=\\mapsto ↑=\\uparrow ↓=\\downarrow ⇑=\\Uparrow ⇓=\\Downarrow ↗=\\nearrow ↘=\\searrow ⟶=\\longrightarrow ⟹=\\Longrightarrow ⇌=\\rightleftharpoons') },
  { id: 'set', name: 'Tập hợp & logic', items: symbols('∈=\\in ∉=\\notin ∋=\\ni ⊂=\\subset ⊆=\\subseteq ⊄=\\not\\subset ⊃=\\supset ⊇=\\supseteq ∪=\\cup ∩=\\cap ∅=\\varnothing ∀=\\forall ∃=\\exists ∄=\\nexists ¬=\\neg ∴=\\therefore ∵=\\because ℝ=\\mathbb{R} ℕ=\\mathbb{N} ℤ=\\mathbb{Z} ℚ=\\mathbb{Q} ℂ=\\mathbb{C} ℙ=\\mathbb{P}') },
  { id: 'geometry', name: 'Hình học', items: symbols('∠=\\angle ∡=\\measuredangle △=\\triangle □=\\square ⊙=\\odot °=^{\\circ} ⌢=\\frown ∥=\\parallel ⊥=\\perp ≅=\\cong ∼=\\sim') },
  { id: 'misc', name: 'Khác', items: symbols('∞=\\infty ∂=\\partial ∇=\\nabla ℏ=\\hbar ℓ=\\ell ℵ=\\aleph ℜ=\\Re ℑ=\\Im ⋯=\\cdots …=\\ldots ⋮=\\vdots ⋱=\\ddots ′=\\prime ♯=\\sharp ♭=\\flat ✓=\\checkmark') },
  { id: 'letters', name: 'Kiểu chữ', items: [
    { label: '𝐀 đậm', latex: '\\mathbf{#@}' },
    { label: '𝔸 tập số', latex: '\\mathbb{#@}' },
    { label: '𝒜 viết tay', latex: '\\mathcal{#@}' },
    { label: '𝔄 Fraktur', latex: '\\mathfrak{#@}' },
    { label: 'A thẳng', latex: '\\mathrm{#@}' },
    { label: '𝖠 không chân', latex: '\\mathsf{#@}' },
    { label: '𝙰 đơn cách', latex: '\\mathtt{#@}' },
  ] },
];

export const TEMPLATE_SUBJECTS: MathGroup[] = [
  {
    id: 'algebra',
    name: 'Đại số',
    items: [
      { label: 'Nghiệm phương trình bậc hai', latex: 'x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a},\\quad \\Delta=b^{2}-4ac' },
      { label: 'Định lý Vi-ét', latex: '\\begin{cases}x_1+x_2=-\\dfrac{b}{a}\\\\x_1x_2=\\dfrac{c}{a}\\end{cases}' },
      { label: 'Hằng đẳng thức bình phương', latex: '(a\\pm b)^{2}=a^{2}\\pm 2ab+b^{2}' },
      { label: 'Hiệu hai bình phương', latex: 'a^{2}-b^{2}=(a-b)(a+b)' },
      { label: 'Lập phương của tổng', latex: '(a+b)^{3}=a^{3}+3a^{2}b+3ab^{2}+b^{3}' },
      { label: 'Tổng hai lập phương', latex: 'a^{3}+b^{3}=(a+b)(a^{2}-ab+b^{2})' },
      { label: 'Nhị thức Newton', latex: '(a+b)^{n}=\\sum_{k=0}^{n}\\binom{n}{k}a^{n-k}b^{k}' },
      { label: 'Cấp số cộng', latex: 'u_n=u_1+(n-1)d,\\quad S_n=\\frac{n(u_1+u_n)}{2}' },
      { label: 'Cấp số nhân', latex: 'u_n=u_1q^{n-1},\\quad S_n=u_1\\frac{1-q^{n}}{1-q}' },
      { label: 'Logarit', latex: '\\log_a(xy)=\\log_a x+\\log_a y,\\quad \\log_a b=\\frac{\\ln b}{\\ln a}' },
      { label: 'Bất đẳng thức Cô-si', latex: '\\frac{a+b}{2}\\ge\\sqrt{ab}\\quad (a,b\\ge 0)' },
      { label: 'Bất đẳng thức Bunhiacốpxki', latex: '(a_1b_1+a_2b_2)^{2}\\le(a_1^{2}+a_2^{2})(b_1^{2}+b_2^{2})' },
      { label: 'Số phức dạng lượng giác', latex: 'z=r(\\cos\\varphi+i\\sin\\varphi)=re^{i\\varphi}' },
      { label: 'Đẳng thức Euler', latex: 'e^{i\\pi}+1=0' },
    ],
  },
  {
    id: 'geometry',
    name: 'Hình học',
    items: [
      { label: 'Định lý Pythagore', latex: 'a^{2}+b^{2}=c^{2}' },
      { label: 'Định lý côsin', latex: 'a^{2}=b^{2}+c^{2}-2bc\\cos A' },
      { label: 'Định lý sin', latex: '\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}=2R' },
      { label: 'Diện tích tam giác', latex: 'S=\\frac{1}{2}ah_a=\\frac{1}{2}bc\\sin A=\\sqrt{p(p-a)(p-b)(p-c)}' },
      { label: 'Diện tích hình tròn', latex: 'S=\\pi r^{2},\\quad C=2\\pi r' },
      { label: 'Thể tích khối cầu', latex: 'V=\\frac{4}{3}\\pi r^{3},\\quad S=4\\pi r^{2}' },
      { label: 'Thể tích khối chóp', latex: 'V=\\frac{1}{3}S_{\\text{đáy}}\\cdot h' },
      { label: 'Thể tích khối trụ', latex: 'V=\\pi r^{2}h' },
      { label: 'Tích vô hướng', latex: '\\vec{a}\\cdot\\vec{b}=|\\vec{a}|\\,|\\vec{b}|\\cos(\\vec{a},\\vec{b})=x_1x_2+y_1y_2+z_1z_2' },
      { label: 'Khoảng cách điểm tới mặt phẳng', latex: 'd(M,(P))=\\frac{|Ax_0+By_0+Cz_0+D|}{\\sqrt{A^{2}+B^{2}+C^{2}}}' },
      { label: 'Phương trình đường tròn', latex: '(x-a)^{2}+(y-b)^{2}=R^{2}' },
      { label: 'Phương trình mặt cầu', latex: '(x-a)^{2}+(y-b)^{2}+(z-c)^{2}=R^{2}' },
    ],
  },
  {
    id: 'trig',
    name: 'Lượng giác',
    items: [
      { label: 'Hệ thức cơ bản', latex: '\\sin^{2}x+\\cos^{2}x=1,\\quad 1+\\tan^{2}x=\\frac{1}{\\cos^{2}x}' },
      { label: 'Công thức cộng', latex: '\\sin(a\\pm b)=\\sin a\\cos b\\pm\\cos a\\sin b' },
      { label: 'Công thức nhân đôi', latex: '\\sin 2x=2\\sin x\\cos x,\\quad \\cos 2x=\\cos^{2}x-\\sin^{2}x' },
      { label: 'Hạ bậc', latex: '\\cos^{2}x=\\frac{1+\\cos 2x}{2},\\quad \\sin^{2}x=\\frac{1-\\cos 2x}{2}' },
      { label: 'Tổng thành tích', latex: '\\cos a+\\cos b=2\\cos\\frac{a+b}{2}\\cos\\frac{a-b}{2}' },
      { label: 'Phương trình sin x = sin α', latex: '\\sin x=\\sin\\alpha\\Leftrightarrow\\left[\\begin{array}{l}x=\\alpha+k2\\pi\\\\x=\\pi-\\alpha+k2\\pi\\end{array}\\right.\\;(k\\in\\mathbb{Z})' },
    ],
  },
  {
    id: 'calculus',
    name: 'Giải tích',
    items: [
      { label: 'Định nghĩa đạo hàm', latex: "f'(x_0)=\\lim_{h\\to 0}\\frac{f(x_0+h)-f(x_0)}{h}" },
      { label: 'Đạo hàm tích, thương', latex: "(uv)'=u'v+uv',\\quad \\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^{2}}" },
      { label: 'Đạo hàm hàm hợp', latex: "\\frac{dy}{dx}=\\frac{dy}{du}\\cdot\\frac{du}{dx}" },
      { label: 'Giới hạn cơ bản', latex: '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1,\\quad \\lim_{x\\to\\infty}\\left(1+\\frac{1}{x}\\right)^{x}=e' },
      { label: 'Công thức Newton–Leibniz', latex: '\\int_{a}^{b}f(x)\\,dx=F(b)-F(a)' },
      { label: 'Tích phân từng phần', latex: '\\int_{a}^{b}u\\,dv=\\left.uv\\right|_{a}^{b}-\\int_{a}^{b}v\\,du' },
      { label: 'Diện tích hình phẳng', latex: 'S=\\int_{a}^{b}|f(x)-g(x)|\\,dx' },
      { label: 'Thể tích khối tròn xoay', latex: 'V=\\pi\\int_{a}^{b}f^{2}(x)\\,dx' },
      { label: 'Khai triển Taylor', latex: 'f(x)=\\sum_{n=0}^{\\infty}\\frac{f^{(n)}(a)}{n!}(x-a)^{n}' },
      { label: 'Tích phân Gauss', latex: '\\int_{-\\infty}^{\\infty}e^{-x^{2}}\\,dx=\\sqrt{\\pi}' },
      { label: 'Chuỗi Fourier', latex: 'f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}\\left(a_n\\cos nx+b_n\\sin nx\\right)' },
    ],
  },
  {
    id: 'linear',
    name: 'Đại số tuyến tính',
    items: [
      { label: 'Định thức 2×2', latex: '\\begin{vmatrix}a & b\\\\c & d\\end{vmatrix}=ad-bc' },
      { label: 'Ma trận nghịch đảo 2×2', latex: 'A^{-1}=\\frac{1}{ad-bc}\\begin{pmatrix}d & -b\\\\-c & a\\end{pmatrix}' },
      { label: 'Hệ phương trình tuyến tính', latex: 'A\\mathbf{x}=\\mathbf{b}\\iff\\begin{pmatrix}a_{11} & a_{12}\\\\a_{21} & a_{22}\\end{pmatrix}\\begin{pmatrix}x_1\\\\x_2\\end{pmatrix}=\\begin{pmatrix}b_1\\\\b_2\\end{pmatrix}' },
      { label: 'Trị riêng', latex: '\\det(A-\\lambda I)=0' },
      { label: 'Quy tắc Cramer', latex: 'x_i=\\frac{\\det A_i}{\\det A}' },
    ],
  },
  {
    id: 'probability',
    name: 'Xác suất – thống kê',
    items: [
      { label: 'Tổ hợp, chỉnh hợp', latex: 'C_n^{k}=\\frac{n!}{k!(n-k)!},\\quad A_n^{k}=\\frac{n!}{(n-k)!}' },
      { label: 'Xác suất có điều kiện', latex: 'P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}' },
      { label: 'Công thức Bayes', latex: 'P(A\\mid B)=\\frac{P(B\\mid A)\\,P(A)}{P(B)}' },
      { label: 'Phân phối nhị thức', latex: 'P(X=k)=C_n^{k}p^{k}(1-p)^{n-k}' },
      { label: 'Kỳ vọng, phương sai', latex: 'E(X)=\\sum_{i}x_ip_i,\\quad V(X)=E(X^{2})-[E(X)]^{2}' },
      { label: 'Trung bình mẫu', latex: '\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i' },
      { label: 'Độ lệch chuẩn mẫu', latex: 's=\\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i-\\bar{x})^{2}}' },
      { label: 'Phân phối chuẩn', latex: 'f(x)=\\frac{1}{\\sigma\\sqrt{2\\pi}}e^{-\\frac{(x-\\mu)^{2}}{2\\sigma^{2}}}' },
      { label: 'Hệ số tương quan', latex: 'r=\\frac{\\sum(x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum(x_i-\\bar{x})^{2}\\sum(y_i-\\bar{y})^{2}}}' },
    ],
  },
  {
    id: 'physics',
    name: 'Vật lý',
    items: [
      { label: 'Chuyển động biến đổi đều', latex: 'v=v_0+at,\\quad s=v_0t+\\frac{1}{2}at^{2},\\quad v^{2}-v_0^{2}=2as' },
      { label: 'Định luật II Newton', latex: '\\vec{F}=m\\vec{a}' },
      { label: 'Vạn vật hấp dẫn', latex: 'F=G\\frac{m_1m_2}{r^{2}}' },
      { label: 'Động năng, thế năng', latex: 'W_{\\text{đ}}=\\frac{1}{2}mv^{2},\\quad W_t=mgh' },
      { label: 'Định luật Ôm', latex: 'I=\\frac{U}{R},\\quad P=UI=I^{2}R' },
      { label: 'Định luật Coulomb', latex: 'F=k\\frac{|q_1q_2|}{\\varepsilon r^{2}}' },
      { label: 'Dao động điều hòa', latex: 'x=A\\cos(\\omega t+\\varphi),\\quad \\omega=\\sqrt{\\frac{k}{m}}' },
      { label: 'Khí lý tưởng', latex: 'pV=nRT' },
      { label: 'Năng lượng – khối lượng', latex: 'E=mc^{2}' },
      { label: 'Phương trình Schrödinger', latex: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi=\\hat{H}\\Psi' },
      { label: 'Phương trình Maxwell (Gauss)', latex: '\\nabla\\cdot\\vec{E}=\\frac{\\rho}{\\varepsilon_0}' },
    ],
  },
  {
    id: 'chemistry',
    name: 'Hóa học',
    items: [
      { label: 'Đốt cháy hiđro', latex: '\\ce{2H2 + O2 -> 2H2O}' },
      { label: 'Phản ứng thuận nghịch', latex: '\\ce{N2 + 3H2 <=> 2NH3}' },
      { label: 'Điều kiện phản ứng', latex: '\\ce{CaCO3 ->[t^\\circ] CaO + CO2 ^}' },
      { label: 'Kết tủa', latex: '\\ce{Ba^2+ + SO4^2- -> BaSO4 v}' },
      { label: 'Điện li axit', latex: '\\ce{H2SO4 -> 2H+ + SO4^2-}' },
      { label: 'Este hóa', latex: '\\ce{CH3COOH + C2H5OH <=>[H2SO4][t^\\circ] CH3COOC2H5 + H2O}' },
      { label: 'Ion và điện tích', latex: '\\ce{Fe^3+ + 3OH- -> Fe(OH)3 v}' },
      { label: 'Hằng số cân bằng', latex: 'K_c=\\frac{[\\ce{NH3}]^{2}}{[\\ce{N2}][\\ce{H2}]^{3}}' },
      { label: 'pH', latex: '\\mathrm{pH}=-\\log[\\ce{H+}]' },
      { label: 'Số mol', latex: 'n=\\frac{m}{M}=\\frac{V}{22{,}4}=C_M\\cdot V' },
    ],
  },
  {
    id: 'finance',
    name: 'Kinh tế – tài chính',
    items: [
      { label: 'Lãi đơn', latex: 'A=P(1+rt)' },
      { label: 'Lãi kép', latex: 'A=P\\left(1+\\frac{r}{n}\\right)^{nt}' },
      { label: 'Giá trị hiện tại thuần', latex: '\\mathrm{NPV}=\\sum_{t=0}^{n}\\frac{CF_t}{(1+r)^{t}}' },
      { label: 'Trả góp đều hằng kỳ', latex: 'PMT=P\\frac{r(1+r)^{n}}{(1+r)^{n}-1}' },
      { label: 'Tăng trưởng kép (CAGR)', latex: '\\mathrm{CAGR}=\\left(\\frac{V_{\\text{cuối}}}{V_{\\text{đầu}}}\\right)^{1/n}-1' },
      { label: 'Điểm hòa vốn', latex: 'Q_{hv}=\\frac{F}{p-v}' },
      { label: 'Tỷ suất lợi nhuận', latex: '\\mathrm{ROI}=\\frac{\\text{Lợi nhuận}}{\\text{Vốn đầu tư}}\\times 100\\%' },
    ],
  },
];

export const usesChemistry = (latex: string): boolean => /\\ce\{/.test(latex);

const VIETNAMESE_TEXT_WARNINGS = new Set(['unknownSymbol', 'symbolNotInFont']);

export const katexStrict = (code: string): 'ignore' | 'warn' => (VIETNAMESE_TEXT_WARNINGS.has(code) ? 'ignore' : 'warn');
