export type FieldKind = 'page' | 'numpages' | 'numwords' | 'date' | 'time' | 'filename' | 'title' | 'author' | 'subject' | 'keywords' | 'company';

export const FIELD_KINDS: { id: FieldKind; label: string; hint: string }[] = [
  { id: 'page', label: 'Số trang hiện tại', hint: 'PAGE' },
  { id: 'numpages', label: 'Tổng số trang', hint: 'NUMPAGES' },
  { id: 'numwords', label: 'Tổng số từ', hint: 'NUMWORDS' },
  { id: 'date', label: 'Ngày hôm nay', hint: 'DATE' },
  { id: 'time', label: 'Giờ hiện tại', hint: 'TIME' },
  { id: 'filename', label: 'Tên tệp', hint: 'FILENAME' },
  { id: 'title', label: 'Tiêu đề tài liệu', hint: 'TITLE' },
  { id: 'author', label: 'Tác giả', hint: 'AUTHOR' },
  { id: 'subject', label: 'Chủ đề', hint: 'SUBJECT' },
  { id: 'keywords', label: 'Từ khoá', hint: 'KEYWORDS' },
  { id: 'company', label: 'Đơn vị', hint: 'COMPANY' },
];

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const two = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${two(date.getHours())}:${two(date.getMinutes())}`;
const dayMonthYear = (date: Date) => `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
const longDate = (date: Date) => `ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;

export const DATE_FORMATS: { id: string; render: (date: Date) => string }[] = [
  { id: 'short', render: dayMonthYear },
  { id: 'dash', render: (d) => `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}` },
  { id: 'iso', render: (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` },
  { id: 'long', render: longDate },
  { id: 'long-cap', render: (d) => `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}` },
  { id: 'weekday', render: (d) => `${WEEKDAYS[d.getDay()]}, ${longDate(d)}` },
  { id: 'place', render: (d) => `Hà Nội, ${longDate(d)}` },
  { id: 'month', render: (d) => `tháng ${d.getMonth() + 1} năm ${d.getFullYear()}` },
  { id: 'month-short', render: (d) => `${two(d.getMonth() + 1)}/${d.getFullYear()}` },
  { id: 'en-long', render: (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
  { id: 'en-short', render: (d) => d.toLocaleDateString('en-US') },
  { id: 'time', render: clock },
  { id: 'time-seconds', render: (d) => `${clock(d)}:${two(d.getSeconds())}` },
  { id: 'datetime', render: (d) => `${clock(d)} ${dayMonthYear(d)}` },
];

export const formatDate = (format: string, date = new Date()) => (DATE_FORMATS.find((item) => item.id === format) ?? DATE_FORMATS[0]).render(date);

export const defaultFormat = (kind: FieldKind) => (kind === 'time' ? 'time' : kind === 'date' ? 'short' : '');
