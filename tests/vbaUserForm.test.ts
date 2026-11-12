import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VbaUserFormDef } from '../src/lib/vbaForms';
import { Box, VbaInterpreter, type VbaHost } from '../src/editors/sheet/vba/vbaInterpreter';
import { VbaObject, arg, toStr, type VbaArgs, type VbaValue } from '../src/editors/sheet/vba/vbaRuntime';
import { UserFormSession, type FormControl } from '../src/editors/sheet/vba/vbaUserForm';
import { changedValueBox } from '../src/editors/sheet/vba/vbaEvents';

class FakeCell extends VbaObject {
  readonly typeName = 'Range';
  constructor(private readonly store: Map<string, VbaValue>, private readonly key: string) {
    super();
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'value') return this.store.get(this.key);
    if (name === 'address') return this.key;
    return super.get(name, args);
  }
  set(name: string, _args: VbaArgs, value: VbaValue): boolean {
    if (name !== 'value') return false;
    this.store.set(this.key, value);
    return true;
  }
  defaultGet(): VbaValue {
    return this.store.get(this.key);
  }
  defaultSet(_args: VbaArgs, value: VbaValue) {
    this.store.set(this.key, value);
  }
}

class FakeApp extends VbaObject {
  readonly typeName = 'Application';
  readonly cells = new Map<string, VbaValue>();
  hasGlobal(name: string) {
    return name === 'range';
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'range') return new FakeCell(this.cells, toStr(arg(args, 0)).toUpperCase());
    return super.get(name, args);
  }
}

const control = (name: string, type: VbaUserFormDef['controls'][number]['type'], extra: Partial<VbaUserFormDef['controls'][number]> = {}) => ({
  name,
  type,
  left: 0,
  top: 0,
  width: 60,
  height: 18,
  visible: true,
  enabled: true,
  tabIndex: 0,
  ...extra,
});

const FORM: VbaUserFormDef = {
  name: 'frmNhap',
  caption: 'Nhập',
  width: 200,
  height: 120,
  controls: [
    control('txtTen', 'textbox', { value: 'An', tabIndex: 0 }),
    control('cboLoai', 'combobox', { tabIndex: 1 }),
    control('cmdOK', 'commandbutton', { caption: 'Ghi', tabIndex: 2 }),
    control('cmdHuy', 'commandbutton', { caption: 'Hủy', tabIndex: 3 }),
    control('fraKieu', 'frame', {
      tabIndex: 4,
      children: [control('optNhap', 'optionbutton', { caption: 'Nhập', tabIndex: 0 }), control('optXuat', 'optionbutton', { caption: 'Xuất', tabIndex: 1 })],
    }),
  ],
};

const FORM_CODE = `
Private Sub UserForm_Initialize()
    cboLoai.AddItem "Thép"
    cboLoai.AddItem "Xi măng"
    cboLoai.ListIndex = 0
    optNhap.Value = True
    Range("Z1").Value = Range("Z1").Value + 1
End Sub
Private Sub cboLoai_Change()
    Range("Z2").Value = cboLoai.Value
End Sub
Private Sub cmdOK_Click()
    Range("A2").Value = txtTen.Text
    Range("B2").Value = Me.cboLoai.Value
    Range("C2").Value = IIf(optXuat.Value, "Xuất", "Nhập")
    Unload Me
End Sub
Private Sub cmdHuy_Click()
    Me.Hide
End Sub
Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    Range("Q1").Value = CloseMode
End Sub
`;

const MAIN_CODE = `
Sub MoForm()
    frmNhap.Show
    Range("D1").Value = "đóng"
End Sub
Sub MoKhongCho()
    frmNhap.Show vbModeless
    Range("D2").Value = "chạy tiếp"
End Sub
`;

