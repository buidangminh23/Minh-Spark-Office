import { parseModule, type Arg, type DimItem, type Expr, type ParsedModule, type Proc, type Stmt } from './vbaParser';
import { BUILTINS, CONSTANTS, type BuiltinContext } from './vbaBuiltins';
import {
  MISSING,
  NOTHING,
  VbaArray,
  VbaCollection,
  VbaDate,
  VbaDictionary,
  VbaErrObject,
  VbaError,
  VbaObject,
  binaryOp,
  compareValues,
  isMissing,
  parseDateText,
  scalar,
  toBool,
  toInteger,
  toNumber,
  toStr,
  unaryOp,
  type VbaArgs,
  type VbaValue,
} from './vbaRuntime';

export interface VbaHost {
  readonly application: VbaObject & { hasGlobal(name: string): boolean };
  msgBox(prompt: string, buttons: number, title: string): number;
  inputBox(prompt: string, title: string, defaultValue: string): string;
  print(text: string): void;
  evaluateBracket(text: string): VbaValue;
  createObject(progId: string): VbaObject | null;
  documentObject?(target: string): VbaObject | null;
}

export interface VbaModuleSource {
  name: string;
  code: string;
  document?: string;
}

export interface VbaProcedureInfo {
  module: string;
  name: string;
  kind: Proc['kind'];
  isPrivate: boolean;
  paramCount: number;
  line: number;
}

class Box {
  v: VbaValue;
  typeName: string;
  constructor(value: VbaValue, typeName = 'variant') {
    this.v = value;
    this.typeName = typeName;
  }
}

class ExitSignal {
  readonly what: string;
  constructor(what: string) {
    this.what = what;
  }
}
class EndSignal {}
class GotoSignal {
  readonly label: string;
  constructor(label: string) {
    this.label = label;
  }
}
class ResumeSignal {
  readonly mode: 'next' | 'here' | 'label';
  readonly label?: string;
  constructor(mode: 'next' | 'here' | 'label', label?: string) {
    this.mode = mode;
    this.label = label;
  }
}

const isSignal = (error: unknown) => error instanceof ExitSignal || error instanceof EndSignal || error instanceof GotoSignal || error instanceof ResumeSignal;

interface ModuleRuntime {
  name: string;
  parsed: ParsedModule;
  vars: Map<string, Box>;
  procs: Map<string, Proc>;
  initialized: boolean;
  document?: string;
}

interface Frame {
  module: ModuleRuntime;
  proc: Proc;
  vars: Map<string, Box>;
  withStack: VbaValue[];
  onError: { mode: 'none' | 'resume' | 'label'; label?: string };
  inHandler: boolean;
  topBody: Stmt[];
  topIndex: number;
  resumeAt: number;
}

const NUMERIC_TYPES = new Set(['integer', 'long', 'longlong', 'longptr', 'byte']);
const FLOAT_TYPES = new Set(['double', 'single', 'currency', 'decimal']);

function defaultFor(typeName: string): VbaValue {
  if (NUMERIC_TYPES.has(typeName) || FLOAT_TYPES.has(typeName)) return 0;
  if (typeName === 'string') return '';
  if (typeName === 'boolean') return false;
  if (typeName === 'date') return new VbaDate(0);
  if (typeName === 'variant') return undefined;
  return NOTHING;
}

function coerce(value: VbaValue, typeName: string): VbaValue {
  if (typeName === 'variant' || typeName === 'object') return value;
  if (value instanceof VbaObject || value === NOTHING || value instanceof VbaArray) return value;
  if (NUMERIC_TYPES.has(typeName)) {
    const result = toInteger(value);
    if (typeName === 'integer' && (result < -32768 || result > 32767)) throw new VbaError(6, `Tràn số: ${result} vượt giới hạn Integer`);
    if (typeName === 'byte' && (result < 0 || result > 255)) throw new VbaError(6, `Tràn số: ${result} vượt giới hạn Byte`);
    return result;
  }
  if (FLOAT_TYPES.has(typeName)) return toNumber(value);
  if (typeName === 'string') return toStr(value);
  if (typeName === 'boolean') return toBool(value);
  if (typeName === 'date') {
    const v = scalar(value);
    if (v instanceof VbaDate) return v;
    if (typeof v === 'string') {
      const serial = parseDateText(v);
      if (serial === null) throw new VbaError(13, `"${v}" không phải ngày tháng`);
      return new VbaDate(serial);
    }
    return new VbaDate(toNumber(v));
  }
  return value;
}

export class VbaRunLimitError extends VbaError {}

