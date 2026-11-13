import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VbaInterpreter, listProcedures, runnableMacros, type VbaHost } from '../src/editors/sheet/vba/vbaInterpreter';
import { VbaArray, VbaError, VbaObject, arg, toStr, type VbaArgs, type VbaValue } from '../src/editors/sheet/vba/vbaRuntime';
import { vbaFormat } from '../src/editors/sheet/vba/vbaBuiltins';
import { parseModule } from '../src/editors/sheet/vba/vbaParser';

class FakeCell extends VbaObject {
  readonly typeName = 'Range';
  readonly store: Map<string, VbaValue>;
  readonly key: string;
  constructor(store: Map<string, VbaValue>, key: string) {
    super();
    this.store = store;
    this.key = key;
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'value') return this.store.get(this.key);
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
    return name === 'range' || name === 'cells';
  }
  get(name: string, args: VbaArgs): VbaValue {
    if (name === 'range') return new FakeCell(this.cells, toStr(arg(args, 0)).toUpperCase());
    if (name === 'cells') return new FakeCell(this.cells, `R${toStr(arg(args, 0))}C${toStr(arg(args, 1))}`);
    return super.get(name, args);
  }
}

function harness(code: string, answers: number[] = []) {
  const app = new FakeApp();
  const output: string[] = [];
  const messages: string[] = [];
  const host: VbaHost = {
    application: app,
    msgBox: (prompt) => {
      messages.push(prompt);
      return answers.shift() ?? 1;
    },
    inputBox: () => 'abc',
    print: (text) => output.push(text),
    evaluateBracket: (text) => new FakeCell(app.cells, text.toUpperCase()),
    createObject: () => null,
  };
  const interpreter = new VbaInterpreter([{ name: 'Module1', code }], host);
  return { interpreter, app, output, messages };
}

test('runs loops, conditions, string and array functions', () => {
  const { interpreter, output } = harness(`
Option Explicit
Sub Main()
    Dim i As Long, total As Long, words() As String, s As String
    For i = 1 To 10 Step 2
        If i Mod 3 = 0 Then
            total = total + i * 10
        ElseIf i = 5 Then
            total = total + 1
        Else
            total = total + i
        End If
    Next i
    Debug.Print total
    words = Split("a,b,c", ",")
    Debug.Print UBound(words); Join(words, "-"); UCase(Left("xinh", 2))
    s = ""
    Do While Len(s) < 3
        s = s & "x"
    Loop
    Debug.Print s, Replace("hello", "l", "L"), InStr("abcabc", "c"), Mid("abcdef", 2, 3)
End Sub
`);
  interpreter.run('Main');
  assert.equal(output[0], String(1 + 30 + 1 + 7 + 90));
  assert.equal(output[1], '2 a-b-c XI');
  assert.equal(output[2], 'xxx heLLo 3 bcd');
});

test('calls functions with ByRef and ByVal parameters, recursion and Select Case', () => {
  const { interpreter, output } = harness(`
Function Fact(n)
    If n <= 1 Then
        Fact = 1
    Else
        Fact = n * Fact(n - 1)
    End If
End Function

Sub Bump(ByRef x, ByVal y)
    x = x + 1
    y = y + 1
End Sub

Function Grade(score As Double) As String
    Select Case score
        Case Is >= 8: Grade = "Gioi"
        Case 5 To 7.99: Grade = "Kha"
        Case Else: Grade = "Yeu"
    End Select
End Function

Sub Main()
    Dim a As Long, b As Long
    a = 1: b = 1
    Bump a, b
    Debug.Print Fact(5), a, b, Grade(9), Grade(6), Grade(2)
End Sub
`);
  interpreter.run('Main');
  assert.equal(output[0], '120 2 1 Gioi Kha Yeu');
});

test('writes and reads cells through the host object model and With blocks', () => {
  const { interpreter, app } = harness(`
Sub Fill()
    Dim r As Integer
    For r = 1 To 3
        Cells(r, 1) = r * 2
        Cells(r, 2).Value = "row " & r
    Next
    Range("a1").Value = Range("A1").Value + 100
    [B9] = "bracket"
End Sub
`);
  interpreter.run('Fill');
  assert.equal(app.cells.get('R1C1'), 2);
  assert.equal(app.cells.get('R3C2'), 'row 3');
  assert.equal(app.cells.get('A1'), 100);
  assert.equal(app.cells.get('B9'), 'bracket');
});

test('handles On Error Resume Next, On Error GoTo and Err object', () => {
  const { interpreter, output } = harness(`
Sub Safe()
    On Error Resume Next
    Dim x
    x = 1 / 0
    Debug.Print "after", Err.Number
    On Error GoTo Handler
    Err.Raise 513, , "custom failure"
    Debug.Print "not reached"
    Exit Sub
Handler:
    Debug.Print "handled", Err.Number, Err.Description
End Sub
`);
  interpreter.run('Safe');
  assert.deepEqual(output, ['after 11', 'handled 513 custom failure']);
});

