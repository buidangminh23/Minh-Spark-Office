export const MATH_SYMBOL_COMMANDS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', Theta: 'Θ', iota: 'ι', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', Xi: 'Ξ',
  pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', Phi: 'Φ',
  chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', circ: '∘', ast: '∗',
  approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', neq: '≠', leq: '≤', geq: '≥', ll: '≪', gg: '≫', propto: '∝',
  sqrt: '√', sum: '∑', prod: '∏', int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  infty: '∞', partial: '∂', nabla: '∇', hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', emptyset: '∅', setminus: '∖',
  forall: '∀', exists: '∃', nexists: '∄', neg: '¬', land: '∧', lor: '∨', oplus: '⊕', otimes: '⊗',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', degree: '°', cdots: '⋯', ldots: '…', vdots: '⋮', ddots: '⋱',
};

const SUPERSCRIPT_DIGITS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', n: 'ⁿ' };

const MATH_HINT = /[\\^_=+<>{}]/;
const SINGLE_VARIABLE = /^[A-Za-z]$/;
const MONEY_LIKE = /^[\d.,\s]+([kKmMtTrđ%]|tr|triệu|nghìn)?$/u;

export const isInsideOpenMath = (textBefore: string): boolean => {
  let open = false;
  for (let index = 0; index < textBefore.length; index += 1) {
    if (textBefore[index] === '\\') {
      index += 1;
      continue;
    }
    if (textBefore[index] === '$') open = !open;
  }
  return open;
};

export const looksLikeInlineMath = (content: string): boolean => {
  if (content.length === 0 || /^\s|\s$/.test(content)) return false;
  if (MONEY_LIKE.test(content)) return false;
  return MATH_HINT.test(content) || SINGLE_VARIABLE.test(content);
};

export const looksLikeDisplayMath = (content: string): boolean => {
  const trimmed = content.trim();
  if (!trimmed || MONEY_LIKE.test(trimmed)) return false;
  return MATH_HINT.test(trimmed) || /[A-Za-z]/.test(trimmed);
};

export const symbolForCommand = (command: string): string | null => MATH_SYMBOL_COMMANDS[command] ?? null;

export const SYMBOL_TRIGGER = /\\([A-Za-z]+)\s$/;

export const SUPERSCRIPT_TRIGGER = /([\p{L}\d)\]])\^([0-9n])\s$/u;

export const superscriptFor = (character: string): string | null => SUPERSCRIPT_DIGITS[character] ?? null;
