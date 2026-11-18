import type { ConversionOptions } from './conversionTypes';
import { mediaConversionTargets } from './mediaConversionFormats';
import { supportsOfficeLayout } from './officeLayoutRoutes';

export function conversionGuide(fileName: string, target: string, fidelity: ConversionOptions['fidelity'], ocr: boolean) {
  const media = mediaConversionTargets(fileName).length > 0;
  const raster = ['png', 'jpg', 'webp'].includes(target);
  const visual = raster || target === 'pdf';
  const officeLayout = supportsOfficeLayout(fileName, target);
  const mode = officeLayout || (media && ['docx', 'pptx', 'xlsx', 'html'].includes(target));
  const layout = mode && fidelity !== 'editable';
  const usesOcr = media && !raster && !(layout && ['docx', 'pptx'].includes(target));
  const imageExtension = fileName.split('.').pop()?.toLowerCase().replace(/^(?:jpeg|jfif|jpe)$/, 'jpg');
  let description: string | undefined;
  if (officeLayout && visual) {
    description = layout
      ? 'Xuất theo bố cục in của tệp nguồn. Ô nhập và nút bấm xuất hiện như trên bản in.'
      : 'Dàn lại văn bản, bảng và ảnh theo khổ trang xuất. Vị trí và ngắt trang có thể thay đổi.';
  } else if (layout && (target === 'docx' || target === 'pptx')) {
    description = target === 'docx'
      ? 'Đặt ảnh của từng trang vào Word. Bảng, dấu và ô biểu mẫu giữ hình dạng khi in.'
      : 'Đặt ảnh của từng trang lên một slide. Bảng, dấu và ô biểu mẫu giữ hình dạng khi trình chiếu.';
  } else if (layout && target === 'html') {
    description = 'Hiển thị từng trang gốc dưới dạng ảnh trong tệp HTML. Có thể tìm và sao chép chữ đã nhận dạng.';
  } else if (layout && target === 'xlsx') {
    description = 'Trang tính Mẫu giữ ảnh từng trang. Trang tính Dữ liệu chứa chữ và số nhận dạng để chỉnh sửa.';
  } else if (media && target === 'xlsx') {
    description = 'Tách chữ và số thành các ô theo vị trí cột nhận dạng. Hãy kiểm tra lại ô gộp và số liệu.';
  } else if (media && target === 'html') {
    description = 'Xuất chữ theo thứ tự đọc của từng trang.';
  } else if (officeLayout && target === 'docx') {
    description = 'Dựng lại nội dung trong Word để sửa. Vị trí bảng, ảnh và ngắt trang có thể thay đổi.';
  } else if (media && mode && target === 'docx') {
    description = 'Trích chữ thành đoạn văn có thể sửa trong Word. Bảng và biểu mẫu có thể cần căn lại.';
  } else if (media && mode && target === 'pptx') {
    description = 'Đặt chữ có thể sửa lên nền trang gốc trong PowerPoint. Phông chữ có thể thay đổi.';
  } else if (media && target === 'pdf' && !ocr && /\.pdf$/i.test(fileName)) {
    description = 'Giữ tệp PDF gốc cùng các trường biểu mẫu hiện có.';
  } else if (raster && imageExtension === target) {
    description = 'Giữ dữ liệu ảnh gốc, gồm siêu dữ liệu và các khung hình động nếu có.';
  } else if (media && raster) {
    description = 'Xuất ảnh tĩnh của từng trang. Chữ và ô biểu mẫu trở thành một phần của ảnh.';
  } else if (['docx', 'pptx', 'xlsx', 'ods'].includes(target) && fileName.toLowerCase().endsWith(`.${target}`)) {
    description = 'Sao chép nguyên tệp, gồm định dạng và các đối tượng nhúng.';
  }
  return { mode, usesOcr, visual, officeLayout, description };
}
