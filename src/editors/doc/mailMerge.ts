import type { JSONContent } from '@tiptap/react';

export type MergeType = 'letters' | 'emails' | 'envelopes' | 'labels' | 'directory';
export type MergeRecord = Record<string, string>;
export type StdField = 'title' | 'lastName' | 'firstName' | 'fullName' | 'company' | 'address1' | 'address2' | 'district' | 'province' | 'postal' | 'country' | 'email' | 'phone';
export type FieldMap = Partial<Record<StdField, string>>;
export type MergeSource = { headers: string[]; rows: MergeRecord[]; excluded?: number[]; fieldMap?: FieldMap };
export type Comparison = 'eq' | 'ne' | 'lt' | 'gt' | 'le' | 'ge' | 'empty' | 'filled' | 'contains';
export type Condition = { field: string; op: Comparison; value: string };
export type NameFormat = 'title-full' | 'full' | 'title-last' | 'title-first' | 'first';
export type AddressOptions = { nameFormat: NameFormat; company: boolean; country: 'never' | 'always' | 'foreign'; homeCountry: string };
export type GreetingOptions = { salutation: string; nameFormat: NameFormat; punctuation: string; fallback: string };
export type IfOptions = Condition & { then: string; otherwise: string };
export type BlockKind = 'address' | 'greeting' | 'if' | 'recnum' | 'seqnum' | 'skipif' | 'nextif' | 'next' | 'fillin';
export type BlockAttrs = { kind: BlockKind; options: string };

export const MERGE_TYPES: { id: MergeType; label: string; detail: string }[] = [
  { id: 'letters', label: 'Thư', detail: 'Mỗi người nhận một bản, ngắt trang giữa các bản' },
  { id: 'emails', label: 'Thư điện tử', detail: 'Gửi mỗi người một email qua Outlook hoặc ứng dụng email' },
  { id: 'envelopes', label: 'Phong bì', detail: 'Đặt khổ phong bì và khối địa chỉ người nhận' },
  { id: 'labels', label: 'Nhãn', detail: 'Lưới nhãn, mỗi ô một người nhận' },
  { id: 'directory', label: 'Danh bạ', detail: 'Các bản nối tiếp nhau, không ngắt trang' },
];

export const STD_FIELDS: { id: StdField; label: string; hints: string[] }[] = [
  { id: 'title', label: 'Danh xưng', hints: ['danh xung', 'xung ho', 'title', 'salutation', 'gioi tinh'] },
  { id: 'lastName', label: 'Họ', hints: ['ho', 'ho dem', 'last name', 'lastname', 'surname', 'family'] },
  { id: 'firstName', label: 'Tên', hints: ['ten', 'first name', 'firstname', 'given'] },
  { id: 'fullName', label: 'Họ và tên', hints: ['ho va ten', 'ho ten', 'full name', 'fullname', 'name', 'nguoi nhan', 'khach hang'] },
  { id: 'company', label: 'Công ty', hints: ['cong ty', 'don vi', 'co quan', 'company', 'organization', 'to chuc'] },
  { id: 'address1', label: 'Địa chỉ', hints: ['dia chi', 'address', 'so nha', 'duong'] },
  { id: 'address2', label: 'Địa chỉ dòng 2', hints: ['dia chi 2', 'address 2', 'phuong', 'xa'] },
  { id: 'district', label: 'Quận/Huyện', hints: ['quan', 'huyen', 'quan huyen', 'district', 'city'] },
  { id: 'province', label: 'Tỉnh/Thành phố', hints: ['tinh', 'thanh pho', 'tinh thanh', 'province', 'state'] },
  { id: 'postal', label: 'Mã bưu chính', hints: ['ma buu chinh', 'zip', 'postal', 'postcode'] },
  { id: 'country', label: 'Quốc gia', hints: ['quoc gia', 'nuoc', 'country'] },
  { id: 'email', label: 'Email', hints: ['email', 'e-mail', 'thu dien tu', 'mail'] },
  { id: 'phone', label: 'Điện thoại', hints: ['dien thoai', 'sdt', 'so dien thoai', 'phone', 'mobile'] },
];