export class VbaInterpreter {
  private readonly modules: ModuleRuntime[] = [];
  private readonly host: VbaHost;
  private readonly err = new VbaErrObject();
  private steps = 0;
  private startedAt = 0;
  private depth = 0;
  readonly maxSteps: number;
  readonly maxMilliseconds: number;
  private randomState = 0x2f6b9a51;

  constructor(sources: VbaModuleSource[], host: VbaHost, options: { maxSteps?: number; maxMilliseconds?: number } = {}) {
    this.host = host;
    this.maxSteps = options.maxSteps ?? 20_000_000;
    this.maxMilliseconds = options.maxMilliseconds ?? 60_000;
    for (const source of sources) {
      let parsed: ParsedModule;
      try {
        parsed = parseModule(source.name, source.code);
      } catch (error) {
        if (error instanceof Error) error.message = `${source.name}: ${error.message}`;
        throw error;
      }
      const procs = new Map<string, Proc>();
      for (const proc of parsed.procs) {
        const key = proc.kind === 'let' || proc.kind === 'set' ? `${proc.name.toLowerCase()}#${proc.kind}` : proc.name.toLowerCase();
        procs.set(key, proc);
      }
      this.modules.push({ name: source.name, parsed, vars: new Map(), procs, initialized: false, document: source.document });
    }
  }

  procedures(): VbaProcedureInfo[] {
    return this.modules.flatMap((module) =>
      module.parsed.procs.map((proc) => ({ module: module.name, name: proc.name, kind: proc.kind, isPrivate: proc.isPrivate, paramCount: proc.params.length, line: proc.line }))
    );
  }

  private findProc(name: string, preferred?: ModuleRuntime): { module: ModuleRuntime; proc: Proc } | null {
    const lower = name.toLowerCase();
    const dot = lower.indexOf('.');
    if (dot > 0) {
      const moduleName = lower.slice(0, dot);
      const module = this.modules.find((item) => item.name.toLowerCase() === moduleName);
      const proc = module?.procs.get(lower.slice(dot + 1));
      return module && proc ? { module, proc } : null;
    }
    if (preferred?.procs.has(lower)) return { module: preferred, proc: preferred.procs.get(lower)! };
    for (const module of this.modules) {
      const proc = module.procs.get(lower);
      if (proc && !proc.isPrivate) return { module, proc };
    }
    return null;
  }

  private ensureModule(module: ModuleRuntime) {
    if (module.initialized) return;
    module.initialized = true;
    const frame = this.newFrame(module, { kind: 'sub', name: '(module)', params: [], body: [], isPrivate: true, line: 0 }, module.vars);
    for (const statement of module.parsed.declarations) this.execStmt(statement, frame);
  }

  private newFrame(module: ModuleRuntime, proc: Proc, vars = new Map<string, Box>()): Frame {
    return { module, proc, vars, withStack: [], onError: { mode: 'none' }, inHandler: false, topBody: proc.body, topIndex: 0, resumeAt: 0 };
  }

  run(name: string, args: VbaValue[] = []): VbaValue {
    this.steps = 0;
    this.startedAt = Date.now();
    this.depth = 0;
    this.err.clear();
    for (const module of this.modules) this.ensureModule(module);
    const target = this.findProc(name);
    if (!target) throw new VbaError(1004, `Không tìm thấy macro "${name}"`);
    try {
      return this.callProc(target.module, target.proc, args.map((value) => ({ value })), null);
    } catch (error) {
      if (error instanceof EndSignal) return undefined;
      if (error instanceof ExitSignal) return undefined;
      throw error;
    }
  }

  private tick(line: number) {
    this.steps += 1;
    if (this.steps > this.maxSteps) throw new VbaRunLimitError(1004, `Macro dừng ở dòng ${line}: chạy quá ${this.maxSteps.toLocaleString('vi-VN')} bước, có thể bị vòng lặp vô hạn`);
    if ((this.steps & 0x3fff) === 0 && Date.now() - this.startedAt > this.maxMilliseconds) {
      throw new VbaRunLimitError(1004, `Macro dừng ở dòng ${line}: chạy quá ${Math.round(this.maxMilliseconds / 1000)} giây`);
    }
  }

