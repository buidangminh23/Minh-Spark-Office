import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { exportDocx } from '../src/lib/docxConvert';
import { readDocxWatermark } from '../src/lib/watermarkDocx';
import { normalizeWatermark, decodeDataUrl, imageSize } from '../src/lib/watermark';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const basePage = { size: 'A4', orientation: 'portrait', margins: { top: 96, right: 96, bottom: 96, left: 96 } };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung' }] }] };

const exportZip = async (page: object) => JSZip.loadAsync(await (await exportDocx(doc as never, page as never, 'Test')).arrayBuffer());

test('normalizeWatermark drops empty specs and clamps values', () => {
  assert.equal(normalizeWatermark({ kind: 'text', text: '   ' }), null);
  assert.equal(normalizeWatermark({ kind: 'image' }), null);
  const spec = normalizeWatermark({ kind: 'text', text: ' MẬT ', opacity: 5, size: 1000, color: 'bad' })!;
  assert.equal(spec.text, 'MẬT');
  assert.equal(spec.opacity, 1);
  assert.equal(spec.size, 400);
  assert.equal(spec.color, '#C0C0C0');
});

test('decodeDataUrl reads PNG dimensions', () => {
  const image = decodeDataUrl(PIXEL)!;
  assert.equal(image.ext, 'png');
  assert.deepEqual(imageSize(image.bytes), { width: 1, height: 1 });
});

test('text watermark is written into the DOCX header and read back', async () => {
  const zip = await exportZip({ ...basePage, watermark: 'BẢN NHÁP', watermarkOptions: { kind: 'text', color: '#dc2626', size: 80, layout: 'horizontal', opacity: 0.3, font: 'Times New Roman' } });
  const header = await zip.file('word/header1.xml')!.async('string');
  assert.match(header, /PowerPlusWaterMarkObject1/);
  assert.match(header, /string="BẢN NHÁP"/);
  assert.match(header, /fillcolor="#DC2626"/);
  assert.doesNotMatch(header, /rotation:/);
  const mark = await readDocxWatermark(zip, 'word/header1.xml');
  assert.equal(mark?.watermark, 'BẢN NHÁP');
  assert.equal(mark?.watermarkOptions.color, '#DC2626');
  assert.equal(mark?.watermarkOptions.layout, 'horizontal');
  assert.equal(mark?.watermarkOptions.font, 'Times New Roman');
  assert.equal(mark?.watermarkOptions.opacity, 0.3);
});

test('default text watermark is diagonal', async () => {
  const zip = await exportZip({ ...basePage, watermark: 'MẬT' });
  const header = await zip.file('word/header1.xml')!.async('string');
  assert.match(header, /rotation:325/);
  assert.equal((await readDocxWatermark(zip, 'word/header1.xml'))?.watermarkOptions.layout, 'diagonal');
});

test('picture watermark embeds media with a header relationship', async () => {
  const zip = await exportZip({ ...basePage, watermark: '', watermarkOptions: { kind: 'image', image: PIXEL, layout: 'horizontal', opacity: 0.4 } });
  assert.ok(zip.file('word/media/minh-watermark.png'));
  const rels = await zip.file('word/_rels/header1.xml.rels')!.async('string');
  assert.match(rels, /rIdMinhWatermark/);
  const mark = await readDocxWatermark(zip, 'word/header1.xml');
  assert.equal(mark?.watermarkOptions.kind, 'image');
  assert.equal(mark?.watermarkOptions.image, PIXEL);
  assert.ok(Math.abs((mark?.watermarkOptions.opacity ?? 0) - 0.4) < 0.01);
});

test('no watermark leaves the header untouched', async () => {
  const zip = await exportZip(basePage);
  const header = await zip.file('word/header1.xml')!.async('string');
  assert.doesNotMatch(header, /v:shape/);
});

test('slide watermark is exported to every PPTX slide and imported back', async () => {
  const { buildPptxFile } = await import('../src/lib/pptxExport');
  const { importFromPptx } = await import('../src/lib/pptxImport');
  const presentation = {
    aspectRatio: '16:9',
    themeId: 'office-classic',
    title: 'Test',
    watermark: { enabled: true, kind: 'text', text: 'TUYỆT MẬT', color: '#1d4ed8', size: 60, font: 'Tahoma', layout: 'diagonal', opacity: 0.25 },
    slides: [1, 2].map((n) => ({ id: `s${n}`, layout: 'title-content', background: { type: 'solid', value: '#FFFFFF' }, elements: [{ id: `t${n}`, type: 'text', x: 10, y: 10, width: 50, height: 20, content: `Trang ${n}` }] })),
  };
  const bytes = await buildPptxFile(presentation as never);
  const zip = await JSZip.loadAsync(bytes);
  for (const n of [1, 2]) {
    const xml = await zip.file(`ppt/slides/slide${n}.xml`)!.async('string');
    assert.match(xml, /name="MinhWatermark"/);
    assert.match(xml, /TUYỆT MẬT/);
  }
  const imported = await importFromPptx(bytes.buffer as ArrayBuffer, 'Test.pptx');
  assert.equal(imported.watermark?.enabled, true);
  assert.equal(imported.watermark?.text, 'TUYỆT MẬT');
  assert.equal(imported.watermark?.color?.toUpperCase(), '#1D4ED8');
  assert.equal(imported.watermark?.font, 'Tahoma');
  assert.equal(imported.watermark?.size, 60);
  assert.equal(imported.watermark?.layout, 'diagonal');
  assert.ok(Math.abs((imported.watermark?.opacity ?? 0) - 0.25) < 0.02);
  assert.ok(imported.slides.every((slide) => !slide.elements.some((el) => el.type === 'text' && /TUYỆT/.test(String((el as { content?: string }).content)))));
});

test('picture slide watermark round-trips through PPTX', async () => {
  const { buildPptxFile } = await import('../src/lib/pptxExport');
  const { importFromPptx } = await import('../src/lib/pptxImport');
  const presentation = {
    aspectRatio: '16:9', themeId: 'office-classic', title: 'Test',
    watermark: { enabled: true, kind: 'image', text: '', image: PIXEL, layout: 'horizontal', opacity: 0.4 },
    slides: [{ id: 's1', layout: 'title', background: { type: 'solid', value: '#FFFFFF' }, elements: [] }],
  };
  const imported = await importFromPptx((await buildPptxFile(presentation as never)).buffer as ArrayBuffer, 'Test.pptx');
  assert.equal(imported.watermark?.kind, 'image');
  assert.equal(imported.watermark?.layout, 'horizontal');
  assert.ok(imported.watermark?.image?.startsWith('data:image/png'));
  assert.ok(Math.abs((imported.watermark?.opacity ?? 0) - 0.4) < 0.02);
});
