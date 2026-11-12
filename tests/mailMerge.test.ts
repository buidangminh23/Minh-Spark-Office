import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JSONContent } from '@tiptap/react';
import { activeRecords, addressLines, buildEml, checkMerge, findRecords, greetingText, guessFieldMap, renderAll, testCondition, type MergeSource } from '../src/editors/doc/mailMerge';

const headers = ['Danh xưng', 'Họ và tên', 'Công ty', 'Địa chỉ', 'Quận', 'Tỉnh', 'Quốc gia', 'Email', 'Số tiền'];
const rows = [
  { 'Danh xưng': 'Ông', 'Họ và tên': 'Nguyễn Văn A', 'Công ty': 'Cty X', 'Địa chỉ': 'Số 1 Tràng Tiền', Quận: 'Hoàn Kiếm', Tỉnh: 'Hà Nội', 'Quốc gia': 'Việt Nam', Email: 'a@x.vn', 'Số tiền': '1.200.000' },
  { 'Danh xưng': 'Bà', 'Họ và tên': 'Trần Thị B', 'Công ty': '', 'Địa chỉ': '10 Main St', Quận: '', Tỉnh: 'Sydney', 'Quốc gia': 'Australia', Email: 'sai-email', 'Số tiền': '900' },
  { 'Danh xưng': '', 'Họ và tên': '', 'Công ty': '', 'Địa chỉ': '', Quận: '', Tỉnh: '', 'Quốc gia': '', Email: 'c@x.vn', 'Số tiền': '0' },
];
const source: MergeSource = { headers, rows, fieldMap: guessFieldMap(headers) };

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const block = (kind: string, options: object = {}): JSONContent => ({ type: 'mergeBlock', attrs: { kind, options: JSON.stringify(options) } });
const textOf = (node: JSONContent): string => (node.text ?? '') + (node.type === 'hardBreak' ? '\n' : '') + (node.content ?? []).map(textOf).join('');

test('guessFieldMap matches Vietnamese headers', () => {
  assert.equal(source.fieldMap?.fullName, 'Họ và tên');
  assert.equal(source.fieldMap?.title, 'Danh xưng');
  assert.equal(source.fieldMap?.email, 'Email');
  assert.equal(source.fieldMap?.district, 'Quận');
});

test('addressLines hides the home country and keeps foreign ones', () => {
  assert.deepEqual(addressLines(source, rows[0]), ['Ông Nguyễn Văn A', 'Cty X', 'Số 1 Tràng Tiền', 'Hoàn Kiếm, Hà Nội']);
  assert.deepEqual(addressLines(source, rows[1]), ['Bà Trần Thị B', '10 Main St', 'Sydney', 'Australia']);
});

test('greetingText falls back when the record has no name', () => {
  assert.equal(greetingText(source, rows[0]), 'Kính gửi Ông Nguyễn Văn A,');
  assert.equal(greetingText(source, rows[2]), 'Kính gửi Quý khách,');
});

test('testCondition compares Vietnamese-formatted numbers numerically', () => {
  assert.equal(testCondition(rows[0], { field: 'Số tiền', op: 'gt', value: '1000000' }), true);
  assert.equal(testCondition(rows[1], { field: 'Số tiền', op: 'gt', value: '1000000' }), false);
  assert.equal(testCondition(rows[1], { field: 'Công ty', op: 'empty', value: '' }), true);
  assert.equal(testCondition(rows[0], { field: 'Tỉnh', op: 'contains', value: 'ha noi' }), true);
});

test('renderAll applies If, Skip Record If and excluded records', () => {
  const template = doc(
    { type: 'mergeField', attrs: { name: 'Họ và tên' } },
    { type: 'text', text: ' ' },
    block('if', { field: 'Số tiền', op: 'gt', value: '1000', then: 'VIP', otherwise: 'Thường' }),
    block('skipif', { field: 'Họ và tên', op: 'empty', value: '' }),
  );
  const out = renderAll(template, source).map((item) => textOf(item.json));
  assert.deepEqual(out, ['Nguyễn Văn A VIP', 'Trần Thị B Thường']);
  const fewer = renderAll(template, { ...source, excluded: [0] }).map((item) => textOf(item.json));
  assert.deepEqual(fewer, ['Trần Thị B Thường']);
  assert.equal(activeRecords({ ...source, excluded: [0, 2] }).length, 1);
});

test('Next Record packs several records into one output', () => {
  const template = doc({ type: 'mergeField', attrs: { name: 'Email' } }, block('next'), { type: 'mergeField', attrs: { name: 'Email' } });
  const out = renderAll(template, source).map((item) => textOf(item.json));
  assert.deepEqual(out, ['a@x.vnsai-email', 'c@x.vn']);
});

test('address block renders lines with hard breaks', () => {
  const out = renderAll(doc(block('address')), source, {}, 1)[0];
  assert.equal(textOf(out.json), 'Ông Nguyễn Văn A\nCty X\nSố 1 Tràng Tiền\nHoàn Kiếm, Hà Nội');
});

test('checkMerge reports unknown fields, empty data and bad emails', () => {
  const template = doc({ type: 'mergeField', attrs: { name: 'Không có' } }, { type: 'mergeField', attrs: { name: 'Công ty' } });
  const problems = checkMerge(template, source, 'emails', 'Email').map((p) => p.message);
  assert.ok(problems.some((m) => m.includes('«Không có»')));
  assert.ok(problems.some((m) => m.includes('không hợp lệ: sai-email')));
  assert.ok(problems.some((m) => m.startsWith('Thiếu dữ liệu')));
});

test('findRecords ignores diacritics', () => {
  assert.deepEqual(findRecords(source, 'tran thi'), [1]);
  assert.deepEqual(findRecords(source, 'x.vn', 'Email'), [0, 2]);
});

test('buildEml encodes a UTF-8 subject', () => {
  const eml = buildEml({ to: 'a@x.vn', subject: 'Thư mời', body: 'Xin chào', html: false });
  assert.match(eml, /To: a@x\.vn/);
  assert.match(eml, /Subject: =\?UTF-8\?B\?/);
});
