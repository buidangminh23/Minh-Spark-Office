import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { mergePages, partFileName, splitParts, zipParts } from '../src/lib/fileParts';

async function pdfFile(name: string, widths: number[]) {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 400]);
  return new File([new Uint8Array(await doc.save())], name, { type: 'application/pdf' });
}

async function pageWidths(blob: Blob) {
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  return doc.getPages().map((page) => Math.round(page.getWidth()));
}

test('mergePages joins single pages from several PDFs in the chosen order', async () => {
  const first = await pdfFile('a.pdf', [101, 102, 103]);
  const second = await pdfFile('b.pdf', [201, 202]);
  const merged = await mergePages([
    { file: second, index: 1 },
    { file: first, index: 0 },
    { file: first, index: 2 },
    { file: second, index: 0 },
  ]);
  assert.deepEqual(await pageWidths(merged), [202, 101, 103, 201]);
});

test('mergePages keeps one picked page as its own document', async () => {
  const first = await pdfFile('a.pdf', [101, 102]);
  assert.deepEqual(await pageWidths(await mergePages([{ file: first, index: 1 }])), [102]);
});

test('mergePages refuses an empty selection and mixed formats', async () => {
  await assert.rejects(mergePages([]), /ít nhất một trang/);
  const pdf = await pdfFile('a.pdf', [101]);
  const docx = new File([new Uint8Array([1])], 'b.docx');
  await assert.rejects(mergePages([{ file: pdf, index: 0 }, { file: docx, index: 0 }]), /cùng định dạng/);
});

test('splitParts returns one document per group, pages need not be contiguous', async () => {
  const source = await pdfFile('source.pdf', [101, 102, 103, 104, 105, 106]);
  const parts = await splitParts(source, [[0, 2, 4], [1, 3], [5]]);
  assert.equal(parts.length, 3);
  assert.deepEqual(await pageWidths(parts[0]), [101, 103, 105]);
  assert.deepEqual(await pageWidths(parts[1]), [102, 104]);
  assert.deepEqual(await pageWidths(parts[2]), [106]);
  await assert.rejects(splitParts(source, [[0], []]), /ít nhất một trang/);
});

test('partFileName keeps one extension and strips characters Windows forbids', () => {
  assert.equal(partFileName('Hợp đồng', 'pdf'), 'Hợp đồng.pdf');
  assert.equal(partFileName('Hop-dong.PDF', 'pdf'), 'Hop-dong.pdf');
  assert.equal(partFileName('a/b:c*?', 'pdf'), 'a_b_c_.pdf');
  assert.equal(partFileName('   ', 'zip'), 'tep.zip');
});

test('zipParts names the archive and keeps files with the same name apart', async () => {
  const blob = new Blob(['x']);
  const result = await zipParts([{ blob, name: 'Phu-luc.pdf' }, { blob, name: 'phu-luc.pdf' }, { blob, name: 'Hop-dong.pdf' }], 'Ho so/da tach');
  assert.equal(result.name, 'Ho so_da tach.zip');
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files).sort(), ['Hop-dong.pdf', 'Phu-luc.pdf', 'phu-luc (2).pdf']);
});