export const COMPARISONS: { id: Comparison; label: string }[] = [
  { id: 'eq', label: 'Bằng' }, { id: 'ne', label: 'Khác' }, { id: 'lt', label: 'Nhỏ hơn' }, { id: 'gt', label: 'Lớn hơn' },
  { id: 'le', label: 'Nhỏ hơn hoặc bằng' }, { id: 'ge', label: 'Lớn hơn hoặc bằng' }, { id: 'contains', label: 'Có chứa' },
  { id: 'empty', label: 'Để trống' }, { id: 'filled', label: 'Có dữ liệu' },
];

export const DEFAULT_ADDRESS: AddressOptions = { nameFormat: 'title-full', company: true, country: 'foreign', homeCountry: 'Việt Nam' };
export const DEFAULT_GREETING: GreetingOptions = { salutation: 'Kính gửi', nameFormat: 'title-full', punctuation: ',', fallback: 'Kính gửi Quý khách,' };

export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

export function guessFieldMap(headers: string[]): FieldMap {
  const map: FieldMap = {};
  const used = new Set<string>();
  for (const field of STD_FIELDS) {
    const exact = headers.find((h) => !used.has(h) && field.hints.includes(fold(h)));
    const loose = exact ?? headers.find((h) => !used.has(h) && field.hints.some((hint) => hint.length > 3 && fold(h).includes(hint)));
    if (loose) {
      map[field.id] = loose;
      used.add(loose);
    }
  }
  return map;
}

export function activeRecords(source: MergeSource): { row: MergeRecord; index: number }[] {
  const excluded = new Set(source.excluded ?? []);
  return source.rows.map((row, index) => ({ row, index })).filter((item) => !excluded.has(item.index));
}

export function stdValue(source: MergeSource, row: MergeRecord, field: StdField): string {
  const map = source.fieldMap ?? {};
  const read = (key: StdField) => (map[key] ? (row[map[key]] ?? '').trim() : '');
  if (field === 'fullName') return read('fullName') || [read('lastName'), read('firstName')].filter(Boolean).join(' ');
  if (field === 'firstName') return read('firstName') || read('fullName').split(/\s+/).pop() || '';
  if (field === 'lastName') return read('lastName') || read('fullName').split(/\s+/)[0] || '';
  return read(field);
}

export function formatName(source: MergeSource, row: MergeRecord, format: NameFormat): string {
  const title = stdValue(source, row, 'title');
  const pick = (name: string, withTitle: boolean) => [withTitle ? title : '', name].filter(Boolean).join(' ');
  switch (format) {
    case 'full': return stdValue(source, row, 'fullName');
    case 'title-last': return pick(stdValue(source, row, 'lastName'), true);
    case 'title-first': return pick(stdValue(source, row, 'firstName'), true);
    case 'first': return stdValue(source, row, 'firstName');
    default: return pick(stdValue(source, row, 'fullName'), true);
  }
}

export function addressLines(source: MergeSource, row: MergeRecord, options: AddressOptions = DEFAULT_ADDRESS): string[] {
  const value = (field: StdField) => stdValue(source, row, field);
  const country = value('country');
  const showCountry = options.country === 'always' || (options.country === 'foreign' && country && fold(country) !== fold(options.homeCountry));
  const area = [value('district'), value('province')].filter(Boolean).join(', ');
  return [
    formatName(source, row, options.nameFormat),
    options.company ? value('company') : '',
    value('address1'),
    value('address2'),
    [area, value('postal')].filter(Boolean).join(' '),
    showCountry ? country : '',
  ].map((line) => line.trim()).filter(Boolean);
}

export function greetingText(source: MergeSource, row: MergeRecord, options: GreetingOptions = DEFAULT_GREETING): string {
  const name = formatName(source, row, options.nameFormat);
  if (!name.trim()) return options.fallback;
  return `${options.salutation} ${name}${options.punctuation}`.trim();
}

const asNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return cleaned && !Number.isNaN(Number(cleaned)) ? Number(cleaned) : null;
};

export function testCondition(row: MergeRecord, condition: Condition): boolean {
  const left = (row[condition.field] ?? '').trim();
  const right = condition.value.trim();
  if (condition.op === 'empty') return !left;
  if (condition.op === 'filled') return Boolean(left);
  if (condition.op === 'contains') return fold(left).includes(fold(right));
  const a = asNumber(left);
  const b = asNumber(right);
  const compare = a !== null && b !== null ? a - b : fold(left).localeCompare(fold(right), 'vi');
  switch (condition.op) {
    case 'eq': return compare === 0;
    case 'ne': return compare !== 0;
    case 'lt': return compare < 0;
    case 'gt': return compare > 0;
    case 'le': return compare <= 0;
    default: return compare >= 0;
  }
}

