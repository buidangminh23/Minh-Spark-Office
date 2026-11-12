import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { mergeSlideFiles, slidePartLabels, splitSlideFile } from '../src/lib/slideFileParts';

Object.assign(globalThis, { DOMParser, XMLSerializer });

async function fixture(labels: string[], layout = 'LAYOUT_WIDE') {
  const ppt = new pptxgen();
  ppt.layout = layout;
  ppt.defineSlideMaster({ title: 'BRAND', objects: [{ text: { text: 'Brand ' + labels[0], options: { x: 0.1, y: 0.1, fontSize: 8 } } }] });
  for (const label of labels) {
    const slide = ppt.addSlide({ masterName: 'BRAND' });
    slide.addText(label, { x: 1, y: 1, color: '124578' });
    slide.addImage({ data: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=', x: 2, y: 2, w: 1, h: 1 });
    slide.addNotes(label + ' notes');
  }
  return new File([await ppt.write({ outputType: 'arraybuffer' }) as ArrayBuffer], 'sample.pptx');
}

async function inspect(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = async (path: string) => new DOMParser().parseFromString(await zip.file(path)!.async('string'));
  const pres = await xml('ppt/presentation.xml');
  for (const path of Object.keys(zip.files).filter(path => path.endsWith('.rels'))) {
    const owner = path.replace(/(^|\/)_rels\//, '$1').replace(/\.rels$/, '');
    const rels = await xml(path);
    for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('TargetMode') === 'External') continue;
      const part = new URL(rel.getAttribute('Target')!, 'https://package.invalid/' + owner).pathname.slice(1);
      assert.ok(zip.file(part), 'missing ' + part + ' for ' + owner);
    }
  }
  const rels = await xml('ppt/_rels/presentation.xml.rels');
  const targets = new Map(Array.from(rels.getElementsByTagName('Relationship')).map(rel => [rel.getAttribute('Id'), rel.getAttribute('Target')!.slice(1)]));
  const texts = [];
  for (const slide of Array.from(pres.getElementsByTagName('p:sldId'))) {
    const doc = await xml(targets.get(slide.getAttribute('r:id'))!);
    texts.push(doc.getElementsByTagName('a:t')[0].textContent);
    assert.equal(doc.getElementsByTagName('p:pic').length, 1);
    assert.equal(doc.getElementsByTagName('a:srgbClr')[0].getAttribute('val'), '124578');
  }
  return { texts, zip, pres };
}

test('native slide merge retains order, masters, images and notes across package name collisions', async () => {
  const result = await mergeSlideFiles([await fixture(['First', 'Second']), await fixture(['Third'])]);
  const { texts, zip, pres } = await inspect(result);
  assert.deepEqual(texts, ['First', 'Second', 'Third']);
  assert.equal(pres.getElementsByTagName('p:sldMasterId').length, 2);
  const layouts = await Promise.all(Object.values(zip.files).filter(e => /^ppt\/slideLayouts\/[^/]+\.xml$/.test(e.name)).map(e => e.async('string')));
  assert.ok(layouts.some(layout => layout.includes('Brand First')));
  assert.ok(layouts.some(layout => layout.includes('Brand Third')));
  assert.equal(Object.keys(zip.files).filter(s => /^ppt\/notesSlides\/[^/]+\.xml$/.test(s)).length, 3);
  assert.equal(Object.keys(zip.files).filter(s => /^ppt\/media\/[^/]+\.png$/.test(s)).length, 3);
});

test('split follows requested order and excludes omitted slide and speaker note bodies from the package', async () => {
  const file = await fixture(['First', 'Omitted', 'Third']);
  assert.deepEqual(await slidePartLabels(file), ['Slide 1', 'Slide 2', 'Slide 3']);
  const parts = await splitSlideFile(file, [[2, 0], [1]]);
  const { texts, zip } = await inspect(parts[0]);
  assert.deepEqual(texts, ['Third', 'First']);
  assert.equal(Object.keys(zip.files).filter(s => /^ppt\/media\/[^/]+\.png$/.test(s)).length, 2);
  for (const entry of Object.values(zip.files).filter(e => e.name.endsWith('.xml'))) assert.doesNotMatch(await entry.async('string'), /Omitted/);
  assert.deepEqual((await inspect(parts[1])).texts, ['Omitted']);
});

test('mismatched canvases and invalid or duplicate slide indices fail explicitly', async () => {
  const file = await fixture(['One']);
  await assert.rejects(mergeSlideFiles([file, await fixture(['Two'], 'LAYOUT_4x3')]), /kích thước/);
  for (const group of [[], [-1], [1], [0, 0]]) await assert.rejects(splitSlideFile(file, [group]), /không hợp lệ/);
});

async function editXml(file: File, path: string, change: (source: string) => string) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const source = await zip.file(path)!.async('string');
  const updated = change(source);
  assert.notEqual(updated, source);
  zip.file(path, updated);
  return new File([await zip.generateAsync({ type: 'arraybuffer' })], file.name);
}

