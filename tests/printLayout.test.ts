import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HARDWARE_MIN_MM,
  computePageLayout,
  fitInto,
  gridCells,
  looksAdministrative,
  parsePageRange,
  recommendDocumentMargins,
  sliceOffsets,
  type LayoutRequest,
} from '../src/lib/print/printLayout';

const base: LayoutRequest = {
  kind: 'sheet',
  content: { w: 180, h: 120 },
  paper: 'A4',
  orientation: 'portrait',
  marginPreset: 'auto',
  scaleMode: 'auto',
  centerH: true,
  centerV: false,
};

const near = (a: number, b: number, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('auto margins shrink side margins so a slightly wide table prints at 100%', () => {
  const layout = computePageLayout({ ...base, content: { w: 190, h: 100 } });
  near(layout.scale, 1);
  near(layout.margins.left, 10);
  near(layout.margins.right, 10);
  assert.ok(layout.notes.some((n) => n.includes('Thu lề trái/phải')));
});

test('auto margins never go below the printer hardware floor', () => {
  const layout = computePageLayout({ ...base, content: { w: 260, h: 100 } });
  assert.ok(layout.margins.left >= HARDWARE_MIN_MM - 1e-9);
  assert.ok(layout.scale < 1);
});

test('centering balances the leftover width on both sides', () => {
  const layout = computePageLayout({ ...base, content: { w: 100, h: 50 } });
  near(layout.effectiveMargins.left, layout.effectiveMargins.right);
  near(layout.placement.x, (210 - 100) / 2);
});

test('auto orientation turns a wide slide landscape and fills the page', () => {
  const layout = computePageLayout({ ...base, kind: 'slide', content: { w: 254, h: 142.9 }, orientation: 'auto', centerV: true });
  assert.equal(layout.orientation, 'landscape');
  near(layout.effectiveMargins.top, layout.effectiveMargins.bottom);
  near(layout.effectiveMargins.left, layout.effectiveMargins.right);
});

test('a tall sheet flows over several pages and keeps its width fit', () => {
  const layout = computePageLayout({ ...base, content: { w: 150, h: 700 }, flowsVertically: true });
  near(layout.scale, 1);
  assert.equal(layout.pagesPerItem, Math.ceil(700 / layout.printable.h));
});

test('fixed presets and custom scale are respected', () => {
  const layout = computePageLayout({ ...base, marginPreset: 'narrow', scaleMode: 'custom', customScale: 50 });
  near(layout.margins.top, 12.7);
  near(layout.scale, 0.5);
});

test('page ranges accept lists, open ranges and ignore invalid pages', () => {
  assert.deepEqual(parsePageRange('', 3), [1, 2, 3]);
  assert.deepEqual(parsePageRange('1-3, 5', 6), [1, 2, 3, 5]);
  assert.deepEqual(parsePageRange('4-', 6), [4, 5, 6]);
  assert.deepEqual(parsePageRange('9, 0, 2', 3), [2]);
  assert.deepEqual(parsePageRange('3-1', 5), [1, 2, 3]);
});

test('slices end on row boundaries instead of cutting a row', () => {
  assert.deepEqual(sliceOffsets(300, 100, [40, 80, 130, 170, 210, 260]), [0, 80, 170, 260]);
  assert.deepEqual(sliceOffsets(250, 100), [0, 100, 200]);
});

test('grid cells and fitInto centre handouts in their cell', () => {
  const cells = gridCells({ x: 10, y: 10, w: 190, h: 277 }, 2, 3, 6);
  assert.equal(cells.length, 6);
  near(cells[1].x - cells[0].x - cells[0].w, 6);
  const fitted = fitInto({ w: 16, h: 9 }, cells[0]);
  near(fitted.x - cells[0].x, cells[0].x + cells[0].w - fitted.x - fitted.w);
});

test('document advice applies Decree 30 to administrative papers', () => {
  const advice = recommendDocumentMargins({ paper: { w: 210, h: 297 }, margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 }, widestObjectMm: 100, administrative: true, binding: false });
  assert.deepEqual(advice.margins, { top: 20, right: 15, bottom: 20, left: 30 });
});

test('document advice narrows margins for a wide table, then suggests landscape', () => {
  const margins = { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 };
  const narrowed = recommendDocumentMargins({ paper: { w: 210, h: 297 }, margins, widestObjectMm: 175, administrative: false, binding: false });
  near(210 - narrowed.margins.left - narrowed.margins.right, 175, 0.2);
  assert.equal(narrowed.landscape, false);
  const tooWide = recommendDocumentMargins({ paper: { w: 210, h: 297 }, margins, widestObjectMm: 240, administrative: false, binding: false });
  assert.equal(tooWide.landscape, true);
});

test('administrative text is recognised by its national motto', () => {
  assert.equal(looksAdministrative('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc'), true);
  assert.equal(looksAdministrative('Báo cáo doanh thu quý 3'), false);
});

test('copies, collation and manual duplex produce the right sheet order', async () => {
  const { composePages, expandCopies, duplexSide, filterParity } = await import('../src/components/print/printOutput');
  const sheet = { key: 'k', paper: { w: 210, h: 297 }, orientation: 'portrait' as const, margins: { top: 0, right: 0, bottom: 0, left: 0 }, cells: [], items: [0] };
  const sheets = [0, 1, 2].map((i) => ({ ...sheet, key: `k${i}`, items: [i] }));
  const pages = composePages(sheets, [0, 1, 2], 1);
  const ids = (run: ReturnType<typeof expandCopies>) => run.map((p) => (p ? p.slots[0].sheet + 1 : 0)).join(',');
  assert.equal(ids(expandCopies(pages, 2, true, false)), '1,2,3,1,2,3');
  assert.equal(ids(expandCopies(pages, 2, false, false)), '1,1,2,2,3,3');
  const run = expandCopies(pages, 2, true, true);
  assert.equal(ids(run), '1,2,3,0,1,2,3,0');
  assert.equal(ids(duplexSide(run, 'front', false)), '1,3,1,3');
  assert.equal(ids(duplexSide(run, 'back', false)), '2,0,2,0');
  assert.deepEqual(filterParity([0, 1, 2, 3], 'even'), [1, 3]);
});

test('two pages per sheet turn the paper landscape and fit both pages', async () => {
  const { composePages } = await import('../src/components/print/printOutput');
  const sheet = { key: 'k', paper: { w: 210, h: 297 }, orientation: 'portrait' as const, margins: { top: 0, right: 0, bottom: 0, left: 0 }, cells: [], items: [0] };
  const out = composePages([sheet, { ...sheet, key: 'k2' }, { ...sheet, key: 'k3' }], [0, 1, 2], 2);
  assert.equal(out.length, 2);
  assert.equal(out[0].orientation, 'landscape');
  assert.equal(out[0].slots.length, 2);
  assert.ok(out[0].slots[1].box.x > out[0].slots[0].box.x + out[0].slots[0].box.w);
});