  private callProc(module: ModuleRuntime, proc: Proc, args: Array<{ value: VbaValue; box?: Box; name?: string }>, _caller: Frame | null): VbaValue {
    this.depth += 1;
    if (this.depth > 400) throw new VbaError(28, 'Hết bộ nhớ ngăn xếp: gọi đệ quy quá sâu');
    try {
      const frame = this.newFrame(module, proc);
      const positional = args.filter((item) => !item.name);
      proc.params.forEach((param, index) => {
        const key = param.name.toLowerCase();
        if (param.paramArray) {
          frame.vars.set(key, new Box(VbaArray.fromList(positional.slice(index).map((item) => item.value))));
          return;
        }
        const named = args.find((item) => item.name === key);
        const supplied = named ?? positional[index];
        if (!supplied || supplied.value === MISSING) {
          if (!param.optional) throw new VbaError(450, `Thiếu đối số "${param.name}" khi gọi ${proc.name}`);
          frame.vars.set(key, new Box(param.defaultExpr ? this.evalValue(param.defaultExpr, frame) : MISSING));
          return;
        }
        if (supplied.box && !param.byVal) frame.vars.set(key, supplied.box);
        else frame.vars.set(key, new Box(supplied.value));
      });
      if (proc.kind === 'function' || proc.kind === 'get') frame.vars.set(proc.name.toLowerCase(), new Box(undefined));
      try {
        this.execBlock(proc.body, frame);
      } catch (error) {
        if (!(error instanceof ExitSignal) || !['sub', 'function', 'property'].includes(error.what)) throw error;
      }
      if (proc.kind === 'function' || proc.kind === 'get') return frame.vars.get(proc.name.toLowerCase())?.v;
      return undefined;
    } finally {
      this.depth -= 1;
    }
  }

  private execBlock(body: Stmt[], frame: Frame) {
    const isTop = body === frame.topBody;
    let labels: Map<string, number> | null = null;
    const labelIndex = (name: string) => {
      if (!labels) {
        labels = new Map();
        body.forEach((statement, index) => {
          if (statement.k === 'label') labels!.set(statement.name, index);
        });
      }
      return labels.get(name);
    };
    let index = 0;
    while (index < body.length) {
      const statement = body[index];
      if (isTop) frame.topIndex = index;
      try {
        this.execStmt(statement, frame);
        index += 1;
      } catch (error) {
        if (error instanceof GotoSignal) {
          const target = labelIndex(error.label);
          if (target === undefined) throw error;
          index = target + 1;
          continue;
        }
        if (error instanceof ResumeSignal && isTop) {
          frame.inHandler = false;
          if (error.mode === 'label') {
            const target = labelIndex(error.label!);
            if (target === undefined) throw new VbaError(1004, `Không có nhãn "${error.label}"`);
            index = target + 1;
          } else index = error.mode === 'next' ? frame.resumeAt + 1 : frame.resumeAt;
          continue;
        }
        if (isSignal(error)) throw error;
        const vbaError = this.toVbaError(error, statement.line, frame);
        if (frame.onError.mode === 'resume') {
          this.err.capture(vbaError);
          index += 1;
          continue;
        }
        if (frame.onError.mode === 'label' && !frame.inHandler) {
          this.err.capture(vbaError);
          frame.inHandler = true;
          frame.resumeAt = frame.topIndex;
          const handler = labelIndex(frame.onError.label!);
          if (handler !== undefined) {
            index = handler + 1;
            continue;
          }
          throw new GotoSignal(frame.onError.label!);
        }
        throw vbaError;
      }
    }
  }

  private toVbaError(error: unknown, line: number, frame: Frame): VbaError {
    if (error instanceof VbaError) {
      if (!error.line) {
        error.line = line;
        error.source = `${frame.module.name}.${frame.proc.name}`;
      }
      return error;
    }
    const wrapped = new VbaError(1004, error instanceof Error ? error.message : String(error));
    wrapped.line = line;
    wrapped.source = `${frame.module.name}.${frame.proc.name}`;
    return wrapped;
  }

