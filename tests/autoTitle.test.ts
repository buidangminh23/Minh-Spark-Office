import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanTitleText, deriveDocTitle, isDefaultDocName } from '../src/editors/doc/autoTitle';

test('isDefaultDocName recognises only the untouched default names', () => {
  assert.equal(isDefaultDocName('Tài liệu mới.docx'), true);
  assert.equal(isDefaultDocName('Tài liệu mới (2).docx'), true);
  assert.equal(isDefaultDocName('Báo cáo mẫu.docx'), false);
  assert.equal(isDefaultDocName('Hợp đồng thuê nhà.docx'), false);
});

test('deriveDocTitle prefers the first heading over earlier paragraphs', () => {
  const blocks = [
    { heading: false, text: 'Kính gửi: Ban Giám đốc' },
    { heading: true, text: 'Báo cáo doanh thu tháng 11' },
  ];
  assert.equal(deriveDocTitle(blocks), 'Báo cáo doanh thu tháng 11.docx');
});

test('deriveDocTitle falls back to the first paragraph and skips too-short text', () => {
  assert.equal(deriveDocTitle([{ heading: false, text: 'Hi' }, { heading: false, text: 'Biên bản họp nhóm' }]), 'Biên bản họp nhóm.docx');
  assert.equal(deriveDocTitle([{ heading: false, text: '  ' }, { heading: true, text: 'a' }]), null);
});

test('cleanTitleText removes characters that file names cannot hold and caps the length', () => {
  assert.equal(cleanTitleText('Kế hoạch: Q4/2026 <bản nháp>?.'), 'Kế hoạch Q4 2026 bản nháp');
  assert.equal(cleanTitleText('# Biên bản họp nhóm dự án Q4'), 'Biên bản họp nhóm dự án Q4');
  assert.equal(cleanTitleText('- 2026 kế hoạch'), '2026 kế hoạch');
  const long = cleanTitleText('Báo cáo '.repeat(20));
  assert.ok(long.length <= 80);
  assert.ok(!long.endsWith(' '));
});