test('supports collections, dictionaries, ReDim Preserve and For Each', () => {
  const { interpreter, output } = harness(`
Sub Main()
    Dim c As New Collection, d As Object, item, arr() As Long, i As Long, total As Long
    c.Add 5: c.Add 7: c.Add 9
    For Each item In c
        total = total + item
    Next
    Set d = CreateObject("Scripting.Dictionary")
    d("a") = 1
    d.Add "b", 2
    ReDim arr(1 To 2)
    arr(1) = 10: arr(2) = 20
    ReDim Preserve arr(1 To 3)
    arr(3) = 30
    For i = LBound(arr) To UBound(arr)
        total = total + arr(i)
    Next
    Debug.Print total, c.Count, d.Count, d.Exists("b"), d("a")
End Sub
`);
  const host = (interpreter as unknown as { host: VbaHost }).host;
  host.createObject = () => null;
  interpreter.run('Main');
  assert.equal(output[0], '81 3 2 True 1');
});

test('MsgBox returns the chosen button and Exit For stops the loop', () => {
  const { interpreter, output, messages } = harness(
    `
Sub Ask()
    Dim i As Long
    If MsgBox("Tiep tuc?", vbYesNo) = vbYes Then Debug.Print "yes"
    For i = 1 To 100
        If i = 4 Then Exit For
    Next
    Debug.Print i
End Sub
`,
    [6]
  );
  interpreter.run('Ask');
  assert.deepEqual(messages, ['Tiep tuc?']);
  assert.deepEqual(output, ['yes', '4']);
});

test('stops infinite loops with a clear error', () => {
  const app = new FakeApp();
  const interpreter = new VbaInterpreter(
    [{ name: 'Module1', code: 'Sub Spin()\n  Do\n  Loop\nEnd Sub' }],
    { application: app, msgBox: () => 1, inputBox: () => '', print: () => undefined, evaluateBracket: () => undefined, createObject: () => null },
    { maxSteps: 5000 }
  );
  assert.throws(() => interpreter.run('Spin'), (error: unknown) => error instanceof VbaError && /vòng lặp vô hạn/.test(error.message));
});

test('reports syntax errors with the module name and line, and lists runnable macros', () => {
  const sources = [
    { name: 'Module1', code: 'Sub A()\nEnd Sub\nPrivate Sub B()\nEnd Sub\nSub C(x)\nEnd Sub\nFunction D()\nEnd Function' },
    { name: 'Broken', code: 'Sub X()\n  If True Then\nEnd Sub' },
  ];
  const { procedures, errors } = listProcedures(sources);
  assert.equal(procedures.length, 4);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^Broken: /);
  assert.deepEqual(runnableMacros(sources.slice(0, 1)).map((proc) => proc.name), ['A']);
});

test('formats numbers and dates like VBA Format', () => {
  assert.equal(vbaFormat(1234.5, '#,##0.00'), '1,234.50');
  assert.equal(vbaFormat(0.256, '0.0%'), '25.6%');
  assert.equal(vbaFormat(7, '000'), '007');
  assert.equal(vbaFormat('2026-11-12', 'dd/mm/yyyy'), '12/11/2026');
  assert.ok(VbaArray.fromGrid([[1, 2], [3, 4]]).get([2, 1]) === 3);
});

test('sheet code names act as the worksheet and still expose their own procedures', () => {
  const sheet = new FakeApp();
  const app = new FakeApp();
  const host: VbaHost = {
    application: app,
    msgBox: () => 1,
    inputBox: () => '',
    print: () => undefined,
    evaluateBracket: (text) => new FakeCell(app.cells, text),
    createObject: () => null,
    documentObject: (target) => (target === 'Dữ liệu' ? sheet : null),
  };
  const interpreter = new VbaInterpreter(
    [
      { name: 'shData', code: '', document: 'Dữ liệu' },
      { name: 'shLog', code: 'Public Sub Ghi()\n    Range("Z1").Value = "log"\nEnd Sub', document: 'Dữ liệu' },
      { name: 'Module1', code: 'Sub T()\n    Dim ws As Object\n    Set ws = shData\n    ws.Range("A1").Value = 5\n    shLog.Range("B2").Value = shData.Range("A1").Value + 1\n    shLog.Ghi\nEnd Sub' },
    ],
    host
  );
  interpreter.run('T');
  assert.equal(sheet.cells.get('A1'), 5);
  assert.equal(sheet.cells.get('B2'), 6);
  assert.equal(app.cells.get('Z1'), 'log');
});

test('TypeOf ... Is parses inside If and reports non-objects as false', () => {
  const parsed = parseModule('M', 'Sub A()\nDim x\nIf TypeOf x Is Worksheet Then\nx = 1\nEnd If\nEnd Sub');
  assert.equal(parsed.procs.length, 1);
});