  private execStmt(statement: Stmt, frame: Frame) {
    this.tick(statement.line);
    switch (statement.k) {
      case 'dim':
        for (const item of statement.items) this.declare(item, frame, statement.isStatic);
        return;
      case 'const':
        for (const item of statement.items) frame.vars.set(item.name.toLowerCase(), new Box(this.evalValue(item.expr, frame)));
        return;
      case 'redim':
        for (const item of statement.items) this.redim(item, frame, statement.preserve);
        return;
      case 'erase':
        for (const name of statement.names) {
          const box = this.lookupBox(name.toLowerCase(), frame);
          if (box?.v instanceof VbaArray) box.v = new VbaArray(box.v.bounds, defaultFor(box.typeName));
        }
        return;
      case 'assign':
        this.assign(statement.target, statement.expr, statement.isSet, frame);
        return;
      case 'call':
        this.evalCallStatement(statement.expr, frame);
        return;
      case 'if': {
        for (const branch of statement.branches) {
          if (toBool(this.evalValue(branch.cond, frame) ?? false)) {
            this.execBlock(branch.body, frame);
            return;
          }
        }
        if (statement.elseBody) this.execBlock(statement.elseBody, frame);
        return;
      }
      case 'for':
        this.execFor(statement, frame);
        return;
      case 'foreach':
        this.execForEach(statement, frame);
        return;
      case 'do':
        this.execDo(statement, frame);
        return;
      case 'select':
        this.execSelect(statement, frame);
        return;
      case 'with': {
        frame.withStack.push(this.evalExpr(statement.obj, frame));
        try {
          this.execBlock(statement.body, frame);
        } finally {
          frame.withStack.pop();
        }
        return;
      }
      case 'exit':
        throw new ExitSignal(statement.what);
      case 'end':
        throw new EndSignal();
      case 'onerror':
        frame.onError = statement.mode === 'goto0' ? { mode: 'none' } : statement.mode === 'resume' ? { mode: 'resume' } : { mode: 'label', label: statement.label };
        if (statement.mode !== 'label') this.err.clear();
        frame.inHandler = false;
        return;
      case 'goto':
        throw new GotoSignal(statement.label);
      case 'resume':
        this.err.clear();
        throw new ResumeSignal(statement.mode, statement.label);
      case 'print':
        this.host.print(statement.args.map((expr) => toStr(this.evalValue(expr, frame))).join(' '));
        return;
      case 'label':
      case 'nop':
        return;
    }
  }

  private declare(item: DimItem, frame: Frame, isStatic: boolean) {
    const key = item.name.toLowerCase();
    if (isStatic && frame.module.vars.has(`${frame.proc.name.toLowerCase()}::${key}`)) {
      frame.vars.set(key, frame.module.vars.get(`${frame.proc.name.toLowerCase()}::${key}`)!);
      return;
    }
    let value: VbaValue;
    if (item.isArray) value = item.bounds ? new VbaArray(this.evalBounds(item.bounds, frame), defaultFor(item.typeName)) : new VbaArray([]);
    else if (item.isNew) value = this.createNew(item.typeName, frame);
    else value = defaultFor(item.typeName);
    const box = new Box(value, item.isArray ? 'variant' : item.typeName);
    if (item.isArray) box.typeName = item.typeName;
    frame.vars.set(key, box);
    if (isStatic) frame.module.vars.set(`${frame.proc.name.toLowerCase()}::${key}`, box);
  }

  private evalBounds(bounds: NonNullable<DimItem['bounds']>, frame: Frame) {
    return bounds.map((bound) => ({
      lb: bound.lower ? toInteger(this.evalValue(bound.lower, frame)) : frame.module.parsed.optionBase,
      ub: toInteger(this.evalValue(bound.upper, frame)),
    }));
  }

  private redim(item: DimItem, frame: Frame, preserve: boolean) {
    const key = item.name.toLowerCase();
    let box = this.lookupBox(key, frame);
    if (!box) {
      box = new Box(undefined, item.typeName);
      frame.vars.set(key, box);
    }
    if (!item.bounds) throw new VbaError(5, 'ReDim cần kích thước');
    const typeName = item.typeName !== 'variant' ? item.typeName : box.typeName;
    const next = new VbaArray(this.evalBounds(item.bounds, frame), defaultFor(typeName));
    const previous = box.v;
    if (preserve && previous instanceof VbaArray && previous.data.length) {
      if (previous.bounds.length === 1) {
        for (let i = previous.bounds[0].lb; i <= Math.min(previous.bounds[0].ub, next.bounds[0].ub); i++) next.set([i], previous.get([i]));
      } else {
        const rows = previous.bounds[0];
        const columns = previous.bounds[1];
        for (let r = rows.lb; r <= Math.min(rows.ub, next.bounds[0].ub); r++) {
          for (let c = columns.lb; c <= Math.min(columns.ub, next.bounds[1].ub); c++) next.set([r, c], previous.get([r, c]));
        }
      }
    }
    box.v = next;
    box.typeName = typeName;
  }

  private createNew(typeName: string, _frame: Frame): VbaValue {
    const name = typeName.toLowerCase();
    if (name === 'collection' || name === 'vba.collection') return new VbaCollection();
    if (name === 'dictionary' || name === 'scripting.dictionary') return new VbaDictionary();
    const created = this.host.createObject(name);
    if (created) return created;
    throw new VbaError(429, `Chưa hỗ trợ tạo đối tượng "${typeName}"`);
  }

