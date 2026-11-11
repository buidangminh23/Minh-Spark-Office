import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importTargetOf, isOleContainer } from '../src/lib/importTarget';
import { pdfDataUrlToBytes } from '../src/editors/pdf/pdfBytes';

test('importTargetOf maps every supported extension to its editor', () => {
  const cases: [string, string, string][] = [
    ['Báo cáo.DOCX', 'word', 'doc'],
    ['cũ.doc', 'word', 'doc'],
    ['ghi chú.md', 'text', 'doc'],
    ['trang.html', 'text', 'doc'],
    ['sổ quỹ.xlsx', 'spreadsheet', 'sheet'],
    ['macro.xlsm', 'spreadsheet', 'sheet'],
    ['dữ liệu.csv', 'spreadsheet', 'sheet'],
    ['hợp đồng.PDF', 'pdf', 'pdf'],
    ['trình chiếu.pptx', 'presentation', 'slide'],
    ['ảnh.heic', 'image', 'image'],
    ['logo.svg', 'image', 'image'],
  ];
  for (const [name, format, editor] of cases) assert.deepEqual(importTargetOf(name), { format, editor }, name);
});

test('importTargetOf rejects unsupported files and extension look-alikes', () => {
  for (const name of ['archive.zip', 'video.mp4', 'no-extension', 'report.pdf.exe', 'notes.docx.bak']) assert.equal(importTargetOf(name), null, name);
});

test('isOleContainer matches only the compound-file signature', () => {
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
  assert.equal(isOleContainer(ole), true);
  assert.equal(isOleContainer(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0])), false);
  assert.equal(isOleContainer(ole.subarray(0, 8)), false);
  assert.equal(isOleContainer(new Uint8Array(0)), false);
});

test('pdfDataUrlToBytes decodes the same bytes with and without native base64', () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, index) => (index * 37) % 256);
  const dataUrl = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
  const holder = Uint8Array as unknown as { fromBase64?: unknown };
  const native = holder.fromBase64;
  try {
    assert.deepEqual(Buffer.from(pdfDataUrlToBytes(dataUrl)), Buffer.from(bytes));
    holder.fromBase64 = undefined;
    assert.deepEqual(Buffer.from(pdfDataUrlToBytes(dataUrl)), Buffer.from(bytes));
    holder.fromBase64 = () => { throw new SyntaxError('rejected'); };
    assert.deepEqual(Buffer.from(pdfDataUrlToBytes(dataUrl)), Buffer.from(bytes));
  } finally {
    holder.fromBase64 = native;
  }
});
