import type { ConversionTarget } from './conversionTypes';

const IMAGE_EXTENSIONS = /\.(png|jpe?g|jfif|jpe|webp|gif|svg|bmp|ico|avif|tiff?|heic|heif)$/i;
const TARGETS: Record<string, ConversionTarget> = {
  pdf: { id: 'pdf', label: 'PDF (.pdf)', description: 'Giữ hình trang; OCR bổ sung lớp chữ tìm kiếm khi được bật.' },
  docx: { id: 'docx', label: 'Word (.docx)', description: 'Giữ bố cục bằng ảnh trang, hoặc lấy chữ/OCR để chỉnh sửa.' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Nhận dạng chữ và vị trí cột; cần đối chiếu bảng, số liệu sau chuyển đổi.' },
  pptx: { id: 'pptx', label: 'PowerPoint (.pptx)', description: 'Giữ bố cục: mỗi trang thành ảnh slide. Chỉnh sửa: giữ nền trang, chữ đặt đúng chỗ và sửa được.' },
  txt: { id: 'txt', label: 'Văn bản (.txt)', description: 'Trích chữ có sẵn hoặc OCR; không giữ định dạng.' },
  html: { id: 'html', label: 'Trang web (.html)', description: 'Chữ theo trang; không giữ hình và kiểu chữ gốc.' },
  png: { id: 'png', label: 'Ảnh PNG (.png)', description: 'Mỗi trang thành ảnh PNG; ảnh động lấy một khung hình.' },
  jpg: { id: 'jpg', label: 'Ảnh JPEG (.jpg)', description: 'Mỗi trang thành ảnh JPEG nền trắng.' },
  webp: { id: 'webp', label: 'Ảnh WebP (.webp)', description: 'Mỗi trang thành ảnh WebP; kiểm tra hỗ trợ trình duyệt.' },
};

export function mediaConversionTargets(fileName: string): ConversionTarget[] {
  if (!/\.pdf$/i.test(fileName) && !IMAGE_EXTENSIONS.test(fileName)) return [];
  return ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'html', 'png', 'jpg', 'webp'].map((id) => TARGETS[id]);
}

