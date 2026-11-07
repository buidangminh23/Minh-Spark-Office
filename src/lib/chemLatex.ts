const ARROWS: Record<string, string> = {
  '->': '\\rightarrow',
  '<-': '\\leftarrow',
  '<->': '\\leftrightarrow',
  '<=>': '\\rightleftharpoons',
  '=': '=',
};

const ARROW_TOKEN = /^(<=>|<->|->|<-)((?:\[[^\]]*\])*)$/;
const CHARGE = /^[0-9]*[+-]$/;

const label = (text: string) => (/\\/.test(text) ? text : speciesToLatex(text));

function arrowToLatex(arrow: string, labels: string): string {
  const parts = [...labels.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]);
  const symbol = ARROWS[arrow];
  if (!parts.length) return symbol;
  const above = parts[0] ? label(parts[0]) : '';
  const below = parts[1] ? label(parts[1]) : '';
  if (above && below) return `\\underset{${below}}{\\overset{${above}}{${symbol}}}`;
  if (above) return `\\overset{${above}}{${symbol}}`;
  return `\\underset{${below}}{${symbol}}`;
}

function speciesToLatex(token: string): string {
  const coefficient = /^[0-9]+(?=[A-Z(\[])/.exec(token)?.[0] ?? '';
  let rest = token.slice(coefficient.length);
  let out = coefficient;
  let charge = '';
  const explicit = /\^([0-9]*[+-]|\{[^}]*\})$/.exec(rest);
  if (explicit) {
    charge = explicit[1].replace(/^\{|\}$/g, '');
    rest = rest.slice(0, explicit.index);
  } else if (/[A-Za-z0-9)\]][+-]$/.test(rest) && rest.length > 1) {
    charge = rest.slice(-1);
    rest = rest.slice(0, -1);
  }
  let letters = '';
  const flush = () => {
    if (letters) out += `\\mathrm{${letters}}`;
    letters = '';
  };
  for (let index = 0; index < rest.length; index++) {
    const char = rest[index];
    if (/[A-Za-z]/.test(char)) {
      letters += char;
    } else if (/[0-9]/.test(char) && index > 0 && /[A-Za-z)\]]/.test(rest[index - 1])) {
      flush();
      let digits = char;
      while (/[0-9]/.test(rest[index + 1] ?? '')) digits += rest[++index];
      out += `_{${digits}}`;
    } else {
      flush();
      out += char;
    }
  }
  flush();
  if (charge) out += `^{${charge}}`;
  return out;
}

export function ceToLatex(content: string): string {
  return content
    .trim()
    .split(/\s+/)
    .map((token) => {
      const arrow = ARROW_TOKEN.exec(token);
      if (arrow) return arrowToLatex(arrow[1], arrow[2]);
      if (token === '+') return '+';
      if (token === '^') return '\\uparrow';
      if (token === 'v') return '\\downarrow';
      if (token === '=') return '=';
      if (CHARGE.test(token)) return `^{${token}}`;
      return speciesToLatex(token);
    })
    .join(' ');
}

export function expandChemistry(latex: string): string {
  let output = '';
  let index = 0;
  while (index < latex.length) {
    const start = latex.indexOf('\\ce{', index);
    if (start < 0) {
      output += latex.slice(index);
      break;
    }
    output += latex.slice(index, start);
    let depth = 0;
    let cursor = start + 3;
    for (; cursor < latex.length; cursor++) {
      if (latex[cursor] === '{') depth++;
      else if (latex[cursor] === '}' && --depth === 0) break;
    }
    output += `{${ceToLatex(latex.slice(start + 4, cursor))}}`;
    index = cursor + 1;
  }
  return output;
}