  private lookupBox(name: string, frame: Frame): Box | undefined {
    const local = frame.vars.get(name);
    if (local) return local;
    const moduleVar = frame.module.vars.get(name);
    if (moduleVar) return moduleVar;
    for (const module of this.modules) {
      if (module === frame.module) continue;
      const box = module.vars.get(name);
      if (box) return box;
    }
    return undefined;
  }

  private execFor(statement: Extract<Stmt, { k: 'for' }>, frame: Frame) {
    const key = statement.varName.toLowerCase();
    let box = this.lookupBox(key, frame);
    if (!box) {
      if (frame.module.parsed.optionExplicit) throw new VbaError(1004, `Biến chưa khai báo: ${statement.varName} (Option Explicit)`);
      box = new Box(undefined);
      frame.vars.set(key, box);
    }
    const start = toNumber(this.evalValue(statement.from, frame));
    const end = toNumber(this.evalValue(statement.to, frame));
    const step = statement.step ? toNumber(this.evalValue(statement.step, frame)) : 1;
    box.v = coerce(start, box.typeName);
    while (step >= 0 ? toNumber(box.v) <= end : toNumber(box.v) >= end) {
      try {
        this.execBlock(statement.body, frame);
      } catch (error) {
        if (error instanceof ExitSignal && error.what === 'for') return;
        throw error;
      }
      box.v = coerce(toNumber(box.v) + step, box.typeName);
      this.tick(statement.line);
    }
  }

  private execForEach(statement: Extract<Stmt, { k: 'foreach' }>, frame: Frame) {
    const key = statement.varName.toLowerCase();
    let box = this.lookupBox(key, frame);
    if (!box) {
      box = new Box(undefined);
      frame.vars.set(key, box);
    }
    const source = this.evalExpr(statement.coll, frame);
    let items: VbaValue[];
    if (source instanceof VbaArray) items = source.data.slice();
    else if (source instanceof VbaObject) items = source.items();
    else throw new VbaError(92, 'For Each cần một mảng, Collection hoặc vùng ô');
    for (const item of items) {
      box.v = item;
      try {
        this.execBlock(statement.body, frame);
      } catch (error) {
        if (error instanceof ExitSignal && error.what === 'for') return;
        throw error;
      }
    }
  }

  private execDo(statement: Extract<Stmt, { k: 'do' }>, frame: Frame) {
    const holds = (condition: { until: boolean; cond: Expr }) => {
      const value = toBool(this.evalValue(condition.cond, frame) ?? false);
      return condition.until ? !value : value;
    };
    while (true) {
      if (statement.pre && !holds(statement.pre)) return;
      try {
        this.execBlock(statement.body, frame);
      } catch (error) {
        if (error instanceof ExitSignal && error.what === 'do') return;
        throw error;
      }
      if (statement.post && !holds(statement.post)) return;
      this.tick(statement.line);
    }
  }

  private execSelect(statement: Extract<Stmt, { k: 'select' }>, frame: Frame) {
    const subject = this.evalValue(statement.expr, frame);
    const textCompare = frame.module.parsed.optionCompareText;
    for (const item of statement.cases) {
      const matched = item.tests.some((test) => {
        if (test.kind === 'value') return compareValues(subject, this.evalValue(test.e, frame), textCompare) === 0;
        if (test.kind === 'range') {
          return compareValues(subject, this.evalValue(test.from, frame), textCompare) >= 0 && compareValues(subject, this.evalValue(test.to, frame), textCompare) <= 0;
        }
        return toBool(binaryOp(test.op, subject, this.evalValue(test.e, frame), textCompare) ?? false);
      });
      if (matched) {
        this.execBlock(item.body, frame);
        return;
      }
    }
    if (statement.elseBody) this.execBlock(statement.elseBody, frame);
  }

  private evalArgs(args: Arg[], frame: Frame): VbaArgs {
    return {
      values: args.map((item) => (item.expr ? this.evalExpr(item.expr, frame) : MISSING)),
      names: args.map((item) => item.name),
    };
  }

  private procArgs(args: Arg[], frame: Frame): Array<{ value: VbaValue; box?: Box; name?: string }> {
    return args.map((item): { value: VbaValue; box?: Box; name?: string } => {
      if (!item.expr) return { value: MISSING as VbaValue, name: item.name };
      if (item.expr.t === 'id') {
        const box = this.lookupBox(item.expr.name, frame);
        if (box) return { value: box.v, box, name: item.name };
      }
      return { value: this.evalExpr(item.expr, frame), name: item.name };
    });
  }

  evalValue(expr: Expr, frame: Frame): VbaValue {
    const value = this.evalExpr(expr, frame);
    return value instanceof VbaObject ? scalar(value) : value;
  }

