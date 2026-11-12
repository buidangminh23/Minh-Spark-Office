export interface MacroBox {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export type MacroStep =
  | { kind: 'select'; sheetId: string; box: MacroBox }
  | { kind: 'command'; sheetId: string; id: string; params: unknown };

export interface SheetMacro {
  id: string;
  name: string;
  description: string;
  shortcut: string;
  relative: boolean;
  origin: { row: number; column: number };
  steps: MacroStep[];
  createdAt: number;
}

export const MACRO_COMMAND_PREFIX = 'sheet.command.';
export const SELECTION_OPERATION_ID = 'sheet.operation.set-selections';
export const MACRO_CELL_KEY = 'minhMacro';
export const MAX_MACRO_STEPS = 2000;
export const MAX_MACRO_NAME_LENGTH = 60;
export const COMMAND_TYPE_COMMAND = 0;
const DEPTH_RESET_MS = 4000;
const RESERVED_SHORTCUT_LETTERS = 'FLPUVWXZ';

export const BUILTIN_MACROS = [
  ['normalizeTable', 'Chuẩn hoá bảng'],
  ['autoNumberStt', 'Đánh STT 1..N'],
  ['moneyWordsCol', 'Đọc chữ VNĐ cho cả cột'],
  ['highlightVariance', 'Tô âm/dương'],
  ['cleanBlankRows', 'Xoá dòng trống'],
  ['wrapIfError', 'Bọc IFERROR cho công thức'],
  ['recalculate', 'Tính lại toàn bộ công thức'],
  ['save', 'Lưu bảng tính'],
  ['print', 'Mở In / Xem trước'],
  ['exportXlsx', 'Xuất tệp Excel (.xlsx)'],
  ['toggleFilter', 'Bật/tắt bộ lọc'],
  ['nextSheet', 'Sang trang tính kế tiếp'],
  ['prevSheet', 'Về trang tính trước'],
  ['gotoStart', 'Về ô A1'],
] as const;

export type BuiltinMacroId = (typeof BUILTIN_MACROS)[number][0];

export type MacroTarget = { kind: 'builtin'; id: BuiltinMacroId } | { kind: 'macro'; id: string };

export function encodeTarget(target: MacroTarget): string {
  return `${target.kind}:${target.id}`;
}

export function decodeTarget(value: unknown): MacroTarget | null {
  if (typeof value !== 'string') return null;
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id) return null;
  if (kind === 'macro') return { kind, id };
  if (kind === 'builtin' && BUILTIN_MACROS.some(([builtinId]) => builtinId === id)) return { kind, id: id as BuiltinMacroId };
  return null;
}

export function targetLabel(target: MacroTarget, macros: SheetMacro[]): string {
  if (target.kind === 'builtin') return BUILTIN_MACROS.find(([id]) => id === target.id)?.[1] ?? target.id;
  return macros.find((macro) => macro.id === target.id)?.name ?? 'Macro đã bị xoá';
}

export function normalizeShortcut(input: string): string {
  const letter = input.trim().slice(-1).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '';
}

export function shortcutProblem(letter: string, macros: SheetMacro[], ownId: string): string | null {
  if (!letter) return null;
  if (RESERVED_SHORTCUT_LETTERS.includes(letter)) return `Ctrl + Shift + ${letter} đã dùng cho lệnh khác của Minh Sheets`;
  const holder = macros.find((macro) => macro.shortcut === letter && macro.id !== ownId);
  return holder ? `Ctrl + Shift + ${letter} đang gán cho macro "${holder.name}"` : null;
}

export function macroForShortcut(
  event: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  macros: SheetMacro[]
): SheetMacro | null {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return null;
  const match = /^Key([A-Z])$/.exec(event.code);
  if (!match) return null;
  return macros.find((macro) => macro.shortcut === match[1]) ?? null;
}

