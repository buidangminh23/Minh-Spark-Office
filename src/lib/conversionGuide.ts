import type { ConversionOptions } from './conversionTypes';
import { IMAGE_SOURCE_EXTENSIONS, imageSourceFormat, mediaConversionTargets } from './mediaConversionFormats';
import { conversionPlan, supportsOfficeLayout } from './officeLayoutRoutes';

export function conversionGuide(fileName: string, target: string, fidelity: ConversionOptions['fidelity'], ocr: boolean) {
  const media = mediaConversionTargets(fileName).length > 0;
  const plan = conversionPlan(fileName, target, fidelity);
  const mediaTarget = plan.find(step => step.via === 'media')?.target;
  const needsEngine = plan.some(step => step.via === 'native');
  const raster = (IMAGE_SOURCE_EXTENSIONS as readonly string[]).includes(target);
  const visual = raster || target === 'pdf';
  const officeLayout = supportsOfficeLayout(fileName, target);
  const mode = officeLayout || (media && !!mediaTarget && !plan.some(step => step.editable) && ['docx', 'pptx', 'xlsx', 'html'].includes(mediaTarget));
  const layout = mode && fidelity !== 'editable';
  const usesOcr = !!mediaTarget && !(raster || ['bmp', 'tiff'].includes(mediaTarget)) && !(layout && ['docx', 'pptx'].includes(mediaTarget));
  const imageExtension = imageSourceFormat(fileName);
  let description: string | undefined;
  if (officeLayout && visual) {
    description = layout
      ? 'Xuất theo bố cục in của tệp nguồn. Ô nhập và nút bấm xuất hiện như trên bản in.'
      : 'Dàn lại văn bản, bảng và ảnh theo khổ trang xuất. Vị trí và ngắt trang có thể thay đổi.';
  } else if (layout && (mediaTarget === 'docx' || mediaTarget === 'pptx')) {
    description = mediaTarget === 'docx'
      ? 'Đặt ảnh của từng trang vào Word. Bảng, dấu và ô biểu mẫu giữ hình dạng khi in.'
      : 'Đặt ảnh của từng trang lên một slide. Bảng, dấu và ô biểu mẫu giữ hình dạng khi trình chiếu.';
  } else if (layout && mediaTarget === 'html') {
    description = 'Hiển thị từng trang gốc dưới dạng ảnh trong tệp HTML. Có thể tìm và sao chép chữ đã nhận dạng.';
  } else if (layout && mediaTarget === 'xlsx') {
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
  } else if (raster && imageExtension === mediaTarget) {
    description = 'Giữ dữ liệu ảnh gốc, gồm siêu dữ liệu và các khung hình động nếu có.';
  } else if (media && ['png', 'jpg', 'webp', 'bmp'].includes(target)) {
    description = 'Xuất ảnh tĩnh của từng trang. Chữ và ô biểu mẫu trở thành một phần của ảnh.';
  } else if (['docx', 'pptx', 'xlsx', 'ods'].includes(target) && fileName.toLowerCase().endsWith(`.${target}`)) {
    description = 'Sao chép nguyên tệp, gồm định dạng và các đối tượng nhúng.';
  }
  if (plan[0]?.via === 'copy' || plan.every(step => step.via === 'package')) description = 'Giữ nguyên các thành phần, nội dung và định dạng của tệp.';
  else if (plan.length === 1 && plan[0].via === 'native' && target !== 'pdf') description = 'Bộ LibreOffice tích hợp chuyển trực tiếp sang định dạng đích. Nội dung và đối tượng được giữ theo khả năng của định dạng.';
  return { mode, usesOcr, visual, officeLayout, needsEngine, description };
}
