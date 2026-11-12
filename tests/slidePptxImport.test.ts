import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { buildPptxFile, textRuns, transitionXml } from '../src/lib/pptxExport.ts';
import { customGeometryPath, importFromPptx, importPptxDetailed } from '../src/lib/pptxImport.ts';
import { parseXml, descendants } from '../src/lib/miniXml.ts';
import type { PresentationData, SlideElement } from '../src/lib/slideTypes.ts';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const near = (actual: number | undefined, expected: number, tolerance = 0.2) => {
  assert.ok(actual !== undefined && Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

const element = (overrides: Partial<SlideElement> & Pick<SlideElement, 'id' | 'type'>): SlideElement => ({
  x: 10,
  y: 10,
  width: 30,
  height: 20,
  ...overrides,
});

const deck: PresentationData = {
  aspectRatio: '16:9',
  themeId: 'office-classic',
  title: 'Vòng lặp xuất nhập',
  slides: [
    {
      id: 's1',
      layout: 'blank',
      background: { type: 'solid', value: '#102030' },
      notes: 'Ghi chú trang một',
      transition: { type: 'push', duration: 0.8, direction: 'from-left', advanceAfterSeconds: 3 },
      elements: [
        element({ id: 'title', type: 'text', x: 5, y: 6, width: 90, height: 14, text: 'Báo cáo quý', fontSize: 40, fontWeight: 'bold', color: '#FFAA00', textAlign: 'center', verticalAlign: 'middle' }),
        element({ id: 'bullets', type: 'text', x: 5, y: 25, width: 40, height: 40, text: '• Doanh thu tăng\n• Chi phí giảm\nKết luận', fontSize: 20, color: '#FFFFFF' }),
        element({ id: 'star', type: 'shape', shapeType: 'star', x: 50, y: 25, width: 20, height: 30, fill: '#FF0000', stroke: '#00FF00', strokeWidth: 3, borderStyle: 'dashed', rotation: 30, text: 'Mới', color: '#FFFFFF', fontSize: 18 }),
        element({ id: 'decision', type: 'shape', shapeType: 'flow-decision', x: 72, y: 25, width: 20, height: 20, fill: '#2244AA' }),
        element({ id: 'hollow', type: 'shape', shapeType: 'donut', x: 72, y: 50, width: 12, height: 20, fillType: 'none', stroke: '#123456', strokeWidth: 2 }),
        element({ id: 'arrow', type: 'shape', shapeType: 'arrow-line', x: 10, y: 80, width: 40, height: 4, stroke: '#ABCDEF', strokeWidth: 2 }),
        element({ id: 'picture', type: 'image', x: 60, y: 75, width: 10, height: 15, src: PIXEL }),
      ],
    },
    {
      id: 's2',
      layout: 'blank',
      background: { type: 'solid', value: '#FFFFFF' },
      notes: '',
      hidden: true,
      transition: { type: 'vortex', duration: 1.5 },
      elements: [
        element({ id: 'table', type: 'table', x: 5, y: 5, width: 50, height: 30, tableRows: 2, tableCols: 2, tableHeaderRow: true, tableHeaderColor: '#D83B01', tableData: [['Tên', 'Số'], ['A', '12']] }),
        element({ id: 'chart', type: 'chart', x: 5, y: 40, width: 50, height: 50, chartType: 'column', chartTitle: 'Doanh số', chartCategories: ['Q1', 'Q2'], chartSeries: [{ name: 'Năm nay', values: [3, 7], color: '#0284C7' }, { name: 'Năm trước', values: [2, 5], color: '#F59E0B' }] }),
        element({ id: 'free', type: 'shape', shapeType: 'custom', customPath: 'M0 0L100 0L50 100Z', x: 60, y: 10, width: 20, height: 20, fill: '#00AA55' }),
        element({ id: 'ink', type: 'ink', x: 60, y: 40, width: 20, height: 20, inkPoints: [0, 0, 50, 100, 100, 0], inkColor: '#FF00FF', inkWidth: 4 }),
        element({ id: 'code', type: 'code', x: 60, y: 65, width: 35, height: 25, codeContent: 'const a = 1;' }),
      ],
    },
  ],
};

test('a deck exported to pptx comes back with its shapes, text, tables, charts and transitions', async () => {
  const file = await buildPptxFile(deck);
  const { presentation, report } = await importPptxDetailed(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, 'vong-lap.pptx');

  assert.equal(presentation.aspectRatio, '16:9');
  assert.equal(presentation.slides.length, 2);
  assert.equal(report.slides, 2);
  assert.deepEqual(report.skipped, []);

  const [first, second] = presentation.slides;
  assert.equal(first.background.value.toUpperCase(), '#102030');
  assert.equal(first.notes, 'Ghi chú trang một');
  assert.equal(first.transition.type, 'push');
  assert.equal(first.transition.direction, 'from-left');
  assert.equal(first.transition.advanceAfterSeconds, 3);
  assert.equal(first.hidden, undefined);
  assert.equal(second.hidden, true);
  assert.equal(second.transition.type, 'vortex');
  near(second.transition.duration, 1.5, 0.01);

  const title = first.elements.find((el) => el.text === 'Báo cáo quý');
  assert.ok(title);
  assert.equal(title.type, 'text');
  near(title.x, 5);
  near(title.y, 6);
  near(title.width, 90);
  near(title.height, 14);
  near(title.fontSize, 40);
  assert.equal(title.fontWeight, 'bold');
  assert.equal(title.color?.toUpperCase(), '#FFAA00');
  assert.equal(title.textAlign, 'center');
  assert.equal(title.verticalAlign, 'middle');

  const bullets = first.elements.find((el) => el.text?.includes('Doanh thu'));
  assert.equal(bullets?.text, '• Doanh thu tăng\n• Chi phí giảm\nKết luận');

  const star = first.elements.find((el) => el.shapeType === 'star');
  assert.ok(star);
  assert.equal(star.fill?.toUpperCase(), '#FF0000');
  assert.equal(star.stroke?.toUpperCase(), '#00FF00');
  near(star.strokeWidth, 3);
  assert.equal(star.borderStyle, 'dashed');
  assert.equal(star.rotation, 30);
  assert.equal(star.text, 'Mới');
  near(star.x, 50);
  near(star.width, 20);

  assert.ok(first.elements.some((el) => el.shapeType === 'flow-decision' && el.fill?.toUpperCase() === '#2244AA'));
  const hollow = first.elements.find((el) => el.shapeType === 'donut');
  assert.equal(hollow?.fillType, 'none');
  assert.equal(hollow?.stroke?.toUpperCase(), '#123456');

  const arrow = first.elements.find((el) => el.shapeType === 'arrow-line');
  assert.ok(arrow);
  near(arrow.width, 40, 0.3);
  near(arrow.x, 10, 0.3);
  near(arrow.y + arrow.height / 2, 82, 0.3);
  assert.equal(arrow.rotation, 0);
  assert.equal(arrow.stroke?.toUpperCase(), '#ABCDEF');

  const picture = first.elements.find((el) => el.type === 'image');
  assert.ok(picture?.src?.startsWith('data:image/png;base64,'));
  near(picture.width, 10);

  const table = second.elements.find((el) => el.type === 'table');
  assert.deepEqual(table?.tableData, [['Tên', 'Số'], ['A', '12']]);
  assert.equal(table?.tableHeaderColor?.toUpperCase(), '#D83B01');

  const chart = second.elements.find((el) => el.type === 'chart');
  assert.equal(chart?.chartType, 'column');
  assert.equal(chart?.chartTitle, 'Doanh số');
  assert.deepEqual(chart?.chartCategories, ['Q1', 'Q2']);
  assert.deepEqual(chart?.chartSeries?.map((series) => [series.name, series.values]), [['Năm nay', [3, 7]], ['Năm trước', [2, 5]]]);

  const free = second.elements.find((el) => el.shapeType === 'custom' && el.fill?.toUpperCase() === '#00AA55');
  assert.equal(free?.customPath, 'M0 0L100 0L50 100Z');
  const ink = second.elements.find((el) => el.shapeType === 'custom' && el.stroke?.toUpperCase() === '#FF00FF');
  assert.ok(ink?.customPath?.startsWith('M0 0L50 100L100 0'));
  assert.ok(second.elements.some((el) => el.text === 'const a = 1;'));

  const orders = first.elements.map((el) => el.zIndex ?? 0);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('group shapes, placeholders, theme colours and hand-written slide xml are read', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="rId2" Type="http://x/slide" Target="slides/slide7.xml"/><Relationship Id="rId9" Type="http://x/theme" Target="theme/theme1.xml"/></Relationships>');
  zip.file('ppt/slides/_rels/slide7.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://x/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>');
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://x/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', '<Relationships><Relationship Id="rId1" Type="http://x/theme" Target="../theme/theme1.xml"/></Relationships>');
  zip.file('ppt/theme/theme1.xml', '<a:theme><a:themeElements><a:clrScheme><a:dk1><a:sysClr val="windowText" lastClr="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="336699"/></a:accent1></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Verdana"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>');
  zip.file('ppt/slideMasters/slideMaster1.xml', '<p:sldMaster><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></p:bgPr></p:bg><p:spTree>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="685800"/><a:ext cx="7315200" cy="1371600"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="b"/><a:lstStyle/><a:p><a:r><a:t>Mẫu tiêu đề</a:t></a:r></a:p></p:txBody></p:sp>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="9" name="Bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="6400800"/><a:ext cx="9144000" cy="457200"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="AA0000"/></a:solidFill></p:spPr></p:sp>'
    + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"/><p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:buNone/><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:buChar char="•"/><a:defRPr sz="2800"/></a:lvl1pPr><a:lvl2pPr><a:buChar char="-"/><a:defRPr sz="2400"/></a:lvl2pPr></p:bodyStyle></p:txStyles></p:sldMaster>');
  zip.file('ppt/slideLayouts/slideLayout1.xml', '<p:sldLayout><p:cSld><p:spTree>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="2286000"/><a:ext cx="7315200" cy="3429000"/></a:xfrm></p:spPr></p:sp>'
    + '</p:spTree></p:cSld></p:sldLayout>');
  zip.file('ppt/slides/slide7.xml', '<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="vi-VN"/><a:t>Kế hoạch &amp; mục tiêu</a:t></a:r></a:p></p:txBody></p:sp>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="3" name="B"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr><a:normAutofit fontScale="50000"/></a:bodyPr><a:p><a:r><a:t>Mục một</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:t>Mục con</a:t></a:r></a:p><a:p><a:pPr><a:buNone/></a:pPr><a:r><a:t>Không dấu</a:t></a:r><a:br/><a:r><a:t>xuống dòng</a:t></a:r></a:p></p:txBody></p:sp>'
    + '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="4" name="G"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="4572000" y="3429000"/><a:ext cx="2286000" cy="1714500"/><a:chOff x="0" y="0"/><a:chExt cx="4572000" cy="3429000"/></a:xfrm></p:grpSpPr>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="5" name="E"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="1"><a:off x="0" y="0"/><a:ext cx="2286000" cy="1714500"/></a:xfrm><a:prstGeom prst="ellipse"/></p:spPr><p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style><p:txBody><a:bodyPr/><a:p><a:r><a:t>Tròn</a:t></a:r></a:p></p:txBody></p:sp>'
    + '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="6" name="C"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm flipV="1"><a:off x="2286000" y="1714500"/><a:ext cx="2286000" cy="1714500"/></a:xfrm><a:prstGeom prst="straightConnector1"/><a:ln w="25400"><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>'
    + '</p:grpSp>'
    + '</p:spTree></p:cSld><p:transition spd="slow"><p:wheel spokes="4"/></p:transition></p:sld>');

  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  const presentation = await importFromPptx(buffer, 'mau.pptx');
  assert.equal(presentation.aspectRatio, '4:3');
  const [slide] = presentation.slides;
  assert.equal(slide.background.value.toUpperCase(), '#19334D');
  assert.equal(slide.transition.type, 'clock');

  const bar = slide.elements[0];
  assert.equal(bar.fill?.toUpperCase(), '#AA0000');
  near(bar.y, 93.33);
  assert.ok(!slide.elements.some((el) => el.text === 'Mẫu tiêu đề'));

  const title = slide.elements.find((el) => el.isTitle);
  assert.equal(title?.text, 'Kế hoạch & mục tiêu');
  near(title?.x, 10);
  near(title?.y, 10);
  near(title?.width, 80);
  near(title?.fontSize, 44);
  assert.equal(title?.fontWeight, 'bold');
  assert.equal(title?.textAlign, 'center');
  assert.equal(title?.verticalAlign, 'bottom');
  assert.equal(title?.color, '#111111');
  assert.match(title?.fontFamily ?? '', /Georgia/);

  const body = slide.elements.find((el) => el.text?.startsWith('• Mục một'));
  assert.equal(body?.text, '• Mục một\n  • Mục con\nKhông dấu\nxuống dòng');
  near(body?.y, 33.33);
  near(body?.fontSize, 14);
  assert.match(body?.fontFamily ?? '', /Verdana/);

  const ellipse = slide.elements.find((el) => el.shapeType === 'circle');
  assert.ok(ellipse);
  near(ellipse.x, 50);
  near(ellipse.y, 50);
  near(ellipse.width, 12.5);
  near(ellipse.height, 12.5);
  assert.equal(ellipse.fill?.toUpperCase(), '#336699');
  assert.equal(ellipse.stroke?.toUpperCase(), '#1A334D');
  assert.equal(ellipse.flipH, true);
  assert.equal(ellipse.text, 'Tròn');
  assert.equal(ellipse.color?.toUpperCase(), '#FFFFFF');
  assert.equal(ellipse.textAlign, 'center');

  const connector = slide.elements.find((el) => el.shapeType === 'arrow-line');
  assert.ok(connector);
  assert.equal(connector.groupId, ellipse.groupId);
  assert.ok(connector.groupId);
  assert.equal(connector.stroke?.toUpperCase(), '#00FF00');
  near(connector.rotation, 323.1, 0.2);
  near(connector.x + connector.width / 2, 68.75, 0.3);
  near(connector.y + connector.height / 2, 68.75, 0.3);
});

test('custom geometry arcs become bezier curves and a broken file falls back to a title slide', async () => {
  const xml = parseXml('<a:custGeom><a:pathLst><a:path w="200" h="100"><a:moveTo><a:pt x="0" y="50"/></a:moveTo><a:arcTo wR="100" hR="50" stAng="10800000" swAng="10800000"/><a:lnTo><a:pt x="100" y="100"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>');
  const d = customGeometryPath(descendants(xml, 'a:custGeom')[0]);
  assert.ok(d);
  assert.match(d, /^M0 50C/);
  assert.match(d, /100 50L50 100Z$/);
  assert.equal((d.match(/C/g) ?? []).length, 2);
  assert.match(d, /C[-\d. ]+ 50 0C/);

  const empty = new JSZip();
  empty.file('readme.txt', 'x');
  const presentation = await importFromPptx(await empty.generateAsync({ type: 'arraybuffer' }), 'Trống.pptx');
  assert.equal(presentation.slides.length, 1);
  assert.ok(presentation.slides[0].elements.length > 0);
});

test('bullet lines export as real bullets and transitions as valid slide xml', () => {
  const runs = textRuns('• Một\n  • Hai\nBa');
  assert.equal(runs.length, 3);
  assert.equal(runs[0].text, 'Một');
  assert.ok(runs[0].options?.bullet);
  assert.equal(runs[1].options?.indentLevel, 1);
  assert.equal(runs[2].options?.bullet, undefined);
  assert.equal(runs[2].options?.breakLine, false);

  assert.equal(transitionXml({ type: 'none', duration: 0.5 }), '');
  assert.equal(transitionXml({ type: 'push', duration: 0.5, direction: 'from-right' }), '<p:transition spd="fast"><p:push dir="l"/></p:transition>');
  assert.match(transitionXml({ type: 'origami', duration: 1.2 }), /^<p:transition spd="slow"><p:fade\/><\/p:transition>$/);
  const extended = transitionXml({ type: 'honeycomb', duration: 2, advanceOnClick: false });
  assert.match(extended, /<mc:Choice[^>]*Requires="p14"><p:transition spd="slow" advClick="0" p14:dur="2000"><p14:honeycomb\/>/);
  assert.match(extended, /<mc:Fallback><p:transition[^>]*><p:fade\/><\/p:transition><\/mc:Fallback>/);
});
