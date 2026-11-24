import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PPT_MASTER_MODES, PPT_MASTER_STYLES, findStyle } from '../src/lib/pptMaster/catalog.ts';
import { buildDeckPrompt, parseDeck, toNumber } from '../src/lib/pptMaster/deck.ts';
import { contrast, renderDeck, resolvePalette } from '../src/lib/pptMaster/render.ts';

const HEX = /^#[0-9A-F]{6}$/i;

const sampleDeck = {
  title: 'Kết quả quý III',
  pages: [
    { role: 'cover', title: 'Kết quả quý III', takeaway: 'Báo cáo Hội đồng quản trị' },
    { role: 'agenda', title: 'Nội dung', items: [{ label: 'Doanh thu' }, { label: 'Chi phí' }] },
    { role: 'kpi', title: 'Doanh thu tăng 23%', items: [{ value: '23%', label: 'Tăng trưởng', detail: 'so với quý II' }] },
    { role: 'chart', title: 'Doanh thu theo tháng', chart: { type: 'column', categories: ['T7', 'T8', 'T9'], series: [{ name: 'Tỷ đồng', values: [10, 12, '14,5'] }] }, source: 'Phòng Tài chính' },
    { role: 'table', title: 'Chi phí', table: { header: ['Hạng mục', 'Số tiền'], rows: [['Nhân sự', '5'], ['Vật tư']] } },
    { role: 'comparison', title: 'Trước và sau', left: { heading: 'Trước', bullets: ['Chậm'] }, right: { heading: 'Sau', bullets: ['Nhanh'] } },
    { role: 'timeline', title: 'Lộ trình', items: [{ label: 'Q4' }, { label: 'Q1' }] },
    { role: 'quote', title: 'Trích dẫn', quote: { text: 'Tập trung là sức mạnh', author: 'Ban giám đốc' } },
    { role: 'mystery', title: 'Vai trò lạ', bullets: ['Một ý'] },
    { role: 'closing', title: 'Cảm ơn', takeaway: 'Hỏi đáp' },
  ],
};

test('catalog keeps 18 styles and 5 modes with valid palettes', () => {
  assert.equal(PPT_MASTER_STYLES.length, 18);
  assert.equal(PPT_MASTER_MODES.length, 5);
  assert.equal(new Set(PPT_MASTER_STYLES.map((style) => style.id)).size, 18);
  for (const style of PPT_MASTER_STYLES) for (const color of Object.values(style.tokens.palette)) assert.match(color, HEX, style.id);
});

test('every style resolves a readable text color on its background', () => {
  for (const style of PPT_MASTER_STYLES) {
    const palette = resolvePalette(style);
    assert.ok(contrast(palette.background, palette.text) >= 4.5, style.id);
  }
});

test('an unreadable AI palette is corrected', () => {
  const palette = resolvePalette(findStyle('swiss-minimal'), { background: '#FFFFFF', text: '#FAFAFA' });
  assert.ok(contrast(palette.background, palette.text) >= 4.5);
});

test('prompt carries mode, style, page count and language', () => {
  const prompt = buildDeckPrompt({ styleId: 'dark-tech', modeId: 'narrative', pages: 8, language: 'en', brief: 'Launch plan', hasSource: false, aiPalette: true });
  assert.match(prompt, /Mode: narrative/);
  assert.match(prompt, /Visual style: dark-tech/);
  assert.match(prompt, /Exactly 8 pages/);
  assert.match(prompt, /in English/);
  assert.match(prompt, /Choose a palette/);
});

test('parseDeck reads fenced JSON and repairs loose values', () => {
  const deck = parseDeck(`Here you go:\n\`\`\`json\n${JSON.stringify(sampleDeck)}\n\`\`\``);
  assert.equal(deck.pages.length, 10);
  assert.deepEqual(deck.pages[3].chart?.series[0].values, [10, 12, 14.5]);
  assert.deepEqual(deck.pages[4].table?.rows[1], ['Vật tư', '']);
  assert.equal(deck.pages[8].role, 'bullets');
});

test('parseDeck rejects text without a plan', () => {
  assert.throws(() => parseDeck('Xin lỗi, tôi không làm được.'));
  assert.throws(() => parseDeck('{"pages": []}'));
});

test('renderDeck builds native slides inside the canvas for every style', () => {
  const deck = parseDeck(JSON.stringify(sampleDeck));
  for (const style of PPT_MASTER_STYLES) {
    const slides = renderDeck(deck, style.id);
    assert.equal(slides.length, deck.pages.length, style.id);
    const ids = new Set<string>();
    for (const slide of slides) {
      assert.ok(slide.elements.length > 0, `${style.id} empty slide`);
      for (const el of slide.elements) {
        assert.ok(!ids.has(el.id), `${style.id} duplicate id`);
        ids.add(el.id);
        if (el.name === 'Decoration') continue;
        assert.ok(el.x >= 0 && el.y >= 0 && el.x + el.width <= 100.01 && el.y + el.height <= 100.01, `${style.id} ${el.type} out of canvas`);
      }
    }
    assert.ok(slides.some((slide) => slide.elements.some((el) => el.type === 'chart')), style.id);
    assert.ok(slides.some((slide) => slide.elements.some((el) => el.type === 'table')), style.id);
    assert.ok(slides[3].elements.some((el) => el.text === 'Nguồn: Phòng Tài chính'));
  }
});

test('toNumber reads Vietnamese and English number formats', () => {
  assert.equal(toNumber('14,5'), 14.5);
  assert.equal(toNumber('1.234.567'), 1234567);
  assert.equal(toNumber('1.234,5'), 1234.5);
  assert.equal(toNumber('1,234.5'), 1234.5);
  assert.equal(toNumber('23%'), 23);
  assert.equal(toNumber('2,5 tỷ'), 2.5);
  assert.equal(toNumber('1.234,5 đồng'), 1234.5);
  assert.equal(toNumber('$1,234.5'), 1234.5);
  assert.equal(toNumber('-3,2%'), -3.2);
  assert.equal(toNumber('12 345'), 12345);
  assert.equal(toNumber('không rõ'), 0);
});
