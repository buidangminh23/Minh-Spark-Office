export const NOTHING: unique symbol = Symbol('Nothing');
export const MISSING: unique symbol = Symbol('Missing');

export class VbaDate {
  readonly serial: number;
  constructor(serial: number) {
    this.serial = serial;
  }
}

export class VbaArray {
  bounds: Array<{ lb: number; ub: number }>;
  data: VbaValue[];
  constructor(bounds: Array<{ lb: number; ub: number }>, fill: VbaValue = undefined) {
    this.bounds = bounds;
    const size = bounds.reduce((total, bound) => total * Math.max(0, bound.ub - bound.lb + 1), bounds.length ? 1 : 0);
    this.data = new Array(size).fill(fill);
  }

  static fromList(values: VbaValue[], lb = 0): VbaArray {
    const array = new VbaArray([{ lb, ub: lb + values.length - 1 }]);
    array.data = [...values];
    return array;
  }

  static fromGrid(rows: VbaValue[][]): VbaArray {
    const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const array = new VbaArray([{ lb: 1, ub: rows.length }, { lb: 1, ub: columns }]);
    rows.forEach((row, r) => row.forEach((value, c) => (array.data[r * columns + c] = value)));
    return array;
  }

  offset(indices: number[]): number {
    if (indices.length !== this.bounds.length) throw new VbaError(9, 'Số chỉ số không khớp với số chiều của mảng');
    let position = 0;
    for (let d = 0; d < indices.length; d++) {
      const { lb, ub } = this.bounds[d];
      const index = indices[d];
      if (index < lb || index > ub) throw new VbaError(9, `Chỉ số ${index} nằm ngoài mảng (${lb} To ${ub})`);
      position = position * (ub - lb + 1) + (index - lb);
    }
    return position;
  }

  get(indices: number[]): VbaValue {
    return this.data[this.offset(indices)];
  }

  set(indices: number[], value: VbaValue) {
    this.data[this.offset(indices)] = value;
  }

  rows(): VbaValue[][] {
    if (this.bounds.length === 1) return [this.data.slice()];
    const [rowBound, colBound] = this.bounds;
    const columns = colBound.ub - colBound.lb + 1;
    const result: VbaValue[][] = [];
    for (let r = 0; r <= rowBound.ub - rowBound.lb; r++) result.push(this.data.slice(r * columns, (r + 1) * columns));
    return result;
  }
}

export type VbaArgs = { values: VbaValue[]; names: Array<string | undefined> };

export abstract class VbaObject {
  abstract readonly typeName: string;
  get(name: string, _args: VbaArgs): VbaValue {
    throw new VbaError(438, `Đối tượng ${this.typeName} không có thuộc tính hoặc phương thức "${name}"`);
  }
  set(_name: string, _args: VbaArgs, _value: VbaValue): boolean {
    return false;
  }
  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) throw new VbaError(438, `Đối tượng ${this.typeName} không có giá trị mặc định`);
    throw new VbaError(438, `Đối tượng ${this.typeName} không nhận chỉ số`);
  }
  defaultSet(_args: VbaArgs, _value: VbaValue): void {
    throw new VbaError(438, `Không gán giá trị trực tiếp cho ${this.typeName}`);
  }
  items(): VbaValue[] {
    throw new VbaError(438, `Không duyệt For Each được trên ${this.typeName}`);
  }
}

export type VbaValue = number | string | boolean | null | undefined | VbaDate | VbaArray | VbaObject | typeof NOTHING | typeof MISSING;

export class VbaError extends Error {
  readonly number: number;
  line = 0;
  source = '';
  constructor(number: number, message: string) {
    super(message);
    this.number = number;
  }
}

export const noArgs: VbaArgs = { values: [], names: [] };
export const argsOf = (...values: VbaValue[]): VbaArgs => ({ values, names: values.map(() => undefined) });

export function arg(args: VbaArgs, index: number, name?: string): VbaValue {
  if (name) {
    const named = args.names.indexOf(name.toLowerCase());
    if (named >= 0) return args.values[named];
  }
  const value = args.values[index];
  if (value === MISSING) return undefined;
  return args.names[index] === undefined ? value : undefined;
}

