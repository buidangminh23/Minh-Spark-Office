import type { ConversionTarget } from './conversionTypes';
import { DATA_EXCHANGE_EXTENSIONS, dataExchangeTargets } from './dataExchangeFormats';

export const OFFICE_DOCUMENT_EXTENSIONS = ['docx', 'doc', 'dot', 'dotx', 'docm', 'dotm', 'odt', 'ott', 'fodt', 'rtf', 'txt', 'md', 'html', 'htm', 'xhtml', 'epub'] as const;
export const OFFICE_SHEET_EXTENSIONS = ['xlsx', 'xls', 'xlt', 'xltx', 'xlsm', 'xltm', 'xlsb', 'ods', 'ots', 'fods', 'csv', 'tsv', 'json', ...DATA_EXCHANGE_EXTENSIONS] as const;
export const OFFICE_SLIDE_EXTENSIONS = ['pptx', 'ppt', 'pps', 'pot', 'ppsx', 'potx', 'pptm', 'ppsm', 'potm', 'odp', 'otp', 'fodp'] as const;

export const officeTargets: Record<string, ConversionTarget> = {
  ...dataExchangeTargets,
  dot: { id: 'dot', label: 'Mẫu Word 97–2003 (.dot)', description: 'Mẫu văn bản Word nhị phân cho phiên bản cũ.' },
  xlt: { id: 'xlt', label: 'Mẫu Excel 97–2003 (.xlt)', description: 'Mẫu bảng tính Excel nhị phân cho phiên bản cũ.' },
  pot: { id: 'pot', label: 'Mẫu PowerPoint 97–2003 (.pot)', description: 'Mẫu trình chiếu PowerPoint nhị phân cho phiên bản cũ.' },
  pps: { id: 'pps', label: 'Trình chiếu PowerPoint 97–2003 (.pps)', description: 'Tệp PowerPoint nhị phân mở ở chế độ trình chiếu.' },
  fodt: { id: 'fodt', label: 'Flat OpenDocument Text (.fodt)', description: 'Lưu văn bản OpenDocument trong một tệp XML.' },
  fods: { id: 'fods', label: 'Flat OpenDocument Spreadsheet (.fods)', description: 'Lưu bảng tính OpenDocument trong một tệp XML.' },
  fodp: { id: 'fodp', label: 'Flat OpenDocument Presentation (.fodp)', description: 'Lưu trình chiếu OpenDocument trong một tệp XML.' },
  xhtml: { id: 'xhtml', label: 'XHTML (.xhtml)', description: 'Trang web theo cú pháp XML, giữ bảng, ảnh nhúng và trường biểu mẫu được hỗ trợ.' },
  ...Object.fromEntries(['docm', 'dotm', 'xlsm', 'xltm', 'pptm', 'potm', 'ppsm'].map(id => [id, {
    id, label: id.toUpperCase() + ' (.' + id + ')', description: 'Gói Office hỗ trợ macro. Chuyển giữa các biến thể macro cùng loại sẽ giữ dự án VBA gốc.',
  }])),
  xlsb: { id: 'xlsb', label: 'Excel Binary (.xlsb)', description: 'Lưu giá trị trong từng ô. Biểu thức công thức và ghi chú được lưu ở trang tính riêng để đối chiếu.' },
  ott: { id: 'ott', label: 'Mẫu OpenDocument Text (.ott)', description: 'Mẫu văn bản OpenDocument.' },
  ots: { id: 'ots', label: 'Mẫu OpenDocument Spreadsheet (.ots)', description: 'Mẫu bảng tính OpenDocument.' },
  otp: { id: 'otp', label: 'Mẫu OpenDocument Presentation (.otp)', description: 'Mẫu trình chiếu OpenDocument.' },
  doc: { id: 'doc', label: 'Word 97–2003 (.doc)', description: 'Tài liệu Word nhị phân cho phiên bản cũ.' },
  xls: { id: 'xls', label: 'Excel 97–2003 (.xls)', description: 'Bảng tính Excel nhị phân cho phiên bản cũ.' },
  ppt: { id: 'ppt', label: 'PowerPoint 97–2003 (.ppt)', description: 'Bài trình chiếu PowerPoint nhị phân cho phiên bản cũ.' },
  odp: { id: 'odp', label: 'OpenDocument Presentation (.odp)', description: 'Bài trình chiếu OpenDocument có thể chỉnh sửa.' },
  dotx: { id: 'dotx', label: 'Mẫu Word (.dotx)', description: 'Tạo mẫu để dùng lại bố cục và nội dung Word.' },
  xltx: { id: 'xltx', label: 'Mẫu Excel (.xltx)', description: 'Tạo mẫu để dùng lại các trang tính và công thức.' },
  potx: { id: 'potx', label: 'Mẫu PowerPoint (.potx)', description: 'Tạo mẫu PowerPoint từ các trang chiếu.' },
  ppsx: { id: 'ppsx', label: 'Trình chiếu PowerPoint (.ppsx)', description: 'Mở trực tiếp ở chế độ trình chiếu PowerPoint.' },
  docx: { id: 'docx', label: 'Word (.docx)', description: 'Văn bản và bảng có thể chỉnh sửa; bố cục được dựng lại.' },
  odt: { id: 'odt', label: 'OpenDocument (.odt)', description: 'Văn bản cho LibreOffice và OpenOffice.' },
  rtf: { id: 'rtf', label: 'Rich Text (.rtf)', description: 'Văn bản có định dạng cơ bản.' },
  txt: { id: 'txt', label: 'Văn bản (.txt)', description: 'Nội dung chữ, không giữ ảnh và định dạng.' },
  md: { id: 'md', label: 'Markdown (.md)', description: 'Tiêu đề, danh sách và nội dung văn bản.' },
  html: { id: 'html', label: 'Trang web (.html)', description: 'Tệp HTML độc lập, giữ ảnh nhúng được hỗ trợ.' },
  epub: { id: 'epub', label: 'Sách điện tử (.epub)', description: 'Nội dung co giãn theo màn hình máy đọc sách.' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Giữ các trang tính. Với tài liệu, xuất chữ, bảng, ô gộp và ảnh nhúng theo thứ tự gốc.' },
  ods: { id: 'ods', label: 'Bảng tính OpenDocument (.ods)', description: 'Bảng tính cho LibreOffice; định dạng nâng cao có thể thay đổi.' },
  csv: { id: 'csv', label: 'Dữ liệu CSV (.csv)', description: 'Mỗi bảng một tệp; lưu giá trị, không giữ công thức và kiểu ô.' },
  tsv: { id: 'tsv', label: 'Dữ liệu TSV (.tsv)', description: 'Mỗi bảng một tệp, các cột cách nhau bằng tab.' },
  json: { id: 'json', label: 'Dữ liệu JSON (.json)', description: 'Mỗi trang tính một mảng hàng; gồm giá trị ô.' },
  pptx: { id: 'pptx', label: 'PowerPoint (.pptx)', description: 'Tạo trang chiếu mới từ tiêu đề và nội dung.' },
  pdf: { id: 'pdf', label: 'PDF (.pdf)', description: 'Dàn lại nội dung thành các trang; không sao chép nguyên bố cục gốc.' },
  png: { id: 'png', label: 'Ảnh PNG (.png)', description: 'Mỗi trang nội dung đã dàn lại thành một ảnh.' },
  jpg: { id: 'jpg', label: 'Ảnh JPEG (.jpg)', description: 'Ảnh từng trang nội dung đã dàn lại, nền trắng.' },
  webp: { id: 'webp', label: 'Ảnh WebP (.webp)', description: 'Ảnh từng trang nội dung đã dàn lại, dung lượng nhỏ.' },
};

const DELIMITED_XLSX_TARGET: ConversionTarget = { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Mỗi trường vào một cột riêng, thành bảng Excel có tiêu đề cố định, nút lọc và độ rộng cột tự căn; số, ngày, phần trăm được nhận đúng kiểu.' };

export function officeFileKind(name: string): 'document' | 'sheet' | 'slide' | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if ((OFFICE_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) return 'document';
  if ((OFFICE_SHEET_EXTENSIONS as readonly string[]).includes(ext)) return 'sheet';
  if ((OFFICE_SLIDE_EXTENSIONS as readonly string[]).includes(ext)) return 'slide';
  return null;
}

export function officeConversionTargets(fileName: string): ConversionTarget[] {
  const kind = officeFileKind(fileName);
  if (!kind) return [];
  const primary = { document: 'docx', sheet: 'xlsx', slide: 'pptx' }[kind];
  const ids = [primary, ...Object.keys(officeTargets).filter(id => id !== primary)];
  const delimited = /\.(csv|tsv)$/i.test(fileName);
  return ids.map((id) => (delimited && id === 'xlsx' ? DELIMITED_XLSX_TARGET : officeTargets[id]));
}
