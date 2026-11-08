import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHAPES, SHAPE_GROUPS, shapeDataUrl } from '../src/editors/doc/insertShapes';
import { SMARTART_LAYOUTS, SMARTART_PALETTES, smartArtDataUrl } from '../src/editors/doc/insertSmartArt';
import { PRIMITIVES, primitiveMesh } from '../src/editors/doc/insertModel3d';
import { CHART_KINDS, CHART_TEMPLATES, parseChartData } from '../src/editors/doc/insertCharts';
import { ICON_CATEGORIES, ICONS, searchIcons } from '../src/editors/doc/insertIcons';
import { searchSymbols, SYMBOL_SETS } from '../src/editors/doc/insertSymbols';

const unique = (values: string[]) => new Set(values).size === values.length;
const svgOf = (dataUrl: string) => decodeURIComponent(dataUrl.replace('data:image/svg+xml;charset=utf-8,', ''));
const balanced = (svg: string) => !/NaN|undefined|Infinity/.test(svg) && svg.startsWith('<svg') && svg.endsWith('</svg>');

test('shape gallery offers every Word shape family with unique ids and clean SVG', () => {
  assert.ok(SHAPES.length >= 150, `only ${SHAPES.length} shapes`);
  assert.ok(unique(SHAPES.map((shape) => shape.id)));
  assert.ok(SHAPE_GROUPS.includes('Nút hành động'));
  for (const shape of SHAPES) assert.ok(balanced(svgOf(shapeDataUrl({ id: shape.id, fill: '#dbe6fb', stroke: '#2b579a', text: 'Thử' }))), shape.id);
});

test('every SmartArt layout renders its sample and an empty outline in every palette', () => {
  assert.ok(SMARTART_LAYOUTS.length >= 22);
  assert.ok(unique(SMARTART_LAYOUTS.map((item) => item.id)));
  for (const layout of SMARTART_LAYOUTS) {
    for (const palette of SMARTART_PALETTES) assert.ok(balanced(svgOf(smartArtDataUrl({ layout: layout.id, text: layout.sample, palette: palette.id }))), `${layout.id}/${palette.id}`);
    assert.ok(balanced(svgOf(smartArtDataUrl({ layout: layout.id, text: 'Một mục', palette: 'blue' }))), `${layout.id} single`);
  }
});

test('every 3D model has finite vertices and faces that point at real vertices', () => {
  assert.ok(PRIMITIVES.length >= 30);
  assert.ok(unique(PRIMITIVES.map((item) => item.id)));
  for (const item of PRIMITIVES) {
    const mesh = primitiveMesh(item.id);
    assert.ok(mesh.faces.length >= 4, item.id);
    assert.ok(mesh.vertices.every((v) => v.every(Number.isFinite)), item.id);
    assert.ok(mesh.faces.every((face) => face.length >= 3 && face.every((i) => i >= 0 && i < mesh.vertices.length)), item.id);
  }
  assert.equal(primitiveMesh('dodecahedron').faces.length, 12);
  assert.ok(primitiveMesh('dodecahedron').faces.every((face) => face.length === 5));
});

test('chart data parser reads headers, Excel tabs and Vietnamese decimals', () => {
  const plain = parseChartData('Quý I, 120\nQuý II, 150');
  assert.deepEqual(plain.categories, ['Quý I', 'Quý II']);
  assert.deepEqual(plain.series[0].values, [120, 150]);
  const excel = parseChartData('Tháng\t2025\t2026\nT1\t1.234,5\t80\nT2\t90\t1,5');
  assert.deepEqual(excel.series.map((s) => s.name), ['2025', '2026']);
  assert.deepEqual(excel.series[0].values, [1234.5, 90]);
  assert.deepEqual(excel.series[1].values, [80, 1.5]);
});

test('every chart kind has a sample template that parses to data', () => {
  assert.ok(CHART_KINDS.length >= 30);
  assert.ok(unique(CHART_KINDS.map((item) => item.id)));
  for (const kind of CHART_KINDS) {
    const template = CHART_TEMPLATES.find((item) => item.kind === kind.id);
    assert.ok(template, `no template for ${kind.id}`);
    assert.ok(parseChartData(template.raw).categories.length > 0, kind.id);
  }
});

test('icon library is categorised and searchable without diacritics', () => {
  assert.ok(ICONS.length >= 300);
  assert.ok(ICON_CATEGORIES.every((category) => ICONS.some((icon) => icon.category === category)));
  assert.ok(searchIcons('dien thoai', null).some((icon) => icon.name === 'Điện thoại'));
  assert.ok(searchIcons('', 'Y tế').every((icon) => icon.category === 'Y tế'));
});

test('symbol sets cover the common Unicode blocks and search by code point', () => {
  assert.ok(SYMBOL_SETS.reduce((sum, set) => sum + set.symbols.length, 0) >= 1500);
  assert.ok(searchSymbols('2605').includes('★'));
  assert.ok(searchSymbols('U+20AB').includes('₫'));
  assert.ok(SYMBOL_SETS.find((set) => set.name === 'Hy Lạp')?.symbols.includes('Ω'));
});