export function uniqueMacroName(base: string, macros: SheetMacro[]): string {
  const clean = base.trim().slice(0, MAX_MACRO_NAME_LENGTH) || 'Macro';
  const names = new Set(macros.map((macro) => macro.name.toLowerCase()));
  if (!names.has(clean.toLowerCase())) return clean;
  for (let index = 2; ; index++) {
    const candidate = `${clean} ${index}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
}

export function nextMacroName(macros: SheetMacro[]): string {
  return uniqueMacroName(`Macro ${macros.length + 1}`, macros);
}

const isBox = (value: unknown): value is MacroBox => {
  if (!value || typeof value !== 'object') return false;
  const box = value as Record<string, unknown>;
  return ['startRow', 'endRow', 'startColumn', 'endColumn'].every((key) => typeof box[key] === 'number');
};

const isCellMatrix = (value: unknown): value is Record<string, Record<string, unknown>> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rows = Object.entries(value as Record<string, unknown>);
  if (!rows.length) return false;
  return rows.every(([rowKey, row]) => {
    if (!/^\d+$/.test(rowKey) || !row || typeof row !== 'object' || Array.isArray(row)) return false;
    const columns = Object.keys(row as object);
    return columns.length > 0 && columns.every((columnKey) => /^\d+$/.test(columnKey));
  });
};

export function shiftParams(value: unknown, rowDelta: number, columnDelta: number): unknown {
  if (rowDelta === 0 && columnDelta === 0) return value;
  if (Array.isArray(value)) return value.map((item) => shiftParams(item, rowDelta, columnDelta));
  if (!value || typeof value !== 'object') return value;
  if (isCellMatrix(value)) {
    const moved: Record<string, Record<string, unknown>> = {};
    for (const [rowKey, row] of Object.entries(value)) {
      const target: Record<string, unknown> = {};
      for (const [columnKey, cell] of Object.entries(row)) target[String(Math.max(0, Number(columnKey) + columnDelta))] = cell;
      moved[String(Math.max(0, Number(rowKey) + rowDelta))] = target;
    }
    return moved;
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) result[key] = shiftParams(item, rowDelta, columnDelta);
  if (isBox(source)) {
    result.startRow = Math.max(0, source.startRow + rowDelta);
    result.endRow = Math.max(0, source.endRow + rowDelta);
    result.startColumn = Math.max(0, source.startColumn + columnDelta);
    result.endColumn = Math.max(0, source.endColumn + columnDelta);
  }
  for (const key of ['row', 'actualRow']) {
    if (typeof source[key] === 'number' && (typeof source.column === 'number' || typeof source.actualColumn === 'number')) {
      result[key] = Math.max(0, (source[key] as number) + rowDelta);
    }
  }
  for (const key of ['column', 'actualColumn']) {
    if (typeof source[key] === 'number' && (typeof source.row === 'number' || typeof source.actualRow === 'number')) {
      result[key] = Math.max(0, (source[key] as number) + columnDelta);
    }
  }
  return result;
}

export function shiftBox(box: MacroBox, rowDelta: number, columnDelta: number): MacroBox {
  return shiftParams(box, rowDelta, columnDelta) as MacroBox;
}

export function remapParams(value: unknown, unitId: string, sheetId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => remapParams(item, unitId, sheetId));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'unitId' && typeof item === 'string') result[key] = unitId;
    else if ((key === 'subUnitId' || key === 'sheetId') && typeof item === 'string') result[key] = sheetId;
    else result[key] = remapParams(item, unitId, sheetId);
  }
  return result;
}

export function cloneParams(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

export interface RecordedCommand {
  id: string;
  type?: number;
  params?: unknown;
}

export class MacroRecorder {
  private steps: MacroStep[] = [];
  private depth = 0;
  private lastActivity = 0;
  private pendingSelection: MacroStep | null = null;

  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private isRecordable(command: RecordedCommand): boolean {
    return command.type === COMMAND_TYPE_COMMAND && command.id.startsWith(MACRO_COMMAND_PREFIX);
  }

  before(command: RecordedCommand): void {
    if (!this.isRecordable(command)) return;
    const time = this.now();
    if (time - this.lastActivity > DEPTH_RESET_MS) this.depth = 0;
    this.lastActivity = time;
    this.depth += 1;
  }

  executed(command: RecordedCommand, sheetId: string): void {
    if (command.id === SELECTION_OPERATION_ID) {
      if (this.depth > 0) return;
      const box = firstSelectionBox(command.params);
      if (box) this.pendingSelection = { kind: 'select', sheetId, box };
      return;
    }
    if (!this.isRecordable(command)) return;
    this.lastActivity = this.now();
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth > 0 || this.steps.length >= MAX_MACRO_STEPS) return;
    const params = cloneParams(command.params);
    if (this.pendingSelection) {
      this.steps.push(this.pendingSelection);
      this.pendingSelection = null;
    }
    this.steps.push({ kind: 'command', sheetId, id: command.id, params });
  }

  get count(): number {
    return this.steps.filter((step) => step.kind === 'command').length;
  }

  finish(): MacroStep[] {
    return [...this.steps];
  }
}

export function firstSelectionBox(params: unknown): MacroBox | null {
  const selections = (params as { selections?: Array<{ range?: unknown }> } | null)?.selections;
  const range = selections?.[0]?.range;
  if (!isBox(range)) return null;
  return { startRow: range.startRow, endRow: range.endRow, startColumn: range.startColumn, endColumn: range.endColumn };
}

export function isReplayable(step: MacroStep): boolean {
  return step.kind === 'select' || step.id.startsWith(MACRO_COMMAND_PREFIX);
}

const COMMAND_LABELS: Array<[pattern: RegExp, label: string]> = [
  [/set-range-values/, 'Nhập giá trị / công thức'],
  [/set-style|set-range-(bold|italic|underline|stroke|font|text)/, 'Định dạng chữ'],
  [/set-border/, 'Kẻ viền'],
  [/numfmt/, 'Định dạng số'],
  [/insert-row/, 'Chèn hàng'],
  [/insert-col/, 'Chèn cột'],
  [/remove-row|delete-range-move-up/, 'Xoá hàng / dồn ô lên'],
  [/remove-col|delete-range-move-left/, 'Xoá cột / dồn ô sang trái'],
  [/insert-range/, 'Chèn ô'],
  [/merge/, 'Gộp / tách ô'],
  [/clear-selection/, 'Xoá nội dung hoặc định dạng'],
  [/sort/, 'Sắp xếp'],
  [/filter/, 'Bộ lọc'],
  [/hidden|hide|show|visible/, 'Ẩn / hiện hàng cột'],
  [/row-height|col-width|worksheet-row|worksheet-col/, 'Đổi cỡ hàng cột'],
  [/paste/, 'Dán'],
  [/copy-down|copy-right|auto-fill|fill/, 'Điền dữ liệu'],
  [/freeze/, 'Cố định hàng cột'],
  [/insert-sheet|remove-sheet|copy-sheet|worksheet/, 'Thao tác trang tính'],
  [/conditional/, 'Định dạng có điều kiện'],
  [/data-validation/, 'Kiểm tra dữ liệu'],
];

export function boxToA1(box: MacroBox): string {
  const label = (index: number) => {
    let text = '';
    for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) text = String.fromCharCode(65 + ((value - 1) % 26)) + text;
    return text;
  };
  const start = `${label(box.startColumn)}${box.startRow + 1}`;
  const end = `${label(box.endColumn)}${box.endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
}

export function describeStep(step: MacroStep): string {
  if (step.kind === 'select') return `Chọn vùng ${boxToA1(step.box)}`;
  const label = COMMAND_LABELS.find(([pattern]) => pattern.test(step.id))?.[1];
  return label ?? step.id.slice(MACRO_COMMAND_PREFIX.length);
}

export function sanitizeMacros(value: unknown): SheetMacro[] {
  if (!Array.isArray(value)) return [];
  const macros: SheetMacro[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const macro = item as Partial<SheetMacro>;
    if (typeof macro.id !== 'string' || typeof macro.name !== 'string' || !Array.isArray(macro.steps)) continue;
    const steps = macro.steps.filter(
      (step): step is MacroStep =>
        !!step &&
        typeof step === 'object' &&
        typeof (step as MacroStep).sheetId === 'string' &&
        (((step as MacroStep).kind === 'select' && isBox((step as { box?: unknown }).box)) ||
          ((step as MacroStep).kind === 'command' && typeof (step as { id?: unknown }).id === 'string' && isReplayable(step as MacroStep)))
    );
    macros.push({
      id: macro.id,
      name: macro.name.slice(0, MAX_MACRO_NAME_LENGTH),
      description: typeof macro.description === 'string' ? macro.description : '',
      shortcut: normalizeShortcut(typeof macro.shortcut === 'string' ? macro.shortcut : ''),
      relative: macro.relative === true,
      origin: {
        row: typeof macro.origin?.row === 'number' ? macro.origin.row : 0,
        column: typeof macro.origin?.column === 'number' ? macro.origin.column : 0,
      },
      steps: steps.slice(0, MAX_MACRO_STEPS),
      createdAt: typeof macro.createdAt === 'number' ? macro.createdAt : 0,
    });
  }
  return macros;
}
