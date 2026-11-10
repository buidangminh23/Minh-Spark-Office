import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { Node as PMNode, TagParseRule } from '@tiptap/pm/model';
import { FileObject, VideoEmbed } from '../src/editors/doc/insertNodes';
import { LayoutImage } from '../src/editors/doc/extensions';
import { safeFileData, safeHttpUrl, safeImageSrc } from '../src/editors/doc/safeUrl';

const schema = getSchema([StarterKit, VideoEmbed, FileObject, LayoutImage.configure({ inline: true, allowBase64: true })]);

const fakeElement = (attrs: Record<string, string>) => ({
  getAttribute: (name: string) => attrs[name] ?? null,
  hasAttribute: (name: string) => name in attrs,
  style: {},
}) as unknown as HTMLElement;

const parsedAttrs = (type: string, attrs: Record<string, string>) => {
  const rule = schema.nodes[type].spec.parseDOM?.[0] as TagParseRule;
  return (rule.getAttrs?.(fakeElement(attrs)) ?? {}) as Record<string, unknown>;
};

const flatten = (spec: unknown): unknown[] => (Array.isArray(spec) ? [spec, ...spec.flatMap(flatten)] : spec && typeof spec === 'object' ? [spec] : []);

const hrefsIn = (node: PMNode) => flatten(schema.nodes[node.type.name].spec.toDOM?.(node))
  .filter((part): part is Record<string, unknown> => !!part && typeof part === 'object' && !Array.isArray(part))
  .flatMap((attrs) => [attrs.href, attrs.src, attrs['data-url'], attrs['data-file-object']])
  .filter((value): value is string => typeof value === 'string');

const HOSTILE = ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)'];

test('only http and https URLs survive as video links', () => {
  assert.equal(safeHttpUrl('https://example.com/v.mp4'), 'https://example.com/v.mp4');
  assert.equal(safeHttpUrl('http://example.com'), 'http://example.com');
  for (const value of HOSTILE) assert.equal(safeHttpUrl(value), '', value);
  assert.equal(safeHttpUrl('/relative'), '');
});

test('image sources keep data images, blobs, web and relative paths only', () => {
  assert.equal(safeImageSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(safeImageSrc('blob:https://office.minhspark.com/1'), 'blob:https://office.minhspark.com/1');
  assert.equal(safeImageSrc('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(safeImageSrc('/templates/logo.png'), '/templates/logo.png');
  assert.equal(safeImageSrc('//evil.example/a.png'), null);
  for (const value of HOSTILE) assert.equal(safeImageSrc(value), null, value);
});

test('attachments only keep data and blob payloads', () => {
  assert.equal(safeFileData('data:application/pdf;base64,AAAA'), 'data:application/pdf;base64,AAAA');
  assert.equal(safeFileData('javascript:alert(1)'), '');
  assert.equal(safeFileData('https://evil.example/file'), '');
});

test('imported video embeds drop script URLs at parse time', () => {
  for (const value of HOSTILE) assert.equal(parsedAttrs('videoEmbed', { 'data-video-embed': 'true', 'data-url': value }).url, '', value);
  assert.equal(parsedAttrs('videoEmbed', { 'data-video-embed': 'true', 'data-url': 'https://example.com/v' }).url, 'https://example.com/v');
});

test('stored video embeds with script URLs never render an executable href', () => {
  for (const value of HOSTILE) {
    const node = schema.nodes.videoEmbed.create({ url: value });
    for (const href of hrefsIn(node)) assert.doesNotMatch(href, /script:|data:text/i, value);
  }
  const ok = schema.nodes.videoEmbed.create({ url: 'https://example.com/v' });
  assert.ok(hrefsIn(ok).includes('https://example.com/v'));
});

test('imported attachments and images drop script URLs', () => {
  assert.equal(parsedAttrs('fileObject', { 'data-file-object': 'javascript:alert(1)' }).data, '');
  for (const value of HOSTILE) assert.equal(parsedAttrs('image', { src: value }).src ?? null, null, value);
  assert.equal(parsedAttrs('image', { src: 'data:image/png;base64,AAAA' }).src, 'data:image/png;base64,AAAA');
  const image = schema.nodes.image.create({ src: 'javascript:alert(1)' });
  assert.deepEqual(hrefsIn(image), []);
});
