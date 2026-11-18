import type { ConversionTarget } from './conversionTypes';
import { isImageFile, SUPPORTED_IMAGE_EXTENSIONS } from './imageFormatNames';

export const IMAGE_SOURCE_EXTENSIONS = SUPPORTED_IMAGE_EXTENSIONS;
export const IMAGE_OUTPUT_EXTENSIONS = ['png', 'jpg', 'webp', 'bmp', 'tiff'];
export function imageSourceFormat(fileName: string) {
  if (!isImageFile(fileName)) return '';
  return fileName.split('.').pop()!.toLowerCase().replace(/^(?:jpeg|jfif|jpe)$/, 'jpg').replace(/^tif$/, 'tiff');
}
const TARGETS: Record<string, ConversionTarget> = {
  pdf: { id: 'pdf', label: 'PDF (.pdf)', description: 'Giữ nền và bố cục; OCR tạo chữ PDF chỉnh sửa được khi được bật.' },
  docx: { id: 'docx', label: 'Word (.docx)', description: 'Giữ bố cục bằng ảnh trang, hoặc lấy chữ/OCR để chỉnh sửa.' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Giữ ảnh từng trang và tách giá trị vào các trang tính có thể sửa, hoặc chỉ xuất dữ liệu.' },
  pptx: { id: 'pptx', label: 'PowerPoint (.pptx)', description: 'Giữ bố cục: mỗi trang thành ảnh slide. Chỉnh sửa: giữ nền trang, chữ đặt đúng chỗ và sửa được.' },
  txt: { id: 'txt', label: 'Văn bản (.txt)', description: 'Trích chữ có sẵn hoặc OCR; không giữ định dạng.' },
  html: { id: 'html', label: 'Trang web (.html)', description: 'Giữ ảnh từng trang kèm lớp chữ tìm kiếm, hoặc xuất văn bản theo thứ tự đọc.' },
  png: { id: 'png', label: 'Ảnh PNG (.png)', description: 'Xuất từng trang thành ảnh PNG giữ độ trong suốt.' },
  jpg: { id: 'jpg', label: 'Ảnh JPEG (.jpg)', description: 'Mỗi trang thành ảnh JPEG nền trắng.' },
  webp: { id: 'webp', label: 'Ảnh WebP (.webp)', description: 'Xuất từng trang thành ảnh WebP.' },
  bmp: { id: 'bmp', label: 'Ảnh BMP (.bmp)', description: 'Xuất từng trang thành ảnh bitmap nền trắng.' },
  tiff: { id: 'tiff', label: 'Ảnh TIFF (.tiff)', description: 'Giữ tất cả các trang trong một tệp TIFF.' },
  csv: { id: 'csv', label: 'CSV (.csv)', description: 'Tách chữ và giá trị theo cột, mỗi trang một tệp CSV.' },
  tsv: { id: 'tsv', label: 'TSV (.tsv)', description: 'Tách chữ và giá trị theo cột bằng ký tự tab, mỗi trang một tệp.' },
  json: { id: 'json', label: 'JSON (.json)', description: 'Xuất các hàng và cột của từng trang dưới dạng mảng.' },
};

export function mediaConversionTargets(fileName: string): ConversionTarget[] {
  if (!/\.pdf$/i.test(fileName) && !isImageFile(fileName)) return [];
  const targets = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'html', 'csv', 'tsv', 'json', ...IMAGE_OUTPUT_EXTENSIONS].map((id) => TARGETS[id]);
  const id = imageSourceFormat(fileName);
  if (id && !IMAGE_OUTPUT_EXTENSIONS.includes(id)) targets.push({ id, label: `${id.toUpperCase()} (.${id})`, description: 'Giữ dữ liệu ảnh gốc, gồm siêu dữ liệu và các khung hình động nếu có.' });
  return targets;
}