export const fillTokens = (text: string, row: MergeRecord) => text.replace(/«([^»]+)»/g, (_, name: string) => row[name] ?? '');

export const parseOptions = <T>(raw: unknown, fallback: T): T => {
  try {
    return { ...fallback, ...(JSON.parse(String(raw ?? '{}')) as Partial<T>) };
  } catch {
    return fallback;
  }
};

export const BLOCK_LABELS: Record<BlockKind, string> = {
  address: 'Khối địa chỉ', greeting: 'Dòng chào', if: 'Nếu…Thì…Không thì', recnum: 'Số bản ghi', seqnum: 'Số thứ tự trộn',
  skipif: 'Bỏ qua bản ghi nếu', nextif: 'Bản ghi tiếp nếu', next: 'Bản ghi tiếp', fillin: 'Điền khi trộn',
};

export function blockLabel(kind: BlockKind, raw: string): string {
  if (kind === 'if' || kind === 'skipif' || kind === 'nextif') {
    const condition = parseOptions<Condition>(raw, { field: '', op: 'eq', value: '' });
    const op = COMPARISONS.find((item) => item.id === condition.op)?.label.toLowerCase() ?? '';
    const tail = condition.op === 'empty' || condition.op === 'filled' ? '' : ` “${condition.value}”`;
    return `${BLOCK_LABELS[kind]}: ${condition.field} ${op}${tail}`;
  }
  if (kind === 'fillin') return `${BLOCK_LABELS.fillin}: ${parseOptions<{ prompt: string }>(raw, { prompt: '' }).prompt}`;
  return BLOCK_LABELS[kind];
}

export type RenderContext = { source: MergeSource; records: { row: MergeRecord; index: number }[]; answers: Record<string, string>; sequence: number };

type Cursor = { position: number; skipped: boolean };

const blockText = (attrs: BlockAttrs, context: RenderContext, cursor: Cursor): string => {
  const current = context.records[cursor.position];
  const row = current?.row ?? {};
  switch (attrs.kind) {
    case 'address': return current ? addressLines(context.source, row, parseOptions(attrs.options, DEFAULT_ADDRESS)).join('\n') : '';
    case 'greeting': return current ? greetingText(context.source, row, parseOptions(attrs.options, DEFAULT_GREETING)) : '';
    case 'recnum': return current ? String(current.index + 1) : '';
    case 'seqnum': return String(context.sequence + 1);
    case 'fillin': {
      const options = parseOptions(attrs.options, { prompt: '', value: '' });
      return context.answers[options.prompt] ?? options.value;
    }
    case 'if': {
      const options = parseOptions<IfOptions>(attrs.options, { field: '', op: 'eq', value: '', then: '', otherwise: '' });
      return fillTokens(testCondition(row, options) ? options.then : options.otherwise, row);
    }
    case 'skipif':
      if (current && testCondition(row, parseOptions<Condition>(attrs.options, { field: '', op: 'eq', value: '' }))) cursor.skipped = true;
      return '';
    case 'nextif':
      if (current && testCondition(row, parseOptions<Condition>(attrs.options, { field: '', op: 'eq', value: '' }))) cursor.position++;
      return '';
    default:
      cursor.position++;
      return '';
  }
};

const textNodes = (text: string, marks: JSONContent['marks']): JSONContent[] => text.split('\n').flatMap((line, index) => [
  ...(index ? [{ type: 'hardBreak' }] : []),
  ...(line ? [{ type: 'text', text: line, ...(marks?.length ? { marks } : {}) }] : []),
]);

function renderNode(node: JSONContent, context: RenderContext, cursor: Cursor): JSONContent[] {
  if (node.type === 'mergeField') {
    const row = context.records[cursor.position]?.row ?? {};
    return textNodes(row[String(node.attrs?.name ?? '')] ?? '', node.marks);
  }
  if (node.type === 'mergeBlock') return textNodes(blockText(node.attrs as BlockAttrs, context, cursor), node.marks);
  if (!node.content) return [node];
  return [{ ...node, content: node.content.flatMap((child) => renderNode(child, context, cursor)) }];
}

