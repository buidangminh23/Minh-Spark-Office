const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = 'http://www.w3.org/XML/1998/namespace';

export class WordPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPaginationError';
  }
}

export interface WordPhysicalPages {
  pageCount: number;
  boundaries: { paragraph: number; offset: number; text: string; inTable: boolean }[];
  pageNumbers?: number[];
}

export interface WordPageMap {
  pageCount: number;
  pageOfBlock(index: number): number;
  slice(firstPage: number, lastPage: number): WordPageSegment[];
}

export interface WordPageSegment {
  index: number;
  node: Element;
  partial: boolean;
  cutStart: boolean;
  cutEnd: boolean;
}

type Span = { start: number; end: number };
type Boundary = { left: number; right: number; kind: 'hard' | 'rendered' | 'before' | 'section' | 'native' };
type Paragraph = { index: number; node: Element; start: number; text: string; inTable: boolean };
const children = (node: Element) => Array.from(node.childNodes).filter((item): item is Element => item.nodeType === 1);
const is = (el: Element, name: string) => el.namespaceURI === W && el.localName === name;
const child = (el: Element | undefined, name: string) => el && children(el).find(item => is(item, name));
const attr = (el: Element, name: string) => el.getAttributeNS(W, name) ?? '';
const unmeasured = () => new WordPaginationError('Tệp chưa lưu đủ mốc trang để tách chính xác. Hãy mở trong Word, xem bố trí in rồi lưu lại, hoặc đo trang bằng Word trên Windows.');
const unsupported = () => new WordPaginationError('Mốc tách nằm trong bảng hoặc đối tượng Word phức tạp. Hãy chọn khoảng trang chứa trọn đối tượng.');

function paragraphBreaks(styles?: Document) {
  const all = styles ? Array.from(styles.getElementsByTagNameNS(W, 'style')).filter(el => attr(el, 'type') === 'paragraph') : [];
  const byId = new Map(all.map(el => [attr(el, 'styleId'), el]));
  const defaultStyle = all.find(el => ['1', 'true', 'on'].includes(attr(el, 'default')));
  const defaults = styles?.getElementsByTagNameNS(W, 'pPrDefault')[0];
  function enabled(props?: Element) {
    const setting = child(props, 'pageBreakBefore');
    return setting ? !['0', 'false', 'off'].includes(attr(setting, 'val')) : undefined;
  }
  return (paragraph: Element) => {
    const props = child(paragraph, 'pPr');
    const own = enabled(props);
    if (own !== undefined) return own;
    const styleId = child(props, 'pStyle');
    let style = styleId ? byId.get(attr(styleId, 'val')) : defaultStyle;
    const seen = new Set<Element>();
    while (style && !seen.has(style)) {
      seen.add(style);
      const inherited = enabled(child(style, 'pPr'));
      if (inherited !== undefined) return inherited;
      const parent = child(style, 'basedOn');
      style = parent ? byId.get(attr(parent, 'val')) : undefined;
    }
    return enabled(child(defaults, 'pPr')) ?? false;
  };
}

