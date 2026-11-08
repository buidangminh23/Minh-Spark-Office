import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { columnLetter, diffSheets, snapshotSheet } from '../src/lib/sheetDiff';
import type { SheetData } from '../src/lib/sheetTypes';

const sheet = (name: string, cellData: SheetData['cellData']): SheetData => ({ id: name, name, rowCount: 100, columnCount: 26, cellData, rowData: {}, columnData: {}, mergeData: [] });

describe('sheetDiff', () => {
  it('names columns like a spreadsheet', () => {
    assert.equal(columnLetter(0), 'A');
    assert.equal(columnLetter(25), 'Z');
    assert.equal(columnLetter(26), 'AA');
    assert.equal(columnLetter(701), 'ZZ');
  });

  it('reports modified, added, deleted and formula-only changes cell by cell', () => {
    const before = snapshotSheet(sheet('T1', { 0: { 0: { v: 'Tên' }, 1: { v: 'Tiền' } }, 1: { 0: { v: 'A' }, 1: { v: 100 } }, 2: { 0: { v: 'B' }, 1: { v: 5, f: '=2+3' } }, 3: { 0: { v: 'C' } } }));
    const after = snapshotSheet(sheet('T2', { 0: { 0: { v: 'Tên' }, 1: { v: 'Tiền' } }, 1: { 0: { v: 'A' }, 1: { v: 120 } }, 2: { 0: { v: 'B' }, 1: { v: 5, f: '=1+4' } }, 4: { 2: { v: 'mới' } } }));
    const changes = diffSheets(before, after);
    const at = (r: number, c: number) => changes.find((x) => x.row === r && x.col === c);
    assert.equal(changes.length, 4);
    assert.deepEqual([at(1, 1)?.kind, at(1, 1)?.before, at(1, 1)?.after], ['modified', 100, 120]);
    assert.deepEqual([at(2, 1)?.kind, at(2, 1)?.beforeFormula, at(2, 1)?.afterFormula], ['modified', '=2+3', '=1+4']);
    assert.equal(at(3, 0)?.kind, 'deleted');
    assert.equal(at(4, 2)?.kind, 'added');
  });

  it('treats empty strings and missing cells as equal and reads rich text', () => {
    const before = snapshotSheet(sheet('A', { 0: { 0: { v: '' }, 1: { p: { body: { dataStream: 'Ghi chú\r\n' } } } } }));
    const after = snapshotSheet(sheet('B', { 0: { 1: { v: 'Ghi chú' } } }));
    assert.deepEqual(diffSheets(before, after), []);
  });
});