export function renderRecord(doc: JSONContent, context: RenderContext, start: number): { json: JSONContent; next: number; skipped: boolean } {
  const cursor: Cursor = { position: start, skipped: false };
  const [json] = renderNode(doc, context, cursor);
  return { json, next: cursor.position + 1, skipped: cursor.skipped };
}

export function renderAll(doc: JSONContent, source: MergeSource, answers: Record<string, string> = {}, limit = Infinity): { json: JSONContent; first: number }[] {
  const records = activeRecords(source);
  const out: { json: JSONContent; first: number }[] = [];
  let position = 0;
  while (position < records.length && out.length < limit) {
    const result = renderRecord(doc, { source, records, answers, sequence: out.length }, position);
    if (!result.skipped) out.push({ json: result.json, first: records[position].index });
    position = Math.max(result.next, position + 1);
  }
  return out;
}

export function previewTexts(doc: JSONContent, source: MergeSource, start: number, answers: Record<string, string> = {}): string[] {
  const records = activeRecords(source);
  const context: RenderContext = { source, records, answers, sequence: start };
  const cursor: Cursor = { position: Math.min(start, Math.max(0, records.length - 1)), skipped: false };
  const values: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'mergeField') values.push(context.records[cursor.position]?.row[String(node.attrs?.name ?? '')] ?? '');
    else if (node.type === 'mergeBlock') values.push(blockText(node.attrs as BlockAttrs, context, cursor));
    node.content?.forEach(walk);
  };
  walk(doc);
  return values;
}

export function collectFields(doc: JSONContent): { fields: string[]; blocks: BlockAttrs[] } {
  const fields = new Set<string>();
  const blocks: BlockAttrs[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'mergeField') fields.add(String(node.attrs?.name ?? ''));
    if (node.type === 'mergeBlock') blocks.push(node.attrs as BlockAttrs);
    node.content?.forEach(walk);
  };
  walk(doc);
  return { fields: [...fields], blocks };
}

export const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export type MergeProblem = { record: number | null; message: string };

export function checkMerge(doc: JSONContent, source: MergeSource, type: MergeType, emailField?: string): MergeProblem[] {
  const problems: MergeProblem[] = [];
  const { fields, blocks } = collectFields(doc);
  const headers = new Set(source.headers);
  for (const field of fields) if (!headers.has(field)) problems.push({ record: null, message: `Trường «${field}» không có trong danh sách người nhận` });
  for (const block of blocks) {
    if (block.kind === 'if' || block.kind === 'skipif' || block.kind === 'nextif') {
      const field = parseOptions<Condition>(block.options, { field: '', op: 'eq', value: '' }).field;
      if (field && !headers.has(field)) problems.push({ record: null, message: `Quy tắc dùng trường «${field}» không có trong danh sách` });
    }
    if ((block.kind === 'address' || block.kind === 'greeting') && !Object.keys(source.fieldMap ?? {}).length) {
      problems.push({ record: null, message: `${BLOCK_LABELS[block.kind]} chưa ghép được cột nào, mở Khớp trường để chọn cột` });
    }
  }
  const records = activeRecords(source);
  if (!records.length) problems.push({ record: null, message: 'Không có người nhận nào được chọn' });
  for (const { row, index } of records) {
    const missing = fields.filter((field) => headers.has(field) && !(row[field] ?? '').trim());
    if (missing.length) problems.push({ record: index + 1, message: `Thiếu dữ liệu: ${missing.map((field) => `«${field}»`).join(', ')}` });
    if (type === 'emails') {
      const address = emailField ? (row[emailField] ?? '').trim() : '';
      if (!EMAIL_PATTERN.test(address)) problems.push({ record: index + 1, message: address ? `Địa chỉ email không hợp lệ: ${address}` : 'Thiếu địa chỉ email' });
    }
  }
  return problems;
}

export function findRecords(source: MergeSource, query: string, field?: string): number[] {
  const needle = fold(query);
  if (!needle) return [];
  return source.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (field ? [row[field] ?? ''] : Object.values(row)).some((value) => fold(value).includes(needle)))
    .map(({ index }) => index);
}