  private withTarget(frame: Frame): VbaValue {
    const target = frame.withStack[frame.withStack.length - 1];
    if (target === undefined) throw new VbaError(91, 'Dấu "." đứng đầu nhưng không nằm trong khối With');
    return target;
  }

  private objectOf(value: VbaValue, name: string): VbaObject {
    if (value instanceof VbaObject) return value;
    if (value === NOTHING) throw new VbaError(91, `Biến đối tượng chưa được gán khi dùng ".${name}"`);
    throw new VbaError(424, `Cần một đối tượng trước ".${name}"`);
  }

  private evalExpr(expr: Expr, frame: Frame): VbaValue {
    switch (expr.t) {
      case 'num':
        return expr.v;
      case 'str':
        return expr.v;
      case 'date': {
        const serial = parseDateText(expr.v);
        if (serial === null) throw new VbaError(13, `Ngày "#${expr.v}#" không hợp lệ`);
        return new VbaDate(serial);
      }
      case 'bracket':
        return this.host.evaluateBracket(expr.text);
      case 'id':
        return this.resolveName(expr.name, frame);
      case 'member': {
        const owner = expr.obj ? this.evalExpr(expr.obj, frame) : this.withTarget(frame);
        return this.memberGet(owner, expr.name, { values: [], names: [] }, frame);
      }
      case 'bang': {
        const owner = this.objectOf(this.evalExpr(expr.obj, frame), expr.name);
        return owner.defaultGet({ values: [expr.name], names: [undefined] });
      }
      case 'call':
        return this.evalCall(expr, frame);
      case 'bin': {
        if (expr.op === 'is') return binaryOp('is', this.evalExpr(expr.l, frame), this.evalExpr(expr.r, frame), false);
        return binaryOp(expr.op, this.evalExpr(expr.l, frame), this.evalExpr(expr.r, frame), frame.module.parsed.optionCompareText);
      }
      case 'un':
        return unaryOp(expr.op, this.evalExpr(expr.e, frame));
      case 'new':
        return this.createNew(expr.typeName, frame);
    }
  }

  runByName(args: VbaArgs): VbaValue {
    const name = toStr(args.values[0]);
    const target = this.findProc(name.replace(/^.*!/, '').replace(/^'|'$/g, ''));
    if (!target) throw new VbaError(1004, `Không tìm thấy macro "${name}"`);
    return this.callProc(target.module, target.proc, args.values.slice(1).map((value) => ({ value })), null);
  }

  documentOf(module: ModuleRuntime): VbaObject | null {
    if (!module.document) return null;
    return this.host.documentObject?.(module.document) ?? null;
  }

  private moduleValue(module: ModuleRuntime): VbaValue {
    const document = this.documentOf(module);
    if (document && module.procs.size === 0 && module.vars.size === 0) return document;
    return new ModuleObject(this, module, document);
  }

  invokeModule(module: ModuleRuntime, name: string, args: VbaArgs): VbaValue {
    const proc = module.procs.get(name);
    if (!proc) {
      const box = module.vars.get(name);
      if (box) return box.v;
      throw new VbaError(438, `Module ${module.name} không có "${name}"`);
    }
    return this.callProc(module, proc, args.values.map((value, index) => ({ value, name: args.names[index] })), null);
  }

  private memberGet(owner: VbaValue, name: string, args: VbaArgs, _frame: Frame): VbaValue {
    if (owner === this.host.application && name === 'run') return this.runByName(args);
    if (owner instanceof VbaArray) throw new VbaError(424, `Mảng không có thành phần ".${name}"`);
    return this.objectOf(owner, name).get(name, args);
  }

  private builtinContext(frame: Frame): BuiltinContext {
    return {
      msgBox: (prompt, buttons, title) => this.host.msgBox(prompt, buttons, title),
      inputBox: (prompt, title, defaultValue) => this.host.inputBox(prompt, title, defaultValue),
      textCompare: frame.module.parsed.optionCompareText,
      random: () => {
        this.randomState = (this.randomState * 1103515245 + 12345) & 0x7fffffff;
        return Math.random();
      },
    };
  }

