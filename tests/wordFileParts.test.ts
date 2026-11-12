import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, Packer, Paragraph, SimpleField, Table, TableCell, TableRow, TextRun } from 'docx';
import JSZip from 'jszip';
import { mergeWordFiles, splitWordFile, splitWordPages, wordPageLabels, wordPartLabels } from '../src/lib/wordFileParts';

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

async function pagedFile() {
  const header = (name: string) => new Header({ children: [new Paragraph(name)] });
  const footer = (name: string) => new Footer({ children: [new Paragraph({ children: [
    new TextRun(name), new SimpleField('PAGE'), new TextRun('/'), new SimpleField('NUMPAGES'),
  ] })] });
  const paragraphs = Array.from({ length: 4 }, (_, i) => new Paragraph({
    pageBreakBefore: i > 0, children: [new TextRun({ text: 'Content ' + (i + 1), bold: true, color: 'AACC22' })],
  }));
  const source = new Document({ evenAndOddHeaderAndFooters: true, sections: [{
    properties: { titlePage: true, page: { margin: { left: 1777 }, pageNumbers: { start: 7 } } },
    headers: { default: header('Odd header'), even: header('Even header'), first: header('First header') },
    footers: { default: footer('Odd footer'), even: footer('Even footer'), first: footer('First footer') }, children: paragraphs,
  }] });
  const zip = await JSZip.loadAsync(await Packer.toBuffer(source));
  const app = (await zip.file('docProps/app.xml')!.async('string')).replace(/\/>$/, '></Properties>').replace(/<Pages>.*?<\/Pages>/, '').replace('</Properties>', '<Pages>4</Pages></Properties>');
  zip.file('docProps/app.xml', app);
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'four-pages.docx');
}

test('physical Word ranges preserve page numbering, first/even/default stories, formatted text and original page total', async () => {
  const file = await pagedFile();
  assert.deepEqual(await wordPageLabels(file), ['Trang 1', 'Trang 2', 'Trang 3', 'Trang 4']);
  const [front, back, whole] = await splitWordPages(file, [[0, 1, 2], [1, 2], [0, 1, 2, 3]]);
  assert.deepEqual(whole, new Uint8Array(await file.arrayBuffer()));
  const xml = async (pkg: JSZip, path: string) => await pkg.file(path)!.async('string');
  for (const [i, bytes] of [front, back].entries()) {
    const result = await JSZip.loadAsync(bytes);
    const main = await xml(result, 'word/document.xml');
    assert.match(main, /w:left="1777"/);
    assert.match(main, /AACC22/);
    assert.match(main, new RegExp('w:start="' + (7 + i) + '"'));
    assert.equal(main.includes('w:titlePg'), !i);
    assert.equal(main.includes('Content 1'), !i);
    assert.ok(main.includes('Content 2') && main.includes('Content 3') && !main.includes('Content 4'));
    const footerPaths = Object.keys(result.files).filter(k => /^word\/footer\d+\.xml$/.test(k));
    const footers = (await Promise.all(footerPaths.map(path => xml(result, path)))).join('');
    assert.ok(footers.includes('Even footer') && footers.includes('Odd footer'));
    assert.equal(footers.includes('First footer'), !i);
    assert.match(footers, /w:instr="PAGE"/);
    assert.match(footers, /w:instr="= 4"/);
    assert.match(await xml(result, 'docProps/app.xml'), new RegExp('<Pages>' + (3 - i) + '</Pages>'));
  }
});

test('page cuts inside a paragraph retain character styles and clear first-line spacing only for its continuation', async () => {
  const doc = new Document({ sections: [{ children: [new Paragraph({ indent: { firstLine: 555 }, spacing: { before: 240 }, children: [
    new TextRun({ text: 'ABCDEF', bold: true }),
  ] })] }] });
  const file = new File([await Packer.toBuffer(doc)], 'flow.docx');
  const layout = { pageCount: 2, boundaries: [{ paragraph: 0, offset: 3, text: 'ABCDEF', inTable: false }] };
  const [first, second] = await splitWordPages(file, [[0], [1]], layout);
  const paragraphXml = async (data: Uint8Array) => (await JSZip.loadAsync(data)).file('word/document.xml')!.async('string');
  const start = await paragraphXml(first);
  const end = await paragraphXml(second);
  assert.match(start, /w:firstLine="555"/);
  assert.match(start, />ABC<\/w:t>/);
  assert.match(end, />DEF<\/w:t>/);
  assert.match(end, /w:firstLine="0"/);
  assert.match(end, /w:before="0"/);
  assert.match(end, /<w:b\b/);
  const justified = await changePart(file, 'word/document.xml', xml => xml.replace('<w:pPr>', '<w:pPr><w:jc w:val="both"/>'));
  await assert.rejects(splitWordPages(justified, [[0]], layout), /vị trí dòng/);
});

test('a paragraph on a natural page rollover keeps its first-line indent but loses its suppressed top margin', async () => {
  const doc = new Document({ sections: [{ children: [
    new Paragraph('First'), new Paragraph({ text: 'Second', spacing: { before: 100 }, indent: { firstLine: 432 } }),
  ] }] });
  const file = new File([await Packer.toBuffer(doc)], 'rollover.docx');
  const layout = { pageCount: 2, boundaries: [{ paragraph: 1, offset: 0, text: 'Second', inTable: false }] };
  const [data] = await splitWordPages(file, [[1]], layout);
  const body = await (await JSZip.loadAsync(data)).file('word/document.xml')!.async('string');
  assert.match(body, /w:before="0"/);
  assert.match(body, /w:firstLine="432"/);
  assert.doesNotMatch(body, />First<\/w:t>/);
});

test('selected pages across sections realize linked headers, keep original restart and retain margins', async () => {
  const doc = new Document({ sections: [
    { properties: { page: { margin: { left: 900 } } }, headers: { default: new Header({ children: [new Paragraph('Linked')] }) },
      children: [new Paragraph('A'), new Paragraph({ text: 'B', pageBreakBefore: true })] },
    { properties: { titlePage: true, page: { margin: { left: 1000 }, pageNumbers: { start: 21 } } },
      footers: { first: new Footer({ children: [new Paragraph('Section cover footer')] }) },
      children: [new Paragraph('C'), new Paragraph({ text: 'D', pageBreakBefore: true })] },
  ] });
  const original = new File([await Packer.toBuffer(doc)], 'sections.docx');
  const file = await changePart(original, 'docProps/app.xml', xml => xml.replace(/\/>$/, '><Pages>4</Pages></Properties>'));
  const [inside, across] = await splitWordPages(file, [[3], [1, 2]]);
  const get = async (bytes: Uint8Array) => (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string');
  assert.match(await get(inside), /w:start="22"/);
  assert.doesNotMatch(await get(inside), /w:titlePg/);
  const xml = await get(across);
  assert.equal((xml.match(/<w:sectPr>/g) ?? []).length, 2);
  assert.match(xml, /w:start="2"/);
  assert.match(xml, /w:start="21"/);
  assert.match(xml, /w:left="900"/);
  assert.match(xml, /w:left="1000"/);
  assert.equal((xml.match(/<w:headerReference/g) ?? []).length, 2);
  assert.match(xml, /w:titlePg/);
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
