import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credit, parseResults, searchUrl, sizedUrl } from '../src/editors/doc/onlinePictures';
import { parallelRows } from '../src/editors/doc/ui/AiDialogs';

test('searchUrl asks Commons for bitmap files with CORS enabled', () => {
  const url = new URL(searchUrl('hoa sen', 24));
  assert.equal(url.host, 'commons.wikimedia.org');
  assert.equal(url.searchParams.get('origin'), '*');
  assert.equal(url.searchParams.get('gsrsearch'), 'filetype:bitmap hoa sen');
  assert.equal(url.searchParams.get('gsroffset'), '24');
});

test('parseResults keeps search order, strips HTML credit and sizes large files down', () => {
  const body = {
    continue: { gsroffset: 24 },
    query: {
      pages: {
        '9': { title: 'File:Lotus_flower.jpg', index: 2, imageinfo: [{ thumburl: 'https://thumb.wikimedia.org/a/thumb/x/Lotus.jpg/330px-Lotus.jpg?utm_source=x', url: 'https://upload.wikimedia.org/a/x/Lotus.jpg', width: 4000, height: 3000, extmetadata: { Artist: { value: '<a href="#">Nguyễn &amp; Co</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
        '3': { title: 'File:Small.png', index: 1, imageinfo: [{ thumburl: 'https://upload.wikimedia.org/s/320px-Small.png', url: 'https://upload.wikimedia.org/s/Small.png?utm_content=original', width: 800, height: 600 }] },
        '5': { title: 'File:Broken.jpg', index: 3, imageinfo: [{}] },
      },
    },
  };
  const { items, next } = parseResults(body);
  assert.equal(next, 24);
  assert.deepEqual(items.map((item) => item.title), ['Small', 'Lotus flower']);
  assert.equal(items[0].full, 'https://upload.wikimedia.org/s/Small.png');
  assert.equal(items[1].full, 'https://thumb.wikimedia.org/a/thumb/x/Lotus.jpg/1280px-Lotus.jpg');
  assert.equal(items[1].author, 'Nguyễn & Co');
  assert.equal(credit(items[1]), 'Lotus flower · Tác giả: Nguyễn & Co · Giấy phép: CC BY-SA 4.0 · Wikimedia Commons');
});

test('sizedUrl leaves small originals untouched', () => {
  assert.equal(sizedUrl('https://x/320px-a.jpg', 'https://x/a.jpg', 1200), 'https://x/a.jpg');
});

test('parallelRows pairs lines and folds extra translated lines into the last row', () => {
  assert.deepEqual(parallelRows('Xin chào\n\nTạm biệt', 'Hello\nGoodbye'), [['Xin chào', 'Hello'], ['Tạm biệt', 'Goodbye']]);
  assert.deepEqual(parallelRows('Một', 'One\nextra'), [['Một', 'One extra']]);
  assert.deepEqual(parallelRows('A\nB', 'Only'), [['A', 'Only'], ['B', '']]);
});
