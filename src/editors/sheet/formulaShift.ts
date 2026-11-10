const MAX_ROW = 1048576;
const MAX_COL = 16384;
const REF_ERROR = '#REF!';
const BOUNDARY_BEFORE = /[A-Za-z0-9_.]/;

const CELL_REF = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(!.[])/y;
const COLUMN_RANGE = /(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(!.[])/y;
const ROW_RANGE = /(\$?)(\d+):(\$?)(\d+)(?![A-Za-z0-9_(!.[])/y;
const NUMBER = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/y;
const IDENTIFIER = /[A-Za-z0-9_.$\\]+/y;

const columnToIndex = (letters: string) => {
  let value = 0;
  for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return value;
};

const indexToColumn = (index: number) => {
  let value = index;
  let name = '';
  while (value > 0) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
};

const shiftColumn = (absolute: string, letters: string, offset: number) => {
  const index = columnToIndex(letters);
  if (index > MAX_COL) return null;
  const next = absolute ? index : index + offset;
  if (next < 1 || next > MAX_COL) return REF_ERROR;
  return `${absolute}${indexToColumn(next)}`;
};

const shiftRow = (absolute: string, digits: string, offset: number) => {
  const index = Number(digits);
  if (index < 1 || index > MAX_ROW) return null;
  const next = absolute ? index : index + offset;
  if (next < 1 || next > MAX_ROW) return REF_ERROR;
  return `${absolute}${next}`;
};

const skipQuoted = (formula: string, start: number, quote: string) => {
  let i = start + 1;
  while (i < formula.length) {
    if (formula[i] === quote) {
      if (formula[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return formula.length;
};

const skipBracket = (formula: string, start: number) => {
  let depth = 0;
  let i = start;
  while (i < formula.length) {
    if (formula[i] === '[') depth++;
    else if (formula[i] === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return formula.length;
};

const matchAt = (pattern: RegExp, formula: string, index: number) => {
  pattern.lastIndex = index;
  return pattern.exec(formula);
};

const joinRange = (start: string | null, end: string | null) => {
  if (start === null || end === null) return null;
  if (start === REF_ERROR || end === REF_ERROR) return REF_ERROR;
  return `${start}:${end}`;
};

const tryShiftReference = (formula: string, index: number, rowOffset: number, colOffset: number) => {
  const columns = matchAt(COLUMN_RANGE, formula, index);
  if (columns) {
    const shifted = joinRange(shiftColumn(columns[1], columns[2], colOffset), shiftColumn(columns[3], columns[4], colOffset));
    if (shifted !== null) return { text: shifted, length: columns[0].length };
  }
  const rows = matchAt(ROW_RANGE, formula, index);
  if (rows) {
    const shifted = joinRange(shiftRow(rows[1], rows[2], rowOffset), shiftRow(rows[3], rows[4], rowOffset));
    if (shifted !== null) return { text: shifted, length: rows[0].length };
  }
  const cell = matchAt(CELL_REF, formula, index);
  if (cell) {
    const column = shiftColumn(cell[1], cell[2], colOffset);
    const row = shiftRow(cell[3], cell[4], rowOffset);
    if (column !== null && row !== null) {
      const text = column === REF_ERROR || row === REF_ERROR ? REF_ERROR : `${column}${row}`;
      return { text, length: cell[0].length };
    }
  }
  return null;
};

export function shiftFormulaReferences(formula: string, rowOffset: number, colOffset: number): string {
  if (!formula.startsWith('=') || (rowOffset === 0 && colOffset === 0)) return formula;
  let output = '';
  let i = 0;
  while (i < formula.length) {
    const char = formula[i];
    if (char === '"' || char === "'") {
      const end = skipQuoted(formula, i, char);
      output += formula.slice(i, end);
      i = end;
      continue;
    }
    if (char === '[') {
      const end = skipBracket(formula, i);
      output += formula.slice(i, end);
      i = end;
      continue;
    }
    const startsToken = /[A-Za-z0-9_$\\]/.test(char) && !(i > 0 && BOUNDARY_BEFORE.test(formula[i - 1]));
    if (!startsToken) {
      output += char;
      i++;
      continue;
    }
    const shifted = tryShiftReference(formula, i, rowOffset, colOffset);
    if (shifted) {
      output += shifted.text;
      i += shifted.length;
      continue;
    }
    const literal = /\d/.test(char) ? matchAt(NUMBER, formula, i) : matchAt(IDENTIFIER, formula, i);
    const length = literal?.[0].length || 1;
    output += formula.slice(i, i + length);
    i += length;
  }
  return output;
}
