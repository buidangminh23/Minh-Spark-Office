import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { buildTemplateContent } from '../scripts/template-content.mjs';
import { openGalleryTemplate, parseTemplateManifest, readTemplateAsset } from '../src/lib/templateGallery';
import type { GalleryTemplate, TemplateAsset } from '../src/lib/templateGallery';

test('the shipped gallery exposes reproducible Office templates and thumbnails with verifiable content hashes', async () => {
  const content = buildTemplateContent();
  const catalog = parseTemplateManifest(content.manifest);
  assert.deepEqual(content.manifest, buildTemplateContent().manifest);
  assert.ok(catalog.templates.some(t => t.asset?.format === 'html'));
  assert.ok(catalog.templates.some(t => t.asset?.format === 'workbook.json'));
  assert.ok(catalog.templates.some(t => t.asset?.format === 'slides.json'));
  assert.ok(catalog.templates.some(t => t.asset?.format === 'pptx' && t.image));
  for (const { asset, image } of catalog.templates) {
    for (const ref of [asset, image]) {
      if (!ref) continue;
      const data = content.files.get(`/content/templates/${ref.sha256}.${ref.format}`);
      assert.ok(data);
      assert.equal(createHash('sha256').update(data).digest('hex'), ref.sha256);
    }
  }
  assert.throws(() => parseTemplateManifest({ schema: 1, templates: [...catalog.templates, catalog.templates[0]] }));
  assert.throws(() => parseTemplateManifest({ schema: 1, templates: [{ id: 'one', kind: 'sheet', title: 'Bad', asset: { sha256: 'b'.repeat(64), format: 'pptx' } }] }));
  assert.deepEqual(parseTemplateManifest({ schema: 1, templates: [] }), { schema: 1, templates: [] });
});

test('updated templates open through the existing editor actions, survive offline, and reject damaged assets', async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { __TAURI_INTERNALS__: {} }, configurable: true });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const { files, manifest } = buildTemplateContent();
  const bundled = parseTemplateManifest(manifest).templates;
  const hash = (data: string) => createHash('sha256').update(data).digest('hex');
  let online = true;
  const fetcher = t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (!online) throw new Error('Offline');
    const key = url.slice(url.lastIndexOf('/content/'));
    return files.has(key) ? new Response(files.get(key)) : new Response(null, { status: 404 });
  });
  const imports: string[] = [];
  let html: string | undefined;
  const actions = {
    onCreateDoc: (value?: string) => { html = value; },
    onCreateSheet: (value?: { sheetOrder: string[] }) => { if (value) assert.ok(value.sheetOrder.length); },
    onCreateSlide: (value?: { slides: unknown[] }) => { if (value) assert.ok(value.slides.length); },
    onImportFile: (file: File) => { imports.push(file.name); },
  };
  for (const template of bundled) await openGalleryTemplate(template, template, actions);
  assert.equal(imports.length, bundled.filter(t => t.asset?.format === 'pptx').length);

  const report = bundled.find(t => t.id === 'report')!;
  const updatedHtml = '<h1>Revised report</h1><p>{{today}}</p>';
  const updated: GalleryTemplate = { ...report, asset: { sha256: hash(updatedHtml), format: 'html' } };
  files.set(`/content/templates/${updated.asset!.sha256}.html`, Buffer.from(updatedHtml));
  await openGalleryTemplate(updated, report, actions);
  assert.equal(html, updatedHtml.replace('{{today}}', new Date().toLocaleDateString('vi-VN')));
  for (const [kind, format] of [['doc', 'docx'], ['sheet', 'xlsx'], ['slide', 'pptx']] as const) {
    const sample = `New office file ${format}`;
    const asset: TemplateAsset = { sha256: hash(sample), format };
    files.set(`/content/templates/${asset.sha256}.${format}`, Buffer.from(sample));
    await openGalleryTemplate({ id: `added-${kind}`, kind, title: 'New sample', thumb: `blank-${kind}`, asset }, undefined, actions);
    assert.equal(imports.at(-1), `New sample.${format}`);
  }
  online = false;
  const callsBefore = fetcher.mock.callCount();
  html = '';
  await openGalleryTemplate(updated, report, actions);
  assert.ok(html.includes('Revised report'));
  assert.equal(fetcher.mock.callCount(), callsBefore);
  const unavailable: TemplateAsset = { sha256: hash('Unpublished revision'), format: 'html' };
  await openGalleryTemplate({ ...updated, asset: unavailable }, report, actions);
  assert.ok(html.includes('Revised report'));
  online = true;
  files.set(`/content/templates/${unavailable.sha256}.html`, Buffer.from('Corrupt data'));
  await assert.rejects(readTemplateAsset(unavailable, false), /unavailable/);
});
