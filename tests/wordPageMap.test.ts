import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { buildWordPageMap, WordPaginationError } from '../src/lib/wordPageMap';

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml') as unknown as Document;
const body = (xml: string) => parse('<w:body xmlns:w="' + w + '">' + xml + '</w:body>').documentElement;
const paragraph = (value: string) => '<w:p><w:r><w:t>' + value + '</w:t></w:r></w:p>';
const hard = '<w:br w:type="page"/>';
const cached = '<w:lastRenderedPageBreak/>';
const serialize = (node: Element) => new XMLSerializer().serializeToString(node as never);

test('an inclusive range retains internal breaks and excludes external breaks and text', () => {
  const p = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>A</w:t>' + hard + cached + '<w:t>B</w:t>' + hard + cached + '<w:t>C</w:t>' + hard + cached + '<w:t>D</w:t></w:r></w:p>';
  const original = body(p);
  const map = buildWordPageMap(original, undefined, 4);
  const [firstThree] = map.slice(0, 2);
  assert.equal(firstThree.node.textContent, 'ABC');
  assert.equal(firstThree.node.getElementsByTagNameNS(w, 'br').length, 2);
  assert.equal(firstThree.node.getElementsByTagNameNS(w, 'b').length, 1);
  assert.equal(map.slice(3, 3)[0].node.textContent, 'D');
  assert.equal(original.textContent, 'ABCD');
});

test('terminal hard breaks, their cached duplicates and paragraph marks follow Word compatibility settings', () => {
  const first = '<w:p><w:r><w:t>A</w:t>' + hard + '</w:r></w:p>';
  const next = '<w:p><w:r>' + cached + '<w:t>B</w:t></w:r></w:p>';
  const map = buildWordPageMap(body(first + next), undefined, 2);
  assert.equal(map.pageCount, 2);
  assert.equal(map.pageOfBlock(1), 1);
  assert.equal(map.slice(1, 1).length, 1);
  assert.equal(map.slice(0, 0)[0].node.getElementsByTagNameNS(w, 'br').length, 0);
  const clean = body(first + paragraph('B'));
  assert.equal(buildWordPageMap(clean, undefined, 2).slice(1, 1).length, 1);
  const settings = parse('<w:settings xmlns:w="' + w + '"><w:compat><w:splitPgBreakAndParaMark/></w:compat></w:settings>');
  assert.deepEqual(buildWordPageMap(clean, undefined, 2, undefined, settings).slice(1, 1).map(p => p.node.textContent), ['', 'B']);
  assert.deepEqual(buildWordPageMap(body(first + next), undefined, 2, undefined, settings).slice(1, 1).map(p => p.node.textContent), ['', 'B']);
});

test('direct and inherited paragraph page breaks override correctly in the extracted first paragraph', () => {
  const styles = parse('<w:styles xmlns:w="' + w + '"><w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:pageBreakBefore/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Next"><w:basedOn w:val="Base"/></w:style></w:styles>');
  const p = (text: string, extra = '') => '<w:p><w:pPr><w:pStyle w:val="Next"/>' + extra + '</w:pPr><w:r><w:t>' + text + '</w:t></w:r></w:p>';
  const map = buildWordPageMap(body(paragraph('A') + p('B') + p('C', '<w:pageBreakBefore w:val="0"/>')), styles, 2);
  const second = map.slice(1, 1);
  assert.deepEqual(second.map(p => p.node.textContent), ['B', 'C']);
  assert.match(serialize(second[0].node), /w:pageBreakBefore w:val="0"/);
});

test('the following section start type determines physical breaks', () => {
  const boundary = '<w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>A</w:t></w:r></w:p>';
  const doc = body(boundary + paragraph('B') + '<w:sectPr/>');
  assert.deepEqual(buildWordPageMap(doc, undefined, 2).slice(1, 1).map(p => p.node.textContent), ['B']);
  for (const type of ['continuous', 'evenPage', 'oddPage', 'nextColumn']) {
    assert.throws(() => buildWordPageMap(body(boundary + paragraph('B') + '<w:sectPr><w:type w:val="' + type + '"/></w:sectPr>'), undefined, 2), WordPaginationError);
  }
});