export const isMissing = (value: VbaValue) => value === undefined || value === MISSING;
export const isObject = (value: VbaValue): value is VbaObject => value instanceof VbaObject;

export function scalar(value: VbaValue): VbaValue {
  if (value instanceof VbaObject) return value.defaultGet(noArgs);
  if (value === NOTHING) throw new VbaError(91, 'Biến đối tượng chưa được gán (Nothing)');
  return value;
}

const EPOCH_MS = Date.UTC(1899, 11, 30);

export function dateToSerial(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return (utc - EPOCH_MS) / 86400000;
}

export function serialToParts(serial: number) {
  const date = new Date(EPOCH_MS + Math.round(serial * 86400000));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    weekday: date.getUTCDay() + 1,
  };
}

export function partsToSerial(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return (Date.UTC(year, month - 1, day, hour, minute, second) - EPOCH_MS) / 86400000;
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function parseDateText(text: string): number | null {
  const trimmed = text.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
  if (match) return partsToSerial(+match[1], +match[2], +match[3], +(match[4] ?? 0), +(match[5] ?? 0), +(match[6] ?? 0));
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(trimmed);
  if (match) {
    let year = +match[3];
    if (year < 100) year += year < 30 ? 2000 : 1900;
    let first = +match[1];
    let second = +match[2];
    if (first > 12) [first, second] = [second, first];
    let hour = +(match[4] ?? 0);
    if (match[7]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (match[7]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return partsToSerial(year, first, second, hour, +(match[5] ?? 0), +(match[6] ?? 0));
  }
  match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(trimmed);
  if (match) {
    let hour = +match[1];
    if (match[4]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (match[4]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return (hour * 3600 + +match[2] * 60 + +(match[3] ?? 0)) / 86400;
  }
  return null;
}

export function formatDate(serial: number): string {
  const p = serialToParts(serial);
  const hasDate = Math.floor(serial) !== 0;
  const hasTime = Math.abs(serial - Math.floor(serial)) > 1e-9;
  const datePart = `${pad(p.day)}/${pad(p.month)}/${p.year}`;
  const timePart = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  if (hasDate && hasTime) return `${datePart} ${timePart}`;
  return hasTime && !hasDate ? timePart : datePart;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const text = Number(value.toPrecision(15)).toString();
  return text.includes('e') ? value.toPrecision(15).replace(/\.?0+e/, 'E') : text;
}

export function toStr(value: VbaValue): string {
  const v = scalar(value);
  if (v === undefined || v === MISSING) return '';
  if (v === null) throw new VbaError(94, 'Dùng Null không hợp lệ');
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return formatNumber(v);
  if (v instanceof VbaDate) return formatDate(v.serial);
  if (v instanceof VbaArray) throw new VbaError(13, 'Không đổi được mảng thành chuỗi');
  return '';
}

export function tryNumber(value: VbaValue): number | null {
  const v = scalar(value);
  if (v === undefined || v === MISSING) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? -1 : 0;
  if (v instanceof VbaDate) return v.serial;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (/^&H[0-9a-f]+$/i.test(trimmed)) return parseInt(trimmed.slice(2), 16);
    const normalized = trimmed.replace(/,(?=\d{3}(\D|$))/g, '');
    const number = Number(normalized);
    if (Number.isFinite(number)) return number;
    const date = parseDateText(trimmed);
    return date;
  }
  return null;
}

export function toNumber(value: VbaValue): number {
  const number = tryNumber(value);
  if (number === null) {
    const v = scalar(value);
    if (v === null) throw new VbaError(94, 'Dùng Null không hợp lệ');
    throw new VbaError(13, `Kiểu không khớp: "${typeof v === 'string' ? v : String(v)}" không phải số`);
  }
  return number;
}

export function toBool(value: VbaValue): boolean {
  const v = scalar(value);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const lower = v.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return toNumber(v) !== 0;
}

export function bankersRound(value: number, digits = 0): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) rounded = floor % 2 === 0 ? floor : floor + 1;
  else rounded = Math.round(scaled);
  return rounded / factor;
}

export function toInteger(value: VbaValue): number {
  return bankersRound(toNumber(value));
}

export function typeNameOf(value: VbaValue): string {
  if (value === undefined) return 'Empty';
  if (value === null) return 'Null';
  if (value === NOTHING) return 'Nothing';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') return Number.isInteger(value) && Math.abs(value) < 2 ** 31 ? 'Long' : 'Double';
  if (value instanceof VbaDate) return 'Date';
  if (value instanceof VbaArray) return 'Variant()';
  if (value instanceof VbaObject) return value.typeName;
  return 'Variant';
}

export function likeToRegExp(pattern: string, ignoreCase: boolean): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*') source += '[\\s\\S]*';
    else if (char === '?') source += '[\\s\\S]';
    else if (char === '#') source += '\\d';
    else if (char === '[') {
      const close = pattern.indexOf(']', i);
      if (close < 0) {
        source += '\\[';
        continue;
      }
      let inner = pattern.slice(i + 1, close);
      const negate = inner.startsWith('!');
      if (negate) inner = inner.slice(1);
      source += `[${negate ? '^' : ''}${inner.replace(/[\\\]^]/g, '\\$&')}]`;
      i = close;
    } else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '');
}

