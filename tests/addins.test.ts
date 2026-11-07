import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SERVER_PDF_BASE64, anthropicMessages, contextBlock, openAiInput, quotaDay, systemPrompt, trimContext, validateRequest } from '../api/_shared/addin';
import { extractFormula, extractTable, renderMarkdown, toCellValue } from '../src/addins/markdown';

const base = { provider: 'claude', app: 'doc', documentName: 'Báo cáo', turns: [{ role: 'user', content: 'Tóm tắt' }], context: { label: 'Toàn bộ tài liệu', text: 'Nội dung' } };

test('validateRequest accepts a well-formed request', () => {
  const result = validateRequest(base);
  assert.equal(result.ok, true);
});

test('validateRequest rejects unknown provider, app and bad turn order', () => {
  assert.equal(validateRequest({ ...base, provider: 'gemini' }).ok, false);
  assert.equal(validateRequest({ ...base, app: 'slides' }).ok, false);
  assert.equal(validateRequest({ ...base, turns: [{ role: 'assistant', content: 'x' }] }).ok, false);
  assert.equal(validateRequest({ ...base, turns: [] }).ok, false);
});

test('validateRequest enforces the shared PDF size limit', () => {
  const big = { ...base, app: 'pdf', context: { ...base.context, pdf: { name: 'a.pdf', base64: 'A'.repeat(MAX_SERVER_PDF_BASE64 + 4) } } };
  assert.equal(validateRequest(big).ok, false);
  assert.equal(validateRequest(big, Number.POSITIVE_INFINITY).ok, true);
  const invalid = { ...base, context: { ...base.context, pdf: { name: 'a.pdf', base64: 'not base64!' } } };
  assert.equal(validateRequest(invalid).ok, false);
});

test('provider payloads attach context and PDF only to the last user turn', () => {
  const request = validateRequest({ ...base, app: 'pdf', turns: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }], context: { label: 'PDF', text: 'notes', pdf: { name: 'f', base64: 'QUJD' } } });
  assert.ok(request.ok);
  const claude = anthropicMessages(request.request);
  assert.equal(claude[0].content, 'a');
  assert.ok(Array.isArray(claude[2].content));
  const openai = openAiInput(request.request);
  assert.ok(Array.isArray(openai[2].content));
  const parts = openai[2].content as Array<{ type: string; filename?: string }>;
  assert.equal(parts[0].type, 'input_file');
  assert.equal(parts[0].filename, 'f.pdf');
});

test('contextBlock wraps text and skips empty context', () => {
  assert.equal(contextBlock({ label: 'x', text: '  ' }), '');
  assert.match(contextBlock({ label: 'a"b', text: 'hi' }), /<context label="a'b">\nhi\n<\/context>/);
  assert.match(systemPrompt('chatgpt', 'sheet', 'Bảng'), /ChatGPT[\s\S]*Minh Sheets/);
});

test('trimContext keeps short text and marks truncated text', () => {
  assert.equal(trimContext('abc', 10), 'abc');
  assert.match(trimContext('abcdef', 3), /^abc\n\[… còn 3 ký tự/);
});

test('quotaDay rolls over at midnight Vietnam time', () => {
  const beforeMidnight = Date.UTC(2026, 10, 7, 16, 59);
  const afterMidnight = Date.UTC(2026, 10, 7, 17, 1);
  assert.equal(quotaDay(afterMidnight) - quotaDay(beforeMidnight), 1);
});

test('renderMarkdown escapes HTML and renders structure', () => {
  const html = renderMarkdown('# Tiêu đề\n\n<script>x</script> **đậm**\n\n- một\n- hai\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.match(html, /<h2>Tiêu đề<\/h2>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<strong>đậm<\/strong>/);
  assert.match(html, /<ul><li>một<\/li><li>hai<\/li><\/ul>/);
  assert.match(html, /<table>/);
});

test('extractTable reads markdown tables and fenced TSV', () => {
  assert.deepEqual(extractTable('Bảng:\n| Tháng | Chi |\n| --- | ---: |\n| 1 | **100** |'), [['Tháng', 'Chi'], ['1', '100']]);
  assert.deepEqual(extractTable('```\na\tb\n1\t2\n```'), [['a', 'b'], ['1', '2']]);
  assert.equal(extractTable('không có bảng'), null);
});

test('extractFormula finds the first formula line', () => {
  assert.equal(extractFormula('Dùng:\n`=SUM(A1:A10)`\nGiải thích'), '=SUM(A1:A10)');
  assert.equal(extractFormula('không có'), null);
});

test('toCellValue parses numbers in common formats', () => {
  assert.equal(toCellValue('1234.5'), 1234.5);
  assert.equal(toCellValue('1,5'), 1.5);
  assert.equal(toCellValue('1.234.567'), 1234567);
  assert.equal(toCellValue('1.234,5'), 1234.5);
  assert.equal(toCellValue('12,345'), 12.345);
  assert.equal(toCellValue('1,234,567'), 1234567);
  assert.equal(toCellValue('=A1+1'), '=A1+1');
  assert.equal(toCellValue('Hà Nội'), 'Hà Nội');
});
