import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { mergePresentation, planSlides } from '../src/lib/pptxPreserve';
import { contentSignature } from '../src/lib/sourceFiles';
import { docSignature, presentationStamp } from '../src/lib/sourceExport';
import type { PresentationData } from '../src/lib/slideTypes';

async function deck(titles: string[], withNotes = false) {
  const pptx = new PptxGenJS();
  for (const title of titles) {
    const slide = pptx.addSlide();
    slide.addText(title, { x: 1, y: 1, w: 6, h: 1 });
    if (withNotes) slide.addNotes(`notes for ${title}`);
  }
  return new Uint8Array(await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer);
}

function resolve(part: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const segments = part.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') segments.pop();
    else segments.push(piece);
  }
  return segments.join('/');
}

async function danglingTargets(zip: JSZip) {
  const missing: string[] = [];
  for (const path of Object.keys(zip.files)) {
    if (!path.endsWith('.rels')) continue;
    const owner = path.replace('_rels/', '').replace(/\.rels$/, '');
    const xml = await zip.file(path)!.async('string');
    for (const [tag, target] of xml.matchAll(/<Relationship\b[^>]*Target="([^"]*)"[^>]*>/g)) {
      if (tag.includes('TargetMode="External"')) continue;
      if (!zip.file(resolve(owner, target))) missing.push(`${path} -> ${target}`);
    }
  }
  return missing;
}

test('signatures change with content and stay stable for equal content', () => {
  assert.equal(contentSignature({ a: 1, b: [1, 2] }), contentSignature({ a: 1, b: [1, 2] }));
  assert.notEqual(contentSignature({ a: 1 }), contentSignature({ a: 2 }));
  assert.notEqual(docSignature({ type: 'doc' }, { size: 'A4' }), docSignature({ type: 'doc' }, { size: 'A3' }));
  const presentation = { title: 'T', slides: [{ id: 's1' }, { id: 's2' }] } as unknown as PresentationData;
  const stamp = presentationStamp(presentation);
  assert.equal(stamp.parts?.length, 3);
  const edited = { ...presentation, slides: [presentation.slides[0], { id: 'changed' }] } as unknown as PresentationData;
  const next = presentationStamp(edited);
  assert.equal(next.parts?.[0], stamp.parts?.[0]);
  assert.equal(next.parts?.[1], stamp.parts?.[1]);
  assert.notEqual(next.parts?.[2], stamp.parts?.[2]);
  assert.notEqual(next.signature, stamp.signature);
});

test('planSlides keeps untouched slides, follows reordering and regenerates the rest', () => {
  assert.deepEqual(planSlides(['a', 'b', 'c'], ['a', 'x', 'c']), [
    { from: 'source', index: 0 }, { from: 'generated', index: 1 }, { from: 'source', index: 2 },
  ]);
  assert.deepEqual(planSlides(['a', 'b', 'c'], ['c', 'a']), [{ from: 'source', index: 2 }, { from: 'source', index: 0 }]);
  assert.deepEqual(planSlides(['a', 'a'], ['a', 'a', 'a']), [
    { from: 'source', index: 0 }, { from: 'source', index: 1 }, { from: 'generated', index: 2 },
  ]);
});

test('merging keeps original slide parts byte for byte and wires regenerated slides in', async () => {
  const original = await deck(['one', 'two', 'three']);
  const generated = await deck(['one', 'TWO EDITED', 'new four'], true);
  const merged = await JSZip.loadAsync(await mergePresentation(original, generated, [
    { from: 'source', index: 0 }, { from: 'generated', index: 1 }, { from: 'generated', index: 2 },
  ]));
  const source = await JSZip.loadAsync(original);
  assert.equal(await merged.file('ppt/slides/slide1.xml')!.async('string'), await source.file('ppt/slides/slide1.xml')!.async('string'));
  assert.equal(merged.file('ppt/slides/slide2.xml'), null);
  assert.equal(merged.file('ppt/slides/slide3.xml'), null);
  const presentation = await merged.file('ppt/presentation.xml')!.async('string');
  const slideIds = [...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  assert.equal(slideIds.length, 3);
  assert.equal(new Set(slideIds).size, 3);
  const masterIds = [...presentation.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  assert.equal(masterIds.length, 2);
  const layoutIds: string[] = [];
  for (const path of Object.keys(merged.files).filter((name) => /^ppt\/slideMasters\/[^/]+\.xml$/.test(name))) {
    layoutIds.push(...[...(await merged.file(path)!.async('string')).matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]));
  }
  assert.equal(new Set([...masterIds, ...layoutIds]).size, masterIds.length + layoutIds.length, 'master and layout ids are unique');
  assert.deepEqual(await danglingTargets(merged), []);
  const rels = await merged.file('ppt/_rels/presentation.xml.rels')!.async('string');
  const relIds = [...rels.matchAll(/\bId="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(relIds).size, relIds.length);
  const types = await merged.file('[Content_Types].xml')!.async('string');
  for (const path of Object.keys(merged.files)) {
    if (/^ppt\/(slides|slideMasters|slideLayouts|theme|notesSlides|notesMasters)\/[^/]+\.xml$/.test(path)) assert.ok(types.includes(`PartName="/${path}"`), `${path} has a content type`);
  }
  assert.doesNotMatch(types, /PartName="\/ppt\/slides\/slide2\.xml"/);
  const edited = Object.keys(merged.files).filter((name) => /^ppt\/slides\/kept\d+_slide\d+\.xml$/.test(name));
  assert.equal(edited.length, 2);
  assert.match(await merged.file(edited[0])!.async('string'), /TWO EDITED/);
});
