import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseWorkbook } from '../src/lib/workbookDoctor';
import type { WorkbookData } from '../src/lib/sheetTypes';

const book = (): WorkbookData => ({
  id: 'w', name: 'Sổ', appVersion: '1', locale: 'viVN', sheetOrder: ['s1'],
  styles: { used: { bl: 1 }, ghost: { bg: { rgb: '#ff0' } }, orphan: { it: 1 } },
  sheets: {
    s1: {
      id: 's1', name: 'Trang 1', rowCount: 1000, columnCount: 26, rowData: {}, columnData: {},
      cellData: {
        0: { 0: { v: 'Tên', s: 'used' }, 1: { v: 'Tiền' } },
        1: { 0: { v: 'A' }, 1: { v: '#DIV/0!', f: '=1/0' }, 2: { s: 'used' } },
        2: { 1: { s: 'ghost' } },
        500: { 20: { s: 'ghost' } },
      },
      mergeData: [
        { startRow: 0, endRow: 0, startColumn: 3, endColumn: 4 },
        { startRow: 600, endRow: 601, startColumn: 0, endColumn: 1 },
      ],
    },
  },
});

describe('workbookDoctor', () => {
  it('finds ghost formatting, empty merges, unused styles and error cells', () => {
    const { health, cleaned } = diagnoseWorkbook(book());
    const sheet = health.sheets[0];
    assert.equal(sheet.dataRows, 2);
    assert.equal(sheet.dataColumns, 2);
    assert.equal(sheet.ghostCells, 3);
    assert.equal(sheet.emptyMerges, 2);
    assert.deepEqual(sheet.errorCells, ['B2']);
    assert.equal(health.unusedStyles, 2);
    assert.ok(health.bytesAfter < health.bytesBefore);
    assert.equal(cleaned.sheets.s1.cellData[500], undefined);
    assert.equal(cleaned.sheets.s1.cellData[1][2], undefined);
    assert.deepEqual(cleaned.sheets.s1.cellData[0][0], { v: 'Tên', s: 'used' });
    assert.equal(cleaned.sheets.s1.mergeData.length, 0);
    assert.deepEqual(Object.keys(cleaned.styles), ['used']);
  });

  it('leaves a clean workbook untouched', () => {
    const { health } = diagnoseWorkbook(diagnoseWorkbook(book()).cleaned);
    assert.equal(health.totalGhostCells, 0);
    assert.equal(health.unusedStyles, 0);
    assert.equal(health.totalEmptyMerges, 0);
  });
});
