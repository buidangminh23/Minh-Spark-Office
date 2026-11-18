import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import * as CFB from 'cfb';
import * as XLSX from 'xlsx';
import { createLegacyTemplate, hasWorkbookTemplateRecord } from '../src/lib/legacyOfficeTemplates.ts';
import { checkNativeFile, nativeOutputMime } from '../src/lib/officeNativeFormats.ts';

Object.assign(globalThis, { DOMParser });

test('XLT marks the workbook as a template and retains BIFF worksheet locations', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['First', 123]]), 'A');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Second', 456]]), 'B');
  const source = Uint8Array.from(XLSX.write(book, { type: 'buffer', bookType: 'biff8' }));
  const converted = await createLegacyTemplate(source, 'xlt');
  await checkNativeFile(converted.buffer, 'xlt');
  const stream = CFB.find(CFB.read(converted, { type: 'array' }), '/Workbook')!;
  assert.equal(hasWorkbookTemplateRecord(Uint8Array.from(stream.content)), true);
  const saved = XLSX.read(converted, { type: 'array' });
  assert.deepEqual(saved.SheetNames, ['A', 'B']);
  assert.equal(saved.Sheets.A.B1.v, 123);
  assert.equal(saved.Sheets.B.A1.v, 'Second');
  assert.equal(saved.Sheets.B.B1.v, 456);
  await assert.rejects(checkNativeFile(source.buffer, 'xlt'));
});

test('DOT sets the FIB template flag and preserves the other compound document streams', async () => {
  const archive = CFB.utils.cfb_new();
  const main = new Uint8Array(64);
  main.set([0xec, 0xa5, 0xc1, 0]);
  main[10] = 0xf8;
  CFB.utils.cfb_add(archive, '/WordDocument', main);
  CFB.utils.cfb_add(archive, '/1Table', new Uint8Array([5, 6, 7]));
  const original = Uint8Array.from(CFB.write(archive, { type: 'array' }));
  const converted = await createLegacyTemplate(original, 'dot');
  await checkNativeFile(converted.buffer, 'dot');
  const output = CFB.read(converted, { type: 'array' });
  assert.equal(CFB.find(output, '/WordDocument')?.content[10], 0xf9);
  assert.deepEqual(Array.from(CFB.find(output, '/1Table')!.content), [5, 6, 7]);
  await assert.rejects(checkNativeFile(original.buffer, 'dot'));
});

test('flat OpenDocument validates the MIME and body against each document family', async () => {
  for (const [format, family] of [['fodt', 'text'], ['fods', 'spreadsheet'], ['fodp', 'presentation']]) {
    const xml = `<o:document xmlns:o="urn:oasis:names:tc:opendocument:xmlns:office:1.0" o:mimetype="application/vnd.oasis.opendocument.${family}"><o:body><o:${family}/></o:body></o:document>`;
    const bytes = new TextEncoder().encode(xml).buffer;
    await checkNativeFile(bytes, format);
    assert.equal(nativeOutputMime(format), 'application/vnd.oasis.opendocument.' + family + '-flat-xml');
    await assert.rejects(checkNativeFile(bytes, format === 'fodp' ? 'fodt' : 'fodp'));
  }
});
