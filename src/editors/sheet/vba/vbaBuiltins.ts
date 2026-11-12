import {
  MISSING,
  NOTHING,
  VbaArray,
  VbaDate,
  VbaError,
  VbaObject,
  arg,
  bankersRound,
  dateToSerial,
  formatDate,
  isMissing,
  parseDateText,
  partsToSerial,
  scalar,
  serialToParts,
  toBool,
  toInteger,
  toNumber,
  toStr,
  tryNumber,
  typeNameOf,
  type VbaArgs,
  type VbaValue,
} from './vbaRuntime';

export interface BuiltinContext {
  msgBox(prompt: string, buttons: number, title: string): number;
  inputBox(prompt: string, title: string, defaultValue: string): string;
  textCompare: boolean;
  random(): number;
}

type Builtin = (args: VbaArgs, context: BuiltinContext) => VbaValue;

const num = (args: VbaArgs, index: number, name?: string) => toNumber(arg(args, index, name));
const int = (args: VbaArgs, index: number, name?: string) => toInteger(arg(args, index, name));
const str = (args: VbaArgs, index: number, name?: string) => toStr(arg(args, index, name));
const optional = (args: VbaArgs, index: number, name?: string) => {
  const value = arg(args, index, name);
  return isMissing(value) ? undefined : value;
};

const toSerial = (value: VbaValue): number => {
  const v = scalar(value);
  if (v instanceof VbaDate) return v.serial;
  if (typeof v === 'string') {
    const parsed = parseDateText(v);
    if (parsed === null) throw new VbaError(13, `"${v}" không phải ngày tháng`);
    return parsed;
  }
  return toNumber(v);
};

const pad = (value: number, length = 2) => String(value).padStart(length, '0');
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDatePattern(serial: number, pattern: string): string {
  const p = serialToParts(serial);
  const hasHour = /h/i.test(pattern);
  return pattern.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|nn|n|ss|s|AM\/PM|am\/pm/gi, (token, offset: number) => {
    const lower = token.toLowerCase();
    const before = pattern.slice(0, offset);
    const minuteContext = hasHour && /h[^dmy]*$/i.test(before);
    switch (lower) {
      case 'yyyy':
        return String(p.year);
      case 'yy':
        return pad(p.year % 100);
      case 'mmmm':
        return MONTH_NAMES[p.month - 1];
      case 'mmm':
        return MONTH_NAMES[p.month - 1].slice(0, 3);
      case 'mm':
        return minuteContext ? pad(p.minute) : pad(p.month);
      case 'm':
        return minuteContext ? String(p.minute) : String(p.month);
      case 'dddd':
        return DAY_NAMES[p.weekday - 1];
      case 'ddd':
        return DAY_NAMES[p.weekday - 1].slice(0, 3);
      case 'dd':
        return pad(p.day);
      case 'd':
        return String(p.day);
      case 'hh':
        return pad(/am\/pm/i.test(pattern) ? ((p.hour + 11) % 12) + 1 : p.hour);
      case 'h':
        return String(/am\/pm/i.test(pattern) ? ((p.hour + 11) % 12) + 1 : p.hour);
      case 'nn':
        return pad(p.minute);
      case 'n':
        return String(p.minute);
      case 'ss':
        return pad(p.second);
      case 's':
        return String(p.second);
      default:
        return p.hour < 12 ? (token[0] === 'A' ? 'AM' : 'am') : token[0] === 'A' ? 'PM' : 'pm';
    }
  });
}

