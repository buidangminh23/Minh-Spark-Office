import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readSpreadsheet, writeWorkbookXlsx } from '../src/lib/xlsxCodec';
import { applyCenterAcross, isCenterAcrossMerge } from '../src/lib/centerAcross';
import { splitRoot } from '../src/lib/xlsxPreserve';
import { emptySheet } from '../src/lib/workbookBasics';
import { anchorPoint, type FormButtonSheet } from '../src/editors/sheet/FormButtonLayer';

const SHEET_PATH = 'xl/worksheets/sheet1.xml';
const RELS_PATH = 'xl/worksheets/_rels/sheet1.xml.rels';
const DRAWING = '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>';
const VML = '<xml xmlns:v="urn:schemas-microsoft-com:vml"/>';
const CTRL = '<formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" objectType="Button" lockText="1"/>';
const RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const toArrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function workbookWithForms() {
  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet('Bia');
  first.getCell('A1').value = 'Title';
  first.getCell('B3').value = 5;
  workbook.addWorksheet('Data').getCell('A1').value = 1;
  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  const xml = await zip.file(SHEET_PATH)!.async('string');
  const extras = '<sheetProtection sheet="1" objects="1"/><autoFilter ref="A1:B3"/>'
    + '<dataValidations count="1"><dataValidation type="list" sqref="B3"><formula1>"a,b"</formula1></dataValidation></dataValidations>'
    + '<hyperlinks><hyperlink ref="A1" location="Data!A1" display="Go"/></hyperlinks>';
  const objects = '<drawing r:id="rId1"/><legacyDrawing r:id="rId2"/>'
    + '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x14"><controls>'
    + '<control shapeId="1025" r:id="rId3" name="Button 1"/></controls></mc:Choice></mc:AlternateContent>';
  const patched = xml
    .replace('<worksheet ', '<worksheet xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" ')
    .replace('</sheetData>', `</sheetData>${extras}`)
    .replace(/<pageSetup\b[^>]*\/>/, '<pageSetup paperSize="9" scale="56" orientation="landscape"/>')
    .replace('</worksheet>', `${objects}</worksheet>`);
  zip.file(SHEET_PATH, patched);
  zip.file(RELS_PATH, `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${RELATIONSHIP}/drawing" Target="../drawings/drawing1.xml"/>`
    + `<Relationship Id="rId2" Type="${RELATIONSHIP}/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>`
    + `<Relationship Id="rId3" Type="${RELATIONSHIP}/ctrlProp" Target="../ctrlProps/ctrlProp1.xml"/></Relationships>`);
  zip.file('xl/drawings/drawing1.xml', DRAWING);
  zip.file('xl/drawings/vmlDrawing1.vml', VML);
  zip.file('xl/ctrlProps/ctrlProp1.xml', CTRL);
  const types = await zip.file('[Content_Types].xml')!.async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
    + '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
    + '<Override PartName="/xl/ctrlProps/ctrlProp1.xml" ContentType="application/vnd.ms-excel.controlproperties+xml"/></Types>'));
  const book = await zip.file('xl/workbook.xml')!.async('string');
  zip.file('xl/workbook.xml', book.replace('</sheets>', '</sheets><definedNames><definedName name="Total">Data!$A$1</definedName>'
    + '<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Bia!$A$1:$B$3</definedName></definedNames>'));
  return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

test('saving a workbook keeps the form controls and sheet features of the original file', async () => {
  const data = await readSpreadsheet(await workbookWithForms(), 'forms.xlsx');
  assert.ok(data.sourcePackage, 'original parts are captured on import');
  data.sheets[data.sheetOrder[0]].cellData[5] = { 0: { v: 'edited', t: 1 } };
  const zip = await JSZip.loadAsync(await writeWorkbookXlsx(data));
  const xml = await zip.file(SHEET_PATH)!.async('string');
  const names = splitRoot(xml, 'worksheet')!.children.map((child) => child.name);
  for (const name of ['sheetProtection', 'autoFilter', 'dataValidations', 'hyperlinks', 'drawing', 'legacyDrawing', 'controls']) {
    assert.ok(names.includes(name), `${name} is kept`);
  }
  assert.deepEqual(names, [...names].sort((a, b) => order(a) - order(b)), 'worksheet children stay in schema order');
  assert.match(xml, /<pageSetup paperSize="9" scale="56" orientation="landscape"\/>/);
  assert.match(xml, /edited|t="s"/);
  const rels = await zip.file(RELS_PATH)!.async('string');
  for (const id of [...xml.matchAll(/r:id="([^"]+)"/g)].map((match) => match[1])) assert.ok(rels.includes(`Id="${id}"`), `${id} resolves`);
  assert.equal(await zip.file('xl/drawings/drawing1.xml')!.async('string'), DRAWING);
  assert.equal(await zip.file('xl/drawings/vmlDrawing1.vml')!.async('string'), VML);
  assert.equal(await zip.file('xl/ctrlProps/ctrlProp1.xml')!.async('string'), CTRL);
  const types = await zip.file('[Content_Types].xml')!.async('string');
  assert.match(types, /Extension="vml"/);
  assert.match(types, /PartName="\/xl\/ctrlProps\/ctrlProp1\.xml"/);
  const book = await zip.file('xl/workbook.xml')!.async('string');
  assert.match(book, /<definedName name="Total">Data!\$A\$1<\/definedName>/);
  assert.match(book, /name="_xlnm\._FilterDatabase" localSheetId="0"/);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await zip.generateAsync({ type: 'arraybuffer' }));
  assert.equal(reopened.getWorksheet('Bia')!.getCell('A6').value, 'edited');
});

