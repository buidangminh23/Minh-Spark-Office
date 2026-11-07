import { MathFraction, MathIntegral, MathRadical, MathRun, MathSubScript, MathSubSuperScript, MathSum, MathSuperScript } from 'docx';

type MathPart = MathRun | MathFraction | MathRadical | MathSum | MathIntegral | MathSuperScript | MathSubScript | MathSubSuperScript;

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', infty: '∞', partial: '∂', nabla: '∇', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃', degree: '°', ldots: '…', cdots: '⋯',
  lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln', exp: 'exp', min: 'min', max: 'max',
};
const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad']);

class Reader {
  index = 0;
  source: string;

  constructor(source: string) {
    this.source = source;
  }

  get done() {
    return this.index >= this.source.length;
  }

  peek() {
    return this.source[this.index];
  }

  skipSpace() {
    while (!this.done && /\s/.test(this.peek())) this.index++;
  }

  command() {
    this.index++;
    const match = /^[A-Za-z]+/.exec(this.source.slice(this.index));
    const name = match ? match[0] : this.source[this.index] ?? '';
    this.index += name.length;
    return name;
  }

  group(): string {
    this.skipSpace();
    if (this.peek() !== '{') {
      if (this.peek() === '\\') {
        const start = this.index;
        this.command();
        return this.source.slice(start, this.index);
      }
      return this.source[this.index++] ?? '';
    }
    let depth = 0;
    const start = this.index + 1;
    while (!this.done) {
      const char = this.source[this.index++];
      if (char === '{') depth++;
      if (char === '}' && --depth === 0) return this.source.slice(start, this.index - 1);
    }
    return this.source.slice(start);
  }

  optionalLimits() {
    let sub: string | null = null;
    let sup: string | null = null;
    for (let round = 0; round < 2; round++) {
      this.skipSpace();
      if (this.peek() === '_' && sub === null) {
        this.index++;
        sub = this.group();
      } else if (this.peek() === '^' && sup === null) {
        this.index++;
        sup = this.group();
      }
    }
    return { sub, sup };
  }
}

const withScripts = (base: MathPart[], sub: string | null, sup: string | null): MathPart[] => {
  if (sub !== null && sup !== null) return [new MathSubSuperScript({ children: base, subScript: latexToMath(sub), superScript: latexToMath(sup) })];
  if (sup !== null) return [new MathSuperScript({ children: base, superScript: latexToMath(sup) })];
  if (sub !== null) return [new MathSubScript({ children: base, subScript: latexToMath(sub) })];
  return base;
};

function environment(reader: Reader): MathPart[] {
  const name = reader.group();
  const end = `\\end{${name}}`;
  const stop = reader.source.indexOf(end, reader.index);
  const body = stop < 0 ? reader.source.slice(reader.index) : reader.source.slice(reader.index, stop);
  reader.index = stop < 0 ? reader.source.length : stop + end.length;
  const rows = body.split('\\\\').map((row) => row.split('&').map((cell) => cell.trim()).join('  ').trim()).filter(Boolean);
  const parts: MathPart[] = [new MathRun(name === 'cases' ? '{ ' : '[ ')];
  rows.forEach((row, index) => {
    if (index) parts.push(new MathRun(' ; '));
    parts.push(...latexToMath(row));
  });
  if (name !== 'cases') parts.push(new MathRun(' ]'));
  return parts;
}

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

export function latexToMath(source: string): MathPart[] {
  const reader = new Reader(source);
  const parts: MathPart[] = [];
  let text = '';
  const flush = () => {
    if (text) parts.push(new MathRun(text));
    text = '';
  };
  const last = (): MathPart[] => {
    if (text) {
      const char = text.slice(-1);
      text = text.slice(0, -1);
      flush();
      return [new MathRun(char)];
    }
    const previous = parts.pop();
    return previous ? [previous] : [new MathRun('')];
  };
  while (!reader.done) {
    const char = reader.peek();
    if (char === '{') {
      flush();
      parts.push(...latexToMath(reader.group()));
    } else if (char === '^' || char === '_') {
      const base = last();
      const { sub, sup } = reader.optionalLimits();
      parts.push(...withScripts(base, sub, sup));
    } else if (char === '\\') {
      const name = reader.command();
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        flush();
        parts.push(new MathFraction({ numerator: latexToMath(reader.group()), denominator: latexToMath(reader.group()) }));
      } else if (name === 'sqrt') {
        flush();
        parts.push(new MathRadical({ children: latexToMath(reader.group()) }));
      } else if (name === 'sum') {
        flush();
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathSum({ children: [new MathRun('')], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'int') {
        flush();
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathIntegral({ children: [new MathRun('')], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'begin') {
        flush();
        parts.push(...environment(reader));
      } else if (name === 'left' || name === 'right') {
        continue;
      } else if (name === 'text' || name === 'mathrm' || name === 'mathbf') {
        text += reader.group();
      } else if (SPACES.has(name)) {
        text += ' ';
      } else {
        text += SYMBOLS[name] ?? name;
      }
    } else {
      text += char;
      reader.index++;
    }
  }
  flush();
  return parts;
}
