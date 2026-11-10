import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const source = readFileSync(resolve('src/editors/sheet/SheetEditor.tsx'), 'utf8');
type Node = { type?: unknown; props?: Record<string, any> };

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  const node = tree as Node;
  return [node, ...nodes(node.props?.children)];
}

function createEditor(code = source) {
  let index = 0;
  const values: any[] = [];
  const effects: Array<() => unknown> = [];
  const workbook = { id: 'workbook', sheetOrder: ['sheet'], sheets: { sheet: { id: 'sheet', name: 'Sheet1', cellData: {} as Record<string, Record<string, { v: unknown }>> } } };
  const state = { row: 0, column: 0, available: true, failCommit: false, editing: false, canEndEditing: true, saved: [] as any[], navigations: 0 };
  let closer!: (close: boolean) => Promise<boolean>;
  let selectionChanged = () => {};
  const range = (row: number, column: number) => ({
    getRange: () => ({ startRow: row, endRow: row, startColumn: column, endColumn: column }),
    getValue: () => workbook.sheets.sheet.cellData[row]?.[column]?.v ?? '',
    getRawValue: () => workbook.sheets.sheet.cellData[row]?.[column]?.v ?? '',
    getFormula: () => '',
    getDisplayValue: () => String(workbook.sheets.sheet.cellData[row]?.[column]?.v ?? ''),
    getCellStyleData: () => ({}),
    getNumberFormat: () => 'General',
    getHorizontalAlignment: () => 'general',
    getVerticalAlignment: () => 'middle',
    getWrap: () => false,
    isMerged: () => false,
    isPartOfMerge: () => false,
    setValue: (value: unknown) => {
      if (state.failCommit) throw new Error('Cell write rejected');
      workbook.sheets.sheet.cellData[row] ??= {};
      workbook.sheets.sheet.cellData[row][column] = { v: value };
    },
  });
  const worksheet = {
    getRange: range,
    getSelection: () => ({ getActiveRange: () => range(state.row, state.column) }),
    getSheetId: () => 'sheet',
    getSheetName: () => 'Sheet1',
    getLastRow: () => -1,
    getColumnWidth: () => 1000,
  };
  const disposable = () => ({ dispose() {} });
  const fWorkbook = {
    getActiveSheet: () => worksheet,
    getSheets: () => [],
    getDefinedNames: () => [],
    onSelectionChange: (fn: () => void) => { selectionChanged = fn; return disposable(); },
    onCommandExecuted: disposable,
    isCellEditing: () => state.editing,
    endEditingAsync: async () => state.canEndEditing,
    save: () => structuredClone(workbook),
  };
  const api = { getActiveWorkbook: () => state.available ? fWorkbook : null, getFormula: () => null, addEvent: disposable, Event: {} };
  const hooks = {
    useState(initial: any) {
      const slot = index++;
      if (!(slot in values)) values[slot] = typeof initial === 'function' ? initial() : initial;
      return [values[slot], (next: any) => { values[slot] = typeof next === 'function' ? next(values[slot]) : next; }];
    },
    useRef(initial: any) {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    },
    useEffect(fn: () => unknown) { effects.push(fn); },
    useCallback: (fn: any) => fn,
    useMemo: (fn: any) => fn(),
  };
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const module = { exports: {} as { default: (props: any) => Node } };
  const stub = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : () => ({}) });
  runInNewContext(transformSync(code, { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code, {
    module, exports: module.exports, console, Date,
    localStorage: { getItem: () => null },
    document: { createElement: () => ({ style: {}, remove() {} }) },
    setTimeout: () => 0,
    require(name: string) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => key });
      if (name === '@univerjs/presets') return { ...stub, createUniver: () => ({ univer: { createUnit() {} }, univerAPI: api }), LocaleType: {}, UniverInstanceType: {}, mergeLocales: () => ({}) };
      if (name.startsWith('@univerjs/')) return stub;
      if (name.endsWith('/Authentication')) return { useAccount: () => ({ user: { uid: 'fixture-account' }, login: async () => null }) };
      if (name.endsWith('/storage')) return { useWorkspace: () => ({}) };
      if (name.endsWith('/ui')) return { useUi: () => ({ toast() {} }) };
      if (name.endsWith('/documentCloser')) return { useDocumentCloser: (fn: typeof closer) => { closer = fn; } };
      if (['./sheetUtils', './sheetPro', './sheetAutomation', './autoFitColumn'].includes(name)) return require(resolve('src/editors/sheet', name));
      return stub;
    },
  });
  const props = {
    meta: { id: 'sheet-document', name: 'fixture.xlsx' },
    content: { kind: 'sheet', workbook },
    onSave: async (_meta: unknown, content: unknown) => { state.saved.push(structuredClone(content)); return true; },
    onBack: () => { state.navigations++; },
    onRename() {},
  };
  const render = () => { index = 0; effects.length = 0; return module.exports.default(props); };
  const initial = render();
  const host = nodes(initial).find((node) => node.props?.ref && node.type === 'div' && node.props.ref.current === null);
  assert.ok(host, 'Missing spreadsheet mount');
  host.props!.ref.current = { appendChild() {} };
  const initialize = effects.find((fn) => fn.toString().includes('createUniver'));
  assert.ok(initialize, 'Missing Univer initialization');
  initialize();
  const input = () => {
    const node = nodes(render()).find((node) => node.type === 'input' && node.props?.className === 'sheet-fx-input');
    assert.ok(node, 'Missing formula input');
    return node.props!;
  };
  return { state, render, input, close: (navigate = false) => closer(navigate), select(row: number, column: number) { state.row = row; state.column = column; selectionChanged(); } };
}

