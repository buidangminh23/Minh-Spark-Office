import type { ConversionTarget } from './conversionTypes';

export const OFFICE_DOCUMENT_EXTENSIONS = ['docx', 'dotx', 'txt', 'md', 'html', 'htm'] as const;
export const OFFICE_SHEET_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv'] as const;
export const OFFICE_SLIDE_EXTENSIONS = ['pptx', 'ppsx', 'potx'] as const;

const targets: Record<string, ConversionTarget> = {
  docx: { id: 'docx', label: 'Word (.docx)', description: 'Văn bản và bảng có thể chỉnh sửa; bố cục được dựng lại.' },
  odt: { id: 'odt', label: 'OpenDocument (.odt)', description: 'Văn bản cho LibreOffice và OpenOffice.' },
  rtf: { id: 'rtf', label: 'Rich Text (.rtf)', description: 'Văn bản có định dạng cơ bản.' },
  txt: { id: 'txt', label: 'Văn bản (.txt)', description: 'Nội dung chữ, không giữ ảnh và định dạng.' },
  md: { id: 'md', label: 'Markdown (.md)', description: 'Tiêu đề, danh sách và nội dung văn bản.' },
  html: { id: 'html', label: 'Trang web (.html)', description: 'Tệp HTML độc lập, giữ ảnh nhúng được hỗ trợ.' },
  epub: { id: 'epub', label: 'Sách điện tử (.epub)', description: 'Nội dung co giãn theo màn hình máy đọc sách.' },
  xlsx: { id: 'xlsx', label: 'Excel (.xlsx)', description: 'Giữ các trang tính; với tài liệu chỉ trích các bảng.' },
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
  const ids = kind === 'document'
    ? ['docx', 'odt', 'rtf', 'pdf', 'txt', 'md', 'html', 'epub', 'pptx', 'xlsx', 'csv', 'tsv', 'png', 'jpg', 'webp']
    : kind === 'sheet'
      ? ['xlsx', 'ods', 'csv', 'tsv', 'json', 'html', 'docx', 'pdf', 'pptx', 'png', 'jpg', 'webp']
      : kind === 'slide'
        ? ['pptx', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'pdf', 'png', 'jpg', 'webp']
        : [];
  const delimited = /\.(csv|tsv)$/i.test(fileName);
  return ids.map((id) => (delimited && id === 'xlsx' ? DELIMITED_XLSX_TARGET : targets[id]));
}
