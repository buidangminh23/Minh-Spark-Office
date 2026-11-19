import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { repairEngineXlsx, repairStylesXml, repairWorkbookXml } from '../src/lib/xlsxEngineRepair';

const NAMES = '<definedNames><definedName localSheetId="0" name="_xlnm.Print_Area">Bia!$B$1:$O$36</definedName><definedName function="false" hidden="false" name="_xlfn_IFERROR" vbProcedure="false"></definedName><definedName name="Empty"/></definedNames>';

test('repairWorkbookXml drops defined names without a formula and keeps the others', () => {
  const repaired = repairWorkbookXml(`<workbook><sheets/>${NAMES}<calcPr/></workbook>`);
  assert.equal(repaired, '<workbook><sheets/><definedNames><definedName localSheetId="0" name="_xlnm.Print_Area">Bia!$B$1:$O$36</definedName></definedNames><calcPr/></workbook>');
  assert.equal(repairWorkbookXml('<workbook><definedNames><definedName name="A"></definedName></definedNames><calcPr/></workbook>'), '<workbook><calcPr/></workbook>');
});

test('repairStylesXml gives unnamed fonts the first named font', () => {
  const styles = '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><sz val="12"/><name val=""/><family val="1"/></font></fonts>';
  assert.equal(repairStylesXml(styles), styles.replace('<name val=""/>', '<name val="Arial"/>'));
  assert.equal(repairStylesXml('<fonts><font><name val=""/></font></fonts>'), '<fonts><font><name val="Calibri"/></font></fonts>');
});

test('repairEngineXlsx rewrites only broken packages', async () => {
  const build = async (workbook: string) => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', workbook);
    zip.file('xl/styles.xml', '<styleSheet><fonts><font><name val="Arial"/></font></fonts></styleSheet>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>');
    return zip.generateAsync({ type: 'uint8array' }) as Promise<Uint8Array<ArrayBuffer>>;
  };
  const healthy = await build('<workbook><sheets/></workbook>');
  assert.equal(await repairEngineXlsx(healthy), healthy);
  const repaired = await JSZip.loadAsync(await repairEngineXlsx(await build(`<workbook><sheets/>${NAMES}</workbook>`)));
  assert.doesNotMatch(await repaired.file('xl/workbook.xml')!.async('string'), /_xlfn_IFERROR|name="Empty"/);
  assert.equal(await repaired.file('xl/worksheets/sheet1.xml')!.async('string'), '<worksheet><sheetData/></worksheet>');
});