  private resolveName(name: string, frame: Frame, args?: Arg[]): VbaValue {
    const box = this.lookupBox(name, frame);
    const isSelfCall = !!args && frame.proc.name.toLowerCase() === name && (frame.proc.kind === 'function' || frame.proc.kind === 'get') && frame.vars.get(name) === box;
    if (box && !isSelfCall) {
      if (!args) return box.v === MISSING ? undefined : box.v;
      return this.applyArgs(box.v, this.evalArgs(args, frame), name);
    }
    if (name === 'err') return args ? this.err.get('number', this.evalArgs(args, frame)) : this.err;
    const target = this.findProc(name, frame.module);
    if (target) return this.callProc(target.module, target.proc, this.procArgs(args ?? [], frame), frame);
    const moduleRuntime = this.modules.find((item) => item.name.toLowerCase() === name);
    if (moduleRuntime && !args) return this.moduleValue(moduleRuntime);
    if (name === 'createobject' || name === 'getobject') {
      const progId = toStr(this.evalValue(args?.[0]?.expr ?? { t: 'str', v: '' }, frame));
      return this.createNew(progId, frame);
    }
    if (name === 'debug') return new DebugObject(this.host);
    const builtin = BUILTINS[name];
    if (builtin) return builtin(this.evalArgs(args ?? [], frame), this.builtinContext(frame));
    if (name in CONSTANTS) {
      if (args) throw new VbaError(13, `"${name}" là hằng số, không gọi được`);
      return CONSTANTS[name];
    }
    if (this.host.application.hasGlobal(name)) return this.host.application.get(name, this.evalArgs(args ?? [], frame));
    if (frame.module.parsed.optionExplicit) throw new VbaError(1004, `Biến chưa khai báo: ${name} (Option Explicit)`);
    if (args) throw new VbaError(35, `Không tìm thấy hàm hoặc thủ tục "${name}"`);
    const created = new Box(undefined);
    frame.vars.set(name, created);
    return undefined;
  }

  private applyArgs(value: VbaValue, args: VbaArgs, name: string): VbaValue {
    if (!args.values.length) return value;
    if (value instanceof VbaArray) return value.get(args.values.map((item) => toInteger(item)));
    if (value instanceof VbaObject) return value.defaultGet(args);
    throw new VbaError(13, `"${name}" không phải mảng hay đối tượng nên không nhận chỉ số`);
  }

  private evalCall(expr: Extract<Expr, { t: 'call' }>, frame: Frame): VbaValue {
    const callee = expr.callee;
    if (callee.t === 'id') return this.resolveName(callee.name, frame, expr.args);
    if (callee.t === 'member') {
      const owner = callee.obj ? this.evalExpr(callee.obj, frame) : this.withTarget(frame);
      if (owner instanceof ModuleObject && owner.hasProc(callee.name)) return this.callProc(owner.module, owner.procFor(callee.name), this.procArgs(expr.args, frame), frame);
      if (owner === this.host.application && callee.name === 'run') return this.runByName(this.evalArgs(expr.args, frame));
      return this.memberGet(owner, callee.name, this.evalArgs(expr.args, frame), frame);
    }
    const value = this.evalExpr(callee, frame);
    return this.applyArgs(value, this.evalArgs(expr.args, frame), 'biểu thức');
  }

  private evalCallStatement(expr: Expr, frame: Frame) {
    if (expr.t === 'id') {
      const target = this.findProc(expr.name, frame.module);
      if (target) {
        this.callProc(target.module, target.proc, [], frame);
        return;
      }
    }
    if (expr.t === 'member' && expr.obj === null) {
      this.memberGet(this.withTarget(frame), expr.name, { values: [], names: [] }, frame);
      return;
    }
    this.evalExpr(expr, frame);
  }

