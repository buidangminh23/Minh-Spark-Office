import { OFFICE_DOCUMENT_EXTENSIONS, OFFICE_SHEET_EXTENSIONS, OFFICE_SLIDE_EXTENSIONS } from './officeConversionFormats';
import type { FileKind } from './storage';

export type FormatBadge = { text: string; light: string; dark: string };
export type ConversionPreset = { id: string; from: FileKind; to: FileKind | FormatBadge; target: string; title: string; note: string; fromBadge?: FormatBadge; sources?: readonly string[]; sourceLabel?: string };
export type ConversionPresetGroup = { title: string; presets: ConversionPreset[] };

export const IMAGE_SOURCE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'jfif', 'jpe', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif', 'tif', 'tiff', 'heic', 'heif'] as const;

const SOURCE_EXTENSIONS: Record<FileKind, readonly string[]> = {
  doc: OFFICE_DOCUMENT_EXTENSIONS,
  sheet: OFFICE_SHEET_EXTENSIONS,
  slide: OFFICE_SLIDE_EXTENSIONS,
  pdf: ['pdf'],
  image: IMAGE_SOURCE_EXTENSIONS,
};

export const SOURCE_LABEL: Record<FileKind, string> = { doc: 'Word', sheet: 'Excel', slide: 'PowerPoint', pdf: 'PDF', image: 'ảnh' };

const preset = (from: FileKind, to: FileKind | FormatBadge, target: string, title: string, note: string): ConversionPreset => ({ id: `${from}-${target}`, from, to, target, title, note });
const badge = (text: string, light: string, dark: string): FormatBadge => ({ text, light, dark });
const narrow = (value: ConversionPreset, id: string, fromBadge: FormatBadge, sources: readonly string[], sourceLabel: string): ConversionPreset => ({ ...value, id, fromBadge, sources, sourceLabel });

const PNG = badge('PNG', '#38bdf8', '#0369d9');
const WEBP = badge('WEBP', '#34d3c4', '#0e8f84');
const TXT = badge('TXT', '#94a3b8', '#475569');
const HTML = badge('HTML', '#fb923c', '#e2450c');
const MD = badge('MD', '#64748b', '#1e293b');
const ODT = badge('ODT', '#38bdf8', '#1d62d4');
const ODS = badge('ODS', '#4ade80', '#15803d');
const RTF = badge('RTF', '#818cf8', '#4338ca');
const EPUB = badge('EPUB', '#fbbf24', '#c2410c');
const CSV = badge('CSV', '#2fd36f', '#0b8a43');
const TSV = badge('TSV', '#2dd4bf', '#0f8478');
const JSON_DATA = badge('JSON', '#fbbf24', '#c96a04');
const JPG = badge('JPG', '#fb7185', '#d3215c');

