import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  buildVbaProject,
  compressContainer,
  decompressContainer,
  defaultAttributes,
  fromAsciiSafeVba,
  procShortcut,
  readVbaProject,
  toAsciiSafeVba,
  withProcShortcut,
  type VbaProjectData,
} from '../src/lib/vbaProject';
import { readSpreadsheet, writeWorkbookXlsx } from '../src/lib/xlsxCodec';
import { RECORDED_VBA_MODULE } from '../src/lib/xlsmPackage';
import type { WorkbookData } from '../src/lib/sheetTypes';
import { recordedMacrosToVba } from '../src/editors/sheet/vba/recordedToVba';
import { listVbaMacros, messageBoxAnswer, VB_CANCEL, VB_NO, VB_OK, VB_YES } from '../src/editors/sheet/vba/runVba';
import type { SheetMacro } from '../src/editors/sheet/sheetMacros';

const CODE = 'Option Explicit\r\n\r\nSub ChaoSep()\r\n    Range("A1").Value = "Xin chào sếp"\r\nEnd Sub\r\n';

const project = (): VbaProjectData => ({
  codePage: 1252,
  modules: [
    {
      name: 'Module1',
      kind: 'standard',
      code: CODE,
      attributes: defaultAttributes({ name: 'Module1', kind: 'standard' }),
      procAttributes: { chaosep: withProcShortcut(undefined, 'ChaoSep', 'q') },
    },
  ],
});

const workbook = (): WorkbookData => ({
  id: 'wb',
  name: 'Thử macro',
  appVersion: '1',
  locale: 'viVN',
  styles: {},
  sheetOrder: ['s1'],
  sheets: {
    s1: {
      id: 's1',
      name: 'Bảng chính',
      rowCount: 20,
      columnCount: 6,
      cellData: { 0: { 0: { v: 'Chạy', custom: { minhMacro: 'vba:Module1.ChaoSep' } } }, 2: { 1: { v: 42 } } },
      rowData: {},
      columnData: {},
      mergeData: [],
    },
  },
});

const recorded: SheetMacro = {
  id: 'm1',
  name: 'Tô đậm',
  description: '',
  shortcut: 'K',
  relative: false,
  origin: { row: 0, column: 0 },
  steps: [{ kind: 'command', sheetId: 's1', id: 'sheet.command.set-range-values', params: { range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }, value: { v: 1 } } }],
  createdAt: 1,
};

test('compressed containers round-trip repetitive and irregular data', () => {
  const repetitive = new TextEncoder().encode('Attribute VB_Name = "Module1"\r\n'.repeat(400));
  const irregular = Uint8Array.from({ length: 9000 }, (_, index) => (index * 7919) % 251);
  for (const sample of [repetitive, irregular, new Uint8Array(0)]) {
    assert.deepEqual(decompressContainer(compressContainer(sample)), sample);
  }
  assert.ok(compressContainer(repetitive).length < repetitive.length / 4);
});

test('Vietnamese string literals survive the ANSI code page as ChrW', () => {
  const safe = toAsciiSafeVba(CODE);
  assert.match(safe, /ChrW\(/);
  assert.ok([...safe].every((char) => char.charCodeAt(0) < 128));
  assert.equal(fromAsciiSafeVba(safe), CODE);
});

test('shortcut attributes use the literal \\n that Excel writes', () => {
  const lines = withProcShortcut(undefined, 'ChaoSep', 'Q');
  assert.equal(lines[0], 'Attribute ChaoSep.VB_ProcData.VB_Invoke_Func = "Q\\n14"');
  assert.equal(procShortcut(lines), 'Q');
  assert.equal(procShortcut(withProcShortcut(lines, 'ChaoSep', '')), '');
});

test('a built VBA project reads back with its code and shortcuts', () => {
  const bytes = buildVbaProject(project(), { workbookCodeName: 'ThisWorkbook', sheetCodeNames: ['Sheet1'] });
  const read = readVbaProject(bytes);
  const module1 = read.modules.find((module) => module.name === 'Module1');
  assert.ok(module1);
  assert.equal(module1.code.replace(/\r\n/g, '\n').trim(), CODE.replace(/\r\n/g, '\n').trim());
  assert.equal(procShortcut(module1.procAttributes?.chaosep), 'q');
  assert.ok(read.modules.some((module) => module.name === 'ThisWorkbook' && module.kind === 'document'));
  assert.deepEqual(listVbaMacros(read).map((macro) => `${macro.id}:${macro.shortcut}`), ['Module1.ChaoSep:q']);
});

test('an .xlsm export keeps VBA, recorded macros and buttons through a reopen', async () => {
  const data = workbook();
  const converted = recordedMacrosToVba([recorded], new Set(['ChaoSep', 'Module1']));
  data.vba = {
    ...project(),
    modules: [...project().modules, { name: RECORDED_VBA_MODULE, kind: 'standard', code: converted.code, attributes: defaultAttributes({ name: RECORDED_VBA_MODULE, kind: 'standard' }), procAttributes: converted.procAttributes }],
  };
  data.automation = { version: 1, macros: [recorded] };
  const buffer = await writeWorkbookXlsx(data, { macroEnabled: true });
  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file('xl/vbaProject.bin'));
  assert.match(await zip.file('[Content_Types].xml')!.async('string'), /macroEnabled\.main\+xml/);
  assert.match(await zip.file('xl/workbook.xml')!.async('string'), /codeName="ThisWorkbook"/);

  const reopened = await readSpreadsheet(buffer, 'thu.xlsm');
  assert.deepEqual(reopened.vba?.modules.filter((module) => module.kind === 'standard').map((module) => module.name), ['Module1']);
  assert.equal(reopened.vba?.sheetCodeNames?.['Bảng chính'], 'Sheet1');
  assert.equal((reopened.automation?.macros as SheetMacro[])[0].name, 'Tô đậm');
  const sheet = reopened.sheets[reopened.sheetOrder[0]];
  assert.equal(sheet.cellData[0][0].custom?.minhMacro, 'vba:Module1.ChaoSep');
});

test('an .xlsx export carries macros and buttons but no VBA', async () => {
  const data = workbook();
  data.vba = project();
  data.automation = { version: 1, macros: [recorded] };
  const buffer = await writeWorkbookXlsx(data);
  const zip = await JSZip.loadAsync(buffer);
  assert.equal(zip.file('xl/vbaProject.bin'), null);
  const reopened = await readSpreadsheet(buffer, 'thu.xlsx');
  assert.equal(reopened.vba, undefined);
  assert.equal((reopened.automation?.macros as SheetMacro[]).length, 1);
  assert.equal(reopened.sheets[reopened.sheetOrder[0]].cellData[0][0].custom?.minhMacro, 'vba:Module1.ChaoSep');
});

test('MsgBox buttons map to the answers VBA expects', () => {
  const said: string[] = [];
  const alert = (text: string) => void said.push(text);
  assert.equal(messageBoxAnswer(0, () => true, alert, 'Xong'), VB_OK);
  assert.deepEqual(said, ['Xong']);
  assert.equal(messageBoxAnswer(1, () => false, alert, 'Tiếp?'), VB_CANCEL);
  assert.equal(messageBoxAnswer(4, () => true, alert, 'Có?'), VB_YES);
  assert.equal(messageBoxAnswer(4 + 32, () => false, alert, 'Có?'), VB_NO);
});