function formatNumberPattern(value: number, pattern: string): string {
  const sections = pattern.split(';');
  let section = sections[0];
  let number = value;
  if (value < 0 && sections[1]) {
    section = sections[1];
    number = Math.abs(value);
  } else if (value === 0 && sections[2]) section = sections[2];
  if (section.includes('%')) number *= 100;
  const first = section.search(/[#0]/);
  const last = Math.max(section.lastIndexOf('#'), section.lastIndexOf('0'));
  if (first < 0) return section.replace(/["\\]/g, '');
  const spec = section.slice(first, last + 1);
  const [integerPart, decimals = ''] = spec.split('.');
  const minDecimals = (decimals.match(/0/g) ?? []).length;
  const maxDecimals = decimals.length;
  const grouping = integerPart.includes(',');
  const minInteger = (integerPart.match(/0/g) ?? []).length;
  let text = Math.abs(number).toFixed(maxDecimals);
  if (maxDecimals > minDecimals) text = text.replace(new RegExp(`0{1,${maxDecimals - minDecimals}}$`), '').replace(/\.$/, '');
  let [whole, fraction] = text.split('.');
  if (whole === '0' && minInteger === 0) whole = '';
  whole = whole.padStart(minInteger, '0');
  if (grouping) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `${number < 0 ? '-' : ''}${whole || (fraction ? '' : '0')}${fraction ? `.${fraction}` : ''}`;
  return `${section.slice(0, first).replace(/["\\]/g, '')}${body}${section.slice(last + 1).replace(/["\\]/g, '')}`;
}

export function vbaFormat(value: VbaValue, pattern: string | undefined): string {
  const v = scalar(value);
  if (!pattern) return toStr(v);
  const named = pattern.toLowerCase();
  if (v instanceof VbaDate || (typeof v === 'string' && parseDateText(v) !== null && Number.isNaN(Number(v)))) {
    const serial = toSerial(v);
    if (named === 'general date') return formatDate(serial);
    if (named === 'short date') return formatDatePattern(serial, 'dd/mm/yyyy');
    if (named === 'long date') return formatDatePattern(serial, 'dddd, d mmmm yyyy');
    if (named === 'short time') return formatDatePattern(serial, 'hh:nn');
    if (named === 'long time') return formatDatePattern(serial, 'hh:nn:ss');
    return formatDatePattern(serial, pattern);
  }
  const number = tryNumber(v);
  if (number === null) return toStr(v);
  if (named === 'general number') return toStr(number);
  if (named === 'fixed') return formatNumberPattern(number, '0.00');
  if (named === 'standard') return formatNumberPattern(number, '#,##0.00');
  if (named === 'percent') return formatNumberPattern(number, '0.00%');
  if (named === 'currency') return formatNumberPattern(number, '#,##0.00');
  if (named === 'yes/no') return number !== 0 ? 'Yes' : 'No';
  if (named === 'true/false') return number !== 0 ? 'True' : 'False';
  if (/[dmyhns]/i.test(pattern) && !/[#0]/.test(pattern)) return formatDatePattern(number, pattern);
  return formatNumberPattern(number, pattern);
}

const flatten = (value: VbaValue): VbaValue[] => {
  if (value instanceof VbaArray) return value.data;
  if (value instanceof VbaObject) {
    const inner = value.defaultGet({ values: [], names: [] });
    return inner instanceof VbaArray ? inner.data : [inner];
  }
  return [value];
};

const dateAddUnit = (unit: string, amount: number, serial: number): number => {
  const p = serialToParts(serial);
  const time = serial - Math.floor(serial);
  switch (unit.toLowerCase()) {
    case 'yyyy':
      return partsToSerial(p.year + amount, p.month, p.day) + time;
    case 'q':
      return partsToSerial(p.year, p.month + amount * 3, p.day) + time;
    case 'm':
      return partsToSerial(p.year, p.month + amount, p.day) + time;
    case 'd':
    case 'y':
    case 'w':
      return serial + amount;
    case 'ww':
      return serial + amount * 7;
    case 'h':
      return serial + amount / 24;
    case 'n':
      return serial + amount / 1440;
    case 's':
      return serial + amount / 86400;
    default:
      throw new VbaError(5, `Đơn vị DateAdd "${unit}" không hợp lệ`);
  }
};

const dateDiffUnit = (unit: string, from: number, to: number): number => {
  const a = serialToParts(from);
  const b = serialToParts(to);
  switch (unit.toLowerCase()) {
    case 'yyyy':
      return b.year - a.year;
    case 'q':
      return (b.year - a.year) * 4 + Math.floor((b.month - 1) / 3) - Math.floor((a.month - 1) / 3);
    case 'm':
      return (b.year - a.year) * 12 + b.month - a.month;
    case 'd':
    case 'y':
      return Math.floor(to) - Math.floor(from);
    case 'w':
    case 'ww':
      return Math.trunc((Math.floor(to) - Math.floor(from)) / 7);
    case 'h':
      return Math.trunc((to - from) * 24);
    case 'n':
      return Math.trunc((to - from) * 1440);
    case 's':
      return Math.round((to - from) * 86400);
    default:
      throw new VbaError(5, `Đơn vị DateDiff "${unit}" không hợp lệ`);
  }
};

const instr = (args: VbaArgs, context: BuiltinContext): number => {
  let start = 1;
  let offset = 0;
  if (args.values.length >= 3 && tryNumber(scalar(arg(args, 0))) !== null && typeof scalar(arg(args, 0)) === 'number') {
    start = int(args, 0);
    offset = 1;
  }
  const haystack = str(args, offset);
  const needle = str(args, offset + 1);
  const compare = optional(args, offset + 2, 'compare');
  const textMode = compare === undefined ? context.textCompare : toInteger(compare) === 1;
  if (start < 1) throw new VbaError(5, 'InStr: vị trí bắt đầu phải >= 1');
  if (!needle) return start <= haystack.length + 1 ? start : 0;
  const source = textMode ? haystack.toLowerCase() : haystack;
  const target = textMode ? needle.toLowerCase() : needle;
  return source.indexOf(target, start - 1) + 1;
};

export const BUILTINS: Record<string, Builtin> = {
  msgbox: (args, context) => context.msgBox(str(args, 0, 'prompt'), isMissing(arg(args, 1, 'buttons')) ? 0 : int(args, 1, 'buttons'), isMissing(arg(args, 2, 'title')) ? 'Minh Sheets' : str(args, 2, 'title')),
  inputbox: (args, context) => context.inputBox(str(args, 0, 'prompt'), isMissing(arg(args, 1, 'title')) ? 'Minh Sheets' : str(args, 1, 'title'), isMissing(arg(args, 2, 'default')) ? '' : str(args, 2, 'default')),
  len: (args) => {
    const value = scalar(arg(args, 0));
    return value === null ? null : toStr(value).length;
  },
  left: (args) => str(args, 0).slice(0, Math.max(0, int(args, 1))),
  right: (args) => {
    const text = str(args, 0);
    const count = Math.max(0, int(args, 1));
    return count ? text.slice(-count) : '';
  },
  mid: (args) => {
    const text = str(args, 0);
    const start = int(args, 1);
    if (start < 1) throw new VbaError(5, 'Mid: vị trí bắt đầu phải >= 1');
    const length = optional(args, 2);
    return length === undefined ? text.slice(start - 1) : text.substr(start - 1, Math.max(0, toInteger(length)));
  },
  instr,
  instrrev: (args, context) => {
    const haystack = str(args, 0);
    const needle = str(args, 1);
    const startValue = optional(args, 2);
    const start = startValue === undefined ? -1 : toInteger(startValue);
    const textMode = optional(args, 3) === undefined ? context.textCompare : toInteger(arg(args, 3)) === 1;
    const source = textMode ? haystack.toLowerCase() : haystack;
    const target = textMode ? needle.toLowerCase() : needle;
    return source.lastIndexOf(target, start < 0 ? undefined : start - target.length) + 1;
  },
  ucase: (args) => str(args, 0).toUpperCase(),
  lcase: (args) => str(args, 0).toLowerCase(),
  trim: (args) => str(args, 0).replace(/^ +| +$/g, ''),
  ltrim: (args) => str(args, 0).replace(/^ +/, ''),
  rtrim: (args) => str(args, 0).replace(/ +$/, ''),
  space: (args) => ' '.repeat(Math.max(0, int(args, 0))),
  string: (args) => {
    const char = scalar(arg(args, 1));
    return (typeof char === 'number' ? String.fromCharCode(char) : toStr(char).charAt(0)).repeat(Math.max(0, int(args, 0)));
  },
  strreverse: (args) => [...str(args, 0)].reverse().join(''),
  replace: (args, context) => {
    const text = str(args, 0);
    const find = str(args, 1);
    const replacement = str(args, 2);
    if (!find) return text;
    const start = optional(args, 3, 'start');
    const count = optional(args, 4, 'count');
    const compare = optional(args, 5, 'compare');
    const textMode = compare === undefined ? context.textCompare : toInteger(compare) === 1;
    const base = start === undefined ? text : text.slice(toInteger(start) - 1);
    let remaining = count === undefined ? -1 : toInteger(count);
    const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), textMode ? 'gi' : 'g');
    return base.replace(pattern, (match) => {
      if (remaining === 0) return match;
      remaining -= 1;
      return replacement;
    });
  },
  split: (args) => {
    const text = str(args, 0);
    const delimiterValue = optional(args, 1);
    const delimiter = delimiterValue === undefined ? ' ' : toStr(delimiterValue);
    const limitValue = optional(args, 2);
    if (!text) return new VbaArray([{ lb: 0, ub: -1 }]);
    let parts = delimiter ? text.split(delimiter) : [text];
    if (limitValue !== undefined && toInteger(limitValue) > 0 && parts.length > toInteger(limitValue)) {
      const limit = toInteger(limitValue);
      parts = [...parts.slice(0, limit - 1), parts.slice(limit - 1).join(delimiter)];
    }
    return VbaArray.fromList(parts);
  },
  join: (args) => {
    const source = arg(args, 0);
    if (!(source instanceof VbaArray)) throw new VbaError(13, 'Join cần một mảng');
    const delimiterValue = optional(args, 1);
    return source.data.map((item) => toStr(item)).join(delimiterValue === undefined ? ' ' : toStr(delimiterValue));
  },
  strcomp: (args, context) => {
    const compare = optional(args, 2);
    const textMode = compare === undefined ? context.textCompare : toInteger(compare) === 1;
    const a = textMode ? str(args, 0).toLowerCase() : str(args, 0);
    const b = textMode ? str(args, 1).toLowerCase() : str(args, 1);
    return a < b ? -1 : a > b ? 1 : 0;
  },
  strconv: (args) => {
    const text = str(args, 0);
    const mode = int(args, 1);
    if (mode === 1) return text.toUpperCase();
    if (mode === 2) return text.toLowerCase();
    if (mode === 3) return text.toLowerCase().replace(/(^|\s)(\S)/g, (_, space: string, char: string) => space + char.toUpperCase());
    return text;
  },
  chr: (args) => String.fromCharCode(int(args, 0)),
  chrw: (args) => String.fromCharCode(int(args, 0)),
  asc: (args) => {
    const text = str(args, 0);
    if (!text) throw new VbaError(5, 'Asc: chuỗi rỗng');
    return text.charCodeAt(0);
  },
  ascw: (args) => str(args, 0).charCodeAt(0),
  cstr: (args) => str(args, 0),
  cint: (args) => int(args, 0),
  clng: (args) => int(args, 0),
  clnglng: (args) => int(args, 0),
  cbyte: (args) => int(args, 0),
  cdbl: (args) => num(args, 0),
  csng: (args) => num(args, 0),
  ccur: (args) => bankersRound(num(args, 0), 4),
  cdec: (args) => num(args, 0),
  cbool: (args) => toBool(arg(args, 0)),
  cdate: (args) => new VbaDate(toSerial(arg(args, 0))),
  cvar: (args) => scalar(arg(args, 0)),
  val: (args) => {
    const match = /^\s*[+-]?(\d[\d\s]*)?(\.\d*)?([eE][+-]?\d+)?/.exec(str(args, 0));
    const text = (match?.[0] ?? '').replace(/\s/g, '');
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  },
  str: (args) => {
    const number = num(args, 0);
    return number >= 0 ? ` ${toStr(number)}` : toStr(number);
  },
  format: (args) => {
    const pattern = optional(args, 1);
    return vbaFormat(arg(args, 0), pattern === undefined ? undefined : toStr(pattern));
  },
  formatnumber: (args) => {
    const digits = optional(args, 1);
    const count = digits === undefined ? 2 : toInteger(digits);
    return vbaFormat(num(args, 0), `#,##0${count > 0 ? `.${'0'.repeat(count)}` : ''}`);
  },
  formatpercent: (args) => {
    const digits = optional(args, 1);
    const count = digits === undefined ? 2 : toInteger(digits);
    return vbaFormat(num(args, 0), `0${count > 0 ? `.${'0'.repeat(count)}` : ''}%`);
  },
  formatcurrency: (args) => vbaFormat(num(args, 0), '#,##0.00'),
  formatdatetime: (args) => {
    const style = optional(args, 1);
    const names = ['General Date', 'Long Date', 'Short Date', 'Long Time', 'Short Time'];
    return vbaFormat(new VbaDate(toSerial(arg(args, 0))), names[style === undefined ? 0 : toInteger(style)] ?? 'General Date');
  },
  isnumeric: (args) => {
    const value = scalar(arg(args, 0));
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    if (typeof value !== 'string' || !value.trim()) return false;
    return Number.isFinite(Number(value.trim().replace(/,(?=\d{3}(\D|$))/g, '')));
  },
  isempty: (args) => {
    const raw = arg(args, 0);
    const value = raw instanceof VbaObject ? scalar(raw) : raw;
    return value === undefined;
  },
  isnull: (args) => scalar(arg(args, 0)) === null,
  isdate: (args) => {
    const value = scalar(arg(args, 0));
    return value instanceof VbaDate || (typeof value === 'string' && parseDateText(value) !== null);
  },
  isarray: (args) => arg(args, 0) instanceof VbaArray,
  isobject: (args) => {
    const value = arg(args, 0);
    return value instanceof VbaObject || value === NOTHING;
  },
  ismissing: (args) => args.values[0] === MISSING || args.values[0] === undefined,
  iserror: () => false,
  typename: (args) => typeNameOf(arg(args, 0)),
  vartype: (args) => {
    const value = arg(args, 0);
    if (value === undefined) return 0;
    if (value === null) return 1;
    if (typeof value === 'number') return Number.isInteger(value) ? 3 : 5;
    if (value instanceof VbaDate) return 7;
    if (typeof value === 'string') return 8;
    if (typeof value === 'boolean') return 11;
    if (value instanceof VbaArray) return 8204;
    return 9;
  },
  now: () => new VbaDate(dateToSerial(new Date())),
  date: () => new VbaDate(Math.floor(dateToSerial(new Date()))),
  time: () => {
    const serial = dateToSerial(new Date());
    return new VbaDate(serial - Math.floor(serial));
  },
  timer: () => {
    const now = new Date();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  },
  dateserial: (args) => new VbaDate(partsToSerial(int(args, 0), int(args, 1), int(args, 2))),
  timeserial: (args) => new VbaDate((int(args, 0) * 3600 + int(args, 1) * 60 + int(args, 2)) / 86400),
  datevalue: (args) => new VbaDate(Math.floor(toSerial(arg(args, 0)))),
  timevalue: (args) => {
    const serial = toSerial(arg(args, 0));
    return new VbaDate(serial - Math.floor(serial));
  },
  year: (args) => serialToParts(toSerial(arg(args, 0))).year,
  month: (args) => serialToParts(toSerial(arg(args, 0))).month,
  day: (args) => serialToParts(toSerial(arg(args, 0))).day,
  hour: (args) => serialToParts(toSerial(arg(args, 0))).hour,
  minute: (args) => serialToParts(toSerial(arg(args, 0))).minute,
  second: (args) => serialToParts(toSerial(arg(args, 0))).second,
  weekday: (args) => {
    const first = optional(args, 1);
    const weekday = serialToParts(toSerial(arg(args, 0))).weekday;
    const start = first === undefined ? 1 : toInteger(first) || 1;
    return ((weekday - start + 7) % 7) + 1;
  },
  monthname: (args) => {
    const name = MONTH_NAMES[int(args, 0) - 1] ?? '';
    return toBool(optional(args, 1) ?? false) ? name.slice(0, 3) : name;
  },
  weekdayname: (args) => {
    const name = DAY_NAMES[int(args, 0) - 1] ?? '';
    return toBool(optional(args, 1) ?? false) ? name.slice(0, 3) : name;
  },
  dateadd: (args) => new VbaDate(dateAddUnit(str(args, 0), num(args, 1), toSerial(arg(args, 2)))),
  datediff: (args) => dateDiffUnit(str(args, 0), toSerial(arg(args, 1)), toSerial(arg(args, 2))),
  datepart: (args) => {
    const unit = str(args, 0).toLowerCase();
    const parts = serialToParts(toSerial(arg(args, 1)));
    const map: Record<string, number> = { yyyy: parts.year, m: parts.month, d: parts.day, h: parts.hour, n: parts.minute, s: parts.second, w: parts.weekday, q: Math.floor((parts.month - 1) / 3) + 1 };
    if (!(unit in map)) throw new VbaError(5, `Đơn vị DatePart "${unit}" không hợp lệ`);
    return map[unit];
  },
  abs: (args) => Math.abs(num(args, 0)),
  sgn: (args) => Math.sign(num(args, 0)),
  int: (args) => Math.floor(num(args, 0)),
  fix: (args) => Math.trunc(num(args, 0)),
  round: (args) => {
    const digits = optional(args, 1);
    return bankersRound(num(args, 0), digits === undefined ? 0 : toInteger(digits));
  },
  sqr: (args) => {
    const value = num(args, 0);
    if (value < 0) throw new VbaError(5, 'Sqr: không lấy căn số âm');
    return Math.sqrt(value);
  },
  exp: (args) => Math.exp(num(args, 0)),
  log: (args) => {
    const value = num(args, 0);
    if (value <= 0) throw new VbaError(5, 'Log: đối số phải > 0');
    return Math.log(value);
  },
  sin: (args) => Math.sin(num(args, 0)),
  cos: (args) => Math.cos(num(args, 0)),
  tan: (args) => Math.tan(num(args, 0)),
  atn: (args) => Math.atan(num(args, 0)),
  rnd: (_args, context) => context.random(),
  randomize: () => undefined,
  hex: (args) => (int(args, 0) >>> 0).toString(16).toUpperCase(),
  oct: (args) => (int(args, 0) >>> 0).toString(8),
  rgb: (args) => (int(args, 0) & 0xff) + (int(args, 1) & 0xff) * 256 + (int(args, 2) & 0xff) * 65536,
  qbcolor: (args) => [0, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080, 0xc0c0c0, 0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff][int(args, 0)] ?? 0,
  iif: (args) => (toBool(arg(args, 0)) ? arg(args, 1) : arg(args, 2)),
  choose: (args) => {
    const index = int(args, 0);
    return index >= 1 && index < args.values.length ? args.values[index] : null;
  },
  switch: (args) => {
    for (let i = 0; i + 1 < args.values.length; i += 2) if (toBool(args.values[i])) return args.values[i + 1];
    return null;
  },
  nz: (args) => {
    const value = scalar(arg(args, 0));
    return value === null || value === undefined ? (optional(args, 1) ?? '') : value;
  },
  array: (args) => VbaArray.fromList(args.values.map((value) => (value === MISSING ? undefined : value))),
  ubound: (args) => {
    const source = arg(args, 0);
    if (!(source instanceof VbaArray)) throw new VbaError(13, 'UBound cần một mảng');
    const dimension = optional(args, 1);
    const bound = source.bounds[(dimension === undefined ? 1 : toInteger(dimension)) - 1];
    if (!bound) throw new VbaError(9, 'Mảng không có chiều này');
    return bound.ub;
  },
  lbound: (args) => {
    const source = arg(args, 0);
    if (!(source instanceof VbaArray)) throw new VbaError(13, 'LBound cần một mảng');
    const dimension = optional(args, 1);
    const bound = source.bounds[(dimension === undefined ? 1 : toInteger(dimension)) - 1];
    if (!bound) throw new VbaError(9, 'Mảng không có chiều này');
    return bound.lb;
  },
  filter: (args) => {
    const source = arg(args, 0);
    if (!(source instanceof VbaArray)) throw new VbaError(13, 'Filter cần một mảng');
    const match = str(args, 1);
    const include = optional(args, 2) === undefined ? true : toBool(arg(args, 2));
    return VbaArray.fromList(source.data.filter((item) => toStr(item).includes(match) === include));
  },
  environ: () => '',
  beep: () => undefined,
  doevents: () => 0,
  sum: (args) => args.values.flatMap(flatten).reduce<number>((total, value) => total + (tryNumber(value) ?? 0), 0),
};

export const CONSTANTS: Record<string, VbaValue> = {
  true: true,
  false: false,
  nothing: NOTHING,
  empty: undefined,
  null: null,
  vbcrlf: '\r\n',
  vbnewline: '\r\n',
  vbcr: '\r',
  vblf: '\n',
  vbtab: '\t',
  vbnullstring: '',
  vbnullchar: '\0',
  vbokonly: 0,
  vbokcancel: 1,
  vbabortretryignore: 2,
  vbyesnocancel: 3,
  vbyesno: 4,
  vbretrycancel: 5,
  vbcritical: 16,
  vbquestion: 32,
  vbexclamation: 48,
  vbinformation: 64,
  vbdefaultbutton1: 0,
  vbdefaultbutton2: 256,
  vbok: 1,
  vbcancel: 2,
  vbabort: 3,
  vbretry: 4,
  vbignore: 5,
  vbyes: 6,
  vbno: 7,
  vbbinarycompare: 0,
  vbtextcompare: 1,
  vbuppercase: 1,
  vblowercase: 2,
  vbpropercase: 3,
  vbblack: 0,
  vbred: 255,
  vbgreen: 65280,
  vbyellow: 65535,
  vbblue: 16711680,
  vbmagenta: 16711935,
  vbcyan: 16776960,
  vbwhite: 16777215,
  vbsunday: 1,
  vbmonday: 2,
  vbtuesday: 3,
  vbwednesday: 4,
  vbthursday: 5,
  vbfriday: 6,
  vbsaturday: 7,
  vbobjecterror: -2147221504,
  vbempty: 0,
  vbinteger: 2,
  vblong: 3,
  vbdouble: 5,
  vbstring: 8,
  vbboolean: 11,
  vbdate: 7,
  xlup: -4162,
  xldecimalseparator: 3,
  vbmodeless: 0,
  vbmodal: 1,
  vbformcontrolmenu: 0,
  vbformcode: 1,
  vbappwindows: 2,
  vbapptaskmanager: 3,
  fmmultiselectsingle: 0,
  fmmultiselectmulti: 1,
  fmmultiselectextended: 2,
  fmstyledropdowncombo: 0,
  fmstyledropdownlist: 2,
  xlthousandsseparator: 4,
  xllistseparator: 5,
  xldown: -4121,
  xltoleft: -4159,
  xltoright: -4161,
  xlleft: -4131,
  xlright: -4152,
  xlcenter: -4108,
  xlgeneral: 1,
  xljustify: -4130,
  xltop: -4160,
  xlbottom: -4107,
  xlnone: -4142,
  xlautomatic: -4105,
  xlcontinuous: 1,
  xldash: -4115,
  xldot: -4118,
  xldouble: -4119,
  xllinestylenone: -4142,
  xlthin: 2,
  xlmedium: -4138,
  xlthick: 4,
  xlhairline: 1,
  xledgeleft: 7,
  xledgetop: 8,
  xledgebottom: 9,
  xledgeright: 10,
  xlinsidevertical: 11,
  xlinsidehorizontal: 12,
  xldiagonaldown: 5,
  xldiagonalup: 6,
  xlshiftdown: -4121,
  xlshifttoright: -4161,
  xlshiftup: -4162,
  xlshifttoleft: -4159,
  xlcalculationmanual: -4135,
  xlcalculationautomatic: -4105,
  xlcalculationsemiautomatic: 2,
  xlvalues: -4163,
  xlformulas: -4123,
  xlpastevalues: -4163,
  xlpasteformats: -4122,
  xlpasteall: -4104,
  xlwhole: 1,
  xlpart: 2,
  xlbyrows: 1,
  xlbycolumns: 2,
  xlnext: 1,
  xlprevious: 2,
  xlascending: 1,
  xldescending: 2,
  xlyes: 1,
  xlno: 2,
  xlguess: 0,
  xlsheetvisible: -1,
  xlsheethidden: 0,
  xlsheetveryhidden: 2,
  xlunderlinestylesingle: 2,
  xlunderlinestylenone: -4142,
  xlnormal: -4143,
  xlopenxmlworkbook: 51,
  xlopenxmlworkbookmacroenabled: 52,
  xlwait: 2,
  xldefault: -4143,
  msoTrue: -1,
  msoFalse: 0,
};

for (const key of Object.keys(CONSTANTS)) {
  const lower = key.toLowerCase();
  if (lower !== key) {
    CONSTANTS[lower] = CONSTANTS[key];
    delete CONSTANTS[key];
  }
}