test('closing saves formula-bar typing without Enter or a blur event', async () => {
  const editor = createEditor();
  editor.input().onFocus();
  editor.input().onChange({ target: { value: '123' } });
  assert.equal(await editor.close(), true);
  assert.equal(editor.state.saved[0].workbook.sheets.sheet.cellData[0]?.[0]?.v, 123);
  assert.equal(editor.state.navigations, 0);
});

test('closing commits pending formula text to its original cell without Enter', async () => {
  const editor = createEditor();
  editor.select(2, 1);
  editor.input().onFocus();
  editor.input().onChange({ target: { value: '=SUM(A1:A2)' } });
  editor.input().onBlur();
  editor.select(4, 3);
  assert.equal(editor.input().value, '=SUM(A1:A2)');
  assert.equal(await editor.close(), true);
  assert.equal(editor.state.saved[0].workbook.sheets.sheet.cellData[2][1].v, '=SUM(A1:A2)');
  assert.equal(editor.state.saved[0].workbook.sheets.sheet.cellData[4], undefined);
  assert.equal(editor.state.navigations, 0);
});

test('Escape and the cancel button discard pending formula text before closing', async () => {
  for (const cancel of ['escape', 'button']) {
    const editor = createEditor();
    editor.input().onChange({ target: { value: 'Cancelled value' } });
    if (cancel === 'escape') editor.input().onKeyDown({ key: 'Escape', preventDefault() {}, currentTarget: { blur() {} } });
    else {
      const button = nodes(editor.render()).find((node) => node.type === 'button' && node.props?.title === 'Huỷ chỉnh sửa (Esc)');
      assert.ok(button);
      button.props!.onClick();
    }
    assert.equal(await editor.close(), true);
    assert.deepEqual(editor.state.saved[0].workbook.sheets.sheet.cellData, {});
  }
});

test('a failed formula commit refuses exit and preserves the pending value for retry', async () => {
  const editor = createEditor();
  editor.input().onChange({ target: { value: 'Pending value' } });
  editor.state.failCommit = true;
  await assert.rejects(editor.close(true), /Cell write rejected/);
  assert.equal(editor.state.saved.length, 0);
  assert.equal(editor.state.navigations, 0);
  editor.state.failCommit = false;
  assert.equal(await editor.close(true), true);
  assert.equal(editor.state.saved[0].workbook.sheets.sheet.cellData[0][0].v, 'Pending value');
  assert.equal(editor.state.navigations, 1);
});

test('missing edit context and an unconfirmed Univer edit prevent close', async () => {
  const missing = createEditor();
  missing.state.available = false;
  missing.input().onChange({ target: { value: 'Keep pending' } });
  assert.equal(await missing.close(true), false);
  assert.equal(missing.state.saved.length, 0);
  assert.equal(missing.state.navigations, 0);
  const activeCell = createEditor();
  activeCell.state.editing = true;
  activeCell.state.canEndEditing = false;
  assert.equal(await activeCell.close(true), false);
  assert.equal(activeCell.state.saved.length, 0);
  assert.equal(activeCell.state.navigations, 0);
});