function scanBody(body: Element, styles?: Document) {
  const blocks = children(body).filter(el => !is(el, 'sectPr'));
  const spans = new WeakMap<Element, Span>();
  const paragraphs: Paragraph[] = [];
  const markers: Boundary[] = [];
  const hardBreaks: Span[] = [];
  const breakBefore = paragraphBreaks(styles);
  let cursor = 0;
  function walk(el: Element, index: number, paragraph?: Paragraph, table = false) {
    const start = cursor;
    if (is(el, 'p')) {
      const current: Paragraph = { index, node: el, start, text: '', inTable: table };
      paragraphs.push(current);
      if (breakBefore(el) && cursor > 0 && !table) markers.push({ left: cursor, right: cursor, kind: 'before' });
      for (const item of children(el)) if (!is(item, 'pPr')) walk(item, index, current, table);
      cursor++;
    } else if (is(el, 'lastRenderedPageBreak')) {
      if (cursor > 0) markers.push({ left: cursor, right: cursor, kind: 'rendered' });
    } else if (is(el, 'rPr') || is(el, 'tblPr') || is(el, 'trPr') || is(el, 'tcPr') || is(el, 'tblGrid')) {
      return;
    } else if (paragraph && (is(el, 't') || is(el, 'delText') || is(el, 'instrText'))) {
      const text = el.textContent ?? '';
      paragraph.text += text;
      cursor += text.length;
    } else if (paragraph && (is(el, 'drawing') || is(el, 'pict') || is(el, 'object'))) {
      paragraph.text += '\u0001';
      cursor++;
    } else if (children(el).length) {
      for (const item of children(el)) walk(item, index, paragraph, table || is(el, 'tbl'));
    } else if (paragraph) {
      let text = '\uFFFC';
      if (is(el, 'br') && attr(el, 'type') === 'page') {
        text = '\f';
        const position = { start: cursor, end: cursor + 1 };
        hardBreaks.push(position);
        markers.push({ left: cursor, right: cursor + 1, kind: 'hard' });
      } else if (is(el, 'tab')) text = '\t';
      else if (is(el, 'cr') || is(el, 'br')) text = '\v';
      else if (is(el, 'noBreakHyphen')) text = '\u001e';
      else if (is(el, 'softHyphen')) text = '\u001f';
      else if (el.namespaceURI === W && /^(?:r|proofErr|bookmarkStart|bookmarkEnd|permStart|permEnd|commentRangeStart|commentRangeEnd)$/.test(el.localName)) text = '';
      paragraph.text += text;
      cursor += text.length;
    }
    spans.set(el, { start, end: cursor });
  }
  for (const [i, block] of blocks.entries()) {
    const start = cursor;
    walk(block, i);
    if (cursor === start) spans.set(block, { start, end: ++cursor });
  }
  return { blocks, spans, markers, hardBreaks, paragraphs, breakBefore, length: cursor };
}

type Scan = ReturnType<typeof scanBody>;

function savedBoundaries(scan: Scan, body: Element, savedCount?: number, settings?: Document) {
  const { blocks, spans, markers, paragraphs } = scan;
  let sectionStart = 0;
  function section(section: Element | undefined, next: number) {
    if (sectionStart && sectionStart < blocks.length) {
      const type = child(section, 'type');
      if (type && attr(type, 'val') !== 'nextPage') throw unmeasured();
      const position = spans.get(blocks[sectionStart])!.start;
      markers.push({ left: position, right: position, kind: 'section' });
    }
    sectionStart = next;
  }
  for (const [i, block] of blocks.entries()) {
    const end = child(child(block, 'pPr'), 'sectPr');
    if (end) section(end, i + 1);
  }
  section(child(body, 'sectPr'), blocks.length);
  const paragraphEnds = new Set(paragraphs.map(p => p.start + p.text.length));
  const splitMark = settings?.getElementsByTagNameNS(W, 'splitPgBreakAndParaMark')[0];
  const moveParagraphMark = splitMark && !['0', 'false', 'off'].includes(attr(splitMark, 'val'));
  const cuts: Boundary[] = [];
  for (const mark of markers.sort((a, b) => a.left - b.left || b.right - a.right)) {
    const previous = cuts.at(-1);
    const atSamePosition = previous && mark.left <= previous.right;
    const afterParagraphMark = previous && mark.left === previous.right + 1 && paragraphEnds.has(previous.right);
    if (previous && (atSamePosition || (afterParagraphMark && previous.kind === 'hard' && mark.kind === 'rendered')) &&
      !(previous.kind === 'hard' && mark.kind === 'hard' && previous.left !== mark.left)) {
      if (!afterParagraphMark || !moveParagraphMark) previous.right = Math.max(previous.right, mark.right);
      if (mark.kind === 'hard') previous.kind = 'hard';
    } else cuts.push({ ...mark });
  }
  if (!cuts.length || !Number.isSafeInteger(savedCount) || cuts.length + 1 !== savedCount) throw unmeasured();
  if (!moveParagraphMark) {
    for (const cut of cuts) {
      if (cut.kind === 'hard' && paragraphEnds.has(cut.right) && cut.right + 1 < scan.length) cut.right++;
    }
  }
  return cuts;
}

