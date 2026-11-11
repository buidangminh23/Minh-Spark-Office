import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { conversionTargets, conversionZip, convertFile, uniqueConversionNames } from '../src/lib/fileConversion.ts';

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