const encodeHeader = (value: string) => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${base64Utf8(value)}?=`);

export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

const wrap76 = (text: string) => text.replace(/.{1,76}/g, '$&\r\n').trimEnd();

export function buildEml(message: { to: string; cc?: string; subject: string; body: string; html: boolean; attachments?: { name: string; data: string; type?: string }[] }): string {
  const boundary = `----=_MinhOffice_${Math.random().toString(36).slice(2)}`;
  const head = [
    `To: ${message.to}`,
    ...(message.cc ? [`Cc: ${message.cc}`] : []),
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
  ];
  const bodyPart = [
    `Content-Type: ${message.html ? 'text/html' : 'text/plain'}; charset="utf-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(base64Utf8(message.body)),
  ].join('\r\n');
  if (!message.attachments?.length) return [...head, bodyPart].join('\r\n');
  const parts = message.attachments.map((file) => [
    `--${boundary}`,
    `Content-Type: ${file.type ?? 'application/octet-stream'}; name="${encodeHeader(file.name)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${encodeHeader(file.name)}"`,
    '',
    wrap76(file.data),
  ].join('\r\n'));
  return [...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, bodyPart, ...parts, `--${boundary}--`, ''].join('\r\n');
}

export const MAILTO_LIMIT = 1800;

export function mailtoUrl(to: string, subject: string, body: string): string {
  const query = (text: string) => encodeURIComponent(text).replace(/%20/g, '%20');
  let trimmed = body;
  let url = `mailto:${encodeURIComponent(to)}?subject=${query(subject)}&body=${query(trimmed)}`;
  while (url.length > MAILTO_LIMIT && trimmed.length > 0) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.9));
    url = `mailto:${encodeURIComponent(to)}?subject=${query(subject)}&body=${query(`${trimmed}…`)}`;
  }
  return url;
}

export type LabelPreset = { id: string; label: string; cols: number; rows: number; width: number; height: number; top: number; left: number; gapX: number; gapY: number };

export const LABEL_PRESETS: LabelPreset[] = [
  { id: 'l7160', label: 'Avery L7160 · 21 nhãn 63,5 × 38,1 mm', cols: 3, rows: 7, width: 63.5, height: 38.1, top: 15.1, left: 7.2, gapX: 2.5, gapY: 0 },
  { id: 'l7163', label: 'Avery L7163 · 14 nhãn 99,1 × 38,1 mm', cols: 2, rows: 7, width: 99.1, height: 38.1, top: 15.1, left: 4.7, gapX: 2.5, gapY: 0 },
  { id: 'l7173', label: 'Avery L7173 · 10 nhãn 99,1 × 57 mm', cols: 2, rows: 5, width: 99.1, height: 57, top: 6, left: 4.7, gapX: 2.5, gapY: 0 },
  { id: 'l7651', label: 'Avery L7651 · 65 nhãn 38,1 × 21,2 mm', cols: 5, rows: 13, width: 38.1, height: 21.2, top: 10.7, left: 4.7, gapX: 2.5, gapY: 0 },
  { id: 'a4-24', label: 'Giấy A4 · 24 nhãn 70 × 37 mm', cols: 3, rows: 8, width: 70, height: 37, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  { id: 'a4-8', label: 'Giấy A4 · 8 nhãn 105 × 74 mm', cols: 2, rows: 4, width: 105, height: 74, top: 0.5, left: 0, gapX: 0, gapY: 0 },
  { id: 'a4-2', label: 'Giấy A4 · 2 nhãn 210 × 148 mm', cols: 1, rows: 2, width: 210, height: 148.5, top: 0, left: 0, gapX: 0, gapY: 0 },
];

const MM = 96 / 25.4;
export const mmToPx = (mm: number) => Math.round(mm * MM * 100) / 100;

export function labelTable(preset: LabelPreset, cell: (index: number) => JSONContent[]): JSONContent {
  const colwidth = [Math.round(mmToPx(preset.width + preset.gapX))];
  return {
    type: 'table',
    attrs: { tableStyle: 'plain', cellPadding: 6, layout: 'fixed' },
    content: Array.from({ length: preset.rows }, (_, row) => ({
      type: 'tableRow',
      attrs: { rowHeight: Math.round(mmToPx(preset.height + preset.gapY)), rowHeightRule: 'exact' },
      content: Array.from({ length: preset.cols }, (_, col) => ({
        type: 'tableCell',
        attrs: { colwidth, vAlign: 'middle' },
        content: cell(row * preset.cols + col),
      })),
    })),
  };
}

export function labelMargins(preset: LabelPreset) {
  const top = Math.round(mmToPx(Math.max(preset.top, 4)));
  const left = Math.round(mmToPx(Math.max(preset.left, 4)));
  return { top, bottom: top, left, right: left };
}
