import { MathFraction, MathIntegral, MathRadical, MathRun, MathSubScript, MathSubSuperScript, MathSum, MathSuperScript } from 'docx';
import { SYMBOLS } from './ommlLatex';

type MathPart = MathRun | MathFraction | MathRadical | MathSum | MathIntegral | MathSuperScript | MathSubScript | MathSubSuperScript;

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
  const openBracket = name === 'cases' ? '{ ' : name === 'pmatrix' ? '( ' : name === 'vmatrix' ? '| ' : '[ ';
  const closeBracket = name === 'cases' ? '' : name === 'pmatrix' ? ' )' : name === 'vmatrix' ? ' |' : ' ]';
  const parts: MathPart[] = [new MathRun(openBracket)];
  rows.forEach((row, index) => {
    if (index) parts.push(new MathRun(' ; '));
    parts.push(...latexToMath(row));
  });
  if (closeBracket) parts.push(new MathRun(closeBracket));
  return parts;
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
        reader.skipSpace();
        let degree: string | null = null;
        if (reader.peek() === '[') {
          reader.index++;
          const degStart = reader.index;
          const degEnd = reader.source.indexOf(']', degStart);
          if (degEnd >= 0) {
            degree = reader.source.slice(degStart, degEnd);
            reader.index = degEnd + 1;
          }
        }
        const body = reader.group();
        parts.push(new MathRadical({ children: latexToMath(body), ...(degree ? { degree: latexToMath(degree) } : {}) }));
      } else if (name === 'sum') {
        flush();
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathSum({ children: [new MathRun('')], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'prod') {
        flush();
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathSum({ children: [new MathRun('∏')], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'int') {
        flush();
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathIntegral({ children: [new MathRun('')], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'iint' || name === 'iiint' || name === 'oint') {
        flush();
        const symbol = name === 'iint' ? '∬' : name === 'iiint' ? '∭' : '∮';
        const { sub, sup } = reader.optionalLimits();
        parts.push(new MathIntegral({ children: [new MathRun(symbol)], ...(sub !== null ? { subScript: latexToMath(sub) } : {}), ...(sup !== null ? { superScript: latexToMath(sup) } : {}) }));
      } else if (name === 'binom') {
        flush();
        const n = reader.group();
        const k = reader.group();
        parts.push(new MathRun('('));
        parts.push(new MathFraction({ numerator: latexToMath(n), denominator: latexToMath(k), type: 'noBar' }));
        parts.push(new MathRun(')'));
      } else if (name === 'vec' || name === 'overrightarrow') {
        flush();
        parts.push(...latexToMath(reader.group()));
        parts.push(new MathRun('⃗'));
      } else if (name === 'bar' || name === 'overline') {
        flush();
        parts.push(...latexToMath(reader.group()));
        parts.push(new MathRun('̄'));
      } else if (name === 'hat') {
        flush();
        parts.push(...latexToMath(reader.group()));
        parts.push(new MathRun('̂'));
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
