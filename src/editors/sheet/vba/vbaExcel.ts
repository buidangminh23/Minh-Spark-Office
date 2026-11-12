import { BorderStyleTypes, BorderType, Dimension } from '@univerjs/presets';
import {
  NOTHING,
  VbaArray,
  VbaDate,
  VbaError,
  VbaObject,
  arg,
  colorIndexToHex,
  compareValues,
  hexToVbaColor,
  isMissing,
  scalar,
  toBool,
  toInteger,
  toNumber,
  toStr,
  tryNumber,
  vbaColorToHex,
  type VbaArgs,
  type VbaValue,
} from './vbaRuntime';
import { vbaFormat } from './vbaBuiltins';
import { cellFontCss, measureTextWithCanvas, CELL_TEXT_PADDING_PX, DEFAULT_CELL_FONT_FAMILY, DEFAULT_CELL_FONT_SIZE_PT } from '../autoFitColumn';

type Facade = any;

export interface Box4 {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface ExcelHostCallbacks {
  msgBox(prompt: string, buttons: number, title: string): number;
  inputBox(prompt: string, title: string, defaultValue: string): string;
  statusBar(text: string): void;
  save(): void;
}

const MAX_SCAN = 200_000;
const ALIGN_TO_UNIVER: Record<number, number> = { [-4131]: 1, [-4108]: 2, [-4152]: 3, 1: 0, [-4130]: 4, 7: 2 };
const ALIGN_FROM_UNIVER: Record<number, number> = { 0: 1, 1: -4131, 2: -4108, 3: -4152, 4: -4130 };
const VALIGN_TO_UNIVER: Record<number, number> = { [-4160]: 1, [-4108]: 2, [-4107]: 3 };
const VALIGN_FROM_UNIVER: Record<number, number> = { 0: -4107, 1: -4160, 2: -4108, 3: -4107 };

export const colLabel = (index: number): string => {
  let text = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) text = String.fromCharCode(65 + ((value - 1) % 26)) + text;
  return text;
};

const colIndex = (letters: string): number => {
  let result = 0;
  for (const char of letters.toUpperCase()) result = result * 26 + (char.charCodeAt(0) - 64);
  return result - 1;
};

export function parseAddress(text: string, maxRows: number, maxColumns: number): { sheet?: string; box: Box4 } | null {
  let raw = text.trim();
  let sheet: string | undefined;
  const bang = raw.lastIndexOf('!');
  if (bang > 0) {
    sheet = raw.slice(0, bang).replace(/^'|'$/g, '');
    raw = raw.slice(bang + 1);
  }
  raw = raw.split(',')[0].replace(/\$/g, '').toUpperCase().trim();
  const parts = raw.split(':');
  if (parts.length > 2) return null;
  const parsePart = (part: string) => {
    const cell = /^([A-Z]{1,3})(\d+)$/.exec(part);
    if (cell) return { r: Number(cell[2]) - 1, c: colIndex(cell[1]), kind: 'cell' as const };
    if (/^[A-Z]{1,3}$/.test(part)) return { r: -1, c: colIndex(part), kind: 'col' as const };
    if (/^\d+$/.test(part)) return { r: Number(part) - 1, c: -1, kind: 'row' as const };
    return null;
  };
  const first = parsePart(parts[0]);
  const second = parts[1] ? parsePart(parts[1]) : first;
  if (!first || !second || first.kind !== second.kind) return null;
  if (first.kind === 'col') return { sheet, box: { r0: 0, r1: maxRows - 1, c0: Math.min(first.c, second.c), c1: Math.max(first.c, second.c) } };
  if (first.kind === 'row') return { sheet, box: { r0: Math.min(first.r, second.r), r1: Math.max(first.r, second.r), c0: 0, c1: maxColumns - 1 } };
  return { sheet, box: { r0: Math.min(first.r, second.r), r1: Math.max(first.r, second.r), c0: Math.min(first.c, second.c), c1: Math.max(first.c, second.c) } };
}

export function boxAddress(box: Box4, rowAbsolute = true, columnAbsolute = true): string {
  const cell = (r: number, c: number) => `${columnAbsolute ? '$' : ''}${colLabel(c)}${rowAbsolute ? '$' : ''}${r + 1}`;
  const start = cell(box.r0, box.c0);
  return box.r0 === box.r1 && box.c0 === box.c1 ? start : `${start}:${cell(box.r1, box.c1)}`;
}

const toCellInput = (value: VbaValue): unknown => {
  const v = scalar(value);
  if (v === undefined || v === null) return null;
  if (v instanceof VbaDate) return v.serial;
  if (typeof v === 'string' && v.startsWith('=') && v.length > 1) return { f: v };
  return v;
};

const fromCell = (value: unknown): VbaValue => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  return String(value);
};

export class ExcelModel {
  readonly api: Facade;
  readonly callbacks: ExcelHostCallbacks;
  readonly application: ApplicationObject;
  clipboard: { ws: Facade; box: Box4 } | null = null;

  constructor(api: Facade, callbacks: ExcelHostCallbacks) {
    this.api = api;
    this.callbacks = callbacks;
    this.application = new ApplicationObject(this);
  }

  workbook(): Facade {
    const workbook = this.api.getActiveWorkbook();
    if (!workbook) throw new VbaError(1004, 'Không có bảng tính đang mở');
    return workbook;
  }

  activeSheet(): WorksheetObject {
    return new WorksheetObject(this, this.workbook().getActiveSheet());
  }

  sheetByKey(key: VbaValue): WorksheetObject {
    const workbook = this.workbook();
    const sheets: Facade[] = workbook.getSheets();
    const v = scalar(key);
    if (typeof v === 'number') {
      const sheet = sheets[toInteger(v) - 1];
      if (!sheet) throw new VbaError(9, `Không có trang tính thứ ${v}`);
      return new WorksheetObject(this, sheet);
    }
    const name = toStr(v).toLowerCase();
    const sheet = sheets.find((item) => String(item.getSheetName()).toLowerCase() === name);
    if (!sheet) throw new VbaError(9, `Không có trang tính tên "${toStr(v)}"`);
    return new WorksheetObject(this, sheet);
  }

  rangeFromAddress(text: string, fallback: WorksheetObject): RangeObject {
    const sheet = fallback.sheet;
    const parsed = parseAddress(text, sheet.getMaxRows(), sheet.getMaxColumns());
    if (!parsed) {
      const named = this.definedName(text);
      if (named) return named;
      throw new VbaError(1004, `Địa chỉ "${text}" không hợp lệ`);
    }
    const target = parsed.sheet ? this.sheetByKey(parsed.sheet) : fallback;
    return new RangeObject(this, target.sheet, parsed.box);
  }

  private definedName(name: string): RangeObject | null {
    try {
      const formula: string | undefined = this.workbook().getDefinedName?.(name)?.getFormulaOrRefString?.();
      if (!formula) return null;
      const clean = formula.replace(/^=/, '');
      const parsed = parseAddress(clean, 1_048_576, 16_384);
      if (!parsed) return null;
      const target = parsed.sheet ? this.sheetByKey(parsed.sheet) : this.activeSheet();
      return new RangeObject(this, target.sheet, parsed.box);
    } catch {
      return null;
    }
  }

  rangeFromArgs(args: VbaArgs, sheet: WorksheetObject): RangeObject {
    const first = arg(args, 0, 'cell1');
    const second = arg(args, 1, 'cell2');
    const firstRange = first instanceof RangeObject ? first : this.rangeFromAddress(toStr(first), sheet);
    if (isMissing(second)) return firstRange;
    const secondRange = second instanceof RangeObject ? second : this.rangeFromAddress(toStr(second), sheet);
    return new RangeObject(this, firstRange.sheet, {
      r0: Math.min(firstRange.box.r0, secondRange.box.r0),
      c0: Math.min(firstRange.box.c0, secondRange.box.c0),
      r1: Math.max(firstRange.box.r1, secondRange.box.r1),
      c1: Math.max(firstRange.box.c1, secondRange.box.c1),
    });
  }

