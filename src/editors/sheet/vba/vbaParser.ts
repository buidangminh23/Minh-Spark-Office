import { tokenize, VbaSyntaxError, type Token } from './vbaLexer';

export type Arg = { expr: Expr | null; name?: string };

export type Expr =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'date'; v: string }
  | { t: 'id'; name: string; line: number }
  | { t: 'member'; obj: Expr | null; name: string; line: number }
  | { t: 'bang'; obj: Expr; name: string; line: number }
  | { t: 'call'; callee: Expr; args: Arg[]; line: number }
  | { t: 'bin'; op: string; l: Expr; r: Expr; line: number }
  | { t: 'un'; op: string; e: Expr; line: number }
  | { t: 'new'; typeName: string; line: number }
  | { t: 'bracket'; text: string; line: number };

export type DimItem = { name: string; bounds: Array<{ lower: Expr | null; upper: Expr }> | null; isArray: boolean; isNew: boolean; typeName: string };
export type CaseTest = { kind: 'value'; e: Expr } | { kind: 'range'; from: Expr; to: Expr } | { kind: 'is'; op: string; e: Expr };

export type Stmt = { line: number } & (
  | { k: 'dim'; items: DimItem[]; isStatic: boolean }
  | { k: 'const'; items: Array<{ name: string; expr: Expr }> }
  | { k: 'assign'; target: Expr; expr: Expr; isSet: boolean }
  | { k: 'call'; expr: Expr }
  | { k: 'if'; branches: Array<{ cond: Expr; body: Stmt[] }>; elseBody: Stmt[] | null }
  | { k: 'for'; varName: string; from: Expr; to: Expr; step: Expr | null; body: Stmt[] }
  | { k: 'foreach'; varName: string; coll: Expr; body: Stmt[] }
  | { k: 'do'; pre: { until: boolean; cond: Expr } | null; post: { until: boolean; cond: Expr } | null; body: Stmt[] }
  | { k: 'select'; expr: Expr; cases: Array<{ tests: CaseTest[]; body: Stmt[] }>; elseBody: Stmt[] | null }
  | { k: 'with'; obj: Expr; body: Stmt[] }
  | { k: 'exit'; what: string }
  | { k: 'onerror'; mode: 'resume' | 'goto0' | 'label'; label?: string }
  | { k: 'goto'; label: string }
  | { k: 'label'; name: string }
  | { k: 'resume'; mode: 'next' | 'here' | 'label'; label?: string }
  | { k: 'redim'; preserve: boolean; items: DimItem[] }
  | { k: 'erase'; names: string[] }
  | { k: 'print'; args: Expr[] }
  | { k: 'end' }
  | { k: 'nop' }
);

export type Param = { name: string; byVal: boolean; optional: boolean; defaultExpr: Expr | null; isArray: boolean; paramArray: boolean };

export interface Proc {
  kind: 'sub' | 'function' | 'get' | 'let' | 'set';
  name: string;
  params: Param[];
  body: Stmt[];
  isPrivate: boolean;
  line: number;
}

export interface ParsedModule {
  name: string;
  procs: Proc[];
  declarations: Stmt[];
  optionExplicit: boolean;
  optionBase: number;
  optionCompareText: boolean;
}

const BINARY_LEVELS: string[][] = [['imp'], ['eqv'], ['xor'], ['or', 'orelse'], ['and', 'andalso']];
const COMPARISON_OPS = ['=', '<>', '<', '>', '<=', '>=', 'like', 'is'];
const BLOCK_ENDERS = new Set(['else', 'elseif', 'end', 'next', 'loop', 'wend', 'case']);

