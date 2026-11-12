import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import JSZip from 'jszip';
import { mergeWordFiles, splitWordFile, wordPartLabels } from '../src/lib/wordFileParts';

Object.assign(globalThis, { DOMParser, XMLSerializer });

async function documentFile(name: string) {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5sAAAAASUVORK5CYII=', 'base64');
  const document = new Document({ sections: [{
    footers: { default: new Footer({ children: [new Paragraph(name + ' footer')] }) },
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: name }),
      new Paragraph({ children: [
        new TextRun({ text: 'Bold', bold: true }),
        new ExternalHyperlink({ link: 'https://example.org/' + name, children: [new TextRun(' link')] }),
        new ImageRun({ data: image, type: 'png', transformation: { width: 20, height: 20 } }),
      ] }),
      new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('Cell')] })] })] }),
    ],
  }] });
  return new File([await Packer.toBuffer(document)], name + '.docx');
}

test('DOCX split retains selected paragraphs and whole tables in requested order', async () => {
  const source = await documentFile('First');
  assert.deepEqual(await wordPartLabels(source), ['First', 'Bold link', 'Bảng · Cell']);
  const [a, b] = await splitWordFile(source, [[2, 0], [1]]);
  assert.deepEqual(await wordPartLabels(new File([a], 'a.docx')), ['Bảng · Cell', 'First']);
  assert.deepEqual(await wordPartLabels(new File([b], 'b.docx')), ['Bold link']);
  const zip = await JSZip.loadAsync(b);
  const withoutImage = await JSZip.loadAsync(a);
  assert.ok(!Object.keys(withoutImage.files).some(path => path.endsWith('.png')));
  assert.ok(Object.keys(zip.files).some(path => path.endsWith('.png')));
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /<w:b\b/);
  assert.match(xml, /<w:drawing\b/);
  assert.match(xml, /footerReference/);
  await assert.rejects(splitWordFile(source, [[3]]), /Phạm vi/);
});

test('DOCX merge retains sections, tables, distinct styles, images and external links', async () => {
  const a = await documentFile('First');
  const b = await documentFile('Second');
  const bytes = await mergeWordFiles([a, b]);
  const file = new File([bytes], 'result.docx');
  const labels = await wordPartLabels(file);
  assert.ok(labels.indexOf('First') < labels.indexOf('Second'));
  assert.equal(labels.filter(label => label === 'Bảng · Cell').length, 2);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')!.async('string');
  const rels = new DOMParser().parseFromString(await zip.file('word/_rels/document.xml.rels')!.async('string'), 'text/xml');
  const entries = Array.from(rels.getElementsByTagName('Relationship'));
  const ids = entries.map(el => el.getAttribute('Id'));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((xml.match(/<w:drawing\b/g) || []).length, 2);
  assert.equal((xml.match(/<w:footerReference\b/g) || []).length, 2);
  assert.equal((xml.match(/w:pStyle w:val="Heading1"/g) || []).length, 2);
  assert.match(await zip.file('word/styles.xml')!.async('string'), /w:styleId="Heading1"/);
  for (const rel of entries) {
    const target = rel.getAttribute('Target')!;
    if (rel.getAttribute('TargetMode') === 'External') continue;
    const path = new URL(target, 'https://pkg.local/word/document.xml').pathname.slice(1);
    assert.ok(zip.file(path), path);
  }
  assert.ok(entries.some(el => el.getAttribute('Target') === 'https://example.org/Second'));
  assert.deepEqual(await wordPartLabels(a), ['First', 'Bold link', 'Bảng · Cell']);
});

async function changePart(file: File, path: string, fn: (xml: string) => string) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file(path)!.async('string');
  const updated = fn(xml);
  assert.notEqual(updated, xml);
  zip.file(path, updated);
  return new File([await zip.generateAsync({ type: 'uint8array' })], file.name);
}