test('preserves slide XML including timing and transitions, notes, theme, presentation settings and guides', async () => {
  const slide = 'ppt/slides/slide1.xml';
  const animated = await editXml(await fixture(['Animated']), slide, source => source.replace('</p:sld>', '<p:transition spd="med"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>'));
  const file = await editXml(animated, 'ppt/presentation.xml', source => source.replace('</p:presentation>', '<p:extLst><p:ext uri="{EFAFB233-063F-42B5-8137-9DF3F51BA10A}"><p15:sldGuideLst xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main"><p15:guide id="1" pos="2160"/></p15:sldGuideLst></p:ext></p:extLst></p:presentation>'));
  const original = await JSZip.loadAsync(await file.arrayBuffer());
  for (const result of [await mergeSlideFiles([file, file]), ...(await splitSlideFile(file, [[0]]))]) {
    const { zip, pres } = await inspect(result);
    for (const path of [slide, 'ppt/theme/theme1.xml', 'ppt/presProps.xml', 'ppt/viewProps.xml', 'ppt/notesMasters/notesMaster1.xml', 'ppt/notesSlides/notesSlide1.xml', 'docProps/core.xml']) {
      assert.deepEqual(await zip.file(path)!.async('uint8array'), await original.file(path)!.async('uint8array'), path);
    }
    assert.equal(pres.documentElement.getAttribute('autoCompressPictures'), '0');
    assert.equal(pres.getElementsByTagName('p15:sldGuideLst').length, 1);
    assert.equal(pres.getElementsByTagName('a:defRPr')[0].getAttribute('sz'), '1800');
  }
});

test('reports conflicting notes templates, default styles and unsupported presentation-wide features before producing output', async () => {
  const file = await fixture(['Original']);
  const notes = await editXml(file, 'ppt/notesMasters/notesMaster1.xml', s => s.replace('<p:notesMaster ', '<p:notesMaster preserve="1" '));
  await assert.rejects(mergeSlideFiles([file, notes]), /không tương thích/);
  const styles = await editXml(file, 'ppt/presentation.xml', s => s.replace('sz="1800"', 'sz="2222"'));
  await assert.rejects(mergeSlideFiles([file, styles]), /không tương thích/);
  const sections = await editXml(file, 'ppt/presentation.xml', s => s.replace('</p:presentation>', '<p:extLst><p:ext uri="example"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"/></p:ext></p:extLst></p:presentation>'));
  await assert.rejects(splitSlideFile(sections, [[0]]), /chưa hỗ trợ bảo toàn/);
});

test('preserves the presentation-level binary printer settings used by the python-pptx default template', async () => {
  const zip = await JSZip.loadAsync(await (await fixture(['Printed'])).arrayBuffer());
  const path = 'ppt/printerSettings/printerSettings1.bin';
  const bytes = new Uint8Array([10, 32, 124, 0, 255, 12]);
  const rels = 'ppt/_rels/presentation.xml.rels';
  const types = '[Content_Types].xml';
  zip.file(path, bytes);
  zip.file(rels, (await zip.file(rels)!.async('string')).replace('</Relationships>', '<Relationship Id="rPrinter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="printerSettings/printerSettings1.bin"/></Relationships>'));
  zip.file(types, (await zip.file(types)!.async('string')).replace('</Types>', '<Override PartName="/ppt/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.presentationml.printerSettings"/></Types>'));
  const input = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'print-settings.pptx');
  const merged = await mergeSlideFiles([input, input]);
  const split = await splitSlideFile(new File([new Uint8Array(merged)], 'merged.pptx'), [[1]]);
  for (const output of [merged, ...split]) {
    const { zip: result } = await inspect(output);
    assert.deepEqual(await result.file(path)!.async('uint8array'), bytes);
    assert.match(await result.file(rels)!.async('string'), /relationships\/printerSettings/);
  }
});
