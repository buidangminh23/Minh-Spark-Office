import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  approximateGradientColor,
  createPptxDocument,
  mapShapeFill,
  mapShapeLine,
  mapSlideBackground,
  parseCssColor,
} from '../src/lib/pptxExport.ts';
import type { PresentationData, SlideElement } from '../src/lib/slideTypes.ts';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const shape = (overrides: Partial<SlideElement>): SlideElement => ({
  id: 'shape',
  type: 'shape',
  x: 10,
  y: 10,
  width: 30,
  height: 30,
  shapeType: 'rectangle',
  ...overrides,
});

test('parseCssColor treats no-fill values as no fill instead of black', () => {
  assert.equal(parseCssColor('transparent'), null);
  assert.equal(parseCssColor('none'), null);
  assert.equal(parseCssColor(''), null);
  assert.equal(parseCssColor(undefined), null);
  assert.equal(parseCssColor('rgba(10, 20, 30, 0)'), null);
  assert.equal(parseCssColor('#11223300'), null);
  assert.equal(parseCssColor('#0284c7'), '0284C7');
  assert.equal(parseCssColor('#fff'), 'FFFFFF');
  assert.equal(parseCssColor('rgb(255, 0, 128)'), 'FF0080');
  assert.equal(parseCssColor('white'), 'FFFFFF');
  assert.equal(parseCssColor('linear-gradient(red, blue)'), null);
});

test('approximateGradientColor averages the gradient stops', () => {
  assert.equal(approximateGradientColor('linear-gradient(135deg, #000000 0%, #FFFFFF 100%)'), '808080');
  assert.equal(approximateGradientColor('linear-gradient(135deg, #0072FF 0%, rgb(0, 198, 255) 100%)'), '009CFF');
  assert.equal(approximateGradientColor('url(x.png)'), null);
});

test('shape fill and line mapping honours no fill, gradients and missing strokes', () => {
  assert.equal(mapShapeFill(shape({ fill: 'transparent' })), undefined);
  assert.equal(mapShapeFill(shape({ fillType: 'none', fill: '#FF0000' })), undefined);
  assert.deepEqual(mapShapeFill(shape({})), { color: '0284C7' });
  assert.deepEqual(mapShapeFill(shape({ fill: '#FF0000' })), { color: 'FF0000' });
  assert.deepEqual(
    mapShapeFill(shape({ fillType: 'gradient', gradient: 'linear-gradient(90deg, #000000, #FFFFFF)' })),
    { color: '808080' }
  );
  assert.equal(mapShapeLine(shape({})), undefined);
  assert.equal(mapShapeLine(shape({ stroke: 'transparent', strokeWidth: 2 })), undefined);
  assert.deepEqual(mapShapeLine(shape({ stroke: '#123456', strokeWidth: 3, borderStyle: 'dashed' })), {
    color: '123456',
    width: 3,
    dashType: 'dash',
  });
});

test('slide backgrounds keep gradients and images instead of flattening to white', () => {
  assert.deepEqual(mapSlideBackground({ type: 'solid', value: '#112233' }), { color: '112233' });
  assert.deepEqual(
    mapSlideBackground({ type: 'gradient', value: 'linear-gradient(135deg, #000000 0%, #FFFFFF 100%)' }),
    { color: '808080' }
  );
  assert.deepEqual(mapSlideBackground({ type: 'image', value: PIXEL }), { data: PIXEL });
  assert.deepEqual(mapSlideBackground({ type: 'image', value: `url("${PIXEL}")` }), { data: PIXEL });
  assert.deepEqual(mapSlideBackground({ type: 'image', value: 'https://example.com/bg.png' }), {
    path: 'https://example.com/bg.png',
  });
});

test('exported pptx keeps hidden slides hidden, writes no-fill shapes and image backgrounds', async () => {
  const presentation: PresentationData = {
    aspectRatio: '16:9',
    themeId: 'default',
    title: 'Kiểm thử',
    slides: [
      {
        id: 'a',
        layout: 'blank',
        background: { type: 'image', value: PIXEL },
        elements: [shape({ id: 'frame', fill: 'transparent', stroke: '#FF0000', strokeWidth: 2 })],
        notes: 'Ghi chú A',
        transition: { type: 'none', duration: 0.5 },
      },
      {
        id: 'b',
        layout: 'blank',
        background: { type: 'gradient', value: 'linear-gradient(135deg, #000000 0%, #FFFFFF 100%)' },
        elements: [],
        notes: 'Ghi chú ẩn',
        transition: { type: 'none', duration: 0.5 },
        hidden: true,
      },
    ],
  };
  const pres = createPptxDocument(presentation);
  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideFiles.length, 2);
  const first = await zip.file('ppt/slides/slide1.xml')!.async('string');
  const second = await zip.file('ppt/slides/slide2.xml')!.async('string');
  assert.ok(!/show="0"/.test(first));
  assert.match(second, /<p:sld[^>]*show="0"/);
  assert.match(second, /<p:bg><p:bgPr><a:solidFill><a:srgbClr val="808080"/);
  assert.match(first, /<p:bg><p:bgPr><a:blipFill/);
  assert.match(first, /<a:noFill\/><a:ln[^>]*><a:solidFill><a:srgbClr val="FF0000"/);
  assert.ok(!first.includes('val="000000"'));
  const notes = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  const notesText = (await Promise.all(notes.map((name) => zip.file(name)!.async('string')))).join('');
  assert.ok(notesText.includes('Ghi chú ẩn'));
});