  cellsOf(sheet: Facade, base: Box4, args: VbaArgs): RangeObject {
    if (!args.values.length) return new RangeObject(this, sheet, base);
    const rowValue = arg(args, 0, 'rowindex');
    const columnValue = arg(args, 1, 'columnindex');
    const width = base.c1 - base.c0 + 1;
    if (isMissing(columnValue)) {
      const index = toInteger(rowValue) - 1;
      const r = base.r0 + Math.floor(index / width);
      const c = base.c0 + (index % width);
      return new RangeObject(this, sheet, { r0: r, r1: r, c0: c, c1: c });
    }
    const r = base.r0 + toInteger(rowValue) - 1;
    const columnScalar = scalar(columnValue);
    const c = typeof columnScalar === 'string' && /^[a-z]+$/i.test(columnScalar) ? colIndex(columnScalar) : base.c0 + toInteger(columnScalar) - 1;
    if (r < 0 || c < 0) throw new VbaError(1004, 'Chỉ số hàng hoặc cột phải từ 1 trở lên');
    return new RangeObject(this, sheet, { r0: r, r1: r, c0: c, c1: c });
  }

  selectionRange(): RangeObject {
    const sheet = this.workbook().getActiveSheet();
    const active = sheet.getSelection()?.getActiveRange()?.getRange();
    if (!active) return new RangeObject(this, sheet, { r0: 0, c0: 0, r1: 0, c1: 0 });
    return new RangeObject(this, sheet, { r0: active.startRow, c0: active.startColumn, r1: active.endRow, c1: active.endColumn });
  }

  activeCell(): RangeObject {
    const sheet = this.workbook().getActiveSheet();
    const selection = sheet.getSelection();
    const current = selection?.getCurrentCell?.();
    if (current && typeof current.actualRow === 'number') {
      return new RangeObject(this, sheet, { r0: current.actualRow, r1: current.actualRow, c0: current.actualColumn, c1: current.actualColumn });
    }
    const range = this.selectionRange();
    return new RangeObject(this, sheet, { r0: range.box.r0, r1: range.box.r0, c0: range.box.c0, c1: range.box.c0 });
  }
}

class PropertyBag extends VbaObject {
  readonly typeName: string;
  private readonly values = new Map<string, VbaValue>();
  constructor(typeName: string, initial: Record<string, VbaValue> = {}) {
    super();
    this.typeName = typeName;
    for (const [key, value] of Object.entries(initial)) this.values.set(key, value);
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (this.values.has(name)) return this.values.get(name);
    return super.get(name, args);
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    this.values.set(name, value);
    return true;
  }
}

const aggregateValues = (args: VbaArgs): VbaValue[] =>
  args.values.flatMap((value) => {
    if (value instanceof RangeObject) return value.valueList();
    if (value instanceof VbaArray) return value.data;
    if (isMissing(value)) return [];
    return [scalar(value)];
  });

const numbersOf = (args: VbaArgs) => aggregateValues(args).filter((value): value is number => typeof value === 'number');

