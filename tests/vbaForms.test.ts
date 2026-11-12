import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import JSZip from 'jszip';
import { readVbaProject } from '../src/lib/vbaProject';

async function fixtureProject() {
  const zip = await JSZip.loadAsync(readFileSync(new URL('./fixtures/userform-events.xlsm', import.meta.url)));
  const bin = await zip.file('xl/vbaProject.bin')!.async('uint8array');
  return readVbaProject(bin);
}

test('a UserForm saved by Excel reads back with its controls and layout', async () => {
  const project = await fixtureProject();
  if (process.env.DUMP_FORMS) console.log(JSON.stringify(project.forms, null, 1));
  const form = project.forms?.find((item) => item.name === 'frmNhap');
  assert.ok(form);
  assert.equal(form.width, 288);
  assert.ok(Math.abs(form.height - 231) < 1);
  const byName = new Map(form.controls.map((control) => [control.name, control]));
  assert.deepEqual([...byName.keys()], ['lblTen', 'txtTen', 'cboLoai', 'lstMuc', 'chkDuyet', 'fraKieu', 'cmdOK', 'cmdHuy', 'tglXem']);
  assert.equal(byName.get('lblTen')!.type, 'label');
  assert.equal(byName.get('lblTen')!.caption, 'Họ tên:');
  assert.deepEqual([byName.get('lblTen')!.left, byName.get('lblTen')!.top, byName.get('lblTen')!.width, byName.get('lblTen')!.height], [12, 12, 60, 18]);
  assert.equal(byName.get('txtTen')!.type, 'textbox');
  assert.equal(byName.get('txtTen')!.value, 'Nguyễn Văn A');
  assert.equal(byName.get('cboLoai')!.type, 'combobox');
  assert.equal(byName.get('lstMuc')!.type, 'listbox');
  assert.equal(byName.get('chkDuyet')!.type, 'checkbox');
  assert.equal(byName.get('chkDuyet')!.caption, 'Đã duyệt');
  assert.equal(byName.get('chkDuyet')!.value, '1');
  assert.equal(byName.get('cmdOK')!.type, 'commandbutton');
  assert.equal(byName.get('cmdOK')!.caption, 'Ghi');
  assert.equal(byName.get('tglXem')!.type, 'togglebutton');
  const frame = byName.get('fraKieu')!;
  assert.equal(frame.type, 'frame');
  assert.equal(frame.caption, 'Kiểu');
  assert.deepEqual([frame.width, frame.height], [150, 60]);
  assert.deepEqual(frame.children!.map((child) => [child.name, child.type, child.caption]), [
    ['optNhap', 'optionbutton', 'Nhập'],
    ['optXuat', 'optionbutton', 'Xuất'],
  ]);
  assert.equal(byName.get('txtTen')!.font?.name, 'Tahoma');
});

test('event procedures of the fixture are read as document and form code', async () => {
  const project = await fixtureProject();
  const kinds = Object.fromEntries(project.modules.map((module) => [module.name, module.kind]));
  assert.equal(kinds.frmNhap, 'form');
  assert.equal(kinds.Sheet1, 'document');
  assert.match(project.modules.find((module) => module.name === 'Sheet1')!.code, /Worksheet_Change/);
});

test('an Excel UserForm survives an .xlsm export, including edited form code', async () => {
  const { readSpreadsheet, writeWorkbookXlsx } = await import('../src/lib/xlsxCodec');
  const original = await readSpreadsheet(readFileSync(new URL('./fixtures/userform-events.xlsm', import.meta.url)), 'userform-events.xlsm');
  assert.equal(original.vba?.forms?.[0]?.name, 'frmNhap');
  const modules = original.vba!.modules.map((module) => (module.name === 'frmNhap' ? { ...module, code: `${module.code}\r\nPrivate Sub tglXem_Click()\r\n    Me.Caption = "Xem"\r\nEnd Sub` } : module));
  const buffer = await writeWorkbookXlsx({ ...original, vba: { ...original.vba!, modules } }, { macroEnabled: true });
  const reopened = await readSpreadsheet(buffer, 'thu.xlsm');
  const form = reopened.vba?.forms?.find((item) => item.name === 'frmNhap');
  assert.ok(form);
  assert.deepEqual(form.controls.map((control) => control.name), ['lblTen', 'txtTen', 'cboLoai', 'lstMuc', 'chkDuyet', 'fraKieu', 'cmdOK', 'cmdHuy', 'tglXem']);
  assert.equal(reopened.vba?.modules.find((module) => module.name === 'frmNhap')?.kind, 'form');
  assert.match(reopened.vba!.modules.find((module) => module.name === 'frmNhap')!.code, /tglXem_Click/);
  assert.match(reopened.vba!.modules.find((module) => module.name === 'Sheet1')!.code, /Worksheet_Change/);
});

test('VBA projects are written with directory names in MS-CFB order so Windows finds form storages', async () => {
  const { readSpreadsheet, writeWorkbookXlsx } = await import('../src/lib/xlsxCodec');
  const { cfbChildOrder, compareCfbNames } = await import('../src/lib/cfbOrder');
  const original = await readSpreadsheet(readFileSync(new URL('./fixtures/userform-events.xlsm', import.meta.url)), 'userform-events.xlsm');
  const zip = await JSZip.loadAsync(await writeWorkbookXlsx(original, { macroEnabled: true }));
  const tree = cfbChildOrder(await zip.file('xl/vbaProject.bin')!.async('uint8array'));
  for (const [storage, names] of Object.entries(tree)) assert.deepEqual(names, [...names].sort(compareCfbNames), storage);
  assert.ok(tree['Root Entry'].indexOf('frmNhap') < tree['Root Entry'].indexOf('PROJECT'));
});
