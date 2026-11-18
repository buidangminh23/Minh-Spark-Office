import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { conversionTargets, conversionZip, convertFile, uniqueConversionNames } from '../src/lib/fileConversion.ts';
import { supportsOfficeLayout } from '../src/lib/officeLayoutRoutes.ts';

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

test('conversion matrix exposes real routes for every product and rejects legacy unknown files', () => {
  for (const source of ['sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.pdf', 'sample.png']) {
    assert.ok(conversionTargets(source).some((target) => target.id === 'pdf'), source);
  }
  for (const source of ['sample.doc', 'sample.ppt', 'sample.exe', 'sample.zip']) assert.deepEqual(conversionTargets(source), []);
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
