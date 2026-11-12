import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MacroRecorder,
  SELECTION_OPERATION_ID,
  boxToA1,
  decodeTarget,
  describeStep,
  encodeTarget,
  macroForShortcut,
  nextMacroName,
  normalizeShortcut,
  remapParams,
  sanitizeMacros,
  shiftParams,
  shortcutProblem,
  targetLabel,
  uniqueMacroName,
  type SheetMacro,
} from '../src/editors/sheet/sheetMacros';

const macro = (overrides: Partial<SheetMacro> = {}): SheetMacro => ({
  id: 'm1',
  name: 'Lập báo cáo',
  description: '',
  shortcut: '',
  relative: false,
  origin: { row: 0, column: 0 },
  steps: [],
  createdAt: 1,
  ...overrides,
});

const command = (id: string, params: unknown = {}) => ({ id, type: 0, params });
const selection = (startRow: number, startColumn: number, endRow = startRow, endColumn = startColumn) => ({
  id: SELECTION_OPERATION_ID,
  type: 1,
  params: { selections: [{ range: { startRow, endRow, startColumn, endColumn } }] },
});

test('the recorder keeps only top-level sheet commands and the selection before each one', () => {
  let clock = 0;
  const recorder = new MacroRecorder(() => clock);
  recorder.executed(selection(1, 1), 's1');
  recorder.executed(selection(2, 2), 's1');
  recorder.before(command('sheet.command.set-range-bold'));
  recorder.before(command('sheet.command.set-style', { style: 'bl' }));
  recorder.executed(selection(9, 9), 's1');
  recorder.executed(command('sheet.command.set-style', { style: 'bl' }), 's1');
  recorder.executed(command('sheet.command.set-range-bold'), 's1');
  recorder.before({ id: 'sheet.mutation.set-range-values', type: 2 });
  recorder.executed({ id: 'sheet.mutation.set-range-values', type: 2 }, 's1');
  recorder.before(command('doc.command.insert-text'));
  recorder.executed(command('doc.command.insert-text'), 's1');
  clock += 10;
  recorder.before(command('sheet.command.set-range-values', { value: { v: 5 } }));
  recorder.executed(command('sheet.command.set-range-values', { value: { v: 5 } }), 's1');
  const steps = recorder.finish();
  assert.deepEqual(
    steps.map((step) => (step.kind === 'select' ? `select ${boxToA1(step.box)}` : step.id)),
    ['select C3', 'sheet.command.set-range-bold', 'sheet.command.set-range-values']
  );
  assert.equal(recorder.count, 2);
});

test('the recorder recovers when a command never reports back', () => {
  let clock = 0;
  const recorder = new MacroRecorder(() => clock);
  recorder.before(command('sheet.command.broken'));
  clock += 10000;
  recorder.before(command('sheet.command.set-range-values'));
  recorder.executed(command('sheet.command.set-range-values'), 's1');
  assert.equal(recorder.count, 1);
});

test('recorded params are copied, not shared', () => {
  const recorder = new MacroRecorder(() => 0);
  const params = { range: { startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 } };
  recorder.before(command('sheet.command.x', params));
  recorder.executed(command('sheet.command.x', params), 's1');
  params.range.startRow = 99;
  const [step] = recorder.finish();
  assert.equal(step.kind === 'command' && (step.params as typeof params).range.startRow, 1);
});

test('shiftParams moves ranges, cell matrices and cell positions', () => {
  const params = {
    unitId: 'u',
    range: { startRow: 2, endRow: 3, startColumn: 1, endColumn: 1 },
    value: { 2: { 1: { v: 'a' } }, 3: { 1: { v: 'b' } } },
    primary: { actualRow: 2, actualColumn: 1, startRow: 2, endRow: 2, startColumn: 1, endColumn: 1 },
    count: 4,
    style: { type: 'bl', value: 1 },
  };
  assert.deepEqual(shiftParams(params, 5, 2), {
    unitId: 'u',
    range: { startRow: 7, endRow: 8, startColumn: 3, endColumn: 3 },
    value: { 7: { 3: { v: 'a' } }, 8: { 3: { v: 'b' } } },
    primary: { actualRow: 7, actualColumn: 3, startRow: 7, endRow: 7, startColumn: 3, endColumn: 3 },
    count: 4,
    style: { type: 'bl', value: 1 },
  });
  assert.deepEqual(shiftParams({ range: { startRow: 1, endRow: 1, startColumn: 0, endColumn: 0 } }, -5, 0), {
    range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
  });
  assert.equal(shiftParams(params, 0, 0), params);
});