class Parser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos += 1;
    return token;
  }

  private isWord(word: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'id' && token.text.toLowerCase() === word;
  }

  private isOp(op: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'op' && token.text === op;
  }

  private atLineEnd(): boolean {
    const kind = this.peek().kind;
    return kind === 'nl' || kind === 'eof';
  }

  private fail(message: string): never {
    throw new VbaSyntaxError(message, this.peek().line);
  }

  private expectWord(word: string) {
    if (!this.isWord(word)) this.fail(`Thiếu từ khoá "${word}"`);
    this.next();
  }

  private expectOp(op: string) {
    if (!this.isOp(op)) this.fail(`Thiếu "${op}"`);
    this.next();
  }

  private identifier(): string {
    const token = this.peek();
    if (token.kind !== 'id') this.fail('Thiếu tên');
    this.next();
    return token.text;
  }

  private endLine() {
    if (this.peek().kind === 'nl') {
      this.next();
      return;
    }
    if (this.peek().kind !== 'eof') this.fail(`Thừa "${this.peek().text}" ở cuối câu lệnh`);
  }

  private skipNewlines() {
    while (this.peek().kind === 'nl') this.next();
  }

  parseModule(name: string): ParsedModule {
    const module: ParsedModule = { name, procs: [], declarations: [], optionExplicit: false, optionBase: 0, optionCompareText: false };
    this.skipNewlines();
    while (this.peek().kind !== 'eof') {
      const line = this.peek().line;
      if (this.isWord('attribute')) {
        while (!this.atLineEnd()) this.next();
        this.endLine();
      } else if (this.isWord('option')) {
        this.next();
        if (this.isWord('explicit')) module.optionExplicit = true;
        else if (this.isWord('base')) {
          this.next();
          module.optionBase = Number(this.peek().value ?? 0);
        } else if (this.isWord('compare')) {
          this.next();
          module.optionCompareText = this.isWord('text');
        }
        while (!this.atLineEnd()) this.next();
        this.endLine();
      } else if (this.isProcStart()) {
        module.procs.push(this.parseProc());
      } else if (this.declarationWord() === 'enum') {
        module.declarations.push(this.parseEnum(line));
      } else if (this.declarationWord() === 'type' || this.declarationWord() === 'declare') {
        this.skipDeclaration();
      } else if (this.isWord('implements') || this.isWord('event') || this.isWord('deftype')) {
        while (!this.atLineEnd()) this.next();
        this.endLine();
      } else {
        const statement = this.parseStatement();
        if (statement.k !== 'nop') module.declarations.push(statement);
      }
      this.skipNewlines();
    }
    return module;
  }

  private declarationWord(): string {
    let offset = 0;
    while (['private', 'public'].includes(this.peek(offset).text.toLowerCase()) && this.peek(offset).kind === 'id') offset += 1;
    return this.peek(offset).kind === 'id' ? this.peek(offset).text.toLowerCase() : '';
  }

  private skipDeclaration() {
    const word = this.declarationWord();
    if (word === 'type') {
      while (this.peek().kind !== 'eof' && !(this.isWord('end') && this.isWord('type', 1))) this.next();
      this.next();
      this.next();
    } else while (!this.atLineEnd()) this.next();
    this.endLine();
  }

  private parseEnum(line: number): Stmt {
    while (!this.isWord('enum')) this.next();
    this.next();
    this.identifier();
    this.endLine();
    const items: Array<{ name: string; expr: Expr }> = [];
    let previous: Expr = { t: 'num', v: -1 };
    this.skipNewlines();
    while (!(this.isWord('end') && this.isWord('enum', 1))) {
      if (this.peek().kind === 'eof') this.fail('Thiếu End Enum');
      const memberLine = this.peek().line;
      const name = this.identifier();
      let expr: Expr = { t: 'bin', op: '+', l: previous, r: { t: 'num', v: 1 }, line: memberLine };
      if (this.isOp('=')) {
        this.next();
        expr = this.parseExpr();
      }
      items.push({ name, expr });
      previous = expr;
      this.endLine();
      this.skipNewlines();
    }
    this.next();
    this.next();
    this.endLine();
    return { k: 'const', items, line };
  }

  private isProcStart(): boolean {
    let offset = 0;
    while (['public', 'private', 'friend', 'static'].includes(this.peek(offset).text.toLowerCase()) && this.peek(offset).kind === 'id') offset += 1;
    return this.isWord('sub', offset) || this.isWord('function', offset) || (this.isWord('property', offset) && ['get', 'let', 'set'].includes(this.peek(offset + 1).text.toLowerCase()));
  }

  private parseProc(): Proc {
    let isPrivate = false;
    while (['public', 'private', 'friend', 'static'].includes(this.peek().text.toLowerCase())) {
      if (this.isWord('private')) isPrivate = true;
      this.next();
    }
    const line = this.peek().line;
    const word = this.next().text.toLowerCase();
    let kind: Proc['kind'] = word === 'sub' ? 'sub' : 'function';
    if (word === 'property') kind = this.next().text.toLowerCase() as Proc['kind'];
    const name = this.identifier();
    const params: Param[] = [];
    if (this.isOp('(')) {
      this.next();
      while (!this.isOp(')')) {
        params.push(this.parseParam());
        if (this.isOp(',')) this.next();
        else break;
      }
      this.expectOp(')');
    }
    if (this.isWord('as')) {
      this.next();
      this.parseTypeName();
    }
    this.endLine();
    const endWord = kind === 'sub' ? 'sub' : kind === 'function' ? 'function' : 'property';
    const body = this.parseBlock(() => this.isWord('end') && this.isWord(endWord, 1));
    this.next();
    this.next();
    this.endLine();
    return { kind, name, params, body, isPrivate, line };
  }

  private parseParam(): Param {
    const param: Param = { name: '', byVal: false, optional: false, defaultExpr: null, isArray: false, paramArray: false };
    while (true) {
      if (this.isWord('optional')) param.optional = true;
      else if (this.isWord('byval')) param.byVal = true;
      else if (this.isWord('byref')) param.byVal = false;
      else if (this.isWord('paramarray')) param.paramArray = true;
      else break;
      this.next();
    }
    param.name = this.identifier();
    if (this.isOp('(') && this.isOp(')', 1)) {
      this.next();
      this.next();
      param.isArray = true;
    }
    if (this.isWord('as')) {
      this.next();
      this.parseTypeName();
    }
    if (this.isOp('=')) {
      this.next();
      param.defaultExpr = this.parseExpr();
    }
    return param;
  }

  private parseTypeName(): string {
    if (this.isWord('new')) this.next();
    let name = this.identifier();
    while (this.isOp('.')) {
      this.next();
      name += `.${this.identifier()}`;
    }
    if (this.isOp('*')) {
      this.next();
      this.next();
    }
    return name;
  }

  private parseBlock(isEnd: () => boolean): Stmt[] {
    const body: Stmt[] = [];
    this.skipNewlines();
    while (!isEnd()) {
      if (this.peek().kind === 'eof') this.fail('Khối lệnh chưa được đóng');
      const statement = this.parseStatement();
      body.push(statement);
      this.skipNewlines();
    }
    return body;
  }

  private parseStatement(): Stmt {
    const token = this.peek();
    const line = token.line;
    if (token.kind === 'id' && this.peek(1).kind === 'nl' && this.peek(1).colon && !BLOCK_ENDERS.has(token.text.toLowerCase())) {
      this.next();
      this.next();
      return { k: 'label', name: token.text.toLowerCase(), line };
    }
    if (token.kind === 'num' && this.pos > 0 && this.tokens[this.pos - 1].kind === 'nl' && !this.tokens[this.pos - 1].colon) {
      this.next();
      return { k: 'label', name: String(token.value), line };
    }
    if (token.kind !== 'id') {
      if (token.kind === 'op' && token.text === '.') return this.parseSimple(line);
      if (token.kind === 'bracket') return this.parseSimple(line);
      this.fail(`Câu lệnh không hợp lệ ở "${token.text}"`);
    }
    const word = token.text.toLowerCase();
    switch (word) {
      case 'dim':
      case 'static':
        this.next();
        return this.finish({ k: 'dim', items: this.parseDimItems(), isStatic: word === 'static', line });
      case 'private':
      case 'public':
      case 'global':
        this.next();
        if (this.isWord('const')) return this.parseStatement();
        if (this.isWord('withevents')) this.next();
        return this.finish({ k: 'dim', items: this.parseDimItems(), isStatic: false, line });
      case 'const':
        this.next();
        return this.finish({ k: 'const', items: this.parseConstItems(), line });
      case 'redim': {
        this.next();
        let preserve = false;
        if (this.isWord('preserve')) {
          this.next();
          preserve = true;
        }
        return this.finish({ k: 'redim', preserve, items: this.parseDimItems(), line });
      }
      case 'erase': {
        this.next();
        const names = [this.identifier()];
        while (this.isOp(',')) {
          this.next();
          names.push(this.identifier());
        }
        return this.finish({ k: 'erase', names, line });
      }
      case 'set':
      case 'let': {
        this.next();
        const target = this.parsePostfix();
        this.expectOp('=');
        return this.finish({ k: 'assign', target, expr: this.parseExpr(), isSet: word === 'set', line });
      }
      case 'call': {
        this.next();
        return this.finish({ k: 'call', expr: this.parsePostfix(), line });
      }
      case 'if':
        return this.parseIf();
      case 'for':
        return this.parseFor();
      case 'do':
        return this.parseDo();
      case 'while': {
        this.next();
        const cond = this.parseExpr();
        this.endLine();
        const body = this.parseBlock(() => this.isWord('wend'));
        this.next();
        return this.finish({ k: 'do', pre: { until: false, cond }, post: null, body, line });
      }
      case 'select':
        return this.parseSelect();
      case 'with': {
        this.next();
        const obj = this.parseExpr();
        this.endLine();
        const body = this.parseBlock(() => this.isWord('end') && this.isWord('with', 1));
        this.next();
        this.next();
        return this.finish({ k: 'with', obj, body, line });
      }
      case 'exit':
        this.next();
        return this.finish({ k: 'exit', what: this.next().text.toLowerCase(), line });
      case 'end':
        if (this.peek(1).kind === 'nl' || this.peek(1).kind === 'eof') {
          this.next();
          return this.finish({ k: 'end', line });
        }
        this.fail(`"End ${this.peek(1).text}" không khớp với khối nào`);
        break;
      case 'stop':
        this.next();
        return this.finish({ k: 'end', line });
      case 'on':
        if (this.isWord('error', 1)) return this.parseOnError();
        break;
      case 'goto':
        this.next();
        return this.finish({ k: 'goto', label: String(this.next().text).toLowerCase(), line });
      case 'resume': {
        this.next();
        if (this.isWord('next')) {
          this.next();
          return this.finish({ k: 'resume', mode: 'next', line });
        }
        if (this.atLineEnd() || (this.peek().kind === 'num' && this.peek().value === 0)) {
          if (!this.atLineEnd()) this.next();
          return this.finish({ k: 'resume', mode: 'here', line });
        }
        return this.finish({ k: 'resume', mode: 'label', label: this.next().text.toLowerCase(), line });
      }
      case 'option':
      case 'attribute':
      case 'doevents':
        while (!this.atLineEnd()) this.next();
        return this.finish({ k: 'nop', line });
      case 'debug':
        if (this.isOp('.', 1) && this.isWord('print', 2)) {
          this.next();
          this.next();
          this.next();
          const args: Expr[] = [];
          while (!this.atLineEnd()) {
            if (this.isOp(';') || this.isOp(',')) {
              this.next();
              continue;
            }
            args.push(this.parseExpr());
          }
          return this.finish({ k: 'print', args, line });
        }
        break;
      default:
        break;
    }
    return this.parseSimple(line);
  }

  private finish(statement: Stmt): Stmt {
    this.endLine();
    return statement;
  }

  private parseSimple(line: number): Stmt {
    const target = this.parsePostfix();
    if (this.isOp('=')) {
      this.next();
      return this.finish({ k: 'assign', target, expr: this.parseExpr(), isSet: false, line });
    }
    if (this.atLineEnd()) return this.finish({ k: 'call', expr: target, line });
    if (target.t === 'call' && this.isOp(',') && target.args.length === 1 && !target.args[0].name) {
      this.next();
      const rest = this.parseArgList(() => this.atLineEnd());
      return this.finish({ k: 'call', expr: { t: 'call', callee: target.callee, args: [target.args[0], ...rest], line }, line });
    }
    const args = this.parseArgList(() => this.atLineEnd());
    return this.finish({ k: 'call', expr: { t: 'call', callee: target, args, line }, line });
  }

  private parseDimItems(): DimItem[] {
    const items: DimItem[] = [];
    do {
      if (this.isOp(',')) this.next();
      if (this.isWord('withevents')) this.next();
      const name = this.identifier();
      let bounds: DimItem['bounds'] = null;
      let isArray = false;
      if (this.isOp('(')) {
        this.next();
        isArray = true;
        if (!this.isOp(')')) {
          bounds = [];
          do {
            if (this.isOp(',')) this.next();
            const first = this.parseExpr();
            if (this.isWord('to')) {
              this.next();
              bounds.push({ lower: first, upper: this.parseExpr() });
            } else bounds.push({ lower: null, upper: first });
          } while (this.isOp(','));
        }
        this.expectOp(')');
      }
      let isNew = false;
      let typeName = 'variant';
      if (this.isWord('as')) {
        this.next();
        if (this.isWord('new')) {
          this.next();
          isNew = true;
        }
        typeName = this.parseTypeName().toLowerCase();
      }
      items.push({ name, bounds, isArray, isNew, typeName });
    } while (this.isOp(','));
    return items;
  }

  private parseConstItems() {
    const items: Array<{ name: string; expr: Expr }> = [];
    do {
      if (this.isOp(',')) this.next();
      const name = this.identifier();
      if (this.isWord('as')) {
        this.next();
        this.parseTypeName();
      }
      this.expectOp('=');
      items.push({ name, expr: this.parseExpr() });
    } while (this.isOp(','));
    return items;
  }

  private parseIf(): Stmt {
    const line = this.peek().line;
    this.next();
    const cond = this.parseExpr();
    this.expectWord('then');
    if (!this.atLineEnd()) {
      const thenBody = this.parseInlineStatements(() => this.isWord('else') || this.atLineEnd());
      let elseBody: Stmt[] | null = null;
      if (this.isWord('else')) {
        this.next();
        elseBody = this.parseInlineStatements(() => this.atLineEnd());
      }
      if (this.isWord('end') && this.isWord('if', 1)) {
        this.next();
        this.next();
      }
      this.endLine();
      return { k: 'if', branches: [{ cond, body: thenBody }], elseBody, line };
    }
    this.endLine();
    const branches: Array<{ cond: Expr; body: Stmt[] }> = [];
    let elseBody: Stmt[] | null = null;
    let currentCond = cond;
    while (true) {
      const body = this.parseBlock(() => this.isWord('elseif') || this.isWord('else') || (this.isWord('end') && this.isWord('if', 1)));
      branches.push({ cond: currentCond, body });
      if (this.isWord('elseif')) {
        this.next();
        currentCond = this.parseExpr();
        this.expectWord('then');
        this.endLine();
        continue;
      }
      if (this.isWord('else')) {
        this.next();
        if (this.isWord('if')) this.fail('Viết "ElseIf" liền, không cách');
        this.endLine();
        elseBody = this.parseBlock(() => this.isWord('end') && this.isWord('if', 1));
      }
      break;
    }
    this.next();
    this.next();
    this.endLine();
    return { k: 'if', branches, elseBody, line };
  }

  private parseInlineStatements(isEnd: () => boolean): Stmt[] {
    const statements: Stmt[] = [];
    while (!isEnd()) {
      const line = this.peek().line;
      const saved = this.tokens;
      const startPos = this.pos;
      let stopIndex = startPos;
      while (stopIndex < saved.length && saved[stopIndex].kind !== 'nl' && saved[stopIndex].kind !== 'eof' && !(saved[stopIndex].kind === 'id' && saved[stopIndex].text.toLowerCase() === 'else' && stopIndex > startPos)) stopIndex += 1;
      const slice = [...saved.slice(startPos, stopIndex), { kind: 'nl' as const, text: '\n', line }, { kind: 'eof' as const, text: '', line }];
      const inner = new Parser(slice);
      statements.push(inner.parseStatement());
      this.pos = stopIndex;
      if (this.peek().kind === 'nl' && this.peek().colon) {
        const after = this.peek(1);
        if (after.kind === 'nl' || after.kind === 'eof') break;
        this.next();
      }
    }
    return statements;
  }

  private parseFor(): Stmt {
    const line = this.peek().line;
    this.next();
    if (this.isWord('each')) {
      this.next();
      const varName = this.identifier();
      this.expectWord('in');
      const coll = this.parseExpr();
      this.endLine();
      const body = this.parseBlock(() => this.isWord('next'));
      this.next();
      if (!this.atLineEnd()) this.next();
      this.endLine();
      return { k: 'foreach', varName, coll, body, line };
    }
    const varName = this.identifier();
    this.expectOp('=');
    const from = this.parseExpr();
    this.expectWord('to');
    const to = this.parseExpr();
    let step: Expr | null = null;
    if (this.isWord('step')) {
      this.next();
      step = this.parseExpr();
    }
    this.endLine();
    const body = this.parseBlock(() => this.isWord('next'));
    this.next();
    if (!this.atLineEnd()) {
      this.next();
      if (this.isOp(',')) this.fail('Next nhiều biến chưa được hỗ trợ, viết mỗi vòng một Next');
    }
    this.endLine();
    return { k: 'for', varName, from, to, step, body, line };
  }

  private parseDo(): Stmt {
    const line = this.peek().line;
    this.next();
    let pre: { until: boolean; cond: Expr } | null = null;
    if (this.isWord('while') || this.isWord('until')) {
      const until = this.next().text.toLowerCase() === 'until';
      pre = { until, cond: this.parseExpr() };
    }
    this.endLine();
    const body = this.parseBlock(() => this.isWord('loop'));
    this.next();
    let post: { until: boolean; cond: Expr } | null = null;
    if (this.isWord('while') || this.isWord('until')) {
      const until = this.next().text.toLowerCase() === 'until';
      post = { until, cond: this.parseExpr() };
    }
    this.endLine();
    return { k: 'do', pre, post, body, line };
  }

  private parseSelect(): Stmt {
    const line = this.peek().line;
    this.next();
    this.expectWord('case');
    const expr = this.parseExpr();
    this.endLine();
    this.skipNewlines();
    const cases: Array<{ tests: CaseTest[]; body: Stmt[] }> = [];
    let elseBody: Stmt[] | null = null;
    while (this.isWord('case')) {
      this.next();
      if (this.isWord('else')) {
        this.next();
        if (this.peek().kind === 'nl') this.next();
        elseBody = this.parseBlock(() => this.isWord('case') || (this.isWord('end') && this.isWord('select', 1)));
        continue;
      }
      const tests: CaseTest[] = [];
      do {
        if (this.isOp(',')) this.next();
        if (this.isWord('is')) {
          this.next();
          const op = this.next().text;
          tests.push({ kind: 'is', op, e: this.parseExpr() });
        } else {
          const first = this.parseExpr();
          if (this.isWord('to')) {
            this.next();
            tests.push({ kind: 'range', from: first, to: this.parseExpr() });
          } else tests.push({ kind: 'value', e: first });
        }
      } while (this.isOp(','));
      if (this.peek().kind === 'nl') this.next();
      const body = this.parseBlock(() => this.isWord('case') || (this.isWord('end') && this.isWord('select', 1)));
      cases.push({ tests, body });
    }
    this.expectWord('end');
    this.expectWord('select');
    this.endLine();
    return { k: 'select', expr, cases, elseBody, line };
  }

  private parseOnError(): Stmt {
    const line = this.peek().line;
    this.next();
    this.next();
    if (this.isWord('resume')) {
      this.next();
      this.expectWord('next');
      return this.finish({ k: 'onerror', mode: 'resume', line });
    }
    this.expectWord('goto');
    const target = this.next();
    if (target.kind === 'num' && target.value === 0) return this.finish({ k: 'onerror', mode: 'goto0', line });
    if (target.kind === 'op' && target.text === '-') {
      this.next();
      return this.finish({ k: 'onerror', mode: 'goto0', line });
    }
    return this.finish({ k: 'onerror', mode: 'label', label: String(target.kind === 'num' ? target.value : target.text).toLowerCase(), line });
  }

  parseArgList(isEnd: () => boolean): Arg[] {
    const args: Arg[] = [];
    if (isEnd()) return args;
    while (true) {
      if (this.isOp(',')) {
        args.push({ expr: null });
        this.next();
        if (isEnd()) {
          args.push({ expr: null });
          break;
        }
        continue;
      }
      if (this.peek().kind === 'id' && this.isOp(':=', 1)) {
        const name = this.next().text.toLowerCase();
        this.next();
        args.push({ expr: this.parseExpr(), name });
      } else {
        if (this.isWord('byval')) this.next();
        args.push({ expr: this.parseExpr() });
      }
      if (this.isOp(',')) {
        this.next();
        if (isEnd()) {
          args.push({ expr: null });
          break;
        }
        continue;
      }
      break;
    }
    return args;
  }

  parseExpr(): Expr {
    return this.parseBinary(0);
  }

  private parseBinary(level: number): Expr {
    if (level >= BINARY_LEVELS.length) return this.parseNot();
    let left = this.parseBinary(level + 1);
    while (this.peek().kind === 'id' && BINARY_LEVELS[level].includes(this.peek().text.toLowerCase())) {
      const line = this.peek().line;
      const op = this.next().text.toLowerCase().replace(/also$|else$/, '');
      left = { t: 'bin', op, l: left, r: this.parseBinary(level + 1), line };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isWord('not')) {
      const line = this.next().line;
      return { t: 'un', op: 'not', e: this.parseNot(), line };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseConcat();
    while (true) {
      const token = this.peek();
      const op = token.kind === 'op' ? token.text : token.kind === 'id' ? token.text.toLowerCase() : '';
      if (!COMPARISON_OPS.includes(op)) return left;
      this.next();
      left = { t: 'bin', op, l: left, r: this.parseConcat(), line: token.line };
    }
  }

  private parseConcat(): Expr {
    let left = this.parseAdditive();
    while (this.isOp('&')) {
      const line = this.next().line;
      left = { t: 'bin', op: '&', l: left, r: this.parseAdditive(), line };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMod();
    while (this.isOp('+') || this.isOp('-')) {
      const token = this.next();
      left = { t: 'bin', op: token.text, l: left, r: this.parseMod(), line: token.line };
    }
    return left;
  }

  private parseMod(): Expr {
    let left = this.parseIntDiv();
    while (this.isWord('mod')) {
      const line = this.next().line;
      left = { t: 'bin', op: 'mod', l: left, r: this.parseIntDiv(), line };
    }
    return left;
  }

  private parseIntDiv(): Expr {
    let left = this.parseMultiplicative();
    while (this.isOp('\\')) {
      const line = this.next().line;
      left = { t: 'bin', op: '\\', l: left, r: this.parseMultiplicative(), line };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.isOp('*') || this.isOp('/')) {
      const token = this.next();
      left = { t: 'bin', op: token.text, l: left, r: this.parseUnary(), line: token.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const token = this.next();
      const operand = this.parseUnary();
      return token.text === '-' ? { t: 'un', op: '-', e: operand, line: token.line } : operand;
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    let left = this.parsePostfix();
    while (this.isOp('^')) {
      const line = this.next().line;
      const right = this.isOp('-') ? (this.next(), { t: 'un' as const, op: '-', e: this.parsePostfix(), line }) : this.parsePostfix();
      left = { t: 'bin', op: '^', l: left, r: right, line };
    }
    return left;
  }

  parsePostfix(): Expr {
    let expr = this.parsePrimary();
    while (true) {
      if (this.isOp('(')) {
        const line = this.next().line;
        const args = this.parseArgList(() => this.isOp(')'));
        this.expectOp(')');
        expr = { t: 'call', callee: expr, args, line };
      } else if (this.isOp('.') && (this.peek(1).kind === 'id')) {
        const line = this.next().line;
        expr = { t: 'member', obj: expr, name: this.next().text.toLowerCase(), line };
      } else if (this.isOp('!') && (this.peek(1).kind === 'id' || this.peek(1).kind === 'bracket')) {
        const line = this.next().line;
        const token = this.next();
        expr = { t: 'bang', obj: expr, name: token.text, line };
      } else return expr;
    }
  }

  private parsePrimary(): Expr {
    const token = this.peek();
    switch (token.kind) {
      case 'num':
        this.next();
        return { t: 'num', v: Number(token.value) };
      case 'str':
        this.next();
        return { t: 'str', v: String(token.value) };
      case 'date':
        this.next();
        return { t: 'date', v: String(token.value) };
      case 'bracket':
        this.next();
        return { t: 'bracket', text: token.text, line: token.line };
      case 'id': {
        if (token.text.toLowerCase() === 'new') {
          this.next();
          return { t: 'new', typeName: this.parseTypeName().toLowerCase(), line: token.line };
        }
        this.next();
        return { t: 'id', name: token.text.toLowerCase(), line: token.line };
      }
      case 'op':
        if (token.text === '(') {
          this.next();
          const inner = this.parseExpr();
          this.expectOp(')');
          return inner;
        }
        if (token.text === '.' && this.peek(1).kind === 'id') {
          this.next();
          return { t: 'member', obj: null, name: this.next().text.toLowerCase(), line: token.line };
        }
        break;
      default:
        break;
    }
    this.fail(`Biểu thức không hợp lệ ở "${token.text || 'cuối dòng'}"`);
  }
}

export function parseModule(name: string, source: string): ParsedModule {
  return new Parser(tokenize(source)).parseModule(name);
}

export function parseExpression(source: string): Expr {
  const parser = new Parser(tokenize(source));
  return parser.parseExpr();
}
