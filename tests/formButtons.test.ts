import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
import { parseVmlButtons, readFormButtons, resolveButtonMacro, sanitizeFormButtons } from '../src/lib/formButtons';

const shape = (id: string, body: string, attributes = '') => `<v:shape id="${id}" o:spid="_x0000_s${id}" type="#_x0000_t201" ${attributes}>${body}</v:shape>`;

const BUTTON = shape('3079', `
  <v:textbox><div style='text-align:center'><font face="Segoe UI" size="200" color="#000000"><b>Tạo phiếu
  mới &amp; in</b></font></div></v:textbox>
  <x:ClientData ObjectType="Button">
   <x:Anchor>
    10, 5, 0, 7, 12, 93, 0, 51</x:Anchor>
   <x:FmlaMacro>btnPhieuNhap_XoaPhieuCapSoMoi</x:FmlaMacro>
  </x:ClientData>`);

const NOTE = shape('1025', '<v:textbox><div>Ghi chú</div></v:textbox><x:ClientData ObjectType="Note"><x:Anchor>1, 15, 0, 2, 3, 15, 3, 16</x:Anchor></x:ClientData>');
const NO_MACRO = shape('3080', '<v:textbox><div>Trống</div></v:textbox><x:ClientData ObjectType="Button"><x:Anchor>1, 0, 1, 0, 2, 0, 2, 0</x:Anchor></x:ClientData>');
const HIDDEN = shape('3081', '<v:textbox><div>Ẩn</div></v:textbox><x:ClientData ObjectType="Button"><x:Anchor>1, 0, 1, 0, 2, 0, 2, 0</x:Anchor><x:FmlaMacro>An</x:FmlaMacro></x:ClientData>', "style='visibility:hidden'");

describe('parseVmlButtons', () => {
  it('reads label, macro, anchor and font of a form control button', () => {
    assert.deepEqual(parseVmlButtons(`<xml>${BUTTON}</xml>`), [
      {
        id: '_x0000_s3079',
        label: 'Tạo phiếu mới & in',
        macro: 'btnPhieuNhap_XoaPhieuCapSoMoi',
        from: { row: 0, column: 10, rowOffset: 7, columnOffset: 5 },
        to: { row: 0, column: 12, rowOffset: 51, columnOffset: 93 },
        bold: true,
        fontSize: 10,
      },
    ]);
  });

  it('skips comments, buttons without a macro and hidden buttons', () => {
    assert.deepEqual(parseVmlButtons(`<xml>${NOTE}${NO_MACRO}${HIDDEN}${BUTTON}</xml>`).map((button) => button.id), ['_x0000_s3079']);
  });
});

describe('readFormButtons', () => {
  it('follows each sheet relationship to its VML drawing', async () => {
    const zip = new JSZip();
    zip.file('xl/worksheets/_rels/sheet2.xml.rels', '<Relationships><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/></Relationships>');
    zip.file('xl/drawings/vmlDrawing1.vml', `<xml>${BUTTON}</xml>`);
    const result = await readFormButtons(zip, ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']);
    assert.deepEqual(result.map((list) => list.length), [0, 1]);
  });
});

describe('resolveButtonMacro', () => {
  const ids = ['Module1.TimViTri', 'modNut.btnPhieuNhap_Luu', 'Sheet5.btnPhieuNhap_Luu'];
  it('matches by procedure name regardless of case', () => {
    assert.equal(resolveButtonMacro('BTNPHIEUNHAP_LUU', ids), 'modNut.btnPhieuNhap_Luu');
  });
  it('honours a module prefix and drops a workbook prefix', () => {
    assert.equal(resolveButtonMacro("'Xuất nhập.xlsm'!Sheet5.btnPhieuNhap_Luu", ids), 'Sheet5.btnPhieuNhap_Luu');
    assert.equal(resolveButtonMacro('[0]!TimViTri', ids), 'Module1.TimViTri');
  });
  it('returns null for an unknown macro', () => {
    assert.equal(resolveButtonMacro('KhongCo', ids), null);
  });
});

describe('sanitizeFormButtons', () => {
  it('keeps valid buttons and drops malformed entries', () => {
    const [button] = parseVmlButtons(`<xml>${BUTTON}</xml>`);
    assert.deepEqual(sanitizeFormButtons({ a: [button, { id: 1 }], b: 'x', c: [] }), { a: [button] });
    assert.deepEqual(sanitizeFormButtons(null), {});
  });
});

describe('indexed fill colours', () => {
  it('reads palette index 41 as light turquoise instead of the system foreground', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const { readSpreadsheet } = await import('../src/lib/xlsxCodec');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('A').getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123456' } };
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const styles = await zip.file('xl/styles.xml')!.async('string');
    const patched = styles.replace('<fgColor rgb="FF123456"/>', '<fgColor indexed="41"/><bgColor indexed="64"/>');
    assert.notEqual(patched, styles);
    zip.file('xl/styles.xml', patched);
    const data = await readSpreadsheet(await zip.generateAsync({ type: 'arraybuffer' }), 'a.xlsx');
    const cell = data.sheets[data.sheetOrder[0]].cellData[0][0];
    const style = typeof cell.s === 'string' ? data.styles[cell.s] : cell.s;
    assert.equal(style?.bg?.rgb?.toUpperCase(), '#CCFFFF');
  });
});
