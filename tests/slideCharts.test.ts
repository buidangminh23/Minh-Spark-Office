import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { SlidePlot } from '../src/editors/slide/SlidePlot.tsx';
import { child, descendants, parseXml, path } from '../src/lib/miniXml.ts';
import { buildPptxFile } from '../src/lib/pptxExport.ts';
import { importFromPptx } from '../src/lib/pptxImport.ts';
import type { PresentationData, SlideElement } from '../src/lib/slideTypes.ts';

const stacked: SlideElement = {
  id: 'bars', type: 'chart', x: 0, y: 0, width: 50, height: 50,
  chartType: 'column', chartGrouping: 'stacked', chartCategories: ['A', 'B'],
  chartYAxis: { min: 0, max: 10, majorUnit: 2 },
  chartSeries: [
    { name: 'First', color: '#FF0000', values: [3, 1] },
    { name: 'Second', color: '#0000FF', values: [6, 2] },
  ],
};
const scatter: SlideElement = {
  ...stacked, id: 'points', chartType: 'scatter', chartGrouping: undefined, chartCategories: [],
  chartXAxis: { title: 'Time', min: 0, max: 10 }, chartYAxis: { title: 'Distance', min: 0, max: 10 },
  chartSeries: [
    { name: 'First', color: '#FF0000', xValues: [0, 2, 9], values: [2, 6, 4], markerSize: 8, showLine: false },
    { name: 'Second', color: '#0000FF', xValues: [5], values: [0], markerSize: 12, showLine: false },
  ],
};
const deck: PresentationData = {
  title: 'Charts', themeId: 'office-classic', aspectRatio: '16:9',
  slides: [{ id: 's1', layout: 'blank', background: { type: 'solid', value: '#FFFFFF' }, notes: '',
    transition: { type: 'none', duration: 0 }, elements: [stacked, scatter] }],
};

test('column stacks share a baseline and scatter point spacing follows its numeric X axis', () => {
  const draw = (el: SlideElement) => parseXml(renderToStaticMarkup(createElement(SlidePlot, { el, width: 500, height: 300 })));
  const bars = descendants(draw(stacked), 'rect').filter((node) => child(node, 'title'));
  assert.equal(bars.length, 4);
  assert.equal(bars[0].attrs.x, bars[1].attrs.x);
  assert.ok(Math.abs(Number(bars[0].attrs.y) - Number(bars[1].attrs.y) - Number(bars[1].attrs.height)) < 1e-8);
  const svg = draw(scatter);
  const points = descendants(svg, 'circle').filter((node) => child(node, 'title'));
  assert.equal(points.length, 4);
  const [a, b, c] = points.map((p) => Number(p.attrs.cx));
  assert.ok(Math.abs((c - b) / (b - a) - 3.5) < 1e-8);
  assert.equal(points[3].attrs.r, '6');
  assert.equal(descendants(svg, 'polyline').length, 0);
  assert.ok(descendants(svg, 'text').some((t) => t.text === 'Time'));
  assert.ok(descendants(svg, 'text').some((t) => t.text === 'Distance'));
});

test('each exported scatter series points to its own numeric X/Y data in its embedded workbook', async () => {
  const bytes = await buildPptxFile(deck);
  const zip = await JSZip.loadAsync(bytes);
  let checked = false;
  for (const part of zip.file(/^ppt\/charts\/chart\d+\.xml$/)) {
    const xml = parseXml(await part.async('string'));
    if (!descendants(xml, 'c:scatterChart').length) continue;
    const rel = zip.file(part.name.replace('/charts/', '/charts/_rels/') + '.rels')!;
    const target = descendants(parseXml(await rel.async('string')), 'Relationship')[0].attrs.Target;
    const embedded = await JSZip.loadAsync(await zip.file(target.replace(/^\.\.\//, 'ppt/').replace(/^\//, ''))!.async('uint8array'));
    const sheet = parseXml(await embedded.file('xl/worksheets/sheet1.xml')!.async('string'));
    const cells = new Map(descendants(sheet, 'c').map((node) => [node.attrs.r, child(node, 'v')?.text]));
    const all = descendants(xml, 'c:ser');
    assert.equal(all.length, 2);
    all.forEach((ser, i) => {
      for (const [axis, values] of [['xVal', scatter.chartSeries![i].xValues!], ['yVal', scatter.chartSeries![i].values]] as const) {
        const ref = path(ser, `c:${axis}`, 'c:numRef', 'c:f')!.text;
        const match = /^Sheet1!\$([A-Z]+)\$(\d+):\$\1\$(\d+)$/.exec(ref)!;
        assert.ok(match);
        assert.equal(Number(match[3]) - Number(match[2]) + 1, values.length);
        assert.deepEqual(values.map((_, j) => cells.get(match[1] + (Number(match[2]) + j))), values.map(String));
      }
    });
    checked = true;
  }
  assert.ok(checked);
  const opened = await importFromPptx(new Uint8Array(bytes).buffer, 'charts.pptx');
  const [bars, points] = opened.slides[0].elements;
  assert.equal(bars.chartGrouping, 'stacked');
  assert.equal(bars.chartYAxis?.majorUnit, 2);
  assert.equal(points.chartType, 'scatter');
  assert.equal(points.chartXAxis?.title, 'Time');
  assert.equal(points.chartYAxis?.title, 'Distance');
  assert.deepEqual(points.chartSeries, scatter.chartSeries);
});