const ORDER = ['sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'sheetProtection', 'autoFilter', 'mergeCells', 'conditionalFormatting',
  'dataValidations', 'hyperlinks', 'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'drawing', 'legacyDrawing', 'controls', 'tableParts', 'extLst'];
const order = (name: string) => ORDER.indexOf(name);

test('removed sheets drop their kept parts and remap sheet-scoped names', async () => {
  const data = await readSpreadsheet(await workbookWithForms(), 'forms.xlsx');
  const [first, second] = data.sheetOrder;
  data.sheetOrder = [second];
  delete data.sheets[first];
  const zip = await JSZip.loadAsync(await writeWorkbookXlsx(data));
  assert.equal(zip.file('xl/drawings/drawing1.xml'), null);
  const book = await zip.file('xl/workbook.xml')!.async('string');
  assert.doesNotMatch(book, /_FilterDatabase/);
  assert.match(book, /name="Total"/);
});

test('centre-across-selection cells become one centred block and export back unchanged', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('S');
  sheet.getCell('C2').value = 'TITLE';
  for (const address of ['C2', 'D2', 'E2', 'F2']) sheet.getCell(address).alignment = { horizontal: 'centerContinuous' };
  sheet.getCell('H2').value = 'alone';
  sheet.getCell('H2').alignment = { horizontal: 'centerContinuous' };
  const data = await readSpreadsheet(await workbook.xlsx.writeBuffer() as ArrayBuffer, 'center.xlsx');
  const imported = data.sheets[data.sheetOrder[0]];
  assert.deepEqual(imported.mergeData, [{ startRow: 1, endRow: 1, startColumn: 2, endColumn: 5 }]);
  assert.ok(isCenterAcrossMerge(imported, imported.mergeData[0]));
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await writeWorkbookXlsx(data));
  const exported = reopened.getWorksheet('S')!;
  assert.equal(exported.getCell('D2').isMerged, false);
  assert.equal(exported.getCell('C2').alignment.horizontal, 'centerContinuous');
  assert.equal(exported.getCell('F2').alignment.horizontal, 'centerContinuous');
});

test('centre-across stops at filled cells and existing merges', () => {
  const sheet = emptySheet('S');
  sheet.cellData = { 0: { 0: { v: 'a' }, 2: { v: 'b' }, 4: { v: 'c' } } };
  sheet.mergeData = [{ startRow: 0, endRow: 1, startColumn: 5, endColumn: 5 }];
  applyCenterAcross(sheet, new Map([[0, new Set([0, 1, 2, 3, 4, 5, 6])]]));
  assert.deepEqual(sheet.mergeData.slice(1), [
    { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 },
    { startRow: 0, endRow: 0, startColumn: 2, endColumn: 3 },
  ]);
});

test('drawing anchors clamp their offsets to the anchored cell like Excel', () => {
  const columns = [0, 50, 150, 250];
  const rows = [0, 7, 14, 60];
  const sheet = {
    getRange: (row: number, column: number) => ({ getCellRect: () => ({ x: columns[column], y: rows[row] }) }),
  } as unknown as FormButtonSheet;
  const origin = { x: 0, y: 0 };
  assert.deepEqual(anchorPoint(sheet, { row: 1, column: 1, rowOffset: 199, columnOffset: 30 }, origin), { x: 80, y: 14 });
  assert.deepEqual(anchorPoint(sheet, { row: 2, column: 0, rowOffset: 10, columnOffset: 500 }, origin), { x: 50, y: 24 });
});