  private assign(target: Expr, valueExpr: Expr, isSet: boolean, frame: Frame) {
    let value = this.evalExpr(valueExpr, frame);
    if (!isSet && value instanceof VbaObject) value = scalar(value);
    if (isSet && !(value instanceof VbaObject) && value !== NOTHING) throw new VbaError(424, 'Set cần một đối tượng ở vế phải');
    switch (target.t) {
      case 'id': {
        const box = this.lookupBox(target.name, frame);
        if (box) {
          if (!isSet && box.v instanceof VbaObject && !(value instanceof VbaObject) && !(box.v instanceof VbaCollection) && !(box.v instanceof VbaDictionary)) {
            box.v.defaultSet({ values: [], names: [] }, value);
            return;
          }
          box.v = coerce(value, box.typeName);
          return;
        }
        if (this.host.application.hasGlobal(target.name)) {
          this.host.application.set(target.name, { values: [], names: [] }, value);
          return;
        }
        if (frame.module.parsed.optionExplicit) throw new VbaError(1004, `Biến chưa khai báo: ${target.name} (Option Explicit)`);
        frame.vars.set(target.name, new Box(value));
        return;
      }
      case 'member': {
        const owner = this.objectOf(target.obj ? this.evalExpr(target.obj, frame) : this.withTarget(frame), target.name);
        if (!owner.set(target.name, { values: [], names: [] }, value)) {
          throw new VbaError(438, `Không gán được ${owner.typeName}.${target.name}`);
        }
        return;
      }
      case 'bang': {
        const owner = this.objectOf(this.evalExpr(target.obj, frame), target.name);
        owner.defaultSet({ values: [target.name], names: [undefined] }, value);
        return;
      }
      case 'bracket':
        this.objectOf(this.host.evaluateBracket(target.text), target.text).defaultSet({ values: [], names: [] }, value);
        return;
      case 'call': {
        const args = this.evalArgs(target.args, frame);
        const callee = target.callee;
        if (callee.t === 'id') {
          const box = this.lookupBox(callee.name, frame);
          if (box?.v instanceof VbaArray) {
            box.v.set(args.values.map((item) => toInteger(item)), value);
            return;
          }
          if (box?.v instanceof VbaObject) {
            box.v.defaultSet(args, value);
            return;
          }
          if (box) throw new VbaError(13, `"${callee.name}" không phải mảng`);
          if (this.host.application.hasGlobal(callee.name)) {
            const result = this.host.application.get(callee.name, args);
            this.objectOf(result, callee.name).defaultSet({ values: [], names: [] }, value);
            return;
          }
          throw new VbaError(9, `Mảng "${callee.name}" chưa được khai báo`);
        }
        if (callee.t === 'member') {
          const owner = this.objectOf(callee.obj ? this.evalExpr(callee.obj, frame) : this.withTarget(frame), callee.name);
          if (owner.set(callee.name, args, value)) return;
          const result = owner.get(callee.name, args);
          this.objectOf(result, callee.name).defaultSet({ values: [], names: [] }, value);
          return;
        }
        const result = this.evalExpr(target, frame);
        this.objectOf(result, 'giá trị').defaultSet({ values: [], names: [] }, value);
        return;
      }
      default:
        throw new VbaError(424, 'Vế trái của phép gán không hợp lệ');
    }
  }
}

class ModuleObject extends VbaObject {
  readonly typeName: string;
  readonly module: ModuleRuntime;
  private readonly interpreter: VbaInterpreter;
  private readonly document: VbaObject | null;
  constructor(interpreter: VbaInterpreter, module: ModuleRuntime, document: VbaObject | null = null) {
    super();
    this.interpreter = interpreter;
    this.module = module;
    this.document = document;
    this.typeName = document?.typeName ?? 'Module';
  }
  hasProc(name: string): boolean {
    return this.module.procs.has(name) || !this.document;
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (this.document && !this.module.procs.has(name) && !this.module.vars.has(name)) return this.document.get(name, args);
    return this.interpreter.invokeModule(this.module, name, args);
  }
  set(name: string, args: VbaArgs, value: VbaValue): boolean {
    return this.document ? this.document.set(name, args, value) : super.set(name, args, value);
  }
  defaultGet(args: VbaArgs): VbaValue {
    return this.document ? this.document.defaultGet(args) : super.defaultGet(args);
  }
  procFor(name: string): Proc {
    const proc = this.module.procs.get(name);
    if (!proc) throw new VbaError(438, `Module ${this.module.name} không có thủ tục "${name}"`);
    return proc;
  }
}

class DebugObject extends VbaObject {
  readonly typeName = 'Debug';
  private readonly host: VbaHost;
  constructor(host: VbaHost) {
    super();
    this.host = host;
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'print') {
      this.host.print(args.values.map((value) => (isMissing(value) ? '' : toStr(value))).join(' '));
      return undefined;
    }
    if (name === 'assert') {
      if (!toBool(args.values[0] ?? true)) throw new VbaError(1004, 'Debug.Assert không thoả');
      return undefined;
    }
    return super.get(name, args);
  }
}

export function listProcedures(sources: VbaModuleSource[]): { procedures: VbaProcedureInfo[]; errors: string[] } {
  const procedures: VbaProcedureInfo[] = [];
  const errors: string[] = [];
  for (const source of sources) {
    try {
      const parsed = parseModule(source.name, source.code);
      for (const proc of parsed.procs) {
        procedures.push({ module: source.name, name: proc.name, kind: proc.kind, isPrivate: proc.isPrivate, paramCount: proc.params.length, line: proc.line });
      }
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { procedures, errors };
}

export function runnableMacros(sources: VbaModuleSource[]) {
  return listProcedures(sources).procedures.filter((proc) => proc.kind === 'sub' && !proc.isPrivate && proc.paramCount === 0);
}