export function compareValues(left: VbaValue, right: VbaValue, textCompare: boolean): number {
  const a = scalar(left);
  const b = scalar(right);
  if (a === null || b === null) return NaN;
  const aIsText = typeof a === 'string';
  const bIsText = typeof b === 'string';
  if (aIsText && bIsText) {
    const x = textCompare ? (a as string).toLowerCase() : (a as string);
    const y = textCompare ? (b as string).toLowerCase() : (b as string);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if ((aIsText && b === undefined) || (bIsText && a === undefined)) {
    const x = aIsText ? (a as string) : '';
    const y = bIsText ? (b as string) : '';
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = tryNumber(a);
  const y = tryNumber(b);
  if (x === null || y === null) {
    const sx = toStr(a);
    const sy = toStr(b);
    return sx < sy ? -1 : sx > sy ? 1 : 0;
  }
  return x < y ? -1 : x > y ? 1 : 0;
}

export function binaryOp(op: string, left: VbaValue, right: VbaValue, textCompare: boolean): VbaValue {
  if (op === 'is') return left === right || (left === NOTHING && right === NOTHING);
  const a = scalar(left);
  const b = scalar(right);
  switch (op) {
    case '&':
      if (a === null && b === null) return null;
      return toStr(a === null ? '' : a) + toStr(b === null ? '' : b);
    case '+':
      if (a === null || b === null) return null;
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (a instanceof VbaDate || b instanceof VbaDate) return new VbaDate(toNumber(a) + toNumber(b));
      return toNumber(a) + toNumber(b);
    case '-':
      if (a === null || b === null) return null;
      if (a instanceof VbaDate && !(b instanceof VbaDate)) return new VbaDate(toNumber(a) - toNumber(b));
      return toNumber(a) - toNumber(b);
    case '*':
      if (a === null || b === null) return null;
      return toNumber(a) * toNumber(b);
    case '/': {
      if (a === null || b === null) return null;
      const divisor = toNumber(b);
      if (divisor === 0) throw new VbaError(11, 'Chia cho 0');
      return toNumber(a) / divisor;
    }
    case '\\': {
      const divisor = toInteger(b);
      if (divisor === 0) throw new VbaError(11, 'Chia cho 0');
      return Math.trunc(toInteger(a) / divisor);
    }
    case 'mod': {
      const divisor = toInteger(b);
      if (divisor === 0) throw new VbaError(11, 'Chia cho 0');
      return toInteger(a) % divisor;
    }
    case '^':
      return Math.pow(toNumber(a), toNumber(b));
    case '=':
    case '<>':
    case '<':
    case '>':
    case '<=':
    case '>=': {
      if (a === null || b === null) return null;
      const result = compareValues(a, b, textCompare);
      if (op === '=') return result === 0;
      if (op === '<>') return result !== 0;
      if (op === '<') return result < 0;
      if (op === '>') return result > 0;
      if (op === '<=') return result <= 0;
      return result >= 0;
    }
    case 'like':
      return likeToRegExp(toStr(b), textCompare).test(toStr(a));
    case 'and':
    case 'or':
    case 'xor':
    case 'eqv':
    case 'imp': {
      if (typeof a === 'boolean' && typeof b === 'boolean') {
        if (op === 'and') return a && b;
        if (op === 'or') return a || b;
        if (op === 'xor') return a !== b;
        if (op === 'eqv') return a === b;
        return !a || b;
      }
      const x = toInteger(a);
      const y = toInteger(b);
      if (op === 'and') return x & y;
      if (op === 'or') return x | y;
      if (op === 'xor') return x ^ y;
      if (op === 'eqv') return ~(x ^ y);
      return ~x | y;
    }
    default:
      throw new VbaError(5, `Phép toán "${op}" chưa được hỗ trợ`);
  }
}

export function unaryOp(op: string, operand: VbaValue): VbaValue {
  const v = scalar(operand);
  if (op === 'not') {
    if (typeof v === 'boolean') return !v;
    if (v === null) return null;
    return ~toInteger(v);
  }
  if (v === null) return null;
  return -toNumber(v);
}

export class VbaCollection extends VbaObject {
  readonly typeName = 'Collection';
  private entries: Array<{ key: string | undefined; value: VbaValue }> = [];

  private indexOf(key: VbaValue): number {
    if (typeof key === 'string') {
      const index = this.entries.findIndex((entry) => entry.key?.toLowerCase() === key.toLowerCase());
      if (index < 0) throw new VbaError(5, `Không có phần tử khoá "${key}" trong Collection`);
      return index;
    }
    const position = toInteger(key) - 1;
    if (position < 0 || position >= this.entries.length) throw new VbaError(9, `Collection không có phần tử thứ ${position + 1}`);
    return position;
  }

  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'count':
        return this.entries.length;
      case 'add': {
        const value = arg(args, 0, 'item');
        const key = arg(args, 1, 'key');
        const keyText = isMissing(key) ? undefined : toStr(key);
        if (keyText && this.entries.some((entry) => entry.key?.toLowerCase() === keyText.toLowerCase())) throw new VbaError(457, `Khoá "${keyText}" đã có trong Collection`);
        const before = arg(args, 2, 'before');
        const after = arg(args, 3, 'after');
        const entry: { key: string | undefined; value: VbaValue } = { key: keyText, value };
        if (!isMissing(before)) this.entries.splice(this.indexOf(before), 0, entry);
        else if (!isMissing(after)) this.entries.splice(this.indexOf(after) + 1, 0, entry);
        else this.entries.push(entry);
        return undefined;
      }
      case 'item':
        return this.entries[this.indexOf(scalar(arg(args, 0)))].value;
      case 'remove':
        this.entries.splice(this.indexOf(scalar(arg(args, 0))), 1);
        return undefined;
      default:
        return super.get(name, args);
    }
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    return this.get('item', args);
  }

  items(): VbaValue[] {
    return this.entries.map((entry) => entry.value);
  }
}

