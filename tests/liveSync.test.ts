import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Y from 'yjs';
import { diffFlat, readFlat, writeFlat } from '../src/lib/live/flatSync';
import { flattenWorkbook, onlyCellChanges, parseCellKey, unflattenWorkbook } from '../src/lib/live/sheetSync';
import { flattenPresentation, unflattenPresentation } from '../src/lib/live/slideSync';
import type { SheetContent, SlideContent } from '../src/lib/storage';

const workbook = (): SheetContent => ({
  kind: 'sheet',
  comments: [],
  workbook: {
    id: 'wb', name: 'Bảng', appVersion: '1', locale: 'viVN',
    styles: { s1: { bl: 1 } },
    sheetOrder: ['a', 'b'],
    sheets: {
      a: { id: 'a', name: 'Sheet1', rowCount: 100, columnCount: 20, cellData: { 0: { 0: { v: 'Tên', s: 's1' }, 1: { v: 2, t: 2 } }, 3: { 2: { f: '=B1*2', v: 4 } } }, rowData: {}, columnData: { 1: { w: 120 } }, mergeData: [], zoomRatio: 1.5 },
      b: { id: 'b', name: 'Sheet2', rowCount: 100, columnCount: 20, cellData: {}, rowData: {}, columnData: {}, mergeData: [] },
    },
  },
});

const deck = (): SlideContent => ({
  kind: 'slide',
  comments: [],
  presentation: {
    aspectRatio: '16:9', themeId: 'default',
    slides: [
      { id: 's1', layout: 'title', background: { type: 'solid', value: '#fff' }, notes: '', transition: { type: 'none' }, elements: [{ id: 'e1', type: 'text', x: 1, y: 2, width: 3, height: 4, content: 'A' }, { id: 'e2', type: 'text', x: 5, y: 6, width: 7, height: 8, content: 'B' }] },
      { id: 's2', layout: 'blank', background: { type: 'solid', value: '#000' }, notes: 'n', transition: { type: 'none' }, elements: [] },
    ],
  },
} as unknown as SlideContent);

describe('flat sync', () => {
  it('diffs set and removed keys', () => {
    const before = new Map([['a', '1'], ['b', '2']]);
    const after = new Map([['a', '1'], ['b', '3'], ['c', '4']]);
    assert.deepEqual(diffFlat(before, after), { set: [['b', '3'], ['c', '4']], removed: [] });
    assert.deepEqual(diffFlat(after, before), { set: [['b', '2']], removed: ['c'] });
  });

  it('writes only what changed and reaches the other replica', () => {
    const one = new Y.Doc();
    const two = new Y.Doc();
    one.on('update', (update: Uint8Array) => Y.applyUpdate(two, update));
    const map = one.getMap('m');
    assert.equal(writeFlat(map, new Map([['a', '1'], ['b', '2']])), 2);
    assert.equal(writeFlat(map, new Map([['a', '1'], ['b', '2']])), 0);
    assert.equal(writeFlat(map, new Map([['a', '9']])), 2);
    assert.deepEqual([...readFlat(two.getMap('m'))], [['a', '9']]);
  });
});

describe('sheet sync', () => {
  it('round-trips a workbook without view-only fields', () => {
    const content = workbook();
    const back = unflattenWorkbook(flattenWorkbook(content.workbook, { comments: [] }));
    assert.ok(back);
    assert.deepEqual(back.workbook.sheetOrder, ['a', 'b']);
    assert.deepEqual(back.workbook.sheets.a.cellData[3][2], { f: '=B1*2', v: 4 });
    assert.equal(back.workbook.sheets.a.columnData[1].w, 120);
    assert.equal(back.workbook.sheets.a.zoomRatio, undefined);
    assert.deepEqual(back.workbook.styles, { s1: { bl: 1 } });
  });

  it('parses cell keys with colons in the sheet id', () => {
    assert.deepEqual(parseCellKey('c:x:y:12:3'), { sheetId: 'x:y', row: 12, column: 3 });
    assert.equal(parseCellKey('sh:a'), null);
  });

  it('treats cell and style edits as cell-only and the rest as structural', () => {
    assert.deepEqual(onlyCellChanges(['c:a:0:1', 'st:s2']), [{ sheetId: 'a', row: 0, column: 1 }]);
    assert.equal(onlyCellChanges(['c:a:0:1', 'sh:a']), null);
  });

  it('merges concurrent edits to different cells', () => {
    const one = new Y.Doc();
    const two = new Y.Doc();
    writeFlat(one.getMap('m'), flattenWorkbook(workbook().workbook));
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    const left = workbook().workbook;
    left.sheets.a.cellData[0][1] = { v: 10, t: 2 };
    const right = workbook().workbook;
    right.sheets.b.cellData[5] = { 5: { v: 'x' } };
    writeFlat(one.getMap('m'), flattenWorkbook(left));
    writeFlat(two.getMap('m'), flattenWorkbook(right));
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    Y.applyUpdate(one, Y.encodeStateAsUpdate(two));
    const merged = unflattenWorkbook(readFlat(one.getMap('m')))!;
    assert.deepEqual(readFlat(one.getMap('m')), readFlat(two.getMap('m')));
    assert.deepEqual(merged.workbook.sheets.b.cellData[5][5], { v: 'x' });
    assert.ok(merged.workbook.sheets.a.cellData[0][1]);
  });
});

describe('slide sync', () => {
  it('round-trips slides and element order', () => {
    const content = deck();
    const back = unflattenPresentation(flattenPresentation(content))!;
    assert.deepEqual(back.presentation, content.presentation);
  });

  it('keeps both elements when two people add one to the same slide', () => {
    const one = new Y.Doc();
    const two = new Y.Doc();
    writeFlat(one.getMap('m'), flattenPresentation(deck()));
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    const left = deck();
    left.presentation.slides[0].elements.push({ ...left.presentation.slides[0].elements[0], id: 'l' });
    const right = deck();
    right.presentation.slides[0].elements.push({ ...right.presentation.slides[0].elements[0], id: 'r' });
    writeFlat(one.getMap('m'), flattenPresentation(left));
    writeFlat(two.getMap('m'), flattenPresentation(right));
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one));
    Y.applyUpdate(one, Y.encodeStateAsUpdate(two));
    const ids = unflattenPresentation(readFlat(one.getMap('m')))!.presentation.slides[0].elements.map((element) => element.id);
    assert.ok(ids.includes('l') && ids.includes('r'));
    assert.deepEqual(readFlat(one.getMap('m')), readFlat(two.getMap('m')));
  });
});
