import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { includeDocxConversionRegions } from '../src/lib/docxConversionRegions.ts';
import { conversionNodeText } from '../src/lib/officeConversionDocument.ts';

Object.assign(globalThis, { DOMParser });

test('Word conversion includes referenced headers and footers once with visible text and line breaks', async () => {
  const zip = new JSZip();
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const section = '<w:sectPr><w:headerReference r:id="same"/><w:headerReference r:id="first"/><w:footerReference r:id="foot"/></w:sectPr>';
  zip.file('word/document.xml', `<w:document xmlns:w="${ns}" xmlns:r="${rel}"><w:body><w:p><w:pPr>${section}</w:pPr></w:p><w:sectPr><w:headerReference r:id="alias"/><w:headerReference r:id="ext"/><w:sectPrChange><w:sectPr><w:headerReference r:id="old"/></w:sectPr></w:sectPrChange><w:footerReference r:id="foot"/></w:sectPr></w:body></w:document>`);
  const rels = [['same','header','header1.xml'],['alias','header','./header1.xml'],['first','header','/word/headerFirst.xml'],['old','header','old.xml'],['foot','footer','footer1.xml']];
  zip.file('word/_rels/document.xml.rels', `<Relationships>${rels.map(([id, kind, path]) => `<Relationship Id="${id}" Type="${rel}/${kind}" Target="${path}"/>`).join('')}<Relationship Id="ext" Type="${rel}/header" Target="old.xml" TargetMode="External"/></Relationships>`);
  zip.file('word/header1.xml', `<w:hdr xmlns:w="${ns}"><w:p><w:r><w:t>Title</w:t><w:tab/><w:t>A</w:t><w:br/><w:t>B</w:t></w:r><w:del><w:r><w:t>deleted</w:t></w:r></w:del></w:p></w:hdr>`);
  zip.file('word/headerFirst.xml', `<w:hdr xmlns:w="${ns}"><w:p><w:r><w:t>First page</w:t></w:r></w:p></w:hdr>`);
  zip.file('word/old.xml', `<w:hdr xmlns:w="${ns}"><w:p><w:r><w:t>Old</w:t></w:r></w:p></w:hdr>`);
  zip.file('word/footer1.xml', `<w:ftr xmlns:w="${ns}"><w:p><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:t>Footer 1</w:t></w:r></w:p></w:ftr>`);
  const merged = await includeDocxConversionRegions(zip, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }] });
  assert.equal(conversionNodeText(merged), 'Title\tA\nB\nFirst page\nBody\nFooter 1');
});