test('DOCX preserves different named styles and rejects incompatible document-wide settings and defaults', async () => {
  const a = await documentFile('First');
  const b = await documentFile('Second');
  const styled = await changePart(b, 'word/styles.xml', xml => xml.replace(/(<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<w:rPr>)/, '$1<w:color w:val="EE1731"/>'));
  const result = await JSZip.loadAsync(await mergeWordFiles([a, styled]));
  assert.match(await result.file('word/document.xml')!.async('string'), /w:pStyle w:val="M2_Heading1"/);
  assert.match(await result.file('word/styles.xml')!.async('string'), /w:styleId="M2_Heading1"[\s\S]*?EE1731/);
  const settings = await changePart(b, 'word/settings.xml', xml => xml.replace('defaultTabStop w:val="720"', 'defaultTabStop w:val="360"'));
  await assert.rejects(mergeWordFiles([a, settings]), /thiết lập toàn tài liệu/);
  const defaults = await changePart(b, 'word/styles.xml', xml => xml.replace('<w:rPrDefault/>', '<w:rPrDefault><w:rPr><w:color w:val="EE1731"/></w:rPr></w:rPrDefault>'));
  await assert.rejects(mergeWordFiles([a, defaults]), /kiểu mặc định/);
});

test('DOCX split uses the correct section and realizes inherited header and footer links', async () => {
  const document = new Document({ sections: [
    { headers: { default: new Header({ children: [new Paragraph('Original header')] }) },
      footers: { default: new Footer({ children: [new Paragraph('Original footer')] }) },
      properties: { page: { margin: { left: 322 } } }, children: [new Paragraph('First section')] },
    { properties: { page: { margin: { left: 777 } } }, children: [new Paragraph('Second section')] },
  ] });
  const source = new File([await Packer.toBuffer(document)], 'sections.docx');
  const labels = await wordPartLabels(source);
  const groups = ['First section', 'Second section'].map(label => [labels.indexOf(label)]);
  const outputs = await splitWordFile(source, groups);
  for (const [i, output] of outputs.entries()) {
    const zip = await JSZip.loadAsync(output);
    const body = await zip.file('word/document.xml')!.async('string');
    assert.equal((body.match(/<w:sectPr>/g) || []).length, 1);
    assert.match(body, new RegExp('w:left="' + [322, 777][i] + '"'));
    assert.match(body, /w:headerReference/);
    assert.match(body, /w:footerReference/);
    assert.match(await zip.file('word/header1.xml')!.async('string'), /Original header/);
    assert.match(await zip.file('word/footer1.xml')!.async('string'), /Original footer/);
  }
});

test('DOCX merge separates numbering inherited from a shared paragraph style and resets a missing footer', async () => {
  const a = await documentFile('First');
  const raw = new Document({ sections: [{ children: [new Paragraph({ text: 'Second', heading: HeadingLevel.HEADING_1 })] }] });
  const b = new File([await Packer.toBuffer(raw)], 'b.docx');
  const setNumbers = (file: File) => changePart(file, 'word/styles.xml', xml =>
    xml.replace(/(<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?)<w:rPr>/, '$1<w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:rPr>'));
  const files = await Promise.all([setNumbers(a), setNumbers(b)]);
  const zip = await JSZip.loadAsync(await mergeWordFiles(files));
  const xml = await zip.file('word/document.xml')!.async('string');
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  const p = Array.from(dom.getElementsByTagName('w:p')).find(el => el.textContent === 'Second')!;
  const id = p.getElementsByTagName('w:numId')[0].getAttribute('w:val');
  assert.ok(id && id !== '1');
  assert.match(await zip.file('word/numbering.xml')!.async('string'), new RegExp('w:numId="' + id + '"'));
  assert.match(xml, /ms_blank_footer/);
  const mergedSections = Array.from(dom.getElementsByTagName('w:sectPr'));
  assert.equal(mergedSections.length, 2);
  assert.match(mergedSections[1].getElementsByTagName('w:footerReference')[0].getAttribute('r:id')!, /ms_blank_footer/);
});
