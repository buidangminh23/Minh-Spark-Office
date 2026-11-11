export const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', infty: '∞', partial: '∂', nabla: '∇', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', implies: '⇒', iff: '⇔', sim: '∼', cong: '≅', propto: '∝', perp: '⊥', parallel: '∥', angle: '∠', degree: '°', circ: '∘', bullet: '•', ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
  lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', log: 'log', ln: 'ln', exp: 'exp', min: 'min', max: 'max',
};

const LATEX_OF_SYMBOL = new Map(Object.entries(SYMBOLS).reverse().filter(([, symbol]) => symbol.length === 1).map(([name, symbol]) => [symbol, `\\${name} `]));
const NARY_COMMANDS: Record<string, string> = { '∑': '\\sum', '∫': '\\int', '∏': '\\prod', '∮': '\\oint' };

const mathChild = (el: Element, name: string) => Array.from(el.children).find((c) => c.localName === name) ?? null;
const mathValue = (el: Element | null) => el?.getAttribute('m:val') ?? null;
const scriptBase = (text: string) => (text.length > 1 && !/^\\[A-Za-z]+ ?$/.test(text) ? `{${text}}` : text);

export function ommlToLatex(el: Element | null): string {
  if (!el) return '';
  const part = (name: string) => ommlToLatex(mathChild(el, name));
  switch (el.localName) {
    case 'r': return Array.from(mathChild(el, 't')?.textContent ?? '', (char) => LATEX_OF_SYMBOL.get(char) ?? char).join('');
    case 'f': return `\\frac{${part('num')}}{${part('den')}}`;
    case 'rad': {
      const degree = part('deg');
      return degree ? `\\sqrt[${degree}]{${part('e')}}` : `\\sqrt{${part('e')}}`;
    }
    case 'sSup': return `${scriptBase(part('e'))}^{${part('sup')}}`;
    case 'sSub': return `${scriptBase(part('e'))}_{${part('sub')}}`;
    case 'sSubSup': return `${scriptBase(part('e'))}_{${part('sub')}}^{${part('sup')}}`;
    case 'nary': {
      const symbol = mathValue(mathChild(mathChild(el, 'naryPr') ?? el, 'chr')) ?? '∫';
      const sub = part('sub');
      const sup = part('sup');
      return `${NARY_COMMANDS[symbol] ?? symbol}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${part('e')}`;
    }
    case 'd': {
      const props = mathChild(el, 'dPr') ?? el;
      return `\\left${mathValue(mathChild(props, 'begChr')) ?? '('}${part('e')}\\right${mathValue(mathChild(props, 'endChr')) ?? ')'}`;
    }
    case 'func': return `${part('fName')} ${part('e')}`;
    case 'rPr':
    case 'ctrlPr':
    case 'naryPr':
    case 'dPr':
    case 'fPr':
    case 'radPr':
    case 'sSupPr':
    case 'sSubPr':
    case 'sSubSupPr':
    case 'funcPr': return '';
    default: return Array.from(el.children).map(ommlToLatex).join('');
  }
}
