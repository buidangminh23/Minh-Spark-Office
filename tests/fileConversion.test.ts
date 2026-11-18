import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { conversionTargets, conversionZip, convertFile, uniqueConversionNames } from '../src/lib/fileConversion.ts';
import { conversionPlan, supportsOfficeLayout } from '../src/lib/officeLayoutRoutes.ts';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as XLSX from 'xlsx';
import { checkLegacySheetSize } from '../src/lib/officeNativeFormats.ts';
import { CONVERSION_ACCEPT } from '../src/lib/conversionRegistry.ts';
import { mediaConversionTargets } from '../src/lib/mediaConversionFormats.ts';
import { officeConversionTargets } from '../src/lib/officeConversionFormats.ts';

Object.assign(globalThis, { DOMParser, XMLSerializer });

test('every catalog route reaches the selected output through a supported engine path', () => {
  const native = ['pdf', 'docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp'];
  for (const suffix of CONVERSION_ACCEPT.split(',')) {
    const fileName = 'source' + suffix;
    const formats = conversionTargets(fileName).map(format => format.id);
    assert.equal(new Set(formats).size, formats.length);
    for (const format of formats) for (const fidelity of ['layout', 'editable'] as const) {
      const plan = conversionPlan(fileName, format, fidelity);
      assert.equal(plan.at(-1)?.target, format, fileName + ' to ' + format);
      let inputName = fileName;
      for (const step of plan) {
        if (step.via === 'native') assert.ok(native.includes(step.target));
        if (step.via === 'media') assert.ok(mediaConversionTargets(inputName).some(item => item.id === step.target), inputName + ' to ' + step.target);
        if (step.via === 'office') assert.ok(officeConversionTargets(inputName).some(item => item.id === step.target), inputName + ' to ' + step.target);
        inputName = 'stage.' + step.target;
      }
    }
  }
  assert.deepEqual(conversionPlan('slides.odp', 'xlsx'), [{ via: 'native', target: 'pdf' }, { via: 'media', target: 'xlsx' }]);
  assert.deepEqual(conversionPlan('slides.odp', 'xlsx', 'editable'), [{ via: 'native', target: 'pptx' }, { via: 'office', target: 'xlsx' }]);
});

test('macro templates retain the VBA project and other embedded parts', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document/>');
  zip.file('word/vbaProject.bin', new Uint8Array([42, 5, 0, 11]));
  zip.file('word/media/image1.png', new Uint8Array([1, 2, 3]));
  const source = new File([await zip.generateAsync({ type: 'uint8array' })], 'source.docm');
  const result = await convertFile(source, 'dotm');
  const archive = await JSZip.loadAsync(await result.files[0].blob.arrayBuffer());
  assert.match(await archive.file('[Content_Types].xml')!.async('string'), /template\.macroEnabled\.main\+xml/);
  assert.deepEqual(await archive.file('word/vbaProject.bin')!.async('uint8array'), new Uint8Array([42, 5, 0, 11]));
  assert.deepEqual(await archive.file('word/media/image1.png')!.async('uint8array'), new Uint8Array([1, 2, 3]));
  assert.deepEqual(result.warnings, []);
});

test('Excel 97-2003 export rejects content outside its worksheet grid', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, { IW4: { t: 's', v: 'last' }, '!ref': 'A1:IW4' }, 'Limit');
  const input = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'large.xlsx');
  await assert.rejects(checkLegacySheetSize(input), /65.536/);
});

test('print layout uses the bundled renderer and preserves PDF bytes without reflow', async () => {
  const archive = new JSZip();
  archive.file('word/document.xml', '<w:document/>');
  const source = new File([await archive.generateAsync({ type: 'uint8array' })], 'Mẫu.docx');
  const pdf = new Blob(['%PDF-1.7\nlayout'], { type: 'application/pdf' });
  let calls = 0;
  const layoutSession = { close: () => assert.fail('the caller owns the batch session'), render: async (file: File) => {
    assert.equal(file, source);
    calls++;
    return pdf;
  } };
  const result = await convertFile(source, 'pdf', { layoutSession });
  assert.equal(calls, 1);
  assert.equal(result.files[0].name, 'Mẫu.pdf');
  assert.equal(result.files[0].blob, pdf);
  for (const ext of ['xlsm', 'PPTX', 'ods', 'dotx']) assert.ok(supportsOfficeLayout('sample.' + ext, 'png'));
  for (const ext of ['csv', 'txt', 'png', 'pdf']) assert.equal(supportsOfficeLayout('sample.' + ext, 'pdf'), false);
  assert.equal(supportsOfficeLayout('sample.pptx', 'pptx'), false);
  assert.equal(supportsOfficeLayout('sample.xlsx', 'docx'), true);
});

test('conversion matrix offers current and legacy formats and rejects unknown files', () => {
  for (const source of ['sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.pdf', 'sample.png', 'sample.doc', 'sample.ppt']) {
    assert.ok(conversionTargets(source).some((target) => target.id === 'pdf'), source);
  }
  for (const source of ['sample.exe', 'sample.zip']) assert.deepEqual(conversionTargets(source), []);
  assert.ok(conversionTargets('SCAN.PDF').some((target) => target.id === 'docx'));
});

test('conversion rejects invalid source and unsupported pair before loading engines', async () => {
  await assert.rejects(convertFile(new File([], 'empty.docx'), 'pdf'), /trống/);
  await assert.rejects(convertFile(new File(['test'], 'sample.exe'), 'pdf'), /chưa được hỗ trợ/);
  await assert.rejects(convertFile(new File(['not a zip'], 'broken.docx'), 'pdf'), /Tệp Office bị hỏng/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(convertFile(new File(['test'], 'test.txt'), 'docx', { signal: controller.signal }), { name: 'AbortError' });
});

test('batch archive keeps every output when basenames collide and sanitizes paths', async () => {
  const files = ['report.txt', 'REPORT.txt', 'report (2).txt', '../report.txt'].map((name, index) => ({ name, blob: new Blob([String(index)]) }));
  const renamed = uniqueConversionNames(files);
  assert.equal(new Set(renamed.map((file) => file.name.toLowerCase())).size, 4);
  assert.ok(renamed.every((file) => !file.name.includes('/') && !file.name.startsWith('.')));
  const zip = await JSZip.loadAsync(await (await conversionZip(files)).arrayBuffer());
  assert.equal(Object.keys(zip.files).length, 4);
  assert.deepEqual(await Promise.all(Object.values(zip.files).map((file) => file.async('string'))), ['0', '1', '2', '3']);
});