test('remapParams points every step at the open workbook and sheet', () => {
  assert.deepEqual(remapParams({ unitId: 'old', subUnitId: 'gone', ranges: [{ unitId: 'old', sheetId: 'gone', n: 1 }] }, 'wb', 'sh'), {
    unitId: 'wb',
    subUnitId: 'sh',
    ranges: [{ unitId: 'wb', sheetId: 'sh', n: 1 }],
  });
});

test('button targets round-trip and reject unknown values', () => {
  assert.deepEqual(decodeTarget(encodeTarget({ kind: 'macro', id: 'm1' })), { kind: 'macro', id: 'm1' });
  assert.deepEqual(decodeTarget('builtin:recalculate'), { kind: 'builtin', id: 'recalculate' });
  assert.equal(decodeTarget('builtin:formatDisk'), null);
  assert.equal(decodeTarget('javascript:alert(1)'), null);
  assert.equal(decodeTarget(42), null);
  assert.equal(targetLabel({ kind: 'macro', id: 'm1' }, [macro()]), 'Lập báo cáo');
  assert.equal(targetLabel({ kind: 'macro', id: 'zz' }, [macro()]), 'Macro đã bị xoá');
  assert.equal(targetLabel({ kind: 'builtin', id: 'save' }, []), 'Lưu bảng tính');
});

test('shortcuts are single letters, avoid taken keys and find their macro', () => {
  assert.equal(normalizeShortcut(' ctrl+shift+k '), 'K');
  assert.equal(normalizeShortcut('7'), '');
  const macros = [macro({ shortcut: 'K' }), macro({ id: 'm2', name: 'Khác' })];
  assert.match(shortcutProblem('V', macros, 'm2') ?? '', /đã dùng/);
  assert.match(shortcutProblem('K', macros, 'm2') ?? '', /Lập báo cáo/);
  assert.equal(shortcutProblem('K', macros, 'm1'), null);
  assert.equal(shortcutProblem('', macros, 'm2'), null);
  const press = (code: string, shiftKey = true, altKey = false) => ({ code, ctrlKey: true, metaKey: false, altKey, shiftKey });
  assert.equal(macroForShortcut(press('KeyK'), macros)?.id, 'm1');
  assert.equal(macroForShortcut(press('KeyK', false), macros), null);
  assert.equal(macroForShortcut(press('KeyK', true, true), macros), null);
  assert.equal(macroForShortcut(press('KeyQ'), macros), null);
});

test('macro names stay unique', () => {
  const macros = [macro({ name: 'Macro 1' }), macro({ id: 'm2', name: 'Macro 2' })];
  assert.equal(uniqueMacroName('macro 1', macros), 'macro 1 2');
  assert.equal(nextMacroName(macros), 'Macro 3');
  assert.equal(uniqueMacroName('   ', []), 'Macro');
});

test('describeStep reads like a person wrote it', () => {
  assert.equal(describeStep({ kind: 'select', sheetId: 's', box: { startRow: 1, endRow: 3, startColumn: 0, endColumn: 2 } }), 'Chọn vùng A2:C4');
  assert.equal(describeStep({ kind: 'command', sheetId: 's', id: 'sheet.command.set-range-values', params: {} }), 'Nhập giá trị / công thức');
  assert.equal(describeStep({ kind: 'command', sheetId: 's', id: 'sheet.command.some-new-thing', params: {} }), 'some-new-thing');
});

test('sanitizeMacros drops anything that is not a replayable sheet command', () => {
  const dirty = [
    {
      id: 'm1',
      name: 'Ổn',
      shortcut: 'k',
      relative: true,
      origin: { row: 2, column: 1 },
      createdAt: 5,
      steps: [
        { kind: 'command', sheetId: 's', id: 'sheet.command.set-range-values', params: {} },
        { kind: 'command', sheetId: 's', id: 'univer.command.paste', params: {} },
        { kind: 'command', sheetId: 's', id: 'doc.command.insert-text', params: {} },
        { kind: 'select', sheetId: 's', box: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 } },
        { kind: 'select', sheetId: 's', box: { startRow: 'x' } },
        null,
      ],
    },
    { id: 7, name: 'Hỏng', steps: [] },
    'rác',
  ];
  const [clean, ...rest] = sanitizeMacros(dirty);
  assert.equal(rest.length, 0);
  assert.equal(clean.shortcut, 'K');
  assert.equal(clean.relative, true);
  assert.deepEqual(clean.steps.map((step) => step.kind), ['command', 'select']);
  assert.deepEqual(sanitizeMacros(undefined), []);
});