const criteriaMatcher = (criteria: VbaValue): ((value: VbaValue) => boolean) => {
  const text = toStr(criteria);
  const match = /^(<=|>=|<>|=|<|>)(.*)$/.exec(text);
  if (match) {
    const operand = match[2];
    const numeric = tryNumber(operand);
    return (value) => {
      const comparison = numeric !== null && typeof value === 'number' ? compareValues(value, numeric, true) : compareValues(toStr(value ?? ''), operand, true);
      switch (match[1]) {
        case '=':
          return comparison === 0;
        case '<>':
          return comparison !== 0;
        case '<':
          return comparison < 0;
        case '>':
          return comparison > 0;
        case '<=':
          return comparison <= 0;
        default:
          return comparison >= 0;
      }
    };
  }
  if (/[*?]/.test(text)) {
    const pattern = new RegExp(`^${text.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    return (value) => pattern.test(toStr(value ?? ''));
  }
  return (value) => compareValues(value ?? '', criteria, true) === 0;
};

class WorksheetFunctionObject extends VbaObject {
  readonly typeName = 'WorksheetFunction';
  get(name: string, args: VbaArgs): VbaValue {
    switch (name) {
      case 'sum':
        return numbersOf(args).reduce((total, value) => total + value, 0);
      case 'average': {
        const values = numbersOf(args);
        if (!values.length) throw new VbaError(1004, 'Average: không có số nào');
        return values.reduce((total, value) => total + value, 0) / values.length;
      }
      case 'max':
        return numbersOf(args).reduce((best, value) => Math.max(best, value), -Infinity) === -Infinity ? 0 : Math.max(...numbersOf(args));
      case 'min':
        return numbersOf(args).length ? Math.min(...numbersOf(args)) : 0;
      case 'count':
        return numbersOf(args).length;
      case 'counta':
        return aggregateValues(args).filter((value) => value !== undefined && value !== '').length;
      case 'countblank':
        return aggregateValues(args).filter((value) => value === undefined || value === '').length;
      case 'median': {
        const values = numbersOf(args).sort((a, b) => a - b);
        if (!values.length) throw new VbaError(1004, 'Median: không có số nào');
        const middle = Math.floor(values.length / 2);
        return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
      }
      case 'large':
      case 'small': {
        const values = numbersOf({ values: [args.values[0]], names: [undefined] }).sort((a, b) => (name === 'large' ? b - a : a - b));
        const k = toInteger(arg(args, 1));
        if (k < 1 || k > values.length) throw new VbaError(1004, `${name}: k ngoài phạm vi`);
        return values[k - 1];
      }
      case 'countif': {
        const matcher = criteriaMatcher(arg(args, 1));
        return aggregateValues({ values: [args.values[0]], names: [undefined] }).filter((value) => matcher(value)).length;
      }
      case 'sumif': {
        const matcher = criteriaMatcher(arg(args, 1));
        const criteriaValues = aggregateValues({ values: [args.values[0]], names: [undefined] });
        const sumSource = isMissing(arg(args, 2)) ? criteriaValues : aggregateValues({ values: [args.values[2]], names: [undefined] });
        return criteriaValues.reduce<number>((total, value, index) => total + (matcher(value) ? tryNumber(sumSource[index] ?? 0) ?? 0 : 0), 0);
      }
      case 'match': {
        const lookup = scalar(arg(args, 0));
        const list = aggregateValues({ values: [args.values[1]], names: [undefined] });
        const index = list.findIndex((value) => compareValues(value ?? '', lookup, true) === 0);
        if (index < 0) throw new VbaError(1004, `Match: không tìm thấy "${toStr(lookup)}"`);
        return index + 1;
      }
      case 'vlookup': {
        const lookup = scalar(arg(args, 0));
        const table = arg(args, 1);
        const column = toInteger(arg(args, 2));
        const rows = table instanceof RangeObject ? table.valueRows() : table instanceof VbaArray ? table.rows() : [];
        const row = rows.find((item) => compareValues(item[0] ?? '', lookup, true) === 0);
        if (!row) throw new VbaError(1004, `VLookup: không tìm thấy "${toStr(lookup)}"`);
        return row[column - 1];
      }
      case 'index': {
        const source = arg(args, 0);
        const rows = source instanceof RangeObject ? source.valueRows() : source instanceof VbaArray ? source.rows() : [];
        const r = toInteger(arg(args, 1));
        const c = isMissing(arg(args, 2)) ? 1 : toInteger(arg(args, 2));
        const value = rows[r - 1]?.[c - 1];
        if (rows[r - 1] === undefined) throw new VbaError(1004, 'Index: vượt phạm vi');
        return value;
      }
      case 'round':
        return Math.round(toNumber(arg(args, 0)) * 10 ** toInteger(arg(args, 1))) / 10 ** toInteger(arg(args, 1));
      case 'roundup': {
        const factor = 10 ** toInteger(arg(args, 1));
        const value = toNumber(arg(args, 0));
        return (Math.sign(value) * Math.ceil(Math.abs(value) * factor)) / factor;
      }
      case 'rounddown': {
        const factor = 10 ** toInteger(arg(args, 1));
        const value = toNumber(arg(args, 0));
        return (Math.sign(value) * Math.floor(Math.abs(value) * factor)) / factor;
      }
      case 'ceiling':
      case 'ceiling_math': {
        const step = isMissing(arg(args, 1)) ? 1 : toNumber(arg(args, 1));
        return Math.ceil(toNumber(arg(args, 0)) / step) * step;
      }
      case 'floor':
      case 'floor_math': {
        const step = isMissing(arg(args, 1)) ? 1 : toNumber(arg(args, 1));
        return Math.floor(toNumber(arg(args, 0)) / step) * step;
      }
      case 'power':
        return toNumber(arg(args, 0)) ** toNumber(arg(args, 1));
      case 'text':
        return vbaFormat(arg(args, 0), toStr(arg(args, 1)));
      case 'trim':
        return toStr(arg(args, 0)).trim().replace(/\s+/g, ' ');
      case 'proper':
        return toStr(arg(args, 0)).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
      case 'isnumber':
        return typeof scalar(arg(args, 0)) === 'number';
      case 'istext':
        return typeof scalar(arg(args, 0)) === 'string';
      case 'and':
        return aggregateValues(args).every((value) => toBool(value ?? false));
      case 'or':
        return aggregateValues(args).some((value) => toBool(value ?? false));
      case 'mround': {
        const multiple = toNumber(arg(args, 1));
        return Math.round(toNumber(arg(args, 0)) / multiple) * multiple;
      }
      case 'transpose': {
        const source = arg(args, 0);
        const rows: VbaValue[][] = source instanceof RangeObject ? source.valueRows() : source instanceof VbaArray ? source.rows() : [[scalar(source)]];
        const columns = rows[0]?.length ?? 0;
        return VbaArray.fromGrid(Array.from({ length: columns }, (_, c): VbaValue[] => rows.map((row) => row[c])));
      }
      default:
        throw new VbaError(438, `WorksheetFunction.${name} chưa được hỗ trợ trong Minh Sheets`);
    }
  }
}

export class ApplicationObject extends VbaObject {
  readonly typeName = 'Application';
  private readonly model: ExcelModel;
  private readonly settings = new Map<string, VbaValue>([
    ['screenupdating', true],
    ['displayalerts', true],
    ['enableevents', true],
    ['calculation', -4105],
    ['statusbar', false],
    ['cutcopymode', false],
    ['askToUpdateLinks', true],
  ]);
  private readonly worksheetFunction = new WorksheetFunctionObject();

  constructor(model: ExcelModel) {
    super();
    this.model = model;
  }

  hasGlobal(name: string): boolean {
    return GLOBAL_MEMBERS.has(name);
  }

  get(name: string, args: VbaArgs): VbaValue {
    const model = this.model;
    switch (name) {
      case 'application':
        return this;
      case 'activeworkbook':
      case 'thisworkbook':
        return new WorkbookObject(model);
      case 'workbooks':
        return new WorkbooksObject(model, args);
      case 'activesheet':
        return model.activeSheet();
      case 'worksheets':
      case 'sheets':
        return args.values.length ? model.sheetByKey(arg(args, 0)) : new SheetsObject(model);
      case 'range':
        return model.rangeFromArgs(args, model.activeSheet());
      case 'cells': {
        const sheet = model.activeSheet();
        return model.cellsOf(sheet.sheet, sheet.fullBox(), args);
      }
      case 'rows':
        return model.activeSheet().get('rows', args);
      case 'columns':
        return model.activeSheet().get('columns', args);
      case 'activecell':
        return model.activeCell();
      case 'selection':
        return model.selectionRange();
      case 'worksheetfunction':
        return this.worksheetFunction;
      case 'activewindow':
        return new WindowObject(model);
      case 'international': {
        const index = toInteger(arg(args, 0));
        if (index === 3) return '.';
        if (index === 4) return ',';
        if (index === 5) return ',';
        return undefined;
      }
      case 'intersect': {
        const ranges = args.values.filter((value): value is RangeObject => value instanceof RangeObject);
        if (!ranges.length) return NOTHING;
        const box = ranges.slice(1).reduce<Box4 | null>((current, range) => {
          if (!current) return null;
          const next = { r0: Math.max(current.r0, range.box.r0), c0: Math.max(current.c0, range.box.c0), r1: Math.min(current.r1, range.box.r1), c1: Math.min(current.c1, range.box.c1) };
          return next.r0 > next.r1 || next.c0 > next.c1 ? null : next;
        }, ranges[0].box);
        return box ? new RangeObject(model, ranges[0].sheet, box) : NOTHING;
      }
      case 'union': {
        const ranges = args.values.filter((value): value is RangeObject => value instanceof RangeObject);
        if (!ranges.length) throw new VbaError(5, 'Union cần ít nhất một vùng');
        return new RangeObject(model, ranges[0].sheet, {
          r0: Math.min(...ranges.map((range) => range.box.r0)),
          c0: Math.min(...ranges.map((range) => range.box.c0)),
          r1: Math.max(...ranges.map((range) => range.box.r1)),
          c1: Math.max(...ranges.map((range) => range.box.c1)),
        });
      }
      case 'inputbox': {
        const answer = model.callbacks.inputBox(toStr(arg(args, 0, 'prompt')), isMissing(arg(args, 1, 'title')) ? 'Minh Sheets' : toStr(arg(args, 1, 'title')), isMissing(arg(args, 2, 'default')) ? '' : toStr(arg(args, 2, 'default')));
        const type = arg(args, 7, 'type');
        if (!isMissing(type) && toInteger(type) === 8 && answer) return model.rangeFromAddress(answer, model.activeSheet());
        if (!isMissing(type) && toInteger(type) === 1) return tryNumber(answer) ?? false;
        return answer;
      }
      case 'calculate':
        model.api.getFormula?.()?.executeCalculation?.();
        return undefined;
      case 'wait':
      case 'ontime':
      case 'volatile':
      case 'quit':
      case 'goto':
        return undefined;
      case 'username':
        return 'Minh Sheets';
      case 'version':
        return '16.0';
      case 'name':
        return 'Minh Sheets';
      case 'operatingsystem':
        return typeof navigator !== 'undefined' ? navigator.platform : 'Windows';
      case 'pathseparator':
        return '\\';
      case 'evaluate':
        return evaluateText(model, toStr(arg(args, 0)));
      default:
        if (this.settings.has(name)) return this.settings.get(name);
        if (name in WORKSHEET_FUNCTION_NAMES) return this.worksheetFunction.get(name, args);
        return super.get(name, args);
    }
  }

  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    if (name === 'statusbar') {
      this.model.callbacks.statusBar(value === false ? '' : toStr(value));
      this.settings.set(name, value);
      return true;
    }
    if (name === 'cutcopymode') {
      if (!toBool(value ?? false)) this.model.clipboard = null;
      return true;
    }
    if (this.settings.has(name) || ['screenupdating', 'displayalerts', 'enableevents', 'calculation', 'asktoupdatelinks', 'displaystatusbar', 'cursor'].includes(name)) {
      this.settings.set(name, value);
      return true;
    }
    return false;
  }
}

const WORKSHEET_FUNCTION_NAMES: Record<string, true> = { sum: true, average: true, max: true, min: true, count: true, counta: true, countif: true, sumif: true, match: true, vlookup: true, index: true, transpose: true };

const GLOBAL_MEMBERS = new Set([
  'application', 'activeworkbook', 'thisworkbook', 'workbooks', 'activesheet', 'worksheets', 'sheets', 'range', 'cells', 'rows', 'columns',
  'activecell', 'selection', 'worksheetfunction', 'activewindow', 'intersect', 'union', 'calculate', 'evaluate', 'screenupdating',
]);

function evaluateText(model: ExcelModel, text: string): VbaValue {
  const clean = text.replace(/^=/, '').trim();
  const sheet = model.activeSheet();
  if (parseAddress(clean, sheet.sheet.getMaxRows(), sheet.sheet.getMaxColumns())) return model.rangeFromAddress(clean, sheet);
  const number = tryNumber(clean);
  if (number !== null) return number;
  if (/^".*"$/.test(clean)) return clean.slice(1, -1).replace(/""/g, '"');
  throw new VbaError(1004, `Evaluate chỉ hỗ trợ địa chỉ ô, số hoặc chuỗi; chưa tính được công thức "${text}"`);
}

export function evaluateBracketText(model: ExcelModel, text: string): VbaValue {
  return evaluateText(model, text);
}

class WindowObject extends VbaObject {
  readonly typeName = 'Window';
  private readonly model: ExcelModel;
  constructor(model: ExcelModel) {
    super();
    this.model = model;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const sheet = this.model.workbook().getActiveSheet();
    switch (name) {
      case 'freezepanes': {
        const freeze = sheet.getFreeze?.();
        return !!freeze && (freeze.xSplit > 0 || freeze.ySplit > 0);
      }
      case 'zoom':
        return 100;
      case 'activesheet':
        return this.model.activeSheet();
      case 'scrollrow':
      case 'scrollcolumn':
        return 1;
      default:
        return super.get(name, args);
    }
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    const sheet = this.model.workbook().getActiveSheet();
    if (name === 'freezepanes') {
      if (toBool(value ?? false)) {
        const cell = this.model.activeCell().box;
        sheet.setFreeze({ startRow: cell.r0, startColumn: cell.c0, xSplit: cell.c0, ySplit: cell.r0 });
      } else sheet.cancelFreeze();
      return true;
    }
    if (name === 'scrollrow' || name === 'scrollcolumn' || name === 'zoom' || name === 'displaygridlines' || name === 'windowstate') return true;
    return false;
  }
}

class WorkbooksObject extends VbaObject {
  readonly typeName = 'Workbooks';
  private readonly model: ExcelModel;
  constructor(model: ExcelModel, _args: VbaArgs) {
    super();
    this.model = model;
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'count') return 1;
    if (name === 'item') return new WorkbookObject(this.model);
    if (name === 'open' || name === 'add') throw new VbaError(1004, 'Minh Sheets chưa mở hoặc tạo bảng tính khác từ macro');
    return super.get(name, args);
  }
  defaultGet(): VbaValue {
    return new WorkbookObject(this.model);
  }
  items(): VbaValue[] {
    return [new WorkbookObject(this.model)];
  }
}

class WorkbookObject extends VbaObject {
  readonly typeName = 'Workbook';
  private readonly model: ExcelModel;
  constructor(model: ExcelModel) {
    super();
    this.model = model;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const workbook = this.model.workbook();
    switch (name) {
      case 'name':
        return String(workbook.getName?.() ?? 'Bảng tính');
      case 'fullname':
      case 'path':
        return name === 'path' ? '' : String(workbook.getName?.() ?? '');
      case 'worksheets':
      case 'sheets':
        return args.values.length ? this.model.sheetByKey(arg(args, 0)) : new SheetsObject(this.model);
      case 'activesheet':
        return this.model.activeSheet();
      case 'save':
        this.model.callbacks.save();
        return undefined;
      case 'activate':
      case 'close':
        return undefined;
      case 'saveas':
      case 'savecopyas':
        throw new VbaError(1004, 'Minh Sheets chưa lưu bảng tính sang tệp khác từ macro; dùng nút Xuất trên ribbon');
      default:
        return super.get(name, args);
    }
  }
}

class SheetsObject extends VbaObject {
  readonly typeName = 'Sheets';
  private readonly model: ExcelModel;
  constructor(model: ExcelModel) {
    super();
    this.model = model;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const workbook = this.model.workbook();
    switch (name) {
      case 'count':
        return workbook.getSheets().length;
      case 'item':
        return this.model.sheetByKey(arg(args, 0));
      case 'add': {
        const created = workbook.insertSheet();
        const before = arg(args, 0, 'before');
        const after = arg(args, 1, 'after');
        const sheets: Facade[] = workbook.getSheets();
        const reference = before instanceof WorksheetObject ? before : after instanceof WorksheetObject ? after : null;
        if (reference) {
          const referenceIndex = sheets.findIndex((sheet) => sheet.getSheetId() === reference.sheet.getSheetId());
          workbook.moveSheet?.(created, before instanceof WorksheetObject ? referenceIndex : referenceIndex + 1);
        }
        workbook.setActiveSheet(created);
        return new WorksheetObject(this.model, created);
      }
      default:
        return super.get(name, args);
    }
  }
  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    return this.model.sheetByKey(arg(args, 0));
  }
  items(): VbaValue[] {
    return (this.model.workbook().getSheets() as Facade[]).map((sheet) => new WorksheetObject(this.model, sheet));
  }
}

export class WorksheetObject extends VbaObject {
  readonly typeName = 'Worksheet';
  readonly model: ExcelModel;
  readonly sheet: Facade;
  constructor(model: ExcelModel, sheet: Facade) {
    super();
    this.model = model;
    this.sheet = sheet;
  }

  fullBox(): Box4 {
    return { r0: 0, c0: 0, r1: this.sheet.getMaxRows() - 1, c1: this.sheet.getMaxColumns() - 1 };
  }

  private indexArg(value: VbaValue, kind: 'row' | 'column'): { start: number; end: number } {
    const v = scalar(value);
    if (typeof v === 'string') {
      const parts = v.replace(/\$/g, '').split(':');
      const parse = (part: string) => (kind === 'row' ? Number(part) - 1 : colIndex(part));
      const start = parse(parts[0]);
      const end = parts[1] ? parse(parts[1]) : start;
      if (!Number.isFinite(start) || start < 0) throw new VbaError(1004, `Chỉ số ${kind === 'row' ? 'hàng' : 'cột'} "${v}" không hợp lệ`);
      return { start: Math.min(start, end), end: Math.max(start, end) };
    }
    const index = toInteger(v) - 1;
    return { start: index, end: index };
  }

  get(name: string, args: VbaArgs): VbaValue {
    const model = this.model;
    const sheet = this.sheet;
    switch (name) {
      case 'name':
      case 'codename':
        return String(sheet.getSheetName());
      case 'index':
        return (model.workbook().getSheets() as Facade[]).findIndex((item) => item.getSheetId() === sheet.getSheetId()) + 1;
      case 'range':
        return model.rangeFromArgs(args, this);
      case 'cells':
        return model.cellsOf(sheet, this.fullBox(), args);
      case 'rows': {
        if (!args.values.length) return new RangeObject(model, sheet, this.fullBox(), 'rows');
        const { start, end } = this.indexArg(arg(args, 0), 'row');
        return new RangeObject(model, sheet, { r0: start, r1: end, c0: 0, c1: sheet.getMaxColumns() - 1 });
      }
      case 'columns': {
        if (!args.values.length) return new RangeObject(model, sheet, this.fullBox(), 'columns');
        const { start, end } = this.indexArg(arg(args, 0), 'column');
        return new RangeObject(model, sheet, { r0: 0, r1: sheet.getMaxRows() - 1, c0: start, c1: end });
      }
      case 'usedrange': {
        const lastRow = Math.max(0, sheet.getLastRow());
        const lastColumn = Math.max(0, sheet.getLastColumn());
        return new RangeObject(model, sheet, { r0: 0, c0: 0, r1: lastRow, c1: lastColumn });
      }
      case 'activate':
      case 'select':
        model.workbook().setActiveSheet(sheet);
        return undefined;
      case 'delete':
        model.workbook().deleteSheet(sheet);
        return undefined;
      case 'copy': {
        const copy = model.workbook().duplicateSheet(sheet);
        return copy ? new WorksheetObject(model, copy) : undefined;
      }
      case 'visible':
        return sheet.isSheetHidden?.() ? 0 : -1;
      case 'parent':
        return new WorkbookObject(model);
      case 'calculate':
        model.api.getFormula?.()?.executeCalculation?.();
        return undefined;
      case 'protect':
      case 'unprotect':
        return undefined;
      case 'paste': {
        const destination = arg(args, 0, 'destination');
        const target = destination instanceof RangeObject ? destination : model.selectionRange();
        target.pasteFromClipboard();
        return undefined;
      }
      case 'autofiltermode':
        return false;
      case 'tab':
        return new PropertyBag('Tab', { color: hexToVbaColor(sheet.getTabColor?.() ?? '') });
      default:
        return super.get(name, args);
    }
  }

  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    if (name === 'name') {
      this.sheet.setName(toStr(value));
      return true;
    }
    if (name === 'visible') {
      const v = scalar(value);
      const visible = typeof v === 'boolean' ? v : toInteger(v) === -1;
      if (visible) this.sheet.showSheet();
      else this.sheet.hideSheet();
      return true;
    }
    if (name === 'autofiltermode') return true;
    return false;
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return String(this.sheet.getSheetName());
    return super.defaultGet(args);
  }
}

class FontObject extends VbaObject {
  readonly typeName = 'Font';
  private readonly range: RangeObject;
  constructor(range: RangeObject) {
    super();
    this.range = range;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const style = this.range.style();
    switch (name) {
      case 'bold':
        return style.bl === 1;
      case 'italic':
        return style.it === 1;
      case 'underline':
        return style.ul?.s ? 2 : -4142;
      case 'strikethrough':
        return !!style.st?.s;
      case 'size':
        return style.fs ?? DEFAULT_CELL_FONT_SIZE_PT;
      case 'name':
        return style.ff ?? DEFAULT_CELL_FONT_FAMILY;
      case 'color':
        return hexToVbaColor(style.cl?.rgb ?? '#000000');
      case 'colorindex':
        return 1;
      default:
        return super.get(name, args);
    }
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    const range = this.range.facade();
    switch (name) {
      case 'bold':
        range.setFontWeight(toBool(value ?? false) ? 'bold' : 'normal');
        return true;
      case 'italic':
        range.setFontStyle(toBool(value ?? false) ? 'italic' : 'normal');
        return true;
      case 'underline': {
        const v = scalar(value);
        range.setFontLine(typeof v === 'boolean' ? (v ? 'underline' : 'none') : toInteger(v) === -4142 ? 'none' : 'underline');
        return true;
      }
      case 'strikethrough':
        range.setFontLine(toBool(value ?? false) ? 'line-through' : 'none');
        return true;
      case 'size':
        range.setFontSize(toNumber(value));
        return true;
      case 'name':
        range.setFontFamily(toStr(value));
        return true;
      case 'color':
        range.setFontColor(vbaColorToHex(toNumber(value)));
        return true;
      case 'colorindex': {
        const hex = colorIndexToHex(toInteger(value));
        if (hex) range.setFontColor(hex);
        return true;
      }
      default:
        return false;
    }
  }
}

class InteriorObject extends VbaObject {
  readonly typeName = 'Interior';
  private readonly range: RangeObject;
  constructor(range: RangeObject) {
    super();
    this.range = range;
  }
  get(name: string, args: VbaArgs): VbaValue {
    const style = this.range.style();
    switch (name) {
      case 'color':
        return style.bg?.rgb ? hexToVbaColor(style.bg.rgb) : 16777215;
      case 'colorindex':
        return style.bg?.rgb ? 0 : -4142;
      case 'pattern':
        return style.bg?.rgb ? 1 : -4142;
      default:
        return super.get(name, args);
    }
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    switch (name) {
      case 'color':
        this.range.setBackground(vbaColorToHex(toNumber(value)));
        return true;
      case 'colorindex': {
        const index = toInteger(value);
        this.range.setBackground(index === -4142 || index === 0 ? null : colorIndexToHex(index));
        return true;
      }
      case 'pattern':
        if (toInteger(value) === -4142) this.range.setBackground(null);
        return true;
      case 'tintandshade':
      case 'patterncolorindex':
      case 'themecolor':
        return true;
      default:
        return false;
    }
  }
}

class BordersObject extends VbaObject {
  readonly typeName = 'Borders';
  private readonly range: RangeObject;
  private readonly edge: number | null;
  constructor(range: RangeObject, edge: number | null) {
    super();
    this.range = range;
    this.edge = edge;
  }
  private borderType(): unknown {
    switch (this.edge) {
      case 7:
        return BorderType.LEFT;
      case 8:
        return BorderType.TOP;
      case 9:
        return BorderType.BOTTOM;
      case 10:
        return BorderType.RIGHT;
      case 11:
        return BorderType.VERTICAL;
      case 12:
        return BorderType.HORIZONTAL;
      default:
        return BorderType.ALL;
    }
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'item') return new BordersObject(this.range, toInteger(arg(args, 0)));
    if (name === 'linestyle' || name === 'weight' || name === 'color') return undefined;
    return super.get(name, args);
  }
  defaultGet(args: VbaArgs): VbaValue {
    if (!args.values.length) return super.defaultGet(args);
    return new BordersObject(this.range, toInteger(arg(args, 0)));
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    const range = this.range.facade();
    if (name === 'linestyle' || name === 'weight') {
      const v = toInteger(value);
      const style = v === -4142 ? BorderStyleTypes.NONE : name === 'weight' ? (v === 4 ? BorderStyleTypes.THICK : v === -4138 ? BorderStyleTypes.MEDIUM : BorderStyleTypes.THIN) : v === -4115 ? BorderStyleTypes.DASHED : v === -4118 ? BorderStyleTypes.DOTTED : v === -4119 ? BorderStyleTypes.DOUBLE : BorderStyleTypes.THIN;
      range.setBorder(this.borderType(), style, '#000000');
      return true;
    }
    if (name === 'color') {
      range.setBorder(this.borderType(), BorderStyleTypes.THIN, vbaColorToHex(toNumber(value)));
      return true;
    }
    if (name === 'colorindex' || name === 'tintandshade') return true;
    return false;
  }
}

export class RangeObject extends VbaObject {
  readonly typeName = 'Range';
  readonly model: ExcelModel;
  readonly sheet: Facade;
  readonly box: Box4;
  readonly iterateAs: 'cells' | 'rows' | 'columns';

  constructor(model: ExcelModel, sheet: Facade, box: Box4, iterateAs: 'cells' | 'rows' | 'columns' = 'cells') {
    super();
    if (box.r0 < 0 || box.c0 < 0) throw new VbaError(1004, 'Vùng ô vượt ra ngoài trang tính (hàng hoặc cột < 1)');
    this.model = model;
    this.sheet = sheet;
    this.box = box;
    this.iterateAs = iterateAs;
  }

  get rows(): number {
    return this.box.r1 - this.box.r0 + 1;
  }

  get columns(): number {
    return this.box.c1 - this.box.c0 + 1;
  }

  facade(): Facade {
    this.ensureSize();
    return this.sheet.getRange(this.box.r0, this.box.c0, this.rows, this.columns);
  }

  private ensureSize() {
    if (this.box.r1 >= this.sheet.getMaxRows()) this.sheet.setRowCount?.(this.box.r1 + 1);
    if (this.box.c1 >= this.sheet.getMaxColumns()) this.sheet.setColumnCount?.(this.box.c1 + 1);
  }

  private at(box: Box4, iterateAs: 'cells' | 'rows' | 'columns' = 'cells') {
    return new RangeObject(this.model, this.sheet, box, iterateAs);
  }

  style(): Record<string, any> {
    return this.sheet.getRange(this.box.r0, this.box.c0, 1, 1).getCellStyleData?.() ?? {};
  }

  setBackground(hex: string | null) {
    this.ensureSize();
    const workbook = this.model.workbook();
    this.model.api.syncExecuteCommand('sheet.command.set-style', {
      unitId: workbook.getId(),
      subUnitId: this.sheet.getSheetId(),
      range: { startRow: this.box.r0, endRow: this.box.r1, startColumn: this.box.c0, endColumn: this.box.c1 },
      style: { type: 'bg', value: hex ? { rgb: hex } : null },
    });
  }

  private setStyle(type: string, value: unknown) {
    this.ensureSize();
    const workbook = this.model.workbook();
    this.model.api.syncExecuteCommand('sheet.command.set-style', {
      unitId: workbook.getId(),
      subUnitId: this.sheet.getSheetId(),
      range: { startRow: this.box.r0, endRow: this.box.r1, startColumn: this.box.c0, endColumn: this.box.c1 },
      style: { type, value },
    });
  }

  private rawCell(r: number, c: number): any {
    const model = this.sheet.getSheet?.();
    return model?.getCellRaw ? model.getCellRaw(r, c) : null;
  }

  private isBlank(r: number, c: number): boolean {
    const raw = this.rawCell(r, c);
    if (raw === null || raw === undefined) return true;
    return (raw.v === undefined || raw.v === null || raw.v === '') && !raw.f && !raw.p;
  }

  cellValue(r: number, c: number): VbaValue {
    return fromCell(this.sheet.getRange(r, c, 1, 1).getValue());
  }

  valueRows(): VbaValue[][] {
    const box = this.clampedBox();
    const values: unknown[][] = this.sheet.getRange(box.r0, box.c0, box.r1 - box.r0 + 1, box.c1 - box.c0 + 1).getValues();
    return values.map((row) => row.map(fromCell));
  }

  valueList(): VbaValue[] {
    return this.valueRows().flat();
  }

  private clampedBox(): Box4 {
    const lastRow = Math.max(this.box.r0, Math.min(this.box.r1, Math.max(this.sheet.getLastRow(), this.box.r0)));
    const lastColumn = Math.max(this.box.c0, Math.min(this.box.c1, Math.max(this.sheet.getLastColumn(), this.box.c0)));
    if (this.rows * this.columns <= MAX_SCAN) return this.box;
    return { r0: this.box.r0, c0: this.box.c0, r1: lastRow, c1: lastColumn };
  }

  value(): VbaValue {
    if (this.rows === 1 && this.columns === 1) return this.cellValue(this.box.r0, this.box.c0);
    return VbaArray.fromGrid(this.valueRows());
  }

  setValue(value: VbaValue) {
    const v = value instanceof VbaObject ? scalar(value) : value;
    if (v instanceof VbaArray) {
      const rows = v.bounds.length === 1 ? [v.data] : v.rows();
      const grid = Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => toCellInput(rows[r % rows.length]?.[c % (rows[0]?.length || 1)])));
      this.facade().setValues(grid);
      return;
    }
    const input = toCellInput(v);
    if (this.rows === 1 && this.columns === 1) this.facade().setValue(input);
    else this.facade().setValues(Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, () => input)));
    if (v instanceof VbaDate) {
      const pattern = Math.abs(v.serial - Math.floor(v.serial)) > 1e-9 ? (Math.floor(v.serial) ? 'dd/mm/yyyy hh:mm:ss' : 'hh:mm:ss') : 'dd/mm/yyyy';
      this.facade().setNumberFormat?.(pattern);
    }
  }

  formula(): VbaValue {
    const read = (r: number, c: number) => {
      const formula = this.sheet.getRange(r, c, 1, 1).getFormula?.();
      if (formula) return formula as string;
      const value = this.cellValue(r, c);
      return value === undefined ? '' : toStr(value);
    };
    if (this.rows === 1 && this.columns === 1) return read(this.box.r0, this.box.c0);
    return VbaArray.fromGrid(Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => read(this.box.r0 + r, this.box.c0 + c))));
  }

  setFormula(value: VbaValue) {
    const v = scalar(value);
    if (v instanceof VbaArray) {
      this.setValue(v);
      return;
    }
    const text = toStr(v);
    if (!text.startsWith('=')) {
      this.setValue(tryNumber(text) !== null && text.trim() !== '' ? toNumber(text) : text);
      return;
    }
    if (this.rows === 1 && this.columns === 1) {
      this.facade().setValue({ f: text });
      return;
    }
    const grid: unknown[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: unknown[] = [];
      for (let c = 0; c < this.columns; c++) row.push({ f: shiftFormula(text, r, c) });
      grid.push(row);
    }
    this.facade().setValues(grid);
  }

  private end(direction: number): RangeObject {
    let r = this.box.r0;
    let c = this.box.c0;
    const maxRow = this.sheet.getMaxRows() - 1;
    const maxColumn = this.sheet.getMaxColumns() - 1;
    const step = direction === -4162 ? [-1, 0] : direction === -4121 ? [1, 0] : direction === -4159 ? [0, -1] : [0, 1];
    const inside = (row: number, column: number) => row >= 0 && column >= 0 && row <= maxRow && column <= maxColumn;
    const nextBlank = (row: number, column: number) => !inside(row, column) || this.isBlank(row, column);
    if (!this.isBlank(r, c) && !nextBlank(r + step[0], c + step[1])) {
      while (!nextBlank(r + step[0], c + step[1])) {
        r += step[0];
        c += step[1];
      }
    } else {
      r += step[0];
      c += step[1];
      while (inside(r, c) && this.isBlank(r, c)) {
        if (!inside(r + step[0], c + step[1])) break;
        r += step[0];
        c += step[1];
      }
      r = Math.max(0, Math.min(maxRow, r));
      c = Math.max(0, Math.min(maxColumn, c));
    }
    return this.at({ r0: r, r1: r, c0: c, c1: c });
  }

  private currentRegion(): RangeObject {
    const box = { ...this.box };
    let grew = true;
    const maxRow = this.sheet.getMaxRows() - 1;
    const maxColumn = this.sheet.getMaxColumns() - 1;
    const anyFilled = (r0: number, r1: number, c0: number, c1: number) => {
      for (let r = Math.max(0, r0); r <= Math.min(maxRow, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(maxColumn, c1); c++) if (!this.isBlank(r, c)) return true;
      return false;
    };
    let guard = 0;
    while (grew && guard++ < 5000) {
      grew = false;
      if (box.r0 > 0 && anyFilled(box.r0 - 1, box.r0 - 1, box.c0 - 1, box.c1 + 1)) {
        box.r0 -= 1;
        grew = true;
      }
      if (box.r1 < maxRow && anyFilled(box.r1 + 1, box.r1 + 1, box.c0 - 1, box.c1 + 1)) {
        box.r1 += 1;
        grew = true;
      }
      if (box.c0 > 0 && anyFilled(box.r0 - 1, box.r1 + 1, box.c0 - 1, box.c0 - 1)) {
        box.c0 -= 1;
        grew = true;
      }
      if (box.c1 < maxColumn && anyFilled(box.r0 - 1, box.r1 + 1, box.c1 + 1, box.c1 + 1)) {
        box.c1 += 1;
        grew = true;
      }
    }
    return this.at(box);
  }

  private copyTo(destination: RangeObject, mode: 'all' | 'values' | 'formats' = 'all') {
    const source = this.sheet.getRange(this.box.r0, this.box.c0, this.rows, this.columns);
    const grid: any[][] = source.getCellDatas?.() ?? [];
    const workbook = this.model.workbook();
    const target = destination.box;
    const value = grid.map((row) =>
      row.map((cell: any) => {
        const copy = { ...(cell ?? {}) };
        if (mode === 'values') {
          delete copy.f;
          delete copy.si;
          delete copy.s;
        }
        if (mode === 'formats') return { s: copy.s ?? null };
        return copy;
      })
    );
    destination.ensureSize();
    this.model.api.syncExecuteCommand('sheet.command.set-range-values', {
      unitId: workbook.getId(),
      subUnitId: destination.sheet.getSheetId(),
      range: { startRow: target.r0, startColumn: target.c0, endRow: target.r0 + this.rows - 1, endColumn: target.c0 + this.columns - 1 },
      value,
    });
  }

  pasteFromClipboard(mode: 'all' | 'values' | 'formats' = 'all') {
    const clipboard = this.model.clipboard;
    if (!clipboard) throw new VbaError(1004, 'Chưa có vùng nào được Copy để dán');
    new RangeObject(this.model, clipboard.ws, clipboard.box).copyTo(this, mode);
  }

  private sortRows(args: VbaArgs) {
    const key = arg(args, 0, 'key1');
    const order = arg(args, 1, 'order1');
    const header = arg(args, 2, 'header');
    const keyColumn = key instanceof RangeObject ? key.box.c0 : this.box.c0;
    const descending = !isMissing(order) && toInteger(order) === 2;
    const skipHeader = !isMissing(header) && toInteger(header) === 1;
    const startRow = this.box.r0 + (skipHeader ? 1 : 0);
    if (startRow > this.box.r1) return;
    const source = this.sheet.getRange(startRow, this.box.c0, this.box.r1 - startRow + 1, this.columns);
    const grid: any[][] = source.getCellDatas?.() ?? [];
    const keyIndex = keyColumn - this.box.c0;
    const sorted = grid
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const left = fromCell(a.row[keyIndex]?.v);
        const right = fromCell(b.row[keyIndex]?.v);
        if (left === undefined && right !== undefined) return 1;
        if (right === undefined && left !== undefined) return -1;
        const result = compareValues(left ?? '', right ?? '', true);
        return (descending ? -result : result) || a.index - b.index;
      })
      .map((item) => item.row.map((cell: any) => ({ ...(cell ?? {}) })));
    const workbook = this.model.workbook();
    this.model.api.syncExecuteCommand('sheet.command.set-range-values', {
      unitId: workbook.getId(),
      subUnitId: this.sheet.getSheetId(),
      range: { startRow, startColumn: this.box.c0, endRow: this.box.r1, endColumn: this.box.c1 },
      value: sorted,
    });
  }

  private find(args: VbaArgs): VbaValue {
    const what = toStr(arg(args, 0, 'what'));
    const lookAt = arg(args, 3, 'lookat');
    const whole = !isMissing(lookAt) && toInteger(lookAt) === 1;
    const matchCase = toBool(arg(args, 7, 'matchcase') ?? false);
    const box = this.clampedBox();
    const needle = matchCase ? what : what.toLowerCase();
    for (let r = box.r0; r <= box.r1; r++) {
      for (let c = box.c0; c <= box.c1; c++) {
        const raw = this.rawCell(r, c);
        if (!raw || raw.v === undefined || raw.v === null) continue;
        const text = matchCase ? String(raw.v) : String(raw.v).toLowerCase();
        if (whole ? text === needle : text.includes(needle)) return this.at({ r0: r, r1: r, c0: c, c1: c });
      }
    }
    return NOTHING;
  }

  private autoFit() {
    const box = this.clampedBox();
    for (let c = box.c0; c <= box.c1; c++) {
      let widest = 0;
      for (let r = 0; r <= Math.min(this.sheet.getLastRow(), 5000); r++) {
        const text = this.sheet.getRange(r, c, 1, 1).getDisplayValue?.() ?? toStr(this.cellValue(r, c));
        if (!text) continue;
        const style = this.sheet.getRange(r, c, 1, 1).getCellStyleData?.() ?? {};
        const font = cellFontCss({ family: style.ff ?? DEFAULT_CELL_FONT_FAMILY, sizePt: style.fs ?? DEFAULT_CELL_FONT_SIZE_PT, bold: style.bl === 1, italic: style.it === 1 });
        widest = Math.max(widest, measureTextWithCanvas(String(text), font) + CELL_TEXT_PADDING_PX);
      }
      if (widest > 0) this.sheet.setColumnWidth(c, Math.ceil(widest));
    }
  }

  get(name: string, args: VbaArgs): VbaValue {
    const model = this.model;
    switch (name) {
      case 'value':
      case 'value2':
        return this.value();
      case 'formula':
      case 'formulalocal':
        return this.formula();
      case 'text':
        return String(this.sheet.getRange(this.box.r0, this.box.c0, 1, 1).getDisplayValue?.() ?? toStr(this.cellValue(this.box.r0, this.box.c0)));
      case 'hasformula':
        return !!this.sheet.getRange(this.box.r0, this.box.c0, 1, 1).getFormula?.();
      case 'row':
        return this.box.r0 + 1;
      case 'column':
        return this.box.c0 + 1;
      case 'count':
      case 'countlarge':
        return this.iterateAs === 'rows' ? this.rows : this.iterateAs === 'columns' ? this.columns : this.rows * this.columns;
      case 'address': {
        const rowAbsolute = isMissing(arg(args, 0, 'rowabsolute')) ? true : toBool(arg(args, 0, 'rowabsolute'));
        const columnAbsolute = isMissing(arg(args, 1, 'columnabsolute')) ? true : toBool(arg(args, 1, 'columnabsolute'));
        return boxAddress(this.box, rowAbsolute, columnAbsolute);
      }
      case 'cells':
        return model.cellsOf(this.sheet, this.box, args);
      case 'item':
        return model.cellsOf(this.sheet, this.box, args);
      case 'range': {
        const inner = model.rangeFromArgs(args, new WorksheetObject(model, this.sheet));
        return this.at({ r0: this.box.r0 + inner.box.r0, c0: this.box.c0 + inner.box.c0, r1: this.box.r0 + inner.box.r1, c1: this.box.c0 + inner.box.c1 });
      }
      case 'offset': {
        const dr = isMissing(arg(args, 0, 'rowoffset')) ? 0 : toInteger(arg(args, 0, 'rowoffset'));
        const dc = isMissing(arg(args, 1, 'columnoffset')) ? 0 : toInteger(arg(args, 1, 'columnoffset'));
        return this.at({ r0: this.box.r0 + dr, r1: this.box.r1 + dr, c0: this.box.c0 + dc, c1: this.box.c1 + dc });
      }
      case 'resize': {
        const rows = isMissing(arg(args, 0, 'rowsize')) ? this.rows : toInteger(arg(args, 0, 'rowsize'));
        const columns = isMissing(arg(args, 1, 'columnsize')) ? this.columns : toInteger(arg(args, 1, 'columnsize'));
        if (rows < 1 || columns < 1) throw new VbaError(1004, 'Resize cần số hàng và số cột >= 1');
        return this.at({ r0: this.box.r0, c0: this.box.c0, r1: this.box.r0 + rows - 1, c1: this.box.c0 + columns - 1 });
      }
      case 'rows': {
        if (!args.values.length) return this.at(this.box, 'rows');
        const index = toInteger(arg(args, 0)) - 1;
        return this.at({ r0: this.box.r0 + index, r1: this.box.r0 + index, c0: this.box.c0, c1: this.box.c1 });
      }
      case 'columns': {
        if (!args.values.length) return this.at(this.box, 'columns');
        const index = toInteger(arg(args, 0)) - 1;
        return this.at({ r0: this.box.r0, r1: this.box.r1, c0: this.box.c0 + index, c1: this.box.c0 + index });
      }
      case 'entirerow':
        return this.at({ r0: this.box.r0, r1: this.box.r1, c0: 0, c1: this.sheet.getMaxColumns() - 1 }, 'rows');
      case 'entirecolumn':
        return this.at({ r0: 0, r1: this.sheet.getMaxRows() - 1, c0: this.box.c0, c1: this.box.c1 }, 'columns');
      case 'end':
        return this.end(toInteger(arg(args, 0)));
      case 'currentregion':
        return this.currentRegion();
      case 'worksheet':
      case 'parent':
        return new WorksheetObject(model, this.sheet);
      case 'font':
        return new FontObject(this);
      case 'interior':
        return new InteriorObject(this);
      case 'borders':
        return args.values.length ? new BordersObject(this, toInteger(arg(args, 0))) : new BordersObject(this, null);
      case 'horizontalalignment':
        return ALIGN_FROM_UNIVER[this.style().ht ?? 0] ?? 1;
      case 'verticalalignment':
        return VALIGN_FROM_UNIVER[this.style().vt ?? 0] ?? -4107;
      case 'numberformat':
      case 'numberformatlocal':
        return this.style().n?.pattern ?? 'General';
      case 'wraptext':
        return this.style().tb === 3;
      case 'mergecells':
        return !!this.facade().isMerged?.();
      case 'mergearea':
        return this;
      case 'rowheight':
        return Math.round(this.sheet.getRowHeight(this.box.r0) * 0.75 * 100) / 100;
      case 'columnwidth':
        return Math.round(((this.sheet.getColumnWidth(this.box.c0) - 5) / 7) * 100) / 100;
      case 'hidden': {
        const hidden = this.sheet.getRowHeight(this.box.r0) === 0;
        return hidden;
      }
      case 'select':
      case 'activate':
        model.workbook().setActiveSheet(this.sheet);
        this.facade().activate();
        return undefined;
      case 'clearcontents':
        this.facade().clearContent();
        return undefined;
      case 'clearformats':
        this.facade().clearFormat();
        return undefined;
      case 'clear':
        this.facade().clear();
        return undefined;
      case 'merge':
        if (!this.facade().isMerged?.()) this.facade().merge();
        return undefined;
      case 'unmerge':
        this.facade().breakApart();
        return undefined;
      case 'insert': {
        if (this.iterateAs === 'rows' || (this.box.c0 === 0 && this.box.c1 === this.sheet.getMaxColumns() - 1)) this.sheet.insertRows(this.box.r0, this.rows);
        else if (this.iterateAs === 'columns' || (this.box.r0 === 0 && this.box.r1 === this.sheet.getMaxRows() - 1)) this.sheet.insertColumns(this.box.c0, this.columns);
        else {
          const shift = arg(args, 0, 'shift');
          this.facade().insertCells(!isMissing(shift) && toInteger(shift) === -4161 ? Dimension.COLUMNS : Dimension.ROWS);
        }
        return undefined;
      }
      case 'delete': {
        if (this.iterateAs === 'rows' || (this.box.c0 === 0 && this.box.c1 === this.sheet.getMaxColumns() - 1)) this.sheet.deleteRows(this.box.r0, this.rows);
        else if (this.iterateAs === 'columns' || (this.box.r0 === 0 && this.box.r1 === this.sheet.getMaxRows() - 1)) this.sheet.deleteColumns(this.box.c0, this.columns);
        else {
          const shift = arg(args, 0, 'shift');
          this.facade().deleteCells(!isMissing(shift) && toInteger(shift) === -4159 ? Dimension.COLUMNS : Dimension.ROWS);
        }
        return undefined;
      }
      case 'copy': {
        const destination = arg(args, 0, 'destination');
        if (destination instanceof RangeObject) this.copyTo(destination);
        else model.clipboard = { ws: this.sheet, box: this.box };
        return undefined;
      }
      case 'cut': {
        const destination = arg(args, 0, 'destination');
        if (destination instanceof RangeObject) {
          this.copyTo(destination);
          this.facade().clear();
        } else model.clipboard = { ws: this.sheet, box: this.box };
        return undefined;
      }
      case 'pastespecial': {
        const paste = arg(args, 0, 'paste');
        const type = isMissing(paste) ? -4104 : toInteger(paste);
        this.pasteFromClipboard(type === -4163 ? 'values' : type === -4122 ? 'formats' : 'all');
        return undefined;
      }
      case 'autofit':
        this.autoFit();
        return undefined;
      case 'find':
        return this.find(args);
      case 'sort':
        this.sortRows(args);
        return undefined;
      case 'filldown': {
        const source = this.at({ r0: this.box.r0, r1: this.box.r0, c0: this.box.c0, c1: this.box.c1 });
        const formulas = source.formula();
        const row: VbaValue[] = formulas instanceof VbaArray ? formulas.rows()[0] : [formulas];
        for (let r = 1; r < this.rows; r++) {
          row.forEach((cell, c) => {
            const text = toStr(cell);
            const target = this.at({ r0: this.box.r0 + r, r1: this.box.r0 + r, c0: this.box.c0 + c, c1: this.box.c0 + c });
            target.setFormula(text.startsWith('=') ? shiftFormula(text, r, 0) : text);
          });
        }
        return undefined;
      }
      case 'calculate':
        model.api.getFormula?.()?.executeCalculation?.();
        return undefined;
      case 'specialcells':
        throw new VbaError(1004, 'SpecialCells chưa được hỗ trợ trong Minh Sheets');
      case 'areas':
        return new PropertyBag('Areas', { count: 1 });
      default:
        return super.get(name, args);
    }
  }

  set(name: string, args: VbaArgs, value: VbaValue): boolean {
    switch (name) {
      case 'value':
      case 'value2':
        this.setValue(value);
        return true;
      case 'formula':
      case 'formulalocal':
        this.setFormula(value);
        return true;
      case 'horizontalalignment':
        this.setStyle('ht', ALIGN_TO_UNIVER[toInteger(value)] ?? 0);
        return true;
      case 'verticalalignment':
        this.setStyle('vt', VALIGN_TO_UNIVER[toInteger(value)] ?? 3);
        return true;
      case 'numberformat':
      case 'numberformatlocal':
        this.facade().setNumberFormat(toStr(value));
        return true;
      case 'wraptext':
        this.facade().setWrap(toBool(value ?? false));
        return true;
      case 'mergecells':
        if (toBool(value ?? false)) this.facade().merge();
        else this.facade().breakApart();
        return true;
      case 'rowheight': {
        const px = Math.max(0, Math.round(toNumber(value) / 0.75));
        for (let r = this.box.r0; r <= this.box.r1; r++) this.sheet.setRowHeight(r, px);
        return true;
      }
      case 'columnwidth': {
        const px = Math.max(0, Math.round(toNumber(value) * 7 + 5));
        for (let c = this.box.c0; c <= this.box.c1; c++) this.sheet.setColumnWidth(c, px);
        return true;
      }
      case 'hidden': {
        const hide = toBool(value ?? false);
        if (this.iterateAs === 'columns' || (this.box.r0 === 0 && this.box.r1 === this.sheet.getMaxRows() - 1)) {
          if (hide) this.sheet.hideColumns(this.box.c0, this.columns);
          else this.sheet.showColumns(this.box.c0, this.columns);
        } else if (hide) this.sheet.hideRows(this.box.r0, this.rows);
        else this.sheet.showRows(this.box.r0, this.rows);
        return true;
      }
      case 'name':
        this.model.workbook().insertDefinedName?.(toStr(value), `${String(this.sheet.getSheetName())}!${boxAddress(this.box)}`);
        return true;
      case 'locked':
      case 'indentlevel':
      case 'orientation':
      case 'shrinktofit':
        return true;
      case 'font':
      case 'interior':
        return false;
      default:
        return name === 'item' ? (this.model.cellsOf(this.sheet, this.box, args).setValue(value), true) : false;
    }
  }

  defaultGet(args: VbaArgs): VbaValue {
    if (args.values.length) return this.model.cellsOf(this.sheet, this.box, args);
    return this.value();
  }

  defaultSet(args: VbaArgs, value: VbaValue) {
    if (args.values.length) {
      this.model.cellsOf(this.sheet, this.box, args).setValue(value);
      return;
    }
    this.setValue(value);
  }

  items(): VbaValue[] {
    const box = this.iterateAs === 'cells' ? this.clampedBox() : this.box;
    const result: VbaValue[] = [];
    if (this.iterateAs === 'rows') {
      const last = Math.min(box.r1, Math.max(box.r0, this.sheet.getLastRow()));
      for (let r = box.r0; r <= last; r++) result.push(this.at({ r0: r, r1: r, c0: box.c0, c1: box.c1 }));
      return result;
    }
    if (this.iterateAs === 'columns') {
      const last = Math.min(box.c1, Math.max(box.c0, this.sheet.getLastColumn()));
      for (let c = box.c0; c <= last; c++) result.push(this.at({ r0: box.r0, r1: box.r1, c0: c, c1: c }));
      return result;
    }
    if ((box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1) > MAX_SCAN) throw new VbaError(1004, 'Vùng quá lớn để duyệt từng ô (trên 200.000 ô)');
    for (let r = box.r0; r <= box.r1; r++) for (let c = box.c0; c <= box.c1; c++) result.push(this.at({ r0: r, r1: r, c0: c, c1: c }));
    return result;
  }
}

export function shiftFormula(formula: string, rowDelta: number, columnDelta: number): string {
  if (!rowDelta && !columnDelta) return formula;
  return formula.replace(/("[^"]*")|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/gi, (match, quoted: string | undefined, colAbs: string, col: string, rowAbs: string, row: string) => {
    if (quoted) return match;
    const nextColumn = colAbs ? colIndex(col) : colIndex(col) + columnDelta;
    const nextRow = rowAbs ? Number(row) : Number(row) + rowDelta;
    if (nextColumn < 0 || nextRow < 1) return match;
    return `${colAbs}${colLabel(nextColumn)}${rowAbs}${nextRow}`;
  });
}