export const CONVERSION_PRESET_GROUPS: ConversionPresetGroup[] = [
  {
    title: 'Sang PDF',
    presets: [
      preset('doc', 'pdf', 'pdf', 'Word sang PDF', '.docx → .pdf'),
      preset('sheet', 'pdf', 'pdf', 'Excel sang PDF', '.xlsx → .pdf'),
      preset('slide', 'pdf', 'pdf', 'PowerPoint sang PDF', '.pptx → .pdf'),
      preset('image', 'pdf', 'pdf', 'Ảnh sang PDF', '.jpg, .png → .pdf'),
    ],
  },
  {
    title: 'Hay dùng',
    presets: [
      narrow(preset('sheet', 'sheet', 'xlsx', 'CSV sang Excel', 'Tách cột, tạo bảng, căn cột'), 'csv-xlsx', CSV, ['csv', 'tsv'], 'CSV'),
      preset('sheet', CSV, 'csv', 'Excel sang CSV', '.xlsx → .csv'),
      narrow(preset('image', JPG, 'jpg', 'PNG sang JPG', '.png → .jpg'), 'png-jpg', PNG, ['png'], 'PNG'),
      narrow(preset('image', PNG, 'png', 'JPG sang PNG', '.jpg → .png'), 'jpg-png', JPG, ['jpg', 'jpeg', 'jfif', 'jpe'], 'JPG'),
    ],
  },
  {
    title: 'Từ PDF',
    presets: [
      preset('pdf', 'doc', 'docx', 'PDF sang Word', '.pdf → .docx'),
      preset('pdf', 'sheet', 'xlsx', 'PDF sang Excel', '.pdf → .xlsx'),
      preset('pdf', 'slide', 'pptx', 'PDF sang PowerPoint', '.pdf → .pptx'),
      preset('pdf', 'image', 'jpg', 'PDF sang JPG', '.pdf → .jpg'),
      preset('pdf', PNG, 'png', 'PDF sang PNG', '.pdf → .png'),
      preset('pdf', TXT, 'txt', 'PDF sang văn bản', '.pdf → .txt'),
      preset('pdf', HTML, 'html', 'PDF sang HTML', '.pdf → .html'),
    ],
  },
  {
    title: 'Giữa Word, Excel, PowerPoint',
    presets: [
      preset('doc', 'slide', 'pptx', 'Word sang PowerPoint', '.docx → .pptx'),
      preset('slide', 'doc', 'docx', 'PowerPoint sang Word', '.pptx → .docx'),
      preset('doc', 'sheet', 'xlsx', 'Word sang Excel', 'Trích bảng → .xlsx'),
      preset('sheet', 'doc', 'docx', 'Excel sang Word', '.xlsx → .docx'),
      preset('sheet', 'slide', 'pptx', 'Excel sang PowerPoint', '.xlsx → .pptx'),
    ],
  },
  {
    title: 'Ảnh và nhận dạng chữ',
    presets: [
      preset('pdf', 'pdf', 'pdf', 'OCR PDF chỉnh sửa được', 'Giữ nền và bố cục'),
      preset('image', 'doc', 'docx', 'Ảnh sang Word', 'OCR → .docx'),
      preset('image', 'sheet', 'xlsx', 'Ảnh sang Excel', 'OCR bảng → .xlsx'),
      preset('image', 'slide', 'pptx', 'Ảnh sang PowerPoint', '.jpg, .png → .pptx'),
      preset('image', TXT, 'txt', 'Ảnh sang văn bản', 'OCR → .txt'),
      preset('doc', 'image', 'jpg', 'Word sang ảnh', '.docx → .jpg'),
      preset('sheet', 'image', 'jpg', 'Excel sang ảnh', '.xlsx → .jpg'),
      preset('slide', 'image', 'jpg', 'PowerPoint sang ảnh', '.pptx → .jpg'),
      preset('image', 'image', 'jpg', 'Ảnh sang JPG', '.png, .webp, .heic → .jpg'),
      preset('image', PNG, 'png', 'Ảnh sang PNG', '.jpg, .webp, .heic → .png'),
      preset('image', WEBP, 'webp', 'Ảnh sang WebP', '.jpg, .png → .webp'),
    ],
  },
  {
    title: 'Định dạng mở, web và dữ liệu',
    presets: [
      preset('doc', ODT, 'odt', 'Word sang ODT', '.docx → .odt'),
      preset('doc', RTF, 'rtf', 'Word sang RTF', '.docx → .rtf'),
      preset('doc', EPUB, 'epub', 'Word sang EPUB', 'Sách điện tử .epub'),
      preset('doc', MD, 'md', 'Word sang Markdown', '.docx → .md'),
      preset('doc', HTML, 'html', 'Word sang HTML', '.docx → .html'),
      preset('doc', TXT, 'txt', 'Word sang văn bản', '.docx → .txt'),
      preset('sheet', ODS, 'ods', 'Excel sang ODS', '.xlsx → .ods'),
      preset('sheet', TSV, 'tsv', 'Excel sang TSV', '.xlsx → .tsv'),
      preset('sheet', JSON_DATA, 'json', 'Excel sang JSON', '.xlsx → .json'),
      preset('sheet', HTML, 'html', 'Excel sang HTML', '.xlsx → .html'),
      preset('slide', ODT, 'odt', 'PowerPoint sang ODT', '.pptx → .odt'),
      preset('slide', MD, 'md', 'PowerPoint sang Markdown', '.pptx → .md'),
      preset('slide', HTML, 'html', 'PowerPoint sang HTML', '.pptx → .html'),
    ],
  },
];

export const CONVERSION_PRESETS = CONVERSION_PRESET_GROUPS.flatMap((group) => group.presets);

const presetSources = (value: ConversionPreset) => value.sources ?? SOURCE_EXTENSIONS[value.from];

export const presetSourceLabel = (value: ConversionPreset) => value.sourceLabel ?? SOURCE_LABEL[value.from];

export function presetAccept(value: ConversionPreset) {
  return presetSources(value).map((extension) => `.${extension}`).join(',');
}

export function presetAcceptsFile(value: ConversionPreset, fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return fileName.includes('.') && presetSources(value).includes(extension);
}

export function presetSampleName(value: ConversionPreset) {
  return `sample.${presetSources(value)[0]}`;
}
