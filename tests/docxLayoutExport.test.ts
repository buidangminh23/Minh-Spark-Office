import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { exportDocx } from '../src/lib/docxConvert';

const page = { size: 'A4', orientation: 'portrait', margins: { top: 96, right: 96, bottom: 96, left: 96 } };
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const cell = (text: string, attrs: object = {}) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [para(text)] });

const unzip = async (doc: object) => {
  const zip = await JSZip.loadAsync(await (await exportDocx(doc as never, page as never, 'Test')).arrayBuffer());
  return { document: await zip.file('word/document.xml')!.async('string'), numbering: await zip.file('word/numbering.xml')!.async('string') };
};

test('table layout attributes reach the DOCX', async () => {
  const { document } = await unzip({
    type: 'doc',
    content: [{
      type: 'table',
      attrs: { tableAlign: 'center', cellPadding: 10, tableWidth: 60 },
      content: [
        { type: 'tableRow', attrs: { repeatHeader: true, rowHeight: 40 }, content: [cell('Tên'), cell('Số')] },
        { type: 'tableRow', content: [cell('A', { textDirection: 'vertical-rl' }), cell('1')] },
      ],
    }],
  });
  assert.match(document, /<w:tblHeader\/>/);
  assert.match(document, /<w:trHeight w:val="600" w:hRule="atLeast"\/>/);
  assert.match(document, /<w:textDirection w:val="tbRl"\/>/);
  assert.match(document, /<w:jc w:val="center"\/>/);
  assert.match(document, /<w:tblW w:type="pct" w:w="3000"\/>/);
});

test('legal multilevel list numbers nested levels as 1.1.', async () => {
  const { document, numbering } = await unzip({
    type: 'doc',
    content: [{
      type: 'orderedList',
      attrs: { listStyle: 'multi-legal' },
      content: [{ type: 'listItem', content: [para('Chương'), { type: 'orderedList', content: [{ type: 'listItem', content: [para('Mục')] }] }] }],
    }],
  });
  assert.match(numbering, /w:lvlText w:val="%1\.%2\."/);
  const ids = [...document.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.match(document, /<w:ilvl w:val="1"\/>/);
});
