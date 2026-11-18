import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { importFromPptx } from '../src/lib/pptxImport.ts';
import { buildPptxFile } from '../src/lib/pptxExport.ts';
import { resizeTable, tableCellStyle, tableFractions, updateTableHeader } from '../src/lib/slideTable.ts';

test('table grids, direct cell formatting and theme bands survive opening and saving', async () => {
  const zip = new JSZip();
  const fill = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
  const band = (name: string, color: string) => `<a:${name}><a:tcStyle><a:fill>${fill(color)}</a:fill></a:tcStyle></a:${name}>`;
  zip.file('ppt/tableStyles.xml', `<a:tblStyleLst def="sample"><a:tblStyle styleId="sample">
    <a:wholeTbl><a:tcTxStyle><a:schemeClr val="tx1"/></a:tcTxStyle></a:wholeTbl>
    <a:firstRow><a:tcTxStyle b="on"><a:srgbClr val="FFFFFF"/></a:tcTxStyle><a:tcStyle><a:fill>${fill('123456')}</a:fill></a:tcStyle></a:firstRow>
    ${band('band1H', 'EEEEEE')}${band('band2H', 'CCCCCC')}</a:tblStyle></a:tblStyleLst>`);
  const tc = (run = '', props = '') => `<a:tc><a:txBody><a:p><a:r><a:rPr ${run ? 'b="1" sz="1500"' : ''}>${run}</a:rPr><a:t>Cell</a:t></a:r></a:p></a:txBody><a:tcPr>${props}</a:tcPr></a:tc>`;
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('ppt/slides/slide1.xml', `<p:sld><p:cSld><p:spTree><p:graphicFrame><p:xfrm><a:off x="0" y="0"/><a:ext cx="6858000" cy="3429000"/></p:xfrm>
    <a:graphic><a:graphicData><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid><a:gridCol w="1714500"/><a:gridCol w="5143500"/></a:tblGrid>
    <a:tr h="857250">${tc()}${tc()}</a:tr><a:tr h="1714500">${tc(fill('224466'), fill('AAFFCC'))}${tc()}</a:tr>
    <a:tr h="857250">${tc()}${tc()}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`);
  const presentation = await importFromPptx(await zip.generateAsync({ type: 'arraybuffer' }), 'Table.pptx');
  const table = presentation.slides[0].elements[0];
  const saved = await buildPptxFile(presentation);
  const reopened = (await importFromPptx(Uint8Array.from(saved).buffer, 'Table.pptx')).slides[0].elements[0];
  for (const el of [table, reopened]) {
    const widths = tableFractions(el.tableColumnWidths, 2)!;
    assert.ok(Math.abs(widths[0] - 0.25) < 0.001);
    const heights = tableFractions(el.tableRowHeights, 3)!;
    assert.ok(Math.abs(heights[1] - 0.5) < 0.001);
    assert.equal(el.tableHeaderRow, true);
    assert.equal(tableCellStyle(el, 0, 0).fill, '#123456');
    assert.equal(tableCellStyle(el, 0, 0).bold, true);
    assert.equal(tableCellStyle(el, 1, 0).fill, '#AAFFCC');
    assert.equal(tableCellStyle(el, 1, 0).color, '#224466');
    assert.equal(tableCellStyle(el, 1, 0).bold, true);
    assert.equal(tableCellStyle(el, 1, 0).fontSize, 15);
    assert.equal(tableCellStyle(el, 1, 1).fill, '#EEEEEE');
    assert.equal(tableCellStyle(el, 2, 1).fill, '#CCCCCC');
  }
  const recolored = { ...table, ...updateTableHeader(table, { tableHeaderColor: '#ABCDEF' }) };
  assert.equal(tableCellStyle(recolored, 0, 1).fill, '#ABCDEF');
  assert.equal(tableCellStyle(recolored, 1, 0).fill, '#AAFFCC');
  const resized = resizeTable(table, [['A'], ['B'], ['C'], ['D']]);
  assert.equal(resized.tableCellStyles?.[3][0].fill, '#AAFFCC');
  assert.equal(resized.tableColumnWidths?.length, 1);
  assert.equal(resized.tableRowHeights?.length, 4);
});
