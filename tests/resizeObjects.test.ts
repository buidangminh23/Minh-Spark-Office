import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { EditorState } from '@tiptap/pm/state';
import { HANDLE_HIT, applyColumnWidths, handleInsets, isCornerHandle, scaleColumns, scaledWidth, TableTools } from '../src/editors/doc/resizeObjects';

const schema = getSchema([StarterKit, Table, TableRow, TableHeader, TableCell, TableTools]);

const cell = (text: string, attrs: Record<string, unknown> = {}) => ({ type: 'tableCell', attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

test('only corner handles keep the aspect ratio', () => {
  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) assert.equal(isCornerHandle(corner), true);
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.equal(isCornerHandle(edge), false);
});

test('small objects push handles outward so hit areas stay 24px apart', () => {
  const flag = handleInsets(24, 16);
  assert.equal(flag.padX, 0);
  assert.equal(flag.padY, 4);
  assert.equal(16 + 2 * flag.padY, HANDLE_HIT);
  assert.equal(flag.narrow, true);
  assert.equal(flag.short, true);
  const photo = handleInsets(320, 200);
  assert.deepEqual(photo, { padX: 0, padY: 0, narrow: false, short: false });
});

test('centered objects grow on both sides so the dragged edge follows the pointer', () => {
  assert.equal(scaledWidth(300, 50, 'right', false), 350);
  assert.equal(scaledWidth(300, 50, 'right', true), 400);
  assert.equal(scaledWidth(300, -50, 'left', false), 350);
  assert.equal(scaledWidth(300, -50, 'bottom-left', true), 400);
});

test('table width scales every column proportionally with a floor', () => {
  assert.deepEqual(scaleColumns([100, 200, 100], 800), [200, 400, 200]);
  assert.deepEqual(scaleColumns([100, 100], 10), [24, 24]);
});

test('column widths are written onto every cell, respecting colspan', () => {
  const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [cell('A', { colspan: 2 }), cell('B')] },
    { type: 'tableRow', content: [cell('C'), cell('D'), cell('E')] },
  ] }] });
  const state = EditorState.create({ schema, doc });
  const tr = applyColumnWidths(state.tr, 0, doc.child(0), [120, 80, 200]);
  const table = tr.doc.child(0);
  assert.deepEqual(table.child(0).child(0).attrs.colwidth, [120, 80]);
  assert.deepEqual(table.child(0).child(1).attrs.colwidth, [200]);
  assert.deepEqual(table.child(1).child(2).attrs.colwidth, [200]);
});

test('row height round-trips through HTML', () => {
  const row = schema.nodes.tableRow.create({ rowHeight: 48 }, [schema.nodes.tableCell.createAndFill()!]);
  assert.equal(row.attrs.rowHeight, 48);
  const spec = schema.nodes.tableRow.spec.toDOM?.(row) as [string, Record<string, string>];
  assert.match(String(spec[1].style), /height: 48px/);
});