function measuredBoundaries(scan: Scan, native: WordPhysicalPages) {
  if (!Number.isSafeInteger(native.pageCount) || native.pageCount < 1 || native.boundaries.length + 1 !== native.pageCount) throw unmeasured();
  const hardAt = new Map(scan.hardBreaks.map(span => [span.end, span.start]));
  const paragraphEnds = new Set(scan.paragraphs.map(p => p.start + p.text.length));
  let previous = -1;
  return native.boundaries.map(mark => {
    const p = scan.paragraphs[mark.paragraph];
    if (!p || !Number.isSafeInteger(mark.offset) || mark.offset < 0 || mark.offset > p.text.length ||
      p.inTable !== mark.inTable || p.text !== mark.text) throw unmeasured();
    const right = p.start + mark.offset;
    const left = hardAt.get(right) ?? (paragraphEnds.has(right - 1) ? hardAt.get(right - 1) : undefined) ?? right;
    if (right <= previous || left < previous || right < 1) throw unmeasured();
    previous = right;
    return { left, right, kind: 'native' as const };
  });
}

function clip(el: Element, span: Span, spans: Scan['spans']): Element | undefined {
  const bounds = spans.get(el)!;
  if (bounds.start === bounds.end) {
    if (bounds.start <= span.start || bounds.end >= span.end) return undefined;
    return el.cloneNode(true) as Element;
  }
  if (bounds.start >= span.end || bounds.end <= span.start) return undefined;
  if (bounds.start >= span.start && bounds.end <= span.end) return el.cloneNode(true) as Element;
  if (is(el, 't')) {
    const clone = el.cloneNode(false) as Element;
    clone.textContent = (el.textContent ?? '').slice(Math.max(0, span.start - bounds.start), span.end - bounds.start);
    if (/^\s|\s$/.test(clone.textContent)) clone.setAttributeNS(XML, 'xml:space', 'preserve');
    return clone;
  }
  if (!is(el, 'p') && !is(el, 'r')) throw unsupported();
  const clone = el.cloneNode(false) as Element;
  for (const item of children(el)) {
    const part = is(item, 'rPr') || is(item, 'pPr') ? item.cloneNode(true) : clip(item, span, spans);
    if (part) clone.appendChild(part);
  }
  return clone;
}

export function buildWordPageMap(body: Element, styles?: Document, savedPageCount?: number, native?: WordPhysicalPages, settings?: Document): WordPageMap {
  const scan = scanBody(body, styles);
  const cuts = native ? measuredBoundaries(scan, native) : savedBoundaries(scan, body, savedPageCount, settings);
  function pageOfBlock(index: number) {
    const block = scan.blocks[index];
    if (!block) throw new RangeError('Invalid Word block index');
    const start = scan.spans.get(block)!.start;
    let low = 0;
    let high = cuts.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (cuts[middle].right <= start) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  return {
    pageCount: cuts.length + 1,
    pageOfBlock,
    slice(first, last) {
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 0 || last < first || last > cuts.length) throw new RangeError('Invalid Word page range');
      const span = { start: first ? cuts[first - 1].right : 0, end: cuts[last]?.left ?? scan.length };
      const result: WordPageSegment[] = [];
      for (const [index, source] of scan.blocks.entries()) {
        const node = clip(source, span, scan.spans);
        if (!node) continue;
        const bounds = scan.spans.get(source)!;
        const cutStart = bounds.start < span.start;
        const cutEnd = bounds.end > span.end;
        if (first > 0 && !result.length && is(node, 'p') && scan.breakBefore(node)) {
          let props = child(node, 'pPr');
          if (!props) {
            props = node.ownerDocument.createElementNS(W, 'w:pPr');
            node.insertBefore(props, node.firstChild);
          }
          const before = child(props, 'pageBreakBefore') ?? node.ownerDocument.createElementNS(W, 'w:pageBreakBefore');
          if (!before.parentNode) {
            const next = children(props).find(el => !['pStyle', 'keepNext', 'keepLines'].includes(el.localName));
            props.insertBefore(before, next ?? null);
          }
          before.setAttributeNS(W, 'w:val', '0');
        }
        result.push({ index, node, partial: cutStart || cutEnd, cutStart, cutEnd });
      }
      if (!result.length) throw new WordPaginationError('Trang được chọn là trang trắng do Word tự chèn và thiếu nội dung để tách riêng.');
      return result;
    },
  };
}