test('incomplete saved pagination and placeholder page counts request a fresh layout', () => {
  assert.throws(() => buildWordPageMap(body(paragraph('A')), undefined, 1), WordPaginationError);
  const source = body('<w:p><w:r><w:t>A</w:t>' + cached + '<w:t>B</w:t></w:r></w:p>');
  assert.throws(() => buildWordPageMap(source, undefined, 3), WordPaginationError);
  assert.throws(() => buildWordPageMap(source), WordPaginationError);
  assert.equal(buildWordPageMap(source, undefined, 2).slice(1, 1)[0].node.textContent, 'B');
});

test('native positions slice UTF-16 text while preserving significant whitespace and run styling', () => {
  const doc = body('<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>😀A B</w:t></w:r></w:p>');
  const mark = { paragraph: 0, offset: 3, text: '😀A B', inTable: false };
  const map = buildWordPageMap(doc, undefined, undefined, { pageCount: 2, boundaries: [mark] });
  assert.equal(map.slice(0, 0)[0].node.textContent, '😀A');
  const tail = map.slice(1, 1)[0];
  assert.equal(tail.node.textContent, ' B');
  assert.equal(tail.partial, true);
  assert.match(serialize(tail.node), /xml:space="preserve"/);
  assert.equal(tail.node.getElementsByTagNameNS(w, 'i').length, 1);
  assert.throws(() => buildWordPageMap(doc, undefined, undefined, { pageCount: 2, boundaries: [{ ...mark, text: 'wrong' }] }), WordPaginationError);
});

test('a measured table may be retained in full and a cut through its rows fails explicitly', () => {
  const row = (s: string) => '<w:tr><w:tc>' + paragraph(s) + '</w:tc></w:tr>';
  const doc = body(paragraph('A') + '<w:tbl>' + row('B') + row('C') + '</w:tbl>' + paragraph('D'));
  const measured = { pageCount: 3, boundaries: [
    { paragraph: 2, offset: 0, text: 'C', inTable: true },
    { paragraph: 3, offset: 0, text: 'D', inTable: false },
  ] };
  const map = buildWordPageMap(doc, undefined, undefined, measured);
  assert.throws(() => map.slice(1, 1), /bảng/);
  assert.deepEqual(map.slice(0, 1).map(p => p.node.textContent), ['A', 'BC']);
  assert.deepEqual(map.slice(2, 2).map(p => p.node.textContent), ['D']);
});

test('leading paragraph spacing is suppressed only on natural page rollover', () => {
  const measured = { pageCount: 2, boundaries: [{ paragraph: 1, offset: 0, text: 'B', inTable: false }] };
  const natural = paragraph('A') + '<w:p><w:r>' + cached + '<w:t>B</w:t></w:r></w:p>';
  assert.equal(buildWordPageMap(body(natural), undefined, 2).slice(1, 1)[0].suppressBeforeSpacing, true);
  assert.equal(buildWordPageMap(body(natural), undefined, undefined, measured).slice(1, 1)[0].suppressBeforeSpacing, true);
  const hardEnding = '<w:p><w:r><w:t>A</w:t>' + hard + '</w:r></w:p>' + paragraph('B');
  const before = paragraph('A') + '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>B</w:t></w:r></w:p>';
  const section = '<w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>A</w:t></w:r></w:p>' + paragraph('B') + '<w:sectPr/>';
  for (const source of [hardEnding, before, section]) {
    assert.equal(buildWordPageMap(body(source), undefined, 2).slice(1, 1)[0].suppressBeforeSpacing, false);
    assert.equal(buildWordPageMap(body(source), undefined, undefined, measured).slice(1, 1)[0].suppressBeforeSpacing, false);
  }
});
