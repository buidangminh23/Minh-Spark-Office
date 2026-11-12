import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { excelPartLabels, mergeExcelFiles, splitExcelFile } from '../src/lib/excelFileParts';

Object.assign(globalThis, { DOMParser, XMLSerializer });

async function makeFile(name: string, populate: (workbook: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook();
  populate(workbook);
  return new File([await workbook.xlsx.writeBuffer()], name);
}

async function open(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook;
}

test('XLSX merge disambiguates sheet names and preserves formulas, formatting, validation, dimensions and merged cells', async () => {
  const first = await makeFile('first.xlsx', book => {
    book.addWorksheet("Dữ liệu 'Q1").getCell('A1').value = 3;
  });
  const second = await makeFile('second.xlsx', book => {
    const data = book.addWorksheet("Dữ liệu 'Q1");
    data.getCell('A1').value = 42;
    data.getCell('A1').numFmt = '0.00';
    data.getCell('A1').font = { bold: true };
    data.mergeCells('C2:D3');
    data.getCell('C2').value = 'merged';
    data.getColumn(1).width = 26;
    data.getRow(1).height = 40;
    const total = book.addWorksheet('Totals');
    total.getCell('A1').value = { formula: `"Dữ liệu 'Q1!"&'Dữ liệu ''Q1'!A1` };
    total.getCell('B1').dataValidation = { type: 'custom', formulae: ["'Dữ liệu ''Q1'!A1>0"] };
  });
  assert.deepEqual(await excelPartLabels(second), ["Dữ liệu 'Q1", 'Totals']);
  const merged = await open(await mergeExcelFiles([first, second]));
  assert.deepEqual(merged.worksheets.map(sheet => sheet.name), ["Dữ liệu 'Q1", "Dữ liệu 'Q1 (2)", 'Totals']);
  const data = merged.worksheets[1];
  assert.equal(data.getCell('A1').value, 42);
  assert.equal(data.getCell('A1').numFmt, '0.00');
  assert.equal(data.getCell('A1').font.bold, true);
  assert.equal(data.getCell('D3').master.address, 'C2');
  assert.equal(data.getColumn(1).width, 26);
  assert.equal(data.getRow(1).height, 40);
  assert.equal(merged.worksheets[2].getCell('A1').formula, `"Dữ liệu 'Q1!"&'Dữ liệu ''Q1 (2)'!A1`);
  assert.deepEqual(merged.worksheets[2].getCell('B1').dataValidation.formulae, ["'Dữ liệu ''Q1 (2)'!A1>0"]);
});

test('XLSX split produces requested order, retains dependencies in group, rejects a missing dependency', async () => {
  const input = await makeFile('original.xlsx', book => {
    book.addWorksheet('Inputs').getCell('A1').value = 17;
    book.addWorksheet('Summary').getCell('A1').value = { formula: 'Inputs!A1', result: 17 };
    book.addWorksheet('Final').getCell('A1').value = 'Only in Final';
  });
  const [group, solo] = await splitExcelFile(input, [[1, 0], [2]]);
  const workbook = await open(group);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Summary', 'Inputs']);
  assert.equal(workbook.worksheets[0].getCell('A1').formula, 'Inputs!A1');
  assert.equal((await open(solo)).worksheets[0].name, 'Final');
  const zip = await JSZip.loadAsync(group);
  assert.doesNotMatch(await zip.file('xl/sharedStrings.xml')?.async('string') ?? '', /Only in Final/);
  await assert.rejects(splitExcelFile(input, [[1]]), /ngoài nhóm/);
  await assert.rejects(splitExcelFile(input, [[5]]), /phạm vi/);
});

test('XLSX operations reject unsupported advanced parts and keep original input intact', async () => {
  const file = await makeFile('chart.xlsx', book => { book.addWorksheet('Report'); });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  zip.file('xl/_rels/workbook.xml.rels', (await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).replace('</Relationships>', '<Relationship Id="piv" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition" Target="piv.xml"/></Relationships>'));
  const chart = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'chart.xlsx');
  await assert.rejects(splitExcelFile(chart, [[0]]), /bảo toàn/);
});

test('XLSX merge keeps each image and Excel table attached to its own sheet', async () => {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
  const files = await Promise.all(['One', 'Two'].map(name => makeFile(`${name}.xlsx`, book => {
    const sheet = book.addWorksheet(name);
    const image = book.addImage({ buffer: pixel, extension: 'png' });
    sheet.addImage(image, 'C3:D4');
    sheet.addTable({ name: 'Table' + name, ref: 'A1', headerRow: true, columns: [{ name: 'Amount' }], rows: [[5]] });
  })));
  const merged = await open(await mergeExcelFiles(files));
  for (const sheet of merged.worksheets) {
    assert.ok(sheet.getTable('Table' + sheet.name));
    assert.equal(sheet.getCell('A2').value, 5);
    const [image] = sheet.getImages();
    assert.ok(image);
    assert.deepEqual(Buffer.from(merged.getImage(Number(image.imageId)).buffer!), pixel);
  }
});

test('XLSX split copies unmodified worksheet XML and image bytes verbatim', async () => {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
  const book = await makeFile('input.xlsx', wb => {
    const sheet = wb.addWorksheet('Selected');
    sheet.getCell('B4').value = { richText: [{ font: { italic: true }, text: 'One' }, { font: { color: { argb: 'FFFF0000' } }, text: 'Two' }] };
    sheet.addImage(wb.addImage({ buffer: pixel, extension: 'png' }), 'E3:F9');
    sheet.pageSetup.orientation = 'landscape';
    wb.addWorksheet('Other').getCell('A2').value = 'Omitted';
  });
  const original = await JSZip.loadAsync(await book.arrayBuffer());
  const [output] = await splitExcelFile(book, [[0]]);
  const selected = await JSZip.loadAsync(output);
  for (const path of ['xl/worksheets/sheet1.xml','xl/drawings/drawing1.xml','xl/media/image1.png']) {
    assert.deepEqual(await selected.file(path)!.async('uint8array'), await original.file(path)!.async('uint8array'));
  }
  assert.doesNotMatch(await selected.file('xl/sharedStrings.xml')!.async('string'), /Omitted/);
});

test('XLSX refuses incompatible workbook themes before generating output', async () => {
  const file = await makeFile('theme.xlsx', wb => { wb.addWorksheet('Report'); });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const path = 'xl/theme/theme1.xml';
  zip.file(path,(await zip.file(path)!.async('string')).replace(/<a:accent1>[\s\S]*?<\/a:accent1>/, '<a:accent1><a:srgbClr val="901030"/></a:accent1>'));
  await assert.rejects(mergeExcelFiles([file, new File([await zip.generateAsync({type:'arraybuffer'})],'other.xlsx')]), /không tương thích/);
});
