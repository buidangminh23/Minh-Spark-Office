import { describeStep, type MacroBox, type MacroStep, type SheetMacro } from '../sheetMacros';
import { boxAddress, colLabel } from './vbaExcel';

type Box = { startRow: number; endRow: number; startColumn: number; endColumn: number };

const isBox = (value: unknown): value is Box =>
  !!value && typeof value === 'object' && ['startRow', 'endRow', 'startColumn', 'endColumn'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number');

const quote = (text: string) => `"${text.replace(/"/g, '""').replace(/\r?\n/g, '" & vbLf & "')}"`;

const rgbOf = (hex: unknown) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return `RGB(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
};

const H_ALIGN: Record<number, string> = { 0: 'xlGeneral', 1: 'xlLeft', 2: 'xlCenter', 3: 'xlRight', 4: 'xlJustify' };
const V_ALIGN: Record<number, string> = { 1: 'xlTop', 2: 'xlCenter', 3: 'xlBottom' };

export function vbaIdentifier(name: string, taken: Set<string>): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  let base = ascii || 'Macro';
  if (!/^[A-Za-z]/.test(base)) base = `M_${base}`;
  base = base.slice(0, 60);
  let candidate = base;
  for (let index = 2; taken.has(candidate.toLowerCase()); index++) candidate = `${base}_${index}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

class Converter {
  private readonly lines: string[] = [];
  private readonly macro: SheetMacro;
  private hasSelection = false;

  constructor(macro: SheetMacro) {
    this.macro = macro;
  }

  private rangeExpr(box: MacroBox | Box): string {
    if (!this.macro.relative) return `Range(${quote(boxAddress({ r0: box.startRow, c0: box.startColumn, r1: box.endRow, c1: box.endColumn }, false, false))})`;
    const rows = box.endRow - box.startRow + 1;
    const columns = box.endColumn - box.startColumn + 1;
    const offset = `baseCell.Offset(${box.startRow - this.macro.origin.row}, ${box.startColumn - this.macro.origin.column})`;
    return rows === 1 && columns === 1 ? offset : `${offset}.Resize(${rows}, ${columns})`;
  }

  private cellExpr(row: number, column: number): string {
    if (!this.macro.relative) return `Range("${colLabel(column)}${row + 1}")`;
    return `baseCell.Offset(${row - this.macro.origin.row}, ${column - this.macro.origin.column})`;
  }

  private target(params: Record<string, unknown>): string {
    if (isBox(params.range)) return this.rangeExpr(params.range);
    return 'Selection';
  }

  private writeCell(target: string, cell: Record<string, unknown>) {
    if (typeof cell.f === 'string' && cell.f) {
      this.lines.push(`    ${target}.Formula = ${quote(cell.f)}`);
      return;
    }
    const body = (cell.p as { body?: { dataStream?: string } } | undefined)?.body?.dataStream;
    const value = body !== undefined ? body.replace(/\r\n$/, '') : cell.v;
    if (value === undefined || value === null || value === '') {
      if ('v' in cell || body !== undefined) this.lines.push(`    ${target}.ClearContents`);
      return;
    }
    if (typeof value === 'number') this.lines.push(`    ${target}.Value = ${value}`);
    else if (typeof value === 'boolean') this.lines.push(`    ${target}.Value = ${value ? 'True' : 'False'}`);
    else this.lines.push(`    ${target}.Value = ${quote(String(value))}`);
  }

  private setRangeValues(params: Record<string, unknown>) {
    const value = params.value;
    const range = isBox(params.range) ? params.range : null;
    if (Array.isArray(value)) {
      if (!range) return this.comment('Dán / nhập nhiều ô không rõ vị trí');
      value.forEach((row, r) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, c) => cell && typeof cell === 'object' && this.writeCell(this.cellExpr(range.startRow + r, range.startColumn + c), cell as Record<string, unknown>));
      });
      return;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length && keys.every((key) => /^\d+$/.test(key))) {
        for (const [rowKey, row] of Object.entries(value as Record<string, Record<string, unknown>>)) {
          for (const [columnKey, cell] of Object.entries(row ?? {})) {
            if (cell && typeof cell === 'object') this.writeCell(this.cellExpr(Number(rowKey), Number(columnKey)), cell as Record<string, unknown>);
          }
        }
        return;
      }
      this.writeCell(range ? this.rangeExpr(range) : this.hasSelection ? 'Selection' : 'ActiveCell', value as Record<string, unknown>);
      return;
    }
    this.comment('Nhập giá trị');
  }

  private setStyle(target: string, style: { type?: string; value?: unknown }) {
    const value = style.value as Record<string, unknown> | number | string | null | undefined;
    switch (style.type) {
      case 'bl':
        this.lines.push(`    ${target}.Font.Bold = ${value ? 'True' : 'False'}`);
        return;
      case 'it':
        this.lines.push(`    ${target}.Font.Italic = ${value ? 'True' : 'False'}`);
        return;
      case 'ul':
        this.lines.push(`    ${target}.Font.Underline = ${value && typeof value === 'object' && value.s ? 'xlUnderlineStyleSingle' : 'xlUnderlineStyleNone'}`);
        return;
      case 'st':
        this.lines.push(`    ${target}.Font.Strikethrough = ${value && typeof value === 'object' && value.s ? 'True' : 'False'}`);
        return;
      case 'fs':
        this.lines.push(`    ${target}.Font.Size = ${Number(value)}`);
        return;
      case 'ff':
        this.lines.push(`    ${target}.Font.Name = ${quote(String(value))}`);
        return;
      case 'cl': {
        const rgb = rgbOf(value && typeof value === 'object' ? value.rgb : value);
        if (rgb) this.lines.push(`    ${target}.Font.Color = ${rgb}`);
        return;
      }
      case 'bg': {
        const rgb = rgbOf(value && typeof value === 'object' ? value.rgb : value);
        this.lines.push(rgb ? `    ${target}.Interior.Color = ${rgb}` : `    ${target}.Interior.ColorIndex = xlNone`);
        return;
      }
      case 'ht':
        this.lines.push(`    ${target}.HorizontalAlignment = ${H_ALIGN[Number(value)] ?? 'xlGeneral'}`);
        return;
      case 'vt':
        this.lines.push(`    ${target}.VerticalAlignment = ${V_ALIGN[Number(value)] ?? 'xlBottom'}`);
        return;
      case 'tb':
        this.lines.push(`    ${target}.WrapText = ${Number(value) === 3 ? 'True' : 'False'}`);
        return;
      default:
        this.comment(`Định dạng "${style.type ?? '?'}"`);
    }
  }

  private comment(text: string) {
    this.lines.push(`    ' Chưa chuyển sang VBA được: ${text.replace(/\r?\n/g, ' ')}`);
  }

  private step(step: MacroStep) {
    if (step.kind === 'select') {
      this.lines.push(`    ${this.rangeExpr(step.box)}.Select`);
      this.hasSelection = true;
      return;
    }
    if (step.kind === 'app') {
      this.comment(describeStep(step));
      return;
    }
    const params = (step.params ?? {}) as Record<string, unknown>;
    const id = step.id.replace(/^sheet\.command\./, '');
    const target = this.target(params);
    switch (id) {
      case 'set-range-values':
        this.setRangeValues(params);
        return;
      case 'set-style':
        this.setStyle(target, (params.style ?? {}) as { type?: string; value?: unknown });
        return;
      case 'set-font-size':
        this.setStyle(target, { type: 'fs', value: params.value });
        return;
      case 'set-font-family':
        this.setStyle(target, { type: 'ff', value: params.value });
        return;
      case 'set-text-color':
        this.setStyle(target, { type: 'cl', value: params.value });
        return;
      case 'set-background-color':
        this.setStyle(target, { type: 'bg', value: params.value });
        return;
      case 'reset-background-color':
        this.setStyle(target, { type: 'bg', value: null });
        return;
      case 'set-horizontal-text-align':
        this.setStyle(target, { type: 'ht', value: params.value });
        return;
      case 'set-vertical-text-align':
        this.setStyle(target, { type: 'vt', value: params.value });
        return;
      case 'set-text-wrap':
        this.setStyle(target, { type: 'tb', value: params.value });
        return;
      case 'clear-selection-content':
        this.lines.push(`    ${target}.ClearContents`);
        return;
      case 'clear-selection-format':
        this.lines.push(`    ${target}.ClearFormats`);
        return;
      case 'clear-selection-all':
        this.lines.push(`    ${target}.Clear`);
        return;
      case 'insert-row-before':
      case 'insert-multi-rows-above':
        this.lines.push(`    ${target}.EntireRow.Insert`);
        return;
      case 'insert-row-after':
      case 'insert-multi-rows-after':
        this.lines.push(`    ${target}.Offset(${target}.Rows.Count).EntireRow.Insert`);
        return;
      case 'insert-col-before':
      case 'insert-multi-cols-before':
        this.lines.push(`    ${target}.EntireColumn.Insert`);
        return;
      case 'insert-col-after':
      case 'insert-multi-cols-right':
        this.lines.push(`    ${target}.Offset(0, ${target}.Columns.Count).EntireColumn.Insert`);
        return;
      case 'remove-row-by-range':
        this.lines.push(`    ${target}.EntireRow.Delete`);
        return;
      case 'remove-col-by-range':
        this.lines.push(`    ${target}.EntireColumn.Delete`);
        return;
      case 'add-worksheet-merge':
      case 'add-worksheet-merge-all':
        this.lines.push(`    ${target}.Merge`);
        return;
      case 'remove-worksheet-merge':
        this.lines.push(`    ${target}.UnMerge`);
        return;
      case 'set-worksheet-col-width':
        this.lines.push(`    ${target}.ColumnWidth = ${Math.round(((Number(params.value) || 64) - 5) / 7 * 100) / 100}`);
        return;
      case 'set-worksheet-row-height':
      case 'set-row-height':
        this.lines.push(`    ${target}.RowHeight = ${Math.round((Number(params.value) || 20) * 0.75 * 100) / 100}`);
        return;
      default:
        if (/numfmt/.test(id) && Array.isArray(params.values)) {
          for (const item of params.values as Array<{ row: number; col: number; pattern: string }>) {
            this.lines.push(`    ${this.cellExpr(item.row, item.col)}.NumberFormat = ${quote(String(item.pattern ?? 'General'))}`);
          }
          return;
        }
        this.comment(describeStep(step));
    }
  }

  build(procName: string): string {
    if (this.macro.relative) this.lines.push('    Dim baseCell As Range', '    Set baseCell = ActiveCell');
    for (const step of this.macro.steps) this.step(step);
    const header = [`Sub ${procName}()`];
    if (this.macro.description) header.push(`    ' ${this.macro.description.replace(/\r?\n/g, ' ')}`);
    header.push(`    ' Ghi bằng 23 Sheets: ${this.macro.name.replace(/\r?\n/g, ' ')}`);
    return [...header, ...this.lines, 'End Sub'].join('\r\n');
  }
}

export interface RecordedModule {
  code: string;
  procNames: Record<string, string>;
  procAttributes: Record<string, string[]>;
}

export function recordedMacrosToVba(macros: SheetMacro[], reserved: Set<string> = new Set()): RecordedModule {
  const taken = new Set([...reserved].map((name) => name.toLowerCase()));
  const procNames: Record<string, string> = {};
  const procAttributes: Record<string, string[]> = {};
  const blocks = macros.map((macro) => {
    const procName = vbaIdentifier(macro.name, taken);
    procNames[macro.id] = procName;
    if (macro.shortcut) procAttributes[procName.toLowerCase()] = [`Attribute ${procName}.VB_ProcData.VB_Invoke_Func = "${macro.shortcut}\\n14"`];
    return new Converter(macro).build(procName);
  });
  return { code: ['Option Explicit', '', ...blocks.flatMap((block) => [block, ''])].join('\r\n').trimEnd(), procNames, procAttributes };
}