function setup() {
  const app = new FakeApp();
  let forms: UserFormSession | null = null;
  const host: VbaHost = {
    application: app,
    msgBox: () => 1,
    inputBox: () => '',
    print: () => undefined,
    evaluateBracket: () => undefined,
    createObject: () => null,
    documentObject: (target) => (target.startsWith('form:') ? forms!.instance(target.slice(5)) : null),
  };
  const interpreter = new VbaInterpreter(
    [
      { name: 'ModMain', code: MAIN_CODE },
      { name: 'frmNhap', code: FORM_CODE, document: 'form:frmNhap' },
    ],
    host
  );
  forms = new UserFormSession([FORM], {
    hasHandler: (module, proc) => interpreter.hasProcedure(module, proc),
    fire: (module, proc, args) => interpreter.runEvent(`${module}.${proc}`, args),
    wait: (promise) => interpreter.requestWait(promise),
    resetModule: (module) => interpreter.resetModule(module),
  });
  return { app, interpreter, forms };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const find = (forms: UserFormSession, name: string) => forms.visibleForms()[0].all.get(name.toLowerCase()) as FormControl;

test('a modal Show waits for the form, runs button code, then continues after Unload', async () => {
  const { app, interpreter, forms } = setup();
  const run = interpreter.runAsync('MoForm');
  await tick();
  assert.equal(forms.visibleForms().length, 1);
  assert.equal(app.cells.get('Z1'), 1);
  assert.equal(app.cells.get('Z2'), 'Thép');
  assert.equal(app.cells.get('D1'), undefined);
  find(forms, 'txtTen').setValue('Bình', true);
  find(forms, 'cboLoai').setListIndex(1, true);
  assert.equal(app.cells.get('Z2'), 'Xi măng');
  find(forms, 'optXuat').setValue(true, true);
  assert.equal(find(forms, 'optNhap').checked, false);
  find(forms, 'cmdOK').form.fireControl(find(forms, 'cmdOK'), 'Click');
  await run;
  assert.deepEqual([app.cells.get('A2'), app.cells.get('B2'), app.cells.get('C2'), app.cells.get('D1')], ['Bình', 'Xi măng', 'Xuất', 'đóng']);
  assert.equal(app.cells.get('Q1'), 1);
  assert.equal(forms.visibleForms().length, 0);
});

test('Unload resets the form so the next Show initializes it again', async () => {
  const { app, interpreter, forms } = setup();
  const first = interpreter.runAsync('MoForm');
  await tick();
  find(forms, 'txtTen').setValue('Đổi', true);
  void forms.visibleForms()[0].requestClose();
  await first;
  const second = interpreter.runAsync('MoForm');
  await tick();
  assert.equal(find(forms, 'txtTen').text, 'An');
  assert.equal(app.cells.get('Z1'), 2);
  assert.equal(app.cells.get('Q1'), 0);
  find(forms, 'cmdHuy').form.fireControl(find(forms, 'cmdHuy'), 'Click');
  await second;
  assert.equal(forms.visibleForms().length, 0);
});

test('Me.Hide keeps the form loaded and modeless Show does not wait', async () => {
  const { app, interpreter, forms } = setup();
  await interpreter.runAsync('MoKhongCho');
  assert.equal(app.cells.get('D2'), 'chạy tiếp');
  assert.equal(forms.visibleForms().length, 1);
  find(forms, 'txtTen').setValue('Giữ', true);
  find(forms, 'cmdHuy').form.fireControl(find(forms, 'cmdHuy'), 'Click');
  await tick();
  assert.equal(forms.visibleForms().length, 0);
  assert.equal(forms.instance('frmNhap')!.all.get('txtten')!.text, 'Giữ');
});

test('event procedures receive ByRef Cancel and run while another macro is running', async () => {
  const code = `
Public Count As Long
Sub Workbook_BeforeSave(ByVal SaveAsUI As Boolean, Cancel As Boolean)
    Cancel = Range("A1").Value = "khoá"
End Sub
Sub Worksheet_Change(ByVal Target As Object)
    Count = Count + 1
    Range("B1").Value = Count
End Sub
Sub Ghi()
    Range("A1").Value = "x"
End Sub
`;
  const app = new FakeApp();
  const host: VbaHost = { application: app, msgBox: () => 1, inputBox: () => '', print: () => undefined, evaluateBracket: () => undefined, createObject: () => null };
  const interpreter = new VbaInterpreter([{ name: 'ThisWorkbook', code }], host);
  const cancel = new Box(false, 'boolean');
  app.cells.set('A1', 'khoá');
  await interpreter.runEvent('ThisWorkbook.Workbook_BeforeSave', [false, cancel]);
  assert.equal(cancel.v, true);
  await interpreter.runEvent('ThisWorkbook.Worksheet_Change', [new FakeCell(app.cells, 'A1')]);
  await interpreter.runEvent('ThisWorkbook.Worksheet_Change', [new FakeCell(app.cells, 'A1')]);
  assert.equal(app.cells.get('B1'), 2);
});

test('only value edits count as Worksheet_Change targets', () => {
  assert.deepEqual(changedValueBox({ 2: { 1: { v: 5 }, 3: { s: 'bold' } }, 4: { 2: null } }), { r0: 2, c0: 1, r1: 4, c1: 2 });
  assert.equal(changedValueBox({ 1: { 1: { s: 'x' } } }), null);
});
