import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDrawingObjects } from '../src/lib/formButtons';
import { parseSqref, readDataValidations, readDefinedNames } from '../src/lib/xlsxExtras';
import { r1c1ToA1 } from '../src/editors/sheet/vba/vbaExcel';

describe('readDefinedNames', () => {
  const xml = `<definedNames>
    <definedName name="_xlnm.Print_Area" localSheetId="0">Bia!$A$1:$K$40</definedName>
    <definedName name="DanhMuc">'Danh muc'!$B$2:$B$90</definedName>
    <definedName name="Thue" localSheetId="1" hidden="1">0.08</definedName>
    <definedName name="Hong">#REF!$A$1</definedName>
  </definedNames>`;

  it('keeps user names and skips built-in or broken ones', () => {
    const names = Object.values(readDefinedNames(xml, ['s1', 's2']));
    assert.deepEqual(names.map((entry) => entry.name), ['DanhMuc', 'Thue']);
    assert.equal(names[0].formulaOrRefString, "'Danh muc'!$B$2:$B$90");
    assert.equal(names[1].formulaOrRefString, '=0.08');
    assert.equal(names[1].localSheetId, 's2');
    assert.equal(names[1].hidden, true);
  });
});

describe('readDataValidations', () => {
  it('clips ranges to the sheet size', () => {
    assert.deepEqual(parseSqref('B2:B1000 Z5', 10, 5), [{ startRow: 1, endRow: 9, startColumn: 1, endColumn: 1 }]);
  });

  it('reads list and whole-number rules', () => {
    const xml = `<dataValidations>
      <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="C3"><formula1>"Có,Không"</formula1></dataValidation>
      <dataValidation type="list" sqref="D3:D5"><formula1>DanhMuc</formula1></dataValidation>
      <dataValidation type="whole" operator="greaterThan" sqref="E3"><formula1>0</formula1></dataValidation>
      <dataValidation type="unknown" sqref="F3"/>
    </dataValidations>`;
    const rules = readDataValidations(xml, 100, 26, 'dv');
    assert.equal(rules.length, 3);
    assert.equal(rules[0].formula1, 'Có,Không');
    assert.equal(rules[0].allowBlank, true);
    assert.equal(rules[1].formula1, '=DanhMuc');
    assert.equal(rules[2].operator, 'greaterThan');
    assert.equal(rules[2].formula1, '0');
  });
});

describe('parseDrawingObjects', () => {
  it('skips form-control twins and reads a picture anchor', () => {
    const xml = `<xdr:wsDr>
      <xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
        <xdr:to><xdr:col>3</xdr:col><xdr:colOff>9525</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:to>
        <xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>
      <xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
        <xdr:to><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
        <xdr:sp><xdr:nvSpPr><xdr:cNvPr id="3" name="Button 1"/></xdr:nvSpPr><a14:compatExt spid="_x0000_s1025"/></xdr:sp></xdr:twoCellAnchor>
    </xdr:wsDr>`;
    const objects = parseDrawingObjects(xml, { rId1: 'img-1' });
    assert.equal(objects.length, 1);
    assert.equal(objects[0].kind, 'picture');
    assert.equal(objects[0].name, 'Logo');
    assert.equal(objects[0].image, 'img-1');
    assert.deepEqual(objects[0].from, { column: 1, columnOffset: 0, row: 2, rowOffset: 0 });
    assert.deepEqual(objects[0].to, { column: 3, columnOffset: 1, row: 5, rowOffset: 2 });
  });
});

describe('r1c1ToA1', () => {
  it('converts relative and absolute references from the target cell', () => {
    assert.equal(r1c1ToA1('=LEFT(RC[7],7)', 12, 2), '=LEFT(J13,7)');
    assert.equal(r1c1ToA1('=+R[13]C[-4]', 12, 7), '=+D26');
    assert.equal(r1c1ToA1('=R1C1+R[-1]C', 4, 1), '=$A$1+B4');
  });

  it('leaves text literals and function names alone', () => {
    assert.equal(r1c1ToA1('=IF(RC[1]="RC","RC",PERCENTILE(R1C1:R3C1,0.5))', 0, 0), '=IF(B1="RC","RC",PERCENTILE($A$1:$A$3,0.5))');
  });
});