export class VbaDictionary extends VbaObject {
  readonly typeName = 'Dictionary';
  private map = new Map<string, { key: VbaValue; value: VbaValue }>();
  compareMode = 0;

  private keyOf(key: VbaValue): string {
    const v = scalar(key);
    const text = typeof v === 'number' ? `n:${v}` : `s:${toStr(v)}`;
    return this.compareMode === 1 ? text.toLowerCase() : text;
  }

  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'count':
        return this.map.size;
      case 'add': {
        const key = arg(args, 0, 'key');
        const id = this.keyOf(key);
        if (this.map.has(id)) throw new VbaError(457, `Khoá "${toStr(key)}" đã có trong Dictionary`);
        this.map.set(id, { key: scalar(key), value: arg(args, 1, 'item') });
        return undefined;
      }
      case 'exists':
        return this.map.has(this.keyOf(arg(args, 0)));
      case 'item':
        return this.map.get(this.keyOf(arg(args, 0)))?.value;
      case 'keys':
        return VbaArray.fromList([...this.map.values()].map((entry) => entry.key));
      case 'items':
        return VbaArray.fromList([...this.map.values()].map((entry) => entry.value));
      case 'remove': {
        const id = this.keyOf(arg(args, 0));
        if (!this.map.delete(id)) throw new VbaError(32811, 'Khoá không có trong Dictionary');
        return undefined;
      }
      case 'removeall':
        this.map.clear();
        return undefined;
      case 'comparemode':
        return this.compareMode;
      default:
        return super.get(name, args);
    }
  }

  set(name: string, args: VbaArgs, value: VbaValue): boolean {
    if (name === 'item') {
      this.defaultSet(args, value);
      return true;
    }
    if (name === 'comparemode') {
      this.compareMode = toInteger(value);
      return true;
    }
    return false;
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    const id = this.keyOf(arg(args, 0));
    if (!this.map.has(id)) this.map.set(id, { key: scalar(arg(args, 0)), value: undefined });
    return this.map.get(id)?.value;
  }

  defaultSet(args: VbaArgs, value: VbaValue) {
    const key = arg(args, 0);
    this.map.set(this.keyOf(key), { key: scalar(key), value });
  }

  items(): VbaValue[] {
    return [...this.map.values()].map((entry) => entry.key);
  }
}

