import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { alignBlocks, matchNodes, mergeDocument, stampDocBlocks, xmlText, type DocNode } from '../src/lib/docxPreserve';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const paragraph = (value: string, extra = '') => `<w:p>${extra}<w:r><w:t>${value}</w:t></w:r></w:p>`;
const node = (value: string): DocNode => ({ type: 'paragraph', content: value ? [{ type: 'text', text: value }] : [] });
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
const TYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>';

async function docx(body: string, options: { styles?: string; numbering?: string; rels?: string } = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', TYPES);
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`);
  zip.file('word/_rels/document.xml.rels', `${RELS}${options.rels ?? ''}</Relationships>`);
  zip.file('word/styles.xml', `<w:styles ${W}>${options.styles ?? ''}</w:styles>`);
  if (options.numbering) zip.file('word/numbering.xml', `<w:numbering ${W}>${options.numbering}</w:numbering>`);
  return zip.generateAsync({ type: 'uint8array' });
}

test('xmlText reads body text and ignores floating text boxes and field codes', () => {
  assert.equal(xmlText('<w:p><w:r><w:t xml:space="preserve">A &amp; b </w:t></w:r><w:r><w:instrText>TOC</w:instrText></w:r><w:txbxContent><w:p><w:r><w:t>box</w:t></w:r></w:p></w:txbxContent></w:p>'), 'A&b');
});

test('alignBlocks pairs nodes with body blocks through empties, skipped blocks and wrapped groups', () => {
  const children = [
    { name: 'w:p', xml: paragraph('') },
    { name: 'w:p', xml: paragraph('One') },
    { name: 'w:p', xml: '<w:p><w:r><w:drawing/></w:r><w:txbxContent><w:p><w:r><w:t>float</w:t></w:r></w:p></w:txbxContent></w:p>' },
    { name: 'w:sdt', xml: `<w:sdt><w:sdtContent>${paragraph('Two')}${paragraph('Three')}</w:sdtContent></w:sdt>` },
    { name: 'w:p', xml: paragraph('Four') },
  ];
  assert.deepEqual(alignBlocks([node('One'), node('Two'), node('Three'), node('Four')], children), [
    { from: 0, count: 2, nodes: 1 }, { from: 2, count: 2, nodes: 2 }, { from: 4, count: 1, nodes: 1 },
  ]);
  assert.equal(alignBlocks([node('One'), node('Missing')], children), null);
});

test('matchNodes follows order and does not jump far on empty blocks', () => {
  assert.deepEqual(matchNodes(['a', 'b', 'c'], ['a', 'x', 'c'], [false, false, false]), [0, -1, 2]);
  assert.deepEqual(matchNodes(['e', 'a', 'b', 'c', 'd', 'x', 'e'], ['a', 'e'], [false, true]), [1, -1]);
});

test('mergeDocument keeps untouched blocks verbatim and adopts styles, numbering and links of edited ones', async () => {
  const control = `<w:sdt><w:sdtPr><w:alias w:val="Name"/></w:sdtPr><w:sdtContent>${paragraph('Field')}</w:sdtContent></w:sdt>`;
  const bookmarked = paragraph('Keep me', '<w:bookmarkStart w:id="1" w:name="mark"/><w:bookmarkEnd w:id="1"/>');
  const original = await docx(`${bookmarked}${paragraph('Change me')}${control}`, { rels: '<Relationship Id="rId1" Type="x/styles" Target="styles.xml"/>' });
  const nodes = [node('Keep me'), node('Change me'), node('Field')];
  const blocks = await stampDocBlocks(original, nodes);
  assert.ok(blocks);
  const edited = '<w:p><w:pPr><w:pStyle w:val="Fresh"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:hyperlink r:id="rId1"><w:r><w:t>Changed</w:t></w:r></w:hyperlink></w:p>';
  const generated = await docx(`${paragraph('Keep me')}${edited}${paragraph('Field')}${paragraph('Added')}`, {
    styles: '<w:style w:type="paragraph" w:styleId="Fresh"><w:name w:val="Fresh"/><w:basedOn w:val="Base"/></w:style><w:style w:type="paragraph" w:styleId="Base"><w:name w:val="Base"/></w:style>',
    numbering: '<w:abstractNum w:abstractNumId="0"><w:nsid w:val="AA"/><w:lvl w:ilvl="0"/></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>',
    rels: '<Relationship Id="rId1" Type="x/hyperlink" Target="https://example.com" TargetMode="External"/>',
  });
  const current = [node('Keep me'), node('Changed'), node('Field'), node('Added')];
  const zip = await JSZip.loadAsync(await mergeDocument(original, generated, blocks, current));
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.ok(xml.includes(bookmarked), 'bookmarked paragraph is untouched');
  assert.ok(xml.includes(control), 'content control is untouched');
  assert.doesNotMatch(xml, /Change me/);
  assert.match(xml, /Changed[\s\S]*Field[\s\S]*Added[\s\S]*<w:sectPr>/);
  const link = /<w:hyperlink r:id="([^"]+)"/.exec(xml)?.[1];
  assert.ok(link && link !== 'rId1');
  const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
  assert.match(rels, new RegExp(`Id="${link}"[^>]*Target="https://example.com"[^>]*TargetMode="External"`));
  assert.match(rels, /Id="rId1" Type="x\/styles"/);
  const styles = await zip.file('word/styles.xml')!.async('string');
  assert.match(styles, /w:styleId="Fresh"/);
  assert.match(styles, /w:styleId="Base"/);
  assert.match(await zip.file('word/numbering.xml')!.async('string'), /<w:num w:numId="1">/);
  assert.match(await zip.file('[Content_Types].xml')!.async('string'), /numbering\+xml/);
});

test('mergeDocument renumbers adopted lists when the original already has numbering', async () => {
  const numbering = '<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"/></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="4"/></w:num>';
  const original = await docx(paragraph('Old'), { numbering });
  const blocks = await stampDocBlocks(original, [node('Old')]);
  const listed = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Item</w:t></w:r></w:p>';
  const generated = await docx(`${paragraph('Old')}${listed}`, { numbering: '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"/></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' });
  const zip = await JSZip.loadAsync(await mergeDocument(original, generated, blocks!, [node('Old'), node('Item')]));
  assert.match(await zip.file('word/document.xml')!.async('string'), /<w:numId w:val="8"\/>/);
  const merged = await zip.file('word/numbering.xml')!.async('string');
  assert.match(merged, /<w:abstractNum w:abstractNumId="5">[\s\S]*<w:num w:numId="7">[\s\S]*<w:num w:numId="8"><w:abstractNumId w:val="5"\/>/);
});
