export type TokenKind = 'id' | 'num' | 'str' | 'date' | 'op' | 'nl' | 'bracket' | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  value?: number | string;
  line: number;
  colon?: boolean;
}

export class VbaSyntaxError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(`Dòng ${line}: ${message}`);
    this.line = line;
  }
}

const TWO_CHAR_OPS = ['<=', '>=', '<>', ':='];
const ONE_CHAR_OPS = '=<>+-*/\\^&(),.!;#';
const TYPE_SUFFIX = /[$%&!#@]$/;

const isIdStart = (char: string) => /[\p{L}_]/u.test(char);
const isIdPart = (char: string) => /[\p{L}\p{N}_]/u.test(char);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const text = source.replace(/\r\n?/g, '\n');
  let index = 0;
  let line = 1;
  const push = (token: Omit<Token, 'line'>) => tokens.push({ ...token, line });
  const lastKind = () => tokens[tokens.length - 1]?.kind;
  const atStatementStart = () => !tokens.length || lastKind() === 'nl';

  while (index < text.length) {
    const char = text[index];
    if (char === '\n') {
      if (lastKind() !== 'nl' && tokens.length) push({ kind: 'nl', text: '\n' });
      line += 1;
      index += 1;
      continue;
    }
    if (char === ' ' || char === '\t' || char === ' ') {
      index += 1;
      continue;
    }
    if (char === '_' && /^_[ \t]*\n/.test(text.slice(index)) && (index === 0 || /[ \t]/.test(text[index - 1]))) {
      index = text.indexOf('\n', index) + 1;
      line += 1;
      continue;
    }
    if (char === "'") {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === ':' && text[index + 1] !== '=') {
      if (lastKind() !== 'nl' && tokens.length) push({ kind: 'nl', text: ':', colon: true });
      index += 1;
      continue;
    }
    if (char === '"') {
      let value = '';
      index += 1;
      while (true) {
        if (index >= text.length || text[index] === '\n') throw new VbaSyntaxError('Chuỗi thiếu dấu " đóng', line);
        if (text[index] === '"') {
          if (text[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        value += text[index];
        index += 1;
      }
      push({ kind: 'str', text: value, value });
      continue;
    }
    if (char === '[') {
      const close = text.indexOf(']', index);
      if (close < 0) throw new VbaSyntaxError('Thiếu dấu ]', line);
      push({ kind: 'bracket', text: text.slice(index + 1, close) });
      index = close + 1;
      continue;
    }
    if (char === '#' && (lastKind() === 'op' || lastKind() === 'nl' || !tokens.length || lastKind() === 'id')) {
      const close = text.indexOf('#', index + 1);
      const inner = close > 0 ? text.slice(index + 1, close) : '';
      if (close > 0 && !inner.includes('\n') && /\d/.test(inner) && /[/:-]/.test(inner)) {
        push({ kind: 'date', text: inner, value: inner });
        index = close + 1;
        continue;
      }
    }
    if (char === '&' && /^&[hHoO][0-9a-fA-F]/.test(text.slice(index))) {
      const match = /^&([hHoO])([0-9a-fA-F]+)&?/.exec(text.slice(index))!;
      const radix = match[1].toLowerCase() === 'h' ? 16 : 8;
      let value = parseInt(match[2], radix);
      if (radix === 16 && match[2].length <= 4 && value > 0x7fff && !match[0].endsWith('&')) value -= 0x10000;
      push({ kind: 'num', text: match[0], value });
      index += match[0].length;
      continue;
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(text[index + 1] ?? ''))) {
      const match = /^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)[#!@%&]?/.exec(text.slice(index))!;
      push({ kind: 'num', text: match[0], value: Number(match[0].replace(/[#!@%&]$/, '')) });
      index += match[0].length;
      continue;
    }
    if (isIdStart(char)) {
      let end = index + 1;
      while (end < text.length && isIdPart(text[end])) end += 1;
      if (end < text.length && /[$%&!#@]/.test(text[end]) && !isIdStart(text[end + 1] ?? '') && text[end + 1] !== '.' && text[end] !== '!') end += 1;
      const word = text.slice(index, end).replace(TYPE_SUFFIX, '');
      if (word.toLowerCase() === 'rem' && atStatementStart()) {
        while (index < text.length && text[index] !== '\n') index += 1;
        continue;
      }
      push({ kind: 'id', text: word });
      index = end;
      continue;
    }
    const two = text.slice(index, index + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      push({ kind: 'op', text: two });
      index += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(char)) {
      push({ kind: 'op', text: char });
      index += 1;
      continue;
    }
    throw new VbaSyntaxError(`Ký tự không hợp lệ "${char}"`, line);
  }
  if (lastKind() !== 'nl') push({ kind: 'nl', text: '\n' });
  push({ kind: 'eof', text: '' });
  return tokens;
}