export class VbaErrObject extends VbaObject {
  readonly typeName = 'ErrObject';
  number = 0;
  description = '';
  source = '';

  capture(error: VbaError) {
    this.number = error.number;
    this.description = error.message;
    this.source = error.source;
  }

  clear() {
    this.number = 0;
    this.description = '';
    this.source = '';
  }

  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'number':
        return this.number;
      case 'description':
        return this.description;
      case 'source':
        return this.source;
      case 'clear':
        this.clear();
        return undefined;
      case 'raise': {
        const number = toInteger(arg(args, 0, 'number'));
        const description = arg(args, 2, 'description');
        const error = new VbaError(number, isMissing(description) ? `Lỗi ${number}` : toStr(description));
        const source = arg(args, 1, 'source');
        if (!isMissing(source)) error.source = toStr(source);
        throw error;
      }
      default:
        return super.get(name, args);
    }
  }

  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    if (name === 'number') this.number = toInteger(value);
    else if (name === 'description') this.description = toStr(value);
    else if (name === 'source') this.source = toStr(value);
    else return false;
    return true;
  }

  defaultGet(): VbaValue {
    return this.number;
  }
}

export function vbaColorToHex(color: number): string {
  const value = Math.max(0, Math.trunc(color)) & 0xffffff;
  const r = value & 0xff;
  const g = (value >> 8) & 0xff;
  const b = (value >> 16) & 0xff;
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToVbaColor(hex: string | undefined): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match) return 0;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return r + g * 256 + b * 65536;
}

export const COLOR_INDEX = [
  0x000000, 0xffffff, 0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0x800000, 0x008000, 0x000080, 0x808000, 0x800080, 0x008080, 0xc0c0c0, 0x808080,
  0x9999ff, 0x993366, 0xffffcc, 0xccffff, 0x660066, 0xff8080, 0x0066cc, 0xccccff, 0x000080, 0xff00ff, 0xffff00, 0x00ffff, 0x800080, 0x800000, 0x008080, 0x0000ff,
  0x00ccff, 0xccffff, 0xccffcc, 0xffff99, 0x99ccff, 0xff99cc, 0xcc99ff, 0xffcc99, 0x3366ff, 0x33cccc, 0x99cc00, 0xffcc00, 0xff9900, 0xff6600, 0x666699, 0x969696,
  0x003366, 0x339966, 0x003300, 0x333300, 0x993300, 0x993366, 0x333399, 0x333333,
];

export function colorIndexToHex(index: number): string | null {
  const rgb = COLOR_INDEX[index - 1];
  return rgb === undefined ? null : `#${rgb.toString(16).padStart(6, '0')}`;
}
