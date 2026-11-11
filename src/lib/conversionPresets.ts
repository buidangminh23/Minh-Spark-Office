import { OFFICE_DOCUMENT_EXTENSIONS, OFFICE_SHEET_EXTENSIONS, OFFICE_SLIDE_EXTENSIONS } from './officeConversionFormats';
import type { FileKind } from './storage';

export type ConversionPreset = { id: string; from: FileKind; to: FileKind; target: string; title: string; note: string };
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

const preset = (from: FileKind, to: FileKind, target: string, title: string, note: string): ConversionPreset => ({ id: `${from}-${target}`, from, to, target, title, note });

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
    title: 'Từ PDF',
    presets: [
      preset('pdf', 'doc', 'docx', 'PDF sang Word', '.pdf → .docx'),
      preset('pdf', 'sheet', 'xlsx', 'PDF sang Excel', '.pdf → .xlsx'),
      preset('pdf', 'slide', 'pptx', 'PDF sang PowerPoint', '.pdf → .pptx'),
      preset('pdf', 'image', 'jpg', 'PDF sang ảnh', '.pdf → .jpg'),
    ],
  },
  {
    title: 'Giữa các ứng dụng',
    presets: [
      preset('doc', 'slide', 'pptx', 'Word sang PowerPoint', '.docx → .pptx'),
      preset('slide', 'doc', 'docx', 'PowerPoint sang Word', '.pptx → .docx'),
      preset('doc', 'sheet', 'xlsx', 'Word sang Excel', 'Trích bảng → .xlsx'),
      preset('sheet', 'doc', 'docx', 'Excel sang Word', '.xlsx → .docx'),
    ],
  },
  {
    title: 'Ảnh và nhận dạng chữ',
    presets: [
      preset('image', 'doc', 'docx', 'Ảnh sang Word', 'OCR → .docx'),
      preset('image', 'sheet', 'xlsx', 'Ảnh sang Excel', 'OCR bảng → .xlsx'),
      preset('slide', 'image', 'jpg', 'PowerPoint sang ảnh', '.pptx → .jpg'),
      preset('image', 'image', 'jpg', 'Đổi định dạng ảnh', '.png, .webp → .jpg'),
    ],
  },
];

export const CONVERSION_PRESETS = CONVERSION_PRESET_GROUPS.flatMap((group) => group.presets);

export function presetAccept(value: ConversionPreset) {
  return SOURCE_EXTENSIONS[value.from].map((extension) => `.${extension}`).join(',');
}

export function presetAcceptsFile(value: ConversionPreset, fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return fileName.includes('.') && SOURCE_EXTENSIONS[value.from].includes(extension);
}

export function presetSampleName(value: ConversionPreset) {
  return `sample.${SOURCE_EXTENSIONS[value.from][0]}`;
}
