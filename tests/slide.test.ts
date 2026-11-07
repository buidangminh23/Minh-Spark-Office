import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blankPresentation,
  businessPitchPresentation,
  productLaunchPresentation,
  createSlideFromLayout,
} from '../src/lib/slideTemplates.ts';
import { SLIDE_THEMES } from '../src/lib/slideThemes.ts';
import { validateCloudPayload, validateCloudMeta, encodeCloudPayload, decodeCloudPayload } from '../src/lib/cloudCodec.ts';
import type { FileMeta, SlideContent } from '../src/lib/storage.ts';

test('creates standard presentation templates with slides and metadata', () => {
  const pitch = businessPitchPresentation();
  assert.equal(pitch.aspectRatio, '16:9');
  assert.equal(pitch.themeId, 'sapphire-modern');
  assert.ok(pitch.slides.length >= 5);

  const slide1 = pitch.slides[0];
  assert.equal(slide1.layout, 'title');
  assert.ok(slide1.elements.some((el) => el.isTitle && el.text?.includes('CHIẾN LƯỢC KINH DOANH')));

  const slide3 = pitch.slides[2];
  assert.ok(slide3.elements.some((el) => el.type === 'chart'));

  const launch = productLaunchPresentation();
  assert.ok(launch.slides.length >= 2);
  assert.ok(launch.slides[1].elements.some((el) => el.type === 'table'));

  const blank = blankPresentation();
  assert.equal(blank.slides.length, 1);
  assert.equal(blank.slides[0].layout, 'title');
});

test('generates all 9 slide layouts with required elements and typography', () => {
  const layouts = [
    'title',
    'title-content',
    'section',
    'two-content',
    'comparison',
    'title-only',
    'content-caption',
    'picture-caption',
    'blank',
  ] as const;

  for (const layout of layouts) {
    const slide = createSlideFromLayout(layout, 0, 'office-classic', 'Test Heading');
    assert.equal(slide.layout, layout);
    assert.ok(slide.id.startsWith('slide-'));
    assert.ok(Array.isArray(slide.elements));

    if (layout !== 'blank') {
      assert.ok(slide.elements.length > 0);
    }
  }
});

test('provides full set of Microsoft PowerPoint themes', () => {
  const themeKeys = Object.keys(SLIDE_THEMES);
  assert.ok(themeKeys.includes('office-classic'));
  assert.ok(themeKeys.includes('sapphire-modern'));
  assert.ok(themeKeys.includes('emerald-executive'));
  assert.ok(themeKeys.includes('sunset-gradient'));
  assert.ok(themeKeys.includes('midnight-dark'));

  for (const theme of Object.values(SLIDE_THEMES)) {
    assert.ok(theme.id);
    assert.ok(theme.primaryColor);
    assert.ok(theme.backgroundColor);
    assert.ok(theme.titleFont);
    assert.ok(theme.bodyFont);
  }
});

test('validates and round-trips slide content through cloudCodec', async () => {
  const meta: FileMeta = {
    id: 'test-slide-deck',
    name: 'Kế hoạch phát triển 2026.pptx',
    kind: 'slide',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    openedAt: Date.now(),
    starred: true,
    deletedAt: null,
    size: 5000,
    preview: 'Chiến lược kinh doanh 2026',
  };

  const content: SlideContent = {
    kind: 'slide',
    presentation: businessPitchPresentation(),
  };

  validateCloudMeta(meta, meta.id);
  validateCloudPayload({ content, versions: [] }, meta);

  const encoded = await encodeCloudPayload(content, [], meta);
  assert.ok(encoded.chunks.length >= 1);
  assert.ok(encoded.sha256.length === 64);

  const decoded = await decodeCloudPayload(encoded, meta);
  assert.equal(decoded.content?.kind, 'slide');
  if (decoded.content?.kind === 'slide') {
    assert.equal(decoded.content.presentation.slides.length, content.presentation.slides.length);
    assert.equal(decoded.content.presentation.themeId, content.presentation.themeId);
  }
});
