import type { ConversionTarget } from './conversionTypes';
import { isImageFile, SUPPORTED_IMAGE_EXTENSIONS } from './imageFormatNames';

export const IMAGE_SOURCE_EXTENSIONS = SUPPORTED_IMAGE_EXTENSIONS;
export const IMAGE_OUTPUT_EXTENSIONS = ['png', 'jpg', 'jfif', 'webp', 'bmp', 'tiff', 'gif', 'ico', 'avif', 'svg', 'svgz', 'dib', 'heic', 'heif'];
export function imageSourceFormat(fileName: string) {
  if (!isImageFile(fileName)) return '';
  return fileName.split('.').pop()!.toLowerCase().replace(/^(?:jpeg|jfif|jpe)$/, 'jpg').replace(/^tif$/, 'tiff');
}
const TARGETS: Record<string, ConversionTarget> = {
  pdf: { id: 'pdf', label: 'PDF (.pdf)', description: 'Giữ nguyên ảnh từng trang; OCR thêm lớp chữ ẩn để tìm kiếm và sao chép.' },
  docx: { id: 'docx', label: 'Word (.docx)', description: 'Giữ bố cục bằng ảnh trang, hoặc lấy chữ/OCR để chỉnh sửa.' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Giữ ảnh từng trang và tách giá trị vào các trang tính có thể sửa, hoặc chỉ xuất dữ liệu.' },
  pptx: { id: 'pptx', label: 'PowerPoint (.pptx)', description: 'Giữ bố cục: mỗi trang thành ảnh slide. Chỉnh sửa: giữ nền trang, chữ đặt đúng chỗ và sửa được.' },
  txt: { id: 'txt', label: 'Văn bản (.txt)', description: 'Trích chữ có sẵn hoặc OCR; không giữ định dạng.' },
  html: { id: 'html', label: 'Trang web (.html)', description: 'Giữ ảnh từng trang kèm lớp chữ tìm kiếm, hoặc xuất văn bản theo thứ tự đọc.' },
  png: { id: 'png', label: 'Ảnh PNG (.png)', description: 'Xuất từng trang thành ảnh PNG giữ độ trong suốt.' },
  jpg: { id: 'jpg', label: 'Ảnh JPEG (.jpg)', description: 'Mỗi trang thành ảnh JPEG nền trắng.' },
  jfif: { id: 'jfif', label: 'Ảnh JPEG/JFIF (.jfif)', description: 'Mỗi trang thành ảnh JPEG có phần khai báo JFIF, nền trắng.' },
  webp: { id: 'webp', label: 'Ảnh WebP (.webp)', description: 'Xuất từng trang thành ảnh WebP.' },
  bmp: { id: 'bmp', label: 'Ảnh BMP (.bmp)', description: 'Xuất từng trang thành ảnh bitmap nền trắng.' },
  tiff: { id: 'tiff', label: 'Ảnh TIFF (.tiff)', description: 'Giữ tất cả các trang trong một tệp TIFF.' },
  gif: { id: 'gif', label: 'Ảnh GIF (.gif)', description: 'Tối đa 256 màu mỗi khung. Mỗi trang tài liệu thành một tệp; ảnh động giữ các khung và thời lượng khi trình duyệt hỗ trợ.' },
  ico: { id: 'ico', label: 'Biểu tượng Windows (.ico)', description: 'Mỗi trang thành một biểu tượng PNG trong ICO, giữ tỉ lệ và thu nhỏ tối đa 256 px.' },
  avif: { id: 'avif', label: 'Ảnh AVIF (.avif)', description: 'Mỗi trang thành một ảnh AVIF nén bằng AV1.' },
  svg: { id: 'svg', label: 'Ảnh SVG (.svg)', description: 'Giữ vector của nguồn SVG. Các nguồn khác được nhúng dưới dạng ảnh PNG trong từng trang SVG.' },
  svgz: { id: 'svgz', label: 'Ảnh SVG nén (.svgz)', description: 'Nén SVG bằng gzip. Giữ vector của nguồn SVG hoặc nhúng ảnh PNG của từng trang.' },
  dib: { id: 'dib', label: 'Bitmap DIB (.dib)', description: 'Mỗi trang thành một ảnh bitmap DIB 24 bit nền trắng.' },
  heic: { id: 'heic', label: 'Ảnh HEIC (.heic)', description: 'Mỗi trang thành một tệp HEIF dùng bộ mã hóa HEVC tích hợp.' },
  heif: { id: 'heif', label: 'Ảnh HEIF (.heif)', description: 'Mỗi trang thành một tệp HEIF dùng bộ mã hóa HEVC tích hợp.' },
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

